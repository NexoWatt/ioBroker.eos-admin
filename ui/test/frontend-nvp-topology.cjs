/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
'use strict';
/**
 * Fokussierte Frontendprüfung der App Dynamischer Netzanschluss ohne Browser. Führt tatsächliche TSX-Formhandler
 * und den React-Serverrenderer aus; ergänzt die separat ausführbare Browserprüfung.
 * Ein erfolgreicher Renderer-Test ist kein Nachweis für Layout oder echte Bedienung.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const crypto = require('node:crypto');
const React = require('../src-admin-tab/node_modules/react');
const { renderToStaticMarkup } = require('../src-admin-tab/node_modules/react-dom/server');
const root = path.resolve(__dirname, '..');
const dependencies = {
  './PageShell': function Shell(props) { return props.children; },
  '../lib/adminConnection': { getRuntimeProxyBase: () => null },
  './adminConnection': { getRuntimeProxyBase: () => null },
};
function loadSource(file, names, extraContext = {}) {
  const source = fs.readFileSync(path.join(root, file), 'utf8') + '\nexport { ' + names.join(', ') + ' };';
  const result = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  assert.deepEqual((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error), []);
  const module = { exports: {} };
  const context = { module, exports: module.exports, require: id => {
    if (id === 'react') return React;
    if (Object.hasOwn(dependencies, id)) return dependencies[id];
    throw new Error(`Nicht vorbereitete Testabhängigkeit: ${id}`);
  }, setTimeout, clearTimeout, ...extraContext };
  vm.runInNewContext(result.outputText, context, { filename: file });
  return { exports: module.exports, context };
}
// Der echte DP-Renderer einschließlich seines Kontexts wird geladen. Sein
// Browserdialog wird beim SSR nicht geöffnet; keinerlei Auswahlbutton-Stubs.
dependencies['../lib/adminContracts'] = loadSource('src-admin-tab/src/lib/adminContracts.ts', []).exports;
dependencies['./adminContracts'] = dependencies['../lib/adminContracts'];
dependencies['../lib/dataPointPicker'] = loadSource('src-admin-tab/src/lib/dataPointPicker.ts', []).exports;
const dp = loadSource('src-admin-tab/src/components/DpField.tsx', []).exports;
dependencies['../components/DpField'] = dp;
dependencies['../components/EmbeddedEmsFrame'] = loadSource('src-admin-tab/src/components/EmbeddedEmsFrame.tsx', []).exports;
const ui = loadSource('src-admin-tab/src/pages/DynamicGridPage.tsx', ['emptyTopology', 'emptyPoint', 'emptyStorage', 'NumericField', 'GeneralMeasurement', 'PointEditor', 'StorageEditor', 'ScalarField', 'LiveStatus']).exports;
const plain = value => JSON.parse(JSON.stringify(value));
const children = element => React.Children.toArray(element?.props?.children);
const flatten = element => [element, ...children(element).flatMap(child => typeof child === 'object' ? flatten(child) : [])];
let passed = 0;
function check(name, run) { run(); passed++; console.log('PASS', name); }
function render(element, dpContext = { revision: 1, blocked: false }) {
  // React meldet erwartungsgemäß, dass useLayoutEffect beim Serverrenderer nicht
  // läuft. Nur diese SSR-Einschränkung erfassen; jede andere Renderwarnung schlägt fehl.
  const original = console.error; const unexpected = [];
  console.error = (message, ...args) => {
    if (!String(message).startsWith('Warning: useLayoutEffect does nothing on the server')) unexpected.push([message, ...args]);
  };
  let html;
  try { html = renderToStaticMarkup(React.createElement(dp.DpFieldContext.Provider, { value: dpContext }, element)); }
  finally { console.error = original; }
  assert.deepEqual(unexpected, [], 'Keine unerwarteten React-Renderwarnungen');
  return html;
}
check('real data point field keeps manual input and picker under the same context lock', () => {
  const field = React.createElement(dp.default, { label: 'M1-Messwert', value: 'meter.local', required: true, onChange() {} });
  const ready = render(field);
  assert.match(ready, /<input[^>]+value="meter.local"/);
  assert.match(ready, /aria-label="Datenpunkt auswählen: M1-Messwert"/);
  assert.ok(!ready.includes('disabled=""'));
  const locked = render(field, { revision: 2, blocked: true });
  assert.match(locked, /<input[^>]+disabled=""/);
  assert.match(locked, /<button[^>]+disabled=""/);
  assert.ok(locked.includes('DP wählen'));
});
check('separate app draft has no manual activation or second M0 mapping', () => {
  const draft = plain(ui.emptyTopology());
  assert.equal(draft.schemaVersion, 1); assert.equal(draft.points[0].source, 'general');
  for (const key of ['enabled', 'mode', 'operation']) assert.equal(Object.hasOwn(draft, key), false);
  assert.equal(Object.hasOwn(draft.points[0], 'measurement'), false);
  assert.equal(draft.points[1].measurement.stateId, '');
});
check('M0 signed and split sources render read-only with real General link', () => {
  for (const measurement of [{ stateId: 'site.grid', unit: 'W', sign: 1, maxAgeMs: 5000 }, { kind: 'split', importMeasurement: { stateId: 'site.buy', unit: 'W', sign: 1 }, exportMeasurement: { stateId: 'site.sell', unit: 'kW', sign: 1 }, sign: -1 }]) {
    const html = render(React.createElement(ui.GeneralMeasurement, { rootSource: { valid: true, measurement } }));
    assert.ok(!html.includes('<input')); assert.match(html, /tab=mapping/);
    assert.ok(html.includes(measurement.stateId || 'site.buy'));
    if (measurement.kind === 'split') { assert.match(html, /site.sell/); assert.match(html, /wird umgekehrt/); }
  }
});
check('clearing a required number never becomes zero or no-limit null', () => {
  let next = 99;
  const field = ui.NumericField({ label: 'Limit', value: 0, onChange: v => { next = v; } });
  const input = flatten(field).find(e => e.type === 'input');
  input.props.onChange({ target: { value: '' } }); assert.equal(next, '');
  input.props.onChange({ target: { value: '0' } }); assert.equal(next, 0);
});
check('M1 zero remains an enabled limit while null stays explicitly unconfigured', () => {
  const point = { ...plain(ui.emptyPoint('M1')), exportLimitW: 0, importLimitW: null };
  const html = render(React.createElement(ui.PointEditor, { value: point, onChange() {} }));
  assert.match(html, /Einspeisung · Anschlussgrenze/); assert.match(html, /Bezug: ausdrücklich keine lokale Vertragsgrenze/); assert.match(html, /Betriebsgrenze: 0 W/);
  assert.match(html, /data-dp-pick="true"/);
  assert.ok(html.includes('Datenpunkt auswählen: M1-Nettoleistung'));
});
check('generic storage has full own mapping and no brand or Farm dependency', () => {
  const initial = plain(ui.emptyStorage());
  let next;
  const editor = ui.StorageEditor({ value: initial, onChange: v => { next = v; }, onRemove() {} });
  const purpose = flatten(editor).find(e => e.props?.label === 'Betriebsaufgabe');
  purpose.props.onChange('arbitrage'); assert.equal(next.authority, 'eos');
  assert.equal(initial.connectionPointId, ''); assert.equal(initial.controlPointId, '');
  const html = render(editor);
  for (const text of ['Speicherkennung', 'Batterie-Istleistung', 'SoC · Datenpunkt', 'Leistungssollwert · Schreib-Datenpunkt', 'Eigenverbrauchsoptimierung (EVO)', 'Nulleinspeisung', 'Lastspitzenkappung', 'Arbitrage', 'Tarifgeführter Betrieb']) assert.ok(html.includes(text), text);
  assert.ok(!html.includes('Vorhandener Speicher'));
  for (const label of ['SoC · Datenpunkt', 'Leistungssollwert · Schreib-Datenpunkt']) assert.ok(html.includes(`aria-label="Datenpunkt auswählen: ${label}"`));
});
check('external limits have independent maxima, applied feedback and device TTL', () => {
  let next;
  const editor = ui.StorageEditor({ value: plain(ui.emptyStorage()), onChange: v => { next = v; }, onRemove() {} });
  flatten(editor).find(e => e.props?.label === 'Befehlsschnittstelle').props.onChange('externalLimits');
  assert.equal(next.authority, 'eos', 'interface selection must not silently transfer authority');
  assert.equal(next.command.watchdog.expiryBehavior, 'zeroLimits');
  assert.equal(Object.hasOwn(next.command, 'signedTarget'), false);
  const html = render(React.createElement(ui.StorageEditor, { value: next, onChange() {}, onRemove() {} }));
  for (const text of ['Maximale Ladefreigabe', 'Maximale Entladefreigabe', 'Angewandte Ladegrenze', 'Angewandte Entladegrenze', 'Geräteseitige Ablaufzeit', 'Watchdog · Rücklese-Datenpunkt']) assert.ok(html.includes(text), text);
});
check('live readout never promotes ACK to applied effect and hides stale command', () => {
  const status = { active: true, status: 'active', ts: Date.now(), snapshot: { points: { M0: { valid: true, valueW: 20000, ageMs: 15 } }, storages: { battery: { valid: true, valueW: 1000, ageMs: 15 } }, storageTelemetry: { battery: { socPct: 60, available: true } }, errors: [] }, storageResults: [{ id: 'battery', requestedW: 45000, targetW: 20000, accepted: true, commandConfirmed: true }], pendingIntervals: [{ id: 'battery', appliedConfirmed: false }], reason: '<script>unsafe()</script>' };
  const fresh = render(React.createElement(ui.LiveStatus, { status }));
  assert.match(fresh, /Rücklesung bestätigt/); assert.match(fresh, /Noch nicht bestätigt/); assert.ok(!fresh.includes('<script>unsafe()'));
  const stale = render(React.createElement(ui.LiveStatus, { status: { ...status, ts: 1 } }));
  assert.match(stale, /Betriebsanzeige veraltet/); assert.ok(!stale.includes('45 kW'));
});
const access = loadSource('src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx', ['hasCapability']).exports;
check('unknown status labels never resolve inherited prototype members', () => {
  for (const status of ['constructor', '__proto__', 'toString']) {
    const html = render(React.createElement(ui.LiveStatus, { status: { status, ts: Date.now() } }));
    assert.ok(html.includes(status), 'Unbekannter Status bleibt ein sicherer Text.');
    assert.ok(!html.includes('[object Object]'));
  }
});
check('customer wildcard does not bypass Installer/Admin app guard', () => {
  assert.equal(access.hasCapability({ role: 'user', capabilities: ['*'] }, 'appcenter.open', ['admin', 'installer']), false);
  assert.equal(access.hasCapability({ role: 'installer', capabilities: ['appcenter.open'] }, 'appcenter.open', ['admin', 'installer']), true);
});
(async () => {
  let calls = 0; let authChecks = 0;
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  const api = loadSource('src-admin-tab/src/lib/adminConnection.ts', [], {
    window: { location: new URL('https://eos.test:9443/ems/dynamic-grid/') },
    AbortController, TextDecoder, URL, URLSearchParams,
    fetch: async (url, options) => {
      if (new URL(url).pathname === '/api/auth/status') {
        authChecks++;
        assert.equal(options.method, 'GET');
        return Response.json({ mode: 'iobroker', configured: true, enabled: true, protectWrites: true, authed: true, authenticated: true,
          role: 'installer', user: 'system.user.fixture', capabilities: ['appcenter.open'], csrfToken, loginUrl: '/login.html', logoutUrl: '' });
      }
      calls++; assert.match(url, /\/api\/dynamic-grid\/config$/);
      assert.equal(options.method, 'POST');
      assert.equal(new Headers(options.headers).get('X-NW-CSRF'), csrfToken);
      return Response.json({ ok: false, message: 'Version geändert' }, { status: 409 });
    },
  });
  await assert.rejects(() => api.exports.dynamicGridRequest('/config', { config: {}, expectedConfigVersion: 1, app: { installed: true, enabled: true } }), /Version geändert/);
  assert.equal(authChecks, 1); assert.equal(calls, 1); passed++; console.log('PASS atomic activation conflict is not retried after verified session and CSRF');
  console.log(JSON.stringify({ result: 'PASS', checks: passed, limitation: 'React renderer and actual handlers; browser interaction is a separate check.' }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
