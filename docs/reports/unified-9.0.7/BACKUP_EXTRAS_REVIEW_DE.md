# Ergänzende Sicherungsfunktionen und Benachrichtigungen

Stand: 23.11.2026, Node.js 24.22.3 / Linux x64. Grundlage: NexoWatt Backitup 1.0.10, insbesondere `34-zigbee2mqtt.ts`, `36-grafana.ts`, `96-*.ts` und deren tatsächliche Konfigurationszuordnung in `main.ts`. Implementierung: `modules/backup/src/extras.ts`, `notifications.ts`; Einbindung durch den Backup-Modulhost.

## Verhalten

- **Grafana:** vorhandener Host/Port/Protokoll/API-Schlüssel bleiben wirksam. Datenquellen, Ordner, Dashboard-Ordner-Zuordnung sowie Dateien für automatische und manuelle Dashboard-Wiederherstellung werden gesammelt. Die Verzeichnisstruktur des bisherigen Grafana-Archivs bleibt erhalten. Dateinamen werden aus sicheren Zeichen und einem Identitätshash gebildet; API-Titel erzeugen keine Verzeichnispfade. Dashboard-IDs werden wie bisher für Wiederherstellung auf `null` gesetzt. Die paginierte Suche erfasst auch Einträge jenseits der ersten Seite. Jeder API-Aufruf hat höchstens 5 Sekunden, die Sammlung insgesamt 120 Sekunden; höchstens 8 MiB je JSON-Antwort und 64 MiB Gesamtantworten. Maximal 10.000 Ordner bzw. Dashboards. Ein Überschreiten oder Teilfehler schlägt den Lauf ausdrücklich fehl; kein unvollständiges Grafana-Archiv wird veröffentlicht. HTTPS prüft Zertifikat und Namen; HTTP bleibt ausschließlich für explizit so konfigurierte bestehende lokale Grafana-Installationen erhalten. Keine Redirects, keine automatischen Proxy-Umgebungsvariablen.
- **Remote-Zigbee2MQTT:** bestehende Host-, Port-, Basis-Topic- und Zugangsdaten werden übernommen; lokaler Verzeichnismodus bleibt beim bisherigen Dateisicherer. Remote wird zuerst abonniert, dann eine Backup-Anfrage mit eindeutiger Transaktion gesendet. Antwort muss zur Transaktion gehören und erfolgreich sein. Retained-Antworten und andere Transaktionen werden verworfen. 60 Sekunden Gesamtfrist einschließlich Verbindungsaufbau und Antwort; keine Wiederverbindungsschleife. Das resultierende originale ZIP bleibt ZIP. 16 MiB maximale ZIP-Größe; MQTT-Längenfelder werden bereits vor dem MQTT-Parser geprüft, bevor dieser einen großen Nachrichtenkörper puffert. Der Worker schließt Client und TCP-Socket auf Erfolg und Fehler. MQTT über TCP bleibt für bestehende lokale Konfigurationen möglich; optionaler `zigbee2mqttProtocol: "mqtts"` verwendet geprüfte TLS-Verbindungen. Das Backup verändert keine Zigbee-Geräte oder deren Konfiguration.
- **Benachrichtigungen:** Telegram, E-Mail, WhatsApp, Gotify, Signal, Matrix, Discord und Pushover verwenden den jeweils vorhandenen konfigurierten ioBroker-Nachrichtendienst. Empfänger, Telegram-Benutzer, Discord-Ziel, Pushover-Gerät, Stummmodus, Nur-Fehler-Auswahl sowie Wartezeit werden berücksichtigt. Die Queue ist auf 32 Nachrichten und die Wartezeit auf 3.600 Sekunden begrenzt; Stoppen verwirft ausstehende Nachrichten. Für Discord wird die bisher wirkungslose Nur-Fehler-Auswahl jetzt tatsächlich berücksichtigt. Ein fester Klartextstatus enthält keine Rohfehler, Passwörter, API-Schlüssel, Dateiinhalte oder Zugangsdaten. Lange Meldungen nennen Zielarten, keine Zieladressen. Der Modulhost prüft den ausgewählten Zieladapter, Befehl, Empfänger, Payloadschema und die aktuelle Betriebsfreigabe unmittelbar vor dem Versand; keine allgemeine `sendTo`-Berechtigung. Ein Versandfehler macht ein bereits erfolgreich geschriebenes Backup nicht ungültig.

MQTT und Axios werden erst im kurzlebigen Backup-Worker geladen. Die Benachrichtigungsqueue im Hauptprozess lädt keine dieser Netzwerkbibliotheken. Begrenzte Sicherungsaufträge laufen außerhalb des EMS-Heaps.

## Nachweise

`backup-extras-tests.tap`: **9/9 bestanden**, darunter tatsächlicher lokaler TCP/MQTT-Austausch mit Authentifizierung und Socket-Abbau, tatsächliche HTTP-Redirect-Ablehnung, MQTT-Gesamtfrist mit kontrollierter Testuhr, Rahmenbegrenzung bereits am Header, tatsächliche Tar-Inhaltsprüfung nach simulierten Grafana-API-Antworten, sichere Fehlerbereinigung, alle acht Nachrichtenschemas, fremde Empfänger/Befehle, Queue-Abbruch und widerrufene Berechtigung. Alle Benachrichtigungssender waren Mocks; es wurden keine echten externen Nachrichten verschickt.

Gemeinsamer erneuter Prüflauf einschließlich Datei-, Modulhost- und Lebenszyklustests: `backup-independent-review-tests.tap`, **28/28 bestanden**. Darin enthalten: vollständiger kurzer Sicherungsworker mit Controller-Testfixture, Abbruch von Worker und geerbten Kindprozessen sowie Bereinigung privater temporärer Dateien. Das sind lokale Tests, keine produktive Anlagenwiederherstellung.

Typprüfung: `node_modules/.bin/tsc -p modules/backup/tsconfig.json --noEmit`.

Typgestütztes Linting der neuen Zusatzfunktionen: `node_modules/.bin/eslint -c modules/backup/eslint.extras.config.mjs modules/backup/src/extras.ts modules/backup/src/notifications.ts`; Protokoll `backup-extras-lint.log`.

## Grenzen und Abnahme

Die lokalen Protokolltests ersetzen keine Sicherung/Wiederherstellung einer Kundeninstallation. Grafanas Datenquellen-API gibt bestehende verschlüsselte Geheimnisse nicht als Klartext aus; deren vollständige Wiederherstellung erfordert wie bisher die separat gesicherte Konfiguration bzw. erneute Bereitstellung der Zugangsdaten. Zugriff auf alle gewünschten Ordner/Dashboards setzt ausreichende Rechte des Grafana-Servicekontos voraus; unsichtbare Ressourcen können über dessen API nicht gesichert werden. Große Bestände außerhalb der expliziten Grenzen führen zu einem sichtbaren Fehler und müssen vor Migration bewertet werden. Der Grenzfall vollständiger Worker-Abbruch wird zusätzlich durch die Prozessgruppen-/Auftragsverwaltung des Backup-Moduls behandelt.

Primärquellen für das verwendete Protokoll, abgerufen am 23.11.2026:

- https://www.zigbee2mqtt.io/guide/usage/mqtt_topics_and_messages.html — Backup-Topic, Base64-ZIP, Status und Transaktionskorrelation.
- https://grafana.com/docs/grafana/latest/developer-resources/api-reference/http-api/api-legacy/folder_dashboard_search/ — Suchtyp, Pagination und sichtbare Ressourcen gemäß Berechtigungen. Bestehende `/api`-Endpunkte werden laut aktueller Dokumentation weiterhin betrieben.

Diese Nachweise sind technische Entwicklungsprüfungen und keine CRA-Zertifizierung oder Zusicherung einer fehlerfreien Anlage.
