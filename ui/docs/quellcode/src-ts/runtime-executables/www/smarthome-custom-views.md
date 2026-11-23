# src-ts/runtime-executables/www/smarthome-custom-views.ts

Rendert lokale Zusatzansichten und begrenzte, ausdrücklich geöffnete Verläufe.

**Daten und Wirkung:** Liest ausschließlich freigegebene Geräteslots; schreibt nur über

**Bei Änderungen:** Null-/Qualitätswerte, Bounds, optionale Slots, Bestätigung, Abbruch,

[Originalquelle](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`record`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L43) | value | Array.isArray |
| [`text`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L44) | value, fallback, limit | value.slice |
| [`finite`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L45) | value | Number.isFinite |
| [`scalar`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L46) | value | finite |
| [`bounded`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L47) | value, fallback, min, max | Math.max, Math.min, finite |
| [`element`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L48) | tag, cls, value | document.createElement |
| [`svg`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L51) | tag, attributes | Object.entries, document.createElementNS, node.setAttribute |
| [`color`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L54) | value, fallback | – |
| [`safeUrl`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L55) | value | value.trim |
| [`model`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L59) | value, forceKind | Array.isArray, fields.has, fields.set, finite, kinds.has, record, scalar, text |
| [`value`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L76) | m, key | m.fields.get |
| [`number`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L77) | m, key | Number.isFinite, value |
| [`display`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L78) | m, key, decimals, unitOverride | f?.options.find, m.fields.get, v.toLocaleString, value |
| [`row`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L84) | root, label, val, cls | element, item.append, root.append |
| [`button`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L87) | label, callback | b.addEventListener, element |
| [`scheduleClock`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L90) | – | Date.now, setTimeout |
| [`unregisterClock`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L97) | node | clearTimeout, clockSubscribers.delete |
| [`solar`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L99) | date, latitude, longitude, rise | Date.UTC, Math.abs, Math.acos, Math.asin, Math.atan, Math.cos, Math.floor, Math.sin, Math.tan, Number.isFinite, date.getUTCDate, date.getUTCFullYear, date.getUTCMonth, norm |
| [`norm`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L102) | v, n | – |
| [`renderClock`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L113) | root, m | clockSubscribers.set, element, root.append, scheduleClock, tick |
| [`tick`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L115) | – | Math.abs, String, clock.append, clock.replaceChildren, element, face.append, finite, fmt.format, part, solar, svg, text, time.format |
| [`part`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L123) | key | Number, parts.find |
| [`detach`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L139) | – | – |
| [`icon`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L141) | name | element, glyphs.get, label.toLowerCase, node.setAttribute, text |
| [`thresholdColor`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L146) | levelInput, raw, min, max, percentage, smooth | Array.isArray, Math.max, Math.min, levels.find, levels.map |
| [`renderGauge`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L159) | root, m | Math.max, Math.min, String, bounded, color, display, element, finite, gauge.append, m.fields.get, m.fields.has, number, root.append, text (weitere in der Quelle) |
| [`renderWind`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L173) | root, m | compass.append, compass.setAttribute, display, element, headings.get, rawDirection.trim, root.append, row, value |
| [`renderPresence`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L179) | root, m | String, element, root.append, root.classList.toggle, value |
| [`renderMarkdown`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L187) | root, settings | Array.isArray, definitions.set, element, host.NW_SH_MARKDOWN.parse, r.identifier.toLowerCase, record, root.append, root.classList.add, text, visit |
| [`visit`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L194) | raw, parent, depth | Array.isArray, Math.round, bounded, children.slice, definitions.get, document.createElement, document.createTextNode, element, finite, link.addEventListener, node.append, parent.append, record, safeUrl (weitere in der Quelle) |
| [`renderIframe`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L226) | root, m, cleanup | Date.now, Math.max, assign, bounded, button, clockSubscribers.set, element, frame.setAttribute, root.append, safeUrl, scheduleClock |
| [`assign`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L229) | – | Date.now, String, host.NW_RUNTIME?.url, target.searchParams.set |
| [`close`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L236) | – | dialog.close, dialog.remove |
| [`tick`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L240) | – | Date.now, Math.max, assign |
| [`detach`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L240) | – | dispose |
| [`legal`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L242) | f, val | Math.abs, Math.round, Number.isFinite, f.options.some |
| [`renderUniversal`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L249) | root, m | Array.isArray, Math.max, Math.min, String, bounded, button, color, display, element, host.NW_SH_FEEDBACK?.attachStatus, icon, indicator.prepend, legal, m.fields.get (weitere in der Quelle) |
| [`send`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L262) | confirmed | host.NW_SH_FEEDBACK.post, legal, window.dispatchEvent |
| [`renderEnergy`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L278) | root, m | Array.isArray, Math.round, battery.append, battery.prepend, bounded, card.append, card.style.setProperty, color, configured.slice, display, element, icon, m.fields.has, number (weitere in der Quelle) |
| [`renderForecast`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L294) | container, device | String, bounded, container.append, day.append, display, element, forecast.append, m.fields.has, model, row, slots.some, text, value |
| [`historyJson`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L312) | response | JSON.parse, decoder.decode, reader.cancel, reader.read, reader.releaseLock, response.body?.getReader, response.text |
| [`renderHistory`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L319) | container, device, key | actions.append, button, container.append, control.addEventListener, controls, element, end.setAttribute, m?.fields.get, model, panel.append, select, settings.append, start.setAttribute, status.setAttribute |
| [`select`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L324) | label, options | control.append, control.setAttribute, element, settings.append, wrapper.append |
| [`readable`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L330) | – | – |
| [`plot`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L331) | – | Math.floor, Math.max, Math.min, Number, bounded, buckets.get, buckets.set, buckets.values, chart.append, chart.replaceChildren, element, graph.append, high.toLocaleString, item.values.push (weitere in der Quelle) |
| [`controls`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L349) | – | actions.querySelectorAll, readable, settings.querySelectorAll |
| [`loadRange`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L350) | since, to | Array.isArray, Date.now, Number.isFinite, Promise.race, String, active.signal.removeEventListener, chart.replaceChildren, clearTimeout, controller?.abort, data.points.slice, plot, readable, record, setTimeout |
| [`update`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L374) | next | chart.replaceChildren, controller?.abort, controls, m?.fields.get, model, readable |
| [`destroy`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L374) | – | controller?.abort, panel.remove |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L376) | container, device | container.append, element, model, paint, views.get, views.set |
| [`cleanup`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L380) | – | dispose, unregisterClock |
| [`paint`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L381) | m | Date.now, JSON.stringify, Math.max, Math.min, bounded, box.append, button, choices.append, choices.setAttribute, cleanup, color, content.append, content.classList.add, content.removeAttribute (weitere in der Quelle) |
| [`update`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L406) | next | model, paint |
| [`destroy`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L406) | – | cleanup, content.remove, history.remove, historyView?.destroy, views.delete |
| [`renderTile`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L409) | device | element, model, render |
| [`update`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L410) | root, device | views.get |
| [`destroy`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L410) | root | views.get |
| [`isInteracting`](../../../../../src-ts/runtime-executables/www/smarthome-custom-views.ts#L411) | root | root.contains, root.querySelectorAll |
