'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const source = name => require('tsx/cjs/api').require(path.resolve(__dirname, '../ui/src-ts/runtime-executables/lib/' + name + '.ts'), __filename);
const { validatePostgresProfile, postgresPoolConfig, buildPostgresHistoryQuery, buildPostgresWrite, PostgresHistoryClient, postgresError } = source('postgres-history');
const { prepareHistoryChange } = source('postgres-history-config');
const { InfluxHistoryRuntime } = source('influx-history-runtime');
const profile = { schemaVersion: 1, provider: 'postgresql', host: '127.0.0.1', port: 55432, database: 'eos_history_3', user: 'eos_history_3_runtime', password: 'synthetic-fixture-secret-not-for-production-123', caFile: '/etc/nexowatt-eos/postgresql/ca.crt', servername: 'localhost', schema: 'eos_history', provisioned: true, newInstallation: true };
const connection = { profile, caCertificate: 'synthetic-not-a-certificate' };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate, attempts = 100) { for (let i = 0; i < attempts && !predicate(); i++) await pause(10); assert.ok(predicate()); }
function mockClient(t, overrides = {}) {
    const calls = [], releases = [];
    const pool = new EventEmitter(); pool.end = async () => {};
    pool.connect = async () => ({ release: discard => releases.push(discard), query: async (sql, values) => { calls.push({ sql, values }); return { rows: [] }; }, ...overrides });
    const client = new PostgresHistoryClient('eos-admin.3', async () => connection, () => pool);
    t.after(() => client.close()); return { client, pool, calls, releases };
}

test('fixed protected per-instance profile rejects remote endpoints, wrong role and unprovisioned values', () => {
    assert.equal(validatePostgresProfile(profile, 'eos-admin.3').user, profile.user);
    for (const patch of [{ host: 'example.com' }, { port: 5432 }, { user: 'postgres' }, { database: 'eos_history_4' }, { newInstallation: false }, { provisioned: false }, { servername: '127.0.0.1' }, { caFile: '/tmp/untrusted.crt' }, { password: 'short' }]) assert.throws(() => validatePostgresProfile({ ...profile, ...patch }, 'eos-admin.3'), /EOS_POSTGRES_PROFILE_INVALID/);
    assert.throws(() => validatePostgresProfile(profile, 'nexowatt-ui.3'), /PROFILE_INVALID/);
    const pool = postgresPoolConfig(connection);
    assert.equal(pool.host, '127.0.0.1'); assert.equal(pool.ssl.rejectUnauthorized, true); assert.equal(pool.ssl.servername, 'localhost');
    assert.equal(pool.ssl.minVersion, 'TLSv1.2'); assert.equal(pool.max, 4); assert.equal(pool.statement_timeout, 4000);
    assert.equal(pool.connectionString, undefined);
});

test('explicit PG first selection retains unrelated mappings and prevents existing provider migration', () => {
    const incoming = { provider: 'postgresql', postgresql: { profile: 'local' }, newInstallation: true };
    assert.throws(() => prepareHistoryChange({ provider: 'influxdb2' }, incoming, false), /EXISTING_HISTORY/);
    assert.throws(() => prepareHistoryChange({}, { ...incoming, newInstallation: false }, true), /NEW_INSTALLATION_REQUIRED/);
    for (const attack of [{ ...incoming, instance: 'sql.0' }, { ...incoming, postgresql: { profile: 'local', password: 'secret' } }, { ...incoming, postgresql: { profile: '../../x' } }]) assert.throws(() => prepareHistoryChange({}, attack, true), /PROFILE_INVALID/);
    const next = prepareHistoryChange({ datapoints: { pv: 'kept' }, exportIntervalMs: 9000 }, incoming, true);
    assert.deepEqual(next.datapoints, { pv: 'kept' }); assert.equal(next.exportIntervalMs, 9000); assert.equal(next.newInstallation, undefined);
    assert.deepEqual(prepareHistoryChange(next, { provider: 'postgresql', postgresql: { profile: 'local' } }, false), next);
    const oldInflux = { provider: 'adapter', instance: 'influxdb.0', datapoints: { pv: 'kept' } };
    assert.deepEqual(prepareHistoryChange(oldInflux, { provider: 'adapter' }, false), oldInflux);
});

test('query SQL binds hostile IDs and applies range/rows/aggregation bounds without gap filling', () => {
    const id = "power'; DROP TABLE samples;--";
    const query = buildPostgresHistoryQuery(id, { start: 1000, end: 3000, aggregate: 'average', step: 1000 });
    assert.equal(query.values[0], id); assert.ok(!query.text.includes(id)); assert.match(query.text, /avg\(value_number\)/); assert.doesNotMatch(query.text, /generate_series|COALESCE\(value_number/i);
    assert.match(buildPostgresHistoryQuery('power', { start: 1000, end: 3000, aggregate: 'minmax', count: 4 }).text, /ROW_NUMBER/);
    for (const options of [{ start: 0, end: 0 }, { start: 0, end: 4000e8 }, { start: 0, end: 1, limit: 60001 }, { start: 0, end: 1000, aggregate: 'average', step: 0 }, { start: 0, end: 10, aggregate: 'unsupported' }]) assert.throws(() => buildPostgresHistoryQuery('power', options), /EOS_POSTGRES/);
});

test('writes preserve zeros, negatives, booleans and text; duplicate millisecond is last-value-wins', () => {
    const id = 'eos-admin.3.historie.power', ts = Date.now() - 5000;
    const write = buildPostgresWrite([{ id, ts, val: 2 }, { id, ts, val: 0 }, { id, ts: ts + 1, val: -5 }, { id, ts: ts + 2, val: true }, { id, ts: ts + 3, val: "quote'withtext" }]);
    assert.throws(() => buildPostgresWrite([{ id, ts, val: NaN }, { id, ts, val: 0 }]), /WRITE_INVALID/);
    assert.equal(write.values.length, 24); assert.deepEqual(write.values.slice(0, 6), [id, ts, 0, 0, null, null]);
    assert.ok(!write.text.includes("quote'withtext")); assert.match(write.text, /ON CONFLICT/);
    for (const value of [null, Infinity, NaN, {}, 'x'.repeat(16385)]) assert.throws(() => buildPostgresWrite([{ id, ts, val: value }]), /EOS_POSTGRES/);
});

test('total deadline destroys active connection and suppresses late results', async t => {
    let finish;
    const f = mockClient(t, { query: () => new Promise(resolve => { finish = resolve; }) });
    await assert.rejects(f.client.query('a', { start: 1, end: 2 }, 30), /EOS_POSTGRES_TIMEOUT/);
    assert.deepEqual(f.releases, [true]); finish({ rows: [] }); await pause(0);
    assert.equal(f.releases.length, 1); assert.equal(f.client.lastError, 'EOS_POSTGRES_TIMEOUT');
});

test('slow profile cannot create a connection after its job expires; close cancels outstanding reads', async t => {
    let load; let connects = 0;
    const pool = new EventEmitter(); pool.end = async () => {}; pool.connect = async () => { connects++; return { release() {}, query: async () => ({ rows: [] }) }; };
    const client = new PostgresHistoryClient('eos-admin.3', () => new Promise(resolve => { load = resolve; }), () => pool); t.after(() => client.close());
    await assert.rejects(client.query('a', { start: 1, end: 2 }, 10), /TIMEOUT/); load(connection); await pause(5);
    assert.equal(connects, 0);
    const other = mockClient(t, { query: () => new Promise(() => {}) });
    const pending = other.client.query('a', { start: 1, end: 2 }); await pause(0); other.client.close();
    await assert.rejects(pending, /CLOSED/); assert.deepEqual(other.releases, [true]);
});

test('checked row parser rejects corrupt data and idle errors stay visible without secret text', async t => {
    const f = mockClient(t, { query: async () => ({ rows: [{ ts: '1700000000000', value_type: 0, value_number: -1.2 }] }) });
    assert.deepEqual((await f.client.query('a', { start: 1700000000000, end: 1700000000001 })).result, [{ ts: 1700000000000, val: -1.2 }]);
    f.pool.emit('error', Object.assign(new Error('server password details'), { code: '28P01' }));
    assert.equal(f.client.lastError, 'EOS_POSTGRES_AUTHORIZATION_FAILED');
    const invalid = mockClient(t, { query: async () => ({ rows: [{ ts: '1700000000000', value_type: 0, value_number: Infinity }] }) });
    await assert.rejects(invalid.client.query('a', { start: 1, end: 2 }), /RESPONSE_INVALID/);
    assert.equal(postgresError(new Error('select SECRET')).message, 'EOS_POSTGRES_CONNECTION_FAILED');
});

test('PG writes retry boundedly, keep original sample and report failed losses; EMS capture remains synchronous', async t => {
    let writes = 0; const captured = [];
    const client = { close() {}, query: async () => ({ result: [] }), write: async points => { writes++; captured.push(structuredClone(points)); throw Object.assign(new Error('offline'), { code: 'EOS_POSTGRES_CONNECTION_FAILED' }); } };
    const runtime = new InfluxHistoryRuntime('nexowatt-ui.0', undefined, namespace => { assert.equal(namespace, 'eos-admin.3'); return client; }, 'eos-admin.3');
    t.after(() => runtime.close()); runtime.register('historie.power'); runtime.configure({ provider: 'postgresql' });
    const ts = Date.now() - 500; runtime.commit(runtime.capture('historie.power', { val: 0, ack: true, ts }));
    await until(() => runtime.status().droppedPoints === 1, 450);
    assert.equal(writes, 3); assert.equal(runtime.status().retriedPoints, 2); assert.equal(runtime.status().queueDepth, 0);
    assert.equal(runtime.status().writeError, 'EOS_POSTGRES_CONNECTION_FAILED'); assert.equal(runtime.status().writeVerified, false);
    assert.deepEqual(captured[0], captured[2]); assert.equal(captured[2][0].ts, ts); assert.equal(captured[2][0].id, 'nexowatt-ui.0.historie.power');
});


test('PG read concurrency reserves one of four pool slots for record writes', async t => {
    const releases = []; let writes = 0;
    const runtime = new InfluxHistoryRuntime('eos-admin.3', undefined, () => ({ close() {}, query: () => new Promise(resolve => releases.push(() => resolve({ result: [] }))), write: async () => { writes++; } }));
    t.after(() => runtime.close()); runtime.configure({ provider: 'postgresql' }); runtime.register('historie.power');
    const reads = Array.from({ length: 4 }, () => runtime.query('eos-admin.3.historie.power', { start: 0, end: 1 }));
    assert.equal(releases.length, 3);
    runtime.commit(runtime.capture('historie.power', { val: 1, ack: true })); await until(() => writes === 1);
    releases[0](); await until(() => releases.length === 4); releases.slice(1).forEach(release => release()); await Promise.all(reads);
});


test('disk-full write failure is explicit, does not retry or block later successful recording', async t => {
    let fail = true, writes = 0;
    const transport = { close() {}, query: async () => ({ result: [] }), write: async () => { writes++; if (fail) throw postgresError({ code: '53100', message: 'device details must stay private' }); } };
    const runtime = new InfluxHistoryRuntime('eos-admin.3', undefined, () => transport); t.after(() => runtime.close());
    runtime.configure({ provider: 'postgresql' }); runtime.register('historie.power');
    runtime.commit(runtime.capture('historie.power', { val: 12, ack: true }));
    await until(() => runtime.status().droppedPoints === 1);
    assert.equal(runtime.status().writeError, 'EOS_POSTGRES_DISK_FULL'); assert.equal(writes, 1); assert.equal(runtime.status().queueDepth, 0);
    fail = false; runtime.commit(runtime.capture('historie.power', { val: 13, ack: true })); await until(() => runtime.status().writeVerified);
    assert.equal(runtime.status().writeError, ''); assert.equal(runtime.status().droppedPoints, 1);
});


test('PG startup probe reports unavailable database without waiting for first measurement or blocking configure', async t => {
    const runtime = new InfluxHistoryRuntime('eos-admin.3', undefined, () => ({ close() {}, query: async () => ({ result: [] }), write: async () => {}, check: async () => { await pause(10); throw postgresError({ code: 'ECONNREFUSED' }); } }));
    t.after(() => runtime.close()); assert.equal(runtime.configure({ provider: 'postgresql' }), undefined);
    await until(() => runtime.status().readError === 'EOS_POSTGRES_CONNECTION_FAILED');
    assert.equal(runtime.status().state, 'error'); assert.equal(runtime.status().writeVerified, false);
});
