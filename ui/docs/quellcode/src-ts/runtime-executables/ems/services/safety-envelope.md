# src-ts/runtime-executables/ems/services/safety-envelope.ts

Prüft Leistungsanforderungen an der gemeinsamen Sicherheitsgrenze und dokumentiert die tatsächlich freigegebene Anforderung.

**Daten und Wirkung:** Erhält Verbraucheranforderung und gemeinsamen Netzzustand; begrenzt die Anforderung vor dem Schreibpfad und hält Freigabe/Diagnose fest.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./measurement-freshness` | [src-ts/runtime-executables/ems/services/measurement-freshness.ts](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)
- [src-ts/runtime-executables/ems/modules/charging-management.ts](../../../../../../src-ts/runtime-executables/ems/modules/charging-management.ts)
- [src-ts/runtime-executables/ems/modules/core-limits.ts](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts)
- [src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts)
- [src-ts/runtime-executables/ems/modules/heating-rod-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/heating-rod-control.ts)
- [src-ts/runtime-executables/ems/modules/multi-use.ts](../../../../../../src-ts/runtime-executables/ems/modules/multi-use.ts)
- [src-ts/runtime-executables/ems/modules/nexologic-budget.ts](../../../../../../src-ts/runtime-executables/ems/modules/nexologic-budget.ts)
- [src-ts/runtime-executables/ems/modules/storage-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts)
- [src-ts/runtime-executables/ems/modules/thermal-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/thermal-control.ts)
- [src-ts/runtime-executables/ems/modules/threshold-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/threshold-control.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`strictFiniteNumber`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L134) | value, fallback | Number, Number.isFinite, value.trim |
| [`nonNegative`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L142) | value, fallback | Math.max, strictFiniteNumber |
| [`clamp`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L147) | value, min, max, fallback | Math.max, Math.min, strictFiniteNumber |
| [`boolValue`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L153) | value, fallback | – |
| [`resolveSafetyConfig`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L159) | adapter | Math.max, Math.min, Math.round, clamp, strictFiniteNumber |
| [`emptyEnvelope`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L195) | generation, now, reason | Math.max, Math.round, Number, String |
| [`ensureCycle`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L244) | adapter, generation, now | Date.now, Math.max, Math.round, Number |
| [`beginSafetyCycle`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L260) | adapter, generation, now | Date.now, emptyEnvelope, ensureCycle |
| [`markSafetyModuleStarted`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L278) | adapter, key, generation, now | Date.now, String, ensureCycle |
| [`markSafetyModuleResult`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L289) | adapter, key, ok, error, generation, now | Date.now, String, cycle.errors.push, ensureCycle, invalidateSafetyEnvelope |
| [`invalidateSafetyEnvelope`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L313) | adapter, reason, options | Array.isArray, Date.now, Math.max, Math.round, Number, String, cycle.safetyFaults.includes, cycle.safetyFaults.push, emptyEnvelope, ensureCycle, previous.invalidReasons.slice, reasons.includes, reasons.push |
| [`phaseAgeMs`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L346) | dp, key | Math.max, dp.getAgeMs, dp.getMeasurementAgeMs, strictFiniteNumber |
| [`readPhase`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L359) | dp, key, staleMs | dp.getConnectionStatus, dp.getEntry, dp.getRaw, phaseAgeMs, strictFiniteNumber |
| [`buildSafetyEnvelope`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L384) | { adapter, dp, coreSnapshot, budgetSnapshot, now = Date.now(), generation } | Array.isArray, Date.now, Math.abs, Math.max, Math.min, Math.round, Number, Object.entries, String, adapter?._meshCoordinator?.currentLimits, effectiveAppCap, ensureCycle, key.replace, label.toLowerCase (weitere in der Quelle) |
| [`effectiveAppCap`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L538) | app | Math.max, strictFiniteNumber |
| [`liveSafetyEnvelope`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L643) | adapter, dp, options | Date.now, Number, buildSafetyEnvelope |
| [`normalizeApp`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L654) | app | String, text.includes |
| [`sumOther`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L664) | map, currentKey, appMap, appFilter | Math.max, Object.entries, String, strictFiniteNumber |
| [`getSafetyRuntime`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L675) | adapter, generation | Number |
| [`blockedDecision`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L693) | request, envelope, reason, now, bypassed | Math.max, Math.round, Number, String, nonNegative, normalizeApp |
| [`evaluateFlexibleLoadRequest`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L717) | adapter, request | Date.now, Math.floor, Math.max, Math.min, Math.round, Number, Number.isFinite, Object.keys, String, adapter?._meshCoordinator?.currentLimits, blockedDecision, candidates.push, clamp, getSafetyRuntime (weitere in der Quelle) |
| [`evaluateSafetyCommandPermission`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L895) | adapter, request | Date.now, Math.max, Number, String, blocked, normalizeApp, resolveCurrentNvpSnapshot, strictFiniteNumber |
| [`blocked`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L935) | reason | Number, String |
| [`commitFlexibleLoadDecision`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L983) | adapter, decision, applied | Math.max, Math.round, Number, String, getSafetyRuntime, nonNegative, normalizeApp |
| [`safetyTargetFromPowerDecision`](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts#L1002) | target, decision, options | Math.max, Math.min, Math.round, Object.prototype.hasOwnProperty.call, String, clamp, nonNegative, strictFiniteNumber |
