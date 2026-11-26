# Gemeinsame Modul- und Prozessaktivierung

Die Prozessseite in 9.0.25 konnte bei ausgeschaltetem Modul keine Aktivierung anbieten: Bei eingeschalteter Prozessfreigabe war „Aktivieren“ bereits wegen dieser Freigabe gesperrt, bei ausgeschalteter Prozessfreigabe wegen der separaten Modulabschaltung. Beide im Kundenbild gezeigten Kombinationen werden jetzt über dieselbe Aktion **Aktivieren** bedienbar.

Der Runtime-Control-Dienst speichert zunächst eine Prozesspause, bestätigt den Stopp und lässt anschließend ausschließlich `enabled:true` in der vollständigen gespeicherten Modulkonfiguration setzen. Der Host nutzt den vorhandenen validierten, verschlüsselten Konfigurationsspeicher samt Revision und wartet den tatsächlichen Commit ab. Erst danach folgt die Prozessfreigabe und der bestätigte Start. Die vorhandene Stop-Failure-Sperre, Lizenz-, Migrations- und Eigentumsprüfungen bleiben wirksam. Ein externer OCPP-Adapter wird nicht angehalten oder übernommen. **Neustarten** schaltet ein separat ausgeschaltetes Modul nicht stillschweigend ein.

Paralleles Speichern oder Importieren über die Modul-HTTP-Routen erhält während einer laufenden Runtime-Aktion HTTP 409. Nach dem Einlesen eines HTTP-Request-Bodys werden Administratorrolle, Sitzung und CSRF erneut geprüft. Damit kann ein langsamer Request weder alte Rechte noch eine veraltete Konfiguration in die Aktivierung hineintragen. Die Statusabfrage bleibt bei fünf Sekunden und nutzt den vorhandenen begrenzten Single-Flight-Pfad; es wurde kein weiterer Pollingdienst hinzugefügt.

## Geänderte Dateien dieses Arbeitspakets

- `src/lib/eosRuntimeControl.js`
- `src/lib/eosModuleHttp.js`
- `public/eos-runtime/index.js`
- `test/eos-runtime-control.test.cjs`
- `test/eos-runtime-controls-review.test.cjs`
- `test/eos-runtime-control-processes.test.cjs`
- `test/eos-runtime-controls-browser.cjs`
- `docs/MODULE_PROCESS_RUNTIME.md` (Abschnitt Aktivierung)

Die ergänzende Host-Methode, neue Installationsvorgaben und konkrete Host-Startfehler werden im Lifecycle-Arbeitspaket gepflegt (`src/lib/eosModuleHost.js` und Deklaration).

## Prüfungen

| Prüfung | Node 22.23.4 | Node 24.22.3 | Nachweisumfang |
|---|---:|---:|---|
| Runtime-Control und HTTP-Transaktionen | 30/30 | 30/30 | Verschlüsselte Persistenz, Neustart, Stoppfehler, langsamer Commit, Konflikte, Authentifizierungsentzug während des Bodys und paralleler Modulsave/import. |
| Echte Devices-/OCPP-Kindprozesse | 5/5 | 5/5 | PID-Wechsel, unveränderter Nachbarprozess/Socket, Namensraumerhalt, keine Wiederholung alter positiver Ladebefehle; Aktivierung über echte HTTP-Route, Modulhost und neuen Host nach Persistenz. |
| Chromium 158 | 14/14 | 14/14 | Beide gesperrten Ausgangszustände aus dem Screenshot aktivierbar, Bestätigung erst nach Lifecycle, Reload, Rollenentzug, Mobile und keine automatische Wiederholung unbeantworteter Befehle. |
| Bestehende Modul-HTTP-Suite | – | 8/8 | Bestehende Authentifizierungs-, Konfigurations- und Importgrenzen. |

Typecheck `tsconfig.eos-runtime-control.json` und ESLint der geänderten JavaScript-Dateien bestanden ebenfalls. Die Browsertests verwenden die produktive Oberfläche, HTTP-Routen, Runtime-Control und den geschützten Konfigurationsspeicher mit synthetischer DB/Auth/Lifecycle. Der separate Prozessnachweis verwendet echte produktive Geräte- und OCPP-Worker mit synthetischer Controller-DB und einer lokalen OCPP-Gegenstelle. Es wurde keine Kundenanlage gesteuert und kein neuer RAM-Zielwert gemessen. Diese Prüfungen ersetzen weder ioBroker-Installation noch Hardwareabnahme auf dem Raspberry Pi.

Rohbelege: [`raw/activation/`](raw/activation/). Browserberichte enthalten Quellhashes und Laufzeitversionen. `node22-real-processes.log` enthält den abschließenden TAP-Abschnitt des separat ausgeführten echten Prozesslaufs; Version und Zeitpunktzuordnung erfolgen über diesen Bericht und den gleichzeitigen Node-22-Browserbericht.

`verification.json` bindet die Ergebnisse zusätzlich an die geänderten Quell- und Testdateien. Die Desktop-/Mobilbilder wurden visuell geprüft: Status, Aktionen und Fehlertexte bleiben lesbar, ohne horizontales Überlaufen. Alle abgebildeten Daten sind Fixtures. Der Browserprüfserver beantwortet die Brandinggrafik absichtlich mit HTTP 204; das fehlende Logo in diesen Bildern ist daher kein Nachweis eines Produktfehlers. Die abgebildeten Stop-/Dependencyfehler wurden für die Fehlerdarstellung gezielt eingespeist.

## Ausgeführte Befehle

Arbeitsverzeichnis war die Kandidatenwurzel `work-926/iobroker.eos-admin`. `node` bezeichnet Node 24.22.3; der explizite Node-22-Pfad lieferte 22.23.4.

```sh
node --test test/eos-runtime-control.test.cjs test/eos-runtime-controls-review.test.cjs test/eos-runtime-control-processes.test.cjs
node --test test/eos-module-http.test.cjs
/workspace/scratch/741f792566ea/node22-runtime/package/bin/node --test test/eos-runtime-control.test.cjs test/eos-runtime-controls-review.test.cjs
/workspace/scratch/741f792566ea/node22-runtime/package/bin/node --test test/eos-runtime-control-processes.test.cjs
EOS_CHROMIUM_PATH=/workspace/scratch/741f792566ea/implementation-922/browser-test-runtime/chromium node test/eos-runtime-controls-browser.cjs
EOS_CHROMIUM_PATH=/workspace/scratch/741f792566ea/implementation-922/browser-test-runtime/chromium /workspace/scratch/741f792566ea/node22-runtime/package/bin/node test/eos-runtime-controls-browser.cjs
node node_modules/typescript/bin/tsc -p tsconfig.eos-runtime-control.json
node node_modules/eslint/bin/eslint.js -c eslint.runtime-health.config.mjs public/eos-runtime/index.js test/eos-runtime-control.test.cjs test/eos-runtime-controls-review.test.cjs test/eos-runtime-controls-browser.cjs test/eos-runtime-control-processes.test.cjs src/lib/eosRuntimeControl.js src/lib/eosModuleHttp.js
```
