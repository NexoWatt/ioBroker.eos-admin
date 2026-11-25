'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const req = createRequire(path.join(process.env.EOS_TEST_ROOT || path.resolve(__dirname, '../../..'), 'package.json'));
const packets = req('mqtt-packet');
const { MqttDriver } = req('./modules/devices/lib/drivers/mqtt');
async function until(fn, message, limit = 2500) {
  const deadline = Date.now() + limit;
  while (!fn()) {
    if (Date.now() >= deadline) throw new Error(message);
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}
async function harness(t, holdFirst = false) {
  const sockets = new Set(); const values = []; const warnings = [];
  let connections = 0; let entered = false; let release;
  const held = new Promise(resolve => { release = resolve; });
  const server = net.createServer(socket => {
    sockets.add(socket); socket.on('error', () => {}); socket.on('close', () => sockets.delete(socket));
    const parser = packets.parser(); socket.on('data', data => parser.parse(data));
    parser.on('packet', packet => {
      if (packet.cmd === 'connect') { connections += 1; socket.write(packets.generate({ cmd: 'connack', returnCode: 0, sessionPresent: false })); }
      if (packet.cmd === 'subscribe') socket.write(packets.generate({ cmd: 'suback', messageId: packet.messageId, granted: packet.subscriptions.map(() => 0) }));
      if (packet.cmd === 'disconnect') socket.end();
    });
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const adapter = {
    namespace: 'eos-admin.0', log: { info() {}, debug() {}, error() {}, warn(message) { warnings.push(message); } },
    async setStateAsync(id, state) {
      if (id === 'power') {
        if (holdFirst && state.val === 1) { entered = true; await held; }
        values.push(state.val);
      }
    },
  };
  const driver = new MqttDriver(adapter, { id: 'limits', connection: { url: `mqtt://127.0.0.1:${server.address().port}`, reconnectPeriodMs: 50 } }, {
    datapoints: [{ id: 'power', type: 'number', rw: 'ro', source: { kind: 'mqtt', topic: 'meter/power', format: 'json', jsonPath: 'power' } }],
    driverHints: { mqtt: { subscriptionFilters: [{ topic: '#' }] } },
  }, {}, dp => dp.id, () => null);
  t.after(async () => { release(); await driver.disconnect(); for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); });
  await driver.connect();
  await until(() => driver.connected && driver.subscriptionResults.size > 0, 'MQTT subscription did not complete');
  return {
    driver, values, warnings, release,
    get entered() { return entered; }, get connections() { return connections; }, get sockets() { return sockets.size; },
    send(topic, payload) { for (const socket of sockets) socket.write(packets.generate({ cmd: 'publish', topic, payload: JSON.stringify(payload), qos: 0, retain: false })); },
  };
}

for (const [name, count, pad] of [['message count', 300, ''], ['queued payload bytes', 80, 'x'.repeat(64 * 1024)]]) {
  test(`real MQTT backpressure bounds ${name} and reconnects only after the old DB write drains`, { timeout: 8000 }, async t => {
    const h = await harness(t, true);
    h.send('meter/power', { power: 1 });
    await until(() => h.entered, 'first real MQTT sample did not reach blocked DB sink');
    for (let i = 0; i < count; i++) h.send('meter/power', { power: 2, pad });
    await until(() => !h.driver.connected, 'MQTT backlog was not bounded');
    await until(() => h.sockets === 0, 'overloaded actual TCP socket stayed open');
    assert.ok(h.driver._messageBacklog.count <= 256);
    assert.ok(h.driver._messageBacklog.bytes <= 4 * 1024 * 1024);
    assert.ok(h.warnings.some(message => message.includes('E_MQTT_BACKLOG_LIMIT')));
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(h.connections, 1, 'replacement started before old write drained');
    h.release();
    await until(() => h.connections === 2 && h.driver.connected && h.driver.subscriptionResults.size > 0, 'controlled retry did not recover');
    assert.deepEqual(h.values, [1], 'old queued samples were silently replayed as fresh');
    assert.equal(h.driver._messageBacklog.count, 0);
    h.send('meter/power', { power: 99 });
    await until(() => h.values.includes(99), 'fresh telemetry did not recover');
  });
}

test('MQTT single payload exceeding one MiB is rejected visibly before application state writes', { timeout: 6000 }, async t => {
  const h = await harness(t);
  h.send('meter/power', { power: 999, pad: 'x'.repeat(1024 * 1024) });
  await until(() => h.warnings.some(message => message.includes('E_MQTT_PAYLOAD_LIMIT')), 'oversized payload was not rejected');
  await until(() => h.connections === 2 && h.driver.connected, 'fresh session not opened');
  assert.deepEqual(h.values, []);
  assert.equal(h.driver._messageBacklog.bytes, 0);
});

test('MQTT wildcard topic discovery is capped per session with an explicit transport error', { timeout: 8000 }, async t => {
  const h = await harness(t);
  for (let n = 0; n < 512; n += 16) {
    for (let i = n; i < n + 16; i++) h.send(`unknown/${i}`, { value: i });
    await until(() => h.driver.messageCount >= n + 16, 'controlled discovery batch did not drain');
    await h.driver._messageQueue;
  }
  h.send('unknown/512', { value: 512 });
  await until(() => h.warnings.some(message => message.includes('E_MQTT_DISCOVERED_TOPIC_LIMIT')), 'wildcard discovery grows without bound');
  assert.ok(h.driver.discoveredTopics.size <= 512);
  await until(() => h.connections === 2 && h.driver.connected, 'topic-limit retry did not recover');
  assert.equal(h.driver.discoveredTopics.size, 0, 'new session still holds obsolete discovery names');
});
