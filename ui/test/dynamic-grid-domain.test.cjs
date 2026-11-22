'use strict';
// Reine Softwareprüfungen des aktiven Generic-Vertrags; keine Hardwarefreigabe.
const test = require('node:test');
const assert = require('node:assert/strict');
const { solveDynamicDispatch, evaluateIntervals } = require('../ems/services/nvp-budget');
const { dynamicGridDefaults, validateDynamicGridConfig, resolveGeneralMeasurement, collectDynamicSnapshot, dynamicGridReadIds } = require('../ems/services/dynamic-grid-config');
const NOW = 1800000000000;
const measurement = stateId => ({ stateId, unit: 'W', sign: 1, maxAgeMs: 5000 });
const sample = val => ({ val, ts: NOW, q: 0, ack: true });
const device = (id, point = 'M0', extra = {}) => ({ id, connectionPointId: point, authority: 'eos', actualW: 0, minPowerW: -50000, maxPowerW: 50000, requestedW: 0, reservedMinW: 0, reservedMaxW: 0, ...extra });
const setup = (residual = 20000, participants = [device('a')]) => ({ points: [{ id: 'M0', importLimitW: 225000, exportLimitW: 225000 }], residuals: { M0: { minW: residual, maxW: residual } }, participants });
function config() {
  const c = dynamicGridDefaults();
  c.points[0].importLimitW = 250000; c.points[0].exportLimitW = 250000;
  c.points[1].measurement = measurement('meter.local'); c.points[1].exportLimitW = 0;
  c.storages = [{ id: 'free-user-id', name: 'Eigenes Gerät', connectionPointId: 'M1', controlPointId: 'M1', dispatchGroupId: 'house', primaryPurpose: 'selfConsumption', authority: 'eos',
    powerMeasurement: measurement('battery.power'), socMeasurement: { stateId: 'battery.soc', scale: 1, maxAgeMs: 5000 },
    maxChargeW: 50000, maxDischargeW: 50000, minSoc: 10, maxSoc: 90, maxDeltaWPerSec: 10000,
    strategy: { targetGridImportW: 50, importThresholdW: 20 }, command: { mode: 'signedTarget', signedTarget: { stateId: 'battery.target', scale: 1000, sign: -1 } } }];
  return c;
}
const validation = (c = config(), extra = {}) => validateDynamicGridConfig(c, { active: true, generalMeasurement: measurement('meter.root'), ...extra });

test('eigene App: Entwürfe speicherbar, Aktivierung vollständig, kein Farm-/Herstellerzwang', () => {
  assert.equal(validateDynamicGridConfig(dynamicGridDefaults(), { active: false }).valid, true);
  assert.equal(validateDynamicGridConfig(dynamicGridDefaults(), { active: true }).valid, false);
  const good = validation(); assert.equal(good.valid, true, JSON.stringify(good.errors));
  assert.equal(good.topology.origin, 'dynamicGridConnection'); assert.equal(good.topology.operation, 'active');
  assert.equal(good.config.storages[0].id, 'free-user-id');
  const c = config(); c.storages[0].maxChargeW = '50000';
  assert.equal(validation(c, { active: false }).valid, false);
  c.storages[0].maxChargeW = false; assert.equal(validation(c, { active: false }).valid, false);
});

test('M0 nur Allgemein; gleiche physische Quellen und Alias-Ausgänge abgewiesen', () => {
  let c = config(); c.points[0].measurement = measurement('rogue'); assert.ok(validation(c).errors.some(e => e.code === 'general-source-only'));
  c = config(); assert.ok(validation(c, { resolveSourceId: () => 'same' }).errors.some(e => e.code === 'duplicate-source'));
  c = config(); c.storages.push({ ...c.storages[0], id: 'second', powerMeasurement: measurement('second.power'), command: { mode: 'signedTarget', signedTarget: { stateId: 'alias.target', scale: 1, sign: 1 } } });
  assert.ok(validation(c, { resolveWriteId: () => 'physical.target' }).errors.some(e => e.code === 'duplicate-output'));
});

test('M0 Split benötigt beide frischen Quellen, kohärente Zeitpunkte und bekannte Einheit', () => {
  const m = resolveGeneralMeasurement({ datapoints: { gridBuyPower: 'grid.buy', gridSellPower: 'grid.sell' }, settings: { flowInvertGrid: true } }, { unitByStateId: { 'grid.buy': 'kW', 'grid.sell': 'W' } });
  const c = validation(config(), { generalMeasurement: m }); assert.equal(c.valid, true);
  const states = { 'grid.buy': sample(30), 'grid.sell': sample(5000), 'meter.local': sample(0), 'battery.power': sample(0), 'battery.soc': sample(50) };
  let snapshot = collectDynamicSnapshot(c.topology, states, NOW); assert.equal(snapshot.valid, true); assert.equal(snapshot.points.M0.valueW, -25000);
  delete states['grid.sell']; snapshot = collectDynamicSnapshot(c.topology, states, NOW); assert.equal(snapshot.valid, false); assert.equal(snapshot.points.M0.valueW, null);
  states['grid.sell'] = { ...sample(5000), ts: NOW - 1500 }; assert.equal(collectDynamicSnapshot(c.topology, states, NOW).valid, false);
  assert.ok(dynamicGridReadIds(c.topology).includes('grid.sell'));
  const unknown = resolveGeneralMeasurement({ datapoints: { gridPointPower: 'grid' } });
  assert.equal(validation(config(), { generalMeasurement: unknown }).valid, false);
});

test('SoC/Verfügbarkeit strikt: string/null/stale erzeugen keine fiktive Kapazität', () => {
  const v = validation(), states = { 'meter.root': sample(20000), 'meter.local': sample(10000), 'battery.power': sample(0), 'battery.soc': sample(50) };
  assert.equal(collectDynamicSnapshot(v.topology, states, NOW).storageTelemetry['free-user-id'].available, true);
  for (const bad of ['50', null, true, NaN]) { states['battery.soc'] = sample(bad); assert.equal(collectDynamicSnapshot(v.topology, states, NOW).valid, false); }
  states['battery.soc'] = { ...sample(50), ts: NOW - 6000 }; assert.equal(collectDynamicSnapshot(v.topology, states, NOW).valid, false);
});

test('externe Limits benötigen angewandte Grenzen und geräteseitigen Ablauf, keine Markenliste', () => {
  const c = config(), s = c.storages[0]; s.primaryPurpose = 'arbitrage'; s.authority = 'external';
  s.command = { mode: 'externalLimits', maxCharge: { stateId: 'max.charge', scale: 1, sign: 1 }, maxDischarge: { stateId: 'max.discharge', scale: 1, sign: 1 } };
  assert.equal(validation(c).valid, false);
  Object.assign(s.command, { appliedMaxCharge: measurement('applied.charge'), appliedMaxDischarge: measurement('applied.discharge'), watchdog: { stateId: 'heartbeat', readbackStateId: 'heartbeat.applied', ttlMs: 5000, writeValue: true, expiryBehavior: 'zeroLimits' } });
  assert.equal(validation(c).valid, true, JSON.stringify(validation(c).errors));
});

test('T13: verpflichtende Entladung wird aktiv als nicht verschlechternde Recovery berechnet', () => {
  const result = solveDynamicDispatch(setup(260000));
  assert.equal(result.valid, true); assert.equal(result.safe, false); assert.equal(result.recoveryAllowed, true);
  assert.equal(result.commands[0].targetW, 35000); assert.equal(result.commands[0].recovery, true);
  assert.equal(result.transitionPoints[0].importViolationW, 35000); assert.equal(result.points[0].importViolationW, 0);
});

test('T13 Gegenrichtung: notwendige Ladung; Null ist bei bestehender Stützung nicht sicher', () => {
  assert.equal(solveDynamicDispatch(setup(-260000)).commands[0].targetW, -35000);
  const result = solveDynamicDispatch(setup(260000, [device('a', 'M0', { actualW: 35000, reservedMinW: 35000, reservedMaxW: 35000 })]));
  assert.equal(result.safe, true); assert.equal(result.commands[0].targetW, 35000);
});

test('T15: zu wenig Stützleistung bleibt sichtbar und nutzt nur bestmögliche Entlastung', () => {
  const result = solveDynamicDispatch(setup(260000, [device('a', 'M0', { maxPowerW: 20000 })]));
  assert.equal(result.status, 'recovery_capacity_insufficient'); assert.equal(result.commands[0].targetW, 20000);
  assert.equal(result.points[0].importViolationW, 15000); assert.equal(result.safe, false);
});

test('T08/T09: unabhängige externe Maxima verbrauchen gemeinsames Restbudget nur einmal', () => {
  const result = solveDynamicDispatch(setup(20000, ['a', 'b', 'c'].map(id => device(id, 'M0', { authority: 'external', minPowerW: -250000, maxPowerW: 250000 }))));
  assert.equal(result.safe, true); assert.equal(result.commands.length, 3);
  assert.equal(result.commands.reduce((sum, c) => sum + c.maxChargeW, 0), 205000);
  assert.equal(result.commands.reduce((sum, c) => sum + c.maxDischargeW, 0), 245000);
});

test('T12: 135→165 kW erst nach bestätigter EOS-Stützleistung, keine optimistischen Endpunkte', () => {
  const eos = device('support', 'M1', { requestedW: 30000 });
  const external = device('trade', 'M0', { authority: 'external', minPowerW: -250000, maxPowerW: 250000, reservedMinW: -135000, reservedMaxW: 0 });
  const input = setup(90000, [eos, external]);
  let result = solveDynamicDispatch(input); assert.equal(result.safe, true);
  assert.equal(result.commands.find(c => c.id === 'trade').maxChargeW, 135000);
  Object.assign(eos, { actualW: 30000, reservedMinW: 30000, reservedMaxW: 30000 });
  result = solveDynamicDispatch(input); assert.equal(result.commands.find(c => c.id === 'trade').maxChargeW, 165000);
});

test('PV-Ausfallreserve begrenzt Ladung auch bei momentan hoher PV-Erzeugung', () => {
  const input = setup(-100000, [device('a', 'M0', { authority: 'external', minPowerW: -250000, maxPowerW: 250000 })]);
  input.residuals.M0.maxW = 100000;
  const result = solveDynamicDispatch(input); assert.equal(result.safe, true); assert.equal(result.commands[0].maxChargeW, 125000);
});

test('lokale Grenzen bleiben über Recovery und jede ungleichzeitige Leistungskombination wirksam', () => {
  const input = { points: [{ id: 'M0', importLimitW: 100000, exportLimitW: 100000 }, { id: 'M1', importLimitW: 50000, exportLimitW: 0 }], residuals: { M0: { minW: 120000, maxW: 120000 }, M1: { minW: -20000, maxW: -20000 } }, participants: [device('outer'), device('inner', 'M1')] };
  const result = solveDynamicDispatch(input); assert.equal(result.recoveryAllowed, true);
  for (const p of result.transitionPoints) { const before = result.baselinePoints.find(b => b.id === p.id); assert.ok(p.importViolationW <= before.importViolationW); assert.ok(p.exportViolationW <= before.exportViolationW); }
  assert.ok(result.commands.every(c => c.recovery));
});

test('250 deterministische Szenarien prüfen sämtliche Alt/Neu-Endpunktkombinationen', () => {
  let seed = 51243; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let run = 0; run < 250; run++) {
    const participants = Array.from({ length: 3 }, (_, i) => device(String(i), i ? 'M1' : 'M0', { requestedW: Math.floor(random() * 100000) - 50000 }));
    const input = { points: [{ id: 'M0', importLimitW: 100000, exportLimitW: 100000 }, { id: 'M1', importLimitW: 60000, exportLimitW: 60000 }], residuals: { M0: { minW: -30000, maxW: 50000 }, M1: { minW: -20000, maxW: 40000 } }, participants };
    const result = solveDynamicDispatch(input); assert.equal(result.valid, true); assert.equal(result.safe, true);
    assert.equal(evaluateIntervals({ ...input, participants: result.participants }).safe, true);
    for (let mask = 0; mask < 8; mask++) for (const point of input.points) {
      for (const residual of [input.residuals[point.id].minW, input.residuals[point.id].maxW]) {
        const grid = residual - result.participants.reduce((sum, p, i) => sum + (point.id === 'M0' || p.connectionPointId === 'M1' ? mask & (1 << i) ? p.maxPowerW : p.minPowerW : 0), 0);
        assert.ok(grid <= point.importLimitW && grid >= -point.exportLimitW, `${run}/${mask}/${point.id}`);
      }
    }
  }
});

test('fehlerhafte Reservierung und rein positive externe Maximalfreigabe sind niemals ausführbar', () => {
  let input = setup(); delete input.participants[0].reservedMinW; assert.equal(solveDynamicDispatch(input).valid, false);
  input = setup(260000, [device('trade', 'M0', { authority: 'external', desiredMinW: 35000, desiredMaxW: 50000 })]); assert.equal(solveDynamicDispatch(input).commands.length, 0);
  input = setup(); input.points = [null]; assert.equal(solveDynamicDispatch(input).valid, false);
});

test('Neustart EOS: Null-Ist mit alter Vollreservierung erhält bestätigbaren Handshake', () => {
  const input = setup(0, [device('a', 'M0', { minPowerW: -200000, maxPowerW: 200000, reservedMinW: -200000, reservedMaxW: 200000 })]);
  input.points[0].importLimitW = input.points[0].exportLimitW = 100000;
  const result = solveDynamicDispatch(input);
  assert.equal(result.recoveryAllowed, true); assert.equal(result.commands[0].targetW, 0);
  assert.equal(result.safe, false); assert.equal(result.participants[0].minPowerW, -200000);
  Object.assign(input.participants[0], { reservedMinW: 0, reservedMaxW: 0 });
  assert.equal(solveDynamicDispatch(input).safe, true);
});

test('Neustart extern: engere Rechte sind sendbar, aber Altfreigabe erst nach Anwendung frei', () => {
  const input = setup(0, [device('external', 'M0', { authority: 'external', minPowerW: -200000, maxPowerW: 200000, reservedMinW: -200000, reservedMaxW: 200000, desiredMinW: 0, desiredMaxW: 0 })]);
  input.points[0].importLimitW = input.points[0].exportLimitW = 100000;
  let result = solveDynamicDispatch(input);
  assert.equal(result.recoveryAllowed, true); assert.equal(result.commands[0].maxChargeW, 0); assert.equal(result.commands[0].maxDischargeW, 0);
  assert.equal(result.safe, false); assert.equal(result.participants[0].minPowerW, -200000); assert.equal(result.participants[0].maxPowerW, 200000);
  Object.assign(input.participants[0], { reservedMinW: 0, reservedMaxW: 0 });
  result = solveDynamicDispatch(input); assert.equal(result.safe, true);
});

test('mehrere externe Anfangsverträge werden gemeinsam monotone verkleinert, niemals erweitert', () => {
  const input = setup(0, ['a', 'b'].map(id => device(id, 'M0', { authority: 'external', minPowerW: -200000, maxPowerW: 200000, reservedMinW: -200000, reservedMaxW: 200000 })));
  input.points[0].importLimitW = input.points[0].exportLimitW = 100000;
  const result = solveDynamicDispatch(input); assert.equal(result.commands.length, 2); assert.equal(result.recoveryAllowed, true);
  assert.equal(result.commands.reduce((sum, c) => sum + c.maxChargeW, 0), 100000);
  assert.ok(result.commands.every(c => c.recovery && c.minPowerW >= -200000 && c.maxPowerW <= 200000));
  assert.equal(result.transitionPoints[0].importViolationW, 300000);
});

test('leere neue Speicherzuordnung bleibt nur als Entwurf gültig', () => {
  const c = dynamicGridDefaults(); c.storages = [{ id: '', dispatchGroupId: '', connectionPointId: 'M0', controlPointId: '', primaryPurpose: '', authority: '', command: {} }];
  const result = validateDynamicGridConfig(c, { active: false });
  assert.equal(result.valid, true, JSON.stringify(result.errors)); assert.ok(result.activationErrors.length > 0);
});

test('M1 bewusst unbegrenzt ist null, leere eingeschaltete Grenze bleibt unvollständiger Entwurf', () => {
  const c = config(); c.points[1].importLimitW = '';
  const draft = validation(c, { active: false }); assert.equal(draft.valid, true); assert.equal(draft.config.points[1].importLimitW, '');
  assert.equal(validation(c).valid, false);
  c.points[1].importLimitW = null; assert.equal(validation(c).valid, true);
});

test('Leistung und SoC derselben Batterie dürfen weder direkt noch über Alias dieselbe Messquelle verwenden', () => {
  const c = config(); c.storages[0].socMeasurement.stateId = 'battery.power';
  assert.ok(validation(c).errors.some(e => e.code === 'power-soc-source-collision'));
  c.storages[0].socMeasurement.stateId = 'alias.soc';
  const result = validation(c, { resolveSourceId: id => ['alias.soc', 'battery.power'].includes(id) ? 'physical.battery.value' : id });
  assert.ok(result.errors.some(e => e.code === 'power-soc-source-collision'));
  assert.equal(validation(config()).valid, true);
});

test('externe Grenzrückmeldung benötigt echte Bestätigung und nichtnegative Werte', () => {
  const c = config(), s = c.storages[0]; s.primaryPurpose = 'arbitrage'; s.authority = 'external';
  s.command = { mode: 'externalLimits', maxCharge: { stateId: 'max.charge', scale: 1, sign: 1 }, maxDischarge: { stateId: 'max.discharge', scale: 1, sign: 1 }, appliedMaxCharge: measurement('applied.charge'), appliedMaxDischarge: measurement('applied.discharge'), watchdog: { stateId: 'heartbeat', readbackStateId: 'heartbeat.applied', ttlMs: 5000, writeValue: true, expiryBehavior: 'zeroLimits' } };
  const v = validation(c); const states = { 'meter.root': sample(0), 'meter.local': sample(0), 'battery.power': sample(0), 'battery.soc': sample(50), 'applied.charge': sample(1000), 'applied.discharge': sample(1000) };
  assert.equal(collectDynamicSnapshot(v.topology, states, NOW).readbacks[s.id].appliedMaxCharge.valid, true);
  states['applied.charge'].ack = false;
  assert.equal(collectDynamicSnapshot(v.topology, states, NOW).readbacks[s.id].appliedMaxCharge.valid, false);
  states['applied.charge'] = sample(-1000);
  assert.equal(collectDynamicSnapshot(v.topology, states, NOW).readbacks[s.id].appliedMaxCharge.valid, false);
});
