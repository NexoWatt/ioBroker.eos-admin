/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Führt den echten PWA-Bootstrap mit kontrollierten Browserereignissen aus.
 * Wirkung: Strikter TS-Check und VM-Verhalten mit tatsächlichem runtime-base;
 * prüft Ursprung/Proxy/Frame, Worker-URL, Ereignisse, Fehler und begrenzte Aufträge.
 * Grenze: Browser-SW-API wird kontrolliert ersetzt. Keine behauptete Installation
 * auf Android/iOS, kein Vor-Ort-Zertifikatsvertrauen und keine Browser-Freigabe.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, 'src-ts/runtime-executables/www', name + '.ts'), 'utf8');
const compiled = name => ts.transpileModule(source(name), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const runtimeCode = compiled('runtime-base');
const pwaCode = compiled('pwa');
const settled = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

function boot(options = {}) {
  let now = 0, nextTimer = 0;
  const registers = [], updates = [], timers = new Map(), windowListeners = new Map(), documentListeners = new Map();
  const origin = options.origin || 'https://ui.example.test:8188';
  const href = origin + (options.pathname || '/login.html') + (options.search || '');
  const parsed = new URL(href);
  const location = { origin: parsed.origin, href: parsed.href, pathname: parsed.pathname };
  const collect = (map, name, fn) => { const list = map.get(name) || []; list.push(fn); map.set(name, list); };
  const registration = {
    update() { updates.push({ at: now }); return options.update ? options.update() : Promise.resolve(registration); },
  };
  const navigator = { onLine: options.online !== false };
  if (options.supported !== false) navigator.serviceWorker = {
    register(url, config) { registers.push({ url, config, at: now }); return options.register ? options.register() : Promise.resolve(registration); },
  };
  const document = {
    baseURI: options.baseURI || href,
    hidden: options.hidden === true,
    addEventListener(name, fn) { collect(documentListeners, name, fn); },
    createElement() { throw new Error('PWA bootstrap must not modify the login DOM'); },
  };
  const window = {
    location,
    isSecureContext: options.secure !== false,
    addEventListener(name, fn) { collect(windowListeners, name, fn); },
    setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  window.self = window;
  window.top = options.iframe ? {} : window;
  if (options.topThrows) Object.defineProperty(window, 'top', { get() { throw new Error('synthetic cross-frame failure'); } });
  for (const name of ['localStorage', 'sessionStorage']) Object.defineProperty(window, name, {
    get() { throw new Error('PWA bootstrap must not access credentials or local auth storage'); },
  });
  const context = vm.createContext({ window, navigator, document, URL, Request, performance: { now: () => now } });
  if (options.runtime !== false) vm.runInContext(runtimeCode, context, { filename: 'runtime-base.ts', timeout: 1000 });
  const reload = () => vm.runInContext(pwaCode, context, { filename: 'pwa.ts', timeout: 1000 });
  reload();
  const dispatch = (map, name) => { for (const fn of map.get(name) || []) fn({ type: name, persisted: true }); };
  const advance = async milliseconds => {
    now += milliseconds;
    for (let iteration = 0; iteration < 100; iteration += 1) {
      const next = [...timers.entries()].find(([, task]) => task.at <= now);
      if (!next) { await settled(); return; }
      timers.delete(next[0]); next[1].fn(); await settled();
    }
    assert.fail('Bootstrap created an unbounded timer loop');
  };
  return { window, document, navigator, registers, updates, timers, windowListeners, documentListeners, registration, reload, advance,
    emit: name => dispatch(windowListeners, name),
    visibility(hidden) { document.hidden = hidden; dispatch(documentListeners, 'visibilitychange'); },
  };
}

let checks = 0;
async function check(name, fn) { await fn(); checks += 1; console.log('[ui-pwa] PASS ' + name); }

async function main() {
  execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '-p', 'tsconfig.ui-pwa.json'], { cwd: root, stdio: 'pipe' });
  await check('Actual direct HTTPS login registers immediately before authentication', async () => {
    const f = boot(); await settled();
    assert.equal(f.registers.length, 1); assert.equal(f.updates.length, 0);
    const call = f.registers[0];
    assert.equal(call.url, 'https://ui.example.test:8188/sw.js');
    assert.equal(call.config.scope, 'https://ui.example.test:8188/');
    assert.equal(call.config.updateViaCache, 'none');
    assert.equal(f.window.NW_RUNTIME.isProxy, false);
    assert.equal(f.window.NW_PWA_BOOTSTRAPPED, true);
  });
  await check('Root, static login and foreign base/query cannot select another worker or scope', async () => {
    for (const pathname of ['/', '/index.html', '/static/login.html']) {
      const f = boot({ pathname, baseURI: 'https://foreign.example.test/elsewhere/', search: '?returnTo=https://foreign.example.test/sw.js' });
      await settled(); assert.equal(f.registers.length, 1);
      assert.equal(f.registers[0].url, 'https://ui.example.test:8188/sw.js');
      assert.equal(f.registers[0].config.scope, 'https://ui.example.test:8188/');
    }
  });
  await check('Actual runtime proxy detection blocks root and nested Admin origins', async () => {
    for (const pathname of ['/proxy/nexowatt-ui.0/login.html', '/admin/proxy/nexowatt-ui.23/index.html', '/nested/site/proxy/nexowatt-ui.5/']) {
      const f = boot({ pathname }); await settled(); assert.equal(f.window.NW_RUNTIME.isProxy, true);
      assert.equal(f.registers.length, 0); assert.equal(f.windowListeners.size, 0); assert.equal(f.documentListeners.size, 0);
    }
  });
  await check('Frames and inaccessible top context never register', async () => {
    for (const options of [{ iframe: true }, { topThrows: true }]) { const f = boot(options); await settled(); assert.equal(f.registers.length, 0); }
  });
  await check('Remote HTTP and insecure contexts are blocked despite supported APIs', async () => {
    for (const options of [{ origin: 'http://ui.example.test:8188' }, { origin: 'http://192.0.2.10:8188' }, { secure: false }]) {
      const f = boot(options); await settled(); assert.equal(f.registers.length, 0); assert.equal(f.windowListeners.size, 0);
    }
  });
  await check('Loopback HTTP is limited to exact local hosts and a real secure context', async () => {
    for (const origin of ['http://localhost:8188', 'http://127.0.0.1:8188', 'http://[::1]:8188']) {
      const f = boot({ origin }); await settled(); assert.equal(f.registers.length, 1, origin);
    }
    for (const options of [{ origin: 'http://localhost.example.test:8188' }, { origin: 'http://127.0.0.1:8188', secure: false }]) {
      const f = boot(options); await settled(); assert.equal(f.registers.length, 0);
    }
  });
  await check('Missing runtime confirmation or Worker support leaves UI untouched', async () => {
    for (const options of [{ runtime: false }, { supported: false }]) {
      const f = boot(options); await settled(); assert.equal(f.registers.length, 0); assert.equal(f.windowListeners.size, 0);
    }
  });
  await check('Duplicate script execution does not duplicate registration or listeners', async () => {
    const f = boot(); f.reload(); f.reload(); await settled();
    assert.equal(f.registers.length, 1); assert.equal(f.windowListeners.size, 3); assert.equal(f.documentListeners.size, 1);
    for (const list of [...f.windowListeners.values(), ...f.documentListeners.values()]) assert.equal(list.length, 1);
    assert.equal(Object.getOwnPropertyDescriptor(f.window, 'NW_PWA_BOOTSTRAPPED').writable, false);
  });
  await check('Reopening the existing page updates its registration without replacing identity', async () => {
    const f = boot(); await settled(); await f.advance(30_000); f.emit('pageshow'); await settled();
    assert.equal(f.updates.length, 1); assert.equal(f.registers.length, 1); assert.equal(f.timers.size, 0);
  });
  await check('Visible resume updates, hidden pages cancel scheduled work', async () => {
    const f = boot(); await settled(); f.emit('pageshow'); assert.equal(f.timers.size, 1);
    f.visibility(true); assert.equal(f.timers.size, 0); await f.advance(30_000); assert.equal(f.updates.length, 0);
    f.visibility(false); await settled(); assert.equal(f.updates.length, 1);
  });
  await check('Offline events do not start requests and online recovery updates once', async () => {
    const f = boot(); await settled(); f.navigator.onLine = false; await f.advance(30_000);
    f.emit('pageshow'); f.emit('online'); await settled(); assert.equal(f.updates.length, 0); assert.equal(f.timers.size, 0);
    f.navigator.onLine = true; f.emit('online'); await settled(); assert.equal(f.updates.length, 1);
  });
  await check('An initially offline or hidden login can register on its later resume', async () => {
    const offline = boot({ online: false }); await settled(); assert.equal(offline.registers.length, 0);
    offline.navigator.onLine = true; offline.emit('online'); await settled(); assert.equal(offline.registers.length, 1);
    const hidden = boot({ hidden: true }); await settled(); assert.equal(hidden.registers.length, 0);
    hidden.visibility(false); await settled(); assert.equal(hidden.registers.length, 1);
  });
  await check('Event bursts create only one bounded follow-up timer', async () => {
    const f = boot(); await settled();
    for (let index = 0; index < 500; index += 1) { f.emit('pageshow'); f.emit('online'); f.visibility(false); }
    assert.equal(f.timers.size, 1); assert.equal(f.updates.length, 0);
    await f.advance(29_999); assert.equal(f.updates.length, 0); await f.advance(1);
    assert.equal(f.updates.length, 1); assert.equal(f.timers.size, 0); assert.equal(f.registers.length, 1);
  });
  await check('Pending registration cannot create parallel requests or timer growth', async () => {
    const pending = deferred(); const f = boot({ register: () => pending.promise });
    for (let index = 0; index < 500; index += 1) f.emit('online');
    await f.advance(120_000); f.emit('pageshow'); await settled();
    assert.equal(f.registers.length, 1); assert.equal(f.updates.length, 0); assert.equal(f.timers.size, 0);
    pending.resolve(f.registration); await settled(); assert.equal(f.updates.length, 1); assert.equal(f.registers.length, 1);
  });
  await check('Rejected registration does not block login and a later event can retry', async () => {
    let fail = true;
    const f = boot({ register: () => fail ? Promise.reject(new Error('synthetic registration refusal')) : Promise.resolve({ update: () => Promise.resolve() }) });
    await settled(); assert.equal(f.registers.length, 1); assert.equal(f.timers.size, 0);
    fail = false; await f.advance(30_000); f.emit('online'); await settled(); assert.equal(f.registers.length, 2);
  });
  await check('Synchronous browser API errors are caught without DOM or auth mutation', async () => {
    const f = boot({ register: () => { throw new Error('synthetic synchronous browser refusal'); } });
    await settled(); assert.equal(f.registers.length, 1); assert.equal(f.timers.size, 0);
    await f.advance(30_000); f.emit('pageshow'); await settled(); assert.equal(f.registers.length, 2);
  });
  await check('Rejected update preserves registration and retries only on a later event', async () => {
    const f = boot({ update: () => Promise.reject(new Error('synthetic update refusal')) });
    await settled(); await f.advance(30_000); f.emit('online'); await settled(); assert.equal(f.updates.length, 1);
    await f.advance(30_000); f.emit('pageshow'); await settled(); assert.equal(f.updates.length, 2); assert.equal(f.registers.length, 1);
  });
  await check('Unresolved update remains a single browser operation across repeated resumes', async () => {
    const pending = deferred(); const f = boot({ update: () => pending.promise });
    await settled(); await f.advance(30_000); f.emit('pageshow'); await settled();
    for (let index = 0; index < 500; index += 1) f.emit('online');
    await f.advance(120_000); f.emit('pageshow'); await settled();
    assert.equal(f.updates.length, 1); assert.equal(f.registers.length, 1); assert.equal(f.timers.size, 0);
  });
  await check('Page hide cancels only scheduled work and later pageshow remains functional', async () => {
    const f = boot(); await settled(); f.emit('pageshow'); assert.equal(f.timers.size, 1);
    f.emit('pagehide'); assert.equal(f.timers.size, 0); await f.advance(30_000);
    f.emit('pageshow'); await settled(); assert.equal(f.updates.length, 1);
  });
  await check('Six actual HTML entries load the common bootstrap after the runtime boundary', async () => {
    const expected = ['energy-ledger.html', 'history.html', 'index.html', 'login.html', 'settings.html', 'storagefarm.html'];
    const actual = [];
    for (const file of fs.readdirSync(path.join(root, 'www')).filter(file => file.endsWith('.html'))) {
      const html = fs.readFileSync(path.join(root, 'www', file), 'utf8');
      assert.ok(!html.includes('serviceWorker.register('), file + ' must not reset common registration options');
      const pwa = html.indexOf('src="/static/pwa.js"');
      if (pwa < 0) continue;
      actual.push(file);
      const runtime = html.indexOf('src="/static/runtime-base.js"');
      assert.ok(runtime >= 0 && runtime < pwa, file + ': runtime must load first');
      assert.equal(html.split('src="/static/pwa.js"').length - 1, 1, file + ': exactly one shared entry');
      const tag = html.match(/<script\b[^>]*\bsrc="\/static\/runtime-base\.js"[^>]*>/u)?.[0];
      assert.ok(tag && !/\b(?:async|defer)\b/u.test(tag), file + ': runtime confirmation must execute first');
      if (file === 'login.html') assert.ok(pwa < html.indexOf('src="/static/login.js"'), 'login uses bootstrap before its deferred form controller');
      else {
        const auth = html.indexOf('src="/static/auth.js"');
        assert.ok(auth > runtime && auth < pwa, file + ': runtime then auth then PWA');
      }
    }
    assert.deepEqual(actual.sort(), expected);
    const index = fs.readFileSync(path.join(root, 'www/index.html'), 'utf8');
    assert.ok(index.indexOf('src="/static/auth.js"') < index.indexOf('src="/static/app.js"'), 'dashboard must load auth before controls');
    const authTag = index.match(/<script\b[^>]*\bsrc="\/static\/auth\.js"[^>]*>/u)?.[0];
    assert.ok(authTag && !/\b(?:async|defer)\b/u.test(authTag), 'dashboard auth must execute before synchronous app logic');
  });
  await check('Installed app identity retains start URL, scope and actual PNG icon assets', async () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'www/manifest.webmanifest'), 'utf8'));
    assert.equal(manifest.start_url, '.'); assert.equal(manifest.scope, './'); assert.equal(manifest.display, 'standalone');
    assert.ok(manifest.icons.some(icon => icon.sizes === '192x192')); assert.ok(manifest.icons.some(icon => icon.sizes === '512x512'));
    for (const icon of manifest.icons) {
      assert.match(icon.src, /^assets\/icons\/nexowatt-[0-9]+(?:-maskable)?\.png$/);
      const bytes = fs.readFileSync(path.join(root, 'www', icon.src));
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(bytes.readUInt32BE(16) + 'x' + bytes.readUInt32BE(20), icon.sizes);
    }
  });
  console.log('[ui-pwa] PASS ' + checks + ' groups: strict TS, actual bootstrap VM behavior, bounds, failure isolation and installed-app identity. Browser/device installation is not claimed.');
}
main().catch(error => { console.error('[ui-pwa] FAIL:', error.message); if (error.stdout) console.error(String(error.stdout)); process.exitCode = 1; });
