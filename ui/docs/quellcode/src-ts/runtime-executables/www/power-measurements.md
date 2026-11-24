# src-ts/runtime-executables/www/power-measurements.ts

Vereinheitlicht die Anzeige realer Ladeleistungen und die Prüfung

**Daten und Wirkung:** Liest nur Messwerte und Metadaten. Ein gültiger manuell

**Bei Änderungen:** Echte Nullwerte, manuelle Zuordnungen, ungültige Statuswerte,

[Originalquelle](../../../../../src-ts/runtime-executables/www/power-measurements.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`record`](../../../../../src-ts/runtime-executables/www/power-measurements.ts#L23) | value | Array.isArray |
| [`number`](../../../../../src-ts/runtime-executables/www/power-measurements.ts#L25) | value | Number.isFinite |
| [`resolveEvcsPower`](../../../../../src-ts/runtime-executables/www/power-measurements.ts#L27) | input | number |
| [`validatePowerReference`](../../../../../src-ts/runtime-executables/www/power-measurements.ts#L33) | value | common.unit.trim, number, record |
