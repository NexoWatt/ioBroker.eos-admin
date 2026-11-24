# src-ts/runtime-executables/www/storagefarm.ts

Zeigt aggregierte Speicherfarm-Werte und Einzelspeicher. Der dynamische Netzanschluss wird vollständig in seiner eigenen Installer-App eingerichtet.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/storagefarm.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`el`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L71) | id | document.getElementById |
| [`stateVal`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L78) | key | Object.prototype.hasOwnProperty.call |
| [`num`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L88) | v | Number, Number.isFinite |
| [`formatPower`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L99) | v | Math.abs, Math.round, num |
| [`parseJsonSafe`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L114) | raw, fallback | Array.isArray, JSON.parse, String |
| [`statusList`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L129) | – | window.NWStorageFarmDispatch.rows |
| [`setLive`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L138) | ok | dot.classList.toggle, el, render |
| [`setMsg`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L150) | text | el |
| [`statusText`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L160) | row | window.NWStorageFarmDispatch.status |
| [`cell`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L170) | rowEl, text, label | String, d.setAttribute, document.createElement, rowEl.appendChild |
| [`renderRows`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L183) | list | Array.isArray, document.createElement, el, list.forEach, setMsg, wrap.appendChild |
| [`renderSummary`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L215) | – | String, el, stateVal, window.NWStorageFarmSummary.render |
| [`render`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L228) | – | renderRows, renderSummary, statusList, window.NWStorageFarmDispatch.render |
| [`loadConfig`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L239) | – | Array.isArray, Math.max, Math.round, Number, el, evcsMenu.classList.toggle, evcsTab.classList.toggle, fetch, setMsg, settingsConfig.evcsList.filter, sfMenu.classList.toggle, sfTab.classList.toggle, shMenu.classList.toggle, shTab.classList.toggle (weitere in der Quelle) |
| [`loadState`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L272) | – | fetch, setLive, setMsg |
| [`startEvents`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L289) | – | window.NW_RUNTIME?.url, window.setInterval |
| [`bind`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L318) | – | el, reload.addEventListener |
| [`ready`](../../../../../src-ts/runtime-executables/www/storagefarm.ts#L328) | fn | document.addEventListener, fn |
