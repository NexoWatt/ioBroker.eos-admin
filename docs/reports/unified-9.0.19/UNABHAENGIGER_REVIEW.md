# Unabhängige Laufzeitprüfung 9.0.19

Stand: 24. November 2026. Schwerpunkt ist der tatsächlich verdrahtete Ablauf vom Speichern auf der Geräteseite bis zur persistenten EMS-Konfiguration und zur laufenden Auswertung von Messwerten. Der konkrete Zustand der Kundenanlage lag nicht als Datenbank-/Protokollabbild vor. Die folgenden Fehler wurden in lokalen, ausführbaren Integrationsabläufen nachgewiesen; daraus wird keine vollständige Diagnose der Kundenanlage abgeleitet.

## Warum die vorherige Prüfung nicht genügte

Die Geräteintegrationstests aus 9.0.18 banden den Planer und Modulhost selbst zusammen, setzten den Bereitschaftsstatus und ersetzten die Hintergrund-EMS-Ausführung. Sie prüften Zuordnung, Persistenz und Aliasidentität, aber nicht die vollständige produktive Verdrahtung oder die normalen App-Center-Nachbearbeitungen der Konfiguration. Ein Bestehen dieser Tests war deshalb kein Nachweis für den tatsächlichen Geräte-Speichern-Ablauf im Browser.

Der neue Test `test/eos-device-ems-web-pipeline.test.cjs` ruft die ausgelieferte `Web.mountUnifiedRuntime`-Methode auf. Diese erzeugt den echten Modulhost, bindet die echte Planer-Brücke und registriert die echten Geräte-HTTP-Routen. Anschließend laufen `startOperational`, die echte `onReady`-Initialisierung, die EMS-Engine, Aliasereignisse, Persistenz und die App-Center-API. Kein Test installiert den Planer von Hand, setzt den Laufzeitstatus auf bereit oder ruft zum Abschluss manuell `reconcileDeviceEms` beziehungsweise `flushDeviceEms` auf.

## Reproduzierte Befunde

| Befund | Nachweis und Behandlung |
| --- | --- |
| Fehler nach normaler App-Center-Änderung | Nach erfolgreicher Geräteübernahme und anschließendem Deaktivieren der Farm über die echte App-Center-API schlug erneutes Gerätespeichern mit `EOS_EMS_PLAN_CONFIG_INVALID` fehl. Die Lizenz-Normalisierung hatte sieben optionale `storage`-Leistungsfelder mit dem Wert `undefined` angelegt. Der Produzent entfernt nun ausschließlich diese fehlenden optionalen Felder; vorhandene Zahlen, `0` und `null` bleiben erhalten. Keine breite Fehlerbereinigung im strikten Planer. |
| SolaX-Lesezyklen durch Schreibaufträge verdrängt | Mit dem echten SolaX-Taktplaner und der echten Farmregelung blieb der SolaX-Istwert nach einem Wechsel von −500 W auf +500 W über fünf Sekunden auf −500 W stehen. Wiederholte Null-Sollwerte belegten jeden Schreibzyklus; eine fällige Messabfrage kam nicht mehr zum Zug. Der unveränderte Integrationstest besteht nach Ergänzung der begrenzten Lesefairness. Herstellertakt, serielle Verarbeitung und prioritärer neuer Stoppauftrag bleiben erhalten. |
| Bekannter NVP-Verbindungsabbruch | Die ursprüngliche Zuordnung bevorzugte `r.online`, das noch bis zum Heartbeat-Ablauf wahr sein kann. Neue beziehungsweise ausdrücklich bestätigte eigene NVP-Zuordnungen verwenden die direkte Kommunikation `comm.connected`; der Heartbeat bleibt ein getrennter Watchdog. Ein tatsächlicher Treiberfehler `ECONNRESET` macht den NVP in der echten EMS-Auswertung unbrauchbar. |
| Energiefluss-Vergleich ausgefallen | Die laufende Energiefluss-Diagnose protokollierte `userMode is not defined`. Zwei nicht zum Energiefluss-Vertrag gehörende freie Variablen wurden aus dem Vergleichsergebnis entfernt. Das ist keine Änderung des physischen Messwerts. |
| Lange Initialisierung anderer Module | Ein tatsächlicher Modulhost startet Geräte und danach zwei weitere Module mit jeweils 7,5 Sekunden Initialisierung. Die Geräte-Steuerhoheit bleibt nach 12,5 Sekunden gültig. Die Eigentumsprüfung läuft nun unabhängig von einem noch laufenden Modulstart. |

Die zuvor vermutete fehlende statische Planer-Bindung wurde im ausgelieferten Web-Code nicht bestätigt. Neu ergänzte Statusmeldungen unterscheiden fehlende Bereitschaft, fehlerhafte Konfiguration, ausstehende Aliasdaten und einen Zuordnungskonflikt. `RUNNING` des Gerätemoduls beweist weiterhin keine aktuelle Kommunikation mit jedem Gerät.

## Geprüfte Abläufe

- Ein einzelner Geräte-HTTP-Speichervorgang übernimmt eine vorhandene manuelle FENECON-Zeile, ergänzt SolaX und ordnet den SMA-Messpunkt M0 zu. Kundennamen, gültige Leistungsgrenzen und zusätzliche vorhandene Einstellungen bleiben erhalten. Zwei Speicherzeilen und die kanonische Farm-App werden gemeinsam in genau einem EMS-Konfigurationsstand gespeichert.
- Ein ausdrücklich übermittelter, validierter Aktivierungsauftrag aktiviert die passende App und Zeile. Dieselbe bereits verbrauchte Auftragskennung darf eine anschließend im App-Center deaktivierte App nicht erneut einschalten.
- Eine neu erzeugte gehostete Instanz lädt die gespeicherten Modul- und EMS-Konfigurationen ohne zweiten Einrichtungsaufruf. Die bestehende Farm bleibt deaktiviert; Zeilen, Zuordnungen und Kundenfelder bleiben erhalten.
- Ein neuer Geräte-Speichervorgang während noch unbekannter EMS-Altzuordnungen wird vor der Persistierung vorübergehend abgelehnt. Nach bestätigter Bereitschaft übernimmt ein erneuter Save die Geräte. Vorhandene unverändert identifizierte Geräte behalten den bisherigen Hintergrundabgleich. Ein später erscheinendes echtes Aliasmanifest löst die ausstehende Zuordnung aus. 250 gewöhnliche Messwert-Ereignisse lösen keine neue Alias-Inventarsuche aus.
- Der echte SMA-Gerätezyklus liefert treiberseitig bereits dekodierte 1,23 kW Netzbezug und anschließend 1,5 kW Einspeisung. Die echte EMS-Engine und die UI-Auswertung erhalten 1230 W Bezug beziehungsweise 1500 W Einspeisung, jeweils ohne gleichzeitige Gegenrichtung.
- In der gemischten Farm bleiben FENECON-Konverterleistung aus Register 604, physischer Batteriefluss aus Register 415 und DC-PV aus Register 339 getrennt. Bei 5 kW Konverter-/PV-Leistung und 0 W Batteriefluss zeigt die Batterie keine Entladung; die PV-Leistung wird einmal mit 5000 W gezählt. Anschließend ergeben FENECON und SolaX zusammen −1500 W Laden und +1500 W Entladen. Die getrennten Konvertersummen bleiben dabei 3500 W beziehungsweise 6500 W.
- Ein über den echten Geräte-Schreibhandler bestätigter Sollwert verändert weder Batterie-Istleistung noch Konverter-Rückmeldung. Der Testtreiber verändert Messwerte ausdrücklich nicht aufgrund einer Schreibbestätigung.
- Nach einem tatsächlichen simulierten SMA-Transportfehler fällt die NVP-Freigabe auch bei aktiver Farm weg. Im anschließenden Beobachtungsfenster werden keine neuen von null verschiedenen Leistungsaufträge ausgegeben; ein sicherer Null-Sollwert bleibt zulässig.

## Testgrenzen

Der Test ersetzt die Controller-Objekt-/State-Datenbank, die Sitzungsquelle und externe Transporte. Er startet keinen produktiven ioBroker-Admin-Prozess und führt nicht den vollständigen Web-Konstruktor mit TLS-/Zertifikatseinrichtung aus. Die eigentlichen Web-Mount-, Start-, API-, Planer-, Alias-, Persistenz- und EMS-Methoden bleiben unverändert. Die simulierten Messwerte sind bereits dekodierte Treiberwerte, keine realen Modbus-Telegramme und kein physikalisches Anlagenmodell. In den beiden Messwertfällen laufen echte Geräte-Pollschleifen und Heartbeats; in den reinen Zuordnungsfällen endet der Transportstart an einer ausdrücklich benannten Testgrenze.

Diese Prüfung belegt weder reale Registerkommunikation noch die sichere Auslegung einer konkreten Kundenanlage, beliebige Fremdadapter-Konfigurationen, eine verlustfreie Migration jedes historischen Kundenstands oder einen Langzeit-/Lastbetrieb. Unabhängigkeit vom produktiven ioBroker-Admin und allgemeine CRA-Konformität werden durch diese lokale Prüfung nicht zertifiziert. Die vollständigen Releaseprüfungen und die unterstützten Node-Versionen sind gesondert im Releasebericht dokumentiert.

## Ausführung

Node.js der unabhängigen Prüfung: `v24.22.3`.

```text
node --test test/eos-device-ems-web-pipeline.test.cjs
12 bestanden, 0 fehlgeschlagen, 0 übersprungen; abschließender vollständiger Lauf nach Profil-/Neue-ID-Schutz.
```

Diese gemeinsame Wiederholung erfolgte nach dem Laufzeitbuild mit der Korrektur der optionalen Speicherfelder, der Energiefluss-Trennung und der SolaX-Taktkorrektur. Sie umfasst auch die App-Center-Normalisierung und die Wiederherstellung in einer neuen gehosteten Instanz. Zusätzlich enthalten sind Profilwechsel mit direkten und externen Aliasketten, gemeinsame Mutationssperre, Datenbankfehler und Wiederverwendung einer gelöschten ID. Der Runtime-Review dokumentiert diese Fälle; die vollständige Releasewiederholung folgt im übergeordneten Prüfbericht.
