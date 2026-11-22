# src-ts/runtime-executables/www/report-common.ts

Bündelt gemeinsame Datums-, Darstellungs- und Bedienhilfen für Berichtsseiten.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/report-common.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

Kein direkter Import innerhalb des erfassten Quellbereichs. Mögliche HTML-, Adapter-, Build- oder dynamische Einstiege sind separat zu prüfen.

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`el`](../../../../../src-ts/runtime-executables/www/report-common.ts#L65) | id | document.getElementById |
| [`nwReportLocaleTag`](../../../../../src-ts/runtime-executables/www/report-common.ts#L67) | – | String, lang.startsWith, window.NexoWattI18n.localeTag |
| [`getNf`](../../../../../src-ts/runtime-executables/www/report-common.ts#L74) | decimals | String, nfCache.get, nfCache.set, nwReportLocaleTag |
| [`fmtNum`](../../../../../src-ts/runtime-executables/www/report-common.ts#L92) | value, decimals, fallback | Number, Number.isFinite, getNf |
| [`fmtMoney`](../../../../../src-ts/runtime-executables/www/report-common.ts#L102) | value, fallback | Number, Number.isFinite, getNf |
| [`fmtPrice`](../../../../../src-ts/runtime-executables/www/report-common.ts#L112) | value, fallback | Number, Number.isFinite, getNf |
| [`fmtKwh`](../../../../../src-ts/runtime-executables/www/report-common.ts#L122) | value, fallback | Number, Number.isFinite, getNf |
| [`fmtPower`](../../../../../src-ts/runtime-executables/www/report-common.ts#L132) | value, fallback | Math.abs, Number, Number.isFinite, getNf |
| [`pad2`](../../../../../src-ts/runtime-executables/www/report-common.ts#L144) | n | String |
| [`toInputValue`](../../../../../src-ts/runtime-executables/www/report-common.ts#L151) | ms | Number, Number.isFinite, d.getTime, d.getTimezoneOffset, local.toISOString |
| [`parseInputValue`](../../../../../src-ts/runtime-executables/www/report-common.ts#L163) | raw, fallbackMs | Date.now, Date.parse, Number, Number.isFinite, Number.isNaN, String |
| [`fmtDateTime`](../../../../../src-ts/runtime-executables/www/report-common.ts#L178) | ms, fallback | Number, Number.isFinite, nwReportLocaleTag |
| [`fmtDate`](../../../../../src-ts/runtime-executables/www/report-common.ts#L189) | ms, fallback | Number, Number.isFinite, nwReportLocaleTag |
| [`fmtTime`](../../../../../src-ts/runtime-executables/www/report-common.ts#L200) | ms, fallback | Number, Number.isFinite, nwReportLocaleTag |
| [`setUrlParams`](../../../../../src-ts/runtime-executables/www/report-common.ts#L211) | params | Object.keys, url.toString, window.history.replaceState |
| [`getQuery`](../../../../../src-ts/runtime-executables/www/report-common.ts#L228) | name | – |
| [`downloadText`](../../../../../src-ts/runtime-executables/www/report-common.ts#L237) | filename, text, type | String, URL.createObjectURL, a.click, a.remove, document.body.appendChild, document.createElement, setTimeout, window.NW_RUNTIME?.url |
| [`escapeHtml`](../../../../../src-ts/runtime-executables/www/report-common.ts#L254) | value | String |
| [`setupTopbar`](../../../../../src-ts/runtime-executables/www/report-common.ts#L268) | activeTab | document.addEventListener, el, menuBtn.addEventListener, menuDropdown.addEventListener, window.NW_RUNTIME?.url |
