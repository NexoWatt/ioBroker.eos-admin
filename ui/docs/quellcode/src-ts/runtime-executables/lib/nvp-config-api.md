# src-ts/runtime-executables/lib/nvp-config-api.ts

Validiert und versioniert die neue NVP-Topologie an der Installer-Vertrauensgrenze.

**Daten und Wirkung:** Liest konfigurierte Geräte und ioBroker-Aliasobjekte, liefert Diagnose und

**Bei Änderungen:** Aliasidentität, Versionskonflikte, Rollen, Import und native Konfiguration gemeinsam prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./http-error-boundary` | [src-ts/runtime-executables/lib/http-error-boundary.ts](../../../../../src-ts/runtime-executables/lib/http-error-boundary.ts) |
| `./config-boundary-contracts` | [src-ts/runtime-executables/lib/config-boundary-contracts.ts](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts) |
| `../ems/services/nvp-topology` | [src-ts/runtime-executables/ems/services/nvp-topology.ts](../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`currentNvpConfig`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L37) | adapter | clone, record, validateTopology, validationResult |
| [`nvpDeviceInventory`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L43) | config | Array.isArray, list.slice, pv.push, record, rows.slice, storages.push, text |
| [`resolveNvpSource`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L79) | adapter, stateId | adapter.getForeignObjectAsync, next.trim, plain, record, seen.add, seen.has, stateObject |
| [`validateNvpCandidateUncached`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L100) | adapter, raw, runtimeConfig | Array.from, Array.isArray, Math.min, Promise.all, actual.powerStateIds.some, devices.pv.some, devices.storages.find, errors.push, errors.some, nvpConfig, nvpDeviceInventory, sources.get, validateTopology, validation.errors.slice (weitere in der Quelle) |
| [`resolveSourceId`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L133) | id | sources.get |
| [`validateNvpCandidate`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L159) | adapter, raw, runtimeConfig | Date.now, JSON.stringify, Promise.race, clearTimeout, clone, job.promise.then, nvpDeviceInventory, nvpError, record, validateNvpCandidateUncached, validationCache.get, validationJobs.get, validationJobs.set, validationResult |
| [`nvpError`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L182) | status, code, message, details | createPublicHttpError |
| [`assertNvpTransitionIdle`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L187) | adapter | Number, nvpError, record |
| [`prepareNvpChange`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L199) | adapter, raw, expectedVersion, runtimeConfig | Number.isSafeInteger, assertNvpTransitionIdle, currentNvpConfig, nvpConfig, nvpError, record, validateNvpCandidate |
| [`assertNvpPersistence`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L215) | adapter, nextRuntime | JSON.stringify, Number.isSafeInteger, assertNvpTransitionIdle, currentNvpConfig, nvpDeviceInventory, nvpError, record, validateNvpCandidate |
| [`nvpCurrentStatus`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L234) | adapter, rawConfig | Number.isSafeInteger, currentNvpConfig, record |
| [`nvpPublicSnapshot`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L250) | adapter | currentNvpConfig, nvpCurrentStatus, nvpDeviceInventory, record |
| [`registerNvpConfigApi`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L261) | app, adapter, requireInstaller, hooks | app.get, app.post |
| [`noStore`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L262) | res | res.setHeader |
| [`failure`](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts#L263) | res, error | res.status, safeConfigurationFailure |
