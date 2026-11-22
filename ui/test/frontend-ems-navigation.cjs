/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Nutzung, Änderung und Weitergabe nur mit ausdrücklicher Erlaubnis. */
'use strict';
/**
 * Prüft die tatsächliche React-Navigation ohne Browser: Der Installer öffnet
 * EMS-Regelung über EMS Apps und behält die rollenabhängigen übrigen Bereiche.
 * Der Serverrenderer führt die echte TSX-Seite aus; vor bestätigter Ziel-
 * Ermittlung bleiben die echten Click-Handler gesperrt. Die asynchron bestätigten
 * Ziele aller Aktionen prüft scripts/verify-admin-react-proxy-paths.cjs.
 * Kein Nachweis für Browserlayout, Backend-Rechte oder Hardwareverhalten.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('../src-admin-tab/node_modules/react');
const { renderToStaticMarkup } = require('../src-admin-tab/node_modules/react-dom/server');
const root = path.resolve(__dirname, '..');
const { MemoryRouter } = require('../src-admin-tab/node_modules/react-router-dom');

// Transpiliert die aktuelle Produktquelle, statt deren Aktionsliste nachzubauen.
function loadSource(file, dependencies, context, extraExports = []) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
    + (extraExports.length ? `\nexport { ${extraExports.join(', ')} };` : '');
  const compiled = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      jsx: ts.JsxEmit.React,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  assert.deepEqual((compiled.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error), []);
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, {
    module,
    exports: module.exports,
    require(id) {
      if (id === 'react') return React;
      if (Object.hasOwn(dependencies, id)) return dependencies[id];
      throw new Error(`Nicht vorbereitete Testabhängigkeit: ${id}`);
    },
    ...context,
  }, { filename: file });
  return module.exports;
}

function elements(element) {
  if (!React.isValidElement(element)) return [];
  return [element, ...React.Children.toArray(element.props.children).flatMap(elements)];
}

let checks = 0;
function check(name, run) {
  run();
  checks++;
  console.log('PASS', name);
}

const sharedActions = {
  'VIS öffnen': '/',
  'EMS Apps öffnen': '/ems-apps.html?nwAdmin=1&instance=3&adminPort=9443',
  Simulation: '/simulation.html?nwAdmin=1&instance=3&adminPort=9443',
  'SmartHome VIS': '/smarthome.html',
  'SmartHome Config': '/smarthome-config.html?nwAdmin=1&instance=3&adminPort=9443',
};
const adminActions = {
  'E-Mail-Versand': '/mail-setup/?instance=3#/notification-mail',
  Lizenz: '/license.html?nwAdmin=1&instance=3&adminPort=9443',
};
const contracts = loadSource('src-admin-tab/src/lib/adminContracts.ts', {}, {});
const picker = loadSource('src-admin-tab/src/lib/dataPointPicker.ts', { './adminContracts': contracts, './adminConnection': { getRuntimeProxyBase: () => null } }, {});
const dp = loadSource('src-admin-tab/src/components/DpField.tsx', { '../lib/dataPointPicker': picker }, {});

for (const role of ['installer', 'admin']) {
  check(`${role}: Installer rendert nur Bereiche und erlaubte Verwaltungsaktionen`, () => {
    let shellProps;
    const opened = [];
    let targetReads = 0;
    const ui = loadSource('src-admin-tab/src/pages/InstallerPage.tsx', {
      './PageShell': props => { shellProps = props; return React.createElement('main', null, props.children); },
      './ProtectedRuntimeRoute': { useRuntimeAccess: () => ({ authed: true, role }) },
      '../lib/adminConnection': {
        getInstance: () => '3',
        openExternal: url => opened.push(url),
        resolveRuntimeBaseUrl: async () => { targetReads++; return 'https://eos.test:8188'; },
      },
    }, { window: { location: { port: '9443' } } });
    const html = renderToStaticMarkup(React.createElement(ui.default));
    const buttons = elements(shellProps.children).filter(element => element.type === 'button');
    const expected = { ...sharedActions, ...(role === 'admin' ? adminActions : {}) };
    assert.deepEqual(buttons.map(button => button.props.children).sort(), Object.keys(expected).sort());
    assert.equal(shellProps.showBack, false);
    assert.equal(targetReads, 0, 'SSR startet keine asynchrone Ziel-Abfrage');
    assert.ok(html.includes('EMS Apps öffnen'), 'Die echte Seite rendert den EMS-Sammeleinstieg');
    for (const label of ['Dynamischer Netzanschluss', 'Microgrid', 'Nulleinspeisung', 'Lastspitzenkappung']) {
      assert.ok(!html.includes(label), `Kein einzelner EMS-Regelungsbutton: ${label}`);
    }
    for (const button of buttons) {
      assert.equal(button.props.type, 'button');
      assert.equal(typeof button.props.onClick, 'function');
      assert.equal(button.props.disabled, true, 'vor Zielbestätigung kein voreiliger Standardport');
      button.props.onClick();
      assert.equal(opened.length, 0, 'auch der echte Handler bleibt vor Zielbestätigung gesperrt');
    }
    if (role === 'installer') {
      assert.ok(!html.includes('E-Mail-Versand'));
      assert.ok(!html.includes('Lizenz'));
    }
  });
}

for (const embedded of [false, true]) {
  check(`M0 → Allgemein öffnet ${embedded ? 'den übergeordneten AppCenter-Rahmen' : 'dieselbe eigenständige Ansicht'}`, () => {
    const window = { location: { search: embedded ? '?embedded=1' : '' } };
    window.parent = embedded ? {} : window;
    const ui = loadSource('src-admin-tab/src/pages/DynamicGridPage.tsx', {
      './PageShell': props => props.children,
      '../lib/adminConnection': { getRuntimeProxyBase: () => null },
      '../components/DpField': dp,
      '../lib/adminContracts': contracts,
    }, { window }, ['GeneralMeasurement']);
    const props = { rootSource: { valid: true, measurement: { stateId: 'site.grid', unit: 'W', sign: 1, maxAgeMs: 5000 } } };
    const element = ui.GeneralMeasurement(props);
    const links = elements(element).filter(child => child.type === 'a');
    assert.equal(links.length, 1);
    assert.equal(links[0].props.href, '/ems-apps.html?nwAdmin=1&tab=mapping');
    assert.equal(links[0].props.target, embedded ? '_parent' : '_self');
    const html = renderToStaticMarkup(React.createElement(ui.GeneralMeasurement, props));
    assert.ok(html.includes('site.grid'));
    assert.ok(html.includes(`target="${embedded ? '_parent' : '_self'}"`));
    assert.ok(!html.includes('<input'), 'M0 bleibt ausschließlich aus Allgemein gelesen');
  });
}

for (const embedded of [true, false]) {
  check(`PageShell ${embedded ? 'eingebettet ohne zweiten Seitenkopf' : 'eigenständig mit Seitenkopf und Navigation'}`, () => {
    const shell = loadSource('src-admin-tab/src/pages/PageShell.tsx', {
      'react-router-dom': require('../src-admin-tab/node_modules/react-router-dom'),
      '../lib/adminConnection': { getInstance: () => 3 },
      '../../../www/assets/icons/nexowatt-192.png': '/fixture/nexowatt-192.png',
    }, {});
    const element = React.createElement(shell.default, {
      embedded, title: 'Dynamischer Netzanschluss', subtitle: 'EMS-App',
      actions: React.createElement('a', { href: '/ems-apps.html' }, 'Zu EMS Apps'),
    }, React.createElement('section', { id: 'actual-content' }, 'Einrichtung bleibt sichtbar'));
    const original = console.error; const unexpected = [];
    console.error = (message, ...args) => {
      if (!String(message).startsWith('Warning: useLayoutEffect does nothing on the server')) unexpected.push([message, ...args]);
    };
    let html;
    try { html = renderToStaticMarkup(React.createElement(MemoryRouter, null, element)); }
    finally { console.error = original; }
    assert.deepEqual(unexpected, [], 'Keine unerwarteten React-Renderwarnungen');
    assert.ok(html.includes('id="actual-content"'));
    assert.ok(html.includes('Einrichtung bleibt sichtbar'));
    if (embedded) {
      assert.ok(html.startsWith('<main class="nw-embedded-ems-page">'));
      for (const duplicate of ['nw-hero', 'nw-instance-badge', 'Instanz 3', 'Zurück zum Installer', 'Zu EMS Apps', '<h1>']) assert.ok(!html.includes(duplicate), duplicate);
    } else {
      for (const expected of ['nw-hero', 'nw-instance-badge', 'Instanz 3', 'Zurück zum Installer', 'Zu EMS Apps', '<h1>Dynamischer Netzanschluss</h1>', 'href="/installer"']) assert.ok(html.includes(expected), expected);
    }
  });
}

console.log(JSON.stringify({ result: 'PASS', checks, limitation: 'React-Serverrenderer und echte Handler; Browsernavigation und Backend-Rechte werden separat geprüft.' }));
