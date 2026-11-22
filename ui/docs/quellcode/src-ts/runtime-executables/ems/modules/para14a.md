# src-ts/runtime-executables/ems/modules/para14a.ts

Überführt die konfigurierte §14a-Anforderung in Begrenzungen für steuerbare Verbraucher und veröffentlicht den wirksamen Zustand.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./base` | [src-ts/runtime-executables/ems/modules/base.ts](../../../../../../src-ts/runtime-executables/ems/modules/base.ts) |
| `../consumers` | [src-ts/runtime-executables/ems/consumers/index.ts](../../../../../../src-ts/runtime-executables/ems/consumers/index.ts) |
| `../../lib/ts-mirrors/ems/para14a/para14a-constraint` | [src-ts/ems/para14a/para14a-constraint.ts](../../../../../../src-ts/ems/para14a/para14a-constraint.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`num`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L44) | v, dflt | Number, Number.isFinite |
| [`finiteOrNull`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L49) | v | Number, Number.isFinite, v.trim |
| [`clamp`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L62) | v, minV, maxV | Number, Number.isFinite |
| [`safeIdPart`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L75) | s | String, v.toLowerCase |
| [`normalizeConsumerType`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L87) | t | String |
| [`normalizeControlType`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L101) | t | String |
| [`getGzf`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L112) | nSteuVE | Math.max, Math.round, Number |
| [`Para14aModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L154) | adapter, dpRegistry | super |
| [`Para14aModule._isEnabled`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L191) | – | – |
| [`Para14aModule._getCfg`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L200) | – | – |
| [`Para14aModule._setState`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L211) | id, val, options | Date.now, Number, Number.isFinite, this._stateCache.delete, this._stateCache.get, this._stateCache.keys, this._stateCache.set, this.adapter.setStateAsync, this.adapter.updateValue |
| [`Para14aModule._setStateIfChanged`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L241) | id, val | this._setState |
| [`Para14aModule._setStateForced`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L250) | id, val, ts | this._setState |
| [`Para14aModule._roundW`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L266) | v, dflt | Math.round, Number, Number.isFinite |
| [`Para14aModule._limitJsonText`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L276) | v, maxLen | JSON.stringify, Number.isFinite, s.slice |
| [`Para14aModule._getAdapterNumberFromCache`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L299) | key, dflt | Number, Number.isFinite, this.adapter._nwGetNumberFromCache |
| [`Para14aModule._newAuditSessionId`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L326) | ts | Date.now, Math.random, Math.round |
| [`Para14aModule._getAuditControlSignature`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L342) | snapshot | JSON.stringify, Math.max, Math.round, String, num, this._roundW |
| [`Para14aModule._buildAuditSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L369) | data | Array.isArray, Math.max, Math.round, String, num, s.failedConsumers.map, this._roundW |
| [`Para14aModule._getAuditChangeReason`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L408) | prev, next, fallback | reasons.push, reasons.slice |
| [`Para14aModule._initAuditLoggingStates`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L440) | mk | mk, this.adapter.setObjectNotExistsAsync |
| [`Para14aModule._setupAuditHistory`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L511) | – | String, this._setStateIfChanged, this.adapter._nwDetectInfluxInstance, this.adapter._nwEnsureInfluxCustom, this.adapter._nwEnsurePara14aInfluxInstance |
| [`Para14aModule._emitAuditEvent`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L630) | snapshot, eventType, reason, result | Array.isArray, Date.now, Math.max, Math.round, String, num, snapshot.failedConsumers.slice, this._limitJsonText, this._roundW, this._setStateForced, this.adapter.log.info |
| [`Para14aModule._writeAuditTrace`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L704) | snapshot, force | Date.now, Math.max, Math.round, Number, String, num, this._roundW, this._setStateForced |
| [`Para14aModule._handleAuditLogging`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L742) | snapshot | Date.now, Object.assign, this._emitAuditEvent, this._getAuditChangeReason, this._getAuditControlSignature, this._newAuditSessionId, this._writeAuditTrace |
| [`Para14aModule._buildLoadsFromConfig`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L801) | – | Array.isArray, String, clamp, loads.push, loads.sort, normalizeConsumerType, normalizeControlType, num, safeIdPart, this._getCfg, usedIds.add, usedIds.has |
| [`Para14aModule._getStorageControlAuthorityForPara14a`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L876) | – | Array.isArray, farmRows.filter, this.adapter._nwGetStorageControlAuthority |
| [`Para14aModule._singleStorageHasWritableActuatorForPara14a`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L923) | root, storageCfg | String, directTargets.some, e3dcTargets.some, enableTargets.some, limitTargets.some, runtimeKeys.some, this.dp.getEntry |
| [`Para14aModule._getAutomaticConsumers`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L999) | – | Array.isArray, String, automatic.push, automatic.sort, clamp, num, rows.forEach, this._getStorageControlAuthorityForPara14a, this._singleStorageHasWritableActuatorForPara14a |
| [`isHeatingRodSlot`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L1008) | slotCfg | String |
| [`safeSlot`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L1012) | value, fallback | Math.max, Math.min, Math.round, num |
| [`Para14aModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L1241) | – | String, mk, this._buildLoadsFromConfig, this._getCfg, this._initAuditLoggingStates, this._setupAuditHistory, this.adapter.log.warn, this.adapter.setObjectNotExistsAsync, this.dp.upsert, this.dp?.upsert |
| [`mk`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L1255) | id, name, type, role, writable, unit | this.adapter.setObjectNotExistsAsync |
| [`Para14aModule._readActiveSignal`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L1373) | – | Date.now, Math.max, Math.round, Number, Number.isFinite, String, num, resolvePara14aSignal, this._getCfg, this.adapter._nwGetPara14aEebusIngress, this.dp.getAgeMs, this.dp.getRaw |
| [`Para14aModule.deactivate`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L1434) | – | this._setStateIfChanged |
| [`Para14aModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/para14a.ts#L1488) | – | Array.isArray, JSON.stringify, Math.max, Math.round, Number, Number.isFinite, String, activeManualLoads.map, applySetpoint, automaticConsumers.concat, buildPara14aConstraintSnapshot, clamp, consumerAudit.failedConsumers.push, controllableEvcs.map (weitere in der Quelle) |
