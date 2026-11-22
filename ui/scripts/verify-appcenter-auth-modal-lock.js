#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Behält den historischen Gate-Namen bei, prüft aber die neue separate
 * Anmeldeseite und die tatsächlich ausgeführte Zugriffssperre im AppCenter.
 * Daten und Wirkung: Original-TS-Funktionen in DOM-Doubles; kein Browsernachweis.
 * Kein Passwortoverlay wird nachgebaut. Hintergrund bleibt inert/aria-hidden,
 * Statusfehler, falsche Rollen, Fokus-/Escapeversuche geben keine Inhalte frei.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const auth = read('src-ts/runtime-executables/www/auth.ts');
const html = read('www/ems-apps.html');
const main = read('src-ts/runtime-executables/main.ts');
assert.match(html, /data-nw-required-capability="appcenter\.open"/);
assert.match(html, /data-nw-required-role="Admin oder Installer"/);
assert.match(main, /requirePageAccessOrRenderLock\(req, res, 'appcenter\.open'/);
assert.doesNotMatch(auth, /type=["']password|nwAuthPassword|loginRuntimeAuth/);

const names = new Set(['hasCapability', 'requiredPageCapability', 'ensureStyles', 'lockPage', 'unlockPage', 'updateNavigation', 'showLogin', 'applyPageAccess']);
const ast = ts.createSourceFile('auth.ts', auth, ts.ScriptTarget.ES2022, true);
const functions = new Map();
function visit(node) {
  if (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) functions.set(node.name.text, node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast); assert.equal(functions.size, names.size, 'all actual gate functions are exercised');

function fixture(framed = false) {
  const nodes = new Map(), redirects = [];
  class Element {
    constructor(tag) {
      this.tagName = tag.toUpperCase(); this.children = []; this.attributes = new Map(); this.handlers = new Map();
      this.inert = false; this.hidden = false; this.style = {};
      const classes = new Set(); this.classList = { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) };
    }
    set id(value) { this._id = value; nodes.set(value, this); } get id() { return this._id; }
    set innerHTML(value) { this.html = value; if (value.includes('nw-auth-actions')) { this.description = new Element('p'); this.actions = new Element('div'); } }
    appendChild(node) { this.children.push(node); return node; } append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    removeAttribute(key) { this.attributes.delete(key); }
    querySelector(selector) { return selector === 'p' ? this.description : selector === '.nw-auth-actions' ? this.actions : null; }
    addEventListener(name, fn) { this.handlers.set(name, fn); }
  }
  const body = new Element('body'); body.setAttribute('data-nw-required-capability', 'appcenter.open');
  const content = new Element('main'), originallyInert = new Element('aside'), script = new Element('script');
  originallyInert.inert = true; originallyInert.setAttribute('aria-hidden', 'true'); body.append(content, originallyInert, script);
  const document = { body, head: new Element('head'), documentElement: new Element('html'), hidden: false,
    createElement: tag => new Element(tag), getElementById: id => nodes.get(id) || null,
    querySelectorAll: () => [], querySelector: selector => selector === '#nwAuthGate .nw-auth-actions' ? nodes.get('nwAuthGate')?.actions : null };
  const location = new URL('https://fixture.invalid/ems-apps.html'); location.replace = value => redirects.push(String(value));
  const window = { location }; window.self = window; window.top = framed ? {} : window;
  const state = { authed: false, role: 'none', capabilities: [], statusError: false, _loaded: false, mode: null };
  const context = vm.createContext({ state, document, window, HTMLElement: Element, URL, Map, Set, refreshCalls: 0 });
  const prefix = 'const background = new Map(); let redirecting = false; let loggingOut = false; const runtimeUrl = path => path; const runtimeRoot = () => "/"; const currentPath = () => "/ems-apps.html"; const refreshStatus = () => { globalThis.refreshCalls++; }; const logout = () => {};\n';
  const expose = '\nglobalThis.apply = applyPageAccess; globalThis.hasCapability = hasCapability;';
  vm.runInContext(ts.transpileModule(prefix + [...functions.values()].join('\n') + expose, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const locked = () => {
    assert.equal(content.inert, true); assert.equal(content.getAttribute('aria-hidden'), 'true');
    assert.equal(document.documentElement.classList.contains('nw-auth-capability-pending'), true);
    assert.equal(nodes.get('nwAuthGate').hidden, false);
  };
  const set = values => { Object.assign(state, { authed: false, role: 'none', capabilities: [], statusError: false, _loaded: true, mode: 'iobroker' }, values); context.apply(); };
  return { state, context, set, locked, nodes, redirects, content, originallyInert, script, document };
}

let checks = 0;
function check(name, fn) { fn(); checks++; console.log('PASS ' + name); }
check('Unbestätigter Start sperrt Hintergrund und lädt kein Passwortformular', () => {
  const f = fixture(); f.context.apply(); f.locked(); assert.equal(f.script.inert, false); assert.equal(f.redirects.length, 0);
  assert.doesNotMatch(f.nodes.get('nwAuthGate').html, /<input|<form|password/i);
  const style = f.nodes.get('nw-auth-styles').textContent;
  assert.match(style, /body>\*:not\(#nwAuthGate\).*visibility:hidden!important;pointer-events:none!important/);
});
check('Statusfehler und Kunden-Wildcards öffnen das AppCenter nicht', () => {
  for (const status of [{ authed: true, role: 'admin', capabilities: ['*'], statusError: true }, { authed: true, role: 'customer', capabilities: ['*', 'appcenter.open'] }, { authed: true, role: 'installer', capabilities: [] }]) {
    const f = fixture(); f.set(status); f.locked(); assert.equal(f.context.hasCapability('appcenter.open'), false);
  }
});
check('Nur bestätigte Fachrolle entsperrt und stellt vorherigen inert-Zustand wieder her', () => {
  for (const role of ['admin', 'installer']) {
    const f = fixture(); f.context.apply(); f.set({ authed: true, role, capabilities: ['appcenter.open'] });
    assert.equal(f.content.inert, false); assert.equal(f.content.getAttribute('aria-hidden'), null);
    assert.equal(f.originallyInert.inert, true); assert.equal(f.originallyInert.getAttribute('aria-hidden'), 'true');
    assert.equal(f.nodes.get('nwAuthGate').hidden, true);
  }
});
check('Außenklick, Escape und erneutes Prüfen besitzen keinen Entsperrpfad', () => {
  const f = fixture(); f.context.apply(); const gate = f.nodes.get('nwAuthGate');
  gate.handlers.get('click')?.({ target: gate }); gate.handlers.get('keydown')?.({ key: 'Escape' });
  f.content.handlers.get('focusin')?.({ target: f.content }); f.locked();
  const retry = gate.actions.children.find(node => node.textContent === 'Erneut prüfen'); assert(retry);
  retry.handlers.get('click')(); assert.equal(f.context.refreshCalls, 1); f.locked();
  assert.equal(gate.actions.children.some(node => /abbrechen|schließen/i.test(node.textContent || '')), false);
});
check('Sitzungsverlust oder verborgenes Dokument sperrt bereits freigegebene Inhalte erneut', () => {
  const f = fixture(); f.context.apply(); f.set({ authed: true, role: 'admin', capabilities: ['*'] });
  f.document.hidden = true; f.context.apply(); f.locked(); f.document.hidden = false;
  f.set({ authed: false }); f.locked(); assert.equal(f.redirects[0], 'https://fixture.invalid/login.html?returnTo=%2Fems-apps.html');
});
check('Ein Frame bietet ausschließlich einen sicheren separaten Loginlink', () => {
  const f = fixture(true); f.set({ authed: false }); f.locked(); assert.equal(f.redirects.length, 0);
  const link = f.nodes.get('nwAuthGate').actions.children.find(node => node.tagName === 'A'); assert(link);
  assert.equal(link.target, '_blank'); assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(link.href, 'https://fixture.invalid/login.html?returnTo=%2Fems-apps.html');
});
console.log('[appcenter-auth-modal-lock] PASS ' + checks + ' original gate-function groups; separate login, role denial and inert/hidden restoration. DOM simulation only, no browser focus/layout claim.');
