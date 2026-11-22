# src-ts/frontend/live-dashboard-format.ts

Formatiert produktive LIVE-Dashboard-Werte mit einheitlichen Zahlen- und Einheitenregeln.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../src-ts/frontend/live-dashboard-format.ts) · [Gesamtübersicht](../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/www/app.ts](../../../../src-ts/runtime-executables/www/app.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`normalizeDashboardNumber`](../../../../src-ts/frontend/live-dashboard-format.ts#L46) | value | Number, Number.isFinite |
| [`formatDashboardPower`](../../../../src-ts/frontend/live-dashboard-format.ts#L62) | value, unit | n.toFixed, normalizeDashboardNumber |
| [`formatDashboardPowerSigned`](../../../../src-ts/frontend/live-dashboard-format.ts#L79) | value, unit | Math.abs, abs.toFixed, normalizeDashboardNumber |
| [`formatDashboardEnergyKwh`](../../../../src-ts/frontend/live-dashboard-format.ts#L98) | value | Math.abs, n.toFixed, normalizeDashboardNumber |
| [`formatDashboardFlowPower`](../../../../src-ts/frontend/live-dashboard-format.ts#L114) | value, decimals | Math.max, Math.min, Math.round, Number, Number.isFinite, normalizeDashboardNumber |
| [`runLiveDashboardFormatSmoke`](../../../../src-ts/frontend/live-dashboard-format.ts#L128) | – | formatDashboardEnergyKwh, formatDashboardFlowPower, formatDashboardPower, formatDashboardPowerSigned |
