# NexoWatt EOS 9.0.6 – Integration und Stabilitätsprüfung

Stand: 23.11.2026. Ausgangspunkt: die vom Nutzer als funktionierend bestätigte
9.0.5. Zielplattform: eine ioBroker-Instanz `eos-admin.N`, Node.js 24;
Validierung hier mit Node.js 24.22.3 und ioBroker Controller 7.2.5.
Diese Lieferung ist ein Integrationsteststand für `next`, keine Serienfreigabe
und keine CRA-Konformitätserklärung.

## Ergebnis und Änderung

- Geräteadapter 0.5.176 und EEBus 0.3.0 wurden als interne Module integriert.
  Herkunft, ursprüngliche proprietäre Lizenzen und Änderungen sind in den
  jeweiligen `modules/*/provenance.json` nachvollziehbar. Kein zusätzlicher
  Adapterprozess und keine zusätzliche Lizenzaktivierung.
- Der zentrale Host prüft Lizenz und ausschließliche Geräteverantwortung.
  Laufende, aktivierte oder nicht sicher gestoppte Altinstanzen blockieren die
  neue Ausgabe. Konfigurationsimport bleibt deaktiviert, erhält die Altinstanz
  und zeigt geänderte Datenpunktpfade. EEBus verlangt erneutes Pairing.
- Admin-APIs erfordern aktuelle Sitzung, Adminrolle, passende Origin und CSRF.
  Konfiguration wird verschlüsselt gespeichert; Geheimnisse bleiben in
  Webantworten maskiert und werden anhand stabiler Geräte-IDs erhalten.
- Der Installer hat Rückwege zur Systemverwaltung und zum Dashboard. Die
  markierte Navigation hat zwei Bereiche und umbricht responsiv. Geräte- und
  EEBus-Seiten sind funktional; slashlose Modulpfade werden normalisiert.
- EOS kündigt seinen lokalen Namen `nexowatt.local` selbst an. Port 443 wird durch
  separat zu installierende systemd-Vorlagen vorbereitet. Der laufende Adapter
  erhält dafür keine Rootrechte/Capabilities. Bare `nexowatt` ist nicht in jedem
  Netz durch mDNS auflösbar; Zertifikat und Client-Vertrauen bleiben erforderlich.

## Konkrete behobene Fehler und Grenzen

Die bestehende History-/Express-Grenze und begrenzte History-Verarbeitung bleiben
erhalten. Zusätzlich wurden verzögerte serielle Ausgaben nach Lizenzentzug,
Wiederverbindungs-Deadlocks gemeinsamer serieller Warteschlangen und unvollständiges
MQTT-Cleanup korrigiert. HTTP/TA-CMI verwenden eine gemeinsame Frist, wirklichen
Request-Abbruch, Antwortgrenzen und geprüfte TLS-Verbindungen. Auch ein Fristablauf
an einer Zeitrundungsgrenze darf keine nächste Anfragegruppe starten.

Im übernommenen EEBus-Kern wurden die Bindung an das tatsächlich vorgelegte
TLS-Zertifikat, ausdrückliche Kopplung, Handshake-/PIN-Reihenfolge, Widerruf,
Verbindungsrennen und mDNS-Fehlerbehandlung abgesichert. Keine SPINE-Daten vor
abgeschlossenem vertrauenswürdigem Handshake. Geräteidentitäten liegen nur im
privaten Installationsspeicher. Die interne §14a-Bridge nutzt eine nicht über
serialisierte Adapter-Nachrichten kopierbare lokale Capability und prüft die
aktuelle Freigabe erneut.

Bereits gesendete Gerätebefehle können nicht zurückgerufen werden. Bei entzogener
Freigabe ist auch ein optionaler abschließender MQTT-Schreibwert gesperrt;
Transport und Timer werden trotzdem geschlossen. Geräteeigene Watchdogs und
unabhängige Schutzfunktionen müssen für die konkrete Anlage eingerichtet sein.
Die übernommenen EEBus-Funktionen bleiben ein SHIP/SPINE-Feldtestkern und sind
keine Behauptung vollständiger EEBus-Zertifizierung oder beliebiger Gerätekompatibilität.

## Ausgeführte Prüfungen

| Bereich | Ergebnis / Nachweis |
| --- | --- |
| Hauptsuite `npm test` mit tatsächlichem Keygen 1.0.4 | Unified: 368 bestanden, 2 Umgebungs-Skips; retained: 48 bestanden; Module: 254 bestanden. Kein Testfehler im abschließenden Lauf. |
| NVP / dynamischer Netzanschluss | 208 Tests bestanden; passende Typprüfung bestanden. |
| §14a | Vorhandener Direkt-API- und Kommunikationsfallback-Test bestanden; zusätzliche interne Bridge-Tests sind in der Hauptsuite enthalten. |
| Admin-/Installer-Navigation | 10 Tests bestanden; beide Frontend-Typechecks und Builds bestanden. |
| EEBus-Fachregressionen | Vier übernommene Prüfscripte bestanden; echte lokale TLS-/WebSocket-Tests in der Modulsuite enthalten. |
| Lizenz | Tatsächlicher Keygen 1.0.4 → HTTPS-Import → Aktivierung → verschlüsselte Speicherung → Neustart bestanden. Neue Testidentitäten, keine Produktions-Privatschlüssel. |
| Backend / Module | TypeScript-Builds bestanden; neue Devices-Grenzen separat mit `checkJs` geprüft. Backend-Lint und gezielte JS-Regeln bestanden. |
| Lokale Erkennung | Probing, Namenskonflikt, Adresswechsel, Socket-/Sendefehler und Cleanup mit kontrolliertem Transport geprüft; echter DNS-Paketcodec mitgeprüft. |
| 443-Vorbereitung | systemd-Units mit `systemd-analyze verify` geprüft; kein produktiver OS-Dienst installiert oder gestartet. |
| Dokumentation | 276 deutsche UI-Modulbeschreibungen und Verknüpfungen synchron geprüft. |
| Paket / ZIP | Abschließender Paketvergleich und frische Extraktion stehen in der mitgelieferten `NexoWatt_EOS_9.0.6_Lieferpruefung.json`. |

Der ausführliche echte Controller-Lauf wird im Abschnitt unten getrennt bewertet.
Kontrollierte Adapter-/DB-/Lizenzfixtures in Unit-Tests sind keine Hardware- oder
Controller-Nachweise. Das zusätzliche Teamreview ist eine unabhängige
KI-Zweitprüfung, kein externer Penetrationstest oder Zertifizierungsaudit.

## Abhängigkeiten und Lieferkette

Die benötigten vorhandenen Protokollbibliotheken wurden gezielt übernommen und
festgeschrieben: modbus-serial 8.0.25, mqtt 5.16.1, serialport 12.0.0,
bonjour-service 1.4.4 und multicast-dns 7.2.5. ws/axios bleiben im zentralen
Abhängigkeitsbaum. Die SerialPort-Nativbindung ließ sich auf der Testplattform
laden; die Raspberry-Pi-/serielle Hardwareabnahme ist davon getrennt.

`npm audit` meldete für die ausgelieferten Runtime-Abhängigkeiten **0** bekannte
Befunde, ebenso für Frontend und Installer **0**. Im vollständigen
Backend-Entwicklungsbaum verbleiben **14 moderate**, im historischen eigenständigen
UI-Entwicklungslock **12 moderate** Befunde (keine hohen/kritischen). Betroffen sind
Entwicklungswerkzeuge bzw. deren esbuild/glob/minimatch-Abhängigkeiten, nicht die
Runtime-Closure. Die relevanten Pfade sind lokale Build-/Testmuster; es wurde kein
Entwicklungsserver ausgeliefert oder betrieben. Ein pauschales `audit fix --force`
mit inkompatiblen Downgrades wurde nicht eingesetzt. Vor einem fremdzugänglichen
Entwicklungs-/Builddienst sind diese Befunde gesondert zu beheben.

Quellen der Abhängigkeitsbewertung (23.11.2026):
[esbuild](https://github.com/advisories/GHSA-67mh-4wv8-2f99),
[glob](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4),
[minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249).
Die Rohdaten der vier getrennten Auditbereiche liegen bei.

Die Runtime-SBOM enthält die tatsächlich ausgewählten Produktionsabhängigkeiten,
den unverändert geprüften vendorten Webserver und die beiden integrierten
proprietären Modulbäume. Source-/Build-Hashes und Fremdlizenzen bleiben erhalten.
Vendorte Fremdbytes werden nicht für Formatierungsregeln umgeschrieben; die
Provenienzprüfung kontrolliert ihre exakten Bytes. Deklarationsbegleitete
JavaScript-Grenzen werden mit dem eigenen ausführbaren JS-Lintprofil geprüft.
Release-Gates prüfen nur und verändern beim Packen/Publizieren keinen Quellstand.

## Noch am Zielgerät abzunehmen

- Reale Geräte/Protokolle, korrekte Einheiten und Vorzeichen, Aktualität,
  Rückmeldung nach Stellgrößen, sichere Timeout-Werte und konfliktfreie Umschaltung.
- Sichtprüfung der Navigation/Editoren in einem Browser: Chromium wurde in dieser
  Umgebung beim IPC-Socket mit `EPERM` beendet. Das ist keine bestandene visuelle Prüfung.
- mDNS aus dem tatsächlichen Kundennetz, individuelle Zertifikats-SANs und Vertrauen,
  Einrichten/Prüfen von 443. IPv6-only-Multicast ist vom UDP4-Erkennungstransport
  noch nicht abgedeckt. Name/Port bleiben über IP:8188 diagnostizierbar.
- RAM/CPU und Dauertest unter identischer Anlagenlast. Es wird keine bezifferte
  Einsparung gegenüber den gemeldeten 750 MB behauptet. Geräteprofile laden bei
  Bedarf; Queues, Sessions und Antworten sind begrenzt.
- Der Nginx-Syntaxtest und POSIX-ACL-Vererbungstest wurden mangels `nginx` bzw.
  `setfacl` übersprungen. Keine Betriebssystemrechte wurden hierfür aufgeweicht.

## Unterlagen

[Update und Abnahme](../../start/START_HIER_9.0.6.md),
[Modularchitektur](../../unified/MODULES_9.0.6.md),
[Geräteübernahme](../../../modules/devices/README.md),
[EEBus-Integration](../../../modules/eebus/docs/INTEGRATION_9_0_6_DE.md),
[lokaler HTTPS-Zugang](../../../deploy/NEXOWATT_LOCAL_HTTPS.md),
[Teamreview](read-only-review.md).

## Echter ioBroker-Controller und Installation

Der abschließende Lauf von `test/integration-unified.cjs` installierte das
geprüfte npm-Paket unter Controller 7.2.5 und startete einen echten Adapterprozess:
**13 Prüfungen bestanden, 2 umgebungsbedingt offen**. Enthalten waren Start,
Zustandsburst ohne Socketclient, TLS-/Host-Prüfung einschließlich nexowatt und
nexowatt.local, Login, neue Modulseiten/Assets, CSRF, Abmeldung, Stop und Neustart
gegen dieselbe Datenbank. Die Konfiguration des vorhandenen Admin:8081 blieb
unverändert. Der alte Admin war eine aktivierte Datenbank-Recovery-Fixture,
kein gleichzeitig laufender Admin-Webserver.

Die beiden offenen Controllerfälle betreffen den erfolgreichen Import eines
Hersteller-Prüfschlüssels: `/` und `/etc` gehören in dieser Entwicklungsumgebung
nicht POSIX-root. Der produktive Vertrauensschutz meldete deshalb korrekt
`TRUST_PERMISSIONS`. Die Rechteprüfung wurde nicht abgeschaltet. Erfolgreiche
Keygen-/Import-/Lizenzpersistenz wurde separat mit tatsächlichem HTTPS und
expliziten Test-Vertrauensgrenzen nachgewiesen, nicht als voll lizenzierter
Hardware-/Controller-Regelbetrieb ausgegeben.

TLS-Tests mit Host `:443` prüfen Authority/Sitzung am echten 8188-Listener;
sie ersetzen keinen auf dem Ziel installierten 443-Proxy. Die lokalen
Controllerwarnungen über fehlende Repositories/Host-Informationen sind
Testumgebungsgrenzen. Unbehandelte Prozessabbrüche traten im abschließenden
Controllerlauf nicht auf.

Die erste Paketprüfung während laufender Teiländerungen wurde vom unveränderlichen
Hash-Gate korrekt verworfen. Erst nach abgeschlossenem Quellstand, erneuter
expliziter Versiegelung und erfolgreich wiederholtem Controllerlauf erfolgte die
Lieferung. Die endgültige Paketprüfung erfolgt nochmals nach Aufnahme der
Nachweisdateien. Nach dem Teamreview hinzugekommene Abschlusskorrekturen
(HTTP-Fristgrenze, Slash-Weiterleitung, UI-Ladezustände und Formatierung/Type-Import)
sind durch die jeweiligen Regressionen bzw. den anschließenden Controllerlauf
abgedeckt; die Review-Hashliste dokumentiert ihren ursprünglichen Prüfzeitpunkt.
