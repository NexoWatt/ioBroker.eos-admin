'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { EosModuleProcess } = require('../src/lib/eosModuleProcess');
const { EosModuleHost } = require('../src/lib/eosModuleHost');
const { channel, MAX_BYTES } = require('../src/lib/eosModuleProcessProtocol');
const { EventEmitter } = require('node:events');

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, timeout = 7000) {
    const limit = Date.now() + timeout;
    while (Date.now() < limit) { if (await predicate()) return; await delay(25); }
    assert.fail('condition did not become true before deadline');
}
const fixture = `
'use strict';
exports.validateConfig = config => ({...config,enabled:config.enabled===true});
exports.createHostedModule = options => ({
 async start() { await options.adapter.setObjectNotExistsAsync('devices.fixture',{type:'channel'}); },
 async stop() { if(options.config.hangStop) while(true) {} },
 getStatus() {return {pid:process.pid,permitted:options.canOperate(),secret:!!process.env.EOS_PROCESS_TEST_SECRET};},
 async command(name) {
  if(name==='crash') process.exit(42);
  if(name==='hang') while(true) {}
  if(name==='write') return options.adapter.setStateAsync('devices.fixture.command',17,false);
  if(name==='outside') return options.adapter.setStateAsync('chargingManagement.control.command',17,false);
  if(name==='unknown') return options.adapter.getForeignStateAsync('system.adapter.admin.0.alive');
  return {pid:process.pid};
 },
});`;
async function directory(t) {
    const dir = await mkdtemp(join(tmpdir(), 'eos-process-'));
    t.after(() => rm(dir, { recursive: true, force: true }));
    for (const id of ['devices', 'eebus', 'backup']) {
        await mkdir(join(dir, 'modules', id), { recursive: true });
        await writeFile(join(dir, 'modules', id, 'index.js'), fixture);
    }
    return dir;
}
async function runtime(t, config = {}) {
    const baseDir = await directory(t);
    const calls = [], failures = [];
    let allowed = true;
    const child = new EosModuleProcess({ id: 'devices', baseDir, generation: 4, watchdogMs: 500,
        onFailure: code => failures.push(code), canOperate: () => allowed,
        moduleOptions: { config: { enabled: true, ...config }, dataDir: baseDir,
            adapter: { namespace: 'eos-admin.0', instance: 0, config, log: {},
                async setObjectNotExistsAsync(...args) { calls.push(args); },
                async setStateAsync(...args) { calls.push(args); return true; } } },
    });
    t.after(() => child.stop());
    await child.start();
    return { child, calls, failures, revoke: () => { allowed = false; child.revoke(); } };
}

test('production worker has its own PID, narrow facade and filtered environment', async t => {
    process.env.EOS_PROCESS_TEST_SECRET = 'never-transfer';
    t.after(() => { delete process.env.EOS_PROCESS_TEST_SECRET; });
    const x = await runtime(t);
    const status = await x.child.getStatus();
    assert.notEqual(status.pid, process.pid);
    assert.equal(status.pid, x.child.health().pid);
    assert.equal(status.permitted, true);
    assert.equal(status.secret, false);
    await assert.rejects(x.child.request('arbitraryOwnerMethod', []), /PROCESS_METHOD/);
    await assert.rejects(x.child.command('unknown', {}), /OPERATION_FAILED/);
    await x.child.command('write', {});
    assert.deepEqual(x.calls.at(-1), ['devices.fixture.command', 17, false]);
    x.revoke();
    await assert.rejects(x.child.command('write', {}), /INACTIVE/);
    await x.child.stop();
    assert.equal(x.child.health().pid, null);
});

test('a blocked child event loop cannot block another module or parent and is killed', async t => {
    const x = await runtime(t);
    const other = await runtime(t);
    const hang = x.child.command('hang', {}).catch(issue => issue);
    let parentTicks = 0;
    const timer = setInterval(() => parentTicks++, 10);
    t.after(() => clearInterval(timer));
    assert.equal((await other.child.getStatus()).permitted, true);
    await until(() => x.failures.includes('EOS_MODULE_PROCESS_HEARTBEAT_TIMEOUT'));
    await x.child.stop();
    assert.ok(parentTicks > 20);
    assert.equal(x.child.health().pid, null);
    assert.match((await hang).code, /DISCONNECTED|TIMEOUT/);
    assert.equal((await other.child.getStatus()).permitted, true);
});

test('stop confirms OS exit even when the module shutdown blocks forever', async t => {
    const x = await runtime(t, { hangStop: true });
    const pid = x.child.health().pid;
    await x.child.stop();
    assert.equal(x.child.health().pid, null);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
});

test('protocol rejects oversized payload, expired dispatch and stale generation replies', async () => {
    const transport = new EventEmitter();
    transport.connected = true;
    const sent = [];
    transport.send = (value, cb) => { sent.push(value); cb(); };
    let dispatched = 0;
    const rpc = channel(transport, 7, () => { dispatched++; }, () => {}, 30);
    transport.emit('message', { type: 'request', generation: 7, id: 1, method: 'write', args: [], expiresAt: Date.now() - 100 });
    assert.equal(sent.at(-1).error, 'EOS_MODULE_PROCESS_REQUEST_EXPIRED');
    assert.equal(dispatched, 0);
    await assert.rejects(rpc.request('large', ['x'.repeat(MAX_BYTES)]), /MESSAGE_SIZE/);
    const pending = rpc.request('getStatus');
    const request = sent.at(-1);
    transport.emit('message', { type: 'reply', generation: 6, id: request.id, result: 'stale' });
    await assert.rejects(pending, /TIMEOUT/);
    rpc.close();
});

test('protocol caps concurrent unresolved requests and releases them on channel close', async () => {
    const transport = new EventEmitter();
    transport.connected = true;
    transport.send = (_value, cb) => cb();
    const rpc = channel(transport, 8, () => {}, () => {});
    const requests = Array.from({ length: 128 }, () => rpc.request('pending').catch(issue => issue));
    await assert.rejects(rpc.request('overflow'), /REQUEST_LIMIT/);
    rpc.close();
    assert.ok((await Promise.all(requests)).every(issue => issue.code === 'EOS_MODULE_PROCESS_DISCONNECTED'));
});

async function host(t) {
    const baseDir = await directory(t);
    const writes = [];
    const configs = { devices: { enabled: true }, eebus: { enabled: false }, backup: { enabled: false } };
    const owner = {
        namespace: 'eos-admin.0', instance: 0, config: { eosModules: Object.fromEntries(Object.entries(configs)
            .map(([id, config]) => [id, { v: 1, encrypted: JSON.stringify(config) }])) }, log: { warn() {} },
        eosLicenseService: { allowsEmbeddedModule: () => true }, eosOwnership: { canWrite: () => true },
        decrypt: value => value,
        async getObjectViewAsync() { return { rows: [] }; },
        async getForeignObjectAsync() { return null; },
        async getForeignStateAsync() { return null; },
        async setForeignObjectNotExistsAsync() {},
        async subscribeForeignObjectsAsync() {}, async subscribeForeignStatesAsync() {}, async unsubscribeForeignStatesAsync() {},
        async setForeignStateAsync(...args) { writes.push(args); },
    };
    const instance = new EosModuleHost(owner, { baseDir, dataDir: baseDir });
    t.after(() => instance.stop());
    await instance.start();
    return { instance, owner, writes };
}

test('real host production default restarts only the crashed module with a new generation and PID', async t => {
    const x = await host(t);
    const first = x.instance.entries.get('devices').module;
    const pid = first.health().pid;
    assert.ok(pid && pid !== process.pid);
    await assert.rejects(first.command('outside', {}), /STATE_SCOPE/);
    await first.command('crash', {}).catch(() => {});
    await until(async () => {
        await x.instance.reconcile();
        const status = await x.instance.status('devices');
        return status.active && status.details.process.pid !== pid;
    });
    const status = await x.instance.status('devices');
    assert.equal(status.details.process.restarts, 1);
    assert.ok(status.details.process.generation > 0);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    await assert.rejects(first.command('write', {}), /INACTIVE/);
    assert.equal(x.writes.length, 0);
});

test('parent drains an already accepted write before starting a replacement process', async t => {
    const x = await host(t);
    let release, entered;
    const enteredPromise = new Promise(resolve => { entered = resolve; });
    x.owner.setForeignStateAsync = async () => { entered(); await new Promise(resolve => { release = resolve; }); };
    const entry = x.instance.entries.get('devices');
    const old = entry.module;
    const write = old.command('write', {}).catch(() => {});
    await enteredPromise;
    old.kill('SIGKILL');
    await delay(100);
    assert.equal(entry.module, null);
    assert.equal(entry.processRestarts, 0);
    release(); await write;
    await until(async () => { await x.instance.reconcile(); return (await x.instance.status('devices')).active; });
    assert.equal(entry.processRestarts, 1);
});
