/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const http = require('node:http');
const express = require('express');
const ts = require('typescript');
const { UnifiedSessions } = require('../src/lib/eosUnifiedBoundary');
const { installIdleSession } = require('./fixtures/eos-idle-session.cjs');
const filename = path.resolve(__dirname, '../src/lib/eosCustomerUpdateHttp.ts');
const loaded = new Module(filename, module); loaded.filename = filename; loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { registerEosCustomerUpdateRoutes } = loaded.exports;
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const status = { installedVersion: '9.0.20', availableVersion: '9.0.21', checkedAt: 1000, source: 'npm-latest', state: 'available', canStart: false, reason: null };

async function fixture(t, timeout = 20000) {
    const token = 'a'.repeat(40); let role = 'customer'; let active = true; let first = false; let accessGate = null;
    const calls = []; const adapter = {}; const app = express();
    const session = await installIdleSession(adapter, { token, user: 'operator' });
    t.after(() => session.cleanup());
    const authority = new UnifiedSessions(adapter, { secure: true, externalOrigin: '',
        resolveAccess: async req => active && req.headers.cookie === `access_token=${token}`
            ? { userId: 'system.user.operator', role, groups: [] } : { userId: null, role: 'enduser', groups: [] },
        firstLogin: async () => ({ required: first }), getLicense: () => ({ valid: true, coreEnabled: true }) });
    const service = {
        async status() { calls.push('status'); return { ...status }; },
        async check() { calls.push('check'); return { ...status }; },
        async prepare(version, authorize) { calls.push(['prepare', version]); if (!await authorize()) throw new Error('EOS_UPDATE_SESSION'); return { ...status, state: 'prepared', canStart: true, planId: 'a'.repeat(36), expiresAt: 2000 }; },
        async start(planId, authorize) { calls.push(['start', planId]); if (!await authorize()) throw new Error('EOS_UPDATE_SESSION'); return { ...status, state: 'installing', jobId: 'b'.repeat(36) }; },
    };
    registerEosCustomerUpdateRoutes(app, { service, requestAllowed: req => authority.requestAllowed(req), csrfAllowed: req => authority.csrfAllowed(req),
        access: async req => { if (accessGate) await accessGate.promise; return authority.status(req); }, responseTimeoutMs: timeout });
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => { if (accessGate) accessGate.resolve(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    const csrf = authority.csrf({ headers: { cookie: `access_token=${token}` } });
    const headers = { host: 'nexowatt', cookie: `access_token=${token}`, origin: 'https://nexowatt', 'content-type': 'application/json', 'x-nw-csrf': csrf };
    function open(action, options = {}) {
        let req;
        const promise = new Promise((resolve, reject) => {
            req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: `/api/eos-update/${action}`, method: action === 'status' ? 'GET' : 'POST', headers: { ...headers, ...options.headers } }, res => {
                const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => {
                    const text = Buffer.concat(chunks).toString(); resolve({ status: res.statusCode, headers: res.headers, text, json: () => JSON.parse(text) });
                }); res.on('error', reject);
            });
            req.on('error', reject);
            if (options.partial) req.write(options.raw);
            else req.end(action === 'status' ? undefined : options.raw === undefined ? JSON.stringify(options.body ?? {}) : options.raw);
        });
        return { promise, abort: () => req.destroy(new Error('TEST_CLIENT_CLOSED')) };
    }
    return { service, calls, adapter, request: (action, options) => open(action, options).promise, open,
        revoke: () => { active = false; }, role: value => { role = value; }, first: value => { first = value; }, holdAccess: gate => { accessGate = gate; } };
}

test('actual UnifiedSessions permits the explicit customer update capability without general administrator rights', async t => {
    const f = await fixture(t);
    for (const role of ['customer', 'installer', 'admin']) {
        f.role(role);
        for (const [action, body] of [['status', {}], ['check', {}], ['prepare', { version: '9.0.21' }], ['start', { planId: 'a'.repeat(36), confirm: true }]]) {
            const response = await f.request(action, { body }); assert.equal(response.status, 200, `${role}/${action}`);
            assert.equal(response.headers['cache-control'], 'no-store');
            assert.doesNotMatch(response.text, /encrypted|snapshot|native|password|token|credential/i);
        }
    }
    assert.equal(f.calls.length, 12);
});

test('anonymous, cross-origin, CSRF, initial-password and unapproved roles never reach update actions', async t => {
    const f = await fixture(t);
    for (const headers of [{ cookie: '' }, { origin: 'https://foreign.invalid' }, { 'x-nw-csrf': '' }, { 'x-nw-csrf': 'f'.repeat(64) }]) {
        assert.equal((await f.request('prepare', { headers, body: { version: '9.0.21' } })).status, 403);
    }
    assert.equal((await f.request('status', { headers: { origin: 'https://foreign.invalid' } })).status, 403);
    f.first(true); assert.equal((await f.request('check')).status, 403); f.first(false);
    // UnifiedSessions intentionally maps authenticated ioBroker enduser to EOS customer.
    for (const role of ['operator', 'none', '', '__proto__']) { f.role(role); assert.equal((await f.request('check')).status, 403); }
    assert.equal(f.calls.length, 0);
});

test('no update route accepts arbitrary URLs, paths, commands, alternate versions or extra fields', async t => {
    const f = await fixture(t);
    const invalid = [ ['check', { version: '9.0.21' }], ['prepare', { version: '9.0.21', url: 'https://example.invalid/archive.tgz' }],
        ...['latest', '../../package.tgz', '9.0.21;reboot', '9.0.21-beta.1', '9999999.1.1', 'https://evil.invalid'].map(version => ['prepare', { version }]),
        ['prepare', {}], ['prepare', { version: 21 }], ['start', { planId: 'a'.repeat(36), confirm: false }], ['start', { planId: 'a'.repeat(36), confirm: true, command: 'reboot' }],
        ['start', { planId: '../fake/path', confirm: true }], ['start', { planId: 'a'.repeat(129), confirm: true }], ['check', []] ];
    for (const [action, body] of invalid) assert.equal((await f.request(action, { body })).status, 400, JSON.stringify(body));
    assert.equal(f.calls.length, 0);
});

test('malformed and oversized JSON have bounded JSON errors without stack paths or request secrets', async t => {
    const f = await fixture(t);
    for (const [raw, code] of [['{"SECRET_PRIVATE', 400], [JSON.stringify({ secret: 'SECRET_PRIVATE'.repeat(150) }), 413]]) {
        const response = await f.request('prepare', { raw }); assert.equal(response.status, code);
        assert.match(response.headers['content-type'], /application\/json/);
        assert.deepEqual(response.json(), { error: 'UPDATE_REQUEST' });
        assert.doesNotMatch(response.text, /SECRET_PRIVATE|SyntaxError|node_modules|<!DOCTYPE/);
    }
    assert.equal(f.calls.length, 0);
});

test('fresh session revocation, role changes and mandatory password changes are checked at the final service fence', async t => {
    for (const action of ['prepare', 'start']) {
        for (const invalidate of [f => f.revoke(), f => f.role('operator'), f => f.first(true), f => { f.adapter.eosSessionSecurity.epoch = 'rotated-epoch'; }]) {
            const f = await fixture(t); const gate = defer(); const reached = defer(); let effects = 0;
            f.service[action] = async (_id, authorize) => { reached.resolve(); await gate.promise; if (!await authorize()) throw new Error('EOS_UPDATE_SESSION'); effects++; return status; };
            const request = f.request(action, { body: action === 'prepare' ? { version: '9.0.21' } : { planId: 'a'.repeat(36), confirm: true } });
            await reached.promise; invalidate(f); gate.resolve(); assert.equal((await request).status, 403); assert.equal(effects, 0);
        }
    }
});

test('status is reauthorized after a slow service read and internal error details never enter responses', async t => {
    const f = await fixture(t); const gate = defer(); const reached = defer();
    f.service.status = async () => { reached.resolve(); await gate.promise; return status; };
    const pending = f.request('status'); await reached.promise; f.revoke(); gate.resolve(); assert.equal((await pending).status, 403);
    const g = await fixture(t);
    for (const [error, code, expected] of [['PRIVATE_CUSTOMER_SECRET', 503, 'UPDATE_UNAVAILABLE'], ['bad /private/config/password', 503, 'UPDATE_UNAVAILABLE'],
        ['EOS_UPDATE_CONFIGURATION_BUSY', 409, 'EOS_UPDATE_CONFIGURATION_BUSY'], ['EOS_UPDATE_PLAN_EXPIRED', 409, 'EOS_UPDATE_PLAN_EXPIRED'], ['EOS_UPDATE_SESSION', 403, 'EOS_UPDATE_SESSION']]) {
        g.service.check = async () => { throw new Error(error); };
        const response = await g.request('check'); assert.equal(response.status, code); assert.deepEqual(response.json(), { error: expected });
    }
});

test('HTTP timeout revokes late prepare/start authority even when the service operation cannot be cancelled', async t => {
    for (const action of ['prepare', 'start']) {
        const f = await fixture(t, 25); const gate = defer(); const reached = defer(); const ended = defer(); let effects = 0;
        f.service[action] = async (_id, authorize) => { reached.resolve(); await gate.promise; try { if (!await authorize()) throw new Error('EOS_UPDATE_SESSION'); effects++; return status; } finally { ended.resolve(); } };
        const pending = f.request(action, { body: action === 'prepare' ? { version: '9.0.21' } : { planId: 'a'.repeat(36), confirm: true } });
        await reached.promise;
        const result = await Promise.race([pending, delay(200).then(() => ({ status: 0 }))]);
        gate.resolve(); await ended.promise; await pending;
        assert.equal(result.status, 504); assert.equal(effects, 0);
    }
});

test('client disconnect revokes the callback before any later prepare/start effect', async t => {
    for (const action of ['prepare', 'start']) {
        const f = await fixture(t); const gate = defer(); const reached = defer(); const ended = defer(); let effects = 0;
        f.service[action] = async (_id, authorize) => { reached.resolve(); await gate.promise; try { if (!await authorize()) throw new Error('EOS_UPDATE_SESSION'); effects++; return status; } finally { ended.resolve(); } };
        const request = f.open(action, { body: action === 'prepare' ? { version: '9.0.21' } : { planId: 'a'.repeat(36), confirm: true } });
        const disconnected = request.promise.catch(() => {}); await reached.promise; request.abort(); await disconnected; await delay(20);
        gate.resolve(); await ended.promise; assert.equal(effects, 0);
    }
});

test('pending auth database work retains bounded admission after HTTP timeout until it really settles', async t => {
    const f = await fixture(t, 25); const gate = defer(); f.holdAccess(gate);
    const requests = Array.from({ length: 8 }, () => f.request('check'));
    const responses = await Promise.race([Promise.all(requests), delay(200).then(() => null)]);
    let ninth;
    if (responses) ninth = await f.request('check');
    gate.resolve(); await Promise.all(requests); await delay(20); f.holdAccess(null);
    assert.ok(responses, 'HTTP response must finish even when session storage does not');
    assert.ok(responses.every(response => response.status === 504)); assert.equal(ninth.status, 429);
    assert.equal(f.calls.length, 0, 'late access must not reach the update service');
    assert.equal((await f.request('check')).status, 200);
});

test('incomplete JSON bodies are cancelled on timeout or disconnect and cannot retain every admission slot', async t => {
    const f = await fixture(t, 50);
    const opened = Array.from({ length: 8 }, () => f.open('check', { partial: true, raw: '{', headers: { 'content-length': '1000' } }));
    t.after(() => opened.forEach(request => request.abort()));
    const responses = await Promise.all(opened.map(request => request.promise));
    assert.ok(responses.every(response => response.status === 504));
    assert.equal(f.calls.length, 0);
    assert.equal((await f.request('check')).status, 200, 'cancellable bodies must release admission after timeout');
    const partial = f.open('check', { partial: true, raw: '{', headers: { 'content-length': '1000' } });
    const closed = partial.promise.catch(() => {}); await delay(10); partial.abort(); await closed; await delay(10);
    assert.equal((await f.request('check')).status, 200);
});
