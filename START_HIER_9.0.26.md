# NexoWatt EOS 9.0.26 – Module, Ladepunkte, Tarife und Web-App

EOS bleibt ein Adapter und ein npm-Paket. UI/EMS, Geräte, EEBUS, Sicherung und OCPP laufen in getrennten Prozessen. Der Administrationsprozess bleibt für Anmeldung und Wiederherstellung erreichbar. Dies ist ein kontrollierter Teststand; die ausgeführten Softwareprüfungen und offenen Anlagenprüfungen stehen im Prüfbericht.

## Module bedienen

Auf `/runtime/` aktiviert **Aktivieren** jetzt beide benötigten Freigaben in einem Bedienvorgang: die bestehende Modulkonfiguration und die Prozessfreigabe. Das funktioniert auch dann, wenn bisher „Prozessfreigabe aktiviert“, aber „Modul deaktiviert“ angezeigt wurde. Geräteprofile, Zugangsdaten, Tarifauswahl, Datenpunkte und sonstige Einstellungen werden dabei nicht zurückgesetzt. Die eigentliche Betriebsbereitschaft wird erst nach bestätigtem Start angezeigt.

**Deaktivieren** speichert die Abschaltung und beendet den gewählten Prozess. **Neustarten** stoppt und startet nur diesen Prozess nach bestätigtem Ende und Abschluss bereits angenommener Schreibvorgänge. Eine bewusst gespeicherte Abschaltung bleibt nach EOS-Neustarts und Updates bestehen.

Bei einer neuen Installation ohne gespeicherte Modulkonfiguration sind die integrierten Prozess- und Modulfreigaben standardmäßig an. Unbekannte Geräte werden dadurch nicht konfiguriert. Der Sicherungsprozess startet zur Einrichtung, ohne ungefragt einen Sicherungszeitplan anzulegen. Vorhandene Sicherungspläne bleiben erhalten.

Lizenz, gültige Einstellungen, freie Ports und eindeutige Geräteeigentümerschaft bleiben erforderlich. Ein parallel laufender externer `ocpp21`-Adapter kann deshalb den integrierten OCPP-Prozess sperren. Er wird beim Aktivieren nicht ungefragt gestoppt oder übernommen. Die übrigen EOS-Module dürfen dadurch nicht gemeinsam blockiert werden. Die geprüfte Übernahme bleibt ein eigener Bedienvorgang.

Ein Paketladefehler wird als solcher angezeigt. Permanente fehlende Abhängigkeiten lösen keine endlose automatische Neustartfolge aus. Nach Behebung kann ausdrücklich erneut aktiviert oder gestartet werden. Vorübergehende Prozessausfälle behalten die begrenzte Wiederholungslogik. Die Prozessgeneration ist ein interner Gültigkeitszähler und keine Anzahl von Starts.

Die Git-Ausnahmen erhalten außerdem die geprüften Webserverquellen. Ohne diese Dateien konnte ein frischer Git-Stand zwar die Laufzeiten enthalten, aber die verpflichtende Veröffentlichungsprüfung an einer fehlenden Herkunftsprüfung scheitern.

Ein gemeinsamer Lieferfehler betrifft EEBUS, OCPP und Sicherung: Die bisherige Git-Ignore-Regel schloss deren kompilierte `modules/*/build`-Verzeichnisse beim normalen Hinzufügen zum Repository aus. Ein daraus installierter Git-Stand konnte deshalb `MODULE_NOT_FOUND` melden, obwohl die vollständige ZIP und das daraus direkt gepackte npm-Paket funktionierten. Die Ausnahmen für die drei benötigten Modullaufzeiten sind korrigiert und werden zusätzlich über einen frischen Git-Index geprüft. Der Nutzer hat inzwischen bestätigt, dass über npm auch OCPP, EEBUS und Sicherung laufen. Die konkrete vorherige Pi-Fehlerursache wurde nicht aus dieser Umgebung ausgelesen; verbleibende Ladefehler werden genauer diagnostiziert. Auch der benötigte SD-Kartentreiber der Sicherung bleibt im Git-Export enthalten.

## Ladepunkte entfernen und Tarif nach Neustart laden

Im EMS kann ein einzelner Ladepunkt über **Ladepunkt entfernen** aus dem Entwurf entfernt und die Änderung anschließend gespeichert werden. Auch das bewusste Entfernen des letzten Ladepunkts beziehungsweise die Anzahl **0** ist möglich. Die Oberfläche lädt Konfiguration und Versionskennzeichen zusammen; während des Ladens ist Speichern gesperrt. Hat ein anderer Vorgang die Konfiguration tatsächlich geändert, bleibt die Konfliktprüfung wirksam und verlangt einen Abgleich über **Neu laden**.

Die Bedienwerte verbleibender Ladepunkte werden ihrer Gerätezuordnung entsprechend übernommen. Stationsseiten behalten ebenfalls ihre zugeordneten Geräte; das Entfernen einer Station darf deren Link nicht für eine andere Station freigeben. Bereits offene Bedienseiten können nach einer geänderten Zuordnung zum erneuten Laden auffordern. Damit wird verhindert, dass ein alter Befehl für die bisherige Platznummer versehentlich den nachgerückten Ladepunkt steuert.

Die automatische OCPP-Erkennung berücksichtigt externe Quellen nur noch, wenn die entsprechende Adapterinstanz tatsächlich vorhanden ist. Eine ausgeschaltete oder vorübergehend nicht erreichbare, aber weiterhin eingerichtete Instanz bleibt eine gültige Quelle. Bereits eingerichtete Ladepunkte werden nicht allein wegen einer Verbindungsunterbrechung automatisch gelöscht.

Für **Tibber** wird der Neustart mit gespeicherter Anbieterauswahl und Zugangsschlüssel geprüft. Ein reproduzierter Anzeigeablauf lieferte vor Abschluss des Konfigurationsladens fälschlich „manuell“ und „aus“, obwohl Tibber gespeichert blieb. Die Tarifseite wartet nun auf die geladene Konfiguration. Während dieser Startphase sind Lesen und Speichern der Tarifanbindung gesperrt; die Oberfläche lädt anfangs begrenzt nach. Sie wiederholt keine Speicheranforderungen automatisch und überschreibt keinen bearbeiteten Entwurf. Ein Ladefehler darf nicht als erfolgreich geladener Standardtarif erscheinen.

## Sicherung übersichtlich einrichten

Die erweiterten Einstellungen sind nach **Systemsicherung, Datenbanken, Anwendungen, Speicherzielen und weiteren Betriebsoptionen** geordnet. Jeder unterstützte aktivierbare Teil hat seinen eigenen An/Aus-Schalter. Über **Einstellungen** öffnet sich ein Dialog mit den zugehörigen Feldern; vorhandene Werte bleiben erhalten.

**Übernehmen** übernimmt die Dialogwerte in den Entwurf. **Abbrechen** oder Escape verwirft ausschließlich die Änderungen dieses Dialogs. Die feste Speicherleiste zeigt ungespeicherte Änderungen; erst **Änderungen speichern** überträgt den vollständigen geprüften Entwurf. Der Status des Sicherungsdienstes und die Vollständigkeit einer Gesamtsicherung sind getrennte Angaben.

Ein lokaler Sicherungspfad muss absolut und zulässig sein, etwa ein bereits eingebundener Speicherpfad. Eine bloße NAS-Freigabebezeichnung ist kein lokaler Pfad; die Oberfläche bindet keine Freigabe heimlich mit erhöhten Rechten ein. Ist die aktive InfluxDB-Historie noch nicht als Sicherungsquelle konfiguriert, bleibt eine Gesamtsicherung ausdrücklich unvollständig beziehungsweise gesperrt. Einstellungen allein belegen keinen erfolgreichen Sicherungs- oder Wiederherstellungslauf.

## NexoWatt-Symbol und HTTPS auf dem iPhone

Das gelieferte NexoWatt-Logo ist enthalten. Die üblichen Apple-Symboladressen werden unabhängig vom UI-/EMS-Prozess als öffentliche PNG-Dateien bereitgestellt. Die Anmeldung verlinkt die Einrichtung unter `/security/trust/`.

Wenn bereits ein gültiges NexoWatt-Zertifikat samt Stammzertifikat in EOS eingerichtet ist, kann dort ausschließlich das **öffentliche Stammzertifikat** heruntergeladen werden. Private Schlüssel werden nicht ausgegeben. Ist noch keine entsprechende Zertifikatskette eingerichtet, zeigt die Seite den erforderlichen Administrationsschritt unter `/security/tls/`. Sie erzeugt oder ersetzt keine Zertifikate ungefragt.

Auf dem iPhone:

1. Das bereitgestellte Stammzertifikat und seinen Fingerabdruck mit den unabhängig bestätigten Angaben des Installateurs vergleichen, herunterladen und das Profil in den iPhone-Einstellungen installieren.
2. Unter **Einstellungen → Allgemein → Info → Zertifikatsvertrauenseinstellungen** das volle Vertrauen für dieses Stammzertifikat aktivieren.
3. EOS erneut in Safari öffnen. Die Adresse muss ohne Zertifikatswarnung erreichbar sein. Sowohl die verwendete lokale IP als auch eine abweichende VPN-IP müssen im Serverzertifikat enthalten sein; alternativ einen passend zertifizierten, erreichbaren Gerätenamen verwenden.
4. Anschließend über „Zum Home-Bildschirm“ hinzufügen. Ein bereits gespeichertes Ersatzsymbol gegebenenfalls entfernen und die Verknüpfung nach erfolgreicher Einrichtung neu anlegen.

Eine Webseite kann diese iPhone-Systembestätigung nicht selbst vornehmen. Das Bestätigen einer Browserwarnung ersetzt nicht die Einrichtung des Vertrauens. Der tatsächliche iOS-Installationsdialog und die Zertifikatskette der Kundenanlage sind hier nicht getestet.

Apple-Anleitung: https://support.apple.com/de-de/102390

## Git und npm wie bisher

1. Bestehende Konfiguration und den bisherigen Repositorystand sichern; die vorhandene ioBroker-Instanz beibehalten.
2. Aus der vollständigen ZIP den **Inhalt des Ordners `iobroker.eos-admin`** in den eigenen Git-Repositoryordner übernehmen. `.git` und eigene Änderungen erhalten. Auch die mitgelieferte `.gitignore` übernehmen; sie enthält die korrigierten Ausnahmen für die drei Modullaufzeiten.
3. Im Ordner mit `package.json` prüfen und normal veröffentlichen:

```powershell
node -p "require('./package.json').version"
npm publish --tag next
```

Die Ausgabe muss `9.0.26` sein. Für das eigene ioBroker-Repository liegt `nexowatt-eos-admin-repository-entry-v9-0-26.json` bei. Bekannte unveränderte Buildreste älterer Lieferstände werden vor dem Publish gesichert bereinigt. Unbekannte oder veränderte Dateien bleiben geschützt; Publish-Prüfungen nicht umgehen.

Für OCPP, EEBUS und Geräte ist kein weiteres npm-Paket erforderlich. Dieses Lieferpaket veröffentlicht und installiert sich nicht selbst.

## Nach dem Update prüfen

- Gewünschte Module in `/runtime/` aktivieren; bestätigten Prozessstart und aktuelle Gerätewerte prüfen.
- Bestehenden Tarifanbieter und Einstellungen prüfen; bei Tibber auch nach einem Adapterneustart nochmals öffnen. Zugangsschlüssel nicht in Protokolle oder Fehlermeldungen kopieren.
- Veralteten Ladepunkt entfernen, speichern und neu laden. Verbleibende Ladepunkte müssen ihre eigenen Zuordnungen und Betriebsarten behalten.
- OCPP-Port, Ladestationsverbindung und PV-Ladepause am tatsächlichen Gerät prüfen. Ein laufender Prozess allein bestätigt keine physische Ladepause.
- Energiefluss bleibt auf fünf Sekunden Anzeigeaktualisierung. Regelintervalle und bestehende Steuerlogiken werden durch die Ressourcenoptimierung nicht verlängert.
- Die HTTPS-Adresse auf dem iPhone ohne Warnung öffnen und das NexoWatt-Symbol beim Hinzufügen kontrollieren.

Eine Verringerung des RAM-Verbrauchs auf dem Raspberry Pi ist noch nicht gemessen. Der Stand reduziert nachweisbar unnötige Ereignisverarbeitung im Modulhost; die konkrete Messung und ihre Grenzen nennt [der Prüfbericht](docs/reports/unified-9.0.26/PRUEFBERICHT.md).
