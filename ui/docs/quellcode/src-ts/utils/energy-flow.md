# src-ts/utils/energy-flow.ts

Berechnet normierte Leistungs-/Energieflussgrößen und behandelt signed sowie getrennte Lade-/Entladewerte konsistent.

**Daten und Wirkung:** Verarbeitet die in den TypeScript-Signaturen beschriebenen Eingaben. Ergebnisse gehen über die Export-/Import-Verknüpfungen an Aufrufer; erzeugte JavaScript-Spiegel werden aus dieser Quelle gebaut.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../src-ts/utils/energy-flow.ts) · [Gesamtübersicht](../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `../contracts/energy-flow` | [src-ts/contracts/energy-flow.ts](../../../../src-ts/contracts/energy-flow.ts) |
| `../contracts/units` | [src-ts/contracts/units.ts](../../../../src-ts/contracts/units.ts) |
| `./number` | [src-ts/utils/number.ts](../../../../src-ts/utils/number.ts) |

**Direkt importiert von:**

- [src-ts/resolvers/energy-flow-resolver.ts](../../../../src-ts/resolvers/energy-flow-resolver.ts)
- [src-ts/utils/index.ts](../../../../src-ts/utils/index.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`splitSignedStoragePower`](../../../../src-ts/utils/energy-flow.ts#L85) | input | Math.max, toNumberOrNull |
| [`resolveSplitStorageDps`](../../../../src-ts/utils/energy-flow.ts#L128) | input | positiveWatt |
| [`calculateStorageFromBalance`](../../../../src-ts/utils/energy-flow.ts#L159) | input | Math.max, toNumberOrNull |
| [`chooseStorageFlowResult`](../../../../src-ts/utils/energy-flow.ts#L202) | options | – |
| [`splitSignedGridPower`](../../../../src-ts/utils/energy-flow.ts#L232) | signedValue, convention | Math.max, toNumberOrNull |
| [`resolveSplitGridDps`](../../../../src-ts/utils/energy-flow.ts#L262) | importW, exportW, hasImportDp, hasExportDp | positiveWatt |
| [`hasUsableMeasuredStorageSource`](../../../../src-ts/utils/energy-flow.ts#L282) | result | – |
| [`resolveStorageFlow`](../../../../src-ts/utils/energy-flow.ts#L304) | input | resolveSplitStorageDps, splitSignedStoragePower, toNumberOrNull |
| [`resolveGridFlow`](../../../../src-ts/utils/energy-flow.ts#L365) | input | resolveSplitGridDps, splitSignedGridPower |
| [`calculateBuildingLoadFromBalance`](../../../../src-ts/utils/energy-flow.ts#L395) | input | Math.max, toNumberOrNull |
