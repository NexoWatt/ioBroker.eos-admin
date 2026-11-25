/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/lib/eosUpdateSnapshot.ts');
const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { readEosUpdateConfiguration, normalizeUpdateConfiguration } = loaded.exports;
const namespace = 'eos-admin.0';
const acl = { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600 };
const encoded = value => `cipher:${Buffer.from(JSON.stringify(value)).toString('base64')}`;
const view = value => JSON.parse(JSON.stringify(value));
function fixture() {
    const reads = []; const objects = new Map(); const states = new Map(); let busy = false;
    objects.set(`system.adapter.${namespace}`, { _id: `system.adapter.${namespace}`, type: 'instance', native: { enabledFeature: false, zero: 0, title: '', secret: 'private-fixture-only' } });
    const reader = { namespace,
        async getForeignObjectAsync(id) { reads.push(id); return structuredClone(objects.get(id) || null); },
        async getForeignStateAsync(id) { reads.push(id); return structuredClone(states.get(id) || null); },
        async getForeignStatesAsync(pattern) { reads.push(pattern); const prefix = pattern.slice(0, -1); return Object.fromEntries([...states].filter(([id]) => id.startsWith(prefix)).map(([id, state]) => [id, structuredClone(state)])); },
        decrypt(value) { if (!value.startsWith('cipher:')) throw new Error('private-fixture-decryption-details'); return Buffer.from(value.slice(7), 'base64').toString(); },
        isBusy: () => busy,
    };
    const setModule = (id, config, migration) => {
        const objectId = `${namespace}.modules.${id}.configuration`;
        const envelope = { v: 1, encrypted: encoded(config), ...(migration ? { migration } : {}) };
        objects.set(objectId, { _id: objectId, type: 'config', acl: { ...acl }, native: { v: 2, revision: '00000000-0000-4000-8000-000000000001', encrypted: encoded(envelope) } });
    };
    return { reader, objects, states, reads, setModule, busy(value) { busy = value; } };
}

test('snapshot preserves every configured module and false/zero/empty customer values without any write API', async () => {
    const f = fixture();
    for (const id of ['devices', 'eebus', 'backup', 'ui', 'migration']) f.setModule(id, { enabled: false, customer: id, zero: 0, empty: '' });
    f.states.set(`${namespace}.installer.configJson`, { val: JSON.stringify({ datapoints: {}, settingsConfig: { evcsList: [] }, history: { credentialEnvelope: 'opaque' } }), ack: true });
    f.states.set(`${namespace}.settings.flowInvertGrid`, { val: false });
    f.states.set(`${namespace}.settings.limit`, { val: 0 });
    f.states.set(`${namespace}.settings.label`, { val: '' });
    f.states.set(`${namespace}.simulation.active`, { val: false });
    const before = structuredClone([...f.objects]);
    const result = view(await readEosUpdateConfiguration(f.reader));
    assert.equal(result.modules.devices.customer, 'devices');
    assert.equal(Object.keys(result.modules).length, 5);
    assert.equal(result.instanceNative.enabledFeature, false);
    assert.equal(result.values['settings.flowInvertGrid'], false);
    assert.equal(result.values['settings.limit'], 0);
    assert.equal(result.values['settings.label'], '');
    assert.equal(result.values['simulation.active'], false);
    assert.deepEqual(result.values['installer.configJson'].settingsConfig.evcsList, []);
    assert.deepEqual([...f.objects], before);
    assert.ok(f.reads.every(id => id === `system.adapter.${namespace}` || id.startsWith(`${namespace}.`)));
    assert.equal(f.reads.filter(id => id.endsWith('.settings.*')).length, 2);
});

test('protected UI-store migration selects the real legacy installer and customer namespace', async () => {
    const f = fixture();
    const migration = { preserveNamespace: true, source: 'nexowatt-ui.3', sourceVersion: '1.0.37', requiredStates: ['installer.configJson'] };
    f.setModule('ui', { customerName: 'Saved legacy site' }, migration);
    f.states.set('nexowatt-ui.3.installer.configJson', { val: JSON.stringify({ datapoints: { gridPower: 'alias.0.customer.nvp' } }), ack: true });
    f.states.set('nexowatt-ui.3.settings.flowInvertBattery', { val: true });
    const result = view(await readEosUpdateConfiguration(f.reader));
    assert.equal(result.uiNamespace, 'nexowatt-ui.3');
    assert.equal(result.values['installer.configJson'].datapoints.gridPower, 'alias.0.customer.nvp');
    assert.equal(result.values['settings.flowInvertBattery'], true);
    assert.deepEqual(result.moduleMigrations.ui, migration);
    assert.ok(f.reads.includes('nexowatt-ui.3.settings.*'));
    assert.ok(!f.reads.includes('eos-admin.0.installer.configJson'));
});

test('old native module envelope remains supported only in the absence of its authoritative store', async () => {
    const f = fixture(); const native = f.objects.get(`system.adapter.${namespace}`).native;
    native.eosModules = { devices: { v: 1, encrypted: encoded({ devices: [{ id: 'old-meter' }], enabled: false }) } };
    let result = view(await readEosUpdateConfiguration(f.reader));
    assert.equal(result.modules.devices.devices[0].id, 'old-meter');
    f.setModule('devices', { devices: [], enabled: false });
    result = view(await readEosUpdateConfiguration(f.reader));
    assert.deepEqual(result.modules.devices.devices, []);
    assert.equal(Object.hasOwn(result.instanceNative, 'eosModules'), false);
});

test('legacy namespace and protected store identity are validated before reading unrelated data', async () => {
    for (const mutate of [
        f => { f.objects.get(`system.adapter.${namespace}`)._id = 'system.adapter.admin.0'; },
        f => { f.objects.get(`${namespace}.modules.ui.configuration`).acl.object = 0x664; },
        f => { f.objects.get(`${namespace}.modules.ui.configuration`)._id = `${namespace}.modules.devices.configuration`; },
        f => { f.setModule('ui', {}, { preserveNamespace: true, source: 'admin.0' }); },
    ]) {
        const f = fixture(); f.setModule('ui', {}); mutate(f);
        await assert.rejects(readEosUpdateConfiguration(f.reader), /(?:EOS_)?UPDATE_CONFIGURATION_INVALID/);
        assert.ok(!f.reads.some(id => id.startsWith('admin.0.')));
    }
});

test('configured legacy required states cannot silently disappear from the update snapshot', async () => {
    const f = fixture(); f.setModule('ui', {}, { preserveNamespace: true, source: 'nexowatt-ui.0', requiredStates: ['installer.configJson'] });
    await assert.rejects(readEosUpdateConfiguration(f.reader), /(?:EOS_)?UPDATE_CONFIGURATION_INVALID/);
    for (const val of ['', ' ', 'null', '[]', 'false', false, 0]) {
        f.states.set('nexowatt-ui.0.installer.configJson', { val });
        await assert.rejects(readEosUpdateConfiguration(f.reader), /EOS_UPDATE_CONFIGURATION_INVALID/);
    }
});

test('busy and changing customer configuration fail closed rather than returning a mixed snapshot', async () => {
    const f = fixture(); f.busy(true);
    await assert.rejects(readEosUpdateConfiguration(f.reader), /(?:EOS_)?UPDATE_CONFIGURATION_BUSY/);
    assert.equal(f.reads.length, 0);
    f.busy(false); let passes = 0; const get = f.reader.getForeignObjectAsync;
    f.reader.getForeignObjectAsync = async id => {
        if (id === `system.adapter.${namespace}` && ++passes === 2) f.objects.get(id).native.zero = 1;
        return get(id);
    };
    await assert.rejects(readEosUpdateConfiguration(f.reader), /(?:EOS_)?UPDATE_CONFIGURATION_CHANGED/);
    const late = fixture(); const states = late.reader.getForeignStatesAsync;
    late.reader.getForeignStatesAsync = async pattern => { const result = await states(pattern); late.busy(true); return result; };
    await assert.rejects(readEosUpdateConfiguration(late.reader), /(?:EOS_)?UPDATE_CONFIGURATION_BUSY/);
});

test('bounded decoder refuses nested v2 chains and malformed ciphertext without exposing plaintext errors', async () => {
    const f = fixture(); f.setModule('devices', {});
    const object = f.objects.get(`${namespace}.modules.devices.configuration`);
    object.native.encrypted = encoded({ v: 2, encrypted: encoded({ v: 2, encrypted: encoded({ v: 1, encrypted: encoded({}) }) }) });
    await assert.rejects(readEosUpdateConfiguration(f.reader), /(?:EOS_)?UPDATE_CONFIGURATION_INVALID/);
    object.native.encrypted = 'private-invalid-cipher';
    await assert.rejects(readEosUpdateConfiguration(f.reader), error => /(?:EOS_)?UPDATE_CONFIGURATION_INVALID/.test(error.message) && !error.message.includes('private'));
});

test('normalization bounds size/depth/node count and rejects dangerous keys or non-JSON values', () => {
    const sorted = view(normalizeUpdateConfiguration({ b: false, a: [0, '', null] }));
    assert.deepEqual(Object.keys(sorted), ['a', 'b']);
    for (const invalid of [undefined, NaN, Infinity, JSON.parse('{"__proto__":{"x":true}}'), 'x'.repeat(8 * 1024 * 1024 + 1), new Array(100001).fill(0)]) {
        assert.throws(() => normalizeUpdateConfiguration(invalid), /(?:EOS_)?UPDATE_CONFIGURATION_INVALID/);
    }
    let deep = {}; for (let i = 0; i < 41; i++) deep = { child: deep };
    assert.throws(() => normalizeUpdateConfiguration(deep), /(?:EOS_)?UPDATE_CONFIGURATION_INVALID/);
});

test('settings scope and count are bounded without an all-state database scan', async () => {
    const f = fixture();
    f.reader.getForeignStatesAsync = async pattern => { assert.equal(pattern, `${namespace}.settings.*`); return { 'admin.0.password': { val: 'private' } }; };
    await assert.rejects(readEosUpdateConfiguration(f.reader), /(?:EOS_)?UPDATE_CONFIGURATION_INVALID/);
    f.reader.getForeignStatesAsync = async () => Object.fromEntries(Array.from({ length: 513 }, (_, n) => [`${namespace}.settings.${n}`, { val: 0 }]));
    await assert.rejects(readEosUpdateConfiguration(f.reader), /(?:EOS_)?UPDATE_CONFIGURATION_INVALID/);
});

test('cumulative encoded JSON bytes are bounded before serialization or configuration JSON parsing', async () => {
    const big = 'x'.repeat(4 * 1024 * 1024); let visitedTail = false;
    const input = { a: big, b: big };
    Object.defineProperty(input, 'z', { enumerable: true, get() { visitedTail = true; throw new Error('oversized tree was traversed'); } });
    assert.throws(() => normalizeUpdateConfiguration(input), /EOS_UPDATE_CONFIGURATION_INVALID/);
    assert.equal(visitedTail, false);
    const controls = '\u0001'.repeat(2 * 1024 * 1024);
    assert.throws(() => normalizeUpdateConfiguration(controls), /EOS_UPDATE_CONFIGURATION_INVALID/);
    const boundary = 'x'.repeat(8 * 1024 * 1024 - 2);
    assert.equal(normalizeUpdateConfiguration(boundary), boundary);
    assert.throws(() => normalizeUpdateConfiguration(boundary + 'x'), /EOS_UPDATE_CONFIGURATION_INVALID/);
    const f = fixture(); f.states.set(`${namespace}.installer.configJson`, { val: `{"large":"${'x'.repeat(8 * 1024 * 1024)}"}` });
    await assert.rejects(readEosUpdateConfiguration(f.reader), /EOS_UPDATE_CONFIGURATION_INVALID/);
});
