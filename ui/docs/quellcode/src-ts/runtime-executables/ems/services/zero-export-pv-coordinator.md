# src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts

Koordiniert eine einzige begrenzte Prüflast zum Erschließen abgeregelter PV bei Nulleinspeisung.

**Daten und Wirkung:** Erhält aktuelle NVP-/PV-/Batteriemessungen vom Core und Anforderungen der einzelnen Verbraucher in W/ms. Vergibt nur zeitlich befristete Zusatzfreigaben; schreibt selbst keine Hardware.

**Bei Änderungen:** Niemals Nennleistung, Prognose oder Sollwerte als PV-Nachweis verwenden. Verbraucher prüfen Geräteschutz und Gesamtbudget vor jedem Schreiben erneut; unbestätigte Watt bleiben außerhalb des PV-Budgets.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/charging-management.ts](../../../../../../src-ts/runtime-executables/ems/modules/charging-management.ts)
- [src-ts/runtime-executables/ems/modules/core-limits.ts](../../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts)
- [src-ts/runtime-executables/ems/modules/heating-rod-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/heating-rod-control.ts)
- [src-ts/runtime-executables/ems/modules/storage-control.ts](../../../../../../src-ts/runtime-executables/ems/modules/storage-control.ts)
- [src-ts/runtime-executables/ems/services/zero-export-storage-credit.ts](../../../../../../src-ts/runtime-executables/ems/services/zero-export-storage-credit.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L16) | value | Number, Number.isFinite, value.trim |
| [`watts`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L18) | value | Math.max, Number, finite |
| [`readZeroExportMode`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L25) | adapter | Math.max, Math.min, String, finite, watts |
| [`ZeroExportPvCoordinator.constructor`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L52) | – | – |
| [`ZeroExportPvCoordinator.revoke`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L66) | now, reason, failed | this.cooldowns.set |
| [`ZeroExportPvCoordinator.update`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L80) | sample | Math.max, Number, this.blockReason, this.cooldowns.delete, this.evcsRuns.delete, this.evcsRuns.values, this.holdValid, this.margins.clear, this.margins.delete, this.margins.set, this.requests.clear, this.requests.delete, this.revoke, this.snapshot |
| [`ZeroExportPvCoordinator.blockReason`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L132) | now | finite |
| [`ZeroExportPvCoordinator.holdSafetyReady`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L148) | now | finite |
| [`ZeroExportPvCoordinator.holdValid`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L159) | key, id, now | this.evcsRuns.get, this.evcsRuns.values, this.holdSafetyReady |
| [`ZeroExportPvCoordinator.requestHold`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L174) | r | Math.max, Math.min, Number, String, finite, this.evcsRuns.entries, this.evcsRuns.get, this.holdSafetyReady, this.margins.delete, this.margins.entries, this.margins.set, watts |
| [`ZeroExportPvCoordinator.noteEvcsCommand`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L213) | r | Math.max, Number, String, this.evcsRuns.delete, this.evcsRuns.get, this.evcsRuns.set, watts |
| [`ZeroExportPvCoordinator.request`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L234) | request | Math.max, Math.min, Number, String, candidates.sort, finite, result, this.blockReason, this.cooldowns.get, this.evcsRuns.values, this.margins.delete, this.margins.get, this.margins.set, this.margins.values (weitere in der Quelle) |
| [`result`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L238) | reason, lease | Math.max, Math.min |
| [`ZeroExportPvCoordinator.snapshot`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L356) | – | holding.map, this.evcsRuns.entries, this.evcsRuns.values, this.margins.values |
| [`coordinator`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L366) | adapter | – |
| [`updateZeroExportProbe`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L372) | adapter, sample | coordinator, readZeroExportMode |
| [`requestZeroExportProbe`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L377) | adapter, request | c.request, coordinator, readZeroExportMode |
| [`requestZeroExportHold`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L385) | adapter, request | c.requestHold, coordinator, readZeroExportMode |
| [`zeroExportEvcsPauseUntil`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L390) | adapter, key, now | Date.now, coordinator, readZeroExportMode |
| [`noteZeroExportEvcsCommand`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L395) | adapter, request | c.noteEvcsCommand, coordinator, readZeroExportMode |
| [`collectZeroExportSample`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L408) | adapter, dp, budget, now | Math.max, Number, String, adapter._nwGetStorageControlAuthority, adapter._nwResolveBatteryFlowFromCache, ageOk, candidates.push, dp?.getMeasurementAgeMs, dp?.getNumberFresh, finite, read, relevant.every, watts |
| [`read`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L411) | key | Number, Object.prototype.hasOwnProperty.call, finite |
| [`ageOk`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L444) | v | Number, finite |
| [`unconfirmedZeroExportW`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L475) | adapter | Math.max, watts |
| [`measuredFlexibleLoadW`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L482) | adapter, dp, kind, seen, now | Array.isArray, Date.now, Math.max, Math.min, Math.round, Number, devices.entries, dp.getMeasurementAgeMs, dp.getNumberFresh, dp?.getEntry, dp?.getMeasurementAgeMs, dp?.getNumberFresh, finite, seen.add (weitere in der Quelle) |
| [`confirmedZeroExportPvW`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L535) | adapter, availableW, now | Date.now, Math.max, Math.min, Number, finite, readZeroExportMode |
| [`isZeroExportGrantValid`](../../../../../../src-ts/runtime-executables/ems/services/zero-export-pv-coordinator.ts#L546) | adapter, key, leaseId, now | Date.now, String, c.blockReason, c.holdValid, c.margins.get, readZeroExportMode |
