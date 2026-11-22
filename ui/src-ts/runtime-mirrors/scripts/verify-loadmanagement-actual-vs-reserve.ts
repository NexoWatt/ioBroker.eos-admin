/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: scripts/verify-loadmanagement-actual-vs-reserve.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * scripts/verify-loadmanagement-actual-vs-reserve.js
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
 * Original-Hash: dbea90b8290ea3735535ae9fdb8e5acb587c4a2813e3cf11147088f7dec6c2e9
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
function read(p){ return fs.readFileSync(p,'utf8'); }
/**
 * Code-Teil: must
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function must(file, needle){ const s=read(file); if(!s.includes(needle)){ console.error(`[loadmanagement-actual-vs-reserve] Missing in ${file}: ${needle}`); process.exit(1); } }
/**
 * Code-Teil: mustNot
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function mustNot(file, needle){ const s=read(file); if(s.includes(needle)){ console.error(`[loadmanagement-actual-vs-reserve] Forbidden in ${file}: ${needle}`); process.exit(1); } }
// Die Regression ist versionsunabhängig. Ein fest verdrahteter alter Release-String
// würde jeden späteren, fachlich korrekten Patch fälschlich blockieren.
const packageJson = JSON.parse(read('package.json'));
if (!/^\d+\.\d+\.\d+$/.test(String(packageJson.version || ''))) {
  console.error('[loadmanagement-actual-vs-reserve] package.json enthält keine gültige SemVer-Version.');
  process.exit(1);
}
must('src-ts/runtime-executables/ems/modules/charging-management.ts', 'totalFreshActualPowerW');
must('src-ts/runtime-executables/ems/modules/charging-management.ts', 'gridEvcsActualForCapW');
must('src-ts/runtime-executables/ems/modules/charging-management.ts', 'gridEvcsReserveIgnoredForCapW');
must('src-ts/runtime-executables/ems/modules/charging-management.ts', 'gridBaseLoadRawW = gridW - gridEvcsActualForCapW');
must('src-ts/runtime-executables/ems/modules/charging-management.ts', "chargingManagement.summary.totalReservedPowerW");
must('src-ts/runtime-executables/ems/modules/charging-management.ts', "actualW: evcsActualW");
must('src-ts/runtime-executables/ems/modules/charging-management.ts', 'actualPvW: evcsControlPvReserveW');
must('src-ts/runtime-executables/ems/modules/charging-management.ts', 'Nicht an pvAvailableState koppeln');
must('src-ts/runtime-executables/ems/modules/charging-management.ts', "reserveW: evcsReserveW");
must('src-ts/runtime-executables/main.ts', 'actualW: await getOwn');
must('src-ts/runtime-executables/main.ts', 'gridEvcsReserveIgnoredForCapW');
must('src-ts/runtime-executables/www/ems-apps.ts', 'EVCS Ist für Netz-Gate');
must('src-ts/runtime-executables/www/ems-apps.ts', 'Reservierung ignoriert');
must('src-ts/runtime-executables/www/ems-apps.ts', 'EVCS Reserviert');
// Prevent the previous regression: Gate A must not subtract command/reserve totalPowerW from grid power.
mustNot('src-ts/runtime-executables/ems/modules/charging-management.ts', 'gridBaseLoadRawW = gridW - (Number.isFinite(totalPowerW)');
console.log('[loadmanagement-actual-vs-reserve] OK');
