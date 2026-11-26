# NexoWatt EOS 9.0.17 – parallel zu ioBroker Admin und Backitup

Diese Version korrigiert zwei im Code nachgewiesene Ursachen für gegenseitige Störungen: gemeinsame Browser-Cookienamen und automatische Änderungen an fremden ioBroker-Rechten beziehungsweise Metadaten. Die bisherigen Korrekturen zum Gerätespeichern, zum Erhalt gespeicherter EMS-Einstellungen und zur Abmeldung nach zehn Minuten bleiben enthalten.

## Was sich ändert

EOS verwendet eigene, pro Instanz benannte Cookies. Anmeldung, Token-Erneuerung und Abmeldung bei EOS verändern dadurch keine Sitzungscookies des Standard-Admins. Die Trennung gilt für HTTP und WebSocket sowie für die Weiterleitung an andere Adapter. Unterschiedliche Ports allein trennen Browsercookies nicht; deshalb ist diese Änderung auch bei Admin auf 8081 und EOS auf 8188 nötig.

EOS überschreibt beim Start oder bei seiner periodischen Rechteprüfung keine bestehenden Administratorgruppen, fremden Benutzer, Standard-Admin-/Backitup-Objekte, Systemobjekte oder Kategorien mehr. Eigene fehlende EOS-Rollengruppen können weiterhin angelegt werden; vorhandene Gruppen werden nicht zur Vorlage für automatische Rechteänderungen. Die serverseitigen EOS-Zugriffsprüfungen bleiben aktiv.

Standard-`admin.0` und `backitup.0` bleiben eigenständige Adapter. Die integrierte NexoWatt-Sicherung übernimmt den vorgesehenen NexoWatt-Backup-Adapter, nicht automatisch den Standard-Backitup. Für den Parallelbetrieb müssen Standard-Admin und Backitup nicht deaktiviert oder gelöscht werden. Die kontrollierte Übergabe alter **NexoWatt-UI-/Devices-Instanzen** ist ein anderer Vorgang; hier dürfen nicht zwei Geräte- beziehungsweise EMS-Regler gleichzeitig dieselben Aktoren steuern.

## Neuinstallation und unabhängiger Parallelbetrieb

Bei einer neuen ioBroker-Installation zuerst den Standard-Admin auf seinem vorgesehenen Zugang (üblicherweise **8081**) verwenden. EOS anschließend als eigene Instanz auf **HTTPS 8188** installieren. Standard-Admin und Standard-Backitup bleiben installiert und können parallel weiterlaufen. Die EOS-Installation benötigt kein Abschalten, Umbenennen oder Ersetzen dieser beiden Adapter und keinen Import ihrer Konfiguration.

EOS führt keine automatische Änderung der globalen ioBroker-Updatepolitik, Repository-Reihenfolge oder Updateeinstellungen anderer Adapter mehr durch. Die Sperre ungeprüfter unbeaufsichtigter Installationen gilt für den eigenen EOS-Ablauf; die vom Betreiber eingerichtete Controller-Politik bleibt bestehen. Eine separate Legacy-Übernahme ist nur für die ausdrücklich vorgesehenen bisherigen NexoWatt-Module zuständig.

Vor der erneuten Verwendung auf der Anlage den korrigierten **9.0.17-Lieferstand** einsetzen. Vorhandene Sicherungen von vor der betroffenen EOS-Installation aufbewahren. Diese Anleitung verlangt keine weitere Live-Diagnose der alten, inzwischen neu installierten Anlage.

## Update und vorhandene Einstellungen

1. Eine aktuelle, überprüfbare Sicherung der Anlage sowie die bisherige Adapterversion bereithalten. Insbesondere eine vorhandene Sicherung von vor der betroffenen EOS-Installation erhalten. Eine vorhandene Sicherung zusätzlich außerhalb des Geräts aufbewahren.
2. Die bestehende EOS-Instanz aktualisieren. Keine Geräte-, EMS-, Objekt- oder Instanzdaten löschen und für ein normales Update keine alten Konfigurationen erneut importieren.
3. EOS nach dem Neustart erneut anmelden. Durch die getrennten Cookienamen wird eine alte EOS-Browsersitzung nicht übernommen. Konfiguration, Lizenz und Gerätezuordnungen sind keine Cookies und bleiben davon unberührt.
4. Standard-Admin und EOS in getrennten Tabs öffnen. Standard-Admin soll auf seinem bisherigen Zugang, üblicherweise Port **8081**, erreichbar bleiben; EOS verwendet bei einer neuen Instanz **HTTPS auf Port 8188**. Bereits gespeicherte individuelle Ports werden durch dieses Update nicht still überschrieben. Bei einer bestehenden Portkollision nur die EOS-Portkonfiguration gezielt korrigieren.
5. Geräte, EMS-Zuordnungen und weitere gespeicherte Einstellungen mit der Sicherung beziehungsweise dem vorherigen Stand vergleichen. Ein Gerät bearbeiten, speichern, neu laden und den gespeicherten Stand prüfen. Anschließend Regeltakte und frische Messwerte beobachten.

Die Korrektur verhindert die beschriebenen künftigen Fremdeingriffe. Sie rekonstruiert keine durch eine frühere Version verlorenen Einstellungen oder unbekannten früheren Rechte. Für eine noch ausstehende NexoWatt-Bestandsübernahme gilt der dafür vorgesehene Ablauf, siehe [Anleitung 9.0.14](START_HIER_9.0.14.md). Die gespeicherte Konfiguration bleibt beim normalen Update maßgeblich; Details der erhaltenen Korrekturen stehen in [Anleitung 9.0.16](START_HIER_9.0.16.md).

## Optionale Diagnose einer älteren Installation

Für die Neuinstallation ist keine Reparatur der alten Installation erforderlich. Auf dem gemeldeten Gerät funktionierte der Standard-Admin laut Nutzer in einem privaten Browserfenster wieder. Dieser Nutzerbericht bestätigt keinen dauerhaften Datenbankschaden; eine Live-Reparatur wurde nicht ausgeführt.

Für einen späteren unabhängigen Diagnosefall bleibt `tools/eos-coexistence-recovery.cjs` als rein lesendes Werkzeug enthalten. Es läuft nur bei ausdrücklichem Aufruf, verändert keine Rechte und bietet kein `--apply`. Anleitung und Grenzen stehen im [Backitup-/Wiederherstellungsbericht](../reports/unified-9.0.17/BACKUP_COEXISTENCE_REVIEW_DE.md). Das Werkzeug wird für die Installation und den Parallelbetrieb nicht benötigt.

## Kurze Prüfung des Parallelbetriebs

- Im Standard-Admin Adaptericons, Objektansicht und Backitup öffnen. Eine neue Test-Sicherung über Backitup anlegen und ihren Abschluss sowie die Datei prüfen; eine Rücksicherung nur in einer getrennten Testumgebung durchführen.
- Im zweiten Tab EOS anmelden, abmelden und wieder anmelden. Der Standard-Admin muss in seinem Tab weiterhin bedienbar bleiben; EOS muss weiterhin seine eigene Anmeldung und Berechtigung verlangen.
- Standard-Admin separat ab- und anmelden; Dashboard, Geräte und EMS in EOS weiter prüfen. Hintergrundwerte verlängern weiterhin nicht die zehnminütige EOS-Inaktivitätsfrist.
- Nach einem EOS-Neustart die gespeicherten Geräte/EMS-Zuordnungen sowie Standard-Admin und Backitup erneut prüfen. Bestehende Backitup-Konfiguration und Sicherungsdateien müssen unverändert vorhanden sein.

Die automatisierten Nachweise und noch offenen Prüfungen stehen im [Prüfbericht](../reports/unified-9.0.17/PRUEFBERICHT.md). Die Abnahme auf der konkreten Liveanlage bleibt erforderlich; eine allgemeine Produktions- oder CRA-Zertifizierung wird damit nicht behauptet.

## Wie gewohnt aus der Repo-ZIP veröffentlichen

Die **vollständige** ZIP einschließlich `tools` und `release-manifests` in den vorgesehenen Adapterordner entpacken beziehungsweise überkopieren. Eigene Quelländerungen vorher separat sichern.

```powershell
cd "C:\Users\User\Desktop\ioBroker\ioBroker.eos.admin"
node -p "require('./package.json').version"
npm publish
```

Die Versionsabfrage muss **9.0.17** ausgeben. Die ZIP enthält den Unterordner `iobroker.eos-admin`; bei Verwendung dieses Ordners den Pfad im `cd`-Befehl entsprechend anpassen. Im übergeordneten Ordner ohne `package.json` kann `npm publish` nicht funktionieren.

Wie in 9.0.16 prüft die Vorbereitung zuerst den vollständigen gelieferten Stand. Ausschließlich bytegenau bekannte alte Admin-/Installer-Dateien werden gesichert außerhalb des Repositorys abgelegt. Unbekannte oder veränderte Dateien werden nicht blind gelöscht; die Fehlermeldung nennt den Pfad. Beim Publish werden Quellen weder neu gebaut noch neu versiegelt. Der Kanal bleibt `next`, die NexoWatt-Lizenz bleibt proprietär. Ein öffentlich herunterladbares npm-Paket ist keine freie Nutzungslizenz.
