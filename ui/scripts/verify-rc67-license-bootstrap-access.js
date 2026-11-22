#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft den eng begrenzten Anmelde-/Lizenz-Bootstrap ohne aktive Lizenz.
 * Daten und Wirkung: Statische Pfad-/Methodenmatrix plus echte lokale HTTP-Routen
 * mit synthetischen Controllerkonten. Keine echte Lizenzaktivierung oder Geräte.
 * Bei Änderungen: Öffentliche Anmeldung ist keine Lizenz-/Rollenfreigabe;
 * Authguard, CSRF, Admin-Capability und weiter gesperrte Betriebsdaten mitprüfen.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const pkg = JSON.parse(read('package.json'));
const mainTs = read('src-ts/runtime-executables/main.ts');
const mainJs = read('main.js');
const licenseHtml = read('www/license.html');
const licenseTs = read('src-ts/runtime-executables/www/license.ts');
const licenseJs = read('www/license.js');
const bootstrapTs = read('src-ts/runtime-executables/lib/license-bootstrap-access.ts');
const bootstrapJs = read('lib/license-bootstrap-access.js');
const { isUnlicensedLicenseBootstrapRequest } = require(path.join(root, 'lib', 'license-bootstrap-access.js'));

function semverAtLeast(actual, expected) {
  const a = String(actual || '').split('.').map(Number);
  const e = String(expected || '').split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((a[i] || 0) > (e[i] || 0)) return true;
    if ((a[i] || 0) < (e[i] || 0)) return false;
  }
  return true;
}

assert.equal(semverAtLeast(pkg.version, '0.8.192'), true, `Paketversion ${pkg.version} ist kleiner als 0.8.192.`);
assert.equal(pkg.scripts?.['test:rc67-license-bootstrap-access'], 'node scripts/verify-rc67-license-bootstrap-access.js');

const allowed = [
  ['GET', '/login.html', true],
  ['GET', '/login?returnTo=%2Flicense.html', true],
  ['HEAD', '/login.html', true],
  ['GET', '/static/login.html', true],
  ['GET', '/static/login.js', true],
  ['GET', '/static/login.css', true],
  ['GET', '/static/assets/nexowatt-eos-logo-wide.png', true],
  ['GET', '/license.html', true],
  ['GET', '/license?nwAdmin=1', true],
  ['HEAD', '/license/', true],
  ['GET', '/static/license.html', true],
  ['GET', '/static/styles.css', true],
  ['GET', '/static/auth.js', true],
  ['GET', '/static/runtime-base.js', true],
  ['GET', '/static/nw-i18n.js', true],
  ['GET', '/static/license.js', true],
  ['GET', '/static/nexowatt-logo.png', true],
  ['GET', '/static/i18n/de.json?v=0.8.192', true],
  ['GET', '/static/i18n/nl.json?v=0.8.192', true],
  ['GET', '/static/i18n/en.json?v=0.8.192', true],
  ['GET', '/api/strict-auth/status', true],
  ['GET', '/api/auth/status', true],
  ['HEAD', '/api/auth/status', true],
  ['GET', '/api/session/me', true],
  ['POST', '/api/auth/login', true],
  ['POST', '/api/auth/logout', true],
  ['POST', '/api/installer/login', true],
  ['POST', '/api/installer/logout', true],
  ['OPTIONS', '/api/auth/login', true],
  ['POST', '/api/strict-auth/login', true],
  ['POST', '/api/strict-auth/logout', true],
  ['OPTIONS', '/api/strict-auth/login', true],
  ['GET', '/api/locale?ts=123', true],
  ['HEAD', '/api/locale', true],
  ['GET', '/api/license/info', true],
  ['POST', '/api/license/save', true],
  ['OPTIONS', '/api/license/save', true],
];
for (const [method, url, expected] of allowed) {
  assert.equal(isUnlicensedLicenseBootstrapRequest({ method, url }), expected, `${method} ${url} muss den Lizenz-Bootstrap passieren.`);
}

const blocked = [
  ['GET', '/', false],
  ['GET', '/index.html', false],
  ['GET', '/settings.html', false],
  ['GET', '/ems-apps.html', false],
  ['GET', '/simulation.html', false],
  ['GET', '/static/app.js', false],
  ['GET', '/static/ems-apps.js', false],
  ['GET', '/static/i18n/fr.json', false],
  ['GET', '/config', false],
  ['GET', '/api/state', false],
  ['POST', '/api/set', false],
  ['GET', '/api/auth/login', false],
  ['POST', '/api/auth/status', false],
  ['PUT', '/api/auth/login', false],
  ['GET', '/api/auth/logout', false],
  ['GET', '/api/auth/status/extra', false],
  ['POST', '/api/auth/login/extra', false],
  ['GET', '/api/authentication/status', false],
  ['OPTIONS', '/api/auth/new-action', false],
  ['GET', '/api/session', false],
  ['POST', '/api/session/me', false],
  ['DELETE', '/api/license/save', false],
  ['GET', '/api/installer/config', false],
  ['POST', '/license.html', false],
  ['GET', '/license-admin.html', false],
];
for (const [method, url, expected] of blocked) {
  assert.equal(isUnlicensedLicenseBootstrapRequest({ method, url }), expected, `${method} ${url} darf die allgemeine Lizenzsperre nicht umgehen.`);
}

for (const [source, label] of [[bootstrapTs, 'license-bootstrap-access.ts'], [bootstrapJs, 'license-bootstrap-access.js']]) {
  assert.match(source, /LICENSE_BOOTSTRAP_GET_PATHS/);
  assert.match(source, /LICENSE_BOOTSTRAP_API_METHODS/);
  assert.match(source, /\/api\/strict-auth\/login/);
  assert.match(source, /\/api\/locale/);
  assert.match(source, /\/api\/license\/save/);
  assert.doesNotMatch(source, /startsWith\('\/static\/'\)/, `${label}: pauschaler /static-Bypass wäre zu breit.`);
  assert.doesNotMatch(source, /startsWith\('\/static\/assets\/'\)/, `${label}: pauschaler /static/assets-Bypass wäre zu breit.`);
  assert.doesNotMatch(source, /startsWith\('\/api\/'\)/, `${label}: pauschaler /api-Bypass wäre zu breit.`);
}

function verifyMain(source, label) {
  assert.match(source, /require\('\.\/lib\/license-bootstrap-access'\)/, `${label}: Bootstrap-Helfer wird nicht geladen.`);
  const gateIndex = source.indexOf('if (isUnlicensedLicenseBootstrapRequest(req)) return next();');
  const refreshIndex = source.indexOf('await this._nwRefreshLicenseFromConfiguredKey(false)', gateIndex);
  assert.ok(gateIndex >= 0 && refreshIndex > gateIndex, `${label}: Lizenz-Bootstrap liegt nicht vor dem allgemeinen Lizenz-Gate.`);
  assert.match(source, /app\.get\(\['\/license\.html', '\/license'\][\s\S]*?requirePageAccessOrRenderLock\(req, res, 'license\.manage'/,
    `${label}: Lizenzseite ist nach dem technischen Bootstrap nicht weiterhin rollen-geschützt.`);
  assert.match(source, /app\.get\('\/api\/license\/info'[\s\S]*?hasCapability\(access, 'license\.manage'\)/,
    `${label}: Lizenz-Lese-API ist nicht rollen-geschützt.`);
  assert.match(source, /app\.post\('\/api\/license\/save'[\s\S]*?hasCapability\(access, 'license\.manage'\)/,
    `${label}: Lizenz-Schreib-API ist nicht rollen-geschützt.`);
  assert.match(source, /href="\/license\.html\?nwAdmin=1">Lizenz aktivieren<\/a>/,
    `${label}: Sperrseite enthält keinen direkten Aktivierungsweg.`);
  assert.match(source, /Die Lizenz wird beim Speichern sofort geprüft und übernommen/,
    `${label}: korrekter Aktivierungshinweis fehlt.`);
  assert.doesNotMatch(source, /const\s+uuidLine\s*=|\$\{uuidLine\}/,
    `${label}: Die allgemeine Sperrseite darf die System-UUID vor Admin-/Installer-Anmeldung nicht ausgeben.`);
  assert.doesNotMatch(source, /Bitte im <b>NexoWatt EOS Admin<\/b> unter <code>NexoWatt EOS → Lizenz<\/code>/,
    `${label}: veralteter/falscher Admin-Hinweis ist noch vorhanden.`);
  assert.doesNotMatch(source, /Danach den Adapter neu starten \(oder kurz deaktivieren\/aktivieren\)/,
    `${label}: unnötiger Neustart-Hinweis ist noch vorhanden.`);
}
verifyMain(mainTs, 'main.ts');
verifyMain(mainJs, 'main.js');

assert.match(licenseHtml, /Dieser Bereich bleibt auch auf einem neuen System ohne aktive Lizenz erreichbar/);
assert.match(licenseHtml, /Admin-Anmeldung wird geprüft/);
assert.match(licenseHtml, /data-nw-required-capability="license\.manage"/);
assert.ok(licenseHtml.indexOf('/static/auth.js') < licenseHtml.indexOf('/static/license.js'));
assert.match(licenseHtml, /\/static\/nw-i18n\.js/);
assert.doesNotMatch(licenseHtml, /cockpit-shell\.js|nw-shell\.js/,
  'Lizenz-Bootstrap lädt unnötige Shell-/Config-Skripte, die ohne Lizenz gesperrt bleiben müssen.');
assert.doesNotMatch(licenseHtml, /<input[^>]+value="NW/i, 'Lizenz-HTML enthält einen Schlüssel.');

for (const [source, label] of [[licenseTs, 'license.ts'], [licenseJs, 'license.js']]) {
  assert.match(source, /requireCapability\('license\.manage'/, `${label}: Capability-Prüfung fehlt.`);
  assert.match(source, /Die übrigen EOS-Bereiche sind sofort freigeschaltet/,
    `${label}: direkte Freischaltung nach erfolgreichem Speichern wird nicht kommuniziert.`);
  assert.doesNotMatch(source, /localStorage\.setItem\([^\n]*license/i,
    `${label}: Lizenzschlüssel darf nicht im Browser persistiert werden.`);
}

assert.ok(pkg.files.includes('lib/license-bootstrap-access.js'), 'Bootstrap-Runtime fehlt in package.json files.');
assert.ok(pkg.files.includes('www/license.html') && pkg.files.includes('www/license.js'), 'Lizenzseite fehlt im Paket.');

/**
 * Tatsächlich ausgelieferter Express-Server, vor dem ersten Request unlicensed.
 * Die Authsitzungen/CSRF stammen aus HTTP-Loginantworten. Nur die abschließende
 * Lizenzpersistenz/-prüfung wird beobachtet bzw. als synthetischer Fehlerzustand
 * gedoppelt: diese Suite behauptet keine kryptographische Lizenzaktivierung.
 */
async function verifyUnlicensedHttpBootstrap() {
  const { createHarness } = require('./verify-stable-1.0.9-access.cjs');
  let requests = 0;
  for (const options of [{}, { authEnabled: false, policy: 'all' }]) {
    const h = await createHarness(options);
    h.adapter._nwLicenseOk = false;
    h.adapter._nwLicenseInfo = { ok: false, type: 'none', edition: 'none', msg: 'Synthetischer nicht lizenzierter Zustand' };
    const licenseWrites = [];
    let licenseChecks = 0;
    const adapterId = `system.adapter.${h.adapter.namespace}`;
    const previousRead = h.adapter.getForeignObjectAsync.bind(h.adapter);
    h.adapter.getForeignObjectAsync = async id => id === adapterId ? { _id: id, type: 'instance', native: {} } : previousRead(id);
    h.adapter.setForeignObjectAsync = async (id, value) => { licenseWrites.push({ id, value }); };
    h.adapter._nwInitLicense = async () => { licenseChecks += 1; h.adapter._nwLicenseOk = false; };
    const request = async (url, requestOptions = {}) => { requests += 1; return h.request(url, { redirect: 'manual', ...requestOptions }); };
    const noSecrets = row => assert.doesNotMatch(row.text, /private-fixture-(uuid|license)|credentialVersion|passwordHash/, 'Ungeschützte/abgewiesene Antwort darf keine Lizenz-/Kontodaten enthalten.');
    try {
      for (const url of ['/login.html', '/static/login.html', '/static/login.js', '/static/login.css', '/static/auth.js', '/static/runtime-base.js']) {
        assert.equal((await request(url)).status, 200, `Öffentliches Bootstrap-Asset ${url}`);
      }
      for (const url of ['/api/auth/status', '/api/session/me', '/api/strict-auth/status']) {
        const result = await request(url);
        assert.equal(result.status, 200, url); assert.equal(result.data.authed, false);
        assert.equal(result.data.role, 'none'); assert.deepEqual(result.data.capabilities, []); noSecrets(result);
      }
      for (const url of ['/api/auth/login', '/api/auth/logout', '/api/strict-auth/login', '/api/license/save']) {
        assert.equal((await request(url, { method: 'OPTIONS' })).status, 204, `Genauer Preflight ${url}`);
      }
      for (const [method, url] of [['GET', '/api/auth/login'], ['POST', '/api/auth/status'], ['GET', '/api/auth/status/extra'],
        ['POST', '/api/auth/login/extra'], ['GET', '/api/authentication/status'], ['OPTIONS', '/api/auth/new-action']]) {
        const result = await request(url, { method });
        assert.equal(result.status, 401, `${method} ${url} ist keine öffentliche Authausnahme.`); noSecrets(result);
      }
      for (const url of ['/license.html', '/static/license.html', '/smarthome.html']) {
        const result = await request(url); assert.equal(result.status, 303, url);
        assert.match(result.headers.get('location'), /^\/login\.html\?returnTo=/); noSecrets(result);
      }
      for (const [method, url] of [['GET', '/api/license/info'], ['POST', '/api/license/save'], ['GET', '/api/state'],
        ['GET', '/config'], ['GET', '/api/smarthome/devices'], ['GET', '/api/installer/config'], ['GET', '/events']]) {
        const result = await request(url, { method, ...(method === 'POST' ? { body: { licenseKey: 'synthetic-bootstrap-only' } } : {}) });
        assert.equal(result.status, 401, `${method} ${url} vor Anmeldung`); noSecrets(result);
      }
      const sessions = { admin: await h.login('admin'), installer: await h.login('installer'), customer: await h.login('kunde') };
      for (const role of ['installer', 'customer']) {
        for (const url of ['/license.html', '/api/license/info']) {
          const result = await request(url, { token: sessions[role] });
          assert.equal(result.status, 403, `${role} ${url}`); noSecrets(result);
        }
        const result = await request('/api/license/save', { token: sessions[role], method: 'POST', body: { licenseKey: 'synthetic-bootstrap-only' } });
        assert.equal(result.status, 403, `${role} darf keine Lizenz speichern.`); noSecrets(result);
      }
      assert.equal(licenseWrites.length, 0); assert.equal(licenseChecks, 0);
      for (const [role, token] of Object.entries(sessions)) {
        for (const url of ['/config', '/api/state', '/api/smarthome/devices', '/api/installer/config', '/events', '/smarthome.html', '/static/app.js']) {
          const result = await request(url, { token });
          assert.equal(result.status, 403, `${role} ${url} bleibt ohne Lizenz gesperrt.`); noSecrets(result);
        }
      }
      assert.equal((await request('/license.html', { token: sessions.admin })).status, 200);
      const info = await request('/api/license/info', { token: sessions.admin });
      assert.equal(info.status, 200); assert.equal(info.data.valid, false); assert.equal(info.data.uuid, 'private-fixture-uuid');
      const noCsrf = await request('/api/license/save', { token: sessions.admin, method: 'POST', csrf: false, body: { licenseKey: 'synthetic-bootstrap-only' } });
      assert.equal(noCsrf.status, 403); assert.equal(noCsrf.data.error, 'csrf_required');
      assert.equal(licenseWrites.length, 0); assert.equal(licenseChecks, 0);
      const saved = await request('/api/license/save', { token: sessions.admin, method: 'POST', body: { licenseKey: 'synthetic-bootstrap-only' } });
      assert.equal(saved.status, 200); assert.equal(saved.data.valid, false);
      assert.equal(licenseWrites.length, 1); assert.equal(licenseWrites[0].id, adapterId); assert.equal(licenseChecks, 1);
      assert.equal((await request('/api/state', { token: sessions.admin })).status, 403, 'Ein Speicherversuch ersetzt keine gültige Lizenz.');
      assert.equal((await request('/api/auth/logout', { token: sessions.admin, method: 'POST' })).status, 200);
      assert.equal((await request('/api/license/info', { token: sessions.admin })).status, 401);
    } finally { await h.close(); }
  }
  return requests;
}

verifyUnlicensedHttpBootstrap().then(requests => {
  console.log(`[rc67-license-bootstrap-access] OK: Enger Pfad-/Methodenvertrag und ${requests} echte HTTP-Anfragen ohne Lizenz; Anmeldung erreichbar, Lizenzverwaltung nur Admin+CSRF, Betriebsdaten weiter gesperrt.`);
}).catch(error => { console.error(error); process.exitCode = 1; });
