# src-ts/runtime-executables/www/smarthome-feedback.ts

Zeigt Druck- und Übergaberückmeldungen für die vorhandenen SmartHome-Bedienelemente.

**Daten und Wirkung:** Nutzt den vorhandenen Auth-/CSRF-Fetch für feste lokale Befehlsrouten; stellt keine physischen Gerätebestätigungen oder optimistischen Werte her.

**Bei Änderungen:** Touch-Abbruch, Berechtigungsfehler, Zeitüberschreitungen, Stopp-Reihenfolge, große Timerbestände und begrenzte Ressourcen prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/www/smarthome-feedback.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`record`](../../../../../src-ts/runtime-executables/www/smarthome-feedback.ts#L54) | value | Array.isArray |
| [`validId`](../../../../../src-ts/runtime-executables/www/smarthome-feedback.ts#L57) | value | – |
| [`scheduleCleanup`](../../../../../src-ts/runtime-executables/www/smarthome-feedback.ts#L60) | – | Date.now, Math.max, Math.min, clearTimeout, setTimeout, statuses.values |
| [`renderStatus`](../../../../../src-ts/runtime-executables/www/smarthome-feedback.ts#L68) | node | statuses.get |
| [`refresh`](../../../../../src-ts/runtime-executables/www/smarthome-feedback.ts#L76) | – | Date.now, document.querySelectorAll, renderStatus, scheduleCleanup, statuses.delete |
| [`show`](../../../../../src-ts/runtime-executables/www/smarthome-feedback.ts#L84) | id, requestSequence, state, message | Date.now, refresh, statuses.delete, statuses.get, statuses.keys, statuses.set |
| [`attachStatus`](../../../../../src-ts/runtime-executables/www/smarthome-feedback.ts#L99) | root, id | Array.from, document.createElement, node.setAttribute, renderStatus, root.appendChild, validId |
| [`readResponse`](../../../../../src-ts/runtime-executables/www/smarthome-feedback.ts#L112) | response, limit | JSON.parse, decoder.decode, reader.cancel, reader.read, reader.releaseLock, response.body?.getReader, response.text |
| [`post`](../../../../../src-ts/runtime-executables/www/smarthome-feedback.ts#L139) | endpoint, payload, id | JSON.stringify, Promise.resolve, pending.get, pending.set, record, routes.has, show, validId |
| [`actionTarget`](../../../../../src-ts/runtime-executables/www/smarthome-feedback.ts#L214) | target | element.closest, element.matches, target.closest |
| [`clearPress`](../../../../../src-ts/runtime-executables/www/smarthome-feedback.ts#L222) | cancelled | Date.now |
| [`markPress`](../../../../../src-ts/runtime-executables/www/smarthome-feedback.ts#L227) | target, pointerId, x, y | clearPress |
| [`install`](../../../../../src-ts/runtime-executables/www/smarthome-feedback.ts#L232) | – | document.addEventListener, window.addEventListener |
