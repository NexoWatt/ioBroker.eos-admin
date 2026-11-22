# src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts

Führt lokale und übergeordnete PV-Grenzen sowie vorhandene EVU-Stufen zu genau einem Generation-Sollwert je zugeordnetem Wechselrichter zusammen.

**Daten und Wirkung:** Frische Messungen in W, generische DP-Verträge und reservierte Speicherintervalle hinein; getrennte Rechenpläne und bewachte Schreibaufträge hinaus.

**Bei Änderungen:** M0 enthält M1 bereits. Ladefreigaben sind keine garantierten Senken, Generation-Obergrenzen keine Mindestproduktion und Schreib-ACKs keine physische Wirkung.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./nvp-topology` | [src-ts/runtime-executables/ems/services/nvp-topology.ts](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts) |
| `./nvp-budget` | [src-ts/runtime-executables/ems/services/nvp-budget.ts](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts) |
| `./grid-import-limit-policy` | [src-ts/runtime-executables/ems/services/grid-import-limit-policy.ts](../../../../../../src-ts/runtime-executables/ems/services/grid-import-limit-policy.ts) |
| `./dynamic-grid-ownership` | [src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts) |
| `./accepted-power-effects` | [src-ts/runtime-executables/ems/services/accepted-power-effects.ts](../../../../../../src-ts/runtime-executables/ems/services/accepted-power-effects.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/nvp-coordinator.ts](../../../../../../src-ts/runtime-executables/ems/modules/nvp-coordinator.ts)
- [src-ts/runtime-executables/ems/services/dynamic-grid-config.ts](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts)
- [src-ts/runtime-executables/lib/dynamic-grid-config-api.ts](../../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L25) | value | Number.isFinite |
| [`record`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L26) | value | Array.isArray |
| [`identifier`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L27) | value | – |
| [`stateId`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L28) | value | value.trim |
| [`fresh`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L29) | value, now, maxAgeMs | finite, record |
| [`currentDynamicPvMesh`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L33) | adapter | adapter._meshCoordinator.currentLimits |
| [`readDynamicPvStates`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L40) | adapter, ids, timeoutMs | Math.max, Math.min, Promise.race, Promise.resolve, clearTimeout, finite, job.then, readsInFlight.has, readsInFlight.set, record |
| [`release`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L44) | – | readsInFlight.delete, readsInFlight.get |
| [`requiredLegacyPvTargets`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L56) | rootConfig | Array.isArray, String, add, cfg.pvCurtailInvertersZero.forEach, record |
| [`add`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L65) | raw, kind, path | output.push, raw.trim, stateId |
| [`extractRequiredLegacyDynamicPvIds`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L84) | rootConfig | requiredLegacyPvTargets |
| [`validateLegacyDynamicPvCoverage`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L93) | rootConfig, pvAssignments, options | Array.isArray, assigned.has, errors.push, physical, required.map, requiredLegacyPvTargets |
| [`physical`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L95) | id | options.resolveWriteId, value.trim |
| [`validateDynamicPvAssignments`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L110) | raw, options | Array.isArray, raw.forEach |
| [`add`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L112) | path, code, message | errors.push |
| [`required`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L113) | path, code, message | activationErrors.push |
| [`missing`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L114) | value | – |
| [`identity`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L118) | id, write | resolve |
| [`collectDynamicPvSnapshot`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L172) | config, states, now, baseSnapshot | Date.now, Math.max, Math.min, Object.create, Object.values, collectSnapshot, errors.push, finite, readMeasurement, timestamps.push |
| [`readDynamicEvuLimits`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L190) | config, rootConfig, states, now | Date.now, Math.min, Object.create, finite, record, stateId |
| [`planDynamicPv`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L216) | config, snapshot, options | Array.isArray, Date.now, Math.floor, Math.max, Math.min, affectsPoint, byId.get, byId.has, byId.set, computePvLimit, errors.push, finite, fresh, localPv.reduce (weitere in der Quelle) |
| [`dynamicPvOwnsCycle`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L311) | adapter | dynamicGridHasControl |
| [`runDynamicGridPv`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L320) | adapter, options | Array.isArray, Date.now, JSON.stringify, Math.max, collectDynamicPvSnapshot, config.pvAssignments.find, currentDynamicPvMesh, effects, finite, getAcceptedPowerEffectSnapshot, ids.add, planDynamicPv, readDynamicEvuLimits, readDynamicPvStates (weitere in der Quelle) |
| [`stopped`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L323) | reason | Date.now |
| [`effects`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L352) | – | – |
| [`measurementFence`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts#L370) | – | Date.now, JSON.stringify, Math.max, config.points.every, config.pvAssignments.reduce, config.storages.every, currentDynamicPvMesh, finite, fresh, livePlan.requests.find, planDynamicPv, readDynamicEvuLimits, runtime.isCurrent |
