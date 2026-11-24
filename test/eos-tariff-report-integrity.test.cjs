'use strict';
/** Actual HTTP report route; only historical database replies are fixtures. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ts = require('typescript');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const STEP = 15 * 60 * 1000;
const START = Math.floor(Date.now() / STEP) * STEP - 3 * STEP;
async function fixture(t, data = {}, options = {}) {
    const h = await createHarness(); t.after(() => h.close());
    h.adapter.stateCache = { 'settings.dynamicTariff': { value: options.dynamic !== false },
        'settings.netFeeEnabled': { value: options.fee === true }, 'settings.price': { value: options.manual } };
    h.adapter._nwGetHistoryInstance = () => 'influxdb.0';
    h.adapter._nwGetHistoryDpCandidates = name => [name];
    let reads = 0;
    h.adapter._nwGetHistoryAvgSeriesAny = async ids => {
        reads++;
        if (options.failRead) throw new Error('fixture history unavailable');
        const key = ids[0].includes('providerCurrentEurPerKwh') ? 'gross' : ids[0];
        return data[key] || [];
    };
    const token = await h.login('admin');
    return { ...h, reads: () => reads, report: (from = START, to = START + STEP) =>
        h.request('/api/tariff/report?' + new URLSearchParams({ from, to }), { token }) };
}
const sample = (val, ts = START) => ({ ts, val });

test('missing tariff and import values remain unknown through interval and whole-period totals', async t => {
    const h = await fixture(t, { gross: [sample(null)], gridBuyPower: [sample(null)] }, { manual: 0.35 });
    const { status, data } = await h.report();
    assert.equal(status, 200); assert.equal(data.ok, true);
    const row = data.intervals[0];
    for (const key of ['baseEurPerKwh', 'totalEurPerKwh', 'importAvgW', 'importKwh', 'baseCostEur', 'totalCostEur']) assert.equal(row[key], null, key);
    for (const key of ['minPrice', 'maxPrice', 'avgPrice', 'importKwh', 'baseCost', 'netFeeCost', 'totalCost']) assert.equal(data.summary[key], null, key);
    assert.equal(data.meta.coverage.complete, false); assert.equal(data.meta.coverage.missingIntervals, 1);
    assert.equal(row.configuredPriceFallback, false, 'dynamic price gaps cannot borrow a configured fixed tariff');
});

test('real zero and canonical negative EUR prices retain their value and calculated costs', async t => {
    const h = await fixture(t, { gross: [sample(0), sample(-8.25, START + STEP)],
        gridBuyPower: [sample(0), sample(1000, START + STEP)] });
    const { data } = await h.report(START, START + 2 * STEP);
    assert.equal(data.intervals[0].totalEurPerKwh, 0); assert.equal(data.intervals[0].totalCostEur, 0);
    assert.equal(data.intervals[1].totalEurPerKwh, -8.25);
    assert.equal(data.intervals[1].baseEurPerKwh, -8.25);
    assert.equal(data.intervals[1].totalCostEur, -2.0625);
    assert.equal(data.summary.totalCost, -2.0625); assert.equal(data.summary.avgPrice, -8.25);
    assert.equal(data.summary.minPrice, -8.25); assert.equal(data.summary.maxPrice, 0);
    assert.equal(data.meta.coverage.complete, true);
});

test('missing quarters and pre-range samples are not indefinitely carried into report costs', async t => {
    const h = await fixture(t, { gross: [sample(0.30, START - STEP), sample(0.40)],
        gridBuyPower: [sample(1000, START - STEP), sample(2000)] });
    const { data } = await h.report(START, START + 2 * STEP);
    assert.equal(data.intervals[0].totalCostEur, 0.2);
    assert.equal(data.intervals[1].totalEurPerKwh, null);
    assert.equal(data.intervals[1].importKwh, null);
    assert.equal(data.summary.totalCost, null); assert.equal(data.summary.importKwh, null);
    assert.equal(data.summary.avgPrice, null); assert.equal(data.meta.coverage.completeIntervals, 1);
});

test('enabled missing network fee keeps its breakdown unknown while recorded total cost remains usable', async t => {
    const h = await fixture(t, { gross: [sample(-0.1)], gridBuyPower: [sample(1000)] }, { fee: true });
    const { data } = await h.report();
    assert.equal(data.intervals[0].netFeeEurPerKwh, null);
    assert.equal(data.intervals[0].baseEurPerKwh, null);
    assert.equal(data.summary.netFeeCost, null); assert.equal(data.summary.baseCost, null);
    assert.equal(data.summary.totalCost, -0.025); assert.equal(data.summary.complete, false);
});

test('static zero fallback is explicit and genuine network fees preserve the existing split', async t => {
    const h = await fixture(t, { priceNetFee: [sample(0.05)], gridBuyPower: [sample(1000)] }, { dynamic: false, manual: 0, fee: true });
    const { data } = await h.report();
    assert.equal(data.intervals[0].configuredPriceFallback, true);
    assert.equal(data.intervals[0].totalEurPerKwh, 0);
    assert.equal(data.intervals[0].baseEurPerKwh, -0.05);
    assert.equal(data.summary.baseCost, -0.0125); assert.equal(data.summary.netFeeCost, 0.0125);
    assert.equal(data.summary.totalCost, 0); assert.equal(data.meta.coverage.configuredPriceIntervals, 1);
});

test('an open current quarter is not reported as a complete quarter of imported energy', async t => {
    const from = Math.floor(Date.now() / STEP) * STEP;
    const h = await fixture(t, { gross: [sample(0.30, from)], gridBuyPower: [sample(1000, from)] });
    const { data } = await h.report(from, from + STEP);
    assert.equal(data.intervals[0].importAvgW, 1000); assert.equal(data.intervals[0].importKwh, null);
    assert.equal(data.intervals[0].totalCostEur, null); assert.equal(data.meta.coverage.openIntervals, 1);
    assert.equal(data.summary.totalCost, null); assert.equal(data.summary.complete, false);
});

test('malformed, reversed and over-730-day report ranges fail before history IO or allocation', async t => {
    const h = await fixture(t);
    const invalid = [['bad', START], ['', START], [START, START], [START + STEP, START],
        [START, START + (731 * 86400000)], [START, Number.MAX_SAFE_INTEGER], ['2026-02-31', '2026-03-02']];
    for (const [from, to] of invalid) {
        const response = await h.report(from, to);
        assert.equal(response.status, 400, String(from) + ':' + to);
        assert.equal(response.data.error, 'EOS_HISTORY_RANGE_INVALID');
    }
    assert.equal(h.reads(), 0);
});

test('730-day inclusive date ranges remain accepted without using a smaller chart limit', async t => {
    // Stop at the IO boundary: this verifies range admission without allocating
    // 70,080 intentionally empty table rows in the test process.
    const h = await fixture(t, {}, { failRead: true });
    const to = START;
    const response = await h.report(to - 730 * 86400000 + 1, to);
    assert.equal(response.status, 200); assert.equal(response.data.ok, false);
    assert.equal(h.reads(), 5, 'valid horizon reached the existing bounded history readers');
});

// Compile actual frontend functions without booting a browser. The surrounding
// formatting fixture deliberately reproduces legacy Number(null) behavior.
const frontend = ts.createSourceFile('tariff-report.ts', fs.readFileSync(path.join(__dirname, '../ui/src-ts/runtime-executables/www/tariff-report.ts'), 'utf8'), ts.ScriptTarget.ES2020, true);
function frontendFunction(name, context) {
    let node;
    function walk(candidate) { if (ts.isFunctionDeclaration(candidate) && candidate.name?.text === name) node = candidate; else ts.forEachChild(candidate, walk); }
    walk(frontend); assert.ok(node, name);
    return vm.runInNewContext(`(${node.getText(frontend)})`, context);
}
test('report formatting and CSV leave missing values empty while keeping zero and negative costs', () => {
    const reportNumber = frontendFunction('reportNumber', {});
    const csvNumber = frontendFunction('csvNumber', { reportNumber });
    for (const absent of [null, undefined, '', ' ', false]) {
        assert.equal(reportNumber(absent), undefined); assert.equal(csvNumber(absent), '');
    }
    assert.equal(csvNumber(0), '0,0000'); assert.equal(csvNumber(-8.25), '-8,2500');
    const grid = { children: [], innerHTML: '', appendChild(child) { this.children.push(child); } };
    const legacy = value => Number.isFinite(Number(value)) ? String(Number(value)) : '—';
    const C = { el: () => grid, fmtPrice: legacy, fmtMoney: legacy, fmtKwh: legacy, fmtNum: legacy, escapeHtml: String };
    const render = frontendFunction('renderSummary', { C, reportNumber, document: { createElement: () => ({}) } });
    render({ minPrice: -8.25, maxPrice: 0, avgPrice: null, importKwh: null, baseCost: null, netFeeCost: 0, totalCost: null, intervals: 2 }, {});
    assert.match(grid.children[0].innerHTML, /<b>-8.25<\/b>/);
    assert.match(grid.children[1].innerHTML, /<b>0<\/b>/);
    assert.match(grid.children[2].innerHTML, /<b>—<\/b>/);
    assert.match(grid.children[6].innerHTML, /<b>—<\/b>/);
    let csv;
    const exportCsv = frontendFunction('exportCsv', { csvNumber, state: { data: { meta: { start: START }, intervals: [
        { startTs: START, endTs: START + STEP, baseEurPerKwh: null, netFeeEurPerKwh: 0,
            totalEurPerKwh: -8.25, importKwh: 0.25, baseCostEur: null, netFeeCostEur: 0, totalCostEur: -2.0625 },
    ] } }, C: { fmtDateTime: String, downloadText: (_name, text) => { csv = text; } } });
    exportCsv();
    assert.deepEqual(csv.split('\n')[1].split(';').slice(2), ['', '0,0000', '-8,2500', '0,2500', '', '0,0000', '-2,0625']);
});
