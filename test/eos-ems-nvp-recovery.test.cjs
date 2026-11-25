'use strict';
/** Actual engine, registry and freshness resolver; only database IO is synthetic. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = process.env.EOS_TEST_SOURCE_ROOT || path.resolve(__dirname, '..');
const enginePath = path.join(root, 'ui/ems/engine.js');
const compiled = ts.transpileModule(fs.readFileSync(path.join(root, 'ui/src-ts/runtime-executables/ems/engine.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const engineModule = new Module(enginePath, module);
engineModule.filename = enginePath;
engineModule.paths = Module._nodeModulePaths(path.dirname(enginePath));
engineModule._compile(compiled, enginePath);
const { EmsEngine } = engineModule.exports;
const { DatapointRegistry } = require(path.join(root, 'ui/ems/datapoints'));

async function fixture() {
    const states = new Map();
    const adapter = { config: { storage: { staleTimeoutSec: 1 }, peakShaving: { smoothingSeconds: 10 } },
        log: { warn() {}, debug() {} },
        setStateAsync: async (id, state) => { states.set(id, state); },
    };
    const engine = new EmsEngine(adapter);
    const dp = new DatapointRegistry(adapter, []);
    await dp.upsert({ key: 'vis.gridNetW', objectId: 'meter.grid', dataType: 'number', unit: 'W', direction: 'in', useAliveForStale: false });
    await dp.upsert({ key: 'cm.gridConnected', objectId: 'meter.online', dataType: 'boolean', direction: 'in', useAliveForStale: false });
    engine.dp = dp; engine.mm = { tick: async () => {} };
    engine._gridPowerId = 'eos-admin.0.ems.gridPowerW';
    engine._gridPowerRawId = 'eos-admin.0.ems.gridPowerRawW';
    const sample = (value, age = 0) => dp.handleStateChange('meter.grid', { val: value, ack: true, ts: Date.now() - age }, true);
    const connected = value => dp.handleStateChange('meter.online', { val: value, ack: true, ts: Date.now() }, true);
    connected(true);
    return { engine, dp, adapter, states, sample, connected };
}

for (const first of [600, -600, 0]) test(`first valid ${first}W NVP initializes filter from the measurement`, async () => {
    const f = await fixture(); f.sample(first); await f.engine.tick();
    assert.equal(f.states.get('ems.gridPowerRawW').val, first);
    assert.equal(f.states.get('ems.gridPowerW').val, first);
});

test('a genuine previous0W remains a valid averaging baseline', async () => {
    const f = await fixture(); f.sample(0); await f.engine.tick();
    f.engine._gridPowerLastTs = Date.now() - 1000;
    f.sample(600); await f.engine.tick();
    const filtered = f.states.get('ems.gridPowerW').val;
    assert.ok(filtered > 0 && filtered <= 300, `expected preserved smoothing from real zero, got ${filtered}`);
    assert.equal(f.states.get('ems.gridPowerRawW').val, 600);
});

for (const failure of ['disconnected', 'stale', 'missing', 'resolver-error']) test(`fresh recovery after ${failure} discards obsolete opposite-sign smoothing`, async () => {
    const f = await fixture();
    // A real settled export before the interruption, not an invented zero baseline.
    f.engine._gridPowerAvgW = -5000; f.engine._gridPowerLastTs = Date.now();
    f.sample(-5000); await f.engine.tick();
    const previousWrites = f.states.get('ems.gridPowerW');
    if (failure === 'disconnected') f.connected(false);
    if (failure === 'stale') f.sample(-5000, 3600000);
    if (failure === 'missing') f.dp.handleStateChange('meter.grid', null);
    const original = f.dp.getNumber;
    if (failure === 'resolver-error') f.dp.getNumber = () => { throw new Error('TEST_NVP_RESOLVER_FAILED'); };
    await f.engine.tick();
    assert.equal(f.adapter._nvpFreshnessSnapshot.usable, false);
    assert.equal(f.states.get('ems.gridPowerW'), previousWrites, 'invalid data must not publish a fresh fabricated power');
    f.dp.getNumber = original; f.connected(true); f.sample(600);
    await f.engine.tick();
    assert.equal(f.states.get('ems.gridPowerRawW').val, 600);
    assert.equal(f.states.get('ems.gridPowerW').val, 600, 'fresh import must not continue an obsolete export average');
});

test('overlapping requests retain one actual control cycle and release after rejected work', async () => {
    const f = await fixture(); f.sample(600);
    let release; let entered; let calls = 0;
    const enteredPromise = new Promise(resolve => { entered = resolve; });
    const blocked = new Promise(resolve => { release = resolve; });
    f.engine.mm.tick = async () => { calls++; entered(); await blocked; throw new Error('TEST_MODULE_FAILURE'); };
    const active = f.engine.tick(); const failure = assert.rejects(active, /TEST_MODULE_FAILURE/);
    await enteredPromise;
    await Promise.all(Array.from({ length: 100 }, () => f.engine.tick()));
    assert.equal(calls, 1); assert.equal(f.engine._activeCycleCompletions.size, 1);
    release(); await failure;
    assert.equal(f.engine._tickRunning, false); assert.equal(f.engine._activeCycleCompletions.size, 0);
    f.engine.mm.tick = async () => { calls++; };
    await f.engine.tick(); assert.equal(calls, 2);
});
