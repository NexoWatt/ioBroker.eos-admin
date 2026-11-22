# src-admin-tab/src/pages/PartnerIntegrationsPage.tsx

Gemeinsame sichere Partner-Einrichtung in Arbitrage, Bilanz und Direktvermarktung.

**Daten und Wirkung:** Bearbeitet explizite Daten-/Steuerfreigaben, Speichergrenzen in W/%

**Bei Änderungen:** Serververtrag, Versionskonflikte, Entwurferhalt und Widerruf mitprüfen.

[Originalquelle](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `react` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./PageShell` | [src-admin-tab/src/pages/PageShell.tsx](../../../../../src-admin-tab/src/pages/PageShell.tsx) |
| `../lib/adminConnection` | [src-admin-tab/src/lib/adminConnection.ts](../../../../../src-admin-tab/src/lib/adminConnection.ts) |
| `../lib/partnerContracts` | [src-admin-tab/src/lib/partnerContracts.ts](../../../../../src-admin-tab/src/lib/partnerContracts.ts) |

**Direkt importiert von:**

- [src-admin-tab/src/App.tsx](../../../../../src-admin-tab/src/App.tsx)
- [src-admin-tab/src/pages/ArbitragePage.tsx](../../../../../src-admin-tab/src/pages/ArbitragePage.tsx)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`reasonLabel`](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx#L32) | code | Object.hasOwn |
| [`NumberField`](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx#L33) | { label, value, onChange, min = 0, max } | – |
| [`TextField`](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx#L36) | { label, value, onChange, help = '', maxLength = 128 } | – |
| [`GrantEditor`](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx#L40) | { grant, resourceIds, onChange, onRemove } | resourceIds.includes, resourceIds.map |
| [`ResourceEditor`](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx#L47) | { resource, onChange, onRemove } | – |
| [`set`](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx#L48) | key, value | onChange |
| [`PartnerIntegrationsPage`](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx#L64) | { appId = 'arbitrage' } | Date.now, displayedGrants.map, draft.arbitrage.resources.map, draft?.grants.map, issues.errors.map, reasonLabel, useEffect, useRef, useState |
| [`accept`](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx#L88) | next, replaceDraft | Date.now, setConflict, setDirty, setDraft, setLastReadAt, setPreview, setServer, setUncertain, setValidation |
| [`read`](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx#L97) | replaceDraft | accept, getErrorMessage, parsePartnerResponse, partnerIntegrationsRequest, setBusy, setError, setLastReadAt, setMessage |
| [`parentChanged`](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx#L113) | event | Math.max, Number.isSafeInteger, setConflict |
| [`update`](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx#L125) | next | setDirty, setDraft, setPreview, setValidation |
| [`perform`](../../../../../src-admin-tab/src/pages/PartnerIntegrationsPage.tsx#L128) | action, enabled | accept, getErrorMessage, getErrorStatus, parsePartnerConfig, parsePartnerResponse, parsePartnerValidation, partnerIntegrationsRequest, setBusy, setConflict, setError, setMessage, setPreview, setUncertain, setValidation (weitere in der Quelle) |
