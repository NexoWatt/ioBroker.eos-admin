# src-ts/runtime-executables/lib/smarthome-device-legacy.ts

Erhält vorhandene EOS-Zusatzbedienung hinter derselben Prüfung wie die neuen Geräteprofile.

**Daten und Wirkung:** Akzeptiert nur ausdrücklich konfigurierte Schreibziele und prüft Profil, Metadaten und Schutzkontakte vor der Übergabe.

**Bei Änderungen:** reine Lesedatenpunkte, Klimagrenzen, Beschattungsschutz, Szenen und gleichzeitig geänderte Zuordnungen testen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/smarthome-device-legacy.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./smarthome-device-controls` | [src-ts/runtime-executables/lib/smarthome-device-controls.ts](../../../../../src-ts/runtime-executables/lib/smarthome-device-controls.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`row`](../../../../../src-ts/runtime-executables/lib/smarthome-device-legacy.ts#L15) | value | Array.isArray |
| [`fail`](../../../../../src-ts/runtime-executables/lib/smarthome-device-legacy.ts#L16) | code | – |
| [`signature`](../../../../../src-ts/runtime-executables/lib/smarthome-device-legacy.ts#L28) | value | JSON.stringify, row |
| [`executeLegacyDeviceWrite`](../../../../../src-ts/runtime-executables/lib/smarthome-device-legacy.ts#L32) | deviceInput, stateId, value, host | Date.now, Math.max, Number.isFinite, Object.entries, controls.fields.filter, executeDeviceControl, fail, host.authorize, host.device, normalizeDeviceControls, row, signature |
| [`readObject`](../../../../../src-ts/runtime-executables/lib/smarthome-device-legacy.ts#L51) | id | host.readObject |
| [`readState`](../../../../../src-ts/runtime-executables/lib/smarthome-device-legacy.ts#L51) | id | host.readState |
| [`writeState`](../../../../../src-ts/runtime-executables/lib/smarthome-device-legacy.ts#L52) | id, target | Date.now, fail, host.authorize, host.device, host.writeState, signature |
