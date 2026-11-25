# PostgreSQL-Systempfad 9.0.22 – Prüfstand

Datum: 25.11.2026. Prüfgegenstand sind der neue begrenzte System-Bootstrap und der lesende Bereitstellungsstatus. Dies ist keine Abnahme einer Kundenanlage und keine CRA-Konformitätserklärung.

## Umgesetzt

- Eigener lokaler PostgreSQL-17-Dienst auf `127.0.0.1:55432`, eigener OS-Dienstbenutzer, getrennte Laufzeit-, Schema- und Sicherungsrollen.
- TLS 1.3, geprüfte interne CA und Gegenstellenname, SCRAM, kein Klartext-Rückfall, kein LAN-Listener.
- Feste Root-Dateien für Clientprofile; API-Status enthält keine Zugangsdaten und behauptet mit `connectionVerified:false` keine Liveverbindung.
- Expliziter Neuanlagen-Bootstrap und optional fester signierter Debian-13-Paketpfad. Keine Elevation des Adapters, kein npm-Installationshook, keine frei ausführbaren Systembefehle.
- Schutz gegen fremde Cluster/Dienste, veränderte Konfiguration und systemd-Drop-ins, Schreibrechte/Symlinks, gleichzeitige Bootstrapläufe und unvollständige Erstinstallation. Kein Löschen vorhandener Daten oder automatischer Wechsel bestehender InfluxDB-Anlagen.
- Temporäre Debian-Paketrichtlinie nur mit exklusiv erzeugter eigener Datei; Entfernung setzt unveränderte Dateidentität und Inhalt voraus. Teilinstallationen werden als Fehler gemeldet.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| Setup-/Status-Tests Node 24 | 10 bestanden, 0 fehlgeschlagen | `raw/postgresql-system/setup-node24.tap` |
| Setup-/Status-Tests Node 22 | 10 bestanden, 0 fehlgeschlagen | `raw/postgresql-system/setup-node22.tap` |
| Strikte TypeScript-/JavaScript-Prüfung | Exit 0 | `raw/postgresql-system/typecheck.log` |
| Setup-/Test-ESLint | Exit 0 | `raw/postgresql-system/setup-eslint.log` |
| Status-ESLint | Exit 0 | `raw/postgresql-system/status-eslint.log` |

Die Setup-Tests prüfen unter anderem Instanz-/SQL-Grenzen, lokalen TLS-Zwang, Rollen-/Dienstgrenzen, explizite Neuanlagendokumente, geheimnisfreien Plan, Abweisung unprivilegierter Bereitstellung, unbekannte Paketpolitik und die begrenzte Bereinigung eigener temporärer Dateien.

Für tatsächliche Datenbankprüfungen wurden offizielle signierte Debian-Paketquellen genutzt und PostgreSQL 17.12 ausschließlich in ein Arbeitsverzeichnis extrahiert. Die unabhängigen PostgreSQL-Laufzeit-/TLS-/Rollen-/Backupprüfungen werden separat berichtet; sie ersetzen keinen systemd-/APT-Test.

## Noch getrennt abzunehmen

Die privilegierte Paket-, Peer-Socket- und systemd-Ersteinrichtung wurde hier nicht auf einem EOS-Zielgerät ausgeführt. Vor Produktfreigabe muss dieser Pfad auf einem frischen unterstützten Debian-13-Image einschließlich Neustart, wiederholtem Setup und kontrolliertem Abbruch geprüft werden. Auf einem nicht vorbereiteten Gerät kann ein gewöhnliches npm-Update allein keinen geschützten OS-Dienst bereitstellen; die einmalige Operator-/Image-Einrichtung bleibt erforderlich.

Unterbrochene Erstinitialisierung wird erkannt und muss kontrolliert geprüft werden; es gibt bewusst keine blinde Neuinitialisierung oder automatische Datenlöschung. Serverzertifikate haben 825 Tage Laufzeit und benötigen überwachte Systemwartung zur rechtzeitigen Erneuerung. Die TLS-Laufzeit lehnt abgelaufene Zertifikate ab. Der unprivilegierte Kunden-Updater erneuert keine Root-Schlüssel.

Ausführung und Grenzen: [PostgreSQL-Systembereitstellung](../../unified/POSTGRESQL_9_0_22.md).
