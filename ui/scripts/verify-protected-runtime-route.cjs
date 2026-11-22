#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft die echte TSX-Zugangsschranke nach Trennung der Passwortseite.
 * Daten und Wirkung: In-Memory-Transpilierung, deterministischer Hook-/Lifecycle-
 * Host und synthetische Statusantworten; keine Konten, Geräte oder Browser.
 * Der Fachbereich darf kein eigenes Passwortformular mehr anbieten. Die früher
 * hier angesiedelten Passwortfälle liegen nun an der eigenständigen Loginseite;
 * HTTP-Kontoprüfung/Widerruf bleiben in verify-admin8-login und verify-cra-auth.
 * Bei Änderungen: Private Inhalte, Rollen, fehlende Konfiguration, getrennte
 * Anmeldeprofile, späte Antworten, Abmeldung und Unmount gemeinsam prüfen.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpileModule(source, { fileName: filename, reportDiagnostics: true,
  compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
assert.deepEqual((compiled.diagnostics || []).filter(item => item.category === ts.DiagnosticCategory.Error), []);
const denied = { enabled: true, protectWrites: true, configured: true, mode: 'iobroker', authed: false, role: 'none', user: null, capabilities: [], loginUrl: '', logoutUrl: '' };
const admin = { ...denied, authed: true, role: 'admin', user: 'nexowatt', capabilities: ['*'] };
const customer = { ...denied, authed: true, role: 'customer', user: 'kunde', capabilities: ['frontend.open'] };
const installer = { ...denied, authed: true, role: 'installer', user: 'fachkraft', capabilities: ['appcenter.open'] };
const localLogin = 'https://fixture.invalid/adapter/nexowatt-ui.0/login.html';
class RuntimeRequestError extends Error {
  constructor(message, status, payload = {}) { super(message); this.status = status; this.payload = payload; }
}
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
const depsEqual = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Object.is(value, b[index]));

/** Nur React/Browser-I/O simuliert; Zustandsübergänge kommen aus dem Produkt-TSX. */
function fixture(options = {}) {
  let cursor = 0, tree, mounted = true, writes = 0, readCalls = 0, loginUrlCalls = 0, logoutCalls = 0;
  const slots = [], effects = [], intervals = new Set(), events = new Map(), storageWrites = [], loginCalls = [], workerMessages = [];
  let props = { capability: 'appcenter.open', title: 'Installer', allowedRoles: ['admin', 'installer'], children: 'PRIVATE-PAGE-SENTINEL', ...options.props };
  const readQueue = [...(options.reads || [() => Promise.resolve(denied)])];
  const loginUrlQueue = [...(options.loginUrls || [])];
  const controls = { logout: options.logout || (() => Promise.resolve({ ok: true })) };
  const React = {
    createElement(type, properties, ...children) { return { type, props: { ...properties, children } }; },
    createContext: () => ({ Provider: 'context-provider' }), useContext: () => null,
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[index].value, value => { writes++; slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
    },
    useRef(initial) { const index = cursor++; if (!slots[index]) slots[index] = { current: initial }; return slots[index]; },
    useMemo(fn, deps) { const index = cursor++; if (!slots[index] || !depsEqual(slots[index].deps, deps)) slots[index] = { value: fn(), deps }; return slots[index].value; },
    useCallback(fn, deps) { return React.useMemo(() => fn, deps); },
    useEffect(fn, deps) {
      const index = cursor++;
      if (!slots[index] || !depsEqual(slots[index].deps, deps)) {
        const old = slots[index]; slots[index] = { deps, cleanup: undefined };
        effects.push(() => { old?.cleanup?.(); slots[index].cleanup = fn(); });
      }
    },
  };
  const window = {
    location: { search: '?instance=0', origin: 'https://fixture.invalid' },
    navigator: { serviceWorker: { controller: { postMessage(value) { workerMessages.push(value); } } } },
    localStorage: { getItem: () => null, setItem(key, value) { storageWrites.push({ key, value }); } },
    setInterval(fn) { intervals.add(fn); return fn; }, clearInterval(fn) { intervals.delete(fn); },
    addEventListener(name, fn) { if (!events.has(name)) events.set(name, new Set()); events.get(name).add(fn); },
    removeEventListener(name, fn) { events.get(name)?.delete(fn); },
  }; window.parent = window;
  const api = {
    getInstance: () => '0', getErrorMessage: (error, fallback) => error?.message || fallback,
    readRuntimeAuthStatus() { readCalls++; return (readQueue.shift() || (() => Promise.resolve(denied)))(); },
    // Falls der Fachbereich wieder selbst Passwörter übernimmt, fällt der Test.
    loginRuntimeAuth(...args) { loginCalls.push(args); throw new Error('No nested password login permitted'); },
    resolveRuntimeLoginUrl() { loginUrlCalls++; return (loginUrlQueue.shift() || (() => Promise.resolve(localLogin)))(); },
    logoutRuntimeAuth() { logoutCalls++; return controls.logout(); },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled.outputText, { module, exports: module.exports, window, URL, URLSearchParams,
    require(name) {
      if (name === 'react') return React;
      if (name.endsWith('/adminConnection')) return api;
      if (name === './PageShell' || name === '../components/EmbeddedEmsFrame') return { __esModule: true, default: name };
      throw new Error('Ungeplanter Import: ' + name);
    },
  }, { filename });
  function render() { cursor = 0; tree = module.exports.default(props); for (const effect of effects.splice(0)) effect(); return tree; }
  function walk(node, match) {
    if (!node || typeof node !== 'object') return null;
    if (match(node)) return node;
    for (const child of node.props?.children || []) {
      for (const entry of Array.isArray(child) ? child : [child]) { const found = walk(entry, match); if (found) return found; }
    }
    return null;
  }
  function text(node = tree) {
    if (typeof node === 'string') return node;
    if (!node || typeof node !== 'object') return '';
    return (node.props?.children || []).flat().map(text).join(' ');
  }
  function node(match) { render(); const found = walk(tree, match); assert(found, 'Benötigtes UI-Element vorhanden'); return found; }
  render();
  return {
    controls, readQueue, loginUrlQueue, loginCalls, storageWrites, workerMessages, render, text,
    get readCalls() { return readCalls; }, get writes() { return writes; }, get loginUrlCalls() { return loginUrlCalls; }, get logoutCalls() { return logoutCalls; },
    get hasPrivateContent() { render(); return text().includes('PRIVATE-PAGE-SENTINEL'); },
    get hasCredentialForm() { render(); return !!walk(tree, n => n.type === 'form' || n.type === 'input' || n.props?.id === 'nwAuthPassword'); },
    get loginLink() { render(); return walk(tree, n => n.type === 'a')?.props || null; },
    async ready() { await flush(); render(); },
    refresh() { return node(n => n.type === 'button' && text(n) === 'Erneut prüfen').props.onClick(); },
    logout() { return node(n => n.type === 'button' && text(n) === 'Abmelden').props.onClick(); },
    tick() { for (const fn of intervals) fn(); }, focus() { for (const fn of events.get('focus') || []) fn(); },
    changeProps(next) { props = { ...props, ...next }; render(); },
    unmount() { mounted = false; for (const slot of slots) slot?.cleanup?.(); assert.equal(intervals.size, 0); assert.equal(events.get('focus')?.size || 0, 0); },
    get mounted() { return mounted; },
  };
}
let checks = 0;
async function check(name, fn) { await fn(); checks++; console.log('PASS', name); }
(async () => {
  await check('Fachseite bleibt gesperrt und fragt keine Zugangsdaten ab', async () => {
    const f = fixture(); assert.equal(f.hasPrivateContent, false); await f.ready();
    assert.equal(f.hasPrivateContent, false); assert.equal(f.hasCredentialForm, false);
    assert(f.text().includes('eigenes Benutzerkonto')); assert.equal(f.loginLink.href, localLogin);
    assert.equal(f.loginLink.target, '_blank'); assert.match(f.loginLink.rel, /noopener/); assert.match(f.loginLink.rel, /noreferrer/);
    assert.equal(f.loginCalls.length, 0); assert.equal(f.storageWrites.length, 0);
  });
  await check('Nur bestätigter Admin oder Installer mit Capability öffnet Fachinhalte', async () => {
    for (const status of [admin, installer]) { const f = fixture({ reads: [() => Promise.resolve(status)] }); await f.ready(); assert.equal(f.hasPrivateContent, true); assert.equal(f.hasCredentialForm, false); }
    for (const status of [customer, { ...installer, capabilities: [] }, { ...customer, capabilities: ['*'] }]) {
      const f = fixture({ reads: [() => Promise.resolve(status)] }); await f.ready(); assert.equal(f.hasPrivateContent, false); assert(f.text().includes('nicht die erforderliche Rolle'));
    }
  });
  await check('Lizenz und SMTP bleiben selbst bei Installer-Wildcard Adminbereiche', async () => {
    for (const capability of ['license.manage', 'notifications.manage']) {
      const f = fixture({ props: { capability }, reads: [() => Promise.resolve({ ...installer, capabilities: ['*'] })] }); await f.ready(); assert.equal(f.hasPrivateContent, false);
    }
  });
  await check('Statusfehler bleibt Verbindungsfehler; kein Passwort- oder Rollenurteil', async () => {
    const f = fixture({ reads: [() => Promise.reject(new Error('UI-Verbindung nicht erreichbar'))] }); await f.ready();
    assert(f.text().includes('Berechtigungsprüfung nicht erreichbar')); assert(!f.text().includes('Rolle fehlt')); assert.equal(f.hasPrivateContent, false); assert.equal(f.loginLink, null);
  });
  await check('Proxy401, Proxy403 und Rate-Limit geben keine Inhalte frei und behalten ihre Fehleraussage', async () => {
    for (const [code, message] of [[401, 'Bitte erneut am ioBroker-Admin anmelden.'], [403, 'Admin-Proxy erfordert Administratorrechte.'], [429, 'Zu viele fehlgeschlagene Anmeldeversuche.']]) {
      const f = fixture({ reads: [() => Promise.reject(new RuntimeRequestError(message, code))] }); await f.ready();
      assert(f.text().includes(message)); assert.equal(f.hasPrivateContent, false); assert.equal(f.hasCredentialForm, false);
    }
  });
  await check('Status nach Anmeldung im eigenen Fenster wird erst nach frischer Prüfung freigegeben', async () => {
    const f = fixture(); await f.ready(); f.readQueue.push(() => Promise.resolve(admin));
    assert.equal(f.hasPrivateContent, false); f.focus(); await f.ready(); assert.equal(f.hasPrivateContent, true);
    assert.equal(f.loginCalls.length, 0); assert.equal(f.storageWrites.length, 0);
  });
  await check('Späte erfolgreiche Statusantwort entsperrt nach Abmeldung nicht erneut', async () => {
    const old = deferred(), logout = deferred(); const f = fixture({ reads: [() => Promise.resolve(admin)], logout: () => logout.promise }); await f.ready();
    f.readQueue.push(() => old.promise); f.tick(); const pending = f.logout(); assert.equal(f.hasPrivateContent, false);
    old.resolve(admin); await f.ready(); assert.equal(f.hasPrivateContent, false); logout.resolve({ ok: true }); await pending; f.render();
    assert(f.text().includes('Abgemeldet.')); const before = f.readCalls; f.tick(); f.focus(); assert.equal(f.readCalls, before);
    assert.equal(f.workerMessages.length, 1); assert.equal(f.workerMessages[0].type, 'NW_AUTH_LOGOUT');
  });
  await check('Alte Netzwerkfehler überschreiben keine neu bestätigte Routengeneration', async () => {
    const old = deferred(); const f = fixture(); await f.ready(); f.readQueue.push(() => old.promise); f.tick();
    f.readQueue.push(() => Promise.resolve(admin)); f.changeProps({ title: 'Lizenz', capability: 'license.manage', requiredRole: 'Admin' }); await f.ready(); assert.equal(f.hasPrivateContent, true);
    old.reject(new Error('alter Timeout')); await f.ready(); assert.equal(f.hasPrivateContent, true);
  });
  await check('Überlappende Statusabfragen durch Fokus, Poll und Button starten nicht parallel', async () => {
    const result = deferred(); const f = fixture(); await f.ready(); f.readQueue.push(() => result.promise); f.refresh();
    const before = f.readCalls; f.tick(); f.focus(); f.refresh(); assert.equal(f.readCalls, before); result.resolve(denied); await f.ready(); assert.equal(f.hasPrivateContent, false);
  });
  await check('Während Abmeldung starten keine weiteren Statusabfragen', async () => {
    const logout = deferred(); const f = fixture({ reads: [() => Promise.resolve(admin)], logout: () => logout.promise }); await f.ready();
    const pending = f.logout(); const before = f.readCalls; f.tick(); f.focus(); f.refresh(); assert.equal(f.readCalls, before); assert.equal(f.logoutCalls, 1);
    logout.resolve({ ok: true }); await pending; assert.equal(f.hasPrivateContent, false);
  });
  await check('Fehlgeschlagene Serverabmeldung wird nicht als bestätigt ausgegeben', async () => {
    const f = fixture({ reads: [() => Promise.resolve(admin)], logout: () => Promise.reject(new Error('Timeout')) }); await f.ready(); await f.logout(); f.render();
    assert(f.text().includes('Abmeldung konnte nicht bestätigt werden')); assert.equal(f.hasPrivateContent, false);
    const before = f.readCalls; f.tick(); f.focus(); assert.equal(f.readCalls, before); assert.equal(f.workerMessages.length, 0);
  });
  await check('Unmount verwirft späte Statusantworten und entfernt Poll-/Fokuslistener', async () => {
    const result = deferred(); const f = fixture({ reads: [() => result.promise] }); f.unmount(); const writes = f.writes;
    result.resolve(admin); await flush(); assert.equal(f.writes, writes); assert.equal(f.storageWrites.length, 0);
  });
  await check('Unmount verwirft eine spät aufgelöste Anmelde-URL', async () => {
    const link = deferred(); const f = fixture({ loginUrls: [() => link.promise] }); await f.ready(); f.unmount(); const writes = f.writes;
    link.resolve(localLogin); await flush(); assert.equal(f.writes, writes);
  });
  await check('Unmount während lokaler Logout-URL-Auflösung erzeugt keine späten UI-Schreibwirkungen', async () => {
    const link = deferred(); const f = fixture({ reads: [() => Promise.resolve(admin)], loginUrls: [() => link.promise] }); await f.ready();
    const pending = f.logout(); await flush(); f.unmount(); const writes = f.writes; link.resolve(localLogin); await pending;
    assert.equal(f.writes, writes);
  });
  await check('Routenwechsel beendet alte Generation und prüft die neue Capability', async () => {
    const old = deferred(); const f = fixture({ reads: [() => old.promise] });
    f.readQueue.push(() => Promise.resolve(installer)); f.changeProps({ capability: 'license.manage', requiredRole: 'Admin' }); await f.ready();
    old.resolve(admin); await f.ready(); assert.equal(f.hasPrivateContent, false); assert(f.text().includes('nicht die erforderliche Rolle'));
  });
  await check('Auth=false und fehlende Profilkonfiguration öffnen auch mit Adminstatus nichts', async () => {
    for (const value of [{ ...admin, enabled: false }, { ...admin, configured: false }]) {
      const f = fixture({ reads: [() => Promise.resolve(value)] }); await f.ready(); assert.equal(f.hasPrivateContent, false);
      if (value.configured === false) assert.equal(f.loginLink, null);
    }
  });
  await check('EOS-Profil bietet nur den bestätigten zentralen HTTPS-Link an', async () => {
    const f = fixture({ reads: [() => Promise.resolve({ ...denied, mode: 'eos', loginUrl: 'https://accounts.fixture.invalid/login' })] }); await f.ready();
    assert.equal(f.loginLink.href, 'https://accounts.fixture.invalid/login'); assert(f.text().includes('Zentral anmelden')); assert.equal(f.hasCredentialForm, false); assert.equal(f.loginUrlCalls, 0);
  });
  await check('Unsichere zentrale Ziele erzeugen keinen Link und keinen lokalen Profil-Fallback', async () => {
    for (const loginUrl of ['javascript:alert(1)', 'data:text/html,x', '//foreign.invalid/login', 'https://user:secret@foreign.invalid/login', 'http://foreign.invalid/login']) {
      const f = fixture({ reads: [() => Promise.resolve({ ...denied, mode: 'eos', loginUrl })] }); await f.ready();
      assert.equal(f.loginLink, null, loginUrl); assert.equal(f.loginUrlCalls, 0); assert.equal(f.hasPrivateContent, false);
    }
  });
  await check('Zentrale Abmeldung sperrt sofort und verlangt den bestätigten externen Schritt', async () => {
    const f = fixture({ reads: [() => Promise.resolve({ ...admin, mode: 'eos', logoutUrl: 'https://accounts.fixture.invalid/logout' })] }); await f.ready(); await f.logout(); f.render();
    assert.equal(f.hasPrivateContent, false); assert.equal(f.loginLink.href, 'https://accounts.fixture.invalid/logout'); assert(f.text().includes('Zentral abmelden'));
    const before = f.readCalls; f.tick(); assert.equal(f.readCalls, before); assert.equal(f.loginUrlCalls, 0);
  });
  await check('Fehler beim Auflösen der lokalen Loginseite bleiben sichtbar und gesperrt', async () => {
    const f = fixture({ loginUrls: [() => Promise.reject(new Error('Runtimeadresse fehlt'))] }); await f.ready();
    assert.equal(f.hasPrivateContent, false); assert.equal(f.loginLink, null); assert(f.text().includes('Berechtigungsprüfung nicht erreichbar'));
  });
  console.log(JSON.stringify({ result: 'PASS', checks, node: process.version,
    sourceSha256: crypto.createHash('sha256').update(source).digest('hex'),
    scope: 'Original TSX handlers with deterministic hook/lifecycle host and async API fixtures; no live Admin or browser test' }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
