# src-ts/runtime-executables/ems/modules/energy-ledger.ts

Verknüpft die Energiebilanz-/Ledger-Funktion mit dem Laufzeitkontext und den dafür veröffentlichten Werten.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./base` | [src-ts/runtime-executables/ems/modules/base.ts](../../../../../../src-ts/runtime-executables/ems/modules/base.ts) |
| `../services/energy-origin-ledger-runtime` | [src-ts/runtime-executables/ems/services/energy-origin-ledger-runtime.ts](../../../../../../src-ts/runtime-executables/ems/services/energy-origin-ledger-runtime.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`safeId`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L57) | input, fallback | String |
| [`normalizeLp`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L65) | input | Math.max, Math.round, Number, String, s.match, safeId |
| [`num`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L71) | value, fallback | Number, Number.isFinite |
| [`round`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L76) | value, digits | Math.max, Math.min, Math.pow, Math.round, Number, Number.isFinite |
| [`localDayKey`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L83) | ms | Date.now, Number, String, d.getDate, d.getFullYear, d.getMonth |
| [`localMonthKey`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L88) | ms | Date.now, Number, String, d.getFullYear, d.getMonth |
| [`localYearKey`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L93) | ms | Date.now, Number, String, d.getFullYear |
| [`emptyPeriod`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L98) | – | – |
| [`uniquePush`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L112) | list, value | String, list.includes, list.push |
| [`addToPeriod`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L119) | acc, entry | num, round, uniquePush |
| [`buildKwhSourceMix`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L132) | totalKwh, solarKwh, gridKwh, valueEur | Math.max, Math.min, part, round, rows.filter, rows.push |
| [`part`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L138) | source, label, kwh, local | Math.max, Math.min, Math.round, Number, round |
| [`addEntrySourceFields`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L163) | entry | buildKwhSourceMix |
| [`filterEntriesByPeriod`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L174) | entries, period, keys | Array.isArray, String, list.filter, list.slice |
| [`sourceSummaryFromEntries`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L184) | entries | Array.isArray, Number, Object.create, Object.values, String, addEntrySourceFields, safeId |
| [`roundRow`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L203) | row | Object.prototype.hasOwnProperty.call, round |
| [`csvFoundationForPeriod`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L216) | period, entries, summary | Date.now, String, encodeURIComponent, filterEntriesByPeriod, filtered.map |
| [`buildWalletBridge`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L231) | summary, sourceSummary | Date.now |
| [`buildOperatorView`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L246) | summary, entries, sourceSummary | Array.isArray, Date.now |
| [`normalizeSessionEntry`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L266) | station, lpRaw, row | Date.now, Math.max, Math.min, Math.round, String, buildKwhSourceMix, localDayKey, localMonthKey, localYearKey, normalizeLp, num, round, safeId |
| [`sanitizeStations`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L327) | cfg | Array.isArray, rows.map |
| [`EnergyLedgerModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L342) | adapter, dpRegistry | emptyPeriod, localDayKey, localMonthKey, localYearKey, super |
| [`EnergyLedgerModule._cfg`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L357) | – | – |
| [`EnergyLedgerModule._recentLimit`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L363) | – | Math.max, Math.min, Math.round, Number, Number.isFinite, this._cfg |
| [`EnergyLedgerModule._processedLimit`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L368) | – | Math.max, Math.min, Math.round, Number, Number.isFinite, this._cfg |
| [`EnergyLedgerModule._isEnabled`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L373) | – | this._cfg |
| [`EnergyLedgerModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L383) | – | this._ensureStates, this._originLedger.init, this._primeFromStates, this._publish |
| [`EnergyLedgerModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L390) | – | this._ensurePeriodRollovers, this._isEnabled, this._originLedger.tick, this._publish, this._scanChargeKioskSessions |
| [`EnergyLedgerModule._ensureStates`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L401) | – | channel, mk, this._ensurePeriodStates |
| [`channel`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L404) | id, name | a.setObjectNotExistsAsync |
| [`mk`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L405) | id, name, type, role, unit, def | a.setObjectNotExistsAsync |
| [`EnergyLedgerModule._ensurePeriodStates`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L461) | prefix, label, mk | mk |
| [`EnergyLedgerModule._primeFromStates`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L477) | – | Array.isArray, this._readJsonState, this._readPeriod |
| [`EnergyLedgerModule._readJsonState`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L488) | id, fallback | JSON.parse, this.adapter.getStateAsync |
| [`EnergyLedgerModule._readNumberState`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L499) | id, fallback | Number, Number.isFinite, this.adapter.getStateAsync |
| [`EnergyLedgerModule._readStringState`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L509) | id, fallback | String, this.adapter.getStateAsync |
| [`EnergyLedgerModule._readPeriod`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L518) | prefix, expectedKey | Array.isArray, Math.max, Math.round, emptyPeriod, this._readJsonState, this._readNumberState, this._readStringState |
| [`EnergyLedgerModule._ensurePeriodRollovers`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L536) | – | Date.now, emptyPeriod, localDayKey, localMonthKey, localYearKey |
| [`EnergyLedgerModule._scanChargeKioskSessions`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L546) | – | Object.entries, added.push, normalizeSessionEntry, safeId, sanitizeStations, this._acceptEntry, this._processed.has, this._readJsonState |
| [`EnergyLedgerModule._acceptEntry`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L574) | entry | Array.from, Math.max, addEntrySourceFields, addToPeriod, processed.slice, this._processed.add, this._processedLimit, this._recentEntries.slice, this._recentEntries.unshift, this._recentLimit |
| [`EnergyLedgerModule._periodSummary`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L589) | acc, key | Array.isArray, Math.max, Math.round, num, round |
| [`EnergyLedgerModule._publish`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L609) | status, scan | Array.from, Array.isArray, Date.now, JSON.stringify, Number, String, a.setStateAsync, buildOperatorView, buildWalletBridge, csvFoundationForPeriod, entries.slice, sourceSummaryFromEntries, this._isEnabled, this._periodSummary (weitere in der Quelle) |
| [`EnergyLedgerModule._writePeriod`](../../../../../../src-ts/runtime-executables/ems/modules/energy-ledger.ts#L687) | prefix, data | JSON.stringify, a.setStateAsync |
