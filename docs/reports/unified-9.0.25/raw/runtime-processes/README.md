# Echte Prozessprüfungen der Bedienaktionen

Stand: 2026-11-25, EOS-9.0.25-Recovery-Arbeitsstand. Nach der letzten Servicekorrektur `stopFailures` erneut ausgeführt. Unter **Node 22.23.4 und Node 24.22.3 jeweils 5/5 bestanden**, keine Fehler, Abbrüche oder übersprungenen Tests.

Geprüft wird `test/eos-runtime-control-processes.test.cjs` mit den echten Produktionsklassen `EosRuntimeControl` und `EosModuleHost`, echten Devices-/OCPP-OS-Unterprozessen sowie einer OCPP-1.6-Gegenstelle über Loopback-WebSocket. Die ioBroker-Datenbank ist eine synthetische Fixture. Es werden keine Runtime-Factories für Devices oder OCPP ersetzt.

| Fall | Geprüftes Ergebnis |
| --- | --- |
| Devices aus/ein/neustarten | Alter Prozess beendet, neue PID und Generation; OCPP-PID und bestehende WebSocket-Verbindung bleiben erhalten. |
| OCPP mit nativer Adresse | Ein beim Stop auf einen Parent-State-Read wartender positiver Befehl wird verworfen. Neues Child/neue Verbindung übernimmt keine gespeicherten Altbefehle; nur ein frischer Befehl unter dem korrekten Namensraum wird übertragen. Devices bleibt unverändert. |
| OCPP mit übernommener Adresse | Derselbe Ablauf mit erhaltenem `ocpp21.2`-Namensraum; der jeweils falsche Namensraum kann den neuen Prozess nicht steuern. |
| Gespeicherte Abschaltung | Eine neue Host- und Control-Instanz liest Devices weiterhin als abgeschaltet; bis zur bewussten Freigabe wird kein Devices-Child erzeugt. OCPP startet weiterhin. |
| Modulkonfiguration deaktiviert | Die Prozessfreigabe aktiviert kein in seiner eigenen Konfiguration deaktiviertes Devices-Modul. OCPP bleibt erreichbar. |

Die unveränderten Modulkonfigurationen werden in allen Fällen geprüft. UI-Methoden sind für diese Modulaktionen durch einen Platzhalter abgesichert, dessen Aufruf fehlschlagen würde. Eine echte UI-Laufzeit wird in dieser Datei nicht gestartet; deren Prüfungen liegen in der getrennten UI-Testreihe.

Ausgeführt im Repositoryverzeichnis:

```sh
node --test --test-timeout=90000 test/eos-runtime-control-processes.test.cjs
/workspace/scratch/741f792566ea/node22-runtime/package/bin/node --test --test-timeout=90000 test/eos-runtime-control-processes.test.cjs
```

Unveränderte Standardausgaben der abschließenden Läufe:

- `runtime-control-processes-node24.tap` — Node 24.22.3, Standardreporter dieses Runtimes, 9.999 Sekunden.
- `runtime-control-processes-node22.tap` — Node 22.23.4, TAP-Ausgabe, 9.985 Sekunden.

Die Laufzeiten wurden bei parallel aktiven Tests erfasst und sind keine Leistungsbenchmark. Es wurde kein RSS/PSS-Verbrauch gemessen. Die Ressourcenbewertung der neuen Steuerung ist eine Codeprüfung: feste fünf Freigaben, höchstens ein angenommener Bedienauftrag, begrenztes Initiallesen, kein weiterer Prozess und kein eigener periodischer Timer. Bestehende Prozess-, IPC- und Datenbankgrenzen gelten weiter. Eine blockierte Datenbankmutation wird nicht zugunsten einer scheinbar erfolgreichen Freigabe übersprungen.

Kein physisches Gerät, keine Abschaltwirkung, kein Dauerbetrieb und kein vollständiger ioBroker-Controller-Neustart auf der Kundenanlage wurden geprüft. Die Persistenzprüfung erstellt neue Host-/Service-Instanzen gegen denselben simulierten persistenten Datenbestand. Die Ergebnisse belegen die beschriebenen Softwareabläufe, keine vollständige Anlagenzuverlässigkeit.

SHA-256 des geprüften Standes:

```text
5fe5ae0cb560b49169b3c8811a9fcfc3587a6d129411f8e5bd90db385cef60e2  test/eos-runtime-control-processes.test.cjs
05ca64f2ada7b9ab3baa631f74faab63a25ebf67fb40c0d4b1c26aa8c741a691  src/lib/eosRuntimeControl.js
435b2febd8b84c4e8c29fdcf9ff0acd53879fc6f771b675e5271cc07823e230c  src/lib/eosModuleHost.js
ada1820f868a2afc375fe92583f1952e10a62d89faf33a380a0c4d8717353894  runtime-control-processes-node22.tap
c557e4f9abb55387ad1ac630832d164e405cf9a4a39853a523eae11e1e99f963  runtime-control-processes-node24.tap
```
