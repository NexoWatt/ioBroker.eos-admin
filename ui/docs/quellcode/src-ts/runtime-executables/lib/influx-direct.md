# src-ts/runtime-executables/lib/influx-direct.ts

Bindet vorhandene InfluxDB-2-Historien ohne zusätzlichen ioBroker-Adapter an EOS an.

**Daten und Wirkung:** Liest feste Messreihen und schreibt begrenzte Messwertpakete mit geschütztem Token.

**Bei Änderungen:** Datenformate, Zeitgrenzen, Geräteverläufe und TLS-/Netzzielprüfungen gemeinsam nachprüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/influx-direct.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:http` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:https` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:perf_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:dns` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:net` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./influx-network-policy` | [src-ts/runtime-executables/lib/influx-network-policy.ts](../../../../../src-ts/runtime-executables/lib/influx-network-policy.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/lib/influx-config.ts](../../../../../src-ts/runtime-executables/lib/influx-config.ts)
- [src-ts/runtime-executables/lib/influx-history-runtime.ts](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts)
- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`csvNumber`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L43) | value, datatype | Number, Number.isFinite, Number.isSafeInteger, digits, failure, value.at |
| [`digits`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L47) | – | value.charCodeAt |
| [`csvTimestamp`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L69) | value | Date.UTC, Date.parse, Number, Number.isFinite, clock.slice, clockParts.at, date.slice, failure, parts.at, time.endsWith, time.slice, time.split, value.split, zone.slice |
| [`failure`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L88) | code | Object.assign |
| [`requestDeadline`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L89) | timeoutMs | Math.min, Number.isFinite, failure, performance.now |
| [`required`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L93) | value, max | failure, value.trim |
| [`timestamp`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L99) | value | Number.isSafeInteger, failure |
| [`influxFluxString`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L106) | value | value.replace |
| [`validateInfluxDirectConfig`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L109) | input | Array.isArray, failure, input.caCertificate.match, input.caCertificate.replace, required, validateInfluxUrl |
| [`buildInfluxHistoryQuery`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L135) | bucket, id, options | Math.ceil, Math.floor, Math.max, Math.min, Number.isSafeInteger, aggregates.get, failure, influxFluxString, required, timestamp |
| [`parseInfluxCsv`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L187) | text, maxRows | Buffer.byteLength, Number.isSafeInteger, csvNumber, csvTimestamp, datatypes.at, failure, fields.at, fields.every, fields.includes, fields.map, finishField, finishRow, first.startsWith, header.get (weitere in der Quelle) |
| [`finishField`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L191) | – | failure, row.push |
| [`finishRow`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L192) | – | failure, finishField, rows.push |
| [`influxLineProtocol`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L253) | points | Array.isArray, Buffer.byteLength, failure, lines.join, points.map |
| [`InfluxDirectClient.constructor`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L278) | config | validateInfluxDirectConfig |
| [`InfluxDirectClient.request`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L280) | method, endpoint, params, body, contentType, deadlineMs | Math.min, Number.isFinite, Object.entries, failure, performance.now, url.searchParams.set |
| [`finish`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L289) | error, result | clearTimeout, reject, resolve, this.pending.delete |
| [`lookup`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L295) | hostname, options, callback | dnsLookup |
| [`InfluxDirectClient.check`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L358) | – | JSON.parse, JSON.stringify, Object.hasOwn, failure, influxFluxString, parseInfluxCsv, performance.now, this.request |
| [`InfluxDirectClient.query`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L379) | id, options, timeoutMs | JSON.stringify, Math.ceil, Math.max, Math.min, buildInfluxHistoryQuery, failure, parseInfluxCsv, performance.now, requestDeadline, result.some, this.request |
| [`InfluxDirectClient.write`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L399) | points, timeoutMs | influxLineProtocol, requestDeadline, this.request |
| [`InfluxDirectClient.close`](../../../../../src-ts/runtime-executables/lib/influx-direct.ts#L404) | – | request.destroy |
