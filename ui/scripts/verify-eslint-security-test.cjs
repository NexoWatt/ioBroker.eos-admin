/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Nachweisen, dass echte Lintregeln Gefahren und Typ-Unterdrückungen
 * erkennen und das Altbefund-Gate weder neue Stellen noch stille Deaktivierung zulässt.
 * Auswirkung: Nur lokale, nicht ausgeführte Codefixtures im Arbeitsspeicher.
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { ESLint } = require('eslint');
const { ROOT, assertPolicy, fingerprintMessages, inventory, evaluate, codeSha256 } = require('./verify-eslint-security.cjs');
const FILE = 'src-ts/runtime-executables/lib/lint-self-test-fixture.ts';
async function main() {
  const eslint = new ESLint({ cwd: ROOT });
  const config = await eslint.calculateConfigForFile(path.join(ROOT, FILE));
  assertPolicy(config, FILE);
  let checks = 1;
  const lint = async (text, file = FILE) => {
    const [result] = await eslint.lintText(text, { filePath: path.join(ROOT, file) });
    return fingerprintMessages(file, text, result.messages);
  };
  const cases = [
    ['eval(payload);', 'no-eval'],
    ['const compile = new Function(payload);', 'no-new-func'],
    ['const value = dictionary[input];', 'security/detect-object-injection'],
    ['const pattern = /^(a+)+$/;', 'security/detect-unsafe-regex'],
    ['let value: any;', '@typescript-eslint/no-explicit-any'],
    ['// @ts-ignore\nconst value = 1;', '@typescript-eslint/ban-ts-comment'],
    ['// @ts-nocheck\nconst value = 1;', '@typescript-eslint/ban-ts-comment'],
    ['// @ts-expect-error\nconst value = 1;', '@typescript-eslint/ban-ts-comment'],
  ];
  for (const [source, rule] of cases) {
    const found = await lint(source);
    assert(found.some(item => item.rule === rule), rule + ' must execute'); checks += 1;
  }
  const original = 'function oldSite(key: string) { return record[key]; }';
  const legacy = await lint(original); const baseline = inventory(legacy);
  assert.equal(evaluate(legacy, baseline).introduced.length, 0); checks += 1;
  assert.equal(evaluate(await lint('// header added\n\n' + original), baseline).introduced.length, 0); checks += 1;
  assert(evaluate(await lint(original + '\nfunction newSite(key: string) { return record[key]; }'), baseline).introduced.length > 0); checks += 1;
  assert(evaluate([...legacy, ...legacy], baseline).introduced.length > 0); checks += 1;
  assert.equal(evaluate([], baseline).introduced.length, 0); checks += 1;
  assert.equal(evaluate([], baseline).absent, legacy.length); checks += 1;
  const strictAny = await lint('let value: any;', 'src-admin-tab/src/lint-self-test-fixture.ts');
  assert(evaluate(strictAny, inventory(strictAny)).introduced.length > 0); checks += 1;
  for (const source of ['let value: any;', '// @ts-nocheck\nconst value = 1;']) {
    const statusTypes = await lint(source, 'src-ts/runtime-executables/lib/hosted-startup-status.ts');
    assert(evaluate(statusTypes, inventory(statusTypes)).introduced.length > 0); checks += 1;
  }
  const ignored = await lint('// eslint-disable-next-line\nlet value: any;');
  assert(ignored.some(item => item.rule === '@typescript-eslint/no-explicit-any')); checks += 1;
  assert(ignored.some(item => item.rule === '<parser-or-inline-directive>')); checks += 1;
  const broken = await lint('const = ;');
  assert(broken.some(item => item.fatal));
  assert(evaluate(broken, inventory(broken)).introduced.length > 0); checks += 1;
  assert.throws(() => assertPolicy(undefined, FILE), /policy/); checks += 1;
  const weakened = { ...config, rules: { ...config.rules, 'security/detect-object-injection': [0] } };
  assert.throws(() => assertPolicy(weakened, FILE), /disabled/); checks += 1;
  assert.throws(() => assertPolicy({ ...config, linterOptions: { noInlineConfig: false } }, FILE), /policy/); checks += 1;
  const unchecked = { ...config, rules: { ...config.rules, '@typescript-eslint/ban-ts-comment': [2, { 'ts-ignore': false, 'ts-nocheck': true, 'ts-expect-error': true }] } };
  assert.throws(() => assertPolicy(unchecked, FILE), /weakened/); checks += 1;
  assert.equal(codeSha256(FILE, original), codeSha256(FILE, '// Copyright changed\n' + original)); checks += 1;
  assert.notEqual(codeSha256(FILE, original), codeSha256(FILE, original.replace('record[key]', 'other[key]'))); checks += 1;
  console.log('ESLint security gate: ' + checks + ' meaningful policy/negative checks passed.');
}
main().catch(error => { console.error('ESLint security test failed: ' + error.message); process.exitCode = 1; });
