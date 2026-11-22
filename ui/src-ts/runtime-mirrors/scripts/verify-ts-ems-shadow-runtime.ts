/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: scripts/verify-ts-ems-shadow-runtime.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * scripts/verify-ts-ems-shadow-runtime.js
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
 * Original-Hash: 4e6e8b55efe7cf96bc895f502834d553b4093fc4fcdb96911f764f50fddb8b4d
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
 * Datei: scripts/verify-ts-ems-shadow-runtime.js
 *
 * Zweck:
 * Prüft den neuen 0.7.77-Shadow-Vergleich für Core-Limits und Heizstab.
 * Der Check stellt sicher, dass die Runtime nur Diagnose schreibt und die
 * produktive JS-Logik nicht durch TS-Spiegel überschrieben wird.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

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
function fail(msg) {
  console.error(`[ts-ems-shadow] ERROR: ${msg}`);
  process.exit(1);
}

/**
 * Code-Teil: mustRead
 *
 * Zweck:
 * Automatisch markierter Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
function mustRead(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) fail(`Missing file: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

/**
 * Code-Teil: requireText
 * Zweck: Stellt sicher, dass ein bestimmter Shadow-Codeanker vorhanden ist.
 * Zusammenhang: Dieser Check verhindert, dass der TS-Shadow-Vergleich versehentlich
 * wieder entfernt wird, ohne dass publish:check rot wird.
 */
function requireText(file, text) {
  const content = mustRead(file);
  if (!content.includes(text)) fail(`${file} does not contain required marker: ${text}`);
}

requireText('ems/modules/core-limits.js', '_runCoreBudgetTsShadowComparison');
requireText('ems/modules/core-limits.js', 'ems.budget.tsShadowJson');
requireText('ems/modules/core-limits.js', 'core-limits-ts-shadow');
requireText('ems/modules/heating-rod-control.js', '_runHeatingRodTsShadowComparison');
requireText('ems/modules/heating-rod-control.js', 'heatingRod.summary.tsShadowJson');
requireText('ems/modules/heating-rod-control.js', 'heating-rod-ts-shadow');

const coreMirror = require(path.join(ROOT, 'lib/ts-mirrors/ems/core-limits/core-budget.js'));
const hrMirror = require(path.join(ROOT, 'lib/ts-mirrors/ems/heating-rod/heating-rod-decision.js'));

if (!coreMirror || typeof coreMirror.buildCoreBudgetSnapshot !== 'function') fail('Core budget mirror export missing.');
if (!hrMirror || typeof hrMirror.evaluateHeatingRodDecision !== 'function') fail('Heating rod mirror export missing.');

/**
 * Code-Teil: Core-Budget-Runtime-Probe
 * Zweck: Prüft fachlich, dass der TS-Spiegel 0-Werte und Speicherreserve korrekt
 * behandelt. Diese Probe entspricht dem sicheren Shadow-Vergleich, nicht der
 * produktiven Umschaltung.
 */
const core = coreMirror.buildCoreBudgetSnapshot({
  ts: 1,
  pvSurplusW: 2500,
  gridImportW: 0,
  gridImportLimitW: 30000,
  storageReserveW: 500,
  storageReserveSocPct: 100,
  allowStorageDischarge: false,
});
if (core.pv.effectiveW !== 2000) fail(`Unexpected core PV effectiveW: ${core.pv.effectiveW}`);
if (!core.storageReserveActive) fail('Core storageReserveActive should be true.');

/**
 * Code-Teil: Heizstab-Runtime-Probe
 * Zweck: Prüft, dass der TS-Heizstabspiegel die größte passende Stufe auswählt,
 * ohne produktive Heizstablogik zu benötigen.
 */
const decision = hrMirror.evaluateHeatingRodDecision({
  ts: 1,
  device: {
    id: 'test',
    name: 'Test Heizstab',
    enabled: true,
    mode: 'pvAuto',
    stages: [
      { stage: 1, powerW: 1000 },
      { stage: 2, powerW: 2000 },
      { stage: 3, powerW: 3000 },
    ],
    storageReserveW: 0,
    storageReserveSocPct: 20,
    allowGridImport: false,
    allowStorageDischarge: true,
  },
  availablePvW: 2100,
  availableTotalW: 2100,
  storageSocPct: 80,
});
if (decision.targetStage !== 2 || decision.targetPowerW !== 2000) {
  fail(`Unexpected heating rod decision: ${JSON.stringify(decision)}`);
}

console.log('[ts-ems-shadow] OK: Core-Limits-/Heizstab-Shadow-Runtime geprüft.');
