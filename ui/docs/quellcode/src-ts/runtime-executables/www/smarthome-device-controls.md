# src-ts/runtime-executables/www/smarthome-device-controls.ts

Stellt alle vom EOS-Server freigegebenen Gerätefunktionen lokal dar.

**Daten und Wirkung:** Prüft das Anzeige-DTO, sendet nur Geräteschlüssel und explizite

**Bei Änderungen:** Unbekannte Werte, Nur-Lesen, Bestätigung, Zahlen-/Enum-Grenzen,

[Originalquelle](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`record`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L68) | value | Array.isArray |
| [`text`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L71) | value, fallback, limit | value.slice |
| [`scalar`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L74) | value | Number.isFinite |
| [`finite`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L77) | value | Number.isFinite |
| [`normalizeField`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L80) | value | Array.isArray, String, aliases.get, finite, options.push, record, scalar, text, value.options.slice, volumeSteps.has |
| [`normalize`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L109) | value | Array.isArray, controls.fields.slice, controls.profile.slice, field.key.toUpperCase, fields.push, keys.add, keys.has, normalizeField, record, text, volumeSteps.has |
| [`element`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L120) | tag, className, label | document.createElement |
| [`button`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L123) | label, callback | element, node.addEventListener |
| [`lazySection`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L128) | details, key, populate | details.addEventListener, expandedSections.has, open |
| [`open`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L130) | – | expandedSections.add, expandedSections.delete, expandedSections.values, populate |
| [`current`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L139) | field | String, field.options.find |
| [`legal`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L147) | field, value | Math.abs, Math.round, Number.isFinite, field.options.some |
| [`removeConfirmation`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L159) | – | confirmation?.remove |
| [`send`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L162) | device, field, value, row, confirmed | host.NW_SH_FEEDBACK.post, legal, row.querySelector, window.dispatchEvent |
| [`request`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L177) | device, field, value, row | accept.focus, button, choiceLabel, element, legal, panel.append, panel.setAttribute, removeConfirmation, row.append, send |
| [`choiceLabel`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L187) | device, field, value | String, field.options.find |
| [`action`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L196) | device, field, value, label, row | button, legal |
| [`numeric`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L201) | device, field, row | Math.max, Math.min, Number, String, button, current, element, group.append, group.prepend, host.NW_SH_TOUCH?.bindRange, input.addEventListener, input.setAttribute, input.style.setProperty |
| [`commit`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L213) | – | Number, input.value.trim, legal, request, row.querySelector |
| [`remote`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L229) | device, field, row | JSON.stringify, String, action, element, extraOptions.push, group.append, group.setAttribute, lazySection, more.append, pad.append, remoteKeys.get, usedPositions.add, usedPositions.has, volumeSteps.has |
| [`editor`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L247) | device, field, row | String, action, button, choiceLabel, element, field.options.findIndex, field.options.forEach, group.append, group.setAttribute, input.setAttribute, node.classList.add, node.setAttribute, numeric, remote (weitere in der Quelle) |
| [`renderField`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L282) | device, field | JSON.stringify, Math.floor, String, button, cached.view.update, current, details.append, editor, element, head.append, historyPanels.get, historyPanels.has, lazySection, message.setAttribute (weitere in der Quelle) |
| [`runtimeDTO`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L333) | device | – |
| [`priority`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L336) | field | – |
| [`mediaPanel`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L342) | device | action, command, controls.append, element, find, panel.append, status.setAttribute, volumeMemory.delete, volumeMemory.get, volumeMemory.keys, volumeMemory.set |
| [`find`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L344) | key | device.fields.find |
| [`keyChoice`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L354) | keys | keyField?.options.find |
| [`command`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L355) | key, label, fallbacks | action, controls.append, find, keyChoice |
| [`summaryPanel`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L378) | device | Object.hasOwn, current, device.fields.find, element, item.append, keys.map, summary.append, summary.setAttribute |
| [`imagePanel`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L401) | device | device.fields.find, element, panel.append |
| [`rasterData`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L414) | value | atob, b, bytes.slice, bytes.startsWith |
| [`b`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L419) | index | bytes.charCodeAt |
| [`hex`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L446) | rgb | rgb.map |
| [`rgbFromHex`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L449) | value | Number.parseInt, value.slice |
| [`hsv`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L453) | rgb | Math.max, Math.min, rgb.map |
| [`rgbFromHsv`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L459) | hue, saturation | Math.abs, Math.max, Math.min, parts.map |
| [`xy`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L466) | rgb | rgb.map |
| [`rgbFromXy`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L473) | x, y | values.map |
| [`rgbFromKelvin`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L479) | kelvin | Math.log, Number.isFinite |
| [`proportion`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L486) | field | Math.max, Math.min |
| [`scale`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L490) | field, fraction | Math.max, Math.min, Math.round, Number, legal, value.toFixed |
| [`colorWrites`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L497) | device, rgb | entry.value.slice, entry.value.startsWith, entry.value.trim, field, hex, hsv, legal, pattern.test, scale, writes.every, writes.push, x.toFixed, xy, y.toFixed |
| [`field`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L498) | key | device.fields.find |
| [`reportedColor`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L519) | device | Number.isFinite, channels.every, ct.unit.toLowerCase, field, hex, proportion, raw.replace, rgbFromHsv, rgbFromKelvin, rgbFromXy, value.replace |
| [`field`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L520) | key | device.fields.find |
| [`sendColor`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L542) | device, values, panel | host.NW_SH_FEEDBACK.post, panel.querySelector, window.dispatchEvent |
| [`colorPanel`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L552) | device | button, colorWrites, device.fields.some, element, panel.append, picker.setAttribute, reportedColor, status.setAttribute, swatch.setAttribute |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L571) | device, compact | JSON.stringify, Math.max, colorPanel, element, extra.append, fields.filter, fields.slice, heading.append, host.NW_SH_CUSTOM_VIEWS?.renderForecast, host.NW_SH_DEVICE_CATEGORIES?.render, host.NW_SH_FEEDBACK?.attachStatus, imagePanel, lazySection, main.append (weitere in der Quelle) |
| [`isInteracting`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L606) | – | focused.closest, focused.matches, host.NW_SH_TOUCH?.isInteracting |
| [`renderTile`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L614) | value | normalize, render |
| [`renderDetails`](../../../../../src-ts/runtime-executables/www/smarthome-device-controls.ts#L615) | root, value | normalize, render, root.append, root.replaceChildren |
