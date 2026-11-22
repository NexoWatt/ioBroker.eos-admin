# src-admin-tab/src/pages/DynamicGridPage.tsx

Vollständige, herstellerunabhängige Einrichtung der App Dynamischer Netzanschluss.

**Daten und Wirkung:** M0-Messung stammt schreibgeschützt aus Allgemein. M1, Speicher, PV,

**Bei Änderungen:** UI-Felder, generisches Backend-Schema und atomare App-Aktivierung gemeinsam prüfen; M0 nicht erneut zuordnen.

[Originalquelle](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `react` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./PageShell` | [src-admin-tab/src/pages/PageShell.tsx](../../../../../src-admin-tab/src/pages/PageShell.tsx) |
| `../components/DpField` | [src-admin-tab/src/components/DpField.tsx](../../../../../src-admin-tab/src/components/DpField.tsx) |
| `../lib/adminContracts` | [src-admin-tab/src/lib/adminContracts.ts](../../../../../src-admin-tab/src/lib/adminContracts.ts) |
| `../lib/adminConnection` | [src-admin-tab/src/lib/adminConnection.ts](../../../../../src-admin-tab/src/lib/adminConnection.ts) |

**Direkt importiert von:**

- [src-admin-tab/src/App.tsx](../../../../../src-admin-tab/src/App.tsx)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`textLabels`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L27) | labels | Object.create, Object.entries, Object.freeze |
| [`emptyMeasurement`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L35) | – | – |
| [`emptyPoint`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L36) | id | emptyMeasurement |
| [`emptyTopology`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L37) | – | emptyPoint |
| [`emptyOutput`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L38) | – | – |
| [`emptyStorage`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L39) | – | emptyMeasurement, emptyOutput |
| [`emptyPv`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L40) | – | emptyMeasurement |
| [`watts`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L41) | value | Number.isFinite |
| [`reasonText`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L42) | reason | – |
| [`optionalText`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L43) | value, key, text | – |
| [`NumericField`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L46) | { label, value, onChange, min = 0, max, required = true, unit = '', help = '' } | – |
| [`TextField`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L53) | { label, value, onChange, required = false, help = '', maxLength = 256 } | – |
| [`SelectField`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L59) | { label, value, onChange, options, required = true, placeholder = false } | Object.entries |
| [`MeasurementEditor`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L68) | { value, onChange, label = 'Istleistung · Datenpunkt', storage = false, positiveOnly = false } | emptyMeasurement |
| [`set`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L70) | key, next | onChange |
| [`GeneralMeasurement`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L79) | { rootSource } | getRuntimeProxyBase, rows.map |
| [`PointEditor`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L94) | { value, onChange, rootSource = null } | – |
| [`set`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L95) | key, next | onChange |
| [`ScalarField`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L118) | { label, value, onChange } | String |
| [`OutputEditor`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L125) | { label, value, onChange, signed = false } | emptyOutput |
| [`set`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L127) | key, next | onChange |
| [`SwitchOutputEditor`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L135) | { label, value, onChange } | – |
| [`set`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L136) | key, next | onChange |
| [`StorageEditor`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L145) | { value, onChange, onRemove } | emptyOutput |
| [`set`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L146) | key, next | onChange |
| [`setCommand`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L148) | key, next | set |
| [`setStrategy`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L149) | key, next | set |
| [`changeCommandMode`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L150) | mode | emptyMeasurement, keys.forEach, set |
| [`PvEditor`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L228) | { value, onChange, onRemove } | – |
| [`set`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L229) | key, next | onChange |
| [`LiveStatus`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L250) | { status, preview = false } | Array.isArray, Date.now, Number.isFinite, Object.entries, Object.keys, errors.map, ids.map, pending.map, points.map, results.map, status.groups.map, textLabels |
| [`ValidationMessages`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L280) | { validation } | Array.isArray, errors.map, validation.warnings.map |
| [`DynamicGridPage`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L290) | – | config.points.map, config.pvAssignments.map, config.storages.map, getRuntimeProxyBase, useEffect, useMemo, useRef, useState |
| [`observeVersion`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L298) | version | Math.max, Number.isSafeInteger, setStaleConfig |
| [`acceptServer`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L317) | data, replaceDraft, acceptedMutation | Array.isArray, Math.max, Number.isSafeInteger, emptyTopology, observeVersion, setApp, setConfig, setDirty, setDraftRevision, setLocked, setPreview, setRootSource, setSavedConfig, setStaleConfig (weitere in der Quelle) |
| [`onParentChange`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L341) | event | isRecord, isSafeJson, observeVersion |
| [`notifyParentSaved`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L350) | data | Number.isSafeInteger, window.parent.postMessage |
| [`poll`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L355) | first | acceptServer, dynamicGridRequest, getErrorMessage, getErrorStatus, parseDynamicGridResponse, setConfig, setError, setMessage, setStatus, window.setTimeout |
| [`change`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L368) | next | setConfig, setDirty, setDraftRevision, setPreview, setValidation |
| [`update`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L369) | key, value | change |
| [`replaceRow`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L370) | rows, index, value | rows.map |
| [`removeRow`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L371) | key, index | change |
| [`showFailure`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L372) | e | getErrorMessage, getErrorStatus, isRecord, parseValidation, parseValidationDetails, setError, setMessage, setValidation |
| [`reload`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L379) | – | acceptServer, dynamicGridRequest, parseDynamicGridResponse, setBusy, setError, setMessage, showFailure |
| [`save`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L384) | activate | acceptServer, dynamicGridRequest, notifyParentSaved, parseDynamicGridResponse, setBusy, setError, setMessage, showFailure |
| [`lifecycle`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L395) | nextApp | acceptServer, dynamicGridRequest, notifyParentSaved, parseDynamicGridResponse, setBusy, setError, setMessage, showFailure |
| [`checkPreview`](../../../../../src-admin-tab/src/pages/DynamicGridPage.tsx#L405) | – | dynamicGridRequest, parseDynamicGridResponse, setBusy, setError, setMessage, setPreview, setValidation, showFailure |
