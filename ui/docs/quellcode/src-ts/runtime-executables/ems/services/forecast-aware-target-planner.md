# src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts

Berechnet zeitbezogene Ladeziele aus Bedarf, Prognosen und verfügbaren Zeit-/Leistungsgrenzen.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/services/forecast-target-runtime-bridge.ts](../../../../../../src-ts/runtime-executables/ems/services/forecast-target-runtime-bridge.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L150) | value, fallback | Number, Number.isFinite |
| [`clamp`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L155) | value, min, max, fallback | Math.max, Math.min, finite |
| [`overlapMs`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L159) | aStart, aEnd, bStart, bEnd | Math.max, Math.min |
| [`requirementRank`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L163) | value | – |
| [`segmentBounds`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L167) | segment | Math.max, Number.isFinite, finite |
| [`averagePower`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L176) | curve, startMs, endMs | Array.isArray, Math.max, overlapMs, segmentBounds |
| [`averagePrice`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L188) | curve, startMs, endMs | Array.isArray, Number.isFinite, finite, overlapMs |
| [`percentile`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L205) | values, quantile | Math.ceil, Math.floor, clamp, values.filter |
| [`createSlots`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L217) | input, horizonEndMs | Date.now, Math.floor, Math.max, Math.min, Math.round, averagePower, averagePrice, clamp, finite, slots.push |
| [`stationRemaining`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L252) | slot, goal | Math.max, Number.isFinite, String, finite, slot.stationUsedW.get |
| [`availablePower`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L260) | slot, goal, source | Math.max, Math.min, finite, slot.allocations.get, stationRemaining |
| [`allocate`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L273) | slot, goal, source | Math.max, Math.min, String, allocateLimitedGrid, availablePower, finite, goal.allocations.get, goal.allocations.set, slot.allocations.get, slot.allocations.set, slot.stationUsedW.get, slot.stationUsedW.set |
| [`allocateLimitedGrid`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L320) | slot, goal, durationH | Math.max, Math.min, String, finite, goal.allocations.set, slot.allocations.get, slot.allocations.set, slot.stationUsedW.get, slot.stationUsedW.set, stationRemaining |
| [`currentAllocation`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L346) | goal, slots, nowMs | goal.allocations.get, slots.find |
| [`nextWindow`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L351) | goal, slots, nowMs, priceUsed | Math.max, Math.min, Math.round |
| [`buildForecastAwareTargetPlans`](../../../../../../src-ts/runtime-executables/ems/services/forecast-aware-target-planner.ts#L379) | input | Array.isArray, Date.now, Math.max, Number, Number.isFinite, allocate, clamp, createSlots, finite, goals.map, mutableGoals.map, percentile, slots.filter, slots.map (weitere in der Quelle) |
