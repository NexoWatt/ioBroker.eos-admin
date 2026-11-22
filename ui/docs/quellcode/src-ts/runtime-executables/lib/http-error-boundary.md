# src-ts/runtime-executables/lib/http-error-boundary.ts

Ordnet Parserfehler festen Antworten zu und bewahrt die interne Herkunft fachlicher Konfigurationsfehler.

**Daten und Wirkung:** Fremde Fehler werden nur über eigene Dateneigenschaften klassifiziert; fachliche Fehler erhalten einen unveränderlichen WeakMap-Vertrag.

**Bei Änderungen:** Parser- und unerwartete Routenfehler mit echten HTTP-Negativtests prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/http-error-boundary.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/nexologic-engine.ts](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts)
- [src-ts/runtime-executables/lib/dynamic-grid-config-api.ts](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts)
- [src-ts/runtime-executables/lib/mesh-coordinator-contract.ts](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-contract.ts)
- [src-ts/runtime-executables/lib/mesh-coordinator.ts](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts)
- [src-ts/runtime-executables/lib/mesh-energy-service.ts](../../../../../src-ts/runtime-executables/lib/mesh-energy-service.ts)
- [src-ts/runtime-executables/lib/nvp-config-api.ts](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts)
- [src-ts/runtime-executables/lib/partner-config-api.ts](../../../../../src-ts/runtime-executables/lib/partner-config-api.ts)
- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`policy`](../../../../../src-ts/runtime-executables/lib/http-error-boundary.ts#L21) | status, error, message | Object.freeze |
| [`ownData`](../../../../../src-ts/runtime-executables/lib/http-error-boundary.ts#L33) | value, key | Object.getOwnPropertyDescriptor, Object.prototype.hasOwnProperty.call |
| [`safeHttpFailure`](../../../../../src-ts/runtime-executables/lib/http-error-boundary.ts#L39) | error | ownData |
| [`createPublicHttpError`](../../../../../src-ts/runtime-executables/lib/http-error-boundary.ts#L70) | status, code, message, details | Object.assign, Object.freeze, details.slice, message.slice, publicErrors.set |
| [`safeConfigurationFailure`](../../../../../src-ts/runtime-executables/lib/http-error-boundary.ts#L84) | error | publicErrors.get |
| [`safeSourceFailureCode`](../../../../../src-ts/runtime-executables/lib/http-error-boundary.ts#L93) | error | ownData |
