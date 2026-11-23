# src-ts/runtime-executables/lib/hosted-startup-status.ts

Unterscheidet einen laufenden Start von einer Lizenz-, Übernahme- oder Schreibsperre.

**Daten und Wirkung:** Formt ausschließlich lesende Hoststatus-Snapshots zu begrenzten Diagnosewerten.

**Bei Änderungen:** Keine Freigabe aus Diagnosedaten ableiten; Authentifizierung, CSRF und Schreibschutz bleiben bei den Aufrufern.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/hosted-startup-status.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`record`](../../../../../src-ts/runtime-executables/lib/hosted-startup-status.ts#L36) | value | Array.isArray |
| [`code`](../../../../../src-ts/runtime-executables/lib/hosted-startup-status.ts#L39) | value | – |
| [`state`](../../../../../src-ts/runtime-executables/lib/hosted-startup-status.ts#L42) | value | – |
| [`describeHostedStartup`](../../../../../src-ts/runtime-executables/lib/hosted-startup-status.ts#L49) | startup, readiness, currentPhase | Array.isArray, PHASES.get, PHASES.has, blockers.includes, blockers.push, code, ownership.blockers.slice, record, state |
| [`readHostedStartup`](../../../../../src-ts/runtime-executables/lib/hosted-startup-status.ts#L107) | startup, bridge, currentPhase | Reflect.apply, describeHostedStartup, record |
