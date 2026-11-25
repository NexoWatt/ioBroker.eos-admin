'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const childProcess = require('node:child_process');
const baseDir = path.resolve(__dirname, '..');
const compiled = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-ui-operational-'));
for (const name of ['eosUiProcess', 'eosUiProcessWorker', 'eosUiProcessRpc', 'eosUiSecretCodec']) {
    const source = fs.readFileSync(path.join(baseDir, 'src/lib', name + '.ts'), 'utf8');
    fs.writeFileSync(path.join(compiled, name + '.js'), ts.transpileModule(source, { compilerOptions: {
        module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
    } }).outputText);
}
fs.symlinkSync(path.join(baseDir, 'node_modules'), path.join(compiled, 'node_modules'), 'dir');
const { createEosUiProcess } = require(path.join(compiled, 'eosUiProcess.js'));
const runtimePath = path.join(compiled, 'actual-runtime.cjs');
const dataDir = path.join(compiled, 'controller-data');
fs.mkdirSync(dataDir, { mode: 0o700 });
// The test has no installed js-controller. Replace only its filesystem locator;
// the UI, EMS, charging module, timers and owner IPC remain their real code.
fs.writeFileSync(runtimePath, `const id=require.resolve('@iobroker/adapter-core');
require.cache[id]={id,filename:id,loaded:true,exports:{getAbsoluteInstanceDataDir:()=>${JSON.stringify(dataDir)}}};
module.exports=require(${JSON.stringify(path.join(baseDir, 'ui/main.js'))});\n`);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (check()) return; await pause(10); }
    assert.fail('process condition did not settle');
}
test.after(() => fs.rmSync(compiled, { recursive: true, force: true }));

test('real hosted UI child starts the actual EMS and charging module through the IPC owner', { timeout: 45000 }, async t => {
    const objects = new Map(), states = new Map(), subscriptions = new Set(), logs = [];
    const stderr = [];
    const traffic = new Map();
    const originalFork = childProcess.fork;
    childProcess.fork = function(file, args, options) {
        const child = originalFork(file, args, { ...options, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
        child.stdout.on('data', data => stderr.push(`stdout:${data.toString()}`));
        child.stderr.on('data', data => stderr.push(data.toString()));
        child.on('message', message => { const key = `${message.kind}:${message.method || ''}`; traffic.set(key, (traffic.get(key) || 0) + 1); });
        child.on('exit', (code, signal) => stderr.push(`exit:${code}:${signal}`));
        return child;
    };
    t.after(() => { childProcess.fork = originalFork; });
    let runtime;
    const match = (pattern, id) => typeof pattern === 'string' && new RegExp('^' + pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(id);
    const select = (collection, pattern) => Object.fromEntries([...collection].filter(([id]) =>
        Array.isArray(pattern) ? pattern.includes(id) : match(pattern || '*', id)));
    const config = { eosUi: { enableChargingManagement: true,
        emsApps: { schemaVersion: 1, apps: { charging: { installed: true, enabled: true } } },
        history: { enabled: false }, chargingManagement: { enabled: true, wallboxes: [] },
        schedulerIntervalMs: 1000 }, port: 443, secure: true };
    const owner = {
        namespace: 'eos-admin.0', instance: 0, config,
        log: Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level, message => logs.push({ level, message })])),
        async getForeignObjectAsync(id) {
            if (id === 'system.config') return { _id: id, type: 'config', common: { language: 'de' }, native: { secret: 'synthetic-local-secret' } };
            if (id === 'system.adapter.eos-admin.0') return { _id: id, type: 'instance', common: { enabled: true }, native: config };
            return objects.get(id) || null;
        },
        async getForeignObjectsAsync(pattern) { return select(objects, pattern); },
        async getObjectViewAsync(_design, type, range = {}) { return { rows: [...objects].filter(([id, item]) => (!range.startkey || id >= range.startkey) && (!range.endkey || id <= range.endkey) && (type !== 'instance' || item.type === 'instance')).map(([id, value]) => ({ id, value })) }; },
        async getForeignStateAsync(id) { return states.get(id) || null; },
        async getForeignStatesAsync(pattern) { return select(states, pattern); },
        async setForeignObjectAsync(id, value) { objects.set(id, { ...value, _id: id }); },
        async setForeignObjectNotExistsAsync(id, value) { if (!objects.has(id)) objects.set(id, { ...value, _id: id }); },
        async extendForeignObjectAsync(id, value) { objects.set(id, { ...objects.get(id), ...value, _id: id }); },
        async delForeignObjectAsync(id) { objects.delete(id); },
        async delForeignStateAsync(id) { states.delete(id); },
        async setForeignStateAsync(id, value, ack) {
            const previous = states.get(id);
            const state = { ...(value && typeof value === 'object' ? value : { val: value, ack: ack === true }),
                ts: Date.now(), lc: Date.now(), from: 'system.adapter.eos-admin.0', q: 0 };
            states.set(id, state);
            if (runtime && [...subscriptions].some(pattern => match(pattern, id)) && (!previous || JSON.stringify(previous.val) !== JSON.stringify(state.val))) runtime.onStateChange(id, state);
        },
        async setForeignStateChangedAsync(id, value, ack) {
            const val = value && typeof value === 'object' ? value.val : value;
            if (!states.has(id) || JSON.stringify(states.get(id).val) !== JSON.stringify(val)) await owner.setForeignStateAsync(id, value, ack);
        },
        async subscribeForeignObjectsAsync() {}, async unsubscribeForeignObjectsAsync() {},
        async subscribeForeignStatesAsync(pattern) { subscriptions.add(pattern); },
        async unsubscribeForeignStatesAsync(pattern) { subscriptions.delete(pattern); },
        getUserID(user) { return Promise.resolve(user); },
        sendTo(_target, _command, _message, callback) { if (typeof callback === 'function') callback({ result: [], error: 'SYNTHETIC_ADAPTER_UNAVAILABLE' }); },
        eosMigration: { async saveUi(value) { config.eosUi = value; } },
        eosStateSubscriptions: { async acquireHost(pattern) { subscriptions.add(pattern); return async () => { subscriptions.delete(pattern); }; } },
    };
    const bridge = {
        canWrite: () => true, originAllowed: () => false, isListening: () => true,
        getLicense: () => ({ valid: true, coreEnabled: true, edition: 'home', limits: { chargePoints: 3, batteries: 2 }, features: ['energy'] }),
        resolveAccess: async () => ({ authenticated: false }), deviceEmsConfigChanged() {},
        deviceEmsPlan: async () => ({ statuses: [], config: {} }),
    };
    runtime = createEosUiProcess(owner, bridge, { baseDir, runtimePath, workerPath: path.join(compiled, 'eosUiProcessWorker.js'), restartDelayMs: 25 });
    t.after(() => runtime.stop());
    try { await runtime.start(); await runtime.startOperational(); }
    catch (error) { assert.fail(JSON.stringify({ error: error.message, status: runtime.status(), stderr, logs: logs.slice(-20), objects: objects.size, states: states.size, traffic: Object.fromEntries(traffic) })); }
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && !runtime.status().emsReady) await pause(50);
    const status = runtime.status();
    assert.equal(status.emsReady, true, JSON.stringify({ status, logs: logs.slice(-20), objects: objects.size, states: states.size }));
    assert.notEqual(status.process.pid, process.pid);
    assert.ok(objects.has('eos-admin.0.chargingManagement.control.status'), JSON.stringify({ reason: 'real charging module control contract missing', matching: [...objects.keys()].filter(id => /chargingManagement/.test(id)), logs: logs.slice(-20), apps: config.eosUi.emsApps, charging: config.eosUi.enableChargingManagement }));
    const heartbeat = states.get('eos-admin.0.ems.core.schedulerHeartbeatSequence')?.val;
    await pause(1200);
    assert.ok(states.get('eos-admin.0.ems.core.schedulerHeartbeatSequence')?.val > heartbeat, 'actual EMS scheduler continues through IPC');
    await runtime.stop();
    assert.equal(runtime.status().process.pid, null);
    assert.equal(subscriptions.size, 0);
});

const simpleRuntimePath = path.join(compiled, 'subscription-lease-fixture.cjs');
fs.writeFileSync(simpleRuntimePath, `exports.createHostedRuntime=(owner,bridge)=>({
 async start(){if(owner.config.eosUi.subscribeObject)await owner.subscribeForeignObjectsAsync('system.adapter.fixture.*');},
 async startOperational(){},async stop(){},status(){return {state:'ready',active:true,emsReady:true};},
 getHistoryBackupRequirement(){return {allowed:bridge.canWrite()};},handle(req,res,next){next();},
 async reserveDeviceProfileChange(){return ()=>{};},async reconcileDeviceEms(){return {};},
 onMessage(){return false;},onHostedEebusMessage(){return {};}
});\n`);
function simpleOwner(extra = {}) {
    return { namespace: 'eos-admin.0', instance: 0, config: { eosUi: {} },
        log: { info() {}, warn() {}, error() {}, debug() {} },
        async getForeignObjectAsync() { return { native: {} }; }, ...extra };
}
const simpleBridge = { canWrite: () => true, getLicense: () => ({ valid: false }),
    originAllowed: () => false, resolveAccess: async () => null, isListening: () => true };
function simpleProcess(owner) {
    return createEosUiProcess(owner, simpleBridge, { baseDir, runtimePath: simpleRuntimePath,
        workerPath: path.join(compiled, 'eosUiProcessWorker.js'), restartDelayMs: 25 });
}

test('late object-subscription acknowledgement is drained before stop can confirm', async t => {
    let entered = false, released = false, active = false, release;
    const pending = new Promise(resolve => { release = resolve; });
    const runtime = simpleProcess(simpleOwner({ config: { eosUi: { subscribeObject: true } },
        async subscribeForeignObjectsAsync() { entered = true; await pending; active = true; },
        async unsubscribeForeignObjectsAsync() { active = false; released = true; },
    }));
    t.after(async () => { release(); await runtime.stop(); });
    const startup = runtime.start().catch(() => {});
    await until(() => entered);
    let stopped = false;
    const stop = runtime.stop().then(() => { stopped = true; });
    await pause(100);
    assert.equal(stopped, false);
    assert.equal(released, false, 'unsubscribe cannot overtake its unfinished acquisition');
    assert.equal(runtime.status().active, false);
    assert.equal(runtime.status().emsReady, false);
    release(); await stop; await startup;
    assert.equal(active, false);
    assert.equal(released, true);
    assert.equal(runtime.status().process.pid, null);
});

test('real UI worker rejects expired and reordered authority leases', async t => {
    const originalFork = childProcess.fork;
    let send, frame, paused = false;
    childProcess.fork = function(file, args, options) {
        const child = originalFork(file, args, options);
        send = child.send.bind(child);
        child.send = function(message, ...rest) {
            if (message?.kind === 'event' && message.method === 'lease') {
                frame = structuredClone(message);
                if (paused) { const callback = rest.at(-1); if (typeof callback === 'function') callback(null); return true; }
            }
            return send(message, ...rest);
        };
        return child;
    };
    t.after(() => { childProcess.fork = originalFork; });
    const runtime = simpleProcess(simpleOwner());
    t.after(() => runtime.stop());
    await runtime.start(); await until(() => !!frame);
    assert.equal((await runtime.getHistoryBackupRequirement()).allowed, true);
    paused = true;
    const sequence = frame.args[0].sequence + 10;
    const emit = value => send({ ...frame, args: [{ ...frame.args[0], ...value }] });
    emit({ canWrite: false, sequence, expiresAt: Date.now() + 3000 });
    assert.equal((await runtime.getHistoryBackupRequirement()).allowed, false);
    emit({ canWrite: true, sequence: sequence - 1, expiresAt: Date.now() + 3000 });
    assert.equal((await runtime.getHistoryBackupRequirement()).allowed, false);
    emit({ canWrite: true, sequence: sequence + 1, expiresAt: Date.now() - 1 });
    assert.equal((await runtime.getHistoryBackupRequirement()).allowed, false);
    emit({ canWrite: true, sequence: sequence + 2, expiresAt: Date.now() + 3000 });
    assert.equal((await runtime.getHistoryBackupRequirement()).allowed, true);
});
