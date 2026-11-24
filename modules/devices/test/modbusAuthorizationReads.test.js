'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, parent, main) {
  if (request === 'modbus-serial') return class {};
  if (request === 'serialport') return { SerialPort: class {} };
  return originalLoad.call(this, request, parent, main);
};
let ModbusDriver;
try { ({ ModbusDriver } = require('../lib/drivers/modbus')); } finally { Module._load = originalLoad; }
const { guardDriver } = require('../operation-guard');
const template = require('../lib/templates.json').templates.find(row => row.id === 'ess.solax.SolaXHybridX1X3Ess');
const point = id => template.datapoints.find(row => row.id === id);
const denied = code => Object.assign(new Error(code), { code });
const illegal = () => Object.assign(new Error('Modbus exception 2'), { modbusCode: 2 });
function fixture(read) {
  const logs = []; const calls = [];
  const adapter = { log: Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, message => logs.push({ level, message })])) };
  const driver = new ModbusDriver(adapter, { id: 'solax', protocol: 'modbusTcp', templateId: template.id,
    connection: { unitId: 1, minCommandIntervalMs: 0 } }, template, {});
  driver.ensureConnected = async () => {};
  const invoke = async (address, length) => { calls.push({ address, length }); return read(address, length); };
  driver.client = { setID() {}, readInputRegisters: invoke, readHoldingRegisters: invoke, readCoils: invoke, readDiscreteInputs: invoke, close() {} };
  return { driver, logs, calls };
}
function assertNotQuarantined(h) {
  assert.equal(h.driver._readGroupSkipUntil.size, 0);
  assert.equal(h.driver._readGroupWarnUntil.size, 0);
  assert.equal(h.logs.some(row => /skipped temporarily/.test(row.message)), false);
  assert.equal(h.driver._busy, false);
}

test('actual hosted gate loss after one SolaX read aborts the snapshot without poisoning remaining optional groups', async () => {
  let allowed = true; let revoke = true;
  const h = fixture((address, length) => { if (revoke) allowed = false; return { data: Array(length).fill(42) }; });
  const driver = guardDriver(h.driver, () => allowed);
  try {
    await assert.rejects(driver.readDatapoints([point('sOC'), point('gRID_POWER')]), { code: 'EOS_DEVICES_NOT_AUTHORIZED' });
    assert.equal(h.calls.length, 1, 'dispatch gate prevents the next physical read'); assertNotQuarantined(h);
    allowed = true; revoke = false; h.calls.length = 0;
    const result = await driver.readDatapoints([point('sOC'), point('gRID_POWER')]);
    assert.ok(Object.hasOwn(result, 'sOC')); assert.ok(Object.hasOwn(result, 'gRID_POWER'));
    assert.deepEqual(h.calls.map(row => row.address), [28, 52], 'next permitted poll immediately reads both groups');
  } finally { await driver.disconnect(); }
});

test('authorization and explicit stop errors bypass optional caching for registers, coils and discrete inputs', async () => {
  for (const code of ['EOS_DEVICES_NOT_AUTHORIZED', 'EOS_DEVICES_STOPPED', 'EOS_MODULE_STOPPED', 'EOS_OWNERSHIP_REQUIRED']) {
    for (const fc of [1, 2, 3, 4]) {
      const error = denied(code); const h = fixture(() => { throw error; });
      const dp = { id: 'optional', rw: 'ro', source: { kind: 'modbus', fc, address: 10, length: 1, dataType: 'uint16' } };
      try { await assert.rejects(h.driver.readDatapoints([dp]), thrown => thrown === error); assertNotQuarantined(h); }
      finally { await h.driver.disconnect(); }
    }
  }
});

test('a gate error inside an already split read cannot blacklist an optional item or continue the other items', async () => {
  const error = denied('EOS_DEVICES_NOT_AUTHORIZED'); const h = fixture(() => { throw error; });
  h.driver._readGroupForceSplitUntil.set('1:4:50:53', Date.now() + 60000);
  try {
    await assert.rejects(h.driver.readDatapoints([point('pV_POWER'), point('gRID_POWER')]), thrown => thrown === error);
    assertNotQuarantined(h); assert.equal(h.calls.length, 1);
  } finally { await h.driver.disconnect(); }
});

test('authorization failure at a documented fallback is not swallowed as the original illegal-register response', async () => {
  const error = denied('EOS_DEVICES_NOT_AUTHORIZED');
  const h = fixture(address => { if (address === 52) throw illegal(); throw error; });
  const dp = structuredClone(point('gRID_POWER')); dp.source.fallbackAddressOffsets = [1];
  try {
    await assert.rejects(h.driver.readDatapoints([dp]), thrown => thrown === error);
    assertNotQuarantined(h); assert.deepEqual(h.calls.map(row => row.address), [52, 53]);
  } finally { await h.driver.disconnect(); }
});

test('genuine unsupported optional registers retain their existing cooldown while useful groups remain readable', async () => {
  const h = fixture((address, length) => { if (address === 52) throw illegal(); return { data: Array(length).fill(42) }; });
  try {
    assert.deepEqual(await h.driver.readDatapoints([point('sOC'), point('gRID_POWER')]), { sOC: 42 });
    assert.equal(h.driver._readGroupSkipUntil.has('1:4:52:53'), true);
    assert.equal(h.logs.some(row => /skipped temporarily/.test(row.message)), true);
    h.calls.length = 0;
    assert.deepEqual(await h.driver.readDatapoints([point('sOC'), point('gRID_POWER')]), { sOC: 42 });
    assert.deepEqual(h.calls.map(row => row.address), [28]);
  } finally { await h.driver.disconnect(); }
});

test('authorization loss during optional SunSpec scanning is propagated and cannot cache an incomplete model map', async () => {
  const error = denied('EOS_DEVICES_NOT_AUTHORIZED'); let blocked = true;
  const h = fixture(() => { if (blocked) throw error; return { data: [65535, 0] }; });
  h.driver._autoSunSpec = true; h.driver._maybeDiscoverSunSpec = async () => true;
  try {
    await assert.rejects(h.driver._maybeScanSunSpecModels(), thrown => thrown === error);
    assert.notEqual(h.driver._sunSpecModelsScanned, true);
    blocked = false;
    assert.equal(await h.driver._maybeScanSunSpecModels(), true);
    assert.equal(h.driver._sunSpecModelsScanned, true);
  } finally { await h.driver.disconnect(); }
});

test('the read entry point does not hide an authorization error from optional model discovery', async () => {
  const error = denied('EOS_DEVICES_NOT_AUTHORIZED'); const h = fixture(() => ({ data: [0] }));
  h.driver._maybeScanSunSpecModels = async () => { throw error; };
  const dp = structuredClone(point('gRID_POWER')); dp.source.sunspecModel = 101;
  try {
    await assert.rejects(h.driver.readDatapoints([dp]), thrown => thrown === error);
    assertNotQuarantined(h); assert.equal(h.calls.length, 0);
  } finally { await h.driver.disconnect(); }
});
