/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'ui/src-ts/runtime-executables/www/app.ts'), 'utf8');
const start = source.indexOf('let _renderScheduled = false;');
const end = source.indexOf('/**\n * Code-Teil: formatPower', start);
assert.ok(start > 0 && end > start);
const block = source.slice(start, end);

function fixture() {
    let now = 0, wallOffset = Date.parse('2026-11-25T13:00:00Z'), nextId = 1;
    const tasks = new Map(), rendered = [], documentEvents = {}, windowEvents = {};
    const add = (fn, wait, interval) => {
        const id = nextId++; tasks.set(id, { fn, due: now + wait, interval }); return id;
    };
    const cancel = id => tasks.delete(id);
    const document = { visibilityState: 'visible', getElementById: () => ({}), addEventListener: (name, fn) => documentEvents[name] = fn };
    const ctx = vm.createContext({
        document, window: { addEventListener: (name, fn) => windowEvents[name] = fn },
        performance: { now: () => now }, Date: { now: () => wallOffset + now },
        setTimeout: (fn, wait) => add(fn, wait, 0), clearTimeout: cancel,
        setInterval: (fn, wait) => add(fn, wait, wait), clearInterval: cancel,
        state: { power: { value: 1000, ts: 123456 } },
        render: () => rendered.push({ at: now, value: ctx.state.power.value, sourceTs: ctx.state.power.ts }),
    });
    vm.runInContext(block, ctx);
    function advance(ms) {
        const until = now + ms;
        for (let guard = 0; guard < 10000; guard++) {
            const next = [...tasks].sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
            if (!next || next[1].due > until) { now = until; return; }
            const [id, task] = next; now = task.due;
            if (task.interval) task.due += task.interval; else tasks.delete(id);
            task.fn();
        }
        throw Error('timer loop did not converge');
    }
    return {ctx, advance, rendered, tasks, document,
        shiftWall: delta => wallOffset += delta,
        visibility: value => { document.visibilityState = value; documentEvents.visibilitychange(); },
        event: name => windowEvents[name](),
        start: () => { ctx.scheduleLiveTelemetryRender(true); advance(0); },
    };
}

test('100 ms SSE bursts render latest buffered values once per 5000 ms; source timestamps remain unchanged', () => {
    const f = fixture(); f.start();
    for (let step = 1; step <= 150; step++) {
        f.ctx.state.power.value = step;
        f.ctx.scheduleLiveTelemetryRender(false); f.advance(100);
    }
    assert.deepEqual(f.rendered.map(row => row.at), [0, 5000, 10000, 15000]);
    assert.deepEqual(f.rendered.map(row => row.value), [1000, 50, 100, 150]);
    assert.ok(f.rendered.every(row => row.sourceTs === 123456));
});

test('quiet connections still re-evaluate every 5 s and only a real upstream timestamp refresh changes source age', () => {
    const f = fixture(); f.start(); f.advance(5000);
    assert.deepEqual(f.rendered.map(row => row.at), [0, 5000]);
    assert.equal(f.ctx.state.power.ts, 123456);
    f.advance(2000); f.ctx.state.power.ts = 130456; f.ctx.scheduleLiveTelemetryRender(false); f.advance(3000);
    assert.deepEqual(f.rendered.map(row => row.at), [0, 5000, 10000]);
    assert.equal(f.rendered.at(-1).value, 1000);
    assert.equal(f.rendered.at(-1).sourceTs, 130456);
});

test('wall-clock jumps cannot postpone or burst the monotonic 5 s rendering cadence', () => {
    const f = fixture(); f.start(); f.advance(1000); f.shiftWall(-86400000);
    f.ctx.scheduleLiveTelemetryRender(false); f.advance(4000);
    f.shiftWall(2 * 86400000); f.ctx.scheduleLiveTelemetryRender(false); f.advance(5000);
    assert.deepEqual(f.rendered.map(row => row.at), [0, 5000, 10000]);
});

test('hidden tabs buffer SSE values without rendering; return immediately projects latest data and resumes exactly one timer', () => {
    const f = fixture(); f.start(); f.advance(1000); f.ctx.scheduleLiveTelemetryRender(false);
    f.visibility('hidden'); assert.equal(f.tasks.size, 0);
    for (let step = 0; step < 20; step++) { f.ctx.state.power.value = step; f.ctx.scheduleLiveTelemetryRender(false); f.advance(1000); }
    assert.equal(f.rendered.length, 1);
    f.visibility('visible'); f.advance(0);
    assert.equal(f.rendered.at(-1).value, 19); assert.equal(f.rendered.at(-1).at, 21000);
    f.advance(5000); assert.deepEqual(f.rendered.map(row => row.at), [0, 21000, 26000]);
});

test('pagehide clears pending UI work; repeated pageshow does not duplicate periodic timers or rendering', () => {
    const f = fixture(); f.start(); f.advance(1000); f.ctx.scheduleLiveTelemetryRender(false);
    f.event('pagehide'); assert.equal(f.tasks.size, 0); f.advance(10000); assert.equal(f.rendered.length, 1);
    f.event('pageshow'); f.event('pageshow'); f.advance(0); assert.equal(f.rendered.length, 2);
    f.advance(10000); assert.deepEqual(f.rendered.map(row => row.at), [0, 11000, 16000, 21000]);
    assert.equal(f.tasks.size, 1, 'single periodic age refresh remains');
});

test('actual backend polling delivers newly confirmed constant values and preserves upstream timestamps instead of manufacturing freshness', async () => {
    const ts = require('typescript');
    const filename = path.join(root, 'ui/src-ts/runtime-executables/main.ts');
    const ast = ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true);
    let method;
    const visit = node => {
        if (ts.isMethodDeclaration(node) && node.name?.getText(ast) === '_nwRefreshLiveCoreDatapoints') method = node.getText(ast);
        else ts.forEachChild(node, visit);
    };
    visit(ast); assert.ok(method);
    const runtime = vm.runInNewContext(`({${method}})`);
    let upstream = { val: 0, ts: 123000, lc: 120000, q: 0 };
    const writes = [];
    const instance = {
        _nwShuttingDown: false, _nwLiveCoreRefreshRunning: false,
        _nwLiveCoreRefreshPlan: [{ id: 'meter.power', keys: ['pvPower'], evcsBindings: [] }],
        stateCache: {}, getForeignStateAsync: async () => upstream,
        _nwScaleMappedValue: (_key, _id, value) => value,
        updateValue(key, value, timestamp, options) {
            writes.push({ key, value, timestamp }); this.stateCache[key] = { value, ts: timestamp, q: options.q };
        },
    };
    await runtime._nwRefreshLiveCoreDatapoints.call(instance);
    await runtime._nwRefreshLiveCoreDatapoints.call(instance);
    assert.equal(writes.length, 1, 'identical source sample is not restamped on polling');
    upstream = { ...upstream, ts: 126000 };
    await runtime._nwRefreshLiveCoreDatapoints.call(instance);
    assert.equal(writes.length, 2, 'unchanged power with new real timestamp is delivered');
    assert.equal(writes[1].timestamp, 126000);
    assert.equal(writes[1].value, 0);
    upstream = { val: 0, q: 0 };
    await runtime._nwRefreshLiveCoreDatapoints.call(instance);
    assert.equal(writes.at(-1).timestamp, null, 'missing source timestamp is never replaced by poll time');
});
