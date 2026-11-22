/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/** Reproduzierbare unabhängige Mock-Prüfungen; keine Produktdateien ändern. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '../../..');
const sourcePath = 'src-ts/runtime-executables/lib/iobroker-user-auth.ts';
const source = fs.readFileSync(path.join(root, sourcePath), 'utf8');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const m = new Module(path.join(root, sourcePath), module);
m.filename = path.join(root, sourcePath);
m.paths = module.paths;
m._compile(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, m.filename);
const auth = m.exports.authenticateIoBrokerUser;
const fixtures = { password: crypto.randomBytes(16).toString('hex'), storedOne: crypto.randomBytes(16).toString('hex'), storedTwo: crypto.randomBytes(16).toString('hex') };
const unhandled = [];
const results = [];
process.on('unhandledRejection', error => unhandled.push(error));
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
function adapter(overrides = {}) {
  return {
    getUserID: async () => undefined,
    getForeignObjectAsync: async id => ({ _id: id, type: 'user', common: { enabled: true, password: fixtures.storedOne } }),
    checkPassword: (id, password, callback) => callback(true, id),
    ...overrides,
  };
}
async function check(id, name, run) {
  try { await run(); results.push({ id, name, result: 'passed' }); }
  catch (_error) { results.push({ id, name, result: 'failed', diagnostic: 'ASSERTION_FAILED_DETAILS_REDACTED' }); }
}
(async () => {
  await check('IR-01', 'Alias admin ergibt kanonisches Kundenkonto', async () => assert.equal((await auth(adapter({ getUserID: async () => 'system.user.customer' }), 'admin', fixtures.password)).user, 'customer'));
  await check('IR-02', 'Kurze ID wird im offiziellen Fallback kleingeschrieben', async () => assert.equal((await auth(adapter(), 'ADMIN', fixtures.password)).user, 'admin'));
  await check('IR-03', 'Vollständige ID bleibt unverändert und umgeht Resolver', async () => assert.equal((await auth(adapter({ getUserID: undefined }), 'system.user.MixedCase', fixtures.password)).user, 'MixedCase'));
  await check('IR-04', 'Rand-Leerzeichen in kanonischer ID vor Kontolesung abgewiesen', async () => {
    for (const suffix of [' admin', 'admin ']) {
      let reads = 0;
      assert.equal(await auth(adapter({ getUserID: async () => 'system.user.' + suffix, getForeignObjectAsync: async () => { reads++; return null; } }), 'Alias', fixtures.password), null);
      assert.equal(reads, 0);
    }
  });
  await check('IR-05', 'Nur Boolean true plus identische Callback-ID', async () => {
    for (const result of [1, 'true', [true], {}, true]) assert.equal(await auth(adapter({ checkPassword: (id, password, callback) => callback(result, result === true ? 'system.user.other' : id) }), 'admin', fixtures.password), null);
  });
  await check('IR-06', 'Fehlende Callback-ID abgewiesen', async () => assert.equal(await auth(adapter({ checkPassword: (id, password, callback) => callback(true) }), 'admin', fixtures.password), null));
  await check('IR-07', 'Passwort-Fingerabdruckwechsel während Prüfung abgewiesen', async () => {
    let reads = 0;
    assert.equal(await auth(adapter({ getForeignObjectAsync: async id => ({ _id: id, type: 'user', common: { enabled: true, password: ++reads === 1 ? fixtures.storedOne : fixtures.storedTwo } }) }), 'admin', fixtures.password), null);
  });
  await check('IR-08', 'Kontosperre während Prüfung abgewiesen', async () => {
    let reads = 0;
    assert.equal(await auth(adapter({ getForeignObjectAsync: async id => ({ _id: id, type: 'user', common: { enabled: ++reads === 1, password: fixtures.storedOne } }) }), 'admin', fixtures.password), null);
  });
  await check('IR-09', 'Abweichende Objekt-ID abgewiesen', async () => assert.equal(await auth(adapter({ getForeignObjectAsync: async () => ({ _id: 'system.user.other', type: 'user', common: { enabled: true, password: fixtures.storedOne } }) }), 'admin', fixtures.password), null));
  await check('IR-10', 'Resolver-Ablehnung sperrt statt Kontofallback', async () => assert.equal(await auth(adapter({ getUserID: async () => { throw new Error('synthetic'); } }), 'admin', fixtures.password), null));
  await check('IR-11', 'Synchroner API-Fehler abgewiesen', async () => assert.equal(await auth(adapter({ checkPassword: () => { throw new Error('synthetic'); } }), 'admin', fixtures.password), null));
  await check('IR-12', 'Promise-Ablehnung ohne Callback abgefangen', async () => assert.equal(await auth(adapter({ checkPassword: () => Promise.reject(new Error('synthetic')) }), 'admin', fixtures.password), null));
  await check('IR-13', 'Resolver-Timeout verhindert nachfolgende Kontolesung', async () => {
    let reads = 0;
    assert.equal(await auth(adapter({ getUserID: () => new Promise(() => {}), getForeignObjectAsync: async () => { reads++; return null; } }), 'admin', fixtures.password, 10), null);
    assert.equal(reads, 0);
  });
  await check('IR-14', 'Kontolesung-Timeout verweigert Zugriff', async () => assert.equal(await auth(adapter({ getForeignObjectAsync: () => new Promise(() => {}) }), 'admin', fixtures.password, 10), null));
  await check('IR-15', 'Später erfolgreicher Callback ändert Ablehnung nicht', async () => {
    let late;
    assert.equal(await auth(adapter({ checkPassword: (id, password, callback) => { late = () => callback(true, id); } }), 'admin', fixtures.password, 10), null);
    late();
  });
  await check('IR-16', 'Späte Promise-Ablehnung nach gültigem Callback bleibt behandelt', async () => {
    let reject;
    const result = await auth(adapter({ checkPassword: (id, password, callback) => { callback(true, id); return new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }); } }), 'admin', fixtures.password);
    assert.equal(result.user, 'admin');
    reject(new Error('synthetic'));
    await delay(10);
    assert.equal(unhandled.length, 0);
  });
  const sources = [sourcePath, 'src-ts/runtime-executables/main.ts', 'main.js', 'lib/iobroker-user-auth.js', 'scripts/verify-iobroker-user-auth.cjs', 'tsconfig.iobroker-user-auth.json'];
  const summary = {
    schemaVersion: 1, generatedAt: new Date().toISOString(), node: process.version, typescript: ts.version,
    scope: 'Separate AI-assisted review; synthetic ioBroker API fixtures; no live system and no external certification',
    command: 'node docs/reports/admin8-login-2026-11-03/unabhaengiger-review-checks.cjs',
    passed: results.filter(row => row.result === 'passed').length, failed: results.filter(row => row.result === 'failed').length,
    unhandledRejections: unhandled.length, results,
    sourceSha256: Object.fromEntries(sources.map(file => [file, sha(fs.readFileSync(path.join(root, file)))])),
    evidenceScriptSha256: sha(fs.readFileSync(__filename)),
    redaction: 'Only test identifiers, status, tool versions and source digests emitted; no passwords, stored password fields, error payloads or personal accounts.',
  };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed || summary.unhandledRejections) process.exitCode = 1;
})().catch(() => { console.error('REVIEW_RUN_FAILED_DETAILS_REDACTED'); process.exitCode = 1; });
