'use strict';
// Reale TS-Services mit ioBroker-Mocks; keine Hardware- oder Herstellerprüfung.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const loaded = new Map();
const root = path.resolve(__dirname, '../src-ts/runtime-executables');
function sourceModule(relative) {
  const filename = path.resolve(root, relative);
  if (loaded.has(filename)) return loaded.get(filename).exports;
  const module = { exports: {} }; loaded.set(filename, module);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const localRequire = id => id.startsWith('.') ? sourceModule(path.relative(root, path.resolve(path.dirname(filename), id + '.ts'))) : require(id);
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}
const pv = sourceModule('ems/services/dynamic-grid-pv.ts');
const m = stateId => ({ stateId, unit: 'W', sign: 1, maxAgeMs: 5000 });
const row = (id, point) => ({ id, connectionPointId: point, referencePowerW: 100000, powerMeasurement: m(`${id}.actual`), command: { stateId: `${id}.limit`, unit: 'W', scale: 1 }, evuControl: false });
function config() {
  return { configVersion: 1, mode: 'dynamic', operation: 'active', maxSkewMs: 1000,
    points: [{ id: 'M0', measurement: m('m0'), importLimitW: 250000, exportLimitW: 250000, importReserveW: 25000, exportReserveW: 25000 },
      { id: 'M1', measurement: m('m1'), importLimitW: 100000, exportLimitW: 0, importReserveW: 0, exportReserveW: 0 }],
    storages: [], pvAssignments: [row('outer', 'M0'), row('local', 'M1')] };
}
function states(now, overrides = {}) { return Object.fromEntries(Object.entries({ m0: -100000, m1: -20000, 'outer.actual': 80000, 'local.actual': 40000, ...overrides }).map(([id, val]) => [id, { val, ts: now, q: 0 }])); }
function plan(c, values = {}, options = {}) {
  const now = Date.now(), s = states(now, values);
  return pv.planDynamicPv(c, pv.collectDynamicPvSnapshot(c, s, now), { nowMs: now, pendingIntervals: [], evuLimits: pv.readDynamicEvuLimits(c, {}, s, now), ...options });
}
function adapter(c = config()) {
  const writes = [];
  const a = { config: { dynamicGridConnection: c, emsApps: { apps: { dynamicGrid: { installed: true, enabled: true } } }, gridConstraints: {} }, writes,
    getForeignStatesAsync: async () => states(Date.now()), setStateAsync: async () => {} };
  a._nwDynamicGridConnectionRuntime = { active: true, config: c, generation: 1, isCurrent: () => true, pendingIntervals: [],
    writer: { writePv: async (row, limitW, guard) => { if (!guard()) return { accepted: false, reason: 'fence' }; writes.push({ id: row.id, limitW }); return { accepted: true, applied: false }; } } };
  return a;
}

test('Herstellerfreie freie DP-Zuordnung akzeptiert W/% und getrennte Istleistung', () => {
  const rows = [row('brand-free-a', 'M1'), row('brand-free-b', 'M0')]; rows[1].command.unit = '%'; rows[1].command.scale = 0.1;
  const result = pv.validateDynamicPvAssignments(rows); assert.equal(result.valid, true); assert.equal(result.pvAssignments[1].command.scale, 0.1);
});
test('Fehlerhafte Zahlen, Exportlimit-Einheit und doppelte physische Schreibaliasse gesperrt', () => {
  for (const value of [null, '100000', true, Infinity, -1, 0]) { const r = row('a', 'M0'); r.referencePowerW = value; assert.equal(pv.validateDynamicPvAssignments([r]).valid, false); }
  const a = row('a', 'M0'); a.command.unit = 'feedInLimitW'; assert.equal(pv.validateDynamicPvAssignments([a]).valid, false);
  const result = pv.validateDynamicPvAssignments([row('a', 'M0'), row('b', 'M1')], { resolveWriteId: () => 'same.output' });
  assert.ok(result.errors.some(e => e.code === 'duplicate-pv-output'));
});
test('Inaktive Entwürfe trennen fehlende Felder von ungültigen Werten', () => {
  const draft = row('a', 'M1'); delete draft.command;
  let r = pv.validateDynamicPvAssignments([draft], { active: false }); assert.equal(r.valid, true); assert.equal(r.errors.length, 0); assert.equal(r.activationErrors.length, 1);
  draft.referencePowerW = '100'; r = pv.validateDynamicPvAssignments([draft], { active: false }); assert.equal(r.valid, false);
});
test('Legacy-Übernahme verlangt nur wirklich aktive Zero-Export-Ausgänge; EVU allein bleibt frei', () => {
  const cfg = { zeroExportEnabled: true, pvLimitWId: 'legacy.limit' };
  assert.deepEqual(pv.extractRequiredLegacyDynamicPvIds({ gridConstraints: cfg }), ['legacy.limit']);
  for (const patch of [{ zeroExportEnabled: false }, { exportLimitInstallerApproved: false }, { zeroExportInstallerApproved: false }, { pvCurtailMode: 'off' }]) {
    assert.deepEqual(pv.extractRequiredLegacyDynamicPvIds({ gridConstraints: { ...cfg, ...patch } }), []);
  }
  assert.deepEqual(pv.extractRequiredLegacyDynamicPvIds({ gridConstraints: { ...cfg, exportLimitInstallerApproved: true, zeroExportInstallerApproved: false } }), ['legacy.limit']);
  assert.equal(pv.validateLegacyDynamicPvCoverage({ gridConstraints: { pvEvuEnabled: true, pvCurtailInvertersEvu: [{ pvLimitWId: 'legacy.evu' }] } }, []).valid, true);
});
test('Alle Diagnosealiasse und deren Vorrang entsprechen dem bisherigen Export-Guard', () => {
  const cfg = { zeroExportEnabled: true, pvLimitWId: 'legacy.limit' };
  for (const field of ['exportLimitRunMode', 'zeroExportRunMode', 'exportGuardMode']) for (const mode of ['diagnostic', 'test', 'dryrun', 'dry-run', 'simulation', ' DIAGNOSTIC ']) {
    assert.deepEqual(pv.extractRequiredLegacyDynamicPvIds({ gridConstraints: { ...cfg, [field]: mode } }), []);
  }
  assert.deepEqual(pv.extractRequiredLegacyDynamicPvIds({ gridConstraints: { ...cfg, exportLimitRunMode: 'active', zeroExportRunMode: 'diagnostic' } }), ['legacy.limit']);
});
test('Legacy-Sammelausgang übernimmt nur aufgelösten Modus; aktive WR-Gruppe übernimmt alle tatsächlichen Ausgänge', () => {
  const cfg = { zeroExportEnabled: true, pvLimitWId: 'single.w', pvLimitPctId: 'single.pct' };
  assert.deepEqual(pv.extractRequiredLegacyDynamicPvIds({ gridConstraints: cfg }), ['single.w']);
  assert.deepEqual(pv.extractRequiredLegacyDynamicPvIds({ gridConstraints: { ...cfg, pvCurtailMode: 'pvLimitPct' } }), ['single.pct']);
  cfg.pvCurtailInvertersZero = [{ pvLimitWId: 'group.w', pvLimitPctId: 'group.pct' }, { pvLimitWId: 'group.w' }];
  assert.deepEqual(pv.extractRequiredLegacyDynamicPvIds({ gridConstraints: { ...cfg, pvCurtailMode: 'off' } }), ['group.w', 'group.pct']);
});
test('Aktive Legacy-PV muss physisch vollständig in der eigenen App zugeordnet sein', () => {
  const rootConfig = { gridConstraints: { zeroExportEnabled: true, pvLimitWId: 'alias.old' } };
  let result = pv.validateLegacyDynamicPvCoverage(rootConfig, []); assert.equal(result.valid, false); assert.match(result.errors[0].message, /Dynamischer Netzanschluss.*zuordnen/);
  const r = row('mapped', 'M1'); r.command.stateId = 'alias.new';
  result = pv.validateLegacyDynamicPvCoverage(rootConfig, [r], { resolveWriteId: id => ['alias.old', 'alias.new'].includes(id) ? 'physical.limit' : null }); assert.equal(result.valid, true);
  result = pv.validateLegacyDynamicPvCoverage(rootConfig, [r], { resolveWriteId: () => null }); assert.equal(result.valid, false); assert.equal(result.errors[0].code, 'legacy-pv-output-unresolved');
});
test('Ein bisheriger Exportlimit-Ausgang wird bei Übernahme nicht als Generation-DP umgedeutet', () => {
  const rootConfig = { gridConstraints: { zeroExportEnabled: true, pvFeedInLimitWId: 'export.limit' } };
  const r = row('mapped', 'M1'); r.command.stateId = 'export.limit';
  const result = pv.validateLegacyDynamicPvCoverage(rootConfig, [r]); assert.equal(result.valid, false); assert.equal(result.errors[0].code, 'legacy-pv-export-limit-semantic');
  assert.deepEqual(pv.extractRequiredLegacyDynamicPvIds(rootConfig), ['export.limit']);
});
test('Lokale Nulleinspeisung reduziert nur M1-PV; M0 darf weiter exportieren', () => {
  const result = plan(config()); assert.equal(result.valid, true);
  assert.equal(result.requests.find(r => r.id === 'local').limitW, 20000);
  assert.equal(result.requests.find(r => r.id === 'outer').limitW, 100000);
  assert.equal(result.points.find(r => r.id === 'M0').minimumGridW, -100000);
});
test('M0 gemeinsame Exportgrenze begrenzt beide Erzeuger und erhält die lokale strengere Grenze', () => {
  const c = config(); c.points[0].exportLimitW = 60000; c.points[0].exportReserveW = 10000;
  const result = plan(c); assert.equal(result.valid, true);
  assert.ok(result.requests.reduce((sum, r) => sum + r.limitW, 0) <= 70000);
  assert.ok(result.requests.find(r => r.id === 'local').limitW <= 20000);
});
test('Mesh-PV-Grenze wird einmal auf alle App-Wechselrichter verteilt', () => {
  const result = plan(config(), {}, { meshLimits: { required: true, limits: { pvW: 60000, exportW: 225000 } } });
  assert.equal(result.valid, true); assert.equal(result.requests.reduce((sum, row) => sum + row.limitW, 0), 60000);
  assert.equal(result.requests.find(row => row.id === 'outer').limitW, 50000); assert.equal(result.requests.find(row => row.id === 'local').limitW, 10000);
});
test('Mesh-Exportgrenze verschärft M0 unabhängig vom PV-Kategoriebudget und ersetzt keine lokale Grenze', () => {
  const result = plan(config(), {}, { meshLimits: { required: true, limits: { pvW: 200000, exportW: 10000 } } });
  assert.equal(result.valid, true); assert.ok(result.requests.reduce((sum, row) => sum + row.limitW, 0) <= 30000);
  assert.ok(result.requests.find(row => row.id === 'local').limitW <= 20000);
  assert.ok(result.points.find(point => point.id === 'M0').minimumGridW >= -10000);
});
test('Handover hält bekannte Caps und eröffnet ohne bekannte Cap höchstens gemessene Generation', () => {
  let result = plan(config(), { m0: 100000, m1: 50000 }, { handover: true, previousCaps: { outer: 30000, local: 10000 } });
  assert.equal(result.requests.find(row => row.id === 'outer').limitW, 30000); assert.equal(result.requests.find(row => row.id === 'local').limitW, 10000);
  result = plan(config(), { m0: 100000, m1: 50000 }, { handover: true });
  assert.equal(result.requests.find(row => row.id === 'outer').limitW, 80000); assert.equal(result.requests.find(row => row.id === 'local').limitW, 40000);
});
test('Live-Mesh-Absenkung zwischen zwei Writes verwirft den inzwischen unzulässigen Folgeauftrag', async () => {
  const a = adapter(); let meshPvW = 60000;
  a._meshCoordinator = { currentLimits: () => ({ required: true, limits: { pvW: meshPvW, exportW: 225000 } }) };
  a._nwDynamicGridConnectionRuntime.writer.writePv = async (row, limitW, guard) => {
    if (!guard()) return { accepted: false, reason: 'live-mesh-fence' };
    a.writes.push({ id: row.id, limitW }); meshPvW = 20000; return { accepted: true };
  };
  const result = await pv.runDynamicGridPv(a); assert.deepEqual(a.writes, [{ id: 'outer', limitW: 50000 }]);
  assert.equal(result.results.find(row => row.id === 'local').accepted, false);
  assert.equal(result.status, 'write_incomplete');
});
test('Äußere Speicher-Ladung erzeugt keine lokale M1-Aufnahme und erlaubte Ladung zählt nicht als Senke', () => {
  const c = config(); c.storages = [{ id: 'store', connectionPointId: 'M0', powerMeasurement: m('store.actual') }];
  const result = plan(c, { 'store.actual': -50000 }, { pendingIntervals: [{ id: 'store', connectionPointId: 'M0', minPowerW: -100000, maxPowerW: 0 }] });
  assert.equal(result.requests.find(r => r.id === 'local').limitW, 20000);
  const local = config(); local.storages = [{ id: 'store', connectionPointId: 'M1', powerMeasurement: m('store.actual') }];
  const noSink = plan(local, { m1: 0, 'store.actual': -20000 }, { pendingIntervals: [{ id: 'store', connectionPointId: 'M1', minPowerW: -100000, maxPowerW: 0 }] });
  assert.equal(noSink.requests.find(r => r.id === 'local').limitW, 20000);
});
test('Neue unbestätigte Speicherentladung bleibt im PV-Exportbudget reserviert', () => {
  const c = config(); c.storages = [{ id: 'store', connectionPointId: 'M1', powerMeasurement: m('store.actual') }];
  const result = plan(c, { m1: 10000, 'store.actual': 0 }, { pendingIntervals: [{ id: 'store', connectionPointId: 'M1', minPowerW: 0, maxPowerW: 30000 }] });
  assert.equal(result.requests.find(r => r.id === 'local').limitW, 20000);
});
test('PV-Ausfall wird als Importkonflikt ausgewiesen, nie als garantierte Mindestgeneration', () => {
  const c = config(); c.points[1].importLimitW = 10000;
  const result = plan(c); assert.equal(result.valid, true); assert.equal(result.status, 'residual_limit_violation');
  assert.equal(result.points.find(p => p.id === 'M1').importViolationW, 10000);
});
test('EVU 60/30/0 wird ausschließlich zugeordneten Erzeugern zugeordnet und mit NVP-Minimum vereinigt', () => {
  const c = config(); c.pvAssignments[0].evuControl = true;
  for (const [stage, expected] of [[60, 60000], [30, 30000], [0, 0]]) {
    const now = Date.now(), s = states(now); s.relay = { val: true, ts: now, q: 0 };
    const rootConfig = { gridConstraints: { pvEvuEnabled: true, [`pvEvuRelay${stage}Id`]: 'relay' } };
    const result = pv.planDynamicPv(c, pv.collectDynamicPvSnapshot(c, s, now), { nowMs: now, pendingIntervals: [], evuLimits: pv.readDynamicEvuLimits(c, rootConfig, s, now) });
    assert.equal(result.requests.find(r => r.id === 'outer').limitW, expected);
    assert.equal(result.requests.find(r => r.id === 'local').limitW, 20000);
  }
});
test('Veraltetes EVU-Relais hält letzte strengere Cap und fällt nicht auf 100 Prozent zurück', () => {
  const c = config(); c.pvAssignments[0].evuControl = true;
  const now = Date.now(), s = states(now); s.relay = { val: false, ts: now - 20000, q: 0 };
  const evuLimits = pv.readDynamicEvuLimits(c, { gridConstraints: { pvEvuEnabled: true, pvEvuRelay60Id: 'relay' } }, s, now);
  let result = pv.planDynamicPv(c, pv.collectDynamicPvSnapshot(c, s, now), { nowMs: now, pendingIntervals: [], evuLimits, previousCaps: { outer: 30000 } });
  assert.equal(result.valid, true); assert.equal(result.requests.find(r => r.id === 'outer').limitW, 30000); assert.equal(result.status, 'evu_stale_hold');
  result = pv.planDynamicPv(c, pv.collectDynamicPvSnapshot(c, s, now), { nowMs: now, pendingIntervals: [], evuLimits }); assert.equal(result.valid, false);
});
test('Negative, fehlende, veraltete und zeitversetzte PV-Werte erteilen keine Freigabe', () => {
  const c = config(), now = Date.now();
  for (const change of [s => { s['local.actual'].val = -1; }, s => { delete s.m1; }, s => { s['local.actual'].ts -= 60000; }, s => { s['local.actual'].ts -= 2000; }, s => { s.m0.val = null; }]) {
    const s = states(now); change(s);
    const result = pv.planDynamicPv(c, pv.collectDynamicPvSnapshot(c, s, now), { nowMs: now }); assert.equal(result.valid, false);
  }
});
test('Fehlendes Speicherintervall wird nicht durch angenommenes 0-W-Fahren ersetzt', () => {
  const c = config(); c.storages.push({ id: 'store', connectionPointId: 'M1', powerMeasurement: m('store.actual') });
  const result = plan(c, { 'store.actual': -50000 }); assert.equal(result.valid, false); assert.ok(result.errors.some(e => e.code === 'storage-interval-unavailable'));
});
test('Finalslot schreibt genau einmal je Erzeuger; ACK wird nicht als physische Wirkung ausgegeben', async () => {
  const a = adapter(); const result = await pv.runDynamicGridPv(a);
  assert.equal(result.accepted, true); assert.equal(result.applied, false); assert.equal(a.writes.length, 2);
  assert.ok(result.pendingEffects.every(e => e.minGenerationW === 0)); assert.ok(result.results.every(e => e.applied === false));
});
test('Konfigurationswechsel während Lesen verwirft sämtliche PV-Befehle', async () => {
  const a = adapter(); let current = true; a._nwDynamicGridConnectionRuntime.isCurrent = () => current;
  a.getForeignStatesAsync = async () => { current = false; return states(Date.now()); };
  const result = await pv.runDynamicGridPv(a); assert.equal(a.writes.length, 0); assert.equal(result.status, 'configuration-changed');
});
test('Konfigurationswechsel nach erster Ausgabe verhindert weitere Teilbefehle', async () => {
  const a = adapter(); let current = true; a._nwDynamicGridConnectionRuntime.isCurrent = () => current;
  a._nwDynamicGridConnectionRuntime.writer.writePv = async (row, limitW, guard) => { assert.equal(guard(), true); a.writes.push({ id: row.id, limitW }); current = false; return { accepted: true }; };
  await pv.runDynamicGridPv(a); assert.equal(a.writes.length, 1);
});
test('EVU-Konfigurationswechsel unmittelbar vor Ausgabe verwirft die Freigabe', async () => {
  const a = adapter(); a._nwDynamicGridConnectionRuntime.writer.writePv = async (_row, _limit, guard) => {
    a.config.gridConstraints = { pvEvuEnabled: true, pvEvuRelay0Id: 'new.relay' }; assert.equal(guard(), false); return { accepted: false };
  };
  const result = await pv.runDynamicGridPv(a); assert.equal(result.accepted, false);
});
test('Frische EVU-Nullstufe wirkt auch bei fehlender Netz-/PV-Messung ohne Freigabeerhöhung', async () => {
  const c = config(); c.pvAssignments[0].evuControl = true; const a = adapter(c);
  a.config.gridConstraints = { pvEvuEnabled: true, pvEvuRelay0Id: 'relay' };
  a.getForeignStatesAsync = async () => ({ relay: { val: true, ts: Date.now(), q: 0 } });
  const result = await pv.runDynamicGridPv(a); assert.deepEqual(a.writes, [{ id: 'outer', limitW: 0 }]); assert.equal(result.valid, false); assert.equal(result.results[0].evuOnly, true);
});
test('Lesefehler hält Caps und stellt Fehlerstatus sichtbar', async () => {
  const a = adapter(); await pv.runDynamicGridPv(a); const old = a._nwDynamicGridPvRuntime.acceptedCaps;
  a.getForeignStatesAsync = async () => { throw Error('offline'); }; a.writes.length = 0;
  const result = await pv.runDynamicGridPv(a); assert.equal(result.status, 'measurement-read-failed'); assert.deepEqual(result.acceptedCaps, old); assert.equal(a.writes.length, 0);
});
test('Timeout lässt EMS frei und verhindert weitere IO-Aufträge bis zum tatsächlichen Abschluss', async () => {
  const a = adapter(); let resolve, reads = 0;
  a.getForeignStatesAsync = () => { reads++; return new Promise(done => { resolve = done; }); };
  let result = await pv.runDynamicGridPv(a, { readTimeoutMs: 50 }); assert.equal(result.status, 'measurement-read-timeout'); assert.equal(reads, 1);
  result = await pv.runDynamicGridPv(a, { readTimeoutMs: 50 }); assert.equal(result.status, 'measurement-read-busy'); assert.equal(reads, 1); assert.equal(a.writes.length, 0);
  resolve(states(Date.now())); await new Promise(done => setImmediate(done));
  a.getForeignStatesAsync = async () => states(Date.now());
  result = await pv.runDynamicGridPv(a); assert.equal(result.accepted, true);
});
test('PV-Schreibabsicht bleibt bei Timeout vor dem await für Speicherbudget reserviert', async () => {
  const a = adapter(); a._nwDynamicGridPvRuntime = { configVersion: 1, acceptedCaps: { outer: 30000, local: 10000 }, pendingCaps: { outer: 30000, local: 10000 } };
  a._nwDynamicGridConnectionRuntime.writer.writePv = async (row, limitW) => {
    assert.ok(a._nwDynamicGridPvRuntime.pendingEffects.find(effect => effect.id === row.id).maxGenerationW >= limitW);
    throw Error('timeout');
  };
  const result = await pv.runDynamicGridPv(a); assert.equal(result.accepted, false); assert.equal(result.acceptedCaps.outer, 30000); assert.equal(result.pendingCaps.outer, 100000);
});
test('Explizite angewandte Cap-Rückmeldung kann alte PV-Freigabe freigeben; bloßes ACK genügt nicht', async () => {
  for (const explicit of [false, true]) {
    const c = config(); if (explicit) c.pvAssignments[1].command.readbackStateId = 'local.appliedLimit';
    const a = adapter(c); a._nwDynamicGridConnectionRuntime.writer.writePv = async () => ({ accepted: true, commandConfirmed: true });
    const result = await pv.runDynamicGridPv(a); assert.equal(result.pendingCaps.local, explicit ? 20000 : 100000);
  }
});
test('M0 Split-Messung verwendet den gemeinsamen strengen Collector', async () => {
  const { collectDynamicSnapshot, dynamicGridReadIds } = sourceModule('ems/services/dynamic-grid-config.ts');
  const c = config(); c.points[0].measurement = { kind: 'split', importMeasurement: m('m0.buy'), exportMeasurement: m('m0.sell'), maxAgeMs: 5000, sign: 1 };
  const a = adapter(c); let ids;
  a._nwDynamicGridConnectionRuntime.measurementIds = dynamicGridReadIds(c);
  a._nwDynamicGridConnectionRuntime.collectSnapshot = (s, now) => collectDynamicSnapshot(c, s, now);
  a.getForeignStatesAsync = async request => { ids = request; return states(Date.now(), { 'm0.buy': 0, 'm0.sell': 100000 }); };
  const result = await pv.runDynamicGridPv(a); assert.equal(result.accepted, true); assert.ok(ids.includes('m0.buy') && ids.includes('m0.sell'));
  a.getForeignStatesAsync = async () => states(Date.now(), { 'm0.buy': 0 }); a.writes.length = 0;
  assert.equal((await pv.runDynamicGridPv(a)).valid, false); assert.equal(a.writes.length, 0);
});
test('Akzeptierte Lastreduktion bleibt konservativ im PV-Budget; zusätzliche Last ist keine garantierte Senke', () => {
  const c = config();
  let result = plan(c, {}, { otherEffects: [{ key: 'heater', accepted: true, netLoadDeltaW: -10000 }] });
  assert.equal(result.requests.find(r => r.id === 'local').limitW, 10000);
  result = plan(c, {}, { otherEffects: [{ key: 'heater', accepted: true, netLoadDeltaW: 10000 }] });
  assert.equal(result.requests.find(r => r.id === 'local').limitW, 20000);
  result = plan(c, {}, { otherEffects: [{ key: 'heater', accepted: true, uncertain: true, netLoadDeltaW: 0 }] }); assert.equal(result.valid, false);
});
test('Eigene App besitzt Finalslot vor erstem Snapshot; ausgeschalteter Bestand bleibt frei', async () => {
  const { NvpCoordinatorModule } = sourceModule('ems/modules/nvp-coordinator.ts');
  const a = adapter(); delete a._nwDynamicGridConnectionRuntime; let legacy = 0;
  const coordinator = new NvpCoordinatorModule(a, null, { tickPostStorage: async () => { legacy++; } });
  coordinator._setIfChanged = async () => {}; await coordinator.tick(); assert.equal(legacy, 0); assert.equal(a._nvpCoordinatorSnapshot.topology, 'dynamicGrid');
  a.config.emsApps.apps.dynamicGrid.enabled = false; assert.equal(pv.dynamicPvOwnsCycle(a), false);
});
test('Legacy-PV-Schreibwege einschließlich Fehler-Nullwert respektieren App-Zielbesitz', async () => {
  const { GridConstraintsModule } = sourceModule('ems/modules/grid-constraints.ts');
  const a = adapter(), writes = [], c = a.config.gridConstraints; c.pvEvuEnabled = true;
  const entry = { objectId: 'outer.limit', dataType: 'number', direction: 'out', scale: 1 };
  const module = new GridConstraintsModule(a, { getEntry: () => entry, writeNumber: async (...args) => { writes.push(args); return true; } });
  module._pvMappingStatus = () => ({ valid: true, targets: [{ key: 'pv.evu.0.limitW', objectId: 'outer.limit', physicalId: 'outer.limit' }] });
  module._pvWriteZeroSafe.set('outer.limit', true);
  assert.equal(await module._writeValidatedPvLimit('pv.evu.0.limitW', 10000, c), false);
  assert.equal(await module._applyCurtailFailsafe(c, 'pvLimitW'), false);
  await module._stopInvalidPvMappings({ targets: [{ key: 'pv.evu.0.limitW', objectId: 'outer.limit', physicalId: 'outer.limit' }] });
  assert.equal(writes.length, 0);
  a.config.emsApps.apps.dynamicGrid.enabled = false;
  assert.equal(await module._writeValidatedPvLimit('pv.evu.0.limitW', 10000, c), true); assert.equal(writes.length, 1);
});
