/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * SmartHome 9.0.9: reproduzierbare Runtime-/DOM-Simulation ohne Browser oder
 * Zusatzabhängigkeit. Prüft echte Kunden-Runtime, Dialog-Lifecycle, Payloads,
 * Qualität und Aktualisierung. Dies ist kein Layout-, Geräte- oder Browsertest.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const runtime = process.env.EOS_TEST_RUNTIME === 'build' ? 'build' : 'source';
const root = path.resolve(__dirname, '../..');
function runtimeCode(name) {
  const file = runtime === 'build' ? path.join(root, 'www', name + '.js') : path.join(root, 'src-ts/runtime-executables/www', name + '.ts');
  const text = fs.readFileSync(file, 'utf8');
  return runtime === 'build' ? text : ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
}

function harness({ helpers = true } = {}) {
  let document;
  const handlers = {};
  const timers = new Map();
  const frames = [];
  let timerId = 0;
  let fetchMode = 'ok';
  const promises = [];
  class Event {
    constructor(type, options = {}) { Object.assign(this, { type, bubbles: true, cancelable: true, defaultPrevented: false, stopped: false, immediate: false }, options); }
    preventDefault() { if (this.cancelable) this.defaultPrevented = true; }
    stopPropagation() { this.stopped = true; }
    stopImmediatePropagation() { this.stopped = true; this.immediate = true; }
  }
  const listen = (events, name, handler, options = {}) => { (events[name] ||= []).push({ handler, capture: options === true || !!options.capture }); };
  function dispatch(target, event) {
    event.target = target;
    const ancestors = []; let parent = target.parentElement;
    while (parent) { ancestors.unshift(parent); parent = parent.parentElement; }
    if (target !== window) {
      if (target !== document) ancestors.unshift(document);
      ancestors.unshift(window);
    }
    const invoke = (current, capture) => {
      event.currentTarget = current;
      for (const entry of current.events?.[event.type] || []) {
        if (entry.capture === capture) {
          const result = entry.handler(event);
          if (result && typeof result.then === 'function') promises.push(result);
        }
        if (event.immediate) break;
      }
    };
    for (const item of [...ancestors, target]) { invoke(item, true); if (event.stopped) return !event.defaultPrevented; }
    invoke(target, false);
    if (event.bubbles && !event.stopped) for (const item of ancestors.reverse()) { invoke(item, false); if (event.stopped) break; }
    return !event.defaultPrevented;
  }
  async function drain() { while (promises.length) await Promise.all(promises.splice(0)); }
  async function fire(target, name, options = {}) { const event = new Event(name, options); dispatch(target, event); await drain(); return event; }
  class Element {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase();
      this.children = [];
      this.parentElement = null;
      this.dataset = {};
      this.attributes = {};
      this.events = {};
      this.className = '';
      this.style = { setProperty(name, value) { this[name] = value; } };
      this.disabled = false;
      this.hidden = false;
      this._text = '';
      this.value = '';
      this.tabIndex = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A'].includes(this.tagName) ? 0 : -1;
      this.offsetWidth = 620;
      this.offsetHeight = 440;
    }
    get classList() {
      const read = () => new Set(this.className.split(/\s+/).filter(Boolean));
      const write = (set) => { this.className = [...set].join(' '); };
      return {
        add: (...items) => { const set = read(); items.forEach((item) => set.add(item)); write(set); },
        remove: (...items) => { const set = read(); items.forEach((item) => set.delete(item)); write(set); },
        contains: (item) => read().has(item),
        toggle: (item, force) => { const set = read(); const yes = force === undefined ? !set.has(item) : force; if (yes) set.add(item); else set.delete(item); write(set); return yes; },
      };
    }
    get childNodes() { return this.children; }
    get firstChild() { return this.children[0] || null; }
    get isConnected() { return this === document.documentElement || !!(this.parentElement && this.parentElement.isConnected); }
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
    set textContent(value) { this.children.forEach((child) => { child.parentElement = null; }); this.children = []; this._text = String(value); }
    set innerHTML(value) { this.textContent = ''; this._html = String(value); }
    get innerHTML() { return this._html || ''; }
    appendChild(child) { if (child.parentElement) child.parentElement.removeChild(child); this.children.push(child); child.parentElement = this; return child; }
    append(...items) { items.forEach((item) => this.appendChild(item)); }
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentElement = null; return child; }
    replaceWith(next) { const parent = this.parentElement; const index = parent.children.indexOf(this); parent.children[index] = next; next.parentElement = parent; this.parentElement = null; }
    setAttribute(name, value) { this.attributes[name] = String(value); if (name === 'id') this.id = String(value); if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase())] = String(value); }
    getAttribute(name) { if (name === 'id') return this.id || null; return this.attributes[name] ?? null; }
    hasAttribute(name) { return Object.prototype.hasOwnProperty.call(this.attributes, name); }
    removeAttribute(name) { delete this.attributes[name]; }
    addEventListener(name, handler, options) { listen(this.events, name, handler, options); }
    dispatchEvent(event) { return dispatch(this, event); }
    getContext() { return null; }
    contains(other) { return this === other || this.children.some((child) => child.contains(other)); }
    matches(selector) {
      return selector.split(',').some((part) => {
        const rule = part.trim();
        if (rule === ':disabled') return this.disabled;
        if (rule.startsWith('.')) return this.classList.contains(rule.slice(1));
        if (rule.startsWith('#')) return this.id === rule.slice(1);
        const match = rule.match(/^([a-z]+)?\[([^=\]]+)(?:="([^"]*)")?\]$/i);
        if (match) {
          if (match[1] && this.tagName !== match[1].toUpperCase()) return false;
          const key = match[2];
          const value = key.startsWith('data-') ? this.dataset[key.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase())] : (this[key] ?? this.attributes[key]);
          return match[3] === undefined ? value !== undefined && value !== false : String(value) === match[3];
        }
        return this.tagName === rule.toUpperCase();
      });
    }
    querySelectorAll(selector) { return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return this.matches(selector) ? this : (this.parentElement && this.parentElement.closest(selector)); }
    getClientRects() { return this.isConnected && !this.closest('[hidden], .hidden') ? [{}] : []; }
    getBoundingClientRect() { return { left: 0, top: 0, bottom: 100, width: 320, height: 100 }; }
    focus() { document.activeElement = this; }
    async fire(name, options = {}) { return fire(this, name, options); }
  }
  document = {
    createElement: (tag) => new Element(tag),
    createElementNS: (_ns, tag) => new Element(tag),
    events: handlers, hidden: false,
    addEventListener: (name, handler, options) => listen(handlers, name, handler, options),
    dispatchEvent: event => dispatch(document, event),
    querySelectorAll: (selector) => document.documentElement.querySelectorAll(selector),
    getElementById: (id) => document.documentElement.querySelector('#' + id),
  };
  document.documentElement = new Element('html');
  document.documentElement.clientWidth = 736;
  document.body = new Element('body');
  document.documentElement.appendChild(document.body);
  document.activeElement = document.body;
  const main = new Element('main');
  document.body.appendChild(main);
  const navToggle = new Element('button');
  navToggle.id = 'nwShNavToggle';
  main.appendChild(navToggle);
  const local = new Map();
  const apiCalls = [];
  const window = { innerWidth: 736, innerHeight: 900, scrollY: 35, events: {}, addEventListener(name, handler, options) { listen(this.events, name, handler, options); }, scrollTo() {}, open() {} };
  const context = vm.createContext({ document, window, console, URL, URLSearchParams, Event, Element, HTMLElement: Element, AbortController, TextDecoder, Response, performance: { now: () => 10000 },
    localStorage: { getItem: (key) => local.get(key) ?? null, setItem: (key, value) => local.set(key, String(value)), removeItem: (key) => local.delete(key) },
    requestAnimationFrame: (callback) => frames.push(callback),
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; }, clearTimeout: (id) => timers.delete(id),
    setInterval: () => 1, clearInterval() {},
    fetch: async (url, options) => {
      apiCalls.push({ url, body: options && options.body ? JSON.parse(options.body) : undefined });
      if (fetchMode === 'network') throw new Error('fixture network failure');
      if (fetchMode === 'json') return new Response('not-json');
      if (fetchMode === 'forbidden') return new Response('{}', { status: 403 });
      return new Response(JSON.stringify({ ok: true, state: { on: true }, config: { kept: true }, devices: [] }));
    },
  });
  if (helpers) for (const name of ['smarthome-touch', 'smarthome-feedback']) vm.runInContext(runtimeCode(name), context, { filename: name + '.js' });
  vm.runInContext(runtimeCode('smarthome'), context, { filename: 'smarthome.js' });
  return { context, document, window, main, local, apiCalls, run: (code) => vm.runInContext(code, context),
    fire, drain, setFetchMode: mode => { fetchMode = mode; },
    flushFrames: () => { while (frames.length) frames.shift()(); },
    async flushShortTimers() { const short = [...timers].filter(([, entry]) => entry.delay <= 1000); for (const [id, entry] of short) { timers.delete(id); await entry.callback(); } await drain(); },
  };
}

const device = (type = 'dimmer', patch = {}) => ({
  id: 'fixture-device', alias: 'Wohnzimmer Licht', type, room: 'Wohnzimmer', behavior: {},
  quality: { status: 'online' }, fieldQuality: { level: { status: 'online', valid: true, ts: 10, ageMs: 20 } },
  state: { on: true, level: 42, color: '#ffffff' },
  io: { switch: { readId: 'fixture.on', writeId: 'fixture.on' }, level: { readId: 'fixture.level', writeId: 'fixture.level', min: 10, max: 90, step: 5 }, color: { readId: 'fixture.color', writeId: 'fixture.color' } }, ...patch,
});
const down = input => input.fire('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, clientX: 20, clientY: 20 });
const up = h => h.fire(h.document, 'pointerup', { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 20 });
const json = value => JSON.parse(JSON.stringify(value));

test(`actual ${runtime} default dimmer/color cards expose bound inline controls with existing range and payload`, async () => {
  for (const type of ['dimmer', 'color']) {
    const h = harness(); h.context.nwReloadDevices = async () => {};
    const tile = h.context.nwCreateTile(device(type)); h.main.appendChild(tile);
    const range = tile.querySelector('input[type="range"]');
    assert.ok(range, type); assert.ok(tile.classList.contains('nw-sh-tile--size-m'));
    assert.equal(range.min, '10'); assert.equal(range.max, '90'); assert.equal(range.step, '5');
    assert.equal(range.disabled, false); assert.equal(range.style.touchAction, 'pan-y');
    assert.ok(tile.querySelector('.nw-sh-command-status'));
    assert.equal(h.apiCalls.length, 0, 'rendering cannot actuate');
    await down(range); range.value = '65'; await range.fire('input');
    assert.equal(h.apiCalls.length, 0, 'touch preview cannot actuate');
    await up(h);
    assert.deepEqual(h.apiCalls.map(call => ({ url: call.url, body: call.body })), [{ url: '/api/smarthome/level', body: { id: 'fixture-device', level: 65 } }]);
    assert.equal(tile.querySelector('.nw-sh-command-status').textContent, 'An EOS übergeben');
  }
});

test(`actual ${runtime} readonly/missing output bindings cannot write through the new inline control`, async () => {
  for (const patch of [{ behavior: { readOnly: true } }, { io: { level: { readId: 'fixture.level', min: 0, max: 100 }, switch: { readId: 'fixture.on', writeId: 'fixture.on' } } }]) {
    const h = harness(); const tile = h.context.nwCreateTile(device('dimmer', patch)); h.main.appendChild(tile);
    const input = tile.querySelector('input[type="range"]'); assert.ok(input); assert.equal(input.disabled, true);
    input.value = '75'; await input.fire('change');
    assert.deepEqual(h.apiCalls, []);
  }
  const h = harness(); const tile = h.context.nwCreateTile(device('switch', { quality: { status: 'offline' } }));
  assert.equal(tile.querySelector('.nw-sh-mini-toggle').disabled, true, 'unknown offline toggle is preserved');
});

test(`actual ${runtime} shared feedback keeps all device/timer API payloads and legacy return contracts`, async () => {
  const h = harness();
  const methods = [
    ['nwToggleDevice', ['fixture-device', false], '/toggle', { id: 'fixture-device', value: false }, { on: true }],
    ['nwToggleDevice', ['fixture-device'], '/toggle', { id: 'fixture-device' }, { on: true }],
    ['nwSetLevel', ['fixture-device', 65], '/level', { id: 'fixture-device', level: 65 }, { on: true }],
    ['nwSetColor', ['fixture-device', { color: '#123456', id: 'wrong' }], '/color', { color: '#123456', id: 'fixture-device' }, { on: true }],
    ['nwCoverAction', ['fixture-device', 'stop'], '/cover', { id: 'fixture-device', action: 'stop' }, true],
    ['nwPlayerAction', ['fixture-device', 'volume', 35], '/player', { id: 'fixture-device', action: 'volume', value: 35 }, { on: true }],
    ['nwSetRtrSetpoint', ['fixture-device', 22.5], '/rtrSetpoint', { id: 'fixture-device', setpoint: 22.5 }, { on: true }],
    ['nwClimateAction', ['fixture-device', 'mode', 'heat'], '/climate', { id: 'fixture-device', action: 'mode', value: 'heat' }, { on: true }],
    ['nwSetSmartHomeValue', ['fixture-device', 1], '/value', { id: 'fixture-device', value: 1 }, { on: true }],
    ['nwSaveDeviceTimer', ['fixture-device', { enabled: true }], '/timers', { deviceId: 'fixture-device', timer: { enabled: true } }, { kept: true }],
    ['nwDeleteDeviceTimer', ['fixture-device'], '/timers', { deviceId: 'fixture-device', delete: true }, { kept: true }],
  ];
  for (const [name, args, endpoint, payload, expected] of methods) {
    assert.deepEqual(json(await h.context[name](...args)), expected, name);
    assert.equal(h.apiCalls.at(-1).url, '/api/smarthome' + endpoint, name);
    assert.deepEqual(h.apiCalls.at(-1).body, payload, name);
  }
});

test(`actual ${runtime} transport/API failures return safely with feedback and never modify device state optimistically`, async () => {
  for (const mode of ['network', 'json', 'forbidden']) {
    const h = harness(); h.setFetchMode(mode);
    const d = device('switch'); const tile = h.context.nwCreateTile(d); h.main.appendChild(tile);
    const before = tile.querySelector('.nw-sh-tile__state').textContent;
    const result = await h.context.nwToggleDevice(d.id, false);
    assert.equal(result, null, mode); assert.equal(d.state.on, true);
    assert.equal(tile.querySelector('.nw-sh-tile__state').textContent, before);
    assert.equal(tile.querySelector('.nw-sh-command-status').dataset.state, 'error');
    assert.equal(h.apiCalls.length, 1, 'no automatic retry');
  }
});

test(`actual ${runtime} compatibility fallback also handles failed/invalid responses without uncaught rejection`, async () => {
  for (const mode of ['network', 'json', 'forbidden']) {
    const h = harness({ helpers: false }); h.setFetchMode(mode);
    assert.equal(await h.context.nwSetLevel('fixture-device', 50), null);
    assert.equal(await h.context.nwCoverAction('fixture-device', 'stop'), false);
    assert.equal(h.apiCalls.length, 2);
  }
});

test(`actual ${runtime} device polling retains inline touch DOM, updates data and renders after the gesture`, async () => {
  const h = harness(); let current = device(); let renders = 0;
  h.context.nwFetchDevices = async () => structuredClone([current]);
  h.context.nwRenderSidebarNav = () => {};
  h.context.nwApplyFiltersAndRender = () => { renders++; };
  await h.context.nwReloadDevices(); assert.equal(renders, 1);
  const tile = h.context.nwCreateTile(current); h.main.appendChild(tile);
  const input = tile.querySelector('input[type="range"]'); await down(input); input.value = '65'; await input.fire('input');
  current = { ...current, state: { ...current.state, level: 55 } };
  await h.context.nwReloadDevices();
  assert.equal(renders, 1); assert.equal(input.value, '65'); assert.equal(h.run('nwAllDevices[0].state.level'), 55);
  assert.equal(tile.querySelector('input[type="range"]'), input);
  await h.fire(h.document, 'pointercancel', { pointerId: 1 });
  await h.context.nwReloadDevices(); assert.equal(renders, 2);
  assert.equal(h.apiCalls.length, 0);
});

test(`actual ${runtime} color touch release runs one final color command even with live preview enabled`, async () => {
  const h = harness(); h.local.set('nw_sh_live_preview', 'true'); h.context.nwReloadDevices = async () => {};
  const d = device('color');
  const panel = h.context.nwCreateColorPopover(d, true); h.main.appendChild(panel);
  h.context.nwBindSmartHomeControls(panel, d.id);
  const input = panel.querySelector('.nw-sh-slider--colorvalue'); assert.ok(input);
  await down(input); input.value = '50'; await input.fire('input');
  await h.flushShortTimers(); assert.equal(h.apiCalls.length, 0, 'touch preview does not queue a command');
  await up(h); await h.flushShortTimers();
  assert.equal(h.apiCalls.length, 1, 'no queued duplicate live-preview command after final change');
  assert.equal(h.apiCalls[0].url, '/api/smarthome/color');
  assert.deepEqual(h.apiCalls[0].body, { id: 'fixture-device', color: '#808080' });
});
