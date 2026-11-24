'use strict';
// Execute actual browser pricing functions; record Canvas calls without claiming browser layout.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const filename = process.env.EOS_HISTORY_SOURCE || path.resolve(__dirname, '../ui/src-ts/runtime-executables/www/history.ts');
const source = fs.readFileSync(filename, 'utf8');
const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const wanted = new Set(['historyNumericValue', 'toTsMs', 'normalizeNumericSeries', 'valueAtHold', 'aggregateEnergyKWh', 'buildPricingIntervals', 'aggregatePricingIntervals', 'summarizePricingIntervals', 'bucketizeRange', 'drawPricingHistoryChart', 'formatMoney2', 'formatPrice2', 'buildPricingNote']);
const declarations = [];
function visit(node) {
    if (ts.isFunctionDeclaration(node) && wanted.has(node.name?.text)) declarations.push(node.getText(parsed));
    ts.forEachChild(node, visit);
}
visit(parsed);
const from = 1800000000000;
const quarter = 900000;
function fixture() {
    const paths = []; let current = [];
    const labels = [];
    const priceCtx = { save() {}, restore() {}, clearRect() {}, fillRect() {}, fillText(...args) { labels.push(args); }, beginPath() { current = []; }, moveTo(x, y) { current.push(['move', x, y]); }, lineTo(x, y) { current.push(['line', x, y]); }, stroke() { paths.push(current.slice()); }, setLineDash() {} };
    const context = { module: { exports: {} }, Map, Number, Date, priceCanvas: { width: 800, height: 400 }, priceCtx,
        document: { getElementById: () => ({ classList: { contains: () => false } }) },
        pricingState: null, pricingChartState: null, chartMode: 'day', priceCrossX: null,
        isPriceSeriesVisible: () => true, fmt: value => String(value),
    };
    const names = [...wanted].filter(name => name !== 'historyNumericValue');
    vm.runInNewContext(`${declarations.join('\n')} module.exports = { ${names.join(',')} };`, context, { filename });
    return { ...context.module.exports, context, paths, labels };
}
function response(prices, fee = 0.05) {
    const pairs = values => values.map((value, idx) => [from + idx * quarter, value]);
    const total = prices.concat(prices.at(-1));
    return { start: from, end: from + prices.length * quarter,
        pricing: { dynamicTariff: true, netFeeEnabled: true, series: {
            total: { values: pairs(total) }, base: { values: pairs(total.map(value => value == null ? value : value - fee)) }, netFee: { values: pairs(total.map(() => fee)) },
        } }, series: { buy: { values: pairs(total.map(() => 2000)) } } };
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} !== ${expected}`);

test('quarter-hour negative, zero and positive EUR quotes retain signed costs and fixed fee split', () => {
    const f = fixture();
    const raw = f.buildPricingIntervals(response([-0.2, 0, 0.3, -0.4]));
    assert.equal(raw.length, 4);
    const expected = [-0.2, 0, 0.3, -0.4];
    raw.forEach((iv, idx) => { close(iv.total, expected[idx]); close(iv.base, expected[idx] - 0.05); close(iv.netFee, 0.05); close(iv.importKwh, 0.5); close(iv.costEur, expected[idx] * 0.5); });
    const summary = f.summarizePricingIntervals(raw);
    close(summary.totalCost, -0.15); close(summary.importKwh, 2); close(summary.avgPrice, -0.075); close(summary.netFeeCost, 0.1);
    const daily = f.aggregatePricingIntervals(raw, from, from + 4 * quarter, 'week');
    assert.equal(daily.length, 1); close(daily[0].costEur, -0.15); close(daily[0].total, -0.075);
    assert.equal(f.formatMoney2(summary.totalCost), '-0.15 €');
    assert.equal(f.formatPrice2(summary.minPrice), '-0.40 €/kWh');
});

test('manual positive tariff behavior and zero quotation remain exact', () => {
    const f = fixture();
    for (const price of [0, 0.35]) {
        const data = response([price, price, price, price]); data.pricing.dynamicTariff = false;
        const raw = f.buildPricingIntervals(data);
        const summary = f.summarizePricingIntervals(raw);
        close(summary.totalCost, 2 * price); close(summary.avgPrice, price); close(summary.netFeeCost, 0.1);
    }
});

test('time-weighted chart quote and energy-weighted summary keep their distinct existing definitions', () => {
    const f = fixture();
    const intervals = [
        { start: from, end: from + quarter, total: -0.2, base: -0.25, netFee: 0.05, importKwh: 0.1, costEur: -0.02 },
        { start: from + quarter, end: from + 4 * quarter, total: 0.4, base: 0.35, netFee: 0.05, importKwh: 0.9, costEur: 0.36 },
    ];
    const daily = f.aggregatePricingIntervals(intervals, from, from + 4 * quarter, 'week');
    close(daily[0].total, 0.25); close(daily[0].costEur, 0.34);
    const summary = f.summarizePricingIntervals(intervals);
    close(summary.avgPrice, 0.34); close(summary.netFeeCost, 0.05);
});

test('known gross price derives a negative base without altering nonnegative fee semantics', () => {
    const f = fixture(); const data = response([-0.1, -0.1]);
    data.pricing.series.base.values = [];
    const intervals = f.buildPricingIntervals(data);
    close(intervals[0].total, -0.1); close(intervals[0].base, -0.15); close(intervals[0].netFee, 0.05);
});

test('unknown quotes stay unknown and do not become free interval prices', () => {
    const f = fixture(); const raw = f.buildPricingIntervals(response([null, null]));
    assert.ok(raw.every(iv => !Number.isFinite(iv.total) && !Number.isFinite(iv.costEur)));
    const summary = f.summarizePricingIntervals(raw);
    assert.equal(summary.totalCost, null); assert.equal(summary.avgPrice, null);
    assert.equal(f.formatMoney2(null), '--'); assert.equal(f.formatPrice2(null), '--');
    assert.match(f.buildPricingNote({ dynamicTariff: true }, raw), /Preislücken/);
    const partial = f.summarizePricingIntervals(f.buildPricingIntervals(response([-0.2, null])));
    close(partial.totalCost, -0.1); close(partial.avgPrice, -0.2);
});

test('price and cost Canvas axes include negative values instead of clipping them to zero', () => {
    const f = fixture();
    const raw = f.buildPricingIntervals(response([-0.2, 0, 0.3, -0.4]));
    f.context.pricingState = { visible: true, points: raw, meta: { start: from, end: from + 4 * quarter } };
    f.drawPricingHistoryChart();
    const chart = f.context.pricingChartState;
    assert.ok(chart.leftMin < -0.4); assert.ok(chart.rightMin < -0.2);
    assert.ok(chart.yRight(-0.2) > chart.yRight(0));
    assert.ok(chart.yRight(-0.2) < 400 - chart.B);
    assert.ok(chart.yLeft(-0.4) < 400 - chart.B);
    assert.ok(f.labels.some(([label]) => String(label).startsWith('-')));
    assert.ok(f.paths.flat().every(row => Number.isFinite(row[1]) && Number.isFinite(row[2])));
});
