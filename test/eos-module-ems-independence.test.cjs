'use strict';
// Actual UI/EMS and production hosted modules in real OS children; the controller
// database and OCPP station are isolated fixtures. No physical device is connected.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { once } = require('node:events');
const ts = require('typescript');
const WebSocket = require('ws');
const { EosModuleHost } = require('../src/lib/eosModuleHost');
const baseDir = path.resolve(__dirname, '..');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout = 15000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await check()) return; await delay(25); }
    assert.fail('independent runtime did not reach the expected state');
}
async function unusedPort() {
    const server = net.createServer();
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    return port;
}
const matches = (pattern, id) => typeof pattern === 'string' && new RegExp('^' + pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(id);

test('UI/EMS crash, automatic restart and stop preserve Devices, EEBUS and OCPP PIDs plus the live OCPP session', { timeout: 60000 }, async t => {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'eos-924-independence-'));
    t.after(() => fsp.rm(root, { recursive: true, force: true }));
    for (const name of ['eosUiProcess', 'eosUiProcessWorker', 'eosUiProcessRpc', 'eosUiSecretCodec']) {
        const source = await fsp.readFile(path.join(baseDir, 'src/lib', name + '.ts'), 'utf8');
        await fsp.writeFile(path.join(root, name + '.js'), ts.transpileModule(source, { compilerOptions: {
            module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
        } }).outputText);
    }
    await fsp.symlink(path.join(baseDir, 'node_modules'), path.join(root, 'node_modules'), 'dir');
    const dataDir = path.join(root, 'iobroker-data/eos-admin.0');
    await fsp.mkdir(dataDir, { recursive: true, mode: 0o700 });
    const runtimePath = path.join(root, 'actual-ui.cjs');
    // This executor has no installed controller. Replace only its filesystem locator.
    await fsp.writeFile(runtimePath, `const id=require.resolve('@iobroker/adapter-core');
require.cache[id]={id,filename:id,loaded:true,exports:{getAbsoluteInstanceDataDir:()=>${JSON.stringify(dataDir)}}};
module.exports=require(${JSON.stringify(path.join(baseDir, 'ui/main.js'))});\n`);
    const port = await unusedPort();
    const moduleConfig = {
        devices: { enabled: true, devices: [] },
        eebus: { enabled: true, discoveryEnabled: false, shipServerEnabled: false, autoConnectEnabled: false, nexowattBridgeEnabled: false, commandDryRun: true },
        backup: { enabled: false },
        ocpp: { enabled: true, port, identityAllowlist: ['fixture-station'], callTimeoutSec: 5 },
    };
    const config = { eosModules: Object.fromEntries(Object.entries(moduleConfig).map(([id, value]) => [id, { v: 1, encrypted: JSON.stringify(value) }])),
        eosUi: { enableChargingManagement: true, history: { enabled: false },
            emsApps: { schemaVersion: 1, apps: { charging: { installed: true, enabled: true } } },
            chargingManagement: { enabled: true, wallboxes: [] }, schedulerIntervalMs: 1000 }, port: 443, secure: true };
    const objects = new Map(), states = new Map(), subscriptions = new Map(), logs = [];
    let runtime, host;
    const select = (collection, pattern) => Object.fromEntries([...collection].filter(([id]) => Array.isArray(pattern) ? pattern.includes(id) : matches(pattern || '*', id)));
    const subscribe = pattern => subscriptions.set(pattern, (subscriptions.get(pattern) || 0) + 1);
    const unsubscribe = pattern => { const count = subscriptions.get(pattern) || 0; if (count <= 1) subscriptions.delete(pattern); else subscriptions.set(pattern, count - 1); };
    const owner = {
        namespace: 'eos-admin.0', instance: 0, config, decrypt: value => value,
        log: Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level, message => logs.push({ level, message })])),
        eosLicenseService: { allowsEmbeddedModule: () => true }, eosOwnership: { canWrite: () => true },
        async getForeignObjectAsync(id) {
            if (id === 'system.config') return { _id: id, type: 'config', common: { language: 'de' }, native: { secret: 'synthetic-local-system-secret' } };
            if (id === 'system.adapter.eos-admin.0') return { _id: id, type: 'instance', common: { enabled: true }, native: config };
            return objects.get(id) || null;
        },
        async getForeignObjectsAsync(pattern) { return select(objects, pattern); },
        async getObjectViewAsync(_design, type, range = {}) { return { rows: [...objects].filter(([id, object]) =>
            (!range.startkey || id >= range.startkey) && (!range.endkey || id <= range.endkey) && (type !== 'instance' || object.type === 'instance'))
            .map(([id, value]) => ({ id, value })) }; },
        async getForeignStateAsync(id) { return states.get(id) || null; },
        async getForeignStatesAsync(pattern) { return select(states, pattern); },
        async setForeignObjectAsync(id, value) { objects.set(id, { ...value, _id: id }); },
        async setForeignObjectNotExistsAsync(id, value) { if (!objects.has(id)) objects.set(id, { ...value, _id: id }); },
        async extendForeignObjectAsync(id, value) { objects.set(id, { ...objects.get(id), ...value, _id: id }); },
        async delForeignObjectAsync(id) { objects.delete(id); }, async delForeignStateAsync(id) { states.delete(id); },
        async setForeignStateAsync(id, value, ack) {
            const previous = states.get(id);
            const state = { ...(value && typeof value === 'object' ? value : { val: value, ack: ack === true }),
                ts: Date.now(), lc: Date.now(), from: 'system.adapter.eos-admin.0', q: 0 };
            states.set(id, state);
            if (!previous || JSON.stringify(previous.val) !== JSON.stringify(state.val)) {
                queueMicrotask(() => { host?.onStateChange(id, state); runtime?.onStateChange(id, state); });
            }
        },
        async setForeignStateChangedAsync(id, value, ack) {
            const val = value && typeof value === 'object' ? value.val : value;
            if (!states.has(id) || JSON.stringify(states.get(id).val) !== JSON.stringify(val)) await owner.setForeignStateAsync(id, value, ack);
        },
        async subscribeForeignStatesAsync(pattern) { subscribe(pattern); }, async unsubscribeForeignStatesAsync(pattern) { unsubscribe(pattern); },
        async subscribeForeignObjectsAsync() {}, async unsubscribeForeignObjectsAsync() {},
        getUserID(user) { return Promise.resolve(user); },
        sendTo(_target, _command, _message, callback) { if (typeof callback === 'function') callback({ result: [], error: 'SYNTHETIC_ADAPTER_UNAVAILABLE' }); },
        eosMigration: { async saveUi(value) { config.eosUi = value; } },
        eosStateSubscriptions: { async acquireHost(pattern) { subscribe(pattern); return async () => { unsubscribe(pattern); }; } },
    };
    host = new EosModuleHost(owner, { baseDir, dataDir: path.join(dataDir, 'modules'), eosDataDir: dataDir, installationDir: root });
    t.after(() => host.stop());
    const { createEosUiProcess } = require(path.join(root, 'eosUiProcess.js'));
    runtime = createEosUiProcess(owner, {
        canWrite: () => true, isListening: () => true, originAllowed: () => false,
        getLicense: () => ({ valid: true, coreEnabled: true, edition: 'home', limits: { chargePoints: 3, batteries: 2 }, features: ['energy'] }),
        resolveAccess: async () => ({ authenticated: false }), deviceEmsConfigChanged() {}, deviceEmsPlan: async () => ({ statuses: [], config: {} }),
    }, { baseDir, runtimePath, workerPath: path.join(root, 'eosUiProcessWorker.js'), restartDelayMs: 25 });
    owner.eosHostedRuntime = runtime;
    host.bindDeviceEms(devices => runtime.reconcileDeviceEms(devices), change => runtime.reserveDeviceProfileChange(change));
    host.bindBridge(message => runtime.onHostedEebusMessage(message));
    t.after(() => runtime.stop());
    await host.start();
    const identities = {};
    for (const id of ['devices', 'eebus', 'ocpp']) {
        const entry = host.entries.get(id);
        assert.equal(entry.started, true, JSON.stringify({ id, reason: entry.reason, logs: logs.slice(-15) }));
        identities[id] = entry.module.health();
        assert.ok(identities[id].pid > 0);
    }
    assert.equal(new Set(Object.values(identities).map(value => value.pid)).size, 3);
    const socket = new WebSocket(`ws://127.0.0.1:${port}/fixture-station`, 'ocpp1.6');
    t.after(() => socket.terminate());
    await once(socket, 'open');
    let nextCall = 0, closed = false;
    const pending = new Map();
    socket.on('close', () => { closed = true; });
    socket.on('message', raw => {
        const value = JSON.parse(raw.toString());
        if (value[0] === 2) {
            const response = value[2] === 'GetConfiguration' ? { configurationKey: [], unknownKey: [] } : { status: 'Accepted' };
            socket.send(JSON.stringify([3, value[1], response]));
        } else if (pending.has(value[1])) pending.get(value[1])(value);
    });
    const call = (action, payload) => new Promise((resolve, reject) => {
        const id = 'independence-' + ++nextCall;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error('OCPP fixture response timeout')); }, 5000);
        pending.set(id, value => { clearTimeout(timer); pending.delete(id); if (value[0] === 3) resolve(value[2]); else reject(new Error(JSON.stringify(value))); });
        socket.send(JSON.stringify([2, id, action, payload]));
    });
    assert.equal((await call('BootNotification', { chargePointVendor: 'Fixture', chargePointModel: 'NoHardware' })).status, 'Accepted');
    await runtime.start(); await runtime.startOperational();
    await until(() => runtime.status().emsReady);
    const first = runtime.status().process;
    assert.ok(!Object.values(identities).some(value => value.pid === first.pid));
    process.kill(first.pid, 'SIGKILL');
    await until(() => runtime.status().process.pid && runtime.status().process.pid !== first.pid && runtime.status().emsReady);
    const second = runtime.status().process;
    assert.ok(second.generation > first.generation);
    assert.equal(closed, false, 'UI crash cannot close the independent OCPP connection');
    assert.equal(typeof (await call('Heartbeat', {})).currentTime, 'string');
    await runtime.stop();
    assert.equal(runtime.status().process.pid, null);
    await delay(1200);
    assert.equal(closed, false, 'UI/EMS stop cannot close the independent OCPP connection');
    assert.equal(typeof (await call('Heartbeat', {})).currentTime, 'string');
    for (const [id, firstHealth] of Object.entries(identities)) {
        const entry = host.entries.get(id);
        const current = entry.module.health();
        assert.equal(current.pid, firstHealth.pid, `${id} PID must remain unchanged`);
        assert.equal(current.generation, firstHealth.generation);
        assert.equal(current.state, 'running');
        assert.equal(host.canOperate(id, entry.generation), true, `${id} operation cannot depend on EMS readiness`);
        process.kill(current.pid, 0);
    }
    await host.stop();
    await until(() => closed, 5000);
    for (const value of Object.values(identities)) assert.throws(() => process.kill(value.pid, 0), { code: 'ESRCH' });
    assert.equal(fs.existsSync(dataDir), true);
});
