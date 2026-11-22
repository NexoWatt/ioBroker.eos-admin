# src-ts/runtime-executables/lib/ui-access-policy.ts

Trennt lokale ioBroker-Sitzungen von der zentral geprüften EOS-Sitzung.

**Daten und Wirkung:** Liest ausschließlich konfigurierte Vertrauensgrenzen und

**Bei Änderungen:** Profiltrennung, exakte Origins, Cookieparser, Kontowiderruf,

[Originalquelle](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:http` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:https` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:net` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:path` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:fs` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`parseUiCookies`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L38) | req | Buffer.byteLength, Object.create, Object.defineProperty, Object.hasOwn, decodeURIComponent, part.indexOf, part.slice, raw.split |
| [`uiAuthMode`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L59) | config | – |
| [`uiSessionBinding`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L66) | namespace, port, config | JSON.stringify, String, crypto.createHash, uiAuthMode |
| [`uiSessionCookieName`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L72) | binding | binding.slice |
| [`normalizePeer`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L74) | raw | raw.toLowerCase, value.slice, value.startsWith |
| [`isLoopback`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L80) | raw | normalizePeer |
| [`trustedProxyPeer`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L84) | req, raw | Array.isArray, isLoopback, net.isIP, normalizePeer, raw.split, rows.some |
| [`secureUiTransport`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L93) | req, trustedIps, proxyPrefixValid | trustedProxyPeer |
| [`uiOriginAllowed`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L99) | req, allowedOrigins, trustedIps, proxyPrefixValid | Array.isArray, allowedOrigins.split, canonicalOrigin, rows.some, trustedProxyPeer |
| [`canonicalOrigin`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L103) | value | – |
| [`uiRequestPath`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L125) | req | String, decodeURIComponent, path.posix.normalize |
| [`isPublicUiRequest`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L140) | req | AUTH_READ.has, AUTH_WRITE.has, PUBLIC_PAGES.has, String, uiRequestPath |
| [`isIndependentMachineRequest`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L153) | req | String, uiRequestPath |
| [`constantTimeToken`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L162) | given, expected | crypto.createHash, crypto.timingSafeEqual |
| [`UiLoginLimiter.constructor`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L172) | clock | – |
| [`UiLoginLimiter.keys`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L173) | ip, login | crypto.createHash, login.normalize |
| [`UiLoginLimiter.status`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L177) | keys | Math.ceil, Math.max, this.clock, this.failures.delete, this.failures.get |
| [`UiLoginLimiter.acquire`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L187) | keys | keys.some, this.inFlight.get, this.inFlight.set |
| [`UiLoginLimiter.failure`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L202) | keys | Math.max, key.startsWith, this.clock, this.failures.delete, this.failures.get, this.failures.has, this.failures.keys, this.failures.set |
| [`UiLoginLimiter.success`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L218) | keys | this.failures.delete |
| [`eosSessionEndpoint`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L231) | raw | segments.slice, url.pathname.split |
| [`safeCentralUiUrl`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L244) | raw | raw.startsWith |
| [`EosSessionClient.constructor`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L260) | config, binding | eosSessionEndpoint, fs.readFileSync, fs.statSync, path.isAbsolute, safeCentralUiUrl, stat.isFile, this.ca.includes |
| [`EosSessionClient.credential`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L274) | req | parseUiCookies |
| [`EosSessionClient.key`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L278) | value | crypto.createHmac |
| [`EosSessionClient.revoke`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L279) | req | Date.now, this.credential, this.key, this.revoked.set |
| [`EosSessionClient.isRevoked`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L286) | key | this.revoked.has |
| [`EosSessionClient.resolve`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L287) | req | this.active.get, this.active.set, this.credential, this.key, this.request, this.revoked.has |
| [`EosSessionClient.request`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L300) | value, key | – |
| [`finish`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L305) | access | clearTimeout, request?.destroy, resolve, response?.destroy, this.pending.delete, this.revoked.has |
| [`EosSessionClient.close`](../../../../../src-ts/runtime-executables/lib/ui-access-policy.ts#L358) | – | request.destroy, this.pending.clear |
