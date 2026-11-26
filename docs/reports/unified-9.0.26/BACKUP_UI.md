# Sicherungsteile mit eigenen Einstellungsdialogen

Die bisherige lange Liste aller erweiterten Backupfelder wurde durch thematische Karten ersetzt. Jeder vorhandene Schalter für einen Sicherungsteil oder ein zusätzliches Speicherziel bleibt getrennt bedienbar. Der Kartentitel und die Schaltfläche „Einstellungen“ öffnen einen nativen Dialog mit den zugehörigen Feldern. Aktivierung, Verbindung und Zielpfad stehen zuerst, übernommene Spezialoptionen zuletzt. Die bisherigen Zahlen- und Zeitgrenzen bleiben als Formularprüfung erhalten.

Karten und die dauerhaft auffindbare Speicherleiste kennzeichnen geänderte Werte als **Noch nicht gespeichert**. **In Entwurf übernehmen** ändert ausschließlich den lokalen Entwurf. **Abbrechen**, Schließen und Escape verwerfen nur die Änderungen des gerade geöffneten Dialogs. Erst **Alle Einstellungen speichern** verwendet den bisherigen authentifizierten API-Pfad mit CSRF und unveränderter Konfigurationsrevision. Ein Statusrefresh erneuert den CSRF-Token, übernimmt aber weder eine fremde Konfiguration noch eine neue Revision in einen alten Entwurf.

Gespeicherte Geheimnisse werden als Marker übernommen, nicht als Klartext angezeigt. Ein leeres markiertes Feld erhält den bisherigen Wert. Nur eine bewusste Eingabe oder „Gespeicherten Wert löschen“ ändert diesen Wert im Entwurf; auch diese Änderung wird erst zentral gespeichert. Verschachtelte Arrays und Objekte bleiben strukturell erhalten. Ungültiges JSON verhindert das Übernehmen eines Dialogs.

## Fachliche Zuordnung

Die vollständige Zuordnung jedes einzelnen Schlüssels steht in [`raw/backup-ui/field-map.json`](raw/backup-ui/field-map.json). Alle **226** vorhandenen Defaultfelder gehören genau einer der **27** Gruppen an. Kein bekanntes Defaultfeld landet im Auffangdialog; dort erscheinen ausschließlich zusätzliche unbekannte Bestandsfelder. `enabled` bleibt die globale Modulfreigabe.

| Bereich | Karte / Schlüsselfamilie | Defaultfelder |
|---|---|---:|
| System und Zeitpläne | Automatische Systemsicherung: `minimal*`, `iobrokerCron*` | 7 |
| System und Zeitpläne | EOS-Profil: `eos*` | 3 |
| System und Zeitpläne | Automatische CCU-Sicherung: `ccu*` | 14 |
| Datenbanken | InfluxDB: `influxDB*` | 12 |
| Datenbanken | MySQL/MariaDB: `mySql*`, `mysql*` | 14 |
| Datenbanken | Zusätzliche PostgreSQL-Datenbank: `pgSql*` | 10 |
| Datenbanken | SQLite: `sqlite*` | 3 |
| Datenbanken | Redis: `redis*` | 9 |
| Anwendungen | Dateihistorie: `history*` | 3 |
| Anwendungen | Zigbee: `zigbeeEnabled` | 1 |
| Anwendungen | Zigbee2MQTT: `zigbee2mqtt*` | 9 |
| Anwendungen | Node-RED, Yahka, Jarvis, ESPHome | je 1 |
| Anwendungen | Grafana: `grafana*` | 6 |
| Speicherziele | Lokaler Ordner/NAS/SD: `cifs*`, `sdCard*`, Mountoptionen | 19 |
| Speicherziele | FTPS: `ftp*` | 13 |
| Speicherziele | WebDAV: `webdav*` | 11 |
| Speicherziele | Dropbox: `dropbox*` | 11 |
| Speicherziele | Google Drive: `googledrive*` | 8 |
| Speicherziele | OneDrive: `onedrive*` | 9 |
| Speicherziele | Wake-on-LAN: `wakeOnLAN`, `macAd`, `wol*` | 5 |
| Betrieb | Benachrichtigungen und Kanalpräfixe | 41 |
| Betrieb | Aufbewahrung und Laufzeit | 6 |
| Betrieb | Übernommene Betriebsoptionen | 8 |
| Betrieb | Weitere Bestandsoptionen | 0 bekannte Defaults |

Zusätzlich zugänglich sind die bereits vom Backend gelesenen Laufzeitfelder für maximale Laufzeit/Archivgröße, eingebundenen Zielordner, InfluxDB-Organisation/Bucket-ID, MQTT-Protokoll und OAuth-Zugänge. Vorhandene zusätzliche `sqliteMulti`/`sqliteEvents` und `redisMulti`/`redisEvents` bleiben in ihrer Datenbankgruppe; neue Mehrquellenfunktionen werden damit nicht eingeführt.

Die Schaltersemantik bleibt unverändert:

- `minimalEnabled` und `ccuEnabled` steuern automatische Zeitpläne. Die entsprechenden manuellen Sicherungsaktionen bleiben erhalten.
- `pgSqlEnabled` wählt eine zusätzliche PostgreSQL-Datenbank. Die aktive EOS-PostgreSQL-Historie bleibt separat automatisch Bestandteil der Gesamtsicherung.
- JavaScript-Objekte gehören weiterhin zum ioBroker-Archiv. Die übernommene JavaScript-Option wird nicht als Ausschluss dieser Objekte dargestellt.
- Speicherzielschalter wählen zusätzliche Kopien, keine Datenquellen.
- Benachrichtigungen verwenden weiterhin genau einen ausgewählten Kanal. Der Dialog zeigt nur dessen Felder; die Einstellungen anderer Kanäle bleiben gespeichert.

## Zustände und Ressourcen

„Backupmodul läuft“ bezeichnet den Modulprozess. Der darunter angezeigte Sicherungsumfang beurteilt gesondert, ob die Gesamtsicherung eingerichtet ist. `EOS_BACKUP_SOURCE_PATH` erhält eine verständliche Erklärung zu absoluten lokalen Pfaden und bereits eingebundenen NAS-/SD-Zielen. Es werden keine Pfade erfunden, Datenträger eingebunden oder Backend-Prüfungen umgangen.

Die umfangreichen Einstellungsfelder entstehen erst beim Öffnen eines Dialogs und werden beim Schließen wieder entfernt. Statuspolling aktualisiert weder Karten noch Dialogentwürfe. Es wurde kein zusätzlicher Polling-Timer hinzugefügt. Im Prüffall mit 228 Konfigurationseigenschaften steht anfangs nur ein Einstellungsfeld im DOM (die Modulfreigabe); ein geöffneter Dialog enthält maximal 20 Felder, nach dem Schließen verbleiben dort keine Felder. Die bisherige Oberfläche erzeugte die Editoren aller gespeicherten Werte gleichzeitig. Diese Zählung betrifft ausschließlich Einstellungsfelder, nicht sämtliche Karten-/Navigationsknoten; daraus wird keine Aussage über den RAM-Verbrauch des EOS-Prozesses auf dem Raspberry Pi abgeleitet.

## Prüfungen und Grenzen

Geänderte Produktdateien: `modules/backup/admin/index.html`, `index.js`, `style.css`. Strenger JavaScript-Typecheck: `tsconfig.eos-backup-admin.json`; ESLint: `eslint.backup-admin.config.mjs`. Der bestehende `test/eos-module-editor-revision.test.cjs` prüft weiterhin tatsächliche UI-Skripte mit CSRF-Erneuerung, Konflikten und unverfälschter Revision; alle vier Fälle bestanden. Das neue `test/eos-backup-settings-browser.cjs` prüft die Oberfläche im echten Chromium über die produktiven Modul-HTTP-Routen mit synthetischer Konfiguration, Authentifizierung und Host.

Die Browserdaten enthalten keine Kundenkonfiguration. Interne Prüfbilder werden nicht als Bestandteil der Lieferung abgelegt. Die Tests starten keine Sicherungen auf einer Kundenanlage, binden keine Datenträger ein und kontaktieren keine Anbieter. Der ergänzende echte Backup-Worker-/Host-Nachweis zu abgewiesenen Pfaden und Konfigurationserhalt wird separat im Backend-Arbeitspaket dokumentiert.

Finale Chromium-Nachweise: **10/10 Prüfgruppen unter Node 22.23.4 und 10/10 unter Node 24.22.3**, jeweils ohne PageErrors. Die Läufe am 25.11.2026 um 20:23:52 UTC und 20:24:04 UTC prüfen auch die abschließende Feldreihenfolge, alle sieben Zahlenbegrenzungen und den durch die Formularprüfung abgewiesenen Wert „0 Tage“. Quellhashes werden vor und nach jedem Browserlauf verglichen; beide Läufe blieben unverändert. Rohberichte: [`node22-browser.json`](raw/backup-ui/node22-browser.json) und [`node24-browser.json`](raw/backup-ui/node24-browser.json). Die 390-Pixel-Mobilansicht und die 1024-Pixel-Tabletansicht wurden zusätzlich visuell geprüft.

```sh
node node_modules/typescript/bin/tsc -p tsconfig.eos-backup-admin.json
node node_modules/eslint/bin/eslint.js -c eslint.backup-admin.config.mjs modules/backup/admin/index.js
node --test test/eos-module-editor-revision.test.cjs
EOS_CHROMIUM_PATH=/workspace/scratch/741f792566ea/implementation-922/browser-test-runtime/chromium node test/eos-backup-settings-browser.cjs
```
