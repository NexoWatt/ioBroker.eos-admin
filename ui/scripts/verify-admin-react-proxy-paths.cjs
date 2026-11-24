#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Führt originale React-Pfadaufbauten und den Datenpunktdialog im
 * kontrollierten DOM-/Hook-Host aus. Prüft Proxy-Präfixe und direkten Betrieb.
 * Wirkung: Nur synthetische Fenster, Timer und DOM-Elemente; keine Netzwerk-
 * oder Anlagenoperationen. Kein Ersatz für den gesonderten Browsernachweis.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const root = path.resolve(__dirname, '../src-admin-tab/src');
let count = 0;
const navigationModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, 'lib/installerNavigation.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { module: navigationModule, exports: navigationModule.exports });
const cases = [
  { label: 'direkt HTTP', base: null, origin: 'http://eos.example:8188' },
  { label: 'direkt HTTPS', base: null, origin: 'https://eos.example' },
  { label: 'Adminproxy Instanz 0', base: 'https://eos.example/proxy/nexowatt-ui.0', origin: 'https://eos.example' },
  { label: 'Adminproxy Public Path Instanz 7', base: 'https://eos.example/iobroker/proxy/nexowatt-ui.7', origin: 'https://eos.example' },
];
function classList() { const values = new Set(); return { contains: key => values.has(key), add: (...keys) => keys.forEach(key => values.add(key)), remove: (...keys) => keys.forEach(key => values.delete(key)) }; }
function fixture(item, embedded = false) {
  const effects = [], frames = new Map(), listeners = new Map(), links = [], posts = [], opens = [], timers = new Set();
  const node = { getBoundingClientRect: () => ({ height: 230.25 }) };
  const parent = { postMessage: (data, origin) => posts.push({ data, origin }) };
  const prefix = item.base ? new URL(item.base).pathname : '';
  const window = {
    location: { origin: item.origin, pathname: prefix + '/ems/microgrid', search: embedded ? '?embedded=1' : '' },
    addEventListener: (name, handler) => listeners.set(name, handler), removeEventListener: (name, handler) => { if (listeners.get(name) === handler) listeners.delete(name); },
    requestAnimationFrame: handler => { const id = frames.size + 1; frames.set(id, handler); return id; }, cancelAnimationFrame: id => frames.delete(id),
    open(url) { const popup = { postMessage() {}, closed: false, close() { this.closed = true; } }; opens.push({ url, popup }); return popup; },
  };
  window.parent = embedded ? parent : window;
  window.postMessage = parent.postMessage;
  const document = {
    documentElement: { classList: classList() }, body: { classList: classList() },
    head: { appendChild: element => links.push(element) },
    createElement: tag => ({ tag, dataset: {}, events: new Map(), addEventListener(name, handler) { this.events.set(name, handler); }, removeEventListener(name) { this.events.delete(name); }, remove() { links.splice(links.indexOf(this), 1); } }),
  };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: 'fragment',
    useState: value => [typeof value === 'function' ? value() : value, () => {}],
    useRef: value => ({ current: value === null ? node : value }),
    useMemo: fn => fn(), useEffect: fn => effects.push(fn),
  };
  const api = { getRuntimeProxyBase: () => item.base };
  let observerDisconnected = false;
  class ResizeObserver { observe(value) { assert.equal(value, node); } disconnect() { observerDisconnected = true; } }
  const globals = { window, document, URL, URLSearchParams, ResizeObserver, DOMException, crypto: crypto.webcrypto,
    setTimeout: fn => { timers.add(fn); return fn; }, clearTimeout: fn => timers.delete(fn),
    setInterval: fn => { timers.add(fn); return fn; }, clearInterval: fn => timers.delete(fn),
  };
  function load(relative) {
    const filename = path.join(root, relative);
    let source = fs.readFileSync(filename, 'utf8');
    if (relative === 'pages/DynamicGridPage.tsx') source += '\nexports.testGeneralMeasurement = GeneralMeasurement;';
    const compiled = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
    assert.equal((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0);
    const module = { exports: {} };
    vm.runInNewContext(compiled.outputText, { ...globals, module, exports: module.exports, require(name) {
      if (name === 'react') return React;
      if (name === 'react-router-dom') return { Navigate: 'Navigate', Route: 'Route', Routes: 'Routes' };
      if (name.endsWith('/adminConnection')) return api;
      if (name.endsWith('/adminContracts')) return { isRecord: value => value && typeof value === 'object' && !Array.isArray(value), isSafeJson: () => true };
      if (name.endsWith('/mesh-types')) return { limitKeys: [], networkKeys: [] };
      if (name.endsWith('/DpField')) return { __esModule: true, default: 'DpField', DpFieldContext: { Provider: 'context' } };
      if (name.startsWith('./pages/') || name === './PageShell' || name === './MeshAccountingPanel') return { __esModule: true, default: name };
      throw new Error('Ungeplanter Import: ' + name);
    } }, { filename });
    return module.exports;
  }
  return { load, effects, frames, links, posts, opens, timers, listeners, window, document, api, get observerDisconnected() { return observerDisconnected; } };
}
function collect(node, predicate, result = []) {
  if (!node || typeof node !== 'object') return result;
  if (Array.isArray(node)) { node.forEach(child => collect(child, predicate, result)); return result; }
  if (predicate(node)) result.push(node);
  for (const value of Object.values(node.props || {})) if (value && typeof value === 'object') collect(value, predicate, result);
  return result;
}
/** Zustandsfähiger Hook-Host für die tatsächlichen asynchronen Installer-/Weiterleitungsseiten. */
function routingFixture(relative) {
  const states = [], effects = [], cleanups = [], opens = [], reads = [], timers = new Map();
  let cursor = 0, rendered = false, writes = 0, nextTimer = 0;
  let resolve, reject;
  const destination = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  const window = { location: new URL('https://eos.example:8443/office/adapter/nexowatt-ui/react/index.html?instance=2') };
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (index >= states.length) states.push(typeof initial === 'function' ? initial() : initial);
      return [states[index], value => { writes++; states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useMemo: fn => fn(), useEffect: fn => { if (!rendered) effects.push(fn); },
  };
  const filename = path.join(root, relative), module = { exports: {} };
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename,
    compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  vm.runInNewContext(compiled, { module, exports: module.exports, window,
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    require(name) {
      if (name === 'react') return React;
      if (name === './PageShell') return { __esModule: true, default: 'PageShell' };
      if (name === './ProtectedRuntimeRoute') return { useRuntimeAccess: () => ({ authed: true, role: 'admin' }) };
      if (name.endsWith('/installerNavigation')) return navigationModule.exports;
      if (name.endsWith('/adminConnection')) return {
        getInstance: () => '2', openExternal: url => opens.push(url),
        resolveRuntimeBaseUrl(instance) { reads.push(instance); return destination; },
      };
      throw new Error('Ungeplanter Routing-Import: ' + name);
    },
  }, { filename });
  return {
    opens, reads, timers, resolve, reject, get writes() { return writes; },
    render() { cursor = 0; const tree = module.exports.default({ targetKey: 'appcenter' }); rendered = true; return tree; },
    start() { effects.splice(0).forEach(fn => cleanups.push(fn())); },
    unmount() { cleanups.splice(0).forEach(fn => { if (typeof fn === 'function') fn(); }); },
    settle: async () => { for (let i = 0; i < 4; i++) await new Promise(done => setImmediate(done)); },
    fireTimers() { for (const [id, fn] of timers) { timers.delete(id); fn(); } },
  };
}
(async () => {
  for (const item of cases) {
    const expectedBase = item.base || '';
    const f = fixture(item, true);
    f.load('components/EmbeddedEmsFrame.tsx').default({ children: 'content' });
    const cleanup = f.effects[0]();
    assert.equal(f.links.length, 1);
    assert.equal(f.links[0].href, expectedBase + '/static/styles.css');
    assert.equal(new URL(f.links[0].href, item.origin).origin, item.origin);
    for (const fn of f.frames.values()) fn();
    assert.equal(f.posts[0].origin, item.origin); assert.equal(f.posts[0].data.height, 232);
    cleanup(); assert.equal(f.links.length, 0); assert.equal(f.observerDisconnected, true);
    assert.equal(f.document.body.classList.contains('nw-ems-embedded'), false);
    assert.equal(f.listeners.size, 0); count++;
    console.log('PASS Stylesheet, Ursprung und Lifecycle: ' + item.label);

    const n = fixture(item);
    const notification = n.load('pages/NotificationMailPage.tsx').default();
    assert.deepEqual(collect(notification, node => node.type === 'a').map(node => node.props.href), [expectedBase + '/settings.html', expectedBase + '/ems-apps.html']);
    const mesh = n.load('pages/MeshCoordinatorPage.tsx').default();
    assert.deepEqual(collect(mesh, node => node.type === 'a').map(node => node.props.href), [expectedBase + '/ems-apps.html?nwAdmin=1']);
    const dynamic = n.load('pages/DynamicGridPage.tsx');
    assert.equal(collect(dynamic.default(), node => node.type === 'a')[0].props.href, expectedBase + '/ems-apps.html?nwAdmin=1');
    assert.equal(collect(dynamic.testGeneralMeasurement({ rootSource: null }), node => node.type === 'a')[0].props.href, expectedBase + '/ems-apps.html?nwAdmin=1&tab=mapping');
    count++; console.log('PASS originale React-Navigationsziele: ' + item.label);

    const app = n.load('App.tsx').default;
    let route = collect(app(), node => node.type === 'Route' && node.props.path === '/mesh-coordinator')[0];
    assert.equal(route.props.element.props.children[0].type, './pages/MeshCoordinatorPage');
    n.window.location.pathname = '/adapter/nexowatt-ui/react/index.html';
    route = collect(app(), node => node.type === 'Route' && node.props.path === '/mesh-coordinator')[0];
    assert.equal(route.props.element.props.children[0].type, './pages/RedirectPage');
    count++; console.log('PASS Microgrid-Runtime vs. Admin-Tab: ' + item.label);

    const picker = fixture(item);
    const pending = picker.load('lib/dataPointPicker.ts').chooseDataPoint();
    assert.equal(picker.opens.length, 1);
    const opened = picker.opens[0], url = new URL(opened.url);
    assert.equal(url.origin, item.origin);
    assert.equal(url.pathname, (item.base ? new URL(item.base).pathname : '') + '/ems-apps.html');
    assert.equal(url.searchParams.get('dpPicker'), '1');
    const requestId = url.searchParams.get('requestId');
    const receive = picker.listeners.get('message');
    receive({ origin: item.origin, source: opened.popup, data: { type: 'nw:dp-picker-ready', requestId } });
    receive({ origin: item.origin, source: opened.popup, data: { type: 'nw:dp-picker-result', requestId, id: 'test.0.valid' } });
    assert.equal(await pending, 'test.0.valid');
    assert.equal(picker.timers.size, 0); assert.equal(picker.listeners.size, 0); assert.equal(opened.popup.closed, true);
    count++; console.log('PASS Datenpunkt-Popup und Listener-Abbau: ' + item.label);
  }
  for (const relative of ['pages/InstallerPage.tsx', 'pages/RedirectPage.tsx']) {
    for (const base of ['https://eos.example:9191', 'https://eos.example:8443/office/proxy/nexowatt-ui.2']) {
      const f = routingFixture(relative);
      let buttons = collect(f.render(), node => node.type === 'button');
      assert(buttons.length > 0); assert(buttons.every(node => node.props.disabled === true));
      buttons.forEach(node => node.props.onClick()); assert.equal(f.opens.length, 0, 'kein vorläufiger Standardport');
      f.start(); assert.deepEqual(f.reads, ['2']); f.resolve(base); await f.settle();
      buttons = collect(f.render(), node => node.type === 'button');
      assert(buttons.every(node => node.props.disabled === false));
      if (relative.includes('Installer')) {
        const suffix = '?nwAdmin=1&instance=2&adminPort=8443';
        const expected = {
          'E-Mail-Versand': '/mail-setup/?instance=2#/notification-mail', 'VIS öffnen': '/',
          'EMS Apps öffnen': '/ems-apps.html' + suffix, Simulation: '/simulation.html' + suffix,
          'Historie einrichten': '/installer/?instance=2#/history-setup',
          Lizenz: '/nexowatt/license', 'SmartHome VIS': '/smarthome.html', 'SmartHome Config': '/smarthome-config.html' + suffix,
          Devices: '/modules/devices/', EEBus: '/modules/eebus/', Sicherung: '/modules/backup/',
          Zertifikate: '/security/tls/', Bestandsübernahme: '/migration/',
        };
        assert.deepEqual(buttons.map(button => button.props.children[0]).sort(), Object.keys(expected).sort());
        for (const button of buttons) { button.props.onClick(); assert.equal(f.opens.at(-1), base + expected[button.props.children[0]]); }
        assert.equal(f.opens.length, buttons.length, 'jede erlaubte Aktion öffnet genau das bestätigte Ziel');
      } else {
        buttons[0].props.onClick();
        assert.equal(f.opens[0], base + '/ems-apps.html?nwAdmin=1&instance=2&adminPort=8443');
        f.fireTimers(); assert.equal(f.opens[1], f.opens[0]);
      }
      f.unmount(); assert.equal(f.timers.size, 0); count++;
      console.log('PASS bestätigtes HTTPS-/Proxyziel ohne Standardport: ' + relative + ' ' + base);
    }
    const failed = routingFixture(relative); failed.render(); failed.start(); failed.reject(new Error('private fixture detail')); await failed.settle();
    const tree = failed.render();
    assert(collect(tree, node => node.type === 'button').every(node => node.props.disabled === true));
    assert.match(JSON.stringify(tree), /konnte nicht ermittelt werden/); assert.doesNotMatch(JSON.stringify(tree), /private fixture detail/);
    failed.fireTimers(); assert.equal(failed.opens.length, 0); failed.unmount(); count++;
    console.log('PASS Lesefehler ohne geratenes Ziel: ' + relative);

    const late = routingFixture(relative); late.render(); late.start(); late.unmount(); const before = late.writes;
    late.resolve('https://eos.example:9191'); await late.settle(); late.fireTimers();
    assert.equal(late.writes, before); assert.equal(late.opens.length, 0); assert.equal(late.timers.size, 0); count++;
    console.log('PASS spätes Ziel nach Unmount verworfen: ' + relative);
  }
  const scheduled = routingFixture('pages/RedirectPage.tsx'); scheduled.render(); scheduled.start();
  scheduled.resolve('https://eos.example:9191'); await scheduled.settle(); assert.equal(scheduled.timers.size, 1);
  scheduled.unmount(); assert.equal(scheduled.timers.size, 0); scheduled.fireTimers(); assert.equal(scheduled.opens.length, 0); count++;
  console.log('PASS geplanter Fensterwechsel wird beim Unmount aufgehoben');
  console.log(`[verify-admin-react-proxy-paths] PASS ${count} Fallgruppen; originale TS/TSX-Funktionen in kontrolliertem DOM-/Hook-Host, kein Browser-/Live-Anlagentest.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
