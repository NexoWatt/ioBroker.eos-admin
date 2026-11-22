/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft Lizenzkopf, unveränderte Programm-Tokens, Migrationsmarker,
 * Shebang/Strict-Semantik und die Grenzen des Quellscopes.
 * Daten und Wirkung: Temporäre Fixtures und lesender Zugriff auf eigene Quellen;
 * zwei Originalgeneratoren laufen nur im Fixture. Kein Produkt-Build/-Schreibzugriff.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test, after } = require('node:test');
const ts = require('typescript');
const { HEADER, splitProprietaryHeader, hasForeignLeadingNotice, withProprietaryHeader, hasLeadingNoCheck, withoutLeadingNoCheck } = require('./proprietary-header-policy.cjs');
const { inventory, synchronize, MANUAL_MIRRORS } = require('./sync-proprietary-headers.cjs');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexowatt-owned-headers-'));
after(() => fs.rmSync(temp, { recursive: true, force: true }));

function fixture(name) {
  const dir = path.join(temp, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function write(dir, rel, text) {
  const file = path.join(dir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
  return file;
}
function copyScript(dir, name) {
  write(dir, 'scripts/' + name, fs.readFileSync(path.join(root, 'scripts', name), 'utf8'));
}
function runScript(dir, name, args = []) {
  return spawnSync(process.execPath, [path.join(dir, 'scripts', name), ...args], { cwd: dir, encoding: 'utf8', timeout: 30000 });
}
function tokens(text) {
  const scanner = ts.createScanner(ts.ScriptTarget.ESNext, true, ts.LanguageVariant.Standard, text);
  const result = [];
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) result.push([token, scanner.getTokenText()]);
  return result;
}

test('Kopf steht vor Migration-/Transpiliermarker, Wiederholung verändert nichts', () => {
  for (const source of ['// @ts-nocheck\nconst value = 1;\n', '// @runtime-transpile\nconst value: number = 2;\n']) {
    const actual = withProprietaryHeader(source);
    assert.equal(actual, HEADER + source);
    assert.equal(withProprietaryHeader(actual), actual);
    assert.equal(splitProprietaryHeader(actual).body, source);
    assert.deepEqual(tokens(actual), tokens(source));
  }
});

test('Typfehler bleibt hinter Lizenzkopf erkennbar, No-Check wird für Teilprüfungen entfernt', () => {
  const dir = fixture('nocheck-compiler');
  const original = HEADER + '// @ts-nocheck\nconst value: number = "deliberate error";\n';
  const source = write(dir, 'error.ts', original);
  const options = { noEmit: true, strict: true, noLib: true, types: [] };
  const errors = () => ts.createProgram([source], options).getSemanticDiagnostics().filter((diagnostic) => diagnostic.code === 2322);
  assert.equal(errors().length, 0);
  const stripped = withoutLeadingNoCheck(original);
  assert(stripped.startsWith(HEADER + '\nconst value: number'));
  fs.writeFileSync(source, stripped);
  assert.equal(errors().length, 1, 'TypeScript must detect the intentional invalid assignment');
  const stringFixture = 'const marker = "// @ts-nocheck";\n';
  assert.equal(withoutLeadingNoCheck(HEADER + stringFixture), HEADER + stringFixture);
});

test('Pragma-Erkennung berücksichtigt Runtime-Marker, Blockkommentare und Compiler-Priorität', () => {
  const variants = [
    '// @runtime-transpile\n// @ts-nocheck\n',
    '/* ordinary comment */\n// @ts-nocheck\n',
    '// @ts-check\n/// @TS-NOCHECK: reason\n',
    '// @ts-nocheck\n// @ts-check\n',
    '// @ts-nochecking\n',
    '/* @ts-nocheck */\n',
    "'use strict';\n// @ts-nocheck\n",
  ];
  for (const prefix of variants) {
    const source = HEADER + prefix + 'const value: number = "error";\n';
    const compiler = ts.createSourceFile('fixture.ts', source, ts.ScriptTarget.ESNext, true);
    assert.equal(hasLeadingNoCheck(source), compiler.checkJsDirective?.enabled === false, prefix);
    const checked = ts.createSourceFile('fixture.ts', withoutLeadingNoCheck(source), ts.ScriptTarget.ESNext, true);
    assert.notEqual(checked.checkJsDirective?.enabled, false, prefix);
  }
});

test('Shebang und Strict-Modus bleiben wirksam, CRLF und BOM bleiben erhalten', () => {
  const source = '#!/usr/bin/env node\n\'use strict\';\nmodule.exports = (function () { return this; })();\n';
  const actual = withProprietaryHeader(source);
  assert.equal(actual, '#!/usr/bin/env node\n' + HEADER + source.slice(source.indexOf('\n') + 1));
  assert.equal(require(write(fixture('strict'), 'strict.cjs', actual)), undefined);
  assert.deepEqual(tokens(actual), tokens(source));
  const crlf = '\uFEFF// @ts-nocheck\r\nconst value = 3;\r\n';
  assert.equal(withProprietaryHeader(crlf), '\uFEFF' + HEADER + crlf.slice(1));
  assert.equal(withProprietaryHeader('#!/usr/bin/env node'), '#!/usr/bin/env node\n' + HEADER);
  assert.equal(withProprietaryHeader(HEADER.replace(/\n/g, '\r\n') + 'const n=1;'), HEADER.replace(/\n/g, '\r\n') + 'const n=1;');
});

test('Fremde/unklare Lizenzen werden abgewiesen, Fixture-Strings nicht umgedeutet', () => {
  for (const notice of ['/* Copyright (c) 2026 Third Party. */', '/* SPDX-License-Identifier: MIT */', "'use strict';\n/* Licensed under the Apache License */"]) {
    assert(hasForeignLeadingNotice(notice + '\nconst value = 1;'));
    assert.throws(() => withProprietaryHeader(notice + '\nconst value = 1;'), /Foreign or ambiguous/);
  }
  const stringFixture = 'const fixture = "Copyright (c) Another; SPDX-License-Identifier: MIT";\n';
  assert.equal(withProprietaryHeader(stringFixture), HEADER + stringFixture);
  assert.throws(() => withProprietaryHeader(null), TypeError);
});

test('Eigener Scope schließt Drittbundles, Notices, HTML/CSS/JSON und Binärdateien aus', () => {
  const dir = fixture('scope');
  const included = ['src-ts/runtime-executables/lib/example.ts', 'src-admin-tab/src/App.tsx', 'scripts/build.cjs', 'eslint.config.cjs', 'src-admin-tab/vite.config.ts', MANUAL_MIRRORS[0]];
  const excluded = ['admin/react/assets/bundle.js', 'node_modules/vendor/index.js', 'src-admin-tab/node_modules/vendor/index.js', 'www/index.html', 'www/style.css', 'src-ts/schema.json', 'admin/icon.png', 'docs/third-party-notices.txt'];
  for (const rel of [...included, ...excluded]) write(dir, rel, 'const preserved = 1;\n');
  const mirrored = write(dir, 'src-ts/runtime-mirrors/lib/generated.ts', '// @ts-nocheck\nconst preserved = 2;\n');
  assert.deepEqual(inventory(dir).source, [...included].sort());
  const result = synchronize(dir, { write: true });
  assert(result.ok);
  assert.equal(result.changed.length, included.length);
  for (const rel of included) assert(fs.readFileSync(path.join(dir, rel), 'utf8').startsWith(HEADER));
  for (const rel of excluded) assert.equal(fs.readFileSync(path.join(dir, rel), 'utf8'), 'const preserved = 1;\n');
  assert.equal(fs.readFileSync(mirrored, 'utf8'), '// @ts-nocheck\nconst preserved = 2;\n');
  assert.equal(synchronize(dir, { write: true }).changed.length, 0);
});

test('Preflight verweigert Fremdlizenzen vor erstem Schreibzugriff', () => {
  const dir = fixture('foreign');
  const own = write(dir, 'src-ts/own.ts', 'const own = 1;\n');
  write(dir, 'scripts/vendor.js', '/* Copyright (c) Example Supplier */\nmodule.exports=1;\n');
  const result = synchronize(dir, { write: true });
  assert.equal(result.ok, false);
  assert.deepEqual(result.blocked, ['scripts/vendor.js']);
  assert.deepEqual(result.changed, []);
  assert.equal(fs.readFileSync(own, 'utf8'), 'const own = 1;\n');
});

test('Symbolische Links werden weder gelesen noch überschrieben', () => {
  const dir = fixture('symlink');
  const outside = write(temp, 'outside.ts', 'const outside = 1;\n');
  fs.mkdirSync(path.join(dir, 'src-ts'));
  fs.symlinkSync(outside, path.join(dir, 'src-ts', 'linked.ts'));
  assert.throws(() => synchronize(dir, { write: true }), /Symbolic link/);
  assert.equal(fs.readFileSync(outside, 'utf8'), 'const outside = 1;\n');
});

test('Check verlangt erzeugte Runtime, Write verändert manuelle Spiegel nur um den Kopf', () => {
  const dir = fixture('generated');
  write(dir, 'src-ts/runtime-executables/lib/example.ts', 'module.exports = 1;\n');
  const mirrorBody = '// @ts-nocheck\n/** Original-Hash: ' + 'a'.repeat(64) + ' */\ninterface ManualContract { value: number }\n';
  const mirror = write(dir, MANUAL_MIRRORS[0], mirrorBody);
  assert(synchronize(dir, { write: true }).ok);
  assert.equal(fs.readFileSync(mirror, 'utf8'), HEADER + mirrorBody);
  assert(synchronize(dir, { sourcesOnly: true }).ok);
  const failed = synchronize(dir);
  assert.equal(failed.ok, false);
  assert(failed.missing.includes('lib/example.js'));
  write(dir, 'lib/example.js', HEADER + 'module.exports = 1;\n');
  assert(synchronize(dir).ok);
});

test('No-Check-Budget zählt vorhandene und neue Direktiven auch hinter Lizenzkopf', () => {
  const dir = fixture('nocheck-budget');
  copyScript(dir, 'verify-ts-nocheck-budget.js');
  copyScript(dir, 'proprietary-header-policy.cjs');
  const rel = 'src-ts/runtime-executables/example.ts';
  const body = '// @ts-nocheck\nconst value = 1;\n';
  write(dir, rel, HEADER + body);
  write(dir, 'scripts/ts-nocheck-budget.json', JSON.stringify({ uncheckedFileCount: 1, maxUncheckedLines: body.split('\n').length, files: [rel] }));
  const passed = runScript(dir, 'verify-ts-nocheck-budget.js');
  assert.equal(passed.status, 0, passed.stderr || passed.stdout);
  write(dir, 'src-ts/runtime-executables/new.ts', HEADER + body);
  const rejected = runScript(dir, 'verify-ts-nocheck-budget.js');
  assert.notEqual(rejected.status, 0);
  assert(rejected.stderr.includes('new @ts-nocheck runtime files'));
});

test('Gesamter eigener Quellscope bleibt beim Einfügen nach dem Prolog bytegleich', (context) => {
  const scope = inventory(root);
  assert(scope.source.length > 100);
  for (const rel of scope.source) {
    const before = fs.readFileSync(path.join(root, rel), 'utf8');
    const after = withProprietaryHeader(before);
    assert.equal(splitProprietaryHeader(after).body, splitProprietaryHeader(before).body, rel);
    assert.equal(withProprietaryHeader(after), after, rel);
    if (/\.tsx?$/.test(rel)) {
      const compiler = ts.createSourceFile(rel, before, ts.ScriptTarget.ESNext, true);
      assert.equal(hasLeadingNoCheck(before), compiler.checkJsDirective?.enabled === false, 'No-Check compiler agreement: ' + rel);
    }
  }
  context.diagnostic('Lesend geprüfte eigene Quelldateien: ' + scope.source.length);
});

test('Original-Runtime-Spiegelgenerator setzt Kopf vor No-Check und ist idempotent', () => {
  const dir = fixture('runtime-builder');
  copyScript(dir, 'build-ts-runtime-mirrors.js');
  copyScript(dir, 'proprietary-header-policy.cjs');
  const source = HEADER + "'use strict';\nmodule.exports = 23;\n";
  write(dir, 'ems/example.js', source);
  const built = runScript(dir, 'build-ts-runtime-mirrors.js');
  assert.equal(built.status, 0, built.stderr || built.stdout);
  const output = fs.readFileSync(path.join(dir, 'src-ts/runtime-mirrors/ems/example.ts'), 'utf8');
  assert(output.startsWith(HEADER + '// @ts-nocheck\n'));
  assert(output.includes('Original-Hash:'));
  assert.deepEqual(tokens(output), tokens(source));
  const checked = runScript(dir, 'build-ts-runtime-mirrors.js', ['--check']);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
});

test('Original-Scriptgenerator hält Lizenz zuerst und Strict-/Exports-Semantik', () => {
  const dir = fixture('script-builder');
  copyScript(dir, 'build-ts-script-mirrors.js');
  copyScript(dir, 'proprietary-header-policy.cjs');
  fs.mkdirSync(path.join(dir, 'node_modules'));
  fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')), path.join(dir, 'node_modules/typescript'), 'junction');
  write(dir, 'src-ts/scripts/publish-check-rules.ts', HEADER + 'export const result: number = 41;\n');
  write(dir, 'tsconfig.scripts-mirror.json', JSON.stringify({ compilerOptions: { strict: true, target: 'ES2020', module: 'CommonJS', types: [], rootDir: 'src-ts', outDir: 'build-ts/script-mirrors' }, include: ['src-ts/scripts/publish-check-rules.ts'] }));
  const built = runScript(dir, 'build-ts-script-mirrors.js');
  assert.equal(built.status, 0, built.stderr || built.stdout);
  const output = fs.readFileSync(path.join(dir, 'scripts/publish-check-rules.js'), 'utf8');
  assert(output.startsWith(HEADER + "'use strict';\n"));
  assert.equal(require(path.join(dir, 'scripts/publish-check-rules.js')).result, 41);
  const checked = runScript(dir, 'build-ts-script-mirrors.js', ['--check']);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
});
