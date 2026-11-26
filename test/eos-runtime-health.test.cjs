'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { createRuntimeHealthReader, processRow, readDashboardProcessStatus, readExternalOcppStatus } = require('../src/lib/eosRuntimeHealth');
const { registerEosModuleRoutes } = require('../src/lib/eosModuleHttp');
const { UnifiedSessions } = require('../src/lib/eosUnifiedBoundary');
const { installIdleSession } = require('./fixtures/eos-idle-session.cjs');

const live = (extra = {}) => ({ enabled: true, active: true, reason: 'RUNNING', details: { process: {
    mode: 'process', state: 'running', pid: 21345, generation: 3, restarts: 0,
    lastError: '', lastHeartbeatAt: Date.now(), nextRestartAt: 0,
} }, ...extra });

test('process health projects bounded fields and distinguishes process, EMS and absent status', () => {
    const secret = 'DO_NOT_EXPOSE';
    const raw = live({ config: { password: secret }, license: secret, command: secret });
    raw.details.process.config = secret;
    const row = processRow('devices', 'Geräte', raw);
    assert.equal(row.pid, 21345); assert.equal(row.restarts, 0); assert.equal(row.generation, 3);
    assert.equal(row.active, true); assert.equal(row.emsReady, null); assert.equal(row.nextRestartAt, null);
    assert.doesNotMatch(JSON.stringify(row), /DO_NOT_EXPOSE|password|license|command/);
    const ui = processRow('ui', 'Oberfläche', { active: true, emsReady: false, process: raw.details.process }, true);
    assert.equal(ui.state, 'running'); assert.equal(ui.active, true); assert.equal(ui.emsReady, null);
    const ems = processRow('ems', 'Energiemanagement', { active: true, emsReady: false, process: raw.details.process }, true);
    assert.equal(ems.state, 'running'); assert.equal(ems.active, true); assert.equal(ems.emsReady, false);
    assert.equal(processRow('devices', 'Geräte', null).state, 'unknown');
    const unknownEms = processRow('ems', 'Energiemanagement', { active: true, emsReady: true }, true);
    assert.equal(unknownEms.active, null); assert.equal(unknownEms.emsReady, null);
    const disabled = processRow('devices', 'Geräte', { enabled: false, active: false });
    assert.equal(disabled.state, 'disabled'); assert.equal(disabled.pid, null); assert.equal(disabled.active, false);
    const invalid = processRow('devices', 'Geräte', { reason: `error ${secret}`, details: { process: {
        state: '<script>', pid: -1, generation: Infinity, restarts: -2, lastError: `Error: ${secret}`, lastHeartbeatAt: 9e99,
    } } });
    assert.equal(invalid.state, 'unknown'); assert.equal(invalid.reason, ''); assert.equal(invalid.pid, null);
    assert.equal(invalid.generation, null); assert.equal(invalid.restarts, null); assert.equal(invalid.lastHeartbeatAt, null);
    const backoff = processRow('devices', 'Geräte', { active: false, details: { process: {
        state: 'backoff', pid: 123, restarts: 2, nextRestartAt: Date.now() + 5000, lastError: 'EOS_MODULE_PROCESS_EXIT',
    } } });
    assert.equal(backoff.pid, null); assert.equal(backoff.reason, 'EOS_MODULE_PROCESS_EXIT');
    const eebusError = processRow('eebus', 'EEBus', { details: { process: { state: 'error', lastError: 'EEBUS_CONNECTION_FAILED' } } });
    assert.equal(eebusError.reason, 'EEBUS_CONNECTION_FAILED');
});

test('GUI disabled or restarting does not change confirmed EMS process diagnosis', async () => {
    const active = new Set(['ems', 'devices', 'eebus', 'backup', 'ocpp']);
    const process = live().details.process;
    const runtimeStatus = () => ({
        active: true, emsReady: true, process,
        ui: active.has('ui') ? { active: false, process: { ...process, state: 'starting', pid: 21347 } }
            : { active: false, process: { ...process, state: 'stopped', pid: null } },
        ems: { active: true, emsReady: true, process: { ...process, pid: 21346 } },
    });
    const read = createRuntimeHealthReader({ host: { status: () => live() }, runtimeStatus,
        runtimeControl: { isEnabled: id => active.has(id), view: (_id, configured) => ({ configured }) } });
    let { processes } = await read();
    const ems = processes.find(row => row.id === 'ems');
    assert.equal(ems.pid, 21346);
    assert.equal(ems.emsReady, true);
    assert.equal(ems.controls.configured, true);
    assert.equal(processes.find(row => row.id === 'ui').state, 'disabled');
    active.add('ui');
    ({ processes } = await read());
    assert.equal(processes.find(row => row.id === 'ui').state, 'starting');
    assert.deepEqual(processes.find(row => row.id === 'ems'), ems);
    active.delete('ems');
    ({ processes } = await read());
    assert.equal(processes.find(row => row.id === 'ems').emsReady, false);
});

test('OCPP only reads inventoried exact namespaces and shows a PID confirmed for the current run', async () => {
    const now = Date.now(); const reads = []; let query;
    const state = val => ({ val, ts: now, lc: now - 10000, ack: true, q: 0 });
    const data = { 'system.adapter.ocpp21.2.alive': state(true), 'system.adapter.ocpp21.2.pid': state(23123), 'ocpp21.2.info.connection': state(true) };
    const owner = { getObjectViewAsync: async (...args) => { query = args; return { rows: [
        { id: 'system.adapter.ocpp21.2', value: { native: { password: 'PRIVATE' } } },
        { id: 'system.adapter.ocpp21.2' }, { id: 'system.adapter.foreign.0' }, { id: 'system.adapter.ocpp21.2../secret' },
    ] }; }, getForeignStateAsync: async id => { reads.push(id); return data[id]; } };
    const rows = await readExternalOcppStatus(owner, now);
    assert.equal(query[0], 'system'); assert.equal(query[1], 'instance'); assert.equal(query[2].startkey, 'system.adapter.ocpp21.');
    assert.equal(query[2].limit, 33); assert.equal(rows.length, 1);
    assert.deepEqual(reads.sort(), Object.keys(data).sort());
    assert.equal(rows[0].pid, 23123); assert.equal(rows[0].state, 'running'); assert.equal(rows[0].connected, true);
    assert.doesNotMatch(JSON.stringify(rows), /PRIVATE|password/);
    data['system.adapter.ocpp21.2.pid'].ts = now - 20000;
    assert.equal((await readExternalOcppStatus(owner, now))[0].pid, null, 'PID from the prior process run is never reused');
});

test('OCPP invalid, stale, unacknowledged and failed reads never claim a running process or invented PID', async () => {
    const now = Date.now(); let alive = { val: true, ts: now, lc: now, ack: true, q: 0 };
    let reportedPid = { val: 1234, ts: now, ack: true, q: 0 };
    const owner = { getObjectViewAsync: async () => ({ rows: [{ id: 'system.adapter.ocpp21.0' }] }),
        getForeignStateAsync: async id => id.endsWith('.alive') ? alive : id.endsWith('.pid') ? reportedPid : null };
    for (const patch of [{ q: 64 }, { ack: false }, { ts: now - 120001 }, { ts: now + 5001 }, { val: 'true' }]) {
        alive = { val: true, ts: now, lc: now, ack: true, q: 0, ...patch };
        const row = (await readExternalOcppStatus(owner, now))[0]; assert.equal(row.state, 'unknown'); assert.equal(row.pid, null);
    }
    alive = { val: false, ts: now, lc: now, ack: true, q: 0 };
    assert.equal((await readExternalOcppStatus(owner, now))[0].state, 'stopped');
    alive.val = true; reportedPid = null;
    assert.equal((await readExternalOcppStatus(owner, now))[0].pid, null, 'compact/absent PID remains unknown');
    owner.getForeignStateAsync = async () => { throw new Error('PRIVATE_CONFIGURATION'); };
    assert.equal((await readExternalOcppStatus(owner, now))[0].state, 'unknown');
});

test('OCPP enumeration is bounded and does not call state methods if inventory is invalid', async () => {
    let reads = 0;
    const owner = { getObjectViewAsync: async () => ({ rows: Array.from({ length: 33 }, (_, i) => ({ id: `system.adapter.ocpp21.${i}` })) }),
        getForeignStateAsync: async () => { reads++; } };
    await assert.rejects(readExternalOcppStatus(owner), /EOS_RUNTIME_OCPP_LIMIT/); assert.equal(reads, 0);
    owner.getObjectViewAsync = async () => ({});
    await assert.rejects(readExternalOcppStatus(owner), /EOS_RUNTIME_OCPP_INVENTORY/); assert.equal(reads, 0);
});

test('hosted OCPP appears once after migration while a running external duplicate remains visible', async () => {
    let externalAlive = false; let inventoryFailed = false; const now = Date.now();
    const host = { status: async id => live({ namespace: id === 'ocpp' ? 'ocpp21.0' : '' }), owner: {
        getObjectViewAsync: async () => { if (inventoryFailed) throw new Error('PRIVATE'); return { rows: [{ id: 'system.adapter.ocpp21.0' }, { id: 'system.adapter.ocpp21.1' }] }; },
        getForeignStateAsync: async id => ({ val: id.endsWith('.pid') ? 23124 : id.includes('ocpp21.0') ? externalAlive : true, ts: now, lc: now, ack: true, q: 0 }),
    } };
    const read = createRuntimeHealthReader({ host });
    const migrated = (await read()).processes;
    assert.equal(migrated.find(row => row.id === 'ocpp').kind, 'child'); assert.equal(migrated.find(row => row.id === 'ocpp').pid, 21345);
    assert.equal(migrated.some(row => row.id === 'ocpp21.0'), false, 'stopped imported source is not a duplicate process');
    assert.equal(migrated.find(row => row.id === 'ocpp21.1').kind, 'external');
    externalAlive = true;
    const conflicted = (await read()).processes;
    assert.equal(conflicted.find(row => row.id === 'ocpp21.0').state, 'running'); assert.equal(conflicted.find(row => row.id === 'ocpp21.0').pid, 23124);
    inventoryFailed = true;
    const unavailable = (await read()).processes;
    assert.equal(unavailable.find(row => row.id === 'ocpp').state, 'running', 'failed external inventory never replaces hosted status');
    assert.equal(unavailable.find(row => row.id === 'ocpp-external').state, 'unknown');
    assert.doesNotMatch(JSON.stringify(unavailable), /PRIVATE/);
});

test('parallel diagnosis calls share bounded reads and timed-out sources cannot accumulate work', async () => {
    let reads = 0; let release;
    const pending = new Promise(resolve => { release = resolve; });
    const host = { status: id => { if (id === 'devices') { reads++; return pending; } return live(); } };
    const read = createRuntimeHealthReader({ host, timeoutMs: 20, runtimeStatus: () => ({ active: true, emsReady: true, process: live().details.process }) });
    const first = read(); assert.equal(read(), first);
    const result = await first;
    assert.equal(result.processes.find(row => row.id === 'admin').pid, process.pid);
    assert.equal(result.processes.find(row => row.id === 'devices').state, 'unknown');
    assert.equal(result.processes.find(row => row.id === 'eebus').state, 'running');
    await read(); await read(); assert.equal(reads, 1, 'a never-settled source cannot create repeated pending ioBroker/IPC operations');
    release(live()); await pending; await Promise.resolve();
    const recovered = await read(); assert.equal(reads, 2); assert.equal(recovered.processes.find(row => row.id === 'devices').state, 'running');
});

async function fixture(t) {
    const token = 'b'.repeat(40); let role = 'admin'; let first = false; let reads = 0; let crash = false;
    const adapter = {}; const session = await installIdleSession(adapter, { token, user: 'operator' }); t.after(() => session.cleanup());
    const authority = new UnifiedSessions(adapter, { secure: true, externalOrigin: '',
        resolveAccess: async req => req.headers.cookie === `access_token=${token}`
            ? { userId: 'system.user.operator', role, groups: [] } : { userId: null, role: 'enduser', groups: [] },
        firstLogin: async () => ({ required: first }), getLicense: () => ({ valid: true, coreEnabled: true }) });
    const app = express();
    const host = { status: async () => { reads++; if (crash) throw new Error('PRIVATE_PASSWORD'); return live({ config: { password: 'PRIVATE_PASSWORD' } }); } };
    registerEosModuleRoutes({ app, host, baseDir: path.resolve(__dirname, '..'), jsonParser: express.json(),
        authorize: req => authority.status(req), requestAllowed: req => authority.requestAllowed(req), csrfAllowed: req => authority.csrfAllowed(req),
        runtimeStatus: () => ({
            ui: { active: true, process: live().details.process },
            ems: { active: true, emsReady: false, process: { ...live().details.process, pid: 21346 }, config: { password: 'PRIVATE_PASSWORD' } },
        }) });
    app.use((_req, res) => res.status(404).end());
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const request = (url, options = {}) => new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: url, method: options.method || 'GET',
            headers: { host: 'nexowatt', cookie: `access_token=${token}`, ...options.headers } }, response => {
            const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => resolve({
                status: response.statusCode, headers: response.headers, text: Buffer.concat(chunks).toString(),
            }));
        }); req.on('error', reject); req.end();
    });
    return { request, role: value => { role = value; }, first: value => { first = value; }, crash: () => { crash = true; }, reads: () => reads };
}

test('runtime page, assets and API reuse fresh administrator, first-login and origin protection', async t => {
    const f = await fixture(t);
    assert.equal((await f.request('/api/eos/runtime', { headers: { cookie: '' } })).status, 401);
    f.role('installer'); assert.equal((await f.request('/api/eos/runtime')).status, 403);
    f.role('enduser'); assert.equal((await f.request('/runtime/')).status, 403);
    f.role('admin'); f.first(true); assert.equal((await f.request('/api/eos/runtime')).status, 403); f.first(false);
    assert.equal((await f.request('/api/eos/runtime', { headers: { origin: 'https://foreign.invalid' } })).status, 403);
    assert.equal(f.reads(), 0, 'denied reads do not touch process or controller state');
    for (const path of ['/runtime/', '/runtime/index.js', '/runtime/style.css']) {
        const anonymous = await f.request(path, { headers: { cookie: '' } });
        assert.equal(anonymous.status, 302); assert.equal(anonymous.headers.location, '/login.html?admin=1&returnTo=%2Fruntime%2F');
        assert.equal((await f.request(path)).status, 200);
    }
    const page = await f.request('/runtime/'); assert.match(page.headers['content-security-policy'], /script-src 'self'/);
    assert.equal(page.headers['x-content-type-options'], 'nosniff');
    assert.equal((await f.request('/runtime')).headers.location, '/runtime/');
    assert.equal((await f.request('/runtime/../../package.json')).status, 404);
});

test('runtime endpoint is read-only and never publishes raw configuration, exceptions or secrets', async t => {
    const f = await fixture(t);
    const result = await f.request('/api/eos/runtime'); assert.equal(result.status, 200); assert.equal(result.headers['cache-control'], 'no-store');
    assert.doesNotMatch(result.text, /PRIVATE_PASSWORD|password|config|license/);
    const snapshot = JSON.parse(result.text); assert.equal(snapshot.processes.length, 7);
    assert.equal(snapshot.processes.find(row => row.id === 'ui').emsReady, null);
    assert.equal(snapshot.processes.find(row => row.id === 'ems').emsReady, false);
    const reads = f.reads();
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
        const denied = await f.request('/api/eos/runtime', { method, headers: { origin: 'https://nexowatt' } }); assert.equal(denied.status, 405); assert.equal(denied.headers.allow, 'GET');
    }
    assert.equal(f.reads(), reads);
    f.crash(); const failed = await f.request('/api/eos/runtime'); assert.equal(failed.status, 200);
    assert.doesNotMatch(failed.text, /PRIVATE_PASSWORD/);
    assert.equal(JSON.parse(failed.text).processes.find(row => row.id === 'devices').state, 'unknown');
});

test('customer diagnostic endpoint resolves authority before inspecting the parent and exposes only read-only health', async t => {
    const f = await fixture(t);
    const endpoint = '/api/eos/dashboard/process-status';
    assert.equal((await f.request(endpoint, { headers: { cookie: '' } })).status, 401);
    f.role('enduser');
    assert.equal((await f.request(endpoint, { headers: { origin: 'https://foreign.invalid' } })).status, 403);
    const response = await f.request(endpoint);
    assert.equal(response.status, 200, response.text);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.doesNotMatch(response.text,/PRIVATE_PASSWORD|csrf|pid|lastError|generation|modules\./);
    assert.equal((await f.request('/api/eos/runtime')).status, 403);
    assert.equal((await f.request(endpoint, { method:'PUT', headers: { origin: 'https://nexowatt' } })).status,405);
    f.first(true); assert.equal((await f.request(endpoint)).status, 403);
    assert.equal(f.reads(), 0, 'no external controller reads or child status RPCs on the customer endpoint');
});

test('a missing supervisor cannot hide a confirmed failure and an unreadable switch is never reported as intentionally paused', () => {
    const now = Date.now();
    const host = { supervisorState(id) {
        if (id !== 'devices') throw new Error('temporary read failure');
        return { configured: true, active: false, reason: 'START_FAILED', process: { state: 'error', lastHeartbeatAt: now } };
    } };
    const intent = { dashboardIntent(id) {
        if (id === 'ems') throw new Error('unreadable runtime setting');
        return { enabled: true, error: '' };
    } };
    const result = readDashboardProcessStatus(host, () => { throw new Error('split runtime unavailable'); }, intent, now);
    assert.equal(result.state, 'fault');
    assert.deepEqual(result.failed, ['devices']);
    assert.deepEqual(result.paused, []);
});
