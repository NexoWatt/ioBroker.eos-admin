# src-ts/runtime-executables/ems/services/tariff-provider-registry.ts

Registriert unterstützte Tarifquellen und deren Aufruf-/Normalisierungsschnittstellen.

**Daten und Wirkung:** Optional konfigurierte Provider liefern EUR/kWh-Zeitreihen; Tarifregelung behält ihre vorhandene Frische-/Ausfallbehandlung. HTTPS-Gesamtabrufe einschließlich OAuth, DNS und Antwortkörper sind auf höchstens 5 s, 64 KiB Request und 2 MiB dekodierte Antwort begrenzt. Keine Redirects. Eine fehlerhafte Preiszeile verwirft die gesamte Antwort vor der Übergabe an ioBroker.

**Bei Änderungen:** Einheiten, Vorzeichen, Frische und Aufrufer mitprüfen; Netzwerkvertrag mit scripts/verify-cra-tariff.cjs testen. Anbieter-Fehlertexte nicht protokollieren; keine Zugangsdaten in Fehlermeldungen übernehmen. docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:perf_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/tariff-provider.ts](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts)
- [src-ts/runtime-executables/main.ts](../../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`clampNumber`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L117) | value, fallback, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`parseJsonMaybe`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L123) | raw | JSON.parse, raw.trim |
| [`getByPath`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L131) | root, pathSpec | String, normalized.split |
| [`num`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L145) | value, fallback | Number, Number.isFinite, String, text.includes, text.lastIndexOf, text.replace |
| [`toIso`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L165) | value | Date.UTC, Date.parse, Number, Number.isFinite, d.getTime, d.toISOString, value.slice |
| [`priceToEurKwh`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L181) | value, unit | Number.isFinite, String, num |
| [`applyFormula`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L191) | marketEurKwh, formula | Number, Number.isFinite, clampNumber, num |
| [`normalizeInterval`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L220) | row, options | Array.isArray, Date.parse, Math.abs, Math.round, Number.isFinite, Object.values, String, applyFormula, clampNumber, currency.toUpperCase, firstDefined, num, priceToEurKwh, toIso |
| [`firstDefined`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L222) | values | values.find |
| [`normalizeRows`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L264) | rows, options | Array.isArray, Date.parse, intervals.some, intervals.sort, rows.map |
| [`splitTodayTomorrow`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L275) | intervals, nowMs, timeZone | Date.now, Date.parse, dateKey, today.push, tomorrow.push, tomorrowCalendar.getUTCDate, tomorrowCalendar.setUTCDate, tomorrowCalendar.toISOString |
| [`dateKey`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L276) | ms | – |
| [`currentAndAverage`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L299) | intervals, nowMs | Array.isArray, Date.now, Number, future.reduce, rows.filter, rows.find |
| [`buildTibberQuery`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L307) | – | – |
| [`normalizeTibber`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L312) | payload, config | Array.isArray, String, getByPath, homes.find, normalizeRows |
| [`collectLikelyPriceRows`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L332) | value, depth | Array.isArray, Object.prototype.hasOwnProperty.call, Object.values, collectLikelyPriceRows, value.some |
| [`normalizeEnergyZero`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L360) | payload, config | Number, String, collectLikelyPriceRows, component.toLowerCase, normalizeRows, rawRows.map |
| [`firstDefined`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L365) | values | values.find |
| [`parseIsoDurationMinutes`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L384) | value, fallback | Number, String |
| [`xmlBlocks`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L395) | block, wanted | block.charAt, block.indexOf, block.slice, block.startsWith, matches.push, name.lastIndexOf, name.slice, raw.slice, raw.startsWith, stack.pop, stack.push, stack.some, tail.endsWith, token.slice |
| [`xmlText`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L445) | block, tag | tag.toLowerCase, xmlBlocks |
| [`normalizeEntsoe`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L452) | xml, config | Buffer.byteLength, Date.parse, Number, Number.isFinite, Number.isInteger, Object.keys, normalizeRows, parseIsoDurationMinutes, rows.push, toIso, xml.includes, xmlBlocks, xmlText |
| [`normalizeCustomRest`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L489) | payload, config | Array.isArray, Number, collectLikelyPriceRows, getByPath, normalizeRows, rows.map |
| [`withTimeout`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L522) | timeoutMs, fn | Math.min, Number, Number.isFinite, Promise.race, Promise.resolve, performance.now |
| [`validateProviderUrl`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L541) | raw, _options | – |
| [`readProviderResponse`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L552) | response | Buffer.concat, Buffer.from, Number, Number.isFinite, chunks.push, reader.cancel, reader.read, reader.releaseLock, response.body.getReader, response.body?.cancel, response.headers.get |
| [`fetchText`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L583) | rawUrl, options, signal | Buffer.byteLength, String, fetch, readProviderResponse, validateProviderUrl |
| [`fetchJson`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L602) | url, options, signal | JSON.parse, fetchText |
| [`headersFromConfig`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L607) | raw | Array.isArray, Object.entries, String, parseJsonMaybe |
| [`fetchTibber`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L618) | config, signal | Array.isArray, JSON.stringify, String, buildTibberQuery, fetchJson, normalizeTibber |
| [`fetchEnergyZero`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L638) | config, signal | Number, String, fetchJson, normalizeEnergyZero, now.getDate, now.getFullYear, now.getMonth, pad, url.searchParams.has, url.searchParams.set, url.toString |
| [`pad`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L646) | value | String |
| [`entsoeWindow`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L660) | nowMs | Date.now, dayStart.getTime, dayStart.setUTCHours, fmt |
| [`fmt`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L668) | d | String, d.getUTCDate, d.getUTCFullYear, d.getUTCHours, d.getUTCMinutes, d.getUTCMonth |
| [`fetchEntsoe`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L678) | config, signal | String, entsoeWindow, fetchText, normalizeEntsoe, url.searchParams.set, url.toString |
| [`fetchOAuthToken`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L699) | config, signal | Buffer.from, String, body.set, body.toString, fetchJson |
| [`fetchCustomRest`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L723) | config, overrideToken, signal | Buffer.from, String, fetchJson, headersFromConfig, normalizeCustomRest |
| [`fetchOstrom`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L751) | config, signal | String, fetchCustomRest, fetchOAuthToken |
| [`fetchProvider`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L759) | config | withTimeout |
| [`publicRegistry`](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts#L777) | – | PROVIDERS.map, PROVIDER_PROFILES.map |
