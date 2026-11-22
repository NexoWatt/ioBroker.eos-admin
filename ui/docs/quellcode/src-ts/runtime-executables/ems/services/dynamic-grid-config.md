# src-ts/runtime-executables/ems/services/dynamic-grid-config.ts

Prüft die eigenständige App für den dynamischen Netzanschluss und bildet vollständige Messzyklen.

**Daten und Wirkung:** Reine Normalisierung herstellerunabhängiger Zuordnungen; M0 stammt aus Allgemein. Keine Objektabfragen und keine Geräteschreibzugriffe.

**Bei Änderungen:** Entwürfe und Aktivierung trennen, physische Aliasidentität sowie Einheiten prüfen und fehlende Rückmeldungen niemals als Nullleistung behandeln.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./nvp-topology` | [src-ts/runtime-executables/ems/services/nvp-topology.ts](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts) |
| `./dynamic-grid-pv` | [src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts)
- [src-ts/runtime-executables/lib/dynamic-grid-config-api.ts](../../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L20) | v | Number.isFinite |
| [`plain`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L21) | v | Array.isArray, Object.getPrototypeOf |
| [`has`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L22) | v, k | Object.prototype.hasOwnProperty.call, plain |
| [`identifier`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L23) | v | – |
| [`stateId`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L24) | v | v.trim |
| [`dynamicGridDefaults`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L29) | – | – |
| [`resolveGeneralMeasurement`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L41) | rootConfig, options | finite, sample, stateId |
| [`unit`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L43) | id | – |
| [`sample`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L46) | id | id.trim, unit |
| [`validateDynamicGridConfig`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L56) | raw, options | JSON.stringify, Number.isSafeInteger, activationErrors.push, add, arrays, config.points.push, config.storages.push, dynamicGridDefaults, entry.name.slice, errors.push, finite, groups.get, groups.has, groups.set (weitere in der Quelle) |
| [`add`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L58) | path, code, message, activation | – |
| [`num`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L63) | v, path, min, max, required | add, finite |
| [`id`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L68) | v, path, required | add, stateId, v.trim |
| [`resolve`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L72) | v, path, writing | add, resolver, stateId |
| [`measurement`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L79) | value, path, soc | add, id, num, plain, resolve |
| [`readMeasurementConfig`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L92) | value, path | measurement, num, plain |
| [`arrays`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L96) | name, max | Array.isArray, add |
| [`sourceIds`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L130) | m | – |
| [`output`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L135) | v, path, signed | add, id, num, plain |
| [`dynamicGridReadIds`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L241) | topology | ids.add, measurement, stateId |
| [`measurement`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L243) | m | ids.add, measurement, stateId |
| [`dynamicGridWriteIds`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L255) | topology | ids.add, stateId |
| [`readScalar`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L263) | mapping, state, now | finite, has, invalid |
| [`invalid`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L264) | reason | – |
| [`collectDynamicSnapshot`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L277) | topology, states, now | Date.now, Math.max, Math.min, Object.freeze, collect, finite, readScalar, record, result.errors.push, times.push |
| [`collect`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L280) | mapping | Math.abs, Math.max, Math.min, collect, readMeasurement |
| [`record`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts#L286) | target, id, sample, path | Object.freeze, result.errors.push, times.push |
