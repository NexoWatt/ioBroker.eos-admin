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

**Direkt importiert von:**

- [src-ts/runtime-executables/lib/smarthome-contract.ts](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts)
- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`record`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L46) | value | Array.isArray |
| [`row`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L49) | value | record |
| [`text`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L50) | value, max | value.trim |
| [`list`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L53) | value | Array.isArray |
| [`scalar`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L54) | value | Number.isFinite |
| [`name`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L60) | value | Object.values, row, text |
| [`digest`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L65) | value | JSON.stringify, createHash |
| [`common`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L68) | objects, id | row |
| [`normalizeSmartHomeImportColor`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L72) | value | raw.slice, raw.toLowerCase, text |
| [`safeIcon`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L78) | value | ICON_NAMES.has, raw.toLowerCase, text |
| [`normalizeSmartHomeCameraStateUrl`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L88) | value | value.trim |
| [`isSmartHomeImportField`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L99) | path | keys.some, path.split |
| [`sourceValues`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L106) | proposal | Object.create, Object.entries, add, record, row |
| [`add`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L108) | path, value | Object.keys, isSmartHomeImportField, scalar |
| [`normalizeSmartHomeImportProvenance`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L123) | value | Number, Number.isSafeInteger, Object.create, Object.entries, isSmartHomeImportField, list, row, scalar, text |
| [`resolveSmartHomeAliasIdentity`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L143) | objects, id, direction | common, row, seen.add, seen.has, text |
| [`bindingIds`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L164) | device | Object.entries, ids.add, record, row, text |
| [`semanticIdentity`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L172) | device, objects | bindingIds, id.startsWith, ids.add, resolveSmartHomeAliasIdentity |
| [`memberships`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L184) | objects, ids, prefix | Object.keys, candidates.add, current.lastIndexOf, current.slice |
| [`assignments`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L199) | members, existing, kind | members.flatMap |
| [`enrichSmartHomeImportSuggestion`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L214) | input, objects, config | Object.keys, assignments, bindingIds, common, digest, functions.map, list, memberships, name, normalizeSmartHomeImportColor, notes.push, rooms.map, row, safeIcon (weitere in der Quelle) |
| [`valueAt`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L268) | source, path | path.split, row, scalar |
| [`reconcileSmartHomeImportSuggestions`](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts#L277) | inputs, objects, config | devices.map, inputs.map, list, preferred.find, preferred.map, preferred.push, row, text |
