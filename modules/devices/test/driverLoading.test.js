'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const drivers = {
  modbusTcp: ['modbus', 'ModbusDriver'],
  modbusRtu: ['modbus', 'ModbusDriver'],
  modbusAscii: ['modbus', 'ModbusDriver'],
  mbus: ['mbus', 'MbusDriver'],
  onewire: ['onewire', 'OneWireDriver'],
  speedwire: ['speedwire', 'SpeedwireDriver'],
  mqtt: ['mqtt', 'MqttDriver'],
  canbus: ['canbus', 'CanbusDriver'],
  kostalTcp: ['kostalTcp', 'KostalTcpDriver'],
  kostalRs485: ['kostalRs485', 'KostalRs485Driver'],
  http: ['http', 'HttpDriver'],
  taCmi: ['taCmi', 'TaCmiDriver'],
  udp: ['udp', 'UdpDriver'],
};
const names = [...new Set([...Object.values(drivers).map(([file]) => file), 'deyeModbus', 'vartaModbus'])];
const paths = Object.fromEntries(names.map(file => [file, require.resolve(`../lib/drivers/${file}`)]));

function loadedDrivers() {
  return names.filter(file => require.cache[paths[file]]).sort();
}

test('hosted Devices only loads transports selected by configured active devices', async t => {
  const { install } = require('../lib/sungrowFastFeedbackPatch');
  install();
  const { DeviceRuntime } = require('../lib/deviceRuntime');
  const adapter = { log: { info() {} }, async setStateAsync() {} };
  const connection = { path: '/dev/null', baseUrl: 'http://127.0.0.1', bridgeEnabled: false };
  const makeRuntime = (protocol, template = {}, enabled = true) => new DeviceRuntime(
    adapter, { id: 'fixture', protocol, enabled, connection }, template, {},
  );
  assert.deepEqual(loadedDrivers(), []);

  const disabled = makeRuntime('mqtt', {}, false);
  await disabled.start();
  assert.equal(disabled.driver, null);
  assert.throws(() => makeRuntime('unsupported')._createDriver(), /Unsupported protocol: unsupported/);
  assert.deepEqual(loadedDrivers(), []);

  const selected = new Set();
  for (const [protocol, [file, className]] of Object.entries(drivers)) {
    const runtime = makeRuntime(protocol);
    const first = runtime._createDriver();
    t.after(() => first.disconnect());
    const next = runtime._createDriver();
    t.after(() => next.disconnect());
    assert.equal(first.constructor.name, className, protocol);
    assert.equal(next.constructor, first.constructor, `${protocol}: subsequent start reuses the loaded module`);
    assert.notEqual(next, first, `${protocol}: subsequent start creates an independent driver`);
    selected.add(file);
    assert.deepEqual(loadedDrivers(), [...selected].sort(), protocol);
  }

  const profiles = [
    { protocol: 'modbusRtu', file: 'deyeModbus', className: 'DeyeModbusDriver', template: {
      id: 'ess.deye.singlePhase.modbusRtu', manufacturer: 'DEYE',
      driverHints: { deyeModbus: { profile: 'singlePhase' } },
    } },
    { protocol: 'modbusTcp', file: 'vartaModbus', className: 'VartaModbusDriver', template: {
      id: 'ess.varta.pulseNeo.modbusTcpV14', manufacturer: 'VARTA',
      driverHints: { vartaModbus: { product: 'pulseNeo' } },
    } },
  ];
  for (const { protocol, file, className, template } of profiles) {
    const driver = makeRuntime(protocol, template)._createDriver();
    t.after(() => driver.disconnect());
    assert.equal(driver.constructor.name, className);
    selected.add(file);
    assert.deepEqual(loadedDrivers(), [...selected].sort(), protocol);
  }
});
