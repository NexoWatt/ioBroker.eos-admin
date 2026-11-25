'use strict';
// Actual charging runtime methods with isolated measurements; no hardware writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { ChargingManagementModule } = require('../ui/ems/modules/charging-management');
const { readFlowMeasurement } = require('../ui/lib/flow-measurement');
const now = Date.now();

test('charging never interprets invalid or stale derived measurements as zero load', () => {
    const module = Object.create(ChargingManagementModule.prototype);
    module.adapter = { config: { settings: { deviceStaleTimeoutSec: 30 } }, stateCache: {}, _nwGetNumberFromCache: () => 0 };
    for (const row of [undefined, { value: null, ts: now }, { value: false, ts: now }, { value: '', ts: now },
        { value: 50, ts: now - 31000 }, { value: 50, ts: now + 100000 }, { value: 50 }, { value: 50, ts: now, q: 64 }]) {
        module.adapter.stateCache.load = row;
        assert.equal(module._getAdapterNumberFromCache('load'), null);
        assert.equal(module._getAdapterNumberFromCache('load', 1234), 1234);
    }
    module.adapter.stateCache.load = { value: 0, ts: now, q: 0 };
    assert.equal(module._getAdapterNumberFromCache('load'), 0);
    module.adapter.stateCache.load = { value: 80, ts: now, q: 0 };
    assert.equal(module._getAdapterNumberFromCache('load'), 80);
});

// Execute the production candidate selection; the NVP envelope remains unchanged.
const source = fs.readFileSync(path.join(__dirname, '../ui/ems/modules/charging-management.js'), 'utf8');
const begin = source.indexOf('            let derivedBaseLoadW = null;');
const end = source.indexOf('\n            gridLocalSupportW =', begin);
assert.ok(begin > 0 && end > begin);
const select = vm.runInNewContext(`(async function () { let gridBaseLoadW; ${source.slice(begin, end)} return { gridBaseLoadW, derivedBaseLoadSource }; })`, {
    readFlowMeasurement, Date: class extends Date { static now() { return now; } }, staleTimeoutMs: 30000, gridBaseLoadRawW: 1700,
});

test('invalid derived candidates preserve measured NVP-minus-EV fallback; valid zero remains zero', async () => {
    for (const row of [null, { val: null, ts: now }, { val: false, ts: now }, { val: 0 },
        { val: 0, ts: now + 1 }, { val: 0, ts: now - 121000 }, { val: 0, ts: now, q: 64 }]) {
        const result = await select.call({ _getStateCached: async () => row });
        assert.equal(result.gridBaseLoadW, 1700);
        assert.equal(result.derivedBaseLoadSource, '');
    }
    const zero = await select.call({ _getStateCached: async () => ({ val: 0, ts: now, q: 0 }) });
    assert.equal(zero.gridBaseLoadW, 0);
    assert.equal(zero.derivedBaseLoadSource, 'derived.core.building.loadRestW');
});

test('invalid first derived candidate cannot mask a valid later building measurement', async () => {
    const result = await select.call({ _getStateCached: async id => ({ val: id === 'consumptionTotal' ? 2400 : null, ts: now }) });
    assert.equal(result.gridBaseLoadW, 2400);
    assert.equal(result.derivedBaseLoadSource, 'consumptionTotal');
});
