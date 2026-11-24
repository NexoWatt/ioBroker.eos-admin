# Direkte Influx-Historie: ergänzende Integrationsprüfung

Stand: 24.11.2026, Kandidat 9.0.20. Getrennter KI-Code-Review der Runtime-Integration; keine externe Zertifizierung oder Geräteabnahme. Die endgültige Zuordnung aller Produktdateien erfolgt über das Release-Manifest und die abschließenden Prüfläufe.

## Ergebnis und nachgeprüfte Fehler

- Die SmartHome-Historie fordert tatsächlich `aggregate: minmax` an, auch für boolesche Zustände. Der erste direkte Client lehnte diesen Aufruf ab. Zwei reale HTTP-Routenprüfungen reproduzierten `503 EOS_CONTROL_HISTORY_UNAVAILABLE`. Nach Ergänzung der begrenzten serverseitigen Fensterabfrage bestehen beide Prüfungen für Zahlen und boolesche Werte. Reale Datenbankausführung der Flux-Abfrage bleibt gesondert offen; der HTTP-Gegenserver liefert in diesen Tests kontrollierte CSV-Antworten.
- Die vorhandene Ladeberichtsberechnung erzeugt bis zu 60.000 Punkte; die erste Clientgrenze von 50.000 war damit inkompatibel. Der Transport wurde auf die vorhandenen 60.000 Punkte abgestimmt. Die tatsächlichen Ladeberichts-Routenprüfungen und Grenzfälle sind im Runtime-Integrationsbericht des implementierenden Arbeitspakets dokumentiert.
- Zwei ältere History-Prüfdateien extrahierten die betroffenen Produktionsmethoden, aber zunächst nicht die neue gemeinsame Dispatch-Methode. Ausschließlich diese Methodenlisten wurden um die originale `_nwDispatchHistory` ergänzt. Es wurden keine Erwartungen entfernt, keine fachlichen Ersatzfunktionen eingebaut und keine Zeitgrenzen angehoben. Alle 35 bisherigen Fälle bestehen auf beiden Node-Linien.

## Geprüfte Wirkung

Die unabhängigen Integrationstests führen die generierte `NexoWattVis`-Klasse und den tatsächlichen Hosted-Adapter aus. `TarifVisModule._setIfChanged` und `Para14aModule._setState` gelangen nach bestätigtem ioBroker-Schreiben zum direkten Historienclient. Ein lokaler HTTP-Gegenserver prüft die ausgelieferten Messpunkte. Negative Preise, echte Nullwerte und explizite Messzeitstempel bleiben erhalten. Eine bestätigte Migration behält `nexowatt-ui.0` als Messreihen-Namespace. Abgelehnte oder fehlgeschlagene ioBroker-Schreibvorgänge gelangen nicht zur Historisierung. Nicht registrierte Gerätewerte bleiben außerhalb dieses ausdrücklich begrenzten Aufzeichnungsumfangs.

Geprüfte Lebenszyklusfälle: ein ungültiger Wert kann keinen gültigen Batch vergiften; parallele Leseaufträge verdrängen den Schreiber nicht; Änderungen des Datenbankziels sperren zuvor erfasste und verspätete Aufträge; normaler Stopp leert die Warteschlange innerhalb seiner Frist; Fristablauf zählt unbestätigte Punkte, ohne einen erfolgreichen Schreibzugriff vorzutäuschen. Abgeschnittene und übergroße HTTP-Antworten werden verworfen. Wiederholt ausdrücklich gesendete Punkte behalten identische Zeitstempel und Nutzdaten.

## Ausgeführte Prüfungen

| Umfang | Node 24.22.3 | Node 22.23.4 |
| --- | --- | --- |
| Sechs produktive Modul-/SmartHome-Integrationsprüfungen, sechs zusätzliche Runtime- und drei Transportprüfungen | 15 bestanden | 15 bestanden |
| Bisherige History-API-/Deadline-Regressionen mit originaler Dispatch-Methode | 35 bestanden | 35 bestanden |

Alle genannten Läufe: keine fehlgeschlagenen, abgebrochenen oder übersprungenen Fälle. Befehle, Ausführungszeiten, Exitcodes und Loghashes stehen unter `raw/influx-independent/`. Die sechs neuen produktiven Regressionsfälle sind in `test/eos-influx-hosted-module-history.test.cjs` Bestandteil des vorhandenen `eos-influx*.test.cjs`-Prüfumfangs. Die unveränderten zusätzlichen Review-Tests sind als Rohbelege beigefügt. Weitere Prüfungen des Implementierungspakets und der vollständigen Suite sind getrennt ausgewiesen.

## Kompatibilität und Grenzen

Der Quellcode des tatsächlich genannten ioBroker-InfluxDB-Adapters 5.1.8 wurde als Primärquelle geprüft: eigene Messreihe je State-ID, Nutzfeld `value`, Zahlen als Gleitkommazahl sowie boolesche und Zeichenkettenwerte. Dieses Wertschema ist mit der direkten Anbindung kompatibel. Zusätzliche alte Metadatenfelder/-Tags werden durch die reine Wertabfrage ausgeblendet; EOS schreibt sie nicht neu. Benutzerdefinierte andere Messreihennamen, kopierte Buckets oder beliebige fremde `common.custom`-Aufzeichnungen werden nicht automatisch migriert.

Die direkte Runtime bleibt vom ioBroker-InfluxDB-Adapter als Standardmodus getrennt. Die neue Option muss ausdrücklich gespeichert werden. Der Status warnt bei noch eingerichteter alter Aufzeichnung; `common.custom.enabled` beweist nicht, dass die alte Instanz gerade läuft. EOS stoppt oder verändert dafür keinen fremden Adapter.

Die Warteschlange ist begrenzt und nicht dauerhaft gespeichert. Längere Datenbankausfälle oder ein erzwungener Abbruch können noch nicht geschriebene Messpunkte verlieren. Die Einrichtung stellt gelöschte historische Daten nicht wieder her und setzt keine Aufbewahrungsdauer des vorhandenen Buckets. Die bisherigen fachlichen Regeln zur Integration älterer lückenhafter Berichte werden nicht durch die Transportanbindung insgesamt neu definiert. Native InfluxDB-2.7.5-Abnahme, reale Konten/Buckets, Dauerbetrieb, Browserdarstellung und Kundenhardware wurden in diesem Review nicht ausgeführt.

Primärquelle: [ioBroker.influxdb 5.1.8 – DatabaseInfluxDB2x](https://github.com/ioBroker/ioBroker.influxdb/blob/v5.1.8/src/lib/DatabaseInfluxDB2x.ts), am 24.11.2026 abgerufen. Der Zugriff auf Dominiques Server und seine Token war nicht Bestandteil der Prüfung.
