# NexoWatt EOS

**Version 9.0.27 · ioBroker-Paket `iobroker.eos-admin` · Testkanal `next`**

NexoWatt EOS bündelt lokales Energiemanagement, Dashboard und Systemverwaltung in einem ioBroker-Adapter. Geräteanbindung, EEBUS, OCPP und Sicherung laufen in eigenen Prozessen. Dashboard und EMS teilen sich einen Prozess.

## Installieren oder aktualisieren

1. Bei einer bestehenden Anlage zuerst die Konfiguration sichern.
2. Den Adapter `iobroker.eos-admin` in ioBroker installieren oder die vorhandene Instanz aktualisieren. Der direkte EOS-Zugang ist standardmäßig `https://<Geräte-IP>:8188/`. Bei bestehenden Instanzen gelten die gespeicherten Adresseinstellungen.
3. Nach dem Start prüfen, ob `eos-admin.0`, UI/EMS und die eingerichteten Module betriebsbereit sind.

Voraussetzungen sind ioBroker JS-Controller ab 7.2.5 und Node.js `>=22.23.4 <23` oder `>=24.22.1 <25`. Die vollständigen Schritte für Update, Wiederanlauf und Anlagenprüfung stehen in der [Anleitung zu 9.0.27](docs/start/START_HIER_9.0.27.md).

## Änderungen in 9.0.27

- **Tarife:** Andere EMS-Einstellungen überschreiben die gespeicherte Tibber-Anbindung nicht mehr. Bereits gelöschte Zugangsdaten einmal neu speichern.
- **Ladepunkte:** Die interne OCPP-Erkennung verwendet vorhandene Zuordnungen wieder und verknüpft neue Ladepunkte automatisch mit den erkannten Datenpunkten. Die Stationszuordnung erfolgt manuell.
- **Devices und Wiederanlauf:** Gelöschte Zuordnungen bleiben entfernt. Der Modulstart wiederholt vorübergehend fehlgeschlagene Anmeldungen an Datenpunkte begrenzt.

Der [Prüfbericht](docs/reports/unified-9.0.27/PRUEFBERICHT.md) enthält die Testergebnisse und die auf der Zielanlage noch offenen Prüfungen.

## Git und npm

Der Ordner `iobroker.eos-admin` ist der Inhalt des Git-Repositorys. Die verschobenen Dokumente sind in der [Pfadliste](docs/UMSORTIERTE_DATEIEN.tsv) aufgeführt. Wenn du die ZIP über einen alten Checkout kopierst, übernimm auch die dokumentierten Verschiebungen in Git, damit keine Duplikate zurückbleiben.

Mit `npm pack --dry-run` prüfst du den Paketinhalt lokal. Version 9.0.27 ist bereits auf npm verfügbar. Die aufgeräumte Dokumentation kannst du unter derselben Version in Git übernehmen. Für eine spätere npm-Veröffentlichung der neuen Struktur ist eine neue Paketversion erforderlich. Die [Anleitung](docs/start/START_HIER_9.0.27.md) beschreibt den Repository-Eintrag für ioBroker.

[Dokumentation](docs/README.md) · [Architektur](docs/unified/ARCHITECTURE.md) · [Lizenz](LICENSE) · [Drittanbieterhinweise](THIRD-PARTY-NOTICES.md)

**English** · NexoWatt EOS is a local energy management, dashboard and system administration adapter for ioBroker. Install or update `iobroker.eos-admin` from your configured repository. See the [release guide](docs/start/START_HIER_9.0.27.md) for requirements and post-update checks.
