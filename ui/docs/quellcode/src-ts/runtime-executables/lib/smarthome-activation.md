# src-ts/runtime-executables/lib/smarthome-activation.ts

Führt den expliziten SmartHome-Schalter im gemeinsamen Installer.

**Daten und Wirkung:** Speichert nur die Freigabe im bestehenden geschützten

**Bei Änderungen:** Altbestand, Schreibfehler, Parallelzugriffe und Rechte prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/smarthome-activation.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`isRecord`](../../../../../src-ts/runtime-executables/lib/smarthome-activation.ts#L16) | value | Array.isArray, Object.getPrototypeOf |
| [`record`](../../../../../src-ts/runtime-executables/lib/smarthome-activation.ts#L21) | value | isRecord |
| [`smartHomeEnabled`](../../../../../src-ts/runtime-executables/lib/smarthome-activation.ts#L26) | config, nativeConfig | Object.hasOwn, record |
| [`noStore`](../../../../../src-ts/runtime-executables/lib/smarthome-activation.ts#L64) | res | res.setHeader |
| [`registerSmartHomeActivationApi`](../../../../../src-ts/runtime-executables/lib/smarthome-activation.ts#L69) | app, host, guard | app.get, app.post |
