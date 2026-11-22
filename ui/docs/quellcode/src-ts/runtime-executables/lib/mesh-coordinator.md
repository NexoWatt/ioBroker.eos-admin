# src-ts/runtime-executables/lib/mesh-coordinator.ts

Verbindet einen festen EOS-Master mit bis zu 99 Slaves über das getrennte Tailscale-Netz.

**Daten und Wirkung:** Signierte HTTP-Nachrichten, verschlüsselte lokale Paarung, monotone Freigaben und lokale EMS-Grenzen. Keine direkte Geräteansteuerung.

**Bei Änderungen:** Sicherheitsvertrag, finale Writer, Rollenprüfung und 99-Knoten-/Ausfalltests gemeinsam prüfen. Geräteseitige Watchdogs bleiben erforderlich.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./http-error-boundary` | [src-ts/runtime-executables/lib/http-error-boundary.ts](../../../../../src-ts/runtime-executables/lib/http-error-boundary.ts) |
| `node:fs/promises` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:path` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:http` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:https` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:dns` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:perf_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./mesh-coordinator-contract` | [src-ts/runtime-executables/lib/mesh-coordinator-contract.ts](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-contract.ts) |
| `./mesh-energy-service` | [src-ts/runtime-executables/lib/mesh-energy-service.ts](../../../../../src-ts/runtime-executables/lib/mesh-energy-service.ts) |
| `./mesh-coordinator-protocol` | [src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts) |
| `../ems/services/measurement-freshness` | [src-ts/runtime-executables/ems/services/measurement-freshness.ts](../../../../../src-ts/runtime-executables/ems/services/measurement-freshness.ts) |
| `@iobroker/adapter-core` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`tailnetLookup`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L34) | hostname, options, callback, resolver | resolver |
| [`exchangeHttp`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L48) | origin, packet, timeoutMs, agents, pending, endpoint | – |
| [`finish`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L57) | error, value | clearTimeout, pending.delete, reject, resolve |
| [`MeshCoordinator.constructor`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L76) | adapter, options | C.defaultConfig, accountingDefaults |
| [`MeshCoordinator.init`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L86) | – | – |
| [`MeshCoordinator.encryptionKey`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L109) | – | crypto.createHash, this.adapter.getForeignObjectAsync |
| [`MeshCoordinator.persist`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L114) | data | Buffer.concat, JSON.stringify, cipher.final, cipher.getAuthTag, cipher.update, ciphertext.toString, crypto.createCipheriv, crypto.randomBytes, dir.close, dir.sync, fs.mkdir, fs.open, fs.rename, fs.unlink (weitere in der Quelle) |
| [`MeshCoordinator.appState`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L136) | config | this.roleLicensed |
| [`MeshCoordinator.roleLicensed`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L146) | role, continuing | authority.call |
| [`MeshCoordinator.assertAppChange`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L155) | candidate | createPublicHttpError, this.appState |
| [`MeshCoordinator.migrateAppLifecycle`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L164) | – | C.clone, JSON.stringify, this.adapter.log?.info, this.adapter.nwApplyInstallerPatchToRuntimeConfig, this.adapter.setStateAsync, this.persist |
| [`MeshCoordinator.syncAppLifecycle`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L181) | – | this.appState, this.start, this.stop |
| [`MeshCoordinator.publicConfig`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L186) | – | C.clone, Object.keys, this.appState |
| [`MeshCoordinator.configure`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L189) | raw, slaveKey | C.validateConfig, Object.fromEntries, createPublicHttpError, next.nodes.filter, next.nodes.some, this.appState, this.checkLocalWriters, this.init, this.persist, this.publicConfig, this.requestTick, this.resetProtocols, this.roleLicensed, this.syncAppLifecycle |
| [`MeshCoordinator.checkLocalWriters`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L209) | config | createPublicHttpError, dp?.getEntry, inverters.every, this.adapter._nwGetStorageControlAuthority |
| [`MeshCoordinator.pair`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L234) | nodeId | C.clone, createPublicHttpError, crypto.randomBytes, this.appState, this.config.nodes.find, this.init, this.persist, this.roleLicensed |
| [`MeshCoordinator.resetProtocols`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L247) | – | req.destroy, this.rates.clear |
| [`MeshCoordinator.sample`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L257) | – | Date.now, Math.max, Number.isFinite, Object.values, String, ages.push, buildNvpSnapshotFromRegistry, dp.getConnectionStatus, dp.getEntry, dp.getMeasurementAgeMs, dp.getNumber, this.adapter._nwLicenseAllowsAppId, this.localDemand, this.options.sample |
| [`MeshCoordinator.localDemand`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L288) | sample | Date.now, Math.max, Math.min, Number, Number.isFinite, points.map, this.adapter._nwChargingManagementAudit?.getSnapshot |
| [`MeshCoordinator.siteSample`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L309) | – | Math.max, Number.isFinite, String, ages.push, dp.getConnectionStatus, dp?.getEntry, dp?.getMeasurementAgeMs, dp?.getNumber, this.options.siteSample, this.sample |
| [`MeshCoordinator.registerFeedback`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L323) | – | Object.entries, String, dp.getEntry, dp.upsert, key.endsWith |
| [`MeshCoordinator.markApplied`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L337) | lease | Date.now, Object.values, this.currentLimits |
| [`MeshCoordinator.currentLimits`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L345) | – | C.clone, this.appState, this.sample, this.slave.current, this.slave.fail, this.slave?.fail, validSample |
| [`MeshCoordinator.requestTick`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L358) | – | this.adapter.emsEngine?.requestImmediateTick |
| [`MeshCoordinator.receive`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L361) | packet | C.sign, C.verify, Math.ceil, recent.push, recent.some, this.appState, this.master.exchange, this.master.hello, this.now, this.rates.get, this.rates.set, this.siteSample |
| [`MeshCoordinator.cycle`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L376) | – | C.sign, C.verify, Date.now, Math.max, Number.isFinite, String, this.appState, this.latencies.at, this.latencies.push, this.latencies.shift, this.master.exchange, this.master.hello, this.master.plan, this.now (weitere in der Quelle) |
| [`MeshCoordinator.start`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L403) | – | crypto.randomInt, setInterval, setTimeout, this.appState, this.energy.start, this.init, this.timer.unref, this.watchdog.unref |
| [`run`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L409) | – | Math.max, setTimeout, this.cycle, this.now, this.timer.unref |
| [`MeshCoordinator.stop`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L419) | – | clearInterval, clearTimeout, req.destroy, this.energy.stop, this.slave?.fail |
| [`MeshCoordinator.notificationEvent`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L422) | – | this.appState, this.currentLimits |
| [`MeshCoordinator.archiveTransport`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L430) | packet | exchangeHttp |
| [`MeshCoordinator.setOperating`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L433) | raw | C.membersOf, C.number, createPublicHttpError, this.init, this.master.plan, this.persist, this.requestTick, this.siteSample |
| [`MeshCoordinator.configureAccounting`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L454) | raw | C.clone, createPublicHttpError, this.energy.journals.values, this.energy.status, this.init, this.persist, validateAccounting |
| [`MeshCoordinator.status`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts#L466) | – | Math.ceil, this.currentLimits, this.energy.status, this.latencies.at, this.master?.status |
