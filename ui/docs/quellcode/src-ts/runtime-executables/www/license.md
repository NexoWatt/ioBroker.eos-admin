# src-ts/runtime-executables/www/license.ts

Bindet Lizenzanzeige und Aktivierung an den ausschließlich für Admins freigegebenen Backend-Bereich an.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/license.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

Kein direkter Import innerhalb des erfassten Quellbereichs. Mögliche HTML-, Adapter-, Build- oder dynamische Einstiege sind separat zu prüfen.

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`asError`](../../../../../src-ts/runtime-executables/www/license.ts#L79) | error | String |
| [`setStatus`](../../../../../src-ts/runtime-executables/www/license.ts#L84) | text, ok | String, el.status.classList.toggle |
| [`setBusy`](../../../../../src-ts/runtime-executables/www/license.ts#L91) | next | String |
| [`clearSensitiveFields`](../../../../../src-ts/runtime-executables/www/license.ts#L100) | – | el.toggle.setAttribute |
| [`clearLegacyBrowserCache`](../../../../../src-ts/runtime-executables/www/license.ts#L112) | – | key.startsWith, remove.forEach, remove.push, storage.key |
| [`fetchJson`](../../../../../src-ts/runtime-executables/www/license.ts#L130) | url, options | Object.assign, String, fetch, response.json |
| [`requireLicenseRole`](../../../../../src-ts/runtime-executables/www/license.ts#L146) | – | auth.requireCapability, clearSensitiveFields, setBusy, setStatus |
| [`loadLicense`](../../../../../src-ts/runtime-executables/www/license.ts#L165) | – | Date.now, String, asError, clearSensitiveFields, fetchJson, nwWindow.NW_AUTH.showLogin, requireLicenseRole, setBusy, setStatus |
| [`saveLicense`](../../../../../src-ts/runtime-executables/www/license.ts#L190) | – | JSON.stringify, String, asError, fetchJson, setBusy, setStatus |
| [`resolveAdminBackUrl`](../../../../../src-ts/runtime-executables/www/license.ts#L220) | – | String, params.get, window.NW_RUNTIME.adminBase |
| [`copyUuid`](../../../../../src-ts/runtime-executables/www/license.ts#L233) | – | String, document.execCommand, el.uuid.focus, el.uuid.select, navigator.clipboard.writeText, setStatus |
| [`toggleKeyVisibility`](../../../../../src-ts/runtime-executables/www/license.ts#L252) | – | el.toggle.setAttribute |
| [`bind`](../../../../../src-ts/runtime-executables/www/license.ts#L260) | – | String, document.getElementById, el.back?.addEventListener, el.copyUuid?.addEventListener, el.key?.addEventListener, el.reload?.addEventListener, el.save?.addEventListener, el.toggle?.addEventListener, params.get, window.addEventListener |
