# src-ts/runtime-executables/www/smarthome-setup.ts

Lokale Auswahl, kompakte Listen, Aktionsmenüs und transaktionale Formularfenster.

**Daten und Wirkung:** Textbasierte Darstellung sowie begrenztes Lesen der Erkennung.

**Bei Änderungen:** Menüebenen, Fokus, Abbruch, Entwurfsgrenzen, Antwortlimits und Pagination prüfen. */

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
| [`bindActionMenus`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L48) | – | Array.from, document.addEventListener, document.querySelectorAll, menu.addEventListener |
| [`closeOthers`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L51) | keep | – |
| [`record`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L74) | value | Array.isArray |
| [`text`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L75) | value, fallback | value.slice |
| [`rows`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L76) | value | Array.isArray, value.filter |
| [`id`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L77) | value | – |
| [`cloneConfig`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L78) | value | JSON.parse, JSON.stringify, Object.entries, record, seen.add, seen.has, stack.pop, stack.push |
| [`el`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L96) | tag, className, content | document.createElement |
| [`button`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L97) | label, callback, primary | el, node.addEventListener |
| [`selectField`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L98) | label, options, value, change | el, field.appendChild, select.addEventListener, select.appendChild |
| [`name`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L103) | row | text |
| [`typeLabel`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L105) | value | Object.hasOwn, text |
| [`mountSetup`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L106) | container, options | button, container.appendChild, container.replaceChildren, el, filters.appendChild, floorRow.appendChild, floors.map, floors.some, heading.appendChild, project.querySelector, record, render, roomRow.appendChild, roomSet (weitere in der Quelle) |
| [`roomSet`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L110) | – | rooms.filter |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L130) | – | button, devices.filter, el, id, info.appendChild, list.appendChild, list.replaceChildren, name, rooms.find, row.appendChild, search.value.trim, typeLabel |
| [`mountDetection`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L147) | container, options | Array.from, actions.appendChild, alias.addEventListener, aliases.appendChild, button, configured.appendChild, container.appendChild, container.replaceChildren, el, render, rooms.map, rows, search.addEventListener, search.setAttribute (weitere in der Quelle) |
| [`eligible`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L149) | row | – |
| [`visible`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L164) | – | search.value.trim, suggestions.filter |
| [`refreshActions`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L168) | – | – |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L169) | – | Math.ceil, Math.max, Math.min, button, check.addEventListener, check.setAttribute, el, eligible, id, info.appendChild, list.appendChild, list.replaceChildren, name, pagination.appendChild (weitere in der Quelle) |
| [`openDialog`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L190) | options | button, cleanup, dialog.appendChild, dialog.focus, dialog.setAttribute, document.addEventListener, document.body.appendChild, el, footer.appendChild, header.appendChild, options.render, overlay.appendChild, status.setAttribute |
| [`nested`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L199) | – | Array.from, document.querySelectorAll |
| [`visibleInputs`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L200) | root | Array.from, root.querySelectorAll |
| [`cleanup`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L211) | cancelled | document.getElementById, document.removeEventListener, options.beforeClose, options.onCancel, overlay.remove, trigger.focus |
| [`keydown`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L229) | event | cleanup, event.preventDefault, event.stopPropagation, first.focus, last.focus, nested, nodes.at, scope.contains, scope.focus, visibleInputs |
| [`focusin`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L237) | event | child?.contains, dialog.contains, dialog.focus, nested |
| [`close`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L238) | – | cleanup |
| [`isOpen`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L238) | – | – |
| [`setError`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L238) | message | – |
| [`refresh`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L238) | – | Array.from, body.querySelectorAll, cleanup, fields.findIndex, options.render |
| [`readDetection`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L243) | force | Array.isArray, JSON.parse, Number, Number.isFinite, clearTimeout, controller.abort, decoder.decode, fetch, reader.cancel, reader.read, reader.releaseLock, record, response.body.getReader, response.headers.get (weitere in der Quelle) |
| [`hasDialog`](../../../../../src-ts/runtime-executables/www/smarthome-setup.ts#L261) | – | – |
