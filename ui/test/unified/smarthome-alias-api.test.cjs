/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const express = require('express4');
const sourceRoot = path.resolve(__dirname, '../../src-ts/runtime-executables/lib'); const modules = new Map();
function load(name) {
    if (modules.has(name)) return modules.get(name).exports;
    const file = path.join(sourceRoot, `${name}.ts`); const mod = new Module(file, module);
    mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); modules.set(name, mod);
    const native = mod.require.bind(mod);
    mod.require = id => id.startsWith('./') && fs.existsSync(path.join(sourceRoot, `${id.slice(2)}.ts`)) ? load(id.slice(2)) : native(id);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText, file);
    return mod.exports;
}
const { registerSmartHomeDeviceApi } = load('smarthome-device-api');
async function harness(t) {
    const permissions = { mapping: true, licensed: true, owned: true }; const writes = []; const creates = []; const checks = [];
    const objects = new Map([['physical.0.light', { type: 'state', common: { type: 'boolean', read: true, write: true, role: 'switch.light' } }]]);
    const host = {
        device: () => undefined, canOperate: () => permissions.licensed && permissions.owned,
        authorize: async req => req.get('x-session') === 'allowed',
        authorizeMapping: async req => { checks.push('mapping'); return req.get('x-session') === 'allowed' && permissions.mapping && permissions.licensed && permissions.owned; },
        readObject: async id => objects.get(id), readState: async () => { throw new Error('No state reads during alias creation'); },
        writeState: async (id, value) => { writes.push({ id, value }); }, history: async () => [],
        createObjectIfAbsent: async (id, object) => { creates.push(id); if (!objects.has(id)) objects.set(id, structuredClone(object)); },
    };
    const guard = (req, res, next) => req.get('x-session') === 'allowed' ? next() : res.status(401).json({ error: 'SESSION_REQUIRED' });
    const discovery = (req, res, next) => req.get('x-installer') === 'true' ? guard(req, res, next) : res.status(403).json({ error: 'DISCOVERY_FORBIDDEN' });
    const app = express(); app.use(express.json({ limit: '5mb' })); registerSmartHomeDeviceApi(app, host, guard, discovery);
    const server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const address = `http://127.0.0.1:${server.address().port}`;
    const devices = [{ id: 'customer-light', alias: 'Kundenlicht', roomId: 'existing-room',
        io: { deviceControls: { profile: 'light', fields: [{ key: 'SET', readId: 'physical.0.light', writeId: 'physical.0.light' }] } } }];
    async function request(body = { devices }, headers = {}) {
        const response = await fetch(`${address}/api/smarthome/aliases`, { method: 'POST',
            headers: { 'content-type': 'application/json', 'x-session': 'allowed', 'x-installer': 'true', ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(9000) });
        return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
    }
    return { permissions, writes, creates, checks, objects, host, devices, request };
}

test('aliases HTTP requires installer guard plus current mapping role, license and ownership; malformed bodies cannot mutate objects or values', async t => {
    const h = await harness(t);
    assert.equal((await h.request(undefined, { 'x-session': '' })).status, 401);
    assert.equal((await h.request(undefined, { 'x-installer': '' })).status, 403);
    for (const key of ['mapping', 'licensed', 'owned']) {
        h.permissions[key] = false; assert.equal((await h.request()).status, 403); h.permissions[key] = true;
    }
    for (const body of [{}, [], { devices: h.devices, writeId: 'system.config' }, { devices: 'bad' }]) assert.equal((await h.request(body)).status, 400);
    assert.deepEqual(h.creates, []); assert.deepEqual(h.writes, []);
});

test('successful aliases HTTP creates only objects, preserves room/ID, returns no-store and safely reuses a repeated explicit request', async t => {
    const h = await harness(t); const result = await h.request();
    assert.equal(result.status, 200); assert.equal(result.cache, 'no-store'); assert.equal(result.data.ok, true);
    assert.equal(result.data.created.length, 3); assert.equal(result.data.devices[0].roomId, 'existing-room');
    assert.equal(result.data.devices[0].id, 'customer-light'); assert.equal(h.checks.length, 5);
    const repeated = await h.request(); assert.equal(repeated.status, 200);
    assert.deepEqual(repeated.data.created, []); assert.equal(repeated.data.reused.length, 3); assert.deepEqual(h.writes, []);
});

test('rights or license revoked during metadata inspection are checked again before the first object creation', async t => {
    for (const key of ['mapping', 'licensed', 'owned']) {
        const h = await harness(t);
        h.host.readObject = async id => { if (id === 'physical.0.light') h.permissions[key] = false; return h.objects.get(id); };
        const result = await h.request(); assert.equal(result.status, 403, key);
        assert.deepEqual(result.data.created, []); assert.deepEqual(h.creates, []); assert.deepEqual(h.writes, []);
    }
});

test('permission revocation between alias objects stops immediately and returns the partial object inventory without state writes', async t => {
    const h = await harness(t); const create = h.host.createObjectIfAbsent;
    h.host.createObjectIfAbsent = async (id, object) => { await create(id, object); h.permissions.mapping = false; };
    const result = await h.request(); assert.equal(result.status, 403); assert.equal(result.data.error, 'EOS_ALIAS_FORBIDDEN');
    assert.equal(result.data.created.length, 1); assert.equal(result.data.uncertain.length, 1);
    assert.equal(h.creates.length, 1); assert.deepEqual(h.writes, []);
});

test('final authorization denial after all alias objects exist still reports created IDs for recovery', async t => {
    const h = await harness(t); const create = h.host.createObjectIfAbsent;
    h.host.createObjectIfAbsent = async (id, object) => { await create(id, object); if (object.type === 'state') h.permissions.licensed = false; };
    const result = await h.request(); assert.equal(result.status, 403); assert.equal(result.data.error, 'EOS_ALIAS_FORBIDDEN');
    assert.equal(result.data.created.length, 3); assert.deepEqual(result.data.uncertain, []); assert.deepEqual(h.writes, []);
});

test('object creation failure and a forbidden alias source produce safe partial responses without leaking backend errors or writing actuator states', async t => {
    const h = await harness(t); const create = h.host.createObjectIfAbsent;
    h.host.createObjectIfAbsent = async (id, object) => { if (object.type === 'state') throw new Error('backend credential detail'); return create(id, object); };
    const failure = await h.request(); assert.equal(failure.status, 400); assert.equal(failure.data.error, 'EOS_ALIAS_OPERATION_FAILED');
    assert.equal(failure.data.created.length, 2); assert.equal(failure.data.uncertain.length, 1);
    assert.ok(!JSON.stringify(failure.data).includes('credential detail'));
    h.objects.get('physical.0.light').common.role = 'text.password';
    const forbidden = await h.request(); assert.equal(forbidden.status, 403); assert.equal(forbidden.data.error, 'EOS_CONTROL_ID_FORBIDDEN');
    assert.deepEqual(h.writes, []);
});
