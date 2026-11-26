'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const templates = require('../lib/templates.json').templates;
const { DeviceRuntime } = require('../lib/deviceRuntime');

function profile(unit) {
  return templates.find(t => t.id === 'heat.ovum.mira.' + unit);
}

function build(template) {
  const written = new Map();
  const adapter = {
    log: { debug() {}, info() {}, warn() {}, error() {} },
    async setStateAsync(id, state) { written.set(id, { ...state, at: Date.now() }); },
  };
  const runtime = new DeviceRuntime(adapter, { id: 'm', protocol: 'modbusTcp', templateId: template.id, connection: {} }, template, {});
  for (const dp of template.datapoints) runtime.dpById.set(dp.id, dp);
  runtime.aliasDefs = runtime._buildAliasDefinitions();
  runtime._liveAliasRefreshMs = runtime._computeLiveAliasRefreshMs({ fastIntervalMs: 5000 });
  return { runtime, written, find: path => runtime.aliasDefs.find(def => def.relId === 'devices.m.aliases.v1.' + path) };
}

test('OVUM MIRA START uses distinct physical units, zero-based FC03 addresses and atomic writes only to five volatile HSM inputs', () => {
  const writable = new Map([
    ['control.pvStatus', [55070, 1, 'int16', 6]],
    ['control.batterySocPct', [55071, 1, 'int16', 6]],
    ['control.gridPowerW', [55072, 2, 'int32', 16]],
    ['control.inverterPowerW', [55074, 2, 'int32', 16]],
    ['control.pvPowerTargetW', [55076, 2, 'int32', 16]],
  ]);
  for (const [unit, uid, count] of [['hsm', 110, 34], ['wpm', 111, 8]]) {
    const t = profile(unit);
    assert.deepEqual(t.protocols, ['modbusTcp', 'modbusRtu']);
    assert.equal(t.driverHints.modbus.unitIdDefault, uid);
    assert.equal(t.driverHints.modbus.forceAddressOffset, 0);
    assert.equal(t.datapoints.length, count);
    for (const dp of t.datapoints) {
      const { read, write } = dp.source;
      assert.ok(read.address >= 55000, 'login code must never be exposed as a state');
      assert.equal(read.fc, 3);
      assert.equal(read.byteOrder, 'be');
      assert.equal(read.wordOrder, 'be');
      if (unit === 'hsm' && writable.has(dp.id)) {
        assert.equal(dp.rw, 'rw');
        assert.deepEqual([write.address, write.length, write.dataType, write.fc], writable.get(dp.id));
        assert.equal(read.address, write.address);
      } else {
        assert.equal(dp.rw, 'ro');
        assert.equal(write, undefined);
      }
    }
  }
  const wpm = build(profile('wpm'));
  assert.equal(wpm.find('r.power').dpId, 'measurement.electricalPowerW');
  const dp = wpm.runtime.dpById.get('measurement.electricalPowerW');
  assert.equal(dp.source.read.address, 56021);
  assert.equal(dp.source.scaleFactor, 3);
  assert.equal(wpm.find('r.power').unit, 'W');
  assert.equal(wpm.find('r.power').fromDevice(null), null);
  assert.equal(wpm.find('r.power').fromDevice(Infinity), null);
  assert.equal(wpm.find('ctrl.pvStatus'), undefined);
  const hsm = build(profile('hsm'));
  assert.equal(hsm.find('r.power'), undefined);
  assert.equal(hsm.find('ctrl.pvPowerTargetW').writeDpId, 'control.pvPowerTargetW');
  assert.equal(hsm.find('ctrl.pvStatus').writeDpId, 'control.pvStatus');
  assert.equal(hsm.find('ctrl.run'), undefined);
  assert.equal(hsm.find('ctrl.powerLimitW'), undefined);
});

test('remapped measurement or command never becomes the built-in MIRA energy-flow or control alias', () => {
  const t = structuredClone(profile('wpm'));
  t.datapoints.find(dp => dp.id === 'measurement.electricalPowerW').source.read.address = 56023;
  assert.equal(build(t).find('r.power'), undefined);
  const hsm = structuredClone(profile('hsm'));
  hsm.datapoints.find(dp => dp.id === 'control.pvStatus').source.write.address = 55000;
  assert.equal(build(hsm).find('ctrl.pvStatus'), undefined);
});

test('MIRA command acknowledgement never becomes physical FC03 readback; constant real samples refresh, unrelated polls do not', async t => {
  let now = 500000;
  t.mock.method(Date, 'now', () => now);
  const { runtime, written, find } = build(profile('hsm'));
  const pv = runtime.dpById.get('control.pvStatus');
  const target = runtime.dpById.get('control.pvPowerTargetW');
  const statusId = find('r.pvStatus').relId;
  const targetId = find('r.pvPowerTargetW').relId;
  await runtime._ackWrittenValue(pv, 1);
  await runtime._ackWrittenValue(target, 3500);
  assert.equal(written.has(statusId), false);
  assert.equal(written.has(targetId), false);
  const observation = { [pv.id]: 0, [target.id]: 2400 };
  await runtime._updateAliases(observation, { connected: true });
  assert.equal(written.get(statusId).val, 0);
  assert.equal(written.get(targetId).val, 2400);
  now += 6000;
  await runtime._updateAliases({ 'hc.roomTemp': 19 }, { connected: true });
  assert.equal(written.get(targetId).at, now - 6000);
  await runtime._updateAliases(observation, { connected: true });
  assert.equal(written.get(targetId).at, now);
  assert.equal(written.get(statusId).at, now);
  const wpm = build(profile('wpm'));
  const power = wpm.find('r.power').relId;
  await wpm.runtime._updateAliases({ 'measurement.electricalPowerW': 0 }, { connected: true });
  now += 6500;
  await wpm.runtime._updateAliases({ 'measurement.thermalPowerW': 10000 }, { connected: true });
  assert.equal(wpm.written.get(power).at, now - 6500);
  await wpm.runtime._updateAliases({ 'measurement.electricalPowerW': 0 }, { connected: true });
  assert.deepEqual(wpm.written.get(power), { val: 0, ack: true, at: now });
});
