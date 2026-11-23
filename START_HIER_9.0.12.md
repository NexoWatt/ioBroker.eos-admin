# NexoWatt EOS 9.0.12 – SmartHome schneller einrichten

Stand: 23.11.2026. Diese Version vereinfacht die SmartHome-Einrichtung. Vorhandene Gebäude-/Raum-/Geräte-IDs, Zuordnungen, Szenen, Zeitschaltuhren, Lizenz und die Migrationsabsicherung aus 9.0.11 bleiben erhalten. Die Lieferung ist ein softwaregeprüfter Integrations-Teststand; die Abnahme an der tatsächlichen Anlage bleibt erforderlich.

## Einrichtung

Die Standardansicht führt über Geschoss- und Raum-Auswahl zur kompakten Geräteliste. Das bestehende Projekt ist das Gebäude; es wird kein neues, inkompatibles Gebäudemodell eingeführt.

- Unter „Einrichten“ das Geschoss und den Raum per Dropdown auswählen; „+ Geschoss“, „+ Raum“ oder „+ Gerät manuell anlegen“ öffnet das passende Fenster.
- Die Einrichtung eines Geräts in einem eigenen Dialog öffnen. Die Datenpunktzuordnung erhält die Dialogbreite statt der bisherigen schmalen rechten Spalte.
- Mit „In Entwurf übernehmen“ bestätigen oder den Dialog abbrechen. Bestehende gespeicherte Daten werden durch das bloße Öffnen nicht geändert.
- „Geräte erkennen“ öffnen, gewünschte Geräte markieren, den Zielraum auswählen und „Auswahl übernehmen“ wählen. Die Liste zeigt 100 Vorschläge je Seite; pro Übernahme sind bis zu 100 Geräte möglich. Technische Einzelheiten öffnen sich separat.
- Alias-Verknüpfungen bewusst verwenden/anlegen; vorhandene passende Aliase werden wiederverwendet. Die Erkennung selbst schaltet keine Geräte.
- Den Konfigurationsentwurf mit „Speichern“ sichern. Die bisherige Expertenansicht, Kachelanordnung, Szenen und Zeitschaltuhren bleiben erreichbar.

Das Erkennen kann nur Geräte aus bereits vorhandenen ioBroker-Objekten und deren Rollen/Metadaten vorschlagen. Es ist kein Netzwerk- oder Hardware-Provisionierungsscan. Fehlende Rollen oder Datenpunkte benötigen weiterhin eine manuelle Zuordnung.

## Behobener Erkennungsfehler

Die Objektliste wurde zuvor sprachabhängig sortiert, aber als bereits korrekt sortiert an den Typdetektor übergeben. Dessen binäre Suche benötigt die normale JavaScript-Stringreihenfolge. Dadurch konnten unter anderem Kanäle mit Großbuchstaben übersehen werden. Ein Regressionstest verwendet den echten, ausgelieferten ioBroker-Typdetektor.

## Installation und Veröffentlichung

Vor dem Update eine rücksicherbare vollständige Sicherung erstellen. Die vorhandene EOS-Admin-Instanz aktualisieren; keine zweite Instanz anlegen und bestehende Konfigurationen nicht löschen. Das vollständige Repo-ZIP in ein leeres Verzeichnis entpacken, nicht über einen alten Quell-/Buildordner kopieren.

**Wichtig bei `RELEASE_CONTENT_CHANGED`:** Ein bloßes `npm publish` prüft und verpackt den aktuellen Arbeitsordner. Bei alten oder geänderten Dateien in `adminWww/assets` wiederholt sich der Fehler auch nach dem Kopieren einer neuen Version. Die Integritätsdatei nicht neu erzeugen und die Prüfung nicht abschalten. Für die Veröffentlichung die unten ausdrücklich angegebene TGZ-Datei verwenden; für Quellen das vollständige ZIP frisch entpacken.

Für npm unter Windows das fertige `iobroker.eos-admin-9.0.12.tgz` verwenden. Im Ordner der heruntergeladenen TGZ zuerst die SHA-256-Summe mit `SHA256SUMS_9.0.12.txt` vergleichen und dann prüfen:

```powershell
Get-FileHash .\iobroker.eos-admin-9.0.12.tgz -Algorithm SHA256
npm publish .\iobroker.eos-admin-9.0.12.tgz --tag next --access public --dry-run
```

Nach erfolgreicher Prüfung und mit dem berechtigten npm-Konto:

```powershell
npm publish .\iobroker.eos-admin-9.0.12.tgz --tag next --access public
```

Die Lieferung veröffentlicht selbst nichts. Die proprietäre NexoWatt-Lizenz bleibt bestehen; ein öffentliches npm-Paket ist trotzdem öffentlich herunterladbar. Hersteller- und Kundenschlüssel gehören nicht ins Paket.

Für das lokale Linux-Update mit js-controller 7.2.5 die TGZ per WinSCP in das Home-Verzeichnis des SSH-Benutzers kopieren. Nach erfolgreicher Sicherung und Prüfsummenabgleich ausschließlich EOS Admin zum Paketaustausch stoppen:

```bash
cd /opt/iobroker
iobroker stop eos-admin.0
iobroker url "$HOME/iobroker.eos-admin-9.0.12.tgz" eos-admin
```

Nur bei erfolgreichem Paketupdate mit Exitcode 0:

```bash
iobroker start eos-admin.0
```

Bei einem bereits zusammengeführten EOS bleiben die übernommenen Altinstanzen deaktiviert erhalten. Bei der erstmaligen Zusammenführung aus EOS Admin 8.0.2, NexoWatt UI 1.0.37 und Devices 0.5.176 die Alt-UI und Devices nicht vorsorglich stoppen: Die automatische Übergabe prüft und stoppt sie selbst. Voraussetzungen, Port-/TLS-Prüfung, Rückfall und unverändert beibehaltene Namespaces stehen in [START_HIER_9.0.11.md](START_HIER_9.0.11.md).

Nach dem Update die Konfigurationsseite vollständig neu laden und im Protokoll Version 9.0.12 prüfen. Einen bestehenden Raum öffnen, eine harmlose Entwurfsänderung abbrechen und anschließend prüfen, dass die ursprünglichen Werte erhalten sind. Erkennung und Raumzuordnung zuerst mit einem bekannten Gerät prüfen, dann speichern und erneut laden. Die Erkennung darf dabei keine Aktorbefehle senden.

Prüfergebnisse und offene Grenzen: [Prüfbericht](docs/reports/unified-9.0.12/PRUEFBERICHT.md).
