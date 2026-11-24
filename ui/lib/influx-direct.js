/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/influx-direct.ts
 * Quell-Hash: sha256:f9378b74a08776253a63ccca58ba50b6ec74c88f07ad934caf921f732537bfc8
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/influx-direct.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfluxDirectClient = void 0;
exports.influxFluxString = influxFluxString;
exports.validateInfluxDirectConfig = validateInfluxDirectConfig;
exports.buildInfluxHistoryQuery = buildInfluxHistoryQuery;
exports.parseInfluxCsv = parseInfluxCsv;
exports.influxLineProtocol = influxLineProtocol;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Bindet vorhandene InfluxDB-2-Historien ohne zusätzlichen ioBroker-Adapter an EOS an.
 * Daten und Wirkung: Liest feste Messreihen und schreibt begrenzte Messwertpakete mit geschütztem Token.
 * Bei Änderungen: Datenformate, Zeitgrenzen, Geräteverläufe und TLS-/Netzzielprüfungen gemeinsam nachprüfen.
 */
const node_http_1 = require("node:http");
const node_https_1 = require("node:https");
const node_crypto_1 = require("node:crypto");
const node_perf_hooks_1 = require("node:perf_hooks");
const node_dns_1 = require("node:dns");
const influx_network_policy_1 = require("./influx-network-policy");
const MAX_ROWS = 60000;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_BATCH_BYTES = 512 * 1024;
const MAX_CONCURRENT = 8;
function csvNumber(value, datatype) {
    if (!value || value.length > 128)
        throw failure('EOS_INFLUX_RESPONSE_INVALID');
    let index = 0;
    if (value.at(index) === '-' || value.at(index) === '+')
        index++;
    const digits = () => {
        const start = index;
        while (index < value.length) {
            const char = value.charCodeAt(index);
            if (char < 48 || char > 57)
                break;
            index++;
        }
        return index - start;
    };
    const whole = digits();
    let fractional = 0;
    if (datatype === 'double' && value.at(index) === '.') {
        index++;
        fractional = digits();
    }
    if (!whole && !fractional)
        throw failure('EOS_INFLUX_RESPONSE_INVALID');
    if (datatype === 'double' && (value.at(index) === 'e' || value.at(index) === 'E')) {
        index++;
        if (value.at(index) === '+' || value.at(index) === '-')
            index++;
        if (!digits())
            throw failure('EOS_INFLUX_RESPONSE_INVALID');
    }
    if (index !== value.length)
        throw failure('EOS_INFLUX_RESPONSE_INVALID');
    const result = Number(value);
    if (!Number.isFinite(result) || (datatype !== 'double' && !Number.isSafeInteger(result)) ||
        (datatype === 'unsignedLong' && result < 0))
        throw failure('EOS_INFLUX_RESPONSE_INVALID');
    return result;
}
function csvTimestamp(value) {
    if (value.length < 20 || value.length > 35)
        throw failure('EOS_INFLUX_RESPONSE_INVALID');
    const parts = value.split('T');
    const date = parts.at(0) || '';
    let time = parts.at(1) || '';
    if (parts.length !== 2 || !/^\d{4}-\d{2}-\d{2}$/.test(date))
        throw failure('EOS_INFLUX_RESPONSE_INVALID');
    const zone = time.endsWith('Z') ? 'Z' : time.slice(-6);
    if (zone !== 'Z' && !/^[+-]\d{2}:\d{2}$/.test(zone))
        throw failure('EOS_INFLUX_RESPONSE_INVALID');
    time = time.slice(0, -zone.length);
    const clockParts = time.split('.');
    const clock = clockParts.at(0) || '';
    if (clockParts.length > 2 || !/^\d{2}:\d{2}:\d{2}$/.test(clock) ||
        (clockParts.length === 2 && !/^\d{1,9}$/.test(clockParts.at(1) || '')))
        throw failure('EOS_INFLUX_RESPONSE_INVALID');
    const year = Number(date.slice(0, 4));
    const month = Number(date.slice(5, 7));
    const day = Number(date.slice(8));
    const hour = Number(clock.slice(0, 2));
    const minute = Number(clock.slice(3, 5));
    const second = Number(clock.slice(6));
    if (year < 1970 || month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() ||
        hour > 23 || minute > 59 || second > 59 ||
        (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)))
        throw failure('EOS_INFLUX_RESPONSE_INVALID');
    const ts = Date.parse(value);
    if (!Number.isFinite(ts) || ts < 0 || ts > 9223372036854)
        throw failure('EOS_INFLUX_RESPONSE_INVALID');
    return ts;
}
function failure(code) { return Object.assign(new Error(code), { code }); }
function requestDeadline(timeoutMs) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
        throw failure('EOS_INFLUX_TIMEOUT');
    return node_perf_hooks_1.performance.now() + Math.min(5000, timeoutMs);
}
function required(value, max) {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) {
        throw failure('EOS_INFLUX_CONFIG_INVALID');
    }
    return value.trim();
}
function timestamp(value) {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 9223372036854) {
        throw failure('EOS_INFLUX_QUERY_INVALID');
    }
    return value;
}
/** Flux strings interpolate ${...}; JSON escaping alone is insufficient. */
function influxFluxString(value) {
    return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$\{/g, '\\${') + '"';
}
function validateInfluxDirectConfig(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
        !('url' in input) || !('organization' in input) || !('bucket' in input) || !('token' in input) ||
        !['url', 'organization', 'bucket', 'token'].every(key => Object.hasOwn(input, key))) {
        throw failure('EOS_INFLUX_CONFIG_INVALID');
    }
    const url = (0, influx_network_policy_1.validateInfluxUrl)(input.url);
    const config = { url: url.href, organization: required(input.organization, 256),
        bucket: required(input.bucket, 256), token: required(input.token, 8192) };
    if (!/^[!-~]+$/.test(config.token))
        throw failure('EOS_INFLUX_CONFIG_INVALID');
    if ('caCertificate' in input && input.caCertificate !== undefined && input.caCertificate !== '') {
        if (typeof input.caCertificate !== 'string' || input.caCertificate.length > 65536 || url.protocol !== 'https:') {
            throw failure('EOS_INFLUX_CA_INVALID');
        }
        const certificates = input.caCertificate.match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g);
        if (!certificates?.length || certificates.length > 8 ||
            input.caCertificate.replace(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/g, '').trim()) {
            throw failure('EOS_INFLUX_CA_INVALID');
        }
        try {
            for (const certificate of certificates)
                new node_crypto_1.X509Certificate(certificate);
        }
        catch {
            throw failure('EOS_INFLUX_CA_INVALID');
        }
        config.caCertificate = input.caCertificate;
    }
    return config;
}
function buildInfluxHistoryQuery(bucket, id, options) {
    const measurement = required(id, 512);
    const start = timestamp(options.start);
    const end = timestamp(options.end);
    if (end <= start || end - start > 3660 * 86400000)
        throw failure('EOS_INFLUX_QUERY_INVALID');
    const aggregate = options.aggregate || 'none';
    const aggregates = new Map([['average', 'mean'], ['mean', 'mean'], ['min', 'min'], ['max', 'max'], ['total', 'sum'], ['count', 'count']]);
    const fn = aggregates.get(aggregate);
    if (!fn && aggregate !== 'none' && aggregate !== 'onchange' && aggregate !== 'minmax')
        throw failure('EOS_INFLUX_AGGREGATE_UNSUPPORTED');
    const rawLimit = aggregate === 'minmax' ? Math.min(options.limit ?? MAX_ROWS, options.count ?? MAX_ROWS)
        : options.limit ?? options.count ?? MAX_ROWS;
    if (!Number.isSafeInteger(rawLimit) || rawLimit < (aggregate === 'minmax' ? 2 : 1) || rawLimit > MAX_ROWS ||
        (aggregate === 'minmax' && [options.limit, options.count].some(value => value !== undefined &&
            (!Number.isSafeInteger(value) || value < 2 || value > MAX_ROWS))))
        throw failure('EOS_INFLUX_QUERY_LIMIT');
    let query = `from(bucket: ${influxFluxString(required(bucket, 256))})\n` +
        ` |> range(start: time(v: ${influxFluxString(new Date(start).toISOString())}), stop: time(v: ${influxFluxString(new Date(end).toISOString())}))\n` +
        ` |> filter(fn: (r) => r._measurement == ${influxFluxString(measurement)} and r._field == "value")\n` +
        ' |> group(columns: [])\n';
    if (aggregate === 'minmax') {
        // The existing SmartHome contract accepts numbers and booleans. Flux
        // min/max selectors reject booleans; ordered first/last selectors retain
        // both types and the actual timestamps. Bound output on the server so a
        // normal high-frequency day need not cross the raw response row budget.
        const selectorsPerWindow = rawLimit >= 4 ? 4 : 2;
        const windows = Math.max(1, Math.floor(rawLimit / selectorsPerWindow));
        const step = options.step ?? Math.max(1, Math.ceil((end - start) / windows));
        if (!Number.isSafeInteger(step) || step < 1 || step > 3660 * 86400000 ||
            Math.ceil((end - start) / step) > windows)
            throw failure('EOS_INFLUX_QUERY_LIMIT');
        const base = `nwData = ${query} |> filter(fn: (r) => exists r._value)` +
            ` |> window(every: ${step}ms, offset: ${start % step}ms, createEmpty: false)\n` +
            'nwValues = nwData |> sort(columns: ["_value", "_time"])\n' +
            'nwMin = nwValues |> first()\nnwMax = nwValues |> last()\n';
        const boundaries = selectorsPerWindow === 4
            ? 'nwTimes = nwData |> sort(columns: ["_time"])\nnwFirst = nwTimes |> first()\nnwLast = nwTimes |> last()\n' : '';
        return base + boundaries + `union(tables: [nwMin, nwMax${selectorsPerWindow === 4 ? ', nwFirst, nwLast' : ''}])` +
            ` |> group(columns: []) |> sort(columns: ["_time"], desc: ${options.returnNewestEntries === true ? 'true' : 'false'})` +
            ` |> unique(column: "_time") |> limit(n: ${rawLimit}) |> keep(columns: ["_time", "_value"])`;
    }
    if (fn) {
        const step = options.step ?? Math.max(1, Math.ceil((end - start) / rawLimit));
        if (!Number.isSafeInteger(step) || step < 1 || step > 366 * 86400000 || Math.ceil((end - start) / step) > MAX_ROWS) {
            throw failure('EOS_INFLUX_QUERY_LIMIT');
        }
        // Empty windows stay absent. The existing history consumer decides its
        // bounded hold policy; transport must not manufacture zeros or freshness.
        query += ` |> aggregateWindow(every: ${step}ms, fn: ${fn}, createEmpty: false, timeSrc: "_start")\n`;
    }
    query += ` |> sort(columns: ["_time"], desc: ${options.returnNewestEntries === true ? 'true' : 'false'})\n` +
        ` |> limit(n: ${rawLimit})\n |> keep(columns: ["_time", "_value"])`;
    return query;
}
/** Bounded RFC4180 rows, including quoted commas/newlines and repeated Flux tables. */
function parseInfluxCsv(text, maxRows = MAX_ROWS) {
    if (!Number.isSafeInteger(maxRows) || maxRows < 1 || maxRows > MAX_ROWS)
        throw failure('EOS_INFLUX_RESPONSE_LIMIT');
    if (Buffer.byteLength(text) > MAX_BYTES)
        throw failure('EOS_INFLUX_RESPONSE_LIMIT');
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    let afterQuote = false;
    const finishField = () => { row.push(field); field = ''; afterQuote = false; if (row.length > 64)
        throw failure('EOS_INFLUX_RESPONSE_LIMIT'); };
    const finishRow = () => { finishField(); rows.push(row); row = []; if (rows.length > maxRows + 2048)
        throw failure('EOS_INFLUX_RESPONSE_LIMIT'); };
    for (let index = 0; index < text.length; index++) {
        const char = text.at(index);
        if (quoted) {
            if (char === '"') {
                if (text.at(index + 1) === '"') {
                    field += '"';
                    index++;
                }
                else {
                    quoted = false;
                    afterQuote = true;
                }
            }
            else
                field += char;
        }
        else if (char === '"' && field === '' && !afterQuote)
            quoted = true;
        else if (char === ',')
            finishField();
        else if (char === '\n')
            finishRow();
        else if (char === '\r' && text.at(index + 1) === '\n') {
            finishRow();
            index++;
        }
        else {
            if (afterQuote || char === '"')
                throw failure('EOS_INFLUX_RESPONSE_INVALID');
            field += char;
        }
    }
    if (quoted)
        throw failure('EOS_INFLUX_RESPONSE_INVALID');
    if (field || row.length || afterQuote)
        finishRow();
    let header = null;
    let datatypes = [];
    const result = [];
    for (const fields of rows) {
        if (fields.every(value => value === ''))
            continue;
        const first = fields.at(0) || '';
        if (first === '#datatype') {
            datatypes = fields;
            continue;
        }
        if (first.startsWith('#'))
            continue;
        if ((fields.length === 2 && fields.at(0) === 'error' && fields.at(1) === 'reference') ||
            (fields.length === 3 && fields.at(0) === '' && fields.at(1) === 'error' && fields.at(2) === 'reference')) {
            throw failure('EOS_INFLUX_QUERY_FAILED');
        }
        if (fields.includes('_time') && fields.includes('_value')) {
            if (new Set(fields).size !== fields.length || fields.length !== datatypes.length)
                throw failure('EOS_INFLUX_RESPONSE_INVALID');
            header = new Map(fields.map((name, index) => [name, index]));
            continue;
        }
        if (!header)
            throw failure('EOS_INFLUX_RESPONSE_INVALID');
        const timeIndex = header.get('_time');
        const valueIndex = header.get('_value');
        if (timeIndex === undefined || valueIndex === undefined)
            throw failure('EOS_INFLUX_RESPONSE_INVALID');
        const timeText = fields.at(timeIndex);
        const valueText = fields.at(valueIndex);
        const datatype = datatypes.at(valueIndex);
        const timeType = datatypes.at(timeIndex);
        if (!datatype || !['double', 'long', 'unsignedLong', 'boolean', 'string'].includes(datatype) ||
            (timeType !== 'dateTime:RFC3339' && timeType !== 'dateTime:RFC3339Nano') || fields.length !== header.size) {
            throw failure('EOS_INFLUX_RESPONSE_INVALID');
        }
        // Empty strings are valid values; absent numeric samples remain gaps.
        if (!timeText || valueText === undefined || (valueText === '' && datatype !== 'string'))
            continue;
        const ts = csvTimestamp(timeText);
        let val;
        if (datatype === 'string')
            val = valueText;
        else if (datatype === 'boolean') {
            if (valueText !== 'true' && valueText !== 'false')
                throw failure('EOS_INFLUX_RESPONSE_INVALID');
            val = valueText === 'true';
        }
        else {
            val = csvNumber(valueText, datatype);
        }
        result.push({ ts, val });
        if (result.length > maxRows)
            throw failure('EOS_INFLUX_RESPONSE_LIMIT');
    }
    return result.sort((left, right) => left.ts - right.ts);
}
function influxLineProtocol(points) {
    if (!Array.isArray(points) || points.length < 1 || points.length > 1000)
        throw failure('EOS_INFLUX_WRITE_LIMIT');
    const lines = points.map((point) => {
        if (!point || typeof point !== 'object')
            throw failure('EOS_INFLUX_VALUE_INVALID');
        const name = required(point.id, 512);
        if (name.startsWith('#'))
            throw failure('EOS_INFLUX_VALUE_INVALID');
        const id = name.replace(/\\/g, '\\\\').replace(/([ ,])/g, '\\$1');
        const ts = timestamp(point.ts);
        let value;
        if (typeof point.val === 'number' && Number.isFinite(point.val))
            value = String(point.val);
        else if (typeof point.val === 'boolean')
            value = String(point.val);
        else if (typeof point.val === 'string' && point.val.length <= 65536 && !/[\r\n\u0000]/u.test(point.val)) {
            value = '"' + point.val.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
        }
        else
            throw failure('EOS_INFLUX_VALUE_INVALID');
        return `${id} value=${value} ${ts}`;
    });
    const body = lines.join('\n');
    if (Buffer.byteLength(body) > MAX_BATCH_BYTES)
        throw failure('EOS_INFLUX_WRITE_LIMIT');
    return body;
}
class InfluxDirectClient {
    constructor(config) {
        this.pending = new Set();
        this.closed = false;
        this.config = validateInfluxDirectConfig(config);
    }
    async request(method, endpoint, params, body = '', contentType = 'application/json', deadlineMs = node_perf_hooks_1.performance.now() + 5000) {
        if (this.closed)
            throw failure('EOS_INFLUX_CANCELLED');
        const remainingMs = Math.min(5000, deadlineMs - node_perf_hooks_1.performance.now());
        if (!Number.isFinite(remainingMs) || remainingMs <= 0)
            throw failure('EOS_INFLUX_TIMEOUT');
        if (this.pending.size >= MAX_CONCURRENT)
            throw failure('EOS_INFLUX_BUSY');
        const url = new URL(endpoint, this.config.url);
        for (const [name, value] of Object.entries(params))
            url.searchParams.set(name, value);
        return new Promise((resolve, reject) => {
            let settled = false;
            const finish = (error, result = '') => {
                if (settled)
                    return;
                settled = true;
                if (deadline)
                    clearTimeout(deadline);
                this.pending.delete(request);
                if (error)
                    reject(error);
                else
                    resolve(result);
            };
            const lookup = (hostname, options, callback) => {
                // The exact validated DNS answers are returned to this socket;
                // there is no second resolution between validation and connect.
                (0, node_dns_1.lookup)(hostname, { ...options, all: true }, (error, addresses) => {
                    if (settled || this.closed) {
                        callback(failure('EOS_INFLUX_CANCELLED'), '', 0);
                        return;
                    }
                    if (error) {
                        callback(failure('EOS_INFLUX_CONNECTION_FAILED'), '', 0);
                        return;
                    }
                    try {
                        if (!addresses.length || addresses.length > 32)
                            throw failure('EOS_INFLUX_ADDRESS_FORBIDDEN');
                        for (const entry of addresses)
                            (0, influx_network_policy_1.assertInfluxAddressAllowed)(entry.address, url.protocol === 'https:' ? 'https:' : 'http:');
                        if (options.all)
                            callback(null, addresses);
                        else {
                            const first = addresses.at(0);
                            if (!first)
                                throw failure('EOS_INFLUX_ADDRESS_FORBIDDEN');
                            callback(null, first.address, first.family);
                        }
                    }
                    catch (caught) {
                        const code = caught instanceof Error && caught.message === 'EOS_INFLUX_HTTP_REQUIRES_LOCAL_ADDRESS'
                            ? caught.message : 'EOS_INFLUX_ADDRESS_FORBIDDEN';
                        callback(failure(code), '', 0);
                    }
                });
            };
            const request = (url.protocol === 'https:' ? node_https_1.request : node_http_1.request)(url, {
                method, agent: false, rejectUnauthorized: true, minVersion: 'TLSv1.2', lookup,
                ...(this.config.caCertificate ? { ca: this.config.caCertificate } : {}),
                headers: { Authorization: `Token ${this.config.token}`, Accept: endpoint === 'api/v2/query' ? 'application/csv' : 'application/json',
                    'Content-Type': contentType, ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}) },
            }, response => {
                const status = response.statusCode || 0;
                const expectedStatus = endpoint === 'api/v2/write' ? 204 : 200;
                if (status !== expectedStatus) {
                    response.resume();
                    const code = status === 401 || status === 403 ? 'EOS_INFLUX_AUTHORIZATION_FAILED'
                        : status >= 300 && status < 400 ? 'EOS_INFLUX_REDIRECT_REJECTED'
                            : status === 404 ? 'EOS_INFLUX_NOT_FOUND'
                                : status === 429 ? 'EOS_INFLUX_RATE_LIMITED' : 'EOS_INFLUX_REQUEST_FAILED';
                    finish(failure(code));
                    request.destroy();
                    return;
                }
                const chunks = [];
                let bytes = 0;
                response.on('data', (chunk) => {
                    bytes += chunk.length;
                    if (bytes > MAX_BYTES) {
                        finish(failure('EOS_INFLUX_RESPONSE_LIMIT'));
                        request.destroy();
                        return;
                    }
                    chunks.push(chunk);
                });
                response.on('end', () => finish(null, Buffer.concat(chunks).toString('utf8')));
                response.on('error', () => finish(failure('EOS_INFLUX_RESPONSE_INVALID')));
            });
            this.pending.add(request);
            request.on('error', error => {
                const code = 'code' in error ? String(error.code) : '';
                const networkPolicyFailure = ['EOS_INFLUX_ADDRESS_FORBIDDEN', 'EOS_INFLUX_HTTP_REQUIRES_LOCAL_ADDRESS', 'EOS_INFLUX_CANCELLED'].includes(code);
                finish(failure(this.closed ? 'EOS_INFLUX_CANCELLED' : networkPolicyFailure ? code
                    : /CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY/.test(code) ? 'EOS_INFLUX_TLS_FAILED' : 'EOS_INFLUX_CONNECTION_FAILED'));
            });
            const deadline = setTimeout(() => { finish(failure('EOS_INFLUX_TIMEOUT')); request.destroy(); }, remainingMs);
            deadline.unref?.();
            request.end(body || undefined);
        }).catch((error) => {
            if (error instanceof Error && /^EOS_INFLUX_[A-Z_]+$/.test(error.message))
                throw error;
            throw failure('EOS_INFLUX_CONNECTION_FAILED');
        });
    }
    async check() {
        const deadline = node_perf_hooks_1.performance.now() + 5000;
        const healthText = await this.request('GET', 'health', {}, '', 'application/json', deadline);
        let health;
        try {
            health = JSON.parse(healthText);
        }
        catch {
            throw failure('EOS_INFLUX_RESPONSE_INVALID');
        }
        if (!health || typeof health !== 'object' || !Object.hasOwn(health, 'status') || !('status' in health) || health.status !== 'pass') {
            throw failure('EOS_INFLUX_NOT_READY');
        }
        // A healthy port is insufficient: validate the actual org/bucket/token
        // read path even when the selected bucket currently contains no samples.
        // Limit after grouping, not once per series. Drop heterogeneous values
        // before grouping so busy buckets with mixed field types remain valid.
        const query = `from(bucket: ${influxFluxString(this.config.bucket)}) |> range(start: -1s)` +
            ' |> keep(columns: ["_time"]) |> group(columns: []) |> limit(n: 1)' +
            ' |> map(fn: (r) => ({_time: r._time, _value: 1.0}))';
        parseInfluxCsv(await this.request('POST', 'api/v2/query', { org: this.config.organization }, JSON.stringify({ query, type: 'flux', dialect: { annotations: ['datatype'], header: true, delimiter: ',' } }), 'application/json', deadline), 1);
        if (node_perf_hooks_1.performance.now() >= deadline)
            throw failure('EOS_INFLUX_TIMEOUT');
        return { reachable: true, readable: true, writeVerified: false };
    }
    async query(id, options, timeoutMs = 5000) {
        const deadline = requestDeadline(timeoutMs);
        const query = buildInfluxHistoryQuery(this.config.bucket, id, options);
        const csv = await this.request('POST', 'api/v2/query', { org: this.config.organization }, JSON.stringify({ query, type: 'flux', dialect: { annotations: ['datatype'], header: true, delimiter: ',' } }), 'application/json', deadline);
        const aggregate = options.aggregate || 'none';
        const count = aggregate === 'minmax' ? Math.min(options.limit ?? MAX_ROWS, options.count ?? MAX_ROWS)
            : options.limit ?? options.count ?? MAX_ROWS;
        const result = parseInfluxCsv(csv, count);
        const aggregated = aggregate !== 'none' && aggregate !== 'onchange' && aggregate !== 'minmax';
        const step = options.step ?? Math.max(1, Math.ceil((options.end - options.start) / (options.limit ?? options.count ?? MAX_ROWS)));
        // Flux labels an aggregate with its window start. The first partial
        // window can start just before the selected range; raw rows cannot.
        const earliest = aggregated ? Math.max(0, options.start - step + 1) : options.start;
        if (result.some(point => point.ts < earliest || point.ts >= options.end ||
            (aggregate === 'minmax' && typeof point.val === 'string')))
            throw failure('EOS_INFLUX_RESPONSE_INVALID');
        if (node_perf_hooks_1.performance.now() >= deadline)
            throw failure('EOS_INFLUX_TIMEOUT');
        return { result };
    }
    async write(points, timeoutMs = 5000) {
        const deadline = requestDeadline(timeoutMs);
        await this.request('POST', 'api/v2/write', { org: this.config.organization, bucket: this.config.bucket, precision: 'ms' }, influxLineProtocol(points), 'text/plain; charset=utf-8', deadline);
    }
    close() { this.closed = true; for (const request of this.pending)
        request.destroy(); }
}
exports.InfluxDirectClient = InfluxDirectClient;
