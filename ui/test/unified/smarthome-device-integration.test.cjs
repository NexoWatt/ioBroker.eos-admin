/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * SmartHome compiled profile/custom integration: reproduzierbare Runtime-/DOM-Simulation ohne Browser oder
 * Zusatzabhängigkeit. Prüft echte Kunden-Runtime, Dialog-Lifecycle, Payloads,
 * Qualität und Aktualisierung. Dies ist kein Layout-, Geräte- oder Browsertest.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const runtime = process.env.EOS_TEST_RUNTIME === 'source' ? 'source' : 'build';
const root = path.resolve(__dirname, '../..');
function runtimeCode(name) {
  const file = runtime === 'build' ? path.join(root, 'www', name + '.js') : path.join(root, 'src-ts/runtime-executables/www', name + '.ts');
  const text = fs.readFileSync(file, 'utf8');
  return runtime === 'build' ? text : ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
}

function harness() {
  let document;
  const handlers = {};
  const timers = new Map();
  const frames = [];
  let timerId = 0;
  let fetchMode = 'ok';
  let responder = null;
  let devices = [];
  const fetchOptions = [];
  const capturedErrors = [];
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
  async function drain() { while (promises.length) await Promise.all(promises.splice(0)); await new Promise(resolve => setImmediate(resolve)); }
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
    get childElementCount() { return this.children.length; }
    get firstChild() { return this.children[0] || null; }
    get isConnected() { return this === document.documentElement || !!(this.parentElement && this.parentElement.isConnected); }
    get textContent() { return this._text + this.children.map((child) => child.textContent).join(''); }
    set textContent(value) { this.children.forEach((child) => { child.parentElement = null; }); this.children = []; this._text = String(value); }
    set innerHTML(value) { this.textContent = ''; this._html = String(value); }
    get innerHTML() { return this._html || ''; }
    appendChild(child) { if (child.parentElement) child.parentElement.removeChild(child); this.children.push(child); child.parentElement = this; return child; }
    append(...items) { items.forEach((item) => this.appendChild(item)); }
    prepend(...items) { for (const item of [...items].reverse()) { item.remove(); item.parentElement = this; this.children.unshift(item); } }
    remove() { this.parentElement?.removeChild(this); }
    replaceChildren(...items) { this.textContent = ""; this.append(...items); }
    insertBefore(item, before) { item.remove(); item.parentElement = this; const index = this.children.indexOf(before); if (index < 0) this.children.push(item); else this.children.splice(index, 0, item); return item; }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatchEvent(new Event("close")); }
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
    querySelectorAll(selector) { if (selector.startsWith(':scope > ')) return this.children.filter(child => child.matches(selector.slice(9))); return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
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
  const rooms = new Element('div'); rooms.id = 'nw-smarthome-rooms'; main.append(rooms);
  const local = new Map();
  const apiCalls = [];
  const window = { innerWidth: 736, innerHeight: 900, scrollY: 35, location: { href: 'https://nexowatt.test/smarthome/' }, events: {}, dispatchEvent(event) { return dispatch(this, event); }, addEventListener(name, handler, options) { listen(this.events, name, handler, options); }, scrollTo() {}, open() {} };
  const context = vm.createContext({ document, window, console: { ...console, error(...args) { capturedErrors.push(args.map(String).join(' ')); } }, URL, URLSearchParams, Event, CustomEvent: Event, Element, HTMLElement: Element, AbortController, TextDecoder, Response, atob, queueMicrotask, performance: { now: () => 10000 },
    localStorage: { getItem: (key) => local.get(key) ?? null, setItem: (key, value) => local.set(key, String(value)), removeItem: (key) => local.delete(key) },
    requestAnimationFrame: (callback) => frames.push(callback),
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; }, clearTimeout: (id) => timers.delete(id),
    setInterval: () => 1, clearInterval() {},
    fetch: async (url, options) => {
      apiCalls.push({ url, body: options && options.body ? JSON.parse(options.body) : undefined }); fetchOptions.push(options || {});
      if (responder) { const response = responder(url, options || {}); if (response !== undefined) return response; }
      if (fetchMode === 'network') throw new Error('fixture network failure');
      if (fetchMode === 'json') return new Response('not-json');
      if (fetchMode === 'forbidden') return new Response('{}', { status: 403 });
      return new Response(JSON.stringify({ ok: true, state: { on: true }, config: { kept: true }, devices }));
    },
  });
  for (const name of ['smarthome-touch', 'smarthome-feedback', 'smarthome-device-categories', 'smarthome-device-controls', 'smarthome-custom-views']) vm.runInContext(runtimeCode(name), context, { filename: name + '.js' });
  vm.runInContext(runtimeCode('smarthome'), context, { filename: 'smarthome.js' });
  return { context, document, window, main, rooms, local, apiCalls, fetchOptions, capturedErrors, timers, setDevices: value => { devices = value; }, setResponder: value => { responder = value; }, run: (code) => vm.runInContext(code, context),
    fire, drain, setFetchMode: mode => { fetchMode = mode; },
    flushFrames: () => { while (frames.length) frames.shift()(); },
    async flushDelay(delay) { const matching = [...timers].filter(([, entry]) => entry.delay === delay); for (const [id, entry] of matching) { timers.delete(id); await entry.callback(); } await drain(); },
    async flushShortTimers() { const short = [...timers].filter(([, entry]) => entry.delay <= 1000); for (const [id, entry] of short) { timers.delete(id); await entry.callback(); } await drain(); },
  };
}

const field = (key, patch = {}) => ({ key, label: key, type: 'boolean', kind: 'toggle', value: false, valid: true, writable: true, readable: true, unit: '', options: [], confirm: false, ack: true, ...patch });
const device = (patch = {}) => ({ id: 'profile-device', alias: 'Wohnzimmer', type: 'device', room: 'Wohnen', roomId: 'living', behavior: {}, quality: { status: 'online' }, state: {}, io: {},
  deviceControls: { profile: 'light', label: 'Licht', fields: [field('SET')] }, ...patch });
const row = (node, key) => node.querySelector(`[data-field-key="${key}"]`);
const buttons = node => node.querySelectorAll('button');
const buttonText = (node, label) => buttons(node).find(button => button.textContent === label);
const json = value => JSON.parse(JSON.stringify(value));
function app(h, devices) {
  h.setDevices(devices); h.context.fixtureDevices = devices;
  h.run("nwAllDevices = fixtureDevices; nwSmartHomeEnabled = true; nwShFiltersUiEnabled = false; Object.assign(nwPageState, {pages:[{id:'all',type:'custom',title:'Alle'}], activeId:'all'}); nwFilterState.page = {}; nwFilterState.favoritesOnly = false; nwFilterState.functionId = ''; nwViewState.mode = 'rooms'; nwViewState.groupByType = false;");
  h.context.nwApplyFiltersAndRender();
}

test(`actual ${runtime} main renders a typed profile tile and dispatches one command through actual feedback`, async () => {
  const h = harness(); const data = device({ deviceControls: { profile: 'thermostat', label: 'Heizung', fields: [field('MODE', { type: 'number', kind: 'select', value: 1, options: [{ value: 1, label: 'Auto' }, { value: 3, label: 'Heizen' }] })] } });
  const tile = h.context.nwCreateTile(data, { showRoom: true }); h.rooms.append(tile);
  assert.ok(tile.classList.contains('nw-sh-device-controls')); assert.ok(tile.classList.contains('nw-sh-tile'));
  assert.equal(tile.querySelector('.nw-sh-category').dataset.category, 'thermostat');
  assert.equal(tile.dataset.nwDeviceId, data.id); assert.equal(tile.querySelector('.nw-sh-mini-toggle'), null);
  assert.match(tile.textContent, /Wohnzimmer/); assert.match(tile.textContent, /Wohnen/); assert.equal(h.apiCalls.length, 0);
  const control = row(tile, 'MODE'); const select = control.querySelector('select'); select.value = '1'; await select.fire('change'); assert.equal(h.apiCalls.length, 0);
  await buttonText(control, 'Übernehmen').fire('click'); await h.drain();
  assert.deepEqual(h.apiCalls, [{ url: '/api/smarthome/control', body: { id: data.id, key: 'MODE', value: 3 } }]);
  assert.equal(typeof h.apiCalls[0].body.value, 'number'); assert.equal(h.fetchOptions[0].method, 'POST');
  assert.equal(tile.querySelector('.nw-sh-command-status').dataset.state, 'sent'); assert.equal(data.deviceControls.fields[0].value, 1);
  assert.ok([...h.timers.values()].some(timer => timer.delay === 150), 'success schedules the parent refresh event');
  assert.deepEqual(h.capturedErrors, []);
});

test(`actual ${runtime} profile readonly and failing APIs preserve values and avoid fallback or automatic retries`, async () => {
  const h = harness(); const readonly = device({ behavior: { readOnly: true }, deviceControls: { profile: 'light', label: 'Licht', fields: [field('SET', { writable: false })] } });
  const tile = h.context.nwCreateTile(readonly); h.rooms.append(tile);
  const set = row(tile, 'SET'); assert.equal(buttonText(set, 'Ein').disabled, true); await buttonText(set, 'Ein').fire('click'); assert.equal(h.apiCalls.length, 0);
  h.setFetchMode('forbidden'); const writable = h.context.nwCreateTile(device()); h.rooms.append(writable);
  await buttonText(row(writable, 'SET'), 'Ein').fire('click'); await h.drain();
  assert.equal(h.apiCalls.length, 1); assert.equal(h.apiCalls[0].url, '/api/smarthome/control');
  assert.equal(writable.querySelector('.nw-sh-command-status').dataset.state, 'error'); assert.equal(row(writable, 'SET').querySelector('output').textContent, 'Aus');
  assert.deepEqual(h.capturedErrors, []);
});

test(`actual ${runtime} graft retains favorites, timer delegation and stored EOS player/dimmer extras`, async () => {
  const h = harness(); const timerCalls = []; const detailCalls = [];
  h.context.nwOpenTimerPopover = (data, anchor) => timerCalls.push({ data, anchor });
  h.context.nwOpenDevicePopover = (data, anchor) => detailCalls.push({ data, anchor });
  const data = device({ type: 'dimmer', timer: { enabled: true, onTime: '07:30', offTime: '22:00' }, io: { level: { readId: 'old.level', writeId: 'old.level' } } });
  app(h, [data]); let tile = h.rooms.querySelector('.nw-sh-device-controls');
  await buttonText(tile, 'Zeitschaltuhr').fire('click'); await buttonText(tile, 'Weitere EOS-Funktionen').fire('click');
  assert.equal(timerCalls[0].data, data); assert.deepEqual(timerCalls[0].data.timer, data.timer); assert.equal(detailCalls[0].data, data);
  const favorite = tile.querySelector('.nw-sh-favbtn'); assert.equal(favorite.getAttribute('aria-pressed'), 'false'); await favorite.fire('click');
  tile = h.rooms.querySelector('.nw-sh-device-controls'); assert.equal(h.context.nwIsFavorite(data), true); assert.equal(tile.querySelector('.nw-sh-favbtn').getAttribute('aria-pressed'), 'true');
  assert.ok([...h.local.values()].some(value => value.includes('profile-device')), 'favorite persists through existing local preference contract');
  const player = device({ id: 'existing-player', type: 'player', io: { player: { playId: 'music.play', ttsId: 'music.tts' } }, player: { stations: [{ name: 'Kunde', value: 'customer-station' }], tts: { enabled: true } }, deviceControls: { profile: 'media', label: 'Medien', fields: [field('PLAY', { kind: 'button', commandValue: true })] } });
  const playerTile = h.context.nwCreateTile(player); h.rooms.append(playerTile); await buttonText(playerTile, 'Weitere EOS-Funktionen').fire('click');
  assert.equal(detailCalls[1].data, player); assert.equal(detailCalls[1].data.player.stations[0].value, 'customer-station');
  assert.equal(h.apiCalls.length, 0, 'navigation/preferences do not command a device');
});

test(`actual ${runtime} polling preserves a focused typed draft, then updates after focus leaves`, async () => {
  const h = harness(); const data = device({ deviceControls: { profile: 'universal', label: 'Universal', fields: [field('TEXT', { type: 'string', kind: 'text', value: 'Server 1' })] } });
  app(h, [data]); const tile = h.rooms.querySelector('.nw-sh-device-controls'); const input = row(tile, 'TEXT').querySelector('input'); input.focus(); input.value = 'Noch nicht gesendet';
  const next = structuredClone(data); next.deviceControls.fields[0].value = 'Server 2'; h.setDevices([next]); await h.context.nwReloadDevices({ force: true });
  assert.deepEqual(h.capturedErrors, [], 'polling helpers must not throw when no custom tile is focused');
  assert.equal(h.rooms.querySelector('.nw-sh-device-controls'), tile); assert.equal(input.value, 'Noch nicht gesendet'); assert.equal(h.run('nwAllDevices[0].deviceControls.fields[0].value'), 'Server 2');
  h.document.activeElement = h.document.body; await h.context.nwReloadDevices({ force: true });
  assert.deepEqual(h.capturedErrors, []); assert.equal(h.rooms.querySelector('.nw-sh-device-controls') !== tile, true); assert.equal(h.rooms.querySelector('input').value, 'Server 2');
  assert.ok(h.apiCalls.every(call => call.url === '/api/smarthome/devices')); assert.deepEqual(h.capturedErrors, []);
});

test(`actual ${runtime} age-only profile changes avoid rerender while value, quality and capability changes do render`, () => {
  const h = harness(); const data = device({ deviceControls: { profile: 'temperature', label: 'Temperatur', fields: [field('ACTUAL', { type: 'number', kind: 'readout', writable: false, value: 20, age: 100, ts: 123, q: 0 })] } });
  const aged = structuredClone(data); aged.deviceControls.fields[0].age = 900;
  assert.equal(h.context.nwDeviceRenderSignature([aged]), h.context.nwDeviceRenderSignature([data]));
  for (const change of [{ value: 21 }, { valid: false }, { writable: true }, { ack: false }, { q: 64 }]) {
    const next = structuredClone(data); Object.assign(next.deviceControls.fields[0], change);
    assert.notEqual(h.context.nwDeviceRenderSignature([next]), h.context.nwDeviceRenderSignature([data]));
  }
});

test(`actual ${runtime} custom live chart retains samples and DOM across DTO updates and releases it when removed`, async () => {
  const h = harness(); const data = device({ id: 'custom-chart', customView: { kind: 'universal', settings: { quickChart: true, quickChartInterval: 300 } }, deviceControls: { profile: 'universal', label: 'Messung', fields: [field('VALUE', { type: 'number', kind: 'readout', writable: false, value: 12 })] } });
  app(h, [data]); const first = h.rooms.querySelector('.nw-sh-cv-tile'); assert.ok(first); const firstGraph = first.querySelector('svg'); assert.match(firstGraph.getAttribute('aria-label'), /1 empfangene Werte/);
  const next = structuredClone(data); next.deviceControls.fields[0].value = 15; h.setDevices([next]); await h.context.nwReloadDevices({ force: true });
  assert.deepEqual(h.capturedErrors, []);
  const second = h.rooms.querySelector('.nw-sh-cv-tile'); assert.equal(second, first, 'custom root is reused, keeping history and local chart samples');
  assert.match(second.querySelector('svg').getAttribute('aria-label'), /2 empfangene Werte/);
  assert.equal(second.querySelectorAll('.nw-sh-dc-toolbar').length, 1, 'reused root has exactly one current toolbar');
  app(h, []); assert.equal(first.isConnected, false); assert.equal(first.querySelector('.nw-sh-custom-view'), null, 'view.destroy runs when removed'); assert.deepEqual(h.capturedErrors, []);
});

test(`actual ${runtime} removed custom iframe dialogs and clocks release resources immediately`, async () => {
  const h = harness(); const frame = device({ id: 'custom-frame', customView: { kind: 'iframe', settings: { url: 'https://nexowatt.test/local-panel', clickAction: 'dialog', refreshInterval: 0 } }, deviceControls: { profile: 'universal', label: 'Ansicht', fields: [] } });
  app(h, [frame]); const tile = h.rooms.querySelector('.nw-sh-cv-tile'); await buttonText(tile, 'Ansicht öffnen').fire('click'); assert.ok(h.document.body.querySelector('dialog'));
  assert.ok(h.timers.size > 0, 'actual custom module registered its shared clock cleanup timer');
  app(h, []); assert.equal(h.document.body.querySelector('dialog') === null, true, 'removal closes external iframe dialog without waiting for a clock tick');
  assert.equal(h.timers.size, 0, 'destroy cancels the last clock subscriber timer'); assert.equal(h.apiCalls.length, 0); assert.deepEqual(h.capturedErrors, []);
});

test(`actual ${runtime} active custom history survives a value refresh and aborts immediately on removal`, async () => {
  const h = harness(); let historySignal;
  h.setResponder((url, options) => { if (url.startsWith('/api/smarthome/control-history?')) { historySignal = options.signal; return new Promise(() => {}); } return undefined; });
  const data = device({ id: 'custom-history', customView: { kind: 'universal', settings: {} }, deviceControls: { profile: 'universal', label: 'Messung', fields: [field('VALUE', { type: 'number', kind: 'readout', value: 10, writable: false })] } });
  app(h, [data]); const tile = h.rooms.querySelector('.nw-sh-cv-tile'); const choices = tile.querySelector('select'); choices.value = 'VALUE';
  await buttonText(tile, 'Verlauf öffnen').fire('click'); await buttonText(tile, '24 Stunden').fire('click'); assert.ok(historySignal); assert.equal(historySignal.aborted, false);
  const next = structuredClone(data); next.deviceControls.fields[0].value = 11; h.setDevices([next]); await h.context.nwReloadDevices({ force: true });
  assert.deepEqual(h.capturedErrors, []);
  assert.equal(h.rooms.querySelector('.nw-sh-cv-tile'), tile); assert.ok(tile.querySelector('.nw-sh-cv-history')); assert.equal(historySignal.aborted, false);
  app(h, []); await h.drain(); assert.equal(historySignal.aborted, true); assert.equal(tile.querySelector('.nw-sh-cv-history'), null); assert.deepEqual(h.capturedErrors, []);
});

test(`actual ${runtime} custom kind replacement and pagehide destroy old view resources without device commands`, async () => {
  const h = harness(); const clock = device({ id: 'custom-slot', customView: { kind: 'clock', settings: { clockType: 'digital' } }, deviceControls: { profile: 'custom.clock', label: 'Uhr', fields: [] } });
  app(h, [clock]); const old = h.rooms.querySelector('.nw-sh-cv-tile'); assert.ok(h.timers.size > 0);
  const gauge = device({ id: 'custom-slot', customView: { kind: 'gauge', settings: { min: 0, max: 100 } }, deviceControls: { profile: 'custom.gauge', label: 'Messung', fields: [field('VALUE', { type: 'number', kind: 'readout', value: 30, writable: false })] } });
  app(h, [gauge]); assert.equal(old.isConnected, false); assert.equal(old.querySelector('.nw-sh-custom-view'), null); assert.equal(h.timers.size, 0);
  app(h, [clock]); const current = h.rooms.querySelector('.nw-sh-cv-tile'); await h.fire(h.window, 'pagehide');
  assert.equal(current.querySelector('.nw-sh-custom-view'), null); assert.equal(h.timers.size, 0); assert.equal(h.apiCalls.length, 0); assert.deepEqual(h.capturedErrors, []);
});

test(`actual ${runtime} operating tiles and legacy panels omit step buttons and instructions while keeping sliders and safety`, () => {
  const h = harness();
  const legacy = device({ type: 'dimmer', deviceControls: undefined, state: { level: 40, on: true }, io: { level: { readId: 'lamp.level', writeId: 'lamp.level', min: 0, max: 100, step: 5 }, switch: { readId: 'lamp.on', writeId: 'lamp.on' } } });
  const tile = h.context.nwCreateTile(legacy); const level = h.context.nwCreateLevelPopover(legacy, true);
  const blind = device({ type: 'blind', deviceControls: undefined, state: { level: 40, position: 40 }, io: { level: { readId: 'blind.pos', writeId: 'blind.pos', min: 0, max: 100, step: 5 }, cover: { openId: 'blind.open', closeId: 'blind.close', stopId: 'blind.stop', positionReadId: 'blind.pos', positionWriteId: 'blind.pos' } } });
  const cover = h.context.nwCreateBlindPopover(blind, true);
  const rtr = device({ type: 'rtr', deviceControls: undefined, state: { currentTemp: 21, setpoint: 22 }, io: { climate: { setpointId: 'climate.target', minSetpoint: 17, maxSetpoint: 25, step: .25 } } });
  const thermostat = h.context.nwCreateRtrPopover(rtr, true);
  for (const node of [tile, level, cover, thermostat]) {
    assert.equal(buttons(node).some(button => ['+', '-', '−'].includes(button.textContent)), false);
    assert.equal(node.querySelector('.nw-sh-popover__steprow'), null); assert.equal(node.textContent.includes('Tipp:'), false);
    assert.equal(node.textContent.includes('Halbkreis ziehen'), false); assert.ok(node.querySelector('input[type="range"]'));
  }
  assert.ok(buttons(cover).some(button => button.getAttribute('aria-label') === 'Stopp'), 'cover STOP remains an actual available action');
  const readonly = h.context.nwCreateLevelPopover(legacy, false); assert.match(readonly.textContent, /Nur Anzeige/);
  assert.equal(h.apiCalls.length, 0);
});

test(`actual ${runtime} graft uses original NexoWatt family accents and only safe configured colors`, () => {
  const h = harness(); const colors = [];
  for (const profile of ['light', 'blind', 'tv', 'airQuality']) {
    const tile = h.context.nwCreateTile(device({ deviceControls: { profile, label: profile, fields: [] } })); const accent = tile.style['--sh-accent'];
    assert.match(accent, /^#[0-9a-f]{6}$/i); colors.push(accent);
  }
  assert.equal(new Set(colors).size, 4);
  const chosen = h.context.nwCreateTile(device({ ui: { color: '#123abc' } })); assert.equal(chosen.style['--sh-accent'], '#123abc');
  const unsafe = h.context.nwCreateTile(device({ ui: { color: 'url(https://tracker.invalid)' } })); assert.match(unsafe.style['--sh-accent'], /^#[0-9a-f]{6}$/i);
  assert.equal(h.apiCalls.length, 0);
});
