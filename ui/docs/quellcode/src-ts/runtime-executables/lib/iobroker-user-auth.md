# src-ts/runtime-executables/lib/iobroker-user-auth.ts

Bindet Anmeldung und Sitzungswiderruf an die kanonische ioBroker-Konto-ID.

**Daten und Wirkung:** Unvertrauter Benutzername/Passwort; öffentliche Adapter-APIs getUserID,

**Bei Änderungen:** Kanonische Identität, Fristen und Widerrufsfingerabdruck gemeinsam prüfen;

[Originalquelle](../../../../../src-ts/runtime-executables/lib/iobroker-user-auth.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `node:crypto` | Node-Bordmittel oder externe Paketabhängigkeit. |
| `node:perf_hooks` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

Kein direkter Import innerhalb des erfassten Quellbereichs. Mögliche HTML-, Adapter-, Build- oder dynamische Einstiege sind separat zu prüfen.

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`record`](../../../../../src-ts/runtime-executables/lib/iobroker-user-auth.ts#L44) | value | Array.isArray |
| [`isCanonicalUserId`](../../../../../src-ts/runtime-executables/lib/iobroker-user-auth.ts#L49) | value | suffix.replace, suffix.trim, value.slice, value.startsWith |
| [`readAccountSecurity`](../../../../../src-ts/runtime-executables/lib/iobroker-user-auth.ts#L58) | adapter, userShort, timeoutMs | Number.isFinite, clearTimeout, createHash, isCanonicalUserId, record |
| [`authenticateIoBrokerUser`](../../../../../src-ts/runtime-executables/lib/iobroker-user-auth.ts#L90) | adapter, rawUser, rawPassword, timeoutMs | Math.min, Number.isFinite, Promise.resolve, performance.now, rawUser.trim |
| [`isActive`](../../../../../src-ts/runtime-executables/lib/iobroker-user-auth.ts#L104) | – | performance.now |
| [`finish`](../../../../../src-ts/runtime-executables/lib/iobroker-user-auth.ts#L105) | result | cancelPasswordCheck, clearTimeout, isActive, resolve |
| [`checkCanonicalPassword`](../../../../../src-ts/runtime-executables/lib/iobroker-user-auth.ts#L115) | id | – |
| [`complete`](../../../../../src-ts/runtime-executables/lib/iobroker-user-auth.ts#L117) | result, returnedUser | done, isActive |
| [`run`](../../../../../src-ts/runtime-executables/lib/iobroker-user-auth.ts#L133) | – | adapter.getUserID, canonicalId.slice, checkCanonicalPassword, finish, input.replace, input.startsWith, isActive, isCanonicalUserId, readAccountSecurity |
