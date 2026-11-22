'use strict';
/** Herstellerfreie Backend-Verträge; tatsächliche Objekt-/Aliasprüfung mit simulierter ioBroker-DB. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const loaded = new Map();
function source(relative) {
  const filename = path.resolve(__dirname, '../src-ts/runtime-executables', relative);
  if (loaded.has(filename)) return loaded.get(filename).exports;
  const mod = { exports: {} }; loaded.set(filename, mod);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const req = (id) => id.startsWith('.') ? source(path.relative(path.resolve(__dirname, '../src-ts/runtime-executables'), path.resolve(path.dirname(filename), `${id}.ts`))) : require(id);
  new Function('require', 'module', 'exports', output)(req, mod, mod.exports);
  return mod.exports;
}
const api = source('lib/dynamic-grid-config-api.ts');
const { dynamicGridDefaults } = source('ems/services/dynamic-grid-config.ts');
const clone = (value) => JSON.parse(JSON.stringify(value));
const measure = (stateId) => ({ stateId, unit: 'W', sign: 1, maxAgeMs: 5000 });
function config() {
  return { schemaVersion: 1, configVersion: 1, maxSkewMs: 1000, points: [
    { id: 'M0', source: 'general', importLimitW: 250000, exportLimitW: 250000, importReserveW: 25000, exportReserveW: 25000 },
    { id: 'M1', source: 'mapped', measurement: measure('meter.local'), importLimitW: 100000, exportLimitW: 0, importReserveW: 0, exportReserveW: 0 },
  ], storages: [{ id: 'freely-mapped', name: 'Freie Batterie', connectionPointId: 'M1', controlPointId: 'M1', dispatchGroupId: 'house', primaryPurpose: 'selfConsumption', authority: 'eos',
    powerMeasurement: measure('ess.actual'), socMeasurement: { stateId: 'ess.soc', scale: 1, maxAgeMs: 5000 },
    maxChargeW: 50000, maxDischargeW: 50000, minSoc: 10, maxSoc: 90, maxDeltaWPerSec: 10000, strategy: { targetGridImportW: 50, importThresholdW: 20 },
    command: { mode: 'signedTarget', signedTarget: { stateId: 'ess.target', scale: 1, sign: 1 } }, configuredToleranceW: 100, commandTimeoutMs: 5000 }], pvAssignments: [] };
}
function adapter() {
  const objects = new Map(['meter.root', 'meter.local', 'ess.actual', 'ess.soc', 'ess.target'].map((id) => [id, { type: 'state', common: { type: 'number', read: true, write: id === 'ess.target', unit: id === 'ess.soc' ? '%' : 'W' } }]));
  return { config: { datapoints: { gridPointPower: 'meter.root' }, emsApps: { schemaVersion: 1, apps: { dynamicGrid: { installed: false, enabled: false } } } }, objects,
    getForeignObjectAsync: async (id) => objects.get(id) || null, _nwLicenseMaxStorages: () => 2,
    nwApplyInstallerPatchToRuntimeConfig: (base, patch) => ({ ...base, ...patch }) };
}
function activeRoot(a, raw = config()) { return { ...a.config, dynamicGridConnection: raw, emsApps: { schemaVersion: 1, apps: { dynamicGrid: { installed: true, enabled: true } } } }; }

test('unvollständiger Entwurf bleibt speicherbar, Aktivierung meldet konkrete fehlende Verträge', async () => {
  const a = adapter(); a.config.datapoints = {};
  const draft = await api.prepareDynamicGridChange(a, dynamicGridDefaults(), 1, { installed: true, enabled: false });
  assert.equal(draft.config.configVersion, 2); assert.equal(draft.app.active, false); assert.equal(draft.validation.valid, true); assert.ok(draft.validation.activationErrors.length > 0);
  await assert.rejects(api.prepareDynamicGridChange(a, dynamicGridDefaults(), 1, { installed: true, enabled: true }), { code: 'DYNAMIC_GRID_CONFIG_INVALID', status: 422 });
});

test('freie herstellerunabhängige Speicherzuordnung ist ohne Bestandsinventar aktivierbar', async () => {
  const a = adapter(); const prepared = await api.prepareDynamicGridChange(a, config(), 1, { installed: true, enabled: true });
  assert.equal(prepared.validation.valid, true, JSON.stringify(prepared.validation.errors));
  assert.equal(prepared.app.active, true); assert.equal(prepared.config.storages[0].id, 'freely-mapped');
  assert.equal(prepared.validation.generalMeasurement.stateId, 'meter.root'); assert.equal(prepared.validation.generalMeasurement.unit, 'W');
  assert.equal(a.config.dynamicGridConnection, undefined, 'Vorbereitung persistiert/aktiviert nicht vorzeitig.');
});

test('M0 bleibt Allgemein, kW und Vorzeichen kommen aus serverseitiger Quelle', async () => {
  const a = adapter(); a.objects.get('meter.root').common.unit = 'kW'; a.config.settings = { flowInvertGrid: true };
  const validation = await api.validateDynamicGridCandidate(a, config(), a.config, true);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors)); assert.equal(validation.generalMeasurement.unit, 'kW'); assert.equal(validation.generalMeasurement.sign, -1);
  const spoofed = config(); spoofed.points[0].measurement = measure('ess.actual');
  assert.equal((await api.validateDynamicGridCandidate(a, spoofed, a.config, false)).valid, false);
});

test('vollständiges Allgemein-Splitpaar wird übernommen; gleiche physische M0/M1-Quelle wird abgewiesen', async () => {
  const a = adapter(); a.config.datapoints = { gridBuyPower: 'meter.root', gridSellPower: 'meter.sell' };
  a.objects.set('meter.sell', { type: 'state', common: { type: 'number', unit: 'W', read: true } });
  const valid = await api.validateDynamicGridCandidate(a, config(), a.config, true);
  assert.equal(valid.valid, true, JSON.stringify(valid.errors)); assert.equal(valid.generalMeasurement.kind, 'split');
  const same = config(); same.points[1].measurement.stateId = 'alias.local';
  a.objects.set('alias.local', { type: 'state', common: { type: 'number', unit: 'W', read: true, alias: { id: 'meter.root' } } });
  const invalid = await api.validateDynamicGridCandidate(a, same, a.config, true);
  assert.equal(invalid.valid, false); assert.ok(invalid.errors.some((error) => error.code === 'duplicate-source'));
});

test('getrennte Alias-Lese-/Schreibquellen liefern richtige physische Ownership-Kette', async () => {
  const a = adapter(); const cfg = config(); cfg.storages[0].command.signedTarget.stateId = 'alias.target';
  a.objects.set('alias.target', { type: 'state', common: { type: 'number', unit: 'W', read: true, write: true, alias: { id: { read: 'ess.actual', write: 'ess.target' } } } });
  const result = await api.validateDynamicGridCandidate(a, cfg, a.config, true);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.deepEqual(a._nwDynamicGridCanonicalTargets['alias.target'], ['alias.target', 'ess.target']);
  assert.equal(result.config.storages[0].command.signedTarget.resolvedWriteId, 'ess.target');
});

test('zwei Aliasnamen auf demselben Ausgang erzeugen keinen zweiten Writer', async () => {
  const a = adapter(); const cfg = config(); const second = clone(cfg.storages[0]);
  second.id = 'second'; second.powerMeasurement.stateId = 'ess.second'; second.command.signedTarget.stateId = 'alias.same'; cfg.storages.push(second);
  a.objects.set('ess.second', { type: 'state', common: { type: 'number', unit: 'W', read: true } });
  a.objects.set('alias.same', { type: 'state', common: { type: 'number', unit: 'W', read: true, write: true, alias: { id: 'ess.target' } } });
  const result = await api.validateDynamicGridCandidate(a, cfg, a.config, true);
  assert.equal(result.valid, false); assert.ok(result.errors.some((error) => error.code === 'duplicate-output'));
});

test('falsche Ausgangsrechte, Datentypen und Einheiten verhindern Aktivierung, nicht Entwurf', async () => {
  for (const change of [(a) => { a.objects.get('ess.target').common.write = false; }, (a) => { a.objects.get('ess.target').common.type = 'boolean'; }, (a) => { a.objects.get('ess.actual').common.unit = 'kW'; }, (a) => { a.objects.get('ess.actual').common.unit = '%'; }, (a) => { a.objects.get('ess.actual').common.unit = 'V'; }]) {
    const a = adapter(); change(a);
    const draft = await api.validateDynamicGridCandidate(a, config(), a.config, false);
    assert.equal(draft.valid, true); assert.equal(draft.activeEligible, false);
    assert.equal((await api.validateDynamicGridCandidate(a, config(), a.config, true)).valid, false);
  }
});

test('CAS gilt für eigene App-Saves sowie Allgemein-Änderungen und reine App-Schalter', async () => {
  const a = adapter(); a.config.dynamicGridConnection = config();
  await assert.rejects(api.prepareDynamicGridChange(a, config(), 0, { installed: true, enabled: false }), { code: 'DYNAMIC_GRID_VERSION_CONFLICT' });
  a.objects.set('meter.changed', { type: 'state', common: { type: 'number', unit: 'W', read: true } });
  const next = { dynamicGridConnection: clone(config()), datapoints: { gridPointPower: 'meter.changed' } };
  await api.prepareDynamicGridInstallerPatch(a, next, { datapoints: next.datapoints }, 1);
  assert.equal(next.dynamicGridConnection.configVersion, 2);
  const stale = { dynamicGridConnection: clone(config()), datapoints: { gridPointPower: 'meter.changed' } };
  await assert.rejects(api.prepareDynamicGridInstallerPatch(a, stale, { datapoints: stale.datapoints }, 0), { code: 'DYNAMIC_GRID_VERSION_CONFLICT' });
  await assert.rejects(api.assertDynamicGridPersistence(a, stale), { code: 'DYNAMIC_GRID_VERSION_CONFLICT' });
});

test('lesende CAS-Version stimmt für fehlende und ältere Entwürfe mit der Schreibgrenze überein', async () => {
  for (const version of [undefined, 0, -1, 1.5, '7', null, Number.MAX_SAFE_INTEGER + 1]) {
    const a = adapter();
    a.config.dynamicGridConnection = { ...config(), configVersion: version };
    if (version === undefined) delete a.config.dynamicGridConnection.configVersion;
    const before = JSON.stringify(a.config);
    const read = api.currentDynamicGridConfig(a);
    assert.equal(read.configVersion, 1);
    assert.equal(JSON.stringify(a.config), before, 'GET normalisiert nur seine Kopie.');
    await assert.rejects(api.prepareDynamicGridChange(a, read, undefined), { code: 'DYNAMIC_GRID_VERSION_CONFLICT' });
    assert.equal((await api.prepareDynamicGridChange(a, read, 1)).config.configVersion, 2);
  }
  const a = adapter();
  assert.equal(api.currentDynamicGridConfig(a).configVersion, 1);
  assert.equal(a.config.dynamicGridConnection, undefined);
  a.config.dynamicGridConnection = { ...config(), configVersion: 7 };
  assert.equal(api.currentDynamicGridConfig(a).configVersion, 7);
  await assert.rejects(api.prepareDynamicGridChange(a, config(), 1), { code: 'DYNAMIC_GRID_VERSION_CONFLICT' });
});

test('alte Allgemein-Konfiguration benötigt ohne neue App keinen impliziten Appvertrag', async () => {
  const a = adapter(); const next = { ...a.config, datapoints: { gridPointPower: 'meter.local' } };
  assert.equal(await api.assertDynamicGridPersistence(a, next), null);
});

test('kontrollierte Deaktivierung bleibt bis zur positiven Runtime-Übergabe ausstehend', async () => {
  const a = adapter(); a.config = activeRoot(a); let cancels = 0;
  a._nwCancelDynamicGridTransition = () => { cancels++; };
  a._nwPrepareDynamicGridTransition = async () => ({ ok: false, status: 'handover_pending', reason: 'actual-power-unconfirmed' });
  const next = { ...a.config, dynamicGridConnection: { ...config(), configVersion: 2 }, emsApps: { apps: { dynamicGrid: { installed: true, enabled: false } } } };
  await assert.rejects(api.assertDynamicGridPersistence(a, next), { code: 'DYNAMIC_GRID_HANDOVER_PENDING' });
  assert.equal(cancels, 0); assert.equal(a.config.emsApps.apps.dynamicGrid.enabled, true);
  a._nwPrepareDynamicGridTransition = async () => ({ ok: true });
  assert.equal((await api.assertDynamicGridPersistence(a, next)).changed, true);
});

test('Status einer früheren Version wird ohne alte Messungen als pending dargestellt', () => {
  const a = adapter(); a.config = activeRoot(a, { ...config(), configVersion: 2 });
  a._nwDynamicGridStatus = { active: true, configVersion: 1, snapshot: { oldMeasurement: 999 } };
  const status = api.dynamicGridCurrentStatus(a); assert.equal(status.status, 'pending'); assert.equal(status.timestamp, null); assert.equal(status.measurements, null); assert.equal(status.snapshot, undefined);
});

test('jede neue API-Route besitzt die Installer-Middleware und keinen HTTP-Cache', async () => {
  const a = adapter(), routes = new Map(), middleware = () => {};
  api.registerDynamicGridApi({ get: (url, ...handlers) => routes.set(`GET ${url}`, handlers), post: (url, ...handlers) => routes.set(`POST ${url}`, handlers) }, a, middleware, { beginSave: () => null });
  assert.equal(routes.size, 4);
  for (const handlers of routes.values()) assert.equal(handlers[0], middleware);
  const headers = {}; let payload;
  await routes.get('GET /api/dynamic-grid')[1]({}, { setHeader: (key, value) => { headers[key] = value; }, json: (value) => { payload = value; } });
  assert.equal(headers['Cache-Control'], 'no-store'); assert.equal(payload.app.active, false); assert.equal(payload.rootSource.measurement.stateId, 'meter.root');
});


test('alter oder zukünftiger aktiver Status wird nicht als aktuelle erfolgreiche Regelung ausgegeben', () => {
  for (const ts of [Date.now() - 60000, Date.now() + 60000, undefined]) {
    const a = adapter(); a.config = activeRoot(a);
    a._nwDynamicGridStatus = { active: true, configVersion: 1, ts, status: 'active', applied: true, snapshot: { valid: true }, budget: { safe: true } };
    const status = api.dynamicGridCurrentStatus(a);
    assert.equal(status.status, 'stale'); assert.equal(status.stale, true); assert.equal(status.applied, false);
    assert.equal(status.snapshot, null); assert.equal(status.budget, null);
  }
});

test('aktive bestehende PV-Stellstrecke muss vor Übernahme zugeordnet werden', async () => {
  const a = adapter(); a.config.gridConstraints = { zeroExportEnabled: true, pvCurtailMode: 'pvLimitW', pvLimitWId: 'pv.limit' };
  a.objects.set('pv.limit', { type: 'state', common: { type: 'number', read: true, write: true, unit: 'W' } });
  const draft = await api.validateDynamicGridCandidate(a, config(), a.config, false);
  assert.equal(draft.valid, true); assert.ok(draft.activationErrors.some((issue) => issue.code === 'legacy-pv-assignment-required'));
  const activation = await api.validateDynamicGridCandidate(a, config(), a.config, true);
  assert.equal(activation.valid, false); assert.ok(activation.errors.some((issue) => issue.code === 'legacy-pv-assignment-required'));
});

test('vorhandenes Speicherlizenzlimit zählt freie App-Zuordnungen ohne Inventarabhängigkeit', async () => {
  const a = adapter(); a._nwLicenseMaxStorages = () => 0;
  const draft = await api.validateDynamicGridCandidate(a, config(), a.config, false);
  assert.equal(draft.valid, true); assert.ok(draft.activationErrors.some((issue) => issue.code === 'STORAGE_COUNT_LICENSE_LIMIT'));
  assert.equal((await api.validateDynamicGridCandidate(a, config(), a.config, true)).valid, false);
});
