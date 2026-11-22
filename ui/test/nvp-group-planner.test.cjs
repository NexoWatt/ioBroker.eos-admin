'use strict';
/**
 * NexoWatt Gruppenplanung: Fachtests für lokale Bilanz, gemeinsame Verteilung,
 * fehlende Fähigkeiten und Rückführung gesättigter Rampenzustände.
 * Ausführung nach Runtime-Build: node --test test/nvp-group-planner.test.cjs
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { planGroups } = require('../ems/services/nvp-group-planner');

const NOW = 1800000000000;
const measurement = (stateId) => ({ stateId, unit: 'W', sign: 1, maxAgeMs: 10000 });
const member = (id, point = 'M1', purpose = 'selfConsumption', group = 'home') => ({
  id, connectionPointId: point, controlPointId: point, dispatchGroupId: group,
  primaryPurpose: purpose, authority: purpose === 'externalArbitrage' ? 'external' : 'eos',
  ancestorGuards: point === 'M1' ? ['M0'] : [], powerMeasurement: measurement(`${id}.power`),
  maxChargeW: 100000, maxDischargeW: 100000, minSoc: 10, maxSoc: 90,
});
const config = (storages = [member('storage-single')]) => ({
  mode: 'dynamic', operation: 'diagnostic', schemaVersion: 1, configVersion: 1,
  points: [
    { id: 'M0', measurement: measurement('root'), importLimitW: 250000, exportLimitW: 250000, importReserveW: 25000, exportReserveW: 25000 },
    { id: 'M1', measurement: measurement('local'), importLimitW: 100000, exportLimitW: 0, importReserveW: 0, exportReserveW: 0 },
  ], storages,
});
const sample = (valueW, ts = NOW) => ({ valid: true, valueW, ts, ageMs: NOW - ts, reason: 'ok' });
const snapshot = (cfg, m0 = 130000, m1 = 20000, powers = {}) => ({
  valid: true, ts: NOW, configVersion: cfg.configVersion,
  points: { M0: sample(m0), M1: sample(m1) },
  storages: Object.fromEntries(cfg.storages.map(s => [s.id, sample(powers[s.id] ?? 0)])),
});
const options = (cfg, extra = {}) => ({
  nowMs: NOW,
  storageTelemetry: Object.fromEntries(cfg.storages.map(s => [s.id, { valid: true, ts: NOW, available: true, socPct: 50 }])),
  ...extra,
});

test('T04: M1-Eigenverbrauch folgt ausschließlich M1, nicht dem äußeren Handelsfahrpunkt', () => {
  const cfg = config([member('storage-single'), member('tesvolt', 'M0', 'externalArbitrage', 'trade')]);
  const a = planGroups(cfg, snapshot(cfg, 130000, 20000, { 'storage-single': 10000, tesvolt: -40000 }), options(cfg));
  const b = planGroups(cfg, snapshot(cfg, -190000, 20000, { 'storage-single': 10000, tesvolt: 200000 }), options(cfg));
  assert.equal(a.groups[0].requestedW, 29950);
  assert.equal(b.groups[0].requestedW, 29950);
  assert.equal(a.groups[0].residualWithoutGroupW, 30000);
  assert.equal(a.requests.find(r => r.storageId === 'tesvolt').proposedW, null);
  assert.deepEqual(a.groups[0].ancestorGuards, ['M0']);
});

test('T05: gemeinsamer lokaler Fehler wird einmal auf zwei Batterien verteilt', () => {
  const cfg = config([member('a'), member('b')]);
  const result = planGroups(cfg, snapshot(cfg, -90000, -20000, { a: 5000, b: 5000 }), options(cfg));
  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].requestedW, -10050);
  assert.equal(result.requests.reduce((sum, r) => sum + r.proposedW, 0), -10050);
  assert.equal(result.requests.length, 2);
  assert.equal(result.groups[0].gridW, -20000);
  assert.equal(result.applied, false);
  assert.ok(result.requests.every(r => r.hypothetical && r.applied === false));
});

test('T06/T07: äußerer TESVOLT ist keine lokale Senke für M1-Nulleinspeisung', () => {
  const cfg = config([member('fenecon', 'M1', 'zeroExport'), member('tesvolt', 'M0', 'externalArbitrage', 'trade')]);
  const first = planGroups(cfg, snapshot(cfg, 0, -20000, { fenecon: 0, tesvolt: -20000 }), options(cfg));
  const second = planGroups(cfg, snapshot(cfg, 40000, -20000, { fenecon: 0, tesvolt: -60000 }), options(cfg));
  assert.equal(first.groups[0].requestedW, -20000);
  assert.equal(second.groups[0].requestedW, -20000);
  assert.equal(first.groups[1].requestedW, null);
  assert.equal(first.groups[1].status, 'external-corridor-only');
});

test('Nulleinspeisung fordert nur tatsächlich benötigte lokale Ladung an', () => {
  const cfg = config([member('fenecon', 'M1', 'zeroExport')]);
  const result = planGroups(cfg, snapshot(cfg, 0, 5000, { fenecon: -20000 }), options(cfg));
  assert.equal(result.groups[0].requestedW, -15000);
  const noSurplus = planGroups(cfg, snapshot(cfg, 0, 30000, { fenecon: -20000 }), options(cfg));
  assert.equal(noSurplus.groups[0].requestedW, 0);
});

test('volle Batterie erhält keine fiktive Aufnahmekapazität', () => {
  const cfg = config([member('full', 'M1', 'zeroExport')]);
  const opts = options(cfg);
  opts.storageTelemetry.full.socPct = 90;
  const result = planGroups(cfg, snapshot(cfg, 0, -20000), opts);
  assert.equal(result.groups[0].requestedW, -20000);
  assert.equal(result.groups[0].proposedW, 0);
  assert.equal(result.groups[0].unservedW, -20000);
  assert.equal(result.requests[0].minW, 0);
});

test('fehlende, manipulierte und veraltete SoC-Telemetrie blockiert Leistungsvorschlag', () => {
  const cfg = config();
  for (const telemetry of [undefined, { valid: true, ts: NOW, socPct: null, available: true }, { valid: true, ts: NOW - 16000, socPct: 50, available: true }, { valid: true, ts: NOW, socPct: 50, available: false }]) {
    const result = planGroups(cfg, snapshot(cfg), options(cfg, { storageTelemetry: { 'storage-single': telemetry } }));
    assert.equal(result.groups[0].requestedW, 19950);
    assert.equal(result.groups[0].proposedW, null);
    assert.equal(result.groups[0].status, 'capability-unverified');
    assert.equal(result.requests.length, 0);
  }
});

test('mehrere lokale Regler auf demselben Bilanzfehler werden abgewiesen', () => {
  const cfg = config([member('a', 'M1', 'selfConsumption', 'one'), member('b', 'M1', 'zeroExport', 'two')]);
  const result = planGroups(cfg, snapshot(cfg), options(cfg));
  assert.equal(result.requests.length, 0);
  assert.ok(result.groups.every(g => g.status === 'duplicate-local-regulator'));
});

test('Peak-Shaving und Tarif benötigen getrennte echte Planervorgaben', () => {
  const cfg = config([member('a', 'M0', 'peakShaving', 'peak'), member('b', 'M1', 'tariff', 'tariff')]);
  const missing = planGroups(cfg, snapshot(cfg), options(cfg));
  assert.equal(missing.groups[0].status, 'peak-target-unavailable');
  assert.equal(missing.groups[1].status, 'tariff-request-unavailable');
  const result = planGroups(cfg, snapshot(cfg, 130000, 0, { a: 10000 }), options(cfg, {
    peakTargetsByGroup: { peak: { valid: true, ts: NOW, targetImportW: 100000 } },
    tariffRequestsByGroup: { tariff: { valid: true, ts: NOW, requestedW: -10000 } },
  }));
  assert.equal(result.groups[0].requestedW, 40000);
  assert.equal(result.groups[1].requestedW, -10000);
});

test('T25: M0-Sättigungsfeedback verhindert Auflaufen des Gruppen-Rampenzustands', () => {
  const cfg = config();
  let previousState = { configVersion: 1, groups: { home: { ts: NOW - 1000, limitedTargetW: 90000 } } };
  for (let cycle = 0; cycle < 4; cycle++) {
    const now = NOW + cycle * 1000;
    const snap = snapshot(cfg, 200000, 100000);
    snap.ts = now;
    snap.points.M0.ts = snap.points.M1.ts = snap.storages['storage-single'].ts = now;
    const result = planGroups(cfg, snap, options(cfg, {
      nowMs: now, previousState,
      storageTelemetry: { 'storage-single': { valid: true, ts: now, available: true, socPct: 50, maxDeltaWPerSec: 1000 } },
      budgetFeedbackByGroup: { home: { valid: true, ts: now - 1000, configVersion: 1, acceptedW: 2000 } },
    }));
    assert.equal(result.groups[0].requestedW, 99950);
    assert.equal(result.groups[0].proposedW, 3000);
    assert.equal(result.groups[0].actualW, 0);
    assert.equal(result.groups[0].ramp.feedbackUsed, true);
    previousState = result.nextState;
  }
});

test('Rampen-/Policyzustände bleiben zwischen M0 und M1 getrennt', () => {
  const cfg = config([member('a', 'M0', 'selfConsumption', 'outer'), member('b', 'M1', 'selfConsumption', 'inner')]);
  const opts = options(cfg, { previousState: { configVersion: 1, groups: { outer: { ts: NOW - 1000, limitedTargetW: 10000 }, inner: { ts: NOW - 1000, limitedTargetW: -10000 } } } });
  opts.storageTelemetry.a.maxDeltaWPerSec = 1000;
  opts.storageTelemetry.b.maxDeltaWPerSec = 1000;
  const result = planGroups(cfg, snapshot(cfg, 50000, -50000), opts);
  assert.equal(result.groups[0].proposedW, 11000);
  assert.equal(result.groups[1].proposedW, -11000);
});

test('falsche Konfigurationsversion oder nicht frische Messwerte führen nie zu Null-Ersatzmessung', () => {
  const cfg = config();
  const wrongVersion = snapshot(cfg);
  wrongVersion.configVersion = 0;
  assert.equal(planGroups(cfg, wrongVersion, options(cfg)).groups.length, 0);
  const stale = snapshot(cfg);
  stale.points.M1.ts = NOW - 20000;
  const result = planGroups(cfg, stale, options(cfg));
  assert.equal(result.groups[0].requestedW, null);
  assert.equal(result.groups[0].status, 'measurements-unavailable');
});

test('statischer Bestand bleibt ohne Gruppenplanung', () => {
  const result = planGroups({ mode: 'static' }, null);
  assert.equal(result.status, 'static');
  assert.deepEqual(result.groups, []);
  assert.deepEqual(result.requests, []);
});


const ownConfig = (storages = [member('own')]) => ({
  ...config(storages.map(storage => ({ strategy: { targetGridImportW: 50, importThresholdW: 20 }, maxDeltaWPerSec: 1000000, ...storage }))),
  origin: 'dynamicGridConnection', operation: 'active',
});
const ownSnapshot = (cfg, m0 = 130000, m1 = 20000, powers = {}) => {
  const result = snapshot(cfg, m0, m1, powers);
  for (const value of Object.values(result.storages)) value.ts = NOW - 1000;
  return result;
};
const cheapTariff = (overrides = {}) => ({ ts: NOW, tarifAktiv: true, currentPriceFresh: true, state: 'guenstig', prioritaet: 1, netFeeEnabled: false, ...overrides });

test('aktive App verwendet eigene Ziele und SoC statt globaler Single-/Farm-Policies', () => {
  const cfg = ownConfig([{ ...member('own'), minSoc: 5, maxSoc: 95, strategy: { targetGridImportW: 700, importThresholdW: 10 } }]);
  const opts = options(cfg, {
    rootConfig: { storage: { standaloneSelfDischargeEnabled: false, standaloneSelfMinSocPct: 90, standaloneSelfTargetGridImportW: 50000 }, enableMultiUse: true, installerConfig: { storageMultiUse: { enabled: true } } },
    groupPolicies: { home: { storageConfig: { standaloneSelfDischargeEnabled: false } } },
  });
  opts.storageTelemetry.own.socPct = 15;
  const result = planGroups(cfg, ownSnapshot(cfg, 0, 20000), opts);
  assert.equal(result.groups[0].requestedW, 19300);
  assert.equal(result.groups[0].proposedW, 19300);
  assert.equal(result.groups[0].policySource, 'dynamicGridConnection.strategy');
  assert.equal(result.hypothetical, false);
  assert.equal(result.applied, false);
  assert.ok(result.requests.every(request => request.hypothetical === false && request.applied === false));
});

test('SoC-Grenzen gelten pro Mitglied und vererben sich nicht vom ersten Gruppenspeicher', () => {
  const cfg = ownConfig([{ ...member('a'), minSoc: 80 }, { ...member('b'), minSoc: 10 }]);
  const result = planGroups(cfg, ownSnapshot(cfg, 0, 30000), options(cfg));
  assert.equal(result.requests.find(request => request.storageId === 'a').maxW, 0);
  assert.equal(result.requests.find(request => request.storageId === 'b').proposedW, 29950);
  assert.equal(result.groups[0].proposedW, 29950);
});

test('eigener Peak-Zielwert ist ohne Fremdplan gültig; nur frischer Override ersetzt ihn', () => {
  const cfg = ownConfig([{ ...member('peak', 'M0', 'peakShaving', 'peak'), strategy: { targetGridImportW: 50, importThresholdW: 20, peakLimitW: 80000 } }]);
  const snap = ownSnapshot(cfg, 100000, 0, { peak: 10000 });
  assert.equal(planGroups(cfg, snap, options(cfg)).groups[0].requestedW, 30000);
  assert.equal(planGroups(cfg, snap, options(cfg, { peakTargetsByGroup: { peak: { valid: true, ts: NOW, targetImportW: 90000 } } })).groups[0].requestedW, 20000);
  assert.equal(planGroups(cfg, snap, options(cfg, { peakTargetsByGroup: { peak: { valid: true, ts: NOW - 6000, targetImportW: 90000 } } })).groups[0].requestedW, 30000);
});

test('externe Arbitrage bleibt ohne Sollwert; EOS benötigt explizite frische Anforderung', () => {
  const cfg = ownConfig([{ ...member('trade', 'M0', 'arbitrage', 'trade'), authority: 'external' }]);
  assert.equal(planGroups(cfg, ownSnapshot(cfg), options(cfg)).requests[0].proposedW, null);
  cfg.storages[0].authority = 'eos';
  const request = { valid: true, ts: NOW, requestedW: -25000 };
  const opts = options(cfg, { externalRequestsByGroup: { trade: request } });
  assert.equal(planGroups(cfg, ownSnapshot(cfg), opts).groups[0].status, 'arbitrage-request-unavailable');
  cfg.storages[0].requestPowerMeasurement = measurement('trade.request');
  assert.equal(planGroups(cfg, ownSnapshot(cfg), opts).groups[0].proposedW, -25000);
  for (const ts of [NOW - 6000, NOW + 1]) {
    request.ts = ts;
    assert.equal(planGroups(cfg, ownSnapshot(cfg), opts).requests.length, 0);
  }
});

test('Tarif nutzt eigene Ladefähigkeit trotz deaktivierter alter Single-/Farm-Ausgänge', () => {
  const cfg = ownConfig([member('tariff', 'M1', 'tariff', 'tariff')]);
  const result = planGroups(cfg, ownSnapshot(cfg, 0, 20000), options(cfg, {
    tariffSnapshot: cheapTariff({ storageWriterAvailable: false, storageGridChargeAllowed: false, speicherLeistungW: 0 }),
    tariffRequestsByGroup: { tariff: { valid: true, ts: NOW, requestedW: -12000 } },
  }));
  assert.equal(result.groups[0].tariffPermission.allowed, true);
  assert.equal(result.groups[0].requestedW, -12000);
  assert.equal(result.groups[0].proposedW, -12000);
});

test('Tarifsperre, Stale, Zukunft, Priorität und fehlendes NT-Fenster fallen auf eigenen EVO zurück', () => {
  const cfg = ownConfig([member('tariff', 'M1', 'tariff', 'tariff')]);
  const snapshots = [undefined, cheapTariff({ state: 'teuer' }), cheapTariff({ state: 'neutral' }), cheapTariff({ ts: NOW - 6000 }), cheapTariff({ ts: NOW + 1 }), cheapTariff({ currentPriceFresh: false }), cheapTariff({ tarifAktiv: false }), cheapTariff({ prioritaet: 3 }), cheapTariff({ netFeeEnabled: true, netFeeMode: 'NT', storageManualWindowActive: false })];
  for (const tariffSnapshot of snapshots) {
    const result = planGroups(cfg, ownSnapshot(cfg, 0, 20000), options(cfg, { tariffSnapshot, tariffRequestsByGroup: { tariff: { valid: true, ts: NOW, requestedW: -12000 } } }));
    assert.equal(result.groups[0].tariffPermission.allowed, false);
    assert.equal(result.groups[0].requestedW, 19950);
    assert.equal(result.groups[0].proposedW, 19950);
  }
  const permitted = planGroups(cfg, ownSnapshot(cfg), options(cfg, { tariffSnapshot: cheapTariff({ netFeeEnabled: true, netFeeMode: 'NT', storageManualWindowActive: true }) }));
  assert.equal(permitted.groups[0].requestedW, -100000);
});

test('individuelle Rampen vor Verteilung schützen langsame Geräte trotz großer Summenrampe', () => {
  const cfg = ownConfig([{ ...member('slow'), maxDeltaWPerSec: 100 }, { ...member('fast'), maxDeltaWPerSec: 10000 }]);
  const result = planGroups(cfg, ownSnapshot(cfg, 0, 100000), options(cfg));
  assert.equal(result.requests.find(request => request.storageId === 'slow').proposedW, 100);
  assert.equal(result.requests.find(request => request.storageId === 'fast').proposedW, 10000);
  assert.equal(result.groups[0].proposedW, 10100);
  assert.equal(result.nextState.groups.home.members.slow.limitedTargetW, 100);
});

test('individuelle Budgetrückführung verhindert unzulässige Umverteilung einer Gruppensumme', () => {
  const cfg = ownConfig([{ ...member('slow'), maxDeltaWPerSec: 100 }, { ...member('fast'), maxDeltaWPerSec: 1000 }]);
  const result = planGroups(cfg, ownSnapshot(cfg, 0, 100000), options(cfg, {
    previousState: { configVersion: 1, groups: { home: { ts: NOW - 1000, limitedTargetW: 50000, members: { slow: { limitedTargetW: 25000 }, fast: { limitedTargetW: 25000 } } } } },
    budgetFeedbackByStorage: { slow: { valid: true, ts: NOW - 1000, configVersion: 1, acceptedW: 0 }, fast: { valid: true, ts: NOW - 1000, configVersion: 1, acceptedW: 2000 } },
  }));
  assert.equal(result.requests.find(request => request.storageId === 'slow').proposedW, 100);
  assert.equal(result.requests.find(request => request.storageId === 'fast').proposedW, 3000);
  assert.equal(result.groups[0].ramp.feedbackUsed, true);
});

test('erster frischer Messzyklus hält Rampenanker; Folgezyklus darf weiterfahren', () => {
  const cfg = ownConfig([{ ...member('own'), maxDeltaWPerSec: 1000 }]);
  const first = planGroups(cfg, snapshot(cfg, 0, 50000), options(cfg));
  assert.equal(first.groups[0].proposedW, 0);
  const secondSnapshot = snapshot(cfg, 0, 50000);
  secondSnapshot.ts += 1000;
  for (const value of [...Object.values(secondSnapshot.points), ...Object.values(secondSnapshot.storages)]) value.ts += 1000;
  const second = planGroups(cfg, secondSnapshot, options(cfg, { nowMs: NOW + 1000, previousState: first.nextState }));
  assert.equal(second.groups[0].proposedW, 1000);
});

test('fehlende aktive Rampe oder Fähigkeit erzeugt keinen Null-Ersatzauftrag', () => {
  const cfg = ownConfig([{ ...member('own'), maxDeltaWPerSec: null }]);
  const result = planGroups(cfg, ownSnapshot(cfg), options(cfg));
  assert.equal(result.groups[0].status, 'capability-unverified');
  assert.equal(result.groups[0].requestedW, 19950);
  assert.equal(result.groups[0].proposedW, null);
  assert.equal(result.requests.length, 0);
});

test('Tarif-EVO und eigenständige EVO duplizieren keinen lokalen Bilanzfehler', () => {
  const cfg = ownConfig([member('evo', 'M1', 'selfConsumption', 'evo'), member('tariff', 'M1', 'tariff', 'tariff')]);
  const result = planGroups(cfg, ownSnapshot(cfg), options(cfg));
  assert.equal(result.requests.length, 0);
  assert.ok(result.groups.every(group => group.status === 'duplicate-local-regulator'));
});
