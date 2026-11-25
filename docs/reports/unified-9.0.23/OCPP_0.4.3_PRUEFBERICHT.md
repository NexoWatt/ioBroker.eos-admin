# NexoWatt OCPP 0.4.3 – Prüfbelege und Grenzen

Stand: 25.11.2026. Ausgangspunkt: vom Nutzer bereitgestelltes `NexoWatt-OCPP-0.4.2-Standalone.zip`, SHA-256 `e755148f0ca33891a0edd084689eed9dd674e81efe518b07445e71d9e9b191c4`. Kein Austausch der gesicherten integrierten EOS-Komponente. Keine Live-Anlage wurde verändert.

## Änderungen

- `common.compact=false`, daemon bleibt erhalten; eigene ioBroker-Adapterinstanz und eigener Prozess.
- Additive native Stations-Metadaten, `info.controlScope` und zufällige Sitzungs-ID.
- Atomare Profilbestätigung mit W-Obergrenze, tatsächlichem Accepted-Zeitpunkt und Sitzung; vollständige Legacy-Felder bei kontrollierter Valid-Übergabe.
- Schutz gegen spät eintreffende Antworten, Teilveröffentlichung, überholte Anforderung und Reconnect während Datenbankschreiboperationen.
- Entfernte veraltete doppelte Lizenz-Metadaten; MIT-Lizenz unverändert. Dokumentation des seit 0.4.2 geltenden Null-/Mindeststromvertrags korrigiert.
- Optionaler EOS-Lease-Watchdog mit persistentem Armed-Zustand, monotonic deadline, 1-s-Prüfung und bestätigtem Nullprofil nach fehlender Verlängerung. Keine automatische Wiederaufnahme durch eine Lease-Verlängerung.
- Reproduzierbarer Abhängigkeitsstand per `npm-shrinkwrap.json` (auch im npm-Paket); identische Kopie als `package-lock.json` im Quellpaket.

## Automatisierte Prüfungen

| Prüfung | Node 22.23.4 | Node 24.22.3 |
|---|---:|---:|
| Core/Runtime/Vertrag, einschließlich neuer Race- und Fehlerfälle | 74/74 | 74/74 |
| Paket-Metadaten und Dateien | 46/46 | 46/46 |
| Veralteter ioBroker-Unit-Startup-Marker | 1/1, keine funktionale Aussage | 1/1, keine funktionale Aussage |
| Echte ioBroker-Testdatenbank, separater Adapterprozess und OCPP-Loopback | 2/2 | 2/2 |

Die Integration verwendet ioBroker js-controller 7.2.5 und echte lokale JSONL/Redis-Protokoll-Datenbanken, einen separaten Adapter-Unterprozess sowie `ocpp-rpc`-WebSocket-Verkehr. Geprüft werden Prozess-ID, `compact=false`, nativer Stationsvertrag, BootNotification, SetChargingProfile mit 0 W, atomare Accepted-Bestätigung, echte 4200-W-Freigabe nach Lease-Aktivierung, absichtlich unterbrochene Verlängerung mit anschließendem 0-W-SetChargingProfile/Accepted, Verlängerung ohne automatische Leistungswiederherstellung und Invalidierung beim Socket-Abbruch. Es handelt sich um simulierte Stationen, nicht um physische Ladehardware. Die Prozessverwaltung im Test startet den Adapter als Unterprozess; die Compact-Eignung wird anhand der tatsächlichen Instanzmetadaten kontrolliert.

**Hosteinschränkung:** Der unveränderte Controller-Setup scheitert in dieser Ausführungsumgebung an gesperrtem `os.networkInterfaces()`/Netlink. Für die beiden erfolgreichen Integrationstests wird ausschließlich per `NODE_OPTIONS=--require=.../test/host-network-fixture.cjs` ein dokumentierter Test-Netzwerkbestand (Loopback und reservierte Testadresse/MAC) geliefert. Keine Produktdatei importiert dieses Fixture. Datenbank, WebSocket, Adapterprozess und Profilverarbeitung laufen real; die Host-Netzwerkerkennung wird nicht als getestet behauptet. Der fehlgeschlagene unveränderte Lauf bleibt als Rohbeleg erhalten.

Die Core-Tests benötigen keine Host-Fixtures. Neue Fälle prüfen unter anderem: Pending vor Antwort, 0 bleibt 0, Rejected/Timeout trotz ioBroker-ack, echte simulierte Timeout-Uhr mit später Accepted-Antwort, unverändertes Profil mit altem Acceptance-Zeitpunkt, Reconnect mitten in drei Veröffentlichungsstufen, überholter positiver Befehl vor neuer Nullgrenze, alte Disconnect-Aufgabe nach neuer Sitzung und Erhalt benutzerdefinierter Objektattribute. Lease-Prüfungen decken zusätzlich Persistenz ohne Replay nach Neustart, Zeitfenstergrenzen, alte Ereignisse, Uhr-Rücksprung, verspätete positive Antwort, abgelehntes Nullprofil, fehlende Verbindung, erneute Inbetriebnahme nach gültiger Nullbestätigung, vorübergehenden Datenbankfehler, eine fehlerhafte Station neben einer funktionierenden Station und blockierte Diagnoseveröffentlichung ab. Im letzten Fall wird der echte Aufruf zum Nullprofil trotzdem ausgeführt.

Die EOS-seitige automatische Zuordnung wurde zusätzlich im EOS-9.0.23-Test mit dieser tatsächlichen Adapterquelle und zwei Anschlüssen geprüft: eine Stationszeile, native Zuordnungen vollständig, zunächst deaktiviert und zur Inbetriebnahme vorgemerkt. Nicht jede Wallbox-Firmware oder jeder herstellerspezifische Ablauf ist dadurch abgedeckt.

## Abhängigkeiten

Installiert und geprüft: `@iobroker/adapter-core` 3.4.3, `ocpp-rpc` 2.2.1, dessen upstream festgelegtes `ajv` 8.14.0. `SBOM.cdx.json` wurde mit `npm sbom --omit=dev --sbom-format=cyclonedx` aus dem tatsächlich installierten, gesperrten Baum erzeugt; sie enthält Produktions- und Peer-Abhängigkeiten, keine erfundene Liste.

`npm audit --omit=dev --json`: **2 moderate Einträge, 0 high, 0 critical** (AJV und abhängiges ocpp-rpc; GHSA-2g4f-4pwh-qvx6). Die Advisory betrifft AJV mit aktivierter `$data`-Option; der geprüfte ocpp-rpc-Validator erzeugt `new Ajv({strictSchema:false})` ohne `$data`. Die Meldung wird trotzdem offen dokumentiert. Ein versuchtes Override auf AJV 8.20.0 scheiterte bereits bei `require('ocpp-rpc')` an inkompatibler URN-Verarbeitung. Es wurde vollständig zurückgenommen; im Lieferpaket bleibt der funktionsfähige Upstream-Vertrag. Keine pauschale Aussage „keine Schwachstellen“.

## Ausfall- und Freigabegrenzen

Accepted bestätigt die Protokollannahme, nicht die physische Einhaltung einer Ladegrenze. Messwerte, Phasenzahl, Stationssumme und lokale elektrische Schutzorgane bleiben maßgeblich. AC/DC, Mehranschlussbetrieb, alle drei Protokollversionen, Ablehnung von Nullprofilen, Wiederfreigabe und Dauerlauf müssen mit der konkreten Hardware geprüft werden.

**EOS-Ausfall bei weiterlaufendem OCPP-Adapter:** EOS 9.0.23 aktiviert die optionale Lease nur für freigegebene, eindeutig zugeordnete Stationen. Es schreibt alle 5 s eine Frist von jetzt +15 s. Der Adapter akzeptiert höchstens 30 s Zukunft und nur frische Schreibereignisse. Die erste gültige Lease setzt dauerhaft `control.eosLeaseArmed=true`. Nach einem Adapter-Neustart muss eine neue Verlängerung eintreffen; ein gespeicherter zukünftiger Wert wird nicht wiederverwendet. Ohne vorherige Aktivierung bleibt der Standalone-Betrieb unverändert.

Eine unabhängige 1-s-Prüfung sperrt bei Ablauf positive Vorgaben und fordert im bestehenden seriellen Befehlspfad ein echtes 0-W-Profil an. Bereits wartende Konfigurationsaufgaben dürfen keinen weiteren RPC-Aufruf davor ausführen. Ein schon laufender OCPP-Aufruf muss zunächst antworten oder sein konfiguriertes Timeout erreichen; eine sofortige physische Abschaltung wird nicht behauptet. Diagnose-Schreibfehler blockieren den Versand dieser Notfall-Nullgrenze nicht. Bei Ablehnung wird weiter gesperrt und nach frühestens 5 s erneut versucht. Frische Verlängerung allein stellt keine positive Leistung wieder her; nach Ablauf müssen zunächst das Nullprofil bestätigt und dann eine neue W-Vorgabe gegeben werden. `eosLeaseUntilMs=0` deaktiviert den persistenten Schutz nicht.

Bei unterbrochener OCPP-Verbindung, abgestürztem OCPP-Prozess, nicht erreichbarer Station, nicht reagierender Firmware oder bereits blockierter laufender Aufgabe kann der Adapter keine physische Nullleistung garantieren. Profile haben weiterhin weder `validTo` noch Schedule-`duration`, damit ein Profilablauf nicht versehentlich unbeschränkte Leistung freigibt. Lokale Offline-/Ausfallbegrenzung und elektrische Schutzorgane bleiben erforderlich. Kein ungeprüfter RemoteStop wurde eingeführt.

Die Standalone-WS-Schnittstelle besitzt kein eingebautes TLS/Passwort. Identitäts-Allowlist ist ein Namensfilter, kein Identitätsnachweis. Betrieb und Zuordnung setzen die passende geschützte Stationsnetzgrenze voraus; eine neue automatisch erkannte Station bleibt in EOS bis zur geprüften Inbetriebnahme deaktiviert. Siehe EOS-INTEGRATION.md.

Damit sind konkrete Fehler reproduzierbar abgesichert. Eine 100-%-Zuverlässigkeit, Produktionsfreigabe, OCPP-Zertifizierung oder Hardware-Abnahme wird nicht behauptet.
