'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { planDeviceEms, getDeviceEmsReferences } = require('../src/lib/eosDeviceEmsPlan');

const limits = { chargePoints: 50, batteries: 20 };
function inventory(id = 'wallbox1', deviceClass = 'evCharger', ems = { mode: 'auto' }) {
    const baseId = `eos-admin.0.devices.${id}`;
    return { baseId, devId: id, name: 'Kundenanlage', deviceClass, enabled: true, ems, aliasMeta: {} };
}
function add(dev, key, type = 'number', unit = '', write = false, targetId) {
    const id = `${dev.baseId}.aliases.v1.${key}`;
    dev.aliasMeta[key] = { id, type, unit, read: !write, write, ...(targetId ? { targetId } : {}) };
    return id;
}
function wallbox(id) {
    const d = inventory(id);
    add(d, 'r.power', 'number', 'W');
    add(d, 'r.energyTotal', 'number', 'Wh');
    add(d, 'r.online', 'boolean');
    add(d, 'r.mode3State', 'string');
    add(d, 'r.charging', 'boolean');
    add(d, 'ctrl.currentLimitA', 'number', 'A', true);
    return d;
}
function storage(id, mode) {
    const d = inventory(id, 'storageSystem', { mode, scope: 'M0' });
    add(d, 'r.soc', 'number', '%');
    add(d, 'r.power', 'number', 'W');
    add(d, 'ctrl.powerSetpointW', 'number', 'W', true);
    add(d, 'ctrl.chargePowerW', 'number', 'W', true);
    add(d, 'ctrl.dischargePowerW', 'number', 'W', true);
    return d;
}
function homeStorage(mode = 'storageFarm') {
    const d = inventory('home', 'storageSystem', { mode, scope: 'M0' });
    d.templateId = 'ess.fenecon.FeneconHomeEssImpl';
    add(d, 'r.soc', 'number', '%');
    for (const [key, source] of Object.entries({
        'r.essActivePower': 'eSS0_ACTIVE_POWER', 'r.nvpPower': 'gRID_POWER', 'r.consumptionTotal': 'lOAD_POWER',
        'r.minPowerSetpointW': 'mIN_POWER_SETPOINT', 'r.maxPowerSetpointW': 'mAX_POWER_SETPOINT',
        'r.pvPowerDc': 'pV_DC_POWER', 'r.pvPowerAc': 'pV_AC_POWER', 'r.pvPowerTotal': 'pV_POWER_SUM',
        'ctrl.powerSetpointW': 'sET_ACTIVE_POWER', 'ctrl.gridSetpointW': 'sET_GRID_ACTIVE_POWER',
    })) add(d, key, 'number', 'W', key.startsWith('ctrl.'), `${d.baseId}.${source}`);
    add(d, 'r.powerAc', 'number', 'W', false, `${d.baseId}.bATTERY_AC_POWER`);
    return d;
}
function plan(config, devices, options = {}) { return planDeviceEms({ config, devices, limits, ...options }); }

test('new wallbox is immediately registered with canonical aliases, held inactive, and does not enable an app', () => {
    const d = wallbox();
    const original = { emsApps: { apps: { chargingManagement: { installed: true, enabled: true } } }, custom: { preserved: [1, 2, 3] } };
    const saved = structuredClone(original);
    const result = plan(original, [d]);
    assert.deepEqual(original, saved);
    assert.deepEqual(result.config.emsApps, original.emsApps);
    assert.deepEqual(result.config.custom, original.custom);
    const row = result.config.settingsConfig.evcsList[0];
    assert.equal(row.enabled, false);
    assert.equal(row.powerId, d.aliasMeta['r.power'].id);
    assert.equal(row.setCurrentAId, d.aliasMeta['ctrl.currentLimitA'].id);
    assert.equal(row.energyTotalInputIsWh, true);
    assert.equal(row.chargerType, undefined, 'EV class is insufficient to guess AC versus DC');
    assert.equal(row.chargeDemandId, undefined, 'charging observation is not a vehicle-demand signal');
    assert.equal(result.statuses[0].code, 'COMMISSIONING_REQUIRED');
    assert.equal(result.config.settingsConfig.evcsCount, 1);
});

test('retry and reordered inventory preserve stable identities without duplicated or renamed rows', () => {
    const a = wallbox('a'); const b = wallbox('b');
    const first = plan({}, [b, a]);
    first.config.settingsConfig.evcsList[0].name = 'Individuell';
    first.config.settingsConfig.evcsList[0].maxCurrentA = 14;
    first.config.settingsConfig.evcsList[0].enabled = true;
    const second = plan(first.config, [a, b]);
    assert.equal(second.changed, false);
    assert.deepEqual(second.patch, {});
    assert.equal(second.config.settingsConfig.evcsList.length, 2);
    assert.equal(second.config.settingsConfig.evcsList[0].name, 'Individuell');
    assert.equal(second.config.settingsConfig.evcsList[0].maxCurrentA, 14);
    assert.equal(second.config.settingsConfig.evcsList[0].enabled, true);
});

test('same display name never merges different physical chargers', () => {
    const result = plan({}, [wallbox('a'), wallbox('b')]);
    assert.equal(result.config.settingsConfig.evcsList.length, 2);
});

test('preserved legacy namespace and dotted device IDs remain stable', () => {
    const d = wallbox('building.a');
    d.baseId = d.baseId.replace('eos-admin.0', 'nexowatt-devices.2');
    for (const meta of Object.values(d.aliasMeta)) meta.id = meta.id.replace('eos-admin.0', 'nexowatt-devices.2');
    assert.equal(plan({}, [d]).config.settingsConfig.evcsList[0].powerId, d.aliasMeta['r.power'].id);
});

test('missing or foreign aliases do not invent a mapping or overwrite active settings', () => {
    const d = wallbox();
    const previous = plan({}, [d]).config;
    previous.settingsConfig.evcsList[0].enabled = true;
    d.aliasMeta = {};
    d.discoveryCode = 'MANIFEST_PENDING';
    const pending = plan(previous, [d]);
    assert.equal(pending.changed, false);
    assert.equal(pending.statuses[0].code, 'MANIFEST_PENDING');
    assert.equal(pending.config.settingsConfig.evcsList[0].enabled, true);
    delete d.discoveryCode;
    d.aliasMeta['r.power'] = { id: 'admin.0.connected', type: 'number', unit: 'W', read: true };
    assert.deepEqual(plan({}, [d]).patch, {});
});

test('read-only command or wrong canonical unit is never treated as a writable actuator', () => {
    const d = wallbox();
    d.aliasMeta['ctrl.currentLimitA'].write = false;
    add(d, 'ctrl.targetPowerW', 'number', 'kW', true);
    const result = plan({}, [d]);
    const row = result.config.settingsConfig.evcsList[0];
    assert.equal(row.setCurrentAId, undefined);
    assert.equal(row.setPowerWId, undefined);
    assert.equal(result.statuses[0].code, 'MAPPING_INCOMPLETE');
});

test('mixed manually mapped rows remain untouched instead of joining measurements and writes from different devices', () => {
    const d = wallbox();
    const config = { settingsConfig: { evcsCount: 1, evcsList: [{ name: 'Handzuordnung', powerId: d.aliasMeta['r.power'].id,
        setCurrentAId: 'foreign.0.wallbox.current', enabled: true }] } };
    const result = plan(config, [d]);
    assert.deepEqual(result.config, config);
    assert.equal(result.statuses[0].code, 'MIXED_MANUAL_MAPPING');
});

test('central license bounds refuse only new rows and retain existing customers', () => {
    const a = wallbox('a'); const b = wallbox('b');
    const saved = plan({}, [a]).config;
    const result = plan(saved, [a, b], { limits: { chargePoints: 1, batteries: 0 } });
    assert.deepEqual(result.config, saved);
    assert.equal(result.statuses.find(row => row.devId === 'b').code, 'LICENSE_LIMIT');
    assert.deepEqual(planDeviceEms({ config: {}, devices: [a] }).patch, {});
});

test('own alias variants and resolved manual aliases sharing a command target are rejected', () => {
    const a = wallbox('a'); const b = wallbox('b');
    a.aliasMeta['ctrl.currentLimitA'].targetId = 'modbus.0.control.current';
    b.aliasMeta['ctrl.currentLimitA'].targetId = 'modbus.0.control.current';
    const duplicate = plan({}, [a, b]);
    assert.equal(duplicate.config.settingsConfig.evcsList.length, 1);
    assert.equal(duplicate.statuses[1].code, 'CONTROL_TARGET_ALREADY_ASSIGNED');
    const manual = { settingsConfig: { evcsCount: 1, evcsList: [{ setCurrentAId: 'alias.0.customer.current', enabled: true }] } };
    const result = plan(manual, [a], { writeTargets: { 'alias.0.customer.current': 'modbus.0.control.current' } });
    assert.deepEqual(result.config, manual);
    assert.equal(result.statuses[0].code, 'CONTROL_TARGET_ALREADY_ASSIGNED');
});

test('device disable/removal/monitor keeps mappings and limits, holds owned row inactive, and does not auto-reactivate', () => {
    for (const mode of ['disable', 'remove', 'monitor']) {
        const d = wallbox(); const config = plan({}, [d]).config;
        const row = config.settingsConfig.evcsList[0]; row.enabled = true; row.maxCurrentA = 12;
        if (mode === 'disable') d.enabled = false;
        if (mode === 'monitor') d.ems.mode = 'monitor';
        const result = plan(config, mode === 'remove' ? [] : [d]);
        assert.equal(result.config.settingsConfig.evcsList[0].enabled, false);
        assert.equal(result.config.settingsConfig.evcsList[0].setCurrentAId, row.setCurrentAId);
        assert.equal(result.config.settingsConfig.evcsList[0].maxCurrentA, 12);
        d.enabled = true; d.ems.mode = 'auto';
        assert.equal(plan(result.config, [d]).config.settingsConfig.evcsList[0].enabled, false);
    }
});

test('solar/DC charger is not registered as an EV charging point', () => {
    const d = wallbox(); d.deviceClass = 'solarCharger';
    const result = plan({}, [d]);
    assert.deepEqual(result.patch, {});
    assert.equal(result.statuses[0].code, 'MANUAL_MAPPING');
});

test('single storage and farm use their actual configuration fields and exactly one command family', () => {
    const single = storage('ess', 'singleStorage');
    const s = plan({}, [single]);
    assert.equal(s.config.storage.enabled, false);
    assert.equal(s.config.storage.datapoints.targetPowerObjectId, single.aliasMeta['ctrl.powerSetpointW'].id);
    assert.equal(s.config.storage.datapoints.targetChargePowerObjectId, undefined);
    const farm = storage('farm.ess', 'storageFarm');
    const f = plan({}, [farm]);
    assert.equal(f.config.storageFarm.storages[0].enabled, false);
    assert.equal(f.config.storageFarm.storages[0].setSignedPowerId, farm.aliasMeta['ctrl.powerSetpointW'].id);
    assert.equal(f.config.storageFarm.storages[0].setChargePowerId, undefined);
    assert.equal(plan(f.config, [farm]).changed, false);
});

test('initial single-storage mapping retains previously configured customer limits and vendor settings', () => {
    const d = storage('ess', 'singleStorage');
    const previous = { storage: { enabled: true, vendorProfile: 'generic', minSocPct: 17, maxChargePowerW: 4200,
        customerExtension: { reserve: 123 }, datapoints: {} } };
    const result = plan(previous, [d]);
    assert.equal(result.config.storage.enabled, false, 'new actuator assignment must be commissioned');
    assert.equal(result.config.storage.minSocPct, 17);
    assert.equal(result.config.storage.maxChargePowerW, 4200);
    assert.equal(result.config.storage.vendorProfile, 'generic');
    assert.deepEqual(result.config.storage.customerExtension, { reserve: 123 });
    assert.deepEqual(previous.storage.datapoints, {}, 'input is untouched');
});

test('a physical command target cannot be shared by storage and an existing charging controller', () => {
    const d = storage('ess', 'singleStorage');
    d.aliasMeta['ctrl.powerSetpointW'].targetId = 'modbus.0.shared.write';
    const previous = { settingsConfig: { evcsCount: 1, evcsList: [{ enabled: true, setPowerWId: 'alias.0.old.write' }] } };
    const result = plan(previous, [d], { writeTargets: { 'alias.0.old.write': 'modbus.0.shared.write' } });
    assert.deepEqual(result.config, previous);
    assert.equal(result.statuses[0].code, 'CONTROL_TARGET_ALREADY_ASSIGNED');
});

test('storage assigned to single regulator cannot also become a farm controller implicitly', () => {
    const d = storage('ess', 'singleStorage');
    const config = plan({}, [d]).config;
    d.ems.mode = 'storageFarm';
    const next = plan(config, [d]);
    assert.deepEqual(next.config, config);
    assert.equal(next.statuses[0].code, 'STORAGE_CONTROLLER_ALREADY_ASSIGNED');
});

test('storage control never maps hybrid powerBalance or guesses M1 dispatch', () => {
    const d = storage('ess', 'singleStorage');
    delete d.aliasMeta['r.power'];
    add(d, 'r.powerBalance', 'number', 'W');
    const result = plan({}, [d]);
    assert.equal(result.config.storage.datapoints.batteryPowerObjectId, undefined);
    assert.equal(result.statuses[0].code, 'MAPPING_INCOMPLETE');
    d.ems.scope = 'M1';
    assert.deepEqual(plan({}, [d]).patch, {});
    assert.equal(plan({}, [d]).statuses[0].code, 'MANUAL_TOPOLOGY_REQUIRED');
});

test('verified FENECON Home maps all real farm and single inputs while direct ESS and native FEMS targets stay distinct', () => {
    for (const mode of ['storageFarm', 'singleStorage']) {
        const d = homeStorage(mode); const result = plan({}, [d]);
        const row = mode === 'storageFarm' ? result.config.storageFarm.storages[0] : result.config.storage;
        const dp = mode === 'storageFarm' ? row : row.datapoints;
        const suffix = mode === 'storageFarm' ? 'Id' : 'ObjectId';
        assert.equal(row.vendorProfile, 'fenecon-openems');
        assert.equal(row.coupling, 'dc');
        assert.equal(row.feneconControlMode, 'direct-ess');
        assert.equal(row.enabled, false);
        for (const [stem, alias] of Object.entries({
            feneconEssActualPower: 'r.essActivePower', feneconNvpPower: 'r.nvpPower', feneconConsumptionTotal: 'r.consumptionTotal',
            feneconMinPower: 'r.minPowerSetpointW', feneconMaxPower: 'r.maxPowerSetpointW', feneconPvDc: 'r.pvPowerDc',
            feneconPvAc: 'r.pvPowerAc', feneconPvTotal: 'r.pvPowerTotal', feneconGridSetpoint: 'ctrl.gridSetpointW',
        })) assert.equal(dp[`${stem}${suffix}`], d.aliasMeta[alias].id, stem);
        assert.equal(dp[mode === 'storageFarm' ? 'signedPowerId' : 'batteryPowerObjectId'], d.aliasMeta['r.essActivePower'].id);
        assert.equal(dp[mode === 'storageFarm' ? 'setSignedPowerId' : 'targetPowerObjectId'], d.aliasMeta['ctrl.powerSetpointW'].id);
        assert.equal(dp[mode === 'storageFarm' ? 'pvPowerId' : 'dcPvPowerObjectId'], d.aliasMeta['r.pvPowerDc'].id);
        assert.equal(dp[`feneconActualSetpoint${suffix}`], undefined, 'write-only 706 is not an applied readback');
        assert.deepEqual(result.statuses[0].optionalMissing, [`feneconActualSetpoint${suffix}`]);
        assert.equal(result.statuses[0].code, 'COMMISSIONING_REQUIRED');
        assert.equal(plan(result.config, [d]).changed, false);
    }
});

test('Home native target and ESS feedback need the actual verified source; familiar alias names never promote 706 or 415', () => {
    const d = homeStorage();
    d.aliasMeta['ctrl.gridSetpointW'].targetId = `${d.baseId}.sET_ACTIVE_POWER`;
    d.aliasMeta['r.essActivePower'].targetId = `${d.baseId}.bATTERY_AC_POWER`;
    add(d, 'r.powerSetpointReadbackW', 'number', 'W', false, `${d.baseId}.sET_ACTIVE_POWER`);
    const result = plan({}, [d]); const row = result.config.storageFarm.storages[0];
    assert.equal(row.feneconGridSetpointId, undefined);
    assert.equal(row.feneconEssActualPowerId, undefined);
    assert.equal(row.signedPowerId, undefined);
    assert.equal(row.feneconActualSetpointId, undefined);
    assert.equal(result.statuses[0].code, 'MAPPING_INCOMPLETE');
    assert.ok(result.statuses[0].missing.includes('feneconEssActualPowerId'));
    assert.ok(result.statuses[0].optionalMissing.includes('feneconGridSetpointId'));
});

test('existing Auto direct ESS stays running with its command family; new native target requires explicit review', () => {
    const d = homeStorage(); const saved = plan({}, [d]).config;
    const row = saved.storageFarm.storages[0];
    row.enabled = true; row.feneconControlMode = 'auto'; delete row.feneconGridSetpointId;
    delete row.feneconNvpPowerId;
    const result = plan(saved, [d]); const next = result.config.storageFarm.storages[0];
    assert.equal(next.enabled, true);
    assert.equal(next.feneconControlMode, 'auto');
    assert.equal(next.setSignedPowerId, row.setSignedPowerId);
    assert.equal(next.feneconGridSetpointId, undefined);
    assert.equal(next.feneconNvpPowerId, d.aliasMeta['r.nvpPower'].id, 'read-only diagnostics are still completed');
    assert.ok(result.statuses[0].missing.includes('review:feneconGridSetpointId'));
});

test('FENECON numeric manual DP entry is retained for correction while available read fields are filled', () => {
    const d = homeStorage(); const saved = plan({}, [d]).config;
    const row = saved.storageFarm.storages[0]; row.pvPowerId = '10000'; row.maxChargeW = 7000;
    delete row.feneconPvDcId;
    const result = plan(saved, [d]); const next = result.config.storageFarm.storages[0];
    assert.equal(next.pvPowerId, '10000');
    assert.equal(next.maxChargeW, 7000);
    assert.equal(next.feneconPvDcId, d.aliasMeta['r.pvPowerDc'].id);
    assert.ok(result.statuses[0].missing.includes('invalid:pvPowerId'));
    assert.equal(result.statuses[0].code, 'MAPPING_INCOMPLETE');
    assert.ok(!getDeviceEmsReferences(result.config).read.includes('10000'));
});

test('generic storage uses shared semantic PV and enable aliases without assuming FENECON-only algorithms', () => {
    const d = storage('solax', 'singleStorage'); d.templateId = 'ess.solax.actualProfile';
    add(d, 'r.pvPowerDc', 'number', 'W'); add(d, 'ctrl.chargeEnable', 'boolean', '', true);
    add(d, 'ctrl.dischargeEnable', 'boolean', '', true); add(d, 'r.minPowerSetpointW', 'number', 'W');
    const result = plan({}, [d]); const row = result.config.storage;
    assert.equal(row.datapoints.dcPvPowerObjectId, d.aliasMeta['r.pvPowerDc'].id);
    assert.equal(row.datapoints.chargeEnableObjectId, d.aliasMeta['ctrl.chargeEnable'].id);
    assert.equal(row.datapoints.dischargeEnableObjectId, d.aliasMeta['ctrl.dischargeEnable'].id);
    assert.equal(row.vendorProfile, undefined);
    assert.equal(row.datapoints.feneconMinPowerObjectId, undefined);
    assert.equal(row.enabled, false);
});

test('explicit M0 meter maps signed W and freshness sources without replacing manual NVP', () => {
    const d = inventory('meter', 'meter', { mode: 'gridMeter', scope: 'M0' });
    const power = add(d, 'r.power', 'number', 'W'); add(d, 'r.online', 'boolean');
    const result = plan({}, [d]);
    assert.equal(result.config.datapoints.gridPointPower, power);
    assert.equal(result.config.settings.flowPowerDpIsW.gridPointPower, true);
    const manual = { datapoints: { gridPointPower: 'customer.0.nvp' } };
    assert.deepEqual(plan(manual, [d]).config, manual);
});

test('explicit M1 meter creates an inactive dynamic-grid measurement draft only', () => {
    const d = inventory('meter', 'meter', { mode: 'gridMeter', scope: 'M1' });
    const power = add(d, 'r.power', 'number', 'W');
    const result = plan({}, [d]);
    assert.equal(result.config.dynamicGridConnection.points[1].measurement.stateId, power);
    assert.equal(result.config.dynamicGridConnection.points[0].source, 'general');
    assert.equal(result.config.emsApps, undefined);
    assert.equal(result.statuses[0].code, 'MEASUREMENT_MAPPED');
    assert.equal(plan(result.config, [d]).changed, false);
});

test('one physical measurement is never duplicated between M1 and M0 or an energy-flow slot', () => {
    const d = inventory('meter', 'meter', { mode: 'gridMeter', scope: 'M1' });
    add(d, 'r.power', 'number', 'W', false, 'modbus.0.physical.power');
    const previous = { datapoints: { gridPointPower: 'alias.0.mainMeter' } };
    const first = plan(previous, [d], { readTargets: { 'alias.0.mainMeter': 'modbus.0.physical.power' } });
    assert.deepEqual(first.config, previous);
    assert.equal(first.statuses[0].code, 'MEASUREMENT_ALREADY_ASSIGNED');
    const m1 = plan({}, [d]).config;
    d.ems = { mode: 'generationMeter', flowSlot: 2 };
    const second = plan(m1, [d]);
    assert.deepEqual(second.config, m1);
    assert.equal(second.statuses[0].code, 'MEASUREMENT_ALREADY_ASSIGNED');
});

test('only bounded relevant references are requested and native alias read/write directions stay separate', () => {
    const refs = getDeviceEmsReferences({
        storage: { datapoints: { batteryPowerObjectId: 'alias.0.batteryPower', targetPowerObjectId: 'alias.0.shared' } },
        settingsConfig: { evcsList: [{ powerId: 'alias.0.shared', enableWriteId: 'alias.0.enable', phaseSwitchId: 'alias.0.phase' }] },
        datapoints: { gridPointPower: 'alias.0.grid', producer1Power: 'alias.0.pv' },
        customer: { accessToken: 'private', writeId: 'unrelated.0.private' },
    });
    assert.deepEqual(refs.write, ['alias.0.enable', 'alias.0.phase', 'alias.0.shared']);
    assert.deepEqual(refs.read, ['alias.0.batteryPower', 'alias.0.grid', 'alias.0.pv', 'alias.0.shared']);
    const d = inventory('meter', 'meter', { mode: 'gridMeter', scope: 'M1' });
    add(d, 'r.power', 'number', 'W', false, 'modbus.0.meter');
    const config = { datapoints: { gridPointPower: 'alias.0.split' } };
    const result = plan(config, [d], { readTargets: { 'alias.0.split': 'modbus.0.meter' }, writeTargets: { 'alias.0.split': 'modbus.0.actuator' } });
    assert.equal(result.statuses[0].code, 'MEASUREMENT_ALREADY_ASSIGNED');
});

test('explicit PV slot maps energy flow; a generation meter in same slot is conflict, never counted twice', () => {
    const pv = inventory('pv', 'pvInverter', { mode: 'pvInverter', flowSlot: 2 });
    const power = add(pv, 'r.pvPower', 'number', 'W');
    const first = plan({}, [pv]);
    assert.equal(first.config.datapoints.producer2Power, power);
    assert.equal(first.config.vis.flowSlots.producers[1].name, pv.name);
    assert.equal(first.config.gridConstraints, undefined, 'detection does not activate a PV limiter');
    const meter = inventory('meter', 'meter', { mode: 'generationMeter', flowSlot: 2 });
    add(meter, 'r.power', 'number', 'W');
    const next = plan(first.config, [pv, meter]);
    assert.deepEqual(next.config, first.config);
    assert.equal(next.statuses.find(row => row.devId === 'meter').code, 'MANUAL_MAPPING_PRESERVED');
});

test('consumer meter and explicit heat monitoring use chosen existing slot', () => {
    const d = inventory('consumer', 'meter', { mode: 'consumptionMeter', flowSlot: 10 });
    const power = add(d, 'r.power', 'number', 'W');
    const result = plan({}, [d]);
    assert.equal(result.config.datapoints.consumer10Power, power);
    assert.equal(result.config.vis.flowSlots.consumers.length, 10);
    assert.equal(result.config.thermalControl, undefined);
});

test('no topology or source grouping is guessed from device names', () => {
    const d = inventory('M0-Netzzähler', 'meter');
    d.devId = 'meter'; d.baseId = 'eos-admin.0.devices.meter';
    add(d, 'r.power', 'number', 'W');
    const result = plan({}, [d]);
    assert.deepEqual(result.patch, {});
    assert.equal(result.statuses[0].code, 'NEEDS_SELECTION');
});

test('malformed config, dangerous keys, duplicate inventories, bad intent and excessive size are rejected', () => {
    const d = wallbox();
    assert.throws(() => plan(null, [d]), { code: 'EOS_EMS_PLAN_CONFIG_INVALID' });
    assert.throws(() => plan(JSON.parse('{"__proto__":{"polluted":true}}'), [d]), { code: 'EOS_EMS_PLAN_CONFIG_KEY' });
    assert.throws(() => plan({}, [d, d]), { code: 'EOS_EMS_PLAN_DEVICE_DUPLICATE' });
    assert.throws(() => plan({}, Array(257).fill(d)), { code: 'EOS_EMS_PLAN_DEVICE_LIMIT' });
    assert.throws(() => plan({ secret: 'x'.repeat(2 * 1024 * 1024) }, []), { code: 'EOS_EMS_PLAN_CONFIG_SIZE' });
    assert.throws(() => plan({}, [{ ...d, ems: { mode: 'execute-shell' } }]), { code: 'EOS_EMS_PLAN_INTENT_INVALID' });
    assert.equal({}.polluted, undefined);
});
