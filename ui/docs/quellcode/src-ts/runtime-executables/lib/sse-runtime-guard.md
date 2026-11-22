# src-ts/runtime-executables/lib/sse-runtime-guard.ts

Begrenzt überlastete SSE-Verbindungen, ohne gesunde Browserverbindungen wegen anderer Clients zu trennen.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`SseRuntimeGuard.constructor`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L28) | options | Math.max, Math.round, this._clamp |
| [`SseRuntimeGuard._clamp`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L68) | value, fallback, min, max | Math.max, Math.min, Math.round, Number, Number.isFinite |
| [`SseRuntimeGuard._warnOnce`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L73) | key, message, intervalMs | Date.now, this._lastWarnAt.delete, this._lastWarnAt.get, this._lastWarnAt.keys, this._lastWarnAt.set, this.log.warn |
| [`SseRuntimeGuard._writableBytes`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L86) | client | Math.max, Number |
| [`SseRuntimeGuard._isDead`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L99) | client | – |
| [`SseRuntimeGuard._bind`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L107) | client, emitter, event, handler | client.listeners.push, emitter.once |
| [`wrapped`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L110) | args | client.listeners.indexOf, client.listeners.splice, handler |
| [`SseRuntimeGuard._detach`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L122) | client | row.emitter?.removeListener |
| [`SseRuntimeGuard.addClient`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L129) | input | Date.now, Math.max, Number.isFinite, client.authExpiryTimer.unref, close, res?.setTimeout, setTimeout, socket?.setKeepAlive, socket?.setNoDelay, this._bind, this._ensureHeartbeat, this.clients.add, this.close |
| [`close`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L175) | reason | – |
| [`SseRuntimeGuard._bindDrain`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L196) | client | this._bind, this._isDead |
| [`onDrain`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L199) | – | this._isDead, this._resync, this.clients.has |
| [`SseRuntimeGuard._resync`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L212) | client | String, this._isDead, this._warnOnce, this.close, this.getSnapshotChunk, this.write |
| [`SseRuntimeGuard.write`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L226) | client, chunk, meta | Buffer.byteLength, Date.now, Promise.resolve, String, client.res.write, this._bindDrain, this._isDead, this._warnOnce, this._writableBytes, this.clients.has, this.close |
| [`SseRuntimeGuard.broadcast`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L314) | input | Array.from, this.write |
| [`SseRuntimeGuard.close`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L324) | client, reason | Date.now, String, clearTimeout, client.res?.end, socket.destroy, this._detach, this._stopHeartbeat, this.clients.delete |
| [`SseRuntimeGuard.closeAll`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L342) | reason | Array.from, this._stopHeartbeat, this.clients.clear, this.close |
| [`SseRuntimeGuard.mitigatePressure`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L348) | level | Array.from, Date.now, Math.max, String, this._writableBytes, this.close |
| [`SseRuntimeGuard._ensureHeartbeat`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L376) | – | Math.max, Math.min, Math.round, setInterval, this._heartbeatTimer.unref |
| [`SseRuntimeGuard._stopHeartbeat`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L408) | – | clearInterval |
| [`SseRuntimeGuard.getStats`](../../../../../src-ts/runtime-executables/lib/sse-runtime-guard.ts#L413) | – | Date.now, Math.max, this._writableBytes |
