// @ts-check
'use strict';

const ENERGY_CLASSES = new Set(['meter', 'storageSystem', 'battery', 'batteryInverter', 'pvInverter', 'solarCharger']);
const LIVE_PATHS = new Set([
  'comm.connected', 'alarm.offline', 'alarm.fault', 'alarm.warning',
  'r.power', 'r.powerAc', 'r.powerCharge', 'r.powerDischarge', 'r.essActivePower',
  'r.soc', 'r.available', 'r.allowCharge', 'r.allowDischarge',
  'r.gridPower', 'r.nvpPower', 'r.consumptionTotal',
  'r.pvPower', 'r.pvPowerDc', 'r.pvPowerAc', 'r.pvPowerTotal',
  'r.minPowerSetpointW', 'r.maxPowerSetpointW', 'r.powerSetpointReadbackW',
  'r.current', 'r.currentL1', 'r.currentL2', 'r.currentL3',
  'r.voltage', 'r.voltageL1', 'r.voltageL2', 'r.voltageL3',
  'r.powerL1', 'r.powerL2', 'r.powerL3',
]);

/** @param {string} deviceClass @returns {boolean} */
function isEnergyFreshnessClass(deviceClass) { return ENERGY_CLASSES.has(deviceClass); }

/** Commands, counters, metadata and other device classes stay change-only.
 * @param {string} deviceClass @param {string|null|undefined} path @returns {boolean}
 */
function isEnergyFreshnessAlias(deviceClass, path) {
  return ENERGY_CLASSES.has(deviceClass) && typeof path === 'string' && LIVE_PATHS.has(path);
}

/** Computed aliases must prove which real values they used. An unrelated MQTT
 * packet or a cached source must not make an old computed measurement look fresh.
 * @template T
 * @param {Record<string, unknown>} values
 * @param {(values:Record<string, unknown>)=>T} read
 * @returns {{value:T, sourceIds:string[]}}
 */
function captureAliasSources(values, read) {
  const sources = new Set();
  const observed = new Proxy(values, {
    get(target, property, receiver) {
      if (typeof property === 'string' && Object.prototype.hasOwnProperty.call(target, property)) sources.add(property);
      return Reflect.get(target, property, receiver);
    },
  });
  return { value: read(observed), sourceIds: Array.from(sources) };
}

/** @param {{protocol:string, sourceIds:string[], values:Record<string,unknown>, lastWriteMs:number, sampleTimestamp?:number, sourceTimestamps?:Map<string,number>}} input @returns {boolean} */
function hasNewAliasSample(input) {
  if (!input.sourceIds.length || !input.sourceIds.every(id => {
    const value = input.values[id];
    return value !== null && value !== undefined && (typeof value !== 'number' || Number.isFinite(value));
  })) return false;
  if (input.protocol === 'speedwire') {
    return Number.isFinite(input.sampleTimestamp) && Number(input.sampleTimestamp) > input.lastWriteMs;
  }
  if (input.protocol === 'mqtt') {
    return !!input.sourceTimestamps && input.sourceIds.every(id => {
      const stamp = input.sourceTimestamps?.get(id);
      return typeof stamp === 'number' && Number.isFinite(stamp) && stamp > input.lastWriteMs;
    });
  }
  // CAN currently exposes no per-alias sample evidence to this runtime. Do not
  // assert freshness from a transport connection or a cached value there.
  return input.protocol !== 'canbus';
}

module.exports = { isEnergyFreshnessClass, isEnergyFreshnessAlias, captureAliasSources, hasNewAliasSample };
