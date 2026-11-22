#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft konkrete XSS-, URL- und Service-Worker-Cache-Regressionsfälle.
 * Daten und Wirkung: Führt Originalfunktionen in einer isolierten Node-VM mit
 * DOM-/Netzwerk-Doubles aus; keine Geräte, Kundendaten oder externen Requests.
 * Bei Änderungen: HTML-Kontexte, gültige Navigation und API-Dateiendungen prüfen.
 * Optional --browser prüft die erzeugten HTML-Sinks zusätzlich in Chromium.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const source = (name) => read(`src-ts/runtime-executables/www/${name}.ts`);
const markup = [];
let cases = 0;

/** Extrahiert eine unveränderte benannte Funktion einschließlich Originalkörper. */
function functionSource(text, name, indent = '') {
  const start = text.indexOf(`${indent}function ${name}(`);
  assert(start >= 0, `Originalfunktion ${name} fehlt`);
  const end = text.indexOf(`\n${indent}}`, start);
  assert(end > start, `Funktionsende ${name} fehlt`);
  return text.slice(start, end + indent.length + 2);
}

/** DOM-Double sammelt tatsächlich geschriebene innerHTML-Sinks für Negativtests. */
function element() {
  return {
    children: [],
    appendChild(child) { this.children.push(child); },
    set innerHTML(value) { this.html = value; if (value) markup.push(value); },
    get innerHTML() { return this.html || ''; },
  };
}

const attack = '<img src=x onerror="globalThis.__craXss=1">';
const attributeAttack = '\"><img src=x onerror="globalThis.__craXss=1"><input value="';

async function run() {
  const history = source('history');
  const historyContext = vm.createContext({ document: { createElement: element }, cards: element() });
  const card = history.match(/^    function card\(title, val\)\{[^\n]+\}/m);
  assert(card, 'Original-History-Kartenrenderer vorhanden');
  vm.runInContext([
    functionSource(history, 'nwHistoryEscapeHtml', '  '),
    card[0],
    functionSource(history, 'kv2', '      '),
  ].join('\n'), historyContext);
  historyContext.card(attack, attributeAttack);
  const cardHtml = historyContext.cards.children[0].innerHTML;
  assert(!cardHtml.includes('<img'));
  assert(cardHtml.includes('&lt;img'));
  const tooltip = historyContext.kv2(attack, 1234.5, 'kW');
  assert(!tooltip.includes('<img'));
  assert(tooltip.includes('1234.50 kW'));
  markup.push(tooltip);
  cases += 2;

  const logic = source('logic');
  const node = { type: 'test', label: attributeAttack, params: { text: attributeAttack, dp: attributeAttack, number: attributeAttack, time: attributeAttack } };
  const def = { name: 'Prüfung', type: 'test', params: ['text', 'dp', 'number', 'time', 'scene'].map(kind => ({ key: kind, kind, label: 'Parameter' })) };
  const logicContext = vm.createContext({
    document: { createElement: element }, setTimeout() {},
    nwSafeStr: value => value == null ? '' : String(value), nwFindNode: () => node,
    nwLE: { selectedNodeId: 'test', el: { inspector: element() }, lib: { byType: { test: def } }, sceneOptions: [{ value: attributeAttack, label: attack }] },
  });
  vm.runInContext(functionSource(logic, 'nwEscapeHtml') + '\n' + functionSource(logic, 'nwRenderInspector'), logicContext);
  const beforeInspector = markup.length;
  logicContext.nwRenderInspector();
  for (const html of markup.slice(beforeInspector)) assert(!html.includes('<img'), 'Logik-Parameter dürfen keine HTML-Elemente erzeugen');
  assert(markup.slice(beforeInspector).some(html => html.includes('&quot;&gt;&lt;img')));
  cases += 6;

  const config = source('smarthome-config');
  const configState = { treeWrap: element(), resultsWrap: element() };
  const configContext = vm.createContext({ nwEnsureDpDialog: () => configState });
  vm.runInContext([
    functionSource(config, 'nwEscapeHtml'),
    functionSource(config, 'nwSetDpDialogTreeMessage'),
    functionSource(config, 'nwSetDpDialogResultsMessage'),
  ].join('\n'), configContext);
  configContext.nwSetDpDialogTreeMessage(attack, 'error');
  configContext.nwSetDpDialogResultsMessage(attack, 'error');
  assert(!configState.treeWrap.innerHTML.includes('<img'));
  assert(!configState.resultsWrap.innerHTML.includes('<img'));
  const pageTemplate = config.match(/meta\.innerHTML = (`<div class="nw-page-row__title">[^\n]+`);/);
  assert(pageTemplate);
  configContext.p = { id: attack, title: attack };
  configContext.nwPagesFormatFilterSummary = () => attack;
  const pageHtml = vm.runInContext(pageTemplate[1], configContext);
  assert(!pageHtml.includes('<img'));
  markup.push(pageHtml);
  cases += 3;

  const smart = source('smarthome');
  const smartContext = vm.createContext({ URL, window: { location: { href: 'https://eos.example/smarthome.html' } } });
  vm.runInContext(functionSource(smart, 'nwSafeWebUrl'), smartContext);
  for (const value of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'data:text/html,<script>x</script>', 'blob:https://eos.example/test', 'file:///tmp/test', 'https://user:secret@camera.example/', '', null]) {
    assert.equal(smartContext.nwSafeWebUrl(value), '', `URL muss abgewiesen werden: ${String(value).split(':')[0]}`);
    cases++;
  }
  for (const [input, expected] of [['/history.html', 'https://eos.example/history.html'], ['https://camera.example/live', 'https://camera.example/live'], ['http://192.0.2.3/snapshot.jpg', 'http://192.0.2.3/snapshot.jpg']]) {
    assert.equal(smartContext.nwSafeWebUrl(input), expected);
    cases++;
  }
  assert(smart.includes("frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-popups')"));
  assert(!smart.includes('allow-same-origin'));
  assert(!smart.includes('window.location.href = p.href'));
  cases++;

  // Tatsächlicher Fetch-Handler mit kontrolliertem Cache und Netzwerkverhalten.
  const handlers = {};
  const calls = { put: [], match: [], deleted: [], fetch: [] };
  let networkError = false;
  let networkResponse = new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } });
  let cachedResponse = new Response('ALTE PRIVATE DATEN');
  const sw = vm.createContext({
    URL, Response,
    self: { location: { origin: 'https://eos.example' }, addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting() {}, clients: { claim() {} } },
    caches: {
      open: async () => ({ put: async (req) => { calls.put.push(req.url); }, addAll: async () => {} }),
      match: async (req) => { calls.match.push(req); return cachedResponse; },
      // Beim Upgrade auf v526 müssen sämtliche Vorgänger verschwinden; der
      // aktuelle Cache und der Cache einer fremden Anwendung bleiben erhalten.
      keys: async () => ['nexowatt-cache-v520', 'nexowatt-cache-v521', 'nexowatt-cache-v522', 'nexowatt-cache-v523', 'nexowatt-cache-v524', 'nexowatt-cache-v525', 'nexowatt-cache-v526', 'other-app-cache'],
      delete: async (key) => { calls.deleted.push(key); },
    },
    fetch: async (req, options) => { calls.fetch.push({ url: req.url, options }); if (networkError) throw new Error('offline'); return networkResponse; },
  });
  vm.runInContext(source('sw'), sw);
  async function fetchEvent(url, method = 'GET', mode = 'cors') {
    let response;
    handlers.fetch({ request: { url: `https://eos.example${url}`, method, mode }, respondWith(value) { response = value; } });
    return response ? await response : undefined;
  }
  for (const url of ['/api/ledger/energy-origin.json', '/api/auth/status', '/config']) {
    const res = await fetchEvent(url);
    assert.equal(res.status, 200);
    assert.equal(calls.fetch.at(-1).options.cache, 'no-store');
    assert.equal(calls.put.length, 0);
    assert.equal(calls.match.length, 0);
    networkError = true;
    assert.equal((await fetchEvent(url)).status, 503);
    assert.equal(calls.match.length, 0, 'Offline-API darf Altcache nicht lesen');
    networkError = false;
    cases += 2;
  }
  for (const cacheControl of ['no-store', 'private, max-age=60']) {
    networkResponse = new Response('privat', { headers: { 'Cache-Control': cacheControl } });
    await fetchEvent('/license.html');
    assert.equal(calls.put.length, 0);
    cases++;
  }
  networkResponse = new Response('unauthorized', { status: 401 });
  await fetchEvent('/license.html');
  assert.equal(calls.put.length, 0);
  networkResponse = new Response('public code');
  for (const url of ['/static/history.js', '/static/styles.css', '/smarthome.html', '/static/smarthome.html', '/login.html']) {
    const before = calls.match.length;
    assert.equal((await fetchEvent(url)).status, 200);
    assert.equal(calls.fetch.at(-1).options.cache, 'no-store');
    assert.equal(calls.put.length, 0, 'Code und HTML werden nie als alte Anwendungsshell gespeichert');
    assert.equal(calls.match.length, before, 'Kein Lesen einer alten Anwendungsshell');
    cases++;
  }
  assert.equal(await fetchEvent('/api/example', 'POST'), undefined);
  assert.equal(await fetchEvent('/events'), undefined);
  for (const route of ['/ems/arbitrage/', '/ems/partner-integrations/', '/ems/arbitrage/index.html', '/ems/partner-integrations/assets/app.js']) {
    const before = calls.match.length;
    assert.equal((await fetchEvent(route)).status, 200, 'Partnerseiten werden über den Server-Rollengate frisch angefordert');
    assert.equal(calls.fetch.at(-1).options.cache, 'no-store');
    assert.equal(calls.match.length, before, 'Kein alter Rollen- oder Offlinecache für Partnerseiten');
    networkError = true;
    const offline = await fetchEvent(route, 'GET', 'navigate');
    assert.equal(offline.status, 503); assert.ok(!(await offline.text()).includes('ALTE PRIVATE DATEN'));
    assert.equal(calls.match.length, before); networkError = false;
    cases++;
  }
  // Nur öffentliche Bild-/Schriftdateien dürfen überhaupt Cache-I/O erreichen.
  cachedResponse = undefined;
  networkResponse = new Response('public image');
  await fetchEvent('/static/assets/public.svg');
  await Promise.resolve();
  assert(calls.put.includes('https://eos.example/static/assets/public.svg'));
  for (const cacheControl of ['no-store', 'private, max-age=60']) {
    const before = calls.put.length;
    networkResponse = new Response('not cacheable', { headers: { 'Cache-Control': cacheControl } });
    await fetchEvent('/assets/private.svg'); await Promise.resolve();
    assert.equal(calls.put.length, before, 'Auch Bilddateien mit privater Antwort bleiben ungespeichert');
  }
  for (const route of ['/api/assets/state.svg', '/config/static/state.svg', '/api/ledger/energy-origin.json']) {
    const before = calls.match.length;
    await fetchEvent(route); assert.equal(calls.match.length, before, 'Dateiendung umgeht keinen privaten Pfad');
    assert.equal(calls.fetch.at(-1).options.cache, 'no-store');
  }
  cases += 4;
  let foreignIntercepted = false;
  handlers.fetch({ request: { url: 'https://external.example/widget.js', method: 'GET' }, respondWith() { foreignIntercepted = true; } });
  assert.equal(foreignIntercepted, false);
  let activation;
  handlers.activate({ waitUntil(value) { activation = value; } });
  await activation;
  assert.deepEqual(calls.deleted, ['nexowatt-cache-v520', 'nexowatt-cache-v521', 'nexowatt-cache-v522', 'nexowatt-cache-v523', 'nexowatt-cache-v524', 'nexowatt-cache-v525']);
  calls.deleted.length = 0;
  let logout;
  handlers.message({ data: { type: 'NW_AUTH_LOGOUT' }, waitUntil(value) { logout = value; } });
  await logout;
  assert.deepEqual(calls.deleted, ['nexowatt-cache-v520', 'nexowatt-cache-v521', 'nexowatt-cache-v522', 'nexowatt-cache-v523', 'nexowatt-cache-v524', 'nexowatt-cache-v525', 'nexowatt-cache-v526']);
  cases += 6;

  // Dev-Einstieg: Ein präparierter Link darf nie die Skriptquelle verändern.
  const index = read('src-admin-tab/index.html');
  const loaderScript = [...index.matchAll(/<script>([\s\S]*?)<\/script>/g)].find(match => match[1].includes('__nwSocketLoader'))[1];
  const loaded = [];
  const loaderContext = vm.createContext({
    URLSearchParams,
    window: { location: { search: '?host=external.example&port=443', hostname: 'localhost', port: '5173', protocol: 'http:' } },
    document: { querySelector: () => null, createElement: () => ({ dataset: {} }), head: { appendChild(script) { loaded.push(script.src); script.onload(); } } },
  });
  vm.runInContext(loaderScript, loaderContext);
  await loaderContext.window.__nwSocketLoader();
  assert.deepEqual(loaded, ['http://localhost:8081/lib/js/socket.io.js']);
  cases++;

  const kioskTokenSource = functionSource(source('ems-apps'), '_chargeKioskToken', '  ');
  let randomBytes = 0;
  const kioskContext = vm.createContext({ Uint8Array, crypto: { getRandomValues(bytes) { randomBytes = bytes.length; for (let i = 0; i < bytes.length; i++) bytes[i] = i; return bytes; } } });
  vm.runInContext(kioskTokenSource, kioskContext);
  assert.equal(kioskContext._chargeKioskToken(), 'ST-000102030405060708090A0B0C0D0E0F');
  assert.equal(randomBytes, 16, 'Neue Tokens müssen mindestens 128 Zufallsbits nutzen');
  const noCrypto = vm.createContext({ Uint8Array });
  vm.runInContext(kioskTokenSource, noCrypto);
  assert.throws(() => noCrypto._chargeKioskToken(), /Sicherer Zufallsgenerator/);
  assert(!kioskTokenSource.includes('Math.random'));
  cases += 3;

  if (process.argv.includes('--browser')) {
    let playwright;
    try { playwright = require('playwright'); } catch {
      assert(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'Playwright für expliziten Browsertest erforderlich');
      playwright = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright'));
    }
    const browser = await playwright.chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_BIN || undefined, args: ['--no-sandbox'] });
    try {
      const page = await browser.newPage();
      await page.route('**/*', route => route.fulfill({ status: 404, body: '' }));
      const result = await page.evaluate((rows) => {
        globalThis.__craXss = 0;
        for (const html of rows) {
          const div = document.createElement('div'); div.innerHTML = html; document.body.appendChild(div);
        }
        return { attackImages: document.querySelectorAll('img').length, attackHandlers: document.querySelectorAll('[onerror]').length, executed: globalThis.__craXss };
      }, markup);
      assert.deepEqual(result, { attackImages: 0, attackHandlers: 0, executed: 0 });
      console.log('[verify-cra-frontend] Chromium: reale HTML-Sinks ohne eingeschleuste Elemente/Handler bestanden.');
    } finally { await browser.close(); }
  }
  console.log(`[verify-cra-frontend] PASS ${cases} Regressionen (Originalfunktionen; DOM-/Fetch-/Cache-Doubles).`);
}

run().catch(error => { console.error('[verify-cra-frontend] FAIL:', error.message); process.exitCode = 1; });
