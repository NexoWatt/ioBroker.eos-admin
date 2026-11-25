/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { DatapointRegistry } = require('../ui/ems/datapoints');
const { TarifVisModule } = require('../ui/ems/modules/tarif-vis');
const { TariffStatusModule } = require('../ui/ems/modules/tariff-status');

async function fixture(namespace, vis) {
  const states = new Map(), objects = new Map(), logs = [];
  let dp;
  const full = id => id.startsWith(`${namespace}.`) ? id : `${namespace}.${id}`;
  const adapter = {
    namespace, instance: Number(namespace.split('.').at(-1)), config: { ...(vis ? { vis } : {}),
      datapoints: { priceCurrent: 'provider.0.current' }, storage: { allowGridCharge: true } },
    log: Object.fromEntries(['warn', 'debug', 'info', 'error'].map(level => [level, message => logs.push([level, message])])),
    async setObjectNotExistsAsync(id, object) { objects.set(full(id), object); },
    async getForeignObjectAsync(id) { return objects.get(id) || null; },
    async getForeignStateAsync(id) { return states.get(id) || null; },
    async getStateAsync(id) { return states.get(full(id)) || null; },
    async subscribeForeignStatesAsync() {},
    async setStateAsync(id, input, ack) {
      const state = input && typeof input === 'object' ? input : { val: input, ack };
      const sample = { ...state, ts: Date.now(), lc: Date.now() };
      states.set(full(id), sample); dp?.handleStateChange(full(id), sample);
    },
  };
  dp = new DatapointRegistry(adapter, []);
  const policy = new TarifVisModule(adapter, dp), status = new TariffStatusModule(adapter, dp);
  await policy.init(); await status.init();
  policy._getStorageControlAuthority = () => ({ selectedTopology: 'single', writerActive: true });
  for (const [key, val] of Object.entries({ dynamicTariff: true, tariffMode: 1, price: 0.30, priority: 2, storagePower: 2000, evcsMaxPower: 11000, netFeeEnabled: false })) {
    await adapter.setStateAsync(`settings.${key}`, { val, ack: true });
  }
  dp.handleStateChange('provider.0.current', { val: 0.20, ack: true, ts: Date.now() });
  return { adapter, dp, policy, status, states, full, logs };
}

test('new EOS installations read active tariff settings from their actual runtime and produce a live status', async () => {
  for (const namespace of ['eos-admin.0', 'eos-admin.3', 'nexowatt-ui.2']) {
    const x = await fixture(namespace);
    assert.equal(x.dp.getEntry('vis.settings.dynamicTariff').objectId, `${namespace}.settings.dynamicTariff`);
    await x.policy.tick(); await x.status.tick();
    assert.equal(x.states.get(x.full('tarif.aktiv'))?.val, true, JSON.stringify(x.logs));
    assert.equal(x.states.get(x.full('tarif.currentPriceFresh'))?.val, true);
    assert.equal(x.states.get(x.full('tarif.state'))?.val, 'guenstig');
    assert.equal(x.states.get(x.full('tarif.speicherNetzLadenErlaubt'))?.val, true);
    assert.equal(x.states.get(x.full('tarif.speicherSollW'))?.val, -2000);
    assert.match(x.states.get(x.full('tarif.statusText'))?.val, /Tarif Manuell günstig/);
    await x.adapter.setStateAsync('settings.dynamicTariff', { val: false, ack: true });
    await x.policy.tick();
    assert.equal(x.states.get(x.full('tarif.speicherNetzLadenErlaubt'))?.val, false);
    assert.equal(x.states.get(x.full('tarif.speicherSollW'))?.val, 0);
  }
});

test('explicit legacy VIS namespace remains authoritative and cannot be overridden by local settings', async () => {
  const x = await fixture('eos-admin.2', { instance: 'nexowatt-ui.4' });
  assert.equal(x.dp.getEntry('vis.settings.dynamicTariff').objectId, 'nexowatt-ui.4.settings.dynamicTariff');
  await x.policy.tick();
  assert.equal(x.states.get(x.full('tarif.aktiv'))?.val, false);
});

test('runtime namespace default preserves tariff freshness and AppCenter blocking', async () => {
  const x = await fixture('eos-admin.0');
  await x.policy.tick();
  assert.equal(x.states.get(x.full('tarif.speicherNetzLadenErlaubt'))?.val, true);
  x.adapter.config.storage.allowGridCharge = false;
  await x.policy.tick();
  assert.equal(x.states.get(x.full('tarif.speicherNetzLadenErlaubt'))?.val, false);
  x.adapter.config.storage.allowGridCharge = true;
  x.dp.handleStateChange('provider.0.current', { val: 0.20, ack: true, ts: Date.now() - 86400000 });
  await x.policy.tick();
  assert.equal(x.states.get(x.full('tarif.currentPriceFresh'))?.val, false);
  assert.equal(x.states.get(x.full('tarif.speicherNetzLadenErlaubt'))?.val, false);
});


test('tariff status preserves a constant PV reserve through fresh storage policy and invalidates a stopped writer', async () => {
  const x = await fixture('eos-admin.0'); await x.policy.tick();
  const now = Date.now(), policy = { ts: now, pvAwareTarifNetzladen: { blocked: true, capSocPct: 75, reason: 'Reserve für PV-Erzeugung' } };
  x.states.set(x.full('speicher.regelung.tarifPvBlock'), { val: true, ts: now - 86400000, q: 0 });
  x.states.set(x.full('speicher.regelung.policyJson'), { val: JSON.stringify(policy), ts: now, q: 0 });
  await x.status.tick();
  const read = () => JSON.parse(x.states.get(x.full('tarif.statusJson')).val).pvReserve;
  assert.equal(read().blocked, true); assert.equal(read().fresh, true); assert.equal(read().capSocPct, 75);
  x.states.set(x.full('speicher.regelung.policyJson'), { val: JSON.stringify(policy), ts: now, q: 128 });
  await x.status.tick(); assert.equal(read().blocked, false); assert.equal(read().fresh, false);
  policy.ts = now - 30001;
  x.states.set(x.full('speicher.regelung.policyJson'), { val: JSON.stringify(policy), ts: now, q: 0 });
  await x.status.tick(); assert.equal(read().blocked, false); assert.equal(read().fresh, false);
});
