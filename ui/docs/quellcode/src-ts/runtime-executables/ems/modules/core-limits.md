# src-ts/runtime-executables/ems/modules/core-limits.ts

Stellt das zentrale Leistungsbudget und gemeinsame Netzgrenzen bereit, damit Verbraucher dieselbe Messbasis und Reservierungen verwenden.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./base` | [src-ts/runtime-executables/ems/modules/base.ts](../../../../../../src-ts/runtime-executables/ems/modules/base.ts) |
| `../services/zero-export-pv-coordinator` | [src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts) |
| `../services/pv-surplus-allocation` | [src-ts/runtime-executables/ems/services/pv-surplus-allocation.ts](../../../../../../src-ts/runtime-executables/ems/services/pv-surplus-allocation.ts) |
| `../services/measurement-freshness` | [src-ts/runtime-executables/ems/services/measurement-freshness.ts](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts) |
| `../services/storage-self-consumption-policy` | [src-ts/runtime-executables/ems/services/storage-self-consumption-policy.ts](../../../../../../src-ts/runtime-executables/ems/services/storage-self-consumption-policy.ts) |
| `../services/safety-envelope` | [src-ts/runtime-executables/ems/services/safety-envelope.ts](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts) |
| `../../lib/ts-mirrors/ems/para14a/para14a-constraint` | [src-ts/ems/para14a/para14a-constraint.ts](../../../../../../src-ts/ems/para14a/para14a-constraint.ts) |
| `../../lib/ts-mirrors/ems/core-limits/core-budget` | [src-ts/ems/core-limits/core-budget.ts](../../../../../../src-ts/ems/core-limits/core-budget.ts) |
| `../../lib/ts-mirrors/ems/core-limits/core-runtime` | [src-ts/ems/core-limits/core-runtime.ts](../../../../../../src-ts/ems/core-limits/core-runtime.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`resolvePara14aAppCap`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L81) | – | – |
| [`requireCoreBudgetTsMirror`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L104) | – | require |
| [`requireCoreRuntimeTsMirror`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L118) | – | require |
| [`compareShadowWatt`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L137) | field, jsValue, tsValue, toleranceW | Math.abs, Math.round, Number, Number.isFinite |
| [`num`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L150) | v, fallback | Number, Number.isFinite |
| [`clamp`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L160) | v, minV, maxV, fallback | Math.max, Math.min, Number, Number.isFinite |
| [`roundW`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L174) | v, fallback | Math.round, Number, Number.isFinite |
| [`isFiniteNumber`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L184) | v | Number.isFinite |
| [`legacyComputePvBudgetFlowRawW`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L201) | { gridW = 0, flexUsedW = 0, storageChargeW = 0, storageDischargeW = 0 } | Math.max, Number, Number.isFinite |
| [`legacyComputeCentralBudgetGrant`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L221) | runtime, request | Math.max, Math.min, Number, Number.isFinite, String, resolvePara14aAppCap, roundW |
| [`legacyResolvePvBudgetPhysicalCapW`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L315) | { measuredPvW = 0, measuredPvFresh = false, flowRawW = 0, gridExportW = 0, gridImportW = 0, activePvSinkW = 0, lastTrustedW = 0, lastTrustedAgeMs = null, holdMs = 30000, exportEvidenceThresholdW = 250, importToleranceW = 250, } | Math.max, Math.min, Number, Number.isFinite |
| [`computePvBudgetFlowRawW`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L404) | input | Math.abs, Number, Number.isFinite, compute, legacyComputePvBudgetFlowRawW, requireCoreRuntimeTsMirror |
| [`computeCentralBudgetGrant`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L426) | runtime, request | Math.abs, Number, Number.isFinite, String, compute, legacyComputeCentralBudgetGrant, requireCoreRuntimeTsMirror |
| [`resolvePvBudgetPhysicalCapW`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L460) | input | Math.abs, Number, Number.isFinite, String, compute, legacyResolvePvBudgetPhysicalCapW, requireCoreRuntimeTsMirror |
| [`isPeakShavingRuntimeEnabled`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L486) | config | – |
| [`readStateNumber`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L499) | adapter, id, fallback | Number, Number.isFinite, adapter.getStateAsync |
| [`readStateBool`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L514) | adapter, id, fallback | adapter.getStateAsync, st.val.trim |
| [`readStateString`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L537) | adapter, id, fallback | String, adapter.getStateAsync |
| [`makeBudgetRuntime`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L553) | adapter, snapshot | Date.now, Math.abs, Math.max, Number, Number.isFinite, String, createPhase3, createState, requireCoreRuntimeTsMirror |
| [`grant`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L650) | req | computeCentralBudgetGrant |
| [`getPvGrant`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L661) | req | computeCentralBudgetGrant |
| [`getTotalGrant`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L670) | req | computeCentralBudgetGrant |
| [`reserve`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L686) | req | Array.from, Array.isArray, Date.now, JSON.stringify, Math.max, Math.round, Number, Number.isFinite, String, adapter.setStateAsync, adapter.updateValue, compareShadowWatt, computeV2, computeV3 (weitere in der Quelle) |
| [`reserveSequence`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L934) | requests | Array.from, Array.isArray, Date.now, Math.max, Math.round, Number, Number.isFinite, list.map, requireCoreRuntimeTsMirror, runV2, runV3 |
| [`peek`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1004) | – | Math.max, Math.round, Number, Number.isFinite, roundW, this.order.slice |
| [`CoreLimitsModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1055) | adapter, dpRegistry | super |
| [`CoreLimitsModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1075) | – | mk, this.adapter.setObjectNotExistsAsync |
| [`mk`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1124) | id, name, type, role, unit, write | this.adapter.setObjectNotExistsAsync |
| [`CoreLimitsModule._readDpNumberFresh`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1340) | keys, maxAgeMs, fallback | Array.isArray, Number.isFinite, String, this.dp.getNumberFresh |
| [`CoreLimitsModule._readCacheNumber`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1364) | keys, fallback | Array.isArray, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String |
| [`CoreLimitsModule._readCacheNumberFresh`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1387) | keys, maxAgeMs, fallback | Array.isArray, Date.now, Math.max, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String |
| [`CoreLimitsModule._resolveDirectPvPower`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1418) | maxAgeMs | Math.max, Number, String, candidates.sort, push, this._readCacheNumberFresh, this.dp.getNumberFresh |
| [`push`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1420) | key, value, sourceType | Math.max, Number, Number.isFinite, String, candidates.push |
| [`score`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1454) | row | – |
| [`CoreLimitsModule._readCacheNumberMax`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1480) | keys, fallback | Array.isArray, Math.max, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String |
| [`CoreLimitsModule._readRuntimeOrStateNumber`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1508) | keys, fallback | Number, Number.isFinite, String |
| [`CoreLimitsModule._forecastPowerAt`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1533) | curve, ts | Array.isArray, Math.max, Number, Number.isFinite |
| [`CoreLimitsModule._forecastIntegrateKwh`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1567) | curve, fromMs, toMs | Array.isArray, Math.max, Math.min, Number, Number.isFinite |
| [`CoreLimitsModule._forecastPeakW`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1602) | curve, fromMs, toMs | Array.isArray, Math.max, Number, Number.isFinite |
| [`CoreLimitsModule._forecastConfidencePct`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1633) | valid, ageMs, points | Number, Number.isFinite |
| [`CoreLimitsModule._makeForecastGate`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1658) | now | Array.isArray, Math.max, Number, Number.isFinite, kwh1.toFixed, kwh12.toFixed, kwh24.toFixed, kwh3.toFixed, kwh6.toFixed, roundW, this._forecastConfidencePct, this._forecastIntegrateKwh, this._forecastPeakW, this._forecastPowerAt |
| [`CoreLimitsModule._publishCoreRuntimeBudgetPlan`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1718) | now, budgetSnapshot, budgetRuntime, coreTsShadow, coreRestGatesTsShadow | Math.abs, Math.max, Number, Number.isFinite, Object.entries, String, buildV2, buildV3, markFallback, requireCoreRuntimeTsMirror, roundW, this.adapter.setStateAsync, this.adapter.updateValue |
| [`markFallback`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1719) | reason | String |
| [`CoreLimitsModule._makeBudgetSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1831) | now, coreSnapshot | Math.abs, Math.max, Math.min, Math.round, Number, Number.isFinite, String, bindings.join, bindings.push, buildPvSurplusAllocation, clamp, computePvBudgetFlowRawW, highLevelBindingParts.join, highLevelBindingParts.push (weitere in der Quelle) |
| [`readCacheValue`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2031) | key, fallback | Object.prototype.hasOwnProperty.call, String |
| [`CoreLimitsModule._applyCoreRuntimeTsSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2358) | legacySnapshot, typedInput | Array.isArray, Date.now, String, build, compare, fallback, mismatches.slice, prepare, requireCoreRuntimeTsMirror |
| [`fallback`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2359) | reason, extra | Array.isArray, Date.now |
| [`CoreLimitsModule._runCoreBudgetTsShadowComparison`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2453) | budgetSnapshot | Date.now, Math.max, Number, Number.isFinite, String, build, compareShadowWatt, mismatches.filter, requireCoreBudgetTsMirror, roundW, this._coreTsShadowWarnedSignatures.add, this._coreTsShadowWarnedSignatures.has, this.adapter.log.warn, warningMismatches.map |
| [`CoreLimitsModule._runCoreRestGatesTsShadowComparison`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2582) | budgetSnapshot, coreSnapshot | Date.now, String, build, mismatches.slice, requireCoreBudgetTsMirror |
| [`compareValue`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2589) | mismatches, field, jsValue, tsValue, tolerance | Math.abs, Math.round, Number, String, mismatches.push, numLike |
| [`numLike`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2590) | v | Number, Number.isFinite |
| [`CoreLimitsModule._applyCoreRestGatesTsProductiveSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2660) | jsBudgetSnapshot, coreSnapshot, restShadow | Date.now, fallback |
| [`fallback`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2664) | reason, extra | – |
| [`CoreLimitsModule._applyCoreBudgetTsProductiveSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2749) | jsSnapshot, coreTsShadow | Date.now, String, fallbackStatus, roundW |
| [`fallbackStatus`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2751) | reason, extra | Date.now |
| [`CoreLimitsModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2834) | – | Date.now, JSON.stringify, Math.max, Math.min, Math.round, Number, Number.isFinite, Object.entries, Object.keys, String, cands.push, clamp, collectZeroExportSample, controlledComponents.push (weitere in der Quelle) |
| [`minComponent`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2966) | components | Math.max, Math.min, components.filter, finite.filter, finite.map |
