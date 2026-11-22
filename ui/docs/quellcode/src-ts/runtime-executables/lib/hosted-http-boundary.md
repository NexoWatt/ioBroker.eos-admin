# src-ts/runtime-executables/lib/hosted-http-boundary.ts

Übergabe vom Express-5-Verwaltungsserver an die eingebettete Express-4-UI.

**Daten und Wirkung:** Erhält Abfrageparameter und Request-/Response-Prototypen; führt asynchrone Routenfehler der vorhandenen Fehlerbehandlung zu.

**Bei Änderungen:** Parser-, Middleware-, Authentifizierungs- und Wiederherstellungsverhalten über echte Express-5-/Express-4-HTTP-Verbindungen prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/hosted-http-boundary.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `express` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`isObject`](../../../../../src-ts/runtime-executables/lib/hosted-http-boundary.ts#L31) | value | – |
| [`rejectionReason`](../../../../../src-ts/runtime-executables/lib/hosted-http-boundary.ts#L36) | error | – |
| [`observeResult`](../../../../../src-ts/runtime-executables/lib/hosted-http-boundary.ts#L40) | value, reject | Promise.resolve, isObject |
| [`containAsyncHandlers`](../../../../../src-ts/runtime-executables/lib/hosted-http-boundary.ts#L47) | app | isObject, visit |
| [`visit`](../../../../../src-ts/runtime-executables/lib/hosted-http-boundary.ts#L49) | stack | Array.isArray, isObject, seen.add, seen.has, visit |
| [`advance`](../../../../../src-ts/runtime-executables/lib/hosted-http-boundary.ts#L63) | error | next |
| [`reject`](../../../../../src-ts/runtime-executables/lib/hosted-http-boundary.ts#L68) | error | advance, rejectionReason |
| [`advance`](../../../../../src-ts/runtime-executables/lib/hosted-http-boundary.ts#L81) | failure | next |
| [`reject`](../../../../../src-ts/runtime-executables/lib/hosted-http-boundary.ts#L86) | failure | advance, rejectionReason |
| [`createHostedHttpHandler`](../../../../../src-ts/runtime-executables/lib/hosted-http-boundary.ts#L102) | app | containAsyncHandlers |
| [`restore`](../../../../../src-ts/runtime-executables/lib/hosted-http-boundary.ts#L110) | – | Object.defineProperty, Object.setPrototypeOf, Reflect.deleteProperty, res.removeListener |
| [`done`](../../../../../src-ts/runtime-executables/lib/hosted-http-boundary.ts#L120) | error | next, restore |
