#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft automatische SBOM-Erzeugung und Veröffentlichungsprüfung mit positiven und manipulierten Paketfällen.
 * Daten und Wirkung: Erzeugt synthetische Wegwerf-Repositories, startet ausschließlich lokale Offline-Werkzeuge und entfernt alle Fixtures wieder.
 * Bei Änderungen: Fehlende Komponenten, veränderte Dateien, Quell- und Paketkontext sowie Betrieb ohne lokale Abhängigkeiten erhalten.
 */
/** Reale Offline-Generierung plus negative Integritätsfälle in Wegwerf-Repositories. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const check = require('./verify-cra-sbom.cjs');
const ROOT = path.resolve(__dirname, '..');
let passed = 0;
const test = (name, body) => { body(); passed++; console.log(`[sbom regression] PASS ${name}`); };
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nw sbom regression '));
const fixture = path.join(temp, 'source with spaces');
const write = (relative, data) => { const file = path.join(fixture, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, data); };
const json = (relative, data) => write(relative, JSON.stringify(data, null, 2) + '\n');
const read = relative => fs.readFileSync(path.join(fixture, relative));
const hash = relative => check.sha256(read(relative));
const run = (args, cwd = fixture, env = process.env) => spawnSync(process.execPath, args, { cwd, env, encoding: 'utf8', timeout: 60000, maxBuffer: 4 * 1024 * 1024, shell: false });
const generator = ['scripts/generate-cra-sbom.cjs', '--release'];
function mutate(relative, body, assertion) {
  const original = read(relative);
  try { body(original); assertion(); } finally { write(relative, original); }
}
try {
  fs.mkdirSync(fixture, { recursive: true });
  const pkg = { name: 'iobroker.nexowatt-ui', version: '9.0.0', dependencies: {}, files: [...check.REQUIRED, 'main.js', 'io-package.json', 'LICENSE', 'admin/react/index.html', 'admin/react/assets/index-fixture.js'] };
  json('package.json', pkg);
  json('package-lock.json', { name: pkg.name, version: pkg.version, lockfileVersion: 3, requires: true, packages: { '': { name: pkg.name, version: pkg.version, dependencies: {} } } });
  json('io-package.json', { common: { name: 'nexowatt-ui', version: pkg.version } });
  write('LICENSE', 'Synthetic fixture only.');
  write('main.js', 'module.exports = {};\n');
  const adminPkg = { name: 'sbom-fixture-admin', version: '1.0.0', dependencies: { 'sbom-fixture-dependency': '1.0.0' } };
  json('src-admin-tab/package.json', adminPkg);
  json('src-admin-tab/package-lock.json', { name: adminPkg.name, version: adminPkg.version, lockfileVersion: 3, requires: true, packages: { '': adminPkg, 'node_modules/sbom-fixture-dependency': { version: '1.0.0', resolved: 'https://registry.npmjs.org/sbom-fixture-dependency/-/sbom-fixture-dependency-1.0.0.tgz', integrity: 'sha512-' + Buffer.alloc(64).toString('base64'), license: 'MIT' } } });
  write('src-admin-tab/vite.config.ts', 'export default {};\n');
  write('src-admin-tab/src/main.ts', 'export const fixture = 1;\n');
  write('src-admin-tab/index.html', '<div id="root"></div>\n');
  write('admin/react/index.html', '<script src="./assets/index-fixture.js"></script>\n');
  write('admin/react/assets/index-fixture.js', 'console.log("synthetic bundle");\n');
  json(check.BUNDLE_PATH, {
    schema: 'nexowatt.admin-bundle-components.v1',
    packageLockSha256: hash('src-admin-tab/package-lock.json'), viteConfigSha256: hash('src-admin-tab/vite.config.ts'), entryHtmlSha256: hash('src-admin-tab/index.html'),
    projectModules: [{ path: 'src-admin-tab/src/main.ts', sha256: hash('src-admin-tab/src/main.ts') }],
    components: [{ name: 'sbom-fixture-dependency', version: '1.0.0', modules: [{ path: 'src-admin-tab/node_modules/sbom-fixture-dependency/index.js', sha256: '0'.repeat(64), renderedLength: 1 }] }],
    artifacts: ['admin/react/index.html', 'admin/react/assets/index-fixture.js'].map(relative => ({ path: relative, sha256: hash(relative) })),
  });
  for (const name of ['generate-cra-sbom.cjs', 'verify-cra-sbom.cjs']) write('scripts/' + name, fs.readFileSync(path.join(ROOT, 'scripts', name)));
  write('scripts/release-artifact-manifest.json', 'DO NOT RESEAL\n');

  test('offline generation from clean repository without either node_modules tree', () => {
    const result = run(generator);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(path.join(fixture, 'node_modules')), false);
    assert.equal(fs.existsSync(path.join(fixture, 'src-admin-tab/node_modules')), false);
    assert.equal(check.verify(fixture).context, 'source-repository');
  });
  test('release generation never seals the artifact manifest', () => assert.equal(read('scripts/release-artifact-manifest.json').toString(), 'DO NOT RESEAL\n'));
  test('npm automatically included package.json is bound despite absence from files list', () => {
    assert.equal(pkg.files.includes('package.json'), false);
    assert.ok(JSON.parse(read(check.EVIDENCE_PATH)).packageFiles.some(item => item.path === 'package.json'));
  });
  test('reference dependencies are not claimed to be an actual live-device inventory', () => {
    const bom = JSON.parse(read(check.BOM_PATH));
    const properties = Object.fromEntries(bom.metadata.properties.map(item => [item.name, item.value]));
    assert.match(properties['nexowatt:limitations'], /not an actual live-device inventory/);
  });
  test('repeated publication verification is read-only and needs no npm on PATH', () => {
    const before = [check.BOM_PATH, check.EVIDENCE_PATH].map(hash);
    const result = run(['scripts/verify-cra-sbom.cjs'], fixture, { ...process.env, PATH: '', Path: '', npm_execpath: '' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual([check.BOM_PATH, check.EVIDENCE_PATH].map(hash), before);
  });
  test('changed root package dependency declaration is rejected', () => mutate('package.json', data => json('package.json', { ...JSON.parse(data), dependencies: { unexpected: '1.0.0' } }), () => {
    assert.throws(() => check.verify(fixture)); assert.notEqual(run(generator).status, 0);
  }));
  test('changed lockfile is rejected by verifier and generator', () => mutate('package-lock.json', data => { const lock = JSON.parse(data); lock.packages[''].version = '9.0.1'; json('package-lock.json', lock); }, () => {
    assert.throws(() => check.verify(fixture)); assert.notEqual(run(generator).status, 0);
  }));
  test('changed Admin asset cannot be silently re-described', () => mutate('admin/react/assets/index-fixture.js', () => write('admin/react/assets/index-fixture.js', 'changed'), () => {
    const before = hash(check.BOM_PATH); assert.throws(() => check.verify(fixture)); assert.notEqual(run(generator).status, 0); assert.equal(hash(check.BOM_PATH), before);
  }));
  test('changed Admin source requires a genuine new build', () => mutate('src-admin-tab/src/main.ts', () => write('src-admin-tab/src/main.ts', 'export const fixture = 2;'), () => {
    assert.throws(() => check.verify(fixture)); assert.notEqual(run(generator).status, 0);
  }));
  test('tampered SBOM is rejected', () => mutate(check.BOM_PATH, data => write(check.BOM_PATH, Buffer.concat([data, Buffer.from(' ')])), () => assert.throws(() => check.verify(fixture))));
  test('missing SBOM is rejected', () => mutate(check.BOM_PATH, () => fs.unlinkSync(path.join(fixture, check.BOM_PATH)), () => assert.throws(() => check.verify(fixture))));
  test('omitted hash record is rejected', () => mutate(check.EVIDENCE_PATH, data => { const evidence = JSON.parse(data); evidence.packageFiles.pop(); json(check.EVIDENCE_PATH, evidence); }, () => assert.throws(() => check.verify(fixture))));
  test('missing archived Admin evidence blocks generation without rewriting SBOM', () => mutate(check.BUNDLE_PATH, () => fs.unlinkSync(path.join(fixture, check.BUNDLE_PATH)), () => {
    const before = hash(check.BOM_PATH); assert.notEqual(run(generator).status, 0); assert.equal(hash(check.BOM_PATH), before);
  }));
  test('partial Admin dependency installation is not accepted as the recorded build', () => {
    const modules = path.join(fixture, 'src-admin-tab/node_modules'); fs.mkdirSync(modules);
    try { assert.notEqual(run(generator).status, 0); } finally { fs.rmSync(modules, { recursive: true, force: true }); }
  });
  test('prepared npm package verifies without source, lockfiles, dependencies or npm', () => {
    const packaged = path.join(temp, 'prepared npm package');
    for (const relative of new Set(['package.json', ...pkg.files])) {
      const destination = path.join(packaged, relative); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.copyFileSync(path.join(fixture, relative), destination);
    }
    assert.equal(check.verify(packaged).context, 'prepared-npm-runtime-package');
    const result = run(['scripts/verify-cra-sbom.cjs'], packaged, { ...process.env, PATH: '', Path: '', npm_execpath: '' }); assert.equal(result.status, 0, result.stderr);
    fs.writeFileSync(path.join(packaged, 'package-lock.json'), '{}');
    assert.equal(check.verify(packaged).context, 'prepared-npm-runtime-package', 'an installation-created lockfile is not a source repository');
  });
  test('partial source repository must not pretend to be a prepared npm package', () => mutate('src-admin-tab/package.json', () => fs.unlinkSync(path.join(fixture, 'src-admin-tab/package.json')), () => assert.throws(() => check.verify(fixture))));
  test('unsafe paths and graph references fail closed', () => {
    assert.throws(() => check.safeRead(fixture, '../outside'));
    assert.throws(() => check.safeRead(fixture, 'C:/outside'));
    const bom = JSON.parse(read(check.BOM_PATH)); bom.dependencies[0].dependsOn.push('missing-component'); assert.throws(() => check.validateGraph(bom));
  });
  console.log(`[sbom regression] OK: ${passed} Prüfgruppen. Lokal auf ${process.platform}; kein echter npm-Publish und keine Geräteprüfung.`);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
