# src-ts/runtime-executables/lib/ephemeral-cache.ts

Begrenzt kurzlebige UI-Lesecaches und gibt abgelaufene Inhalte auch ohne nächsten HTTP-Aufruf frei.

**Daten und Wirkung:** Hält ausschließlich lesende Antworten und Objekt-Snapshots; Messwerte, Regelzyklen und persistierte Einstellungen bleiben unberührt.

**Bei Änderungen:** Monotone Fristen, begrenzte Einträge, parallele Abrufe und Bereinigung nach Stop mit den Cache-Lebenszyklustests prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:perf_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`now`](../../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts#L22) | – | performance.now |
| [`schedule`](../../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts#L23) | callback, delayMs | setTimeout, timer.unref |
| [`cancel`](../../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts#L24) | timer | clearTimeout |
| [`EphemeralMap.constructor`](../../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts#L30) | ttlMs, maxEntries, time | Number.isFinite, Number.isSafeInteger, super |
| [`EphemeralMap.set`](../../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts#L36) | key, value | super.keys, super.set, this.delete, this.expiry.set, this.time.now, this.time.schedule |
| [`EphemeralMap.has`](../../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts#L48) | key | super.has, this.delete, this.expiry.get, this.time.now |
| [`EphemeralMap.get`](../../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts#L53) | key | super.get, this.has |
| [`EphemeralMap.delete`](../../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts#L56) | key | super.delete, this.expiry.delete, this.expiry.get, this.time.cancel |
| [`EphemeralMap.clear`](../../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts#L62) | – | super.clear, this.expiry.clear, this.expiry.values, this.time.cancel |
| [`ExpiringSnapshot.constructor`](../../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts#L74) | load, ttlMs, time | – |
| [`ExpiringSnapshot.get`](../../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts#L79) | force | Promise.reject, Promise.resolve, request.then, this.cache.clear, this.cache.get |
| [`settled`](../../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts#L92) | – | – |
| [`ExpiringSnapshot.close`](../../../../../src-ts/runtime-executables/lib/ephemeral-cache.ts#L96) | – | this.cache.clear |
