# src-ts/runtime-executables/main.ts

Verbindet den ioBroker-Adapter mit Webserver, Rollenprüfung, Konfiguration, State-Cache, EMS-Engine und Benachrichtigungen.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../src-ts/runtime-executables/main.ts) · [Gesamtübersicht](../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./lib/hosted-adapter` | [src-ts/runtime-executables/lib/hosted-adapter.ts](../../../../src-ts/runtime-executables/lib/hosted-adapter.ts) |
| `./lib/hosted-runtime-stop` | [src-ts/runtime-executables/lib/hosted-runtime-stop.ts](../../../../src-ts/runtime-executables/lib/hosted-runtime-stop.ts) |
| `./lib/hosted-startup-status` | [src-ts/runtime-executables/lib/hosted-startup-status.ts](../../../../src-ts/runtime-executables/lib/hosted-startup-status.ts) |
| `express4` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./lib/http-error-boundary` | [src-ts/runtime-executables/lib/http-error-boundary.ts](../../../../src-ts/runtime-executables/lib/http-error-boundary.ts) |
| `./lib/hosted-http-boundary` | [src-ts/runtime-executables/lib/hosted-http-boundary.ts](../../../../src-ts/runtime-executables/lib/hosted-http-boundary.ts) |
| `./lib/smarthome-import` | [src-ts/runtime-executables/lib/smarthome-import.ts](../../../../src-ts/runtime-executables/lib/smarthome-import.ts) |
| `./lib/smarthome-device-legacy` | [src-ts/runtime-executables/lib/smarthome-device-legacy.ts](../../../../src-ts/runtime-executables/lib/smarthome-device-legacy.ts) |
| `./lib/smarthome-custom-contract` | [src-ts/runtime-executables/lib/smarthome-custom-contract.ts](../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts) |
| `./lib/smarthome-device-controls` | [src-ts/runtime-executables/lib/smarthome-device-controls.ts](../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts) |
| `./lib/smarthome-device-api` | [src-ts/runtime-executables/lib/smarthome-device-api.ts](../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts) |
| `./lib/smarthome-device-detection` | [src-ts/runtime-executables/lib/smarthome-device-detection.ts](../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts) |
| `./lib/smarthome-activation` | [src-ts/runtime-executables/lib/smarthome-activation.ts](../../../../src-ts/runtime-executables/lib/smarthome-activation.ts) |
| `./lib/preserved-ui-config` | [src-ts/runtime-executables/lib/preserved-ui-config.ts](../../../../src-ts/runtime-executables/lib/preserved-ui-config.ts) |
| `./lib/runtime-proxy-html` | [src-ts/runtime-executables/lib/runtime-proxy-html.ts](../../../../src-ts/runtime-executables/lib/runtime-proxy-html.ts) |
| `./lib/ui-access-policy` | [src-ts/runtime-executables/lib/ui-access-policy.ts](../../../../src-ts/runtime-executables/lib/ui-access-policy.ts) |
| `./lib/ui-server-transport` | [src-ts/runtime-executables/lib/ui-server-transport.ts](../../../../src-ts/runtime-executables/lib/ui-server-transport.ts) |
| `./lib/mesh-peer-http` | [src-ts/runtime-executables/lib/mesh-peer-http.ts](../../../../src-ts/runtime-executables/lib/mesh-peer-http.ts) |
| `path` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `os` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./lib/installer-lifecycle` | [src-ts/runtime-executables/lib/installer-lifecycle.ts](../../../../src-ts/runtime-executables/lib/installer-lifecycle.ts) |
| `./lib/storage-farm-overview` | [src-ts/runtime-executables/lib/storage-farm-overview.ts](../../../../src-ts/runtime-executables/lib/storage-farm-overview.ts) |
| `./lib/tariff-price` | [src-ts/runtime-executables/lib/tariff-price.ts](../../../../src-ts/runtime-executables/lib/tariff-price.ts) |
| `./lib/customer-tariff` | [src-ts/runtime-executables/lib/customer-tariff.ts](../../../../src-ts/runtime-executables/lib/customer-tariff.ts) |
| `https` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./package.json` | [package.json](../../../../package.json) |
| `./lib/energy-origin-api` | [src-ts/runtime-executables/lib/energy-origin-api.ts](../../../../src-ts/runtime-executables/lib/energy-origin-api.ts) |
| `./lib/charging-diagnostics-api` | [src-ts/runtime-executables/lib/charging-diagnostics-api.ts](../../../../src-ts/runtime-executables/lib/charging-diagnostics-api.ts) |
| `./lib/nvp-config-api` | [src-ts/runtime-executables/lib/nvp-config-api.ts](../../../../src-ts/runtime-executables/lib/nvp-config-api.ts) |
| `./lib/dynamic-grid-config-api` | [src-ts/runtime-executables/lib/dynamic-grid-config-api.ts](../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts) |
| `./ems/services/dynamic-grid-ownership` | [src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts](../../../../src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts) |
| `./lib/partner-contracts` | [src-ts/runtime-executables/lib/partner-contracts.ts](../../../../src-ts/runtime-executables/lib/partner-contracts.ts) |
| `./lib/partner-config-api` | [src-ts/runtime-executables/lib/partner-config-api.ts](../../../../src-ts/runtime-executables/lib/partner-config-api.ts) |
| `./lib/partner-runtime` | [src-ts/runtime-executables/lib/partner-runtime.ts](../../../../src-ts/runtime-executables/lib/partner-runtime.ts) |
| `./lib/sse-runtime-guard` | [src-ts/runtime-executables/lib/sse-runtime-guard.ts](../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts) |
| `./lib/ephemeral-cache` | [src-ts/runtime-executables/lib/ephemeral-cache.ts](../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts) |
| `./lib/station-display-presentation` | [src-ts/runtime-executables/lib/station-display-presentation.ts](../../../../src-ts/runtime-executables/lib/station-display-presentation.ts) |
| `./lib/license-bootstrap-access` | [src-ts/runtime-executables/lib/license-bootstrap-access.ts](../../../../src-ts/runtime-executables/lib/license-bootstrap-access.ts) |
| `./ems/services/tariff-provider-registry` | [src-ts/runtime-executables/ems/services/tariff-provider-registry.ts](../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts) |
| `./ems/services/evcs-unit-conversion` | [src-ts/runtime-executables/ems/services/evcs-unit-conversion.ts](../../../../src-ts/runtime-executables/ems/services/evcs-unit-conversion.ts) |
| `./lib/evcs-electrical-limits` | [src-ts/runtime-executables/lib/evcs-electrical-limits.ts](../../../../src-ts/runtime-executables/lib/evcs-electrical-limits.ts) |
| `./lib/notification-mail` | [src-ts/runtime-executables/lib/notification-mail.ts](../../../../src-ts/runtime-executables/lib/notification-mail.ts) |
| `./ems/services/open-meteo-pv-forecast` | [src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts](../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts) |
| `./ems/services/admin-overview-publisher` | [src-ts/runtime-executables/ems/services/admin-overview-publisher.ts](../../../../src-ts/runtime-executables/ems/services/admin-overview-publisher.ts) |
| `./lib/ts-mirrors/backend/main-runtime/main-runtime-helpers` | [src-ts/backend/main-runtime/main-runtime-helpers.ts](../../../../src-ts/backend/main-runtime/main-runtime-helpers.ts) |
| `./lib/ts-mirrors/main/api-state` | [src-ts/main/api-state.ts](../../../../src-ts/main/api-state.ts) |
| `./lib/ts-mirrors/main/api-set` | [src-ts/main/api-set.ts](../../../../src-ts/main/api-set.ts) |
| `@iobroker/type-detector` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./ems/engine` | [src-ts/runtime-executables/ems/engine.ts](../../../../src-ts/runtime-executables/ems/engine.ts) |
| `./ems/services/para14a-eebus-api` | [src-ts/runtime-executables/ems/services/para14a-eebus-api.ts](../../../../src-ts/runtime-executables/ems/services/para14a-eebus-api.ts) |
| `./ems/services/measurement-freshness` | [src-ts/runtime-executables/ems/services/measurement-freshness.ts](../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts) |
| `./ems/services/actuator-shadow-arbiter` | [src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts](../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts) |
| `./ems/services/storage-self-consumption-policy` | [src-ts/runtime-executables/ems/services/storage-self-consumption-policy.ts](../../../../src-ts/runtime-executables/ems/services/storage-self-consumption-policy.ts) |
| `./ems/services/country-profile-service` | [src-ts/runtime-executables/ems/services/country-profile-service.ts](../../../../src-ts/runtime-executables/ems/services/country-profile-service.ts) |
| `./ems/services/locale-api-service` | [src-ts/runtime-executables/ems/services/locale-api-service.ts](../../../../src-ts/runtime-executables/ems/services/locale-api-service.ts) |
| `./ems/services/feature-flags` | [src-ts/runtime-executables/ems/services/feature-flags.ts](../../../../src-ts/runtime-executables/ems/services/feature-flags.ts) |
| `./ems/services/storage-farm-aggregation` | [src-ts/runtime-executables/ems/services/storage-farm-aggregation.ts](../../../../src-ts/runtime-executables/ems/services/storage-farm-aggregation.ts) |
| `./ems/services/pv-source-identity` | [src-ts/runtime-executables/ems/services/pv-source-identity.ts](../../../../src-ts/runtime-executables/ems/services/pv-source-identity.ts) |
| `./ems/evcs-control-mapping` | [src-ts/runtime-executables/ems/evcs-control-mapping.ts](../../../../src-ts/runtime-executables/ems/evcs-control-mapping.ts) |
| `./ems/services/storage-datapoint-config` | [src-ts/runtime-executables/ems/services/storage-datapoint-config.ts](../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts) |
| `./ems/services/fenecon-hybrid-control` | [src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts](../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts) |
| `./ems/nexologic-engine` | [src-ts/runtime-executables/ems/nexologic-engine.ts](../../../../src-ts/runtime-executables/ems/nexologic-engine.ts) |
| `./lib/smarthome-contract` | [src-ts/runtime-executables/lib/smarthome-contract.ts](../../../../src-ts/runtime-executables/lib/smarthome-contract.ts) |
| `@iobroker/adapter-core` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./lib/mesh-coordinator` | [src-ts/runtime-executables/lib/mesh-coordinator.ts](../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts) |
| `./ems/services/netoperator-driver-registry` | [src-ts/runtime-executables/ems/services/netoperator-driver-registry.ts](../../../../src-ts/runtime-executables/ems/services/netoperator-driver-registry.ts) |
| `./lib/ts-mirrors/backend/feature-visibility/feature-visibility` | [src-ts/backend/feature-visibility/feature-visibility.ts](../../../../src-ts/backend/feature-visibility/feature-visibility.ts) |

**Direkt importiert von:**

Kein direkter Import innerhalb des erfassten Quellbereichs. Mögliche HTML-, Adapter-, Build- oder dynamische Einstiege sind separat zu prüfen.

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`parseCookies`](../../../../src-ts/runtime-executables/main.ts#L157) | req | parseUiCookies |
| [`createToken`](../../../../src-ts/runtime-executables/main.ts#L161) | – | crypto.randomBytes |
| [`nwAssertSafeConfigObject`](../../../../src-ts/runtime-executables/main.ts#L171) | value | Object.entries, pending.pop, pending.push |
| [`NexoWattVis.constructor`](../../../../src-ts/runtime-executables/main.ts#L200) | options | Object.create, super |
| [`getSnapshotChunk`](../../../../src-ts/runtime-executables/main.ts#L220) | client | Date.now, JSON.stringify, Number, Object.create, String, adapter.log?.warn, publicBuilder |
| [`NexoWattVis._nwSetTimeout`](../../../../src-ts/runtime-executables/main.ts#L447) | fn, ms, args | setTimeout, this.setTimeout |
| [`guarded`](../../../../src-ts/runtime-executables/main.ts#L452) | cbArgs | fn |
| [`NexoWattVis._nwSetInterval`](../../../../src-ts/runtime-executables/main.ts#L461) | fn, ms, args | setInterval, this.setInterval |
| [`guarded`](../../../../src-ts/runtime-executables/main.ts#L463) | cbArgs | fn |
| [`NexoWattVis._nwClearTimeout`](../../../../src-ts/runtime-executables/main.ts#L472) | timer | clearTimeout, this.clearTimeout |
| [`NexoWattVis._nwClearInterval`](../../../../src-ts/runtime-executables/main.ts#L478) | timer | clearInterval, this.clearInterval |
| [`NexoWattVis._nwSleep`](../../../../src-ts/runtime-executables/main.ts#L484) | ms | Promise.resolve |
| [`NexoWattVis._nwGetMemoryDiagnostics`](../../../../src-ts/runtime-executables/main.ts#L492) | – | Object.keys, this._nwSseGuard.getStats |
| [`NexoWattVis._nwHandleHeapPressure`](../../../../src-ts/runtime-executables/main.ts#L512) | sample | Math.round, Number, this._nwSseGuard.mitigatePressure, this.log.warn |
| [`NexoWattVis._nwPrepareControlledRestart`](../../../../src-ts/runtime-executables/main.ts#L533) | sample | Math.round, Number, this._nwCloseSseClients, this.log.error |
| [`NexoWattVis.ensureInfoConnectionState`](../../../../src-ts/runtime-executables/main.ts#L542) | – | this.setObjectNotExistsAsync |
| [`NexoWattVis._nwIsHttpServerListening`](../../../../src-ts/runtime-executables/main.ts#L562) | – | this._bridge.isListening |
| [`NexoWattVis._nwSetInfoConnection`](../../../../src-ts/runtime-executables/main.ts#L567) | online, reason | Date.now, Number, Number.isFinite, nwMainRuntimeTsHelpers.buildInfoConnectionStateUpdate, this._nwIsHttpServerListening, this.log.debug, this.setStateAsync, this.updateValue |
| [`NexoWattVis._nwRunApiStateTsShadowComparison`](../../../../src-ts/runtime-executables/main.ts#L607) | reason | Array.isArray, Date.now, String, nwMainRuntimeTsHelpers.compareApiStateShadow, result.mismatches.join, this.log.debug, this.log.warn |
| [`NexoWattVis._nwRunApiSetTsShadowPlan`](../../../../src-ts/runtime-executables/main.ts#L638) | scope, key, value | Array.isArray, Date.now, String, nwMainRuntimeTsHelpers.buildApiSetShadowPlan, plan.warnings.join, this.log.debug |
| [`NexoWattVis._nwBuildApiStateTsRuntimeResponse`](../../../../src-ts/runtime-executables/main.ts#L673) | reason | Date.now, Object.keys, String, nwMainApiStateTsHelpers.buildMainApiStateResponse, this.log.warn |
| [`NexoWattVis._nwTryApplyApiSetTsSettingsPlan`](../../../../src-ts/runtime-executables/main.ts#L715) | scope, key, value | Date.now, String, isActuatorAuthorityBlockedResult, mapped.trim, nwMainApiSetTsHelpers.buildMainSettingsWritePlan, this.log.warn, this.setForeignStateAsync, this.setStateAsync, this.updateValue |
| [`NexoWattVis._nwStartConnectionHeartbeat`](../../../../src-ts/runtime-executables/main.ts#L755) | – | this._nwSetInterval |
| [`NexoWattVis._nwStopConnectionHeartbeat`](../../../../src-ts/runtime-executables/main.ts#L768) | – | this._nwClearInterval |
| [`NexoWattVis._nwProtectCredentialState`](../../../../src-ts/runtime-executables/main.ts#L779) | id, foreign | foreignIds.has, localIds.has, this.extendForeignObjectAsync, this.getForeignObjectAsync, this.ownsLocalNamespace, this.setForeignObjectAsync |
| [`NexoWattVis.ensureInstallerStates`](../../../../src-ts/runtime-executables/main.ts#L807) | – | Object.entries, this._nwProtectCredentialState, this.setObjectNotExistsAsync |
| [`NexoWattVis.ensureSmartHomeUserStates`](../../../../src-ts/runtime-executables/main.ts#L838) | – | this.setObjectNotExistsAsync |
| [`NexoWattVis._nwParseTimeToMinutes`](../../../../src-ts/runtime-executables/main.ts#L934) | hhmm | Number.isFinite, String, parseInt, s.match |
| [`NexoWattVis._nwNormalizeDaysArray`](../../../../src-ts/runtime-executables/main.ts#L947) | days | Array.isArray, Number.isFinite, out.push, out.sort, parseInt, seen.add, seen.has |
| [`NexoWattVis._nwNormalizeSmartHomeTimersConfig`](../../../../src-ts/runtime-executables/main.ts#L965) | rawCfg | Array.isArray, Number.isFinite, Number.isNaN, Object.create, Object.keys, Object.prototype.hasOwnProperty.call, String, onLevel.replace, outTimers.sort, parseFloat, this._nwNormalizeDaysArray, this._nwParseTimeToMinutes, timers.push |
| [`NexoWattVis.loadSmartHomeTimersFromState`](../../../../src-ts/runtime-executables/main.ts#L1021) | – | JSON.parse, JSON.stringify, raw.trim, readPreservedUiStates, this._nwNormalizeSmartHomeTimersConfig, this._nwScheduleNextSmartHomeTimer, this.getStateAsync |
| [`NexoWattVis.getSmartHomeTimersConfig`](../../../../src-ts/runtime-executables/main.ts#L1053) | – | – |
| [`NexoWattVis.persistSmartHomeTimersToState`](../../../../src-ts/runtime-executables/main.ts#L1057) | cfg | Date.now, JSON.stringify, this._nwNormalizeSmartHomeTimersConfig, this._nwScheduleNextSmartHomeTimer, this.log.warn, this.setStateAsync |
| [`NexoWattVis._nwComputeNextOccurrence`](../../../../src-ts/runtime-executables/main.ts#L1073) | nowTs, daysArr, timeMinutes | Array.isArray, Date.now, Number.isFinite, at.getTime, base.getTime, base.setHours, base.setSeconds, d.getDay, d.getTime, daySet.has |
| [`NexoWattVis._nwComputeNextSmartHomeTimerEvents`](../../../../src-ts/runtime-executables/main.ts#L1095) | nowTs | Array.isArray, Object.create, this._nwComputeNextOccurrence, this._nwParseTimeToMinutes, this.getSmartHomeTimersConfig |
| [`NexoWattVis._nwClearSmartHomeTimerSchedule`](../../../../src-ts/runtime-executables/main.ts#L1131) | – | this._nwClearTimeout |
| [`NexoWattVis._nwScheduleNextSmartHomeTimer`](../../../../src-ts/runtime-executables/main.ts#L1139) | reason | Date.now, Math.max, this._nwClearSmartHomeTimerSchedule, this._nwComputeNextSmartHomeTimerEvents, this._nwSetTimeout, this.log.debug, this.setStateAsync |
| [`NexoWattVis._nwRunDueSmartHomeTimer`](../../../../src-ts/runtime-executables/main.ts#L1168) | – | this._nwExecuteSmartHomeTimerAction, this._nwScheduleNextSmartHomeTimer, this.getSmartHomeTimersConfig, this.log.warn |
| [`NexoWattVis._nwExecuteSmartHomeTimerAction`](../../../../src-ts/runtime-executables/main.ts#L1194) | timer, kind | Math.max, Math.min, Number.isFinite, String, devices.find, this._nwExecuteSmartHomeSceneAction, this._nwHasCentralLicenseGrant, this._nwRunSmartHomeSceneById, this.buildSmartHomeDevicesFromConfig, this.log.debug, this.log.warn |
| [`NexoWattVis._nwNormalizeSmartHomeLogicClocksConfig`](../../../../src-ts/runtime-executables/main.ts#L1261) | rawCfg | Array.isArray, Object.create, Object.keys, String, clocks.push, outClocks.sort, this._nwNormalizeDaysArray, this._nwParseTimeToMinutes, toSafeIdPart |
| [`toSafeIdPart`](../../../../src-ts/runtime-executables/main.ts#L1263) | input | String, s.toLowerCase |
| [`NexoWattVis.getSmartHomeLogicClocksConfig`](../../../../src-ts/runtime-executables/main.ts#L1310) | – | – |
| [`NexoWattVis.loadSmartHomeLogicClocksFromState`](../../../../src-ts/runtime-executables/main.ts#L1319) | – | JSON.parse, JSON.stringify, raw.trim, readPreservedUiStates, this._nwNormalizeSmartHomeLogicClocksConfig, this._nwRefreshLogicClockStatesNow, this._nwScheduleNextSmartHomeLogicClock, this.getStateAsync |
| [`NexoWattVis.persistSmartHomeLogicClocksToState`](../../../../src-ts/runtime-executables/main.ts#L1355) | cfg | Date.now, JSON.stringify, this._nwNormalizeSmartHomeLogicClocksConfig, this._nwRefreshLogicClockStatesNow, this._nwScheduleNextSmartHomeLogicClock, this.log.warn, this.setStateAsync |
| [`NexoWattVis._nwShiftDays`](../../../../src-ts/runtime-executables/main.ts#L1373) | daysArr, shift | Array.isArray, Number.isFinite, out.push, out.sort, parseInt, seen.add, seen.has |
| [`NexoWattVis._nwIsLogicClockActive`](../../../../src-ts/runtime-executables/main.ts#L1390) | clock, nowTs | Date.now, now.getDay, now.getHours, now.getMinutes, set.has, this._nwNormalizeDaysArray, this._nwParseTimeToMinutes |
| [`NexoWattVis._nwEnsureLogicClockObjects`](../../../../src-ts/runtime-executables/main.ts#L1419) | clock | String, this.setObjectNotExistsAsync |
| [`NexoWattVis._nwRefreshLogicClockStatesNow`](../../../../src-ts/runtime-executables/main.ts#L1449) | reason | Array.isArray, Date.now, Object.create, this._nwEnsureLogicClockObjects, this._nwIsLogicClockActive, this.getSmartHomeLogicClocksConfig, this.log.debug, this.setStateAsync |
| [`NexoWattVis._nwComputeNextSmartHomeLogicClockEvents`](../../../../src-ts/runtime-executables/main.ts#L1480) | nowTs | Array.isArray, Object.create, this._nwComputeNextOccurrence, this._nwNormalizeDaysArray, this._nwParseTimeToMinutes, this._nwShiftDays, this.getSmartHomeLogicClocksConfig |
| [`NexoWattVis._nwClearSmartHomeLogicClockSchedule`](../../../../src-ts/runtime-executables/main.ts#L1519) | – | this._nwClearTimeout |
| [`NexoWattVis._nwScheduleNextSmartHomeLogicClock`](../../../../src-ts/runtime-executables/main.ts#L1532) | reason | Date.now, Math.max, this._nwClearSmartHomeLogicClockSchedule, this._nwComputeNextSmartHomeLogicClockEvents, this._nwSetTimeout, this.log.debug, this.setStateAsync |
| [`NexoWattVis._nwRunDueSmartHomeLogicClock`](../../../../src-ts/runtime-executables/main.ts#L1564) | – | Object.create, String, this._nwEnsureLogicClockObjects, this._nwHasCentralLicenseGrant, this._nwRefreshLogicClockStatesNow, this._nwScheduleNextSmartHomeLogicClock, this.getSmartHomeLogicClocksConfig, this.log.warn, this.setStateAsync |
| [`NexoWattVis._nwGetSmartHomeSceneRuntime`](../../../../src-ts/runtime-executables/main.ts#L1605) | – | Array.isArray, nwNormalizeSmartHomeConfigContract, this.buildSmartHomeDevicesFromConfig, this.getSmartHomeConfig |
| [`NexoWattVis._nwParseSmartHomeBoolean`](../../../../src-ts/runtime-executables/main.ts#L1618) | raw | Number.isFinite, raw.trim |
| [`NexoWattVis._nwReadSmartHomeSafetySignal`](../../../../src-ts/runtime-executables/main.ts#L1629) | dpId, kind, staleAfterSec | Date.now, Math.max, Number, Number.isFinite, this._nwParseSmartHomeBoolean, this.getForeignStateAsync |
| [`NexoWattVis._nwCheckSmartHomeCoverSafety`](../../../../src-ts/runtime-executables/main.ts#L1649) | dev | Number, this._nwReadSmartHomeSafetySignal |
| [`NexoWattVis._nwCheckSmartHomeClimateSafetyForScene`](../../../../src-ts/runtime-executables/main.ts#L1665) | dev | Number, this._nwReadSmartHomeSafetySignal |
| [`NexoWattVis._nwPreflightSmartHomeSceneById`](../../../../src-ts/runtime-executables/main.ts#L1677) | sceneId, context | Array.isArray, Math.max, Math.min, Number, Object.prototype.hasOwnProperty.call, String, ctx.stack.slice, errors.push, nwNormalizeSmartHomeSceneActionKind, nwSmartHomeSceneActionTargetAvailable, runtime.devices.find, runtime.scenes.find, stack.concat, stack.includes (weitere in der Quelle) |
| [`NexoWattVis._nwRunSmartHomeSceneById`](../../../../src-ts/runtime-executables/main.ts#L1726) | sceneId, context | Promise.resolve, previous.catch, run.then, this._nwRunSmartHomeSceneByIdInternal |
| [`NexoWattVis._nwRunSmartHomeSceneByIdInternal`](../../../../src-ts/runtime-executables/main.ts#L1749) | sceneId, context | Array.isArray, Math.max, Math.min, Number, Object.prototype.hasOwnProperty.call, String, ctx.stack.slice, errors.push, nwNormalizeSmartHomeSceneActionKind, runtime.devices.find, runtime.scenes.find, stack.concat, stack.includes, this._nwExecuteSmartHomeSceneAction (weitere in der Quelle) |
| [`NexoWattVis._nwWriteProfiledSmartHomeState`](../../../../src-ts/runtime-executables/main.ts#L1813) | dev, dpId, value, sessionCheck | executeLegacyDeviceWrite, this.setForeignStateAsync |
| [`device`](../../../../src-ts/runtime-executables/main.ts#L1816) | id | this.buildSmartHomeDevicesFromConfig |
| [`readObject`](../../../../src-ts/runtime-executables/main.ts#L1817) | id | this.getForeignObjectAsync |
| [`readState`](../../../../src-ts/runtime-executables/main.ts#L1817) | id | this.getForeignStateAsync |
| [`writeState`](../../../../src-ts/runtime-executables/main.ts#L1818) | id, target | this.setForeignStateAsync |
| [`authorize`](../../../../src-ts/runtime-executables/main.ts#L1819) | – | centralLicenseSnapshot, sessionCheck, smartHomeEnabled, this._bridge.canWrite, this._nwHasCentralLicenseGrant |
| [`NexoWattVis._nwWriteSmartHomeSceneState`](../../../../src-ts/runtime-executables/main.ts#L1827) | dpId, value, dev | this._nwHasCentralLicenseGrant, this._nwWriteProfiledSmartHomeState |
| [`NexoWattVis._nwPulseSmartHomeSceneDatapoint`](../../../../src-ts/runtime-executables/main.ts#L1835) | dpId, pulseMs, dev, sessionCheck | Math.max, Math.min, Number, setTimeout, this._nwSmartHomePulseTimers.set, this._nwWriteProfiledSmartHomeState, this._nwWriteSmartHomeSceneState, timer.unref |
| [`NexoWattVis._nwCoerceSmartHomeSceneValueForDatapoint`](../../../../src-ts/runtime-executables/main.ts#L1853) | dpId, value | Number, Number.isFinite, String, this._nwParseSmartHomeBoolean, this.getForeignObjectAsync |
| [`NexoWattVis._nwExecuteSmartHomeSceneAction`](../../../../src-ts/runtime-executables/main.ts#L1873) | dev, kind, value, context | Math.max, Math.min, Math.round, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String, nwNormalizeSmartHomeSceneActionKind, parseInt, text.slice, text.startsWith, text.toLowerCase, this._nwCheckSmartHomeClimateSafetyForScene, this._nwCheckSmartHomeCoverSafety (weitere in der Quelle) |
| [`NexoWattVis.ensureLicenseStates`](../../../../src-ts/runtime-executables/main.ts#L2134) | – | Object.entries, this.setObjectNotExistsAsync |
| [`NexoWattVis._nwNormalizeLicenseKey`](../../../../src-ts/runtime-executables/main.ts#L2171) | key | String |
| [`NexoWattVis._nwLooksLikeMaskedLicenseKey`](../../../../src-ts/runtime-executables/main.ts#L2181) | key | String, nwMainRuntimeTsHelpers.isMaskedLicenseKeyInput, raw.replace, this._nwNormalizeLicenseKey, this.log.debug |
| [`NexoWattVis._nwCleanLicenseKeyInput`](../../../../src-ts/runtime-executables/main.ts#L2210) | key | String, nwMainRuntimeTsHelpers.normalizeLicenseKeyForStorage, this._nwLooksLikeMaskedLicenseKey, this.log.debug |
| [`NexoWattVis._nwGetSystemUuid`](../../../../src-ts/runtime-executables/main.ts#L2243) | – | String, pickUuidFromObject, this.getForeignObjectAsync, this.getForeignStateAsync, this.getStateAsync, this.log.debug |
| [`pickUuidFromObject`](../../../../src-ts/runtime-executables/main.ts#L2250) | obj | scan |
| [`scan`](../../../../src-ts/runtime-executables/main.ts#L2259) | value, key | Object.entries, Object.prototype.hasOwnProperty.call, scan, seen.add, seen.has, uuidRe.test, value.trim |
| [`NexoWattVis._nwNormalizeLicenseEdition`](../../../../src-ts/runtime-executables/main.ts#L2320) | edition | String |
| [`NexoWattVis._nwRuntimeLicenseSnapshot`](../../../../src-ts/runtime-executables/main.ts#L2327) | – | Object.freeze, centralLicenseSnapshot, fresh.grants.slice |
| [`NexoWattVis._nwHasCentralLicenseGrant`](../../../../src-ts/runtime-executables/main.ts#L2339) | grant, continuing | String, centralLicenseSnapshot, snapshot.grants.includes, this._nwRuntimeLicenseSnapshot |
| [`NexoWattVis._nwCurrentLicenseEdition`](../../../../src-ts/runtime-executables/main.ts#L2344) | – | this._nwRuntimeLicenseSnapshot |
| [`NexoWattVis._nwLicenseFeaturesForEdition`](../../../../src-ts/runtime-executables/main.ts#L2348) | edition | hemsFeatures.has, nwFeatureFlagsService.buildFeatureMap, this._nwNormalizeLicenseEdition |
| [`NexoWattVis._nwLicenseAppFeature`](../../../../src-ts/runtime-executables/main.ts#L2363) | appId | String, nwFeatureFlagsService.appFeature |
| [`NexoWattVis._nwFeatureInSnapshot`](../../../../src-ts/runtime-executables/main.ts#L2403) | snapshot, feature | Object.hasOwn, Reflect.get, String, snapshot.grants.includes, this._nwLicenseFeaturesForEdition |
| [`NexoWattVis._nwIsFeatureLicensed`](../../../../src-ts/runtime-executables/main.ts#L2418) | feature | this._nwFeatureInSnapshot, this._nwRuntimeLicenseSnapshot |
| [`NexoWattVis._nwLicenseAllowsAppId`](../../../../src-ts/runtime-executables/main.ts#L2422) | appId | String, snapshot.grants.includes, this._nwIsFeatureLicensed, this._nwLicenseAppFeature, this._nwRuntimeLicenseSnapshot |
| [`NexoWattVis._nwLicenseMaxWallboxes`](../../../../src-ts/runtime-executables/main.ts#L2430) | – | this._nwRuntimeLicenseSnapshot |
| [`NexoWattVis._nwLicenseMaxStorages`](../../../../src-ts/runtime-executables/main.ts#L2434) | – | this._nwRuntimeLicenseSnapshot |
| [`NexoWattVis._nwValidateStorageFarmLicense`](../../../../src-ts/runtime-executables/main.ts#L2438) | config | this._nwCurrentLicenseEdition, this._nwLicenseMaxStorages, this._nwNormalizeStorageFarmRows |
| [`NexoWattVis._nwBuildLicenseFeatureInfo`](../../../../src-ts/runtime-executables/main.ts#L2455) | – | Number, Object.fromEntries, Object.keys, String, centralLicenseSnapshot, nwFeatureFlagsService.editionLabel, nwFeatureFlagsService.homeIncludedApps, nwFeatureFlagsService.storagePerformanceProfile, this._nwLicenseFeaturesForEdition |
| [`NexoWattVis._nwApplyLicenseLimitsToEmsApps`](../../../../src-ts/runtime-executables/main.ts#L2495) | emsApps | JSON.parse, JSON.stringify, Object.assign, Object.keys, this._nwCurrentLicenseEdition, this._nwLicenseAllowsAppId, this.nwDeepMerge |
| [`NexoWattVis._nwApplyLicenseLimitsToInstallerPatch`](../../../../src-ts/runtime-executables/main.ts#L2519) | patch | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, Reflect.deleteProperty, Reflect.get, Reflect.set, normalizePositiveW, nwFeatureFlagsService.storagePerformanceProfile, p.settingsConfig.evcsList.slice, p.settingsConfig.stationGroups.map, p.storageFarm.storages.map (weitere in der Quelle) |
| [`normalizePositiveW`](../../../../src-ts/runtime-executables/main.ts#L2550) | value | Math.min, Math.round, Number, Number.isFinite |
| [`NexoWattVis._nwRefreshLicenseFromConfiguredKey`](../../../../src-ts/runtime-executables/main.ts#L2580) | _logResult | centralLicenseSnapshot |
| [`NexoWattVis._nwInitLicense`](../../../../src-ts/runtime-executables/main.ts#L2594) | – | this._nwRefreshLicenseFromConfiguredKey |
| [`NexoWattVis.ensureSettingsStates`](../../../../src-ts/runtime-executables/main.ts#L2605) | – | Object.entries, flowConfigKeys.has, this.extendObjectAsync, this.getStateAsync, this.setObjectNotExistsAsync, this.setStateAsync |
| [`NexoWattVis.ensureSimulationStates`](../../../../src-ts/runtime-executables/main.ts#L2785) | – | Object.entries, this._nwProtectCredentialState, this.setObjectNotExistsAsync |
| [`NexoWattVis.ensureWeatherStates`](../../../../src-ts/runtime-executables/main.ts#L2841) | – | Object.entries, this.getStateAsync, this.setObjectNotExistsAsync, this.setStateAsync |
| [`NexoWattVis.ensureEnergyTotalStates`](../../../../src-ts/runtime-executables/main.ts#L2894) | – | Object.entries, this._nwDetectInfluxInstance, this._nwEnsureInfluxCustom, this._nwGetHistoryInstance, this.getStateAsync, this.setObjectNotExistsAsync, this.setStateAsync |
| [`NexoWattVis._nwHttpsGetJson`](../../../../src-ts/runtime-executables/main.ts#L2947) | url, timeoutMs | requestOpenMeteoJson |
| [`NexoWattVis._nwGetSystemGeo`](../../../../src-ts/runtime-executables/main.ts#L2956) | – | Number, Number.isFinite, this.getForeignObjectAsync |
| [`NexoWattVis._nwRefreshSystemLanguage`](../../../../src-ts/runtime-executables/main.ts#L2978) | reason | Object.assign, String, nwCountryProfileService.getConfiguredCountryProfile, nwCountryProfileService.normalizeLanguage, nwCountryProfileService.readIoBrokerSystemLanguage |
| [`NexoWattVis._nwBuildLocaleInfo`](../../../../src-ts/runtime-executables/main.ts#L2996) | – | nwCountryProfileService.buildLocaleInfo |
| [`NexoWattVis._nwBuildCountryProfileInfo`](../../../../src-ts/runtime-executables/main.ts#L3004) | – | Object.assign, nwCountryProfileService.getConfiguredCountryProfile, this._nwBuildLocaleInfo |
| [`NexoWattVis._nwWeatherTextDe`](../../../../src-ts/runtime-executables/main.ts#L3019) | code | Number, Number.isFinite |
| [`NexoWattVis.nwUpdateWeather`](../../../../src-ts/runtime-executables/main.ts#L3065) | reason | Array.isArray, Math.round, Number, Number.isFinite, String, clearAll, configuredOpenMeteoApiKey, encodeURIComponent, lat.toFixed, lon.toFixed, safeOpenMeteoError, setIfUnmapped, this._notifyGetSettingBool, this._notifyGetSettingString (weitere in der Quelle) |
| [`setIfUnmapped`](../../../../src-ts/runtime-executables/main.ts#L3077) | key, val | this._nwHasMappedDatapoint, this.setStateAsync |
| [`clearAll`](../../../../src-ts/runtime-executables/main.ts#L3090) | – | setIfUnmapped |
| [`NexoWattVis.stopWeatherService`](../../../../src-ts/runtime-executables/main.ts#L3203) | – | this._nwClearInterval, this._nwClearTimeout |
| [`NexoWattVis.startWeatherService`](../../../../src-ts/runtime-executables/main.ts#L3221) | – | this._notifyGetSettingBool, this._nwSetInterval, this._nwSetTimeout, this.stopWeatherService |
| [`run`](../../../../src-ts/runtime-executables/main.ts#L3236) | – | this.nwUpdateWeather |
| [`NexoWattVis.ensureNotificationStates`](../../../../src-ts/runtime-executables/main.ts#L3248) | – | Object.entries, this.getStateAsync, this.setObjectNotExistsAsync, this.setStateAsync |
| [`NexoWattVis.nwDeepMerge`](../../../../src-ts/runtime-executables/main.ts#L3288) | target, patch, validated | Array.isArray, Object.entries, Object.prototype.hasOwnProperty.call, nwAssertSafeConfigObject, patch.map, this.nwDeepMerge |
| [`NexoWattVis.nwInstallerManagedKeys`](../../../../src-ts/runtime-executables/main.ts#L3334) | – | – |
| [`NexoWattVis._nwIsPlainObject`](../../../../src-ts/runtime-executables/main.ts#L3389) | v | Array.isArray |
| [`NexoWattVis._nwDeepClone`](../../../../src-ts/runtime-executables/main.ts#L3398) | v | Array.isArray, this.nwDeepMerge |
| [`NexoWattVis._nwCountNonEmptyStrings`](../../../../src-ts/runtime-executables/main.ts#L3408) | obj | Object.values, v.trim |
| [`NexoWattVis._nwPatchScore`](../../../../src-ts/runtime-executables/main.ts#L3422) | patchObj | Array.isArray, this._nwCountNonEmptyStrings, this._nwIsPlainObject |
| [`NexoWattVis.nwNormalizeOperatingStrategies`](../../../../src-ts/runtime-executables/main.ts#L3457) | configIn, appEnabled | asArray, asRecord, asString, clampInt, defaultProfiles, linkIds.add, linkIds.has, links.push, makeIdsUnique, normalizeLink, normalizeSimulation, normalizedProfiles.map, profileIds.has, profilesRaw.map (weitere in der Quelle) |
| [`asRecord`](../../../../src-ts/runtime-executables/main.ts#L3459) | value | this._nwIsPlainObject |
| [`asArray`](../../../../src-ts/runtime-executables/main.ts#L3460) | value | Array.isArray |
| [`asString`](../../../../src-ts/runtime-executables/main.ts#L3461) | value, fallback | String |
| [`clampNumber`](../../../../src-ts/runtime-executables/main.ts#L3465) | value, fallback, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`nullableNumber`](../../../../src-ts/runtime-executables/main.ts#L3470) | value, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`clampInt`](../../../../src-ts/runtime-executables/main.ts#L3475) | value, fallback, min, max | Math.round, clampNumber |
| [`normalizeId`](../../../../src-ts/runtime-executables/main.ts#L3476) | value, fallback | asString |
| [`validTime`](../../../../src-ts/runtime-executables/main.ts#L3480) | value, fallback | asString |
| [`makeIdsUnique`](../../../../src-ts/runtime-executables/main.ts#L3481) | items, prefix | items.map |
| [`defaultNightReserve`](../../../../src-ts/runtime-executables/main.ts#L3496) | targetSocPct | – |
| [`defaultProfiles`](../../../../src-ts/runtime-executables/main.ts#L3506) | – | defaultNightReserve |
| [`normalizeMappings`](../../../../src-ts/runtime-executables/main.ts#L3523) | input | asRecord, asString |
| [`normalizeCustomResource`](../../../../src-ts/runtime-executables/main.ts#L3529) | input, index | asRecord, asString, clampInt, clampNumber, controlTypes.includes, failSafePolicies.includes, normalizeId, normalizeMappings, resourceTypes.includes |
| [`normalizeProfile`](../../../../src-ts/runtime-executables/main.ts#L3563) | input, index | Math.min, asRecord, asString, clampNumber, normalizeId, reserveModes.includes, seasons.includes, validTime |
| [`normalizeLink`](../../../../src-ts/runtime-executables/main.ts#L3590) | input | asRecord, asString, clampInt, normalizeMappings, roles.includes, sourceId.startsWith |
| [`normalizeSchedule`](../../../../src-ts/runtime-executables/main.ts#L3614) | input, ruleType | Array.from, asArray, asRecord, asString, clampInt, modes.includes, validTime, weekdays.slice |
| [`normalizeCondition`](../../../../src-ts/runtime-executables/main.ts#L3635) | input, index | String, allowedMetrics.includes, asRecord, asString, booleanMetrics.has, clampNumber, normalizeId, operators.includes, stringMetrics.has |
| [`normalizeRule`](../../../../src-ts/runtime-executables/main.ts#L3656) | input, index, profileIds | asArray, asRecord, asString, clampInt, clampNumber, makeIdsUnique, normalizeId, normalizeSchedule, profileIds.has, profileScopeRaw.replace, requirements.includes, ruleTypes.includes, sourcePolicies.includes, validTime |
| [`normalizeResourceState`](../../../../src-ts/runtime-executables/main.ts#L3709) | input | asRecord, asString, clampNumber, nullableNumber |
| [`normalizeSimulation`](../../../../src-ts/runtime-executables/main.ts#L3726) | input, activeProfileId, allowedProfileIds | Object.keys, allowedProfileIds.has, asRecord, asString, clampNumber, normalizeResourceState |
| [`NexoWattVis.nwNormalizeInstallerPatch`](../../../../src-ts/runtime-executables/main.ts#L3856) | patchIn, baseNative | Array.isArray, JSON.stringify, Math.max, Math.min, Math.round, Number, Number.isFinite, Object.assign, Object.entries, String, allowed.includes, defaultEnergyOriginConfig, ensurePlainObj, this._nwDeepClone (weitere in der Quelle) |
| [`ensurePlainObj`](../../../../src-ts/runtime-executables/main.ts#L3869) | key, defObj | this._nwDeepClone, this._nwIsPlainObject |
| [`NexoWattVis.nwApplyInstallerPatchToRuntimeConfig`](../../../../src-ts/runtime-executables/main.ts#L4328) | baseConfig, patch | Object.prototype.hasOwnProperty.call, this._nwDeepClone, this._nwIsPlainObject, this.nwApplyEmsAppsToLegacyFlags, this.nwDeepMerge, this.nwInstallerManagedKeys |
| [`NexoWattVis.nwNormalizeEmsApps`](../../../../src-ts/runtime-executables/main.ts#L4377) | nativeObj | this._nwApplyLicenseLimitsToEmsApps |
| [`NexoWattVis.nwApplyEmsAppsToLegacyFlags`](../../../../src-ts/runtime-executables/main.ts#L4497) | nativeObj | this._nwApplyLicenseLimitsToEmsApps, this._nwLicenseAllowsAppId, this.nwApplyStorageMultiUsePolicy, this.nwNormalizeEmsApps |
| [`NexoWattVis.nwApplyStorageMultiUsePolicy`](../../../../src-ts/runtime-executables/main.ts#L4594) | nativeObj | Array.isArray, String, clampNumber, this.log.warn |
| [`finiteOrNull`](../../../../src-ts/runtime-executables/main.ts#L4613) | value | Number, Number.isFinite |
| [`clampNumber`](../../../../src-ts/runtime-executables/main.ts#L4618) | value, min, max, fallback | Math.max, Math.min, finiteOrNull |
| [`NexoWattVis._nwPartnerAppActive`](../../../../src-ts/runtime-executables/main.ts#L4672) | appId | this._nwLicenseAllowsAppId |
| [`NexoWattVis._nwStartPartnerRuntime`](../../../../src-ts/runtime-executables/main.ts#L4682) | – | require, this._partnerRuntime.refresh, this._partnerRuntime?.stop, this.log.warn |
| [`getRoot`](../../../../src-ts/runtime-executables/main.ts#L4685) | – | – |
| [`isAppActive`](../../../../src-ts/runtime-executables/main.ts#L4686) | appId | this._nwPartnerAppActive |
| [`controlAvailable`](../../../../src-ts/runtime-executables/main.ts#L4687) | – | this._nwPartnerAppActive |
| [`isResourceAvailable`](../../../../src-ts/runtime-executables/main.ts#L4688) | resourceId | Date.now, Number.isFinite |
| [`readState`](../../../../src-ts/runtime-executables/main.ts#L4694) | id | – |
| [`readTelemetry`](../../../../src-ts/runtime-executables/main.ts#L4695) | resourceId | – |
| [`NexoWattVis._nwValidateDynamicGridConfig`](../../../../src-ts/runtime-executables/main.ts#L4702) | raw, rootConfig | dynamicGridSignature, validateDynamicGridCandidate |
| [`NexoWattVis._nwValidateNvpTopology`](../../../../src-ts/runtime-executables/main.ts#L4711) | raw | JSON.stringify, validateNvpCandidate |
| [`NexoWattVis.loadInstallerConfigFromState`](../../../../src-ts/runtime-executables/main.ts#L4722) | – | JSON.parse, JSON.stringify, String, parseInstallerConfigState, readPreservedUiStates, this._nwDeepClone, this._nwValidateDynamicGridConfig, this._nwValidateNvpTopology, this.getStateAsync, this.log.warn, this.nwApplyInstallerPatchToRuntimeConfig, this.nwNormalizeInstallerPatch, this.nwReadUserdataBackup, this.nwWriteUserdataBackup (weitere in der Quelle) |
| [`NexoWattVis._nwBeginInstallerConfigMutation`](../../../../src-ts/runtime-executables/main.ts#L4807) | – | this._partnerRuntime?.stop |
| [`NexoWattVis._nwEndInstallerConfigMutation`](../../../../src-ts/runtime-executables/main.ts#L4817) | token | dynamicGridSignature, this._nwCommitDynamicGridConfig, this._partnerRuntime.refresh, this.log.warn |
| [`NexoWattVis._nwInstallerConfigRevision`](../../../../src-ts/runtime-executables/main.ts#L4836) | – | installerRevision |
| [`NexoWattVis._nwAssertInstallerConfigRevision`](../../../../src-ts/runtime-executables/main.ts#L4840) | expected | assertInstallerRevision |
| [`NexoWattVis._nwProvisionInstallerObjects`](../../../../src-ts/runtime-executables/main.ts#L4844) | nextConfig | Array.isArray, Math.max, Number, provisionInstallerObjects |
| [`canWrite`](../../../../src-ts/runtime-executables/main.ts#L4848) | – | this._bridge.canWrite |
| [`NexoWattVis._nwApplyInstallerRuntime`](../../../../src-ts/runtime-executables/main.ts#L4855) | restartEms, reason | Math.max, Math.min, Math.round, Number, createPublicHttpError, currentTariffModule.applyTariffMappings, currentTariffModule.invalidateConfiguration, this._meshCoordinator?.syncAppLifecycle, this._nwClearInterval, this._nwGetStorageFarmRuntimeInfo, this._nwHistoryApiCache.clear, this._nwProvisionInstallerObjects, this._nwSetInterval, this.emsEngine?.mm?.modules?.find (weitere in der Quelle) |
| [`NexoWattVis.reconcileDeviceEms`](../../../../src-ts/runtime-executables/main.ts#L4892) | devices | String, assertDeviceAppActivations, assertReady, currentDynamicGridConfig, prepareDynamicGridInstallerPatch, this._bridge.deviceEmsPlan, this._nwApplyInstallerRuntime, this._nwBeginInstallerConfigMutation, this._nwDeepClone, this._nwEndInstallerConfigMutation, this._nwProvisionInstallerObjects, this._nwValidateStorageFarmLicense, this.emsEngine.stopForReconfigure, this.log.warn (weitere in der Quelle) |
| [`assertReady`](../../../../src-ts/runtime-executables/main.ts#L4893) | – | centralLicenseSnapshot, this._bridge.canWrite |
| [`NexoWattVis.reserveDeviceProfileChange`](../../../../src-ts/runtime-executables/main.ts#L4941) | input | Array.isArray, Object.values, activeDeviceProfileReferences, assertReady, changes.map, codeError, refs.read.map, refs.write.map, this._bridge.resolveDeviceProfileReferences, this._nwBeginInstallerConfigMutation, this._nwEndInstallerConfigMutation, this.nwApplyInstallerPatchToRuntimeConfig |
| [`codeError`](../../../../src-ts/runtime-executables/main.ts#L4942) | code | Object.assign |
| [`assertReady`](../../../../src-ts/runtime-executables/main.ts#L4943) | – | codeError, this._bridge.canWrite |
| [`touches`](../../../../src-ts/runtime-executables/main.ts#L4963) | id | prefixes.some |
| [`NexoWattVis.persistInstallerConfigToState`](../../../../src-ts/runtime-executables/main.ts#L4983) | patchObj | JSON.stringify, assertDynamicGridPersistence, assertNvpPersistence, assertPartnerPersistence, createPublicHttpError, currentPartnerConfig, dynamicGridAppState, this._meshCoordinator?.assertAppChange, this._nwCancelDynamicGridTransition, this._nwProtectCredentialState, this.log.warn, this.nwApplyInstallerPatchToRuntimeConfig, this.setStateAsync |
| [`NexoWattVis.nwEnsureUserdataBackupObjects`](../../../../src-ts/runtime-executables/main.ts#L5018) | – | ensureState, this.getForeignObjectAsync, this.setForeignObjectAsync |
| [`ensureState`](../../../../src-ts/runtime-executables/main.ts#L5040) | id, common | this._nwProtectCredentialState, this.getForeignObjectAsync, this.setForeignObjectAsync |
| [`NexoWattVis.nwWriteUserdataBackup`](../../../../src-ts/runtime-executables/main.ts#L5098) | patchObj, reason | Date.now, JSON.parse, JSON.stringify, String, curRaw.trim, this._nwPatchScore, this._nwProtectCredentialState, this.getForeignStateAsync, this.log.warn, this.nwEnsureUserdataBackupObjects, this.setForeignStateAsync |
| [`NexoWattVis.nwReadUserdataBackup`](../../../../src-ts/runtime-executables/main.ts#L5172) | { strict = false } | Array.isArray, JSON.parse, JSON.stringify, Number.isInteger, Object.keys, parseInstallerConfigState, raw.trim, this._nwPatchScore, this.getForeignStateAsync, this.nwEnsureUserdataBackupObjects |
| [`NexoWattVis.nwSimListInstances`](../../../../src-ts/runtime-executables/main.ts#L5225) | – | Object.entries, String, out.push, out.sort, this.getForeignObjectsAsync |
| [`NexoWattVis.nwSimPickDefaultInstance`](../../../../src-ts/runtime-executables/main.ts#L5256) | instances | Array.isArray, String, arr.find |
| [`NexoWattVis.nwSimSetInstanceEnabled`](../../../../src-ts/runtime-executables/main.ts#L5269) | simInstanceId, enabled | JSON.parse, JSON.stringify, String, this.getForeignObjectAsync, this.log.warn, this.setForeignObjectAsync |
| [`NexoWattVis.nwSimWaitAlive`](../../../../src-ts/runtime-executables/main.ts#L5298) | simInstanceId, timeoutMs | Date.now, String, this._nwSleep, this.getForeignStateAsync |
| [`NexoWattVis.nwSimReadBackupPatchFromState`](../../../../src-ts/runtime-executables/main.ts#L5319) | – | JSON.parse, raw.trim, this.getStateAsync |
| [`NexoWattVis.nwSimReadBackupSettingsFromState`](../../../../src-ts/runtime-executables/main.ts#L5338) | – | JSON.parse, raw.trim, this.getStateAsync |
| [`NexoWattVis.nwSimWriteStatus`](../../../../src-ts/runtime-executables/main.ts#L5357) | update | Date.now, String, this._nwProtectCredentialState, this.log.warn, this.setStateAsync |
| [`NexoWattVis.nwSimBuildPatch`](../../../../src-ts/runtime-executables/main.ts#L5384) | simInstanceId | Math.max, Math.min, Math.round, Number, Number.isFinite, String, cid.toUpperCase, evcsList.push, pad2, stType.val.trim, this.getForeignObjectAsync, this.getForeignStateAsync |
| [`pad2`](../../../../src-ts/runtime-executables/main.ts#L5416) | n | String |
| [`NexoWattVis.nwSimEnable`](../../../../src-ts/runtime-executables/main.ts#L5555) | simInstanceId, restartEmsFn | JSON.stringify, Math.max, Math.round, Number, Number.isFinite, String, createPublicHttpError, raw.trim, restartEmsFn, safeConfigurationFailure, this._nwBeginInstallerConfigMutation, this._nwEndInstallerConfigMutation, this.ensureEvcsStates, this.ensureRfidStates (weitere in der Quelle) |
| [`NexoWattVis.nwSimDisable`](../../../../src-ts/runtime-executables/main.ts#L5673) | restartEmsFn | Object.keys, String, createPublicHttpError, restartEmsFn, this._nwBeginInstallerConfigMutation, this._nwEndInstallerConfigMutation, this.ensureEvcsStates, this.ensureRfidStates, this.initEmsEngine, this.nwApplyEmsAppsToLegacyFlags, this.nwApplyInstallerPatchToRuntimeConfig, this.nwDeepMerge, this.nwNormalizeInstallerPatch, this.nwSimReadBackupPatchFromState (weitere in der Quelle) |
| [`NexoWattVis._nwNormalizeStorageDatapointsConfig`](../../../../src-ts/runtime-executables/main.ts#L5749) | storageIn, _globalDatapointsIn | nwNormalizeStorageDatapointsConfig |
| [`NexoWattVis._nwNormalizeStorageFarmRow`](../../../../src-ts/runtime-executables/main.ts#L5765) | row, index | Array.isArray, Math.max, Number, String, boolFrom, numberOrNull, nwIsLikelyDirectEssSetpointObjectId, nwIsLikelyFemsGridMeasurementObjectId, nwIsLikelyFemsGridTargetObjectId, textFrom |
| [`textFrom`](../../../../src-ts/runtime-executables/main.ts#L5773) | keys | String |
| [`numberOrNull`](../../../../src-ts/runtime-executables/main.ts#L5786) | keys | Number, Number.isFinite, String, raw.includes, raw.lastIndexOf, raw.replace |
| [`boolFrom`](../../../../src-ts/runtime-executables/main.ts#L5806) | fallback, keys | Object.prototype.hasOwnProperty.call, String |
| [`NexoWattVis._nwNormalizeStorageFarmRows`](../../../../src-ts/runtime-executables/main.ts#L5901) | rows | Array.isArray |
| [`NexoWattVis._nwStorageFarmRowHasRealDatapoint`](../../../../src-ts/runtime-executables/main.ts#L5912) | row | this._nwNormalizeStorageFarmRow |
| [`NexoWattVis._nwStorageFarmRowHasWritableDatapoint`](../../../../src-ts/runtime-executables/main.ts#L5927) | row | this._nwNormalizeStorageFarmRow |
| [`NexoWattVis._nwGetStorageFarmRuntimeInfo`](../../../../src-ts/runtime-executables/main.ts#L5940) | – | JSON.parse, configuredRows.filter, rows.filter, runtimeRows.filter, this._nwLicenseMaxStorages, this._nwNormalizeStorageFarmRows |
| [`NexoWattVis._nwGetStorageControlAuthority`](../../../../src-ts/runtime-executables/main.ts#L6033) | – | dynamicGridHasControl, this._nwGetStorageFarmRuntimeInfo |
| [`NexoWattVis.ensureStorageFarmStates`](../../../../src-ts/runtime-executables/main.ts#L6124) | – | Object.entries, key.endsWith, this.setObjectNotExistsAsync |
| [`NexoWattVis.syncStorageFarmDefaultsToStates`](../../../../src-ts/runtime-executables/main.ts#L6201) | – | Object.entries, this.getStateAsync, this.setStateAsync |
| [`NexoWattVis.syncStorageFarmConfigFromAdmin`](../../../../src-ts/runtime-executables/main.ts#L6262) | – | Array.isArray, Date.now, JSON.stringify, String, this._nwGetStorageFarmRuntimeInfo, this._nwNormalizeStorageFarmRows, this.getStateAsync, this.log.debug, this.setStateAsync, this.updateValue |
| [`NexoWattVis.updateStorageFarmDerived`](../../../../src-ts/runtime-executables/main.ts#L6339) | reason | Array.from, Date.now, JSON.stringify, Math.abs, Math.floor, Math.max, Math.round, Number, Number.isFinite, String, addBases, baseBlocked.push, baseBlocked.slice, batteryFlowSources.add (weitere in der Quelle) |
| [`getState`](../../../../src-ts/runtime-executables/main.ts#L6375) | id | String, _stCache.get, _stCache.has, _stCache.set, this.getForeignStateAsync |
| [`toBool`](../../../../src-ts/runtime-executables/main.ts#L6389) | v | String |
| [`inferDeviceBases`](../../../../src-ts/runtime-executables/main.ts#L6408) | id | String, aliasBase.replace, sid.match |
| [`parseNum`](../../../../src-ts/runtime-executables/main.ts#L6436) | val | Number.isFinite, num.includes, num.lastIndexOf, num.replace, num.split, parseFloat, parts.join, parts.pop, s.match, val.trim |
| [`getUnit`](../../../../src-ts/runtime-executables/main.ts#L6491) | id | String, _unitCache.get, _unitCache.has, _unitCache.set, this.getForeignObjectAsync |
| [`scalePowerToW`](../../../../src-ts/runtime-executables/main.ts#L6512) | n, unit | Number.isFinite, String, u.toLowerCase, ul.endsWith, ul.includes, ul.startsWith |
| [`readNumber`](../../../../src-ts/runtime-executables/main.ts#L6533) | id, kind, opts | Number.isFinite, String, getState, getUnit, parseNum, scalePowerToW, sl.endsWith, sl.includes, ul.includes |
| [`isMappedSetpointPowerId`](../../../../src-ts/runtime-executables/main.ts#L6712) | id | String, targetPowerIds.includes |
| [`addBases`](../../../../src-ts/runtime-executables/main.ts#L6781) | id | devBases.includes, devBases.push, inferDeviceBases |
| [`pickFirstState`](../../../../src-ts/runtime-executables/main.ts#L6810) | candidates | getState |
| [`considerTs`](../../../../src-ts/runtime-executables/main.ts#L6863) | st | Math.max, Number.isFinite |
| [`readBoolDp`](../../../../src-ts/runtime-executables/main.ts#L6931) | id | Number.isFinite, String, getState, toBool |
| [`normalizeLimitW`](../../../../src-ts/runtime-executables/main.ts#L6947) | v | Math.round, Number, Number.isFinite, String, v.trim |
| [`readLimitW`](../../../../src-ts/runtime-executables/main.ts#L6963) | staticValue | normalizeLimitW |
| [`NexoWattVis._sfGetNormalizedFarmConfig`](../../../../src-ts/runtime-executables/main.ts#L7447) | – | Array.isArray, String, this._nwGetStorageFarmRuntimeInfo, this._nwLicenseMaxStorages, this._nwNormalizeStorageFarmRows |
| [`NexoWattVis._sfGetStorageDispatchKey`](../../../../src-ts/runtime-executables/main.ts#L7490) | storage, index | Math.max, Number, String |
| [`NexoWattVis._sfGetDischargeFloorSocPct`](../../../../src-ts/runtime-executables/main.ts#L7523) | source | Math.max, Math.min, Number, String, resolveStorageOperatingPolicy, this._nwGetStorageControlAuthority |
| [`NexoWattVis._sfGetResponseLimitFactor`](../../../../src-ts/runtime-executables/main.ts#L7570) | storage, direction, now | Date.now, Math.max, Math.round, Number, Number.isFinite, this._sfDispatchState.get, this._sfDispatchState.set, this._sfGetStorageDispatchKey |
| [`NexoWattVis._sfRememberDispatchSnapshot`](../../../../src-ts/runtime-executables/main.ts#L7614) | storage, direction, requestW | Date.now, Math.round, Number, Number.isFinite, String, this._sfDispatchState.get, this._sfDispatchState.set, this._sfGetStorageDispatchKey |
| [`NexoWattVis._sfReadbackNumber`](../../../../src-ts/runtime-executables/main.ts#L7639) | objectId, expectedValue, options | Math.abs, Math.max, Math.min, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String, this.getForeignStateAsync |
| [`NexoWattVis._sfWriteIfChanged`](../../../../src-ts/runtime-executables/main.ts#L7697) | objectId, value, options | Date.now, Math.max, Math.min, Number, Number.isFinite, String, isActuatorAuthorityBlockedResult, this._sfLastSetpoints.delete, this._sfLastSetpoints.get, this._sfLastSetpoints.set, this._sfLastSetpointsTs.delete, this._sfLastSetpointsTs.get, this._sfLastSetpointsTs.set, this._sfReadbackNumber (weitere in der Quelle) |
| [`NexoWattVis.applyStorageFarmTargetW`](../../../../src-ts/runtime-executables/main.ts#L7787) | targetW, meta | Array.from, Array.isArray, Date.now, JSON.stringify, Math.abs, Math.max, Math.min, Math.round, Number, Number.isFinite, String, activeGroups.map, allocMap.get, allocMap.set (weitere in der Quelle) |
| [`readFarmStatus`](../../../../src-ts/runtime-executables/main.ts#L7806) | – | Array.isArray, JSON.parse, this.getStateAsync |
| [`finiteLimitOrNull`](../../../../src-ts/runtime-executables/main.ts#L7846) | v | Math.round, Number, Number.isFinite, String, v.trim |
| [`parseStrictNumber`](../../../../src-ts/runtime-executables/main.ts#L7996) | raw | Number, Number.isFinite, raw.trim, textValue.includes, textValue.lastIndexOf, textValue.replace |
| [`readNumber`](../../../../src-ts/runtime-executables/main.ts#L8014) | objectId | String, parseStrictNumber, this.getForeignObjectAsync, this.getForeignStateAsync |
| [`readLocalNumber`](../../../../src-ts/runtime-executables/main.ts#L8033) | ids | parseStrictNumber, this.getStateAsync |
| [`getLimitW`](../../../../src-ts/runtime-executables/main.ts#L8299) | storage, dir | Math.round, Number, Number.isFinite, String, raw.trim |
| [`sumLimitW`](../../../../src-ts/runtime-executables/main.ts#L8315) | items, dir | Math.max, Number.isFinite, getLimitW |
| [`buildWeights`](../../../../src-ts/runtime-executables/main.ts#L8331) | items, dir | Math.max, Math.min, Number.isFinite, list.map |
| [`normalizeWeights`](../../../../src-ts/runtime-executables/main.ts#L8382) | list, weights, dir | Array.isArray, out.reduce, weights.slice |
| [`allocateWeightedCapped`](../../../../src-ts/runtime-executables/main.ts#L8415) | total, items, dir | Math.floor, Math.max, Math.min, Math.round, Number, Number.isFinite, active.filter, active.reduce, allocMap.set, buildWeights, list.map, normalizeWeights, order.push, order.sort (weitere in der Quelle) |
| [`canUse`](../../../../src-ts/runtime-executables/main.ts#L8495) | s | – |
| [`releaseOnce`](../../../../src-ts/runtime-executables/main.ts#L8638) | key, id | String, r.ignoredAlternatives.push, releaseRows.push, releaseRows.some, selectedIds.has, this._sfWriteIfChanged |
| [`writeSelected`](../../../../src-ts/runtime-executables/main.ts#L8655) | key, id, value | String, selectedWrites.push, this._sfWriteIfChanged |
| [`NexoWattVis.syncInstallerConfigToStates`](../../../../src-ts/runtime-executables/main.ts#L8886) | – | Number, Object.entries, this.setStateAsync |
| [`NexoWattVis.syncSettingsToStates`](../../../../src-ts/runtime-executables/main.ts#L8912) | preserveExisting | Object.entries, getBool, this.getStateAsync, this.setStateAsync |
| [`getBool`](../../../../src-ts/runtime-executables/main.ts#L8921) | key, def | – |
| [`NexoWattVis.syncSettingsConfigToStates`](../../../../src-ts/runtime-executables/main.ts#L8949) | – | Array.from, Array.isArray, Date.now, Math.max, Math.min, Math.round, Number, Number.isFinite, String, boostRaw.trim, controlPreferenceRaw.toLowerCase, evcsList.push, g.name.trim, g.stationKey.trim (weitere in der Quelle) |
| [`canUseEvcsControlDp`](../../../../src-ts/runtime-executables/main.ts#L8973) | id | String, this.getForeignObjectAsync, this.getForeignStateAsync |
| [`canUseEvcsReadDp`](../../../../src-ts/runtime-executables/main.ts#L8994) | id | String, this.getForeignObjectAsync, this.getForeignStateAsync |
| [`NexoWattVis._nwEvcsInputSpecsForWallbox`](../../../../src-ts/runtime-executables/main.ts#L9227) | wb | Math.max, Math.round, Number |
| [`NexoWattVis._nwExtractAliasReadId`](../../../../src-ts/runtime-executables/main.ts#L9255) | obj | alias.trim, raw.trim |
| [`NexoWattVis._nwBuildEvcsInputBindings`](../../../../src-ts/runtime-executables/main.ts#L9272) | – | Array.isArray, addBinding, sourceIds.push, this._nwEvcsAliasRefreshPending.clear, this._nwEvcsInputSpecsForWallbox, this._nwEvcsMirrorStampByKey.clear, this._nwExtractAliasReadId, this.getForeignObjectAsync, visited.add, visited.has |
| [`addBinding`](../../../../src-ts/runtime-executables/main.ts#L9277) | map, id, binding | id.trim, list.push, list.some, map.get, map.set |
| [`NexoWattVis._nwIsReadOnlyEvcsMirrorKey`](../../../../src-ts/runtime-executables/main.ts#L9344) | key | String |
| [`NexoWattVis._nwEvcsMirrorValue`](../../../../src-ts/runtime-executables/main.ts#L9348) | binding, value | String |
| [`NexoWattVis._nwPublishEvcsInputBinding`](../../../../src-ts/runtime-executables/main.ts#L9359) | binding, state, sourceId, reason | Date.now, JSON.stringify, Number.isFinite, Object.is, String, binding.key.startsWith, this._nwEvcsMirrorStampByKey.get, this._nwEvcsMirrorStampByKey.set, this._nwEvcsMirrorValue, this._nwScaleMappedValue, this.log.debug, this.setStateAsync, this.updateValue |
| [`NexoWattVis._nwReadAndApplyEvcsConfiguredId`](../../../../src-ts/runtime-executables/main.ts#L9396) | configuredId, reason | Array.isArray, configuredId.trim, this._nwEvcsInputBindingsByConfiguredId.get, this._nwPublishEvcsInputBinding, this.getForeignStateAsync |
| [`NexoWattVis._nwScheduleEvcsAliasRefresh`](../../../../src-ts/runtime-executables/main.ts#L9411) | configuredId, reason | Promise.resolve, configuredId.trim, this._nwEvcsAliasRefreshPending.delete, this._nwEvcsAliasRefreshPending.get, this._nwEvcsAliasRefreshPending.has, this._nwEvcsAliasRefreshPending.keys, this._nwEvcsAliasRefreshPending.set |
| [`NexoWattVis._nwApplyEvcsInputSourceState`](../../../../src-ts/runtime-executables/main.ts#L9432) | id, state, reason | Array.isArray, handledKeys.add, id.trim, this._nwEvcsInputBindingsBySourceId.get, this._nwPublishEvcsInputBinding, this._nwScheduleEvcsAliasRefresh |
| [`NexoWattVis.ensureEvcsStates`](../../../../src-ts/runtime-executables/main.ts#L9456) | provisionCount | Array.isArray, Math.max, Math.round, Number, Object.entries, this.extendObjectAsync, this.log.debug, this.setObjectNotExistsAsync, this.setStateAsync |
| [`NexoWattVis.ensureRfidStates`](../../../../src-ts/runtime-executables/main.ts#L9561) | provisionOnly | Date.now, Object.entries, this.getStateAsync, this.setObjectNotExistsAsync, this.setStateAsync, this.updateValue |
| [`NexoWattVis.ensureEvcsSessionsStates`](../../../../src-ts/runtime-executables/main.ts#L9667) | – | this.setObjectNotExistsAsync |
| [`NexoWattVis.loadEvcsSessionsCache`](../../../../src-ts/runtime-executables/main.ts#L9722) | – | Array.isArray, Date.now, JSON.parse, JSON.stringify, Number, arr.slice, st.val.trim, this.getStateAsync, this.log.warn, this.setLocalStateWithCache |
| [`NexoWattVis.persistEvcsSessions`](../../../../src-ts/runtime-executables/main.ts#L9757) | nowTs | Date.now, JSON.stringify, Number, this.log.warn, this.setLocalStateWithCache |
| [`NexoWattVis.appendEvcsSession`](../../../../src-ts/runtime-executables/main.ts#L9774) | entry, nowTs | Date.now, Number, this._evcsSessionsBuf.push, this._evcsSessionsBuf.splice, this.log.warn, this.persistEvcsSessions |
| [`NexoWattVis.maybeUpdateEvcsSessionTracker`](../../../../src-ts/runtime-executables/main.ts#L9795) | key, tsMs | Date.now, Math.abs, Number, Number.isFinite, key.match, this._startEvcsSession, this._stopEvcsSession, this._updateEvcsSession |
| [`NexoWattVis._startEvcsSession`](../../../../src-ts/runtime-executables/main.ts#L9838) | idx, tsMs, pW, energyTotalKwh | Date.now, Number, Number.isFinite, String, this.normalizeRfidCode |
| [`NexoWattVis._updateEvcsSession`](../../../../src-ts/runtime-executables/main.ts#L9877) | idx, tsMs, pW, energyTotalKwh | Date.now, Math.abs, Math.max, Number, Number.isFinite, String, this.normalizeRfidCode |
| [`NexoWattVis._stopEvcsSession`](../../../../src-ts/runtime-executables/main.ts#L9920) | idx, tsMs, pW, energyTotalKwh | Date.now, Math.max, Math.round, Number, Number.isFinite, this.appendEvcsSession, this.log.warn |
| [`NexoWattVis.seedEvcsDayBaseCache`](../../../../src-ts/runtime-executables/main.ts#L9978) | – | Date.now, Math.max, Math.round, Number, String, this.getStateAsync, this.log.debug |
| [`NexoWattVis.subscribeEvcsMappedStates`](../../../../src-ts/runtime-executables/main.ts#L9999) | – | Array.from, Array.isArray, this._nwBuildEvcsInputBindings, this._nwEvcsInputBindingsByConfiguredId.keys, this._nwEvcsInputBindingsBySourceId.keys, this._nwPrimeForeignPowerScale, this._nwReadAndApplyEvcsConfiguredId, this.log.debug, this.subscribeForeignStatesAsync |
| [`NexoWattVis.subscribeEmsUiStates`](../../../../src-ts/runtime-executables/main.ts#L10044) | – | Array.isArray, Math.round, Number, Number.isFinite, g.stationKey.trim, prime, this.subscribeForeignStatesAsync, toSafe |
| [`prime`](../../../../src-ts/runtime-executables/main.ts#L10063) | key | Date.now, this.getStateAsync, this.updateValue |
| [`toSafe`](../../../../src-ts/runtime-executables/main.ts#L10144) | s | String |
| [`NexoWattVis.getSmartHomeConfig`](../../../../src-ts/runtime-executables/main.ts#L10202) | – | Array.isArray, String, ids.map, ids.push, nwNormalizeSmartHomeConfigContract, seen.add, seen.has, this._nwIsPlainObject |
| [`pretty`](../../../../src-ts/runtime-executables/main.ts#L10230) | s | String |
| [`NexoWattVis.nwNormalizeSmartHomeConfig`](../../../../src-ts/runtime-executables/main.ts#L10256) | config | nwNormalizeSmartHomeConfigContract |
| [`NexoWattVis.nwValidateSmartHomeConfig`](../../../../src-ts/runtime-executables/main.ts#L10260) | config | nwValidateSmartHomeConfigContract |
| [`NexoWattVis.getLogicEditorConfig`](../../../../src-ts/runtime-executables/main.ts#L10268) | – | Array.isArray |
| [`NexoWattVis.nwNormalizeLogicEditorConfig`](../../../../src-ts/runtime-executables/main.ts#L10283) | inCfg | Array.isArray, Date.now, Number.isFinite, Object.entries, clamp, graph.links.push, graph.nodes.push, isPlain, mkId, out.graphs.push, safeStr, toNum |
| [`isPlain`](../../../../src-ts/runtime-executables/main.ts#L10290) | o | this._nwIsPlainObject |
| [`safeStr`](../../../../src-ts/runtime-executables/main.ts#L10297) | s, maxLen | String, str.slice |
| [`mkId`](../../../../src-ts/runtime-executables/main.ts#L10310) | prefix | Date.now, Math.random |
| [`clamp`](../../../../src-ts/runtime-executables/main.ts#L10325) | v, lo, hi | Math.max, Math.min |
| [`toNum`](../../../../src-ts/runtime-executables/main.ts#L10332) | v, def | Number, Number.isFinite |
| [`NexoWattVis.nwValidateLogicEditorConfig`](../../../../src-ts/runtime-executables/main.ts#L10411) | config | validateNexoLogicConfig |
| [`NexoWattVis.buildSmartHomeDevicesFromConfig`](../../../../src-ts/runtime-executables/main.ts#L10421) | – | Array.isArray, Object.prototype.hasOwnProperty.call, String, cfgDevices.forEach, devices.push, devices.some, pushBlind, pushDimmer, pushRtr, pushScene, pushSensor, pushSwitch, resolveFloorName, resolveFunctionName (weitere in der Quelle) |
| [`resolveRoomName`](../../../../src-ts/runtime-executables/main.ts#L10446) | roomId | rooms.find |
| [`resolveRoomFloorId`](../../../../src-ts/runtime-executables/main.ts#L10457) | roomId | String, rooms.find |
| [`resolveFloorName`](../../../../src-ts/runtime-executables/main.ts#L10468) | floorId | String, floors.find |
| [`resolveFunctionName`](../../../../src-ts/runtime-executables/main.ts#L10479) | fnId | funcs.find |
| [`pushSwitch`](../../../../src-ts/runtime-executables/main.ts#L10735) | id, opts | devices.push |
| [`pushDimmer`](../../../../src-ts/runtime-executables/main.ts#L10772) | id, opts | devices.push |
| [`pushBlind`](../../../../src-ts/runtime-executables/main.ts#L10811) | positionId, upId, downId, stopId, opts | devices.push |
| [`pushRtr`](../../../../src-ts/runtime-executables/main.ts#L10860) | currentId, setpointId, modeId, humidityId, opts | devices.push |
| [`pushSensor`](../../../../src-ts/runtime-executables/main.ts#L10901) | id, opts | devices.push |
| [`pushScene`](../../../../src-ts/runtime-executables/main.ts#L10937) | id, opts | devices.push |
| [`NexoWattVis.getSmartHomeDevicesWithState`](../../../../src-ts/runtime-executables/main.ts#L11158) | – | Array.isArray, JSON.parse, JSON.stringify, Math.max, Math.min, Number, Object.create, String, buildDeviceControls, createDeviceSnapshotReader, qualityRows.filter, qualityRows.find, readField, result.push (weitere in der Quelle) |
| [`toNumberStrict`](../../../../src-ts/runtime-executables/main.ts#L11173) | value | Number, Number.isFinite, value.trim |
| [`toBooleanStrict`](../../../../src-ts/runtime-executables/main.ts#L11184) | value | Number.isFinite, value.trim |
| [`toStringStrict`](../../../../src-ts/runtime-executables/main.ts#L11198) | value | String |
| [`colorToHex`](../../../../src-ts/runtime-executables/main.ts#L11204) | value, format | Math.max, Math.min, Math.round, Number, Number.isFinite, String, hex2, text.match, text.slice, text.startsWith |
| [`clamp`](../../../../src-ts/runtime-executables/main.ts#L11206) | v | Math.max, Math.min, Math.round, Number |
| [`hex2`](../../../../src-ts/runtime-executables/main.ts#L11207) | v | clamp |
| [`readObject`](../../../../src-ts/runtime-executables/main.ts#L11233) | id | this.getForeignObjectAsync |
| [`readState`](../../../../src-ts/runtime-executables/main.ts#L11234) | id | this.getForeignStateAsync |
| [`readField`](../../../../src-ts/runtime-executables/main.ts#L11245) | field, id, parser, affectsQuality | Date.now, Math.max, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String, parser, qualityRows.push, this.getForeignStateAsync |
| [`NexoWattVis.migrateNativeConfig`](../../../../src-ts/runtime-executables/main.ts#L11491) | – | ensureObject, setBoolean, setNumber, this.log.info, this.log.warn |
| [`ensureObject`](../../../../src-ts/runtime-executables/main.ts#L11514) | key | Array.isArray |
| [`setNumber`](../../../../src-ts/runtime-executables/main.ts#L11527) | path, def | Array.isArray, Number, Number.isFinite, String |
| [`setBoolean`](../../../../src-ts/runtime-executables/main.ts#L11567) | path, def | Array.isArray, String |
| [`NexoWattVis.cleanupOrphanedObjects`](../../../../src-ts/runtime-executables/main.ts#L11651) | – | Array.isArray, Number, Number.isFinite, String, delRec, fullId.slice, fullId.startsWith, keep.add, keep.has, short.split, this._nwGetFlowSlotInfo, this.getObjectViewAsync, this.log.debug, toSafeIdPart |
| [`toSafeIdPart`](../../../../src-ts/runtime-executables/main.ts#L11660) | input | String, s.toLowerCase |
| [`delRec`](../../../../src-ts/runtime-executables/main.ts#L11673) | id | this.delObjectAsync |
| [`NexoWattVis.onReady`](../../../../src-ts/runtime-executables/main.ts#L11759) | – | Math.max, Math.min, Math.round, Number, Number.isFinite, Object.keys, assertStartupAuthority, centralLicenseSnapshot, fatalStartupCodes.includes, require, startOpenMeteoPvForecastRuntime, startupStep, this._adminOverviewPublisher?.stop, this._bridge.canWrite (weitere in der Quelle) |
| [`assertStartupAuthority`](../../../../src-ts/runtime-executables/main.ts#L11763) | – | centralLicenseSnapshot, this._bridge.canWrite |
| [`startupStep`](../../../../src-ts/runtime-executables/main.ts#L11773) | operation | assertStartupAuthority, operation |
| [`NexoWattVis.initLogicEngine`](../../../../src-ts/runtime-executables/main.ts#L12062) | force | this._nwHasCentralLicenseGrant, this.getLogicEditorConfig, this.logicEngine.init, this.logicEngine.stop |
| [`NexoWattVis.initEmsEngine`](../../../../src-ts/runtime-executables/main.ts#L12089) | force | String, this._meshCoordinator?.syncAppLifecycle, this.emsEngine.init, this.emsEngine.stop, this.emsEngine.stopForReconfigure |
| [`NexoWattVis.initLogicEngine`](../../../../src-ts/runtime-executables/main.ts#L12135) | force, configOverride | candidate.init, candidate.stop, createPublicHttpError, previous.stop, this._nwHasCentralLicenseGrant, this.getLogicEditorConfig, this.logicEngine.init, validateNexoLogicConfig, validation.errors.map |
| [`NexoWattVis.replaceLogicEngine`](../../../../src-ts/runtime-executables/main.ts#L12166) | nextConfig, rollbackConfig | candidate.init, candidate.stop, previousEngine.stop, rollback.init, rollback.stop, this._nwHasCentralLicenseGrant |
| [`NexoWattVis.subscribeEmsUiStates`](../../../../src-ts/runtime-executables/main.ts#L12207) | – | Math.round, Number, Number.isFinite, primeKey, this.subscribeForeignStatesAsync |
| [`primeKey`](../../../../src-ts/runtime-executables/main.ts#L12229) | key | Date.now, this.getStateAsync, this.updateValue |
| [`NexoWattVis.startServer`](../../../../src-ts/runtime-executables/main.ts#L12381) | – | Object.freeze, Object.fromEntries, app.disable, app.get, app.post, app.put, app.use, createHostedHttpHandler, createRuntimeFileSender, express, express.json, express.static, getControlProfiles, nwLocaleApiService.createLocaleHandler (weitere in der Quelle) |
| [`nwRuntimeHtml`](../../../../src-ts/runtime-executables/main.ts#L12387) | req, html | rewriteRuntimeProxyHtml, runtimeProxyPrefix |
| [`nwServeReactProxyIndex`](../../../../src-ts/runtime-executables/main.ts#L12391) | req, res, next | String, next, nwSendRuntimeFile, path.join, pathname.endsWith, runtimeProxyPrefix |
| [`nwNormalizeRemoteIp`](../../../../src-ts/runtime-executables/main.ts#L12415) | raw | String, ip.indexOf, ip.slice, ip.startsWith |
| [`nwRequestRemoteIp`](../../../../src-ts/runtime-executables/main.ts#L12426) | req | nwNormalizeRemoteIp |
| [`nwIsTrustedLanIp`](../../../../src-ts/runtime-executables/main.ts#L12439) | raw | Number, nwNormalizeRemoteIp |
| [`nwRequestOriginAllowed`](../../../../src-ts/runtime-executables/main.ts#L12453) | req | isIndependentMachineRequest, this._bridge.machineRequestAllowed, this._bridge.originAllowed |
| [`nwMaskEmail`](../../../../src-ts/runtime-executables/main.ts#L12521) | raw | String, local.slice, value.lastIndexOf, value.slice |
| [`nwPublicStateKeyBlocked`](../../../../src-ts/runtime-executables/main.ts#L12531) | rawKey | String, key.toLowerCase, lower.startsWith |
| [`nwRedactPublicValue`](../../../../src-ts/runtime-executables/main.ts#L12553) | value, depth | Array.isArray, JSON.parse, JSON.stringify, Object.entries, String, nwRedactPublicValue, text.endsWith, text.startsWith, value.map, value.trim |
| [`nwBuildPublicStateSnapshot`](../../../../src-ts/runtime-executables/main.ts#L12574) | source, includeDerived | Date.now, Object.assign, Object.entries, Object.prototype.hasOwnProperty.call, String, nwMaskEmail, nwPublicStateKeyBlocked, nwRedactPublicValue, stateValue |
| [`stateValue`](../../../../src-ts/runtime-executables/main.ts#L12587) | key | Object.prototype.hasOwnProperty.call |
| [`nwSanitizePublicConfig`](../../../../src-ts/runtime-executables/main.ts#L12604) | payload, installerAccess | Array.isArray, Object.assign, Object.entries, Object.fromEntries, String, nwMaskEmail, nwRedactPublicValue, rows.map |
| [`sendLicenseCors`](../../../../src-ts/runtime-executables/main.ts#L12672) | req, res | String, nwRequestOriginAllowed, res.setHeader |
| [`sendNoStore`](../../../../src-ts/runtime-executables/main.ts#L12693) | res | res.setHeader |
| [`esc`](../../../../src-ts/runtime-executables/main.ts#L12745) | s | String |
| [`sendSafeHttpFailure`](../../../../src-ts/runtime-executables/main.ts#L12937) | res, error | res.end, res.setHeader, res.status, safeHttpFailure |
| [`resolveStrictAccess`](../../../../src-ts/runtime-executables/main.ts#L12959) | req | centralAccess |
| [`hasCapability`](../../../../src-ts/runtime-executables/main.ts#L12961) | access, capability | Array.isArray, String, access.capabilities.includes, capability.some |
| [`sendForbidden`](../../../../src-ts/runtime-executables/main.ts#L12967) | res, message | res.status |
| [`requireCapability`](../../../../src-ts/runtime-executables/main.ts#L12970) | cap | – |
| [`requireAuth`](../../../../src-ts/runtime-executables/main.ts#L12980) | req, _res, next | _res.status, hasCapability, next, resolveStrictAccess, sendForbidden |
| [`renderRuntimeAccessPage`](../../../../src-ts/runtime-executables/main.ts#L13010) | title, capability, requiredRole | String |
| [`requirePageAccessOrRenderLock`](../../../../src-ts/runtime-executables/main.ts#L13027) | req, res, cap, title, requiredRole | hasCapability, nwRuntimeHtml, renderRuntimeAccessPage, res.status, resolveStrictAccess, sendNoStore |
| [`requireMeshInstalled`](../../../../src-ts/runtime-executables/main.ts#L13043) | _req, res, next | next, res.status, sendNoStore, this._meshCoordinator?.appState |
| [`beginMeshAppSave`](../../../../src-ts/runtime-executables/main.ts#L13083) | – | this._nwBeginInstallerConfigMutation |
| [`endMeshAppSave`](../../../../src-ts/runtime-executables/main.ts#L13084) | token | this._nwEndInstallerConfigMutation |
| [`getRoot`](../../../../src-ts/runtime-executables/main.ts#L13086) | – | – |
| [`getStatus`](../../../../src-ts/runtime-executables/main.ts#L13087) | – | this._partnerRuntime?.snapshot |
| [`invalidate`](../../../../src-ts/runtime-executables/main.ts#L13090) | – | this._partnerRuntime?.invalidate |
| [`commit`](../../../../src-ts/runtime-executables/main.ts#L13091) | config, appState, expectedVersion | createPublicHttpError, currentPartnerConfig, this._nwDeepClone, this._nwLicenseAllowsAppId, this.nwApplyInstallerPatchToRuntimeConfig, this.nwWriteUserdataBackup, this.persistInstallerConfigToState |
| [`commit`](../../../../src-ts/runtime-executables/main.ts#L13112) | prepared | Object.assign, this._nwDeepClone, this.nwWriteUserdataBackup, this.persistInstallerConfigToState |
| [`commit`](../../../../src-ts/runtime-executables/main.ts#L13132) | nvpTopology | Object.assign, createPublicHttpError, this._nwDeepClone, this._nwValidateNvpTopology, this._nwValidateStorageFarmLicense, this.nwWriteUserdataBackup, this.persistInstallerConfigToState |
| [`device`](../../../../src-ts/runtime-executables/main.ts#L13236) | id | this.buildSmartHomeDevicesFromConfig |
| [`readObject`](../../../../src-ts/runtime-executables/main.ts#L13237) | id | this.getForeignObjectAsync |
| [`readState`](../../../../src-ts/runtime-executables/main.ts#L13238) | id | this.getForeignStateAsync |
| [`writeState`](../../../../src-ts/runtime-executables/main.ts#L13239) | id, value | this.setForeignStateAsync |
| [`canOperate`](../../../../src-ts/runtime-executables/main.ts#L13240) | – | centralLicenseSnapshot, smartHomeEnabled, this._bridge.canWrite, this._nwHasCentralLicenseGrant |
| [`authorize`](../../../../src-ts/runtime-executables/main.ts#L13243) | req | hasCapability, resolveStrictAccess |
| [`createObjectIfAbsent`](../../../../src-ts/runtime-executables/main.ts#L13247) | id, object | this.setForeignObjectNotExistsAsync |
| [`authorizeMapping`](../../../../src-ts/runtime-executables/main.ts#L13248) | req | centralLicenseSnapshot, hasCapability, resolveStrictAccess, this._bridge.canWrite, this._nwHasCentralLicenseGrant |
| [`history`](../../../../src-ts/runtime-executables/main.ts#L13254) | id, options | – |
| [`nwWriteSmartHomeState`](../../../../src-ts/runtime-executables/main.ts#L13261) | req, dev, dpId, value | this._nwWriteProfiledSmartHomeState |
| [`parseBool`](../../../../src-ts/runtime-executables/main.ts#L13281) | value | Number.isFinite, value.trim |
| [`writePulse`](../../../../src-ts/runtime-executables/main.ts#L13291) | dpId, pulseMs | nwWriteSmartHomeState, this._nwPulseSmartHomeSceneDatapoint |
| [`parseSafetyBool`](../../../../src-ts/runtime-executables/main.ts#L13416) | raw | Number.isFinite, raw.trim |
| [`parseBool`](../../../../src-ts/runtime-executables/main.ts#L13571) | raw | raw.trim |
| [`pulse`](../../../../src-ts/runtime-executables/main.ts#L13654) | dpId | Math.max, Math.min, Number, nwWriteSmartHomeState, setTimeout, timer.unref |
| [`parseBool`](../../../../src-ts/runtime-executables/main.ts#L13663) | raw | Number.isFinite, raw.trim |
| [`toggleBooleanDp`](../../../../src-ts/runtime-executables/main.ts#L13673) | readId, writeId, explicit | nwWriteSmartHomeState, parseBool, this.getForeignStateAsync |
| [`checkSmartHomeClimateSafety`](../../../../src-ts/runtime-executables/main.ts#L13788) | dev | Math.max, Number, readSignal |
| [`parseBool`](../../../../src-ts/runtime-executables/main.ts#L13791) | raw | Number.isFinite, raw.trim |
| [`readSignal`](../../../../src-ts/runtime-executables/main.ts#L13801) | dpId, kind | Date.now, Number, Number.isFinite, parseBool, this.getForeignStateAsync |
| [`nwShcfgTdIsPlainObject`](../../../../src-ts/runtime-executables/main.ts#L14175) | value | Array.isArray |
| [`nwShcfgTdNormName`](../../../../src-ts/runtime-executables/main.ts#L14182) | value | Object.values, direct.trim, first.trim, value.trim |
| [`nwShcfgTdParentId`](../../../../src-ts/runtime-executables/main.ts#L14200) | id | String, parts.join, parts.pop |
| [`nwShcfgTdHash`](../../../../src-ts/runtime-executables/main.ts#L14212) | value | String, crypto.createHash |
| [`nwShcfgTdStateEntry`](../../../../src-ts/runtime-executables/main.ts#L14219) | objects, state, keyOverride | String, id.split, nwShcfgTdNormName |
| [`nwShcfgTdFindState`](../../../../src-ts/runtime-executables/main.ts#L14242) | control, names, predicate | Array.isArray, list.find |
| [`nwShcfgTdCollectConfiguredDpIds`](../../../../src-ts/runtime-executables/main.ts#L14264) | cfg | Array.isArray, devices.forEach |
| [`visit`](../../../../src-ts/runtime-executables/main.ts#L14272) | value, keyName | Array.isArray, Object.entries, String, nwShcfgTdIsPlainObject, out.add, value.forEach, value.trim |
| [`nwShcfgTdGetObjectsCache`](../../../../src-ts/runtime-executables/main.ts#L14297) | force | this._nwTypeDetectorObjectsCache.get |
| [`nwShcfgTdCollectCandidateRoots`](../../../../src-ts/runtime-executables/main.ts#L14319) | objects | Object.keys, out.sort |
| [`skip`](../../../../src-ts/runtime-executables/main.ts#L14328) | id | String, sid.startsWith |
| [`nwShcfgTdBestSourceId`](../../../../src-ts/runtime-executables/main.ts#L14364) | objects, rootId, control | Array.isArray, String, nwShcfgTdParentId |
| [`nwShcfgTdSuggestionScore`](../../../../src-ts/runtime-executables/main.ts#L14387) | item | Number |
| [`nwShcfgTdMergeSuggestion`](../../../../src-ts/runtime-executables/main.ts#L14399) | current, next | Array.from, Array.isArray, nwShcfgTdSuggestionScore, other.configuredOverlap.forEach, other.notes.forEach |
| [`nwShcfgTdBuildSuggestion`](../../../../src-ts/runtime-executables/main.ts#L14423) | { control, rootId, objects, configuredIds, config } | Array.from, Array.isArray, String, enrichSmartHomeImportSuggestion, extendSuggestion, notes.push, numberOr, nwShcfgTdBestSourceId, nwShcfgTdHash, nwShcfgTdNormName, pick, rawEntries.forEach, sourceId.split, stateMap.values (weitere in der Quelle) |
| [`getMeta`](../../../../src-ts/runtime-executables/main.ts#L14451) | state | nwShcfgTdStateEntry |
| [`pick`](../../../../src-ts/runtime-executables/main.ts#L14458) | names, predicate | getMeta, nwShcfgTdFindState |
| [`numberOr`](../../../../src-ts/runtime-executables/main.ts#L14465) | value, fallback | Number, Number.isFinite |
| [`onAborted`](../../../../src-ts/runtime-executables/main.ts#L14672) | – | abort.abort |
| [`stopping`](../../../../src-ts/runtime-executables/main.ts#L14680) | – | – |
| [`pretty`](../../../../src-ts/runtime-executables/main.ts#L14892) | s | String |
| [`isPlain`](../../../../src-ts/runtime-executables/main.ts#L14938) | o | this._nwIsPlainObject |
| [`safeStr`](../../../../src-ts/runtime-executables/main.ts#L14945) | v, maxLen | String, s.slice |
| [`makeNode`](../../../../src-ts/runtime-executables/main.ts#L15155) | – | Object.create |
| [`pushItem`](../../../../src-ts/runtime-executables/main.ts#L15195) | it | results.push, seen.add, seen.has |
| [`_nwDeepMerge`](../../../../src-ts/runtime-executables/main.ts#L15320) | target, patch | this.nwDeepMerge |
| [`_nwNormalizeEmsApps`](../../../../src-ts/runtime-executables/main.ts#L15359) | nativeObj | this._nwApplyLicenseLimitsToEmsApps |
| [`_nwApplyEmsAppsToLegacyFlags`](../../../../src-ts/runtime-executables/main.ts#L15428) | nativeObj | _nwNormalizeEmsApps, this._nwLicenseAllowsAppId |
| [`_nwPickInstallerConfig`](../../../../src-ts/runtime-executables/main.ts#L15475) | nativeObj | _nwNormalizeEmsApps, currentDynamicGridConfig, currentNvpConfig, currentPartnerConfig, this._nwBuildLicenseFeatureInfo, this._nwDeepClone, this._nwLicenseAllowsAppId, this.nwNormalizeOperatingStrategies |
| [`_nwPickPersistedInstallerConfig`](../../../../src-ts/runtime-executables/main.ts#L15565) | – | Object.assign, Object.keys, Object.prototype.hasOwnProperty.call, _nwNormalizeEmsApps, _nwPickInstallerConfig, clone, currentDynamicGridConfig, currentPartnerConfig, runtimeOnly.has |
| [`clone`](../../../../src-ts/runtime-executables/main.ts#L15572) | value | JSON.parse, JSON.stringify, this._nwDeepClone |
| [`_nwHydrateStorageFarmConfigFromRuntimeStates`](../../../../src-ts/runtime-executables/main.ts#L15604) | cfgOut | Array.from, Array.isArray, Math.max, Math.min, Math.round, Number, String, asList, fromStatusRows, parseJson, parsedGroups.filter, sf.storages.some, this._nwNormalizeStorageFarmRows, this.getStateAsync (weitere in der Quelle) |
| [`parseJson`](../../../../src-ts/runtime-executables/main.ts#L15612) | raw, fallback | JSON.parse, String |
| [`asList`](../../../../src-ts/runtime-executables/main.ts#L15618) | parsed | Array.isArray |
| [`fromStatusRows`](../../../../src-ts/runtime-executables/main.ts#L15624) | rows | Array.isArray |
| [`_nwProtectStorageFarmPatchFromEmptySubmit`](../../../../src-ts/runtime-executables/main.ts#L15702) | patchObj | Array.isArray, _nwHydrateStorageFarmConfigFromRuntimeStates, this.log.warn |
| [`_nwRegressionSafetyListInfo`](../../../../src-ts/runtime-executables/main.ts#L15753) | obj, pathText | Array.isArray, String |
| [`_nwRegressionSafetySetPath`](../../../../src-ts/runtime-executables/main.ts#L15763) | obj, pathText, value | Array.isArray, String, value.slice |
| [`_nwBuildRegressionSafetyReport`](../../../../src-ts/runtime-executables/main.ts#L15774) | patchObj, baseObj | Date.now, _nwRegressionSafetyListInfo, checks.filter, checks.push |
| [`_nwApplyInstallerRegressionSafetyGate`](../../../../src-ts/runtime-executables/main.ts#L15814) | patchObj, baseObj | _nwBuildRegressionSafetyReport, _nwRegressionSafetyListInfo, _nwRegressionSafetySetPath, this.log.warn |
| [`_nwRestartEms`](../../../../src-ts/runtime-executables/main.ts#L15841) | – | this.initEmsEngine, this.log.warn |
| [`_nwMaskTariffProviderForUi`](../../../../src-ts/runtime-executables/main.ts#L15853) | cfg | Object.keys, String, _nwTariffSecretKeys.has, this._nwDeepClone |
| [`stripRetainedTariffCredentials`](../../../../src-ts/runtime-executables/main.ts#L15864) | patch | this._nwDeepClone |
| [`_nwMergeTariffProviderSecrets`](../../../../src-ts/runtime-executables/main.ts#L15869) | incoming, existing | this._nwDeepClone |
| [`nwValidateStationTokenChanges`](../../../../src-ts/runtime-executables/main.ts#L15889) | patch | Array.isArray, String, existing.find, used.add, used.has |
| [`identity`](../../../../src-ts/runtime-executables/main.ts#L15893) | row, index | String |
| [`read`](../../../../src-ts/runtime-executables/main.ts#L16411) | relId, fallback | this.getForeignStateAsync |
| [`compactHas`](../../../../src-ts/runtime-executables/main.ts#L16570) | id | – |
| [`compactPick`](../../../../src-ts/runtime-executables/main.ts#L16571) | ids | ids.flat |
| [`nativeId`](../../../../src-ts/runtime-executables/main.ts#L16575) | suffix | – |
| [`deriveStationKey`](../../../../src-ts/runtime-executables/main.ts#L16692) | parts | String, clean.push, ignoreSeg.has, s.toLowerCase |
| [`parseConnector`](../../../../src-ts/runtime-executables/main.ts#L16717) | id | Number, String, deriveStationKey, low.match, parts.slice, seg.toLowerCase, sid.split |
| [`scoreState`](../../../../src-ts/runtime-executables/main.ts#L16805) | it, kind | String, id.toLowerCase, idLower.endsWith, idLower.includes, role.includes |
| [`pickBestId`](../../../../src-ts/runtime-executables/main.ts#L16895) | states, kind | String, scoreState |
| [`requireCustomerTariff`](../../../../src-ts/runtime-executables/main.ts#L17023) | req, res, next | next, res.status, this._nwIsFeatureLicensed |
| [`customerTariffSnapshot`](../../../../src-ts/runtime-executables/main.ts#L17028) | – | customerTariffView, tariffProviderRegistry.publicRegistry, this._nwInstallerConfigRevision, this.nwApplyInstallerPatchToRuntimeConfig |
| [`normName`](../../../../src-ts/runtime-executables/main.ts#L17155) | value | Object.values, first.trim, value.trim |
| [`parseManifest`](../../../../src-ts/runtime-executables/main.ts#L17163) | baseId | JSON.parse, raw.trim |
| [`fallbackDeviceClass`](../../../../src-ts/runtime-executables/main.ts#L17172) | category | String |
| [`readAlias`](../../../../src-ts/runtime-executables/main.ts#L17238) | keys | keys.map |
| [`writeAlias`](../../../../src-ts/runtime-executables/main.ts#L17239) | keys | – |
| [`addId`](../../../../src-ts/runtime-executables/main.ts#L17477) | id | String |
| [`getOwn`](../../../../src-ts/runtime-executables/main.ts#L17538) | id | this.getStateAsync |
| [`mkCheck`](../../../../src-ts/runtime-executables/main.ts#L17639) | id | – |
| [`toSafeIdPart`](../../../../src-ts/runtime-executables/main.ts#L17664) | x | String |
| [`readNum`](../../../../src-ts/runtime-executables/main.ts#L17701) | id | Number, Number.isFinite, this.getStateAsync |
| [`readBool`](../../../../src-ts/runtime-executables/main.ts#L17716) | id | this.getStateAsync |
| [`readStr`](../../../../src-ts/runtime-executables/main.ts#L17730) | id | String, this.getStateAsync |
| [`makeNode`](../../../../src-ts/runtime-executables/main.ts#L18085) | – | Object.create |
| [`resolveRoomName`](../../../../src-ts/runtime-executables/main.ts#L18206) | roomId | rooms.find |
| [`resolveFunctionName`](../../../../src-ts/runtime-executables/main.ts#L18217) | fnId | funcs.find |
| [`addSceneBlock`](../../../../src-ts/runtime-executables/main.ts#L18263) | dpId, id, alias | blocks.push |
| [`queryNumber`](../../../../src-ts/runtime-executables/main.ts#L18417) | name, fallback | Number, value.trim |
| [`historyRequest`](../../../../src-ts/runtime-executables/main.ts#L18476) | dispatch, normalize | – |
| [`failure`](../../../../src-ts/runtime-executables/main.ts#L18477) | code | Object.assign |
| [`finish`](../../../../src-ts/runtime-executables/main.ts#L18483) | error, value | clearTimeout, reject, requestCancels.delete, resolve, this._nwPendingHistoryRequests?.delete |
| [`cancel`](../../../../src-ts/runtime-executables/main.ts#L18492) | – | failure, finish |
| [`reply`](../../../../src-ts/runtime-executables/main.ts#L18498) | value | cancel, failure, finish, normalize, performance.now |
| [`densifyHoldLast`](../../../../src-ts/runtime-executables/main.ts#L18532) | values, rangeStart, rangeEnd, rangeStepMs | Array.isArray, Math.floor, Math.max, Math.round, Number, Number.isFinite, byIdx.get, byIdx.has, byIdx.set, normTsMs, out.push |
| [`normTsMs`](../../../../src-ts/runtime-executables/main.ts#L18634) | ts | Date.parse, Math.round, Number, Number.isFinite, Number.isNaN, ts.getTime, ts.trim |
| [`ask`](../../../../src-ts/runtime-executables/main.ts#L18669) | id, query | Math.max, Number, Number.isFinite, Promise.resolve, String, historyRequest, requestSeriesCache.get, requestSeriesCache.has, requestSeriesCache.set, this._nwTrimId |
| [`askCandidates`](../../../../src-ts/runtime-executables/main.ts#L18696) | candidates, query | Array.isArray, ask, this._nwTrimId |
| [`_normalizeHistoryPairs`](../../../../src-ts/runtime-executables/main.ts#L18740) | values | Array.isArray, Number, Number.isFinite, normTsMs, out.push, out.sort |
| [`_valueAtHold`](../../../../src-ts/runtime-executables/main.ts#L18759) | pairs, ts | Array.isArray, Math.floor |
| [`_buildNormalizedPricingSeries`](../../../../src-ts/runtime-executables/main.ts#L18780) | { startTs, endTs, grossSeries, baseSeries, totalSeries, netFeeSeries, manualGrossPrice, dynamicTariffActive } | Array.from, Math.max, Number.isFinite, _normalizeHistoryPairs, _valueAtHold, baseOut.push, totalOut.push |
| [`evcsHasData`](../../../../src-ts/runtime-executables/main.ts#L18855) | s | Array.isArray |
| [`readCounterPoint`](../../../../src-ts/runtime-executables/main.ts#L18925) | id, newest | Promise.resolve, historyRequest |
| [`readCurrentCounterPoint`](../../../../src-ts/runtime-executables/main.ts#L18945) | id | historyRequest |
| [`counterDelta`](../../../../src-ts/runtime-executables/main.ts#L18959) | id | Date.now, Math.abs, Number, Number.isFinite, readCounterPoint, readCurrentCounterPoint |
| [`integrateSeriesKwh`](../../../../src-ts/runtime-executables/main.ts#L19017) | series, defaultEndMs, stepMsForSeries, positiveOnly | Array.isArray, Date.now, Math.abs, Math.max, Math.min, Number, Number.isFinite |
| [`clipSeriesForIntegration`](../../../../src-ts/runtime-executables/main.ts#L19049) | series, clipEndMs | Array.isArray, Number, Number.isFinite, out.push |
| [`buildEnergyExact`](../../../../src-ts/runtime-executables/main.ts#L19076) | – | Array.from, Array.isArray, Math.max, Math.min, Number, Number.isFinite, Promise.all, balanceComponents.every, clipSeriesForIntegration, ids.map, integrateSeriesKwh, requestSeriesCache.delete, sumByTs.entries, sumByTs.get (weitere in der Quelle) |
| [`parseTs`](../../../../src-ts/runtime-executables/main.ts#L19172) | raw, { endOfDay = false } | Date.parse, Number, Number.isFinite, Number.isNaN, String, dt.getTime, dt.setHours, s.split |
| [`alignDown`](../../../../src-ts/runtime-executables/main.ts#L19197) | ts | Math.floor, Number |
| [`alignUp`](../../../../src-ts/runtime-executables/main.ts#L19204) | ts | Math.ceil, Number |
| [`densifyHoldLast`](../../../../src-ts/runtime-executables/main.ts#L19223) | series | Array.isArray, Math.ceil, Math.max, Math.round, Number, Number.isFinite, byIdx.get, byIdx.has, byIdx.set, out.push, this._nwNormTsMs |
| [`seriesFor`](../../../../src-ts/runtime-executables/main.ts#L19265) | name | Math.max, densifyHoldLast, this._nwGetHistoryAvgSeriesAny, this._nwGetHistoryDpCandidates |
| [`seriesForIds`](../../../../src-ts/runtime-executables/main.ts#L19272) | ids | Math.max, densifyHoldLast, this._nwGetHistoryAvgSeriesAny |
| [`parseTs`](../../../../src-ts/runtime-executables/main.ts#L19375) | raw, { endOfDay = false } | Date.parse, Number, Number.isFinite, Number.isNaN, String, dt.getTime, dt.setHours, s.split |
| [`getRawHistory`](../../../../src-ts/runtime-executables/main.ts#L19407) | id | – |
| [`nwBuildEvcsReport`](../../../../src-ts/runtime-executables/main.ts#L19536) | query | Array.isArray, Date.now, Math.abs, Math.max, Math.min, Math.round, Number, Number.isFinite, Object.keys, buckets.forEach, buckets.map, buckets.push, chooseStepMs, d.getDate (weitere in der Quelle) |
| [`parseTs`](../../../../src-ts/runtime-executables/main.ts#L19546) | raw, { endOfDay = false } | Date.parse, Number, Number.isFinite, Number.isNaN, String, dt.getTime, dt.setHours, s.split |
| [`dayKeyOf`](../../../../src-ts/runtime-executables/main.ts#L19596) | ts | String, d.getDate, d.getFullYear, d.getMonth |
| [`calcCount`](../../../../src-ts/runtime-executables/main.ts#L19620) | startMs, endMs, stepMs | Math.ceil, Math.max, Math.min, Number, Number.isFinite |
| [`chooseStepMs`](../../../../src-ts/runtime-executables/main.ts#L19635) | spanMs, baseStepMs | Math.ceil, Math.max, Number |
| [`normTsMs`](../../../../src-ts/runtime-executables/main.ts#L19651) | ts | Number, Number.isFinite, parseTs |
| [`getHist`](../../../../src-ts/runtime-executables/main.ts#L19665) | id, startMs, endMs, aggregate, step | – |
| [`nwWbLabel`](../../../../src-ts/runtime-executables/main.ts#L19886) | wb | String |
| [`nwCsvEscape`](../../../../src-ts/runtime-executables/main.ts#L19897) | v | String, s.replace |
| [`nwFormatDe`](../../../../src-ts/runtime-executables/main.ts#L19913) | num, digits | Number, Number.isFinite, n.toFixed |
| [`nwEvcsReportToCsv`](../../../../src-ts/runtime-executables/main.ts#L19931) | report | Array.isArray, Math.max, Number, Number.isFinite, String, header.map, header.push, lines.join, lines.push, nwFormatDe, nwWbLabel, row.map, row.push, totalRow.map (weitere in der Quelle) |
| [`nwPad2`](../../../../src-ts/runtime-executables/main.ts#L20016) | n | Number, String |
| [`nwDayKey`](../../../../src-ts/runtime-executables/main.ts#L20023) | tsMs | Number, d.getDate, d.getFullYear, d.getMonth, nwPad2 |
| [`nwTimeHhMm`](../../../../src-ts/runtime-executables/main.ts#L20033) | tsMs | Number, d.getHours, d.getMinutes, nwPad2 |
| [`nwParseTsLoose`](../../../../src-ts/runtime-executables/main.ts#L20043) | raw, { endOfDay = false } | Date.parse, Number, Number.isFinite, Number.isNaN, String, dt.getTime, dt.setHours, s.split |
| [`nwEvcsSessionsToCsv`](../../../../src-ts/runtime-executables/main.ts#L20077) | sessions | Math.round, Number, Number.isFinite, String, header.map, lines.join, lines.push, nwDayKey, nwFormatDe, nwTimeHhMm, row.map |
| [`nwNormalizeRfid`](../../../../src-ts/runtime-executables/main.ts#L20211) | ctx, raw | String, ctx.normalizeRfidCode, s.trim |
| [`nwLoadEvcsSessions`](../../../../src-ts/runtime-executables/main.ts#L20227) | ctx | Array.isArray, JSON.parse, ctx._evcsSessionsBuf.slice, ctx.getStateAsync, st.val.trim |
| [`nwGetRfidNameFromWhitelist`](../../../../src-ts/runtime-executables/main.ts#L20250) | ctx, rfidNorm | Array.isArray, JSON.parse, String, ctx.getStateAsync, nwNormalizeRfid, st.val.trim |
| [`nwStartOfLocalDay`](../../../../src-ts/runtime-executables/main.ts#L20279) | ms | Number, d.getTime, d.setHours |
| [`nwEndOfLocalDay`](../../../../src-ts/runtime-executables/main.ts#L20290) | ms | Number, d.getTime, d.setHours |
| [`nwBuildRfidDailyReport`](../../../../src-ts/runtime-executables/main.ts#L20301) | ctx, query | Array.isArray, Date.now, Math.max, Math.round, Number, Number.isFinite, d.getDate, d.getTime, d.setDate, days.push, nwDayKey, nwEndOfLocalDay, nwGetRfidNameFromWhitelist, nwLoadEvcsSessions (weitere in der Quelle) |
| [`nwRfidReportToCsv`](../../../../src-ts/runtime-executables/main.ts#L20395) | report | Array.isArray, Math.max, Math.round, Number, Number.isFinite, String, header.map, lines.join, lines.push, nwFormatDe, row.map, totalRow.map |
| [`_nwDisplaySafeId`](../../../../src-ts/runtime-executables/main.ts#L20469) | input | String |
| [`_nwDisplayNormalizeLpKey`](../../../../src-ts/runtime-executables/main.ts#L20470) | input | Math.max, Math.round, Number, String, _nwDisplaySafeId, s.match |
| [`_nwDisplayNormalizeModes`](../../../../src-ts/runtime-executables/main.ts#L20476) | raw | Array.isArray, String, out.includes, out.push |
| [`_nwDisplayClamp`](../../../../src-ts/runtime-executables/main.ts#L20489) | value, min, max, fallback | Math.max, Math.min, Number, Number.isFinite |
| [`_nwDisplayLayoutMode`](../../../../src-ts/runtime-executables/main.ts#L20494) | raw, connectorCount | Math.max, Math.round, Number, String |
| [`_nwActiveEvcsControlRows`](../../../../src-ts/runtime-executables/main.ts#L20502) | – | Array.isArray |
| [`_nwDisplayGlobalStorageAssistControlEnabled`](../../../../src-ts/runtime-executables/main.ts#L20511) | – | _nwActiveEvcsControlRows |
| [`_nwDisplayStationConfig`](../../../../src-ts/runtime-executables/main.ts#L20517) | – | Array.isArray, Math.max, Math.round, Number, String, _nwDisplayNormalizeLpKey, ports.sort, portsByStation.get, portsByStation.has, portsByStation.set, portsByStation.values, rows.map |
| [`_nwDisplayFindStation`](../../../../src-ts/runtime-executables/main.ts#L20592) | token | String, _nwDisplayStationConfig |
| [`_nwDisplayIsLicensed`](../../../../src-ts/runtime-executables/main.ts#L20597) | – | this._nwLicenseAllowsAppId |
| [`_nwDisplayStateVal`](../../../../src-ts/runtime-executables/main.ts#L20600) | id, fallback | Object.prototype.hasOwnProperty.call |
| [`_nwDisplayStationStateVal`](../../../../src-ts/runtime-executables/main.ts#L20607) | stationId, suffix, fallback | Object.prototype.hasOwnProperty.call, _nwDisplaySafeId |
| [`_nwDisplayNum`](../../../../src-ts/runtime-executables/main.ts#L20615) | v, fallback | Number, Number.isFinite |
| [`_nwDisplayFindWallbox`](../../../../src-ts/runtime-executables/main.ts#L20619) | lpKey | Array.isArray, Math.max, Math.round, Number, String, _nwDisplayNormalizeLpKey, list.find |
| [`_nwDisplayBool`](../../../../src-ts/runtime-executables/main.ts#L20629) | v, fallback | String |
| [`_nwDisplayRound`](../../../../src-ts/runtime-executables/main.ts#L20637) | value, digits | Math.max, Math.min, Math.pow, Math.round, Number, Number.isFinite |
| [`_nwDisplayParseJson`](../../../../src-ts/runtime-executables/main.ts#L20643) | raw, fallback | JSON.parse, String |
| [`_nwDisplayNormalizeControlProfile`](../../../../src-ts/runtime-executables/main.ts#L20653) | raw | String |
| [`_nwDisplayResolveCommandStateId`](../../../../src-ts/runtime-executables/main.ts#L20663) | station, lp | String |
| [`_nwDisplayReadStationRuntime`](../../../../src-ts/runtime-executables/main.ts#L20672) | station, now | Array.isArray, Date.now, Math.max, Math.round, _nwDisplayClamp, _nwDisplayNum, _nwDisplayStationStateVal |
| [`_nwDisplayActiveSession`](../../../../src-ts/runtime-executables/main.ts#L20699) | idx | Date.now, Math.max, Math.round, Number, Number.isFinite, String |
| [`_nwDisplaySessionId`](../../../../src-ts/runtime-executables/main.ts#L20729) | stationId, lpKey, session | Number, String, _nwDisplayNormalizeLpKey, _nwDisplaySafeId |
| [`_nwDisplayLastCompletedSession`](../../../../src-ts/runtime-executables/main.ts#L20735) | idx | Array.isArray, Math.max, Math.round, Number, String |
| [`_nwDisplayNormalizeSessionRecord`](../../../../src-ts/runtime-executables/main.ts#L20766) | station, lpKey, row, fallbackPrice | Math.max, Math.min, Math.round, Number, Number.isFinite, String, _nwDisplayNormalizeLpKey, _nwDisplayNum, _nwDisplayRound |
| [`_nwDisplayNewestSession`](../../../../src-ts/runtime-executables/main.ts#L20805) | buffered, persisted | Number |
| [`_nwDisplaySessionCostBreakdown`](../../../../src-ts/runtime-executables/main.ts#L20818) | energyKwh, solarSharePct, solarPrice, gridPrice, fallbackPrice, showSolarShare | Math.max, Math.min, Math.round, Number, _nwDisplayNum, _nwDisplayRound |
| [`_nwDisplayStartOfLocalDay`](../../../../src-ts/runtime-executables/main.ts#L20835) | ms | Date.now, Number, d.getTime, d.setHours |
| [`_nwDisplayLocalDayKey`](../../../../src-ts/runtime-executables/main.ts#L20841) | ms | Date.now, Number, String, d.getDate, d.getFullYear, d.getMonth |
| [`_nwDisplayReadStationJsonState`](../../../../src-ts/runtime-executables/main.ts#L20849) | stationId, suffix, fallback | JSON.parse, _nwDisplayStationStateVal |
| [`_nwDisplayCsvEscape`](../../../../src-ts/runtime-executables/main.ts#L20860) | value | String, s.replace |
| [`_nwDisplayStationOperatorCsv`](../../../../src-ts/runtime-executables/main.ts#L20865) | payload | Array.isArray, Date.now, Math.round, Number, String, _nwDisplayNormalizeSessionRecord, lines.join, lines.push |
| [`_nwDisplayBuildOperatorSummary`](../../../../src-ts/runtime-executables/main.ts#L20927) | station, connectors, now | Array.isArray, Date.now, Math.max, Math.round, Number, Object.entries, Object.fromEntries, Object.keys, String, _nwDisplayLocalDayKey, _nwDisplayNormalizeLpKey, _nwDisplayNormalizeSessionRecord, _nwDisplayNum, _nwDisplayReadStationJsonState (weitere in der Quelle) |
| [`_nwDisplayWriteStationState`](../../../../src-ts/runtime-executables/main.ts#L21031) | stationId, suffix, value, ack | Date.now, _nwDisplaySafeId, this.setStateAsync, this.updateValue |
| [`_nwDisplayBuildPayload`](../../../../src-ts/runtime-executables/main.ts#L21038) | station | Array.isArray, Date.now, Math.max, Math.round, Number, Number.isFinite, String, _nwDisplayBool, _nwDisplayBuildOperatorSummary, _nwDisplayClamp, _nwDisplayGlobalStorageAssistControlEnabled, _nwDisplayLayoutMode, _nwDisplayNormalizeControlProfile, _nwDisplayNormalizeLpKey (weitere in der Quelle) |
| [`_nwDisplaySetWallboxControl`](../../../../src-ts/runtime-executables/main.ts#L21357) | lpKey, prop, value | Date.now, String, _nwDisplayNormalizeLpKey, this.setStateAsync, this.updateValue |
| [`_nwDisplaySetWallboxMode`](../../../../src-ts/runtime-executables/main.ts#L21371) | lpKey, mode, enabled | Date.now, Math.max, Math.round, Number, String, _nwDisplayNormalizeLpKey, this.setStateAsync, this.updateValue |
| [`_nwDisplayBuildCommandIntent`](../../../../src-ts/runtime-executables/main.ts#L21392) | station, lpKey, action, mode, userMode | Date.now, String, _nwDisplayNormalizeLpKey |
| [`_nwDisplayWriteCommandState`](../../../../src-ts/runtime-executables/main.ts#L21407) | station, lpKey, intent | Date.now, JSON.stringify, _nwDisplayBool, _nwDisplayResolveCommandStateId, isActuatorAuthorityBlockedResult, this.setForeignStateAsync, this.setStateAsync, this.updateValue |
| [`_nwDisplayPersistSessionOperatorStates`](../../../../src-ts/runtime-executables/main.ts#L21429) | station, payload | Date.now, JSON.stringify, Number, Object.keys, String, _nwDisplayLocalDayKey, _nwDisplayReadStationJsonState, _nwDisplayStationStateVal, _nwDisplayWriteStationState, connectors.filter, connectors.slice, encodeURIComponent |
| [`_nwDisplayExecuteStationCommand`](../../../../src-ts/runtime-executables/main.ts#L21518) | station, lpKey, action, mode, extra | JSON.stringify, Object.prototype.hasOwnProperty.call, String, _nwDisplayBool, _nwDisplayBuildCommandIntent, _nwDisplayClamp, _nwDisplayFindWallbox, _nwDisplayGlobalStorageAssistControlEnabled, _nwDisplayNormalizeControlProfile, _nwDisplayNormalizeLpKey, _nwDisplayResolveCommandStateId, _nwDisplaySetWallboxControl, _nwDisplaySetWallboxMode, _nwDisplayStateVal (weitere in der Quelle) |
| [`_nwEnergyLedgerIsLicensed`](../../../../src-ts/runtime-executables/main.ts#L21683) | – | this._nwLicenseAllowsAppId |
| [`_nwEnergyOriginAppEnabled`](../../../../src-ts/runtime-executables/main.ts#L21691) | – | _nwEnergyLedgerIsLicensed |
| [`_nwEnergyLedgerJson`](../../../../src-ts/runtime-executables/main.ts#L21707) | id, fallback | JSON.parse, String, _nwDisplayStateVal |
| [`_nwEnergyLedgerPeriod`](../../../../src-ts/runtime-executables/main.ts#L21718) | input | String |
| [`_nwEnergyLedgerFilterEntries`](../../../../src-ts/runtime-executables/main.ts#L21722) | entries, period, summary | Array.isArray, _nwEnergyLedgerPeriod, list.filter, list.slice |
| [`_nwEnergyLedgerSourceLabel`](../../../../src-ts/runtime-executables/main.ts#L21734) | entry | Array.isArray, String, labels.join, parts.filter |
| [`_nwEnergyLedgerBuildPayload`](../../../../src-ts/runtime-executables/main.ts#L21746) | period | Array.isArray, Date.now, _nwEnergyLedgerFilterEntries, _nwEnergyLedgerJson, _nwEnergyLedgerPeriod |
| [`_nwEnergyLedgerCsv`](../../../../src-ts/runtime-executables/main.ts#L21775) | payload | Array.isArray, Date.now, Math.round, Number, String, _nwEnergyLedgerSourceLabel, rows.join, rows.push |
| [`_nwNetOperatorLicensed`](../../../../src-ts/runtime-executables/main.ts#L21849) | – | this._nwLicenseAllowsAppId |
| [`_nwNetOperatorEnabled`](../../../../src-ts/runtime-executables/main.ts#L21852) | – | _nwNetOperatorLicensed |
| [`_nwNetOperatorActivation`](../../../../src-ts/runtime-executables/main.ts#L21859) | – | String, _nwNetOperatorLicensed |
| [`_nwMeshMicrogridIsLicensed`](../../../../src-ts/runtime-executables/main.ts#L21977) | – | this._nwLicenseAllowsAppId |
| [`_nwMeshMicrogridCfg`](../../../../src-ts/runtime-executables/main.ts#L21981) | – | – |
| [`_nwMeshSafeId`](../../../../src-ts/runtime-executables/main.ts#L21985) | value, fallback | String |
| [`_nwMeshReceiverCfg`](../../../../src-ts/runtime-executables/main.ts#L21986) | – | Array.isArray, Math.max, Math.min, Math.round, Number, String, _nwMeshMicrogridCfg, allowedPeerText.split, r.allowedPeerNodeIds.join |
| [`_nwMeshTailscaleCfg`](../../../../src-ts/runtime-executables/main.ts#L22002) | – | Array.isArray, Math.max, Math.min, Math.round, Number, String, _nwMeshMicrogridCfg, _nwMeshSafeId, peerUrlText.split, t.peerUrls.join |
| [`_nwMeshPeerTokenFromReq`](../../../../src-ts/runtime-executables/main.ts#L22016) | req | String |
| [`_nwMeshPeerTokenOk`](../../../../src-ts/runtime-executables/main.ts#L22017) | req | Buffer.from, String, _nwMeshPeerTokenFromReq, _nwMeshReceiverCfg, crypto.timingSafeEqual |
| [`_nwMeshWriteState`](../../../../src-ts/runtime-executables/main.ts#L22029) | id, value, ack | this.setStateAsync |
| [`_nwMeshStateJson`](../../../../src-ts/runtime-executables/main.ts#L22032) | id, fallback | _nwEnergyLedgerJson |
| [`_nwMeshNow`](../../../../src-ts/runtime-executables/main.ts#L22033) | – | Date.now |
| [`_nwMeshCommandIds`](../../../../src-ts/runtime-executables/main.ts#L22034) | body | Array.isArray, list.map |
| [`_nwMeshPeerErrorClass`](../../../../src-ts/runtime-executables/main.ts#L22046) | peer | Array.isArray, p.errors.map, text.includes |
| [`_nwMeshRoundtripStatus`](../../../../src-ts/runtime-executables/main.ts#L22062) | ms | Number, Number.isFinite |
| [`_nwMeshRemoteNodeMatrix`](../../../../src-ts/runtime-executables/main.ts#L22069) | peers | Array.isArray, Number, _nwMeshPeerErrorClass, _nwMeshRoundtripStatus, rows.push |
| [`_nwMeshBuildHandshakePayload`](../../../../src-ts/runtime-executables/main.ts#L22096) | – | Date.now, _nwMeshMicrogridBuildPayload, _nwMeshMicrogridCfg, _nwMeshReceiverCfg, _nwMeshSafeId |
| [`_nwMeshMicrogridBuildPayload`](../../../../src-ts/runtime-executables/main.ts#L22125) | – | Array.isArray, Date.now, Number, String, _nwDisplayStateVal, _nwEnergyLedgerJson |
| [`_nwMeshMicrogridCsv`](../../../../src-ts/runtime-executables/main.ts#L22273) | payload | Array.isArray, Date.now, JSON.stringify, Math.round, Number, String, rows.join, rows.push |
| [`_nwMeshClassifyPeerError`](../../../../src-ts/runtime-executables/main.ts#L22452) | parts | Array.isArray, text.includes, text.trim |
| [`_nwMeshRoundtripLevel`](../../../../src-ts/runtime-executables/main.ts#L22463) | ms, ok | Number, Number.isFinite |
| [`reject`](../../../../src-ts/runtime-executables/main.ts#L22481) | status, error, message, extra | JSON.stringify, Number, _nwDisplayStateVal, _nwMeshSafeId, _nwMeshWriteState, res.status |
| [`boolOr`](../../../../src-ts/runtime-executables/main.ts#L22899) | val, def | – |
| [`parseJsonArraySafe`](../../../../src-ts/runtime-executables/main.ts#L22926) | raw | Array.isArray, JSON.parse, String |
| [`storageFarmRowHasRealDatapoint`](../../../../src-ts/runtime-executables/main.ts#L22941) | row | this._nwStorageFarmRowHasRealDatapoint |
| [`inferChargingEnabled`](../../../../src-ts/runtime-executables/main.ts#L23107) | – | – |
| [`getArr`](../../../../src-ts/runtime-executables/main.ts#L23176) | k | Array.isArray |
| [`defName`](../../../../src-ts/runtime-executables/main.ts#L23183) | kind, idx | – |
| [`pickName`](../../../../src-ts/runtime-executables/main.ts#L23193) | arr, idx, kind | String, defName |
| [`pickIcon`](../../../../src-ts/runtime-executables/main.ts#L23204) | arr, idx | String |
| [`pickQuick`](../../../../src-ts/runtime-executables/main.ts#L23215) | arr, idx, kind | Array.isArray, Math.max, Math.round, Number, String, hlist.find, normalizeConsumerType, numOrNull, tlist.find |
| [`resolveHeatingRodDev`](../../../../src-ts/runtime-executables/main.ts#L23230) | – | Array.isArray, Math.round, Number, hlist.find |
| [`normalizeConsumerType`](../../../../src-ts/runtime-executables/main.ts#L23264) | raw | String |
| [`numOrNull`](../../../../src-ts/runtime-executables/main.ts#L23282) | v | Number, Number.isFinite |
| [`buildSlots`](../../../../src-ts/runtime-executables/main.ts#L23373) | kind | String, getArr, out.push, pickIcon, pickName, pickQuick, this._nwGetFlowSlotInfo |
| [`nwPsAtCsvEscape`](../../../../src-ts/runtime-executables/main.ts#L23668) | v | String, s.replace |
| [`nwPsAtFmtNum`](../../../../src-ts/runtime-executables/main.ts#L23678) | v, digits | Math.max, Math.min, Math.round, Number, Number.isFinite, n.toFixed |
| [`nwPsAtPad2`](../../../../src-ts/runtime-executables/main.ts#L23690) | n | Number, String |
| [`nwPsAtIsoLocal`](../../../../src-ts/runtime-executables/main.ts#L23697) | ts | Date.now, Number, d.getDate, d.getFullYear, d.getHours, d.getMinutes, d.getMonth, d.getSeconds, nwPsAtPad2 |
| [`nwPsAtYmd`](../../../../src-ts/runtime-executables/main.ts#L23707) | ts | Date.now, Number, d.getDate, d.getFullYear, d.getMonth, nwPsAtPad2 |
| [`nwPsAtParseTs`](../../../../src-ts/runtime-executables/main.ts#L23717) | raw, { endOfDay = false } | Date.parse, Number, Number.isFinite, Number.isNaN, String, dt.getTime, dt.setHours, s.split |
| [`nwPsAtStateVal`](../../../../src-ts/runtime-executables/main.ts#L23742) | localId, fallback | this.getStateAsync |
| [`nwPsAtStateNum`](../../../../src-ts/runtime-executables/main.ts#L23759) | localId, fallback | Number, Number.isFinite, nwPsAtStateVal |
| [`nwPsAtStateBool`](../../../../src-ts/runtime-executables/main.ts#L23770) | localId, fallback | String, nwPsAtStateVal |
| [`nwPsAtStateStr`](../../../../src-ts/runtime-executables/main.ts#L23785) | localId, fallback | String, nwPsAtStateVal |
| [`nwPsAtSafeFile`](../../../../src-ts/runtime-executables/main.ts#L23796) | s | String |
| [`nwPsAtBuildReport`](../../../../src-ts/runtime-executables/main.ts#L23807) | query | Array.from, Array.isArray, Date.now, Math.max, Math.min, Math.round, Number, Number.isFinite, Promise.all, nwPsAtParseTs, nwPsAtStateBool, nwPsAtStateNum, nwPsAtStateStr, seriesDefs.map (weitere in der Quelle) |
| [`nwPsAtReportToCsv`](../../../../src-ts/runtime-executables/main.ts#L23961) | report | Number, header.map, lines.join, lines.push, nwPsAtFmtNum, nwPsAtIsoLocal, pushMeta |
| [`pushMeta`](../../../../src-ts/runtime-executables/main.ts#L23969) | k, v | String, lines.push |
| [`nwPsAtPdfAscii`](../../../../src-ts/runtime-executables/main.ts#L24028) | value | String |
| [`nwPsAtPdfEscape`](../../../../src-ts/runtime-executables/main.ts#L24040) | value | nwPsAtPdfAscii |
| [`nwPsAtWrap`](../../../../src-ts/runtime-executables/main.ts#L24047) | line, max | nwPsAtPdfAscii, out.push, s.split |
| [`nwPsAtBuildPdf`](../../../../src-ts/runtime-executables/main.ts#L24070) | title, lines | Buffer.byteLength, Buffer.from, Math.max, Object.keys, String, addObj, chunks.forEach, chunks.push, nwPsAtWrap, pageIds.map, wrapped.push, wrapped.slice |
| [`addObj`](../../../../src-ts/runtime-executables/main.ts#L24097) | id, body | – |
| [`nwPsAtReportToPdf`](../../../../src-ts/runtime-executables/main.ts#L24141) | report | Array.isArray, cfg.highLoadWindows.slice, lines.push, nwPsAtBuildPdf, nwPsAtFmtNum, nwPsAtIsoLocal, windows.forEach |
| [`valueOf`](../../../../src-ts/runtime-executables/main.ts#L24242) | key, fallback | Object.prototype.hasOwnProperty.call |
| [`writeRelayValue`](../../../../src-ts/runtime-executables/main.ts#L24972) | rawValue, valueKind | withActuatorShadowContext |
| [`normalizeConsumerType`](../../../../src-ts/runtime-executables/main.ts#L25156) | raw | String |
| [`resolveThermalDev`](../../../../src-ts/runtime-executables/main.ts#L25171) | – | Array.isArray, Math.round, Number, tlist.find |
| [`resolveHeatingRodDev`](../../../../src-ts/runtime-executables/main.ts#L25188) | – | Array.isArray, Math.round, Number, hlist.find |
| [`syncHeatingRodUserState`](../../../../src-ts/runtime-executables/main.ts#L25205) | localId, val | Date.now, emsDp.handleStateChange, this.updateValue |
| [`normalizeHeatingRodQuickMode`](../../../../src-ts/runtime-executables/main.ts#L25221) | raw | String |
| [`getHeatingRodStoredUserMode`](../../../../src-ts/runtime-executables/main.ts#L25237) | – | normalizeHeatingRodQuickMode, this.getStateAsync |
| [`heatingRodManualStageForMode`](../../../../src-ts/runtime-executables/main.ts#L25251) | dev, rawMode | Array.isArray, Math.ceil, Math.max, Math.min, Math.round, Number, normalizeHeatingRodQuickMode |
| [`writeHeatingRodStagesOnce`](../../../../src-ts/runtime-executables/main.ts#L25268) | dev, rawTargetStage | Array.isArray, Date.now, Math.max, Math.min, Math.round, Number, String, addWrite, blocked.push, emsDp.handleStateChange, emsDp.lastWriteByObjectId.set, grouped.entries, isActuatorAuthorityBlockedResult, this.setForeignStateAsync (weitere in der Quelle) |
| [`addWrite`](../../../../src-ts/runtime-executables/main.ts#L25283) | stageIndex, rawId, physicalOn | String, emsDp.getEntry, grouped.get, grouped.set |
| [`clearBoost`](../../../../src-ts/runtime-executables/main.ts#L25402) | – | this.setStateAsync |
| [`clearOverrides`](../../../../src-ts/runtime-executables/main.ts#L25484) | – | this.setStateAsync |
| [`finiteLimit`](../../../../src-ts/runtime-executables/main.ts#L25554) | raw | Number, Number.isFinite |
| [`normalizeConsumerType`](../../../../src-ts/runtime-executables/main.ts#L25722) | raw | String |
| [`resolveThermalDev`](../../../../src-ts/runtime-executables/main.ts#L25737) | – | Array.isArray, Math.round, Number, tlist.find |
| [`resolveHeatingRodDev`](../../../../src-ts/runtime-executables/main.ts#L25757) | – | Array.isArray, Math.round, Number, hlist.find |
| [`normalizeHeatingRodAutoModeLocal`](../../../../src-ts/runtime-executables/main.ts#L25820) | raw | String |
| [`normMode`](../../../../src-ts/runtime-executables/main.ts#L25850) | m | String |
| [`readNumState`](../../../../src-ts/runtime-executables/main.ts#L25868) | id, fallback | Number, Number.isFinite, this.getStateAsync |
| [`normMode`](../../../../src-ts/runtime-executables/main.ts#L26016) | m | String |
| [`authorize`](../../../../src-ts/runtime-executables/main.ts#L26355) | – | hasCapability, resolveStrictAccess |
| [`NexoWattVis._nwNormalizeFlowSlotKind`](../../../../src-ts/runtime-executables/main.ts#L26392) | kind | String, k.startsWith |
| [`NexoWattVis._nwFlowSlotCount`](../../../../src-ts/runtime-executables/main.ts#L26402) | kind | this._nwNormalizeFlowSlotKind |
| [`NexoWattVis._nwFlowSlotKey`](../../../../src-ts/runtime-executables/main.ts#L26411) | kind, index | Math.max, Math.round, Number, this._nwNormalizeFlowSlotKind |
| [`NexoWattVis._nwGetFlowSlotsRoot`](../../../../src-ts/runtime-executables/main.ts#L26422) | – | – |
| [`NexoWattVis._nwFlowSlotPowerIdFromSlot`](../../../../src-ts/runtime-executables/main.ts#L26437) | slot | String |
| [`NexoWattVis._nwGetFlowSlotInfo`](../../../../src-ts/runtime-executables/main.ts#L26467) | kind, index | Array.isArray, Math.max, Math.min, Math.round, Number, String, this._nwFlowSlotCount, this._nwFlowSlotKey, this._nwFlowSlotPowerIdFromSlot, this._nwGetFlowSlotsRoot, this._nwNormalizeFlowSlotKind |
| [`NexoWattVis.prepareFlowSlots`](../../../../src-ts/runtime-executables/main.ts#L26510) | flowSlotsCfg | Array.isArray, Object.keys, String, add, this._nwFlowSlotKey, this._nwFlowSlotPowerIdFromSlot, this._nwGetFlowSlotInfo |
| [`add`](../../../../src-ts/runtime-executables/main.ts#L26521) | objectId, stateKey | String, id.startsWith, out.push, seen.add, seen.has |
| [`NexoWattVis._nwNormalizeUnit`](../../../../src-ts/runtime-executables/main.ts#L26568) | unit | String |
| [`NexoWattVis._nwPowerScaleToWFromUnit`](../../../../src-ts/runtime-executables/main.ts#L26577) | unit | this._nwNormalizeUnit |
| [`NexoWattVis._nwIsMappedPowerKey`](../../../../src-ts/runtime-executables/main.ts#L26591) | key | key.endsWith, key.startsWith |
| [`NexoWattVis._nwScaleMappedValue`](../../../../src-ts/runtime-executables/main.ts#L26622) | key, objectId, val | Array.isArray, Math.max, Math.round, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String, normalizeEvcsEnergyTotalKwh, this._nwForeignPowerScaleCache.get, this._nwIsMappedPowerKey, this.evcsList.find |
| [`NexoWattVis._nwPrimeForeignPowerScale`](../../../../src-ts/runtime-executables/main.ts#L26670) | objectId | this._nwForeignPowerScaleCache.delete, this._nwForeignPowerScaleCache.keys, this._nwForeignPowerScaleCache.set, this._nwForeignUnitCache.delete, this._nwForeignUnitCache.has, this._nwForeignUnitCache.keys, this._nwForeignUnitCache.set, this._nwNormalizeUnit, this._nwPowerScaleToWFromUnit, this.getForeignObjectAsync |
| [`NexoWattVis._nwIsOwnStateId`](../../../../src-ts/runtime-executables/main.ts#L26700) | id | id.trim, sid.startsWith |
| [`NexoWattVis._nwBuildLiveCoreRefreshPlan`](../../../../src-ts/runtime-executables/main.ts#L26711) | – | Array.from, Array.isArray, add, addEvcsBinding, byId.values, configured.values, this._nwEvcsInputSpecsForWallbox, this.prepareFlowSlots |
| [`add`](../../../../src-ts/runtime-executables/main.ts#L26720) | id, key | byId.get, byId.set, entry.keys.add, id.trim, key.trim, this._nwIsOwnStateId |
| [`addEvcsBinding`](../../../../src-ts/runtime-executables/main.ts#L26735) | binding | String, byId.get, byId.set, entry.evcsBindings.set, this._nwIsOwnStateId |
| [`NexoWattVis._nwRefreshLiveCoreDatapoints`](../../../../src-ts/runtime-executables/main.ts#L26826) | reason | Array.isArray, Date.now, Promise.all, plan.slice, slice.map, this._nwBuildLiveCoreRefreshPlan |
| [`applyState`](../../../../src-ts/runtime-executables/main.ts#L26847) | entry | Array.isArray, Number.isFinite, Object.is, emsDp.cacheByObjectId.get, emsDp.handleStateChange, handledEvcsKeys.add, handledEvcsKeys.has, this._nwPublishEvcsInputBinding, this._nwScaleMappedValue, this.getForeignStateAsync, this.updateValue |
| [`NexoWattVis._nwStopLiveCoreRefresh`](../../../../src-ts/runtime-executables/main.ts#L26908) | – | this._nwClearInterval |
| [`NexoWattVis._nwStartLiveCoreRefresh`](../../../../src-ts/runtime-executables/main.ts#L26921) | – | Array.isArray, Math.max, Number, this._nwBuildLiveCoreRefreshPlan, this._nwSetInterval, this._nwStopLiveCoreRefresh |
| [`NexoWattVis.subscribeForecastUiStates`](../../../../src-ts/runtime-executables/main.ts#L26940) | – | Date.now, Number, Object.entries, Object.is, effectiveKeys.map, id.slice, id.startsWith, primedKeys.add, primedKeys.has, providerKeys.map, this.getForeignStatesAsync, this.getStateAsync, this.log.debug, this.subscribeForeignStatesAsync (weitere in der Quelle) |
| [`NexoWattVis.subscribeConfiguredStates`](../../../../src-ts/runtime-executables/main.ts#L27027) | – | Object.keys, id.trim, key.slice, key.startsWith, localUiKeys.includes, settingsLocalKeys.map, slot.objectId.trim, storageFarmLocalKeys.map, this._nwForeignPowerScaleCache.clear, this._nwForeignUnitCache.clear, this._nwPrimeForeignPowerScale, this._nwRefreshLiveCoreDatapoints, this._nwScaleMappedValue, this._nwStartLiveCoreRefresh (weitere in der Quelle) |
| [`NexoWattVis._nwRequestImmediateEmsTick`](../../../../src-ts/runtime-executables/main.ts#L27220) | reason, delayMs | Math.max, Number, Number.isFinite, String, engine.requestImmediateTick |
| [`NexoWattVis.onMessage`](../../../../src-ts/runtime-executables/main.ts#L27241) | obj | this._para14aEebusApi.handleMessage, this.log.warn, this.sendTo |
| [`NexoWattVis._nwGetPara14aEebusIngress`](../../../../src-ts/runtime-executables/main.ts#L27256) | – | this._para14aEebusApi.getIngress |
| [`NexoWattVis._nwFlushPara14aEebusImplementationFeedback`](../../../../src-ts/runtime-executables/main.ts#L27264) | context | this._para14aEebusApi.flushImplementationFeedback |
| [`NexoWattVis.onStateChange`](../../../../src-ts/runtime-executables/main.ts#L27278) | id, state | Date.now, Number, String, centralLicenseSnapshot, evcsHandledKeys.has, key.match, key.startsWith, pvAuto.cache.set, pvAuto.ids.has, this._notifyGetSettingBool, this._notifyParseBool, this._nwApplyEvcsInputSourceState, this._nwIsOwnStateId, this._nwIsReadOnlyEvcsMirrorKey (weitere in der Quelle) |
| [`NexoWattVis.keyFromId`](../../../../src-ts/runtime-executables/main.ts#L27411) | id | Object.entries, id.slice, id.startsWith, rest.includes, this._nwRootUiKeys.has |
| [`NexoWattVis.normalizeRfidCandidate`](../../../../src-ts/runtime-executables/main.ts#L27466) | val | String, hexMatches.sort, s.match, s.replace |
| [`NexoWattVis.maybeCaptureRfidLearning`](../../../../src-ts/runtime-executables/main.ts#L27492) | sourceId, rawVal, ts | Date.now, Number, this.evcsRfidReadIds.has, this.log.info, this.normalizeRfidCandidate, this.setStateAsync, this.updateValue |
| [`NexoWattVis.parseRfidWhitelist`](../../../../src-ts/runtime-executables/main.ts#L27525) | jsonStr | Array.isArray, JSON.parse, JSON.stringify, String, this.normalizeRfidCandidate |
| [`NexoWattVis.refreshRfidWhitelistFromCache`](../../../../src-ts/runtime-executables/main.ts#L27551) | – | JSON.stringify, this.parseRfidWhitelist |
| [`NexoWattVis.isRfidEnabled`](../../../../src-ts/runtime-executables/main.ts#L27564) | – | – |
| [`NexoWattVis.setLocalStateWithCache`](../../../../src-ts/runtime-executables/main.ts#L27573) | id, val, ts | Date.now, Number, this.setStateAsync, this.updateValue |
| [`NexoWattVis.startNotificationMonitor`](../../../../src-ts/runtime-executables/main.ts#L27586) | – | this._nwClearInterval, this._nwSetInterval, this._nwSetTimeout |
| [`tick`](../../../../src-ts/runtime-executables/main.ts#L27601) | – | this.notificationTick |
| [`NexoWattVis.stopNotificationMonitor`](../../../../src-ts/runtime-executables/main.ts#L27618) | – | this._notificationMail?.close, this._nwClearInterval |
| [`NexoWattVis._notifyParseBool`](../../../../src-ts/runtime-executables/main.ts#L27634) | val, def | String |
| [`NexoWattVis._notifyGetCached`](../../../../src-ts/runtime-executables/main.ts#L27650) | key, def | – |
| [`NexoWattVis._notifyGetSettingBool`](../../../../src-ts/runtime-executables/main.ts#L27663) | key, def | this._notifyGetCached, this._notifyParseBool |
| [`NexoWattVis._notifyGetSettingString`](../../../../src-ts/runtime-executables/main.ts#L27673) | key, def | String, this._notifyGetCached |
| [`NexoWattVis._notifyGetSettingNumber`](../../../../src-ts/runtime-executables/main.ts#L27684) | key, def | Number, Number.isFinite, this._notifyGetCached |
| [`NexoWattVis._notifySetDebugState`](../../../../src-ts/runtime-executables/main.ts#L27695) | key, val | Date.now, this.setStateAsync, this.updateValue |
| [`NexoWattVis._getNotificationMail`](../../../../src-ts/runtime-executables/main.ts#L27711) | – | – |
| [`NexoWattVis._notifySendEmail`](../../../../src-ts/runtime-executables/main.ts#L27718) | to, subject, text | String, this._getNotificationMail |
| [`NexoWattVis._notifyCollectObjectIdsFromConfig`](../../../../src-ts/runtime-executables/main.ts#L27732) | – | Array.from, walk |
| [`walk`](../../../../src-ts/runtime-executables/main.ts#L27741) | v | Array.isArray, Object.values, ids.add, re.test, v.trim, walk |
| [`NexoWattVis._notifyRefreshWatchedInstances`](../../../../src-ts/runtime-executables/main.ts#L27773) | force | Array.from, Date.now, String, ids.includes, ids.push, inst.add, this._notifyCollectObjectIdsFromConfig, this.getForeignObjectAsync, valid.push |
| [`NexoWattVis._notifyRefreshNwDevicesCache`](../../../../src-ts/runtime-executables/main.ts#L27830) | force | Date.now, Object.entries, String, cid.split, configuredIds.some, getAlias, hasState, pv.push, this._notifyCollectObjectIdsFromConfig, this._notifyRefreshWatchedInstances, this.getForeignObjectsAsync |
| [`hasState`](../../../../src-ts/runtime-executables/main.ts#L27845) | baseId, suffix | – |
| [`getAlias`](../../../../src-ts/runtime-executables/main.ts#L27855) | obj, key | – |
| [`NexoWattVis._notifyFormatDuration`](../../../../src-ts/runtime-executables/main.ts#L27894) | ms | Math.floor, Math.max, Number |
| [`NexoWattVis.notificationTick`](../../../../src-ts/runtime-executables/main.ts#L27910) | – | this._getNotificationMail |
| [`NexoWattVis.startHistorieExportTimer`](../../../../src-ts/runtime-executables/main.ts#L27921) | – | Date.now, Math.ceil, Math.max, Math.min, Math.round, Number, Number.isFinite, this._nwClearInterval, this._nwClearTimeout, this._nwSetTimeout |
| [`tick`](../../../../src-ts/runtime-executables/main.ts#L27947) | – | this.updateHistorieExportStates |
| [`NexoWattVis.ensureHistorieExportStates`](../../../../src-ts/runtime-executables/main.ts#L27971) | – | Number, Number.isFinite, String, ensureChannel, ensureState, this._nwDetectInfluxInstance, this._nwEnsureInfluxCustom, this._nwGetFlowSlotInfo, this._nwGetHistoryInstance, this.log.debug |
| [`ensureChannel`](../../../../src-ts/runtime-executables/main.ts#L27981) | id, name | this.extendObjectAsync, this.setObjectNotExistsAsync |
| [`ensureState`](../../../../src-ts/runtime-executables/main.ts#L27992) | id, name, role, unit, type, influxOpts | this._nwEnsureInfluxCustom, this.extendObjectAsync, this.setObjectNotExistsAsync |
| [`NexoWattVis._nwEnsureInfluxCustom`](../../../../src-ts/runtime-executables/main.ts#L28170) | localId, inst, opts | Object.assign, String, this.extendObjectAsync, this.getObjectAsync |
| [`NexoWattVis._nwGetNumberFromCache`](../../../../src-ts/runtime-executables/main.ts#L28200) | key | numericMeasurement |
| [`NexoWattVis._nwGetCacheAgeMs`](../../../../src-ts/runtime-executables/main.ts#L28216) | key, now | Date.now, Math.max, Number, Number.isFinite |
| [`NexoWattVis._nwGetNumberFromCacheFresh`](../../../../src-ts/runtime-executables/main.ts#L28234) | key, maxAgeMs, fallback, now | Date.now, Number, Number.isFinite, numericMeasurement, this._nwGetCacheAgeMs |
| [`NexoWattVis._nwGetRawNumberFromCache`](../../../../src-ts/runtime-executables/main.ts#L28257) | key, maxAgeMs, fallback, now | Date.now, Math.max, Number, Number.isFinite, numericMeasurement |
| [`NexoWattVis._nwLiveInputMaxAgeMs`](../../../../src-ts/runtime-executables/main.ts#L28279) | – | Math.max, Math.round, Number, Number.isFinite |
| [`NexoWattVis._nwIsBatterySignInverted`](../../../../src-ts/runtime-executables/main.ts#L28295) | – | this._notifyGetSettingBool |
| [`NexoWattVis._nwStorageFarmIsActiveFromCache`](../../../../src-ts/runtime-executables/main.ts#L28313) | – | Number, this._nwGetStorageFarmRuntimeInfo |
| [`NexoWattVis._nwResolveStorageFarmMetricsFromCache`](../../../../src-ts/runtime-executables/main.ts#L28331) | opts | Array.isArray, Date.now, JSON.parse, Math.abs, Math.max, Math.round, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, parsed.filter, read, this._nwGetCacheAgeMs, this._nwStorageFarmIsActiveFromCache |
| [`read`](../../../../src-ts/runtime-executables/main.ts#L28334) | key | this._nwGetNumberFromCache |
| [`NexoWattVis._nwConfiguredPvCapacityW`](../../../../src-ts/runtime-executables/main.ts#L28396) | – | Array.from, collect, unique.values |
| [`collect`](../../../../src-ts/runtime-executables/main.ts#L28402) | rows | Array.isArray, Math.max, Number, Number.isFinite, String, nwPhysicalPvSourceKey, row.kwp.replace, unique.get, unique.set |
| [`NexoWattVis._nwMergeStorageFarmPvWithBase`](../../../../src-ts/runtime-executables/main.ts#L28426) | baseAcW, opts | Array.isArray, Math.abs, Math.max, Math.min, Math.round, Number, Number.isFinite, String, addBaseSource, baseSourceIds.has, nwApplyPvCapacityPlausibility, nwCombineStorageFarmPv, nwPhysicalPvSourceKey, this._nwConfiguredPvCapacityW (weitere in der Quelle) |
| [`addBaseSource`](../../../../src-ts/runtime-executables/main.ts#L28445) | sourceId | String, baseSourceIds.add, normalizedId.toLowerCase, nwPhysicalPvSourceKey |
| [`NexoWattVis._nwResolveBatteryFlowFromCache`](../../../../src-ts/runtime-executables/main.ts#L28510) | opts | Date.now, Math.abs, Math.max, Math.round, Number, Number.isFinite, String, ageInfo, fromBalance, fromSigned, idOf, numericMeasurement, readMapped, this._nwGetCacheAgeMs (weitere in der Quelle) |
| [`idOf`](../../../../src-ts/runtime-executables/main.ts#L28523) | key | String |
| [`readMapped`](../../../../src-ts/runtime-executables/main.ts#L28546) | key, onlyIfMapped, raw | idOf, this._nwGetNumberFromCacheFresh, this._nwGetRawNumberFromCache |
| [`ageInfo`](../../../../src-ts/runtime-executables/main.ts#L28558) | – | this._nwGetCacheAgeMs |
| [`fromSigned`](../../../../src-ts/runtime-executables/main.ts#L28570) | signedRaw, src, opts2 | Math.abs, Math.round, Number, Number.isFinite, ageInfo |
| [`fromBalance`](../../../../src-ts/runtime-executables/main.ts#L28595) | – | Math.abs, Math.max, Math.round, Number, Number.isFinite, Object.assign, ageInfo, this._nwGetNumberFromCache, this._nwHasMappedDatapoint, this._nwResolveGridImportExportFromCache |
| [`NexoWattVis._nwNormalizeEnergyFlowTsMode`](../../../../src-ts/runtime-executables/main.ts#L28790) | value | String |
| [`NexoWattVis._nwGetEnergyFlowTsMode`](../../../../src-ts/runtime-executables/main.ts#L28813) | – | this._nwNormalizeEnergyFlowTsMode |
| [`NexoWattVis._nwBuildEnergyFlowTsEffectivePlan`](../../../../src-ts/runtime-executables/main.ts#L28838) | mode, runtimeValues, tsValues, shadowResult | Array.isArray, blockedReasons.push, this._nwEvaluateEnergyFlowPlantGate, this._nwGetEnergyFlowTsFixedSourceState, this._nwGetEnergyFlowTsSwitchConfig, this._nwIsEnergyFlowPlantGateWarmupOnly, this._nwNormalizeEnergyFlowTsMode, this._nwValidateEnergyFlowTsCandidate |
| [`NexoWattVis._nwValidateEnergyFlowTsCandidate`](../../../../src-ts/runtime-executables/main.ts#L28905) | tsShadow | Array.isArray, Math.abs, Math.max, Math.round, Number, Number.isFinite, String, blockers.push, farmRows.reduce, nwFeatureFlagsService.storagePerformanceProfile, this._nwCurrentLicenseEdition, warnings.push |
| [`NexoWattVis._nwGetEnergyFlowTsMirrorResolver`](../../../../src-ts/runtime-executables/main.ts#L28991) | – | path.join, require, this.log.debug |
| [`NexoWattVis._nwBuildEnergyFlowTsShadowInput`](../../../../src-ts/runtime-executables/main.ts#L29025) | ctx | Date.now, Number, Number.isFinite, String, idOf, storageSrc.indexOf, this._nwGetNumberFromCache, this._nwGetRawNumberFromCache, this._nwIsBatterySignInverted |
| [`idOf`](../../../../src-ts/runtime-executables/main.ts#L29027) | key | String |
| [`NexoWattVis._nwRunEnergyFlowTsShadowComparison`](../../../../src-ts/runtime-executables/main.ts#L29091) | ctx | Date.now, Math.max, Math.round, Number, Number.isFinite, String, compare, mismatches.join, resolver.buildEnergyFlowSnapshot, this._nwBuildEnergyFlowTsEffectivePlan, this._nwBuildEnergyFlowTsShadowInput, this._nwGetEnergyFlowTsMirrorResolver, this._nwGetEnergyFlowTsMode, this._nwNormalizeEnergyFlowTsMode (weitere in der Quelle) |
| [`compare`](../../../../src-ts/runtime-executables/main.ts#L29133) | key, label, tol | Math.abs, Number, Number.isFinite, mismatches.push |
| [`NexoWattVis._nwGetEnergyFlowTsSwitchConfig`](../../../../src-ts/runtime-executables/main.ts#L29195) | – | Math.max, Math.min, Math.round, Number, Number.isFinite, String |
| [`NexoWattVis._nwBuildEnergyFlowTsRuntimePlantSample`](../../../../src-ts/runtime-executables/main.ts#L29233) | tsShadow | Array.isArray, Date.now, String, blockers.push, mismatches.slice |
| [`NexoWattVis._nwSummarizeEnergyFlowTsRuntimePlantSamples`](../../../../src-ts/runtime-executables/main.ts#L29267) | samples | Array.isArray, Date.now, Math.round, list.filter, list.reduce, list.slice, samples.filter |
| [`NexoWattVis._nwUpdateEnergyFlowTsRuntimePlantEvaluation`](../../../../src-ts/runtime-executables/main.ts#L29309) | tsShadow | Array.isArray, Date.now, current.concat, this._nwBuildEnergyFlowTsRuntimePlantSample, this._nwSummarizeEnergyFlowTsRuntimePlantSamples |
| [`NexoWattVis._nwEvaluateEnergyFlowPlantGate`](../../../../src-ts/runtime-executables/main.ts#L29351) | cfg | Array.isArray, Math.max, Math.min, Math.round, Number, blockers.push, this._nwSummarizeTsShadowPlantSamples |
| [`NexoWattVis._nwIsEnergyFlowPlantGateWarmupOnly`](../../../../src-ts/runtime-executables/main.ts#L29402) | plantGate | Array.isArray, Number, blockers.every, plantGate.blockers.map |
| [`NexoWattVis._nwIsEnergyFlowHardFallbackReason`](../../../../src-ts/runtime-executables/main.ts#L29431) | reason | String, text.includes |
| [`NexoWattVis._nwBuildEnergyFlowFixedSourceInput`](../../../../src-ts/runtime-executables/main.ts#L29447) | switchState | Date.now, Number, String |
| [`NexoWattVis._nwUpdateEnergyFlowTsFixedSourceState`](../../../../src-ts/runtime-executables/main.ts#L29474) | switchState | Date.now, Math.max, Math.min, Math.round, Number, this._nwBuildEnergyFlowFixedSourceInput, this._nwGetEnergyFlowTsSwitchConfig, this._nwIsEnergyFlowHardFallbackReason |
| [`NexoWattVis._nwGetEnergyFlowTsFixedSourceState`](../../../../src-ts/runtime-executables/main.ts#L29531) | – | – |
| [`NexoWattVis._nwEvaluateEnergyFlowTsSwitch`](../../../../src-ts/runtime-executables/main.ts#L29564) | tsShadow | Array.isArray, Date.now, Math.max, Math.min, Math.round, Number, this._nwEvaluateEnergyFlowPlantGate, this._nwGetEnergyFlowTsFixedSourceState, this._nwGetEnergyFlowTsSwitchConfig, this._nwIsEnergyFlowPlantGateWarmupOnly, this._nwUpdateEnergyFlowTsRuntimePlantEvaluation, this._nwValidateEnergyFlowTsCandidate |
| [`NexoWattVis._nwBuildEffectiveEnergyFlowValues`](../../../../src-ts/runtime-executables/main.ts#L29683) | runtimeValues, tsShadow | this._nwBuildEnergyFlowTsCandidateAudit, this._nwEvaluateEnergyFlowTsSwitch, this._nwRecordEnergyFlowTsActiveTestSample, this._nwUpdateEnergyFlowTsFixedSourceState, valueOf |
| [`valueOf`](../../../../src-ts/runtime-executables/main.ts#L29690) | key, fallbackKey | Math.round, Number, Number.isFinite |
| [`NexoWattVis._nwRecordEnergyFlowTsActiveTestSample`](../../../../src-ts/runtime-executables/main.ts#L29734) | effective, runtimeValues, tsValues | Array.from, Array.isArray, Date.now, JSON.stringify, Math.round, Number, Number.isFinite, String, blockers.filter, blockers.push, candidate.blockers.map, sample.blockers.join, samples.push, samples.shift (weitere in der Quelle) |
| [`NexoWattVis._nwSummarizeEnergyFlowTsActiveTestSamples`](../../../../src-ts/runtime-executables/main.ts#L29800) | – | Array.isArray, Date.now, Math.round, samples.filter, samples.reduce, samples.slice, this._energyFlowTsActiveTestSamples.slice |
| [`NexoWattVis._nwBuildEnergyFlowTsCandidateAudit`](../../../../src-ts/runtime-executables/main.ts#L29867) | runtimeValues, tsValues, switchState, tsShadow | Array.isArray, Number, String, keys.map |
| [`NexoWattVis._nwEnergyFlowTsLiveTestStateFromSwitch`](../../../../src-ts/runtime-executables/main.ts#L29925) | switchState | String, reason.includes, source.includes |
| [`NexoWattVis._nwParseTsShadowJson`](../../../../src-ts/runtime-executables/main.ts#L29960) | raw, fallback | JSON.parse, String, text.slice |
| [`NexoWattVis._nwCollectTsShadowMismatches`](../../../../src-ts/runtime-executables/main.ts#L29985) | shadow | Array.isArray, Object.keys, String, add, shadow.diffs.forEach, shadow.mismatches.forEach |
| [`add`](../../../../src-ts/runtime-executables/main.ts#L29988) | entry, idx, prefix | String, out.push |
| [`NexoWattVis._nwEvaluateTsShadowBlock`](../../../../src-ts/runtime-executables/main.ts#L30029) | id, label, shadow, options | Math.max, Number, Number.isFinite, String, blockers.push, mismatches.slice, this._nwCollectTsShadowMismatches, warnings.push |
| [`NexoWattVis._nwBuildTsShadowPlantSample`](../../../../src-ts/runtime-executables/main.ts#L30073) | readiness | Array.isArray, Date.now, String, blockers.slice, readiness.blockers.map, readiness.warnings.map, safeBlock, warnings.slice |
| [`safeBlock`](../../../../src-ts/runtime-executables/main.ts#L30074) | block | Math.max, Math.round, Number, String |
| [`NexoWattVis._nwSummarizeTsShadowPlantSamples`](../../../../src-ts/runtime-executables/main.ts#L30117) | samples | Array.isArray, Date.now, Math.round, list.filter, list.reduce, list.slice, samples.filter |
| [`NexoWattVis._nwUpdateTsShadowPlantEvaluation`](../../../../src-ts/runtime-executables/main.ts#L30172) | _control, readiness | Array.isArray, Date.now, current.concat, this._nwBuildTsShadowPlantSample, this._nwSummarizeTsShadowPlantSamples |
| [`NexoWattVis._nwEvaluateEnergyFlowSwitchReadinessFromControl`](../../../../src-ts/runtime-executables/main.ts#L30216) | control | Date.now, blocks.every, blocks.flatMap, this._nwEvaluateTsShadowBlock, this._nwGetEnergyFlowTsMode, this._nwNormalizeEnergyFlowTsMode, this._nwParseTsShadowJson |
| [`NexoWattVis._nwRecordAndSummarizeTsShadowEvaluation`](../../../../src-ts/runtime-executables/main.ts#L30274) | control, readiness | Array.isArray, Date.now, JSON.stringify, Math.max, Math.round, Number, String, blockSummary, lastBlockers.slice, lastSample.coreLimits.blockers.map, lastSample.energyFlow.blockers.map, lastSample.heatingRod.blockers.map, list.filter, list.reduce (weitere in der Quelle) |
| [`blockSummary`](../../../../src-ts/runtime-executables/main.ts#L30276) | block, id | Array.isArray, Number, Number.isFinite, String, b.blockers.map, b.warnings.map |
| [`NexoWattVis._nwBuildTsShadowRealPlantEvaluation`](../../../../src-ts/runtime-executables/main.ts#L30400) | control | Array.isArray, Date.now, readiness.blockers.slice, readiness.warnings.slice, section, sections.every, sections.filter, this._nwEvaluateEnergyFlowSwitchReadinessFromControl, waiting.join, warnings.push |
| [`section`](../../../../src-ts/runtime-executables/main.ts#L30405) | id, label, ready, detail | Array.isArray, Number, Number.isFinite, String |
| [`NexoWattVis._nwResolveGridImportExportFromCache`](../../../../src-ts/runtime-executables/main.ts#L30481) | – | Date.now, Math.max, readFresh, resolveNvpDisplay, this._nwGetCacheAgeMs, this._nwGetNumberFromCacheFresh, this._nwHasMappedDatapoint, this._nwLiveInputMaxAgeMs |
| [`readFresh`](../../../../src-ts/runtime-executables/main.ts#L30490) | key, mapped | this._nwGetNumberFromCacheFresh |
| [`NexoWattVis._nwSetHistorieValue`](../../../../src-ts/runtime-executables/main.ts#L30516) | localId, val, ts, tolAbs | Math.abs, Math.max, Number, Number.isFinite, this.setLocalStateWithCache |
| [`NexoWattVis.ensureDerivedFlowStates`](../../../../src-ts/runtime-executables/main.ts#L30534) | – | this.setObjectNotExistsAsync |
| [`NexoWattVis.updateHistorieExportStates`](../../../../src-ts/runtime-executables/main.ts#L30786) | reason | Date.now, JSON.stringify, Math.abs, Math.max, Math.min, Math.round, Number, Number.isFinite, String, _boolOr, _computeNetFeeModeNow, _numOr, _strOr, parseJsonSafe (weitere in der Quelle) |
| [`_rawCacheValue`](../../../../src-ts/runtime-executables/main.ts#L30914) | key | – |
| [`_numOr`](../../../../src-ts/runtime-executables/main.ts#L30928) | key, fallback | Number, Number.isFinite, _rawCacheValue |
| [`_boolOr`](../../../../src-ts/runtime-executables/main.ts#L30942) | key, fallback | String, _rawCacheValue |
| [`_strOr`](../../../../src-ts/runtime-executables/main.ts#L30957) | key, fallback | String, _rawCacheValue |
| [`_parseTimeMinutes`](../../../../src-ts/runtime-executables/main.ts#L30968) | raw, defMinutes | Math.max, Math.min, Number, Number.isFinite, String, s.match |
| [`_isInWindow`](../../../../src-ts/runtime-executables/main.ts#L30983) | nowMin, startMin, endMin | Number.isFinite |
| [`_quarterOf`](../../../../src-ts/runtime-executables/main.ts#L30995) | tsMs | Date.now, Math.floor, Math.max, Math.min, Number, d.getMonth |
| [`_nowMinutesLocal`](../../../../src-ts/runtime-executables/main.ts#L31009) | tsMs | Date.now, Number, d.getHours, d.getMinutes |
| [`_computeNetFeeModeNow`](../../../../src-ts/runtime-executables/main.ts#L31023) | – | Math.round, Number, _boolOr, _isInWindow, _nowMinutesLocal, _numOr, _parseTimeMinutes, _quarterOf, _strOr, cachedMode.toLowerCase |
| [`parseJsonSafe`](../../../../src-ts/runtime-executables/main.ts#L31139) | raw | JSON.parse, String |
| [`NexoWattVis.scheduleRfidPolicyApply`](../../../../src-ts/runtime-executables/main.ts#L31239) | reason, onlyIndex | Number, this._nwSetTimeout |
| [`NexoWattVis.applyRfidPolicyAll`](../../../../src-ts/runtime-executables/main.ts#L31266) | reason | Array.isArray, this.applyRfidPolicyForIndex, this.isRfidEnabled, this.refreshRfidWhitelistFromCache |
| [`NexoWattVis.applyRfidPolicyForIndex`](../../../../src-ts/runtime-executables/main.ts#L31282) | index, reason, enabledOverride | Array.isArray, Date.now, Number, String, isActuatorAuthorityBlockedResult, this.evcsList.find, this.getStateAsync, this.isRfidEnabled, this.log.debug, this.normalizeRfidCandidate, this.refreshRfidWhitelistFromCache, this.setLocalStateWithCache, withActuatorShadowContext |
| [`NexoWattVis._nwTrimId`](../../../../src-ts/runtime-executables/main.ts#L31455) | v | v.trim |
| [`NexoWattVis._nwDetectInfluxInstance`](../../../../src-ts/runtime-executables/main.ts#L31466) | – | this._nwTrimId, this.getForeignObjectAsync |
| [`NexoWattVis._nwGetHistoryInstance`](../../../../src-ts/runtime-executables/main.ts#L31488) | – | this._nwTrimId |
| [`NexoWattVis._nwGetPara14aInfluxTargetDays`](../../../../src-ts/runtime-executables/main.ts#L31499) | – | – |
| [`NexoWattVis._nwGetPara14aInfluxTargetRetentionSeconds`](../../../../src-ts/runtime-executables/main.ts#L31508) | – | this._nwGetPara14aInfluxTargetDays |
| [`NexoWattVis._nwGetPara14aInfluxDbName`](../../../../src-ts/runtime-executables/main.ts#L31517) | – | Math.max, Math.round, Number, Number.isFinite |
| [`NexoWattVis._nwGetOwnHostName`](../../../../src-ts/runtime-executables/main.ts#L31527) | – | os.hostname, this._nwTrimId, this.getForeignObjectAsync |
| [`NexoWattVis._nwListAdapterInstances`](../../../../src-ts/runtime-executables/main.ts#L31552) | adapterName | Number, Number.isInteger, Object.entries, String, inst.slice, inst.startsWith, out.push, out.sort, this._nwTrimId, this.getForeignObjectsAsync |
| [`NexoWattVis._nwPickFreeAdapterInstanceNumber`](../../../../src-ts/runtime-executables/main.ts#L31578) | existingNums, preferred | Array.isArray, Math.round, Number, Number.isInteger, used.has |
| [`NexoWattVis._nwBuildPara14aInfluxNative`](../../../../src-ts/runtime-executables/main.ts#L31597) | baseNative, meta | Date.now, JSON.parse, JSON.stringify, Object.assign, this._nwGetPara14aInfluxDbName, this._nwGetPara14aInfluxTargetDays, this._nwGetPara14aInfluxTargetRetentionSeconds, this._nwTrimId |
| [`NexoWattVis._nwBuildPara14aInfluxCommon`](../../../../src-ts/runtime-executables/main.ts#L31620) | baseCommon, host | JSON.parse, JSON.stringify, Object.assign, this._nwTrimId |
| [`NexoWattVis._nwEnsurePara14aInfluxInstance`](../../../../src-ts/runtime-executables/main.ts#L31641) | force | Date.now, Number, String, configured.startsWith, disableManagedDedicatedInstances, finish, pickSharedInfluxInstance, this._nwListAdapterInstances, this._nwTrimId, this.getForeignObjectAsync |
| [`finish`](../../../../src-ts/runtime-executables/main.ts#L31654) | partial | Date.now, Object.assign, this._nwTrimId |
| [`isManagedPara14aInstance`](../../../../src-ts/runtime-executables/main.ts#L31674) | it | String |
| [`pickSharedInfluxInstance`](../../../../src-ts/runtime-executables/main.ts#L31686) | instances | Array.isArray, arr.filter, arr.find, enabled.find, instances.filter |
| [`disableManagedDedicatedInstances`](../../../../src-ts/runtime-executables/main.ts#L31705) | instances, keepInstanceId | Array.isArray, String, isManagedPara14aInstance, this._nwTrimId, this.log.debug, this.log.info, this.nwSimSetInstanceEnabled |
| [`NexoWattVis._nwGetCanonicalHistorieId`](../../../../src-ts/runtime-executables/main.ts#L31773) | legacyKey | String, k.match |
| [`NexoWattVis._nwGetHistoryDpCandidates`](../../../../src-ts/runtime-executables/main.ts#L31804) | name | Object.assign, String, add, raw.slice, raw.startsWith, this._nwGetCanonicalHistorieId, this._nwTrimId |
| [`add`](../../../../src-ts/runtime-executables/main.ts#L31846) | id | out.includes, out.push, this._nwTrimId |
| [`NexoWattVis._nwGetHistoryDpId`](../../../../src-ts/runtime-executables/main.ts#L31917) | name | this._nwGetHistoryDpCandidates |
| [`NexoWattVis._nwGetHistoryApiCached`](../../../../src-ts/runtime-executables/main.ts#L31927) | key, maxAgeMs | Date.now, Math.max, Number, Number.isFinite, cache.delete, cache.entries, cache.get |
| [`NexoWattVis._nwSetHistoryApiCached`](../../../../src-ts/runtime-executables/main.ts#L31951) | key, payload | Date.now, Number.isFinite, this._nwHistoryApiCache.delete, this._nwHistoryApiCache.keys, this._nwHistoryApiCache.set |
| [`NexoWattVis._derivedRefreshPvInvertersCache`](../../../../src-ts/runtime-executables/main.ts#L31972) | force | Date.now, Object.entries, String, addCfg, cache.cache.delete, cache.cache.set, collect, ids.join, ids.sort, list.map, list.push, newIds.add, newIds.has, oldIds.has (weitere in der Quelle) |
| [`collect`](../../../../src-ts/runtime-executables/main.ts#L31987) | arr | Array.isArray, ids.push, this._nwTrimId |
| [`addCfg`](../../../../src-ts/runtime-executables/main.ts#L32047) | arr, tag | Array.isArray, String, list.push, nwPhysicalPvSourceKey, pid.toLowerCase, seenPower.add, seenPower.has, this._nwTrimId |
| [`NexoWattVis.scheduleDerivedFlowUpdate`](../../../../src-ts/runtime-executables/main.ts#L32105) | reason | Date.now, this._nwSetTimeout |
| [`NexoWattVis.updateDerivedFlowStates`](../../../../src-ts/runtime-executables/main.ts#L32133) | reason | Date.now, JSON.stringify, Math.abs, Math.max, Math.min, Math.round, Number, Number.isFinite, String, nwApplyPvCapacityPlausibility, pushTs, pvAuto?.cache?.get, pvBaseSourceIds.includes, pvBaseSourceIds.push (weitere in der Quelle) |
| [`pushTs`](../../../../src-ts/runtime-executables/main.ts#L32374) | k | Number.isFinite, tsList.push |
| [`updateLocal`](../../../../src-ts/runtime-executables/main.ts#L32768) | k, v | Number, Number.isFinite, this.updateValue |
| [`NexoWattVis._nwHasMappedDatapoint`](../../../../src-ts/runtime-executables/main.ts#L32806) | key | this._nwTrimId |
| [`NexoWattVis._nwNormTsMs`](../../../../src-ts/runtime-executables/main.ts#L32816) | tRaw | Date.parse, Number, Number.isFinite, Number.isNaN, tRaw.getTime |
| [`NexoWattVis._nwChooseStepMs`](../../../../src-ts/runtime-executables/main.ts#L32833) | spanMs, targetPoints, minStepMs | Math.ceil, Math.max, Number |
| [`NexoWattVis._nwChooseEnergyIntegrationStepMs`](../../../../src-ts/runtime-executables/main.ts#L32856) | spanMs, minStepMs, maxStepMs | Math.max, Math.min, Number, this._nwChooseStepMs |
| [`NexoWattVis._nwNormalizeHistoryResult`](../../../../src-ts/runtime-executables/main.ts#L32868) | resu, maxRows | Array.isArray, Number, Number.isFinite, Object.assign, Object.prototype.hasOwnProperty.call, asRecord, decimal.test, norm.push, norm.sort, tRaw.trim, this._nwNormTsMs, vRaw.trim |
| [`asRecord`](../../../../src-ts/runtime-executables/main.ts#L32870) | value | Array.isArray |
| [`NexoWattVis._nwGetHistoryAvgSeries`](../../../../src-ts/runtime-executables/main.ts#L32928) | id, startMs, endMs, stepMs, deadlineMs | performance.now |
| [`failure`](../../../../src-ts/runtime-executables/main.ts#L32931) | code | Object.assign |
| [`finish`](../../../../src-ts/runtime-executables/main.ts#L32945) | error, series | clearTimeout, reject, resolve, this._nwPendingHistoryRequests?.delete |
| [`cancel`](../../../../src-ts/runtime-executables/main.ts#L32953) | – | failure, finish |
| [`NexoWattVis._nwCancelHistoryRequests`](../../../../src-ts/runtime-executables/main.ts#L32974) | – | cancel, this._nwPendingHistoryRequests.clear |
| [`NexoWattVis._nwGetHistoryAvgSeriesAny`](../../../../src-ts/runtime-executables/main.ts#L32992) | candidates, startMs, endMs, stepMs | Array.isArray, performance.now, this._nwGetHistoryAvgSeries, this._nwTrimId |
| [`NexoWattVis._nwAtypicalReviewParseTs`](../../../../src-ts/runtime-executables/main.ts#L33013) | raw, fallback, endOfDay | Date.parse, Math.round, Number, Number.isFinite, Number.isNaN, String, dt.getTime, dt.setHours, s.split |
| [`NexoWattVis._nwAtypicalReviewDateTime`](../../../../src-ts/runtime-executables/main.ts#L33037) | ts | Date.now, Number, d.getDate, d.getFullYear, d.getHours, d.getMinutes, d.getMonth, pad |
| [`pad`](../../../../src-ts/runtime-executables/main.ts#L33046) | n | String |
| [`NexoWattVis._nwAtypicalReviewCsvCell`](../../../../src-ts/runtime-executables/main.ts#L33058) | v | String |
| [`NexoWattVis._nwAtypicalReviewNumber`](../../../../src-ts/runtime-executables/main.ts#L33069) | v, digits | Math.round, Number, Number.isFinite, String, n.toFixed |
| [`NexoWattVis._nwAtypicalReviewReadState`](../../../../src-ts/runtime-executables/main.ts#L33080) | localId, fallback | Object.prototype.hasOwnProperty.call, String, this.getStateAsync, this.namespace.replace |
| [`NexoWattVis._nwAtypicalReviewReadNumber`](../../../../src-ts/runtime-executables/main.ts#L33100) | localId, fallback | Number, Number.isFinite, this._nwAtypicalReviewReadState |
| [`NexoWattVis._nwAtypicalReviewReadBool`](../../../../src-ts/runtime-executables/main.ts#L33111) | localId, fallback | String, this._nwAtypicalReviewReadState |
| [`NexoWattVis._nwAtypicalReviewReadString`](../../../../src-ts/runtime-executables/main.ts#L33126) | localId, fallback | String, this._nwAtypicalReviewReadState |
| [`NexoWattVis._nwBuildAtypicalReviewExportPayload`](../../../../src-ts/runtime-executables/main.ts#L33131) | query | Array.from, Array.isArray, Date.now, JSON.parse, Math.max, Math.min, Math.round, Number, Number.isFinite, Object.assign, Object.entries, Object.values, Promise.all, String (weitere in der Quelle) |
| [`NexoWattVis._nwAtypicalReviewPayloadToCsv`](../../../../src-ts/runtime-executables/main.ts#L33293) | payload | Array.isArray, Date.now, add, rows.join, this._nwAtypicalReviewDateTime, this._nwAtypicalReviewNumber |
| [`add`](../../../../src-ts/runtime-executables/main.ts#L33304) | cols | rows.push |
| [`NexoWattVis._nwAtypicalReviewAscii`](../../../../src-ts/runtime-executables/main.ts#L33361) | text | String |
| [`NexoWattVis._nwAtypicalReviewPdfEscape`](../../../../src-ts/runtime-executables/main.ts#L33379) | text | this._nwAtypicalReviewAscii |
| [`NexoWattVis._nwAtypicalReviewWrap`](../../../../src-ts/runtime-executables/main.ts#L33388) | text, maxLen | out.push, s.split, this._nwAtypicalReviewAscii |
| [`NexoWattVis._nwAtypicalReviewPayloadToPdf`](../../../../src-ts/runtime-executables/main.ts#L33407) | payload | Array.isArray, Buffer.concat, Buffer.from, Date.now, String, addObj, chunks.push, lines.push, p.seriesRows.slice, page.push, pageRefs.join, pages.forEach, pages.push, this._nwAtypicalReviewDateTime (weitere in der Quelle) |
| [`yesNo`](../../../../src-ts/runtime-executables/main.ts#L33418) | v | – |
| [`addObj`](../../../../src-ts/runtime-executables/main.ts#L33480) | body | Buffer.from, Buffer.isBuffer, String, objects.push |
| [`NexoWattVis._nwIntegrateKwh`](../../../../src-ts/runtime-executables/main.ts#L33530) | series, endMs, defaultStepMs, positiveOnly | Array.isArray, Date.now, Math.abs, Math.max, Math.min, Number, Number.isFinite |
| [`NexoWattVis.updateEnergyTotalsFromInflux`](../../../../src-ts/runtime-executables/main.ts#L33560) | reason | Date.now, Math.max, Number, Number.isFinite, Promise.allSettled, performance.now, persistLocal, results.some, tasks.push, this._nwGetHistoryDpCandidates, this._nwHasMappedDatapoint, this.log.warn, this.updateValue |
| [`currentSeries`](../../../../src-ts/runtime-executables/main.ts#L33567) | ids, from, stepMs | Array.isArray, series.some, this._nwGetHistoryAvgSeriesAny |
| [`persistLocal`](../../../../src-ts/runtime-executables/main.ts#L33582) | key, val | this.setStateAsync |
| [`NexoWattVis.updateValue`](../../../../src-ts/runtime-executables/main.ts#L33737) | key, value, ts, opts | Date.now, Math.abs, Math.max, Math.round, Number, Number.isFinite, Object.assign, String, d.getDate, d.getFullYear, d.getMonth, isNaN, key.match, key.startsWith (weitere in der Quelle) |
| [`NexoWattVis._nwClearTimer`](../../../../src-ts/runtime-executables/main.ts#L33872) | refName | this._nwClearInterval, this._nwClearTimeout |
| [`NexoWattVis._nwCloseSseClients`](../../../../src-ts/runtime-executables/main.ts#L33886) | – | Array.from, client.res.end, this._nwClearTimer, this._nwSseGuard.closeAll, this.sseClients.clear |
| [`NexoWattVis._nwCloseServer`](../../../../src-ts/runtime-executables/main.ts#L33906) | callback | done, finish, server.close, setTimeout, this._nwCloseSseClients |
| [`clearTimers`](../../../../src-ts/runtime-executables/main.ts#L33943) | – | clearTimeout |
| [`finish`](../../../../src-ts/runtime-executables/main.ts#L33955) | – | clearTimers, done, this._serverSockets.clear |
| [`NexoWattVis.onUnload`](../../../../src-ts/runtime-executables/main.ts#L33993) | callback | Date.now, cleanup.capture, clearTimeout, createHostedCleanup, done, this._nwCloseServer, this._nwSetInfoConnection, this._nwSmartHomePulseTimers.clear, this._nwSmartHomePulseTimers.entries, this.setForeignStateAsync |
| [`createHostedRuntime`](../../../../src-ts/runtime-executables/main.ts#L34078) | owner, bridge | Object.create, runtime._para14aEebusApi.attachHostedBridge |
| [`canOperate`](../../../../src-ts/runtime-executables/main.ts#L34091) | – | centralLicenseSnapshot, guardedBridge.canWrite |
| [`sendFeedback`](../../../../src-ts/runtime-executables/main.ts#L34092) | message | bridge.hostedModuleFeedback |
| [`startOperational`](../../../../src-ts/runtime-executables/main.ts#L34099) | – | Promise.resolve, centralLicenseSnapshot, guardedBridge.canWrite |
| [`start`](../../../../src-ts/runtime-executables/main.ts#L34127) | – | Promise.resolve |
| [`reserveDeviceProfileChange`](../../../../src-ts/runtime-executables/main.ts#L34152) | input | Object.assign, Promise.reject, runtime.reserveDeviceProfileChange |
| [`reconcileDeviceEms`](../../../../src-ts/runtime-executables/main.ts#L34156) | devices | Promise.reject, runtime.reconcileDeviceEms |
| [`startOperational`](../../../../src-ts/runtime-executables/main.ts#L34160) | – | startOperational |
| [`handle`](../../../../src-ts/runtime-executables/main.ts#L34161) | req, res, next | res.status, runtime._hostedHttpHandler, startOperational |
| [`onStateChange`](../../../../src-ts/runtime-executables/main.ts#L34168) | id, state | runtime.onStateChange |
| [`onMessage`](../../../../src-ts/runtime-executables/main.ts#L34169) | message | runtime.onMessage |
| [`onHostedEebusMessage`](../../../../src-ts/runtime-executables/main.ts#L34170) | message | Promise.resolve, runtime._para14aEebusApi.handleHostedMessage |
| [`revokeSessions`](../../../../src-ts/runtime-executables/main.ts#L34174) | – | runtime._nwCloseSseClients |
| [`status`](../../../../src-ts/runtime-executables/main.ts#L34175) | – | guardedBridge.canWrite |
| [`stop`](../../../../src-ts/runtime-executables/main.ts#L34178) | – | runtime.stopStateWrites, stopHostedRuntime |
