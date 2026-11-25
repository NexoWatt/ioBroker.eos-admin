# NexoWatt EOS 9.0.24 – Prüfbericht

Stand: 25.11.2026. Kontrollierter Integrationsstand für den npm-Kanal `next`. Ein installierbares Paket `iobroker.eos-admin`, einschließlich OCPP 0.4.4 auf Basis der zuvor geprüften 0.4.3. Keine produktive Anlage und kein npm-Konto wurden verändert.

## Ergebnis der vollständigen Regression

| Lauf | Fälle | Bestanden | Fehler | Abgebrochen | Übersprungen |
| --- | ---: | ---: | ---: | ---: | ---: |
| Node.js 22.23.4 | 2476 | 2474 | 0 | 0 | 2 |
| Node.js 24.22.3 | 2476 | 2474 | 0 | 0 | 2 |

Je Lauf wurde der unveränderte vollständige Befehl `npm test` ausgeführt: Unified-, Retained- und Modulprüfungen mit fünf tatsächlichen Test-Runner-Zusammenfassungen. Die neuen OCPP-, Kiosk-, Prozess-, Migrations- und Backupfälle sind in diesen Zahlen enthalten. Die Teilberichte überschneiden sich mit dieser Gesamtsuite und werden nicht zusätzlich aufaddiert.

Die zwei ausdrücklich übersprungenen Plattformprüfungen betreffen `nginx -t` und vererbte POSIX-ACLs, weil `nginx` beziehungsweise `setfacl` im Testsystem fehlen. Lizenz-Keygen 1.0.4, die reale isolierte InfluxDB 2.10.1 und die tatsächliche externe OCPP-0.4.3-Quelle wurden bereitgestellt und nicht als fehlend übersprungen. Testumgebung: isoliertes Linux/x86_64, keine Kundenhardware.

Vollständiger Build (`npm run build`), strikte Typprüfungen (`npm run typecheck`), Backend-/Frontend-/Modullint (`npm run lint`) und `git diff --check` sind erfolgreich. Ein JSDoc-Hinweis ohne Fehler bleibt im Lint-Log. Die bereits für eigene JS-Grenzen vorgesehenen dedizierten Lintkonfigurationen sind jetzt auch im Gesamtbefehl konsistent zugeordnet; diese Dateien bleiben in `lint:unified` und ihren strikten TypeScript-Prüfungen enthalten. Buildwarnungen zu separat bereitgestellten statischen Ressourcen bleiben im Rohlog nachvollziehbar.

## Umgesetzte Anforderungen und Nachweise

| Bereich | Ergebnis und tatsächlich geprüfte Grenze |
| --- | --- |
| Ein EOS-Adapter | OCPP, EEBUS, Devices und Backup im Paket; jeder Modulruntime ein beaufsichtigter OS-Prozess. UI/EMS laufen gemeinsam in einem weiteren Kindprozess. |
| EMS-Ausfall | Tatsächliche produktive Modulworker und dieselbe OCPP-WebSocket-Verbindung überleben SIGKILL, automatischen Neustart und Stop des UI/EMS-Kindprozesses. Der gemeinsame Host bleibt ihre übergeordnete Instanz. |
| OCPP-Konfiguration | Geschützte Adminseite mit frei eingebbarem WebSocket-Port 1024–65535, Standard 9220, Revision/CSRF, Start-/Stopstatus und 5-s-Statusabfrage. Eigener Port wird übernommen; belegter Port wird als Fehler behandelt. |
| Automatische Ladepunkte | Eigener Namespace `eos-admin.N.ocpp`; bestätigte Übernahme bewahrt `ocpp21.N` und bestehende Datenpunkte. Neue erkannte Stationen werden einmalig verknüpft und bleiben bis zur Kontrolle der elektrischen Grenzen deaktiviert. |
| Regelung | Native Hosted-OCPP-Stationen erfordern aktuelle Worker-Rückmeldung und die EMS-Lease. Auch unvollständiger Anfangscache und generische Telemetrieprofile können diese Prüfungen nicht umgehen. Gemischte Stationszuordnungen und doppelte Stellschreiber werden gesperrt. |
| Kioskmodus | Unter Einstellungen → Allgemein schaltbar; begrenztes Dashboard ohne Login-/Inaktivitätsablauf. Aktivierung widerruft alte Admin-Sitzungen. Adminzugang verlangt Benutzername/Passwort, geschützte Seiten behalten ihre normale Sitzungsfrist. Abschalten widerruft den Kioskzugang. |
| Kunden-Einstellungen | Bestandsübernahme entfernt, Admin-Einstieg bleibt. Änderungen am Kioskmodus sind administrativ geschützt. |
| Stationsanzeigen | Tatsächlich konfigurierter gültiger Display-Link liefert im echten UI-Kindprozess anonym HTTP 200 vor und nach Kiosk-Abschaltung. Kein zusätzlicher allgemeiner Login-/Idlezwang für den getrennten Stationslink. |
| Bestehende EMS-Funktionen | Regressionen für Leistungsbilanz und fehlende/veraltete Daten, Tarifanzeige, reines PV-Laden/0-W-Pfad, atomare OCPP-Rückmeldung sowie die 5-s-Energieflussaktualisierung bleiben enthalten. |
| npm-Fehler | Exakte historische Datei `hostInit-BNFIx0-f.js` aus 9.0.21 nachgewiesen. 69 ergänzte, belegte Hashes aus 9.0.21–9.0.23 erlauben gesicherte Bereinigung bekannter Altdateien; unbekannte/veränderte Dateien bleiben erhalten und blockieren. |

Zusätzlich wurden die echte OCPP-Verwaltung im Chromium-Browser auf Desktop und Mobilgröße, die Kioskabläufe sowie beide Node-Linien gezielt geprüft. Die Kioskprüfung führt 660.001 ms virtuelle Browserzeit aus; dies ist kein elfminütiger Echtzeit-Dauerlauf. Der OCPP-Modulnachweis umfasst 84 Fälle je Node-Linie, darunter echte WebSockets mit simulierten Stationen für OCPP 1.6J, 2.0.1 und 2.1.

## Pakete und Veröffentlichung

Die Auslieferung enthält den vollständigen Quellbaum einschließlich Builds, Tests, Berichten, SBOMs und Integritätsnachweisen. Das kleinere Installations-ZIP enthält das fertige EOS-TGZ, die Anleitung und Prüfsummen. Ein zweiter OCPP-Adapter wird für den integrierten Zielbetrieb nicht benötigt.

Die abschließenden Paket-/Publishprüfungen erfolgen nach der Versiegelung. `PUBLISH_DRYRUN.json` wird als separate Beigabe mit tatsächlicher TGZ-Prüfsumme und Ergebnissen für beide Node-Linien ausgeliefert. Ein Publish-Trockenlauf veröffentlicht kein Paket und bestätigt weder Kontoberechtigung noch Zwei-Faktor-Freigabe bei npm. Die tatsächlich verschickten ZIPs werden zusätzlich per CRC, jeder Nutzdatei-SHA-256 und Abgleich aller versiegelten Dateien geprüft. Eine SHA-256-Prüfsumme ist keine digitale Signatur.

## Verbleibende Grenzen

`npm audit --omit=dev --json` meldet zwei moderate Einträge (AJV und das davon abhängige ocpp-rpc), null hohe und null kritische Einträge. Der konkrete Befund GHSA-2g4f-4pwh-qvx6 betrifft AJV mit aktivierter `$data`-Option; der übernommene Validator aktiviert diese Option nicht. Ein bereits geprüfter AJV-Override brach die URN-Schemaauflösung und wurde nicht übernommen. Der funktionsfähige, gepinnte Upstream-Vertrag und die offene Auditmeldung sind dokumentiert, keine pauschale Schwachstellenfreiheit behauptet.

Die physische Dousida-Energyline-Abnahme steht aus: tatsächlicher Ladestopp bei fehlendem PV-Überschuss, Wiederaufnahme ohne Umstecken, Sollwert gegenüber Messleistung, Ausfall-/Reconnectreaktion und Dauerbetrieb müssen an der Anlage geprüft werden. Auch RAM/CPU unter realer Gerätezahl und auf Pi/IPC sind separat zu messen. OCPP-Accepted bestätigt Protokollannahme, nicht die elektrische Umsetzung. Automatisierte Tests begründen keine 100-%-Zuverlässigkeitsgarantie, Produktionsfreigabe oder Zertifizierung.

## Belege

- `raw/INDEX.json`, `raw/node22-tests-final.log`, `raw/node24-tests-final.log` und zugehörige Versionsdateien.
- `raw/build.log`, `raw/typecheck.log`, `raw/lint.log`, `raw/eos-production-audit.json`.
- `OCPP_UNABHAENGIGER_REVIEW.md`, `OCPP_NAMESPACE_REGELPFAD.md`, `OCPP_HOST_MIGRATION.md`, `OCPP_VERWALTUNG.md`.
- `KIOSK_FRONTEND_BROWSERPRUEFUNG.md`, `KIOSK_UNABHAENGIGER_REVIEW.md`, `../../../reports/security/KIOSK_BACKEND_924.md`.
- `BACKUP_INTEROP_PRUEFBERICHT.md`, `PUBLISH_OVERLAY_9_0_21.md`, `../../../modules/ocpp/validation/manifest.json`.
- `release-manifests/unified/validation.json`, `files.json`, Runtime-/Frontend-/Installer-SBOMs im Repository.
