#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft tatsächliche HTTP-Routen und den EOS-Sitzungsclient mit lokalen
 * Controller-/Zentralen-Fixtures. Kein Zugriff auf Kundenkonten oder Hardware.
 * Sicherheitsnachweis: Profile, CSRF, Ausfall, Widerruf, Parser und Liveframes.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { EventEmitter } = require('node:events');
const { createHarness } = require('./verify-stable-1.0.9-access.cjs');
const policy = require('../lib/ui-access-policy');
const { SseRuntimeGuard } = require('../lib/sse-runtime-guard');
let checks = 0;
const check = async (name, verify) => { await verify(); checks += 1; console.log('PASS ' + name); };
const drain = () => new Promise(resolve => setImmediate(resolve));

async function withHarness(options, verify) {
  const h = await createHarness(options);
  try {
    const request = async (url, { cookie, csrf, method = 'GET', body, headers = {}, redirect = 'manual', signal } = {}) => {
      const response = await fetch(h.base + url, { method, redirect, signal,
        headers: { ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { 'X-NW-CSRF': csrf } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
        ...(body ? { body: JSON.stringify(body) } : {}) });
      const text = await response.text();
      let data; try { data = JSON.parse(text); } catch {}
      return { response, status: response.status, data, text };
    };
    const login = async user => {
      const result = await request('/api/auth/login', { method: 'POST', body: { user, password: h.testPassword } });
      assert.equal(result.status, 200, result.text);
      const cookie = result.response.headers.get('set-cookie').split(';')[0];
      assert.match(cookie, /^nw_ui_[a-f0-9]{20}=/);
      return { cookie, csrf: result.data.csrfToken, token: decodeURIComponent(cookie.slice(cookie.indexOf('=') + 1)), result };
    };
    await verify({ ...h, request, login });
  } finally { await h.close(); }
}

async function main() {
  await check('Cookie-Parser: Mehrdeutigkeit, Kodierung und Grenzen werden geschlossen behandelt', () => {
    for (const cookie of ['nw_ui_x=one; nw_ui_x=two', 'access_token=%zz', 'a=x'.repeat(4000), Array(66).fill('a=b').join(';')]) {
      assert.equal(Object.keys(policy.parseUiCookies({ headers: { cookie } })).length, 0);
    }
    assert.equal(policy.parseUiCookies({ headers: { cookie: 'safe=a%20b' } }).safe, 'a b');
    assert.equal(Object.getPrototypeOf(policy.parseUiCookies({})), null);
  });
  await check('Profil und Instanz trennen Cookies; unbekanntes Profil bleibt gesperrt', () => {
    const bindings = [['nexowatt-ui.0', 8188, {}], ['nexowatt-ui.1', 8188, {}], ['nexowatt-ui.0', 8189, {}], ['nexowatt-ui.0', 8188, { mode: 'eos' }]].map(args => policy.uiSessionCookieName(policy.uiSessionBinding(...args)));
    assert.equal(new Set(bindings).size, 4);
    assert.equal(policy.uiAuthMode({ mode: 'automatic' }), 'blocked');
  });
  await check('HTTPS-Proxyhinweis benötigt tatsächlichen freigegebenen Peer', () => {
    const req = { socket: { remoteAddress: '203.0.113.9' }, headers: { 'x-forwarded-proto': 'https' } };
    assert.equal(policy.secureUiTransport(req, [], true), false);
    assert.equal(policy.secureUiTransport(req, ['203.0.113.9'], true), true);
    assert.equal(policy.secureUiTransport(req, ['203.0.113.9'], false), false);
    assert.equal(policy.secureUiTransport({ ...req, socket: { remoteAddress: '127.0.0.1' } }, [], true), true);
  });
  await check('CORS und CSRF vergleichen exakte Origins einschließlich Port und Schema', () => {
    const req = { socket: { remoteAddress: '203.0.113.9' }, headers: { host: 'eos.example:8188', origin: 'http://eos.example:49999' } };
    assert.equal(policy.uiOriginAllowed(req, [], [], false), false);
    assert.equal(policy.uiOriginAllowed(req, ['http://eos.example:49999'], [], false), true);
    assert.equal(policy.uiOriginAllowed({ ...req, headers: { ...req.headers, origin: 'http://eos.example:8188' } }, [], [], false), true);
    assert.equal(policy.uiOriginAllowed({ ...req, headers: { ...req.headers, origin: 'https://eos.example:8188' } }, [], [], false), false);
    assert.equal(policy.uiOriginAllowed({ ...req, headers: { ...req.headers, origin: 'null' } }, [], [], false), false);
  });
  await check('Neue/unbekannte und kodierte Datenpfade sind standardmäßig geschützt', () => {
    for (const pathname of ['/api/new-feature', '/config', '/events', '/static/smarthome.html', '/static/%73marthome.html', '/static/%5csmarthome-config.html', '/static/../config', '/static/api/private.svg']) {
      assert.equal(policy.isPublicUiRequest({ path: pathname, method: 'GET' }), false, pathname);
    }
    assert.equal(policy.isPublicUiRequest({ path: '/static/login.js', method: 'GET' }), true);
    assert.equal(policy.isIndependentMachineRequest({ path: '/api/mesh/status', method: 'GET' }), true);
    assert.equal(policy.isIndependentMachineRequest({ path: '/api/mesh/status/extra', method: 'GET' }), false);
  });
  await check('Kontobezogener Schutz wirkt trotz wechselnder Quelladressen und parallel', () => {
    let now = 1000000;
    const limiter = new policy.UiLoginLimiter(() => now);
    for (let i = 0; i < 5; i++) limiter.failure(limiter.keys('192.0.2.' + i, 'System.User.Admin'));
    assert.equal(limiter.status(limiter.keys('198.51.100.1', 'admin')).blocked, true);
    now += 30001;
    assert.equal(limiter.status(limiter.keys('198.51.100.1', 'admin')).blocked, false);
    const keys = limiter.keys('198.51.100.1', 'kunde');
    const release = limiter.acquire(keys);
    assert.equal(typeof release, 'function');
    assert.equal(limiter.acquire(limiter.keys('198.51.100.2', 'kunde')), null);
    release(); release();
    assert.equal(typeof limiter.acquire(keys), 'function');
  });
  for (const configured of [{}, { authEnabled: false, policy: 'all' }, { authEnabled: false, policy: 'lan' }]) {
    await check('Echte HTTP-Zugangsschranke auch bei Altpolicy ' + JSON.stringify(configured), () => withHarness(configured, async h => {
      for (const url of ['/api/state', '/config', '/api/history', '/api/smarthome/devices', '/api/smarthome/layout', '/events']) assert.equal((await h.request(url)).status, 401, url);
      for (const url of ['/', '/smarthome.html', '/history.html', '/static/smarthome.html', '/static/%73marthome.html']) {
        const result = await h.request(url);
        assert.equal(result.status, 303, url);
        assert.match(result.response.headers.get('location'), /^\/login\.html\?returnTo=/);
      }
      assert.equal((await h.request('/api/smarthome/toggle', { method: 'POST', body: { id: 'x' } })).status, 401);
      const status = await h.request('/api/auth/status');
      assert.equal(status.data.enabled, true); assert.equal(status.data.mode, 'iobroker');
      assert.equal(status.data.authenticated, false);
    }));
  }
  await check('Kunde bedient zugeordnetes Gerät, technische Bereiche und CSRF bleiben gesperrt', () => withHarness({}, async h => {
    const session = await h.login('kunde');
    const writes = [];
    h.adapter.smartHomeDevices = [{ id: 'light', type: 'switch', io: { switch: { readId: 'fixture.light', writeId: 'fixture.light' } }, behavior: {} }];
    h.adapter.setForeignStateAsync = async (...args) => { writes.push(args); };
    assert.equal((await h.request('/api/state', session)).status, 200);
    for (const url of ['/api/smarthome/config', '/api/smarthome/type-detect', '/api/installer/config', '/api/license/info']) assert.equal((await h.request(url, session)).status, 403, url);
    const command = { method: 'POST', body: { id: 'light', value: true }, ...session };
    assert.equal((await h.request('/api/smarthome/toggle', { ...command, csrf: undefined })).status, 403);
    assert.equal((await h.request('/api/smarthome/toggle', { ...command, csrf: 'wrong-token-long-enough' })).status, 403);
    assert.equal(writes.length, 0);
    assert.equal((await h.request('/api/smarthome/toggle', command)).status, 200);
    assert.equal(writes.length, 1); assert.equal(writes[0][0], 'fixture.light');
    assert.equal((await h.request('/api/smarthome/toggle', { ...command, headers: { Origin: 'https://untrusted.example' } })).status, 403);
    assert.equal((await h.request('/api/auth/status', { cookie: session.cookie + '; ' + session.cookie })).data.authed, false);
    const logout = await h.request('/api/auth/logout', { ...session, method: 'POST' });
    assert.equal(logout.status, 200);
    assert.equal((await h.request('/api/state', session)).status, 401);
  }));
  await check('Nachbar-Port erhält weder Credential-CORS noch CSRF oder Lizenzdaten', () => withHarness({}, async h => {
    const session = await h.login('admin');
    for (const url of ['/api/session/me', '/api/license/info']) {
      const result = await h.request(url, { ...session, headers: { Origin: 'http://127.0.0.1:49999' } });
      assert.equal(result.status, 403); assert.equal(result.response.headers.get('access-control-allow-origin'), null);
      assert.equal(result.text.includes(session.csrf), false); assert.equal(result.text.includes('private-fixture'), false);
    }
    const preflight = await h.request('/api/auth/logout', { method: 'OPTIONS', headers: { Origin: 'http://127.0.0.1:49999', 'Access-Control-Request-Method': 'POST' } });
    assert.equal(preflight.status, 403);
  }));
  await check('Kontolesefehler hat auch bei bestehender Sitzung ein gemeinsames 5-s-Budget', () => withHarness({}, async h => {
    const session = await h.login('admin');
    const original = h.adapter.getForeignObjectAsync;
    h.adapter.getForeignObjectAsync = id => id === 'system.user.admin' ? new Promise(() => {}) : original(id);
    const start = Date.now();
    assert.equal((await h.request('/api/state', session)).status, 401);
    assert.ok(Date.now() - start < 5700);
  }));
  await check('Aktivierte ioBroker-TOTP wird nicht durch einen Passwortlogin umgangen', () => withHarness({}, async h => {
    const session = await h.login('admin');
    h.accounts.get('admin').common.externalAuthentication = { totp: { secret: crypto.randomBytes(32).toString('hex') } };
    assert.equal((await h.request('/api/state', session)).status, 401);
    assert.equal((await h.request('/api/auth/login', { method: 'POST', body: { user: 'admin', password: h.testPassword } })).status, 401);
    assert.equal(h.adapter._authSessions.size, 0);
  }));
  for (const change of ['disabled', 'password', 'groups', 'expired', 'mode']) {
    await check('Sitzung widerrufen bei ' + change, () => withHarness({}, async h => {
      const session = await h.login('admin');
      if (change === 'disabled') h.accounts.get('admin').common.enabled = false;
      if (change === 'password') h.accounts.get('admin').common.password = crypto.randomBytes(32).toString('hex');
      if (change === 'groups') h.groups.get('system.group.administrator').common.members = [];
      if (change === 'expired') h.adapter._authSessions.get(session.token).exp = Date.now() - 1;
      if (change === 'mode') h.adapter.config.auth.mode = 'eos';
      assert.equal((await h.request('/api/state', session)).status, 401);
    }));
  }
  await check('SSE: Vor jedem Frame geprüft, bei Widerruf keine nachfolgenden Daten', async () => {
    let allowed = true;
    const writes = [];
    const req = new EventEmitter();
    const res = Object.assign(new EventEmitter(), { write: chunk => { writes.push(chunk); return true; }, end() { this.writableEnded = true; } });
    const guard = new SseRuntimeGuard();
    const client = guard.addClient({ req, res, authorize: async () => allowed });
    guard.write(client, 'first', { kind: 'init' });
    await drain(); assert.deepEqual(writes, ['first']);
    allowed = false;
    guard.write(client, 'private-after-revoke', { kind: 'update' });
    await drain(); assert.deepEqual(writes, ['first']); assert.equal(client.closed, true);
    guard.closeAll();
  });
  await check('SSE: Logout während laufender Prüfung verhindert verspätete Zustellung', async () => {
    let approve;
    const writes = [];
    const req = new EventEmitter();
    const res = Object.assign(new EventEmitter(), { write: chunk => { writes.push(chunk); return true; }, end() { this.writableEnded = true; } });
    const guard = new SseRuntimeGuard();
    const client = guard.addClient({ req, res, authorize: () => new Promise(resolve => { approve = resolve; }) });
    guard.write(client, 'private', { kind: 'init' });
    await drain(); guard.close(client, 'session-logout'); approve(true);
    await drain(); assert.equal(writes.length, 0); guard.closeAll();
  });

  let centralResponse = { authenticated: true, user: 'system.user.customer', role: 'enduser', groups: ['system.group.user'], mustChangePassword: false };
  let responseMode = 'valid'; let calls = 0; let suppliedCookie = '';
  const central = http.createServer((req, res) => {
    calls++; suppliedCookie = req.headers.cookie || '';
    if (responseMode === 'redirect') { res.writeHead(302, { Location: '/unexpected' }); res.end(); return; }
    if (responseMode === 'slow') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); return; }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(responseMode === 'large' ? ' '.repeat(33000) : JSON.stringify(centralResponse));
  });
  await new Promise(resolve => central.listen(0, '127.0.0.1', resolve));
  const eosConfig = { mode: 'eos', eosSessionUrl: `http://127.0.0.1:${central.address().port}/nexowatt/security/session`, eosLoginUrl: '/index.html?login', eosLogoutUrl: '/logout' };
  const centralToken = crypto.randomBytes(24).toString('base64url');
  const req = { headers: { cookie: 'access_token=' + centralToken + '; unrelated=private' } };
  try {
    await check('EOS-Client: echtes zentrales Rollenformat und ausschließlich Access-Cookie', async () => {
      const client = new policy.EosSessionClient(eosConfig, 'fixture');
      const session = await client.resolve(req);
      assert.equal(session.role, 'customer'); assert.equal(session.user, 'system.user.customer');
      assert.equal(suppliedCookie, 'access_token=' + centralToken);
      client.revoke(req); assert.equal(await client.resolve(req), null); client.close();
    });
    await check('EOS-Modus: zentrale Sitzung, kein lokaler Passwort- oder Headerfallback', () => withHarness({ authConfig: eosConfig }, async h => {
      const cookie = 'access_token=' + centralToken;
      assert.equal((await h.request('/api/state')).status, 401);
      let result = await h.request('/api/auth/status', { cookie });
      assert.equal(result.data.mode, 'eos'); assert.equal(result.data.authed, true); assert.equal(result.data.role, 'customer');
      assert.equal((await h.request('/api/state', { cookie })).status, 200);
      assert.equal((await h.request('/api/installer/config', { cookie })).status, 403);
      assert.equal((await h.request('/api/auth/login', { method: 'POST', body: { user: 'admin', password: h.testPassword } })).status, 409);
      assert.equal((await h.request('/api/state', { headers: { 'x-eos-role': 'admin', 'x-eos-user': 'admin', 'x-eos-access-secret': crypto.randomBytes(32).toString('hex') } })).status, 401);
      centralResponse = { ...centralResponse, authenticated: false };
      assert.equal((await h.request('/api/state', { cookie })).status, 401);
      centralResponse = { ...centralResponse, authenticated: true };
      result = await h.request('/api/auth/status', { cookie });
      assert.equal((await h.request('/api/auth/logout', { cookie, csrf: result.data.csrfToken, method: 'POST' })).status, 200);
      assert.equal((await h.request('/api/state', { cookie })).status, 401);
    }));
    for (const mutation of [{ authenticated: 'true' }, { mustChangePassword: true }, { user: null }, { role: 'administrator' }, { groups: [123] }]) {
      await check('EOS-Payload: strikter Vertrag ' + Object.keys(mutation)[0], async () => {
        const previous = centralResponse;
        centralResponse = { ...previous, ...mutation };
        const client = new policy.EosSessionClient(eosConfig, 'fixture');
        assert.equal(await client.resolve(req), null); client.close(); centralResponse = previous;
      });
    }
    for (const mode of ['redirect', 'large', 'slow']) {
      await check('EOS-Netzwerk: ' + mode + ' sperrt Zugang ohne Fallback', async () => {
        responseMode = mode;
        const client = new policy.EosSessionClient(eosConfig, 'fixture');
        const start = Date.now(); const previousCalls = calls;
        assert.equal(await client.resolve(req), null);
        assert.equal(calls, previousCalls + 1, 'no redirect or retry');
        assert.ok(Date.now() - start < 5700, 'shared five-second budget');
        client.close(); responseMode = 'valid';
      });
    }
    await check('Standalone ignoriert zentrale EOS-Sitzung vollständig', () => withHarness({}, async h => {
      const before = calls;
      assert.equal((await h.request('/api/state', { cookie: 'access_token=' + centralToken })).status, 401);
      assert.equal(calls, before);
    }));
  } finally { central.closeAllConnections(); await new Promise(resolve => central.close(resolve)); }
  await check('EOS-TLS: fremdes Zertifikat abgewiesen, ausdrücklich konfigurierte CA verifiziert', async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-ui-tls-'));
    let server;
    try {
      const keyFile = path.join(directory, 'temporary-key.pem');
      const certFile = path.join(directory, 'temporary-cert.pem');
      const made = spawnSync('openssl', ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', keyFile, '-out', certFile], { stdio: 'ignore' });
      assert.equal(made.status, 0, 'OpenSSL available for ephemeral local TLS fixture');
      server = https.createServer({ key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }, (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(centralResponse));
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const config = { ...eosConfig, eosSessionUrl: `https://127.0.0.1:${server.address().port}/nexowatt/security/session` };
      const untrusted = new policy.EosSessionClient(config, 'tls-fixture');
      assert.equal(await untrusted.resolve(req), null); untrusted.close();
      const trusted = new policy.EosSessionClient({ ...config, eosCaFile: certFile }, 'tls-fixture');
      assert.equal((await trusted.resolve(req)).role, 'customer'); trusted.close();
    } finally {
      if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
  console.log(JSON.stringify({ result: 'PASS', checks, node: process.version, scope: 'Shipped HTTP runtime, local controller/EOS fixtures, no plant or live EOS Admin commissioning' }));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
