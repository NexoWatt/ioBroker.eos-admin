# src-ts/runtime-executables/lib/customer-tariff.ts

Begrenzt Kundeneinstellungen auf den gemeinsamen Anlagentarif.

**Daten und Wirkung:** Anbieter aus fester Liste, bekannte HTTPS-Endpunkte und

**Bei Änderungen:** Fremdfelder, URLs, alte Revisionen, geheime Daten und die

[Originalquelle](../../../../../src-ts/runtime-executables/lib/customer-tariff.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./http-error-boundary` | [src-ts/runtime-executables/lib/http-error-boundary.ts](../../../../../src-ts/runtime-executables/lib/http-error-boundary.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`rec`](../../../../../src-ts/runtime-executables/lib/customer-tariff.ts#L32) | value | Array.isArray |
| [`copy`](../../../../../src-ts/runtime-executables/lib/customer-tariff.ts#L33) | value | JSON.parse, JSON.stringify |
| [`invalid`](../../../../../src-ts/runtime-executables/lib/customer-tariff.ts#L34) | message | createPublicHttpError |
| [`text`](../../../../../src-ts/runtime-executables/lib/customer-tariff.ts#L35) | value, limit | invalid, value.trim |
| [`own`](../../../../../src-ts/runtime-executables/lib/customer-tariff.ts#L39) | value, key | Object.hasOwn |
| [`storedText`](../../../../../src-ts/runtime-executables/lib/customer-tariff.ts#L40) | value, fallback | – |
| [`source`](../../../../../src-ts/runtime-executables/lib/customer-tariff.ts#L41) | provider | storedText |
| [`knownEndpoint`](../../../../../src-ts/runtime-executables/lib/customer-tariff.ts#L42) | provider | Reflect.get, source |
| [`managedPoints`](../../../../../src-ts/runtime-executables/lib/customer-tariff.ts#L43) | namespace | Object.fromEntries, invalid |
| [`formulaView`](../../../../../src-ts/runtime-executables/lib/customer-tariff.ts#L47) | value | Object.entries, Object.fromEntries, rec |
| [`useForTariff`](../../../../../src-ts/runtime-executables/lib/customer-tariff.ts#L54) | root, namespace | PRICE_KEYS.every, managedPoints, rec |
| [`customerTariffView`](../../../../../src-ts/runtime-executables/lib/customer-tariff.ts#L60) | root, namespace, registry, snapshot | Array.isArray, Number.isFinite, PROVIDERS.includes, formulaView, knownEndpoint, provider.homeId.slice, rec, source, storedText, useForTariff |
| [`prepareCustomerTariffChange`](../../../../../src-ts/runtime-executables/lib/customer-tariff.ts#L90) | root, incoming, namespace, registry | Array.isArray, FIELDS.has, Number.isFinite, Object.entries, Object.fromEntries, Object.keys, PRICE_KEYS.every, PRICE_KEYS.map, PROVIDERS.includes, RESERVED_CREDENTIAL_INPUTS.has, Reflect.deleteProperty, Reflect.get, Reflect.set, copy (weitere in der Quelle) |
