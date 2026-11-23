# src-ts/runtime-executables/www/auth.ts

Sperrt jede Runtime-Oberfläche bis zur serverseitig bestätigten

**Daten und Wirkung:** Liest nur den Status der eigenen Instanz, setzt CSRF-Header

**Bei Änderungen:** Statusfehler, Offline-/BFCache-Rückkehr, Instanzproxy,

[Originalquelle](../../../../../src-ts/runtime-executables/www/auth.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`snapshot`](../../../../../src-ts/runtime-executables/www/auth.ts#L55) | – | state.capabilities.slice |
| [`runtimeUrl`](../../../../../src-ts/runtime-executables/www/auth.ts#L56) | path | window.NW_RUNTIME?.url |
| [`runtimeRoot`](../../../../../src-ts/runtime-executables/www/auth.ts#L57) | – | runtimeUrl |
| [`currentPath`](../../../../../src-ts/runtime-executables/www/auth.ts#L58) | – | window.NW_RUNTIME?.pathname |
| [`hasCapability`](../../../../../src-ts/runtime-executables/www/auth.ts#L61) | capability | state.capabilities.includes |
| [`requiredPageCapability`](../../../../../src-ts/runtime-executables/www/auth.ts#L70) | – | currentPath, document.body?.getAttribute, pages.get |
| [`ensureStyles`](../../../../../src-ts/runtime-executables/www/auth.ts#L83) | – | document.createElement, document.getElementById |
| [`lockPage`](../../../../../src-ts/runtime-executables/www/auth.ts#L105) | message | Array.from, actions.appendChild, actions.replaceChildren, background.has, background.set, document.body.appendChild, document.createElement, document.documentElement.classList.add, document.documentElement.classList.remove, document.getElementById, ensureStyles, gate.querySelector, node.getAttribute, node.setAttribute (weitere in der Quelle) |
| [`unlockPage`](../../../../../src-ts/runtime-executables/www/auth.ts#L137) | – | background.clear, document.documentElement.classList.add, document.documentElement.classList.remove, document.getElementById, node.removeAttribute, node.setAttribute |
| [`resetStatus`](../../../../../src-ts/runtime-executables/www/auth.ts#L148) | error | Object.assign, updateNavigation |
| [`readStatus`](../../../../../src-ts/runtime-executables/www/auth.ts#L155) | response, controller | JSON.parse, bytes.set, chunks.push, controller.abort, reader.read, reader.releaseLock, response.body?.getReader, response.headers.get |
| [`applyStatus`](../../../../../src-ts/runtime-executables/www/auth.ts#L173) | value | Array.isArray, String, data.capabilities.every |
| [`updateNavigation`](../../../../../src-ts/runtime-executables/www/auth.ts#L194) | – | Array.from, box.append, box.replaceChildren, button.addEventListener, document.createElement, document.getElementById, document.querySelector, document.querySelectorAll, hasCapability, header.appendChild, node.getAttribute, node.style.removeProperty |
| [`showLogin`](../../../../../src-ts/runtime-executables/www/auth.ts#L216) | message, _options | document.createElement, document.querySelector, lockPage, runtimeRoot, target.searchParams.set, window.location.replace |
| [`applyPageAccess`](../../../../../src-ts/runtime-executables/www/auth.ts#L229) | – | hasCapability, lockPage, requiredPageCapability, showLogin, unlockPage, updateNavigation |
| [`refreshStatus`](../../../../../src-ts/runtime-executables/www/auth.ts#L240) | – | request.finally |
| [`centralUrl`](../../../../../src-ts/runtime-executables/www/auth.ts#L261) | value | value.startsWith |
| [`logout`](../../../../../src-ts/runtime-executables/www/auth.ts#L272) | – | centralUrl, document.createElement, document.querySelector, lockPage, navigator.serviceWorker?.controller?.postMessage, originalFetch, refreshStatus, resetStatus, showLogin, snapshot, window.clearTimeout, window.dispatchEvent, window.location.replace, window.setTimeout |
| [`ownDataPath`](../../../../../src-ts/runtime-executables/www/auth.ts#L298) | input | path.slice, path.startsWith, runtimeRoot |
| [`requireCapability`](../../../../../src-ts/runtime-executables/www/auth.ts#L329) | capability, options | hasCapability, lockPage, refreshStatus, showLogin |
| [`start`](../../../../../src-ts/runtime-executables/www/auth.ts#L338) | – | lockPage, refreshStatus |
| [`resume`](../../../../../src-ts/runtime-executables/www/auth.ts#L339) | – | lockPage, refreshStatus, resetStatus |
