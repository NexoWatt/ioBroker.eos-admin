/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Erzwingt die aufgelösten strikten Compileroptionen und die vollständige
 * Dateiabdeckung der migrierten Konfigurations-/Peer-/Admin-Grenzen.
 * Wirkung: Lokale Quell-/Konfigurationsprüfung und native Negativfixtures im Tempverzeichnis.
 * Grenze: Ergänzt echte tsc-Läufe und ESLint; kein Ersatz für fachliche Tests oder Datenflussanalyse.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const STRICT_OPTIONS = Object.freeze(['noImplicitAny', 'noImplicitThis', 'strictNullChecks', 'strictFunctionTypes',
  'strictBindCallApply', 'strictPropertyInitialization', 'strictBuiltinIteratorReturn',
  'alwaysStrict', 'useUnknownInCatchVariables']);

function readConfig(filename) {
  const raw = ts.readConfigFile(filename, ts.sys.readFile);
  if (raw.error) throw new Error('STRICT_CONFIG_UNREADABLE');
  const parsed = ts.parseJsonConfigFileContent(raw.config, ts.sys, path.dirname(filename), undefined, filename);
  if (parsed.errors.length) throw new Error('STRICT_CONFIG_INVALID');
  return parsed;
}
function canonicalFiles(files) { return files.map(file => path.resolve(file)).sort(); }
function assertConfig(parsed, expected) {
  assert.equal(parsed.options.strict, true, 'STRICT_OPTION_REQUIRED: strict');
  for (const option of STRICT_OPTIONS) {
    assert.equal(ts.getStrictOptionValue(parsed.options, option), true, 'STRICT_OPTION_REQUIRED: ' + option);
  }
  assert.equal(parsed.options.noCheck, false, 'STRICT_NOCHECK_FORBIDDEN');
  assert.equal(parsed.options.noEmit, true, 'STRICT_NOEMIT_REQUIRED');
  assert.notEqual(parsed.options.allowJs, true, 'STRICT_JAVASCRIPT_SCOPE_FORBIDDEN');
  assert.deepEqual(canonicalFiles(parsed.fileNames), canonicalFiles(expected), 'STRICT_SCOPE_MISMATCH');
}
function sourceFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('STRICT_SOURCE_SYMLINK_FORBIDDEN');
    if (entry.isDirectory()) files.push(...sourceFiles(filename));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(filename);
  }
  return files.sort();
}
function assertSource(source, filename) {
  const kind = filename.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, kind);
  assert.equal(file.parseDiagnostics.length, 0, 'STRICT_SOURCE_PARSE_ERROR');
  for (const directive of file.commentDirectives || []) {
    if ([ts.CommentDirectiveType.Ignore, ts.CommentDirectiveType.ExpectError].includes(directive.type)) throw new Error('STRICT_SUPPRESSION_FORBIDDEN');
  }
  if (file.pragmas && file.pragmas.has('ts-nocheck')) throw new Error('STRICT_SUPPRESSION_FORBIDDEN');
  const visit = node => {
    assert.notEqual(node.kind, ts.SyntaxKind.AnyKeyword, 'STRICT_EXPLICIT_ANY_FORBIDDEN');
    ts.forEachChild(node, visit);
  };
  visit(file);
}

/** Echte geerbte Konfigurationsdateien prüfen; keine bloß nachgebauten Optionsobjekte. */
function selfTest() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'nw-strict-config-'));
  let checks = 0;
  try {
    const file = path.join(directory, 'boundary.ts');
    const other = path.join(directory, 'omitted.ts');
    fs.writeFileSync(file, 'export const value: unknown = 1;\n');
    fs.writeFileSync(other, 'export const missing: unknown = 2;\n');
    const base = { compilerOptions: { strict: true, noCheck: false, noEmit: true, allowJs: false }, files: ['boundary.ts'] };
    fs.writeFileSync(path.join(directory, 'base.json'), JSON.stringify(base));
    const config = path.join(directory, 'tsconfig.json');
    const fixture = overrides => {
      fs.writeFileSync(config, JSON.stringify({ extends: './base.json', ...overrides }));
      return readConfig(config);
    };
    assertConfig(fixture({}), [file]); checks++;
    for (const [option, value] of [['strict', false], ['noCheck', true], ['noEmit', false], ['allowJs', true], ...STRICT_OPTIONS.map(option => [option, false])]) {
      assert.throws(() => assertConfig(fixture({ compilerOptions: { [option]: value } }), [file]), /STRICT_/); checks++;
    }
    assert.throws(() => assertConfig(fixture({ files: ['omitted.ts'] }), [file]), /STRICT_SCOPE_MISMATCH/); checks++;
    assert.throws(() => assertConfig(fixture({ files: ['boundary.ts', 'omitted.ts'] }), [file]), /STRICT_SCOPE_MISMATCH/); checks++;
    assert.throws(() => assertConfig(fixture({ files: [], include: [] }), [file]), /STRICT_(?:CONFIG_INVALID|SCOPE_MISMATCH)/); checks++;
    for (const directive of ['ignore', 'nocheck', 'expect-error']) {
      assert.throws(() => assertSource('// @ts-' + directive + '\nconst value: string = 1;', file), /STRICT_SUPPRESSION_FORBIDDEN/); checks++;
    }
    assert.throws(() => assertSource('export let unsafe: any;', file), /STRICT_EXPLICIT_ANY_FORBIDDEN/); checks++;
    assertSource('export const text = "any @ts-ignore @ts-nocheck @ts-expect-error";', file); checks++;
    // Eine unvollständige Glob-Menge darf keine Mindestanzahl als Ersatz benutzen.
    assert.throws(() => assertConfig(fixture({}), [file, other]), /STRICT_SCOPE_MISMATCH/); checks++;
    return checks;
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
function main() {
  const checks = selfTest();
  const absolute = name => path.join(ROOT, name);
  const scopes = [
    ['tsconfig.config-boundaries.json', ['config-boundary-contracts', 'http-error-boundary', 'nvp-config-api', 'dynamic-grid-config-api'].map(name => absolute(`src-ts/runtime-executables/lib/${name}.ts`))],
    ['tsconfig.mesh-peer-http.json', [absolute('src-ts/runtime-executables/lib/mesh-peer-http.ts')]],
    ['src-admin-tab/tsconfig.json', sourceFiles(absolute('src-admin-tab/src'))],
    ['src-admin-tab/tsconfig.build-tools.json', [absolute('src-admin-tab/vite.config.ts')]],
    ['tsconfig.ui-access-policy.json', [absolute('src-ts/runtime-executables/lib/ui-access-policy.ts')]],
    ['tsconfig.ui-server-transport.json', [absolute('src-ts/runtime-executables/lib/ui-server-transport.ts')]],
    ['tsconfig.smarthome-import.json', [absolute('src-ts/runtime-executables/lib/smarthome-import.ts')]],
    ['tsconfig.ui-auth-frontend.json', ['auth', 'login', 'runtime-base'].map(name => absolute(`src-ts/runtime-executables/www/${name}.ts`))],
    ['tsconfig.ui-pwa.json', ['pwa', 'runtime-base'].map(name => absolute(`src-ts/runtime-executables/www/${name}.ts`))],
  ];
  for (const [name, expected] of scopes) {
    assertConfig(readConfig(absolute(name)), expected);
    for (const file of expected) assertSource(fs.readFileSync(file, 'utf8'), file);
    console.log('PASS strict scope: ' + name + ' (' + expected.length + ' exact source files)');
  }
  console.log('PASS strict configuration guard: ' + checks + ' native positive/negative fixtures; ' + scopes.length + ' resolved scopes.');
}
module.exports = { readConfig, assertConfig, assertSource, sourceFiles, STRICT_OPTIONS };
if (require.main === module) {
  try { main(); } catch (error) { console.error('FAIL strict boundary configurations: ' + (error instanceof Error ? error.message : 'UNKNOWN_CHECK_ERROR')); process.exitCode = 1; }
}
