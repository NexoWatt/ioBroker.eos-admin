# src-ts/runtime-executables/ems/nexologic-engine.ts

Wertet NexoLogic-Regeln und ihre Eingänge aus und gibt die daraus abgeleiteten logischen Ausgangsanforderungen weiter.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `../lib/http-error-boundary` | [src-ts/runtime-executables/lib/http-error-boundary.ts](../../../../../src-ts/runtime-executables/lib/http-error-boundary.ts) |
| `./services/nexologic-output-controller` | [src-ts/runtime-executables/ems/services/nexologic-output-controller.ts](../../../../../src-ts/runtime-executables/ems/services/nexologic-output-controller.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`NexoLogicEngine.constructor`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L94) | adapter | – |
| [`NexoLogicEngine.stop`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L116) | – | r.stop, this._dpToInputs.clear, this._subscribed.clear, this.adapter.unsubscribeForeignStatesAsync, this.outputController.stop |
| [`NexoLogicEngine.init`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L155) | config | Array.isArray, Promise.all, String, createPublicHttpError, primeJobs.push, runner.beginInitialization, runner.finishInitialization, runner.getDpInputs, runner.getOutputDefinitions, runner.restorePersistentState, this._dpToInputs.get, this._dpToInputs.has, this._dpToInputs.set, this._subscribed.add (weitere in der Quelle) |
| [`NexoLogicEngine.getBudgetIntents`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L224) | – | this.outputController.getBudgetIntents |
| [`NexoLogicEngine.applyBudgetGrant`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L230) | key, grantW | this.outputController.applyBudgetGrant |
| [`NexoLogicEngine.handleStateChange`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L247) | id, state | String, m.runner.setDpInputState, this._dpToInputs.get |
| [`GraphRunner.constructor`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L290) | adapter, graph, outputController | Array.isArray, String, this._build |
| [`GraphRunner.stop`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L323) | – | Object.keys, clearInterval, clearTimeout, this._nodeInternal.values, this._persistTimers.clear, this._persistTimers.values, this.flushPersistentState |
| [`GraphRunner._build`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L361) | – | Array.isArray, String, buildTopologicalOrder, this._dpInputNodes.push, this._incoming.set, this.adj.get, this.adj.has, this.adj.set, this.nodes.has, this.nodes.set |
| [`GraphRunner.beginInitialization`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L414) | – | – |
| [`GraphRunner.finishInitialization`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L419) | – | this._evalNode, this._evaluateTopological, this.nodes.values |
| [`GraphRunner._evaluateTopological`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L432) | initial | Array.from, this._evalNode, this._incoming.get, this.nodes.get, this.nodes.keys |
| [`GraphRunner._stateId`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L449) | nodeId | safeStatePart |
| [`GraphRunner._persistentKeys`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L455) | node | String |
| [`GraphRunner._serializableState`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L462) | nodeId, internal | Date.now, JSON.parse, JSON.stringify, this._persistentKeys, this.nodes.get |
| [`GraphRunner.restorePersistentState`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L479) | – | JSON.parse, JSON.stringify, st.val.trim, this._nodeInternal.set, this._persistedJson.set, this._persistentKeys, this._stateId, this.adapter.getStateAsync, this.nodes.values |
| [`GraphRunner._schedulePersistentState`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L494) | nodeId, internal | JSON.stringify, clearTimeout, setTimeout, this._persistTimers.get, this._persistTimers.set, this._persistedJson.get, this._serializableState |
| [`GraphRunner._writePersistentState`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L509) | nodeId, row | JSON.stringify, this._persistedJson.set, this._stateId, this.adapter.setObjectNotExistsAsync, this.adapter.setStateAsync |
| [`GraphRunner.flushPersistentState`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L525) | – | clearTimeout, this._nodeInternal.get, this._persistTimers.delete, this._persistTimers.entries, this._serializableState, this._writePersistentState |
| [`GraphRunner.getDpInputs`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L547) | – | this._dpInputNodes.slice |
| [`GraphRunner._resolveSceneDpId`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L551) | node | Array.isArray, String, devs.find, this.adapter.getSmartHomeConfig |
| [`GraphRunner.getOutputDefinitions`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L572) | – | String, out.push, this._resolveSceneDpId, this.nodes.values, toBool |
| [`GraphRunner._requestOutput`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L601) | nodeId, targetId, value, ack, reason, kind, params | Promise.reject, Promise.resolve, String, this.adapter._nwHasCentralLicenseGrant, this.adapter.setForeignStateAsync, this.outputController.request |
| [`GraphRunner.setDpInputValue`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L630) | nodeId, value | Date.now, this.setDpInputState |
| [`GraphRunner.setDpInputState`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L634) | nodeId, state, options | Date.now, Math.max, Math.min, Math.round, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String, castValue, isEqual, this._propagateFrom, this.nodes.get, toNum |
| [`GraphRunner.evaluateAll`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L692) | – | this._evaluateTopological |
| [`GraphRunner._propagateFrom`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L708) | fromNodeId, fromPort | isEqual, q.push, q.shift, seen.add, seen.has, this._evalNode, this.adj.get, this.nodes.get |
| [`GraphRunner._evalNode`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L762) | nodeId, queue, options | String, def.compute, def.inputs.some, isEqual, queue.push, res.sideEffect, this._nodeInternal.get, this._nodeInternal.set, this._propagateFrom, this._schedulePersistentState, this.nodes.get, this.outputController.safeStop, toBool |
| [`toBool`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L846) | v, def | Number, Number.isFinite, s.replace, v.trim |
| [`toNum`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L871) | v, def | Number, Number.isFinite, s.replace, v.trim |
| [`isEqual`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L896) | a, b | Number.isNaN |
| [`castValue`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L907) | value, cast | Number, Number.isFinite, String, s.replace, s.toLowerCase, toBool, toNum, value.trim |
| [`clamp`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L944) | v, lo, hi | Math.max, Math.min |
| [`parseTimeToMin`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L951) | s | Math.max, Math.min, String, parseInt, str.match |
| [`parseDays`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L974) | s | Number.isFinite, String, out.add, parseInt |
| [`nowLocal`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1016) | – | – |
| [`getIsoDay`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1023) | d | d.getDay |
| [`scheduleNextMinuteTick`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1041) | { internal, runner, nodeId } | Date.now, Math.max, Math.min, clearTimeout, setTimeout |
| [`triggerShortPulse`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1063) | { internal, key, widthMs, runner, nodeId, maxWidthMs = 2000, afterPulseMs = 0 } | Math.max, Math.min, Math.round, clearTimeout, setTimeout, toNum |
| [`safeStatePart`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1108) | value, fallback | String |
| [`buildTopologicalOrder`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1113) | nodes, links | Array.from, Array.isArray, String, edges.get, edges.set, indegree.entries, indegree.get, indegree.set, nodes.has, nodes.keys, out.push, queue.push, queue.shift |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1143) | { out } | – |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1149) | { in: inp, params, internal, runner, nodeId } | Date.now, Math.max, Math.min, Math.round, Number.isFinite, String, clearTimeout, isEqual, toBool, toNum |
| [`schedulePending`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1184) | – | Math.max, clearTimeout, setTimeout |
| [`sideEffect`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1220) | – | clearTimeout, runner._requestOutput, schedulePending |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1248) | { params } | String, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1262) | { in: inp } | toBool |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1268) | { in: inp } | toBool |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1274) | { in: inp } | toBool |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1280) | { in: inp } | toBool |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1290) | { in: inp, params, internal } | String, toBool |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1317) | { in: inp, params, internal } | String, toBool |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1341) | { in: inp, internal, runner, nodeId } | toBool, triggerShortPulse |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1366) | { in: inp, internal, runner, nodeId } | toBool, triggerShortPulse |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1385) | { in: inp, internal, runner, nodeId } | toBool, triggerShortPulse |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1404) | { in: inp, internal, runner, nodeId } | toBool, triggerShortPulse |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1424) | { in: inp, params } | Number.isFinite, String, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1472) | { in: inp, params, internal } | toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1495) | { in: inp } | toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1501) | { in: inp } | toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1507) | { in: inp } | toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1513) | { in: inp, params } | toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1524) | { in: inp } | Math.max, Math.min, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1534) | { in: inp, params } | clamp, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1545) | { in: inp, params } | Math.max, Math.min, Math.pow, Math.round, String, clamp, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1587) | { in: inp, params, internal, runner, nodeId } | Date.now, Math.max, Math.min, Math.round, Number.isFinite, String, clearTimeout, setTimeout, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1663) | { in: inp, params } | Math.abs, Math.max, Math.min, Math.pow, Math.round, Number.isFinite, String, clamp, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1700) | { in: inp, params, internal, runner, nodeId } | Date.now, Math.abs, Math.max, Math.min, Math.pow, Math.round, Number.isFinite, String, clamp, clearIntervalSafe, round, setInterval, toBool, toNum |
| [`clearIntervalSafe`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1737) | – | clearInterval |
| [`round`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1811) | x | Math.round |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1821) | { in: inp, params, internal } | Number.isFinite, String, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1855) | { in: inp, params, internal, runner, nodeId } | Math.max, Math.min, Math.round, clearTimeout, clearTimers, setTimeout, toBool, toNum |
| [`clearTimers`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1880) | – | clearTimeout |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L1936) | { in: inp, params } | Math.max, Math.min, Math.pow, Math.round, Number.isFinite, String, clamp, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2004) | { in: inp, params, internal, runner, nodeId } | Date.now, Math.max, Math.min, Math.round, Number.isFinite, clearPulses, setTimeout, toBool, toNum, triggerShortPulse |
| [`clearPulses`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2031) | – | Object.keys, clearTimeout |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2085) | { in: inp, params, internal, runner, nodeId } | Date.now, Math.abs, Math.max, Math.min, Math.round, Number.isFinite, clamp, clearTimeout, clearTimers, setTimeout, toBool, toNum |
| [`clearTimers`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2106) | – | clearTimeout |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2175) | { in: inp, params, internal, runner, nodeId } | Math.max, Math.min, Math.round, clearTimeout, setTimeout, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2218) | { in: inp, params, internal, runner, nodeId } | Math.max, Math.min, Math.round, clearTimeout, setTimeout, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2255) | { in: inp, params, internal, runner, nodeId } | Math.max, Math.min, Math.round, clearTimeout, setTimeout, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2291) | { in: inp, params, internal, runner, nodeId } | Math.max, Math.min, Math.round, String, clearTimeout, setTimeout, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2332) | { in: inp, params, internal, runner, nodeId } | Math.max, Math.min, Math.round, String, clearTimeout, setTimeout, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2373) | { in: inp, params, internal, runner, nodeId } | Math.max, Math.min, Math.round, clearTimeout, setTimeout, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2410) | { in: inp, params, internal, runner, nodeId } | String, d.getHours, d.getMinutes, days.has, getIsoDay, nowLocal, parseDays, parseTimeToMin, scheduleNextMinuteTick, toBool |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2469) | { in: inp, params, internal } | clamp, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2510) | { in: inp, params, internal } | clamp, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2556) | { in: inp, params, internal, runner, nodeId } | Date.now, Math.max, Math.min, Math.pow, Math.round, Number.isFinite, clearTimeout, scheduleNextMinuteTick, toBool, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2625) | { in: inp, params, internal, runner, nodeId } | Math.max, Math.min, Math.round, String, runner._resolveSceneDpId, toBool, toNum |
| [`sideEffect`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2659) | – | runner._requestOutput |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2695) | { in: inp } | Math.min, toNum |
| [`compute`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2700) | { in: inp } | Math.max, toNum |
| [`validateNexoLogicConfig`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2706) | config | Array.from, Array.isArray, Number, String, adjacency.get, adjacency.has, adjacency.keys, fromDef.outputs.includes, graphIds.add, graphIds.has, incoming.add, incoming.has, issue, linkIds.add (weitere in der Quelle) |
| [`issue`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2712) | code, message, path, detail | errors.push |
| [`visit`](../../../../../src-ts/runtime-executables/ems/nexologic-engine.ts#L2773) | id | adjacency.get, cycle.join, issue, stack.indexOf, stack.pop, stack.push, stack.slice, visit, visited.add, visited.has, visiting.add, visiting.delete, visiting.has |
