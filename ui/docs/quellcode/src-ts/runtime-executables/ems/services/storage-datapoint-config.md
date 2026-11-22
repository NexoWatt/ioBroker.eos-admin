# src-ts/runtime-executables/ems/services/storage-datapoint-config.ts

Normalisiert Speicher-Datenpunktzuordnungen für Messung und Steuerung.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./fenecon-hybrid-control` | [src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/storage-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts)
- [src-ts/runtime-executables/ems/modules/storage-mapping.ts](../../../../../../src-ts/runtime-executables/ems/modules/storage-mapping.ts)
- [src-ts/runtime-executables/ems/services/storage-override-bridge.ts](../../../../../../src-ts/runtime-executables/ems/services/storage-override-bridge.ts)
- [src-ts/runtime-executables/main.ts](../../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`isRecord`](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts#L49) | value | Array.isArray |
| [`own`](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts#L53) | root, key | Object.prototype.hasOwnProperty.call |
| [`text`](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts#L57) | value | String |
| [`looksLikeCompleteObjectId`](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts#L67) | value | id.includes, text |
| [`aliasKey`](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts#L108) | spec | – |
| [`aliasRequiresFullId`](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts#L112) | spec | – |
| [`firstCandidate`](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts#L116) | roots, specs, fullOnly | aliasKey, aliasRequiresFullId, looksLikeCompleteObjectId, own, text |
| [`migrateFeneconCommandRoles`](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts#L142) | storageIn, datapointsIn | isFeneconHybrid, isLikelyDirectEssSetpointObjectId, isLikelyFemsGridMeasurementObjectId, isLikelyFemsGridTargetObjectId, isRecord, normalizeFeneconControlMode, text |
| [`normalizeStorageDatapointsConfig`](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts#L212) | storageIn | Array.isArray, firstCandidate, isRecord, looksLikeCompleteObjectId, migrateFeneconCommandRoles, own, text |
| [`explicitPowerScale`](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts#L257) | settings, key | isRecord, own |
| [`buildStorageMeasurementFallbackFromGlobal`](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts#L268) | configIn | explicitPowerScale, isRecord, text |
| [`mergeStorageMeasurementFallback`](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts#L320) | storageIn, fallbackIn | isRecord, normalizeStorageDatapointsConfig, text |
