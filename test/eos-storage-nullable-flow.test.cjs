'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../ui/src-ts/runtime-executables/ems/modules/storage-control.ts'), 'utf8');
const parsed = ts.createSourceFile('storage-control.ts', source, ts.ScriptTarget.ES2022, true);
const declarations = new Map();
function collect(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isVariableDeclaration(node)) && node.name) declarations.set(node.name.getText(parsed), node.getText(parsed));
    ts.forEachChild(node, collect);
}
collect(parsed);
const { readFlowMeasurement } = require('../ui/lib/flow-measurement');
const context = vm.createContext({readFlowMeasurement});
for (const name of ['strictFiniteNumber', 'num']) vm.runInContext(declarations.get(name), context);
const readTarget = vm.runInContext(`(function readTarget(adapter) {
    const self = { adapter };
    return (function () {
        const evcsStorageProtectedLoadW = 0;
        const stripProtectedEvcsLoadW = w => Math.max(0, w);
        const importRawWithoutProtectedEvcsW = 400;
        const battPowerW = 100;
        let feneconAcLoadMemo = null;
        const ${declarations.get('readCacheNumber')};
        const ${declarations.get('getFeneconAcLoadTargetW')};
        return getFeneconAcLoadTargetW();
    }).call(self);
})`, context);
const FeedForward = vm.runInContext(`class FeedForward { ${declarations.get('_buildIndependentPvLoadFeedForward')} }; FeedForward`, context);
const record = value => ({ value, ts: 1795608000000 });
const adapter = states => ({ stateCache: states, _nwGetNumberFromCache: () => null });

test('Fenecon AC load uses the next real measurement when derived load is unknown, preserving actual zero', () => {
    for (const invalid of [null, undefined, false, true, '', ' ', NaN, Infinity, {}, []]) {
        const selected = readTarget(adapter({ 'derived.core.building.loadTotalW': record(invalid), consumptionTotal: record(1700) }));
        assert.equal(selected.w, 1700, String(invalid));
        assert.equal(selected.source, 'consumptionTotal');
    }
    const zero = readTarget(adapter({ 'derived.core.building.loadTotalW': record(0), consumptionTotal: record(1700) }));
    assert.equal(zero.w, 0);
    assert.equal(zero.source, 'derived.loadTotalW');
});

test('Fenecon missing derived, mapped and rest demand reaches existing NVP/battery fallback instead of invented zero', () => {
    for (const states of [{}, { 'derived.core.building.loadTotalW': record(null), consumptionTotal: record(null), 'derived.core.building.loadRestW': record(null) }]) {
        const selected = readTarget(adapter(states));
        assert.equal(selected.w, 500);
        assert.equal(selected.source, 'approx.import+battery');
    }
});

test('independent feed-forward rejects missing, empty and boolean load/PV through cache and fresh-helper paths', () => {
    const now = 1795608000000;
    const settings = { nowMs: now, staleMs: 15000, maxSkewMs: 15000, rawNvpW: 500, nvpAgeMs: 0, targetNvpW: 0 };
    for (const helper of [false, true]) {
        for (const key of ['consumptionTotal', 'pvPower']) {
            for (const invalid of [null, undefined, false, true, '', ' ', NaN, Infinity, {}, []]) {
                const states = { consumptionTotal: record(3000), pvPower: record(1000), [key]: record(invalid) };
                const subject = new FeedForward();
                subject.adapter = { stateCache: states, config: { datapoints: { consumptionTotal: 'house.power', pvPower: 'pv.power' } } };
                if (helper) subject.adapter._nwGetNumberFromCacheFresh = selected => states[selected]?.value;
                const result = subject._buildIndependentPvLoadFeedForward(settings);
                assert.equal(result.usable, false, `${helper}/${key}/${String(invalid)}`);
                assert.equal(result.targetW, null);
                assert.equal(key === 'consumptionTotal' ? result.loadW : result.pvW, null);
            }
        }
    }
    const subject = new FeedForward();
    subject.adapter = { stateCache: { consumptionTotal: record(0), pvPower: record(0) }, config: { datapoints: { consumptionTotal: 'house.power', pvPower: 'pv.power' } } };
    const result = subject._buildIndependentPvLoadFeedForward(settings);
    assert.equal(result.usable, true);
    assert.equal(result.targetW, 0);
});

test('independent derived mirror remains ineligible when source says mapped but measurement is unknown', () => {
    const subject = new FeedForward();
    subject.adapter = { stateCache: { 'derived.core.building.loadSource': record('mapped:consumptionTotal'), 'derived.core.building.loadTotalW': record(null), pvPower: record(1000) }, config: { datapoints: { pvPower: 'pv.power' } } };
    const result = subject._buildIndependentPvLoadFeedForward({ nowMs: 1795608000000, rawNvpW: 500, nvpAgeMs: 0 });
    assert.equal(result.usable, false);
    assert.equal(result.loadW, null);
});

test('a bad PV sample cannot reverse the generic storage writer from discharge to charge', async () => {
    const { createRequire } = require('node:module');
    const fixtureFile = path.join(__dirname, '../ui/scripts/verify-storage-pv-load-feedforward-zero-stop.js');
    const fixtureSource = fs.readFileSync(fixtureFile, 'utf8').split('(async () => {')[0];
    const { directCache, makeAdapter, makeDp, SpeicherRegelungModule } = vm.runInNewContext(
        fixtureSource + '\n;({directCache, makeAdapter, makeDp, SpeicherRegelungModule});',
        { require: createRequire(fixtureFile), Date, console },
    );
    for (const [label, patch, expected] of [
        ['valid', { q: 0 }, -1150], ['device reports error', { q: 64 }, 1450],
        ['timestamp missing', { ts: null }, 1450], ['future', { ts: Date.now() + 60000 }, 1450],
        ['stale', { ts: Date.now() - 65000 }, 1450],
    ]) {
        const stateCache = directCache({ loadW: 4700, pvW: 5800 });
        Object.assign(stateCache.pvPower, patch);
        const adapter = makeAdapter({stateCache});
        const dp = makeDp({ profile: 'generic', coupling: 'ac', actualW: 0, includeActual: true, gridW: 1500 });
        const controller = new SpeicherRegelungModule(adapter, dp);
        controller._lastTargetW = -2700;
        controller._lastSource = 'pv';
        await controller.tick();
        assert.equal(dp.lastWrite('st.targetPowerW'), expected, label);
    }
});

test('self-consumption stops on verified export after loss of battery feedback, preserving measured ramp and the target band', () => {
    const { resolveStorageAntiExportTarget } = require('../ui/ems/modules/storage-control');
    const probe = (changes = {}) => resolveStorageAntiExportTarget({
        requestedTargetW: 1400, commandAnchorW: 4950, storageActualW: null,
        nvpW: -3500, nvpSampleTs: 10000, now: 10000, targetNvpW: 50,
        deadbandW: 50, graceMs: 2000, dischargeFeedbackLost: true, ...changes,
    });
    const stop = probe();
    assert.equal(stop.targetW, 0);
    assert.equal(stop.explicitStop, true);
    assert.equal(stop.status, 'stop-export-without-feedback');
    assert.equal(probe({ nvpW: 50 }).targetW, 1400, 'steady near-zero grid remains within the hold band');
    assert.equal(probe({ storageActualW: 4950, dischargeFeedbackLost: false }).targetW, 1400,
        'fresh measured discharge may be proportionally reduced');
    assert.equal(probe({ targetNvpW: -4000, dischargeFeedbackLost: false }).targetW, 1400,
        'an expressly permitted export remains within its own target');
    const recovery = probe({ nvpW: 1500, storageActualW: 0, dischargeFeedbackLost: false });
    assert.ok(recovery.targetW > 0);
    assert.equal(recovery.explicitStop, false);
});
