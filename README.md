# NexoWatt EOS

**Version 9.0.38 · ioBroker-Paket `iobroker.eos-admin` · Testkanal `next`**

NexoWatt EOS bündelt lokales Energiemanagement, Dashboard und Systemverwaltung in einem ioBroker-Adapter. Oberfläche, EMS, Geräteanbindung, EEBUS, OCPP und Sicherung werden in eigenen Prozessen ausgeführt.

## Installieren oder aktualisieren

1. Bei einer bestehenden Anlage zuerst die Konfiguration sichern.
2. Den Adapter `iobroker.eos-admin` in ioBroker installieren oder die vorhandene Instanz aktualisieren. Der direkte EOS-Zugang ist standardmäßig `https://<Geräte-IP>:8188/`. Bei bestehenden Instanzen gelten die gespeicherten Adresseinstellungen.
3. Nach dem Start prüfen, ob `eos-admin.0`, Oberfläche, EMS und die eingerichteten Module betriebsbereit sind.

Voraussetzungen sind ioBroker JS-Controller ab 7.2.5 und Node.js `>=22.23.4 <23` oder `>=24.22.1 <25`. Die Schritte für das Update von einer Altinstallation stehen in der [Anleitung zu 9.0.38](docs/start/START_HIER_9.0.38.md).

## Änderungen in 9.0.38

Bei der Bestandsübernahme prüft EOS, ob es die vorhandene UI- und Gerätekonfiguration lesen und mit den mitgelieferten Geräteprofilen betreiben kann. Die alte Beschränkung des Geräteadapters auf 0.5.176 entfällt. Auch gestoppte Quellinstanzen können ihre Konfiguration liefern. Die bisherigen Datenpunktnamen und die Zuordnung zur InfluxDB-Instanz werden weiterverwendet. In der EOS-Administration lässt sich eine zurückgestellte Übergabe erneut prüfen und starten.

[Übernahme, Geräteaktivierung und InfluxDB-Historie](docs/start/START_HIER_9.0.38.md) · [Prüfbericht](docs/reports/unified-9.0.38/PRUEFBERICHT.md)

## Änderungen in 9.0.37

Die Live-Ansicht erhält die Bestätigung des EMS für die Messung am Netzverknüpfungspunkt. Sie zeigt „Alle Systeme normal“, wenn auch die übrigen überwachten Bereiche gesund sind. Fehlt die Bestätigung, nennt das Dashboard das betroffene Signal. Für jeden geregelten Speicher vergleicht EOS die übergebene Leistung mit der zugehörigen Gerätemessung. Eine Leistungsabweichung löst erst oberhalb von 200 W eine Warnung aus.

[Statusanzeige, Speicherfarm und Pilotprüfung](docs/start/START_HIER_9.0.37.md) · [Prüfbericht](docs/reports/unified-9.0.37/PRUEFBERICHT.md)

## Änderungen in 9.0.36

Eine bereits abgeschaltete, vom Controller als beendet bestätigte Alt-Oberfläche kann mit ihren Einstellungen in die aktivierte EOS-Instanz übernommen werden. Während der Übergabe zeigt der Prozessmonitor den Zustand jedes Prozesses und seine Freigabe für die Anlage getrennt an. Bestätigte Altadapter können ihre Arbeiten bis zur Übergabe abschließen. Nach vorübergehenden Lesefehlern lädt EOS die betroffene Modulkonfiguration erneut.

[Upgrade von Altadaptern und Pilotabnahme](docs/start/START_HIER_9.0.36.md) · [Prüfbericht](docs/reports/unified-9.0.36/PRUEFBERICHT.md)

## Änderungen in 9.0.35

Das Live-Dashboard zeigt einen gemeinsamen Systemstatus für EMS, Netzpunkt, Ladepunkte, lokale EOS-Prozesse und überwachte Geräte. Eine erneute Synchronisierung derselben Verbindung lässt die bestätigte Meldung stehen. Prozessstörungen und bestätigte Verbindungsverluste werden mit Namen angezeigt. Die Kundeneinstellungen für Benachrichtigungen enthalten die zugehörigen Kategorien und den Empfänger.

[Systemstatus, Benachrichtigungen und Pilotprüfung](docs/start/START_HIER_9.0.35.md) · [Prüfbericht](docs/reports/unified-9.0.35/PRUEFBERICHT.md)

## Änderungen in 9.0.34

Der integrierte Geräteadapter unterstützt die OVUM MIRA über Modbus TCP und RTU. Bei der Einrichtung lassen sich das Hydraulikmodul und das zugehörige Wärmepumpenmodul gemeinsam anlegen. Die elektrische Aufnahmeleistung erscheint als eigener Verbraucher im Energiefluss. Für eine einzelne zugeordnete Pumpe kann der Installateur die PV-Regelung freigeben.

Die [Einrichtungsanleitung](docs/start/START_HIER_9.0.34.md) beschreibt Quellenwahl, elektrische Leistungsgrenze und den Abgleich am Gerät. Der [Prüfbericht](docs/reports/unified-9.0.34/PRUEFBERICHT.md) dokumentiert Softwareprüfung und offene Hardwareabnahme.

## Git und npm

Der Ordner `iobroker.eos-admin` ist der Inhalt des Git-Repositorys. Die verschobenen Dokumente sind in der [Pfadliste](docs/UMSORTIERTE_DATEIEN.tsv) aufgeführt. Wenn du die ZIP über einen alten Checkout kopierst, übernimm auch die dokumentierten Verschiebungen in Git, damit keine Duplikate zurückbleiben.

Mit `npm pack --dry-run` prüfst du den Paketinhalt lokal. Die [Anleitung](docs/start/START_HIER_9.0.35.md) beschreibt die Übernahme nach Git und den Repository-Eintrag für ioBroker.

[Dokumentation](docs/README.md) · [Architektur](docs/unified/ARCHITECTURE.md) · [Lizenz](LICENSE) · [Drittanbieterhinweise](THIRD-PARTY-NOTICES.md)

**English** · NexoWatt EOS is a local energy management, dashboard and system administration adapter for ioBroker. Install or update `iobroker.eos-admin` from your configured repository. See the [release guide](docs/start/START_HIER_9.0.38.md) for requirements and post-update checks.
