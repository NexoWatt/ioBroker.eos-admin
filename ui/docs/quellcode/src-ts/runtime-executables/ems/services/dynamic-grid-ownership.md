# src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts

Reserviert die generischen Ausgänge der App Dynamischer Netzanschluss

**Daten und Wirkung:** Liest ausschließlich Konfiguration und vorab aufgelöste

**Bei Änderungen:** Alte und neue Ausgangsverträge, Alias-Schreibketten, finale Generation und bestätigte Übergabe gemeinsam prüfen.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/grid-constraints.ts](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts)
- [src-ts/runtime-executables/ems/modules/storage-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts)
- [src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts)
- [src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts)
- [src-ts/runtime-executables/lib/dynamic-grid-config-api.ts](../../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts)
- [src-ts/runtime-executables/main.ts](../../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`ownershipConfigs`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts#L21) | adapter | Array.isArray, configs.push |
| [`dynamicGridHasControl`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts#L37) | adapter | ownershipConfigs |
| [`getDynamicGridOwnedTargets`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts#L43) | adapter | Array.isArray, add, ownershipConfigs |
| [`add`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts#L45) | raw | Array.isArray, next.trim, raw.trim, targets.add, targets.has |
| [`hasCompleteDynamicGridOwnership`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts#L65) | adapter | Array.isArray, complete, ownershipConfigs |
| [`complete`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts#L67) | id | Array.isArray, chain.every, chain.trim, id.trim |
| [`isDynamicGridOwned`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts#L83) | adapter, targetId | Array.isArray, getDynamicGridOwnedTargets, targetId.trim, targets.has |
| [`isDynamicGridWriter`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts#L92) | owner | owner.trim |
| [`isDynamicGridEmergencyWriter`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts#L96) | owner | owner.trim |
| [`checkDynamicGridWriteTarget`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts#L107) | adapter, targetId | Object.create, Promise.race, aliasJobs.get, aliasJobs.set, clearTimeout, dynamicGridHasControl, hasCompleteDynamicGridOwnership, isDynamicGridOwned, job.finally, jobs.get, jobs.set |
