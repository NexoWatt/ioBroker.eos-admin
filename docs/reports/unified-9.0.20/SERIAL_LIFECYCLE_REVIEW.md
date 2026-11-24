# Modbus-Transportwechsel und gemeinsamer serieller Anschluss – 9.0.20

Stand: 24.11.2026. Geprüfte Ausgangsbasis 9.0.19; gezielte Korrektur im Lieferstand 9.0.20. Keine Verbindung zu Kundengeräten, keine geänderten Registerzuordnungen oder Freigaben.

## Bestätigter Befund EOS-920-SERIAL-01

Priorität hoch für geordnetes Stoppen und Wiederanlaufen. RTU und ASCII entfernten bei der letzten Referenz ihren Bus sofort aus der Registrierung. `releaseBus()` wartete nicht auf die bereits laufende Öffnung und anschließende Schließung. RTU wartete zudem nicht auf den Schließ-Callback. Damit konnte ein Ersatzbus denselben Anschluss öffnen, bevor der alte Bus tatsächlich geschlossen war. Auch unterschiedliche Baudraten oder RTU gegenüber ASCII besaßen bisher voneinander unabhängige Registrierungen für denselben Anschluss.

Der separat erhaltene Reproduzierer gegen unverändertes 9.0.19 meldet `releaseAwaitable:false`, `closeCallsBeforeReplacement:0`, `newBusWhileOldOpenPending:true`, `concurrentPendingOpens:2`. Ausgeführt wurden die tatsächliche RTU-Busimplementierung und kontrollierte Transport-Callbacks; das ist kein Hardwaretest.

## Korrektur und Grenzen

- Identisch konfigurierte Geräte teilen weiterhin einen Bus. Das Freigeben einer einzelnen Referenz beendet die Verbindung anderer Teilnehmer nicht.
- Die letzte Freigabe sperrt neue Anforderungen synchron und wartet auf Warteschlange, eventuell noch laufende Öffnung und bestätigte Schließung. `ModbusDriver.disconnect()` erwartet diese Freigabe und reicht einen Schließfehler an die vorhandene Stoppproof-Prüfung weiter.
- Der neue kleine gemeinsame Helper `modbusSerialLease.js` hält den normalisierten konfigurierten Pfad pro Prozess über RTU, ASCII und abweichende Einstellungen exklusiv. Konflikte melden `E_MODBUS_SERIAL_PORT_BUSY`; ein noch schließender identischer Bus meldet `E_MODBUS_SERIAL_CLOSING`.
- Fehlt nach 2,5 Sekunden die Bestätigung, wird `E_MODBUS_SERIAL_STOP_TIMEOUT` zurückgegeben und `EOS_MODBUS_SERIAL_STOP_UNCONFIRMED` protokolliert. Die Reservierung bleibt bestehen. Nur eine tatsächlich später erfolgreiche Schließung gibt sie frei; ein fehlgeschlagener Schließ-Callback wird nicht als erfolgreicher Stopp behandelt.
- Die Reservierung ist ausdrücklich kein Betriebssystem-Lock und keine Aussage über andere Prozesse, gleiches Gerät unter unterschiedlichen Symlink-Pfaden oder fremde Adapter. Hier bleiben Betriebssystem/serieller Treiber zuständig. Es werden keine privilegierten Hoständerungen und keine neuen Abhängigkeiten eingeführt.

Geänderte Dateien: `modules/devices/lib/drivers/modbusRtuBus.js`, `modbusAsciiBus.js`, neuer `modbusSerialLease.js`, neuer Test `modules/devices/test/modbusSerialLifecycle.test.js`. Im vorhandenen `serialOperationGate.test.js` werden die drei Freigaben nun erwartet, damit Schließfehler den Test tatsächlich fehlschlagen lassen. Die Integration im `modbus.js` gehört zur separat dokumentierten Treiberkorrektur.

## Nachweise

| Prüfung | Ergebnis |
| --- | --- |
| Neue serielle Lebenszyklusfälle | 9 Fälle: gemeinsamer Bus, letzte Referenz, laufende Öffnung, bestätigter Schluss, Fehler, fehlender Callback, späte Bestätigung, andere Baudrate, RTU/ASCII-Konflikt |
| Neue serielle Tests zusammen mit Modbus-Leseintegrität, Lesefreigabe und Verbindungswechsel | Node 22.23.4 und 24.22.3 jeweils 54 bestanden, keine Fehler/Skips |
| Bestehende drei serielle Freigabe-/Warteschlangentests nach Umstellung auf erwartete Freigabe | Node 22 und 24 jeweils 3 bestanden |
| ESLint der drei seriellen Produktdateien | Bestanden |
| Strict `checkJs` des neuen Lease-Helpers mit Node-Typen | Bestanden; erster separater Aufruf ohne Node-Typen schlug an fehlenden Node-Umgebungstypen fehl, korrigierter Befehl und beide Logs erhalten |

Rohlogs, tatsächliche Befehle, Startzeiten, Laufzeiten, Exitcodes und Hashes liegen in `raw/isolation/`. Kontrollierte Callback-Tests können reale RS485-Adapter, Betriebssystemtreiber, Leitungen, Terminierung und angeschlossene Geräte nicht ersetzen. Ein echter serieller Inbetriebnahmetest steht aus. Keine allgemeine Produktionsfreigabe aus diesen Einzelprüfungen ableiten.

## Unabhängige zweite Prüfung der TCP-/SunSpec-Korrektur

Die aktuelle Änderung von `modbus.js` wurde unabhängig gegen 9.0.19 gelesen und in obige gemeinsame Regression aufgenommen. Die bestätigten Fehler sind korrigiert: ein abgebrochener alter Verbindungsaufruf darf eine neue Sitzung nicht als getrennt markieren; alte TCP-Bereinigung bleibt an ihren Client gebunden; abgebrochene SunSpec-Erkennung wird nicht als fertig zwischengespeichert; Timeout-Wiederherstellung und Modellübernahme prüfen Generation und Clientidentität.

Ein zusätzlicher kleiner Reproduzierer führt die tatsächliche SunSpec-Erkennung aus. Vorher: Freigabefehler, dennoch `discovered:true`, kein erneuter Probeaufruf, Basis bleibt unbekannt. Nachher: `discovered:false` nach Abbruch; erneute erlaubte Probe wird ausgeführt und bestätigt Basis 40000. Keine weitere reproduzierte Blockade im erneut geprüften Diff gefunden. Die Probeantworten sind kontrolliert, kein realer SunSpec-Wechselrichter wurde geprüft.
