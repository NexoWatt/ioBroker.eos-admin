# src-ts/runtime-executables/ems/modules/prime-mover-control.ts

Kapselt gemeinsame Betriebs- und Leistungsanforderungen steuerbarer Erzeuger.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./base` | [src-ts/runtime-executables/ems/modules/base.ts](../../../../../../src-ts/runtime-executables/ems/modules/base.ts) |
| `../services/actuator-shadow-arbiter` | [src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts) |
| `../services/actuator-command-contract` | [src-ts/runtime-executables/ems/services/actuator-command-contract.ts](../../../../../../src-ts/runtime-executables/ems/services/actuator-command-contract.ts) |
| `../services/measurement-freshness` | [src-ts/runtime-executables/ems/services/measurement-freshness.ts](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts) |
| `../services/accepted-power-effects` | [src-ts/runtime-executables/ems/services/accepted-power-effects.ts](../../../../../../src-ts/runtime-executables/ems/services/accepted-power-effects.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/bhkw-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/bhkw-control.ts)
- [src-ts/runtime-executables/ems/modules/generator-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/generator-control.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`numberOr`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L139) | value, fallback | Number, Number.isFinite |
| [`finiteNumberOrNull`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L144) | value | Number, Number.isFinite |
| [`bounded`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L150) | value, fallback, min, max | Math.max, Math.min, numberOr |
| [`text`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L154) | value | String |
| [`parseBoolean`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L158) | value | text |
| [`stateTimestamp`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L167) | state, field | Number, Number.isFinite |
| [`normalizeCommandProfile`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L172) | raw | text |
| [`emptySnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L179) | mapped | – |
| [`PrimeMoverControlModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L194) | adapter, dpRegistry, spec | super |
| [`PrimeMoverControlModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L201) | – | this.ensureObjects, this.loadConfig |
| [`PrimeMoverControlModule.root`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L207) | – | – |
| [`PrimeMoverControlModule.deviceId`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L208) | index | – |
| [`PrimeMoverControlModule.deviceBase`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L209) | device | this.root |
| [`PrimeMoverControlModule.userBase`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L210) | device | this.root |
| [`PrimeMoverControlModule.automaticOwner`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L211) | device | this.root |
| [`PrimeMoverControlModule.manualOwner`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L212) | device | this.root |
| [`PrimeMoverControlModule.ensureObjects`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L214) | – | channel, state, this.deviceId, this.root |
| [`channel`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L215) | id, name | this.adapter.setObjectNotExistsAsync |
| [`state`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L216) | id, name, type, role, writable, defaultValue, unit | this.adapter.setObjectNotExistsAsync |
| [`PrimeMoverControlModule.loadConfig`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L279) | – | Array.isArray, Math.max, Math.min, Math.round, bounded, devices.push, devices.sort, normalizeCommandProfile, numberOr, text, this.adapter.getStateAsync, this.adapter.setStateAsync, this.deviceId, this.dp.upsert (weitere in der Quelle) |
| [`PrimeMoverControlModule.getRuntime`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L353) | id | this.runtime.get, this.runtime.set |
| [`PrimeMoverControlModule.setIfChanged`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L361) | id, value | Date.now, Number.isFinite, this.adapter.getStateAsync, this.adapter.setStateAsync, this.adapter.updateValue, this.stateCache.delete, this.stateCache.get, this.stateCache.keys, this.stateCache.set |
| [`PrimeMoverControlModule.readForeign`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L371) | objectId, maxAgeMs, parse | Date.now, Math.max, emptySnapshot, parse, stateTimestamp, this.adapter.getForeignStateAsync |
| [`PrimeMoverControlModule.socSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L396) | maxAgeMs | Date.now, Math.max, Number, Number.isFinite, finiteNumberOrNull, stateTimestamp, text, this.adapter._nwGetStorageControlAuthority, this.adapter.getStateAsync, this.adapter?._nwGetCacheAgeMs, this.adapter?._nwGetNumberFromCacheFresh, this.adapter?._nwGetStorageFarmRuntimeInfo, this.dp?.getAgeMs, this.dp?.getNumberFresh |
| [`PrimeMoverControlModule.nvpSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L474) | device | Date.now, Math.max, resolveCurrentNvpSnapshot |
| [`PrimeMoverControlModule.operationalFeedback`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L478) | device | this.readForeign |
| [`PrimeMoverControlModule.actuatorIds`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L493) | device | Array.from |
| [`PrimeMoverControlModule.exclusiveAuthority`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L497) | device, owner | ids.every, owner.startsWith, this.actuatorIds |
| [`PrimeMoverControlModule.contractConfig`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L508) | device | – |
| [`PrimeMoverControlModule.publishContract`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L518) | device, owner, command, result, readback | Math.max, Math.round, numberOr, text, this.deviceBase, this.setIfChanged |
| [`PrimeMoverControlModule.rawWrite`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L534) | objectId, value | String, isActuatorAuthorityBlockedResult, text, this.adapter.setForeignStateAsync, this.adapter?.log?.warn, this.root |
| [`PrimeMoverControlModule.writeContext`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L548) | device, owner, reason, manual, releaseAuthority | priorityForOwner, this.exclusiveAuthority, this.root |
| [`PrimeMoverControlModule.pulseWrite`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L561) | device, objectId, owner, reason, manual | this.adapter._nwSetTimeout, this.adapter.setTimeout, this.adapter?.log?.warn, this.root, this.writeContext, withActuatorShadowContext |
| [`reset`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L565) | – | this.root, this.writeContext, withActuatorShadowContext |
| [`PrimeMoverControlModule.writeDesired`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L581) | device, desiredRunning, owner, reason, manual | this.pulseWrite, this.writeContext, withActuatorShadowContext |
| [`PrimeMoverControlModule.requestState`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L601) | device, desiredRunning, reason, manual, readback | Date.now, Math.min, recordAcceptedActuatorTransition, this.actuatorContract.complete, this.actuatorContract.confirmFromReadback, this.actuatorContract.defer, this.actuatorContract.prepare, this.actuatorContract.result, this.automaticOwner, this.contractConfig, this.deviceBase, this.getRuntime, this.manualOwner, this.operationalFeedback (weitere in der Quelle) |
| [`PrimeMoverControlModule.updateRuntimeFromReadback`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L658) | device, snapshot, now | Math.max, Math.min, this.getRuntime |
| [`PrimeMoverControlModule.normalizeMode`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L678) | value | text |
| [`PrimeMoverControlModule.canActuate`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L685) | device | – |
| [`PrimeMoverControlModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts#L690) | – | Date.now, Math.ceil, Math.max, Math.min, Math.round, Number, text, this.adapter.getStateAsync, this.canActuate, this.deviceBase, this.getRuntime, this.normalizeMode, this.nvpSnapshot, this.operationalFeedback (weitere in der Quelle) |
