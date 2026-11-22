# src-ts/runtime-executables/lib/energy-origin-api.ts

Verbindet Herkunftsbilanz und Ledger-Daten mit den zugehörigen HTTP-Endpunkten.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/energy-origin-api.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:path` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`defaultEnergyOriginConfig`](../../../../../src-ts/runtime-executables/lib/energy-origin-api.ts#L26) | – | – |
| [`registerEnergyOriginApi`](../../../../../src-ts/runtime-executables/lib/energy-origin-api.ts#L80) | options | app.get |
| [`appIsEnabled`](../../../../../src-ts/runtime-executables/lib/energy-origin-api.ts#L92) | – | isEnabled |
| [`period`](../../../../../src-ts/runtime-executables/lib/energy-origin-api.ts#L96) | input | String |
| [`localKey`](../../../../../src-ts/runtime-executables/lib/energy-origin-api.ts#L100) | ts, kind | Date.now, Number, String, d.getDate, d.getFullYear, d.getMonth |
| [`filterIntervals`](../../../../../src-ts/runtime-executables/lib/energy-origin-api.ts#L106) | rows, requestedPeriod | Array.isArray, Date.now, list.filter, list.slice, localKey, period |
| [`aggregate`](../../../../../src-ts/runtime-executables/lib/energy-origin-api.ts#L125) | rows | Array.isArray, Math.max, Math.round, list.filter, list.reduce, sum |
| [`get`](../../../../../src-ts/runtime-executables/lib/energy-origin-api.ts#L127) | row, keys, fallback | Number, Number.isFinite |
| [`sum`](../../../../../src-ts/runtime-executables/lib/energy-origin-api.ts#L133) | keys | Math.round, list.reduce |
| [`buildPayload`](../../../../../src-ts/runtime-executables/lib/energy-origin-api.ts#L162) | requestedPeriod | Array.isArray, Date.now, String, aggregate, encodeURIComponent, filterIntervals, period, readJson, readState |
| [`toCsv`](../../../../../src-ts/runtime-executables/lib/energy-origin-api.ts#L191) | payload | Array.isArray, Date.now, Math.max, Number, String, cpEnergyKwh.toFixed, rows.join, rows.push |
