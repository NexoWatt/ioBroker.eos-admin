/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * SmartHome 1.0.37: reproduzierbare Runtime-/DOM-Simulation ohne Browser oder
 * Zusatzabhängigkeit. Prüft echte Kunden-Runtime, Dialog-Lifecycle, Payloads,
 * Qualität und Aktualisierung. Dies ist kein Layout-, Geräte- oder Browsertest.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const source = fs.readFileSync(path.join(__dirname, '../src-ts/runtime-executables/www/smarthome.ts'), 'utf8');

function harness() {
  let document;
  const handlers = {};
  const timers = new Map();
  const frames = [];
  let timerId = 0;
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
    addEventListener(name, handler) { (this.events[name] ||= []).push(handler); }
    contains(other) { return this === other || this.children.some((child) => child.contains(other)); }
    matches(selector) {
      return selector.split(',').some((part) => {
        const rule = part.trim();
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
    async fire(name, options = {}) {
      const event = { target: this, currentTarget: this, defaultPrevented: false, stopped: false,
        preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...options };
      for (const handler of this.events[name] || []) await handler(event);
      if (!event.stopped && this.parentElement) await this.parentElement.fire(name, { ...event, currentTarget: this.parentElement });
      return event;
    }
  }
  document = {
    createElement: (tag) => new Element(tag),
    createElementNS: (_ns, tag) => new Element(tag),
    addEventListener: (name, handler) => { (handlers[name] ||= []).push(handler); },
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
  const window = { innerWidth: 736, innerHeight: 900, scrollY: 35, addEventListener() {}, scrollTo() {}, open() {} };
  const context = vm.createContext({ document, window, console, URL, URLSearchParams,
    localStorage: { getItem: (key) => local.get(key) ?? null, setItem: (key, value) => local.set(key, String(value)), removeItem: (key) => local.delete(key) },
    requestAnimationFrame: (callback) => frames.push(callback),
    setTimeout: (callback) => { timers.set(++timerId, callback); return timerId; }, clearTimeout: (id) => timers.delete(id),
    setInterval: () => 1, clearInterval() {},
    fetch: async (url, options) => {
      apiCalls.push({ url, body: options && options.body ? JSON.parse(options.body) : undefined });
      return { ok: true, json: async () => ({ ok: true, state: { on: true }, devices: [] }) };
    },
  });
  vm.runInContext(source, context, { filename: 'smarthome.ts' });
  return { context, document, main, local, apiCalls, run: (code) => vm.runInContext(code, context),
    flushFrames: () => { while (frames.length) frames.shift()(); },
    key: (key, shiftKey = false) => { const event = { key, shiftKey, prevented: false, preventDefault() { this.prevented = true; } }; (handlers.keydown || []).forEach((handler) => handler(event)); return event; },
  };
}

const device = (type = 'dimmer', patch = {}) => ({
  id: 'fixture-device', alias: 'Wohnzimmer Licht', type, room: 'Wohnzimmer', behavior: {},
  quality: { status: 'online' }, fieldQuality: { level: { status: 'online', valid: true, ts: 10, ageMs: 20 } },
  state: { on: true, level: 42 }, io: { switch: { readId: 'fixture.on', writeId: 'fixture.on' }, level: { readId: 'fixture.level', writeId: 'fixture.level', min: 0, max: 100, step: 5 } }, ...patch,
});

test('Nur Qualitäts-Alterszähler werden aus der Signatur entfernt; Eingaben bleiben unverändert', () => {
  const h = harness();
  const first = device();
  const aged = structuredClone(first);
  aged.fieldQuality.level.ageMs = 5020;
  first.quality.ageMs = 20;
  aged.quality.ageMs = 5020;
  const before = JSON.stringify(first);
  assert.equal(h.context.nwDeviceRenderSignature([first]), h.context.nwDeviceRenderSignature([aged]));
  assert.equal(JSON.stringify(first), before);
  for (const change of [
    (d) => { d.quality.status = 'stale'; },
    (d) => { d.state.level = 0; },
    (d) => { d.fieldQuality.level.valid = false; },
    (d) => { d.fieldQuality.level.ts = 11; },
    (d) => { d.behavior.ageMs = 25; },
    (d) => { d.io.level.step = 1; },
  ]) {
    const changed = structuredClone(first); change(changed);
    assert.notEqual(h.context.nwDeviceRenderSignature([first]), h.context.nwDeviceRenderSignature([changed]));
  }
});

test('Gerätetypen, Namen, Favoriten und Qualität bleiben im echten Kachelrenderer erhalten', () => {
  const h = harness();
  for (const type of ['switch', 'dimmer', 'color', 'blind', 'rtr', 'scene', 'sensor', 'player', 'camera', 'widget']) {
    const d = device(type);
    const tile = h.context.nwCreateTile(d);
    assert.equal(tile.dataset.nwDeviceId, d.id);
    assert.equal(tile.querySelector('.nw-sh-tile__name').textContent, d.alias);
    assert.ok(tile.querySelector('.nw-sh-favbtn').getAttribute('aria-label'));
    assert.ok(tile.classList.contains('nw-sh-tile--type-' + type));
  }
  const sensor = device('sensor', { state: { value: 0 }, ui: { unit: '°C', precision: 1 }, quality: { status: 'online' } });
  const online = h.context.nwCreateTile(sensor);
  assert.match(online.querySelector('.nw-sh-tile__value').textContent, /^0,0/);
  const stale = h.context.nwCreateTile({ ...sensor, quality: { status: 'stale' } });
  assert.match(stale.querySelector('.nw-sh-tile__state').textContent, /Veraltet/);
  assert.match(stale.querySelector('.nw-sh-tile__value').textContent, /^—/);
  const off = h.context.nwCreateTile(device('switch', { quality: { status: 'offline' } }));
  assert.equal(off.querySelector('.nw-sh-mini-toggle').disabled, true);
  assert.equal(h.context.nwGetAccentColor({ ui: { color: 'url(javascript:1)' } }, 'generic'), '#00e676');
  assert.equal(h.context.nwGetAccentColor({ ui: { color: '#123ABC' } }, 'generic'), '#123ABC');
});

test('Batterie-Prozent, LowBattery, fehlende/veraltete Werte und Störungen werden unterschieden', () => {
  const h = harness();
  const labels = (state, fieldQuality) => Array.from(h.context.nwGetDeviceIndicators({ state, fieldQuality }), (item) => item.text);
  assert.deepEqual(labels({ battery: 0, batteryUnit: '%' }), ['Batterie 0 %']);
  assert.deepEqual(labels({ battery: true, batteryUnit: 'low' }), ['Batterie schwach']);
  assert.deepEqual(labels({ battery: false, batteryUnit: 'low' }), ['Batterie OK']);
  assert.deepEqual(labels({ battery: null, batteryUnit: '%' }), []);
  assert.deepEqual(labels({ battery: true, batteryUnit: '%' }), []);
  assert.deepEqual(labels({ battery: 85, batteryUnit: '%' }, { battery: { status: 'stale' } }), []);
  assert.deepEqual(labels({ unreachable: true, deviceError: 'motor blocked' }), ['Nicht erreichbar', 'Gerätestörung']);
});

test('Detaildialog bleibt beim Poll erhalten und bietet Escape, Fokusfang und Rückkehr', () => {
  const h = harness();
  const d = device();
  const tile = h.context.nwCreateTile(d);
  h.main.appendChild(tile);
  const trigger = tile.querySelector('.nw-sh-detailbtn');
  trigger.focus();
  h.context.nwOpenDevicePopover(d, trigger);
  h.flushFrames();
  const dialog = h.document.getElementById('nw-sh-popover');
  assert.equal(dialog.getAttribute('role'), 'dialog');
  assert.equal(dialog.getAttribute('aria-modal'), 'true');
  assert.ok(h.document.getElementById(dialog.getAttribute('aria-labelledby')));
  assert.ok(h.main.hasAttribute('inert'));
  const close = dialog.querySelector('.nw-sh-popover__close');
  assert.equal(h.document.activeElement, close);
  const last = h.context.nwPopoverFocusableElements().at(-1);
  assert.ok(h.key('Tab', true).prevented);
  assert.equal(h.document.activeElement, last);
  assert.ok(h.key('Tab').prevented);
  assert.equal(h.document.activeElement, close);
  const slider = dialog.querySelector('input[type="range"]');
  slider.value = '57';
  const updated = structuredClone(d); updated.state.level = 61;
  h.context.nwSyncOpenPopoverFeedback([updated]);
  assert.equal(dialog.querySelector('input[type="range"]'), slider);
  assert.equal(slider.value, '57');
  assert.match(dialog.querySelector('.nw-sh-popover__state').textContent, /61 %/);
  assert.equal(h.apiCalls.length, 0, 'Öffnen/Poll/Fokus darf keine Hardwareaktion schreiben');
  // Die auslösende Kachel wird durch einen echten Zustandswechsel ersetzt.
  tile.replaceWith(h.context.nwCreateTile(updated));
  h.key('Escape');
  assert.ok(dialog.classList.contains('hidden'));
  assert.ok(!h.main.hasAttribute('inert'));
  assert.equal(h.document.activeElement.dataset.nwActionKey, 'details');
  assert.ok(h.document.activeElement.isConnected);
});

test('Timerentwurf erhält denselben modalen Lebenszyklus und bleibt bei State-Polls bestehen', () => {
  const h = harness();
  const d = device('switch', { timer: { enabled: true, days: [1, 3], onTime: '17:30', offTime: '22:00' } });
  const tile = h.context.nwCreateTile(d); h.main.appendChild(tile);
  const trigger = tile.querySelector('.nw-sh-timerbtn');
  h.context.nwOpenTimerPopover(d, trigger); h.flushFrames();
  const dialog = h.document.getElementById('nw-sh-popover');
  assert.ok(!h.document.getElementById('nw-sh-popover-backdrop').classList.contains('hidden'));
  assert.ok(h.main.hasAttribute('inert'));
  const input = dialog.querySelector('input[type="time"]');
  assert.ok(input);
  input.value = '19:45';
  h.context.nwSyncOpenPopoverFeedback([{ ...d, state: { on: false } }]);
  assert.equal(input.value, '19:45');
  h.key('Escape');
  assert.equal(h.document.activeElement, trigger);
  assert.equal(h.apiCalls.length, 0);
});

test('Konfigurations-/Rechtewechsel schließt einen bestehenden Dialog statt alte Bedienfreigabe zu behalten', () => {
  const h = harness(); const d = device();
  h.context.nwOpenDevicePopover(d, null); h.flushFrames();
  h.context.nwSyncOpenPopoverFeedback([{ ...d, behavior: { readOnly: true } }]);
  assert.ok(h.document.getElementById('nw-sh-popover').classList.contains('hidden'));
  assert.ok(!h.main.hasAttribute('inert'));
});

test('Poll aktualisiert Alter ohne Neurender, echte Qualitäts-/Wertwechsel rendern weiter', async () => {
  const h = harness(); const d = device();
  let current = d; let renders = 0;
  h.context.nwFetchDevices = async () => [structuredClone(current)];
  h.context.nwRenderSidebarNav = () => {};
  h.context.nwApplyFiltersAndRender = () => { renders += 1; };
  await h.context.nwReloadDevices(); assert.equal(renders, 1);
  current.fieldQuality.level.ageMs += 5000;
  await h.context.nwReloadDevices(); assert.equal(renders, 1);
  assert.equal(h.run('nwAllDevices[0].fieldQuality.level.ageMs'), 5020);
  current.quality.status = 'stale';
  await h.context.nwReloadDevices(); assert.equal(renders, 2);
  await h.context.nwReloadDevices({ force: true }); assert.equal(renders, 3);
});

test('Schalt-/Szenen-Payloads, Dimmerregler ohne Schritttasten und Klima-Regelgrenzen bleiben erhalten', async () => {
  const h = harness(); h.context.nwReloadDevices = async () => {};
  const switchTile = h.context.nwCreateTile(device('switch'));
  await switchTile.querySelector('.nw-sh-mini-toggle').fire('click');
  assert.deepEqual(h.apiCalls.at(-1).body, { id: 'fixture-device', value: false });
  const dimmer = h.context.nwCreateTile(device());
  assert.equal(dimmer.querySelectorAll('button').some(button => ['−', '+'].includes(button.textContent)), false);
  const dimmerSlider = dimmer.querySelector('input[type="range"]');
  dimmerSlider.value = '35'; await dimmerSlider.fire('change');
  assert.deepEqual(h.apiCalls.at(-1).body, { id: 'fixture-device', level: 35 });
  const scene = h.context.nwCreateTile(device('scene', { behavior: { commandMode: 'momentary' } }));
  await scene.querySelector('.nw-sh-mini-btn').fire('click');
  assert.deepEqual(h.apiCalls.at(-1).body, { id: 'fixture-device' });
  const rtr = device('rtr', { state: { currentTemp: 21, setpoint: 22 }, io: { climate: { setpointId: 'fixture.climate', minSetpoint: 17, maxSetpoint: 25, step: .25 } } });
  const panel = h.context.nwCreateRtrPopover(rtr, true);
  const slider = panel.querySelector('input[type="range"]');
  assert.equal(slider.min, '17'); assert.equal(slider.max, '25'); assert.equal(slider.step, '0.25');
  slider.value = '22.25'; await slider.fire('change');
  assert.deepEqual(h.apiCalls.at(-1).body, { id: 'fixture-device', setpoint: 22.25 });
});

test('Favoriten-Schlüssel und lokale Overrides werden unverändert weiterverwendet', async () => {
  const h = harness(); h.context.nwApplyFiltersAndRender = () => {};
  const d = device('switch', { behavior: { favorite: false } });
  const tile = h.context.nwCreateTile(d);
  await tile.querySelector('.nw-sh-favbtn').fire('click');
  assert.deepEqual(JSON.parse(h.local.get('nw_sh_favorites_overrides_v1')), { 'fixture-device': true });
  assert.equal(h.context.nwIsFavorite(d), true);
  assert.equal(h.apiCalls.length, 0);
});
