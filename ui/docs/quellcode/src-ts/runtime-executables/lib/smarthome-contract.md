# src-ts/runtime-executables/lib/smarthome-contract.ts

Normalisiert und prüft die gemeinsame SmartHome-Konfiguration für Backend und Bedienoberfläche.

**Daten und Wirkung:** Normalisiert lokale Gerätekonfiguration und Importvorschläge,

**Bei Änderungen:** Historische Lese-/Schreibverträge erhalten; Boolean/Text,

[Originalquelle](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./smarthome-import` | [src-ts/runtime-executables/lib/smarthome-import.ts](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`isPlain`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L117) | value | Array.isArray |
| [`str`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L121) | value, max | String, out.slice |
| [`finite`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L127) | value, fallback, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`nullableId`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L135) | value | str |
| [`cleanIoPair`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L140) | source, fallbackRead, fallbackWrite | isPlain, nullableId |
| [`normalizeTemplateContract`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L147) | templateId, type, behavior, capabilities, io, ui | Object.prototype.hasOwnProperty.call, finite, isPlain, str |
| [`normalizeSmartHomeDevice`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L195) | input, index | Array.isArray, Number, Number.isFinite, Object.keys, Object.prototype.hasOwnProperty.call, SUPPORTED_TYPES.has, cleanIoPair, finite, isPlain, normalizeSmartHomeImportColor, normalizeSmartHomeImportProvenance, normalizeTemplateContract, nullableId, str (weitere in der Quelle) |
| [`normalizeSceneActionKind`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L489) | value | str |
| [`normalizeSmartHomeScene`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L514) | input, index | Array.isArray, Number, Number.isFinite, isPlain, nullableId, str |
| [`sceneActionTargetAvailable`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L545) | dev, kind, value | normalizeSceneActionKind, str, value.trim |
| [`normalizeSmartHomeConfig`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L592) | input | Array.isArray, Number, Number.isFinite, isPlain |
| [`validateSmartHomeConfig`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L607) | input | Array.from, Array.isArray, config.devices.forEach, config.devices.map, config.scenes.forEach, normalizeSceneActionKind, normalizeSmartHomeConfig, sceneAdjacency.get, sceneAdjacency.has, sceneAdjacency.keys, sceneById.keys, str, visitScene |
| [`push`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L612) | target, code, message, path, deviceId | target.push |
| [`visitScene`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L709) | id | cycle.join, push, sceneAdjacency.get, sceneStack.indexOf, sceneStack.pop, sceneStack.push, sceneStack.slice, sceneVisited.add, sceneVisited.has, sceneVisiting.add, sceneVisiting.delete, sceneVisiting.has, visitScene |
| [`collectIds`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L729) | io, mode | Array.from, visit |
| [`visit`](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts#L742) | value, key | Object.entries, String, childValue.trim, lower.includes, out.push, readableKeys.has, visit, writableKeys.has |
