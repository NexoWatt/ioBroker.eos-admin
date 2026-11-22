# src-ts/runtime-executables/lib/partner-service.ts

Vermittelt explizit freigegebene Daten und kurzlebige Speicherwünsche für genau einen Partner.

**Daten und Wirkung:** JSON hinein, begrenzte Projektionen/Quittungen hinaus; persistiert Replayjournal vor Annahme.

**Bei Änderungen:** Widerruf während await, Neustart, Journalfehler, Quoten und tatsächlich aktive Apps testen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/partner-service.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:perf_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./partner-contracts` | [src-ts/runtime-executables/lib/partner-contracts.ts](../../../../../src-ts/runtime-executables/lib/partner-contracts.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/lib/partner-config-api.ts](../../../../../src-ts/runtime-executables/lib/partner-config-api.ts)
- [src-ts/runtime-executables/lib/partner-runtime.ts](../../../../../src-ts/runtime-executables/lib/partner-runtime.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`projectPartnerData`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L37) | kind, input | Object.create, partnerInteger, partnerNumber, partnerRecord |
| [`parseJournal`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L56) | input | Array.isArray, out.push, out.some, partnerId, partnerInteger, partnerKeys, partnerRecord |
| [`PartnerIntegrationService.constructor`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L79) | config, hooks | validatePartnerConfig |
| [`PartnerIntegrationService.initialize`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L85) | – | parseJournal, this.hooks.loadJournal, this.invalidate |
| [`PartnerIntegrationService.now`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L89) | – | Date.now, this.hooks.now |
| [`PartnerIntegrationService.monotonicNow`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L90) | – | performance.now, this.hooks.monotonicNow |
| [`PartnerIntegrationService.updateConfig`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L92) | config | this.invalidate, validatePartnerConfig |
| [`PartnerIntegrationService.invalidate`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L99) | reason | this.current.clear, this.deadlines.clear |
| [`PartnerIntegrationService.authorize`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L101) | – | – |
| [`PartnerIntegrationService.permitted`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L102) | appId, resourceId, permission | this.authorize, this.config.grants.some, this.hooks.isAppActive |
| [`PartnerIntegrationService.getCurrentRequest`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L106) | resourceId | this.current.delete, this.current.get, this.deadlines.delete, this.deadlines.get, this.hooks.controlAvailable, this.hooks.isResourceAvailable, this.monotonicNow, this.now, this.permitted |
| [`PartnerIntegrationService.setConnection`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L114) | state, code | this.current.clear, this.deadlines.clear |
| [`PartnerIntegrationService.snapshot`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L118) | – | this.hooks.controlAvailable |
| [`PartnerIntegrationService.reply`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L122) | id, ok, code, extra | JSON.stringify |
| [`PartnerIntegrationService.handleMessage`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L124) | partnerIdFromTransport, text | Buffer.byteLength, JSON.parse, operation.then, partnerId, partnerRecord, this.now, this.receivedAt.filter, this.receivedAt.push, this.reply, this.serial.then |
| [`PartnerIntegrationService.process`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L143) | message | JSON.stringify, Math.min, String, createHash, isPartnerAppId, next.map, partnerInteger, partnerKeys, partnerNumber, projectPartnerData, this.cancel, this.config.arbitrage.resources.find, this.current.set, this.deadlines.set (weitere in der Quelle) |
| [`PartnerIntegrationService.readBounded`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L192) | appId, resourceId, kind | Promise.race, clearTimeout, controller.abort, this.hooks.readData |
| [`PartnerIntegrationService.cancel`](../../../../../src-ts/runtime-executables/lib/partner-service.ts#L201) | message | partnerId, partnerKeys, this.current.delete, this.deadlines.delete, this.getCurrentRequest, this.hooks.persistJournal, this.invalidate, this.journal.map, this.permitted, this.reply |
