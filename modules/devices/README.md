# NexoWatt Devices in EOS 9.0.7

Das Gerätemodul enthält die bestehenden Geräteprofile und Protokolltreiber aus NexoWatt Devices **0.5.176**. Es startet im EOS-Prozess unter der gemeinsamen EOS-Systemlizenz. Es gibt keine zweite Adapterinstanz und keine zusätzliche Lizenzaktivierung. Die vollständige Geräteverwaltung ist unter `/modules/devices/` über die angemeldete EOS-Administration erreichbar.

## Einrichtung und bestehende Anlagen

Beim Start prüft EOS eine vorhandene eindeutige Instanz von Devices 0.5.176 auf demselben Host. Ist der Zielbereich noch nicht konfiguriert, die zentrale Lizenz gültig und jede Vorprüfung erfolgreich, übernimmt EOS die Einstellungen automatisch. Der alte Prozess wird erst nach vollständiger Vorprüfung gestoppt. Sein bestätigter Stillstand wird abgewartet; ein verschlüsseltes Journal schützt den Ablauf gegen Unterbrechungen. Die Originalinstanz bleibt für einen Rückfall erhalten.

Bei dieser automatischen Übernahme bleibt beispielsweise `nexowatt-devices.0.devices.ess1.power` exakt bestehen. Das integrierte Modul verwendet diese IDs weiter; Aliase, History-Einstellungen und vollständige Datenpunktverweise werden weder kopiert noch umgeschrieben. Gerätepasswörter bleiben in der verschlüsselten Konfiguration. Einstellungen und Credentials aus `protectedNative`, die der Controller nicht bereitstellt, dürfen nicht durch leere Werte ersetzt werden: die Übernahme bleibt dann blockiert, die Altadapter laufen weiter.

Der Status steht unter **Bestandsübernahme** (`/migration/`) und im State `eos-admin.N.info.legacyMigration`. Mehrdeutige Instanzen, andere Hosts/Versionen, unbekannte Profile, TLS-Ausnahmen, vorhandene Zielkonfigurationen und erkannte externe `sendTo`-Verweise blockieren den automatischen Wechsel. Dynamische externe RPC-Aufrufer sind zusätzlich zu prüfen. Dieser konservative Ablauf ist keine Garantie für jede beliebige Bestandsanlage; Details und Rückfallgrenzen stehen in `docs/unified/BESTANDSUEBERNAHME_9_0_7.md`.

Der ausdrücklich gewählte **manuelle Konfigurationsimport** im Geräteeditor bleibt eine Alternative für vorbereitete Anlagen: alte Instanz vollständig stoppen, Konfiguration zunächst deaktiviert importieren und die angezeigten neuen Pfade prüfen. Dieser manuelle Import behält das Verhalten aus 9.0.6 und wechselt auf `eos-admin.N.devices.*`; er führt keine automatische Umstellung von EMS-/Skript-/History-Verweisen durch. Nicht zusätzlich importieren, wenn die automatische Übernahme bereits abgeschlossen ist.

Nach dem Bearbeiten eines Geräts zuerst im Gerätefenster speichern und anschließend oben **Speichern und übernehmen** wählen. Die Konfiguration liegt ab 9.0.7 außerhalb des laufenden Adapter-Instanzobjekts, damit das Speichern keinen EOS-Neustart auslöst. Die Oberfläche erhält ausschließlich Passwortplatzhalter; Werte werden anhand stabiler Geräte-IDs erhalten. Bei einer tatsächlich abgelaufenen Sitzung bleibt der Entwurf sichtbar, eine erneute Anmeldung ersetzt keine ungeprüfte automatische Wiederholung eines Schreibauftrags.

## Protokolle und Grenzen

Enthalten sind Modbus TCP/RTU/ASCII, MQTT, HTTP, Technische Alternative CMI, UDP, Speedwire, M-Bus, 1-Wire, CAN und die vorhandenen Kostal-Schnittstellen. Der Gerätetyp legt die tatsächlich unterstützten Protokolle fest. Serielle Ports benötigen passende Betriebssystemrechte und die vorhandene SerialPort-Laufzeit; CAN benötigt bereits eingerichtete Schnittstellen sowie `candump`/`cansend`. Der Adapter startet weder `sudo` noch eine privilegierte Netzwerkkonfiguration. Frei wählbare CAN-Programme sind gesperrt; 1-Wire verwendet den Kernelpfad `/sys/bus/w1/devices`.

Der Lizenz-/Eigentümerwechsel sperrt neue Ausgaben. Die Prüfung erfolgt zusätzlich bei MQTT-Veröffentlichungen und direkt vor der Ausführung verzögerter serieller Aufträge. HTTP-Anfragen werden beim Stoppen abgebrochen. Bereits auf dem Transport versandte Befehle lassen sich nicht zurückrufen. Geräteeigene Watchdogs und die vorhandenen EOS-Sicherheitsregeln bleiben erforderlich. Bei entzogener Freigabe kann auch der optionale letzte MQTT-Sicherheitswert nicht mehr gesendet werden; das Modul schließt trotzdem Timer und Transport. Deshalb müssen die geräteseitigen sicheren Timeout-Werte vor der Inbetriebnahme eingestellt und geprüft sein.

Die zusätzlichen HTTP-Grenzen betragen höchstens 2 MiB Antwort, 256 KiB Anforderung und eine gemeinsame begrenzte Anfragefrist. Automatische Weiterleitungen sind nicht zugelassen. Private Schlüssel gehören nicht in das CA-Feld.

## Stabilität und Prüfung

Das Modul lädt seinen Katalog einmal bei Bedarf und erzeugt Laufzeitinstanzen nur für konfigurierte aktive Geräte. Es verwendet keine pauschale Subscription auf alle ioBroker-Zustände. Ein erkannter Fehler beim Starten räumt auch bereits angelegte Teillaufzeiten auf. Die Quellfunktion zur globalen Änderung fremder Adapter-`adminUI`-Objekte wurde nicht übernommen.

Die Integration behebt außerdem ein Warteschlangenproblem: Nach einer unterbrochenen seriellen Verbindung durfte ein bereits laufender Auftrag nicht erneut einen Verbindungsauftrag hinter sich selbst einreihen. Verbindungsaufbau erfolgt jetzt vor dem Auftragsblock; unmittelbar vor der Ausgabe werden Verbindung und Freigabe erneut geprüft.

Automatisierte Prüfungen:

```sh
node --test modules/devices/test/*.test.js
npx tsc -p modules/devices/tsconfig.hosted.json
# Zusätzlich auf einem Rechner mit verfügbarem Chromium:
node --test modules/devices/checks/hostedEditor.check.js
```

Enthalten sind übernommene Profil-/Protokollregressionen (u. a. Sungrow, VARTA, DEYE, TESVOLT, Aliase), tatsächlicher lokaler MQTT-Transport mit Testbroker sowie neue Tests für Hosting, Lizenzentzug, Namespace-Zuordnung, Aufräumen und gemeinsam verwendete serielle Warteschlangen. Die vorbereitete browserbasierte Geräteeditor-Prüfung nutzt einen lokalen Testserver. Sie konnte in der Entwicklungsumgebung nicht ausgeführt werden, weil Chromium beim Anlegen seines lokalen IPC-Sockets vom Betriebssystem mit EPERM beendet wird; die visuelle Browserabnahme bleibt offen. Diese Tests sind keine Abnahme an realen Geräten und keine Messung des RAM-Verbrauchs einer Kundenanlage.

`provenance.json` dokumentiert das Quellarchiv und dessen SHA-256-Prüfsumme. `UPSTREAM-LICENSE` enthält die bestehende proprietäre Lizenz. Die Entwicklung richtet sich nach den EOS-Vorgaben; dieses Dokument ist keine CRA-Konformitätserklärung.
