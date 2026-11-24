# src-ts/runtime-executables/lib/runtime-proxy-html.ts

Liefert eigene HTML-Seiten unter dem instanzgebundenen Admin-Proxy-Pfad aus.

**Daten und Wirkung:** Der streng geprüfte X-Forwarded-Prefix dient ausschließlich

**Bei Änderungen:** Prefix-Injektion, Assetpfade, ursprüngliche Zugriffsprüfung,

[Originalquelle](../../../../../src-ts/runtime-executables/lib/runtime-proxy-html.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:fs` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:fs/promises` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:path` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`runtimeProxyPrefix`](../../../../../src-ts/runtime-executables/lib/runtime-proxy-html.ts#L40) | req, namespace | publicPath.slice, segments.some, value.endsWith, value.slice, value.startsWith |
| [`isHttpsRuntimeProxy`](../../../../../src-ts/runtime-executables/lib/runtime-proxy-html.ts#L56) | req, namespace | runtimeProxyPrefix |
| [`rewriteUrl`](../../../../../src-ts/runtime-executables/lib/runtime-proxy-html.ts#L60) | value, prefix | prefix.lastIndexOf, prefix.slice, value.includes, value.startsWith |
| [`rewriteTag`](../../../../../src-ts/runtime-executables/lib/runtime-proxy-html.ts#L68) | tag, prefix | tag.replace |
| [`rewriteRuntimeProxyHtml`](../../../../../src-ts/runtime-executables/lib/runtime-proxy-html.ts#L74) | html, prefix, wwwBase | Buffer.byteLength, chunks.join, chunks.push, chunks.splice, html.charAt, html.indexOf, html.slice, html.startsWith, html.toLowerCase, lower.charAt, lower.indexOf, prefix.lastIndexOf, prefix.slice, rewriteTag (weitere in der Quelle) |
| [`createRuntimeFileSender`](../../../../../src-ts/runtime-executables/lib/runtime-proxy-html.ts#L124) | root, namespace | path.resolve |
| [`contained`](../../../../../src-ts/runtime-executables/lib/runtime-proxy-html.ts#L128) | file, directory | file.startsWith |
