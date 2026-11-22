# src-ts/runtime-executables/ems/services/admin-overview-publisher.ts

Veröffentlicht eine lesbare EMS-Übersicht und einen von langen Regelzyklen unabhängigen Diagnose-Heartbeat.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`AdminOverviewTimeoutError.constructor`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L107) | label, timeoutMs | super |
| [`waitWithTimeout`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L120) | operation, timeoutMs, label | – |
| [`mapWithConcurrency`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L154) | items, concurrency, worker | Array.from, Math.max, Math.min, Promise.all |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L168) | value, fallback | Number, Number.isFinite |
| [`nullableNumber`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L173) | value | Number, Number.isFinite |
| [`bool`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L179) | value, fallback | String |
| [`text`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L188) | value, fallback, maxLength | Math.max, String, normalized.slice |
| [`parseJson`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L194) | value, fallback | JSON.parse, String |
| [`stateValue`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L199) | adapter, key, fallback | Object.prototype.hasOwnProperty.call |
| [`firstValue`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L207) | adapter, keys, fallback | stateValue |
| [`newestTimestamp`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L221) | adapter, keys, fallback | Math.max, Math.round, finite, stateValue |
| [`severityRank`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L230) | value | – |
| [`maxSeverity`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L234) | values | values.reduce |
| [`normalizeLimiter`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L238) | value | text |
| [`isInformationalLimiter`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L250) | value | normalizeLimiter |
| [`activeLimiterForDisplay`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L255) | value | isInformationalLimiter, normalizeLimiter |
| [`humanizeLimiter`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L260) | value | normalizeLimiter, text |
| [`statusFromAudit`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L293) | audit, paraFallback, storageWriteOk, forecastFresh | Array.isArray, activeLimiterForDisplay, text, wallboxes.some |
| [`compactWallbox`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L304) | row | Math.max, Math.round, finite, humanizeLimiter, normalizeLimiter, text |
| [`buildOverviewContract`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L322) | adapter, now | Array.isArray, Boolean, Date.now, Math.abs, Math.max, Math.round, activeLimiterForDisplay, audit.wallboxes.map, auditWallboxes.filter, auditWallboxes.slice, auditWallboxes.some, bool, finite, firstValue (weitere in der Quelle) |
| [`eventSignature`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L825) | contract | JSON.stringify |
| [`overviewEvent`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L839) | contract, now | messageParts.join, messageParts.push |
| [`normalizeAuditEvent`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L857) | event | Math.max, Math.round, String, finite, humanizeLimiter, isInformationalLimiter, normalizeLimiter, nullableNumber, text |
| [`AdminOverviewPublisher.constructor`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L920) | adapter, options | Math.max, Math.min, Math.round, finite |
| [`AdminOverviewPublisher.initialize`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L932) | – | Date.now, setInterval, this.adapter._nwSetInterval, this.adapter.setInterval, this.adapter.subscribeForeignStatesAsync, this.ensureStates, this.heartbeat, this.primeStates, this.restoreEvents, this.startHeartbeatTimer, this.tick, this.updateInternalHealth |
| [`callback`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L955) | – | this.tick |
| [`AdminOverviewPublisher.startHeartbeatTimer`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L961) | – | setInterval, this.adapter._nwSetInterval, this.adapter.setInterval |
| [`callback`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L963) | – | this.heartbeat |
| [`AdminOverviewPublisher.clearTimer`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L969) | timer | clearInterval, this.adapter._nwClearInterval, this.adapter.clearInterval |
| [`AdminOverviewPublisher.stop`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L978) | – | this.clearTimer, this.inFlight.clear |
| [`AdminOverviewPublisher.tick`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L990) | reason | Date.now, Math.max, String, buildOverviewContract, eventSignature, overviewEvent, text, this.dedupeAndTrimEvents, this.events.push, this.heartbeat, this.ingestAuditEvents, this.logCycleDegradation, this.noteCycleFailure, this.primeVolatileStates (weitere in der Quelle) |
| [`AdminOverviewPublisher.heartbeat`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1041) | reason, forceSummary | Date.now, JSON.stringify, Math.max, Math.min, buildOverviewContract, finite, mapWithConcurrency, text, this.setIfChanged, this.updateInternalHealth |
| [`AdminOverviewPublisher.resetCycleDiagnostics`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1092) | – | – |
| [`AdminOverviewPublisher.noteCycleFailure`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1100) | kind, timedOut, message | text |
| [`AdminOverviewPublisher.updateInternalHealth`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1109) | now, status, cycleDurationMs | – |
| [`AdminOverviewPublisher.logCycleDegradation`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1130) | now, status, reason | this.adapter.log?.warn |
| [`AdminOverviewPublisher.runOperation`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1143) | kind, label, timeoutMs, task | Boolean, Promise.resolve, String, operation.then, text, this.inFlight.get, this.inFlight.set, this.noteCycleFailure, waitWithTimeout |
| [`cleanup`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1156) | – | this.inFlight.delete, this.inFlight.get |
| [`AdminOverviewPublisher.readState`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1176) | id | this.runOperation |
| [`AdminOverviewPublisher.writeState`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1180) | id, value | this.runOperation |
| [`AdminOverviewPublisher.ensureObject`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1186) | id, object | this.runOperation |
| [`AdminOverviewPublisher.publishHealthStates`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1196) | now, status, cycleDurationMs, reason | Math.max, Math.min, Math.round, buildOverviewContract, finite, mapWithConcurrency, text |
| [`AdminOverviewPublisher.ensureStates`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1225) | – | ensure, this.ensureObject |
| [`ensure`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1229) | id, name, type, role, def | this.ensureObject |
| [`AdminOverviewPublisher.restoreEvents`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1268) | – | Array.isArray, parseJson, parsed.filter, this.readState |
| [`AdminOverviewPublisher.primeStates`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1299) | – | mapWithConcurrency |
| [`AdminOverviewPublisher.primeVolatileStates`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1324) | – | mapWithConcurrency |
| [`AdminOverviewPublisher.prime`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1338) | key, maxAgeMs | Date.now, Number, Number.isFinite, this.adapter.updateValue, this.readState |
| [`AdminOverviewPublisher.ingestAuditEvents`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1356) | – | Array.isArray, normalizeAuditEvent, parseJson, parsed.slice, stateValue, this.events.push |
| [`AdminOverviewPublisher.dedupeAndTrimEvents`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1365) | – | – |
| [`AdminOverviewPublisher.publish`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1378) | contract | Date.now, JSON.stringify, Math.max, Math.min, Object.entries, finite, mapWithConcurrency, results.some, this.events.slice, this.setIfChanged |
| [`AdminOverviewPublisher.setIfChanged`](../../../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts#L1416) | id, value, force | JSON.stringify, this.lastValues.get, this.lastValues.set, this.writeState |
