# src-ts/ems/charging-management/charging-allocation.ts

Verteilt das begrenzte Ladebudget auf die zugelassenen Ladepunkte und deren elektrische Grenzen.

**Daten und Wirkung:** Verarbeitet die in den TypeScript-Signaturen beschriebenen Eingaben. Ergebnisse gehen über die Export-/Import-Verknüpfungen an Aufrufer; erzeugte JavaScript-Spiegel werden aus dieser Quelle gebaut.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/ems/charging-management/charging-allocation.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/ems/charging-management/index.ts](../../../../../src-ts/ems/charging-management/index.ts)
- [src-ts/runtime-executables/ems/modules/charging-management.ts](../../../../../src-ts/runtime-executables/ems/modules/charging-management.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`finiteOrNull`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L425) | value | Number, Number.isFinite, value.trim |
| [`nonNegative`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L436) | value, fallback | Math.round, finiteOrNull |
| [`nonNegativeFloat`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L442) | value, fallback | Number, finiteOrNull, v.toFixed |
| [`physicalPvBudgetW`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L454) | input | Math.max, Math.round, finiteOrNull, nonNegative |
| [`purePvBudgetW`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L467) | input | Math.max, Math.min, Math.round, finiteOrNull, physicalPvBudgetW |
| [`boolValue`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L474) | value, fallback | Number.isFinite, value.trim |
| [`str`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L485) | value, fallback | String |
| [`safeKey`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L490) | value, fallbackIndex | raw.toLowerCase, str |
| [`normalizeControlBasis`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L497) | value | str |
| [`allocationSafe`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L504) | allocation, fallbackIndex | safeKey |
| [`buildAllocationMap`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L508) | allocations | allocations.forEach |
| [`buildPhaseDecisionMap`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L526) | input | Array.isArray, wallboxes.forEach |
| [`wantsTsNativeAllocation`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L537) | input | boolValue |
| [`isJsComparisonDiagnosticOnly`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L541) | input, plan | boolValue, wantsTsNativeAllocation |
| [`normalizedChargingMode`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L562) | wb | String, raw.includes |
| [`modeAllowsPrearmedSetpoint`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L582) | wb | normalizedChargingMode |
| [`commandDemandAllowed`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L586) | wb | modeAllowsPrearmedSetpoint |
| [`floorToPositiveStep`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L592) | value, step | Math.floor |
| [`ceilToPositiveStep`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L598) | value, step | Math.ceil |
| [`powerFactorWPerA`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L604) | wb | Math.max |
| [`technicalMinPowerW`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L608) | wb | Math.max, Math.round, ceilToPositiveStep, powerFactorWPerA |
| [`technicalMaxPowerW`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L620) | wb | Math.floor, Math.max, Math.min, floorToPositiveStep, powerFactorWPerA |
| [`quantizeTargetDown`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L637) | wb, requestedW | Math.floor, Math.max, Math.min, Math.round, Number, Number.isFinite, floorToPositiveStep, powerFactorWPerA, technicalMaxPowerW |
| [`capFromBinding`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L661) | binding, cap | Math.max, Math.round, boolValue, finiteOrNull |
| [`effectiveNativeBudgetW`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L667) | input, candidates | Math.max, Math.min, Math.round, Number.isFinite, String, boolValue, budgetMode.endsWith, budgetMode.includes, candidates.reduce, capFromBinding, finiteOrNull |
| [`isChargingCandidate`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L696) | wb | commandDemandAllowed, normalizedChargingMode |
| [`finalGuardPriority`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L707) | a, b | a.safe.localeCompare, normalizedChargingMode |
| [`appendAllocationSafetyReason`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L731) | current, reason | String, reasons.includes, reasons.join, reasons.push |
| [`actualPowerReservationW`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L737) | wallbox | Math.max, Number.isFinite |
| [`zeroExportStorageCreditW`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L756) | wallbox | Math.floor, Math.max, Math.min, finiteOrNull, normalizedChargingMode, technicalMinPowerW |
| [`gridBaseForPowerW`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L765) | wallbox | Math.min, normalizedChargingMode, technicalMinPowerW |
| [`pvReservationForPowerW`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L775) | wallbox, powerW | Math.max, Number.isFinite, gridBaseForPowerW, zeroExportStorageCreditW |
| [`validZeroExportProbeW`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L795) | wallbox, input | Date.now, Math.min, Number, boolValue, nonNegative, normalizedChargingMode, technicalMaxPowerW |
| [`applyFinalAllocationSafetyGuards`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L805) | planRaw, input | Date.now, Math.abs, Math.max, Math.min, Number, Number.isFinite, String, actualPowerReservationW, actualPurePvReservationBySafe.get, actualPurePvReservationBySafe.set, actualPvReservationBySafe.get, actualPvReservationBySafe.set, actualReservationBySafe.get, actualReservationBySafe.set (weitere in der Quelle) |
| [`compareNativeCandidates`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1044) | a, b | a.wb.safe.localeCompare |
| [`nativePriorityGroupKey`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1073) | candidate | Math.floor |
| [`buildStationCaps`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1082) | candidates | Math.max, Math.min, String, caps.get, caps.set |
| [`stationResourceW`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1094) | candidate, stationRemaining | Math.max, Number, String, stationRemaining.get, stationRemaining.has |
| [`pvRequiredForIncrement`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1100) | candidate, incrementW | Math.max, pvReservationForPowerW |
| [`maxIncrementByPv`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1115) | candidate, pvRemainingW | Math.max, gridBaseForPowerW, zeroExportStorageCreditW |
| [`applyTsNativeAllocationPlan`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1128) | plannedRaw, input | Math.floor, Math.max, Math.min, Number, Number.isFinite, String, active.filter, activeByStation.get, activeByStation.has, activeByStation.set, allCandidates.filter, allCandidates.map, buildStationCaps, candidates.map (weitere in der Quelle) |
| [`consume`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1162) | candidate, incrementW | Math.max, Math.min, Number, Number.isFinite, String, pvRequiredForIncrement, quantizeTargetDown, stationRemaining.get, stationRemaining.has, stationRemaining.set, stationResourceW |
| [`normalizeWallboxPlan`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1356) | wallbox, index, allocation, input, phaseDecision | Math.floor, Math.max, Math.min, Math.round, Number, Number.isFinite, boolValue, effectiveMode.trim, finiteOrNull, nonNegative, nonNegativeFloat, safeKey, str, wallbox.boostMaxPowerW.trim (weitere in der Quelle) |
| [`buildChargingAllocationShadowPlan`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1541) | input | Array.isArray, Date.now, Math.max, Math.round, Number, allocationMap.entries, applyFinalAllocationSafetyGuards, applyTsNativeAllocationPlan, blockers.push, boolValue, buildAllocationMap, buildPhaseDecisionMap, explicitTotalCurrent.toFixed, finiteOrNull (weitere in der Quelle) |
| [`compareChargingAllocationShadowPlan`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1675) | input, plan | Array.isArray, allocations.forEach, cmpNumber, plan.wallboxes.map |
| [`pushMismatch`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1677) | field, js, ts, diff, safe | mismatches.push |
| [`cmpNumber`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1683) | field, jsValue, tsValue, tolerance, safe | Math.abs, Number, diff.toFixed, finiteOrNull, pushMismatch |
| [`buildChargingAllocationApply`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1722) | plan | plan.wallboxes.map |
| [`collectProductiveBlockers`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1733) | input, plan, comparison | Array.from, Array.isArray, blockers.push, isJsComparisonDiagnosticOnly, plan.wallboxes.some |
| [`collectNormalSourceBlockers`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1741) | plan | Array.from, Array.isArray, blockers.push, plan.wallboxes.some |
| [`normalSourceWarnings`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1747) | plan, comparison | Array.from, Array.isArray, Number, Number.isFinite, warnings.push |
| [`buildChargingAllocationProductivePrep`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1759) | input, plan, comparison | Array.from, Array.isArray, buildChargingAllocationApply, buildChargingAllocationShadowPlan, collectProductiveBlockers, compareChargingAllocationShadowPlan, isJsComparisonDiagnosticOnly, wantsTsNativeAllocation |
| [`buildChargingAllocationProductive`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1804) | input, plan, comparison | Array.from, Array.isArray, buildChargingAllocationApply, buildChargingAllocationShadowPlan, collectProductiveBlockers, compareChargingAllocationShadowPlan, isJsComparisonDiagnosticOnly, wantsTsNativeAllocation |
| [`buildChargingAllocationNormalSource`](../../../../../src-ts/ems/charging-management/charging-allocation.ts#L1869) | input, plan, comparison | Number, Number.isFinite, buildChargingAllocationApply, buildChargingAllocationShadowPlan, collectNormalSourceBlockers, compareChargingAllocationShadowPlan, normalSourceWarnings |
