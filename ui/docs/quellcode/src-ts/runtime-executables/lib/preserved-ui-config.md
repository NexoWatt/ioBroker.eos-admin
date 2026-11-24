# src-ts/runtime-executables/lib/preserved-ui-config.ts

Prüft bekannte Bestandskonfigurationen vor einer UI-Übernahme und

**Daten und Wirkung:** Nur berechtigte DB-Leseoperationen, feste State-IDs,

**Bei Änderungen:** Fehlende optionale States von verlorenen vorhandenen Daten

[Originalquelle](../../../../../src-ts/runtime-executables/lib/preserved-ui-config.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`record`](../../../../../src-ts/runtime-executables/lib/preserved-ui-config.ts#L24) | value | Array.isArray |
| [`failure`](../../../../../src-ts/runtime-executables/lib/preserved-ui-config.ts#L27) | code | Object.assign |
| [`parseState`](../../../../../src-ts/runtime-executables/lib/preserved-ui-config.ts#L31) | id, object, state, required | Buffer.byteLength, JSON.parse, arrayFields, failure, record, state.val.trim, visit |
| [`visit`](../../../../../src-ts/runtime-executables/lib/preserved-ui-config.ts#L44) | value, depth | Object.entries, failure, visit |
| [`arrayFields`](../../../../../src-ts/runtime-executables/lib/preserved-ui-config.ts#L53) | value, fields | Array.isArray, failure |
| [`parseInstallerConfigState`](../../../../../src-ts/runtime-executables/lib/preserved-ui-config.ts#L72) | state | failure, parseState |
| [`readPreservedUiStates`](../../../../../src-ts/runtime-executables/lib/preserved-ui-config.ts#L80) | reader, namespace, requiredStates | Array.isArray, Object.fromEntries, PRESERVED_UI_STATE_IDS.map, Promise.all, Promise.race, clearTimeout, failure, requiredStates.some, rows.filter |
