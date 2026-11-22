# Separater Sicherheitsreview – Partneranbindung und Arbitrage

Datum: 28.10.2026. Zielstand: 1.0.32 auf Basis des verifizierten Quellpakets
1.0.31. `productionApproved: false`.

Dieser Bericht stammt aus einem separaten KI-Review-Arbeitsstrang innerhalb
derselben Entwicklung. Er ist keine externe unabhängige Zertifizierung und kein
Penetrationstest einer produktiven Anlage. Es wurden keine Händlerkonten verwendet,
keine produktiven Geräte geschrieben und keine Hardwareabnahme durchgeführt.

## Ergebnis und Geltungsbereich

Der Review identifizierte insbesondere einen tatsächlich reproduzierten Fehler in
der Durchsetzung des Writer-Widerrufs und einen reproduzierten Reihenfolgefehler
bei Speicheraufträgen. Beide wurden während der Entwicklung korrigiert und in
kontrollierten Softwareprüfungen nachgeprüft. Die nachfolgend genannten Tests sind
bestanden. Aus ihnen folgt keine allgemeine Produktions- oder Gerätefreigabe.

Gelesen wurden `docs/AGENTS.md`, die verbindliche Sicherheitsleitlinie und die
kanonischen TypeScript-Quellen für Verträge, Service, Config-API, WSS-Transport,
Runtime/Journal, Arbitrage-Begrenzer, zentrale Writerintegration und Main-Lifecycle.
Zusätzlich wurden die UI-Zustandsführung und ausgewählte bestehende
Authentifizierungs-, Persistenz- und Hardware-Schreibpfade betrachtet.
Schwerpunkte: Race Conditions, Widerruf, Replay/Reihenfolge, SSRF, Ressourcenrechte,
Einzel-Schreibhoheit und Persistenzfehler.

Der überprüfte Quell- und Testdateisatz ist mit SHA-256 in
`evidence/review-source-hashes.txt` bezeichnet. Das sind Hashes dieses
Review-Snapshots, nicht automatisch die Hashes eines später erneut gebauten oder
veränderten Releaseartefakts. Spätere Änderungen müssen durch den finalen
Release-Prüfbericht und dessen Manifest abgedeckt werden.

## Befunde und Nachprüfung

| Kennung | Befund und Auswirkung | Korrektur/Nachweis | Status |
| --- | --- | --- | --- |
| NW-PA-REV-01 | Neuer Partner-Guard lieferte `block` mit `authority:null`; `interceptAsync` sperrte nur mit vorhandener Authority. Ein Mock-Geräteschreiber wurde trotz ausdrücklichem Widerruf aufgerufen. | Sperre gilt für jede Blockentscheidung. Unabhängige Reproduktion vor Fix: 1 physischer Mock-Aufruf; nach Fix: 0. | Behoben, Software-Nachprüfung bestanden |
| NW-PA-REV-02 | Stop/Uninstall beziehungsweise fehlender Arbiter konnten alte async-Partnerfortsetzungen über einen ungeschützten Original-/Fallbackpfad ausführen. | Dünner Interceptor bleibt für alte Kontexte; Lifecycle-Generation bindet Kontexte; fehlender Arbiter verhindert Callback. Stop und Reinstall mit angehaltenem Handler unabhängig geprüft. | Behoben, Software-Nachprüfung bestanden |
| NW-PA-REV-03 | Neue Befehls-ID mit älterem `issuedAt` konnte einen bereits angenommenen neueren Speicherwunsch ersetzen. Reproduziert: neuere 1.000 W durch ältere 4.000 W ersetzt. | Persistierte Reihenfolgesperre je Partner/Ressource; identische Wiederholung vorher gesondert behandelt. Regression einschließlich Neustart bestanden. | Behoben, Software-Nachprüfung bestanden |
| NW-PA-REV-04 | Laufendes Transport-`onMessage` konnte nach Reconnect ohne Sitzungsbindung eine Antwort in der Folgesitzung senden. | Generationengebundene `context.isCurrent`, `context.send` und Abbruchsignal; Runtime überprüft Kontext vor und nach Service-await. | Behoben, Transport-/Runtime-Prüfung bestanden |
| NW-PA-REV-05 | Fehlgeschlagener Konfigurationscommit nach Widerruf konnte über `finally`/Refresh die alte freigegebene Konfiguration reaktivieren. | API wartet auf dauerhafte Widerrufsrevision. Runtime blockiert alte Revision auch nach Refresh/Neustart; Main verwendet diesen Hook. | Behoben für erfolgreich gespeicherte Widerrufsschranke; Persistenzgrenze siehe unten |
| NW-PA-REV-06 | Ausschließlich Wanduhr-basierter Ablauf konnte durch Uhrkorrektur verlängert werden. | Zusätzliche monotone Frist für Wünsche sowie Credentials; kontrollierte Uhrsprung-/Ablauffälle bestanden. | Behoben, Software-Nachprüfung bestanden |
| NW-PA-REV-07 | Langsame Datenabfrage konnte die serielle Nachrichtenverarbeitung unbegrenzt belegen; eingereihter Auftrag konnte Sitzungswechsel überleben. | Datenabfrage mit 5-s-Abbruchsignal/Frist; Epoche bereits beim Einreihen gebunden. Timeout und eingereihter Auftrag über Reconnect geprüft. | Behoben, Software-Nachprüfung bestanden |
| NW-PA-REV-08 | 2.048 Journaleinträge bei 24-h-Aufbewahrung konnten legitime kurzlebige Steuerung bereits nach etwa 34 Minuten bei 1 Hz sperren. | Zehn-Minuten-Aufbewahrung überdeckt gültige Befehlsfenster; feste Eintrags-/Größenlimits und Nachrichtenquote bleiben. | Code nachgeprüft; Langzeitlast auf Zielgerät offen |
| NW-PA-REV-09 | Konfigurationsvertrag erlaubte 300 s, Begrenzer höchstens 60 s; UI-Verfügbarkeitslabel konnte weiter reichen als nachgewiesene Ressourcenfreigabe. | Gemeinsame Obergrenze 60 s; UI bezeichnet nur den bereiten Partnerkanal und Einzelprüfung jeder Anforderung. | Code nachgeprüft |
| NW-PA-REV-10 | Direktvermarktungsprojektion verwendete einen nicht belegten Cache-Key `gridPower`. | Rückführung auf vorhandene echte Bezugs-/Einspeisemesswerte mit Ursprungszeitstempeln; fehlende Werte bleiben unavailable. | Code-/Runtime-Prüfung bestanden |

## Tatsächlich selbst ausgeführte Prüfungen

Umgebung: Linux 6.18.55, Node.js v24.22.1, vorhandene Repository-Abhängigkeiten.
Diese Befehle liefen im Implementierungsverzeichnis. Alle endeten mit Exitcode 0.
Es wurden keine Netzwerkzugriffe auf echte Partner oder Speichergeräte ausgeführt.

| Befehl/Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| `node scripts/verify-partner-websocket.cjs` | 15 Checks bestanden; strikter TS-Build, kontrolliertes DNS/Socket-Verhalten, echte lokale TLS-Negativtests | `evidence/review-transport.log` |
| `node scripts/test-partner-integrations.cjs` | 25 Tests bestanden; Rechte, CAS, Replay, Reihenfolge, Widerruf, Zeitgrenzen und Projektion | `evidence/review-backend.log` |
| `node scripts/verify-partner-runtime.cjs` | 20 Checks bestanden; geschützte Dateien, Journalverlust, serialisierte Persistenz, Refresh, Widerrufsschranke, Sitzung und Credentialablauf | `evidence/review-runtime.log` |
| `node scripts/verify-partner-main-integration.cjs` | 16 Checks bestanden; tatsächliche Adaptermethoden mit isolierter ioBroker-I/O | `evidence/review-main.log` |
| `node --test test/arbitrage-control.test.cjs` | 20 Tests bestanden; reiner Begrenzer, strict TS, Grenzen/Frische/Typen/Standalone-Szenarien | `evidence/review-control.log` |
| Zusätzlicher isolierter kanonischer Writer-Test | 4 Checks bestanden; false Guard, Stop, Reinstall, fehlender Arbiter; jeweils kein physischer Mock-Schreibaufruf | `evidence/review-writer-guard.log` |

Der zusätzliche Writer-Test transpiliert die kanonische Arbiterquelle, ersetzt
die dynamische Fremdsteuerhoheit durch einen definierten inaktiven Testadapter und
zählt tatsächliche Aufrufe des hinterlegten Schreibcallbacks. Er prüft die
Durchsetzung, nicht lediglich einen Diagnosecode. Die regulären Writerregressionen
des Entwicklungsstrangs und die vollständigen Releaseprüfungen sind zusätzlich
im Gesamtprüfbericht nachzuweisen.

## Positiv beobachtete Sicherheitsgrenzen

- Standardzustand aus und ohne Grants; konkrete Installer-/Adminrolle zusätzlich
  zur vorhandenen Auth-Middleware; Kunden-Wildcards öffnen die neue API nicht.
- Feste Fachoperationen und Ressourcen; keine Partner-Roh-DPs, keine Skripte,
  keine Übernahme interner Konfigurations-/Diagnoseobjekte in Antworten.
- WSS-Zielprofil aus geschützter Provisionierung; TLS-Gegenstellenprüfung,
  Redirectverbot, DNS-Adressprüfung und Bindung der tatsächlich verbundenen IP.
- Journal vor Annahme, keine Reaktivierung früherer Wünsche beim Neustart,
  synchrone Invalidierung plus erneute Prüfung nach async-Grenzen.
- Zentraler vorhandener Writer statt zusätzlichem Partner-Geräteschreiber;
  vorgeschaltete Grenzen und erneute Guardprüfung unmittelbar vor I/O.
- UI zeigt Annahme/Verbindung nicht als Gerätewirkung und verhindert stille
  Wiederholungen unklarer Speichervorgänge.

## Offene Prüfungen und verbleibende Grenzen

| Kennung | Offen/Begrenzung | Konsequenz und nächster Schritt |
| --- | --- | --- |
| NW-PA-OPEN-01 | Keine echte Händler-Sandbox, kein erfolgreicher realer Partner-mTLS-End-to-End-Lauf | Konkretes Partnerprofil mit Anbieter prüfen, einschließlich Rotation, erneuter Anmeldung, Vertragsstatus und Nachrichtensemantik |
| NW-PA-OPEN-02 | Keine Hardware-/Firmware-/BMS-Prüfung, kein gemessener Geräte-Timeout oder Rückfall | Begrenzte Anlagenabnahme mit Vorzeichen, SoC, Import/Export, Richtungswechsel, Netz-/Messausfall, Widerruf während I/O und Wiederanlauf; Produktionsfreigabe bleibt false |
| NW-PA-OPEN-03 | Kein unabhängiger externer Penetrationstest und kein vollständiger ASVS-/IEC-Anforderungssatz durch diesen Review geprüft | Risikobasierte unabhängige Sicherheitsprüfung und dokumentierte Einzelanforderungszuordnung vor entsprechender Freigabe |
| NW-PA-OPEN-04 | Keine Raspberry-Pi-Last-/Langzeitmessung, kein physischer Stromausfall während fsync/Rename | Worst-Case-Last und Crash-Recovery auf dem konkreten Zielsystem prüfen; kontrollierte Softwaretests nicht als physische Abnahme ausgeben |
| NW-PA-OPEN-05 | Derselbe kompromittierte OS-Nutzer kann Dateien einschließlich Marker/Fence zurücksetzen; Journalrechte schützen nicht gegen diese Vertrauensstufe | Host-/Modulrechte und Backup-/Restoreprozess separat prüfen; keinen vollständigen Schutz innerhalb derselben kompromittierten Laufzeit behaupten |
| NW-PA-OPEN-06 | Scheitert das Schreiben der Widerrufsschranke selbst, ist deren Zustand nach Neustart nicht gesichert | API meldet Fehler; laufende Instanz bleibt gesperrt. Dauerhaftigkeit nur für tatsächlich gespeicherte Schranke behaupten; bei Bedarf Zugang auch an der Gegenstelle entziehen |
| NW-PA-OPEN-07 | Markt-/Netz-/Messkonzept und anwendbare §14a-/Einspeise-/Vermarktungsrechte nicht geprüft | Anlagenbezogene Freigaben und Datenverwendungsgrundlage vor Aktivierung klären; technische Schalter erteilen keine Rechtsberechtigung |
| NW-PA-OPEN-08 | Legacyfarm, aktive Direktvermarktungsabregelung und mehrere Partner sind nicht freigegebener Umfang | Gesperrte/fehlende Funktionen ehrlich ausweisen; gesonderte Verträge und Prüfungen vor Erweiterung |

Build, vollständige Regression, Secretsuche, Abhängigkeitsprüfung, SBOM,
Frischinstallation/Overlay, Releaseintegrität und npm-Paketumfang werden im
abschließenden Releasebericht geführt. Dieser Teilreview ersetzt diese Gates
nicht. Vorhandene Befunde wie die dokumentierte NW1-Kompatibilitätsausnahme bleiben
erhalten und werden durch diese Änderung nicht als geschlossen ausgewiesen.

## Entscheidung

Die im Review reproduzierten unmittelbaren Durchsetzungsfehler wurden korrigiert
und in dem hier bezeichneten Softwareumfang nachgeprüft. Die technische Übergabe
ist ausschließlich zusammen mit den finalen Releaseprüfungen und den offen
ausgewiesenen Anlagen-/Partnerprüfungen zu bewerten. Keine fiktive
Herstellerunterschrift, keine automatische Produktionsfreigabe und keine Aussage
vollständiger Norm- oder CRA-Konformität.

Architektur, Betrieb und CRA-Nachweismatrix:
`docs/PARTNER_ARBITRAGE_1_0_32_DE.md`.
Details zur tatsächlichen Provisionierung und Persistenz:
`docs/PARTNER_RUNTIME_PROVISIONIERUNG_DE.md`.
