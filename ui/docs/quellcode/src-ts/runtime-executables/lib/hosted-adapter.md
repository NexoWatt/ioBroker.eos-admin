# src-ts/runtime-executables/lib/hosted-adapter.ts

Bindet die eingebettete UI an EOS und bewahrt bei bestätigter Migration den alten Datenpunkt-Namespace.

**Daten und Wirkung:** Eine Adapterinstanz, unveränderte History-/Alias-IDs, zentraler Lizenz-/Schreibschutz, begrenzt erfasste Host-Schreibaufträge und verschlüsselte Konfiguration.

**Bei Änderungen:** Namespace-, Credential-, Lizenz- und Schreibschutz sowie die Migrations- und HTTP-Regressionsprüfungen erhalten.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:module` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`record`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L41) | value | Array.isArray |
| [`clone`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L42) | value | JSON.parse, JSON.stringify |
| [`merge`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L43) | base, overlay | FORBIDDEN_KEYS.has, Object.entries, Reflect.get, Reflect.set, clone, merge, record |
| [`retainedNamespace`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L54) | owner | record |
| [`thenable`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L76) | value | Reflect.get |
| [`HostedAdapter.constructor`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L90) | { owner, bridge } | Number, Object.defineProperties, merge, namespace.split, retainedNamespace |
| [`get`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L106) | target, key, receiver | GUARDED_WRITES.has, LOCAL_METHODS.get, Reflect.get, Reflect.has, bound.get, bound.has, bound.set, value.bind |
| [`HostedAdapter.stopStateWrites`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L135) | – | Promise.all |
| [`HostedAdapter.beginHostWrite`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L141) | – | this._bridge.canWrite, this.pendingHostWrites.add |
| [`complete`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L144) | – | – |
| [`HostedAdapter.writeAsync`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L156) | method, id, args | Promise.reject, returned.then, thenable, this.beginHostWrite |
| [`HostedAdapter.writeCallback`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L169) | method, id, args | Promise.resolve, complete, confirm, deniedWrite, forwarded.at, forwarded.pop, forwarded.push, thenable, this.beginHostWrite |
| [`confirm`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L181) | – | complete |
| [`completedCallback`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L184) | this, result | Reflect.apply, confirm |
| [`returnedDone`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L195) | – | confirm |
| [`HostedAdapter.ownsLocalNamespace`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L205) | – | retainedNamespace |
| [`HostedAdapter.getForeignObjectAsync`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L206) | id, args | merge, this._owner.getForeignObjectAsync |
| [`HostedAdapter.setForeignObjectAsync`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L212) | id, object, args | clone, merge, record, this._owner.eosMigration.saveUi, this._owner.getForeignObjectAsync, this._owner.setForeignObjectAsync |
| [`HostedAdapter.setForeignStateAsync`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L224) | id, args | this.writeAsync |
| [`HostedAdapter.setForeignStateChangedAsync`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L227) | id, args | this.writeAsync |
| [`HostedAdapter.setForeignStateChanged`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L230) | id, args | this.writeCallback |
| [`HostedAdapter.setForeignState`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L233) | id, args | this.writeCallback |
| [`deniedWrite`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L237) | args, error | Reflect.apply, args.at |
| [`centralLicenseSnapshot`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L243) | bridge | Array.isArray, Number.isInteger, bridge.getLicense, record, state.features.filter |
| [`centralAccess`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L269) | bridge, req | Array.isArray, ROLE_CAPABILITIES.get, ROLE_CAPABILITIES.has, bridge.resolveAccess, record, requested.filter |
