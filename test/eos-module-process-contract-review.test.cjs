'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, writeFile, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { createHash } = require('node:crypto');
const { join, resolve } = require('node:path');
const { EosModuleProcess } = require('../src/lib/eosModuleProcess');
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

const fixtureSource = `
'use strict';
const { Readable } = require('node:stream');
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
exports.createHostedModule = ({ adapter, canOperate, getHistoryBackupRequirement }) => {
    let produced = 0, destroyed = 0, opened = 0, lastState = null, lastMessage = null;
    return {
        async start() { if (!canOperate()) throw new Error('EOS_FIXTURE_INACTIVE'); },
        async stop() {},
        async onStateChange(id, state) { lastState = { id, state }; },
        async onMessage(message) { lastMessage = message; },
        getStatus() { return { produced, destroyed, opened, lastState, lastMessage }; },
        async command(name, payload) {
            if (name === 'bridge') return new Promise(resolve => adapter.sendTo('eos-admin.0', 'nexowatt.para14a.hello.v1', payload, resolve));
            if (name === 'write') { await adapter.setStateAsync('info.value', 5, true); return { done: true }; }
            if (name === 'history') return getHistoryBackupRequirement();
            if (name === 'gateAfter') { await pause(payload.ms); return { permitted: canOperate() }; }
            if (name === 'timer') return new Promise(resolve => { const handle = adapter.setTimeout(value => resolve({ value, handle: typeof handle.unref }), 10, payload.value); });
            throw new Error('EOS_FIXTURE_COMMAND');
        },
        async getDownload(name) {
            if (name === 'late') await pause(5300);
            opened++;
            let sent = 0;
            const stream = new Readable({
                highWaterMark: 65536,
                read() {
                    if (sent >= 512) { this.push(null); return; }
                    sent++; produced++; this.push(Buffer.alloc(65536, sent % 256));
                },
                destroy(error, done) { destroyed++; done(error); },
            });
            return { stream, filename: 'synthetic.nwb', contentType: 'application/octet-stream', size: 512 * 65536 };
        },
    };
};
`;
async function fixture(t, id = 'backup') {
    const baseDir = await mkdtemp(join(tmpdir(), 'eos-module-contract-'));
    await mkdir(join(baseDir, 'modules', id), { recursive: true });
    await writeFile(join(baseDir, 'modules', id, 'index.js'), fixtureSource);
    const calls = [];
    const adapter = {
        namespace: 'eos-admin.0.' + id, hostNamespace: 'eos-admin.0', eosTargetNamespace: 'eos-admin.0', instance: 0,
        config: { enabled: true }, log: { info() {}, warn() {}, error() {}, debug() {} },
        async setStateAsync(...args) { calls.push(['setStateAsync', ...args]); },
        sendTo(...args) { const callback = args.pop(); calls.push(['sendTo', ...args]); callback({ accepted: true, echo: args[2] }); callback({ accepted: false }); },
    };
    const runtime = new EosModuleProcess({ id, baseDir, generation: 7,
        moduleOptions: { adapter, config: { enabled: true }, dataDir: baseDir,
            getHistoryBackupRequirement: async () => ({ provider: 'postgresql', namespace: 'eos-admin.0' }) },
        canOperate: () => true, onFailure() {},
    });
    t.after(async () => { await runtime.stop(); await rm(baseDir, { recursive: true, force: true }); });
    await runtime.start();
    return { runtime, calls };
}

test('real worker retains EEBUS callback reply, original message and acknowledged trust revocation', async t => {
    const { runtime, calls } = await fixture(t, 'eebus');
    const packet = { schema: 'nexowatt.para14a.hello.v1', negativePrice: -0.2, disabled: false, absent: null };
    assert.deepEqual(await runtime.command('bridge', packet), { accepted: true, echo: packet });
    assert.deepEqual(calls, [['sendTo', 'eos-admin.0', 'nexowatt.para14a.hello.v1', packet]]);
    const state = { val: false, ack: true, ts: 1700000000000, lc: 1700000000000, q: 0 };
    const id = 'eos-admin.0.eebus.devices.' + 'a'.repeat(40) + '.pairing.trusted';
    await runtime.onStateChange(id, state);
    const message = { from: 'eos-admin.0', command: 'nexowatt.para14a.implementation.v1', message: { accepted: false } };
    await runtime.onMessage(message);
    const status = await runtime.getStatus();
    assert.deepEqual(status.lastState, { id, state });
    assert.deepEqual(status.lastMessage, message);
    assert.deepEqual(await runtime.command('timer', { value: 42 }), { value: 42, handle: 'function' });
});

test('real worker preserves third-argument ACK and per-job backup history RPC', async t => {
    const { runtime, calls } = await fixture(t);
    assert.deepEqual(await runtime.command('write', {}), { done: true });
    assert.deepEqual(calls, [['setStateAsync', 'info.value', 5, true]]);
    assert.deepEqual(await runtime.command('history', {}), { provider: 'postgresql', namespace: 'eos-admin.0' });
});

test('backup stream cancellation before first byte closes the worker stream', async t => {
    const { runtime } = await fixture(t);
    const download = await runtime.getDownload('normal');
    const closed = new Promise(resolve => download.stream.once('close', resolve));
    download.stream.destroy(); await closed;
    await pause(100);
    const status = await runtime.getStatus();
    assert.equal(status.opened, 1);
    assert.equal(status.destroyed, 1, 'unread download must release the remote file descriptor');
});

test('backup download applies byte backpressure instead of buffering thousands of chunks', async t => {
    const { runtime } = await fixture(t);
    const download = await runtime.getDownload('normal');
    download.stream.on('error', () => {});
    download.stream.read(1);
    await pause(200);
    const status = await runtime.getStatus();
    download.stream.destroy();
    assert.equal(download.stream.readableObjectMode, false, 'download is a byte stream');
    assert.ok(status.produced <= 4, 'stalled reader must keep bounded byte prefetch, produced=' + status.produced);
});

test('late backup open after RPC deadline cannot leak an orphan stream', { timeout: 10000 }, async t => {
    const { runtime } = await fixture(t);
    await assert.rejects(runtime.getDownload('late'), /EOS_MODULE_PROCESS_TIMEOUT/);
    await pause(700);
    const status = await runtime.getStatus();
    assert.equal(status.opened, 1);
    assert.equal(status.destroyed, 1, 'late open after caller timeout must close its file descriptor');
});

test('backup byte stream delivers all bytes across many IPC chunks without truncation', async t => {
    const { runtime } = await fixture(t);
    const download = await runtime.getDownload('normal');
    let total = 0;
    const actual = createHash('sha256'), expected = createHash('sha256');
    for (let index = 1; index <= 512; index++) expected.update(Buffer.alloc(65536, index % 256));
    for await (const chunk of download.stream) {
        assert.ok(Buffer.isBuffer(chunk));
        actual.update(chunk); total += chunk.length;
    }
    assert.equal(total, download.size);
    assert.equal(actual.digest('hex'), expected.digest('hex'));
    const status = await runtime.getStatus();
    assert.equal(status.produced, 512);
    assert.equal(status.destroyed, 1);
});

test('expired and out-of-order worker leases cannot renew authority', async t => {
    for (const mode of ['expired', 'old-sequence']) {
        const { runtime } = await fixture(t);
        clearInterval(runtime.timer); runtime.timer = null;
        const result = runtime.command('gateAfter', { ms: 100 });
        await pause(10);
        const sequence = ++runtime.leaseSequence;
        if (mode === 'expired') runtime.rpc.event('lease', { allowed: true, sequence, expiresAt: Date.now() - 1 });
        else {
            runtime.rpc.event('lease', { allowed: false, sequence, expiresAt: Date.now() + 1000 });
            runtime.rpc.event('lease', { allowed: true, sequence: sequence - 1, expiresAt: Date.now() + 1000 });
        }
        assert.deepEqual(await result, { permitted: false }, mode);
        await runtime.stop();
    }
});

async function productionFixture(t, id, config, selectedBaseDir) {
    const folder = await mkdtemp(join(tmpdir(), 'eos-real-module-'));
    const installationDir = join(folder, 'iobroker');
    const eosDataDir = join(installationDir, 'iobroker-data/eos-admin.0');
    const dataDir = join(eosDataDir, 'modules', id);
    await mkdir(dataDir, { recursive: true, mode: 0o700 });
    const states = new Map(), objects = new Map(), subscriptions = new Set(), logs = [];
    const adapter = {
        namespace: id === 'devices' ? 'eos-admin.0' : 'eos-admin.0.' + id,
        hostNamespace: 'eos-admin.0', eosTargetNamespace: 'eos-admin.0', instance: 0, config,
        log: Object.fromEntries(['info', 'debug', 'warn', 'error'].map(level => [level, message => logs.push({ level, message })])),
        async getObjectAsync(key) { return objects.get(key) || null; },
        async getStateAsync(key) { return states.get(key) || null; },
        async setObjectNotExistsAsync(key, value) { if (!objects.has(key)) objects.set(key, value); },
        async extendObjectAsync(key, value) { objects.set(key, { ...objects.get(key), ...value }); },
        async setStateAsync(key, value, ack) { states.set(key, typeof value === 'object' ? value : { val: value, ack }); },
        async subscribeStatesAsync(pattern) { subscriptions.add(pattern); },
        async unsubscribeStatesAsync(pattern) { subscriptions.delete(pattern); },
        async getBackupDataFolders() { return []; },
        async sendBackupNotification() {},
        sendTo(_target, _name, _message, callback) { callback({ accepted: false, error: 'EOS_FIXTURE_BRIDGE_DISABLED' }); },
    };
    const runtime = new EosModuleProcess({ id, baseDir: selectedBaseDir || resolve(__dirname, '..'), generation: 9,
        moduleOptions: { adapter, config, dataDir, installationDir, eosDataDir,
            getHistoryBackupRequirement: async () => ({ provider: 'none' }) },
        canOperate: () => true, onFailure() {},
    });
    t.after(async () => { await runtime.stop(); await rm(folder, { recursive: true, force: true }); });
    return { runtime, folder, installationDir, eosDataDir, dataDir, states, objects, subscriptions, logs };
}

test('production Devices empty configuration starts and stops in real process without hardware', async t => {
    const f = await productionFixture(t, 'devices', { enabled: true, devices: [] });
    await f.runtime.start();
    const status = await f.runtime.getStatus();
    assert.equal(status.configured, 0); assert.equal(status.running, 0); assert.equal(status.state, 'running');
    assert.equal(f.states.get('modules.devices.info.connection').val, false);
    assert.ok(f.objects.has('devices'));
    await f.runtime.stop(); assert.equal(f.runtime.health().pid, null);
});

test('production EEBUS starts identity and subscriptions with all network functions disabled', async t => {
    const f = await productionFixture(t, 'eebus', { enabled: true, discoveryEnabled: false, shipServerEnabled: false,
        autoConnectEnabled: false, nexowattBridgeEnabled: false, commandDryRun: true });
    await f.runtime.start();
    const status = await f.runtime.getStatus();
    assert.equal(status.running, true); assert.equal(status.devices.length, 0); assert.equal(status.commandDryRun, true);
    assert.match(status.localSki, /^[a-fA-F0-9]{40}$/);
    assert.equal(f.states.get('info.connection').val, false);
    assert.equal(f.subscriptions.size, 4);
    await f.runtime.stop(); assert.equal(f.subscriptions.size, 0);
});

test('production Backup starts with protected local identity and history coverage RPC', async t => {
    const f = await productionFixture(t, 'backup', { enabled: true, minimalEnabled: false });
    await f.runtime.start();
    const status = await f.runtime.getStatus();
    assert.equal(status.running, false); assert.equal(status.encrypted, true); assert.equal(status.recoveryKeyAvailable, true);
    assert.equal(f.states.get('info.status').val, 'READY'); assert.deepEqual([...f.subscriptions], ['oneClick.*']);
    const coverage = await f.runtime.command('coverage', {});
    assert.equal(coverage.historyProvider, 'none');
    await f.runtime.stop(); assert.equal(f.subscriptions.size, 0);
});

test('real backup job and its controller subprocess terminate when module supervisor dies', { skip: process.platform !== 'linux', timeout: 12000 }, async t => {
    const wrapper = await mkdtemp(join(tmpdir(), 'eos-backup-wrapper-'));
    t.after(() => rm(wrapper, { recursive: true, force: true }));
    await mkdir(join(wrapper, 'modules', 'backup'), { recursive: true });
    // This isolated controller has no manufacturer-provisioned trust. Keep the
    // actual backup module, worker and fixed command runner; only that host
    // identity lookup is replaced with its documented absent result.
    const backupRoot = resolve(__dirname, '../modules/backup');
    await writeFile(join(wrapper, 'modules/backup/index.js'),
        'require(' + JSON.stringify(join(backupRoot, 'build/publicTrust.js')) + ').capturePublicTrust=async()=>null;\n' +
        'module.exports=require(' + JSON.stringify(join(backupRoot, 'index.js')) + ');\n');
    const f = await productionFixture(t, 'backup', { enabled: true, minimalEnabled: false }, wrapper);
    const cliRoot = join(f.installationDir, 'node_modules/iobroker.js-controller');
    const marker = join(f.folder, 'child-pids.json');
    await mkdir(cliRoot, { recursive: true });
    await writeFile(join(cliRoot, 'iobroker.js'),
        'require("node:fs").writeFileSync(' + JSON.stringify(marker) + ',JSON.stringify({controller:process.pid,worker:process.ppid}));setInterval(()=>{},1000);', { mode: 0o600 });
    await f.runtime.start();
    const started = await f.runtime.command('start', {});
    assert.equal(started.accepted, true);
    let pids;
    for (let attempt = 0; attempt < 100; attempt++) {
        try { pids = JSON.parse(await readFile(marker, 'utf8')); break; } catch { await pause(20); }
    }
    assert.ok(pids?.controller && pids?.worker, 'real job spawned the controller fixture');
    const active = async pid => {
        try {
            const stat = await readFile('/proc/' + pid + '/stat', 'utf8');
            return !/\) [ZX] /.test(stat);
        } catch (error) { if (error.code === 'ENOENT' || error.code === 'ESRCH') return false; throw error; }
    };
    t.after(() => { for (const pid of Object.values(pids || {})) { try { process.kill(pid, 'SIGKILL'); } catch {} } });
    assert.equal(await active(pids.controller), true); assert.equal(await active(pids.worker), true);
    f.runtime.kill('SIGKILL');
    for (let attempt = 0; attempt < 100 && (await active(pids.controller) || await active(pids.worker)); attempt++) await pause(20);
    assert.equal(await active(pids.controller), false, 'controller grandchild stopped');
    assert.equal(await active(pids.worker), false, 'detached backup worker stopped');
});

test('worker log sanitization covers MQTT URL credentials and long configured secrets before truncation', () => {
    const { sanitizeLog } = require('../src/lib/eosModuleProcessProtocol');
    const message = sanitizeLog('MQTT reconnect mqtts://alice:example-password@broker.local/topic; keep useful diagnostic', {});
    assert.ok(!message.includes('alice:example-password'));
    assert.match(message, /keep useful diagnostic/);
    const token = 'sensitive-long-token-' + 'ABCD'.repeat(700);
    const output = sanitizeLog('Connection failed: ' + token, { token });
    assert.ok(!output.includes('sensitive-long-token-'));
    assert.ok(output.length <= 1024);
});
