/** Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
const source = ts.transpileModule(fs.readFileSync(path.join(root, 'src-ts/runtime-executables/www/smarthome-layout-editor.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const plain = value => JSON.parse(JSON.stringify(value));
function fixture() {
  class Element {
    constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attrs = {}; this.handlers = new Map(); this.className = ''; this.textContent = ''; this.value = ''; this.disabled = false; }
    appendChild(child) { this.children.push(child); child.parentElement = this; if (this.tagName === 'SELECT' && this.children.length === 1) this.value = child.value; return child; }
    replaceChildren(...children) { this.children = []; children.forEach(child => this.appendChild(child)); }
    setAttribute(key, value) { this.attrs[key] = String(value); }
    get options() { return this.children.filter(child => child.tagName === 'OPTION'); }
    addEventListener(name, callback) { this.handlers.set(name, callback); }
    fire(name, values = {}) { const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...values }; this.handlers.get(name)?.(event); return event; }
    all(predicate) { return this.children.flatMap(child => [...(predicate(child) ? [child] : []), ...child.all(predicate)]); }
    querySelectorAll(selector) { return this.all(node => selector === 'button[data-layout-select]' ? node.tagName === 'BUTTON' && node.dataset.layoutSelect !== undefined : selector === '[data-drop-target]' ? node.dataset.dropTarget !== undefined : false); }
    focus() { this.focused = true; }
  }
  const window = {}; const document = { createElement: tag => new Element(tag) };
  vm.runInNewContext(source, { window, document }); // No fetch, sockets or device-write globals are available.
  const api = window.NW_SH_LAYOUT_EDITOR;
  const changes = []; const edits = [];
  function mount(devices, options = {}) { const container = new Element('div'); api.mount(container, { devices, rooms: [{ id: 'living', name: 'Wohnen' }, { id: 'kitchen', name: 'Küche' }], onChange: patches => { changes.push(plain(patches)); }, onEdit: id => edits.push(id), ...options }); return container; }
  const find = (container, cls) => container.all(node => node.className.split(' ').includes(cls))[0];
  const card = (container, id) => container.all(node => node.dataset.layoutId === id)[0];
  const button = (container, text) => container.all(node => node.tagName === 'BUTTON' && node.textContent === text)[0];
  const ids = container => container.all(node => node.dataset.layoutId).map(node => node.dataset.layoutId);
  return { api, mount, changes, edits, find, card, button, ids };
}
const input = () => [
  { id: 'a', alias: 'Deckenlicht', type: 'dimmer', roomId: 'living', order: 1, io: { deviceControls: { profile: 'dimmer', fields: [{ key: 'SET', writeId: 'alias.0.light.set' }] } }, behavior: { readOnly: false } },
  { id: 'k', alias: 'Küche', type: 'switch', roomId: 'kitchen', order: 2 },
  { id: 'b', alias: 'Rollladen', type: 'blind', roomId: 'living', order: 3 },
  { id: 'c', alias: 'Temperatur', type: 'sensor', roomId: 'living', order: 5 },
];

test('move and swap return order patches only, preserving room slots and original mappings', () => {
  const f = fixture(); const devices = input(); const before = plain(devices);
  assert.deepEqual(plain(f.api.reorder(devices, 'a', 'c', 'after')), [{ id: 'b', order: 1 }, { id: 'c', order: 3 }, { id: 'a', order: 5 }]);
  assert.deepEqual(plain(f.api.reorder(devices, 'c', 'a', 'before')), [{ id: 'c', order: 1 }, { id: 'a', order: 3 }, { id: 'b', order: 5 }]);
  assert.deepEqual(plain(f.api.reorder(devices, 'a', 'c', 'swap')), [{ id: 'c', order: 1 }, { id: 'b', order: 3 }, { id: 'a', order: 5 }]);
  assert.deepEqual(devices, before);
  assert.deepEqual(plain(f.api.reorder(devices, 'a', 'b', 'before')), []);
  assert.deepEqual(plain(f.api.reorder(devices, 'a', 'a', 'swap')), []);
});

test('invalid IDs, duplicate IDs and room boundaries fail before any ordering change', () => {
  const f = fixture(); const devices = input();
  assert.throws(() => f.api.reorder(devices, 'a', 'k', 'swap'), /desselben Raums/);
  assert.throws(() => f.api.reorder(devices, 'missing', 'a', 'swap'), /nicht mehr vorhanden/);
  assert.throws(() => f.api.reorder([...devices, devices[0]], 'a', 'c', 'swap'), /doppelt/);
  assert.throws(() => f.api.reorder(devices, 'a', 'c', '__proto__'), /Ungültige/);
  assert.throws(() => f.api.reorder([{ id: 'a', floorId: 'ground' }, { id: 'b', floorId: 'upper' }], 'a', 'b', 'swap'), /desselben Raums/);
  assert.deepEqual(plain(f.api.reorder([{ id: 'a' }, { id: 'b' }, { id: 'c' }], 'a', 'c', 'after')), [{ id: 'b', order: 1 }, { id: 'c', order: 2 }, { id: 'a', order: 3 }]);
});

test('keyboard and visible buttons operate within the complete room order while filters remain active', () => {
  const f = fixture(); const preferences = {}; const container = f.mount(input(), { preferences });
  f.button(f.card(container, 'b'), 'Rollladen').fire('keydown', { altKey: true, key: 'ArrowUp' });
  assert.deepEqual(f.changes.at(-1), [{ id: 'b', order: 1 }, { id: 'a', order: 3 }, { id: 'c', order: 5 }]);
  assert.equal(f.button(f.card(container, 'b'), 'Rollladen').focused, true);
  const search = f.find(container, 'nw-layout-editor__search'); search.value = 'Rollladen'; search.fire('input');
  assert.deepEqual(f.ids(container), ['b']);
  f.button(f.card(container, 'b'), 'Zurück').fire('click');
  assert.deepEqual(f.changes.at(-1), [{ id: 'a', order: 1 }, { id: 'b', order: 3 }, { id: 'c', order: 5 }]);
  assert.equal(preferences.query, 'Rollladen');
  assert.equal(f.find(container, 'nw-layout-editor__status').attrs['aria-live'], 'polite');
});

test('ordinary tile activation restores focus to the rebuilt layout button without changing order', () => {
  const f = fixture(); const container = f.mount(input());
  const oldButton = f.button(f.card(container, 'b'), 'Rollladen');
  oldButton.fire('click'); // Native button click also represents Enter/Space activation.
  const rebuilt = f.button(f.card(container, 'b'), 'Rollladen');
  assert.notEqual(rebuilt, oldButton); assert.equal(rebuilt.focused, true);
  assert.equal(f.card(container, 'b').dataset.selected, 'true'); assert.equal(f.changes.length, 0);
  rebuilt.fire('keydown', { altKey: true, key: 'ArrowUp' });
  assert.equal(f.changes.length, 1, 'keyboard interaction continues after selection');
});

test('target selector swaps explicit positions, rejected transactions preserve the visible order', () => {
  const f = fixture(); const container = f.mount(input(), { preferences: { selectedId: 'a' } });
  const target = container.all(node => node.attrs['aria-label'] === 'Zielkachel für die Positionsänderung')[0]; target.value = 'c';
  f.button(container, 'Positionen tauschen').fire('click');
  assert.deepEqual(f.changes.at(-1), [{ id: 'c', order: 1 }, { id: 'b', order: 3 }, { id: 'a', order: 5 }]);
  const blocked = f.mount(input(), { onChange: () => false }); const before = f.ids(blocked);
  f.button(f.card(blocked, 'a'), 'Zurück').fire('click');
  assert.deepEqual(f.ids(blocked), before);
  assert.match(f.find(blocked, 'nw-layout-editor__status').textContent, /zwischenzeitlich geändert/);
});

test('drag/drop uses only this editor internal selection and cannot move across rooms', () => {
  const f = fixture(); const container = f.mount(input());
  f.card(container, 'a').fire('drop', { dataTransfer: { getData: () => 'c' } });
  assert.equal(f.changes.length, 0, 'external drag payload must never become a device selection');
  const handle = f.button(f.card(container, 'c'), 'Ziehen'); const dataTransfer = { setData() {} };
  handle.fire('dragstart', { dataTransfer });
  assert.equal(f.card(container, 'a').fire('dragover').defaultPrevented, true);
  f.card(container, 'a').fire('drop');
  assert.deepEqual(f.changes.at(-1), [{ id: 'c', order: 1 }, { id: 'a', order: 3 }, { id: 'b', order: 5 }]);
  f.button(f.card(container, 'a'), 'Ziehen').fire('dragstart', { dataTransfer });
  assert.equal(f.card(container, 'k').fire('dragover').defaultPrevented, undefined);
  f.card(container, 'k').fire('drop');
  assert.equal(f.changes.length, 1);
});

test('device workspace search/filter and malicious stored type names stay text-only', () => {
  const f = fixture(); const container = f.mount([...input(), { id: 'odd', roomId: 'living', type: 'constructor', customView: { kind: '__proto__' }, alias: '<img src=x onerror=alert(1)>' }], { mode: 'devices' });
  assert.equal(f.button(container, 'Ziehen'), undefined);
  const filter = f.find(container, 'nw-layout-editor__room-filter'); filter.value = 'room:living'; filter.fire('change');
  assert.equal(f.ids(container).includes('k'), false);
  const search = f.find(container, 'nw-layout-editor__search'); search.value = 'constructor'; search.fire('input');
  assert.deepEqual(f.ids(container), ['odd']);
  assert.equal(f.button(f.card(container, 'odd'), '<img src=x onerror=alert(1)>').textContent, '<img src=x onerror=alert(1)>');
  f.button(f.card(container, 'odd'), 'Bearbeiten').fire('click');
  assert.deepEqual(f.edits, ['odd']); assert.equal(f.changes.length, 0);
});

function legacy(names, context = {}) {
  const input = fs.readFileSync(path.join(root, 'src-ts/runtime-executables/www/smarthome-config.ts'), 'utf8');
  const file = ts.createSourceFile('config.ts', input, ts.ScriptTarget.Latest, true);
  assert.equal(file.parseDiagnostics.length, 0, 'canonical legacy source must parse');
  const functions = file.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text)).map(node => node.getText(file)).join('\n');
  vm.createContext(context); vm.runInContext(functions, context); return context;
}

test('saved device.order survives normalization and JSON reload; classic numeric moves use final positions', () => {
  const devices = input(); devices[0].order = 5; devices[2].order = 3; devices[3].order = 1;
  const c = legacy(['nwNormalizeDeviceOrder', 'nwMoveItemTo'], { nwShcState: { config: { devices } } });
  c.nwNormalizeDeviceOrder(); assert.deepEqual(devices.map(device => device.id), ['c', 'k', 'b', 'a']);
  c.nwShcState.config = plain(c.nwShcState.config); c.nwNormalizeDeviceOrder();
  assert.deepEqual(c.nwShcState.config.devices.map(device => device.id), ['c', 'k', 'b', 'a']);
  c.nwMoveItemTo(c.nwShcState.config.devices, 0, 3); c.nwNormalizeDeviceOrder();
  assert.deepEqual(c.nwShcState.config.devices.map(device => device.id), ['k', 'b', 'a', 'c']);
  c.nwShcState.config.devices.push({ id: 'new' }); c.nwNormalizeDeviceOrder();
  assert.equal(c.nwShcState.config.devices.at(-1).id, 'new');
});

test('real config transaction applies only order and rejects stale room/config changes atomically', () => {
  const devices = input(); const originals = plain(devices); let mounted; let dirty = 0;
  const c = legacy(['nwRenderShcfgLayoutWorkspace'], {
    document: { getElementById: () => ({}) }, window: { NW_SH_LAYOUT_EDITOR: { mount: (_container, options) => { mounted = options; } } },
    nwShcState: { config: { devices }, ui: {} }, nwMarkDirty: () => { dirty++; }, nwSetStatus() {},
  });
  c.nwRenderShcfgLayoutWorkspace();
  assert.equal(mounted.onChange([{ id: 'a', order: 5 }, { id: 'b', order: 1 }, { id: 'c', order: 3 }]), true);
  assert.equal(dirty, 1); assert.deepEqual(devices[0].io, originals[0].io); assert.deepEqual(devices[0].behavior, originals[0].behavior);
  assert.equal(devices[1].order, 2); assert.equal(devices[0].roomId, 'living');
  devices[2].roomId = 'kitchen'; const before = plain(devices);
  assert.equal(mounted.onChange([{ id: 'a', order: 1 }, { id: 'b', order: 5 }]), false);
  assert.deepEqual(devices, before, 'no partial ordering patch when later entry is stale');
  c.nwShcState.config = plain(c.nwShcState.config);
  assert.equal(mounted.onChange([{ id: 'a', order: 2 }]), false);
});

test('technical icon names use SVG fallbacks and cannot expose prototype members as markup', () => {
  const c = legacy(['nwShcNormalizeIconName', 'nwShcRenderIconPreview'], { nwShcParseDynamicIcon: () => null, NW_SH_ICON_PREVIEW_SVGS: { ground: '<svg data-test="ground"></svg>', generic: '<svg data-test="generic"></svg>' } });
  const element = { style: {}, textContent: '', innerHTML: '' };
  c.nwShcRenderIconPreview(element, '3d-ground'); assert.match(element.innerHTML, /data-test="ground"/); assert.equal(element.textContent, '');
  c.nwShcRenderIconPreview(element, 'constructor'); assert.match(element.innerHTML, /data-test="generic"/);
  c.nwShcRenderIconPreview(element, '__proto__'); assert.match(element.innerHTML, /data-test="generic"/);
});

test('configuration HTML and scoped CSS retain all module hooks and full-width responsive floor layout', () => {
  const html = fs.readFileSync(path.join(root, 'www/smarthome-config.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'www/smarthome-config-workspace.css'), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]); assert.equal(new Set(ids).size, ids.length, 'DOM IDs remain unique');
  for (const id of ['nw-shcfg-step-building', 'nw-shcfg-step-detect', 'nw-shcfg-step-layout', 'nw-shcfg-step-builder', 'nw-shcfg-setup-root', 'nw-shcfg-device-browser', 'nw-shcfg-device-properties', 'nw-shcfg-layout-editor', 'nw-shcfg-classic']) assert.ok(ids.includes(id), id);
  for (const file of ['smarthome-alias-config', 'smarthome-custom-config', 'smarthome-device-config', 'smarthome-layout-editor', 'smarthome-setup']) assert.match(html, new RegExp(file + '\\.js'));
  assert.match(html, /nw-shcfg-step-builder[^>]+>Expertenansicht/);
  assert.ok(html.indexOf('smarthome-setup.js') < html.indexOf('/static/smarthome-config.js'));
  assert.ok(html.indexOf('smarthome-layout-editor.js') < html.indexOf('/static/smarthome-config.js'));
  assert.match(css, /nw-page-smarthome-config > main[^}]+max-width: none !important/s);
  assert.match(css, /grid-template-columns: 250px minmax\(0, 1fr\) 320px !important/);
  assert.match(css, /\.nw-shcfg-grid--floors[^}]+grid-template-columns: minmax\(0, 1fr\) !important/s);
  assert.match(css, /@media \(max-width: 1100px\)[^{]*\{[^}]+grid-template-columns: minmax\(0, 1fr\) !important/s);
  assert.match(css, /\.nw-shcfg-advanced \.nw-config-field-row[^}]+display: grid[^}]+grid-template-columns: minmax\(0, 1fr\)/s);
  assert.match(css, /\.nw-shcfg-advanced \.nw-config-field-label[^}]+max-width: 100%/s);
  assert.match(css, /:focus-visible/); assert.match(css, /min-height: 44px/);
  const postcss = require(require.resolve('postcss', { paths: [path.resolve(root, '../src-admin')] })); const parsed = postcss.parse(css);
  parsed.walkRules(rule => { for (const selector of rule.selectors) assert.match(selector, /body\.(?:nw-cockpit-page\.)?nw-page-smarthome-config/, selector); });
});
