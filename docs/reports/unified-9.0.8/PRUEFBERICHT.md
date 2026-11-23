# NexoWatt EOS 9.0.8 – Änderungs- und Prüfbericht

Stand: 23.11.2026. Weiterentwicklung des gelieferten 9.0.7-Prüfstands. Proprietäre NexoWatt-Lizenz unverändert; Drittanbieterrechte bleiben erhalten. Kanal `next`; keine Veröffentlichung auf npm/GitHub und keine Änderung einer Kundenanlage.

## Änderungen

- Sichtbare SmartHome-Aktivierung unter Installer → SmartHome Config. Ohne ausdrückliche neue Auswahl gilt die bisherige native/AppCenter-Freigabe. Gebäude anlegen aktiviert den Bereich nicht selbstständig. Eine bestätigte Speicherung aktualisiert Navigation und Gerätemodell ohne EOS-Neustart; Gebäudeentwürfe und bestehende Datenpunktadressen bleiben erhalten.
- SmartHome-Übernahme prüft bekannte Installer-/Timer-States vor und nach dem Anhalten der alten UI sowie vor dem Laufzeitstart. Nachweislich verlorene oder beschädigte Daten sperren den Betriebsstart. Keine automatische Wiederherstellung einer fremden globalen Sicherung. Fehler während eines bereits abgeschlossenen Übergangs entziehen auch der eingebetteten Laufzeit die Schreibfreigabe; die zentrale EOS-Wiederherstellungsoberfläche bleibt erhalten.
- Einstellungen → Admin öffnen verwendet denselben Browser-Tab und Ursprung.
- Externe Adapterbewertungen sind mit `eosExternalRatings=false` standardmäßig deaktiviert. Ohne ausdrückliches Einschalten lesen weder Start noch Ratings-RPC dafür die System-UUID oder senden sie an den Bewertungsdienst. Die Administrator-Einstellung benennt die Datenübermittlung. Opt-in und Widerruf weiterer Abrufe wurden ohne externe Anfrage mit dem tatsächlichen Upstream-Code geprüft.
- Backup verwendet `cron-parser@5.10.6`; `node-schedule` und dessen veralteter Parser 4.9.0 entfallen. Kalender-/DST-Verhalten und automatische Backup-Ausführung geprüft; kein Wechsel der EMS-Zeitsteuerung.
- Node.js 22 bleibt unterstützt. CI-Matrix 22.23.4 / 24.22.3 ergänzt. Das bestehende Engine-Profil bleibt `>=22.23.4 <23 || >=24.22.1 <25`.
- Runtime-Generator kompiliert die erzeugten JavaScript-Bytes ohne Ausführung vor dem Schreiben. Versehentlich verbleibende TypeScript-Syntax kann nicht mehr als erfolgreicher Build ausgeliefert werden.

## Prüfung

Linux x64, unprivilegierter Prozess; npm 11.19.1. Die folgenden Prüfungen wurden ausgeführt:

| Prüfung | Ergebnis |
| --- | --- |
| Gesamter `npm test` unter Node22.23.4 | 846 bestanden, 2 übersprungen, 0 fehlgeschlagen |
| Gesamter `npm test` unter Node24.22.3 | 846 bestanden, 2 übersprungen, 0 fehlgeschlagen |
| Strikte Typprüfung beider Node-Linien | bestanden, einschließlich neuer Aktivierungs-/Bestandsdaten-Helfer und Browser-Aktivierung |
| Gemeinsames Backend-/Backup-/Helper-Linting | bestanden; neues Browsermodul zusätzlich geprüft |
| Admin- und Installer-Frontendbuild, Backendbuild | bestanden |
| 168 kanonische Runtime-Ausgaben / Syntaxprüfung | bestanden |
| Bisherige SmartHome-Vertrags-/Speicher-/Szenenprüfungen | bestanden |
| Kundensichtbarkeit | 10 Fälle bestanden |
| Auth-/AppCenter-/SmartHome-Zugriffsschutz | 6 Prüfgruppen und zusätzlich 9 Auth-Prüfgruppen bestanden |
| UI-Sicherheitsdelta, unveränderte historische Baseline/Scanner | 190 Quellen; 3.103 Hinweise: 2.955 historische offene, 148 einzeln bewertet; 0 neue unbewertete/verbotene Hinweise |
| Laufzeitabhängigkeiten `npm audit --omit=dev` | 0 bekannte Befunde |
| Gesamter Build-Abhängigkeitsbaum `npm audit` | 14 moderate Entwicklungsbefunde, 0 high, 0 critical; kein vollständig sauberer Gesamtscan |

Die bisherige Schreibsperre während des HTTP-Starts bleibt bestehen. Die neue Fehlerbehandlung entzieht zusätzlich die interne Betriebsfreigabe bei beschädigten übernommenen Konfigurationen. Timer-/Logikuhren-Lesewege zeigen während ihrer Initialisierung einen Ladezustand statt einer leeren Konfiguration.

Die zwei übersprungenen Prüfungen betreffen fehlende nginx-/setfacl-Programme in der Testumgebung. Die Keygen1.0.4-Prüfung wurde mit dem vorhandenen Generatorquellstand ausgeführt und bestanden. Gruppen überschneiden sich; ergänzende Zahlen sind nicht zum Gesamtlauf zu addieren.

Die abschließenden Controller-Integrationstests bestanden unter **Node 22.23.4 und Node 24.22.3 jeweils mit 15 bestandenen und zwei ausgesetzten Fällen** (Exitcode 0). Sie verwenden das tatsächlich installierte 9.0.8-Tarball, Controller-Datenbanken 7.2.5 und einen eigenen Adapterprozess. Start, HTTPS/CA/SAN, Anmeldung, CSRF, Geräte-/EEBus-/Backup-Seiten, Speicherung, Stop/Neustart und Erholung nach einem State-Burst wurden geprüft.

Die zwei ausgesetzten Controller-Fälle betreffen den Hersteller-Schlüsselimport: Die Eigentümer von `/` und `/etc` erfüllen in dieser Umgebung nicht die unveränderte Produktionsvorgabe. Der Keygen-/Import-/Persistenzvertrag wurde separat geprüft. `admin.0` ist eine aktivierte Datenbankfixture, kein zweiter laufender Webserver; die Port-443-Authority wird am realen 8188-Listener geprüft, kein echter 443-Proxy.

Ein vorheriger Node-24-Lauf wurde durch die automatische Freigabeprüfung wegen möglicher Übermittlung einer Installations-UUID an den Ratingdienst blockiert und nicht als abschließender Nachweis verwendet. Der Produktabruf ist nun standardmäßig deaktiviert. Die neuen Controllerläufe begrenzen zusätzlich die geprüften Node-Transporte des Adapterprozesses auf Loopback. Eine anfänglich zu strenge DNS-Testregel verhinderte auch den lokalen Wildcard-Listener; sie wurde ausschließlich in der Testvorrichtung korrigiert und auf beiden Node-Linien geprüft. Dies ist keine Betriebssystem-Firewall. Die endgültigen erfolgreichen Läufe stammen aus frischen Testverzeichnissen.

ZIP und npm-Tarball werden vor Übergabe gegen die Quellbytes, die Integritätsliste und die **unter beiden Node-Versionen tatsächlich getesteten Laufzeitbytes** verglichen. Der maschinenlesbare Liefernachweis mit Archiv-Prüfsummen wird separat mitgeliefert. Die Integritätsliste ist keine Hersteller-Signatur.

## Umfang und Grenzen

Die vollständige automatische Umstellung beliebiger Bestandsanlagen ist weiterhin nicht freigegeben. Die allgemeinen Grenzen aus 9.0.7 bestehen: geschützte Quellgeheimnisse, EEBus-Vertrauensidentität, alte RPC-Verweise, mehrere Quellinstanzen, abweichende Versionen und belegte Ziele benötigen geprüfte Behandlung. Kein pauschales Abschalten oder Löschen alter Adapter.

Ein kontrollierter EOS-Adapter-Neustart gehört zum Paketupdate; eine Neuinstallation des ioBroker-Systems ist nicht erforderlich. Die Tests bestätigen keine unterbrechungsfreie physische Anlagenübergabe. Keine Gerätekommunikation an Kundenhardware, kein serieller/EEBus-Hardwaretest und keine neue RSS-/Regelzeitmessung. Die früheren RAM-Verbesserungen bleiben enthalten; kein zusätzlicher RAM-Gewinn wird behauptet.

Keine visuelle Browserabnahme in dieser Umgebung. Die Same-Tab-Navigation wird anhand des tatsächlichen Linkvertrags und URL-Helfers geprüft. TLS-Vertrauen auf Endgeräten und mDNS/Port443 bleiben an der Zielanlage abzunehmen. Keine CRA-Konformitäts- oder Fehlerfreiheitsgarantie.

Die Installationsskript-Policy gilt für das ioBroker-Hostprojekt und wird vom EOS-Adapter nicht automatisch verändert. Die geprüften neun Paketversionen und ein versionsgenauer Freigabebefehl stehen in [npm-Installation](../../unified/NPM_INSTALLATION_DE.md). Der Git-Integritätshinweis lässt sich nicht durch eine Adapteränderung beseitigen. Das alte esbuild0.11.23 stammt im untersuchten Baum aus dem Entwicklungstestwerkzeug; es wurde nicht als aktuelle Abhängigkeit ausgegeben.

Der vollständige ältere Parallel-Mirror-Sync bleibt offen: Der manuell typisierte, nicht produktiv ausgeführte main-Mirror verlangt einen gesonderten fachlichen Abgleich. Der neue Produktstand wird aus den kanonischen Runtime-Quellen gebaut und seine 168 Ausgaben werden vollständig geprüft; es wird kein grüner Gesamt-Mirror-Lauf behauptet. Nur der beabsichtigte geänderte Sicherheitstest-Mirror wurde synchronisiert.

## Detailnachweise

- [SmartHome-Übernahme](SMARTHOME_UEBERNAHME.md)
- [Node22](NODE22.md)
- [Sicherheitsdelta](SECURITY_DELTA_REVIEW.md)
- [Optionale Online-Bewertungen und Testnetzwerkgrenze](RATINGS_DATENSCHUTZ.md)
- [Bereinigte Prüfprotokolle](raw/INDEX.json)
- [Update-Anleitung](../../../START_HIER_9.0.8.md)
