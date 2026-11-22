# src-ts/runtime-executables/www/evcs-report.ts

Bereitet Ladehistorie und Ladeenergie für die EVCS-Berichtsanzeige auf.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/evcs-report.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`el`](../../../../../src-ts/runtime-executables/www/evcs-report.ts#L65) | id | document.getElementById |
| [`q`](../../../../../src-ts/runtime-executables/www/evcs-report.ts#L72) | name | u.searchParams.get |
| [`fmtDate`](../../../../../src-ts/runtime-executables/www/evcs-report.ts#L82) | iso | – |
| [`nwReportLocaleTag`](../../../../../src-ts/runtime-executables/www/evcs-report.ts#L82) | – | String, lang.startsWith, window.NexoWattI18n.localeTag |
| [`_getNf`](../../../../../src-ts/runtime-executables/www/evcs-report.ts#L92) | d | String, _nfCache.get, _nfCache.set, nwReportLocaleTag |
| [`fmtNum`](../../../../../src-ts/runtime-executables/www/evcs-report.ts#L107) | n, d, { emptyZero = true } | Number, _getNf, isFinite |
| [`toISODate`](../../../../../src-ts/runtime-executables/www/evcs-report.ts#L121) | ms | String, d.getDate, d.getFullYear, d.getMonth |
| [`load`](../../../../../src-ts/runtime-executables/www/evcs-report.ts#L134) | – | Array.isArray, Date.now, Number, console.error, days.forEach, days.sort, el, encodeURIComponent, fetch, fmtNum, q, toISODate, wbs.forEach, wbs.sort |
| [`loadAndPrint`](../../../../../src-ts/runtime-executables/www/evcs-report.ts#L275) | – | load, window.print |
| [`downloadCsv`](../../../../../src-ts/runtime-executables/www/evcs-report.ts#L293) | – | Date.now, Number, a.click, a.remove, document.body.appendChild, document.createElement, encodeURIComponent, q, window.NW_RUNTIME?.url |
| [`downloadSessionsCsv`](../../../../../src-ts/runtime-executables/www/evcs-report.ts#L313) | – | Date.now, Number, a.click, a.remove, document.body.appendChild, document.createElement, encodeURIComponent, q, window.NW_RUNTIME?.url |
| [`init`](../../../../../src-ts/runtime-executables/www/evcs-report.ts#L332) | – | backBtn.addEventListener, csvBtn.addEventListener, csvSessionsBtn.addEventListener, el, load, printBtn.addEventListener, reloadBtn.addEventListener |
| [`setupTopbar`](../../../../../src-ts/runtime-executables/www/evcs-report.ts#L365) | – | document.addEventListener, document.getElementById, menuBtn.addEventListener, menuDropdown.addEventListener, window.NW_RUNTIME?.url |
