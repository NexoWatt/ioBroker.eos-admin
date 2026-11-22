# src-admin-tab/src/lib/adminContracts.ts

Prüft native Admin-DTOs an API- und Nachrichtengrenzen vor Änderungen am Formularzustand.

**Daten und Wirkung:** Bewahrt legitime Zusatzfelder, leere Entwurfszahlen und Backend-kompatible Altdaten; führt keine Gerätebefehle aus.

**Bei Änderungen:** Reale Backendantworten, geschützte Formularabläufe und negative Strukturtests gemeinsam prüfen.

[Originalquelle](../../../../../src-admin-tab/src/lib/adminContracts.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-admin-tab/src/lib/dataPointPicker.ts](../../../../../src-admin-tab/src/lib/dataPointPicker.ts)
- [src-admin-tab/src/lib/partnerContracts.ts](../../../../../src-admin-tab/src/lib/partnerContracts.ts)
- [src-admin-tab/src/pages/DynamicGridPage.tsx](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx)
- [src-admin-tab/src/pages/NotificationMailPage.tsx](../../../../../src-admin-tab/src/pages/NotificationMailPage.tsx)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`isRecord`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L47) | value | Array.isArray, Object.getPrototypeOf |
| [`text`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L48) | value | – |
| [`number`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L49) | value | Number.isFinite |
| [`boolean`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L50) | value | – |
| [`draft`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L51) | value | number |
| [`scalar`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L52) | value | boolean, draft |
| [`optional`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L53) | guard | – |
| [`nullable`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L54) | guard | – |
| [`array`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L55) | guard | – |
| [`object`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L56) | shape | – |
| [`dictionary`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L63) | guard | – |
| [`isSafeJson`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L65) | value | Array.isArray, Object.getOwnPropertyDescriptors, Object.keys, boolean, isRecord, number, queue.pop, queue.push, seen.add, seen.has, text |
| [`reason`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L103) | value | issue, text |
| [`parseDynamicGridResponse`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L113) | value, requireConfiguration | Number.isSafeInteger, isSafeJson, response, value.config.points.some |
| [`parseValidation`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L119) | value | isSafeJson, validation |
| [`parseValidationDetails`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L122) | value | array, isSafeJson |
| [`parseMailResponse`](../../../../../src-admin-tab/src/lib/adminContracts.ts#L126) | value | Number.isInteger, isRecord, isSafeJson, mail |
