# Energiefluss – Frontend-Korrektur 9.0.22

Prüfdatum: 25.11.2026. Ausgangspunkt: getrennter Arbeitsstand 9.0.22 aus 9.0.21; Quellbezug in `frontend-source-hashes.json`. Dies ist ein Softwareprüfvermerk, keine Anlagen- oder Serienabnahme.

## Reproduzierte Fehler und Korrektur

- **FLOW922-UI01:** EV-Leistung wurde ohne die Zeitprüfung der übrigen Messwerte gelesen. EV-Anzeige, Karte, Seitenleiste und Gebäudeteilung lesen jetzt denselben zeitgeprüften Wert; Offline-, Zukunfts- und Fehlerqualitätswerte bleiben unbekannt. Eine aktuelle ausdrücklich gewählte Messquelle bleibt vorrangig, auch wenn die Konfiguration nur Zuordnungsflags enthält.
- **FLOW922-UI02:** Unabhängige Hysterese hielt einzelne dargestellte Leistungen fest oder unterdrückte Leistungen unter 120 W. Berechnete Restlast und einzelne Zweige stammten dadurch nicht mehr aus derselben numerischen Sicht. Numerische Werte nutzen nun die aktuellen validen Zahlen. Die Formatierung auf eine Dezimalstelle kW bleibt erhalten; 80 W erscheinen als 0,1 kW.
- **FLOW922-UI03:** Negative Gebäuderestlast wurde auf 0 geklemmt. Jetzt erscheint `--` mit einer sichtbaren Erklärung zur unplausiblen Verbrauchsaufteilung. Ein direkt gemessener gültiger Nullwert bleibt Null. Bei fehlendem direktem Gesamtwert ist nur ein frischer gültiger Backend-Bilanzwert als Ersatz zugelassen.
- **FLOW922-UI04:** Netz- und Batteriezweig zeigten bei gleichzeitig vorhandenen Splitwerten den dominanten Einzelwert. Ein einzelner Zweig zeigt jetzt den Nettofluss (Bezug minus Einspeisung, Entladung minus Ladung). Einzelwerte bleiben in den vorhandenen Detailanzeigen.
- **FLOW922-UI05:** Die sichtbare Bilanz erhält eine Diagnose bei fehlenden Größen oder deutlichen Abweichungen. Toleranz nur für diese Diagnose: max. 150 W oder 3 % der betrachteten Leistung; keine Messzahl oder Regelgrenze wird dadurch verändert. Zusätzliche Erzeugung wird bevorzugt aus der im Backend deduplizierten Größe `derived.core.production.extraW` gelesen. Ein dort vorhandener ungültiger Wert wird nicht durch Browser-Teilsummen ersetzt.
- Negative Gesamtverbrauchswerte und SOC außerhalb 0–100 % werden unbekannt angezeigt. Aus einer Bilanz abgeleitete Batterieleistung wird ausdrücklich als berechnet kenntlich gemacht.

## Beide gemeldeten Bilder als Testfälle

1. PV 2,5 kW + Bezug 3,8 kW + Entladung 2,8 kW ergeben höchstens 9,1 kW Versorgung; EV 10,7 kW + Gebäude 2,3 kW ergeben 13,0 kW Verbrauch. Der Test zeigt die tatsächlich gelieferte Gebäudeteillast und eine Bilanzabweichung von 3,9 kW. Welche reale Zuordnung oder Messverzögerung die Abweichung ausgelöst hat, ist aus dem Bild nicht beweisbar.
2. PV 2,1 kW + Bezug 4,5 kW − Batterieladung 2,2 kW ergeben 4,4 kW Gesamtlast. Nach EV 5,7 kW verbleiben rechnerisch −1,3 kW. Der Test zeigt für Gebäude `--` plus Unplausibilitätsmeldung, statt die falsche Null zu erfinden.

## Durchgeführte Prüfungen

Node.js 24.22.3, Linux-Entwicklungsumgebung, synthetische State-Snapshots; keine echten Gerätezugriffe.

- `node --test test/eos-power-measurements.test.cjs test/eos-live-display-regression.test.cjs`: 23 Tests, Rohbeleg `frontend-tests.log`.
- TypeScript-Prüfungen `ui/tsconfig.power-measurements.json` und `ui/tsconfig.live-display-ui.json`.
- Typbasiertes ESLint der beiden geänderten kleinen Helfer mit deren vorhandener Konfiguration.
- Separater Browserprüfbeleg des Review-Agenten: `docs/reports/unified-9.0.22/raw/current/energyflow-browser.json`. Der abschließende Lieferbuild muss dessen Quellbezug berücksichtigen.

## Erhalt und Grenzen

Keine Änderung an Stellwerten, §14a-, Netzanschluss- oder Gerätegrenzen. Die bisherige Betragskonvention für EV- und Verbrauchermesspunkte bleibt bestehen; diese Korrektur implementiert kein V2G. Bestehende Einstellungen zur Vorzeichenanzeige und zum EV-Abzug bleiben erhalten. Bei deaktiviertem EV-Abzug ist die Zählergrenze kundenspezifisch und wird nicht automatisch umgedeutet.

Offen bleibt die Abnahme mit realen Zeitstempeln, Gerätetypen, Zähleranordnung und W/kW-Zuordnung der betroffenen Anlage. Mehrere unterschiedliche Messpunkte können denselben physischen Anlagenanteil erfassen; ohne gesicherte Zuordnung kann Software diese Überlappung nicht zuverlässig aus Leistungsähnlichkeit ableiten. Die Diagnose weist auf solche Abweichungen hin, statt eine scheinbar passende Gebäudelast zu erzeugen.

## Ergänzung: sichtbarer 5-Sekunden-Takt

Der zusätzliche Nutzerwunsch ist umgesetzt und geprüft. Der bisherige 5-s-Scheduler wurde gehärtet: Die Anzeige verwendet `performance.now()` statt der veränderbaren Systemuhr; versteckte Tabs und `pagehide` räumen Timer ab. Nach Rückkehr wird der neueste gepufferte Snapshot sofort dargestellt, anschließend wieder alle 5 s. Neue SSE-Nachrichten ändern den Puffer sofort, erzwingen aber keinen zusätzlichen Telemetrie-Render zwischen den Takten. Initialdaten und bewusste Bedienaktionen dürfen sofort sichtbar werden.

Auch ohne neue Nachrichten wird der sichtbare Snapshot alle 5 s neu auf Aktualität bewertet. Dabei bleiben sämtliche Quellzeitstempel unverändert. Ein in der Quelle neu bestätigter gleicher Messwert mit neuem Zeitstempel wird von der tatsächlichen Backend-Pollingmethode übernommen; bloßes Nachlesen setzt keinen neuen Messzeitstempel. Die schnelle EMS-Verarbeitung und der bestehende 3-s-Kernwerte-Nachlesetakt wurden hierfür nicht geändert.

Ergänzende Prüfung: `test/eos-energyflow-cadence.test.cjs` mit sechs Szenarien; zusammen mit den 23 Flow-Tests **29/29 bestanden**, siehe `frontend-cadence-tests.log`. Bestehender `verify-live-energy-flow-5s-cadence.js` und JavaScript-Syntaxprüfung bestanden. Der echte Chromium-Test dokumentiert 410 SSE-Bursts innerhalb 10,35 s und drei Render mit Abständen 5.004,6 ms und 5.000,1 ms; Uhrzeitsprung, unveränderte Quellzeitstempel, Hidden-/Visible- und BFcache-Lifecycle zusätzlich geprüft. Rohbeleg: `docs/reports/unified-9.0.22/raw/current/energyflow-cadence-browser.json`.

5 s sind der geplante Anzeigetakt; Browser-Eventloop und Tab-/Betriebssystem-Pausen erlauben keine harte Echtzeitgarantie. Die Messwerterfassung und Anlagenregelung warten nicht auf diesen Anzeigetakt.
