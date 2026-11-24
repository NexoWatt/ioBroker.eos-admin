'use strict';
/** Actual hosted EVCS creation/subscription/mirror methods; isolated state DB. */
const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');

const sourceValues = {
  powerId: [1300, 'number', 'W'], energyTotalId: [42, 'number', 'kWh'], statusId: ['Charging', 'string', ''],
  onlineId: [true, 'boolean', ''], dataFreshId: [false, 'boolean', ''], activeId: [true, 'boolean', ''],
  chargingStateId: ['SuspendedEV', 'string', ''], vehicleConnectedId: [true, 'boolean', ''],
  chargeDemandId: [false, 'boolean', ''], heartbeatId: [12345, 'number', ''], phaseFeedbackId: [3, 'number', ''],
  lockWriteId: [false, 'boolean', ''], rfidReadId: ['tag1', 'string', ''], vehicleSocId: [60, 'number', '%'],
  modeId: [0, 'number', ''],
};
function wallbox(index) {
  return { index, name: `Wallbox ${index}`, note: 'Kundenkonfiguration',
    ...Object.fromEntries(Object.keys(sourceValues).map(key => [key, `fixture.0.shared.${key}`])) };
}
async function fixture(t) {
  const h = await createHarness(); const a = h.adapter;
  t.after(async () => { await new Promise(resolve => a.onUnload(resolve)); await h.close(); });
  const missingWrites = []; const mirrorWrites = [];
  // Hosted runtime qualifies own IDs through the owner's foreign-state API.
  const write = h.owner.setForeignStateAsync;
  h.owner.setForeignStateAsync = async (id, value, ack) => {
    const full = id.startsWith('eos-admin.0.') ? id : `eos-admin.0.${id}`;
    if (full.startsWith('eos-admin.0.evcs.')) {
      mirrorWrites.push(full);
      if (!h.objects.has(full)) missingWrites.push(full);
    }
    return write(id, value, ack);
  };
  const sourceTs = Date.now() - 120000;
  for (const [key, [val, type, unit]] of Object.entries(sourceValues)) {
    const id = `fixture.0.shared.${key}`;
    h.objects.set(id, { type: 'state', common: { type, unit, read: true, write: false }, native: {} });
    h.states.set(id, { val, ts: sourceTs, lc: sourceTs, ack: true });
  }
  return { ...h, missingWrites, mirrorWrites, sourceTs };
}

test('new multi-connector EVCS creates every mapped mirror before its first real subscription read', async t => {
  const h = await fixture(t); const a = h.adapter;
  a.evcsCount = 2; a.evcsList = [wallbox(1), wallbox(2)];
  await a.ensureEvcsStates();
  for (const wb of a.evcsList) {
    for (const binding of a._nwEvcsInputSpecsForWallbox(wb)) {
      assert.equal(h.objects.get(`eos-admin.0.${binding.key}`)?.type, 'state', `${binding.key} metadata before any measurement`);
      assert.equal(h.states.has(`eos-admin.0.${binding.key}`), false, 'metadata creation does not seed live telemetry');
    }
  }
  await a.subscribeEvcsMappedStates();
  assert.deepEqual(h.missingWrites, []);
  assert.ok(h.mirrorWrites.includes('eos-admin.0.evcs.2.dataFresh'), 'actual hosted foreign-state write interception is exercised');
  for (const index of [1, 2]) {
    const id = `eos-admin.0.evcs.${index}.dataFresh`;
    assert.equal(h.objects.get(id).common.type, 'boolean');
    assert.equal(h.objects.get(id).common.write, false);
    assert.equal(h.states.get(id).val, false);
    assert.equal(h.states.get(`eos-admin.0.evcs.${index}.chargingState`).val, 'SuspendedEV');
  }
});

test('upgrade repairs missing metadata without resetting saved values and restart remains idempotent', async t => {
  const h = await fixture(t); const a = h.adapter;
  a.evcsCount = 2; a.evcsList = [wallbox(1), wallbox(2)];
  await a.ensureEvcsStates();
  for (const index of [1, 2]) {
    for (const field of ['dataFresh', 'chargingState']) h.objects.delete(`eos-admin.0.evcs.${index}.${field}`);
    h.states.set(`eos-admin.0.evcs.${index}.dataFresh`, { val: false, ts: h.sourceTs, ack: true });
    h.states.set(`eos-admin.0.evcs.${index}.energyTotalKwh`, { val: 98765, ts: h.sourceTs, ack: true });
  }
  for (const phase of ['upgrade', 'restart']) {
    await a.ensureEvcsStates();
    assert.equal(h.states.get('eos-admin.0.evcs.1.energyTotalKwh').val, 98765, phase);
    assert.deepEqual(h.states.get('eos-admin.0.evcs.1.dataFresh'), { val: false, ts: h.sourceTs, ack: true }, phase);
    assert.equal(h.objects.get('eos-admin.0.evcs.2.chargingState').common.type, 'string');
  }
  await a.subscribeEvcsMappedStates();
  assert.deepEqual(h.missingWrites, []);
});

test('later installer row provisioning precedes new connector mirroring and own ack events never freshen old false data', async t => {
  const h = await fixture(t); const a = h.adapter;
  a.evcsCount = 1; a.evcsList = [wallbox(1)];
  await a.ensureEvcsStates(); await a.subscribeEvcsMappedStates();
  const next = { settingsConfig: { evcsCount: 3, evcsList: [wallbox(1), wallbox(2), wallbox(3)] } };
  await a._nwProvisionInstallerObjects(next);
  a.evcsCount = 3; a.evcsList = next.settingsConfig.evcsList;
  await a._nwBuildEvcsInputBindings(); await a.ensureEvcsStates(); await a.subscribeEvcsMappedStates();
  assert.deepEqual(h.missingWrites, []);
  for (const index of [1, 2, 3]) {
    for (const field of ['dataFresh', 'chargingState']) {
      const key = `evcs.${index}.${field}`;
      assert.equal(a._nwIsReadOnlyEvcsMirrorKey(key), true);
      assert.equal(a.stateCache[key].ts, h.sourceTs);
      const old = structuredClone(a.stateCache[key]);
      await a.onStateChange(`eos-admin.0.${key}`, { val: h.states.get(`eos-admin.0.${key}`).val, ack: true, ts: Date.now() });
      assert.deepEqual(a.stateCache[key], old, 'own mirrored DB acknowledgement must retain actual foreign sample timestamp');
    }
    assert.equal(a.stateCache[`evcs.${index}.dataFresh`].value, false);
  }
});
