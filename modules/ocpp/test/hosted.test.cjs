'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { RPCClient } = require('ocpp-rpc');
const { createHostedModule, validateConfig, preflightLegacyConfig } = require('../index');

async function port() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}
async function until(read, check, ms = 7000) {
  const deadline = Date.now() + ms;
  let value;
  while (Date.now() < deadline) {
    value = await read();
    if (check(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 15));
  }
  throw new Error(`Condition timed out: ${JSON.stringify(value)}`);
}
function fixture(namespace = 'eos-admin.0.ocpp') {
  const states = new Map(), objects = new Map(), logs = [];
  let authorized = true, epoch = 1;
  const adapter = {
    namespace, instance: 0,
    log: Object.fromEntries(['warn','info','error','debug'].map(level => [level, message => logs.push({ level, message })])),
    async getStateAsync(id) { return states.get(id) || null; },
    async getStatesAsync(pattern) {
      const match = new RegExp('^' + pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
      return Object.fromEntries([...states].filter(([id]) => match.test(id)));
    },
    async getObjectAsync(id) { return objects.get(id) || null; },
    async getObjectViewAsync(_design, _search, options) {
      return { rows: [...objects].filter(([id]) => `${namespace}.${id}` >= options.startkey && `${namespace}.${id}` <= options.endkey).map(([id,value]) => ({ id: `${namespace}.${id}`, value })) };
    },
    async setObjectNotExistsAsync(id, obj) {
      if (!objects.has(id)) {
        objects.set(id, structuredClone(obj));
        if (obj.common?.def !== undefined && !states.has(id)) states.set(id, { val: obj.common.def, ack: true, ts: Date.now(), q: 0 });
      }
    },
    async extendObjectAsync(id, patch) {
      const previous = objects.get(id) || {};
      objects.set(id, { ...previous, ...patch, native: { ...previous.native, ...patch.native }, common: { ...previous.common, ...patch.common } });
    },
    async setStateAsync(id, state) { states.set(id, { ...state, ts: Date.now(), q: 0 }); },
    async setStateChangedAsync(id, state) { return this.setStateAsync(id, state); },
    async subscribeStatesAsync() {}, async unsubscribeStatesAsync() {}, async delObjectAsync(id) { objects.delete(id); },
  };
  return { adapter, states, objects, logs, canOperate: () => authorized, getAuthorityGeneration: () => epoch,
    revoke() { authorized = false; epoch++; }, grant() { authorized = true; } };
}
async function startStation(t, protocol = 'ocpp1.6', namespace) {
  const f = fixture(namespace), listenerPort = await port();
  const module = createHostedModule({ ...f, config: { enabled: true, port: listenerPort, activeRefresh: false, smartChargingMinIntervalMs: 1000 } });
  const client = new RPCClient({ endpoint: `ws://127.0.0.1:${listenerPort}`, identity: 'cp', protocols: [protocol], strictMode: false, reconnect: false });
  const limits = [];
  client.handle('SetChargingProfile', ({ params }) => {
    limits.push(protocol === 'ocpp1.6' ? params.csChargingProfiles.chargingSchedule.chargingSchedulePeriod[0].limit : params.chargingProfile.chargingSchedule[0].chargingSchedulePeriod[0].limit);
    return { status: 'Accepted' };
  });
  t.after(async () => { await client.close({ force: true }).catch(() => {}); await module.stop(); });
  await module.start();
  await client.connect();
  const boot = await client.call('BootNotification', protocol === 'ocpp1.6' ? { chargePointVendor: 'Test', chargePointModel: 'Loopback' } : { chargingStation: { vendorName: 'Test', model: 'Loopback' }, reason: 'PowerUp' });
  assert.equal(boot.status, 'Accepted');
  await until(() => f.states.get('cp.info.sessionId'), state => typeof state?.val === 'string' && state.val.length > 16);
  const write = async (id, val) => {
    const state = { val, ack: false, ts: Date.now(), q: 0 };
    f.states.set(id, state);
    await module.onStateChange(`${f.adapter.namespace}.${id}`, state);
  };
  return { ...f, module, client, limits, write, port: listenerPort };
}

test('hosted config preserves native defaults and rejects unsafe or unsupported migration settings', async () => {
  assert.equal(validateConfig({}).enabled, false);
  assert.equal(validateConfig({}).maximumPhaseVoltageV, 253);
  assert.equal(validateConfig({ zeroLimitBehavior: 'keepLast' }).zeroLimitBehavior, 'keepLast');
  for (const config of [{ port: 80 }, { port: '9220' }, { enabled: true, enable16: false, enable201: false, enable21: false }, { identityAllowlist: ['bad/name'] }]) assert.throws(() => validateConfig(config), /EOS_OCPP_CONFIG/);
  await assert.rejects(preflightLegacyConfig({ tls: true }, { sourceVersion: '0.4.3' }), /TRANSPORT_REVIEW_REQUIRED/);
  await assert.rejects(preflightLegacyConfig({}, { sourceVersion: '0.1.0' }), /LEGACY_VERSION/);
});
for (const protocol of ['ocpp1.6','ocpp2.0.1','ocpp2.1']) {
  test(`actual hosted ${protocol} station keeps W profile, atomic feedback and separate child-alive contract`, async t => {
    const f = await startStation(t, protocol);
    assert.equal(f.states.get('info.eosHostedRuntime').val, true);
    assert.equal(f.states.get('info.runtimeAlive').val, true);
    assert.equal(f.objects.get('cp').native.controlScope, 'station');
    await f.write('cp.control.chargeLimit', 4200);
    await f.write('cp.control.chargeLimit', 0);
    assert.deepEqual(f.limits, [4200, 0]);
    const status = JSON.parse(f.states.get('cp.control.chargeLimitStatus').val);
    assert.equal(status.valid, true);
    assert.equal(status.appliedW, 0);
    assert.equal(status.sessionId, f.states.get('cp.info.sessionId').val);
    assert.equal(f.module.getStatus().stations.length, 1);
    await f.module.stop();
    assert.equal(f.states.get('info.runtimeAlive').val, false);
  });
}
test('legacy namespace retains native station IDs and needs no separate adapter instance', async t => {
  const f = await startStation(t, 'ocpp1.6', 'ocpp21.2');
  assert.equal(f.module.getStatus().namespace, 'ocpp21.2');
  await f.write('cp.control.chargeLimit', 0);
  assert.equal(f.limits.at(-1), 0);
});
test('hosted EOS lease expires independently and actual station confirms zero without automatic resume', async t => {
  const f = await startStation(t);
  await f.write('cp.control.eosLeaseUntilMs', Date.now() + 1200);
  await f.write('cp.control.chargeLimit', 4200);
  await until(() => f.states.get('cp.control.eosLeaseState'), state => state?.val === 'expired-zero-confirmed');
  assert.deepEqual(f.limits, [4200, 0]);
  assert.equal(JSON.parse(f.states.get('cp.control.chargeLimitStatus').val).valid, false);
  await f.write('cp.control.eosLeaseUntilMs', Date.now() + 15000);
  assert.deepEqual(f.limits, [4200, 0]);
});
test('listener bind failure rejects module startup without crashing or affecting another listener', async t => {
  const f = await startStation(t);
  const secondFixture = fixture('eos-admin.1.ocpp');
  const second = createHostedModule({ ...secondFixture, config: { enabled: true, port: f.port } });
  t.after(() => second.stop());
  await assert.rejects(second.start(), /EOS_OCPP_START_FAILED/);
  assert.equal(f.module.getStatus().started, true);
  assert.equal(typeof (await f.client.call('Heartbeat', {})).currentTime, 'string');
});
test('unavailable authority never starts a socket and revocation closes an existing station', async t => {
  const f = await startStation(t);
  f.revoke();
  await until(() => f.module.getStatus().state, state => state === 'stopped');
  f.grant();
  await assert.rejects(f.write('cp.control.chargeLimit', 4200), /REVOKED/);
  assert.deepEqual(f.limits, []);
});
test('immediate revoke and regrant cannot replay a positive command waiting for a configuration read', async t => {
  const f = await startStation(t);
  const original = f.adapter.getStateAsync;
  let entered = false, release;
  const wait = new Promise(resolve => { release = resolve; });
  f.adapter.getStateAsync = async id => { if (id === 'cp.control.chargeLimitType') { entered = true; await wait; } return original(id); };
  const writing = f.write('cp.control.chargeLimit', 4200);
  const rejected = assert.rejects(writing, /REVOKED|HOST/);
  await until(() => entered, Boolean);
  f.revoke(); f.grant(); release();
  await rejected;
  assert.deepEqual(f.limits, []);
});

test('hosted status never labels an inactive open idle station as fresh', async t => {
  const f = await startStation(t);
  await f.client.call('StatusNotification', { connectorId: 1, status: 'Available', errorCode: 'NoError' });
  await until(() => f.module.getStatus().stations[0]?.dataFresh, Boolean);
  const originalNow = Date.now;
  const later = originalNow() + 751000;
  Date.now = () => later;
  try {
    const station = f.module.getStatus().stations[0];
    assert.equal(station.connected, true);
    assert.equal(station.dataFresh, false);
  } finally { Date.now = originalNow; }
});
