/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/** Prüft die originale strikte Adminquelle mit nativen Fetch-/Stream-Fixtures.
 * Größen-, Byte-, UTF-8-, Abbruch- und Statusgrenzen vor JSON-Verwendung.
 * Keine Liveanlage, keine Geräte- oder SMTP-Verbindung und keine Zugangsdaten. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const http = require('node:http');
const zlib = require('node:zlib');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src-admin-tab/src/lib/adminConnection.ts');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true,
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, strict: true } });
assert.deepEqual((compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error), []);
let authStatusFixture;

function fixture(fetchImpl = async () => { throw new Error('Ungeplanter Transport'); }, globals = {}) {
  const exports = {};
  const window = { location: { search: '?instance=2', origin: 'http://localhost:8188', protocol: 'http:', hostname: 'localhost', port: '8188', pathname: '/ems/dynamic-grid' } };
  window.top = window; window.parent = window;
  vm.runInNewContext(compiled.outputText, { exports, window, URL, URLSearchParams, AbortController, TextDecoder,
    fetch: async (url, options) => {
      // Die echten Requestfunktionen prüfen vor Mutationen die Sitzung. Eine
      // reale lokale Loginantwort liefert diese separate Vorbedingung; das
      // jeweilige Stream-/Fehlerfixture bleibt die nachfolgende Fachantwort.
      if (url.endsWith('/api/auth/status')) {
        assert.ok(authStatusFixture, 'HTTP-Anmeldestatus muss zuvor geladen sein');
        return Response.json(authStatusFixture);
      }
      return fetchImpl(url, options);
    }, setTimeout, clearTimeout, ...globals }, { filename });
  return exports;
}

const api = fixture();
const limit = api.ADMIN_RESPONSE_MAX_BYTES;
assert.equal(limit, 16 * 1024 * 1024);
const encoder = new TextEncoder();
let checks = 0;
async function check(name, run) { await run(); checks++; console.log('PASS', name); }

function chunksResponse(chunks, headers = {}) {
  let offset = 0;
  let cancelled = 0;
  const response = new Response(new ReadableStream({
    pull(controller) {
      if (offset >= chunks.length) controller.close();
      else controller.enqueue(chunks[offset++]);
    },
    cancel() { cancelled++; },
  }, { highWaterMark: 0 }), { headers });
  return { response, cancelled: () => cancelled, pulls: () => offset };
}

(async () => {
  const { createHarness } = require('./verify-stable-1.0.9-access.cjs');
  const harness = await createHarness();
  try {
    const token = await harness.login('admin');
    authStatusFixture = (await harness.request('/api/auth/status', { token })).data;
    assert.equal(authStatusFixture.authed, true); assert.ok(authStatusFixture.csrfToken);
  } finally { await harness.close(); }
  await check('UTF-8 über Chunkgrenzen und normale Daten werden vollständig gelesen', async () => {
    const bytes = encoder.encode(JSON.stringify({ ok: true, config: { value: 'Änderung 🟢', count: 2 } }));
    const input = chunksResponse(Array.from(bytes, byte => Uint8Array.of(byte)));
    const controller = new AbortController();
    const result = await api.readBoundedApiJson(input.response, controller);
    assert.equal(result.config.value, 'Änderung 🟢');
    assert.equal(result.config.count, 2);
    assert.equal(controller.signal.aborted, false);
    assert.equal(input.response.body.locked, false);
  });
  await check('Genau 16 MiB bleiben zulässig; ein zusätzliches Byte scheitert vor JSON', async () => {
    const envelopeSize = encoder.encode(JSON.stringify({ data: '' })).byteLength;
    const exact = JSON.stringify({ data: 'x'.repeat(limit - envelopeSize) });
    assert.equal(Buffer.byteLength(exact), limit);
    const result = await api.readBoundedApiJson(new Response(exact), new AbortController());
    assert.equal(result.data.length, limit - envelopeSize);
    const controller = new AbortController();
    await assert.rejects(api.readBoundedApiJson(new Response(exact + ' '), controller), /maximal 16 MiB/);
    assert.equal(controller.signal.aborted, true);
  });
  await check('Deklarierte Übergröße bricht vor dem ersten Bodyread ab', async () => {
    const input = chunksResponse([encoder.encode('{"ok":true}')], { 'content-length': String(limit + 1) });
    const controller = new AbortController();
    await assert.rejects(api.readBoundedApiJson(input.response, controller), /maximal 16 MiB/);
    assert.equal(input.pulls(), 0);
    assert.equal(input.cancelled(), 1);
    assert.equal(input.response.body.locked, false);
    assert.equal(controller.signal.aborted, true);
  });
  await check('Fehlende oder falsche kleine Content-Length umgehen das Bytebudget nicht', async () => {
    for (const headers of [{}, { 'content-length': '2' }]) {
      let pulls = 0;
      let cancelled = 0;
      const response = new Response(new ReadableStream({
        pull(controller) { pulls++; controller.enqueue(new Uint8Array(65536)); },
        cancel() { cancelled++; },
      }, { highWaterMark: 0 }), { headers });
      const controller = new AbortController();
      await assert.rejects(api.readBoundedApiJson(response, controller), /maximal 16 MiB/);
      assert.equal(pulls, 257);
      assert.equal(cancelled, 1);
      assert.equal(controller.signal.aborted, true);
    }
  });
  await check('Ungültige Längenangaben werden kontrolliert ohne Bodyread verworfen', async () => {
    for (const value of ['', '-1', '+2', '1.5', '1e3', 'Infinity', '0x100', '9007199254740992', '1, 1']) {
      const input = chunksResponse([encoder.encode('{}')], { 'content-length': value });
      const controller = new AbortController();
      await assert.rejects(api.readBoundedApiJson(input.response, controller), /Ungültige API-Antwortgröße/);
      assert.equal(input.pulls(), 0, value);
      assert.equal(input.cancelled(), 1, value);
      assert.equal(controller.signal.aborted, true, value);
    }
  });
  await check('Content-Length wird bei komprimierten Antworten nicht mit Klartextlänge verwechselt', async () => {
    const input = chunksResponse([encoder.encode('{"ok":true,"data":"already-decoded"}')],
      { 'content-length': '12', 'content-encoding': 'gzip' });
    assert.equal((await api.readBoundedApiJson(input.response, new AbortController())).data, 'already-decoded');
  });
  await check('Ungültiges UTF-8 und defektes JSON werden abgewiesen und abgebrochen', async () => {
    for (const bytes of [Uint8Array.of(0xc3, 0x28), encoder.encode('{not-json}')]) {
      const controller = new AbortController();
      const response = new Response(bytes);
      await assert.rejects(api.readBoundedApiJson(response, controller));
      assert.equal(controller.signal.aborted, true);
      assert.equal(response.body.locked, false);
    }
  });
  await check('Bereits abgebrochene Signale lesen keine Daten', async () => {
    const controller = new AbortController(); controller.abort();
    const input = chunksResponse([encoder.encode('{}')]);
    await assert.rejects(api.readBoundedApiJson(input.response, controller), /abgebrochen/);
    assert.equal(input.pulls(), 0);
    assert.equal(input.cancelled(), 1);
  });
  await check('Ein hängender Stream endet beim tatsächlichen Fetch-Abbruch', async () => {
    let cancelled = false;
    const controller = new AbortController();
    const response = new Response(new ReadableStream({ cancel() { cancelled = true; } }));
    const pending = api.readBoundedApiJson(response, controller);
    const timer = setTimeout(() => controller.abort(), 20);
    try { await assert.rejects(pending, /abgebrochen/); }
    finally { clearTimeout(timer); }
    assert.equal(cancelled, true);
    assert.equal(response.body.locked, false);
  });
  await check('Fehler beim Cancel werden isoliert; ursprünglicher Größenfehler bleibt erhalten', async () => {
    const response = new Response(new ReadableStream({
      cancel() { return Promise.reject(new Error('synthetic-cancel-private-detail')); },
    }, { highWaterMark: 0 }), { headers: { 'content-length': String(limit + 1) } });
    await assert.rejects(api.readBoundedApiJson(response, new AbortController()), /maximal 16 MiB/);
    await new Promise(resolve => setImmediate(resolve));
  });
  await check('Echte API-Pfade behalten Null-Prototyp- und Poison-Key-Validierung', async () => {
    const valid = fixture(async () => Response.json({ ok: true, config: { values: [1, true, null, 'unverändert'] } }));
    const result = await valid.dynamicGridRequest('/config', {});
    assert.equal(result.config.values[3], 'unverändert');
    assert.equal(Object.getPrototypeOf(result.config), null);
    const poisoned = fixture(async () => new Response('{"ok":true,"config":{"__proto__":{"polluted":true}}}'));
    await assert.rejects(poisoned.dynamicGridRequest('/config', {}), /Ungültige API-Antwort/);
    assert.equal({}.polluted, undefined);
  });
  await check('HTTP403 bleibt auch bei Übergröße erhalten und wird nicht erneut gesendet', async () => {
    let calls = 0;
    const denied = fixture(async () => {
      calls++;
      return new Response('{}', { status: 403, headers: { 'content-length': String(limit + 1) } });
    });
    await assert.rejects(denied.dynamicGridRequest('/config', {}), error => error.status === 403 && error.message === 'HTTP 403');
    assert.equal(calls, 1);
  });
  await check('Übergröße auf erfolgreichem HTTP zeigt nur eine statische Grenzmeldung', async () => {
    let signal;
    const oversized = fixture(async (_url, options) => {
      signal = options.signal;
      return new Response('synthetic-private-content', { headers: { 'content-length': String(limit + 1) } });
    });
    await assert.rejects(oversized.dynamicGridRequest('/config', {}), error => error.status === 200 && error.message === 'API-Antwort ist zu groß (maximal 16 MiB).');
    assert.equal(signal.aborted, true);
  });
  await check('Fehlender Body hat keinen unbeschränkten json()-Fallback', async () => {
    let jsonCalled = false;
    let signal;
    const missing = fixture(async (_url, options) => {
      signal = options.signal;
      return { ok: true, status: 200, body: null, headers: new Headers(), json() { jsonCalled = true; return {}; } };
    });
    await assert.rejects(missing.dynamicGridRequest('/config', {}), /Ungültige API-Antwort/);
    assert.equal(jsonCalled, false);
    assert.equal(signal.aborted, true);
  });
  await check('Bestehendes 10-s-Budget bleibt für lokale Mesh-/Mail-Aufrufe erhalten', async () => {
    const timeouts = [];
    const local = fixture(async () => Response.json({ ok: true }), {
      setTimeout(fn, ms) { timeouts.push(ms); return setTimeout(fn, ms); },
    });
    await local.meshCoordinatorRequest('/config');
    await local.notificationMailRequest();
    assert.deepEqual(timeouts, [10000, 10000]);
  });
  await check('Native HTTP-Gzip-Antworten werden nach Dekompression begrenzt', async () => {
    const compressed = zlib.gzipSync(JSON.stringify({ payload: 'x'.repeat(limit) }));
    assert(compressed.byteLength < limit);
    const server = http.createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json', 'content-encoding': 'gzip', 'content-length': compressed.byteLength });
      response.end(compressed);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert(address && typeof address === 'object');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`http://127.0.0.1:${address.port}/bounded-fixture`, { signal: controller.signal });
      await assert.rejects(api.readBoundedApiJson(response, controller), /maximal 16 MiB/);
      assert.equal(controller.signal.aborted, true);
    } finally {
      clearTimeout(timer); controller.abort(); server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
  console.log(JSON.stringify({ result: 'PASS', checks, maxDecodedBytes: limit, node: process.version,
    sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    limitation: 'Native VM/Fetch/Streams und lokales HTTP; kein Feldgeräte- oder Kundenanlagentest.' }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
