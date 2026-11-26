'use strict';
// Executes the actual History consumer and its sink; controlled cache/physical resolvers only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { numericMeasurement } = require('../ui/lib/installer-lifecycle');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'ui/src-ts/runtime-executables/main.ts'), 'utf8');
const parsed = ts.createSourceFile('main.ts', source, ts.ScriptTarget.ES2022, true);
const wanted = new Set(['updateHistorieExportStates', '_nwLiveInputMaxAgeMs', '_nwGetNumberFromCache', '_nwGetNumberFromCacheFresh', '_nwGetCacheAgeMs', '_nwSetHistorieValue']);
const methods = [];
function visit(node) {
    if (ts.isMethodDeclaration(node) && wanted.has(node.name?.getText(parsed))) methods.push(node.getText(parsed));
    ts.forEachChild(node, visit);
}
visit(parsed);
assert.equal(methods.length, wanted.size);
const now = 1795543200000;
const ctx = vm.createContext({ numericMeasurement, nwNormalizeStorageDatapointsConfig: require('../ui/ems/services/storage-datapoint-config').normalizeStorageDatapointsConfig, nwPhysicalPvSourceKey: require('../ui/ems/services/pv-source-identity').physicalPvSourceKey, Date: class extends Date { static now() { return now; } } });
const ActualMethods = vm.runInContext(`class ActualMethods {\n${methods.join('\n')}\n}; ActualMethods;`, ctx);
function fixture(values = {}, opts = {}) {
    const a = new ActualMethods();
    a.stateCache = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value, ts: now }]));
    a.config = { datapoints: {}, peakShaving: { atypical: { review: { influxLogEnabled: false } } }, ...opts.config };
    a.config.settings = { deviceStaleTimeoutSec: 60, ...a.config.settings };
    a.writes = {};
    a.evcsCount = opts.evcsCount ?? 0;
    a.setLocalStateWithCache = (key, value, stamp) => { a.writes[key] = { value, stamp }; };
    a._nwResolveGridImportExportFromCache = () => ({ gridBuyW: 1000, gridSellW: 0, hasGrid: true, ...opts.grid });
    a._nwResolveBatteryFlowFromCache = options => {
        assert.equal(options.strictStale, true);
        return { chargeW: 0, dischargeW: 0, observedAt: now, ...opts.battery };
    };
    a._nwGetStorageControlAuthority = () => ({ selectedTopology: opts.topology || 'none' });
    a._nwResolveStorageFarmMetricsFromCache = () => opts.farm || null;
    a._nwMergeStorageFarmPvWithBase = base => ({ totalW: base + 3000 });
    return a;
}
const value = (a, key) => a.writes[key]?.value;

test('History reads only own data cache records and never invokes configured cache accessors', async () => {
    for (const variant of ['inherited-record', 'entry-getter', 'value-getter', 'timestamp-getter', 'quality-getter']) {
        const a = fixture({ productionTotal: 500, consumptionTotal: 600 });
        const fail = () => { throw new Error('cache getter must never run'); };
        if (variant === 'inherited-record') Object.setPrototypeOf(a.stateCache, { pvPower: { value: 9999, ts: now } });
        else if (variant === 'entry-getter') Object.defineProperty(a.stateCache, 'pvPower', { get: fail });
        else {
            a.stateCache.pvPower = { value: 9999, ts: now };
            Object.defineProperty(a.stateCache.pvPower, variant === 'value-getter' ? 'value' : variant === 'timestamp-getter' ? 'ts' : 'q', { get: fail });
        }
        await a.updateHistorieExportStates();
        assert.equal(value(a, 'historie.core.pv.totalW'), 500, variant);
    }
});

test('History uses real PV/load fallbacks when derived states are absent or stale; fresh zero stays zero', async () => {
    for (const stale of [false, true]) {
        const a = fixture({ pvPower: 5000, consumptionTotal: 6000, 'settings.price': 0.25 });
        if (stale) {
            a.stateCache['derived.core.pv.totalW'] = { value: 9999, ts: now - 90000 };
            a.stateCache['derived.core.building.loadTotalW'] = { value: 8888, ts: now - 90000 };
        }
        await a.updateHistorieExportStates();
        assert.equal(value(a, 'historie.core.pv.totalW'), 5000);
        assert.equal(value(a, 'historie.core.building.loadTotalW'), 6000);
        assert.equal(value(a, 'historie.core.building.loadRestW'), 6000, 'no configured EV remains a valid zero contribution');
    }
    const zero = fixture({ 'derived.core.pv.totalW': 0, 'derived.core.building.loadTotalW': 0, pvPower: 5000, consumptionTotal: 6000 });
    await zero.updateHistorieExportStates();
    assert.equal(value(zero, 'historie.core.pv.totalW'), 0);
    assert.equal(value(zero, 'historie.core.building.loadTotalW'), 0);
});

test('History never adds DC PV to the already merged canonical derived total', async () => {
    const a = fixture({ 'derived.core.pv.totalW': 5000, 'derived.core.building.loadTotalW': 6000, 'speicher.dcPvPowerW': 3000 },
        { topology: 'single', config: { datapoints: {}, storage: { coupling: 'dc', datapoints: { dcPvPowerObjectId: 'hybrid.pv' } }, peakShaving: { atypical: { review: { influxLogEnabled: false } } } } });
    await a.updateHistorieExportStates();
    assert.equal(value(a, 'historie.core.pv.totalW'), 5000);
    delete a.stateCache['derived.core.pv.totalW'];
    a.stateCache.pvPower = { value: 2000, ts: now };
    await a.updateHistorieExportStates();
    assert.equal(value(a, 'historie.core.pv.totalW'), 5000, 'without canonical total, fresh AC+DC fallback still works');
});

test('Farm PV fallback merges once and missing/stale farm SoC is not recorded as zero', async () => {
    const a = fixture({ pvPower: 2000, 'storageFarm.totalPvPowerW': 3000, 'storageFarm.totalSocOnline': null },
        { topology: 'farm', farm: { active: true, soc: null } });
    await a.updateHistorieExportStates();
    assert.equal(value(a, 'historie.core.pv.totalW'), 5000);
    assert.equal(value(a, 'historie.core.storage.socPct'), undefined);
    a.stateCache['storageFarm.totalSocOnline'] = { value: 45, ts: now - 90000 };
    await a.updateHistorieExportStates();
    assert.equal(value(a, 'historie.core.storage.socPct'), undefined);
    a.stateCache['storageFarm.totalSoc'] = { value: 0, ts: now };
    await a.updateHistorieExportStates();
    assert.equal(value(a, 'historie.core.storage.socPct'), 0, 'genuine empty battery is retained');
});

test('missing/null/boolean prices never create a free provider price; configured manual fallback is retained', async () => {
    for (const raw of [null, undefined, false, true, '', ' ']) {
        const a = fixture({ 'settings.dynamicTariff': true, 'settings.price': 0.35,
            'tarif.preisAktuellEurProKwh': raw, 'tarif.preisDurchschnittEurProKwh': raw });
        await a.updateHistorieExportStates();
        assert.equal(value(a, 'historie.tariff.totalEurPerKwh'), 0.35);
        assert.equal(value(a, 'historie.tariff.providerCurrentEurPerKwh'), undefined);
        assert.equal(value(a, 'historie.tariff.providerAverageEurPerKwh'), undefined);
    }
});

test('provider price freshness flag, age, quality and timestamp are respected without changing manual tariff mode', async () => {
    for (const variant of ['flag', 'stale', 'future', 'noTimestamp', 'quality']) {
        const a = fixture({ 'settings.dynamicTariff': true, 'settings.price': 0.35, 'tarif.preisAktuellEurProKwh': 0.89 });
        if (variant === 'flag') a.stateCache['tarif.currentPriceFresh'] = { value: false, ts: now };
        if (variant === 'stale') a.stateCache['tarif.preisAktuellEurProKwh'].ts = now - 91 * 60000;
        if (variant === 'future') a.stateCache['tarif.preisAktuellEurProKwh'].ts = now + 1000;
        if (variant === 'noTimestamp') delete a.stateCache['tarif.preisAktuellEurProKwh'].ts;
        if (variant === 'quality') a.stateCache['tarif.preisAktuellEurProKwh'].q = 64;
        await a.updateHistorieExportStates();
        assert.equal(value(a, 'historie.tariff.totalEurPerKwh'), 0.35, variant);
        assert.equal(value(a, 'historie.tariff.providerCurrentEurPerKwh'), undefined, variant);
    }
    const manual = fixture({ 'settings.dynamicTariff': false, 'settings.price': 0.35, 'tarif.preisAktuellEurProKwh': 0.89 });
    await manual.updateHistorieExportStates();
    assert.equal(value(manual, 'historie.tariff.totalEurPerKwh'), 0.35);
    assert.equal(value(manual, 'historie.tariff.providerCurrentEurPerKwh'), 0.89, 'fresh provider diagnostic remains independent of optimization');
});

test('zero and negative canonical EUR prices and net-fee decomposition retain exact values', async () => {
    for (const price of [0, -0.24, -8.5, 8.5]) {
        const a = fixture({ 'settings.dynamicTariff': true, 'settings.price': 0.35, 'tarif.preisAktuellEurProKwh': price,
            'tarif.currentPriceFresh': true, 'settings.netFeeEnabled': true, 'tarif.netFeeMode': 'HT', 'settings.netFeePriceHt': 0.1 });
        await a.updateHistorieExportStates();
        assert.equal(value(a, 'historie.tariff.totalEurPerKwh'), price);
        assert.equal(value(a, 'historie.tariff.baseEurPerKwh'), price - 0.1);
        assert.equal(value(a, 'historie.tariff.netFeeEurPerKwh'), 0.1);
    }
});

test('missing grid/battery/PV measurements produce gaps, never fresh invented zeros', async () => {
    const a = fixture({}, { grid: { gridBuyW: 0, gridSellW: 0, hasGrid: false }, battery: { chargeW: 0, dischargeW: 0, src: 'mapped-missing' } });
    await a.updateHistorieExportStates();
    for (const key of ['grid.netW', 'grid.buyW', 'grid.sellW', 'pv.totalW', 'building.loadTotalW', 'storage.chargeW', 'storage.dischargeW', 'ev.totalW']) {
        assert.equal(value(a, `historie.core.${key}`), undefined, key);
    }
});

test('stale raw observations and farm aggregate are not re-stamped as new History samples', async () => {
    const a = fixture({ pvPower: 5000, consumptionTotal: 6000, 'evcs.1.powerW': 2000, 'evcs.totalPowerW': 2000 },
        { evcsCount: 1, topology: 'farm', farm: { active: true, soc: 45 }, battery: { chargeW: 1000, dischargeW: 0, src: 'storageFarmNet', staleMs: { farmPower: 90000 } } });
    for (const record of Object.values(a.stateCache)) record.ts = now - 90000;
    await a.updateHistorieExportStates();
    for (const key of ['pv.totalW', 'building.loadTotalW', 'storage.chargeW', 'storage.dischargeW', 'ev.totalW']) {
        assert.equal(value(a, `historie.core.${key}`), undefined, key);
    }
    assert.equal(value(a, 'historie.evcs.lp1.powerW'), undefined);
});

test('the History sink rejects invalid data and retains real zero/negative measurements', () => {
    const a = fixture();
    for (const bad of [null, undefined, false, true, '', ' ', {}, [], NaN, Infinity]) a._nwSetHistorieValue('bad', bad, now);
    assert.equal(value(a, 'bad'), undefined);
    for (const good of [0, -200, 5000]) { a._nwSetHistorieValue('good', good, now, 0); assert.equal(value(a, 'good'), good); }
});


test('History requires the configured independent DC input, accepts real zero and counts equal distinct readings', async () => {
    const settings = { topology:'single', config: {datapoints:{pvPower:'solar.site'},
        storage:{coupling:'dc', datapoints:{dcPvPowerObjectId:'hybrid.dc'}}} };
    for (const [dc, expected] of [[0,1000],[1000,2000],[null,undefined]]) {
        const a = fixture({pvPower:1000,'speicher.dcPvPowerW':dc},settings);
        await a.updateHistorieExportStates();
        assert.equal(value(a,'historie.core.pv.totalW'),expected);
    }
    const night = fixture({'speicher.dcPvPowerW':0},{topology:'single',config:{datapoints:{},storage:settings.config.storage}});
    await night.updateHistorieExportStates();
    assert.equal(value(night,'historie.core.pv.totalW'),0);
});


test('History respects explicit unknown aggregate while a stale individual generator still reports a plausible partial value', async () => {
    const a = fixture({pvPower:1000, 'derived.core.pv.totalW': null});
    await a.updateHistorieExportStates();
    assert.equal(value(a,'historie.core.pv.totalW'), undefined);
    assert.equal(value(a,'historie.core.building.loadTotalW'), undefined);
});
