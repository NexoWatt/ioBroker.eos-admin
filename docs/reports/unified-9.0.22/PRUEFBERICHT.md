# NexoWatt EOS 9.0.22 – Änderungs- und Prüfbericht

Datum: 25.11.2026. Ausgangsanlage laut Dominique: EOS 9.0.21, Dousida Energyline über `ocpp21`. Prüfgegenstand ist der vorbereitete gemeinsame Adapter 9.0.22 einschließlich der bereits begonnenen PostgreSQL-/Backup-Umsetzung. Die Kundenanlage, deren konkrete Datenpunktzuordnung und die tatsächliche Wallbox wurden nicht verbunden. Die Software ist nicht auf npm veröffentlicht und nicht auf der Anlage installiert.

## Ausgangspunkt und Umfang

Die angehängte Umsetzungsvorgabe wurde mit dem vorhandenen Arbeitsstand 9.0.22 und den neuen Fehlerberichten abgeglichen. Die spätere ausdrückliche Nutzerentscheidung zur Fremdbedienung gilt: normale ioBroker-Bediendatenpunkte, keine zusätzliche EOS-Integrationsanmeldung oder neue Datenpunkt-ACL-Schicht. Die vorhandenen ioBroker- und Webzugänge bleiben maßgeblich. PostgreSQL gilt ausschließlich für ausdrücklich eingerichtete Neuanlagen; InfluxDB-Bestände werden beim Update nicht umgestellt.

Die Arbeiten erfolgten in einer getrennten Kopie. Dateihashes, aktuelle Testprotokolle, Komponentenübersicht und Freigabegrenzen werden mit dem Lieferstand versiegelt. Eine Hashliste ist ein Integritätsnachweis, keine Herstellersignatur oder Produktzertifizierung.

## Reproduzierte Befunde und Änderungen

| Kennung | Befund | Änderung und Prüfgrundlage |
|---|---|---|
| EF922-01 | Der Browser konnte alte EV-Leistung mit frischen übrigen Messungen kombinieren; unabhängig geglättete Zahlen verletzten die sichtbare Bilanz. | Einheitliche Aktualitäts-/Qualitätsprüfung, unveränderte Messzeitstempel und konsistente Zahlenbasis. Reale Renderfunktionen mit simulierten Messreihen geprüft. |
| EF922-02 | Negative Restlast wurde auf 0 geklemmt. Der Backendpfad erfand teilweise 100 W oder verjüngte gehaltene alte Werte. | Keine künstliche Last. Ungültige/fehlende Messungen bleiben unbekannt; negative Restlast und Bilanzabweichung erhalten eine sichtbare Diagnose. Echte Null bleibt erhalten. |
| EF922-03 | EV-Summen, teilweise PV-Fallbacks und Qualitätsflags konnten veraltete beziehungsweise ungültige Werte als frisch weitergeben. | Gültigkeit aller erforderlichen Summanden, ursprüngliche Zeitstempel und Qualität werden über Priming, StateChange, Nachlese und Ableitung erhalten. Aktuelle zusätzliche Erzeugung wird zentral dedupliziert; Bestands-Slots bleiben unterstützt. |
| TR922-01 | Ohne explizite VIS-Instanz las die Tarifregelung fest `nexowatt-ui.0`, obwohl die gemeinsame Laufzeit `eos-admin.N` verwendet. | Standard folgt dem tatsächlichen Runtime-Namespace; explizite Bestandszuordnungen bleiben erhalten. Fehler auch im Archiv 9.0.21 nachgewiesen. |
| TR922-02 | Bei leerem/inaktivem Backendstatus verschwand die gesamte Tarifanzeige trotz aktivierter Optimierung. | Bestehende kompakte Statuszeile wiederhergestellt. Warten, aktueller Zustand, veraltete Rückmeldung und Verbindungsabbruch werden unterschieden. Qualitätsfehler dürfen keine aktuelle Ladebehauptung erzeugen. |
| EV922-01 | Negativpreispräferenz wandelte ausdrücklich gewähltes PV/Min+PV intern in normale Netzladung um. | PV und Min+PV bleiben bindend; Auto behält Tarifsteuerung. Reproduktion: 1.000 W PV-Budget führte vorher zu 11.000 W Ladeanforderung. Der korrigierte Regeltick erzeugt bei unzureichendem PV-Budget den vorgesehenen Stop und erlaubt später Wiederanlauf. |
| EV922-02 | Der letzte Schreibpfad konnte 0 auf ein konfiguriertes Minimum anheben oder einen kleinen Übergang auf 0 durch Deadband unterdrücken. | Begrenzte EVCS-Stopbehandlung erhält explizite Null. Positive Leistung, Höchstgrenzen und andere Verbraucherkategorien behalten ihre Verträge. Tatsächlicher Consumer-/Registry-Schreibpfad geprüft. |
| PV922-01 | Zentrale PV-Budgetwerte akzeptierten teilweise fehlerhafte Qualität/Zeiten; alte Batterieflüsse und ein sich selbst verlängernder Haltemodus konnten Überschuss vortäuschen. | Strikte Eingangsprüfung, aktuelle kanonische PV-Summe einschließlich Null, strikte Batteriemessung und zeitlich wirklich begrenztes Halten. Keine neue Budget- oder Prioritätsstrategie. |
| EF922-04 | Der vorhandene Anzeigetakt verwendete die verstellbare Wanduhr und lief in versteckten Tabs weiter. | Sichtbare Telemetrie im 5-Sekunden-Takt mit monotoner Uhr; Timerpause bei versteckter Seite, sofortige Anzeige nach Rückkehr. Backend-/EMS-Zyklus wird nicht auf fünf Sekunden verlangsamt. |
| ME922-01 | Einige nachgelagerte Messwertleser behandelten `null` wie 0. | Lade- und Speicherpfade unterscheiden fehlende Werte von echter Null; vorhandene gültige Fallbacks bleiben erhalten. |

Die beiden Nutzerbilder wurden als synthetische Rechenfälle aufgenommen. Beim ersten Fall wird eine Abweichung von 3,9 kW erkannt. Beim zweiten ergeben 2,1 kW PV + 4,5 kW Netzbezug − 2,2 kW Batterieladung zunächst 4,4 kW Gesamtlast. Ein weiterer Abzug von 5,7 kW EV-Leistung ergibt −1,3 kW und darf keinen scheinbar gemessenen Gebäudeverbrauch von 0 erzeugen. Diese Rechenfälle beweisen ohne reale Zählergrenzen und Zeitstempel nicht die alleinige Ursache an der Anlage.

## Umsetzungsvorgabe Historie und Sicherung

PostgreSQL-Historienclient, begrenzte Puffer, lokale TLS-Verbindung, getrennte Rollen, Systemsetup und Historienoberfläche sind im Lieferstand enthalten. Die isolierten Tests prüfen echte PostgreSQL-17.12-Verbindungen, Datenbankrechte, ungültige Zertifikate, Schreib-/Lesezyklen, Dump und Wiederherstellung in eine getrennte Datenbank. Ein gewöhnliches Adapterupdate installiert weiterhin keine Systempakete und behauptet bei fehlender Systembereitstellung keinen Erfolg.

Die Sicherung berücksichtigt Controller-/EOS-Daten und den tatsächlich benötigten Historienanbieter. InfluxDB-Bucket-/Manifestprüfung, verschlüsselte Archive, Fehleranzeige und Offline-Wiederherstellungsvorbereitung sind enthalten. InfluxDB 2.10.1 wurde mit getrennten temporären Quell-/Zieldiensten tatsächlich gesichert und wiederhergestellt. Die Befunde BK921-01 bis BK921-05 werden im [Backup-Nachprüfbericht](BACKUP_POSTGRES_FOLLOWUP.md) fortgeführt; insbesondere ist eine komplette Ersatzanlage weiterhin gesondert abzunehmen.

## Testumgebung und Aussagegrenzen

Linux x86_64, Dienstbenutzer mit UID 1000, Node.js 22.23.4 und 24.22.3. Keine Root-Laufzeit, keine realen Wallboxbefehle und keine Kunden-Datenbankzugriffe. Controller-/Gerätegegenstellen sind in den Regelungstests simuliert; Datenbanktests verwenden ausdrücklich gestartete temporäre reale Dienste. Chromium prüft echtes HTML/CSS und tatsächliche Render-/Schedulingquellen mit lokalen Testdaten.

Die vollständigen aktuellen npm-Testprotokolle und die aus ihren tatsächlichen Zusammenfassungen ermittelten Ergebnisse stehen unter `raw/node22-tests-final.log`, `raw/node24-tests-final.log` und `raw/INDEX.json`. Der Freigabeprüfer bindet diese Belege an die tatsächlich ausgelieferten Dateien. Die aktuelle Ergebnisübersicht am Ende dieses Berichts ergänzt die konkreten Zähler.

Weitere geprüfte Ebenen: vorhandene TypeScript-Prüfprofile, ESLint, kanonische Runtime-Erzeugung, Admin-/Backend-/Modulbuild, Frontend- und Laufzeitregressionen, Paketschema, Lieferinhalt und gezielte Geheimnismuster. Die großen Bestandsdateien besitzen teilweise weiterhin eingeschränkte Typprüfung; eine vollständige strikte TypeScript-Migration wird nicht behauptet.

Im abschließenden Chromium-Test führten 410 simulierte SSE-Aktualisierungen zu drei Rendern mit etwa 5.005 und 5.008 ms Abstand. Das bestätigt den nominalen Anzeigetakt in dieser Umgebung, keine harte Echtzeitgarantie oder Messkadenz der Geräte.

Zusätzliche ältere Prüfskripte mit statischen Quelltextvergleichen scheitern an nicht mehr gültigen String-/Whitespace-Erwartungen. Sie sind in den Teilberichten als **nicht bestanden** dokumentiert, nicht als erfolgreich umetikettiert. Die betroffenen fachlichen Pfade wurden mit ausführbaren Regressionstests geprüft. Diese alten Textprüfungen bleiben technische Testschuld.

## OCPP-Grenze

`ocpp21` bleibt auf ausdrücklichen Wunsch ein separater Adapter. EOS Admin regelt und bedient über die vorhandenen Datenpunkte; eine Integration des OCPP-Servers ist nicht vorgesehen.

Der verfügbare frühere OCPP21-Quellstand 0.2.2 wurde nur als klar gekennzeichneter Vertragsvergleich benutzt. Er sendet für `chargeLimit=0` einen `SetChargingProfile`-Befehl mit Limit 0. Im selben historischen Stand ist `ack:true` auch bei einer abgelehnten RPC-Antwort möglich. Daraus wird weder die installierte Adapterversion abgeleitet noch eine bestätigte Dousida-Hardwarewirkung behauptet. Der OCPP-Adapter selbst wurde in diesem Lieferstand nicht ersetzt.

Vor Anlagenfreigabe müssen Sollwert, tatsächliche OCPP-Antwort, Stationsstatus und reale Leistung gemeinsam geprüft werden. Ein bestätigter ioBroker-Schreibvorgang allein genügt nicht. Die praktische Folge Start → Überschussverlust → Pause → Überschussrückkehr → Wiederanlauf ist auf der Dousida noch offen.

## Lieferkette und Sicherheitsbetrachtung

Keine neue Laufzeitabhängigkeit für die Energiefluss-/Ladekorrekturen. Der bereits aufgenommene PostgreSQL-Client gehört zum 9.0.22-Historienumfang. Die SBOM beschreibt den festgelegten Lockfile-Liefergraphen mit gebündelten Komponenten; direkte Produktionsabhängigkeiten wurden gegen die vorhandenen installierten Versionen abgeglichen. Der aktuelle Produktions-Abhängigkeitsaudit meldete keine bekannten Treffer. Das ist kein Nachweis unbekannter Schwachstellenfreiheit.

Die Runtime-Erzeugung erhält nun die geprüfte CommonJS-Importkompatibilität. Der Markdown-Build verwendet den bereits im Installer-Lockfile vorhandenen gepflegten Compiler statt eines alten transitiven Buildwerkzeugs; die Parser-Laufzeitbytes bleiben unverändert. Bei der normalen npm-BOM-Erzeugung trat wegen der wiederverwendeten Entwicklungsabhängigkeiten ein Werkzeugfehler auf; die dokumentierte SBOM wurde anschließend ausdrücklich aus dem Lockfile erstellt, nicht als fehlerfreier Scan des gesamten Entwicklungsverzeichnisses ausgegeben.

Messwertvalidierung schützt die fachliche Berechnung und die sichere Fehlerbehandlung. Sie ersetzt keine Geräteauthentifizierung oder elektrische Schutzfunktion. Es wurden keine Netzanschluss-, Geräte-, §14a-, RFID- oder Lizenzgrenzen aufgehoben. Die bestehende gemeinsame ioBroker-/Dienstkonto-Vertrauensgrenze bleibt bestehen. Hersteller-Signierschlüssel werden nicht ausgeliefert. Keine CRA-, IEC- oder ASVS-Vollkonformität wird aus diesen Tests abgeleitet.

## Noch offen / Freigabestatus

- Echte Dousida-Energyline-Abnahme mit der tatsächlich installierten OCPP21-Version, ihrer Firmware und der konkreten Anlage.
- Vergleich der originalen Messwerte und Zählergrenzen sowie Dauerbetrieb auf der Zielhardware; keine gemessene Garantie eines 50-/100-ms-Regeltakts.
- PostgreSQL-Paketbereitstellung, systemd-/Hostneustart, externer Netzwerkzugriffsversuch und physischer Datenträgervollstand auf einem unterstützten Zielsystem.
- Vollständiger getrennter Wiederaufbau von Controller, EOS, Datenbanken, Benutzern, Geräteidentitäten und Vertrauen auf Ersatzhardware.
- Die dokumentierten älteren statischen Testskripte modernisieren, ohne deren fachliche Anforderungen abzusenken.

**Status: vorbereiteter, technisch geprüfter Testlieferstand.** Keine pauschale Serien-/Kundenfreigabe und keine 100%-Zuverlässigkeitsgarantie. Update, Anlagenprüfung und Rückfall sind in [START_HIER_9.0.22.md](../../../START_HIER_9.0.22.md) beschrieben.

## Aktuelle abschließende Ergebnisse

| Prüfung | Ergebnis |
|---|---|
| Vollständiges `npm test`, Node v22.23.4 | 2247 Tests: 2245 bestanden, 0 Fehler, 2 ausgelassen |
| Vollständiges `npm test`, Node v24.22.3 | 2247 Tests: 2245 bestanden, 0 Fehler, 2 ausgelassen |
| Typprüfung und ESLint gemäß aktuellen Projektprofilen | Bestanden |
| Runtime-Erzeugung und Vergleich aller 207 ausführbaren Dateien | Bestanden |
| Zusätzliche finale Safety-Envelope-, Stationsfreigabe-, Availability- und Speicher-Feed-forward-Prüfungen | Bestanden |
| Chromium: Energiefluss/Tarif Desktop und Mobil | 14 Szenarien bestanden; zusätzlicher echter 5-Sekunden-Timertest bestanden |
| PostgreSQL 17.12 | 9 reale Integrationstests bestanden; 17 Unit-/API-Tests bestanden |
| Produktions-Abhängigkeitsscan | 0 bekannte Treffer im geprüften Lockfile-Scope |

Die zwei ausgelassenen Tests pro Gesamtlauf betreffen `nginx -t` und geerbte POSIX-ACLs, deren Werkzeuge hier fehlen. Sie sind keine bestandenen Prüfungen. Der echte InfluxDB-Export/Restore und der als historisch gekennzeichnete OCPP21-Vertragsvergleich liefen in beiden Gesamtprüfungen ohne Skip.
