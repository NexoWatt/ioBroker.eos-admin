'use strict';
/** Actual authenticated hosted routes + ioBroker persistence boundary + native HTTP transport. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const { createHarness } = require('../ui/test/unified/http-harness.cjs');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const secret = 'synthetic-influx-token-DO-NOT-EXPOSE';
async function until(predicate) { for (let i = 0; i < 100 && !predicate(); i++) await pause(5); assert.ok(predicate()); }
async function fixture(t) {
    const requests = [];
    let queryResponse = () => '';
    const server = http.createServer(async (req, res) => {
        let body = ''; for await (const chunk of req) body += chunk;
        requests.push({ url: req.url, auth: req.headers.authorization, body });
        if (req.url === '/health') return res.end('{"status":"pass"}');
        if (req.url.startsWith('/api/v2/write')) { res.statusCode = 204; return res.end(); }
        return res.end(queryResponse(body));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const h = await createHarness(); const a = h.adapter;
    // ioBroker extends common recursively; the broad HTTP fixture uses a shallow
    // convenience merge which would otherwise erase a pre-existing custom block.
    h.owner.extendObjectAsync = async (id, patch) => {
        const full = id.startsWith('eos-admin.0.') ? id : 'eos-admin.0.' + id;
        const old = h.objects.get(full) || {};
        h.objects.set(full, { ...old, ...patch, common: { ...old.common, ...patch.common } });
    };
    const key = Buffer.alloc(32, 17);
    h.owner.encrypt = value => { const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv('aes-256-gcm', key, iv); const bytes = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64'); };
    h.owner.decrypt = value => { const bytes = Buffer.from(value, 'base64'); const cipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12)); cipher.setAuthTag(bytes.subarray(12, 28)); return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString('utf8'); };
    a.config = structuredClone(require('../ui/io-package.json').native);
    a.config.history = { instance: 'influxdb.4', datapoints: { pvPower: 'manual.existing.pv' }, exportIntervalMs: 600000 };
    a._nwInstallerConfigPatch = { history: structuredClone(a.config.history), storageFarm: { marker: 'customer-preserved', storages: [{ name: 'Existing', powerObjectId: 'manual.power' }] } };
    a._hostedStartup = { state: 'ready' };
    a._nwProtectCredentialState = async () => {};
    a.persistInstallerConfigToState = Object.getPrototypeOf(a).persistInstallerConfigToState.bind(a);
    let initialExports = 0;
    a.updateHistorieExportStates = async reason => { if (reason === 'history-save') initialExports++; };
    t.after(async () => { a._nwDirectHistory.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); await h.close(); });
    const token = await h.login('admin');
    const candidate = { provider: 'influxdb2', influxdb2: { url: `http://127.0.0.1:${server.address().port}`, organization: 'nexowatt', bucket: 'eos', token: secret } };
    const get = () => h.request('/api/installer/history', { token });
    const save = async (history = candidate, revision) => h.request('/api/installer/history', { token, method: 'POST', body: { history, expectedConfigurationRevision: revision ?? (await get()).data.configurationRevision } });
    return { ...h, a, token, requests, candidate, get, save, initialExports: () => initialExports, setQueryResponse: handler => { queryResponse = handler; } };
}

test('history settings enforce session, installer role, CSRF, ownership and optimistic revision before persistence', async t => {
    const h = await fixture(t);
    assert.equal((await h.request('/api/installer/history')).status, 401);
    assert.equal((await h.request('/api/installer/history', { token: await h.login('kunde') })).status, 403);
    assert.equal((await h.request('/api/installer/history', { token: h.token, method: 'POST', csrf: false, body: {} })).status, 403);
    assert.equal((await h.save(h.candidate, 'stale')).status, 409);
    h.bridge.canWrite = () => false;
    assert.equal((await h.save()).status, 503);
    assert.equal(h.states.has('eos-admin.0.installer.configJson'), false);
    assert.equal(h.requests.length, 0);
});

test('save encrypts only the token, preserves customer configuration and blank token, returns no secret', async t => {
    const h = await fixture(t);
    const saved = await h.save(); assert.equal(saved.status, 200, saved.text);
    assert.equal(saved.data.config.influxdb2.hasToken, true); assert.equal(saved.data.status.writeVerified, false);
    assert.ok(!saved.text.includes(secret)); assert.equal(h.initialExports(), 1);
    const raw = h.states.get('eos-admin.0.installer.configJson').val;
    assert.ok(!raw.includes(secret)); const stored = JSON.parse(raw);
    assert.equal(stored.history.influxdb2.tokenEncrypted.v, 1);
    assert.equal(stored.storageFarm.marker, 'customer-preserved');
    assert.equal(stored.history.datapoints.pvPower, 'manual.existing.pv');
    assert.equal(stored.history.instance, 'influxdb.4');
    const again = await h.save({ provider: 'influxdb2', influxdb2: { ...h.candidate.influxdb2, token: '' } });
    assert.equal(again.status, 200, again.text); assert.equal(h.a.config.history.influxdb2.token, secret);
    const moved = await h.save({ provider: 'influxdb2', influxdb2: { ...h.candidate.influxdb2, url: 'http://127.0.0.1:1', token: '' } });
    assert.equal(moved.status, 400); assert.equal(moved.data.error, 'EOS_INFLUX_NEW_DESTINATION_REQUIRES_TOKEN');
    assert.equal(h.a.config.history.influxdb2.token, secret);
});

test('check authenticates real org/bucket without persisting or claiming a write', async t => {
    const h = await fixture(t);
    const check = await h.request('/api/installer/history/check', { token: h.token, method: 'POST', body: { history: h.candidate } });
    assert.equal(check.status, 200, check.text);
    assert.deepEqual(check.data.check, { reachable: true, readable: true, writeVerified: false });
    assert.equal(h.states.has('eos-admin.0.installer.configJson'), false);
    assert.equal(h.a.config.history.provider, undefined);
    assert.equal(h.requests.length, 2); assert.equal(h.requests[1].auth, 'Token ' + secret);
    assert.ok(!check.text.includes(secret));
});

test('direct target registration leaves existing adapter customs untouched and reports possible duplicate writer', async t => {
    const h = await fixture(t);
    h.objects.set('eos-admin.0.historie.core.grid.buyW', { type: 'state', common: { custom: { 'influxdb.4': { enabled: true, changesOnly: true, retention: 730 } } } });
    const result = await h.save(); assert.equal(result.status, 200, result.text);
    assert.deepEqual(h.objects.get('eos-admin.0.historie.core.grid.buyW').common.custom, { 'influxdb.4': { enabled: true, changesOnly: true, retention: 730 } });
    assert.equal(result.data.status.legacyRecordingCount, 1);
    assert.deepEqual(result.data.status.warnings, ['EOS_INFLUX_LEGACY_RECORDING_ACTIVE']);
});

test('actual successful state write is historized once with source timestamp; failed writes and echo are excluded', async t => {
    const h = await fixture(t); assert.equal((await h.save()).status, 200);
    const ts = Date.now() - 5000;
    h.a.setLocalStateWithCache('historie.core.grid.buyW', 0, ts);
    await until(() => h.requests.some(req => req.url.startsWith('/api/v2/write')));
    const write = h.requests.find(req => req.url.startsWith('/api/v2/write'));
    assert.equal(write.body, `eos-admin.0.historie.core.grid.buyW value=0 ${ts}`);
    assert.equal((await h.get()).data.status.writeVerified, true);
    h.owner.setForeignStateAsync = async () => { throw new Error('fixture failed state write'); };
    await assert.rejects(h.a.setStateAsync('historie.core.grid.buyW', { val: 900, ack: true, ts: ts + 1 }));
    await pause(20); assert.equal(h.requests.filter(req => req.url.startsWith('/api/v2/write')).length, 1);
});

test('dispatch uses direct reader while selected and returns to legacy sendTo without deleting connection', async t => {
    const h = await fixture(t); assert.equal((await h.save()).status, 200);
    let legacy = 0; h.owner.sendTo = (_instance, command, payload, cb) => { legacy++; assert.equal(command, 'getHistory'); cb({ result: [{ ts: 1, val: 10 }] }); };
    const query = { id: 'eos-admin.0.historie.core.grid.buyW', options: { start: 1, end: 1000, aggregate: 'none' } };
    const direct = await new Promise(resolve => h.a._nwDispatchHistory('influxdb.4', query, resolve));
    assert.deepEqual(direct, { result: [] }); assert.equal(legacy, 0);
    assert.equal((await h.save({ provider: 'adapter', instance: 'influxdb.4' })).status, 200);
    const adapter = await new Promise(resolve => h.a._nwDispatchHistory('influxdb.4', query, resolve));
    assert.equal(adapter.result[0].val, 10); assert.equal(legacy, 1);
    assert.equal(h.a.config.history.influxdb2.token, secret);
});

test('restart restores encrypted credentials and wrong system secret quarantines history without erasing device/EMS settings', async t => {
    const h = await fixture(t); assert.equal((await h.save()).status, 200);
    const saved = h.states.get('eos-admin.0.installer.configJson').val;
    await h.a.loadInstallerConfigFromState();
    assert.equal(h.a.config.history.influxdb2.token, secret); assert.equal(h.a.config.storageFarm.marker, 'customer-preserved');
    assert.equal(h.states.get('eos-admin.0.installer.configJson').val, saved, 'restart does not rewrite saved settings');
    h.owner.decrypt = () => { throw new Error('wrong system secret'); };
    await h.a.loadInstallerConfigFromState();
    assert.equal(h.a.config.storageFarm.marker, 'customer-preserved');
    assert.equal(h.a.config.history.influxdb2.token, undefined);
    assert.equal(h.a.config.history.credentialError, 'EOS_INFLUX_TOKEN_DECRYPTION_FAILED');
    assert.equal(h.a._nwDirectHistory.status().state, 'error');
    assert.equal(h.states.get('eos-admin.0.installer.configJson').val, saved);
});

test('encrypted backup export is recoverable but merge import cannot reuse its token at a changed destination', async t => {
    const h = await fixture(t); assert.equal((await h.save()).status, 200);
    const exported = await h.request('/api/installer/backup/export', { token: h.token });
    assert.equal(exported.status, 200); assert.ok(!exported.text.includes(secret));
    const backup = exported.data.backup;
    assert.equal(backup.configPatch.history.influxdb2.tokenEncrypted.v, 1);
    backup.configPatch.history.influxdb2.url = 'http://127.0.0.1:1/';
    h.a._nwProvisionInstallerObjects = async () => {};
    h.a._nwApplyInstallerRuntime = async () => { h.a._nwConfigureHistory(); };
    const imported = await h.request('/api/installer/backup/import', { token: h.token, method: 'POST', body: { backup, mode: 'merge', restartEms: false, expectedConfigurationRevision: (await h.get()).data.configurationRevision } });
    assert.equal(imported.status, 200, imported.text);
    assert.ok(!imported.text.includes(secret));
    assert.equal(h.a.config.history.influxdb2.token, undefined);
    assert.equal(h.a.config.history.credentialError, 'EOS_INFLUX_TOKEN_DECRYPTION_FAILED');
    assert.deepEqual(h.a.config.history.influxdb2.tokenEncrypted, backup.configPatch.history.influxdb2.tokenEncrypted);
    assert.equal(h.a.config.storageFarm.marker, 'customer-preserved');
    assert.equal(h.a._nwDirectHistory.status().state, 'error');
    assert.equal(h.requests.length, 0);
});

test('charging report rejects invalid and over-730-day ranges before IO while preserving full730-day selections', async t => {
    const h = await fixture(t); h.a.evcsList = [];
    const request = (from, to, suffix = '') => h.request('/api/evcs/report' + suffix + '?' + new URLSearchParams({ from, to }), { token: h.token });
    for (const [from, to] of [['bad', '2026-11-24'], ['', '2026-11-24'], ['2026-02-31', '2026-03-01'], ['2026-11-24', '2026-11-23'], ['2000-01-01', '2026-11-24']]) {
        const response = await request(from, to); assert.equal(response.status, 400, response.text); assert.equal(response.data.error, 'EOS_HISTORY_RANGE_INVALID');
    }
    assert.equal((await request('2000-01-01', '2026-11-24', '.csv')).status, 400);
    const to = new Date(Date.UTC(2026, 10, 24)); const from = new Date(+to - 729 * 86400000);
    const valid = await request(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
    assert.equal(valid.status, 200); assert.equal(valid.data.days.length, 730); assert.equal(h.requests.length, 0);
});

test('charging report returns database failure instead of a successful zero-consumption report', async t => {
    const h = await fixture(t); h.a.evcsList = [{ index: 1, name: 'Charger' }];
    h.a._nwDispatchHistory = (_instance, _payload, callback) => callback({ error: 'EOS_INFLUX_AUTHORIZATION_FAILED' });
    for (const suffix of ['', '.csv']) {
        const response = await h.request('/api/evcs/report' + suffix + '?from=2026-11-01&to=2026-11-24', { token: h.token });
        assert.equal(response.status, 503); assert.equal(response.data.error, 'EOS_HISTORY_UNAVAILABLE');
    }
});

test('section14a audit differentiates real empty history, transport failure and invalid range', async t => {
    const h = await fixture(t); let reads = 0; let reply = { result: [] };
    h.a._nwDispatchHistory = (_instance, _payload, callback) => { reads++; callback(reply); };
    const report = (from = '2026-11-01', to = '2026-11-24') => h.request('/api/para14a/report?' + new URLSearchParams({ from, to }), { token: h.token });
    const empty = await report(); assert.equal(empty.status, 200); assert.equal(empty.data.summary.totalEvents, 0);
    for (reply of [{ error: 'EOS_INFLUX_AUTHORIZATION_FAILED' }, undefined, { result: [null] }]) {
        const failed = await report(); assert.equal(failed.status, 503); assert.equal(failed.data.error, 'EOS_HISTORY_UNAVAILABLE');
    }
    const before = reads;
    for (const range of [['bad', '2026-11-24'], ['2026-02-31', '2026-03-01'], ['2026-11-24', '2026-11-01'], ['2000-01-01', '2026-11-24']]) {
        assert.equal((await report(...range)).status, 400);
    }
    assert.equal(reads, before);
});

test('80-day direct charging report preserves >50000 requested points; 100 days coarsen rather than truncate', async t => {
    const h = await fixture(t); assert.equal((await h.save()).status, 200);
    h.a.evcsList = [{ index: 1, name: 'Actual charger' }];
    const start = Date.UTC(2026, 8, 1);
    h.setQueryResponse(body => {
        const query = JSON.parse(body).query;
        const value = query.includes('energyDayKwh') ? 2.5 : 1000;
        return '#datatype,string,long,dateTime:RFC3339,double\n,result,table,_time,_value\n,,0,' + new Date(start).toISOString() + ',' + value + '\n,,0,' + new Date(start + 120000).toISOString() + ',' + value + '\n';
    });
    for (const days of [80, 100]) {
        const response = await h.request('/api/evcs/report?' + new URLSearchParams({ from: '2026-09-01', to: new Date(start + (days - 1) * 86400000).toISOString().slice(0, 10) }), { token: h.token });
        assert.equal(response.status, 200, response.text); assert.equal(response.data.days.length, days);
        assert.equal(response.data.days[0].totalKwh, 2.5, 'real returned daily energy is retained');
    }
    const queries = h.requests.filter(req => req.url.startsWith('/api/v2/query')).map(req => JSON.parse(req.body).query);
    const limits = queries.map(query => Number(/limit\(n: (\d+)\)/.exec(query)?.[1]));
    assert.ok(limits.some(limit => limit > 50000 && limit <= 60000), '80-day regression reaches the formerly rejected point limit');
    assert.ok(queries.some(query => query.includes('every: 180000ms')), '100-day horizon uses a larger aggregation window');
});

test('historian interception preserves exact native write overload arity and return value', async t => {
    const h = await fixture(t); const calls = [];
    h.owner.setForeignStateAsync = async function (...args) { assert.equal(this, h.owner); calls.push(args); return 'controller-result'; };
    const state = { val: 1, ack: true };
    assert.equal(await h.a.setStateAsync('unregistered', state), 'controller-result');
    assert.equal(await h.a.setStateAsync('unregistered', 0, true), 'controller-result');
    assert.deepEqual(calls, [['eos-admin.0.unregistered', state], ['eos-admin.0.unregistered', 0, true]]);
});
