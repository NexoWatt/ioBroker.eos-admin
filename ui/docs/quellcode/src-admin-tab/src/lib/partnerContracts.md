# src-admin-tab/src/lib/partnerContracts.ts

Prüft den vollständigen Partner-API-Vertrag vor der Anzeige und vor Schreibanfragen.

**Daten und Wirkung:** Unbekanntes JSON wird in begrenzte Konfigurationen und Statusdaten überführt;

**Bei Änderungen:** Backend partner-integrations, CAS-Versionen, Rechte und Einheiten gemeinsam prüfen.

[Originalquelle](../../../../../src-admin-tab/src/lib/partnerContracts.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./adminContracts` | [src-admin-tab/src/lib/adminContracts.ts](../../../../../src-admin-tab/src/lib/adminContracts.ts) |

**Direkt importiert von:**

- [src-admin-tab/src/pages/PartnerIntegrationsPage.tsx](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`fail`](../../../../../src-admin-tab/src/lib/partnerContracts.ts#L37) | – | – |
| [`text`](../../../../../src-admin-tab/src/lib/partnerContracts.ts#L38) | value, max | fail |
| [`bool`](../../../../../src-admin-tab/src/lib/partnerContracts.ts#L39) | value | fail |
| [`number`](../../../../../src-admin-tab/src/lib/partnerContracts.ts#L40) | value, min, max, integer | Number.isFinite, Number.isSafeInteger, fail |
| [`oneOf`](../../../../../src-admin-tab/src/lib/partnerContracts.ts#L44) | value, values | fail, values.includes |
| [`list`](../../../../../src-admin-tab/src/lib/partnerContracts.ts#L45) | value, max, parse | Array.isArray, fail, value.map |
| [`parsePartnerConfig`](../../../../../src-admin-tab/src/lib/partnerContracts.ts#L48) | value | bool, fail, isRecord, isSafeJson, list, number, oneOf, text |
| [`parsePartnerResponse`](../../../../../src-admin-tab/src/lib/partnerContracts.ts#L72) | value, preview | bool, fail, isRecord, isSafeJson, number, oneOf, parsePartnerConfig, parsePartnerValidation, text |
| [`parsePartnerValidation`](../../../../../src-admin-tab/src/lib/partnerContracts.ts#L84) | value | bool, fail, isRecord, isSafeJson, list |
