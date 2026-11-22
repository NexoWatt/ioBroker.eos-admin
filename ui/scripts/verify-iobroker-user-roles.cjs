#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft die ausschließlich gruppenbasierte EOS-Rollenauflösung.
 * Daten und Wirkung: Strikte TypeScript-Prüfung und synthetische lokale Gruppen;
 * keine echten Benutzer, Gruppen, Passwörter oder Geräte werden verändert.
 * Bei Änderungen: Grenzen, Rollenpriorität und Entzug im selben Testlauf prüfen.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'src-ts/runtime-executables/lib/iobroker-user-roles.ts');
const source = fs.readFileSync(sourcePath, 'utf8');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let checks = 0;
async function test(name, run) { await run(); checks++; console.log('PASS ' + name); }
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--project', 'tsconfig.iobroker-user-roles.json'], { cwd: root, stdio: 'pipe' });
const compiled = ts.transpileModule(source, { fileName: sourcePath, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
const loaded = new Module(sourcePath, module);
loaded.filename = sourcePath;
loaded.paths = Module._nodeModulePaths(path.dirname(sourcePath));
loaded._compile(compiled.outputText, sourcePath);
const { createIoBrokerRolePolicy: policy, resolveIoBrokerRoleInfo: resolve } = loaded.exports;

function fixture() {
  const objects = new Map(); const reads = [];
  const add = (id, users) => objects.set(id, { _id: id, type: 'group', common: { members: users.map(user => 'system.user.' + user) } });
  const adapter = { getForeignObjectAsync: async id => { reads.push(id); return objects.get(id); } };
  return { objects, reads, add, adapter };
}
function deny(result, user = 'arbitrary') {
  assert.deepEqual(result, { user, role: 'none', roles: [], groups: [], capabilities: [], isAdmin: false, isInstaller: false, isCustomer: false });
}

async function main() {
  await test('strikte TypeScript-Prüfung ohne any/nocheck und unveränderliche validierte Policy', async () => {
    assert.doesNotMatch(source, /@ts-nocheck|\bany\b/);
    const p = policy(); assert.equal(p.valid, true); assert(Object.isFrozen(p));
    for (const values of [p.adminGroups, p.installerGroups, p.customerGroups]) assert(Object.isFrozen(values));
  });
  await test('beliebiger Kontoname erhält Adminrechte ausschließlich aus Administratorgruppe', async () => {
    for (const user of ['arbitrary', 'Service-Süd', 'vendor.operator', 'δοκιμή']) {
      const h = fixture(); h.add('system.group.administrator', [user]);
      const r = await resolve(h.adapter, user, policy()); assert.equal(r.user, user); assert.equal(r.role, 'admin');
      assert.deepEqual(r.capabilities, ['*']); assert.equal(r.isAdmin, true); assert.equal(r.isInstaller, true);
      assert.deepEqual(r.groups, ['system.group.administrator']);
    }
  });
  await test('Benutzernamen admin/installer/kunde/user/customer vergeben ohne Gruppen keine Rolle', async () => {
    for (const user of ['admin', 'installer', 'kunde', 'user', 'customer']) {
      const h = fixture(); deny(await resolve(h.adapter, user, policy()), user);
    }
  });
  await test('gleiche Namen behalten ausschließlich ihre tatsächlichen Gruppenrechte', async () => {
    const h = fixture(); h.add('system.group.user', ['admin', 'installer']);
    for (const user of ['admin', 'installer']) {
      const r = await resolve(h.adapter, user, policy()); assert.equal(r.role, 'customer'); assert.equal(r.isAdmin, false); assert.equal(r.isInstaller, false);
      assert.deepEqual(r.capabilities, ['frontend.open', 'energyWallet.customerSettings']);
    }
  });
  await test('alle bisherigen Standard- und Aliasgruppen bleiben wirksam', async () => {
    const p = policy();
    for (const [groups, role] of [[p.adminGroups, 'admin'], [p.installerGroups, 'installer'], [p.customerGroups, 'customer']]) {
      for (const id of groups) { const h = fixture(); h.add(id, ['arbitrary']); assert.equal((await resolve(h.adapter, 'arbitrary', p)).role, role); }
    }
  });
  await test('individuelle Gruppen als CSV/Array einschließlich Unicode und Großschreibung', async () => {
    const p = policy({ adminGroups: ' system.group.ProviderAdmin ; system.group.Betrieb\n', installerGroups: ['system.group.Technik-Équipe'], customerGroups: 'system.group.Haushalt' });
    assert.equal(p.valid, true);
    for (const [id, role] of [['system.group.ProviderAdmin', 'admin'], ['system.group.Betrieb', 'admin'], ['system.group.Technik-Équipe', 'installer'], ['system.group.Haushalt', 'customer']]) {
      const h = fixture(); h.add(id, ['arbitrary']); assert.equal((await resolve(h.adapter, 'arbitrary', p)).role, role);
    }
  });
  await test('bestehende Gruppenfelder werden ergänzt; Legacy-Benutzerlisten werden ignoriert', async () => {
    const p = policy({ adminUsers: 'arbitrary', installerUsers: ['arbitrary'], customerUsers: ['arbitrary'] }, { installerUsers: 'arbitrary', installerGroups: 'system.group.OldService' });
    const h = fixture(); deny(await resolve(h.adapter, 'arbitrary', p));
    h.add('system.group.OldService', ['arbitrary']); assert.equal((await resolve(h.adapter, 'arbitrary', p)).role, 'installer');
  });
  await test('Rollenpriorität bei mehreren Mitgliedschaften und doppelter Gruppenzuordnung', async () => {
    const p = policy({ adminGroups: 'system.group.Shared', installerGroups: 'system.group.Shared', customerGroups: 'system.group.Shared' });
    const h = fixture(); h.add('system.group.Shared', ['arbitrary']);
    assert.equal((await resolve(h.adapter, 'arbitrary', p)).role, 'admin'); assert.equal(h.reads.filter(id => id === 'system.group.Shared').length, 1);
    h.objects.clear(); h.add('system.group.installer', ['arbitrary']); h.add('system.group.user', ['arbitrary']);
    assert.equal((await resolve(h.adapter, 'arbitrary', p)).role, 'installer');
  });
  await test('unzugeordnete und ähnlich benannte Fremdgruppen verleihen keine Rechte', async () => {
    const h = fixture(); h.add('system.group.Administrator', ['arbitrary']); h.add('system.group.vendor_admin', ['arbitrary']);
    deny(await resolve(h.adapter, 'arbitrary', policy())); assert(!h.reads.includes('system.group.Administrator'));
  });
  await test('falsche Konfiguration sperrt sämtliche Rollen ohne Gruppenlesen', async () => {
    for (const value of [null, 1, false, {}, ['system.group.Fine', 1], ['system.user.admin'], 'administrator', 'system.group.', 'system.group.X\u0000', 'system.group.' + 'x'.repeat(129), 'x'.repeat(8193), new Array(33).fill('system.group.X')]) {
      const p = policy({ adminGroups: value }); assert.equal(p.valid, false); assert.deepEqual(p.adminGroups, []);
      const h = fixture(); h.add('system.group.administrator', ['arbitrary']); deny(await resolve(h.adapter, 'arbitrary', p)); assert.equal(h.reads.length, 0);
    }
    for (const [ac, auth] of [[null, {}], [[], {}], [{}, null], [{}, []], [{}, { installerGroups: {} }]]) assert.equal(policy(ac, auth).valid, false);
  });
  await test('Gesamtgruppengrenze und leere Konfigurationsfelder bleiben begrenzt', async () => {
    const groups = prefix => Array.from({ length: 32 }, (_, i) => 'system.group.' + prefix + i);
    assert.equal(policy({ adminGroups: groups('a'), installerGroups: groups('i'), customerGroups: groups('c') }, { installerGroups: groups('l') }).valid, false);
    assert.equal(policy({ adminGroups: '', installerGroups: [], customerGroups: ' ; , ' }).valid, true);
    assert.equal(policy({ adminGroups: ['system.group.' + 'x'.repeat(128)] }).valid, true);
  });
  await test('kanonische Konto-ID wird weder getrimmt noch umgedeutet', async () => {
    for (const user of ['', null, {}, 7, ' arbitrary', 'arbitrary ', 'x\n', 'x\u0000', 'x'.repeat(129)]) {
      const h = fixture(); deny(await resolve(h.adapter, user, policy()), null); assert.equal(h.reads.length, 0);
    }
    const h = fixture(); h.add('system.group.administrator', ['arbitrary']); deny(await resolve(h.adapter, 'Arbitrary', policy()), 'Arbitrary');
  });
  await test('exakte Objekt-ID und Gruppentyp sind Pflicht; Gruppenanzeigenamen sind bedeutungslos', async () => {
    for (const mutate of [o => { o._id = 'system.group.user'; }, o => { delete o._id; }, o => { o.type = 'user'; }, o => { o.common = null; }]) {
      const h = fixture(); h.add('system.group.administrator', ['arbitrary']); mutate(h.objects.get('system.group.administrator'));
      deny(await resolve(h.adapter, 'arbitrary', policy()));
    }
    const h = fixture(); h.add('system.group.user', ['arbitrary']); h.objects.get('system.group.user').common.name = 'Administrator';
    assert.equal((await resolve(h.adapter, 'arbitrary', policy())).role, 'customer');
  });
  await test('Mitglieder sind begrenzte Arrays direkter vollständiger Konto-IDs', async () => {
    for (const members of [null, {}, 'system.user.arbitrary', ['arbitrary'], ['system.group.administrator'], [1], ['system.user.arbitrary', {}], new Array(10001).fill('system.user.arbitrary')]) {
      const h = fixture(); h.add('system.group.administrator', ['arbitrary']); h.objects.get('system.group.administrator').common.members = members;
      deny(await resolve(h.adapter, 'arbitrary', policy()));
    }
    const h = fixture(); h.add('system.group.administrator', ['other', 'arbitrary-other']); deny(await resolve(h.adapter, 'arbitrary', policy()));
  });
  await test('Entfernen, Löschen und Deaktivieren wirken beim nächsten Zugriff', async () => {
    for (const change of [h => h.objects.get('system.group.administrator').common.members.splice(0), h => h.objects.delete('system.group.administrator'), h => { h.objects.get('system.group.administrator').common.enabled = false; }]) {
      const h = fixture(); h.add('system.group.administrator', ['arbitrary']); assert.equal((await resolve(h.adapter, 'arbitrary', policy())).role, 'admin');
      change(h); deny(await resolve(h.adapter, 'arbitrary', policy()));
    }
    const h = fixture(); h.add('system.group.administrator', ['arbitrary']); h.add('system.group.user', ['arbitrary']);
    h.objects.get('system.group.administrator').common.enabled = false; assert.equal((await resolve(h.adapter, 'arbitrary', policy())).role, 'customer');
  });
  await test('vorhandenes enabled muss Boolean sein; keine Umdeutung von Strings oder Zahlen', async () => {
    for (const enabled of ['false', 'true', 0, 1, null, {}, []]) {
      const h = fixture(); h.add('system.group.administrator', ['arbitrary']); h.objects.get('system.group.administrator').common.enabled = enabled;
      deny(await resolve(h.adapter, 'arbitrary', policy()));
    }
    const h = fixture(); h.add('system.group.administrator', ['arbitrary']); h.objects.get('system.group.administrator').common.enabled = true;
    assert.equal((await resolve(h.adapter, 'arbitrary', policy())).role, 'admin');
  });
  await test('fehlerhafte spätere Gruppe verwirft auch bereits gelesene Adminmitgliedschaft', async () => {
    const h = fixture(); h.add('system.group.administrator', ['arbitrary']); h.objects.set('system.group.user', false);
    deny(await resolve(h.adapter, 'arbitrary', policy()));
  });
  await test('synchrone und asynchrone Leseausfälle erlauben keinen Teilzugriff', async () => {
    for (const fail of [() => { throw new Error('synthetic'); }, async () => { throw new Error('synthetic'); }]) {
      const h = fixture(); h.add('system.group.administrator', ['arbitrary']); h.adapter.getForeignObjectAsync = fail;
      deny(await resolve(h.adapter, 'arbitrary', policy()));
    }
  });
  await test('gemeinsames Zeitbudget; verspätete Ergebnisse starten keine weiteren Leseaufrufe', async () => {
    const h = fixture(); h.add('system.group.administrator', ['arbitrary']); let reads = 0;
    h.adapter.getForeignObjectAsync = async id => { reads++; await pause(45); return h.objects.get(id); };
    const start = performance.now(); deny(await resolve(h.adapter, 'arbitrary', policy(), 15)); assert(performance.now() - start < 250);
    await pause(55); assert.equal(reads, 1);
    let count = 0;
    h.adapter.getForeignObjectAsync = async id => { count++; await pause(10); return h.objects.get(id); };
    deny(await resolve(h.adapter, 'arbitrary', policy(), 25)); await pause(30); assert(count <= 3);
  });
  await test('späte Promise-Ablehnung nach Zeitablauf bleibt behandelt', async () => {
    const unhandled = []; const listener = error => unhandled.push(error); process.on('unhandledRejection', listener);
    try {
      const h = fixture(); h.adapter.getForeignObjectAsync = () => new Promise((_done, reject) => setTimeout(() => reject(new Error('synthetic')), 45));
      deny(await resolve(h.adapter, 'arbitrary', policy(), 15)); await pause(60); assert.equal(unhandled.length, 0);
    } finally { process.off('unhandledRejection', listener); }
  });
  console.log('IOBROKER USER ROLES: ' + checks + ' checks passed; Node ' + process.version + '; strict TypeScript and synthetic group objects, no live Admin/controller test.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
