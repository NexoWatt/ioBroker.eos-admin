# src-ts/runtime-executables/ems/modules/tariff-provider.ts

Lädt Tarifdaten über die registrierten Anbieter und stellt sie der weiteren Tarifverarbeitung bereit.

**Daten und Wirkung:** Liest HTTPS-Tarife außerhalb des lokalen Regelticks mit höchstens einem Abruf und 5 s Gesamtabrufbudget; Stop und Quellwechsel brechen den Abruf ab. Auch ein leerer Cache hält nach Fehlern den geplanten Wiederholabstand ein. Erst vollständig validierte Intervalle aktualisieren Preis-States und Erfolgszeit. Bei Fehlern verbleibt der letzte gültige Stand bis zur konfigurierten Frischegrenze; danach werden Preise null und Kurven leer.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./base` | [src-ts/runtime-executables/ems/modules/base.ts](../../../../../../src-ts/runtime-executables/ems/modules/base.ts) |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `../services/tariff-provider-registry` | [src-ts/runtime-executables/ems/services/tariff-provider-registry.ts](../../../../../../src-ts/runtime-executables/ems/services/tariff-provider-registry.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`stableConfiguration`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L34) | value | JSON.stringify, visit |
| [`visit`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L36) | item, depth | Array.isArray, Object.entries, Object.fromEntries, entries.push, item.map, visit |
| [`TariffProviderModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L62) | adapter, dpRegistry | Promise.resolve, super, this._captureConfiguration, this._fencePriceReaders |
| [`TariffProviderModule._fencePriceReaders`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L85) | – | OPERATIONAL_PRICE_STATES.map |
| [`TariffProviderModule._captureConfiguration`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L90) | – | JSON.parse, createHash, stableConfiguration, this._cfg |
| [`TariffProviderModule._isCurrent`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L101) | generation | – |
| [`TariffProviderModule.applyTariffMappings`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L107) | – | changed.push, this.adapter.emsEngine?.mm?.modules?.find, this.dp.getEntry, this.dp.remove, trim, vis?._getVisPriceAverageId, vis?._getVisPriceCurrentId, vis?._getVisPriceTodayJsonId, vis?._getVisPriceTomorrowJsonId |
| [`trim`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L112) | value | value.trim |
| [`TariffProviderModule.invalidateConfiguration`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L147) | – | Date.now, Promise.resolve, this._captureConfiguration, this._fencePriceReaders, this._fetchAbort?.abort, this._publish, this.adapter.keyFromId, this.adapter.updateValue, this.dp?.handleStateChange |
| [`TariffProviderModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L185) | – | mk, this.adapter.setObjectNotExistsAsync |
| [`mk`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L191) | id, name, type, role, unit | this.adapter.setObjectNotExistsAsync |
| [`TariffProviderModule._cfg`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L217) | – | Math.max, Math.min, Math.round, Number, String, this._providerSourceId |
| [`TariffProviderModule._set`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L243) | id, val, generation | this._isCurrent, this.adapter.setStateAsync |
| [`TariffProviderModule._providerSourceId`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L249) | cfg | String |
| [`TariffProviderModule._localHour`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L256) | nowMs, timeZone | Number, String |
| [`TariffProviderModule._stableJitterFactor`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L268) | seed | Math.imul, String, text.charCodeAt |
| [`TariffProviderModule._baseRefreshMinutes`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L281) | cfg, nowMs | Math.max, Math.min, Math.round, Number, splitTodayTomorrow, this._localHour, this._providerSourceId |
| [`TariffProviderModule._scheduleNextFetch`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L301) | cfg, nowMs, success | Math.floor, Math.max, Math.min, Math.pow, Math.round, Number, this._baseRefreshMinutes, this._providerSourceId, this._stableJitterFactor |
| [`TariffProviderModule._setTariffSettings`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L330) | cfg, generation | Number, String, this._isCurrent, this.adapter.getForeignStateAsync, this.adapter.log.debug, this.adapter.setForeignStateAsync |
| [`TariffProviderModule._publish`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L350) | cfg, nowMs, statusOverride, generation | pending.catch, this._publicationTail.then |
| [`TariffProviderModule._publishCurrent`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L356) | cfg, nowMs, statusOverride, generation | JSON.stringify, Number.isFinite, String, currentAndAverage, set, splitTodayTomorrow, this._intervals.find, this._isCurrent |
| [`set`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L358) | id, val | this._set |
| [`TariffProviderModule._refresh`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L445) | cfg, nowMs, generation, signal | Array.isArray, Date.now, String, fetchProvider, intervals.some, this._isCurrent, this._publish, this._scheduleNextFetch, this.adapter.log.warn, this.invalidateConfiguration |
| [`TariffProviderModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L480) | – | Date.now, this._isCurrent, this._publish, this._refresh, this._setTariffSettings, this.invalidateConfiguration |
| [`TariffProviderModule.stop`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-provider.ts#L540) | – | this._fetchAbort?.abort |
