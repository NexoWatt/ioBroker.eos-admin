#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Gruppenbasierte EOS-Rechte und getrennte Benutzerpasswörter über echte HTTP-Routen prüfen.
 * Daten und Wirkung: Lokaler ausgelieferter Express-Server mit künstlichen ioBroker-Konten,
 * Gruppen und zufälligen Passwörtern. Keine echten Benutzer, Geräte oder externen Dienste.
 * Sicherheitsgrenze: Kontonamen verleihen keine Rolle; aktuelle Gruppen bestimmen jede Sitzung.
 * Bei Änderungen: Positive Fremdanbietergruppen, Passworttrennung, Rollenabstufung und
 * Fehlerfälle gemeinsam erhalten. Dieser Test ersetzt keinen Admin-8-Anlagentest.
 */
const assert = require('node:assert/strict');
const { createHarness } = require('./verify-stable-1.0.9-access.cjs');

let checks = 0;
async function run(name, verify, options = {}) {
  const h = await createHarness(options);
  try { await verify(h); checks++; console.log('PASS ' + name); }
  finally { await h.close(); }
}

const login = (h, user, password, route = '/api/strict-auth/login') => h.request(route, { method: 'POST', body: { user, password } });
function tokenOf(h, result) { return h.tokenOf(result); }
function removeMembership(h, user) {
  for (const group of h.groups.values()) group.common.members = group.common.members.filter(id => id !== 'system.user.' + user);
}
async function assertRole(h, user, password, role, route = '/api/strict-auth/login') {
  const result = await login(h, user, password, route);
  assert.equal(result.status, 200, result.text);
  assert.equal(result.data.role, role);
  const token = tokenOf(h, result);
  const status = await h.request('/api/auth/status', { token });
  assert.equal(status.data.authed, true);
  assert.equal(status.data.role, role);
  assert.equal((await h.request('/api/license/info', { token })).status, role === 'admin' ? 200 : 403);
  assert.equal((await h.request('/api/license/features', { token })).status, ['admin', 'installer'].includes(role) ? 200 : 403);
  return { result, token };
}

async function main() {
  for (const [user, group, role] of [
    ['dominique', 'system.group.administrator', 'admin'],
    ['elektro_partner', 'system.group.installer', 'installer'],
    ['familie_mueller', 'system.group.user', 'customer'],
  ]) {
    await run('Beliebige Kennung übernimmt ausschließlich ihre Gruppe: ' + role, async h => {
      const password = h.addAccount(user);
      h.groups.get(group).common.members.push('system.user.' + user);
      const { result } = await assertRole(h, user, password, role, role === 'customer' ? '/api/auth/login' : '/api/strict-auth/login');
      assert.equal(result.data.user, user);
      assert.deepEqual(result.data.groups, [group]);
    });
  }

  for (const route of ['/api/auth/login', '/api/strict-auth/login']) {
    await run('Eigene Passwörter für mehrere Konten, keine Adminpasswort-Übernahme: ' + route, async h => {
      const alpha = h.addAccount('partner_alpha', { name: 'Anbieter Verwaltung' });
      const beta = h.addAccount('partner_beta', { name: 'Anbieter Technik' });
      assert.notEqual(alpha, beta);
      assert.notEqual(alpha, h.testPassword);
      h.groups.get('system.group.administrator').common.members.push('system.user.partner_alpha');
      h.groups.get('system.group.installer').common.members.push('system.user.partner_beta');
      for (const [user, password, role, id] of [
        ['partner_alpha', alpha, 'admin', 'partner_alpha'],
        ['Anbieter Verwaltung', alpha, 'admin', 'partner_alpha'],
        ['system.user.partner_alpha', alpha, 'admin', 'partner_alpha'],
        ['partner_beta', beta, 'installer', 'partner_beta'],
        ['Anbieter Technik', beta, 'installer', 'partner_beta'],
        ['system.user.partner_beta', beta, 'installer', 'partner_beta'],
      ]) {
        const { result } = await assertRole(h, user, password, role, route);
        assert.equal(result.data.user, id);
      }
      const before = h.adapter._authSessions.size;
      for (const [user, wrongPassword] of [['partner_alpha', beta], ['partner_beta', alpha], ['partner_alpha', h.testPassword], ['partner_beta', h.testPassword]]) {
        const result = await login(h, user, wrongPassword, route);
        assert.equal(result.status, 401);
        assert.equal(result.data.error, 'unauthorized');
        assert.equal(result.response.headers.get('set-cookie'), null);
      }
      assert.equal(h.adapter._authSessions.size, before, 'wrong account passwords never create sessions');
    });
  }

  await run('Kunden haben getrennte Passwörter und keine technische Rolle', async h => {
    const a = h.addAccount('bewohner_a');
    const b = h.addAccount('bewohner_b');
    h.groups.get('system.group.user').common.members.push('system.user.bewohner_a', 'system.user.bewohner_b');
    await assertRole(h, 'bewohner_a', a, 'customer', '/api/auth/login');
    await assertRole(h, 'bewohner_b', b, 'customer', '/api/auth/login');
    assert.equal((await login(h, 'bewohner_a', b, '/api/auth/login')).status, 401);
    assert.equal((await login(h, 'bewohner_b', a, '/api/auth/login')).status, 401);
    assert.equal((await login(h, 'bewohner_a', a)).status, 403);
  });

  for (const user of ['admin', 'installer', 'kunde', 'user', 'customer']) {
    await run('Reservierter Kontoname ohne Gruppe verleiht keine Rolle: ' + user, async h => {
      const password = h.accounts.has(user) ? h.testPassword : h.addAccount(user);
      removeMembership(h, user);
      for (const route of ['/api/auth/login', '/api/strict-auth/login']) {
        const result = await login(h, user, password, route);
        assert.equal(result.status, 403);
        assert.equal(result.response.headers.get('set-cookie'), null);
      }
      assert.equal(h.adapter._authSessions.size, 0);
    });
  }

  await run('Konto admin in Kundengruppe erhält ausschließlich Kundenrechte', async h => {
    removeMembership(h, 'admin');
    h.groups.get('system.group.user').common.members.push('system.user.admin');
    await assertRole(h, 'admin', h.testPassword, 'customer', '/api/auth/login');
    assert.equal((await login(h, 'admin', h.testPassword)).status, 403);
  });

  for (const [field, role] of [['adminGroups', 'admin'], ['installerGroups', 'installer'], ['customerGroups', 'customer']]) {
    await run('Explizit zugeordnete Fremdanbietergruppe: ' + role, async h => {
      const password = h.addAccount('externer_benutzer');
      h.setGroup('system.group.partnerTeam', ['system.user.externer_benutzer']);
      await assertRole(h, 'externer_benutzer', password, role, role === 'customer' ? '/api/auth/login' : '/api/strict-auth/login');
    }, { accessControl: { [field]: ['system.group.partnerTeam'] } });
  }

  await run('Bestehende auth.installerGroups-Zuordnung bleibt als echte Gruppenfreigabe erhalten', async h => {
    const password = h.addAccount('bestehende_fachkraft');
    h.setGroup('system.group.partnerService', ['system.user.bestehende_fachkraft']);
    await assertRole(h, 'bestehende_fachkraft', password, 'installer');
  }, { authConfig: { installerGroups: 'system.group.partnerService' } });

  await run('Unzugeordnete Gruppe mit Anzeigename administrator gibt keinen Zugriff', async h => {
    const password = h.addAccount('fremder_benutzer');
    h.setGroup('system.group.partnerTeam', ['system.user.fremder_benutzer']);
    h.groups.get('system.group.partnerTeam').common.name = 'administrator';
    assert.equal((await login(h, 'fremder_benutzer', password, '/api/auth/login')).status, 403);
    assert.equal(h.adapter._authSessions.size, 0);
  });

  await run('Alte Benutzerlisten verleihen ohne Gruppenzuordnung keine Rechte', async h => {
    const password = h.addAccount('namensfreigabe');
    assert.equal((await login(h, 'namensfreigabe', password, '/api/auth/login')).status, 403);
    assert.equal((await login(h, 'namensfreigabe', password)).status, 403);
    assert.equal(h.adapter._authSessions.size, 0);
  }, { authConfig: { installerUsers: 'namensfreigabe' }, accessControl: { adminUsers: 'namensfreigabe', installerUsers: ['namensfreigabe'], customerUsers: 'namensfreigabe' } });

  await run('Mehrere echte Mitgliedschaften verwenden Admin vor Installer vor Kunde', async h => {
    const password = h.addAccount('mehrere_gruppen');
    for (const group of h.groups.values()) group.common.members.push('system.user.mehrere_gruppen');
    const { result } = await assertRole(h, 'mehrere_gruppen', password, 'admin');
    assert.deepEqual(new Set(result.data.groups), new Set(['system.group.administrator', 'system.group.installer', 'system.group.user']));
  });

  await run('Jede Gruppenabstufung widerruft die Sitzung; Neuanmeldung erhält nur aktuelle Rechte', async h => {
    const password = h.addAccount('rollenwechsel');
    for (const group of h.groups.values()) group.common.members.push('system.user.rollenwechsel');
    let { token } = await assertRole(h, 'rollenwechsel', password, 'admin');
    h.groups.get('system.group.administrator').common.members = ['system.user.admin'];
    assert.equal((await h.request('/api/license/info', { token })).status, 401);
    assert.equal((await h.request('/api/auth/status', { token })).data.authed, false);
    assert.equal(h.adapter._authSessions.has(token), false);
    ({ token } = await assertRole(h, 'rollenwechsel', password, 'installer'));
    assert.equal((await h.request('/api/license/features', { token })).status, 200);
    assert.equal((await h.request('/api/auth/status', { token })).data.role, 'installer');
    h.groups.get('system.group.installer').common.members = ['system.user.installer'];
    assert.equal((await h.request('/api/license/features', { token })).status, 401);
    assert.equal((await h.request('/api/auth/status', { token })).data.authed, false);
    ({ token } = await assertRole(h, 'rollenwechsel', password, 'customer', '/api/auth/login'));
    assert.equal((await h.request('/api/license/features', { token })).status, 403);
    assert.equal((await h.request('/api/auth/status', { token })).data.role, 'customer');
    h.groups.get('system.group.user').common.members = ['system.user.kunde'];
    assert.equal((await h.request('/api/license/features', { token })).status, 401);
    assert.equal((await h.request('/api/auth/status', { token })).data.authed, false);
    assert.equal(h.adapter._authSessions.has(token), false);
  });

  await run('Gruppenlöschung widerruft bestehende Adminsitzung ohne Kontonamensfallback', async h => {
    const token = await h.login('admin');
    h.groups.delete('system.group.administrator');
    assert.equal((await h.request('/api/license/info', { token })).status, 401);
    assert.equal((await login(h, 'admin', h.testPassword)).status, 403);
  });

  await run('Deaktivierte Gruppe gewährt keine Rolle und widerruft bestehende Sitzung', async h => {
    const token = await h.login('admin');
    h.groups.get('system.group.administrator').common.enabled = false;
    assert.equal((await h.request('/api/license/info', { token })).status, 401);
    assert.equal((await login(h, 'admin', h.testPassword)).status, 403);
  });

  for (const [name, mutate] of [
    ['abweichende Objekt-ID', group => { group._id = 'system.group.anderesTeam'; }],
    ['falscher Objekttyp', group => { group.type = 'state'; }],
    ['fehlerhafte Mitgliedsliste', group => { group.common.members = 'system.user.admin'; }],
    ['nichtkanonisches Mitglied', group => { group.common.members = ['admin']; }],
  ]) {
    await run('Ungültiges Gruppenobjekt wird abgewiesen: ' + name, async h => {
      mutate(h.groups.get('system.group.administrator'));
      assert.equal((await login(h, 'admin', h.testPassword)).status, 403);
      assert.equal(h.adapter._authSessions.size, 0);
    });
  }

  await run('Gruppenlesefehler sperrt eine vorhandene Sitzung und erzeugt keine neue', async h => {
    const token = await h.login('admin');
    const original = h.adapter.getForeignObjectAsync.bind(h.adapter);
    h.adapter.getForeignObjectAsync = async id => {
      if (id === 'system.group.administrator') throw new Error('synthetic-group-read-failure');
      return original(id);
    };
    const denied = await h.request('/api/license/info', { token });
    assert.equal(denied.status, 401);
    assert.ok(!denied.text.includes('synthetic-group-read-failure'));
    assert.equal((await login(h, 'admin', h.testPassword)).status, 403);
    assert.equal(h.adapter._authSessions.size, 0);
  });

  for (const mapping of ['not-a-group', ['system.group.partnerTeam', 42]]) {
    await run('Fehlerhafte Gruppen-Konfiguration fällt ohne Benutzer-Ausnahme sicher zu', async h => {
      assert.equal((await login(h, 'admin', h.testPassword)).status, 403);
      assert.equal(h.adapter._authSessions.size, 0);
    }, { accessControl: { adminGroups: mapping } });
  }

  console.log(JSON.stringify({ result: 'PASS', checks, environment: process.version, scope: 'Actual shipped local HTTP login, authorization and session routes; synthetic ioBroker groups and account-specific passwords; no live Admin8 or hardware test' }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
