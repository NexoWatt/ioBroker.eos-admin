# NexoWatt EOS 9.0.22 – Energiefluss, Tarifstatus, PV-Laden und Historie

Dieser vorbereitete Teststand setzt auf 9.0.21 auf. Er enthält den gemeinsamen EOS-Adapter, korrigierte Energieflusswerte und Tarifstatus sowie PostgreSQL für ausdrücklich eingerichtete Neuanlagen. Die bestehende InfluxDB-Anlage wird beim Update weder migriert noch umgestellt. Die normale Fremdbedienung erfolgt wie zuletzt gewünscht über die bestehenden ioBroker-Datenpunkte ohne zusätzliche EOS-Zugänge.

## Korrigiertes Verhalten

- Der Energiefluss verarbeitet aktuelle Messwerte mit ihren ursprünglichen Zeitstempeln. Echte 0 W bleiben 0 W. Fehlende, ungültige oder widersprüchliche Werte werden als unbekannt beziehungsweise mit einem Bilanzhinweis dargestellt; es wird kein Gebäudeverbrauch erfunden.
- Netz, PV, Speicher und Ladeleistung werden ohne voneinander abweichende Zahlenglättung verrechnet. Zusätzliche Erzeugung wird nicht doppelt gezählt.
- Die Tarifstatuszeile erscheint bei aktivierter Optimierung wieder im Energiefluss. Frischer Regelungsstatus, Warten, veraltete Rückmeldung und Verbindungsabbruch werden unterschieden. Die Tarifregelung liest den tatsächlichen EOS-Namespace; bestätigte Bestandszuordnungen bleiben erhalten.
- Explizites PV-Laden bleibt PV-Laden, auch wenn ein dynamischer Tarif Netzbezug wirtschaftlich bevorzugt. Min+PV bleibt auf Mindestladung plus PV-Anteil begrenzt. Auto behält seine wirtschaftliche Tarifsteuerung. Anlagen-, Geräte-, RFID- und Netzgrenzen bleiben maßgeblich.
- Der sichtbare Energiefluss wird im 5-Sekunden-Takt aktualisiert. Versteckte Seiten pausieren und zeigen bei Rückkehr sofort den aktuellen Puffer. Dieser Anzeigetakt ändert die schnellere EMS-Regelung nicht und erzeugt keine neuen Messzeitstempel.

## Update von 9.0.21

1. Eine aktuelle ioBroker-/EOS-Sicherung und die Historien-Datenbanksicherung erstellen; Wiederherstellungsschlüssel getrennt aufbewahren. Gerätekonfiguration und EMS-Einstellungen exportieren.
2. Die bestehende Instanz im geplanten Wartungsfenster aktualisieren. Während Stop/Neustart ist die EMS-Regelung zeitweise nicht verfügbar. Keine Instanz löschen, Geräte nicht erneut anlegen und keine abgeschlossene Bestandsübernahme wiederholen.
3. Nach dem Neustart Version 9.0.22, bestehende Benutzer, Lizenz, Datenpunkte, Leistungsgrenzen und Historienanbieter kontrollieren. Die vorhandene InfluxDB und ihre Daten müssen erhalten sein.
4. Den Browser vollständig neu laden. Dynamischen Tarif aktivieren und die Statuszeile unter dem Energiefluss kontrollieren. Preise, Modus und tatsächlichen Speicherzustand vergleichen.
5. Energiefluss über mehrere 5-Sekunden-Zyklen mit den Originalmesswerten vergleichen. Netzbezug ist positiv, Einspeisung negativ; Batterieentladung zum Gebäude ist positiv, Ladung negativ. Die Gebäudeanzeige stellt bei aktiviertem EV-Abzug die Restlast ohne die separat angezeigten Verbraucher dar.
6. Bei einem Bilanzhinweis Zählergrenze, Vorzeichen, Einheit, Zuordnung und Messzeitstempel prüfen. Ein fehlender Messwert wird nicht durch einen frei erfundenen Gebäudewert ersetzt.

## Dousida Energyline über ocpp21: Praxistest

`ocpp21` bleibt gemäß der ausdrücklichen Entscheidung ein separater Adapter. EOS Admin übernimmt Regelung und Bedienung über die vorhandenen Datenpunkte; eine Einbettung des OCPP-Servers ist nicht Bestandteil dieses Standes.

Die konkrete Wallbox wurde in dieser Bearbeitung nicht verbunden. Der Softwaretest prüft den EMS-Entscheidungs- und Datenpunkt-Schreibpfad mit simulierten Rückmeldungen. Für die Anlagenabnahme:

1. Reinen PV-Modus wählen, Regelung aktiv lassen und Speicherunterstützung gemäß gewünschter Einstellung belassen.
2. Bei fehlendem Überschuss nach Ablauf der vorhandenen Start-/Stop-Verzögerung kontrollieren: effektiver Modus PV, Lade-Sollwert 0, Übertragung an `ocpp21`, OCPP-Antwort und anschließend gemessene Ladeleistung sowie Stationsstatus.
3. Ein `ack:true` am Befehlsdatenpunkt allein beweist keine erfolgreiche OCPP-Übernahme oder physische Wirkung. Bei weiter fließender Leistung Antwort/Log und tatsächliche Werte prüfen; zum unmittelbaren Beenden die direkte Stop-Funktion der Wallbox nutzen.
4. Bei erneut ausreichendem Überschuss Wiederanlauf prüfen, ohne Umstecken vorauszusetzen. Anschließend Auto, Min+PV und die normale Stationsfreigabe testen. Keine Anlagenlimits erhöhen.

## Historie, Sicherung und Neuanlagen

- Die vollständige Abdeckung des aktiven Historienanbieters wird geprüft. Ein fehlender Datenbankteil darf nicht als vollständige Gesamtsicherung erscheinen.
- PostgreSQL-Logger und lokales TLS-Verbindungsprofil sind enthalten. Ein gewöhnliches Adapterupdate installiert keine Betriebssystempakete. Die ausdrücklich beauftragte Neuanlage benötigt den getrennten begrenzten Systemschritt: [PostgreSQL-Einrichtung](../unified/POSTGRESQL_9_0_22.md).
- InfluxDB-Bestand bleibt erhalten. Datenbankwiederherstellung wurde isoliert geprüft; ein vollständiger Wiederaufbau eines Ersatzgeräts mit allen Identitäten und realen Geräten ist gesondert abzunehmen: [Wiederherstellung](../../modules/backup/RECOVERY-9.0.22.md).
- [Normale EMS-Bediendatenpunkte](../unified/EMS_BEDIEN_DATENPUNKTE_9_0_22.md) erläutern Stationsfreigabe, Modi, Wertebereiche und die bestehende ioBroker-Vertrauensgrenze.

## Paket und Rückfall

Die vollständige Repository-ZIP enthält vorbereitete Builds und Prüfbelege. Das TGZ ist das daraus geprüfte Adapterpaket. Der Lieferstand ist für den Testkanal `next` vorbereitet und wurde hier nicht auf npm veröffentlicht oder auf einer Anlage installiert. Der Kundenupdater bietet ausschließlich den stabilen Kanal `latest` an; dieses lokale Testpaket erscheint dort nicht automatisch.

Für den bereits vereinbarten npm-Arbeitsablauf die ZIP in einen eigenen Ordner entpacken, dort `node -p "require('./package.json').version"` prüfen und erst bei beabsichtigter Veröffentlichung `npm publish` verwenden. Die Ausgabe muss 9.0.22 lauten. Die vorhandenen Prüfungen bleiben aktiv; `--ignore-scripts` oder manuelles Neuversiegeln sind keine Fehlerbehebung.

Bei einem erforderlichen Rückfall die gesicherte vorherige Version und dazu passende Konfiguration/Historie verwenden. Eine neue PostgreSQL-Anlage nicht ungeprüft mit einem alten Stand starten, der diesen Historienanbieter nicht unterstützt. Auf der bestehenden InfluxDB-Anlage findet keine automatische Datenmigration statt.

Der [Prüfbericht](../reports/unified-9.0.22/PRUEFBERICHT.md) trennt ausgeführte Software-/Datenbank-/Browserprüfungen von offenen Zielhardware- und Anlagenprüfungen. Dieser Teststand ist keine pauschale Serienfreigabe oder Garantie vollständiger Fehlerfreiheit.
