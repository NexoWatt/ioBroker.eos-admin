/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: scripts/verify-ts-heating-rod-js-fallback-hard-only.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * scripts/verify-ts-heating-rod-js-fallback-hard-only.js
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
 * Original-Hash: fac868973693f592a844d6f52cf9a0488a8d219b5b429c96f04c6f399df7fc2a
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
const fs=require('fs'); const path=require('path'); const root=path.resolve(__dirname,'..');
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
const read=(r)=>fs.readFileSync(path.join(root,r),'utf8');
/**
 * Code-Teil: fail
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const fail=(m)=>{console.error('[heating-rod-js-fallback-hard-only] ERROR: '+m);process.exit(1);};
/**
 * Code-Teil: must
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
const must=(t,m,l)=>{if(!t.includes(m))fail(l+' fehlt: '+m)};
const js=read('ems/modules/heating-rod-control.js'); const ui=read('www/ems-apps.js');
for(const [m,l] of [['jsFallbackLimitedToHardBlockers','Runtime markiert harte Fallbackbegrenzung'],['jsFallbackMode','Fallbackmodus wird dokumentiert'],['legacyJsReferenceMode','Legacy-JS-Referenzmodus'],['referenceMismatches','JS-Referenzmismatches'],['blockingReferenceMismatches','Schaltmismatches werden getrennt'],["fallback('ts-js-stage-mismatch'",'Zielstufenabweichung bleibt harter Fallback'],['normalPathTakenOverCount','Normalpfad-Übernahmen']]) must(js,m,'runtime: '+l);
must(ui,'JS-Fallback-Modus','App-Center Fallbackmodus'); must(ui,'JS-Referenz','App-Center JS-Referenz');
if(js.includes('mismatches = normalPathReady ? [] : blockingReferenceMismatches')) fail('Normalpfad darf Zielstufenabweichungen nicht ausblenden.');
console.log('[heating-rod-js-fallback-hard-only] OK: Heizstab-JS-Pfad bleibt für harte Fehler und Zielstufenkonflikte aktiv.');
