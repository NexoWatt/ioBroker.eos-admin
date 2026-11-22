# src-ts/runtime-executables/lib/config-boundary-contracts.ts

Prüft unbekannte Werte an NVP-/Dynamic-Grid-Konfigurationsgrenzen und beschreibt die tatsächlich verwendeten Adapter-/HTTP-Verträge.

**Daten und Wirkung:** Fremde JSON-/Objektwerte hinein, nach Formprüfung eingegrenzte Werte hinaus; keine Datenbank-, Netzwerk- oder Geräteschreibzugriffe.

**Bei Änderungen:** Bestehende Entwürfe, CAS, Aliasse, Lizenzgrenzen und sämtliche Installer-/Importwege prüfen; diese Guards ersetzen nicht die fachlichen Validatoren.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/lib/dynamic-grid-config-api.ts](../../../../../src-ts/runtime-executables/lib/dynamic-grid-config-api.ts)
- [src-ts/runtime-executables/lib/nvp-config-api.ts](../../../../../src-ts/runtime-executables/lib/nvp-config-api.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`isRecord`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L63) | value | Array.isArray |
| [`record`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L67) | value | Object.create, isRecord |
| [`own`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L72) | value, key | Object.prototype.hasOwnProperty.call, isRecord |
| [`text`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L75) | value | value.trim |
| [`cloneJson`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L76) | value | JSON.parse, JSON.stringify |
| [`recordArray`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L77) | value | Array.isArray, value.filter |
| [`isIssue`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L80) | value | isRecord |
| [`isIssues`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L83) | value | Array.isArray, value.every |
| [`issueResult`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L85) | value | isIssues, isRecord |
| [`isValidation`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L89) | value | isIssues, isRecord, own |
| [`validationResult`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L96) | value | isValidation |
| [`isEntity`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L100) | value | isRecord |
| [`isEntities`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L101) | value | Array.isArray, value.every |
| [`isDynamicConfig`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L102) | value | Number.isSafeInteger, isEntities, isRecord |
| [`dynamicConfig`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L106) | value | isDynamicConfig |
| [`isNvpPoint`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L110) | value | isRecord |
| [`isNvpStorage`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L113) | value | isEntity, isRecord |
| [`isNvpConfig`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L116) | value | Array.isArray, isEntities, isRecord, value.points.every, value.storages.every |
| [`nvpConfig`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L121) | value | isNvpConfig |
| [`stateObject`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L126) | value | isStateObject |
| [`isStateObject`](../../../../../src-ts/runtime-executables/lib/config-boundary-contracts.ts#L129) | value | isRecord |
