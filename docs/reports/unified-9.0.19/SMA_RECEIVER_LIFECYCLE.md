# SMA-Speedwire: Empfang und Konfiguration

Stand: 2026-11-24. Vertraulich, NexoWatt. Unabhängige Teilprüfung zum gemeldeten Stillstand von Rohdaten und `LAST_SEEN` nach einem Update.

## Belegter Befund

Der Speedwire-Treiber war vor diesem Fix zwischen 9.0.18 und dem geprüften 9.0.19-Entwicklungsstand identisch. Die Standardverbindung bleibt UDP `239.12.255.254:9522`, gebunden an `0.0.0.0`. Ein angegebenes lokales Interface wird bevorzugt; weitere lokale IPv4-Interfaces werden wie bisher berücksichtigt. Geräte-Host/IP-Filter, Gruppe, Port, Interface, Stale-Zeit und vorhandene weitere Verbindungsfelder werden durch normale Validierung und Altimport erhalten. Ein Konfigurationsverlust wurde in diesen Pfaden nicht reproduziert.

Es bestand jedoch ein realer Empfangs-Lifecycle-Fehler: `_ensureListener()` behandelte einen gespeicherten Hub-Verweis als lebenden Empfänger. Nach fehlgeschlagenem initialem Bind, Socketfehler oder geschlossenem Socket wurde der Empfänger deshalb bei folgenden Geräteabfragen nicht neu aufgebaut. Vorhandene Telegrammwerte und `LAST_SEEN` konnten stehen bleiben. Zusätzlich konnte `disconnect()` während eines laufenden Bind-Vorgangs dessen Abschluss unbegrenzt blockieren; späte Ereignisse eines alten Sockets konnten einen Ersatzempfänger beeinflussen.

## Änderung

In `modules/devices/lib/drivers/speedwire.js`:

- Jede Listener-Sicherung prüft die tatsächliche Hub-Aktivität über das idempotente `start()`; ein fehlgeschlagenes Bind bleibt beim nächsten normalen Geräteabruf wiederholbar.
- Der Subscriber wird vor dem asynchronen Bind registriert. Ein parallel abmeldender anderer Nutzer schließt keinen gerade entstehenden gemeinsam benutzten Empfänger.
- Der letzte Nutzer wartet einen laufenden Bind ab, prüft anschließend die Nutzerzahl erneut und schließt den Empfänger samt Timern.
- `close`/`error` invalidieren nur den zugehörigen aktuellen Socket. Ereignisse eines ersetzten Sockets können weder dessen Nachfolger abschalten noch alte Telegramme als neue Daten einspeisen.
- Ein Watchdog-Neustart öffnet nach Abmeldung des letzten Nutzers keinen neuen unbenutzten Empfänger.
- Ein wegen Bind-Fehler vorübergehend socketloser Hub bleibt registriert, solange weitere Subscriber existieren. Asynchroner Cleanup entfernt außerdem nur den exakt zugehörigen Hub aus der Registry, niemals einen inzwischen eingetragenen Ersatz.

Leistungswerte, Vorzeichen, Telegrammparser, Datenpunktpfade, Konfiguration, Gerätefilter, Soft-Stale-Verhalten und Stellrechte wurden nicht neu definiert. Ein Socket-Neustart erzeugt keine neue Messprobe; `LAST_SEEN` wird weiterhin ausschließlich durch ein gültiges empfangenes Telegramm aktualisiert.

## Tatsächliche Prüfungen

`modules/devices/test/speedwireLifecycle.test.js` verwendet echte lokale UDP-Sockets auf freien Ports sowie passende SMA-Telegramme durch den echten Parser. Die Pakete werden über Loopback gesendet. Die kontrollierte Fehlerprüfung löst zusätzlich ein Socket-Fehlerereignis aus; die Portbelegung und das Schließen sind tatsächliche Socketoperationen.

| Test | Vor dem Fix | Nach dem Fix |
| --- | --- | --- |
| Empfang nach unerwartetem Socket-Close | fehlgeschlagen | bestanden; neue Leistung empfangen |
| Wiederholung nach belegtem UDP-Port (`EADDRINUSE`) | fehlgeschlagen | bestanden nach Freigabe des Ports |
| Fehler, Ersatzsocket und späte Alt-Ereignisse | fehlgeschlagen | bestanden; Ersatzmesswert bleibt gültig |
| Stop während Bind und gemeinsamer Empfänger | Timeout | bestanden ohne verwaisten Listener |
| Erhaltung expliziter SMA-Konfiguration bei Validierung/Altimport | bestanden | bestanden |

Eine zusätzliche unabhängige Review fand im ersten Korrekturstand einen Registry-Randfall: Nach gemeinsam fehlgeschlagenem Bind zweier Subscriber entfernte die Abmeldung eines Nutzers den socketlosen Hub trotz verbliebenem Nutzer. Ein dritter Nutzer konnte anschließend einen zweiten Empfänger für denselben Schlüssel eröffnen. Die neue sechste Regression reproduzierte genau diese Trennung und besteht nach der Korrektur der Registry-Bedingung. Beide verbleibenden Nutzer empfangen jetzt über denselben tatsächlichen UDP-Socket. Ein spätes Alt-Telegramm verändert außerdem weder den Messwert noch `LAST_SEEN` des Ersatzempfängers.

Alle sechs neuen Tests sowie neun vorhandene Runtime-Liveness-Tests bestehen unter Node.js 22 und 24. JavaScript-Syntaxprüfung und vorhandenes Devices-ESLint für den geänderten Treiber bestehen. Der neue Test wird vom bestehenden `test:modules`-Glob eingeschlossen. Der ältere Treiber ist kein vollständig streng typisiertes TypeScript-Modul; hier wird keine darüber hinausgehende Typabdeckung behauptet.

## Aussagegrenze

Der Fehler ist als unabhängiger Empfangsfehler reproduziert und korrigiert. Er beweist noch nicht die Ursache des gleichzeitigen Ausfalls sämtlicher Geräte auf der Kundenanlage. Modulstart, Eigentumsfreigabe und Stop/Start-Übergaben werden separat geprüft. Multicast-Weiterleitung, IGMP, VLANs, echte SMA-Hardware und das Kundennetz wurden mit diesen Loopbacktests nicht geprüft.
