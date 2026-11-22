# src-ts/runtime-executables/ems/modules/mesh-microgrid.ts

Verarbeitet die konfigurierte Kopplung von Energie-Systemen und stellt ihre Austausch- und Betriebsinformationen bereit.

**Daten und Wirkung:** Verarbeitet die über Signaturen, Konfiguration und direkte Imports zugeführten Werte. Funktionsverzeichnis und Aufrufstellen zeigen, wo Ergebnisse zurückgegeben, Zustände veröffentlicht oder Befehle weitergereicht werden.

**Bei Änderungen:** Einheiten, Vorzeichen, Gültigkeit und Aufrufer mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./base` | [src-ts/runtime-executables/ems/modules/base.ts](../../../../../../src-ts/runtime-executables/ems/modules/base.ts) |
| `../services/actuator-shadow-arbiter` | [src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`safeId`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L49) | input, fallback | String |
| [`num`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L54) | value, fallback | Number, Number.isFinite |
| [`round`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L59) | value, digits | Math.max, Math.min, Math.pow, Math.round, Number, Number.isFinite |
| [`clamp`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L66) | value, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`normalizeType`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L72) | type | String |
| [`normalizeRole`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L83) | role, type | String, normalizeType |
| [`normalizeNodes`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L96) | raw | Array.isArray, arr.map |
| [`normalizeTargetGroups`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L146) | raw | Array.isArray, arr.map |
| [`nodeInTargetGroup`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L188) | node, group | Array.isArray, g.memberNodeIds.includes, g.memberTypes.includes, n.targetGroupIds.includes, normalizeType, safeId |
| [`targetGroupsForCommand`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L199) | command, node, groups | Array.isArray, list.filter |
| [`_meshGroupLimitForCommand`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L206) | groups, node, command | Math.max, Math.min, String, addMax, addMin, cat.includes, dir.includes, groupList.map, targetGroupsForCommand |
| [`addMax`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L214) | value, id | Math.max, Math.round, limits.push, num, reasons.push |
| [`addMin`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L218) | value, id | Math.max, Math.round, minLimits.push, num, reasons.push |
| [`buildTargetGroupPlan`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L240) | groups, nodes, commands | Array.isArray, groupList.map, summaries.filter, summaries.slice |
| [`prioritySort`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L298) | a, b | Number, Number.isFinite, String |
| [`reversePrioritySort`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L309) | a, b | prioritySort |
| [`priorityOrder`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L313) | nodes | Array.isArray |
| [`buildGridLimitDiagnostics`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L322) | totals, gridLimitW | Math.max, Math.round, num, round |
| [`makePlannedAction`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L340) | input | Math.max, Math.round, num |
| [`buildPlanning`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L372) | nodes, totals, gridLimitW, mode | Array.isArray, Math.max, Math.min, Math.round, actions.filter, actions.map, active.filter, buildGridLimitDiagnostics, demands.slice, gridLastActions.push, gridLimitActions.push, localFirstActions.push, makePlannedAction, num (weitere in der Quelle) |
| [`normalizeCommandOutputCfg`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L525) | raw | Math.max, Math.min, Math.round, String, num |
| [`normalizeTailscaleCfg`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L535) | raw | Array.isArray, Math.max, Math.min, Math.round, String, num, peerUrlText.split, safeId, t.peerUrls.join |
| [`normalizeReceiverCfg`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L558) | raw | Array.isArray, Math.max, Math.min, Math.round, String, allowedPeerNodeIdsRaw.split, normalizeTailscaleCfg, num, r.allowedPeerNodeIds.join |
| [`normalizeLocalBridgeCfg`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L602) | raw | Array.isArray, Math.max, Math.min, Math.round, String, num, rawMappings.map |
| [`normalizeManualReleaseList`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L664) | raw, now | Array.isArray, Date.now, Math.max, Number, String, out.push, out.slice |
| [`buildManualReleaseSummary`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L689) | raw, now | Date.now, Number, active.map, normalizeManualReleaseList |
| [`manualReleaseForMapping`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L703) | manualReleaseSummary, mapping | Array.isArray, String, list.find |
| [`buildTargetCommandHistory`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L711) | commandHistory, maxPerTarget | Array.isArray, Date.now, Number, String, byTarget.entries, byTarget.get, byTarget.has, byTarget.set, history.sort, targets.push, targets.sort |
| [`buildBridgeAckSummary`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L773) | rows | Array.isArray, list.filter |
| [`buildBridgeAckGate`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L792) | localBridge, ackSummary, manualReleaseSummary | Array.isArray, Date.now, Math.max, Number, String, ack.targets.map, allowedMappingIds.push, blockedMappings.filter, blockedMappings.push, buildBridgeAckSummary, buildManualReleaseSummary, byMapping.get, byMapping.has, byMapping.set (weitere in der Quelle) |
| [`findLocalBridgeMappingForCommand`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L921) | command, mappings | Array.isArray, String, candidates.sort, list.filter, safeId |
| [`buildLocalBridgePlan`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L945) | commandGuard, bridgeCfg | Array.isArray, Math.max, Math.min, Math.round, findLocalBridgeMappingForCommand, mappedCommands.push, normalizeLocalBridgeCfg, num, unmappedCommands.push, warnings.push |
| [`_meshParseJsonMaybe`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1027) | value | JSON.parse, String |
| [`_meshAckText`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1034) | raw | String, _meshParseJsonMaybe |
| [`classifyLocalBridgeAck`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1045) | raw | _meshAckText |
| [`buildTargetGroupFairnessPlan`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1072) | groups, nodes, commands | Array.from, Array.isArray, Math.max, Math.min, Math.round, budgets.set, budgets.values, cmdList.filter, cmdList.map, cmdList.reduce, groupBudgets.filter, groupList.slice, nodeList.map, num (weitere in der Quelle) |
| [`_meshPositiveLimits`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1135) | values | Array.isArray |
| [`_meshNodeLimitForCommand`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1141) | node, command | Math.max, Math.min, Math.round, String, add, cat.includes, dir.includes, normalizeType, num |
| [`add`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1149) | value, id | Math.max, Math.round, limits.push, num, reasons.push |
| [`_meshBridgeLimitForCommand`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1166) | command, bridgeCfg | Math.max, Math.round, findLocalBridgeMappingForCommand, normalizeLocalBridgeCfg, num, reasons.push |
| [`buildCommandLimitDiagnostics`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1178) | commands, nodes, bridgeCfg, targetGroups | Array.isArray, Number, blockedCommands.concat, bridgeTargets.reduce, buildTargetGroupFairnessPlan, buildTargetGroupPlan, cmdList.map, limitedCommands.concat, nodeLimits.reduce, nodeList.map, targetGroupPlan.groups.reduce |
| [`buildCommandGuard`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1281) | planning, nodes, cluster, controlCfg, tailscaleCfg, bridgeCfg, targetGroupCfg | Array.isArray, Math.max, Math.round, String, actions.map, allowedCommands.push, blockedCommands.map, blockedCommands.push, buildCommandLimitDiagnostics, buildTargetGroupPlan, nodeList.every, nodeList.map, normalizeCommandOutputCfg, normalizeLocalBridgeCfg (weitere in der Quelle) |
| [`classifyPeerFieldTestIssue`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1417) | peer | Array.isArray, String, hay.includes, p.errors.map |
| [`classifyRoundtripStatus`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1442) | ms | Number, Number.isFinite |
| [`buildRemoteNodeMatrixFromPeers`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1450) | peerMatrix | Array.isArray, Math.max, Math.round, classifyPeerFieldTestIssue, classifyRoundtripStatus, num, rows.push, safeId |
| [`classifyPeerError`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1497) | input | Number, String, text.includes, text.trim |
| [`peerRoundtripStatus`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1516) | ms, ok | Number, Number.isFinite |
| [`buildRemoteNodeMatrix`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1525) | remoteNodes, peers | Array.isArray, list.map |
| [`buildAllowedPeerDiagnostics`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1549) | receiverCfg | Array.isArray, String, r.allowedPeerNodeIds.join, raw.split |
| [`parseAllowedPeerNodeIds`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1563) | receiverCfg | Array.isArray, buildAllowedPeerDiagnostics |
| [`classifyPeerIssue`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1568) | peer | classifyPeerError, classifyPeerFieldTestIssue |
| [`roundtripLevel`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1574) | ms, ok | peerRoundtripStatus |
| [`buildTwoInstanceFieldTestDiagnostics`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1578) | input | Array.isArray, Date.now, Number, buildRemoteNodeMatrixFromPeers, commandHistory.slice, parseAllowedPeerNodeIds, peerMatrix.filter, peerMatrix.reduce, peers.map, roundtripLevel, warnings.join, warnings.push |
| [`MeshMicrogridModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1680) | adapter, dpRegistry | Date.now, buildManualReleaseSummary, buildTargetCommandHistory, super |
| [`MeshMicrogridModule._cfg`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1698) | – | – |
| [`MeshMicrogridModule._enabled`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1703) | – | this._cfg |
| [`MeshMicrogridModule._mode`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1708) | – | String, this._cfg |
| [`MeshMicrogridModule._nodes`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1714) | – | normalizeNodes, this._cfg |
| [`MeshMicrogridModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1718) | – | this._ensureStates, this._publishDisabledOrInit, this._registerDatapoints |
| [`MeshMicrogridModule._registerDatapoints`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1724) | – | this._nodes, this.dp.upsert |
| [`MeshMicrogridModule._ensureStates`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1751) | – | ch, mk |
| [`ch`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1754) | id, name | a.setObjectNotExistsAsync |
| [`mk`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L1755) | id, name, type, role, unit, def | a.setObjectNotExistsAsync |
| [`MeshMicrogridModule._getNumber`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2030) | key, fallback | this.dp.getNumber |
| [`MeshMicrogridModule._commandOutputCfg`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2037) | – | normalizeCommandOutputCfg, this._cfg |
| [`MeshMicrogridModule._tailscaleCfg`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2041) | – | normalizeTailscaleCfg, this._cfg |
| [`MeshMicrogridModule._receiverCfg`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2045) | – | normalizeReceiverCfg, this._cfg |
| [`MeshMicrogridModule._localBridgeCfg`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2049) | – | normalizeLocalBridgeCfg, this._cfg |
| [`MeshMicrogridModule._targetGroups`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2053) | – | normalizeTargetGroups, this._cfg |
| [`MeshMicrogridModule._stateJson`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2057) | id, fallback | JSON.parse, a.getForeignStateAsync, a.getStateAsync, raw.trim |
| [`MeshMicrogridModule._readManualReleaseSummary`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2070) | – | Date.now, buildManualReleaseSummary, this._localBridgeCfg, this._stateJson |
| [`MeshMicrogridModule._normalPeerUrl`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2080) | raw | String, withProto.replace |
| [`MeshMicrogridModule._pollTailscalePeers`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2093) | – | Array.isArray, Date.now, String, base.replace, clearTimeout, fetch, peers.push, peers.some, remoteNodes.push, res.json, safeId, setTimeout, this._normalPeerUrl, this._tailscaleCfg |
| [`MeshMicrogridModule._remoteNodeSnapshots`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2142) | – | Array.isArray, this._remoteSnapshots.slice |
| [`MeshMicrogridModule._buildFieldCommandEnvelope`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2146) | snap, commandGuard | Array.isArray, Date.now, commandGuard.allowedCommands.slice, this._commandOutputCfg, this._tailscaleCfg |
| [`MeshMicrogridModule._sendFieldCommandsToPeers`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2181) | envelope | Array.isArray, Date.now, JSON.stringify, String, clearTimeout, fetch, hardenedPeers.some, peers.map, peers.push, res.json, setTimeout, this._normalPeerUrl, this._rememberPeerHistory, this._tailscaleCfg |
| [`MeshMicrogridModule._rememberCommandHistory`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2215) | entry | Array.isArray, Date.now |
| [`MeshMicrogridModule._rememberPeerHistory`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2221) | entry | Array.isArray, Date.now, Number, classifyPeerError, peerRoundtripStatus |
| [`MeshMicrogridModule._writeLocalBridgeCommands`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2235) | envelope, localBridge, control, ackGate | Array.isArray, Date.now, JSON.stringify, String, a.setForeignStateAsync, a.setStateAsync, blockedByMapping.get, blockedByMapping.has, blockedByMapping.set, bridgeWrites.push, buildBridgeAckGate, buildBridgeAckSummary, byState.entries, byState.get (weitere in der Quelle) |
| [`MeshMicrogridModule._evaluateLocalBridgeAck`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2318) | localBridge, bridgeWrites | Array.isArray, Date.now, Math.max, Math.round, Number, String, a.getForeignStateAsync, a.getStateAsync, classifyLocalBridgeAck, num, targets.push, targets.reduce, this._localBridgeCfg, writes.find |
| [`MeshMicrogridModule._writeFieldCommands`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2451) | snap | Array.isArray, Date.now, JSON.stringify, String, a.setForeignStateAsync, a.setStateAsync, bridgeWrites.filter, bridgeWrites.some, buildBridgeAckGate, buildBridgeAckSummary, buildLocalBridgePlan, isActuatorAuthorityBlockedResult, this._buildFieldCommandEnvelope, this._commandOutputCfg (weitere in der Quelle) |
| [`MeshMicrogridModule._nodeSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2525) | node | Math.abs, Math.max, Number, Number.isFinite, clamp, num, round, this._getNumber |
| [`MeshMicrogridModule._buildSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2605) | – | Date.now, Math.max, Math.min, Math.round, String, activeNodes.map, buildCommandGuard, buildLocalBridgePlan, buildPlanning, buildTargetGroupPlan, buildTwoInstanceFieldTestDiagnostics, nodes.filter, num, round (weitere in der Quelle) |
| [`sum`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2616) | field | snapshots.reduce |
| [`MeshMicrogridModule._publishDisabledOrInit`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2711) | reason | this._buildSnapshot, this._enabled, this._publish |
| [`MeshMicrogridModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2718) | – | JSON.stringify, this._buildSnapshot, this._cfg, this._pollTailscalePeers, this._publish, this._registerDatapoints, this._writeFieldCommands |
| [`MeshMicrogridModule._publish`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2736) | snap | Array.isArray, Date.now, JSON.stringify, Number, String, buildAllowedPeerDiagnostics, buildBridgeAckGate, buildCommandLimitDiagnostics, buildLocalBridgePlan, buildTargetCommandHistory, buildTargetGroupPlan, commandHistory.slice, fieldTest.warnings.join, lbWrites.filter (weitere in der Quelle) |
| [`set`](../../../../../../src-ts/runtime-executables/ems/modules/mesh-microgrid.ts#L2740) | id, val | a.setStateAsync |
