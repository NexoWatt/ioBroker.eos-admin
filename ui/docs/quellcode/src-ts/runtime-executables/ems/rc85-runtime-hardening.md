# src-ts/runtime-executables/ems/rc85-runtime-hardening.ts

Kapselt Laufzeitgrenzen, Fehlerisolation und Schutzmechanismen für Regelmodule und Speicherverbrauch.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:v8` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../src-ts/runtime-executables/ems/module-manager.ts)
- [src-ts/runtime-executables/ems/modules/charging-management.ts](../../../../../src-ts/runtime-executables/ems/modules/charging-management.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`boundedMapSet`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L70) | map, key, value, max | map.delete, map.keys, map.set |
| [`logWatchdogOnce`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L79) | label, message, log, now | Date.now, boundedMapSet, log.warn, timeoutLogAt.get |
| [`rc88RuntimeHardeningSnapshot`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L86) | now | Date.now, Math.max, labels.push, labels.slice |
| [`rc88ClearRuntimeHardening`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L101) | – | entry.controller.abort, inFlight.clear, inFlight.values, timeoutLogAt.clear |
| [`rc85RunIsolatedResult`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L109) | label, timeoutMs, work, log | Date.now, Math.max, Math.min, Number, Promise.race, Promise.resolve, String, Symbol, clearTimeout, inFlight.get, inFlight.set, logWatchdogOnce, normalizedError.message.startsWith, task.then |
| [`rc85RunIsolated`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L214) | label, timeoutMs, work, log | rc85RunIsolatedResult |
| [`rc85IsHardReason`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L224) | reasonValue | String |
| [`rc85IsSoftEconomicReason`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L229) | reasonValue | String |
| [`Rc85EvcsDecisionGuard.evaluate`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L261) | input | Date.now, Math.max, Math.min, Number, Number.isFinite, boundedMapSet, rc85IsHardReason, rc85IsSoftEconomicReason, this.prune, this.states.get |
| [`Rc85EvcsDecisionGuard.prune`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L351) | now | Date.now, this.states.delete, this.states.keys |
| [`Rc85EvcsDecisionGuard.clear`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L359) | – | this.states.clear |
| [`rc85GridEnvelope`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L376) | input | Math.max, Math.min, Number |
| [`rc86GridBinding`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L444) | input | Math.max, Math.min, Math.round, Number, Number.isFinite |
| [`rc85OfflineReserveW`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L490) | points | Boolean, Math.max, Number, String |
| [`clampRatio`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L537) | value, fallback, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`rc88ClassifyHeapPressure`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L561) | input | Math.max, Number, clampRatio |
| [`safeDiagnosticsJson`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L586) | – | JSON.stringify, String, heapMonitorOptions.getDiagnostics, json.slice |
| [`scheduleControlledRestart`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L596) | sample, reason | heapMonitorLog.error, heapMonitorOptions.onBeforeRestart, safeDiagnosticsJson, setTimeout |
| [`runHeapMonitorSample`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L609) | – | Date.now, Math.max, Math.min, Math.round, Number, String, clampRatio, getHeapStatistics, heapMonitorLog.warn, heapMonitorOptions.onPressure, heapSamples.find, heapSamples.push, heapSamples.shift, process.memoryUsage (weitere in der Quelle) |
| [`startRc85HeapMonitor`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L668) | log, options | Math.max, Math.min, Number, setInterval |
| [`stopRc85HeapMonitor`](../../../../../src-ts/runtime-executables/ems/rc85-runtime-hardening.ts#L679) | – | clearInterval, clearTimeout |
