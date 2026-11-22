#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
// Exercise the shipped Express server and middleware; only ioBroker storage,
// credentials and SMTP transport are fixtures. No real mail or device writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const vm = require('node:vm');
const realExpress = require('express');

function loadAdapter() {
  const filename = path.join(__dirname, 'verify-storage-farm-dispatch-recovery.js');
  const fixture = new Module(filename, module);
  fixture.filename = filename;
  fixture.paths = Module._nodeModulePaths(__dirname);
  const source = fs.readFileSync(filename, 'utf8');
  const originalLoad = Module._load;
  try {
    fixture._compile(source.slice(0, source.indexOf('(async () => {')) + '\nmodule.exports = { internal, foreign };', filename);
    const fixtureLoad = Module._load;
    const express = Object.assign(() => {
      const app = realExpress();
      const listen = app.listen.bind(app);
      app.listen = (_port, _bind, callback) => listen(0, '127.0.0.1', callback);
      return app;
    }, realExpress);
    Module._load = function (request, ...args) {
      return request === 'express' ? express : fixtureLoad.call(this, request, ...args);
    };
    return { factory: require('../main'), ...fixture.exports };
  } finally { Module._load = originalLoad; }
}
const { factory, internal } = loadAdapter();

async function createHarness({ authEnabled = true, policy = 'session', authConfig = {}, accessControl = {} } = {}) {
  const testPassword = require('node:crypto').randomBytes(32).toString('hex');
  internal.clear();
  const adapter = factory({});
  adapter.config = { auth: { enabled: authEnabled, ...authConfig }, accessControl: { customerWritePolicy: policy, ...accessControl },
    smartHomeConfig: { version: 3, floors: [], rooms: [], functions: [], devices: [], pages: [], scenes: [], meta: {} } };
  adapter._nwLicenseOk = true;
  adapter._nwLicenseInfo = { ok: true, edition: 'hems', type: 'full' };
  adapter._nwSystemUuid = 'private-fixture-uuid';
  adapter._nwRefreshLicenseFromConfiguredKey = async () => {};
  adapter._nwGetConfiguredLicenseKey = async () => ({ key: 'private-fixture-license' });
  const accounts = new Map(['admin', 'installer', 'kunde'].map(user => [user, { _id: 'system.user.' + user, type: 'user', common: { name: user, enabled: true, password: require('node:crypto').randomBytes(32).toString('hex') } }]));
  const accountPasswords = new Map([...accounts.keys()].map(user => ['system.user.' + user, testPassword]));
  adapter.checkPassword = (user, password, done) => done(accountPasswords.has(user) && accountPasswords.get(user) === password, user);
  // Pro Konto getrennte künstliche Passwörter ermöglichen positive und negative
  // Mehrbenutzertests, ohne reale Zugangsdaten oder eigene Hashprüfung zu verwenden.
  const addAccount = (user, { name = user, password = require('node:crypto').randomBytes(32).toString('hex') } = {}) => {
    accounts.set(user, { _id: 'system.user.' + user, type: 'user', common: { name, enabled: true, password: require('node:crypto').randomBytes(32).toString('hex') } });
    accountPasswords.set('system.user.' + user, password);
    return password;
  };
  // Öffentlicher Controllervertrag: Anzeigename -> kanonische ID, kein eigener ID-Fallback.
  adapter.getUserID = async name => {
    for (const account of accounts.values()) if (account.common.name === name) return account._id;
    return undefined;
  };
  const groups = new Map();
  const setGroup = (id, members) => groups.set(id, { _id: id, type: 'group', common: { name: id.slice('system.group.'.length), members: members.slice() } });
  setGroup('system.group.administrator', ['system.user.admin']);
  setGroup('system.group.installer', ['system.user.installer']);
  setGroup('system.group.user', ['system.user.kunde']);
  const originalObjectRead = adapter.getForeignObjectAsync.bind(adapter);
  adapter.getForeignObjectAsync = async id => String(id).startsWith('system.user.') ? accounts.get(String(id).slice(12)) || null : (String(id).startsWith('system.group.') ? groups.get(id) || null : originalObjectRead(id));
  adapter.getForeignObjectsAsync = async () => ({ 'fixture.light': { common: { name: 'Testlicht', type: 'boolean', role: 'switch', read: true, write: true } } });
  adapter.scheduleDerivedFlowUpdate = () => {};
  const saved = [];
  adapter.persistInstallerConfigToState = async patch => { saved.push(JSON.parse(JSON.stringify(patch))); };
  const mailWrites = [];
  adapter._getNotificationMail = () => ({ init: async () => {}, publicConfig: () => ({ enabled: false, passwordSet: false, from: 'info@nexowatt.com' }),
    configure: async config => { mailWrites.push(config); return { enabled: false, passwordSet: false }; } });
  await adapter.startServer();
  const base = `http://127.0.0.1:${adapter.server.address().port}`;
  // Sitzung und CSRF stammen ausschließlich aus echten HTTP-Antworten. Der
  // Harness legt weder Tokens an noch erfindet er Auth-/Statusdaten.
  const sessionCsrf = new Map();
  const cookieHeader = token => `${adapter._nwAuthCookieName}=${encodeURIComponent(token)}`;
  function tokenOf(result) {
    const cookies = result.response.headers.getSetCookie();
    const prefix = adapter._nwAuthCookieName + '=';
    const sessionCookie = cookies.map(value => value.split(';')[0]).find(value => value.startsWith(prefix));
    assert.ok(sessionCookie, 'successful login issues the instance-bound session cookie');
    const token = decodeURIComponent(sessionCookie.slice(prefix.length));
    assert.ok(token, 'session cookie contains an opaque token');
    if (typeof result.data?.csrfToken === 'string') sessionCsrf.set(token, result.data.csrfToken);
    return token;
  }
  async function request(url, { token, method = 'GET', body, headers = {}, csrf = true, redirect = 'follow' } = {}) {
    const write = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
    if (token && write && csrf === true && !sessionCsrf.has(token)) {
      const status = await fetch(base + '/api/session/me', { headers: { Cookie: cookieHeader(token) }, redirect: 'manual' });
      const data = await status.json();
      if (status.ok && data.authed === true && typeof data.csrfToken === 'string') sessionCsrf.set(token, data.csrfToken);
    }
    const csrfToken = typeof csrf === 'string' ? csrf : csrf && sessionCsrf.get(token);
    const response = await fetch(base + url, { method, redirect, headers: {
      ...(token ? { Cookie: cookieHeader(token) } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token && write && csrfToken ? { 'X-NW-CSRF': csrfToken } : {}), ...headers,
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
    const text = await response.text();
    let data; try { data = JSON.parse(text); } catch {}
    const result = { status: response.status, text, data, response, headers: response.headers };
    if (response.headers.getSetCookie().some(value => value.startsWith(adapter._nwAuthCookieName + '=')) && data?.authed === true) tokenOf(result);
    return result;
  }
  async function login(user) {
    const result = await request(user === 'kunde' ? '/api/auth/login' : '/api/strict-auth/login', { method: 'POST', body: { user, password: testPassword } });
    assert.equal(result.status, 200, result.text);
    return tokenOf(result);
  }
  const close = async () => {
    adapter.server.closeAllConnections();
    await new Promise(resolve => adapter.server.close(resolve));
  };
  return { adapter, base, request, login, tokenOf, cookieHeader, saved, mailWrites, accounts, groups, testPassword, accountPasswords, addAccount, setGroup, close };
}

/** Denial-Redirects explizit prüfen, niemals eine Loginseite als Erfolg deuten. */
async function assertDenied(h, url, token, status) {
  let result = await h.request(url, { token, redirect: 'manual' });
  const noSecrets = row => assert.ok(!/private-fixture-(uuid|license)|id="mailHost"/.test(row.text), 'no sensitive response before authorization');
  noSecrets(result);
  if (status === 401 && !url.startsWith('/api/')) {
    assert.equal(result.status, 303, url);
    assert.match(result.headers.get('location'), /^\/login\.html\?returnTo=/, url);
    return;
  }
  if (status === 403 && [301, 302].includes(result.status)) {
    const location = result.headers.get('location');
    assert.match(location, /^\/(?:license\.html|smarthome-config(?:\.html)?|logic(?:\.html)?)(?:[?#]|$)/, 'only canonical protected-page redirect');
    result = await h.request(location, { token, redirect: 'manual' });
    noSecrets(result);
  }
  assert.equal(result.status, status, url);
}


/**
 * Die echte Frontend-Freigabe bleibt unabhängig vom offenen Kundenbetrieb.
 * Prüft beide Einrichtungseinstiege im SmartHome-Bereich einschließlich
 * Rollenwechsel, fehlendem Strict-Status und alter Kunden-Wildcard.
 * Es werden weder Netzwerkverbindungen noch Gerätebefehle ausgelöst.
 */
function verifySmartHomeNavigation() {
  const root = path.join(__dirname, '..');
  const settings = fs.readFileSync(path.join(root, 'www/settings.html'), 'utf8');
  const smartHome = fs.readFileSync(path.join(root, 'www/smarthome.html'), 'utf8');
  assert.doesNotMatch(settings, /href=["'][^"']*smarthome-config|id=["']openSmartHomeSettingsBtn/, 'general settings must contain no technical SmartHome entry');
  const links = [...smartHome.matchAll(/<a\b[^>]*data-nw-config-link="smarthome\.configure"[^>]*>/g)];
  assert.equal(links.length, 2, 'SmartHome contains menu and visible page-action entry for experts');
  for (const [link] of links) assert.match(link, /hidden[^>]*display:none/, 'setup entry starts hidden before auth status');
  const source = fs.readFileSync(path.join(root, 'src-ts/runtime-executables/www/auth.ts'), 'utf8');
  const ts = require('typescript');
  const ast = ts.createSourceFile('auth.ts', source, ts.ScriptTarget.ES2022, true);
  const functions = new Map();
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && ['updateNavigation', 'hasCapability'].includes(node.name?.text)) functions.set(node.name.text, node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(functions.size, 2, 'actual frontend navigation and role guards available');
  const elements = links.map(() => ({ hidden: true, style: { display: 'none', removeProperty(key) { delete this[key]; } }, getAttribute: () => 'smarthome.configure' }));
  const context = vm.createContext({ document: { querySelectorAll: () => elements, querySelector: () => null } });
  const navigation = 'let state;\n' + [...functions.values()].join('\n') + '\nglobalThis.update = info => { state = Object.assign({authed:false,role:"none",capabilities:[],statusError:false}, info || {}); updateNavigation(); };';
  vm.runInContext(ts.transpileModule(navigation, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  for (const [info, visible] of [
    [null, false],
    [{ authed: false, role: 'admin', capabilities: ['*'] }, false],
    [{ authed: true, role: 'customer', capabilities: ['*', 'smarthome.configure'] }, false],
    [{ authed: true, role: 'installer', capabilities: ['smarthome.configure'] }, true],
    [{ authed: true, role: 'installer', capabilities: [] }, false],
    [{ authed: true, role: 'admin', capabilities: ['*'] }, true],
    [{ authed: true, role: 'admin', capabilities: ['*'], statusError: true }, false],
    [null, false],
  ]) {
    context.update(info);
    for (const element of elements) {
      assert.equal(element.hidden, !visible);
      assert.equal(element.style.display === 'none', !visible);
    }
  }
}

async function verify() {
  verifySmartHomeNavigation();
  for (const authEnabled of [true, false]) {
    const h = await createHarness({ authEnabled });
    try {
      const admin = await h.login('admin');
      const installer = await h.login('installer');
      const customer = await h.login('kunde');
      // Old sessions with formerly granted license.manage (even wildcard) must
      // lose admin-only access without requiring logout or waiting for expiry.
      h.adapter._authSessions.set('legacy-installer', { role: 'installer', capabilities: ['*', 'license.manage'], exp: Date.now() + 60000 });
      h.adapter._authSessions.set('expired-admin', { role: 'admin', capabilities: ['*'], exp: Date.now() - 1 });
      for (const [token, code] of [[undefined, 401], [installer, 403], ['legacy-installer', 401], ['expired-admin', 401], ...(customer ? [[customer, 403]] : [])]) {
        for (const url of ['/api/license/info', '/api/installer/notification-mail', '/license.html', '/static/license.html', '/mail-setup/#/notification-mail']) {
          await assertDenied(h, url, token, code);
        }
        for (const url of ['/api/license/save', '/api/installer/notification-mail']) {
          assert.equal((await h.request(url, { token, method: 'POST', body: { licenseKey: 'changed', host: 'changed' } })).status, code, url);
        }
      }
      assert.equal(h.mailWrites.length, 0);
      assert.equal((await h.request('/api/license/info', { token: admin })).data.uuid, 'private-fixture-uuid');
      assert.equal((await h.request('/mail-setup/', { token: admin })).status, 200);
      assert.equal((await h.request('/api/installer/notification-mail', { token: admin, method: 'POST', body: { enabled: false } })).status, 200);
      assert.equal(h.mailWrites.length, 1);
      const features = await h.request('/api/license/features', { token: installer });
      assert.equal(features.status, 200);
      assert.equal(features.data.maxStorages, 2);
      assert.ok(!/private-fixture|licenseKey|uuid/.test(features.text), 'installer feature limits contain no license secret');
      assert.equal((await h.request('/ems-apps.html', { token: installer })).status, 200);
      assert.equal((await h.request('/api/strict-auth/status', { token: installer })).data.capabilities.includes('license.manage'), false);
      // Einrichtung kann beliebige DPs zuweisen: weder Kunden noch offene
      // Bedienung oder alte Wildcard-Sessions dürfen diese APIs freigeben.
      h.adapter._authSessions.set('legacy-customer', { role: 'customer', capabilities: ['*', 'smarthome.configureCustomer', 'nexologic.configureCustomer'], exp: Date.now() + 60000 });
      h.adapter._authSessions.set('expired-installer', { role: 'installer', capabilities: ['*'], exp: Date.now() - 1 });
      const readRoutes = ['/smarthome-config.html', '/smarthome-config', '/static/smarthome-config.html',
        '/static/%73marthome-config.html', '/static/smarthome%2dconfig.html', '/static//smarthome-config.html', '/static/%5csmarthome-config.html', '/static/%6cogic.html',
        '/logic.html', '/logic', '/static/logic.html', '/api/smarthome/config', '/api/smarthome/dpsearch?q=fixture',
        '/api/smarthome/dpget?id=fixture.light', '/api/smarthome/type-detect', '/api/object/tree', '/api/smarthome/object/tree',
        '/api/smarthome/logic-clocks', '/api/logic/blocks', '/api/logic/editor', '/api/installer/config'];
      const writeRoutes = ['/api/smarthome/config', '/api/smarthome/logic-clocks', '/api/logic/editor', '/api/smarthome/dpset', '/api/installer/config'];
      const before = h.saved.length;
      for (const [token, code] of [[undefined, 401], ['legacy-customer', 401], ['expired-installer', 401], ...(customer ? [[customer, 403]] : [])]) {
        for (const url of readRoutes) await assertDenied(h, url, token, code);
        for (const url of writeRoutes) assert.equal((await h.request(url, { token, method: 'POST', body: { config: h.adapter.config.smartHomeConfig, id: 'fixture.light', val: true } })).status, code, url);
      }
      assert.equal(h.saved.length, before, 'denied writes never persist');
      const config = { ...h.adapter.config.smartHomeConfig, floors: [{ id: 'eg', name: 'Erdgeschoss' }], rooms: [{ id: 'wohnzimmer', name: 'Wohnzimmer', floorId: 'eg' }] };
      for (const token of [installer, admin]) {
        for (const [url, target] of [['/static/smarthome-config.html', '/smarthome-config.html'], ['/static/%73marthome-config.html', '/smarthome-config.html'], ['/static/%5csmarthome-config.html', '/smarthome-config.html'], ['/static/logic.html', '/logic.html']]) {
          const alias = await h.request(url, { token, redirect: 'manual' });
          assert.equal(alias.status, 302, url); assert.equal(alias.headers.get('location'), target, url);
        }
        for (const url of ['/smarthome-config.html', '/static/smarthome-config.html', '/static/%73marthome-config.html', '/static//smarthome-config.html', '/static/%5csmarthome-config.html', '/logic.html', '/static/logic.html', '/static/%6cogic.html', '/api/smarthome/dpsearch?q=fixture']) {
          assert.equal((await h.request(url, { token })).status, 200, url);
        }
        const save = await h.request('/api/smarthome/config', { token, method: 'POST', body: { config } });
        assert.equal(save.status, 200, save.text); assert.equal(save.data.persisted, true);
        assert.equal(h.saved.at(-1).smartHomeConfig.rooms[0].name, 'Wohnzimmer');
        assert.equal((await h.request('/api/smarthome/config', { token })).data.config.rooms[0].name, 'Wohnzimmer');
      }
      // Angemeldete Kunden erreichen die Bedienung, auch wenn Alt-Konfiguration
      // auth=false enthält. Anonyme Seitenzugriffe bleiben gesperrt.
      for (const url of ['/smarthome.html', '/static/smarthome.html', '/static/%73marthome.html', '/static//smarthome.html', '/static/smarthome.js', '/static/styles.css']) {
        assert.equal((await h.request(url, { token: customer })).status, 200, url);
      }
      if (customer) {
        const layout = await h.request('/api/smarthome/layout', { token: customer });
        assert.equal(layout.status, 200);
        assert.equal(layout.data.config.rooms[0].name, 'Wohnzimmer');
        for (const key of ['devices', 'scenes', 'meta']) assert.equal(key in layout.data.config, false, key);
        assert.equal((await h.request('/api/smarthome/layout')).status, 401);
        const writes = [];
        h.adapter.smartHomeDevices = [{ id: 'fixture-light', type: 'switch', io: { switch: { readId: 'fixture.light', writeId: 'fixture.light' } }, behavior: {} }];
        h.adapter.setForeignStateAsync = async (...args) => { writes.push(args); };
        assert.equal((await h.request('/api/smarthome/toggle', { token: customer, csrf: false, method: 'POST', body: { id: 'fixture-light', value: true } })).status, 403, 'session without CSRF cannot operate devices');
        assert.equal(writes.length, 0);
        assert.equal((await h.request('/api/smarthome/toggle', { token: customer, method: 'POST', body: { id: 'fixture-light', value: true } })).status, 200, 'customer operates configured device');
        assert.equal(writes.length, 1); assert.equal(writes[0][0], 'fixture.light');
        assert.equal((await h.request('/api/smarthome/toggle', { token: customer, method: 'POST', body: { id: 'arbitrary.dp', value: true } })).status, 404);
        h.adapter.smartHomeDevices[0].behavior.readOnly = true;
        assert.equal((await h.request('/api/smarthome/toggle', { token: customer, method: 'POST', body: { id: 'fixture-light', value: true } })).status, 403);
        assert.equal(writes.length, 1, 'no arbitrary or read-only writes');
      }
      h.adapter._nwLicenseOk = false;
      assert.equal((await h.request('/license.html', { token: admin })).status, 200, 'admin can activate an unlicensed system');
      assert.equal((await h.request('/api/license/info', { token: admin })).status, 200);
      assert.equal((await h.request('/api/license/info', { token: installer })).status, 403);
    } finally { await h.close(); }
  }
  for (const policy of ['all', 'lan']) {
    const h = await createHarness({ authEnabled: false, policy });
    try {
      assert.equal((await h.request('/api/smarthome/config', { method: 'POST', body: { config: h.adapter.config.smartHomeConfig } })).status, 401, `${policy} customer policy never grants setup rights`);
      assert.equal((await h.request('/api/smarthome/layout')).status, 401, `${policy} never opens anonymous customer data`);
      await assertDenied(h, '/smarthome.html', undefined, 401);
      const customer = await h.login('kunde');
      assert.equal((await h.request('/api/smarthome/layout', { token: customer })).status, 200, `${policy} still permits authenticated customer navigation`);
      assert.equal((await h.request('/api/installer/notification-mail')).status, 401);
    } finally { await h.close(); }
  }
  console.log('[1.0.9 access] OK: real HTTP server, Admin/Installer/customer roles, direct URLs, legacy/expired sessions, auth-disabled, unlicensed activation, Installer/Admin save/reload, customer layout/device control, SmartHome-only setup navigation, encoded static path guards, setup/DP/logic denial and feature limits.');
}
module.exports = { createHarness };
if (require.main === module) verify().catch(error => { console.error(error); process.exitCode = 1; });
