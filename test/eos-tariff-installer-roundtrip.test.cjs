'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const http = require('node:http');
const express = require('express');
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
for (const preserved of [false, true]) test(`Tibber masks survive unrelated Installer edits and a disk-backed owner restart (${preserved ? 'preserved' : 'native'} namespace)`, { timeout: 90000 }, async t => {
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
    // Production mounts the proxy on Express; its error responses use that contract too.
    const app = express();
    app.use((req, res) => runtime.handle(req, res, () => { res.statusCode = 404; res.end(); }));
    const server = http.createServer(app);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => { holdCommit?.release(); holdRead?.release(); await pendingStart?.catch(() => {}); await runtime?.stop(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const start = async () => {
        runtime = create(); await runtime.start();
        const cold = await request('GET', undefined, '/api/installer/config');
        assert.equal(cold.status, 503); assert.equal(cold.value.config, undefined); assert.equal(cold.value.configurationRevision, undefined);
        const coldSave = await request('POST', { patch: { tariffProvider: { providerId: 'manual-dp' } } }, '/api/installer/config');
        assert.equal(coldSave.status, 503);
        await runtime.startOperational();
        await until(() => runtime.status().emsReady === true, 20000);
        assert.ok(runtime.status().process.pid > 0); assert.notEqual(runtime.status().process.pid, process.pid);
    };
    const request = async (method = 'GET', body, requestedRoute = route) => {
        const response = await fetch(origin + requestedRoute, { method, headers: { Origin: origin, Cookie: 'fixture=tariff', 'X-NW-CSRF': csrf,
            ...(body ? { 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        const text = await response.text();
        for (const secret of [secretCanary, 'synthetic-header-auth', 'synthetic-request-body']) assert.equal(text.includes(secret), false, 'HTTP response must not contain credentials');
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
    const installer = await request('GET', undefined, '/api/installer/config');
    assert.equal(installer.status, 200);
    assert.equal(installer.value.config.tariffProvider.providerId, 'tibber');
    assert.equal(installer.value.config.tariffProvider.credentials.accessToken, '__KEEP__');
    // A generic AppCenter save carries the masked tariff while editing another field.
    const unrelated = await request('POST', { expectedConfigurationRevision: installer.value.configurationRevision,
        patch: { tariffProvider: installer.value.config.tariffProvider, settings: { flowInvertGrid: true } },
        restartEms: false }, '/api/installer/config');
    assert.equal(unrelated.status, 200, JSON.stringify({ status: unrelated.status, code: unrelated.value.error }));
    assert.equal(JSON.parse(states.get(stateId).val).tariffProvider.credentials.accessToken, secretCanary);

    const oldPid = runtime.status().process.pid;
    await runtime.pause(); await runtime.resume(); await until(() => runtime.status().emsReady === true, 20000);
    assert.notEqual(runtime.status().process.pid, oldPid);
    const afterChild = await request(); assert.equal(afterChild.value.config.providerId, 'tibber'); assert.equal(afterChild.value.config.enabled, true);
    await runtime.stop();
    // Reconstruct owner and both databases from serialized controller contents.
    // Neither the old runtime object nor its in-memory native configuration is reused.
    const stateDisk = path.join(compiled, 'states-' + preserved + '.json');
    const objectDisk = path.join(compiled, 'objects-' + preserved + '.json');
    fs.writeFileSync(stateDisk, JSON.stringify([...states])); fs.writeFileSync(objectDisk, JSON.stringify([...objects]));
    states.clear(); objects.clear(); owner = null; runtime = null;
    states = new Map(JSON.parse(fs.readFileSync(stateDisk, 'utf8'))); objects = new Map(JSON.parse(fs.readFileSync(objectDisk, 'utf8')));
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
    const pendingInstaller = await request('GET', undefined, '/api/installer/config');
    assert.equal(pendingInstaller.status, 503); assert.equal(pendingInstaller.value.error, 'EOS_INSTALLER_CONFIG_LOADING');
    assert.equal(pendingInstaller.value.config, undefined); assert.equal(pendingInstaller.value.configurationRevision, undefined);
    const pendingInstallerSave = await request('POST', { patch: { tariffProvider: { providerId: 'manual-dp' } } }, '/api/installer/config');
    assert.equal(pendingInstallerSave.status, 503);

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
    const failedInstaller = await request('GET', undefined, '/api/installer/config');
    assert.equal(failedInstaller.status, 503); assert.equal(failedInstaller.value.error, 'EOS_INSTALLER_CONFIG_UNAVAILABLE');
    assert.equal(failedInstaller.value.config, undefined); assert.equal(failedInstaller.value.configurationRevision, undefined);
    const failedInstallerSave = await request('POST', { patch: { tariffProvider: { providerId: 'manual-dp' } } }, '/api/installer/config');
    assert.equal(failedInstallerSave.status, 503);

    assert.equal(states.get(stateId).val, confirmedState, 'failed hydration cannot alter the persisted provider');
    assert.equal(JSON.stringify(logs).includes(secretCanary), false, 'provider secret must not reach logs');
});

// Recipient and explicit-delete scenarios are independent HTTP boundary tests.
// Give each a fresh confirmed config instead of repeatedly reinitializing a real
// child within one second: that artificial burst exercises the unrelated IPC
// flood limiter. The uninterrupted child/disk/owner restart test remains above.
async function installerFixture(t, tariffProvider) {
    const { createHarness } = require('../ui/test/unified/http-harness.cjs');
    const h = await createHarness();
    t.after(async () => { await new Promise(resolve => h.adapter.onUnload(resolve)); await h.close(); });
    h.owner.subscribeForeignStates = () => {}; h.owner.unsubscribeForeignStates = () => {};
    const config = { tariffProvider: structuredClone(tariffProvider), settingsConfig: { evcsCount: 0, evcsList: [] },
        history: { enabled: false }, weather: { enabled: false }, enableChargingManagement: false };
    h.adapter.config = { ...h.adapter.config, ...structuredClone(config) };
    h.adapter._nwInstallerConfigPatch = structuredClone(config);
    h.adapter._nwInstallerConfigRawPatch = structuredClone(config);
    h.adapter._hostedStartup = { state: 'ready' };
    h.adapter.persistInstallerConfigToState = Object.getPrototypeOf(h.adapter).persistInstallerConfigToState;
    await h.adapter.persistInstallerConfigToState(config);
    const token = await h.login('admin');
    const request = async options => {
        const result = await h.request('/api/installer/config', { token, ...options });
        for (const secret of [secretCanary, 'synthetic-header-auth', 'synthetic-request-body']) {
            assert.equal(result.text.includes(secret), false, 'Installer response must not disclose private request data');
        }
        assert.equal(result.status, 200, JSON.stringify({ status: result.status, code: result.data?.error }));
        return result.data;
    };
    const view = () => request();
    const change = async tariff => {
        const previous = await view();
        const result = await request({ method: 'POST', body: { expectedConfigurationRevision: previous.configurationRevision,
            patch: { tariffProvider: tariff }, restartEms: false } });
        return result.config.tariffProvider;
    };
    const stored = () => JSON.parse(h.states.get('eos-admin.0.installer.configJson').val).tariffProvider;
    return { view, change, stored };
}

for (const [name, patch, expected] of [
    ['home/country selection and disable', { enabled: false, homeId: 'another-home', country: 'NL', credentials: { accessToken: '__KEEP__' } }, secretCanary],
    ['explicit credential deletion', { credentials: { accessToken: '' } }, ''],
    ['changed token recipient', { endpoint: 'https://different-recipient.example/gql', credentials: { accessToken: '__KEEP__' } }, ''],
]) test(`Installer HTTP credential persistence: ${name}`, async t => {
    const x = await installerFixture(t, { providerId: 'tibber', sourceId: 'tibber', enabled: false,
        homeId: 'synthetic-home', country: 'DE', credentials: { accessToken: secretCanary } });
    await x.change(patch);
    assert.equal(x.stored().credentials.accessToken, expected);
});

for (const objectValues of [false, true]) for (const changedRecipient of [false, true]) {
    test(`Installer HTTP private ${objectValues ? 'object' : 'string'} headers/body: ${changedRecipient ? 'changed recipient clears masks' : 'same recipient preserves masks'}`, async t => {
        const headers = objectValues ? { Authorization: 'synthetic-header-auth' } : '{"Authorization":"synthetic-header-auth"}';
        const body = objectValues ? { token: 'synthetic-request-body' } : '{"token":"synthetic-request-body"}';
        const x = await installerFixture(t, { providerId: 'custom-rest', sourceId: 'custom-rest', enabled: false,
            customRest: { url: 'https://first-recipient.example/prices', authMode: 'bearer', headersJson: headers, body },
            credentials: { bearerToken: secretCanary } });
        const masked = (await x.view()).config.tariffProvider;
        assert.equal(masked.credentials.bearerToken, '__KEEP__');
        assert.equal(masked.customRest.headersJson, '__KEEP__'); assert.equal(masked.customRest.body, '__KEEP__');
        if (changedRecipient) masked.customRest.url = 'https://other-recipient.example/prices';
        await x.change(masked);
        const actual = x.stored();
        assert.deepEqual(actual.customRest.headersJson, changedRecipient ? '' : headers);
        assert.deepEqual(actual.customRest.body, changedRecipient ? '' : body);
        assert.equal(actual.credentials.bearerToken, changedRecipient ? '' : secretCanary);
    });
}

const { mergeInstallerTariffSecrets } = require('../ui/lib/customer-tariff');
const tibber = { providerId: 'tibber', sourceId: 'tibber', endpoint: 'https://api.tibber.com/v1-beta/gql',
    homeId: 'home-a', country: 'DE', credentials: { accessToken: 'scope-canary' } };
for (const [name, change, expected] of [
    ['partial edit', { refreshMinutes: 30 }, 'scope-canary'],
    ['home and country selection', { homeId: 'home-b', country: 'NL', credentials: { accessToken: '__KEEP__' } }, 'scope-canary'],
    ['disabled provider', { enabled: false }, 'scope-canary'],
    ['equivalent default endpoint', { endpoint: '', credentials: { accessToken: '__KEEP__' } }, 'scope-canary'],
    ['different endpoint', { endpoint: 'https://other.example/gql', credentials: { accessToken: '__KEEP__' } }, ''],
    ['different provider', { providerId: 'custom-rest', customRest: { url: 'https://other.example/prices' }, credentials: { accessToken: '__KEEP__' } }, ''],
    ['fresh credential on changed provider', { providerId: 'custom-rest', customRest: { url: 'https://other.example/prices' }, credentials: { accessToken: 'fresh-canary' } }, 'fresh-canary'],
    ['intentional empty field', { credentials: { accessToken: '' } }, ''],
]) test(`Installer token context: ${name}`, () => {
    const result = mergeInstallerTariffSecrets(change, tibber);
    assert.equal(result.credentials.accessToken, expected);
    assert.equal(tibber.credentials.accessToken, 'scope-canary', 'stored input remains immutable');
});

test('market source and configurable OAuth recipients/identity fence retained credentials', () => {
    const market = { providerId: 'market-profile', sourceId: 'entsoe', country: 'DE', credentials: { securityToken: 'scope-canary' } };
    assert.equal(mergeInstallerTariffSecrets({ sourceId: 'energyzero', country: 'NL', credentials: { securityToken: '__KEEP__' } }, market).credentials.securityToken, '');
    const oauth = { providerId: 'ostrom', tokenUrl: 'https://account.example/token', pricesUrl: 'https://prices.example/data',
        credentials: { clientId: 'account-a', clientSecret: 'scope-canary' } };
    assert.equal(mergeInstallerTariffSecrets({ credentials: { clientSecret: '__KEEP__' } }, oauth).credentials.clientSecret, 'scope-canary');
    for (const change of [{ tokenUrl: 'https://other.example/token' }, { pricesUrl: 'https://other.example/data' }, { credentials: { clientId: 'account-b', clientSecret: '__KEEP__' } }]) {
        assert.equal(mergeInstallerTariffSecrets(change, oauth).credentials.clientSecret, '');
    }
    const basic = { providerId: 'custom-rest', customRest: { url: 'https://prices.example/data', authMode: 'basic' },
        credentials: { username: 'account-a', password: 'scope-canary' } };
    assert.equal(mergeInstallerTariffSecrets({ credentials: { username: 'account-b', password: '__KEEP__' } }, basic).credentials.password, '');
});

test('private request masks preserve same-recipient headers/body but never revive an explicit request clear', () => {
    const previous = { providerId: 'custom-rest', customRest: { url: 'https://prices.example/data', headersJson: '{"Authorization":"scope-canary"}', body: 'scope-canary' } };
    const retained = mergeInstallerTariffSecrets({ customRest: { headersJson: '__KEEP__', body: '__KEEP__' } }, previous);
    assert.equal(retained.customRest.headersJson, previous.customRest.headersJson); assert.equal(retained.customRest.body, previous.customRest.body);
    const removed = mergeInstallerTariffSecrets({ customRest: null }, previous);
    assert.equal(removed.customRest.headersJson, ''); assert.equal(removed.customRest.body, '');
});

test('an early real startup failure cannot let Devices or OCPP overwrite an unread tariff', async t => {
    const { createHarness } = require('../ui/test/unified/http-harness.cjs');
    const h = await createHarness();
    t.after(async () => { await new Promise(resolve => h.adapter.onUnload(resolve)); await h.close(); });
    const storedId = `${h.adapter.namespace}.installer.configJson`;
    const saved = JSON.stringify({ tariffProvider: tibber });
    h.states.set(storedId, { val: saved, ack: true, ts: Date.now() });
    let plannerCalls = 0;
    h.bridge.deviceEmsPlan = async () => { plannerCalls++; return { changed: false, statuses: [] }; };
    h.adapter.ensureLicenseStates = async () => { throw new Error('FIXTURE_EARLY_OBJECT_DATABASE_FAILURE'); };
    await h.adapter.onReady();
    assert.equal(h.adapter._nwInstallerConfigHydrated, false);
    assert.equal(h.adapter._hostedStartup.state, 'degraded');
    assert.notEqual(h.adapter._nwShuttingDown, true);
    await assert.rejects(h.adapter.reconcileDeviceEms([]), { message: 'EOS_UI_CONFIG_NOT_READY' });
    await assert.rejects(h.adapter.reconcileOcppDiscovery([]), { message: 'EOS_UI_CONFIG_NOT_READY' });
    assert.equal(plannerCalls, 0); assert.equal(h.states.get(storedId).val, saved);
});
