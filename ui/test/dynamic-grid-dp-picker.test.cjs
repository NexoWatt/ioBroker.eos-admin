/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
'use strict';
/** Tatsächliche Pickerfunktionen/Bridge aus TS-Quellen; Transport und DOM isoliert.
 * Prüft Requestbindung und asynchrone Grenzen. Browser-/HTTP-Nachweis separat. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const tick = () => new Promise(resolve => setImmediate(resolve));
function element() {
  const e = { children: [], value: '', textContent: '', listeners: {}, attrs: {}, classList: { add() {}, remove() {} },
    appendChild(child) { this.children.push(child); }, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(name, fn) { this.listeners[name] = fn; }, dispatchEvent(event) { this.listeners[event.type]?.(event); },
    click() { this.listeners.click?.({ preventDefault() {}, stopPropagation() {} }); } };
  Object.defineProperty(e, 'innerHTML', { set() { this.children = []; } });
  return e;
}
function hostFixture(relative) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const ast = ts.createSourceFile(relative, source, ts.ScriptTarget.Latest, true);
  const functions = ['openDpModal', 'closeDpModal', 'setDpTargetValue', 'mkDpResultRow', 'refreshTree', 'doSearch', 'upOne', 'acceptDataPointPickerMessage', 'beginAppCenterMutation'];
  const variables = ['dpTargetInputId', 'treePrefix', 'dpModalGeneration', 'dpTreeRequest', 'dpSearchRequest', 'dpModalOpen', 'dpModalCallback', 'dpBridgeRequest', 'dpPickerAccessReady', 'dpSelectableIds', 'dpPopupRequestId', 'validDpSelectionId', 'appCenterMutationBusy'];
  const snippets = new Map();
  function walk(node) {
    if (ts.isFunctionDeclaration(node) && functions.includes(node.name?.text)) snippets.set(node.name.text, node.getText(ast));
    if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) if (variables.includes(declaration.name.getText(ast))) snippets.set(declaration.name.getText(ast), node.getText(ast));
    ts.forEachChild(node, walk);
  }
  walk(ast);
  assert.equal(snippets.size, functions.length + variables.length);
  const sent = [], queries = [], input = element(), main = element(), title = element();
  const peer = { postMessage(data, origin) { sent.push({ data, origin }); } };
  let frame = { contentWindow: peer };
  const els = Object.fromEntries(['dpModal', 'dpSearch', 'dpResults', 'dpTree', 'dpBreadcrumb', 'dpRootBtn', 'dpUpBtn'].map(key => [key, element()]));
  els.dpModal.querySelector = () => title;
  els.dynamicGridMount = { querySelector: () => frame };
  const context = vm.createContext({ els, Event: class { constructor(type) { this.type = type; } }, URLSearchParams, Set,
    window: { location: { origin: 'http://eos.test', search: '' }, opener: null },
    document: { createElement: element, getElementById: () => input, querySelector: () => main }, renderBreadcrumb() {},
    fetchJson(url) { return new Promise((resolve, reject) => queries.push({ url, resolve, reject })); },
  });
  vm.runInContext([...variables, ...functions].map(name => snippets.get(name)).join('\n')
    + '\nglobalThis.subject={openDpModal,closeDpModal,setDpTargetValue,doSearch,acceptDataPointPickerMessage,beginAppCenterMutation,grant:()=>{dpPickerAccessReady=true;},snapshot:()=>({open:dpModalOpen,generation:dpModalGeneration})};', context);
  return { ...context.subject, els, input, title, peer, sent, queries,
    event(requestId, more = {}) { return { origin: 'http://eos.test', source: peer, data: { type: 'nw:dp-picker-open', requestId, currentId: '', mode: 'read' }, ...more }; },
    removeFrame() { frame = null; },
  };
}
for (const source of ['src-ts/runtime-executables/www/ems-apps.ts', 'src-ts/runtime-mirrors/www/ems-apps.ts']) {
  test(`${source}: gebundene Stateauswahl und unveränderter manueller AppCenter-Pfad`, async () => {
    const h = hostFixture(source);
    h.acceptDataPointPickerMessage(h.event('request_001'));
    assert.equal(h.queries.length, 0, 'Vor Rollenfreigabe keine Discovery.');
    h.grant();
    h.acceptDataPointPickerMessage(h.event('request_001', { origin: 'https://foreign.test' }));
    h.acceptDataPointPickerMessage(h.event('request_001', { source: {} }));
    h.acceptDataPointPickerMessage(h.event('bad'));
    assert.equal(h.queries.length, 0);
    h.acceptDataPointPickerMessage(h.event('request_001'));
    h.queries[0].resolve({ children: [{ id: 'device', hasChildren: true }, { id: 'device.actual', isState: true, unit: 'W' }] });
    await tick();
    h.setDpTargetValue('device'); h.setDpTargetValue('injected.not-listed');
    assert.equal(h.sent.filter(m => m.data.type === 'nw:dp-picker-result').length, 0, 'Ordner und ungeprüfte IDs werden nicht übernommen.');
    h.els.dpTree.children[1].click();
    assert.equal(h.sent.at(-1).data.id, 'device.actual');
    assert.equal(h.sent.at(-1).data.requestId, 'request_001');
    assert.equal(h.input.value, '', 'React-Auswahl verändert keinen fremden Parentinput.');
    let changes = 0; h.input.addEventListener('change', () => changes++);
    h.openDpModal('legacy-input');
    h.queries.at(-1).resolve({ children: [{ id: 'old.mapping', isState: true }] }); await tick();
    h.els.dpTree.children[0].click();
    assert.equal(h.input.value, 'old.mapping'); assert.equal(changes, 1);
  });
  test(`${source}: alte Tree-/Searchantworten, Rowcallbacks, Cancel und Mutationssperre`, async () => {
    const h = hostFixture(source); h.grant();
    h.acceptDataPointPickerMessage(h.event('request_old'));
    const oldTree = h.queries[0];
    h.acceptDataPointPickerMessage(h.event('request_new'));
    h.queries[1].resolve({ children: [{ id: 'new.state', isState: true }] }); await tick();
    oldTree.resolve({ children: [{ id: 'old.state', isState: true }] }); await tick();
    assert.equal(h.els.dpTree.children[0].children[0].textContent, 'new.state');
    const oldRow = h.els.dpTree.children[0];
    h.els.dpSearch.value = 'first'; const first = h.doSearch(); const oldSearch = h.queries.at(-1);
    h.els.dpSearch.value = 'second'; const second = h.doSearch();
    h.queries.at(-1).resolve({ results: [{ id: 'second.state' }] }); await second;
    oldSearch.resolve({ results: [{ id: 'first.state' }] }); await first;
    assert.equal(h.els.dpResults.children[0].children[0].textContent, 'second.state');
    h.acceptDataPointPickerMessage(h.event('request_last'));
    h.queries.at(-1).resolve({ children: [{ id: 'new.state', isState: true }] }); await tick();
    oldRow.click();
    assert.equal(h.snapshot().open, true, 'Gleiche ID in neuem Dialog legitimiert keinen alten Rowcallback.');
    h.acceptDataPointPickerMessage(h.event('request_wrong', { data: { type: 'nw:dp-picker-cancel', requestId: 'request_wrong' } }));
    assert.equal(h.snapshot().open, true);
    const release = h.beginAppCenterMutation();
    assert.equal(h.snapshot().open, false);
    assert.equal(h.sent.at(-1).data.id, null);
    h.acceptDataPointPickerMessage(h.event('request_busy'));
    assert.equal(h.sent.at(-1).data.id, null); assert.equal(h.snapshot().open, false);
    release();
    h.acceptDataPointPickerMessage(h.event('request_final'));
    const pending = h.queries.at(-1);
    h.acceptDataPointPickerMessage(h.event('request_final', { data: { type: 'nw:dp-picker-cancel', requestId: 'request_final' } }));
    pending.resolve({ children: [{ id: 'late.state', isState: true }] }); await tick();
    assert.equal(h.snapshot().open, false);
    h.setDpTargetValue('late.state'); assert.equal(h.sent.at(-1).data.id, null);
  });
}
function clientFixture(embedded = true) {
  const source = fs.readFileSync(path.join(root, 'src-admin-tab/src/lib/dataPointPicker.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const handlers = new Map(), timers = new Map(), intervals = new Map(), messages = [];
  let next = 0;
  const peer = { closed: false, postMessage(data, origin) { messages.push({ data, origin }); }, close() { this.closed = true; } };
  const win = { location: { origin: 'http://eos.test', search: embedded ? '?embedded=1' : '' }, parent: null,
    addEventListener(type, fn) { handlers.set(type, fn); }, removeEventListener(type, fn) { if (handlers.get(type) === fn) handlers.delete(type); },
    open() { return peer; } };
  win.parent = embedded ? peer : win;
  const mod = { exports: {} };
  // Die echten Vertragsprüfer laufen im selben Realm wie die synthetischen
  // MessageEvent-Daten. Im Browser erzeugt structured clone genau diesen Bezug.
  const contractsFile = path.join(root, 'src-admin-tab/src/lib/adminContracts.ts');
  const contractsCode = ts.transpileModule(fs.readFileSync(contractsFile, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const contracts = { exports: {} };
  vm.runInThisContext('(function (module, exports) {\n' + contractsCode + '\n})', { filename: contractsFile })(contracts, contracts.exports);
  vm.runInNewContext(compiled, { exports: mod.exports, module: mod, require(id) { if (id === './adminConnection') return { getRuntimeProxyBase: () => null }; assert.equal(id, './adminContracts'); return contracts.exports; }, window: win, crypto: crypto.webcrypto, URL, URLSearchParams, Uint8Array, DOMException,
    setTimeout(fn) { timers.set(++next, fn); return next; }, clearTimeout(id) { timers.delete(id); }, setInterval(fn) { intervals.set(++next, fn); return next; }, clearInterval(id) { intervals.delete(id); } });
  return { choose: mod.exports.chooseDataPoint, messages, peer, handlers, timers, intervals,
    event(data, overrides = {}) { handlers.get('message')?.({ origin: 'http://eos.test', source: peer, data, ...overrides }); } };
}
test('React-Picker verwirft fremde Origin/Source/Request und spätes Ergebnis nach Abort', async () => {
  const h = clientFixture(); const abort = new AbortController();
  const promise = h.choose({ currentId: 'original.state', mode: 'write', signal: abort.signal });
  const requestId = h.messages[0].data.requestId;
  h.event({ type: 'nw:dp-picker-result', requestId, id: 'wrong.state' }, { origin: 'https://other.test' });
  h.event({ type: 'nw:dp-picker-result', requestId, id: 'wrong.state' }, { source: {} });
  h.event({ type: 'nw:dp-picker-result', requestId: 'other_request', id: 'wrong.state' });
  assert.equal(h.handlers.has('message'), true);
  abort.abort(); await assert.rejects(promise, { name: 'AbortError' });
  assert.equal(h.handlers.size, 0); assert.equal(h.timers.size, 0);
  h.event({ type: 'nw:dp-picker-result', requestId, id: 'late.state' });
  assert.equal(h.messages.at(-1).data.type, 'nw:dp-picker-cancel');
});
test('React-Picker übernimmt gültiges Ergebnis, Popup-Schließen und Timeout räumen auf', async () => {
  const h = clientFixture(); const chosen = h.choose(); const id = h.messages[0].data.requestId;
  h.event({ type: 'nw:dp-picker-opened', requestId: id });
  h.event({ type: 'nw:dp-picker-result', requestId: id, id: 'valid.state' });
  assert.equal(await chosen, 'valid.state'); assert.equal(h.handlers.size, 0); assert.equal(h.timers.size, 0);
  const p = clientFixture(false); const popup = p.choose(); p.peer.closed = true; [...p.intervals.values()][0]();
  assert.equal(await popup, null); assert.equal(p.intervals.size, 0); assert.equal(p.handlers.size, 0);
  const t = clientFixture(); const timeout = t.choose(); [...t.timers.values()][0]();
  await assert.rejects(timeout, /nicht erreichbar/); assert.equal(t.handlers.size, 0); assert.equal(t.timers.size, 0);
});
