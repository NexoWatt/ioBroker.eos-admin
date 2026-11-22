#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft die tatsächliche Admin-Transportquelle gegen kontrollierte HTTP-/Proxyverträge.
 * Daten und Wirkung: TypeScript im Speicher; synthetische Kontowerte und native Fetch-Streams.
 * Bei Änderungen: HTTPS ohne Downgrade, Instanzbindung, Cookiepfad und Fehlersemantik gemeinsam prüfen.
 * Grenze: Kein Ersatz für einen realen Admin-8-/Browser-/Reverse-Proxy-Test.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src-admin-tab/src/lib/adminConnection.ts');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const csrfToken = crypto.randomBytes(32).toString('base64url');
const status = () => ({ ok: true, enabled: true, protectWrites: true, configured: true, mode: 'iobroker',
  authed: true, authenticated: true, role: 'admin', roles: ['admin'], user: 'operator',
  groups: ['system.group.administrator'], capabilities: ['*'], csrfToken, loginUrl: null, logoutUrl: null });
function fixture({ location = {}, fetchImpl, globals = {}, socketPath, object } = {}) {
  const exports = {};
  const requests = [];
  const objectReads = [];
  const window = { location: { protocol: 'https:', hostname: 'eos.example', port: '8443', pathname: '/adapter/nexowatt-ui/react/index.html', search: '?instance=2', ...location } };
  // Browser-origin is authoritative for the new same-origin write boundary.
  // Preserve deliberately malformed pathname fixtures without URL-normalizing them.
  window.location.origin = new URL(window.location.protocol + '//' + window.location.hostname + (window.location.port ? ':' + window.location.port : '')).origin;
  window.parent = window; window.top = window;
  if (socketPath !== undefined) window.socketPath = socketPath;
  window.servConn = {
    getObject(id, callback) { objectReads.push(id); callback(null, object === undefined ? { _id: id, native: { port: 9191 } } : object); },
    setObject(id, value, callback) { callback(null); },
  };
  vm.runInNewContext(compiled, { exports, window, URL, URLSearchParams, AbortController, TextDecoder, setTimeout, clearTimeout,
    fetch: async (url, options) => { requests.push({ url, options }); return fetchImpl ? fetchImpl(url, options) : Response.json(status()); },
    ...globals }, { filename });
  return { api: exports, window, requests, objectReads };
}
let checks = 0;
async function check(name, run) { await run(); checks++; console.log('PASS ' + name); }
const rejectCode = (promise, code) => assert.rejects(promise, error => error.payload?.error === code);
const flush = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  await check('HTTPS-Admin verwendet seinen eigenen Origin und den offiziellen Instanzproxy', async () => {
    const f = fixture();
    assert.equal((await f.api.readRuntimeAuthStatus()).role, 'admin');
    assert(f.requests[0].url.startsWith('https://eos.example:8443/proxy/nexowatt-ui.2/api/strict-auth/status?'));
    assert.equal(f.objectReads.length, 0);
    assert.equal(f.requests[0].options.credentials, 'include');
    assert.equal(f.requests[0].options.redirect, 'error');
    assert.equal(f.api.buildRuntimeBaseUrl(8188), 'https://eos.example:8443/proxy/nexowatt-ui.2');
  });
  await check('Admin-Prefix bleibt bei allen geschützten API-Aufrufen und Links erhalten', async () => {
    const f = fixture({ location: { pathname: '/eos/admin/adapter/nexowatt-ui/react/index.html' }, socketPath: '/eos/admin/' });
    await f.api.readRuntimeAuthStatus();
    await f.api.loginRuntimeAuth('2', ' operator ', 'individual synthetic value');
    await f.api.readRuntimeLicenseInfo();
    await f.api.saveRuntimeLicenseKey('2', 'synthetic license');
    await f.api.notificationMailRequest();
    await f.api.meshCoordinatorRequest('/config');
    await f.api.dynamicGridRequest('/status');
    await f.api.partnerIntegrationsRequest('/config');
    await f.api.logoutRuntimeAuth();
    assert.equal(f.requests.length, 11, 'nine operations plus fresh CSRF status before license save and logout');
    assert(f.requests.every(entry => entry.url.startsWith('https://eos.example:8443/eos/admin/proxy/nexowatt-ui.2/api/') && entry.options.credentials === 'include'));
    assert.equal(JSON.parse(f.requests[1].options.body).password, 'individual synthetic value');
    assert.equal(JSON.parse(f.requests[1].options.body).user, 'operator');
    const writes = f.requests.filter(entry => entry.options.method === 'POST');
    assert.equal(writes.length, 3);
    assert.equal(writes[0].options.headers['X-NW-CSRF'], undefined, 'password login does not require a previous session');
    assert(writes.slice(1).every(entry => entry.options.headers['X-NW-CSRF'] === csrfToken), 'authenticated mutations use only the freshly returned CSRF token');
  });
  await check('Server-Prefix aus übergeordnetem Adminfenster stimmt mit Iframepfad überein', async () => {
    const f = fixture({ location: { pathname: '/office/adapter/nexowatt-ui/tab.html' } });
    f.window.parent = { socketPath: '/office/' };
    assert.equal(await f.api.resolveRuntimeBaseUrl(), 'https://eos.example:8443/office/proxy/nexowatt-ui.2');
  });
  await check('Bereits proxied React-Seiten bleiben auf demselben Cookie- und Instanzpfad', async () => {
    const f = fixture({ location: { pathname: '/office/proxy/nexowatt-ui.2/mail-setup/' } });
    await f.api.loginRuntimeAuth('2', 'operator', 'synthetic value');
    assert(f.requests[0].url.startsWith('https://eos.example:8443/office/proxy/nexowatt-ui.2/api/strict-auth/login?'));
    await rejectCode(f.api.loginRuntimeAuth('3', 'operator', 'synthetic value'), 'runtime_instance_mismatch');
    assert.equal(f.requests.length, 1);
  });
  await check('Proxy-Fachseiten ohne Instanzquery übernehmen ausschließlich die Pfadinstanz', async () => {
    const f = fixture({ location: { pathname: '/office/proxy/nexowatt-ui.7/ems/dynamic-grid', search: '?embedded=1' } });
    assert.equal(f.api.getInstance(), '7');
    await f.api.readRuntimeAuthStatus();
    assert(f.requests[0].url.startsWith('https://eos.example:8443/office/proxy/nexowatt-ui.7/api/strict-auth/status?instance=7'));
  });
  await check('HTTP-Admin liest nur den konfigurierten Instanzport und sendet keine Passwörter portübergreifend', async () => {
    const f = fixture({ location: { protocol: 'http:', port: '8081' } });
    await f.api.readRuntimeAuthStatus();
    assert.equal(f.requests.length, 1);
    assert(f.requests[0].url.startsWith('http://eos.example:9191/api/strict-auth/status?instance=2'));
    assert.deepEqual(f.objectReads, ['system.adapter.nexowatt-ui.2']);
    await rejectCode(f.api.loginRuntimeAuth('2', 'operator', 'synthetic own password'), 'runtime_same_origin_required');
    assert.equal(f.requests.length, 1, 'origin boundary blocks the password before HTTP transport');
    assert(!f.requests.some(entry => entry.url.includes(':8188/')));
  });
  await check('Native HTTPS-Instanz liefert HTTPS-Ziel und Loginlink ohne fremden Passwort-/Schreibtransport', async () => {
    const object = { _id: 'system.adapter.nexowatt-ui.2', native: { port: '9191', secure: true } };
    const f = fixture({ location: { protocol: 'http:', port: '8081' }, object });
    const target = await f.api.readAdapterRuntimeTarget('2');
    assert.equal(target.port, 9191); assert.equal(target.secure, true);
    assert.equal(f.api.buildRuntimeBaseUrl(target), 'https://eos.example:9191');
    assert.equal(await f.api.resolveRuntimeLoginUrl('2'), 'https://eos.example:9191/login.html');
    await f.api.readRuntimeAuthStatus();
    assert.equal(f.requests.length, 1);
    assert(f.requests[0].url.startsWith('https://eos.example:9191/api/strict-auth/status?instance=2'));
    await rejectCode(f.api.loginRuntimeAuth('2', 'operator', 'synthetic password'), 'runtime_same_origin_required');
    await rejectCode(f.api.saveRuntimeLicenseKey('2', 'synthetic license'), 'runtime_same_origin_required');
    assert.equal(f.requests.length, 1, 'kein Login, CSRF-Abruf oder Schreiben an einen fremden Origin');
    object.native.secure = false;
    assert.equal(await f.api.resolveRuntimeBaseUrl('2'), 'http://eos.example:9191', 'aktuelles Instanzobjekt statt verborgenem URL-Cache');
    assert(f.objectReads.every(id => id === 'system.adapter.nexowatt-ui.2'));
  });
  await check('Ungültige TLS-Konfiguration wird nicht still auf HTTP zurückgesetzt', async () => {
    for (const secure of ['true', 'false', 1, 0, null, {}, []]) {
      const f = fixture({ location: { protocol: 'http:' }, object: { _id: 'system.adapter.nexowatt-ui.2', native: { port: 9191, secure } } });
      await rejectCode(f.api.readRuntimeAuthStatus(), 'runtime_target_invalid');
      assert.equal(f.requests.length, 0);
    }
  });
  await check('Standardport gilt nur für vorhandene Instanz ohne Portfeld, nie bei Lesefehlern', async () => {
    const f = fixture({ location: { protocol: 'http:' }, object: { _id: 'system.adapter.nexowatt-ui.2', native: {} } });
    await f.api.readRuntimeAuthStatus();
    assert(f.requests[0].url.startsWith('http://eos.example:8188/'));
    f.window.servConn.getObject = (_id, callback) => callback('synthetic read failure');
    await rejectCode(f.api.loginRuntimeAuth('2', 'operator', 'synthetic value'), 'runtime_target_unavailable');
    assert.equal(f.requests.length, 1);
  });
  await check('Fehlende, fremde und ungültige Instanzobjekte erlauben keinen Passworttransport', async () => {
    for (const object of [null, { _id: 'system.adapter.nexowatt-ui.0', native: { port: 8188 } }, { _id: 'system.adapter.nexowatt-ui.2' }]) {
      const f = fixture({ location: { protocol: 'http:' }, object });
      await rejectCode(f.api.loginRuntimeAuth('2', 'operator', 'synthetic value'), 'runtime_target_invalid');
      assert.equal(f.requests.length, 0);
    }
  });
  await check('Ungültige konfigurierte Ports werden nicht auf 8188 umgedeutet', async () => {
    for (const port of [null, false, 0, -1, 65536, 1.5, '1e3', {}, []]) {
      const f = fixture({ location: { protocol: 'http:' }, object: { _id: 'system.adapter.nexowatt-ui.2', native: { port } } });
      await rejectCode(f.api.loginRuntimeAuth('2', 'operator', 'synthetic value'), 'runtime_port_invalid');
      assert.equal(f.requests.length, 0);
    }
  });
  await check('Eingebettete direkte HTTP-/HTTPS-Seiten verwenden ihren vorhandenen Origin', async () => {
    for (const protocol of ['http:', 'https:']) {
      for (const pathname of ['/ems/dynamic-grid', '/ems/nvp/', '/ems/microgrid/', '/ems/arbitrage/', '/ems/partner-integrations/', '/mail-setup/', '/mesh-setup/']) {
        const f = fixture({ location: { protocol, port: '9191', pathname } });
        await f.api.readRuntimeAuthStatus();
        assert(f.requests[0].url.startsWith(protocol + '//eos.example:9191/api/'), pathname);
        assert.equal(f.objectReads.length, 0);
      }
    }
  });
  await check('Direkte HTTPS-Runtime behält gleichursprüngliche Anmeldung und CSRF-Schreibschutz', async () => {
    const f = fixture({ location: { protocol: 'https:', port: '9191', pathname: '/ems/dynamic-grid/' } });
    await f.api.loginRuntimeAuth('2', 'operator', 'synthetic own password');
    await f.api.saveRuntimeLicenseKey('2', 'synthetic license');
    assert.equal(f.requests.length, 3, 'Login, bestätigter CSRF-Status, geschützter Schreibaufruf');
    assert(f.requests.every(entry => new URL(entry.url).origin === 'https://eos.example:9191'));
    assert.equal(f.requests[0].options.headers['X-NW-CSRF'], undefined);
    assert.equal(f.requests[2].options.headers['X-NW-CSRF'], csrfToken);
    assert.equal(f.objectReads.length, 0);
  });
  await check('Geschützte Runtime-Seiten behalten Auth-Gates ohne historischen Admin-Port-Sprung', async () => {
    for (const [file, capability] of [['ems-apps.html', 'appcenter.open'], ['simulation.html', 'simulation.open']]) {
      const html = fs.readFileSync(path.resolve(__dirname, '../www', file), 'utf8');
      assert.doesNotMatch(html, /<script\b[^>]*src=["'][^"']*admin-guard\.js/i, file);
      assert.match(html, /<script\b[^>]*src=["']\/static\/auth\.js["']/i, file);
      assert(html.indexOf('src="/static/runtime-base.js"') >= 0
        && html.indexOf('src="/static/runtime-base.js"') < html.indexOf('src="/static/auth.js"'), file + ': Runtime-Pfad vor Sitzungs-/CSRF-Initialisierung');
      assert(html.includes('data-nw-required-capability="' + capability + '"'), file);
    }
  });
  await check('Alter Admin-Lizenzeinstieg behält Ursprung und Instanz ohne Port-Fallback oder Lizenz-Redirectschleife', async () => {
    const html = fs.readFileSync(path.resolve(__dirname, '../admin/license.html'), 'utf8');
    const source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match => match[1]).join('\n');
    const run = query => {
      const nodes = { status: { textContent: '' }, installerLink: { hidden: true } };
      const location = new URL('https://eos.example:8443/office/adapter/nexowatt-ui/license.html' + query);
      const redirects = []; location.replace = value => redirects.push(value);
      vm.runInNewContext(source, { window: { location }, URLSearchParams, document: { getElementById: id => nodes[id] || null } });
      assert.equal(redirects.length, 0, 'kein automatischer Wechsel auf einen geratenen Runtime-Port');
      return { nodes, location };
    };
    for (const instance of ['0', '2', '999999']) {
      const f = run('?instance=' + instance + '&runtimePort=1&adminUrl=https://foreign.example/');
      assert.equal(f.nodes.installerLink.hidden, false);
      assert.equal(new URL(f.nodes.installerLink.href, f.location.href).href, 'https://eos.example:8443/office/adapter/nexowatt-ui/react/index.html?instance=' + instance + '#/installer');
    }
    const absent = run(''); assert(absent.nodes.installerLink.href.includes('instance=0'));
    for (const instance of ['', '-1', '02', '1e3', '1000000', '../0']) {
      const f = run('?instance=' + encodeURIComponent(instance));
      assert.equal(f.nodes.installerLink.hidden, true); assert.equal(f.nodes.installerLink.href, undefined);
      assert.match(f.nodes.status.textContent, /ungültig/);
    }
  });
  await check('Unbekannter HTTPS-Kontext erhält keinen unverschlüsselten Rückfall', async () => {
    const f = fixture({ location: { pathname: '/unknown/index.html' } });
    await rejectCode(f.api.loginRuntimeAuth('2', 'operator', 'synthetic value'), 'runtime_secure_route_required');
    assert.equal(f.requests.length, 0);
  });
  await check('Instanzkennungen sind kanonische begrenzte Dezimalwerte', async () => {
    for (const instance of ['-1', '02', '1000000', '../0', '0/evil', 'http://evil', '2?redirect=evil', ' 2']) {
      const f = fixture();
      await rejectCode(f.api.loginRuntimeAuth(instance, 'operator', 'synthetic value'), 'runtime_instance_invalid');
      assert.equal(f.requests.length, 0);
    }
    const f = fixture();
    assert.equal(f.api.getRuntimeProxyBase('999999'), 'https://eos.example:8443/proxy/nexowatt-ui.999999');
  });
  await check('Admin-Prefix erlaubt keine fremden URLs, Traversal oder mehrdeutige Pfade', async () => {
    for (const prefix of ['//evil/', '/./', '/../', '/a//b/', '/%2e%2e/', '/a\\b/']) {
      const f = fixture({ location: { pathname: prefix + 'adapter/nexowatt-ui/react/index.html' } });
      await rejectCode(f.api.readRuntimeAuthStatus(), 'runtime_path_invalid');
      assert.equal(f.requests.length, 0);
    }
    const f = fixture({ socketPath: 'https://evil/' });
    await rejectCode(f.api.readRuntimeAuthStatus(), 'runtime_path_invalid');
    const mismatch = fixture({ socketPath: '/other/' });
    await rejectCode(mismatch.api.readRuntimeAuthStatus(), 'runtime_path_mismatch');
  });
  await check('Proxy-Prefixgrenzen gelten einschließlich Instanzsuffix und für höchstens 16 öffentliche Segmente', async () => {
    const shortSegments = '/' + Array(16).fill('a').join('/') + '/';
    const accepted = fixture({ location: { pathname: shortSegments + 'adapter/nexowatt-ui/react/index.html' } });
    await accepted.api.readRuntimeAuthStatus();
    assert.equal(accepted.requests.length, 1);
    const fullLimit = '/' + 'a'.repeat(128) + '/' + 'b'.repeat(256 - 131 - 'proxy/nexowatt-ui.2'.length) + '/';
    const exact = fixture({ location: { pathname: fullLimit + 'adapter/nexowatt-ui/react/index.html' } });
    assert.equal(exact.api.getRuntimeProxyBase().length - 'https://eos.example:8443'.length, 256);
    for (const prefix of ['/' + Array(17).fill('a').join('/') + '/', '/' + 'a'.repeat(129) + '/', fullLimit + 'c/']) {
      const f = fixture({ location: { pathname: prefix + 'adapter/nexowatt-ui/react/index.html' } });
      await rejectCode(f.api.readRuntimeAuthStatus(), 'runtime_path_invalid');
      assert.equal(f.requests.length, 0);
    }
  });
  await check('Verschachtelte Proxy-Namensräume und Proxysegmente im Admin-Prefix bleiben ohne Passwortübertragung gesperrt', async () => {
    for (const pathname of ['/proxy/nexowatt-ui.1/nest/proxy/nexowatt-ui.2/mail-setup/', '/proxy/nexowatt-ui.2/nest/proxy/nexowatt-ui.2/mail-setup/', '/proxy/nexowatt-ui.2/nest/adapter/nexowatt-ui/react/index.html']) {
      for (const search of ['?instance=2', '']) {
        const f = fixture({ location: { pathname, search } });
        await rejectCode(f.api.loginRuntimeAuth(f.api.getInstance(), 'operator', 'synthetic value'), 'runtime_path_invalid');
        assert.equal(f.requests.length, 0);
      }
    }
    const f = fixture({ socketPath: '/proxy/nexowatt-ui.2/' });
    await rejectCode(f.api.readRuntimeAuthStatus(), 'runtime_path_invalid');
    assert.equal(f.requests.length, 0);
  });
  await check('Endpoint-Queryparameter können das aus dem Adminpfad ermittelte Ziel nicht ändern', async () => {
    const f = fixture({ location: { search: '?instance=2&runtimeUrl=https://evil/&port=9999' } });
    await f.api.loginRuntimeAuth('2', 'operator', 'synthetic value');
    assert(f.requests[0].url.startsWith('https://eos.example:8443/proxy/nexowatt-ui.2/'));
  });
  for (const [statusCode, code] of [[401, 'admin_proxy_auth_required'], [403, 'admin_proxy_forbidden'], [404, 'admin_proxy_unavailable'], [502, 'runtime_unreachable']]) {
    await check(`Admin-Proxy HTTP ${statusCode} bleibt von EOS-Kontofehlern unterscheidbar`, async () => {
      const f = fixture({ fetchImpl: async () => new Response('untrusted upstream text', { status: statusCode }) });
      await rejectCode(f.api.loginRuntimeAuth('2', 'operator', 'synthetic value'), code);
      assert.equal(f.requests.length, 1);
    });
  }
  await check('JSON-EOS401 bleibt Passwortablehnung; kein anderer Port oder zweiter Versuch', async () => {
    const f = fixture({ fetchImpl: async () => Response.json({ ok: false, error: 'unauthorized' }, { status: 401 }) });
    await assert.rejects(f.api.loginRuntimeAuth('2', 'operator', 'synthetic value'), error => error.status === 401 && error.payload.error === 'unauthorized');
    assert.equal(f.requests.length, 1);
  });
  await check('Netzwerkfehler geben keine fremden Fehlertexte aus und werden nicht wiederholt', async () => {
    const f = fixture({ fetchImpl: async () => { throw new Error('private upstream text'); } });
    await assert.rejects(f.api.loginRuntimeAuth('2', 'operator', 'synthetic value'), error => error.payload.error === 'runtime_network_error' && !error.message.includes('private'));
    assert.equal(f.requests.length, 1);
  });
  await check('Status und Login besitzen endliche 6-/12-s-Fristen und brechen echte Fetch-Signale ab', async () => {
    for (const [method, maximum] of [['readRuntimeAuthStatus', 6000], ['loginRuntimeAuth', 12000]]) {
      let timeout; let duration; let aborted = false;
      const f = fixture({ globals: { setTimeout(fn, ms) { timeout = fn; duration = ms; return 1; }, clearTimeout() {} },
        fetchImpl: async (_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => { aborted = true; reject(new DOMException('aborted', 'AbortError')); })) });
      const pending = method === 'loginRuntimeAuth' ? f.api.loginRuntimeAuth('2', 'operator', 'synthetic value') : f.api.readRuntimeAuthStatus();
      await flush();
      assert(duration > maximum - 100 && duration <= maximum);
      timeout();
      await rejectCode(pending, 'runtime_timeout');
      assert.equal(aborted, true); assert.equal(f.requests.length, 1);
    }
  });
  await check('Timeout umfasst auch einen hängenden Antwortkörper', async () => {
    let timeout; let cancelled = false;
    const f = fixture({ globals: { setTimeout(fn) { timeout = fn; return 1; }, clearTimeout() {} }, fetchImpl: async () => new Response(new ReadableStream({ cancel() { cancelled = true; } })) });
    const pending = f.api.readRuntimeAuthStatus(); await flush(); timeout();
    await rejectCode(pending, 'runtime_timeout'); assert.equal(cancelled, true);
  });
  await check('Gültiger HTTP-Transport ohne gültigen EOS-Status schaltet keine Sitzung frei', async () => {
    const f = fixture({ fetchImpl: async () => Response.json({ ok: true }) });
    await assert.rejects(f.api.loginRuntimeAuth('2', 'operator', 'synthetic value'), error => error.message === 'Ungültiger EOS-Anmeldestatus.');
  });
  await check('Beide expliziten Profile benötigen konsistente Sitzungs-, Rollen- und CSRF-Felder', async () => {
    for (const mode of ['iobroker', 'eos']) {
      const f = fixture({ fetchImpl: async () => Response.json({ ...status(), mode }) });
      const parsed = await f.api.readRuntimeAuthStatus();
      assert.equal(parsed.mode, mode); assert.equal(parsed.configured, true); assert.equal(parsed.csrfToken, csrfToken);
    }
    for (const patch of [{ mode: undefined }, { mode: 'automatic' }, { configured: undefined }, { configured: false },
      { csrfToken: undefined }, { csrfToken: 'short' }, { authenticated: false }, { user: null },
      { role: 'none' }, { role: 'superuser' }, { capabilities: ['*', 42] }]) {
      const f = fixture({ fetchImpl: async () => Response.json({ ...status(), ...patch }) });
      await assert.rejects(f.api.readRuntimeAuthStatus(), error => error.message === 'Ungültiger EOS-Anmeldestatus.');
      assert.equal(f.requests.length, 1);
    }
  });
  await check('Abgemeldeter oder unvollständiger CSRF-Status verhindert die Mutation vor jedem POST', async () => {
    for (const value of [{ ...status(), authed: false, authenticated: false, role: 'none', user: null, capabilities: [], csrfToken: null },
      { ...status(), csrfToken: undefined }, { ...status(), configured: false }]) {
      const f = fixture({ fetchImpl: async () => Response.json(value) });
      await assert.rejects(f.api.saveRuntimeLicenseKey('2', 'synthetic license'));
      assert.equal(f.requests.length, 1); assert.equal(f.requests[0].options.method, 'GET');
      assert(f.requests[0].url.endsWith('/api/auth/status')); assert.equal(f.requests[0].options.body, undefined);
    }
  });
  await check('Passwort- und Lizenzwrites auf fremdem Origin beginnen weder CSRF-Abfrage noch POST', async () => {
    for (const action of ['login', 'license']) {
      const f = fixture({ location: { protocol: 'http:', port: '8081' } });
      await rejectCode(action === 'login' ? f.api.loginRuntimeAuth('2', 'operator', 'synthetic password') : f.api.saveRuntimeLicenseKey('2', 'synthetic license'), 'runtime_same_origin_required');
      assert.equal(f.requests.length, 0);
    }
  });
  console.log(JSON.stringify({ result: 'PASS', checks, node: process.version, sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    scope: 'Actual TypeScript in VM; synthetic HTTP/proxy contracts, no live Admin8/browser integration.' }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
