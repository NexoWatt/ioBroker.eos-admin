# src-ts/runtime-executables/ems/services/storage-zero-write-policy.ts

Bestimmt, wann ein Speicher-Nullsollwert geschrieben beziehungsweise ein unnötiger Wiederholschreibvorgang vermieden wird.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/storage-zero-write-policy.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/storage-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/services/storage-zero-write-policy.ts#L68) | value | Number, Number.isFinite, value.trim |
| [`text`](../../../../../../src-ts/runtime-executables/ems/services/storage-zero-write-policy.ts#L76) | value | String |
| [`reasonImpliesExplicitStop`](../../../../../../src-ts/runtime-executables/ems/services/storage-zero-write-policy.ts#L80) | reasonRaw, sourceRaw | text |
| [`holdDecision`](../../../../../../src-ts/runtime-executables/ems/services/storage-zero-write-policy.ts#L105) | input, lastTargetW, reason, status | – |
| [`decideStorageZeroWrite`](../../../../../../src-ts/runtime-executables/ems/services/storage-zero-write-policy.ts#L125) | input | Math.abs, Math.max, Math.round, Math.sign, finite, holdDecision, reasonImpliesExplicitStop, text |
