'use strict';
/** Independent release review: actual persisted commissioning + failed runtime apply. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const { planDeviceEms } = require('../src/lib/eosDeviceEmsPlan');
const { projectDeviceEmsConfig } = require('../src/lib/eosDeviceEmsService');
const { activeDeviceProfileReferences } = require('../ui/lib/installer-lifecycle');

function inventory() {
    const row = (id, deviceClass, mode, limits = {}) => ({ baseId: `eos-admin.0.devices.${id}`, devId: id,
        templateId: `review.${id}`, name: id, deviceClass, enabled: true, aliasMeta: {},
        ems: { mode, scope: 'M0', activation: { requested: true, requestId: `review-${id}-0123456789012345`, limits } } });
    const add = (dev, path, type, unit, write = false) => {
        const id = `${dev.baseId}.aliases.v1.${path}`;
        dev.aliasMeta[path] = { id, type, unit, read: !write, write, targetId: `${dev.baseId}.${path}` };
    };
    const storage = row('storage', 'storageSystem', 'storageFarm', { maxChargeW: 3000, maxDischargeW: 3500, coupling: 'ac' });
    add(storage, 'r.power', 'number', 'W'); add(storage, 'r.soc', 'number', '%');
    add(storage, 'ctrl.powerSetpointW', 'number', 'W', true);
    const grid = row('grid', 'meter', 'gridMeter');
    add(grid, 'r.power', 'number', 'W'); add(grid, 'comm.connected', 'boolean', '');
    return { storage, grid, devices: [storage, grid] };
}

function plan(config, devices) {
    return planDeviceEms({ config, devices, limits: { chargePoints: 20, batteries: 20 },
        allowedApps: ['charging', 'storage', 'storagefarm'] });
}

test('consumed activation never grants control to a replacement profile or device class under the same alias base', () => {
    for (const field of ['templateId', 'deviceClass']) {
        const x = inventory(); const first = plan({}, x.devices);
        const original = structuredClone(first.config.storageFarm.storages[0]);
        x.storage[field] = field === 'templateId' ? 'review.replacementStorage' : 'batteryInverter';
        const changed = plan(first.config, x.devices);
        const status = changed.statuses.find(row => row.devId === 'storage');
        assert.equal(status.code, 'ACTIVATION_PROFILE_CHANGED', field);
        assert.equal(status.activationApplied, false, field);
        assert.equal(changed.config.storageFarm.storages[0].enabled, false, field);
        assert.equal(changed.config.storageFarm.storages[0].maxChargeW, original.maxChargeW);
        assert.equal(changed.config.storageFarm.storages[0].signedPowerId, original.signedPowerId);
        assert.equal(changed.config.storageFarm.storages[0].setSignedPowerId, original.setSignedPowerId);
        assert.equal(changed.config.datapoints.gridPointPower, first.config.datapoints.gridPointPower);
    }
});

test('unchanged profile and semantic aliases retain their consumed activation across controller-address adjustment', () => {
    const x = inventory(); const first = plan({}, x.devices);
    x.storage.connection = { controllerOffset: -110 };
    const same = plan(first.config, x.devices);
    assert.equal(same.changed, false);
    assert.equal(same.config.storageFarm.storages[0].enabled, true);
    assert.equal(same.statuses.find(row => row.devId === 'storage').code, 'ACTIVATION_APPLIED');
});

test('a consumed token cannot turn an unavailable current alias inventory into a successful commissioning status', () => {
    const x = inventory(); const first = plan({}, x.devices);
    x.storage.aliasMeta = {}; x.storage.discoveryCode = 'EOS_EMS_DISCOVERY_UNAVAILABLE';
    const pending = plan(first.config, x.devices);
    const status = pending.statuses.find(row => row.devId === 'storage');
    assert.equal(status.status, 'pending');
    assert.equal(status.code, 'EOS_EMS_DISCOVERY_UNAVAILABLE');
    assert.equal(status.activationApplied, false);
    assert.deepEqual(pending.config.storageFarm, first.config.storageFarm, 'temporary discovery failure retains saved mappings and limits');
});

test('installing a shared app cannot silently start its previously dormant enabled manual controller', () => {
    const x = inventory();
    const manual = { enabled: true, name: 'Existing customer controller', signedPowerId: 'manual.0.power',
        socId: 'manual.0.soc', setSignedPowerId: 'manual.0.command', maxChargeW: 1234, maxDischargeW: 2345, coupling: 'ac' };
    const result = plan({ emsApps: { schemaVersion: 1, apps: { storagefarm: { installed: false, enabled: true } } },
        storageFarm: { storages: [manual] } }, x.devices);
    const status = result.statuses.find(row => row.devId === 'storage');
    assert.equal(result.config.emsApps.apps.storagefarm.enabled, false);
    assert.deepEqual(result.config.storageFarm.storages[0], manual);
    assert.equal(status.activationApplied, false);
    assert.ok(status.missing.includes('otherUncommissionedController'));
});

test('profile replacement guard includes real split-NVP readers and both peak-shaving activation paths', () => {
    const split = activeDeviceProfileReferences({ datapoints: {
        gridBuyPower: 'eos-admin.0.devices.grid.aliases.v1.r.importPower',
        gridSellPower: 'eos-admin.0.devices.grid.aliases.v1.r.exportPower',
    } });
    assert.ok(split.read.includes('eos-admin.0.devices.grid.aliases.v1.r.importPower'));
    assert.ok(split.read.includes('eos-admin.0.devices.grid.aliases.v1.r.exportPower'));
    for (const atypical of [false, true]) {
        const refs = activeDeviceProfileReferences({ enablePeakShaving: !atypical,
            emsApps: { apps: { peak: { installed: true, enabled: !atypical } } },
            peakShaving: { atypical: { enabled: atypical }, gridPointPowerId: 'alias.0.peak.grid',
                actuators: [{ enabled: true, setpointId: 'alias.0.peak.set', enableId: 'alias.0.peak.enable' }] } });
        assert.ok(refs.read.includes('alias.0.peak.grid'));
        assert.ok(refs.write.includes('alias.0.peak.set'));
        assert.ok(refs.write.includes('alias.0.peak.enable'));
    }
});

test('a persisted activation is not returned as successful until a failed runtime apply is retried', async t => {
    const h = await createHarness(); const a = h.adapter; const x = inventory();
    a.config = structuredClone(require('../ui/io-package.json').native);
    a.config.port = 8188; a._hostedStartup = { state: 'ready' };
    a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState;
    a.startHistorieExportTimer = () => {};
    h.owner.subscribeForeignStates = () => {}; h.owner.unsubscribeForeignStates = () => {};
    t.after(async () => { await new Promise(resolve => a.onUnload(resolve)); await h.close(); });
    await a.migrateNativeConfig(); await a.loadInstallerConfigFromState(); await a.syncSettingsConfigToStates();
    a._bridge.deviceEmsPlan = async input => planDeviceEms({ ...input, config: projectDeviceEmsConfig(input.config),
        limits: { chargePoints: 20, batteries: 20 } });
    const apply = a._nwApplyInstallerRuntime.bind(a);
    let applications = 0;
    a._nwApplyInstallerRuntime = async (...args) => {
        applications++;
        if (applications === 1) throw new Error('EOS_EMS_APPLY_FAILED');
        return apply(...args);
    };
    await assert.rejects(a.reconcileDeviceEms(x.devices), /EOS_EMS_APPLY_FAILED/);
    const saved = JSON.parse(h.states.get('eos-admin.0.installer.configJson').val);
    assert.equal(saved.eosDeviceEms.bindings[x.storage.baseId].activationRequestId, x.storage.ems.activation.requestId);
    assert.equal(a._nwDeviceEmsApplyPending, true);
    const second = await a.reconcileDeviceEms(x.devices);
    assert.equal(second.changed, false, 'the activation token was already durably consumed');
    assert.equal(applications, 2, 'an unchanged plan must still finish its previously failed runtime apply');
    assert.equal(a._nwDeviceEmsApplyPending, false);
    assert.equal(second.statuses.find(row => row.devId === 'storage').activationApplied, true);
    assert.ok(a.emsEngine, 'success is returned only after the replacement engine exists');
    a.config.emsApps.apps.storagefarm.enabled = false;
    a._nwInstallerConfigPatch.emsApps.apps.storagefarm.enabled = false;
    const replay = await a.reconcileDeviceEms(x.devices);
    assert.equal(applications, 2, 'a consumed request does not restart or enable a deliberately disabled app');
    assert.equal(a.config.emsApps.apps.storagefarm.enabled, false);
    assert.equal(replay.statuses.find(row => row.devId === 'storage').code, 'APP_DISABLED');
});
