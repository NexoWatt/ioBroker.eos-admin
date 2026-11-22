# src-ts/runtime-executables/ems/services/nvp-grants.ts

Verwaltet Freigabeverträge, ihre Reihenfolge und konservative Reservierungen für externe Speicherregler.

**Daten und Wirkung:** Reiner Zustandsautomat; erzeugt Pakete und exportierbare Zustände, schreibt weder ioBroker-States noch Hardware. Diagnosepakete sind ausdrücklich nicht ausführbar.

**Bei Änderungen:** Empfang, angewandte Grenzen und Istwirkung getrennt halten. Zeitablauf allein löscht niemals eine im Fremdgerät möglicherweise noch geltende Freigabe.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

Kein direkter Import innerhalb des erfassten Quellbereichs. Mögliche HTML-, Adapter-, Build- oder dynamische Einstiege sind separat zu prüfen.

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L21) | value | Number.isFinite |
| [`interval`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L22) | min, max | finite |
| [`inside`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L23) | min, max, outerMin, outerMax | – |
| [`validId`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L24) | id | – |
| [`NvpGrantLedger.constructor`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L41) | options | Array.isArray, Number.isSafeInteger, finite, randomUUID, this.registerParticipant |
| [`NvpGrantLedger.registerParticipant`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L55) | participant | interval, this.entries.has, this.entries.set, validId |
| [`NvpGrantLedger.evidenceValid`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L67) | entry, evidence, now | finite, inside, interval |
| [`NvpGrantLedger.synchronize`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L81) | id, evidence, now | Date.now, this.entries.get, this.evidenceValid, this.profiles.has |
| [`NvpGrantLedger.issue`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L99) | input | Object.freeze, finite, inside, interval, this.entries.get, this.profiles.has |
| [`NvpGrantLedger.received`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L120) | packet | this.matchPending |
| [`NvpGrantLedger.matchPending`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L127) | packet | Number.isSafeInteger, this.entries.get |
| [`NvpGrantLedger.applied`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L138) | packet, evidence, now | Date.now, inside, this.evidenceValid, this.matchPending |
| [`NvpGrantLedger.confirmFallback`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L156) | id, evidence, now | Date.now, this.entries.get, this.evidenceValid, this.profiles.has |
| [`NvpGrantLedger.reservedIntervals`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L172) | now | Date.now, this.entries.values |
| [`NvpGrantLedger.canReleaseOwnership`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L187) | – | this.entries.values |
| [`NvpGrantLedger.snapshot`](../../../../../../src-ts/runtime-executables/ems/services/nvp-grants.ts#L192) | now | Date.now, this.canReleaseOwnership, this.reservedIntervals |
