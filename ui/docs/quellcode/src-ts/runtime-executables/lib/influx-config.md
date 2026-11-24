# src-ts/runtime-executables/lib/influx-config.ts

Prüft und schützt die direkte InfluxDB-2-Konfiguration bei Speicherung, Abruf und Wiederherstellung.

**Daten und Wirkung:** Validiert feste Felder und Netzadresse, schützt den Token mit vorhandener ioBroker-Kryptografie und blendet Zugangsdaten in öffentlichen Antworten aus.

**Bei Änderungen:** Zielwechsel, leere Tokenfelder, falsche Wiederherstellungsschlüssel und den Erhalt der übrigen Geräte-/EMS-Konfiguration gemeinsam testen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/influx-config.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./influx-direct` | [src-ts/runtime-executables/lib/influx-direct.ts](../../../../../src-ts/runtime-executables/lib/influx-direct.ts) |
| `./influx-network-policy` | [src-ts/runtime-executables/lib/influx-network-policy.ts](../../../../../src-ts/runtime-executables/lib/influx-network-policy.ts) |

**Direkt importiert von:**

- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`record`](../../../../../src-ts/runtime-executables/lib/influx-config.ts#L21) | value | Array.isArray |
| [`failure`](../../../../../src-ts/runtime-executables/lib/influx-config.ts#L22) | code | Object.assign |
| [`keys`](../../../../../src-ts/runtime-executables/lib/influx-config.ts#L23) | value, allowed | Object.keys, failure |
| [`cloneRoot`](../../../../../src-ts/runtime-executables/lib/influx-config.ts#L26) | root | record |
| [`tokenValue`](../../../../../src-ts/runtime-executables/lib/influx-config.ts#L32) | value | failure |
| [`tokenPresent`](../../../../../src-ts/runtime-executables/lib/influx-config.ts#L36) | config | record |
| [`prepareInfluxHistoryChange`](../../../../../src-ts/runtime-executables/lib/influx-config.ts#L40) | previous, incoming | candidate.token.trim, failure, keys, record, tokenPresent, tokenValue, validateInfluxDirectConfig, validateInfluxUrl |
| [`redactInfluxHistoryConfig`](../../../../../src-ts/runtime-executables/lib/influx-config.ts#L81) | root | cloneRoot, record, tokenPresent |
| [`protectInfluxHistoryConfig`](../../../../../src-ts/runtime-executables/lib/influx-config.ts#L93) | root, codec | JSON.stringify, cloneRoot, codec.encrypt, failure, record, tokenValue, validateInfluxUrl |
| [`restoreInfluxHistoryConfig`](../../../../../src-ts/runtime-executables/lib/influx-config.ts#L120) | root, codec | JSON.parse, cloneRoot, codec.decrypt, record, tokenValue, validateInfluxDirectConfig, validateInfluxUrl |
