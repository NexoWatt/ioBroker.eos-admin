/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
'use strict';
/** Prüft den tatsächlichen Admin-Verbindungscode mit nativer VM und Transport-Fixtures.
 * Positive ioBroker-Kompatibilität, strikte JSON-/Auth-Grenzen und tatsächlicher Abbruch.
 * Kein Nachweis für eine installierte ioBroker-Instanz oder reale Browserbedienung. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src-admin-tab/src/lib/adminConnection.ts');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, strict: true } });
assert.deepEqual((compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error), []);

function fixture(fetchImpl = async () => { throw new Error('Ungeplanter Transport'); }, overrides = {}) {
  const exports = {};
  const window = { location: { search: '?instance=2', origin: 'http://localhost:8188', protocol: 'http:', hostname: 'localhost', port: '8188', pathname: '/ems/dynamic-grid' } };
  window.top = window; window.parent = window;
  vm.runInNewContext(compiled.outputText, { exports, window, URL, URLSearchParams, AbortController, TextDecoder,
    fetch: fetchImpl, setTimeout, clearTimeout, ...overrides }, { filename });
  return { api: exports, window };
}
let checks = 0;
async function check(name, run) { await run(); checks++; console.log('PASS', name); }

(async () => {
  // Positive Auth-Fixtures stammen vom tatsächlich ausgelieferten HTTP-Server,
  // einschließlich Profil, kanonischem Konto und sitzungsgebundenem CSRF. Dadurch
  // können die Negativtests nicht wegen eines schon ungültigen Basis-DTO bestehen.
  const { createHarness } = require('./verify-stable-1.0.9-access.cjs');
  const harness = await createHarness();
  let adminStatus; let installerStatus; let anonymousStatus;
  try {
    anonymousStatus = (await harness.request('/api/auth/status')).data;
    adminStatus = (await harness.request('/api/auth/status', { token: await harness.login('admin') })).data;
    installerStatus = (await harness.request('/api/auth/status', { token: await harness.login('installer') })).data;
  } finally { await harness.close(); }
  await check('ServConn erhält beide Callbackformen, native/common und Schreibfehler', async () => {
    const { api, window } = fixture();
    let mode = 'one';
    window.servConn = {
      getObject(id, cb) { const object = { _id: id, native: { port: 9191 }, common: { message: 'gewöhnliches Datenfeld' } }; if (mode === 'one') cb(object); else cb(null, object); },
      getState(id, cb) { cb(null, { val: false, ack: true }); },
      setObject(id, object, cb) { cb(null); },
    };
    const connection = await api.getAdminConnection();
    assert.equal(connection.type, 'servConn');
    for (mode of ['one', 'two']) assert.equal((await api.getObject('device', connection)).common.message, 'gewöhnliches Datenfeld');
    assert.equal((await api.getState('device', connection)).val, false);
    await api.setObject('device', { native: {} }, connection);
    window.servConn.setObject = (id, object, cb) => cb('Schreiben abgelehnt');
    await assert.rejects(api.setObject('device', {}, connection), value => value === 'Schreiben abgelehnt');
    window.servConn.getObject = (id, cb) => cb({ message: 'Lesen abgelehnt' });
    await assert.rejects(api.getObject('device', connection), error => error.message === 'Lesen abgelehnt');
  });
  await check('Socket und callable socket.io factory behalten den ioBroker-Vertrag', async () => {
    const { api, window } = fixture();
    const socket = { emit(event, id, callback, writeCallback) {
      if (event === 'getObject') callback(null, { _id: id, native: { port: 8189 } });
      else if (event === 'getState') callback({ val: 'state-value', ack: true });
      else writeCallback({ error: 'Schreiben abgelehnt' });
    } };
    window.io = Object.assign(() => {}, { connect: () => socket });
    const connection = await api.getAdminConnection();
    assert.equal(connection.type, 'socket');
    assert.equal((await api.getObject('device', connection)).native.port, 8189);
    assert.equal((await api.getState('device', connection)).val, 'state-value');
    await assert.rejects(api.setObject('device', {}, connection), value => value === 'Schreiben abgelehnt');
  });
  await check('UUID-Fallback und gültige alte Textports bleiben erhalten, ungültige Ports nicht', async () => {
    const { api } = fixture();
    let value = '9191';
    const connection = { type: 'servConn', getObject(id, cb) { cb(null, { native: id === 'system.meta.uuid' ? { uuid: 'legacy-system-uuid' } : { port: value } }); }, getState(id, cb) { cb(null, { val: 'state-uuid' }); }, setObject(id, object, cb) { cb(null); } };
    assert.equal(await api.readSystemUuid(connection, '2'), 'legacy-system-uuid');
    for (value of [9191, '9191', ' 9191 ']) assert.equal(await api.readAdapterPort('2', connection), 9191);
    for (value of [null, false, true, '', 0, -1, 1.5, 65536, '1e3', {}, []]) assert.equal(await api.readAdapterPort('2', connection), 8188);
    connection.getObject = (id, cb) => cb(null, null);
    assert.equal(await api.readSystemUuid(connection, '2'), 'state-uuid');
  });
  await check('Authvalidierung behält Erweiterungen und verweigert falsche Datentypen', () => {
    const { api } = fixture();
    const good = { ...adminStatus, extension: { values: [1, true, null] } };
    assert.equal(api.parseRuntimeAuthStatus(good).extension.values[0], 1);
    assert.equal(Object.getPrototypeOf(api.parseRuntimeAuthStatus(good).extension), null);
    for (const bad of [{ ...good, authed: 'true' }, { ...good, capabilities: [1] }, { ...good, enabled: undefined },
      { ...good, role: null }, { ...good, user: {} }, { ...good, user: null }, { ...good, mode: undefined },
      { ...good, mode: 'automatic' }, { ...good, configured: false }, { ...good, csrfToken: '' },
      { ...good, authenticated: false }]) assert.throws(() => api.parseRuntimeAuthStatus(bad));
    assert.equal(api.parseRuntimeAuthStatus(anonymousStatus).user, null);
    assert.equal(api.parseRuntimeAuthStatus(anonymousStatus).csrfToken, '');
  });
  await check('Poison Keys, Zyklen und unbeschränkte Verschachtelung scheitern vollständig', () => {
    const { api } = fixture();
    const good = { ...adminStatus };
    for (const key of ['__proto__', 'prototype', 'constructor']) {
      const value = JSON.parse(JSON.stringify(good));
      Object.defineProperty(value, key, { value: { polluted: true }, enumerable: true });
      assert.throws(() => api.parseRuntimeAuthStatus(value));
    }
    const cyclic = { ...good }; cyclic.extension = cyclic;
    assert.throws(() => api.parseRuntimeAuthStatus(cyclic));
    const deep = { ...good }; let cursor = deep;
    for (let i = 0; i < 45; i++) { cursor.extension = {}; cursor = cursor.extension; }
    assert.throws(() => api.parseRuntimeAuthStatus(deep));
    assert.equal({}.polluted, undefined);
  });
  await check('Status/Login verwenden die validierten Authfelder und bewahren Credentials-Option', async () => {
    const seen = [];
    const { api } = fixture(async (url, options) => {
      seen.push({ url, options });
      return Response.json(installerStatus);
    });
    assert.equal((await api.readRuntimeAuthStatus()).role, 'installer');
    assert.equal((await api.loginRuntimeAuth('2', ' installer ', 'synthetic-test-value')).user, installerStatus.user);
    assert.equal(seen[0].options.credentials, 'include');
    assert.equal(seen[1].options.method, 'POST');
    assert.equal(JSON.parse(seen[1].options.body).user, 'installer');
  });
  await check('Auch defekte HTTP403-Antworten behalten Status und unterbinden Port-Fallbacks', async () => {
    let calls = 0;
    const { api } = fixture(async () => { calls++; return new Response('<html>abgelehnt</html>', { status: 403 }); });
    for (const operation of [() => api.dynamicGridRequest('/config', {}), () => api.meshCoordinatorRequest('/config'), () => api.notificationMailRequest({})]) {
      const before = calls;
      await assert.rejects(operation(), error => api.getErrorStatus(error) === 403 && error.message === 'HTTP 403');
      assert.equal(calls - before, 1);
    }
  });
  await check('Vollständige JSON-Erweiterungen bleiben erhalten; falsches Top-Level wird verworfen', async () => {
    const data = { ok: true, config: { futureField: { values: [true, 3, 'retained'] } } };
    const valid = fixture(async () => Response.json(data)).api;
    const returned = await valid.dynamicGridRequest('/config');
    assert.equal(returned.config.futureField.values[2], 'retained');
    assert.equal(Object.getPrototypeOf(returned.config), null);
    const calls = [];
    const malformed = fixture(async (url, options) => {
      calls.push({ url, options });
      return Response.json(url.endsWith('/api/auth/status') ? installerStatus : ['unexpected']);
    }).api;
    await assert.rejects(malformed.dynamicGridRequest('/config', {}), error => error.message === 'Ungültige API-Antwort.');
    assert.equal(calls.length, 2, 'Eine Auth-/CSRF-Prüfung und genau eine Mutation');
    assert.equal(calls.filter(call => call.options.method === 'POST').length, 1, 'Eine eventuell schon gespeicherte Mutation wird nicht erneut gesendet');
    assert.equal(calls[1].options.headers['X-NW-CSRF'], installerStatus.csrfToken);
  });
  await check('Timeout bricht auch das Lesen des Antwortkörpers tatsächlich ab', async () => {
    let abortTimer;
    let aborted = false;
    const { api } = fixture(async (url, options) => {
      if (url.endsWith('/api/auth/status')) return Response.json(installerStatus);
      options.signal.addEventListener('abort', () => { aborted = true; }, { once: true });
      return new Response(new ReadableStream({ cancel() {} }));
    }, { setTimeout(fn) { abortTimer = fn; return 1; }, clearTimeout() {} });
    const pending = api.dynamicGridRequest('/config', {});
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(typeof abortTimer, 'function');
    abortTimer();
    await assert.rejects(pending, error => error.payload?.error === 'runtime_timeout' && error.status === 0);
    assert.equal(aborted, true);
  });
  console.log(JSON.stringify({ result: 'PASS', checks, node: process.version,
    sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    limitation: 'Originaler TypeScript-Verbindungscode mit VM/Transport-Fixtures; installierte ioBroker-Instanz und Browser separat prüfen.' }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
