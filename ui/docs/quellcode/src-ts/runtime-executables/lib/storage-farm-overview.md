# src-ts/runtime-executables/lib/storage-farm-overview.ts

Bildet eine gemeinsame, lesende Farmübersicht aus frischen Messproben

**Daten und Wirkung:** Unvollständige Leistungssummen bleiben null; gültige SoCs

**Bei Änderungen:** Gegenläufige Batterieflüsse, Offline-Mitglieder, fehlende

[Originalquelle](../../../../../src-ts/runtime-executables/lib/storage-farm-overview.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`finite`](../../../../../src-ts/runtime-executables/lib/storage-farm-overview.ts#L38) | value | Number.isFinite |
| [`rounded`](../../../../../src-ts/runtime-executables/lib/storage-farm-overview.ts#L39) | value, digits | Math.round |
| [`coverage`](../../../../../src-ts/runtime-executables/lib/storage-farm-overview.ts#L43) | valid, total | – |
| [`commonSample`](../../../../../src-ts/runtime-executables/lib/storage-farm-overview.ts#L45) | a, b | – |
| [`buildFarmOverview`](../../../../../src-ts/runtime-executables/lib/storage-farm-overview.ts#L46) | members, sources, updatedAt | Math.max, commonSample, coverage, finite, pvSources.get, pvSources.set, pvSources.values, rounded, unique.get, unique.set, unique.values |
