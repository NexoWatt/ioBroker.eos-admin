'use strict';
// Executes the real presenter in a minimal DOM; no visual/browser claim.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sourcePath = path.resolve(__dirname, '../../src-ts/runtime-executables/www/smarthome-presentation.ts');
const source = process.env.EOS_TEST_PRESENTATION_RUNTIME === 'build'
  ? fs.readFileSync(path.resolve(__dirname, '../../www/smarthome-presentation.js'), 'utf8')
  : ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;

function fixture() {
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null;
      this.className = ''; this.dataset = {}; this.attributes = {}; this.ownText = '';
      this.style = { properties: {}, setProperty: (key, value) => { this.style.properties[key] = value; } };
      this.classList = {
        add: (...values) => { this.className = [...new Set([...this.className.split(' ').filter(Boolean), ...values])].join(' '); },
        contains: value => this.className.split(' ').includes(value),
      };
    }
    get textContent() { return this.ownText + this.children.map(child => child.textContent).join(''); }
    set textContent(value) { this.ownText = String(value); this.children = []; }
    get firstChild() { return this.children[0] || null; }
    appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
    insertBefore(child, before) {
      if (before === null) return this.appendChild(child);
      const index = this.children.indexOf(before); assert.ok(index >= 0);
      child.parentElement = this; this.children.splice(index, 0, child); return child;
    }
    replaceWith(child) {
      const parent = this.parentElement; assert.ok(parent);
      const index = parent.children.indexOf(this); parent.children[index] = child;
      child.parentElement = parent; this.parentElement = null;
    }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key] ?? null; }
    matches(selector) { return selector.startsWith('.') ? this.classList.contains(selector.slice(1)) : this.tagName === selector.toUpperCase(); }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  const document = { createElement: tag => new Element(tag) };
  const window = {};
  vm.runInNewContext(source, { window, document }, { filename: sourcePath });
  const create = (className, text = '') => {
    const node = new Element(); node.className = className; node.textContent = text; return node;
  };
  function tile(type, { on = false, readOnly = false, status = 'Bereit' } = {}) {
    const tile = create('nw-sh-tile' + (readOnly ? ' nw-sh-tile--readonly' : ''));
    const header = tile.appendChild(create('nw-sh-tile__header'));
    const title = header.appendChild(create('nw-sh-tile__title'));
    title.appendChild(create('nw-sh-tile__name', 'Langer <img src=x> Gerätename'));
    title.appendChild(create('nw-sh-tile__state', status));
    if (['switch', 'dimmer', 'color', 'scene'].includes(type)) {
      const footer = tile.appendChild(create('nw-sh-tile__footer'));
      const button = footer.appendChild(create(type === 'scene' ? 'nw-sh-mini-btn' : 'nw-sh-mini-toggle', type === 'scene' ? '▶' : ''));
      button.tagName = 'BUTTON'; button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', 'Bestehender Aktionsname');
      button.commandHandler = () => { throw new Error('Presenter must never invoke hardware actions'); };
    }
    if (type === 'blind') {
      const dial = tile.appendChild(create('nw-sh-tile-dial'));
      dial.appendChild(create('nw-sh-tile-dial__arc', 'existing value'));
      dial.appendChild(create('nw-sh-tile-dial__meta', 'Position'));
    }
    if (['rtr', 'sensor'].includes(type)) {
      const big = tile.appendChild(create('nw-sh-tile__big'));
      big.appendChild(create('nw-sh-tile__value', '0,0 °C'));
      big.appendChild(create('nw-sh-tile__meta', 'Soll 22,0 °C · 45 % Luftfeuchte'));
    }
    return tile;
  }
  return { tile, decorate: window.NW_SH_PRESENTATION.decorate };
}

const device = (type, state = {}, patch = {}) => ({ type, state, quality: { status: 'online' }, ...patch });

test('all existing tile kinds keep names, controls and values; decoration is idempotent and data stays unchanged', () => {
  const f = fixture();
  for (const type of ['switch', 'dimmer', 'color', 'blind', 'rtr', 'scene', 'sensor', 'player', 'camera', 'widget']) {
    const tile = f.tile(type); const data = device(type, { on: false, position: 25, currentTemp: 0, value: 0 });
    const before = JSON.stringify(data); const name = tile.querySelector('.nw-sh-tile__name');
    const control = tile.querySelector('.nw-sh-mini-toggle') || tile.querySelector('.nw-sh-mini-btn');
    f.decorate(tile, data); f.decorate(tile, data);
    assert.equal(JSON.stringify(data), before);
    assert.equal(tile.querySelectorAll('.nw-sh-tile__kind').length, 1);
    assert.equal(tile.querySelector('.nw-sh-tile__name'), name);
    assert.equal(name.textContent, 'Langer <img src=x> Gerätename');
    assert.equal(tile.querySelector('img'), null);
    if (control) assert.equal(tile.querySelector('.nw-sh-mini-toggle') || tile.querySelector('.nw-sh-mini-btn'), control);
    if (type === 'sensor') assert.equal(tile.querySelector('.nw-sh-tile__value').textContent, '0,0 °C');
    if (type === 'scene') assert.equal(tile.querySelector('.nw-sh-mini-btn').textContent, '▶Szene ausführen');
  }
});

test('toggle labels distinguish actual off, on, momentary and unavailable feedback without changing ARIA or permissions', () => {
  const f = fixture();
  const cases = [
    [device('switch', { on: false }), false, 'Aus'],
    [device('switch', { on: true }), true, 'Ein'],
    [device('dimmer', { level: 0 }), false, 'Aus'],
    [device('color', { level: 50 }), true, 'Ein'],
    [device('switch', {}), false, 'Keine Rückmeldung'],
    [device('switch', { on: true }, { quality: { status: 'stale' } }), true, 'Keine Rückmeldung'],
    [device('switch', { on: true }, { fieldQuality: { on: { valid: false } } }), true, 'Keine Rückmeldung'],
    [device('switch', { on: true }, { quality: { status: 'online', valid: false } }), true, 'Keine Rückmeldung'],
    [device('switch', { on: true }, { quality: { status: 'unknown' } }), true, 'Keine Rückmeldung'],
    [device('switch', {}, { behavior: { commandMode: 'momentary' } }), false, 'Auslösen'],
  ];
  for (const [data, on, expected] of cases) {
    const tile = f.tile(data.type, { on, readOnly: true });
    const button = tile.querySelector('.nw-sh-mini-toggle'); button.disabled = true;
    f.decorate(tile, data);
    assert.equal(button.querySelector('.nw-sh-mini-toggle__label').textContent, expected);
    assert.equal(button.disabled, true);
    assert.equal(button.getAttribute('aria-pressed'), String(on));
    assert.equal(button.getAttribute('aria-label'), 'Bestehender Aktionsname');
    assert.match(tile.querySelector('.nw-sh-tile__kind').textContent, /Nur Anzeige/);
  }
});

test('blind positions are neutral, bounded and quality-aware; invalid data never appears as zero', () => {
  const f = fixture();
  for (const position of [0, 37, 100, null, '25', NaN, -1, 101]) {
    const tile = f.tile('blind'); f.decorate(tile, device('blind', { position }));
    const preview = tile.querySelector('.nw-sh-blind-preview');
    const valid = typeof position === 'number' && Number.isFinite(position) && position >= 0 && position <= 100;
    assert.equal(preview.querySelector('.nw-sh-blind-preview__value').textContent, valid ? `${position} %` : '—');
    assert.equal(preview.style.properties['--nw-sh-cover-position'], valid ? `${position}%` : '0%');
    assert.equal(preview.classList.contains('nw-sh-blind-preview--unknown'), !valid);
    assert.doesNotMatch(tile.textContent, /offen|geschlossen/i);
    assert.equal(tile.querySelector('.nw-sh-control-visual').getAttribute('aria-hidden'), 'true');
  }
  for (const quality of ['stale', 'offline', 'error', 'invalid', 'unknown']) {
    const tile = f.tile('blind'); f.decorate(tile, device('blind', { position: 60 }, { quality: { status: quality } }));
    assert.equal(tile.querySelector('.nw-sh-blind-preview__value').textContent, '—');
  }
});

test('climate existing Ist/Soll and humidity are retained, including a valid zero temperature', () => {
  const f = fixture(); const tile = f.tile('rtr'); const big = tile.querySelector('.nw-sh-tile__big');
  const before = big.textContent;
  f.decorate(tile, device('rtr', { currentTemp: 0, setpoint: 22, humidity: 45 }));
  assert.equal(big.textContent, before);
  assert.equal(big.dataset.temperatureSource, 'current');
  const fallback = f.tile('rtr'); f.decorate(fallback, device('rtr', { currentTemp: null, setpoint: 22 }));
  assert.equal(fallback.querySelector('.nw-sh-tile__big').dataset.temperatureSource, 'setpoint');
  const invalid = f.tile('rtr'); f.decorate(invalid, device('rtr', { currentTemp: null, setpoint: 22 }, { fieldQuality: { setpoint: { valid: false } } }));
  assert.equal(invalid.querySelector('.nw-sh-tile__big').dataset.temperatureSource, 'unknown');
  const unknown = f.tile('rtr'); f.decorate(unknown, device('rtr', { currentTemp: 20, setpoint: 22 }, { quality: { status: 'unknown' } }));
  assert.equal(unknown.querySelector('.nw-sh-tile__big').dataset.temperatureSource, 'unknown');
});

test('media metadata uses text only, preserves room/transport/source and never loads an artwork URL', () => {
  const f = fixture(); const tile = f.tile('player', { status: 'Wohnzimmer · Originaltitel' });
  const data = device('player', { title: '<img src=https://private.invalid/>', artist: 'Artist', playing: false,
    source: 'Radio', muted: true, cover: 'https://user:secret@camera.invalid/image' }, { room: 'Wohnzimmer' });
  f.decorate(tile, data); f.decorate(tile, data);
  assert.equal(tile.querySelectorAll('.nw-sh-player-summary').length, 1);
  assert.equal(tile.querySelector('.nw-sh-player-summary__title').textContent, data.state.title);
  assert.equal(tile.querySelector('.nw-sh-player-summary__artist').textContent, 'Artist');
  assert.equal(tile.querySelector('.nw-sh-tile__state').textContent, 'Wohnzimmer · Pausiert · Radio · Stumm');
  assert.equal(tile.querySelector('img'), null);
  const stale = f.tile('player'); f.decorate(stale, { ...data, quality: { status: 'stale' } });
  assert.equal(stale.querySelector('.nw-sh-player-summary'), null);
});

test('malformed device input only decorates a generic tile and never creates control capability', () => {
  const f = fixture();
  for (const value of [null, undefined, [], '<script>', { type: '__proto__', state: { value: '<script>' } }]) {
    const tile = f.tile('sensor'); f.decorate(tile, value);
    assert.equal(tile.querySelector('.nw-sh-tile__kind').textContent, 'Gerät');
    assert.equal(tile.querySelector('button'), null);
    assert.equal(tile.querySelector('.nw-sh-tile__value').textContent, '0,0 °C');
  }
});
