# src-ts/backend/state/api-state-cache.ts

Bildet aus Cache-Einträgen die für API-Antworten benötigten Zustandsdaten.

**Daten und Wirkung:** Verarbeitet die in den TypeScript-Signaturen beschriebenen Eingaben. Ergebnisse gehen über die Export-/Import-Verknüpfungen an Aufrufer; erzeugte JavaScript-Spiegel werden aus dieser Quelle gebaut.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/backend/state/api-state-cache.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `../../contracts/api-state` | [src-ts/contracts/api-state.ts](../../../../../src-ts/contracts/api-state.ts) |
| `../../contracts/iobroker-states` | [src-ts/contracts/iobroker-states.ts](../../../../../src-ts/contracts/iobroker-states.ts) |
| `../../contracts/units` | [src-ts/contracts/units.ts](../../../../../src-ts/contracts/units.ts) |
| `../../utils/number` | [src-ts/utils/number.ts](../../../../../src-ts/utils/number.ts) |

**Direkt importiert von:**

- [src-ts/backend/state/index.ts](../../../../../src-ts/backend/state/index.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`hasOwn`](../../../../../src-ts/backend/state/api-state-cache.ts#L54) | objectValue, key | Object.prototype.hasOwnProperty.call |
| [`isObjectRecord`](../../../../../src-ts/backend/state/api-state-cache.ts#L68) | value | Array.isArray |
| [`extractPayloadValue`](../../../../../src-ts/backend/state/api-state-cache.ts#L86) | raw | hasOwn, isObjectRecord |
| [`extractTimestamp`](../../../../../src-ts/backend/state/api-state-cache.ts#L106) | raw, field | hasOwn, isObjectRecord, toNumberOrNull |
| [`normalizeApiStateEntry`](../../../../../src-ts/backend/state/api-state-cache.ts#L123) | id, raw, source | Boolean, extractPayloadValue, extractTimestamp, hasOwn, isObjectRecord, toNumberOrNull |
| [`readCacheEntry`](../../../../../src-ts/backend/state/api-state-cache.ts#L162) | cache, key | normalizeApiStateEntry |
| [`isFreshEnough`](../../../../../src-ts/backend/state/api-state-cache.ts#L180) | entry, maxAgeMs, nowMs | – |
| [`buildApiStateEnvelope`](../../../../../src-ts/backend/state/api-state-cache.ts#L196) | cache, requestedKeys, nowMs | Date.now, Object.keys, readCacheEntry |
