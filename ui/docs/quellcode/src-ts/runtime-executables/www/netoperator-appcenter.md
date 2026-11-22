# src-ts/runtime-executables/www/netoperator-appcenter.ts

Bindet die Netzbetreiber-Schnittstelle und ihre Einrichtung an das App-Center an.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`setStatus`](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts#L25) | – | – |
| [`getEdition`](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts#L26) | – | – |
| [`byId`](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts#L29) | id | document.getElementById |
| [`esc`](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts#L30) | value | String |
| [`value`](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts#L31) | id, fallback | String, byId |
| [`checked`](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts#L35) | id | byId |
| [`num`](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts#L36) | id, fallback, min, max | Math.max, Math.min, Number, Number.isFinite, value |
| [`loadDrivers`](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts#L41) | – | Array.isArray, fetch, response.json, setStatus |
| [`driverOptions`](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts#L55) | selected | driverRows.slice, options.join, options.push, rows.map, rows.some, rows.unshift |
| [`defaultConfig`](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts#L70) | – | – |
| [`render`](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts#L88) | mount, config, appEnabled | String, byId, defaultConfig, driverOptions, esc, getEdition, loadDrivers, reload.addEventListener, source.addEventListener, test.addEventListener, window.NW_RUNTIME?.url |
| [`apply`](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts#L176) | config, edition | document.getElementById, render |
| [`collect`](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts#L183) | existing, appEnabled, edition | Math.round, String, checked, defaultConfig, getEdition, num, value |
| [`setup`](../../../../../src-ts/runtime-executables/www/netoperator-appcenter.ts#L212) | options | – |
