# src-admin-tab/src/pages/HistorySetupPage.tsx

Bietet die rollenbeschränkte Historie-Einrichtung über vorhandenen ioBroker-Adapter oder direkte InfluxDB-2-Verbindung.

**Daten und Wirkung:** Liest öffentliche Konfiguration, prüft den Entwurf ohne Speicherung und speichert nur nach Benutzeraktion mit Konfigurationsrevision. Token/CA verbleiben ausschließlich im lokalen Entwurf und werden nach erfolgreichem Speichern geleert.

**Bei Änderungen:** Geschützte Route, Backend-Installerrechte und CSRF bleiben maßgeblich. Veraltete Antworten, Fehler, parallele Entwürfe und getrennte Lese-/Schreibdiagnose testen; keine Datenbank erstellen/löschen.

[Originalquelle](../../../../../src-admin-tab/src/pages/HistorySetupPage.tsx) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `react` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./PageShell` | [src-admin-tab/src/pages/PageShell.tsx](../../../../../src-admin-tab/src/pages/PageShell.tsx) |
| `../lib/adminConnection` | [src-admin-tab/src/lib/adminConnection.ts](../../../../../src-admin-tab/src/lib/adminConnection.ts) |
| `../lib/historySetup` | [src-admin-tab/src/lib/historySetup.ts](../../../../../src-admin-tab/src/lib/historySetup.ts) |

**Direkt importiert von:**

- [src-admin-tab/src/App.tsx](../../../../../src-admin-tab/src/App.tsx)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`HistorySetupPage`](../../../../../src-admin-tab/src/pages/HistorySetupPage.tsx#L21) | – | getRuntimeProxyBase, historyDate, historyError, historyState, useEffect, useRef, useState |
| [`adopt`](../../../../../src-admin-tab/src/pages/HistorySetupPage.tsx#L32) | response | historyDraft, setChecked, setDraft, setSaved, setStatus |
| [`update`](../../../../../src-admin-tab/src/pages/HistorySetupPage.tsx#L45) | key, value | setChecked, setDraft |
| [`run`](../../../../../src-admin-tab/src/pages/HistorySetupPage.tsx#L49) | action | adopt, historyError, historyPayload, historySetupRequest, parseHistoryCheck, parseHistoryResponse, setBusy, setChecked, setError, setMessage, setStatus |
