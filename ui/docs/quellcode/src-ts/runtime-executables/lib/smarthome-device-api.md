# src-ts/runtime-executables/lib/smarthome-device-api.ts

Verbindet vollständige Gerätebedienung und begrenzte Verläufe mit den geschützten EOS-APIs.

**Daten und Wirkung:** Verwendet ausschließlich gespeicherte Zuordnungen und prüft Sitzung, Lizenz und Konfiguration erneut vor jedem Schreiben.

**Bei Änderungen:** Direkte HTTP-Aufrufe, entzogene Rechte, Zuordnungswechsel, Zeitlimits und parallele Stoppbefehle gemeinsam prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./smarthome-custom-contract` | [src-ts/runtime-executables/lib/smarthome-custom-contract.ts](../../../../../src-ts/runtime-executables/lib/smarthome-custom-contract.ts) |
| `./smarthome-device-aliases` | [src-ts/runtime-executables/lib/smarthome-device-aliases.ts](../../../../../src-ts/runtime-executables/lib/smarthome-device-aliases.ts) |
| `./smarthome-device-controls` | [src-ts/runtime-executables/lib/smarthome-device-controls.ts](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`row`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L32) | value | Array.isArray |
| [`failure`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L33) | code | – |
| [`idFrom`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L34) | value | failure |
| [`configured`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L38) | host, id | JSON.stringify, Math.max, Math.min, Number.isFinite, failure, host.device, normalizeDeviceControls, row |
| [`authorize`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L48) | host, req | failure, host.authorize, host.canOperate |
| [`replyError`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L53) | res, error | res.status |
| [`noStore`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L59) | res | res.setHeader |
| [`boundedRead`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L60) | operation | Promise.race, Promise.resolve, clearTimeout |
| [`registerSmartHomeDeviceApi`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L69) | app, host, guard, discoveryGuard | app.get, app.post |
| [`readObject`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L84) | id | host.readObject |
| [`createObjectIfAbsent`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L85) | id, object | Date.now, host.authorizeMapping, host.createObjectIfAbsent |
| [`readObject`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L122) | stateId | host.readObject |
| [`readState`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L122) | stateId | host.readState |
| [`writeState`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L123) | stateId, value | Date.now, authorize, configured, failure, host.writeState |
| [`createDeviceSnapshotReader`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L189) | host | Date.now |
| [`read`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L192) | cache, id, fetch | Date.now, Promise.reject, cache.get, cache.set, fetch |
| [`readObject`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L197) | id | read |
| [`readState`](../../../../../src-ts/runtime-executables/lib/smarthome-device-api.ts#L197) | id | read |
