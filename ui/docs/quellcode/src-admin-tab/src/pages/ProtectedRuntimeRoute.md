# src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx

Rendert geschützte React-Inhalte erst nach erfolgreicher EOS-Sitzungs- und Rollenprüfung und sperrt sie bei Sitzungsverlust erneut.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `react` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `./PageShell` | [src-admin-tab/src/pages/PageShell.tsx](../../../../../src-admin-tab/src/pages/PageShell.tsx) |
| `../components/EmbeddedEmsFrame` | [src-admin-tab/src/components/EmbeddedEmsFrame.tsx](../../../../../src-admin-tab/src/components/EmbeddedEmsFrame.tsx) |
| `../lib/adminConnection` | [src-admin-tab/src/lib/adminConnection.ts](../../../../../src-admin-tab/src/lib/adminConnection.ts) |

**Direkt importiert von:**

- [src-admin-tab/src/App.tsx](../../../../../src-admin-tab/src/App.tsx)
- [src-admin-tab/src/pages/InstallerPage.tsx](../../../../../src-admin-tab/src/pages/InstallerPage.tsx)

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`checkedCentralUrl`](../../../../../src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx#L36) | value | value.startsWith |
| [`useRuntimeAccess`](../../../../../src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx#L47) | – | useContext |
| [`hasCapability`](../../../../../src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx#L52) | status, capability, allowedRoles | Array.isArray, String, allowedRoles.includes, capabilities.includes, status.capabilities.map |
| [`ProtectedRuntimeRoute`](../../../../../src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx#L67) | { capability, title, requiredRole = 'Installer oder Admin', allowedRoles = null, embedded = false, children, } | getInstance, surface, useCallback, useEffect, useMemo, useRef, useState |
| [`surface`](../../../../../src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx#L77) | node | – |
| [`current`](../../../../../src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx#L133) | – | – |
| [`focus`](../../../../../src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx#L159) | – | refresh |
| [`logout`](../../../../../src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx#L174) | – | checkedCentralUrl, current, getErrorMessage, logoutRuntimeAuth, resolveRuntimeLoginUrl, setBusy, setCentralLogoutPending, setLoginHref, setMessage, setPhase, setStatus, window.navigator.serviceWorker?.controller?.postMessage |
| [`current`](../../../../../src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx#L178) | – | – |
