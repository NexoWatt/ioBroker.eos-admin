/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');

// Execute the maintained sources together, so contract migrations and the common
// authorization boundary are exercised instead of generated or mocked copies.
const sourceModules = new Map();
const names = new Set(['smarthome-custom-contract', 'smarthome-device-controls', 'smarthome-device-legacy', 'smarthome-import', 'smarthome-contract']);
function loadSource(name) {
    if (sourceModules.has(name)) return sourceModules.get(name).exports;
    const filename = path.resolve(__dirname, '../../lib', name + '.js');
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(path.dirname(filename));
    sourceModules.set(name, loaded);
    const originalRequire = loaded.require.bind(loaded);
    loaded.require = id => id.startsWith('./') && names.has(id.slice(2)) ? loadSource(id.slice(2)) : originalRequire(id);
    loaded._compile(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,
        '../../src-ts/runtime-executables/lib', name + '.ts'), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText, filename);
    return loaded.exports;
}
const { executeLegacyDeviceWrite } = loadSource('smarthome-device-legacy');
const { normalizeSmartHomeDevice } = loadSource('smarthome-contract');
const both = (key, id = `test.0.${key}`) => ({ key, readId: id, writeId: id });
const controls = (profile, fields) => ({ profile, fields });
const code = expected => error => error && error.code === expected;
function device(io, behavior = {}, type = 'switch') { return normalizeSmartHomeDevice({ id: 'device1', type, io, behavior }); }
function fixture(dev, entries = {}) {
    const objects = new Map(); const states = new Map(); const writes = []; const reads = [];
    const current = { device: dev, authorized: true };
    for (const [id, entry] of Object.entries(entries)) {
        objects.set(id, { type: 'state', common: { read: true, write: true, type: typeof entry.value, ...entry.common } });
        states.set(id, { val: entry.value, q: 0, ack: true, ts: Date.now(), ...entry.state });
    }
    const host = {
        device: id => current.device?.id === id ? current.device : undefined,
        async authorize() { return current.authorized; },
        async readObject(id) { reads.push(['object', id]); return objects.get(id); },
        async readState(id) { reads.push(['state', id]); return states.get(id); },
        async writeState(id, value) { writes.push([id, value]); },
    };
    return { host, objects, states, writes, reads, current };
}

test('profile additions cannot convert legacy read-only fallback fields into writable targets', async () => {
    const readId = 'test.0.reported';
    for (const [type, extra] of [['switch', { switch: { readId } }], ['dimmer', { level: { readId } }],
        ['color', { color: { readId } }], ['player', { player: { volumeReadId: readId, muteReadId: readId, powerReadId: readId, seekReadId: readId } }]]) {
        const dev = device({ ...extra, deviceControls: controls('universal', [{ key: 'VALUE', readId }]) }, {}, type);
        const h = fixture(dev, { [readId]: { value: 20 } });
        await assert.rejects(executeLegacyDeviceWrite(dev, readId, 21, h.host), code('EOS_CONTROL_NOT_WRITABLE'));
        assert.deepEqual(h.writes, []);
    }
    const legacy = device({ switch: { readId } });
    assert.equal(legacy.io.switch.writeId, readId, 'devices without the additive profile retain their historical contract');
});

test('explicit legacy targets still require common.write, matching type, behavior permission and configured identity', async () => {
    const dev = device({ switch: { writeId: 'test.0.SET' }, deviceControls: controls('light', [both('SET')]) });
    const h = fixture(dev, { 'test.0.SET': { value: false, common: { write: false } }, 'test.0.other': { value: false } });
    await assert.rejects(executeLegacyDeviceWrite(dev, 'test.0.SET', true, h.host), code('EOS_CONTROL_NOT_WRITABLE'));
    h.objects.get('test.0.SET').common.write = true;
    await assert.rejects(executeLegacyDeviceWrite(dev, 'test.0.SET', 'true', h.host), code('EOS_CONTROL_VALUE_INVALID'));
    await assert.rejects(executeLegacyDeviceWrite(dev, 'test.0.other', true, h.host), code('EOS_CONTROL_NOT_WRITABLE'));
    dev.behavior.readOnly = true;
    await assert.rejects(executeLegacyDeviceWrite(dev, 'test.0.SET', true, h.host), code('EOS_CONTROL_READ_ONLY'));
    dev.behavior.readOnly = false;
    await executeLegacyDeviceWrite(dev, 'test.0.SET', true, h.host);
    assert.deepEqual(h.writes, [['test.0.SET', true]]);
});

test('legacy cover protection IDs join the authoritative profile and active/uncertain protection blocks movement but not STOP', async () => {
    const dev = device({ cover: { positionWriteId: 'test.0.SET', stopId: 'test.0.STOP', windAlarmId: 'test.0.wind' },
        deviceControls: controls('blind', [both('SET'), both('STOP')]) }, {}, 'blind');
    assert.deepEqual(dev.io.deviceControls.fields.find(field => field.key === 'WIND_ALARM'), { key: 'WIND_ALARM', readId: 'test.0.wind' });
    const h = fixture(dev, { 'test.0.SET': { value: 10, common: { min: 0, max: 100 } },
        'test.0.STOP': { value: false }, 'test.0.wind': { value: true } });
    for (const state of [{ val: true, ack: true, ts: Date.now() }, { val: false, ack: false, ts: Date.now() },
        { val: false, ack: true, q: 1, ts: Date.now() }, { val: false, ack: true, ts: Date.now() - 60001 }]) {
        h.states.set('test.0.wind', state);
        await assert.rejects(executeLegacyDeviceWrite(dev, 'test.0.SET', 80, h.host));
        await executeLegacyDeviceWrite(dev, 'test.0.STOP', true, h.host);
    }
    h.states.set('test.0.wind', { val: false, ack: true, ts: Date.now() });
    await executeLegacyDeviceWrite(dev, 'test.0.SET', 80, h.host);
    assert.deepEqual(h.writes, [...Array.from({ length: 4 }, () => ['test.0.STOP', true]), ['test.0.SET', 80]]);
    assert.throws(() => device({ cover: { windAlarmId: 'test.0.wind' }, deviceControls: controls('blind',
        [both('SET'), { key: 'WIND_ALARM', readId: 'test.0.different' }]) }, {}, 'blind'), /EOS_CONTROL_SAFETY_MAPPING_CONFLICT/);
});

test('legacy climate writes retain dual setpoint ordering and require a confirmed readable counterpart', async () => {
    const config = controls('airCondition', [both('SET_HEATING'), both('SET_COOLING')]);
    for (const [key, badValue, goodValue, counterpart] of [['SET_HEATING', 25, 20, 'SET_COOLING'], ['SET_COOLING', 17, 23, 'SET_HEATING']]) {
        const dev = device({ climate: { setpointId: `test.0.${key}` }, deviceControls: config }, {}, 'rtr');
        const h = fixture(dev, { 'test.0.SET_HEATING': { value: 18, common: { min: 5, max: 35 } },
            'test.0.SET_COOLING': { value: 24, common: { min: 5, max: 35 } } });
        await assert.rejects(executeLegacyDeviceWrite(dev, `test.0.${key}`, badValue, h.host), code('EOS_CONTROL_CLIMATE_ORDER'));
        h.states.get(`test.0.${counterpart}`).ack = false;
        await assert.rejects(executeLegacyDeviceWrite(dev, `test.0.${key}`, goodValue, h.host), code('EOS_CONTROL_CLIMATE_UNKNOWN'));
        h.states.get(`test.0.${counterpart}`).ack = true;
        await executeLegacyDeviceWrite(dev, `test.0.${key}`, goodValue, h.host);
        assert.deepEqual(h.writes, [[`test.0.${key}`, goodValue]]);
    }
});

test('explicit EOS extras such as TTS survive normalization and remain typed, bounded, secret-safe metadata writes', async () => {
    const dev = device({ player: { ttsId: 'test.0.say' }, deviceControls: controls('media', []) }, {}, 'player');
    assert.equal(dev.io.player.ttsWriteId, 'test.0.say');
    const h = fixture(dev, { 'test.0.say': { value: '', common: { role: 'text' } } });
    await executeLegacyDeviceWrite(dev, 'test.0.say', 'Die Haustür ist geschlossen.', h.host);
    for (const value of [42, null, 'x'.repeat(8193)]) await assert.rejects(executeLegacyDeviceWrite(dev, 'test.0.say', value, h.host), code('EOS_CONTROL_VALUE_INVALID'));
    h.objects.get('test.0.say').common.write = false;
    await assert.rejects(executeLegacyDeviceWrite(dev, 'test.0.say', 'Hallo', h.host), code('EOS_CONTROL_NOT_WRITABLE'));
    h.objects.get('test.0.say').common.write = true;
    h.objects.get('test.0.say').common.role = 'text.password';
    await assert.rejects(executeLegacyDeviceWrite(dev, 'test.0.say', 'Hallo', h.host), code('EOS_CONTROL_ID_FORBIDDEN'));
    assert.deepEqual(h.writes, [['test.0.say', 'Die Haustür ist geschlossen.']]);
});

test('alias legacy writes preserve the alias target but validate every physical hop', async () => {
    const dev = device({ switch: { writeId: 'alias.0.light' }, deviceControls: controls('light', [both('SET', 'alias.0.light')]) });
    const h = fixture(dev, { 'alias.0.light': { value: false, common: { alias: { id: 'physical.0.light', write: 'val ? 1 : 0' } } },
        'physical.0.light': { value: 0, common: { type: 'number' } } });
    await executeLegacyDeviceWrite(dev, 'alias.0.light', true, h.host);
    assert.deepEqual(h.writes, [['alias.0.light', true]]);
    h.objects.get('physical.0.light').common.write = false;
    await assert.rejects(executeLegacyDeviceWrite(dev, 'alias.0.light', true, h.host), code('EOS_CONTROL_NOT_WRITABLE'));
    h.objects.get('physical.0.light').common.write = true;
    h.objects.get('physical.0.light').common.role = 'text.authentication';
    await assert.rejects(executeLegacyDeviceWrite(dev, 'alias.0.light', true, h.host), code('EOS_CONTROL_ID_FORBIDDEN'));
    assert.equal(h.writes.length, 1);
});

test('configuration edits/removal and authorization loss during metadata reads prevent the final legacy write', async () => {
    for (const change of ['mapping', 'behavior', 'removed', 'authorization']) {
        const dev = device({ switch: { writeId: 'test.0.SET' }, deviceControls: controls('light', [both('SET')]) });
        const h = fixture(dev, { 'test.0.SET': { value: false } });
        const originalRead = h.host.readObject;
        h.host.readObject = async id => {
            const object = await originalRead(id);
            if (change === 'mapping') h.current.device.io.switch.writeId = 'test.0.other';
            if (change === 'behavior') h.current.device.behavior.readOnly = true;
            if (change === 'removed') h.current.device = null;
            if (change === 'authorization') h.current.authorized = false;
            return object;
        };
        await assert.rejects(executeLegacyDeviceWrite(dev, 'test.0.SET', true, h.host),
            code(change === 'authorization' ? 'EOS_CONTROL_FORBIDDEN' : 'EOS_CONTROL_CONFIG_CHANGED'));
        assert.deepEqual(h.writes, []);
    }
});

test('initial stale configuration, absent authorization, ambiguous maps and unprofiled writes fail before device IO', async () => {
    const dev = device({ switch: { writeId: 'test.0.SET' }, deviceControls: controls('light', [both('SET')]) });
    const h = fixture(dev, { 'test.0.SET': { value: false } });
    h.current.device = { ...dev, behavior: { ...dev.behavior, readOnly: true } };
    await assert.rejects(executeLegacyDeviceWrite(dev, 'test.0.SET', true, h.host), code('EOS_CONTROL_CONFIG_CHANGED'));
    h.current.device = dev; h.current.authorized = false;
    await assert.rejects(executeLegacyDeviceWrite(dev, 'test.0.SET', true, h.host), code('EOS_CONTROL_FORBIDDEN'));
    h.current.authorized = true;
    const ambiguous = device({ switch: { writeId: 'test.0.SET' }, deviceControls: controls('universal', [both('ONE', 'test.0.SET'), both('TWO', 'test.0.SET')]) });
    h.current.device = ambiguous;
    await assert.rejects(executeLegacyDeviceWrite(ambiguous, 'test.0.SET', true, h.host), code('EOS_CONTROL_MAPPING_AMBIGUOUS'));
    await assert.rejects(executeLegacyDeviceWrite(device({ switch: { writeId: 'test.0.SET' } }), 'test.0.SET', true, h.host), code('EOS_CONTROL_CONFIG_MISSING'));
    assert.deepEqual(h.reads, []); assert.deepEqual(h.writes, []);
});

test('mapped momentary actions accept true only and never add a false/reset write', async () => {
    const dev = device({ switch: { writeId: 'test.0.PRESS' }, deviceControls: controls('button', [{ key: 'SET', writeId: 'test.0.PRESS' }]) }, { commandMode: 'momentary' });
    const h = fixture(dev, { 'test.0.PRESS': { value: false, common: { role: 'button.press' } } });
    for (const value of [false, 0, 1, 'true']) await assert.rejects(executeLegacyDeviceWrite(dev, 'test.0.PRESS', value, h.host), code('EOS_CONTROL_VALUE_INVALID'));
    await executeLegacyDeviceWrite(dev, 'test.0.PRESS', true, h.host);
    assert.deepEqual(h.writes, [['test.0.PRESS', true]]);
});

test('main integration preserves unprofiled behavior and forwards profiled scenes to the shared boundary', async () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../src-ts/runtime-executables/main.ts'), 'utf8');
    const start = source.indexOf('  async _nwWriteProfiledSmartHomeState(');
    const end = source.indexOf('  async _nwPulseSmartHomeSceneDatapoint(', start);
    assert.ok(start > 0 && end > start);
    const Adapter = vm.runInThisContext('(function(executeLegacyDeviceWrite, centralLicenseSnapshot, smartHomeEnabled) { return class {' + source.slice(start, end) + '}; })')(
        executeLegacyDeviceWrite, () => ({ ok: true }), () => true);
    const adapter = new Adapter(); const writes = [];
    adapter.setForeignStateAsync = async (id, value, ack) => { writes.push([id, value, ack]); };
    adapter._bridge = { canWrite: () => true };
    adapter._nwHasCentralLicenseGrant = () => true;
    adapter._nwShuttingDown = false;
    await adapter._nwWriteProfiledSmartHomeState({ id: 'old', io: {} }, 'test.0.old', 10);
    assert.deepEqual(writes, [['test.0.old', 10, false]]);
    const dev = device({ switch: { writeId: 'test.0.SET' }, deviceControls: controls('light', [both('SET')]) });
    adapter.smartHomeDevices = [dev];
    adapter.getForeignObjectAsync = async () => ({ type: 'state', common: { type: 'boolean', read: true, write: false } });
    adapter.getForeignStateAsync = async () => ({ val: false, ack: true, ts: Date.now() });
    await assert.rejects(adapter._nwWriteSmartHomeSceneState('test.0.SET', true, dev), code('EOS_CONTROL_NOT_WRITABLE'));
    assert.equal(writes.length, 1);
    adapter.getForeignObjectAsync = async () => ({ type: 'state', common: { type: 'boolean', read: true, write: true } });
    await adapter._nwWriteSmartHomeSceneState('test.0.SET', true, dev);
    assert.deepEqual(writes[1], ['test.0.SET', true, false]);
    await assert.rejects(adapter._nwWriteProfiledSmartHomeState(dev, 'test.0.SET', true, async () => false), code('EOS_CONTROL_FORBIDDEN'));
    assert.equal(writes.length, 2);
});
