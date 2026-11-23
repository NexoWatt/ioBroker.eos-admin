# NexoWatt EOS 9.0.13 – Repo kopieren und mit npm veröffentlichen

## Dein gewohnter Ablauf

1. `NexoWatt_EOS_9.0.13_FULL_REPOSITORY.zip` herunterladen und entpacken.
2. Den **vollständigen Inhalt** des enthaltenen Ordners `iobroker.eos-admin` in deinen bisherigen Repository-Ordner kopieren und vorhandene Dateien ersetzen. Nicht nur `package.json`, einzelne Tools oder den äußeren ZIP-Ordner kopieren. Ein leerer Zielordner funktioniert ebenfalls.
3. PowerShell in genau diesem Ordner öffnen, beispielsweise:

```powershell
cd C:\Users\User\Desktop\ioBroker\ioBroker.eos.admin
node -p "require('./package.json').version"
npm publish
```

Die Versionsabfrage und die npm-Ausgabe müssen **9.0.13** anzeigen. Steht dort weiterhin 9.0.11 oder 9.0.12, ist noch der alte Paketordner geöffnet oder der Inhalt wurde nicht vollständig ersetzt.

Für die Veröffentlichung der fertigen Lieferung sind weder `npm install` noch ein eigener Build oder ein TGZ erforderlich. Eine vorhandene npm-Anmeldung und die Veröffentlichungsrechte für `iobroker.eos-admin` bleiben notwendig. Der konfigurierte Kanal bleibt `next`. Eine rein lokale Vorprüfung ist optional mit `npm publish --dry-run` möglich; sie veröffentlicht nichts.

## Was beim Kopieren über ein altes Repo geschieht

Alte, vom aktuellen Build nicht mehr verwendete Dateien unter `adminWww` bleiben beim gewöhnlichen Kopieren häufig liegen. Die neue Vorbereitung erkennt ausschließlich bekannte Pfade **mit exakt bekannten historischen Dateihashes**. Der Katalog stammt aus tatsächlichen Lieferungen von EOS Admin 8.0.2 und EOS 9.0.0-alpha.1 bis 9.0.12; alle 20 im gemeldeten Fehlerauszug genannten Dateinamen sind enthalten.

Alle aktuellen Release-Dateien werden zuerst geprüft. Erkannte alte Dateien werden vollständig in einen neuen Ordner **neben** dem Repository gesichert, beispielsweise `ioBroker.eos.admin.publish-backup-AbCdEf`. Erst nach erfolgreicher Prüfung aller Sicherungen werden die alten Originale aus `adminWww` entfernt. Der Sicherungsordner mit `restore.json` wird nicht veröffentlicht. Der Elternordner muss beschreibbar sein. Es werden keine Dateien aus der Kundenanlage und keine ioBroker-Einstellungen verändert.

Unbekannte Zusatzdateien, veränderte aktuelle Dateien, unerwartete Links und fehlerhafte Sicherungen brechen den Ablauf ab. Eigene Änderungen werden nicht automatisch verworfen oder neu versiegelt. Zur Diagnose dient:

```powershell
node tools/eos-release-manifest.cjs --diagnose
```

Eine fehlende `.tgz` führt zu `ENOENT`; die vorherige Meldung „tarball seems corrupted“ belegt in diesem Fall keine Beschädigung. Für den oben beschriebenen Repo-Weg wird diese Datei nicht benötigt.

## Tests bleiben Bestandteil des Releases

`npm test` bleibt für Entwicklung und CI erhalten. Die vollständigen Tests werden vor der Auslieferung auf Node.js 22 und 24 ausgeführt. Die vorbereitete Lieferung enthält einen versions- und dateigebundenen Testnachweis. `npm publish` prüft diesen Nachweis und die Dateiintegrität ausschließlich lesend; es startet keine abhängigen Entwicklertests und schreibt keinen neuen Release-Nachweis. Ein manuell neu gebauter oder bearbeiteter Stand benötigt eine vollständige neue Releaseprüfung.

## SmartHome-Menüs

Das Menü „Projektdatei“ wird nicht mehr durch den Kopfbereich abgeschnitten. Beide Aktionsmenüs werden gemeinsam verwaltet; Details und tatsächliche Prüfumgebung stehen im [Menübericht](docs/reports/unified-9.0.13/SMART_HOME_MENU_REVIEW.md). CSS und Skript erhalten einen neuen Cachebezug. Nach dem Adapterupdate die Seite bei Bedarf einmal mit `Strg+F5` neu laden.

## Betrieb und Lizenz

Technischer Paketname, gemeinsame Systemlizenz, bestehende Einstellungen und Migrationsregeln bleiben erhalten. Diese Änderung betrifft Veröffentlichung und SmartHome-Menüs. Für eine Kundenübernahme gelten weiterhin die Sicherungs- und Abnahmeschritte aus [9.0.11](START_HIER_9.0.11.md); aus einem bestandenen npm-Trockenlauf folgt keine Abnahme einer Kundenanlage.

NexoWatt-Anteile bleiben proprietär; vorhandene Drittanbieter-Lizenzhinweise bleiben enthalten. Der npm-Zugang ist öffentlich konfiguriert: Das Paket kann heruntergeladen werden, seine Lizenz wird dadurch nicht zu einer freien Lizenz.

Der [Prüfbericht](docs/reports/unified-9.0.13/PRUEFBERICHT.md) enthält tatsächliche Ergebnisse und Grenzen. Native Windows-Ausführung, Browserdarstellung auf deinen Endgeräten und reale Anlagenabnahme sind damit nicht behauptet.
