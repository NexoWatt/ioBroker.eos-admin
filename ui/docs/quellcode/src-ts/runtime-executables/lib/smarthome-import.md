# src-ts/runtime-executables/lib/smarthome-import.ts

Ergänzt lokale Type-Detector-Vorschläge um Datentypen, Metadaten,

**Daten und Wirkung:** Liest ioBroker-Objekte und bestehende EOS-Konfiguration rein

**Bei Änderungen:** Bool/Text, Aliaszyklen, getrennte Lese-/Schreibquellen,

[Originalquelle](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `@iobroker/type-detector/package.json` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./smarthome-device-controls` | [src-ts/runtime-executables/lib/smarthome-device-controls.ts](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/lib/smarthome-contract.ts](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts)
- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`record`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L52) | value | Array.isArray |
| [`row`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L55) | value | record |
| [`text`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L56) | value, max | value.trim |
| [`list`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L59) | value | Array.isArray |
| [`scalar`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L60) | value | Number.isFinite |
| [`name`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L66) | value | Object.values, row, text |
| [`digest`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L71) | value | JSON.stringify, createHash |
| [`common`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L74) | objects, id | row |
| [`normalizeSmartHomeImportColor`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L78) | value | raw.slice, raw.toLowerCase, text |
| [`safeIcon`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L84) | value | ICON_NAMES.has, raw.toLowerCase, text |
| [`normalizeSmartHomeCameraStateUrl`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L94) | value | value.trim |
| [`isSmartHomeImportField`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L105) | path | keys.some, path.split |
| [`sourceValues`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L114) | proposal | Object.create, Object.entries, add, list, record, row, text |
| [`add`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L116) | path, value | Object.keys, isSmartHomeImportField, scalar |
| [`normalizeSmartHomeImportProvenance`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L140) | value | Number, Number.isSafeInteger, Object.create, Object.entries, isSmartHomeImportField, list, row, scalar, text |
| [`resolveSmartHomeAliasIdentity`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L161) | objects, id, direction | common, row, seen.add, seen.has, text |
| [`bindingIds`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L182) | device | DIAGNOSTIC_KEYS.has, Object.entries, PROFILE_FIELDS.get, definitions.find, ids.add, list, record, row, text |
| [`semanticIdentity`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L200) | device, objects | bindingIds, controls.some, id.startsWith, ids.add, list, resolveSmartHomeAliasIdentity, row |
| [`aliasSemantics`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L217) | device, objects | aliases.sort, bindingIds, digest |
| [`memberships`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L228) | objects, ids, prefix | Object.keys, candidates.add, current.lastIndexOf, current.slice |
| [`assignments`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L243) | members, existing, kind | members.flatMap |
| [`enrichSmartHomeImportSuggestion`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L258) | input, objects, config | Object.keys, aliasSemantics, assignments, bindingIds, common, digest, functions.map, list, memberships, name, normalizeSmartHomeImportColor, notes.push, rooms.map, row (weitere in der Quelle) |
| [`smartHomeImportFieldValue`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L313) | source, path | isSmartHomeImportField, list, path.split, row, scalar |
| [`reconcileSmartHomeImportSuggestions`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L329) | inputs, objects, config | devices.map, inputs.map, list, preferred.find, preferred.map, preferred.push, row, text |
| [`canonicalType`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L350) | value | aliases.get, text |
