# src-ts/runtime-executables/ems/modules/energy-wallet.ts

Bereitet Energiekonto-/Wallet-Werte und deren Zuordnung innerhalb des EMS auf.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./base` | [src-ts/runtime-executables/ems/modules/base.ts](../../../../../../src-ts/runtime-executables/ems/modules/base.ts) |
| `../../lib/tariff-price` | [src-ts/runtime-executables/lib/tariff-price.ts](../../../../../../src-ts/runtime-executables/lib/tariff-price.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`num`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L60) | v, fallback | Number, Number.isFinite |
| [`round`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L64) | v, digits | Math.max, Math.min, Math.pow, Math.round, Number, Number.isFinite |
| [`clamp`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L71) | v, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`todayKeyLocal`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L77) | date | String, date.getDate, date.getFullYear, date.getMonth |
| [`monthKeyLocal`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L84) | date | String, date.getFullYear, date.getMonth |
| [`yearKeyLocal`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L90) | date | String, date.getFullYear |
| [`normalizePriceEurPerKwh`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L94) | value, fallback, explicitEur | Math.abs, Number.isFinite, tariffPriceNumber |
| [`emptyAcc`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L104) | – | – |
| [`EnergyWalletModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L128) | adapter, dpRegistry | emptyAcc, monthKeyLocal, super, this._emptyDiagnostics, todayKeyLocal, yearKeyLocal |
| [`EnergyWalletModule._emptyAcc`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L142) | – | emptyAcc |
| [`EnergyWalletModule._emptyDiagnostics`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L144) | status | Date.now |
| [`EnergyWalletModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L160) | – | this._ensureStates, this._primeFromStates, this._publish |
| [`EnergyWalletModule._ensureStates`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L166) | – | a.setObjectNotExistsAsync, mk, this._ensurePeriodStates |
| [`mk`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L216) | id, name, type, role, unit, def | a.setObjectNotExistsAsync |
| [`EnergyWalletModule._ensurePeriodStates`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L286) | prefix, keyLabel, defKey, mk | keyLabel.toLowerCase, mk, prefix.endsWith |
| [`EnergyWalletModule._primeFromStates`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L308) | – | emptyAcc, monthKeyLocal, this._primePeriod, todayKeyLocal, yearKeyLocal |
| [`EnergyWalletModule._primePeriod`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L328) | prefix, keyName, expectedKey | Math.max, Number.isFinite, String, a.getStateAsync, emptyAcc, num |
| [`EnergyWalletModule._cacheEntry`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L343) | key | Date.now, Object.prototype.hasOwnProperty.call, String |
| [`EnergyWalletModule._readCacheCandidate`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L355) | keys, options | Array.isArray, Date.now, Math.abs, Math.max, Math.sign, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String, num, staleSeen.push, this._cacheEntry |
| [`EnergyWalletModule._readCacheNumber`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L389) | keys, fallback | Number, Number.isFinite, this._maxPlausiblePowerW, this._readCacheCandidate, this._staleMs |
| [`EnergyWalletModule._readStateNumber`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L394) | keys, fallback | Array.isArray, Object.prototype.hasOwnProperty.call, tariffPriceNumber, this._cacheEntry |
| [`EnergyWalletModule._readStateCandidate`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L410) | keys, maxAgeSec | Array.isArray, Date.now, Math.max, Math.round, Number.isFinite, Object.prototype.hasOwnProperty.call, Reflect.get, String, tariffPriceNumber |
| [`EnergyWalletModule._readStateString`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L434) | keys, fallback | Array.isArray, Object.prototype.hasOwnProperty.call, String |
| [`EnergyWalletModule._readStateBool`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L457) | keys, fallback | Array.isArray, Object.prototype.hasOwnProperty.call, String, this._cacheEntry |
| [`EnergyWalletModule._readJsonState`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L473) | keys, fallback | Array.isArray, JSON.parse, Object.prototype.hasOwnProperty.call, raw.trim, this._cacheEntry |
| [`EnergyWalletModule._ledgerBridge`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L490) | – | Number, String, round, this._readJsonState |
| [`EnergyWalletModule._cfg`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L512) | – | – |
| [`EnergyWalletModule._staleMs`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L518) | – | Math.round, Number, Number.isFinite, clamp, this._cfg |
| [`EnergyWalletModule._maxPlausiblePowerW`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L524) | – | Math.round, clamp, this._cfg |
| [`EnergyWalletModule._nlBridge`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L537) | – | JSON.parse, Number, this._readStateString |
| [`EnergyWalletModule._exportGuardBridge`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L560) | – | JSON.parse, Math.max, String, num, val |
| [`val`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L562) | id, fallback | Object.prototype.hasOwnProperty.call |
| [`num`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L573) | v, fallback | Number, Number.isFinite |
| [`EnergyWalletModule._prices`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L585) | – | Math.round, Number, Number.isFinite, clamp, normalizePriceEurPerKwh, this._cfg, this._readStateBool, this._readStateCandidate, this._readStateNumber |
| [`EnergyWalletModule._snapshotPower`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L676) | – | Date.now, Math.max, Math.min, Number, Number.isFinite, clamp, clippedSources.join, installerWarningParts.join, installerWarningParts.push, missingSources.join, missingSources.push, read, round, staleSources.join (weitere in der Quelle) |
| [`read`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L687) | label, keys, opts | c.staleSeen.map, clippedRequiredSources.push, clippedSources.push, requiredLabels.has, staleRequiredSources.push, staleSources.push, this._readCacheCandidate |
| [`EnergyWalletModule._isEnabled`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L798) | – | this._cfg, this._readStateBool |
| [`EnergyWalletModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L807) | – | Date.now, Math.max, Math.min, Number, Number.isFinite, emptyAcc, monthKeyLocal, this._addDelta, this._emptyDiagnostics, this._isEnabled, this._prices, this._publish, this._snapshotPower, this.adapter.setStateAsync (weitere in der Quelle) |
| [`EnergyWalletModule._addDelta`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L916) | target, delta | Math.max, Number, Number.isFinite |
| [`EnergyWalletModule._periodSummary`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L923) | acc, key | round |
| [`EnergyWalletModule._summary`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L950) | status | Date.now, this._buildExplanation, this._emptyDiagnostics, this._exportGuardBridge, this._isEos, this._ledgerBridge, this._periodSummary, this._prices |
| [`EnergyWalletModule._isEos`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L986) | – | String |
| [`EnergyWalletModule._buildExplanation`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L991) | valueEur, localUsePercent, diagnostics, month, year | Math.round, Number, String, round |
| [`EnergyWalletModule._publish`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L1005) | status | JSON.stringify, Math.max, Math.round, Number, String, round, set, this._emptyDiagnostics, this._isEnabled, this._nlBridge, this._publishPeriod, this._summary |
| [`set`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L1009) | id, val | Date.now, a.setStateAsync, a.updateValue |
| [`EnergyWalletModule._publishPeriod`](../../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts#L1084) | prefix, keyName, periodKey, summary, set | set |
