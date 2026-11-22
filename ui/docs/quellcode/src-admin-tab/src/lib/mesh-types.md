# src-admin-tab/src/lib/mesh-types.ts

Prüft Mesh-API-Daten und importierte Paarungen vor der Formularverwendung.

**Daten und Wirkung:** Native, begrenzte JSON-Prüfung; unbekannte Archivfelder bleiben

**Bei Änderungen:** Backend-Verträge, leere Formularzahlen und Archivexport mitprüfen.

[Originalquelle](../../../../../src-admin-tab/src/lib/mesh-types.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

- [src-admin-tab/src/pages/MeshAccountingPanel.tsx](../../../../../src-admin-tab/src/pages/MeshAccountingPanel.tsx)
- [src-admin-tab/src/pages/MeshCoordinatorPage.tsx](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`invalid`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L18) | – | – |
| [`record`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L19) | value | Array.isArray, Object.getPrototypeOf, invalid |
| [`text`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L25) | value | invalid |
| [`number`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L26) | value | Number.isFinite, invalid |
| [`bool`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L27) | value | invalid |
| [`nullable`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L28) | decode | – |
| [`optional`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L29) | decode, fallback | – |
| [`list`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L30) | decode, max | – |
| [`choice`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L31) | allowed | – |
| [`shape`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L36) | schema | – |
| [`safeTree`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L47) | value, depth, budget | Array.isArray, Object.entries, invalid, number, record, safeTree, text |
| [`boundary`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L62) | decode | – |
| [`strategy`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L90) | value | choice |
| [`decodeRecord`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L93) | value | Date.parse, Number.isFinite, Number.isSafeInteger, invalid, list, nullable, record, shape |
| [`parsePairImport`](../../../../../src-admin-tab/src/lib/mesh-types.ts#L126) | value | JSON.parse, invalid, parsePairBundle |
