/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { collectOcppStations, filterOcppDiscoverySources, OCPP_NATIVE_CONTRACT } = require('../ui/lib/ocpp-auto-discovery');

function inventory(root) {
    const objects = {}, states = {};
    for (const [suffix, type, unit, write, value] of [
        ['info.eosContract', 'string', '', false, OCPP_NATIVE_CONTRACT],
        ['info.deviceType', 'string', '', false, 'evCharger'], ['info.identity', 'string', '', false, root.split('.').at(-1)],
        ['info.status', 'string'], ['info.socketConnected', 'boolean', '', false, false],
        ['measurements.powerW', 'number', 'W'], ['health.lastSeenMs', 'number'], ['health.dataFresh', 'boolean'],
        ['control.chargeLimit', 'number', 'W', true], ['control.availability', 'boolean', '', true],
        ['control.appliedChargeLimitW', 'number', 'W'], ['control.appliedChargeLimitValid', 'boolean'],
    ]) {
        const id = `${root}.${suffix}`;
        objects[id] = { _id: id, type: 'state', common: { type, read: true, write: write === true, ...(unit ? { unit } : {}) } };
        if (value !== undefined) states[id] = { val: value, ack: true, q: 0, ts: Date.now() };
    }
    return { objects, states, stations: () => collectOcppStations(objects, states, 'eos-admin.0') };
}

async function fixture(t, settingsConfig = { evcsCount: 0, evcsList: [] }) {
    const h = await createHarness(); const a = h.adapter;
    a._hostedStartup = { state: 'ready' };
    a.config = { ...a.config, settingsConfig: structuredClone(settingsConfig) };
    a._nwInstallerConfigPatch = { settingsConfig: structuredClone(settingsConfig),
        settings: { dynamicTariff: true }, tariffProvider: { provider: 'tibber', token: 'fixture-tariff-secret' } };
    a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState;
    const writes = [], stops = [];
    const write = h.owner.setForeignStateAsync;
    h.owner.setForeignStateAsync = async (id, state, ack) => { writes.push(id); return write(id, state, ack); };
    a.emsEngine = { stopForReconfigure: async () => { stops.push('stop'); } };
    a._nwApplyInstallerRuntime = async function () { await this.syncSettingsConfigToStates(); };
    a.nwWriteUserdataBackup = async () => {};
    const token = await h.login('installer');
    t.after(async () => { await a._ocppAutoDiscovery?.stop(); await h.close(); });
    return { ...h, a, token, writes, stops,
        saved: () => JSON.parse(h.states.get('eos-admin.0.installer.configJson').val),
        get: () => h.request('/api/installer/config', { token }),
        save: (revision, patch) => h.request('/api/installer/config', { token, method: 'POST',
            body: { expectedConfigurationRevision: revision, patch } }) };
}

test('installer GET pairs a discovery-updated row snapshot with its own revision before a subsequent delete', async t => {
    const h = await fixture(t);
    const oldRevision = h.a._nwInstallerConfigRevision();
    let refreshes = 0;
    // First refresh belongs to the route admission guard, second to GET itself.
    // A real discovery commit during that second await used to leave an old token.
    h.a._nwLicenseInfo = null;
    h.a._nwRefreshLicenseFromConfiguredKey = async () => {
        if (++refreshes !== 2) return;
        await h.a.reconcileOcppDiscovery(inventory('ocpp21.0.RETIRED').stations());
        h.a._nwLicenseInfo = { ok: true }; h.a._nwLicenseOk = true;
    };
    const loaded = await h.get();
    assert.equal(loaded.status, 200);
    assert.equal(loaded.data.config.settingsConfig.evcsList.length, 1);
    assert.notEqual(loaded.data.configurationRevision, oldRevision);
    assert.equal(loaded.data.configurationRevision, h.a._nwInstallerConfigRevision());
    const deleted = await h.save(loaded.data.configurationRevision,
        { settingsConfig: { evcsCount: 0, evcsList: [], __allowEmptyEvcsList: true } });
    assert.equal(deleted.status, 200, JSON.stringify(deleted.data));
    assert.deepEqual(h.saved().settingsConfig.evcsList, []);
    assert.equal(h.saved().settingsConfig.evcsCount, 0);
    assert.equal(Object.hasOwn(h.saved().settingsConfig, '__allowEmptyEvcsList'), false);
    assert.equal(Object.hasOwn(h.saved().settingsConfig, '__explicitDeleteAll'), false);
    assert.equal(h.saved().settings.dynamicTariff, true);
    assert.equal(h.saved().tariffProvider.token, 'fixture-tariff-secret');
    assert.ok(h.writes.every(id => !id.startsWith('ocpp21.')), 'configuration removal never deletes or commands a source adapter');
});

test('a real discovery commit after GET still rejects the stale form without discarding its newer station', async t => {
    const h = await fixture(t);
    h.a._nwLicenseInfo = { ok: true };
    const loaded = await h.get();
    await h.a.reconcileOcppDiscovery(inventory('eos-admin.0.ocpp.NEW').stations());
    const latest = h.saved();
    const rejected = await h.save(loaded.data.configurationRevision,
        { settingsConfig: { evcsCount: 0, evcsList: [], __allowEmptyEvcsList: true } });
    assert.equal(rejected.status, 409);
    assert.equal(rejected.data.error, 'EOS_INSTALLER_CONFIG_CHANGED');
    assert.deepEqual(h.saved(), latest);
});

test('installer hydration changes only its response snapshot and leaves the revision base and runtime objects intact', async t => {
    const h = await fixture(t);
    h.a._nwLicenseInfo = { ok: true };
    h.a.config.storageFarm = { mode: 'pool', storages: [] };
    h.states.set('eos-admin.0.storageFarm.configJson', { val: JSON.stringify([{ enabled: true, name: 'Existing storage', socId: 'fixture.0.soc' }]), ack: true });
    const originalRuntime = structuredClone(h.a.config.storageFarm);
    const originalPatch = structuredClone(h.a._nwInstallerConfigPatch);
    const loaded = await h.get();
    assert.equal(loaded.status, 200);
    assert.equal(loaded.data.config.storageFarm.storages.length, 1);
    assert.deepEqual(h.a.config.storageFarm, originalRuntime);
    assert.deepEqual(h.a._nwInstallerConfigPatch, originalPatch);
    assert.equal(loaded.data.configurationRevision, h.a._nwInstallerConfigRevision());
});

test('discovery requires a configured source, preserves offline instances and admits only the authoritative hosted legacy namespace', () => {
    const legacy = inventory('ocpp21.0.RETIRED'), hosted = inventory('eos-admin.0.ocpp.NEW');
    const stations = [...legacy.stations(), ...hosted.stations()];
    const noInstances = { instances: { rows: [] } };
    assert.deepEqual(filterOcppDiscoverySources(stations, noInstances, 'eos-admin.0').map(item => item.root), ['eos-admin.0.ocpp.NEW']);
    const offline = { instances: { rows: [{ value: { _id: 'system.adapter.ocpp21.0', type: 'instance', common: { enabled: false } } }] } };
    assert.deepEqual(filterOcppDiscoverySources(stations, offline, 'eos-admin.0'), stations);
    assert.deepEqual(filterOcppDiscoverySources(stations, { ...noInstances, hostedNamespace: 'ocpp21.0' }, 'eos-admin.0'), stations);
    assert.deepEqual(filterOcppDiscoverySources(stations, { ...noInstances, hostedNamespace: 'ocpp21.1' }, 'eos-admin.0').map(item => item.root), ['eos-admin.0.ocpp.NEW']);
    assert.throws(() => filterOcppDiscoverySources(stations, { instances: { rows: [{ value: { _id: 'system.adapter.ocpp21.0', type: 'state' } }] } }, 'eos-admin.0'), /SOURCE_INVENTORY/);
});

test('deleted legacy rows stay removed after rescans and installer reload while the integrated source continues discovery', async t => {
    const old = inventory('ocpp21.0.RETIRED'), current = inventory('eos-admin.0.ocpp.CURRENT');
    const h = await fixture(t);
    h.a._nwLicenseInfo = { ok: true };
    await h.a.reconcileOcppDiscovery([...old.stations(), ...current.stations()]);
    const loaded = await h.get();
    const keep = structuredClone(loaded.data.config.settingsConfig.evcsList[1]);
    const sourceStates = { ...old.states, ...current.states };
    const sourceObjects = { ...old.objects, ...current.objects };
    const originals = structuredClone({ sourceStates, sourceObjects });
    h.owner.getForeignObjectsAsync = async pattern => Object.fromEntries(Object.entries(sourceObjects).filter(([id]) => id.startsWith(pattern.replace('*', ''))));
    h.owner.getForeignStatesAsync = async pattern => Object.fromEntries(Object.entries(sourceStates).filter(([id]) => id.startsWith(pattern.split('*')[0])));
    h.owner.getObjectViewAsync = async () => ({ rows: [] }); // Deleted adapter; its old source states still exist.
    h.bridge.getRuntimeReadiness = () => ({ hostedOcppNamespace: 'eos-admin.0.ocpp' });
    const deleted = await h.save(loaded.data.configurationRevision, { settingsConfig: { evcsCount: 1, evcsList: [keep] } });
    assert.equal(deleted.status, 200, JSON.stringify(deleted.data));
    h.a._nwStartOcppAutoDiscovery();
    for (let cycle = 0; cycle < 3; cycle++) await h.a._ocppAutoDiscovery.refresh();
    assert.equal(h.saved().settingsConfig.evcsList.length, 1);
    assert.equal(h.saved().settingsConfig.evcsList[0].setPowerWId, keep.setPowerWId);
    const stored = h.saved();
    await h.a._ocppAutoDiscovery.stop(); h.a._ocppAutoDiscovery = null;
    h.a._nwInstallerConfigPatch = {}; h.a._nwInstallerConfigRawPatch = {};
    await h.a.loadInstallerConfigFromState();
    h.a._nwStartOcppAutoDiscovery(); await h.a._ocppAutoDiscovery.refresh();
    assert.equal(h.a._nwInstallerConfigPatch.settingsConfig.evcsList.length, 1);
    assert.equal(h.a._nwInstallerConfigPatch.settingsConfig.evcsList[0].setPowerWId, keep.setPowerWId);
    assert.deepEqual(h.saved(), stored);
    assert.deepEqual({ sourceStates, sourceObjects }, originals);
    assert.ok(h.writes.every(id => !id.startsWith('ocpp21.')));
});

test('production discovery admits a preserved namespace from its parent even after the old adapter object is gone', async t => {
    const h = await fixture(t);
    const retained = inventory('ocpp21.4.PRESERVED');
    h.owner.getForeignObjectsAsync = async pattern => pattern === 'ocpp21.*' ? retained.objects : {};
    h.owner.getForeignStatesAsync = async pattern => pattern === 'ocpp21.*.info.*' ? retained.states : {};
    h.owner.getObjectViewAsync = async () => ({ rows: [] });
    h.bridge.getRuntimeReadiness = () => ({ hostedOcppNamespace: 'ocpp21.4' });
    h.a._nwStartOcppAutoDiscovery(); await h.a._ocppAutoDiscovery.refresh();
    assert.equal(h.a._ocppAutoDiscovery.status().state, 'ready');
    assert.equal(h.saved().settingsConfig.evcsList.length, 1);
    assert.equal(h.saved().settingsConfig.evcsList[0].setPowerWId, 'ocpp21.4.PRESERVED.control.chargeLimit');
    assert.equal(h.saved().settingsConfig.evcsList[0].enabled, false);
});

test('failed source inventory never treats orphaned contract states as an existing adapter', async t => {
    const h = await fixture(t);
    const orphan = inventory('ocpp21.0.RETIRED');
    h.owner.getForeignObjectsAsync = async pattern => pattern === 'ocpp21.*' ? orphan.objects : {};
    h.owner.getForeignStatesAsync = async pattern => pattern === 'ocpp21.*.info.*' ? orphan.states : {};
    h.owner.getObjectViewAsync = async () => { throw new Error('fixture inventory unavailable'); };
    h.a._nwStartOcppAutoDiscovery(); await h.a._ocppAutoDiscovery.refresh();
    assert.equal(h.a._ocppAutoDiscovery.status().state, 'pending');
    assert.deepEqual(h.a._nwInstallerConfigPatch.settingsConfig.evcsList, []);
    assert.equal(h.states.has('eos-admin.0.installer.configJson'), false);
    assert.equal(h.writes.length, 0);
});
