# NexoWatt EOS

**Version 9.0.30 · ioBroker-Paket `iobroker.eos-admin` · Testkanal `next`**

NexoWatt EOS bündelt lokales Energiemanagement, Dashboard und Systemverwaltung in einem ioBroker-Adapter. Geräteanbindung, EEBUS, OCPP und Sicherung laufen in eigenen Prozessen. Dashboard und EMS teilen sich einen Prozess.

## Installieren oder aktualisieren

1. Bei einer bestehenden Anlage zuerst die Konfiguration sichern.
2. Den Adapter `iobroker.eos-admin` in ioBroker installieren oder die vorhandene Instanz aktualisieren. Der direkte EOS-Zugang ist standardmäßig `https://<Geräte-IP>:8188/`. Bei bestehenden Instanzen gelten die gespeicherten Adresseinstellungen.
3. Nach dem Start prüfen, ob `eos-admin.0`, UI/EMS und die eingerichteten Module betriebsbereit sind.

Voraussetzungen sind ioBroker JS-Controller ab 7.2.5 und Node.js `>=22.23.4 <23` oder `>=24.22.1 <25`. Die vollständigen Schritte für Update, Wiederanlauf und Anlagenprüfung stehen in der [Anleitung zu 9.0.30](docs/start/START_HIER_9.0.30.md).

## Änderungen in 9.0.30

- Das EMS und die lesende Oberfläche haben eigene Prozesse. Die Prozessübersicht verwaltet beide getrennt. Einstellungen, Anlagenbefehle und betriebsnahe APIs verarbeitet die EMS-Laufzeit.
- Die Datenpunktsuche und der Objektbaum teilen einen kurzlebigen Suchindex. Gleichzeitige Abrufe bündeln den Aufbau. Bei Inaktivität gibt die Oberfläche den Index frei.
- Devices lädt die Protokolltreiber für die tatsächlich eingerichteten Geräte.

Der [Prüfbericht](docs/reports/unified-9.0.30/PRUEFBERICHT.md) enthält die Testergebnisse und die auf der Zielanlage noch offenen Prüfungen.

## Git und npm

Der Ordner `iobroker.eos-admin` ist der Inhalt des Git-Repositorys. Die verschobenen Dokumente sind in der [Pfadliste](docs/UMSORTIERTE_DATEIEN.tsv) aufgeführt. Wenn du die ZIP über einen alten Checkout kopierst, übernimm auch die dokumentierten Verschiebungen in Git, damit keine Duplikate zurückbleiben.

Mit `npm pack --dry-run` prüfst du den Paketinhalt lokal. Die [Anleitung](docs/start/START_HIER_9.0.30.md) beschreibt die Übernahme nach Git und den Repository-Eintrag für ioBroker.

[Dokumentation](docs/README.md) · [Architektur](docs/unified/ARCHITECTURE.md) · [Lizenz](LICENSE) · [Drittanbieterhinweise](THIRD-PARTY-NOTICES.md)

**English** · NexoWatt EOS is a local energy management, dashboard and system administration adapter for ioBroker. Install or update `iobroker.eos-admin` from your configured repository. See the [release guide](docs/start/START_HIER_9.0.30.md) for requirements and post-update checks.
