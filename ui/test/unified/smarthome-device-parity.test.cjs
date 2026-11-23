/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const cache = new Map();
function load(name) {
    if (cache.has(name)) return cache.get(name).exports;
    const file = path.resolve(__dirname, `../../lib/${name}.js`);
    const mod = new Module(file, module); mod.filename = file; mod.paths = Module._nodeModulePaths(path.dirname(file)); cache.set(name, mod);
    const native = mod.require.bind(mod);
    mod.require = id => id.startsWith('./smarthome-') ? load(id.slice(2)) : native(id);
    mod._compile(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,
        `../../src-ts/runtime-executables/lib/${name}.ts`), 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText, file);
    return mod.exports;
}
const controls = load('smarthome-device-controls');
const parity = JSON.parse(fs.readFileSync(path.resolve(__dirname,
    '../../../docs/reports/unified-9.0.10/DEVICE_FUNCTION_PARITY.json'), 'utf8'));

// Independent widget inventory, NOT generated from ChannelDetector or the EOS catalog.
const PRIMARY = {
    socket: ['ACTUAL', false], light: ['ON_ACTUAL', false], dimmer: ['ACTUAL', 0], temperature: ['ACTUAL', 0],
    motion: ['ACTUAL', false], window: ['ACTUAL', false], windowTilt: ['ACTUAL', 0], gate: ['ACTUAL', 0],
    blind: ['ACTUAL', 0], blindButtons: ['TILT_ACTUAL', 0], button: ['SET', true], buttonSensor: ['PRESS', false],
    camera: ['URL', 'https://camera.invalid/image.jpg'], vacuumCleaner: ['STATE', 0], contact: ['ACTUAL', false],
    coAlarm: ['ACTUAL', false], pressure: ['PRESSURE', 0], flow: ['FLOW', 0], electricity: ['ELECTRIC_POWER', 0],
    airQuality: ['AQI', 0], lock: ['ACTUAL', false], door: ['ACTUAL', false], floodAlarm: ['ACTUAL', false],
    fireAlarm: ['ACTUAL', false], humidity: ['ACTUAL', 0], illuminance: ['ACTUAL', 0], thermostat: ['ACTUAL', 0],
    airCondition: ['ACTUAL', 0], fan: ['POWER', false], airPurifier: ['POWER', false], pump: ['FLOW', 0],
    warning: ['TITLE', 'Warnung'], volume: ['ACTUAL', 0], volumeGroup: ['ACTUAL', 0], media: ['STATE', false],
    tv: ['POWER', false], fillLevel: ['ACTUAL', 0], slider: ['ACTUAL', 0], percentage: ['ACTUAL', 0],
    info: ['ACTUAL', '0'], image: ['URL', 'https://image.invalid/zero.png'], location: ['LATITUDE', 0],
    locationOne: ['GPS', '0;0'], weatherCurrent: ['ACTUAL', 0], weatherForecast: ['TEMP', 0],
    rgbSingle: ['RGB', '#000000'], rgbwSingle: ['RGBW', '#00000000'], rgb: ['RED', 0], hue: ['HUE', 0],
    cie: ['CIE', '0,0'], ct: ['TEMPERATURE', 2000],
};
function host(value, common = {}) {
    let state = { val: value, q: 0, ts: Date.now(), ack: true }; const writes = [];
    return {
        writes, setState: next => { state = next; },
        readObject: async () => ({ type: 'state', common: { type: typeof value, read: true, write: true, ...common } }),
        readState: async () => state,
        writeState: async (id, next) => { writes.push({ id, value: next }); },
    };
}
function profileField(profile, key) {
    return profile.fields.find(field => field.key === key)
        || profile.fields.find(field => field.key.endsWith('%d') && key.startsWith(field.key.slice(0, -2))
            && /^\d{1,3}$/.test(key.slice(field.key.length - 2)));
}
function commandValue(profile, key) {
    if (key === 'RGB') return '#123456';
    if (key === 'RGBW') return '#12345678';
    if (key === 'CIE') return '0.3,0.4';
    if (key === 'APP') return 'YOUTUBE';
    if (key === 'INPUT') return 'HDMI1';
    if (key === 'KEY') return 'UP';
    if (key === 'SET' && ['socket', 'light', 'gate', 'button', 'lock'].includes(profile)) return true;
    if (profile === 'camera' && key !== 'PTZ') return true;
    if (['OPEN', 'CLOSE', 'STOP', 'TILT_OPEN', 'TILT_CLOSE', 'TILT_STOP', 'ON_SET', 'ON', 'POWER', 'BOOST',
        'PARTY', 'PAUSE', 'HOME', 'ART_MODE', 'MUTE', 'VOLUME_UP', 'VOLUME_DOWN', 'PLAY', 'NEXT', 'PREV', 'STATE'].includes(key)) return true;
    return 1;
}

test('every independent reference category and read/write slot is available, including manual fallbacks and numbered forecast fields', () => {
    assert.equal(parity.deviceTypes.length, 51);
    assert.deepEqual(Object.keys(PRIMARY).sort(), parity.deviceTypes.map(item => item.type).sort());
    const catalog = controls.getControlProfiles();
    for (const item of parity.deviceTypes) {
        const profile = catalog.find(candidate => candidate.id === item.type); assert.ok(profile, item.type);
        for (const key of item.readSlots.flatMap(slot => slot.split('/'))) {
            assert.equal(profileField(profile, key)?.read, true, `${item.type}.${key} read`);
            assert.ok(controls.normalizeDeviceControls({ profile: item.type, fields: [{ key, readId: 'fixture.0.state' }] }));
        }
        for (const key of item.writeSlots.flatMap(slot => slot.slot.split('/'))) {
            assert.equal(profileField(profile, key)?.write, true, `${item.type}.${key} write`);
            assert.ok(controls.normalizeDeviceControls({ profile: item.type, fields: [{ key, writeId: 'fixture.0.state' }] }));
        }
    }
    for (const profile of ['rgb', 'rgbSingle', 'rgbwSingle', 'hue', 'cie', 'ct']) {
        assert.equal(profileField(catalog.find(item => item.id === profile), 'SET').manualOnly, true);
        assert.equal(profileField(catalog.find(item => item.id === profile), 'ON_SET').manualOnly, true);
    }
    assert.equal(profileField(catalog.find(item => item.id === 'media'), 'STATE').manualWriteOnly, true);
    assert.equal(profileField(catalog.find(item => item.id === 'media'), 'SET').write, true);
});

for (const [profile, [key, value]] of Object.entries(PRIMARY)) {
    test(`${profile}: genuine zero/false values survive while missing values and nonzero quality never become confirmed data`, async () => {
        const adapter = host(value);
        if (profile === 'button') {
            const config = { profile, fields: [{ key, writeId: 'fixture.0.action' }] };
            await controls.executeDeviceControl(config, { key, value: true }, adapter);
            assert.deepEqual(adapter.writes, [{ id: 'fixture.0.action', value: true }]);
            assert.equal((await controls.buildDeviceControls(config, adapter)).fields[0].valid, false);
            return;
        }
        const config = { profile, fields: [{ key, readId: 'fixture.0.state' }] };
        const current = (await controls.buildDeviceControls(config, adapter)).fields[0];
        assert.equal(current.valid, true); assert.equal(current.value, value);
        for (const bad of [null, {}, { val: null }, { val: value, q: 1 }, { val: value, q: 0x40 }]) {
            adapter.setState(bad);
            const result = (await controls.buildDeviceControls(config, adapter)).fields[0];
            assert.equal(result.valid, false); assert.equal(result.value, null);
        }
        assert.deepEqual(adapter.writes, []);
    });
}

test('every independently inventoried write slot accepts its correctly typed authorized command exactly once and rejects missing write authority', async () => {
    let checked = 0;
    for (const item of parity.deviceTypes) for (const key of item.writeSlots.flatMap(slot => slot.slot.split('/'))) {
        const value = commandValue(item.type, key);
        const adapter = host(value, key === 'EFFECT' ? { states: { 1: 'Effekt 1' } } : {});
        const config = { profile: item.type, fields: [{ key, writeId: 'fixture.0.action' }] };
        await controls.executeDeviceControl(config, { key, value, confirmed: true }, adapter);
        assert.deepEqual(adapter.writes, [{ id: 'fixture.0.action', value }], `${item.type}.${key}`);
        const noWrite = { ...adapter, readObject: async () => ({ type: 'state', common: { type: typeof value, read: true, write: false } }) };
        await assert.rejects(controls.executeDeviceControl(config, { key, value, confirmed: true }, noWrite));
        assert.equal(adapter.writes.length, 1, `${item.type}.${key} denied second write`); checked++;
    }
    assert.ok(checked > 130, String(checked));
});

test('manual media state/volume and percentage/color power retain explicit type semantics instead of guessed boolean/numeric coercion', async () => {
    for (const [profile, key, value] of [['media', 'STATE', false], ['media', 'SET', 33], ['percentage', 'ON', false],
        ['rgb', 'SET', 127], ['rgbSingle', 'ON_SET', false]]) {
        const adapter = host(value, typeof value === 'number' ? { min: 0, max: 255 } : {});
        const config = { profile, fields: [{ key, writeId: 'fixture.0.manual' }] };
        await controls.executeDeviceControl(config, { key, value }, adapter);
        await assert.rejects(controls.executeDeviceControl(config, { key, value: typeof value === 'boolean' ? 0 : '33' }, adapter));
        assert.deepEqual(adapter.writes, [{ id: 'fixture.0.manual', value }]);
    }
});
