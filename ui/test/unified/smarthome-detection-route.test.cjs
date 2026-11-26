'use strict';
/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Executes the canonical read-only discovery route with the actual TypeDetector.
 * No browser, ioBroker service, physical actuator or customer data is involved. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Module = require('node:module');
const { EventEmitter } = require('node:events');
const crypto = require('node:crypto');
const ts = require('typescript');
const { ChannelDetector } = require('@iobroker/type-detector');
const sourceRoot = path.resolve(__dirname, '../../src-ts/runtime-executables');
const loaded = new Map();
function load(name) {
    if (loaded.has(name)) return loaded.get(name).exports;
    const file = path.join(sourceRoot, 'lib', `${name}.ts`);
    const mod = new Module(file, module); mod.filename = file;
    mod.paths = Module._nodeModulePaths(path.dirname(file)); loaded.set(name, mod);
    const native = mod.require.bind(mod);
    mod.require = id => id.startsWith('./') && fs.existsSync(path.join(sourceRoot, 'lib', `${id.slice(2)}.ts`)) ? load(id.slice(2)) : native(id);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText, file);
    return mod.exports;
}
const detection = load('smarthome-device-detection');
const cache = load('ephemeral-cache');
const main = fs.readFileSync(path.join(sourceRoot, 'main.ts'), 'utf8');
const start = main.indexOf('const NW_SHCFG_TD_TYPE_MAP');
const end = main.indexOf('// Kundenansicht erhält nur die Navigation', start);
assert.ok(start >= 0 && end > start);
function fixture() {
    const objects = {};
    for (const name of ['A', 'a', 'B', 'b', 'Z', 'z', '_a']) {
        const id = `fixture.0.${name}`;
        objects[id] = { type: 'channel', common: { name } };
        objects[`${id}.SET`] = { type: 'state', common: { name, type: 'boolean', role: 'switch.light', read: true, write: true } };
    }
    return objects;
}
function harness(objects, overrides = {}) {
    let route;
    let reads = 0;
    const warnings = [];
    const adapter = {
        namespace: 'nexowatt-ui.0', config: {},
        _nwShcfgDetectCache: new cache.EphemeralMap(30000, 1),
        getSmartHomeConfig: () => ({ devices: [], rooms: [], functions: [] }),
        getForeignObjectsAsync: async () => { reads++; return typeof objects === 'function' ? objects() : objects; },
        getForeignStateAsync: () => assert.fail('Discovery must not fetch actuator states'),
        setForeignStateAsync: () => assert.fail('Discovery must not write actuator states'),
        setForeignObjectAsync: () => assert.fail('Discovery must not write objects'),
        log: { warn: message => warnings.push(message) },
    };
    vm.runInNewContext(`(function () { ${main.slice(start, end)} }).call(adapter);`, {
        crypto, setImmediate, AbortController, NwChannelDetector: ChannelDetector,
        ...load('smarthome-import'), ...load('smarthome-device-controls'), ...detection, ...cache,
        ...overrides, adapter, requireDpDiscovery() {},
        app: { get(url, guard, handler) { assert.equal(url, '/api/smarthome/type-detect'); assert.equal(typeof guard, 'function'); route = handler; } },
    });
    return {
        adapter, warnings, get reads() { return reads; },
        request(query = { force: '1' }) {
            const req = Object.assign(new EventEmitter(), { query });
            const res = Object.assign(new EventEmitter(), {
                statusCode: 200, payload: null,
                status(code) { this.statusCode = code; return this; },
                json(value) { this.payload = JSON.parse(JSON.stringify(value)); return this; },
            });
            return { req, res, done: route(req, res) };
        },
        close() { adapter._nwTypeDetectorObjectsCache?.close(); adapter._nwShcfgDetectCache.clear(); },
    };
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('actual detector route finds uppercase and lowercase channel IDs without locale loss', async () => {
    const objects = fixture(); const before = JSON.stringify(objects);
    const h = harness(objects); const request = h.request(); await request.done;
    assert.equal(request.res.statusCode, 200); assert.equal(request.res.payload.ok, true);
    assert.deepEqual(request.res.payload.suggestions.map(item => item.sourceId).sort(), Object.keys(objects).filter(id => objects[id].type === 'channel').sort());
    assert.equal(request.res.payload.diagnostics.complete, true); assert.equal(request.res.payload.diagnostics.objectCount, 14);
    assert.equal(JSON.stringify(objects), before); assert.equal(h.warnings.length, 0); h.close();
});

test('invalid object response and detector exception cannot masquerade as complete empty discovery', async () => {
    for (const [objects, overrides] of [[null, {}], [fixture(), { NwChannelDetector: class { detect() { throw new Error('synthetic private content'); } } }]]) {
        const h = harness(objects, overrides); const request = h.request(); await request.done;
        assert.equal(request.res.statusCode, 500); assert.equal(request.res.payload.error, 'EOS_DETECTION_FAILED');
        assert.equal(request.res.payload.ok, false); assert.equal(request.res.payload.suggestions, undefined);
        assert.ok(h.warnings.every(message => !message.includes('synthetic private content'))); h.close();
    }
});

test('a genuine empty scan explains why without mutating customer configuration', async () => {
    for (const [objects, expected] of [[{}, 'NO_CANDIDATES'], [{ 'fixture.0.empty': { type: 'channel', common: { name: 'Leer' } } }, 'NO_MATCHES']]) {
        const h = harness(objects); const request = h.request(); await request.done;
        assert.equal(request.res.payload.ok, true); assert.equal(request.res.payload.diagnostics.emptyReason, expected);
        assert.deepEqual(request.res.payload.suggestions, []); h.close();
    }
});

test('object and candidate budgets fail explicitly before any detector call', async () => {
    for (const [count, kind] of [[detection.DETECTION_LIMITS.objects + 1, 'folder'], [detection.DETECTION_LIMITS.roots + 1, 'channel']]) {
        const objects = Object.fromEntries(Array.from({ length: count }, (_, i) => [`fixture.0.${i}`, { type: kind }]));
        const h = harness(objects, { NwChannelDetector: class { detect() { assert.fail('Limit must be checked before scanning'); } } });
        const request = h.request(); await request.done;
        assert.equal(request.res.statusCode, 413); assert.equal(request.res.payload.error, 'EOS_DETECTION_LIMIT');
        assert.equal(request.res.payload.suggestions, undefined); h.close();
    }
});

test('HTTP abort releases the route and late IO cannot populate its snapshot', async () => {
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    const h = harness(() => pending); const request = h.request(); await tick();
    assert.equal(h.reads, 1); request.req.aborted = true; request.req.emit('aborted'); await request.done;
    assert.equal(request.res.payload.error, 'EOS_DETECTION_ABORTED');
    assert.equal(h.adapter._nwShcfgDetectionRunning, false);
    assert.equal(h.adapter._nwTypeDetectorObjectsCache.loading, true);
    finish(fixture()); await tick();
    assert.equal(h.adapter._nwTypeDetectorObjectsCache.retained, false);
    assert.equal(h.adapter._nwTypeDetectorObjectsCache.loading, false);
    assert.equal(request.req.listenerCount('aborted'), 0); assert.equal(request.res.listenerCount('close'), 0); h.close();
});

test('expired IO remains single-flight across retries and its late completion is discarded', async () => {
    let finish;
    const pending = new Promise(resolve => { finish = resolve; });
    class ExpiredScan extends detection.DetectionScan {
        async read(operation) { void operation.catch(() => undefined); await tick(); throw new detection.DetectionError('EOS_DETECTION_TIMEOUT'); }
    }
    const h = harness(() => pending, { DetectionScan: ExpiredScan });
    for (let attempt = 0; attempt < 2; attempt++) {
        const request = h.request(); await request.done;
        assert.equal(request.res.statusCode, 504); assert.equal(request.res.payload.error, 'EOS_DETECTION_TIMEOUT');
    }
    assert.equal(h.reads, 1); assert.equal(h.adapter._nwTypeDetectorObjectsCache.loading, true);
    finish(fixture()); await tick();
    assert.equal(h.adapter._nwTypeDetectorObjectsCache.retained, false);
    assert.equal(h.adapter._nwTypeDetectorObjectsCache.loading, false); h.close();
});

test('monotonic deadline, result limits and shutdown are explicit and separate from empty results', async () => {
    let now = 100;
    const scan = new detection.DetectionScan({ now: () => now });
    assert.throws(() => scan.check('suggestions', detection.DETECTION_LIMITS.suggestions + 1), /EOS_DETECTION_LIMIT/);
    now += detection.DETECTION_LIMITS.timeoutMs;
    assert.throws(() => scan.check(), /EOS_DETECTION_TIMEOUT/);
    const h = harness(fixture()); h.adapter._nwShuttingDown = true;
    const request = h.request(); await request.done;
    assert.equal(h.reads, 0); assert.equal(request.res.statusCode, 503); assert.equal(request.res.payload.error, 'EOS_UI_STOPPING'); h.close();
});

test('read wait expires after its actual timer budget without requiring IO to finish', async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    const pending = new detection.DetectionScan().read(new Promise(() => {}));
    const checked = assert.rejects(pending, /EOS_DETECTION_TIMEOUT/);
    t.mock.timers.tick(detection.DETECTION_LIMITS.readTimeoutMs);
    await checked;
});

test('a read that already exceeded its monotonic load deadline never enters the snapshot', async () => {
    let finish; let now = 0;
    const h = harness(() => new Promise(resolve => { finish = resolve; }), { detectionNow: () => now });
    const request = h.request(); await tick();
    now = detection.DETECTION_LIMITS.readTimeoutMs + 1; finish(fixture()); await request.done;
    assert.equal(request.res.statusCode, 504); assert.equal(request.res.payload.error, 'EOS_DETECTION_TIMEOUT');
    assert.equal(h.adapter._nwTypeDetectorObjectsCache.retained, false); h.close();
});

test('simultaneous discovery returns busy and a cancelled wait observes late rejection', async () => {
    let finish;
    const h = harness(() => new Promise(resolve => { finish = resolve; }));
    const one = h.request(); await tick(); const two = h.request(); await two.done;
    assert.equal(two.res.statusCode, 409); assert.equal(two.res.payload.error, 'EOS_DETECTION_BUSY');
    finish({}); await one.done; h.close();
    const abort = new AbortController(); abort.abort();
    await assert.rejects(new detection.DetectionScan({ signal: abort.signal }).read(Promise.reject(new Error('late io failure'))), /EOS_DETECTION_ABORTED/);
    await tick();
});

test('actual route classifies German and English labels on existing generic temperature points', async () => {
    const objects = {
        'openknx.0.room.RoomTemperature': { type: 'state', common: {
            name: { en: 'Room temperature', de: 'Raumtemperatur' }, role: 'state',
            type: 'number', unit: '°C', read: true, write: false,
        } },
        'hm-rpc.0.channel': { type: 'channel', common: { name: 'Wohnzimmer' } },
        'hm-rpc.0.channel.ACTUAL_TEMPERATURE': { type: 'state', common: {
            name: 'Ist-Temperatur', role: 'value.temperature', type: 'number', unit: '°C', read: true, write: false,
        } },
    };
    const h = harness(objects);
    try {
        const request = h.request(); await request.done;
        assert.equal(request.res.statusCode, 200);
        const { suggestions } = request.res.payload;
        for (const id of ['openknx.0.room.RoomTemperature', 'hm-rpc.0.channel.ACTUAL_TEMPERATURE']) {
            const matches = suggestions.filter(s => s.states.some(st => st.id === id));
            assert.equal(matches.length, 1, id);
            assert.ok(matches[0].functionCategories.includes('climate'), id);
            assert.equal(matches[0].states.find(st => st.id === id).write, false, id);
        }
    } finally { h.close(); }
});

test('guided catalog and folder tree share an expiring guarded index and preserve role priority', async t => {
    const routes = new Map();
    const registeredGuard = () => {};
    assert.match(main, /const requireDpDiscovery = requireCapability\('mapping\.edit'\)/);
    assert.match(main, /registerDatapointPicker\(app, this, requireDpDiscovery\)/);
    const objects = Object.fromEntries([
        ['openknx.0.a', { role: 'value.blind', type: 'number', read: false, write: true }],
        ['openknx.0.b', { role: 'value.blind', type: 'boolean', read: true, write: false }],
        ['openknx.0.c', { role: 'value.dimmer', type: 'number', read: true, write: false }],
        ['openknx.0.z', { role: 'value.blind', type: 'number', unit: '%', read: true, write: false }],
    ].map(([id, common]) => [id, { type: 'state', common: { name: id, ...common } }]));
    let reads = 0;
    let now = 0;
    const timers = new Map();
    const warnings = [];
    const time = {
        now: () => now,
        schedule(fn, ms) { const token = {}; timers.set(token, { fn, at: now + ms }); return token; },
        cancel(token) { timers.delete(token); },
    };
    const adapter = { getForeignObjectsAsync: async (pattern, kind) => {
        assert.equal(pattern, '*'); assert.equal(kind, 'state');
        reads++; return objects;
    }, log: { warn: message => warnings.push(message) } };
    const app = { get(url, guard, handler) {
        assert.equal(guard, registeredGuard);
        for (const route of [url].flat()) routes.set(route, handler);
    } };
    const picker = load('datapoint-picker').registerDatapointPicker(app, adapter, registeredGuard, time);
    t.after(() => picker.close());
    async function request(route, query) {
        const response = {
            statusCode: 200,
            status(code) { this.statusCode = code; return this; },
            json(value) { this.payload = JSON.parse(JSON.stringify(value)); return this; },
        };
        await routes.get(route)({ query }, response);
        return response;
    }
    const query = { direction: 'read', types: 'number', roles: 'value.blind', limit: '1' };
    const [guided, browse] = await Promise.all([
        request('/api/smarthome/dpsearch', query),
        request('/api/object/tree', { prefix: 'openknx.0' }),
    ]);
    assert.equal(guided.statusCode, 200);
    assert.deepEqual(guided.payload.results.map(item => [item.id, item.read, item.write]), [['openknx.0.z', true, false]]);
    const searched = await request('/api/smarthome/dpsearch', { ...query, q: 'blind' });
    assert.deepEqual(searched.payload.results, guided.payload.results);
    assert.deepEqual(browse.payload.children.filter(item => item.write).map(item => item.id), ['openknx.0.a']);
    assert.equal(reads, 1);
    assert.equal((await request('/api/smarthome/dpsearch', { direction: ['read', 'write'] })).statusCode, 400);
    const unfiltered = await request('/api/smarthome/dpsearch', { q: 'openknx.0', limit: '1' });
    assert.deepEqual(unfiltered.payload.results.map(item => item.id), ['openknx.0.a']);

    objects['openknx.0.z'].common.name = 'Changed';
    now += 16000;
    const freshTree = await request('/api/smarthome/object/tree', { prefix: 'openknx.0' });
    assert.deepEqual(freshTree.payload, browse.payload, 'tree keeps the 30s snapshot');
    const refreshed = await request('/api/smarthome/dpsearch', query);
    assert.equal(refreshed.payload.results[0].name, 'Changed');
    assert.equal(reads, 2, 'search rebuilds after 15s');
    now += 30000;
    assert.equal(timers.size, 1);
    for (const [token, task] of timers) if (task.at <= now) { timers.delete(token); task.fn(); }
    assert.equal(timers.size, 0, 'idle expiry releases the previous index and timer');
    await request('/api/object/tree', { prefix: 'openknx.0' });
    assert.equal(reads, 3);

    let resolveRead;
    adapter.getForeignObjectsAsync = () => new Promise(resolve => { resolveRead = resolve; });
    now += 31000;
    const pending = request('/api/smarthome/dpsearch', query);
    await tick();
    picker.close();
    resolveRead(objects);
    assert.equal((await pending).statusCode, 500);
    assert.equal(timers.size, 0, 'shutdown prevents a late read from retaining another index');
    assert.equal(warnings.length, 1);
});
