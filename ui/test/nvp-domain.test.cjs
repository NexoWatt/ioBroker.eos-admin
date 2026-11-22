'use strict';
// Fachliche NVP-Prüfungen: keine Hardware, keine Schreibrechte und keine Herstellerfreigabe.
const test = require('node:test');
const assert = require('node:assert/strict');
const topology = require('../ems/services/nvp-topology');
const budget = require('../ems/services/nvp-budget');
const { NvpGrantLedger } = require('../ems/services/nvp-grants');

function measurement(stateId) { return { stateId, physicalSourceId: stateId.replace(/\./g, '-'), unit: 'W', sign: 1, maxAgeMs: 5000 }; }
function configuration() {
  return { schemaVersion: 1, configVersion: 1, mode: 'dynamic', operation: 'diagnostic', rootPointId: 'M0', maxSkewMs: 1000,
    points: ['M0', 'M1'].map((id, i) => ({ id, name: id, parentId: i ? 'M0' : null, measurement: measurement(`meter.${i}`), importLimitW: i ? 100000 : 250000, exportLimitW: i ? 0 : 250000, importReserveW: i ? 0 : 25000, exportReserveW: i ? 0 : 25000, failurePolicyId: 'local-protection' })),
    storages: [
      { id: 'storage-farm-0', connectionPointId: 'M0', controlPointId: 'M0', dispatchGroupId: 'outer', primaryPurpose: 'externalArbitrage', authority: 'external', powerMeasurement: measurement('tesvolt.power'), maxChargeW: 250000, maxDischargeW: 250000, minSoc: 10, maxSoc: 90 },
      { id: 'storage-farm-1', connectionPointId: 'M1', controlPointId: 'M1', dispatchGroupId: 'house', primaryPurpose: 'selfConsumption', authority: 'eos', powerMeasurement: measurement('fenecon.power'), maxChargeW: 50000, maxDischargeW: 50000, minSoc: 10, maxSoc: 90 },
    ], pvAssignments: [{ id: 'kostal', connectionPointId: 'M0', referencePowerW: 100000 }] };
}

test('T01/T02: absent topology stays static; second meter is never discovered or assigned', () => {
  assert.deepEqual(topology.validateTopology().config, topology.staticDefaults());
  const configured = topology.validateTopology({ points: [] });
  assert.equal(configured.valid, true); assert.equal(configured.config.mode, 'static');
  assert.deepEqual(configured.config.storages, []);
});

test('T03/T28: topology rejects duplicate real/alias sources and corrupt hierarchy', () => {
  let c = configuration(); c.points[1].parentId = null;
  assert.equal(topology.validateTopology(c).valid, false);
  c = configuration(); c.points[1].measurement.physicalSourceId = c.points[0].measurement.physicalSourceId;
  assert.ok(topology.validateTopology(c).errors.some(e => e.code === 'duplicate-source'));
  c = configuration();
  assert.ok(topology.validateTopology(c, { resolveSourceId: () => 'same-physical-source' }).errors.some(e => e.code === 'duplicate-source'));
  c = configuration(); c.points[0].id = 'M2';
  assert.equal(topology.validateTopology(c).valid, false);
});

test('T28: strict numeric values, literal zero limits and explicit absent M1 limits', () => {
  for (const value of [null, '', '250000', true, false, Infinity, NaN, -1]) {
    const c = configuration(); c.points[0].importLimitW = value;
    assert.equal(topology.validateTopology(c).valid, false, `reject ${String(value)}`);
  }
  const c = configuration(); c.points[1].importLimitW = null; c.points[1].exportLimitW = 0;
  const result = topology.validateTopology(c);
  assert.equal(result.valid, true); assert.equal(result.config.points[1].importLimitW, null);
  assert.equal(result.config.points[1].exportLimitW, 0);
  delete c.points[1].exportLimitW;
  assert.equal(topology.validateTopology(c).valid, false, 'unknown omitted limit is not unlimited');
});

test('NVP-03/NVP-10: groups remain homogeneous and physical control cannot cross areas', () => {
  let c = configuration(); c.storages[1].dispatchGroupId = 'outer';
  assert.ok(topology.validateTopology(c).errors.some(e => e.code === 'mixed-dispatch-group'));
  c = configuration(); c.storages[1].controlPointId = 'M0';
  assert.ok(topology.validateTopology(c).errors.some(e => e.code === 'cross-area-control'));
  c = configuration(); c.storages[0].authority = 'eos';
  assert.ok(topology.validateTopology(c).errors.some(e => e.code === 'authority-purpose'));
  const ok = topology.validateTopology(configuration()); assert.equal(ok.valid, true);
  assert.deepEqual(ok.config.storages[1].ancestorGuards, ['M0']);
  assert.equal(topology.groupStorages(ok.config).length, 2);
});

test('T23/T29: active external profiles and unsupported electrical limits do not pretend to be verified', () => {
  const c = configuration(); c.operation = 'active';
  assert.ok(topology.validateTopology(c).errors.some(e => e.code === 'external-profile-unverified'));
  c.storages[0].profileId = 'verified-test'; c.points[0].phaseLimitsA = [100, 100, 100];
  assert.ok(topology.validateTopology(c, { supportedProfileIds: ['verified-test'] }).errors.some(e => e.code === 'electrical-profile-required'));
});

test('T04–T07: only contained actors affect local point; outer storage cannot remove M1 export', () => {
  assert.equal(topology.affectsPoint('M0', 'M1'), false);
  assert.equal(topology.affectsPoint('M1', 'M0'), true);
  const points = [{ id: 'M0', importLimitW: 225000, exportLimitW: 225000 }, { id: 'M1', importLimitW: 100000, exportLimitW: 0 }];
  const result = budget.evaluateIntervals({ points, residuals: { M0: { minW: -100000, maxW: -100000 }, M1: { minW: -20000, maxW: -20000 } }, participants: [{ id: 'tesvolt', connectionPointId: 'M0', minPowerW: -100000, maxPowerW: -100000 }] });
  assert.equal(result.points[0].gridMinW, 0);
  assert.equal(result.points[1].gridMinW, -20000);
  assert.equal(result.points[1].safe, false);
});

test('T11: all five independent specification examples including forced support', () => {
  const cases = [[20000, 20000, -205000, 245000], [-180000, -180000, -250000, 45000], [260000, 260000, 35000, 250000], [-260000, -260000, -250000, -35000], [-20000, 60000, -165000, 205000]];
  for (const [residualMinW, residualMaxW, expectedMin, expectedMax] of cases) {
    const result = budget.computeStorageCorridor({ residualMinW, residualMaxW, importLimitW: 225000, exportLimitW: 225000, minPowerW: -250000, maxPowerW: 250000 });
    assert.equal(result.valid, true); assert.equal(result.minPowerW, expectedMin); assert.equal(result.maxPowerW, expectedMax);
    if (expectedMin > 0 || expectedMax < 0) { assert.equal(result.requiresSupport, true); assert.equal(result.maxChargeW, null); assert.equal(result.maxDischargeW, null); }
  }
});

test('T12: transition never grants the expected 30 kW of support before it exists', () => {
  const transition = budget.computeStorageCorridor({ residualMinW: 60000, residualMaxW: 90000, importLimitW: 225000, exportLimitW: 225000, minPowerW: -250000, maxPowerW: 250000 });
  assert.equal(transition.maxChargeW, 135000);
  assert.equal(90000 + transition.maxChargeW, 225000);
  assert.equal(90000 + 165000, 255000, 'optimistic endpoint would violate the limit');
  const applied = budget.computeStorageCorridor({ residualMinW: 60000, residualMaxW: 60000, importLimitW: 225000, exportLimitW: 225000, minPowerW: -250000, maxPowerW: 250000 });
  assert.equal(applied.maxChargeW, 165000);
});

test('T08–T10: allocated independent maxima cannot reuse one site budget', () => {
  const participants = ['a', 'b', 'c'].map(id => ({ id, connectionPointId: 'M0', minPowerW: -250000, maxPowerW: 250000 }));
  const result = budget.allocateIndependentBudgets({ points: [{ id: 'M0', importLimitW: 225000, exportLimitW: 225000 }], residuals: { M0: { minW: 20000, maxW: 20000 } }, participants });
  assert.equal(result.safe, true); assert.equal(result.grants.length, 3);
  assert.equal(result.grants.reduce((sum, p) => sum + p.maxChargeW, 0), 205000);
  assert.equal(result.grants.reduce((sum, p) => sum + p.maxDischargeW, 0), 245000);
});

test('T08/T09: property test every extreme combination against physical summation for 250 deterministic cases', () => {
  let seed = 523;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let run = 0; run < 250; run++) {
    const r0 = Math.floor(rnd() * 80000) - 40000, r1 = Math.floor(rnd() * 20000) - 10000;
    const residuals = { M0: { minW: r0 - 10000, maxW: r0 + 10000 }, M1: { minW: r1 - 3000, maxW: r1 + 3000 } };
    const points = [{ id: 'M0', importLimitW: 100000, exportLimitW: 90000 }, { id: 'M1', importLimitW: 35000, exportLimitW: 25000 }];
    const participants = [0, 1, 2].map(i => ({ id: `p${i}`, connectionPointId: i === 0 ? 'M0' : 'M1', minPowerW: -Math.floor(rnd() * 80000), maxPowerW: Math.floor(rnd() * 80000) }));
    const result = budget.allocateIndependentBudgets({ points, residuals, participants });
    assert.equal(result.safe, true);
    for (let mask = 0; mask < 8; mask++) {
      const values = result.participants.map((p, i) => mask & (1 << i) ? p.maxPowerW : p.minPowerW);
      for (const point of points) for (const residual of [residuals[point.id].minW, residuals[point.id].maxW]) {
        let measuredGrid = residual;
        for (let i = 0; i < participants.length; i++) if (point.id === 'M0' || participants[i].connectionPointId === 'M1') measuredGrid -= values[i];
        assert.ok(measuredGrid <= point.importLimitW && measuredGrid >= -point.exportLimitW, `${run} ${mask} ${point.id}`);
      }
    }
  }
});

test('T13–T15: infeasible residual and empty interval never produce usable maximum grants', () => {
  const empty = budget.computeStorageCorridor({ residualMinW: 600000, residualMaxW: 600000, importLimitW: 225000, exportLimitW: 225000, minPowerW: -250000, maxPowerW: 250000 });
  assert.equal(empty.valid, false); assert.equal(empty.maxChargeW, null);
  const result = budget.allocateIndependentBudgets({ points: [{ id: 'M0', importLimitW: 225000, exportLimitW: 225000 }], residuals: { M0: { minW: 260000, maxW: 260000 } }, participants: [{ id: 'one', connectionPointId: 'M0', minPowerW: -250000, maxPowerW: 250000 }] });
  assert.equal(result.valid, false); assert.deepEqual(result.grants, []);
});

test('T31: old external charge right blocks withdrawal of ESS support until effective curtailment', () => {
  const points = [{ id: 'M0', importLimitW: 225000, exportLimitW: 225000 }];
  const current = { id: 'tesvolt', connectionPointId: 'M0', minPowerW: -175000, maxPowerW: 0 };
  const check = (r, min) => budget.evaluateIntervals({ points, residuals: { M0: { minW: r, maxW: r } }, participants: [{ ...current, minPowerW: min }] });
  assert.equal(check(50000, -175000).safe, true);
  assert.equal(check(80000, -175000).safe, false);
  assert.equal(check(80000, -145000).safe, true);
  const allocated = budget.allocateIndependentBudgets({ points, residuals: { M0: { minW: 50000, maxW: 80000 } }, participants: [{ ...current, minPowerW: -250000, maxPowerW: 250000, reservedMinW: -175000, reservedMaxW: 0, desiredMinW: -145000, desiredMaxW: 0 }] });
  assert.equal(allocated.valid, false, 'sending lower limit alone does not release old right');
});

test('T16/T17/T18: PV uses strictest generation limit; stale EVU and unconverted export limits fail closed', () => {
  for (const limitW of [60000, 30000, 0]) {
    assert.equal(budget.computePvLimit({ deviceMaxW: 100000, requirements: [{ kind: 'generation', limitW, valid: true }, { kind: 'generation', limitW: 40000, valid: true }] }).limitW, Math.min(limitW, 40000));
  }
  assert.equal(budget.computePvLimit({ deviceMaxW: 100000, requirements: [{ kind: 'generation', limitW: 100000, valid: false }] }).valid, false);
  assert.equal(budget.computePvLimit({ deviceMaxW: 100000, requirements: [{ kind: 'export', limitW: 0, valid: true }] }).valid, false);
  assert.equal(budget.computePvLimit({ deviceMaxW: 100000, previousW: 30000, rampUpW: 1000, requirements: [] }).limitW, 31000);
  assert.equal(budget.computePvLimit({ deviceMaxW: 100000, previousW: 30000, rampUpW: 1000, requirements: [{ kind: 'generation', limitW: 0, valid: true }] }).limitW, 0);
});

test('T19/T32: shared AC port and optional external charging never become fictitious generation capacity', () => {
  const hybrid = budget.hybridStorageBounds({ acPortLimitW: 100000, pvMinW: 70000, pvMaxW: 90000, minPowerW: -100000, maxPowerW: 100000 });
  assert.equal(hybrid.maxPowerW, 10000);
  const result = budget.evaluateIntervals({ points: [{ id: 'M0', importLimitW: 225000, exportLimitW: 0 }], residuals: { M0: { minW: -100000, maxW: -100000 } }, participants: [{ id: 'trader', connectionPointId: 'M0', minPowerW: -100000, maxPowerW: 0 }] });
  assert.equal(result.safe, false, 'trader may choose zero rather than absorb PV');
  assert.equal(result.points[0].gridMinW, -100000);
});

test('T20: measurements retain units/sign and reject stale, skewed, future or malformed values', () => {
  const m = measurement('x');
  for (const val of [null, false, '', '12', NaN, Infinity]) assert.equal(topology.readMeasurement(m, { val, ts: 10000, q: 0 }, 10000).valid, false);
  assert.equal(topology.readMeasurement({ ...m, unit: 'kW', sign: -1 }, { val: 20, ts: 10000, q: 0 }, 10000).valueW, -20000);
  assert.equal(topology.readMeasurement(m, { val: 0, ts: 10001, q: 0 }, 10000).reason, 'future-timestamp');
  assert.equal(topology.readMeasurement(m, { val: 0, ts: 4000, q: 0 }, 10000).reason, 'stale');
  assert.equal(topology.readMeasurement(m, { val: 0, ts: 10000, q: 64 }, 10000).reason, 'quality');
  const c = topology.validateTopology(configuration()).config;
  const states = Object.fromEntries([...c.points.map(p => p.measurement), ...c.storages.map(p => p.powerMeasurement)].map(x => [x.stateId, { val: 0, ts: 10000, q: 0 }]));
  assert.equal(topology.collectSnapshot(c, states, 10000).valid, true);
  states['meter.1'].ts = 8000;
  assert.equal(topology.collectSnapshot(c, states, 10000).errors.some(e => e.code === 'skew'), true);
  delete states['fenecon.power'];
  assert.equal(topology.collectSnapshot(c, states, 10000).storages['storage-farm-1'].valueW, null);
});

function ledgerFixture(simulation = true) {
  const ledger = new NvpGrantLedger({ sessionId: 'new-session', configVersion: 3, simulation, participants: [{ id: 'tesvolt', connectionPointId: 'M0', minPowerW: -250000, maxPowerW: 250000 }] });
  const evidence = { sessionId: 'new-session', configVersion: 3, appliedMinW: -175000, appliedMaxW: 100000, powerW: -40000, ts: 10000, quality: 'confirmed' };
  return { ledger, evidence };
}

test('T21/T22: receive ACK cannot narrow rights; exact fresh application can; duplicate and old sessions fail', () => {
  const { ledger, evidence } = ledgerFixture();
  assert.equal(ledger.synchronize('tesvolt', evidence, 10000), true);
  const { packet } = ledger.issue({ id: 'tesvolt', minPowerW: -145000, maxPowerW: 100000, validForMs: 1000, now: 10000 });
  assert.equal(packet.executable, false);
  assert.equal(ledger.received(packet), true); assert.equal(ledger.received(packet), false);
  assert.equal(ledger.reservedIntervals(10000)[0].minPowerW, -175000);
  assert.equal(ledger.applied({ ...packet, sessionId: 'old' }, { ...evidence, sequence: 1 }, 10000), false);
  assert.equal(ledger.applied(packet, { ...evidence, appliedMinW: -145000, sequence: packet.sequence, ts: 10010 }, 10010), true);
  assert.equal(ledger.reservedIntervals(10010)[0].minPowerW, -145000);
  assert.equal(ledger.applied(packet, { ...evidence, sequence: packet.sequence, ts: 10010 }, 10010), false);
});

test('T23/T26/T27: timeout and restart preserve possible power; only confirmed fallback can release ownership', () => {
  const { ledger, evidence } = ledgerFixture();
  assert.deepEqual([ledger.reservedIntervals(10000)[0].minPowerW, ledger.reservedIntervals(10000)[0].maxPowerW], [-250000, 250000]);
  ledger.synchronize('tesvolt', evidence, 10000);
  const { packet } = ledger.issue({ id: 'tesvolt', minPowerW: -145000, maxPowerW: 0, validForMs: 1000, now: 10000 });
  assert.equal(ledger.reservedIntervals(12000)[0].expiredUnconfirmed, true);
  assert.equal(ledger.reservedIntervals(12000)[0].minPowerW, -175000);
  assert.equal(ledger.canReleaseOwnership(), false);
  assert.equal(ledger.applied(packet, { ...evidence, sequence: packet.sequence, appliedMinW: -145000, appliedMaxW: 0, ts: 12000 }, 12000), false);
  assert.equal(ledger.confirmFallback('tesvolt', { ...evidence, sequence: packet.sequence, appliedMinW: 0, appliedMaxW: 0, powerW: 0, ts: 12000, localFallbackConfirmed: true }, 12000), true);
  assert.equal(ledger.canReleaseOwnership(), true);
  const restarted = new NvpGrantLedger({ configVersion: 3, participants: [{ id: 'tesvolt', connectionPointId: 'M0', minPowerW: -250000, maxPowerW: 250000 }] });
  assert.notEqual(restarted.sessionId, ledger.sessionId);
  assert.equal(restarted.received(packet), false);
  assert.equal(restarted.reservedIntervals(12000)[0].minPowerW, -250000);
});

test('unknown hardware profile cannot generate executable grant', () => {
  const { ledger, evidence } = ledgerFixture(false);
  assert.equal(ledger.synchronize('tesvolt', evidence, 10000), false);
  assert.equal(ledger.issue({ id: 'tesvolt', minPowerW: -100, maxPowerW: 100, validForMs: 1000, now: 10000 }).valid, false);
});

test('reserves are subtracted once and zero is never treated as missing', () => {
  assert.deepEqual(budget.operatingLimits({ id: 'M0', importLimitW: 250000, exportLimitW: 250000, importReserveW: 25000, exportReserveW: 25000 }), { id: 'M0', valid: true, importLimitW: 225000, exportLimitW: 225000, importConnectionLimitW: 250000, exportConnectionLimitW: 250000, importReserveW: 25000, exportReserveW: 25000 });
  assert.equal(budget.operatingLimits({ id: 'M1', importLimitW: null, exportLimitW: 0, importReserveW: 0, exportReserveW: 0 }).exportLimitW, 0);
  assert.equal(budget.operatingLimits({ id: 'M0', importLimitW: 10, exportLimitW: 10, importReserveW: 11, exportReserveW: 0 }).valid, false);
  assert.equal(budget.operatingLimits({ id: 'M0', importLimitW: null, exportLimitW: 10, importReserveW: 0, exportReserveW: 0 }).valid, false, 'unknown root limit is never unlimited');
});
