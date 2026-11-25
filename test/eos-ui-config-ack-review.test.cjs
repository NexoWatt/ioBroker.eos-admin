'use strict';
// Independent negative review of the actual Worker/RPC/Parent. The UI test
// runtime calls the real owner facade; database latency/IPC delivery are fixtures.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const { EventEmitter } = require('node:events');
const ts = require('typescript');
const baseDir = path.resolve(__dirname, '..');
const compiled = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-config-ack-independent-'));
for (const name of ['eosUiProcess', 'eosUiProcessWorker', 'eosUiProcessRpc', 'eosUiSecretCodec']) {
    fs.writeFileSync(path.join(compiled, `${name}.js`), ts.transpileModule(
        fs.readFileSync(path.join(baseDir, 'src/lib', `${name}.ts`), 'utf8'), {
            compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
        }).outputText);
}
const runtimePath = path.join(compiled, 'review-runtime.cjs');
fs.writeFileSync(runtimePath, `exports.createHostedRuntime=(owner,bridge)=>({
    async start(){},async startOperational(){},async stop(){},
    status(){return {state:'ready',active:true,emsReady:true,canWrite:bridge.canWrite()};},
    handle(_req,_res,next){next();},getHistoryBackupRequirement(){return {};},
    async reconcileDeviceEms(probes){return Promise.all(probes.map(async probe=>{
        const begin=Date.now();
        try{if(probe.method==='saveUi')await owner.eosMigration.saveUi(...probe.args);
            else await owner[probe.method](...probe.args);
            return {key:probe.key,ok:true,elapsed:Date.now()-begin};}
        catch(error){return {key:probe.key,ok:false,error:error.message,elapsed:Date.now()-begin};}
    }));}
});\n`);
const { createEosUiProcess } = require(path.join(compiled, 'eosUiProcess.js'));
const { UiProcessRpc } = require(path.join(compiled, 'eosUiProcessRpc.js'));
test.after(() => fs.rmSync(compiled, { recursive: true, force: true }));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 6000) {
    const deadline = Date.now() + timeout;
    while (!check()) { assert.ok(Date.now() < deadline, label); await delay(20); }
}
const stateProbe = (key, id, value = { val: '{"fixture":true}', ack: true }, method = 'setForeignStateAsync') => ({ key, method, args: [id, value] });

async function fixture(t, { migration, delayMs = 2300, holdId } = {}) {
    const accepted = [], completed = [], frames = [];
    let held;
    const originalFork = childProcess.fork;
    childProcess.fork = function(file, args, options) {
        const child = originalFork(file, args, options);
        if (file !== path.join(compiled, 'eosUiProcessWorker.js')) return child;
        const originalEmit = child.emit;
        child.emit = function(event, message, ...rest) {
            if (event === 'message' && message?.kind === 'call' && message.method?.startsWith('owner.')) {
                frames.push({ message: structuredClone(message), observedAt: Date.now() });
                if (message.args?.[0] === holdId && !held) {
                    held = { message, release: () => originalEmit.call(child, 'message', message, ...rest) };
                    return true;
                }
            }
            return originalEmit.call(child, event, message, ...rest);
        };
        return child;
    };
    const write = method => async (...args) => {
        accepted.push({ method, args }); await delay(delayMs); completed.push({ method, args });
        return true;
    };
    const owner = {
        namespace: 'eos-admin.0', instance: 0,
        config: { eosUi: {}, ...(migration ? { eosUiMigration: migration } : {}) },
        log: { info() {}, warn() {}, error() {}, debug() {} },
        async getForeignObjectAsync() { return { native: {} }; },
        setForeignStateAsync: write('setForeignStateAsync'),
        setForeignStateChangedAsync: write('setForeignStateChangedAsync'),
        setForeignObjectAsync: write('setForeignObjectAsync'),
        setForeignObjectNotExistsAsync: write('setForeignObjectNotExistsAsync'),
        extendForeignObjectAsync: write('extendForeignObjectAsync'),
        delForeignStateAsync: write('delForeignStateAsync'),
        eosMigration: { saveUi: write('saveUi') },
    };
    const bridge = { canWrite: () => true, originAllowed: () => false, isListening: () => true,
        getLicense: () => ({ valid: true, coreEnabled: true }), resolveAccess: async () => null };
    const runtime = createEosUiProcess(owner, bridge, { baseDir, runtimePath,
        workerPath: path.join(compiled, 'eosUiProcessWorker.js'), restartDelayMs: 25 });
    t.after(async () => { held?.release(); await runtime.stop(); childProcess.fork = originalFork; });
    await runtime.start();
    return { runtime, accepted, completed, frames, get held() { return held; } };
}

test('only exact configuration IDs/methods and acknowledged string values receive the longer reply window', { timeout: 15000 }, async t => {
    const f = await fixture(t);
    const id = 'eos-admin.0.installer.configJson';
    const acl = { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600, state: 0x600 };
    const positive = [
        stateProbe('installer', id),
        stateProbe('simulation', 'eos-admin.0.simulation.backupConfigJson'),
        stateProbe('backup', '0_userdata.0.nexowattVis.backupJson'),
        stateProbe('backupPrevious', '0_userdata.0.nexowattVis.backupJsonPrev', undefined, 'setForeignStateChangedAsync'),
        { key: 'createAcl', method: 'setForeignObjectAsync', args: [id, { type: 'state', common: { type: 'string', role: 'json', read: false }, native: {}, acl }] },
        { key: 'createAclIfAbsent', method: 'setForeignObjectNotExistsAsync', args: [id, { type: 'state', common: { type: 'string', read: false }, native: {}, acl }] },
        { key: 'extendAcl', method: 'extendForeignObjectAsync', args: [id, { common: { read: false }, acl }] },
        { key: 'saveUi', method: 'saveUi', args: [{ configured: true }] },
    ];
    const negative = [
        stateProbe('foreignInstance', 'eos-admin.1.installer.configJson'),
        stateProbe('suffix', `${id}.command`),
        stateProbe('prefix', `other.${id}`),
        stateProbe('case', 'eos-admin.0.installer.configJSON'),
        stateProbe('unacknowledged', id, { val: '{}', ack: false }),
        stateProbe('numeric', id, { val: 1200, ack: true }),
        stateProbe('regularCommand', 'fixture.0.control.chargeLimit', { val: 1200, ack: false }),
        stateProbe('regularAcknowledgedTelemetry', 'fixture.0.power', { val: 1200, ack: true }),
        stateProbe('userdataSuffix', '0_userdata.0.nexowattVis.backupJson.command'),
        { key: 'foreignAcl', method: 'extendForeignObjectAsync', args: ['eos-admin.1.installer.configJson', { common: { read: false }, acl }] },
        { key: 'deleteConfig', method: 'delForeignStateAsync', args: [id] },
    ];
    const pid = f.runtime.status().process.pid;
    const result = await f.runtime.reconcileDeviceEms([...positive, ...negative]);
    for (const probe of positive) assert.equal(result.find(row => row.key === probe.key).ok, true, probe.key);
    for (const probe of negative) {
        const row = result.find(item => item.key === probe.key);
        assert.equal(row.ok, false, probe.key); assert.equal(row.error, 'EOS_UI_PROCESS_TIMEOUT', probe.key);
    }
    assert.equal(f.accepted.length, positive.length + negative.length);
    await until(() => f.completed.length === f.accepted.length, 'all already admitted fixture writes settle');
    assert.equal(f.runtime.status().process.pid, pid, 'definite short-window failures do not alter the established non-config contract');
    const mutationFrames = f.frames.filter(row => row.message.method !== 'owner.getForeignObjectAsync');
    assert.equal(mutationFrames.length, positive.length + negative.length);
    for (const { message, observedAt } of mutationFrames) {
        assert.ok(message.deadline > observedAt && message.deadline - observedAt <= 2100,
            `reply extension must not extend admission: ${message.method}`);
    }
});

test('preserved UI namespace grants the longer ACK only to its bound instance', { timeout: 15000 }, async t => {
    const f = await fixture(t, { migration: { preserveNamespace: true, source: 'nexowatt-ui.3' } });
    const probes = [
        stateProbe('bound', 'nexowatt-ui.3.installer.configJson'),
        stateProbe('boundSimulation', 'nexowatt-ui.3.simulation.backupConfigJson'),
        stateProbe('ownRootNotEffective', 'eos-admin.0.installer.configJson'),
        stateProbe('differentLegacy', 'nexowatt-ui.4.installer.configJson'),
        stateProbe('similarLegacy', 'nexowatt-ui.30.installer.configJson'),
    ];
    const result = await f.runtime.reconcileDeviceEms(probes);
    for (const row of result) {
        if (['bound', 'boundSimulation'].includes(row.key)) assert.equal(row.ok, true, row.key);
        else { assert.equal(row.ok, false, row.key); assert.equal(row.error, 'EOS_UI_PROCESS_TIMEOUT', row.key); }
    }
    await until(() => f.completed.length === probes.length, 'preserved-namespace fixture writes settled');
});

test('unvalidated namespace text cannot widen the protected configuration ID set', { timeout: 15000 }, async t => {
    const f = await fixture(t, { migration: { preserveNamespace: true, source: 'fixture.0' } });
    const result = await f.runtime.reconcileDeviceEms([
        stateProbe('ownRoot', 'eos-admin.0.installer.configJson'),
        stateProbe('unvalidatedSource', 'fixture.0.installer.configJson'),
    ]);
    assert.equal(result.find(row => row.key === 'ownRoot').ok, true);
    assert.deepEqual(result.filter(row => row.key === 'unvalidatedSource').map(row => [row.ok, row.error]), [[false, 'EOS_UI_PROCESS_TIMEOUT']]);
    await until(() => f.completed.length === 2, 'invalid-namespace fixture writes settled');
});

test('configuration IPC delivered after two seconds is explicitly expired before any database mutation', { timeout: 15000 }, async t => {
    const id = 'eos-admin.0.installer.configJson';
    const f = await fixture(t, { holdId: id, delayMs: 0 });
    const pid = f.runtime.status().process.pid;
    const saving = f.runtime.reconcileDeviceEms([stateProbe('stale', id)]);
    await until(() => !!f.held, 'configuration IPC captured before parent dispatch');
    const admissionRemaining = f.held.message.deadline - Date.now();
    assert.ok(admissionRemaining > 0 && admissionRemaining <= 2100);
    await delay(admissionRemaining + 120);
    f.held.release();
    const result = await saving;
    assert.equal(result[0].ok, false); assert.equal(result[0].error, 'EOS_UI_PROCESS_CALL_EXPIRED');
    assert.deepEqual(f.accepted, []); assert.deepEqual(f.completed, []);
    assert.equal(f.runtime.status().process.pid, pid, 'known non-admission is not an unknown database commit');
});

test('late or foreign-generation RPC results cannot satisfy a newer pending call', async () => {
    const endpoint = new EventEmitter(), sent = [], faults = [];
    endpoint.connected = true;
    endpoint.send = (frame, callback) => { sent.push(frame); callback(null); return true; };
    const generation = 'a'.repeat(48);
    const peer = new UiProcessRpc(endpoint, generation, () => undefined, () => undefined, code => faults.push(code));
    try {
        const old = peer.call('owner.setForeignStateAsync', ['old'], 40, 5);
        const rejected = assert.rejects(old, { message: 'EOS_UI_PROCESS_TIMEOUT' });
        await delay(65); await rejected;
        let settled = false;
        const current = peer.call('owner.setForeignStateAsync', ['current'], 500, 5).then(value => { settled = true; return value; });
        endpoint.emit('message', { v: 1, generation, kind: 'result', id: sent[0].id, value: 'late-old-ACK' });
        endpoint.emit('message', { v: 1, generation: 'b'.repeat(48), kind: 'result', id: sent[1].id, value: 'foreign-generation-ACK' });
        await delay(20); assert.equal(settled, false);
        endpoint.emit('message', { v: 1, generation, kind: 'result', id: sent[1].id, value: 'current-ACK' });
        assert.equal(await current, 'current-ACK'); assert.deepEqual(faults, []);
    } finally { peer.close(); }
});
