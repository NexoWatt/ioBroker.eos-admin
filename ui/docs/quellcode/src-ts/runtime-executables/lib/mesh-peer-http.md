# src-ts/runtime-executables/lib/mesh-peer-http.ts

Begrenzt den nativen HTTP-Transport für den manuellen Mesh-Peer-Feldtest.

**Daten und Wirkung:** Prüft entfernte Antworten und liefert feste Fehlercodes; teilt eine monotone Frist über alle Abrufe eines Peers.

**Bei Änderungen:** Redirects, echte Abbrüche, TLS-Zertifikate, Antwortgrößen und bestehende Peer-Protokolle gemeinsam nachprüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/mesh-peer-http.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:http` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:https` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:perf_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`failure`](../../../../../src-ts/runtime-executables/lib/mesh-peer-http.ts#L36) | code | ownedErrors.set |
| [`safeMeshPeerError`](../../../../../src-ts/runtime-executables/lib/mesh-peer-http.ts#L42) | error | ownedErrors.get |
| [`record`](../../../../../src-ts/runtime-executables/lib/mesh-peer-http.ts#L45) | value | Array.isArray |
| [`ownData`](../../../../../src-ts/runtime-executables/lib/mesh-peer-http.ts#L48) | value, key | Object.getOwnPropertyDescriptor, Object.prototype.hasOwnProperty.call |
| [`normalizeMeshPeerUrl`](../../../../../src-ts/runtime-executables/lib/mesh-peer-http.ts#L54) | raw | failure, raw.trim, value.href.replace |
| [`validateJson`](../../../../../src-ts/runtime-executables/lib/mesh-peer-http.ts#L70) | raw, endpoint, secret | Array.isArray, Number.isFinite, Object.assign, Object.create, codes.has, copy, failure, ownData, record, value.trim |
| [`copy`](../../../../../src-ts/runtime-executables/lib/mesh-peer-http.ts#L114) | value, depth | Array.isArray, Number.isFinite, Object.create, Object.defineProperty, Object.entries, copy, failure, key.includes, record, value.map, value.split |
| [`createMeshPeerClient`](../../../../../src-ts/runtime-executables/lib/mesh-peer-http.ts#L137) | rawUrl, requestedTimeoutMs, token | Math.max, Math.min, Number.isFinite, Object.freeze, failure, normalizeMeshPeerUrl, performance.now |
| [`request`](../../../../../src-ts/runtime-executables/lib/mesh-peer-http.ts#L144) | endpoint, body | Buffer.byteLength, JSON.stringify, Object.create, String, failure, performance.now |
| [`finish`](../../../../../src-ts/runtime-executables/lib/mesh-peer-http.ts#L167) | error, reply | clearTimeout, failure, incoming?.destroy, outgoing?.destroy, reject, resolve |
