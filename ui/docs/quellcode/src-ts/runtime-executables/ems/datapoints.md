# src-ts/runtime-executables/ems/datapoints.ts

Löst konfigurierte Datenpunkt-Schlüssel auf und stellt der Regelung gelesene Werte sowie kontrollierte Schreibzugriffe bereit.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/ems/datapoints.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `../lib/mesh-coordinator-writer` | [src-ts/runtime-executables/lib/mesh-coordinator-writer.ts](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-writer.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/engine.ts](../../../../../src-ts/runtime-executables/ems/engine.ts)
- [src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts](../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`_normalizeUnit`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L77) | unit | String |
| [`_computeUnitScale`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L87) | fromUnit, toUnit | Object.prototype.hasOwnProperty.call, _normalizeUnit |
| [`DatapointRegistry.constructor`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L125) | adapter, entries | Array.isArray |
| [`DatapointRegistry._deriveAlivePrefix`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L219) | id | String, s.lastIndexOf, s.match, s.slice |
| [`DatapointRegistry.init`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L248) | – | this.upsert |
| [`DatapointRegistry.upsert`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L270) | entry | Date.now, Math.abs, Math.max, Number, Number.isFinite, String, _computeUnitScale, connIds.push, normalized.alivePrefix.endsWith, srcForInst.match, this._aliasFetchAttemptMs.get, this._aliasFetchAttemptMs.set, this._aliasIdByObjectId.get, this._aliasIdByObjectId.has (weitere in der Quelle) |
| [`DatapointRegistry._updateCacheStateReferences`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L601) | previous, next | ids, nextIds.has, previousIds.has, this._cacheStateGenerations.delete, this._cacheStateGenerations.set, this._cacheStateReferences.delete, this._cacheStateReferences.get, this._cacheStateReferences.has, this._cacheStateReferences.set, this._primedObjectIds.delete, this.cacheByObjectId.delete |
| [`ids`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L602) | entry | – |
| [`DatapointRegistry._primeMappedState`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L632) | id | this._cacheStateGenerations.get, this._primedObjectIds.add, this.adapter.getForeignStateAsync, this.cacheByObjectId.has, this.handleStateChange |
| [`DatapointRegistry.handleStateChange`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L663) | id, state, prime | Date.now, Number, Number.isFinite, id.startsWith, this._alivePrefixTs.keys, this._alivePrefixTs.set, this._cacheStateGenerations.get, this._cacheStateReferences.has, this.cacheByObjectId.delete, this.cacheByObjectId.set |
| [`DatapointRegistry.getEntry`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L719) | key | String, this.byKey.get |
| [`DatapointRegistry.getRaw`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L739) | key | this.cacheByObjectId.get, this.getEntry |
| [`DatapointRegistry.getMeasurementTimestampMs`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L747) | key | Number, Number.isFinite, this.cacheByObjectId.get, this.getEntry |
| [`DatapointRegistry.getMeasurementAgeMs`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L756) | key | Date.now, Math.max, this.getMeasurementTimestampMs |
| [`DatapointRegistry.getReceivedAgeMs`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L763) | key | Date.now, Math.max, Number, Number.isFinite, this.cacheByObjectId.get, this.getEntry |
| [`DatapointRegistry.getConnectionStatus`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L776) | key | String, connIds.push, this.cacheByObjectId.get, this.getEntry |
| [`DatapointRegistry.getAgeMs`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L812) | key | Date.now, Math.min, Number, Number.isFinite, this._alivePrefixTs.get, this.cacheByObjectId.get, this.getEntry |
| [`DatapointRegistry.getAliveAgeMs`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L867) | key | Date.now, Math.min, Number, Number.isFinite, ages.push, this._alivePrefixTs.get, this.cacheByObjectId.get, this.getEntry |
| [`DatapointRegistry.isStale`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L924) | key, maxAgeMs | Number.isFinite, this.getAgeMs |
| [`DatapointRegistry.getNumberFresh`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L951) | key, maxAgeMs, fallback | this.getNumber, this.isStale |
| [`DatapointRegistry.getNumber`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L972) | key, fallback | Math.max, Math.min, Number, Number.isFinite, raw.trim, s.includes, s.lastIndexOf, s.replace, this.getEntry, this.getRaw |
| [`DatapointRegistry.getBoolean`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L1043) | key, fallback | raw.trim, this.getEntry, this.getRaw |
| [`DatapointRegistry.writeNumber`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L1069) | key, value, ack | Date.now, Math.abs, Math.max, Math.min, Number, Number.isFinite, arbiter.guardSkippedWrite, require, this.adapter.log.warn, this.adapter.setForeignStateAsync, this.getEntry, this.lastWriteByObjectId.delete, this.lastWriteByObjectId.get, this.lastWriteByObjectId.set |
| [`DatapointRegistry.writeBoolean`](../../../../../src-ts/runtime-executables/ems/datapoints.ts#L1128) | key, value, ack | Date.now, Number, Number.isFinite, arbiter.guardSkippedWrite, this.adapter.log.warn, this.adapter.setForeignStateAsync, this.getEntry, this.lastWriteByObjectId.get, this.lastWriteByObjectId.set |
