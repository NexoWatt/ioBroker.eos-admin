# src-ts/runtime-executables/lib/smarthome-device-aliases.ts

Erstellt auf ausdrücklichen Installer-Auftrag verwaltete ioBroker-Aliasse für gespeicherte Gerätezuordnungen.

**Daten und Wirkung:** Prüft Quellen und vorhandene Objekte, legt ausschließlich fehlende Alias-Objekte an und schreibt niemals Gerätewerte.

**Bei Änderungen:** Idempotenz, fremde Kollisionen, getrennte Leseschreibziele, Teilfehler und unveränderte Kunden-/Raumdaten prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./smarthome-device-controls` | [src-ts/runtime-executables/lib/smarthome-device-controls.ts](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/lib/smarthome-device-api.ts](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`DeviceAliasError.constructor`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L29) | code, created, reused, uncertain | super |
| [`row`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L45) | value | Array.isArray, Object.getOwnPropertyDescriptors, Object.getPrototypeOf, Object.values |
| [`fail`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L51) | code | – |
| [`text`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L52) | value, max | value.replace |
| [`safeClone`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L53) | value | Buffer.byteLength, JSON.parse, JSON.stringify, fail, inspect |
| [`inspect`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L55) | item, depth | Array.isArray, Number.isFinite, Object.entries, Object.getOwnPropertyDescriptors, fail, inspect, row, seen.add, seen.delete, seen.has |
| [`sourceError`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L75) | error | – |
| [`Context.constructor`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L91) | host | – |
| [`Context.check`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L92) | – | Date.now, fail |
| [`Context.bounded`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L93) | operation | Promise.race, Promise.resolve, clearTimeout, this.check |
| [`Context.drain`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L104) | – | task, this.queue.shift |
| [`Context.readObject`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L111) | id | Promise.reject, this.cache.get, this.cache.set |
| [`Context.freshObject`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L123) | id | this.cache.delete, this.readObject |
| [`Context.result`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L127) | devices | – |
| [`Context.failure`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L128) | error | sourceError |
| [`commonOf`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L134) | source | fail, row |
| [`sourceMetadata`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L138) | source, read, write | Number.isFinite, Object.entries, row, safeClone, text |
| [`sameShape`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L158) | read, write | – |
| [`ownerNative`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L162) | device, profile | row, text |
| [`aliasState`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L171) | device, config, field, id, read, write | Boolean, fail, ownerNative, sourceMetadata, text |
| [`knownObject`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L183) | existing, plan | JSON.stringify, row |
| [`ensure`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L200) | plan, context | context.bounded, context.check, context.created.add, context.freshObject, context.reused.add, context.uncertain.add, context.uncertain.delete, fail, knownObject |
| [`sourceFor`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L213) | config, field, side, context | commonOf, context.readObject, fail, id.startsWith, row, validateDeviceControlRead, validateDeviceControlWrite |
| [`readObject`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L215) | sourceId | context.readObject |
| [`readState`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L215) | – | Promise.resolve |
| [`rebaseline`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L242) | device, path, previous, next | Object.hasOwn, row |
| [`rewrite`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L247) | device, config, replacements | COMBINED_PATHS.has, Object.entries, READ_PATHS.has, WRITE_PATHS.has, candidates.map, fail, rebaseline, replacements.filter, replacements.find, row |
| [`createDeviceAliases`](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts#L275) | input, host | Array.isArray, Boolean, Promise.all, String, aliasState, configs.push, context.failure, context.readObject, context.result, context.reused.add, createHash, devices.push, ensure, fail (weitere in der Quelle) |
