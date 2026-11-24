/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const ModbusRTU = require('modbus-serial');
const { ModbusDriver } = require('../lib/drivers/modbus');
const { guardDriver } = require('../operation-guard');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function until(predicate) { for (let i = 0; i < 200; i++) { if (predicate()) return; await wait(5); } assert.fail('TCP lifecycle milestone missing'); }

async function fixture(t) {
  const connections = []; const sockets = new Set(); const requests = []; const logs = [];
  const server = net.createServer(socket => {
    connections.push(socket); sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    socket.on('data', data => requests.push(Buffer.from(data)));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  let allowed = true;
  const adapter = { log: Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, message => logs.push({ level, message })])) };
  const driver = guardDriver(new ModbusDriver(adapter, {
    id: 'connect-lifecycle', protocol: 'modbusTcp',
    connection: { host: '127.0.0.1', port: server.address().port, unitId: 1 },
  }, { id: 'generic.connect-lifecycle', datapoints: [] }, {}), () => allowed);
  t.after(async () => { await driver.disconnect(); for (const socket of sockets) socket.destroy(); await new Promise(resolve => server.close(resolve)); });
  return { driver, connections, requests, logs, allow: value => { allowed = value; } };
}

// These cases use the actual modbus-serial TCP transport and a real loopback
// listener. Only timing and authorization transitions are deliberately controlled.
test('disconnect during reconnect backoff prevents an old hosted connect opening a socket after stop', async t => {
  const h = await fixture(t); h.driver._nextConnectAt = Date.now() + 250;
  const pending = h.driver.connect(); const rejected = assert.rejects(pending, { code: 'E_MODBUS_CONNECT_CANCELLED' });
  await wait(20); h.allow(false); await h.driver.disconnect();
  await rejected;
  assert.equal(h.connections.length, 0); assert.equal(h.driver.connected, false); assert.equal(h.driver.client, null);
});

test('lease loss during reconnect backoff blocks TCP dispatch and a subsequent authorized attempt still works', async t => {
  const h = await fixture(t); h.driver._nextConnectAt = Date.now() + 200;
  const rejected = assert.rejects(h.driver.connect(), { code: 'EOS_DEVICES_NOT_AUTHORIZED' });
  await wait(20); h.allow(false); await rejected;
  assert.equal(h.connections.length, 0); assert.equal(h.driver.connected, false);
  h.allow(true); h.driver._nextConnectAt = 0; await h.driver.connect();
  assert.equal(h.connections.length, 1); assert.equal(h.driver.connected, true); assert.equal(h.driver.connecting, false);
});

test('late old backoff cannot close or change a replacement connection, even after authorization returns', async t => {
  const h = await fixture(t); h.driver._nextConnectAt = Date.now() + 250;
  const rejected = assert.rejects(h.driver.connect(), { code: 'E_MODBUS_CONNECT_CANCELLED' });
  await wait(20); await h.driver.disconnect(); h.driver._nextConnectAt = 0;
  await h.driver.connect(); const replacement = h.driver.client;
  await rejected;
  assert.equal(h.connections.length, 1); assert.equal(h.driver.client, replacement);
  assert.equal(h.driver.connected, true); assert.equal(h.driver._isTcpOpen(), true);
  assert.equal(h.requests.length, 0, 'connection lifecycle tests must not issue actuator writes');
});

test('a cancelled old ensureConnected caller cannot mark the replacement connection offline', async t => {
  const h = await fixture(t); h.driver._nextConnectAt = Date.now() + 250;
  const rejected = assert.rejects(h.driver.ensureConnected(), { code: 'E_MODBUS_CONNECT_CANCELLED' });
  await wait(20); await h.driver.disconnect(); h.driver._nextConnectAt = 0;
  await h.driver.ensureConnected(); const replacement = h.driver.client;
  await rejected;
  assert.equal(h.connections.length, 1); assert.equal(h.driver.client, replacement);
  assert.equal(h.driver.connected, true); assert.equal(h.driver._isTcpOpen(), true);
});

test('late real TCP connection completion cannot invalidate the replacement client', async t => {
  const h = await fixture(t); const held = deferred(); let callbacks = 0; let waiting = false;
  const original = ModbusRTU.prototype.connectTCP;
  t.mock.method(ModbusRTU.prototype, 'connectTCP', function (host, options, callback) {
    return original.call(this, host, options, error => {
      callbacks++;
      if (callbacks === 1) { waiting = true; void held.promise.then(() => callback(error)); }
      else callback(error);
    });
  });
  t.after(() => held.resolve());
  const rejected = assert.rejects(h.driver.connect(), { code: 'E_MODBUS_CONNECT_CANCELLED' });
  await until(() => waiting); await h.driver.disconnect();
  await h.driver.connect(); const replacement = h.driver.client;
  held.resolve(); await rejected;
  assert.equal(h.connections.length, 2); assert.equal(h.driver.client, replacement);
  assert.equal(h.driver.connected, true); assert.equal(h.driver._isTcpOpen(), true);
});

test('concurrent callers still share one TCP connection while no disconnect occurs', async t => {
  const h = await fixture(t); h.driver._nextConnectAt = Date.now() + 80;
  await Promise.all([h.driver.connect(), h.driver.connect(), h.driver.ensureConnected()]);
  assert.equal(h.connections.length, 1); assert.equal(h.driver.connected, true);
});

test('authorization loss inside optional SunSpec discovery is not reported as successful connection', async t => {
  const h = await fixture(t);
  h.driver._maybeDiscoverSunSpec = async () => { h.allow(false); throw Object.assign(new Error('EOS_DEVICES_NOT_AUTHORIZED'), { code: 'EOS_DEVICES_NOT_AUTHORIZED' }); };
  await assert.rejects(h.driver.connect(), { code: 'EOS_DEVICES_NOT_AUTHORIZED' });
  assert.equal(h.driver.connected, false); assert.equal(h.driver.client, null);
  assert.equal(h.logs.some(row => row.message.includes('SunSpec discovery error')), false);
});

test('actual interrupted SunSpec discovery stays retryable and does not cache an unverified unit', async t => {
  const h = await fixture(t); const driver = h.driver;
  driver._autoSunSpec = true; driver._sunSpecScanBases = [40000]; driver._sunSpecScanFcs = [3];
  let calls = 0; let rejectFirst = true;
  driver._mbReadHoldingRegisters = async () => { calls++; if (rejectFirst) throw Object.assign(new Error('EOS_DEVICES_NOT_AUTHORIZED'), { code: 'EOS_DEVICES_NOT_AUTHORIZED' }); return { data: [0x5375, 0x6e53] }; };
  const originalUnitId = driver.unitId;
  await assert.rejects(driver._maybeDiscoverSunSpec(), { code: 'EOS_DEVICES_NOT_AUTHORIZED' });
  assert.equal(driver._sunSpecDiscovered, false); assert.equal(driver.unitId, originalUnitId);
  rejectFirst = false; assert.equal(await driver._maybeDiscoverSunSpec(), true);
  assert.equal(calls, 2); assert.equal(driver._sunSpecFoundBase, 40000); assert.equal(driver._sunSpecDiscovered, true);
});

test('late actual SunSpec probe cannot mutate replacement metadata or timeout', async t => {
  const h = await fixture(t); const driver = h.driver; const held = deferred();
  driver._autoSunSpec = true; driver._sunSpecScanBases = [40000]; driver._sunSpecScanFcs = [3];
  driver._mbReadHoldingRegisters = async () => held.promise;
  const rejected = assert.rejects(driver._maybeDiscoverSunSpec(), { code: 'E_MODBUS_CONNECT_CANCELLED' });
  await wait(5); await driver.disconnect();
  const timeouts = []; const replacement = { setTimeout: value => timeouts.push(value), close() {} };
  driver.client = replacement; driver.unitId = 17; driver.autoUnitId = 17;
  driver._sunSpecFoundBase = 1; driver.wordOrder = 'le';
  held.resolve({ data: [0x5375, 0x6e53] }); await rejected;
  assert.equal(driver.client, replacement); assert.equal(driver.unitId, 17); assert.equal(driver.autoUnitId, 17);
  assert.equal(driver._sunSpecFoundBase, 1); assert.equal(driver.wordOrder, 'le'); assert.deepEqual(timeouts, []);
  assert.equal(driver._sunSpecDiscovered, false);
});

test('concurrent SunSpec discovery shares a single current-generation probe', async t => {
  const h = await fixture(t); const driver = h.driver; const held = deferred(); let calls = 0;
  driver._autoSunSpec = true; driver._sunSpecScanBases = [40000]; driver._sunSpecScanFcs = [3];
  driver._mbReadHoldingRegisters = async () => { calls++; return held.promise; };
  const a = driver._maybeDiscoverSunSpec(); const b = driver._maybeDiscoverSunSpec();
  await wait(5); assert.equal(calls, 1); held.resolve({ data: [0x5375, 0x6e53] });
  assert.deepEqual(await Promise.all([a, b]), [true, true]); assert.equal(calls, 1);
});

test('late model-map response cannot overwrite the replacement generation cache', async t => {
  const h = await fixture(t); const driver = h.driver; const held = deferred();
  driver._autoSunSpec = true; driver._sunSpecDiscovered = true;
  driver._mbReadHoldingRegisters = async () => held.promise;
  const rejected = assert.rejects(driver._maybeScanSunSpecModels(), { code: 'E_MODBUS_CONNECT_CANCELLED' });
  await wait(5); await driver.disconnect();
  const replacementMap = new Map([[103, [{ offset: 9, len: 8 }]]]); driver._sunSpecModelsById = replacementMap; driver._sunSpecModelsScanned = false;
  held.resolve({ data: [0xffff, 0] }); await rejected;
  assert.equal(driver._sunSpecModelsById, replacementMap); assert.equal(driver._sunSpecModelsScanned, false);
});
