#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Sperrt Veröffentlichungen bei fehlender oder veralteter Produkt-SBOM.
 * Daten und Wirkung: Liest Paketdateien, CycloneDX-Daten und Hashbelege ohne Schreibzugriff, externe Prozesse oder Netzwerk.
 * Bei Änderungen: Quellen- und Paketkontext, fehlende Belege sowie unveränderte frische ZIPs mit den SBOM-Regressionen prüfen.
 */
/**
 * Schreibfreies SBOM-Publishgate, ausschließlich Node-Bordmittel.
 * Prüft das ausgelieferte CycloneDX-Inventar, seine Hashbindung an jede
 * Paketdatei und – im vollständigen Repository – die Quell-/Lockfilebezüge.
 * Installiert nichts, startet kein npm, baut und versiegelt keine Artefakte.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const BOM_PATH = 'release-manifests/sbom-product.cdx.json';
const EVIDENCE_PATH = 'release-manifests/sbom-product-evidence.json';
const BUNDLE_PATH = 'release-manifests/admin-bundle-components.json';
const REQUIRED = [BOM_PATH, EVIDENCE_PATH, BUNDLE_PATH, 'scripts/verify-cra-sbom.cjs'];
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };

/** Nur kanonische relative Dateipfade; Symlinks sind keine Release-Belege. */
function safeRead(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || relative.includes('\0')
    || relative.split('/').some(part => !part || part === '.' || part === '..') || path.isAbsolute(relative) || relative.includes(':')) fail('Ungültiger SBOM-Belegpfad.');
  const parts = relative.split('/');
  for (let i = 1; i <= parts.length; i++) {
    const stat = fs.lstatSync(path.join(root, ...parts.slice(0, i)));
    if (stat.isSymbolicLink() || (i < parts.length ? !stat.isDirectory() : !stat.isFile())) fail('SBOM-Beleg ist keine reguläre Datei.');
  }
  return fs.readFileSync(path.join(root, relative));
}
const readJson = (root, relative) => JSON.parse(safeRead(root, relative).toString('utf8'));

function validateGraph(bom) {
  if (bom.bomFormat !== 'CycloneDX' || bom.specVersion !== '1.5' || !bom.metadata?.component
    || !Array.isArray(bom.components) || !Array.isArray(bom.dependencies)) fail('Ungültiges Produkt-SBOM-Format.');
  const refs = new Set();
  for (const component of [bom.metadata.component, ...bom.components]) {
    if (!component['bom-ref'] || !component.name || !component.version || refs.has(component['bom-ref'])) fail('Ungültige oder doppelte SBOM-Komponente.');
    refs.add(component['bom-ref']);
  }
  for (const edge of bom.dependencies) {
    if (!refs.has(edge.ref) || !Array.isArray(edge.dependsOn) || edge.dependsOn.some(ref => !refs.has(ref))) fail('SBOM-Abhängigkeitsgraph unvollständig.');
  }
}

function packagePaths(pkg) {
  if (!Array.isArray(pkg.files) || new Set(pkg.files).size !== pkg.files.length || REQUIRED.some(name => !pkg.files.includes(name))) fail('Paketdateiliste enthält nicht alle SBOM-Nachweise.');
  // npm includes package.json even when it is absent from the explicit files list.
  return [...new Set(['package.json', ...pkg.files.filter(name => ![BOM_PATH, EVIDENCE_PATH].includes(name))])].sort();
}

/** Verhindert ausgelassene Belege, Duplikate und nachträglich geänderte Dateien. */
function verifyRecords(root, records, expected) {
  if (!Array.isArray(records) || records.length !== expected.length || JSON.stringify(records.map(record => record.path).sort()) !== JSON.stringify([...expected].sort())) fail('SBOM-Dateibindung unvollständig oder unerwartet.');
  for (const record of records) {
    const bytes = safeRead(root, record.path);
    if (!/^[a-f0-9]{64}$/.test(record.sha256) || bytes.length !== record.size || sha256(bytes) !== record.sha256) fail(`SBOM-Dateibindung veraltet: ${record.path}`);
  }
}

function sourcePaths(bundle) {
  if (!Array.isArray(bundle.projectModules) || !bundle.projectModules.length) fail('Admin-Quellnachweis fehlt.');
  const paths = ['package-lock.json', 'scripts/generate-cra-sbom.cjs', 'src-admin-tab/package.json', 'src-admin-tab/package-lock.json', 'src-admin-tab/vite.config.ts', 'src-admin-tab/index.html'];
  for (const module of bundle.projectModules) {
    if (!module.path.startsWith('src-admin-tab/src/')) fail('Admin-Quellnachweis enthält fremde Pfade.');
    paths.push(module.path);
  }
  if (new Set(paths).size !== paths.length) fail('Admin-Quellnachweis enthält doppelte Pfade.');
  return paths.sort();
}

/** Liefert nur Prüfmetadaten; ein npm-Laufzeitpaket enthält absichtlich keine TS-Quellen. */
function verify(root = path.resolve(__dirname, '..')) {
  const pkg = readJson(root, 'package.json');
  const evidence = readJson(root, EVIDENCE_PATH);
  const bomBytes = safeRead(root, BOM_PATH);
  const bom = JSON.parse(bomBytes.toString('utf8'));
  const bundle = readJson(root, BUNDLE_PATH);
  if (evidence.schema !== 'nexowatt.product-sbom-evidence.v1' || evidence.package !== pkg.name || evidence.version !== pkg.version
    || evidence.sbomSha256 !== sha256(bomBytes) || bundle.schema !== 'nexowatt.admin-bundle-components.v1') fail('SBOM-Paketidentität oder Integrität stimmt nicht.');
  validateGraph(bom);
  if (bom.metadata.component.name !== pkg.name || bom.metadata.component.version !== pkg.version) fail('SBOM beschreibt ein anderes Produkt.');
  const props = Object.fromEntries((bom.metadata.properties || []).map(item => [item.name, item.value]));
  if (props['nexowatt:inventory-kind'] !== 'release-product-reference-and-observed-admin-bundle'
    || props['nexowatt:package-files-sha256'] !== sha256(JSON.stringify(evidence.packageFiles))
    || props['nexowatt:source-inputs-sha256'] !== sha256(JSON.stringify(evidence.sourceFiles))
    || props['nexowatt:bundle-evidence-sha256'] !== sha256(safeRead(root, BUNDLE_PATH))) fail('SBOM-Herkunftsbindung unvollständig.');
  verifyRecords(root, evidence.packageFiles, packagePaths(pkg));
  if (!Array.isArray(bundle.artifacts) || !bundle.artifacts.some(item => item.path.endsWith('.js')) || !bundle.artifacts.some(item => item.path === 'admin/react/index.html')) fail('Admin-Buildnachweis unvollständig.');
  for (const artifact of bundle.artifacts) {
    if (!artifact.path.startsWith('admin/react/') || !pkg.files.includes(artifact.path)
      || sha256(safeRead(root, artifact.path)) !== artifact.sha256) fail('Admin-Buildnachweis passt nicht zum Paket.');
  }
  const expectedSources = sourcePaths(bundle);
  if (!Array.isArray(evidence.sourceFiles) || JSON.stringify(evidence.sourceFiles.map(item => item.path).sort()) !== JSON.stringify(expectedSources)) fail('Quellbezug im Produkt-SBOM fehlt.');
  const sourceTree = fs.existsSync(path.join(root, 'src-ts')) || fs.existsSync(path.join(root, 'src-admin-tab')) || fs.existsSync(path.join(root, 'scripts/generate-cra-sbom.cjs'));
  if (sourceTree) {
    verifyRecords(root, evidence.sourceFiles, expectedSources);
    if (sha256(safeRead(root, 'src-admin-tab/package-lock.json')) !== bundle.packageLockSha256
      || sha256(safeRead(root, 'src-admin-tab/vite.config.ts')) !== bundle.viteConfigSha256
      || sha256(safeRead(root, 'src-admin-tab/index.html')) !== bundle.entryHtmlSha256) fail('Admin-Quelle oder Lockfile ist neuer als der Build.');
    for (const module of bundle.projectModules) if (sha256(safeRead(root, module.path)) !== module.sha256) fail('Admin-Quelle ist neuer als der Build.');
  }
  return { package: pkg.name, version: pkg.version, components: bom.components.length, packageFiles: evidence.packageFiles.length, sourceFilesVerified: sourceTree ? expectedSources.length : 0, context: sourceTree ? 'source-repository' : 'prepared-npm-runtime-package' };
}

if (require.main === module) {
  try {
    if (process.argv.length !== 2) fail('Aufruf ohne Zusatzparameter erforderlich.');
    const result = verify();
    console.log(`[cra-sbom-check] OK: ${result.package}@${result.version}; ${result.components} Komponenten, ${result.packageFiles} Paketdateien; ${result.context}. Keine Geräteinventar-/CRA-Freigabe.`);
  } catch (error) { console.error(`[cra-sbom-check] BLOCKED: ${error.message}`); process.exitCode = 1; }
}
module.exports = { verify, validateGraph, safeRead, packagePaths, sourcePaths, sha256, BOM_PATH, EVIDENCE_PATH, BUNDLE_PATH, REQUIRED };
