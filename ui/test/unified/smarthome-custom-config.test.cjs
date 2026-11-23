/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const ts = require('typescript');
function compile(file) { return ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../src-ts/runtime-executables/' + file), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText; }
const customSource = compile('www/smarthome-custom-config.ts');
const profileSource = compile('www/smarthome-device-config.ts');
const backendName = path.resolve(__dirname, '../../lib/smarthome-custom-contract.js');
const backend = new Module(backendName, module); backend.filename = backendName; backend.paths = Module._nodeModulePaths(path.dirname(backendName)); backend._compile(compile('lib/smarthome-custom-contract.ts'), backendName);
const contract = backend.exports;
const catalog = contract.getCustomViewCatalog();
const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
async function settle() { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); }
function fixture(reply) {
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.attrs = {}; this.dataset = {}; this.handlers = new Map(); this.className = ''; this.textContent = ''; this.value = ''; this.hidden = false; this.disabled = false; this.open = false; }
    get isConnected() { return this === body || !!this.parentElement?.isConnected; }
    appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
    replaceChildren(...children) { for (const child of this.children) child.parentElement = null; this.children = []; children.forEach(child => this.appendChild(child)); }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    addEventListener(name, callback) { this.handlers.set(name, callback); }
    fire(name) { this.handlers.get(name)?.({ target: this }); }
    all(predicate) { return this.children.flatMap(child => [...(predicate(child) ? [child] : []), ...child.all(predicate)]); }
  }
  class Input extends Element { constructor() { super('input'); this.checked = false; } }
  const body = new Element('body'); const calls = []; const changes = []; const confirmations = []; let confirmation = true; let binding = null;
  const document = { createElement: tag => tag === 'input' ? new Input() : new Element(tag) };
  const window = { confirm(message) { confirmations.push(message); return confirmation; } };
  const context = vm.createContext({ window, document, HTMLInputElement: Input, URL, Intl, AbortController, TextDecoder, setTimeout, clearTimeout,
    fetch: async (url, options) => { calls.push({ url, options }); return reply ? reply() : new Response(JSON.stringify({ ok: true, profiles: contract.getCustomControlProfiles(), customViews: catalog })); },
  });
  vm.runInContext(customSource, context); vm.runInContext(profileSource, context);
  const api = window.NW_SH_CUSTOM_CONFIG;
  function mount(initial = null, controls = null, expanded = true) {
    binding = controls;
    const root = new Element('div'); body.appendChild(root);
    api.mount(root, initial, { expanded, getControls: () => binding, onChange: (view, next, rebuild) => {
      if (next !== undefined) binding = plain(next);
      changes.push({ view: plain(view), controls: plain(next), rebuild });
    } }); return root;
  }
  const button = (root, text) => root.all(node => node.tagName === 'BUTTON' && node.textContent === text)[0];
  const find = (root, cls) => root.all(node => node.className.split(' ').includes(cls))[0];
  function input(root, label) {
    const field = root.all(node => node.tagName === 'LABEL' && node.children[0]?.textContent === label)[0];
    return field?.all(node => ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName))[0];
  }
  function choose(root, kind) { const select = root.all(node => node.attrs['aria-label'] === 'Eigene Ansicht auswählen')[0]; select.value = kind; select.fire('change'); button(root, 'Ansicht übernehmen').fire('click'); }
  return { api, mount, calls, changes, confirmations, input, find, button, choose, body, context,
    binding: () => binding, setBinding: value => { binding = value; }, confirm: value => { confirmation = value; } };
}

test('all ten real catalog views have editable settings and matching fixed profiles, without a device write', async () => {
  assert.equal(catalog.length, 10);
  for (const item of catalog) {
    const f = fixture(); const root = f.mount(); await settle();
    assert.equal(f.find(root, 'nw-sh-custom-config__status').dataset.state, 'ready', item.kind);
    f.choose(root, item.kind);
    const latest = f.changes.at(-1); assert.equal(latest.view.kind, item.kind); assert.equal(latest.controls.profile, item.profile);
    assert.ok(contract.normalizeCustomView(latest.view)); contract.assertCustomViewBindings(latest.view, latest.controls);
    for (const setting of item.settings) {
      if (['colorLevels', 'icons', 'producers', 'consumers'].includes(setting.key)) assert.ok(root.all(node => node.tagName === 'H5' && node.textContent === setting.label).length, setting.key);
      else assert.ok(f.input(root, setting.label), item.kind + '.' + setting.key);
    }
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].options.method, 'GET');
    assert.equal(f.calls[0].url, '/api/smarthome/control-profiles');
  }
});

test('view replacement warns about lost settings and mappings and preserves the draft on cancellation', async () => {
  const f = fixture(); const old = { kind: 'markdown', settings: { text: 'Kundennotiz', fontSize: 'm', align: 'left' } };
  const root = f.mount(old, { profile: 'custom_markdown', fields: [] }); await settle();
  f.confirm(false); f.choose(root, 'clock'); assert.equal(f.changes.length, 0); assert.match(f.confirmations[0], /Einstellungen/);
  f.confirm(true); f.choose(root, 'clock'); assert.equal(f.changes.at(-1).view.kind, 'clock');
  assert.equal(old.settings.text, 'Kundennotiz'); assert.equal(f.calls.length, 1);
});

test('unsafe URL input blocks saving; safe local URL stays data with no preview request', async () => {
  const f = fixture(); const root = f.mount(); await settle(); f.choose(root, 'iframe');
  const url = f.input(root, 'Webadresse');
  for (const value of ['javascript:alert(1)', '//evil.test/', 'https://user:pass@host/', '/\\evil.test/']) {
    url.value = value; url.fire('input'); assert.match(f.api.validationError(f.changes.at(-1).view, f.binding()), /korrigieren/);
  }
  url.value = '/local/view'; url.fire('input');
  const latest = f.changes.at(-1); assert.equal(latest.view.settings.url, '/local/view');
  assert.equal(f.api.validationError(latest.view, f.binding()), null); assert.ok(contract.normalizeCustomView(latest.view));
  assert.equal(root.all(node => node.tagName === 'IFRAME' || node.tagName === 'IMG').length, 0); assert.equal(f.calls.length, 1);
});

test('Markdown is stored as text and scalar action values retain boolean, numeric and string types', async () => {
  const f = fixture(); const root = f.mount(); await settle(); f.choose(root, 'markdown');
  const text = f.input(root, 'Notiztext'); text.value = '# Anlage\n<script>bad()</script>'; text.fire('input');
  assert.equal(f.changes.at(-1).view.settings.text, text.value); assert.equal(root.all(node => node.tagName === 'SCRIPT').length, 0);
  f.choose(root, 'universal');
  const scalarType = root.all(node => node.attrs['aria-label'] === 'Zu sendender Wert: Datentyp')[0];
  scalarType.value = 'string'; scalarType.fire('change'); let value = f.input(root, 'Zu sendender Wert'); value.value = 'false'; value.fire('input');
  assert.equal(f.changes.at(-1).view.settings.actionValue, 'false');
  scalarType.value = 'number'; scalarType.fire('change'); value = f.input(root, 'Zu sendender Wert'); value.value = '0'; value.fire('input');
  assert.equal(f.changes.at(-1).view.settings.actionValue, 0);
  scalarType.value = 'boolean'; scalarType.fire('change'); value = f.input(root, 'Zu sendender Wert'); value.checked = false; value.fire('change');
  assert.equal(f.changes.at(-1).view.settings.actionValue, false); assert.ok(contract.normalizeCustomView(f.changes.at(-1).view));
  assert.equal(f.calls.length, 1);
});

test('energy rows and status icons use structured controls and require corresponding mapped fields', async () => {
  const f = fixture(); const root = f.mount(); await settle(); f.choose(root, 'energyFlow');
  const producers = root.all(node => node.className === 'nw-sh-custom-config__list' && node.children[0]?.textContent === 'Erzeuger')[0];
  f.button(producers, 'Zeile hinzufügen').fire('click');
  let latest = f.changes.at(-1).view; assert.equal(latest.settings.producers[0].index, 1);
  assert.match(f.api.validationError(latest, f.binding()), /Erzeuger 1/);
  f.setBinding({ profile: 'custom_energyFlow', fields: [{ key: 'PRODUCER1', readId: 'device.0.pv' }] });
  assert.equal(f.api.validationError(latest, f.binding()), null); contract.assertCustomViewBindings(latest, f.binding());
  f.input(producers, 'Name').value = 'PV Dach'; f.input(producers, 'Name').fire('input'); latest = f.changes.at(-1).view;
  assert.equal(latest.settings.producers[0].name, 'PV Dach'); assert.ok(contract.normalizeCustomView(latest));
  f.choose(root, 'universal');
  const icons = root.all(node => node.className === 'nw-sh-custom-config__list' && node.children[0]?.textContent === 'Statussymbole')[0];
  f.button(icons, 'Zeile hinzufügen').fire('click'); latest = f.changes.at(-1).view;
  assert.match(f.api.validationError(latest, f.binding()), /ICON1/);
  f.setBinding({ profile: 'custom_universal', fields: [{ key: 'ICON1', readId: 'device.0.connected' }] });
  contract.assertCustomViewBindings(latest, f.binding()); assert.equal(f.calls.length, 1);
});

test('optional coordinates can be cleared and invalid time zones or gauge ranges block save', async () => {
  const f = fixture(); const root = f.mount(); await settle(); f.choose(root, 'clock');
  const lat = f.input(root, 'Breitengrad'); lat.value = '52.5'; lat.fire('input'); assert.equal(f.changes.at(-1).view.settings.latitude, 52.5);
  lat.value = ''; lat.fire('input'); assert.equal(Object.hasOwn(f.changes.at(-1).view.settings, 'latitude'), false);
  const zone = f.input(root, 'Zeitzone (leer: Endgerät)'); zone.value = 'Invalid/Zone'; zone.fire('input'); assert.match(f.api.validationError(f.changes.at(-1).view, f.binding()), /Zeitzone/);
  zone.value = 'Europe/Berlin'; zone.fire('input'); assert.equal(f.api.validationError(f.changes.at(-1).view, f.binding()), null);
  f.choose(root, 'gauge'); const min = f.input(root, 'Unterer Messbereich'); min.value = '100'; min.fire('input');
  assert.match(f.api.validationError(f.changes.at(-1).view, f.binding()), /Höchstwert/);
});

test('legacy editor save gate refuses invalid custom inputs before any generic override prompt or POST', async () => {
  const f = fixture(); const root = f.mount(); await settle(); f.choose(root, 'iframe');
  const url = f.input(root, 'Webadresse'); url.value = 'javascript:alert(1)'; url.fire('input');
  const input = fs.readFileSync(path.resolve(__dirname, '../../src-ts/runtime-executables/www/smarthome-config.ts'), 'utf8');
  const file = ts.createSourceFile('config.ts', input, ts.ScriptTarget.Latest, true);
  const names = new Set(['nwShcfgControlEditorError', 'nwSaveSmartHomeConfig']);
  const code = file.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text)).map(node => node.getText(file)).join('\n');
  f.context.nwShcState = { config: { devices: [{ type: 'device', customView: f.changes.at(-1).view, io: { deviceControls: f.binding() } }] } };
  let status = ''; f.context.nwSetStatus = value => { status = value; }; f.context.confirm = () => { throw new Error('unexpected override'); };
  vm.runInContext(code, f.context); await f.context.nwSaveSmartHomeConfig();
  assert.match(status, /Speichern abgebrochen.*korrigieren/); assert.equal(f.calls.length, 1);
});

test('collapsed views and profile editors share one bounded catalog read, failures preserve old settings', async () => {
  const f = fixture(); const root = f.mount(null, null, false); await settle(); assert.equal(f.calls.length, 0);
  const details = f.find(root, 'nw-sh-custom-config'); details.open = true; details.fire('toggle'); await settle();
  const profileContainer = f.body.appendChild(new (root.constructor)('div'));
  f.context.window.NW_SH_DEVICE_CONFIG.mount(profileContainer, { profile: 'custom_clock', fields: [] }, { expanded: true, fixedProfile: 'custom_clock', createDpInput: () => new (root.constructor)('div'), onChange: () => assert.fail('load must not write') });
  await settle(); assert.equal(f.calls.length, 1);
  assert.equal(f.find(profileContainer, 'nw-sh-profile__select').disabled, true);
  const g = fixture(() => new Response('{}', { status: 401 })); const old = { kind: 'clock', settings: { style: 'digital' } };
  const blocked = g.mount(old, { profile: 'custom_clock', fields: [] }); await settle(); assert.equal(g.changes.length, 0); assert.ok(g.button(blocked, 'Erneut laden'));
  assert.match(g.find(blocked, 'nw-sh-custom-config__status').textContent, /Sitzung/);
});
