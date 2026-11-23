# src-ts/runtime-executables/www/smarthome-alias-config.ts

Übergibt bewusst ausgewählte Geräte an die geschützte Alias-Anlage.

**Daten und Wirkung:** Ein begrenzter POST legt Alias-Objekte an oder verwendet sie wieder.

**Bei Änderungen:** Teilfehler, Berechtigungen, Zeitbudget, große Antworten und parallele

[Originalquelle](../../../../../src-ts/runtime-executables/www/smarthome-alias-config.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

Kein direkter Import innerhalb des erfassten Quellbereichs. Mögliche HTML-, Adapter-, Build- oder dynamische Einstiege sind separat zu prüfen.

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`record`](../../../../../src-ts/runtime-executables/www/smarthome-alias-config.ts#L24) | value | Array.isArray |
| [`inspect`](../../../../../src-ts/runtime-executables/www/smarthome-alias-config.ts#L25) | value, depth, budget | Array.isArray, Number.isFinite, Object.entries, Object.keys, inspect, record, value.forEach |
| [`clone`](../../../../../src-ts/runtime-executables/www/smarthome-alias-config.ts#L39) | value | JSON.parse, JSON.stringify, inspect |
| [`canCreate`](../../../../../src-ts/runtime-executables/www/smarthome-alias-config.ts#L40) | – | host.NW_AUTH?.hasCapability |
| [`validateDevices`](../../../../../src-ts/runtime-executables/www/smarthome-alias-config.ts#L41) | value | Array.isArray, value.map |
| [`ids`](../../../../../src-ts/runtime-executables/www/smarthome-alias-config.ts#L55) | value | Array.isArray, value.some |
| [`failure`](../../../../../src-ts/runtime-executables/www/smarthome-alias-config.ts#L59) | status, payload | Array.isArray, record |
| [`create`](../../../../../src-ts/runtime-executables/www/smarthome-alias-config.ts#L67) | input | JSON.parse, JSON.stringify, canCreate, clearTimeout, controller.abort, decoder.decode, failure, fetch, ids, inspect, originals.map, reader.read, reader.releaseLock, record (weitere in der Quelle) |
