/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { collectOcppStations, filterOcppDiscoverySources, planOcppDiscovery, OCPP_NATIVE_CONTRACT } = require('../ui/lib/ocpp-auto-discovery');

function inventory(root) {
    const objects = {}, states = {};
    for (const [suffix, type, unit, write, value] of [
        ['info.eosContract', 'string', '', false, OCPP_NATIVE_CONTRACT],
        ['info.deviceType', 'string', '', false, 'evCharger'],
        ['info.identity', 'string', '', false, 'ENERGYLINE'],
        ['info.status', 'string'], ['info.socketConnected', 'boolean', '', false, false],
        ['measurements.powerW', 'number', 'W'], ['measurements.energyKWh', 'number', 'kWh'],
        ['health.lastSeenMs', 'number'], ['health.dataFresh', 'boolean'],
        ['control.chargeLimit', 'number', 'W', true], ['control.availability', 'boolean', '', true],
        ['control.appliedChargeLimitW', 'number', 'W'], ['control.appliedChargeLimitValid', 'boolean'],
    ]) {
        const id = `${root}.${suffix}`;
        objects[id] = { _id: id, type: 'state', common: { type, read: true, write: write === true, ...(unit ? { unit } : {}) } };
        if (value !== undefined) states[id] = { val: value, ack: true, q: 0, ts: Date.now() };
    }
    return { objects, states };
}
async function fixture(t, inventories, instances = []) {
    const h = await createHarness();
    const objects = Object.assign({}, ...inventories.map(item => item.objects));
    const states = Object.assign({}, ...inventories.map(item => item.states));
    h.owner.getForeignObjectsAsync = async (pattern, type) => {
        assert.equal(type, 'state');
        return Object.fromEntries(Object.entries(objects).filter(([id]) => id.startsWith(pattern.split('*')[0])));
    };
    h.owner.getForeignStatesAsync = async pattern => Object.fromEntries(Object.entries(states).filter(([id]) => id.startsWith(pattern.split('*')[0])));
    h.owner.getObjectViewAsync = async (design, search, range) => {
        assert.equal(design, 'system'); assert.equal(search, 'instance');
        assert.equal(range.startkey, 'system.adapter.ocpp21.');
        return { rows: instances.map(namespace => ({ value: { _id: `system.adapter.${namespace}`, type: 'instance', common: { enabled: false } } })) };
    };
    const token = await h.login('installer');
    t.after(() => h.close());
    return { ...h, objects, states, get: () => h.request('/api/ocpp/discover', { token }) };
}

test('manual discovery and automatic registration both ignore retained states of a deleted standalone source', async t => {
    const old = inventory('ocpp21.0.ENERGYLINE');
    const current = inventory('eos-admin.0.ocpp.ENERGYLINE');
    const foreign = inventory('eos-admin.1.ocpp.ENERGYLINE');
    const h = await fixture(t, [old, current, foreign]);
    const before = structuredClone({ objects: h.objects, states: h.states });
    for (let repeat = 0; repeat < 3; repeat++) {
        const response = await h.get();
        assert.equal(response.status, 200);
        assert.equal(response.data.connectorCount, 1);
        assert.equal(response.data.connectors[0].base, 'eos-admin.0.ocpp.ENERGYLINE');
        assert.equal(response.data.connectors[0].ids.setPowerWId, 'eos-admin.0.ocpp.ENERGYLINE.control.chargeLimit');
        assert.equal(response.data.connectors[0].ids.appliedChargeLimitValidId, 'eos-admin.0.ocpp.ENERGYLINE.control.appliedChargeLimitValid');
    }
    const stations = filterOcppDiscoverySources(collectOcppStations(h.objects, h.states, 'eos-admin.0'), { instances: { rows: [] } }, 'eos-admin.0');
    const plan = planOcppDiscovery({ settingsConfig: { evcsCount: 0, evcsList: [] } }, stations);
    assert.equal(plan.patch.settingsConfig.evcsCount, 1);
    assert.equal(plan.patch.settingsConfig.evcsList.length, 1);
    assert.deepEqual({ objects: h.objects, states: h.states }, before, 'scanning never mutates OCPP source objects or sends commands');
});

test('automatic discovery leaves station and group assignment manual while remaining idempotent', () => {
    const input = inventory('eos-admin.0.ocpp.ENERGYLINE');
    const stations = collectOcppStations(input.objects, input.states, 'eos-admin.0');
    const initial = { settingsConfig: { evcsCount: 0, evcsList: [], stationGroups: [{ stationKey: 'manual', name: 'Carport' }] },
        dcStationDisplay: { stations: [{ id: 'station1', assignedChargepoints: [] }] } };
    const first = planOcppDiscovery(initial, stations);
    const row = first.patch.settingsConfig.evcsList[0];
    assert.equal(row.stationKey, undefined);
    assert.equal(row.ocppDiscovery.stationRoot, 'eos-admin.0.ocpp.ENERGYLINE');
    assert.equal(row.enabled, false, 'electrical parameters are not attested by discovery');
    assert.deepEqual(first.patch.settingsConfig.stationGroups, initial.settingsConfig.stationGroups);
    assert.equal(first.patch.dcStationDisplay, undefined);
    assert.equal(planOcppDiscovery(first.patch, stations).changed, false);
    const manual = { settingsConfig: { ...first.patch.settingsConfig, evcsList: [{ ...row, stationKey: 'manual', enabled: true, maxPowerW: 11000, phases: 3 }] } };
    assert.equal(planOcppDiscovery(manual, stations).changed, true, 'commissioning status may change after an explicit enable');
    const updated = planOcppDiscovery(manual, stations).patch.settingsConfig.evcsList[0];
    assert.equal(updated.stationKey, 'manual'); assert.equal(updated.maxPowerW, 11000); assert.equal(updated.phases, 3);
});

test('manual discovery validates units and contract values just like the automatic collector', async t => {
    const valid = inventory('eos-admin.0.ocpp.VALID');
    const invalid = inventory('eos-admin.0.ocpp.INVALID');
    invalid.states['eos-admin.0.ocpp.INVALID.info.eosContract'].q = 64;
    valid.objects['eos-admin.0.ocpp.VALID.control.chargeLimit'].common.unit = 'A';
    const h = await fixture(t, [valid, invalid]);
    const response = await h.get();
    assert.equal(response.status, 200); assert.equal(response.data.connectorCount, 1);
    const row = response.data.connectors[0];
    assert.equal(row.base, 'eos-admin.0.ocpp.VALID');
    assert.equal(row.ids.setPowerWId, undefined);
    assert.ok(row.missing.includes('setPowerWId'));
    assert.equal(row.ocppDiscovery.code, 'CONTRACT_INCOMPLETE');
});

test('still configured standalone sources remain distinct even when offline or using the same device name', async t => {
    const old = inventory('ocpp21.0.ENERGYLINE');
    const current = inventory('eos-admin.0.ocpp.ENERGYLINE');
    const h = await fixture(t, [old, current], ['ocpp21.0']);
    const response = await h.get();
    assert.equal(response.status, 200); assert.equal(response.data.connectorCount, 2);
    assert.deepEqual(response.data.connectors.map(row => row.base).sort(), ['eos-admin.0.ocpp.ENERGYLINE', 'ocpp21.0.ENERGYLINE']);
});

test('a hosted preserved namespace does not rediscover retained objects in the unused default tree', async t => {
    const preserved = inventory('ocpp21.0.ENERGYLINE');
    const retiredDefault = inventory('eos-admin.0.ocpp.ENERGYLINE');
    const h = await fixture(t, [preserved, retiredDefault]);
    h.bridge.getRuntimeReadiness = () => ({ hostedOcppNamespace: 'ocpp21.0' });
    const response = await h.get();
    assert.equal(response.status, 200); assert.equal(response.data.connectorCount, 1);
    assert.equal(response.data.connectors[0].base, 'ocpp21.0.ENERGYLINE');
    const source = { instances: { rows: [] }, hostedNamespace: 'ocpp21.0' };
    assert.deepEqual(filterOcppDiscoverySources(collectOcppStations(h.objects, h.states, 'eos-admin.0'), source, 'eos-admin.0')
        .map(station => station.root), ['ocpp21.0.ENERGYLINE']);
});
