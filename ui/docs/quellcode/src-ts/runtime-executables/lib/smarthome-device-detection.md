# src-ts/runtime-executables/lib/smarthome-device-detection.ts

Überführt erkannte Geräte in prüfbare, vollständige Bedienzuordnungen.

**Daten und Wirkung:** Liest TypeDetector-Ausgaben und Objektmetadaten synchron;

**Bei Änderungen:** Pflichtslots, fremde Aliasgeschwister, mehrere Controls,

[Originalquelle](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./smarthome-device-controls` | [src-ts/runtime-executables/lib/smarthome-device-controls.ts](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`row`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L30) | value | Array.isArray |
| [`text`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L31) | value | value.trim |
| [`list`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L32) | value | Array.isArray |
| [`parent`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L33) | id | Math.max, id.lastIndexOf, id.slice |
| [`mandatory`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L34) | state | – |
| [`digest`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L35) | value | JSON.stringify, createHash |
| [`stateObject`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L36) | objects, id | row |
| [`definitions`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L41) | profile | PROFILE_FIELDS.get |
| [`fieldDefinition`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L44) | fields, key | fields.find |
| [`managedIdentity`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L48) | sourceId, control, objects | control.states.filter, primary.every, row, sourceId.startsWith, text |
| [`cleanControls`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L62) | input, objects | SAFE_KEY.test, candidates.find, definitions, digest, list, mandatory, output.push, owners.get, owners.set, parent, row, seen.add, seen.has, siblings.map (weitere in der Quelle) |
| [`getControlIdentity`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L101) | control | core.map, digest, list, row, states.filter, text |
| [`extendSuggestion`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L110) | input, controlInput, objects | LEGACY_TYPES.has, Number.isFinite, cleanControls, controlId.slice, definitions, fieldDefinition, fields.map, fields.some, getControlIdentity, list, managedIdentity, mappings.get, mappings.set, mappings.values (weitere in der Quelle) |
