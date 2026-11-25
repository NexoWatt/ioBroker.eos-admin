'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFixture } = require('./fixtures/eos-ocpp-admin.cjs');

test('OCPP production page and assets require fresh administrator access and expose only fixed paths', async t => {
    const f = await createFixture(); t.after(() => f.close());
    for (const path of ['/modules/ocpp/', '/modules/ocpp/index.js', '/modules/ocpp/style.css', '/modules/ocpp/config-fields.json']) {
        const anon = await f.request(path, { headers: { cookie: '' } }); assert.equal(anon.status, 302); assert.equal(anon.headers.get('location'), '/login.html');
        f.role('installer'); assert.equal((await f.request(path)).status, 403); f.role('admin');
        const result = await f.request(path); assert.equal(result.status, 200); assert.equal(result.headers.get('cache-control'), 'no-store'); await result.arrayBuffer();
    }
    const page = await f.request('/modules/ocpp/'); assert.match(page.headers.get('content-security-policy'), /script-src 'self'/); assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
    assert.match(await page.text(), /zuerst deaktivieren und vollständig stoppen/);
    assert.equal((await f.request('/modules/ocpp')).headers.get('location'), '/modules/ocpp/');
    assert.equal((await f.request('/modules/ocpp/native-defaults.json')).status, 404);
    assert.equal((await f.request('/api/eos/modules/ocpp/command', { method: 'POST' })).status, 404);
    assert.equal((await f.request('/api/eos/modules/ocpp', { headers: { cookie: '' } })).status, 401);
    f.role('enduser'); assert.equal((await f.request('/api/eos/modules/ocpp')).status, 403); f.role('admin');
    f.first(true); assert.equal((await f.request('/api/eos/modules/ocpp')).status, 403); f.first(false);
    assert.equal(f.state.reads, 0, 'denied requests never read module configuration');
});

test('OCPP saves use same-origin session CSRF and expected revision; conflicts preserve saved configuration', async t => {
    const f = await createFixture(); t.after(() => f.close());
    const initial = await (await f.request('/api/eos/modules/ocpp')).json();
    const headers = { origin: f.origin, 'content-type': 'application/json', 'x-nw-csrf': initial.csrfToken };
    const body = JSON.stringify({ config: { ...initial.config, port: 9334 }, expectedConfigurationRevision: initial.configurationRevision });
    for (const bad of [{ ...headers, origin: 'https://foreign.invalid' }, { ...headers, 'x-nw-csrf': '' }, { ...headers, cookie: '' }]) {
        const response = await f.request('/api/eos/modules/ocpp', { method: 'PUT', headers: bad, body }); assert.ok([401, 403].includes(response.status));
    }
    f.role('installer'); assert.equal((await f.request('/api/eos/modules/ocpp', { method: 'PUT', headers, body })).status, 403); f.role('admin');
    assert.equal(f.state.saves.length, 0);
    assert.equal((await f.request('/api/eos/modules/ocpp', { method: 'PUT', headers, body: JSON.stringify({ config: initial.config }) })).status, 409);
    assert.equal((await f.request('/api/eos/modules/ocpp', { method: 'PUT', headers, body })).status, 200);
    assert.equal(f.state.config.port, 9334); assert.equal(f.state.config.zeroLimitBehavior, 'keepLast'); assert.equal(f.state.config.createTechnicalAliases, true);
    const conflict = await f.request('/api/eos/modules/ocpp', { method: 'PUT', headers, body }); assert.equal(conflict.status, 409); assert.doesNotMatch(await conflict.text(), /PRIVATE/);
    assert.equal(f.state.saves.length, 1);
});

test('OCPP import forwards only guarded legacy instance and exposes safe migration namespace result', async t => {
    const f = await createFixture(); t.after(() => f.close());
    const initial = await (await f.request('/api/eos/modules/ocpp')).json();
    const headers = { origin: f.origin, 'content-type': 'application/json', 'x-nw-csrf': initial.csrfToken };
    const request = instance => f.request('/api/eos/modules/ocpp/import', { method: 'POST', headers, body: JSON.stringify({ instance }) });
    assert.equal((await request('eos-admin.1.ocpp')).status, 400); assert.equal((await request('../ocpp21.0')).status, 400);
    f.role('installer'); assert.equal((await request('ocpp21.0')).status, 403); f.role('admin');
    assert.equal(f.state.imports.length, 0); assert.equal((await request('ocpp21.0')).status, 400);
    f.state.config.enabled = false; assert.equal((await request('ocpp21.0')).status, 200);
    const imported = await (await f.request('/api/eos/modules/ocpp')).json();
    assert.equal(imported.config.enabled, false); assert.equal(imported.status.namespace, 'ocpp21.0');
    const migration = await (await f.request('/api/eos/migration')).json();
    assert.deepEqual(migration.sources, [{ id: 'ocpp', source: 'ocpp21.0', namespacePreserved: true }]); assert.doesNotMatch(JSON.stringify(migration), /PRIVATE|privateKey/);
});
