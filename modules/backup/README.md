# NexoWatt EOS Sicherung

Die eigene NexoWatt-Sicherung ist als Modul integriert. Ein separater `ioBroker.backitup`- oder `iobroker.nexowatt-backup`-Prozess wird für die unterstützten Betriebsarten nicht benötigt. Der ioBroker-Controller bleibt die Systembasis; sein fest installierter CLI-Einstieg erstellt das reguläre Controller-Archiv.

## Bedienung und Übernahme

Unter **Sicherung** das Modul aktivieren, Zeitplan und Ziele einstellen. Systemsicherung und CCU lassen sich getrennt manuell starten. Es läuft höchstens ein Auftrag. Zeitpläne, Namen, mehrfache Datenbankziele, Geheimnisse und unbekannte kundenspezifische Konfigurationsfelder werden beim Import erhalten. Neue verschlüsselte Dateinamen verwenden UUID, Sicherungstyp und Index; alte Dateinamenssuffixe bleiben als Metadaten erhalten. Die ursprüngliche Namespace-Zuordnung bleibt für die unterstützten Datenpunkte bestehen.

Vor der automatischen Übergabe werden Betriebsart, Verschlüsselungsfelder, feste Programme, Quelldateien und erreichbare lokale Ziele geprüft. Ein nicht unterstützter aktiver Modus blockiert die Übernahme, bevor der alte Adapter gestoppt wird. Ein inaktiver Altadapter kann mit seinen Einstellungen gespeichert bleiben; ein späteres Aktivieren prüft sie erneut. Dies ist **keine pauschale Zusage, dass jede kundenspezifische Altkonfiguration ohne Vorbereitung übernommen werden kann**.

Archive werden streamend mit AES-256-GCM verschlüsselt und vor Abschluss authentifiziert. Der geräteeigene 256-Bit-Wiederherstellungsschlüssel liegt getrennt als private Datei (0600). **Einmal über die Schaltfläche herunterladen und außerhalb des EOS-Geräts geschützt aufbewahren.** Ohne ihn lassen sich Archive nach Geräteverlust nicht wiederherstellen. Archive, die mit einem anderen Schlüssel geladen werden, sind ausdrücklich als „recovery-key-required-or-damaged“ gekennzeichnet und nicht als authentifiziert freigegeben.

Das standardmäßig aktivierte EOS-Zusatzarchiv enthält HTTPS-/EEBus-Geräteidentitäten, aktuelle private EOS-Daten und bei übernommener UI deren erhaltenes Instanzverzeichnis. Aktivierte Herstellerdateien, verschlüsselte OAuth-Aktualisierungen und das verschlüsselte Verzeichnis eigener Aufräumrechte sind enthalten. `eosProfileEnabled=false` bleibt erhalten: In diesem Fall fehlen diese Zusatzdaten bewusst. Ein privater NexoWatt-CA-Herstellerschlüssel gehört nicht auf das Gerät und wird nicht erzeugt oder ausgeliefert.

### Integriertes OCPP ab EOS 9.0.24

Die verschlüsselte OCPP-Konfiguration unter `eos-admin.N.modules.ocpp.configuration` gehört wie die anderen Modulkonfigurationen zum Controller-Archiv. Dabei bleibt auch der zugehörige ioBroker-Systemschlüssel erhalten; ein einzelner kopierter Konfigurationswert ohne den richtigen Schlüssel genügt nicht zur Wiederherstellung. Native Stationsobjekte unter `eos-admin.N.ocpp` und übernommene Originalobjekte unter `ocpp21.N` werden mit ihren bestehenden IDs, Metadaten und Zuständen gesichert. Das private EOS-Profil erfasst außerdem das Modulverzeichnis `modules/ocpp`, falls dort lokale Daten vorhanden sind; der aktuelle OCPP-Laufzeitstand benötigt dort keine persistenten Dateien.

Das Controller-Archiv bewahrt insbesondere die dauerhafte Watchdog-Aktivierung `control.eosLeaseArmed`, Phasenzahl, Einheit der Leistungsgrenze sowie bestätigte Stationskonfiguration. Gespeicherte Sollwerte, Sitzungskennungen und Lease-Fristen sind dagegen historische Zustände und keine Wiederanlauf-Freigabe. Ein Restore führt keine dieser Vorgaben aus. Vor erneuter Regelung sind eine aktuelle Verbindung, eine neue EOS-Freigabe und eine neue Sollwertanforderung erforderlich; vorhandene Schutzlatches dürfen dabei nicht gelöscht werden.

Die separate verschlüsselte Konfigurationssicherung vor einem EOS-Update enthält auch OCPP-Modulkonfiguration und Namespace-Migrationsdaten. Sie ersetzt keine vollständige Controller-/EOS-/Historien-Sicherung. Ein übernommener `ocpp21.N`-Namensraum kann weiterhin die autoritativen Stationsdaten enthalten, obwohl kein eigener OCPP-Adapterprozess mehr läuft. Deshalb bei Adapterbereinigung oder Rückfall keine pauschale Löschung dieses Namensraums ausführen und niemals alten und integrierten Stationsserver gleichzeitig aktivieren. Für ein Entfernen oder Zurücksetzen zuerst Zuordnung, Sicherung und tatsächliche Datenhoheit prüfen.

Die geschützte Kioskkonfiguration `eos-admin.N.kiosk.configuration` wird ebenfalls in Vollsicherung und Update-Konfigurationssnapshot erhalten. Gesichert werden Aktivierung, Revision und freischaltendes Konto; flüchtige Browser-Cookies und Sitzungsschlüssel werden nicht exportiert. Nach einer Wiederherstellung bleiben Konto-, Lizenz- und Passwortvoraussetzungen maßgeblich.

## Funktionsumfang und Grenzen

| Funktion | Umsetzung |
| --- | --- |
| Controller-/EOS-Sicherung | Controller-CLI ohne Shell, zusätzlicher privater EOS-Profilcontainer mit Hashmanifest |
| MySQL / PostgreSQL / SQLite | Feste Systemprogramme, geschützte Passwortübergabe; vorhandene Einzel-/Mehrfachziele bei MySQL/PostgreSQL |
| InfluxDB 1/2 | Passende System-CLI und Einzel-/Mehrfachziele |
| Redis | Lokales RDB bzw. klassische `appendonly.aof`, Remote-RDB; installierte CLI und Leserechte erforderlich; modernes mehrteiliges AOF erfordert passend bereitgestelltes Exportziel |
| History / Zigbee / Node-RED / Yahka / Jarvis / ESPHome | Zusätzliche lokale Dateien; JavaScript-Objekte bereits im Controller-Archiv |
| Zigbee2MQTT | Lokales Datenverzeichnis oder begrenzte MQTT-Backupanforderung mit Transaktionszuordnung; originales ZIP bleibt erhalten |
| Grafana | Datenquellen, Ordner, Dashboards und Zuordnung mit begrenzten sequentiellen API-Aufrufen |
| CCU | Login, streamende Sicherung, Logout; Einzel-/Mehrfachziele und eigener Zeitplan |
| SD-Karte | Originale Erkennung/Validierung aus 1.0.10, kein Ausweichen auf Systemmedium nach Entfernen der Karte |
| NAS / CIFS / NFS | Vom Betriebssystem bereits eingebundene und für den Dienst freigegebene Ziele; Copy-Modus unterstützt getrennte System-/CCU-Pfade |
| FTPS / WebDAV / Dropbox / Google Drive / OneDrive | Upload, Zielverzeichnisse, begrenzte Dateiliste, Download/Import und eigene Aufräumregeln; vorhandene OAuth-Token werden geschützt weitergeführt |
| Bestehende lokale/entfernte Archive | Originale bleiben erhalten; Übernahme erzeugt eine verschlüsselte Kopie, kein automatischer Restore |
| Aufbewahrung | Anzahl pro Typ wie tatsächlich in 1.0.10 ausgeführt, Mehrfachziele berücksichtigt; manuelle Läufe löschen nichts |
| Gemeinsame Cloud-/NAS-Ordner | Automatische Löschung nur für erfolgreich selbst hochgeladene Archive mit authentifiziertem Eigentumsnachweis; fremde/historische Archive bleiben erhalten |
| Benachrichtigungen | Vorhandene konfigurierte Telegram-, WhatsApp-, Signal-, Gotify-, Matrix-, Discord-, E-Mail- oder Pushover-Instanz; nur feste geprüfte Nachrichten, Verzögerung/OnlyError erhalten |
| Wake-on-LAN | Ein ausdrücklich konfiguriertes Magic Packet mit begrenzter Wartezeit; keine Netzwerksuche |
| Multi-Host Master/Slave | Noch keine funktionsgleiche Übernahme: aktive Altkonfiguration bleibt zuständig (`EOS_BACKUP_MIGRATION_MULTIHOST_REVIEW`) |
| Beliebige Expert-Mounts / root / sudo / eigene Programmpfade | Nicht übernommen; Systemeinrichtung außerhalb des Adapters erforderlich |
| Unverschlüsseltes FTP / abgeschaltete TLS-Prüfung / MySQL SkipSSL | Sichere Zielkonfiguration erforderlich, sonst Übernahme blockiert |
| CIFS/NFS mit zwei verschiedenen automatischen Mountzielen | Eigene vorab eingerichtete Pfade erforderlich; pauschaler Einhängepunkt ersetzt keine zwei Freigaben |
| `ignoreErrors=true` | Automatische Übernahme blockiert; Teilsicherungen werden nicht als erfolgreicher Vollstand behandelt |
| Vollständiger Restore | Geplante Offlinewartung bei gestopptem Controller/EMS; kein Neustart oder Datenbanküberschreiben aus laufender Regelung |

Die optionalen Nachrichtenkanäle benötigen weiterhin ihre explizit konfigurierten Versanddienste. Die Cloud-OAuth-Erneuerung benutzt bei entsprechenden Altregistrierungen deren bisherigen Relay-Endpunkte. Die Sicherung benötigt selbst keinen Standard-Backitup-Adapter.

## Wiederherstellung nach Gerätetausch

1. Zusammengehörige Archive und separat gesicherten Schlüssel auf den Wartungsrechner kopieren.
2. Jedes Archiv mit dem enthaltenen Werkzeug in ein **noch nicht vorhandenes** Verzeichnis entschlüsseln:

   ```sh
   node modules/backup/build/restore-cli.js --archive /pfad/eos-backup-….nwb --key-file /pfad/Wiederherstellungsschluessel.json --output /pfad/neue-vorbereitung
   ```

   Falscher Schlüssel oder Manipulation entfernt nur die neu erstellte Ausgabe. Bestehende Ausgabeverzeichnisse bleiben unverändert. Das Werkzeug erkennt GZIP/ZIP und CCU-Sicherungen, entpackt nichts und führt keinen Archivinhalt aus.
3. Manifest und Inhalte prüfen. ioBroker/EMS kontrolliert stoppen. Controller-Archiv mit der dazu passenden Controller-Wiederherstellung einspielen, EOS- und gegebenenfalls alte UI-Instanzdaten aus dem Profil an ihre zugehörigen Instanzverzeichnisse zurückspielen; Dienstbenutzer und restriktive Rechte beibehalten. Datenbanken mit ihren passenden Wartungswerkzeugen wiederherstellen.
4. **Vor dem ersten Start des Backupmoduls** den separat gesicherten Wiederherstellungsschlüssel als Dienstbenutzer wieder einsetzen. Bei einer Standardinstallation mit Instanz 0:

   ```sh
   node modules/backup/build/restore-cli.js --install-key --key-file /pfad/Wiederherstellungsschluessel.json --data-dir /opt/iobroker/iobroker-data/eos-admin.0/modules/backup
   ```

   Der tatsächliche Instanz-/Datenpfad muss zur Anlage passen. Das Werkzeug erstellt ausschließlich `recovery.key` mit 0600 in einem privaten Verzeichnis und **überschreibt keinen vorhandenen Schlüssel**. Existiert bereits ein neuer Schlüssel, zuerst beide Stände sichern und im Wartungsablauf die richtige Identität auswählen. Nach einer älteren Wiederherstellung können inzwischen rotierte oder widerrufene OAuth-Zugänge eine erneute Anbieteranmeldung erfordern. Ohne alten Schlüssel bleiben alte Archive/OAuth-Caches/Eigentumsnachweise unlesbar; fehlende Aufräumnachweise führen zum Erhalt alter Dateien.
5. Zunächst im sicheren Inbetriebnahmezustand starten. Lizenz, TLS-Vertrauen, EEBus-Kopplung, Benutzerrechte, Gerätezuordnung und Anlagenlimits prüfen, dann Regelbetrieb freigeben. Private Geräteidentitäten nicht auf mehrere gleichzeitig aktive Geräte klonen.

Originale unverschlüsselte Altarchive bleiben erhalten und sind ebenfalls über den passenden Wartungsablauf wiederherstellbar. Ein schlichtes Paket-Downgrade auf 9.0.6 ersetzt keinen vollständigen Rückfall auf den gesicherten vorherigen Systemstand.

## Ressourcen, Schutz und Nachweise

Kompressor, MQTT und Cloudclients laufen nur im kurzlebigen Arbeitsprozess. Er hat 256 MiB V8-Heap-Limit und standardmäßig 30 Minuten Gesamtdeadline (1–120 konfigurierbar); externe Datenbankwerkzeuge zusätzlich zehn Minuten. Das ist kein garantiertes RSS-Limit für native Bereiche oder externe Prozesse. Abbruch, Lizenzentzug, Parent-Ausfall und Shutdown beenden die Prozessgruppe. Ein Start/Stop-Rennen erzeugt keine verspäteten Scheduler; ein fehlgeschlagenes Abmelden von Zuständen verhindert die Bereinigung nicht.

Streaminglimit standardmäßig 10 GiB pro Archiv (bis 100 GiB konfigurierbar). Der freie Platz wird vor Beginn und während laufender Aufträge geprüft. Normale Metadaten-/OAuth-Anfragen: fünf Sekunden; große Transfers: gesonderte begrenzte Frist. Download benutzt dieselbe EOS-Admin-Sitzung und CSRF-geschützte Befehle. Status/History erhalten maximal 4 MiB Metadaten; Listen zeigen zunächst gekürzte Ergebnisse mit vollständiger Detailabfrage. Es werden keine Schlüssel oder Cloud-Download-URLs im Status ausgegeben.

Der Controller kopiert kundenspezifische `common.dataFolder`-Verzeichnisse rekursiv. Vor der Migration und jedem Systemsicherungsauftrag wird deshalb eine Überschneidung mit dem privaten Backupordner blockiert, bevor die CLI startet. So werden Archive, Arbeitsdateien und Wiederherstellungsschlüssel nicht rekursiv in ein neues Controller-Archiv aufgenommen. Konfigurationsänderungen durch einen anderen privilegierten Prozess während des Auftrags bleiben eine Systemgrenze.

Klartext-Arbeitsdateien liegen vorübergehend in 0700/0600-Verzeichnissen und werden nach Ende/Abbruch entfernt. Verwaiste Auftragsverzeichnisse werden beim nächsten Modulstart bereinigt. Festplattenverschlüsselung und Isolation gegen dieselbe Betriebssystem-UID sind eigene Systemaufgaben.

Die Prüfungen in `test/` verwenden erzeugte Testdaten, echte Kindprozesse, lokale Protokollserver und simulierte Cloudantworten. Produktive Clouds, reale Datenbanken/CCU, SD-Hardware und eine vollständige Wiederherstellung auf Ersatzhardware wurden damit **nicht** abgenommen. Vor Kundeneinsatz gehört dieser Wiederherstellungstest zur Freigabe.

## Herkunft und Lizenz

Original: `NexoWatt-EOS-Backup-1.0.10-SD-RECHTE-FIX-FULL-REPOSITORY.zip`, SHA-256 `ece60a7b46a75c837f0e00d3ff134f08f7b99ac2cff055c1177a8d426066f590`. `provenance.json` dokumentiert Komponenten und unveränderte Herkunftsdateien. Originalschema und SD-Helfer stammen aus dieser eigenen NexoWatt-Version. Die unter `upstream/LICENSE` und `upstream/NOTICE.md` erhaltenen MIT-Rechte werden durch die proprietäre EOS-Lizenz nicht entfernt. Es werden keine Hersteller-, TLS- oder Lizenz-Privatschlüssel mitgeliefert.
