# src-ts/runtime-executables/www/smarthome-touch.ts

Trennt Touch-Bedienung eines nativen Bereichsreglers vom Scrollen.

**Daten und Wirkung:** Hält native Eingabe-/Commit-Ereignisse bis zur bewusst abgeschlossenen Touch-Geste zurück.

**Bei Änderungen:** Scrollen, Abbruch, Multitouch, Fokusverlust, native Folgeereignisse und genau einen Commit beim Loslassen prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/www/smarthome-touch.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`paint`](../../../../../src-ts/runtime-executables/www/smarthome-touch.ts#L48) | input | Math.max, Math.min, Number, Number.isFinite, input.style.setProperty, percent.toFixed |
| [`restore`](../../../../../src-ts/runtime-executables/www/smarthome-touch.ts#L57) | gesture | paint |
| [`cancel`](../../../../../src-ts/runtime-executables/www/smarthome-touch.ts#L63) | – | restore |
| [`move`](../../../../../src-ts/runtime-executables/www/smarthome-touch.ts#L72) | event | Math.abs, Math.hypot, cancel, restore |
| [`finish`](../../../../../src-ts/runtime-executables/www/smarthome-touch.ts#L86) | event | input.dispatchEvent, move, paint, restore |
| [`install`](../../../../../src-ts/runtime-executables/www/smarthome-touch.ts#L116) | – | document.addEventListener, window.addEventListener |
| [`bindRange`](../../../../../src-ts/runtime-executables/www/smarthome-touch.ts#L139) | input | bindings.has, bindings.set, input.addEventListener, install |
| [`holdNative`](../../../../../src-ts/runtime-executables/www/smarthome-touch.ts#L168) | event | event.preventDefault, event.stopImmediatePropagation, paint, restore |
| [`isInteracting`](../../../../../src-ts/runtime-executables/www/smarthome-touch.ts#L185) | – | cancel |
| [`isCommitting`](../../../../../src-ts/runtime-executables/www/smarthome-touch.ts#L191) | input | bindings.get |
