# NexoWatt EOS 9.0.15 – als App auf dem Smartphone

Diese Version enthält die bisherigen Korrekturen aus 9.0.14, ergänzt das gemeinsame Webapp-Symbol und macht den Einstieg zur Bestandsübernahme in Administration und Einstellungen deutlich sichtbar. Das hochgeladene NexoWatt-Logo wird unverändert als Apple-Icon und zusätzliches 1024-Pixel-Manifest-Icon ausgeliefert. Die vorhandenen echten 192-/512-Pixel- und Maskable-Varianten bleiben für Android verfügbar.

## Aktualisieren

Die vollständige Repo-ZIP wie gewohnt entpacken und vollständig in den Repository-Ordner kopieren. `node -p "require('./package.json').version"` muss **9.0.15** ausgeben. Danach ist `npm publish` aus diesem Ordner möglich; der Kanal bleibt `next`. Kein eigener Frontend-Build ist nötig.

### `npm publish` im richtigen Ordner

Die gemeldete Fehlermeldung `ENOENT ...\ioBroker\package.json` bedeutet: PowerShell steht im übergeordneten Ordner. Die Datei `package.json` liegt im entpackten Adapterordner. Die ZIP enthält dafür den Unterordner `iobroker.eos-admin`. Wenn du die Dateien wie bisher in deinen vorhandenen Ordner `ioBroker.eos.admin` kopierst, führe dort aus:

```powershell
cd "C:\Users\User\Desktop\ioBroker\ioBroker.eos.admin"
Test-Path .\package.json
node -p "require('./package.json').version"
npm publish
```

Erwartet werden `True` und `9.0.15`. Wenn du direkt den neu entpackten ZIP-Unterordner verwendest, lautet dessen Name `iobroker.eos-admin` mit Bindestrich; passe nur den Ordnernamen im `cd`-Befehl an. Bei `False` oder einer anderen Version erst den richtigen Ordner öffnen. Der Elternordner `...\ioBroker` ist kein npm-Paket. Kein `npm init`, kein Überschreiben der Lizenzdateien und kein Abschalten der Release-Prüfungen nötig.

### Bestandsübernahme finden

Im **EOS-Admin → Bestandsübernahme** und in **Dashboard → Einstellungen → Allgemein → Bestandsübernahme** führt der Eintrag im selben Tab zur Statusseite. Er wird für ein bestätigtes Administratorkonto angezeigt; Installateur- und Kundenkonten bekommen dadurch keine zusätzlichen Rechte. Im Installer bleibt der vorhandene gleichnamige Einstieg erhalten. Der Direktpfad ist `/migration/` auf derselben EOS-Adresse und demselben aktuell konfigurierten Port.

Die bestehende EOS-Instanz auf diese Version aktualisieren. Eine neue Instanz ist nicht nötig. Die Anleitung zur noch ausstehenden Bestandsübernahme mit den weiter eingeschalteten alten UI-/Devices-Instanzen steht in [START_HIER_9.0.14.md](START_HIER_9.0.14.md). Eine reine Logoänderung ersetzt diese Übernahme nicht.

## Auf dem iPhone

1. Die funktionierende EOS-HTTPS-Adresse in Safari öffnen. Dieselbe Adresse einschließlich Hostname/IP und Port künftig beibehalten.
2. Das Teilen-Menü öffnen und **„Zu Home-Bildschirm hinzufügen“** auswählen.
3. Falls angeboten, **„Als Web-App öffnen“** aktivieren. Als Namen **NexoWatt EOS** verwenden und hinzufügen.
4. Das neue Symbol antippen. Ohne gültige Sitzung erscheint die Anmeldung, mit gültiger Sitzung das Dashboard. Noch notwendiger Passwortwechsel oder Lizenzaktivierung bleiben vorgeschaltet.

## Auf Android

Die EOS-HTTPS-Adresse in Chrome öffnen. Im Browsermenü **„Zum Startbildschirm hinzufügen“ → „Installieren“** beziehungsweise **„App installieren“** wählen; die Bezeichnung hängt von der Browserversion ab. Die Installation benötigt eine bewusste Nutzeraktion, sie erfolgt nicht automatisch durch das Adapterupdate.

## Wenn noch das alte Symbol erscheint

Die Seite nach dem Update neu laden. Bereits installierte Symbole werden vom Betriebssystem zwischengespeichert und müssen nicht sofort wechseln. Wenn es beim alten Symbol bleibt, die bisherige EOS-Verknüpfung vom Home-Bildschirm entfernen und von der aktuellen EOS-Adresse neu hinzufügen. Keine ioBroker-Instanzen, Geräte oder Konfigurationen dafür löschen.

Die Installation über eine andere IP, einen anderen Hostnamen oder einen anderen Port ist eine andere Browser-Origin und kann eine getrennte App beziehungsweise Sitzung ergeben.

## Lokales HTTPS und Betrieb

Das Zertifikat muss zur verwendeten Adresse passen und auf dem Smartphone vertrauenswürdig sein. Eine eigene NexoWatt-CA wird durch das Adapterupdate nicht automatisch auf fremden Endgeräten installiert oder freigeschaltet. Bei einem manuell eingerichteten iOS-Zertifikatsprofil ist zusätzlich die TLS-Vertrauensfreigabe in den iPhone-Einstellungen erforderlich. Details zur vorhandenen EOS-Zertifikatsverwaltung: [NEXOWATT_TLS_DE.md](docs/unified/NEXOWATT_TLS_DE.md).

Die Webapp verbindet sich mit deinem lokalen EOS-Gerät. Dieser Stand ergänzt keine Offline-Regelung und speichert keine Anmeldetokens im Manifest. Lizenz, Rechte, Sitzungsschutz, EMS und Geräteübernahme bleiben erhalten.

## Offizielle Bedienhinweise

- [Apple: Website als Web-App hinzufügen](https://support.apple.com/de-de/guide/iphone/iphea86e5236/ios)
- [Google: Web-Apps auf Android verwenden](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=de)
- [Apple: Vertrauen manuell installierter Zertifikate](https://support.apple.com/en-us/102390)

Die Prüfung dieses Lieferstands ist im [Prüfbericht](docs/reports/unified-9.0.15/PRUEFBERICHT.md) dokumentiert. Eine tatsächliche Installation auf deinem iPhone oder Android-Gerät wurde hier nicht ausgeführt. NexoWatt-Anteile bleiben proprietär.
