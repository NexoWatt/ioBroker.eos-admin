# NexoWatt EOS 9.0.3 – Webstart nach gültiger Lizenz

Stand: 22.11.2026 · Paket `iobroker.eos-admin@9.0.3` · NexoWatt / Dominique Manteufel.
Kontrollierter Teststand für `next`; keine allgemeine Produktions- oder CRA-Freigabe.

## Ausgangslage und bestätigte Fehler

Der Anwender meldet nach 9.0.2 eine gültige Lizenz (`LICENSE_VALID`), danach einen
EMS-Start, vier fehlende MultiUse-Objekte und einen verweigerten Browserzugriff.
Der Screenshot zeigt Port 3188; der Anwender bestätigt zusätzlich, dass HTTPS auf
8188 nicht erreichbar ist. Eine ausgewählte lokale Konfigurations-/Listenerdiagnose
wurde angefragt, lag zum Erstellen dieses Nachweises aber nicht vor. Es wurde kein
Zugriff auf das Kundengerät ausgeführt. Die folgenden Codefehler sind reproduziert;
eine zusätzliche Zielgeräte- oder Konfigurationsursache wird damit nicht ausgeschlossen.

| Befund | Korrektur / erhaltene Grenze |
| --- | --- |
| **EOS-WEBSTART-001** | Bisher wartete der Webstart vor dem TCP-Listener auf den gesamten lizenzierten UI-/EMS-Start. Geschützte Weboberfläche und operativer Aufbau sind jetzt getrennt. Der Owner gibt den Betriebsstart erst nach Listener- und Webauthentisierungsbereitschaft frei. Login und Systemverwaltung bleiben bei langsamer oder fehlgeschlagener Betriebsinitialisierung erreichbar. Unvollständige Initialisierung gibt keine UI-Schreibbefehle frei. |
| **HISTORY-001** | Der fehlende `getHistory`-Callback konnte den Start nach dem EMS-Log unbegrenzt offenhalten. Einzelanfrage und gesamte Kandidatenfolge haben jetzt höchstens fünf Sekunden monotones Budget; späte Antworten werden verworfen und offene Anfragen beim Unload beendet. |
| **HISTORY-001, Messwerte** | Fehlende oder ungültige History erzeugt keine Ersatz-Nullwerte oder frisch datierte CO₂-Werte aus altem Cache. Tatsächliche Nullmessungen bleiben gültig. Ungültige Teilserien werden verworfen; Zahlen und geprüfte dezimale Zahlenstrings bleiben unterstützt. Timeout-Diagnosen sind konstant, ohne Quell-IDs und auf fünf Minuten gedrosselt. |
| **MULTIUSE-001** | Das deaktivierte Modul übersprang seine Objektanlage und schrieb anschließend vier `multiUse.control.*`-States. Die Diagnoseobjekte werden jetzt vor dem Status angelegt, auch wenn MultiUse deaktiviert ist. Keine Aktivierung, keine neuen Hardwarebefehle und kein Zurücksetzen vorhandener Einstellungen. |
| **EOS-ENTRY-001** | Die Standardkachel der aktuell verbundenen EOS-Instanz verwendet die tatsächliche HTTPS-Browser-Origin. Gespeicherte Altports oder Proxy-Upstreams ersetzen diesen funktionierenden Einstieg nicht mehr. Andere Instanzen und individuelle Links bleiben erhalten. Es wurde kein fest codierter produktiver Port-3188-Redirect gefunden. |

Lizenz, Rollen, Origin-/CSRF-Prüfung und Schreibzuständigkeit bleiben serverseitig
wirksam. Ein Abbruch während des Betriebsstarts darf keine spätere Bereitschaft
oder neue Nebenlaufzeiten nach dem Stop erzeugen. Der Lizenzvertrag samt
Prüfschlüsseln aus 9.0.2 bleibt unverändert; eine erneute Aktivierung ist für das
Update nicht vorgesehen. Die bereits freigegebene Fortsetzung einer vollständig
gestarteten Regelung bei späterem Lizenzverlust wird nicht neu definiert.

`EOS_HTTPS_READY` kennzeichnet den tatsächlich gebundenen Webzugang nach Einrichtung
der Webauthentisierung. `LICENSE_VALID` und `Embedded engine started` sind dafür
keine Ersatznachweise. NVP `stale`/`split-stale`, fehlende PV-Prognose und null
konfigurierte Ladepunkte bleiben getrennte Betriebs-/Konfigurationsbefunde. Es
werden keine Schutzprüfungen oder Stale-Warnungen entfernt.

## Durchgeführte Prüfungen

Linux, Node.js 24.22.3, npm 11.19.1. Keine Kundenanlage oder physische Energiegeräte
wurden angesteuert. Teilmengen dürfen nicht zu einer unabhängigen Gesamtsumme
addiert werden.

| Prüfung | Ergebnis | Beleg in diesem Ordner |
| --- | --- | --- |
| Backend, UI-Runtime, Systemfrontend und Installer | Bestanden; 163 UI-Runtime-Dateien entsprechen der kanonischen Quelle | jeweilige `*-build.log` |
| Unified-Suite mit Start-/Lizenz-/Transport-/History-/MultiUse-/Linkregressionen | 305 Fälle: 303 bestanden, 0 Fehler, 2 bedingt übersprungen | `unit-tests.log` |
| Beibehaltene Auth-/Session-/Uploadregressionen | 48/48 bestanden | `unit-tests.log` |
| Frontendnavigation, Einstiegskacheln, Buildbelege und Assetgraph | 14/14 bestanden; Assetgraph konsistent | `frontend-tests.log`, `frontend-graph.log` |
| NWL3 mit Original-Keygen 1.0.4 über echte HTTPS-Routen gegen gebaute Runtime | 5/5 bestanden, 0 übersprungen | `built-runtime-https-license.log` |
| History: fehlende/späte/doppelte Antwort, gemeinsame Deadline, Shutdown, Messwerterhalt, Normalizer und Diagnose | 13/13 bestanden | `HISTORY-001.md`, `history-after.log`; fehlgeschlagene Vorherfälle separat |
| MultiUse-Kaltstart und Reaktivierung | 3 Fälle vor Korrektur fehlgeschlagen, danach 3/3 bestanden | `ems/MULTIUSE_LIFECYCLE.md`, `multiuse-before.tap`, `multiuse-after.tap` |
| Verwandte MultiUse-/Lifecycle-/Safety-Skripte und NVP-Regressionssuite | 8/8 Skripte mit Exit 0 und 208/208 NVP-Fälle | `ems/related-regressions.json`, `ems/nvp-dynamic-grid.tap` |
| HTTPS bei gültiger Lizenz mit blockiertem/fehlgeschlagenem Betriebsstart | 35/35 fokussierte TLS-/Lifecycle-Fälle bestanden, darunter die neuen Fehlerszenarien | `web-lifecycle-focused.tap` |
| Installation in echtem ioBroker-Controller 7.2.5, HTTPS und Prozessneustart | 11 bestanden, 0 Fehler, 2 umgebungsbedingt übersprungen | `integration-release.log` |
| Lint und geänderte TypeScript-Bereiche | Exit 0; eine bestehende Frontendwarnung (`getOverviewRoleConfig`), keine neuen Lintfehler | `lint-unified.log`, weitere Bereichsbelege |

Die neuen HTTPS-Fälle verwenden reale TLS-Verbindungen mit explizitem
Zertifikatsvertrauen, den tatsächlichen eingebetteten Router und die produktive
Mount-Funktion. Controllerzugriffe und die gültige zentrale Freigabe sind dabei
kontrollierte Fixtures. Die Tests decken ausbleibende Betriebsinitialisierung,
Fehler und unerwartete Promise-Ablehnung ab: Login/System-Recovery bleiben
zugänglich, unberechtigte oder unvollständig initialisierte Fachbefehle werden
abgewiesen. Zusätzliche Fälle prüfen Stop und Lizenz-/Ownership-Verlust.

Eine im Review reproduzierte weitere Lücke ist geschlossen: Optionale Setup-Catches
konnten einen bereits beobachteten Verlust verschlucken. Dieser Fehler wird jetzt
für den gesamten Startversuch festgehalten. Eine unmittelbar wiederkehrende
Freigabe setzt den unvollständigen Start nicht fort; der gespeicherte letzte
Lizenzgrant ist erst nach vollständig erreichtem `ready` als bestehender
Fortsetzungsvertrag nutzbar. Ein regulärer, vollständig gestarteter Betrieb
behält seinen bisherigen dokumentierten Vertrag.

Die große übernommene UI-Hauptquelle ist weiterhin kein vollständig streng
getypter Neubau. Die betroffenen History-Methoden sind mit JSDoc dokumentiert und
werden als tatsächliches JavaScript getestet; der textkopierende Runtimegenerator
wurde nicht geändert. Neue echte TS-Annotationen verursachten zunächst einen
Syntaxblocker im generierten JavaScript; dieser wurde vor Lieferung entfernt.
Der Regressionstest verwendet deshalb jetzt den unveränderten Methodentext statt
einer Transpilierung, die solche Fehler verdecken könnte.

Das npm-Paket wurde im separaten Controller-7.2.5-Testverzeichnis installiert.
Echte Objekt-/State-Datenbanken, Adapterprozess und TLS-Socket auf 8188 prüfen
Login, Host-/Origin-/CA-/Zertifikatsgrenzen, CSRF/Logout, Stop und Prozessneustart.
Der aktivierte `admin.0`-Objektbestand mit Port 8081 und Bindung `0.0.0.0` bleibt
erhalten; ein zusätzlicher alter Admin-Webserver wird nicht gestartet. Der
`EOS_HTTPS_READY`-Eintrag ist im tatsächlichen installierten Lauf vorhanden.
**11 Fälle bestanden, 2 bedingt übersprungen, 0 Fehler.**

Die POSIX-Eigentümer von `/` und `/etc` sind in dieser Umgebung nicht UID 0.
Der produktive OS-Trust-Leser verweigert das unverändert mit `TRUST_PERMISSIONS`.
Der Test bestätigt diese Sperre und überspringt deshalb die zwei positiven
Herstellerimport-Folgefälle. Die installierte Controllerinstanz bleibt hier
unlizenziert. Positive NWL3-/Keygen- und lizenzierte HTTPS-Startfälle sind getrennte
Dienst-/Routertests mit ausdrücklich kontrollierten Vertrauens- beziehungsweise
Status-Fixtures; sie werden nicht zu einem lizenzierten Zielgerätetest umgedeutet.

Der Test verwendet ausdrücklich `EOS_TEST_NETWORK_FIXTURE=loopback` sowie
`NODE_OPTIONS=--require=<absoluter-Pfad>/test/fixtures/loopback-network.cjs`, weil
Netzwerkschnittstellen-Aufzählung hier gesperrt ist. Nur diese Aufzählung wird
ersetzt; TCP, TLS, Datenbanken und Adapterprozess bleiben real. Autoritäts- und
Dateirechteprüfungen werden nicht abgeschwächt. `:443`-Authorityfälle auf dem
8188-Socket ersetzen keine echte 443-Proxyprüfung.

Anschließend stimmen **803 produktive Dateien** byteweise mit dem
installierten Testpaket überein (`installed-runtime-comparison.json`). Nachfolgende
Berichts-/Archivarbeiten ändern diese Runtime nicht.

Die bedingten Nginx- und POSIX-ACL-Fälle benötigen hier nicht installierte Programme
(`nginx`, `setfacl`). Sie werden nicht als bestanden ausgegeben. Ein visueller
Browserlauf ist nicht nachgewiesen; Browserstart war in dieser Umgebung zuvor
an `socket() EPERM` gescheitert und wurde für 9.0.3 nicht als Erfolg wiederverwendet.
Quell-/DOM-/API-/TLS-Prüfungen ersetzen keine visuelle Zielgeräteabnahme.

## Abhängigkeiten und Lieferintegrität

Frische npm-Audits: Runtime, Systemfrontend und Installer jeweils **0 bekannte
Befunde**. Build-/Entwicklungsbaum: weiterhin **14 moderate, 0 hohe, 0 kritische**
Befunde. Die zugehörigen vier `*-audit.json` sind enthalten. Keine neuen
Laufzeitabhängigkeiten wurden eingeführt. Null Auditbefunde sind kein Nachweis
vollständiger Sicherheit.

Die SBOMs wurden mit Versionsbezug 9.0.3 neu erzeugt: 304 Runtime-Komponenten
einschließlich gebundenem WebServer-Vendorpatch, 717 Komponenten im vollständigen
Buildgraph. Herkunft, Patchbindung und Runtimegraph werden mit
`tools/eos-sbom-vendored.cjs --check` geprüft.

Der Lieferlauf umfasst npm-Pack, Vergleich aller Tar-Dateien mit dem Quellstand,
Archivpfad-/Schlüsselnutzlastprüfung und erneutes Entpacken des Repository-ZIP mit
Release-/SBOM-Prüfung. Gebaute Laufzeitdateien werden mit dem tatsächlich
installierten Testpaket verglichen. Finale Zahlen und Prüfsummen stehen in
`NexoWatt_EOS_9.0.3_Lieferpruefung.json` und `NexoWatt_EOS_9.0.3_SHA256SUMS.txt`.
Dies sind Integritätsbelege, keine digitale Herstellersignatur.

NexoWatt-Anteile bleiben proprietär; Drittanbieterrechte bleiben erhalten.
Es wurde nichts nach Git oder npm veröffentlicht. Öffentliche npm-Verteilung
verleiht keine freie NexoWatt-Nutzungslizenz und schützt die Paketdateien nicht
vor Download.

## Update und offene Abnahme

Die vorhandene EOS-Instanz nach Sicherung aktualisieren; System-UUID, gültige
Lizenz, zugehörigen Speicherschlüssel und öffentliche Prüfschlüssel erhalten.
Keine ioBroker-Neuinstallation ist für diesen Fix erforderlich. Anleitung:
`START_HIER_9.0.3.md`.

Auf dem Zielgerät bleiben zu prüfen: gespeicherter Port/Bindadresse, TLS-Material,
`EOS_HTTPS_READY`, Anmeldung und Dashboard/Systemverwaltung nach Neustart,
vollständiger Betriebsstart, tatsächliche Influx-/Gerätekommunikation und die
Zählerzuordnung hinter NVP-Stale-Meldungen. 8081 bleibt die bisherige
ioBroker-Administration; EOS-Default ist HTTPS auf 8188. Namensauflösung und ein
optionaler 443-Proxy werden nicht automatisch eingerichtet.

Die dokumentierten Grenzen `LIC-RUNTIME-01` bis `-03`, gemeinsame Prozesslaufzeit,
TOTP-/Passkeyflow, globaler Logout, 50-/100-ms-Zielzeiten und die verbleibenden
Hersteller-/CRA-Nachweise bleiben gesondert zu bearbeiten. Diese Reparatur
bestätigt keine allgemeine Anlagen- oder Serienfreigabe.
