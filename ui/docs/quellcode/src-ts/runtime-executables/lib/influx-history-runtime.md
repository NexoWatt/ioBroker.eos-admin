# src-ts/runtime-executables/lib/influx-history-runtime.ts

Historisiert ausschließlich ausdrücklich registrierte EOS-Zeitreihen über den direkten InfluxDB-2-Transport.

**Daten und Wirkung:** Übernimmt bestätigte State-Schreibvorgänge mit Originalzeit; begrenzt Warteschlangen, Leseparallelität und Laufzeiten ohne die EMS-Regelung auf Netzwerkantworten warten zu lassen.

**Bei Änderungen:** Betriebsartwechsel, Schlüsselverlust, verzögerte Antworten, Überlauf, Abbruch und getrennte Lese-/Schreibfehler prüfen; keine Lücken mit Nullwerten füllen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./influx-direct` | [src-ts/runtime-executables/lib/influx-direct.ts](../../../../../src-ts/runtime-executables/lib/influx-direct.ts) |
| `node:perf_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`safeCode`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L29) | error | – |
| [`InfluxHistoryRuntime.constructor`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L60) | namespace, factory | – |
| [`InfluxHistoryRuntime.configure`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L62) | history | JSON.stringify, Object.assign, safeCode, this.factory, this.registrations.values, this.stopGeneration |
| [`InfluxHistoryRuntime.register`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L78) | localId, changesOnly | id.trim, localId.startsWith, this.registrations.get, this.registrations.set |
| [`InfluxHistoryRuntime.legacyRecording`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L87) | localId, active | localId.startsWith, this.legacyRecordings.add, this.legacyRecordings.delete, this.registrations.has |
| [`InfluxHistoryRuntime.capture`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L93) | localId, state, ack | Date.now, Number.isFinite, Number.isSafeInteger, localId.startsWith, this.registrations.has |
| [`InfluxHistoryRuntime.commit`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L108) | captured | Buffer.byteLength, JSON.stringify, this.queue.push, this.registrations.get, this.schedule |
| [`InfluxHistoryRuntime.query`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L120) | id, options | Object.assign, Promise.reject |
| [`InfluxHistoryRuntime.status`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L132) | – | – |
| [`InfluxHistoryRuntime.close`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L137) | – | this.stopGeneration |
| [`InfluxHistoryRuntime.drainAndClose`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L139) | timeoutMs | Math.max, Math.min, Promise.resolve, performance.now, setTimeout, this.cancelQueuedReads, this.close, this.schedule |
| [`InfluxHistoryRuntime.cancelQueuedReads`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L151) | – | Object.assign, clearTimeout, job.reject |
| [`InfluxHistoryRuntime.stopGeneration`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L155) | – | clearTimeout, this.cancelQueuedReads, this.client?.close, this.finishDrain |
| [`InfluxHistoryRuntime.drainReads`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L164) | – | Object.assign, clearTimeout, client.query, job.reject, performance.now, this.reads.shift |
| [`InfluxHistoryRuntime.schedule`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L184) | – | setTimeout, this.timer.unref |
| [`InfluxHistoryRuntime.flush`](../../../../../src-ts/runtime-executables/lib/influx-history-runtime.ts#L189) | – | Date.now, Math.max, batch.push, client.write, performance.now, safeCode, this.close, this.queue.at, this.queue.shift, this.registrations.get, this.schedule |
