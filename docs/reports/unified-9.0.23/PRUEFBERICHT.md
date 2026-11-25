# NexoWatt EOS 9.0.23 / OCPP 0.4.3 – konsolidierter Prüfbericht

Stand: 25.11.2026. Grundlage ist der ausgelieferte EOS-9.0.22-Stand; OCPP beruht auf dem vom Nutzer bereitgestellten Adapter 0.4.2. Dieser Bericht führt die lokalen Entwicklungs-, Integrations- und Reviewbelege zusammen. Es wurde keine Kundenanlage aktualisiert und keine physische Wallbox angesteuert. Die Teilberichte und Rohprotokolle in diesem Verzeichnis bleiben maßgeblich für den jeweiligen Prüfaufbau.

## Umsetzung und tatsächliche Prozessgrenzen

| Laufzeit | Tatsächliche Grenze |
| --- | --- |
| EOS Admin, Anmeldung, HTTPS, zentrale Verwaltung | Eigener ioBroker-Adapterprozess, Compact-Modus deaktiviert |
| Bestehende Oberfläche und EMS | Gemeinsam in einem beaufsichtigten Node-Kindprozess |
| Geräteanbindung | Eigener Node-Kindprozess; einzelne Gerätetreiber teilen diesen Prozess |
| EEBUS | Eigener Node-Kindprozess |
| Backup | Eigener Node-Kindprozess; bestehende Backup-Jobprozesse zusätzlich separat |
| OCPP 0.4.3 | Eigener ioBroker-Adapter `ocpp21`, Compact-Modus deaktiviert |

Die produktiven Defaults verwenden echte Betriebssystemprozesse und getrennte Heaps/Eventloops. Vorhandene Factory-Injektionen bleiben für abgegrenzte Bestandstests erhalten. Die UI-/EMS-Weiterleitung erfolgt über privaten Loopback-HTTP-Verkehr mit einmaligem, kurzlebigem und an Anfrage/Generation gebundenem IPC-Kontext; öffentliche Anmeldung, Rollen, Origin/CSRF und HTTPS bleiben beim bestehenden Zugang. Der Child erhält keine uneingeschränkte Owner-Referenz.

IPC-Nachrichten, parallele Aufträge, Streams, Timer und Warteschlangen sind begrenzt. Der Parent prüft aktuelle Generation und Ownership vor Schreiboperationen, überwacht Heartbeats und wartet bei Stop/Neustart auf Prozessende, Subscription-Bereinigung und bereits angenommene Mutationen. Ungeklärte Writes erlauben keinen konkurrierenden Ersatzregler. Veraltete Antworten/Freigaben erneuern keine Berechtigung. Die vorhandene Lizenzpolitik und gerätespezifischen Schutz-/Wiederanlaufregeln bleiben maßgeblich.

Prozessisolation begrenzt Fehlerauswirkungen, stellt aber keine OS-Sandbox, harte RAM-Quote oder garantierte Echtzeit dar. Betriebssystem, Dienstkonto, Controller und physische Anlage bleiben gemeinsame Abhängigkeiten. UI und EMS sind ausdrücklich nicht gegeneinander prozessisoliert.

## Erhaltene Korrekturen aus 9.0.22

Energiefluss und Gebäudelast behalten die korrigierte Bilanzierung mit Originalzeitstempeln, Qualitätsprüfung und eindeutiger Unterscheidung zwischen gemessenem Nullwert und fehlendem/veraltetem Wert. Nicht plausible Bilanzen werden kenntlich gemacht; fehlende Leistung wird nicht durch erfundene Nullwerte oder unabhängige Zahlenglättung verdeckt. Zusätzliche Erzeuger werden im gemeinsamen Datenvertrag dedupliziert berücksichtigt.

Die Tarifanzeige nutzt den tatsächlichen Runtime-Namensraum und frische Statusdaten einschließlich atomarer PV-Reserveinformation. Der Null-/Leerwertschutz im Speicherregler, der reine PV-Ladepfad und der sichtbare 5-Sekunden-Anzeigetakt bleiben enthalten. Neue Prozessgrenzen ersetzen diese Fachlogik nicht. Die Gesamtregression unten dient der erneuten Absicherung; frühere 9.0.22-Prüfungen werden hier nicht als neue 9.0.23-Hardwareprüfung ausgegeben.

## Nachweise nach Bereich

Ausgeführt wurde unter Linux mit **Node.js 22.23.4 und 24.22.3**. Eine Versionsangabe in einer Zeile gilt nur für den dort genannten Lauf. Testgruppen überschneiden sich teilweise; ihre Zahlen dürfen nicht zu einer vermeintlichen Gesamtzahl addiert werden.

| Bereich | Vorliegender Nachweis | Aussagegrenze / Beleg |
| --- | --- | --- |
| Devices-/EEBUS-/Backup-Prozesse | 19/19 fokussierte Fälle unter Node 24; separat 12/12 unabhängige Vertragsfälle jeweils unter Node 22 und 24 | Echte PIDs, Crash/Blockade/Neustart, Fristen, Generationen, Callback/ACK, Streamabbruch und vollständiger 32-MiB-Transfer. Produktionsmodule mit leeren/deaktivierten Geräte-/Netzwerkpfaden gestartet. `MODULE_PROCESS_IMPLEMENTATION.md`, `module-process-final.tap`, `module-process-contract-review-node22.tap`, `module-process-contract-review-node24.tap` |
| Bestehende Modulverträge | 65/65 Host-, Stop-, Save-, Migration-, Kommando- und EEBUS-Fälle | Lokaler terminalseitiger Lauf; Dateiliste im Modulbericht. Kein vollständiger Anlagenbetrieb |
| UI-/EMS-Prozess und Credentialcodec | 17/17 Haupt-/Review-/Codec-Fälle jeweils unter Node 22 und 24 | Echte Child-Prozesse/HTTP, Auth-/Replay-/CSRF-Fälle, Streaming, langsame Historienantworten, abgelaufene Writes, Parent-SIGKILL, originale Controller-Cryptofunktionen. `UI_EMS_PROZESSGRENZE.md`, `raw/ui-process/` |
| Tatsächlicher UI-/EMS-/CM-Start und unabhängige Nachprüfung | 6/6 kombinierte operationale/Codec-Fälle jeweils unter Node 22 und 24 | Originale UI, EMS und Charging-Management laufen im Child; Scheduler wächst, Subscriptions schließen. Synthetische DB-Fassade und begrenzter Controller-Dateilokator. `UI_PROCESS_INDEPENDENT_FOLLOWUP.md`, `ui-process-final-review-node22.tap`, `ui-process-final-review-node24.tap` |
| Web-/Geräte-/EMS-Gesamtkette | 13/13 Fälle jeweils unter Node 22 und 24 | Bestandspipeline mit expliziter Test-Factory plus echter Child-Pfad über `Web.mountUnifiedRuntime`, HTTP-Gerätesave, IPC-Reconciliation, Installer-Persistenz und EMS-Heartbeat. `raw/ui-process/web-pipeline-node22.tap`, `web-pipeline-node24.tap` |
| Automatische OCPP-Zuordnung | 13/13 einschließlich bereitgestellter Adapterquelle, zusätzlich 40/40 Lifecycle-/Reconfiguration-Fälle | Reale Produktmodule mit simulierter ioBroker-Persistenz; zwei EVSE ergeben eine native Stationszeile. Browserprüfung der tatsächlichen Installerartefakte auf Desktop/Mobil. `OCPP_AUTOMATISCHE_ZUORDNUNG.md` |
| Tatsächliches Charging-Management / OCPP-Rückmeldung | 20/20 gemeinsame CM-, Feedback- und Pure-PV-Fälle; tatsächlicher 0.4.3-Handler zusätzlich 11/11 einschließlich Unterfällen unter Node 24 | Finaler Writer, W/A-Abgrenzung, Nullprofil, atomare Sessionbestätigung, doppelte Writer, Lease-Fehler/Erneuerung, Legacy-Connectoren. Transportantworten teils simuliert. `OCPP_CM_INTEGRATION.md`, `raw/current/ocpp-runtime-feedback-tests.txt`, `evcs-stop-writer-ocpp043.txt` |
| OCPP-Adapter 0.4.3 | Je Node-Version 74/74 Core-/Runtime-/Vertragsfälle, 46/46 Paketfälle, 2/2 Controller-/Loopback-Integrationen | Echte lokale ioBroker-Testdatenbank, js-controller 7.2.5, separater Adapterprozess und OCPP-WebSocket; Station simuliert. Der zusätzliche alte Startup-Marker 1/1 hat keine funktionale Aussage. `OCPP_0.4.3_PRUEFBERICHT.md`, `OCPP_0.4.3_ERGEBNIS.json` |
| Prozessdiagnose | 15/15 HTTP-/Statusfälle, strikte Typ-/Lintprüfung; echter Chromium 158 Desktop 1440 px/Mobil 390 px | 5-Sekunden-Timer, Single-Flight, Fehler/403, Hidden/BFcache; tatsächliche Seite/Route, simulierte Prozess-/Controllerwerte. `PROZESSDIAGNOSE.md`, `raw/current/runtime-health-*` |
| Neue Prozess-/Diagnose-/Discovery-Typgrenzen | Separate strikte TS- beziehungsweise `checkJs`-Prüfungen und typbewusstes Lint bestanden | Die neue JS-Prozessprüfung aktiviert ausdrücklich `strict` und `checkJs`; der allgemeine Build mit `checkJs:false` wird nicht als Ersatz gezählt. Konfigurationen/Rohlogs in den Bereichsberichten |

**Vollständige abschließende EOS-Regression und Releaseprüfungen:** Jeweils **2.331 Fälle, 2.329 bestanden, 0 Fehler, 0 abgebrochen, 2 übersprungen** unter Node 22.23.4 und Node 24.22.3. Die beiden übersprungenen Fälle benötigen nginx beziehungsweise POSIX-ACL-Werkzeuge, die in der Testumgebung fehlen. Die optionalen Keygen-, realen isolierten InfluxDB- und aktuellen OCPP-Quellprüfungen wurden ausgeführt. Build, globale Typprüfung und verbindliches Linting bestanden. Die fünf vollständigen Testphasenzusammenfassungen und ihre Prüfsummen stehen in `raw/INDEX.json` sowie `raw/node22-tests-final.log` und `raw/node24-tests-final.log`.

Die globale abschließende Typprüfung wurde durch die Releaseintegration bereits erfolgreich ausgeführt. Die Prozessdiagnose behandelt eine fehlende globale OCPP-Verbindungsmeldung ausdrücklich als unbestätigt: Der tatsächliche Adapter 0.4.3 publiziert keine passende Root-`info.connection`. Prozess-Alive und PID bleiben getrennt auswertbar; daraus wird kein grüner Stationsverbindungsstatus erfunden. Details stehen in `PROZESSDIAGNOSE.md`.

## Gefundene Fehler und nachvollziehbare Testanpassungen

Der unabhängige Review beseitigte vier Backup-Streamfehler: falsche Buffersemantik, Cleanup vor erstem Lesen, verspätetes Öffnen nach Abbruch und Ablehnung zusammengefasster Datenblöcke. UI-seitig wurden verspätete Lease-Erneuerung, ein Subscription-ACK-Rennen und eine kurzzeitig falsche Bereitschaft nach Prozessende korrigiert. Ein tatsächlicher Credentialfehler durch nicht vorhandene SDK-Exports wurde durch einen typisierten, gegen originale Controllerfunktionen geprüften Kompatibilitätscodec ersetzt. AES-192-CBC-/Legacy-XOR-Bestandsdaten und die Influx-Quarantäne bei fehlendem Schlüssel bleiben erhalten.

Die alte Web-Pipeline erwartete eine direkt im Testprozess beobachtbare UI-Instanz; diese Annahme galt nach der produktiven Prozessauslagerung nicht mehr. Ihre Fachfälle wurden mit einer ausdrücklich injizierten Test-Factory erhalten und um den echten Child-Pfad ergänzt. Der fehlende vollständige Controller im Executor erforderte einen begrenzten Dateilokator im Test. Eine anfänglich falsche synthetische Lizenz-Fixture wurde auf den tatsächlichen zentralen Grant korrigiert. Diese Anpassungen verändern keine produktive Logik. Auch die alten Idle-/PWA-/Start-Fixtures verwenden nun ausdrücklich diese Testgrenze; sämtliche bisherigen Assertions bleiben erhalten. Idle/PWA bestanden unter Node 22/24 jeweils mit Quell- und Build-Variante (8/8). Die Start-/TLS-Datei bestand unter beiden Versionen (31/31), einschließlich zusätzlichem echtem Web/TLS→UI-Child-Test für Session, Origin, CSRF und erreichbare Wiederherstellung nach Child-Ende.

Die anfänglich nicht abgeschlossenen Gesamtläufe wurden nicht als Erfolgsnachweise verwendet. Die Diagnose isolierte die alte Web-Pipeline-Fixture als wartenden Ressourcenhalter; UDP- und Start-Lifecycle-Dateien bestanden und beendeten sich regulär. Die Gesamtregression verwendet begrenzte Testparallelität, um den Ressourcenbedarf reproduzierbar zu halten. Es wurde kein erzwungenes Prozessende als Erfolgsnachweis eingesetzt. Beim unabhängigen Backup-Prozesstodtest lieferte Linux während des gleichzeitigen Prozessendes neben `ENOENT` auch `ESRCH` beim Lesen von `/proc/.../stat`. Nur diese beiden Zustände gelten nun als bereits beendet; andere Lesefehler werden weiterhin geworfen. Danach bestanden dieselben zwölf Fälle unter beiden Node-Versionen.

Beim OCPP-Controller-Setup verhindert die Executor-Netzwerkerkennung den unveränderten Lauf. Ausschließlich die dokumentierte `NODE_OPTIONS`-Hostfixture liefert für die erfolgreichen Integrationstests einen Test-Netzwerkbestand. Datenbank, Adapterprozess und WebSocket-Verkehr sind real; Host-Netzwerkerkennung und physische Station sind damit nicht abgenommen. Der fehlgeschlagene unveränderte Lauf bleibt dokumentiert.

## OCPP-Vertrag, Lease und Abhängigkeiten

Automatisch erkannte native Stationen erhalten genau eine stationsweite Zuordnung und bleiben bis zur Inbetriebnahme deaktiviert. Fehlende elektrische Grenzwerte werden nicht geraten. Eine bestehende reine Messzuordnung erhält nicht automatisch ihren ersten Stellpfad. Mehrdeutigkeit, Lizenzgrenze und unvollständiger Vertrag bleiben sichtbar. Bereits vorhandene unabhängige Legacy-Connectoren werden nicht mit dem nativen gemeinsamen Stationsaktor gleichgesetzt.

EOS unterscheidet Datenpunkt-ACK, angenommene OCPP-Profilvorgabe und gemessene Leistung. 0 W bleibt ein echtes Nullprofil; alte Sessions, Pending/Rejected, schlechte Qualität und fehlende Originalzeitstempel liefern keine Bestätigung. EOS erneuert die native Prozessfreigabe alle 5 Sekunden mit 15 Sekunden Frist. Der unabhängige OCPP-Watchdog prüft jede Sekunde, sperrt bei Ablauf positive Vorgaben und fordert 0 W an. Eine neue Lease stellt keine alte positive Leistung automatisch wieder her. Die Tests enthalten eine reale positive Loopback-Freigabe, ausgelassene Verlängerung und anschließendes Nullprofil/Accepted.

Diese Fristen garantieren keine elektrische Abschaltzeit: Ein bereits laufender Protokollauftrag, sein Timeout, eine unterbrochene Verbindung oder nicht reagierende Hardware können den Stopp verzögern oder verhindern. Accepted bestätigt die Profilannahme, nicht die tatsächlich erreichte Nullleistung. Bei ausgefallenem OCPP-Prozess oder Rechner kann dessen Watchdog keine physische Aktion ausführen.

Der gespeicherte EOS-Produktionsaudit meldet **0 Einträge**. Der OCPP-Produktionsaudit meldet **2 moderate, 0 high, 0 critical**: AJV und das davon abhängige `ocpp-rpc`, Advisory `GHSA-2g4f-4pwh-qvx6`. Der geprüfte Validator aktiviert die betroffene `$data`-Option nicht; die Meldung bleibt offen. Ein versuchtes AJV-Override wurde wegen reproduzierbarer inkompatibler URN-Verarbeitung vollständig zurückgenommen. `npm-shrinkwrap.json` und die aus dem installierten Produktionsbaum erzeugte SBOM dokumentieren den verwendeten Stand. Es wird keine allgemeine Schwachstellenfreiheit behauptet.

## Historie, Backup und verbleibende Abnahme

Die früheren realen PostgreSQL-17.12-/TLS-/Rollen-/Dump-Restore- sowie Influx-Export-/Restore-Prüfungen aus 9.0.22 bleiben in den dortigen Berichten nachvollziehbar. Sie wurden nicht als neue vollständige Datenbankabnahme nach der Prozessauslagerung wiederholt. Der aktuelle Child-Test bestätigt verschlüsselte Influx-Konfiguration über den echten Owner-Codec. PostgreSQL verwendet weiterhin sein separates geschütztes Profil/CA und den zentralen `hostNamespace`; dessen Profil-/TLS-Quellpfad wurde unverändert übernommen. Backup-Prozessstart, Coverage-RPC, Streaming und Beenden realer Job-Unterprozesse sind neu nachgewiesen, ein vollständiger produktiver Systemrestore ist es nicht.

Offen bleiben die Inbetriebnahme auf dem vorgesehenen Pi/IPC, CPU-/RAM-/Last- und Dauerbetrieb, reale Controller-/Datenbankkonfiguration, vollständiger Systemrestore und das konkrete Geräteverhalten. Für die Dousida Energyline sind Registrierung, Stationsgrenzen/Phasen, positives Laden, reines PV-Laden unterhalb des Überschusses, tatsächliche Ladepause und Wiederaufnahme ohne Aus-/Einstecken sowie Reconnect, Ablehnung, Lease-Ablauf und Adapterneustart anhand gemessener Leistung zu prüfen. Energieflussbilanz und Tarifstatus benötigen gleichzeitig erfasste Anlagenquellen.

Die lokale Softwareprüfung sichert die genannten Pfade reproduzierbar ab. Sie ersetzt weder elektrische Schutzorgane noch Hardwareabnahme, OCPP-Zertifizierung oder Produktionsfreigabe. Eine pauschale 100-%-Zuverlässigkeit wird nicht behauptet. Die konkrete Bedien-/Inbetriebnahmeanleitung steht in `START_HIER_9.0.23.md` im Paketstamm.
