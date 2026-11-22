#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * Echte Tick-/Relais-Verläufe der kanonischen Heizstabsteuerung, ohne Hardware.
 * Nur Adapter-I/O, Messwerte und Zeit sind simuliert. Nacht/AUS-Vorrang,
 * Ownership, Regler, zentrale Probe und native Stufen-Writer bleiben produktiv.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
function loadCanonical(relativePath) {
  const runtimePath = path.join(root, relativePath.replace(/\.ts$/, '.js'));
  const loaded = new Module(runtimePath, module);
  loaded.filename = runtimePath;
  loaded.paths = Module._nodeModulePaths(path.dirname(runtimePath));
  const normalRequire = Module.createRequire(runtimePath);
  loaded.require = name => name === '../services/zero-export-pv-coordinator' ? coordinator : normalRequire(name);
  loaded._compile(fs.readFileSync(path.join(root, 'src-ts/runtime-executables', relativePath), 'utf8'), runtimePath);
  return loaded.exports;
}
const runtimeMode = process.argv.includes('--runtime');
const coordinator = runtimeMode ? require('../ems/services/zero-export-pv-coordinator') : loadCanonical('ems/services/zero-export-pv-coordinator.ts');
const { HeatingRodControlModule } = runtimeMode ? require('../ems/modules/heating-rod-control') : loadCanonical('ems/modules/heating-rod-control.ts');
const realNow = Date.now;
let clock = new Date(2026, 9, 8, 19, 59, 0).getTime();
Date.now = () => clock;
const time = (hour, minute = 0, second = 0) => { clock = new Date(2026, 9, 8, hour, minute, second).getTime(); };

function fixture({ initialStage = 0, owned = false } = {}) {
  const writes = [];
  const states = new Map();
  const records = {};
  const rec = (key, val) => { records[key] = { val, ts: clock, objectId: `fixture.${key}` }; };
  rec('grid.powerW', 0); rec('pvPower', 9000); rec('batteryPower', 0); rec('storageSoc', 100);
  rec('rod.power', initialStage * 2000); rec('rod.enabled', true); rec('rod.mode', 'pvAuto');
  for (let i = 1; i <= 3; i++) { rec(`rod.write${i}`, i <= initialStage); rec(`rod.read${i}`, i <= initialStage); }
  const snapshot = { ts: clock, remainingTotalW: 6000, remainingPvW: 6000,
    gates: { grid: { measurementUsable: true }, tariff: { gridImportPreferred: false } } };
  const budget = { peek: () => snapshot,
    getPvGrant: () => ({ grantW: snapshot.remainingPvW }),
    getTotalGrant: () => ({ grantW: snapshot.remainingTotalW }), reserve() {} };
  const behavior = { fail: false, lag: false, missingReadback: false, afterWrite: null, balancePv: false, failPendingWrites: 0, pendingAttempts: 0 };
  const writeRelay = async (key, value) => {
    assert.match(key, /^rod\.write[123]$/);
    writes.push({ key, value: !!value, ts: clock });
    if (behavior.fail) throw new Error('simulated relay write failure');
    // Ein Hardware-ACK folgt dem Auftrag zeitlich; gleicher Millisekundenwert
    // eines zuvor gelesenen FALSE ist ausdrücklich noch keine OFF-Quittung.
    clock += 1;
    records[key].val = !!value; records[key].ts = clock;
    if (!behavior.lag) {
      const read = key.replace('write', 'read');
      records[read].val = !!value; records[read].ts = clock;
      records['rod.power'].val = [1, 2, 3].filter(i => records[`rod.read${i}`].val === true).length * 2000;
      records['rod.power'].ts = clock;
      if (behavior.balancePv) records.batteryPower.val = -Math.max(0, records.pvPower.val - 3000 - records['rod.power'].val);
    }
    if (behavior.afterWrite) await behavior.afterWrite(key, !!value);
    return true;
  };
  const dp = {
    getEntry: key => behavior.missingReadback && /^rod\.read/.test(key) ? null : records[key] || null,
    getMeasurementAgeMs: key => records[key] ? clock - records[key].ts : null,
    getAgeMs: key => records[key] ? clock - records[key].ts : null,
    isStale: (key, maxAge) => !records[key] || clock - records[key].ts > maxAge || clock < records[key].ts,
    getNumber: (key, fallback = null) => typeof records[key]?.val === 'number' && Number.isFinite(records[key].val) ? records[key].val : fallback,
    getNumberFresh(key, maxAge, fallback = null) { return this.isStale(key, maxAge) ? fallback : this.getNumber(key, fallback); },
    getBoolean: (key, fallback = null) => typeof records[key]?.val === 'boolean' ? records[key].val : fallback,
    getRaw: (key, fallback = null) => records[key]?.val ?? fallback,
    writeBoolean: writeRelay, lastWriteByObjectId: new Map(),
  };
  const adapter = { namespace: 'nexowatt-ui.0', stateCache: {}, _emsBudget: budget,
    _nwResolveBatteryFlowFromCache: () => ({ derived: false, src: 'batteryPower', staleMs: { batteryPower: clock - records.batteryPower.ts },
      chargeW: Math.max(0, -records.batteryPower.val), dischargeW: Math.max(0, records.batteryPower.val) }),
    config: { enableHeatingRodControl: true, enableStorageControl: true, datapoints: { batteryPower: 'fixture.batteryPower', pvPower: 'fixture.pvPower' },
      gridConstraints: { zeroExportEnabled: true, exportLimitMaxFeedInW: 0 },
      heatingRod: { blockPvAutoAtNight: true, nightStartTime: '20:00', nightEndTime: '06:00',
        autoMode: 'pvSurplus', minPvPowerW: 0, storageReserveW: 0, stageUpDelaySec: 20,
        minStageRunSec: 120, cooldownAfterOffSec: 0, staleTimeoutSec: 15 } },
    log: { warn() {}, info() {}, debug() {}, error() {} },
    async setStateAsync(id, val) {
      if (id.endsWith('.autoStopPending')) {
        behavior.pendingAttempts++;
        if (behavior.failPendingWrites > 0) { behavior.failPendingWrites--; throw new Error('simulated pending persistence failure'); }
      }
      states.set(id, { val, ts: clock });
    },
    async getStateAsync(id) { return states.get(id) || null; },
    async setForeignStateAsync(id, val) { return writeRelay(id.replace(/^fixture\./, ''), val); },
  };
  const device = { id: 'rod1', name: 'Test Heizstab', slot: 1, enabled: true, consumerType: 'heatingRod',
    mode: 'pvAuto', userEnabledKey: 'rod.enabled', userModeKey: 'rod.mode',
    stageCount: 3, wiredStages: 3, maxPowerW: 6000, minOnSec: 600, minOffSec: 0, requireReadback: true,
    pWKey: 'rod.power', stages: [1, 2, 3].map(index => ({ index, powerW: 2000,
      onAboveW: 2000 * index, offBelowW: 2000 * index - 200,
      writeKey: `rod.write${index}`, readKey: `rod.read${index}` })) };
  let controller;
  const restart = () => { controller = new HeatingRodControlModule(adapter, dp); controller._devices = [device]; };
  restart();
  if (owned) { controller._setStageCtlTarget(device.id, initialStage, initialStage); controller._markAutoOwnership(device, true, initialStage, 'pvAuto'); }
  const refresh = () => {
    snapshot.ts = clock;
    adapter.stateCache.pvPower = { value: records.pvPower.val, ts: clock };
    adapter._nvpFreshnessSnapshot = { usable: true, netW: records['grid.powerW'].val, ts: clock, measurementAgeMs: 0 };
    adapter._emsSafetyEnvelope = { valid: true, expiresAt: clock + 5000 };
    for (const record of Object.values(records)) record.ts = clock;
    coordinator.updateZeroExportProbe(adapter, { now: clock, gridW: records['grid.powerW'].val, gridFresh: true,
      pvW: records.pvPower.val, pvFresh: true, storageFresh: true,
      storageDischargeW: Math.max(0, records.batteryPower.val), safetyReady: true });
  };
  const tick = async (advance = 0) => { clock += advance; refresh(); await controller.tick(); };
  const state = suffix => states.get(`heatingRod.devices.rod1.${suffix}`)?.val;
  return { adapter, device, dp, behavior, records, writes, states, snapshot, restart, refresh, tick, state,
    get controller() { return controller; }, stage: () => [1, 2, 3].filter(i => records[`rod.read${i}`].val === true).length };
}

async function main() {
  let checks = 0;
  time(19, 59);
  const night = fixture({ initialStage: 3, owned: true });
  const ctl = night.controller._stageCtl.get('rod1');
  ctl.zeroProbe = { stage: 3, startMs: clock }; ctl.zeroCooldownUntilMs = clock + 86400000;
  time(20);
  await night.tick();
  assert.equal(night.stage(), 0, 'Nachtgrenze setzt alle Relais trotz Mindestlaufzeit AUS');
  assert.equal(night.state('targetStage'), 0);
  assert.equal(night.state('autoStopPending'), false);
  assert.equal(ctl.zeroProbe, null); assert.equal(ctl.zeroCooldownUntilMs, 0);
  const confirmedNightWrites = night.writes.length;
  await night.tick(1000);
  assert.equal(night.writes.length, confirmedNightWrites, 'Frisch bestätigtes AUS benötigt keine Relais-Dauerwrites');
  assert.equal(night.state('nightPvAutoBlocked'), true);
  assert(night.writes.every(w => w.value === false), 'Nachts darf Auto keinen EIN-Auftrag senden'); checks++;

  time(23);
  const failed = fixture({ initialStage: 2, owned: true });
  failed.behavior.fail = true;
  await failed.tick(); const firstWrites = failed.writes.length;
  assert.equal(failed.state('autoStopPending'), true);
  await failed.tick(1000);
  assert(failed.writes.length > firstWrites, 'Fehlgeschlagenes AUS muss erneut versucht werden');
  assert.match(failed.state('status'), /^night_pv_auto_blocked_pending/);
  failed.restart(); time(6);
  await failed.tick();
  assert.equal(failed.state('targetStage'), 0, 'Nach Neustart/Morgen bleibt offenes AUS vorrangig');
  assert.match(failed.state('status'), /^auto_stop_pending/);
  failed.behavior.fail = false; await failed.tick(1000);
  assert.equal(failed.stage(), 0); assert.equal(failed.state('autoStopPending'), false); checks++;

  time(20);
  const sameMillisecond = fixture();
  sameMillisecond.controller._setStageCtlTarget('rod1', 1, 1);
  sameMillisecond.controller._markAutoOwnership(sameMillisecond.device, true, 1, 'pvAuto');
  sameMillisecond.behavior.fail = true;
  await sameMillisecond.tick();
  assert.equal(sameMillisecond.state('writeAccepted'), false, 'Fixture erzeugt echte abgelehnte Hardwarewrites');
  assert.equal(sameMillisecond.state('autoStopPending'), true, 'Vorheriges FALSE/0W mit gleichem Zeitstempel bestätigt keinen fehlgeschlagenen OFF-Auftrag');
  assert.match(sameMillisecond.state('status'), /^night_pv_auto_blocked_pending/);
  sameMillisecond.restart(); time(6);
  const writesBeforeRestartRetry = sameMillisecond.writes.length;
  await sameMillisecond.tick();
  assert(sameMillisecond.writes.length > writesBeforeRestartRetry, 'Pending ohne RAM-Zeitnachweis nach Neustart muss zuerst erneut OFF senden');
  assert.equal(sameMillisecond.state('autoStopPending'), true);
  sameMillisecond.behavior.fail = false;
  await sameMillisecond.tick(1000);
  assert.equal(sameMillisecond.state('autoStopPending'), false, 'Erst zeitlich nachfolgende erfolgreiche OFF-Quittungen lösen Pending');
  time(20);
  const sameMillisecondAccepted = fixture();
  sameMillisecondAccepted.controller._setStageCtlTarget('rod1', 1, 1);
  sameMillisecondAccepted.controller._markAutoOwnership(sameMillisecondAccepted.device, true, 1, 'pvAuto');
  sameMillisecondAccepted.behavior.lag = true;
  await sameMillisecondAccepted.tick();
  assert.equal(sameMillisecondAccepted.state('writeAccepted'), true);
  assert.equal(sameMillisecondAccepted.state('autoStopPending'), true,
    'Auch erfolgreicher Schreibtransport macht gleich gestempeltes vorheriges FALSE/0W nicht zur Quittung');
  await sameMillisecondAccepted.tick(1000);
  assert.equal(sameMillisecondAccepted.state('autoStopPending'), false, 'Später separat gemeldetes AUS darf Pending auflösen'); checks++;

  time(23);
  const persistFail = fixture({ initialStage: 1, owned: true });
  persistFail.behavior.failPendingWrites = 2; persistFail.behavior.fail = true;
  await persistFail.tick();
  assert(persistFail.writes.length > 0, 'DB-Fehler darf physischen AUS-Versuch nicht verhindern');
  assert.equal(persistFail.state('autoStopPending'), undefined);
  await persistFail.tick(1000);
  assert.equal(persistFail.state('autoStopPending'), true, 'Nicht persistierte Werte dürfen nicht im Änderungscache hängen bleiben');
  persistFail.restart(); time(6); await persistFail.tick();
  assert.match(persistFail.state('status'), /^auto_stop_pending/); checks++;

  time(23);
  const lag = fixture({ initialStage: 1, owned: true });
  lag.behavior.lag = true;
  await lag.tick(); await lag.tick(1000);
  assert.equal(lag.state('autoStopPending'), true, 'Angenommener Schreibauftrag ist noch kein physisches AUS');
  assert.match(lag.state('status'), /^night_pv_auto_blocked_pending/);
  lag.records['rod.read1'].val = false;
  lag.records['rod.read2'].val = true;
  await lag.tick(1000);
  assert.equal(lag.state('autoStopPending'), true, 'Nicht zusammenhängende noch aktive Stufe2 bleibt unbestätigt'); checks++;

  time(23);
  const unknown = fixture({ initialStage: 2 });
  unknown.behavior.missingReadback = true;
  unknown.behavior.lag = true;
  unknown.records['rod.power'].val = null;
  await unknown.tick(); await unknown.tick(1000);
  assert(unknown.writes.length >= 6);
  assert(unknown.writes.every(w => !w.value));
  assert.equal(unknown.state('autoStopPending'), true, 'Unbekannte Rückmeldung ist keine externe Handfreigabe/kein AUS-Nachweis'); checks++;

  for (const mode of ['manual2', 'boost']) {
    time(23); const manual = fixture();
    if (mode === 'boost') manual.adapter._heatingRodOverrides = { rod1: { boostUntilMs: clock + 60000 } };
    else manual.records['rod.mode'].val = mode;
    await manual.tick();
    assert.equal(manual.stage(), mode === 'boost' ? 3 : 2, `${mode} bleibt explizite Freigabe`);
    if (mode === 'boost') { await manual.tick(61000); assert.equal(manual.stage(), 0, 'Abgelaufener Boost fällt nachts sicher AUS'); }
  } checks++;

  time(12);
  const regulationOff = fixture({ initialStage: 2, owned: true });
  regulationOff.records['rod.enabled'].val = false;
  await regulationOff.tick();
  assert.equal(regulationOff.stage(), 0, 'Regelung AUS beendet bisherige Auto-Last');
  const external = fixture({ initialStage: 2 });
  external.records['rod.enabled'].val = false;
  await external.tick();
  assert.equal(external.stage(), 2); assert.equal(external.writes.length, 0, 'Bewusster externer Handbetrieb bleibt getrennt'); checks++;

  time(5, 59, 59);
  const morning = fixture();
  await morning.tick(); time(6);
  morning.records.pvPower.val = 0; morning.snapshot.remainingPvW = 0; morning.snapshot.remainingTotalW = 0;
  await morning.tick();
  assert.equal(morning.stage(), 0, 'Einschaltzeit alleine gibt ohne PV keine Stufe frei');
  morning.records.pvPower.val = 9000; morning.records.batteryPower.val = -6000; morning.behavior.balancePv = true; morning.snapshot.remainingPvW = 6000; morning.snapshot.remainingTotalW = 6000;
  await morning.tick(1000); assert.equal(morning.stage(), 1, 'Morgens höchstens erste physische Stufe');
  await morning.tick(1000); assert.equal(morning.stage(), 1, 'Keine zweite Stufe vor Hochlaufwartezeit');
  await morning.tick(20000); assert.equal(morning.stage(), 2, 'Nächste Stufe erst nach Wartezeit');
  await morning.tick(20000); assert.equal(morning.stage(), 3, 'Dritte Stufe nach erneutem Warten');
  morning.snapshot.remainingPvW = 4000;
  await morning.tick(1000); assert.equal(morning.stage(), 2, 'Weniger gedeckte PV nimmt eine Stufe zurück');
  morning.records['grid.powerW'].val = 3000; morning.snapshot.remainingPvW = 0; morning.snapshot.remainingTotalW = 0;
  await morning.tick(1000); assert.equal(morning.stage(), 0, 'Defizit nimmt Last trotz Mindestlaufzeit sofort zurück'); checks++;

  time(12);
  const battery = fixture({ initialStage: 2, owned: true });
  battery.records.batteryPower.val = 2500;
  await battery.tick(); assert.equal(battery.stage(), 0, 'Harte Batterieentladung stoppt Auto'); checks++;

  for (const lag of [false, true]) {
    time(19, 59, 59);
    const boundary = fixture(); boundary.records.batteryPower.val = -6000; boundary.behavior.balancePv = true;
    boundary.behavior.lag = lag;
    boundary.behavior.afterWrite = async (_key, value) => { if (value) time(20); };
    await boundary.tick();
    assert.equal(boundary.stage(), 0, 'Über die Nachtgrenze laufender Schreibauftrag wird zurückgenommen');
    assert.equal(boundary.writes.filter(w => w.value && w.ts >= new Date(2026, 9, 8, 20).getTime()).length, 0,
      'Nach Grenzübertritt keine weiteren EIN-Aufträge');
    assert(boundary.writes.some(w => w.value), 'Test muss die Nachtgrenze in einem tatsächlichen EIN-Schreiben erreichen');
    for (let i = 1; i <= 3; i++) {
      assert(boundary.writes.some(w => w.key === `rod.write${i}` && w.value === false),
        'Auch bei zuvor FALSE zeigender Rückmeldung ist jeder bereits angeforderte Aktor aktiv AUS zu setzen');
      assert.equal(boundary.records[`rod.write${i}`].val, false);
    }
    if (lag) assert.equal(boundary.state('autoStopPending'), true, 'Vor dem OFF gemessene 0 W bestätigen den neuen Auftrag noch nicht');
    assert.equal(boundary.state('targetStage'), 0);
  } checks++;

  console.log(`[heating-rod-night-ramp:${runtimeMode ? 'runtime' : 'source'}] PASS: ${checks} echte Tick-/Verlaufsgruppen; Nacht, OFF-Fehler, Restart, fehlendes/widersprüchliches Readback, Manual/Boost, Regelung AUS, Morgenrampe, Defizit/Batterie, asynchrone Nachtgrenze.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { Date.now = realNow; });
