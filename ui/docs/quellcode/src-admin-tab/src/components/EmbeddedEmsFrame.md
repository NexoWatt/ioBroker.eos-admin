# src-admin-tab/src/components/EmbeddedEmsFrame.tsx

Eingebettete EMS-Detailansicht mit dem gemeinsamen AppCenter-Stylesheet.

**Daten und Wirkung:** Meldet nur die Inhaltshöhe; keine Navigation, Berechtigungs-

**Bei Änderungen:** Höhenmessung, Listener-Abbau und auf Einbettung beschränkte Styles prüfen.

[Originalquelle](../../../../../src-admin-tab/src/components/EmbeddedEmsFrame.tsx) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `react` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `../lib/adminConnection` | [src-admin-tab/src/lib/adminConnection.ts](../../../../../src-admin-tab/src/lib/adminConnection.ts) |

**Direkt importiert von:**

- [src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx](../../../../../src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`EmbeddedEmsFrame`](../../../../../src-admin-tab/src/components/EmbeddedEmsFrame.tsx#L18) | { children } | useEffect, useRef |
| [`report`](../../../../../src-admin-tab/src/components/EmbeddedEmsFrame.tsx#L37) | – | window.requestAnimationFrame |
