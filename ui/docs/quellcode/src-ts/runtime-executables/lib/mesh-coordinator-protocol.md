# src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts

Berechnet befristete Master-Budgets und prüft die lokale Slave-Freigabe.

**Daten und Wirkung:** Reine Protokollzustände ohne Netzwerk oder Hardware. Monotone Millisekunden bestimmen Fristen; UTC dient nur Anzeige/Archiv.

**Bei Änderungen:** Neustart, Replay, Teilverbindung, reservierte Altbudgets und Wiederanlauf gemeinsam testen. Transport-ACK ist keine Wirkungsbestätigung.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./mesh-coordinator-contract` | [src-ts/runtime-executables/lib/mesh-coordinator-contract.ts](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-contract.ts) |
| `./mesh-transformer-allocation` | [src-ts/runtime-executables/lib/mesh-transformer-allocation.ts](../../../../../src-ts/runtime-executables/lib/mesh-transformer-allocation.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/lib/mesh-coordinator.ts](../../../../../src-ts/runtime-executables/lib/mesh-coordinator.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`randomId`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L19) | – | crypto.randomBytes |
| [`digest`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L20) | config, member | JSON.stringify, crypto.createHash |
| [`validSample`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L21) | sample, staleMs | Array.isArray, Number.isFinite, sample.phaseA.every |
| [`observedWithin`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L26) | sample, budget | sample.phaseA.every |
| [`MeshMasterProtocol.constructor`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L33) | config, now | clone, crypto.randomBytes, membersOf, randomId, this.now, this.records.set |
| [`MeshMasterProtocol.handshakeChallenge`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L46) | request, issuedAt | JSON.stringify, crypto.createHmac |
| [`MeshMasterProtocol.hello`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L50) | request | Number.isSafeInteger, record.retiredBoots.has, this.handshakeChallenge, this.now, this.records.get |
| [`MeshMasterProtocol.exchange`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L64) | request, siteSample | Buffer.from, JSON.stringify, Math.max, Math.min, Number.isFinite, Number.isSafeInteger, String, clone, crypto.timingSafeEqual, digest, maxLimits, observedWithin, r.retiredBoots.add, r.retiredBoots.has (weitere in der Quelle) |
| [`MeshMasterProtocol.plan`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L113) | siteSample | LIMIT_KEYS.filter, LIMIT_KEYS.map, LIMIT_KEYS.some, Math.max, Math.min, NETWORK_KEYS.filter, Object.fromEntries, clone, groups.filter, groupsOf, maxLimits, minLimits, peers.reduce, proposals.get (weitere in der Quelle) |
| [`MeshMasterProtocol.status`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L187) | – | this.now, this.records.values |
| [`MeshSlaveLease.constructor`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L196) | config, now | clone, randomId |
| [`MeshSlaveLease.hello`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L200) | – | randomId, this.now |
| [`MeshSlaveLease.acceptHello`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L204) | response | Number.isFinite, this.now |
| [`MeshSlaveLease.request`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L213) | sample, appliedCommandSeq, lastRttMs | digest, observedWithin, randomId, this.current, this.now, validSample |
| [`MeshSlaveLease.accept`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L225) | response | JSON.stringify, Number.isSafeInteger, clone, digest, limits, minLimits, this.current, this.now, within |
| [`MeshSlaveLease.current`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L240) | – | Math.max, clone, minLimits, this.now |
| [`MeshSlaveLease.fail`](../../../../../src-ts/runtime-executables/lib/mesh-coordinator-protocol.ts#L246) | reason | – |
