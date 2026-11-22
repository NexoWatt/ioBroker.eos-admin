# src-ts/runtime-executables/www/forecast-settings.ts

Verbindet die Kunden-Prognoseeinstellungen mit Standort, PV-Flächen und der zugehörigen Backend-Konfiguration.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/forecast-settings.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`initForecastSettings`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L26) | – | Date.now, document.addEventListener, setup, window.addEventListener |
| [`byId`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L38) | id | document.getElementById |
| [`stateEntry`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L39) | key | – |
| [`hasState`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L44) | key | Object.prototype.hasOwnProperty.call, stateEntry |
| [`stateValue`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L48) | key, fallback | Object.prototype.hasOwnProperty.call, stateEntry |
| [`firstStateValue`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L52) | keys, fallback | hasState, stateValue |
| [`firstNonEmptyTextState`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L56) | keys, fallback | String, hasState, stateValue |
| [`firstFiniteStateValue`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L64) | keys, fallback | Number, Number.isFinite, hasState, stateValue |
| [`asBoolean`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L72) | value, fallback | String |
| [`finite`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L80) | value, fallback | Number, Number.isFinite, value.trim |
| [`clamp`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L85) | value, min, max, fallback | Math.max, Math.min, finite |
| [`round`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L86) | value, digits | Number, value.toFixed |
| [`nearestOrientation`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L99) | value | ORIENTATIONS.reduce, clamp |
| [`distance`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L101) | candidate | Math.abs |
| [`normalizeRow`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L105) | value, index | Math.round, String, clamp, nearestOrientation, round |
| [`parseRows`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L114) | raw | Array.isArray, JSON.parse |
| [`inputOrState`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L126) | id, key, fallback | String, byId, stateValue |
| [`legacyRow`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L132) | – | inputOrState, normalizeRow |
| [`createNumberInput`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L141) | field, value, min, max, step, label | String, document.createElement, input.setAttribute |
| [`createCell`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L153) | label, control | cell.appendChild, document.createElement |
| [`collectRows`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L166) | – | Array.from, body.querySelectorAll, byId |
| [`field`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L170) | name | row.querySelector |
| [`updateRemoveButtons`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L182) | – | Array.from, body.querySelectorAll, body?.closest, buttons.forEach, byId, editor?.classList.toggle |
| [`syncEditorLayout`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L202) | – | byId, editor.classList.toggle |
| [`setLegacyField`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L211) | id, value | String, byId |
| [`persistRows`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L216) | – | JSON.stringify, byId, collectRows, hidden.dispatchEvent, normalizeRow, rows.filter, setLegacyField, validation.classList.toggle |
| [`markRefreshPending`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L239) | – | byId |
| [`queuePersist`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L249) | – | markRefreshPending, window.clearTimeout, window.setTimeout |
| [`renderRows`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L255) | rows | body.replaceChildren, byId, normalizeRow, syncEditorLayout, updateRemoveButtons, values.forEach |
| [`sourceRows`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L318) | – | JSON.stringify, String, byId, legacyRow, parseRows, stateValue |
| [`hydrateEditor`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L329) | force | byId, editor.contains, renderRows, sourceRows |
| [`setupArrayEditor`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L339) | – | add.addEventListener, byId, editorResizeObserver.observe, hydrateEditor, syncEditorLayout, window.addEventListener |
| [`formatEnergyKwh`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L364) | value | Math.abs, Number, Number.isFinite, kwh.toFixed |
| [`formatAge`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L371) | ageValue, updatedAtValue | Date.now, Math.max, Math.round, Number, Number.isFinite, String |
| [`sourceLabel`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L384) | value | String, source.includes |
| [`friendlyMessage`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L393) | value | String, message.includes, raw.toLowerCase |
| [`normalizeSourceMode`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L417) | value | String |
| [`updateVisibility`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L425) | – | byId, fallback.classList.toggle, fields.classList.remove, fields.classList.toggle, fields.setAttribute, normalizeSourceMode, stateValue |
| [`updateStatus`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L444) | – | Date.now, Math.abs, Math.max, Math.round, Number, Number.isFinite, String, asBoolean, byId, effectiveSourceRaw.includes, energyValue, error.classList.toggle, firstFiniteStateValue, firstNonEmptyTextState (weitere in der Quelle) |
| [`energyValue`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L567) | suffix | firstStateValue, stateValue |
| [`setup`](../../../../../src-ts/runtime-executables/www/forecast-settings.ts#L612) | – | byId, enabled.addEventListener, setupArrayEditor, source.addEventListener, updateStatus, updateVisibility, window.setInterval |
