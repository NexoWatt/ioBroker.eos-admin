#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft die ausdrücklich beibehaltene Legacy-Lizenzstrategie und optionale private Dienstschlüssel.
 * Daten und Wirkung: Originalmethoden aus dem AST, zufällige UUIDs, isolierte Uhr und ioBroker-States.
 * Historisches Material kommt nur aus dem Produkthelper; keine Schlüssel-/Materialwerte in Ausgabe oder Fixtures.
 * Bei Änderungen: UUID-/Signaturbindung, Edition, Trial-Fortsetzung, Ablauf und Rückdatierung erhalten.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const filename = process.argv[2] || 'main.js';
const names = new Set([
  '_nwNormalizeLicenseKey', '_nwLegacyLicenseSecret', '_nwLicenseSecret', '_nwLicenseSecrets', '_nwExpectedLicenseKey',
  '_nwNormalizeLicenseEdition', '_nwExpectedEditionLicenseKey', '_nwResolveFullLicense',
  '_nwExpectedEditionTrialSig', '_nwExpectedEditionTrialKey', '_nwExpectedTrialSig',
  '_nwExpectedTrialKey', '_nwParseTrialKey', '_nwIsLicenseValid',
  '_nwClearTrialState', '_nwCheckTrialLicense', '_nwEvaluateLicense',
]);
const dayMs = 86400000;
const referenceNow = Date.UTC(2026, 9, 23, 12);
function loadAdapter(file, historical = false) {
  const source = fs.readFileSync(path.resolve(root, file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const methods = [];
  function visit(node) {
    if (ts.isMethodDeclaration(node) && names.has(node.name.getText(ast))) methods.push(node.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(methods.length, names.size - (historical ? 2 : 0), 'All real license methods are included');
  const env = {};
  const clock = { now: referenceNow };
  const Adapter = vm.runInNewContext('(class LicenseFixture { ' + methods.join('\n') + ' })', {
    process: { env }, crypto, Date: class extends Date { static now() { return clock.now; } }, nwFeatureFlagsService: null,
  });
  const adapter = new Adapter();
  const states = new Map();
  const writes = [];
  adapter.getStateAsync = async id => states.get(id);
  adapter.setStateAsync = async (id, state) => { writes.push(id); states.set(id, state); };
  return { adapter, env, states, writes, clock };
}
const formats = [
  { prefix: 'NW1', edition: 'eos', type: 'full', message: uuid => uuid },
  { prefix: 'NW1E', edition: 'eos', type: 'full', message: uuid => `${uuid}|EOS|FULL` },
  { prefix: 'NW1H', edition: 'hems', type: 'full', message: uuid => `${uuid}|HEMS|FULL` },
  { prefix: 'NW1T', edition: 'eos', type: 'trial', message: uuid => `${uuid}|TRIAL|030` },
  { prefix: 'NW1TE', edition: 'eos', type: 'trial', message: uuid => `${uuid}|EOS|TRIAL|030` },
  { prefix: 'NW1TH', edition: 'hems', type: 'trial', message: uuid => `${uuid}|HEMS|TRIAL|030` },
];
function keyFor(format, uuid, material) {
  const sig = crypto.createHmac('sha256', material).update(format.message(uuid)).digest('hex').toUpperCase().slice(0, 32);
  return `${format.prefix}-${format.type === 'trial' ? '030-' : ''}${sig.match(/.{1,4}/g).join('-')}`;
}
function actualKeys(adapter, uuid) {
  return [adapter._nwExpectedLicenseKey(uuid), adapter._nwExpectedEditionLicenseKey(uuid, 'eos'),
    adapter._nwExpectedEditionLicenseKey(uuid, 'hems'), adapter._nwExpectedTrialKey(uuid, '030'),
    adapter._nwExpectedEditionTrialKey(uuid, '030', 'eos'), adapter._nwExpectedEditionTrialKey(uuid, '030', 'hems')];
}
function assertInfo(info, format) {
  assert.equal(info.ok, true, 'Valid UUID-bound signature accepted');
  assert.equal(info.type, format.type);
  assert.equal(info.edition, format.edition);
}
(async () => {
  const baseline = loadAdapter(filename);
  const material = baseline.adapter._nwLegacyLicenseSecret();
  const uuid = crypto.randomUUID();
  const legacyKeys = formats.map(format => keyFor(format, uuid, material));
  assert.ok(baseline.adapter._nwLicenseSecret() === material, 'Historical material is the default without service migration');
  assert.equal(baseline.adapter._nwLicenseSecrets().length, 1);
  const actual = actualKeys(baseline.adapter, uuid);
  for (let i = 0; i < formats.length; i++) {
    assert.ok(actual[i] === legacyKeys[i], 'All four signature formulas and six formats stay compatible');
    const f = loadAdapter(filename);
    assertInfo(await f.adapter._nwEvaluateLicense(uuid, legacyKeys[i]), formats[i]);
    assertInfo(await f.adapter._nwEvaluateLicense(uuid, legacyKeys[i].toLowerCase().replace(/-/g, ' ')), formats[i]);
    const snapshot = JSON.stringify([...f.states]);
    assert.equal((await f.adapter._nwEvaluateLicense(crypto.randomUUID(), legacyKeys[i])).ok, false, 'Wrong UUID rejected');
    const changed = legacyKeys[i].slice(0, -1) + (legacyKeys[i].endsWith('A') ? 'B' : 'A');
    assert.equal((await f.adapter._nwEvaluateLicense(uuid, changed)).ok, false, 'Changed signature rejected');
    assert.equal(JSON.stringify([...f.states]), snapshot, 'Invalid signatures never alter trial metadata');
  }
  for (const invalid of [undefined, '', 'short', ' '.repeat(20), 'x'.repeat(4097), 'x'.repeat(20) + '\n', 'x'.repeat(20) + '\0', 'x'.repeat(20) + '\u00e4', 42]) {
    const f = loadAdapter(filename);
    if (invalid !== undefined) f.env.NEXOWATT_LICENSE_HMAC_SECRET = invalid;
    assert.ok(f.adapter._nwLicenseSecret() === material, 'Missing or malformed private material keeps legacy verification');
    assert.equal(f.adapter._nwLicenseSecrets().length, 1);
    for (let i = 0; i < formats.length; i++) assertInfo(await f.adapter._nwEvaluateLicense(uuid, legacyKeys[i]), formats[i]);
  }
  const privateMaterial = crypto.randomBytes(32).toString('hex');
  for (let i = 0; i < formats.length; i++) {
    const f = loadAdapter(filename);
    f.env.NEXOWATT_LICENSE_HMAC_SECRET = privateMaterial;
    assert.ok(f.adapter._nwLicenseSecret() === privateMaterial, 'Existing private configuration remains supported');
    assert.equal(f.adapter._nwLicenseSecrets().length, 2);
    const privateKey = keyFor(formats[i], uuid, privateMaterial);
    assertInfo(await f.adapter._nwEvaluateLicense(uuid, privateKey), formats[i]);
    assertInfo(await f.adapter._nwEvaluateLicense(uuid, legacyKeys[i]), formats[i]);
    f.env.NEXOWATT_LICENSE_HMAC_SECRET = crypto.randomBytes(32).toString('hex');
    assert.equal((await f.adapter._nwEvaluateLicense(uuid, privateKey)).ok, false, 'Unrelated private signature rejected');
    assertInfo(await f.adapter._nwEvaluateLicense(uuid, legacyKeys[i]), formats[i]);
    f.env.NEXOWATT_LICENSE_HMAC_SECRET = material;
    assert.equal(f.adapter._nwLicenseSecrets().length, 1, 'Same configured material is not compared twice');
  }
  for (let i = 3; i < formats.length; i++) {
    const f = loadAdapter(filename);
    const sig = f.adapter._nwParseTrialKey(legacyKeys[i]).sig;
    const start = referenceNow - 20 * dayMs;
    for (const [id, val] of [['trialSig', sig], ['trialDays', 30], ['trialStartTs', start], ['trialLastSeenTs', referenceNow - dayMs]]) f.states.set('license.' + id, { val, ack: true });
    assertInfo(await f.adapter._nwEvaluateLicense(uuid, legacyKeys[i]), formats[i]);
    assert.equal(f.states.get('license.trialStartTs').val, start, 'Upgrade does not restart an existing trial');
    assert.equal(f.writes.includes('license.trialStartTs'), false, 'Existing start is never rewritten');
    const info = await f.adapter._nwEvaluateLicense(uuid, legacyKeys[i]);
    assert.equal(info.daysRemaining, 10);
    f.clock.now = referenceNow - 5 * dayMs;
    assert.equal((await f.adapter._nwEvaluateLicense(uuid, legacyKeys[i])).daysRemaining, 10, 'Clock rollback does not extend a trial');
    f.clock.now = start + 30 * dayMs;
    assert.equal((await f.adapter._nwEvaluateLicense(uuid, legacyKeys[i])).ok, false, 'Expired trial remains rejected');
    f.clock.now = referenceNow;
    assert.equal((await f.adapter._nwEvaluateLicense(uuid, legacyKeys[i])).ok, false, 'Rollback cannot revive an expired trial');
  }
  const invalid = loadAdapter(filename);
  for (const key of ['', '***', 'protected', 'NW1-invalid', 'NW1T-000-' + 'A'.repeat(32)]) {
    assert.equal((await invalid.adapter._nwEvaluateLicense(uuid, key)).ok, false);
  }
  assert.equal((await invalid.adapter._nwEvaluateLicense('', legacyKeys[0])).ok, false, 'UUID remains mandatory');
  assert.equal(invalid.writes.length, 0, 'Invalid input never modifies trial metadata');
  const info = await baseline.adapter._nwEvaluateLicense(uuid, legacyKeys[0]);
  assert.ok(!JSON.stringify(info).includes(material) && !JSON.stringify(info).includes(legacyKeys[0]), 'Public result contains no signature material or key');
  let differential = '';
  const referenceIndex = process.argv.indexOf('--legacy-reference');
  if (referenceIndex >= 0) {
    const historical = loadAdapter(process.argv[referenceIndex + 1], true);
    for (let i = 0; i < 16; i++) {
      const randomUuid = crypto.randomUUID();
      const expected = actualKeys(historical.adapter, randomUuid);
      const generated = actualKeys(baseline.adapter, randomUuid);
      for (let j = 0; j < formats.length; j++) {
        assert.ok(generated[j] === expected[j], 'Original 1.0.21 and current signatures are identical');
        assertInfo(await baseline.adapter._nwEvaluateLicense(randomUuid, expected[j]), formats[j]);
      }
    }
    differential = '; original 1.0.21 differential: 16 UUIDs × 6 formats';
  }
  console.log('[license-compatibility] OK: 6 legacy/private formats, 9 missing/malformed ENV cases, UUID/signature rejection, trial continuation/expiry/rollback, no key output' + differential + '.');
})().catch(() => {
  // Assertion details can include a usable signature: print only the outcome.
  console.error('[license-compatibility] FAIL: legacy/private verification or trial regression; inspect locally without publishing material or keys.');
  process.exitCode = 1;
});
