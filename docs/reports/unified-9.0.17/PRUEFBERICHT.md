# NexoWatt EOS 9.0.17 – Änderungs- und Prüfbericht

Stand: 24.11.2026. Technischer Integrations-Teststand für `next`. Ausgangspunkt ist das unveränderte gelieferte vollständige 9.0.16-Repository. Die frühere Version 9.0.8 im Arbeitsbereich wurde nicht als Implementierungsbasis verwendet.

## Anlass und belegter Umfang

Der Nutzer meldet nach Installation von EOS fehlende Icons im Standard-ioBroker-Admin und eine gestörte Backitup-Bedienung; die Störung bleibt nach Entfernen von EOS sichtbar. Das Screenshotbild bestätigt die sichtbaren Icon-Platzhalter, beweist jedoch weder eine bestimmte HTTP-Fehlerursache noch einen Defekt der tatsächlichen Backitup-Sicherung. Die konkrete Live-Datenbank und Browser-Netzwerkantworten wurden nicht ausgelesen.

Der Nutzer bestätigte anschließend, dass der Standard-Admin in einem privaten Browserfenster wieder funktioniert und SSH erreichbar ist. Das ist ein Nutzerbericht über die Browserbedienung; eine dauerhafte Beschädigung der Live-Datenbank oder eine erfolgreiche Backitup-Wiederherstellung ist damit nicht nachgewiesen. Der Nutzer hat die Live-Wiederherstellung ausdrücklich beendet und installiert ioBroker selbst neu. Daher wurden keine weiteren Live-Objekte abgefragt und keine Live-Reparatur durchgeführt. Maßgeblicher Lieferumfang ist die unabhängige parallele Nutzung des korrigierten EOS neben Standard-Admin und Backitup; das lesende Diagnosewerkzeug bleibt nur optional enthalten.

Die Prüfung von 9.0.16 ergab zwei unabhängig nachvollziehbare Fehlerklassen. Nach RFC 6265 Abschnitt 8.5 werden Cookies desselben Hosts nicht durch die Portnummer getrennt. EOS und Standard-Admin verwendeten unter anderem dieselben Namen `access_token`, `refresh_token` und `connect.sid`; EOS löschte zusätzlich generische Cookies. Daneben führte EOS automatische globale Rechte- und Objektpflege aus. Besonders kritisch: Leere EOS-Rollenlisten konnten durch einen Administrator-Fallback mehrfach auf `system.group.administrator` zeigen; eine folgende Rolleninitialisierung konnte dadurch die bestehende Administratorgruppe mit einer anderen Rolle überschreiben. Weiterhin waren globale System-/Enum-/Fremdadapter-ACLs und geerbte Icon-/Geräte-/Benutzerobjektpflege in EOS-Startpfade eingebunden.

## Korrekturen

| Bereich | Verhalten in 9.0.17 |
| --- | --- |
| Browsercookies | Pro EOS-Instanz eigene Namen; vorhandene generische Admincookies werden in EOS nicht als EOS-Anmeldung akzeptiert und von EOS nicht gelöscht. Die private Übersetzung erfolgt am eigenen Server, nicht durch eine globale Änderung der Webserverbibliothek. |
| HTTP und Socket | Die Cookiegrenze erfasst normale Requests und WebSocket-Upgrades, bevor Socket.IO oder Express Authentifizierungsdaten verarbeiten. EOS-Abmeldung betrifft EOS-Cookies; 8188 und ein vorgeschalteter 443-Zugang derselben Instanz bleiben derselbe EOS-Sitzungsbereich. |
| Socket-Geheimnis | EOS speichert sein eigenes persistentes Socket-Geheimnis im privaten Instanzverzeichnis. Ein fehlendes Plattformgeheimnis wird nicht durch EOS neu geschrieben. |
| Adapterweiterleitung | EOS-Anmeldedaten werden nicht an fremde Adapter weitergereicht; fremde Antworten dürfen keine EOS-Cookies setzen oder löschen. |
| Rollen | Leere Rollenlisten verwenden die jeweils vorgesehene EOS-Rolle. Bestehende kundeneigene Benutzer und Gruppen werden beim Start nicht anhand einer EOS-Vorlage überschrieben; nur fehlende dedizierte EOS-Gruppen können angelegt werden. |
| Fremdobjekte | Automatische globale System-/Kategorie-/Fremdadapter-ACL-, Icon-, Geräte- und Metadatenpflege durch EOS wird entfernt. Eigene EOS-Objekte und die explizite serverseitige EOS-Zugriffskontrolle bleiben im vorgesehenen Umfang geschützt. |
| Automatische Updates | Der EOS-Updatemanager schreibt ausschließlich seinen eigenen gesperrten Status. Globale Repository-Reihenfolge, Controller-Updatepolitik und `automaticUpgrade` anderer Adapter werden weder zur Quarantäne noch aus alten Rückfallsnapshots automatisch geändert. Historische Rückfallhinweise bleiben in EOS erhalten. |
| Standard-Backitup | Standard-`backitup` ist keine Quelle der automatischen NexoWatt-Backup-Übernahme. Instanz, Konfiguration, Rechte und vorhandene Sicherungsdateien bleiben außerhalb dieses Übernahmepfads. |
| Wiederherstellung | Ein gesondertes Diagnosewerkzeug prüft vorhandene bekannte Spuren. Keine automatische globale Rechtefreigabe und keine Rekonstruktion unbekannter früherer Rechte beim normalen EOS-Start. |

Die Korrekturen entfernen fremde automatische Wartung aus dem EOS-Lebenszyklus. Ausdrücklich durch einen berechtigten Administrator ausgelöste Systemverwaltungsfunktionen sind ein eigener, weiterhin autorisierter Zugriffspfad. Es wird keine vollständige Isolation zwischen beliebigen ioBroker-Adaptern mit gemeinsamem Betriebssystemkonto und gemeinsamem Datenbankzugang behauptet.

Reguläre Repository-Abfragen und Aktualisierungsanforderungen über die Controller-API können den gemeinsamen Metadaten-Cache auffrischen. EOS verändert dabei weder die Repository-Reihenfolge noch die Updatepolitik oder gespeicherte Adapterkonfigurationen. Vorhandene ausdrücklich als EOS-eigen markierte Konten mit früherem gemeinsamem oder leerem Passwort werden weiterhin sicher stillgelegt; fremde Konten bleiben unverändert.

## Erhaltenes Verhalten

Die in 9.0.16 korrigierten Lade- und Speicherpfade bleiben erhalten: gültige bestehende Geräte-/Installer-/EMS-Konfiguration hat Vorrang vor älteren Sicherungen und Standardwerten. Lesefehler oder ungültige vorhandene Daten lösen keine leere Überschreibung aus. Das Gerätespeichern bleibt vom operativen Modulstart getrennt; vorhandene Geheimnisse und Namensräume werden über den geschützten Konfigurationsspeicher weiterverwendet. Die gemeinsame Lizenz, App-Identität, Bestandsübernahme, zehnminütige serverseitige Inaktivitätsfrist und bisherige Publish-Integritätsprüfung bleiben bestehen.

Eine normale Versionsaktualisierung ist keine erneute Bestandsübernahme. Bereits vor dem Update verlorene Zuordnungen oder geänderte fremde Rechte lassen sich nur mit einem passenden verlässlichen Vorzustand wiederherstellen. Die neue Fassung darf fehlende Sicherungen nicht durch erfundene Standardrechte ersetzen.

## CI und gelieferte Paketbytes

Der Workflow installiert für die UI-Runtime jetzt auch die gesperrten Abhängigkeiten aus `ui/package-lock.json`; dadurch hängt der Runtime-Build nicht von einem zufällig vorhandenen, älteren esbuild im übergeordneten Verzeichnis ab. Die Lifecycle-Skripte der Abhängigkeitsinstallation bleiben ausgeschaltet.

Ein eigener CI-Job sieht die tatsächliche Controller-Integration unter Node 22.23.4 und 24.22.3 vor. Er startet aus einem frischen Checkout des versiegelten Lieferstands, installiert nur die gesperrten Testabhängigkeiten und führt anschließend `npm run test:integration` aus. Vorher wird kein neuer Build erzeugt und keine Versiegelung erneuert: Der Harness muss die gelieferten Paketbytes mit aktivem `prepack`-Integritätsgate installieren. Lesezugriff auf Repositoryinhalte und temporäre Testzugänge genügen; Publish- oder Herstellerschlüssel werden diesem Job nicht übergeben. Die Workflowkonfiguration allein gilt nicht als ausgeführter Nachweis.

## Tatsächliche Verifikation

<!-- FINAL_RESULTS_BEGIN -->
| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| Vollständiges `npm test`, Node.js 22.23.4 | 1441 Tests, 1439 bestanden, 0 fehlgeschlagen, 2 ausgelassen; fünf vollständige Testphasen |
| Vollständiges `npm test`, Node.js 24.22.3 | Gleicher Umfang und gleiche Ergebnisse |
| Typprüfung | Konfigurierte Gesamtprüfung auf Node 22 und Node 24 erfolgreich |
| Linting | Konfigurierte Unified-Prüfung einschließlich Cookiegrenze und Diagnosewerkzeug erfolgreich |
| Builds | Admin-Frontend, Installer, Backend, Module und UI-Runtime erfolgreich |
| Quellen und Dokumentation | Runtime-Synchronprüfung sowie Code-Dokumentationserzeugung und Prüfung erfolgreich |
| UI-Geheimnisprüfung | Erfolgreich; zusätzlich gezielte Paketprüfung im Release-Gate |
| UI-Sicherheitsgate | 210 Quellen, 0 neue blockierte Befunde |
| npm-Audit Laufzeit | 0 gemeldete Advisories |
| npm-Audit Entwicklungsumgebung | 0 niedrige, 14 moderate, 0 hohe und 0 kritische Advisories |
| SBOM | Aktueller Versions-/Quellbezug; Generierung und Vendoring-Abgleich erfolgreich |
| Controller-Integration, Node 22 | 15 bestanden, 0 fehlgeschlagen, 2 ausstehend/ausgelassen; echter lokaler Controller-Harness mit installiertem Paket; siehe Umgebungsgrenzen |
| Controller-Integration, Node 24 | 15 bestanden, 0 fehlgeschlagen, 2 ausstehend/ausgelassen; echter lokaler Controller-Harness mit installiertem Paket; siehe Umgebungsgrenzen |

Die gezielten Parallelbetriebs-, Cookie-, Rechte- und Wiederherstellungstests sind im vollständigen aktuellen Testlauf enthalten. Die konkreten Namen und Fälle stehen in den Rohprotokollen; vorhandene gesonderte Reviews erläutern Modelle und Grenzen. Es wurden 2 Fälle ausgelassen; die konkreten Umgebungsgründe stehen im vollständigen Protokoll. Ein vollständiger Testlauf bestätigt keine Abnahme aller Anlagenfunktionen auf Kundenhardware.

Das UI-Gate erfasst 3222 aktuelle Scannerfundstellen, davon 2952 historisch offene und 270 einzeln geprüfte. Ein bestandenes Delta-Gate ist keine vollständige Sicherheitsprüfung aller geerbten Quellen.

Die Controllerläufe verwenden eine dokumentierte Anpassung der lokalen Testumgebung. Das ist kein unveränderter Host-/LAN-Test: Die genaue EPERM-/Loopback-Bedingung, das verwendete temporäre Verzeichnis und unveränderte Produktgrenzen stehen in `raw/controller-integration-environment.md`; der tatsächlich verwendete Fixturequelltext ist ebenfalls enthalten. Ausstehende/ausgelassene Fälle sind keine bestandenen Prüfungen.
<!-- FINAL_RESULTS_END -->

Die versionsgebundenen Rohbelege werden in `raw/INDEX.json` mit Quell- und Lieferhashes geführt. Testbelege, Quellen, Builds und Version werden vor dem Packen im Release-Nachweis gebunden. Die anschließend erzeugte Repo-ZIP, das npm-Paket, frische Extraktionen sowie tatsächliche `npm publish --dry-run`-Verzeichnisprüfungen erhalten einen gesonderten Liefernachweis. Diese abschließenden Artefaktbelege können nicht in ihrem eigenen Quellhash enthalten sein.

## Grenzen und Abnahme

Reale lokale HTTP-/TLS-/Socket-Tests und kontrollierte Controller-/Dateisystemmodelle belegen die jeweils beschriebenen Softwaregrenzen. Sie ersetzen keine Messung auf der konkreten Kundenanlage. Weder native Windows-Publish-Ausführung noch Smartphonebetrieb, Kundengeräte, reale Backup-Cloudziele oder eine vollständige tatsächliche Backitup-Rücksicherung werden durch einen Linux-Trockenlauf bestätigt. Es erfolgt kein npm- oder Git-Upload im Rahmen dieser Lieferung.

Die vorherige Live-Wiederherstellung ist nicht Bestandteil des aktuellen Auftrags. Für die Neuinstallation steht die Prüfung des unabhängigen Parallelbetriebs im Vordergrund; falls später ein Fehler auftritt, sind Browser-Sitzung, Objekt-/Dateirechte und konkrete Adaptermeldungen getrennt zu beurteilen. Ein neues privates Browserfenster ist ein sinnvoller lesender Vergleich, keine Reparatur beschädigter Datenbankrechte. Unbekannte Vorzustände oder zwischenzeitlich vom Betreiber veränderte Rechte dürfen nicht automatisch zurückgeschrieben werden.

Für die Hausanlagenabnahme sind Standard-Admin und Backitup parallel zu EOS, gegenseitiges An-/Abmelden, unveränderte vorhandene Objekte und Einstellungen, frische Gerätewerte, EMS-Regeltakte sowie ein eigener Backitup-Sicherungsdurchlauf zu prüfen. Die Wiederherstellbarkeit ist in einer getrennten Testumgebung nachzuweisen. Schritte und Rückfallgrenzen stehen in [START_HIER_9.0.17.md](../../../START_HIER_9.0.17.md).

Die Änderungen und Softwareprüfungen sind keine allgemeine Produktionsfreigabe und keine CRA-Zertifizierung. Historische Berichte bleiben historische Belege und werden nicht als erneut durchgeführte Tests ausgegeben.

## Primärquellen

- [RFC 6265, Abschnitt 8.5 – Weak Confidentiality](https://httpwg.org/specs/rfc6265.html#section-8.5): Browsercookies bieten keine Isolation nach Port.
- [ioBroker Webserver, offizielle Implementierung](https://github.com/ioBroker/webserver): gemeinsamer Authentifizierungs-/Webserverkontext; die eigene Cookiegrenze verändert keine geteilte installierte Fremdbibliothek.

Quellenprüfung: 24.11.2026. Diese Quellen begründen die technische Einordnung, nicht eine erfolgte Abnahme der Kundenanlage.
