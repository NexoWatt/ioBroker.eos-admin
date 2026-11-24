# Geräte direkt dem EMS zuordnen – 9.0.18

In **Geräte → Gerät hinzufügen / Gerät bearbeiten → EMS-Zuordnung** wird die Aufgabe des Geräts gewählt. Die Auswahl gehört zur gespeicherten Gerätekonfiguration. Die automatische Zuordnung verwendet die tatsächlich verfügbaren, passenden Alias-V1-Datenpunkte des Geräteprofils. Ein manuell angelegter Datenpunkt oder ein unbekanntes Geräteprofil wird dadurch nicht automatisch zu einem unterstützten steuerbaren Gerät.

Der Ablauf gilt herstellerübergreifend. Bei SolaX, FENECON und anderen Herstellern entscheidet das konkrete Modell-/Treiberprofil, welche Messwerte, Rückmeldungen und Schreibfunktionen tatsächlich verfügbar sind. Der Herstellername allein bestätigt keine vollständige Regelfunktion. Optionale, nicht verfügbare Profilwerte werden getrennt von erforderlichen fehlenden Datenpunkten angezeigt; sie lösen keine automatische Betriebsfreigabe aus.

## Einrichtung

1. Geräteprofil, Verbindung und Geräte-ID einrichten.
2. Im selben Gerätefenster die **EMS-Funktion** und gegebenenfalls **Regelbereich / Messpunkt** oder **Ziel im Energiefluss** auswählen.
3. Im Gerätefenster speichern und anschließend oben **Speichern und übernehmen** wählen. Erst dieser zweite Schritt speichert den Gerätestand auf dem EOS-Gerät.
4. Den Zuordnungsstatus in der Geräteliste prüfen. Während Geräte-Datenpunkte entstehen oder das EMS startet, darf der Status zunächst offen bleiben. **Zuordnungsstatus aktualisieren** liest nur den Status; ungespeicherte Geräteeingaben bleiben erhalten.
5. **Ladepunkte öffnen** oder **EMS App-Center öffnen** führt im selben Browser-Tab zu den zugeordneten Funktionen. Dort die Grenzen, Messrichtungen, Regelzuständigkeit und Betriebsfreigabe prüfen.

## Auswahl nach Geräteart

| Geräteart | EMS-Funktion | Weitere Auswahl | Automatisches Ziel |
| --- | --- | --- | --- |
| Unterstützte Wallbox / EVCS | Automatisch nach Geräteprofil | Keine zweite Datenpunkt-Zuordnung | Eintrag unter Ladepunkte mit den verfügbaren Mess- und Steuerdatenpunkten |
| Netzanschlusszähler | Netzanschlusszähler | M0 – Hauptanschluss | Zugehöriger Hauptanschluss-Messwert im Energiefluss |
| Zähler einer Unteranlage | Netzanschlusszähler | M1 – Unteranlage | Messwert des vorhandenen dynamischen M1-Messpunkts; fehlt diese Topologie, bleibt die Zuordnung zur manuellen Prüfung offen |
| Erzeugungszähler | Erzeugungszähler | PV-Hauptanlage oder Weitere Erzeugungsanlage 1 bis 5 | Gewähltes bestehendes Erzeugungsfeld im Energiefluss |
| Verbrauchszähler | Verbrauchszähler | Verbraucher 1 bis 10 | Gewähltes bestehendes Verbrauchsfeld im Energiefluss |
| PV-Wechselrichter | PV-Wechselrichter / Erzeugungsanlage | PV-Hauptanlage oder Weitere Erzeugungsanlage 1 bis 5 | Gewähltes bestehendes Erzeugungsfeld im Energiefluss |
| Speicher als Einzelanlage | Einzelspeicher | M0 – Hauptanschluss | Passende verfügbare Datenpunkte der vorhandenen Einzelregelung |
| Speicher als Farmmitglied | Speicherfarm-Mitglied | M0 – Hauptanschluss | Eintrag in der vorhandenen Speicherfarm mit passenden verfügbaren Datenpunkten |
| Speicher an M1 | Einzelspeicher oder Speicherfarm-Mitglied | M1 – Unteranlage | Keine automatische M1-Speicherregelung; die bisherige fehlende automatische M1-Regelungszuordnung wird nicht durch diese Auswahl ersetzt |
| Gerät ohne automatische Zuordnung | Manuell im App-Center zuordnen | Keine | Einrichtung erfolgt im App-Center |
| Gerät nur für Messwerte | Nur Messwerte · verwaltete Steuereinträge deaktivieren | Keine | Keine neue EMS-Zuordnung; die für dieses Gerät automatisch verwalteten Wallbox-/Speicher-Steuereinträge werden deaktiviert, Zuordnungen und Grenzen bleiben erhalten |

Die Rollen stehen nur bei der passenden Gerätekategorie zur Auswahl. Die Auswahl **Automatisch nach Geräteprofil** bestimmt bei Speichern keine Einzel-/Farm-Zuständigkeit und bei PV-/Zählergeräten keinen beliebigen Energieflussplatz. Diese Aufgaben werden ausdrücklich ausgewählt.

Ein Erzeugungsplatz bezeichnet **ein vorhandenes Anzeigefeld mit einer Quelle**, keine automatisch summierte Gruppe mehrerer Wechselrichter. Es gibt die PV-Hauptanlage und fünf weitere Erzeugungsfelder. Zähler und Wechselrichter derselben Anlage dürfen nicht doppelt zur Gesamtproduktion gezählt werden. Ebenso wird eine Quelle nicht automatisch zusätzlich einem anderen Messpunkt oder Verbrauchsfeld zugeordnet.

**Datenpunkt oder Zahlenwert:** In einer Datenpunkt-Zuordnung wird über die Datenpunktauswahl der passende Mess- oder Steuerwert ausgewählt. Beispielsweise ist die PV-/WR-Leistung dort ein Messwert-Datenpunkt; eine feste Wattzahl wie `10000` ist keine gültige Zuordnung. Dasselbe gilt für Speicher-Istleistung oder Ladepunkt-Leistung. Echte Felder für Mindest-/Höchstleistung oder Nennleistung erwarten dagegen einen Zahlenwert mit Einheit. Eine bereits gespeicherte Zahl in einem Datenpunkt-Feld wird nicht heimlich ersetzt, sondern als ungültige Zuordnung zur Korrektur angezeigt.

## Was nach dem Speichern passiert

Die Geräte werden zuerst gespeichert. Die EMS-Zuordnung kann anschließend folgen, wenn Alias-Datenpunkte und EMS verfügbar sind. Ein offener Zuordnungsstatus bedeutet deshalb nicht, dass die Gerätekonfiguration erneut angelegt werden muss.

Vorhandene nicht leere Datenpunkt-Zuordnungen werden nicht blind ersetzt. Ein bereits belegtes Ziel, doppelte Quellen und konkurrierende Steuerzuständigkeiten erscheinen als Konflikt. Ein späterer Wechsel von beispielsweise Erzeugungszähler zu Verbrauchszähler entfernt eine vorhandene Zuordnung nicht stillschweigend: Die bestehende Zuordnung muss im App-Center abgeglichen werden.

Die automatische Zuordnung aktiviert keine zusätzliche EMS-App. Neue steuerbare Einträge für Wallboxen und Speicher bleiben zunächst **deaktiviert**, bis die Inbetriebnahme im App-Center geprüft und freigegeben wurde. Eine vorhandene Betriebsfreigabe, Anlagenlimits oder manuell gespeicherte Einstellungen werden nicht durch einen neuen Standard ersetzt. Die gezielte Deaktivierung bei **Nur Messwerte**, deaktivierten oder entfernten Geräten ist im folgenden Absatz beschrieben. „Zugeordnet“ bezeichnet die Datenpunkt-Zuordnung und bestätigt weder eine aktive Regelung noch eine erfolgreiche Hardwareprüfung.

Ein Speicher darf nicht gleichzeitig durch Einzelregelung und Speicherfarm gesteuert werden. Die Oberfläche bietet die vorhandene Speicherfarm an, keine erfundenen zusätzlichen Farmgruppen. M1-Messwertzuordnung und aktive M1-Speicherregelung sind unterschiedliche Funktionen; eine M1-Zählerzuordnung schaltet keine automatische M1-Speicherregelung frei.

Bei **Nur Messwerte** sowie nach bestätigter Deaktivierung oder Entfernung eines Geräts setzt EOS ausschließlich die zu diesem Gerät gehörenden, von dieser Automatik verwalteten Wallbox-/Speicher-Steuereinträge auf **deaktiviert**. Datenpunkt-Zuordnungen und Grenzen bleiben gespeichert. Diese Einträge werden auch bei einer späteren Wiederaufnahme nicht automatisch erneut freigegeben; ihre Betriebsfreigabe erfolgt nach Prüfung im App-Center.

Andere manuell angelegte oder nicht eindeutig dieser Automatik zugehörige EMS-Einträge bleiben unverändert und müssen im App-Center gesondert geprüft werden. Die Auswahl **Manuell im App-Center zuordnen** erhält absichtlich auch bestehende Betriebsfreigaben; sie beendet keine bereits aktive Regelung.

## Statusmeldungen

| Anzeige / Grund | Bedeutung und nächster Schritt |
| --- | --- |
| Zugeordnet / Betriebsfreigabe prüfen | Datenpunkte wurden zugeordnet; Anlagenlimits und Freigabe im App-Center kontrollieren |
| Teilweise zugeordnet | Der Eintrag existiert, aber notwendige Mess-, Verbindungs- oder Steuerdatenpunkte fehlen; die Liste nennt bekannte fehlende Funktionen |
| Optional nicht verfügbar | Das konkrete Profil stellt eine zusätzliche Rückmeldung oder einen Zusatzwert nicht bereit; erforderliche Zuordnung und Betriebsfreigabe werden gesondert bewertet |
| Eine Zahl ersetzt keinen Datenpunkt | Ein Zuordnungsfeld enthält beispielsweise eine Wattzahl statt einer Datenpunkt-ID; über die Datenpunktauswahl korrigieren |
| Geräte-Datenpunkte werden vorbereitet | Alias-Datenpunkte sind noch nicht verfügbar; Status später aktualisieren |
| Funktion und Ziel auswählen | EMS-Rolle oder Mess-/Energieflussplatz ist noch offen |
| Ziel bereits belegt | Vorhandene Zuordnung bleibt erhalten; im App-Center abgleichen |
| Messwert bereits im Energiefluss zugeordnet | Die neue Auswahl würde dieselbe Quelle doppelt zuordnen; bestehende Zuordnung prüfen |
| Speicher bereits einer anderen Regelung zugeordnet | Einzelregelung/Farm und Regelzuständigkeit abgleichen |
| Regelungsart vor Zuordnung des Netz-Sollwerts prüfen | Die bestehende Direktregelung bleibt erhalten. Eine ergänzte netzbezogene Steuerung könnte sonst die Befehlskette wechseln; Regelungsart im App-Center ausdrücklich prüfen |
| Nur Messwerte / verwaltete Steuereinträge deaktiviert | Automatisch verwaltete Steuereinträge sind aus; Zuordnungen und Grenzen bleiben erhalten. Andere manuelle Einträge gesondert prüfen |
| Grenze der Systemlizenz erreicht | Lizenzumfang und vorhandene Einträge prüfen; die gemeinsame Systemlizenz bleibt maßgeblich |
| Zuordnung für diese Anlagentopologie prüfen | Automatische Zuordnung ist für die gewählte Topologie nicht möglich; insbesondere M1-Speicher nicht als automatisch eingerichtet behandeln |
| Geräte gespeichert, EMS-Zuordnung noch nicht abgeschlossen | Gerätespeicherung und nachgelagerte EMS-Zuordnung sind getrennte Ergebnisse; gespeicherte Geräte nicht erneut anlegen |

## Technischer Prüfstand dieser Oberfläche

Die Preisquelle richtet der Kunde separat unter [Dynamischen Tarif einrichten](KUNDENTARIF_EINRICHTUNG.md) ein. Tarifparameter ersetzen keine Gerätezuordnung oder Anlagenfreigabe.

Am 24.11.2026 wurden folgende Prüfungen im Quellstand ausgeführt:

- `node --test modules/devices/test/emsAssignmentUi.test.js test/eos-module-editor-session.test.cjs`: **43 bestanden** (33 neue UI-/Validierungs-/Polling-Vertragstests und 10 bestehende Session-/Speicherprüfungen).
- `node_modules/.bin/tsc -p modules/devices/tsconfig.ems-ui.json`: bestanden.
- `node_modules/.bin/tsc -p modules/devices/tsconfig.hosted.json`: bestanden.
- `node_modules/.bin/eslint -c modules/devices/eslint.hosted.config.mjs modules/devices/index.js modules/devices/admin/ems-assignment.js modules/devices/admin/host-bridge.js`: bestanden.
- `node --check modules/devices/admin/index_m.js`: bestanden.

Die Vertragstests prüfen unter anderem gültige/ungültige Rollen, Slotgrenzen, den Erhalt bestehender Geräteeinstellungen, sichere Textausgabe, erkennbare unvollständige Zuordnungen sowie begrenzte Statusabfragen ohne Verlust ungespeicherter Eingaben. Sessiontests prüfen weiterhin CSRF-Erneuerung, abgelaufene Sitzungen, fehlende Rechte und keine automatischen Wiederholungen fehlgeschlagener Schreibaktionen.

Der vorbereitete echte Browsercheck wird mit `EOS_BROWSER_OUTPUT=/tmp/eos-device-ui-screenshots node --test modules/devices/checks/emsAssignment.check.js` ausgeführt. In der aktuellen Prüfumgebung brach Chromium auch mit isoliertem temporärem Profil **vor dem Seitenaufruf** ab: `process_singleton_posix.cc: socket() failed: Operation not permitted`. Desktop-/Mobilansicht und Browser-Speicherdurchlauf sind deshalb hier **nicht nachgewiesen**; es wurden keine Screenshots erzeugt. Die lokalen DOM-Vertragstests ersetzen diesen offenen Browsernachweis nicht.

Diese Prüfungen sind keine reale Wallbox-/Speicherinbetriebnahme und kein Konformitätsnachweis. Messrichtung, Skalierung, Grenzwerte und Regelreaktion müssen für die Kundenanlage geprüft werden. Ergebnisse der separaten Backend-/Planerprüfungen stehen im übergeordneten Releasebericht.
