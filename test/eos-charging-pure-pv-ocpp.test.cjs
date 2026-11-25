/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { makeHarness } = require('../ui/scripts/verify-rc60-universal-auto-wallbox');
const { makeBudgetRuntime } = require('../ui/ems/modules/core-limits');
const { buildPvSurplusAllocation } = require('../ui/ems/services/pv-surplus-allocation');
const root = 'ocpp21.0.CP_01';
const wallbox = {
  chargerType: 'AC', controlBasis: 'powerW', phases: 3, phaseMode: 'fixed-3p', minPowerW: 4200,
  actualPowerWId: `${root}.measurements.powerW`, statusId: `${root}.info.status`,
  chargingStateId: `${root}.transactions.chargingState`, transactionActiveId: `${root}.transactions.transactionActive`,
  vehicleConnectedId: '', chargeDemandId: '', onlineId: `${root}.info.socketConnected`,
  dataFreshId: `${root}.health.dataFresh`, heartbeatId: `${root}.health.lastSeenMs`,
  setCurrentAId: '', setPowerWId: `${root}.control.chargeLimit`, enableId: `${root}.control.availability`,
  telemetryProfile: 'ocpp-1.6-event-driven',
};
function fixture(t, options = {}) {
  const h = makeHarness({ userMode: 'pv', wallbox, status: 'Charging', chargingState: 'Charging',
    transactionActive: true, actualPowerW: 5700, gridAllowed: true, ...options });
  // These three legacy-fixture stubs suppress the production final plan. Restore
  // real allocation, phase handling and the final executor for every assertion.
  for (const key of ['_publishChargingAllocationTsShadow', '_publishChargingPhaseSelectionRuntimeStates',
    '_publishChargingStationDiagnosticsFromAllocationPlan']) delete h.module[key];
  t.after(() => h.stop());
  return h;
}
function budget(h, pvW, actualW = 5700, status = 'Charging') {
  const now = Date.now();
  h.setObject(wallbox.actualPowerWId, actualW);
  h.setObject(wallbox.statusId, status === 'Charging' ? 'Charging' : 'Occupied');
  h.setObject(wallbox.chargingStateId, status);
  h.setObject(wallbox.heartbeatId, now);
  h.setObject(wallbox.onlineId, true); h.setObject(wallbox.dataFreshId, true);
  h.adapter._nvpFreshnessSnapshot = { ...h.adapter._nvpFreshnessSnapshot, ts: now,
    netW: actualW - pvW, measurementAgeMs: 0, heartbeatAgeMs: 0 };
  h.adapter._emsBudget = makeBudgetRuntime(h.adapter, { ts: now, raw: {}, gates: {
    total: { effectiveW: 11000 }, pv: { rawW: pvW, effectiveW: pvW },
    pvAllocation: buildPvSurplusAllocation(pvW, 'emobility', 100, { storageEligible: false }),
  } });
  h.writes.length = 0;
}

test('explicit pure PV cannot become grid charging under a negative-price preference', async t => {
  const h = fixture(t, { gridImportPreferred: true, negativeActive: true, priceCurrent: -0.10 });
  budget(h, 1000);
  const out = await h.tick();
  assert.equal(out.effectiveMode, 'pv');
  assert.equal(out.targetPowerW, 0, '1000W PV cannot support the configured 4200W 3-phase minimum');
  assert.ok(h.writes.some(write => write.key === 'cm.wb.lp1.setW' && write.value === 0));
  assert.equal(h.writes.some(write => write.key === 'cm.wb.lp1.setW' && write.value > 0), false);
  assert.equal(h.localStates.get('chargingManagement.wallboxes.lp1.userMode'), 'pv');
});

test('Min+PV retains its grid minimum and PV-only extra; Auto retains deliberate negative-price grid permission', async t => {
  for (const userMode of ['minpv', 'auto']) {
    const h = fixture(t, { userMode, gridImportPreferred: true, negativeActive: true, priceCurrent: -0.10 });
    budget(h, 0);
    const out = await h.tick();
    if (userMode === 'minpv') {
      assert.equal(out.effectiveMode, 'minpv');
      assert.equal(out.targetPowerW, 4200);
    } else {
      assert.equal(out.effectiveMode, 'normal');
      assert.ok(out.targetPowerW > 4140);
    }
  }
});

test('real pure-PV OCPP control requests stop after lost surplus, observes stopped telemetry and resumes with surplus', async t => {
  let clock = Date.now(); const realNow = Date.now; Date.now = () => clock;
  t.after(() => { Date.now = realNow; });
  const h = fixture(t, { status: 'Occupied', chargingState: 'EVConnected', transactionActive: true,
    actualPowerW: 0, gridImportPreferred: false });
  budget(h, 6000, 0, 'EVConnected');
  let out = await h.tick();
  assert.equal(out.effectiveMode, 'pv');
  assert.ok(out.targetPowerW >= 4140 && out.targetPowerW <= 6000, JSON.stringify(out));
  assert.ok(h.writes.some(write => write.key === 'cm.wb.lp1.setW' && write.value >= 4140));
  clock += 2000; budget(h, 6000, 5700);
  out = await h.tick(); assert.equal(out.vehicleDemandConfirmed, true);
  // An economic price flag must not override an already running explicit PV session.
  h.setLocal('tarif.negativpreisAktiv', true); h.setLocal('tarif.netzbezugBevorzugt', true);
  clock += 2000; budget(h, 1000, 5700);
  out = await h.tick();
  clock += 61000; budget(h, 1000, 5700);
  out = await h.tick();
  assert.equal(out.targetPowerW, 0); assert.equal(out.effectiveMode, 'pv');
  assert.ok(h.writes.some(write => write.key === 'cm.wb.lp1.setW' && write.value === 0));
  // Device feedback is simulated and separate from the accepted command.
  clock += 2000; budget(h, 1000, 0, 'SuspendedEVSE');
  out = await h.tick(); assert.equal(out.actualPowerW, 0); assert.equal(out.targetPowerW, 0);
  clock += 120000; budget(h, 6000, 0, 'SuspendedEVSE');
  out = await h.tick();
  assert.equal(out.effectiveMode, 'pv');
  assert.ok(out.targetPowerW >= 4140 && out.targetPowerW <= 6000, JSON.stringify(out));
  assert.ok(h.writes.some(write => write.key === 'cm.wb.lp1.setW' && write.value >= 4140));
});
