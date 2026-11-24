# src-admin-tab/src/lib/historySetup.ts

Prüft öffentliche Historie-API-Antworten und bildet den ausdrücklichen Installer-Entwurf auf den schmalen Speichervertrag ab.

**Daten und Wirkung:** Nur reine Browserfunktionen, keine Netzwerk-/Speicherzugriffe. Tokens und CA-Inhalte aus Antworten werden verworfen. Statuszeitpunkte sind Epoch-Millisekunden; Prüfungen bestätigen keinen Schreibzugriff.

**Bei Änderungen:** Backendvertrag, Zielwechsel mit gespeichertem Token, Entwurferhalt, getrennte Lese-/Schreibfehler und EOS-Rollenprüfung gemeinsam testen.

[Originalquelle](../../../../../src-admin-tab/src/lib/historySetup.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-admin-tab/src/pages/HistorySetupPage.tsx](../../../../../src-admin-tab/src/pages/HistorySetupPage.tsx)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`record`](../../../../../src-admin-tab/src/lib/historySetup.ts#L39) | value | Array.isArray |
| [`text`](../../../../../src-admin-tab/src/lib/historySetup.ts#L40) | value, max | – |
| [`count`](../../../../../src-admin-tab/src/lib/historySetup.ts#L45) | value | Number.isFinite |
| [`provider`](../../../../../src-admin-tab/src/lib/historySetup.ts#L46) | value | – |
| [`parseHistoryResponse`](../../../../../src-admin-tab/src/lib/historySetup.ts#L52) | value | count, provider, record, text |
| [`historyDraft`](../../../../../src-admin-tab/src/lib/historySetup.ts#L72) | config | – |
| [`directUrl`](../../../../../src-admin-tab/src/lib/historySetup.ts#L77) | value | url.pathname.includes, value.trim |
| [`historyPayload`](../../../../../src-admin-tab/src/lib/historySetup.ts#L86) | draft, saved | directUrl, draft.bucket.trim, draft.caCertificate.trim, draft.instance.trim, draft.organization.trim, draft.token.trim, draft.url.trim |
| [`parseHistoryCheck`](../../../../../src-admin-tab/src/lib/historySetup.ts#L102) | value | record |
| [`historyError`](../../../../../src-admin-tab/src/lib/historySetup.ts#L142) | error | errors.get, record |
| [`historyDate`](../../../../../src-admin-tab/src/lib/historySetup.ts#L154) | value | Number.isFinite |
| [`historyState`](../../../../../src-admin-tab/src/lib/historySetup.ts#L157) | status | – |
