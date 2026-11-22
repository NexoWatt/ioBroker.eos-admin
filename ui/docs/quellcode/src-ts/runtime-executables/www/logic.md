# src-ts/runtime-executables/www/logic.ts

Stellt die NexoLogic-Konfiguration und die damit verbundenen Browser-Bedienaktionen bereit.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/logic.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`nwSyncLogicViewportMetrics`](../../../../../src-ts/runtime-executables/www/logic.ts#L121) | – | Math.ceil, Math.max, document.documentElement.style.setProperty, document.querySelector, topbar.getBoundingClientRect |
| [`nwInstallLogicViewportSizing`](../../../../../src-ts/runtime-executables/www/logic.ts#L131) | – | document.querySelector, nwSyncLogicViewportMetrics, observer.observe, window.addEventListener, window.visualViewport.addEventListener |
| [`nwClamp`](../../../../../src-ts/runtime-executables/www/logic.ts#L162) | v, lo, hi | Math.max, Math.min |
| [`nwNow`](../../../../../src-ts/runtime-executables/www/logic.ts#L169) | – | Date.now |
| [`nwUuid`](../../../../../src-ts/runtime-executables/www/logic.ts#L176) | pref | Math.random, nwNow |
| [`nwSafeStr`](../../../../../src-ts/runtime-executables/www/logic.ts#L193) | v | String |
| [`nwEscapeHtml`](../../../../../src-ts/runtime-executables/www/logic.ts#L200) | value | nwSafeStr |
| [`nwBool`](../../../../../src-ts/runtime-executables/www/logic.ts#L215) | v, def | v.trim |
| [`nwNum`](../../../../../src-ts/runtime-executables/www/logic.ts#L233) | v, def | Number.isFinite, parseFloat, v.replace |
| [`nwJsonClone`](../../../../../src-ts/runtime-executables/www/logic.ts#L254) | o | JSON.parse, JSON.stringify |
| [`nwSerializeEditorConfig`](../../../../../src-ts/runtime-executables/www/logic.ts#L261) | cfg | JSON.stringify |
| [`nwUpdateHistoryButtons`](../../../../../src-ts/runtime-executables/www/logic.ts#L265) | – | Array.isArray |
| [`nwHistorySnapshot`](../../../../../src-ts/runtime-executables/www/logic.ts#L271) | label | Date.now, String, nwDefaultGraph, nwJsonClone, nwSerializeEditorConfig |
| [`nwHistoryReset`](../../../../../src-ts/runtime-executables/www/logic.ts#L282) | label | clearTimeout, nwHistorySnapshot, nwUpdateHistoryButtons |
| [`nwHistoryCommit`](../../../../../src-ts/runtime-executables/www/logic.ts#L294) | label | Array.isArray, Math.max, Number, clearTimeout, nwHistorySnapshot, nwLE.history.undo.push, nwLE.history.undo.splice, nwUpdateHistoryButtons |
| [`nwHistoryScheduleCommit`](../../../../../src-ts/runtime-executables/www/logic.ts#L314) | label | clearTimeout, setTimeout |
| [`nwHistoryApply`](../../../../../src-ts/runtime-executables/www/logic.ts#L320) | snapshot, statusText | nwDefaultGraph, nwEnsureConfigDefaults, nwJsonClone, nwRenderGraph, nwRenderGraphSelector, nwRenderInspector, nwScheduleLocalDraft, nwSelectGraph, nwSerializeEditorConfig, nwSetStatus, nwSimReset, nwUpdateHistoryButtons |
| [`nwUndo`](../../../../../src-ts/runtime-executables/www/logic.ts#L341) | – | Array.isArray, nwHistoryApply, nwHistoryCommit, nwLE.history.redo.push, nwLE.history.undo.pop |
| [`nwRedo`](../../../../../src-ts/runtime-executables/www/logic.ts#L350) | – | Array.isArray, nwHistoryApply, nwLE.history.redo.pop, nwLE.history.undo.push |
| [`nwDraftStorageKey`](../../../../../src-ts/runtime-executables/www/logic.ts#L358) | – | – |
| [`nwUpdateDraftStatus`](../../../../../src-ts/runtime-executables/www/logic.ts#L362) | text | String |
| [`nwWriteLocalDraftNow`](../../../../../src-ts/runtime-executables/www/logic.ts#L366) | – | Date.now, JSON.stringify, clearTimeout, localStorage.setItem, nwDefaultGraph, nwDraftStorageKey, nwJsonClone, nwUpdateDraftStatus |
| [`nwScheduleLocalDraft`](../../../../../src-ts/runtime-executables/www/logic.ts#L387) | – | clearTimeout, setTimeout |
| [`nwClearLocalDraft`](../../../../../src-ts/runtime-executables/www/logic.ts#L393) | – | clearTimeout, localStorage.removeItem, nwDraftStorageKey, nwUpdateDraftStatus |
| [`nwMaybeRestoreLocalDraft`](../../../../../src-ts/runtime-executables/www/logic.ts#L402) | serverCfg | Date.now, JSON.parse, Number, confirm, localStorage.getItem, localStorage.removeItem, nwDraftStorageKey, nwEnsureConfigDefaults, nwSerializeEditorConfig, nwUpdateDraftStatus |
| [`nwNodeLane`](../../../../../src-ts/runtime-executables/www/logic.ts#L438) | type | – |
| [`nwEstimatedNodeHeight`](../../../../../src-ts/runtime-executables/www/logic.ts#L446) | type | Array.isArray, Math.ceil, Math.max |
| [`nwLaneBounds`](../../../../../src-ts/runtime-executables/www/logic.ts#L458) | g | Math.max, Number |
| [`nwUpdateLaneGuides`](../../../../../src-ts/runtime-executables/www/logic.ts#L466) | – | Math.max, Math.round, board.querySelector, el.setAttribute, nwLaneBounds |
| [`nwNodeRectsOverlap`](../../../../../src-ts/runtime-executables/www/logic.ts#L485) | a, b | – |
| [`nwFindFreeLanePosition`](../../../../../src-ts/runtime-executables/www/logic.ts#L489) | type, g | Array.from, Math.floor, Math.max, Math.min, Math.round, Number, existing.some, nwClampNodePosition, nwEnsureGraphDefaults, nwEstimatedNodeHeight, nwLaneBounds, nwNodeLane |
| [`nwScrollNodeIntoView`](../../../../../src-ts/runtime-executables/www/logic.ts#L530) | node | Math.max, Number, nwClamp, nwEstimatedNodeHeight, nwNum, wrap.scrollTo |
| [`nwAutoLayoutGraph`](../../../../../src-ts/runtime-executables/www/logic.ts#L540) | – | Array.isArray, Math.max, Number, children.get, depth.get, depth.set, g.nodes.filter, groups.entries, groups.get, groups.has, groups.set, groups.values, isolated.forEach, isolated.sort (weitere in der Quelle) |
| [`keyFor`](../../../../../src-ts/runtime-executables/www/logic.ts#L587) | node | Math.max, depth.get, nwNodeLane |
| [`xForDepth`](../../../../../src-ts/runtime-executables/www/logic.ts#L606) | d | Math.max, Math.round |
| [`nwSimBool`](../../../../../src-ts/runtime-executables/www/logic.ts#L636) | value, def | nwBool |
| [`nwSimNum`](../../../../../src-ts/runtime-executables/www/logic.ts#L641) | value, def | nwNum |
| [`nwSimValueKey`](../../../../../src-ts/runtime-executables/www/logic.ts#L646) | value | JSON.stringify, String |
| [`nwSimFormatValue`](../../../../../src-ts/runtime-executables/www/logic.ts#L650) | value | JSON.stringify, Math.round, Number.isFinite, String |
| [`nwSimTrace`](../../../../../src-ts/runtime-executables/www/logic.ts#L664) | node, message, level | String, sim.traces.push, sim.traces.splice |
| [`nwSimDefaultInput`](../../../../../src-ts/runtime-executables/www/logic.ts#L677) | node | Number.isFinite, String, nwSimBool, nwSimNum |
| [`nwSimDefaultInputType`](../../../../../src-ts/runtime-executables/www/logic.ts#L687) | node | Number, Number.isFinite, String, fallback.replace, fallback.trim |
| [`nwSimEnsureInputs`](../../../../../src-ts/runtime-executables/www/logic.ts#L698) | – | Object.prototype.hasOwnProperty.call, nwSimDefaultInput, nwSimDefaultInputType |
| [`nwSimStopTimer`](../../../../../src-ts/runtime-executables/www/logic.ts#L708) | – | clearInterval |
| [`nwSimSetRunning`](../../../../../src-ts/runtime-executables/www/logic.ts#L716) | running | nwRenderSimulationPanel, nwSimStopTimer, setInterval |
| [`nwSimParseTimeToMin`](../../../../../src-ts/runtime-executables/www/logic.ts#L730) | value | Number, Number.isInteger, String |
| [`nwSimParseDays`](../../../../../src-ts/runtime-executables/www/logic.ts#L739) | value | String |
| [`nwSimEdgeFired`](../../../../../src-ts/runtime-executables/www/logic.ts#L753) | state, input, edge, initializing | nwSimBool |
| [`nwSimComputeNode`](../../../../../src-ts/runtime-executables/www/logic.ts#L763) | node, inp, state, ctx | Math.abs, Math.max, Math.min, Math.round, Number, Number.isFinite, String, d.getDay, d.getHours, d.getMinutes, days.has, enabledDefault, nwClamp, nwSimBool (weitere in der Quelle) |
| [`enabledDefault`](../../../../../src-ts/runtime-executables/www/logic.ts#L769) | value | nwSimBool |
| [`nwSimTopologicalOrder`](../../../../../src-ts/runtime-executables/www/logic.ts#L1135) | g | Array.isArray, g.nodes.filter, indegree.get, indegree.set, next.get, nodeMap.get, nodeMap.has, nodes.filter, nodes.map, order.concat, order.push, queue.push, queue.shift, queue.sort |
| [`nwSimEvaluate`](../../../../../src-ts/runtime-executables/www/logic.ts#L1159) | reason | Array.isArray, Math.max, Object.keys, Object.prototype.hasOwnProperty.call, changes.join, changes.push, links.find, nwRenderSimulationPanel, nwSimComputeNode, nwSimEnsureInputs, nwSimFormatValue, nwSimTopologicalOrder, nwSimTrace, nwSimValueKey (weitere in der Quelle) |
| [`nwSimAdvance`](../../../../../src-ts/runtime-executables/www/logic.ts#L1211) | ms, reason | Math.max, Number, nwOpenSimulation, nwSimEvaluate |
| [`nwSimReset`](../../../../../src-ts/runtime-executables/www/logic.ts#L1217) | render | Date.now, nwRenderSimulationPanel, nwSimEnsureInputs, nwSimEvaluate, nwSimStopTimer, nwSimTrace |
| [`nwOpenSimulation`](../../../../../src-ts/runtime-executables/www/logic.ts#L1234) | – | document.body.classList.add, nwLE.el.simBtn.classList.add, nwLE.el.simPanel.classList.remove, nwLE.el.simPanel.setAttribute, nwRenderSimulationPanel, nwSimReset, nwUpdateSimulationVisuals |
| [`nwCloseSimulation`](../../../../../src-ts/runtime-executables/www/logic.ts#L1248) | – | document.body.classList.remove, nwLE.el.simBtn.classList.remove, nwLE.el.simPanel.classList.add, nwLE.el.simPanel.setAttribute, nwSimStopTimer, nwUpdateSimulationVisuals |
| [`nwRenderSimulationInputs`](../../../../../src-ts/runtime-executables/www/logic.ts#L1260) | force | String, document.createElement, host.appendChild, nodes.map, nwEscapeHtml, nwSimDefaultInputType, nwSimEnsureInputs, renderControl, row.querySelector, typeSelect.addEventListener |
| [`renderControl`](../../../../../src-ts/runtime-executables/www/logic.ts#L1291) | – | String, control.appendChild, document.createElement, input.addEventListener, label.append, nwSimBool |
| [`nwRenderSimulationTrace`](../../../../../src-ts/runtime-executables/www/logic.ts#L1316) | – | document.createElement, host.appendChild, nwEscapeHtml, nwLE.simulation.traces.slice |
| [`nwRenderSimulationPanel`](../../../../../src-ts/runtime-executables/www/logic.ts#L1334) | forceInputs | nwRenderSimulationInputs, nwRenderSimulationTrace |
| [`nwUpdateSimulationVisuals`](../../../../../src-ts/runtime-executables/www/logic.ts#L1343) | – | badges.join, badges.push, board.classList.toggle, board.querySelectorAll, nodeEl.classList.toggle, nodeEl.querySelector, nwEscapeHtml, nwFindNode, nwSimFormatValue, nwUpdateAllWirePaths |
| [`nwGetBoardPointFromClient`](../../../../../src-ts/runtime-executables/www/logic.ts#L1371) | clientX, clientY | board.getBoundingClientRect, nwClamp, nwNum |
| [`nwClampNodePosition`](../../../../../src-ts/runtime-executables/www/logic.ts#L1387) | x, y, g | Math.max, Number, nwClamp, nwNum |
| [`nwReadPaletteBlockType`](../../../../../src-ts/runtime-executables/www/logic.ts#L1401) | ev | JSON.parse, String, dt.getData, nwSafeStr |
| [`nwSetStatus`](../../../../../src-ts/runtime-executables/www/logic.ts#L1422) | text, ok | – |
| [`nwBuildLogicLibrary`](../../../../../src-ts/runtime-executables/www/logic.ts#L1438) | – | – |
| [`nwFetchConfig`](../../../../../src-ts/runtime-executables/www/logic.ts#L2322) | – | console.warn, fetch, nwSetStatus, res.json |
| [`nwSaveConfig`](../../../../../src-ts/runtime-executables/www/logic.ts#L2340) | cfg | Array.isArray, JSON.stringify, String, console.warn, fetch, json.issues.map, res.json |
| [`nwDefaultGraph`](../../../../../src-ts/runtime-executables/www/logic.ts#L2371) | – | – |
| [`nwEnsureConfigDefaults`](../../../../../src-ts/runtime-executables/www/logic.ts#L2392) | cfg | Array.isArray, nwDefaultGraph |
| [`nwGetGraphById`](../../../../../src-ts/runtime-executables/www/logic.ts#L2405) | cfg, id | graphs.find, nwDefaultGraph, nwEnsureConfigDefaults |
| [`nwGetMainGraph`](../../../../../src-ts/runtime-executables/www/logic.ts#L2423) | cfg | nwGetGraphById |
| [`nwRenderGraphSelector`](../../../../../src-ts/runtime-executables/www/logic.ts#L2432) | – | Array.isArray, document.createElement, nwEnsureConfigDefaults, sel.appendChild |
| [`nwUpdateGraphControls`](../../../../../src-ts/runtime-executables/www/logic.ts#L2455) | – | – |
| [`nwSelectGraph`](../../../../../src-ts/runtime-executables/www/logic.ts#L2466) | id, opts | localStorage.setItem, nwEnsureConfigDefaults, nwEnsureGraphDefaults, nwGetGraphById, nwRenderGraph, nwRenderGraphSelector, nwSimReset, nwUpdateGraphControls |
| [`nwAddGraph`](../../../../../src-ts/runtime-executables/www/logic.ts#L2489) | – | cfg.graphs.map, cfg.graphs.push, ids.has, nwEnsureConfigDefaults, nwMarkDirty, nwSelectGraph, nwUuid, prompt |
| [`nwDuplicateGraph`](../../../../../src-ts/runtime-executables/www/logic.ts#L2516) | – | cfg.graphs.map, cfg.graphs.push, ids.has, nwEnsureConfigDefaults, nwJsonClone, nwMarkDirty, nwSelectGraph, nwUuid |
| [`nwRenameGraph`](../../../../../src-ts/runtime-executables/www/logic.ts#L2538) | – | nwMarkDirty, nwRenderGraphSelector, prompt |
| [`nwDeleteGraph`](../../../../../src-ts/runtime-executables/www/logic.ts#L2553) | – | Array.isArray, Math.min, alert, cfg.graphs.findIndex, cfg.graphs.splice, confirm, nwEnsureConfigDefaults, nwMarkDirty, nwSelectGraph |
| [`nwMarkDirty`](../../../../../src-ts/runtime-executables/www/logic.ts#L2576) | label | nwHistoryScheduleCommit, nwScheduleLocalDraft, nwSetStatus, nwSimEvaluate |
| [`nwClearBoard`](../../../../../src-ts/runtime-executables/www/logic.ts#L2597) | – | board.querySelectorAll, nwCancelConnect |
| [`nwEnsureBoardSize`](../../../../../src-ts/runtime-executables/www/logic.ts#L2612) | – | Math.max, Math.round, Number, String, nwClamp, nwNum, nwUpdateLaneGuides, nwUpdateZoomLabel, svg.setAttribute |
| [`nwUpdateZoomLabel`](../../../../../src-ts/runtime-executables/www/logic.ts#L2650) | – | Math.round, nwClamp, nwNum |
| [`nwSetZoom`](../../../../../src-ts/runtime-executables/www/logic.ts#L2662) | newZoom, opts | Math.abs, Math.max, Math.round, Number, String, localStorage.setItem, nwClamp, nwEnsureBoardSize, nwNum, nwUpdateAllWirePaths |
| [`nwZoomIn`](../../../../../src-ts/runtime-executables/www/logic.ts#L2705) | – | nwClamp, nwNum, nwSetZoom |
| [`nwZoomOut`](../../../../../src-ts/runtime-executables/www/logic.ts#L2714) | – | nwClamp, nwNum, nwSetZoom |
| [`nwZoomReset`](../../../../../src-ts/runtime-executables/www/logic.ts#L2723) | – | nwSetZoom |
| [`nwZoomFit`](../../../../../src-ts/runtime-executables/www/logic.ts#L2732) | – | Math.max, Math.min, Number, nwSetZoom |
| [`nwRenderPalette`](../../../../../src-ts/runtime-executables/www/logic.ts#L2749) | – | Object.keys, btn.addEventListener, cats.sort, document.createElement, folder.addEventListener, folder.setAttribute, groupWrap.appendChild, groupWrap.classList.add, nwEscapeHtml, palGetCollapsed, wrap.appendChild |
| [`palKey`](../../../../../src-ts/runtime-executables/www/logic.ts#L2759) | cat | String, encodeURIComponent |
| [`palGetCollapsed`](../../../../../src-ts/runtime-executables/www/logic.ts#L2766) | cat | String, localStorage.getItem, palKey |
| [`palSetCollapsed`](../../../../../src-ts/runtime-executables/www/logic.ts#L2787) | cat, collapsed | localStorage.setItem, palKey |
| [`nwRenderGraph`](../../../../../src-ts/runtime-executables/www/logic.ts#L2880) | – | nwClearBoard, nwEnsureBoardSize, nwRenderAllWires, nwRenderNode, nwUpdateLaneGuides, nwUpdateSimulationVisuals |
| [`nwRenderNode`](../../../../../src-ts/runtime-executables/www/logic.ts#L2902) | node | Math.round, Number, board.appendChild, del.addEventListener, document.createElement, el.addEventListener, el.classList.add, el.querySelector, hdr.addEventListener, nwEscapeHtml, nwNodeLane, nwUpdateSimulationVisuals |
| [`mkPort`](../../../../../src-ts/runtime-executables/www/logic.ts#L2998) | dir, p | d.addEventListener, d.setAttribute, document.createElement, nwEscapeHtml, nwSafeStr |
| [`nwRenderAllWires`](../../../../../src-ts/runtime-executables/www/logic.ts#L3078) | – | Array.isArray, document.createElementNS, label.setAttribute, nwUpdateAllWirePaths, path.setAttribute, svg.appendChild |
| [`nwUpdateAllWirePaths`](../../../../../src-ts/runtime-executables/www/logic.ts#L3108) | – | Array.isArray, CSS.escape, String, board.getBoundingClientRect, getPortPos, l.previewPath.setAttribute, label.classList.toggle, label.setAttribute, mkPath, nwClamp, nwNum, nwSimFormatValue, p.classList.toggle, p.setAttribute (weitere in der Quelle) |
| [`getPortPos`](../../../../../src-ts/runtime-executables/www/logic.ts#L3128) | nodeId, portKey, dir | CSS.escape, board.querySelector, el.getBoundingClientRect |
| [`mkPath`](../../../../../src-ts/runtime-executables/www/logic.ts#L3150) | a, b | Math.abs, Math.max, a.x.toFixed, a.y.toFixed, b.x.toFixed, b.y.toFixed, c1.x.toFixed, c1.y.toFixed, c2.x.toFixed, c2.y.toFixed |
| [`nwSelectNode`](../../../../../src-ts/runtime-executables/www/logic.ts#L3204) | nodeId | board.querySelectorAll, nwRenderInspector |
| [`nwFindNode`](../../../../../src-ts/runtime-executables/www/logic.ts#L3221) | nodeId | Array.isArray, nodes.find |
| [`nwRenderInspector`](../../../../../src-ts/runtime-executables/www/logic.ts#L3234) | – | Array.isArray, Number.isFinite, Object.prototype.hasOwnProperty.call, cur.add, dayList.map, document.createElement, mkRow, nwEscapeHtml, nwFindNode, nwSafeStr, parseInt, scenes.map, setTimeout, wrap.appendChild |
| [`mkRow`](../../../../../src-ts/runtime-executables/www/logic.ts#L3269) | label, html | document.createElement, nwEscapeHtml |
| [`update`](../../../../../src-ts/runtime-executables/www/logic.ts#L3463) | – | boxes.forEach, host.querySelectorAll, nwMarkDirty, sel.map, sel.sort |
| [`nwAddNode`](../../../../../src-ts/runtime-executables/www/logic.ts#L3544) | type, opts | Array.isArray, Number, Number.isFinite, g.nodes.push, nwClampNodePosition, nwFindFreeLanePosition, nwJsonClone, nwMarkDirty, nwRenderNode, nwSelectNode, nwUpdateAllWirePaths, nwUuid, requestAnimationFrame |
| [`nwDeleteNode`](../../../../../src-ts/runtime-executables/www/logic.ts#L3583) | nodeId | Array.isArray, CSS.escape, board.querySelector, el.remove, nwMarkDirty, nwRenderAllWires, nwRenderInspector |
| [`nwRemoveLinksWhere`](../../../../../src-ts/runtime-executables/www/logic.ts#L3616) | predicate | Array.isArray, g.links.filter, nwMarkDirty, nwRenderAllWires |
| [`nwRemoveLinkById`](../../../../../src-ts/runtime-executables/www/logic.ts#L3636) | linkId | nwRemoveLinksWhere |
| [`nwRemoveLinksToInput`](../../../../../src-ts/runtime-executables/www/logic.ts#L3646) | nodeId, portKey | nwRemoveLinksWhere |
| [`nwFindLinkIdNearClientPoint`](../../../../../src-ts/runtime-executables/www/logic.ts#L3656) | clientX, clientY | Math.max, Math.min, Number.isFinite, nwClamp, nwGetBoardPointFromClient, nwNum, path.getPointAtLength, path.getTotalLength, svg.querySelectorAll |
| [`nwStartConnect`](../../../../../src-ts/runtime-executables/www/logic.ts#L3710) | fromNodeId, fromPortKey | document.createElementNS, nwApplyConnectVisualState, nwCancelConnect, nwSetStatus, nwUpdateAllWirePaths, p.setAttribute, svg.appendChild |
| [`nwLogicPortType`](../../../../../src-ts/runtime-executables/www/logic.ts#L3749) | nodeId, portKey, direction | Array.isArray, String, graph.nodes.find, ports.find |
| [`nwApplyConnectVisualState`](../../../../../src-ts/runtime-executables/www/logic.ts#L3762) | – | String, board.classList.toggle, board.querySelectorAll, nwLogicPortType, port.classList.add, port.classList.remove |
| [`nwClearConnectPreview`](../../../../../src-ts/runtime-executables/www/logic.ts#L3785) | connection | c.previewPath.remove, nwApplyConnectVisualState, nwUpdateAllWirePaths |
| [`nwWouldCreateLogicCycle`](../../../../../src-ts/runtime-executables/www/logic.ts#L3793) | graph, fromNodeId, toNodeId | Array.isArray, String, adj.get, adj.has, adj.set, seen.add, seen.has, stack.pop, stack.push |
| [`nwFinishConnect`](../../../../../src-ts/runtime-executables/www/logic.ts#L3815) | toNodeId, toPortKey | Array.isArray, g.links.filter, g.links.push, g.links.some, nwClearConnectPreview, nwLogicPortType, nwMarkDirty, nwRenderAllWires, nwSetStatus, nwUuid, nwWouldCreateLogicCycle |
| [`nwCancelConnect`](../../../../../src-ts/runtime-executables/www/logic.ts#L3859) | – | nwClearConnectPreview |
| [`nwOpenModal`](../../../../../src-ts/runtime-executables/www/logic.ts#L3875) | modalEl | modalEl.classList.remove, modalEl.setAttribute |
| [`nwCloseModal`](../../../../../src-ts/runtime-executables/www/logic.ts#L3886) | modalEl | modalEl.classList.add, modalEl.setAttribute |
| [`nwFetchJson`](../../../../../src-ts/runtime-executables/www/logic.ts#L3897) | url | fetch, res.json |
| [`nwDpSearch`](../../../../../src-ts/runtime-executables/www/logic.ts#L3911) | q | Array.isArray, encodeURIComponent, nwFetchJson, nwSafeStr |
| [`nwDpTree`](../../../../../src-ts/runtime-executables/www/logic.ts#L3923) | prefix | Array.isArray, encodeURIComponent, nwFetchJson, nwSafeStr |
| [`nwDpParentPrefix`](../../../../../src-ts/runtime-executables/www/logic.ts#L3935) | id | nwSafeStr, parts.join, parts.pop |
| [`nwDpMetaText`](../../../../../src-ts/runtime-executables/www/logic.ts#L3947) | it | String, metaBits.join, metaBits.push |
| [`nwCreateDpResultRow`](../../../../../src-ts/runtime-executables/www/logic.ts#L3961) | primary, meta, onActivate | document.createElement, nwSafeStr, row.addEventListener, row.appendChild |
| [`activate`](../../../../../src-ts/runtime-executables/www/logic.ts#L3989) | e | e.preventDefault, e.stopPropagation, onActivate |
| [`nwRenderDpResults`](../../../../../src-ts/runtime-executables/www/logic.ts#L4012) | list, onPick | Array.isArray, nwCreateDpResultRow, nwDpMetaText, nwSafeStr, wrap.appendChild |
| [`nwRenderDpBreadcrumb`](../../../../../src-ts/runtime-executables/www/logic.ts#L4039) | prefix, onNavigate | mkCrumb, mkSep, nwSafeStr, wrap.appendChild |
| [`mkCrumb`](../../../../../src-ts/runtime-executables/www/logic.ts#L4058) | label, nextPrefix, clickable | btn.addEventListener, document.createElement |
| [`mkSep`](../../../../../src-ts/runtime-executables/www/logic.ts#L4084) | – | document.createElement |
| [`nwOpenDpPicker`](../../../../../src-ts/runtime-executables/www/logic.ts#L4107) | initialQuery | – |
| [`isAlive`](../../../../../src-ts/runtime-executables/www/logic.ts#L4139) | – | – |
| [`finish`](../../../../../src-ts/runtime-executables/www/logic.ts#L4146) | val | cleanup, nwCloseModal, resolve |
| [`setTreeMessage`](../../../../../src-ts/runtime-executables/www/logic.ts#L4167) | html | isAlive |
| [`setResultsMessage`](../../../../../src-ts/runtime-executables/www/logic.ts#L4177) | html | isAlive |
| [`openPrefix`](../../../../../src-ts/runtime-executables/www/logic.ts#L4194) | nextPrefix | nwSafeStr, refreshTree |
| [`onPick`](../../../../../src-ts/runtime-executables/www/logic.ts#L4204) | id | finish |
| [`upOne`](../../../../../src-ts/runtime-executables/www/logic.ts#L4218) | – | parts.join, parts.pop, treePrefix.split |
| [`renderTree`](../../../../../src-ts/runtime-executables/www/logic.ts#L4237) | children | Array.isArray, String, isAlive, metaBits.join, metaBits.push, nwCreateDpResultRow, nwDpMetaText, nwSafeStr, treeWrap.appendChild |
| [`refreshTree`](../../../../../src-ts/runtime-executables/www/logic.ts#L4297) | – | isAlive, nwDpTree, nwEscapeHtml, nwRenderDpBreadcrumb, renderTree, setTreeMessage |
| [`onSearch`](../../../../../src-ts/runtime-executables/www/logic.ts#L4326) | – | isAlive, nwDpSearch, nwEscapeHtml, nwRenderDpResults, nwSafeStr, setResultsMessage |
| [`onClose`](../../../../../src-ts/runtime-executables/www/logic.ts#L4355) | – | finish |
| [`onBg`](../../../../../src-ts/runtime-executables/www/logic.ts#L4362) | e | finish |
| [`onKey`](../../../../../src-ts/runtime-executables/www/logic.ts#L4369) | e | e.preventDefault, finish, onSearch |
| [`onRoot`](../../../../../src-ts/runtime-executables/www/logic.ts#L4388) | – | openPrefix |
| [`onUp`](../../../../../src-ts/runtime-executables/www/logic.ts#L4395) | – | refreshTree, upOne |
| [`cleanup`](../../../../../src-ts/runtime-executables/www/logic.ts#L4405) | – | btn.removeEventListener, closeBtn.removeEventListener, modal.removeEventListener, qInp.removeEventListener, rootBtn.removeEventListener, upBtn.removeEventListener |
| [`nwOpenImport`](../../../../../src-ts/runtime-executables/www/logic.ts#L4455) | – | nwOpenModal, setTimeout |
| [`nwCloseImport`](../../../../../src-ts/runtime-executables/www/logic.ts#L4469) | – | nwCloseModal |
| [`nwApplyImport`](../../../../../src-ts/runtime-executables/www/logic.ts#L4478) | – | JSON.parse, alert, nwCloseImport, nwEnsureConfigDefaults, nwMarkDirty, nwRenderGraph, nwRenderGraphSelector, nwRenderInspector, nwSelectGraph |
| [`nwOpenExport`](../../../../../src-ts/runtime-executables/www/logic.ts#L4504) | – | JSON.stringify, nwDefaultGraph, nwOpenModal |
| [`nwCloseExport`](../../../../../src-ts/runtime-executables/www/logic.ts#L4518) | – | nwCloseModal |
| [`nwDownloadExport`](../../../../../src-ts/runtime-executables/www/logic.ts#L4527) | – | JSON.stringify, URL.createObjectURL, a.click, a.remove, document.body.appendChild, document.createElement, nwDefaultGraph, setTimeout, window.NW_RUNTIME?.url |
| [`nwSetBackupStatus`](../../../../../src-ts/runtime-executables/www/logic.ts#L4551) | msg, type | – |
| [`nwOpenBackup`](../../../../../src-ts/runtime-executables/www/logic.ts#L4563) | – | nwOpenModal, nwSetBackupStatus |
| [`nwCloseBackup`](../../../../../src-ts/runtime-executables/www/logic.ts#L4573) | – | nwCloseModal |
| [`nwBackupExport`](../../../../../src-ts/runtime-executables/www/logic.ts#L4582) | – | JSON.stringify, URL.createObjectURL, a.click, a.remove, document.body.appendChild, document.createElement, fetch, nwSetBackupStatus, res.json, setTimeout, window.NW_RUNTIME?.url |
| [`nwBackupImportFromFile`](../../../../../src-ts/runtime-executables/www/logic.ts#L4606) | file, mode | JSON.parse, JSON.stringify, fetch, file.text, nwSetBackupStatus, res.json |
| [`nwBackupRestoreFromUserdata`](../../../../../src-ts/runtime-executables/www/logic.ts#L4626) | – | JSON.stringify, confirm, fetch, nwSetBackupStatus, res.json, res2.json |
| [`nwEnsureGraphDefaults`](../../../../../src-ts/runtime-executables/www/logic.ts#L4654) | g | Array.isArray, Object.entries, nwUuid |
| [`nwInstallGlobalHandlers`](../../../../../src-ts/runtime-executables/www/logic.ts#L4696) | – | document.addEventListener, wrap.addEventListener |
| [`nwHandleSave`](../../../../../src-ts/runtime-executables/www/logic.ts#L4840) | – | Date.now, nwClearLocalDraft, nwDefaultGraph, nwEnsureConfigDefaults, nwHistoryReset, nwJsonClone, nwRenderGraph, nwRenderInspector, nwSafeStr, nwSaveConfig, nwSelectGraph, nwSetStatus |
| [`nwHandleNew`](../../../../../src-ts/runtime-executables/www/logic.ts#L4873) | – | nwDefaultGraph, nwEnsureConfigDefaults, nwMarkDirty, nwRenderGraph, nwRenderGraphSelector, nwRenderInspector, nwSelectGraph |
| [`nwInitLogicEditor`](../../../../../src-ts/runtime-executables/www/logic.ts#L4894) | – | Array.isArray, Number.isFinite, btnBackup.addEventListener, btnExport.addEventListener, btnImport.addEventListener, btnNew.addEventListener, btnOverview.addEventListener, btnSave.addEventListener, btnSmarthomeCfg.addEventListener, document.getElementById, fetch, localStorage.getItem, nwBuildLogicLibrary, nwClamp (weitere in der Quelle) |
