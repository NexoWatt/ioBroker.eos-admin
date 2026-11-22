# src-ts/adapter/state-cache.ts

Normalisiert Zugriffe auf gespeicherte ioBroker-Werte und unterscheidet fehlende Werte von gültigen Null-/False-Werten.

**Daten und Wirkung:** Verarbeitet die in den TypeScript-Signaturen beschriebenen Eingaben. Ergebnisse gehen über die Export-/Import-Verknüpfungen an Aufrufer; erzeugte JavaScript-Spiegel werden aus dieser Quelle gebaut.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../src-ts/adapter/state-cache.ts) · [Gesamtübersicht](../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `../contracts/adapter-api` | [src-ts/contracts/adapter-api.ts](../../../../src-ts/contracts/adapter-api.ts) |
| `../contracts/iobroker-states` | [src-ts/contracts/iobroker-states.ts](../../../../src-ts/contracts/iobroker-states.ts) |
| `../contracts/units` | [src-ts/contracts/units.ts](../../../../src-ts/contracts/units.ts) |

**Direkt importiert von:**

- [src-ts/adapter/api-state.ts](../../../../src-ts/adapter/api-state.ts)
- [src-ts/adapter/index.ts](../../../../src-ts/adapter/index.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`hasOwn`](../../../../src-ts/adapter/state-cache.ts#L60) | obj, key | Object.prototype.hasOwnProperty.call |
| [`pickRawValue`](../../../../src-ts/adapter/state-cache.ts#L73) | raw | hasOwn |
| [`normalizeStateEntry`](../../../../src-ts/adapter/state-cache.ts#L90) | id, raw | hasOwn, pickRawValue |
| [`isStateValuePresent`](../../../../src-ts/adapter/state-cache.ts#L115) | entry | – |
| [`isStateFreshEnough`](../../../../src-ts/adapter/state-cache.ts#L129) | entry, options | Date.now, Math.max, Number, Number.isFinite, isStateValuePresent |
| [`readFirstAvailableState`](../../../../src-ts/adapter/state-cache.ts#L150) | cache, keys, fallback | isStateValuePresent, normalizeStateEntry |
| [`readCachedNumber`](../../../../src-ts/adapter/state-cache.ts#L162) | cache, key, fallback | Number, Number.isFinite, readFirstAvailableState |
| [`readCachedBoolean`](../../../../src-ts/adapter/state-cache.ts#L169) | cache, key, fallback | readFirstAvailableState, value.trim |
| [`readCachedString`](../../../../src-ts/adapter/state-cache.ts#L182) | cache, key, fallback | String, readFirstAvailableState |
| [`buildApiStateResponse`](../../../../src-ts/adapter/state-cache.ts#L197) | input | Array.isArray, Date.now, Object.entries, include.includes, isStateValuePresent, normalizeStateEntry |
| [`createInfoConnectionUpdate`](../../../../src-ts/adapter/state-cache.ts#L218) | value, reason, ts | Date.now |
