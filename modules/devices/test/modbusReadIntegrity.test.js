'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const templates = require('../lib/templates.json').templates;
const originalLoad = Module._load;
Module._load = function(request, parent, main) {
  if (request === 'modbus-serial') return class {};
  if (request === 'serialport') return { SerialPort:class {} };
  return originalLoad.call(this, request, parent, main);
};
let ModbusDriver;
try { ({ ModbusDriver } = require('../lib/drivers/modbus')); } finally { Module._load = originalLoad; }

const template = templates.find(item => item.id === 'ess.sungrow.ResidentialHybridV119');
const datapoint = id => template.datapoints.find(dp => dp.id === id);
const grid = datapoint('gRID_POWER');
const phase = datapoint('MeterPhaseAActivePower');
const pv = datapoint('pV_POWER');
const exception = code => Object.assign(new Error(`Modbus exception ${code}`), { modbusCode:code });
let sequence = 0;

function fixture(read, connection = {}) {
  const calls = [];
  const logs = [];
  let connects = 0;
  const adapter = { log:Object.fromEntries(['debug', 'info', 'warn', 'error'].map(level => [level, message => logs.push({ level, message })])) };
  const driver = new ModbusDriver(adapter, {
    id:`integrity-${++sequence}`, protocol:'modbusTcp', templateId:template.id,
    connection:{ unitId:1, minCommandIntervalMs:0, ...connection },
  }, template, {});
  driver.ensureConnected = async () => { connects += 1; };
  let unitId;
  const readRegisters = async (fc, address, length) => {
    const call = { fc, address, length, unitId };
    calls.push(call);
    return read(call);
  };
  driver.client = {
    setID(id) { unitId = id; },
    readHoldingRegisters:(address, length) => readRegisters(3, address, length),
    readInputRegisters:(address, length) => readRegisters(4, address, length),
    writeRegister() { throw new Error('read-integrity test must never write'); },
    writeRegisters() { throw new Error('read-integrity test must never write'); },
    close() {},
  };
  return { driver, calls, logs, connects:() => connects };
}

function withFc(dp, fc) {
  return { ...dp, source:{ ...dp.source, read:{ ...dp.source.read, fc } } };
}

test('complete FC3/FC4 words preserve signed values, genuine zero and configured sentinels', async () => {
  for (const fc of [3, 4]) {
    for (const [words, expected] of [
      [[0, 0], 0], [[1234, 0], 1234], [[64302, 65535], -1234],
      [[65535, 65535], -1], [[65535, 32767], null], [[0, 32768], null],
    ]) {
      const buffer = Buffer.alloc(words.length * 2);
      words.forEach((word, index) => buffer.writeUInt16BE(word, index * 2));
      const x = fixture(() => fc === 3 ? { data:words, buffer } : { data:words });
      try {
        const out = await x.driver.readDatapoints([withFc(grid, fc)]);
        assert.deepEqual(out, { gRID_POWER:expected });
        assert.deepEqual(x.calls, [{ fc, address:5600, length:2, unitId:1 }]);
      } finally { await x.driver.disconnect(); }
    }
  }
});

const malformedResponses = [
  ['missing response', () => undefined],
  ['missing data', () => ({})],
  ['non-array data', () => ({ data:{ 0:0, 1:0, length:2 } })],
  ['empty data', () => ({ data:[] })],
  ['short data', () => ({ data:[1234] })],
  ['overlong data', () => ({ data:[1234, 0, 0] })],
  ['short payload buffer', () => ({ data:[1234, 0], buffer:Buffer.alloc(3) })],
  ['overlong payload buffer', () => ({ data:[1234, 0], buffer:Buffer.alloc(5) })],
  ['sparse data', () => ({ data:Array(2) })],
  ['null word', () => ({ data:[null, 0] })],
  ['undefined word', () => ({ data:[0, undefined] })],
  ['NaN word', () => ({ data:[NaN, 0] })],
  ['infinite word', () => ({ data:[0, Infinity] })],
  ['fractional word', () => ({ data:[1.5, 0] })],
  ['negative word', () => ({ data:[-1, 0] })],
  ['overflowing word', () => ({ data:[65536, 0] })],
  ['string word', () => ({ data:['0', 0] })],
  ['boolean word', () => ({ data:[false, 0] })],
];

for (const [label, response] of malformedResponses) {
  test(`required FC3/FC4 ${label} fails without fabricated power, fallback or skip caching`, async () => {
    for (const fc of [3, 4]) {
      const x = fixture(response);
      try {
        await assert.rejects(x.driver.readDatapoints([withFc(grid, fc)]), { code:'E_MODBUS_READ_RESPONSE' });
        assert.deepEqual(x.calls, [{ fc, address:5600, length:2, unitId:1 }]);
        assert.equal(x.driver._readGroupSkipUntil.size, 0);
        assert.equal(x.driver._busy, false);
      } finally { await x.driver.disconnect(); }
    }
  });
}

test('required short group fails the whole snapshot even when another live value was read', async () => {
  const x = fixture(({ address }) => ({ data:address === 5600 ? [1234] : [456, 0] }));
  try {
    await assert.rejects(x.driver.readDatapoints([pv, grid]), { code:'E_MODBUS_READ_RESPONSE' });
    assert.deepEqual(x.calls.map(call => call.address), [5016, 5600]);
    assert.equal(x.driver._readGroupSkipUntil.size, 0);
  } finally { await x.driver.disconnect(); }
});

test('slow split failure of required grid power cannot suppress the following recovered fast poll', async () => {
  let gridBusy = true;
  const x = fixture(({ address, length }) => {
    if (address === 5600 && length > 2) throw exception(2);
    if (address === 5600 && gridBusy) throw exception(6);
    return { data:[address === 5600 ? 1234 : 456, 0] };
  });
  try {
    await assert.rejects(x.driver.readDatapoints([grid, phase]), { modbusCode:6 });
    assert.deepEqual(x.calls.map(call => [call.address, call.length]), [[5600, 4], [5600, 2], [5602, 2]]);
    assert.equal(x.driver._readGroupSkipUntil.has('1:4:5600:5601'), false);
    assert.equal(x.logs.some(log => /Optional Modbus read group failed.*gRID_POWER/.test(log.message)), false);
    gridBusy = false;
    x.calls.length = 0;
    assert.deepEqual(await x.driver.readDatapoints([pv, grid]), { pV_POWER:456, gRID_POWER:1234 });
    assert.deepEqual(x.calls.map(call => [call.address, call.length]), [[5016, 2], [5600, 2]]);
  } finally { await x.driver.disconnect(); }
});

test('existing required skip entries cannot hide repeated errors or later recovery', async () => {
  let busy = true;
  const x = fixture(({ address }) => {
    if (address === 5600 && busy) throw exception(6);
    return { data:[address === 5600 ? 1234 : 456, 0] };
  });
  try {
    x.driver._readGroupSkipUntil.set('1:4:5600:5601', Date.now() + 300000);
    for (let i = 0; i < 2; i++) {
      await assert.rejects(x.driver.readDatapoints([pv, grid]), { modbusCode:6 });
      assert.equal(x.driver._readGroupSkipUntil.has('1:4:5600:5601'), false);
    }
    busy = false;
    assert.equal((await x.driver.readDatapoints([pv, grid])).gRID_POWER, 1234);
    assert.equal(x.calls.filter(call => call.address === 5600).length, 3);
  } finally { await x.driver.disconnect(); }
});

test('required entries remain readable inside cached split mode while optional failure stays isolated', async () => {
  const x = fixture(({ address }) => {
    if (address === 5602) throw exception(2);
    return { data:[1234, 0] };
  });
  try {
    x.driver._readGroupForceSplitUntil.set('1:4:5600:5603', Date.now() + 600000);
    x.driver._readGroupSkipUntil.set('1:4:5600:5601', Date.now() + 300000);
    assert.deepEqual(await x.driver.readDatapoints([grid, phase]), { gRID_POWER:1234 });
    assert.deepEqual(x.calls.map(call => [call.address, call.length]), [[5600, 2], [5602, 2]]);
    assert.equal(x.driver._readGroupSkipUntil.has('1:4:5600:5601'), false);
    assert.equal(x.driver._readGroupSkipUntil.has('1:4:5602:5603'), true);
    x.calls.length = 0;
    assert.deepEqual(await x.driver.readDatapoints([grid, phase]), { gRID_POWER:1234 });
    assert.deepEqual(x.calls.map(call => [call.address, call.length]), [[5600, 2]]);
  } finally { await x.driver.disconnect(); }
});

test('malformed required split response is not hidden by a valid optional neighbour', async () => {
  const x = fixture(({ address, length }) => {
    if (length > 2) throw exception(2);
    return { data:address === 5600 ? [1234] : [456, 0] };
  });
  try {
    await assert.rejects(x.driver.readDatapoints([grid, phase]), { code:'E_MODBUS_READ_RESPONSE' });
    assert.equal(x.driver._readGroupSkipUntil.has('1:4:5600:5601'), false);
    assert.equal(x.calls.length, 3);
  } finally { await x.driver.disconnect(); }
});

test('optional malformed split response is cached without losing required grid or retrying the block', async () => {
  const x = fixture(({ address, length }) => {
    if (length > 2) throw exception(2);
    return { data:address === 5600 ? [1234, 0] : [null, null] };
  });
  try {
    assert.deepEqual(await x.driver.readDatapoints([grid, phase]), { gRID_POWER:1234 });
    assert.equal(x.driver._readGroupSkipUntil.has('1:4:5602:5603'), true);
    x.calls.length = 0;
    assert.deepEqual(await x.driver.readDatapoints([grid, phase]), { gRID_POWER:1234 });
    assert.deepEqual(x.calls.map(call => [call.address, call.length]), [[5600, 2]]);
  } finally { await x.driver.disconnect(); }
});

test('an optional standalone malformed group remains isolated and bounded; all-invalid reads still fail', async () => {
  const x = fixture(({ address }) => ({ data:address === 5602 ? [] : [456, 0] }));
  try {
    assert.deepEqual(await x.driver.readDatapoints([pv, phase]), { pV_POWER:456 });
    assert.equal(x.driver._readGroupSkipUntil.has('1:4:5602:5603'), true);
    x.calls.length = 0;
    assert.deepEqual(await x.driver.readDatapoints([pv, phase]), { pV_POWER:456 });
    assert.deepEqual(x.calls.map(call => call.address), [5016]);
  } finally { await x.driver.disconnect(); }
  const onlyOptional = fixture(() => ({ data:[] }));
  try {
    await assert.rejects(onlyOptional.driver.readDatapoints([phase]), { code:'E_MODBUS_READ_RESPONSE' });
    assert.equal(onlyOptional.calls.length, 1);
  } finally { await onlyOptional.driver.disconnect(); }
});

test('required transport failures preserve their original code without retries or skip caching', async () => {
  const failure = Object.assign(new Error('socket reset'), { code:'ECONNRESET' });
  const x = fixture(() => { throw failure; });
  try {
    await assert.rejects(x.driver.readDatapoints([grid]), error => error === failure);
    assert.equal(x.calls.length, 1);
    assert.equal(x.connects(), 1);
    assert.equal(x.driver._readGroupSkipUntil.size, 0);
    assert.equal(x.driver._busy, false);
    assert.equal(x.driver.client, null);
  } finally { await x.driver.disconnect(); }
});
