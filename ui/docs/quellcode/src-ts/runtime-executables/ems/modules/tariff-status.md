# src-ts/runtime-executables/ems/modules/tariff-status.ts

Bestimmt aus Tarifdaten und Konfiguration den aktuell für die Energiesteuerung verwendeten Tarifstatus.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./base` | [src-ts/runtime-executables/ems/modules/base.ts](../../../../../../src-ts/runtime-executables/ems/modules/base.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`finiteOrNull`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L41) | value | Number, Number.isFinite, value.trim |
| [`roundedOrNull`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L48) | value | Math.round, finiteOrNull |
| [`boolValue`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L53) | value, fallback | value.trim |
| [`clamp`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L64) | value, min, max | Math.max, Math.min |
| [`cleanText`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L66) | value, maxLen | Math.max, String, text.slice |
| [`directionOf`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L74) | valueW, deadbandW | Math.max, Number, finiteOrNull |
| [`formatPower`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L83) | valueW | Math.abs, roundedOrNull |
| [`safeParseJson`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L89) | value, fallback | JSON.parse, value.trim |
| [`containsAny`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L100) | value, terms | String, terms.some |
| [`buildTariffBaseText`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L105) | tariff | Number, String, boolValue, finiteOrNull, price.toFixed |
| [`buildIntentReason`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L125) | tariff, intentW | String, boolValue, cleanText, directionOf |
| [`buildIntentPart`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L155) | intentW, intentReason | cleanText, directionOf, formatPower |
| [`classifyTariffStorageStatus`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L166) | input | Math.abs, Math.max, Math.round, Number, boolValue, clamp, cleanText, containsAny, directionOf, roundedOrNull, writeStatus.toLowerCase |
| [`buildEffectiveStorageText`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L324) | result, context | Math.abs, Math.max, cleanText, detailParts.join, detailParts.push, formatPower |
| [`buildCompactStorageText`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L394) | result | – |
| [`buildCompactEvcsText`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L412) | tariff | boolValue |
| [`TariffStatusModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L424) | adapter, dpRegistry | super |
| [`TariffStatusModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L432) | – | mk, this.adapter.setObjectNotExistsAsync |
| [`mk`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L439) | id, name, type, role | this.adapter.setObjectNotExistsAsync |
| [`TariffStatusModule._getStatusConfig`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L481) | – | Math.round, clamp, finiteOrNull |
| [`TariffStatusModule._readValues`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L496) | ids | Promise.all, ids.map |
| [`TariffStatusModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L509) | – | Array.isArray, Date.now, JSON.stringify, Math.abs, Math.max, Math.min, Math.round, String, boolValue, buildCompactEvcsText, buildCompactStorageText, buildEffectiveStorageText, buildIntentPart, buildIntentReason (weitere in der Quelle) |
| [`TariffStatusModule._setIfChanged`](../../../../../../src-ts/runtime-executables/ems/modules/tariff-status.ts#L787) | id, value | this.adapter.getStateAsync, this.adapter.setStateAsync |
