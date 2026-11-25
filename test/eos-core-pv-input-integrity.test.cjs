'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { CoreLimitsModule } = require('../ui/ems/modules/core-limits');

function fixture(now) {
    const adapter = {
        config: { chargingManagement: { pvChargeReserveW: 0 } },
        stateCache: {
            'ems.gridPowerRawW': { value: 0, ts: now },
            'derived.core.pv.totalW': { value: 4000, ts: now },
            'chargingManagement.control.pvEvcsPhysicalPvManagedW': { value: 4000, ts: now },
        },
        _nwResolveBatteryFlowFromCache(options) {
            assert.equal(options.strictStale, true, 'central budget must request strict battery observation age');
            assert.equal(options.now, now);
            return { chargeW: 0, dischargeW: 0, src: 'missing' };
        },
    };
    const module = new CoreLimitsModule(adapter, null);
    return { adapter, module };
}

test('central PV budget rejects null, bad quality, future/missing timestamps and recovers from a real measurement', t => {
    const now = 1795610000000;
    t.mock.method(Date, 'now', () => now);
    for (const field of ['ems.gridPowerRawW', 'derived.core.pv.totalW', 'chargingManagement.control.pvEvcsPhysicalPvManagedW']) {
        for (const variant of ['null', 'boolean', 'quality', 'future', 'noTimestamp', 'stale']) {
            const { adapter, module } = fixture(now);
            const sample = adapter.stateCache[field];
            if (variant === 'null') sample.value = null;
            if (variant === 'boolean') sample.value = false;
            if (variant === 'quality') sample.q = 64;
            if (variant === 'future') sample.ts = now + 1;
            if (variant === 'noTimestamp') delete sample.ts;
            if (variant === 'stale') sample.ts = now - 90000;
            assert.equal(module._makeBudgetSnapshot(now, {}).gates.pv.effectiveW, 0, `${field} ${variant}`);
            adapter.stateCache[field] = { value: field === 'ems.gridPowerRawW' ? 0 : 4000, ts: now };
            assert.equal(module._makeBudgetSnapshot(now, {}).gates.pv.effectiveW, 4000, `${field} ${variant} recovery`);
        }
    }
});

test('fresh canonical PV including zero cannot be overruled by a higher parallel alias', t => {
    const now = 1795610000000;
    t.mock.method(Date, 'now', () => now);
    const { adapter, module } = fixture(now);
    adapter.stateCache.pvPower = { value: 9000, ts: now - 30000 };
    adapter.stateCache['derived.core.pv.totalW'] = { value: 2000, ts: now };
    adapter.stateCache['ems.gridPowerRawW'] = { value: 1000, ts: now };
    adapter.stateCache['chargingManagement.control.pvEvcsPhysicalPvManagedW'] = { value: 5700, ts: now };
    const snapshot = module._makeBudgetSnapshot(now, {});
    assert.equal(snapshot.gates.pv.effectiveW, 2000, '5.7kW existing EV demand is not evidence of 5.7kW available PV');
    assert.equal(snapshot.raw.pvPowerW, 2000);
    adapter.stateCache['derived.core.pv.totalW'] = { value: 0, ts: now };
    assert.equal(module._makeBudgetSnapshot(now, {}).gates.pv.effectiveW, 0, 'importing system has no valid PV hold at zero generation');
});

test('trusted PV hold expires even under repeated snapshots, then real evidence can restore the budget', t => {
    let now = 1795610000000;
    t.mock.method(Date, 'now', () => now);
    const { adapter, module } = fixture(now);
    adapter._nwResolveBatteryFlowFromCache = options => {
        assert.equal(options.strictStale, true);
        return { chargeW: 0, dischargeW: 0, src: 'missing' };
    };
    assert.equal(module._makeBudgetSnapshot(now, {}).gates.pv.effectiveW, 4000);
    const lastObserved = module._lastTrustedPvPhysicalCapTs;
    for (const elapsed of [10000, 20000, 30000, 40000]) {
        now = lastObserved + elapsed;
        adapter.stateCache['ems.gridPowerRawW'] = { value: 0, ts: now };
        adapter.stateCache['derived.core.pv.totalW'] = { value: 0, ts: now };
        adapter.stateCache['chargingManagement.control.pvEvcsPhysicalPvManagedW'] = { value: 4000, ts: now };
        const snapshot = module._makeBudgetSnapshot(now, {});
        assert.equal(snapshot.gates.pv.physicalHeld, true);
        assert.equal(module._lastTrustedPvPhysicalCapTs, lastObserved, 'holding cannot renew its own evidence time');
    }
    now = lastObserved + 45001;
    adapter.stateCache['ems.gridPowerRawW'] = { value: 0, ts: now };
    adapter.stateCache['derived.core.pv.totalW'] = { value: 0, ts: now };
    adapter.stateCache['chargingManagement.control.pvEvcsPhysicalPvManagedW'] = { value: 4000, ts: now };
    assert.equal(module._makeBudgetSnapshot(now, {}).gates.pv.effectiveW, 0);
    adapter.stateCache['derived.core.pv.totalW'] = { value: 3000, ts: now };
    assert.equal(module._makeBudgetSnapshot(now, {}).gates.pv.effectiveW, 3000);
    assert.equal(module._lastTrustedPvPhysicalCapTs, now);
});
