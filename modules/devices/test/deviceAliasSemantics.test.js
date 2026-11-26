'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const templates = require('../lib/templates.json').templates;
const policy = require('../lib/device-alias-semantics-v1.json');
const { buildSemanticAliasDefinitions } = require('../lib/deviceAliasSemantics');
const { buildManifest, cloneStandardDefinition } = require('../lib/aliasContract');

function loadRuntime() {
  const original = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'modbus-serial') return class ModbusRTU {};
    if (request === 'serialport') return { SerialPort: class SerialPort {} };
    if (request === 'mqtt') return { connect() { throw new Error('unexpected MQTT connection'); } };
    if (request === 'axios') return {};
    return original.call(this, request, parent, isMain);
  };
  try { return require('../lib/deviceRuntime').DeviceRuntime; }
  finally { Module._load = original; }
}
const DeviceRuntime = loadRuntime();

function runtimeFor(id) {
  const template = templates.find(item => item.id === id);
  assert.ok(template, id);
  const adapter = { log: { debug() {}, info() {}, warn() {}, error() {} } };
  const runtime = new DeviceRuntime(adapter, { id: 'audit', templateId: id, category: template.category, connection: {} }, template, {});
  for (const dp of template.datapoints) runtime.dpById.set(dp.id, dp);
  const defs = runtime._buildAliasDefinitions();
  runtime.aliasDefs = defs;
  return { runtime, template, defs, byPath: new Map(defs.map(def => [def.relId.replace('devices.audit.aliases.', ''), def])) };
}

test('all catalog profiles retain existing aliases; new semantics are additive, source-bound and read-only', () => {
  let additions = 0;
  const coveredProfiles = new Set();
  for (const template of templates) {
    const { runtime, defs, byPath } = runtimeFor(template.id);
    const expected = buildSemanticAliasDefinitions({ baseId: runtime.baseId, template });
    for (const def of expected.definitions) {
      const path = def.relId.replace('devices.audit.aliases.', '');
      const actual = byPath.get(`v1.${path}`);
      assert.ok(actual, `${template.id}: ${path}`);
      assert.equal(actual.rw, 'ro');
      assert.equal(actual.unit, 'W');
      assert.equal(actual.writeDpId, undefined);
      assert.equal(actual.preferCommandValue, undefined);
      assert.equal(byPath.has(path), false, `new canonical alias must not add/replace legacy: ${template.id}/${path}`);
      assert.equal(actual.fromDevice(null), null);
      assert.equal(actual.fromDevice('1'), null);
      assert.equal(actual.fromDevice(NaN), null);
      assert.equal(actual.fromDevice(Infinity), null);
      additions++;
      coveredProfiles.add(template.id);
    }
    // Every pre-existing canonical path is still built from its exact legacy
    // definition, with the same target, access mode and canonical unit conversion.
    const checked = new Set();
    for (const def of defs.filter(item => !item.relId.includes('.aliases.v1.'))) {
      const normal = cloneStandardDefinition(def, { baseId: runtime.baseId, deviceClass: runtime.aliasDeviceClass, getDpById: id => runtime.dpById.get(id) });
      if (!normal || checked.has(normal.relId)) continue;
      checked.add(normal.relId);
      const actual = defs.find(item => item.relId === normal.relId);
      assert.ok(actual, `${template.id}/${normal.relId}`);
      for (const key of ['dpId', 'writeDpId', 'rw', 'type', 'role', 'unit', 'kind']) assert.equal(actual[key], normal[key], `${template.id}/${key}`);
    }
    const manifest = buildManifest(runtime.aliasContractInfo, template, runtime.cfg);
    assert.deepEqual(manifest.semanticCoverage, expected.coverage);
    assert.deepEqual(runtime.aliasContractInfo.missingRequired, []);
  }
  assert.equal(templates.length, 197);
  assert.equal(additions, 89);
  assert.equal(coveredProfiles.size, 25);
});

test('FENECON keeps battery power separate from ESS converter/DC PV and does not fabricate 706 readback', () => {
  const { byPath } = runtimeFor('ess.fenecon.FeneconHomeEssImpl');
  const expected = {
    'r.essActivePower': 'eSS0_ACTIVE_POWER', 'r.nvpPower': 'gRID_POWER',
    'r.consumptionTotal': 'lOAD_POWER', 'r.minPowerSetpointW': 'mIN_POWER_SETPOINT',
    'r.maxPowerSetpointW': 'mAX_POWER_SETPOINT', 'r.pvPowerDc': 'pV_DC_POWER',
    'r.pvPowerAc': 'pV_AC_POWER', 'r.pvPowerTotal': 'pV_POWER_SUM',
  };
  for (const [path, dpId] of Object.entries(expected)) {
    const def = byPath.get(`v1.${path}`);
    assert.equal(def.dpId, dpId);
    assert.equal(def.fromDevice(2.5), 2500);
    assert.equal(def.fromDevice(-2.5), -2500);
  }
  assert.equal(byPath.has('v1.r.powerSetpointReadbackW'), false);
  assert.equal(byPath.get('v1.ctrl.powerSetpointW').writeDpId, 'sET_ACTIVE_POWER');
  assert.equal(byPath.get('v1.ctrl.gridSetpointW').writeDpId, 'sET_GRID_ACTIVE_POWER');
});

test('both SolaX profiles share W units and signed limits, with genuine readable target and no invented grid target', () => {
  for (const [id, scale] of [['ess.solax.Ems1000ModbusTcp', 1000], ['ess.solax.SolaXHybridX1X3Ess', 1]]) {
    const { byPath } = runtimeFor(id);
    assert.equal(byPath.get('v1.r.minPowerSetpointW').fromDevice(2), -2 * scale);
    assert.equal(byPath.get('v1.r.maxPowerSetpointW').fromDevice(3), 3 * scale);
    assert.equal(byPath.get('v1.r.minPowerSetpointW').fromDevice(-2), null);
    assert.equal(byPath.get('v1.r.maxPowerSetpointW').fromDevice(-2), null);
    assert.equal(byPath.get('v1.r.powerSetpointReadbackW').fromDevice(-4), -4 * scale);
    assert.equal(byPath.get('v1.r.powerSetpointReadbackW').dpId, 'sET_ACTIVE_POWER');
    assert.equal(byPath.has('v1.ctrl.gridSetpointW'), false);
    assert.equal(byPath.has('v1.r.nvpPower'), false, 'unverified grid sign must not become an automatic NVP source');
    assert.equal(byPath.has('v1.r.pvPowerAc'), false);
    assert.equal(byPath.has('v1.r.pvPowerDc'), false);
  }
});

test('readback is actual polling data and cannot acknowledge queued or failed commands', async () => {
  const { runtime } = runtimeFor('ess.solax.Ems1000ModbusTcp');
  const writes = new Map();
  runtime._setStateCached = async (id, value) => writes.set(id, value);
  runtime._lastCommandedValueByDpId.set('sET_ACTIVE_POWER', 9);
  const id = 'devices.audit.aliases.v1.r.powerSetpointReadbackW';
  await runtime._ackWrittenValue(runtime.dpById.get('sET_ACTIVE_POWER'), 9);
  assert.equal(writes.has(id), false, 'write acknowledgement must not synthesize a device readback');
  await runtime._updateAliases({ sET_ACTIVE_POWER: 2 }, { connected: true });
  assert.equal(writes.get(id), 2000);
  writes.clear();
  await runtime._ackWrittenValue(runtime.dpById.get('sET_ACTIVE_POWER'), 8);
  assert.equal(writes.has(id), false);
  await runtime._updateAliases({ sOC: 50 }, { connected: true });
  assert.equal(writes.has(id), false);
});

test('VARTA sign conversion and DEYE MPPT aggregation remain canonical without new control capability', () => {
  const varta = runtimeFor('ess.varta.pulseNeo.modbusTcpV14').byPath;
  assert.equal(varta.get('v1.r.essActivePower').fromDevice(1400), -1400);
  assert.equal(varta.get('v1.r.nvpPower').fromDevice(-900), 900);
  assert.equal(varta.get('v1.r.pvPowerAc').dpId, 'pV_POWER');
  const deye = runtimeFor('ess.deye.threePhaseHv.modbusRtu').byPath;
  assert.equal(deye.get('v1.r.pvPowerDc').dpId, 'canonical.pvPower');
  assert.equal(deye.has('v1.ctrl.powerSetpointW'), false);
  assert.equal(deye.has('v1.r.powerSetpointReadbackW'), false);
});

test('unknown, write-only, missing, remapped and differently scaled sources remain unavailable', () => {
  const original = templates.find(item => item.id === 'ess.solax.SolaXHybridX1X3Ess');
  for (const mutate of [
    t => { t.id = 'custom.storage'; },
    t => { t.datapoints = t.datapoints.filter(dp => dp.id !== 'sET_ACTIVE_POWER'); },
    t => { t.datapoints.find(dp => dp.id === 'sET_ACTIVE_POWER').rw = 'wo'; },
    t => { t.datapoints.find(dp => dp.id === 'sET_ACTIVE_POWER').unit = 'kW'; },
    t => { t.datapoints.find(dp => dp.id === 'sET_ACTIVE_POWER').source.read.address = 999; },
    t => { delete t.datapoints.find(dp => dp.id === 'sET_ACTIVE_POWER').source.read; },
  ]) {
    const template = structuredClone(original);
    mutate(template);
    const result = buildSemanticAliasDefinitions({ baseId: 'devices.custom', template });
    assert.equal(result.coverage['r.powerSetpointReadbackW'].status, 'unavailable');
    assert.equal(result.definitions.some(def => def.relId.endsWith('.powerSetpointReadbackW')), false);
  }
  for (const [id, profile] of Object.entries(policy.profiles)) {
    for (const binding of Object.values(profile)) assert.ok(binding.source, `${id}/${binding.dpId}`);
  }
  const fox = runtimeFor('ess.foxess.FoxESSH3Ess').byPath;
  assert.equal(fox.has('v1.r.minPowerSetpointW'), false, 'assumed FoxESS direction is not a verified signed bound');
  assert.equal(fox.has('v1.r.maxPowerSetpointW'), false);
});
