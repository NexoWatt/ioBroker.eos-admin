#!/usr/bin/env node
/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Erzeugt nachvollziehbare Komponenteninventare und eine hashgebundene Produkt-SBOM vor der Release-Versiegelung.
 * Daten und Wirkung: Verarbeitet Lockfiles, vorhandene Bäume, Paketdateien und den archivierten Admin-Buildgraphen; schreibt nur SBOM-Nachweise.
 * Bei Änderungen: Offline-Erzeugung ohne node_modules, inkonsistente Quellen, Paketgrenzen und das schreibfreie Publishgate nachprüfen.
 */
/**
 * Erstellt getrennte CycloneDX-Inventare aus Lockfiles und installierten Bäumen.
 * npm liefert Komponenten, Lizenzen, Tarball-Hashes und Abhängigkeitskanten;
 * dieser Wrapper ergänzt prüfbare Herkunft und die Grenzen des Lieferumfangs.
 * Keine Installation, kein Build, keine Lifecycle-Skripte und kein Netzwerk.
 * Aufruf: node scripts/generate-cra-sbom.cjs [--require-installed | --release]
 * --release erzeugt ausschließlich die auszuliefernde Produkt-SBOM vor dem
 * bewussten Versiegeln, ohne node_modules vorauszusetzen. Publish prüft nur.
 * Ausgabe: release-manifests/sbom-{root,admin}-{lockfile,installed,installed-runtime}.cdx.json
 * Bei vorhandenem aktuellen Rollup-Nachweis zusätzlich sbom-admin-bundle.cdx.json.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'release-manifests');
const TOOL_VERSION = '1.1.0';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

/** Führt nur npm-Leseoperationen ohne Shell aus; Fehler enthalten keine Rohdaten. */
function npmRead(args, cwd) {
  // npm_execpath makes this work on Windows too without enabling a command shell.
  const windowsCli = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  const cli = process.env.npm_execpath || (process.platform === 'win32' && fs.existsSync(windowsCli) ? windowsCli : null);
  if (process.platform === 'win32' && !cli) throw new Error('Unter Windows über npm run aufrufen, damit npm_execpath verfügbar ist.');
  const command = cli ? process.execPath : (process.platform === 'win32' ? 'npm.cmd' : 'npm');
  const argv = cli ? [cli, ...args] : args;
  const result = spawnSync(command, argv, {
    cwd, encoding: 'utf8', shell: false, timeout: 60000, maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, npm_config_offline: 'true', npm_config_ignore_scripts: 'true', npm_config_update_notifier: 'false', npm_config_include: '', npm_config_omit: '' },
  });
  if (result.error || result.status !== 0) throw new Error(`npm ${args[0]} fehlgeschlagen (Exit ${result.status ?? 'unbekannt'}).`);
  return result.stdout;
}

/** Prüft eindeutige Komponenten und vollständig auflösbare Graphverweise. */
function validateBom(bom) {
  if (bom.bomFormat !== 'CycloneDX' || !bom.specVersion || !bom.metadata?.component || !Array.isArray(bom.components)) {
    throw new Error('npm lieferte kein vollständiges CycloneDX-Inventar.');
  }
  const components = [bom.metadata.component, ...bom.components];
  const refs = new Set();
  for (const component of components) {
    if (!component['bom-ref'] || !component.name || !component.version || refs.has(component['bom-ref'])) {
      throw new Error('Komponentenidentität fehlt oder ist doppelt.');
    }
    refs.add(component['bom-ref']);
  }
  for (const edge of bom.dependencies || []) {
    if (!refs.has(edge.ref) || (edge.dependsOn || []).some(ref => !refs.has(ref))) {
      throw new Error('SBOM enthält einen nicht auflösbaren Abhängigkeitsverweis.');
    }
  }
}

/** Hashbezug meint exakt die gelesenen Dateien, nicht ein angeblich geprüftes Gerät. */
function generateScope(scope, requireInstalled, sourceOnly = false) {
  const cwd = path.join(ROOT, scope.directory);
  const packageBytes = fs.readFileSync(path.join(cwd, 'package.json'));
  const lockBytes = fs.readFileSync(path.join(cwd, 'package-lock.json'));
  const pkg = JSON.parse(packageBytes);
  const lock = JSON.parse(lockBytes);
  if (![2, 3].includes(lock.lockfileVersion) || !lock.packages) throw new Error('Lockfile mit explizitem Paketbaum erforderlich.');
  if (lock.packages['']?.version !== pkg.version || lock.packages['']?.name !== pkg.name) throw new Error('Lockfile und Paketidentität stimmen nicht überein.');
  const sorted = value => JSON.stringify(Object.entries(value || {}).sort(([a], [b]) => a.localeCompare(b)));
  for (const key of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    if (sorted(pkg[key]) !== sorted(lock.packages[''][key])) throw new Error(`Lockfile ist gegenüber package.json veraltet (${key}).`);
  }
  const modes = ['lockfile'];
  if (scope.name === 'root') modes.push('lockfile-runtime');
  const installed = fs.existsSync(path.join(cwd, 'node_modules', '.package-lock.json'));
  if (installed && !sourceOnly) modes.push('installed', 'installed-runtime');
  else if (requireInstalled) throw new Error(`Installierter ${scope.name}-Baum fehlt.`);

  return modes.map(mode => {
    const lockOnly = mode.startsWith('lockfile');
    const runtimeOnly = mode.endsWith('runtime');
    if (!lockOnly) npmRead(['ls', '--all', '--json', '--include=dev'], cwd);
    const bom = JSON.parse(npmRead(['sbom', '--sbom-format=cyclonedx', `--package-lock-only=${lockOnly}`, '--ignore-scripts', ...(runtimeOnly ? ['--omit=dev'] : ['--include=dev'])], cwd));
    bom.metadata.component.name = pkg.name; // npm otherwise sometimes uses the directory basename.
    const limitation = lockOnly
      ? `Source lockfile inventory${runtimeOnly ? ' of production reference dependencies' : ', including platform-specific optional and development dependencies'}. Not an installed or deployed inventory; npm host resolution may differ.`
      : 'Observed installed dependency tree in the review/build environment. Not proof of the delivered device, OS, ioBroker controller or browser bundle contents. Installation scripts were not run by this generator.';
    bom.metadata.component.description = `${pkg.description || pkg.name}. ${limitation}`;
    const properties = {
      'nexowatt:inventory-kind': lockOnly ? (runtimeOnly ? 'release-production-reference-dependencies' : 'source-lockfile-inventory') : mode === 'installed-runtime' ? 'installed-production-dependency-inventory' : 'installed-build-environment-inventory',
      'nexowatt:scope': scope.name,
      'nexowatt:generator-version': TOOL_VERSION,
      'nexowatt:generator-sha256': sha256(fs.readFileSync(__filename)),
      'nexowatt:package-json-path': path.posix.join(scope.directory, 'package.json'),
      'nexowatt:package-json-sha256': sha256(packageBytes),
      'nexowatt:lockfile-path': path.posix.join(scope.directory, 'package-lock.json'),
      'nexowatt:lockfile-sha256': sha256(lockBytes),
      'nexowatt:lockfile-package-entry-count': String(Object.keys(lock.packages).length - 1),
      'nexowatt:node-version': process.version,
      'nexowatt:host-platform': `${process.platform}-${process.arch}`,
      'nexowatt:limitations': limitation,
    };
    bom.metadata.properties = [
      ...(bom.metadata.properties || []),
      ...Object.entries(properties).map(([name, value]) => ({ name, value })),
    ];
    validateBom(bom);
    const filename = `sbom-${scope.name}-${mode}.cdx.json`;
    return { filename, bom, scope: scope.name, kind: properties['nexowatt:inventory-kind'], components: bom.components.length };
  });
}

/** Verknüpft gerenderte Browserpakete mit der tatsächlich installierten Admin-SBOM. */
function generateBundleInventory(results) {
  const evidencePath = path.join(OUTPUT, 'admin-bundle-components.json');
  if (!fs.existsSync(evidencePath)) return null;
  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  if (evidence.schema !== 'nexowatt.admin-bundle-components.v1'
    || evidence.packageLockSha256 !== sha256(fs.readFileSync(path.join(ROOT, 'src-admin-tab/package-lock.json')))
    || evidence.viteConfigSha256 !== sha256(fs.readFileSync(path.join(ROOT, 'src-admin-tab/vite.config.ts')))
    || evidence.entryHtmlSha256 !== sha256(fs.readFileSync(path.join(ROOT, 'src-admin-tab/index.html')))) {
    throw new Error('Admin-Buildnachweis veraltet; admin:build erneut ausführen.');
  }
  for (const artifact of evidence.artifacts) {
    if (!/^admin\/react\/[A-Za-z0-9_./-]+$/.test(artifact.path) || artifact.path.split('/').includes('..')
      || sha256(fs.readFileSync(path.join(ROOT, artifact.path))) !== artifact.sha256) throw new Error('Admin-Artefakt stimmt nicht mit Buildnachweis überein.');
  }
  for (const component of evidence.components) {
    for (const module of component.modules) {
      if (!module.path.startsWith('src-admin-tab/node_modules/') || module.path.split('/').includes('..')) throw new Error('Ungültiger Admin-Modulpfad.');
      // Ein unveränderter archivierter Build ist auch ohne lokale Dev-Installation prüfbar.
      if (fs.existsSync(path.join(ROOT, 'src-admin-tab/node_modules'))
        && (!fs.existsSync(path.join(ROOT, module.path)) || sha256(fs.readFileSync(path.join(ROOT, module.path))) !== module.sha256)) throw new Error('Gerendertes Admin-Modul wurde seit dem Build verändert.');
    }
  }
  for (const module of evidence.projectModules || []) {
    if (!module.path.startsWith('src-admin-tab/src/') || module.path.split('/').includes('..')
      || sha256(fs.readFileSync(path.join(ROOT, module.path))) !== module.sha256) throw new Error('Admin-Quelle wurde seit dem Build verändert.');
  }
  const origin = results.find(result => result.filename === 'sbom-admin-installed.cdx.json') || results.find(result => result.filename === 'sbom-admin-lockfile.cdx.json');
  if (!origin) throw new Error('Admin-Bundle benötigt ein aufgelöstes Versionsinventar.');
  const bom = structuredClone(origin.bom);
  const included = new Set(evidence.components.map(component => `${component.name}@${component.version}`));
  bom.components = bom.components.filter(component => included.has(`${component.name}@${component.version}`));
  if (bom.components.length !== included.size) throw new Error('Browserpaket fehlt im installierten Inventar.');
  const rootRef = bom.metadata.component['bom-ref'];
  const refs = new Set([rootRef, ...bom.components.map(component => component['bom-ref'])]);
  bom.dependencies = (bom.dependencies || []).filter(edge => refs.has(edge.ref)).map(edge => ({ ...edge, dependsOn: (edge.dependsOn || []).filter(ref => refs.has(ref)) }));
  // Root points to every observed contributing package; tree-shaken dependency edges are omitted.
  const rootEdge = bom.dependencies.find(edge => edge.ref === rootRef);
  if (rootEdge) rootEdge.dependsOn = bom.components.map(component => component['bom-ref']);
  bom.serialNumber = `urn:uuid:${crypto.randomUUID()}`;
  bom.metadata.lifecycles = [{ phase: 'post-build' }];
  bom.metadata.component.description = 'Npm packages with rendered JavaScript in the current Admin bundle; evidenced by the Rollup module graph and generated asset hashes.';
  bom.metadata.properties = bom.metadata.properties.filter(property => !['nexowatt:inventory-kind', 'nexowatt:limitations'].includes(property.name));
  bom.metadata.properties.push(
    { name: 'nexowatt:inventory-kind', value: 'observed-admin-bundle-components' },
    { name: 'nexowatt:bundle-evidence-sha256', value: sha256(fs.readFileSync(evidencePath)) },
    { name: 'nexowatt:limitations', value: 'Npm JavaScript packages contributing rendered code, not OS, fonts, images, unbundled external scripts or a security certification. Tarball checksums identify source package distributions, not a standalone vendored tarball in the bundle.' },
  );
  validateBom(bom);
  return { filename: 'sbom-admin-bundle.cdx.json', bom, scope: 'admin', kind: 'observed-admin-bundle-components', components: bom.components.length };
}

/** Kombiniert den Referenz-Laufzeitbaum und nachgewiesene Browserpakete mit Lieferdateihashes. */
function createProductInventory(results, root = ROOT) {
  const check = require('./verify-cra-sbom.cjs');
  const pkg = JSON.parse(check.safeRead(root, 'package.json').toString('utf8'));
  const bundleEvidence = JSON.parse(check.safeRead(root, check.BUNDLE_PATH).toString('utf8'));
  const runtime = results.find(result => result.filename === 'sbom-root-lockfile-runtime.cdx.json')?.bom;
  const admin = results.find(result => result.filename === 'sbom-admin-bundle.cdx.json')?.bom;
  if (!runtime || !admin) throw new Error('Root-Produktionsreferenz oder nachgewiesenes Admin-Bundle fehlt.');
  const records = paths => paths.map(relative => { const bytes = check.safeRead(root, relative); return { path: relative, size: bytes.length, sha256: sha256(bytes) }; });
  const packageFiles = records(check.packagePaths(pkg));
  const sourceFiles = records(check.sourcePaths(bundleEvidence));
  const bom = structuredClone(runtime);
  const productRef = `product:${pkg.name}@${pkg.version}`;
  const rootRef = runtime.metadata.component['bom-ref'];
  const prefixRoot = ref => ref === rootRef ? productRef : 'runtime-reference:' + ref;
  const prefixAdmin = ref => 'admin-bundle:' + ref;
  const withDelivery = (component, reference, delivery) => ({ ...structuredClone(component), 'bom-ref': reference, properties: [...(component.properties || []), { name: 'nexowatt:delivery', value: delivery }] });
  bom.metadata.component = { type: 'application', 'bom-ref': productRef, name: pkg.name, version: pkg.version, purl: `pkg:npm/${encodeURIComponent(pkg.name)}@${encodeURIComponent(pkg.version)}`, description: 'Prepared npm product artifact, reference external runtime dependencies and observed bundled Admin JavaScript.' };
  bom.components = [
    ...runtime.components.map(component => withDelivery(component, prefixRoot(component['bom-ref']), 'external-npm-release-reference; not bundled; live host resolution may differ')),
    withDelivery(admin.metadata.component, prefixAdmin(admin.metadata.component['bom-ref']), 'bundled-admin-application'),
    ...admin.components.map(component => withDelivery(component, prefixAdmin(component['bom-ref']), 'observed-rendered-admin-javascript')),
  ];
  bom.dependencies = [
    ...(runtime.dependencies || []).map(edge => ({ ref: prefixRoot(edge.ref), dependsOn: edge.dependsOn.map(prefixRoot) })),
    ...(admin.dependencies || []).map(edge => ({ ref: prefixAdmin(edge.ref), dependsOn: edge.dependsOn.map(prefixAdmin) })),
  ];
  const rootEdge = bom.dependencies.find(edge => edge.ref === productRef);
  if (!rootEdge) throw new Error('Root-Abhängigkeitsgraph fehlt.');
  rootEdge.dependsOn.push(prefixAdmin(admin.metadata.component['bom-ref']));
  bom.serialNumber = `urn:uuid:${crypto.randomUUID()}`;
  bom.metadata.timestamp = new Date().toISOString();
  bom.metadata.lifecycles = [{ phase: 'post-build' }];
  bom.metadata.properties = [
    { name: 'nexowatt:inventory-kind', value: 'release-product-reference-and-observed-admin-bundle' },
    { name: 'nexowatt:package-files-sha256', value: sha256(JSON.stringify(packageFiles)) },
    { name: 'nexowatt:source-inputs-sha256', value: sha256(JSON.stringify(sourceFiles)) },
    { name: 'nexowatt:bundle-evidence-sha256', value: sha256(check.safeRead(root, check.BUNDLE_PATH)) },
    { name: 'nexowatt:generator-version', value: TOOL_VERSION },
    { name: 'nexowatt:generator-sha256', value: sha256(fs.readFileSync(__filename)) },
    { name: 'nexowatt:limitations', value: 'External runtime packages are the release/reference dependency graph resolved in package-lock.json. npm installation on an ioBroker host may resolve differently. This is not an actual live-device inventory, complete EOS/OS/firmware SBOM, vulnerability clearance or CRA conformity assessment.' },
  ];
  check.validateGraph(bom);
  const bomBytes = Buffer.from(`${JSON.stringify(bom, null, 2)}\n`);
  const evidence = { schema: 'nexowatt.product-sbom-evidence.v1', package: pkg.name, version: pkg.version, generatedAt: bom.metadata.timestamp, sbomSha256: sha256(bomBytes), packageFiles, sourceFiles };
  return { bomBytes, evidence };
}

function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !['--require-installed', '--release'].includes(arg)) || (args.includes('--require-installed') && args.includes('--release'))) throw new Error('Unbekannte oder widersprüchliche Argumente.');
  const releaseOnly = args.includes('--release');
  const results = [
    ...generateScope({ name: 'root', directory: '.' }, args.includes('--require-installed'), releaseOnly),
    ...generateScope({ name: 'admin', directory: 'src-admin-tab' }, args.includes('--require-installed'), releaseOnly),
  ];
  const bundle = generateBundleInventory(results);
  if (bundle) results.push(bundle);
  const product = createProductInventory(results);
  // Only write after both projects passed; a failed read must never leave a new partial set.
  fs.mkdirSync(OUTPUT, { recursive: true });
  const check = require('./verify-cra-sbom.cjs');
  fs.writeFileSync(path.join(ROOT, check.BOM_PATH), product.bomBytes);
  fs.writeFileSync(path.join(ROOT, check.EVIDENCE_PATH), `${JSON.stringify(product.evidence, null, 2)}\n`);
  check.verify(ROOT);
  console.log(`[cra-sbom] Produkt-SBOM erzeugt und geprüft: ${product.evidence.package}@${product.evidence.version}; ${product.evidence.packageFiles.length} Paketdateien gebunden.`);
  if (releaseOnly) return; // Vor der Versiegelung; historische installierte Inventare bleiben separat.
  const snapshots = results.filter(result => result.filename !== 'sbom-root-lockfile-runtime.cdx.json');
  for (const result of snapshots) fs.writeFileSync(path.join(OUTPUT, result.filename), `${JSON.stringify(result.bom, null, 2)}\n`);
  const index = {
    schema: 'nexowatt.sbom-inventory-index.v1',
    generatedAt: new Date().toISOString(),
    generator: `scripts/generate-cra-sbom.cjs@${TOOL_VERSION}`,
    generatorSha256: sha256(fs.readFileSync(__filename)),
    disclaimer: 'These inventories do not assert CRA conformity or a complete shipped-system/bundle SBOM.',
    productEvidence: 'sbom-product-evidence.json',
    inventories: snapshots.map(({ filename, scope, kind, components }) => ({ filename, scope, kind, components, sha256: sha256(fs.readFileSync(path.join(OUTPUT, filename))) })),
  };
  fs.writeFileSync(path.join(OUTPUT, 'sbom-index.json'), `${JSON.stringify(index, null, 2)}\n`);
  for (const result of results) console.log(`[cra-sbom] ${result.filename}: ${result.components} Komponenten (${result.kind}).`);
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`[cra-sbom] BLOCKED: ${error.message}`); process.exitCode = 1; }
}
module.exports = { validateBom, createProductInventory };
