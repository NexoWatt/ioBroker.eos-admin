/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft öffentliche Fehlermeldungen und Textausgabe im Simulation-Frontend.
 * Daten und Wirkung: Führt die vollständige lokale Browserquelle mit einem kleinen
 * DOM-/Fetch-Doppel aus; keine Netzwerkzugriffe und keine Produktzustandsänderung.
 * Grenze: Gezielter Vertrags-/Regressionstest, kein vollständiger Browsertest.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../src-ts/runtime-executables/www/simulation.ts'), 'utf8');
class Element {
  constructor() {
    this.children = [];
    this.listeners = new Map();
    this.htmlWrites = [];
    this.value = '';
    this.text = '';
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text + this.children.map((child) => child.textContent).join(''); }
  set innerHTML(value) { this.htmlWrites.push(String(value)); this.text = ''; this.children = []; }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
}

async function browser(initialFailure) {
  const ids = ['status', 'statusline', 'instance', 'refresh', 'enable', 'disable',
    'scen-status', 'scen-select', 'scen-desc', 'scen-refresh', 'scen-start', 'scen-stop', 'scen-reset'];
  const elements = new Map(ids.map((id) => [`nw-sim-${id}`, new Element()]));
  let failure = initialFailure;
  const context = {
    document: {
      getElementById: (id) => elements.get(id) || null,
      createElement: () => new Element(),
    },
    setInterval: () => 0,
    setTimeout: (callback) => { callback(); return 0; },
    fetch: async (url) => {
      if (failure && url.startsWith(failure.route)) {
        if (failure.networkError) throw new Error(failure.networkError);
        return { ok: false, status: failure.status || 409,
          text: async () => failure.raw === undefined ? JSON.stringify(failure.body) : failure.raw };
      }
      const body = url === '/api/sim/discover'
        ? { instances: [{ instanceId: 'sim.0', enabled: true }], defaultInstanceId: 'sim.0' }
        : url === '/api/sim/status' ? { instanceId: 'sim.0', active: false }
          : { catalog: [{ id: 'scene', title: 'Scene' }], status: { selected: 'scene' } };
      return { ok: true, status: 200, text: async () => JSON.stringify(body) };
    },
  };
  vm.runInNewContext(source, context, { filename: 'simulation.ts', timeout: 1000 });
  await new Promise(setImmediate);
  return {
    element: (id) => elements.get(`nw-sim-${id}`),
    async failClick(id, nextFailure) {
      failure = nextFailure;
      for (const element of elements.values()) element.htmlWrites.length = 0;
      await elements.get(`nw-sim-${id}`).listeners.get('click')();
    },
  };
}

const selections = [
  [{ message: '  Erst Simulation deaktivieren.  ', error: 'configuration_conflict' }, 'Erst Simulation deaktivieren.'],
  [{ message: '', error: 'legacy_error' }, 'legacy_error'],
  [{ message: '  ', error: ' legacy_error ' }, 'legacy_error'],
  [{ message: { text: 'invalid' }, error: 'legacy_error' }, 'legacy_error'],
  [{ message: 42, error: 'legacy_error' }, 'legacy_error'],
  [{ message: null, error: 'legacy_error' }, 'legacy_error'],
  [{ message: false, error: ['invalid'] }, 'HTTP 409'],
  [{ message: '', error: '   ' }, 'HTTP 409'],
  [null, 'HTTP 409'],
];
for (const [body, expected] of selections) {
  test(`API-Fehlerauswahl: ${JSON.stringify(body)}`, async () => {
    const page = await browser();
    await page.failClick('enable', { route: '/api/sim/enable', body });
    assert.equal(page.element('statusline').textContent, `Fehler\u00a0${expected}`);
    assert.deepEqual(page.element('statusline').htmlWrites, []);
    assert.equal(page.element('enable').disabled, false);
  });
}

test('Alle Aktionsfehler zeigen Markup unverändert als Text und behalten das Fehler-Badge', async () => {
  const message = '<img src=x onerror=alert(1)><script>evil()</script>';
  const actions = [
    ['refresh', '/api/sim/discover', 'statusline'],
    ['enable', '/api/sim/enable', 'statusline'],
    ['disable', '/api/sim/disable', 'statusline'],
    ['scen-refresh', '/api/sim/scenarios', 'scen-status'],
    ['scen-start', '/api/sim/scenario/start', 'scen-status'],
    ['scen-stop', '/api/sim/scenario/stop', 'scen-status'],
    ['scen-reset', '/api/sim/scenario/reset', 'scen-status'],
  ];
  for (const [button, route, output] of actions) {
    const page = await browser();
    await page.failClick(button, { route, body: { ok: false, message, error: 'configuration_conflict' } });
    const target = page.element(output);
    assert.equal(target.textContent, `Fehler\u00a0${message}`, button);
    assert.deepEqual(target.htmlWrites, [], button);
    assert.equal(target.children[0].className, 'nw-config-badge nw-config-badge--error', button);
    assert.equal(target.children[0].textContent, 'Fehler', button);
  }
});

test('Nicht-JSON- und Transportfehler behalten den bisherigen Text-Fallback', async () => {
  for (const failure of [{ raw: '<bad response>' }, { networkError: 'Network unavailable' }]) {
    const page = await browser();
    await page.failClick('disable', { route: '/api/sim/disable', ...failure });
    assert.equal(page.element('statusline').textContent, `Fehler\u00a0${failure.raw || failure.networkError}`);
    assert.deepEqual(page.element('statusline').htmlWrites, []);
  }
});

test('Initialer Ladefehler zeigt öffentlichen Hinweis als einfachen Text', async () => {
  const message = '<svg onload=alert(1)>Bitte erneut laden.</svg>';
  const page = await browser({ route: '/api/sim/discover', body: { error: 'configuration_unavailable', message } });
  assert.equal(page.element('statusline').textContent, message);
  assert.deepEqual(page.element('statusline').htmlWrites, []);
  assert.equal(page.element('refresh').disabled, false);
});
