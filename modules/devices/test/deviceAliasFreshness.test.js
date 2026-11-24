'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const templates = require('../lib/templates.json').templates;
const { recordReadResponse } = require('../lib/modbusReadEvidence');
const { buildSemanticAliasDefinitions } = require('../lib/deviceAliasSemantics');

const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'modbus-serial') return class ModbusRTU {};
  if (request === 'serialport') return { SerialPort: class SerialPort {} };
  if (request === 'mqtt') return { connect() { throw new Error('unexpected device connection'); } };
  if (request === 'axios') return {};
  return originalLoad.call(this, request, parent, isMain);
};
let DeviceRuntime;
let ModbusDriver;
try {
  DeviceRuntime = require('../lib/deviceRuntime').DeviceRuntime;
  ModbusDriver = require('../lib/drivers/modbus').ModbusDriver;
} finally { Module._load = originalLoad; }

function createRuntime(templateId, protocol = 'modbusTcp', config = {}) {
  const template = templates.find(item => item.id === templateId);
  assert.ok(template);
  const writes = [];
  const adapter = {
    log: { debug() {}, info() {}, warn() {}, error() {} },
    async setStateAsync(id, state) { writes.push({ id, ...state, ts: Date.now() }); },
  };
  const cfg = { id: 'sample', templateId, category: template.category, protocol, connection: {}, ...config };
  const runtime = new DeviceRuntime(adapter, cfg, template, {});
  for (const dp of template.datapoints) runtime.dpById.set(dp.id, dp);
  runtime.aliasDefs = runtime._buildAliasDefinitions();
  runtime._liveAliasRefreshMs = runtime._computeLiveAliasRefreshMs({ fastIntervalMs: 1000 });
  return { runtime, writes, template, adapter, cfg };
}

function lastWrite(writes, suffix) { return writes.findLast(item => item.id.endsWith(suffix)); }

test('constant SMA grid samples stay fresh for 30 minutes; cached telegrams, failed polls and counters do not', async t => {
  let now = 100000;
  t.mock.method(Date, 'now', () => now);
  const { runtime, writes } = createRuntime('meter.sma.SmaEnergyMeterSpeedwireImpl', 'speedwire');
  runtime.driver = { lastSeen: now };
  const values = { aCTIVE_POWER: 1.234, aCTIVE_CONSUMPTION_POWER: 1.234, aCTIVE_PRODUCTION_POWER: 0 };
  for (let i = 0; i <= 1800; i++) {
    runtime.driver.lastSeen = now;
    await runtime._updateAliases(values, { connected: true });
    assert.equal(lastWrite(writes, '.aliases.v1.r.power').val, 1234);
    assert.ok(now - lastWrite(writes, '.aliases.v1.r.power').ts < 2000, 'constant measured power must remain current');
    now += 1000;
  }
  const freshAt = lastWrite(writes, '.aliases.v1.r.power').ts;
  now += 30000;
  await runtime._updateAliases(values, { connected: true });
  assert.equal(lastWrite(writes, '.aliases.v1.r.power').ts, freshAt, 'old Speedwire telegram cannot renew measurement');
  await runtime._updateAliases({}, { connected: false, lastError: 'timeout' });
  assert.equal(lastWrite(writes, '.aliases.v1.r.power').ts, freshAt);
  assert.equal(lastWrite(writes, '.aliases.v1.comm.connected').val, false);
  assert.equal(runtime._liveAliasRefreshOptions('devices.sample.aliases.v1.r.energyImport', values, {}, ['aCTIVE_POWER']), undefined);
});

test('FENECON real battery, SOC, PV, converter and grid samples refresh within bound while commands remain change-only', async t => {
  let now = 500000;
  t.mock.method(Date, 'now', () => now);
  const { runtime, writes } = createRuntime('ess.fenecon.FeneconHomeEssImpl');
  const values = { bATTERY_AC_POWER: -2, eSS_SOC_IN: 60, pV_POWER_SUM: 3, pV_DC_POWER: 3, pV_AC_POWER: 0, eSS0_ACTIVE_POWER: 1, gRID_POWER: 0.2 };
  await runtime._updateAliases(values, { connected: true });
  const checks = new Map([
    ['r.power', -2000], ['r.soc', 60], ['r.pvPower', 3000], ['r.pvPowerDc', 3000],
    ['r.pvPowerAc', 0], ['r.essActivePower', 1000], ['r.nvpPower', 200],
  ]);
  const initialCount = writes.length;
  now += 200;
  await runtime._updateAliases(values, { connected: true });
  assert.equal(writes.length, initialCount, 'polls before the refresh bound must not flood unchanged states');
  now += 1000;
  await runtime._updateAliases(values, { connected: true });
  for (const [path, expected] of checks) {
    const state = lastWrite(writes, `.aliases.v1.${path}`);
    assert.equal(state.val, expected, path);
    assert.equal(state.ts, now, path);
  }
  const pvAt = lastWrite(writes, '.aliases.v1.r.pvPowerDc').ts;
  now += 30000;
  await runtime._updateAliases({ eSS_SOC_IN: 60 }, { connected: true });
  assert.equal(lastWrite(writes, '.aliases.v1.r.pvPowerDc').ts, pvAt, 'unrelated SOC sample cannot refresh PV');
  assert.equal(runtime._liveAliasRefreshOptions('devices.sample.aliases.v1.ctrl.powerSetpointW', values, {}, ['eSS0_ACTIVE_POWER']), undefined);
});

test('SolaX applied-target readback refreshes only from actual poll, never write acknowledgement or unrelated packet', async t => {
  let now = 1000000;
  t.mock.method(Date, 'now', () => now);
  const { runtime, writes } = createRuntime('ess.solax.SolaXHybridX1X3Ess');
  const actual = { sET_CONTROL_MODE: 4, sET_ACTIVE_POWER: 900 };
  recordReadResponse(actual, Object.keys(actual));
  await runtime._updateAliases(actual, { connected: true });
  const path = '.aliases.v1.r.powerSetpointReadbackW';
  now += 5000;
  await runtime._ackWrittenValue(runtime.dpById.get('sET_ACTIVE_POWER'), 1200);
  assert.equal(lastWrite(writes, path).ts, 1000000);
  assert.equal(lastWrite(writes, path).val, 900);
  await runtime._updateAliases({ bMS1_SOC: 55 }, { connected: true });
  assert.equal(lastWrite(writes, path).ts, 1000000);
  const nextActual = { sET_CONTROL_MODE: 4, sET_ACTIVE_POWER: 900 };
  recordReadResponse(nextActual, Object.keys(nextActual));
  await runtime._updateAliases(nextActual, { connected: true });
  assert.equal(lastWrite(writes, path).ts, now);
});

test('MQTT full caches and diagnostic packets cannot refresh an old source or a partially updated computed alias', async t => {
  let now = 2000000;
  t.mock.method(Date, 'now', () => now);
  const { runtime, writes } = createRuntime('ess.solax.SolaXHybridX1X3Ess', 'mqtt');
  runtime.driver = { updatedAtByDpId: new Map([['bATTERY_POWER', now], ['pV_POWER', now]]) };
  const values = { bATTERY_POWER: 1500, pV_POWER: 500 };
  await runtime._updateAliases(values, { connected: true });
  const powerPath = '.aliases.v1.r.power';
  now += 5000;
  runtime.driver.updatedAtByDpId.set('pV_POWER', now);
  await runtime._updateAliases(values, { connected: true });
  assert.equal(lastWrite(writes, powerPath).ts, 2000000);
  assert.equal(lastWrite(writes, '.aliases.v1.r.pvPowerTotal').ts, now);
  runtime.driver.updatedAtByDpId.set('bATTERY_POWER', now);
  await runtime._updateAliases(values, { connected: true, diagnosticsOnly: true });
  assert.equal(lastWrite(writes, powerPath).ts, 2000000);
  await runtime._updateAliases(values, { connected: true });
  assert.equal(lastWrite(writes, powerPath).ts, now);
  // A composite measurement requires renewed evidence for every source it uses.
  runtime.aliasDefs = [{ relId: 'devices.sample.aliases.v1.r.power', type: 'number', rw: 'ro', kind: 'computed', get: v => v.bATTERY_POWER + v.pV_POWER }];
  await runtime._updateAliases(values, { connected: true });
  const compositeAt = lastWrite(writes, powerPath).ts;
  now += 5000;
  runtime.driver.updatedAtByDpId.set('bATTERY_POWER', now);
  await runtime._updateAliases(values, { connected: true });
  assert.equal(lastWrite(writes, powerPath).ts, compositeAt);
});

test('FENECON 780 controller block / 882 target changes only controller route and retains all verified read aliases', () => {
  const { runtime, template, adapter, cfg } = createRuntime('ess.fenecon.FeneconHomeEssImpl', 'modbusTcp', { feneconCtrlBalancingOffset: -110 });
  const driver = new ModbusDriver(adapter, cfg, template, {});
  const target = template.datapoints.find(dp => dp.id === 'sET_GRID_ACTIVE_POWER');
  assert.equal(driver._addr(target.source.write), 882);
  const before = buildSemanticAliasDefinitions({ baseId: runtime.baseId, template });
  const after = buildSemanticAliasDefinitions({ baseId: runtime.baseId, template, getDpById: id => runtime.dpById.get(id) });
  assert.deepEqual(after.coverage, before.coverage);
  for (const [id, address] of [['eSS0_ACTIVE_POWER', 604], ['gRID_POWER', 315], ['pV_DC_POWER', 339], ['mIN_POWER_SETPOINT', 702]]) {
    assert.equal(driver._addr(runtime.dpById.get(id).source.read), address);
  }
  assert.equal(after.definitions.length, 8);
});
