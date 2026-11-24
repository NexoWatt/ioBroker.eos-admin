'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { UnifiedSessions } = require('../src/lib/eosUnifiedBoundary');
const { createHostedRuntime } = require('../ui/main');
const { installIdleSession } = require('./fixtures/eos-idle-session.cjs');

// Exercise both production sides of the bridge. The adapter database and license
// are fixtures; no controller, hardware writer, or second runtime listener starts.
test('real hosted HTTP accepts normal navigation through the owner origin policy', async t => {
    const token = 'a'.repeat(40);
    const object = {
        _id: 'system.adapter.eos-admin.0', type: 'instance', common: { enabled: true },
        native: { auth: true, secure: false, port: 8188, eosUi: { siteName: 'Boundary test' } },
    };
    const owner = {
        namespace: 'eos-admin.0', instance: 0, config: object.native,
        log: { error() {}, warn() {}, info() {}, debug() {} },
        getForeignObjectAsync: async () => structuredClone(object),
        getForeignStateAsync: async () => null,
        sendTo: (_instance, _command, _message, callback) => callback({ result: [] }),
        setTimeout, clearTimeout,
    };
    const sessionFixture = await installIdleSession(owner, { token, user: 'operator' });
    t.after(() => sessionFixture.cleanup());
    const license = { valid: true, coreEnabled: true, edition: 'pro', features: [], limits: { chargePoints: 50, batteries: 10 } };
    const authority = new UnifiedSessions(owner, {
        secure: false, externalOrigin: '',
        resolveAccess: async req => req.headers.cookie === `access_token=${token}`
            ? { userId: 'system.user.operator', role: 'admin', groups: [] }
            : { userId: null, role: 'enduser', groups: [] },
        firstLogin: async () => ({ required: false }), getLicense: () => license,
    });
    const runtime = createHostedRuntime(owner, {
        canWrite: () => false,
        originAllowed: req => authority.requestAllowed(req),
        resolveAccess: req => authority.status(req), getLicense: () => license,
    });
    await runtime.start();
    // Production has an Express-5 host and an embedded Express-4 UI. Raw Node
    // requests alone cannot reproduce the inherited req.query getter regression.
    const host = express();
    host.use((req, res, next) => runtime.handle(req, res, next));
    host.use((_req, res) => { res.status(404).end(); });
    const server = http.createServer(host);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    t.after(async () => { await runtime.stop(); await new Promise(resolve => server.close(resolve)); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const request = (path, headers = {}) => fetch(origin + path, { redirect: 'manual', headers });
    for (const path of ['/login.html', '/static/login.js', '/static/runtime-base.js', '/static/login.css', '/assets/icons/nexowatt-32.png']) {
        const response = await request(path);
        assert.equal(response.status, 200, path);
        await response.arrayBuffer();
    }
    const anonymous = await request('/');
    assert.equal(anonymous.status, 303);
    assert.equal(anonymous.headers.get('location'), '/login.html?returnTo=%2F');
    await anonymous.arrayBuffer();
    for (const path of ['/', '/installer/']) {
        const response = await request(path, { cookie: `access_token=${token}` });
        assert.equal(response.status, 200, path);
        assert.match(response.headers.get('content-type'), /text\/html/);
        await response.arrayBuffer();
    }
    const history = await request('/api/history?from=1000000&to=1600000&step=600', { cookie: `access_token=${token}` });
    assert.equal(history.status, 200);
    const historyBody = await history.json();
    assert.equal(historyBody.start, 1000000);
    assert.equal(historyBody.end, 1600000);
    const duplicateHistory = await request('/api/history?from=1000000&from=2000000&to=2600000', { cookie: `access_token=${token}` });
    assert.equal(duplicateHistory.status, 400);
    assert.equal((await duplicateHistory.json()).error, 'EOS_HISTORY_RANGE_INVALID');
    const anonymousHistory = await request('/api/history?from=1000000&to=1600000&step=600');
    assert.equal(anonymousHistory.status, 401);
    await anonymousHistory.arrayBuffer();
    const noCsrf = await fetch(origin + '/api/history', { method: 'POST', headers: { origin, cookie: `access_token=${token}` } });
    assert.equal(noCsrf.status, 403);
    assert.equal((await noCsrf.json()).error, 'csrf_required');
    const denied = await request('/static/login.js', { origin: 'https://foreign.example' });
    assert.equal(denied.status, 403);
    await denied.arrayBuffer();
});
