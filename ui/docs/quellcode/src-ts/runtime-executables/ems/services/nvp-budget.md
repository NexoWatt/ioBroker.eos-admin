# src-ts/runtime-executables/ems/services/nvp-budget.ts

Berechnet gemeinsame, konservative Leistungsintervalle für die NVP-Bereiche M0 und M1.

**Daten und Wirkung:** Verarbeitet geprüfte Leistungen in W (Bezug positiv, Speicherentladung positiv); erzeugt reine Rechenergebnisse ohne Gerätezugriff.

**Bei Änderungen:** Alle Extremkombinationen, alte Freigaben, lokale Grenzen und Übergänge prüfen. Eine erlaubte Speicherladung ist keine zugesagte PV-Senke.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./nvp-topology` | [src-ts/runtime-executables/ems/services/nvp-topology.ts](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts)
- [src-ts/runtime-executables/ems/modules/nvp-topology.ts](../../../../../../src-ts/runtime-executables/ems/modules/nvp-topology.ts)
- [src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-pv.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L21) | value | Number.isFinite |
| [`bound`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L22) | value | finite |
| [`interval`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L23) | a, b | finite |
| [`operatingLimits`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L26) | point | bound, finite |
| [`computeStorageCorridor`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L44) | input | Math.max, Math.min, bound, finite, interval |
| [`evaluateIntervals`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L67) | input | Array.isArray, Math.max, bound, finite, ids.add, ids.has, input.participants.filter, interval, participants.reduce, pointIds.add, pointIds.has, points.every, points.push |
| [`allocateIndependentBudgets`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L102) | input | Array.isArray, Math.max, Math.min, Object.prototype.hasOwnProperty.call, affectsPoint, evaluateIntervals, finite, interval, others.reduce, participants.filter, participants.map, participants.push, participants.slice |
| [`computePvLimit`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L143) | input | Array.isArray, Math.min, Object.prototype.hasOwnProperty.call, finite, reasons.join, reasons.push |
| [`hybridStorageBounds`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L160) | input | Math.max, Math.min, finite, interval |
| [`distributeTarget`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L172) | rows, totalW | Math.abs, Math.max, Math.min, remainingRows.reduce, rows.entries, rows.reduce, rows.slice |
| [`solveDynamicDispatch`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L199) | input | Array.isArray, Math.max, Math.min, affectsPoint, asIntervals, baseline.points.find, clip, commands.push, commands.some, confirmedCandidate.points.some, contained.reduce, contractions.filter, distributeTarget, eos.filter (weitere in der Quelle) |
| [`invalid`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L200) | reason | – |
| [`asIntervals`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L212) | rows | rows.map |
| [`sum`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L219) | rows, key | rows.reduce |
| [`requirement`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L220) | pointId | external.filter, input.points.find, sum |
| [`clip`](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts#L233) | v, low, high | Math.max, Math.min |
