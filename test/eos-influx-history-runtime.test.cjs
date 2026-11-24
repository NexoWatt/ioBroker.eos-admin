'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { InfluxHistoryRuntime } = require('tsx/cjs/api').require(path.resolve(__dirname, '../ui/src-ts/runtime-executables/lib/influx-history-runtime.ts'), __filename);
const config = { provider: 'influxdb2', influxdb2: { url: 'http://127.0.0.1:8086', organization: 'test', bucket: 'test', token: 'synthetic-test-token' } };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate) { for (let i = 0; i < 100 && !predicate(); i++) await pause(5); assert.ok(predicate()); }
function fixture(t, overrides = {}) {
    const writes = []; const queries = []; let closed = 0;
    const client = { write: async points => { writes.push(structuredClone(points)); }, query: async (...args) => { queries.push(args); return { result: [] }; }, close: () => { closed++; }, ...overrides };
    const runtime = new InfluxHistoryRuntime('eos-admin.0', () => client);
    runtime.register('historie.power'); t.after(() => runtime.close());
    return { runtime, client, writes, queries, closed: () => closed };
}
function record(runtime, val, ts = Date.now(), id = 'historie.power') { runtime.commit(runtime.capture(id, { val, ack: true, ts })); }

test('legacy remains default with retained direct connection; registration is an explicit writer allowlist', t => {
    const f = fixture(t); f.runtime.configure({ influxdb2: config.influxdb2 });
    record(f.runtime, 10); assert.equal(f.runtime.status().provider, 'adapter'); assert.equal(f.writes.length, 0);
    f.runtime.configure(config);
    assert.equal(f.runtime.capture('unregistered', { val: 1, ack: true }), null);
    assert.equal(f.runtime.capture('historie.power', { val: 1, ack: false }), null);
    assert.equal(f.runtime.capture('historie.power', { val: 1, ack: true, q: 1 }), null);
    assert.equal(f.runtime.capture('historie.power', { val: null, ack: true }), null);
});
test('invalid point cannot poison valid batch; zero, negative and original timestamps survive', async t => {
    const f = fixture(t); f.runtime.configure(config); const ts = Date.now() - 12345;
    for (const value of ['bad\nrow', 'bad\rrow', 'bad\0row', Infinity, NaN, null]) assert.equal(f.runtime.capture('historie.power', { val: value, ack: true }), null);
    assert.equal(f.runtime.register('x'.repeat(512)), false);
    record(f.runtime, 0, ts); record(f.runtime, -0.05, ts + 1);
    await until(() => f.writes.length === 1);
    assert.deepEqual(f.writes[0].map(p => [p.ts, p.val]), [[ts, 0], [ts + 1, -0.05]]);
    assert.equal(f.runtime.status().droppedPoints, 0);
});
test('capture/commit fence rejects pre-reconfigure writes and old completions cannot certify the new database', async t => {
    let finish; const pending = new Promise(resolve => { finish = resolve; });
    const f = fixture(t, { write: () => pending }); f.runtime.configure(config);
    const captured = f.runtime.capture('historie.power', { val: 15, ack: true });
    record(f.runtime, 10); await until(() => f.runtime.status().queueDepth === 1);
    await pause(10);
    f.runtime.configure({ ...config, influxdb2: { ...config.influxdb2, bucket: 'new' } });
    f.runtime.commit(captured); finish(); await pause(10);
    assert.equal(f.runtime.status().queueDepth, 0); assert.equal(f.runtime.status().writeVerified, false);
    assert.equal(f.runtime.status().droppedPoints, 1);
});
test('queue includes in-flight points in its 2000-point bound and exposes discarded samples', async t => {
    let finish; const f = fixture(t, { write: () => new Promise(resolve => { finish = resolve; }) }); f.runtime.configure(config);
    for (let i = 0; i < 100; i++) record(f.runtime, i);
    await pause(10);
    for (let i = 100; i < 2100; i++) record(f.runtime, i);
    assert.equal(f.runtime.status().queueDepth, 2000); assert.equal(f.runtime.status().droppedPoints, 100);
    f.runtime.close(); finish(); await pause(0);
    assert.equal(f.runtime.status().droppedPoints, 2100);
});
test('six active reads reserve transport capacity for writes and bounded queued reads retain their budget', async t => {
    const releases = []; const budgets = [];
    const f = fixture(t, { query: (_id, _options, budget) => { budgets.push(budget); return new Promise(resolve => releases.push(() => resolve({ result: [] }))); } });
    f.runtime.configure(config);
    const reads = Array.from({ length: 8 }, () => f.runtime.query('eos-admin.0.historie.power', { start: 1, end: 2 }));
    assert.equal(releases.length, 6); record(f.runtime, 1); await until(() => f.writes.length === 1);
    await pause(20); releases.slice(0, 6).forEach(fn => fn()); await until(() => releases.length === 8);
    assert.ok(budgets[6] < budgets[0]); releases.slice(6).forEach(fn => fn()); await Promise.all(reads);
    assert.equal(f.runtime.status().writeVerified, true); assert.equal(f.runtime.status().droppedPoints, 0);
});
test('read/write failures recover independently and changesOnly can retry a later real sample', async t => {
    let readFails = true; let writeFails = true; let attempts = 0;
    const f = fixture(t, { query: async () => { if (readFails) throw Object.assign(new Error('secret'), { code: 'EOS_INFLUX_AUTHORIZATION_FAILED' }); return { result: [] }; }, write: async () => { attempts++; if (writeFails) throw Object.assign(new Error('secret'), { code: 'EOS_INFLUX_RATE_LIMITED' }); } });
    f.runtime.register('historie.power', true); f.runtime.configure(config);
    await assert.rejects(f.runtime.query('id', { start: 1, end: 2 }), /AUTHORIZATION/);
    record(f.runtime, 5); await until(() => f.runtime.status().droppedPoints === 1);
    assert.equal(attempts, 1, 'no retries amplify a database failure');
    writeFails = false; record(f.runtime, 5); await until(() => f.runtime.status().writeVerified);
    assert.equal(f.runtime.status().readError, 'EOS_INFLUX_AUTHORIZATION_FAILED'); assert.equal(f.runtime.status().writeError, '');
    readFails = false; await f.runtime.query('id', { start: 1, end: 2 }); assert.equal(f.runtime.status().lastError, '');
});
test('normal close drains valid queued writes, fences new captures and reports timeout loss without hanging', async t => {
    const f = fixture(t); f.runtime.configure(config); record(f.runtime, 0);
    const closing = f.runtime.drainAndClose(100);
    assert.equal(f.runtime.capture('historie.power', { val: 1, ack: true }), null);
    await closing; assert.equal(f.writes.length, 1); assert.equal(f.runtime.status().droppedPoints, 0);
    const stalled = fixture(t, { write: () => new Promise(() => {}) }); stalled.runtime.configure(config); record(stalled.runtime, 5);
    const started = Date.now(); await stalled.runtime.drainAndClose(25);
    assert.ok(Date.now() - started < 250); assert.equal(stalled.runtime.status().droppedPoints, 1);
});
test('quarantined credential disables only history and legacy duplicate recording is a warning, not a mutation', t => {
    const f = fixture(t); f.runtime.configure({ ...config, credentialError: 'EOS_INFLUX_TOKEN_DECRYPTION_FAILED' });
    assert.equal(f.runtime.status().state, 'error'); assert.equal(f.runtime.status().lastError, 'EOS_INFLUX_TOKEN_DECRYPTION_FAILED');
    f.runtime.configure(config); f.runtime.legacyRecording('historie.power', true);
    assert.equal(f.runtime.status().legacyRecordingCount, 1);
    assert.deepEqual(f.runtime.status().warnings, ['EOS_INFLUX_LEGACY_RECORDING_ACTIVE']);
    f.runtime.configure({ provider: 'adapter' }); assert.equal(f.runtime.status().legacyRecordingCount, 0);
});
