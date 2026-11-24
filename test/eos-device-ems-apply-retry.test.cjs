'use strict';
/** Real persisted reconcile path behind the actual bounded service retry scheduler. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { EosDeviceEmsService, projectDeviceEmsConfig } = require('../src/lib/eosDeviceEmsService');
const { planDeviceEms } = require('../src/lib/eosDeviceEmsPlan');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function inventory() {
    const row = (id, deviceClass, mode, limits = {}) => ({ baseId: `eos-admin.0.devices.${id}`, devId: id,
        templateId: `review.${id}`, name: id, deviceClass, enabled: true, aliasMeta: {},
        ems: { mode, scope: 'M0', activation: { requested: true, requestId: `review-${id}-0123456789012345`, limits } } });
    const add = (d, key, type, unit, write = false) => {
        d.aliasMeta[key] = { id: `${d.baseId}.aliases.v1.${key}`, type, unit, read: !write, write, targetId: `${d.baseId}.${key}` };
    };
    const s = row('storage', 'storageSystem', 'storageFarm', { maxChargeW: 3000, maxDischargeW: 3500, coupling: 'ac' });
    add(s, 'r.power', 'number', 'W'); add(s, 'r.soc', 'number', '%'); add(s, 'ctrl.powerSetpointW', 'number', 'W', true);
    const g = row('grid', 'meter', 'gridMeter'); add(g, 'r.power', 'number', 'W');
    return [s, g];
}
for (const failure of ['EOS_EMS_APPLY_FAILED', 'EOS_EMS_CONFIG_WAIT_TIMEOUT']) {
    test(`known post-commit ${failure} retries once without replaying the persisted activation`, async t => {
        const h = await createHarness(); const a = h.adapter; const devices = inventory(); let service;
        t.after(async () => { await service?.stop(); await new Promise(resolve => a.onUnload(resolve)); await h.close(); });
        a.config = structuredClone(require('../ui/io-package.json').native); a.config.port = 8188; a._hostedStartup = { state: 'ready' };
        a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState;
        a.startHistorieExportTimer = () => {}; h.owner.subscribeForeignStates = () => {}; h.owner.unsubscribeForeignStates = () => {};
        await a.migrateNativeConfig(); await a.loadInstallerConfigFromState(); await a.syncSettingsConfigToStates();
        a._bridge.deviceEmsPlan = async input => planDeviceEms({ ...input, config: projectDeviceEmsConfig(input.config), limits: { chargePoints: 20, batteries: 20 } });
        const apply = a._nwApplyInstallerRuntime.bind(a); let attempts = 0; let saves = 0;
        const persist = a.persistInstallerConfigToState.bind(a);
        a.persistInstallerConfigToState = async (...args) => { saves++; return persist(...args); };
        a._nwApplyInstallerRuntime = async (...args) => { attempts++; if (attempts === 1) throw new Error(failure); return apply(...args); };
        service = new EosDeviceEmsService({ owner: h.owner, canRun: () => true,
            getSnapshot: () => ({ namespace: 'eos-admin.0', devices: devices.map(d => ({ id: d.devId })), moduleEnabled: true, generation: 1, ready: true }),
            apply: selected => a.reconcileDeviceEms(selected) });
        // Inventory provenance is covered separately; this test crosses the actual persistence/retry boundary.
        service.inventory = async () => devices;
        await service.flush();
        assert.equal(a._nwDeviceEmsApplyPending, true); assert.equal(service.view().state, 'pending');
        assert.ok(service.timer); assert.equal(saves, 1);
        for (let count = 0; count < 100 && service.view().state !== 'ready'; count++) await pause(25);
        assert.equal(service.view().state, 'ready'); assert.equal(attempts, 2); assert.equal(saves, 1);
        assert.equal(a._nwDeviceEmsApplyPending, false); assert.ok(a.emsEngine);
        assert.equal(service.view().statuses.find(s => s.devId === 'storage').activationApplied, true);
        await service.flush(); assert.equal(attempts, 2); assert.equal(saves, 1);
    });
}
test('post-commit recovery remains bounded and never retries uncertain persistence or arbitrary failures', async t => {
    for (const code of ['EOS_EMS_APPLY_FAILED', 'EOS_EMS_CONFIG_WAIT_TIMEOUT', 'EOS_DEVICE_EMS_PERSIST_FAILED', 'EOS_EMS_MODULE_STOP_FAILED', 'EOS_UNKNOWN_FAILED']) {
        let attempts = 0; const scheduled = [];
        const service = new EosDeviceEmsService({ owner: {}, canRun: () => true,
            getSnapshot: () => ({ namespace: 'eos-admin.0', devices: [], moduleEnabled: true, generation: 1, ready: true }),
            apply: async () => { attempts++; throw new Error(code); } });
        t.after(() => service.stop());
        service.schedule = ms => scheduled.push(ms);
        await service.flush();
        for (let cursor = 0; cursor < scheduled.length && cursor < 20; cursor++) await service.flush();
        if (code === 'EOS_EMS_APPLY_FAILED' || code === 'EOS_EMS_CONFIG_WAIT_TIMEOUT') {
            assert.equal(attempts, 7); assert.deepEqual(scheduled, [1000, 2000, 5000, 10000, 15000, 30000]);
        } else { assert.equal(attempts, 1); assert.deepEqual(scheduled, []); }
    }
});
