# NexoWatt EOS 9.0.8 – SmartHome und Installation

Dieser Prüfstand aktualisiert die vorhandene Instanz `eos-admin.0`. Eine neue
ioBroker-Installation ist nicht erforderlich. Die gemeinsame EOS-Lizenz und die
proprietäre Lizenzierung der NexoWatt-Anteile bleiben bestehen.

## SmartHome aktivieren

Als Admin oder Installateur **Installer → SmartHome Config** öffnen. Dort steht
die Aktivierung des SmartHome-Bereichs direkt zur Verfügung. Gebäude und Räume
anzulegen aktiviert SmartHome nicht automatisch. Die Aktivierung wird getrennt
vom Gebäudeentwurf gespeichert und benötigt keinen Adapter-Neustart.

Bei deaktiviertem SmartHome bleiben Gebäude, Räume, Gerätezuordnungen und
Zeitplan-Konfigurationen gespeichert. Die Aktivierung ist keine zusätzliche
Lizenzfreigabe: Die gemeinsame EOS-Lizenz bleibt serverseitig maßgeblich.

Der Wechsel **Einstellungen → Admin öffnen** erfolgt jetzt im selben Browser-Tab.

Online-Adapterbewertungen sind standardmäßig ausgeschaltet. Die optionale
Einstellung nennt ausdrücklich die Übermittlung der System-UUID an ioBroker.
Lokale Administration, EOS-Lizenz und Gerätefunktionen benötigen diesen Abruf nicht.

## Bestehende Kundeneinstellungen

Für die unterstützte Übernahme des alten UI-Adapters werden sein Aktivierungszustand,
Gebäude, Räume, Geräte, Seiten, Szenen und Datenpunktzuordnungen beibehalten.
Aktuelle Installer-Einstellungen und Zeitpläne werden aus dem erhaltenen alten
Namespace geladen. Einzelheiten und tatsächliche Prüfnachweise:
[SmartHome-Übernahme](docs/reports/unified-9.0.8/SMARTHOME_UEBERNAHME.md).

**Die bereits dokumentierten Grenzen der Gesamtmigration gelten weiter.**
Nicht lesbare geschützte Geheimnisse, EEBus-Vertrauensbindungen, fremde
`sendTo`-Abhängigkeiten, mehrere Quellinstanzen und Konfigurationskonflikte
sind kein pauschal gelöster Kunden-Updatepfad. 9.0.8 ist keine allgemeine
Freigabe für eine unbeaufsichtigte Umstellung aller Bestandsanlagen.

## Node.js 22 und 24

Unterstützte Versionsbereiche: `>=22.23.4 <23` oder `>=24.22.1 <25`.
Eine vorhandene Node-22-Anlage muss für dieses Update nicht auf Node 24 wechseln.
Ältere Patchstände innerhalb von Node 22 benötigen zuerst ein geprüftes
Wartungsupdate derselben Hauptversion. Welche Läufe tatsächlich ausgeführt
wurden, steht im [Prüfbericht](docs/reports/unified-9.0.8/PRUEFBERICHT.md).

## Update

1. Installation und Instanz-Datenverzeichnisse sichern; Rückfallstand behalten.
2. Das neue Paket über den vorhandenen ioBroker-Installationsweg in dieselbe
   EOS-Instanz übernehmen. Ein Update benötigt einen kontrollierten Neustart.
3. Bei Git die Inhalte des ZIP-Ordners `iobroker.eos-admin` in die Repositorywurzel
   übernehmen. Dieser Download veröffentlicht nichts auf GitHub oder npm.
4. Version 9.0.8, `LICENSE_VALID` und `EOS_HTTPS_READY` kontrollieren.
   ioBroker Admin bleibt auf 8081, EOS auf HTTPS 8188.
5. Anmeldung, SmartHome-Aktivierung, vorhandene Geräte und Sicherungszeitplan prüfen.

Direkter Einstieg: `https://192.168.10.153:8188/`.

## npm-Hinweise

`Process exited with code 0` bestätigt die erfolgreiche Installation, ersetzt aber
keine Funktionsprüfung. Die Hinweise zu `install-scripts` beschreiben die npm-
Freigaben des Installationsprojekts, gewöhnlich `/opt/iobroker`. Ein abhängiges
Adapterpaket kann diese Host-Freigaben nicht selbst erteilen.

Eine ausschließlich lesende Übersicht erhältst du in PuTTY mit:

```sh
cd /opt/iobroker
npm install-scripts ls
```

Erforderliche native Treiber und optionale Beschleuniger müssen nach tatsächlicher
Paketversion und Herkunft geprüft werden. Keine pauschale Freigabe aller Skripte
und keine globale Abschaltung der Schutzfunktion. Die Versions- und Herkunftsprüfung sowie der passende versionsgenaue Freigabebefehl
stehen in [npm-Installation](docs/unified/NPM_INSTALLATION_DE.md).

Die Meldung `skipping integrity check for git dependency` gehört zur Git-Quelle.
Eine feste Commit-ID und die mitgelieferten SHA-256-Prüfsummen dienen der Zuordnung;
sie sind keine Hersteller-Signatur. Ein veröffentlichtes Registry-Paket verwendet
den npm-Paketintegritätsweg. Die TGZ-Datei ist ebenfalls separat mit ihrer gelieferten
Prüfsumme abzugleichen.
