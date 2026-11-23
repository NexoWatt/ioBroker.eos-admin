# src-ts/runtime-executables/lib/smarthome-device-controls.ts

Stellt alle TypeDetector-Gerätefelder als geprüfte EOS-Bedienfähigkeiten bereit.

**Daten und Wirkung:** Liest nur gespeicherte Zuordnungen; schreibt erst nach Katalog-, Objekt-, Werte- und Schutzprüfung.

**Bei Änderungen:** Katalogabdeckung, Schreibgrenzen, unbekannte Werte, Schutzmeldungen und Zeitüberschreitungen prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `@iobroker/type-detector` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./smarthome-custom-contract` | [src-ts/runtime-executables/lib/smarthome-custom-contract.ts](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/lib/smarthome-contract.ts](../../../../../src-ts/runtime-executables/lib/smarthome-contract.ts)
- [src-ts/runtime-executables/lib/smarthome-device-aliases.ts](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts)
- [src-ts/runtime-executables/lib/smarthome-device-api.ts](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts)
- [src-ts/runtime-executables/lib/smarthome-device-detection.ts](../../../../../src-ts/runtime-executables/lib/smarthome-device-detection.ts)
- [src-ts/runtime-executables/lib/smarthome-device-legacy.ts](../../../../../src-ts/runtime-executables/lib/smarthome-device-legacy.ts)
- [src-ts/runtime-executables/lib/smarthome-import.ts](../../../../../src-ts/runtime-executables/lib/smarthome-import.ts)
- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`DeviceControlError.constructor`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L51) | code | super |
| [`isRecord`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L107) | value | Array.isArray, Object.getOwnPropertyDescriptors, Object.getPrototypeOf, Object.values |
| [`fail`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L113) | code | – |
| [`scalarType`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L114) | value | – |
| [`finite`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L117) | value | Number.isFinite |
| [`text`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L118) | value, maximum | value.replace |
| [`label`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L121) | key | key.replace |
| [`typeOf`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L122) | types | – |
| [`scalar`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L123) | value, type, limit | finite |
| [`keyValue`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L127) | key, type | Number, finite, key.trim |
| [`optionsFor`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L132) | value, type | Array.isArray, JSON.parse, Object.create, Object.entries, Object.fromEntries, Object.hasOwn, entry.indexOf, entry.slice, fail, isRecord, keyValue, optionsFor, result.push, result.some (weitere in der Quelle) |
| [`defaultOptions`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L166) | value, type | optionsFor |
| [`kindFor`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L170) | type, write, indicator, momentary, hasOptions | – |
| [`detectorField`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L177) | state | Array.isArray, Boolean, kindFor, label, optionsFor, state.type.filter, text, typeOf |
| [`makeCatalog`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L196) | – | COVER_PROFILES.has, ChannelDetector.getPatterns, Object.values, String, addManualReferenceSlots, detectorField, getCustomControlProfiles, label, profile.fields.find, profile.fields.map, profile.fields.push, profile.fields.some, result.get, result.set (weitere in der Quelle) |
| [`addManualReferenceSlots`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L232) | catalog | Boolean, add, catalog.get, kindFor |
| [`add`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L233) | profileId, key, types, write, fieldLabel | catalog.get, kindFor, label, profile.fields.push, profile.fields.some, typeOf |
| [`getControlProfiles`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L266) | – | CATALOG.values |
| [`fieldFor`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L282) | profile, key | label, profile.fields.find |
| [`validId`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L295) | value | value.trim |
| [`normalizeDeviceControls`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L303) | value | Array.isArray, CATALOG.get, Object.keys, fail, fieldFor, fields.push, isRecord, keys.add, keys.has, validId |
| [`ReadContext.constructor`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L337) | host, options | finite |
| [`ReadContext.reserveField`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L340) | field | Buffer.byteLength, JSON.stringify |
| [`ReadContext.check`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L349) | – | Date.now, fail |
| [`ReadContext.bounded`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L350) | operation, write | Promise.race, Promise.resolve, clearTimeout, fail, this.check |
| [`ReadContext.drain`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L366) | – | task, this.queue.shift |
| [`ReadContext.run`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L375) | kind, id | – |
| [`ReadContext.read`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L386) | kind, id | Promise.reject, this.cache.get, this.cache.set, this.run |
| [`metadata`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L396) | value, field | Object.values, defaultOptions, fail, field.types.includes, finite, ids.some, isRecord, optionsFor, scalarType, text |
| [`resolvedMetadata`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L428) | context, id, field, direction | context.read, fail, isRecord, metadata, validId, visited.add, visited.has |
| [`inBounds`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L451) | value, meta | meta.options.some |
| [`matchesStep`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L455) | value, meta | Math.abs, Math.max, Math.round, finite |
| [`stateValue`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L460) | raw, meta, maximum, staleAfterMs | Date.now, finite, inBounds, isRecord, scalar |
| [`protectionActive`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L466) | value | finite, value.trim |
| [`errorCode`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L476) | error | – |
| [`numericMetadata`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L479) | meta | – |
| [`buildField`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L484) | mapping, field, profile, context, readOnly | COVER_PROFILES.has, COVER_PROTECTIONS.includes, Date.now, Math.max, Object.assign, context.read, context.reserveField, errorCode, finite, isRecord, kindFor, numericMetadata, resolvedMetadata, scalar (weitere in der Quelle) |
| [`buildDeviceControls`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L532) | config, host, readOnly, options | CATALOG.get, COVER_PROFILES.has, MOVEMENT_KEYS.has, Promise.all, fail, fields.filter, normalizeDeviceControls, normalized.fields.map, protectedFields.some |
| [`validateDeviceControlRead`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L553) | config, key, host | CATALOG.get, fail, fieldFor, normalizeDeviceControls, normalized.fields.find, resolvedMetadata |
| [`validateDeviceControlWrite`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L566) | config, key, host | CATALOG.get, fail, fieldFor, normalizeDeviceControls, normalized.fields.find, resolvedMetadata |
| [`verifyCoverProtection`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L578) | config, profile, context | config.fields.filter, context.read, fail, fieldFor, isRecord, protectionActive, resolvedMetadata, stateValue |
| [`verifyClimateOrder`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L593) | config, profile, key, value, context | config.fields.find, context.read, fail, fieldFor, isRecord, resolvedMetadata, stateValue |
| [`climateLease`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L609) | config, request | JSON.stringify, String, config.fields.filter, fail, isRecord, pendingClimateWrites.has, pendingClimateWrites.set |
| [`prepareWrite`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L621) | normalized, request, context | CATALOG.get, COVER_PROFILES.has, MOVEMENT_KEYS.has, Object.hasOwn, Object.keys, context.check, fail, fieldFor, inBounds, isRecord, matchesStep, normalized.fields.find, resolvedMetadata, scalar (weitere in der Quelle) |
| [`executeDeviceControl`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L642) | config, request, host, readOnly, options | climateLease, context.bounded, fail, normalizeDeviceControls, prepareWrite, release |
| [`executeDeviceControlBatch`](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts#L661) | config, commands, host, readOnly, options | Array.isArray, COLOR_KEYS.has, COLOR_PROFILES.has, Promise.all, context.bounded, fail, isRecord, normalizeDeviceControls, seen.add, seen.has |
