'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EphemeralMap, ExpiringSnapshot } = require('./fixtures/load-ephemeral-cache.cjs');
const { createHostedCleanup } = require('../ui/lib/hosted-runtime-stop');
const { detectionNow, DetectionError, DETECTION_LIMITS, detectionSnapshot } = require('../ui/lib/smarthome-device-detection');
function clock() {
    let now = 0;
    const tasks = new Map();
    return {
        now: () => now,
        schedule(fn, ms) { const token = {}; tasks.set(token, { fn, at: now + ms }); return token; },
        cancel(token) { tasks.delete(token); },
        advance(ms, runTimers = true) {
            now += ms;
            if (runTimers) for (const [token, task] of tasks) if (task.at <= now) { tasks.delete(token); task.fn(); }
        },
        get timers() { return tasks.size; },
    };
}

test('history response data is unchanged while fresh and released during idle, without another request', () => {
    const time = clock(); const cache = new EphemeralMap(5000, 4, time);
    const payload = { ok: true, series: [[0, 0], [600, 12000]], pricing: { total: 0 } };
    cache.set('month', payload); time.advance(4999);
    assert.strictEqual(cache.get('month'), payload);
    time.advance(1); assert.equal(cache.size, 0); assert.equal(time.timers, 0);
});
test('entry replacement cancels old expiry and the response count remains bounded', () => {
    const time = clock(); const cache = new EphemeralMap(5000, 4, time);
    cache.set('a', 1); time.advance(4000); cache.set('a', 2); time.advance(1001);
    assert.equal(cache.get('a'), 2);
    for (let i = 0; i < 20; i++) cache.set(String(i), i);
    assert.equal(cache.size, 4); assert.equal(time.timers, 4);
    assert.deepEqual([...cache.values()], [16, 17, 18, 19]);
    cache.clear(); assert.equal(cache.size, 0); assert.equal(time.timers, 0);
});
test('delayed timer delivery cannot make an expired response appear fresh', () => {
    const time = clock(); const cache = new EphemeralMap(5000, 4, time);
    cache.set('a', 1); time.advance(5001, false);
    assert.equal(cache.get('a'), undefined); assert.equal(cache.size, 0); assert.equal(time.timers, 0);
});
test('parallel discovery requests share one database snapshot, force refreshes once, and idle evicts it', async () => {
    const time = clock(); let reads = 0;
    const snapshot = new ExpiringSnapshot(async () => ({ objects: { 'device.0': { common: { name: 'ESS' } } }, read: ++reads }), 30000, time);
    const responses = await Promise.all(Array.from({ length: 20 }, () => snapshot.get(true)));
    assert.equal(reads, 1); for (const response of responses) assert.strictEqual(response, responses[0]);
    assert.strictEqual(await snapshot.get(), responses[0]);
    const forced = await snapshot.get(true); assert.equal(reads, 2); assert.equal(forced.read, 2);
    time.advance(30000); assert.equal(snapshot.retained, false); assert.equal(time.timers, 0);
    assert.equal((await snapshot.get()).read, 3); snapshot.close(); assert.equal(time.timers, 0);
});
test('failed discovery can retry and late IO after shutdown cannot repopulate retained data', async () => {
    const time = clock(); let finish; let calls = 0;
    const snapshot = new ExpiringSnapshot(async () => {
        if (++calls === 1) throw new Error('database offline');
        return new Promise(resolve => { finish = resolve; });
    }, 30000, time);
    await assert.rejects(snapshot.get(), /database offline/);
    const pending = snapshot.get(); await Promise.resolve(); snapshot.close(); finish({ large: 'value' });
    await assert.rejects(pending, /EOS_UI_STOPPING/);
    await assert.rejects(snapshot.get(), /EOS_UI_STOPPING/);
    assert.equal(snapshot.retained, false); assert.equal(time.timers, 0);
});
test('canonical discovery wrapper preserves complete objects and ordering while deduplicating database reads', async () => {
    const filename = path.resolve(__dirname, '../ui/src-ts/runtime-executables/main.ts');
    const source = fs.readFileSync(filename, 'utf8');
    const start = source.indexOf('const nwShcfgTdGetObjectsCache = async (force = false) => {');
    const body = source.slice(start, source.indexOf('\n};', start) + 3);
    let reads = 0;
    const objects = { 'device.z': { native: { retained: true } }, 'device.a': { common: { custom: { history: true } } } };
    const runtime = { getForeignObjectsAsync: async pattern => { assert.equal(pattern, '*'); reads++; return objects; } };
    const get = vm.runInNewContext(`(function() { ${body}; return nwShcfgTdGetObjectsCache; })`, { ExpiringSnapshot, detectionNow, DetectionError, DETECTION_LIMITS, detectionSnapshot }).call(runtime);
    const [a, b] = await Promise.all([get(), get()]);
    assert.strictEqual(a, b); assert.strictEqual(a.objects, objects); assert.equal(reads, 1);
    assert.deepEqual(Array.from(a.keys), ['device.a', 'device.z']);
    runtime._nwTypeDetectorObjectsCache.close();
});
test('real idle timer is unreferenced and releases memory without synthetic clock advancement', async () => {
    const cache = new EphemeralMap(15, 1);
    cache.set('a', { retained: true });
    await new Promise(resolve => setTimeout(resolve, 35));
    assert.equal(cache.size, 0);
});

test('idle eviction only removes cache ownership; an active discovery retains its complete snapshot', async () => {
    const time = clock();
    const snapshot = new ExpiringSnapshot(async () => ({ objects: { 'ess.0': { native: { template: 'FENECON' } } } }), 30000, time);
    const active = await snapshot.get(); time.advance(30000);
    assert.equal(snapshot.retained, false);
    assert.equal(active.objects['ess.0'].native.template, 'FENECON'); snapshot.close();
});
test('canonical unload drops idle caches and stops pending snapshot retention', async () => {
    const ts = require('typescript');
    const filename = path.resolve(__dirname, '../ui/src-ts/runtime-executables/main.ts');
    const source = fs.readFileSync(filename, 'utf8');
    const parsed = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const definition = parsed.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'NexoWattVis');
    const methods = definition.members.filter(node => ['onUnload', '_nwGetMemoryDiagnostics', '_nwSetHistoryApiCached'].includes(node.name?.getText(parsed))).map(node => node.getText(parsed));
    const Runtime = vm.runInNewContext(`(class Runtime { ${methods.join('\n')} })`, { Map, Date, clearTimeout, EphemeralMap, createHostedCleanup });
    const runtime = new Runtime(); const time = clock();
    runtime._nwHistoryApiCache = new EphemeralMap(5000, 4, time); runtime._nwHistoryApiCache.set('a', { large: 'history' });
    runtime._nwShcfgDetectCache = new EphemeralMap(30000, 1, time); runtime._nwShcfgDetectCache.set('a', { large: 'result' });
    runtime._nwTypeDetectorObjectsCache = new ExpiringSnapshot(async () => ({ large: 'objects' }), 30000, time);
    await runtime._nwTypeDetectorObjectsCache.get();
    runtime._nwClearTimer = () => {}; runtime._nwCloseServer = done => done();
    runtime._nwStopConnectionHeartbeat = runtime.stopNotificationMonitor = runtime._nwStopLiveCoreRefresh = runtime._nwCloseSseClients = () => {};
    runtime.log = { error() {} };
    let closed = 0;
    await new Promise((resolve, reject) => runtime.onUnload(error => { if (error) reject(error); else { closed++; resolve(); } }));
    assert.equal(closed, 1); assert.equal(time.timers, 0);
    const diagnostics = runtime._nwGetMemoryDiagnostics();
    assert.equal(diagnostics.historyCachedResponses, 0); assert.equal(diagnostics.discoveryCachedResponses, 0);
    assert.equal(diagnostics.discoverySnapshotRetained, false); assert.equal(diagnostics.shuttingDown, true);
    runtime._nwSetHistoryApiCached('late', { ok: true }); assert.equal(runtime._nwHistoryApiCache.size, 0);
});
