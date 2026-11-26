'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { numericMeasurement } = require('../ui/lib/installer-lifecycle');
const { readFlowMeasurement, sumFlowMeasurements } = require('../ui/lib/flow-measurement');
const { resolveNvpDisplay } = require('../ui/ems/services/measurement-freshness');
const { physicalPvSourceKey: nwPhysicalPvSourceKey, applyPvCapacityPlausibility: nwApplyPvCapacityPlausibility } = require('../ui/ems/services/pv-source-identity');
const source = fs.readFileSync(path.join(__dirname, '../ui/main.js'), 'utf8');
const parsed = ts.createSourceFile('main.js', source, ts.ScriptTarget.ES2022, true);
const names = new Set(['updateDerivedFlowStates', 'scheduleDerivedFlowUpdate', 'updateValue', '_nwPublishEvcsInputBinding',
    '_nwResolveGridImportExportFromCache', '_nwResolveBatteryFlowFromCache', '_nwResolveStorageFarmMetricsFromCache']);
const methods = [];
function visit(node) {
    if (ts.isMethodDeclaration(node) && names.has(node.name?.getText(parsed))) methods.push(node.getText(parsed));
    ts.forEachChild(node, visit);
}
visit(parsed);
assert.equal(methods.length, names.size);
let now = 1795608000000;
const Actual = vm.runInNewContext(`class Actual { ${methods.join('\n')} }; Actual`, {
    numericMeasurement, readFlowMeasurement, sumFlowMeasurements, resolveNvpDisplay, nwPhysicalPvSourceKey, nwApplyPvCapacityPlausibility,
    Date: class extends Date { static now() { return now; } },
});
function fixture(values = {}, options = {}) {
    const a = new Actual();
    a.config = { settings: { deviceStaleTimeoutSec: 60 }, datapoints: { pvPower: 'solar.power', gridPointPower: 'meter.power', batteryPower: 'battery.power', ...options.dps } };
    a.stateCache = Object.fromEntries(Object.entries({ pvPower: 2500, gridPointPower: 3800, batteryPower: 2800, ...values }).map(([key, value]) => [key, { value, ts: now - 1000 }]));
    a._derivedFlow = { last: {}, auto: { pvInverters: { list: [], cache: new Map() } } };
    a.evcsCount = options.evcsCount ?? 0;
    a.writes = {};
    a.setStateAsync = async (key, value) => { a.writes[key] = value; };
    a._derivedRefreshPvInvertersCache = async () => {};
    a._nwHasMappedDatapoint = key => !!a.config.datapoints[key];
    a._nwResolveGridImportExportFromCache = () => {
        const rec = readFlowMeasurement(a.stateCache, 'gridPointPower', now, 60000);
        const net = rec?.value;
        return { gridBuyRaw: net === undefined ? null : Math.max(0, net), gridSellRaw: net === undefined ? null : Math.max(0, -net), gridNetRaw: net ?? null,
            gridBuyW: Math.max(0, net ?? 0), gridSellW: Math.max(0, -(net ?? 0)), hasGrid: rec !== null, src: 'net-fresh', observedAt: rec?.ts ?? null };
    };
    a._nwResolveBatteryFlowFromCache = opts => {
        assert.equal(opts.strictStale, true);
        const rec = readFlowMeasurement(a.stateCache, 'batteryPower', now, 60000);
        return { chargeW: Math.max(0, -(rec?.value ?? 0)), dischargeW: Math.max(0, rec?.value ?? 0), src: rec ? 'batterySigned' : 'mapped-missing', observedAt: rec?.ts ?? null };
    };
    a._nwResolveStorageFarmMetricsFromCache = () => null;
    a._nwGetStorageControlAuthority = () => ({ selectedTopology: 'single', writerActive: false });
    a._nwConfiguredPvCapacityW = () => 0;
    a._nwGetCacheAgeMs = key => a.stateCache[key] ? now - a.stateCache[key].ts : null;
    a._nwRunEnergyFlowTsShadowComparison = () => ({});
    a._nwGetEnergyFlowTsMode = () => 'js';
    a._nwBuildEffectiveEnergyFlowValues = runtime => ({ ...runtime, buildingLoadW: runtime.loadTotalW, switchState: {} });
    a._nwEnergyFlowTsLiveTestStateFromSwitch = () => 'test';
    a.scheduleDerivedFlowUpdate = () => {};
    a.maybeUpdateEvcsSessionTracker = () => {};
    a.log = { debug() {} };
    return a;
}
const value = (a, key) => a.stateCache[key]?.value;

test('derived balance preserves observation age and valid zero during activity', async () => {
    const a = fixture({ pvPower: 5000, gridPointPower: -5000, batteryPower: 0 });
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), 0);
    assert.equal(value(a, 'derived.core.building.loadRestW'), 0);
    assert.equal(value(a, 'derived.core.building.quality'), 'ok');
    assert.equal(a.stateCache['derived.core.building.loadTotalW'].ts, now - 1000);
    const stamp = a.stateCache['derived.core.building.loadTotalW'].ts;
    now += 1000;
    await a.updateDerivedFlowStates();
    assert.equal(a.stateCache['derived.core.building.loadTotalW'].ts, stamp, 'recalculation is not a new observation');
});

test('a new meter sample received during PV discovery is eligible in the same balance', async () => {
    const a = fixture({ pvPower: null, gridPointPower: -1800, batteryPower: 2800 });
    const meterTimestamp = a.stateCache.gridPointPower.ts;
    a._derivedRefreshPvInvertersCache = async () => {
        await Promise.resolve();
        now += 250;
        a.stateCache.pvPower = { value: 1500, ts: now, q: 0 };
    };
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), 2500);
    assert.equal(a.stateCache['derived.core.building.loadTotalW'].ts, meterTimestamp);
});

test('new balance requests coalesce while a previous frame is being published', async () => {
    const a = fixture();
    const schedule = Actual.prototype.scheduleDerivedFlowUpdate.bind(a);
    a.scheduleDerivedFlowUpdate = schedule;
    const callbacks = [];
    a._nwSetTimeout = callback => { callbacks.push(callback); };
    let release;
    const firstWrite = new Promise(resolve => { release = resolve; });
    const reasons = [];
    a.updateDerivedFlowStates = async reason => {
        reasons.push(reason);
        if (reasons.length === 1) await firstWrite;
    };
    schedule('first');
    assert.equal(callbacks.length, 1);
    callbacks.shift()();
    schedule('meter');
    schedule('battery');
    assert.equal(callbacks.length, 0, 'do not start a frame while the prior one is publishing');
    release();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(callbacks.length, 1, 'process pending measurements once');
    callbacks.shift()();
    assert.deepEqual(reasons, ['first', 'battery']);
});

test('a direct meter update triggers a new frame and a derived mirror does not', () => {
    const a = fixture();
    const triggers = [];
    a.scheduleDerivedFlowUpdate = reason => triggers.push(reason);
    a.updateValue('consumptionTotal', 1000, now);
    a.updateValue('consumptionTotal', 1500, now, { raw: false });
    a.updateValue('settings.flowInvertGrid', true, now);
    assert.deepEqual(triggers, ['key:consumptionTotal', 'key:settings.flowInvertGrid']);
});

function useMeterResolvers(a) {
    a._nwRawValueCache = { ...a.stateCache };
    a._nwResolveGridImportExportFromCache = Actual.prototype._nwResolveGridImportExportFromCache;
    a._nwResolveBatteryFlowFromCache = Actual.prototype._nwResolveBatteryFlowFromCache;
    a._nwIsBatterySignInverted = () => false;
}

test('building and dashboard NVP use the same normalized sign and physical observation time', async () => {
    const a = fixture({ pvPower: 1500, gridPointPower: 1800, batteryPower: 2800 });
    useMeterResolvers(a);
    a.config.settings.flowInvertGrid = true;
    a._nwRawValueCache.gridPointPower.ts = now - 12000;
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), 2500);
    assert.equal(value(a, 'derived.core.grid.netW'), -1800);
    assert.equal(a.stateCache['derived.core.building.loadTotalW'].ts, now - 12000);
    assert.equal(a.stateCache['derived.core.grid.netW'].ts, now - 12000);
    a._nwRawValueCache.batteryPower = { value: -2800, ts: now, q: 0 };
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), null);
    assert.equal(value(a, 'derived.core.building.quality'), 'invalid-balance');
});

test('a signed grid mirror cannot replace a stale or bad-quality physical observation', async () => {
    const a = fixture({ 'ems.gridPowerRawW': 3100, 'ems.gridMeasurementFresh': true });
    useMeterResolvers(a);
    a._nwRawValueCache.gridPointPower = { value: 3100, ts: now - 61000, q: 0 };
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.grid.netW'), null);
    assert.equal(value(a, 'derived.core.building.quality'), 'missing-grid');
    a._nwRawValueCache.gridPointPower = { value: 3100, ts: now, q: 64 };
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), null);
    delete a._nwRawValueCache.gridPointPower;
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.grid.netW'), null, 'public cache alone cannot establish provenance');
});

test('split grid power uses the selected direction timestamp and requires both configured meters', async () => {
    const a = fixture({ gridBuyPower: 3500, gridSellPower: 1800 }, {
        dps: { gridPointPower: '', gridBuyPower: 'meter.import', gridSellPower: 'meter.export' },
    });
    useMeterResolvers(a);
    a._nwRawValueCache.gridBuyPower.ts = now - 12000;
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.grid.netW'), -1800);
    assert.equal(value(a, 'derived.core.building.loadTotalW'), 3500);
    assert.equal(a.stateCache['derived.core.building.loadTotalW'].ts, now - 1000);
    a._nwRawValueCache.gridBuyPower.q = 64;
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), null);
    assert.equal(value(a, 'derived.core.building.quality'), 'missing-grid');
});

test('farm balance validates battery-side power independently from converter power', async () => {
    const a = fixture({ pvPower: 1500, gridPointPower: -1800, 'storageFarm.totalBatteryPowerW': 2800 });
    useMeterResolvers(a);
    a._nwGetStorageControlAuthority = () => ({ selectedTopology: 'farm' });
    a._nwResolveStorageFarmMetricsFromCache = Actual.prototype._nwResolveStorageFarmMetricsFromCache;
    a._nwStorageFarmIsActiveFromCache = () => true;
    a._nwGetNumberFromCache = key => numericMeasurement(a.stateCache[key]?.value);
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), 2500);
    a.stateCache['storageFarm.totalPowerW'] = { value: 2800, ts: now, q: 0 };
    a.stateCache['storageFarm.totalBatteryPowerW'].q = 64;
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), null);
    assert.equal(value(a, 'derived.core.building.quality'), 'missing-storage');
});

test('impossible negative balance is unknown, never fabricated 100W or retained load', async () => {
    const a = fixture({ pvPower: 0, gridPointPower: 0, batteryPower: -2800 });
    a._derivedFlow.good = { loadTotalW: 4500, loadRestW: 3000, ts: now };
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), null);
    assert.equal(value(a, 'consumptionTotal'), null);
    assert.equal(value(a, 'derived.core.building.quality'), 'invalid-balance');
    assert.equal(a.writes['derived.core.building.loadTotalW'].val, null);
});

test('fresh direct consumption is authoritative, including a measured zero', async () => {
    const a = fixture({ consumptionTotal: 0 }, { dps: { consumptionTotal: 'house.power' } });
    a._nwBuildEffectiveEnergyFlowValues = runtime => ({ ...runtime, buildingLoadW: 9000, switchState: {} });
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), 0);
    assert.equal(value(a, 'derived.core.building.loadSource'), 'mapped:consumptionTotal');
});

test('missing, stale, future, invalid and bad quality sources cannot produce fresh building demand', async () => {
    for (const key of ['pvPower', 'gridPointPower', 'batteryPower']) {
        for (const variant of ['null', 'boolean', 'stale', 'future', 'noTimestamp', 'quality']) {
            const a = fixture();
            if (variant === 'null') a.stateCache[key].value = null;
            if (variant === 'boolean') a.stateCache[key].value = false;
            if (variant === 'stale') a.stateCache[key].ts = now - 60001;
            if (variant === 'future') a.stateCache[key].ts = now + 1;
            if (variant === 'noTimestamp') delete a.stateCache[key].ts;
            if (variant === 'quality') a.stateCache[key].q = 64;
            await a.updateDerivedFlowStates();
            assert.equal(value(a, 'derived.core.building.loadTotalW'), null, `${key} ${variant}`);
        }
    }
});

test('negative remaining demand and missing consumers remain distinct from zero', async () => {
    const a = fixture({ consumptionTotal: 2300, 'evcs.totalPowerW': 10700 }, { evcsCount: 1, dps: { consumptionTotal: 'house.power' } });
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), 2300);
    assert.equal(value(a, 'derived.core.building.loadRestW'), null);
    assert.equal(value(a, 'derived.core.building.quality'), 'invalid-rest-balance');
    const diag = JSON.parse(value(a, 'derived.core.building.inputsJson'));
    assert.equal(diag.balance.rawLoadRestW, -8400);
    a.stateCache['evcs.totalPowerW'].ts = now - 70000;
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadRestW'), null);
    assert.equal(value(a, 'derived.core.building.quality'), 'missing-consumer');
});

test('configured missing extra producers/consumers do not silently disappear', async () => {
    const producer = fixture({}, { dps: { producer1Power: 'other.power' } });
    await producer.updateDerivedFlowStates();
    assert.equal(value(producer, 'derived.core.building.loadTotalW'), null);
    const consumer = fixture({}, { dps: { consumer1Power: 'heat.power' } });
    await consumer.updateDerivedFlowStates();
    assert.equal(value(consumer, 'derived.core.building.loadTotalW'), 9100);
    assert.equal(value(consumer, 'derived.core.building.loadRestW'), null);
});

test('duplicate physical PV aliases are counted once in the backend balance', async () => {
    const a = fixture({ producer1Power: 2500 }, { dps: { producer1Power: 'solar.power' } });
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), 9100);
    a.config.datapoints.producer1Power = 'other.power';
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), 11600);
});

test('EV aggregate becomes unknown if a configured member is unavailable, and retains oldest source time', () => {
    const a = fixture({ 'evcs.2.powerW': 7000 }, { evcsCount: 2 });
    a.stateCache['evcs.2.powerW'].ts = now - 30000;
    a.updateValue('evcs.1.powerW', 3700, now);
    assert.equal(value(a, 'evcs.totalPowerW'), 10700);
    assert.equal(a.stateCache['evcs.totalPowerW'].ts, now - 30000);
    a.stateCache['evcs.2.powerW'].ts = now - 70000;
    a.updateValue('evcs.1.powerW', 3700, now);
    assert.equal(value(a, 'evcs.totalPowerW'), null);
    a.updateValue('evcs.2.powerW', 0, now);
    assert.equal(value(a, 'evcs.totalPowerW'), 3700);
});

test('measurement reader does not evaluate accessors or inherited cache records', () => {
    const fail = () => { throw new Error('must never invoke'); };
    for (const field of ['value', 'ts', 'q']) {
        const record = { value: 12, ts: now };
        Object.defineProperty(record, field, { get: fail });
        assert.equal(readFlowMeasurement({ sample: record }, 'sample', now, 60000), null);
    }
    assert.equal(readFlowMeasurement(Object.create({ sample: { value: 12, ts: now } }), 'sample', now, 60000), null);
});

test('Auto PV rejects bad quality and missing timestamps; persistent PV agrees with API snapshot', async () => {
    for (const variant of ['quality', 'noTimestamp', 'future', 'invalid']) {
        const a = fixture();
        delete a.config.datapoints.pvPower;
        const sample = { val: 2500, ts: now - 1000 };
        if (variant === 'quality') sample.q = 64;
        if (variant === 'noTimestamp') delete sample.ts;
        if (variant === 'future') sample.ts = now + 1;
        if (variant === 'invalid') sample.val = false;
        a._derivedFlow.auto.pvInverters = { list: [{ powerId: 'pv.raw' }], cache: new Map([['pv.raw', sample]]) };
        await a.updateDerivedFlowStates();
        assert.equal(value(a, 'derived.core.pv.totalW'), null, variant);
        assert.equal(a.writes['derived.core.pv.totalW'].val, null, variant);
        assert.equal(value(a, 'derived.core.building.loadTotalW'), null, variant);
    }
    const a = fixture();
    await a.updateDerivedFlowStates();
    assert.equal(a.writes['derived.core.pv.totalW'].val, 2500);
    assert.equal(a.writes['derived.core.pv.totalW'].ts, now - 1000);
});

test('TS candidate cannot resurrect an invalid balance or overwrite a fresh direct observation', async () => {
    const a = fixture({ pvPower: null });
    a._nwBuildEffectiveEnergyFlowValues = runtime => ({ ...runtime, buildingLoadW: 99999, switchState: { publishedSource: 'ts-normal' } });
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), null);
});

test('extra production adds distinct configured BHKW and generator sources once with shared snapshot contract', async () => {
    const a = fixture({ producer1Power: 2000, 'bhkw.devices.b1.powerW': 2000, 'generator.devices.g1.powerW': 1000 }, { dps: { producer1Power: 'chp.power' } });
    a.config.bhkw = { devices: [{ enabled: true, powerReadId: 'chp.power', idx: 1 }] };
    a.config.generator = { devices: [{ enabled: true, powerReadId: 'generator.power', idx: 1 }] };
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.production.extraW'), 3000);
    assert.equal(value(a, 'derived.core.building.loadTotalW'), 12100);
    a.stateCache['generator.devices.g1.powerW'].ts = now - 70000;
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.production.extraW'), null);
    assert.equal(value(a, 'derived.core.building.loadTotalW'), null);
});

test('source timestamps include only selected contributors and numeric text has bounded decimal syntax', async () => {
    const a = fixture({ producer1Power: 5000 });
    a.stateCache.producer1Power.ts = now - 59000;
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), 9100);
    assert.equal(a.stateCache['derived.core.pv.totalW'].ts, now - 1000);
    assert.equal(a.stateCache['derived.core.building.loadTotalW'].ts, now - 1000);
    assert.equal(readFlowMeasurement({ p: { value: '1,5', ts: now } }, 'p', now, 60000).value, 1.5);
    for (const invalid of ['0x10', '1e99', '1'.repeat(65), '', ' ', false, null]) {
        assert.equal(readFlowMeasurement({ p: { value: invalid, ts: now } }, 'p', now, 60000), null);
    }
});

test('legacy flow-slot aliases remain part of the balance and duplicate consumer mappings subtract once', async () => {
    const a = fixture({ 'flow.pv1': 1000, 'flow.heat1': 500 });
    a._nwGetFlowSlotInfo = (kind, index) => index === 1 || (kind === 'consumers' && index === 2)
        ? { objectId: kind === 'producers' ? 'extra.pv' : 'heat.power', stateKey: kind === 'producers' ? 'flow.pv1' : 'flow.heat1' } : null;
    await a.updateDerivedFlowStates();
    assert.equal(value(a, 'derived.core.building.loadTotalW'), 10100);
    assert.equal(value(a, 'derived.core.building.loadRestW'), 9600);
});

test('EV mirror carries source quality and timestamp through actual updateValue aggregation', async () => {
    const a = fixture({}, { evcsCount: 1 });
    a.namespace = 'eos-admin.0';
    a._nwScaleMappedValue = (_key, _id, raw) => raw;
    a._nwEvcsMirrorValue = (_binding, raw) => raw;
    const binding = { key: 'evcs.1.powerW', configuredId: 'charger.power' };
    await a._nwPublishEvcsInputBinding(binding, { val: 3700, ts: now - 1000, q: 64 }, 'charger.power');
    assert.equal(a.stateCache['evcs.1.powerW'].q, 64);
    assert.equal(a._nwRawValueCache['evcs.1.powerW'].q, 64);
    assert.equal(value(a, 'evcs.totalPowerW'), null);
    await a._nwPublishEvcsInputBinding(binding, { val: 3700, ts: now - 1000, q: 0 }, 'charger.power');
    assert.equal(value(a, 'evcs.totalPowerW'), 3700, 'quality change with same value/time must be applied');
    await a._nwPublishEvcsInputBinding(binding, { val: 3700 }, 'charger.power');
    assert.equal(a.stateCache['evcs.1.powerW'].ts, null);
    assert.equal(value(a, 'evcs.totalPowerW'), null);
    assert.equal(a.writes['evcs.1.powerW'].q, 64);
});
