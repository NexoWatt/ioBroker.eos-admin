# NexoWatt EOS 9.0.32 – Einstieg

## Aktualisieren und den Energiefluss prüfen

1. Die vorhandene EOS-Konfiguration sichern und `iobroker.eos-admin` in derselben Instanz aktualisieren.
2. Prüfen, ob `eos-admin.0`, Oberfläche, EMS und die eingerichteten Module wieder betriebsbereit sind.
3. Im LIVE-Dashboard PV, Netzrichtung, Lade- oder Entladeleistung und Gebäudeverbrauch mit den zugeordneten Leistungsdatenpunkten vergleichen. Wenn ein eigener Gebäudeverbrauchszähler zugeordnet und aktuell ist, hat sein Messwert Vorrang. Ohne diesen Messwert gilt die Bilanz aus Erzeugung plus Netzbezug plus Speicherentladung abzüglich Netzeinspeisung und Speicherladung. Je nach Anzeigeeinstellung werden Ladeleistung und separat dargestellte Verbraucher im Gebäude-Knoten herausgerechnet.
4. Falls die Anzeige weiter `--` zeigt, den Hinweis im Energiefluss sowie die betroffenen Messwerte mit ihren Zeitstempeln und Einheiten erfassen. In der Admin-Diagnose stehen zusätzlich `derived.core.building.quality` und `derived.core.building.inputsJson` zur Verfügung.

Bei den gemeldeten Werten von 1,5 kW PV, 1,8 kW Einspeisung und 2,8 kW Speicherladung ergibt sich ohne weitere Erzeugung ein rechnerischer Gesamtverbrauch von −3,1 kW. Der Wert lässt sich erst mit einer schlüssigen Bilanz oder einem verfügbaren direkten Gebäudemesswert anzeigen. Die Abnahme an der betroffenen Anlage steht aus.

## Git und npm

Den vollständigen Adapterordner aus der ZIP in das vorhandene Git-Repository übernehmen. `npm pack --dry-run` prüft den Paketinhalt lokal. Der [ioBroker-Repository-Eintrag](../../nexowatt-eos-admin-repository-entry-v9-0-32.json) verweist auf die Version 9.0.32 und funktioniert nach deren Veröffentlichung auf npm. Die Bereitstellung dieser ZIP veröffentlicht das Paket nicht auf npm.

[Prüfbericht](../reports/unified-9.0.32/PRUEFBERICHT.md) · [Inbetriebnahme](../unified/COMMISSIONING.md)
