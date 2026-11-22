# src-ts/ems/core-limits/core-budget.ts

Berechnet das zentrale verbleibende Leistungsbudget aus Netzgrenze, Messwerten und reservierten Anforderungen.

**Daten und Wirkung:** Verarbeitet die in den TypeScript-Signaturen beschriebenen Eingaben. Ergebnisse gehen über die Export-/Import-Verknüpfungen an Aufrufer; erzeugte JavaScript-Spiegel werden aus dieser Quelle gebaut.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/ems/core-limits/core-budget.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `../../contracts/ems-budget` | [src-ts/contracts/ems-budget.ts](../../../../../src-ts/contracts/ems-budget.ts) |
| `../../contracts/units` | [src-ts/contracts/units.ts](../../../../../src-ts/contracts/units.ts) |
| `../../utils/number` | [src-ts/utils/number.ts](../../../../../src-ts/utils/number.ts) |

**Direkt importiert von:**

- [src-ts/ems/core-limits/index.ts](../../../../../src-ts/ems/core-limits/index.ts)
- [src-ts/runtime-executables/ems/modules/core-limits.ts](../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`numberPercentOrNull`](../../../../../src-ts/ems/core-limits/core-budget.ts#L46) | value | clampNumber, toNumberOrNull |
| [`gate`](../../../../../src-ts/ems/core-limits/core-budget.ts#L61) | rawW, effectiveW, reason, diagnosticText | Math.max, Math.round |
| [`isStorageReserveActive`](../../../../../src-ts/ems/core-limits/core-budget.ts#L83) | storageSocPct, reserveSocPct, allowStorageDischarge | numberPercentOrNull |
| [`calculatePvBudgetGate`](../../../../../src-ts/ems/core-limits/core-budget.ts#L100) | input | Math.max, Math.round, gate, isStorageReserveActive, numberPercentOrNull, positiveWatt |
| [`calculateGridBudgetGate`](../../../../../src-ts/ems/core-limits/core-budget.ts#L125) | input | Math.max, gate, positiveWatt, toNumberOrNull |
| [`buildCoreBudgetSnapshot`](../../../../../src-ts/ems/core-limits/core-budget.ts#L156) | input | Date.now, Math.max, Math.min, calculateGridBudgetGate, calculatePvBudgetGate, gate, isStorageReserveActive, numberPercentOrNull, positiveWatt, toNumberOrNull |
| [`restBool`](../../../../../src-ts/ems/core-limits/core-budget.ts#L243) | value, fallback | value.trim |
| [`restString`](../../../../../src-ts/ems/core-limits/core-budget.ts#L255) | value, fallback | String |
| [`restNumberOrNull`](../../../../../src-ts/ems/core-limits/core-budget.ts#L261) | value | toNumberOrNull |
| [`restWatt`](../../../../../src-ts/ems/core-limits/core-budget.ts#L266) | value | positiveWatt, restNumberOrNull |
| [`buildCoreForecastGate`](../../../../../src-ts/ems/core-limits/core-budget.ts#L277) | input | Math.max, Math.round, clampNumber, restBool, restNumberOrNull, restString, restWatt |
| [`buildCoreTariffGate`](../../../../../src-ts/ems/core-limits/core-budget.ts#L308) | input | restBool, restNumberOrNull, restString, restWatt |
| [`buildCorePeakTariffGridGates`](../../../../../src-ts/ems/core-limits/core-budget.ts#L338) | input | buildCoreTariffGate, restBool, restNumberOrNull, restString, restWatt |
| [`buildCoreRestGatesShadow`](../../../../../src-ts/ems/core-limits/core-budget.ts#L392) | input | Date.now, buildCoreForecastGate, buildCorePeakTariffGridGates, toNumberOrNull |
| [`buildCoreRestGatesProductive`](../../../../../src-ts/ems/core-limits/core-budget.ts#L424) | input | buildCoreRestGatesShadow |
| [`reservationString`](../../../../../src-ts/ems/core-limits/core-budget.ts#L532) | value, fallback | String |
| [`reservationPositiveWatt`](../../../../../src-ts/ems/core-limits/core-budget.ts#L543) | value, fallback | positiveWatt, toNumberOrNull |
| [`reservationPriority`](../../../../../src-ts/ems/core-limits/core-budget.ts#L554) | value | toNumberOrNull |
| [`calculateCoreBudgetFlexUsedW`](../../../../../src-ts/ems/core-limits/core-budget.ts#L569) | consumers, order | Array.isArray, Math.round, Object.keys, keys.reduce |
| [`buildCoreBudgetConsumersList`](../../../../../src-ts/ems/core-limits/core-budget.ts#L590) | consumers, order | Array.from, Array.isArray, Object.keys, result.push |
| [`computeCoreBudgetReservation`](../../../../../src-ts/ems/core-limits/core-budget.ts#L616) | runtime, request, tsInput | Array.from, Array.isArray, Date.now, Math.max, Math.min, Math.round, Object.keys, calculateCoreBudgetFlexUsedW, order.includes, order.push, positiveWatt, reservationPositiveWatt, reservationPriority, reservationString (weitere in der Quelle) |
| [`restGateNumber`](../../../../../src-ts/ems/core-limits/core-budget.ts#L806) | value | toNumberOrNull |
| [`restGateWatt`](../../../../../src-ts/ems/core-limits/core-budget.ts#L812) | value | positiveWatt, restGateNumber |
| [`restGateNullableWatt`](../../../../../src-ts/ems/core-limits/core-budget.ts#L818) | value | positiveWatt, restGateNumber |
| [`restGateBool`](../../../../../src-ts/ems/core-limits/core-budget.ts#L824) | value, fallback | value.trim |
| [`restGateText`](../../../../../src-ts/ems/core-limits/core-budget.ts#L836) | value, fallback | String |
| [`buildCoreBudgetRestGatesSnapshot`](../../../../../src-ts/ems/core-limits/core-budget.ts#L852) | input | Date.now, Math.max, Math.min, Math.round, restGateBool, restGateNullableWatt, restGateNumber, restGateText, restGateWatt, toNumberOrNull |
| [`compareCoreBudgetRestGates`](../../../../../src-ts/ems/core-limits/core-budget.ts#L921) | js, ts | cmpBool, cmpNum, cmpText |
| [`cmpNum`](../../../../../src-ts/ems/core-limits/core-budget.ts#L930) | field, jsValue, tsValue, tolerance | Math.abs, Math.round, mismatches.push, restGateNumber |
| [`cmpBool`](../../../../../src-ts/ems/core-limits/core-budget.ts#L938) | field, jsValue, tsValue | mismatches.push, restGateBool |
| [`cmpText`](../../../../../src-ts/ems/core-limits/core-budget.ts#L943) | field, jsValue, tsValue | mismatches.push, restGateText |
