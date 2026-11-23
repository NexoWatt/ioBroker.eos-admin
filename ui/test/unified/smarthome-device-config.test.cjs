'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const typedFile = path.resolve(__dirname, '../../src-ts/runtime-executables/www/smarthome-device-config.ts');
const source = ts.transpileModule(fs.readFileSync(typedFile, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const catalog = { ok: true, profiles: [
  { id: 'light', label: 'Licht', fields: [
    { key: 'ON', label: 'Ein/Aus', type: 'boolean', read: true, write: true, required: true },
    { key: 'ACTUAL', label: 'Rückmeldung', type: 'number', read: true, write: false, unit: '%' },
    { key: 'STOP', label: 'Stopp', type: 'boolean', read: false, write: true },
  ] },
  { id: 'socket', label: 'Steckdose', fields: [
    { key: 'ON', label: 'Ein/Aus', type: 'boolean', read: true, write: true },
  ] },
] };
const plain = value => JSON.parse(JSON.stringify(value));
async function settle() { for (let i = 0; i < 10; i++) await new Promise(resolve => setImmediate(resolve)); }
function fixture(reply = catalog) {
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
  const body = new Element('body');
  const changes = []; const calls = []; const confirmations = []; let confirmed = false;
  const window = { confirm(message) { confirmations.push(message); return confirmed; } };
  const document = { createElement: tag => new Element(tag) };
  vm.runInNewContext(source, { window, document, AbortController, TextDecoder, setTimeout, clearTimeout,
    fetch: async (url, options) => { calls.push({ url, options }); return typeof reply === 'function' ? reply() : new Response(JSON.stringify(reply)); },
  });
  const api = window.NW_SH_DEVICE_CONFIG;
  function mount(mapping, expanded = true) {
    const container = new Element('div'); body.appendChild(container);
    api.mount(container, mapping, { expanded, onChange: value => changes.push(plain(value)),
      createDpInput: (label, value, onChange) => { const row = new Element('div'); row.inputLabel = label; row.value = value; row.change = onChange; return row; },
    });
    return container;
  }
  const find = (root, cls) => root.all(node => node.className.split(' ').includes(cls))[0];
  const button = (root, text) => root.all(node => node.tagName === 'BUTTON' && node.textContent === text)[0];
  return { api, mount, body, calls, changes, confirmations, find, button, confirm: value => { confirmed = value; },
    field: (root, key) => root.all(node => node.dataset.profileKey === key)[0] };
}

test('full profile exposes optional and separate read/write mappings without writing a device', async () => {
  const f = fixture(); const initial = { profile: 'light', fields: [{ key: 'ON', readId: 'device.actual', writeId: 'device.set' }] };
  const root = f.mount(initial); await settle();
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].url, '/api/smarthome/control-profiles');
  assert.equal(f.calls[0].options.method, 'GET'); assert.equal(f.calls[0].options.credentials, 'same-origin');
  assert.equal(f.field(root, 'ON').all(node => node.change).length, 2);
  assert.equal(f.field(root, 'ACTUAL').all(node => node.change).length, 1);
  assert.equal(f.field(root, 'STOP').all(node => node.change).length, 1);
  assert.equal(f.changes.length, 0, 'loading never changes draft');
  f.field(root, 'ACTUAL').all(node => node.change)[0].change('device.level');
  assert.deepEqual(f.changes.at(-1), { profile: 'light', fields: [initial.fields[0], { key: 'ACTUAL', readId: 'device.level' }] });
  assert.equal(initial.fields.length, 1, 'initial config is never mutated');
  assert.equal(f.calls.length, 1, 'editing invokes no API write');
  f.field(root, 'ON').all(node => node.change)[1].change('');
  assert.deepEqual(f.changes.at(-1).fields[0], { key: 'ON', readId: 'device.actual' }, 'clearing write preserves read');
});

test('profile selection is staged and removal requires confirmation; shared overrides survive', async () => {
  const f = fixture(); const root = f.mount({ profile: 'light', fields: [{ key: 'ON', readId: 'manual.actual', writeId: 'manual.set' }, { key: 'STOP', writeId: 'manual.stop' }] });
  await settle();
  const select = f.find(root, 'nw-sh-profile__select'); select.value = 'socket'; select.fire('change');
  assert.equal(f.changes.length, 0);
  f.button(root, 'Profil übernehmen').fire('click');
  assert.equal(f.changes.length, 0, 'declining keeps every old mapping');
  assert.match(f.confirmations[0], /STOP \(Schreiben\)/);
  f.confirm(true); f.button(root, 'Profil übernehmen').fire('click');
  assert.deepEqual(f.changes.at(-1), { profile: 'socket', fields: [{ key: 'ON', readId: 'manual.actual', writeId: 'manual.set' }] });
  assert.equal(f.calls.length, 1);
});

test('catalog failure and unsupported profile retain saved config; retry is explicit', async () => {
  const f = fixture(() => new Response('{}', { status: 403 })); const root = f.mount({ profile: 'light', fields: [{ key: 'ON', readId: 'actual' }] });
  await settle(); assert.match(f.find(root, 'nw-sh-profile__status').textContent, /Berechtigung/);
  assert.ok(f.button(root, 'Erneut laden')); assert.equal(f.changes.length, 0);
  const g = fixture(); const unknown = g.mount({ profile: 'unavailable', fields: [{ key: 'VALUE', readId: 'actual' }] });
  await settle(); assert.ok(g.field(unknown, 'VALUE')); assert.equal(g.changes.length, 0);
});

test('collapsed classic cards allocate no profile inputs or requests; open cards share catalog', async () => {
  const f = fixture(); const cards = Array.from({ length: 12 }, () => f.mount({ profile: 'light', fields: [] }, false));
  await settle(); assert.equal(f.calls.length, 0); assert.equal(f.body.all(node => node.change).length, 0);
  for (const card of cards) { const details = f.find(card, 'nw-sh-profile'); details.open = true; details.fire('toggle'); }
  await settle(); assert.equal(f.calls.length, 1); assert.equal(f.body.all(node => node.change).length, 48);
});

test('invalid, duplicate, oversized mappings and unsafe catalog keys are rejected without loss', async () => {
  const f = fixture();
  assert.match(f.api.validationError(null, true), /Bedienprofil/);
  assert.equal(f.api.validationError(null, false), null);
  assert.match(f.api.validationError({ profile: 'light', fields: [{ key: 'ON' }, { key: 'ON' }] }, false), /doppelte/);
  assert.match(f.api.validationError({ profile: 'light', fields: Array.from({ length: 129 }, (_, i) => ({ key: `FIELD_${i}` })) }, false), /Ungültige/);
  assert.match(f.api.validationError({ profile: 'light', fields: [{ key: '__proto__', readId: 'actual' }] }, false), /Ungültige/);
  const g = fixture({ ok: true, profiles: [{ id: 'constructor', label: 'Bad', fields: [] }] }); const root = g.mount(null);
  await settle(); assert.equal(g.find(root, 'nw-sh-profile__status').dataset.state, 'error'); assert.equal(g.changes.length, 0);
});

test('remounting after room reassignment retains profile and manual overrides', async () => {
  const f = fixture(); const root = f.mount({ profile: 'light', fields: [{ key: 'ON', readId: 'manual' }] });
  await settle(); f.field(root, 'ON').all(node => node.change)[1].change('command');
  const changed = f.changes.at(-1); root.parentElement.replaceChildren();
  const next = f.mount(changed); await settle();
  assert.equal(f.field(next, 'ON').all(node => node.change)[0].value, 'manual');
  assert.equal(f.field(next, 'ON').all(node => node.change)[1].value, 'command');
  assert.equal(f.calls.length, 1);
});

test('invalid manual DP text blocks saving instead of silently keeping the previous mapping', async () => {
  const f = fixture(); const mapping = { profile: 'light', fields: [{ key: 'ON', readId: 'test.0.value' }] };
  const root = f.mount(mapping); await settle();
  const input = f.field(root, 'ON').all(node => node.change)[0]; input.change('test.0.*');
  assert.match(f.api.validationError(mapping, true), /korrigieren/);
  assert.equal(f.changes.length, 0, 'invalid input never corrupts the prior mapping');
  input.change('test.0.changed');
  assert.equal(f.api.validationError(f.changes.at(-1), true), null);
});

// Exercise the actual legacy editor transaction and stable keyed-field paths.
function importFixture() {
  const input = fs.readFileSync(path.resolve(__dirname, '../../src-ts/runtime-executables/www/smarthome-config.ts'), 'utf8');
  const file = ts.createSourceFile('config.ts', input, ts.ScriptTarget.Latest, true);
  const names = new Set(['nwShcfgImportFieldAllowed', 'nwShcfgImportFieldValue', 'nwApplyTypeDetectedUpdate', 'nwShcfgDraftContainsSuggestion']);
  const functions = file.statements.filter(node => ts.isFunctionDeclaration(node) && names.has(node.name?.text)).map(node => node.getText(file)).join('\n');
  const context = { nwShcState: { config: { devices: [] }, detector: { results: [] } }, nwShcfgCloneJson: plain,
    nwSetDetectorStatus() {}, nwMarkDirty() {}, nwRenderAll() {} };
  vm.createContext(context); vm.runInContext(functions, context); return context;
}
test('import updates keyed directions atomically and protects manual changes', () => {
  const c = importFixture(); const current = { id: 'one', type: 'device', importProvenance: { sourceId: 'source' }, io: { deviceControls: { profile: 'light', fields: [{ key: 'ON', readId: 'manual', writeId: 'old.set' }] } } };
  c.nwShcState.config.devices.push(current);
  const path = 'io.deviceControls.fields.ON.writeId';
  c.nwShcState.detector.results.push({ id: 'proposal', importable: true, sourceId: 'source', targetType: 'device', proposal: { importProvenance: { sourceId: 'source' } }, update: { deviceId: 'one', changes: [{ path, current: 'old.set', proposed: 'new.set' }] } });
  assert.equal(c.nwShcfgImportFieldAllowed(path), true);
  assert.equal(c.nwShcfgImportFieldAllowed('io.deviceControls.fields.0.writeId'), false);
  assert.equal(c.nwShcfgImportFieldAllowed('io.deviceControls.fields.__proto__.writeId'), false);
  assert.equal(c.nwApplyTypeDetectedUpdate('proposal', [path]), true);
  assert.deepEqual(plain(c.nwShcState.config.devices[0].io.deviceControls.fields), [{ key: 'ON', readId: 'manual', writeId: 'new.set' }]);
  assert.equal(c.nwApplyTypeDetectedUpdate('proposal', [path]), false, 'stale proposal cannot overwrite updated mapping');
  c.nwShcState.detector.results[0].update.changes[0] = { path, current: 'new.set', proposed: null };
  assert.equal(c.nwApplyTypeDetectedUpdate('proposal', [path]), true);
  assert.deepEqual(plain(c.nwShcState.config.devices[0].io.deviceControls.fields), [{ key: 'ON', readId: 'manual' }]);
});

test('different controls under one source can be imported, existing profile mappings deduplicate', () => {
  const c = importFixture(); c.nwShcState.config.devices.push({ importProvenance: { sourceId: 'source', controlId: 'a' }, io: { deviceControls: { profile: 'light', fields: [{ key: 'ON', readId: 'state.one' }] } } });
  assert.equal(c.nwShcfgDraftContainsSuggestion({ sourceId: 'source', provenance: { controlId: 'b' }, semanticIds: ['state.two'] }), false);
  assert.equal(c.nwShcfgDraftContainsSuggestion({ sourceId: 'source', provenance: { controlId: 'b' }, semanticIds: ['state.one'] }), true);
  c.nwShcState.config.devices[0].io.deviceControls.fields.push({ key: 'BATTERY', readId: 'shared.battery' });
  assert.equal(c.nwShcfgDraftContainsSuggestion({ sourceId: 'source', provenance: { controlId: 'b', sourceStateIds: ['shared.battery'] }, semanticIds: ['state.two'], states: [{ key: 'BATTERY', id: 'shared.battery', indicator: true }] }), false, 'shared battery does not hide another detected device');
});

test('oversized catalog and duplicate profile fields are blocked before rendering mappings', async () => {
  const f = fixture(() => new Response(' '.repeat(1024 * 1024 + 1)));
  const root = f.mount({ profile: 'light', fields: [] }); await settle();
  assert.equal(f.find(root, 'nw-sh-profile__status').dataset.state, 'error');
  assert.equal(root.all(node => node.change).length, 0); assert.equal(f.changes.length, 0);
  const duplicate = plain(catalog); duplicate.profiles[0].fields.push(duplicate.profiles[0].fields[0]);
  const g = fixture(duplicate); const invalid = g.mount(null); await settle();
  assert.equal(g.find(invalid, 'nw-sh-profile__status').dataset.state, 'error');
});

test('real TypeDetector catalog loads completely, including indexed weather and manual universal slots', async () => {
  const Module = require('node:module');
  const filename = path.resolve(__dirname, '../../lib/smarthome-device-controls.js');
  const backend = new Module(filename, module); backend.filename = filename; backend.paths = Module._nodeModulePaths(path.dirname(filename));
  backend._compile(ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../../src-ts/runtime-executables/lib/smarthome-device-controls.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText, filename);
  const real = backend.exports.getControlProfiles();
  const f = fixture({ ok: true, profiles: real }); const root = f.mount({ profile: 'weatherForecast', fields: [] }); await settle();
  assert.equal(f.find(root, 'nw-sh-profile__status').dataset.state, 'ready');
  assert.equal(f.find(root, 'nw-sh-profile__select').children.length, real.length + 1);
  const template = real.find(profile => profile.id === 'weatherForecast').fields.find(field => field.key.endsWith('%d'));
  assert.ok(template);
  const row = f.field(root, template.key); const day = row.all(node => node.type === 'number')[0]; day.value = '12';
  f.button(row, 'Tagesfunktion hinzufügen').fire('click');
  const key = template.key.slice(0, -2) + '12';
  assert.ok(f.field(root, key));
  f.field(root, key).all(node => node.change)[0].change('weather.0.day12.value');
  assert.ok(backend.exports.normalizeDeviceControls(f.changes.at(-1)));
  const g = fixture({ ok: true, profiles: real }); const generic = g.mount({ profile: 'universal', fields: [] }); await settle();
  const name = generic.all(node => node.attrs['aria-label'] === 'Universellen Funktionsschlüssel hinzufügen')[0]; name.value = 'CUSTOM_VALUE';
  g.button(generic, 'Funktion hinzufügen').fire('click');
  const custom = g.field(generic, 'CUSTOM_VALUE'); assert.equal(custom.all(node => node.change).length, 2);
  custom.all(node => node.change)[0].change('custom.0.value');
  assert.ok(backend.exports.normalizeDeviceControls(g.changes.at(-1)));
  assert.equal(g.calls.length, 1); assert.equal(f.calls.length, 1);
});
