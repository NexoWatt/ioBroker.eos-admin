/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: scripts/verify-shadow-diagnostics-usability.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * scripts/verify-shadow-diagnostics-usability.js
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
 * Original-Hash: 4e70f78a6a736b2f5830ed48a3772c940cceda65c3fb6381436f1ed2ea440894
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
 * Code-Teil: verify-shadow-diagnostics-usability
 *
 * Zweck:
 * Prüft die Bedienbarkeit der App-Center-Shadow-Diagnose. Die JSON-Anzeige muss
 * stabil außerhalb des automatisch neu gerenderten Diagnosebereichs öffnen können.
 *
 * Zusammenhang:
 * In 0.7.83 wird kein <details>-Element mehr direkt in der Karte genutzt, weil der
 * Statusbereich alle 2 Sekunden neu rendert. Stattdessen öffnet ein separater Dialog.
 * Dadurch bleibt JSON lesbar, ohne EMS-, Energiefluss- oder Heizstabwerte zu ändern.
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const jsPath = path.join(root, 'www', 'ems-apps.js');
const text = fs.readFileSync(jsPath, 'utf8');

const need = [
  '_shadowDecodeDisplayText',
  '_shadowEscape',
  '_openShadowJsonDialog',
  'JSON dauerhaft öffnen',
  'nwShadowJsonDialogBackdrop',
  "shadow.ok === false) return 'warn'",
];
const missing = need.filter((x) => !text.includes(x));
if (missing.length) {
  console.error('[shadow-diagnostics-usability] missing anchors:', missing.join(', '));
  process.exit(1);
}
console.log('[shadow-diagnostics-usability] OK: JSON-Dialog stabil und Warn-/Fehlerstatus getrennt.');
