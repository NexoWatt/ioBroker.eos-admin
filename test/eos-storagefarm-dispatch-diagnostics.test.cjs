'use strict';
// Copyright (c) 2026 NexoWatt. Confidential and proprietary.
// Exercise the real aggregation/dispatcher against isolated ioBroker states.
// A confirmed command state is not a physical battery response.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');

async function fixture(t, socs, options = {}) {
    const h = await createHarness();
    const a = h.adapter;
    t.after(async () => { await new Promise(resolve => a.onUnload(resolve)); await h.close(); });
    a.config = structuredClone(require('../ui/io-package.json').native);
    a.config.port = 8188;
    await a.migrateNativeConfig();
    await a.loadInstallerConfigFromState();
    a.config.emsApps.apps.storagefarm = { installed: true, enabled: true };
    a.config.enableStorageFarm = true;
    a.config.storageFarm = { enabled: true, mode: 'pool', selfMinSocPct: 10, storages: [] };
    a.config.storage = { ...a.config.storage, selfEnabled: true, selfMinSocPct: 10 };
    const set = (id, val, unit = 'W') => {
        h.states.set(id, { val, ts: Date.now(), ack: true });
        h.objects.set(id, { type: 'state', common: { type: typeof val === 'boolean' ? 'boolean' : 'number',
            unit, read: true, write: id.endsWith('.set') }, native: {} });
    };
    for (const [index, name] of ['empty', 'full'].entries()) {
        const prefix = `alias.0.${name}`;
        const row = { enabled: true, name, vendorProfile: 'generic', capacityKWh: 10,
            signedPowerId: `${prefix}.power`, socId: `${prefix}.soc`, setSignedPowerId: `${prefix}.set`,
            maxChargeW: 5000, maxDischargeW: index === 1 && options.zeroLimit ? 0 : 5000 };
        a.config.storageFarm.storages.push(row);
        set(row.signedPowerId, 0); set(row.setSignedPowerId, 0);
        if (socs[index] !== undefined) set(row.socId, socs[index], '%');
        if (index === 1 && options.dischargeDenied) {
            row.dischargeAllowedId = `${prefix}.allowed`;
            set(row.dischargeAllowedId, false, '');
        }
    }
    await a.ensureStorageFarmStates();
    await a.updateStorageFarmDerived('dispatch-diagnostics-test');
    if (options.reverseStatus) {
        const key = 'eos-admin.0.storageFarm.storagesStatusJson';
        const state = h.states.get(key);
        h.states.set(key, { ...state, val: JSON.stringify(JSON.parse(state.val).reverse()) });
    }
    const dispatch = async target => {
        const result = await a.applyStorageFarmTargetW(target, { source: 'eigenverbrauch' });
        const diagnostic = JSON.parse(h.states.get('eos-admin.0.storageFarm.lastDispatchJson').val);
        const writes = a.config.storageFarm.storages.map(row => h.states.get(row.setSignedPowerId).val);
        return { result, diagnostic, writes };
    };
    return { ...h, dispatch };
}

test('1%/98% pool dispatch preserves redistribution and explains only the actual per-member floor exclusion', async t => {
    for (const [socs, expected] of [[[1, 98], [0, 600]], [[98, 1], [600, 0]]]) {
        await t.test(socs.join('/'), async t => {
            const h = await fixture(t, socs, { reverseStatus: true });
            const { result, diagnostic, writes } = await h.dispatch(600);
            assert.deepEqual(writes, expected);
            assert.equal(result.acceptedDeliveredW, 600);
            assert.equal(diagnostic.availableDischargePowerW, 5000);
            assert.equal(diagnostic.dispatchStorages, 1);
            for (const [index, row] of diagnostic.results.entries()) {
                assert.equal(row.dispatchKey, `set-signed:alias.0.${index === 0 ? 'empty' : 'full'}.set`);
                assert.equal(row.statusMatch, 'dispatch-key');
                assert.equal(row.dischargeDispatchAvailable, true, 'original status capability remains separate');
                assert.equal(row.directionDispatchAvailable, socs[index] > 10);
                assert.equal(row.dischargeFloorSocPct, 10);
                assert.equal(row.effectiveMaxDischargeW, socs[index] > 10 ? 5000 : 0);
                assert.deepEqual(row.blockedReasons, socs[index] > 10 ? [] : ['soc_at_or_below_discharge_floor']);
                assert.equal(row.dischargeW, expected[index]);
            }
        });
    }
});

test('missing member SoC remains unknown in diagnostics and does not block the other member', async t => {
    const h = await fixture(t, [undefined, 98]);
    const { diagnostic, writes } = await h.dispatch(600);
    assert.deepEqual(writes, [0, 600]);
    assert.equal(diagnostic.results[0].soc, null);
    assert.deepEqual(diagnostic.results[0].blockedReasons, ['soc_missing']);
    assert.equal(diagnostic.availableDischargePowerW, 5000);
});

test('explicit zero limit and discharge prohibition remain blocking and are not relabelled as a SoC error', async t => {
    for (const [options, reason] of [[{ zeroLimit: true }, 'discharge_limit_zero'], [{ dischargeDenied: true }, 'discharge_not_allowed']]) {
        await t.test(reason, async t => {
            const h = await fixture(t, [1, 98], options);
            const { result, diagnostic, writes } = await h.dispatch(600);
            assert.deepEqual(writes, [0, 0]);
            assert.equal(result.reason, 'no-discharge-dispatchable-storage');
            assert.equal(diagnostic.availableDischargePowerW, 0);
            assert.equal(diagnostic.results[1].directionDispatchAvailable, false);
            assert.equal(diagnostic.results[1].effectiveMaxDischargeW, 0);
            assert.deepEqual(diagnostic.results[1].blockedReasons, [reason]);
        });
    }
});

test('idle and charge reports do not pretend that a discharge floor was applied to the current request', async t => {
    const h = await fixture(t, [1, 98]);
    for (const target of [0, -600]) {
        const { diagnostic, writes } = await h.dispatch(target);
        assert.equal(writes.reduce((sum, value) => sum + value, 0), target);
        for (const row of diagnostic.results) {
            assert.equal(row.dischargeFloorSocPct, null);
            assert.equal(row.effectiveMaxDischargeW, null);
            assert.deepEqual(row.blockedReasons, []);
        }
    }
});
