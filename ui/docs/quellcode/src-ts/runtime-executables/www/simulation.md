# src-ts/runtime-executables/www/simulation.ts

Verbindet Simulations-Eingaben und Auswertung mit dem dafür vorgesehenen Backend-Bereich.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/simulation.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`$`](../../../../../src-ts/runtime-executables/www/simulation.ts#L72) | id | document.getElementById |
| [`sleep`](../../../../../src-ts/runtime-executables/www/simulation.ts#L107) | ms | – |
| [`esc`](../../../../../src-ts/runtime-executables/www/simulation.ts#L114) | s | String |
| [`setBusy`](../../../../../src-ts/runtime-executables/www/simulation.ts#L128) | busy | – |
| [`badge`](../../../../../src-ts/runtime-executables/www/simulation.ts#L147) | cls, text | esc |
| [`renderError`](../../../../../src-ts/runtime-executables/www/simulation.ts#L154) | target, error, withBadge | String, document.createElement, target.appendChild |
| [`api`](../../../../../src-ts/runtime-executables/www/simulation.ts#L176) | path, opts | JSON.parse, JSON.stringify, data.error.trim, data.message.trim, fetch, res.text |
| [`renderInstances`](../../../../../src-ts/runtime-executables/www/simulation.ts#L205) | defaultId | _instances.some, document.createElement, elInstance.appendChild |
| [`renderStatus`](../../../../../src-ts/runtime-executables/www/simulation.ts#L231) | st | badge, d.toLocaleString, esc, msgLines.join, msgLines.push, parts.join, parts.push |
| [`currentInstanceId`](../../../../../src-ts/runtime-executables/www/simulation.ts#L259) | – | String |
| [`renderScenarioCatalog`](../../../../../src-ts/runtime-executables/www/simulation.ts#L271) | catalog, preferredSelectedId | Array.isArray, String, _scenarios.some, document.createElement, elScenSelect.appendChild, renderScenarioDesc |
| [`renderScenarioDesc`](../../../../../src-ts/runtime-executables/www/simulation.ts#L307) | – | String, esc, lines.join, lines.push |
| [`renderScenarioStatus`](../../../../../src-ts/runtime-executables/www/simulation.ts#L323) | st | Math.round, Number, badge, esc, extra.join, extra.push, parts.join, parts.push |
| [`refreshDiscover`](../../../../../src-ts/runtime-executables/www/simulation.ts#L351) | – | Array.isArray, api, renderInstances |
| [`refreshStatus`](../../../../../src-ts/runtime-executables/www/simulation.ts#L362) | – | api, renderStatus |
| [`refreshScenarios`](../../../../../src-ts/runtime-executables/www/simulation.ts#L373) | forceCatalog | Array.isArray, String, api, currentInstanceId, encodeURIComponent, renderScenarioCatalog, renderScenarioDesc, renderScenarioStatus |
| [`refreshAll`](../../../../../src-ts/runtime-executables/www/simulation.ts#L405) | – | refreshDiscover, refreshScenarios, refreshStatus, setBusy |
| [`enable`](../../../../../src-ts/runtime-executables/www/simulation.ts#L421) | – | api, refreshScenarios, refreshStatus, setBusy, sleep |
| [`disable`](../../../../../src-ts/runtime-executables/www/simulation.ts#L439) | – | api, refreshScenarios, refreshStatus, setBusy, sleep |
| [`startScenario`](../../../../../src-ts/runtime-executables/www/simulation.ts#L456) | – | String, api, currentInstanceId, refreshScenarios, sleep |
| [`stopScenario`](../../../../../src-ts/runtime-executables/www/simulation.ts#L472) | – | api, currentInstanceId, refreshScenarios, sleep |
| [`resetScenario`](../../../../../src-ts/runtime-executables/www/simulation.ts#L486) | – | api, currentInstanceId, refreshScenarios, sleep |
