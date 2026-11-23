'use strict';
// Minimal-DOM-Verhaltenstest der kanonischen Browserquelle, kein visueller Browsertest.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const sourcePath = path.resolve(__dirname, '../../src-ts/runtime-executables/www/smarthome-activation.ts');
const source = ts.transpileModule(fs.readFileSync(sourcePath, 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None },
}).outputText;

async function settle(predicate) {
  for (let i = 0; i < 100; i++) {
    if (predicate()) return;
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.fail('SmartHome activation operation did not settle');
}

async function fixture(initial = false, initialResponseStatus = 200) {
  class Element {
    constructor() { this.dataset = {}; this.textContent = ''; this.events = {}; this.disabled = true; }
    addEventListener(event, handler) { this.events[event] = handler; }
  }
  class Input extends Element { constructor() { super(); this.checked = false; } }
  class Button extends Element {}
  const nodes = {
    'nw-smarthome-enabled': new Input(),
    'nw-smarthome-activation-save': new Button(),
    'nw-smarthome-activation-reload': new Button(),
    'nw-smarthome-activation-status': new Element(),
  };
  const requests = [];
  const editedBuilding = { floors: [{ id: 'EG', name: 'Unsaved ground floor' }] };
  let stored = initial;
  let nextStatus = initialResponseStatus;
  let malformed = false;
  const context = {
    document: {
      readyState: 'complete',
      getElementById: id => nodes[id] || assert.fail(`Unexpected editor access: ${id}`),
    },
    HTMLElement: Element, HTMLInputElement: Input, HTMLButtonElement: Button,
    Error, AbortSignal, JSON,
    nwShcState: { config: editedBuilding, dirty: true },
    fetch: async (url, options) => {
      assert.equal(url, '/api/smarthome/activation');
      assert.equal(options.cache, 'no-store');
      assert.ok(options.signal instanceof AbortSignal);
      const method = options.method || 'GET';
      requests.push({ method, body: options.body });
      const status = nextStatus;
      if (method === 'POST' && status === 200) {
        const body = JSON.parse(options.body);
        assert.deepEqual(Object.keys(body), ['enabled']);
        assert.equal(typeof body.enabled, 'boolean');
        stored = body.enabled;
      }
      return { ok: status === 200, status, json: async () => malformed ? { ok: true, enabled: 'true' } : { ok: true, enabled: stored } };
    },
  };
  vm.runInNewContext(source, context, { filename: 'smarthome-activation.js' });
  const input = nodes['nw-smarthome-enabled'];
  const save = nodes['nw-smarthome-activation-save'];
  const reload = nodes['nw-smarthome-activation-reload'];
  const status = nodes['nw-smarthome-activation-status'];
  await settle(() => !reload.disabled);
  return {
    input, save, reload, status, requests, editedBuilding,
    stored: () => stored,
    fail: statusCode => { nextStatus = statusCode; },
    malformed: value => { malformed = value; },
    toggle(value) { input.checked = value; input.events.change(); },
    async clickSave() { save.events.click(); await settle(() => !reload.disabled); },
    async clickReload() { reload.events.click(); await settle(() => !reload.disabled); },
  };
}

test('loads explicit disabled setting and saves activation without touching building drafts', async () => {
  const f = await fixture(false);
  assert.equal(f.input.checked, false);
  assert.equal(f.save.disabled, true);
  const draft = structuredClone(f.editedBuilding);
  f.toggle(true);
  assert.equal(f.save.disabled, false);
  assert.equal(f.stored(), false, 'changing a checkbox must not implicitly persist');
  await f.clickSave();
  assert.equal(f.stored(), true);
  assert.equal(f.save.disabled, true);
  assert.equal(f.status.dataset.error, 'false');
  assert.deepEqual(f.editedBuilding, draft);
  assert.equal(f.requests.filter(row => row.method === 'POST').length, 1);
});

test('loads retained legacy enabled setting and can explicitly hide it', async () => {
  const f = await fixture(true);
  assert.equal(f.input.checked, true);
  f.toggle(false);
  await f.clickSave();
  assert.equal(f.stored(), false);
  assert.match(f.status.textContent, /Konfiguration bleibt erhalten/);
});

test('expired session does not replay a write or discard the selected setting', async () => {
  const f = await fixture(false);
  f.toggle(true);
  f.fail(401);
  await f.clickSave();
  assert.equal(f.stored(), false);
  assert.equal(f.input.checked, true);
  assert.equal(f.save.disabled, false);
  assert.equal(f.status.dataset.error, 'true');
  assert.match(f.status.textContent, /erneut bei EOS anmelden/);
  assert.equal(f.requests.filter(row => row.method === 'POST').length, 1);
});

test('unknown initial status keeps editing disabled until an explicit successful reload', async () => {
  const f = await fixture(false, 503);
  assert.equal(f.input.disabled, true);
  assert.equal(f.save.disabled, true);
  assert.equal(f.reload.disabled, false);
  assert.equal(f.requests.length, 1);
  f.fail(200);
  await f.clickReload();
  assert.equal(f.input.disabled, false);
  assert.equal(f.input.checked, false);
  assert.equal(f.requests.filter(row => row.method === 'POST').length, 0);
});

test('malformed success response is never shown as a confirmed save', async () => {
  const f = await fixture(false);
  f.toggle(true);
  f.malformed(true);
  await f.clickSave();
  assert.equal(f.status.dataset.error, 'true');
  assert.match(f.status.textContent, /nicht bestätigt/);
  assert.equal(f.requests.filter(row => row.method === 'POST').length, 1);
});

test('forbidden and conflicting saves preserve draft and require an explicit retry', async () => {
  for (const statusCode of [403, 409]) {
    const f = await fixture(false);
    f.toggle(true);
    f.fail(statusCode);
    await f.clickSave();
    assert.equal(f.stored(), false);
    assert.equal(f.input.checked, true);
    assert.equal(f.status.dataset.error, 'true');
    assert.equal(f.requests.filter(row => row.method === 'POST').length, 1);
  }
});
