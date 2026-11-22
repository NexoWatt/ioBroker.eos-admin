# src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts

Erfasst konkurrierende Aktor-Anforderungen und setzt Sicherheitsprioritäten sowie die konfigurierte Schreibhoheit der dynamischen Netzanschluss-App durch.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:async_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./dynamic-grid-ownership` | [src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/engine.ts](../../../../../../src-ts/runtime-executables/ems/engine.ts)
- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)
- [src-ts/runtime-executables/ems/modules/grid-constraints.ts](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts)
- [src-ts/runtime-executables/ems/modules/heating-rod-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/heating-rod-control.ts)
- [src-ts/runtime-executables/ems/modules/mesh-microgrid.ts](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts)
- [src-ts/runtime-executables/ems/modules/multi-use.ts](../../../../../../src-ts/runtime-executables/ems/modules/multi-use.ts)
- [src-ts/runtime-executables/ems/modules/nvp-coordinator.ts](../../../../../../src-ts/runtime-executables/ems/modules/nvp-coordinator.ts)
- [src-ts/runtime-executables/ems/modules/peak-shaving.ts](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts)
- [src-ts/runtime-executables/ems/modules/prime-mover-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts)
- [src-ts/runtime-executables/ems/modules/storage-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts)
- [src-ts/runtime-executables/ems/modules/thermal-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/thermal-control.ts)
- [src-ts/runtime-executables/ems/modules/threshold-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/threshold-control.ts)
- [src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts)
- [src-ts/runtime-executables/ems/services/nexologic-output-controller.ts](../../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts)
- [src-ts/runtime-executables/main.ts](../../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`isActuatorAuthorityBlockedResult`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L172) | value | – |
| [`text`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L176) | value | String |
| [`clampNumber`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L180) | value, fallback, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`normalizeArbiterMode`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L186) | raw | text |
| [`normalizeOwner`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L192) | raw | text |
| [`isManualOwner`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L197) | ownerRaw | normalizeOwner |
| [`priorityForOwner`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L201) | ownerRaw | isDynamicGridWriter, normalizeOwner |
| [`ownerDefaultLeaseMs`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L216) | ownerRaw | normalizeOwner |
| [`stableFingerprint`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L224) | value, depth | Array.isArray, Math.round, Number.isFinite, Object.keys, String, value.map |
| [`sanitizePreview`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L242) | targetId, value, depth | Array.isArray, Object.entries, SECRET_KEY_PATTERN.test, SECRET_TARGET_PATTERN.test, String, sanitizePreview, value.slice |
| [`extractWritePayload`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L259) | stateArg, ackArg | Object.prototype.hasOwnProperty.call |
| [`valuesDiffer`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L267) | a, b | Math.abs, Math.max, Math.min, Number |
| [`compactPath`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L277) | raw | text |
| [`buildHttpActuatorShadowContext`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L288) | methodRaw, pathRaw | compactPath, ownerDefaultLeaseMs, priorityForOwner, text |
| [`ActuatorShadowArbiter.constructor`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L337) | adapterOrOptions, maybeOptions | Math.round, clampNumber, normalizeArbiterMode |
| [`ActuatorShadowArbiter.init`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L352) | – | this.snapshot |
| [`ActuatorShadowArbiter.install`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L359) | adapterArg | – |
| [`shadowSetForeignStateAsync`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L371) | args | self.interceptAsync |
| [`shadowSetForeignStateChangedAsync`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L377) | args | self.interceptAsync |
| [`ActuatorShadowArbiter.uninstall`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L384) | – | – |
| [`ActuatorShadowArbiter.stop`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L394) | – | this.authorities.clear, this.blockedLogTs.clear, this.uninstall |
| [`ActuatorShadowArbiter.runWithContext`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L401) | context, fn | Number, Number.isFinite, normalizeOwner, text, this.storage.getStore, this.storage.run |
| [`ActuatorShadowArbiter.getContext`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L433) | – | this.storage.getStore |
| [`ActuatorShadowArbiter.inferOwner`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L437) | targetId | Array.isArray, normalizeOwner, row.activeOwners.map, row.owners.map, this.getContext |
| [`ActuatorShadowArbiter.resolveAuthorityIntent`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L450) | ownerRaw, context | normalizeOwner |
| [`ActuatorShadowArbiter.createEvent`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L470) | method, args | Date.now, Math.round, Number, Number.isFinite, clampNumber, extractWritePayload, ownerDefaultLeaseMs, priorityForOwner, sanitizePreview, stableFingerprint, targetId.startsWith, text, this.events.push, this.events.splice (weitere in der Quelle) |
| [`ActuatorShadowArbiter.cleanupAuthorities`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L524) | now | Date.now, this.authorities.delete, this.authorities.entries |
| [`ActuatorShadowArbiter.authorityEligible`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L530) | event | – |
| [`ActuatorShadowArbiter.authorityActiveForEvent`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L544) | authority, event | – |
| [`ActuatorShadowArbiter.decide`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L560) | event | isDynamicGridEmergencyWriter, isDynamicGridOwned, isDynamicGridWriter, isManualOwner, partnerContext.partnerControlGuard, this.authorities.delete, this.authorities.get, this.authorityActiveForEvent, this.authorityEligible, this.cleanupAuthorities, this.getContext |
| [`ActuatorShadowArbiter.updateAuthority`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L650) | event, decision | this.authorities.delete, this.authorities.get, this.authorities.set |
| [`ActuatorShadowArbiter.blockedResult`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L678) | event, authority | – |
| [`ActuatorShadowArbiter.logBlocked`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L689) | event, authority | Date.now, SECRET_TARGET_PATTERN.test, fn.call, this.blockedLogTs.get, this.blockedLogTs.set |
| [`ActuatorShadowArbiter.interceptAsync`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L705) | method, original, args | Date.now, SECRET_TARGET_PATTERN.test, String, checkDynamicGridWriteTarget, error.message.slice, isDynamicGridEmergencyWriter, isDynamicGridWriter, original.apply, this.blockedResult, this.createEvent, this.decide, this.detectConflict, this.getContext, this.logBlocked (weitere in der Quelle) |
| [`ActuatorShadowArbiter.guardSkippedWrite`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L767) | targetId, value, ack | Date.now, SECRET_TARGET_PATTERN.test, this.blockedResult, this.createEvent, this.decide, this.getContext, this.logBlocked, this.registerConflict, this.snapshot, this.updateAuthority |
| [`ActuatorShadowArbiter.detectConflict`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L805) | current | this.registerConflict, valuesDiffer |
| [`ActuatorShadowArbiter.registerConflict`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L826) | a, b, winnerOwner, resolution | Array.from, Math.max, Math.min, conflict.cycleIds.includes, conflict.cycleIds.push, conflict.cycleIds.slice, conflict.writeSeqs.includes, conflict.writeSeqs.push, conflict.writeSeqs.slice, owners.join, this.conflicts.delete, this.conflicts.entries, this.conflicts.get, this.conflicts.set |
| [`ActuatorShadowArbiter.snapshot`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L873) | now | Array.from, Date.now, Object.entries, accepted.filter, activeConflicts.filter, actuatorWrites.filter, actuatorWrites.slice, blocked.slice, events.filter, targetSummaries.slice, targets.entries, targets.get, targets.has, targets.set (weitere in der Quelle) |
| [`installActuatorShadowArbiter`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L1014) | adapter | adapter._actuatorShadowArbiter.install, arbiter.install |
| [`withActuatorShadowContext`](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts#L1036) | adapter, context, fn | arbiter.runWithContext, fn |
