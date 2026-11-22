# src-ts/runtime-executables/ems/services/arbitrage-control.ts

Begrenzt einen freigegebenen Arbitragewunsch anhand frischer Messwerte,

**Daten und Wirkung:** Reine Funktion ohne Geräte-, State-, Datei- oder Netzschreiber.

**Bei Änderungen:** Standalone ohne PV/Bilanz/dynamische App sowie Rechte-, Zeit-,

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts)
- [src-ts/runtime-executables/ems/modules/storage-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`data`](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts#L54) | value | Array.isArray, Object.create, Object.getOwnPropertyDescriptor, Object.getPrototypeOf, Object.keys, Object.prototype.hasOwnProperty.call |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts#L69) | value | Number.isFinite |
| [`time`](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts#L74) | value | Number.isSafeInteger, finite |
| [`identifier`](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts#L79) | value | – |
| [`power`](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts#L85) | value | finite |
| [`rejected`](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts#L90) | reason, request | Object.freeze |
| [`requestData`](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts#L97) | value | Object.keys, Object.prototype.hasOwnProperty.call, data, identifier, power, time |
| [`sample`](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts#L112) | value, now, maxAgeMs | data, finite, time |
| [`grant`](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts#L120) | value, now | data, power, time |
| [`limits`](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts#L129) | value | data, finite, power |
| [`selectConfiguredArbitrageRequest`](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts#L144) | rootValue, resourceId, currentRequest | Array.isArray, JSON.stringify, Object.freeze, arb.resources.map, currentRequest, data, limits, requestData, time |
| [`configuredArbitrageFallbackProfile`](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts#L169) | rootValue, resourceId | Array.isArray, arb.resources.map, data |
| [`evaluateArbitrageRequest`](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts#L187) | requestValue, contextValue | Math.abs, Math.floor, Math.max, Math.min, Object.freeze, data, grant, identifier, limits, rejected, requestData, sample, stamps.map, time |
