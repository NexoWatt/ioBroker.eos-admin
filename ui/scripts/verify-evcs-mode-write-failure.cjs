#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * NexoWatt EVCS: Modus-/Quellenwahl trennt HTTP-/Transportfehler und bestätigte States.
 * Ausführung: node scripts/verify-evcs-mode-write-failure.cjs --canonical
 * Ohne --canonical wird die ausgelieferte www/evcs.js geprüft (Vorher-Repro).
 * VM-Browsertest ohne Netzwerk/Geräte. Keine TypeScript-Abhängigkeit: Node >=24.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const canonical = process.argv.includes('--canonical');
const root = path.resolve(__dirname, '..');
const filename = path.join(root, canonical ? 'src-ts/runtime-executables/www/evcs.ts' : 'www/evcs.js');
let source = fs.readFileSync(filename, 'utf8');
if (canonical) source = stripTypeScriptTypes(source, { mode: 'strip' });
const hook = "  // Ereignis-Kommentar: Bindet das UI-Ereignis 'pointerdown' an document.";
assert(source.includes(hook), 'Mode handler test hook missing');
source = source.replace(hook, `
  globalThis.__modeTest = {
    handle: handleModeButton,
    read: (k) => state[k],
    merge: _mergeUpdatePayload,
    snapshot: (payload) => typeof _replaceStateSnapshot === 'function' ? _replaceStateSnapshot(payload) : (state = payload),
    pending: (k) => typeof _modeWriteRequests !== 'undefined' && (_modeWriteRequests instanceof Map ? _modeWriteRequests.has(k) : !!_modeWriteRequests[k]),
    error: (k) => typeof _modeWriteErrors !== 'undefined' ? (_modeWriteErrors instanceof Map ? _modeWriteErrors.get(k) : _modeWriteErrors[k]) || '' : '',
    seed: (payload) => { state = payload; }
  };
${hook}`);
const key = (idx = 1) => `chargingManagement.wallboxes.lp${idx}.userMode`;
const sourceKey = (idx = 1) => `chargingManagement.wallboxes.lp${idx}.userAutoSource`;
const clone = (value) => JSON.parse(JSON.stringify(value));
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => clone(payload) });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const flush = async () => { for (let i = 0; i < 12; i += 1) await Promise.resolve(); };

function harness() {
  const calls = [];
  const timers = new Map();
  let timerId = 0;
  let ts = 1000;
  const backend = { [key()]: { value: 'pv', ts }, [key(2)]: { value: 'pv', ts }, [sourceKey()]: { value: 'standard', ts }, [sourceKey(2)]: { value: 'standard', ts } };
  const controls = [];
  for (const idx of [1, 2]) for (const mode of ['auto', 'boost', 'minpv', 'pv']) {
    const active = new Set(mode === 'pv' ? ['active'] : []);
    controls.push({
      idx, mode, disabled: false,
      matches: (selector) => selector === 'button[data-ems-mode-btn]',
      getAttribute: (name) => name === 'data-ems-mode-btn' ? String(idx) : name === 'data-mode' ? mode : null,
      classList: { toggle: (name, value) => value ? active.add(name) : active.delete(name), contains: (name) => active.has(name) }
    });
  }
  for (const idx of [1, 2]) for (const autoSource of ['standard', 'strategy']) {
    const active = new Set(autoSource === 'standard' ? ['active'] : []);
    controls.push({
      idx, autoSource, disabled: false,
      matches: (selector) => selector === 'button[data-ems-auto-source-btn]',
      getAttribute: (name) => name === 'data-ems-auto-source-btn' ? String(idx) : name === 'data-auto-source' ? autoSource : null,
      classList: { toggle: (name, value) => value ? active.add(name) : active.delete(name), contains: (name) => active.has(name) }
    });
  }
  const h = { calls, backend, timers, controls };
  h.transport = async (url, options) => {
    if (url === '/api/set') {
      const body = JSON.parse(options.body);
      const idx = Number(body.key.split('.')[1]);
      backend[body.key.endsWith('.autoSource') ? sourceKey(idx) : key(idx)] = { value: body.value, ts: ++ts };
      return response({ ok: true });
    }
    if (url === '/api/state') return response(backend);
    throw new Error(`Unexpected request ${url}`);
  };
  const context = vm.createContext({
    console, AbortController,
    window: {},
    document: {
      addEventListener() {}, getElementById: () => null,
      querySelectorAll: (selector) => {
        const match = selector.match(/data-ems-mode-btn="(\d+)"/);
        if (match) return controls.filter((button) => button.idx === Number(match[1]) && button.mode);
        const sourceMatch = selector.match(/data-ems-auto-source-btn="(\d+)"/);
        return sourceMatch ? controls.filter((button) => button.idx === Number(sourceMatch[1]) && button.autoSource) : [];
      }
    },
    setTimeout: (fn, ms) => { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout: (id) => timers.delete(id),
    fetch: async (url, options = {}) => { calls.push({ url, options }); return h.transport(url, options); }
  });
  vm.runInContext(source, context, { filename });
  vm.runInContext('scheduleRender = () => {}; bindControls();', context);
  Object.assign(h, context.__modeTest);
  h.seed(clone(backend));
  h.button = (mode, idx = 1) => controls.find((button) => button.idx === idx && button.mode === mode);
  h.click = (mode, idx = 1) => h.handle(h.button(mode, idx));
  h.sourceButton = (autoSource, idx = 1) => controls.find((button) => button.idx === idx && button.autoSource === autoSource);
  h.clickSource = (autoSource, idx = 1) => h.handle(h.sourceButton(autoSource, idx));
  return h;
}

const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, passed: true }); }
  catch (error) { results.push({ name, passed: false, error: error.message }); }
}
(async () => {
  for (const failure of ['HTTP 401', 'HTTP 403', 'HTTP 500', 'JSON ok=false', 'invalid JSON', 'network error']) {
    await test(`Rejected Auto (${failure}) retains confirmed PV`, async () => {
      const h = harness();
      h.transport = async (url) => {
        if (url === '/api/state') return response(h.backend);
        if (failure.startsWith('HTTP ')) return response({ ok: false }, Number(failure.slice(5)));
        if (failure === 'JSON ok=false') return response({ ok: false });
        if (failure === 'invalid JSON') return { ok: true, json: async () => { throw new SyntaxError('HTML login response'); } };
        throw new Error('Network unavailable');
      };
      await h.click('auto');
      assert.equal(h.read(key()).value, 'pv', 'rejected Auto must never stay selected locally');
      assert(h.button('pv').classList.contains('active'));
      assert(h.error(key()), 'failure must be visible');
      assert(!h.pending(key()));
    });
  }
  for (const mode of ['auto', 'boost', 'minpv', 'pv']) {
    await test(`Confirmed ${mode} follows API/state`, async () => {
      const h = harness();
      await h.click(mode);
      assert.equal(h.read(key()).value, mode);
      assert(h.button(mode).classList.contains('active'));
      assert.equal(h.error(key()), '');
      assert.deepEqual(h.calls.map((call) => call.url), ['/api/set', '/api/state']);
      assert.equal(h.calls[1].options.cache, 'no-store');
      assert.equal(h.timers.size, 0, 'request timers must be cleared');
    });
  }
  await test('Pending request does not display requested Auto; duplicate click is serialized', async () => {
    const h = harness();
    const post = deferred(), get = deferred();
    h.transport = (url) => url === '/api/set' ? post.promise : get.promise;
    const first = h.click('auto');
    assert.equal(h.read(key()).value, 'pv');
    assert(!h.button('auto').classList.contains('active'));
    assert(h.pending(key()));
    await h.click('boost');
    assert.equal(h.calls.length, 1, 'same-point concurrent requests must not race');
    post.resolve(response({ ok: true })); await flush();
    assert.equal(h.read(key()).value, 'pv', 'write acknowledgment alone has no mode value');
    get.resolve(response({ [key()]: { value: 'auto', ts: 2000 } }));
    await first;
    assert.equal(h.read(key()).value, 'auto');
    assert(!h.pending(key()));
  });
  await test('Boost cancellation still requests Auto', async () => {
    const h = harness();
    await h.click('boost'); await h.click('boost');
    assert.equal(h.read(key()).value, 'auto');
    assert.equal(JSON.parse(h.calls[2].options.body).value, 'auto');
  });
  await test('Legacy min+pv button alias still writes minpv', async () => {
    const h = harness();
    const button = h.button('minpv');
    await h.handle({ ...button, getAttribute: (name) => name === 'data-mode' ? 'min+pv' : button.getAttribute(name) });
    assert.equal(JSON.parse(h.calls[0].options.body).value, 'minpv');
    assert.equal(h.read(key()).value, 'minpv');
  });
  await test('Different charge points are independent', async () => {
    const h = harness(), first = deferred();
    const normal = h.transport;
    h.transport = (url, options) => url === '/api/set' && JSON.parse(options.body).key === 'evcs.1.userMode'
      ? first.promise : normal(url, options);
    const p = h.click('auto');
    await h.click('boost', 2);
    assert.equal(h.read(key(2)).value, 'boost');
    assert(h.pending(key()));
    first.resolve(response({ ok: false })); await p;
    assert.equal(h.read(key()).value, 'pv');
    assert.equal(h.read(key(2)).value, 'boost');
  });
  await test('Older readback cannot overwrite newer authoritative SSE mode', async () => {
    const h = harness(), snapshot = deferred();
    h.transport = async (url) => url === '/api/set' ? response({ ok: true }) : snapshot.promise;
    const p = h.click('auto'); await flush();
    h.merge({ [key()]: { value: 'boost', ts: 3000 } });
    snapshot.resolve(response({ [key()]: { value: 'auto', ts: 2000 } }));
    await p;
    assert.equal(h.read(key()).value, 'boost');
    assert(h.error(key()), 'intervening server mode change must not pretend success');
    h.merge({ [key()]: { value: 'pv', ts: 1000 } });
    assert.equal(h.read(key()).value, 'boost', 'old stream/snapshot data cannot roll mode back');
  });
  await test('Failed request may already be applied; readback is authoritative', async () => {
    const h = harness();
    h.transport = async (url) => {
      if (url === '/api/set') { h.backend[key()] = { value: 'auto', ts: 2000 }; throw new Error('connection lost after write'); }
      return response(h.backend);
    };
    await h.click('auto');
    assert.equal(h.read(key()).value, 'auto');
    assert.equal(h.error(key()), '', 'authoritative readback confirms the mode despite a lost write response');
  });
  await test('Full snapshot removes missing non-mode keys while retaining a newer included mode', async () => {
    const h = harness();
    h.seed({ [key()]: { value: 'boost', ts: 3000 }, 'evcs.1.status': { value: 'obsolete', ts: 3000 } });
    h.snapshot({ [key()]: { value: 'auto', ts: 2000 }, 'evcs.1.powerW': { value: 11000, ts: 2000 } });
    assert.equal(h.read(key()).value, 'boost');
    assert.equal(h.read('evcs.1.status'), undefined, 'full snapshot must remove absent non-mode keys');
    assert.equal(h.read('evcs.1.powerW').value, 11000);
    h.snapshot({ [key()]: { value: 'pv', ts: 4000 } });
    assert.equal(h.read(key()).value, 'pv', 'newer included server mode must replace old mode');
    assert.equal(h.read('evcs.1.powerW'), undefined);
  });
  await test('Full snapshot does not resurrect a missing mode for a removed charge point', async () => {
    const h = harness();
    h.seed({ [key()]: { value: 'boost', ts: 3000 }, [key(2)]: { value: 'auto', ts: 3000 } });
    h.snapshot({ [key(2)]: { value: 'auto', ts: 3000 } });
    assert.equal(h.read(key()), undefined, 'removed charge-point mode must stay absent');
    assert.equal(h.read(key(2)).value, 'auto');
  });
  await test('Missing or failed state readback keeps last confirmed mode with warning', async () => {
    for (const readback of [response({}), response({ ok: false }, 500)]) {
      const h = harness();
      h.transport = async (url) => url === '/api/set' ? response({ ok: true }) : readback;
      await h.click('auto');
      assert.equal(h.read(key()).value, 'pv');
      assert(h.error(key()));
      assert(!h.pending(key()));
    }
  });
  await test('Timeout aborts pending request and allows subsequent retry', async () => {
    const h = harness();
    const normal = h.transport;
    h.transport = (url, options) => url === '/api/set' ? new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }) : normal(url, options);
    const p = h.click('auto');
    const timer = [...h.timers.values()].find((entry) => entry.ms === 10000);
    assert(timer, 'pending fetch needs bounded lifetime'); timer.fn();
    await p;
    assert.equal(h.read(key()).value, 'pv');
    assert(!h.pending(key()));
    h.transport = normal; await h.click('auto');
    assert.equal(h.read(key()).value, 'auto');
  });
  await test('Disabled and invalid controls do not write', async () => {
    const h = harness();
    h.button('boost').disabled = true; await h.click('boost');
    const button = h.button('auto');
    await h.handle({ ...button, getAttribute: (name) => name === 'data-ems-mode-btn' ? 'NaN' : button.getAttribute(name) });
    assert.equal(h.calls.length, 0);
  });
  for (const failure of ['HTTP 401', 'HTTP 403', 'HTTP 500', 'JSON ok=false', 'invalid JSON', 'network error']) {
    await test(`Rejected Auto source (${failure}) retains confirmed Standard`, async () => {
      const h = harness();
      h.transport = async (url) => {
        if (url === '/api/state') return response(h.backend);
        if (failure.startsWith('HTTP ')) return response({ ok: false }, Number(failure.slice(5)));
        if (failure === 'JSON ok=false') return response({ ok: false });
        if (failure === 'invalid JSON') return { ok: true, json: async () => { throw new SyntaxError('HTML login response'); } };
        throw new Error('Network unavailable');
      };
      await h.clickSource('strategy');
      assert.equal(h.read(sourceKey()).value, 'standard');
      assert(h.sourceButton('standard').classList.contains('active'));
      assert(h.error(sourceKey()));
      assert(!h.pending(sourceKey()));
    });
  }
  for (const autoSource of ['standard', 'strategy']) {
    await test(`Confirmed Auto source ${autoSource} follows API/state`, async () => {
      const h = harness();
      await h.clickSource(autoSource);
      assert.equal(h.read(sourceKey()).value, autoSource);
      assert(h.sourceButton(autoSource).classList.contains('active'));
      assert.equal(h.error(sourceKey()), '');
      assert.deepEqual(h.calls.map((call) => call.url), ['/api/set', '/api/state']);
      assert.equal(h.calls[1].options.cache, 'no-store');
      assert.equal(h.timers.size, 0);
    });
  }
  await test('Mode and Auto source serialize per charge point in both directions', async () => {
    for (const sourceFirst of [false, true]) {
      const h = harness(), post = deferred();
      const normal = h.transport;
      h.transport = (url, options) => url === '/api/set' ? post.promise : normal(url, options);
      const first = sourceFirst ? h.clickSource('strategy') : h.click('auto');
      assert.equal(h.read(sourceKey()).value, 'standard');
      const second = sourceFirst ? h.click('auto') : h.clickSource('strategy');
      const duplicate = sourceFirst ? h.clickSource('standard') : Promise.resolve();
      await flush();
      assert.equal(h.calls.length, 1, 'same-point source/mode requests cannot overtake');
      post.resolve(response({ ok: false })); await first;
      await second; await duplicate;
      assert(!h.pending(sourceKey())); assert(!h.pending(key()));
    }
  });
  await test('Auto source writes on different charge points remain independent', async () => {
    const h = harness(), first = deferred(), normal = h.transport;
    h.transport = (url, options) => url === '/api/set' && JSON.parse(options.body).key === 'evcs.1.autoSource' ? first.promise : normal(url, options);
    const pending = h.clickSource('strategy');
    await h.clickSource('strategy', 2);
    assert.equal(h.read(sourceKey(2)).value, 'strategy');
    assert(h.pending(sourceKey()));
    first.resolve(response({ ok: false })); await pending;
    assert.equal(h.read(sourceKey()).value, 'standard');
  });
  await test('Older source readback and full snapshots cannot overwrite newer SSE source', async () => {
    const h = harness(), snapshot = deferred();
    h.transport = async (url) => url === '/api/set' ? response({ ok: true }) : snapshot.promise;
    const pending = h.clickSource('strategy'); await flush();
    h.merge({ [sourceKey()]: { value: 'standard', ts: 3000 } });
    snapshot.resolve(response({ [sourceKey()]: { value: 'strategy', ts: 2000 } }));
    await pending;
    assert.equal(h.read(sourceKey()).value, 'standard');
    assert(h.error(sourceKey()));
    h.snapshot({ [sourceKey()]: { value: 'strategy', ts: 2000 } });
    assert.equal(h.read(sourceKey()).value, 'standard');
    h.snapshot({}); assert.equal(h.read(sourceKey()), undefined);
  });
  await test('Lost Auto source write response can be confirmed by readback', async () => {
    const h = harness();
    h.transport = async (url) => {
      if (url === '/api/set') { h.backend[sourceKey()] = { value: 'strategy', ts: 2000 }; throw new Error('lost response'); }
      return response(h.backend);
    };
    await h.clickSource('strategy');
    assert.equal(h.read(sourceKey()).value, 'strategy');
    assert.equal(h.error(sourceKey()), '');
    assert.deepEqual(h.calls.map((call) => call.url), ['/api/set', '/api/state']);
  });
  await test('Invalid or failed Auto source readback retains confirmed value with warning', async () => {
    for (const readback of [response({}), response({ [sourceKey()]: { value: 'default', ts: 2000 } }), response({ ok: false }, 500)]) {
      const h = harness();
      h.transport = async (url) => url === '/api/set' ? response({ ok: true }) : readback;
      await h.clickSource('strategy');
      assert.equal(h.read(sourceKey()).value, 'standard');
      assert(h.error(sourceKey())); assert(!h.pending(sourceKey()));
    }
  });
  await test('Auto source timeout aborts and permits retry', async () => {
    const h = harness(), normal = h.transport;
    h.transport = (url, options) => url === '/api/set' ? new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }) : normal(url, options);
    const pending = h.clickSource('strategy');
    const timer = [...h.timers.values()].find((entry) => entry.ms === 10000);
    assert(timer, 'source request needs bounded lifetime'); timer.fn(); await pending;
    assert.equal(h.read(sourceKey()).value, 'standard'); assert(!h.pending(sourceKey()));
    h.transport = normal; await h.clickSource('strategy');
    assert.equal(h.read(sourceKey()).value, 'strategy');
  });
  await test('Disabled or invalid Auto source controls do not write', async () => {
    const h = harness();
    h.sourceButton('strategy').disabled = true; await h.clickSource('strategy');
    const button = h.sourceButton('standard');
    await h.handle({ ...button, getAttribute: (name) => name === 'data-ems-auto-source-btn' ? '1.5' : button.getAttribute(name) });
    assert.equal(h.calls.length, 0);
  });
  await test('Full snapshots and SSE maps treat prototype keys as data', async () => {
    const h = harness();
    h.snapshot(JSON.parse('{"__proto__":{"polluted":true},"constructor":{"value":"data"}}'));
    assert.equal(h.read('__proto__').polluted, true);
    assert.equal(h.read('constructor').value, 'data');
    assert.equal(h.read('polluted'), undefined);
    h.merge(JSON.parse('{"__proto__":{"polluted":false}}'));
    assert.equal(h.read('__proto__').polluted, false);
    assert.equal(h.read('polluted'), undefined);
    h.snapshot({});
    assert.equal(h.read('__proto__'), undefined);
    assert.equal(h.read('constructor'), undefined);
  });
  for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.name}${result.error ? `: ${result.error}` : ''}`);
  const failed = results.filter((result) => !result.passed).length;
  console.log(JSON.stringify({ source: path.relative(root, filename), node: process.version, passed: results.length - failed, failed }));
  process.exitCode = failed ? 1 : 0;
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });
