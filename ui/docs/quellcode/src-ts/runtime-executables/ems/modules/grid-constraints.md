# src-ts/runtime-executables/ems/modules/grid-constraints.ts

Fasst netzseitige Einschränkungen für die nachfolgenden EMS-Entscheidungen zusammen.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./base` | [src-ts/runtime-executables/ems/modules/base.ts](../../../../../../src-ts/runtime-executables/ems/modules/base.ts) |
| `../services/measurement-freshness` | [src-ts/runtime-executables/ems/services/measurement-freshness.ts](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts) |
| `../services/actuator-shadow-arbiter` | [src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts) |
| `../reasons` | [src-ts/runtime-executables/ems/reasons.ts](../../../../../../src-ts/runtime-executables/ems/reasons.ts) |
| `../services/grid-import-limit-policy` | [src-ts/runtime-executables/ems/services/grid-import-limit-policy.ts](../../../../../../src-ts/runtime-executables/ems/services/grid-import-limit-policy.ts) |
| `../services/dynamic-grid-ownership` | [src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`GridConstraintsModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L97) | adapter, dpRegistry | super |
| [`GridConstraintsModule.setDeferredDynamicPv`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L164) | enabled | – |
| [`GridConstraintsModule._isEnabled`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L168) | – | – |
| [`GridConstraintsModule._cfg`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L180) | – | – |
| [`GridConstraintsModule._isExportLimitInstallerApproved`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L191) | cfg | – |
| [`GridConstraintsModule._getConfiguredMaxFeedInPowerW`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L207) | cfg | Math.round, Number, Number.isFinite, v.trim |
| [`GridConstraintsModule._getFallbackExportPowerW`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L223) | cfg, configuredMaxFeedInW | Math.max, Math.min, Math.round, Number, Number.isFinite, this._getConfiguredMaxFeedInPowerW, value.trim |
| [`GridConstraintsModule._getNetOperatorActivation`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L236) | – | Math.max, Math.min, Math.round, String, this._getExportLimitRunMode, this._isExportLimitInstallerApproved, this._num |
| [`GridConstraintsModule._resolveExternalAllowedExportPowerW`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L280) | envelope, cfg | Math.max, Math.round, Number, String, finiteOrNull, this._getRatedPvW, this._normalizeInvList, this._sumRatedW |
| [`finiteOrNull`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L283) | value | Number, Number.isFinite, value.trim |
| [`GridConstraintsModule._resolveExportLimitAuthority`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L335) | cfg, nowMs | Date.now, Math.max, Math.min, Math.round, Number, Number.isFinite, String, this._getConfiguredMaxFeedInPowerW, this._getFallbackExportPowerW, this._getNetOperatorActivation, this._num, this._resolveExternalAllowedExportPowerW |
| [`GridConstraintsModule._getMaxFeedInPowerW`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L483) | cfg | this._resolveExportLimitAuthority |
| [`GridConstraintsModule._getExportLimitRunMode`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L494) | cfg | String |
| [`GridConstraintsModule._isExportLimitDiagnosticMode`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L512) | cfg | this._getExportLimitRunMode |
| [`GridConstraintsModule._buildExportLimitTarget`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L523) | cfg, tariffGridImportPreferred | Math.max, Math.min, this._num, this._resolveExportLimitAuthority, this.adapter?._meshCoordinator?.currentLimits |
| [`GridConstraintsModule._num`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L535) | v, dflt | Number, Number.isFinite |
| [`GridConstraintsModule._clamp`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L545) | v, minV, maxV | Math.max, Math.min, Number, Number.isFinite |
| [`GridConstraintsModule._isTariffGridImportPreferred`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L551) | – | this.adapter.getStateAsync |
| [`GridConstraintsModule._exportLimitAuditHash`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L562) | event | JSON.stringify, Number, String, crypto.createHash |
| [`GridConstraintsModule._restoreExportLimitAuthorityAudit`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L581) | – | Array.isArray, JSON.parse, JSON.stringify, String, parsed.slice, state.val.trim, this._exportLimitAuditHash, this.adapter.getStateAsync, verified.push |
| [`GridConstraintsModule._appendExportLimitAuthorityAudit`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L618) | authority | Date.now, JSON.stringify, Math.max, Math.round, Number, String, this._exportLimitAuditHash, this._exportLimitAuthorityRuntime.audit.push, this._exportLimitAuthorityRuntime.audit.slice |
| [`GridConstraintsModule._publishExportLimitAuthorityStates`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L649) | authority | JSON.stringify, Math.max, Math.round, Number, String, set, this._appendExportLimitAuthorityAudit, this._cfg, this._resolveExportLimitAuthority |
| [`set`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L652) | id, value | this.adapter.setStateAsync |
| [`GridConstraintsModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L672) | – | String, dp.upsert, mk, this._cfg, this._isEnabled, this._rememberPvWriteTarget, this._restoreExportLimitAuthorityAudit, this.adapter.setObjectNotExistsAsync, upsertInvList |
| [`mk`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L696) | id, name, type, role | this.adapter.setObjectNotExistsAsync |
| [`upsertInvList`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L929) | list, prefix | Array.isArray, String, dp.upsert, this._rememberPvWriteTarget |
| [`GridConstraintsModule._resolveCurtailMode`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L954) | cfg | String |
| [`GridConstraintsModule._normalizeInvList`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L964) | list | Array.isArray, Math.round, Number, Number.isFinite, String, it.kwp.replace, out.push |
| [`GridConstraintsModule._sumRatedW`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L982) | invList | Array.isArray |
| [`GridConstraintsModule._rememberPvWriteTarget`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L991) | objectId | String, seen.add, seen.has, this._pvWriteTargetIds.set, this._pvWriteZeroSafe.set, this.adapter.getForeignObjectAsync |
| [`GridConstraintsModule._pvMappingStatus`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1027) | cfg, group, diagnostic | Array.isArray, groups.zero.push, readGroup, seen.get, seen.set, this._isExportLimitDiagnosticMode, this._isExportLimitInstallerApproved, this._pvWriteTargetIds.get, this._resolveCurtailMode |
| [`readGroup`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1030) | name, list, prefix | Array.isArray, Math.round, Number, Number.isFinite, String, rawId.trim, row.kwp.replace, this._pvWriteTargetIds.get |
| [`GridConstraintsModule._stopInvalidPvMappings`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1081) | status | Number, isDynamicGridOwned, seen.add, seen.has, this._pvWriteZeroSafe.get, this.dp.getEntry, this.dp.writeNumber |
| [`GridConstraintsModule._writeValidatedPvLimit`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1105) | key, value, cfg | isDynamicGridOwned, key.startsWith, mapping.targets.find, this._cfg, this._isExportLimitDiagnosticMode, this._isExportLimitInstallerApproved, this._pvMappingStatus, this.dp.getEntry, this.dp.writeNumber |
| [`GridConstraintsModule._getEvuStagePct`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1126) | cfg | dp.getBoolean |
| [`GridConstraintsModule._tickPvEvu`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1141) | nowMs, cfg | Math.max, Math.min, Math.round, Number, mapping.issues.join, this._getEvuStagePct, this._normalizeInvList, this._pvMappingStatus, this._stopInvalidPvMappings, this._writeValidatedPvLimit, this.adapter.setStateAsync |
| [`GridConstraintsModule._getCurrentPvPowerW`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1180) | cfg | Date.now, Math.max, Math.round, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, dp.getNumberFresh, this._num |
| [`GridConstraintsModule._publishZeroExportFeedForwardDiagnostics`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1209) | feedForward, pvActual, control, ratedW, nextW | Math.max, Math.round, Number, Number.isFinite, String, this.adapter.setStateAsync |
| [`GridConstraintsModule._tickZeroExportGroup`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1228) | nowMs, gridW, cfg, gridStale, control | Math.abs, Math.max, Math.round, Math.sign, Number, Number.isFinite, String, resolveZeroExportPvTarget, this._buildExportLimitTarget, this._clamp, this._getCurrentPvPowerW, this._isExportLimitInstallerApproved, this._isTariffGridImportPreferred, this._normalizeInvList (weitere in der Quelle) |
| [`GridConstraintsModule._isStaleGrid`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1418) | cfg | Date.now, Math.max, Math.round, dp.isStale, resolveCurrentNvpSnapshot, this._num |
| [`GridConstraintsModule._getGridW`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1432) | cfg | Date.now, Math.max, Math.round, Number.isFinite, dp.getNumberFresh, resolveCurrentNvpSnapshot, this._num |
| [`GridConstraintsModule._tickRlm`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1449) | nowMs, gridW, cfg | Math.floor, Math.max, Math.min, Math.round, Number, Number.isFinite, this._clamp, this._num, this.adapter.setStateAsync |
| [`GridConstraintsModule._tickZeroExport`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1509) | nowMs, gridW, cfg, gridStale, control | Math.abs, Math.max, Math.round, Math.sign, Number, Number.isFinite, resolveZeroExportPvTarget, this._applyCurtailFailsafe, this._buildExportLimitTarget, this._clamp, this._getCurrentPvPowerW, this._getRatedPvW, this._isExportLimitInstallerApproved, this._isTariffGridImportPreferred (weitere in der Quelle) |
| [`GridConstraintsModule._zeroExportSinkRuntimeFor`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1772) | id | – |
| [`GridConstraintsModule._zeroExportSinkConfig`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1778) | cfg | Math.max, Math.min, Math.round, Number, make |
| [`make`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1783) | id, commandStateId, ackStateId, ackRequired | String |
| [`GridConstraintsModule._classifyZeroExportSinkAck`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1800) | raw | String |
| [`GridConstraintsModule._readZeroExportAckState`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1809) | id | String, this.adapter.getForeignStateAsync, this.adapter.getStateAsync |
| [`GridConstraintsModule._rememberZeroExportSinkAck`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1820) | sink, row, maxRows | Array.isArray, Date.now, Math.max, Math.min, Number, String, list.push, list.slice |
| [`GridConstraintsModule._updateZeroExportSinkAcks`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1840) | cfg, sinkPriority | Array.isArray, Date.now, Math.max, Number, rows.push, steps.find, this._classifyZeroExportSinkAck, this._readZeroExportAckState, this._rememberZeroExportSinkAck, this._zeroExportSinkAckHistorySummary, this._zeroExportSinkConfig, this._zeroExportSinkRuntimeFor |
| [`GridConstraintsModule._zeroExportSinkAckHistorySummary`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1906) | rows | Array.isArray, Date.now, Object.fromEntries, all.filter, all.some, ids.map, perSink.flatMap, perSink.map, perSink.reduce |
| [`GridConstraintsModule._rememberZeroExportSinkAck`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1932) | id, row, maxRows | Array.isArray, Date.now, Math.max, Math.min, Number, String, list.push, list.slice |
| [`GridConstraintsModule._zeroExportSinkAckSummary`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1942) | – | Date.now, all.slice, rows.flatMap, rows.reduce |
| [`GridConstraintsModule._zeroExportSinkAvailability`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L1969) | cfg, sinkPriority | Array.isArray, Date.now, Math.max, Math.round, Number, Object.values, this._classifyZeroExportSinkAck, this._readZeroExportAckState, this._rememberZeroExportSinkAck, this._zeroExportSinkConfig, this._zeroExportSinkRuntimeFor |
| [`GridConstraintsModule._applyZeroExportAvailabilityToPlan`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2056) | sinkPriority, availability | Array.isArray, Math.max, Math.round, Number, order.find, plan.steps.filter, plan.steps.map |
| [`GridConstraintsModule._zeroExportSinkPriorityPlan`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2083) | cfg, exportOverLimitW, currentExportW, estimatedCurtailmentW | Array.isArray, Date.now, Math.max, Math.round, Number, hasText, order.map, steps.filter, this._exportWriteDiagnostics, this._getMaxFeedInPowerW, this._resolveCurtailMode, usableByRuntime |
| [`hasText`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2084) | v | String |
| [`usableByRuntime`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2118) | id | this._zeroExportSinkRuntimeFor |
| [`GridConstraintsModule._exportWriteDiagnostics`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2189) | cfg, modeResolved | Array.isArray, String, add, hasText, list.forEach, mapping.issues.entries, missing.push, rows.push, this._pvMappingStatus |
| [`hasText`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2193) | v | v.trim |
| [`add`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2194) | id, ok, label, required, nextStep | missing.push, rows.push |
| [`GridConstraintsModule._estimateCurtailmentW`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2261) | cfg, modeResolved, exportOverLimitW | Math.max, Math.round, Number, Number.isFinite, String, this._clamp, this._getMaxFeedInPowerW, this._getRatedPvW, this._normalizeInvList, this._sumRatedW |
| [`GridConstraintsModule._writeZeroExportSinkCommands`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2296) | sinkPriority, context | Array.isArray, Date.now, JSON.stringify, Math.max, Math.round, Number, String, isActuatorAuthorityBlockedResult, result.results.push, this._zeroExportSinkConfig, this._zeroExportSinkRuntimeFor, this.adapter.setForeignStateAsync, this.adapter.setStateAsync |
| [`GridConstraintsModule._buildZeroExportCommissioningAssistant`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2399) | cfg, ctx | Array.isArray, Date.now, Math.max, Math.round, Number, Number.isFinite, String, add, blockers.map, expectedOrder.every, hasText, items.filter, required.filter, sinkSteps.map (weitere in der Quelle) |
| [`hasText`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2401) | v | v.trim |
| [`add`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2421) | id, label, ok, required, nextStep, value | items.push |
| [`GridConstraintsModule._publishExportLimitStates`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2517) | cfg, enabled, approved, maxFeedInPowerW, biasW, gridW, exportW, action, modeResolved, negativePriceActive, runModeOverride, coordination | Array.isArray, Date.now, JSON.stringify, Math.max, Math.min, Math.round, Number, Number.isFinite, Object.keys, String, set, this._applyZeroExportAvailabilityToPlan, this._buildZeroExportCommissioningAssistant, this._estimateCurtailmentW (weitere in der Quelle) |
| [`set`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2518) | id, val | this.adapter.setStateAsync |
| [`GridConstraintsModule._getRatedPvW`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2768) | cfg | dp.getNumber, this._num |
| [`GridConstraintsModule._applyCurtailFailsafe`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2776) | cfg, modeResolved | isDynamicGridOwned, this.adapter.setStateAsync, this.dp.getEntry, this.dp.writeNumber |
| [`GridConstraintsModule.tickPlanning`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2809) | – | Date.now, Math.max, Math.min, Math.round, Number.isFinite, String, resolveGridImportLimitPolicy, this._buildExportLimitTarget, this._cfg, this._getGridW, this._isEnabled, this._isStaleGrid, this._num, this._tickPvEvu (weitere in der Quelle) |
| [`GridConstraintsModule.tickPostStorage`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L2931) | coordinator | Array.isArray, Date.now, Math.max, Math.round, Number, Number.isFinite, String, this._buildExportLimitTarget, this._cfg, this._getExportLimitRunMode, this._getGridW, this._isEnabled, this._isExportLimitDiagnosticMode, this._isExportLimitInstallerApproved (weitere in der Quelle) |
| [`GridConstraintsModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts#L3046) | – | this.tickPlanning, this.tickPostStorage |
