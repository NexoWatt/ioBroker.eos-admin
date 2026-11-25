/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/postgres-history.ts
 * Quell-Hash: sha256:738e0c932792572737e4f4d9a172ad7aa547275a03a8ef90ec602e2a59662b38
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/postgres-history.js.
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
exports.PostgresHistoryClient = void 0;
exports.readProtectedPostgresFile = readProtectedPostgresFile;
exports.validatePostgresProfile = validatePostgresProfile;
exports.loadPostgresProfile = loadPostgresProfile;
exports.postgresPoolConfig = postgresPoolConfig;
exports.postgresError = postgresError;
exports.buildPostgresHistoryQuery = buildPostgresHistoryQuery;
exports.buildPostgresWrite = buildPostgresWrite;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Geschützte lokale PostgreSQL-Historie ohne Rechte zur Schema-/Systemänderung.
 * Daten und Wirkung: Liest ausschließlich das feste Systemprofil, prüft TLS mit CA/Hostname,
 * begrenzt Datenmengen und beendet Verbindungen bei Ablauf der Gesamtdeadline.
 * Zusammenhang: Gemeinsame Historienwarteschlange und bestehende Diagramm-/Export-APIs.
 */
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const node_path_1 = require("node:path");
const node_crypto_1 = require("node:crypto");
const node_tls_1 = require("node:tls");
const node_perf_hooks_1 = require("node:perf_hooks");
const pg_1 = require("pg");
const ROOT = '/etc/nexowatt-eos/postgresql';
const MAX_ROWS = 60000;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_RANGE = 3660 * 86400000;
const fail = (code) => Object.assign(new Error(code), { code });
const record = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
function identifier(value) {
    if (typeof value !== 'string' || !value || value.length > 512 || value.trim() !== value || /[\u0000-\u001f\u007f*]/u.test(value))
        throw fail('EOS_POSTGRES_QUERY_INVALID');
    return value;
}
function instance(namespace) {
    const match = /^eos-admin\.(\d{1,6})$/.exec(namespace);
    const index = match?.[1];
    if (!index)
        throw fail('EOS_POSTGRES_PROFILE_INVALID');
    return index;
}
/** Files are provisioned by the system installer, never by the adapter. */
async function readProtectedPostgresFile(path, maximum, secret) {
    if (!path.startsWith(`${ROOT}/`) || (0, node_path_1.dirname)(path) !== ROOT)
        throw fail('EOS_POSTGRES_PROFILE_INVALID');
    for (const directory of ['/etc', '/etc/nexowatt-eos', ROOT]) {
        const stat = await (0, promises_1.lstat)(directory);
        if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== 0 || (stat.mode & 0o022))
            throw fail('EOS_POSTGRES_PROFILE_PERMISSIONS');
    }
    const file = await (0, promises_1.open)(path, node_fs_1.constants.O_RDONLY | node_fs_1.constants.O_NOFOLLOW);
    try {
        const stat = await file.stat();
        if (!stat.isFile() || stat.uid !== 0 || (stat.mode & (secret ? 0o027 : 0o022)) || stat.size < 1 || stat.size > maximum)
            throw fail('EOS_POSTGRES_PROFILE_PERMISSIONS');
        const value = await file.readFile('utf8');
        if (Buffer.byteLength(value) > maximum)
            throw fail('EOS_POSTGRES_PROFILE_INVALID');
        return value;
    }
    finally {
        await file.close();
    }
}
function validatePostgresProfile(value, namespace) {
    const index = instance(namespace);
    if (!record(value) || value.schemaVersion !== 1 || value.provider !== 'postgresql' ||
        value.host !== '127.0.0.1' || value.port !== 55432 || value.servername !== 'localhost' ||
        value.schema !== 'eos_history' || value.database !== `eos_history_${index}` ||
        value.user !== `eos_history_${index}_runtime` || value.caFile !== `${ROOT}/ca.crt` ||
        value.provisioned !== true || value.newInstallation !== true || typeof value.password !== 'string' ||
        value.password.length < 32 || value.password.length > 1024 || /[\u0000-\u0020\u007f]/u.test(value.password))
        throw fail('EOS_POSTGRES_PROFILE_INVALID');
    return { schemaVersion: 1, provider: 'postgresql', host: '127.0.0.1', port: 55432,
        database: value.database, user: value.user, password: value.password, caFile: value.caFile,
        servername: 'localhost', schema: 'eos_history', provisioned: true, newInstallation: true };
}
async function loadPostgresProfile(namespace) {
    instance(namespace);
    try {
        const input = JSON.parse(await readProtectedPostgresFile(`${ROOT}/client-${namespace}.json`, 8192, true));
        const profile = validatePostgresProfile(input, namespace);
        const caCertificate = await readProtectedPostgresFile(profile.caFile, 65536, false);
        const certificate = new node_crypto_1.X509Certificate(caCertificate);
        if (!certificate.ca || Date.parse(certificate.validTo) <= Date.now() || Date.parse(certificate.validFrom) > Date.now())
            throw fail('EOS_POSTGRES_CA_INVALID');
        return { profile, caCertificate };
    }
    catch (error) {
        const code = record(error) ? error.code : '';
        if (code === 'ENOENT')
            throw fail('EOS_POSTGRES_SETUP_REQUIRED');
        if (code === 'EACCES' || code === 'EPERM' || code === 'ELOOP')
            throw fail('EOS_POSTGRES_PROFILE_PERMISSIONS');
        if (typeof code === 'string' && code.startsWith('EOS_POSTGRES_'))
            throw error;
        throw fail('EOS_POSTGRES_PROFILE_INVALID');
    }
}
function postgresPoolConfig(connection) {
    const c = connection.profile;
    return { host: c.host, port: c.port, database: c.database, user: c.user, password: c.password,
        application_name: 'nexowatt-eos-history', max: 4, connectionTimeoutMillis: 1500,
        idleTimeoutMillis: 10000, maxLifetimeSeconds: 300, allowExitOnIdle: true,
        statement_timeout: 4000, query_timeout: 4500, idle_in_transaction_session_timeout: 4000,
        ssl: { ca: connection.caCertificate, rejectUnauthorized: true, minVersion: 'TLSv1.2', servername: c.servername,
            checkServerIdentity: (_hostname, cert) => (0, node_tls_1.checkServerIdentity)(c.servername, cert) },
    };
}
/** Stable error codes only: PostgreSQL messages can contain SQL, IDs or server details. */
function postgresError(error) {
    const code = record(error) ? error.code : '';
    if (typeof code === 'string' && /^EOS_POSTGRES_[A-Z_]{1,64}$/.test(code))
        return fail(code);
    if (['CERT_HAS_EXPIRED', 'ERR_TLS_CERT_ALTNAME_INVALID', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_NOT_YET_VALID'].includes(String(code)))
        return fail('EOS_POSTGRES_TLS_FAILED');
    if (code === '28P01' || code === '28000' || code === '42501')
        return fail('EOS_POSTGRES_AUTHORIZATION_FAILED');
    if (code === '42P01' || code === '3D000' || code === '3F000')
        return fail('EOS_POSTGRES_SCHEMA_MISSING');
    if (code === '57014' || code === 'ETIMEDOUT')
        return fail('EOS_POSTGRES_TIMEOUT');
    if (code === '53100')
        return fail('EOS_POSTGRES_DISK_FULL');
    if (code === '53200' || code === '53400')
        return fail('EOS_POSTGRES_RESOURCE_LIMIT');
    if (code === '53300')
        return fail('EOS_POSTGRES_BUSY');
    if (typeof code === 'string' && /^(?:22|23|42)[A-Z0-9]{3}$/.test(code))
        return fail('EOS_POSTGRES_QUERY_FAILED');
    return fail('EOS_POSTGRES_CONNECTION_FAILED');
}
function buildPostgresHistoryQuery(id, options) {
    identifier(id);
    const { start, end } = options;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end - start > MAX_RANGE || end > 9223372036854)
        throw fail('EOS_POSTGRES_QUERY_INVALID');
    const aggregate = options.aggregate || 'none';
    const functions = new Map([['average', 'avg'], ['mean', 'avg'], ['min', 'min'], ['max', 'max'], ['total', 'sum'], ['count', 'count']]);
    const fn = functions.get(aggregate);
    if (!fn && !['none', 'onchange', 'minmax'].includes(aggregate))
        throw fail('EOS_POSTGRES_AGGREGATE_UNSUPPORTED');
    const limit = aggregate === 'minmax' ? Math.min(options.limit ?? MAX_ROWS, options.count ?? MAX_ROWS) : options.limit ?? options.count ?? MAX_ROWS;
    if (!Number.isSafeInteger(limit) || limit < (aggregate === 'minmax' ? 2 : 1) || limit > MAX_ROWS ||
        aggregate === 'minmax' && [options.limit, options.count].some(value => value !== undefined && (!Number.isSafeInteger(value) || value < 2 || value > MAX_ROWS)))
        throw fail('EOS_POSTGRES_QUERY_LIMIT');
    const order = options.returnNewestEntries === true ? 'DESC' : 'ASC';
    const values = [id, start, end, limit];
    let select = 'SELECT ts,value_type,value_number,value_boolean,value_text FROM eos_history.samples WHERE id=$1 AND ts >= $2 AND ts < $3';
    if (fn || aggregate === 'minmax') {
        const selectors = aggregate === 'minmax' ? (limit >= 4 ? 4 : 2) : 1;
        const windows = Math.max(1, Math.floor(limit / selectors));
        const step = options.step ?? Math.max(1, Math.ceil((end - start) / windows));
        if (!Number.isSafeInteger(step) || step < 1 || step > (aggregate === 'minmax' ? MAX_RANGE : 366 * 86400000) || Math.ceil((end - start) / step) > (aggregate === 'minmax' ? windows : MAX_ROWS))
            throw fail('EOS_POSTGRES_QUERY_LIMIT');
        values.push(step);
        if (aggregate === 'minmax') {
            // Select actual extremum and boundary timestamps; never create zero-filled gaps.
            select = `WITH ranked AS (SELECT *, ((ts-$2)/$5)::bigint AS slot, ROW_NUMBER() OVER(PARTITION BY ((ts-$2)/$5)::bigint ORDER BY value_number ASC NULLS LAST,value_boolean ASC NULLS LAST,value_text ASC NULLS LAST,ts ASC) AS lo, ROW_NUMBER() OVER(PARTITION BY ((ts-$2)/$5)::bigint ORDER BY value_number DESC NULLS LAST,value_boolean DESC NULLS LAST,value_text DESC NULLS LAST,ts DESC) AS hi, ROW_NUMBER() OVER(PARTITION BY ((ts-$2)/$5)::bigint ORDER BY ts ASC) AS first, ROW_NUMBER() OVER(PARTITION BY ((ts-$2)/$5)::bigint ORDER BY ts DESC) AS last FROM eos_history.samples WHERE id=$1 AND ts >= $2 AND ts < $3) SELECT ts,value_type,value_number,value_boolean,value_text FROM ranked WHERE lo=1 OR hi=1${selectors === 4 ? ' OR first=1 OR last=1' : ''}`;
        }
        else {
            select = `SELECT (FLOOR(ts::numeric/$5)*$5)::bigint AS ts,0::smallint AS value_type,${fn === 'count' ? 'COUNT(*)::double precision' : `${fn}(value_number)`} AS value_number,NULL::boolean AS value_boolean,NULL::text AS value_text FROM eos_history.samples WHERE id=$1 AND ts >= $2 AND ts < $3${fn === 'count' ? '' : ' AND value_type=0'} GROUP BY FLOOR(ts::numeric/$5)`;
        }
    }
    // Both row and byte bounds are applied by SQL before the driver buffers results.
    return { text: `WITH picked AS (${select} ORDER BY ts ${order} LIMIT $4), sized AS (SELECT *,SUM(96+COALESCE(octet_length(value_text),0)) OVER(ORDER BY ts ${order}) AS bytes FROM picked) SELECT ts,value_type,value_number,value_boolean,value_text,bytes FROM sized WHERE bytes-(96+COALESCE(octet_length(value_text),0)) <= ${MAX_BYTES} ORDER BY ts ${order}`, values };
}
function buildPostgresWrite(points) {
    if (!Array.isArray(points) || !points.length || points.length > 100 || Buffer.byteLength(JSON.stringify(points)) > 256 * 1024)
        throw fail('EOS_POSTGRES_WRITE_INVALID');
    const values = [];
    // Validate every sample, then collapse same-millisecond writes to the last value.
    const unique = new Map();
    for (const point of points) {
        identifier(point.id);
        if (!Number.isSafeInteger(point.ts) || point.ts < 0 || point.ts > Date.now() + 1000 ||
            (typeof point.val === 'number' && !Number.isFinite(point.val)) ||
            (typeof point.val === 'string' && (point.val.length > 16384 || /[\u0000\r\n]/u.test(point.val))) ||
            !['number', 'boolean', 'string'].includes(typeof point.val))
            throw fail('EOS_POSTGRES_WRITE_INVALID');
        unique.set(JSON.stringify([point.id, point.ts]), point);
    }
    const rows = [...unique.values()].map(point => {
        const offset = values.length;
        values.push(point.id, point.ts, typeof point.val === 'number' ? 0 : typeof point.val === 'boolean' ? 1 : 2, typeof point.val === 'number' ? point.val : null, typeof point.val === 'boolean' ? point.val : null, typeof point.val === 'string' ? point.val : null);
        return `(${Array.from({ length: 6 }, (_, i) => `$${offset + i + 1}`).join(',')})`;
    });
    return { text: `INSERT INTO eos_history.samples(id,ts,value_type,value_number,value_boolean,value_text) VALUES ${rows.join(',')} ON CONFLICT(id,ts) DO UPDATE SET value_type=EXCLUDED.value_type,value_number=EXCLUDED.value_number,value_boolean=EXCLUDED.value_boolean,value_text=EXCLUDED.value_text`, values };
}
function parseRows(rows, options) {
    if (rows.length > MAX_ROWS)
        throw fail('EOS_POSTGRES_RESPONSE_LIMIT');
    let total = 0;
    const aggregate = options.aggregate || 'none';
    const aggregated = !['none', 'onchange', 'minmax'].includes(aggregate);
    const step = options.step ?? Math.max(1, Math.ceil((options.end - options.start) / (options.limit ?? options.count ?? MAX_ROWS)));
    const earliest = aggregated ? Math.max(0, options.start - step + 1) : options.start;
    return rows.map(row => {
        if (!record(row))
            throw fail('EOS_POSTGRES_RESPONSE_INVALID');
        const ts = typeof row.ts === 'string' && /^\d{1,16}$/.test(row.ts) ? Number(row.ts) : row.ts;
        const val = row.value_type === 0 ? row.value_number : row.value_type === 1 ? row.value_boolean : row.value_type === 2 ? row.value_text : undefined;
        if (typeof ts !== 'number' || !Number.isSafeInteger(ts) || ts < earliest || ts >= options.end ||
            typeof val !== (row.value_type === 0 ? 'number' : row.value_type === 1 ? 'boolean' : row.value_type === 2 ? 'string' : 'invalid') ||
            aggregate === 'minmax' && typeof val === 'string' ||
            !['number', 'boolean', 'string'].includes(typeof val) || typeof val === 'number' && !Number.isFinite(val) ||
            typeof val === 'string' && (val.length > 16384 || /[\u0000]/u.test(val)))
            throw fail('EOS_POSTGRES_RESPONSE_INVALID');
        total += 96 + (typeof val === 'string' ? Buffer.byteLength(val) : 0);
        if (total > MAX_BYTES)
            throw fail('EOS_POSTGRES_RESPONSE_LIMIT');
        return { ts, val: val };
    });
}
class PostgresHistoryClient {
    constructor(namespace, loader = loadPostgresProfile, poolFactory = config => new pg_1.Pool(config)) {
        this.namespace = namespace;
        this.loader = loader;
        this.poolFactory = poolFactory;
        this.pool = null;
        this.initialization = null;
        this.closed = false;
        this.active = new Set();
        this.operations = 0;
        this.cancellers = new Set();
        this.provisioned = false;
        this.lastError = '';
        instance(namespace);
    }
    async initialize() {
        if (this.closed)
            throw fail('EOS_POSTGRES_CLOSED');
        if (this.pool)
            return this.pool;
        if (!this.initialization) {
            this.initialization = this.loader(this.namespace).then(connection => {
                if (this.closed)
                    throw fail('EOS_POSTGRES_CLOSED');
                const pool = this.poolFactory(postgresPoolConfig(connection));
                pool.on('error', error => { this.lastError = postgresError(error).code; });
                this.pool = pool;
                this.provisioned = true;
                return pool;
            }).finally(() => { this.initialization = null; });
        }
        return this.initialization;
    }
    run(query, timeoutMs) {
        if (this.closed)
            return Promise.reject(fail('EOS_POSTGRES_CLOSED'));
        if (this.operations >= 8)
            return Promise.reject(fail('EOS_POSTGRES_BUSY'));
        if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
            return Promise.reject(fail('EOS_POSTGRES_TIMEOUT'));
        this.operations++;
        const deadline = node_perf_hooks_1.performance.now() + Math.min(timeoutMs, 5000);
        return new Promise((resolve, reject) => {
            let finished = false;
            let client = null;
            const finish = (error, rows) => {
                if (finished)
                    return;
                finished = true;
                clearTimeout(timer);
                this.cancellers.delete(cancel);
                this.operations--;
                if (client) {
                    this.active.delete(client);
                    client.release(error ? true : undefined);
                    client = null;
                }
                if (error) {
                    const mapped = postgresError(error);
                    this.lastError = mapped.code;
                    reject(mapped);
                }
                else {
                    this.lastError = '';
                    resolve(rows || []);
                }
            };
            const cancel = () => finish(fail('EOS_POSTGRES_CLOSED'));
            const timer = setTimeout(() => finish(fail('EOS_POSTGRES_TIMEOUT')), Math.max(1, deadline - node_perf_hooks_1.performance.now()));
            this.cancellers.add(cancel);
            void this.initialize().then(pool => { if (finished || this.closed)
                throw fail('EOS_POSTGRES_CLOSED'); return pool.connect(); }).then(acquired => {
                if (finished || this.closed) {
                    acquired.release(true);
                    return;
                }
                client = acquired;
                this.active.add(acquired);
                return acquired.query(query.text, query.values).then(result => finish(null, result.rows));
            }).catch(error => finish(error));
        });
    }
    async query(id, options, timeoutMs = 5000) {
        const deadline = node_perf_hooks_1.performance.now() + Math.min(timeoutMs, 5000);
        const result = parseRows(await this.run(buildPostgresHistoryQuery(id, options), timeoutMs), options);
        if (node_perf_hooks_1.performance.now() >= deadline)
            throw fail('EOS_POSTGRES_TIMEOUT');
        return { result };
    }
    async write(points, timeoutMs = 5000) { await this.run(buildPostgresWrite(points), timeoutMs); }
    async check() {
        await this.run({ text: 'SELECT id,ts FROM eos_history.samples LIMIT 0', values: [] }, 5000);
        return { reachable: true, readable: true };
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        for (const cancel of [...this.cancellers])
            cancel();
        const pool = this.pool;
        this.pool = null;
        if (pool)
            void pool.end().catch(() => { });
    }
}
exports.PostgresHistoryClient = PostgresHistoryClient;
