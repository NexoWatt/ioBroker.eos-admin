# src-ts/runtime-executables/www/login.ts

Eigenständige Anmeldeseite für zwei ausdrücklich gewählte Profile.

**Daten und Wirkung:** Das ioBroker-Profil sendet das eingegebene Passwort genau

**Bei Änderungen:** Passwortübermittlung, Mehrfach-Submit, Profilwechsel und

[Originalquelle](../../../../../src-ts/runtime-executables/www/login.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`rootPath`](../../../../../src-ts/runtime-executables/www/login.ts#L44) | – | window.NW_RUNTIME?.url |
| [`framed`](../../../../../src-ts/runtime-executables/www/login.ts#L45) | – | – |
| [`secureBrowser`](../../../../../src-ts/runtime-executables/www/login.ts#L46) | – | – |
| [`message`](../../../../../src-ts/runtime-executables/www/login.ts#L49) | text, error | elements.statusNode.classList.toggle |
| [`closeForms`](../../../../../src-ts/runtime-executables/www/login.ts#L54) | – | elements.toggle.setAttribute |
| [`requestStatus`](../../../../../src-ts/runtime-executables/www/login.ts#L62) | – | Array.isArray, JSON.parse, String, bytes.set, controller.abort, data.capabilities.every, fetch, parts.push, reader.read, reader.releaseLock, response.body?.getReader, response.headers.get, window.clearTimeout, window.setTimeout |
| [`returnTarget`](../../../../../src-ts/runtime-executables/www/login.ts#L94) | status | allowed, canonical.endsWith, canonical.slice, path.endsWith, path.slice, requested.startsWith, rootPath, setup.get, target.pathname.slice, target.pathname.startsWith, userPages.has |
| [`allowed`](../../../../../src-ts/runtime-executables/www/login.ts#L99) | cap | capabilities.includes |
| [`centralTarget`](../../../../../src-ts/runtime-executables/www/login.ts#L126) | value | value.startsWith |
| [`render`](../../../../../src-ts/runtime-executables/www/login.ts#L136) | status | centralTarget, closeForms, elements.userInput.focus, framed, message, returnTarget, secureBrowser, window.location.replace |
| [`refresh`](../../../../../src-ts/runtime-executables/www/login.ts#L157) | – | closeForms, message, render, requestStatus |
| [`setBusy`](../../../../../src-ts/runtime-executables/www/login.ts#L171) | active | Date.now, String, elements.form.setAttribute |
