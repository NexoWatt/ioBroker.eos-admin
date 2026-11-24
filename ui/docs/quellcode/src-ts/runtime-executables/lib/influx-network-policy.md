# src-ts/runtime-executables/lib/influx-network-policy.ts

Begrenzt erlaubte InfluxDB-Ziele und prüft jede tatsächlich für die Verbindung aufgelöste Adresse.

**Daten und Wirkung:** Erlaubt ausdrücklich lokale Datenbanken, begrenzt unverschlüsseltes HTTP auf lokale Netze und sperrt Metadaten-, Link-Local-, Multicast- und unbestimmte Ziele.

**Bei Änderungen:** IPv4-/IPv6-Sonderfälle, DNS-Wechsel, URL-Anteile und TLS-Serverprüfung prüfen; lokale Gerätekommunikation nicht pauschal sperren.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/influx-network-policy.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:net` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/lib/influx-config.ts](../../../../../src-ts/runtime-executables/lib/influx-config.ts)
- [src-ts/runtime-executables/lib/influx-direct.ts](../../../../../src-ts/runtime-executables/lib/influx-direct.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`failure`](../../../../../src-ts/runtime-executables/lib/influx-network-policy.ts#L17) | code | Object.assign |
| [`ipv6Words`](../../../../../src-ts/runtime-executables/lib/influx-network-policy.ts#L18) | address | Array, address.toLowerCase, words |
| [`words`](../../../../../src-ts/runtime-executables/lib/influx-network-policy.ts#L20) | half | half.split |
| [`assertInfluxAddressAllowed`](../../../../../src-ts/runtime-executables/lib/influx-network-policy.ts#L29) | input, protocol | address.includes, address.split, failure, input.replace, ipv6Words, isIP, words.slice |
| [`validateInfluxUrl`](../../../../../src-ts/runtime-executables/lib/influx-network-policy.ts#L64) | input | assertInfluxAddressAllowed, failure, hostname.toLowerCase, input.trim, isIP, url.hostname.replace, url.pathname.includes, url.pathname.replace |
