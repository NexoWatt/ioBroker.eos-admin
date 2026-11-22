# src-ts/runtime-executables/ems/modules/nvp-topology.ts

Liest ausdrücklich konfigurierte M0/M1-Messkontexte und veröffentlicht

**Daten und Wirkung:** W, Bezug positiv, Batterieentladung positiv; ausschließlich

**Bei Änderungen:** Aktivierung erst nach Integration exklusiver Bereichswriter und

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/nvp-topology.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `../services/nvp-topology` | [src-ts/runtime-executables/ems/services/nvp-topology.ts](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts) |
| `../services/nvp-budget` | [src-ts/runtime-executables/ems/services/nvp-budget.ts](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts) |
| `../services/nvp-group-planner` | [src-ts/runtime-executables/ems/services/nvp-group-planner.ts](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`buildTopologyStatus`](../../../../../../src-ts/runtime-executables/ems/modules/nvp-topology.ts#L37) | config, snapshot, rootConfig, previousState, storageTelemetry | ACTIVATION_BLOCKERS.slice, Array.isArray, Math.ceil, Number.isFinite, String, affectsPoint, allocateIndependentBudgets, budgetErrors.push, budgetErrors.some, config.points.map, config.storages.map, planGroups |
| [`NvpTopologyModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/nvp-topology.ts#L127) | adapter, _dp | – |
| [`NvpTopologyModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/nvp-topology.ts#L133) | – | – |
| [`NvpTopologyModule.readStates`](../../../../../../src-ts/runtime-executables/ems/modules/nvp-topology.ts#L136) | ids | Promise.race, Promise.resolve, clearTimeout |
| [`NvpTopologyModule.preview`](../../../../../../src-ts/runtime-executables/ems/modules/nvp-topology.ts#L151) | raw, remember | ACTIVATION_BLOCKERS.slice, Date.now, buildTopologyStatus, collectSnapshot, config.points.map, config.storages.map, this.adapter._nwValidateNvpTopology, this.readStates, validateTopology |
| [`NvpTopologyModule.publish`](../../../../../../src-ts/runtime-executables/ems/modules/nvp-topology.ts#L180) | status, epoch | JSON.stringify, Object.entries, this.adapter.setObjectNotExistsAsync, this.adapter.setStateAsync |
| [`NvpTopologyModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/nvp-topology.ts#L203) | – | Date.now, JSON.stringify, this.preview, this.publish |
| [`NvpTopologyModule.stop`](../../../../../../src-ts/runtime-executables/ems/modules/nvp-topology.ts#L234) | – | – |
