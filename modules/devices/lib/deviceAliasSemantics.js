// @ts-check
'use strict';

/** @typedef {{dpId:string, type:string, rw:string, source:Record<string, unknown>, value:number}} ReadContext */
/** @typedef {{dpId:string, type:string, unit:string, rw:string, source:Record<string, unknown>, transform:string, requiredReadContext?:ReadContext}} Binding */
/** @typedef {{id?:string, type?:string, unit?:string, rw?:string, source?:Record<string, unknown>}} Datapoint */
/** @typedef {{id?:string, category?:string, datapoints?:Datapoint[]}} Template */
/** @typedef {{status:'available'|'unavailable', reason:string, dpId?:string}} Coverage */
/** @typedef {{relId:string, name:string, role:string, type:string, unit:string, rw:string, kind:string, dpId:string, fromDevice:(value:unknown)=>number|null, semanticSource:string, deviceReadOnly:true, requiredReadContext?:ReadContext}} SemanticDefinition */

/** @type {{schemaVersion:number, aliases:Record<string,string>, profiles:Record<string,Record<string,Binding>>}} */
const policy = require('./device-alias-semantics-v1.json');
const STORAGE_CATEGORIES = new Set(['ESS', 'BATTERY', 'BATTERY_INVERTER']);

/** Deterministic structural comparison; a custom profile cannot inherit a builtin binding by ID alone.
 * @param {unknown} actual @param {unknown} expected @returns {boolean}
 */
function sameDescriptor(actual, expected) {
  if (actual === expected) return true;
  if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object') return false;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return Array.isArray(actual) && Array.isArray(expected) && actual.length === expected.length &&
      actual.every((value, index) => sameDescriptor(value, expected[index]));
  }
  const left = /** @type {Record<string, unknown>} */ (actual);
  const right = /** @type {Record<string, unknown>} */ (expected);
  const keys = Object.keys(right);
  return Object.keys(left).length === keys.length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(left, key) && sameDescriptor(left[key], right[key]));
}

/** Only an actual read descriptor establishes a Modbus target readback.
 * @param {Record<string, unknown>} source @returns {boolean}
 */
function hasDeviceRead(source) {
  if (source.kind !== 'modbus') return false;
  const candidate = source.read;
  const read = candidate && typeof candidate === 'object' && !Array.isArray(candidate)
    ? /** @type {Record<string, unknown>} */ (candidate) : source;
  return (read.fc === 3 || read.fc === 4) && Number.isInteger(read.address) && Number(read.address) >= 0;
}

/** @param {Binding} binding @param {Datapoint|undefined} dp @param {string} path @returns {string|null} */
function unavailableReason(binding, dp, path) {
  if (!dp) return 'sourceMissing';
  if (dp.type !== 'number' || dp.rw === 'wo' || (dp.rw !== 'ro' && dp.rw !== 'rw')) return 'sourceNotReadable';
  if (dp.type !== binding.type || dp.unit !== binding.unit || dp.rw !== binding.rw ||
      !sameDescriptor(dp.source, binding.source)) return 'sourceDescriptorChanged';
  if (dp.unit !== 'W' && dp.unit !== 'kW') return 'sourceUnitUnsupported';
  if (path === 'r.powerSetpointReadbackW' && !hasDeviceRead(binding.source)) return 'deviceReadbackUnavailable';
  if (!['identity', 'negate', 'negativeMagnitude', 'positiveMagnitude'].includes(binding.transform)) return 'sourceTransformUnsupported';
  return null;
}

/** Keep invalid telemetry invalid, rather than converting null/string/NaN to a plausible measurement.
 * @param {unknown} value @param {string} transform @returns {number|null}
 */
function transformValue(value, transform) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (transform === 'negativeMagnitude' || transform === 'positiveMagnitude') {
    if (value < 0) return null;
    return transform === 'negativeMagnitude' && value !== 0 ? -value : value;
  }
  return transform === 'negate' && value !== 0 ? -value : value;
}

/** Additional semantics never replace historic aliases or create a write capability.
 * @param {{baseId:string, template?:Template, getDpById?:(id:string)=>Datapoint|undefined}} options
 * @returns {{definitions:SemanticDefinition[], coverage:Record<string,Coverage>}}
 */
function buildSemanticAliasDefinitions(options) {
  const { baseId, template, getDpById } = options;
  /** @type {SemanticDefinition[]} */
  const definitions = [];
  /** @type {Record<string,Coverage>} */
  const coverage = {};
  if (!template || !STORAGE_CATEGORIES.has(String(template.category || '').toUpperCase())) return { definitions, coverage };
  const profile = policy.profiles[String(template.id || '')] || {};
  for (const [path, name] of Object.entries(policy.aliases)) {
    const binding = profile[path];
    if (!binding) {
      coverage[path] = { status: 'unavailable', reason: 'noVerifiedSourceBinding' };
      continue;
    }
    const dp = typeof getDpById === 'function' ? getDpById(binding.dpId)
      : (template.datapoints || []).find(item => item.id === binding.dpId);
    let reason = unavailableReason(binding, dp, path);
    const context = binding.requiredReadContext;
    if (!reason && context) {
      const modeDp = typeof getDpById === 'function' ? getDpById(context.dpId)
        : (template.datapoints || []).find(item => item.id === context.dpId);
      if (!modeDp || modeDp.type !== context.type || modeDp.rw !== context.rw ||
          !Number.isFinite(context.value) || !hasDeviceRead(context.source) ||
          !sameDescriptor(modeDp.source, context.source)) reason = 'readContextDescriptorChanged';
    }
    if (reason) {
      coverage[path] = { status: 'unavailable', reason, dpId: binding.dpId };
      continue;
    }
    definitions.push({
      relId: `${baseId}.aliases.${path}`,
      name,
      role: 'value.power',
      type: 'number',
      unit: binding.unit,
      rw: 'ro',
      kind: 'dp',
      dpId: binding.dpId,
      fromDevice: value => transformValue(value, binding.transform),
      semanticSource: binding.dpId,
      deviceReadOnly: true,
      ...(context ? { requiredReadContext: context } : {}),
    });
    coverage[path] = { status: 'available', reason: 'sourceDescriptorVerified', dpId: binding.dpId };
  }
  return { definitions, coverage };
}

module.exports = { buildSemanticAliasDefinitions, sameDescriptor };
