# NexoWatt EOS 9.0.6 – ergänzende Code- und Integrationsprüfung

Stand: 23.11.2026. Ausgangspunkt: bestätigter EOS-Stand 9.0.5, ergänzt um die tatsächlich eingebundenen Devices- und EEBus-Module. Prüfung durch einen getrennten KI-Arbeitsschritt innerhalb derselben Entwicklung. Dies ist keine externe Sicherheitsprüfung, Zertifizierung oder Produktivfreigabe.

Der Review änderte keinen Produktcode. Konkrete Befunde gingen an die jeweiligen Implementierer; anschließend erfolgte die Nachprüfung. Zusätzlich entstanden unabhängige Verhaltenstests in `modules/eebus/test/security.test.js` und `test/eos-module-real-contract.test.cjs`.

## Umfang und Vertrauensgrenzen

- Gemeinsamer Modulhost: aktuelle zentrale Lizenz, Betriebszuständigkeit gegenüber alten Adapterinstanzen, Objektbereiche, Konfigurationsablage, Geheimnisdarstellung, generationsgebundene Lebenszyklen und Fehler beim Beenden.
- Modul-HTTP-Routen: vorhandene Sitzung mit aktueller Administratorrolle, Passwortwechselpflicht, Herkunftsprüfung und CSRF-Schutz vor schreibenden Aktionen; feste lokale Dateien statt beliebiger Dateipfade.
- EEBus: tatsächliche TLS-Gegenstellenidentität, ausdrückliche Kopplung, Zertifikatbindung, SHIP-Reihenfolge, PIN-Prüfung, asynchrone Widerrufsgrenzen, Neustartidentität, Ressourcen und mDNS-Fehlerpfade.
- Devices: verzögerte Schreibaufträge auf gemeinsam verwendeten seriellen Bussen und Erhalt der eigenen Freigabe je Auftrag.
- Interne EEBus→EMS-Brücke: nicht serialisierbarer Herkunftsnachweis und serverseitige Prüfung vor Übernahme einer Vorgabe.
- Neue lokale HTTPS-Namensankündigung: begrenzte Antworten, Namenskonflikte und Lebenszyklus. Router, lokale DNS-Konfiguration, Client-Zertifikatsvertrauen und reale Multicast-Erreichbarkeit gehören nicht zu diesem Codeprüfnachweis.

Alle Module laufen weiterhin im selben Betriebssystemprozess und unter demselben Dienstkonto. Die Modulgrenzen sind keine Isolation gegen bösartigen Code im gemeinsamen Prozess oder gegen einen vollständig kontrollierten Host.

## Konkrete Befunde und Nachprüfung

| Kennung | Festgestellter Fehler | Umsetzung und Nachweis im geprüften Stand |
| --- | --- | --- |
| REVIEW-906-HOST-01 | Änderung der Generation konnte vorhandene Modul-Freigaben dauerhaft ungültig machen, während der Status das Modul weiter als aktiv meldete; normale Host-Heartbeats lösten unnötige Wechsel aus. | Laufende Modul-Generation wird gesondert verfolgt; ungültige Laufzeiten werden vor erneutem Start beendet; gesunde Heartbeats erhalten den Betrieb. Host-Tests prüfen Widerruf, Übergabe und Inventurrennen. |
| REVIEW-906-HOST-02 | Die erste Fassade ließ EEBus-Objektbereiche und einmalige 0-ms-Timer aus; die Modul-Factory benutzte zunächst eine andere Subscription-API. | `discovery`, `pairing` und `cls` sind ausdrücklich enthalten. Das echte EEBus-Modul erzeugt seine Objekte, registriert seine Kopplungs-Subscriptions und übersteht Deaktivierung/Aktivierung. |
| REVIEW-906-HOST-03 | Späte bestätigte Messwertschreibvorgänge konnten eine neue Laufzeit überschreiben; pauschales Zurückweisen von Bereinigungsschreibvorgängen machte anschließend normales Beenden fehlerhaft. | Alte bestätigte Diagnosewerte werden verworfen, alte Befehle abgewiesen. Das Beenden kann Ressourcen schließen; ein tatsächlicher Beendigungsfehler bleibt bis zum Prozessneustart gesperrt. Verhaltenstests decken beide Fälle ab. |
| REVIEW-906-SECRET-01 | Reine Feldnamensuche übersah Autorisierungs-/Cookie-Header und Zugangsdaten in URLs. | Darstellung und Rückübernahme berücksichtigen diese Felder. Geheimnisplatzhalter folgen der eindeutigen Geräte-ID statt einer Zeilennummer. Verschobene Zeilen behalten den richtigen Wert; neue Identitäten dürfen keine alten Geheimnisse übernehmen. |
| REVIEW-906-MIGRATION-01 | Das ursprüngliche EEBus-Konfigurationsobjekt passte nicht zur strikten Modulkonfiguration; die Gerätevorlagenauswahl war zunächst bei deaktiviertem Modul nicht erreichbar. | Ausdrückliche EEBus-Migration meldet ausgelassene Felder und nötige Neukopplung. Die alte Instanz bleibt unverändert, der Import bleibt deaktiviert. Die echte Devices-Vorlagenauswahl funktioniert bereits vor dem Start eines Gerätemoduls. |
| REVIEW-906-SHIP-01 | Der EEBus-Ausgangsstand übernahm die per mDNS behauptete Identität ohne Abgleich mit dem TLS-Peer; eingehende Verbindungen konnten ohne Zertifikat erscheinen. | Tatsächliche Zertifikate und SKI werden geprüft; gespeicherter Fingerabdruck muss passen. Fehlendes Zertifikat, falscher Fingerabdruck und abweichende mDNS-Identität werden in echten lokalen TLS-Verbindungen abgewiesen. |
| REVIEW-906-SHIP-02 | Daten und PIN-Zustände konnten die SHIP-Kopplungs-/Handshake-Reihenfolge umgehen. Ein behauptetes `pinOk` belegte keine Kenntnis der lokalen PIN. | Zustandsreihenfolge, tatsächliche lokale PIN-Prüfung und Kopplung werden geprüft. Negative Tests für frühe Daten, frühe PIN-Zustände, fehlende PIN und erfundenes `pinOk`; positiver gegenseitiger TLS-/SHIP-Datenaustausch. |
| REVIEW-906-SHIP-03 | Ein Lizenzentzug während einer asynchronen Vertrauensabfrage oder ein alter Socket-Abschluss konnte spätere Verarbeitung beziehungsweise eine neue Sitzung beeinträchtigen. | Freigabe und aktuelle Sitzung werden nach Wartepunkten erneut geprüft. Der alte Abschluss darf die neue Sitzung nicht entfernen. Beide Rennen sind mit echten lokalen Sockets nachgewiesen. |
| REVIEW-906-SHIP-04 | Die anfängliche Registrierung installierte Nachrichten-Listener erst nach dem Schreiben der Geräte-Metadaten; sofort gesendete Handshake-Nachrichten gingen verloren. Frühe ausdrückliche Kopplung kollidierte mit dem CMI-Zustand. | Frühe Frames werden begrenzt eingereiht; der CMI-Fortschritt ist vom angezeigten Status getrennt. Verzögerte Metadatenablage und frühe Kopplung sind getestet. Metadatenablage bleibt eine Voraussetzung für die anschließende geordnete Verarbeitung. |
| REVIEW-906-SHIP-05 | Gleichzeitige Verbindungsaufträge konnten während einer Diagnose-Wartezeit die Prüfung auf doppelte/verfügbare Verbindungen passieren. Acht Aufträge zum selben Peer erzeugten im reproduzierenden Test acht Verbindungen. | Kapazität, Identität, Stop und Freigabe werden nach dem Wartepunkt erneut geprüft. Der gleiche Test beobachtet jetzt genau eine Verbindung. |
| REVIEW-906-MDNS-01 | `Bonjour` aus der ausgelieferten Abhängigkeit ist kein EventEmitter. Ein optionaler `bonjour.on`-Aufruf setzte daher keinen Fehlerhandler; Transportfehler beziehungsweise der Standard-Fehlercallback konnten den gesamten EOS-Prozess beenden. | Fehlercallback, tatsächlicher mDNS-Emitter und Ankündigungsfehler werden behandelt. Ein gezielter Test injiziert fünf Fehlerpfade und prüft deren Begrenzung sowie Bereinigung. Dies ist ein Fehler-Injektionstest, kein realer LAN-Interoperabilitätstest. |
| REVIEW-906-DEVICES-01 | Eine Freigabeprüfung vor der geräteeigenen Warteschlange reichte für eine nachfolgende gemeinsame RTU-/ASCII-Buswarteschlange nicht aus. | Ein auf den einzelnen Auftrag begrenzter AsyncLocalStorage-Kontext wird am tatsächlichen seriellen Versand geprüft. Ein Test mit mehreren Geräten verwirft den widerrufenen Auftrag und lässt den weiterhin erlaubten Auftrag unverändert zu. Der gleichzeitig erkannte verschachtelte RTU-Verbindungs-Wartefehler ist ebenfalls getestet. |

Die neue interne EEBus→EMS-Brücke wurde zusätzlich gelesen: Ein privater `WeakMap`-Eintrag bindet die Herkunft an ein intern neu angelegtes Nachrichtenobjekt. Ein über die ioBroker-Nachrichtenverbindung übermitteltes `hosted`- oder `trusted`-Feld kann diesen Nachweis nicht herstellen. Aktuelle Betriebsfreigaben werden sowohl vor dem Modulaufruf als auch bei der Rückmeldung geprüft. Dazu wurden die vorhandenen vier gezielten Brückentests erneut ausgeführt.

## Ausgeführte Prüfungen

Umgebung: Linux, Node.js **v24.22.3**, OpenSSL **3.5.7**, installierte Laufzeitkomponenten unter anderem `bonjour-service` **1.4.4** und `ws` **8.22.0**. Temporäre Testidentitäten werden lokal erzeugt und gelöscht; es werden keine privaten Hersteller- oder Kundenschlüssel mitgeliefert.

```sh
node node_modules/typescript/bin/tsc -p modules/eebus/tsconfig.json
node --test \
  test/eos-module-host.test.cjs \
  test/eos-module-real-contract.test.cjs \
  test/eos-hosted-eebus-bridge.test.cjs \
  modules/devices/test/serialOperationGate.test.js \
  modules/eebus/test/security.test.js \
  modules/eebus/test/mdns-errors.test.js
```

Ergebnis dieses kombinierten Nachlaufs: **41 Tests bestanden, 0 fehlgeschlagen, 0 übersprungen**. Rohbeleg: `review-behavior-tests.log`. Die selbst erzeugte EEBus-Sicherheitsdatei prüft 18 Fälle, einschließlich tatsächlicher lokaler TLS-/WebSocket-Verbindungen. Drei zusätzliche Tests laden die tatsächlich ausgelieferten Modul-Factories gegen eine kontrollierte ioBroker-Datenbank-/Lizenzschnittstelle. Diese Datenbank- und Berechtigungsfixtures ersetzen keinen Test auf einem installierten ioBroker-Controller.

Der Quellbezug dieses Review-Snapshots steht in `review-source-sha256.txt`. Maßgeblich für das vollständige ausgelieferte Paket bleiben zusätzlich das abschließende Release-Manifest, die Builds und die Gesamtprüfberichte; Änderungen nach diesem Review-Snapshot erfordern eine passende Nachprüfung.

## Grenzen und offene Geräteabnahme

- Keine reale Wallbox, kein Wechselrichter, kein Zähler und kein CLS-Gerät wurden mit diesem Review bedient. Die SHIP-Tests prüfen echte lokale TLS-Verbindungen mit kontrollierten Peers; daraus folgt keine vollständige SHIP-/SPINE-/EEBUS-Konformität oder Herstellerfreigabe.
- Wirkliche serielle Ports, Feldbus-Störungen, elektrische Umsetzung und Timing auf der Hausanlage sind nicht nachgewiesen. Bestehende unabhängige Schutzfunktionen werden durch diese Softwaretests nicht ersetzt.
- Die gemeldeten rund 750 MB RAM wurden nicht auf dem Gerät gemessen. Dieser Review belegt keine konkrete RAM-Reduktion. Die bereits in 9.0.5 begrenzten EMS-Caches und die neuen Ressourcenbegrenzungen sind keine Messung des Gesamtspeicherbedarfs mit aktiven Geräten.
- `nexowatt.local` wird über mDNS angekündigt; der Kurzname `nexowatt` benötigt weiterhin passende lokale Namensauflösung. Reiner IPv6-Multicast wird von dieser neuen Ankündigung noch nicht unterstützt. Port 443, Zertifikatsvertrauen und reale Client-Erreichbarkeit sind getrennt einzurichten beziehungsweise abzunehmen.
- Der gesamte Codebestand wurde nicht formal verifiziert. Geprüft wurden die genannten geänderten Bereiche und unmittelbar betroffenen Grenzen. Die umfassenden Release-, Abhängigkeits-, UI- und Controllerprüfungen werden getrennt dokumentiert; dieses Dokument ersetzt sie nicht.
- Der Review enthält keine CRA-Konformitätserklärung, keine IEC-/OWASP-Zertifizierung und keine Aussage, dass sämtliche Fehler ausgeschlossen seien.

Im abschließend oben geprüften Änderungsbereich blieb aus diesem Review kein reproduzierter unbehandelter Freigabeblocker offen. Die aufgeführten Geräte- und Betriebsnachweise bleiben ausdrücklich ausstehend.
