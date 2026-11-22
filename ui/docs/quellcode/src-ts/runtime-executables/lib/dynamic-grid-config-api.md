# src-ts/runtime-executables/lib/dynamic-grid-config-api.ts

Speichert die eigenständige App Dynamischer Netzanschluss atomar und

**Daten und Wirkung:** Allgemein liefert M0; ioBroker-Objekte liefern Rechte, Typen,

**Bei Änderungen:** Aliasrechte, CAS, Allgemein-Abhängigkeiten, Entwürfe und aktive Übergaben an sämtlichen Speicherwegen gemeinsam prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./http-error-boundary` | [src-ts/runtime-executables/lib/http-error-boundary.ts](../../../../../src-ts/runtime-executables/lib/http-error-boundary.ts) |
| `./config-boundary-contracts` | [src-ts/runtime-executables/lib/config-boundary-contracts.ts](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts) |
| `../ems/services/dynamic-grid-config` | [src-ts/runtime-executables/ems/services/dynamic-grid-config.ts](../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts) |
| `../ems/services/dynamic-grid-ownership` | [src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts](../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts) |
| `../ems/services/dynamic-grid-pv` | [src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts](../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`dynamicGridError`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L53) | status, code, message, details | createPublicHttpError |
| [`dynamicGridAppState`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L56) | root | record |
| [`currentDynamicGridConfig`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L62) | adapter | Number.isSafeInteger, clone, dynamicGridDefaults, plain, record |
| [`generalInputs`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L72) | root | record, text |
| [`dynamicGridSignature`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L77) | root | JSON.stringify, Object.fromEntries, clone, dynamicGridAppState, dynamicGridDefaults, generalInputs, plain, record, recordArray |
| [`resolveDynamicGridObject`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L86) | adapter, stateId, direction | adapter.getForeignObjectAsync, chain.push, next.trim, plain, record, seen.add, seen.has, stateObject |
| [`existingMappedIds`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L106) | root | walk |
| [`walk`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L108) | value, depth | Object.entries, child.trim, ids.add, walk |
| [`mappingContracts`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L119) | config | add, record |
| [`add`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L121) | rawMapping, direction, path, type | record, rows.push, text |
| [`validateDynamicGridCandidateUncached`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L144) | adapter, raw, root, active | Array.from, Math.min, Object.create, Object.entries, Promise.all, activationErrors.push, adapter._nwLicenseAllowsAppId, adapter._nwLicenseMaxStorages, add, config.pvAssignments.some, contracts.push, dedupe, dynamicConfig, dynamicGridError (weitere in der Quelle) |
| [`add`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L159) | value, direction, required | text, wanted.has, wanted.set |
| [`resolveSourceId`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L188) | id | reads.get |
| [`resolveWriteId`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L189) | id | writes.get |
| [`resolveWriteId`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L202) | id | writes.get |
| [`dedupe`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L206) | issues | issues.map |
| [`validateDynamicGridCandidate`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L223) | adapter, raw, root, active | Date.now, JSON.stringify, Promise.race, adapter._nwLicenseMaxStorages, cache.get, clearTimeout, clone, dynamicGridAppState, dynamicGridError, existingMappedIds, generalInputs, job.promise.then, jobs.get, jobs.set (weitere in der Quelle) |
| [`withDynamicApp`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L242) | root, app | record |
| [`validateApp`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L245) | raw, current | dynamicGridError, plain |
| [`prepareDynamicGridChange`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L250) | adapter, raw, expectedVersion, appRaw, root | Number.isSafeInteger, currentDynamicGridConfig, dynamicConfig, dynamicGridAppState, dynamicGridError, record, validateApp, validateDynamicGridCandidate, withDynamicApp |
| [`prepareDynamicGridInstallerPatch`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L264) | adapter, patch, submitted, explicitVersion | adapter.nwApplyInstallerPatchToRuntimeConfig, clone, dynamicGridAppState, dynamicGridDefaults, dynamicGridSignature, own, plain, prepareDynamicGridChange, record |
| [`assertDynamicGridPersistence`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L291) | adapter, nextRoot | Number, adapter._nwPrepareDynamicGridTransition, currentDynamicGridConfig, dynamicGridAppState, dynamicGridDefaults, dynamicGridError, dynamicGridSignature, plain, record, validateDynamicGridCandidate |
| [`dynamicGridCurrentStatus`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L313) | adapter | Date.now, Number.isFinite, Object.fromEntries, currentDynamicGridConfig, dynamicGridAppState, record |
| [`dynamicGridSnapshot`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L332) | adapter, preparedValidation | adapter._nwLicenseMaxStorages, currentDynamicGridConfig, dynamicGridAppState, dynamicGridCurrentStatus, record, rootIssues.map, validateDynamicGridCandidate |
| [`registerDynamicGridApi`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L340) | app, adapter, requireInstaller, hooks | app.get, app.post |
| [`noStore`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L341) | res | res.setHeader |
| [`fail`](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts#L342) | res, error | res.status, safeConfigurationFailure |
