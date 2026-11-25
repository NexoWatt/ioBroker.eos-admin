# NexoWatt EOS 9.0.25 – Prüfbericht

Stand: 25.11.2026. Kontrollierter Integrationsstand für den npm-Kanal `next`. Ein Paket `iobroker.eos-admin` enthält weiterhin die getrennten Modulprozesse und OCPP 0.4.4. Die produktive Anlage des Nutzers wurde hier nicht verändert; der Nutzer hat die erfolgreiche Rückkehr zu 9.0.21 bestätigt.

## Ergebnis der vollständigen Regression

| Lauf | Fälle | Bestanden | Fehler | Abgebrochen | Übersprungen |
| --- | ---: | ---: | ---: | ---: | ---: |
| Node.js 22.23.4 | 2534 | 2532 | 0 | 0 | 2 |
| Node.js 24.22.3 | 2534 | 2532 | 0 | 0 | 2 |

Je Node-Linie wurde `npm test` vollständig ausgeführt: Unified-, Retained- und Modulprüfungen mit fünf tatsächlichen Test-Runner-Zusammenfassungen. Die gezielten Prozess-, Tarif-, Login- und IPC-Fälle sind darin enthalten; ihre Teilzahlen werden nicht nochmals addiert. Die Belege sind über `raw/INDEX.json` mit SHA-256 zugeordnet.

Die beiden übersprungenen Plattformprüfungen benötigen `nginx -t` beziehungsweise vererbte POSIX-ACLs (`setfacl`), die in dieser Prüfumgebung fehlen. Keygen 1.0.4, eine reale isolierte InfluxDB 2.10.1 und die tatsächlichen Quellen des externen OCPP-Adapters 0.4.3 wurden ausdrücklich bereitgestellt. Umgebung: isoliertes Linux/x86_64 mit normalen Benutzerrechten, keine Kundenhardware.

Frontend, Installer, Backend, UI-Laufzeit und eingebettete Module wurden gebaut. Die vollständige Typprüfung und das vollständige Backend-/Frontend-/Modullint wurden ausgeführt; ihre Ergebnisse stehen in den Rohprotokollen. Ein bestehender JSDoc-Hinweis ohne Lintfehler bleibt dokumentiert. Die neuen JS-Grenzen verwenden die vorhandenen ausführbaren Lintregeln und eine strikte Typprüfung; der Typvertrag des bestehenden Konfigurationsspeichers ist von einer vollständigen neuen `checkJs`-Prüfung seines Altbestands zu unterscheiden.

## Behobene Startsperre aus 9.0.24

Der vom Nutzer gelieferte Zustand `BLOCKED / EOS_MIGRATION_SOURCE_VERSION` bezog sich ausschließlich auf den gefundenen externen `ocpp21.0`. In 9.0.24 war dessen optionale Übernahme in die gemeinsame automatische Vorprüfung geraten. Dadurch blieben auch Geräte, EEBUS, Sicherung und der operative EMS-Start gesperrt, obwohl die UI bereits lief. Die Sperre trat vor Übernahme, Abschaltung des externen OCPP und Persistieren eines Übergabejournals auf.

9.0.25 nimmt OCPP aus dieser impliziten Erstinventur heraus. Der externe Adapter darf weiterlaufen; eine bewusste Übernahme bleibt im geschützten OCPP-Bereich möglich. Bereits vorhandene OCPP-Übergabejournale, Namensräume, Lizenz-, Ownership- und Stopprüfungen bleiben erhalten. Es wird kein Journal gelöscht oder blind freigeschaltet. Nach erfolgreicher neuer Vorprüfung wird ein veralteter diagnostischer BLOCKED-Status aktualisiert.

Die reale Versionsnummer des auf der betroffenen Anlage separat laufenden OCPP-Adapters wurde nicht übermittelt. Abweichende Versionswerte in den Regressionen sind ausdrücklich synthetische Testdaten, keine Behauptung über die Anlage.

## Prozessbedienung und Ausfallverhalten

| Bereich | Umsetzung und Nachweis |
| --- | --- |
| Voreinstellung | Ohne gespeicherte Prozessauswahl sind UI/EMS, Devices, EEBUS, Backup und OCPP freigegeben. Die erste Initialisierung schreibt dafür keine Konfiguration. |
| Dauerhafte Auswahl | Aktivieren, Deaktivieren und Neustarten über `/runtime/`; manuelles Aus überlebt einen neuen Host/Steuerungsdienst. Eigene Modulkonfiguration und Startvoraussetzungen bleiben zusätzlich maßgeblich. |
| Getrennte Zustände | Gespeicherte Freigabe, tatsächlicher Prozesslauf, PID und Betriebsbereitschaft werden getrennt angezeigt. Ein angenommener HTTP-Auftrag wird nicht als bestätigter Erfolg dargestellt. |
| Neustart | Erst dauerhaft Aus speichern, dann bestätigtes Prozessende und ausstehende Schreib-/Abonnementarbeiten abwarten; erst danach erneut freigeben. Unbestätigter Stop bleibt gesperrt. |
| Konkurrenz | Revisionsprüfung und höchstens ein angenommener Steuerauftrag. Verbindungsabbruch im Browser gibt diese Sperre nicht vorzeitig frei und löst keine automatische Wiederholung aus. |
| Zugriff | Feste Prozess-IDs, Adminrolle, Origin und CSRF; erneute Berechtigungsprüfung nach dem vollständigen HTTP-Body. Externe OCPP-Instanzen und der Adminprozess selbst sind keine schaltbaren Ziele. |
| Recovery-Anmeldung | Bestehende Loginseite und feste öffentliche Login-Dateien kommen aus dem Parent. Frische Adminanmeldung funktioniert auch bei persistiert pausierter UI und bei Runtime-Konfigurations-Readtimeout. Kiosk ersetzt diese Anmeldung nicht. |
| Echte Unterprozesse | Devices-Neustart erhält die OCPP-PID und dieselbe WebSocket-Verbindung. OCPP-Neustart verwirft alte Befehle im nativen und übernommenen Namespace. |

Zusätzlich zur Gesamtsuite wurden 48 Browserfälle unter Chromium 158 ausgeführt: je Node-Linie 13 Prozesssteuerungs-, 7 Status- und 4 tatsächliche Loginfälle. Dazu kommen jeweils 14 Auth-Vertragsgruppen. Die Loginfälle benutzen die echte Web-/OAuth-Strecke mit synthetischer Controller- und Passwortquelle; sie sind keine Anmeldung an einem Kundensystem.

Der gemeinsame Adminprozess, die ioBroker-Datenbank, Betriebssystem und Hardware bleiben gemeinsame Abhängigkeiten. Getrennte PIDs bedeuten keine vollständige Redundanz. Ein beendeter Kommunikationsprozess ist kein Nachweis eines elektrisch abgeschalteten Geräts. Unabhängige Anlagenbegrenzungen und die jeweilige physische Ausfallreaktion bleiben gesondert zu prüfen.

## Tarifanbieter und bestätigtes Speichern

Neun gezielte Fälle je Node-Linie prüfen den Erhalt von Anbieterwahl, Zugangsdaten, Preisformeln, Zuordnungen und Tarif-Schaltern. Die Testkonfigurationen für sechs Anbieterpfade wurden mit der tatsächlich ausgeführten Original-Speicherfunktion aus 9.0.21 erzeugt; enthaltene Zugangsdaten sind künstlich. Der neue Stand lädt diese Daten über seine echten Laufzeit-, Migrations- und Konfigurationsfunktionen. Vorhandene Werte einschließlich `false` und `0` werden nicht durch Paketdefaults oder ältere Backups ersetzt. Übernommene UI-Namensräume bleiben bestehen.

Die zusätzliche Prüfung fand einen getrennten IPC-Fehler: Eine langsame Konfigurationsspeicherung konnte nach zwei Sekunden als fehlgeschlagen gemeldet werden, während der Controller kurz danach trotzdem schrieb und die Laufzeit noch den alten Wert hielt. Jetzt bleiben die zwei Sekunden für die rechtzeitige Annahme aller Schreibbefehle erhalten; nur exakt gebundene Konfigurationsspeicher erhalten bis zu 30 Sekunden für die tatsächliche Bestätigung. Andere Gerätebefehle bekommen keine längere Frist. Bei weiterhin unbekanntem Konfigurationsabschluss beendet und sperrt sich der UI-Worker; ein neuer Prozess darf erst nach abgeschlossenem Write-Drain wieder laden. Es gibt keinen automatischen Replay des alten Schreibbefehls.

Fünf eigene reale Child-/IPC-Fälle je Node-Linie prüfen langsamen Commit, beide Namensräume, echte DB-Ablehnung, Pause/Drain/Neuladen und die tatsächliche 30-Sekunden-Frist. Ein unabhängiger Negativreview prüft zusätzlich die enge Klassifikation, abgelaufene Annahmefristen und alte oder fremde Antwortgenerationen. Das belegt den beschriebenen Speicherpfad, nicht die Erreichbarkeit eines Tarifproviders oder Fehlerfreiheit beliebiger Datenträger.

## Ressourcen, Build und Lieferkette

Die Prozesssteuerung nutzt vorhandene Worker und ergänzt keinen eigenen Dauerprozess oder periodischen Backendtimer. Sie hält feste Zustände für fünf IDs und höchstens einen Bedienauftrag. Sichtbare Statusseiten fragen alle fünf Sekunden ab, bündeln konkurrierende Reads und pausieren bei verborgener Seite. Timer, Anfragen und Abonnements werden beim Stop aufgeräumt. Die gesonderte Konfigurationsbestätigung bleibt innerhalb der vorhandenen begrenzten IPC-Strukturen; Regel- und Messintervalle wurden nicht verlängert.

Es wurde keine umfassende RAM-Umstrukturierung vorgenommen. Die ungefähr 1.056–1.087 MB aus der Nutzermessung gehörten zu 9.0.21. Für 9.0.25 liegen keine vergleichbaren Pi-RSS/PSS-Dauermessungen vor. Einzelne Adapter-RSS-Werte ersetzen keine Summe beziehungsweise PSS-Betrachtung aller Prozesse. Eine RAM-Ersparnis wird nicht behauptet. Die Anforderung, Ressourcen und Ausfallverhalten bei jeder Änderung mitzuprüfen, ist in der mitgelieferten Entwicklungsrichtlinie ergänzt.

Die SBOMs werden mit `npm sbom --package-lock-only --sbom-format=cyclonedx` aus den jeweiligen Lockfiles erzeugt; die Runtime-SBOM ergänzt die geprüften eingebetteten Module und den vendorten Webserver. Der direkte Scan der lokal verlinkten Test-Abhängigkeiten war dafür nicht verwendbar. Die Admin-Frontend-SBOM trägt 9.0.25; der unveränderte interne Installer hat weiterhin seine eigene Paketversion 9.0.24. Es wurden keine neuen Produktionsabhängigkeiten aufgenommen.

`npm audit --omit=dev --json` meldet weiterhin zwei moderate Einträge (AJV und ocpp-rpc), null hohe und null kritische Einträge. Der dokumentierte AJV-Befund betrifft die `$data`-Option, die der verwendete OCPP-Validator nicht aktiviert. Der zuvor geprüfte inkompatible AJV-Override wurde nicht übernommen. Die offene Auditmeldung und die konkrete Verwendungsgrenze bleiben im Lieferstand sichtbar; daraus folgt keine allgemeine Schwachstellenfreiheit. Der separate Advisory-Schritt der CI ist damit nicht pauschal als grün nachgewiesen.

## Paketierung, Veröffentlichung und Anlagenabnahme

Die vollständige Repository-ZIP enthält einen EOS-Quellbaum einschließlich erzeugter Laufzeiten, Tests, Prüfberichte und SBOMs. Ein zweites npm-Paket für die integrierten Module ist nicht erforderlich. Bekannte unveränderte Altdateien aus früheren Lieferständen werden beim normalen Publish vor ihrer Entfernung gesichert; unbekannte oder veränderte Dateien werden nicht still gelöscht. Der Katalog enthält nun auch verifizierte Buildreste aus 9.0.24.

Die abschließenden Pack-/Publish-Probeläufe werden nach der Versiegelung getrennt als `PUBLISH_DRYRUN.json` mit tatsächlicher TGZ-Prüfsumme ausgeliefert. Sie verwenden die normalen Lifecycleprüfungen und historische Überlagerungen auf beiden Node-Linien. `PACKAGING_VERIFICATION.json` dokumentiert den Abgleich sämtlicher versiegelter Dateien, ZIP-CRCs und Nutzdatei-Hashes. Probeläufe veröffentlichen kein Paket und bestätigen keine npm-Kontoberechtigung oder Windows-Ausführung. Prüfsummen sind keine digitale Signatur.

Eine zusätzliche Prüfung des versiegelten Pakets mit realen isolierten ioBroker-Datenbankservern wird gegebenenfalls separat in `INTEGRATION_TEST.json` beigefügt. Nur der dort dokumentierte Lauf mit identischer TGZ-Prüfsumme ist als Prüfung dieses Lieferpakets zu werten; ein vollständiger Controller-Daemon und Kundenhardware sind davon zu unterscheiden.

Die Anlage bleibt bis zur bewussten Erprobung auf dem vom Nutzer bestätigten 9.0.21-Stand. Für die neue Version sind Gerätekommunikation, dynamischer Tarif, Dousida-Energyline-PV-Stopp, Wiederaufnahme ohne Umstecken, Sollwert/Messwert, physische Reaktion bei Kommunikationsausfall sowie Dauerbetrieb auf dem Raspberry Pi separat abzunehmen. Es wurden weder npm-Veröffentlichung noch Installation auf dem Pi ausgeführt. Die Anleitung enthält die Kontrollen für diese Erprobung. Automatisierte Tests sind keine hundertprozentige Zuverlässigkeitsgarantie, elektrische Schutzprüfung oder Zertifizierung.

## Belege

- `raw/INDEX.json`, vollständige `node22-tests-final.log`/`node24-tests-final.log` und Versionsdateien.
- `raw/build-*.log`, `raw/typecheck.log`, `raw/lint.log`, SBOM-Protokolle und `raw/eos-production-audit.json`.
- `OCPP_STARTSPERRE_9.0.24.md`, `MIGRATION_INDEPENDENT_REVIEW.md`.
- `RUNTIME_CONTROL_BACKEND.md`, `RUNTIME_CONTROL_INDEPENDENT_REVIEW.md`, `RUNTIME_LOGIN_RECOVERY.md`, `RUNTIME_CONTROLS_BROWSERPRUEFUNG.md` und zugehörige Rohbelege.
- `TARIFF_UPDATE_PERSISTENCE.md`, `UI_CONFIG_COMMIT_ACK.md`, unabhängiger IPC-Review und zugehörige Rohbelege.
- `docs/MODULE_PROCESS_RUNTIME.md`, `release-manifests/unified/validation.json`, `files.json` und die SBOMs.
