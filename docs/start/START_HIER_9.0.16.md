# NexoWatt EOS 9.0.16 – Einstellungen erhalten und wieder veröffentlichen

Diese Version korrigiert das Speichern im Gerätebereich sowie nachgewiesene Überschreibungen gespeicherter Einstellungen beim Start, behebt den gemeldeten Publish-Abbruch durch alte Installer-Dateien und ergänzt die automatische Website-Abmeldung nach zehn Minuten ohne Bedienung. Die Änderungen aus 9.0.15 einschließlich App-Logo und Bestandsübernahme-Menü bleiben erhalten.

## Wie gewohnt aus der Repo-ZIP veröffentlichen

Die vollständige neue Repo-ZIP entpacken und ihren **gesamten Inhalt** wie bisher in den vorhandenen Adapterordner kopieren, einschließlich `tools` und `release-manifests`. Vorhandene Projektänderungen vorher separat sichern. Ein eigener Frontend-Build und eine Veröffentlichung aus einer TGZ sind nicht erforderlich.

```powershell
cd "C:\Users\User\Desktop\ioBroker\ioBroker.eos.admin"
node -p "require('./package.json').version"
npm publish
```

Die Versionsabfrage muss **9.0.16** ausgeben. Die ZIP enthält den Unterordner `iobroker.eos-admin` mit Bindestrich; wenn du direkt darin arbeitest, passe nur den Ordnernamen im `cd`-Befehl an. Der übergeordnete Ordner `...\ioBroker` enthält kein Adapterpaket.

Die konkret gemeldete Datei `ui/admin/react/assets/index-Bm4__n5R.js` wurde im früheren Lieferstand 9.0.6 ausgeliefert. Die Publish-Vorbereitung kennt jetzt auch nachweislich unveränderte alte Installer-Dateien. Sie prüft zuerst den vollständigen aktuellen Lieferstand und alle Zusatzdateien. Nur bytegenau bekannte alte Dateien werden anschließend in einen benachbarten Ordner `*.publish-backup-*` gesichert und aus dem Paket entfernt. Dort enthält `restore.json` die gesicherten Pfade und Hashes. Aktuelle Quellen werden dabei weder neu gebaut noch neu versiegelt.

Bei veränderten aktuellen Dateien oder tatsächlich unbekannten Zusatzdateien bleibt der Abbruch bewusst erhalten; die Dateien werden nicht ungeprüft gelöscht. Die Fehlermeldung benennt dann den betroffenen Pfad. `npm publish` verwendet weiterhin den vorhandenen Kanal `next` und die proprietären Lizenzangaben. Ein öffentlich herunterladbares npm-Paket erteilt keine freie Nutzungslizenz.

## Vorhandene Einstellungen beim Update erhalten

Die gespeicherte Installer-/EMS-Konfiguration hat jetzt beim Start Vorrang vor älteren Sicherungen – auch wenn du Geräte oder Zuordnungen bewusst gelöscht hast und die neue Konfiguration dadurch kleiner ist. Vorhandene Speicherzuordnungen, Energiefluss-Anzeigeeinstellungen und eine bewusst deaktivierte PV-Saison-AI werden durch die korrigierten Startpfade nicht mehr mit alten beziehungsweise voreingestellten Werten überschrieben.

Für ein normales Update derselben EOS-Instanz ist kein erneuter Import alter Adaptereinstellungen nötig. Prüfe die aktuell gespeicherten Zuordnungen nach dem Update. Bereits durch eine frühere Version verlorene Werte können nur aus einer passenden vorhandenen Sicherung wiederhergestellt werden. Bei einem Datenbank-Lesefehler oder beschädigten Konfigurationsdaten zeigt EOS einen Fehler, statt leere Vorgaben darüberzuschreiben.

## Geräte anlegen und zuverlässig speichern

Die vorhandene Gerätekonfiguration wird jetzt vollständig geladen, bevor der Editor Änderungen zulässt. Das Speichern hängt dadurch nicht mehr allein davon ab, ob das operative Gerätemodul bereits gestartet ist.

1. Im Gerätebereich **„Neu laden“** wählen und warten, bis die Konfiguration erfolgreich geladen ist.
2. Das Gerät im Gerätedialog anlegen beziehungsweise bearbeiten und dort speichern.
3. Anschließend oben **„Speichern und übernehmen“** wählen. Nach bestätigtem Speichern mit **„Neu laden“** prüfen, dass das Gerät und seine Felder weiterhin vorhanden sind.

Wenn die Bestandsübernahme noch blockiert ist, zeigt die Seite den Grund und einen Link zur Bestandsübernahme. Zuerst die dort genannte Ursache beheben, danach wieder **„Neu laden“** wählen. Der gesperrte Editor verhindert, dass Änderungen nur sichtbar werden, obwohl sie noch nicht gespeichert werden dürfen. Eine aktivierte Checkbox allein bedeutet nicht, dass das Gerätemodul bereits läuft; der operative Start bleibt an die bestehende Lizenz- und Übernahmefreigabe gebunden.

Bei einem Speicher- oder Anmeldefehler bleibt der Entwurf erhalten. Manuelles Neuladen fragt bei ungespeicherten Änderungen nach, bevor sie verworfen werden. Für ein normales Update keine alten Einstellungen erneut importieren und keine vorhandenen Adapterobjekte löschen.

## Zehn Minuten ohne Bedienung

Nach zehn Minuten ohne Interaktion mit der angemeldeten EOS-Website läuft die Sitzung ab. Danach erscheint wieder die Anmeldung; geschützte API- und Socket-Zugriffe benötigen erneut eine gültige Sitzung. Bedienungen wie Klicken, Tippen, Tastatureingaben oder Scrollen zählen als Aktivität. Automatische Messwertabfragen, Statusaktualisierungen und Socket-Verkehr zählen nicht.

Mehrere geöffnete Tabs derselben Browsersitzung verwenden dieselbe serverseitige Inaktivitätsfrist. Eine unabhängig angemeldete Sitzung auf einem anderen Endgerät hat ihre eigene Frist. Schlafen des Smartphones oder eine im Hintergrund pausierte Browser-Zeitschaltung verlängern den serverseitigen Zugriff nicht. Die Anmeldung startet nach dem Update neu, falls die bisherige Sitzung nicht mehr gültig ist.

Die Abmeldung betrifft die Website-Bedienung. Die lokale EMS-Regelung und die Gerätekommunikation laufen unabhängig davon weiter. Konfiguration, Lizenz und Bestandsübernahme bleiben gespeichert. Noch nicht gespeicherte Formulare vor dem Verlassen der Website sichern.

## Update und kurze Abnahme

1. Eine aktuelle Sicherung der Anlage und der bisherigen Adapterversion bereithalten; die bestehende EOS-Instanz aktualisieren.
2. Nach dem Neustart anmelden; gespeicherte Geräte, Installer-/EMS-Zuordnungen, Speicher und Energiefluss-Einstellungen mit dem vorherigen Stand vergleichen. Dashboard, Installer, Systemverwaltung und Bestandsübernahme öffnen.
3. Ohne jede Bedienung zehn Minuten warten; auch bei laufenden Livewerten muss danach eine erneute Anmeldung erforderlich sein.
4. Erneut anmelden, während der nächsten zehn Minuten wiederholt bedienen: Die Sitzung muss aktiv bleiben. Bei mehreren Tabs zählt Bedienung in einem Tab derselben Sitzung.
5. Parallel prüfen, dass EMS-Regeltakte und Gerätewerte während der Abmeldung weiterlaufen. Keine alten Adapterobjekte löschen; die noch offene Bestandsübernahme weiter über den dafür vorgesehenen Ablauf durchführen.

Für eine noch ausstehende Übernahme von UI-/Devices-Instanzen gilt weiterhin [START_HIER_9.0.14.md](START_HIER_9.0.14.md). Diese Version bestätigt keine bereits erfolgte Migration auf einer Kundenanlage.

Die tatsächlichen Softwareprüfungen und ihre Grenzen stehen im [Prüfbericht](../reports/unified-9.0.16/PRUEFBERICHT.md). Eine Anmeldung beim npm-Konto und die Berechtigung zum Paketveröffentlichen bleiben Voraussetzungen; ein lokaler Trockenlauf kann diese Kontoberechtigung nicht bestätigen.
