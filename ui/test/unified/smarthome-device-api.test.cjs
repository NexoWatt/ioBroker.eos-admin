/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
// Real HTTP routes and canonical source modules; mocked device/session/history
// boundaries. This does not replace the central EOS auth suite or a device test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const express = require('express4');
const sourceRoot = path.resolve(__dirname, '../../src-ts/runtime-executables/lib');
const loaded = new Map();
function load(name) {
    if (loaded.has(name)) return loaded.get(name).exports;
    const file = path.join(sourceRoot, `${name}.ts`);
    const mod = new Module(file, module); mod.filename = file;
    mod.paths = Module._nodeModulePaths(path.dirname(file)); loaded.set(name, mod);
    const native = mod.require.bind(mod);
    mod.require = id => id.startsWith('./') && fs.existsSync(path.join(sourceRoot, `${id.slice(2)}.ts`)) ? load(id.slice(2)) : native(id);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, resolveJsonModule: true },
    }).outputText, file);
    return mod.exports;
}
const { registerSmartHomeDeviceApi, createDeviceSnapshotReader } = load('smarthome-device-api');
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function stateObject(type, write = true, extra = {}) { return { type: 'state', common: { type, read: true, write, ...extra } }; }
function configured(id, profile, fields, readOnly = false) { return { id, behavior: { readOnly }, io: { deviceControls: { profile, fields } } }; }
async function harness(t, profile = 'socket', fields = [{ key: 'SET', readId: 'fixture.0.set', writeId: 'fixture.0.set' }]) {
    const devices = new Map([['device', configured('device', profile, fields)]]);
    const objects = new Map([['fixture.0.set', stateObject('boolean')]]);
    const values = new Map(); const writes = []; const historyCalls = [];
    const permissions = { allowed: true, licensed: true, owned: true };
    const host = {
        device: id => devices.get(id),
        canOperate: () => permissions.licensed && permissions.owned,
        authorize: async req => req.get('x-session') === 'allowed' && permissions.allowed,
        readObject: async id => objects.get(id),
        readState: async id => values.get(id),
        writeState: async (id, value) => { writes.push({ id, value }); },
        history: async (id, options) => { historyCalls.push({ id, options }); return []; },
    };
    const guard = (req, res, next) => req.get('x-session') === 'allowed' ? next() : res.status(401).json({ ok: false, error: 'SESSION_REQUIRED' });
    const discovery = (req, res, next) => req.get('x-installer') === 'true' ? guard(req, res, next) : res.status(403).json({ ok: false, error: 'DISCOVERY_FORBIDDEN' });
    const app = express(); app.use(express.json({ limit: '32kb' }));
    registerSmartHomeDeviceApi(app, host, guard, discovery);
    const server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = `http://127.0.0.1:${server.address().port}`;
    async function request(route, body, headers = {}) {
        const response = await fetch(base + route, { method: body === undefined ? 'GET' : 'POST',
            headers: { 'x-session': 'allowed', 'content-type': 'application/json', ...headers },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(9000) });
        return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
    }
    return { devices, objects, values, writes, historyCalls, host, permissions, request,
        command: body => request('/api/smarthome/control', body),
        history: query => request('/api/smarthome/control-history?' + new URLSearchParams(query)),
    };
}

test('HTTP route guards and malformed requests never accept a caller-supplied datapoint', async t => {
    const h = await harness(t);
    assert.equal((await h.request('/api/smarthome/control-profiles')).status, 403);
    assert.equal((await h.request('/api/smarthome/control-profiles', undefined, { 'x-installer': 'true' })).status, 200);
    assert.equal((await h.request('/api/smarthome/control', { id: 'device', key: 'SET', value: true }, { 'x-session': '' })).status, 401);
    for (const body of [{}, [], { id: 'device' }, { id: 'device', key: 'SET' },
        { id: 'device', key: 'SET', value: true, writeId: 'fixture.0.other' },
        { id: 'device', key: 'SET', value: true, confirmed: 'yes' },
        { id: 'device', values: [], key: 'SET', value: true },
        { id: 'device', values: [{ key: 'SET', value: true, id: 'other' }] },
        { id: 'device', key: 'SET', value: 'true' }, { id: 'device', key: 'SET', value: {} }]) {
        assert.equal((await h.command(body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await h.command({ id: 'fixture.0.other', key: 'SET', value: true })).status, 404);
    assert.equal((await h.command({ id: 'device', key: 'UNMAPPED', value: true })).data.ok, false);
    assert.deepEqual(h.writes, []);
});

test('successful command acknowledges only handoff and readonly devices refuse writes', async t => {
    const h = await harness(t);
    const response = await h.command({ id: 'device', key: 'SET', value: true });
    assert.deepEqual(response.data, { ok: true, accepted: true }); assert.equal(response.cache, 'no-store');
    assert.deepEqual(h.writes, [{ id: 'fixture.0.set', value: true }]);
    h.devices.get('device').behavior.readOnly = true;
    assert.equal((await h.command({ id: 'device', key: 'SET', value: false })).status, 403);
    assert.equal(h.writes.length, 1);
});

test('authorization, license and ownership are checked again immediately before writing', async t => {
    for (const revoked of ['allowed', 'licensed', 'owned']) {
        const h = await harness(t);
        h.host.readObject = async id => { h.permissions[revoked] = false; return h.objects.get(id); };
        const response = await h.command({ id: 'device', key: 'SET', value: true });
        assert.equal(response.status, revoked === 'allowed' ? 403 : 503, revoked);
        assert.deepEqual(h.writes, []);
    }
});

test('configuration changes during metadata read invalidate the prepared command', async t => {
    const h = await harness(t); const entered = deferred(); const release = deferred();
    h.host.readObject = async id => { entered.resolve(); await release.promise; return h.objects.get(id); };
    const pending = h.command({ id: 'device', key: 'SET', value: true }); await entered.promise;
    h.devices.get('device').io.deviceControls.fields[0].writeId = 'fixture.0.changed'; release.resolve();
    const response = await pending;
    assert.equal(response.status, 409); assert.equal(response.data.error, 'EOS_CONTROL_CONFIG_CHANGED'); assert.deepEqual(h.writes, []);
});

test('expired command never starts a late device write after delayed authorization resolves', async t => {
    const h = await harness(t); let now = Date.now(); let checks = 0;
    t.mock.method(Date, 'now', () => now);
    h.host.authorize = async () => { checks++; if (checks === 2) now += 6000; return true; };
    const response = await h.command({ id: 'device', key: 'SET', value: true });
    assert.equal(checks, 2); assert.equal(response.status, 503); assert.equal(response.data.error, 'EOS_CONTROL_TIMEOUT');
    assert.deepEqual(h.writes, []);
});

test('button sends one true command without a fabricated false release or retry', async t => {
    const h = await harness(t, 'button', [{ key: 'SET', writeId: 'fixture.0.button' }]);
    h.objects.set('fixture.0.button', stateObject('boolean', true, { role: 'button', read: false }));
    assert.equal((await h.command({ id: 'device', key: 'SET', value: false })).data.ok, false);
    assert.equal((await h.command({ id: 'device', key: 'SET', value: true })).status, 200);
    assert.deepEqual(h.writes, [{ id: 'fixture.0.button', value: true }]);
});

test('color batch validates every field before first write and rechecks permission between writes', async t => {
    const h = await harness(t, 'rgb', ['RED', 'GREEN', 'BLUE'].map(key => ({ key, writeId: `fixture.0.${key}` })));
    for (const key of ['RED', 'GREEN', 'BLUE']) h.objects.set(`fixture.0.${key}`, stateObject('number', true, { min: 0, max: 255 }));
    const command = values => h.command({ id: 'device', values });
    assert.equal((await command([{ key: 'RED', value: 10 }, { key: 'GREEN', value: 256 }])).data.ok, false);
    assert.deepEqual(h.writes, []);
    assert.equal((await command([{ key: 'RED', value: 10 }, { key: 'RED', value: 20 }])).data.ok, false);
    assert.equal((await command([{ key: 'RED', value: 10 }, { key: 'GREEN', value: 20 }])).status, 200);
    assert.deepEqual(h.writes.map(item => item.value), [10, 20]);
    h.writes.length = 0;
    h.host.writeState = async (id, value) => { h.writes.push({ id, value }); h.permissions.allowed = false; };
    assert.equal((await command([{ key: 'RED', value: 30 }, { key: 'GREEN', value: 40 }])).status, 403);
    assert.deepEqual(h.writes, [{ id: 'fixture.0.RED', value: 30 }]);
});

test('STOP bypasses the busy-device queue while concurrent movement is rejected', async t => {
    const h = await harness(t, 'blindButtons', [
        { key: 'OPEN', writeId: 'fixture.0.open' }, { key: 'CLOSE', writeId: 'fixture.0.close' }, { key: 'STOP', writeId: 'fixture.0.stop' },
    ]);
    for (const key of ['open', 'close', 'stop']) h.objects.set(`fixture.0.${key}`, stateObject('boolean', true, { role: `button.${key}`, read: false }));
    const entered = deferred(); const release = deferred();
    h.host.writeState = async (id, value) => { h.writes.push({ id, value }); if (id.endsWith('.open')) { entered.resolve(); await release.promise; } };
    const opening = h.command({ id: 'device', key: 'OPEN', value: true }); await entered.promise;
    assert.equal((await h.command({ id: 'device', key: 'CLOSE', value: true })).status, 409);
    assert.equal((await h.command({ id: 'device', key: 'STOP', value: true })).status, 200);
    assert.deepEqual(h.writes.map(item => item.id), ['fixture.0.open', 'fixture.0.stop']);
    release.resolve(); assert.equal((await opening).status, 200);
});

test('history uses only configured readable fields, bounds work and discards invalid samples', async t => {
    const h = await harness(t, 'temperature', [{ key: 'ACTUAL', readId: 'fixture.0.temperature' }]);
    h.objects.set('fixture.0.temperature', stateObject('number', false));
    const end = Date.now(); const start = end - 10000;
    for (const query of [{ id: 'device', key: 'ACTUAL', maxPoints: '1001' }, { id: 'device', key: 'ACTUAL', from: '0', to: String(end) },
        { id: 'device', key: 'ACTUAL', from: String(end), to: String(start) }, { id: 'device', key: 'ACTUAL', writeId: 'other' }]) {
        assert.equal((await h.history(query)).status, 400);
    }
    assert.equal((await h.history({ id: 'device', key: 'OTHER' })).status, 404);
    assert.deepEqual(h.historyCalls, []);
    h.host.history = async (id, options) => {
        h.historyCalls.push({ id, options });
        return { result: [
            { ts: start + 4000, val: 4 }, { ts: start + 1000, val: 1 }, { ts: start + 3000, val: 3 }, { ts: start + 2000, val: 2 },
            { ts: start - 1, val: 9 }, { ts: end + 1, val: 9 }, { ts: start + 5000, val: 'bad' }, { ts: start + 6000, val: 9, q: 0x40 },
        ] };
    };
    const response = await h.history({ id: 'device', key: 'ACTUAL', from: String(start), to: String(end), maxPoints: '2' });
    assert.equal(response.status, 200); assert.equal(response.cache, 'no-store'); assert.equal(response.data.truncated, true);
    assert.deepEqual(response.data.points, [{ ts: start + 1000, value: 1 }, { ts: start + 4000, value: 4 }]);
    assert.deepEqual(h.historyCalls, [{ id: 'fixture.0.temperature', options: { start, end, count: 2, aggregate: 'minmax' } }]);
});

test('history rejects permissions revoked while awaiting data and expires stalled history', async t => {
    const h = await harness(t, 'temperature', [{ key: 'ACTUAL', readId: 'fixture.0.temperature' }]);
    h.objects.set('fixture.0.temperature', stateObject('number', false));
    h.host.history = async () => { h.permissions.allowed = false; return [{ ts: Date.now(), val: 23 }]; };
    assert.equal((await h.history({ id: 'device', key: 'ACTUAL' })).status, 403);
    h.permissions.allowed = true; h.host.history = () => new Promise(() => {});
    const response = await h.history({ id: 'device', key: 'ACTUAL' });
    assert.equal(response.status, 503); assert.equal(response.data.error, 'EOS_CONTROL_HISTORY_TIMEOUT');
    h.host.history = async () => [];
    assert.equal((await h.history({ id: 'device', key: 'ACTUAL' })).status, 200);
    assert.deepEqual(h.writes, []);
});

test('snapshot cache reuses overlapping read promises only within its own snapshot', async () => {
    let objectReads = 0; let stateReads = 0;
    const host = { readObject: async () => { objectReads++; return stateObject('number'); }, readState: async () => { stateReads++; return { val: 0 }; } };
    const first = createDeviceSnapshotReader(host);
    await Promise.all([first.readObject('a'), first.readObject('a'), first.readState('a'), first.readState('a')]);
    assert.equal(objectReads, 1); assert.equal(stateReads, 1);
    const second = createDeviceSnapshotReader(host); await second.readObject('a'); await second.readState('a');
    assert.equal(objectReads, 2); assert.equal(stateReads, 2);
});
