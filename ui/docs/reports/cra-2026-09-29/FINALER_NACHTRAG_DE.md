# Abschließender Nachtrag – NexoWatt UI 1.0.22

Stand: 29.09.2026. Beauftragte Erweiterungen nach dem ursprünglichen Review:
npm-Testupload, automatische SBOM, Geheimnisauslagerung, strikte externe HTTPS-Abrufe
und eine dauerhafte Entwicklungsleitlinie für weitere ioBroker-Adapter.

## Änderungen und Sicherheitswirkung

- Der normale npm-Upload bleibt von der allgemeinen Produktivfreigabe getrennt.
  Geheimnis-, Versions-, Artefakt- und Paketprüfungen sind weiterhin verbindlich.
- SBOM automatisch vor Versiegelung erzeugen und vor jedem Upload schreibfrei
  gegen Paketdateien, Lockfiles und Buildnachweise prüfen. Die Produkt-SBOM wird
  im npm-Paket mitgeliefert; Referenzbaum und Live-Geräteinventar bleiben getrennt.
- Wetter-/PV- und Tarifoperationen teilen pro externem Abruf ein Netzwerkbudget
  von höchstens 5.000 ms einschließlich Authentifizierung, Geocoding und Fallbacks.
  Abbruch beendet die transportseitige Arbeit; ioBroker bleibt asynchron bedienbar.
- Empfangene Daten vor fachlichen State-Schreibvorgängen vollständig auf Typen,
  Wertebereiche, Zeitbezüge und zusammenpassende Reihen prüfen. Fehler dürfen
  vorhandene gültige Daten nicht als frisch neu veröffentlichen.
- Ehemals eingebetteten Lizenz-HMAC-Wert aus öffentlichem Quellcode und Runtime
  entfernen. Ausschließlich geschützte Dienstumgebung verwenden, kein eingebauter
  Rückfall. Private Serverbereitstellung bleibt außerhalb der Repository-ZIP.
- Credentialhaltige Konfigurations- und Backup-States gezielt schützen. Scanner
  um HMAC-Konstanten, private ENV-Dateien und eindeutige geheime ENV-Werte ergänzen.

## Liveupdate: private Vorbereitung erforderlich

**Zuerst die separat gelieferte PRIVATE_SERVER_SETUP-ZIP nach deren
INSTALLATION_DE.txt auf dem eigenen Server einrichten und die Dienstumgebung
im vorgesehenen Wartungsfenster übernehmen; erst danach den Adapter aktualisieren.**
Der Installer selbst startet keinen Dienst neu. Ohne die private Umgebung können
Bestandslizenzen nicht geprüft werden; das bisherige Lizenz-Gate bleibt aktiv.
Private license.env niemals ins Repository, zu npm oder in Supportlogs kopieren.

Der Bestandswert bleibt zur Kompatibilität erhalten, gilt wegen seiner früheren
Quellablage jedoch als potenziell offengelegt. Auslagerung ist keine rückwirkende
Geheimhaltung. Koordinierte Schlüsselrotation/Lizenzmigration und vorzugsweise
asymmetrische Lizenzsignaturen bleiben als NW-SECRET-01 offen.

## Prüfnachweise

Gemeinsamer Schlussstand unter Node.js 24.19.0, npm 11.9.0 und Linux am
29.09.2026. Die folgenden Befehle wurden tatsächlich ausgeführt:

| Prüfung | Ergebnis und Beleg |
| --- | --- |
| `npm run build:ts` | Exit 0, 21:24:01–21:24:16 UTC; `hardening-final-build-ts.log` |
| Wetter-/PV-Kompatibilität RC72/74/75/76/77 sowie Wetter-, ACL- und Lizenzregressionen | Exit 0; `hardening-final-weather-compat.log` |
| `npm run sbom:cra -- --require-installed` und `npm run release:generate-manifest` | Exit 0; Produkt-SBOM automatisch vor der Versiegelung erzeugt; `hardening-final-sbom.log`, `hardening-final-seal.log` |
| `npm run test:all` | Exit 0, 21:28:13–21:30:51 UTC, rund 158 Sekunden; `hardening-final-test-all.log` |
| `npm run publish:check` | Exit 0; 401 explizite Paketdateien und aktuelle Quellen-/SBOM-Bindung; `hardening-final-publish-check.log` |
| `npm pack --dry-run --json` | Exit 0; 402 tatsächliche npm-Dateien einschließlich automatisch aufgenommener Paketmetadaten; `hardening-final-pack-dry-run.log` |
| `npm run docs:check` | Exit 0; 234 synchronisierte Modulbeschreibungen; `hardening-final-docs-check.log` |
| Echte lokale npm-Tarball-Erstellung, Entpacken und Prüfungen ohne installierte Abhängigkeiten | Exit 0; 60 SBOM-Komponenten, 400 hashgebundene Paketdateien, 232 JS/MJS-Dateien syntaktisch geprüft und Runtime-Startkette konstruierbar; `hardening-final-packed-sbom.log` |
| `npm run release:approval` | Erwarteter Exit 1 bei `productionApproved: false`; eigenständige Produktivfreigabe weiterhin gesperrt; `hardening-final-production-approval.log` |

Die Gesamtsuite enthält auch die normalen npm-Publish-Lifecycle-Tests in einer
isolierten lokalen Registry-Umgebung. Die Upload-Prüfkette läuft dort trotz
offener Produktivfreigabe erfolgreich; eingebrachte Geheimnis-Fixtures sperren
sie weiterhin. Dies ist kein Nachweis eines tatsächlichen Uploads zu npmjs.org.

Der echte npm-Tarball wurde vollständig auf den ausgelagerten Bestandswert
geprüft: Er ist in keiner seiner 402 Dateien enthalten. Zusätzlich blieb die
gezielte Geheimnisprüfung ohne Treffer. Die separate private ZIP enthält nur
Anleitung, Installer und die private ENV-Datei. Der abschließende Repository-
Scannerlauf steht in `hardening-final-secrets.log`; das vollständige ZIP-Payload
ist in `release-manifests/repository-payload-sha256.json` hashgebunden.

Die drei dokumentierten unabhängigen Nachprüfbefunde sind geschlossen:
gemeinsame vollständige PV-Zeitabdeckung, keine Frische-Erneuerung unveränderter
Tarifdaten bei Fehlern, bestätigte Backup-ACL vor Simulation. Die statische
Nachprüfung ist in `hardening-independent-followup.json` abgegrenzt.

Die npm-Audits für Root, Produktionsabhängigkeiten und Admin-Frontend meldeten
am selben Tag um 20:19 UTC jeweils null bekannte Schwachstellen. Die
Abhängigkeiten wurden im Nachtrag nicht erneut geändert. Das ist eine
zeitpunktbezogene Datenbankauskunft, keine Zusicherung unbekannter Fehlerfreiheit.

Zwischenabschlüsse sind eigene Nachweise. Der als
`hardening-before-pv-review-test-all` erhaltene Zwischenlauf endete beim
Dokumentationsabgleich, weil die letzte PV-Quellkorrektur während dieses Laufs
hinzukam. Danach wurden Runtime und Dokumentation neu erzeugt und die oben
genannte Gesamtsuite erfolgreich wiederholt. Maßgeblich für den gelieferten Stand
ist `final-validation-index.json` mit konkreten Befehlen, Exitcodes und Loghashes.

## Anforderungszuordnung und Grenzen

- [Dauerhafte Entwicklungsleitlinie](../../ENTWICKLUNGSLEITLINIE_SICHERHEIT_DE.md)
- [HTTPS-/CRA-/IEC-Anforderungen](HTTPS_5S_CRA_IEC_ANFORDERUNGEN_DE.md)
- [Wetter und PV](HTTPS_5S_WETTER_DE.md)
- [Tarife](HTTPS_5S_TARIF_DE.md)
- [Lizenzgeheimnis](LIZENZ_SECRET_AUSLAGERUNG_DE.md)
- [Geschützte Konfigurations- und Backup-States](CREDENTIAL_STATE_ACL_DE.md)
- [Geheimnissuche](SECRET_PUBLISH_NACHPRUEFUNG_DE.md)
- [SBOM-Automatik](../../security/SBOM_AUTOMATIK_DE.md)

Kein Server, Raspberry Pi 5 oder aktiver Anlagenaktor wurde in dieser Arbeitsumgebung
verändert oder als geprüft ausgegeben. Keine echte npm-Veröffentlichung ausgeführt.
Node.js-Timer sind kein harter Echtzeitnachweis unter blockiertem Eventloop oder
Betriebssystemlast. Zielhardware, OS-/Controller-/Adaptergesamtsystem, VPN-/TLS-
Betriebsprofil, Wiederherstellung und Herstellerentscheidung bleiben nachzuweisen.
IEC 62443 liefert anwendbare Entwicklungs-, Komponenten- und Systemanforderungen;
diese konkreten Codeprüfungen belegen keine vollständige Norm- oder CRA-Konformität.
