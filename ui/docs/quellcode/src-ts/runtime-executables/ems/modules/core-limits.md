# src-ts/runtime-executables/ems/modules/core-limits.ts

Stellt das zentrale Leistungsbudget und gemeinsame Netzgrenzen bereit, damit Verbraucher dieselbe Messbasis und Reservierungen verwenden.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `../../lib/tariff-price` | [src-ts/runtime-executables/lib/tariff-price.ts](../../../../../../src-ts/runtime-executables/lib/tariff-price.ts) |
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
| [`resolvePara14aAppCap`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L82) | – | – |
| [`requireCoreBudgetTsMirror`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L105) | – | require |
| [`requireCoreRuntimeTsMirror`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L119) | – | require |
| [`compareShadowWatt`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L138) | field, jsValue, tsValue, toleranceW | Math.abs, Math.round, Number, Number.isFinite |
| [`num`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L151) | v, fallback | Number, Number.isFinite |
| [`clamp`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L161) | v, minV, maxV, fallback | Math.max, Math.min, Number, Number.isFinite |
| [`roundW`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L175) | v, fallback | Math.round, Number, Number.isFinite |
| [`isFiniteNumber`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L185) | v | Number.isFinite |
| [`legacyComputePvBudgetFlowRawW`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L202) | { gridW = 0, flexUsedW = 0, storageChargeW = 0, storageDischargeW = 0 } | Math.max, Number, Number.isFinite |
| [`legacyComputeCentralBudgetGrant`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L222) | runtime, request | Math.max, Math.min, Number, Number.isFinite, String, resolvePara14aAppCap, roundW |
| [`legacyResolvePvBudgetPhysicalCapW`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L316) | { measuredPvW = 0, measuredPvFresh = false, flowRawW = 0, gridExportW = 0, gridImportW = 0, activePvSinkW = 0, lastTrustedW = 0, lastTrustedAgeMs = null, holdMs = 30000, exportEvidenceThresholdW = 250, importToleranceW = 250, } | Math.max, Math.min, Number, Number.isFinite |
| [`computePvBudgetFlowRawW`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L405) | input | Math.abs, Number, Number.isFinite, compute, legacyComputePvBudgetFlowRawW, requireCoreRuntimeTsMirror |
| [`computeCentralBudgetGrant`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L427) | runtime, request | Math.abs, Number, Number.isFinite, String, compute, legacyComputeCentralBudgetGrant, requireCoreRuntimeTsMirror |
| [`resolvePvBudgetPhysicalCapW`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L461) | input | Math.abs, Number, Number.isFinite, String, compute, legacyResolvePvBudgetPhysicalCapW, requireCoreRuntimeTsMirror |
| [`isPeakShavingRuntimeEnabled`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L487) | config | – |
| [`readStateNumber`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L500) | adapter, id, fallback | Number, Number.isFinite, adapter.getStateAsync |
| [`readStateBool`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L515) | adapter, id, fallback | adapter.getStateAsync, st.val.trim |
| [`readStateString`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L538) | adapter, id, fallback | String, adapter.getStateAsync |
| [`makeBudgetRuntime`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L554) | adapter, snapshot | Date.now, Math.abs, Math.max, Number, Number.isFinite, String, createPhase3, createState, requireCoreRuntimeTsMirror |
| [`grant`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L651) | req | computeCentralBudgetGrant |
| [`getPvGrant`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L662) | req | computeCentralBudgetGrant |
| [`getTotalGrant`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L671) | req | computeCentralBudgetGrant |
| [`reserve`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L687) | req | Array.from, Array.isArray, Date.now, JSON.stringify, Math.max, Math.round, Number, Number.isFinite, String, adapter.setStateAsync, adapter.updateValue, compareShadowWatt, computeV2, computeV3 (weitere in der Quelle) |
| [`reserveSequence`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L935) | requests | Array.from, Array.isArray, Date.now, Math.max, Math.round, Number, Number.isFinite, list.map, requireCoreRuntimeTsMirror, runV2, runV3 |
| [`peek`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1005) | – | Math.max, Math.round, Number, Number.isFinite, roundW, this.order.slice |
| [`CoreLimitsModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1056) | adapter, dpRegistry | super |
| [`CoreLimitsModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1076) | – | mk, this.adapter.setObjectNotExistsAsync |
| [`mk`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1125) | id, name, type, role, unit, write | this.adapter.setObjectNotExistsAsync |
| [`CoreLimitsModule._readDpNumberFresh`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1341) | keys, maxAgeMs, fallback | Array.isArray, Number.isFinite, String, this.dp.getNumberFresh |
| [`CoreLimitsModule._readCacheNumber`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1365) | keys, fallback | Array.isArray, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String |
| [`CoreLimitsModule._readCacheNumberFresh`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1388) | keys, maxAgeMs, fallback | Array.isArray, Date.now, Math.max, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String |
| [`CoreLimitsModule._resolveDirectPvPower`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1419) | maxAgeMs | Math.max, Number, String, candidates.sort, push, this._readCacheNumberFresh, this.dp.getNumberFresh |
| [`push`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1421) | key, value, sourceType | Math.max, Number, Number.isFinite, String, candidates.push |
| [`score`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1455) | row | – |
| [`CoreLimitsModule._readCacheNumberMax`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1481) | keys, fallback | Array.isArray, Math.max, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String |
| [`CoreLimitsModule._readRuntimeOrStateNumber`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1509) | keys, fallback | Number, Number.isFinite, String |
| [`CoreLimitsModule._forecastPowerAt`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1534) | curve, ts | Array.isArray, Math.max, Number, Number.isFinite |
| [`CoreLimitsModule._forecastIntegrateKwh`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1568) | curve, fromMs, toMs | Array.isArray, Math.max, Math.min, Number, Number.isFinite |
| [`CoreLimitsModule._forecastPeakW`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1603) | curve, fromMs, toMs | Array.isArray, Math.max, Number, Number.isFinite |
| [`CoreLimitsModule._forecastConfidencePct`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1634) | valid, ageMs, points | Number, Number.isFinite |
| [`CoreLimitsModule._makeForecastGate`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1659) | now | Array.isArray, Math.max, Number, Number.isFinite, kwh1.toFixed, kwh12.toFixed, kwh24.toFixed, kwh3.toFixed, kwh6.toFixed, roundW, this._forecastConfidencePct, this._forecastIntegrateKwh, this._forecastPeakW, this._forecastPowerAt |
| [`CoreLimitsModule._publishCoreRuntimeBudgetPlan`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1719) | now, budgetSnapshot, budgetRuntime, coreTsShadow, coreRestGatesTsShadow | Math.abs, Math.max, Number, Number.isFinite, Object.entries, String, buildV2, buildV3, markFallback, requireCoreRuntimeTsMirror, roundW, this.adapter.setStateAsync, this.adapter.updateValue |
| [`markFallback`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1720) | reason | String |
| [`CoreLimitsModule._makeBudgetSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L1832) | now, coreSnapshot | Math.abs, Math.max, Math.min, Math.round, Number, Number.isFinite, String, bindings.join, bindings.push, buildPvSurplusAllocation, clamp, computePvBudgetFlowRawW, highLevelBindingParts.join, highLevelBindingParts.push (weitere in der Quelle) |
| [`readCacheValue`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2032) | key, fallback | Object.prototype.hasOwnProperty.call, String |
| [`CoreLimitsModule._applyCoreRuntimeTsSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2359) | legacySnapshot, typedInput | Array.isArray, Date.now, String, build, compare, fallback, mismatches.slice, prepare, requireCoreRuntimeTsMirror |
| [`fallback`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2360) | reason, extra | Array.isArray, Date.now |
| [`CoreLimitsModule._runCoreBudgetTsShadowComparison`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2454) | budgetSnapshot | Date.now, Math.max, Number, Number.isFinite, String, build, compareShadowWatt, mismatches.filter, requireCoreBudgetTsMirror, roundW, this._coreTsShadowWarnedSignatures.add, this._coreTsShadowWarnedSignatures.has, this.adapter.log.warn, warningMismatches.map |
| [`CoreLimitsModule._runCoreRestGatesTsShadowComparison`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2583) | budgetSnapshot, coreSnapshot | Date.now, String, build, mismatches.slice, requireCoreBudgetTsMirror |
| [`compareValue`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2590) | mismatches, field, jsValue, tsValue, tolerance | Math.abs, Math.round, Number, String, mismatches.push, numLike |
| [`numLike`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2591) | v | Number, Number.isFinite |
| [`CoreLimitsModule._applyCoreRestGatesTsProductiveSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2661) | jsBudgetSnapshot, coreSnapshot, restShadow | Date.now, fallback |
| [`fallback`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2665) | reason, extra | – |
| [`CoreLimitsModule._applyCoreBudgetTsProductiveSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2750) | jsSnapshot, coreTsShadow | Date.now, String, fallbackStatus, roundW |
| [`fallbackStatus`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2752) | reason, extra | Date.now |
| [`CoreLimitsModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2835) | – | Date.now, JSON.stringify, Math.max, Math.min, Math.round, Number, Number.isFinite, Object.entries, Object.keys, String, cands.push, clamp, collectZeroExportSample, controlledComponents.push (weitere in der Quelle) |
| [`minComponent`](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts#L2968) | components | Math.max, Math.min, components.filter, finite.filter, finite.map |
