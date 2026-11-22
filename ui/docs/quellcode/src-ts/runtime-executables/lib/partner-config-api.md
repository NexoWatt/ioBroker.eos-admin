# src-ts/runtime-executables/lib/partner-config-api.ts

Geschützte Installateur-API für Partnerfreigaben, Entwurfsvorschau und globalen Widerruf.

**Daten und Wirkung:** Validierte Konfiguration wird über den zentralen CAS-Commit gespeichert; keine Geheimnisse.

**Bei Änderungen:** Generische Import-/Speicherwege, Versionskonflikte und App-Rollen-Negativtests prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/partner-config-api.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./http-error-boundary` | [src-ts/runtime-executables/lib/http-error-boundary.ts](../../../../../src-ts/runtime-executables/lib/http-error-boundary.ts) |
| `./partner-contracts` | [src-ts/runtime-executables/lib/partner-contracts.ts](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts) |
| `./partner-service` | [src-ts/runtime-executables/lib/partner-service.ts](../../../../../src-ts/runtime-executables/lib/partner-service.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`PartnerApiError.constructor`](../../../../../src-ts/runtime-executables/lib/partner-config-api.ts#L33) | status, code, message | super |
| [`apiError`](../../../../../src-ts/runtime-executables/lib/partner-config-api.ts#L35) | status, code, message | – |
| [`fail`](../../../../../src-ts/runtime-executables/lib/partner-config-api.ts#L36) | res, error | res.status, safeConfigurationFailure |
| [`parseApp`](../../../../../src-ts/runtime-executables/lib/partner-config-api.ts#L42) | value | apiError, partnerKeys, partnerRecord |
| [`partnerIntegrationSnapshot`](../../../../../src-ts/runtime-executables/lib/partner-config-api.ts#L48) | root, status | defaultPartnerConfig, partnerAppState, partnerRecord, validatePartnerConfig |
| [`assertPartnerPersistence`](../../../../../src-ts/runtime-executables/lib/partner-config-api.ts#L54) | currentRoot, nextRoot | JSON.stringify, apiError, currentPartnerConfig |
| [`registerPartnerIntegrationApi`](../../../../../src-ts/runtime-executables/lib/partner-config-api.ts#L61) | app, requireInstaller, hooks | app.get, app.post, change |
| [`roleGuard`](../../../../../src-ts/runtime-executables/lib/partner-config-api.ts#L63) | req, res, next | next, partnerRecord, res.setHeader, res.status |
| [`change`](../../../../../src-ts/runtime-executables/lib/partner-config-api.ts#L79) | revoke | – |
