# src-ts/runtime-executables/lib/hosted-adapter.ts

Bindet die eingebettete UI an EOS und bewahrt bei bestätigter Migration den alten Datenpunkt-Namespace.

**Daten und Wirkung:** Eine Adapterinstanz, unveränderte History-/Alias-IDs, zentraler Lizenz-/Schreibschutz und verschlüsselte Konfiguration.

**Bei Änderungen:** Namespace-, Credential-, Lizenz- und Schreibschutz sowie die Migrations- und HTTP-Regressionsprüfungen erhalten.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `../io-package.json` | [io-package.json](../../../../../io-package.json) |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`record`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L37) | value | Array.isArray |
| [`clone`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L38) | value | JSON.parse, JSON.stringify |
| [`merge`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L39) | base, overlay | FORBIDDEN_KEYS.has, Object.entries, Reflect.get, Reflect.set, clone, merge, record |
| [`retainedNamespace`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L50) | owner | record |
| [`HostedAdapter.constructor`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L79) | { owner, bridge } | Number, Object.defineProperties, merge, namespace.split, retainedNamespace |
| [`get`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L95) | target, key, receiver | GUARDED_WRITES.has, LOCAL_METHODS.get, Reflect.get, Reflect.has, bound.get, bound.has, bound.set, value.bind |
| [`HostedAdapter.ownsLocalNamespace`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L118) | – | retainedNamespace |
| [`HostedAdapter.getForeignObjectAsync`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L119) | id, args | merge, this._owner.getForeignObjectAsync |
| [`HostedAdapter.setForeignObjectAsync`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L125) | id, object, args | clone, merge, record, this._owner.eosMigration.saveUi, this._owner.getForeignObjectAsync, this._owner.setForeignObjectAsync |
| [`HostedAdapter.setForeignStateAsync`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L136) | id, args | Promise.reject, this._bridge.canWrite, this._owner.setForeignStateAsync |
| [`HostedAdapter.setForeignStateChangedAsync`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L140) | id, args | Promise.reject, this._bridge.canWrite, this._owner.setForeignStateChangedAsync |
| [`HostedAdapter.setForeignStateChanged`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L144) | id, args | deniedWrite, this._bridge.canWrite, this._owner.setForeignStateChanged |
| [`HostedAdapter.setForeignState`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L148) | id, args | deniedWrite, this._bridge.canWrite, this._owner.setForeignState |
| [`deniedWrite`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L153) | args | args.at, callback |
| [`centralLicenseSnapshot`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L159) | bridge | Array.isArray, Number.isInteger, bridge.getLicense, record, state.features.filter |
| [`centralAccess`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L185) | bridge, req | Array.isArray, ROLE_CAPABILITIES.get, ROLE_CAPABILITIES.has, bridge.resolveAccess, record, requested.filter |
