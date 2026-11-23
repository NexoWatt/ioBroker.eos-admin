/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./http-harness.cjs');
const { smartHomeEnabled } = require('../../lib/smarthome-activation');

function configure(adapter, enabled = false) {
    adapter.config.smartHome = { enabled, datapoints: { roomTemp: 'knx.0.room.temperature' } };
    adapter.config.smartHomeConfig = {
        version: 3, floors: [{ id: 'eg', name: 'Erdgeschoss' }],
        rooms: [{ id: 'living', name: 'Wohnen', floorId: 'eg' }], functions: [], pages: [], scenes: [], meta: {},
        devices: [{ id: 'lamp', type: 'switch', alias: 'Deckenlicht', roomId: 'living',
            io: { switch: { readId: 'knx.0.light', writeId: 'knx.0.light' } } }],
    };
    adapter._nwNativeConfigBase = structuredClone(adapter.config);
    adapter._nwInstallerConfigPatch = {
        smartHome: structuredClone(adapter.config.smartHome),
        smartHomeConfig: structuredClone(adapter.config.smartHomeConfig),
        logicEditor: { graphs: [{ id: 'customer-graph', nodes: [] }] },
        chargingManagement: { untouched: 'customer-settings' },
    };
    adapter.buildSmartHomeDevicesFromConfig();
}

test('explicit SmartHome choice wins; without it native/AppCenter choices and disabled installations remain unchanged', () => {
    assert.equal(smartHomeEnabled({ smartHomeConfig: { rooms: [{ id: 'living' }] } }), false);
    assert.equal(smartHomeEnabled({ smartHome: { enabled: true } }), true);
    assert.equal(smartHomeEnabled({ smartHome: { enabled: true } }, { smartHome: { enabled: false } }), false);
    assert.equal(smartHomeEnabled({ smartHome: { enabled: false }, emsApps: { apps: { smartHome: { installed: true, enabled: true } } } }), true);
    assert.equal(smartHomeEnabled({ smartHome: { enabled: false }, emsApps: { apps: { smarthome: { installed: true, enabled: false } } } }), false);
    assert.equal(smartHomeEnabled({ smartHome: { customerViewEnabled: true } }, { smartHome: { enabled: false } }), true);
    assert.equal(smartHomeEnabled({ smartHome: { customerViewEnabled: false }, emsApps: { apps: { smartHome: { installed: true, enabled: true } } } }, { smartHome: { enabled: true } }), false);
    assert.equal(smartHomeEnabled({ smartHome: { customerViewEnabled: 'true', enabled: false } }), false);
    assert.equal(smartHomeEnabled({ smartHome: Object.create({ customerViewEnabled: true }) }), false);
});

test('installer activates actual customer devices and navigation without instance update or actuator write; off retains configuration', async t => {
    const h = await createHarness(); t.after(() => h.close()); configure(h.adapter);
    const token = await h.login('installer');
    const originalLayout = structuredClone(h.adapter.config.smartHomeConfig);
    assert.equal((await h.request('/api/smarthome/activation', { token })).data.enabled, false);
    assert.deepEqual((await h.request('/api/smarthome/devices', { token })).data.devices, []);
    const response = await h.request('/api/smarthome/activation', { token, method: 'POST', body: { enabled: true } });
    assert.deepEqual(response.data, { ok: true, enabled: true });
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await h.request('/config', { token })).data.smartHome.enabled, true);
    assert.equal((await h.request('/api/smarthome/devices', { token })).data.devices.some(d => d.id === 'lamp'), true);
    const stored = JSON.parse(h.states.get('eos-admin.0.installer.configJson').val);
    assert.equal(stored.smartHome.customerViewEnabled, true);
    assert.equal(stored.smartHome.enabled, false);
    assert.deepEqual(stored.smartHomeConfig, originalLayout);
    assert.deepEqual(stored.logicEditor, { graphs: [{ id: 'customer-graph', nodes: [] }] });
    assert.equal(stored.chargingManagement.untouched, 'customer-settings');
    assert.equal(h.states.has('knx.0.light'), false);
    assert.equal([...h.objects.keys()].some(id => id.startsWith('system.adapter.')), false);
    assert.equal(h.objects.get('eos-admin.0.installer.configJson').acl.state, 0x600);
    assert.equal((await h.request('/api/smarthome/activation', { token, method: 'POST', body: { enabled: false } })).status, 200);
    assert.equal((await h.request('/config', { token })).data.smartHome.enabled, false);
    assert.deepEqual((await h.request('/api/smarthome/devices', { token })).data.devices, []);
    assert.deepEqual(h.adapter.config.smartHomeConfig, originalLayout);
});

test('activation is admin/installer only with CSRF and the existing central SmartHome license', async t => {
    const h = await createHarness(); t.after(() => h.close()); configure(h.adapter);
    const customer = await h.login('kunde'); const admin = await h.login('admin');
    for (const method of ['GET', 'POST']) {
        const options = method === 'GET' ? {} : { method, body: { enabled: true } };
        assert.equal((await h.request('/api/smarthome/activation', options)).status, 401);
        assert.equal((await h.request('/api/smarthome/activation', { ...options, token: customer })).status, 403);
    }
    assert.equal((await h.request('/api/smarthome/activation', { token: admin, csrf: false, method: 'POST', body: { enabled: true } })).status, 403);
    h.bridge.getLicense = () => ({ valid: true, coreEnabled: true, edition: 'home', features: ['energy'] });
    const denied = await h.request('/api/smarthome/activation', { token: admin, method: 'POST', body: { enabled: true } });
    assert.equal(denied.status, 403); assert.equal(denied.data.error, 'EOS_FEATURE_LICENSE_REQUIRED');
    assert.equal(h.states.has('eos-admin.0.installer.configJson'), false);
});

test('activation rejects missing, coerced and extra input fields without changing customer data', async t => {
    const h = await createHarness(); t.after(() => h.close()); configure(h.adapter);
    const token = await h.login('admin');
    for (const body of [{}, [], { enabled: null }, { enabled: 1 }, { enabled: 'true' }, { enabled: true, smartHomeConfig: {} }]) {
        assert.equal((await h.request('/api/smarthome/activation', { token, method: 'POST', body })).status, 400);
    }
    assert.equal(h.states.has('eos-admin.0.installer.configJson'), false);
    assert.equal(smartHomeEnabled(h.adapter.config, h.adapter._nwNativeConfigBase), false);
});

test('failed activation persistence retains enabled choice, layout and device cache and releases shared save lock', async t => {
    const h = await createHarness(); t.after(() => h.close()); configure(h.adapter, true);
    const token = await h.login('admin');
    const before = structuredClone(h.adapter.config); const cache = h.adapter.smartHomeDevices;
    h.adapter.setStateAsync = async () => { throw new Error('fixture database unavailable'); };
    const response = await h.request('/api/smarthome/activation', { token, method: 'POST', body: { enabled: false } });
    assert.equal(response.status, 500);
    assert.equal(response.data.error, 'SMART_HOME_ACTIVATION_SAVE_FAILED');
    assert.deepEqual(h.adapter.config, before); assert.equal(h.adapter.smartHomeDevices, cache);
    assert.equal(h.adapter._nwMeshAppSaveInProgress, false);
    assert.equal((await h.request('/api/smarthome/activation', { token })).data.enabled, true);
});

test('concurrent activation and layout saves cannot overwrite each other; activation does not stop EMS partner runtime', async t => {
    const h = await createHarness(); t.after(() => h.close()); configure(h.adapter);
    const token = await h.login('admin'); let unblock; let entered;
    const blocked = new Promise(resolve => { unblock = resolve; });
    const writeEntered = new Promise(resolve => { entered = resolve; });
    const write = h.adapter.setStateAsync.bind(h.adapter);
    h.adapter.setStateAsync = async (...args) => { entered(); await blocked; return write(...args); };
    h.adapter._partnerRuntime = { stop() { throw new Error('activation must not stop regulation'); } };
    const pending = h.request('/api/smarthome/activation', { token, method: 'POST', body: { enabled: true } });
    await writeEntered;
    assert.equal((await h.request('/api/smarthome/activation', { token, method: 'POST', body: { enabled: false } })).status, 409);
    assert.equal((await h.request('/api/smarthome/config', { token, method: 'POST', body: { config: {} } })).status, 409);
    assert.equal((await h.request('/api/smarthome/activation', { token })).data.enabled, false);
    unblock(); assert.equal((await pending).status, 200);
    assert.equal(h.adapter._nwDynamicGridSaveInFlight, undefined);
    h.adapter._nwMeshAppSaveInProgress = { fixture: 'layout-save' };
    assert.equal((await h.request('/api/smarthome/activation', { token, method: 'POST', body: { enabled: false } })).status, 409);
});

test('migrated namespace keeps activation after restart hydration, with all legacy settings and schedules untouched', async t => {
    const h = await createHarness({ legacyNamespace: 'nexowatt-ui.0' }); t.after(() => h.close()); configure(h.adapter);
    const token = await h.login('admin');
    const nativeConfig = structuredClone(h.adapter.config);
    const timers = { val: JSON.stringify({ version: 1, timers: [{ id: 'customer-timer', enabled: true, deviceId: 'lamp' }] }), ack: true };
    h.states.set('nexowatt-ui.0.smarthome.timersJson', structuredClone(timers));
    assert.equal((await h.request('/api/smarthome/activation', { token, method: 'POST', body: { enabled: true } })).status, 200);
    assert.equal(h.states.has('eos-admin.0.installer.configJson'), false);
    assert.equal(h.objects.get('nexowatt-ui.0.installer.configJson').acl.state, 0x600);
    h.adapter.config = nativeConfig; h.adapter._nwInstallerConfigPatch = {};
    h.adapter.nwReadUserdataBackup = async () => null;
    h.adapter._nwValidateNvpTopology = async () => {};
    h.adapter._nwValidateDynamicGridConfig = async () => {};
    await h.adapter.loadInstallerConfigFromState();
    assert.equal((await h.request('/api/smarthome/activation', { token })).data.enabled, true);
    assert.equal((await h.request('/config', { token })).data.smartHome.enabled, true);
    assert.deepEqual(h.adapter.config.smartHomeConfig, nativeConfig.smartHomeConfig);
    assert.deepEqual(h.states.get('nexowatt-ui.0.smarthome.timersJson'), timers);
    assert.equal(h.states.has('knx.0.light'), false);
});
