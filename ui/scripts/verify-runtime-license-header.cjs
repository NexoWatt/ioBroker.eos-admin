/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft den Lizenzkopf und die explizite Transpilierungsgrenze des Generators.
 * Daten und Wirkung: Führt den Originalgenerator nur in einem temporären Fixture-Repository
 * aus; nutzt den bereits installierten TypeScript-Compiler und verändert keine Produktdatei.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test, after } = require('node:test');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexowatt-runtime-header-'));
after(() => fs.rmSync(temp, { recursive: true, force: true }));
const header = [
  '/**',
  ' * Copyright (c) 2026 NexoWatt. All rights reserved.',
  ' * Confidential and Proprietary.',
  ' * Use, modification or distribution without express written permission is prohibited.',
  ' */', '',
].join('\n');
fs.mkdirSync(path.join(temp, 'scripts'), { recursive: true });
fs.mkdirSync(path.join(temp, 'src-ts/runtime-executables/ems'), { recursive: true });
fs.mkdirSync(path.join(temp, 'node_modules'), { recursive: true });
fs.symlinkSync(path.dirname(require.resolve('typescript/package.json')), path.join(temp, 'node_modules/typescript'), 'junction');
fs.copyFileSync(path.join(root, 'scripts/build-ts-runtime-executables.js'), path.join(temp, 'scripts/build-ts-runtime-executables.js'));
const fixtures = {
  marked: '// @runtime-transpile\nconst value: number = 7; module.exports = value;\n',
  licensed: `${header}// @runtime-transpile\nconst value: number = 8; module.exports = value;\n`,
  nocheck: `${header}// @ts-nocheck\nmodule.exports = 9;\n`,
  string: "const text = '// @runtime-transpile'; module.exports = text;\n",
  nested: '/**\n * ordinary comment\n// @runtime-transpile\n */\nconst value: number = 10;\n',
};
for (const [name, source] of Object.entries(fixtures)) {
  fs.writeFileSync(path.join(temp, 'src-ts/runtime-executables/ems', `${name}.ts`), source);
}
const run = (args) => spawnSync(process.execPath, [path.join(temp, 'scripts/build-ts-runtime-executables.js'), ...args], {
  cwd: temp, encoding: 'utf8', timeout: 30000,
});
const built = run([]);
assert.equal(built.status, 0, built.stderr || built.stdout);
const output = (name) => fs.readFileSync(path.join(temp, 'ems', `${name}.js`), 'utf8');

test('bestehender führender Marker transpiliert unverändert', () => {
  assert.equal(require(path.join(temp, 'ems/marked.js')), 7);
  assert.doesNotMatch(output('marked'), /value: number/);
});
test('proprietärer Kopf bleibt vor Build-Hinweis, folgender Marker transpiliert', () => {
  assert(output('licensed').startsWith(header));
  assert(output('licensed').includes('AUTO-GENERATED RUNTIME FILE'));
  assert.equal(require(path.join(temp, 'ems/licensed.js')), 8);
  assert.doesNotMatch(output('licensed'), /@runtime-transpile|value: number/);
});
test('No-Check-Migrationsanker nach Lizenzkopf wird nicht ausgeliefert', () => {
  assert(output('nocheck').startsWith(header));
  assert.doesNotMatch(output('nocheck'), /@ts-nocheck/);
  assert.equal(require(path.join(temp, 'ems/nocheck.js')), 9);
});
test('Marker in String oder gewöhnlichem Kommentar löst keine Transpilierung aus', () => {
  assert(output('string').endsWith(fixtures.string));
  assert(output('nested').endsWith(fixtures.nested));
});
test('Hash- und Wiederholungsprüfung akzeptiert die exakt erzeugten Artefakte', () => {
  const checked = run(['--check']);
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
});
