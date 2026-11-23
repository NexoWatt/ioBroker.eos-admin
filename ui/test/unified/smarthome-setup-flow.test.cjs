/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
// Product functions and browser helpers run unchanged. DOM layout is not emulated;
// responsive assertions below are structural CSS contracts, not browser acceptance.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const plain = value => JSON.parse(JSON.stringify(value));
const turn = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

function environment(withActionMenus = false) {
  let document;
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attrs = {}; this.handlers = new Map();
      this.className = ''; this.textContent = ''; this.value = ''; this.disabled = false; this.hidden = false; this._tabIndex = ['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(this.tagName) ? 0 : -1;
      this.style = { setProperty(key, value) { this[key] = value; }, getPropertyValue(key) { return this[key] || ''; }, removeProperty(key) { delete this[key]; } };
      this.classList = { contains: value => this.className.split(/\s+/).includes(value),
        add: (...values) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...values])].join(' '); },
        remove: (...values) => { this.className = this.className.split(/\s+/).filter(value => !values.includes(value)).join(' '); },
        toggle: (value, force) => { const next = force === undefined ? !this.classList.contains(value) : force; this.classList[next ? 'add' : 'remove'](value); return next; } };
    }
    get parentNode() { return this.parentElement || null; }
    get tabIndex() { return this._tabIndex; }
    set tabIndex(value) { this._tabIndex = value; this.attrs.tabindex = String(value); }
    get isConnected() { return this === document.body || this === document.documentElement || !!this.parentElement?.isConnected; }
    get firstChild() { return this.children[0] || null; }
    get lastChild() { return this.children.at(-1) || null; }
    get nextSibling() { return this.parentElement?.children[this.parentElement.children.indexOf(this) + 1] || null; }
    get childNodes() { return this.children; }
    get options() { return this.all(node => node.tagName === 'OPTION'); }
    get innerHTML() { return this._html || ''; }
    set innerHTML(value) { this.replaceChildren(); this._html = value; }
    appendChild(child) { child.remove(); this.children.push(child); child.parentElement = this; if (this.tagName === 'SELECT' && this.children.length === 1) this.value = child.value; return child; }
    append(...children) { children.forEach(child => this.appendChild(typeof child === 'string' ? Object.assign(new Element('span'), { textContent: child }) : child)); }
    insertBefore(child, before) { child.remove(); const index = this.children.indexOf(before); this.children.splice(index < 0 ? this.children.length : index, 0, child); child.parentElement = this; return child; }
    removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parentElement = null; return child; }
    remove() { this.parentElement?.removeChild(this); }
    replaceChildren(...children) { for (const child of this.children) child.parentElement = null; this.children = []; children.forEach(child => this.appendChild(child)); }
    setAttribute(key, value) { this.attrs[key] = String(value); if (key === 'id') this.id = String(value); if (key === 'tabindex') this.tabIndex = Number(value); if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase())] = String(value); }
    getAttribute(key) { return this.attrs[key] ?? null; }
    removeAttribute(key) { delete this.attrs[key]; }
    hasAttribute(key) { return key === 'disabled' ? this.disabled : key === 'hidden' ? this.hidden : key === 'open' ? !!this.open : Object.hasOwn(this.attrs, key); }
    addEventListener(type, fn) { if (!this.handlers.has(type)) this.handlers.set(type, new Set()); this.handlers.get(type).add(fn); }
    removeEventListener(type, fn) { this.handlers.get(type)?.delete(fn); }
    fire(type, extra = {}) { const event = { type, target: this, currentTarget: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...extra }; for (const fn of this.handlers.get(type) || []) fn(event); return event; }
    dispatchEvent(event) { this.fire(event.type, event); return !event.defaultPrevented; }
    focus() { document.activeElement = this; }
    select() {} scrollIntoView() {}
    contains(node) { return this === node || this.children.some(child => child.contains(node)); }
    all(predicate) { return this.children.flatMap(child => [...(predicate(child) ? [child] : []), ...child.all(predicate)]); }
    matches(selector) {
      if (selector.includes(',')) return selector.split(',').some(value => this.matches(value.trim()));
      for (const match of [...selector.matchAll(/:not\(([^)]+)\)/g)]) { if (this.matches(match[1])) return false; selector = selector.replace(match[0], ''); }
      const attributes = [...selector.matchAll(/\[([^\]=]+)(?:=["']?([^"'\]]*)["']?)?\]/g)];
      const bare = selector.replace(/\[[^\]]*\]/g, '');
      if (bare.startsWith('#') && this.id !== bare.slice(1)) return false;
      if (bare.startsWith('.') && !this.classList.contains(bare.slice(1))) return false;
      if (bare && /^[a-z]/i.test(bare) && this.tagName !== bare.toUpperCase()) return false;
      return attributes.every(([, key, value]) => {
        const actual = key === 'disabled' ? (this.disabled ? '' : null) : key === 'hidden' ? (this.hidden ? '' : null) : key === 'open' ? (this.open ? '' : null) : key === 'tabindex' ? this.attrs.tabindex
          : key.startsWith('data-') ? this.dataset[key.slice(5).replace(/-([a-z])/g, (_m, c) => c.toUpperCase())] : this.attrs[key];
        return actual !== undefined && actual !== null && (value === undefined || actual === value);
      });
    }
    querySelectorAll(selector) { return this.all(node => node.matches(selector)); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
    getBoundingClientRect() { return { top: 0, left: 0, right: 320, bottom: 100, width: 320, height: 100 }; }
  }
  document = new Element('document'); document.documentElement = new Element('html'); document.body = new Element('body');
  document.documentElement.appendChild(document.body); document.activeElement = document.body;
  document.createElement = tag => new Element(tag); document.createTextNode = text => Object.assign(new Element('span'), { textContent: text });
  document.getElementById = id => document.documentElement.querySelector('#' + id);
  document.querySelector = selector => document.documentElement.querySelector(selector);
  document.querySelectorAll = selector => document.documentElement.querySelectorAll(selector);
  const window = new Element('window'); window.innerWidth = 320; window.innerHeight = 720;
  window.confirm = () => true; window.NW_AUTH = { hasCapability: () => true }; window.matchMedia = () => ({ matches: true });
  window.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
  const calls = []; let response = async () => { throw new Error('Unexpected request'); };
  const context = vm.createContext({ window, document, HTMLElement: Element, Element, Node: Element, Map, Set, Date,
    AbortController, TextDecoder, TextEncoder, Response, URL, URLSearchParams, DOMException,
    setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame: callback => setTimeout(callback, 0), cancelAnimationFrame: clearTimeout,
    confirm: (...args) => window.confirm(...args), console: { error() {}, warn() {}, log() {} },
    fetch: async (url, options = {}) => { calls.push({ url, options }); return response(url, options); },
  });
  const source = fs.readFileSync(path.join(root, 'src-ts/runtime-executables/www/smarthome-config.ts'), 'utf8');
  const parsed = ts.createSourceFile('config.ts', source, ts.ScriptTarget.Latest, true);
  assert.equal(parsed.parseDiagnostics.length, 0);
  const declarations = parsed.statements.filter(node => ts.isFunctionDeclaration(node) || ts.isVariableStatement(node)).map(node => node.getText(parsed)).join('\n');
  vm.runInContext(declarations, context);
  const state = vm.runInContext('nwShcState', context);
  state.ui = { mode: 'home', builder: { selected: null }, deviceBrowser: {}, layout: {} };
  state.config = { floors: [{ id: 'ground', name: 'Erdgeschoss', order: 1 }], rooms: [{ id: 'office', name: 'Büro', floorId: 'ground', order: 1 }], functions: [{ id: 'lighting', name: 'Licht', order: 1 }], devices: [], scenes: [], pages: [], meta: {} };
  state.pagesJsonText = '[]'; state.detector = { results: [], assignments: {}, loaded: false, loading: false, useAliases: false };
  for (const id of ['nw-config-status', 'nw-shcfg-detect-status', 'nw-config-save-btn']) { const node = document.createElement(id.endsWith('btn') ? 'button' : 'div'); node.id = id; document.body.appendChild(node); }
  const actualRenderAll = context.nwRenderAll;
  // Rendering not involved in data-flow assertions; dialog integration may restore its own real render path below.
  context.nwRenderAll = context.nwRenderPagesEditor = context.nwRenderShcfgDetector = context.nwRenderValidationPanel = context.nwApplyValidationToDom = context.nwScheduleValidation = () => {};
  if (withActionMenus) {
    for (const [className, labels] of [['nw-setup-project-actions', ['Projektdatei', 'Neu laden', 'Export', 'Import']], ['nw-shcfg-more', ['Weitere Funktionen', 'Szenen', 'Alle Einstellungen']]]) {
      const menu = document.createElement('details'); menu.className = className;
      const summary = document.createElement('summary'); summary.textContent = labels[0]; menu.appendChild(summary);
      const panel = document.createElement('div');
      for (const label of labels.slice(1)) { const button = document.createElement('button'); button.textContent = label; panel.appendChild(button); }
      menu.appendChild(panel); document.body.appendChild(menu);
    }
  }
  const load = name => vm.runInContext(ts.transpileModule(fs.readFileSync(path.join(root, 'src-ts/runtime-executables/www/' + name + '.ts'), 'utf8'),
    { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText, context);
  load('smarthome-alias-config'); load('smarthome-device-config'); load('smarthome-setup');
  return { context, state, window, document, Element, calls, load, actualRenderAll, reply: fn => { response = fn; },
    status: () => document.getElementById('nw-config-status').textContent,
    detectStatus: () => document.getElementById('nw-shcfg-detect-status').textContent };
}

function suggestion(id = 'source-light', type = 'switch') {
  return { id, sourceId: 'native.0.' + id, sourceName: 'Licht ' + id, displayName: 'Kundenlicht ' + id, targetType: type, detectorType: 'light', importable: true,
    states: [{ key: 'SET', id: 'native.0.' + id + '.set', indicator: false }], semanticIds: ['native.0.' + id + '.set'],
    suggestedAssignment: { roomId: 'office', functionId: 'lighting' }, metadata: {},
    proposal: { type, alias: 'Kundenlicht ' + id, behavior: { favorite: true, readOnly: false },
      io: { switch: { readId: 'native.0.' + id + '.actual', writeId: 'native.0.' + id + '.set' }, deviceControls: { profile: 'light', fields: [{ key: 'SET', readId: 'native.0.' + id + '.actual', writeId: 'native.0.' + id + '.set' }] } },
      importProvenance: { sourceId: 'native.0.' + id, controlId: 'native.0.' + id + '#light', semanticStateIds: ['native.0.' + id + '.set'], sourceValues: {} } } };
}

test('every existing template can be prepared without adding a device or changing customer settings', () => {
  const f = environment(); const before = plain(f.state.config);
  const templates = vm.runInContext('NW_SHCFG_BUILDER_DEVICE_TEMPLATES', f.context);
  assert.ok(templates.length >= 30);
  for (const template of templates) {
    const device = f.context.nwAddDeviceFromTemplate(template.id, { draftOnly: true, silent: true, roomId: 'office', functionId: 'lighting' });
    assert.equal(device.type, template.type, template.id); assert.equal(device.roomId, 'office'); assert.equal(device.functionId, 'lighting');
  }
  assert.deepEqual(plain(f.state.config), before); assert.equal(f.calls.length, 0); assert.equal(f.state.dirty, false);
});

test('single detected import preserves configured bindings, room and device types; repeated import is a no-op', async () => {
  const f = environment();
  for (const type of ['switch', 'dimmer', 'color', 'blind', 'rtr', 'scene', 'sensor', 'player', 'camera', 'widget', 'device']) {
    const row = suggestion(type, type); f.state.detector.results.push(row);
    await f.context.nwImportTypeDetectedSuggestion(row.id);
    const device = f.state.config.devices.at(-1);
    assert.equal(device.type, type); assert.equal(device.roomId, 'office'); assert.deepEqual(plain(device.io), row.proposal.io);
    assert.equal(device.behavior.favorite, true); const count = f.state.config.devices.length;
    await f.context.nwImportTypeDetectedSuggestion(row.id); assert.equal(f.state.config.devices.length, count);
  }
  assert.equal(f.state.config.devices.length, 11); assert.equal(f.state.dirty, true); assert.equal(f.calls.length, 0, 'draft import never persists or operates a device');
});

test('aliases failure with partial created objects leaves both device and proposed room drafts unchanged', async () => {
  const f = environment(); const row = suggestion(); row.suggestedAssignment.roomId = 'new-room'; row.metadata.rooms = [{ id: 'new-room', name: 'Neuer Raum', create: true }];
  f.state.detector.results = [row]; f.state.detector.useAliases = true; const before = plain(f.state.config);
  f.reply(async () => new Response(JSON.stringify({ ok: false, created: ['alias.0.partial'], reused: [], uncertain: ['alias.0.uncertain'] }), { status: 409 }));
  await f.context.nwImportTypeDetectedSuggestion(row.id);
  assert.deepEqual(plain(f.state.config), before); assert.equal(f.calls.length, 1); assert.match(f.detectStatus(), /1 angelegt.*1 unbestätigt/);
  assert.equal(f.state.detector.importing, false); assert.equal(f.state.dirty, false);
});

test('late alias success after replacing the draft cannot import into either customer configuration', async () => {
  const f = environment(); const gate = deferred(); const row = suggestion(); f.state.detector.results = [row]; f.state.detector.useAliases = true;
  const original = f.state.config; f.reply(() => gate.promise);
  const pending = f.context.nwImportTypeDetectedSuggestion(row.id); await turn();
  const request = JSON.parse(f.calls[0].options.body); f.state.config = { ...plain(original), marker: 'new-customer-draft' };
  gate.resolve(new Response(JSON.stringify({ ok: true, devices: request.devices, created: [], reused: [] }))); await pending;
  assert.equal(original.devices.length, 0); assert.equal(f.state.config.devices.length, 0); assert.equal(f.state.config.marker, 'new-customer-draft');
  assert.match(f.detectStatus(), /zwischenzeitlich geändert/);
});

test('detector request failures preserve the customer draft and previous results with explicit error state', async () => {
  const f = environment(); const row = suggestion(); f.state.detector.results = [row]; const before = plain(f.state.config);
  f.reply(async () => new Response(JSON.stringify({ ok: false, error: 'EOS_SESSION_EXPIRED' }), { status: 401 }));
  await f.context.nwLoadTypeDetectorSuggestions(true);
  assert.deepEqual(plain(f.state.config), before); assert.equal(f.state.detector.results[0], row);
  assert.equal(f.state.detector.loading, false); assert.ok(f.state.detector.error); assert.match(f.detectStatus(), /Fehler|abgelaufen/i);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].options.method || 'GET', 'GET');
});

test('failed save preserves unsaved customer fields and reports the server failure without retry', async () => {
  const f = environment(); f.state.config.rooms[0].name = 'Kundenname noch nicht gespeichert'; f.state.dirty = true;
  const before = plain(f.state.config); f.reply(async () => new Response(JSON.stringify({ ok: false, error: 'EOS_PERMISSION_DENIED' }), { status: 403 }));
  await f.context.nwSaveSmartHomeConfig();
  assert.deepEqual(plain(f.state.config), before); assert.equal(f.state.dirty, true); assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, '/api/smarthome/config'); assert.equal(f.calls[0].options.method, 'POST'); assert.match(f.status(), /fehlgeschlagen|Berechtigung/i);
});

test('late successful save cannot replace a newer unsaved edit or clear its dirty state', async () => {
  const f = environment(); const gate = deferred(); f.state.dirty = true; f.reply(() => gate.promise);
  const saving = f.context.nwSaveSmartHomeConfig(); await turn(); assert.equal(f.calls.length, 1);
  const sent = JSON.parse(f.calls[0].options.body).config;
  f.state.config.rooms[0].name = 'Während Speichern geändert';
  gate.resolve(new Response(JSON.stringify({ ok: true, persisted: true, config: sent }))); await saving;
  assert.equal(f.state.config.rooms[0].name, 'Während Speichern geändert'); assert.equal(f.state.dirty, true);
  assert.equal(f.document.getElementById('nw-config-save-btn').disabled, false, 'the newer draft must remain saveable after the request finishes');
});

function nodeByText(rootNode, tag, label) { return rootNode.all(node => node.tagName === tag.toUpperCase() && node.textContent === label)[0]; }
function editor(f, kind, entityId = '', template = 'switch') {
  f.load('smarthome-setup');
  const trigger = f.document.createElement('button'); trigger.textContent = 'Öffnen'; f.document.body.appendChild(trigger); trigger.focus();
  const opened = f.context.nwOpenSetupEditor(kind, entityId, template);
  assert.equal(opened, true, f.status());
  return { trigger, tx: f.state.ui.editorTransaction,
    cancel: () => nodeByText(f.document.body, 'button', 'Abbrechen').fire('click'),
    async apply() { nodeByText(f.document.body, 'button', 'In Entwurf übernehmen').fire('click'); await turn(); await turn(); } };
}

test('real editor cancel restores exact customer object, preexisting dirty state, selection and focus', () => {
  const f = environment(); const cfg = f.state.config; const before = plain(cfg); f.state.dirty = true;
  const selection = { kind: 'device', id: 'customer-selection' }; f.state.ui.builder.selected = selection;
  const session = editor(f, 'room', 'office');
  assert.notEqual(f.state.config, cfg); f.state.config.rooms[0].name = 'Nur Dialog';
  session.cancel(); assert.equal(f.state.config, cfg); assert.deepEqual(plain(cfg), before); assert.equal(f.state.dirty, true);
  assert.equal(f.state.ui.builder.selected, selection); assert.equal(f.document.activeElement, session.trigger); assert.equal(f.calls.length, 0);
});

test('new floor, room and device dialogs leave no records after Cancel or Escape', () => {
  for (const kind of ['floor', 'room', 'device']) {
    const f = environment(); const base = f.state.config; const before = plain(base); const session = editor(f, kind);
    assert.notEqual(f.state.config, base); assert.equal(f.state.ui.editorTransaction.isNew, true);
    if (kind === 'room') f.document.fire('keydown', { key: 'Escape' }); else session.cancel();
    assert.equal(f.state.config, base); assert.deepEqual(plain(base), before); assert.equal(f.state.dirty, false);
    assert.equal(f.window.NW_SH_SETUP.hasDialog(), false); assert.equal(f.calls.length, 0);
  }
});

test('actual form Apply changes only draft; global Save/Reload/Import remain blocked during editing', async () => {
  const f = environment(); const base = f.state.config; const session = editor(f, 'room', 'office');
  const field = session.tx.handle.body.all(node => node.tagName === 'INPUT' && node.value === 'Büro')[0];
  assert.ok(field, 'real existing room name field is rendered'); field.value = 'Arbeitszimmer'; field.fire('change');
  await f.context.nwSaveSmartHomeConfig(); assert.equal(f.calls.length, 0);
  await f.context.nwReloadSmartHomeConfig(); assert.equal(f.calls.length, 0);
  let fileReads = 0; await f.context.nwImportSmartHomeConfigFromFile({ text: async () => { fileReads++; return '{}'; } }); assert.equal(fileReads, 0);
  assert.equal(f.context.nwOpenSetupEditor('room', 'office'), false, 'no stacked transaction can silently replace the current one');
  await session.apply(); assert.notEqual(f.state.config, base); assert.equal(base.rooms[0].name, 'Büro');
  assert.equal(f.state.config.rooms[0].name, 'Arbeitszimmer'); assert.equal(f.state.dirty, true); assert.equal(f.calls.length, 0);
  assert.equal(f.window.NW_SH_SETUP.hasDialog(), false);
});

test('invalid room Apply keeps the dialog open with visible feedback; cancel remains possible', async () => {
  const f = environment(); const session = editor(f, 'room', 'office'); f.state.config.rooms[0].name = '';
  await session.apply(); assert.equal(f.window.NW_SH_SETUP.hasDialog(), true);
  const status = f.document.body.querySelector('.nw-setup-dialog-status'); assert.match(status.textContent, /Namen|Eingaben/);
  session.cancel(); assert.equal(f.state.config.rooms[0].name, 'Büro'); assert.equal(f.state.dirty, false);
});

test('batch imports only distinct new devices into chosen room and preserves their exact bindings', async () => {
  const f = environment(); const first = suggestion('first'); const second = suggestion('second', 'blind'); const duplicate = plain(first); duplicate.id = 'same-physical-source';
  f.state.detector.results = [first, second, duplicate]; f.window.confirm = () => true;
  assert.equal(await f.context.nwImportTypeDetectedBatch([first.id, second.id, duplicate.id], 'office'), true);
  assert.equal(f.state.config.devices.length, 2); assert.equal(new Set(f.state.config.devices.map(row => row.id)).size, 2);
  assert.deepEqual(plain(f.state.config.devices.map(row => row.roomId)), ['office', 'office']);
  assert.deepEqual(plain(f.state.config.devices[0].io), first.proposal.io); assert.deepEqual(plain(f.state.config.devices[1].io), second.proposal.io);
  assert.equal(await f.context.nwImportTypeDetectedBatch([first.id, second.id], 'office'), false); assert.equal(f.state.config.devices.length, 2);
  assert.equal(f.calls.length, 0);
});

test('batch decline, stale target and alias partial failure cannot create a partial configuration', async () => {
  const f = environment(); const a = suggestion('a'); const b = suggestion('b'); f.state.detector.results = [a, b]; const before = plain(f.state.config);
  f.window.confirm = () => false;
  assert.equal(await f.context.nwImportTypeDetectedBatch([a.id, b.id], 'office'), false); assert.deepEqual(plain(f.state.config), before);
  f.window.confirm = () => true;
  assert.equal(await f.context.nwImportTypeDetectedBatch([a.id], 'deleted-room'), false); assert.equal(f.calls.length, 0);
  f.state.detector.useAliases = true;
  f.reply(async () => new Response(JSON.stringify({ ok: false, created: ['alias.0.partial'], reused: [] }), { status: 409 }));
  assert.equal(await f.context.nwImportTypeDetectedBatch([a.id, b.id], 'office'), false);
  assert.deepEqual(plain(f.state.config), before); assert.equal(f.calls.length, 1); assert.match(f.detectStatus(), /1 angelegt/);
});

test('batch alias success cannot overwrite concurrent edits in the same configuration object', async () => {
  const f = environment(); const gate = deferred(); const a = suggestion('a'); const b = suggestion('b'); f.state.detector.results = [a, b]; f.state.detector.useAliases = true;
  f.reply(() => gate.promise); const importing = f.context.nwImportTypeDetectedBatch([a.id, b.id], 'office'); await turn();
  assert.equal(f.calls.length, 1); const sent = JSON.parse(f.calls[0].options.body);
  f.state.config.rooms[0].name = 'Parallel geänderter Kundenraum';
  gate.resolve(new Response(JSON.stringify({ ok: true, devices: sent.devices, created: ['alias.0.partial'], reused: [] })));
  assert.equal(await importing, false); assert.equal(f.state.config.devices.length, 0); assert.equal(f.state.config.rooms[0].name, 'Parallel geänderter Kundenraum');
  assert.match(f.detectStatus(), /geändert.*Keine Geräte übernommen/); assert.equal(f.state.detector.importing, false);
});

test('existing datapoint picker stays reachable inside editing and late selection after Cancel is ignored', async () => {
  const f = environment(); const dev = f.context.nwAddDeviceFromTemplate('switch', { draftOnly: true, silent: true });
  dev.io.switch = { readId: 'native.0.actual', writeId: 'native.0.command' }; f.state.config.devices.push(dev);
  f.reply(async () => new Response(JSON.stringify({ ok: true, children: [], results: [], type: 'state', common: { type: 'boolean' } })));
  const before = plain(f.state.config); const session = editor(f, 'device', dev.id);
  const picker = session.tx.handle.body.querySelector('.nw-config-dp-button'); assert.ok(picker, 'existing source mapping picker is rendered');
  picker.fire('click'); await new Promise(resolve => setTimeout(resolve, 5));
  const nested = f.document.body.querySelector('.nw-dp-dialog-backdrop'); assert.ok(nested); assert.equal(nested.style.display, 'flex');
  const input = nested.querySelector('input'); input.focus(); f.document.fire('focusin', { target: input }); assert.equal(f.document.activeElement, input);
  f.document.fire('keydown', { key: 'Escape' }); assert.equal(f.window.NW_SH_SETUP.hasDialog(), true, 'nested Escape must not cancel the parent editor');
  session.cancel(); assert.equal(nested.style.display, 'none'); f.context.nwDpDialogPick('native.0.late-command');
  assert.deepEqual(plain(f.state.config), before); assert.equal(f.state.dirty, false);
  assert.equal(f.calls.some(call => (call.options.method || 'GET') !== 'GET'), false, 'only metadata reads are allowed while editing');
});

test('pending Apply cannot be cancelled or stacked and exposes failure before allowing another attempt', async () => {
  const f = environment(); const gate = deferred(); let applied = 0; let cancelled = 0;
  const trigger = f.document.createElement('button'); f.document.body.appendChild(trigger); trigger.focus();
  const handle = f.window.NW_SH_SETUP.openDialog({ title: 'Änderung prüfen', render: body => { body.replaceChildren(); }, onApply: () => { applied++; return gate.promise; }, onCancel: () => { cancelled++; } });
  nodeByText(f.document.body, 'button', 'In Entwurf übernehmen').fire('click'); await turn();
  assert.equal(handle.close(), false); assert.equal(f.window.NW_SH_SETUP.openDialog({ title: 'Zweiter Dialog', render() {} }), null);
  f.document.fire('keydown', { key: 'Escape' }); assert.equal(handle.isOpen(), true); assert.equal(cancelled, 0);
  gate.resolve(false); await turn(); assert.equal(handle.isOpen(), true);
  assert.ok(f.document.body.querySelector('.nw-setup-dialog-status').textContent, 'failed Apply must provide visible feedback');
  handle.close(); assert.equal(applied, 1); assert.equal(cancelled, 1); assert.equal(f.document.activeElement, trigger);
});

test('setup dropdown filters preserve every customer record and use actual room/floor relationships', () => {
  const f = environment(); f.state.config.floors.push({ id: 'upper', name: 'Obergeschoss' }); f.state.config.rooms.push({ id: 'bedroom', name: 'Schlafen', floorId: 'upper' });
  const office = { id: 'light', alias: 'Bürolicht', type: 'switch', roomId: 'office', io: { switch: { readId: 'manual.actual', writeId: 'manual.command' } } };
  const bedroom = { id: 'bed', alias: 'Schlafzimmerlicht', type: 'dimmer', roomId: 'bedroom' };
  f.state.config.devices.push(office, bedroom); const before = plain(f.state.config); const container = f.document.createElement('div'); f.document.body.appendChild(container);
  const preferences = {}; const edits = [];
  f.window.NW_SH_SETUP.mountSetup(container, { config: f.state.config, preferences, onEdit: (...args) => edits.push(args), onAdd() {}, onDetect() {} });
  const floorField = container.all(node => node.tagName === 'LABEL' && node.children[0]?.textContent === 'Geschoss')[0];
  const floor = floorField.querySelector('select'); floor.value = 'upper'; floor.fire('change');
  assert.deepEqual(container.querySelectorAll('[data-setup-device]').map(node => node.dataset.setupDevice), ['bed']);
  const roomField = container.all(node => node.tagName === 'LABEL' && node.children[0]?.textContent === 'Raum')[0];
  assert.equal(roomField.querySelector('select').options.some(option => option.value === 'office'), false);
  const deviceRow = container.querySelector('[data-setup-device]'); nodeByText(deviceRow, 'button', 'Bearbeiten').fire('click');
  assert.deepEqual(plain(edits), [['device', 'bed']]); assert.deepEqual(plain(f.state.config), before); assert.equal(f.calls.length, 0);
});

test('cancel invalidates old profile-editor callbacks so they cannot dirty the restored customer draft', () => {
  const f = environment(); const dev = suggestion().proposal; dev.id = 'existing'; dev.roomId = 'office'; dev.functionId = 'lighting'; f.state.config.devices.push(dev);
  const base = f.state.config; const before = plain(base); let callback;
  const actual = f.window.NW_SH_DEVICE_CONFIG;
  f.window.NW_SH_DEVICE_CONFIG = { ...actual, mount(...args) { callback = args[2].onChange; return actual.mount(...args); } };
  const session = editor(f, 'device', 'existing'); assert.equal(typeof callback, 'function'); session.cancel();
  callback({ profile: 'light', fields: [{ key: 'SET', writeId: 'native.0.late' }] });
  assert.equal(f.state.config, base); assert.deepEqual(plain(base), before); assert.equal(f.state.dirty, false);
});

test('pending Reload excludes new editors and a late response cannot replace a concurrently changed draft', async () => {
  const f = environment(); const gate = deferred(); const base = f.state.config; f.reply(() => gate.promise);
  const pending = f.context.nwReloadSmartHomeConfig(); await turn();
  assert.equal(f.state.reloading, true); assert.equal(f.context.nwOpenSetupEditor('room', 'office'), false);
  await f.context.nwReloadSmartHomeConfig(); assert.equal(f.calls.length, 1, 'single flight also excludes a second Reload');
  base.rooms[0].name = 'Neuere lokale Änderung'; f.context.nwMarkDirty(true);
  gate.resolve(new Response(JSON.stringify({ ok: true, config: { ...plain(base), rooms: [{ id: 'remote', name: 'Serverstand' }] } })));
  await pending;
  assert.equal(f.state.config, base); assert.equal(base.rooms[0].name, 'Neuere lokale Änderung'); assert.equal(f.state.dirty, true);
  assert.equal(f.state.reloading, false); assert.match(f.status(), /beibehalten/); assert.equal(f.window.NW_SH_SETUP.hasDialog(), false);
});

test('pending file read excludes editors and late imported JSON cannot replace a newer local draft', async () => {
  const f = environment(); const gate = deferred(); const base = f.state.config; let reads = 0; let confirmations = 0;
  f.window.confirm = () => { confirmations++; return true; };
  const file = { text() { reads++; return gate.promise; } };
  const pending = f.context.nwImportSmartHomeConfigFromFile(file); await turn();
  assert.equal(f.state.fileImporting, true); assert.equal(f.context.nwOpenSetupEditor('room', 'office'), false);
  await f.context.nwImportSmartHomeConfigFromFile(file); await f.context.nwReloadSmartHomeConfig();
  assert.equal(reads, 1); assert.equal(f.calls.length, 0);
  base.rooms[0].name = 'Aktueller Entwurf'; f.context.nwMarkDirty(true);
  gate.resolve(JSON.stringify({ rooms: [{ id: 'old', name: 'Importstand' }], devices: [] })); await pending;
  assert.equal(f.state.config, base); assert.equal(base.rooms[0].name, 'Aktueller Entwurf'); assert.equal(f.state.dirty, true);
  assert.equal(f.state.fileImporting, false); assert.equal(confirmations, 0); assert.match(f.status(), /nicht übernommen/);
});

test('active backup import excludes file import, Reload, Save and a new editor without reading or writing', async () => {
  const f = environment(); const before = plain(f.state.config); f.state.backupImporting = true; let fileReads = 0;
  await f.context.nwImportSmartHomeConfigFromFile({ text: async () => { fileReads++; return '{}'; } });
  await f.context.nwReloadSmartHomeConfig(); await f.context.nwSaveSmartHomeConfig();
  assert.equal(f.context.nwOpenSetupEditor('room', 'office'), false);
  assert.equal(fileReads, 0); assert.equal(f.calls.length, 0); assert.deepEqual(plain(f.state.config), before);
});

test('late detection results cannot replace suggestions after a customer draft change or while an editor is open', async () => {
  for (const scenario of ['changed-draft', 'open-editor']) {
    const f = environment(); const gate = deferred(); const previous = [suggestion('previous')]; f.state.detector.results = previous;
    f.reply(() => gate.promise); const pending = f.context.nwLoadTypeDetectorSuggestions(true); await turn();
    let session;
    if (scenario === 'changed-draft') { f.state.config.rooms[0].name = 'Neuer Raumname'; f.context.nwMarkDirty(true); }
    else session = editor(f, 'room', 'office');
    const current = f.state.config; const before = plain(current);
    gate.resolve(new Response(JSON.stringify({ ok: true, suggestions: [suggestion('stale-response')], stats: { total: 1 } }))); await pending;
    assert.equal(f.state.detector.results, previous, scenario); assert.equal(f.state.detector.loading, false);
    assert.equal(f.state.config, current); assert.deepEqual(plain(current), before);
    assert.match(f.detectStatus(), /geändert|erneut|nicht übernommen|verworfen/i);
    if (session) { assert.equal(session.tx.handle.isOpen(), true); session.cancel(); }
    assert.equal(f.calls.length, 1, 'no automatic scan retry');
  }
});

test('simple field changes keep the real form controls; explicit refresh retains body scroll and focus position', () => {
  const f = environment(); const session = editor(f, 'room', 'office'); const body = session.tx.handle.body;
  for (const id of ['home', 'builder', 'backup', 'detect', 'timers', 'scenes', 'classic']) { const node = f.document.createElement('div'); node.id = 'nw-shcfg-' + id; f.document.body.appendChild(node); }
  f.context.nwRenderAll = f.actualRenderAll;
  const name = body.all(node => node.tagName === 'INPUT' && node.value === 'Büro')[0];
  const next = body.querySelector('select'); next.focus(); body.scrollTop = 317;
  name.value = 'Büroname geändert'; name.fire('change');
  assert.equal(body.all(node => node.tagName === 'INPUT' && node.value === 'Büroname geändert')[0], name, 'typing must not replace the form');
  assert.equal(f.document.activeElement, next); assert.equal(next.isConnected, true); assert.equal(body.scrollTop, 317);
  const fields = body.querySelectorAll('input,select,textarea,button'); const focusIndex = fields.indexOf(next);
  session.tx.handle.refresh();
  assert.equal(session.tx.handle.body, body); assert.equal(body.scrollTop, 317);
  assert.equal(f.document.activeElement, body.querySelectorAll('input,select,textarea,button')[focusIndex]);
  assert.equal(f.document.activeElement.tagName, 'SELECT'); assert.equal(f.document.activeElement.isConnected, true);
  f.context.nwRenderAll = () => {}; session.cancel();
});

test('setup preserves long existing customer IDs and does not silently hide records after the detection limit', () => {
  const f = environment(); const longId = 'customer-' + 'x'.repeat(490);
  f.state.config.floors = Array.from({ length: 10001 }, (_, index) => ({ id: 'floor-' + index, name: 'Geschoss ' + index }));
  f.state.config.rooms = [{ id: longId, name: 'Kundenraum', floorId: 'floor-10000' }];
  f.state.config.devices = [{ id: longId + '-dev', alias: 'Kundengerät', type: 'device', roomId: longId, io: { switch: { readId: 'manual.existing' } } }];
  const before = plain(f.state.config); const edits = []; const container = f.document.createElement('div'); f.document.body.appendChild(container);
  f.window.NW_SH_SETUP.mountSetup(container, { config: f.state.config, preferences: { floorId: 'floor-10000', roomId: longId }, onEdit: (...args) => edits.push(args), onAdd() {}, onDetect() {} });
  assert.ok(container.querySelectorAll('option').some(option => option.value === 'floor-10000'));
  assert.ok(container.querySelectorAll('option').some(option => option.value === longId));
  const row = container.querySelector('[data-setup-device]'); assert.equal(row.dataset.setupDevice, longId + '-dev');
  nodeByText(row, 'button', 'Bearbeiten').fire('click'); assert.deepEqual(plain(edits), [['device', longId + '-dev']]);
  assert.deepEqual(plain(f.state.config), before); assert.equal(f.calls.length, 0);
});

test('large detection lists render at most 100 rows and retain selection across pages and filtering', () => {
  const f = environment(); const preferences = {}; const container = f.document.createElement('div'); f.document.body.appendChild(container); const imports = [];
  const rows = Array.from({ length: 10000 }, (_, index) => ({ id: 's' + index, displayName: 'Gerät ' + index, sourceId: 'native.' + index, detectorType: 'light', targetType: 'switch', importable: true }));
  f.window.NW_SH_SETUP.mountDetection(container, { suggestions: rows, rooms: f.state.config.rooms, preferences, canAlias: false, onDetails() {}, onImport: (...args) => imports.push(args) });
  assert.equal(container.querySelectorAll('[data-detect-id]').length, 100);
  const firstCheck = container.querySelector('[data-detect-id]').querySelector('input'); firstCheck.checked = true; firstCheck.fire('change');
  nodeByText(container, 'button', 'Weiter').fire('click'); assert.equal(container.querySelectorAll('[data-detect-id]').length, 100);
  const nextCheck = container.querySelector('[data-detect-id]').querySelector('input'); nextCheck.checked = true; nextCheck.fire('change');
  const search = container.all(node => node.tagName === 'INPUT' && node.attrs['aria-label'] === 'Erkannte Geräte suchen')[0]; search.value = 'Gerät 9999'; search.fire('input');
  assert.deepEqual(container.querySelectorAll('[data-detect-id]').map(node => node.dataset.detectId), ['s9999']);
  const target = container.querySelector('select'); target.value = 'office'; target.fire('change');
  nodeByText(container, 'button', 'Auswahl übernehmen').fire('click'); assert.deepEqual(plain(imports), [[['s0', 's100'], 'office']]);
  assert.equal(f.calls.length, 0);
});

test('focus trap includes closed-details summary but ignores hidden ancestors and returns focus after close', () => {
  const f = environment(); const trigger = f.document.createElement('button'); f.document.body.appendChild(trigger); trigger.focus();
  let summary; let hiddenInput; const handle = f.window.NW_SH_SETUP.openDialog({ title: 'Zusatzoptionen', render(body) {
    const hidden = f.document.createElement('div'); hidden.hidden = true; hiddenInput = f.document.createElement('input'); hidden.appendChild(hiddenInput); body.appendChild(hidden);
    const details = f.document.createElement('details'); summary = f.document.createElement('summary'); summary.textContent = 'Zusätzliche Datenpunkte';
    details.appendChild(summary); details.appendChild(f.document.createElement('input')); body.appendChild(details);
  } });
  nodeByText(f.document.body, 'button', 'Schließen').focus(); const event = f.document.fire('keydown', { key: 'Tab' });
  assert.equal(event.defaultPrevented, true); assert.equal(f.document.activeElement, summary); assert.notEqual(f.document.activeElement, hiddenInput);
  handle.close(); assert.equal(f.document.activeElement, trigger);
});

test('configuration HTML and scoped responsive CSS make setup and dialogs available without fixed right properties', () => {
  const html = fs.readFileSync(path.join(root, 'www/smarthome-config.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'www/smarthome-config-workspace.css'), 'utf8');
  assert.match(html, /id="nw-shcfg-setup-root"/); assert.ok(html.indexOf('smarthome-setup.js') < html.indexOf('/static/smarthome-config.js'));
  assert.match(css, /\.nw-setup-dialog\s*\{[^}]*width:\s*min\(1120px,\s*100%\)[^}]*max-width:\s*100%/s);
  assert.match(css, /\.nw-setup-dialog-body\s*\{[^}]*overflow-y:\s*auto[^}]*min-height:\s*0[^}]*min-width:\s*0/s);
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.nw-setup-dialog\s+\.nw-config-field-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  const setupZ = Number(css.match(/\.nw-setup-dialog-backdrop\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);
  const dpZ = Number(css.match(/\.nw-dp-dialog-backdrop\s*\{[^}]*z-index:\s*(\d+)\s*!important/s)?.[1]);
  assert.ok(dpZ > setupZ, 'existing datapoint picker must stay above the setup overlay');
  const parsed = require(require.resolve('postcss', { paths: [path.resolve(root, '../src-admin')] })).parse(css); parsed.walkRules(rule => { if (rule.selector.includes('.nw-setup-')) for (const selector of rule.selectors) assert.match(selector, /body\.nw-page-smarthome-config/, selector); });
});

test('action menus are mutually exclusive and retain the exact unsaved customer draft', () => {
  const f = environment(true); f.state.dirty = true; const before = plain(f.state.config);
  const project = f.document.querySelector('.nw-setup-project-actions'); const more = f.document.querySelector('.nw-shcfg-more');
  project.open = true; project.fire('toggle'); assert.equal(project.open, true); assert.equal(more.open, false);
  more.open = true; more.fire('toggle'); assert.equal(project.open, false); assert.equal(more.open, true);
  project.open = true; project.fire('toggle'); assert.equal(project.open, true); assert.equal(more.open, false);
  assert.deepEqual(plain(f.state.config), before); assert.equal(f.state.dirty, true); assert.equal(f.calls.length, 0);
});

test('project actions still run once and their nested click closes only the menu without cancelling the action', () => {
  const f = environment(true); const project = f.document.querySelector('.nw-setup-project-actions'); let called = 0;
  const button = nodeByText(project, 'button', 'Export'); const icon = f.document.createElement('span'); button.appendChild(icon);
  button.addEventListener('click', () => { called++; }); project.open = true;
  button.fire('click', { target: icon }); const event = f.document.fire('click', { target: icon });
  assert.equal(called, 1); assert.equal(project.open, false); assert.equal(event.defaultPrevented, false); assert.equal(f.calls.length, 0);
});

test('summary and menu body keep native operation while outside click or focus closes open actions', () => {
  const f = environment(true); const project = f.document.querySelector('.nw-setup-project-actions');
  project.open = true; const summary = project.querySelector('summary');
  const event = f.document.fire('click', { target: summary }); assert.equal(project.open, true); assert.equal(event.defaultPrevented, false);
  f.document.fire('click', { target: project.querySelector('div') }); assert.equal(project.open, true);
  f.document.fire('focusin', { target: project.querySelector('button') }); assert.equal(project.open, true);
  f.document.fire('click', { target: f.document.body }); assert.equal(project.open, false);
  project.open = true; f.document.fire('focusin', { target: f.document.getElementById('nw-config-save-btn') }); assert.equal(project.open, false);
});

test('Escape returns action-menu focus to its summary and does not consume Escape outside the menu', () => {
  const f = environment(true); const project = f.document.querySelector('.nw-setup-project-actions');
  project.open = true; project.querySelector('button').focus();
  const inside = f.document.fire('keydown', { key: 'Escape' }); assert.equal(project.open, false);
  assert.equal(inside.defaultPrevented, true); assert.equal(f.document.activeElement, project.querySelector('summary'));
  const outside = f.document.getElementById('nw-config-save-btn'); outside.focus(); project.open = true;
  const event = f.document.fire('keydown', { key: 'Escape' }); assert.equal(project.open, false);
  assert.equal(event.defaultPrevented, false); assert.equal(f.document.activeElement, outside);
});

test('repeated setup loading does not duplicate document/menu listeners or intercept dialog Escape', () => {
  const f = environment(true); const before = [...f.document.handlers].map(([key, handlers]) => [key, handlers.size]);
  f.load('smarthome-setup'); assert.deepEqual([...f.document.handlers].map(([key, handlers]) => [key, handlers.size]), before);
  const trigger = f.document.getElementById('nw-config-save-btn'); trigger.focus();
  const handle = f.window.NW_SH_SETUP.openDialog({ title: 'Unveränderte Dialogbedienung', render() {} });
  f.document.fire('keydown', { key: 'Escape' }); assert.equal(handle.isOpen(), false); assert.equal(f.document.activeElement, trigger);
  assert.equal(f.calls.length, 0);
});

test('action menu CSS removes the clipping ancestor and provides desktop layers plus in-flow mobile panels', () => {
  // Static CSS contracts reproduce the clipping cause; they do not measure browser geometry.
  const css = fs.readFileSync(path.join(root, 'www/smarthome-config-workspace.css'), 'utf8');
  const postcss = require(require.resolve('postcss', { paths: [path.resolve(root, '../src-admin')] }));
  const parsed = postcss.parse(css);
  function declarations(selector, media = '') {
    const result = {};
    parsed.walkRules(rule => {
      if (!rule.selectors.includes(selector)) return;
      const scope = rule.parent.type === 'atrule' ? rule.parent.params : '';
      if (scope !== media) return;
      rule.walkDecls(decl => { result[decl.prop] = { value: decl.value, important: decl.important || false }; });
    });
    return result;
  }
  const prefix = 'body.nw-page-smarthome-config ';
  const header = declarations(prefix + '.nw-smarthome-header'); const steps = declarations(prefix + '.nw-shcfg-steps');
  assert.deepEqual(header.overflow, { value: 'visible', important: true }); assert.equal(steps.overflow.value, 'visible');
  assert.ok(Number(header['z-index'].value) > Number(steps['z-index'].value)); assert.ok(Number(steps['z-index'].value) > 0);
  for (const selector of ['.nw-setup-project-actions > div', '.nw-shcfg-more > div']) {
    const desktop = declarations(prefix + selector); const mobile = declarations(prefix + selector, '(max-width: 600px)');
    assert.equal(desktop.position.value, 'absolute'); assert.equal(desktop['box-sizing'].value, 'border-box');
    assert.match(desktop['max-width'].value, /100vw/); assert.equal(desktop['overflow-y'].value, 'auto'); assert.match(desktop['max-height'].value, /dvh/);
    assert.equal(mobile.position.value, 'static'); assert.equal(mobile.width.value, '100%'); assert.equal(mobile['max-width'].value, '100%');
  }
});
