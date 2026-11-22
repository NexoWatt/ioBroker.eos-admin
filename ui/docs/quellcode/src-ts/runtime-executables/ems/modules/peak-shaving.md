# src-ts/runtime-executables/ems/modules/peak-shaving.ts

Bestimmt die Speicher-Unterstützung zur Begrenzung von Netzbezugsspitzen innerhalb der freigegebenen Speicherleistung.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./base` | [src-ts/runtime-executables/ems/modules/base.ts](../../../../../../src-ts/runtime-executables/ems/modules/base.ts) |
| `../services/measurement-freshness` | [src-ts/runtime-executables/ems/services/measurement-freshness.ts](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts) |
| `../reasons` | [src-ts/runtime-executables/ems/reasons.ts](../../../../../../src-ts/runtime-executables/ems/reasons.ts) |
| `../services/actuator-shadow-arbiter` | [src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts) |
| `../services/actuator-command-contract` | [src-ts/runtime-executables/ems/services/actuator-command-contract.ts](../../../../../../src-ts/runtime-executables/ems/services/actuator-command-contract.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`SlidingWindow.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L86) | maxSeconds | Math.max, Number |
| [`SlidingWindow.setMaxSeconds`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L104) | maxSeconds | Date.now, Math.max, Number, this.prune |
| [`SlidingWindow.push`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L118) | v, t | Date.now, Number.isFinite, this.prune, this.samples.push |
| [`SlidingWindow.prune`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L136) | nowTs | this.samples.shift |
| [`SlidingWindow.mean`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L155) | – | – |
| [`SlidingWindow.max`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L174) | – | Number.isFinite |
| [`SlidingWindow.count`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L195) | – | – |
| [`num`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L205) | v, fallback | Number, Number.isFinite |
| [`clamp`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L215) | n, min, max | Math.max, Math.min, Number.isFinite |
| [`normalizeVoltageLevelKey`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L238) | v | String |
| [`atypicalThresholdPercent`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L251) | voltageLevel, fallback | Object.prototype.hasOwnProperty.call, normalizeVoltageLevelKey |
| [`isPeakShavingRuntimeEnabled`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L264) | config | – |
| [`parseHmToMinutes`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L277) | value | Number, Number.isInteger, String, s.match |
| [`localYmd`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L292) | date | Number.isNaN, String, d.getDate, d.getFullYear, d.getMonth, d.getTime |
| [`normalizeYmd`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L306) | value | Number.isNaN, String, d.getTime, localYmd, s.match |
| [`asArray`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L323) | value | Array.isArray, value.split |
| [`toNumberArray`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L335) | value | Math.round, Number, Number.isFinite, asArray, out.push, seen.add, seen.has |
| [`toDateSet`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L354) | value | asArray, normalizeYmd, set.add |
| [`isoWeekday`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L372) | date | date.getDay |
| [`isChristmasNewYearPeriod`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L382) | date | date.getDate, date.getMonth |
| [`PeakShavingModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L409) | adapter, dpRegistry | super |
| [`PeakShavingModule._isEnabled`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L454) | – | isPeakShavingRuntimeEnabled |
| [`PeakShavingModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L463) | – | mk, this._isEnabled, this._setupAtypicalAuditHistory, this.adapter.setObjectNotExistsAsync |
| [`mk`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L494) | id, name, type, role | this.adapter.setObjectNotExistsAsync |
| [`PeakShavingModule._atypicalSeasonMonths`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L612) | season | String |
| [`PeakShavingModule._atypicalWindowLabel`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L633) | win | String |
| [`PeakShavingModule._atypicalWindowMatches`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L656) | win, nowDate | isoWeekday, localYmd, months.includes, normalizeYmd, nowDate.getDay, nowDate.getHours, nowDate.getMinutes, nowDate.getMonth, parseHmToMinutes, seasonMonths.includes, this._atypicalSeasonMonths, toNumberArray, weekdays.includes |
| [`PeakShavingModule._evaluateAtypicalSchedule`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L703) | atypicalCfg, now | Array.isArray, Date.now, bridgeDaySet.has, exceptionSet.has, holidaySet.has, isChristmasNewYearPeriod, isoWeekday, localYmd, this._atypicalWindowLabel, this._atypicalWindowMatches, toDateSet |
| [`PeakShavingModule._calculateAtypicalTarget`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L760) | atypicalCfg | Math.max, Math.min, String, atypicalThresholdPercent, clamp, num |
| [`PeakShavingModule._getAtypicalSourceInfo`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L836) | atypicalCfg | Math.round, Number, Number.isFinite, String |
| [`PeakShavingModule._readOwnNumber`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L861) | id, fallback | Number, Number.isFinite, this.adapter.getStateAsync |
| [`PeakShavingModule._readOwnString`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L883) | id, fallback | String, this.adapter.getStateAsync |
| [`PeakShavingModule._ensureAtypicalReviewLoaded`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L905) | resetIdentity | Math.max, String, this._readOwnNumber, this._readOwnString |
| [`PeakShavingModule._buildAtypicalReviewContext`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L932) | { atypicalCfg, schedule, target, gridPowerRaw, effPower, staleMeter, now } | Date.now, Math.max, Math.min, Math.round, Number, Number.isFinite, String, atypicalThresholdPercent, num, this._ensureAtypicalReviewLoaded, this._getAtypicalSourceInfo |
| [`PeakShavingModule._setupAtypicalAuditHistory`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1033) | – | String, set, this.adapter._nwDetectInfluxInstance, this.adapter._nwEnsureInfluxCustom, this.adapter._nwGetHistoryInstance |
| [`set`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1072) | id, val | this.adapter.setStateAsync |
| [`PeakShavingModule._getAtypicalAuditIntervalMs`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1150) | atypicalCfg | Math.round, Number, Number.isFinite, clamp, num |
| [`PeakShavingModule._publishAtypicalAuditSample`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1170) | ctx | Date.now, JSON.stringify, Math.max, Math.round, Number, Number.isFinite, String, set, this._getAtypicalAuditIntervalMs |
| [`set`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1204) | id, val | this.adapter.setStateAsync |
| [`PeakShavingModule._publishAtypicalDiagnostics`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1269) | ctx | Date.now, JSON.stringify, Math.round, Number, Number.isFinite, String, set, this._publishAtypicalAuditSample, this._setupAtypicalAuditHistory |
| [`set`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1281) | id, val | this.adapter.setStateAsync |
| [`PeakShavingModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1361) | – | Array.isArray, Date.now, Math.max, Math.min, Math.round, Number, Number.isFinite, String, clamp, fn.call, num, phaseKeys.some, reasonToGerman, resolveCurrentNvpSnapshot (weitere in der Quelle) |
| [`PeakShavingModule._ensureActuatorChannel`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1841) | idPart | mk, this.adapter.setObjectNotExistsAsync |
| [`mk`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1860) | sid, name, type, role | this.adapter.setObjectNotExistsAsync |
| [`PeakShavingModule._actuatorOwner`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1885) | safeId | – |
| [`PeakShavingModule._actuatorIds`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1889) | a, safeId | String, ids.includes, ids.push, this.dp.getEntry |
| [`PeakShavingModule._actuatorHasExclusiveAuthority`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1901) | a, safeId, owner | ids.every, this._actuatorIds |
| [`PeakShavingModule._actuatorContractCfg`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1914) | a | Math.max, Math.round, num |
| [`PeakShavingModule._readActuatorReadback`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1924) | a, safeId | Math.max, Math.round, Number, Number.isFinite, num, this.dp.getAgeMs, this.dp.getBoolean, this.dp.getNumberFresh |
| [`PeakShavingModule._actuatorReadbackMatches`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1944) | a, requested, actual | Math.abs, Math.max, Number, Number.isFinite, num |
| [`PeakShavingModule._publishActuatorContract`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1961) | ch, owner, requestedReductionW, acceptedReductionW, confirmedReductionW, contract, restorePending | Math.max, Math.round, String, num, this.adapter.setStateAsync |
| [`PeakShavingModule._writeActuatorCommand`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L1976) | a, safeId, ch, requested, reason, releaseAuthority | Date.now, priorityForOwner, this._actuatorContract.complete, this._actuatorContract.confirmFromReadback, this._actuatorContract.prepare, this._actuatorContract.result, this._actuatorContractCfg, this._actuatorHasExclusiveAuthority, this._actuatorOwner, this._actuatorReadbackMatches, this._readActuatorReadback, withActuatorShadowContext |
| [`PeakShavingModule._normalizeActuators`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L2018) | actuators | Array.isArray |
| [`PeakShavingModule._prepareActuatorDatapoints`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L2047) | a, safeId | this.dp.upsert |
| [`PeakShavingModule._applyActuators`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L2079) | actuators, requestedReductionW, voltageV | Date.now, Math.max, Math.min, Number.isFinite, String, a.id.toLowerCase, clamp, num, this._baselines.get, this._baselines.set, this._ensureActuatorChannel, this._normalizeActuators, this._prepareActuatorDatapoints, this._publishActuatorContract (weitere in der Quelle) |
| [`PeakShavingModule._restoreActuators`](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts#L2189) | actuators | Date.now, Number.isFinite, String, a.id.toLowerCase, restored.push, this._actuatorContract.release, this._baselines.delete, this._baselines.get, this._ensureActuatorChannel, this._normalizeActuators, this._prepareActuatorDatapoints, this._publishActuatorContract, this._writeActuatorCommand, this.adapter.setStateAsync |
