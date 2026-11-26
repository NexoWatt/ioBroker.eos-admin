'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { planDeviceEms } = require('../src/lib/eosDeviceEmsPlan');

function wallbox(namespace = 'eos-admin.0', requestId) {
    const baseId = `${namespace}.devices.building.wallbox`;
    const device = { baseId, devId: 'building.wallbox', name: 'Wallbox', templateId: 'test-wallbox',
        protocol: 'modbusTcp', deviceClass: 'evCharger', enabled: true, ems: { mode: 'auto' }, aliasMeta: {} };
    if (requestId) device.ems.activation = { requested: true, requestId, limits: {} };
    for (const [key, type, unit, write] of [
        ['r.power', 'number', 'W', false], ['r.online', 'boolean', '', false],
        ['ctrl.currentLimitA', 'number', 'A', true],
    ]) device.aliasMeta[key] = { id: `${baseId}.aliases.v1.${key}`, type, unit, read: !write, write };
    return device;
}
const plan = (config, devices, extra = {}) => planDeviceEms({ config, devices,
    limits: { chargePoints: 50, batteries: 20 }, ...extra });
function remove(config) {
    const next = structuredClone(config);
    next.settingsConfig.evcsList = [];
    next.settingsConfig.evcsCount = 0;
    return next;
}

for (const namespace of ['eos-admin.0', 'nexowatt-devices.3']) {
    test(`saved device chargepoint removal survives events and serialized restart in ${namespace}`, () => {
        const device = wallbox(namespace);
        const initial = plan({}, [device]);
        assert.equal(initial.config.settingsConfig.evcsList.length, 1);
        assert.equal(plan(initial.config, [device]).changed, false);
        let saved = remove(initial.config);
        for (let attempt = 0; attempt < 5; attempt++) {
            const next = plan(JSON.parse(JSON.stringify(saved)), [device]);
            assert.equal(next.changed, false);
            assert.equal(next.config.settingsConfig.evcsCount, 0);
            assert.deepEqual(next.config.settingsConfig.evcsList, []);
            assert.equal(next.statuses[0].code, 'MAPPING_REMOVED');
            assert.equal(next.statuses[0].activationApplied, false);
            saved = next.config;
        }
    });
}

test('an incomplete original activation request cannot recreate a removed chargepoint', () => {
    const device = wallbox('eos-admin.0', 'request-original-0001');
    const first = plan({}, [device]);
    assert.equal(first.statuses[0].code, 'ACTIVATION_PENDING');
    assert.equal(first.config.eosDeviceEms.bindings[device.baseId].activationRequestId, undefined);
    const saved = remove(first.config);
    const replay = plan(saved, [device]);
    assert.equal(replay.changed, false);
    assert.deepEqual(replay.config.settingsConfig.evcsList, []);
    assert.equal(replay.statuses[0].code, 'MAPPING_REMOVED');
    const explicit = structuredClone(device);
    explicit.ems.activation.requestId = 'request-renewed-0002';
    const restored = plan(saved, [explicit]);
    assert.equal(restored.config.settingsConfig.evcsList.length, 1);
    assert.equal(restored.config.settingsConfig.evcsList[0].enabled, false, 'new assignment does not bypass required commissioning limits');
    assert.equal(restored.statuses[0].code, 'ACTIVATION_PENDING');
    assert.equal(plan(restored.config, [explicit]).changed, false, 'repeated explicit save is still idempotent');
});

test('legacy missing-row bindings without a mapping checkpoint conservatively record the current request once', () => {
    const device = wallbox('eos-admin.0', 'legacy-pending-request');
    const saved = remove(plan({}, [device]).config);
    delete saved.eosDeviceEms.bindings[device.baseId].mappingRequestId;
    const migration = plan(saved, [device]);
    assert.deepEqual(migration.config.settingsConfig.evcsList, []);
    assert.equal(migration.statuses[0].code, 'MAPPING_REMOVED');
    assert.equal(migration.config.eosDeviceEms.bindings[device.baseId].mappingRequestId, device.ems.activation.requestId);
    assert.equal(plan(migration.config, [device]).changed, false);
    const explicit = structuredClone(device);
    explicit.ems.activation.requestId = 'new-explicit-request';
    assert.equal(plan(migration.config, [explicit]).config.settingsConfig.evcsList.length, 1);
});

test('legacy removal checkpoints a pending request even when an older activation was already consumed', () => {
    const device = wallbox('eos-admin.0', 'pending-request-0002');
    const saved = remove(plan({}, [device]).config);
    const binding = saved.eosDeviceEms.bindings[device.baseId];
    delete binding.mappingRequestId;
    binding.activationRequestId = 'consumed-request-0001';
    const migrated = plan(saved, [device]);
    assert.equal(migrated.statuses[0].code, 'MAPPING_REMOVED');
    assert.deepEqual(migrated.config.settingsConfig.evcsList, []);
    assert.equal(migrated.config.eosDeviceEms.bindings[device.baseId].mappingRequestId, 'pending-request-0002');
    assert.equal(migrated.config.eosDeviceEms.bindings[device.baseId].activationRequestId, 'consumed-request-0001');
    const restarted = plan(JSON.parse(JSON.stringify(migrated.config)), [device]);
    assert.equal(restarted.changed, false);
    assert.equal(restarted.statuses[0].code, 'MAPPING_REMOVED');
    const explicit = structuredClone(device);
    explicit.ems.activation.requestId = 'explicit-request-0003';
    assert.equal(plan(restarted.config, [explicit]).config.settingsConfig.evcsList.length, 1);
});

test('discovery never assigns a station and preserves manually configured groups', () => {
    const device = wallbox();
    const config = { settingsConfig: { stationGroups: [{ stationKey: 'manual-group', name: 'Kundenparkplatz', maxPowerKw: 22 }] },
        stationDisplay: { stations: [{ id: 'display-1', assignedChargepoints: [] }] } };
    const first = plan(config, [device]);
    const row = first.config.settingsConfig.evcsList[0];
    assert.equal(row.stationKey, undefined);
    assert.deepEqual(first.config.settingsConfig.stationGroups, config.settingsConfig.stationGroups);
    assert.deepEqual(first.config.stationDisplay, config.stationDisplay);
    row.stationKey = 'manual-group';
    const repeated = plan(first.config, [device]);
    assert.equal(repeated.changed, false);
    assert.equal(repeated.config.settingsConfig.evcsList[0].stationKey, 'manual-group');
});

test('Devices does not add another controller when its alias resolves to an already mapped native OCPP command', () => {
    const device = wallbox();
    const command = 'eos-admin.0.ocpp.wallbox.control.chargeLimit';
    device.aliasMeta['ctrl.currentLimitA'].targetId = command;
    const config = { settingsConfig: { evcsCount: 1, evcsList: [{ name: 'OCPP-Wallbox', enabled: true,
        setPowerWId: command, powerId: 'eos-admin.0.ocpp.wallbox.measurements.powerW',
        stationKey: 'manuell' }] } };
    const result = plan(config, [device]);
    assert.deepEqual(result.config, config);
    assert.equal(result.statuses[0].code, 'CONTROL_TARGET_ALREADY_ASSIGNED');
    assert.equal(result.config.settingsConfig.evcsList.length, 1);
});
