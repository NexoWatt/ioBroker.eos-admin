# src-ts/runtime-executables/www/storagefarm-dispatch.ts

Trennt Farm-Anforderung, Befehlsannahme und tatsächliche Messung.

**Daten und Wirkung:** Liest vorhandene Diagnose-Snapshots; keine Konfigurations-,

**Bei Änderungen:** Zuordnungsschlüssel, veraltete JSON-Zeitstempel, Teilannahme,

[Originalquelle](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`record`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L18) | value | Array.isArray |
| [`number`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L19) | value | Number.isFinite |
| [`text`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L20) | value, max | value.trim |
| [`entry`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L21) | snapshot, key | Object.hasOwn, Reflect.get, record |
| [`fresh`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L25) | ts, now | number |
| [`value`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L28) | snapshot, key, connected, now | entry, fresh |
| [`json`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L31) | snapshot, key, connected, now | JSON.parse, value |
| [`rows`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L36) | snapshot, connected, now | Array.isArray, Date.now, data.filter, json |
| [`dispatch`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L40) | snapshot, connected, now | fresh, json, record |
| [`codes`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L44) | value | Array.isArray, value.slice |
| [`reason`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L66) | code | labels.get |
| [`power`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L67) | input | Math.abs, Math.round, number |
| [`signed`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L71) | input | number, power |
| [`capability`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L74) | input, direction | number, power, reason, record, text |
| [`set`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L83) | id, content | document.getElementById |
| [`status`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L84) | row | charge.map, codes, common.map, discharge.map, record |
| [`match`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L96) | row, members, results | members.filter, results.filter, results.some, same.at, text |
| [`line`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L109) | parent, label, content | document.createElement, item.append, parent.append |
| [`memberDiagnostics`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L113) | snapshot, connected, now, diag | Array.from, Array.isArray, Object.entries, Object.hasOwn, String, capability, codes, container.append, container.replaceChildren, detail.append, detail.setAttribute, diag.results.filter, document.createElement, document.getElementById (weitere in der Quelle) |
| [`render`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L171) | snapshot, connected, now | Date.now, Math.abs, Math.sign, Number.isInteger, String, dispatch, fresh, json, memberDiagnostics, number, read, reason, record, set (weitere in der Quelle) |
| [`read`](../../../../../src-ts/runtime-executables/www/storagefarm-dispatch.ts#L173) | key | value |
