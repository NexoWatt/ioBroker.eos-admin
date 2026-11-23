# src-ts/runtime-executables/lib/hosted-runtime-stop.ts

Bestätigt den Stopp der eingebetteten Oberfläche erst nach dem Ende bereits begonnener Initialisierungen.

**Daten und Wirkung:** Wartet begrenzt auf Startversuche und abschließende Bereinigung; eine unklare Beendigung erlaubt keine Rückübergabe an Altregler.

**Bei Änderungen:** Späte Startabschlüsse, fehlerhafte Bereinigung, Zeitlimit und die dauerhafte Sperre nach einem fehlgeschlagenen Stop prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/hosted-runtime-stop.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`HostedRuntimeStopError.constructor`](../../../../../src-ts/runtime-executables/lib/hosted-runtime-stop.ts#L20) | – | super |
| [`createHostedCleanup`](../../../../../src-ts/runtime-executables/lib/hosted-runtime-stop.ts#L25) | – | – |
| [`capture`](../../../../../src-ts/runtime-executables/lib/hosted-runtime-stop.ts#L29) | operation | Promise.resolve, operation, pending.push |
| [`finish`](../../../../../src-ts/runtime-executables/lib/hosted-runtime-stop.ts#L34) | – | Promise.all |
| [`stopHostedRuntime`](../../../../../src-ts/runtime-executables/lib/hosted-runtime-stop.ts#L46) | pendingStarts, cleanup, timeoutMs | Number.isInteger, Promise.allSettled, Promise.reject, attemptCleanup |
| [`attemptCleanup`](../../../../../src-ts/runtime-executables/lib/hosted-runtime-stop.ts#L54) | – | Promise.reject, Promise.resolve, cleanup |
