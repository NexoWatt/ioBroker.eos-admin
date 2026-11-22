# src-ts/runtime-executables/lib/ui-server-transport.ts

Löst den ausdrücklich gewählten direkten HTTPS-Transport der UI auf.

**Daten und Wirkung:** Liest benannte Zertifikate über die zentrale Controller-API,

**Bei Änderungen:** Zertifikatsauswahl, PEM-Grenzen, Kette, Fristen sowie tatsächliche HTTPS-Start-/Stop-Fälle prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/ui-server-transport.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:https` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:perf_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:tls` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`UiTlsConfigurationError.constructor`](../../../../../src-ts/runtime-executables/lib/ui-server-transport.ts#L77) | code | ERROR_MESSAGE_LOOKUP.get, super |
| [`fail`](../../../../../src-ts/runtime-executables/lib/ui-server-transport.ts#L86) | code | – |
| [`certificateName`](../../../../../src-ts/runtime-executables/lib/ui-server-transport.ts#L88) | value, required | fail, value.includes, value.trim |
| [`checkDeadline`](../../../../../src-ts/runtime-executables/lib/ui-server-transport.ts#L100) | deadline | fail, performance.now |
| [`readCertificates`](../../../../../src-ts/runtime-executables/lib/ui-server-transport.ts#L105) | adapter, publicName, privateName, chainedName, deadline | Symbol, checkDeadline, fail, pendingReads.has, pendingReads.set |
| [`finish`](../../../../../src-ts/runtime-executables/lib/ui-server-transport.ts#L124) | error, certificates | clearTimeout, pendingReads.delete, pendingReads.get, performance.now, reject, resolve |
| [`ownField`](../../../../../src-ts/runtime-executables/lib/ui-server-transport.ts#L144) | value, key | Array.isArray, Object.getOwnPropertyDescriptor, Object.prototype.hasOwnProperty.call, fail |
| [`pemText`](../../../../../src-ts/runtime-executables/lib/ui-server-transport.ts#L152) | value, maxBytes, kind | Buffer.byteLength, Buffer.isBuffer, fail, text.replace, text.trim, value.toString |
| [`pemBlocks`](../../../../../src-ts/runtime-executables/lib/ui-server-transport.ts#L167) | text, kind, maxCount | allowed.has, blocks.push, body.join, body.push, fail, line.endsWith, line.slice, line.startsWith, raw.trim, text.split |
| [`validatedOptions`](../../../../../src-ts/runtime-executables/lib/ui-server-transport.ts#L195) | value, withChain, deadline | Date.now, Date.parse, Number.isFinite, certificates.push, checkDeadline, child.checkIssued, child.verify, createPrivateKey, createSecureContext, fail, fingerprints.add, fingerprints.has, leaf.checkPrivateKey, ownField (weitere in der Quelle) |
| [`resolveUiTlsOptions`](../../../../../src-ts/runtime-executables/lib/ui-server-transport.ts#L241) | adapter, config | certificateName, fail, performance.now, readCertificates, validatedOptions |
