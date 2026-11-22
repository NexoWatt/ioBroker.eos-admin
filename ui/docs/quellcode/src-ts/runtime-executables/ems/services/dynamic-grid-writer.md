# src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts

Schreibt herstellerunabhängige Speicher- und PV-Befehle der dynamischen Netzanschluss-App.

**Daten und Wirkung:** Wandelt Watt über explizite DP-Verträge in Rohwerte um, nutzt die bestehende DatapointRegistry und prüft jeden Einzelschritt gegen die aktuelle Schreibhoheit. Ein bestätigter Befehl ist keine gemessene Istwirkung.

**Bei Änderungen:** Split-Neutralisierung, Alias-/Einheitenvertrag, Generationenwechsel und alte Freigaben gemeinsam prüfen; nach fehlgeschlagenem Zwischenschritt niemals weiter freigeben.

[Originalquelle](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts) · [Gesamtübersicht](../../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `../datapoints` | [src-ts/runtime-executables/ems/datapoints.ts](../../../../../../src-ts/runtime-executables/ems/datapoints.ts) |
| `./actuator-shadow-arbiter` | [src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts](../../../../../../src-ts/runtime-executables/ems/services/actuator-shadow-arbiter.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts](../../../../../../src-ts/runtime-executables/ems/modules/dynamic-grid-connection.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`finite`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts#L21) | value | Number.isFinite |
| [`current`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts#L22) | guard | guard |
| [`bounded`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts#L25) | work, timeoutMs | Promise.race, clearTimeout |
| [`DynamicGridWriter.constructor`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts#L38) | adapter, options | Math.max, Math.min, finite |
| [`DynamicGridWriter.hasPendingWrites`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts#L47) | – | – |
| [`DynamicGridWriter.configure`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts#L50) | _config, _guard | – |
| [`DynamicGridWriter.binding`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts#L52) | id, field, mapping, guard | JSON.stringify, bounded, current, finite, this.adapter.getForeignObjectAsync, this.bindings.get, this.bindings.set, this.dp.upsert |
| [`DynamicGridWriter.output`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts#L67) | id, field, mapping, value, guard | Date.now, JSON.stringify, Promise.resolve, String, bounded, current, finite, id.startsWith, matches, physicalWrite.then, this.adapter.getForeignStateAsync, this.binding, this.confirmations.delete, this.confirmations.get (weitere in der Quelle) |
| [`matches`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts#L74) | feedback, after | Date.now, Math.abs, Math.max, finite |
| [`DynamicGridWriter.flag`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts#L115) | id, field, mapping, enabled, guard | this.output |
| [`DynamicGridWriter.writeStorage`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts#L122) | storage, command, guard | Date.now, Math.abs, add, current, finite, result.writes.push, result.writes.some, this.flag, values.sort |
| [`add`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts#L125) | field, mapping, value | Math.max, result.writes.push, this.output |
| [`DynamicGridWriter.writePv`](../../../../../../src-ts/runtime-executables/ems/services/dynamic-grid-writer.ts#L163) | pv, limitW, guard | Date.now, Math.min, finite, this.output |
