'use strict';
// Execute the actual typed browser helper with a minimal DOM and real Fetch
// response streams. No network or device command leaves this fixture.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(path.resolve(__dirname,
  '../../src-ts/runtime-executables/www/smarthome-feedback.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
function response(data = { ok: true, state: { on: true } }, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}
async function settle() { for (let i = 0; i < 12; i++) await new Promise(resolve => setImmediate(resolve)); }

function fixture(send = async () => response()) {
  const handlers = new Map(); const windowHandlers = new Map();
  const timers = new Map(); let timerId = 0; let now = 10000;
  const calls = []; const vibrations = [];
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null;
      this.className = ''; this.dataset = {}; this.attrs = {}; this.hidden = false;
      this.textContent = ''; this.disabled = false; this.type = '';
      this.classList = { contains: name => this.className.split(/\s+/).includes(name) };
    }
    appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    matches(selector) {
      if (selector.includes(',')) return selector.split(',').some(part => this.matches(part.trim()));
      if (selector === ':disabled') return this.disabled;
      if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
      if (selector === '[inert]') return Object.hasOwn(this.attrs, 'inert');
      if (selector === '[aria-disabled="true"]') return this.attrs['aria-disabled'] === 'true';
      if (selector === '[role="button"]') return this.attrs.role === 'button';
      if (selector === 'input[type="range"]') return this.tagName === 'INPUT' && this.type === 'range';
      return this.tagName.toLowerCase() === selector;
    }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
  }
  const body = new Element('body');
  const document = {
    hidden: false,
    createElement: tag => new Element(tag),
    addEventListener(name, callback) { const list = handlers.get(name) || []; list.push(callback); handlers.set(name, list); },
    querySelectorAll: selector => body.querySelectorAll(selector),
  };
  const window = {
    addEventListener(name, callback) { const list = windowHandlers.get(name) || []; list.push(callback); windowHandlers.set(name, list); },
    matchMedia: () => ({ matches: false }),
  };
  class ClockDate extends Date { static now() { return now; } }
  const context = { document, window, Element, HTMLElement: Element, Date: ClockDate,
    navigator: { vibrate: duration => vibrations.push(duration) },
    AbortController, TextDecoder, queueMicrotask, console,
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, due: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
    fetch: (endpoint, options) => { calls.push({ endpoint, options }); return send(endpoint, options); },
  };
  vm.runInNewContext(source, context, { filename: 'smarthome-feedback.js' });
  const api = window.NW_SH_FEEDBACK;
  function tile(id = 'light.0', className = 'nw-sh-tile') {
    const root = new Element('div'); root.className = className; body.appendChild(root);
    api.attachStatus(root, id); return root;
  }
  function fire(name, target, patch = {}, where = handlers) {
    const event = { target, defaultPrevented: false, isTrusted: true,
      isPrimary: true, button: 0, pointerId: 1, clientX: 10, clientY: 20,
      preventDefault() { this.defaultPrevented = true; }, ...patch };
    for (const callback of where.get(name) || []) callback(event);
    return event;
  }
  async function advance(ms) {
    now += ms;
    for (;;) {
      const due = [...timers].find(([, value]) => value.due <= now);
      if (!due) break;
      timers.delete(due[0]); due[1].callback(); await settle();
    }
    await settle();
  }
  return { api, body, tile, document, window, handlers, calls, vibrations, Element, fire, advance,
    windowEvent: name => fire(name, window, {}, windowHandlers),
    status: root => root.children.find(child => child.classList.contains('nw-sh-command-status')),
    timers,
  };
}

test('hands commands to the existing fetch/CSRF boundary and reports only EOS handoff', async () => {
  const f = fixture(); const tile = f.tile(); const status = f.status(tile);
  const operation = f.api.post('/api/smarthome/toggle', { id: 'light.0', value: false }, 'light.0');
  assert.equal(status.dataset.state, 'sending');
  const result = await operation;
  assert.equal(result.ok, true); assert.equal(result.state.on, true);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].endpoint, '/api/smarthome/toggle');
  assert.equal(f.calls[0].options.body, '{"id":"light.0","value":false}');
  assert.equal(f.calls[0].options.method, 'POST');
  assert.equal(f.calls[0].options.cache, 'no-store');
  assert.ok(f.calls[0].options.signal instanceof AbortSignal);
  assert.equal(status.textContent, 'An EOS übergeben');
  assert.equal(status.dataset.state, 'sent');
  assert.equal(status.attrs['aria-live'], 'polite');
  assert.equal(status.attrs.role, 'status');
  assert.doesNotMatch(status.textContent, /ausgeführt|Gerät bestätigt/i);
  f.api.attachStatus(tile, 'light.0'); assert.equal(tile.children.length, 1);
  const replacement = f.tile(); assert.equal(f.status(replacement).textContent, status.textContent);
  await f.advance(6001); assert.equal(status.hidden, true); assert.equal(f.timers.size, 0);
});

test('identical in-flight impulses are deduplicated, STOP is independent and older completion cannot overwrite it', async () => {
  const earlier = deferred(); const stop = deferred();
  const f = fixture((_url, options) => JSON.parse(options.body).action === 'stop' ? stop.promise : earlier.promise);
  const tile = f.tile('blind.0');
  const one = f.api.post('/api/smarthome/cover', { id: 'blind.0', action: 'up' }, 'blind.0');
  const duplicate = f.api.post('/api/smarthome/cover', { id: 'blind.0', action: 'up' }, 'blind.0');
  assert.equal(one, duplicate); assert.equal(f.calls.length, 1);
  const halt = f.api.post('/api/smarthome/cover', { id: 'blind.0', action: 'stop' }, 'blind.0');
  assert.equal(f.calls.length, 2, 'stop must reach fetch while movement is still pending');
  stop.resolve(response()); await halt;
  earlier.resolve(response({ ok: false }, 500)); await one;
  assert.equal(f.status(tile).dataset.state, 'sent');
  assert.equal(f.status(tile).textContent, 'An EOS übergeben');
});

test('deadline aborts the actual request, settles even a hung wrapper, and never retries', async () => {
  const late = deferred(); const f = fixture(() => late.promise); const tile = f.tile();
  const operation = f.api.post('/api/smarthome/toggle', { id: 'light.0' }, 'light.0');
  await f.advance(4999); assert.equal(f.calls[0].options.signal.aborted, false);
  await f.advance(1); assert.equal(await operation, null);
  assert.equal(f.calls[0].options.signal.aborted, true);
  assert.equal(f.status(tile).dataset.state, 'timeout');
  assert.match(f.status(tile).textContent, /Gerätestatus prüfen/);
  late.resolve(response()); await settle();
  assert.equal(f.status(tile).dataset.state, 'timeout', 'late result cannot fabricate success');
  assert.equal(f.calls.length, 1);
});

test('session, rights, HTTP, JSON, network and unconfirmed replies stay safe and visible', async () => {
  const cases = [
    [async () => response({}, 401), /Sitzung abgelaufen/],
    [async () => response({}, 403), /Keine Freigabe/],
    [async () => response({}, 409), /nicht bestätigt/],
    [async () => response({}, 503), /nicht bestätigt/],
    [async () => new Response('{broken json'), /nicht bestätigt/],
    [async () => response({ ok: false }), /nicht bestätigt/],
    [async () => response({ ok: 'true' }), /nicht bestätigt/],
    [async () => response(null), /nicht bestätigt/],
    [async () => { throw new Error('secret connection detail'); }, /nicht bestätigt/],
  ];
  for (const [send, message] of cases) {
    const f = fixture(send); const tile = f.tile();
    assert.equal(await f.api.post('/api/smarthome/level', { id: 'light.0', level: 0 }, 'light.0'), null);
    assert.equal(f.status(tile).dataset.state, 'error');
    assert.match(f.status(tile).textContent, message);
    assert.doesNotMatch(f.status(tile).textContent, /secret/);
    assert.equal(f.calls.length, 1);
  }
});

test('response limit cancels streaming data and endpoint/payload validation makes no network request', async () => {
  let cancelled = false;
  const f = fixture(async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(128 * 1024 + 1)); },
    cancel() { cancelled = true; },
  })));
  f.tile();
  assert.equal(await f.api.post('/api/smarthome/value', { id: 'light.0', value: 4 }, 'light.0'), null);
  assert.equal(cancelled, true);
  const g = fixture(); g.tile();
  for (const endpoint of ['https://other.invalid/command', '/api/smarthome/value?admin=true', '/api/smarthome/devices']) {
    assert.equal(await g.api.post(endpoint, { id: 'light.0' }, 'light.0'), null);
  }
  const circular = {}; circular.self = circular;
  for (const payload of [null, [], circular, { text: 'x'.repeat(33 * 1024) }]) {
    assert.equal(await g.api.post('/api/smarthome/value', payload, 'light.0'), null);
  }
  assert.equal(g.calls.length, 0);
});

test('normal request capacity is bounded, STOP has reserved capacity, and page exit aborts pending work', async () => {
  const f = fixture(() => new Promise(() => {}));
  const operations = [];
  for (let i = 0; i < 48; i++) operations.push(f.api.post('/api/smarthome/toggle', { id: 'device.' + i }, 'device.' + i));
  assert.equal(await f.api.post('/api/smarthome/toggle', { id: 'extra' }, 'extra'), null);
  operations.push(f.api.post('/api/smarthome/cover', { id: 'blind.0', action: 'stop' }, 'blind.0'));
  assert.equal(f.calls.length, 49);
  f.windowEvent('pagehide');
  assert.ok(f.calls.every(call => call.options.signal.aborted));
  assert.ok((await Promise.all(operations)).every(result => result === null));
  await f.advance(15001); assert.equal(f.timers.size, 0);
});

test('feedback retention is bounded and does not retain DOM nodes for removed devices', async () => {
  const f = fixture();
  for (let i = 0; i < 270; i++) await f.api.post('/api/smarthome/toggle', { id: 'device.' + i }, 'device.' + i);
  assert.equal(f.status(f.tile('device.0')).hidden, true);
  assert.equal(f.status(f.tile('device.269')).textContent, 'An EOS übergeben');
  assert.equal(f.timers.size, 1, 'one cleanup timer covers all retained feedback');
  await f.advance(15001); assert.equal(f.timers.size, 0);
});

test('press feedback is immediate, keyboard accessible and cancelled by movement, scroll, cancellation and focus loss', () => {
  const f = fixture(); const tile = f.tile(); const button = tile.appendChild(new f.Element('button'));
  f.api.install(); f.api.install(); assert.equal(f.handlers.get('pointerdown').length, 1);
  f.fire('pointerdown', button); assert.equal(button.dataset.shPressed, 'true');
  f.fire('pointermove', button, { clientX: 30 }); assert.equal(button.dataset.shPressed, undefined);
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture', 'scroll', 'focusout']) {
    f.fire('pointerdown', button); f.fire(event, button); assert.equal(button.dataset.shPressed, undefined, event);
  }
  f.fire('keydown', button, { key: ' ' }); assert.equal(button.dataset.shPressed, 'true');
  f.fire('keyup', button, { key: ' ' }); assert.equal(button.dataset.shPressed, undefined);
  f.fire('keydown', button, { key: 'Enter' }); f.windowEvent('blur'); assert.equal(button.dataset.shPressed, undefined);
  button.disabled = true; f.fire('pointerdown', button); assert.equal(button.dataset.shPressed, undefined);
  assert.equal(f.calls.length, 0, 'visual press and keyboard state never create a device command');
});

test('haptics are optional and never fire for ranges, synthetic/cancelled clicks or scrolling', async () => {
  const f = fixture(); const tile = f.tile(); const button = tile.appendChild(new f.Element('button'));
  const range = tile.appendChild(new f.Element('input')); range.type = 'range';
  f.fire('click', range); f.fire('click', button, { isTrusted: false }); f.fire('click', button, { defaultPrevented: true });
  await settle(); assert.deepEqual(f.vibrations, []);
  f.fire('pointerdown', button); f.fire('scroll', button); f.fire('click', button);
  await settle(); assert.deepEqual(f.vibrations, []);
  await f.advance(401); f.fire('click', button); await settle(); assert.deepEqual(f.vibrations, [8]);
  f.window.matchMedia = () => ({ matches: true }); f.fire('click', button); await settle(); assert.deepEqual(f.vibrations, [8]);
  assert.equal(f.calls.length, 0);
});


test('a second STOP after intervening movement always reaches fetch while the first STOP is pending', async () => {
  const requests = [];
  const f = fixture(() => { const request = deferred(); requests.push(request); return request.promise; });
  const tile = f.tile('blind.0');
  const first = f.api.post('/api/smarthome/cover', { id: 'blind.0', action: 'stop' }, 'blind.0');
  const movement = f.api.post('/api/smarthome/cover', { id: 'blind.0', action: 'down' }, 'blind.0');
  const last = f.api.post('/api/smarthome/cover', { id: 'blind.0', action: 'stop' }, 'blind.0');
  assert.notEqual(first, last);
  assert.deepEqual(f.calls.map(call => JSON.parse(call.options.body).action), ['stop', 'down', 'stop']);
  requests[2].resolve(response()); await last;
  requests[1].resolve(response({}, 500)); await movement;
  requests[0].resolve(response({}, 500)); await first;
  assert.equal(f.status(tile).dataset.state, 'sent', 'old failures cannot overwrite the newest STOP handoff');
});

test('timer saves accept the full retained collection beyond128KiB and still cancel replies above1MiB', async () => {
  const config = { version: 1, updatedAt: 123, timers: Array.from({ length: 2200 }, (_, index) => ({
    deviceId: 'existing.device.' + index, enabled: true, days: [0, 1, 2, 3, 4, 5, 6], onTime: '07:00', offTime: '22:00',
  })) };
  const size = Buffer.byteLength(JSON.stringify({ ok: true, config }));
  assert.ok(size > 128 * 1024 && size < 512 * 1024);
  const f = fixture(async () => response({ ok: true, config })); const tile = f.tile();
  const saved = await f.api.post('/api/smarthome/timers', { deviceId: 'light.0', timer: { enabled: true } }, 'light.0');
  assert.equal(saved.config.timers.length, config.timers.length);
  assert.equal(saved.config.timers[2199].deviceId, config.timers[2199].deviceId);
  assert.equal(f.status(tile).dataset.state, 'sent');
  let cancelled = false;
  const oversized = fixture(async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); },
    cancel() { cancelled = true; },
  })));
  assert.equal(await oversized.api.post('/api/smarthome/timers', { deviceId: 'light.0', delete: true }, 'light.0'), null);
  assert.equal(cancelled, true);
});
