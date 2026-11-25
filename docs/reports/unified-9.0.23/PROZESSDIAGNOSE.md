# EOS 9.0.23 – Admin-Prozessdiagnose

Stand: 25.11.2026. Dieser Vermerk beschreibt die neue Diagnoseansicht und deren lokale Nachweise; er ist keine Anlagen- oder Hardwarefreigabe.

## Verhalten

Die bestehende Admin-Navigation verlinkt `/runtime/`. Die Seite zeigt den echten Administrationsprozess, den gemeinsamen Prozess für Oberfläche/EMS und die getrennten Prozesse für Geräte, EEBus und Sicherung. Laufzustand, PID, Neustartzähler, Generation, letzter Heartbeat und gegebenenfalls Neustartzeit/Fehlercode kommen aus dem Parent-Prozess. Prozesslauf und fachlicher Betrieb sind getrennt: Ein laufender UI-Prozess kann ausdrücklich „EMS bereit: Nein“ anzeigen. Fehlender Status bleibt unbestätigt; ausgeschaltete Module werden als deaktiviert dargestellt.

Vorhandene `ocpp21.N`-Instanzen erscheinen separat als von ioBroker betriebene Adapter. Die Inventarisierung liest ausschließlich `system.instance` im festen Bereich `system.adapter.ocpp21.` und höchstens 32 Instanzen. Anschließend werden je Instanz exakt `system.adapter.ocpp21.N.alive`, `.pid` und `ocpp21.N.info.connection` gelesen. Bestätigte States benötigen `ack:true`, gültige Qualität (`q:0` oder fehlendes Standard-Qualitätsfeld) und einen gültigen Zeitstempel. Alive/Verbindung dürfen höchstens 120 Sekunden alt und höchstens 5 Sekunden in der Zukunft sein. Eine PID wird nur als positive Controller-Meldung zur aktuellen Alive-Laufgeneration gezeigt; ältere oder fehlende PID-Werte bleiben unbekannt. Es wird keine PID aus Adapterinstanz, Konfiguration oder Node-Prozess des Admin abgeleitet.

Die sichtbare Seite fragt alle 5 Sekunden ab. Pro Seite ist höchstens eine Abfrage aktiv; jede Abfrage hat eine 5-Sekunden-Frist. Versteckte/entladene Seiten beenden Timer und Request. Bei Rückkehr wird einmal unmittelbar aktualisiert. Verbindungsfehler entfernen die letzte grüne Prozessanzeige. Verlust der Admin-Berechtigung stoppt automatische Abfragen bis zum bewussten erneuten Aktualisieren.

OCPP 0.4.3 veröffentlicht den Verbindungszustand je Station, aber keinen gemeinsamen `ocpp21.N.info.connection`-Zustand. In der Prozessdiagnose bleibt deshalb die zusätzliche OCPP-Verbindungsanzeige für diese Version ausdrücklich unbekannt. Prozessstatus und PID kommen weiterhin vom Controller. Die einzelnen Stationsverbindungen und ihre frischen Messwerte werden unabhängig davon über den nativen Stationsvertrag im Lademanagement verarbeitet; die Prozessdiagnose erfindet keinen gemeinsamen Verbindungsstatus.

## Vertrauensgrenzen

`GET /api/eos/runtime`, HTML und lokale Assets verwenden denselben bestehenden Authentifizierungs-, Admin-, Erstanmeldungs- und Origin-Guard wie die anderen EOS-Adminmodule. Neue Authentifizierung oder externe Listener werden nicht eingeführt. Mutationsmethoden liefern 405; der Endpoint besitzt keinen Start-/Stop-/Restart-Befehl.

Die Antwort projiziert nur ausdrücklich zugelassene Diagnosefelder. Konfigurationen, Lizenzen, IPC-Inhalte, Rohfehler und Zugangsdaten werden nicht serialisiert. Der Browser verwendet `textContent`, validiert Identitäten/Statuswerte und akzeptiert keinen alten Gesamt-Snapshot. HTML liefert eine restriktive Same-Origin-CSP und `nosniff`; API/Seite sind `no-store`.

Backend-Abfragen haben eine gemeinsame 2,5-Sekunden-Frist pro Quelle und werden parallel ausgeführt. Gleichzeitige Browseranfragen teilen einen Snapshot. Ein zeitlich abgelaufener ioBroker-/IPC-Aufruf bleibt pro Quelle belegt, bis er tatsächlich endet; Polling kann daher keine unbegrenzte Zahl unerledigter Controller-Aufrufe erzeugen. Teilfehler lassen andere Prozesse sichtbar und setzen die betroffene Quelle auf unbestätigt.

## Nachweise

| Prüfung | Ergebnis |
| --- | --- |
| `node --test test/eos-runtime-health.test.cjs test/eos-module-http.test.cjs` | 15/15 bestanden: bestehende Admin-/Download-Schnittstellen und neue Auth-, Secret-, OCPP-PID-, Timeout-, Single-Flight- und Fehlerfälle |
| `npx tsc -p tsconfig.eos-runtime-health.json` | Bestanden, strikte Prüfung von Backend-Projektion und Browsercode |
| `npx eslint -c eslint.runtime-health.config.mjs src/lib/eosRuntimeHealth.js src/lib/eosModuleHttp.js public/eos-runtime/index.js test/eos-runtime-health.test.cjs test/eos-runtime-health-browser.cjs` | Bestanden |
| `EOS_CHROMIUM_PATH=… node test/eos-runtime-health-browser.cjs` | Headless Chromium 158, echte Seite/Styles/Skripte/Routen: Desktop 1440 px und Mobil 390 px, keine horizontale Überbreite oder JavaScript-Ausnahme |
| Browser-Lebenszyklus | Reale 5-Sekunden-Timer, maximal eine aktive Anfrage, HTTP-Fehler und Wiederanlauf, Hidden-Abbruch ohne weitere Abfragen, genau eine Abfrage bei Sichtbarkeit/BFcache-Rückkehr, Pollstopp nach 403 |

Rohnachweise und SHA-256 der geprüften Laufzeitquellen: `raw/current/runtime-health-browser.json`, `runtime-health-tests.txt`, `runtime-health-types.txt`, `runtime-health-lint.txt`. Die Browser-Stderr-Datei ist leer. Testwarnungen zu Node `stripTypeScriptTypes` bzw. npm `http-proxy` sind dokumentiert und keine fehlgeschlagenen Prüfungen.

Der Browsertest verwendet die tatsächlichen Runtime-Diagnoseartefakte und Route, aber simulierte Modul-/Controllerzustände und eine Adminrolle. Die eigentliche Session-/Berechtigungsprüfung läuft zusätzlich im HTTP-Test mit `UnifiedSessions`. Session-Idle-Skript und Logo sind im Browserfixture ausgenommen. Sichtbarkeits- und BFcache-Ereignisse werden gezielt ausgelöst; es handelt sich nicht um einen realen Anlagenbetrieb. Kein physischer OCPP-Lader, produktiver ioBroker-Controller oder Betriebssystem-Prozessneustart wurde durch diesen UI-Test bestätigt. Prozessisolation, Watchdogs und elektrische Regelwirkung benötigen die separaten Integrations-/Gerätenachweise des Gesamtstands.
