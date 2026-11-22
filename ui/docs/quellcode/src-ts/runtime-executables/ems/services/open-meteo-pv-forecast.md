# src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts

Ruft Wetter-/Strahlungsdaten ab und berechnet daraus PV-Prognosewerte für die konfigurierte Anlage.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:https` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:perf_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/pv-forecast.ts](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts)
- [src-ts/runtime-executables/main.ts](../../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`buildPvForecastDiagnostics`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L101) | input | Date.now, Math.max, Math.round, finite, text |
| [`publishPvForecastDiagnostics`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L134) | setter, diagnostics | Math.round, setter |
| [`safeOpenMeteoError`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L196) | error | – |
| [`requestOpenMeteoJson`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L208) | url, timeoutMs | – |
| [`finish`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L223) | error, data | clearTimeout, reject, request?.destroy, resolve, response?.destroy |
| [`configuredOpenMeteoApiKey`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L277) | adapter, legacyValue | value.trim |
| [`validateOpenMeteoWeather`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L283) | data, nowMs | Array.isArray, Date.now, Date.parse, Number.isFinite, Number.isInteger, codes.has, current.time.slice, dates.every, fields.every, numeric |
| [`numeric`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L284) | value, min, max | Number.isFinite |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L319) | value, fallback | Number, Number.isFinite |
| [`clamp`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L324) | value, min, max, fallback | Math.max, Math.min, finite |
| [`asBoolean`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L328) | value, fallback | String |
| [`text`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L337) | value, fallback | String |
| [`parseJson`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L341) | value, fallback | JSON.parse, String |
| [`normalizeForecastSourceMode`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L346) | value | text |
| [`readSetting`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L354) | adapter, key, fallback | adapter.getStateAsync |
| [`normalizeOpenMeteoPvArrays`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L365) | values | Array.isArray, clamp, parseJson |
| [`loadSettings`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L392) | adapter | asBoolean, clamp, configuredOpenMeteoApiKey, normalizeForecastSourceMode, normalizeOpenMeteoPvArrays, readSetting, text |
| [`coordinate`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L418) | value | Number, Number.isFinite, value.trim |
| [`validCoordinatePair`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L425) | latitude, longitude | Math.abs |
| [`normalizeCountryCode`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L432) | value | raw.toLowerCase, raw.toUpperCase, text |
| [`meaningfulLocationLabel`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L447) | value | generic.includes, raw.toLowerCase, text |
| [`systemLocationHints`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L461) | common | meaningfulLocationLabel, normalizeCountryCode, text |
| [`geocodeSystemLocation`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L473) | adapter, settings, common, deadline | Array.from, Array.isArray, Date.now, JSON.stringify, Number.isFinite, encodeURIComponent, preferred.name.trim, requestJson, results.find, systemLocationHints, validCoordinatePair |
| [`resolveLocation`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L513) | adapter, settings, deadline | adapter._nwGetSystemGeo, adapter.getForeignObjectAsync, adapter.getStateAsync, coordinate, geocodeSystemLocation, latitude.toFixed, meaningfulLocationLabel, settings.latitude.toFixed, settings.longitude.toFixed, systemLocationHints, validCoordinatePair |
| [`requestJson`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L574) | adapter, url, deadline | Math.floor, Math.min, adapter._nwHttpsGetJson, performance.now, requestOpenMeteoJson |
| [`openMeteoSolarPosition`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L582) | timestampMs, latitude, longitude | Math.asin, Math.atan2, Math.cos, Math.sin, Math.tan, clamp |
| [`openMeteoPlaneOfArrayIrradiance`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L604) | timestampMs, latitude, longitude, array, ghi, dni, dhi | Math.cos, Math.max, Math.sin, openMeteoSolarPosition |
| [`validatedForecastBlock`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L618) | block, fields | Array.isArray, block.time.map, fields.every, timestamps.every |
| [`assertForecastCoverage`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L630) | time, settings, nowMs | Math.min, forecastTimestamp |
| [`seriesValue`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L638) | data, key, index | – |
| [`forecastTimestamp`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L642) | value | Date.parse, Number.isFinite, value.endsWith |
| [`buildOpenMeteoPvCurve`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L651) | data, settings, location, nowMs | Math.max, Math.min, Math.round, Number.isFinite, assertForecastCoverage, clamp, curve.push, curve.sort, forecastTimestamp, interpolate, openMeteoPlaneOfArrayIrradiance, validatedForecastBlock |
| [`interpolate`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L668) | key | seriesValue |
| [`tiltedForecastBlock`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L695) | data | Array.isArray, validatedForecastBlock |
| [`buildOpenMeteoTiltedPvCurve`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L712) | responses, settings, nowMs | Math.ceil, Math.max, Math.min, Number.isFinite, assertForecastCoverage, clamp, contributorsByTimestamp.get, contributorsByTimestamp.set, durationByTimestamp.set, forecastTimestamp, powerByTimestamp.entries, powerByTimestamp.get, powerByTimestamp.set, tiltedForecastBlock |
| [`mergePvCurves`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L766) | curves | Array.isArray, Math.max, Math.min, Number.isFinite, contributorsByTimestamp.get, contributorsByTimestamp.set, durationByTimestamp.get, durationByTimestamp.set, finite, powerByTimestamp.entries, powerByTimestamp.get, powerByTimestamp.set |
| [`assertCompletePvCurve`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L789) | curve, settings, nowMs | Math.min, curve.some |
| [`integrateKwh`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L799) | curve, nowMs, hours | curve.reduce |
| [`normalizeFutureCurve`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L808) | value, nowMs | Array.isArray, raw.some |
| [`buildLastGoodSnapshot`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L825) | previous, nowMs, details | Math.max, Math.round, curve.filter, finite, integrateKwh, normalizeFutureCurve, text |
| [`invalidSnapshot`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L873) | nowMs, error, settings, location, requestStatus, requestMode, lastAttemptAt | settings?.arrays.reduce |
| [`ensureState`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L896) | adapter, id, type, role, unit | adapter.setObjectNotExistsAsync |
| [`mirrorForecastUiState`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L908) | adapter, id, value, timestamp | Date.now, Object.is, adapter.updateValue |
| [`writeForecastState`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L916) | adapter, id, value, timestamp | Date.now, adapter.setStateAsync, mirrorForecastUiState, safeOpenMeteoError |
| [`warnForecastStateWriteFailures`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L926) | adapter, scope, failures | Date.now, adapter.log?.warn, failures.slice, finite |
| [`readPersistedForecastState`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L935) | adapter, key | adapter.getStateAsync |
| [`restoreRecentPersistedSnapshot`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L948) | adapter | Date.now, Math.max, Math.round, Object.fromEntries, Promise.all, adapter.log?.debug, asBoolean, buildLastGoodSnapshot, clamp, finite, keys.map, parseJson, text |
| [`publish`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L1000) | adapter, value | Date.now, JSON.stringify, Number, Object.entries, ensureState, failures.push, value.curve.slice, value.kwhNext12h.toFixed, value.kwhNext24h.toFixed, value.kwhNext6h.toFixed, warnForecastStateWriteFailures, writeForecastState |
| [`publishAttempt`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L1035) | adapter, nowMs, settings, location | Object.entries, ensureState, failures.push, settings.arrays.reduce, warnForecastStateWriteFailures, writeForecastState |
| [`refresh`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L1063) | adapter | Date.now, Math.ceil, Math.max, Math.min, adapter.log?.debug, assertCompletePvCurve, buildLastGoodSnapshot, buildOpenMeteoPvCurve, buildOpenMeteoTiltedPvCurve, curve.filter, curveParts.every, curveParts.push, encodeURIComponent, integrateKwh (weitere in der Quelle) |
| [`requestTiltedArrays`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L1117) | arrays, mode | Promise.allSettled, arrays.map, errors.push, missing.push, responses.push, safeOpenMeteoError |
| [`startOpenMeteoPvForecastRuntime`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L1281) | adapter | cycle |
| [`clear`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L1285) | – | adapter.clearTimeout, clearTimeout |
| [`cycle`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L1291) | – | Date.now, clear, invalidSnapshot |
| [`callback`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L1308) | – | cycle |
| [`stop`](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts#L1315) | – | clear |
