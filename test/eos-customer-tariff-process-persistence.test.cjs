'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const http = require('node:http');
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
require('node:https').request=()=>{throw Object.assign(new Error('TEST_NETWORK_DISABLED'),{code:'TEST_NETWORK_DISABLED'});};
global.fetch=async()=>{throw new Error('TEST_NETWORK_DISABLED');};
module.exports=require(${JSON.stringify(path.join(baseDir, 'ui/main.js'))});\n`);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, timeout = 5000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (check()) return; await pause(10); }
    assert.fail('process condition did not settle');
}
test.after(() => fs.rmSync(compiled, { recursive: true, force: true }));

// Actual UI runtime lifecycle and its HTTP route run in a real child. Only the
// controller data, session authority and instance-data locator are fixtures.
const route = '/api/customer/tariff-provider';
const secretCanary = 'synthetic-tibber-persistence-token';
for (const preserved of [false, true]) test(`Tibber save reaches parent state and survives UI plus whole owner restart (${preserved ? 'preserved' : 'native'} namespace)`, { timeout: 90000 }, async t => {
    let objects = new Map(), states = new Map();
    const subscriptions = new Set(), logs = [];
    const stateId = `${preserved ? 'nexowatt-ui.3' : 'eos-admin.0'}.installer.configJson`;
    let runtime, owner, holdCommit = null, holdRead = null, pendingStart = null, rejectConfigRead = false, origin = '';
    const match = (pattern, id) => typeof pattern === 'string' && new RegExp('^' + pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$').test(id);
    const select = (collection, pattern) => Object.fromEntries([...collection].filter(([id]) =>
        Array.isArray(pattern) ? pattern.includes(id) : match(pattern || '*', id)));
    const config = { eosUi: { enableChargingManagement: false,
        emsApps: { schemaVersion: 1, apps: { charging: { installed: false, enabled: false }, tariff: { installed: false, enabled: false } } },
        history: { enabled: false }, chargingManagement: { enabled: false, wallboxes: [] },
        tariffProvider: { enabled: false, providerId: 'manual-dp', credentials: {} },
        weather: { enabled: false },
        schedulerIntervalMs: 1000 }, port: 443, secure: true };
    if (preserved) config.eosUiMigration = { preserveNamespace: true, source: 'nexowatt-ui.3' };
    const makeOwner = () => ({
        namespace: 'eos-admin.0', instance: 0, config: structuredClone(config),
        log: Object.fromEntries(['info', 'warn', 'error', 'debug'].map(level => [level, message => logs.push({ level, message })])),
        async getForeignObjectAsync(id) {
            if (id === 'system.config') return { _id: id, type: 'config', common: { language: 'de' }, native: { secret: 'synthetic-local-secret' } };
            if (id === 'system.adapter.eos-admin.0') return { _id: id, type: 'instance', common: { enabled: true }, native: owner.config };
            return objects.get(id) || null;
        },
        async getForeignObjectsAsync(pattern) { return select(objects, pattern); },
        async getObjectViewAsync(_design, type, range = {}) { return { rows: [...objects].filter(([id, item]) => (!range.startkey || id >= range.startkey) && (!range.endkey || id <= range.endkey) && (type !== 'instance' || item.type === 'instance')).map(([id, value]) => ({ id, value })) }; },
        async getForeignStateAsync(id) { if (id === stateId && holdRead) { holdRead.entered = true; await holdRead.promise; } if (id === stateId && rejectConfigRead) throw new Error('SYNTHETIC_CONFIG_READ_FAILED'); return states.get(id) || null; },
        async getForeignStatesAsync(pattern) { return select(states, pattern); },
        async setForeignObjectAsync(id, value) { objects.set(id, { ...value, _id: id }); },
        async setForeignObjectNotExistsAsync(id, value) { if (!objects.has(id)) objects.set(id, { ...value, _id: id }); },
        async extendForeignObjectAsync(id, value) { objects.set(id, { ...objects.get(id), ...value, _id: id }); },
        async delForeignObjectAsync(id) { objects.delete(id); },
        async delForeignStateAsync(id) { states.delete(id); },
        async setForeignStateAsync(id, value, ack) {
            if (id === stateId && holdCommit) { holdCommit.entered = true; await holdCommit.promise; }
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
        eosMigration: { async saveUi(value) { owner.config.eosUi = value; } },
        eosStateSubscriptions: { async acquireHost(pattern) { subscriptions.add(pattern); return async () => { subscriptions.delete(pattern); }; } },
    });

    owner = makeOwner();
    const csrf = 'fixture-tariff-csrf-'.repeat(3);
    const bridge = {
        canWrite: () => true, originAllowed: req => !req.headers.origin || req.headers.origin === origin, isListening: () => true,
        getLicense: () => ({ valid: true, coreEnabled: true, edition: 'home', limits: { chargePoints: 3, batteries: 2 }, features: ['energy','wallet','smartHome'] }),
        resolveAccess: async req => req.headers.cookie === 'fixture=tariff' ? ({ authenticated: true, role: 'admin', user: 'system.user.admin',
            capabilities: ['*'], groups: [], credentialKey: csrf, csrfToken: csrf, mustChangePassword: false }) : null,
        deviceEmsConfigChanged() {}, deviceEmsPlan: async () => ({ statuses: [], config: {} }),
    };
    const create = () => createEosUiProcess(owner, bridge, { baseDir, runtimePath, workerPath: path.join(compiled, 'eosUiProcessWorker.js'), restartDelayMs: 25 });
    const server = http.createServer((req, res) => runtime.handle(req, res, () => { res.statusCode = 404; res.end(); }));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => { holdCommit?.release(); holdRead?.release(); await pendingStart?.catch(() => {}); await runtime?.stop(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const start = async () => {
        runtime = create(); await runtime.start(); await runtime.startOperational();
        await until(() => runtime.status().emsReady === true, 20000);
        assert.ok(runtime.status().process.pid > 0); assert.notEqual(runtime.status().process.pid, process.pid);
    };
    const request = async (method = 'GET', body) => {
        const response = await fetch(origin + route, { method, headers: { Origin: origin, Cookie: 'fixture=tariff', 'X-NW-CSRF': csrf,
            ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        const text = await response.text(); assert.equal(text.includes(secretCanary), false, 'HTTP response must not contain credentials');
        const value = JSON.parse(text); return { status: response.status, value };
    };
    await start();
    const before = await request(); assert.equal(before.status, 200);
    let release; const promise = new Promise(resolve => { release = resolve; });
    holdCommit = { promise, release, entered: false };
    let answered = false;
    const saving = request('PUT', { expectedRevision: before.value.revision, config: {
        enabled: true, providerId: 'tibber', country: 'DE', homeId: 'synthetic-home', credentials: { accessToken: secretCanary },
    } }).then(result => { answered = true; return result; });
    await until(() => holdCommit.entered, 10000); await pause(50);
    assert.equal(answered, false, '200 cannot precede the controller state commit');
    holdCommit.release(); const saved = await saving; holdCommit = null;
    assert.equal(saved.status, 200, JSON.stringify({ status: saved.status, code: saved.value.error }));
    assert.equal(saved.value.config.providerId, 'tibber'); assert.equal(saved.value.config.enabled, true);
    const stored = JSON.parse(states.get(stateId).val);
    assert.equal(stored.tariffProvider.providerId, 'tibber'); assert.equal(stored.tariffProvider.credentials.accessToken, secretCanary);
    assert.equal(objects.get(stateId).acl.state, 0x600);
    const afterSave = await request(); assert.equal(afterSave.value.config.providerId, 'tibber');
    const oldPid = runtime.status().process.pid;
    await runtime.pause(); await runtime.resume(); await until(() => runtime.status().emsReady === true, 20000);
    assert.notEqual(runtime.status().process.pid, oldPid);
    const afterChild = await request(); assert.equal(afterChild.value.config.providerId, 'tibber'); assert.equal(afterChild.value.config.enabled, true);
    await runtime.stop();
    // Reconstruct owner and both databases from serialized controller contents.
    // Neither the old runtime object nor its in-memory native configuration is reused.
    states = new Map(JSON.parse(JSON.stringify([...states]))); objects = new Map(JSON.parse(JSON.stringify([...objects])));
    owner = makeOwner();
    assert.equal(owner.config.eosUi.tariffProvider.providerId, 'manual-dp');
    let releaseRead; const pendingRead = new Promise(resolve => { releaseRead = resolve; });
    holdRead = { promise: pendingRead, release: releaseRead, entered: false };
    const starting = pendingStart = start();
    await until(() => holdRead.entered, 10000);
    const duringStartup = await request();
    assert.equal(duringStartup.status, 503, 'unhydrated native defaults must never be confirmed as the saved tariff');
    assert.equal(duringStartup.value.error, 'EOS_TARIFF_CONFIG_LOADING');
    assert.equal(duringStartup.value.config, undefined);
    const earlySave = await request('PUT', { expectedRevision: afterChild.value.revision, config: { enabled: false, providerId: 'manual-dp' } });
    assert.equal(earlySave.status, 503, 'a startup PUT must not overwrite the saved provider from native defaults');
    assert.equal(JSON.parse(states.get(stateId).val).tariffProvider.providerId, 'tibber');
    holdRead.release(); holdRead = null; await starting;
    const afterOwner = await request(); assert.equal(afterOwner.status, 200);
    assert.equal(afterOwner.value.config.providerId, 'tibber'); assert.equal(afterOwner.value.config.enabled, true);
    assert.equal(afterOwner.value.credentialsPresent.accessToken, true);
    assert.equal(JSON.parse(states.get(stateId).val).tariffProvider.credentials.accessToken, secretCanary);
    // A subsequent failed controller read is not permission to use defaults.
    const confirmedState = states.get(stateId).val;
    await runtime.stop(); owner = makeOwner(); rejectConfigRead = true;
    runtime = create(); await runtime.start(); await runtime.startOperational();
    await until(() => runtime.status().state === 'degraded', 10000);
    const failedStartup = await request();
    assert.equal(failedStartup.status, 503); assert.equal(failedStartup.value.config, undefined);
    assert.equal(states.get(stateId).val, confirmedState, 'failed hydration cannot alter the persisted provider');
    assert.equal(JSON.stringify(logs).includes(secretCanary), false, 'provider secret must not reach logs');
});
