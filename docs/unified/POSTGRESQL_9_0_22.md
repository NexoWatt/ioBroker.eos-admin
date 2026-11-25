# PostgreSQL-Systembereitstellung für EOS 9.0.22

Stand: 25.11.2026. Neu eingeführter, ausdrücklich zu aktivierender Neuanlagenpfad. Bestehende InfluxDB-Anlagen werden weder umgeschaltet noch gelöscht. Diese Beschreibung ist kein Nachweis einer Installation auf dem Kundengerät.

## Sicherheitsgrenze und Update

Der laufende EOS-Adapter und sein Kunden-Updater bleiben unprivilegiert. Ein Paketupdate installiert keinen Systemdienst mit verstecktem `sudo`. Neue Basisimages können PostgreSQL vorab bereitstellen; auf bisherigen Geräten ist einmalig die bewusst ausgeführte Systemeinrichtung durch den Betreiber/Installateur erforderlich. Anschließend verwendet EOS die geschützte lokale Bereitstellung. Der Voraussetzungenstatus unterscheidet `setup-required`, `invalid` und `configured`; `configured` bedeutet gültige Bereitstellungsdateien, noch keinen erfolgreichen aktuellen Datenbankzugriff. Die Historienlaufzeit prüft die echte TLS-Verbindung gesondert.

Die Bereitstellung hat keinen API-Listener und keinen Root-Befehlsdienst. Sie akzeptiert ausschließlich eine EOS-Instanzkennung sowie die dokumentierten festen Aktionen. Die normale Adapterinstallation bindet keine npm-Lifecycle-Aktion daran.

## Feste Systemstruktur

| Bestandteil | Vertrag |
| --- | --- |
| PostgreSQL | Unterstützter PostgreSQL-17-Zweig aus den signierten Distributionsquellen; tatsächlicher Patchstand wird erfasst |
| Listener | Ausschließlich `127.0.0.1:55432`; kein LAN-/WAN-/VPN-Listener |
| Datenbankdienst | `nexowatt-postgresql.service`, eigenes nicht anmeldbares OS-Konto `nexowatt-pg` |
| Datenverzeichnis | `/var/lib/nexowatt-postgresql/data`, Dienstkonto, Modus `0700` |
| Serverkonfiguration und TLS-Schlüssel | `/etc/nexowatt-postgresql`, Root/Dienstgruppe; CA-Privatschlüssel nur Root `0600` |
| Clientprofile | `/etc/nexowatt-eos/postgresql/client-eos-admin.N.json` und `backup-eos-admin.N.json`, Root/ioBroker-Gruppe, `0640` |
| Öffentliche CA | `/etc/nexowatt-eos/postgresql/ca.crt`; keine öffentliche Browser-CA, nur interne Datenbank-Vertrauensbasis |
| Datenbank | `eos_history_N`, Schema `eos_history`, Tabelle `samples` |
| Laufzeitrolle | `eos_history_N_runtime`: Verbindung, Schema-Verwendung und SELECT/INSERT/UPDATE der Messwerttabelle |
| Sicherungsrolle | `eos_history_N_backup`: Verbindung, Schema-Verwendung und SELECT; grundsätzlich lesende Transaktion |
| Schema-Eigentümer | `eos_history_N_owner`: NOLOGIN; kein Zugang für EOS-Laufzeit oder Backup |
| Wartung | Privater Unix-Socket ausschließlich mit Peer-Identität des OS-Dienstkontos; kein Adapterzugang über diesen Weg |

TCP-Verbindungen erfordern TLS 1.3 und SCRAM-SHA-256. Klartext, andere Adressen sowie gewöhnliche Benutzer am privaten Wartungssocket werden abgewiesen. Client und Sicherung müssen CA und Gegenstellenname prüfen. Es gibt keinen Klartext- oder `rejectUnauthorized:false`-Rückfall. Die gemeinsamen ioBroker-Dienstrechte bleiben eine eigene Vertrauenszone: ein fremder Adapter mit derselben UID kann nicht durch Dateimodi allein vollständig isoliert werden.

Die allgemeinen Zugriffsrechte auf `postgres`, `template0` und `template1` werden ausschließlich in diesem eigenen Cluster entzogen. Laufzeit- und Sicherungsrolle können damit nur ihre ausdrücklich freigegebene EOS-Datenbank verwenden.

## Einrichtung

Vorher den signierten/verifizierten Lieferstand prüfen und eine Sicherung behalten. Der folgende Pfad ist für **ausdrücklich neue EOS-Historieninstallationen** bestimmt; fehlende Einstellungen allein beweisen keine Neuanlage.

1. Unprivilegiert den Plan ansehen:

   ```sh
   node tools/system/eos-postgresql-setup.cjs --plan eos-admin.0
   ```

2. In einer bewusst geöffneten Administratorsitzung das geprüfte, eigenständige Setupwerkzeug nach `/root/eos-postgresql-setup.cjs` kopieren, Eigentümer Root und Modus `0700` setzen. Der Setupcode verweigert veränderbare beziehungsweise nicht Root gehörende ausführbare Hilfsdateien. Keine unbekannten Downloads direkt als Administrator ausführen.

3. Für ein vorbereitetes Image mit PostgreSQL-17-Binärdateien:

   ```sh
   /usr/bin/env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin /usr/bin/node /root/eos-postgresql-setup.cjs --new-site eos-admin.0
   ```

   Auf Debian 13 kann derselbe ausdrücklich autorisierte Aufruf zusätzlich die festen Distributionspakete bereitstellen:

   ```sh
   /usr/bin/env -i PATH=/usr/sbin:/usr/bin:/sbin:/bin /usr/bin/node /root/eos-postgresql-setup.cjs --new-site eos-admin.0 --install-packages
   ```

   Der Paketpfad verwendet ausschließlich APT mit aktivierter Signaturprüfung und den bereits verwalteten Quellen, fügt keine Repositorys hinzu und erlaubt keine frei eingegebenen Paketnamen. Er aktualisiert keine bereits installierten angeforderten Pakete (`--no-upgrade`). Sicherheitsaktualisierungen des Betriebssystems bleiben Aufgabe der dokumentierten Systempflege. Während dieses Vorgangs keine zweite Paketwartung starten.

   Debian legt sonst beim ersten Serverpaket ein zusätzliches `main`-Cluster an. Das Werkzeug setzt deshalb **nur während der Pakettransaktion** eine eigene exklusive Root-Datei im vorhandenen `createcluster.d`-Include mit `create_main_cluster=false` und entfernt anschließend ausschließlich diese eigene unveränderte Datei. Andere Cluster und die Hauptkonfiguration bleiben unberührt. Bei unbekanntem Include-Vertrag oder vorhandenem gleichnamigem Override wird abgebrochen. Nach hartem Prozess-/Stromabbruch kann diese temporäre Datei zurückbleiben; sie wird nicht blind überschrieben, sondern muss im kontrollierten Wartungsablauf geprüft werden.

4. Erst nach erfolgreicher TLS- und Rechteprüfung werden die privaten Clientprofile und der Bereitschaftsnachweis veröffentlicht. Passwörter werden zufällig erzeugt und nicht ausgegeben. Die Historieneinrichtung benötigt zusätzlich den ausdrücklichen Neuanlagenzustand; ein Influx-Bestand wird nicht durch das Vorhandensein der Dateien geändert.

## Wiederholung, Abbruch und Rückfall

Eine abgeschlossene Einrichtung lässt sich mit identischer Instanz erneut prüfen; bestehende Kennwörter und Messwerte bleiben erhalten. Unbekannte Cluster, ein belegter dedizierter Port bei Erstbereitstellung, andere Dienstkonten, Symlinks, unsichere Dateirechte, geänderte verwaltete Konfiguration oder nur teilweise vorhandene Profile führen zum Abbruch. Die Funktion nimmt keine fremde PostgreSQL-Installation in Besitz.

Ein exklusiver Root-Lock verhindert parallele Einrichtungsprozesse. Nach einem harten Prozessabbruch kann `/run/nexowatt-postgresql-setup.lock` bis zum nächsten Neustart erhalten bleiben. `EOS_POSTGRES_SETUP_BUSY_OR_INTERRUPTED` verlangt die Prüfung, ob noch ein Einrichtungsprozess läuft; der Lock wird nicht anhand eines Zeitlimits automatisch entfernt. Vorhandene systemd-Drop-ins werden ebenso abgewiesen wie ein fremder gleichnamiger Dienst. Vor Veröffentlichung der Profile werden die tatsächlich aktiven Listener-, TLS- und SCRAM-Einstellungen zusätzlich in PostgreSQL gelesen.

Bei Unterbrechung werden Datenverzeichnisse nicht gelöscht, alte Datenbanken nicht überschrieben und Fehler nicht als Erfolg dargestellt. Vorläufige Zugangswerte bleiben ausschließlich in einer Root-Datei für eine kontrollierte Fortsetzung. Eine während `initdb`, Zertifikatserzeugung oder Dienstbereitstellung unterbrochene Erstinstallation kann eine manuelle Prüfung erfordern; der erneute Lauf initialisiert kein vorhandenes unvollständiges Datenverzeichnis blind neu. Vor der erneuten Rollen-/Schemaeinrichtung wird der alte Bereitschaftsnachweis entfernt, nicht die Messdaten. Er scheitert bereits eine Vorprüfung, bleibt ein vorhandener Nachweis mit seinem alten Prüfzeitpunkt erhalten; er behauptet keine aktuelle Datenbankverbindung.

Fehlen bei vorhandener Verwaltungsmarkierung notwendige Cluster-, Zertifikats- oder Dienstdateien, endet der Lauf mit `EOS_POSTGRES_SETUP_INCOMPLETE_BOOTSTRAP`. Das ist ein ausdrücklich unvollständiger Einrichtungszustand, kein erfolgreicher Rollback. Verzeichnisse und vorläufige Profile für die Fehlersuche erhalten und im Wartungsfenster anhand des protokollierten Installationsstands prüfen.

Eine Rückkehr zum bisherigen Historienanbieter erfolgt nur über erhaltene Konfiguration und geprüfte Sicherungen. Kein automatisches Löschen des PostgreSQL- oder Influx-Bestands. Eine bestehende PostgreSQL-Hauptversion wird nicht im Adapterupdate gewechselt.

Die lokale CA gilt zehn Jahre, das Serverzertifikat 825 Tage. Erneuerung ist eine kontrollierte Systemwartung; es wird kein unbegrenztes Zertifikatsvertrauen behauptet. Abgelaufene Zertifikate werden durch die TLS-Prüfung abgewiesen. Für das Produkt muss der Betreiber vor Ablauf einen überwachten Wartungs-/Erneuerungstermin sicherstellen; eine automatische privilegierte Zertifikatserneuerung gehört nicht zum unprivilegierten Updater.

## Wiederherstellung

Auf der getrennten Zielinstallation zuerst den kontrollierten Systempfad ausführen. Rollen, Rechte und Schema stammen damit aus dem geprüften Lieferstand, nicht aus beliebigem SQL im Archiv. Die Messdaten können danach in das leere Schema zurückgespielt werden. Ein Datenrestore darf keine globalen Rollen, Funktionen oder privilegierte SQL-Befehle aus einem Fremdarchiv übernehmen; die Backup-Komponente muss den erlaubten Tabellenumfang und das Archiv prüfen. Neue lokale Clientzugänge auf dem Ziel sind zulässig; die EOS-Konfiguration verwendet das Profil `local` und enthält keine fest eingebetteten alten PostgreSQL-Passwörter.

Systembereitstellung, Controller/EOS-Restore und Datenrestore ergeben erst zusammen einen Wiederherstellungsweg. Das Werkzeug ist kein Betriebssystemabbild und kein Beweis einer bereits bestandenen Kundenanlagen-Wiederherstellung.

## Prüfbezug

- `test/eos-postgresql-setup.test.cjs`: Instanz-/Parametergrenzen, TLS/HBA, Rechte, Statusvertrag, keine irreführende Verbindungszusage und Abweisung des unprivilegierten Setupaufrufs.
- `tsconfig.eos-postgres-system.json`: strikte Typprüfung von Setup und Statusmodul.
- Reale isolierte PostgreSQL-Prüfungen verwenden extrahierte, signiert bezogene Debian-17-Pakete ohne Systeminstallation. Die getrennten Testbelege nennen tatsächliche Verbindungs-, Rollen-, Historien- und Restore-Ergebnisse.
- Ausführung der privilegierten APT-/systemd-Bereitstellung auf einem frisch installierten EOS-Zielgerät bleibt eine gesonderte Abnahme; sie wurde nicht auf dem Livesystem ausgelöst.

Offizielle technische Grundlagen, am 25.11.2026 eingesehen: [PostgreSQL-TLS-Clientprüfung](https://www.postgresql.org/docs/17/libpq-ssl.html), [Server-TLS](https://www.postgresql.org/docs/17/ssl-tcp.html), [Zugriffsregeln](https://www.postgresql.org/docs/17/auth-pg-hba-conf.html), [Debian-Cluster-Vorgaben](https://manpages.debian.org/trixie/postgresql-common/pg_createcluster.1.en.html). Daraus folgt keine pauschale CRA- oder Normkonformität des Produkts.
