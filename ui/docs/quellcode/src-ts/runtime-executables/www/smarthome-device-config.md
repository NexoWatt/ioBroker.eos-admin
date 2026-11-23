# src-ts/runtime-executables/www/smarthome-device-config.ts

Bearbeitet die vollständigen Bedienprofile samt manueller Datenpunktzuordnung.

**Daten und Wirkung:** Liest ausschließlich den geschützten lokalen Profilkatalog und

**Bei Änderungen:** Profilwechsel, manuelle Zuordnungen, unbekannte Felder, getrennte

[Originalquelle](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`record`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L48) | value | Array.isArray |
| [`key`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L51) | value | forbidden.has |
| [`fieldKey`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L54) | value | forbidden.has |
| [`dpId`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L57) | value | value.trim |
| [`copyMapping`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L63) | value | Array.isArray, dpId, fieldKey, key, record, result.fields.push, seen.add, seen.has |
| [`validationError`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L83) | value, required | copyMapping, invalidEditors.delete, mapping.fields.some |
| [`profiles`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L92) | value | Array.isArray, record, value.profiles.map |
| [`fieldFor`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L108) | profile, name | fieldKey, name.slice, profile.fields.find |
| [`readCatalog`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L117) | – | Array.isArray, JSON.parse, clearTimeout, controller.abort, decoder.decode, fetch, profiles, reader.read, reader.releaseLock, record, response.body.getReader, setTimeout |
| [`load`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L147) | – | readCatalog |
| [`element`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L151) | tag, className, text | document.createElement |
| [`button`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L157) | label, callback | element, node.addEventListener |
| [`mount`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L163) | container, initial, options | container.appendChild, copyMapping, element, ensureLoaded, root.addEventListener, root.appendChild, status.setAttribute |
| [`commit`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L181) | next | copyMapping, options.onChange |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L187) | all | add.appendChild, all.find, button, content.appendChild, content.replaceChildren, controls.appendChild, day.setAttribute, element, extra.map, field.key.endsWith, fieldFor, fields.appendChild, filterRows.push, invalidEditors.delete (weitere in der Quelle) |
| [`addField`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L245) | name | commit, fieldFor, fieldKey, mapping.fields.some, render |
| [`matches`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L294) | – | – |
| [`matches`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L335) | – | mapping?.fields.find |
| [`start`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L345) | – | load |
| [`ensureLoaded`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L361) | – | start |
| [`loadCustomViews`](../../../../../src-ts/runtime-executables/www/smarthome-device-config.ts#L365) | – | load |
