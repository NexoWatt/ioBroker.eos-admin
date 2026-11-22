# src-ts/ems/charging-management/charging-normal-source.ts

Normalisiert die Mess- und Konfigurationsbasis, aus der die typisierte Ladeplanung ihre Werte erhält.

**Daten und Wirkung:** Verarbeitet die in den TypeScript-Signaturen beschriebenen Eingaben. Ergebnisse gehen über die Export-/Import-Verknüpfungen an Aufrufer; erzeugte JavaScript-Spiegel werden aus dieser Quelle gebaut.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/ems/charging-management/charging-normal-source.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/ems/charging-management/index.ts](../../../../../src-ts/ems/charging-management/index.ts)
- [src-ts/runtime-executables/ems/modules/charging-management.ts](../../../../../src-ts/runtime-executables/ems/modules/charging-management.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`asRecord`](../../../../../src-ts/ems/charging-management/charging-normal-source.ts#L101) | value | Array.isArray |
| [`str`](../../../../../src-ts/ems/charging-management/charging-normal-source.ts#L105) | value, fallback | String |
| [`boolValue`](../../../../../src-ts/ems/charging-management/charging-normal-source.ts#L110) | value, fallback | Number.isFinite, value.trim |
| [`finiteNumber`](../../../../../src-ts/ems/charging-management/charging-normal-source.ts#L121) | value, fallback | Number, Number.isFinite |
| [`isProductive`](../../../../../src-ts/ems/charging-management/charging-normal-source.ts#L126) | component | boolValue |
| [`componentSource`](../../../../../src-ts/ems/charging-management/charging-normal-source.ts#L130) | component, fallback | str |
| [`componentFallbackReason`](../../../../../src-ts/ems/charging-management/charging-normal-source.ts#L134) | component, fallback | str |
| [`unique`](../../../../../src-ts/ems/charging-management/charging-normal-source.ts#L139) | values | String, out.includes, out.push |
| [`collectComponentWarnings`](../../../../../src-ts/ems/charging-management/charging-normal-source.ts#L148) | component | Array.isArray, warnings.map |
| [`buildChargingNormalSourceDecision`](../../../../../src-ts/ems/charging-management/charging-normal-source.ts#L157) | input | Date.now, Math.max, Math.round, asRecord, blockers.push, boolValue, collectComponentWarnings, componentFallbackReason, componentSource, finiteNumber, isProductive, str, unique |
| [`buildChargingEvcsJavascriptRemovalDecision`](../../../../../src-ts/ems/charging-management/charging-normal-source.ts#L334) | input | Array.isArray, Date.now, asRecord, blockers.push, boolValue, finiteNumber, normalSource.warnings.map, str, unique |
