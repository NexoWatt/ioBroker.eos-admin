# src-admin-tab/src/lib/installerNavigation.ts

Bestimmt die rollenabhängigen Rückwege und Moduleinstiege des Installers.

**Daten und Wirkung:** Liest ausschließlich den bestätigten Sitzungsstatus; liefert feste interne Pfade ohne Netzwerkaufrufe oder Zustandsänderungen. InstallerPage setzt davor den bestätigten Runtime-Origin.

**Bei Änderungen:** Rollenvertrag und Backend-Zugriffsschutz gemeinsam prüfen; keine frei vorgegebenen Redirect-Ziele übernehmen.

[Originalquelle](../../../../../src-admin-tab/src/lib/installerNavigation.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-admin-tab/src/pages/InstallerPage.tsx](../../../../../src-admin-tab/src/pages/InstallerPage.tsx)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`installerReturnLinks`](../../../../../src-admin-tab/src/lib/installerNavigation.ts#L18) | access | links.unshift |
| [`installerModuleLinks`](../../../../../src-admin-tab/src/lib/installerNavigation.ts#L26) | access | – |
