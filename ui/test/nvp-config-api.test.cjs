'use strict';
/**
 * NVP-Backend-Vertrag: prüft Aliasidentität, reale Gerätebindung, atomare Versionen,
 * Rollenmiddleware und Diagnose ohne Sollwertschreiben. Keine Hardwareprüfung.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Exakt die maßgeblichen TS-Quellen laden, ohne während paralleler Entwicklung
// globale Runtime-Spiegel zu überschreiben.
const loaded = new Map();
function sourceModule(relative) {
  const filename = path.resolve(__dirname, '../src-ts/runtime-executables', relative);
  if (loaded.has(filename)) return loaded.get(filename).exports;
  const module = { exports: {} }; loaded.set(filename, module);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const localRequire = (id) => id.startsWith('.')
    ? sourceModule(path.relative(path.resolve(__dirname, '../src-ts/runtime-executables'), path.resolve(path.dirname(filename), id + '.ts')))
    : require(id);
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}
const api = sourceModule('lib/nvp-config-api.ts');
const copy = (value) => JSON.parse(JSON.stringify(value));
const measurement = (stateId) => ({ stateId, unit: 'W', sign: 1, maxAgeMs: 3000 });
function topology() {
  return { schemaVersion: 1, configVersion: 1, mode: 'dynamic', operation: 'diagnostic', rootPointId: 'M0', maxSkewMs: 1000,
    points: [{ id: 'M0', name: 'Gesamt', parentId: null, measurement: measurement('meter.root'), importLimitW: 250000, exportLimitW: 250000, importReserveW: 25000, exportReserveW: 25000 },
      { id: 'M1', name: 'Haus', parentId: 'M0', measurement: measurement('meter.local'), importLimitW: 100000, exportLimitW: 0, importReserveW: 10000, exportReserveW: 0 }],
    storages: [{ id: 'storage-farm-0', connectionPointId: 'M1', controlPointId: 'M1', dispatchGroupId: 'house', primaryPurpose: 'selfConsumption', authority: 'eos', powerMeasurement: measurement('ess.power'), maxChargeW: 100000, maxDischargeW: 100000, minSoc: 10, maxSoc: 90 }], pvAssignments: [] };
}
function adapter() {
  const objects = new Map(['meter.root', 'meter.local', 'ess.power', 'ess.other'].map((id) => [id, { type: 'state', common: { read: true } }]));
  const reads = [];
  return { config: { storageFarm: { storages: [{ name: 'Haus', signedPowerId: 'ess.power' }] } }, reads, objects,
    getForeignObjectAsync: async (id) => { reads.push(id); return objects.get(id) || null; } };
}
function response() {
  return { code: 200, payload: null, headers: {}, setHeader(key, val) { this.headers[key] = val; }, status(code) { this.code = code; return this; }, json(payload) { this.payload = payload; return this; } };
}
function routesFor(a, hooks = {}) {
  const routes = new Map();
  const app = { get: (route, ...handlers) => routes.set('GET ' + route, handlers), post: (route, ...handlers) => routes.set('POST ' + route, handlers) };
  const middleware = (_req, res, next) => res.status(403).json({ error: 'forbidden' });
  let saving = null;
  api.registerNvpConfigApi(app, a, middleware, {
    beginSave: () => saving ? null : (saving = {}), endSave: (token) => { if (saving === token) saving = null; },
    commit: async (config) => { a.config.nvpTopology = config; }, ...hooks,
  });
  return { routes, middleware };
}

test('alte Konfiguration bleibt statisch ohne zusätzliche Objektabfragen', async () => {
  const a = adapter();
  const result = await api.validateNvpCandidate(a, undefined);
  assert.equal(result.valid, true); assert.equal(result.config.mode, 'static'); assert.equal(a.reads.length, 0);
  await api.assertNvpPersistence(a, { unrelated: 'changed' });
  assert.equal(a.reads.length, 0);
});

test('M0 und M1 über verschiedene Aliasnamen auf derselben Quelle werden abgewiesen', async () => {
  const a = adapter(); const config = topology();
  a.objects.set('alias.root', { type: 'state', common: { alias: { id: 'meter.root' } } });
  a.objects.set('alias.local', { type: 'state', common: { alias: { id: { read: 'meter.root', write: 'irrelevant' } } } });
  config.points[0].measurement.stateId = 'alias.root'; config.points[1].measurement.stateId = 'alias.local';
  const result = await api.validateNvpCandidate(a, config);
  assert.equal(result.valid, false); assert.ok(result.errors.some((error) => error.code === 'duplicate-source'));
});

test('Aliaszyklus und fehlender Datenpunkt bleiben sichtbar ungültig', async () => {
  const a = adapter(); const config = topology();
  a.objects.set('alias.loop', { type: 'state', common: { alias: { id: 'alias.loop' } } });
  config.points[0].measurement.stateId = 'alias.loop'; config.points[1].measurement.stateId = 'not.present';
  const result = await api.validateNvpCandidate(a, config);
  assert.equal(result.valid, false); assert.ok(result.errors.some((error) => error.code === 'ALIAS_CYCLE_OR_DEPTH'));
  assert.ok(result.errors.some((error) => error.code === 'MEASUREMENT_SOURCE_UNAVAILABLE'));
});

test('Zuordnung zu fremdem Speicher und fremder AC-Istleistung wird abgewiesen', async () => {
  const a = adapter(); const config = topology(); config.storages[0].powerMeasurement.stateId = 'ess.other';
  assert.ok((await api.validateNvpCandidate(a, config)).errors.some((error) => error.code === 'STORAGE_MEASUREMENT_BINDING_MISMATCH'));
  config.storages[0].id = 'imaginary-storage';
  assert.ok((await api.validateNvpCandidate(a, config)).errors.some((error) => error.code === 'UNKNOWN_STORAGE_BINDING'));
});

test('atomare Änderung erhöht Version einmal; alter Browserstand und offene Freigabe blockieren', async () => {
  const a = adapter(); const config = await api.prepareNvpChange(a, topology(), 1);
  assert.equal(config.configVersion, 2); assert.equal(a.config.nvpTopology, undefined);
  a.config.nvpTopology = config;
  await assert.rejects(api.prepareNvpChange(a, topology(), 1), (error) => error.code === 'NVP_CONFIG_VERSION_CONFLICT');
  a._nwNvpTopologyStatus = { outstandingGrants: 1 };
  await assert.rejects(api.prepareNvpChange(a, topology(), 2), (error) => error.code === 'NVP_TRANSITION_NOT_IDLE');
});

test('native oder importierter aktiver Betrieb kann die technische Sperre nicht umgehen', async () => {
  const a = adapter(); const config = topology(); config.operation = 'active';
  config.points.forEach((point) => { point.failurePolicyId = 'project-reviewed'; point.measurement.physicalSourceId = point.id; });
  const result = await api.validateNvpCandidate(a, config);
  assert.equal(result.valid, false); assert.ok(result.errors.some((error) => error.code === 'RUNTIME_SCOPED_DISPATCH_NOT_IMPLEMENTED'));
  a.config.nvpTopology = config;
  assert.equal(api.nvpPublicSnapshot(a).config.operation, 'active');
  assert.equal(api.nvpPublicSnapshot(a).activationSupported, false);
});

test('Persistenzpfad lehnt stille Entfernung und unversionierte Änderung ab', async () => {
  const a = adapter(); const config = await api.prepareNvpChange(a, topology(), 1);
  await api.assertNvpPersistence(a, { ...a.config, nvpTopology: config });
  a.config.nvpTopology = config;
  await assert.rejects(api.assertNvpPersistence(a, { storageFarm: a.config.storageFarm }), (error) => error.code === 'NVP_EXPLICIT_TRANSITION_REQUIRED');
  const changed = copy(config); changed.points[0].importLimitW = 200000;
  await assert.rejects(api.assertNvpPersistence(a, { ...a.config, nvpTopology: changed }), (error) => error.code === 'NVP_EXPLICIT_TRANSITION_REQUIRED');
});

test('Änderung der Bestandsfarm invalidiert die bisherige NVP-Gerätebindung', async () => {
  const a = adapter(); a.config.nvpTopology = await api.prepareNvpChange(a, topology(), 1);
  const next = copy(a.config); next.storageFarm.storages[0].signedPowerId = 'ess.other';
  await assert.rejects(api.assertNvpPersistence(a, next), (error) => error.code === 'NVP_CONFIG_INVALID');
});

test('jede NVP-Route besitzt die Installer-Middleware und no-store', async () => {
  const a = adapter(); const { routes, middleware } = routesFor(a);
  assert.equal(routes.size, 4);
  for (const handlers of routes.values()) assert.equal(handlers[0], middleware);
  const res = response(); routes.get('GET /api/nvp/topology')[1]({}, res);
  assert.equal(res.headers['Cache-Control'], 'no-store'); assert.equal(res.payload.activationSupported, false);
});

test('alte Diagnoseversion wird nach Zuordnungswechsel ohne übernommene Messwerte als ausstehend ausgegeben', () => {
  const a = adapter(); a.config.nvpTopology = { ...topology(), configVersion: 3 };
  a._nwNvpTopologyStatus = { configVersion: 2, mode: 'dynamic', operation: 'diagnostic', status: 'diagnostic', timestamp: 12345,
    measurements: { M0: { valueW: 9000 } }, budget: { grants: [{ minW: -10000, maxW: 10000 }] } };
  const next = api.nvpPublicSnapshot(a).status;
  assert.equal(next.configVersion, 3); assert.equal(next.status, 'pending'); assert.equal(next.timestamp, null);
  assert.equal(next.measurements, null); assert.equal(next.budget, null);
  assert.equal(a._nwNvpTopologyStatus.timestamp, 12345, 'Gespeicherter Altstatus wird nicht mit einem neuen Zeitpunkt versehen.');
  a._nwNvpTopologyStatus = { ...a._nwNvpTopologyStatus, configVersion: 3 };
  assert.equal(api.nvpPublicSnapshot(a).status, a._nwNvpTopologyStatus);
});

test('ungespeicherte Diagnose ruft nur Vorschau auf und verändert keine Konfiguration', async () => {
  const a = adapter(); const before = copy(a.config); let previews = 0;
  a._nwPreviewNvpTopology = async () => { previews += 1; return { simulated: true }; };
  const { routes } = routesFor(a); const res = response();
  await routes.get('POST /api/nvp/topology/diagnose')[1]({ body: { config: topology() } }, res);
  assert.equal(res.code, 200); assert.equal(res.payload.validation.valid, true); assert.equal(res.payload.preview, true);
  assert.equal(previews, 1); assert.deepEqual(a.config, before);
});

test('gleichzeitiger Speicherversuch wird abgewiesen; Version und Konfiguration bleiben atomar', async () => {
  const a = adapter(); let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const { routes } = routesFor(a, { commit: async (config) => { await gate; a.config.nvpTopology = config; } });
  const handler = routes.get('POST /api/nvp/topology/config')[1];
  const firstRes = response(); const first = handler({ body: { config: topology(), expectedConfigVersion: 1 } }, firstRes);
  const secondRes = response(); await handler({ body: { config: topology(), expectedConfigVersion: 1 } }, secondRes);
  assert.equal(secondRes.code, 409); assert.equal(a.config.nvpTopology, undefined);
  release(); await first; assert.equal(firstRes.code, 200); assert.equal(a.config.nvpTopology.configVersion, 2);
});

test('hängende Objektprüfung belegt höchstens vier DB-Aufträge und einen Adapter-Slot', async () => {
  const a = adapter(); let calls = 0; a.getForeignObjectAsync = () => { calls += 1; return new Promise(() => {}); };
  const realTimer = global.setTimeout;
  global.setTimeout = (fn, ms, ...args) => realTimer(fn, ms === 3000 ? 5 : ms, ...args);
  try {
    await assert.rejects(api.validateNvpCandidate(a, topology()), (error) => error.code === 'NVP_VALIDATION_TIMEOUT');
    const count = calls; assert.ok(count <= 4);
    const changed = topology(); changed.points[0].importLimitW += 1;
    await assert.rejects(api.validateNvpCandidate(a, changed), (error) => error.code === 'NVP_VALIDATION_IN_PROGRESS');
    assert.equal(calls, count);
  } finally { global.setTimeout = realTimer; }
});
