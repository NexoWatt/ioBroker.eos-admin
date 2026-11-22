# NexoWatt EOS 9.0.1 – Prüf- und Lieferbericht

**Softwareprüfstand und Lieferung · Stand 22.11.2026**  
Produktverantwortung: NexoWatt / Dominique Manteufel  
Technisches Paket: `iobroker.eos-admin@9.0.1` · Repositoryziel: `NexoWatt/ioBroker.eos-admin`


## Ergebnis und Einordnung

Version 9.0.1 führt den gemeinsamen Adapter **NexoWatt EOS** fort und korrigiert insbesondere den Verlust des vorhandenen Administrationszugangs sowie Probleme beim direkten HTTPS-Start. EOS-Admin und die gehostete UI-/EMS-Laufzeit verwenden einen Adapterprozess, eine zentrale Anmeldung und einen zentralen Lizenzdienst. Der technische Namespace bleibt `eos-admin.N`; ein zweiter laufender `nexowatt-ui`-Adapter ist für den gemeinsamen Betrieb nicht vorgesehen.

Der Stand ist für eine kontrollierte Testbereitstellung über den npm-Tag `next` vorgesehen. Die Versionsnummer `9.0.1` enthält selbst keinen SemVer-Vorabversionszusatz. Daraus folgt weder eine Serienfreigabe noch eine Bestätigung der CRA-Konformität. Die nachgewiesenen Softwareprüfungen sind von noch offenen Zielgeräte- und Betriebsprüfungen zu unterscheiden.

Die Ausgangskomponenten und ihre Originalprüfsummen stehen in `docs/unified/BASELINE.md`. Der Prüfbericht `docs/unified/PRUEFBERICHT.md` dokumentiert **historisch 9.0.0-alpha.1**. Seine damaligen Testergebnisse werden nicht rückwirkend geändert und gelten nicht automatisch als Nachweis für 9.0.1. Insbesondere deckte der damalige installierte Test mit vorbereitetem Testkonto und HTTP-Loopback den Erhalt eines vorhandenen `admin.0` und den neuen HTTPS-Zugang nicht ab.

## Wesentliche Korrekturen

| Bereich | Änderung und Bedeutung | Prüfbezug |
| --- | --- | --- |
| Vorhandener Adminzugang | Der frühere automatische Legacy-Admin-Sperrpfad ist entfernt. EOS deaktiviert oder verschiebt `admin.0` nicht mehr wegen der Zusammenführung, auch bei einem gespeicherten alten Sperrflag `true`. Bereits individuell geänderte oder deaktivierte Konfigurationen werden nicht anhand vermuteter Vorgaben zurückgesetzt. | `test/eos-unified-access-recovery.test.cjs`; installierter Test zum Erhalt von Aktivierung, Port und Bindung. |
| Portbindung / `getPort`-Startpfad | Der konfigurierte Port wird vollständig validiert und einmal direkt gebunden. Bereitschaft folgt erst nach erfolgreichem Listenerstart. Ein belegter Port oder eine nicht verfügbare Bindadresse führt zu einem Fehler; es gibt keine stille Portsuche oder Ersatzbindung. | `test/eos-unified-listen.test.cjs`. |
| TLS-Start | Bei `secure: true` darf fehlendes oder unbrauchbares Zertifikatsmaterial keinen HTTP-Ersatzlistener erzeugen. Der Start wird mit begrenzter Diagnose abgewiesen. | TLS-Negativfälle in `test/eos-unified-listen.test.cjs`. |
| Zertifikatsauswahl / SNI / Kette | IP-Zugriffe ohne SNI verwenden das konfigurierte Standardzertifikat samt Zwischenzertifikatskette. Benannte Zertifikatskollektionen bleiben für passende SNI-Namen wirksam. Die zwei korrigierten Zertifikatslogs enthalten nur Verfügbarkeit beziehungsweise Anzahl, keine privaten Schlüsselwerte oder PEM-Blöcke. | Getrennte IP-/SNI-, CA-/Ketten- und Logprüfungen in `test/eos-unified-listen.test.cjs`; Vendoring-Prüfungen. |
| Host / Origin / Navigation | HTTPS-Standardport `:443` und DNS-Groß-/Kleinschreibung werden kanonisch verglichen. Weiterleitungsheader begründen keine zusätzliche Authentisierungsautorität. Ein oberster Navigationsaufruf aus einem bisherigen HTTP-Admin darf nur bekannte Einstiegsseiten erreichen; daraus entsteht keine Ausnahme für fremde API-Schreibzugriffe, eingebettete Frames oder WebSocket-Handshakes. | `test/eos-unified-boundary.test.cjs`; installierte HTTPS-Tests einschließlich normalisiertem Standardport. |
| Übergabe vom alten Regler | Nach einem durch Ownership gesperrten Start kann die gehostete UI später erneut starten, sobald die zentrale Core-Lizenz gültig ist und die Schreibzuständigkeit bestätigt wurde. Beide Bedingungen werden vor operativen Schreibzugriffen erneut geprüft; parallele Aufrufe dürfen keine doppelte Initialisierung auslösen. | `docs/reports/unified-9.0.1/ems/README.md`, Vorher-/Nachherregression und 18 gehostete Laufzeittests. |
| Initiale Rollen-/ACL-Einrichtung | Die erste Rechte-Einrichtung wird vollständig abgewartet, bevor Web/HTTPS initialisiert wird. Ein Fehler öffnet keinen EOS-Webzugang; der vorhandene Admin bleibt erhalten. Frühe oder fehlerhafte interne UI-Nachrichten verursachen keinen Zugriff auf einen noch nicht vorhandenen Socket. | 16 Lifecycle-/Recoverytests, einschließlich verzögerter Initialisierung, Fehlerfall und früher Nachrichten. |
| Stop / früher Startzustand | Frühe Statusereignisse vor Webinitialisierung werden abgefangen. Ein fehlerwerfender oder hängenbleibender Dienststopp darf die übrige Bereinigung nicht unbegrenzt verhindern oder den Abschluss mehrfach auslösen. | Lifecyclefälle in `test/eos-unified-access-recovery.test.cjs`. |

Die entfernte Migrationssperre ist von anderen vorhandenen Verwaltungs- und Sicherheitsmechanismen zu unterscheiden. Die Korrektur hebt beispielsweise die Behandlung ausdrücklich zurückgezogener Adapterversionen nicht pauschal auf.

## Aktuelles Zugangsprofil

Neue EOS-Instanzen verwenden `bind: 0.0.0.0`, Port `8188`, `secure: true`, `auth: true`, `certPublic: defaultPublic`, `certPrivate: defaultPrivate` und eine leere `eosExternalOrigin`. Der direkte Einstieg ist `https://<tatsächliche-Geräte-IP>:8188/`. Bestehende Instanzwerte können davon abweichen. Die EOS-Migration verändert den vorhandenen ioBroker-Adminzugang, üblicherweise Port 8081, nicht über den entfernten Legacy-Sperrpfad.

Das normale erste ioBroker-Setup erzeugt Standardzertifikate. Der beim Controller 7.2.5 geprüfte Erzeugungspfad übernimmt den Rechnernamen in den SAN; ein passender IP-SAN oder der lokale Name `NexoWattEOS` entsteht dadurch nicht automatisch. Zertifikatsnamen, passender SAN und Vertrauen des Clients sind gesonderte Voraussetzungen. `iobroker setup first` ist kein Reparaturbefehl für diesen Zweck, weil er das globale Standard-Schlüsselpaar erneut erzeugt.

Port 443 ist eine **optionale separate Geräte-/Nginx-Einrichtung**. Die neue Vorlage verbindet sich über geprüftes HTTPS mit dem festen Upstream auf 8188 und benötigt konkrete Zertifikat-, CA- und Namensangaben. Für das HTTPS-Profil mit parallelem IP-/Namenszugriff bleibt `eosExternalOrigin` leer; der tatsächlich empfangene Host wird kanonisch geprüft. Nur das ausdrücklich gewählte ältere HTTP-Loopbackprofil arbeitet mit einer exakt festgelegten externen HTTPS-Origin. npm installiert keine DNS-Einträge, richtet keinen Port-443-Systemdienst ein und erteilt dem Adapter weder Rootrechte noch globale Node-Portcapabilities.

`nginx -t` wurde in dieser Prüfungsumgebung **nicht ausgeführt**, weil das Nginx-Binary fehlt. Host-/Originfälle mit `:443` auf einem echten TLS-Listener sind kein Nachweis einer laufenden 443-Proxykette. Die Zielgeräteprüfung mit Frontendzertifikat, Upstream-CA, Namen, WebSocket und SSE bleibt gesondert erforderlich. Anleitungen: `START_HIER_9.0.1.md`, `deploy/README.md`, `deploy/ACCESS_RECOVERY.md` und `docs/unified/INSTALL_PUBLISH.md`.

## Ausgeführte Softwareprüfungen

Prüfumgebung: Linux, UID 1000, Node.js 24.22.3, npm 11.19.1. Es wurden keine Kundenanlage und keine realen Energiegeräte angesteuert. Mehrere Testgruppen sind Teilmengen anderer Gruppen; die Zahlen dürfen nicht zu einer vermeintlich unabhängigen Gesamtsumme addiert werden.

| Prüfung | Ergebnis / Umfang | Belegstand |
| --- | --- | --- |
| Backendbuild und Typecheck | Bestanden. Backendquellen und generierte Laufzeit gebaut; Typecheck ohne Fehler. | Belege unter `docs/reports/unified-9.0.1/`: `backend-build.log`, `typecheck.log`. |
| Neues Sicherheits-/Integrationslint und geändertes Backend-TS | Bestanden. Aussage gilt für die angegebenen Prüfbereiche, nicht für eine neue Vollfreigabe sämtlicher historischer Quellen. | Belege unter `docs/reports/unified-9.0.1/`: `unified-lint.log`, `changed-backend-lint.log`. |
| System- und Installerfrontend, UI-Runtime-Build | Quellbuilds bestanden. | Belege unter `docs/reports/unified-9.0.1/`: `frontend-build.log`, `installer-build.log`, `ui-runtime-build.log`. |
| Systemfrontendtests | 6 bestanden. | `docs/reports/unified-9.0.1/frontend-tests.log`. |
| Frontend-Buildbeleg / Assetgraph | 4 Tests bestanden; Graphprüfung bestanden. | `docs/reports/unified-9.0.1/frontend-receipt-tests.log`, `frontend-graph.log`; Beleg unter `docs/reports/unified-9.0.1/`: `frontend-final-graph.log`. |
| Unified-Suite | 204 Fälle: 203 bestanden, 1 übersprungen. Ausschließlich die bedingte Nginx-Syntaxprüfung wurde wegen des fehlenden Binary übersprungen. | `docs/reports/unified-9.0.1/unit-tests.log`. |
| Beibehaltene Sitzungs-/Auth-/Uploadregressionen | 48 bestanden. | Beleg unter `docs/reports/unified-9.0.1/`: `unit-tests.log`. |
| Vendoring / Herkunft / Integrität | 11 bestanden, einschließlich unerlaubter Änderungen und Substitutionen. | Beleg unter `docs/reports/unified-9.0.1/`: `vendor-tests.log`. |
| Gehostete UI-Laufzeit | 18 bestanden, bereits in den 203 erfolgreichen Unified-Fällen enthalten. | `docs/reports/unified-9.0.1/ems/ownership-resume-after.tap`. |
| NVP / dynamischer Netzanschluss | 208 bestanden, keine übersprungen. | `docs/reports/unified-9.0.1/ems/nvp-dynamic-grid.tap`. |
| Erhaltene EMS-/Ladefälle | 20 Prüfskripte jeweils mit Exitcode 0. Dies bezeichnet Skripte mit jeweils eigenen Assertions, keine 20 Hardwaretests. | `docs/reports/unified-9.0.1/ems/ems-regressions.json` und zugehörige Logs. |
| Kanonische UI-Quellen | 163 produktive Runtime-Dateien stimmen mit der kanonischen TypeScript-Quelle überein. | `docs/reports/unified-9.0.1/ems/runtime-executables-check.log`; Beleg unter `docs/reports/unified-9.0.1/`: `ui-final-canonical.log`. |
| Installiertes Paket / frischer Controller / HTTPS | 11/11 bestanden, einschließlich echtem Prozessneustart. | `docs/reports/unified-9.0.1/integration-release.log`. |
| Abschließendes npm-Pack, vollständiges ZIP und Versiegelung | Bestanden: npm-Pack und Publish-Dry-Run mit Tag `next`; alle Tar-Dateien byteweise mit dem geprüften Repository verglichen; vollständiges ZIP neu entpackt und Release-/Vendor-/SBOM-Prüfungen ohne installierte Abhängigkeiten bestanden. Keine verbotenen Archivpfade, mitgelieferten node_modules/Git-Metadaten oder privaten PEM-Schlüssel gefunden. 805 produktive Dateien stimmen byteweise mit dem tatsächlich installierten und neu gestarteten Testpaket überein. Der finale Lieferlauf wiederholt die Archivprüfung nach Abschluss dieses Berichts. Der Publish-Dry-Run ist keine Veröffentlichung und prüft keine Kontoberechtigung. | Finale SHA256SUMS-Datei und Release-Manifest im Repository. |

Die EMS-Prüfungen umfassen unter anderem OCPP, Auto-/PV-Orchestrierung, §14a-Kommunikationsausfall, günstige Netzladefenster, bestätigte Modusschreibvorgänge, Nulleinspeisung, Speicherprobe und Heizstab. Sie arbeiten mit isolierten Modulen beziehungsweise synthetischen Zuständen. Eine Timing-, Interoperabilitäts- oder Anlagenabnahme ist daraus nicht abzuleiten.

### Installierte Controllerintegration

**11/11 Prüfungen bestanden** auf dem abschließenden Softwarestand. Zusätzlich bestand der vorherige isolierte Kandidat nach Einbau der Initialisierungsbarriere ebenfalls alle 11 Fälle. Es wurden frische, getrennte Testverzeichnisse aufgebaut: ioBroker-Controller **7.2.5**, echte Objekt-/State-Datenbanken und echte Adapterprozesse mit TLS auf **8188**. Beleg: `docs/reports/unified-9.0.1/integration-release.log`; ergänzender Kandidatenlauf: `integration-candidate.log`.

Die Tests prüfen vorhandene, zusammenpassende Controller-Standardzertifikate vor dem Einsetzen kurzlebiger Testzertifikate. Die HTTPS-Clients verlangen vertrauenswürdige CA und passende Namen; die TLS-Prüfung wird nicht abgeschaltet. Abgedeckt sind Loginressourcen, falsche CA und falscher Hostname, IP-/Namens-Authorities samt normalisiertem `:443`, begrenzte Top-Navigation vom HTTP-Admin, anonyme und fremde Originzugriffe, Secure-/HttpOnly-Cookie, zentrale Aktivierungsweiterleitung, CSRF/Logout, Stop und echter Prozessneustart gegen dieselbe Datenbank. Ein Login wird im Test nicht bei Fehlern wiederholt.

Der aktivierte `admin.0`-Objektbestand mit Port 8081, Bindung `0.0.0.0` und Authentisierung bleibt während Start, wiederholter Objektänderungen, Stop und Neustart erhalten, obwohl ein altes EOS-Sperrflag gesetzt ist. Der Test startet **keinen eigenen alten Admin-Webserver**; er belegt tatsächliche EOS-Prozess- und Datenbankwirkung. `:443`-Authorityfälle laufen über den tatsächlichen 8188-TLS-Socket und sind kein laufender Nginx-/Port-443-Nachweis.

Die Ausführungsumgebung erlaubt keine reguläre Netzwerkschnittstellen-Aufzählung. Die ausdrücklich optierte Testfixture `test/fixtures/loopback-network.cjs` ersetzt ausschließlich `os.networkInterfaces()` durch Loopbackdaten; Datenbanken, Prozesse, TCP und TLS bleiben real. Die Tests verwenden ein vorbereitetes Konto mit individuellem Zufallspasswort. Browserbedienung und der vollständige Erstbenutzerassistent einer Kundeninstallation wurden nicht automatisiert abgenommen.

Zwei Entwicklungs-Vorläufe hatten jeweils 10 bestandene und einen fehlgeschlagenen Fall. Beim ersten erwartete der Test fälschlich, dass der reine Datenbank-Testharness den vom echten Host nach Prozessende gesetzten Alive-Zustand selbst aktualisiert. Die Fixture prüft nun zunächst Prozessende und geschlossenen Port und bildet anschließend diesen fehlenden Host-Schritt gezielt nach. Im zweiten Vorlauf wurde ein früher Login mit HTTP 400 abgewiesen. Die parallel zum bereits erreichbaren Webzugang laufende erste Rechte-Einrichtung wurde daraufhin im Produkt serialisiert; Regressionen sichern diese Startbarriere ab. Der generische OAuth-Fehler beweist die Einzelursache des damaligen 400 nicht allein. Die beiden anschließenden vollständigen Läufe bestanden ohne Login-Retry. Bereinigte Vorlaufbelege liegen ebenfalls im Berichtordner.

Die installierten Testinstanzen blieben ohne produktiven Aussteller-Truststore **unlizenziert** und meldeten `TRUST_PERMISSIONS`. Damit wurden unaktivierter Einstieg und Aktivierungsweiterleitung geprüft. Eine erfolgreiche Lizenzierung dieser installierten Instanzen oder einer realen Anlage wird nicht behauptet; positive Signatur-/Speicher-/Neustartfälle sind gesonderte Lizenzdiensttests.

## Lizenzierung und Anmeldung

Die gemeinsame Anmeldung beruht auf dem vorhandenen ioBroker-OAuthpfad. Der erforderliche Erstpasswortwechsel ist unterstützt. Danach wird bei fehlender Freigabe die zentrale Aktivierung angezeigt. Eine gültige Lizenz wird einmal eingetragen und verschlüsselt gespeichert; Systembereich und gehostete UI verwenden denselben Dienst. Es gibt keine zweite UI-Aktivierung. Ein Verlust beziehungsweise Wechsel der System-UUID oder der zugehörigen Schlüssel-/Lizenzablage kann eine Wiederherstellung oder Neuausstellung erforderlich machen.

Die NWL3-Prüfung folgt dem tatsächlichen Vertrag des **Keygen 1.0.4**. Die positive Ausstellerinteroperabilität und die verschlüsselte Wiederverwendung nach Dienstneustart sind durch isolierte Lizenzprüfungen belegt. Diese Aussage ist von der hier unaktivierten installierten Controllerinstanz getrennt. Historische Lizenzprüfbelege stehen unter `reports/unified/licensing/`; ihre Reichweite und der aktuelle Vertrag sind in `docs/licensing/ISSUER_AND_STORAGE.md` beschrieben.

Vor Aktivierung muss der Hersteller beziehungsweise ein berechtigter Systemadministrator den **öffentlichen** Aussteller-Vertrauensanker mit korrekten Eigentümer- und Dateirechten bereitstellen, bevorzugt `/etc/nexowatt-eos/license-trust.json`. Der alte Pfad `/etc/nexowatt/license-trust.json` wird nur verwendet, wenn der bevorzugte Pfad fehlt. Diese administrative Provisionierung verlangt geschützte root-eigene Pfade; der Adapter selbst läuft ohne Root. Private Ausstellerschlüssel, Keygen-Tresor und voraktivierte Kundenlizenzen gehören nicht in das Paket und nicht auf die Kundenanlage.

Eine vorhandene NWL2-Lizenz erweitert ihren signierten Umfang nicht allein durch den Merge: Core-/EMS-Freigabe verlangt die dafür berechtigte Adapterliste; ein historisches `eos-admin`-Recht allein wird nicht zu einer UI-/EMS-Lizenz aufgewertet. Für bereits konfigurierte Automatik gilt weiterhin die dokumentierte Fortführung innerhalb zuletzt validierter, eingefrorener Grenzen. Die verbleibende Trennung zwischen Schutzhandlungen und neuen wirtschaftlichen Aufträgen ist unter **LIC-RUNTIME-01** offen; Einzelheiten stehen in `docs/unified/LICENSING_RUNTIME_LIMITS.md`.

TOTP-Challenge und Passkeys sind nicht implementiert. Konten mit vorhandener TOTP-Konfiguration oder fehlerhafter externer Authentisierung werden sicher abgelehnt; es gibt keinen Passwort-Umgehungsweg. Logout widerruft derzeit die globale Sitzungsepoche und damit alle parallelen Sitzungen samt Socket/SSE. Ein reiner Einzelsitzungslogout wird nicht zugesagt.

## Abhängigkeiten und Lieferintegrität

Die Auditaufnahme für 9.0.1 meldet im Laufzeitbaum **0 bekannte npm-Auditbefunde**. Systemfrontend und Installer melden ebenfalls 0 bekannte Auditbefunde. Der Entwicklungs-/Buildbaum enthält **14 moderate**, **0 hohe** und **0 kritische** Befunde. Ein leerer Auditbefund ist kein Nachweis der Abwesenheit unbekannter Schwachstellen; die Buildbefunde werden nicht als behoben dargestellt.

Versionsgebundene Belege: `docs/reports/unified-9.0.1/dependency-results.json` und die vier zugehörigen Auditdateien. Die Runtime-SBOM enthält **304 Komponenten**: 303 aus dem Produktionsabhängigkeitsgraphen und den geprüften, lokal angepassten WebServer. Die npm-11-Filterausgabe mit `--omit=dev` ließ mehrfach verwendete Produktionsabhängigkeiten aus. Daher wird der Runtimegraph reproduzierbar aus der vollständigen 717-Komponenten-SBOM ab den 23 gelockten Produktionswurzeln abgeleitet. Keine Abhängigkeitsreferenz fehlt; sechs Tests, Idempotenzprüfung und das offizielle CycloneDX-1.5-Schema bestätigen die Struktur. Der Vendor-Eintrag erhält ursprüngliche MIT-Lizenz, Originalarchivhash und gebundene Patch-Provenienz. Beleg: `reports/unified/sbom-vendored-proof.json`. Komponentenübersichten allein ersetzen keine Produkt-Risikobewertung.

Bestanden: npm-Pack und Publish-Dry-Run mit Tag `next`; alle Tar-Dateien byteweise mit dem geprüften Repository verglichen; vollständiges ZIP neu entpackt und Release-/Vendor-/SBOM-Prüfungen ohne installierte Abhängigkeiten bestanden. Keine verbotenen Archivpfade, mitgelieferten node_modules/Git-Metadaten oder privaten PEM-Schlüssel gefunden. 805 produktive Dateien stimmen byteweise mit dem tatsächlich installierten und neu gestarteten Testpaket überein. Der finale Lieferlauf wiederholt die Archivprüfung nach Abschluss dieses Berichts. Der Publish-Dry-Run ist keine Veröffentlichung und prüft keine Kontoberechtigung.

Die endgültigen Lieferdateien heißen `NexoWatt_EOS_9.0.1_FULL_REPOSITORY.zip`, `iobroker.eos-admin-9.0.1.tgz`, `NexoWatt_EOS_9.0.1_Pruefbericht.md` und `START_HIER_9.0.1.md`. Ihre Prüfsummen stehen in der daneben ausgelieferten `NexoWatt_EOS_9.0.1_SHA256SUMS.txt`; wegen der Einbettung dieses Berichts enthält er keinen zirkulären eigenen Archivhash. Das Repository enthält zusätzlich `release-manifests/unified/files.json` für die geprüften Quellen, Runtime, Manifeste und Nachweise. Dies sind Integritätsnachweise, keine digitale Herstellersignatur und keine Produktfreigabe. Es wurde nichts nach Git oder npm veröffentlicht.

NexoWatt-eigene Anteile bleiben proprietär und werden nach der vereinbarten Lizenz genutzt. Die Rechte übernommener Drittanbieter bleiben unverändert. `LICENSE`, `LICENSE-NEXOWATT.md` und `THIRD-PARTY-NOTICES.md` sind Bestandteil der Lieferung. Die öffentliche Verfügbarkeit eines ungescopten npm-Pakets bedeutet, dass seine Dateien heruntergeladen werden können; sie verleiht keine weitergehenden proprietären Nutzungsrechte und stellt keinen Vertraulichkeitsschutz bereit.

## Offene Abnahme und Freigabegrenzen

| Punkt | Verbleibende Grenze / nächster Nachweis |
| --- | --- |
| Installierter Gesamtweg | Die Softwareintegration ist bestanden. Zielgeräte- und Browserabnahme mit der tatsächlichen Installation bleibt erforderlich. |
| Zielgerät und Erstinbetriebnahme | Reales Administrator-Setup, Zertifikatsvertrauen, IP-/Namens-SAN, Wiederherstellung und einmalige Aktivierung auf dem vorgesehenen Gerät abnehmen. Kein lizenzierter Hardwaretest ist hier belegt. |
| Optionaler 443-Eingang | Tatsächliches `nginx -t`, TLS-Frontend und geprüftes TLS-Upstream, lokale Namensauflösung, Browser, WebSocket und SSE auf dem Zielgerät prüfen. |
| EMS / gemeinsamer Prozess | Pi-/IPC-Last, Eventloop, 50-/100-ms-Ziele, Kommunikationsausfall, Wiederanlauf und Geräteverhalten prüfen. Die gemeinsame Laufzeit besitzt keine separate Worker-/Prozessisolierung für die EMS-Regelung. |
| Schreibzuständigkeit / Migration | Offlineplan, Backup/Restore, externe Stateverweise und tatsächlichen Stopp des Altreglers abnehmen. Die Softwareprüfung ersetzt keine atomare Gerätesperre gegenüber einem manuell neu gestarteten Altprozess. |
| Authentisierung | Unterstützten TOTP-/Passkeyflow gesondert entwickeln und prüfen. Globalen Logout als aktuelles Mehrnutzerverhalten berücksichtigen. |
| LIC-RUNTIME-01 | Schutzfunktionen und neue wirtschaftliche Aufträge bei Lizenzverlust fachlich trennen und an den Geräte-/Auftragsgrenzen nachweisen; Details und Folgepunkte im Lizenzlaufzeitvermerk. |
| Entwicklungsabhängigkeiten | Die 14 moderaten Buildbefunde kontrolliert behandeln; Entwicklungsserver gehören nicht in die Kundenbereitstellung. |
| CRA / Herstellerentscheidung | Produktgrenze, Risikobewertung, technische Unterlagen, Schwachstellen-/Support-/Meldeprozess und unabhängige Abnahme vervollständigen. Maßgeblich sind `docs/unified/SECURITY_CRA.md`, `SOURCES.md` und `COMMISSIONING.md`; dieser Softwarebericht ist keine Konformitätserklärung. |
| Veröffentlichung | Die Repositoryadresse ist ein Ziel; Git-/npm-Upload wurde nicht ausgeführt. Konto-/Namensberechtigung und Verfügbarkeit der Versionsnummer beim tatsächlichen Publish prüfen. |

Der vorgesehene Verteilungsstatus bleibt **9.0.1 über `next` zur kontrollierten Erprobung**. Die Belege beschreiben konkrete durchgeführte Prüfungen und ihre Grenzen; sie begründen keine hundertprozentige Fehlerfreiheit und keine allgemeine Produktionsfreigabe.
