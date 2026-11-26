'use strict';

// These are different physical units. A hydraulic EMS target or thermal output
// cannot substitute for the WPM's electrical consumption in the energy flow.
const units = {
  'heat.ovum.mira.hsm': 'hsm',
  'heat.ovum.mira.wpm': 'wpm',
};
const hsmBindings = [
  ['r.pvStatus', 'control.pvStatus', 55070, 'int16'],
  ['ctrl.pvStatus', 'control.pvStatus', 55070, 'int16'],
  ['r.pvPowerTargetW', 'control.pvPowerTargetW', 55076, 'int32', 'W'],
  ['ctrl.pvPowerTargetW', 'control.pvPowerTargetW', 55076, 'int32', 'W'],
  ['r.ambientTemp', 'ambient.actualAmbientTemp', 56048, 'float32', '°C'],
  ['r.roomTemp', 'hc.roomTemp', 56152, 'float32', '°C'],
  ['r.bufferTemp', 'buffer.lowerTemperature', 55028, 'float32', '°C'],
];
const wpmBindings = [
  ['r.power', 'measurement.electricalPowerW', 56021, 'float32', 'W'],
  ['r.statusCode', 'status.operatingState', 56025, 'int16'],
  ['r.returnTemp', 'measurement.waterInletTemperature', 56026, 'float32', '°C'],
  ['r.flowTemp', 'measurement.waterOutletTemperature', 56028, 'float32', '°C'],
];
const freshPaths = new Set(['r.power', 'r.pvStatus', 'r.pvPowerTargetW', 'comm.connected', 'alarm.offline']);

function miraUnit(template) {
  const unit = units[template?.id];
  return unit && unit === template.driverHints?.ovumMira?.module ? unit : undefined;
}

function buildMiraAliases(runtime, unit) {
  const definitions = [];
  for (const [path, dpId, address, dataType, unitName] of unit === 'hsm' ? hsmBindings : wpmBindings) {
    const dp = runtime._getDpById(dpId);
    const src = dp?.source;
    const read = src?.read;
    const write = path.startsWith('ctrl.');
    const words = dataType === 'int16' ? 1 : 2;
    if (dp?.type !== 'number' || dp.unit !== unitName || dp.rw === 'wo' || src?.kind !== 'modbus' ||
        read?.fc !== 3 || read.address !== address || read.dataType !== dataType || read.length !== words ||
        read.wordOrder !== 'be' || read.byteOrder !== 'be' || (src.scaleFactor ?? 0) !== (path === 'r.power' ? 3 : 0)) continue;
    const target = src.write;
    if (write && (dp.rw !== 'rw' || target?.address !== address || target.fc !== (words === 1 ? 6 : 16) ||
        target.length !== words || target.dataType !== dataType || target.wordOrder !== 'be' || target.byteOrder !== 'be')) continue;

    const definition = {
      relId: runtime._aliasRelId(path), name: dp.name, type: 'number',
      role: dp.role, rw: write ? 'rw' : 'ro', kind: 'dp', dpId,
    };
    if (unitName) definition.unit = unitName;
    if (write) definition.writeDpId = dpId;
    else {
      definition.deviceReadOnly = true;
      definition.fromDevice = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
    }
    definitions.push(definition);
  }
  return definitions;
}

module.exports = { miraUnit, buildMiraAliases, freshPaths };
