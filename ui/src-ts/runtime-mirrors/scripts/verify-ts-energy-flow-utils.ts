/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: scripts/verify-ts-energy-flow-utils.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * scripts/verify-ts-energy-flow-utils.js
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
 * Original-Hash: df5eec508ed4ff6cc8fc1bdbf2e15a53381f94b4742d93ed7c492f4ec4f78c3b
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
 * Datei: scripts/verify-ts-energy-flow-utils.js
 *
 * Zweck:
 * Prüft die Dateien des TypeScript-Migrationsschritts 0.7.60.
 *
 * Zusammenhang:
 * Dieses Skript ist bewusst normales JavaScript, damit es ohne TypeScript-Build direkt
 * in `npm run test:types` laufen kann. Es prüft nur Struktur und Kommentaranker; die
 * eigentliche Typprüfung erfolgt über `npm run typecheck`.
 */

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
function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) throw new Error(`Datei fehlt: ${rel}`);
  return fs.readFileSync(file, 'utf8');
}

/**
 * Code-Teil: Pflichtdateien prüfen.
 * Zweck: Verhindert, dass die neuen TS-Helfer versehentlich aus dem Paket fallen.
 */
const energyFlowUtils = read('src-ts/utils/energy-flow.ts');
read('src-ts/tests/energy-flow-utils-smoke.ts');

/**
 * Code-Teil: Kommentaranker prüfen.
 * Zweck: Unser Projektstandard verlangt bei jeder TS-Migration verständliche deutsche
 * Kommentare direkt am betroffenen Code-Teil.
 */
const requiredAnchors = [
  'Code-Teil: splitSignedStoragePower',
  'Code-Teil: resolveSplitStorageDps',
  'Code-Teil: calculateStorageFromBalance',
  'Code-Teil: chooseStorageFlowResult',
  'Code-Teil: splitSignedGridPower',
  'Code-Teil: resolveSplitGridDps',
  '0 W ist ein gültiger Wert',
];

const missing = requiredAnchors.filter((anchor) => !energyFlowUtils.includes(anchor));
if (missing.length) {
  console.error('[ts-energy-flow-utils] Fehlende Kommentar-/Regelanker:');
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log('[ts-energy-flow-utils] OK: TypeScript-Energiefluss-Helfer und Kommentare vorhanden.');
