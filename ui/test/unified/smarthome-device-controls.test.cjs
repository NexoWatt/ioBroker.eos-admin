/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { ChannelDetector } = require('@iobroker/type-detector');
// The regression executes the maintained strict source, never a stale generated mirror.
const filename = path.resolve(__dirname, '../../lib/smarthome-device-controls.js');
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
const customFilename = path.resolve(__dirname, '../../lib/smarthome-custom-contract.js');
const customLoaded = new Module(customFilename, module);
customLoaded.filename = customFilename;
customLoaded.paths = loaded.paths;
customLoaded._compile(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,
    '../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, customFilename);
const originalRequire = loaded.require.bind(loaded);
loaded.require = id => id === './smarthome-custom-contract' ? customLoaded.exports : originalRequire(id);
loaded._compile(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,
    '../../src-ts/runtime-executables/lib/smarthome-device-controls.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, filename);
const { getControlProfiles, normalizeDeviceControls, buildDeviceControls, executeDeviceControl,
    executeDeviceControlBatch, validateDeviceControlRead } = loaded.exports;

function fixture(entries = {}) {
    const objects = new Map(); const states = new Map(); const writes = []; const reads = [];
    for (const [id, entry] of Object.entries(entries)) {
        objects.set(id, { type: 'state', common: { read: true, write: true, type: typeof entry.value, ...entry.common } });
        states.set(id, { val: entry.value, q: 0, ack: true, ts: Date.now() - 100, lc: Date.now() - 200, ...entry.state });
    }
    const host = {
        async readObject(id) { reads.push(['object', id]); return objects.get(id); },
        async readState(id) { reads.push(['state', id]); return states.get(id); },
        async writeState(id, value) { writes.push([id, value]); },
    };
    return { host, objects, states, writes, reads };
}
function mapping(profile, fields) { return { profile, fields }; }
function both(key, id = `test.0.${key}`) { return { key, readId: id, writeId: id }; }
function code(expected) { return error => error && error.code === expected; }
async function settle() { for (let index = 0; index < 24; index++) await Promise.resolve(); }

test('catalog covers every TypeDetector6.2 external profile and every field including indicators; copies do not mutate authority', () => {
    const catalog = getControlProfiles();
    const patterns = Object.values(ChannelDetector.getPatterns());
    assert.equal(patterns.length, 52);
    assert.equal(catalog.length, 63);
    for (const profile of catalog.filter(profile => profile.id.startsWith('custom_'))) {
        for (const field of profile.fields) if (field.write) {
            assert.equal(profile.id, 'custom_universal'); assert.equal(field.key, 'ACTION');
        }
    }
    for (const pattern of patterns) {
        const profile = catalog.find(candidate => candidate.id === pattern.type);
        assert.ok(profile, pattern.type);
        assert.equal(new Set(profile.fields.map(field => field.key)).size, profile.fields.length);
        for (const state of pattern.states) {
            const field = profile.fields.find(candidate => candidate.key === state.name);
            assert.ok(field, `${pattern.type}.${state.name}`);
            const expected = state.type === undefined ? ['boolean', 'number', 'string']
                : Array.isArray(state.type) ? state.type : [state.type];
            for (const type of expected) assert.ok(field.types.includes(type));
            if (state.indicator === true) { assert.equal(field.indicator, true); assert.equal(field.write, false); }
            if (state.read === false) assert.equal(field.read, false);
        }
    }
    assert.ok(catalog.find(profile => profile.id === 'media'));
    assert.ok(!catalog.find(profile => profile.id === 'mediaPlayer'));
    catalog.find(profile => profile.id === 'gate').fields.find(field => field.key === 'SET').types.push('number');
    assert.deepEqual(getControlProfiles().find(profile => profile.id === 'gate').fields.find(field => field.key === 'SET').types, ['boolean']);
});

test('all catalog field scalar types can be read without converting null, strings, or numeric enums', async () => {
    let cases = 0;
    for (const profile of getControlProfiles()) for (const field of profile.fields) {
        if (!field.read) continue;
        for (const type of field.types) {
            const value = type === 'number' ? 0 : type === 'boolean' ? false : 'Wert';
            const id = 'test.0.value'; const h = fixture({ [id]: { value, common: { type, write: false } } });
            const dto = await buildDeviceControls(mapping(profile.id, [{ key: field.key, readId: id }]), h.host);
            assert.equal(dto.fields[0].type, type, `${profile.id}.${field.key}`);
            assert.equal(dto.fields[0].value, value); assert.equal(dto.fields[0].valid, true);
            assert.equal(dto.fields[0].writable, false); cases++;
        }
    }
    assert.ok(cases > 900, String(cases));
});

test('normalization retains exact maps, expands registered weather slots and rejects unknown keys/IDs/prototypes/overlimits', () => {
    assert.equal(normalizeDeviceControls(undefined), null);
    assert.deepEqual(normalizeDeviceControls(mapping('gate', [both('SET')])), mapping('gate', [both('SET')]));
    assert.ok(normalizeDeviceControls(mapping('weatherForecast', [{ key: 'TEMP_MIN12', readId: 'weather.0.forecast.12' }])));
    assert.ok(normalizeDeviceControls(mapping('universal', [both('CUSTOM_VALUE', 'eos-admin.0.devices.custom.value')])));
    for (const profile of ['nonsense', '__proto__', 'constructor']) assert.throws(() => normalizeDeviceControls(mapping(profile, [])));
    for (const key of ['set', 'UNKNOWN', 'TEMP_MIN1000', '__proto__']) assert.throws(() => normalizeDeviceControls(mapping('light', [{ key }])));
    for (const id of ['system.adapter.admin.0', 'admin.0.foo', 'test.0.*', 'test.0.password', ' test.0.x', 'test.0.\ncmd']) {
        assert.throws(() => normalizeDeviceControls(mapping('light', [both('SET', id)])), code('EOS_CONTROL_ID_FORBIDDEN'));
    }
    assert.throws(() => normalizeDeviceControls(mapping('light', [both('SET'), both('SET')])));
    assert.throws(() => normalizeDeviceControls(mapping('universal', Array.from({ length: 129 }, (_, n) => both(`VALUE_${n}`)))));
    assert.throws(() => normalizeDeviceControls(mapping('temperature', [{ key: 'ACTUAL', writeId: 'test.0.temperature' }])), code('EOS_CONTROL_CAPABILITY_INVALID'));
    assert.throws(() => normalizeDeviceControls(Object.create({ profile: 'light', fields: [] })));
});

test('writes require persisted write mapping and actual state permissions/type; client IDs and dangerous object roles never gain authority', async () => {
    const h = fixture({ 'test.0.SET': { value: false } });
    const config = mapping('light', [both('SET')]);
    await executeDeviceControl(config, { key: 'SET', value: true }, h.host);
    assert.deepEqual(h.writes, [['test.0.SET', true]]);
    for (const request of [{ key: 'SET', value: 1 }, { key: 'SET', value: 'true' }, { key: 'SET', value: null },
        { key: 'SET', value: true, writeId: 'other.0.state' }, { key: 'ON_ACTUAL', value: true }]) {
        await assert.rejects(executeDeviceControl(config, request, h.host));
    }
    await assert.rejects(executeDeviceControl(mapping('light', [{ key: 'SET', readId: 'test.0.SET' }]), { key: 'SET', value: true }, h.host), code('EOS_CONTROL_NOT_WRITABLE'));
    h.objects.get('test.0.SET').common.write = false;
    await assert.rejects(executeDeviceControl(config, { key: 'SET', value: true }, h.host), code('EOS_CONTROL_NOT_WRITABLE'));
    h.objects.get('test.0.SET').common.write = true;
    for (const role of ['text.password', 'text.secret', 'text.credentials', 'text.authentication', 'text.privateKey']) {
        h.objects.get('test.0.SET').common.role = role;
        await assert.rejects(executeDeviceControl(config, { key: 'SET', value: true }, h.host), code('EOS_CONTROL_ID_FORBIDDEN'));
        assert.equal((await buildDeviceControls(config, h.host)).fields[0].value, null);
    }
    delete h.objects.get('test.0.SET').common.role;
    await assert.rejects(executeDeviceControl(config, { key: 'SET', value: true }, h.host, true), code('EOS_CONTROL_READ_ONLY'));
    assert.equal(h.writes.length, 1);
});

test('numeric bounds, steps and actual typed enums are validated; catalog enum defaults do not override device-specific actual values', async () => {
    const h = fixture({ 'test.0.SET': { value: 21, common: { min: 5, max: 30, step: 0.5 } },
        'test.0.MODE': { value: 2, common: { states: { 2: 'Eco', 7: 'Komfort' } } } });
    const config = mapping('thermostat', [both('SET'), both('MODE')]);
    await executeDeviceControl(config, { key: 'SET', value: 21.5 }, h.host);
    await executeDeviceControl(config, { key: 'MODE', value: 7 }, h.host);
    for (const value of [NaN, Infinity, -Infinity, 4.5, 30.5, 21.3, '21.5']) {
        await assert.rejects(executeDeviceControl(config, { key: 'SET', value }, h.host), code('EOS_CONTROL_VALUE_INVALID'));
    }
    for (const value of [1, '7', null]) await assert.rejects(executeDeviceControl(config, { key: 'MODE', value }, h.host), code('EOS_CONTROL_VALUE_INVALID'));
    delete h.objects.get('test.0.MODE').common.states;
    await executeDeviceControl(config, { key: 'MODE', value: 12 }, h.host);
    assert.deepEqual(h.writes, [['test.0.SET', 21.5], ['test.0.MODE', 7], ['test.0.MODE', 12]]);
    h.objects.get('test.0.SET').common.min = 100;
    await assert.rejects(executeDeviceControl(config, { key: 'SET', value: 21 }, h.host), code('EOS_CONTROL_BOUNDS_INVALID'));
});

test('unknown and bad-quality readings remain invalid without blocking explicit writes; state timestamps and acknowledgements are exposed honestly', async () => {
    const h = fixture({ 'test.0.SET': { value: false } }); const config = mapping('light', [both('SET')]);
    for (const state of [null, {}, { val: null }, { val: 'false' }, { val: false, q: 0x40 }]) {
        h.states.set('test.0.SET', state);
        const field = (await buildDeviceControls(config, h.host)).fields[0];
        assert.equal(field.valid, false); assert.equal(field.value, null); assert.equal(field.writable, true);
    }
    h.states.set('test.0.SET', { val: false, q: 0, ack: false, ts: Date.now() - 100, lc: Date.now() - 200 });
    const field = (await buildDeviceControls(config, h.host)).fields[0];
    assert.equal(field.value, false); assert.equal(field.ack, false); assert.ok(field.age >= 100); assert.ok(field.lc < field.ts);
    await executeDeviceControl(config, { key: 'SET', value: true }, h.host);
    assert.equal(h.writes.length, 1);
});

test('locks require deliberate unlock/open confirmation and gate SET remains boolean; momentary STOP only accepts true', async () => {
    const h = fixture({ 'test.0.SET': { value: true }, 'test.0.OPEN': { value: false }, 'test.0.STOP': { value: false } });
    const lock = mapping('lock', [both('SET'), { key: 'OPEN', writeId: 'test.0.OPEN' }]);
    await executeDeviceControl(lock, { key: 'SET', value: true }, h.host);
    await assert.rejects(executeDeviceControl(lock, { key: 'SET', value: false }, h.host), code('EOS_CONTROL_CONFIRM_REQUIRED'));
    await assert.rejects(executeDeviceControl(lock, { key: 'OPEN', value: true }, h.host), code('EOS_CONTROL_CONFIRM_REQUIRED'));
    await executeDeviceControl(lock, { key: 'OPEN', value: true, confirmed: true }, h.host);
    await executeDeviceControl(lock, { key: 'SET', value: false, confirmed: true }, h.host);
    const gate = mapping('gate', [both('SET'), both('STOP')]);
    await assert.rejects(executeDeviceControl(gate, { key: 'SET', value: 100 }, h.host), code('EOS_CONTROL_VALUE_INVALID'));
    await executeDeviceControl(gate, { key: 'SET', value: false }, h.host);
    await assert.rejects(executeDeviceControl(gate, { key: 'STOP', value: false }, h.host), code('EOS_CONTROL_VALUE_INVALID'));
    await executeDeviceControl(gate, { key: 'STOP', value: true }, h.host);
    assert.equal(h.writes.length, 5);
});

test('mapped cover protections block uncertain or active movement but independent STOP bypasses movement interlocks', async () => {
    const h = fixture({ 'test.0.SET': { value: 0, common: { min: 0, max: 100 } },
        'test.0.STOP': { value: false }, 'test.0.WIND_ALARM': { value: true } });
    const config = mapping('blind', [both('SET'), both('STOP'), { key: 'WIND_ALARM', readId: 'test.0.WIND_ALARM' }]);
    for (const state of [{ val: true }, { val: null }, { val: false, q: 1 }]) {
        h.states.set('test.0.WIND_ALARM', state);
        const dto = await buildDeviceControls(config, h.host);
        assert.equal(dto.fields.find(field => field.key === 'SET').writable, false);
        assert.equal(dto.fields.find(field => field.key === 'STOP').writable, true);
        await assert.rejects(executeDeviceControl(config, { key: 'SET', value: 100 }, h.host));
        await executeDeviceControl(config, { key: 'STOP', value: true }, h.host);
    }
    h.states.set('test.0.WIND_ALARM', { val: false, ts: Date.now() });
    await executeDeviceControl(config, { key: 'SET', value: 100 }, h.host);
    const pending = [];
    h.host.writeState = (id, value) => { h.writes.push([id, value]); return new Promise(resolve => pending.push(resolve)); };
    const first = executeDeviceControl(config, { key: 'SET', value: 20 }, h.host); await settle();
    const stop = executeDeviceControl(config, { key: 'STOP', value: true }, h.host); await settle();
    assert.equal(pending.length, 2); pending.forEach(resolve => resolve()); await Promise.all([first, stop]);
});

test('read snapshots share ID caches and cap host concurrency at eight for128 mapped fields', async () => {
    const h = fixture(); let active = 0; let maximum = 0; let calls = 0;
    const read = async (object) => { calls++; active++; maximum = Math.max(active, maximum);
        await new Promise(resolve => setImmediate(resolve)); active--;
        return object ? { type: 'state', common: { type: 'number', read: true, write: true } } : { val: 42, q: 0 }; };
    h.host.readObject = () => read(true); h.host.readState = () => read(false);
    const config = mapping('universal', Array.from({ length: 128 }, (_, n) => both(`VALUE_${n}`, `test.0.value${n}`)));
    const dto = await buildDeviceControls(config, h.host);
    assert.equal(dto.fields.length, 128); assert.equal(calls, 256); assert.ok(maximum <= 8, String(maximum));
    calls = 0;
    await buildDeviceControls(mapping('universal', Array.from({ length: 128 }, (_, n) => both(`VALUE_${n}`, 'test.0.shared'))), h.host);
    assert.equal(calls, 2);
});

test('five-second read deadline never produces late writes; write timeout is uncertain with no retry', async t => {
    t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 10000 });
    const h = fixture({ 'test.0.SET': { value: false } }); const config = mapping('light', [both('SET')]);
    let resolveObject;
    h.host.readObject = () => new Promise(resolve => { resolveObject = resolve; });
    const expired = executeDeviceControl(config, { key: 'SET', value: true }, h.host);
    const observed = assert.rejects(expired, code('EOS_CONTROL_TIMEOUT'));
    await settle(); t.mock.timers.tick(5001); await observed;
    resolveObject(h.objects.get('test.0.SET')); await settle(); assert.equal(h.writes.length, 0);
    h.host.readObject = async id => h.objects.get(id);
    let resolveWrite;
    h.host.writeState = (id, value) => { h.writes.push([id, value]); return new Promise(resolve => { resolveWrite = resolve; }); };
    const uncertain = executeDeviceControl(config, { key: 'SET', value: true }, h.host);
    const uncertainObserved = assert.rejects(uncertain, code('EOS_CONTROL_WRITE_UNCERTAIN'));
    await settle(); t.mock.timers.tick(5001); await uncertainObserved;
    resolveWrite(); await settle(); assert.equal(h.writes.length, 1);
});

test('catalog enums support string/boolean/numeric options without coercion and malformed metadata fails closed', async () => {
    const h = fixture({ 'test.0.INPUT': { value: 'HDMI', common: { states: { HDMI: 'HDMI', TV: 'Fernsehen' } } } });
    const config = mapping('tv', [both('INPUT')]);
    await executeDeviceControl(config, { key: 'INPUT', value: 'TV' }, h.host);
    await assert.rejects(executeDeviceControl(config, { key: 'INPUT', value: 'HDMI1' }, h.host), code('EOS_CONTROL_VALUE_INVALID'));
    h.objects.get('test.0.INPUT').common.states = 'not-an-enum';
    await assert.rejects(executeDeviceControl(config, { key: 'INPUT', value: 'TV' }, h.host), code('EOS_CONTROL_ENUM_INVALID'));
    h.objects.get('test.0.INPUT').common.states = { HDMI: { invalid: true } };
    assert.equal((await buildDeviceControls(config, h.host)).fields[0].writable, false);
});

test('legacy ioBroker enum strings and arrays retain exact option types; boolean momentary alias controls cannot write false', async () => {
    const h = fixture({ 'test.0.VALUE': { value: 0, common: { states: '0:Aus;1:Ein;2:Automatik' } },
        'test.0.ACTION': { value: false, common: { role: 'button.press', alias: { id: 'physical.0.command' } } },
        'physical.0.command': { value: false } });
    const config = mapping('universal', [both('VALUE'), both('ACTION')]);
    assert.deepEqual((await buildDeviceControls(config, h.host)).fields[0].options,
        [{ value: 0, label: 'Aus' }, { value: 1, label: 'Ein' }, { value: 2, label: 'Automatik' }]);
    await executeDeviceControl(config, { key: 'VALUE', value: 2 }, h.host);
    await assert.rejects(executeDeviceControl(config, { key: 'VALUE', value: '2' }, h.host));
    h.objects.get('test.0.VALUE').common.states = ['Aus', 'Ein'];
    await executeDeviceControl(config, { key: 'VALUE', value: 1 }, h.host);
    h.objects.get('test.0.VALUE').common.states = '{"3":"Spezial"}';
    await executeDeviceControl(config, { key: 'VALUE', value: 3 }, h.host);
    const action = (await buildDeviceControls(config, h.host)).fields[1];
    assert.equal(action.commandValue, true); assert.equal(action.kind, 'button');
    await assert.rejects(executeDeviceControl(config, { key: 'ACTION', value: false }, h.host));
    await executeDeviceControl(config, { key: 'ACTION', value: true }, h.host);
    h.objects.get('test.0.ACTION').common.alias.id = 'system.adapter.admin.0.alive';
    await assert.rejects(executeDeviceControl(config, { key: 'ACTION', value: true }, h.host), code('EOS_CONTROL_ID_FORBIDDEN'));
});

test('dual climate setpoints enforce heat<=cool, reject unknown counterpart and refuse concurrent rather than queued mutations', async () => {
    const h = fixture({ 'test.0.SET_HEATING': { value: 18, common: { min: 5, max: 35 } },
        'test.0.SET_COOLING': { value: 24, common: { min: 5, max: 35 } } });
    const config = mapping('airCondition', [both('SET_HEATING'), both('SET_COOLING')]);
    await assert.rejects(executeDeviceControl(config, { key: 'SET_HEATING', value: 25 }, h.host), code('EOS_CONTROL_CLIMATE_ORDER'));
    await assert.rejects(executeDeviceControl(config, { key: 'SET_COOLING', value: 17 }, h.host), code('EOS_CONTROL_CLIMATE_ORDER'));
    h.states.get('test.0.SET_COOLING').ack = false;
    await assert.rejects(executeDeviceControl(config, { key: 'SET_HEATING', value: 19 }, h.host), code('EOS_CONTROL_CLIMATE_UNKNOWN'));
    h.states.get('test.0.SET_COOLING').ack = true;
    let complete;
    h.host.writeState = (id, value) => { h.writes.push([id, value]); return new Promise(resolve => { complete = resolve; }); };
    const pending = executeDeviceControl(config, { key: 'SET_HEATING', value: 20 }, h.host); await settle();
    await assert.rejects(executeDeviceControl(config, { key: 'SET_COOLING', value: 19 }, h.host), code('EOS_CONTROL_BUSY'));
    assert.deepEqual(h.writes, [['test.0.SET_HEATING', 20]]); complete(); await pending;
    h.states.get('test.0.SET_HEATING').val = 20;
    await assert.rejects(executeDeviceControl(config, { key: 'SET_COOLING', value: 19 }, h.host), code('EOS_CONTROL_CLIMATE_ORDER'));
});

test('bounded color batch prevalidates all mappings/values, rejects duplicates and noncolor controls, then writes each channel once', async () => {
    const h = fixture(Object.fromEntries(['RED', 'GREEN', 'BLUE'].map(key => [`test.0.${key}`, { value: 0, common: { min: 0, max: 255 } }])));
    const config = mapping('rgb', ['RED', 'GREEN', 'BLUE'].map(key => both(key)));
    await assert.rejects(executeDeviceControlBatch(config, [{ key: 'RED', value: 80 }, { key: 'GREEN', value: 256 }], h.host));
    assert.equal(h.writes.length, 0);
    await assert.rejects(executeDeviceControlBatch(config, [{ key: 'RED', value: 1 }, { key: 'RED', value: 2 }], h.host));
    await assert.rejects(executeDeviceControlBatch(mapping('lock', [both('SET')]), [{ key: 'SET', value: false }], h.host));
    await assert.rejects(executeDeviceControlBatch(config, [{ key: 'ON', value: true }], h.host));
    await assert.rejects(executeDeviceControlBatch(config, Array.from({ length: 5 }, () => ({ key: 'RED', value: 1 })), h.host));
    await executeDeviceControlBatch(config, [{ key: 'RED', value: 12 }, { key: 'GREEN', value: 34 }, { key: 'BLUE', value: 56 }], h.host);
    assert.deepEqual(h.writes, [['test.0.RED', 12], ['test.0.GREEN', 34], ['test.0.BLUE', 56]]);
});

test('color batch stops after a failed channel and never invents retries or rollback writes', async () => {
    const h = fixture(Object.fromEntries(['RED', 'GREEN', 'BLUE'].map(key => [`test.0.${key}`, { value: 0 }])));
    const config = mapping('rgb', ['RED', 'GREEN', 'BLUE'].map(key => both(key)));
    h.host.writeState = async (id, value) => { h.writes.push([id, value]); if (id.endsWith('GREEN')) throw new Error('untrusted error'); };
    await assert.rejects(executeDeviceControlBatch(config, [{ key: 'RED', value: 10 }, { key: 'GREEN', value: 20 }, { key: 'BLUE', value: 30 }], h.host), code('EOS_CONTROL_WRITE_FAILED'));
    assert.deepEqual(h.writes, [['test.0.RED', 10], ['test.0.GREEN', 20]]);
});

test('all alias hops enforce permissions and secrets; cycles/depth fail while controller conversions keep the mapped alias write target', async () => {
    const h = fixture({ 'alias.0.input': { value: false, common: { alias: { id: 'alias.0.middle' } } },
        'alias.0.middle': { value: false, common: { alias: { id: 'physical.0.value', write: 'val ? 1 : 0' } } },
        'physical.0.value': { value: 0 } });
    const config = mapping('light', [both('SET', 'alias.0.input')]);
    await executeDeviceControl(config, { key: 'SET', value: true }, h.host);
    assert.deepEqual(h.writes, [['alias.0.input', true]]);
    assert.deepEqual(await validateDeviceControlRead(config, 'SET', h.host), { id: 'alias.0.input', type: 'boolean' });
    h.objects.get('physical.0.value').common.write = false;
    await assert.rejects(executeDeviceControl(config, { key: 'SET', value: true }, h.host), code('EOS_CONTROL_NOT_WRITABLE'));
    h.objects.get('physical.0.value').common.read = false;
    await assert.rejects(validateDeviceControlRead(config, 'SET', h.host), code('EOS_CONTROL_NOT_READABLE'));
    h.objects.get('physical.0.value').common.role = 'text.secret';
    await assert.rejects(validateDeviceControlRead(config, 'SET', h.host), code('EOS_CONTROL_ID_FORBIDDEN'));
    h.objects.get('alias.0.middle').common.alias.id = 'alias.0.input';
    await assert.rejects(executeDeviceControl(config, { key: 'SET', value: true }, h.host), code('EOS_CONTROL_ALIAS_CYCLE'));
    h.objects.get('alias.0.middle').common.alias.id = 'system.config';
    await assert.rejects(validateDeviceControlRead(config, 'SET', h.host), code('EOS_CONTROL_ID_FORBIDDEN'));
    for (let n = 0; n < 10; n++) h.objects.set(`alias.0.depth${n}`, { type: 'state', common: {
        type: 'boolean', read: true, write: true, ...(n < 9 ? { alias: { id: `alias.0.depth${n + 1}` } } : {}),
    } });
    await assert.rejects(executeDeviceControl(mapping('light', [both('SET', 'alias.0.depth0')]), { key: 'SET', value: true }, h.host), code('EOS_CONTROL_ALIAS_LIMIT'));
    assert.equal(h.writes.length, 1);
});

test('configured stale readings are invalid and cover safety requires fresh timestamp with60s default while STOP remains available', async () => {
    const h = fixture({ 'test.0.SET': { value: 0 }, 'test.0.STOP': { value: false },
        'test.0.WIND_ALARM': { value: false, state: { ts: Date.now() - 61000 } } });
    const config = mapping('blind', [both('SET'), both('STOP'), { key: 'WIND_ALARM', readId: 'test.0.WIND_ALARM' }]);
    assert.equal((await buildDeviceControls(config, h.host)).fields.find(field => field.key === 'SET').writable, false);
    await assert.rejects(executeDeviceControl(config, { key: 'SET', value: 100 }, h.host), code('EOS_CONTROL_SAFETY_UNKNOWN'));
    await executeDeviceControl(config, { key: 'STOP', value: true }, h.host);
    await executeDeviceControl(config, { key: 'SET', value: 100 }, h.host, false, { staleAfterMs: 120000 });
    h.states.get('test.0.SET').ts = Date.now() - 5000;
    const dto = await buildDeviceControls(config, h.host, false, { staleAfterMs: 1000 });
    assert.equal(dto.fields.find(field => field.key === 'SET').valid, false);
    h.states.get('test.0.WIND_ALARM').ts = Date.now() + 60000;
    await assert.rejects(executeDeviceControl(config, { key: 'SET', value: 100 }, h.host), code('EOS_CONTROL_SAFETY_UNKNOWN'));
});

test('normal string values and total serialized snapshot stay bounded with explicit unavailable errors, never silent truncation', async () => {
    const h = fixture({ 'test.0.TEXT': { value: 'x'.repeat(8193) }, 'test.0.MAP_BASE64': { value: 'x'.repeat(500000) } });
    const textDto = await buildDeviceControls(mapping('universal', [{ key: 'TEXT', readId: 'test.0.TEXT' }]), h.host);
    assert.equal(textDto.fields[0].value, null); assert.equal(textDto.fields[0].error, 'EOS_CONTROL_VALUE_LIMIT');
    const mapDto = await buildDeviceControls(mapping('vacuumCleaner', [{ key: 'MAP_BASE64', readId: 'test.0.MAP_BASE64' }]), h.host);
    assert.equal(mapDto.fields[0].value.length, 500000);
    const entries = {};
    for (let n = 0; n < 128; n++) entries[`test.0.${n}`] = { value: 'x'.repeat(8192) };
    const many = fixture(entries);
    const dto = await buildDeviceControls(mapping('universal', Array.from({ length: 128 }, (_, n) => ({ key: `TEXT_${n}`, readId: `test.0.${n}` }))), many.host);
    assert.ok(Buffer.byteLength(JSON.stringify(dto)) < 1048576);
    assert.ok(dto.fields.some(field => field.error === 'EOS_CONTROL_VALUE_LIMIT'));
    for (const field of dto.fields) if (field.valid) assert.equal(field.value.length, 8192);
});

test('legacy numeric and string cover contacts preserve known clear/alarm semantics without coercing unknown data or weakening STOP', async () => {
    for (const [value, allowed] of [[0, true], [1, false], [-1, false], ['off', true], ['ok', true], ['unlocked', true],
        ['on', false], ['alarm', false], ['locked', false], ['unknown', false], ['', false]]) {
        const h = fixture({ 'test.0.SET': { value: 0 }, 'test.0.STOP': { value: false }, 'test.0.LOCKED': { value } });
        const config = mapping('blind', [both('SET'), both('STOP'), { key: 'LOCKED', readId: 'test.0.LOCKED' }]);
        const dto = await buildDeviceControls(config, h.host);
        assert.equal(dto.fields.find(field => field.key === 'LOCKED').value, value);
        assert.equal(dto.fields.find(field => field.key === 'SET').writable, allowed, String(value));
        if (allowed) await executeDeviceControl(config, { key: 'SET', value: 50 }, h.host);
        else await assert.rejects(executeDeviceControl(config, { key: 'SET', value: 50 }, h.host));
        await executeDeviceControl(config, { key: 'STOP', value: true }, h.host);
        h.states.get('test.0.LOCKED').q = 0x40;
        await assert.rejects(executeDeviceControl(config, { key: 'SET', value: 50 }, h.host));
    }
});
