'use strict';
/**
 * NexoWatt: unabhängiger aktiver Integrationstest mit echten TS-Modulen,
 * DatapointRegistry, Writer, Arbiter, Objektvalidierung und SafetyEnvelope.
 * Nur das ioBroker-Gerät ist simuliert: Befehlsecho und gemessene Istwirkung
 * werden ausdrücklich in getrennten Schritten geliefert. Keine Hardwareabnahme.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, filename);
const prefix = '../src-ts/runtime-executables';
const { DynamicGridConnectionModule } = require(`${prefix}/ems/modules/dynamic-grid-connection`);
const { dynamicGridDefaults } = require(`${prefix}/ems/services/dynamic-grid-config`);
const { validateDynamicGridCandidate, assertDynamicGridPersistence } = require(`${prefix}/lib/dynamic-grid-config-api`);
const { installActuatorShadowArbiter, withActuatorShadowContext } = require(`${prefix}/ems/services/actuator-shadow-arbiter`);
const { isDynamicGridOwned } = require(`${prefix}/ems/services/dynamic-grid-ownership`);
const { beginSafetyCycle, markSafetyModuleResult } = require(`${prefix}/ems/services/safety-envelope`);
const { beginAcceptedPowerEffectCycle } = require(`${prefix}/ems/services/accepted-power-effects`);
const clone = value => JSON.parse(JSON.stringify(value));
const measure = stateId => ({ stateId, unit: 'W', sign: 1, maxAgeMs: 5000 });
function storage(id, point, extra = {}) {
  return { id, connectionPointId: point, controlPointId: point, dispatchGroupId: id,
    primaryPurpose: 'selfConsumption', authority: 'eos', powerMeasurement: measure(`free.${id}.power`),
    socMeasurement: { stateId: `free.${id}.soc`, scale: 1, maxAgeMs: 5000 },
    maxChargeW: 10000, maxDischargeW: 10000, minSoc: 10, maxSoc: 90, maxDeltaWPerSec: 10000,
    configuredToleranceW: 10, strategy: { targetGridImportW: 50, importThresholdW: 20 },
    command: { mode: 'signedTarget', signedTarget: { stateId: `free.${id}.target`, scale: 1, sign: 1 } }, ...extra };
}

/** Vollständige ioBroker-Grenze; kein Policy-, Solver-, Registry- oder Writerstub. */
async function plant(t, options = {}) {
  const clock = { now: 1800000000000 };
  t.mock.method(Date, 'now', () => clock.now);
  const raw = dynamicGridDefaults();
  Object.assign(raw.points[0], { importLimitW: 100000, exportLimitW: 100000 });
  Object.assign(raw.points[1], { measurement: measure('meter.branch'), importLimitW: 100000, exportLimitW: options.localExportW ?? 0 });
  raw.storages = options.rows || [storage('inside', 'M1'), storage('outside', 'M0')];
  const states = {}, objects = {}, writes = [], statusStates = {};
  const loads = { rootW: options.rootLoadW ?? 10000, innerW: options.innerLoadW ?? 6000 };
  const actual = Object.fromEntries(raw.storages.map(row => [row.id, 0]));
  const adapter = {
    namespace: 'nexowatt-ui.0', states, writes,
    config: { emsApps: { apps: { dynamicGrid: { installed: true, enabled: true } } }, dynamicGridConnection: raw,
      datapoints: { gridPointPower: 'meter.site' }, installerConfig: { gridConnectionPower: 100000, para14a: options.paraCapW !== undefined },
      diagnostics: { actuatorArbiterMode: 'shadow' } },
    _nwLicenseInfo: { ok: true, edition: options.edition || 'eos' }, _nwLicenseMaxStorages: () => 10,
    log: { warn() {}, debug() {}, info() {} },
    getForeignObjectAsync: async id => objects[id] || null,
    getForeignStateAsync: async id => states[id] || null,
    getForeignStatesAsync: async ids => Object.fromEntries(ids.map(id => [id, states[id] || null])),
    setForeignStateAsync: async (id, value, ack = false) => {
      const val = value && typeof value === 'object' && 'val' in value ? value.val : value;
      writes.push({ id, val, ack, ts: clock.now });
      // ACK bestätigt ausschließlich den Geräte-Sollwert, nie Speicherleistung.
      states[id] = { val, ack: true, q: 0, ts: clock.now };
      if (adapter.afterHardwareWrite) await adapter.afterHardwareWrite(id, val);
      return { ok: true };
    },
    setObjectNotExistsAsync: async () => {},
    setStateAsync: async (id, state) => { statusStates[id] = state; },
  };
  if (options.meshLimits) adapter._meshCoordinator = { currentLimits: () => ({ required: true, limits: options.meshLimits }) };
  const addObject = (id, write = false, unit = 'W') => { objects[id] = { type: 'state', common: { type: 'number', read: true, write, unit }, native: {} }; };
  addObject('meter.site'); addObject('meter.branch');
  for (const row of raw.storages) {
    addObject(row.powerMeasurement.stateId); addObject(row.socMeasurement.stateId, false, '%');
    for (const mapping of Object.values(row.command)) if (mapping && typeof mapping === 'object' && mapping.stateId) addObject(mapping.stateId, true);
  }
  objects['alias.free-target'] = { type: 'state', common: { type: 'number', read: true, write: true, alias: { id: { read: 'free.inside.power', write: 'free.inside.target' } } } };
  adapter._nwValidateDynamicGridConfig = (candidate, root) => validateDynamicGridCandidate(adapter, candidate, root, true);
  const dp = { getEntry: key => /^ps\.l[123]A$/.test(key) ? { objectId: key } : null,
    getRaw: () => 0, getMeasurementAgeMs: () => 0, getConnectionStatus: () => true };
  installActuatorShadowArbiter(adapter);
  const runtime = new DynamicGridConnectionModule(adapter, dp);
  let generation = 0;
  function measurePlant(ageMs = 1000) {
    const ts = clock.now - ageMs;
    for (const row of raw.storages) {
      states[row.powerMeasurement.stateId] = { val: actual[row.id], ack: true, q: 0, ts };
      states[row.socMeasurement.stateId] = { val: options.socPct ?? 50, ack: true, q: 0, ts };
    }
    const innerPower = raw.storages.filter(row => row.connectionPointId === 'M1').reduce((n, row) => n + actual[row.id], 0);
    const totalPower = Object.values(actual).reduce((n, value) => n + value, 0);
    states['meter.site'] = { val: loads.rootW - totalPower, ack: true, q: 0, ts };
    states['meter.branch'] = { val: loads.innerW - innerPower, ack: true, q: 0, ts };
    adapter._nvpFreshnessSnapshot = { ts, usable: true, netW: states['meter.site'].val, connected: true, status: 'ok' };
  }
  function beginCycle() {
    generation++;
    beginSafetyCycle(adapter, generation, clock.now);
    beginAcceptedPowerEffectCycle(adapter, generation, clock.now);
    adapter._emsCaps = { grid: { gridImportLimitW_effective: 100000, gridImportLimitW_physical: 100000, gridSafetyMarginW: 0 } };
    if (options.paraCapW !== undefined) {
      adapter._para14a = { active: true, signalFresh: true, signalStale: false, totalCapW: options.paraCapW, appCapsW: { storage: options.paraCapW } };
      markSafetyModuleResult(adapter, 'para14a', true, '', generation, clock.now);
    }
    if (raw.storages.some(row => row.primaryPurpose === 'tariff')) adapter._tarifVis = { ts: clock.now, tarifAktiv: true, currentPriceFresh: true, state: 'guenstig', prioritaet: 1, netFeeEnabled: false, storageWriterAvailable: false };
  }
  async function tick() { beginCycle(); await runtime.tick(); }
  function applyTargets() {
    for (const row of raw.storages) {
      const target = states[row.command.signedTarget?.stateId];
      if (target?.ack === true) actual[row.id] = target.val * row.command.signedTarget.scale * row.command.signedTarget.sign;
    }
    clock.now += 1000; measurePlant(0);
  }
  measurePlant();
  const validation = await adapter._nwValidateDynamicGridConfig(raw, adapter.config);
  assert.equal(validation.valid, true, JSON.stringify(validation.errors));
  return { adapter, runtime, raw, writes, states, actual, loads, clock, statusStates, measurePlant, beginCycle, tick, applyTargets };
}
const commandWrites = p => p.writes.filter(write => write.id.endsWith('.target'));
const lastTarget = (p, id) => p.states[`free.${id}.target`]?.val;


test('E2E: Erststart schreibt echte M1-Korrektur; ACK bleibt getrennt, Messantwort ermöglicht Folgetakt und M0-Gerät', async t => {
  const p = await plant(t);
  assert.equal(p.runtime.config, null);
  await p.tick();
  assert.ok(commandWrites(p).some(write => write.id === 'free.inside.target' && write.val > 0), JSON.stringify(p.adapter._nwDynamicGridStatus));
  assert.equal(p.actual.inside, 0);
  assert.equal(p.runtime.pending.inside.appliedConfirmed, false);
  assert.equal(p.runtime.pending.inside.minPowerW, -10000);
  assert.equal(p.runtime.pending.inside.maxPowerW, 10000);
  assert.ok(p.adapter._emsSafetyEnvelope.valid, JSON.stringify(p.adapter._emsSafetyEnvelope.invalidReasons));
  const firstCount = commandWrites(p).length;
  p.applyTargets();
  assert.ok(p.states['meter.branch'].val >= 0 && p.states['meter.branch'].val <= 100);
  await p.tick();
  assert.ok(commandWrites(p).length > firstCount);
  // M0 wird erst nach Abbau der lokalen Altunsicherheit aktiviert. Sein erster
  // 0-W-Vertrag setzt den individuellen Rampenanker; danach folgt der Bedarf.
  assert.equal(lastTarget(p, 'outside'), 0);
  assert.equal(p.runtime.pending.inside.appliedConfirmed, true);
  p.applyTargets();
  await p.tick();
  assert.ok(lastTarget(p, 'outside') > 0, JSON.stringify(p.adapter._nwDynamicGridStatus));
  p.applyTargets();
  assert.ok(Math.abs(p.states['meter.site'].val - 50) <= 50);
  assert.ok(Math.abs(p.states['meter.branch'].val - 50) <= 50);
});

test('E2E: M0-Ausgleich ersetzt niemals die reale Aufnahme bei lokalem M1-Export', async t => {
  const p = await plant(t, { rootLoadW: 0, innerLoadW: -5000 });
  await p.tick();
  assert.ok(lastTarget(p, 'inside') <= -5000, JSON.stringify(p.adapter._nwDynamicGridStatus));
  assert.equal(p.actual.inside, 0);
  assert.equal(p.states['meter.site'].val, 0);
  assert.equal(p.states['meter.branch'].val, -5000);
  p.applyTargets();
  assert.ok(p.states['meter.branch'].val >= 0);
  assert.ok(p.adapter._nwDynamicGridStatus.budget.baselinePoints.some(point => point.id === 'M1' && point.exportViolationW > 0));
});

test('E2E: Altregler und freier Alias schreiben weder vor Ersttick noch nach aktiver Übernahme', async t => {
  const p = await plant(t);
  for (const beforeFirstTick of [true, false]) {
    if (!beforeFirstTick) await p.tick();
    const count = p.writes.length;
    const direct = await withActuatorShadowContext(p.adapter, { owner: 'storage' }, () => p.adapter.setForeignStateAsync('free.inside.target', 9999, false));
    const alias = await withActuatorShadowContext(p.adapter, { owner: 'manual.api' }, () => p.adapter.setForeignStateAsync('alias.free-target', 9999, false));
    assert.equal(direct.__nexowattActuatorAuthorityBlocked, true);
    assert.equal(alias.__nexowattActuatorAuthorityBlocked, true);
    assert.equal(p.writes.length, count);
  }
});

test('E2E: Konfigurationsgeneration während erstem Hardwarewrite verhindert alle Folgeausgänge', { timeout: 5000 }, async t => {
  const rows = [storage('inside', 'M1', { command: { mode: 'splitTarget', chargeTarget: { stateId: 'free.inside.charge', scale: 1, sign: 1 }, dischargeTarget: { stateId: 'free.inside.discharge', scale: 1, sign: 1 } } }), storage('outside', 'M0')];
  const p = await plant(t, { rows });
  let release, reached;
  const blocked = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { reached = resolve; });
  p.adapter.afterHardwareWrite = async () => { reached(); await blocked; };
  const running = p.tick();
  await started;
  p.raw.configVersion++;
  release();
  await running;
  assert.equal(p.writes.length, 1);
  assert.deepEqual(p.writes.map(write => write.id), ['free.inside.charge']);
  assert.equal(p.adapter._nwDynamicGridConnectionRuntime.isCurrent(), false);
});

test('E2E: §14a begrenzt zwei Tarifgruppen gemeinsam vor realer Geräteausgabe', async t => {
  const rows = [storage('inside', 'M1', { primaryPurpose: 'tariff' }), storage('outside', 'M0', { primaryPurpose: 'tariff' })];
  const p = await plant(t, { rows, localExportW: 100000, rootLoadW: 0, innerLoadW: 0, paraCapW: 4200 });
  await p.tick();
  const targets = ['inside', 'outside'].map(id => lastTarget(p, id));
  assert.ok(targets.every(value => typeof value === 'number' && value < 0), JSON.stringify(p.adapter._nwDynamicGridStatus));
  assert.ok(-targets.reduce((sum, value) => sum + value, 0) <= 4200);
  assert.equal(p.adapter._nwDynamicGridStatus.hardLimits.chargeW, 4200);
  assert.equal(p.adapter._emsSafetyEnvelope.para14a.active, true);
});

test('E2E: zwischen Gerätewrites ungültiges §14a-Signal sperrt weiteren Ladebefehl', async t => {
  const rows = [storage('inside', 'M1', { primaryPurpose: 'tariff' }), storage('outside', 'M0', { primaryPurpose: 'tariff' })];
  const p = await plant(t, { rows, localExportW: 100000, rootLoadW: 0, innerLoadW: 0, paraCapW: 4200 });
  p.adapter.afterHardwareWrite = async () => { p.adapter._para14a.signalFresh = false; p.adapter._para14a.signalStale = true; };
  await p.tick();
  assert.equal(commandWrites(p).length, 1);
  assert.equal(lastTarget(p, 'outside'), undefined);
  assert.equal(p.adapter._emsSafetyEnvelope.valid, false);
  assert.ok(p.runtime.pending.inside.minPowerW <= -10000);
});

test('E2E: API-Übergabe vor Ersttick wartet auf gemessene Nullleistung und gibt alte Hoheit erst danach frei', async t => {
  const p = await plant(t);
  const next = clone(p.adapter.config);
  next.emsApps.apps.dynamicGrid.enabled = false;
  next.dynamicGridConnection.configVersion++;
  p.beginCycle();
  await assert.rejects(assertDynamicGridPersistence(p.adapter, next), error => error.code === 'DYNAMIC_GRID_HANDOVER_PENDING');
  assert.ok(p.writes.length > 0);
  assert.equal(isDynamicGridOwned(p.adapter, 'free.inside.target'), true);
  p.applyTargets();
  p.beginCycle();
  await assert.rejects(assertDynamicGridPersistence(p.adapter, next), error => error.code === 'DYNAMIC_GRID_HANDOVER_PENDING');
  assert.equal(isDynamicGridOwned(p.adapter, 'free.outside.target'), true);
  p.applyTargets();
  p.beginCycle();
  const transition = await assertDynamicGridPersistence(p.adapter, next);
  assert.equal(transition.changed, true);
  p.adapter.config = next;
  p.adapter._nwCommitDynamicGridConfig();
  await p.runtime.tick();
  assert.equal(p.adapter._nwDynamicGridConnectionRuntime.active, false);
  assert.equal(isDynamicGridOwned(p.adapter, 'free.inside.target'), false);
  const count = p.writes.length;
  await withActuatorShadowContext(p.adapter, { owner: 'storage' }, () => p.adapter.setForeignStateAsync('free.inside.target', 0, false));
  assert.equal(p.writes.length, count + 1);
});


test('E2E: Home-Lizenz begrenzt die reale Summe zweier frei zugeordneter Speicher auf 50 kW', async t => {
  const rows = ['inside', 'outside'].map((id, index) => storage(id, index === 0 ? 'M1' : 'M0', {
    primaryPurpose: 'tariff', maxChargeW: 50000, maxDischargeW: 50000, maxDeltaWPerSec: 100000,
  }));
  const p = await plant(t, { rows, edition: 'hems', localExportW: 100000, rootLoadW: 0, innerLoadW: 0 });
  await p.tick();
  assert.equal(commandWrites(p).length, 2, JSON.stringify(p.adapter._nwDynamicGridStatus));
  const chargeW = -['inside', 'outside'].reduce((sum, id) => sum + lastTarget(p, id), 0);
  assert.equal(chargeW, 50000);
  assert.equal(p.adapter._nwDynamicGridStatus.hardLimits.chargeW, 50000);
});

test('E2E: Mesh-Ladekategorie wird gemeinsam eingehalten, nachträgliche Absenkung stoppt Folgewrite', async t => {
  const rows = [storage('inside', 'M1', { primaryPurpose: 'tariff' }), storage('outside', 'M0', { primaryPurpose: 'tariff' })];
  const meshLimits = { importW: 100000, exportW: 100000, chargeW: 4000, dischargeW: 6000, l1A: 100, l2A: 100, l3A: 100, evW: 0, flexW: 0 };
  const p = await plant(t, { rows, localExportW: 100000, rootLoadW: 0, innerLoadW: 0, meshLimits });
  await p.tick();
  assert.equal(commandWrites(p).length, 2, JSON.stringify(p.adapter._nwDynamicGridStatus));
  assert.equal(lastTarget(p, 'inside') + lastTarget(p, 'outside'), -4000);
  p.applyTargets();
  // Ein neuer günstiger Auftrag ist vorhanden, aber die Mesh-Freigabe wird
  // nach dem ersten wirklichen Gerätewrite im selben Zyklus zurückgenommen.
  meshLimits.chargeW = 6000;
  const before = commandWrites(p).length;
  p.adapter.afterHardwareWrite = async () => { meshLimits.chargeW = 0; };
  await p.tick();
  assert.equal(commandWrites(p).length, before + 1);
});
