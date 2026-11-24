# src-ts/runtime-executables/www/runtime-base.ts

Hält lokale VIS-Ressourcen und API-Aufrufe im Instanzpfad des Admin-Proxys.

**Daten und Wirkung:** Liest ausschließlich den eigenen Browserpfad; erweitert im

**Bei Änderungen:** Request/Init, fremde Ursprünge, Präfixgrenzen, HTML-Bootreihenfolge,

[Originalquelle](../../../../../src-ts/runtime-executables/www/runtime-base.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

Kein direkter Import innerhalb des erfassten Quellbereichs. Mögliche HTML-, Adapter-, Build- oder dynamische Einstiege sind separat zu prüfen.

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`proxyContext`](../../../../../src-ts/runtime-executables/www/runtime-base.ts#L32) | – | initialPath.match, initialPath.split, initialPath.startsWith, segments.at, segments.slice |
| [`runtimePath`](../../../../../src-ts/runtime-executables/www/runtime-base.ts#L56) | path | – |
| [`url`](../../../../../src-ts/runtime-executables/www/runtime-base.ts#L59) | value | parsed.hash.startsWith, parsed.pathname.startsWith, runtimePath, value.includes, value.startsWith |
| [`pathname`](../../../../../src-ts/runtime-executables/www/runtime-base.ts#L76) | – | current.slice, current.startsWith |
| [`adminBase`](../../../../../src-ts/runtime-executables/www/runtime-base.ts#L80) | – | – |
