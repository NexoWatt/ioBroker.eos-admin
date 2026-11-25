# Geräte-Stabilität und MQTT-Sitzungsgrenzen – 9.0.21

Stand: 24.11.2026. Ausgangsbasis ist das unveränderte, versiegelte Repository 9.0.20. Die folgenden Änderungen betreffen den MQTT-Treiber und seine Rückrufe in die gemeinsame Geräte-Runtime. Geräteprofile, Register, Alias-IDs, Einheiten, vorhandene Konfigurationen, Leistungsgrenzen, Lizenzfreigaben und ioBroker-Admin-/Backitup-Einstellungen werden nicht verändert. Es wurden keine Kundengeräte kontaktiert und keine physischen Stellhandlungen ausgeführt.

## Befunde und Korrekturen

| Kennung | Reproduzierter Ausgangsfehler | Korrektur und verbleibende Grenze |
| --- | --- | --- |
| **921-DEV-01** | Ein echter lokaler MQTT-Broker nahm einen QoS-1-Sollwert von 681 entgegen, ließ PUBACK aus und trennte TCP. Nach Entzug der Geräteberechtigung verband sich MQTT.js erneut und sendete denselben alten Sollwert erneut; die ursprüngliche Promise meldete Erfolg. Die serverseitige Schreibprüfung wurde beim internen MQTT-Wiederholen nicht erneut durchlaufen. | Jede Transportverbindung erhält einen neuen MQTT-Client mit leerem ausgehendem Speicher. Automatische MQTT.js-Wiederholungen und Offline-QoS-0-Warteschlangen sind deaktiviert. Erneute Verbindung läuft über die bestehende aktuelle EOS-Gerätefreigabe. Offene Transportaufträge werden bei Verbindungsverlust abgelehnt und nicht in die neue Sitzung übernommen. Die vorhandene zusätzliche Frischkommando-Pflicht des gelieferten TESVOLT-Zyklusprofils bleibt erhalten. Client-ID, vorhandene TLS-Einstellungen und Abonnementdefinitionen bleiben erhalten. Bereits auf dem Draht befindliche Befehle lassen sich nicht zurückrufen; eine MQTT-Bestätigung belegt keine physische Gerätewirkung. |
| **921-DEV-02** | Fehlende MQTT-PUBACK-/SUBACK-Antworten besaßen keine Gesamtfrist. Beim Stop wartete der Treiber auf einen optionalen sicheren Publish, bevor seine Transport-Schließfrist überhaupt begann. Der echte TCP-Reproduzierer war nach 1.500 ms weiterhin offen und wartend; erst die anschließend gezielt freigegebene Brokerbestätigung ließ den alten Stop fortsetzen. | Offene Publish-/Subscribe-Aufträge sind sitzungsgebunden und haben 5 s Gesamtfrist. Maximal 64 Publishes stehen gleichzeitig aus. Alle optionalen Safe-Publishes beim Stop teilen ein monotones Gesamtbudget von 1 s, danach höchstens 2 s für den Transportabschluss. Ohne Geräteberechtigung wird auch kein Safe-Publish gesendet. Ein nicht bestätigter Transportabschluss bleibt ein sichtbarer Fehler; es wird kein zweiter Client geöffnet. |
| **921-DEV-03** | Eine vor dem Verbindungswechsel begonnene asynchrone MQTT-Verarbeitung schrieb danach weitere alte Werte. Die unabhängige Zweitprüfung zeigte außerdem, dass ein bereits laufender echter DeviceRuntime-Rückruf nach einer Offline-Meldung wieder verbundene/frische Aliaswerte setzen konnte. | Sitzungsprüfung wird über asynchrone Nachrichtengrenzen bis vor/nach den Runtime-DB-Write fortgeführt. MQTT-Messwert-, Heartbeat- und Verbindungsrückrufe werden geordnet ausgeführt. Bereits abgegebene DB-Schreibvorgänge werden vor endgültigem Offline und Ersatzverbindung abgewartet. Verschachtelte Offline-Rückrufe bleiben möglich, aber nur innerhalb des konkret aktiven FIFO-Tokens; vererbte Timer eines bereits beendeten Tokens können die Warteschlange nicht umgehen. Telemetrie-Rückrufe sind auf 32 begrenzt; Offline-/Stop-Barrieren werden nicht verworfen. Ein hängender DB-Vorgang wird nicht als abgeschlossener Stop ausgegeben. |
| **921-DEV-04** | Bei angehaltenem DB-Schreibabschluss nahm der echte TCP-Eingang fortlaufend weitere MQTT-Nutzlasten in eine unbegrenzte Promise-Kette auf. Auch die Liste entdeckter Wildcard-Topics wuchs ohne Grenze. | Anwendungswarteschlange: höchstens 256 Nachrichten, zusammen 4 MiB Nutzlast, höchstens 1 MiB je Nutzlast. Entdeckte Topics: höchstens 512 je Sitzung. Überschreitung erzeugt einen sichtbaren Fehler, beendet den tatsächlichen Transport, verwirft die alte Sitzungswarteschlange und startet erst nach deren Abfluss erneut. Nachrichten werden nicht still zusammengefasst. Die Discovery-Liste beginnt pro Sitzung neu. Das sind Anwendungs-/Backloggrenzen: MQTT.js hat das Paket vor dem `message`-Ereignis bereits geparst. Daraus folgt kein vollständiger Vorparser- oder RSS-Speicherhöchstwert. |

## Unverändert erhaltene Funktionen

- TESVOLT: automatische Erkennung EMS/V2 gegenüber EMS, exakte Topic-ACL-Ausweichabonnements, Monitoring ohne Schreibfreigabe, vollständige Steuerpayloads, vorhandene dynamische Leistungsgrenzen, gesonderte frische Steuerfreigabe nach Wiederverbindung.
- MQTT: stabile Client-ID, konfigurierte Zugangsdaten und Zertifikatsprüfung, vorhandene Datenpunktabbildung, Reihenfolge angenommener Nachrichten, erneute Abonnements und Wiederverbindungsabstand; `reconnectPeriodMs: 0` deaktiviert weiterhin die Wiederverbindung.
- Gemeinsame Geräte-Runtime: vorhandene Modbus-/SolaX-/FENECON-/Speedwire-/CANbus-Abläufe bleiben im Regressionstestumfang. Keine neue oder vermutete Registeradresse und kein zusätzlicher MQTT-Befehl für eine reale Anlage wurde eingeführt.

## Geänderte Produktdateien

- `modules/devices/lib/drivers/mqtt.js`: Sitzungen, Bestätigungsfristen, Stop und Überlastreaktion.
- `modules/devices/lib/drivers/mqttPendingOperations.js`: neuer streng typgeprüfter Helper für begrenzte Aufträge, Sitzungsprüfung und geordnete Rückrufe; nur Node.js-Bordmittel.
- `modules/devices/lib/deviceRuntime.js`: Rückrufreihenfolge und Schutz bereits laufender DB-Schreibvorgänge. Die historische Gesamtdatei wird nicht als vollständig streng typgeprüft ausgegeben.
- `modules/devices/tsconfig.mqtt-lifecycle.json`: verbindliches Strict-/checkJs-Profil des neuen Helpers. Keine neue Laufzeitabhängigkeit.

## Nachweise

Die unveränderte 9.0.20-Basis reproduziert die Fehler auf Node.js 22.23.4 und 24.22.3. Die Protokolltests nutzen tatsächliche MQTT.js-5.16.1-TCP-Verbindungen zu einer lokalen Testgegenstelle. Ausgelassene Brokerbestätigungen, verlorene Verbindungen, Rechteentzug, gezielt verzögerte DB-Abschlüsse und Überlast werden kontrolliert ausgelöst. Runtime- und Queue-Tests nutzen die tatsächliche DeviceRuntime mit einem kontrollierten ioBroker-Schreibabschluss. Das sind Software-/Protokollnachweise, keine Hersteller-Hardwareprüfung.

| Finale Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| Gesamte Geräte-Testsuite (`modules/devices/test/*.test.*`) | **316/316 bestanden**, jeweils auf Node.js 22.23.4 und 24.22.3; keine Skips |
| Darin gezielte MQTT-Transport-/Runtime-/Überlast-/TESVOLT-Fälle | **25/25 bestanden**, zusätzlich unabhängig auf beiden Laufzeiten geprüft |
| Neuer Helper, strenges `checkJs` | Bestanden auf beiden Laufzeiten mit TypeScript 6.0.3 und `tsconfig.mqtt-lifecycle.json` |
| ESLint MQTT-Treiber, Helper und drei neue Testdateien | Keine Fehler oder Warnungen auf beiden Laufzeiten |
| ESLint historische Gesamtdatei `deviceRuntime.js` | Vorher/nachher identische 37 Altbefunde: 8 `no-unused-vars`, 27 `no-empty`, 1 `no-control-regex`, 1 `no-useless-catch`; ausdrücklich keine vollständige Lintfreigabe dieser Altdatei |
| Native Testrechte | Linux x64, UID 1000, keine Root-Ausführung |

Der abschließende Node-22-Gesamtlauf wurde nach der letzten Änderung am Drain-Fehlerpfad wiederholt. Vorherige Läufe sind getrennt bezeichnet. Produkt- und Testdateihashes stehen in `raw/device-mqtt/source-hashes.json`.

Finale Testergebnisse und Befehle stehen in `raw/device-mqtt/commands-final.json`, `all-devices-final-node22.log` und `all-devices-final-node24.log` geführt. Der neue unabhängige Runtime-Test liegt unter `modules/devices/test/mqttRuntimeSession.test.js`; die getrennte Zweitprüfung dokumentiert ihren eigenen Umfang und ihre Rohbelege zusätzlich.

Vorherige fehlgeschlagene Zwischenprüfungen bleiben erhalten: zunächst ein Node-22-Test, der die neue SUBACK-Wartephase noch nicht abwartete; anschließend ein Test, der vor Freigabe des alten DB-Writes bereits eine Ersatzverbindung erwartete. Letzteres widersprach dem neu abgesicherten Drain-Vertrag. Die Wartebedingungen wurden anhand des tatsächlichen Ereignisablaufs berichtigt; produktive Fristen, Freigaben und Assertions wurden nicht abgeschaltet. Der unabhängige Review reproduzierte außerdem die geerbte ALS-Token-Umgehung und prüfte anschließend die Korrektur.

## Einordnung für Inbetriebnahme und Sicherheitsnachweise

Die Änderungen liefern konkrete Nachweise für geordneten Wiederanlauf, aktuelle Geräteberechtigung, begrenzte ausstehende Arbeit und den Erhalt von Datenpunktverträgen. Sie sind Bausteine der EOS-Sicherheits-/CRA-Unterlagen und keine Konformitäts- oder Zertifizierungsbescheinigung.

Eine reale MQTT-/TESVOLT-Anlage bleibt separat zu prüfen: Verbindungsverlust, Wiederanlauf mit neuen Messwerten, zeitlich begrenzter Geräte-Fallback, konkrete Gateway-ACL/TLS-Konfiguration und physische Reaktion auf einen neu freigegebenen Sollwert. Für SolaX bleiben die konkrete Modell-/Firmwarekombination und der echte Schreib-/Readback-Pfad maßgeblich; dieser MQTT-Fix ersetzt diesen Hardwarebeleg nicht. Ein festhängender Datenbank-Schreibauftrag kann nicht softwareseitig zurückgerufen werden; der Adapter darf dann keinen abgeschlossenen Zustandswechsel oder parallelen Ersatzbetrieb vortäuschen.
