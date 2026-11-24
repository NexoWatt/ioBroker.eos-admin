# src-ts/runtime-executables/www/eos-session-idle.ts

Meldet echte Bedienung an die gemeinsame EOS-Sitzungsgrenze und

**Daten und Wirkung:** Gleichursprüngliches Status-GET und CSRF-geschütztes POST;

**Bei Änderungen:** letzte Eingabe, ruhende Tabs, Schlaffunktion, Offline-Rückkehr, BFCache,

[Originalquelle](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`now`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L45) | – | performance.now |
| [`clear`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L46) | timer | clearTimeout |
| [`readJson`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L49) | response | JSON.parse, decoder.decode, reader.cancel, reader.read, response.body?.getReader, response.headers.get |
| [`validate`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L68) | value | Number, Number.isFinite |
| [`privacyLock`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L80) | – | document.body.appendChild, document.createElement, document.documentElement.classList.add, document.getElementById, document.head.appendChild, gate.setAttribute |
| [`unlock`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L93) | – | document.documentElement.classList.remove, document.getElementById |
| [`login`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L97) | – | channel?.close, clear, observer?.disconnect, privacyLock, window.location.replace, window.top.location.replace |
| [`scheduleExpiry`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L114) | – | Math.max, clear, now, setTimeout |
| [`accept`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L122) | status, started | login, now, scheduleExpiry, unlock |
| [`synchronize`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L133) | kind | Promise.resolve, now, privacyLock, setTimeout |
| [`scheduleActivity`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L179) | – | Math.max, clear, now, setTimeout |
| [`interaction`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L186) | event | now, privacyLock, scheduleActivity, synchronize |
| [`observeDocument`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L197) | target | observedDocuments.add, observedDocuments.has, target.addEventListener |
| [`scanFrames`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L208) | – | Array.from, bind, document.querySelectorAll, frame.addEventListener, observedFrames.add, observedFrames.has |
| [`bind`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L212) | – | observeDocument |
| [`recheck`](../../../../../src-ts/runtime-executables/www/eos-session-idle.ts#L223) | – | now, privacyLock, synchronize |
