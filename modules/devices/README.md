# NexoWatt Devices in EOS 9.0.6

Das Gerätemodul enthält die bestehenden Geräteprofile und Protokolltreiber aus NexoWatt Devices **0.5.176**. Es startet im EOS-Prozess unter der gemeinsamen EOS-Systemlizenz. Es gibt keine zweite Adapterinstanz und keine zusätzliche Lizenzaktivierung. Die vollständige Geräteverwaltung ist unter `/modules/devices/` über die angemeldete EOS-Administration erreichbar.

## Einrichtung und bestehende Anlagen

1. Den bisherigen Adapter `nexowatt-devices.<Instanz>` in ioBroker deaktivieren. Sein Prozess muss beendet sein. Ein deaktivierter Schalter allein ist kein Nachweis für den Stillstand.
2. In EOS → Geräteverwaltung → **Bestehenden Geräteadapter übernehmen** die Instanz auswählen. Der Import übernimmt die Gerätekonfiguration zunächst deaktiviert. Er ersetzt keine Geräte und löscht keine alten Datenpunkte.
3. Die ausgegebene Pfadzuordnung prüfen. Aus `nexowatt-devices.0.devices.<Gerät>…` wird `eos-admin.0.devices.<Gerät>…` (bei einer anderen EOS-Instanz entsprechend). Geräte-IDs, Profile, Register, Einheiten und relative Alias-Pfade bleiben erhalten. Bestehende EMS-, Skript-, History- und Visualisierungszuordnungen müssen auf die neuen absoluten Pfade umgestellt werden. Die alten Namen werden nicht durch fremde Schreibzugriffe vorgetäuscht.
4. Verbindungen, Gerätepasswörter, Pollingintervalle und Schreibfreigaben prüfen. HTTP-Geräte müssen gültige TLS-Zertifikate verwenden. Für eine private Geräte-CA kann das **öffentliche CA-Zertifikat im PEM-Format** hinterlegt werden. Frühere TLS-Prüfungs-Ausnahmen werden nicht übernommen; Gerät bearbeiten, CA hinterlegen und speichern.
5. Erst anschließend **Gerätemodul aktivieren** und **Speichern und übernehmen** wählen. Die alte Instanz bleibt deaktiviert. Mit einem einzelnen Gerät zunächst Messwert, Vorzeichen, Einheit, Aktualität und eine betrieblich freigegebene kleine Stellgrößenänderung prüfen.

Die Aktivierung prüft serverseitig die EOS-Lizenz und konkurrierende Altinstanzen. Das Modul ist bei der ersten Installation deaktiviert. Geheimnisse bleiben in der vom Host verschlüsselten Konfiguration; die Webansicht erhält Platzhalter und erhält bestehende Werte anhand stabiler Geräte-IDs. Nach dem Bearbeiten eines Geräts sind die Änderungen zusätzlich oben zu übernehmen.

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
