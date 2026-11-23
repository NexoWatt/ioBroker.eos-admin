'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http');
const express = require('express');
const { UnifiedSessions } = require('../src/lib/eosUnifiedBoundary');
const { registerEosModuleRoutes } = require('../src/lib/eosModuleHttp');

async function fixture(t) {
    const token = 'a'.repeat(40); let role = 'admin'; let active = true; let first = false; let writes = 0;
    const adapter = { eosSessionSecurity: { epoch: 'test-one' } };
    const authority = new UnifiedSessions(adapter, { secure: true, externalOrigin: '',
        resolveAccess: async req => active && req.headers.cookie === `access_token=${token}`
            ? { userId: 'system.user.operator', role, groups: [] } : { userId: null, role: 'enduser', groups: [] },
        firstLogin: async () => ({ required: first }), getLicense: () => ({ valid: true, coreEnabled: true }) });
    const app = express(); const host = {
        view: async id => ({ id, config: { enabled: false }, status: { active: false } }),
        save: async () => { writes++; return { ok: true }; }, importLegacy: async () => { writes++; return { ok: true }; },
        command: async (_id, command) => { if (command === 'error') throw new Error('PRIVATE_CONFIGURATION'); writes++; return { ok: true }; },
    };
    registerEosModuleRoutes({ app, host, baseDir: path.resolve(__dirname, '..'), jsonParser: express.json({ limit: '1kb' }),
        authorize: req => authority.status(req), csrfAllowed: req => authority.csrfAllowed(req), requestAllowed: req => authority.requestAllowed(req) });
    app.use((_req, res) => res.status(404).end());
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    t.after(async () => { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); });
    // Node fetch rewrites Host to the URL authority; raw HTTP preserves the actual
    // named-host request needed to exercise the production origin comparison.
    const request = (url, options = {}) => new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: url,
            method: options.method || 'GET', headers: { host: 'nexowatt', cookie: `access_token=${token}`, ...options.headers } }, response => {
            const chunks = []; response.on('data', chunk => chunks.push(chunk)); response.on('end', () => {
                const body = Buffer.concat(chunks);
                resolve({ status: response.statusCode, headers: { get: name => response.headers[name.toLowerCase()] },
                    text: async () => body.toString(), json: async () => JSON.parse(body.toString()), arrayBuffer: async () => body });
            });
        });
        req.on('error', reject); req.end(options.body);
    });
    return { request, adapter, token, revoke: () => { active = false; }, role: value => { role = value; }, first: value => { first = value; }, writes: () => writes };
}

test('real module pages and vendor assets are available through the guarded same-origin routes', async t => {
    const f = await fixture(t);
    for (const url of ['/modules/devices/', '/modules/eebus/', '/modules/devices/vendor/jquery.js', '/modules/devices/templates.json']) {
        const response = await f.request(url); assert.equal(response.status, 200, url); await response.arrayBuffer();
    }
    for (const id of ['devices', 'eebus']) {
        const response = await f.request(`/modules/${id}`);
        assert.equal(response.status, 308); assert.equal(response.headers.get('location'), `/modules/${id}/`);
    }
    const forbidden = await f.request('/modules/eebus/../../package.json'); assert.equal(forbidden.status, 404);
    const anonymous = await f.request('/modules/devices/', { headers: { cookie: '' } });
    assert.equal(anonymous.status, 302); assert.equal(anonymous.headers.get('location'), '/login.html');
});

test('fresh admin role, same origin and session-bound CSRF are required for every module mutation', async t => {
    const f = await fixture(t); const status = await (await f.request('/api/eos/modules/devices')).json();
    const options = { method: 'PUT', headers: { 'content-type': 'application/json', origin: 'https://nexowatt', 'x-nw-csrf': status.csrfToken }, body: '{"config":{"enabled":false}}' };
    assert.equal((await f.request('/api/eos/modules/devices', options)).status, 200); assert.equal(f.writes(), 1);
    assert.equal((await f.request('/api/eos/modules/devices', { ...options, headers: { ...options.headers, origin: 'https://foreign.invalid' } })).status, 403);
    f.role('installer'); assert.equal((await f.request('/api/eos/modules/devices', options)).status, 403);
    f.role('admin'); f.adapter.eosSessionSecurity.epoch = 'revoked-csrf';
    assert.equal((await f.request('/api/eos/modules/devices', options)).status, 403);
    f.revoke(); assert.equal((await f.request('/api/eos/modules/devices', options)).status, 401); assert.equal(f.writes(), 1);
});

test('first-login password requirement and invalid expired sessions do not expose configuration', async t => {
    const f = await fixture(t); f.first(true);
    assert.equal((await f.request('/api/eos/modules/eebus')).status, 403);
    const page = await f.request('/modules/eebus/'); assert.equal(page.headers.get('location'), '/system/?passwordSetup');
    f.first(false); f.revoke(); assert.equal((await f.request('/api/eos/modules/eebus')).status, 401);
});

test('invalid and oversized module JSON and internal exceptions are contained without leaking bodies', async t => {
    const f = await fixture(t); const status = await (await f.request('/api/eos/modules/devices')).json();
    const headers = { 'content-type': 'application/json', origin: 'https://nexowatt', 'x-nw-csrf': status.csrfToken };
    for (const [body, code] of [['{ "password": "PRIVATE', 400], [JSON.stringify({ config: 'PRIVATE'.repeat(1000) }), 413]]) {
        const response = await f.request('/api/eos/modules/devices', { method: 'PUT', headers, body });
        assert.equal(response.status, code); assert.doesNotMatch(await response.text(), /PRIVATE|SyntaxError|node_modules/);
    }
    const response = await f.request('/api/eos/modules/devices/command', { method: 'POST', headers, body: '{"command":"error"}' });
    assert.equal(response.status, 400); assert.doesNotMatch(await response.text(), /PRIVATE/);
    assert.equal((await f.request('/api/eos/modules/devices')).status, 200);
});
