# EOS 9.0.22 – Gesamtsicherung und Wiederherstellung

Eine erfolgreiche EOS-Gesamtsicherung umfasst ioBroker, das private EOS-Profil und die tatsächlich konfigurierte Historie. Bereits eingerichtete InfluxDB-Installationen bleiben erhalten. Die neue verwaltete PostgreSQL-Historie wird ausschließlich bei ausdrücklich eingerichteten Neuanlagen verwendet.

## Was gesichert wird

| Bestandteil | Verfahren | Prüfumfang |
| --- | --- | --- |
| ioBroker | Offizieller Controller-Befehl `backup` | Befehl erfolgreich, Ausgabedatei vorhanden, authentifizierte Verschlüsselung |
| EOS | Privates Instanzverzeichnis einschließlich TLS-Identität, Geräte-/Moduldaten, Integrationsfreigaben; erhaltenes altes UI-Verzeichnis; vorhandene Vendor-Dateien gemäß Einstellung | Dateiliste und SHA-256 im Profilmanifest, Symlink-Ablehnung, authentifizierte Verschlüsselung |
| Öffentliche Hersteller-Vertrauensanker | Bestehender sicherer Lizenz-Trust-Reader | Schutz der Datei und Elternverzeichnisse; nur öffentliche Ed25519-Schlüssel; Wiederherstellung niemals als automatische neue Vertrauensautorität |
| Aktive InfluxDB 2 | Reale CLI-Sicherung des passenden Servers/der Organisation/des Buckets | Vorherige Bucket-Inventur, Manifest-v2-Struktur, genaue Bucket-/Organisationsidentität, referenzierte Metadaten-/Sharddateien und Größen, SHA-256; fehlender Bucket wird abgelehnt |
| Verwaltetes PostgreSQL | `pg_dump` mit separater Backup-Rolle und `sslmode=verify-full` | Geschütztes bereitgestelltes Profil, feste lokale Verbindung, gültige CA, erfolgreiches Daten-Dump, Dateiformat; keine Rollen-/Schemaübernahme aus dem Archiv |

Der Sicherungsschlüssel und die Sicherungsarchive selbst werden nicht rekursiv in das EOS-Profil kopiert. Den Wiederherstellungsschlüssel separat exportieren und getrennt von den Sicherungen aufbewahren. Im privaten EOS-Profil enthaltene Integrationsdateien sind ebenfalls verschlüsselt; Rohzugangstoken werden vom Integrationsmodul nicht gespeichert.

Andere aktiv verwendete Historienquellen, insbesondere ein noch nicht aufgelöster SQL-/History-Adapter oder InfluxDB 1, werden nicht pauschal als vollständig gesichert bezeichnet. Vorhandene optionale Exportfunktionen bleiben erhalten. Die Gesamtsicherung wird jedoch mit einem konkreten fehlenden Umfang blockiert, bis die aktive Historie eindeutig unterstützt und zugeordnet ist. Fehlende Rückmeldung des Historienmoduls bedeutet nicht „keine Historie“.

## Einrichtung und Ausführung

1. EOS-Sicherungsmodul aktivieren, EOS-Profil eingeschlossen lassen und den gewünschten Zeitplan einstellen.
2. Bei bestehendem InfluxDB 2 die zutreffende Version, Serveradresse, Port, Organisation, Bucket und Sicherungsberechtigung eintragen. Für vollständige InfluxDB-Sicherungen gelten die Berechtigungsanforderungen der installierten Influx-Version. Der Token wird ausschließlich an den Sicherungsprozess übergeben und nicht in Protokollen/Archivbeschreibungen ausgegeben. Die bestehende Konfiguration wird nicht automatisch ersetzt.
3. Bei verwaltetem PostgreSQL verwendet EOS das separate Betriebssystemprofil `/etc/nexowatt-eos/postgresql/backup-eos-admin.N.json`. Es wird durch die vertrauenswürdige Einrichtung angelegt; keine Datenbankinstallation oder beliebige privilegierte Befehlsausführung durch den Sicherungsprozess.
4. Zusätzliches Sicherungsziel konfigurieren und die tatsächliche Ablage nach dem ersten Lauf prüfen. „Nur lokale Ablage“ schützt nicht vor einem Ausfall des Systemdatenträgers. Ein konfigurierter Kopierpfad allein beweist kein physisch unabhängiges Medium.
5. Sicherung ausführen. Nur ein erfolgreich abgeschlossener Auftrag zählt als erfolgreich. Eine konfigurierte Abdeckung ersetzt keinen erfolgreichen Lauf.
6. Alle Dateien dieses Auftrags und dessen `recovery-set` zusammen herunterladen beziehungsweise auf dem externen Sicherungsziel aufbewahren. Der Wiederherstellungsschlüssel bleibt separat.

Das verschlüsselte `recovery-set` bindet die Komponentendateien über Auftrags-ID, Dateinamen, Größen und SHA-256. Die Aufbewahrungsregeln entfernen neue Gesamtsicherungen als zusammengehörige Sätze. Auch eine kürzere Influx-Aufbewahrung auf SD-Karten darf keine zurückbleibenden, aber unvollständigen Gesamtsicherungen erzeugen. Alte nicht eindeutig zugeordnete Archive werden nicht rückwirkend gelöscht.

Die einzelnen Datenbanksicherungen sind konsistente Datenbank-Snapshots. Controller, EOS-Dateien und Datenbanken werden nacheinander gesichert; der Satz wird ausdrücklich **nicht als global atomarer Snapshot einer laufenden Anlage** ausgewiesen. Für Abnahmen mit strenger zeitlicher Konsistenz Änderungen der Anlagenkonfiguration während des Sicherungslaufs vermeiden und die Wiederherstellung isoliert prüfen.

## Sichere Vorbereitung auf einer Ersatzinstallation

Alle Komponentendateien eines Auftrags müssen im selben Eingangsverzeichnis liegen. Ein bisher nicht vorhandenes, privates Ausgabeverzeichnis wählen:

```text
node modules/backup/build/restore-cli.js --set /sicherung/eos-backup-AUFTRAGSID-recovery-set-N.nwb --key-file /sicherer-ort/wiederherstellungsschluessel.json --output /privat/vorbereitete-wiederherstellung
```

Die Vorbereitung authentifiziert den verschlüsselten Satz und jede Komponente. Fehlende, vertauschte oder veränderte Dateien führen zum Abbruch. Neu angelegte unvollständige Ausgaben werden entfernt; bereits vorhandene Verzeichnisse werden niemals überschrieben. Es werden weder laufende ioBroker-Daten noch Datenbanken oder Systemberechtigungen geändert.

Danach liegt `recovery-plan.json` mit den geprüften Komponenten vor. Das ist eine überprüfte Vorbereitung, keine bereits durchgeführte Systemwiederherstellung.

1. Unterstütztes Betriebssystem, passenden ioBroker-Controller und Datenbankwerkzeuge aus vertrauenswürdigen Quellen bereitstellen. Keine Verbindung zu Produktionsaktoren während der Prüfung.
2. Controller stoppen. ioBroker-Archiv mit dessen unterstütztem Wiederherstellungsverfahren einspielen. Danach EOS-Profil und gegebenenfalls altes UI-Verzeichnis unter den im Profil beschriebenen Instanzpfaden mit privaten Besitz-/Dateirechten wiederherstellen.
3. Wiederherstellungsschlüssel nur in ein noch nicht belegtes Schlüsselziel einspielen, bei Bedarf mit `restore-cli.js --install-key --key-file ... --data-dir ...`. Vorhandene Identität wird nicht überschrieben.
4. Öffentliche Lizenz-Vertrauensanker gegen unabhängig bereitgestellte Hersteller-/OS-Pins prüfen und den vorhandenen autorisierten Import verwenden. Das Archiv mit seinem eigenen öffentlichen Schlüssel ist keine unabhängige Vertrauensquelle. Ein ungepinnter Herstelleranker erfordert eine vertrauenswürdige OS-/Herstellerbereitstellung.
5. InfluxDB in eine getrennte Instanz wiederherstellen. Eine komplette Serverwiederherstellung und eine einzelne Bucket-Wiederherstellung sind unterschiedliche Verfahren; die installierte Influx-Version und deren Anforderungen an Operator-Token beachten. Der erfolgreiche Test dieser Version verwendet eine getrennte Instanz und eine Bucket-Wiederherstellung. Vorhandene Produktionsdaten niemals zum Test überschreiben.
6. PostgreSQL: Rollen, TLS und das versionsgebundene `eos_history`-Schema zuerst aus der vertrauenswürdigen EOS-Einrichtung erzeugen. Der reguläre EOS-Dump enthält ausschließlich Daten aus `eos_history.samples`. Nur authentifizierte Archive aus einer vertrauenswürdigen Quellinstallation verwenden und den Dump vor dem Einspielen prüfen. Mit einem nicht privilegierten Wiederherstellungs-Login, das nur die erforderlichen Tabellenrechte besitzt, in eine leere getrennte Zielinstallation mit `pg_restore --data-only --no-owner --no-privileges --schema=eos_history --table=samples` wiederherstellen. Diese Filter sind **keine Sandbox gegen einen bösartig erzeugten Dump**. Niemals als Datenbank-Superuser verbinden, auch nicht als Superuser mit nachfolgendem `--role`; keine archivierten Rollen, Funktionen oder fremdes Schema übernehmen. Neue lokale Zugangsdaten werden durch die Einrichtung erzeugt; alte PostgreSQL-Passwörter müssen nicht importiert werden. Die [PostgreSQL-Dokumentation](https://www.postgresql.org/docs/17/app-pgrestore.html) erläutert die Vertrauensanforderung an die Quelle.
7. Externe Integrationsfreigaben prüfen und nicht mehr benötigte Identitäten widerrufen. Ein älteres Backup kann Freigaben enthalten, die nach seinem Aufnahmezeitpunkt widerrufen wurden.
8. Geräte, EMS-Zuordnungen, Zertifikate, bekannte historische Stichproben, neue Historien-Schreibvorgänge und einen Neustart prüfen. Erst anschließend Produktionsaktoren wieder verbinden.

## Nachweise und Grenzen

Automatisierte Tests umfassen unveränderte vorhandene Sicherungsfunktionen, aktiven Historienumfang, vererbte Influx-Mehrfachkonfiguration, unvollständige/fehlerhafte Influx-Manifeste, unbekannte/private Vertrauensschlüssel, vollständige verschlüsselte Sätze, beschädigte/vermischte/fehlende Komponenten, falsche Schlüssel, Aufbewahrung vollständiger Sätze und exakte private EOS-Dateien nach Vorbereitung.

Zusätzlich wurden echte isolierte InfluxDB-2.10.1-Server mit CLI 2.7.5 verwendet: tatsächlicher EOS-Exporter, separate Zielinstanz, identische historische Messwerte, vorhandener leerer Bucket, fehlender Bucket und vollständiger Serverexport. Ein echter PostgreSQL-17-Test prüft den tatsächlichen EOS-Exporter mit TLS und Backup-Rolle, Ablehnung einer falschen CA, Wiederherstellung in das separat bereitgestellte Schema und identische typisierte Messwerte. Diese Tests laufen unter Node 22 und Node 24.

Die Controller-Aufrufe in den Modultests verwenden eine isolierte CLI-Testimplementierung; eine komplette ioBroker-Wiederherstellung auf der konkreten Kundenhardware ist damit nicht nachgewiesen. Die separate Wiederherstellungsprobe vor Freigabe einer Anlage und die Prüfung ihres tatsächlichen externen Sicherungsziels bleiben erforderlich. Es wird keine pauschale CRA-Konformität oder Hardware-Abnahme behauptet.
