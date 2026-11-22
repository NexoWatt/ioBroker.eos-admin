#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft echte SmartHome-Import-, Normalisierungs-, Zustands- und
 * Entwurfsfunktionen mit synthetischen ioBroker-Objekten und Stateantworten.
 * Daten und Wirkung: Kanonische TS-Module werden nur in ein temporäres Verzeichnis
 * transpiliert. Der installierte Type-Detector wird tatsächlich ausgeführt.
 * Kein HTTP-Server, keine ioBroker-Instanz, keine Gerätewrites und kein Browser.
 * Bei Änderungen: Fixtures, Referenzerwartungen und die ausdrücklich genannten
 * Prüfgrenzen pflegen; ein Softwaretest ist keine Anlagen-/Hardwareabnahme.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const Detector = require('@iobroker/type-detector').default;

const root = path.resolve(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-smarthome-import-'));
const checks = [];
const sourcePaths = [
  'src-ts/runtime-executables/lib/smarthome-import.ts',
  'src-ts/runtime-executables/lib/smarthome-contract.ts',
  'src-ts/runtime-executables/main.ts',
  'src-ts/runtime-executables/www/smarthome-config.ts',
  'scripts/verify-smarthome-import-runtime.js',
];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const clone = value => JSON.parse(JSON.stringify(value));
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

// Keine JS-Spiegel im Produkt verändern: getestete Module kommen aus dem
// aktuellen kanonischen Quellstand und lösen relative Imports im Tempordner auf.
for (const name of ['smarthome-import', 'smarthome-contract']) {
  fs.writeFileSync(path.join(temporary, `${name}.js`), compile(read(`src-ts/runtime-executables/lib/${name}.ts`)));
}
const helper = require(path.join(temporary, 'smarthome-import.js'));
const contract = require(path.join(temporary, 'smarthome-contract.js'));
const mainSource = read('src-ts/runtime-executables/main.ts');
const configSource = read('src-ts/runtime-executables/www/smarthome-config.ts');

function findNode(source, name, predicate) {
  const ast = ts.createSourceFile('actual.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let found;
  const visit = node => {
    if (predicate(node) && node.name && node.name.getText(ast) === name) found = node.getText(ast);
    else ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(found, `Tatsächliche Funktion ${name} muss vorhanden sein`);
  return found;
}

function actualMethod(name) {
  const method = findNode(mainSource, name, ts.isMethodDeclaration);
  return vm.runInNewContext(compile(`const selected = ({ ${method} })[${JSON.stringify(name)}];`) + '\nselected', {
    normalizeSmartHomeCameraStateUrl: helper.normalizeSmartHomeCameraStateUrl,
  });
}
const buildDevices = actualMethod('buildSmartHomeDevicesFromConfig');
const getDevices = actualMethod('getSmartHomeDevicesWithState');

function makeObject(id, type, role, extra = {}) {
  return { _id: id, type: 'state', common: { name: id.split('.').pop(), type, role, read: true, write: false, ...extra }, native: {} };
}
function state(value, extra = {}) { return { val: value, ack: true, q: 0, ts: Date.now(), ...extra }; }
function fixture() {
  const objects = {
    'fixture.0.motion': { _id: 'fixture.0.motion', type: 'channel', common: { name: 'Bewegung Terrasse', icon: 'motion', color: '#169' } },
    'fixture.0.motion.actual': makeObject('fixture.0.motion.actual', 'boolean', 'sensor.motion'),
    'fixture.0.motion.low': makeObject('fixture.0.motion.low', 'boolean', 'indicator.maintenance.lowbat'),
    'fixture.0.motion.unreach': makeObject('fixture.0.motion.unreach', 'boolean', 'indicator.maintenance.unreach'),
    'fixture.0.motion.error': makeObject('fixture.0.motion.error', 'string', 'indicator.error'),
    'fixture.0.temp': { _id: 'fixture.0.temp', type: 'channel', common: { name: 'Temperatur' } },
    'fixture.0.temp.actual': makeObject('fixture.0.temp.actual', 'number', 'value.temperature', { unit: '°C' }),
    'fixture.0.temp.battery': makeObject('fixture.0.temp.battery', 'number', 'value.battery', { unit: '%' }),
    'fixture.0.message': makeObject('fixture.0.message', 'string', 'state', { name: 'Fenstertext' }),
    'fixture.0.camera': makeObject('fixture.0.camera', 'string', 'link.camera', { name: 'Einfahrt' }),
    'enum.rooms.terrace': { type: 'enum', common: { name: { de: 'Terrasse' }, members: ['fixture.0.motion'] } },
    'enum.functions.security': { type: 'enum', common: { name: 'Sicherheit', members: ['fixture.0.motion'] } },
  };
  return { objects, values: {
    'fixture.0.motion.actual': state(true), 'fixture.0.motion.low': state(false),
    'fixture.0.motion.unreach': state(false), 'fixture.0.motion.error': state(''),
    'fixture.0.temp.actual': state(21.5), 'fixture.0.temp.battery': state(0),
    'fixture.0.message': state('Fenster offen'),
    'fixture.0.camera': state('https://example.invalid/live?token=synthetic-only'),
  } };
}

// Führt den tatsächlichen Handler einschließlich echtem Detector und Cache aus.
// Die Zugriffs-Middleware wird hier bewusst nicht getestet; sie gehört zur
// separaten HTTP/Auth-Suite. Statewrites sind im Stub ausdrücklich verboten.
function detectorHarness(objects, values, initialConfig = {}) {
  let config = initialConfig;
  const routes = new Map();
  const adapter = {
    namespace: 'nexowatt-ui.0', config: {},
    getSmartHomeConfig: () => config,
    getForeignObjectsAsync: async () => objects,
    getForeignStateAsync: async id => values[id] || null,
    setForeignStateAsync: async () => assert.fail('Erkennung darf niemals schreiben'),
    log: { warn: message => { throw new Error(message); } },
  };
  const start = mainSource.indexOf('const NW_SHCFG_TD_TYPE_MAP');
  const end = mainSource.indexOf('// Kundenansicht erhält nur die Navigation', start);
  assert.ok(start >= 0 && end > start);
  const context = {
    crypto, NwChannelDetector: Detector, ...helper, adapter,
    requireDpDiscovery: () => {},
    app: { get: (url, ...handlers) => routes.set(url, handlers.at(-1)) },
  };
  vm.runInNewContext(`(function () { ${mainSource.slice(start, end)} }).call(adapter);`, context);
  return {
    setConfig: next => { config = next; },
    async detect(force = true) {
      let payload; let status = 200;
      const res = { status: code => { status = code; return res; }, json: data => { payload = clone(data); return res; } };
      await routes.get('/api/smarthome/type-detect')({ query: force ? { force: '1' } : {} }, res);
      assert.equal(status, 200); assert.equal(payload.ok, true);
      return payload;
    },
  };
}

async function runtime(config, values) {
  const adapter = {
    config: { smartHome: { enabled: true } }, getSmartHomeConfig: () => config,
    _nwIsPlainObject: plain, getForeignStateAsync: async id => {
      if (values[id] instanceof Error) throw values[id];
      return values[id] || null;
    },
    getForeignObjectAsync: async () => null,
    setForeignStateAsync: async () => assert.fail('Zustandsabfrage darf niemals schreiben'),
    getSmartHomeTimersConfig: () => ({ timers: [{ deviceId: 'import_motion', enabled: true, days: [1, 2], onTime: '08:00', offTime: '18:00' }] }),
  };
  adapter.smartHomeDevices = buildDevices.call(adapter);
  return clone(await getDevices.call(adapter));
}

function frontendHarness(config, suggestions) {
  const stateContainer = { config: clone(config), detector: { results: clone(suggestions) } };
  let dirty = 0;
  const context = vm.createContext({
    nwShcState: stateContainer, nwMarkDirty: () => { dirty += 1; },
    nwSetDetectorStatus: () => {}, nwRenderAll: () => {}, nwNormalizeDeviceOrder: () => {},
    nwAddDeviceFromTemplate: (type, assignment) => {
      const device = { id: `new_device_${stateContainer.config.devices.length}`, type, ...assignment, io: {}, ui: {}, behavior: {} };
      stateContainer.config.devices.push(device); return device;
    },
  });
  for (const name of ['nwShcfgGetDetectorAssignment', 'nwShcfgCloneJson', 'nwShcfgAcceptDetectedAssignment',
    'nwShcfgDraftContainsSuggestion', 'nwImportTypeDetectedSuggestion', 'nwShcfgImportFieldAllowed',
    'nwShcfgImportFieldValue', 'nwApplyTypeDetectedUpdate']) {
    vm.runInContext(compile(findNode(configSource, name, ts.isFunctionDeclaration)), context);
  }
  return { context, state: stateContainer, dirty: () => dirty };
}

async function check(name, body) {
  await body(); checks.push({ name, passed: true });
  console.log(`[smarthome-import] OK ${name}`);
}

async function run() {
  assert.equal(require('@iobroker/type-detector/package.json').version, '5.0.10');
  const data = fixture();
  const cfg = { rooms: [{ id: 'existing_terrace', name: 'Terrasse', floorId: 'ground' }], functions: [], devices: [], scenes: [] };
  const harness = detectorHarness(data.objects, data.values, cfg);
  const detected = await harness.detect();
  const motion = detected.suggestions.find(row => row.detectorType === 'motion');
  const temperature = detected.suggestions.find(row => row.detectorType === 'temperature');
  const message = detected.suggestions.find(row => row.sourceId === 'fixture.0.message');

  await check('Echter Detector: Boolean, Text, Zahl und Herkunft', () => {
    assert.ok(motion); assert.ok(temperature); assert.ok(message);
    assert.equal(motion.proposal.io.sensor.valueType, 'boolean');
    assert.equal(message.proposal.io.sensor.valueType, 'string');
    assert.equal(temperature.proposal.io.sensor.valueType, 'number');
    assert.equal(motion.proposal.importProvenance.detectorVersion, '5.0.10');
    assert.match(motion.provenance.signature, /^[a-f0-9]{64}$/);
    assert.equal(motion.proposal.io.indicators.batteryUnit, 'low');
    assert.equal(temperature.proposal.io.indicators.batteryUnit, '%');
  });

  const normalized = contract.normalizeSmartHomeConfig({ ...cfg, devices: [motion, message, temperature].map((row, index) => ({
    ...row.proposal, id: index === 0 ? 'import_motion' : `import_${index}`, roomId: 'existing_terrace',
  })) });
  await check('Detector → Vertrag → echte Gerätezustände mit getrennten Datentypen', async () => {
    const devices = await runtime(normalized, data.values);
    assert.deepEqual(devices.slice(0, 3).map(row => row.state.value), [true, 'Fenster offen', 21.5]);
    assert.ok(devices.every(row => row.quality.status === 'online'));
    assert.equal(devices[0].state.battery, false); assert.equal(devices[0].state.batteryUnit, 'low');
    assert.equal(devices[2].state.battery, 0); assert.equal(devices[2].state.batteryUnit, '%');
    assert.equal(devices[0].timer.onTime, '08:00');
    assert.equal(devices[0].ui.color, '#116699');
  });

  await check('Optionale Indikatoren: unbekannt/ungültig/stale maskiert keine Kernqualität', async () => {
    const values = { ...data.values, 'fixture.0.motion.low': null, 'fixture.0.temp.battery': state(true), 'fixture.0.motion.actual': state({ bad: true }) };
    const devices = await runtime(normalized, values);
    assert.equal(devices[0].quality.status, 'invalid');
    assert.equal(devices[0].fieldQuality.battery.status, 'unknown');
    assert.equal(Object.hasOwn(devices[0].state, 'battery'), false);
    assert.equal(devices[2].quality.status, 'online');
    assert.equal(devices[2].fieldQuality.battery.status, 'invalid');
    const staleConfig = clone(normalized); staleConfig.devices[2].behavior.staleAfterSec = 10;
    values['fixture.0.temp.battery'] = state(50, { ts: Date.now() - 60000 });
    const stale = (await runtime(staleConfig, values))[2];
    assert.equal(stale.quality.status, 'online'); assert.equal(stale.fieldQuality.battery.status, 'stale');
    assert.equal(Object.hasOwn(stale.state, 'battery'), false);
  });

  await check('UNREACH und echte Fehlermeldungen; keine Umdeutung gesunder Werte', async () => {
    for (const error of [true, 7, 'Motor blockiert']) {
      const devices = await runtime(normalized, { ...data.values, 'fixture.0.motion.error': state(error) });
      assert.equal(devices[0].quality.status, 'error');
    }
    for (const error of [false, 0, '', '0', 'OK']) {
      const devices = await runtime(normalized, { ...data.values, 'fixture.0.motion.error': state(error) });
      assert.equal(devices[0].quality.status, 'online');
    }
    const devices = await runtime(normalized, { ...data.values, 'fixture.0.motion.unreach': state(true) });
    assert.equal(devices[0].quality.status, 'offline'); assert.equal(devices[0].state.unreachable, true);
  });

  await check('Metadatenvorschläge, lokale Symbole und explizites Anlegen von Zuordnungen', () => {
    assert.equal(motion.suggestedAssignment.roomId, 'existing_terrace');
    assert.equal(motion.metadata.rooms[0].create, false);
    assert.equal(motion.metadata.functions[0].create, true);
    assert.equal(motion.proposal.icon, 'motion');
    const ui = frontendHarness(cfg, [motion]);
    assert.equal(ui.state.config.functions.length, 0);
    ui.context.nwImportTypeDetectedSuggestion(motion.id);
    assert.equal(ui.state.config.functions.length, 1);
    assert.equal(ui.state.config.rooms.length, 1);
    assert.equal(ui.state.config.devices[0].roomId, 'existing_terrace');
    assert.equal(ui.state.config.devices[0].io.sensor.valueType, 'boolean');
    assert.equal(ui.state.config.devices[0].importProvenance.sourceId, motion.sourceId);
    ui.context.nwImportTypeDetectedSuggestion(motion.id);
    assert.equal(ui.state.config.devices.length, 1); assert.equal(ui.dirty(), 1);
    const remote = clone(data.objects); remote['fixture.0.motion'].common.icon = 'https://example.invalid/untrusted.svg';
    remote['fixture.0.motion'].common.color = 'url(https://example.invalid/style)';
    const safe = helper.enrichSmartHomeImportSuggestion({ ...motion, proposal: { ...motion.proposal, icon: '3d-sensor', ui: {} } }, remote, cfg);
    assert.equal(safe.proposal.icon, '3d-sensor'); assert.equal(safe.proposal.ui.color, undefined);
    const ambiguous = helper.enrichSmartHomeImportSuggestion(motion, data.objects, {
      ...cfg, rooms: [{ id: 'terrace_a', name: 'Terrasse' }, { id: 'terrace_b', name: 'Terrasse' }],
    });
    assert.equal(ambiguous.suggestedAssignment.roomId, '');
    assert.equal(ambiguous.metadata.rooms.length, 2);
    assert.ok(ambiguous.metadata.rooms.every(row => row.create === false));
  });

  await check('Aliaspräferenz, getrennte Read/Write-Ziele und doppelte Draftimporte', async () => {
    const aliasObjects = clone(data.objects);
    aliasObjects['alias.0.terrace'] = { _id: 'alias.0.terrace', type: 'channel', common: { name: 'Terrassenalias' } };
    aliasObjects['alias.0.terrace.actual'] = makeObject('alias.0.terrace.actual', 'boolean', 'sensor.motion', { alias: { id: 'fixture.0.motion.actual' } });
    const result = await detectorHarness(aliasObjects, data.values, cfg).detect();
    const suggestions = result.suggestions.filter(row => row.semanticIds.includes('fixture.0.motion.actual'));
    assert.equal(suggestions.length, 1); assert.equal(suggestions[0].usesAlias, true);
    assert.equal(suggestions[0].proposal.io.sensor.readId, 'alias.0.terrace.actual');
    aliasObjects['fixture.0.command'] = makeObject('fixture.0.command', 'boolean', 'switch', { write: true });
    aliasObjects['alias.0.split'] = makeObject('alias.0.split', 'boolean', 'switch', { alias: { id: { read: 'alias.0.terrace.actual', write: 'fixture.0.command' } } });
    assert.equal(helper.resolveSmartHomeAliasIdentity(aliasObjects, 'alias.0.split', 'read').id, 'fixture.0.motion.actual');
    assert.equal(helper.resolveSmartHomeAliasIdentity(aliasObjects, 'alias.0.split', 'write').id, 'fixture.0.command');
    const ui = frontendHarness(cfg, [suggestions[0], motion]);
    ui.context.nwImportTypeDetectedSuggestion(suggestions[0].id);
    ui.context.nwImportTypeDetectedSuggestion(motion.id);
    assert.equal(ui.state.config.devices.length, 1);
  });

  await check('Ungültige/zyklische Aliasziele sperren Import; keine unendliche Rekursion', () => {
    const objects = clone(data.objects);
    objects['fixture.0.motion.actual'].common.alias = { id: 'alias.0.loop' };
    objects['alias.0.loop'] = makeObject('alias.0.loop', 'boolean', 'sensor.motion', { alias: { id: 'fixture.0.motion.actual' } });
    assert.equal(helper.enrichSmartHomeImportSuggestion(motion, objects, cfg).importable, false);
    objects['fixture.0.motion.actual'].common.alias = { id: 'missing.0.target' };
    assert.equal(helper.enrichSmartHomeImportSuggestion(motion, objects, cfg).importable, false);
  });

  await check('Gemeinsame Statuspunkte sind keine Geräteidentität', () => {
    const objects = clone(data.objects);
    objects['fixture.0.second.actual'] = makeObject('fixture.0.second.actual', 'boolean', 'sensor.motion');
    const other = { ...motion, id: 'second', sourceId: 'fixture.0.second.actual', proposal: { ...motion.proposal,
      io: { ...motion.proposal.io, sensor: { readId: 'fixture.0.second.actual' } } },
      states: [...motion.states.filter(row => row.key !== 'ACTUAL'), { id: 'fixture.0.second.actual', key: 'ACTUAL', type: 'boolean', read: true }],
    };
    const rows = [motion, other].map(row => helper.enrichSmartHomeImportSuggestion(row, objects, cfg));
    assert.equal(helper.reconcileSmartHomeImportSuggestions(rows, objects, cfg).length, 2);
  });

  await check('Manuelle Zuordnungen unverändert; Konfigurationsänderung invalidiert Erkennungscache', async () => {
    const existing = { ...motion.proposal, id: 'manual_motion', alias: 'Eigener Name' };
    delete existing.importProvenance;
    const manual = { ...cfg, devices: [existing] }; const before = JSON.stringify(manual);
    harness.setConfig(manual);
    const result = await harness.detect(false);
    const row = result.suggestions.find(item => item.sourceId === motion.sourceId);
    assert.equal(row.alreadyConfigured, true); assert.equal(row.update, null);
    assert.equal(JSON.stringify(manual), before);
    assert.equal(Object.hasOwn(contract.normalizeSmartHomeDevice(existing), 'importProvenance'), false);
    const invalid = contract.normalizeSmartHomeDevice({ ...existing, importProvenance: { provider: 'bad' } });
    assert.equal(Object.hasOwn(invalid, 'importProvenance'), false);
  });

  await check('Quellenänderungen nur als Vorschlag; explizit ausgewählte Felder atomar im Entwurf', () => {
    const current = contract.normalizeSmartHomeDevice({ ...motion.proposal, id: 'stable_id', alias: 'Eigener Name', roomId: 'existing_terrace', behavior: { favorite: true }, customLegacy: 'keep' });
    const installed = { ...cfg, devices: [current], scenes: [{ id: 'scene1', actions: [{ deviceId: 'stable_id', kind: 'switch', value: true }] }], timers: [{ deviceId: 'stable_id', onTime: '09:00' }] };
    const changedObjects = clone(data.objects); changedObjects['fixture.0.motion'].common.name = 'Neuer Quellenname'; changedObjects['fixture.0.motion'].common.color = '#fed';
    const changed = helper.enrichSmartHomeImportSuggestion(motion, changedObjects, installed);
    const before = JSON.stringify(installed);
    const [proposal] = helper.reconcileSmartHomeImportSuggestions([changed], changedObjects, installed);
    assert.equal(JSON.stringify(installed), before);
    const aliasChange = proposal.update.changes.find(change => change.path === 'alias');
    assert.equal(aliasChange.manualOverride, true); assert.equal(aliasChange.current, 'Eigener Name');
    const ui = frontendHarness(installed, [proposal]);
    assert.equal(ui.context.nwApplyTypeDetectedUpdate(proposal.id, ['ui.color']), true);
    assert.equal(ui.state.config.devices[0].alias, 'Eigener Name');
    assert.equal(ui.state.config.devices[0].ui.color, '#ffeedd');
    assert.equal(ui.state.config.devices[0].id, 'stable_id'); assert.equal(ui.state.config.devices[0].behavior.favorite, true);
    assert.equal(ui.state.config.devices[0].customLegacy, 'keep');
    assert.deepEqual(ui.state.config.scenes, installed.scenes); assert.deepEqual(ui.state.config.timers, installed.timers);
    const keep = frontendHarness(installed, [proposal]);
    assert.equal(keep.context.nwApplyTypeDetectedUpdate(proposal.id, []), true);
    assert.equal(keep.state.config.devices[0].ui.color, current.ui.color);
    assert.equal(keep.state.config.devices[0].importProvenance.signature, changed.provenance.signature);
    const conflict = frontendHarness(installed, [proposal]);
    conflict.state.config.devices[0].alias = 'Gerade bearbeitet';
    assert.equal(conflict.context.nwApplyTypeDetectedUpdate(proposal.id, ['ui.color', 'alias']), false);
    assert.equal(conflict.state.config.devices[0].ui.color, current.ui.color); assert.equal(conflict.dirty(), 0);
    assert.equal(conflict.context.nwApplyTypeDetectedUpdate(proposal.id, ['io.sensor.__proto__']), false);
  });

  await check('Zusatzstatus erzeugt keine Schreib-IDs; Herkunft schließt Prototypfelder aus', () => {
    const io = normalized.devices[0].io;
    assert.ok(contract.collectSmartHomeIds(io, 'read').includes('fixture.0.motion.low'));
    assert.deepEqual(contract.collectSmartHomeIds(io, 'write'), []);
    assert.equal(helper.isSmartHomeImportField('io.sensor.__proto__'), false);
    assert.equal(helper.isSmartHomeImportField('id'), false);
    assert.equal(helper.isSmartHomeImportField('behavior.favorite'), false);
    const p = clone(motion.provenance); p.sourceValues['io.sensor.__proto__'] = 'bad'; p.signature += '0';
    assert.equal(helper.normalizeSmartHomeImportProvenance(p), undefined);
    p.signature = motion.provenance.signature;
    assert.equal(Object.hasOwn(helper.normalizeSmartHomeImportProvenance(p).sourceValues, 'io.sensor.__proto__'), false);
  });

  await check('Dynamische Kamera: aktuelle URL, keine unsichere/stale Fallback-URL; Altbestand bleibt', async () => {
    const camera = detected.suggestions.find(row => row.detectorType === 'camera');
    assert.ok(camera); assert.equal(camera.proposal.io.camera.urlStateId, 'fixture.0.camera');
    assert.equal(camera.proposal.io.camera.snapshotUrl, '');
    assert.equal(JSON.stringify(camera).includes('synthetic-only'), false, 'URL-Statewerte gehören nicht in Importmetadaten');
    const config = contract.normalizeSmartHomeConfig({ devices: [
      { id: 'dynamic_camera', type: 'camera', io: { camera: { urlStateId: 'fixture.0.url', snapshotUrl: 'https://example.invalid/old' } } },
      { id: 'legacy_camera', type: 'camera', io: { camera: { snapshotUrl: 'https://example.invalid/static' } } },
    ] });
    const good = await runtime(config, { 'fixture.0.url': state('https://example.invalid/fresh') });
    assert.equal(good[0].io.camera.snapshotUrl, 'https://example.invalid/fresh');
    assert.equal(good[1].io.camera.snapshotUrl, 'https://example.invalid/static');
    for (const url of ['javascript:alert(1)', 'data:image/png;base64,bad', 'https://user:password@example.invalid/', {}, null]) {
      const bad = await runtime(config, { 'fixture.0.url': state(url) });
      assert.equal(bad[0].io.camera.snapshotUrl, ''); assert.notEqual(bad[0].quality.status, 'online');
    }
    config.devices[0].behavior.staleAfterSec = 10;
    const stale = await runtime(config, { 'fixture.0.url': state('https://example.invalid/outdated', { ts: Date.now() - 60000 }) });
    assert.equal(stale[0].io.camera.snapshotUrl, ''); assert.equal(stale[0].quality.status, 'stale');
  });

  await check('Historischer Blindvertrag, stabile ID/Raum/Favorit und zusätzliche Felder', () => {
    const old = contract.normalizeSmartHomeDevice({ id: 'legacy_blind', type: 'blind', roomId: 'r1', behavior: { favorite: true }, customLegacy: { keep: 1 }, io: { cover: { positionId: 'fixture.0.position', positionWriteId: 'fixture.0.target' } } });
    assert.equal(old.io.level.readId, 'fixture.0.position'); assert.equal(old.io.level.writeId, 'fixture.0.target');
    assert.equal(old.id, 'legacy_blind'); assert.equal(old.roomId, 'r1'); assert.equal(old.behavior.favorite, true);
    assert.deepEqual(old.customLegacy, { keep: 1 }); assert.equal(Object.hasOwn(old.io, 'indicators'), false);
    assert.equal(Object.hasOwn(old, 'importProvenance'), false);
  });
}

run().then(() => {
  const reportIndex = process.argv.indexOf('--report');
  const report = {
    schemaVersion: 1, suite: 'smarthome-import-runtime', testedAt: new Date().toISOString(),
    node: process.version, detectorVersion: require('@iobroker/type-detector/package.json').version,
    checks, passed: checks.length, failed: 0,
    boundaries: ['Kanonische TS-Quellen temporär transpiliert', 'Echter Type-Detector, synthetische Objekt-/Stateantworten',
      'Tatsächliche API-Handler-/Zustands-/Entwurfsfunktionen isoliert ausgeführt', 'Keine HTTP/Auth-, Browser-, ioBroker- oder Hardwareintegration'],
    sources: Object.fromEntries(sourcePaths.map(file => [file, crypto.createHash('sha256').update(read(file)).digest('hex')])),
  };
  if (reportIndex >= 0 && process.argv[reportIndex + 1]) {
    const destination = path.resolve(process.argv[reportIndex + 1]);
    fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(`[smarthome-import-runtime] ${checks.length} Prüfgruppen bestanden; kein Hardware-/Integrationstest.`);
}).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(temporary, { recursive: true, force: true }));
