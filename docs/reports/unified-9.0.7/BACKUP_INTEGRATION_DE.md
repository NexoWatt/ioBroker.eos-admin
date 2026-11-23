# Backup-Integration 9.0.7 – Änderungs- und Prüfvermerk

Stand: 23.11.2026. Dieser Bericht beschreibt den implementierten und softwaregeprüften Integrationsstand; keine pauschale Produktions- oder CRA-Freigabe.

## Quelle und Architektur

Eigene NexoWatt-Quelle: `NexoWatt-EOS-Backup-1.0.10-SD-RECHTE-FIX-FULL-REPOSITORY.zip`, SHA-256 `ece60a7b46a75c837f0e00d3ff134f08f7b99ac2cff055c1177a8d426066f590`. Originalschema, Lizenzhinweise und SD-Erkennung sind nachvollziehbar übernommen. Proprietäre Integrationslogik und MIT-Herkunftsanteile werden getrennt ausgewiesen; `modules/backup/provenance.json` enthält die verwendeten Laufzeitkomponenten.

Der bisherige Stand mit eigenem Adapterprozess, Shell-Mounts und zusätzlichem Restore-Webserver wurde als zentral lizenziertes und authentifiziertes EOS-Modul integriert. Das Modul verwaltet Einstellungen/Zeitplan im Hauptprozess. Archivierung, Cloudclients, MQTT und feste Datenbankprogramme laufen auftragsbezogen in einer beendbaren Prozessgruppe. Es wird keine zweite Lizenzabfrage und kein zweiter öffentlicher Listener eingeführt.

## Umgesetzter Umfang

Siehe vollständige Funktionsmatrix und Wartungsablauf in `modules/backup/README.md`. Enthalten sind Systemsicherung, private EOS-/HTTPS-/EEBus-/erhaltene UI-Identitäten, lokale Zusatzdateien, CCU, MySQL/PostgreSQL/SQLite/InfluxDB/Redis, Grafana, lokales/entferntes Zigbee2MQTT, SD-/eingebundene Ziele, FTPS/WebDAV/Dropbox/Google/OneDrive, kontrollierte Aufbewahrung, Altarchivimport, OAuth-Aktualisierungen, konfigurierte Benachrichtigungen und Wake-on-LAN.

Nicht unterstützte aktive Master-/Slave-, Expert-Mount-, beliebige Programm-, ungesicherte Transport- oder `ignoreErrors`-Betriebsarten scheitern vor der automatischen Übergabe. Der Altadapter bleibt zuständig. Deaktivierte Altstände behalten ihre Konfiguration, bis eine Aktivierung ausdrücklich erneut geprüft wird. Kundenspezifische Feldwerte werden nicht verworfen. Neue verschlüsselte Dateinamen verwenden UUID, Sicherungstyp und Index; alte Dateinamenssuffixe bleiben Konfigurationsmetadaten und alte Archive unverändert.

Der normale Controller bleibt Systemvoraussetzung. Das Modul ersetzt keinen Datenbankdienst, keine Betriebssystem-Mountverwaltung und keinen bereits konfigurierten externen Benachrichtigungsdienst. Vollständige Wiederherstellung erfordert geplante Wartung bei gestopptem Controller/EMS. Die enthaltene CLI authentifiziert/entschlüsselt und kann einen separat gehaltenen Wiederherstellungsschlüssel ohne Überschreiben einsetzen; sie führt keinen Archivinhalt aus.

## Sicherheits- und Ressourcenänderungen

- AES-256-GCM mit zufälligem geräteeigenem Schlüssel, 0600/0700-Dateien, Authentifizierungsprüfung, begrenzte Streams, exklusive/atomare Veröffentlichung ohne Überschreiben.
- Private TLS-/EEBus-Identitäten im verschlüsselten EOS-Profil; Wiederherstellungsschlüssel separat. OAuth-Cache und verschlüsselte Eigentumsnachweise für entfernte Aufräumregeln sind enthalten. Ein später rotierter oder beim Anbieter widerrufener OAuth-Stand kann nach älterer Wiederherstellung eine erneute Anbieteranmeldung erfordern.
- Vor jedem Controllerjob werden dessen kundenspezifische `common.dataFolder`-Pfade über eine fest begrenzte Hostfähigkeit gelesen und kanonisch gegen den privaten Backupordner geprüft. Überschneidung stoppt den Auftrag vor dem CLI-Aufruf. Das verhindert rekursives Mitsichern von Arbeitsdateien, Archiven oder Wiederherstellungsschlüssel in der unterstützten Konfiguration.
- Keine Shellinterpolation, keine root-/sudo-/Mount-Befehle im Modul. Nur feste Systemwerkzeuge und der installierte Controllerpfad; Datenbankpasswörter nicht in Kommandozeilen oder Fehlerausgaben.
- Status ohne private Schlüssel, Tokens oder signierte Cloud-URLs. History vor dem Lesen auf 4 MiB begrenzt; begrenzte Statusausgabe mit vollständiger Detailabfrage. Weitere Schutzgrenzen stehen im README.
- Startup/Shutdown-Fencing, gemeinsame Stop-Promise, bestmögliche Subscriptionbereinigung, sofortige Prozessgruppenkündigung, anschließende SIGKILL-Bereinigung auch nach frühem Worker-Exit; keine verwaisten laufenden Worker nach Parent-Disconnect.
- Aufräumen entfernter Ziele ausschließlich anhand authentifizierter, erfolgreicher eigener Uploads. Historische, fremde oder anders verschlüsselte Backups werden nicht automatisch gelöscht. Manuelle Aufträge räumen keine alten Sicherungen auf.
- Lokaler freier Speicher wird vor und während Aufträgen geprüft. Klartext-Arbeitsdateien bleiben nur zeitweise privat; reguläres Ende/Abbruch und nächster Start bereinigen verwaiste Auftragsordner. Derselbe Betriebssystembenutzer und unverschlüsselte Datenträger bleiben eigene Schutzgrenzen.

## Ausgeführte Verifikation

Umgebung: Linux, Node.js v24.22.3. Alle Tests verwenden kurzlebige, lokal erzeugte Testschlüssel und Testdateien; kein Produktionsgeheimnis wurde verwendet, keine reale Kundenanlage verändert und keine Nachricht versendet.

| Prüfung | Ergebnis / Beleg |
| --- | --- |
| Lokales Prettier auf eigenen neuen Quellen/Admin-Dateien | Erfolgreich, `backup-format.txt`; unveränderte Herkunftsdateien ausgenommen |
| Striktes TypeScript-Profil einschließlich exact optional/noUncheckedIndexedAccess | Erfolgreich, `backup-typecheck.txt` (keine Diagnose) |
| Vollständiges type-aware ESLint für alle eigenen Backup-TS-Dateien | Erfolgreich, `backup-type-aware-lint.txt` (keine Diagnose); `modules/backup/eslint.config.mjs` |
| Admin-JavaScript-Syntax | `node --check modules/backup/admin/index.js`, Exit 0 |
| Gesamte Backup-Suite | **51 bestanden, 0 fehlgeschlagen**, `backup-module-tests.tap` |
| Unabhängige Teilprüfungen | `BACKUP_FILE_REVIEW_DE.md`, `BACKUP_EXTRAS_REVIEW_DE.md`, `BACKUP_HTTP_REVIEW.md`, `BACKUP_STORAGE_PRUEFUNG.md` |

Die 51 Tests umfassen unter anderem tatsächlichen Kindprozess mit CLI-Testfixture, verschlüsselte Streams und Authentifizierungsfehler, 64-MiB-Roundtrip, Symlink-/Pfad-/Überschreibschutz, Downloadgrenzen, Dateideskriptorbereinigung, Prozessgruppen mit SIGTERM-ignorierendem Enkelprozess, Startup/Stop-Rennen, fehlgeschlagenes Unsubscribe, synchrones Fork-Versagen, begrenzte History, Controller-dataFolder-Überschneidung, Offline-Keyinstallation, verschlüsselte OAuth-Rotation, eigene/fremde Cloud-Aufräumrechte, lokale MQTT- und HTTP-Transporte, Grafana-Archivinhalt, Cloudpaginierung und Nachrichtenvalidierung.

Das synthetische 64-MiB-Streamingexperiment zeigt begrenztes JavaScript-Heapwachstum, ist aber keine RAM-Messung des vollständigen EOS-Geräts. CPU-/RSS-Verhalten, reale Cloudkonten, Datenbankdienste, CCU, SD-Hardware und vollständige Wiederherstellung auf Ersatzhardware sind vor Kundeneinsatz separat abzunehmen. Ein Node-22-Lauf und ein installierter Controllerlauf gehören zum übergeordneten Release-Prüfbericht, nicht zu diesem lokalen Modulnachweis.
