# src-ts/runtime-executables/lib/partner-runtime.ts

Verbindet geschützte lokale Bereitstellung, Replayjournal, Fachdienst und ausgehendes WSS.

**Daten und Wirkung:** Liest ausschließlich feste Messwertprojektionen und eine benannte Umgebungsreferenz;

**Bei Änderungen:** Journalverlust, Widerruf während await, Reconnectgeneration, Appzustand und Datenfrische testen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:fs/promises` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:fs` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:path` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:perf_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./partner-contracts` | [src-ts/runtime-executables/lib/partner-contracts.ts](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts) |
| `./partner-service` | [src-ts/runtime-executables/lib/partner-service.ts](../../../../../src-ts/runtime-executables/lib/partner-service.ts) |
| `./partner-websocket` | [src-ts/runtime-executables/lib/partner-websocket.ts](../../../../../src-ts/runtime-executables/lib/partner-websocket.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`missing`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L47) | error | partnerRecord |
| [`secureMode`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L49) | stat, directory | process.getuid, stat.isDirectory, stat.isFile, stat.isSymbolicLink |
| [`syncDirectory`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L55) | directory | fs.open, handle.close, handle.sync |
| [`readProtected`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L60) | file, maxBytes | Buffer.alloc, buffer.subarray, fs.open, handle.close, handle.read, handle.stat, secureMode |
| [`PartnerJournalStore.constructor`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L88) | dataDirectory | path.isAbsolute, path.join |
| [`PartnerJournalStore.checkParents`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L96) | – | fs.lstat, path.dirname, path.resolve, secureMode, stat.isDirectory, stat.isSymbolicLink |
| [`PartnerJournalStore.load`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L109) | – | this.ordered |
| [`PartnerJournalStore.loadInternal`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L110) | – | Array.isArray, JSON.parse, JSON.stringify, fs.lstat, fs.mkdir, fs.open, marker.close, marker.sync, marker.writeFile, missing, partnerKeys, partnerRecord, readProtected, syncDirectory (weitere in der Quelle) |
| [`PartnerJournalStore.persist`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L132) | entries | this.ordered |
| [`PartnerJournalStore.persistInternal`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L133) | entries | Array.isArray, Buffer.byteLength, JSON.stringify, readProtected, this.atomicWrite, this.checkParents |
| [`PartnerJournalStore.revokedVersion`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L142) | – | JSON.parse, partnerInteger, partnerKeys, partnerRecord, readProtected, this.checkParents |
| [`PartnerJournalStore.revoke`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L150) | version | this.ordered |
| [`PartnerJournalStore.revokeInternal`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L151) | version | JSON.stringify, Math.max, partnerInteger, this.atomicWrite, this.revokedVersion |
| [`PartnerJournalStore.ordered`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L157) | operation | result.then, this.serial.then |
| [`PartnerJournalStore.atomicWrite`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L162) | file, text | fs.open, fs.rename, fs.unlink, handle.close, handle.sync, handle.writeFile, path.join, randomBytes, syncDirectory |
| [`readPartnerProvisioning`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L177) | config, environment | Array.isArray, Buffer.byteLength, JSON.parse, endpoint.path.startsWith, partnerId, partnerInteger, partnerKeys, partnerRecord, privateVpnAddresses.push, value.privateVpnAddresses.some |
| [`sample`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L200) | read, key, now, min, max | partnerInteger, partnerNumber, read |
| [`balanceProjection`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L205) | read, now | Buffer.byteLength, JSON.parse, Math.max, Number, Object.create, Object.values, partnerInteger, partnerNumber, partnerRecord, read |
| [`readPartnerProjection`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L227) | config, read, appId, resourceId, kind, now, telemetry | Date.now, Math.max, Math.min, balanceProjection, config.arbitrage.resources.find, partnerInteger, partnerNumber, partnerRecord, sample |
| [`PartnerRuntime.constructor`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L261) | hooks | – |
| [`PartnerRuntime.refresh`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L263) | – | Date.parse, JSON.stringify, Math.max, Math.min, Number.isFinite, currentPartnerConfig, performance.now, readPartnerProvisioning, service.initialize, service.invalidate, this.authorized, this.hooks.createTransport, this.hooks.getRoot, this.journal.revokedVersion (weitere in der Quelle) |
| [`loadJournal`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L275) | – | this.journal.load |
| [`persistJournal`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L275) | entries | this.journal.persist |
| [`isAppActive`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L276) | appId | this.hooks.isAppActive |
| [`isResourceAvailable`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L276) | resourceId | this.hooks.isResourceAvailable |
| [`controlAvailable`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L276) | – | this.authorized, this.hooks.controlAvailable |
| [`readData`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L277) | appId, resourceId, kind | readPartnerProjection, this.hooks.isResourceAvailable, this.hooks.readTelemetry, this.now |
| [`now`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L281) | – | this.now |
| [`isAuthorized`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L289) | – | this.authorized |
| [`onState`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L290) | state, code | code.toUpperCase, service.setConnection |
| [`onMessage`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L291) | partnerIdValue, text, context | context.isCurrent, context.send, service.handleMessage, this.authorized |
| [`PartnerRuntime.now`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L301) | – | Date.now, this.hooks.now |
| [`PartnerRuntime.authorized`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L303) | generation | JSON.stringify, config.grants.some, currentPartnerConfig, performance.now, this.hooks.getRoot, this.now, this.service.invalidate, this.service?.authorize |
| [`PartnerRuntime.getCurrentRequest`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L312) | resourceId | this.authorized, this.block, this.service?.getCurrentRequest |
| [`PartnerRuntime.snapshot`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L316) | – | this.service?.snapshot |
| [`PartnerRuntime.invalidate`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L321) | reason | Math.max, this.block, this.journal.load, this.journal.revoke |
| [`PartnerRuntime.block`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L328) | reason | this.service?.invalidate, this.transport?.stop |
| [`PartnerRuntime.stop`](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts#L329) | – | this.block |
