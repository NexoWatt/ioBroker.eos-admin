# src-ts/runtime-executables/lib/iobroker-user-roles.ts

Ordnet kanonische ioBroker-Konten ausschließlich anhand ihrer Gruppen

**Daten und Wirkung:** Validierte Gruppenlisten aus lokaler Adapterkonfiguration;

**Bei Änderungen:** Gruppenzuordnung, Widerruf und Rollenpriorität gemeinsam prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:perf_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`record`](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts#L62) | value | Array.isArray |
| [`canonicalSuffix`](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts#L67) | value | value.replace, value.trim |
| [`groupId`](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts#L73) | value | canonicalSuffix, value.slice, value.startsWith |
| [`memberId`](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts#L77) | value | canonicalSuffix, value.slice, value.startsWith |
| [`configuredGroups`](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts#L82) | value | Array.from, Array.isArray, groupId, groups.push, item.trim, value.split |
| [`policy`](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts#L103) | admin, installer, customer, valid | Object.freeze |
| [`createIoBrokerRolePolicy`](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts#L117) | accessControl, auth | Array.from, configuredGroups, invalid, policy, record |
| [`invalid`](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts#L118) | – | policy |
| [`roleInfo`](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts#L135) | user, role, groups | – |
| [`resolveIoBrokerRoleInfo`](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts#L155) | adapter, user, rolePolicy, timeoutMs | Array.from, Math.min, Number.isFinite, Promise.resolve, allGroups.every, canonicalSuffix, denied, performance.now |
| [`denied`](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts#L162) | – | roleInfo |
| [`inTime`](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts#L170) | – | performance.now |
| [`finish`](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts#L171) | value | clearTimeout, denied, inTime, resolve |
| [`run`](../../../../../src-ts/runtime-executables/lib/iobroker-user-roles.ts#L179) | – | Array.isArray, adapter.getForeignObjectAsync, common.members.every, common.members.includes, denied, finish, groups.push, groups.some, inTime, record, roleInfo |
