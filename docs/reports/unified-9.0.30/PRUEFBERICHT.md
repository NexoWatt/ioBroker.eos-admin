# EOS 9.0.30 – Prozessgrenze des EMS und RAM-Verhalten

## Bezug und Umfang

Ausgangspunkt ist das ausgelieferte EOS 9.0.29. Die Bedienoberfläche für die Startseite, ausgewählte statische Ressourcen und die lesende Datenpunktauswahl erhält einen eigenen Prozess. Der bestehende operative Zustand, alle Stellbefehle, der EMS-Scheduler und betriebsnahe HTTP-APIs verbleiben in einem alleinigen EMS-Prozess. Der Hauptadapter hält die ioBroker-Verbindung und prüft Eigentümer, Prozessgeneration, Lizenz, Sitzungen und bestätigte Zugriffe. Das EMS verwendet eine eigene Betriebsfreigabe. Die bisherigen Fristen, eingestellten Anlagenlimits und Schutzfunktionen sind Bestandteil der Abnahme.

Das gemeinsame Register für Prozessfreigaben liest bisherige Nutzdaten der Version 1 mit fünf Einträgen. Die ehemalige kombinierte UI-Freigabe gilt dabei für Oberfläche und EMS. Nach einer ausdrücklich gespeicherten Prozessaktion enthält Version 2 beide Werte getrennt. Eine alte, bewusst deaktivierte Regelung wird dadurch nicht automatisch freigegeben. Der Rückfall auf Version 1 benötigt nach der ersten neuen Änderung die gesicherte alte Konfiguration.

## Funktions- und Ausfalltests

| Prüfbereich | Soll und Status |
| --- | --- |
| Oberfläche und EMS | Echte getrennte Prozesse, unabhängig startbar. Blockieren oder Neustarten der Oberfläche lässt EMS-Prozessnummer, EMS-Schreibgeneration, Messwertabonnement und Regelreaktion intakt. Software-Nachweis unten. |
| EMS-Stopp und Wiederanlauf | Eine widerrufene Generation darf keine neuen Stellbefehle senden. Bereits angenommene Mutationen müssen abgeschlossen sein, bevor die nächste Generation regelt. Software-Nachweis unten. |
| Oberfläche | Zugriffsschutz und Sitzung bleiben zentral. Datenpunktsuche und Baumansicht erhalten die bisherigen Antworten und Berechtigungen. Ein gemeinsam genutzter Cache lädt nach Ablauf einmal und gibt den Index bei Inaktivität frei. |
| Devices | Erst bei der Treiberauswahl werden benötigte Protokollmodule geladen. Auswahl, Priorität, Gerätetreiber-Instanzen und Wiederanlauf werden separat geprüft. |
| Zielanlage | Offen. Physische Reaktion, Prozessfehler, Kalstart, Dauerlast und beobachtete Regelzeiten auf Raspberry Pi 5 mit tatsächlichen Geräten, InfluxDB und ioBroker. |

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges `npm test` unter Node.js 22 | v22.23.4, 2740 erfasst, 2738 bestanden, 2 ausgelassen |
| Vollständiges `npm test` unter Node.js 24 | v24.22.3, 2740 erfasst, 2738 bestanden, 2 ausgelassen |
| Typprüfung, Lint und Builds | Bestanden |
| Ausfall der Oberfläche und EMS-Wiederanlauf | Je drei Integrationstests unter Node.js 22.23.4 und 24.22.3 bestanden. Die ausgelieferten Laufzeitmodule liefen in echten Kindprozessen mit simuliertem ioBroker und Stellziel. |
| Laufzeitabhängigkeiten | Zwei bereits bekannte moderate Auditmeldungen im OCPP-Abhängigkeitsbaum. Keine Meldungen der Stufen hoch oder kritisch. |

## Ressourcenmessungen und Grenzen

Die Datenpunktsuche und der Objektbaum beziehen nur Suchmetadaten. Gleichzeitige Anfragen teilen dieselbe laufende Objektabfrage. Der Suchpfad hält die bisherige 15-Sekunden-Frischegrenze, die Baumansicht 30 Sekunden. Nach spätestens 30 Sekunden ohne erneuten Aufbau gibt der Cache seine Indexreferenz automatisch frei. Das ist freiwerdender JavaScript-Heap. Die Rückgabe belegter Speicherseiten an Linux hängt von der Laufzeit und dem jeweiligen Speicherverlauf ab.

Im synthetischen Vergleich unter Node.js 24.22.3 sank der zusätzliche Heap des aufgebauten Index von 6,545 auf 5,991 MiB bei 10.000 Objekten und von 34,094 auf 30,912 MiB bei 50.000 Objekten. Nach 31 Sekunden hielt 9.0.29 die bisherigen rund 6,5 beziehungsweise 34,1 MiB weiterhin. Der neue Cache lag dann bis auf 0,1 MiB beim Ausgangswert. Zwei gleichzeitige kalte Leseanfragen benötigten statt zweier ioBroker-Objektabfragen eine gemeinsame Abfrage. Die Hashes der vollständigen Testantworten stimmten überein. Die Messung betrachtet die isolierte Datenpunktauswahl mit synthetischen Objekten und kontrollierter Garbage Collection.

Beim isolierten Start- und Konstruktionsvergleich auf Linux/x64 mit Node.js 24.22.3 und je sieben frischen Prozessen betrug die Veränderung des zusätzlichen RSS −9,37 MiB für Modbus TCP, −5,45 MiB für Modbus plus MQTT und −10,39 MiB für MQTT. Die Tests richteten die Treiber ein und öffneten keine physischen Verbindungen. Die Werte sind keine Schätzung des EOS-Gesamtverbrauchs mit dem zusätzlichen Prozess. Die Anlagenmessung muss beide Prozesse und die anderen Module erfassen.

Der gemeinsame Hauptadapter, die ioBroker-Datenbank und der Raspberry Pi bleiben für alle Module gemeinsame Abhängigkeiten. Betriebsnahe HTTP-Funktionen und Historienabfragen nutzen weiterhin den Eventloop des EMS-Prozesses. Physische Anlagen- und Geräteschutzfunktionen sind separat zu prüfen. Dieser Prüfstand umfasst keine Produktivfreigabe oder Änderung einer realen Anlage.

Im PSS-Vergleich mit dem gleichen simulierten Controller auf Linux/x64 lagen die zwei Prozesse nach zehn Sekunden zusammen bei 116,8 MiB gegenüber 95,1 MiB für den bisherigen kombinierten Prozess. Browser, Historienlast und reale Geräte waren in dieser Messung nicht aktiv. Die Prozessgrenze verursacht in dem Versuch rund 22 MiB zusätzlichen Speicherbedarf. Ihre Nettoauswirkung zusammen mit beiden Optimierungen auf dem Raspberry Pi bleibt offen.
