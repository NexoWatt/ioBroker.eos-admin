# src-ts/runtime-executables/www/smarthome-layout-editor.ts

Durchsuchbare Geräteliste und zugängliche Kachelanordnung pro Raum.

**Daten und Wirkung:** Liefert ausschließlich geprüfte ID-/order-Patches für den lokalen

**Bei Änderungen:** Verschieben, Tauschen, unbekannte IDs, Raumgrenzen, Filter,

[Originalquelle](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`record`](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts#L34) | value | Array.isArray |
| [`identifier`](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts#L35) | value | – |
| [`devices`](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts#L36) | value | Array.isArray, value.map |
| [`sorted`](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts#L52) | items | items.slice |
| [`reorder`](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts#L53) | input, sourceId, targetId, operation | all.filter, all.find, devices, group.findIndex, group.map, group.slice, next.every, next.findIndex, next.map, next.splice, oldOrders.every, sorted |
| [`names`](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts#L69) | value | Array.isArray, identifier, item.name.slice, map.set, record |
| [`element`](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts#L75) | tag, className, text | document.createElement |
| [`button`](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts#L78) | label, callback | element, node.addEventListener |
| [`mount`](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts#L81) | container, options | all.map, container.appendChild, container.replaceChildren, devices, element, filter.addEventListener, filter.appendChild, filter.setAttribute, groups.includes, groups.map, groups.sort, names, render, root.appendChild (weitere in der Quelle) |
| [`groupName`](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts#L94) | group | floorNames.get, group.slice, group.startsWith, roomNames.get |
| [`focusSelected`](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts#L106) | id | Array.from, list.querySelectorAll, selected?.focus |
| [`apply`](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts#L110) | source, target, operation | all.map, focusSelected, options.onChange, patches.map, render, reorder |
| [`renderSelection`](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts#L124) | – | all.filter, all.find, button, dragLabel.appendChild, element, mode.addEventListener, mode.appendChild, selection.appendChild, selection.replaceChildren, sorted, target.appendChild, target.setAttribute |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome-layout-editor.ts#L143) | – | actions.appendChild, after.setAttribute, all.filter, before.setAttribute, button, card.addEventListener, card.appendChild, complete.filter, complete.findIndex, element, grid.appendChild, groupName, handle.addEventListener, handle.setAttribute (weitere in der Quelle) |
