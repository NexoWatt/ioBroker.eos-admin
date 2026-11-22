'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { UnifiedSessions } = require('../src/lib/eosUnifiedBoundary');
const { createHostedRuntime } = require('../ui/main');

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
        eosSessionSecurity: { epoch: 'test-epoch' },
    };
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
    const server = http.createServer((req, res) => runtime.handle(req, res, () => { res.statusCode = 404; res.end(); }));
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
    const denied = await request('/static/login.js', { origin: 'https://foreign.example' });
    assert.equal(denied.status, 403);
    await denied.arrayBuffer();
});
