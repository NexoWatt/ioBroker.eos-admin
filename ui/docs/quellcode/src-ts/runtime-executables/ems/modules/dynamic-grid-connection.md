# src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts

Führt die eigenständige App Dynamischer Netzanschluss mit getrennten M0-/M1-Regelbereichen und einem gemeinsamen Schreibplan aus.

**Daten und Wirkung:** Liest konfigurierte Messungen, nutzt bestehende Speicher-/Tarif-Policies und den gemeinsamen Intervallsolver; schreibt ausschließlich über den generischen dynamischen Writer. Behält unbestätigte Befehle und alte externe Freigaben im Budget.

**Bei Änderungen:** Messung, Befehlsecho und Istwirkung getrennt halten; lokale Ausfälle begrenzen ihren Bereich, M0-Ausfall sperrt neue Befehle. Handover darf benötigte Stützleistung nicht pauschal abschalten.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `../services/dynamic-grid-config` | [src-ts/runtime-executables/ems/services/dynamic-grid-config.ts](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-config.ts) |
| `../services/nvp-group-planner` | [src-ts/runtime-executables/ems/services/nvp-group-planner.ts](../../../../../../src-ts/runtime-executables/ems/services/nvp-group-planner.ts) |
| `../services/nvp-topology` | [src-ts/runtime-executables/ems/services/nvp-topology.ts](../../../../../../src-ts/runtime-executables/ems/services/nvp-topology.ts) |
| `../services/nvp-budget` | [src-ts/runtime-executables/ems/services/nvp-budget.ts](../../../../../../src-ts/runtime-executables/ems/services/nvp-budget.ts) |
| `./storage-control` | [src-ts/runtime-executables/ems/modules/storage-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts) |
| `../services/safety-envelope` | [src-ts/runtime-executables/ems/services/safety-envelope.ts](../../../../../../src-ts/runtime-executables/ems/services/safety-envelope.ts) |
| `../services/accepted-power-effects` | [src-ts/runtime-executables/ems/services/accepted-power-effects.ts](../../../../../../src-ts/runtime-executables/ems/services/accepted-power-effects.ts) |
| `../services/dynamic-grid-writer` | [src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts) |
| `../services/arbitrage-control` | [src-ts/runtime-executables/ems/services/arbitrage-control.ts](../../../../../../src-ts/runtime-executables/ems/services/arbitrage-control.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/module-manager.ts](../../../../../../src-ts/runtime-executables/ems/module-manager.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L28) | value | Number.isFinite |
| [`activeApp`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L29) | root | – |
| [`clone`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L30) | value | JSON.parse, JSON.stringify |
| [`configKey`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L31) | root | JSON.stringify |
| [`actuatorKey`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L32) | config | JSON.stringify |
| [`fresh`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L33) | sample, now, maxAgeMs | finite |
| [`resolveDynamicSafety`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L36) | adapter, dp, config, snapshot | Date.now, Math.abs, Math.max, Math.min, adapter._meshCoordinator?.currentLimits, applyStorageLicensePowerLimit, config.storages.map, config.storages.reduce, evaluateFlexibleLoadRequest, evaluateSafetyCommandPermission, finite, liveSafetyEnvelope, resolveStorageLicensePowerProfile, samples.every (weitere in der Quelle) |
| [`buildDispatchInput`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L74) | config, snapshot, plan, pending, options | Date.now, Math.max, Math.min, affectsPoint, coherentTimes.every, excluded.map, excluded.push, finite, fresh, participants.filter, participants.push, points.find, points.some, requests.get |
| [`DynamicGridConnectionModule.constructor`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L184) | adapter, _dp, licenseAllowed | – |
| [`DynamicGridConnectionModule.init`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L194) | – | – |
| [`DynamicGridConnectionModule.readStates`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L197) | ids | Promise.race, Promise.resolve, clearTimeout |
| [`DynamicGridConnectionModule.validate`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L206) | raw, root | this.adapter._nwValidateDynamicGridConfig, validateDynamicGridConfig |
| [`DynamicGridConnectionModule.plannerOptions`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L212) | config, snapshot, handover, safety | Date.now, Math.max, Math.min, Object.create, activeApp, config.points.find, evaluateArbitrageRequest, finite, group.storages.every, group.storages.map, group.storages.reduce, groupStorages, measured.every, measured.map (weitere in der Quelle) |
| [`DynamicGridConnectionModule.reconcile`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L291) | config, snapshot | Date.now, Math.abs, Math.max, Math.min, finite, fresh |
| [`DynamicGridConnectionModule.runtime`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L311) | config, snapshot, epoch, key, allowSave, maintenance | Date.now, Object.values, dynamicGridReadIds |
| [`isCurrent`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L313) | – | configKey, this.licenseAllowed |
| [`collectSnapshot`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L314) | states, now | collectDynamicSnapshot |
| [`DynamicGridConnectionModule.publish`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L319) | status | JSON.stringify, this.adapter.setObjectNotExistsAsync, this.adapter.setStateAsync |
| [`DynamicGridConnectionModule.preview`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L332) | raw, root | Date.now, buildDispatchInput, collectDynamicSnapshot, dynamicGridReadIds, planGroups, solveDynamicDispatch, this.plannerOptions, this.readStates, this.validate |
| [`DynamicGridConnectionModule.prepareTransition`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L344) | nextRoot | activeApp, actuatorKey, configKey, this.execute, this.validate, this.writer.hasPendingWrites |
| [`DynamicGridConnectionModule.execute`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L363) | config, handover, allowSave | Date.now, Math.max, Math.min, Object.fromEntries, Object.values, String, accepted.map, accepted.reduce, buildDispatchInput, collectDynamicSnapshot, commitFlexibleLoadDecision, config.storages.every, config.storages.filter, config.storages.find (weitere in der Quelle) |
| [`guard`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L399) | – | Date.now, Math.abs, Math.min, Math.sign, commands.filter, config.points.find, economicCommands.every, economicCommands.reduce, evaluateArbitrageRequest, finite, fresh, input.points.find, resolveDynamicSafety, runtime.isCurrent (weitere in der Quelle) |
| [`DynamicGridConnectionModule.tick`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L459) | – | Date.now, Object.create, Object.values, activeApp, actuatorKey, configKey, this.execute, this.licenseAllowed, this.publish, this.validate |
| [`isCurrent`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L469) | – | – |
| [`isCurrent`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L480) | – | – |
| [`DynamicGridConnectionModule.deactivate`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L494) | – | this.execute |
| [`DynamicGridConnectionModule.stop`](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts#L501) | – | – |
