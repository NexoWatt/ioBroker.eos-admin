/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/*
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express permission is prohibited.
 */
'use strict';

/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Erzwingt die benannten Quellregeln an der neuen HTTP-Fehlergrenze.
 * Daten und Wirkung: Liest lokale TS-Quelle und tsconfig; keine Netz-/Gerätezugriffe.
 * Bei Änderungen: Prüfumfang ausdrücklich erweitern und Negativtests erhalten.
 * Sicherheitsgrenze: Begrenzter Syntax-/Compiler-Guard, kein ESLint-Ersatz,
 * keine Datenflussanalyse und kein Nachweis für den ungeprüften Legacy-Bestand.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript'); // Bereits vorhandenes Entwicklungswerkzeug.

const ROOT = path.resolve(__dirname, '..');
const SCOPE = Object.freeze(['src-ts/runtime-executables/lib/http-error-boundary.ts']);
const CONFIG = 'tsconfig.security-boundaries.json';
const HEADER_PARTS = Object.freeze([
  'Copyright (c) 2026 NexoWatt. All rights reserved.',
  'Confidential and Proprietary.',
]);

function hasProprietaryHeader(source) {
  const trimmed = source.trimStart();
  if (!trimmed.startsWith('/*')) return false;
  const end = trimmed.indexOf('*/');
  if (end < 0) return false;
  const firstComment = trimmed.slice(0, end);
  return HEADER_PARTS.every(part => firstComment.includes(part)) && [
    'Use, modification or distribution without express permission is prohibited.',
    'Use, modification or distribution without express written permission is prohibited.',
    'Unauthorized use, modification or distribution is prohibited.',
  ].some(part => firstComment.includes(part));
}

/** Liefert reine Diagnosecodes; Quellinhalte oder externe Fehlermeldungen fehlen. */
function inspectSource(source, filename = 'fixture.ts') {
  const file = ts.createSourceFile(filename, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const issues = new Set();
  if (!hasProprietaryHeader(source)) issues.add('PROPRIETARY_HEADER_REQUIRED');
  for (const directive of file.commentDirectives || []) {
    if ([ts.CommentDirectiveType.Ignore, ts.CommentDirectiveType.ExpectError].includes(directive.type)) issues.add('TYPECHECK_SUPPRESSION_FORBIDDEN');
  }
  if (file.pragmas && file.pragmas.has('ts-nocheck')) issues.add('TYPECHECK_SUPPRESSION_FORBIDDEN');
  if (file.parseDiagnostics.length) issues.add('SOURCE_PARSE_ERROR');

  function propertyName(node) {
    if (ts.isIdentifier(node)) return node.text;
    if (ts.isPropertyAccessExpression(node)) return node.name.text;
    if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) return node.argumentExpression.text;
    return '';
  }
  function checkDependency(argument) {
    // Diese Grenze benötigt keine Imports; selbst native Netzwerk-/VM-Module
    // dürfen hier nicht unbemerkt eine neue Fähigkeit einführen.
    if (!argument || !ts.isStringLiteralLike(argument)) issues.add('DYNAMIC_DEPENDENCY_FORBIDDEN');
    else issues.add('DEPENDENCY_FORBIDDEN_IN_ERROR_BOUNDARY');
  }
  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) issues.add('EXPLICIT_ANY_FORBIDDEN');
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) && node.moduleSpecifier) checkDependency(node.moduleSpecifier);
    if (ts.isImportEqualsDeclaration(node)) issues.add('DEPENDENCY_FORBIDDEN_IN_ERROR_BOUNDARY');
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const called = propertyName(node.expression);
      if (called === 'eval' || called === 'Function') issues.add('DYNAMIC_CODE_FORBIDDEN');
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword || called === 'require') checkDependency(node.arguments && node.arguments[0]);
      if (['setTimeout', 'setInterval'].includes(called) && node.arguments && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) issues.add('STRING_TIMER_FORBIDDEN');
    }
    // Verhindert auch einfache Aliasbildung (const run = eval / globalThis.eval).
    if (ts.isIdentifier(node) && ['eval', 'Function'].includes(node.text)) issues.add('DYNAMIC_CODE_FORBIDDEN');
    if (ts.isElementAccessExpression(node) && ['eval', 'Function'].includes(propertyName(node))) issues.add('DYNAMIC_CODE_FORBIDDEN');
    ts.forEachChild(node, visit);
  }
  visit(file);
  return [...issues].sort();
}

/** Selbsttests unterscheiden echte Syntax von gleichlautenden Texten/Kommentaren. */
function selfTest() {
  const header = '/* Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Use, modification or distribution without express permission is prohibited. */\n';
  const fixtures = [
    ['valid unknown', 'export function f(value: unknown): boolean { return typeof value === "string"; }', []],
    ['harmless text', 'const text = "any eval() @ts-nocheck"; // any eval()', []],
    ['explicit type', 'let value: any;', ['EXPLICIT_ANY_FORBIDDEN']],
    ['nocheck', '// @ts-nocheck\nlet value: string = 1;', ['TYPECHECK_SUPPRESSION_FORBIDDEN']],
    ['ignore', '// @ts-ignore\nlet value: string = 1;', ['TYPECHECK_SUPPRESSION_FORBIDDEN']],
    ['expect error', '// @ts-expect-error\nlet value: string = 1;', ['TYPECHECK_SUPPRESSION_FORBIDDEN']],
    ['eval call', 'eval("1");', ['DYNAMIC_CODE_FORBIDDEN']],
    ['eval alias', 'const run = globalThis["eval"];', ['DYNAMIC_CODE_FORBIDDEN']],
    ['Function constructor', 'new Function("return 1");', ['DYNAMIC_CODE_FORBIDDEN']],
    ['string timer', 'setTimeout("run()", 10);', ['STRING_TIMER_FORBIDDEN']],
    ['external import', 'import value from "remote-package";', ['DEPENDENCY_FORBIDDEN_IN_ERROR_BOUNDARY']],
    ['native import', 'import value from "node:vm";', ['DEPENDENCY_FORBIDDEN_IN_ERROR_BOUNDARY']],
    ['dynamic require', 'require(value);', ['DYNAMIC_DEPENDENCY_FORBIDDEN']],
    ['dynamic import', 'import(value);', ['DYNAMIC_DEPENDENCY_FORBIDDEN']],
  ];
  for (const [name, source, expected] of fixtures) assert.deepEqual(inspectSource(header + source), expected, name);
  assert.deepEqual(inspectSource('export const value = 1;'), ['PROPRIETARY_HEADER_REQUIRED']);
  assert.deepEqual(inspectSource('/* unrelated */\n' + header + 'export const value = 1;'), ['PROPRIETARY_HEADER_REQUIRED']);
  assert.deepEqual(inspectSource(header.replace('Confidential and Proprietary.', '') + 'export const value = 1;'), ['PROPRIETARY_HEADER_REQUIRED']);
  console.log(`PASS security standards guard self-tests: ${fixtures.length + 3}`);
}

/** Prüft die aufgelösten Optionen, damit geerbte Abschaltungen nicht verschwinden. */
function checkConfig() {
  const filename = path.join(ROOT, CONFIG);
  const raw = ts.readConfigFile(filename, ts.sys.readFile);
  if (raw.error) throw new Error('SECURITY_TSCONFIG_UNREADABLE');
  const parsed = ts.parseJsonConfigFileContent(raw.config, ts.sys, ROOT);
  if (parsed.errors.length) throw new Error('SECURITY_TSCONFIG_INVALID');
  const required = ['strict', 'noImplicitAny', 'strictNullChecks', 'useUnknownInCatchVariables', 'noUncheckedIndexedAccess', 'exactOptionalPropertyTypes', 'noEmit'];
  for (const flag of required) assert.equal(parsed.options[flag], true, `Required compiler option: ${flag}`);
  assert.equal(parsed.options.noCheck, false, 'noCheck must explicitly remain false');
  assert.equal(parsed.options.allowJs, false, 'Security scope must remain TypeScript');
  assert.deepEqual(parsed.fileNames.map(p => path.relative(ROOT, p).replace(/\\/g, '/')).sort(), [...SCOPE].sort(), 'Configured source scope must match guard');
  return parsed;
}

function main() {
  selfTest();
  if (process.argv.includes('--self-test')) return;
  const parsed = checkConfig();
  for (const relative of SCOPE) {
    const findings = inspectSource(fs.readFileSync(path.join(ROOT, relative), 'utf8'), relative);
    assert.deepEqual(findings, [], `Security source rules failed: ${relative}`);
  }
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) {
    // Namen/Zeilen und TS-Codes genügen; kein beliebiger Quelltext im CI-Protokoll.
    for (const d of diagnostics) {
      const position = d.file && typeof d.start === 'number' ? d.file.getLineAndCharacterOfPosition(d.start) : null;
      console.error(`TYPECHECK TS${d.code} ${d.file ? path.relative(ROOT, d.file.fileName) : CONFIG}${position ? ':' + (position.line + 1) : ''}`);
    }
    throw new Error('SECURITY_BOUNDARY_TYPECHECK_FAILED');
  }
  console.log(`PASS strict security boundary scope: ${SCOPE.join(', ')}`);
  console.log('COVERAGE: named boundary only; no ESLint/SAST or whole-repository compliance claim.');
}

try { main(); } catch (error) {
  console.error('FAIL security standards guard:', error instanceof Error ? error.message : 'UNKNOWN_TEST_FAILURE');
  process.exitCode = 1;
}
