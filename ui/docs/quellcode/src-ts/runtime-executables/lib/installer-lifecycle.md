# src-ts/runtime-executables/lib/installer-lifecycle.ts

Schützt AppCenter-Zuordnungen vor veralteten Speicherformularen und

**Daten und Wirkung:** Eine flüchtig geschützte HMAC-Revision verlässt den Server,

**Bei Änderungen:** Veraltete nichtleere Listen, Ownership-Verlust, fehlgeschlagene

[Originalquelle](../../../../../src-ts/runtime-executables/lib/installer-lifecycle.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./http-error-boundary` | [src-ts/runtime-executables/lib/http-error-boundary.ts](../../../../../src-ts/runtime-executables/lib/http-error-boundary.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/engine.ts](../../../../../src-ts/runtime-executables/ems/engine.ts)
- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`record`](../../../../../src-ts/runtime-executables/lib/installer-lifecycle.ts#L23) | value | Array.isArray |
| [`canonical`](../../../../../src-ts/runtime-executables/lib/installer-lifecycle.ts#L26) | value | Array.isArray, Object.entries, Object.fromEntries, value.map |
| [`installerRevision`](../../../../../src-ts/runtime-executables/lib/installer-lifecycle.ts#L35) | patch | JSON.stringify, canonical, createHmac, record |
| [`assertInstallerRevision`](../../../../../src-ts/runtime-executables/lib/installer-lifecycle.ts#L40) | expected, patch | Object.keys, createPublicHttpError, installerRevision, record |
| [`provisionInstallerObjects`](../../../../../src-ts/runtime-executables/lib/installer-lifecycle.ts#L51) | options | createPublicHttpError, options.canWrite, step |
| [`awaitEmsTransition`](../../../../../src-ts/runtime-executables/lib/installer-lifecycle.ts#L68) | operation, timeoutMs | Math.max, Math.min, Math.round, Number.isFinite, Promise.race, clearTimeout |
| [`assertDeviceAppActivations`](../../../../../src-ts/runtime-executables/lib/installer-lifecycle.ts#L79) | current, planned, allowed | Object.entries, Reflect.get, allowed, createPublicHttpError, record |
| [`numericMeasurement`](../../../../../src-ts/runtime-executables/lib/installer-lifecycle.ts#L94) | value | Number, Number.isFinite, value.trim |
| [`activeDeviceProfileReferences`](../../../../../src-ts/runtime-executables/lib/installer-lifecycle.ts#L104) | value | Array.isArray, Reflect.get, active, controllerMeasurementKeys.push, read.add, record, walk |
| [`active`](../../../../../src-ts/runtime-executables/lib/installer-lifecycle.ts#L107) | id, flag | Object.keys, Reflect.get, record |
| [`walk`](../../../../../src-ts/runtime-executables/lib/installer-lifecycle.ts#L116) | item, depth | Array.isArray, Object.entries, record, walk, writeKey.test |
