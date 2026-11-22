# src-ts/runtime-executables/ems/modules/pv-forecast.ts

Verknüpft konfigurierte PV-Prognosequellen und die automatische Prognose mit den von Planung und Anzeige verwendeten Werten.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./base` | [src-ts/runtime-executables/ems/modules/base.ts](../../../../../../src-ts/runtime-executables/ems/modules/base.ts) |
| `../services/open-meteo-pv-forecast` | [src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts](../../../../../../src-ts/runtime-executables/ems/services/open-meteo-pv-forecast.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`PvForecastModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L57) | adapter, dpRegistry | super |
| [`PvForecastModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L79) | – | String, mk, this.adapter.setObjectNotExistsAsync, this.dp.upsert |
| [`mk`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L105) | id, name, type, role | this.adapter.setObjectNotExistsAsync |
| [`PvForecastModule._safeJsonParse`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L162) | v | JSON.parse, String |
| [`PvForecastModule._parseTimeMs`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L186) | x | Date.now, Date.parse, Number.isFinite, String, dt.getTime, now.getDate, now.getFullYear, now.getMonth, parseInt, s.includes, s.match, s.replace, x.getTime |
| [`PvForecastModule._num`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L270) | v | Number, Number.isFinite, s.includes, s.replace, v.trim |
| [`PvForecastModule._powerToW`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L298) | n, keyHint | Number, Number.isFinite, String, k.includes |
| [`PvForecastModule._extractSegmentsFromParsed`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L320) | parsed | Array.isArray, this._looksLikeTimeMap, this._segmentsFromArray, this._segmentsFromEnergyMap, this._segmentsFromTimeMap |
| [`PvForecastModule._looksLikeTimeMap`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L379) | obj | Math.floor, Math.max, Math.min, Object.keys, keys.slice, this._parseTimeMs |
| [`PvForecastModule._segmentsFromArray`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L405) | arr | Array.isArray, Number.isFinite, Object.keys, out.push, pick, this._inferDtForAnchors, this._num, this._parseTimeMs, this._powerToW |
| [`pick`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L426) | candidates | Object.prototype.hasOwnProperty.call |
| [`PvForecastModule._segmentsFromTimeMap`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L503) | mapObj | Number.isFinite, Object.entries, anchors.push, this._inferDtForAnchors, this._num, this._parseTimeMs, this._powerToW |
| [`PvForecastModule._segmentsFromEnergyMap`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L531) | energyMapObj, defaultDtMs | Math.max, Number.isFinite, Object.entries, anchors.push, anchors.sort, this._num, this._parseTimeMs |
| [`PvForecastModule._inferDtForAnchors`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L562) | list | Array.isArray, Math.floor, Number.isFinite, anchors.sort, diffs.push, diffs.sort, explicit.map, list.filter, segs.filter, segs.push, segs.sort |
| [`PvForecastModule._integrateKwh`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L616) | segments, fromMs, toMs, clampW | Array.isArray, Math.max, Math.min, Number, Number.isFinite |
| [`PvForecastModule._syncForecastUiCache`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L656) | id, value, ts | Date.now, Object.is, this.adapter.updateValue |
| [`PvForecastModule._setIfChanged`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L668) | id, val | Date.now, this._syncForecastUiCache, this.adapter.getStateAsync, this.adapter.setStateAsync |
| [`PvForecastModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L703) | – | Array.isArray, Date.now, JSON.stringify, Math.max, Math.min, Math.round, Number, Number.isFinite, String, asBoolean, buildPvForecastDiagnostics, cachedSetting, integrated.curve.slice, kwh12.toFixed (weitere in der Quelle) |
| [`cachedSetting`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L706) | key, fallback | – |
| [`asBoolean`](../../../../../../src-ts/runtime-executables/ems/modules/pv-forecast.ts#L712) | value, fallback | String |
