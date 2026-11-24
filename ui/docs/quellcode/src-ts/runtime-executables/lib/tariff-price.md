# src-ts/runtime-executables/lib/tariff-price.ts

Unterscheidet echte Tarifpreise einschließlich 0 und negativer Preise

**Daten und Wirkung:** Liest ausschließlich numerische Preisproben. Keine Umrechnung,

**Bei Änderungen:** null/leer/boolean, echte 0, negative Preise und IO-Fehler prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/tariff-price.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-ts/runtime-executables/ems/modules/core-limits.ts](../../../../../src-ts/runtime-executables/ems/modules/core-limits.ts)
- [src-ts/runtime-executables/ems/modules/energy-wallet.ts](../../../../../src-ts/runtime-executables/ems/modules/energy-wallet.ts)
- [src-ts/runtime-executables/ems/modules/tarif-vis.ts](../../../../../src-ts/runtime-executables/ems/modules/tarif-vis.ts)
- [src-ts/runtime-executables/main.ts](../../../../../src-ts/runtime-executables/main.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`tariffPriceNumber`](../../../../../src-ts/runtime-executables/lib/tariff-price.ts#L17) | value | Number, Number.isFinite, value.trim |
| [`tariffPriceUnit`](../../../../../src-ts/runtime-executables/lib/tariff-price.ts#L27) | value | value.trim |
| [`normalizeTariffPrice`](../../../../../src-ts/runtime-executables/lib/tariff-price.ts#L36) | value, unit | Math.abs, Number.isFinite, tariffPriceNumber |
| [`readTariffPriceState`](../../../../../src-ts/runtime-executables/lib/tariff-price.ts#L46) | adapter, id | Array.isArray, Reflect.get, adapter.getStateAsync, tariffPriceNumber |
| [`tariffDisplayConfig`](../../../../../src-ts/runtime-executables/lib/tariff-price.ts#L58) | value, namespace | rec, source, unit |
| [`rec`](../../../../../src-ts/runtime-executables/lib/tariff-price.ts#L62) | item | Array.isArray |
| [`source`](../../../../../src-ts/runtime-executables/lib/tariff-price.ts#L64) | id, fallback, suffix | fallback.trim, id.trim |
| [`unit`](../../../../../src-ts/runtime-executables/lib/tariff-price.ts#L70) | raw, src | raw.trim |
