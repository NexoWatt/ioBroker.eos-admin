'use strict';

const crypto = require('node:crypto');

const RESERVED_CONFIGURATION_KEYS = new Set([
  'refresh',
  'lastRefresh',
  'status',
  'error',
  'count',
  'reportInProgress',
  'requestId',
  'lastSequence',
  'lastChangedKey',
  'lastChangedAt',
  'lastChangeStatus',
  'lastChangeResponse',
  'rebootRequired',
  'unknownKeysJson',
  'indexJson',
]);

function sanitizeConfigurationSegment(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    || 'x';
}

function shortHash(value, length = 8) {
  return crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, Math.max(4, length));
}

function cloneOcppReference(reference) {
  if (!reference || typeof reference !== 'object') return undefined;
  try {
    return JSON.parse(JSON.stringify(reference));
  } catch (error) {
    return undefined;
  }
}

function canonicalConfigurationKey16(key) {
  return `ocpp1.6|${String(key ?? '')}`;
}

function canonicalDeviceModelKey(component, variable, attributeType = 'Actual') {
  const c = component || {};
  const v = variable || {};
  return JSON.stringify({
    component: {
      name: c.name || '',
      instance: c.instance || '',
      evseId: c.evse && c.evse.id !== undefined ? Number(c.evse.id) : undefined,
      connectorId: c.evse && c.evse.connectorId !== undefined ? Number(c.evse.connectorId) : undefined,
    },
    variable: {
      name: v.name || '',
      instance: v.instance || '',
    },
    attributeType: attributeType || 'Actual',
  });
}

function configurationStateKey16(key) {
  const canonical = canonicalConfigurationKey16(key);
  let safe = sanitizeConfigurationSegment(key);
  const wasChanged = safe !== String(key ?? '').trim();
  if (RESERVED_CONFIGURATION_KEYS.has(safe) || wasChanged || safe.length > 150) {
    safe = `${safe.slice(0, 135)}_${shortHash(canonical, 8)}`;
  }
  return safe;
}

function configurationStateKey2(component, variable, attributeType = 'Actual') {
  const c = component || {};
  const v = variable || {};
  const parts = [sanitizeConfigurationSegment(c.name)];
  if (c.instance) parts.push(sanitizeConfigurationSegment(c.instance));
  if (c.evse && c.evse.id !== undefined) parts.push(`EVSE${Math.max(0, Number(c.evse.id) || 0)}`);
  if (c.evse && c.evse.connectorId !== undefined) parts.push(`Connector${Math.max(0, Number(c.evse.connectorId) || 0)}`);
  parts.push(sanitizeConfigurationSegment(v.name));
  if (v.instance) parts.push(sanitizeConfigurationSegment(v.instance));
  parts.push(sanitizeConfigurationSegment(attributeType || 'Actual'));

  const canonical = canonicalDeviceModelKey(component, variable, attributeType);
  const suffix = shortHash(canonical, 8);
  const base = parts.filter(Boolean).join('_') || 'DeviceModel';
  const maxBaseLength = 150 - suffix.length - 1;
  return `${base.slice(0, Math.max(1, maxBaseLength))}_${suffix}`;
}

function inferOcpp16Value(value) {
  const raw = value === undefined || value === null ? '' : String(value);
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'true' || lower === 'false') {
    return { type: 'boolean', val: lower === 'true', dataType: 'boolean' };
  }
  if (/^-?(?:0|[1-9]\d*)$/.test(trimmed)) {
    const parsed = Number(trimmed);
    if (Number.isSafeInteger(parsed)) return { type: 'number', val: parsed, dataType: 'integer' };
  }
  if (/^-?(?:0|[1-9]\d*)\.\d+$/.test(trimmed)) {
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return { type: 'number', val: parsed, dataType: 'decimal' };
  }
  return { type: 'string', val: raw, dataType: 'string' };
}


function configurationSensitive(meta) {
  if (!meta || typeof meta !== 'object') return false;
  const names = [
    meta.key,
    meta.component && meta.component.name,
    meta.component && meta.component.instance,
    meta.variable && meta.variable.name,
    meta.variable && meta.variable.instance,
  ].filter((value) => value !== undefined && value !== null && String(value).trim());
  const exact = new Set([
    'authorizationkey', 'basicauthpassword', 'password', 'passphrase', 'clientsecret',
    'privatekey', 'secretkey', 'apikey', 'accesskey', 'accesstoken', 'refreshtoken',
    'credential', 'credentials',
  ]);
  const sensitiveSuffixes = [
    'password', 'passphrase', 'authorizationkey', 'clientsecret', 'privatekey',
    'secretkey', 'apikey', 'accesskey', 'accesstoken', 'refreshtoken', 'credential', 'credentials',
  ];
  return names.some((name) => {
    const normalized = String(name).replace(/[^A-Za-z0-9]/g, '').toLowerCase();
    return exact.has(normalized) || sensitiveSuffixes.some((suffix) => normalized.endsWith(suffix));
  });
}

/**
 * Return a deep-cloned Device Model report with values of known credential
 * variables removed. ConfigurationInventory may contain authentication keys
 * and passwords. Even when raw diagnostic capture is explicitly enabled,
 * those values must never be persisted in ioBroker states or logs.
 *
 * @param {object} params OCPP NotifyReport payload
 * @param {string} replacement value used in the diagnostic copy
 * @returns {object}
 */
function redactConfigurationReport(params, replacement = '[redacted]') {
  const cloned = cloneOcppReference(params) || {};
  const reportData = Array.isArray(cloned.reportData) ? cloned.reportData : [];
  for (const reportItem of reportData) {
    if (!reportItem || typeof reportItem !== 'object') continue;
    const meta = {
      kind: 'deviceModel',
      component: reportItem.component,
      variable: reportItem.variable,
    };
    if (!configurationSensitive(meta)) continue;
    const attributes = Array.isArray(reportItem.variableAttribute) ? reportItem.variableAttribute : [];
    for (const attribute of attributes) {
      if (!attribute || typeof attribute !== 'object') continue;
      if (Object.prototype.hasOwnProperty.call(attribute, 'value')) attribute.value = replacement;
    }
  }
  return cloned;
}

function configurationRefreshDiagnostic(protocol, response) {
  if (protocol === 'ocpp1.6') {
    return {
      status: 'Accepted',
      configurationKeyCount: Array.isArray(response && response.configurationKey) ? response.configurationKey.length : 0,
      unknownKeyCount: Array.isArray(response && response.unknownKey) ? response.unknownKey.length : 0,
    };
  }
  return cloneOcppReference(response) || {};
}

function stateRoleForConfiguration(type, value) {
  if (type === 'number') return 'value';
  if (type === 'boolean') return 'switch';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) return 'value.time';
  return 'text';
}

function parseValuesList(valuesList) {
  if (typeof valuesList !== 'string') return undefined;
  const entries = valuesList.split(',').map((entry) => entry.trim()).filter(Boolean);
  if (entries.length < 1 || entries.length > 100) return undefined;
  const result = {};
  for (const entry of entries) result[entry] = entry;
  return result;
}

function formatConfigurationValue(value, dataType) {
  const normalizedType = String(dataType || 'string').toLowerCase();
  if (normalizedType === 'boolean') {
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'true' || normalized === '1') return 'true';
    if (normalized === 'false' || normalized === '0') return 'false';
    throw new Error('Value is not a valid boolean');
  }
  if (normalizedType === 'integer') {
    const number = Number(value);
    if (!Number.isFinite(number) || !Number.isInteger(number)) throw new Error('Value is not a valid integer');
    return String(number);
  }
  if (normalizedType === 'decimal') {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new Error('Value is not a valid decimal number');
    return String(number);
  }
  return value === undefined || value === null ? '' : String(value);
}

function validateConfigurationValue(meta, valueString) {
  if (!meta) return;
  const dataType = String(meta.dataType || 'string').toLowerCase();
  const numericValue = Number(valueString);
  if ((dataType === 'integer' || dataType === 'decimal') && Number.isFinite(numericValue)) {
    if (Number.isFinite(Number(meta.minLimit)) && numericValue < Number(meta.minLimit)) {
      throw new Error(`Value is below the minimum ${meta.minLimit}`);
    }
    if (Number.isFinite(Number(meta.maxLimit)) && numericValue > Number(meta.maxLimit)) {
      throw new Error(`Value is above the maximum ${meta.maxLimit}`);
    }
  }

  const allowed = parseValuesList(meta.valuesList);
  if (allowed && dataType === 'optionlist' && !Object.prototype.hasOwnProperty.call(allowed, valueString)) {
    throw new Error('Value is not part of the supported values list');
  }
  if (allowed && (dataType === 'memberlist' || dataType === 'sequencelist')) {
    const members = String(valueString).split(',').map((entry) => entry.trim()).filter(Boolean);
    if (members.some((entry) => !Object.prototype.hasOwnProperty.call(allowed, entry))) {
      throw new Error('Value contains an unsupported list member');
    }
  }

  if (['string', 'optionlist', 'memberlist', 'sequencelist'].includes(dataType)
    && Number.isFinite(Number(meta.maxLimit))
    && String(valueString).length > Number(meta.maxLimit)) {
    throw new Error(`Value exceeds the maximum length ${meta.maxLimit}`);
  }
}

function configurationWritable(meta, writesEnabled = true) {
  if (!writesEnabled || !meta) return false;
  // Values that disappeared from a later complete configuration inventory
  // stay visible for diagnostics but must never remain writable. Firmware
  // updates and protocol changes can invalidate an older mapping.
  if (meta.stale === true || meta.inventoryPending === true) return false;
  if (meta.kind === 'ocpp16') return meta.readonly === false;
  if (meta.kind !== 'deviceModel' || meta.constant === true) return false;
  const mutability = String(meta.mutability || '').toLowerCase();
  return mutability === 'readwrite' || mutability === 'writeonly';
}

function buildConfigurationRefreshCall(protocol, requestId) {
  if (protocol === 'ocpp1.6') return { method: 'GetConfiguration', payload: {} };
  if (protocol === 'ocpp2.0.1' || protocol === 'ocpp2.1') {
    const id = Math.max(1, Math.min(0x7fffffff, Math.trunc(Number(requestId) || 1)));
    return { method: 'GetBaseReport', payload: { requestId: id, reportBase: 'ConfigurationInventory' } };
  }
  throw new Error(`Configuration refresh is not supported for protocol ${protocol || 'unknown'}`);
}

function buildConfigurationWriteCall(protocol, meta, value) {
  if (!meta) throw new Error('Missing OCPP configuration metadata');
  const valueString = formatConfigurationValue(value, meta.dataType);
  validateConfigurationValue(meta, valueString);
  if (protocol === 'ocpp1.6') {
    if (meta.kind !== 'ocpp16') throw new Error('The configuration datapoint does not belong to OCPP 1.6');
    if (!meta.key) throw new Error('Missing OCPP 1.6 configuration key');
    const key = String(meta.key);
    if (key.length > 50) throw new Error('OCPP 1.6 configuration key exceeds 50 characters');
    if (valueString.length > 500) throw new Error('OCPP 1.6 configuration value exceeds 500 characters');
    return {
      method: 'ChangeConfiguration',
      payload: { key, value: valueString },
      valueString,
    };
  }
  if (protocol === 'ocpp2.0.1' || protocol === 'ocpp2.1') {
    if (meta.kind !== 'deviceModel') throw new Error(`The configuration datapoint does not belong to ${protocol}`);
    if (!meta.component || !meta.variable) throw new Error('Missing Device Model component or variable');
    const protocolMaxLength = protocol === 'ocpp2.0.1' ? 1000 : 2500;
    if (valueString.length > protocolMaxLength) {
      throw new Error(`${protocol} configuration value exceeds ${protocolMaxLength} characters`);
    }
    const item = {
      attributeValue: valueString,
      component: cloneOcppReference(meta.component),
      variable: cloneOcppReference(meta.variable),
    };
    if (meta.attributeType) item.attributeType = String(meta.attributeType);
    return {
      method: 'SetVariables',
      payload: { setVariableData: [item] },
      valueString,
    };
  }
  throw new Error(`Configuration write is not supported for protocol ${protocol || 'unknown'}`);
}

function interpretConfigurationRefreshResponse(protocol, response) {
  if (protocol === 'ocpp1.6') {
    if (!response || typeof response !== 'object') throw new Error('GetConfiguration returned no response object');
    return { accepted: true, reportExpected: false, empty: false, status: 'Accepted' };
  }
  const status = String(response && response.status || 'Unknown');
  const normalized = status.toLowerCase();
  return {
    accepted: normalized === 'accepted' || normalized === 'emptyresultset',
    reportExpected: normalized === 'accepted',
    empty: normalized === 'emptyresultset',
    status,
  };
}

function interpretConfigurationWriteResponse(protocol, response) {
  let status = 'Unknown';
  let detail;
  if (protocol === 'ocpp1.6') {
    status = String(response && response.status || 'Unknown');
    detail = response;
  } else {
    const results = Array.isArray(response && response.setVariableResult) ? response.setVariableResult : [];
    detail = results[0];
    status = String(detail && detail.attributeStatus || 'Unknown');
  }
  const normalized = status.toLowerCase();
  return {
    accepted: normalized === 'accepted' || normalized === 'rebootrequired',
    rebootRequired: normalized === 'rebootrequired',
    status,
    detail,
  };
}

module.exports = {
  RESERVED_CONFIGURATION_KEYS,
  sanitizeConfigurationSegment,
  shortHash,
  cloneOcppReference,
  canonicalConfigurationKey16,
  canonicalDeviceModelKey,
  configurationStateKey16,
  configurationStateKey2,
  inferOcpp16Value,
  configurationSensitive,
  redactConfigurationReport,
  configurationRefreshDiagnostic,
  stateRoleForConfiguration,
  parseValuesList,
  formatConfigurationValue,
  validateConfigurationValue,
  configurationWritable,
  buildConfigurationRefreshCall,
  buildConfigurationWriteCall,
  interpretConfigurationRefreshResponse,
  interpretConfigurationWriteResponse,
};
