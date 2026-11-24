'use strict';
// Execute real chart helpers with a recording Canvas; no browser layout is claimed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const filename = process.env.EOS_HISTORY_SOURCE || path.resolve(__dirname, '../ui/src-ts/runtime-executables/www/history.ts');
const source = fs.readFileSync(filename, 'utf8');
const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const wanted = new Set(['historyNumericValue', 'mapKW', 'line', 'drawStackedAreas', 'hexToRgba', 'aggregateEnergyKWh', 'sumEnergyKWh', 'toTsMs', 'normalizeNumericSeries']);
const declarations = [];
function visit(node) {
    if (ts.isFunctionDeclaration(node) && wanted.has(node.name?.text)) declarations.push(node.getText(parsed));
    ts.forEachChild(node, visit);
}
visit(parsed);
const from = 1800000000000;
const points = [[from, 1000], [from + 600000, 1000], [from + 1200000, null], [from + 1800000, null], [from + 2400000, 2000], [from + 3000000, 2000]];
function fixture() {
    const paths = []; let current = [];
    const ctx = { save() {}, restore() {}, beginPath() { current = []; }, moveTo(x, y) { current.push(['move', x, y]); }, lineTo(x, y) { current.push(['line', x, y]); }, closePath() {}, fill() {}, stroke() { paths.push(current.slice()); }, setLineDash() {} };
    const context = { module: { exports: {} }, Map, Number, ctx, series: {}, xs: points.map(row => row[0]), x: x => x, yPow: y => y, ySoc: y => y, stackCtx: null, CORE_COLORS: { pv: '#ffffff' } };
    vm.runInNewContext(`${declarations.join('\n')} module.exports = { mapKW, line, drawStackedAreas, aggregateEnergyKWh, sumEnergyKWh, normalizeNumericSeries };`, context, { filename });
    return { ...context.module.exports, context, paths };
}
test('History line mapping preserves unknown values and real zero', () => {
    const f = fixture();
    for (const value of [null, undefined, '', false, NaN]) assert.ok(Number.isNaN(f.mapKW('pv', value)));
    assert.equal(f.mapKW('pv', 0), 0);
    assert.equal(f.mapKW('pv', 1000), 1);
});
test('power and SoC Canvas paths restart after explicit gaps', () => {
    for (const key of ['pv', 'soc']) {
        const f = fixture(); f.context.series[key] = { values: points };
        f.line(key, '#ffffff');
        assert.deepEqual(Array.from(f.paths[0], entry => entry[0]), ['move', 'line', 'move', 'line']);
        assert.equal(f.paths[0][2][1], from + 2400000);
    }
});
test('stacked areas create separate polygons on either side of a gap', () => {
    const f = fixture();
    f.context.stackCtx = { posKeys: ['pv'], negKeys: [], valMap: { pv: new Map(points.map(([ts, val]) => [ts, f.mapKW('pv', val)])) } };
    f.drawStackedAreas();
    assert.equal(f.paths.length, 2);
    for (const row of f.paths[0]) assert.ok(row[1] <= from + 600000);
    for (const row of f.paths[1]) assert.ok(row[1] >= from + 2400000);
});
test('integrated energy never bridges or ramps through null outage samples', () => {
    const f = fixture();
    assert.equal(f.sumEnergyKWh(points), 0.5);
    const aggregate = f.aggregateEnergyKWh(points, [{ start: from, end: from + 3000000 }]);
    assert.equal(aggregate[0].kwh, 0.5);
    assert.equal(f.sumEnergyKWh([[from, 0], [from + 600000, 0]]), 0);
});
test('normalization retains timestamped unknown markers for cost integration', () => {
    const f = fixture();
    const normalized = f.normalizeNumericSeries(points);
    assert.equal(normalized.length, 6);
    assert.ok(Number.isNaN(normalized[2][1]));
    assert.equal(f.aggregateEnergyKWh(normalized, [{ start: from, end: from + 3000000 }])[0].kwh, 0.5);
});
