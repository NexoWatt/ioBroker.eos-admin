# src-ts/runtime-executables/ems/services/nvp-topology.ts

Validiert die versionierte NVP-Topologie und liest getrennte Messkontexte für M0, M1 und Speicher.

**Daten und Wirkung:** Konfiguration und ioBroker-Messzustände hinein, geprüfte Werte in W und Diagnosegründe hinaus; keine Hardware- oder State-Schreibzugriffe.

**Bei Änderungen:** Physische Bilanzgrenzen, Nullgrenzen, Aliasidentität, Zeitbezug und die serverseitige Aktivierungsprüfung gemeinsam prüfen.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts)
- [src-ts/runtime-executables/ems/modules/nvp-topology.ts](../../../../../../src-ts/runtime-executables/ems/modules/nvp-topology.ts)
- [src-ts/runtime-executables/ems/services/dynamic-grid-config.ts](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts)
- [src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts)
- [src-ts/runtime-executables/ems/services/nvp-budget.ts](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts)
- [src-ts/runtime-executables/ems/services/nvp-group-planner.ts](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts)
- [src-ts/runtime-executables/lib/nvp-config-api.ts](../../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`own`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L25) | value, key | Object.prototype.hasOwnProperty.call |
| [`plain`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L26) | value | Array.isArray, Object.getPrototypeOf |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L27) | value | Number.isFinite |
| [`identifier`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L28) | value | UNSAFE_KEYS.includes |
| [`staticDefaults`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L31) | – | – |
| [`validateTopology`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L40) | raw, options | Number.isSafeInteger, add, finite, groups.get, groups.has, groups.set, plain, pointIds.has, readArray, scalar, staticDefaults, warn |
| [`add`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L43) | path, code, message | errors.push |
| [`warn`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L44) | path, code, message | warnings.push |
| [`scalar`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L48) | obj, key, fallback | own |
| [`number`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L63) | value, path, min, max | add, finite |
| [`measurement`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L67) | value, path | add, identifier, number, options.resolveSourceId, own, plain, value.stateId.trim |
| [`readArray`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L91) | key, max | Array.isArray, add, own |
| [`affectsPoint`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L193) | connectionPointId, pointId | POINTS.includes |
| [`readMeasurement`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L202) | config, state, now | Date.now, Math.abs, finite, invalid, own, plain |
| [`invalid`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L203) | reason, ts | finite |
| [`collectSnapshot`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L218) | config, statesById, now | Date.now, Math.max, Math.min, Object.create, Object.freeze, collect, errors.push, finite |
| [`collect`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L223) | entries, key, target | Object.freeze, errors.push, readMeasurement, timestamps.push |
| [`groupStorages`](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts#L240) | config | groups.get, groups.has, groups.set, groups.values |
