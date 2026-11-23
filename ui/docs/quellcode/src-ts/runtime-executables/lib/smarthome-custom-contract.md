# src-ts/runtime-executables/lib/smarthome-custom-contract.ts

Normalisiert die zehn eingebauten SmartHome-Zusatzansichten und ihre festen Datenfelder.

**Daten und Wirkung:** Rein lokale Validierung ohne Gerätezugriff, Netzwerk, Speicherung oder Fremdcode.

**Bei Änderungen:** unbekannte Schlüssel, Wertebereiche, Energie-Indizes, reine Anzeige und Zuordnungsbindung testen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/lib/smarthome-contract.ts](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts)
- [src-ts/runtime-executables/lib/smarthome-device-api.ts](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts)
- [src-ts/runtime-executables/lib/smarthome-device-controls.ts](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts)
- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`CustomViewError.constructor`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L47) | code | super |
| [`fail`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L68) | code | – |
| [`row`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L69) | value | Array.isArray, Object.getPrototypeOf |
| [`safeGraph`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L75) | value | visit |
| [`visit`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L77) | current, depth | Array.isArray, Number.isFinite, Object.entries, Object.getOwnPropertyDescriptors, fail, row, seen.add, seen.delete, seen.has, visit |
| [`keysOnly`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L96) | value, allowed | Object.keys, fail |
| [`text`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L99) | value, fallback, max, multiline | fail |
| [`bool`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L104) | value, fallback | fail |
| [`number`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L109) | value, fallback, min, max, integer | Number.isFinite, Number.isInteger, fail |
| [`choice`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L114) | value, choices, fallback | choices.find, fail |
| [`color`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L120) | value, fallback | fail, result.toLowerCase, text |
| [`icon`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L125) | value | fail, text |
| [`levels`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L130) | value | Array.isArray, color, fail, keysOnly, number, result.push, result.some, result.sort, row |
| [`energyEntries`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L143) | value | Array.isArray, color, fail, icon, keysOnly, number, result.push, result.some, row, text |
| [`icons`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L156) | value | Array.isArray, bool, choice, color, fail, icon, keysOnly, result.push, result.some, row, text |
| [`browserUrl`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L169) | value | fail, result.startsWith, text |
| [`getCustomProfileId`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L180) | kind | – |
| [`normalizeCustomView`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L183) | value | KEYS.get, KINDS.find, bool, browserUrl, choice, color, energyEntries, fail, icon, icons, keysOnly, levels, number, row (weitere in der Quelle) |
| [`field`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L259) | key, label, types, unit, write | – |
| [`fieldsFor`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L263) | kind | field, fields.push |
| [`getCustomControlProfiles`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L300) | – | KINDS.map |
| [`settingDescriptors`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L313) | kind | KEYS.get, Object.entries, normalizeCustomView |
| [`getCustomViewCatalog`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L374) | – | KINDS.map |
| [`assertCustomViewBindings`](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts#L379) | customInput, controlsInput | Array.isArray, fail, fieldsFor, getCustomProfileId, keysOnly, mapped.add, mapped.has, normalizeCustomView, row, safeGraph, seen.add, seen.has, specs.find |
