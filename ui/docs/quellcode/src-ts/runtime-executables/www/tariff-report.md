# src-ts/runtime-executables/www/tariff-report.ts

Bereitet Tarifverläufe und tarifbezogene Auswertungen für die Berichtsseite auf.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/tariff-report.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`defaultFromMs`](../../../../../src-ts/runtime-executables/www/tariff-report.ts#L70) | – | C.getQuery, C.parseInputValue, Date.now |
| [`defaultToMs`](../../../../../src-ts/runtime-executables/www/tariff-report.ts#L81) | – | C.getQuery, C.parseInputValue, Date.now |
| [`fillInputs`](../../../../../src-ts/runtime-executables/www/tariff-report.ts#L92) | – | C.el, C.toInputValue, defaultFromMs, defaultToMs |
| [`getRange`](../../../../../src-ts/runtime-executables/www/tariff-report.ts#L104) | – | C.el, C.parseInputValue, Math.max, defaultFromMs, defaultToMs |
| [`renderFlags`](../../../../../src-ts/runtime-executables/www/tariff-report.ts#L120) | meta | C.el, items.forEach, items.push |
| [`renderSummary`](../../../../../src-ts/runtime-executables/www/tariff-report.ts#L142) | summary, meta | C.el, C.fmtKwh, C.fmtMoney, C.fmtNum, C.fmtPrice, items.forEach, items.push |
| [`renderTable`](../../../../../src-ts/runtime-executables/www/tariff-report.ts#L172) | intervals | Array.isArray, C.el, empty.classList.toggle, rows.forEach |
| [`renderMeta`](../../../../../src-ts/runtime-executables/www/tariff-report.ts#L203) | meta | C.el, C.fmtDateTime, parts.join, parts.push, renderFlags |
| [`load`](../../../../../src-ts/runtime-executables/www/tariff-report.ts#L225) | – | C.el, C.setUrlParams, empty.classList.remove, encodeURIComponent, fetch, getRange, renderMeta, renderSummary, renderTable |
| [`loadAndPrint`](../../../../../src-ts/runtime-executables/www/tariff-report.ts#L258) | – | load, window.print |
| [`exportCsv`](../../../../../src-ts/runtime-executables/www/tariff-report.ts#L271) | – | Array.isArray, C.downloadText, String, lines.join, rows.forEach, start.getDate, start.getFullYear, start.getMonth |
| [`init`](../../../../../src-ts/runtime-executables/www/tariff-report.ts#L300) | – | C.el, C.setupTopbar, backBtn.addEventListener, exportBtn.addEventListener, fillInputs, fromInput.addEventListener, load, printBtn.addEventListener, reloadBtn.addEventListener, toInput.addEventListener |
