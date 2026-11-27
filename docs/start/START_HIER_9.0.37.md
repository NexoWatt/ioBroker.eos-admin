# EOS 9.0.37 · Live-Systemstatus und Speicherfarm

## „Betriebsstatus prüfen“ in 9.0.35

In der gemeldeten Ansicht standen „EMS aktiv“ und „Messung aktuell“. Die alte Oberfläche konnte eine aktuelle Netzleistung in der Netzzeile anzeigen, während im Dashboard die gesonderte EMS-Bestätigung für diese Messung fehlte. Das ließ sich mit laufendem EMS, gültiger Messung und gesunden Prozessen nachstellen. In der korrigierten Ansicht erreichen die Statussignale auch den initialen Datenabruf und die Live-Verbindung. Ein gesunder Gesamtzustand setzt weiterhin aktuelle Betriebs-, Netz-, Prozess- und Geräteinformationen voraus.

## Rückmeldung der Speicherfarm lesen

Bei 636 W angeforderter Entladung und 636 W Übergabe hat der Schreibpfad den betreffenden Auftrag entgegengenommen. Die gemessenen 576 W sind die aktuelle unabhängige Leistung der Farm. Die Angabe „Banddifferenz“ in der Begründung beschreibt den Abstand der Netzleistung zum Regelband am Netzanschlusspunkt. Das EMS verwendet diesen Wert für die Sollwertkorrektur. Für die Beurteilung einzelner Speicher die Zeile des jeweiligen Geräts öffnen und dessen Messung und verfügbare Rückmeldungen prüfen.

## Wann die Leistungswarnung erscheint

EOS vergleicht pro geregeltem Speicher die an den Schreibpfad übergebene Leistung mit der aktuellen, zugehörigen Leistungsmessung. Laden und Entladen haben unterschiedliche Vorzeichen. Bis einschließlich 200 W Abweichung liegt der Vergleich innerhalb der Anzeigetoleranz. Bei mehr als 200 W erscheint eine Leistungswarnung mit dem betroffenen Speicher. Bei mehreren Speichern können sich die Abweichungen in der Summe aufheben. Deshalb wertet EOS jeden Speicher einzeln aus.

| Übergeben | Gemessen | Abweichung | Anzeige bei sonst gesundem System |
|---|---|---|---|
| 636 W Entladen | 576 W Entladen | 60 W | Alle Systeme normal |
| 636 W Entladen | 436 W Entladen | 200 W | Alle Systeme normal |
| 636 W Entladen | 435 W Entladen | 201 W | Leistungswarnung |

Die Beispiele gelten für eine einzelne zugeordnete Gerätemessung nach der Übergabe. Beim Start oder beim Wechsel der Vorgabe wartet der Vergleich auf eine passende Messung. Für unterbrochene Verbindungen, Gerätefehler, Schutzabschaltungen und ungültige Netzmessungen gelten die eigenen Statusmeldungen. Die 200 W sind eine Toleranz für die Anzeige und Benachrichtigung. Die eingestellten Regelgrenzen am Netzanschlusspunkt gelten weiterhin.

**FENECON Home** kann an unterschiedlichen Stellen regeln. Bei direkter ESS-Regelung zeigt die Speicherzeile den Vergleich am ESS-Wechselrichter (AC), wenn der Sollwert und seine unabhängige Rückmessung als zusammengehöriges Paar in Watt zugeordnet sind. Bei einer Vorgabe für den Netzanschlusspunkt gelten Hauslast und PV-Erzeugung zusätzlich. Hier lässt sich eine Geräteabweichung allein aus der Batterieleistung nicht bestimmen.

## „closing SSE client … backpressure“ im ioBroker-Protokoll

Mit Server-Sent Events (SSE) versorgt die Oberfläche einen geöffneten Browser mit Live-Daten. Meldet sein Sendepuffer über die eingestellte Frist keinen freien Platz, schließt EOS diesen Anzeigekanal. Die Standardfrist beträgt acht Sekunden. Die Zahl hinter „client“ ist die laufende Nummer der Verbindung. Auch derselbe Browser erhält beim Wiederverbinden eine neue Nummer.

Ein offenes Dashboard versucht nach drei Sekunden erneut, die Verbindung aufzubauen, und übernimmt einen aktuellen Datenstand. Der Protokolleintrag allein belegt keinen Ausfall der Regelung. Erscheint die Warnung bei durchgehend geöffneter Anzeige wiederholt, sind Stillstand der Werte, Uhrzeit, Browser und Zugriffsweg (lokales Netz oder VPN) für die Eingrenzung hilfreich.

## Pilotupdate

1. Eine aktuelle Sicherung der Instanz und ihrer Konfiguration anlegen. Den vorhandenen Adapter auf 9.0.37 aktualisieren. Die bestehenden Zuordnungen und Prozessfreigaben werden weiterverwendet.
2. Die Live-Seite öffnen. Bei aktivem EMS, bestätigter Netzmessung und unauffälligen überwachten Prozessen, Geräten und Ladepunkten **Alle Systeme normal** prüfen. Steht eine Bestätigung aus, nennt die Statuszeile das betroffene Signal.
3. In der Speicherfarm einen aktuellen Auftrag mit seiner Quelle und der aktuellen unabhängigen Batteriemessung vergleichen. Die drei Anzeigen können zu unterschiedlichen Zeitpunkten eintreffen.
4. Für die Veröffentlichung den bestehenden Git-/npm-Ablauf verwenden. Nach dem Upload die veröffentlichte Paketdatei prüfen, dann den ioBroker-Repositoryeintrag umstellen. Für die [Übernahme von Altadaptern](START_HIER_9.0.36.md) und [Prozess- und Gerätealarme](START_HIER_9.0.35.md) gelten die jeweiligen Anleitungen.

[Prüfergebnisse](../reports/unified-9.0.37/PRUEFBERICHT.md)
