# src-ts/runtime-executables/lib/partner-websocket.ts

Begrenzt ausgehende Partner-WSS-Sitzungen, ohne Geräte oder States zu schreiben.

**Daten und Wirkung:** Prüft feste Ziele, TLS, Freigaben, Fristen und Puffer; liefert nur

**Bei Änderungen:** DNS-Pinning, echte Abbrüche, Widerruf, Wiederanlauf und Last gemeinsam

[Originalquelle](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `ws` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:dns/promises` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:net` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:tls` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:perf_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/lib/partner-runtime.ts](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`isPartnerAddressAllowed`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L97) | address, vpnAddresses | address.includes, forbidden4.check, forbidden6.check, isIP, metadataAddresses.check, privateAddresses.check, public6.check, vpnAddresses.some |
| [`resolvePartner`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L116) | hostname, signal | Promise.allSettled, addresses.push, resolver.resolve4, resolver.resolve6, results.entries, signal.addEventListener, signal.removeEventListener |
| [`abort`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L118) | – | resolver.cancel |
| [`validHostname`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L135) | hostname | hostname.split, labels.at, labels.every |
| [`validatePartnerEndpoint`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L144) | config | Number, Number.isInteger, isIP, url.hostname.endsWith, validHostname |
| [`PartnerWebSocketClient.constructor`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L189) | config, hooks, dependencies | Boolean, Date.parse, Math.min, Number.isFinite, Number.isSafeInteger, Object.freeze, isIP, privateAddresses.check, this.monotonicNow, this.wallNow, validatePartnerEndpoint |
| [`PartnerWebSocketClient.start`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L228) | – | this.connect |
| [`PartnerWebSocketClient.stop`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L235) | – | this.cleanup, this.state |
| [`PartnerWebSocketClient.send`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L242) | text | Buffer.byteLength, socket.send, this.authorized, this.fail |
| [`PartnerWebSocketClient.state`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L259) | state, code | this.cleanup, this.hooks.onState |
| [`PartnerWebSocketClient.authorized`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L266) | – | Number.isFinite, this.block, this.hooks.isAuthorized, this.monotonicNow, this.wallNow |
| [`PartnerWebSocketClient.block`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L277) | code | this.cleanup, this.state |
| [`PartnerWebSocketClient.cleanup`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L282) | – | clearInterval, clearTimeout, socket.terminate, this.controller?.abort |
| [`PartnerWebSocketClient.fail`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L296) | code | Math.max, Math.min, Math.random, Number.isFinite, setTimeout, this.authorized, this.cleanup, this.dependencies.random, this.reconnectTimer.unref, this.state |
| [`PartnerWebSocketClient.connect`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L310) | – | addresses.some, setTimeout, socket.on, this.authorized, this.block, this.deadlineTimer.unref, this.dependencies.socketFactory, this.fail, this.monotonicNow, this.state |
| [`lookup`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L335) | _host, options, callback | callback |
| [`PartnerWebSocketClient.consumeQuota`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L415) | frames, bytes | this.fail, this.monotonicNow |
| [`PartnerWebSocketClient.drain`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L429) | generation | Buffer.byteLength, Object.freeze, this.authorized, this.drain, this.fail, this.hooks.onMessage, this.queue.shift |
| [`current`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L439) | – | this.authorized |
| [`send`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L442) | reply | current, this.send |
| [`PartnerWebSocketClient.heartbeat`](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts#L454) | generation | socket.ping, this.authorized, this.fail, this.monotonicNow |
