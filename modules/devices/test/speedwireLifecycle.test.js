'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const dgram = require('node:dgram');
const { SpeedwireDriver } = require('../lib/drivers/speedwire');
const { validateConfig, preflightLegacyConfig } = require('../index');

const points = [{ id: 'power', rw: 'ro', source: { kind: 'speedwire', computed: 'netActivePower' } },
  { id: 'seen', rw: 'ro', source: { kind: 'speedwire', field: 'lastSeenUnixMs' } }];
function telegram(powerKw) {
  const data = Buffer.alloc(52); data.write('SMA\0'); data.writeUInt16BE(0x6069, 16);
  data.writeUInt16BE(1, 18); data.writeUInt32BE(12345678, 20); data.writeUInt32BE(1000, 24);
  data.set([0, 1, 4, 0], 28); data.writeInt32BE(Math.round(powerKw * 10000), 32);
  data.set([0, 2, 4, 0], 36); data.writeInt32BE(0, 40); return data;
}
const close = socket => new Promise(resolve => { try { socket.close(resolve); } catch { resolve(); } });
async function bind(socket) { await new Promise((resolve, reject) => { socket.once('error', reject); socket.bind(0, '0.0.0.0', resolve); }); return socket.address().port; }
async function fixture(t, reserve = false) {
  const reservation = dgram.createSocket({ type: 'udp4', reuseAddr: false }); const port = await bind(reservation);
  if (!reserve) await close(reservation);
  const logs = []; const adapter = { namespace: `test.speedwire.${port}`, log: { debug: text => logs.push(text), warn: text => logs.push(text) } };
  const driver = new SpeedwireDriver(adapter, { id: 'sma', connection: { port, multicastGroup: '127.0.0.1', host: '127.0.0.1' } });
  const sender = dgram.createSocket('udp4');
  t.after(async () => { await driver.disconnect(); await close(sender); await close(reservation); });
  async function send(powerKw) {
    const socket = driver.hub.socket;
    assert.ok(socket && driver.hub.started, 'listener is genuinely bound');
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { socket.off('message', received); reject(new Error('test UDP receive timeout')); }, 1000);
      function received() { clearTimeout(timeout); resolve(); }
      socket.once('message', received);
      sender.send(telegram(powerKw), port, '127.0.0.1', error => { if (error) { clearTimeout(timeout); socket.off('message', received); reject(error); } });
    });
    return driver.readDatapoints(points);
  }
  return { driver, send, reservation, adapter, port, logs };
}

test('real UDP listener recovers after an unexpected close instead of serving its old telegram forever', { timeout: 4000 }, async t => {
  const h = await fixture(t);
  await assert.rejects(h.driver.readDatapoints(points), { code: 'E_SPEEDWIRE_NO_DATA' });
  assert.equal((await h.send(1.5)).power, 1.5);
  const previous = h.driver.hub.socket; await close(previous);
  await h.driver._ensureListener();
  assert.notEqual(h.driver.hub.socket, previous);
  assert.equal((await h.send(2.5)).power, 2.5);
});

test('a failed initial UDP bind remains retryable after the occupied port is released', { timeout: 4000 }, async t => {
  const h = await fixture(t, true);
  await assert.rejects(h.driver.readDatapoints(points), { code: 'EADDRINUSE' });
  await close(h.reservation);
  await h.driver._ensureListener();
  assert.equal((await h.send(3.5)).power, 3.5);
  assert.equal(h.driver.hub.handlers.size, 1, 'retry must not duplicate receiver callbacks');
});

test('socket error is followed by a new receiver and stale socket events cannot stop its replacement', { timeout: 4000 }, async t => {
  const h = await fixture(t);
  await h.driver._ensureListener(); await h.send(4);
  const old = h.driver.hub.socket;
  old.emit('error', Object.assign(new Error('fixture transport failure'), { code: 'EIO' }));
  await new Promise(resolve => setImmediate(resolve));
  await h.driver._ensureListener();
  const replacement = h.driver.hub.socket;
  assert.ok(replacement); assert.notEqual(replacement, old);
  old.emit('error', new Error('late old socket event'));
  assert.equal(h.driver.hub.socket, replacement);
  assert.equal((await h.send(5)).power, 5);
  const lastSeen = h.driver.lastSeen;
  old.emit('message', telegram(99), { address: '127.0.0.1' });
  assert.equal((await h.driver.readDatapoints(points)).power, 5, 'old receiver cannot overwrite the replacement sample');
  assert.equal(h.driver.lastSeen, lastSeen, 'old receiver cannot fabricate measurement freshness');
});

test('disconnect during bind and shared-listener handover leave no orphan receiver or lost active subscriber', { timeout: 4000 }, async t => {
  const h = await fixture(t);
  const starting = h.driver._ensureListener(); const hub = h.driver.hub;
  await Promise.all([starting, h.driver.disconnect()]);
  assert.equal(hub.socket, null); assert.equal(hub.handlers.size, 0);
  await h.driver._ensureListener(); await h.send(6);
  const second = new SpeedwireDriver(h.adapter, { id: 'sma2', connection: { port: h.port, multicastGroup: '127.0.0.1', host: '127.0.0.1' } });
  t.after(() => second.disconnect()); await second._ensureListener();
  assert.equal(second.hub, h.driver.hub); assert.equal(second.hub.handlers.size, 2);
  await second.disconnect(); assert.equal(h.driver.hub.handlers.size, 1);
  assert.equal((await h.send(7)).power, 7);
});

test('one failed-bind subscriber leaving cannot evict the shared hub or split later users across two receivers', { timeout: 4000 }, async t => {
  const h = await fixture(t, true);
  const make = id => new SpeedwireDriver(h.adapter, { id, connection: { port: h.port, multicastGroup: '127.0.0.1', host: '127.0.0.1' } });
  const leaving = make('leaving'); const later = make('later');
  t.after(async () => { await leaving.disconnect(); await later.disconnect(); });
  const failed = await Promise.allSettled([h.driver._ensureListener(), leaving._ensureListener()]);
  assert.ok(failed.every(result => result.status === 'rejected' && result.reason.code === 'EADDRINUSE'));
  const shared = h.driver.hub;
  assert.equal(leaving.hub, shared); assert.equal(shared.handlers.size, 2);
  await leaving.disconnect();
  assert.equal(shared.handlers.size, 1); assert.equal(shared.socket, null);
  await close(h.reservation);
  await h.driver._ensureListener(); await later._ensureListener();
  assert.equal(later.hub, shared, 'the surviving subscriber must retain its registered shared hub');
  assert.equal(shared.handlers.size, 2);
  assert.equal((await h.send(8)).power, 8);
  assert.equal((await later.readDatapoints(points)).power, 8);
});

test('current validation and legacy import preserve all explicit SMA receiver and host-filter settings', async () => {
  const connection = { host: '192.168.10.70', filterHost: '192.168.10.70', port: 9522, multicastGroup: '239.12.255.254',
    interfaceAddress: '192.168.10.153', staleTimeoutMs: 45000, softStale: false, customerOption: 'preserve' };
  const device = { id: 'sma', protocol: 'speedwire', templateId: 'meter.sma.SmaEnergyMeterSpeedwireImpl', enabled: true, connection };
  const config = { enabled: true, devices: [device], pollIntervalMs: 5000 };
  assert.deepEqual(validateConfig(config).devices[0].connection, connection);
  assert.deepEqual((await preflightLegacyConfig({ enabled: true, devices: [], devicesJson: JSON.stringify([device]) })).config.devices[0].connection, connection);
  const defaults = new SpeedwireDriver({}, { connection: {} });
  assert.equal(defaults.port, 9522); assert.equal(defaults.multicastGroup, '239.12.255.254');
  assert.equal(defaults.interfaceAddress, ''); assert.equal(defaults.filterHost, '');
});
