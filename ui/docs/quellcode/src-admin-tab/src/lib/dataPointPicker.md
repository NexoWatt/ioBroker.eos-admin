# src-admin-tab/src/lib/dataPointPicker.ts

Öffnet den vorhandenen AppCenter-Datenpunktdialog für React-Felder.

**Daten und Wirkung:** Nur Statekennungsauswahl; kein Geräteschreiben und kein Speichern.

**Bei Änderungen:** Origin, Fenster, Request-ID, Abbruch und verspätete Antworten zusammen prüfen.

[Originalquelle](../../../../../src-admin-tab/src/lib/dataPointPicker.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./adminContracts` | [src-admin-tab/src/lib/adminContracts.ts](../../../../../src-admin-tab/src/lib/adminContracts.ts) |
| `./adminConnection` | [src-admin-tab/src/lib/adminConnection.ts](../../../../../src-admin-tab/src/lib/adminConnection.ts) |

**Direkt importiert von:**

- [src-admin-tab/src/components/DpField.tsx](../../../../../src-admin-tab/src/components/DpField.tsx)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`validId`](../../../../../src-admin-tab/src/lib/dataPointPicker.ts#L20) | value | value.trim |
| [`chooseDataPoint`](../../../../../src-admin-tab/src/lib/dataPointPicker.ts#L23) | { currentId = '', mode = 'read', signal } | – |
| [`sendCancel`](../../../../../src-admin-tab/src/lib/dataPointPicker.ts#L34) | – | peer?.postMessage |
| [`finish`](../../../../../src-admin-tab/src/lib/dataPointPicker.ts#L35) | id, error | clearInterval, clearTimeout, popup.close, reject, resolve, sendCancel, signal?.removeEventListener, window.removeEventListener |
| [`abort`](../../../../../src-admin-tab/src/lib/dataPointPicker.ts#L46) | – | finish |
| [`open`](../../../../../src-admin-tab/src/lib/dataPointPicker.ts#L47) | – | currentId.slice, finish, peer.postMessage |
| [`receive`](../../../../../src-admin-tab/src/lib/dataPointPicker.ts#L53) | event | clearTimeout, finish, isRecord, isSafeJson, open, setTimeout, validId |
