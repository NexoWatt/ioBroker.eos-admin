# src-ts/runtime-executables/www/smarthome-setup.ts

Lokale Auswahl, kompakte Listen und transaktionale Formularfenster.

**Daten und Wirkung:** Textbasierte Darstellung sowie begrenztes Lesen der Erkennung.

**Bei Änderungen:** Fokus, Abbruch, Entwurfsgrenzen, Antwortlimits und Pagination prüfen. */

[Originalquelle](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`record`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L42) | value | Array.isArray |
| [`text`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L43) | value, fallback | value.slice |
| [`rows`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L44) | value | Array.isArray, value.filter |
| [`id`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L45) | value | – |
| [`cloneConfig`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L46) | value | JSON.parse, JSON.stringify, Object.entries, record, seen.add, seen.has, stack.pop, stack.push |
| [`el`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L64) | tag, className, content | document.createElement |
| [`button`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L65) | label, callback, primary | el, node.addEventListener |
| [`selectField`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L66) | label, options, value, change | el, field.appendChild, select.addEventListener, select.appendChild |
| [`name`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L71) | row | text |
| [`typeLabel`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L73) | value | Object.hasOwn, text |
| [`mountSetup`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L74) | container, options | button, container.appendChild, container.replaceChildren, el, filters.appendChild, floorRow.appendChild, floors.map, floors.some, heading.appendChild, project.querySelector, record, render, roomRow.appendChild, roomSet (weitere in der Quelle) |
| [`roomSet`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L78) | – | rooms.filter |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L98) | – | button, devices.filter, el, id, info.appendChild, list.appendChild, list.replaceChildren, name, rooms.find, row.appendChild, search.value.trim, typeLabel |
| [`mountDetection`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L115) | container, options | Array.from, actions.appendChild, alias.addEventListener, aliases.appendChild, button, configured.appendChild, container.appendChild, container.replaceChildren, el, render, rooms.map, rows, search.addEventListener, search.setAttribute (weitere in der Quelle) |
| [`eligible`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L117) | row | – |
| [`visible`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L132) | – | search.value.trim, suggestions.filter |
| [`refreshActions`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L136) | – | – |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L137) | – | Math.ceil, Math.max, Math.min, button, check.addEventListener, check.setAttribute, el, eligible, id, info.appendChild, list.appendChild, list.replaceChildren, name, pagination.appendChild (weitere in der Quelle) |
| [`openDialog`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L158) | options | button, cleanup, dialog.appendChild, dialog.focus, dialog.setAttribute, document.addEventListener, document.body.appendChild, el, footer.appendChild, header.appendChild, options.render, overlay.appendChild, status.setAttribute |
| [`nested`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L167) | – | Array.from, document.querySelectorAll |
| [`visibleInputs`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L168) | root | Array.from, root.querySelectorAll |
| [`cleanup`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L179) | cancelled | document.getElementById, document.removeEventListener, options.beforeClose, options.onCancel, overlay.remove, trigger.focus |
| [`keydown`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L197) | event | cleanup, event.preventDefault, event.stopPropagation, first.focus, last.focus, nested, nodes.at, scope.contains, scope.focus, visibleInputs |
| [`focusin`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L205) | event | child?.contains, dialog.contains, dialog.focus, nested |
| [`close`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L206) | – | cleanup |
| [`isOpen`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L206) | – | – |
| [`setError`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L206) | message | – |
| [`refresh`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L206) | – | Array.from, body.querySelectorAll, cleanup, fields.findIndex, options.render |
| [`readDetection`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L211) | force | Array.isArray, JSON.parse, Number, Number.isFinite, clearTimeout, controller.abort, decoder.decode, fetch, reader.cancel, reader.read, reader.releaseLock, record, response.body.getReader, response.headers.get (weitere in der Quelle) |
| [`hasDialog`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L229) | – | – |
