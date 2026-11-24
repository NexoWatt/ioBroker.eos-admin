'use strict';
// Execute the production route and its real normalizer/cache methods. Transport,
// clock and HTTP response are controlled; business logic is never reconstructed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const tariffFilename = path.resolve(__dirname, '../ui/src-ts/runtime-executables/lib/tariff-price.ts');
const tariffModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(tariffFilename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: tariffModule.exports, module: tariffModule });
const { tariffPriceNumber } = tariffModule.exports;
const { EphemeralMap } = require('./fixtures/load-ephemeral-cache.cjs');
const filename = process.env.EOS_HISTORY_SOURCE || path.resolve(__dirname, '../ui/src-ts/runtime-executables/main.ts');
const source = fs.readFileSync(filename, 'utf8');
const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const definition = parsed.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'NexoWattVis');
const names = new Set(['_nwNormalizeHistoryResult', '_nwNormTsMs', '_nwGetHistoryApiCached', '_nwSetHistoryApiCached', '_nwCancelHistoryRequests', '_nwDispatchHistory']);
const methods = definition.members.filter(node => names.has(node.name?.getText(parsed))).map(node => node.getText(parsed));
let route;
function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(parsed) === 'app.get' && node.arguments[0]?.text === '/api/history') route = node.arguments[1].getText(parsed);
    ts.forEachChild(node, visit);
}
visit(parsed);
assert.ok(route, 'canonical History route exists');
const compiled = `class Runtime { ${methods.join('\n')} register() { return ${route}; } } module.exports = Runtime;`;
new vm.Script(compiled, { filename });
const from = 1800000000000;

function fixture() {
    let time = 0;
    let wall = from + 86400000;
    const timers = new Map();
    // Cache expiry owns separate unreferenced timers; timers below track history IO deadlines.
    const context = { module: { exports: {} }, Map, EphemeralMap, tariffPriceNumber, performance: { now: () => time },
        Date: class extends Date { static now() { return wall; } },
        setTimeout(fn, delay) { const timer = { unref() {} }; timers.set(timer, { at: time + delay, fn }); return timer; },
        clearTimeout(timer) { timers.delete(timer); },
    };
    vm.runInNewContext(compiled, context, { filename });
    const runtime = new context.module.exports();
    runtime.config = { history: {}, datapoints: {}, vis: {} };
    runtime.stateCache = {};
    runtime.namespace = 'eos-admin.0';
    runtime.evcsCount = 0;
    runtime._nwGetHistoryInstance = () => 'influxdb.0';
    runtime._nwTrimId = value => typeof value === 'string' ? value.trim() : '';
    runtime._nwGetHistoryDpCandidates = key => [`test.${key}`];
    const requests = [];
    runtime.sendTo = (instance, command, body, callback) => { requests.push({ instance, command, body, callback }); };
    runtime.getForeignStateAsync = async () => null;
    const routeHandler = runtime.register();
    const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
    const advance = async amount => {
        const target = time + amount;
        while (true) {
            const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            time = next[1].at; timers.delete(next[0]); next[1].fn(); await flush();
        }
        time = target; await flush();
    };
    const call = (query = { from: String(from), to: String(from + 86400000), step: '600' }) => {
        const response = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
        response.done = routeHandler({ query }, response);
        return response;
    };
    return { runtime, requests, timers, call, flush, advance, jumpWall: amount => { wall += amount; } };
}

const goodRows = request => ({ result: [{ ts: request.options.start, val: 0 }, { ts: request.options.end, val: 1000 }] });
function immediateGood(f) { f.runtime.sendTo = (_instance, _command, body, callback) => callback(goodRows(body)); }

test('periodic canonical samples stop holding through outages; legacy sparse mappings still hold', async () => {
    for (const canonical of [false, true]) {
        const f = fixture();
        f.runtime._nwGetHistoryDpCandidates = key => key === 'pvPower' ? [canonical ? 'eos-admin.0.historie.core.pv.powerW' : 'legacy.pv'] : [];
        f.runtime.sendTo = (_i, _c, body, callback) => callback({ result: body.id.includes('pv') ? [
            { ts: from, val: 1000 }, { ts: from + 600000, val: 1000 }, { ts: from + 3000000, val: 0 },
        ] : [] });
        const response = f.call({ from: String(from), to: String(from + 4200000), step: '600' });
        await response.done;
        assert.equal(response.body.ok, true);
        const values = response.body.series.pv.values;
        assert.equal(values[2][1], 1000, 'one expected export interval may be held');
        assert.equal(values[3][1], canonical ? null : 1000);
        assert.equal(values[4][1], canonical ? null : 1000);
        assert.equal(values[5][1], 0, 'fresh measured zero resumes the series');
        assert.equal(values[7][1], canonical ? null : 0);
        if (canonical) assert.equal(response.body.energyExact.productionKwh, null, 'incomplete history is not an exact full-range energy total');
    }
});

test('canonical hold follows configured export cadence rather than an arbitrary device TTL', async () => {
    const f = fixture();
    f.runtime.config.history.exportIntervalMs = 1800000;
    f.runtime._nwGetHistoryDpCandidates = key => key === 'storageSoc' ? ['eos-admin.0.historie.core.storage.soc'] : [];
    f.runtime.sendTo = (_i, _c, body, callback) => callback({ result: body.id.endsWith('.soc') ? [{ ts: from, val: 50 }] : [] });
    const response = f.call({ from: String(from), to: String(from + 4200000), step: '600' });
    await response.done;
    assert.equal(response.body.ok, true);
    assert.equal(response.body.series.soc.values[3][1], 50);
    assert.equal(response.body.series.soc.values[4][1], null);
});

test('charge-point sum retains an outage when any configured member has no periodic sample', async () => {
    const f = fixture();
    f.runtime.evcsCount = 2;
    f.runtime._nwGetHistoryDpCandidates = () => [];
    f.runtime.sendTo = (_i, _c, body, callback) => callback({ result: body.id.includes('.lp1.') ? [
        { ts: from, val: 1000 }, { ts: from + 2400000, val: 1000 },
    ] : body.id.includes('.lp2.') ? [
        { ts: from, val: 2000 }, { ts: from + 600000, val: 2000 }, { ts: from + 1200000, val: 2000 },
        { ts: from + 1800000, val: 2000 }, { ts: from + 2400000, val: 2000 },
    ] : [] });
    const response = f.call({ from: String(from), to: String(from + 2400000), step: '600' });
    await response.done;
    assert.equal(response.body.ok, true);
    assert.equal(response.body.series.evcs.values[0][1], 3000);
    assert.equal(response.body.series.evcs.values[2][1], null);
    assert.equal(response.body.series.evcs.values[3][1], null);
    assert.equal(response.body.series.evcs.values[4][1], 3000);
    assert.equal(response.body.energyExact.evKwh, null);
});

test('History API retains signed canonical EUR prices, fixed fee split and genuine zero', async () => {
    for (const gross of [-8.5, -0.1, 0, 0.35]) {
        const f = fixture();
        f.runtime.stateCache['settings.dynamicTariff'] = { value: true };
        f.runtime._nwGetHistoryDpCandidates = key => key === 'priceNetFee' ? ['test.netFee'] : [];
        f.runtime.sendTo = (_i, _c, body, callback) => {
            const val = body.id === 'test.netFee' ? 0.05 : body.id.endsWith('providerCurrentEurPerKwh') ? gross : null;
            callback({ result: val === null ? [] : [{ ts: from, val }, { ts: from + 3600000, val }] });
        };
        const response = f.call({ from: String(from), to: String(from + 3600000), step: '900' });
        await response.done;
        assert.equal(response.body.ok, true);
        assert.equal(response.body.pricing.series.total.values[0][1], gross);
        assert.equal(response.body.pricing.series.base.values[0][1], gross - 0.05);
        assert.equal(response.body.pricing.series.netFee.values[0][1], 0.05);
    }
});

test('missing and invalid manual prices are not synthesized into free History quotes', async () => {
    for (const raw of [null, undefined, false, '', 'invalid']) {
        const f = fixture();
        f.runtime.stateCache['settings.dynamicTariff'] = { value: true };
        f.runtime.stateCache['settings.price'] = { value: raw };
        f.runtime._nwGetHistoryDpCandidates = () => [];
        f.runtime.sendTo = (_i, _c, _body, callback) => callback({ result: [] });
        const response = f.call(); await response.done;
        assert.equal(response.body.ok, true);
        assert.equal(response.body.pricing.series.total.values[0][1], null);
        assert.equal(response.body.pricing.series.base.values[0][1], null);
    }
});

test('asynchronous malformed History payloads cannot throw out of the callback', async () => {
    for (const payload of [[null], { result: [undefined] }, { series: [{ values: {} }] }, { series: [{ values: [null] }] }]) {
        const f = fixture();
        f.runtime.sendTo = (_i, _c, _b, callback) => queueMicrotask(() => { assert.doesNotThrow(() => callback(payload)); });
        const response = f.call(); await response.done;
        assert.equal(response.body.ok, true);
        assert.deepEqual(Array.from(response.body.series.pv.values), []);
        assert.equal(f.timers.size, 0);
    }
});

test('valid numeric zero stays zero, null does not create measured zero, supported envelopes agree', async () => {
    for (const envelope of [rows => rows, rows => ({ result: rows }), rows => ({ result: [{ data: rows }] }), rows => ({ series: [{ values: rows.map(row => [row.ts, row.val]) }] }), rows => ({ data: rows })]) {
        const f = fixture();
        f.runtime.sendTo = (_i, _c, body, callback) => callback(envelope(goodRows(body).result));
        const response = f.call(); await response.done;
        assert.equal(response.body.ok, true);
        assert.equal(response.body.series.pv.values[0][1], 0);
        assert.equal(response.body.series.pv.values.at(-1)[1], 1000);
        assert.equal(response.body.series.pv.values.length, 145);
    }
    const f = fixture();
    f.runtime.sendTo = (_i, _c, body, callback) => callback({ result: [{ ts: body.options.start, val: null }] });
    const response = f.call(); await response.done;
    assert.deepEqual(Array.from(response.body.series.pv.values), []);
});

test('one five-second deadline includes fallback rounds and ignores late responses', async () => {
    const f = fixture();
    f.runtime._nwGetHistoryDpCandidates = key => [`first.${key}`, `second.${key}`, `third.${key}`];
    const response = f.call();
    await f.advance(3000);
    const firstRound = f.requests.slice();
    for (const request of firstRound) request.callback({ result: [] });
    await f.flush();
    assert.equal(f.requests.length, firstRound.length * 2);
    f.jumpWall(-86400000); // monotonic budget survives a clock correction
    await f.advance(1999); assert.equal(response.body, null);
    await f.advance(1); await response.done;
    assert.equal(response.body.error, 'EOS_HISTORY_TIMEOUT');
    assert.equal(f.timers.size, 0);
    assert.equal(f.runtime._nwPendingHistoryRequests.size, 0);
    assert.equal(f.runtime._nwHistoryApiInflight.size, 0);
    for (const request of f.requests) assert.doesNotThrow(() => request.callback(goodRows(request.body)));
    assert.equal(response.body.ok, false);
});

test('shutdown cancels History reads and new reads fail without starting transports', async () => {
    const f = fixture();
    const response = f.call();
    f.runtime._nwShuttingDown = true;
    f.runtime._nwCancelHistoryRequests();
    await response.done;
    assert.equal(response.body.error, 'EOS_HISTORY_CANCELLED');
    assert.equal(f.timers.size, 0);
    const count = f.requests.length;
    const next = f.call(); await next.done;
    assert.equal(next.body.error, 'EOS_HISTORY_CANCELLED');
    assert.equal(f.requests.length, count);
});

test('thrown and rejected transports become bounded API errors with sibling cleanup', async () => {
    for (const kind of ['throw', 'reject']) {
        const f = fixture();
        f.runtime.sendTo = () => { if (kind === 'throw') throw new Error('private transport details'); return Promise.reject(new Error('private transport details')); };
        const response = f.call(); await response.done;
        assert.equal(response.body.error, 'EOS_HISTORY_UNAVAILABLE');
        assert.equal(f.timers.size, 0); assert.equal(f.runtime._nwPendingHistoryRequests.size, 0);
        assert.ok(!JSON.stringify(response.body).includes('private'));
    }
});

test('oversized raw response stops processing and cleans all pending branches', async () => {
    const f = fixture();
    const response = f.call();
    f.requests[0].callback({ result: new Array(10001).fill({ ts: from, val: 1 }) });
    await response.done;
    assert.equal(response.body.error, 'EOS_HISTORY_RESPONSE_INVALID');
    assert.equal(f.timers.size, 0);
    assert.equal(f.runtime._nwPendingHistoryRequests.size, 0);
});

test('invalid and allocation-amplifying ranges are rejected before provider work', async () => {
    for (const patch of [{ from: 'NaN' }, { from: '' }, { from: ['1800000000000'] }, { to: String(from - 1) }, { step: '0' }, { step: '-1' }, { step: 'Infinity' }, { to: String(from + 365 * 86400000), step: '60' }]) {
        const f = fixture();
        const response = f.call({ from: String(from), to: String(from + 86400000), step: '600', ...patch });
        await response.done;
        assert.equal(response.statusCode, 400);
        assert.equal(response.body.error, 'EOS_HISTORY_RANGE_INVALID');
        assert.equal(f.requests.length, 0); assert.equal(f.timers.size, 0);
    }
});

test('day, week, month, leap-year and six-hour annual-report presets preserve finite output bounds', async () => {
    for (const [days, step] of [[1, 600], [7, 1800], [31, 3600], [366, 86400], [366, 21600]]) {
        const f = fixture(); immediateGood(f);
        const response = f.call({ from: String(from), to: String(from + days * 86400000), step: String(step) });
        await response.done;
        assert.equal(response.body.ok, true);
        assert.ok(response.body.series.pv.values.length <= 1465);
        assert.equal(response.body.step, step);
    }
});

test('identical requests share work; a fifth distinct computation gets backpressure', async () => {
    const f = fixture();
    const first = f.call();
    const count = f.requests.length;
    const duplicate = f.call();
    assert.equal(f.requests.length, count);
    const other = [1, 2, 3].map(offset => f.call({ from: String(from + offset), to: String(from + 86400000), step: '600' }));
    const excess = f.call({ from: String(from + 4), to: String(from + 86400000), step: '600' });
    await excess.done;
    assert.equal(excess.statusCode, 503); assert.equal(excess.body.error, 'EOS_HISTORY_BUSY');
    assert.equal(f.runtime._nwHistoryApiInflight.size, 4);
    await f.advance(5000);
    await Promise.all([first.done, duplicate.done, ...other.map(item => item.done)]);
    assert.equal(f.runtime._nwHistoryApiInflight.size, 0);
    assert.equal(f.timers.size, 0);
});

test('completed payload cache retains at most four requests and expires old responses', async () => {
    const f = fixture(); immediateGood(f);
    for (let offset = 0; offset < 10; offset++) {
        const response = f.call({ from: String(from + offset), to: String(from + 86400000), step: '600' });
        await response.done; assert.equal(response.body.ok, true);
        assert.ok(f.runtime._nwHistoryApiCache.size <= 4);
    }
    f.jumpWall(5001);
    f.runtime._nwSetHistoryApiCached('fresh', { ok: true });
    assert.equal(f.runtime._nwHistoryApiCache.size, 1);
});

test('current counter reads share History deadline instead of leaving request hanging', async () => {
    const f = fixture(); immediateGood(f);
    f.runtime.config.datapoints.productionEnergyKwh = 'counter.production';
    f.runtime.getForeignStateAsync = () => new Promise(() => {});
    const response = f.call(); await f.flush();
    assert.equal(response.body, null);
    await f.advance(5000); await response.done;
    assert.equal(response.body.error, 'EOS_HISTORY_TIMEOUT');
    assert.equal(f.timers.size, 0);
});

test('200-charge-point fallback uses at most eight simultaneous reads and retains correct sums', async () => {
    const f = fixture();
    f.runtime.evcsCount = 200;
    let active = 0;
    let peak = 0;
    let reads = 0;
    f.runtime.sendTo = (_i, _c, body, callback) => {
        const isChargePoint = /\.historie\.evcs\.lp\d+\.powerW$/.test(body.id);
        if (isChargePoint) { active++; reads++; peak = Math.max(peak, active); }
        queueMicrotask(() => {
            if (isChargePoint) active--;
            callback(isChargePoint ? goodRows(body) : { result: [] });
        });
    };
    const response = f.call(); await response.done;
    assert.equal(response.body.ok, true);
    assert.equal(reads, 200); assert.equal(peak, 8);
    assert.equal(response.body.series.evcs.values.at(-1)[1], 200000);
    assert.equal(f.timers.size, 0);
});

test('four maximum-range payloads stay within measured row and serialized-size budgets', async t => {
    const f = fixture(); immediateGood(f);
    f.runtime.stateCache['settings.dynamicTariff'] = { value: true };
    f.runtime.stateCache['settings.netFeeEnabled'] = { value: true };
    f.runtime._nwGetFlowSlotInfo = (kind, index) => ({ objectId: `test.${kind}.${index}`, key: `${kind}.${index}`, name: `${kind} ${index}` });
    global.gc?.();
    const before = process.memoryUsage().heapUsed;
    let largestBytes = 0;
    let maxRows = 0;
    for (let offset = 0; offset < 4; offset++) {
        const response = f.call({ from: String(from + offset), to: String(from + offset + 4095 * 600000), step: '600' });
        await response.done; assert.equal(response.body.ok, true);
        const allSeries = [...Object.values(response.body.series), ...response.body.extras.consumers, ...response.body.extras.producers, ...Object.values(response.body.pricing.series)];
        for (const series of allSeries) assert.ok(series.values.length <= 4096);
        const rows = allSeries.reduce((sum, series) => sum + series.values.length, 0);
        maxRows = Math.max(maxRows, rows);
        largestBytes = Math.max(largestBytes, Buffer.byteLength(JSON.stringify(response.body)));
    }
    global.gc?.();
    const heapDeltaBytes = process.memoryUsage().heapUsed - before;
    assert.equal(f.runtime._nwHistoryApiCache.size, 4);
    assert.equal(maxRows, 26 * 4096);
    assert.ok(largestBytes < 4 * 1024 * 1024, 'one maximum payload stays below 4 MiB serialized');
    assert.equal(f.timers.size, 0);
    t.diagnostic(JSON.stringify({ profile: 'History-only controlled provider; not customer RSS', gcAvailable: !!global.gc, cacheEntries: 4, rowsPerPayload: maxRows, largestPayloadBytes: largestBytes, heapDeltaBytes }));
});

test('leading missing buckets stay unknown in complete-period energy totals; measured zero remains zero', async () => {
    for (const missingPrefix of [true, false]) {
        const f = fixture();
        f.runtime.sendTo = (_i, _c, body, callback) => callback({ result: [
            { ts: body.options.start + (missingPrefix ? 12 * 3600000 : 0), val: 0 },
            { ts: body.options.end, val: 0 },
        ] });
        const response = f.call(); await response.done;
        assert.equal(response.body.ok, true);
        assert.equal(response.body.series.pv.values[0][1], missingPrefix ? null : 0);
        assert.equal(response.body.energyExact.productionKwh, missingPrefix ? null : 0);
        assert.equal(response.body.energyExact.consumptionKwh, missingPrefix ? null : 0);
    }
});

test('exact-energy EV fallback is also bounded and cannot swallow its timeout as a complete result', async () => {
    const f = fixture();
    f.runtime.evcsCount = 16;
    let secondPhaseReads = 0;
    f.runtime.sendTo = (_i, _c, body, callback) => {
        if (body.options.end === from + 86400000 && /\.historie\.evcs\.lp\d+\.powerW$/.test(body.id)) {
            secondPhaseReads++;
            return;
        }
        callback({ result: [] });
    };
    const response = f.call({ from: String(from), to: String(from + 2 * 86400000), step: '600' });
    await f.flush();
    assert.equal(secondPhaseReads, 8);
    await f.advance(5000); await response.done;
    assert.equal(response.body.ok, false);
    assert.equal(response.body.error, 'EOS_HISTORY_TIMEOUT');
    assert.equal(f.timers.size, 0);
});

test('optimized price lookup retains exact last-value and duplicate-timestamp semantics', () => {
    let lookup;
    function find(node) {
        if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === '_valueAtHold' && !lookup) lookup = node.initializer.getText(parsed);
        ts.forEachChild(node, find);
    }
    find(parsed);
    const valueAt = vm.runInNewContext(`(${lookup})`);
    const values = [[100, 1], [200, 2], [200, 3], [300, 4]];
    for (const [at, expected] of [[50, null], [100, 1], [199, 1], [200, 3], [299, 3], [300, 4], [999, 4]]) {
        assert.equal(valueAt(values, at), expected);
    }
    assert.equal(valueAt([], 1), null);
});

test('annual report still requests all ten years with two concurrent requests and original order', async () => {
    const reportFile = path.resolve(__dirname, '../ui/src-ts/runtime-executables/www/year-report.ts');
    const reportSource = fs.readFileSync(reportFile, 'utf8');
    const reportAst = ts.createSourceFile(reportFile, reportSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    let load;
    function find(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === 'load') load = node.getText(reportAst); ts.forEachChild(node, find); }
    find(reportAst); assert.ok(load);
    const years = Array.from({ length: 10 }, (_, index) => 2017 + index);
    const seen = []; let active = 0; let peak = 0;
    const context = { setError() {}, setTableLoading() {}, getYearsFromQuery: () => ({ years }), setMeta() {}, toIsoDate: () => 'fixture', el: () => null,
        fetchYear: async year => { active++; peak = Math.max(peak, active); seen.push(year); await Promise.resolve(); active--; return { ok: false, year }; },
    };
    const loadReport = vm.runInNewContext(`(${load})`, context);
    await loadReport();
    assert.equal(peak, 2); assert.deepEqual(seen, years);
    assert.match(reportSource, /const step = 21600/);
});
