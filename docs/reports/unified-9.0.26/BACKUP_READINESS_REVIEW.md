# Backup-Pfadfehler und Statusbedeutung

## Beobachtung und belegbare Ursache

Der bereitgestellte Screenshot zeigt gleichzeitig `EOS_BACKUP_SOURCE_PATH`, „Bereit“ und eine unvollständige Gesamtsicherung wegen nicht erfasster aktiver InfluxDB-Historie. Aus diesem Bild lässt sich weder der konkret konfigurierte Pfad noch die zuvor ausgeführte Bedienaktion ableiten.

`modules/backup/src/config.ts` verwendet `safeSourcePath` sowohl für lokale Quellen als auch für bereits lokal eingebundene Sicherungsziele. Leere beziehungsweise relative Pfade, NUL/Zeilenumbruch und geschützte Systempfade werden abgewiesen. Der Fehler lässt sich mit aktiviertem CIFS-Ziel und dem mitgelieferten relativen Platzhalter `sharename/backupDir` ohne passenden absoluten `mountedBackupPath` reproduzieren. Das ist eine nachgewiesene Fehlerklasse, keine Feststellung über den tatsächlichen Pfad auf der Anlage.

Die bisherige Oberfläche leitete „Bereit“ ausschließlich von `status.active` ab. Dieses Merkmal bestätigt den laufenden Modulprozess und seine Freigabe, nicht einen vollständig eingerichteten Sicherungsumfang. Ein zurückgewiesener Konfigurationsentwurf darf den vorherigen funktionierenden Prozess nicht beenden oder dessen gespeicherte Einstellungen ersetzen. Deshalb kann ein Pfadfehler beim Speichern gleichzeitig mit einem weiterhin aktiven Backupdienst erscheinen.

Die Abdeckung der aktiven Historie ist eine zusätzliche Prüfung. Der Backupworker verweigert eine Gesamtsicherung bei `EOS_BACKUP_ACTIVE_INFLUX_NOT_COVERED` bereits vor einem Sicherungsauftrag. Ein korrigierter lokaler Zielpfad ergänzt weder einen InfluxDB-Server noch Organisation, Bucket oder Zugangsdaten automatisch.

## Beibehaltener Schutz

Es wurden keine Backend-Schutzprüfungen gelockert oder Pfade automatisch verändert. Rootless-Ausführung, Mount-Verantwortung, Pfad-/Symlink-/Berechtigungsprüfungen, verschlüsselte Archive, Wiederherstellungsschlüssel, vollständige Historienabdeckung und Konfigurationsrevisionen bleiben erhalten. Es wird kein konkreter NAS-/SD-Pfad für die Anlage angenommen und keine automatische Mount-/sudo-Aktion ergänzt.

Die Oberfläche soll Dienstzustand, Sicherungsumfang und Fehler des letzten Bedienversuchs getrennt darstellen. Ein aktiver Prozess ist als laufendes Backupmodul erkennbar; fehlende Historieneinstellungen dürfen dadurch nicht als vollständige Sicherungsbereitschaft erscheinen. Die Oberflächenumsetzung wird separat geprüft.

## Integrationstest

`test/eos-module-backup-readiness.test.cjs` verwendet den tatsächlichen Modulhost, einen echten Backupworker, die authentifizierte HTTP-Grenze einschließlich Session/CSRF sowie die Produktionsvalidatoren. Lediglich die Controllerdatenbank und die deklarierte aktive Historienquelle sind isolierte Fixtures. Es werden keine externen Dateien gesichert, Datenbanken kontaktiert oder Datenträger eingebunden.

Vier Tests bestanden auf Node 22.23.4 und Node 24.22.3; ESLint bestand ebenfalls:

1. Zehn ungültige lokale Zielentwürfe einschließlich des relativen CIFS-Platzhalters liefern HTTP 400 mit `EOS_BACKUP_SOURCE_PATH`. Kein Konfigurationsschreibauftrag, kein PID-Wechsel und kein Verlust gespeicherter Geheimnisse oder zusätzlicher Kundeneinstellungen.
2. Ein aktiver Backupworker mit ungesicherter InfluxDB-Historie liefert beim Startversuch den konkreten Abdeckungsfehler. Prozess und Verschlüsselung bleiben aktiv; es entstehen weder ein Sicherungsauftrag noch ein Arbeitsverzeichnis oder Erfolgseintrag.
3. Ein ausdrücklich korrigiertes lokales Testziel wird über den regulären Konfigurationscommit übernommen. Maskierte Geheimnisse bleiben erhalten. Nur der Backupprozess erhält eine neue PID; Speichern startet weder eine Sicherung noch einen Mount. Die separate InfluxDB-Abdeckung bleibt weiterhin erforderlich.
4. Eine bereits gespeicherte ungültige Zielkonfiguration erzeugt `CONFIG_INVALID` mit dem ursprünglichen Fehlercode und keinen aktiven Backupworker.

Die Tests belegen die Behandlung dieser Fehlerklassen. Sie ersetzen weder die Prüfung des unbekannten konkreten Anlagenpfads noch einen vollständigen Backup-/Wiederherstellungstest auf dem Raspberry Pi.
