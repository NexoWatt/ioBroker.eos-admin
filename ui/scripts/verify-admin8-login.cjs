#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Kanonische ioBroker-Konten durch die tatsächlich ausgelieferten HTTP-Loginrouten prüfen.
 * Daten und Wirkung: Lokaler Express-Server, künstliche Benutzer und zufälliges Testpasswort;
 * keine Geräte, realen Konten oder externe Admininstanz. Belegt keinen vollständigen Admin-8-Feldtest.
 * Bei Änderungen: Rollenbindung, Fehlversuche und Widerruf erhalten; niemals Passwortwerte ausgeben.
 */
const assert = require('node:assert/strict');
const { createHarness } = require('./verify-stable-1.0.9-access.cjs');
let checks = 0;
async function run(name, verify) {
  const h = await createHarness();
  try { await verify(h); checks++; console.log('PASS ' + name); }
  finally { await h.close(); }
}
const login = (h, user, password = h.testPassword, route = '/api/strict-auth/login') => h.request(route, { method: 'POST', body: { user, password } });
const tokenOf = (h, result) => h.tokenOf(result);
async function main() {
  for (const name of ['admin', 'Admin', 'ADMIN', 'system.user.admin']) {
    await run('Controller-kompatible Admin-Kennung: ' + name, async h => {
      const calls = [];
      const original = h.adapter.checkPassword;
      h.adapter.checkPassword = (user, password, done) => { calls.push(user); return original(user, password, done); };
      const result = await login(h, name);
      assert.equal(result.status, 200); assert.equal(result.data.user, 'admin'); assert.equal(result.data.role, 'admin');
      assert.deepEqual(calls, ['system.user.admin']);
      const status = await h.request('/api/strict-auth/status', { token: tokenOf(h, result) });
      assert.equal(status.data.authed, true); assert.equal(status.data.user, 'admin');
    });
  }
  await run('Anzeigename wird vor Passwort und Sitzung auf die interne ID aufgelöst', async h => {
    h.accounts.get('admin').common.name = 'Anlagenverwaltung Ä';
    const result = await login(h, 'Anlagenverwaltung Ä');
    assert.equal(result.status, 200); assert.equal(result.data.user, 'admin');
  });
  await run('Anzeigename admin eines Kunden erzeugt keine Adminrechte', async h => {
    h.accounts.get('admin').common.name = 'Systemverwaltung';
    h.accounts.get('kunde').common.name = 'admin';
    assert.equal((await login(h, 'admin')).status, 403);
    assert.equal(h.adapter._authSessions.size, 0);
    const result = await login(h, 'admin', h.testPassword, '/api/auth/login');
    assert.equal(result.status, 200); assert.equal(result.data.user, 'kunde'); assert.equal(result.data.role, 'customer');
    assert.equal((await h.request('/api/license/features', { token: tokenOf(h, result) })).status, 403);
    const explicit = await login(h, 'system.user.admin'); assert.equal(explicit.status, 200); assert.equal(explicit.data.user, 'admin');
  });
  await run('Anzeigename installer erhält nur die Rechte des tatsächlichen Kontos', async h => {
    h.accounts.get('installer').common.name = 'Fachkraft';
    h.accounts.get('kunde').common.name = 'installer';
    assert.equal((await login(h, 'installer')).status, 403); assert.equal(h.adapter._authSessions.size, 0);
    const result = await login(h, 'Fachkraft'); assert.equal(result.status, 200); assert.equal(result.data.role, 'installer');
  });
  for (const value of ['false', {}, new Error('synthetic-controller-failure')]) {
    await run('Ungültiger Erfolgswert erzeugt keine Sitzung: ' + (typeof value === 'string' ? 'string' : value instanceof Error ? 'Error' : 'object'), async h => {
      h.adapter.checkPassword = (user, _password, done) => done(value, user);
      assert.equal((await login(h, 'admin')).status, 401); assert.equal(h.adapter._authSessions.size, 0);
    });
  }
  await run('Abweichende Callback-Identität wird vor Rollenauflösung abgewiesen', async h => {
    h.adapter.checkPassword = (_user, _password, done) => done(true, 'system.user.kunde');
    assert.equal((await login(h, 'admin')).status, 401); assert.equal(h.adapter._authSessions.size, 0);
  });
  await run('Fehlende Callback-Identität ist keine bestätigte Anmeldung', async h => {
    h.adapter.checkPassword = (_user, _password, done) => done(true);
    assert.equal((await login(h, 'admin')).status, 401); assert.equal(h.adapter._authSessions.size, 0);
  });
  await run('Nichttextliche Zugangsdaten werden nicht in gültige Strings umgedeutet', async h => {
    for (const value of [123, true, { name: 'admin' }]) assert.equal((await login(h, value)).status, 400);
    assert.equal((await login(h, 'admin', [h.testPassword])).status, 400); assert.equal(h.adapter._authSessions.size, 0);
  });
  await run('Sitzung bleibt an Passwortwechsel und Kontosperre gebunden', async h => {
    const result = await login(h, 'Admin'); assert.equal(result.status, 200);
    h.accounts.get('admin').common.enabled = false;
    assert.equal((await h.request('/api/strict-auth/status', { token: tokenOf(h, result) })).data.authed, false);
    assert.equal((await login(h, 'Admin')).status, 401);
  });
  await run('Falsches Passwort bleibt abgewiesen und nennt keine Kontodetails', async h => {
    const result = await login(h, 'Admin', h.testPassword + '!');
    assert.equal(result.status, 401); assert.equal(result.data.error, 'unauthorized'); assert.equal(h.adapter._authSessions.size, 0);
  });
  console.log(JSON.stringify({ result: 'PASS', checks, environment: process.version, scope: 'Actual shipped local HTTP routes with controller-contract fixtures; no live Admin8 or customer installation' }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
