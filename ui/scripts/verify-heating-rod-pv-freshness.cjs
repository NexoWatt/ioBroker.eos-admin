#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * Reale Methoden der kanonischen Heizstabquelle, mit kontrollierter Zeit und
 * Mess-I/O. Prüft Morgenrampe, Forecast-Ausfall, fehlende Messungen und
 * Batterieversorgung. Kein Hardware-/Inbetriebnahmenachweis.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const runtimeFile = path.join(root, 'ems/modules/heating-rod-control.js');
function load(file) {
  const loaded = new Module(runtimeFile, module);
  loaded.filename = runtimeFile;
  loaded.paths = Module._nodeModulePaths(path.dirname(runtimeFile));
  loaded._compile(fs.readFileSync(file, 'utf8'), runtimeFile);
  return loaded.exports.HeatingRodControlModule;
}
const useRuntime = process.argv.includes('--runtime');
const HeatingRodControlModule = load(useRuntime ? runtimeFile : path.join(root, 'src-ts/runtime-executables/ems/modules/heating-rod-control.ts'));
const baseline = process.env.HEATER_BASELINE_FILE ? load(process.env.HEATER_BASELINE_FILE) : null;
let now = 1791442800000;
const actualDateNow = Date.now;
Date.now = () => now;
const checks = [];
function test(name, run) { run(); checks.push(name); }
function fixture(Klass = HeatingRodControlModule) {
  const meter = { pvW: 9000, actualW: 0, ageMs: 0, batteryAgeMs: 0, dischargeW: 0, flowSrc: 'batterySigned', flowDerived: false };
  const adapter = {
    namespace: 'nexowatt-ui.0',
    config: { enableHeatingRodControl: true, enableStorageControl: true,
      datapoints: { pvPower: 'test.pv', batteryPower: 'test.battery' },
      heatingRod: { autoMode: 'zeroExportForecast', storageReserveW: 0,
        zeroExport: { requireForecast: true, minPvPowerW: 1000, stepUpDelaySec: 60,
          probeObserveSec: 10, cooldownSec: 60, probeRetrySec: 300 } } },
    stateCache: {}, log: { warn() {}, error() {}, info() {}, debug() {} },
    _nwGetStorageControlAuthority: () => ({ selectedTopology: 'single', writerActive: true }),
    _nwResolveBatteryFlowFromCache(opts) {
      meter.lastOptions = opts;
      return { chargeW: 0, dischargeW: meter.dischargeW, grossDischargeW: meter.grossDischargeW ?? meter.dischargeW,
        derived: meter.flowDerived, src: meter.flowSrc,
        staleMs: { batteryPower: meter.batteryAgeMs, farmPower: meter.batteryAgeMs,
          farmCharge: meter.batteryAgeMs, farmDischarge: meter.batteryAgeMs } };
    },
  };
  const dp = {
    getEntry: key => key === 'rod.power' ? { objectId: 'test.rod.power' } : null,
    getMeasurementAgeMs: key => key === 'rod.power' ? meter.ageMs : null,
    getNumberFresh: key => key === 'rod.power' ? meter.actualW : null,
  };
  const mod = new Klass(adapter, dp);
  const device = { id: 'rod', enabled: true, stageCount: 3, wiredStages: 3, maxPowerW: 4500, pWKey: 'rod.power',
    stages: [1, 2, 3].map(index => ({ index, powerW: 1500, writeKey: `rod.s${index}` })) };
  function refresh() {
    adapter.stateCache.pvPower = { value: meter.pvW, ts: now };
    adapter._nvpFreshnessSnapshot = { usable: true, netW: 0, ts: now, measurementAgeMs: 0 };
    adapter._pvForecast = { ts: now, ageMs: 1000, valid: false,
      peakWNext24h: 12000, powerNowW: 9000, kwhNext6h: 6, kwhNext12h: 8, kwhNext24h: 12 };
  }
  const pv = { gridKnown: true, exportW: 0, importW: 0, currentHeatingRodW: 0,
    evcsUsedW: 0, storageReserveMissingW: 0, storageChargeUsableW: 0, storageChargeW: 0,
    storageDischargeW: 0, storageSocPct: 99, nvpAvailableW: 4500,
    budgetGateRemainingW: 4500, forecastStepCapW: 0, forecastUsable: false,
    gateCfg: { budgetSafetyReserveW: 0 } };
  refresh();
  const decide = (stage, desired = stage) => mod._applyZeroExportStageStrategy(device, desired, stage, pv,
    mod._computeZeroExportInfo(pv), now, meter.actualW);
  return { mod, adapter, meter, dp, device, pv, refresh, decide };
}
try {
  test('Frische tatsächliche 9 kW PV und gedeckte 4,5 kW funktionieren ohne Prognose', () => {
    const f = fixture();
    assert.equal(f.mod._computeZeroExportInfo(f.pv).forecastOk, false);
    assert.equal(f.mod._computeZeroExportInfo(f.pv).canProbe, true);
    assert.equal(f.decide(0).targetStage, 1);
    if (baseline) {
      const b = fixture(baseline);
      assert.equal(b.mod._computeZeroExportInfo(b.pv).canProbe, false, 'Altfehler muss reproduziert werden');
    }
  });
  test('Morgenrampe schaltet einzeln und wartet zwischen bestätigten Stufen', () => {
    const f = fixture();
    assert.equal(f.decide(0).targetStage, 1);
    now += 5000; f.meter.actualW = 1500; f.pv.currentHeatingRodW = 1500; f.refresh();
    assert.equal(f.decide(1).targetStage, 1);
    now += 6000; f.refresh();
    const confirmed = f.decide(1);
    assert.equal(confirmed.targetStage, 1);
    assert.equal(confirmed.reason, 'probe_nvp_budget_ok');
    now += 1000; f.refresh();
    assert.equal(f.decide(1).targetStage, 1);
    now += 49000; f.refresh();
    assert.equal(f.decide(1).targetStage, 2);
  });
  test('Forecast allein startet bei 0 W Ist-PV keine Stufe, auch nach Neustart', () => {
    const f = fixture(); f.meter.pvW = 0; f.refresh();
    f.adapter._pvForecast.valid = true;
    f.pv.nvpAvailableW = 0;
    assert.equal(f.mod._computeZeroExportInfo(f.pv).canProbe, false);
    assert.equal(f.decide(0).targetStage, 0);
    if (baseline) {
      const b = fixture(baseline); b.meter.pvW = 0; b.refresh(); b.adapter._pvForecast.valid = true;
      b.adapter._pvForecast.ts = now - 86400000; b.pv.nvpAvailableW = 0;
      assert.equal(b.mod._computeZeroExportInfo(b.pv).canProbe, true, 'Alter 24-h-Peak startet alte Probe');
    }
  });
  test('Forecast-Snapshot und Quelldaten haben begrenztes Alter und strikte Typen', () => {
    for (const patch of [{ ts: now - 60001 }, { ts: now + 1 }, { ageMs: 7200001 },
      { valid: 'true' }, { ageMs: null }, { peakWNext24h: '12000' }, { powerNowW: undefined }]) {
      const f = fixture(); f.adapter._pvForecast.valid = true; Object.assign(f.adapter._pvForecast, patch);
      assert.equal(f.mod._readForecastSnapshot().valid, false, JSON.stringify(patch));
    }
    const f = fixture(); f.adapter._pvForecast.valid = true;
    assert.equal(f.mod._readForecastSnapshot().valid, true);
    f.adapter._pvForecast.ts = now - 60001;
    f.adapter.stateCache['forecast.pv.valid'] = { value: true, ts: now };
    assert.equal(f.mod._readForecastSnapshot().valid, false, 'Cache darf ungültigen Snapshot nicht überstimmen');
  });
  test('Zeitlose/alte/future PV-Caches erzeugen keine Auto-Freigabe', () => {
    for (const record of [9000, { value: 9000 }, { value: 9000, ts: now - 5001 }, { value: 9000, ts: now + 1 }]) {
      const f = fixture(); f.adapter.stateCache.pvPower = record;
      f.adapter.stateCache['derived.core.pv.totalW'] = { value: 9000, ts: now };
      assert.equal(f.mod._readPvNowW(15000), 0);
      assert.equal(f.decide(0).targetStage, 0);
    }
  });
  test('Nachmittags-Peak wird nicht zu momentan verfügbarem PV-Budget', () => {
    const f = fixture(); f.meter.pvW = 1100; f.refresh(); f.adapter._pvForecast.valid = true;
    f.adapter._pvForecast.powerNowW = 0; f.adapter._pvForecast.peakWNext24h = 12000;
    f.pv.nvpAvailableW = 0;
    assert.equal(f.decide(0).targetStage, 0);
  });
  test('Speicherresolver erhält strictStale und veraltete Ladeleistung gibt kein Budget', () => {
    const f = fixture(); f.mod._readStorageSnapshot(15000);
    assert.equal(f.meter.lastOptions.strictStale, true);
    assert.ok(f.meter.lastOptions.maxAgeMs <= 5000);
    f.meter.batteryAgeMs = 5001;
    assert.equal(f.mod._readStorageSnapshot(15000).flowFresh, false);
    assert.equal(f.mod._computeZeroExportInfo(f.pv).canProbe, false);
  });
  test('Fehlende oder bilanzierte Batterie ist kein bestätigter Nullfluss', () => {
    for (const patch of [{ flowSrc: 'mapped-missing' }, { flowDerived: true }, { batteryAgeMs: null }]) {
      const f = fixture(); Object.assign(f.meter, patch);
      assert.equal(f.mod._computeZeroExportInfo(f.pv).canProbe, false);
      assert.equal(f.decide(0).targetStage, 0);
    }
    const f = fixture(); delete f.adapter.config.datapoints.batteryPower;
    f.adapter.config.datapoints.storageChargePower = 'test.charge';
    assert.equal(f.mod._computeZeroExportInfo(f.pv).canProbe, false, 'Ein Split-Kanal beweist keine Gegenrichtung');
  });
  test('Farm-Bruttoentladung sperrt auch bei Netto-Null oder Netto-Ladung', () => {
    const f = fixture(); f.adapter._nwGetStorageControlAuthority = () => ({ selectedTopology: 'farm', writerActive: true });
    f.meter.flowSrc = 'storageFarmNet'; f.meter.grossDischargeW = 500;
    assert.equal(f.mod._readStorageSnapshot(15000).dischargeW, 500);
    assert.equal(f.mod._computeZeroExportInfo(f.pv).canProbe, false);
  });
  test('Verlorene Messung beendet eine laufende Probe ohne fiktiven Erfolg', () => {
    for (const kind of ['storage', 'grid', 'pv']) {
      const f = fixture(); assert.equal(f.decide(0).targetStage, 1);
      now += 1000; f.refresh(); f.meter.actualW = 1500; f.pv.currentHeatingRodW = 1500;
      if (kind === 'storage') f.meter.flowSrc = 'mapped-missing';
      if (kind === 'grid') f.adapter._nvpFreshnessSnapshot.ts = now - 5001;
      if (kind === 'pv') f.adapter.stateCache.pvPower.ts = now - 5001;
      const result = f.decide(1);
      assert.equal(result.targetStage, 0, kind); assert.equal(result.reduceNow, true, kind);
      assert.equal(f.mod._stageCtl.get('rod').zeroProbe, null);
    }
  });
  test('PV-Anstieg kann Batterieentladung oder Netzbezug nicht bestätigen', () => {
    for (const kind of ['battery', 'grid']) {
      const f = fixture(); f.decide(0); now += 11000;
      f.meter.pvW = 12000; f.meter.actualW = 1500; f.pv.currentHeatingRodW = 1500; f.refresh();
      if (kind === 'battery') f.meter.dischargeW = 500;
      else f.adapter._nvpFreshnessSnapshot.netW = 1000;
      assert.equal(f.decide(1).targetStage, 0, kind);
    }
  });
  test('Bestätigte Stufen reduzieren nachhaltige 100/250-W-Batterieversorgung nach höchstens 3 s', () => {
    for (const dischargeW of [100, 250]) {
      const f = fixture(); f.meter.actualW = 1500; f.meter.dischargeW = dischargeW;
      f.pv.currentHeatingRodW = 1500; f.pv.storageDischargeW = dischargeW;
      f.mod._stageCtl.set('rod', { targetStage: 1, zeroProbe: null, lastIncreaseMs: now });
      f.adapter._pvForecast.valid = true;
      assert.equal(f.decide(1).targetStage, 1, 'Kurze bestätigte Reaktionszeit statt Relaisflattern');
      now += 2999; f.refresh(); f.adapter._pvForecast.valid = true;
      assert.equal(f.decide(1).targetStage, 1);
      now += 1; f.refresh(); f.adapter._pvForecast.valid = true;
      const result = f.decide(1);
      assert.equal(result.targetStage, 0, `${dischargeW} W darf nicht dauerhaft den Heizstab versorgen`);
      assert.equal(result.reduceNow, true);
      assert.equal(result.reason, 'storage_discharge_reduce');
    }
    const f = fixture(); f.meter.actualW = 1500; f.pv.currentHeatingRodW = 1500;
    f.mod._stageCtl.set('rod', { targetStage: 1, zeroProbe: null, lastIncreaseMs: now });
    f.meter.dischargeW = 100; f.decide(1);
    now += 1000; f.meter.dischargeW = 0; f.refresh();
    assert.equal(f.decide(1).targetStage, 1, 'Erholte kurze Transiente hält die Stufe');
    now += 2000; f.meter.dischargeW = 100; f.refresh();
    assert.equal(f.decide(1).targetStage, 1, 'Neue Entladung erhält ein neues begrenztes Beobachtungsfenster');
  });
  test('Relaiszustand/Sollwert allein bestätigt keine Heizleistung', () => {
    const f = fixture(); f.decide(0); now += 11000; f.refresh();
    f.meter.actualW = 0; f.pv.currentHeatingRodW = 1500;
    assert.equal(f.decide(1).targetStage, 0);
    const missing = fixture(); missing.meter.ageMs = 5001;
    assert.equal(missing.decide(0).targetStage, 0);
  });
  test('Reduziertes zentrales Budget überstimmt laufendes Beobachtungsfenster', () => {
    const f = fixture(); f.decide(0); now += 1000; f.refresh(); f.meter.actualW = 1500;
    f.pv.currentHeatingRodW = 1500; f.pv.budgetGateRemainingW = 0;
    const result = f.decide(1);
    assert.equal(result.targetStage, 0); assert.equal(result.reduceNow, true);
  });
  test('Zentralmodus bleibt exklusiv, Diagnose kann alten Forecastpfad nicht aktivieren', () => {
    const f = fixture(); f.adapter.config.gridConstraints = { zeroExportEnabled: true, exportLimitMaxFeedInW: 0, exportLimitRunMode: 'diagnostic' };
    assert.equal(f.mod._computeZeroExportInfo(f.pv).canProbe, false);
    assert.equal(f.decide(0).targetStage, 0);
  });
  console.log(JSON.stringify({ status: 'PASS', groups: checks.length, baselineRegressionReproduced: !!baseline,
    source: useRuntime ? 'generated-runtime' : 'canonical-source',
    scope: 'Kontrollierte Mess-I/O und Zeit, kein Hardwaretest', checks }, null, 2));
} finally { Date.now = actualDateNow; }
