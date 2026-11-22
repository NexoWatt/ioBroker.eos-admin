# src-ts/frontend/display-format.ts

Formatiert normierte Zahlen und Energie-/Leistungswerte für die Browserdarstellung.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../src-ts/frontend/display-format.ts) · [Gesamtübersicht](../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `../contracts/units` | [src-ts/contracts/units.ts](../../../../src-ts/contracts/units.ts) |

**Direkt importiert von:**

- [src-ts/frontend/dashboard-display.ts](../../../../src-ts/frontend/dashboard-display.ts)
- [src-ts/frontend/display.ts](../../../../src-ts/frontend/display.ts)
- [src-ts/frontend/index.ts](../../../../src-ts/frontend/index.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`toFiniteNumber`](../../../../src-ts/frontend/display-format.ts#L78) | value | Number, Number.isFinite |
| [`choosePowerDisplayUnit`](../../../../src-ts/frontend/display-format.ts#L94) | watt | Math.abs, Number |
| [`formatPowerValue`](../../../../src-ts/frontend/display-format.ts#L111) | value, options | Math.max, Math.min, Math.round, choosePowerDisplayUnit, toFiniteNumber |
| [`formatEnergyValue`](../../../../src-ts/frontend/display-format.ts#L135) | value, tone | Math.abs, n.toFixed, toFiniteNumber |
| [`formatPercentValue`](../../../../src-ts/frontend/display-format.ts#L152) | value, tone, clamp | Math.max, Math.min, Math.round, toFiniteNumber |
| [`toneForGridImportExport`](../../../../src-ts/frontend/display-format.ts#L169) | kind, watt | Math.max, toFiniteNumber |
| [`formatPowerW`](../../../../src-ts/frontend/display-format.ts#L194) | value, options | formatPowerValue |
| [`clampPercent`](../../../../src-ts/frontend/display-format.ts#L210) | value | Math.max, Math.min, toFiniteNumber |
| [`formatPercent`](../../../../src-ts/frontend/display-format.ts#L222) | value | formatPercentValue |
| [`formatEnergyKwh`](../../../../src-ts/frontend/display-format.ts#L232) | value | formatEnergyValue |
