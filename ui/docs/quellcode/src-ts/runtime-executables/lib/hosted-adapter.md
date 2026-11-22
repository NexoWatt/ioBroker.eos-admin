# src-ts/runtime-executables/lib/hosted-adapter.ts

Bindet die eingebettete UI an die einzige EOS-Adapterinstanz und deren zentrale Berechtigungsprüfung.

**Daten und Wirkung:** Vermittelt Adapteraufrufe und UI-Konfiguration; erzeugt keine zweite Instanz und schützt die vom Host verwalteten Sicherheitswerte.

**Bei Änderungen:** Konfigurationsgrenze, Lizenz- und Schreibberechtigungen sowie den gemeinsamen Start-/Stoppablauf mit den Hosted-Regressionstests prüfen.

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
| [`clone`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L23) | value | JSON.parse, JSON.stringify |
| [`merge`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L24) | base, overlay | Array.isArray, FORBIDDEN_KEYS.has, Object.entries, clone, merge |
| [`HostedAdapter.constructor`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L35) | { owner, bridge } | Object.defineProperties, merge |
| [`get`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L53) | target, key, receiver | Reflect.get, Reflect.has, bound.get, bound.has, bound.set, value.bind |
| [`HostedAdapter.getForeignObjectAsync`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L62) | id, args | merge, this._owner.getForeignObjectAsync |
| [`HostedAdapter.setForeignObjectAsync`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L67) | id, object, args | Array.isArray, clone, this._owner.getForeignObjectAsync, this._owner.setForeignObjectAsync |
| [`HostedAdapter.setForeignStateAsync`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L82) | id, args | Promise.reject, this._bridge.canWrite, this._owner.setForeignStateAsync |
| [`HostedAdapter.setForeignStateChangedAsync`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L86) | id, args | Promise.reject, this._bridge.canWrite, this._owner.setForeignStateChangedAsync |
| [`HostedAdapter.setForeignStateChanged`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L90) | id, args | callback, this._bridge.canWrite, this._owner.setForeignStateChanged |
| [`HostedAdapter.setForeignState`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L99) | id, args | callback, this._bridge.canWrite, this._owner.setForeignState |
| [`centralLicenseSnapshot`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L110) | bridge | Array.isArray, Number.isInteger, bridge.getLicense, state.features.filter |
| [`centralAccess`](../../../../../src-ts/runtime-executables/lib/hosted-adapter.ts#L135) | bridge, req | Array.isArray, Object.hasOwn, bridge.resolveAccess, requested.filter |
