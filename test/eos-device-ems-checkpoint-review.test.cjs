'use strict';
/** Regression: a prior device rollback must not detach later safety changes. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { planDeviceEms } = require('../src/lib/eosDeviceEmsPlan');

function device(id, deviceClass, mode, limits = {}) {
    return { baseId: `eos-admin.0.devices.${id}`, devId: id, name: id,
        templateId: `review.${id}`, protocol: 'modbusTcp', deviceClass, enabled: true, aliasMeta: {},
        ems: { mode, scope: 'M0', activation: { requested: true, requestId: `review-${id}-0123456789012345`, limits } } };
}
function alias(row, key, type, unit, write = false) {
    row.aliasMeta[key] = { id: `${row.baseId}.aliases.v1.${key}`, type, unit,
        read: !write, write, targetId: `${row.baseId}.${key}` };
}
const plan = (config, devices) => planDeviceEms({ config, devices,
    limits: { chargePoints: 20, batteries: 20 }, allowedApps: ['charging', 'storage', 'storagefarm'] });
function fixture(mode) {
    const grid = device('grid', 'meter', 'gridMeter'); alias(grid, 'r.power', 'number', 'W');
    const controller = device('z-controller', mode === 'auto' ? 'evCharger' : 'storageSystem', mode,
        mode === 'auto' ? { chargerType: 'ac', phases: 3, minCurrentA: 6, maxCurrentA: 16 }
            : { maxChargeW: 3000, maxDischargeW: 3500, coupling: 'ac', capacityKWh: 10 });
    alias(controller, 'r.power', 'number', 'W'); alias(controller, 'r.online', 'boolean', '');
    if (mode === 'auto') alias(controller, 'ctrl.currentLimitA', 'number', 'A', true);
    else { alias(controller, 'r.soc', 'number', '%'); alias(controller, 'ctrl.powerSetpointW', 'number', 'W', true); }
    const row = config => mode === 'auto' ? config.settingsConfig.evcsList[0]
        : mode === 'storageFarm' ? config.storageFarm.storages[0] : config.storage;
    const initial = plan({}, [controller, grid]);
    assert.equal(row(initial.config).enabled, true);
    return { controller, grid, row, initial: initial.config };
}
for (const mode of ['auto', 'singleStorage', 'storageFarm']) {
    for (const preceding of ['manual-generic', 'pending-role', 'conflicting-grid']) {
        test(`${mode}: profile safety survives an earlier ${preceding} checkpoint rollback`, () => {
            const x = fixture(mode);
            const earlier = device('a-earlier', preceding === 'manual-generic' ? 'generic' : 'meter',
                preceding === 'conflicting-grid' ? 'gridMeter' : 'auto');
            delete earlier.ems.activation; alias(earlier, 'r.power', 'number', 'W');
            x.controller.templateId = 'review.replacement-profile';
            const before = structuredClone(x.initial);
            const result = plan(x.initial, [x.controller, x.grid, earlier]);
            assert.equal(result.statuses.find(s => s.devId === x.controller.devId).code, 'ACTIVATION_PROFILE_CHANGED');
            assert.equal(x.row(result.config).enabled, false);
            assert.deepEqual({ ...x.row(result.config), enabled: true }, x.row(before), 'limits and assignments remain unchanged');
            assert.deepEqual(x.initial, before, 'input configuration is never mutated');
            if (mode === 'singleStorage') assert.equal(result.config.emsApps.apps.storage.enabled, false);
            assert.equal(plan(result.config, [earlier, x.grid, x.controller]).changed, false, 'repeated background reconciliation stays idempotent');
        });
    }
}
