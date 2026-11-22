# src-ts/runtime-executables/lib/partner-contracts.ts

Beschreibt und prüft den versionierten Partnervertrag sowie dessen lokale Freigaben.

**Daten und Wirkung:** Unbekanntes JSON wird streng geprüft; keine Netzwerk-, Geräte- oder Persistenzzugriffe.

**Bei Änderungen:** API, Transport, App-Freigaben, CAS und Negativtests gemeinsam anpassen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/lib/partner-config-api.ts](../../../../../src-ts/runtime-executables/lib/partner-config-api.ts)
- [src-ts/runtime-executables/lib/partner-runtime.ts](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts)
- [src-ts/runtime-executables/lib/partner-service.ts](../../../../../src-ts/runtime-executables/lib/partner-service.ts)
- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`partnerRecord`](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts#L27) | value | Array.isArray, Object.getPrototypeOf |
| [`partnerKeys`](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts#L31) | value, allowed | Object.keys |
| [`partnerId`](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts#L34) | value | – |
| [`partnerNumber`](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts#L35) | value, min, max | Number.isFinite |
| [`partnerInteger`](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts#L36) | value, min, max | Number.isSafeInteger, partnerNumber |
| [`isPartnerAppId`](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts#L37) | value | – |
| [`defaultPartnerConfig`](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts#L39) | – | – |
| [`permissionAllowed`](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts#L43) | appId, permission | – |
| [`validatePartnerConfig`](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts#L49) | input | Array.isArray, PARTNER_PERMISSIONS.includes, arb.resources.entries, grants.push, grants.some, input.grants.entries, isPartnerAppId, issue, partnerId, partnerInteger, partnerKeys, partnerNumber, partnerRecord, permissionAllowed (weitere in der Quelle) |
| [`issue`](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts#L51) | path, message | errors.push |
| [`currentPartnerConfig`](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts#L95) | root | defaultPartnerConfig, partnerRecord, validatePartnerConfig |
| [`partnerAppState`](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts#L102) | root, id | partnerRecord |
