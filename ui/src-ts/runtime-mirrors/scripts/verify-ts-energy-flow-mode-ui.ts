/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: scripts/verify-ts-energy-flow-mode-ui.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * scripts/verify-ts-energy-flow-mode-ui.js
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
 * Original-Hash: 682eca33e40e7cd5ec1b6d1ee41eea8a2dae828b08776b79eb8d4728f14a71a1
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
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
/**
 * Code-Teil: read
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
/**
 * Code-Teil: assertContains
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function assertContains(rel, needle){
  const txt = read(rel);
  if (!txt.includes(needle)) {
    console.error(`[ts-energy-flow-mode-ui] FEHLT in ${rel}: ${needle}`);
    process.exit(1);
  }
}
/**
 * Code-Teil: assertNotContains
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function assertNotContains(rel, needle){
  const txt = read(rel);
  if (txt.includes(needle)) {
    console.error(`[ts-energy-flow-mode-ui] SOLL NICHT SICHTBAR SEIN in ${rel}: ${needle}`);
    process.exit(1);
  }
}
/**
 * Ab 0.8.3 bleibt der Energiefluss-TS-Modus intern konfigurierbar, die sichtbare
 * Migrations-/Shadow-Bedienfläche wird aber aus dem App-Center entfernt.
 */
assertNotContains('www/ems-apps.html', 'energyFlowTsMode');
assertNotContains('www/ems-apps.html', 'energyFlowTsProductionAllowed');
assertContains('www/ems-apps.js', 'collectEnergyFlowTsMigrationFromUi');
assertContains('www/ems-apps.js', 'applyEnergyFlowTsModeToUi');
assertContains('www/ems-apps.js', 'renderEnergyFlowTsModeStatus');
assertContains('www/ems-apps.js', 'patch.tsMigration');
assertContains('main.js', "'tsMigration'");
assertContains('main.js', 'tsMigration: (n.tsMigration');
assertContains('main.js', '_nwBuildEnergyFlowTsEffectivePlan');
console.log('[ts-energy-flow-mode-ui] OK: Energiefluss-TS-Modus ist intern erhalten, sichtbare Migrations-UI ist entfernt.');
