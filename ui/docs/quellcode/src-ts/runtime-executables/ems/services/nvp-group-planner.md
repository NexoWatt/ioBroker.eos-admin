# src-ts/runtime-executables/ems/services/nvp-group-planner.ts

Berechnet lokale Speicheranforderungen je lokalem Regelbereich und homogener Dispatchgruppe.

**Daten und Wirkung:** Liest validierte NVP-Snapshots in W, gemeinsam verwendete Policy-Bausteine und frische SoC-/Verfügbarkeitsangaben; liefert Pläne für Diagnose oder aktiven Betrieb und getrennte Rampenzustände, niemals Gerätebefehle.

**Bei Änderungen:** Lokale Bilanz nur einmal ausgleichen, M0 nicht zu M1 addieren, fehlende Fähigkeit nicht erfinden und globale Budgetbegrenzungen an den Gruppenzustand zurückmelden.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./nvp-topology` | [src-ts/runtime-executables/ems/services/nvp-topology.ts](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts) |
| `./storage-self-consumption-policy` | [src-ts/runtime-executables/ems/services/storage-self-consumption-policy.ts](../../../../../../src-ts/runtime-executables/ems/services/storage-self-consumption-policy.ts) |
| `../modules/tarif-vis` | [src-ts/runtime-executables/ems/modules/tarif-vis.ts](../../../../../../src-ts/runtime-executables/ems/modules/tarif-vis.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts)
- [src-ts/runtime-executables/ems/modules/nvp-topology.ts](../../../../../../src-ts/runtime-executables/ems/modules/nvp-topology.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts#L23) | value | Number.isFinite |
| [`record`](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts#L24) | value | Array.isArray |
| [`own`](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts#L25) | value, key | Object.prototype.hasOwnProperty.call, record |
| [`clamp`](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts#L26) | value, min, max | Math.max, Math.min |
| [`fresh`](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts#L33) | value, now, maxAgeMs | finite, record |
| [`policyFor`](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts#L43) | group, rootConfig, groupPolicies | group.storages.some, record, resolveStorageOperatingPolicy |
| [`ownPolicyFor`](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts#L63) | storage | record, resolveStorageOperatingPolicy |
| [`tariffPermission`](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts#L81) | group, options, now, maxAgeMs | Number, String, finite, group.storages.reduce, record, resolveStorageGridChargePermission |
| [`allocate`](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts#L104) | requestedW, members | Math.abs, clamp, headrooms.reduce, members.map, members.reduce, proposals.forEach, proposals.map, proposals.reduce |
| [`planGroups`](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts#L142) | config, snapshot, options | Date.now, Math.max, Math.min, Object.create, Object.fromEntries, actuals.reduce, actuals.some, allocate, allocation.proposals.map, block, clamp, finite, fresh, group.storages.map (weitere in der Quelle) |
| [`block`](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts#L177) | code, message | issues.push |
