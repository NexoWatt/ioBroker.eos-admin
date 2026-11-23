# src-ts/runtime-executables/www/smarthome-device-categories.ts

Ordnet geprüfte Gerätefelder in eigenständige Bedienflächen je Kategorie.

**Daten und Wirkung:** Verwendet ausschließlich vom Haupt-Renderer gelieferte Feld-DOM-

**Bei Änderungen:** Alle 51 Referenzkategorien, eindeutige Feldabdeckung, getrennte

[Originalquelle](../../../../../src-ts/runtime-executables/www/smarthome-device-categories.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`group`](../../../../../src-ts/runtime-executables/www/smarthome-device-categories.ts#L32) | id, label, layout, keys | – |
| [`define`](../../../../../src-ts/runtime-executables/www/smarthome-device-categories.ts#L36) | ids, title, icon, accent, primary, secondary | definitions.set |
| [`record`](../../../../../src-ts/runtime-executables/www/smarthome-device-categories.ts#L83) | value | Array.isArray |
| [`plan`](../../../../../src-ts/runtime-executables/www/smarthome-device-categories.ts#L84) | profile, keys | assign, definitions.get, group, keys.slice, secondary.push |
| [`assign`](../../../../../src-ts/runtime-executables/www/smarthome-device-categories.ts#L87) | groups | groups.flatMap |
| [`element`](../../../../../src-ts/runtime-executables/www/smarthome-device-categories.ts#L92) | tag, cls, text | document.createElement |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome-device-categories.ts#L93) | container, raw, renderField, compact | Array.isArray, String, container.append, controls.fields.slice, details.addEventListener, details.append, device.id.slice, element, expanded.has, fields.flatMap, fill, group, layout.primary.unshift, layout.secondary.flatMap (weitere in der Quelle) |
| [`section`](../../../../../src-ts/runtime-executables/www/smarthome-device-categories.ts#L101) | g | element, grid.append, renderField, rendered.add, rendered.has, section.append |
| [`fill`](../../../../../src-ts/runtime-executables/www/smarthome-device-categories.ts#L110) | – | details.append, section |
| [`profiles`](../../../../../src-ts/runtime-executables/www/smarthome-device-categories.ts#L117) | – | definitions.keys |
