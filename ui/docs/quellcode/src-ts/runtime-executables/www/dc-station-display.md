# src-ts/runtime-executables/www/dc-station-display.ts

Stellt die Stationsanzeige mit mehreren Ladepunkten, Status und freigegebenen Bedienaktionen dar.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/dc-station-display.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`lang`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L138) | – | String, raw.startsWith |
| [`t`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L147) | key | lang |
| [`escapeHtml`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L154) | input | String |
| [`fmtKw`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L159) | w | Math.abs, Number, Number.isFinite |
| [`fmtKwh`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L165) | v | Number, Number.isFinite, n.toFixed |
| [`fmtEur`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L166) | v | Number, Number.isFinite, n.toFixed |
| [`fmtPrice`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L167) | v | Number, Number.isFinite, n.toFixed |
| [`fmtTime`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L168) | ts | Number, Number.isFinite, lang |
| [`fmtDateTime`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L172) | ts | Number, Number.isFinite, fmtTime, lang |
| [`fmtDuration`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L176) | sec | Math.floor, Math.max, Math.round, Number, String |
| [`clamp`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L181) | n, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`safeArray`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L182) | raw | Array.isArray |
| [`getToken`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L183) | – | decodeURIComponent, window.NW_RUNTIME?.pathname |
| [`statusLabel`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L185) | status | String, t |
| [`modeLabel`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L196) | mode | String, t |
| [`tariffStateLabel`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L206) | state | String, t |
| [`addUnique`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L215) | list, entry, key | Object.assign, String, list.push, list.some |
| [`derivePresentationModel`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L222) | payload | String, addUnique, connectors.forEach, decisionLines.map, fmtPrice, modeLabel, safeArray, t, tariffStateLabel, uniqueReasons.slice, warnings.filter, warnings.find, warnings.map |
| [`withPresentationModel`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L311) | payload | Object.assign, derivePresentationModel |
| [`showStatus`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L318) | title, message, cls | escapeHtml, window.NW_RUNTIME?.url |
| [`toast`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L326) | message | String, clearTimeout, document.body.appendChild, document.createElement, document.querySelector, el.classList.add, setTimeout |
| [`fetchJson`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L334) | url, opts | Object.assign, fetch, res.json |
| [`refreshDelay`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L343) | payload | Math.round, Number, Number.isFinite |
| [`scheduleRefresh`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L347) | delay | clamp, clearTimeout, setTimeout |
| [`scheduleHeartbeat`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L348) | delay | clamp, clearTimeout, setTimeout |
| [`refresh`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L353) | – | Date.now, String, encodeURIComponent, fetchJson, getToken, refreshDelay, render, scheduleRefresh, showStatus, t |
| [`heartbeat`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L373) | – | Date.now, JSON.stringify, encodeURIComponent, fetchJson, getToken, lang |
| [`sendCommand`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L383) | lp, action, mode, extra | Date.now, JSON.stringify, Object.assign, encodeURIComponent, fetchJson, render, setTimeout, t, toast |
| [`languageSwitchHtml`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L400) | station | – |
| [`bannerHtml`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L405) | payload, opts | banners.join, banners.push, escapeHtml, fmtTime, t |
| [`statusChip`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L414) | icon, title, value, tone, detail | escapeHtml |
| [`renderStatusStrip`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L418) | payload | Number, String, fmtKw, fmtPrice, modeLabel, safeArray, statusChip, statusLabel, t, tariffStateLabel |
| [`summaryCard`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L437) | icon, title, value, detail, tone, extra | escapeHtml |
| [`renderSummary`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L441) | payload | Math.round, Number, String, clamp, fmtEur, fmtKw, fmtKwh, modeLabel, safeArray, statusLabel, summaryCard, t |
| [`connectorLayout`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L458) | connectors | Math.ceil, Math.max |
| [`isActiveValue`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L467) | current, expected | String |
| [`controlButton`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L468) | lp, action, mode, label, active, disabled, extraAttrs | escapeHtml |
| [`renderLpControls`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L472) | c, station, disabled | Math.round, Number, String, controlButton, escapeHtml, isActiveValue, t |
| [`renderConnector`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L495) | c, station | Array.isArray, Math.round, Number, Number.isFinite, String, busyKey.startsWith, escapeHtml, fmtEur, fmtKw, fmtKwh, fmtPrice, lp.toUpperCase, modeLabel, modes.includes (weitere in der Quelle) |
| [`renderDecisionPanel`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L517) | payload | escapeHtml, lines.map, safeArray, t |
| [`renderWarningsPanel`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L523) | payload, opts | escapeHtml, safeArray, t, warnings.map, warnings.unshift |
| [`render`](../../../../../src-ts/runtime-executables/www/dc-station-display.ts#L530) | payload, opts | Array.isArray, String, app.querySelectorAll, app.style.setProperty, bannerHtml, connectorLayout, connectors.map, escapeHtml, fmtDateTime, languageSwitchHtml, renderDecisionPanel, renderStatusStrip, renderSummary, renderWarningsPanel (weitere in der Quelle) |
