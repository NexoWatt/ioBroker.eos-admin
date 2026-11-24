# src-ts/runtime-executables/www/storagefarm-summary.ts

Zeigt die atomare Speicherfarm-Gesamtübersicht in der Kundenansicht.

**Daten und Wirkung:** Liest ausschließlich storageFarm.overviewJson. Berechnet

**Bei Änderungen:** Nullwerte, Teilabdeckung, Alterung und Verbindungsverlust testen.

[Originalquelle](../../../../../src-ts/runtime-executables/www/storagefarm-summary.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`isRecord`](../../../../../src-ts/runtime-executables/www/storagefarm-summary.ts#L27) | value | Array.isArray |
| [`own`](../../../../../src-ts/runtime-executables/www/storagefarm-summary.ts#L28) | value, key | Object.hasOwn, Reflect.get |
| [`finite`](../../../../../src-ts/runtime-executables/www/storagefarm-summary.ts#L29) | value | Number.isFinite |
| [`count`](../../../../../src-ts/runtime-executables/www/storagefarm-summary.ts#L30) | value | Number.isInteger |
| [`coverage`](../../../../../src-ts/runtime-executables/www/storagefarm-summary.ts#L34) | value | count, isRecord |
| [`decode`](../../../../../src-ts/runtime-executables/www/storagefarm-summary.ts#L40) | snapshot | JSON.parse, count, coverage, finite, isRecord, own |
| [`format`](../../../../../src-ts/runtime-executables/www/storagefarm-summary.ts#L63) | value, unit | value.toLocaleString |
| [`power`](../../../../../src-ts/runtime-executables/www/storagefarm-summary.ts#L66) | value | Math.abs, Math.round, format |
| [`text`](../../../../../src-ts/runtime-executables/www/storagefarm-summary.ts#L72) | id, value | document.getElementById |
| [`card`](../../../../../src-ts/runtime-executables/www/storagefarm-summary.ts#L73) | key, label, value, detail, quality | document.getElementById, text |
| [`render`](../../../../../src-ts/runtime-executables/www/storagefarm-summary.ts#L77) | snapshot, connected, now | Date.now, card, decode, format, power, text |
