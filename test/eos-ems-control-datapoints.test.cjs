'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ChargingManagementModule } = require('../ui/ems/modules/charging-management');
const { EMS_CONTROL_FIELDS, checkedEmsControlState, validEmsControlValue } = require('../ui/lib/ems-control-values');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
// Isolated controller and protocol fixture, adapted from the existing
// availability regression harness. No real station or live network is used.
function makeAvailabilityTickHarness({ status = 'Unavailable', userStationEnabled = true, rfidEnforced = false, rfidAuthorized = true } = {}) {
  const states = new Map();
  const writes = [];
  const now = Date.now();
  const adapter = {
    namespace: 'nexowatt-ui.0',
    config: {
      enableChargingManagement: true,
      _chargingHasAnySetpoint: true,
      settingsConfig: { evcsCount: 1, stationGroups: [] },
      installerConfig: { gridConnectionPower: 30000, gridPhaseCount: 3, safetyMeterTimeoutSec: 30 },
      peakShaving: { maxPhaseA: 0 },
      chargingManagement: {
        mode: 'mixed', totalBudgetMode: 'static', staticMaxChargingPowerW: 11000,
        voltageV: 230, defaultPhases: 3, minCurrentA: 6, maxCurrentA: 16,
        wallboxes: [{
          key: 'lp1', name: 'OCPP21 Availability Test', enabled: true,
          telemetryProfile: 'nexowattocpp',
          actualPowerWId: 'ocpp21.0.CP_01.measurements.powerW',
          statusId: 'ocpp21.0.CP_01.info.status',
          transactionActiveId: 'ocpp21.0.CP_01.transactions.transactionActive',
          onlineId: 'ocpp21.0.CP_01.info.socketConnected',
          dataFreshId: 'ocpp21.0.CP_01.health.dataFresh',
          heartbeatId: 'ocpp21.0.CP_01.health.lastSeenMs',
          setPowerWId: 'ocpp21.0.CP_01.control.chargeLimit',
          enableId: 'ocpp21.0.CP_01.control.availability',
          maxPowerW: 11000, minA: 6, maxA: 16, phases: 3,
          userModeDefault: 'auto', controlBasis: 'powerW',
        }],
      },
    },
    _nvpFreshnessSnapshot: {
      ts: now, usable: true, fresh: true, connected: true, netW: 1000,
      status: 'ok', source: 'rc63-test-meter', reason: 'fresh', measurementAgeMs: 0, heartbeatAgeMs: 0,
    },
    _emsCaps: {},
    _emsBudget: {
      mode: 'rc63-test', gates: { grid: { effectiveW: 30000 }, pv: { effectiveW: 0 } },
      remainingTotalW: 30000, remainingPvW: 0, reservations: [],
    },
    log: { debug() {}, info() {}, warn() {}, error() {} },
    async setStateAsync(id, value) {
      states.set(String(id), value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'val') ? value.val : value);
    },
    async getStateAsync(id) {
      return states.has(String(id)) ? { val: states.get(String(id)), ts: Date.now(), ack: true } : null;
    },
    async setObjectNotExistsAsync() {},
    async getObjectAsync() { return null; },
    _nwRequestImmediateEmsTick() { return true; },
  };
  states.set('chargingManagement.wallboxes.lp1.userMode', 'auto');
  states.set('chargingManagement.wallboxes.lp1.userAutoSource', 'standard');
  states.set('chargingManagement.wallboxes.lp1.userStationEnabled', userStationEnabled);
  states.set('chargingManagement.wallboxes.lp1.userEnabled', true);
  states.set('chargingManagement.wallboxes.lp1.userStorageAssistEnabled', false);
  states.set('evcs.1.rfidEnforced', rfidEnforced);
  states.set('evcs.1.rfidAuthorized', rfidAuthorized);
  states.set('evcs.1.rfidReason', rfidEnforced ? (rfidAuthorized ? 'whitelisted' : 'not_whitelisted') : 'rfid_disabled');

  const values = new Map();
  const entries = new Map();
  const dp = {
    entries,
    lastWriteByObjectId: new Map(),
    async upsert(entry) {
      entries.set(entry.key, { ...entry });
      if (entry.key.endsWith('.pW')) values.set(entry.key, 0);
      else if (entry.key.endsWith('.onlineRaw')) values.set(entry.key, true);
      else if (entry.key.endsWith('.dataFreshRaw')) values.set(entry.key, true);
      else if (entry.key.endsWith('.st')) values.set(entry.key, status);
      else if (entry.key.endsWith('.transactionActiveRaw')) values.set(entry.key, false);
      else if (entry.key.endsWith('.heartbeatRaw')) values.set(entry.key, Date.now());
      else if (entry.key.endsWith('.ocppAdapterAliveRaw')) values.set(entry.key, true);
      return entry;
    },
    getEntry(key) { return entries.get(key) || null; },
    getNumber(key, fallback = null) { const value = values.get(key); return Number.isFinite(Number(value)) ? Number(value) : fallback; },
    getRaw(key, fallback = null) { return values.has(key) ? values.get(key) : fallback; },
    getAgeMs() { return 0; },
    getMeasurementAgeMs() { return 0; },
    getConnectionStatus() { return true; },
    async writeNumber(key, value) { writes.push({ type: 'number', key, value: Number(value) }); values.set(key, Number(value)); return true; },
    async writeBoolean(key, value) { writes.push({ type: 'boolean', key, value: !!value }); values.set(key, !!value); return true; },
  };
  return { adapter, dp, states, writes };
}

async function tickFixture(patch = {}, cache = false, second = false) {
    const h = makeAvailabilityTickHarness({ status: 'Preparing' });
    if (second) {
        const one = h.adapter.config.chargingManagement.wallboxes[0];
        const two = Object.fromEntries(Object.entries(one).map(([key, value]) => [key, typeof value === 'string' ? value.replaceAll('CP_01', 'CP_02') : value]));
        two.key = 'lp2'; two.name = 'Independent second point';
        h.adapter.config.chargingManagement.wallboxes.push(two);
        h.adapter.config.settingsConfig.evcsCount = 2;
    }

    const base = 'chargingManagement.wallboxes.lp1.';
    for (const [field, value] of Object.entries(patch)) h.states.set(base + field, value);
    if (cache) h.adapter.stateCache = Object.fromEntries([...h.states].map(([id, val]) => [id, { value: val, ts: Date.now() }]));
    const module = new ChargingManagementModule(h.adapter, h.dp);
    module._queueState = async (id, value) => h.states.set(String(id), value);
    module._flushPubQueue = async () => {};
    module._recordChargingAudit = async () => {};
    for (const name of ['_publishChargingControlTsShadow', '_publishChargingAllocationTsShadow', '_publishChargingStationDiagnosticsFromAllocationPlan', '_publishChargingPhaseSelectionRuntimeStates', '_publishChargingNormalSourceState', '_publishChargingEvcsJavascriptRemovalState', '_publishChargingLegacyDecisionTreeState', '_publishChargingTsNormalSourceState']) module[name] = async () => null;
    try { await module.tick(); } finally { module.stop(); }
    return h;
}
test('ordinary control contract accepts false/zero and daily deadline, rejects malformed values without coercion', () => {
    const now = Date.now();
    for (const [field, value] of [['userStationEnabled', false], ['userEnabled', true], ['userMode', 'pv'], ['userAutoSource', 'strategy'], ['userPhaseMode', 'fixed-1p'], ['userStorageAssistEnabled', false], ['goalEnabled', false], ['goalTargetSocPct', 0], ['goalBatteryKwh', 0], ['goalFinishTs', now - 86400000], ['legacyMode', 0]]) assert(validEmsControlValue(field, value, now), field);
    for (const [field, value] of [['userStationEnabled', 'false'], ['userEnabled', 0], ['userMode', 'turbo'], ['userPhaseMode', {}], ['goalTargetSocPct', 101], ['goalBatteryKwh', -1], ['goalFinishTs', now + 367 * 86400000], ['legacyMode', 4], ['legacyMode', '1'], ['goalBatteryKwh', NaN]]) assert(!validEmsControlValue(field, value, now), field);
    for (const field of EMS_CONTROL_FIELDS) {
        const raw = { val: { invalid: true }, ts: now, ack: false };
        const checked = checkedEmsControlState(`chargingManagement.wallboxes.actual_key.${field}`, raw, now);
        assert.equal(checked.eosInvalidControl, true); assert.deepEqual(raw.val, { invalid: true });
    }
    assert.equal(checkedEmsControlState('chargingManagement.wallboxes.lp1.userEnabled', { val: 'false' }).val, true, 'malformed command never disables EMS regulation');
    assert.equal(checkedEmsControlState('chargingManagement.wallboxes.lp1.userStationEnabled', { val: 'false' }).val, false);
});
for (const cache of [false, true]) test(`invalid ordinary persisted control fences affected station without overwriting request (${cache ? 'cache' : 'DB'})`, async () => {
    const h = await tickFixture({ userStationEnabled: true, userMode: 'boost', goalTargetSocPct: 150 }, cache);
    const base = 'chargingManagement.wallboxes.lp1.';
    assert.equal(h.states.get(base + 'controlInputsValid'), false);
    assert.match(h.states.get(base + 'controlInputError'), /goalTargetSocPct/);
    assert.equal(h.states.get(base + 'goalTargetSocPct'), 150, 'do not rewrite bad user data as successful command');
    assert.equal(h.states.get(base + 'operationalBlocked'), true);
    assert.match(h.states.get(base + 'unavailableReason'), /invalid_control/);
    assert(!h.writes.some(write => write.type === 'number' && write.value > 0), 'no positive charging target');
});
test('ordinary station off keeps the EMS regulation choice; valid correction clears diagnostic fence', async () => {
    const h = await tickFixture({ userStationEnabled: false, userEnabled: true, userMode: 'boost' });
    const base = 'chargingManagement.wallboxes.lp1.';
    assert.equal(h.states.get(base + 'userStationEnabled'), false);
    assert.equal(h.states.get(base + 'userEnabled'), true);
    assert.equal(h.states.get(base + 'controlInputsValid'), true, h.states.get(base + 'controlInputError'));
    assert.equal(h.states.get(base + 'stationEnabled'), false);
    assert(!h.writes.some(write => write.type === 'number' && write.value > 0));
    const valid = await tickFixture({ userStationEnabled: true, goalTargetSocPct: 75 });
    assert.equal(valid.states.get(base + 'controlInputsValid'), true);
    assert.equal(valid.states.get(base + 'controlInputError'), '');
});
test('actual ordinary state handler accepts controller commands without integration auth; compatibility values checked', async t => {
    const h = await createHarness({ legacyNamespace: 'nexowatt-ui.2' });
    t.after(async () => { await new Promise(resolve => h.adapter.onUnload(resolve)); await h.close(); });
    const a = h.adapter; const ticks = []; a._nwRequestImmediateEmsTick = reason => ticks.push(reason);
    a.config.chargingManagement = { wallboxes: [{ key: 'lp4', enabled: true }] };
    a.stateCache['chargingManagement.wallboxes.lp4.userEnabled'] = { value: true, ts: Date.now() };
    a.onStateChange('nexowatt-ui.2.chargingManagement.wallboxes.lp4.userStationEnabled', { val: false, ack: false, ts: Date.now(), from: 'system.adapter.bridge.0' });
    assert.equal(a.stateCache['chargingManagement.wallboxes.lp4.userStationEnabled'].value, false);
    assert.equal(a.stateCache['chargingManagement.wallboxes.lp4.userEnabled'].value, true);
    assert(ticks.length > 0);
    a.onStateChange('nexowatt-ui.2.evcs.4.mode', { val: 3, ack: false, ts: Date.now() });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.states.get('nexowatt-ui.2.chargingManagement.wallboxes.lp4.userMode').val, 'pv');
    a.onStateChange('nexowatt-ui.2.evcs.4.mode', { val: 99, ack: false, ts: Date.now() });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.states.get('nexowatt-ui.2.chargingManagement.wallboxes.lp4.userMode').val, 'pv', 'invalid legacy mode must not turn into auto/boost');
    a.onStateChange('nexowatt-ui.2.chargingManagement.wallboxes.lp4.userStationEnabled', { val: 'false', ack: false, ts: Date.now() });
    assert.equal(a.stateCache['chargingManagement.wallboxes.lp4.userStationEnabled'].value, 'EOS_INVALID_CONTROL_VALUE');
    a.onStateChange('nexowatt-ui.2.chargingManagement.wallboxes.lp4.userStationEnabled', { val: true, ack: false, ts: Date.now() });
    assert.equal(a.stateCache['chargingManagement.wallboxes.lp4.userStationEnabled'].value, true);
});

test('invalid first station does not mark healthy second station unavailable', async () => {
    const h = await tickFixture({ userStationEnabled: 'false' }, false, true);
    assert.equal(h.states.get('chargingManagement.wallboxes.lp1.controlInputsValid'), false);
    assert.equal(h.states.get('chargingManagement.wallboxes.lp1.operationalBlocked'), true);
    assert.equal(h.states.get('chargingManagement.wallboxes.lp2.controlInputsValid'), true);
    assert.equal(h.states.get('chargingManagement.wallboxes.lp2.operationalBlocked'), false);
    assert.equal(h.states.get('chargingManagement.wallboxes.lp1.userStationEnabled'), 'false');
});
