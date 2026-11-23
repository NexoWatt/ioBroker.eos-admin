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
| `node:perf_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./smarthome-device-controls` | [src-ts/runtime-executables/lib/smarthome-device-controls.ts](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`DetectionError.constructor`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L32) | code | super |
| [`detectionNow`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L34) | – | performance.now |
| [`detectionSnapshot`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L38) | input | Array.isArray, Object.keys, keys.sort |
| [`DetectionScan.constructor`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L52) | options | this.now |
| [`DetectionScan.now`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L55) | – | detectionNow, this.options.now |
| [`DetectionScan.check`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L57) | kind, count | this.options.stopping |
| [`DetectionScan.read`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L63) | pending | pending.catch, this.check |
| [`failed`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L72) | error | cleanup, reject |
| [`aborted`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L75) | – | failed |
| [`cleanup`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L78) | – | clearTimeout, signal?.removeEventListener |
| [`row`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L92) | value | Array.isArray |
| [`text`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L93) | value | value.trim |
| [`list`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L94) | value | Array.isArray |
| [`parent`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L95) | id | Math.max, id.lastIndexOf, id.slice |
| [`mandatory`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L96) | state | – |
| [`digest`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L97) | value | JSON.stringify, createHash |
| [`stateObject`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L98) | objects, id | row |
| [`definitions`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L103) | profile | PROFILE_FIELDS.get |
| [`fieldDefinition`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L106) | fields, key | fields.find |
| [`managedIdentity`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L110) | sourceId, control, objects | control.states.filter, primary.every, row, sourceId.startsWith, text |
| [`cleanControls`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L124) | input, objects | SAFE_KEY.test, candidates.find, definitions, digest, list, mandatory, output.push, owners.get, owners.set, parent, row, seen.add, seen.has, siblings.map (weitere in der Quelle) |
| [`getControlIdentity`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L163) | control | core.map, digest, list, row, states.filter, text |
| [`extendSuggestion`](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts#L172) | input, controlInput, objects | LEGACY_TYPES.has, Number.isFinite, cleanControls, controlId.slice, definitions, fieldDefinition, fields.map, fields.some, getControlIdentity, list, managedIdentity, mappings.get, mappings.set, mappings.values (weitere in der Quelle) |
