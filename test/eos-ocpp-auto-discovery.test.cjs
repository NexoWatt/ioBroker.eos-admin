/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { OcppAutoDiscovery, collectOcppStations, planOcppDiscovery, OCPP_NATIVE_CONTRACT } = require('../ui/lib/ocpp-auto-discovery');
const { assertInstallerRevision, installerRevision } = require('../ui/lib/installer-lifecycle');
const { EmsEngine } = require('../ui/ems/engine');
const { makeHarness } = require('../ui/scripts/verify-rc60-universal-auto-wallbox');
const root = 'ocpp21.0.ENERGYLINE';

function inventory(base = root) {
    const objects = {}, states = {};
    const add = (suffix, type, unit, write = false, val) => {
        const id = `${base}.${suffix}`;
        objects[id] = { _id: id, type: 'state', common: { type, read: true, write, ...(unit ? { unit } : {}) }, native: {} };
        if (val !== undefined) states[id] = { val, ack: true, q: 0, ts: Date.now() };
    };
    for (const [suffix, type, unit, write, val] of [
        ['info.eosContract','string','',false,OCPP_NATIVE_CONTRACT], ['info.deviceType','string','',false,'evCharger'],
        ['info.identity','string','',false,'Dousida Energyline'], ['info.protocol','string','',false,'ocpp1.6'],
        ['info.connectorCount','number','',false,1], ['info.evseCount','number','',false,1], ['info.topologySource','string','',false,'commissioned'],
        ['info.status','string'], ['info.socketConnected','boolean','',false,false], ['info.rfid','string'],
        ['measurements.powerW','number','W'], ['measurements.currentA','number','A'], ['measurements.energyKWh','number','kWh'],
        ['measurements.socPercent','number','%'], ['transactions.chargingState','string'], ['transactions.transactionActive','boolean'],
        ['health.lastSeenMs','number'], ['health.dataFresh','boolean'], ['control.chargeLimit','number','W',true],
        ['control.availability','boolean','',true], ['control.appliedChargeLimitW','number','W'], ['control.appliedChargeLimitValid','boolean'],
    ]) add(suffix, type, unit, write, val);
    return { objects, states, add, stations: () => collectOcppStations(objects, states) };
}

async function runtimeFixture(t, initial = {}) {
    const h = await createHarness(); const a = h.adapter;
    a._hostedStartup = { state: 'ready' };
    a.config = { ...a.config, settingsConfig: { evcsCount: 0, evcsList: [], ...initial } };
    a._nwInstallerConfigPatch = { settingsConfig: structuredClone(a.config.settingsConfig), settings: { dynamicTariff: true } };
    a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState;
    const writes = [], applies = [], stops = [];
    const write = h.owner.setForeignStateAsync;
    h.owner.setForeignStateAsync = async (id, state, ack) => { writes.push({ id, state, ack }); return write(id, state, ack); };
    a.emsEngine = { stopForReconfigure: async () => { stops.push('stop'); } };
    a._nwApplyInstallerRuntime = async function (_restart, reason) {
        await this.syncSettingsConfigToStates(); applies.push(reason);
    };
    a.nwWriteUserdataBackup = async () => {};
    t.after(async () => { await a._ocppAutoDiscovery?.stop(); await h.close(); });
    return { ...h, a, writes, applies, stops, persisted: () => JSON.parse(h.states.get('eos-admin.0.installer.configJson').val) };
}

test('registered stations persist complete native mappings; unknown electrical limits never enable a writer', async t => {
    const manual = { enabled: true, name: 'Manuell', powerId: 'meter.0.wallbox', setCurrentAId: 'manual.0.current', maxA: 13, minA: 6 };
    const h = await runtimeFixture(t, { evcsCount: 1, evcsList: [manual] });
    const first = inventory(); const second = inventory('ocpp21.1.ENERGYLINE');
    const stations = collectOcppStations({ ...first.objects, ...second.objects }, { ...first.states, ...second.states });
    const result = await h.a.reconcileOcppDiscovery(stations);
    assert.equal(result.changed, true); assert.deepEqual(result.statuses.map(s => s.code), ['COMMISSIONING_REQUIRED','COMMISSIONING_REQUIRED']);
    const saved = h.persisted(); const rows = saved.settingsConfig.evcsList;
    assert.equal(rows.length, 3); assert.deepEqual(rows[0], manual);
    for (const [i, base] of [[1, root], [2, 'ocpp21.1.ENERGYLINE']]) {
        assert.equal(rows[i].enabled, false); assert.equal(rows[i].maxPowerW, undefined); assert.equal(rows[i].minCurrentA, undefined);
        assert.equal(rows[i].setPowerWId, `${base}.control.chargeLimit`);
        assert.equal(rows[i].powerId, `${base}.measurements.powerW`);
        assert.equal(rows[i].onlineId, `${base}.info.socketConnected`);
        assert.equal(rows[i].dataFreshId, `${base}.health.dataFresh`);
        assert.equal(rows[i].appliedChargeLimitValidId, `${base}.control.appliedChargeLimitValid`);
        assert.equal(rows[i].ocppDiscovery.controlScope, 'station');
    }
    assert.equal(saved.settings.dynamicTariff, true);
    assert.equal(saved.emsApps, undefined, 'discovery does not install or activate an app');
    assert.ok(h.writes.every(w => !w.id.startsWith('ocpp21.')), 'no hardware command is generated by registration');
    assert.equal(h.applies.length, 1); assert.equal(h.stops.length, 1);
    const replay = await h.a.reconcileOcppDiscovery(stations);
    assert.equal(replay.changed, false); assert.equal(h.applies.length, 1);
});

test('partial contract registration is explicit and completes; invalid directions, units and metadata stay untrusted', () => {
    const inv = inventory(); delete inv.objects[`${root}.control.chargeLimit`];
    const partial = planOcppDiscovery({}, inv.stations());
    assert.equal(partial.statuses[0].code, 'CONTRACT_INCOMPLETE');
    assert.equal(partial.patch.settingsConfig.evcsList[0].setPowerWId, undefined);
    assert.equal(partial.patch.settingsConfig.evcsList[0].enabled, false);
    inv.add('control.chargeLimit', 'number', 'A', true);
    assert.ok(inv.stations()[0].missing.includes('setPowerWId'), 'native W contract cannot be relabelled as A');
    inv.add('control.chargeLimit', 'number', 'W', false);
    assert.ok(inv.stations()[0].missing.includes('setPowerWId'));
    inv.add('control.chargeLimit', 'number', 'W', true);
    const full = planOcppDiscovery(partial.patch, inv.stations());
    assert.equal(full.patch.settingsConfig.evcsList.length, 1);
    assert.equal(full.patch.settingsConfig.evcsList[0].setPowerWId, `${root}.control.chargeLimit`);
    assert.equal(full.statuses[0].code, 'COMMISSIONING_REQUIRED');
    inv.states[`${root}.info.eosContract`].q = 64;
    assert.deepEqual(inv.stations(), []);
    inv.states[`${root}.info.eosContract`].q = 0;
    inv.states[`${root}.info.deviceType`].val = 'generic'; assert.deepEqual(inv.stations(), []);
});

test('real configuration pipeline retains validated contract failure metadata and never enables an uncommissioned row', async t => {
    const h = await runtimeFixture(t); const inv = inventory(); delete inv.objects[`${root}.control.chargeLimit`];
    await h.a.reconcileOcppDiscovery(inv.stations());
    assert.equal(h.a.evcsList[0].ocppDiscovery.code, 'CONTRACT_INCOMPLETE');
    const built = EmsEngine.prototype._buildChargingConfig.call({ adapter: h.a });
    const row = built.chargingCfg.wallboxes[0];
    assert.equal(row.ocppDiscovery.code, 'CONTRACT_INCOMPLETE'); assert.equal(row.ocppDiscovery.stationRoot, root);
    assert.equal(row.enabled, false); assert.equal(row.maxPowerW, undefined); assert.equal(row.minPowerW, undefined);
    assert.equal(row.maxA, undefined); assert.equal(row.minA, undefined);
    h.a.config.settingsConfig.evcsList[0].ocppDiscovery.controlScope = 'connector';
    await h.a.syncSettingsConfigToStates();
    assert.equal(h.a.evcsList[0].ocppDiscovery, undefined, 'unsupported connector control scope is never forwarded');
});

test('existing aliases deduplicate to one station and manual limits/mappings survive; duplicate control groups are reported', () => {
    const inv = inventory();
    const original = { enabled: true, name: 'Kundeneigener Name', setPowerWId: 'alias.0.nexowatt.ocpp.0.ENERGYLINE.control.chargeLimit',
        powerId: 'custom.0.actualPower', maxPowerW: 7100, minPowerW: 1380, phases: 1, boostMaxPowerW: 0, custom: { keep: true } };
    const first = planOcppDiscovery({ settingsConfig: { evcsCount: 1, evcsList: [original] } }, inv.stations());
    const row = first.patch.settingsConfig.evcsList[0];
    assert.equal(first.patch.settingsConfig.evcsList.length, 1);
    assert.equal(row.setPowerWId, `${root}.control.chargeLimit`);
    for (const key of ['enabled','name','powerId','maxPowerW','minPowerW','phases','boostMaxPowerW','custom']) assert.deepEqual(row[key], original[key]);
    assert.equal(planOcppDiscovery(first.patch, inv.stations()).changed, false);
    const duplicates = { settingsConfig: { evcsCount: 2, evcsList: [original, { enabled: true, setPowerWId: `${root}.control.chargeLimit` }] } };
    const conflict = planOcppDiscovery(duplicates, inv.stations());
    assert.equal(conflict.changed, false); assert.equal(conflict.statuses[0].code, 'CONTROL_GROUP_CONFLICT');
    const mixed = planOcppDiscovery({ settingsConfig: { evcsCount: 1, evcsList: [{ setPowerWId: `${root}.control.chargeLimit`, powerId: 'ocpp21.0.OTHER.measurements.powerW' }] } }, inv.stations());
    assert.equal(mixed.changed, false); assert.equal(mixed.statuses[0].code, 'MIXED_MANUAL_MAPPING');
});

test('multi EVSE topology remains one station aggregate writer; connector controls are never invented', () => {
    const inv = inventory(); inv.states[`${root}.info.connectorCount`].val = 3; inv.states[`${root}.info.evseCount`].val = 2;
    for (const key of ['1_1','1_2','2_1']) inv.add(`connectors.${key}.status`, 'string');
    const plan = planOcppDiscovery({}, inv.stations());
    const rows = plan.patch.settingsConfig.evcsList;
    assert.equal(rows.length, 1); assert.equal(rows[0].ocppDiscovery.connectorCount, 3);
    assert.deepEqual(rows[0].ocppDiscovery.connectors, [{ evseId: 1, connectorId: 1 }, { evseId: 1, connectorId: 2 }, { evseId: 2, connectorId: 1 }]);
    assert.equal(rows[0].setPowerWId, `${root}.control.chargeLimit`);
    assert.equal(rows[0].phaseSwitchId, undefined);
    assert.ok(!Object.values(rows[0]).filter(v => typeof v === 'string').some(v => v.includes('.connectors.')));
});

test('an existing active manual monitor does not gain its first writer from discovery, including later rescans', () => {
    const inv = inventory();
    const manual = { enabled: true, name: 'Nur Messung', powerId: `${root}.measurements.powerW`, maxPowerW: 7000, minPowerW: 1400 };
    const initial = planOcppDiscovery({ settingsConfig: { evcsCount: 1, evcsList: [manual] } }, inv.stations());
    const row = initial.patch.settingsConfig.evcsList[0];
    assert.equal(row.enabled, true); assert.equal(row.setPowerWId, undefined); assert.equal(row.enableWriteId, undefined);
    assert.equal(row.ocppDiscovery.code, 'MANUAL_MAPPING_REVIEW_REQUIRED'); assert.equal(row.ocppDiscovery.autoCreated, false);
    assert.equal(planOcppDiscovery(initial.patch, inv.stations()).changed, false);
    row.setPowerWId = `${root}.control.chargeLimit`;
    const commissioned = planOcppDiscovery(initial.patch, inv.stations());
    assert.equal(commissioned.patch.settingsConfig.evcsList[0].ocppDiscovery.code, 'MAPPED');
});

test('existing manual monitor crosses real normalization, engine and CM tick without inferred hardware commands', async t => {
    const h = await runtimeFixture(t, { evcsCount: 1, evcsList: [{ enabled: true, powerId: `${root}.measurements.powerW`,
        maxPowerW: 11000, minPowerW: 1400 }] });
    await h.a.reconcileOcppDiscovery(inventory().stations());
    const normalized = h.a.evcsList[0];
    assert.equal(normalized.setPowerWId, ''); assert.equal(normalized.setCurrentAId, ''); assert.equal(normalized.enableWriteId, '');
    const built = EmsEngine.prototype._buildChargingConfig.call({ adapter: h.a }).chargingCfg.wallboxes[0];
    const cm = makeHarness({ userMode: 'auto', gridAllowed: true, status: 'Charging', chargingState: 'Charging', transactionActive: true,
        actualPowerW: 5700, wallbox: { ...built, setCurrentAId: built.setCurrentAId || '', setPowerWId: built.setPowerWId || '',
            enableId: built.enableId || '', vehicleConnectedId: '', chargeDemandId: '' } });
    t.after(() => cm.stop());
    for (const key of ['_publishChargingAllocationTsShadow', '_publishChargingPhaseSelectionRuntimeStates', '_publishChargingStationDiagnosticsFromAllocationPlan']) delete cm.module[key];
    cm.adapter.config._chargingHasAnySetpoint = true; // Another row may already have an authorized writer.
    cm.setObject(`${root}.info.eosControlLeaseSupported`, true);
    cm.setObject(`${root}.health.dataFresh`, true);
    cm.setObject(`${root}.info.socketConnected`, true);
    cm.setObject('system.adapter.ocpp21.0.alive', true);
    await cm.tick();
    assert.equal(cm.writes.filter(write => write.key.startsWith('cm.wb.lp1.')).length, 0,
        JSON.stringify(cm.writes.filter(write => write.key.startsWith('cm.wb.lp1.'))));
});

test('license capacity exposes pending stations, retains existing mappings and fills a newly available slot', () => {
    const inv = inventory(); const manual = { enabled: false, powerId: 'manual.0.power', maxA: 13 };
    const config = { settingsConfig: { evcsCount: 1, evcsList: [manual] } };
    const full = planOcppDiscovery(config, inv.stations(), { maxRows: 1 });
    assert.equal(full.changed, false); assert.equal(full.statuses[0].code, 'LICENSE_LIMIT'); assert.equal(full.statuses[0].rowIndex, null);
    assert.deepEqual(config.settingsConfig.evcsList, [manual]);
    const upgraded = planOcppDiscovery(config, inv.stations(), { maxRows: 2 });
    assert.equal(upgraded.patch.settingsConfig.evcsList.length, 2); assert.deepEqual(upgraded.patch.settingsConfig.evcsList[0], manual);
    assert.equal(upgraded.patch.settingsConfig.evcsList[1].enabled, false);
    const downgraded = planOcppDiscovery(upgraded.patch, inv.stations(), { maxRows: 1 });
    assert.equal(downgraded.changed, false, 'discovery never trims saved rows on a license reduction');
});

test('registration bursts, offline and restart are idempotent; concurrent manual saves share the mutation fence', async t => {
    const h = await runtimeFixture(t); const inv = inventory(); let scans = 0, parallel = 0, maxParallel = 0;
    const make = () => new OcppAutoDiscovery({ readObjects: async () => { scans++; return inv.objects; }, readMetadata: async () => inv.states,
        subscribe: async () => {}, canRun: () => true, warn() {},
        reconcile: async stations => { parallel++; maxParallel = Math.max(maxParallel, parallel); try { return await h.a.reconcileOcppDiscovery(stations); } finally { parallel--; } } });
    const service = make(); t.after(() => service.stop());
    await service.start();
    await Promise.all(Array.from({ length: 20 }, () => service.refresh()));
    assert.equal(maxParallel, 1); assert.equal(h.applies.length, 1); assert.equal(h.persisted().settingsConfig.evcsList.length, 1);
    const lock = h.a._nwBeginInstallerConfigMutation();
    await service.refresh(); assert.equal(service.status().error, 'EOS_OCPP_DISCOVERY_BUSY');
    h.a._nwEndInstallerConfigMutation(lock);
    inv.states[`${root}.info.socketConnected`].val = false;
    await service.refresh(); assert.equal(service.status().state, 'ready'); assert.equal(h.applies.length, 1);
    await service.stop();
    const restarted = make(); t.after(() => restarted.stop()); await restarted.start();
    assert.equal(h.applies.length, 1); assert.equal(h.persisted().settingsConfig.evcsList.length, 1);
    assert.ok(scans < 10, 'event bursts are coalesced into bounded scans');
    const saved = h.persisted();
    assert.throws(() => assertInstallerRevision(undefined, saved), error => error.code === 'EOS_INSTALLER_CONFIG_CHANGED');
    assert.throws(() => assertInstallerRevision(installerRevision({}), saved), error => error.code === 'EOS_INSTALLER_CONFIG_CHANGED');
    assert.doesNotThrow(() => assertInstallerRevision(installerRevision(saved), saved));
});

test('persist failures keep prior configuration; failed runtime apply is retried without creating a second row', async t => {
    const h = await runtimeFixture(t); const stations = inventory().stations();
    const persist = h.a.persistInstallerConfigToState.bind(h.a);
    h.a.persistInstallerConfigToState = async () => false;
    await assert.rejects(h.a.reconcileOcppDiscovery(stations), /EOS_OCPP_DISCOVERY_PERSIST_FAILED/);
    assert.deepEqual(h.a.config.settingsConfig.evcsList, []); assert.equal(h.applies.length, 0);
    h.a.persistInstallerConfigToState = persist;
    const apply = h.a._nwApplyInstallerRuntime.bind(h.a);
    h.a._nwApplyInstallerRuntime = async () => { throw new Error('fixture application failure'); };
    await assert.rejects(h.a.reconcileOcppDiscovery(stations), /fixture application failure/);
    assert.equal(h.persisted().settingsConfig.evcsList.length, 1); assert.equal(h.a._nwOcppApplyPending, true);
    h.a._nwApplyInstallerRuntime = apply;
    const result = await h.a.reconcileOcppDiscovery(stations);
    assert.equal(result.changed, false); assert.equal(h.a._nwOcppApplyPending, false); assert.equal(h.applies.length, 1);
});

test('stop during discovery cannot commit a late scan', async () => {
    const inv = inventory(); let release, reconciles = 0;
    const gate = new Promise(resolve => { release = resolve; });
    const service = new OcppAutoDiscovery({ readObjects: () => gate, readMetadata: async () => inv.states,
        subscribe: async () => {}, canRun: () => true, warn() {}, reconcile: async () => { reconciles++; return { changed: false, patch: {}, statuses: [] }; } });
    const starting = service.start(); await new Promise(resolve => setImmediate(resolve));
    const stopping = service.stop(); release(inv.objects); await starting; await stopping;
    assert.equal(reconciles, 0); assert.equal(service.status().state, 'stopped');
});

test('ownership loss after a database read prevents reconciliation and leaves existing configuration untouched', async () => {
    const inv = inventory(); let allowed = true, reconciles = 0;
    const service = new OcppAutoDiscovery({ readObjects: async () => { allowed = false; return inv.objects; }, readMetadata: async () => inv.states,
        subscribe: async () => {}, canRun: () => allowed, warn() {}, reconcile: async () => { reconciles++; return { changed: false, patch: {}, statuses: [] }; } });
    await service.start(); assert.equal(reconciles, 0); await service.stop();
});

test('actual supplied OCPP adapter registration and station telemetry map through the real EOS persistence path',
    { skip: !process.env.EOS_TEST_OCPP21_MAIN }, async t => {
        const file = path.resolve(process.env.EOS_TEST_OCPP21_MAIN);
        const subject = new Module(file, module); subject.filename = file; subject.paths = Module._nodeModulePaths(path.dirname(file));
        const requireOriginal = subject.require.bind(subject);
        subject.require = id => id === '@iobroker/adapter-core' ? { Adapter: class { on() {} } }
            : id === './ocpp/server' ? { OcppRpcServer: class {} } : requireOriginal(id);
        subject._compile(fs.readFileSync(file, 'utf8'), file);
        const adapter = subject.exports({}); const objects = {}, states = {};
        const h = await runtimeFixture(t);
        const subscriptions = [];
        h.owner.getForeignObjectsAsync = async (pattern, type) => {
            assert.ok(['ocpp21.*', 'eos-admin.0.ocpp.*'].includes(pattern)); assert.equal(type, 'state');
            if (pattern !== 'ocpp21.*') return {};
            return Object.fromEntries(Object.entries(objects).filter(([_id, object]) => object.type === 'state'));
        };
        h.owner.getForeignStatesAsync = async pattern => {
            assert.ok(['ocpp21.*.info.*', 'eos-admin.0.ocpp.*.info.*'].includes(pattern));
            if (pattern !== 'ocpp21.*.info.*') return {};
            return Object.fromEntries(Object.entries(states).filter(([id]) => id.includes('.info.')));
        };
        h.owner.subscribeForeignStatesAsync = async pattern => { subscriptions.push(pattern); };
        h.a._nwStartOcppAutoDiscovery();
        await h.a._ocppAutoDiscovery.refresh();
        assert.equal(h.a._ocppAutoDiscovery.status().stations.length, 0);
        adapter.namespace = 'ocpp21.0'; adapter.config = { connectorDetails: true, maxDatapointsPerStation: 5000 };
        adapter.log = { info() {}, debug() {}, warn() {}, error() {} };
        adapter.setObjectNotExistsAsync = async (id, object) => { objects[`ocpp21.0.${id}`] ||= { ...object, _id: `ocpp21.0.${id}` }; };
        adapter.extendObjectAsync = async (id, patch) => { const key = `ocpp21.0.${id}`; const old = objects[key] || {}; objects[key] = { ...old, ...patch, _id: key, common: { ...old.common, ...patch.common }, native: { ...old.native, ...patch.native } }; };
        adapter.getObjectAsync = async id => objects[`ocpp21.0.${id}`] || null;
        adapter.getStateAsync = async id => states[`ocpp21.0.${id}`] || null;
        adapter.setStateAsync = async (id, state) => { states[`ocpp21.0.${id}`] = { ...state, ts: Date.now(), q: 0 }; };
        const entry = { proto: 'ocpp2.0.1', rawIdentity: 'ENERGYLINE', connectors: new Set(['1:1','2:1']), socketConnected: true, client: {}, lastMessageAt: Date.now() };
        adapter.runtimeIndex.set('ENERGYLINE', entry);
        const telemetry = adapter._getStationTelemetry('ENERGYLINE', entry);
        telemetry.meter(1, 1, { powerW: { val: 2000, category: 'realtime' } }, Date.now(), Date.now());
        telemetry.meter(2, 1, { powerW: { val: 3000, category: 'realtime' } }, Date.now(), Date.now());
        await adapter.ensureStructure('ENERGYLINE', 1, 1); await adapter.ensureStructure('ENERGYLINE', 2, 1);
        await adapter._publishStationTelemetry('ENERGYLINE', entry);
        const stations = collectOcppStations(objects, states);
        assert.equal(stations.length, 1); assert.deepEqual(stations[0].missing, []);
        assert.equal(stations[0].connectorCount, 2); assert.equal(states[`${root}.measurements.powerW`].val, 5000);
        h.a.onStateChange(`${root}.info.eosContract`, states[`${root}.info.eosContract`]);
        const deadline = Date.now() + 2000;
        while (!h.states.has('eos-admin.0.installer.configJson') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
        assert.ok(subscriptions.includes('ocpp21.*.info.*'));
        const row = h.persisted().settingsConfig.evcsList[0];
        assert.equal(row.setPowerWId, `${root}.control.chargeLimit`); assert.equal(row.ocppDiscovery.connectorCount, 2);
        assert.equal(row.enabled, false); assert.equal(row.ocppDiscovery.controlScope, 'station');
    });

test('embedded OCPP station registration persists hosted mappings and retains them across bursts and runtime restart', async t => {
        const root = 'eos-admin.0.ocpp.ENERGYLINE';
        const Adapter = require('../modules/ocpp/runtime').createOcppRuntime(class { on() {} });
        const adapter = new Adapter({}); const objects = {}, states = {};
        const h = await runtimeFixture(t);
        const subscriptions = [];
        h.owner.getForeignObjectsAsync = async (pattern, type) => {
            assert.ok(['ocpp21.*', 'eos-admin.0.ocpp.*'].includes(pattern)); assert.equal(type, 'state');
            if (pattern !== 'eos-admin.0.ocpp.*') return {};
            return Object.fromEntries(Object.entries(objects).filter(([_id, object]) => object.type === 'state'));
        };
        h.owner.getForeignStatesAsync = async pattern => {
            assert.ok(['ocpp21.*.info.*', 'eos-admin.0.ocpp.*.info.*'].includes(pattern));
            if (pattern !== 'eos-admin.0.ocpp.*.info.*') return {};
            return Object.fromEntries(Object.entries(states).filter(([id]) => id.includes('.info.')));
        };
        h.owner.subscribeForeignStatesAsync = async pattern => { subscriptions.push(pattern); };
        h.a._nwStartOcppAutoDiscovery();
        await h.a._ocppAutoDiscovery.refresh();
        assert.equal(h.a._ocppAutoDiscovery.status().stations.length, 0);
        adapter.namespace = 'eos-admin.0.ocpp'; adapter.config = { connectorDetails: true, maxDatapointsPerStation: 5000 };
        adapter.log = { info() {}, debug() {}, warn() {}, error() {} };
        adapter.setObjectNotExistsAsync = async (id, object) => { objects[`eos-admin.0.ocpp.${id}`] ||= { ...object, _id: `eos-admin.0.ocpp.${id}` }; };
        adapter.extendObjectAsync = async (id, patch) => { const key = `eos-admin.0.ocpp.${id}`; const old = objects[key] || {}; objects[key] = { ...old, ...patch, _id: key, common: { ...old.common, ...patch.common }, native: { ...old.native, ...patch.native } }; };
        adapter.getObjectAsync = async id => objects[`eos-admin.0.ocpp.${id}`] || null;
        adapter.getStateAsync = async id => states[`eos-admin.0.ocpp.${id}`] || null;
        adapter.setStateAsync = async (id, state) => { states[`eos-admin.0.ocpp.${id}`] = { ...state, ts: Date.now(), q: 0 }; };
        const entry = { proto: 'ocpp2.0.1', rawIdentity: 'ENERGYLINE', connectors: new Set(['1:1','2:1']), socketConnected: true, client: {}, lastMessageAt: Date.now() };
        adapter.runtimeIndex.set('ENERGYLINE', entry);
        const telemetry = adapter._getStationTelemetry('ENERGYLINE', entry);
        telemetry.meter(1, 1, { powerW: { val: 2000, category: 'realtime' } }, Date.now(), Date.now());
        telemetry.meter(2, 1, { powerW: { val: 3000, category: 'realtime' } }, Date.now(), Date.now());
        await adapter.ensureStructure('ENERGYLINE', 1, 1); await adapter.ensureStructure('ENERGYLINE', 2, 1);
        await adapter._publishStationTelemetry('ENERGYLINE', entry);
        const stations = collectOcppStations(objects, states, 'eos-admin.0');
        assert.equal(stations.length, 1); assert.deepEqual(stations[0].missing, []);
        assert.equal(stations[0].connectorCount, 2); assert.equal(states[`${root}.measurements.powerW`].val, 5000);
        h.a.onStateChange(`${root}.info.eosContract`, states[`${root}.info.eosContract`]);
        const deadline = Date.now() + 2000;
        while (!h.states.has('eos-admin.0.installer.configJson') && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
        assert.ok(subscriptions.includes('eos-admin.0.ocpp.*.info.*'));
        assert.ok(subscriptions.includes('ocpp21.*.info.*'));
        const row = h.persisted().settingsConfig.evcsList[0];
        assert.equal(row.setPowerWId, `${root}.control.chargeLimit`); assert.equal(row.ocppDiscovery.connectorCount, 2);
        assert.equal(row.enabled, false); assert.equal(row.ocppDiscovery.controlScope, 'station');
        assert.equal(row.maxPowerW, undefined); assert.equal(row.minPowerW, undefined);
        assert.equal(stations[0].adapterInstance, 'eos-admin.0.ocpp');
        const wallbox = EmsEngine.prototype._buildChargingConfig.call({ adapter: h.a }).chargingCfg.wallboxes[0];
        assert.equal(wallbox.actualPowerWId, `${root}.measurements.powerW`);
        assert.equal(wallbox.setPowerWId, `${root}.control.chargeLimit`);
        assert.equal(wallbox.ocppDiscovery.stationRoot, root); assert.equal(wallbox.enabled, false);
        const cm = makeHarness({ wallbox, userMode: 'pv', status: 'Charging', actualPowerW: 5000 });
        cm.adapter.hostNamespace = 'eos-admin.0'; t.after(() => cm.stop());
        for (const key of ['_publishChargingAllocationTsShadow', '_publishChargingPhaseSelectionRuntimeStates', '_publishChargingStationDiagnosticsFromAllocationPlan']) delete cm.module[key];
        cm.setObject('eos-admin.0.ocpp.info.runtimeAlive', true); cm.setObject(`${root}.info.socketConnected`, true);
        await cm.tick();
        assert.equal(cm.writes.some(write => write.value > 0 && /\.set[WA]$/.test(write.key)), false);
        const appliedCount = h.applies.length;
        await Promise.all(Array.from({ length: 30 }, () => h.a._ocppAutoDiscovery.refresh()));
        assert.equal(h.applies.length, appliedCount); assert.equal(h.persisted().settingsConfig.evcsList.length, 1);
        await h.a._ocppAutoDiscovery.stop(); h.a._ocppAutoDiscovery = null;
        h.a._nwStartOcppAutoDiscovery(); await h.a._ocppAutoDiscovery.refresh();
        assert.equal(h.applies.length, appliedCount); assert.equal(h.persisted().settingsConfig.evcsList.length, 1);
    });

test('discovery scopes hosted trees to the owning EOS and retains legacy migration identities', async t => {
    const hosted = inventory('eos-admin.0.ocpp.ENERGYLINE'); const foreign = inventory('eos-admin.1.ocpp.FOREIGN'); const legacy = inventory();
    const objects = { ...hosted.objects, ...foreign.objects, ...legacy.objects };
    const states = { ...hosted.states, ...foreign.states, ...legacy.states };
    assert.deepEqual(collectOcppStations(objects, states).map(s => s.root), [root]);
    const allowed = collectOcppStations(objects, states, 'eos-admin.0');
    assert.deepEqual(allowed.map(s => s.root), ['eos-admin.0.ocpp.ENERGYLINE', root]);
    assert.deepEqual(collectOcppStations(objects, states, 'eos-admin.*').map(s => s.root), [root]);
    const config = { settingsConfig: { evcsCount: 1, evcsList: [{ enabled: true, setPowerWId: `${root}.control.chargeLimit`, maxA: 13 }] } };
    const migrated = planOcppDiscovery(config, collectOcppStations(legacy.objects, legacy.states, 'eos-admin.0'));
    assert.equal(migrated.patch.settingsConfig.evcsList.length, 1);
    assert.equal(migrated.patch.settingsConfig.evcsList[0].setPowerWId, `${root}.control.chargeLimit`);
    assert.equal(migrated.patch.settingsConfig.evcsList[0].maxA, 13);
    let scans = 0;
    const service = new OcppAutoDiscovery({ hostNamespace: 'eos-admin.0', readObjects: async () => { scans++; return objects; },
        readMetadata: async () => states, subscribe: async () => {}, canRun: () => true, warn() {}, debounceMs: 1,
        reconcile: async stations => planOcppDiscovery({}, stations) });
    t.after(() => service.stop()); await service.start(); const before = scans;
    service.onStateChange('eos-admin.1.ocpp.FOREIGN.info.eosContract', { val: OCPP_NATIVE_CONTRACT, ack: true });
    await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(scans, before);
    service.onStateChange('eos-admin.0.ocpp.ENERGYLINE.info.eosContract', { val: OCPP_NATIVE_CONTRACT, ack: true });
    await new Promise(resolve => setTimeout(resolve, 5)); assert.ok(scans > before);
});
