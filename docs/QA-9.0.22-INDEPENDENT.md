# Unabhängige Teilprüfung: EOS 9.0.22

Stand: 25.11.2026. Dieser Bericht beschreibt eine zusätzliche Quellcodeprüfung und tatsächlich ausgeführte isolierte Tests. Er ist keine Freigabe einer Kundenanlage, kein Nachweis einer vollständigen Systemwiederherstellung und keine CRA-Konformitätserklärung. Der abschließende Releasebericht und dessen Prüfsummen legen den ausgelieferten Stand fest.

Nach der letzten Umfangsentscheidung bleibt die Fremdbedienung bei den normalen ioBroker-Datenpunkten. Eine zusätzliche EOS-Integrations-API, Zugangstoken oder zusätzliche Datenpunkt-ACLs sind nicht Teil der Auslieferung. Zwischenzeitliche Prüfungen einer solchen Erweiterung gelten daher nicht als Nachweis für den ausgelieferten Stand und sind hier nicht aufgeführt.

## Tatsächlich ausgeführte Prüfungen

| Gegenstand | Ausführung | Ergebnis und Aussagegrenze |
| --- | --- | --- |
| Lokale PostgreSQL-Historie | Echter PostgreSQL 17.12, offizielles Debian-13-Paket; Node.js 22.23.4 und 24.22.3; `test/eos-postgres-real-integration.cjs` | 9/9 Tests je Lauf, keine ausgelassenen Tests. Echte TCP/TLS-Verbindungen, SQL-Abfragen, Datenbankrechte und Sicherungsprogramme. |
| Kunden-Updater | Fünf bestehende `eos-customer-update-*.test.cjs`-Suiten mit Node.js 22.23.4 und 24.22.3 | 62/62 je Lauf. HTTPS-/Prozess-Fixtures und Konfigurationsschutz; keine Installation eines Updates auf einer echten ioBroker-Anlage. |
| Generierter Partner-WebSocket-Code | `test/eos-runtime-interop.test.cjs` mit echtem CommonJS-Paket `ws` und simuliertem Socket | Prüft den tatsächlich ausgelieferten JavaScript-Import und den Sendepfad einschließlich abgewiesener Freigabe; kein externer Partnerzugriff. |

Die PostgreSQL-Prüfung verwendet unveränderte produktive Rollen- und Schemafunktionen, den produktiven Historienclient sowie den produktiven PostgreSQL-Backup-Exporter und dessen begrenzten Prozessläufer. Nur die Pfade der ausgepackten Programme, die Test-CA und das Einlesen des Testprofils werden eingespeist. Die Prüfung installiert weder Systempakete noch Dienste und verändert keine Kundenanlage.

Die Testumgebung erlaubt keine Unix-Sockets. Daher erfolgt ihre administrative Einrichtung über eine temporäre, authentifizierte TLS-Verbindung. Der produktive Peer-Zugang des separaten Wartungskontos und die systemd-Härtung wurden dadurch **nicht** praktisch geprüft.

### PostgreSQL-Nachweise

- TLS 1.3 tatsächlich ausgehandelt. Klartext, fremde CA, falscher Gegenstellenname, abgelaufenes Serverzertifikat und falsches Passwort werden abgewiesen.
- `listen_addresses` ist im laufenden Server ausschließlich `127.0.0.1`. Eine Verbindung über eine echte LAN-/WAN-Schnittstelle wurde nicht geprüft: Die Testumgebung verweigert bereits das Auslesen der Netzwerkinterfaces.
- Laufzeit- und Backupkonto besitzen keine Superuser-, Rollen-, Datenbankerstellungs- oder Replikationsrechte. DDL, Löschzugriffe, Rollenübernahme, temporäre Tabellen und Zugriffe auf eine andere EOS-Datenbank beziehungsweise die Wartungsdatenbank werden abgewiesen.
- Zahlen einschließlich negativer Werte und Null, Boolean und Text einschließlich SQL-Sonderzeichen werden korrekt geschrieben und gelesen. Mittelwert, Anzahl, Min/Max, vorhandene Zeitstempel und Upserts wurden mit echten Daten geprüft.
- Zwei Werte desselben Datenpunkts mit identischem Millisekunden-Zeitstempel führen zu einem definierten letzten Wert und verwerfen nicht den gesamten Schreibblock.
- Eine absichtlich gesperrte Tabelle löst die kurze Anfragedeadline aus. Die blockierte Verbindung wird verworfen; nach Freigabe funktionieren Folgeabfragen.
- Der produktive Exporter erstellt mit dem separaten Lesekonto einen privaten PostgreSQL-Dump. Eine falsche CA verhindert den Export und hinterlässt keinen vermeintlich vollständigen Dump.
- Wiederherstellung in eine separate Datenbank mit Schema aus den vertrauenswürdigen Einrichtungsvorlagen: ausschließlich `eos_history.samples` als Daten importiert. Die Restore-Verbindung verwendet ein eigenes Konto ohne Superuserrechte, mit ausschließlich Verbindungs-, Schema-Nutzungs-, Tabellenlese- und Einfügerechten. Alle bekannten Typen und Werte stimmen anschließend mit der Quelle überein. Rollen, Kennwörter oder Schema werden nicht aus dem Archiv übernommen.
- Erneutes Ausführen der Schemaeinrichtung erhält Messwerte und Rechte. Ein echter PostgreSQL-Neustart erhält die Daten; neue Historienclients können danach weiter aufzeichnen.

## Quellcodebefunde und Korrekturen

| Befund | Umsetzung nach der unabhängigen Prüfung |
| --- | --- |
| Doppelte `(id, ts)`-Paare innerhalb eines PostgreSQL-Upserts können einen gesamten Block scheitern lassen. | Alle Eingaben validieren, anschließend pro Paar den letzten Wert verwenden; realer Datenbanktest ergänzt. |
| Die dedizierten Laufzeitkonten erbten Standardrechte auf Wartungsdatenbanken. | Öffentliche Rechte auf `postgres`, `template0` und `template1` im eigenen Cluster entzogen; tatsächliche Zugriffsverweigerung geprüft. |
| Systemprofile benötigen einen dauerhaften Verzeichniswechsel. | Datei und Elternverzeichnis werden nach atomarem Ersetzen synchronisiert. |
| Unterbrochene Erstbereitstellung darf keine vorhandenen Daten blind neu initialisieren. | Expliziter unvollständiger Setupzustand; dokumentierte Wartungsbehandlung. Fertige Einrichtung ist wiederholbar. |

Die Prüfung der generierten Dateien `partner-runtime`, `partner-websocket`, `runtime-proxy-html` und `ui-access-policy` zeigte unveränderte fachliche TypeScript-Quellen gegenüber 9.0.21. Die JavaScript-Abweichungen betreffen Compiler-Hilfen für CommonJS-Imports. Der bisherige direkte Zugriff auf `require('ws').default.OPEN` wurde mit dem echten Paket als Fehler reproduziert; der standardmäßige TypeScript-Interop-Wrapper behebt diesen Import. Der generierte Sendepfad besitzt deshalb einen zusätzlichen Regressionstest. Für die Freigabe muss die kanonische Runtime-Erzeugung diesen Import ebenfalls dauerhaft korrekt erzeugen.

Der vorhandene Kunden-Updater ist auf ein freigegebenes EOS-Paket und den eigenen Adapter beschränkt. Er ist kein allgemeiner Root-Befehlsdienst. PostgreSQL-Bereitstellung auf einem noch unvorbereiteten Betriebssystem erfordert weiterhin den begrenzten administrativen Einrichtungsschritt. Die Update-Konfigurationskopie ersetzt keine vollständige Datenbank-/Systemsicherung.

## Offene Anlagenabnahme

Folgende Punkte können aus diesen isolierten Tests nicht als bestanden abgeleitet werden:

1. Administrative Paketbereitstellung, systemd-Dienst, Peer-Wartungszugang und Host-Neustart auf dem unterstützten Zielbetriebssystem.
2. Ein externer Verbindungsversuch gegen die Datenbank aus einem anderen Gerät sowie Firewall-/Routingbedingungen der konkreten Anlage.
3. Vollständiger Wiederaufbau einer separaten ioBroker-/EOS-/Historienanlage einschließlich Benutzer, Systemgeheimnis, Geräteidentitäten und abschließender Gerätefreigabe. Der hier geprüfte PostgreSQL-Restore ist nur dessen Datenbankteil.
4. Verhalten bei echtem Datenträgervollstand und Stromausfall sowie mehrtägiger Betrieb unter der Zielanlagenlast.
5. Wirkliche Wallboxbedienung über eine Integrationsbridge mit RFID-, Netzanschluss-, Offline- und konkurrierenden Bediengrenzen. Ein angenommener EMS-Wunsch ist keine nachgewiesene Hardwarewirkung.

Gleichberechtigte Betriebssystemprozesse und ioBroker-Adapter mit administrativen Datenbankrechten bilden eine gemeinsame Vertrauensgrenze. Zustands-ACLs sind keine Isolation gegen einen kompromittierten administrativen Adapter. `ack` und `from` ersetzen keine Authentifizierung.

Die Sicherung besteht aus nacheinander aufgenommenen Controller-, EOS- und Datenbankständen; sie ist kein global atomarer Schnappschuss aller laufenden Anlagenkomponenten. Die Offline-Wiederherstellung übernimmt weder fremde Root-Vertrauensanker noch privilegierte Datenbankschemata aus dem Archiv. Die Optionen `--data-only` und die Auswahl einer Tabelle sind allerdings keine Sandbox gegen ein bösartig erzeugtes PostgreSQL-Archiv. Nur authentifizierte Sicherungen einer vertrauenswürdigen Quelle nach Inhaltsprüfung wiederherstellen; eine Verbindung als Datenbank-Superuser bleibt ausgeschlossen, auch mit zusätzlichem `--role`.

## Reproduktion der PostgreSQL-Prüfung

Voraussetzungen: unprivilegierter Benutzer, freie lokale TCP-Adresse `127.0.0.1:55432`, PostgreSQL-17-Programme, OpenSSL mit `x509 -not_before/-not_after` und die installierten Repository-Abhängigkeiten. Bei ausgepackten Betriebssystempaketen zusätzlich den zugehörigen Share- und Bibliothekspfad setzen.

```sh
EOS_TEST_PG_BIN=/pfad/postgresql/17/bin \
EOS_TEST_PG_SHARE=/pfad/share/postgresql/17 \
LD_LIBRARY_PATH=/pfad/zu/den/testbibliotheken \
node --test test/eos-postgres-real-integration.cjs
```

Die Datei wird bewusst separat ausgeführt. Ein normaler Testlauf ohne PostgreSQL-Umgebung darf ihren übersprungenen Lauf nicht als erfolgreichen Datenbanknachweis zählen.

## Primärquellen

- PostgreSQL: [Server-TLS-Konfiguration](https://www.postgresql.org/docs/17/ssl-tcp.html), [Zertifikatsprüfung und verify-full](https://www.postgresql.org/docs/17/libpq-ssl.html), [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html).
- ioBroker: [offizielle Adapterentwicklungsdokumentation](https://github.com/ioBroker/ioBroker.docs/blob/master/docs/en/dev/adapterdev.md).
