'use strict';

// Real MQTT.js and TCP fault tests. Only the localhost broker and ioBroker state
// sink are simulated; no live device or physical actuator is contacted.
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const path = require('node:path');
const req = createRequire(path.join(process.env.EOS_TEST_ROOT || path.resolve(__dirname, '../../..'), 'package.json'));
const packets = req('mqtt-packet');
const { MqttDriver } = req('./modules/devices/lib/drivers/mqtt');
const { guardDriver } = req('./modules/devices/operation-guard');

async function until(predicate, message, timeout = 2500) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(message);
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

async function broker(t, { acknowledge = false, subscribe = true } = {}) {
  const sockets = new Set();
  const publications = [];
  let connections = 0;
  let allowed = true;
  let acknowledgePublishes = acknowledge;
  const server = net.createServer(socket => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
    const parser = packets.parser();
    socket.on('data', data => parser.parse(data));
    parser.on('packet', packet => {
      if (packet.cmd === 'connect') {
        connections += 1;
        socket.write(packets.generate({ cmd: 'connack', returnCode: 0, sessionPresent: false }));
      }
      if (packet.cmd === 'subscribe' && subscribe) {
        socket.write(packets.generate({ cmd: 'suback', messageId: packet.messageId, granted: packet.subscriptions.map(() => 0) }));
      }
      if (packet.cmd === 'publish') {
        publications.push({ value: packet.payload.toString(), connection: connections, authorized: allowed });
        if (acknowledgePublishes && packet.qos === 1) socket.write(packets.generate({ cmd: 'puback', messageId: packet.messageId }));
      }
      if (packet.cmd === 'pingreq') socket.write(packets.generate({ cmd: 'pingresp' }));
      if (packet.cmd === 'disconnect') socket.end();
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  });
  return {
    url: `mqtt://127.0.0.1:${server.address().port}`,
    publications,
    get connections() { return connections; },
    get sockets() { return sockets.size; },
    get allowed() { return allowed; },
    set allowed(value) { allowed = value; },
    acknowledge() { acknowledgePublishes = true; },
    drop() { for (const socket of sockets) socket.destroy(); },
    broadcast(topic, data) {
      for (const socket of sockets) socket.write(packets.generate({ cmd: 'publish', topic, payload: JSON.stringify(data), qos: 0, retain: false }));
    },
  };
}

function harness(t, broker, templateExtra = {}, connectionExtra = {}) {
  const command = { id: 'command', type: 'number', rw: 'wo', source: { kind: 'mqtt', topic: 'control/power', qos: 1 } };
  const template = {
    datapoints: [{ id: 'power', type: 'number', rw: 'ro', source: { kind: 'mqtt', topic: 'meter/power' } }, command],
    ...templateExtra,
  };
  const adapter = { namespace: 'eos-admin.0', log: { info() {}, debug() {}, warn() {}, error() {} }, async setStateAsync() {} };
  const driver = guardDriver(new MqttDriver(adapter, {
    id: 'mqtt-lifecycle-test', connection: { url: broker.url, reconnectPeriodMs: 50, ...connectionExtra },
  }, template, {}, dp => dp.id, () => null), () => broker.allowed);
  t.after(async () => { await driver.disconnect(); });
  return { driver, command };
}

for (const revoked of [false, true]) {
  test(`unacknowledged MQTT power command is not replayed on reconnect${revoked ? ' after authorization revocation' : ''}`,
    { timeout: 9000 }, async t => {
      const b = await broker(t);
      const { driver, command } = harness(t, b);
      await driver.connect();
      await until(() => driver.connected, 'broker did not connect');
      const previous = driver.writeDatapoint(command, 681).then(() => ({ ok: true }), error => ({ ok: false, error }));
      await until(() => b.publications.length === 1, 'first command did not arrive');
      if (revoked) b.allowed = false;
      b.drop();
      await new Promise(resolve => setTimeout(resolve, 250));
      assert.deepEqual(b.publications.map(p => p.value), ['681'], 'a reconnect must not resend an old actuator command');
      assert.equal((await previous).ok, false, 'lost acknowledgement is not success');
      if (revoked) assert.equal(b.connections, 1, 'no new connection without current authorization');
      b.allowed = true;
      b.acknowledge();
      await until(() => driver.connected && b.connections >= 2, 'new authorized session did not connect');
      await driver.writeDatapoint(command, 420);
      await until(() => b.publications.length === 2, 'fresh command did not arrive');
      assert.deepEqual(b.publications.map(p => p.value), ['681', '420']);
      await driver.disconnect();
    });
}

test('offline commands fail instead of being queued for a later MQTT session', { timeout: 9000 }, async t => {
  const b = await broker(t, { acknowledge: true });
  const { driver, command } = harness(t, b, {}, { reconnectPeriodMs: 300 });
  await driver.connect();
  await until(() => driver.connected, 'not connected');
  b.drop();
  await until(() => !driver.connected, 'disconnect not observed');
  await assert.rejects(driver.writeDatapoint(command, 950), /not connected/);
  await until(() => driver.connected && b.connections === 2, 'did not reconnect');
  assert.equal(b.publications.length, 0);
  await driver.writeDatapoint(command, 100);
  assert.deepEqual(b.publications.map(p => p.value), ['100']);
});

test('missing PUBACK reaches deadline and closes actual transport before fresh reconnect', { timeout: 10000 }, async t => {
  const b = await broker(t);
  const { driver, command } = harness(t, b);
  await driver.connect();
  await until(() => driver.connected, 'not connected');
  const began = Date.now();
  await assert.rejects(driver.writeDatapoint(command, 700), /E_MQTT_PUBLISH_TIMEOUT/);
  assert.ok(Date.now() - began < 5800, 'publish exceeded its total deadline');
  b.acknowledge();
  await until(() => driver.connected && b.connections === 2, 'fresh client did not reconnect');
  assert.deepEqual(b.publications.map(p => p.value), ['700'], 'timed out command was retained');
  await driver.writeDatapoint(command, 20);
  assert.deepEqual(b.publications.map(p => p.value), ['700', '20']);
});

test('missing SUBACK is bounded and does not block stop or next session', { timeout: 10000 }, async t => {
  const b = await broker(t, { subscribe: false });
  const { driver } = harness(t, b);
  await driver.connect();
  await until(() => driver.connected, 'not connected');
  await until(() => b.connections === 2 && driver.connected && driver._pendingOperations.size === 1, 'subscription deadline did not replace broken session', 6500);
  assert.equal(driver._pendingOperations.size, 1, 'old subscription remains pending');
  await driver.disconnect();
  assert.equal(driver._pendingOperations.size, 0);
  await until(() => b.sockets === 0, 'stop did not close actual socket');
});

test('controlled stop shares one deadline across three safe QoS1 shutdown groups', { timeout: 8000 }, async t => {
  const b = await broker(t);
  const { driver } = harness(t, b, {
    datapoints: [1, 2, 3].map(n => ({ id: `safe${n}`, type: 'number', rw: 'wo', source: { kind: 'mqtt', topic: `control/power${n}`, writeGroup: `power${n}` } })),
    driverHints: { mqtt: { writeGroups: Object.fromEntries([1, 2, 3].map(n => [`power${n}`, { topic: `control/power${n}`, qos: 1, safeOnDisconnect: true, safeOnInitialConnect: false, refreshIntervalMs: 60000, safeValue: 0, fields: { Power: { dpId: `safe${n}` } } }])) } },
  });
  await driver.connect();
  await until(() => driver.connected && driver.writeGroupStates.size === 3, 'write groups not initialized');
  const started = Date.now();
  await driver.disconnect();
  assert.ok(Date.now() - started < 3500, 'safe publish prevents bounded stop');
  await until(() => b.sockets === 0, 'actual socket remains open');
  assert.equal(driver.writeGroupTimers.size, 0);
  assert.equal(driver._pendingOperations.size, 0);
  await new Promise(resolve => setTimeout(resolve, 150));
  assert.equal(b.connections, 1, 'stop reconnected transport');
  assert.deepEqual(b.publications.map(p => JSON.parse(p.value)), [{ Power: 0 }]);
});

test('parallel connect calls share one MQTT client', { timeout: 5000 }, async t => {
  const b = await broker(t, { acknowledge: true });
  const { driver } = harness(t, b);
  await Promise.all([driver.connect(), driver.connect(), driver.connect()]);
  await until(() => driver.connected, 'not connected');
  assert.equal(b.connections, 1);
  await driver.disconnect();
  await until(() => b.sockets === 0, 'orphan socket after stop');
});


test('a delayed old MQTT sample cannot revive aliases or finish multi-value updates in a new session', { timeout: 9000 }, async t => {
  const b = await broker(t, { acknowledge: true });
  const states = new Map();
  const snapshots = [];
  let release;
  const blocked = new Promise(resolve => { release = resolve; });
  let firstPending = false;
  const adapter = {
    namespace: 'eos-admin.0', log: { info() {}, debug() {}, warn() {}, error() {} },
    async setStateAsync(id, state) {
      states.set(id, state.val);
      if (id === 'first' && state.val === 123) { firstPending = true; await blocked; }
    },
  };
  const template = { datapoints: ['first', 'second'].map(id => ({
    id, type: 'number', rw: 'ro', source: { kind: 'mqtt', topic: 'meter/pair', format: 'json', jsonPath: id },
  })) };
  const driver = guardDriver(new MqttDriver(adapter, { id: 'old-message', connection: { url: b.url, reconnectPeriodMs: 50 } },
    template, {}, dp => dp.id, () => null, null, values => snapshots.push(values)), () => b.allowed);
  t.after(async () => { release(); await driver.disconnect(); });
  await driver.connect();
  await until(() => driver.connected && driver.subscriptionResults.size > 0, 'first subscriptions missing');
  b.broadcast('meter/pair', { first: 123, second: 456 });
  await until(() => firstPending, 'state sink did not block first sample');
  b.drop();
  await until(() => !driver.connected, 'old session did not disconnect');
  await new Promise(resolve => setTimeout(resolve, 100));
  assert.equal(b.connections, 1, 'replacement must wait for the old submitted DB write');
  release();
  await driver._messageQueue;
  await until(() => driver.connected && b.connections === 2 && driver.subscriptionResults.size > 0, 'replacement session missing after drain');
  assert.equal(states.has('second'), false, 'obsolete second field crossed the reconnect boundary');
  assert.equal(snapshots.length, 0, 'old sample revived live aliases');
  b.broadcast('meter/pair', { first: 7, second: 8 });
  await until(() => states.get('second') === 8 && snapshots.length === 1, 'new live sample not delivered');
  assert.deepEqual(snapshots[0], { first: 7, second: 8 });
});


test('unconfirmed MQTT transport cleanup does not start a second client', { timeout: 5000 }, async t => {
  const b = await broker(t, { acknowledge: true });
  const { driver } = harness(t, b);
  await driver.connect();
  await until(() => driver.connected, 'not connected');
  const client = driver.client;
  const end = client.end;
  client.end = () => { throw new Error('controlled end failure'); };
  try {
    b.drop();
    await until(() => !driver.connected, 'disconnect not observed');
    await new Promise(resolve => setTimeout(resolve, 180));
    assert.equal(b.connections, 1, 'replacement started without confirmed cleanup');
    assert.equal(driver.client, client, 'unconfirmed transport became unreachable for stop retry');
    assert.match(driver._lastPrimaryConnectionError, /E_MQTT_STOP_UNCONFIRMED/);
  } finally {
    client.end = end;
    await driver.disconnect();
  }
});

test('safe shutdown never bypasses revoked device authority', { timeout: 5000 }, async t => {
  const b = await broker(t, { acknowledge: true });
  const { driver } = harness(t, b, {
    datapoints: [{ id: 'safe', type: 'number', rw: 'wo', source: { kind: 'mqtt', topic: 'control/power', writeGroup: 'power' } }],
    driverHints: { mqtt: { writeGroups: { power: { topic: 'control/power', qos: 1, safeOnDisconnect: true, safeOnInitialConnect: false, refreshIntervalMs: 60000, safeValue: 0, fields: { Power: { dpId: 'safe' } } } } } },
  });
  await driver.connect();
  await until(() => driver.connected && driver.writeGroupStates.size === 1, 'write group not initialized');
  b.allowed = false;
  await driver.disconnect();
  await until(() => b.sockets === 0, 'socket did not close after authority loss');
  assert.equal(b.publications.length, 0, 'safe value was used to bypass authority');
});
