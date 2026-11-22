# src-admin-tab/src/pages/MeshCoordinatorPage.tsx

Führt Installer/Admin durch Master-, Slave-, Grenz- und Paarungseinstellungen.

**Daten und Wirkung:** Liest geschützte Diagnosen und speichert geprüfte Konfigurationen. Paarungsschlüssel bleiben nur vorübergehend im Formular, niemals im Browser-Speicher.

**Bei Änderungen:** Rollen, 99-Knoten-Limit, Nullgrenzen und Backend-Prüfungen gemeinsam testen.

[Originalquelle](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `react` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./PageShell` | [src-admin-tab/src/pages/PageShell.tsx](../../../../../src-admin-tab/src/pages/PageShell.tsx) |
| `./MeshAccountingPanel` | [src-admin-tab/src/pages/MeshAccountingPanel.tsx](../../../../../src-admin-tab/src/pages/MeshAccountingPanel.tsx) |
| `../lib/adminConnection` | [src-admin-tab/src/lib/adminConnection.ts](../../../../../src-admin-tab/src/lib/adminConnection.ts) |
| `../lib/mesh-types` | [src-admin-tab/src/lib/mesh-types.ts](../../../../../src-admin-tab/src/lib/mesh-types.ts) |

**Direkt importiert von:**

- [src-admin-tab/src/App.tsx](../../../../../src-admin-tab/src/App.tsx)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`zeros`](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx#L20) | – | – |
| [`blankNode`](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx#L21) | id | zeros |
| [`NumberField`](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx#L22) | { label, value, onChange } | – |
| [`GroupLimits`](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx#L23) | { value, onChange } | networkKeys.map |
| [`NodeEditor`](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx#L26) | { value, onChange, local = false } | limitKeys.map |
| [`set`](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx#L27) | key, next | onChange |
| [`MeshCoordinatorPage`](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx#L40) | – | Math.round, config.branches.map, config.nodes.map, getRuntimeProxyBase, status.master.nodes.map, status.master.siteMeasurement.phaseA?.map, useEffect, useState |
| [`poll`](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx#L47) | first | getErrorMessage, getErrorStatus, meshCoordinatorRequest, parseMeshResponse, setApp, setBundle, setConfig, setLocked, setMessage, setPaired, setStatus, setTimeout, setUnavailable |
| [`update`](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx#L50) | key, value | setConfig |
| [`save`](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx#L51) | event | event.preventDefault, getErrorMessage, meshCoordinatorRequest, parseMeshConfigResponse, setBundle, setBusy, setConfig, setLocked, setMessage, setPaired, setPairingKey |
| [`pair`](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx#L56) | – | JSON.stringify, getErrorMessage, meshCoordinatorRequest, parsePairBundle, setBundle, setBusy, setMessage |
| [`loadBundle`](../../../../../src-admin-tab/src/pages/MeshCoordinatorPage.tsx#L57) | – | getErrorMessage, parsePairImport, setConfig, setImportBundle, setMessage, setPairingKey |
