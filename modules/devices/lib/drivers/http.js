'use strict';

const { BoundedDeviceHttp, safeErrorCode, failure } = require('./boundedHttp');
const { getByJsonPath, applyNumericTransforms, coerceBoolean } = require('../utils');

/**
 * Apply a simple value mapping (e.g. boolean -> "on/off", number codes -> strings).
 * valueMap is an object where keys are original values (stringified) and values are mapped.
 */
function applyValueMap(value, valueMap) {
  if (!valueMap || typeof valueMap !== 'object') return value;
  const k = String(value);
  if (Object.prototype.hasOwnProperty.call(valueMap, k)) return valueMap[k];
  return value;
}

/**
 * Lightweight template renderer.
 * Replaces placeholders like:
 *  - {value} (from ctx.value)
 *  - {meterId} or any {key} (from ctx.connection[key] or ctx[key])
 *
 * If encode === true, the inserted value is URL-encoded.
 * Unknown placeholders are left unchanged.
 */
function renderTemplate(str, ctx, encode) {
  if (str === null || str === undefined) return str;
  const s = String(str);
  const context = ctx || {};
  const connection = context.connection || {};
  return s.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    let v;
    if (key === 'value') v = context.value;
    else if (Object.prototype.hasOwnProperty.call(context, key)) v = context[key];
    else if (Object.prototype.hasOwnProperty.call(connection, key)) v = connection[key];
    else return match;

    if (v === null || v === undefined) return '';
    const out = String(v);
    return encode ? encodeURIComponent(out) : out;
  });
}

class HttpDriver {
  constructor(adapter, deviceCfg, template, globalCfg) {
    this.adapter = adapter;
    this.device = deviceCfg || {};
    this.template = template || {};
    this.global = globalCfg || {};
    this.connection = this.device.connection || {};

    this.transport = new BoundedDeviceHttp(this.connection, () => typeof this.canOperate !== 'function' || this.canOperate());
    this.http = this.transport.client;
  }

  async connect() {
    this.transport.connect();
  }

  async disconnect() {
    this.transport.disconnect();
  }

  _renderUrl(urlTemplate) {
    return renderTemplate(urlTemplate, { connection: this.connection }, true);
  }

  async readDatapoints(datapoints) {
    this.transport.connect();
    const operation = this.transport.begin();
    const out = {};
    const httpDps = (datapoints || []).filter(dp => dp.rw !== 'wo' && dp.source && dp.source.kind === 'http');

    // Group datapoints by request signature to avoid multiple identical requests per poll.
    const groups = new Map(); // key -> { method, url, headers, data, dps: [] }

    for (const dp of httpDps) {
      const src = dp.source || {};
      const method = (src.method || 'GET').toUpperCase();
      const urlT = src.path || '/';
      const url = this._renderUrl(urlT);

      // Optional per-datapoint headers
      const headers = (src.headers && typeof src.headers === 'object') ? src.headers : undefined;

      // Some APIs might require a POST even for reads; support optional bodyTemplate.
      let data = undefined;
      if (method !== 'GET' && method !== 'DELETE') {
        if (src.bodyTemplate) {
          const rendered = renderTemplate(src.bodyTemplate, { connection: this.connection }, false);
          if ((src.bodyType || '').toLowerCase() === 'json') {
            try { data = JSON.parse(rendered); } catch (e) { data = rendered; }
          } else {
            data = rendered;
          }
        }
      }

      const key = `${method} ${url} ${headers ? JSON.stringify(headers) : ''} ${data !== undefined ? JSON.stringify(data) : ''}`;
      if (!groups.has(key)) groups.set(key, { method, url, headers, data, dps: [] });
      groups.get(key).dps.push(dp);
    }

    let successfulRequests = 0;
    let firstRequestError = null;
    for (const g of groups.values()) {
      const { method, url, headers, data, dps } = g;
      let resData;
      try {
        const res = await this.transport.request(this.http, { method, url, headers, data }, operation);
        resData = res.data;
        successfulRequests += 1;
      } catch (e) {
        // A timer may fire just before the monotonic-clock rounding boundary.
        // Once a request was cancelled for the poll deadline, never dispatch another group.
        if (['E_HTTP_DEADLINE', 'E_HTTP_STOPPED', 'EOS_MODULE_DISABLED'].includes(e?.code)) throw e;
        this.transport.assertCurrent(operation);
        if (!firstRequestError) firstRequestError = e;
        // URLs and transport messages may contain credentials/query tokens.
        this.adapter.log.warn(`[${this.device.id}] HTTP read failed (${safeErrorCode(e)}).`);
        continue;
      }

      for (const dp of dps) {
        const src = dp.source || {};
        let val = resData;

        if (src.jsonPath) val = getByJsonPath(resData, src.jsonPath);
        if (val === undefined || val === null) continue;
        const expectedType = String(dp.type || '').toLowerCase();
        if (expectedType === 'number' && typeof val === 'string' && val.trim() !== '' && Number.isFinite(Number(val))) val = Number(val);
        if (expectedType === 'number' && (typeof val !== 'number' || !Number.isFinite(val))) throw failure('E_HTTP_DATAPOINT_TYPE');
        if (expectedType === 'boolean' && !(typeof val === 'boolean' || (typeof val === 'number' && Number.isFinite(val))
          || (typeof val === 'string' && /^(?:0|1|true|false|on|off|yes|no|y|n)$/i.test(val.trim())))) throw failure('E_HTTP_DATAPOINT_TYPE');

        // Numeric transforms (scaleFactor, multiplier, divisor, offset, invert, ...)
        val = applyNumericTransforms(val, src);

        // Optional sign correction: multiply the value by a factor derived from another JSONPath.
        // Example use-case: some devices report a magnitude (always positive) and provide the
        // direction via a separate status code.
        //
        // Template fields:
        //  - signFromJsonPath: JSONPath to the sign/status field
        //  - signMap: { "0": 1, "1": -1, "2": 0 }
        //  - signDefault: default factor when key not found (defaults to 1)
        if (typeof val === 'number' && Number.isFinite(val) && src.signFromJsonPath) {
          try {
            const signVal = getByJsonPath(resData, src.signFromJsonPath);
            const signMap = (src.signMap && typeof src.signMap === 'object') ? src.signMap : null;
            let factor = 1;
            if (signMap) {
              const k = String(signVal);
              if (Object.prototype.hasOwnProperty.call(signMap, k)) {
                const f = Number(signMap[k]);
                if (Number.isFinite(f)) factor = f;
              } else if (src.signDefault !== undefined && src.signDefault !== null) {
                const f = Number(src.signDefault);
                if (Number.isFinite(f)) factor = f;
              }
            } else if (src.signDefault !== undefined && src.signDefault !== null) {
              const f = Number(src.signDefault);
              if (Number.isFinite(f)) factor = f;
            }
            val = val * factor;
          } catch (e) {
            // ignore sign errors
          }
        }

        // Optional boolean coercion
        if ((dp.type || '').toString().toLowerCase() === 'boolean') {
          val = coerceBoolean(val);
        }

        if (val === undefined || val === null || (typeof val === 'number' && !Number.isFinite(val))) throw failure('E_HTTP_DATAPOINT_TYPE');

        // If a datapoint expects a string but JSONPath returned an object/array, store it as JSON string.
        if ((dp.type || '').toString().toLowerCase() === 'string' && val && typeof val === 'object') {
          try { val = JSON.stringify(val); } catch { throw failure('E_HTTP_DATAPOINT_TYPE'); }
        } else if (expectedType === 'string') {
          if (!['string', 'number', 'boolean'].includes(typeof val)) throw failure('E_HTTP_DATAPOINT_TYPE');
          val = String(val);
        }

        out[dp.id] = val;
      }
    }

    // Partial endpoint failures must not suppress successful measurements. When
    // every request failed, propagate the transport error so the runtime cannot
    // acknowledge an empty poll as a healthy device or erase its diagnostic.
    this.transport.assertCurrent(operation);
    if (groups.size > 0 && successfulRequests === 0 && firstRequestError) throw firstRequestError;
    return out;
  }

  async writeDatapoint(dp, value) {
    this.transport.connect();
    const operation = this.transport.begin();
    const src = dp.source || {};
    const method = (src.writeMethod || src.method || 'POST').toUpperCase();

    // Optional value mapping (e.g. boolean -> on/off)
    let mappedValue = applyValueMap(value, src.valueMap);

    // Optional numeric coercion / formatting for device setpoints
    // (useful for APIs that require integer parameters in query strings).
    try {
      const n = (typeof mappedValue === 'string') ? Number(mappedValue) : mappedValue;
      if (typeof n === 'number' && Number.isFinite(n)) {
        let v = n;

        // Apply optional write transforms (multiplier/divisor/offset/invert)
        // NOTE: this uses the same schema fields as read transforms.
        v = applyNumericTransforms(v, src);

        // Round to a fixed number of decimals
        const rd = (src.roundDecimals !== undefined && src.roundDecimals !== null) ? Number(src.roundDecimals) : null;
        if (rd !== null && Number.isFinite(rd) && rd >= 0 && rd <= 10) {
          const p = Math.pow(10, rd);
          v = Math.round(v * p) / p;
        }

        // Force integer
        if (src.castInt || src.int || src.integer) {
          v = Math.round(v);
        }

        mappedValue = v;
      }
    } catch (e) {
      // ignore
    }

    // URL templating: allow placeholders "{value}" and also "{...}" from connection
    const urlTemplate = src.writePath || src.path || '/';
    const url = renderTemplate(urlTemplate, { value: mappedValue, connection: this.connection }, true);

    // Optional per-write headers
    const headers = (src.writeHeaders && typeof src.writeHeaders === 'object')
      ? src.writeHeaders
      : ((src.headers && typeof src.headers === 'object') ? src.headers : undefined);

    // Build body (for non-GET methods)
    let body = undefined;
    if (method !== 'GET' && method !== 'DELETE') {
      if (src.bodyTemplate) {
        body = renderTemplate(src.bodyTemplate, { value: mappedValue, connection: this.connection }, false);
        if ((src.bodyType || '').toLowerCase() === 'json') {
          body = JSON.parse(body);
        }
      } else if (src.bodyType && src.bodyType.toLowerCase() === 'json') {
        body = { value: mappedValue };
      } else if (src.bodyType && src.bodyType.toLowerCase() === 'text') {
        body = String(mappedValue);
      } else {
        body = mappedValue;
      }
    }

    await this.transport.request(this.http, { method, url, data: body, headers }, operation);
  }
}

module.exports = {
  HttpDriver,
  renderTemplate, // exported for potential reuse/tests
};
