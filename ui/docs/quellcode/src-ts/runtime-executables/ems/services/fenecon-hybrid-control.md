# src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts

Kapselt Fenecon-spezifische Betriebs- und Sollwertbedingungen für die Speicher-/Hybridanbindung.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/storage-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts)
- [src-ts/runtime-executables/ems/services/fenecon-nvp-shadow-runtime.ts](../../../../../../src-ts/runtime-executables/ems/services/fenecon-nvp-shadow-runtime.ts)
- [src-ts/runtime-executables/ems/services/storage-datapoint-config.ts](../../../../../../src-ts/runtime-executables/ems/services/storage-datapoint-config.ts)
- [src-ts/runtime-executables/main.ts](../../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`text`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L38) | value | String |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L42) | value | Number, Number.isFinite, value.trim |
| [`clamp`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L50) | value, minValue, maxValue | Math.max, Math.min |
| [`normalizeObjectId`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L57) | value | text |
| [`sameObjectId`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L61) | a, b | normalizeObjectId |
| [`normalizeVendorProfile`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L67) | value | text |
| [`normalizeControlMode`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L75) | value | text |
| [`isFeneconHybrid`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L85) | config | normalizeVendorProfile, text |
| [`getNativeTargetId`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L91) | config | text |
| [`getDirectTargetIds`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L100) | config | – |
| [`getEssActualPowerId`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L115) | config | text |
| [`hasWritableNativeTarget`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L125) | config | getNativeTargetId |
| [`hasWritableDirectTarget`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L129) | config, context | getDirectTargetIds |
| [`isPowerBalanceObjectId`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L134) | value | normalizeObjectId |
| [`isLikelyDirectEssSetpointObjectId`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L142) | value | normalizeObjectId |
| [`isLikelyFemsGridTargetObjectId`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L150) | value | normalizeObjectId |
| [`isLikelyFemsGridMeasurementObjectId`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L158) | value | isLikelyFemsGridTargetObjectId, normalizeObjectId |
| [`resolveControlMode`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L166) | config, context | Math.max, Math.round, finite, getDirectTargetIds, getNativeTargetId, hasWritableDirectTarget, isFeneconHybrid, isLikelyDirectEssSetpointObjectId, isLikelyFemsGridMeasurementObjectId, isLikelyFemsGridTargetObjectId, normalizeControlMode |
| [`resolveHybridAuthority`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L282) | config, runtime | Date.now, Math.max, Math.min, Math.round, finite, resolveControlMode, result, text |
| [`result`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L310) | authority, reason | Math.max |
| [`validateSingleConfig`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L393) | config, context | Array.isArray, directTargetIds.some, getDirectTargetIds, getEssActualPowerId, getNativeTargetId, isFeneconHybrid, isLikelyDirectEssSetpointObjectId, isLikelyFemsGridTargetObjectId, isPowerBalanceObjectId, resolution.effectiveDirectTargetIds.map, resolveControlMode, sameObjectId, text |
| [`calculateFemsGridTargetW`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L473) | input | Math.round, clamp, finite |
| [`calculateFeneconNvpShadow`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L533) | input | Math.abs, Math.max, Math.round, clamp, finite, text |
| [`validateFarmRows`](../../../../../../src-ts/runtime-executables/ems/services/fenecon-hybrid-control.ts#L798) | rowsIn | Array.isArray, configuredRows.map, resolved.filter, resolved.map, rows.filter, rowsIn.filter, text |
