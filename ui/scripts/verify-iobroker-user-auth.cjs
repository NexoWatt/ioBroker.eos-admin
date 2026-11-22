#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft Kontozuordnung, Callbackvertrag und gemeinsame Auth-Deadline.
 * Daten/Wirkung: Kanonische TypeScript-Quelle, strikte Typprüfung, synthetische
 * ioBroker-Konten; keine echten Konten, Geräte, Netzwerk- oder Passwortänderungen.
 * Ergebnis: Benannte positive/negative Regressionen; kein Admin-8-Praxistest.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'src-ts/runtime-executables/lib/iobroker-user-auth.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let checks = 0;
async function test(name, run) { await run(); checks++; console.log('PASS ' + name); }

// Prüft den vollständigen strikten Vertrag; Ausführung derselben Quelle im Speicher
// benötigt weder eine Produktdateiänderung noch ein erneutes Release-Versiegeln.
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.iobroker-user-auth.json'], { cwd: root, stdio: 'pipe' });
const compiled = ts.transpileModule(source, { fileName: sourcePath, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
const loaded = new Module(sourcePath, module);
loaded.filename = sourcePath;
loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
loaded._compile(compiled.outputText, sourcePath);
const { authenticateIoBrokerUser: authenticate, readAccountSecurity } = loaded.exports;

function fixture() {
  const secret = crypto.randomBytes(32).toString('hex');
  const customerSecret = crypto.randomBytes(32).toString('hex');
  const accounts = new Map();
  const passwords = new Map();
  const names = new Map([['Administrator', 'system.user.admin'], ['Anlagen-Technik', 'system.user.installer']]);
  const calls = { resolver: [], objects: [], password: [] };
  const add = (id, password = secret) => {
    accounts.set(id, { _id: id, type: 'user', common: { enabled: true, password: crypto.randomBytes(32).toString('hex') } });
    passwords.set(id, password);
  };
  add('system.user.admin'); add('system.user.installer'); add('system.user.kunde', customerSecret);
  const adapter = {
    getUserID: async name => { calls.resolver.push(name); return names.get(name); },
    getForeignObjectAsync: async id => { calls.objects.push(id); return accounts.get(id); },
    checkPassword: (id, password, callback) => { calls.password.push(id); callback(password === passwords.get(id), id); },
  };
  return { adapter, accounts, passwords, names, calls, secret, customerSecret, add };
}

async function main() {
  await test('strikte TypeScript-Prüfung ohne any/nocheck', async () => {
    assert.doesNotMatch(source, /@ts-nocheck|\bany\b/);
  });
  await test('Kurz-ID, Großschreibung, Anzeigename und vollständige ID ergeben dieselbe kanonische Identität', async () => {
    for (const input of ['admin', 'Admin', 'Administrator', 'system.user.admin', ' admin ']) {
      const h = fixture(); const result = await authenticate(h.adapter, input, h.secret);
      assert.equal(result.user, 'admin'); assert.match(result.credentialVersion, /^[a-f0-9]{64}$/);
      assert.deepEqual(h.calls.password, ['system.user.admin']);
      assert.deepEqual(h.calls.objects, ['system.user.admin', 'system.user.admin']);
      assert.equal(h.calls.resolver.length, input.startsWith('system.user.') ? 0 : 1);
    }
  });
  await test('Anzeigenamenkollision admin gehört Kunde; keine Ableitung von Adminrechten aus Rohinput', async () => {
    const h = fixture(); h.names.set('admin', 'system.user.kunde');
    const result = await authenticate(h.adapter, 'admin', h.customerSecret);
    assert.equal(result.user, 'kunde'); assert.deepEqual(h.calls.password, ['system.user.kunde']);
    assert(h.calls.objects.every(id => id === 'system.user.kunde'));
    assert.equal(await authenticate(h.adapter, 'admin', h.secret), null);
    assert.equal((await authenticate(h.adapter, 'system.user.admin', h.secret)).user, 'admin');
  });
  await test('offizieller Fallback erhält Unicode und zulässige Sonderzeichen; Punkt/Leerzeichen werden Unterstriche', async () => {
    const h = fixture();
    for (const [input, suffix] of [['Électricien.Süd 🚀', 'électricien_süd__'], ['Ops:+/!$', 'ops:+/!$'], ['Technik.Ost', 'technik_ost']]) {
      h.add('system.user.' + suffix); assert.equal((await authenticate(h.adapter, input, h.secret)).user, suffix);
    }
    h.names.set('Legacy', 'system.user.Legacy.Name'); h.add('system.user.Legacy.Name');
    assert.equal((await authenticate(h.adapter, 'Legacy', h.secret)).user, 'Legacy.Name');
    assert.equal((await authenticate(h.adapter, 'system.user.Legacy.Name', h.secret)).user, 'Legacy.Name');
    h.adapter.FORBIDDEN_CHARS = /[?]/g; h.add('system.user.a_b');
    assert.equal((await authenticate(h.adapter, 'A?B', h.secret)).user, 'a_b');
  });
  await test('fehlender/fehlerhafter Resolver verweigert Kurzname; nur undefined aktiviert Fallback', async () => {
    for (const resolver of [undefined, () => { throw new Error('synthetic'); }, async () => { throw new Error('synthetic'); }]) {
      const h = fixture(); h.adapter.getUserID = resolver;
      assert.equal(await authenticate(h.adapter, 'admin', h.secret), null); assert.equal(h.calls.objects.length, 0);
      assert.equal((await authenticate(h.adapter, 'system.user.admin', h.secret)).user, 'admin');
    }
    for (const invalid of [null, false, 1, {}, '', 'admin', 'system.group.admin', 'system.user.', 'system.user.' + 'a'.repeat(129), 'system.user.admin\n', 'system.user. admin', 'system.user.admin ', 'system.user.bad\u0000id']) {
      const h = fixture(); h.adapter.getUserID = async () => invalid;
      assert.equal(await authenticate(h.adapter, 'Alias', h.secret), null); assert.equal(h.calls.objects.length, 0); assert.equal(h.calls.password.length, 0);
    }
  });
  await test('Benutzer/Passwort sind echte begrenzte Strings; Passwort bleibt ungetrimmt', async () => {
    for (const [user, password] of [[{}, 'x'], ['admin', {}], [null, 'x'], [42, 'x'], ['', 'x'], [' ', 'x'], ['a'.repeat(129), 'x'], [' '.repeat(129) + 'admin', 'x'], ['admin', ''], ['admin', 'x'.repeat(1025)]]) {
      const h = fixture(); assert.equal(await authenticate(h.adapter, user, password), null);
      assert.equal(h.calls.resolver.length + h.calls.objects.length + h.calls.password.length, 0);
    }
    const h = fixture(); const spaced = ' ' + h.secret + ' '; h.passwords.set('system.user.admin', spaced);
    assert.equal((await authenticate(h.adapter, 'admin', spaced)).user, 'admin');
    assert.equal(await authenticate(h.adapter, 'admin', h.secret), null);
    h.passwords.set('system.user.admin', 'x'.repeat(1024)); assert.equal((await authenticate(h.adapter, 'admin', 'x'.repeat(1024))).user, 'admin');
    h.add('system.user.' + 'a'.repeat(128)); assert.equal((await authenticate(h.adapter, 'a'.repeat(128), h.secret)).user.length, 128);
  });
  await test('Kontotyp, exakte Objekt-ID, Passwortbestand und Kontosperre werden vor Passwortprüfung geprüft', async () => {
    for (const mutation of [h => h.accounts.delete('system.user.admin'), h => { h.accounts.get('system.user.admin').type = 'state'; }, h => { h.accounts.get('system.user.admin')._id = 'system.user.kunde'; }, h => { delete h.accounts.get('system.user.admin')._id; }, h => { h.accounts.get('system.user.admin').common.enabled = false; }, h => { h.accounts.get('system.user.admin').common.password = ''; }, h => { h.accounts.get('system.user.admin').common.password = {}; }, h => { h.accounts.get('system.user.admin').common = null; }]) {
      const h = fixture(); mutation(h); assert.equal(await authenticate(h.adapter, 'admin', h.secret), null); assert.equal(h.calls.password.length, 0);
    }
  });
  await test('nur boolesches true mit identischer vollständiger Callback-ID authentifiziert', async () => {
    for (const value of [false, undefined, null, 1, 'false', {}, [], new Error('synthetic')]) {
      const h = fixture(); h.adapter.checkPassword = (_id, _password, done) => done(value, 'system.user.admin');
      assert.equal(await authenticate(h.adapter, 'admin', h.secret), null); assert.equal(h.calls.objects.length, 1);
    }
    for (const id of [undefined, null, 'admin', 'system.user.kunde', 'system.user.Admin', {}]) {
      const h = fixture(); h.adapter.checkPassword = (_id, _password, done) => done(true, id);
      assert.equal(await authenticate(h.adapter, 'admin', h.secret), null); assert.equal(h.calls.objects.length, 1);
    }
    const h = fixture(); h.adapter.checkPassword = (id, _password, done) => { done(false, id); done(true, id); };
    assert.equal(await authenticate(h.adapter, 'admin', h.secret), null);
  });
  await test('Passwortwechsel, Sperre, Löschung oder ID-Wechsel während Prüfung verhindern Sitzung', async () => {
    for (const mutation of [h => { h.accounts.get('system.user.admin').common.password = crypto.randomBytes(32).toString('hex'); }, h => { h.accounts.get('system.user.admin').common.enabled = false; }, h => h.accounts.delete('system.user.admin'), h => { h.accounts.get('system.user.admin')._id = 'system.user.kunde'; }]) {
      const h = fixture(); h.adapter.checkPassword = (id, _password, done) => { mutation(h); done(true, id); };
      assert.equal(await authenticate(h.adapter, 'admin', h.secret), null); assert.equal(h.calls.objects.length, 2);
    }
  });
  await test('Session-Fingerabdruck bleibt SHA-256 und reagiert auf Änderung/Sperre/Löschung', async () => {
    const h = fixture(); const expected = crypto.createHash('sha256').update(h.accounts.get('system.user.admin').common.password).digest('hex');
    assert.equal(await readAccountSecurity(h.adapter, 'admin'), expected);
    h.accounts.get('system.user.admin').common.password = crypto.randomBytes(32).toString('hex');
    assert.notEqual(await readAccountSecurity(h.adapter, 'admin'), expected);
    h.accounts.get('system.user.admin').common.enabled = false; assert.equal(await readAccountSecurity(h.adapter, 'admin'), null);
    h.accounts.delete('system.user.admin'); assert.equal(await readAccountSecurity(h.adapter, 'admin'), null);
    assert.equal(await readAccountSecurity(h.adapter, {}), null);
  });
  await test('Objekt-/Callbackfehler einschließlich async-Ablehnung werden ohne unhandled rejection verweigert', async () => {
    const unhandled = []; const listener = error => unhandled.push(error); process.on('unhandledRejection', listener);
    try {
      for (const check of [() => { throw new Error('synthetic'); }, async () => { throw new Error('synthetic'); }, () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error('synthetic')), 5))]) {
        const h = fixture(); h.adapter.checkPassword = check; assert.equal(await authenticate(h.adapter, 'admin', h.secret), null);
      }
      const badRead = fixture(); badRead.adapter.getForeignObjectAsync = async () => { throw new Error('synthetic'); };
      assert.equal(await authenticate(badRead.adapter, 'admin', badRead.secret), null);
      const lateReject = fixture(); lateReject.adapter.checkPassword = (id, _password, done) => { done(true, id); return new Promise((_resolve, reject) => setTimeout(() => reject(new Error('synthetic')), 5)); };
      assert.equal((await authenticate(lateReject.adapter, 'admin', lateReject.secret)).user, 'admin');
      await pause(20); assert.equal(unhandled.length, 0);
    } finally { process.off('unhandledRejection', listener); }
  });
  await test('Resolver-Timeout: spätes Ergebnis/Ablehnung starten weder Objekt- noch Passwortprüfung', async () => {
    for (const rejected of [false, true]) {
      const h = fixture(); h.adapter.getUserID = () => new Promise((resolve, reject) => setTimeout(() => rejected ? reject(new Error('synthetic')) : resolve('system.user.admin'), 45));
      const start = performance.now(); assert.equal(await authenticate(h.adapter, 'admin', h.secret, 20), null); assert(performance.now() - start < 250);
      await pause(55); assert.equal(h.calls.objects.length + h.calls.password.length, 0);
    }
  });
  await test('Objekt-Timeout: verspätetes Objekt startet keine Passwortprüfung', async () => {
    const h = fixture(); const read = h.adapter.getForeignObjectAsync;
    h.adapter.getForeignObjectAsync = async id => { await pause(45); return read(id); };
    assert.equal(await authenticate(h.adapter, 'admin', h.secret, 20), null);
    await pause(55); assert.equal(h.calls.password.length, 0); assert.equal(h.calls.objects.length, 1);
  });
  await test('Passwort-Timeout: fehlender/später Callback authentifiziert nicht und startet keinen zweiten Objektzugriff', async () => {
    for (const late of [false, true]) {
      const h = fixture(); h.adapter.checkPassword = (id, _password, done) => { if (late) setTimeout(() => done(true, id), 45); };
      assert.equal(await authenticate(h.adapter, 'admin', h.secret, 20), null);
      await pause(55); assert.equal(h.calls.objects.length, 1);
    }
    const h = fixture(); h.adapter.checkPassword = () => new Promise((_resolve, reject) => setTimeout(() => reject(new Error('synthetic')), 45));
    assert.equal(await authenticate(h.adapter, 'admin', h.secret, 20), null);
    await pause(55); assert.equal(h.calls.objects.length, 1);
  });
  await test('gemeinsames Budget umfasst Auflösung, ersten Objektzugriff und Passwortprüfung', async () => {
    const h = fixture(); const read = h.adapter.getForeignObjectAsync;
    h.adapter.getUserID = async () => { await pause(15); return 'system.user.admin'; };
    h.adapter.getForeignObjectAsync = async id => { await pause(15); return read(id); };
    h.adapter.checkPassword = (id, _password, done) => setTimeout(() => done(true, id), 30);
    const start = performance.now(); assert.equal(await authenticate(h.adapter, 'admin', h.secret, 45), null); assert(performance.now() - start < 250);
    await pause(55); assert.equal(h.calls.objects.length, 1);
  });
  await test('Zeitablauf während zweiter Kontolesung verweigert verspäteten Erfolg', async () => {
    const h = fixture(); const read = h.adapter.getForeignObjectAsync; let reads = 0;
    h.adapter.getForeignObjectAsync = async id => { if (++reads === 2) await pause(45); return read(id); };
    assert.equal(await authenticate(h.adapter, 'admin', h.secret, 20), null);
    await pause(55); assert.equal(reads, 2);
  });
  console.log(`IOBROKER USER AUTH: ${checks} checks passed; Node ${process.version}; strict TypeScript + synthetic controller APIs, no Admin 8 integration or hardware test.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
