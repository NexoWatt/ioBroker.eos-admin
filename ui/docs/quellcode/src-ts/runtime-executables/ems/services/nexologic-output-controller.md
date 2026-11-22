# src-ts/runtime-executables/ems/services/nexologic-output-controller.ts

Verbindet NexoLogic-Ausgangsanforderungen mit dem kontrollierten Aktor-Schreibpfad.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./actuator-command-contract` | [src-ts/runtime-executables/ems/services/actuator-command-contract.ts](../../../../../../src-ts/runtime-executables/ems/services/actuator-command-contract.ts) |
| `./actuator-shadow-arbiter` | [src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/nexologic-engine.ts](../../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`text`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L129) | value | String |
| [`safePart`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L133) | value, fallback | text |
| [`num`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L138) | value, fallback, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`bool`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L144) | value, fallback | text |
| [`normalizeBudgetMode`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L153) | value | text |
| [`normalizeBudgetAction`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L160) | value, requestedValue, fixedPowerW | text |
| [`valueIsActive`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L166) | value, tolerance | Math.abs, Number, Number.isFinite, s.replace, text |
| [`idleValueFor`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L177) | value | Number, Number.isFinite, s.replace, value.trim |
| [`stable`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L189) | value, depth | Array.isArray, Math.round, Number.isFinite, Object.keys, String, value.map |
| [`valuesMatch`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L204) | actual, requested, tolerance | Math.abs, Number, Number.isFinite, bool, stable |
| [`NexoLogicOutputController.constructor`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L221) | adapter | – |
| [`NexoLogicOutputController.outputKey`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L226) | meta | safePart |
| [`NexoLogicOutputController.ownerFor`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L230) | meta | safePart |
| [`NexoLogicOutputController.runtime`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L234) | meta | Promise.resolve, safePart, this.outputKey, this.ownerFor, this.runtimes.get, this.runtimes.set |
| [`NexoLogicOutputController.stopValue`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L263) | row | Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String, bool, idleValueFor, num, text, textRaw.replace, textRaw.toLowerCase |
| [`NexoLogicOutputController.enqueue`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L283) | row, task | next.catch |
| [`NexoLogicOutputController.safeStop`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L291) | meta, reasonRaw | text, this.baseResult, this.enqueue, this.publish, this.runtime, this.stopValue |
| [`NexoLogicOutputController.registerOutput`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L315) | meta | Object.entries, name.endsWith, normalizeBudgetMode, text, this.adapter.setObjectNotExistsAsync, this.publish, this.runtime |
| [`NexoLogicOutputController.setState`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L376) | id, value | stable, this.adapter.getStateAsync, this.adapter.setStateAsync |
| [`NexoLogicOutputController.publish`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L385) | row, result | JSON.stringify, Math.round, Promise.all, pairs.map |
| [`NexoLogicOutputController.contractCfg`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L411) | params | Math.round, bool, num |
| [`NexoLogicOutputController.readbackId`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L421) | meta | bool, text |
| [`NexoLogicOutputController.readbackTolerance`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L427) | meta | num |
| [`NexoLogicOutputController.readActual`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L431) | meta | Date.now, Math.max, Math.round, Number, Number.isFinite, num, this.adapter.getForeignStateAsync, this.readbackId |
| [`NexoLogicOutputController.exclusiveAuthority`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L446) | targetId, owner | Array.isArray, row.activeOwners.map |
| [`NexoLogicOutputController.clearRetry`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L453) | row | this.adapter._nwClearTimeout, timerApi.clearTimeout |
| [`NexoLogicOutputController.scheduleRetry`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L462) | row, value, delayMs, reason, generation | Math.max, Math.min, Math.round, bool, this.adapter._nwSetTimeout, this.clearRetry, timerApi.setTimeout |
| [`run`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L466) | – | this.enqueue |
| [`NexoLogicOutputController.baseResult`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L478) | row, value | Math.abs, Math.max, normalizeBudgetMode, num, text |
| [`NexoLogicOutputController.request`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L509) | meta, value | Date.now, Math.abs, Math.max, Math.round, bool, idleValueFor, normalizeBudgetAction, normalizeBudgetMode, num, text, this.baseResult, this.enqueue, this.intents.delete, this.intents.get (weitere in der Quelle) |
| [`NexoLogicOutputController.getBudgetIntents`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L577) | – | Array.from, this.intents.values |
| [`NexoLogicOutputController.applyBudgetGrant`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L590) | keyRaw, grantRaw | Math.abs, Math.max, Math.min, Number, Number.isFinite, bool, idleValueFor, num, text, this.enqueue, this.intents.delete, this.intents.get, this.publish, this.runtimes.get (weitere in der Quelle) |
| [`NexoLogicOutputController.executeWrite`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L629) | meta, value, reasonRaw, expectedGeneration | Date.now, Math.max, Math.round, Number, Number.isFinite, String, bool, isActuatorAuthorityBlockedResult, num, priorityForOwner, text, this.baseResult, this.clearRetry, this.contract.complete (weitere in der Quelle) |
| [`NexoLogicOutputController.stop`](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts#L767) | options | row.writeChain.catch, text, this.clearRetry, this.contract.release, this.intents.clear, this.runtimes.values, this.safeStop |
