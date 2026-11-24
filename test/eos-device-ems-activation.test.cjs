'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { planDeviceEms } = require('../src/lib/eosDeviceEmsPlan');

const limits = { chargePoints: 20, batteries: 20 };
const allowedApps = ['charging', 'storage', 'storagefarm'];
function device(id, deviceClass, mode, bounds) {
    return { devId: id, baseId: `eos-admin.0.devices.${id}`, deviceClass, enabled: true, name: id,
        ems: { mode, scope: 'M0', activation: { requested: true, requestId: `request-${id}-0123456789012345`, limits: bounds || {} } }, aliasMeta: {} };
}
function alias(dev, key, type, unit, write = false, source = key) {
    const id = `${dev.baseId}.aliases.v1.${key}`;
    dev.aliasMeta[key] = { id, type, unit, read: !write, write, targetId: `${dev.baseId}.${source}` };
    return id;
}
function grid() {
    const d = device('sma', 'meter', 'gridMeter');
    alias(d, 'r.power', 'number', 'W'); alias(d, 'r.online', 'boolean', '');
    return d;
}
function storage(id = 'solax', mode = 'storageFarm') {
    const d = device(id, 'storageSystem', mode, { maxChargeW: 5000, maxDischargeW: 6000, coupling: 'ac', capacityKWh: 12 });
    alias(d, 'r.power', 'number', 'W', false, 'batteryPower'); alias(d, 'r.soc', 'number', '%', false, 'soc');
    alias(d, 'ctrl.powerSetpointW', 'number', 'W', true, 'setPower');
    return d;
}
function home() {
    const d = storage('fenecon'); d.templateId = 'ess.fenecon.FeneconHomeEssImpl'; d.ems.activation.limits.coupling = 'dc';
    for (const [key, raw] of Object.entries({ 'r.essActivePower': 'eSS0_ACTIVE_POWER', 'r.pvPowerDc': 'pV_DC_POWER',
        'ctrl.powerSetpointW': 'sET_ACTIVE_POWER', 'ctrl.gridSetpointW': 'sET_GRID_ACTIVE_POWER' })) {
        alias(d, key, 'number', 'W', key.startsWith('ctrl.'), raw);
    }
    return d;
}
function wallbox() {
    const d = device('wb', 'evCharger', 'auto', { chargerType: 'ac', phases: 3, minCurrentA: 6, maxCurrentA: 16 });
    alias(d, 'r.power', 'number', 'W'); alias(d, 'r.online', 'boolean', ''); alias(d, 'ctrl.currentLimitA', 'number', 'A', true);
    return d;
}
function plan(config, devices, more = {}) { return planDeviceEms({ config, devices, limits, allowedApps, ...more }); }

test('one explicit save adopts the legacy Home row, adds SolaX, binds SMA and activates exactly the farm app', () => {
    const f = home(); const s = storage(); const m = grid();
    const legacySoc = `${f.baseId}.aliases.r.soc`;
    const old = { name: 'Kundenspeicher', enabled: true, vendorProfile: 'fenecon-openems', coupling: 'dc', feneconControlMode: 'fems-grid',
        socId: legacySoc, signedPowerId: `${f.baseId}.aliases.r.power`, feneconGridSetpointId: `${f.baseId}.aliases.ctrl.powerSetpointW`,
        maxChargeW: 4321, maxDischargeW: 4567, capacityKWh: 22, pvPowerId: '10000' };
    const input = { storageFarm: { storages: [old], groups: [{ name: 'Bleibt erhalten' }] },
        emsApps: { schemaVersion: 1, apps: { storagefarm: { installed: false, enabled: false }, tariff: { installed: true, enabled: true } } } };
    const result = plan(input, [s, f, m], { referenceMeta: { [legacySoc]: { type: 'number', unit: '%', read: true, write: false } } });
    assert.equal(result.config.storageFarm.storages.length, 2);
    const row = result.config.storageFarm.storages.find(x => x.name === 'Kundenspeicher');
    assert.equal(row.enabled, true);
    assert.equal(row.maxChargeW, 4321); assert.equal(row.maxDischargeW, 4567); assert.equal(row.capacityKWh, 22);
    assert.equal(row.feneconControlMode, 'direct-ess');
    assert.equal(row.socId, legacySoc, 'valid manual source remains authoritative');
    assert.equal(row.signedPowerId, f.aliasMeta['r.essActivePower'].id);
    assert.equal(row.feneconGridSetpointId, f.aliasMeta['ctrl.gridSetpointW'].id);
    assert.equal(row.setSignedPowerId, f.aliasMeta['ctrl.powerSetpointW'].id);
    assert.equal(row.pvPowerId, f.aliasMeta['r.pvPowerDc'].id);
    assert.equal(row.batteryFlowPowerId, f.aliasMeta['r.power'].id, 'display uses physical battery flow separately from actor feedback');
    assert.equal(result.config.storageFarm.storages.find(x => x.name === 'solax').enabled, true);
    assert.equal(result.config.datapoints.gridPointPower, m.aliasMeta['r.power'].id);
    assert.deepEqual(result.config.emsApps.apps.tariff, input.emsApps.apps.tariff);
    assert.deepEqual(result.config.emsApps.apps.storagefarm, { installed: true, enabled: true });
    assert.equal(result.config.emsApps.apps.storage, undefined);
    assert.equal(result.config.emsApps.apps.charging, undefined);
    assert.ok(result.statuses.every(x => x.activationApplied && x.code === 'ACTIVATION_APPLIED'));
    const corrections = result.statuses.find(x => x.devId === 'fenecon').corrections;
    assert.ok(corrections.includes('LEGACY_ROW_ADOPTED'));
    assert.ok(corrections.includes('FENECON_DIRECT_ESS_SELECTED'));
    assert.ok(corrections.includes('FENECON_NATIVE_TARGET_CORRECTED'));
    assert.ok(corrections.includes('FENECON_ACTOR_FEEDBACK_CORRECTED'));
    assert.ok(corrections.includes('PV_POWER_REFERENCE_CORRECTED'));
    assert.equal(input.storageFarm.storages.length, 1, 'planner never mutates customer input');
});

test('consumed commissioning cannot re-enable an AppCenter disable after restart, updates or an unrelated save', () => {
    const s = storage(); const m = grid(); const first = plan({}, [s, m]);
    first.config.emsApps.apps.storagefarm.enabled = false;
    first.config.storageFarm.storages[0].enabled = false;
    const unrelated = device('consumer', 'meter', 'consumptionMeter'); unrelated.ems.flowSlot = 1;
    delete unrelated.ems.activation; alias(unrelated, 'r.power', 'number', 'W');
    const second = plan(first.config, [unrelated, m, s]);
    assert.equal(second.config.emsApps.apps.storagefarm.enabled, false);
    assert.equal(second.config.storageFarm.storages[0].enabled, false);
    assert.equal(second.statuses.find(x => x.devId === s.devId).code, 'APP_DISABLED');
    assert.equal(second.config.eosDeviceEms.bindings[s.baseId].activationRequestId, s.ems.activation.requestId);
    assert.equal(plan(second.config, [s, m, unrelated]).changed, false);
});

test('missing bounds, an unavailable app grant or an invalid NVP keep the request pending and rows inactive', () => {
    for (const reason of ['bounds', 'grant', 'nvp']) {
        const s = storage(); const m = grid();
        if (reason === 'bounds') s.ems.activation.limits = { coupling: 'ac' };
        if (reason === 'nvp') m.aliasMeta['r.power'].type = 'boolean';
        const result = plan({}, [s, m], reason === 'grant' ? { allowedApps: [] } : {});
        assert.equal(result.config.storageFarm.storages[0].enabled, false);
        assert.equal(result.config.emsApps, undefined);
        assert.equal(result.statuses.find(x => x.devId === 'solax').code, 'ACTIVATION_PENDING');
        assert.equal(result.config.eosDeviceEms.bindings[s.baseId].activationRequestId, undefined);
    }
});

test('reusing a consumed request for changed topology or limits is rejected without changing the operating configuration', () => {
    const s = storage(); const m = grid(); const first = plan({}, [s, m]);
    s.ems.activation.limits.maxChargeW = 9999;
    const result = plan(first.config, [s, m]);
    assert.deepEqual(result.config, first.config);
    assert.equal(result.statuses.find(x => x.devId === s.devId).code, 'ACTIVATION_REQUEST_CHANGED');
});

test('canonical alias resolution adopts exactly one manual row only with explicit commissioning and keeps unrelated devices', () => {
    const s = storage(); const m = grid();
    const saved = { storageFarm: { storages: [{ name: 'Manuell', enabled: false, socId: 'alias.0.soc', signedPowerId: 'alias.0.power',
        setSignedPowerId: 'alias.0.command', maxChargeW: 3000, maxDischargeW: 3500, coupling: 'ac' },
    { name: 'Fremdes Gerät', enabled: false, socId: 'foreign.0.soc', signedPowerId: 'foreign.0.power', setSignedPowerId: 'foreign.0.cmd', maxChargeW: 42 }] } };
    const result = plan(saved, [s, m], { readTargets: { 'alias.0.soc': `${s.baseId}.soc`, 'alias.0.power': `${s.baseId}.batteryPower` },
        writeTargets: { 'alias.0.command': `${s.baseId}.setPower` }, referenceMeta: {
            'alias.0.soc': { type: 'number', unit: '%', read: true, write: false },
            'alias.0.power': { type: 'number', unit: 'W', read: true, write: false },
            'alias.0.command': { type: 'number', unit: 'W', read: false, write: true },
        } });
    assert.equal(result.config.storageFarm.storages.length, 2);
    assert.deepEqual(result.config.storageFarm.storages[1], saved.storageFarm.storages[1]);
    assert.equal(result.config.storageFarm.storages[0].maxChargeW, 3000);
    assert.equal(result.config.storageFarm.storages[0].setSignedPowerId, 'alias.0.command');
    assert.equal(result.config.storageFarm.storages[0].enabled, true);
});

test('an unsuccessful commissioning leaves an already operating legacy row and its command family untouched', () => {
    const f = home(); const s = storage();
    const old = { enabled: true, vendorProfile: 'fenecon-openems', coupling: 'dc', feneconControlMode: 'fems-grid',
        socId: f.aliasMeta['r.soc'].id, signedPowerId: `${f.baseId}.aliases.r.power`,
        feneconGridSetpointId: `${f.baseId}.aliases.ctrl.powerSetpointW`, maxChargeW: 7000, maxDischargeW: 7000 };
    const result = plan({ storageFarm: { storages: [old] } }, [f, s]);
    assert.deepEqual(result.config.storageFarm.storages[0], old, 'without validated M0 no live row is rewritten');
    assert.equal(result.statuses.find(x => x.devId === f.devId).code, 'ACTIVATION_PENDING');
    assert.deepEqual(result.statuses.find(x => x.devId === f.devId).corrections, []);
});

test('explicit wallbox commissioning repairs a boolean EV total override but preserves a numeric manual total', () => {
    for (const type of ['boolean', 'number']) {
        const w = wallbox(); const m = grid(); const old = 'ocpp.0.Station.transactionActive';
        const result = plan({ datapoints: { consumptionEvcs: old } }, [w, m], { referenceMeta: {
            [old]: { type, unit: type === 'number' ? 'W' : '', read: true, write: false },
        } });
        assert.equal(result.config.emsApps.apps.charging.enabled, true);
        assert.equal(result.config.settingsConfig.evcsList[0].enabled, true);
        assert.equal(result.config.datapoints.consumptionEvcs, type === 'boolean' ? '' : old);
        assert.equal(result.statuses.find(x => x.devId === w.devId).corrections.includes('EV_FLOW_BOOLEAN_OVERRIDE_REMOVED'), type === 'boolean');
    }
});

test('a new explicit off request disables only its own row, retaining another member and the shared app', () => {
    const a = storage('a'); const b = storage('b'); const m = grid(); const first = plan({}, [a, b, m]);
    a.ems.activation = { requested: false, requestId: 'request-off-0123456789012345' };
    const result = plan(first.config, [a, b, m]);
    assert.equal(result.config.storageFarm.storages.find(x => x.name === 'a').enabled, false);
    assert.equal(result.config.storageFarm.storages.find(x => x.name === 'b').enabled, true);
    assert.equal(result.config.emsApps.apps.storagefarm.enabled, true);
    assert.equal(result.statuses.find(x => x.devId === 'a').code, 'ACTIVATION_DISABLED');
});

test('M0 prefers immediate transport connection and corrects its own slower online source only on explicit save', () => {
    const m = grid(); const connected = alias(m, 'comm.connected', 'boolean', '');
    const initial = plan({}, [m]);
    assert.equal(initial.config.datapoints.gridPointConnected, connected);
    const old = { datapoints: { gridPointPower: m.aliasMeta['r.power'].id, gridPointConnected: m.aliasMeta['r.online'].id } };
    const result = plan(old, [m]);
    assert.equal(result.config.datapoints.gridPointConnected, connected);
    assert.ok(result.statuses[0].corrections.includes('NVP_TRANSPORT_STATUS_SELECTED'));
    delete m.ems.activation;
    assert.equal(plan(old, [m]).config.datapoints.gridPointConnected, old.datapoints.gridPointConnected);
});

test('known thermal control and flow-slot writers prevent a second physical command owner', () => {
    for (const area of ['thermal', 'vis']) {
        const w = wallbox(); const m = grid();
        const manual = area === 'thermal' ? { thermal: { devices: [{ writeId: 'alias.0.heat.command' }] } }
            : { vis: { flowSlots: { consumers: [{ ctrl: { switchWriteId: 'alias.0.heat.command' } }] } } };
        const result = plan(manual, [w, m], { writeTargets: { 'alias.0.heat.command': w.aliasMeta['ctrl.currentLimitA'].targetId } });
        assert.equal(result.statuses.find(x => x.devId === w.devId).code, 'CONTROL_TARGET_ALREADY_ASSIGNED');
        assert.equal(result.config.settingsConfig, undefined);
        assert.equal(result.config.emsApps, undefined);
    }
});

test('activation rejects malformed intent tokens and unknown or unbounded input limits', () => {
    const d = storage();
    for (const patch of [{ requestId: 'short' }, { limits: { maxChargeW: 0 } }, { limits: { constructor: {} } },
        { limits: { maxChargeW: '5000' } }, { limits: { phases: 2 } }]) {
        assert.throws(() => plan({}, [{ ...d, ems: { ...d.ems, activation: { ...d.ems.activation, ...patch } } }]), { code: 'EOS_EMS_PLAN_ACTIVATION_INVALID' });
    }
});

test('explicit off and authoritative removal also disable the sole single-storage app, retaining its configuration', () => {
    for (const action of ['off', 'remove', 'monitor']) {
        const s = storage('single', 'singleStorage'); const m = grid();
        const first = plan({}, [s, m]);
        assert.equal(first.config.emsApps.apps.storage.enabled, true);
        if (action === 'off') s.ems.activation = { requested: false, requestId: 'request-off-0123456789012345' };
        if (action === 'monitor') { s.ems.mode = 'monitor'; delete s.ems.activation; }
        const result = plan(first.config, action === 'remove' ? [m] : [s, m]);
        assert.equal(result.config.storage.enabled, false);
        assert.equal(result.config.emsApps.apps.storage.enabled, false);
        assert.equal(result.config.emsApps.apps.storage.installed, true);
        assert.equal(result.config.storage.maxChargeW, 5000);
        assert.equal(result.config.storage.datapoints.targetPowerObjectId, s.aliasMeta['ctrl.powerSetpointW'].id);
    }
});

test('enabling a previously disabled shared app never starts an uncommissioned dormant manual controller', () => {
    for (const oldApp of [{ installed: true, enabled: false }, { installed: false, enabled: true }]) {
    const s = storage(); const m = grid();
    const old = { name: 'Alter manueller Speicher', enabled: true, setSignedPowerId: 'foreign.0.command', maxChargeW: 5000 };
    const initial = { storageFarm: { storages: [old] }, emsApps: { schemaVersion: 1, apps: { storagefarm: oldApp } } };
    const result = plan(initial, [s, m]);
    assert.equal(result.config.emsApps.apps.storagefarm.enabled, false);
    assert.deepEqual(result.config.storageFarm.storages[0], old);
    assert.equal(result.config.storageFarm.storages[1].enabled, false);
    const status = result.statuses.find(x => x.devId === s.devId);
    assert.equal(status.activationApplied, false);
    assert.ok(status.missing.includes('otherUncommissionedController'));
    assert.equal(result.config.eosDeviceEms.bindings[s.baseId].activationRequestId, undefined);
    }
});

test('one pending member prevents accidental start of a dormant shared farm while validated mapping is retained', () => {
    const f = home(); const s = storage(); const m = grid();
    f.ems.activation.limits = { coupling: 'dc' };
    const old = { name: 'Home', enabled: true, vendorProfile: 'fenecon-openems', coupling: 'dc', feneconControlMode: 'fems-grid',
        socId: f.aliasMeta['r.soc'].id, signedPowerId: `${f.baseId}.aliases.r.power`,
        feneconGridSetpointId: `${f.baseId}.aliases.ctrl.powerSetpointW` };
    const result = plan({ storageFarm: { storages: [old] }, emsApps: { schemaVersion: 1, apps: { storagefarm: { installed: true, enabled: false } } } }, [f, s, m]);
    assert.equal(result.config.emsApps.apps.storagefarm.enabled, false);
    assert.deepEqual(result.config.storageFarm.storages[0], old);
    assert.equal(result.config.storageFarm.storages[1].enabled, false);
    assert.equal(result.statuses.find(x => x.devId === s.devId).activationApplied, false);
    assert.ok(result.statuses.find(x => x.devId === s.devId).missing.includes('otherUncommissionedController'));
});

test('replacement commissioning never restores the active old profile on failure or inherits a vendor-specific controller', () => {
    for (const kind of ['missing-source', 'different-vendor']) {
        const s = kind === 'different-vendor' ? home() : storage(); const m = grid();
        s.templateId ||= 'ess.generic.ProfileA';
        const initial = plan({}, [s, m]);
        const original = structuredClone(initial.config.storageFarm.storages[0]);
        s.templateId = 'ess.generic.ProfileB';
        s.ems.activation.requestId = 'request-replacement-0123456789012345';
        if (kind === 'missing-source') delete s.aliasMeta['ctrl.powerSetpointW'];
        const result = plan(initial.config, [s, m]);
        const row = result.config.storageFarm.storages[0];
        assert.equal(row.enabled, false);
        assert.equal(row.maxChargeW, original.maxChargeW);
        assert.equal(row.maxDischargeW, original.maxDischargeW);
        const status = result.statuses.find(item => item.devId === s.devId);
        assert.equal(status.activationApplied, false);
        assert.equal(status.code, kind === 'different-vendor' ? 'ACTIVATION_PROFILE_CHANGED' : 'ACTIVATION_PENDING');
    }
});

test('temporary manifest failure with the service generic-class fallback preserves the previous safe configuration', () => {
    const s = storage(); const m = grid(); s.templateId = 'ess.generic.ProfileA';
    const initial = plan({}, [s, m]);
    s.deviceClass = 'generic'; s.aliasMeta = {}; s.discoveryCode = 'EOS_EMS_DISCOVERY_UNAVAILABLE';
    const result = plan(initial.config, [s, m]);
    assert.deepEqual(result.config, initial.config);
    const status = result.statuses.find(item => item.devId === s.devId);
    assert.equal(status.code, 'EOS_EMS_DISCOVERY_UNAVAILABLE');
    assert.equal(status.activationApplied, false);
});

test('consumed activation is bound to the saved protocol, without binding mutable controller offsets', () => {
    const s = storage(); const m = grid(); s.protocol = 'modbusTcp';
    const initial = plan({}, [s, m]);
    assert.equal(initial.config.eosDeviceEms.bindings[s.baseId].deviceProtocol, 'modbusTcp');
    s.protocol = 'modbusRtu';
    const result = plan(initial.config, [s, m]);
    assert.equal(result.config.storageFarm.storages[0].enabled, false);
    assert.equal(result.statuses.find(item => item.devId === s.devId).code, 'ACTIVATION_PROFILE_CHANGED');
});
