# src-ts/runtime-executables/lib/mesh-energy-journal.ts

Dauerhaftes, segmentiertes Originalarchiv für Haus-NVP-Zählerstände.

**Daten und Wirkung:** Append + fsync vor ACK; 1.000 Datensätze je Datei, SHA-256-Kette,

**Bei Änderungen:** Absturz, unvollständige Zeilen, Dubletten, Wiederholung und Datenträgerfehler testen.

[Originalquelle](../../../../../src-ts/runtime-executables/lib/mesh-energy-journal.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:fs/promises` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:path` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

- [src-ts/runtime-executables/lib/mesh-energy-service.ts](../../../../../src-ts/runtime-executables/lib/mesh-energy-service.ts)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`hash`](../../../../../src-ts/runtime-executables/lib/mesh-energy-journal.ts#L20) | record | JSON.stringify, crypto.createHash |
| [`segment`](../../../../../src-ts/runtime-executables/lib/mesh-energy-journal.ts#L21) | seq | Math.floor, String |
| [`immediate`](../../../../../src-ts/runtime-executables/lib/mesh-energy-journal.ts#L22) | – | – |
| [`EnergyJournal.constructor`](../../../../../src-ts/runtime-executables/lib/mesh-energy-journal.ts#L24) | directory, maxBytes | Promise.resolve |
| [`EnergyJournal.init`](../../../../../src-ts/runtime-executables/lib/mesh-energy-journal.ts#L27) | – | – |
| [`EnergyJournal.readSegment`](../../../../../src-ts/runtime-executables/lib/mesh-energy-journal.ts#L45) | file | fs.readFile, fs.stat, lines.map, path.join, text.endsWith, text.trimEnd |
| [`EnergyJournal.validateNext`](../../../../../src-ts/runtime-executables/lib/mesh-energy-journal.ts#L53) | record, previous | Number.isSafeInteger, hash |
| [`EnergyJournal.observe`](../../../../../src-ts/runtime-executables/lib/mesh-energy-journal.ts#L59) | r | – |
| [`EnergyJournal.get`](../../../../../src-ts/runtime-executables/lib/mesh-energy-journal.ts#L65) | seq | Number.isSafeInteger, segment, this.readSegment |
| [`EnergyJournal.append`](../../../../../src-ts/runtime-executables/lib/mesh-energy-journal.ts#L71) | record | job.catch, this.tail.then |
| [`EnergyJournal.batch`](../../../../../src-ts/runtime-executables/lib/mesh-energy-journal.ts#L93) | after, count | result.push, rows.at, segment, this.init, this.readSegment |
| [`EnergyJournal.records`](../../../../../src-ts/runtime-executables/lib/mesh-energy-journal.ts#L104) | end | immediate, this.readSegment, this.validateNext |
| [`EnergyJournal.summary`](../../../../../src-ts/runtime-executables/lib/mesh-energy-journal.ts#L111) | – | – |
