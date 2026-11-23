/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const loaded = new Map();
function sourceModule(name) {
    if (loaded.has(name)) return loaded.get(name).exports;
    const filename = path.resolve(__dirname, `../../lib/${name}.js`);
    const compiled = new Module(filename, module);
    compiled.filename = filename; compiled.paths = Module._nodeModulePaths(path.dirname(filename)); loaded.set(name, compiled);
    const originalRequire = compiled.require.bind(compiled);
    compiled.require = id => id.startsWith('./smarthome-') ? sourceModule(id.slice(2)) : originalRequire(id);
    compiled._compile(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,
        `../../src-ts/runtime-executables/lib/${name}.ts`), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText, filename);
    return compiled.exports;
}
const { createDeviceAliases } = sourceModule('smarthome-device-aliases');

function fixture(entries = {}) {
    const objects = new Map(Object.entries(entries)); const creates = []; const reads = [];
    const host = {
        async readObject(id) { reads.push(id); return objects.get(id); },
        async createObjectIfAbsent(id, object) { creates.push(id); if (!objects.has(id)) objects.set(id, structuredClone(object)); },
        async writeState() { throw new Error('Alias creation must never write actuator values'); },
        async readState() { throw new Error('Alias creation uses object metadata only'); },
    };
    return { objects, creates, reads, host };
}
function state(type, extra = {}) { return { type: 'state', common: { type, read: true, write: true, ...extra }, native: { credential: 'must-never-copy' } }; }
function device(profile = 'light', fields = [{ key: 'SET', readId: 'physical.0.light', writeId: 'physical.0.light' }]) {
    return { id: 'customer-light', alias: 'Wohnzimmer', roomId: 'living', floorId: 'ground', order: 7,
        behavior: { favorite: true, readOnly: false }, customSetting: { retained: true },
        io: { deviceControls: { profile, fields }, switch: { readId: 'physical.0.light', writeId: 'physical.0.light' } },
        importProvenance: { sourceId: 'physical.0.light-channel', controlId: 'physical.0.light-channel#light',
            sourceValues: { 'io.switch.readId': 'physical.0.light', 'io.switch.writeId': 'manual-baseline',
                'io.deviceControls.fields.SET.readId': 'physical.0.light', 'io.deviceControls.fields.SET.writeId': 'physical.0.light' } } };
}
function errorCode(code) { return error => error && error.code === code; }
async function settle() { for (let n = 0; n < 50; n++) await Promise.resolve(); }

test('explicit alias creation preserves customer data, metadata and source provenance, creates only objects and rewrites matching legacy paths', async () => {
    const source = state('boolean', { role: 'switch.light', name: 'Native light', desc: 'Description', custom: { password: 'secret' } });
    const h = fixture({ 'physical.0.light': source }); const input = [device()]; const before = structuredClone(input);
    const result = await createDeviceAliases(input, h.host);
    assert.deepEqual(input, before); assert.deepEqual(h.objects.get('physical.0.light'), source);
    const output = result.devices[0]; const id = output.io.deviceControls.fields[0].readId;
    assert.match(id, /^alias\.0\.nexowatt_eos\.[0-9a-f]{24}\.SET$/);
    assert.equal(output.io.deviceControls.fields[0].writeId, id);
    assert.equal(output.io.switch.readId, id); assert.equal(output.io.switch.writeId, id);
    assert.equal(output.roomId, before[0].roomId); assert.equal(output.floorId, before[0].floorId);
    assert.deepEqual(output.behavior, before[0].behavior); assert.deepEqual(output.customSetting, before[0].customSetting);
    assert.equal(output.importProvenance.sourceId, before[0].importProvenance.sourceId);
    assert.equal(output.importProvenance.sourceValues['io.switch.readId'], id);
    assert.equal(output.importProvenance.sourceValues['io.switch.writeId'], 'manual-baseline');
    assert.equal(output.importProvenance.sourceValues['io.deviceControls.fields.SET.writeId'], id);
    const alias = h.objects.get(id);
    assert.deepEqual(alias.common.alias, { id: 'physical.0.light' });
    assert.equal(alias.common.type, 'boolean'); assert.equal(alias.common.read, true); assert.equal(alias.common.write, true);
    assert.equal(alias.common.role, 'switch.light'); assert.equal(alias.common.desc, 'Description');
    assert.equal(alias.common.custom, undefined); assert.equal(alias.native.credential, undefined);
    assert.equal(alias.acl.state, 0x660);
    assert.deepEqual(h.objects.get(id.slice(0, id.lastIndexOf('.'))).native.eosSmartHomeAlias,
        { schema: 1, deviceId: before[0].id, sourceId: before[0].importProvenance.sourceId, controlId: before[0].importProvenance.controlId });
    assert.equal(result.created.length, 3); assert.equal(result.reused.length, 0);
});

test('retry of original or returned draft is idempotent and existing user aliases retain conversion expressions untouched', async () => {
    const h = fixture({ 'physical.0.light': state('boolean') }); const input = [device()];
    const first = await createDeviceAliases(input, h.host); const snapshot = structuredClone([...h.objects]);
    const second = await createDeviceAliases(input, h.host);
    assert.deepEqual(second.devices, first.devices); assert.equal(second.created.length, 0); assert.equal(second.reused.length, 3);
    const third = await createDeviceAliases(first.devices, h.host);
    assert.equal(third.created.length, 0); assert.equal(third.reused.length, 1); assert.deepEqual([...h.objects], snapshot);
    const own = state('boolean', { alias: { id: 'physical.0.light', read: '!val', write: '!val' }, name: 'Customer name' });
    h.objects.set('alias.0.customer.light', own);
    const mapped = device('light', [{ key: 'SET', readId: 'alias.0.customer.light', writeId: 'alias.0.customer.light' }]);
    const reused = await createDeviceAliases([mapped], h.host);
    assert.equal(reused.devices[0].io.deviceControls.fields[0].writeId, 'alias.0.customer.light');
    assert.equal(reused.created.length, 0); assert.deepEqual(h.objects.get('alias.0.customer.light'), own);
});

test('same-shaped separate targets produce paired alias IDs; differing types/ranges use distinct READ and WRITE aliases without fallback', async () => {
    const h = fixture({ 'physical.0.read': state('number', { min: 0, max: 100, unit: '%', step: 1 }),
        'physical.0.write': state('number', { min: 0, max: 100, unit: '%', step: 1 }) });
    const base = device('slider', [{ key: 'SET', readId: 'physical.0.read', writeId: 'physical.0.write' }]);
    const first = await createDeviceAliases([base], h.host);
    const pair = first.devices[0].io.deviceControls.fields[0];
    assert.equal(pair.readId, pair.writeId);
    assert.deepEqual(h.objects.get(pair.readId).common.alias.id, { read: 'physical.0.read', write: 'physical.0.write' });
    assert.equal(h.objects.get(pair.readId).common.max, 100); assert.equal(h.objects.get(pair.readId).common.step, 1);
    h.objects.set('physical.0.bool', state('boolean'));
    const split = device('universal', [{ key: 'VALUE', readId: 'physical.0.read', writeId: 'physical.0.bool' }]); split.id = 'split-types';
    const result = await createDeviceAliases([split], h.host); const field = result.devices[0].io.deviceControls.fields[0];
    assert.match(field.readId, /VALUE_READ$/); assert.match(field.writeId, /VALUE_WRITE$/);
    assert.equal(h.objects.get(field.readId).common.write, false); assert.equal(h.objects.get(field.writeId).common.read, false);
    assert.equal(h.objects.get(field.readId).common.type, 'number'); assert.equal(h.objects.get(field.writeId).common.type, 'boolean');
    const sensor = device('temperature', [{ key: 'ACTUAL', readId: 'physical.0.read' }]); sensor.id = 'read-only';
    const sensorResult = await createDeviceAliases([sensor], h.host);
    assert.equal(sensorResult.devices[0].io.deviceControls.fields[0].writeId, undefined);
    assert.equal(h.objects.get(sensorResult.devices[0].io.deviceControls.fields[0].readId).common.write, false);
});

test('foreign root or deterministic state collision is never overwritten and preflight creates no partial objects', async () => {
    const h = fixture({ 'physical.0.light': state('boolean'), 'alias.0.nexowatt_eos': { type: 'folder', common: { name: 'Foreign' }, native: {} } });
    await assert.rejects(createDeviceAliases([device()], h.host), errorCode('EOS_ALIAS_COLLISION'));
    assert.equal(h.creates.length, 0); assert.equal(h.objects.get('alias.0.nexowatt_eos').common.name, 'Foreign');
    h.objects.delete('alias.0.nexowatt_eos');
    const first = await createDeviceAliases([device()], h.host); const target = first.devices[0].io.deviceControls.fields[0].readId;
    h.objects.get(target).common.alias.id = 'physical.0.other'; const creates = h.creates.length;
    await assert.rejects(createDeviceAliases([device()], h.host), errorCode('EOS_ALIAS_COLLISION'));
    assert.equal(h.creates.length, creates); assert.equal(h.objects.get(target).common.alias.id, 'physical.0.other');
});

test('partial object failure reports created and uncertain IDs, retains draft and permits deliberate safe retry', async () => {
    const h = fixture({ 'physical.0.light': state('boolean') }); const originalCreate = h.host.createObjectIfAbsent;
    h.host.createObjectIfAbsent = async (id, object) => { if (object.type === 'state') throw new Error('database offline'); return originalCreate(id, object); };
    const input = [device()]; const before = structuredClone(input); let partial;
    await assert.rejects(createDeviceAliases(input, h.host), error => { partial = error; return error.code === 'EOS_ALIAS_OPERATION_FAILED'; });
    assert.equal(partial.created.length, 2); assert.equal(partial.uncertain.length, 1); assert.deepEqual(input, before);
    h.host.createObjectIfAbsent = originalCreate;
    const retry = await createDeviceAliases(input, h.host);
    assert.equal(retry.created.length, 1); assert.equal(retry.reused.length, 2);
});

test('invalid permissions, secret aliases, forbidden IDs and unknown profile slots fail before any alias mutation', async () => {
    const h = fixture({ 'physical.0.light': state('boolean', { write: false }),
        'alias.0.secret': state('boolean', { alias: { id: 'physical.0.hidden' } }),
        'physical.0.hidden': state('boolean', { role: 'text.secret' }) });
    await assert.rejects(createDeviceAliases([device()], h.host), errorCode('EOS_CONTROL_NOT_WRITABLE'));
    await assert.rejects(createDeviceAliases([device('light', [{ key: 'SET', readId: 'alias.0.secret' }])], h.host), errorCode('EOS_CONTROL_ID_FORBIDDEN'));
    await assert.rejects(createDeviceAliases([device('light', [{ key: 'SET', writeId: 'system.adapter.admin.0.alive' }])], h.host));
    await assert.rejects(createDeviceAliases([device('temperature', [{ key: 'ACTUAL', writeId: 'physical.0.light' }])], h.host));
    assert.equal(h.creates.length, 0);
});

test('input bounds/getters and ambiguous generated suffix collisions fail without invoking state writes', async () => {
    const h = fixture({ 'physical.0.number': state('number'), 'physical.0.bool': state('boolean') });
    await assert.rejects(createDeviceAliases([], h.host));
    await assert.rejects(createDeviceAliases(Array.from({ length: 101 }, (_, i) => ({ ...device(), id: String(i) })), h.host));
    const getter = {}; Object.defineProperty(getter, 'id', { enumerable: true, get() { throw new Error('getter must not execute'); } });
    await assert.rejects(createDeviceAliases([getter], h.host), errorCode('EOS_ALIAS_REQUEST_INVALID'));
    const conflict = device('universal', [{ key: 'VALUE', readId: 'physical.0.number', writeId: 'physical.0.bool' },
        { key: 'VALUE_READ', readId: 'physical.0.bool' }]);
    await assert.rejects(createDeviceAliases([conflict], h.host), errorCode('EOS_ALIAS_PLAN_COLLISION'));
    assert.equal(h.creates.length, 0);
});

test('concurrent explicit requests are rejected rather than queued; readback races retain foreign objects', async () => {
    const h = fixture({ 'physical.0.light': state('boolean') }); let release; const originalRead = h.host.readObject;
    h.host.readObject = id => id === 'physical.0.light' ? new Promise(resolve => { release = () => resolve(h.objects.get(id)); }) : originalRead(id);
    const first = createDeviceAliases([device()], h.host); await settle();
    await assert.rejects(createDeviceAliases([device()], h.host), errorCode('EOS_ALIAS_BUSY'));
    release(); await first;
    const raced = fixture({ 'physical.0.light': state('boolean') });
    raced.host.createObjectIfAbsent = async (id, object) => {
        raced.objects.set(id, object.type === 'state' ? { type: 'state', common: { type: 'boolean', write: false }, native: { foreign: true } } : structuredClone(object));
    };
    await assert.rejects(createDeviceAliases([device()], raced.host), errorCode('EOS_ALIAS_READBACK_FAILED'));
    assert.ok([...raced.objects.values()].some(object => object.native?.foreign));
});

test('expired reads never create late alias objects, and later completed requests are not retried automatically', async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
    const h = fixture({ 'physical.0.light': state('boolean') }); let release;
    h.host.readObject = () => new Promise(resolve => { release = resolve; });
    const request = createDeviceAliases([device()], h.host);
    const observed = assert.rejects(request, error => ['EOS_CONTROL_TIMEOUT', 'EOS_ALIAS_TIMEOUT'].includes(error.code));
    await settle(); t.mock.timers.tick(30001); await observed;
    release(state('boolean')); await settle(); assert.equal(h.creates.length, 0);
});
