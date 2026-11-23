# src-ts/runtime-executables/www/smarthome-activation.ts

Zeigt und speichert die SmartHome-Aktivierung direkt im Installer.

**Daten und Wirkung:** Überträgt ausschließlich einen Boolean an die geschützte

**Bei Änderungen:** Abgelaufene Sitzung, fehlende Lizenz, fehlgeschlagene

[Originalquelle](../../../../../src-ts/runtime-executables/www/smarthome-activation.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`confirmedEnabled`](../../../../../src-ts/runtime-executables/www/smarthome-activation.ts#L24) | value | – |
| [`request`](../../../../../src-ts/runtime-executables/www/smarthome-activation.ts#L33) | enabled | AbortSignal.timeout, JSON.stringify, confirmedEnabled, fetch, response.json |
| [`initialize`](../../../../../src-ts/runtime-executables/www/smarthome-activation.ts#L49) | – | bindControls, document.getElementById |
| [`bindControls`](../../../../../src-ts/runtime-executables/www/smarthome-activation.ts#L59) | checkbox, save, reload, status | checkbox.addEventListener, reload.addEventListener, save.addEventListener, synchronize |
| [`renderControls`](../../../../../src-ts/runtime-executables/www/smarthome-activation.ts#L64) | – | – |
| [`show`](../../../../../src-ts/runtime-executables/www/smarthome-activation.ts#L70) | message, error | String |
| [`synchronize`](../../../../../src-ts/runtime-executables/www/smarthome-activation.ts#L76) | saving | renderControls, request, show |
