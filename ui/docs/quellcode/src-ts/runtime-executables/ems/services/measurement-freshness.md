# src-ts/runtime-executables/ems/services/measurement-freshness.ts

Bewertet Alter und Verwendbarkeit von Messungen und bildet eine gemeinsame aktuelle NVP-Messbasis.

**Daten und Wirkung:** Liest Wert, Zeitstempel und konfigurierte Altersgrenzen; liefert Frische-/Gültigkeitsangaben. Ein Zahlenwert allein beweist keine aktuelle Messung.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/engine.ts](../../../../../../src-ts/runtime-executables/ems/engine.ts)
- [src-ts/runtime-executables/ems/modules/charging-management.ts](../../../../../../src-ts/runtime-executables/ems/modules/charging-management.ts)
- [src-ts/runtime-executables/ems/modules/core-limits.ts](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts)
- [src-ts/runtime-executables/ems/modules/grid-constraints.ts](../../../../../../src-ts/runtime-executables/ems/modules/grid-constraints.ts)
- [src-ts/runtime-executables/ems/modules/nvp-coordinator.ts](../../../../../../src-ts/runtime-executables/ems/modules/nvp-coordinator.ts)
- [src-ts/runtime-executables/ems/modules/peak-shaving.ts](../../../../../../src-ts/runtime-executables/ems/modules/peak-shaving.ts)
- [src-ts/runtime-executables/ems/modules/prime-mover-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/prime-mover-control.ts)
- [src-ts/runtime-executables/ems/modules/storage-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts)
- [src-ts/runtime-executables/ems/services/safety-envelope.ts](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts)
- [src-ts/runtime-executables/lib/mesh-coordinator.ts](../../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts)
- [src-ts/runtime-executables/main.ts](../../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`finiteOrNull`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L169) | value | Number, Number.isFinite |
| [`nonNegative`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L175) | value | Math.max, finiteOrNull |
| [`normalizedAge`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L180) | value | Math.max, finiteOrNull |
| [`evaluateMeasurementFreshness`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L186) | input, policy | Math.max, finiteOrNull, normalizedAge |
| [`channelTs`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L223) | channel | finiteOrNull |
| [`channelAge`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L228) | channel | normalizedAge |
| [`channelFresh`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L232) | channel | finiteOrNull |
| [`staleStatus`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L236) | channels | channels.some |
| [`parseBoolean`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L240) | value | – |
| [`buildNvpSnapshotFromRegistry`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L247) | input | Date.now, Math.max, Math.min, Number, String, age, aliveAge, finiteOrNull, parseBoolean, registry.getConnectionStatus, registry.getEntry, registry.getNumber, registry.getRaw, resolveNvpMeasurement (weitere in der Quelle) |
| [`age`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L259) | key | normalizedAge, registry.getAgeMs, registry.getMeasurementAgeMs |
| [`timestamp`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L262) | key | age, finiteOrNull, registry.getMeasurementTimestampMs |
| [`aliveAge`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L267) | key | normalizedAge, registry.getAliveAgeMs |
| [`sample`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L301) | key, value | age, evaluateMeasurementFreshness, finiteOrNull, registry.getEntry, timestamp |
| [`resolveNvpDisplay`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L346) | input | Math.abs, Math.max, Math.min, String, finiteOrNull |
| [`resolveCurrentNvpSnapshot`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L408) | snapshot, now, maxAgeMs | Math.max, String, finiteOrNull, normalizedAge |
| [`resolveNvpMeasurement`](../../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts#L434) | input | Math.abs, Math.max, Math.min, Math.round, channelAge, channelFresh, channelTs, finiteOrNull, nonNegative, staleStatus |
