/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: scripts/verify-license-editions.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * scripts/verify-license-editions.js
 *
 * Zusammenhang:
 * Der Spiegel hilft uns, die JS-Datei später schrittweise zu typisieren, zu testen und
 * kontrolliert auf TypeScript umzustellen. Produktive Originalquellen liegen unter
 * src-ts/runtime-executables/ bzw. den im generierten JS genannten TS-Pfaden.
 * Dort ändern, Laufzeit erzeugen und danach die Spiegel synchronisieren.
 * Build-/Prüfskripte ohne TS-Original werden weiterhin unter scripts/ gepflegt.
 *
 * Wichtig für die Migration:
 * - Diese Datei enthält vorübergehend @ts-nocheck.
 * - Der nächste Schritt ist pro Modul echte Typisierung statt pauschalem No-Check.
 * - Fachliche Kommentare markieren die Abschnitte, die später einzeln migriert werden.
 *
 * Original-Hash: 97ba3cf11861bc9c0e1e51cbb32b0e5ecdbe29225029a7d811c85779db065b44
 */

/**
 * Code-Teil: Runtime-Spiegel der kompletten Datei
 *
 * Zweck:
 * Dieser Abschnitt enthält den ursprünglichen JavaScript-Code als TypeScript-Parallelkopie.
 * Einzelne Funktionen werden später pro Modul weiter typisiert; Dateien ohne eigene
 * Funktionsdeklarationen bleiben trotzdem über diesen Dateikommentar dokumentiert.
 */

/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
'use strict';

/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Prüft zentrale Lizenzmatrix, Notfall-Fallback und sicheren Lizenzabruf der gebauten App-Oberfläche.
 * Daten und Wirkung: Liest Lieferartefakte; AST-Prüfungen begrenzen Lizenzabrufe und kontrollieren die echte Initialisierungsreihenfolge. Keine Produktmutation.
 * Bei Änderungen: Home-Matrix, Features-Endpoint und tatsächliche Funktionsblöcke gemeinsam prüfen; keine Schlüssel-/UUID-Endpunkte in AppCenter zurückfordern.
 * Verknüpfungen: docs/QUELLCODE_WEGWEISER_DE.md; docs/DOKUMENTATIONSSTANDARD_DE.md
 * Prüft das Lizenzmodell ab 0.8.137:
 * - Pro = sichtbares Vollprodukt (interner Legacy-Key `eos`)
 * - Home = kleiner freigegebener Funktionsumfang
 * - alte NW1/NW1T-Schlüssel bleiben Pro/EOS-kompatibel
 * - TypeScript-Migrationsdiagnosen sind aus der sichtbaren App-Center-UI entfernt
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
/**
 * Code-Teil: read
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const errors = [];
/**
 * Code-Teil: need
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const need = (ok, msg) => { if (!ok) errors.push(msg); };

const main = read('main.js');
const moduleManager = read('ems/module-manager.js');
const app = read('www/ems-apps.js');
const html = read('www/ems-apps.html');
const ioPackage = JSON.parse(read('io-package.json'));
const pkg = JSON.parse(read('package.json'));

need(ioPackage.common && ioPackage.common.version === pkg.version, `io-package.json: Version muss ${pkg.version} sein.`);
need(main.includes('_nwExpectedEditionLicenseKey'), 'main.js: Edition-Vollschlüssel-Prüfung fehlt.');
need(main.includes("'NW1H'") && main.includes("'NW1E'"), 'main.js: NW1H/NW1E Präfixe fehlen.');
need(main.includes('_nwExpectedEditionTrialKey') && main.includes('NW1TH') && main.includes('NW1TE'), 'main.js: Edition-Testlizenzformate fehlen.');
need(main.includes('Legacy full key: keep all existing customers on the large EOS edition.'), 'main.js: Legacy-Vollschlüssel müssen als EOS behandelt werden.');
need(main.includes('legacy NW1 = EOS') || main.includes('Legacy NW1 = EOS'), 'main.js: Legacy-Hinweis für NW1=EOS fehlt.');
need(main.includes('_nwLicenseFeaturesForEdition'), 'main.js: zentraler Feature-Katalog fehlt.');
need(main.includes('peakShaving') && main.includes('storageFarm') && main.includes('multiUse'), 'main.js: EOS-only Features fehlen.');
need(main.includes('chargingManagement') && main.includes('heatingRodControl') && main.includes('thresholdControl'), 'main.js: HEMS Feature-Whitelist unvollständig.');
need(main.includes('energyWallet') && main.includes('energyWalletPro'), 'main.js: Energie-Wertkonto muss Home/EOS-Feature sein.');
need(main.includes('_nwLicenseMaxWallboxes') && main.includes('if (edition === \'hems\') return 3'), 'main.js: HEMS-Wallboxlimit 3 fehlt.');
need(main.includes('license.edition') && main.includes('license.featuresJson') && main.includes('license.maxWallboxes'), 'main.js: Lizenz-States für Edition/Features/Wallboxlimit fehlen.');
need(main.includes('license.storagePowerProfile') && main.includes('license.maxStoragePowerW'), 'main.js: Home/Pro-Speicherleistungs-States fehlen.');
need(main.includes('_nwApplyLicenseLimitsToInstallerPatch'), 'main.js: Backend-Gate für Installer-Patches fehlt.');
need(main.includes('cfgOut.license = this._nwBuildLicenseFeatureInfo()'), 'main.js: Installer-API liefert Lizenzinfo nicht aus.');
need(main.includes('sendNoStore(res)') && main.includes('Refresh the runtime license cache here'), 'main.js: Installer-API muss Lizenzcache refreshen und no-store liefern.');
need(main.includes('_nwRefreshLicenseFromConfiguredKey'), 'main.js: Lizenzstatus-Refresh aus gespeicherter Adapter-Konfiguration fehlt.');
need(main.includes("await this._nwRefreshLicenseFromConfiguredKey(false)") && main.includes("app.use(async (req, res, next)"), 'main.js: Lizenz-API/App-Center/VIS-Gate müssen die Freischaltung ohne manuellen Neustart synchronisieren.');
need(moduleManager.includes('_licenseAllowsApp'), 'ems/module-manager.js: Modulmanager-Lizenzgate fehlt.');
// Der Modulmanager besitzt einen lokalen Notfall-Fallback. Er darf nicht als veraltete
// Kopie der zentralen Lizenzmatrix auseinanderlaufen, weil andernfalls einzelne Home-Apps
// nur bei einem Importfehler unbemerkt gesperrt würden.
const featureFlags = require(path.join(root, 'ems/services/feature-flags.js'));
const fallbackMatch = moduleManager.match(/const hemsApps = new Set\(\[([^\]]*)\]\)/);
const fallbackApps = fallbackMatch
  ? fallbackMatch[1].split(',').map((entry) => entry.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
  : [];
const expectedHomeApps = typeof featureFlags.homeIncludedApps === 'function'
  ? featureFlags.homeIncludedApps().map(String)
  : [];
need(
  fallbackMatch && expectedHomeApps.length > 0
    && expectedHomeApps.every((appId) => fallbackApps.includes(appId))
    && fallbackApps.every((appId) => expectedHomeApps.includes(appId)),
  `ems/module-manager.js: Home-Fallback weicht von HOME_APP_IDS ab (fallback=${fallbackApps.join(',')}; zentral=${expectedHomeApps.join(',')}).`,
);
need(moduleManager.includes("key: 'peakShaving'") && moduleManager.includes("this._licenseAllowsApp('peak')"), 'ems/module-manager.js: Peak-Shaving muss EOS-gated sein.');
need(moduleManager.includes("key: 'chargingManagement'") && moduleManager.includes("this._licenseAllowsApp('charging')"), 'ems/module-manager.js: Lademanagement-Gate fehlt.');
need(app.includes('HEMS_APP_IDS'), 'www/ems-apps.js: HEMS-App-Whitelist fehlt.');
need(app.includes('Lizenz: ${_licenseLabel()}'), 'www/ems-apps.js: Lizenzkarte im App-Center fehlt.');
need(app.includes("if (ed === 'eos') return 'Pro'"), 'www/ems-apps.js: Vollprodukt muss sichtbar als Pro bezeichnet werden.');
need(app.includes("Home · max. 50 kW") && app.includes("Pro · frei skalierbar"), 'www/ems-apps.js: Home/Pro-Speicherleistungsprofil fehlt.');
need(html.includes('storageRatedPowerKW') && html.includes('storageLicensePowerProfile'), 'www/ems-apps.html: Speicher-Nennleistung und Lizenzprofil fehlen.');
need(app.includes('fetchLicenseInfoFallback') && app.includes('/api/license/features?t='), 'www/ems-apps.js: No-Cache-Lizenzfallback aus dem datensparsamen /api/license/features fehlt.');
need(main.includes('const featureInfo = this._nwBuildLicenseFeatureInfo()') && main.includes('eosFullAccess: !!featureInfo.eosFullAccess'), 'main.js: /api/license/info muss konsistente Feature-/EOS-Daten aus einem FeatureInfo-Snapshot liefern.');
need(app.includes('_inferLicenseFromSuccessfulInstallerGate') && app.includes('Lizenz über Backend-Gate erkannt'), 'www/ems-apps.js: App-Center-Gate-Fallback für gültige Runtime-Lizenz fehlt.');
need(main.includes('res.json({ ok: true, license: cfgOut.license, config: cfgOut'), 'main.js: Installer-API muss Lizenzdaten top-level ausgeben.');
need(app.includes('licenseBlocked') && app.includes('requiredLicense'), 'www/ems-apps.js: UI-Patch muss nicht lizenzierte Apps blockieren.');
need(app.includes('function _maxEvcsCount') && app.includes('els.evcsCount.max = String(_maxEvcsCount())'), 'www/ems-apps.js: HEMS-Wallboxlimit in UI fehlt.');
need(app.includes('fetchLicenseInfoFallback') && app.includes('/api/license/features?t=') && app.includes('normalizeLicenseInfo(currentConfig.license)'), 'www/ems-apps.js: App-Center muss Live-Lizenzinfo als Fallback nachladen.');
// Die AST-Grenze umfasst die tatsächliche Funktion, unabhängig von Kommentaren,
// Partner-CAS-Präfixen und Formatierung. Gezählt werden echte Aufrufe, keine
// gleichlautenden Kommentare oder nachfolgende Funktionen.
const appAst = ts.createSourceFile('www/ems-apps.js', app, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
/**
 * Code-Teil: namedFunctions
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const namedFunctions = name => {
  const matches = [];
/**
 * Code-Teil: visit
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
  const visit = node => { if (ts.isFunctionDeclaration(node) && node.name?.text === name) matches.push(node); ts.forEachChild(node, visit); };
  visit(appAst); return matches;
};
const configFunctions = namedFunctions('applyConfigToUI');
let licenseAssignIdx = -1; let rebuildIdx = -1; let setAppsIdx = -1;
if (configFunctions.length === 1 && configFunctions[0].body) {
/**
 * Code-Teil: inspect
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
  const inspect = node => {
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && ts.isIdentifier(node.left) && node.left.text === 'currentLicenseInfo'
      && ts.isCallExpression(node.right) && ts.isIdentifier(node.right.expression) && node.right.expression.text === 'normalizeLicenseInfo'
      && node.right.arguments.length === 1 && node.right.arguments[0].getText(appAst) === 'currentConfig.license') licenseAssignIdx = node.getStart(appAst);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === 'buildAppsUI' && node.arguments.length === 0) rebuildIdx = node.getStart(appAst);
      if (node.expression.text === 'setAppsFromConfig' && node.arguments.length === 1 && node.arguments[0].getText(appAst) === 'currentConfig') setAppsIdx = node.getStart(appAst);
    }
    // Verschachtelte Funktionen würden erst später laufen und dürfen diese
    // Reihenfolge der unmittelbaren Konfigurationsübernahme nicht erfüllen.
    if (!ts.isFunctionDeclaration(node) && !ts.isFunctionExpression(node) && !ts.isArrowFunction(node)) ts.forEachChild(node, inspect);
  };
  inspect(configFunctions[0].body);
}
need(configFunctions.length === 1 && licenseAssignIdx >= 0 && rebuildIdx > licenseAssignIdx && setAppsIdx > rebuildIdx, 'www/ems-apps.js: App-Liste muss nach Lizenzladung neu gebaut werden, sonst bleibt EOS bei "Keine Apps verfügbar" hängen.');
const licenseFallbackFunctions = namedFunctions('fetchLicenseInfoFallback');
let safeFeatureRequest = false; let rawLicenseRequest = false;
if (licenseFallbackFunctions.length === 1 && licenseFallbackFunctions[0].body) {
/**
 * Code-Teil: inspect
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
  const inspect = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'fetchJson') {
      const endpoint = node.arguments[0]; const options = node.arguments[1];
      const prefix = ts.isBinaryExpression(endpoint) && ts.isStringLiteral(endpoint.left) ? endpoint.left.text : ts.isStringLiteral(endpoint) ? endpoint.text : '';
      const noStore = options && ts.isObjectLiteralExpression(options) && options.properties.some(property => ts.isPropertyAssignment(property) && property.name.getText(appAst) === 'cache' && ts.isStringLiteral(property.initializer) && property.initializer.text === 'no-store');
      if (prefix === '/api/license/features?t=' && noStore) safeFeatureRequest = true;
      if (prefix.startsWith('/api/license/info')) rawLicenseRequest = true;
    }
    ts.forEachChild(node, inspect);
  };
  inspect(licenseFallbackFunctions[0].body);
}
need(safeFeatureRequest && !rawLicenseRequest, 'www/ems-apps.js: Lizenzfallback muss ausschließlich Features ohne Lizenzschlüssel/UUID und mit cache:no-store abrufen.');
const loadConfigFunctions = namedFunctions('loadConfig');
let liveFallbackCall = -1; let applyLoadedConfigCall = -1;
if (loadConfigFunctions.length === 1 && loadConfigFunctions[0].body) {
/**
 * Code-Teil: inspect
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
  const inspect = node => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === 'fetchLicenseInfoFallback') liveFallbackCall = node.getStart(appAst);
      if (node.expression.text === 'applyConfigToUI') applyLoadedConfigCall = node.getStart(appAst);
    }
    if (!ts.isFunctionDeclaration(node) && !ts.isFunctionExpression(node) && !ts.isArrowFunction(node)) ts.forEachChild(node, inspect);
  };
  inspect(loadConfigFunctions[0].body);
}
need(liveFallbackCall >= 0 && applyLoadedConfigCall > liveFallbackCall, 'www/ems-apps.js: loadConfig muss Live-Features vor Übernahme in die App-Oberfläche nachladen.');

need(!html.includes('TypeScript Shadow'), 'www/ems-apps.html: sichtbare TypeScript-Shadow-Diagnose muss entfernt bleiben.');
need(!html.includes('energyFlowTsMode'), 'www/ems-apps.html: sichtbarer TS-Schaltmodus muss entfernt bleiben.');
need(!html.includes('shadowDiagnostics'), 'www/ems-apps.html: sichtbarer Shadow-Container muss entfernt bleiben.');

if (errors.length) {
  console.error('[license-editions] Fehler:');
  errors.forEach((e) => console.error(' - ' + e));
  process.exit(1);
}
console.log('[license-editions] OK: Home/Pro-Lizenzmodell (intern HEMS/EOS) und Speicherleistungsprofile sind verdrahtet.');
