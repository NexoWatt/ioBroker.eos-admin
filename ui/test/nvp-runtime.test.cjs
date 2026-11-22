'use strict';
// NVP-Diagnose: reale Modulklasse mit ioBroker-Mocks, keine Hardwareprüfung.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NvpTopologyModule, buildTopologyStatus } = require('../ems/modules/nvp-topology');
const { validateTopology, collectSnapshot } = require('../ems/services/nvp-topology');

const measurement = stateId => ({ stateId, unit: 'W', sign: 1, maxAgeMs: 5000 });
function topology() {
  return { schemaVersion: 1, configVersion: 1, mode: 'dynamic', operation: 'diagnostic', rootPointId: 'M0', maxSkewMs: 1000,
    points: [
      { id: 'M0', parentId: null, measurement: measurement('meter.0.root'), importLimitW: 250000, exportLimitW: 250000, importReserveW: 25000, exportReserveW: 25000 },
      { id: 'M1', parentId: 'M0', measurement: measurement('meter.0.local'), importLimitW: 100000, exportLimitW: 100000, importReserveW: 0, exportReserveW: 0 },
    ],
    storages: [
      { id: 'tesvolt', connectionPointId: 'M0', controlPointId: 'M0', dispatchGroupId: 'trade', primaryPurpose: 'externalArbitrage', authority: 'external', powerMeasurement: measurement('ess.0.t'), maxChargeW: 250000, maxDischargeW: 250000, minSoc: 10, maxSoc: 85 },
      { id: 'fenecon', connectionPointId: 'M1', controlPointId: 'M1', dispatchGroupId: 'home', primaryPurpose: 'selfConsumption', authority: 'eos', powerMeasurement: measurement('ess.0.f'), maxChargeW: 100000, maxDischargeW: 100000, minSoc: 10, maxSoc: 90 },
    ], pvAssignments: [] };
}
function states(now = Date.now()) {
  return Object.fromEntries([['meter.0.root', 130000], ['meter.0.local', 30000], ['ess.0.t', -40000], ['ess.0.f', 20000]].map(([id, val]) => [id, { val, ts: now, q: 0 }]));
}
function adapter(raw) {
  const writes = [], reads = [], objects = [];
  return { config: raw ? { nvpTopology: raw } : {}, writes, reads, objects,
    getForeignStatesAsync: async ids => { reads.push(ids); return states(); },
    setForeignStateAsync: async () => { throw Error('Unexpected physical writer'); },
    setObjectNotExistsAsync: async (id, object) => { objects.push({ id, object }); },
    setStateAsync: async (id, state) => { writes.push({ id, state }); },
  };
}
const flush = () => new Promise(resolve => setImmediate(resolve));

test('alte Konfiguration: weder neue Messleseaufträge noch State-/Gerätewrites', async () => {
  const a = adapter(); const m = new NvpTopologyModule(a);
  await m.init(); await m.tick(); await flush();
  assert.equal(a.reads.length, 0); assert.equal(a.writes.length, 0); assert.equal(a.objects.length, 0);
  assert.equal(a._nwNvpTopologyStatus.status, 'static'); m.stop();
});

test('M0 enthält M1 genau einmal; bestehende Konfiguration und globale NVP-Werte unverändert', () => {
  const raw = topology(); const before = JSON.stringify(raw); const now = Date.now();
  const config = validateTopology(raw).config;
  const status = buildTopologyStatus(config, collectSnapshot(config, states(now), now));
  assert.equal(status.budget.residuals.M0.minW, 110000);
  assert.equal(status.budget.residuals.M1.minW, 50000);
  assert.equal(status.writesPerformed, 0); assert.equal(status.isAuthorization, false);
  assert.equal(status.legacyControl, 'unchanged'); assert.equal(JSON.stringify(raw), before);
  assert.equal(status.groups.find(g => g.id === 'trade').proposedW, null);
});

test('Vorschau verändert keine Config, Plannerzustände oder Diagnosestates', async () => {
  const a = adapter(); const m = new NvpTopologyModule(a); const raw = topology();
  const result = await a._nwPreviewNvpTopology(raw);
  assert.equal(result.status, 'diagnostic'); assert.equal(a.writes.length, 0);
  assert.equal(a.config.nvpTopology, undefined); assert.equal(a.reads.length, 1); m.stop();
});

test('dynamische Diagnose schreibt nur eigene schreibgeschützte Statusobjekte', async () => {
  const a = adapter(topology()); const m = new NvpTopologyModule(a);
  await m.tick(); await flush(); await flush();
  assert.equal(a._nwNvpTopologyStatus.status, 'diagnostic');
  assert.ok(a.writes.length > 0); assert.ok(a.writes.every(w => w.id.startsWith('nvpTopology.')));
  assert.ok(a.objects.filter(o => o.object.type === 'state').every(o => o.object.common.write === false)); m.stop();
});

test('alte asynchrone Diagnose wird nach Konfigurationswechsel verworfen', async () => {
  const a = adapter(topology()); let finish;
  a.getForeignStatesAsync = () => new Promise(resolve => { finish = resolve; });
  const m = new NvpTopologyModule(a); await m.tick(); await flush();
  a.config.nvpTopology = { mode: 'static' }; finish(states()); await flush(); await flush();
  assert.equal(a.writes.length, 0); await m.tick(); assert.equal(a._nwNvpTopologyStatus.status, 'static'); m.stop();
});

test('Stop verwirft ausstehende Resultate und entfernt nur eigenen Vorschauhook', async () => {
  const a = adapter(topology()); let finish;
  a.getForeignStatesAsync = () => new Promise(resolve => { finish = resolve; });
  const m = new NvpTopologyModule(a); await m.tick(); await flush(); m.stop(); finish(states());
  await flush(); await flush(); assert.equal(a.writes.length, 0); assert.equal(a._nwPreviewNvpTopology, undefined);
});

test('fehlende und veraltete Messwerte erzeugen kein Nullwertbudget', async () => {
  const a = adapter(); a.getForeignStatesAsync = async () => states(Date.now() - 60000);
  const m = new NvpTopologyModule(a); const result = await m.preview(topology());
  assert.equal(result.status, 'measurement_invalid'); assert.equal(result.budget, null); assert.ok(result.errors.length); m.stop();
});

test('Datenbankfehler wird sichtbar ohne unhandled rejection oder Freigabe', async () => {
  const a = adapter(); a.getForeignStatesAsync = async () => { throw Error('DB unavailable'); };
  const m = new NvpTopologyModule(a); const result = await m.preview(topology());
  assert.equal(result.status, 'measurement_invalid'); assert.ok(result.errors.some(e => e.code === 'measurement_read_failed')); m.stop();
});

test('maximal ein Datenbankauftrag auch bei gleichzeitigem Vorschauabruf', async () => {
  const a = adapter(); let count = 0, finish;
  a.getForeignStatesAsync = () => { count++; return new Promise(resolve => { finish = resolve; }); };
  const m = new NvpTopologyModule(a); const first = m.preview(topology()); await flush();
  const second = await m.preview(topology()); assert.equal(count, 1);
  assert.ok(second.errors.some(e => e.code === 'measurement_read_busy'));
  finish(states()); await first; m.stop();
});

test('Rückkehr statisch aktualisiert vorhandene Diagnoseanzeige', async () => {
  const a = adapter(topology()); const m = new NvpTopologyModule(a);
  await m.tick(); await flush(); await flush();
  a.config.nvpTopology = { mode: 'static' }; await m.tick(); await flush(); await flush();
  const last = a.writes.filter(w => w.id === 'nvpTopology.statusJson').at(-1);
  assert.equal(JSON.parse(last.state.val).mode, 'static'); m.stop();
});

test('manipulierter aktiver Modus eröffnet keinen Gerätewriter', async () => {
  const a = adapter(); const m = new NvpTopologyModule(a); const config = topology(); config.operation = 'active';
  const status = await m.preview(config);
  assert.equal(status.activationSupported, false); assert.equal(status.writesPerformed, 0); assert.equal(a.reads.length, 0); m.stop();
});

test('T13/T15: hypothetische Importüberschreitung wird mit Bereich und Betrag sichtbar', () => {
  const raw = topology(); raw.storages = [];
  const config = validateTopology(raw).config, now = Date.now();
  const sample = states(now); sample['meter.0.root'].val = 260000;
  const status = buildTopologyStatus(config, collectSnapshot(config, sample, now));
  assert.equal(status.status, 'budget_infeasible');
  assert.match(status.reason, /ohne verbindliche Entlastung nicht erfüllbar/);
  assert.equal(status.budget.valid, false); assert.deepEqual(status.budget.grants, []);
  const error = status.errors.find(entry => entry.code === 'NVP_IMPORT_BUDGET_EXCEEDED');
  assert.equal(error.pointId, 'M0'); assert.equal(error.violationW, 35000);
  assert.match(error.message, /M0.*35000 W/);
  assert.equal(status.writesPerformed, 0); assert.equal(status.isAuthorization, false);
});

test('T14/T15: lokale Exportüberschreitung bleibt von erlaubter M0-Einspeisung getrennt', () => {
  const raw = topology(); raw.storages = []; raw.points[1].exportLimitW = 0;
  const config = validateTopology(raw).config, now = Date.now();
  const sample = states(now); sample['meter.0.root'].val = -100000; sample['meter.0.local'].val = -20000;
  const status = buildTopologyStatus(config, collectSnapshot(config, sample, now));
  assert.equal(status.status, 'budget_infeasible');
  assert.equal(status.errors.length, 1);
  assert.equal(status.errors[0].code, 'NVP_EXPORT_BUDGET_EXCEEDED');
  assert.equal(status.errors[0].pointId, 'M1'); assert.equal(status.errors[0].violationW, 20000);
  assert.equal(status.budget.points.find(point => point.id === 'M0').safe, true);
});

test('veraltete Überlastmessung bleibt Messfehler und wird nicht als aktueller Budgetverstoß ausgegeben', () => {
  const raw = topology(); raw.storages = [];
  const config = validateTopology(raw).config, now = Date.now();
  const sample = states(now - 60000); sample['meter.0.root'].val = 260000;
  const status = buildTopologyStatus(config, collectSnapshot(config, sample, now));
  assert.equal(status.status, 'measurement_invalid'); assert.equal(status.budget, null);
  assert.ok(status.errors.every(entry => !entry.code.includes('BUDGET_EXCEEDED')));
});
