# src-ts/runtime-executables/www/smarthome-custom-config.ts

Konfiguriert die zehn eingebauten Zusatzansichten über den lokalen Katalog.

**Daten und Wirkung:** Ändert ausschließlich den SmartHome-Entwurf. Darstellung und

**Bei Änderungen:** Ansichtswechsel, skalare Befehlstypen, Grenzwerte, sichere URLs,

[Originalquelle](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`record`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L45) | value | Array.isArray |
| [`clone`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L48) | value, depth | Array.isArray, Number.isFinite, Object.entries, Object.keys, clone, forbidden.has, record, value.map |
| [`view`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L64) | value | clone, kinds.has, record |
| [`controls`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L71) | value | Array.isArray, fields.push, forbidden.has, record, seen.add, seen.has |
| [`parseCatalog`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L90) | value | Array.isArray, value.map |
| [`validUrl`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L125) | value | value.startsWith |
| [`validationError`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L131) | input, binding | Array.isArray, Object.keys, bound.has, catalog.find, controls, invalidEditors.delete, mapped.fields.filter, record, validUrl, view |
| [`element`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L157) | tag, className, text | document.createElement |
| [`button`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L160) | text, callback | element, node.addEventListener |
| [`mount`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L163) | container, initial, options | container.appendChild, element, ensureLoaded, root.addEventListener, root.appendChild, status.setAttribute, view |
| [`error`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L172) | key, message | errors.add, errors.delete, invalidEditors.add, invalidEditors.delete |
| [`update`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L176) | key, value | clone, options.onChange, view |
| [`basicInput`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L184) | setting, value, change, errorKey | String, element, field.appendChild, input.addEventListener, input.appendChild |
| [`scalarInput`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L224) | setting, value | element, group.appendChild, rebuild, select.addEventListener, select.appendChild, select.setAttribute |
| [`rebuild`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L231) | – | basicInput, editor.replaceChildren |
| [`listInput`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L238) | setting, value | Array.isArray, button, element, group.appendChild, renderRows, value.filter |
| [`commit`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L243) | – | update |
| [`renderRows`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L244) | – | entries.forEach, errors.delete, invalidEditors.delete, key.startsWith, rows.replaceChildren |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L282) | all | all.find, basicInput, button, content.appendChild, content.replaceChildren, element, errors.clear, invalidEditors.delete, listInput, matches, scalarInput, select.addEventListener, select.appendChild, select.setAttribute (weitere in der Quelle) |
| [`matches`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L308) | – | controls, options.getControls |
| [`start`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L325) | – | host.NW_SH_DEVICE_CONFIG.loadCustomViews |
| [`ensureLoaded`](../../../../../src-ts/runtime-executables/www/smarthome-custom-config.ts#L338) | – | start |
