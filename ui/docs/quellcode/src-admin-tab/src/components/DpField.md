# src-admin-tab/src/components/DpField.tsx

Wiederverwendbares ID-Eingabefeld mit dem bestehenden EMS-Datenpunktdialog.

**Daten und Wirkung:** Auswahl und manuelle Eingabe rufen denselben onChange-/Dirty-Pfad auf.

**Bei Änderungen:** Abbruch bei Zeilenwechsel, Entwurfsänderung, Speichersperre und Unmount erhalten.

[Originalquelle](../../../../../src-admin-tab/src/components/DpField.tsx) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `react` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `../lib/dataPointPicker` | [src-admin-tab/src/lib/dataPointPicker.ts](../../../../../src-admin-tab/src/lib/dataPointPicker.ts) |

**Direkt importiert von:**

- [src-admin-tab/src/pages/DynamicGridPage.tsx](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`DpField`](../../../../../src-admin-tab/src/components/DpField.tsx#L21) | { label, value = '', onChange, required = false, help = '', maxLength = 512, mode = 'read', disabled = false } | useContext, useId, useLayoutEffect, useRef, useState |
| [`pick`](../../../../../src-admin-tab/src/components/DpField.tsx#L35) | – | chooseDataPoint, controller.current?.abort, latest.current.onChange, setError, setPending |
