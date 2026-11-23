/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
/** Real browser-runtime logic in a bounded DOM/event simulation; not a physical-device test. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function code(name) {
  if (process.env.EOS_TEST_RUNTIME === 'build') return fs.readFileSync(path.join(root, 'www', name + '.js'), 'utf8');
  return ts.transpileModule(fs.readFileSync(path.join(root, 'src-ts/runtime-executables/www', name + '.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
}
function harness({ feedback = true } = {}) {
  let document;
  class Event {
    constructor(type, options = {}) { Object.assign(this, { type, bubbles: true, cancelable: true, stopped: false, immediate: false }, options); }
    preventDefault() { this.defaultPrevented = true; }
    stopPropagation() { this.stopped = true; }
    stopImmediatePropagation() { this.stopped = this.immediate = true; }
  }
  class Target {
    constructor(parent = null) { this.events = new Map(); this.parentElement = parent; }
    addEventListener(type, handler, options = {}) { const entries = this.events.get(type) || []; entries.push({ handler, capture: options === true || !!options.capture }); this.events.set(type, entries); }
    dispatchEvent(event) {
      event.target = this; const parents = []; let parent = this.parentElement;
      while (parent) { parents.unshift(parent); parent = parent.parentElement; }
      const invoke = (target, capture) => { event.currentTarget = target; for (const entry of target.events.get(event.type) || []) { if (entry.capture === capture) entry.handler(event); if (event.immediate) break; } };
      for (const target of [...parents, this]) { invoke(target, true); if (event.stopped) return; }
      invoke(this, false); if (event.bubbles && !event.stopped) for (const target of parents.reverse()) { invoke(target, false); if (event.stopped) break; }
    }
    fire(type, options = {}) { this.dispatchEvent(new Event(type, options)); }
  }
  class Element extends Target {
    constructor(tag) { super(); Object.assign(this, { tagName: tag.toUpperCase(), children: [], className: '', dataset: {}, attributes: {}, value: '', disabled: false, _text: '', style: { setProperty(key, value) { this[key] = value; } } }); }
    get classList() { return { contains: item => this.className.split(/\s+/).includes(item), add: item => { this.className += ' ' + item; } }; }
    get childElementCount() { return this.children.length; }
    get isConnected() { return this === document?.body || !!this.parentElement?.isConnected; }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this._text = String(value); this.children.forEach(child => { child.parentElement = null; }); this.children = []; }
    append(...items) { for (const item of items) { item.remove(); item.parentElement = this; this.children.push(item); } }
    prepend(...items) { for (const item of [...items].reverse()) { item.remove(); item.parentElement = this; this.children.unshift(item); } }
    remove() { if (this.parentElement?.children) this.parentElement.children = this.parentElement.children.filter(item => item !== this); this.parentElement = null; }
    replaceChildren(...items) { this.textContent = ''; this.append(...items); }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key] ?? null; }
    matches(selector) {
      return selector.split(',').some(item => {
        const part = item.trim(); if (part.startsWith('.')) return this.classList.contains(part.slice(1));
        const match = part.match(/^([a-z]+)?\[([^=]+)="([^"]*)"\]$/i);
        if (match) { const val = match[2].startsWith('data-') ? this.dataset[match[2].slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase())] : this[match[2]]; return (!match[1] || this.tagName === match[1].toUpperCase()) && String(val) === match[3]; }
        return this.tagName === part.toUpperCase();
      });
    }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest?.(selector) ?? null; }
    focus() { document.activeElement = this; }
  }
  const window = new Target(); document = new Target(window); document.hidden = false;
  document.body = new Element('body'); document.body.parentElement = document; document.activeElement = document.body;
  document.createElement = tag => new Element(tag); document.querySelectorAll = selector => document.body.querySelectorAll(selector);
  const calls = []; const refreshes = []; let result = { ok: true };
  if (feedback) window.NW_SH_FEEDBACK = { post: async (endpoint, payload, id) => { calls.push(JSON.parse(JSON.stringify({ endpoint, payload, id }))); if (result instanceof Error) throw result; return result; }, attachStatus: () => {} };
  window.addEventListener('nw-smarthome-refresh', event => refreshes.push(event.detail));
  const context = vm.createContext({ window, document, HTMLElement: Element, Event, CustomEvent: Event, URL, atob, performance: { now: () => 1000 }, console });
  vm.runInContext(code('smarthome-touch'), context); vm.runInContext(code('smarthome-device-controls'), context);
  const api = window.NW_SH_DEVICE_CONTROLS;
  const render = data => { const tile = api.renderTile(data); if (tile) document.body.append(tile); return tile; };
  const detail = data => { const node = new Element('main'); document.body.append(node); api.renderDetails(node, data); return node; };
  return { api, window, document, calls, refreshes, render, detail, setResult: value => { result = value; } };
}
const field = (key, patch = {}) => ({ key, label: key, type: 'boolean', kind: 'toggle', value: false, valid: true, writable: true, readable: true, options: [], unit: '', confirm: false, ...patch });
const device = (profile, fields) => ({ id: 'room-lamp', deviceControls: { profile, label: profile, fields } });
const row = (node, key) => node.querySelector(`[data-field-key="${key}"]`);
const buttons = node => node.querySelectorAll('button');
const click = async node => { node.fire('click'); await new Promise(resolve => setImmediate(resolve)); };

test('generic DTO is validated; all scalar capabilities render safely without writing or HTML interpretation', () => {
  const h = harness(); assert.equal(h.render(null), null); assert.equal(h.render({ id: 'x' }), null);
  const tile = h.render(device('weatherForecast', [field('TEMP_MIN0', { type: 'number', kind: 'readout', value: 2.4, writable: false, label: '<img src=x>', unit: '°C', age: 2500, q: 64 }), field('ALARM', { kind: 'indicator', value: false, writable: false }), field('UNKNOWN', { valid: false, value: null }), field('bad', { type: 'object' }), field('proto', { kind: 'constructor' })]));
  assert.ok(tile.textContent.includes('<img src=x>')); assert.equal(tile.querySelector('img'), null);
  assert.ok(tile.textContent.includes('2.4 °C')); assert.ok(tile.textContent.includes('Qualitätskennzeichen 64')); assert.ok(tile.textContent.includes('2 s'));
  assert.equal(row(tile, 'ALARM').querySelector('output').textContent, 'Aus');
  assert.equal(row(tile, 'UNKNOWN').querySelector('output').textContent, 'Keine Rückmeldung');
  assert.equal(row(tile, 'bad'), null); assert.equal(row(tile, 'proto'), null); assert.deepEqual(h.calls, []);
});

test('unknown boolean state offers explicit values; read-only controls and detached controls never command', async () => {
  const h = harness(); const tile = h.detail(device('light', [field('SET', { value: null, valid: false }), field('ON', { writable: false })]));
  const choices = buttons(row(tile, 'SET')); assert.equal(choices[0].getAttribute('aria-pressed'), null);
  await click(choices[1]); assert.deepEqual(h.calls[0].payload, { id: 'room-lamp', key: 'SET', value: true });
  await click(buttons(row(tile, 'ON'))[0]); assert.equal(h.calls.length, 1);
  tile.remove(); await click(choices[0]); assert.equal(h.calls.length, 1);
  assert.equal(h.refreshes.length, 1);
});

test('gate writes booleans; lock requires explicit confirmation and preserves STOP availability', async () => {
  const h = harness(); const gate = h.detail(device('gate', [field('SET'), field('STOP', { kind: 'button', commandValue: true })]));
  assert.deepEqual(buttons(row(gate, 'SET')).map(node => node.textContent), ['Schließen', 'Öffnen']);
  await click(buttons(row(gate, 'SET'))[0]); assert.equal(h.calls[0].payload.value, false);
  const lock = h.detail(device('lock', [field('SET', { confirm: true }), field('OPEN', { kind: 'button', confirm: true, commandValue: true })]));
  await click(buttons(row(lock, 'SET'))[0]); assert.equal(h.calls.length, 1); assert.equal(h.api.isInteracting(), true);
  assert.match(lock.querySelector('.nw-sh-dc-confirm').textContent, /Entriegeln/);
  await click(buttons(lock.querySelector('.nw-sh-dc-confirm'))[1]); assert.equal(h.calls.length, 1);
  await click(buttons(row(lock, 'OPEN'))[0]); await click(buttons(lock.querySelector('.nw-sh-dc-confirm'))[0]);
  assert.deepEqual(h.calls[1].payload, { id: 'room-lamp', key: 'OPEN', value: true, confirmed: true });
  await click(buttons(row(gate, 'STOP'))[0]); assert.equal(h.calls[2].payload.key, 'STOP');
  await click(buttons(row(lock, 'SET'))[1]); h.window.fire('pagehide'); assert.equal(lock.querySelector('.nw-sh-dc-confirm'), null);
});

test('native range keeps actual constraints and only a completed touch commits; scroll/cancel cannot write', async () => {
  const h = harness(); const tile = h.detail(device('thermostat', [field('SET', { type: 'number', kind: 'range', value: 20, min: 10, max: 30, step: 0.5, unit: '°C' })]));
  const input = tile.querySelector('input'); assert.equal(input.min, '10'); assert.equal(input.max, '30'); assert.equal(input.step, '0.5');
  input.fire('pointerdown', { pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 10, clientY: 10 }); input.value = '25'; input.fire('input'); input.fire('change');
  assert.equal(h.calls.length, 0); h.document.fire('pointermove', { pointerId: 1, clientX: 10, clientY: 60 }); h.document.fire('pointerup', { pointerId: 1, clientX: 10, clientY: 60 });
  assert.equal(input.value, '20'); assert.equal(h.calls.length, 0);
  input.fire('pointerdown', { pointerType: 'touch', pointerId: 2, isPrimary: true, clientX: 10, clientY: 10 }); input.value = '22.5'; input.fire('input'); h.document.fire('pointerup', { pointerId: 2, clientX: 10, clientY: 10 });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(h.calls.length, 1); assert.equal(h.calls[0].payload.value, 22.5);
  input.fire('keydown', { key: 'ArrowRight' }); input.value = '31'; input.fire('change'); input.value = '22.3'; input.fire('change'); assert.equal(h.calls.length, 1);
});

test('typed enum and text edits require explicit apply; numeric values respect limits and step', async () => {
  const h = harness(); const tile = h.detail(device('media', [field('MODE', { type: 'number', kind: 'select', value: 1, options: [{ value: 1, label: 'Auto' }, { value: 2, label: 'Manuell' }] }), field('TEXT', { type: 'string', kind: 'text', value: 'alt' }), field('TARGET', { type: 'number', kind: 'number', min: -2, max: 2, step: 0.5, value: 0 })]));
  const select = row(tile, 'MODE').querySelector('select'); select.value = '1'; select.fire('change'); assert.equal(h.calls.length, 0);
  await click(buttons(row(tile, 'MODE'))[0]); assert.equal(h.calls[0].payload.value, 2); assert.equal(typeof h.calls[0].payload.value, 'number');
  const text = row(tile, 'TEXT').querySelector('input'); text.value = '<text>'; text.fire('input'); assert.equal(h.calls.length, 1); await click(buttons(row(tile, 'TEXT'))[0]); assert.equal(h.calls[1].payload.value, '<text>');
  const number = row(tile, 'TARGET').querySelector('input'); number.value = '0.3'; await click(buttons(row(tile, 'TARGET'))[0]); assert.equal(h.calls.length, 2);
  number.value = '1.5'; await click(buttons(row(tile, 'TARGET'))[0]); assert.equal(h.calls[2].payload.value, 1.5);
  text.focus(); assert.equal(h.api.isInteracting(), true); tile.remove(); assert.equal(h.api.isInteracting(), false);
});

test('TV KEY uses catalog option values and directional pad; no fabricated remote commands', async () => {
  const h = harness(); const data = device('tv', [field('KEY', { type: 'string', kind: 'select', value: null, valid: false, options: ['UP', 'LEFT', 'OK', 'RIGHT', 'DOWN', 'HOME', '1', 'VOLUME_UP', 'VOLUME_DOWN'].map(value => ({ value, label: value })) }), field('VOLUME_UP', { kind: 'button', commandValue: true }), field('VOLUME_DOWN', { kind: 'button', commandValue: true })]); const tile = h.detail(data);
  assert.equal(tile.querySelector('.nw-sh-dc-pad').childElementCount, 5);
  assert.equal(tile.querySelector('.nw-sh-dc-remote-keys').childElementCount, 0, 'secondary buttons allocate only when expanded');
  const extra = tile.querySelector('details'); extra.open = true; extra.fire('toggle');
  assert.equal(tile.querySelector('.nw-sh-dc-remote-keys').childElementCount, 2);
  assert.equal(row(tile, 'VOLUME_UP'), null); assert.equal(row(tile, 'VOLUME_DOWN'), null);
  assert.equal(data.deviceControls.fields.length, 3, 'UI removal leaves the stored mapping intact');
  await click(tile.querySelector('[data-position="up"]')); assert.deepEqual(h.calls[0].payload, { id: 'room-lamp', key: 'KEY', value: 'UP' });
});

test('missing feedback, rejected command, thrown network error and malformed result fail safely without retry or optimistic values', async () => {
  for (const result of [null, { ok: false }, new Error('offline'), {}]) {
    const h = harness(); h.setResult(result); const tile = h.detail(device('light', [field('SET')])); await click(buttons(tile)[1]);
    assert.equal(h.calls.length, 1); assert.equal(h.refreshes.length, 0); assert.match(tile.textContent, /nicht bestätigt/); assert.equal(tile.querySelector('output').textContent, 'Aus');
  }
  const h = harness({ feedback: false }); const tile = h.detail(device('light', [field('SET')])); await click(buttons(tile)[1]); assert.match(tile.textContent, /nicht verfügbar/); assert.equal(h.calls.length, 0);
});

test('RGB and RGBW picker preserve prefix and white; selection alone does not write', async () => {
  for (const [profile, key, initial, expected] of [['rgbSingle', 'RGB', '#112233', '#00ff00'], ['rgbSingle', 'RGB', '112233', '00ff00'], ['rgbwSingle', 'RGBW', '#1122337a', '#00ff007a']]) {
    const h = harness(); const tile = h.detail(device(profile, [field(key, { type: 'string', kind: 'text', value: initial })]));
    const panel = tile.querySelector('.nw-sh-dc-color'); const picker = panel.querySelector('input'); assert.equal(picker.disabled, false);
    picker.value = '#00ff00'; picker.fire('input'); picker.fire('change'); assert.equal(h.calls.length, 0); await click(buttons(panel)[0]);
    assert.deepEqual(h.calls[0].payload, { id: 'room-lamp', values: [{ key, value: expected }] });
  }
  const h = harness(); const tile = h.detail(device('rgbwSingle', [field('RGBW', { type: 'string', kind: 'text', value: null, valid: false })])); assert.equal(tile.querySelector('.nw-sh-dc-color-input').disabled, true);
});

test('split RGB and HUE picker scale to real bounds; absent/readonly channels cannot partially send', async () => {
  const channels = ['RED', 'GREEN', 'BLUE'].map(key => field(key, { type: 'number', kind: 'range', value: 50, min: 0, max: 100, step: 1 }));
  const h = harness(); const tile = h.detail(device('rgb', channels)); const panel = tile.querySelector('.nw-sh-dc-color'); panel.querySelector('input').value = '#ff8000'; await click(buttons(panel)[0]);
  assert.deepEqual(h.calls[0].payload.values, [{ key: 'RED', value: 100 }, { key: 'GREEN', value: 50 }, { key: 'BLUE', value: 0 }]);
  const partial = h.detail(device('rgb', channels.map(item => item.key === 'BLUE' ? { ...item, writable: false } : item))); assert.equal(partial.querySelector('.nw-sh-dc-color-input').disabled, true);
  const missing = h.detail(device('rgb', channels.map(({ max, ...item }) => item))); assert.equal(missing.querySelector('.nw-sh-dc-color-input').disabled, true);
  const hue = h.detail(device('hue', [field('HUE', { type: 'number', kind: 'range', value: 0, min: 0, max: 360, step: 1 }), field('SATURATION', { type: 'number', kind: 'range', value: 50, min: 0, max: 100, step: 1 })]));
  const huePanel = hue.querySelector('.nw-sh-dc-color'); huePanel.querySelector('input').value = '#00ff00'; await click(buttons(huePanel)[0]);
  assert.deepEqual(h.calls[1].payload.values, [{ key: 'HUE', value: 120 }, { key: 'SATURATION', value: 100 }]);
});

test('CIE color uses bounded xy conversion and preserves bracket style; CT retains real Kelvin range', async () => {
  const h = harness(); const cie = h.detail(device('cie', [field('CIE', { type: 'string', kind: 'text', value: '[0.3127,0.3290]' })]));
  const panel = cie.querySelector('.nw-sh-dc-color'); panel.querySelector('input').value = '#ff0000'; await click(buttons(panel)[0]);
  assert.equal(h.calls[0].payload.values[0].key, 'CIE'); const xy = JSON.parse(h.calls[0].payload.values[0].value); assert.ok(xy[0] > 0.6 && xy[0] < 0.8); assert.ok(xy[1] > 0.2 && xy[1] < 0.4);
  const ct = h.detail(device('ct', [field('TEMPERATURE', { type: 'number', kind: 'range', min: 2200, max: 6500, step: 50, value: 3500, unit: 'K' })]));
  assert.equal(ct.querySelector('.nw-sh-dc-color-input'), null); const range = row(ct, 'TEMPERATURE').querySelector('input'); assert.equal(range.min, '2200'); assert.equal(range.max, '6500'); assert.equal(range.step, '50');
  assert.equal(ct.querySelector('.nw-sh-dc-color').textContent.includes('über Farbtemperatur einstellen'), false); assert.match(row(ct, 'TEMPERATURE').textContent, /3500 K/); assert.equal(h.calls.length, 1);
});

test('volume slider retains exact step without step buttons, plus safe restore and transport KEY fallback', async () => {
  const h = harness(); const volume = field('VOLUME', { type: 'number', kind: 'range', value: 30, min: 0, max: 100, step: 5 });
  const fields = [volume, field('KEY', { type: 'string', kind: 'select', value: null, valid: false, options: [{ value: 'PLAY', label: 'Play' }] })];
  const first = h.detail(device('tv', fields));
  const controls = first.querySelector('.nw-sh-dc-media');
  const command = label => buttons(controls).find(node => node.textContent === label);
  assert.equal(command('Lauter'), undefined); assert.equal(command('Leiser'), undefined);
  await click(command('Wiedergabe')); const slider = row(first, 'VOLUME').querySelector('input'); assert.equal(slider.step, '5'); slider.value = '35'; slider.fire('change'); await new Promise(resolve => setImmediate(resolve)); await click(command('Stummschalten'));
  assert.deepEqual(h.calls.map(call => call.payload), [{ id: 'room-lamp', key: 'KEY', value: 'PLAY' }, { id: 'room-lamp', key: 'VOLUME', value: 35 }, { id: 'room-lamp', key: 'VOLUME', value: 0 }]);
  assert.equal(volume.value, 30, 'reports are never changed optimistically');
  const next = h.detail(device('tv', [{ ...volume, value: 0 }]));
  await click(buttons(next.querySelector('.nw-sh-dc-media')).find(node => node.textContent === 'Lautstärke wiederherstellen'));
  assert.equal(h.calls.at(-1).payload.value, 30);
  const fresh = harness(); const freshTile = fresh.detail(device('volume', [{ ...volume, key: 'SET', value: 0 }]));
  assert.equal(buttons(freshTile.querySelector('.nw-sh-dc-media')).find(node => node.textContent === 'Lautstärke wiederherstellen').disabled, true);
});

test('mixed read-only scalar, paired severity and event-change timestamp remain visible without granting a write', () => {
  const h = harness(); const tile = h.detail(device('airQuality', [field('AQI', { type: 'mixed', kind: 'readout', value: 'Qualität unbekannt', writable: true }), field('CO2', { type: 'number', kind: 'readout', value: 1200, unit: 'ppm', writable: false }), field('CO2_LEVEL', { type: 'number', kind: 'readout', value: 2, options: [{ value: 2, label: 'Erhöht' }], writable: false })]));
  assert.match(tile.querySelector('.nw-sh-dc-summary').textContent, /Erhöht/);
  assert.equal(buttons(row(tile, 'AQI')).length, 0); assert.match(row(tile, 'AQI').textContent, /Qualität unbekannt/);
  const button = h.detail(device('buttonSensor', [field('PRESS', { kind: 'indicator', writable: false, ts: 1700000005000, lc: 1700000000000 })]));
  assert.match(row(button, 'PRESS').textContent, /Letzte Änderung/); assert.equal(h.calls.length, 0);
});

test('ack:false shows requested values as pending and never seeds a confirmed volume restore', () => {
  const h = harness(); const tile = h.detail(device('volume', [field('SET', { type: 'number', kind: 'range', value: 65, min: 0, max: 100, ack: false })]));
  const value = row(tile, 'SET').querySelector('output'); assert.equal(value.textContent, '65'); assert.match(value.getAttribute('aria-label'), /angeforderter Wert/);
  assert.match(tile.textContent, /Angefordert – Geräterückmeldung ausstehend/);
  assert.equal(buttons(tile.querySelector('.nw-sh-dc-media')).find(node => node.textContent === 'Lautstärke wiederherstellen').disabled, true);
});

test('history is explicit, cached across tile refresh without new requests, and destroyed on close/pagehide', async () => {
  const h = harness(); let created = 0; let destroyed = 0; let updated = 0;
  h.window.NW_SH_CUSTOM_VIEWS = { renderHistory(container, dto, key) { created++; assert.equal(dto.id, 'room-lamp'); assert.equal(key, 'ACTUAL'); container.textContent = 'Lokaler Verlauf'; return { update() { updated++; }, destroy() { destroyed++; container.textContent = ''; } }; } };
  const data = device('temperature', [field('ACTUAL', { type: 'number', kind: 'readout', value: 20, writable: false })]);
  const first = h.render(data); assert.equal(created, 0); await click(first.querySelector('.nw-sh-dc-history-toggle')); assert.equal(created, 1);
  const cached = first.querySelector('.nw-sh-dc-history'); first.remove(); const second = h.render(data);
  assert.equal(second.querySelector('.nw-sh-dc-history'), cached); assert.equal(created, 1); assert.equal(updated, 1);
  await click(second.querySelector('.nw-sh-dc-history-toggle')); assert.equal(destroyed, 1);
  await click(second.querySelector('.nw-sh-dc-history-toggle')); h.window.fire('pagehide'); assert.equal(destroyed, 2); assert.equal(h.calls.length, 0);
});

test('additional fields are allocated on expansion and expansion survives polling; forecast hooks remain read-only', () => {
  const h = harness(); const data = device('universal', Array.from({ length: 30 }, (_, i) => field('FIELD_' + i, { type: 'number', kind: 'readout', value: i, writable: false })));
  const first = h.render(data); assert.equal(first.querySelectorAll('.nw-sh-dc-field').length, 3);
  const details = first.querySelector('details'); details.open = true; details.fire('toggle'); assert.equal(first.querySelectorAll('.nw-sh-dc-field').length, 30);
  first.remove(); const next = h.render(data); assert.equal(next.querySelector('details').open, true); assert.equal(next.querySelectorAll('.nw-sh-dc-field').length, 30);
  let forecasts = 0; h.window.NW_SH_CUSTOM_VIEWS = { renderForecast(container, dto) { forecasts++; assert.equal(dto.deviceControls.profile, 'weatherForecast'); } };
  h.render(device('weatherForecast', [field('TEMP_MIN0', { type: 'number', kind: 'readout', value: 2, writable: false })])); assert.equal(forecasts, 1); assert.equal(h.calls.length, 0);
});

test('image sources load only after an explicit safe HTTP(S) link, never as automatic external images', () => {
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,x', 'https://user:secret@camera.test/image']) {
    const h = harness(); const tile = h.render(device('image', [field('URL', { type: 'string', kind: 'readout', value: url, writable: false })])); assert.equal(tile.querySelector('a'), null);
  }
  const h = harness(); const tile = h.render(device('image', [field('URL', { type: 'string', kind: 'readout', value: 'https://192.168.1.20/image.jpg', writable: false })]));
  assert.equal(tile.querySelector('img'), null); assert.equal(tile.querySelector('a').href, 'https://192.168.1.20/image.jpg'); assert.equal(tile.querySelector('a').rel, 'noopener noreferrer'); assert.equal(h.calls.length, 0);
});

test('vacuum raster maps decode only after expansion, retain DOM on refresh, reject SVG/malformed/oversized dimensions', () => {
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBTsAAAAASUVORK5CYII=';
  const h = harness(); const data = device('vacuumCleaner', [field('MAP_BASE64', { type: 'string', kind: 'readout', value: png, writable: false })]);
  const tile = h.render(data); assert.equal(tile.querySelector('img'), null); assert.equal(tile.textContent.includes(png), false);
  const details = tile.querySelector('details'); details.open = true; details.fire('toggle');
  const image = tile.querySelector('img'); assert.equal(image.src, 'data:image/png;base64,' + png);
  tile.remove(); const refreshed = h.render(data); assert.equal(refreshed.querySelector('img'), image);
  const huge = Buffer.from(png, 'base64'); huge.writeUInt32BE(900000, 16);
  for (const value of ['data:image/svg+xml;base64,' + Buffer.from('<svg/>').toString('base64'), huge.toString('base64'), 'not an image']) {
    const bad = harness(); const node = bad.detail(device('vacuumCleaner', [field('MAP_BASE64', { type: 'string', kind: 'readout', value, writable: false })]));
    const more = node.querySelector('details'); more.open = true; more.fire('toggle'); assert.equal(node.querySelector('img'), null); assert.match(node.textContent, /Kein unterstütztes/);
  }
});

test('server validation failures remain explicit unknown values rather than fabricated success', () => {
  const h = harness(); const tile = h.detail(device('sensor', [field('ACTUAL', { type: 'number', kind: 'readout', value: null, valid: false, writable: false, error: 'EOS_CONTROL_VALUE_LIMIT' })]));
  assert.match(tile.textContent, /Keine Rückmeldung/); assert.match(tile.textContent, /EOS_CONTROL_VALUE_LIMIT/); assert.equal(h.calls.length, 0);
});
