'use strict';
// Execute the canonical History methods and energy-total caller. Only timers,
// sendTo transport and state persistence are deterministic fixtures.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../ui/src-ts/runtime-executables/main.ts');
const source = fs.readFileSync(filename, 'utf8');
const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const definition = parsed.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'NexoWattVis');
assert.ok(definition, 'canonical runtime class exists');
const names = new Set(['_nwGetHistoryAvgSeries', '_nwGetHistoryAvgSeriesAny', '_nwCancelHistoryRequests',
    '_nwNormalizeHistoryResult', '_nwNormTsMs', '_nwIntegrateKwh', 'updateEnergyTotalsFromInflux']);
const methods = definition.members.filter(node => names.has(node.name?.getText(parsed))).map(node => node.getText(parsed));
// The production generator copies this canonical file as JavaScript. Execute
// the exact method text, without type erasure that could conceal invalid JS.
const compiled = `class HistoryMethods { ${methods.join('\n')} }\nmodule.exports = HistoryMethods;`;
new vm.Script(compiled, { filename });

function fixture() {
    let time = 0;
    let wall = Date.now();
    const timers = new Map();
    const moduleValue = { exports: {} };
    class ClockDate extends Date { static now() { return wall; } }
    vm.runInNewContext(compiled, { module: moduleValue, performance: { now: () => time }, Date: ClockDate,
        setTimeout(fn, delay) { const timer = { unref() {} }; timers.set(timer, { fn, at: time + delay }); return timer; },
        clearTimeout(timer) { timers.delete(timer); },
    }, { filename, timeout: 1000 });
    const runtime = new moduleValue.exports();
    const realNormalizer = runtime._nwNormalizeHistoryResult.bind(runtime);
    const requests = [];
    const writes = [];
    const warnings = [];
    let normalized = 0;
    runtime._nwGetHistoryInstance = () => 'influxdb.0';
    runtime.log = { warn: message => warnings.push(message) };
    runtime._nwTrimId = id => typeof id === 'string' ? id.trim() : '';
    runtime._nwNormalizeHistoryResult = result => { normalized++; return result.result || []; };
    runtime.sendTo = (instance, command, body, callback) => requests.push({ instance, command, body, callback });
    runtime._nwHasMappedDatapoint = () => false;
    runtime._nwGetHistoryDpCandidates = name => [`fixture.${name}`, `fallback.${name}`];
    runtime._nwChooseEnergyIntegrationStepMs = () => 60000;
    runtime.stateCache = { productionEnergyKwh: { value: 21, ts: 123 }, evEnergyKwh: { value: 7, ts: 123 }, co2Savings: { value: 9, ts: 123 } };
    runtime.config = { settings: {} };
    runtime.updateValue = (key, value, stamp) => { writes.push({ key, value, stamp }); runtime.stateCache[key] = { value, ts: stamp }; };
    runtime.setStateAsync = async (key, value) => { writes.push({ key, value, persisted: true }); };
    const flush = async () => { for (let index = 0; index < 20; index++) await Promise.resolve(); };
    const advance = async amount => {
        const target = time + amount;
        while (true) {
            const next = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            time = next[1].at; timers.delete(next[0]); next[1].fn(); await flush();
        }
        time = target; await flush();
    };
    return { runtime, timers, requests, writes, warnings, advance, flush,
        useRealNormalizer() { runtime._nwNormalizeHistoryResult = realNormalizer; },
        elapseWithoutDispatch(amount) { time += amount; }, jumpWall(amount) { wall += amount; },
        get normalized() { return normalized; } };
}

function observed(promise) {
    const result = { settled: false };
    result.done = promise.then(value => { result.value = value; result.settled = true; }, error => {
        result.error = error; result.settled = true;
    });
    return result;
}

test('missing getHistory callback rejects within five seconds and discards late or repeated replies', async () => {
    const f = fixture();
    const result = observed(f.runtime._nwGetHistoryAvgSeries('power', 0, 10000, 1000));
    await f.advance(4999); assert.equal(result.settled, false);
    await f.advance(1); assert.equal(result.settled, true);
    assert.equal(result.error?.code, 'EOS_HISTORY_TIMEOUT');
    assert.equal(f.timers.size, 0);
    f.requests[0].callback({ result: [{ ts: 1, val: 5 }] });
    f.requests[0].callback({ result: [{ ts: 2, val: 6 }] });
    await f.flush(); assert.equal(f.normalized, 0);
});

test('timely history remains unchanged and clears its deadline timer', async () => {
    const f = fixture();
    const rows = [{ ts: 100, val: 0 }, { ts: 200, val: 300 }];
    const result = observed(f.runtime._nwGetHistoryAvgSeries('power', 0, 10000, 1000));
    f.requests[0].callback({ result: rows }); await result.done;
    assert.equal(result.value, rows); assert.equal(f.timers.size, 0);
    f.requests[0].callback({ result: [{ ts: 300, val: 700 }] });
    assert.equal(f.normalized, 1);
});

test('candidate fallback shares one monotonic five-second budget instead of multiplying it', async () => {
    const f = fixture();
    const result = observed(f.runtime._nwGetHistoryAvgSeriesAny(['first', 'second', 'third'], 0, 10000, 1000));
    await f.advance(3000); f.requests[0].callback({ result: [] }); await f.flush();
    assert.equal(f.requests.length, 2);
    f.jumpWall(-24 * 3600 * 1000); // Wall-clock correction cannot prolong the monotonic budget.
    await f.advance(1999); assert.equal(result.settled, false);
    await f.advance(1); assert.equal(result.settled, true);
    assert.equal(result.error?.code, 'EOS_HISTORY_TIMEOUT');
    assert.equal(f.requests.length, 2); assert.equal(f.timers.size, 0);
});

test('shutdown cancels all pending history work, releases timers and rejects new requests', async () => {
    const f = fixture();
    const first = observed(f.runtime._nwGetHistoryAvgSeries('first', 0, 10000, 1000));
    const second = observed(f.runtime._nwGetHistoryAvgSeries('second', 0, 10000, 1000));
    f.runtime._nwShuttingDown = true;
    assert.equal(typeof f.runtime._nwCancelHistoryRequests, 'function');
    f.runtime._nwCancelHistoryRequests(); await f.flush();
    assert.equal(first.error?.code, 'EOS_HISTORY_CANCELLED');
    assert.equal(second.error?.code, 'EOS_HISTORY_CANCELLED'); assert.equal(f.timers.size, 0);
    const stopped = observed(f.runtime._nwGetHistoryAvgSeries('third', 0, 10000, 1000));
    await stopped.done; assert.equal(stopped.error?.code, 'EOS_HISTORY_CANCELLED');
    assert.equal(f.requests.length, 2);
    f.requests[0].callback({ result: [{ ts: 1, val: 1 }] }); assert.equal(f.normalized, 0);
});

test('startup energy totals finish after failed history without publishing zeros or refreshing old CO2', async () => {
    const f = fixture();
    const before = structuredClone(f.runtime.stateCache);
    const result = observed(f.runtime.updateEnergyTotalsFromInflux('startup'));
    assert.equal(f.requests.length, 5);
    await f.advance(5000);
    assert.equal(result.settled, true); assert.equal(result.error, undefined);
    assert.deepEqual(f.writes, []); assert.deepEqual(f.runtime.stateCache, before);
    assert.equal(f.requests.length, 5, 'timeouts must not start another fallback round');
    assert.equal(f.timers.size, 0);
});

test('empty or invalid history and missing candidate mappings preserve old measurements', async () => {
    for (const rows of [[], [{ ts: 1, val: Infinity }]]) {
        const f = fixture();
        f.runtime._nwGetHistoryDpCandidates = name => [`fixture.${name}`];
        f.runtime.sendTo = (_instance, _command, _body, callback) => callback({ result: rows });
        await f.runtime.updateEnergyTotalsFromInflux('startup');
        assert.deepEqual(f.writes, []);
    }
    const f = fixture(); f.runtime._nwGetHistoryDpCandidates = () => [];
    await f.runtime.updateEnergyTotalsFromInflux('startup'); assert.deepEqual(f.writes, []);
});

test('valid zero-power samples remain legitimate measurements and nonzero energy integration remains unchanged', async () => {
    for (const value of [0, 1000]) {
        const f = fixture();
        f.runtime._nwGetHistoryDpCandidates = name => [`fixture.${name}`];
        f.runtime.sendTo = (_instance, _command, body, callback) => callback({ result: [
            { ts: body.options.end - 120000, val: value }, { ts: body.options.end - 60000, val: value },
        ] });
        await f.runtime.updateEnergyTotalsFromInflux('startup');
        const energy = f.writes.find(entry => entry.key === 'productionEnergyKwh');
        assert.ok(energy); assert.equal(energy.value, value / 30000);
        assert.ok(f.writes.some(entry => entry.key === 'co2Savings'));
        assert.equal(f.timers.size, 0);
    }
});

test('a reply after a stalled event loop cannot beat the deadline callback or extend the hard cap', async () => {
    for (const suppliedDeadline of [5000, 60000]) {
        const f = fixture();
        const result = observed(f.runtime._nwGetHistoryAvgSeries('power', 0, 10000, 1000, suppliedDeadline));
        f.elapseWithoutDispatch(5001);
        f.requests[0].callback({ result: [{ ts: 1, val: 500 }] }); await result.done;
        assert.equal(result.error?.code, 'EOS_HISTORY_TIMEOUT');
        assert.equal(f.normalized, 0); assert.equal(f.timers.size, 0);
    }
});

test('a failed history branch preserves its old value and CO2 while other genuine measurements may update', async () => {
    const f = fixture();
    f.runtime._nwGetHistoryDpCandidates = name => [`fixture.${name}`];
    const oldCo2 = structuredClone(f.runtime.stateCache.co2Savings);
    const oldProduction = structuredClone(f.runtime.stateCache.productionEnergyKwh);
    f.runtime.sendTo = (_instance, _command, body, callback) => {
        if (body.id === 'fixture.pvPower') return;
        callback({ result: [{ ts: body.options.end - 60000, val: 1200 }] });
    };
    const result = observed(f.runtime.updateEnergyTotalsFromInflux('startup'));
    await f.advance(5000); assert.equal(result.settled, true);
    assert.deepEqual(f.runtime.stateCache.productionEnergyKwh, oldProduction);
    assert.deepEqual(f.runtime.stateCache.co2Savings, oldCo2);
    assert.equal(f.writes.some(entry => ['productionEnergyKwh', 'co2Savings'].includes(entry.key)), false);
    assert.ok(f.writes.some(entry => entry.key === 'gridEnergyKwh' && entry.value > 0));
});

test('mapped but absent energy values are not converted to freshly published zero CO2', async () => {
    const f = fixture();
    f.runtime._nwHasMappedDatapoint = key => key !== 'co2Savings';
    f.runtime.stateCache.productionEnergyKwh = { value: null, ts: 123 };
    f.runtime.sendTo = (_instance, _command, body, callback) => callback({ result: [
        { ts: body.options.end - 60000, val: 1000 },
    ] });
    await f.runtime.updateEnergyTotalsFromInflux('startup');
    assert.equal(f.writes.some(entry => entry.key === 'co2Savings'), false);
});

test('real normalizer rejects null, boolean, blank and nonfinite values without synthesizing zero measurements', async () => {
    for (const value of [null, undefined, false, true, '', '  ', Infinity, NaN, {}, [], 'not-a-number']) {
        const f = fixture(); f.useRealNormalizer();
        f.runtime._nwGetHistoryDpCandidates = name => [`fixture.${name}`];
        f.runtime.sendTo = (_instance, _command, body, callback) => callback({ result: [
            [body.options.end - 60000, value],
        ] });
        const before = structuredClone(f.runtime.stateCache);
        await f.runtime.updateEnergyTotalsFromInflux('startup');
        assert.deepEqual(f.writes, [], `invalid value kind: ${typeof value}`);
        assert.deepEqual(f.runtime.stateCache, before);
    }
});

test('real normalizer rejects malformed rows/timestamps and retains finite Influx samples and timestamps', () => {
    const f = fixture(); f.useRealNormalizer();
    const normalize = result => JSON.parse(JSON.stringify(f.runtime._nwNormalizeHistoryResult(result)));
    const stamp = 1795370000000;
    for (const row of [null, false, 'text', {}, [], [stamp], [false, 100], [true, 100], ['', 100], [' ', 100],
        ['bad-time', 100], [Infinity, 100], [-1, 100]]) {
        assert.deepEqual(normalize({ result: [row] }), []);
        assert.deepEqual(normalize({ result: [[stamp, 100], row] }), [], 'a malformed partial series must not become a fresh total');
    }
    const expected = [{ ts: stamp, val: 0 }, { ts: stamp + 60000, val: 1000 }];
    assert.deepEqual(normalize({ result: [[stamp, 0], [stamp + 60000, 1000]] }), expected);
    assert.deepEqual(normalize({ result: [{ ts: stamp, val: '0' }, { time: new Date(stamp + 60000).toISOString(), value: '1e3' }] }), expected);
    assert.deepEqual(normalize({ result: [{ data: [[stamp / 1000, 0], [String((stamp + 60000) / 1000), 1000]] }] }), expected);
    assert.deepEqual(normalize({ series: [{ values: [[stamp, 0], [stamp + 60000, 1000]] }] }), expected);
});

test('history timeout diagnostics are constant, once per cycle and throttled for five monotonic minutes', async () => {
    const f = fixture();
    for (let attempt = 0; attempt < 3; attempt++) {
        const cycle = observed(f.runtime.updateEnergyTotalsFromInflux('startup'));
        await f.advance(5000); assert.equal(cycle.settled, true);
        assert.equal(f.warnings.length, 1, 'five failed branches and repeated cycles share one warning budget');
    }
    f.jumpWall(24 * 3600 * 1000);
    const wallJump = observed(f.runtime.updateEnergyTotalsFromInflux('timer'));
    await f.advance(5000); assert.equal(wallJump.settled, true); assert.equal(f.warnings.length, 1);
    await f.advance(300000);
    const nextCycle = observed(f.runtime.updateEnergyTotalsFromInflux('timer'));
    await f.advance(5000); assert.equal(nextCycle.settled, true); assert.equal(f.warnings.length, 2);
    assert.equal(f.warnings[0], f.warnings[1]);
    assert.match(f.warnings[0], /EOS_HISTORY_TIMEOUT/);
    assert.ok(f.warnings[0].length < 200);
    assert.doesNotMatch(f.warnings[0], /influxdb\.0|fixture\.|fallback\.|token|password/i);
    assert.deepEqual(f.writes, []);
    const cancelled = observed(f.runtime.updateEnergyTotalsFromInflux('timer'));
    f.runtime._nwShuttingDown = true; f.runtime._nwCancelHistoryRequests(); await f.flush();
    assert.equal(cancelled.settled, true); assert.equal(f.warnings.length, 2);
    assert.equal(f.timers.size, 0); assert.deepEqual(f.writes, []);
});
