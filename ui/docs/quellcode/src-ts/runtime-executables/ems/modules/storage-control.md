# src-ts/runtime-executables/ems/modules/storage-control.ts

Berechnet Speicher-Laden und -Entladen unter Berücksichtigung von Netzbedarf, SOC, Tarif, Schutzvorgaben und Speicherfarm.

**Daten und Wirkung:** Verarbeitet NVP-, Batterie- und SoC-Messwerte sowie zentrale PV-/Gesamtbudgets. Ein befristeter Nulleinspeise-Test darf ausschließlich über den gemeinsamen Koordinator zusätzliche Ladeleistung anfordern; Tarif-, SoC-, Reglerhoheit- und Hardwaregrenzen bleiben maßgeblich.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./base` | [src-ts/runtime-executables/ems/modules/base.ts](../../../../../../src-ts/runtime-executables/ems/modules/base.ts) |
| `../services/dynamic-grid-ownership` | [src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts) |
| `../services/arbitrage-control` | [src-ts/runtime-executables/ems/services/arbitrage-control.ts](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts) |
| `../services/actuator-shadow-arbiter` | [src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts) |
| `../services/measurement-freshness` | [src-ts/runtime-executables/ems/services/measurement-freshness.ts](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts) |
| `../services/operating-strategy-runtime` | [src-ts/runtime-executables/ems/services/operating-strategy-runtime.ts](../../../../../../src-ts/runtime-executables/ems/services/operating-strategy-runtime.ts) |
| `../services/storage-override-bridge` | [src-ts/runtime-executables/ems/services/storage-override-bridge.ts](../../../../../../src-ts/runtime-executables/ems/services/storage-override-bridge.ts) |
| `../services/storage-zero-write-policy` | [src-ts/runtime-executables/ems/services/storage-zero-write-policy.ts](../../../../../../src-ts/runtime-executables/ems/services/storage-zero-write-policy.ts) |
| `../services/storage-async-feedback-anchor` | [src-ts/runtime-executables/ems/services/storage-async-feedback-anchor.ts](../../../../../../src-ts/runtime-executables/ems/services/storage-async-feedback-anchor.ts) |
| `../services/zero-export-pv-coordinator` | [src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts) |
| `../services/storage-self-consumption-policy` | [src-ts/runtime-executables/ems/services/storage-self-consumption-policy.ts](../../../../../../src-ts/runtime-executables/ems/services/storage-self-consumption-policy.ts) |
| `../services/feature-flags` | [src-ts/runtime-executables/ems/services/feature-flags.ts](../../../../../../src-ts/runtime-executables/ems/services/feature-flags.ts) |
| `../services/storage-datapoint-config` | [src-ts/runtime-executables/ems/services/storage-datapoint-config.ts](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts) |
| `../services/fenecon-hybrid-control` | [src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts) |
| `../services/fenecon-nvp-shadow-runtime` | [src-ts/runtime-executables/ems/services/fenecon-nvp-shadow-runtime.ts](../../../../../../src-ts/runtime-executables/ems/services/fenecon-nvp-shadow-runtime.ts) |
| `../services/safety-envelope` | [src-ts/runtime-executables/ems/services/safety-envelope.ts](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)
- [src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`strictFiniteNumber`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L103) | value, fallback | Number, Number.isFinite, value.trim |
| [`resolveStorageZeroExportProbeRequest`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L120) | ctx | Math.floor, Math.max, Math.min, String, allowedSources.includes, strictFiniteNumber |
| [`isCentralStorageGridChargeSource`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L160) | src, signedTargetW | Number, String |
| [`resolveStrictStorageTariffPermission`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L182) | snapshot, { nowMs = Date.now(), snapshotMaxAgeMs = 15000, } | Date.now, Math.max, Math.round, Number, String, strictFiniteNumber |
| [`resolveStorageGridChargeGateSource`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L270) | { targetW = 0, source = '', policySourceBeforeVendor = '', } | String, isCentralStorageGridChargeSource |
| [`resolveStorageGridChargeFinalGate`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L283) | { targetW = 0, source = '', configured = false, allowed = false, blockReason = '', } | Number, String, isCentralStorageGridChargeSource |
| [`resolveStoragePvOnlyChargeSafetyGate`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L314) | { targetW = 0, gridChargeAllowed = false, signedNvpW = null, batteryPowerW = null, batteryPowerTrusted = false, targetImportW = 0, validatedPvFeedForwardChargeW = null, blockReason = '', } | Math.max, Math.min, Math.round, String, strictFiniteNumber |
| [`resolveStorageLicenseEdition`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L425) | adapter | String, raw.toLowerCase, storageFeatureFlags.normalizeEdition |
| [`deriveStorageRatedPowerW`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L444) | cfg, farmRows, selectedTopology | Array.isArray, Math.round, Number, Number.isFinite, String, farmRows.reduce |
| [`resolveStorageLicensePowerProfile`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L460) | adapter, cfg, farmRows, selectedTopology | deriveStorageRatedPowerW, resolveStorageLicenseEdition, storageFeatureFlags.storagePerformanceProfile |
| [`applyStorageLicensePowerLimit`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L490) | targetW, profile | Math.abs, Math.max, Math.min, Number, Number.isFinite, String |
| [`resolveEvcsStorageProtectionSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L531) | policy, options | Array.isArray, Date.now, Math.max, Number, Number.isFinite, String, count, validNonNegative, watts |
| [`count`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L532) | value | Math.floor, Math.max, Number, Number.isFinite |
| [`watts`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L533) | value | Math.max, Number, Number.isFinite |
| [`validNonNegative`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L538) | value | Number, Number.isFinite, String |
| [`resolveEvcsProtectedStorageTarget`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L565) | input | Math.abs, Math.max, Math.min, Number, String, finite |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L566) | v | Number, Number.isFinite |
| [`resolveStorageAntiExportTarget`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L794) | input | Date.now, Math.max, Math.min, Math.round, Number, clamp01, finite |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L795) | value | Number, Number.isFinite |
| [`clamp01`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L796) | value | Math.max, Math.min, Number |
| [`RollingWindow.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L1085) | maxSeconds | Math.max, Number |
| [`RollingWindow.setMaxSeconds`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L1097) | maxSeconds | Date.now, Math.max, Number, this._purge |
| [`RollingWindow._purge`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L1111) | nowMs | this.samples.shift |
| [`RollingWindow.push`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L1125) | v, nowMs | Date.now, Number, Number.isFinite, this._purge, this.samples.push |
| [`RollingWindow.mean`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L1139) | – | – |
| [`RollingWindow.count`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L1146) | – | – |
| [`hystAbove`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L1164) | prev, x, offBelow, onAbove | Number.isFinite |
| [`hystBelow`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L1185) | prev, x, onBelow, offAbove | Number.isFinite |
| [`SpeicherRegelungModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L1222) | adapter, dpRegistry | super |
| [`SpeicherRegelungModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L1415) | – | this._ensureStates, this._upsertInputsFromConfig |
| [`SpeicherRegelungModule.deactivate`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L1427) | – | Math.abs, Number, Number.isFinite, String, dynamicGridHasControl, outputKeys.some, this._applyTargetW, this._getStorageControlAuthority, this.adapter.getStateAsync |
| [`SpeicherRegelungModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L1466) | – | Array.isArray, Date.now, JSON.parse, JSON.stringify, Math.abs, Math.floor, Math.max, Math.min, Math.round, Math.sign, Number, Number.isFinite, Object.create, String (weitere in der Quelle) |
| [`measurementTsFor`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L1985) | key | Number, Number.isFinite, this.dp.getEntry, this.dp.getMeasurementTimestampMs |
| [`isCentralPvChargeSource`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L2521) | src, signedTargetW | Number, String |
| [`isDeferredSungrowChargeCapReason`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L2547) | capReason | String, text.includes |
| [`isDeferredSungrowDischargeCapReason`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L2571) | capReason | String, text.includes |
| [`resolveStoragePvBudgetW`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L2587) | runtime, _allocationGate, fallbackW | Math.max, Number, Number.isFinite, grantFn, runtime.getPvGrant.bind, runtime.grant.bind |
| [`stripProtectedEvcsLoadW`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L2718) | w | Math.max, Number |
| [`isStorageBalanceSource`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L2725) | src | String |
| [`getLastStorageBalanceTargetW`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L2729) | – | Number, Number.isFinite, isStorageBalanceSource |
| [`readCacheNumber`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L2745) | key, fallback | Number, Number.isFinite, String, this.adapter._nwGetNumberFromCache |
| [`buildStorageFeedForward`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L2771) | targetNvpW | Math.max, num, this._buildIndependentPvLoadFeedForward |
| [`getFeneconAcLoadTargetW`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L2794) | – | Math.abs, Math.max, Number.isFinite, num, readCacheNumber, stripProtectedEvcsLoadW |
| [`guard`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L6794) | – | Date.now, Math.abs, Math.max, Math.min, Math.sign, Number, dynamicGridHasControl, evaluateArbitrageRequest, evaluateFlexibleLoadRequest, evaluateSafetyCommandPermission, liveSafetyEnvelope, selectConfiguredArbitrageRequest, strictFiniteNumber |
| [`SpeicherRegelungModule._buildSelfNvpControlSignal`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L6851) | rawOrFilteredW, nowMs, cfg, targetW, deadbandW | Date.now, Math.max, Math.min, Number, Number.isFinite, clamp, num |
| [`SpeicherRegelungModule._resolveFeneconDirectNvpFeedback`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L6944) | ctx | Date.now, Math.max, Math.min, Number, Number.isFinite, feedback, finite, read, this.dp.getAgeMs, this.dp.getEntry, this.dp.getNumber |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L6945) | value | Number, Number.isFinite |
| [`feedback`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L6951) | key, valueW, source, sampleTs, ageMs, objectId | Math.max, Math.round, Number, String, finite |
| [`read`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L6980) | key, source | Number, Number.isFinite, feedback, this.dp.getAgeMs, this.dp.getEntry, this.dp.getMeasurementTimestampMs, this.dp.getNumber |
| [`SpeicherRegelungModule._resolveBatteryBalanceFeedback`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7059) | ctx | Date.now, Math.abs, Math.max, Math.round, Number, String, finite, resetCache |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7060) | v | Number, Number.isFinite |
| [`resetCache`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7078) | – | – |
| [`SpeicherRegelungModule._buildIndependentPvLoadFeedForward`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7264) | ctx | Date.now, Math.max, Math.min, Number, String, finite, getCacheAgeMs, getCacheString, getCacheValue, isMapped, pushPv, pvCandidates.sort, this.dp.getAgeMs, this.dp.getEntry (weitere in der Quelle) |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7265) | v | Number, Number.isFinite |
| [`getCacheRecord`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7275) | key | String |
| [`getCacheAgeMs`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7282) | key | Math.max, Number, Number.isFinite, adapter._nwGetCacheAgeMs, finite, getCacheRecord |
| [`getCacheValue`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7295) | key, fallback | Number, Number.isFinite, adapter._nwGetNumberFromCacheFresh, finite, getCacheAgeMs, getCacheRecord |
| [`getCacheString`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7311) | key | String, getCacheRecord |
| [`isMapped`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7316) | key | String, adapter._nwHasMappedDatapoint |
| [`pushPv`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7384) | value, source, ageMs, priority | Math.max, Number, finite, pvCandidates.push |
| [`SpeicherRegelungModule._buildActualAwareNvpBalance`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7505) | ctx | Math.abs, Math.max, Math.sign, Number, String, applyFeedForwardTarget, clamp, estimateAsyncStorageFeedback, finite, resolveNvpBandTarget |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7506) | v | Number, Number.isFinite |
| [`applyFeedForwardTarget`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7725) | desiredW, modePrefix | Math.abs, Math.sign, Number, Number.isFinite, clamp |
| [`SpeicherRegelungModule._getCfg`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L7989) | – | String, buildStorageMeasurementFallbackFromGlobal, mergeStorageMeasurementFallback |
| [`SpeicherRegelungModule._getStorageControlAuthority`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8162) | – | Array.isArray, dynamicGridHasControl, rows.some, this._isStorageFarmEnabled, this.adapter._nwGetStorageControlAuthority, this.adapter._nwGetStorageFarmRuntimeInfo |
| [`SpeicherRegelungModule._isStorageFarmEnabled`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8234) | – | Array.isArray, rows.filter, this.adapter._nwGetStorageFarmRuntimeInfo |
| [`SpeicherRegelungModule._isStorageFarmDispatchEnabled`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8277) | – | this._getStorageControlAuthority |
| [`SpeicherRegelungModule._getStorageVendorProfile`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8281) | cfg | String |
| [`SpeicherRegelungModule._isFeneconProfileConfigured`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8294) | cfg | this._getStorageVendorProfile |
| [`SpeicherRegelungModule._isFeneconHybridControlConfigured`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8308) | cfg | String, this._isFeneconProfileConfigured |
| [`SpeicherRegelungModule._isSungrowHybridControlConfigured`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8316) | cfg | this._getStorageVendorProfile |
| [`SpeicherRegelungModule._isE3dcRscpControlConfigured`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8320) | cfg | this._getStorageVendorProfile |
| [`SpeicherRegelungModule._isFeneconGridControlConfigured`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8327) | cfg | this._isFeneconHybridControlConfigured |
| [`SpeicherRegelungModule._buildSungrowHybridContext`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8330) | { cfg = {}, staleMs = 15000, gridW = null, gridRawW = null, gridAgeMs = null, targetGridImportW = null, importThresholdW = null, protectedEvcsLoadW = 0, coupling = 'ac', dcPvPowerW = null, dcPvPowerAgeMs = null, } | Date.now, Math.max, Number, Number.isFinite, String, num, this._buildIndependentPvLoadFeedForward |
| [`SpeicherRegelungModule._setStorageNvpBalanceDiag`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8417) | ctx | JSON.stringify, String, n, this._setIfChanged |
| [`n`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8419) | v, fallback | Math.round, Number, Number.isFinite |
| [`SpeicherRegelungModule._setSungrowHybridDiag`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8495) | ctx | String, n, this._setIfChanged |
| [`n`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8497) | v, fallback | Math.round, Number, Number.isFinite |
| [`SpeicherRegelungModule._isE3dcGridChargeSource`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8526) | source | String |
| [`SpeicherRegelungModule._writeE3dcRscpTargetW`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8544) | targetW, reason, source, cfg | Math.abs, Math.max, Math.round, Number, Number.isFinite, String, this._isE3dcGridChargeSource, this._setE3dcRscpDiag, this.dp.getEntry, writeBoolean, writeNumber |
| [`writeNumber`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8562) | key, value | this._writeStorageCommandNumber, writes.push |
| [`writeBoolean`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8574) | key, value | this._writeStorageCommandBoolean, writes.push |
| [`SpeicherRegelungModule._setE3dcRscpDiag`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8627) | ctx | String, n, this._setIfChanged |
| [`n`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8628) | v, def | Math.round, Number, Number.isFinite |
| [`SpeicherRegelungModule._buildFeneconHybridContext`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8643) | { cfg = {}, staleMs = 15000, gridW = null, gridRawW = null, dcPvPowerW = null, dcPvPowerAgeMs = null, resolvedMode = 'direct-ess', } | Date.now, Math.abs, Math.max, Number.isFinite, String, getEntry, readFresh, resolveFeneconHybridAuthority, strictFiniteNumber, this._getStorageVendorProfile |
| [`readFresh`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8655) | key | Number.isFinite, strictFiniteNumber, this.dp.getAgeMs, this.dp.getEntry, this.dp.getNumberFresh |
| [`getEntry`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8712) | key | this.dp.getEntry |
| [`SpeicherRegelungModule._updateFeneconNvpShadow`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8823) | ctx | updateFeneconNvpShadowRuntime |
| [`SpeicherRegelungModule._setFeneconHybridDiag`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8829) | ctx | String, n, this._setIfChanged |
| [`n`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8839) | v, fallback | Math.round, strictFiniteNumber |
| [`SpeicherRegelungModule._setHoldNoWriteTargetDiag`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8894) | targetW, reason, source, status | Date.now, Math.round, Number, Number.isFinite, String, this._setIfChanged, this.dp.getEntry |
| [`SpeicherRegelungModule._setNoWriteTargetDiag`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8937) | targetW, reason, source, status | Date.now, Math.round, Number, Number.isFinite, String, this._setIfChanged, this.dp.getEntry |
| [`SpeicherRegelungModule._getFeneconGridLastWriteMs`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8972) | – | Math.max, Number, Number.isFinite, candidates.push |
| [`SpeicherRegelungModule._getFeneconApiTimeoutMs`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8984) | cfg | Math.max, Math.min, Math.round, Number, Number.isFinite |
| [`SpeicherRegelungModule._getFeneconNativeHandoverWait`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L8990) | cfg | Date.now, Math.max, this._getFeneconApiTimeoutMs, this._getFeneconGridLastWriteMs |
| [`SpeicherRegelungModule._getFeneconGridSetpointW`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9002) | cfg | String, this.dp.getEntry |
| [`SpeicherRegelungModule._releaseDirectStorageTargetForFenecon`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9013) | reason | String, getEntry, this._ensureStorageAlternativeTargetsNeutral, this._setIfChanged |
| [`getEntry`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9014) | key | this.dp.getEntry |
| [`SpeicherRegelungModule._applyFeneconGridSetpointW`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9029) | targetW, reason, source, opts | Date.now, Math.round, Number, Number.isFinite, String, this._setIfChanged, this._verifyStorageCommandDatapoints, this._writeStorageCommandNumber, this.dp.getEntry |
| [`SpeicherRegelungModule._readTarifVis`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9099) | staleMs | Math.round, this.dp.getAgeMs, this.dp.getBoolean, this.dp.getNumberFresh |
| [`SpeicherRegelungModule._storageCommandExpectedRaw`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9119) | entry, physicalValue, type | Math.max, Math.min, Number, Number.isFinite |
| [`SpeicherRegelungModule._storageCommandBoolean`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9141) | raw | String |
| [`SpeicherRegelungModule._readStorageCommandRaw`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9150) | key, entry | Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String, this.adapter.getForeignStateAsync, this.dp.getRaw |
| [`SpeicherRegelungModule._verifyStorageCommandDatapoints`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9193) | expectations, options | Array.from, Array.isArray, Math.abs, Math.max, Math.min, Number, Number.isFinite, String, finalRows.filter, finalRows.push, supportedRows.every, supportedRows.filter, this._readStorageCommandRaw, this._storageCommandBoolean (weitere in der Quelle) |
| [`SpeicherRegelungModule._clearStorageCommandWriteCache`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9281) | entry | String, this.dp.lastWriteByObjectId.delete |
| [`SpeicherRegelungModule._writeStorageCommandNumber`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9287) | key, value, options | this._clearStorageCommandWriteCache, this._verifyStorageCommandDatapoints, this.dp.getEntry, this.dp.writeNumber |
| [`SpeicherRegelungModule._writeStorageCommandBoolean`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9299) | key, value, options | this._clearStorageCommandWriteCache, this._verifyStorageCommandDatapoints, this.dp.getEntry, this.dp.writeBoolean |
| [`SpeicherRegelungModule._ensureStorageAlternativeTargetsNeutral`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9311) | entries, options | Array.from, Array.isArray, String, rows.push, this._verifyStorageCommandDatapoints, this._writeStorageCommandNumber, unique.has, unique.set, unique.values |
| [`SpeicherRegelungModule._applyTargetW`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9370) | targetW, reason, source, options | Array.isArray, Date.now, JSON.stringify, Math.abs, Math.floor, Math.max, Math.min, Math.round, Number, Number.isFinite, String, activeOutputEntries.push, addActiveOutput, addCommandExpectation (weitere in der Quelle) |
| [`getEntry`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9514) | key | this.dp.getEntry |
| [`objectIdOf`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9558) | entry | String |
| [`sameObject`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9559) | a, b | objectIdOf |
| [`addActiveOutput`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9691) | key, entry, allowAlternativeAlias | activeOutputEntries.push, objectIdOf, selectedTargetObjectIds.add |
| [`addIgnoredAlternative`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9723) | key, entry, family | ignoredAlternativeTargetEntries.push, objectIdOf, selectedTargetObjectIds.has |
| [`addCommandExpectation`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9856) | key, entry, type, value, role | commandExpectations.push, objectIdOf |
| [`writeCommandNumber`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9860) | key, value, options | String, addCommandExpectation, getEntry, this._writeStorageCommandNumber, writeResults.push |
| [`writeCommandBoolean`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9874) | key, value, options | String, addCommandExpectation, getEntry, this._writeStorageCommandBoolean, writeResults.push |
| [`classifyCommandReadbackFailure`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L9888) | rows | Array.isArray, mismatches.some |
| [`SpeicherRegelungModule._upsertInputsFromConfig`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L10494) | – | String, this.dp.upsert |
| [`SpeicherRegelungModule._ensureStates`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L10522) | – | ensureFeneconNvpShadowStates, mk, this.adapter.setObjectNotExistsAsync |
| [`mk`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L10540) | id, name, type, role, def | this.adapter.setObjectNotExistsAsync, this.adapter.setStateAsync |
| [`SpeicherRegelungModule._ensureRuntimeStateObject`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L10886) | id, val | String, sid.startsWith, this.adapter.setObjectNotExistsAsync |
| [`SpeicherRegelungModule._setIfChanged`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L10915) | id, val | this._ensureRuntimeStateObject, this.adapter.getStateAsync, this.adapter.setStateAsync |
| [`SpeicherRegelungModule._readOwnNumber`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L10940) | id | Number, Number.isFinite, this.adapter.getStateAsync |
| [`SpeicherRegelungModule._readOwnNumberFresh`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L10957) | id, maxAgeMs | Date.now, Number, Number.isFinite, this.adapter.getStateAsync |
| [`SpeicherRegelungModule._readOwnString`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L10982) | id | String, this.adapter.getStateAsync |
| [`num`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L11000) | v, dflt | Number, Number.isFinite |
| [`clamp`](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts#L11010) | n, min, max | Math.max, Math.min, Number.isFinite |
