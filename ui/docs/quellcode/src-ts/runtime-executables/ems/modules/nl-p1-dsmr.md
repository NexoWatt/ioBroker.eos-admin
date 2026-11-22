# src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts

Bindet die P1-/DSMR-bezogenen Zählerdaten und deren Konfiguration in den EMS-Kontext ein.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./base` | [src-ts/runtime-executables/ems/modules/base.ts](../../../../../../src-ts/runtime-executables/ems/modules/base.ts) |
| `../services/country-profile-service` | [src-ts/runtime-executables/ems/services/country-profile-service.ts](../../../../../../src-ts/runtime-executables/ems/services/country-profile-service.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`num`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L34) | v, fallback | Number, Number.isFinite |
| [`round`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L39) | v, digits | Math.max, Math.min, Math.pow, Math.round, Number, Number.isFinite |
| [`clamp`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L46) | v, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`dayKeyLocal`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L52) | date | String, date.getDate, date.getFullYear, date.getMonth |
| [`monthKeyLocal`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L55) | date | String, date.getFullYear, date.getMonth |
| [`yearKeyLocal`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L58) | date | String, date.getFullYear |
| [`normalizePrice`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L62) | value, fallback | Math.abs, Number.isFinite, num |
| [`emptyPeriod`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L71) | – | – |
| [`NlP1DsmrModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L82) | adapter, dpRegistry | dayKeyLocal, emptyPeriod, monthKeyLocal, super, yearKeyLocal |
| [`NlP1DsmrModule._cfg`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L97) | – | – |
| [`NlP1DsmrModule._country`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L103) | – | String, profileSvc.getConfiguredCountryProfile |
| [`NlP1DsmrModule._datapoints`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L112) | – | this._cfg |
| [`NlP1DsmrModule._isEnabled`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L117) | – | Object.keys, this._cfg, this._country, this._datapoints |
| [`NlP1DsmrModule._staleMs`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L126) | – | Math.round, Number, clamp, this._cfg |
| [`NlP1DsmrModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L132) | – | this._emptySnapshot, this._ensureStates, this._primeFromStates, this._publish, this._registerDatapoints |
| [`NlP1DsmrModule._registerDatapoints`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L139) | – | id.trim, this._datapoints, this.dp.upsert |
| [`NlP1DsmrModule._ensureStates`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L158) | – | ch, mk |
| [`ch`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L161) | id, name | a.setObjectNotExistsAsync |
| [`mk`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L162) | id, name, type, role, unit, def | a.setObjectNotExistsAsync |
| [`NlP1DsmrModule._primeFromStates`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L219) | – | read |
| [`read`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L222) | id | a.getStateAsync, num |
| [`NlP1DsmrModule._readStateNumber`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L233) | ids, fallback | Number.isFinite, Object.prototype.hasOwnProperty.call, num |
| [`NlP1DsmrModule._emptySnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L248) | status | this._country, this._isEnabled, this._prices, this._readStateNumber |
| [`NlP1DsmrModule._prices`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L268) | – | normalizePrice, this._cfg, this._readStateNumber |
| [`NlP1DsmrModule._readDp`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L279) | key, staleMs, positive | Math.max, Math.round, Number, Number.isFinite, this.dp.getAgeMs, this.dp.getEntry, this.dp.getNumber, this.dp.isStale |
| [`NlP1DsmrModule._snapshot`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L288) | – | Math.max, Number, String, clamp, round, this._country, this._isEnabled, this._prices, this._readDp, this._readStateNumber, this._staleMs, this.dp.getEntry, this.dp.getRaw, this.dp.isStale (weitere in der Quelle) |
| [`NlP1DsmrModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L334) | – | Date.now, Math.max, Math.min, Number.isFinite, dayKeyLocal, emptyPeriod, monthKeyLocal, this._addEnergy, this._publish, this._registerDatapoints, this._snapshot, yearKeyLocal |
| [`NlP1DsmrModule._addEnergy`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L368) | importKwh, exportKwh, prices | Math.max, Number |
| [`NlP1DsmrModule._periodSummary`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L383) | period, key | round |
| [`NlP1DsmrModule._publish`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L395) | reason, snap | Date.now, JSON.stringify, Math.max, Math.round, String, round, set, this._periodSummary |
| [`set`](../../../../../../src-ts/runtime-executables/ems/modules/nl-p1-dsmr.ts#L449) | id, val | a.setStateAsync |
