'use strict';
// Execute the actual pure TypeScript contract, not a mirrored implementation.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const loaded = { exports: {} };
vm.runInThisContext('(function(module,exports){' + compiled + '\n})', { filename: 'smarthome-custom-contract.js' })(loaded, loaded.exports);
const { normalizeCustomView: normalize, getCustomControlProfiles: profiles, getCustomViewCatalog: catalog,
    getCustomProfileId: profileId, assertCustomViewBindings: bindings } = loaded.exports;
function rejects(value, code) { assert.throws(() => normalize(value), error => error.name === 'CustomViewError' && (!code || error.code === code)); }
function view(kind, settings = {}) { return { kind, settings }; }

test('ten builtin custom kinds normalize idempotently with independent fixed profile catalogs', () => {
    const list = catalog();
    assert.equal(list.length, 10);
    assert.deepEqual(new Set(list.map(item => item.kind)), new Set(['clock', 'gauge', 'wind', 'presence', 'markdown', 'iframe', 'universal', 'energyFlow', 'weather', 'newline']));
    for (const entry of list) {
        const normalized = normalize(view(entry.kind));
        assert.deepEqual(normalize(JSON.parse(JSON.stringify(normalized))), normalized);
        assert.equal(entry.profile, profileId(entry.kind));
        assert.equal(entry.profile, 'custom_' + entry.kind);
        assert.ok(entry.fields.length <= 128);
        assert.equal(new Set(entry.fields.map(field => field.key)).size, entry.fields.length);
        assert.ok(entry.settings.every(setting => setting.key !== 'markdown'));
        assert.ok(entry.settings.every(setting => entry.settingKeys.includes(setting.key)));
    }
    const first = profiles(); first[1].fields[0].types.push('string'); first[1].fields[0].label = 'tampered';
    assert.equal(profiles()[1].fields[0].label, 'Messwert');
    assert.deepEqual(profiles()[1].fields[0].types, ['number']);
    assert.equal(normalize(undefined), null); assert.equal(normalize(null), null);
});

test('catalog grants write capability only to a fixed universal ACTION slot', () => {
    const all = profiles(); const writable = all.flatMap(profile => profile.fields.filter(field => field.write).map(field => [profile.id, field.key]));
    assert.deepEqual(writable, [['custom_universal', 'ACTION']]);
    assert.equal(all.find(profile => profile.id === 'custom_energyFlow').fields.length, 128);
    for (const kind of ['clock', 'markdown', 'iframe', 'newline']) {
        assert.equal(all.find(profile => profile.id === profileId(kind)).fields.length, 0);
        assert.doesNotThrow(() => bindings(view(kind), { profile: profileId(kind), fields: [] }));
    }
    const weather = all.find(profile => profile.id === 'custom_weather');
    assert.equal(weather.fields.length, 58);
    assert.ok(weather.fields.some(field => field.key === 'PRECIPITATION_CHANCE7'));
    assert.ok(!weather.fields.some(field => field.key === 'PRECIPITATION_CHANCE8'));
});

test('rejects unknown types/properties, free DP settings, secrets, getters and malformed object graphs', () => {
    rejects(view('plugin'), 'EOS_CUSTOM_KIND_INVALID');
    rejects({ kind: 'clock', settings: {}, script: 'bad' });
    rejects(view('gauge', { gaugeStateId: 'system.config' }));
    rejects(view('universal', { actionPin: '1234' }));
    rejects(view('universal', { actionStateId: 'unsafe.target' }));
    const getter = {}; let read = false;
    Object.defineProperty(getter, 'kind', { enumerable: true, get() { read = true; return 'clock'; } });
    rejects(getter); assert.equal(read, false);
    rejects(JSON.parse('{"kind":"clock","settings":{"__proto__":{"polluted":true}}}'));
    assert.equal({}.polluted, undefined);
    const cyclic = view('clock'); cyclic.settings.loop = cyclic; rejects(cyclic);
    const strange = Object.create({ kind: 'clock' }); rejects(strange);
    rejects(view('clock', { latitude: NaN })); rejects(view('gauge', { minValue: Infinity }));
    rejects(view('markdown', { text: 'x'.repeat(32769) }));
});

test('clock coordinates/timezone and numeric display ranges retain real zero and reject invalid values', () => {
    const clock = normalize(view('clock', { latitude: 0, longitude: 0, timeZone: 'Europe/Berlin', showSun: true, showSeconds: false }));
    assert.equal(clock.settings.latitude, 0); assert.equal(clock.settings.longitude, 0); assert.equal(clock.settings.showSeconds, false);
    rejects(view('clock', { latitude: 91 })); rejects(view('clock', { timeZone: 'Not/AZone' }), 'EOS_CUSTOM_TIMEZONE_INVALID');
    const gauge = normalize(view('gauge', { minValue: -10, maxValue: 0, decimals: 0, colorLevels: [{ value: 0, color: '#00AAFF' }, { value: -5, color: '#112233' }] }));
    assert.equal(gauge.settings.maxValue, 0); assert.equal(gauge.settings.decimals, 0);
    assert.deepEqual(gauge.settings.colorLevels.map(level => level.value), [-5, 0]);
    assert.equal(gauge.settings.colorLevels[1].color, '#00aaff');
    rejects(view('gauge', { minValue: 100, maxValue: 100 }), 'EOS_CUSTOM_RANGE_INVALID');
    rejects(view('gauge', { decimals: 2.5 })); rejects(view('gauge', { colorLevels: [{ value: 1, color: 'red' }] }));
    rejects(view('gauge', { colorLevels: [{ value: 1, color: '#000000' }, { value: 1, color: '#ffffff' }] }));
});

test('markdown remains bounded text, aliases resolve consistently and configuration does not interpret HTML', () => {
    const value = '# Titel\n<script>bad()</script>\n- [x] Text\n|A|B|';
    const normalized = normalize(view('markdown', { markdown: value, fontSize: 'xl', align: 'center' }));
    assert.equal(normalized.settings.text, value);
    assert.equal(Object.hasOwn(normalized.settings, 'markdown'), false);
    rejects(view('markdown', { text: 'a', markdown: 'b' }));
    rejects(view('markdown', { text: '\0' }));
    rejects(view('presence', { invert: 'true' }));
    assert.equal(normalize(view('presence', { invert: true, absentMode: 'hide' })).settings.absentMode, 'hide');
});

test('iframe keeps only explicit safe browser URLs and never permits executable/credential URLs', () => {
    for (const url of ['/dashboard/', 'https://nexowatt:8188/', 'http://192.168.10.153/path?q=x%20y#frame']) {
        assert.equal(normalize(view('iframe', { url })).settings.url, url);
    }
    for (const url of ['javascript:alert(1)', 'data:text/html,xx', '//remote.invalid/x', 'https://user:secret@host/path', 'file:///etc/passwd', '/\\remote.invalid/x', 'https://x.invalid/ a']) {
        rejects(view('iframe', { url }), 'EOS_CUSTOM_URL_INVALID');
    }
    rejects(view('iframe', { refreshInterval: -1 })); rejects(view('iframe', { refreshInterval: 0.5 }));
    assert.equal(normalize(view('iframe')).settings.refreshInterval, 0);
});

test('universal typed actions, indicators and chart bounds cannot introduce arbitrary bindings or secrets', () => {
    for (const value of [false, true, 0, -12.5, 'PLAY']) assert.equal(normalize(view('universal', { actionValue: value })).settings.actionValue, value);
    rejects(view('universal', { actionValue: null })); rejects(view('universal', { actionValue: [] }));
    rejects(view('universal', { actionValue: 'x'.repeat(8193) }));
    rejects(view('universal', { actionConfirm: 'pin' }));
    rejects(view('universal', { quickChartInterval: 9 })); rejects(view('universal', { opacityFalse: -0.1 }));
    const normalized = normalize(view('universal', { actionType: 'toggle', actionConfirm: 'dialog', actionConfirmScope: 'off',
        icons: [{ slot: 'ICON2', icon: 'battery', name: 'Batterie', color: '#00ff00', invert: true }], quickChart: true }));
    assert.equal(normalized.settings.icons[0].slot, 'ICON2');
    rejects(view('universal', { icons: [{ slot: 'SECRET', icon: 'x' }] }));
    rejects(view('universal', { icons: [{ slot: 'ICON1' }, { slot: 'ICON1' }] }));
    rejects(view('universal', { widgetIcon: 'https://remote.invalid/icon' }));
});

test('energy rows preserve stable indices and each configured row must bind its matching power slot', () => {
    const input = view('energyFlow', { producers: [{ index: 31, name: 'PV', unit: 'W' }], consumers: [{ name: 'Haus' }], batteryName: 'Speicher' });
    const saved = normalize(input);
    assert.equal(saved.settings.producers[0].index, 31); assert.equal(saved.settings.consumers[0].index, 1);
    assert.doesNotThrow(() => bindings(saved, { profile: 'custom_energyFlow', fields: [{ key: 'PRODUCER31', readId: 'meter.0.pv' }, { key: 'CONSUMER1', readId: 'meter.0.house' }] }));
    assert.throws(() => bindings(saved, { profile: 'custom_energyFlow', fields: [{ key: 'PRODUCER1', readId: 'meter.0.pv' }] }), error => error.code === 'EOS_CUSTOM_BINDING_MISSING');
    rejects(view('energyFlow', { producers: [{ index: 0 }] })); rejects(view('energyFlow', { producers: [{ index: 32 }] }));
    rejects(view('energyFlow', { producers: [{ index: 1 }, { index: 1 }] }));
    rejects(view('energyFlow', { producers: Array.from({ length: 32 }, () => ({})) }));
    rejects(view('energyFlow', { producers: [{ name: 'PV', stateId: 'foreign.0.x' }] }));
});

test('view/profile relationship rejects unknown/duplicate/write-only display slots before generic validation', () => {
    assert.throws(() => bindings(view('gauge'), { profile: 'universal', fields: [{ key: 'VALUE', readId: 'x.0' }] }));
    assert.throws(() => bindings(view('gauge'), { profile: 'custom_gauge', fields: [{ key: 'VALUE', writeId: 'x.0' }] }));
    assert.throws(() => bindings(view('gauge'), { profile: 'custom_gauge', fields: [{ key: 'VALUE' }, { key: 'VALUE' }] }));
    assert.throws(() => bindings(view('gauge'), { profile: 'custom_gauge', fields: [{ key: 'OTHER', readId: 'x.0' }] }));
    assert.doesNotThrow(() => bindings(view('universal'), { profile: 'custom_universal', fields: [{ key: 'ACTION', writeId: 'x.0' }] }));
    assert.throws(() => bindings(view('universal', { icons: [{ slot: 'ICON1' }] }), { profile: 'custom_universal', fields: [] }), error => error.code === 'EOS_CUSTOM_BINDING_MISSING');
});

test('weather remains explicit local DP display and settings do not silently enable a provider request', () => {
    assert.equal(normalize(view('weather')).settings.weatherSource, 'adapter');
    assert.equal(normalize(view('weather', { forecastDays: 0 })).settings.forecastDays, 0);
    for (const weatherSource of ['openmeteo', 'yrno', 'https://remote.invalid']) rejects(view('weather', { weatherSource }));
    rejects(view('weather', { forecastDays: 8 }));
    assert.equal(normalize(view('newline')).kind, 'newline');
});
