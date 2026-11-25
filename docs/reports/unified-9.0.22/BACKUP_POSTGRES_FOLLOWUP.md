# Nachprüfung Sicherung und PostgreSQL-Systempfad

Stand: 25.11.2026. Ausgangspunkt ist die vorhandene Umsetzung 9.0.22 aus dem Arbeitsstand `implementation-922`; diese Nachprüfung begleitet die Energiefluss-/Tarifkorrektur. Quellbezug: `raw/backup-followup/scope-hashes.json`. Sie ist keine vollständige Anlagenabnahme. In diesem Teilauftrag wurde kein neuer Produktcodefehler reproduziert und kein Produktcode geändert.

## Vorhandener Funktionsumfang

Die direkte PostgreSQL-Historie, explizite Neuanlagenbereitstellung, getrennte Datenbankrollen und TLS-Profile sind implementiert. Ein normales Adapterupdate schaltet InfluxDB nicht auf PostgreSQL um. Die privilegierte Systemeinrichtung bleibt ein expliziter Einrichtungsaufruf; der Adapter besitzt keinen allgemeinen Root-Befehlsweg.

Eine Gesamtsicherung verlangt Controllerdaten, EOS-Profil und den tatsächlich verwendeten, unterstützten Historienanbieter. Bei unbekanntem Anbieter oder fehlender Influx-Abdeckung wird kein vollständiger Erfolg behauptet. InfluxDB-2-Inventar und tatsächlicher Export werden auf Buckets, Identitäten und referenzierte Dateien geprüft. PostgreSQL verwendet den separaten Lesebenutzer und verifiziertes TLS. Die verschlüsselten Bestandteile erhalten ein zusammengehöriges Wiederherstellungsmanifest; fehlende, vermischte oder veränderte Teile werden abgewiesen. Öffentliche Lizenz-Vertrauensinformationen werden gesichert, aber aus dem Archiv nicht automatisch als neue Herstellerautorität übernommen.

Die Offline-Wiederherstellung bereitet das authentifizierte Set vor und beschreibt den getrennten Wiederaufbau. Sie führt keinen automatischen Controller-/Geräte-/Datenbankrestore in eine laufende Anlage aus. Die Sicherung ist eine Folge von Komponentenschnappschüssen, kein global atomarer Datenträgerschnappschuss.

## In dieser Nachprüfung tatsächlich ausgeführt

| Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| Sämtliche `modules/backup/test/*.test.cjs`, PostgreSQL-Setup und Historienabdeckung unter Node.js 24.22.3 | 104 bestanden, 0 fehlgeschlagen; 1 opt-in-Realtest im Sammellauf ausgelassen | `raw/backup-followup/tests-node24.tap` |
| Genau dieser Influx-Realtest separat mit zwei neuen isolierten InfluxDB-2.10.1-Diensten | 1 bestanden, 0 ausgelassen; echter CLI-Export, getrennte Wiederherstellung mit exakt gleichen sechs typisierten Feldzeilen, vorhandener leerer Bucket akzeptiert, fehlender Bucket abgewiesen, Vollinventar geprüft | `raw/backup-followup/influx-real-node24.tap` |
| Strikte Typprüfung Backup | Exit 0 | `raw/backup-followup/typecheck-backup.log` |
| Strikte Typprüfung PostgreSQL-Setup/Status | Exit 0 | `raw/backup-followup/typecheck-postgres-setup.log` |
| Strikte Typprüfung Historienabdeckung | Exit 0 | `raw/backup-followup/typecheck-backup-scope.log` |
| Backup-ESLint | Exit 0 | `raw/backup-followup/eslint-backup.log` |

Der Influx-Test verwendet nur synthetische Daten und temporäre Verzeichnisse; er kontaktiert keine konfigurierte Kundendatenbank. Die getrennte PostgreSQL-Laufzeitprüfung einschließlich echtem TLS-Dump/Restore ist in `postgres-history-review.md` dokumentiert. Ältere Node-22-/Node-24-Nachweise im Ausgangsstand bleiben als frühere Prüfungen erkennbar; sie werden hier nicht als neu ausgeführt bezeichnet.

## Weitergeführte Befunde aus 9.0.21

| Kennung | Nachprüfstand | Verbleibende Grenze |
| --- | --- | --- |
| BK921-01 Abdeckung | Code und Softwareprüfungen der notwendigen Bestandteile bestanden | Vollständiger Wiederaufbau einer realen getrennten Controller-/EOS-Anlage bleibt offen. Historienadapter außerhalb direktem/Adapter-InfluxDB 2 bzw. verwaltetem PostgreSQL werden als ungeklärt abgewiesen. |
| BK921-02 Lizenz-Vertrauen | Erfassung öffentlicher Informationen und Verbot automatischer Autoritätsübernahme geprüft | Ersatzhardwarebindung und unabhängige Herstellerbereitstellung sind an der Zielanlage zu prüfen. |
| BK921-03 Restore-Abnahme | Authentifizierte Set-Vorbereitung, Manipulationsfälle sowie echte isolierte Influx-Datenwiederherstellung geprüft; PostgreSQL separat geprüft | Gesamtanlage einschließlich Benutzer/Systemgeheimnis, Identitäten, Modi, Limits, Gerätefreigabe und Hostneustart bleibt offen. |
| BK921-04 Influx-Inhalt | Inventar, Bucketidentität, Manifest/Dateien und echte Datenwiederherstellung bestanden | Nachweis betrifft InfluxDB 2.10.1 und die dokumentierte isolierte Umgebung. |
| BK921-05 Mehrfachziel-Version | Einheitliche Normalisierung, geerbte Version und abgewiesene ungültige Versionen bestanden | Reale Mehrfachziel-Anlage wurde nicht angebunden. |

## Noch offen vor einer umfassenden Anlagenfreigabe

- Privilegierte APT-/systemd-Erstbereitstellung einschließlich privatem Peer-Wartungszugang und Hostneustart auf unterstütztem Debian 13.
- Echter externer Verbindungsversuch zur Datenbank und Prüfung der konkreten Netz-/Firewallbedingungen.
- Getrennter vollständiger EOS-/Controller-/Historienwiederaufbau mit anschließendem Neustart und kontrollierter Wiederanbindung der Geräte.
- Echter Datenträgervollstand, Stromunterbrechung und Dauerbetrieb unter Zielanlagenlast.
- Auslieferungsweite Prüfung des finalen Paketstands, Integrität und SBOM durch den abschließenden Releaseablauf.

Die ausgeführten Teilprüfungen rechtfertigen einen dokumentierten Teststand, keine pauschale Fehlerfreiheit oder Serienfreigabe.
