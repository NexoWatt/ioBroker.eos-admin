# src-ts/runtime-executables/www/tariff-display.ts

Stellt echte Tarifintervalle und bestätigte Preise im Dashboard dar.

**Daten und Wirkung:** Liest nur öffentliche Preisstates und Quellmetadaten; die

**Bei Änderungen:** Viertelstunden, Sommerzeit, Null-/Negativpreise, Einheiten,

[Originalquelle](../../../../../src-ts/runtime-executables/www/tariff-display.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`rec`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L19) | value | Array.isArray |
| [`own`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L20) | value, key | Object.hasOwn, Reflect.get |
| [`finite`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L21) | value | Number, Number.isFinite, value.trim |
| [`euro`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L29) | value, unit | Math.abs, finite, unit.toLowerCase |
| [`format`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L39) | value | finite, number.toFixed |
| [`decoded`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L40) | value | JSON.parse |
| [`time`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L45) | value | Date.parse, Number.isFinite |
| [`parseCurve`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L50) | raw | Array.isArray, decoded, euro, pending.map, pending.push, pending.sort, rec, time |
| [`dayRange`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L74) | now | end.getDate, end.getTime, end.setDate, start.getTime, start.setHours |
| [`resolution`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L79) | curve | curve.map |
| [`display`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L86) | snapshot, metadata, now, connected | Date.now, decoded, fresh, price, rec, value |
| [`entry`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L89) | key | own, rec |
| [`value`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L90) | key | entry |
| [`fresh`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L91) | row, maxAge | finite |
| [`price`](../../../../../src-ts/runtime-executables/www/tariff-display.ts#L96) | average | entry, euro, fresh, value |
