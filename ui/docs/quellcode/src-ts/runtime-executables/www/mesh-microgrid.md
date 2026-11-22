# src-ts/runtime-executables/www/mesh-microgrid.ts

Zeigt die Kopplungs- und Austauschinformationen der Mesh-/Microgrid-Funktion im Browser.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`$`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L26) | id | document.getElementById |
| [`fmtW`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L27) | v | Math.abs, Math.round, Number, Number.isFinite |
| [`fmtPct`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L28) | v | Math.round, Number, Number.isFinite |
| [`esc`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L29) | v | String |
| [`setText`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L30) | id, value | $ |
| [`statusClass`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L31) | status | String |
| [`renderNodes`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L38) | nodes | $, Array.isArray, list.map |
| [`severityClass`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L66) | severity | String |
| [`renderPlanning`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L72) | payload | $, Array.isArray, actions.map, fmtPct, order.map, setText |
| [`renderTargetGroups`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L107) | payload | $, Array.isArray, groups.map, prio.map, setText |
| [`renderLimits`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L132) | payload | $, Array.isArray, all.map, limited.concat, setText |
| [`renderCommandGuard`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L166) | payload | $, Array.isArray, checks.map, commands.map, setText |
| [`renderLocalBridge`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L196) | payload | $, Array.isArray, ackRows.querySelectorAll, mapped.map, setText, targetStatus.map, targets.slice, unmapped.map, writes.map |
| [`releaseBridgeTarget`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L287) | mappingId, commandStateDp | JSON.stringify, fetch, load, res.json, setText, window.confirm |
| [`renderFieldControl`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L301) | payload | Array.isArray, setText, ts.peers.map |
| [`renderReceiver`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L311) | payload | $, JSON.stringify, Object.keys, setText |
| [`renderFieldTest`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L333) | payload | $, Array.isArray, history.slice, matrix.map, remoteNodeMatrix.slice, setText |
| [`runFieldTest`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L388) | – | $, JSON.stringify, esc, fetch, load, res.json, setText |
| [`renderDiagnosis`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L406) | payload | Array.isArray, String, missing.map, parts.join, parts.push, setText |
| [`load`](../../../../../src-ts/runtime-executables/www/mesh-microgrid.ts#L422) | – | $, String, esc, fetch, fmtPct, fmtW, renderCommandGuard, renderDiagnosis, renderFieldControl, renderFieldTest, renderLimits, renderLocalBridge, renderNodes, renderPlanning (weitere in der Quelle) |
