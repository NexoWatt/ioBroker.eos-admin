# NexoWatt EOS 9.0.34 · OVUM MIRA

Ausgangsstand ist das vollständige Repository 9.0.33. Für die neue Geräteanbindung wurden die deutsche OVUM-MIRA-Modbus-Anleitung V260630 und die Registerliste Release V1.1.3 abgeglichen. Die Tabelle nennt die Ergebnisse der Softwareprüfung unter Linux/x64.

| Prüfung | Ergebnis |
|---|---|
| Vollständiges `npm test` unter Node.js 22 | v22.23.4, 2.850 erfasst, 2.848 bestanden, 2 ausgelassen |
| Vollständiges `npm test` unter Node.js 24 | v24.22.3, 2.850 erfasst, 2.848 bestanden, 2 ausgelassen |
| Typprüfung, Lint und Builds | Bestanden |
| Gezielte MIRA-Prüfungen | 32 von 32 bestanden, jeweils unter Node.js 22 und 24 |

## Messung und Ansteuerung

Das gestartete WPM liest die elektrische Aufnahmeleistung als IEEE-754-Wert in kW an Adresse 56021 und skaliert sie für EOS auf Watt. Die thermische Leistung an 56023 bleibt ein eigener Messwert. Ein fehlender Messwert ist von bestätigten 0 W zu unterscheiden. Ein Messwert erhält durch erneutes Darstellen keinen neuen Gerätezeitstempel.

Das HSM empfängt den flüchtigen Leistungswunsch über FC16 an Adresse 55076 und die PV-Anforderung über FC06 an Adresse 55070. Separate Rücklesewerte an der Geräteverbindung bestätigen den Inhalt der Register. Das tatsächliche Verhalten des Verdichters ergibt sich aus der lokalen Regelung und wird über die WPM-Leistungsmessung beobachtet. EOS schreibt für diesen Regelvorgang keine persistenten Flash-Parameter.

EOS verwendet die vorhandenen Geräte-, EMS- und GUI-Prozesse. Die Vorlagen erzeugen keinen zusätzlichen Prozess je Pumpe. Ein HSM darf eine eindeutig zugeordnete Einzelpumpe nach Bestätigung der Quellenwahl und Begrenzung der elektrischen Leistungsanforderung anfordern. Mehrere WPM einer Kaskade können einzeln im Energiefluss erscheinen. Eine gemeinsam wirkende HSM-Anforderung wird bei mehrdeutiger Kaskadenzuordnung nicht mehrfach ausgegeben.

## Prüfnachweise

Die gerätespezifischen Prüfungen umfassen Registeradressen und Einheiten, Anmeldung je Unit, Transport und Rücklesen, automatische Zuordnung, gespeicherte Bedienfreigabe sowie EMS-Befehle und Rücknahme. Im Chromium-Test des Gerätedialogs wurde das Paar über die ausgelieferte Oberfläche angelegt, erneut geladen und für den Regelbetrieb freigegeben. Eine Wiederholung erhielt dieselbe WPM-Identität. [Einzelergebnisse](raw/INDEX.json) · [Gesamtergebnisse](PRUEFERGEBNISSE.json)

Im Verbundlauf durchliefen 1,73 kW elektrische und 5,90 kW thermische Leistung getrennt den produktiven Gerätetreiber. Im automatisch belegten Verbraucher-Slot erschienen 1.730 W. Bei angeforderten 2.300 W schrieb EOS zuerst den Sollwert und erst nach Rücklesen den PV-Modus. Drei nachfolgende Takte mit identischen Werten erzeugten keine weiteren Stellbefehle. Bei Netzeingriff setzte EOS die PV-Anforderung zurück. Ein simulierter Datenverlust verhinderte eine erneute Anhebung aus dem alten Wert. Nach Wiederanmeldung standen 860 W auf demselben Slot. Der Modbus-Server lief lokal über TCP. Die Protokolle zeigen den tatsächlich ausgetauschten Verkehr. [Node 22](raw/node22-protocol-to-ems.log) · [Node 24](raw/node24-protocol-to-ems.log)

Im zweiten Chromium-Test belegte die Wärmepumpe den zehnten Verbraucherslot. Die Oberfläche zeigte bei 2,63 kW Gesamtverbrauch die gerundeten Werte 1,7 kW für die Wärmepumpe und 0,9 kW für das übrige Gebäude. Der Bedienbefehl „PV-Anforderung aus“ erreichte beim Klick den richtigen Slot. Der Test verwendete das ausgelieferte Dashboard und einen simulierten EOS-HTTP-Endpunkt. [Dashboard-Prüfung](raw/mira-dashboard-browser.json) · [Einrichtungsdialog](raw/mira-devices-browser.log)

Die Anzeige lief bei 805 simulierten Aktualisierungen in zwei gemessenen Abständen von 10,004 und 10,000 Sekunden. Nach unterbrochener Verbindung erschien der neue Messwert im Dashboard. [Zeitmessung im Browser](raw/dashboard-interval.json)

## Speicherbedarf des Geräteprozesses

Unter Node.js 24.22.3 auf Linux/x64 lag der zusätzliche belegte JavaScript-Heap nach dem Start des Geräteadapters ohne eingerichtete Geräte im Median bei 4,05 MiB in 9.0.33 und 4,08 MiB in 9.0.34. Mit HSM und WPM als ersten beiden Geräten waren es in 9.0.34 nach beiden Erstabfragen 7,72 MiB. Die Differenz von 3,64 MiB umfasst das erstmalige Laden des gemeinsamen Modbustreibers. Gemessen wurden je fünf frische Prozesse nach einem Warmlauf mit simuliertem ioBroker und separatem Modbus-Server. Das ist eine Messung des JavaScript-Heaps dieser Komponente. Gesamt-RAM mit allen Modulen und der Langzeitverbrauch auf dem Pi sind separat zu messen. [Messdaten](raw/mira-memory-process.json)

## Ausstehende Abnahme an der Anlage

Die lokalen Tests verwenden simulierte Geräte beziehungsweise Protokollgegenstellen. Vor dem Kundeneinsatz sind Login, Quellenwahl, Wirkrichtung, Messwertalter, tatsächlich erreichte Aufnahmeleistung und Rücknahme nach Kommunikationsausfall an der verbauten MIRA zu prüfen. Bei vollständigem Busausfall kann der letzte bestätigte Befehl im Gerät verbleiben. Die lokale Wärmeführung benötigt auch bei zurückgenommener PV-Anforderung unter Umständen weiterhin Strom.

Die Gesamtsuite lässt auf diesem Standard-Testhost zwei umgebungsabhängige Fälle aus. Die nginx-TLS-Konfiguration und die Vererbung der ioBroker-Gruppenrechte über POSIX-ACLs sind an einer passend eingerichteten Installation zu prüfen. Der Lintlauf endete mit sieben vorhandenen Warnungen und ohne Fehler.

Die Messung von RAM und Zykluszeiten mit allen Kundengeräten auf einem Raspberry Pi 5 sowie der Dauerlauf an einer realen Wärmepumpe stehen aus. Die Prüfung des iPhone-Home-Bildschirm-Symbols am echten Endgerät und die Rückmeldung der realen Wallbox erfordern ebenfalls die Pilotanlage. [Einrichtung und Pilotabnahme](../../start/START_HIER_9.0.34.md)
