#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft die minimale Router-6-auf-7-Migration gegen die echten TSX-Routen.
 * Daten und Wirkung: Transpiliert Original-TSX nur im Speicher. HashRouter und
 * React-Renderer stammen aus den installierten Admin-Abhängigkeiten. Fachseiten
 * und Netzwerkzugriff sind Test-Doubles, damit keine Anlagenoperation erfolgt.
 * Bei Änderungen: Rollenmatrix und unbekannte Hashpfade erhalten; dies ist ein
 * Node-Renderer-/Hookzustandstest, kein Nachweis eines echten Browserlebenszyklus.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const adminRequire = createRequire(path.join(root, 'src-admin-tab/package.json'));
const ts = require('typescript');
const React = adminRequire('react');
const { renderToStaticMarkup } = adminRequire('react-dom/server');
const router = adminRequire('react-router-dom');
const version = adminRequire('react-router-dom/package.json').version;
assert.equal(version, '7.18.4', 'Geprüfter Routerstand muss dem fixierten Paket entsprechen');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'src-admin-tab/package.json'), 'utf8'));
assert.equal(packageJson.dependencies['react-router-dom'], version);
let statusValue = null;
const calls = [];
const api = {
  getInstance: () => '0',
  getRuntimeProxyBase: () => null,
  readRuntimeAuthStatus: async () => { calls.push('auth'); return statusValue; },
  loginRuntimeAuth: async () => {}, logoutRuntimeAuth: async () => {},
};

function fakeWindow(hash, embedded = false) {
  const search = `?instance=0${embedded ? '&embedded=1' : ''}`;
  const win = {
    location: { hash, pathname: '/admin/react/index.html', search, href: `https://eos.example/admin/react/index.html${search}${hash}`, origin: 'https://eos.example' },
    history: { state: { idx: 0 }, replaceState(state) { this.state = state; }, pushState(state) { this.state = state; } },
    addEventListener() {}, removeEventListener() {},
    localStorage: { getItem: () => null }, setInterval: () => 1, clearInterval() {},
    document: { querySelector: () => null },
  };
  win.parent = embedded ? {} : win;
  return win;
}
global.window = fakeWindow('#/installer');
global.document = global.window.document;
let currentWindow = global.window;

/** Lädt Original-Gate und Layout inklusive EmbeddedEmsFrame; DOM-Effekte laufen beim Node-Render nicht. */
function loadTsx(relative, reactOverride = React, cache = new Map()) {
  if (cache.has(relative)) return cache.get(relative);
  const filename = path.join(root, 'src-admin-tab/src', relative);
  let source = fs.readFileSync(filename, 'utf8');
  if (relative === 'pages/ProtectedRuntimeRoute.tsx') source += '\nexports.testHasCapability = hasCapability;';
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const localRequire = (name) => {
    if (name === 'react') return reactOverride;
    if (name === 'react-router-dom') return router;
    if (name.endsWith('/adminConnection')) return api;
    if (name.endsWith('.png')) return '/test-logo.png';
    if (name.endsWith('/ProtectedRuntimeRoute')) return loadTsx('pages/ProtectedRuntimeRoute.tsx', reactOverride, cache);
    if (name === './PageShell') return loadTsx('pages/PageShell.tsx', React, cache);
    if (name === '../components/EmbeddedEmsFrame') return loadTsx('components/EmbeddedEmsFrame.tsx', React, cache);
    if (name.startsWith('./pages/')) return { default: () => React.createElement('div', { 'data-secret-page': name }, 'PRIVATE-PAGE-SENTINEL'), __esModule: true };
    throw new Error(`Ungeplanter Import im Routertest: ${name}`);
  };
  const context = vm.createContext({ module, exports: module.exports, require: localRequire, window: currentWindow, document: currentWindow.document, URL, URLSearchParams, setTimeout: () => 1, clearTimeout() {}, console });
  vm.runInContext(code, context, { filename });
  cache.set(relative, module.exports);
  return module.exports;
}

const App = loadTsx('App.tsx').default;
const routes = router.createRoutesFromElements(App().props.children);
const protectedRoutes = [
  ['/', 'appcenter.open'], ['/installer', 'appcenter.open'],
  ['/license', 'license.manage'], ['/notification-mail', 'notifications.manage'],
  ['/mesh-coordinator', 'mesh.configure'], ['/redirect/appcenter', 'appcenter.open'],
  ['/dynamic-grid', 'appcenter.open'],
  ['/redirect/simulation', 'simulation.open'],
];
let count = 0;

// HashRouter und ursprüngliches Gate rendern: sensible Kindkomponenten bleiben
// vor abgeschlossener Auth-Prüfung unsichtbar. LayoutEffect-Warnungen entstehen
// ausschließlich durch diesen absichtlichen Node-Render, nicht im Produkt.
const oldError = console.error;
console.error = (...args) => {
  if (String(args[0]).includes('useLayoutEffect does nothing on the server')) return;
  oldError(...args);
};
try {
  for (const [routePath, capability] of protectedRoutes) {
    const matches = router.matchRoutes(routes, routePath);
    assert.equal(matches.at(-1).route.element.props.capability, capability);
    currentWindow = fakeWindow(`#${routePath}`);
    global.window = currentWindow;
    global.document = currentWindow.document;
    const OriginalApp = loadTsx('App.tsx').default;
    const html = renderToStaticMarkup(React.createElement(router.HashRouter, { window: currentWindow }, React.createElement(OriginalApp)));
    assert(html.includes('Zugriff geschützt'), routePath);
    assert(!html.includes('PRIVATE-PAGE-SENTINEL'), routePath);
    count++;
  }
  for (const untrusted of ['/unknown', '/license/extra', '//external.example/path', '/%3Cscript%3E']) {
    const fallback = router.matchRoutes(routes, untrusted).at(-1).route.element;
    assert.equal(fallback.type, router.Navigate);
    assert.equal(fallback.props.to, '/installer');
    assert.equal(fallback.props.replace, true);
    count++;
  }
  // Original-Gate mit kontrollierten Hookzuständen: erlaubt nur Session UND
  // Capability; besonders Installer mit '*' darf keine Adminseiten erhalten.
  const profiles = [
    { label: 'admin', enabled: true, authed: true, role: 'admin', capabilities: ['*'] },
    { label: 'installer', enabled: true, authed: true, role: 'installer', capabilities: ['*'] },
    { label: 'user', enabled: true, authed: true, role: 'user', capabilities: [] },
    { label: 'missing-session', enabled: true, authed: false, role: 'admin', capabilities: ['*'] },
    { label: 'disabled-auth', enabled: false, authed: true, role: 'admin', capabilities: ['*'] },
    null,
  ];
  for (const profile of profiles) {
    for (const capability of ['license.manage', 'notifications.manage', 'mesh.configure', 'appcenter.open']) {
      let stateIndex = 0;
      const stateValues = ['authorized', profile];
      const hookReact = { ...React,
        useState(initial) { const index = stateIndex++; return [index < 2 ? stateValues[index] : typeof initial === 'function' ? initial() : initial, () => {}]; },
        useMemo: fn => fn(), useCallback: fn => fn, useEffect() {}, useRef: initial => ({ current: initial }),
      };
      const Gate = loadTsx('pages/ProtectedRuntimeRoute.tsx', hookReact).default;
      const output = Gate({ capability, title: 'Prüfung', children: React.createElement('b', null, 'PRIVATE-PAGE-SENTINEL') });
      const html = renderToStaticMarkup(React.createElement(router.HashRouter, { window: currentWindow }, output));
      const expected = !!(profile?.authed && profile.enabled && (profile.role === 'admin' || (profile.role === 'installer' && ['mesh.configure', 'appcenter.open'].includes(capability))));
      assert.equal(html.includes('PRIVATE-PAGE-SENTINEL'), expected, `${profile?.label || 'unknown'} / ${capability}`);
      count++;
    }
  }
  // Die eingebettete Darstellung verwendet das Original-Layout und muss auch
  // einem Kunden mit überbreiter Capability die Fachseite weiterhin verwehren.
  const dynamicRoute = router.matchRoutes(routes, '/dynamic-grid').at(-1).route.element;
  assert.equal(dynamicRoute.props.embedded, true);
  assert.deepEqual(Array.from(dynamicRoute.props.allowedRoles), ['admin', 'installer']);
  for (const profile of [...profiles, { label: 'user-wildcard', enabled: true, authed: true, role: 'user', capabilities: ['*'] }]) {
    currentWindow = fakeWindow('#/dynamic-grid', true);
    global.window = currentWindow;
    global.document = currentWindow.document;
    let stateIndex = 0;
    const stateValues = ['authorized', profile];
    const hookReact = { ...React,
      useState(initial) { const index = stateIndex++; return [index < 2 ? stateValues[index] : typeof initial === 'function' ? initial() : initial, () => {}]; },
      useMemo: fn => fn(), useCallback: fn => fn, useEffect() {}, useRef: initial => ({ current: initial }),
    };
    const Gate = loadTsx('pages/ProtectedRuntimeRoute.tsx', hookReact).default;
    const output = Gate({ ...dynamicRoute.props, children: React.createElement('b', null, 'PRIVATE-PAGE-SENTINEL') });
    const html = renderToStaticMarkup(React.createElement(router.HashRouter, { window: currentWindow }, output));
    const expected = !!(profile?.authed && profile.enabled && ['admin', 'installer'].includes(profile.role));
    assert.equal(html.includes('PRIVATE-PAGE-SENTINEL'), expected, `embedded / ${profile?.label || 'unknown'}`);
    assert(html.includes('nw-embedded-ems-content'), 'Echter eingebetteter Layout-Wrapper bleibt erhalten');
    assert.equal(html.includes('Zugriff geschützt'), !expected);
    assert(!html.includes('nw-protected-route__session'), 'Host verwaltet die sichtbare Sitzungsleiste');
    assert(!html.includes('nw-hero'), 'Keine zweite Kopfzeile im eingebetteten Gate');
    count++;
  }
  // PageShell-Link bleibt in der neuen echten HashRouter-Implementierung lokal.
  const Shell = loadTsx('pages/PageShell.tsx').default;
  const html = renderToStaticMarkup(React.createElement(router.HashRouter, { window: currentWindow }, React.createElement(Shell, { title: 'Test' })));
  assert(html.includes('href="#/installer"'));
  assert.equal(calls.length, 0, 'Node-Erstrender führt keine API-/Anlagenaktionen aus');
  count++;
} finally { console.error = oldError; }
console.log(`[verify-cra-admin-router] PASS ${count} Fälle; react-router-dom ${version}, echte HashRouter-/Route-Komponenten, Node-Render und kontrollierte Auth-Hookzustände; kein echter Browserlebenszyklus.`);
