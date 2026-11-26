# NexoWatt EOS 9.0.33 · Softwareprüfung und Pilotabnahme

Ausgangsstand ist die am 26. November 2026 geprüfte 9.0.32. Prüfumgebung für 9.0.33 ist Linux/x64 mit Node.js 22 und 24. Die Tests verwenden ausgelieferte Prozessmodule, lokale Dienste und simulierte Geräteausgänge. Physische Gerätequittung, Leistungsreaktion, Gesamt-RAM und Regeltakt unter Dauerlast auf dem Raspberry Pi 5 sind Bestandteil der Pilotabnahme.

| Prüfung | Ergebnis |
|---|---|
| Vollständiges `npm test` unter Node.js 22 | v22.23.4, 2818 erfasst, 2816 bestanden, 2 ausgelassen |
| Vollständiges `npm test` unter Node.js 24 | v24.22.3, 2818 erfasst, 2816 bestanden, 2 ausgelassen |
| Typprüfung, Lint und Builds | Bestanden |

## Schnittstellen und Wiederanlauf

Die GUI und das EMS bleiben getrennte Prozesse. Stirbt das EMS während eines angenommenen Stellauftrags, wartet der Supervisor auf dessen Abschluss. Nach bestätigtem Erfolg darf eine neue Generation selbstständig anlaufen, aktuelle Messwerte einlesen und den passenden Befehl senden. Bei bewusst pausiertem EMS oder ungeklärtem Ausgang bleibt der automatische Schreibzugriff gesperrt. Der Wiederanlauf verwendet das Abschlussereignis des ausstehenden Auftrags.

14 Prüfläufe mit Chromium umfassten 111 benannte Bedien- und Anzeigefälle sowie die Prüfung der geladenen Admin-Ressourcen. Geprüft wurden unter anderem Kiosk, Anmeldung, Historie, Sicherungsdialoge, Tarifformular, Smart-Home-Bedienung, Prozessschalter und OCPP-Neuerkennung. Eine asynchron aktualisierte Landes-/Sprachanzeige hatte im Konfigurationsdialog fälschlich eine Benutzereingabe signalisiert und konnte den automatischen OCPP-Import verhindern. Neuerkennung, Erhalt manueller Zuordnungen sowie Konfliktbehandlung beim Speichern wurden über die Browseroberfläche nachgetestet. [Browserabnahme](raw/browser/UI_REVIEW.json)

## Messungen und Regler

Die Regelung prüft am Netzanschluss bestätigte Eingangsdaten und das ursprüngliche Alter der verwendeten Messung. Ein neuer Rechenlauf verlängert deren Gültigkeit nicht. Die Prüfungen umfassen Fehlerqualität, zukünftige Zeitstempel, ein fehlendes Teilmesssignal, eine ungültige Batteriequelle, die Rückkehr bestätigter Messungen, phasenbezogene Limits und den Übergang von Überschussladung zu Netzbezug. Ein gebrauchsfähiger direkter Gebäudemesswert bleibt weiterhin vom Energiefluss anderer Geräte unabhängig.

Tibber-Zugangsdaten verbleiben im vorgesehenen Konfigurationsspeicher. Bei der Tarifentscheidung gelten die Quelle und der Preis des laufenden Zeitfensters. Zukunftsplanung kann spätere Slots derselben Kurve verwenden. Das Alter eines gespeicherten Schalters allein deaktiviert keine Einstellung. Die SG-Ready-Steuerung behandelt fehlgeschlagene Kontaktschreibvorgänge. BHKW und Generator sichern die Rücknahme eigener Impulse über einen Prozesswechsel. Die Zuordnung eines bereits in einer Altversion hängen gebliebenen fremden Kontakts lässt sich im Nachhinein nicht verlässlich rekonstruieren.

## Gebäudeverbrauch und Anzeige

Ein neuer, gültiger Messwert des zugeordneten Gebäudezählers darf eine ältere, leere Bilanz ablösen. Eine konstante Leistung einschließlich 0 W bleibt innerhalb ihrer konfigurierten Gültigkeit sichtbar. Auch die Bilanz benutzt die ursprünglichen Zeitstempel der beteiligten Messungen. Im Test mit 300 Sekunden Gültigkeit blieb ein konstanter Wert bis einschließlich Sekunde 300 gültig. Nach Ablauf funktionierte der Wechsel auf eine vollständige aktuelle Bilanz und später zurück auf den wieder meldenden Zähler. Für den Gebäudeknoten zieht EOS separat ausgewiesene Ladeleistung einmal vom Gesamtverbrauch ab.

Den gemeldeten Feldfall haben wir in beiden möglichen Batterierichtungen geprüft. Bei 1,2 kW PV, 0,5 kW Einspeisung, 1,8 kW **Entladung** und 0 kW Wallbox ergeben sich 2,5 kW Gebäudeverbrauch. Meldet die Batterie bei denselben übrigen Leistungen tatsächlich 1,8 kW **Ladung**, ist die Bilanz um 1,1 kW unterdeckt. Eine physisch bestätigte Messung des Gebäudezählers bleibt auch dann verwendbar. Im Anlagenbild bezeichnet das normalisierte Batterievorzeichen die Entladeleistung minus Ladeleistung. Welches Vorzeichen der jeweilige Rohdatenpunkt liefert, hängt vom Gerät und dessen Zuordnung ab.

Die sichtbare Live-Seite übernimmt Diagramm und Leistungswerte im Zehnsekundentakt. Beim Öffnen beziehungsweise nach der Rückkehr auf die Seite wird der aktuelle Stand einmal sofort angezeigt. Messungen und Regler arbeiten weiter in ihren eigenen Takten. Ein fehlgeschlagener Schreibvorgang für eine abgeleitete Messung wird wiederholt. Auch ein unveränderter Zahlenwert kann somit wieder zuverlässig veröffentlicht werden.

Der Browsertest prüfte außerdem einen HTTP-Erstabruf mit Status 503 und die anschließende Versorgung über den Live-Datenstrom. Diagramm, Gebäudewert, Gesamtverbrauch und Zeitstempel wechselten gemeinsam von 1,0 auf 3,3 kW. Ein zwischenzeitlich empfangener Wert von 2,2 kW erzeugte keinen zusätzlichen Anzeigesprung. Nach Verbindungsverlust und erneutem Empfang zeigte die Seite 4,4 kW. Zwei gemessene reguläre Anzeigeabstände mit 820 eingespielten Aktualisierungen lagen jeweils rund zehn Sekunden auseinander. [Browsermessung](raw/browser-ten-seconds.json)

## Gemeinsamer Lauf von Tarif, Wallbox und Speicher

Unter beiden Node-Versionen durchlief dasselbe EMS je 42 Regeltakte in neun Betriebsphasen. Der integrierte OCPP-2.1-Server kommunizierte über eine lokale WebSocket-Verbindung mit einer simulierten Ladestation. Je Lauf bestätigte die Station 20 Ladeprofile und der Speicher erhielt 36 Befehle. Bei 12 kW PV und 1 kW Grundlast stabilisierte sich die Aufteilung bei 6,3 kW EV-Ladung, 4,2 kW Speicherladung und 0,5 kW Einspeisung. Zuvor konnte die EV-Leistung bei gleichbleibender PV zwischen Freigabe und Stopp pendeln.

Im geprüften PV-Betrieb mit Speicherschutz gingen bei abgelaufener Batteriemessung beide Anforderungen auf null. Nach Rückkehr gültiger Daten konnte die Regelung die Leistung wieder freigeben. Die berechnete Anschlussleistung nach dem jeweiligen Stellbefehl blieb im Test innerhalb der eingestellten 11 kW. Ein simulierter Lastsprung erreichte **vor** dem Eingriff 15,5 kW. Die reale Reaktionszeit von Wallbox, Speicher und Messgerät ist an der Pilotanlage zu messen. [Verbundlauf Node 22](raw/connected-control-summary-node22.json) · [Verbundlauf Node 24](raw/connected-control-summary.json)

## RAM und Datenverkehr

Der Index für die Suche nach ioBroker-Datenpunkten wird weiterhin zwischen Such- und Baumansicht geteilt. Erst die erste tatsächliche Baumabfrage erzeugt die Unterordner. Blattknoten belegen keine eigene Tabelle für leere Unterordner. Der Vergleich mit 9.0.32 verwendet die ausgelieferten Module und denselben künstlichen Katalog. Die Such- und Baumantworten waren byteinhaltlich identisch. Angegeben ist jeweils der Median aus drei frischen Node-24-Prozessen nach expliziter Speicherbereinigung, als zusätzlicher JavaScript-Heap gegenüber dem Zustand vor der Anfrage.

| Umfang und Bedienung | 9.0.32 | 9.0.33 |
|---|---:|---:|
| 10.000 Datenpunkte, Suche | 6,13 MiB | 3,17 MiB |
| 10.000 Datenpunkte, Suche und Baum | 6,13 MiB | 4,38 MiB |
| 50.000 Datenpunkte, Suche | 31,04 MiB | 16,30 MiB |
| 50.000 Datenpunkte, Suche und Baum | 31,05 MiB | 22,28 MiB |

Bei verbundener Oberfläche sammelt der EMS-Prozess Zustandsänderungen direkt in einem einzigen Paket je SSE-Sendeintervall. Ohne verbundene Oberfläche entsteht hier kein Paket für jeden Messwert. Der periodische Diagnosetext wird erst beim tatsächlichen Versand serialisiert. Messwerterfassung, Anlagengrenzen und Stellgrößenregler behalten ihre eigenen Takte.

Zusätzlich liefen GUI, EMS, Geräte, EEBUS, Sicherung und OCPP gemeinsam in einem Linux/x64-Prozesstest. Die Summe ihres anteiligen physischen Speichers (PSS) lag an den drei Messpunkten bei Start sowie nach fünf und zehn Sekunden bei 229–240 MiB für 9.0.32 und 229–233 MiB für 9.0.33. Der ioBroker-Controller, die Datenbanken und die physische Anlage waren in dieser Messung nicht enthalten. Für den Dauerverbrauch auf dem Raspberry Pi ist ein längerer Lauf mit denselben aktivierten Modulen und Datenpunkten nötig.

## Betriebsgrenzen

Ein Verbindungsabbruch kann verhindern, dass ein Aktor einen neuen Befehl empfängt oder bestätigt. Die Rückmeldung eines Software-Schreibers belegt nicht die tatsächliche Leistung am Gerät. Bei einem npm-Ausfall nach bereits erfolgtem Instanzstopp kann js-controller 7.2.5 einen manuellen Start benötigen. Das mitgelieferte Repository-Werkzeug prüft das öffentliche Archiv vor dem Kontrollwechsel auf die neue Version. Eine Installation auf der Kundenhardware und eine Veröffentlichung auf npm wurden nicht vorgenommen.

Zwei umgebungsabhängige Tests benötigen die Programme `nginx` und `setfacl`. Die Prüfung der nginx-Konfigurationssyntax und der Vererbung von Datei-ACLs sind in dieser Umgebung offen. Der Lintlauf meldete sieben vorhandene Stil- und Dokumentationswarnungen und keine Fehler. Die PWA-Oberfläche und ihre Symbole wurden in Chromium geprüft. Die Installation auf dem Home-Bildschirm eines echten iPhones gehört zum Pilottest.

[Installation, Rückfall und Abnahme an der Anlage](../../start/START_HIER_9.0.33.md)
