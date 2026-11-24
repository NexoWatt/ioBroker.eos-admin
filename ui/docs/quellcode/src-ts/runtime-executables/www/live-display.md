# src-ts/runtime-executables/www/live-display.ts

Validiert ausschließlich sichtbare LIVE-Messwerte und Betriebsstatus.

**Daten und Wirkung:** Liest lokale Snapshot-Werte ohne API-/Schreibwirkung. Fehlend,

**Bei Änderungen:** Null, konstant bestätigte Werte, Zukunftszeit und Ausfälle prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/www/live-display.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`record`](../../../../../src-ts/runtime-executables/www/live-display.ts#L17) | value | Array.isArray |
| [`entry`](../../../../../src-ts/runtime-executables/www/live-display.ts#L18) | snapshot, key | Object.hasOwn, Reflect.get, record |
| [`number`](../../../../../src-ts/runtime-executables/www/live-display.ts#L23) | value | Number, Number.isFinite, text.charAt, value.trim |
| [`current`](../../../../../src-ts/runtime-executables/www/live-display.ts#L40) | row, now, maxAge, online | number |
| [`read`](../../../../../src-ts/runtime-executables/www/live-display.ts#L44) | snapshot, key, now, maxAge, online | current, entry, number |
| [`farm`](../../../../../src-ts/runtime-executables/www/live-display.ts#L48) | snapshot, now, online | JSON.parse, Number.isInteger, current, entry, number, record |
| [`status`](../../../../../src-ts/runtime-executables/www/live-display.ts#L67) | snapshot, online, now | current, entry, read |
