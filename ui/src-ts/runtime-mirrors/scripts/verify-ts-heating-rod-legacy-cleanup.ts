/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: scripts/verify-ts-heating-rod-legacy-cleanup.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * scripts/verify-ts-heating-rod-legacy-cleanup.js
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
 * Original-Hash: 5dd876a2380fdffc5f8b4742e6005559fc1ded38ca0ebe5b40e118429b8b3cc4
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
 * Datei: scripts/verify-ts-heating-rod-legacy-cleanup.js
 *
 * Zweck:
 * Prüft 0.7.113: Die alte JavaScript-Heizstabreferenz ist nach TS-Normalpfad-Übernahme
 * aus dem normalen Entscheidungsweg herausgelöst und als Diagnose-/Cleanup-Block geführt.
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
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
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
/**
 * Code-Teil: fail
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function fail(msg) { console.error('[heating-rod-legacy-cleanup] ERROR: ' + msg); process.exit(1); }
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
function must(file, marker, label) { if (!read(file).includes(marker)) fail(`${file}: fehlt ${label || marker}`); }

must('ems/modules/heating-rod-control.js', '_buildHeatingRodLegacyReferenceDiagnostic', 'Legacy-Referenzdiagnose');
must('ems/modules/heating-rod-control.js', '_buildHeatingRodTsLegacyCleanupState', 'Legacy-Cleanup-State Builder');
must('ems/modules/heating-rod-control.js', 'heatingRod.summary.tsLegacyReferenceJson', 'Legacy-Referenz-State');
must('ems/modules/heating-rod-control.js', 'heatingRod.summary.tsLegacyCleanupJson', 'Legacy-Cleanup-State');
must('ems/modules/heating-rod-control.js', 'legacy-reference-compact-diagnostic-only', 'kompakte Cleanup-Stage');
must('ems/modules/heating-rod-control.js', 'decisionImpact', 'Entscheidungseinfluss-Feld');
must('ems/modules/heating-rod-control.js', 'diagnostic-and-emergency-fallback', 'JS-Rolle Diagnose und Notfallback');
must('ems/modules/heating-rod-control.js', 'legacyJsReferenceUsedForDecision', 'Referenzpfad Entscheidungsmarker');
must('www/ems-apps.js', 'JS-Referenz Cleanup', 'App-Center zeigt Cleanup');
must('www/ems-apps.js', 'JS-Entscheidungseinfluss', 'App-Center zeigt Entscheidungseinfluss');
console.log('[heating-rod-legacy-cleanup] OK: JS-Heizstabreferenz ist als kompakter Diagnose/Cleanup-Pfad vorbereitet.');
