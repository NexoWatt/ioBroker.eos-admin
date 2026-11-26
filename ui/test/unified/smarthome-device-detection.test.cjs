'use strict';
// Real TypeDetector patterns and pure import helpers; no hardware/browser claim.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { ChannelDetector } = require('@iobroker/type-detector');
const sourceRoot = path.resolve(__dirname, '../../src-ts/runtime-executables/lib');
const loaded = new Map();
function load(name) {
    if (loaded.has(name)) return loaded.get(name).exports;
    const file = path.join(sourceRoot, `${name}.ts`);
    const mod = new Module(file, module); mod.filename = file;
    mod.paths = Module._nodeModulePaths(path.dirname(file));
    loaded.set(name, mod);
    const native = mod.require.bind(mod);
    mod.require = id => id.startsWith('./') && fs.existsSync(path.join(sourceRoot, `${id.slice(2)}.ts`)) ? load(id.slice(2)) : native(id);
    mod._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true, resolveJsonModule: true },
    }).outputText, file);
    return mod.exports;
}
const { cleanControls, extendSuggestion, getControlIdentity, collectKeywordDetectionCandidates, keywordReviewSuggestion, DetectionScan } = load('smarthome-device-detection');
const { enrichSmartHomeImportSuggestion, reconcileSmartHomeImportSuggestions, normalizeSmartHomeImportProvenance,
    smartHomeImportFieldValue, isSmartHomeImportField, SMART_HOME_DETECTOR_VERSION } = load('smarthome-import');
const { getControlProfiles } = load('smarthome-device-controls');
function state(id, type, role, write = false, extra = {}) {
    return { _id: id, type: 'state', native: {}, common: { name: id, type, role, read: true, write, ...extra } };
}
function channel(id, name = id) { return { _id: id, type: 'channel', native: {}, common: { name } }; }
function suggestion(control, objects, config = { rooms: [], functions: [], devices: [] }, sourceId = 'test.0.unit', type = 'device') {
    return enrichSmartHomeImportSuggestion(extendSuggestion({ sourceId, sourceType: 'channel', proposal: { type, alias: 'Gerät', io: {}, behavior: {} }, notes: [] }, control, objects), objects, config);
}
function socket(id) { return { type: 'socket', states: [{ name: 'SET', id, required: true, type: 'boolean' }] }; }

async function keywordCandidates(objects, covered = []) {
    const keys = Object.keys(objects);
    const values = [];
    for await (const candidate of collectKeywordDetectionCandidates(objects, keys, new Set(keys), new Set(covered), new DetectionScan())) values.push(candidate);
    return values;
}

test('real generic KNX detector proposes the same identity with German and English function folders', () => {
    const id = 'knx.0.Buero.DimStatus';
    const source = state(id, 'number', 'state', false, { name: { de: 'Dimmrückmeldung', en: 'Brightness feedback' }, unit: '%', min: 0, max: 100 });
    source.native = { dpt: 'DPT5.001', address: '2/1/21' };
    const objects = { [id]: source };
    const detect = () => new ChannelDetector().detect({ id, objects, allowedTypes: ['info', 'dimmer'] });
    const clean = cleanControls(detect(), objects)[0];
    const current = suggestion(clean, objects, undefined, id, 'sensor');
    assert.equal(clean.type, 'info');
    assert.equal(current.importable, true);
    assert.equal(current.discoveryReview, false);
    assert.deepEqual(new Set(current.functionCategories), new Set(['status', 'dimmer']));
    assert.deepEqual(current.proposal.io.deviceControls.fields, [{ key: 'ACTUAL', readId: id }]);
    source.common.name = { de: 'Dimmrückmeldung' };
    const german = suggestion(cleanControls(detect(), objects)[0], objects, undefined, id, 'sensor');
    assert.equal(german.id, current.id);
    assert.deepEqual(german.functionCategories, current.functionCategories);
    source.common.name = { en: 'Brightness feedback' };
    const english = suggestion(cleanControls(detect(), objects)[0], objects, undefined, id, 'sensor');
    assert.equal(english.id, current.id);
    assert.deepEqual(english.functionCategories, current.functionCategories);
});

test('Homematic LEVEL needs context and never becomes a keyword-generated command', async () => {
    const blind = 'hm-rpc.0.001558A99A7B13.4';
    const level = `${blind}.LEVEL`;
    const dimmer = 'hm-rpc.0.001558A99A7B14.4';
    const actual = `${dimmer}.STATUS_LEVEL`;
    const unknown = 'hm-rpc.0.001558A99A7B15.4.LEVEL';
    const objects = {
        [blind]: channel(blind, 'Rollladen West'),
        [level]: state(level, 'number', 'level', true, { name: 'LEVEL', unit: '%', min: 0, max: 100 }),
        [dimmer]: channel(dimmer, 'Hall light'),
        [actual]: state(actual, 'number', '', false, { name: 'Brightness feedback', unit: '%', min: 0, max: 100 }),
        [unknown]: state(unknown, 'number', 'level', true, { name: 'LEVEL', unit: '%', min: 0, max: 100 }),
    };
    const matches = await keywordCandidates(objects);
    assert.deepEqual(matches.map(match => match.stateId), [level, actual]);
    const pending = keywordReviewSuggestion(matches[0]);
    assert.equal(pending.importable, false);
    assert.equal(pending.discoveryReview, true);
    assert.equal(pending.proposal, undefined);
    assert.deepEqual(pending.functionCategories, ['blind', 'review']);
    assert.deepEqual(pending.states, [{ id: level, label: 'LEVEL', key: 'ACTUAL', type: 'number', role: 'level', unit: '%', read: true, write: true }]);
    const found = matches[1];
    const detected = suggestion(found.control, objects, undefined, found.sourceId, 'dimmer');
    assert.equal(detected.importable, true);
    assert.deepEqual(detected.proposal.io.deviceControls.fields, [{ key: 'ACTUAL', readId: actual }]);
    assert.deepEqual(detected.functionCategories, ['dimmer', 'status']);
});

test('German and English temperature readings use their declared unit and separate flat KNX groups', async () => {
    const first = 'knx.0.Kueche.GA_2_1_7'; const second = 'knx.0.Kueche.GA_2_1_8';
    const target = 'knx.0.Kueche.GA_2_1_9'; const conflicting = 'knx.0.Kueche.GA_2_1_10';
    const objects = {
        [first]: state(first, 'number', '', false, { name: 'Isttemperatur', unit: '°C' }),
        [second]: state(second, 'number', '', false, { name: 'Measured temperature', unit: '°C' }),
        [target]: state(target, 'number', '', true, { name: 'Solltemperatur', unit: '°C' }),
        [conflicting]: state(conflicting, 'number', '', false, { name: 'Temperatur', unit: '%' }),
    };
    const matches = await keywordCandidates(objects);
    assert.deepEqual(matches.map(match => match.stateId), [first, second, target]);
    assert.deepEqual(matches.slice(0, 2).map(match => match.control.states), [
        [{ name: 'ACTUAL', id: first, required: true }], [{ name: 'ACTUAL', id: second, required: true }],
    ]);
    assert.equal(matches[2].control, undefined);
    assert.deepEqual((await keywordCandidates(objects, [first, second, target])), []);
});

test('overlapping generic keywords are manual review, and blocked ID namespaces do not surface', async () => {
    const ids = ['openknx.0.kitchen.group', 'openknx.0.kitchen.password', 'admin.0.temperature', 'alias.0.bedroom.temperature'];
    const objects = {
        [ids[0]]: state(ids[0], 'number', '', true, { name: 'Shutter brightness position', unit: '%' }),
        ...Object.fromEntries(ids.slice(1).map(id => [id, state(id, 'number', '', false, { name: 'Measured temperature', unit: '°C' })])),
    };
    const found = await keywordCandidates(objects);
    assert.equal(found.length, 1);
    assert.equal(found[0].control, undefined);
    assert.deepEqual(keywordReviewSuggestion(found[0]).functionCategories, ['dimmer', 'blind', 'review']);
    const abort = new AbortController(); abort.abort();
    await assert.rejects(async () => {
        for await (const _match of collectKeywordDetectionCandidates(objects, ids, new Set(ids), new Set(), new DetectionScan({ signal: abort.signal }))) {
            assert.fail('aborted scan must not yield a proposal');
        }
    }, error => error.code === 'EOS_DETECTION_ABORTED');
});

test('a generic TypeDetector switch or info conflict is visible for review and cannot be bulk imported', () => {
    const stop = 'openknx.0.kitchen.GA_3_1_2';
    const position = 'openknx.0.kitchen.GA_3_1_3';
    const writableLevel = 'openknx.0.kitchen.GA_3_1_4';
    const objects = {
        [stop]: state(stop, 'boolean', 'state', true, { name: 'Jalousie Stopp' }),
        [position]: state(position, 'number', 'state', false, { name: 'Shutter position feedback', unit: '%', min: 0, max: 100 }),
        [writableLevel]: state(writableLevel, 'number', 'state', true, { name: 'Brightness target', unit: '%' }),
    };
    [stop, position, writableLevel].forEach(id => {
        const controls = new ChannelDetector().detect({ objects, id, allowedTypes: ['socket', 'info'] });
        assert.equal(controls.length, 1);
        const result = suggestion(controls[0], objects, undefined, id);
        assert.equal(result.importable, false);
        assert.equal(result.discoveryReview, true);
        assert.ok(result.functionCategories.includes('review'));
    });
    const conventional = 'openknx.0.kitchen.GA_3_1_5';
    objects[conventional] = state(conventional, 'boolean', 'switch', true, { name: 'On/Off' });
    assert.equal(suggestion(socket(conventional), objects, undefined, conventional).importable, true);
});

test('catalog follows installed 6.2 dependency and every builtin external pattern', () => {
    assert.equal(SMART_HOME_DETECTOR_VERSION, require('@iobroker/type-detector/package.json').version);
    assert.match(SMART_HOME_DETECTOR_VERSION, /^6\.2\./);
    const profiles = new Set(getControlProfiles().map(profile => profile.id));
    for (const pattern of Object.values(ChannelDetector.getPatterns())) assert.ok(profiles.has(pattern.type), pattern.type);
});

test('real detection retains secondary values and readonly/actual unit metadata', () => {
    const objects = {
        'test.0.unit': channel('test.0.unit', 'Raumfühler'),
        'test.0.unit.t': state('test.0.unit.t', 'number', 'value.temperature', false, { unit: '°C' }),
        'test.0.unit.h': state('test.0.unit.h', 'number', 'value.humidity', false, { unit: '%' }),
    };
    const detected = new ChannelDetector().detect({ objects, id: 'test.0.unit', allowedTypes: ['temperature'] });
    const clean = cleanControls(detected, objects); assert.equal(clean.length, 1);
    const result = suggestion(clean[0], objects);
    assert.equal(result.importable, true);
    assert.deepEqual(result.proposal.io.deviceControls.fields, [{ key: 'ACTUAL', readId: 'test.0.unit.t' }, { key: 'SECOND', readId: 'test.0.unit.h' }]);
    assert.equal(result.proposal.behavior.readOnly, true);
    assert.equal(result.states.find(field => field.key === 'SECOND').unit, '%');
});

test('real media and fan patterns produce complete external profiles', () => {
    const objects = {
        'test.0.media': channel('test.0.media'),
        'test.0.media.state': state('test.0.media.state', 'boolean', 'media.state'),
        'test.0.media.play': state('test.0.media.play', 'boolean', 'button.play', true),
        'test.0.media.pause': state('test.0.media.pause', 'boolean', 'button.pause', true),
        'test.0.media.volume': state('test.0.media.volume', 'number', 'level.volume', true, { min: 0, max: 100 }),
        'test.0.fan': channel('test.0.fan'),
        'test.0.fan.speed': state('test.0.fan.speed', 'number', 'level.speed.fan', true, { min: 0, max: 3, states: { 0: 'Aus', 1: 'Leise' } }),
    };
    for (const [root, type] of [['test.0.media', 'media'], ['test.0.fan', 'fan']]) {
        const detected = new ChannelDetector().detect({ objects, id: root, allowedTypes: [type] });
        assert.ok(detected?.length, `${type} fixture`);
        const result = suggestion(cleanControls(detected, objects)[0], objects, undefined, root);
        assert.equal(result.proposal.io.deviceControls.profile, type);
        assert.ok(result.proposal.io.deviceControls.fields.some(field => field.writeId));
    }
});

test('foreign optional alias siblings and duplicate values are removed without mutation', () => {
    const objects = {
        'alias.0.one.target': state('alias.0.one.target', 'number', 'level.temperature', true, { alias: { id: 'test.0.one' } }),
        'alias.0.two.actual': state('alias.0.two.actual', 'number', 'value.temperature', false, { alias: { id: 'test.0.two' } }),
        'test.0.shared.error': state('test.0.shared.error', 'boolean', 'indicator.error'),
    };
    const input = [{ type: 'thermostat', states: [
        { name: 'SET', id: 'alias.0.one.target', requiredOneOf: 'setpoint' },
        { name: 'ACTUAL', id: 'alias.0.one.target' },
        { name: 'HUMIDITY', id: 'alias.0.two.actual' },
        { name: 'ERROR', id: 'test.0.shared.error', indicator: true },
    ] }];
    const before = JSON.stringify(input);
    const clean = cleanControls(input, objects);
    assert.deepEqual(clean[0].states.map(field => field.name), ['SET', 'ERROR']);
    assert.equal(JSON.stringify(input), before);
});

test('siblings with shared diagnostics have separate stable identity and room assignment', () => {
    const objects = {
        'test.0.unit': channel('test.0.unit'),
        'test.0.unit.a': state('test.0.unit.a', 'boolean', 'switch', true),
        'test.0.unit.b': state('test.0.unit.b', 'boolean', 'switch', true),
        'test.0.battery': state('test.0.battery', 'number', 'value.battery', false, { unit: '%' }),
        'enum.rooms.office': { type: 'enum', common: { name: 'Büro', members: ['test.0.unit'] } },
    };
    const a = socket('test.0.unit.a'); const b = socket('test.0.unit.b');
    a.states.push({ name: 'BATTERY', id: 'test.0.battery', indicator: false });
    b.states.push({ name: 'BATTERY', id: 'test.0.battery', indicator: false });
    const cfg = { rooms: [{ id: 'office', name: 'Büro' }], functions: [], devices: [] };
    const proposals = [suggestion(a, objects, cfg), suggestion(b, objects, cfg)];
    assert.notEqual(proposals[0].id, proposals[1].id);
    assert.equal(getControlIdentity(a), getControlIdentity(socket('test.0.unit.a')));
    assert.equal(proposals[0].suggestedAssignment.roomId, 'office');
    cfg.devices.push({ ...proposals[0].proposal, id: 'existing' });
    const reviewed = reconcileSmartHomeImportSuggestions(proposals, objects, cfg);
    assert.equal(reviewed[0].alreadyConfigured, true);
    assert.equal(reviewed[1].alreadyConfigured, false);
});

test('stable slot provenance retains manual changes when field order and source mappings change', () => {
    const objects = {
        'test.0.unit': channel('test.0.unit'),
        'test.0.unit.set': state('test.0.unit.set', 'boolean', 'switch', true),
        'test.0.unit.actual': state('test.0.unit.actual', 'boolean', 'state'),
        'test.0.unit.new': state('test.0.unit.new', 'boolean', 'state'),
        'test.0.manual': state('test.0.manual', 'boolean', 'state'),
    };
    const control = socket('test.0.unit.set'); control.states.push({ name: 'ACTUAL', id: 'test.0.unit.actual' });
    const original = suggestion(control, objects);
    const device = JSON.parse(JSON.stringify({ ...original.proposal, id: 'switch1', roomId: 'room-kept' }));
    device.io.deviceControls.fields.find(field => field.key === 'ACTUAL').readId = 'test.0.manual';
    device.io.deviceControls.fields.reverse();
    const nextControl = { ...control, states: control.states.map(field => field.name === 'ACTUAL' ? { ...field, id: 'test.0.unit.new' } : field).reverse() };
    const next = suggestion(nextControl, objects);
    const result = reconcileSmartHomeImportSuggestions([next], objects, { devices: [device] })[0];
    const change = result.update.changes.find(change => change.path === 'io.deviceControls.fields.ACTUAL.readId');
    assert.deepEqual(change, { path: 'io.deviceControls.fields.ACTUAL.readId', current: 'test.0.manual', proposed: 'test.0.unit.new', manualOverride: true });
    assert.equal(device.roomId, 'room-kept');
    assert.equal(smartHomeImportFieldValue(device, change.path), 'test.0.manual');
    assert.equal(normalizeSmartHomeImportProvenance(next.provenance).controlId, next.controlId);
    assert.equal(isSmartHomeImportField('io.deviceControls.fields.__proto__.readId'), false);
    assert.equal(isSmartHomeImportField('io.deviceControls.fields.0.readId'), false);
});

test('explicit object directions never invent read/write permissions and alias cycles block import', () => {
    const objects = {
        'test.0.unit': channel('test.0.unit'),
        'test.0.command': state('test.0.command', 'boolean', 'switch', true, { read: false }),
        'alias.0.cycle': state('alias.0.cycle', 'boolean', 'switch', true, { alias: { id: 'alias.0.cycle' } }),
    };
    const command = suggestion(socket('test.0.command'), objects);
    assert.deepEqual(command.proposal.io.deviceControls.fields, [{ key: 'SET', writeId: 'test.0.command' }]);
    assert.equal(suggestion(socket('alias.0.cycle'), objects).importable, false);
    objects['test.0.command'].common.write = false;
    assert.equal(suggestion(socket('test.0.command'), objects).importable, false);
});

test('alias preference keeps the alias and distinguishes its read and write targets', () => {
    const objects = {
        'test.0.unit': channel('test.0.unit'),
        'test.0.read': state('test.0.read', 'boolean', 'state'),
        'test.0.write': state('test.0.write', 'boolean', 'switch', true),
        'alias.0.unit': channel('alias.0.unit'),
        'alias.0.unit.set': state('alias.0.unit.set', 'boolean', 'switch', true, { alias: { id: { read: 'test.0.read', write: 'test.0.write' } } }),
    };
    const physical = socket('test.0.write'); physical.states.push({ name: 'ACTUAL', id: 'test.0.read' });
    const alias = suggestion(socket('alias.0.unit.set'), objects, undefined, 'alias.0.unit');
    const results = reconcileSmartHomeImportSuggestions([suggestion(physical, objects), alias], objects, { devices: [] });
    assert.equal(results.length, 1);
    assert.equal(results[0].sourceId, 'alias.0.unit');
    assert.deepEqual(results[0].proposal.io.deviceControls.fields, [{ key: 'SET', readId: 'alias.0.unit.set', writeId: 'alias.0.unit.set' }]);
    assert.deepEqual(results[0].semanticIds, ['test.0.read', 'test.0.write']);
});

test('legacy provenance upgrades without changing the existing legacy type or manual room', () => {
    const objects = { 'test.0.unit': channel('test.0.unit'), 'test.0.unit.set': state('test.0.unit.set', 'boolean', 'switch', true) };
    const old = enrichSmartHomeImportSuggestion({ sourceId: 'test.0.unit', detectorType: 'socket', targetType: 'switch', importable: true,
        states: [{ key: 'SET', id: 'test.0.unit.set', type: 'boolean', read: true, write: true }],
        proposal: { type: 'switch', alias: 'Schalter', io: { switch: { readId: 'test.0.unit.set', writeId: 'test.0.unit.set' } } } }, objects, {});
    const existing = { ...old.proposal, id: 'old-switch', roomId: 'customer-room', behavior: { favorite: true } };
    existing.importProvenance.mappingVersion = 1;
    const next = suggestion(socket('test.0.unit.set'), objects, undefined, 'test.0.unit', 'switch');
    const result = reconcileSmartHomeImportSuggestions([next], objects, { devices: [existing] })[0];
    assert.equal(result.update.deviceId, 'old-switch');
    assert.ok(result.update.changes.some(change => change.path === 'io.deviceControls.profile' && change.proposed === 'socket'));
    assert.equal(existing.roomId, 'customer-room'); assert.equal(existing.behavior.favorite, true);
});

test('repeated primary slots become independent controls and forecast day slots stay typed', () => {
    const objects = {
        'test.0.a': state('test.0.a', 'string', 'text'), 'test.0.b': state('test.0.b', 'string', 'text'),
        'test.0.day': state('test.0.day', 'number', 'value.temperature.min.forecast.2'),
    };
    const control = { type: 'info', states: [
        { name: 'ACTUAL', id: 'test.0.a', required: true, multiple: true },
        { name: 'ACTUAL', id: 'test.0.b', required: true, multiple: true },
    ] };
    const cleaned = cleanControls([control], objects);
    assert.equal(cleaned.length, 2); assert.notEqual(getControlIdentity(cleaned[0]), getControlIdentity(cleaned[1]));
    const weather = suggestion({ type: 'weatherForecast', states: [{ name: 'TEMP_MIN2', id: 'test.0.day', required: true }] }, objects);
    assert.equal(weather.importable, true);
    assert.deepEqual(weather.proposal.io.deviceControls.fields, [{ key: 'TEMP_MIN2', readId: 'test.0.day' }]);
    assert.equal(isSmartHomeImportField('io.deviceControls.fields.TEMP_MIN2.readId'), true);
});

test('profile-enabled legacy groups never turn readonly feedback into write mappings', () => {
    const { normalizeSmartHomeDevice } = load('smarthome-contract');
    const base = { id: 'mixed', type: 'color', behavior: { readOnly: false }, io: {
        switch: { readId: 'fixture.0.onActual', writeId: null },
        level: { readId: 'fixture.0.levelActual' }, color: { readId: 'fixture.0.rgb', writeId: 'fixture.0.rgb' },
        player: { volumeReadId: 'fixture.0.volumeActual', powerReadId: 'fixture.0.powerActual', muteReadId: 'fixture.0.muteActual', seekReadId: 'fixture.0.seekActual', playId: 'fixture.0.play' },
        cover: { positionId: 'fixture.0.positionActual', tiltReadId: 'fixture.0.tiltActual', upId: 'fixture.0.up' },
        sensor: { readId: 'fixture.0.sensorActual' },
        deviceControls: { profile: 'rgbSingle', fields: [{ key: 'RGB', readId: 'fixture.0.rgb', writeId: 'fixture.0.rgb' }] },
    } };
    const normalized = normalizeSmartHomeDevice(base);
    assert.equal(normalized.io.switch.writeId, null); assert.equal(normalized.io.level.writeId, null);
    assert.equal(normalized.io.cover.positionWriteId, null); assert.equal(normalized.io.cover.tiltWriteId, null);
    assert.equal(normalized.io.sensor.writeId, null);
    for (const field of ['volumeWriteId', 'powerWriteId', 'muteWriteId', 'seekWriteId']) assert.equal(normalized.io.player[field], null);
    assert.equal(normalized.io.color.writeId, 'fixture.0.rgb'); assert.equal(normalized.io.player.playId, 'fixture.0.play'); assert.equal(normalized.io.cover.upId, 'fixture.0.up');
    assert.equal(normalized.id, 'mixed');
    const legacy = structuredClone(base); delete legacy.io.deviceControls;
    assert.equal(normalizeSmartHomeDevice(legacy).io.switch.writeId, 'fixture.0.onActual');
    const explicit = structuredClone(base); explicit.io.player.volumeWriteId = 'fixture.0.volumeTarget'; explicit.io.cover.positionWriteId = 'fixture.0.positionTarget';
    const retained = normalizeSmartHomeDevice(explicit);
    assert.equal(retained.io.player.volumeWriteId, 'fixture.0.volumeTarget'); assert.equal(retained.io.cover.positionWriteId, 'fixture.0.positionTarget');
});

test('existing cover protections remain part of strict profiles and conflicting sources are rejected', () => {
    const { normalizeSmartHomeDevice } = load('smarthome-contract');
    const device = { id: 'cover', type: 'blind', io: { cover: { upId: 'fixture.0.open', lockId: 'fixture.0.lock', windAlarmId: 'fixture.0.wind' },
        deviceControls: { profile: 'blindButtons', fields: [{ key: 'OPEN', writeId: 'fixture.0.open' }] } } };
    const normalized = normalizeSmartHomeDevice(device);
    assert.deepEqual(normalized.io.deviceControls.fields, [
        { key: 'OPEN', writeId: 'fixture.0.open' }, { key: 'LOCKED', readId: 'fixture.0.lock' }, { key: 'WIND_ALARM', readId: 'fixture.0.wind' },
    ]);
    assert.equal(normalized.io.cover.lockId, 'fixture.0.lock');
    assert.deepEqual(normalizeSmartHomeDevice(normalized).io.deviceControls, normalized.io.deviceControls);
    device.io.deviceControls.fields.push({ key: 'LOCKED', readId: 'fixture.0.otherLock' });
    assert.throws(() => normalizeSmartHomeDevice(device), /EOS_CONTROL_SAFETY_MAPPING_CONFLICT/);
});

test('managed aliases retain canonical import identity while preserving alias bindings and display', () => {
    const objects = { 'test.0.unit': channel('test.0.unit', 'Hardware'), 'test.0.unit.set': state('test.0.unit.set', 'boolean', 'switch', true) };
    const physical = suggestion(socket('test.0.unit.set'), objects);
    const aliasRoot = 'alias.0.nexowatt_eos.0123456789abcdef01234567';
    objects[aliasRoot] = { ...channel(aliasRoot, 'Kundenname'), native: { eosSmartHomeAliasOwner: 'nexowatt-eos-smarthome', eosSmartHomeAlias: {
        schema: 1, sourceId: physical.sourceId, controlId: physical.controlId, deviceId: 'existing',
    } } };
    objects[aliasRoot + '.SET'] = state(aliasRoot + '.SET', 'boolean', 'switch', true, { alias: { id: 'test.0.unit.set' } });
    const managed = suggestion(socket(aliasRoot + '.SET'), objects, undefined, aliasRoot);
    assert.equal(managed.sourceId, physical.sourceId); assert.equal(managed.controlId, physical.controlId);
    assert.equal(managed.displaySourceId, aliasRoot); assert.equal(managed.managedAlias, true); assert.equal(managed.proposal.alias, 'Kundenname');
    assert.equal(managed.proposal.io.deviceControls.fields[0].writeId, aliasRoot + '.SET');
    const preferred = reconcileSmartHomeImportSuggestions([physical, managed], objects, { devices: [] });
    assert.equal(preferred.length, 1); assert.equal(preferred[0].managedAlias, true);
    const old = { ...physical.proposal, id: 'existing' };
    assert.ok(reconcileSmartHomeImportSuggestions([managed], objects, { devices: [old] })[0].update);
    objects[aliasRoot].native.eosSmartHomeAliasOwner = 'foreign';
    assert.equal(suggestion(socket(aliasRoot + '.SET'), objects, undefined, aliasRoot).sourceId, aliasRoot);
});

test('different user alias conversions are not collapsed merely because physical targets match', () => {
    const objects = { 'test.0.unit.set': state('test.0.unit.set', 'boolean', 'switch', true) };
    const inputs = [];
    for (const [name, formula] of [['normal', 'val'], ['inverted', '!val']]) {
        const root = `alias.0.${name}`; objects[root] = channel(root);
        objects[root + '.SET'] = state(root + '.SET', 'boolean', 'switch', true, { alias: { id: 'test.0.unit.set', read: formula, write: formula } });
        inputs.push(suggestion(socket(root + '.SET'), objects, undefined, root));
    }
    const output = reconcileSmartHomeImportSuggestions(inputs, objects, { devices: [] });
    assert.equal(output.length, 2);
    assert.notEqual(output[0].aliasSemantics, output[1].aliasSemantics);
});

test('actual alias creation followed by TypeDetector6.2 rediscovery preserves canonical identity and existing customer configuration', async () => {
    const { createDeviceAliases } = load('smarthome-device-aliases');
    const objects = { 'test.0.real': channel('test.0.real', 'Hardwarelicht'),
        'test.0.real.power': state('test.0.real.power', 'boolean', 'switch.light', true) };
    const detected = new ChannelDetector().detect({ objects, id: 'test.0.real', allowedTypes: ['light'] });
    assert.ok(detected?.length);
    const physical = suggestion(cleanControls(detected, objects)[0], objects, undefined, 'test.0.real');
    const customer = { ...physical.proposal, id: 'customer-stable', roomId: 'living', behavior: { favorite: true } };
    const aliases = await createDeviceAliases([customer], {
        readObject: async id => objects[id],
        createObjectIfAbsent: async (id, object) => { if (!objects[id]) objects[id] = { _id: id, ...structuredClone(object) }; },
    });
    const saved = aliases.devices[0];
    const aliasId = saved.io.deviceControls.fields.find(field => field.key === 'SET').writeId;
    const aliasRoot = aliasId.slice(0, aliasId.lastIndexOf('.'));
    const aliasDetection = new ChannelDetector().detect({ objects, id: aliasRoot, allowedTypes: ['light'] });
    assert.ok(aliasDetection?.length);
    const rediscovered = suggestion(cleanControls(aliasDetection, objects)[0], objects, undefined, aliasRoot);
    assert.equal(rediscovered.sourceId, physical.sourceId); assert.equal(rediscovered.controlId, physical.controlId);
    assert.equal(rediscovered.managedAlias, true); assert.equal(rediscovered.displaySourceId, aliasRoot);
    const result = reconcileSmartHomeImportSuggestions([physical, rediscovered], objects, { devices: [saved] });
    assert.equal(result.length, 1); assert.equal(result[0].alreadyConfigured, true);
    assert.equal(saved.id, 'customer-stable'); assert.equal(saved.roomId, 'living'); assert.equal(saved.behavior.favorite, true);
    assert.equal(result[0].proposal.io.deviceControls.fields.find(field => field.key === 'SET').writeId, aliasId);
});

test('manual fallback slots do not invent detector mappings or broaden readonly media STATE commands', () => {
    const { normalizeDeviceControls } = load('smarthome-device-controls');
    const objects = { 'test.0.media': channel('test.0.media'),
        'test.0.media.state': state('test.0.media.state', 'boolean', 'media.state', false),
        'test.0.media.play': state('test.0.media.play', 'boolean', 'button.play', true),
        'test.0.media.volume': state('test.0.media.volume', 'number', 'level.volume', true, { min: 0, max: 100 }),
        'test.0.manual.color': state('test.0.manual.color', 'number', 'level.dimmer', true) };
    const detected = new ChannelDetector().detect({ objects, id: 'test.0.media', allowedTypes: ['media'] });
    assert.ok(detected?.length);
    const control = cleanControls(detected, objects)[0];
    // Metadata may become writable between detection and proposal creation; the original detected readonly slot is still not a command.
    objects['test.0.media.state'].common.write = true;
    const extended = suggestion(control, objects, undefined, 'test.0.media');
    const actual = extended.proposal.io.deviceControls.fields.find(field => field.key === 'STATE');
    assert.ok(actual.readId); assert.equal(actual.writeId, undefined);
    const unsupportedDetection = extendSuggestion({ sourceId: 'test.0.manual', proposal: {} },
        { type: 'rgb', states: [{ name: 'SET', id: 'test.0.manual.color', required: true, write: true }] }, objects);
    assert.equal(unsupportedDetection.importable, false);
    assert.deepEqual(normalizeDeviceControls({ profile: 'rgb', fields: [{ key: 'SET', writeId: 'test.0.manual.color' }] }),
        { profile: 'rgb', fields: [{ key: 'SET', writeId: 'test.0.manual.color' }] });
    assert.ok(normalizeDeviceControls({ profile: 'media', fields: [{ key: 'STATE', writeId: 'test.0.media.state' }] }));
});
