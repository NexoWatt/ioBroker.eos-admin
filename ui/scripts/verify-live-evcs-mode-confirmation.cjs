#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * LIVE-Einzelwallbox: tatsächlichen Modal-Handler isoliert mit DOM-Fassade prüfen.
 * Keine Anlage/Netzwerkverbindung. Echter runtime-base.js-Wrapper im HTTPS-Proxy.
 * node scripts/verify-live-evcs-mode-confirmation.cjs --canonical
 * node scripts/verify-live-evcs-mode-confirmation.cjs --source /path/to/original/app.js
 * Ohne Option: ausgelieferte www/app.js. Node >= 24, keine Zusatzabhängigkeiten.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '..');
const canonical = process.argv.includes('--canonical');
const sourceArg = process.argv.indexOf('--source');
const filename = sourceArg >= 0 ? path.resolve(process.argv[sourceArg + 1]) : path.join(root, canonical ? 'src-ts/runtime-executables/www/app.ts' : 'www/app.js');
const completeSource = fs.readFileSync(filename, 'utf8');
const start = completeSource.indexOf('// --- EVCS modal ---');
const end = completeSource.indexOf('\n})();', start);
assert(start >= 0 && end > start, 'Actual EVCS modal block must exist');
let source = completeSource.slice(start, end + '\n})();'.length);
if (canonical) source = stripTypeScriptTypes(source, { mode: 'strip' });
const runtimeFilename = path.join(root, 'www/runtime-base.js');
const runtimeSource = fs.readFileSync(runtimeFilename, 'utf8');
const emsKey = 'chargingManagement.wallboxes.lp1.userMode';
const clone = (value) => JSON.parse(JSON.stringify(value));
const response = (payload, status = 200) => new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
const loginResponse = () => {
  const result = new Response('<html>Login</html>', { headers: { 'Content-Type': 'text/html' } });
  Object.defineProperty(result, 'redirected', { value: true });
  return result;
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 30; i += 1) await Promise.resolve(); };

function harness({ proxy = false, legacy = null } = {}) {
  const location = new URL(proxy ? 'https://example.invalid/admin/proxy/nexowatt-ui.0/index.html' : 'http://example.invalid:8188/index.html');
  const prefix = proxy ? '/admin/proxy/nexowatt-ui.0' : '';
  const calls = [], nodes = new Map(), timers = new Map();
  let timerId = 0, clock = 1000;
  function node(tag = 'div') {
    const classes = new Set();
    const attrs = new Map(), handlers = new Map();
    return {
      tagName: tag.toUpperCase(), style: {}, textContent: '', disabled: false,
      classList: { toggle: (name, active) => active ? classes.add(name) : classes.delete(name), contains: (name) => classes.has(name), add: (name) => classes.add(name), remove: (name) => classes.delete(name) },
      setAttribute: (name, value) => attrs.set(name, value), getAttribute: (name) => attrs.get(name) ?? null,
      addEventListener: (name, handler) => handlers.set(name, handler), handlers,
      insertAdjacentElement: (_where, child) => { nodes.set(child.id || child.tagName, child); }
    };
  }
  const buttons = node(), controls = ['auto', 'boost', 'minpv', 'pv'].map((mode) => {
    const button = node('button');
    button.setAttribute('data-mode', mode);
    button.closest = () => button;
    return button;
  });
  buttons.querySelectorAll = () => controls;
  buttons.querySelector = (selector) => selector.includes('.active') ? controls.find((b) => b.classList.contains('active')) : controls.find((b) => b.getAttribute('data-mode') === 'auto');
  nodes.set('evcsModeButtons', buttons);
  const key = legacy === 'per-box' ? 'evcs.1.mode' : legacy === 'settings' ? 'settings.evcsMode' : emsKey;
  const backend = { [key]: { value: legacy ? 3 : 'pv', ts: clock } };
  if (!legacy) backend['chargingManagement.wallboxCount'] = { value: 1, ts: clock };
  const h = { calls, backend, timers, controls, key, prefix, buttons, nodes, snapshot: clone(backend) };
  h.transport = async (url, options) => {
    if (url.endsWith('/api/set')) {
      const body = JSON.parse(options.body);
      backend[key] = { value: body.value, ts: ++clock };
      return response({ ok: true });
    }
    if (url.endsWith('/api/state')) return response(backend);
    throw new Error(`Unexpected URL ${url}`);
  };
  const context = vm.createContext({
    console, URL, Request, Response, AbortController, location,
    document: { baseURI: location.href, getElementById: (id) => nodes.get(id) || null, querySelector: () => null, createElement: node, addEventListener() {} },
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearTimeout: (id) => timers.delete(id),
    fetch: async (url, options = {}) => { calls.push({ url, options }); return h.transport(url, options); },
    scheduleRender: () => { if (h.apply) h.apply(h.snapshot); },
    nwAsBool: (value) => Boolean(value)
  });
  vm.runInContext('window = globalThis;', context);
  vm.runInContext(runtimeSource, context, { filename: runtimeFilename });
  vm.runInContext(source, context, { filename });
  h.apply = (payload) => { h.snapshot = clone(payload); context.__evcsApply((k) => h.snapshot[k]?.value, h.snapshot); };
  h.button = (mode) => controls.find((b) => b.getAttribute('data-mode') === mode);
  h.selected = () => controls.find((b) => b.classList.contains('active'))?.getAttribute('data-mode') || null;
  h.click = (mode) => buttons.handlers.get('click')({ target: h.button(mode) });
  h.error = () => nodes.get('evcsModeWriteStatus')?.textContent || '';
  h.apply(h.snapshot);
  return h;
}

const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); }
}

(async () => {
  for (const proxy of [false, true]) {
    const label = proxy ? 'HTTPS Admin proxy' : 'direct HTTP';
    for (const failure of ['HTTP 401', 'HTTP 403', 'HTTP 500', 'JSON ok=false', 'invalid JSON', '302 followed by login HTML', 'network error']) {
      await test(`${label}: rejected Auto (${failure}) retains confirmed PV and shows failure`, async () => {
        const h = harness({ proxy });
        h.transport = async (url) => {
          if (url.endsWith('/api/state')) return response(h.backend);
          if (failure.startsWith('HTTP ')) return response({ ok: false }, Number(failure.slice(5)));
          if (failure === 'JSON ok=false') return response({ ok: false });
          if (failure === 'invalid JSON') return new Response('{', { headers: { 'Content-Type': 'application/json' } });
          if (failure.startsWith('302')) return loginResponse();
          throw new TypeError('Connection interrupted');
        };
        await h.click('auto');
        assert.equal(h.selected(), 'pv', 'failed request may not select requested Auto');
        assert(h.error(), 'failure must be visible');
        assert.deepEqual(h.calls.map((c) => c.url), [`${h.prefix}/api/set`, `${h.prefix}/api/state`]);
        if (failure === 'HTTP 401' || failure === 'HTTP 403' || failure.startsWith('302')) {
          assert.match(h.error(), /Anmeldung und Berechtigung/);
          const link = h.nodes.get('A');
          assert.equal(new URL(link.href).origin, proxy ? 'https://example.invalid' : 'http://example.invalid:8188');
          assert.equal(link.style.display, 'block');
        }
      });
    }
    for (const mode of ['auto', 'boost', 'minpv', 'pv']) {
      await test(`${label}: ${mode} waits for server readback`, async () => {
        const h = harness({ proxy });
        await h.click(mode);
        assert.equal(h.selected(), mode);
        assert.equal(h.error(), '');
        assert.deepEqual(h.calls.map((c) => c.url), [`${h.prefix}/api/set`, `${h.prefix}/api/state`]);
        assert.equal(h.calls[1].options.cache, 'no-store');
        assert.equal(h.calls[0].options.credentials, 'same-origin');
        assert(h.calls[0].options.signal instanceof AbortSignal);
        assert.equal(h.timers.size, 0);
      });
    }
  }
  await test('In-flight Auto keeps PV selected and blocks duplicate click and SSE re-enable', async () => {
    const h = harness({ proxy: true }), post = deferred(), get = deferred();
    h.transport = (url) => url.endsWith('/api/set') ? post.promise : get.promise;
    const first = h.click('auto');
    assert.equal(h.selected(), 'pv');
    assert.match(h.error(), /gespeichert und geprüft/);
    h.apply(h.snapshot);
    assert(h.controls.every((b) => b.disabled));
    await h.click('boost');
    assert.equal(h.calls.length, 1);
    post.resolve(response({ ok: true })); await flush();
    assert.equal(h.selected(), 'pv', 'POST acknowledgment alone is not a mode readback');
    get.resolve(response({ [emsKey]: { value: 'auto', ts: 2000 } }));
    await first;
    assert.equal(h.selected(), 'auto');
    assert(h.controls.every((b) => !b.disabled));
  });
  await test('Boost cancellation requests confirmed Auto', async () => {
    const h = harness(); await h.click('boost'); await h.click('boost');
    assert.equal(h.selected(), 'auto');
    assert.equal(JSON.parse(h.calls[2].options.body).value, 'auto');
  });
  for (const legacy of ['per-box', 'settings']) {
    await test(`Legacy ${legacy}: confirmed numeric mode uses its own API/state path`, async () => {
      const h = harness({ legacy, proxy: true });
      await h.click('minpv');
      assert.equal(h.selected(), 'minpv');
      assert.deepEqual(JSON.parse(h.calls[0].options.body), { scope: legacy === 'per-box' ? 'evcs' : 'settings', key: legacy === 'per-box' ? '1.mode' : 'evcsMode', value: 2 });
      assert.equal(h.calls.length, 2);
    });
    await test(`Legacy ${legacy}: failed write retains numeric PV`, async () => {
      const h = harness({ legacy });
      h.transport = async (url) => response(url.endsWith('/api/state') ? h.backend : { ok: false });
      await h.click('boost');
      assert.equal(h.selected(), 'pv');
      assert(h.error());
    });
  }
  await test('Network loss after applied write is reconciled by readback without retry', async () => {
    const h = harness({ proxy: true }), normal = h.transport;
    h.transport = async (url, options) => {
      const result = await normal(url, options);
      if (url.endsWith('/api/set')) throw new TypeError('Response lost');
      return result;
    };
    await h.click('auto');
    assert.equal(h.selected(), 'auto');
    assert.equal(h.error(), '');
    assert.equal(h.calls.filter((c) => c.url.endsWith('/api/set')).length, 1);
  });
  await test('Newer SSE mode wins over delayed older Auto readback and old full snapshot', async () => {
    const h = harness(), get = deferred();
    h.transport = async (url) => url.endsWith('/api/set') ? response({ ok: true }) : get.promise;
    const request = h.click('auto'); await flush();
    const newer = { ...h.snapshot, [emsKey]: { value: 'boost', ts: 3000 } };
    h.apply(newer);
    get.resolve(response({ [emsKey]: { value: 'auto', ts: 2000 } }));
    await request;
    assert.equal(h.selected(), 'boost');
    h.apply({ ...newer, [emsKey]: { value: 'pv', ts: 1000 } });
    assert.equal(h.selected(), 'boost');
    assert(h.error());
  });
  await test('Write acceptance with different readback never selects desired Auto', async () => {
    const h = harness(); h.transport = async (url) => response(url.endsWith('/api/set') ? { ok: true } : h.backend);
    await h.click('auto');
    assert.equal(h.selected(), 'pv'); assert.match(h.error(), /nicht bestätigt/);
  });
  for (const invalid of [undefined, { value: 'unknown', ts: 2 }, { value: true, ts: 2 }, { value: 'auto', ts: 'bad' }]) {
    await test(`Invalid readback ${JSON.stringify(invalid) || 'missing'} cannot confirm Auto`, async () => {
      const h = harness();
      h.transport = async (url) => response(url.endsWith('/api/set') ? { ok: true } : { [emsKey]: invalid });
      await h.click('auto'); assert.equal(h.selected(), 'pv'); assert(h.error());
    });
  }
  await test('Initial missing EMS mode does not invent confirmed Auto and cannot write', async () => {
    const h = harness();
    // Force a different source first so no prior mode value can be reused.
    h.apply({}); h.apply({ 'chargingManagement.wallboxCount': { value: 1 } });
    assert.equal(h.selected(), null);
    await h.click('auto'); assert.equal(h.calls.length, 0);
  });
  await test('Regulation disabled blocks synthetic mode click', async () => {
    const h = harness(); h.apply({ ...h.snapshot, 'chargingManagement.wallboxes.lp1.userEnabled': { value: false, ts: 1001 } });
    await h.click('auto'); assert.equal(h.calls.length, 0);
  });
  for (const phase of ['POST fetch', 'GET fetch', 'GET body']) {
    await test(`${phase} timeout aborts real request signal, clears timers and releases controls`, async () => {
      const h = harness({ proxy: true });
      const waitAbort = (signal) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
      h.transport = async (url, options) => {
        const post = url.endsWith('/api/set');
        if ((phase === 'POST fetch' && post) || (phase === 'GET fetch' && !post)) return waitAbort(options.signal);
        if (post) return response({ ok: true });
        if (phase === 'GET body') return { ok: true, headers: new Headers({ 'Content-Type': 'application/json' }), json: () => waitAbort(options.signal) };
        return response(h.backend);
      };
      const pending = h.click('auto'); await flush();
      assert.equal(h.timers.size, 1); const timer = [...h.timers.values()][0]; assert.equal(timer.ms, 5000); timer.fn();
      await pending;
      assert.equal(h.selected(), 'pv'); assert(h.error());
      assert.equal(h.timers.size, 0); assert(h.controls.every((b) => !b.disabled));
    });
  }
  await test('HTTPS proxy readback login HTML after accepted write remains unconfirmed', async () => {
    const h = harness({ proxy: true });
    h.transport = async (url) => url.endsWith('/api/set') ? response({ ok: true }) : loginResponse();
    await h.click('auto'); assert.equal(h.selected(), 'pv'); assert.match(h.error(), /Anmeldung/);
  });
  for (const failure of ['401', '403', '500', 'invalid JSON', 'network']) {
    await test(`Readback ${failure} after accepted write retains last confirmed PV`, async () => {
      const h = harness({ proxy: true });
      h.transport = async (url) => {
        if (url.endsWith('/api/set')) return response({ ok: true });
        if (/^\d+$/.test(failure)) return response({ ok: false }, Number(failure));
        if (failure === 'invalid JSON') return new Response('{', { headers: { 'Content-Type': 'application/json' } });
        throw new TypeError('Readback connection failed');
      };
      await h.click('auto'); assert.equal(h.selected(), 'pv'); assert(h.error());
      assert(h.controls.every((b) => !b.disabled)); assert.equal(h.timers.size, 0);
    });
  }
  await test('Mode source changed during request rejects readback from previous source', async () => {
    const h = harness(), get = deferred();
    h.transport = async (url) => url.endsWith('/api/set') ? response({ ok: true }) : get.promise;
    const request = h.click('auto'); await flush();
    h.apply({ 'evcs.1.mode': { value: 2, ts: 2000 } });
    get.resolve(response({ [emsKey]: { value: 'auto', ts: 3000 } }));
    await request;
    assert.equal(h.selected(), 'minpv'); assert(h.error());
  });
  await test('Newer server mode after successful readback replaces earlier confirmation', async () => {
    const h = harness(); await h.click('auto');
    h.apply({ ...h.snapshot, [emsKey]: { value: 'pv', ts: 5000 } });
    assert.equal(h.selected(), 'pv');
  });
  const output = { target: filename, sha256: crypto.createHash('sha256').update(completeSource).digest('hex'), runtimeSha256: crypto.createHash('sha256').update(runtimeSource).digest('hex'), environment: 'Node VM, actual modal and runtime-base.js, synthetic DOM/HTTP; no hardware/network', passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length, results };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = output.failed ? 1 : 0;
})().catch((error) => { console.error(error); process.exitCode = 1; });
