# Unabhängige Prüfung der Prozesssteuerung

Stand: 25.11.2026, Recovery-Arbeitsstand 9.0.25. Review durch einen anderen Agenten als den Implementierungsverantwortlichen. Dieser Review änderte keine Produktdateien; ergänzt wurden die unabhängige Testdatei, dieser Bericht und die Rohprotokolle.

Geprüfter Bereich: `EosRuntimeControl`, Runtime-Konfigurationsspeicher, `EosModuleHost.controlProcess`, UI-Prozess `pause`/`resume`, Web-Einbindung, neuer HTTP-Steuerungsendpunkt, Shutdown-/Drain-Einbindung und begrenzte Ressourcenhaltung. Keine allgemeine RAM-Umstrukturierung, Änderung der EMS-Intervalle oder physische Geräteprüfung.

## Befunde und Umsetzung

| Befund | Korrektur / Nachweis |
| --- | --- |
| `enabled:true` wurde vor dem Stop gespeichert; die Sperre bei unbestätigtem Stop lebte nur im RAM. Nach Neuaufbau des Dienstes ging diese Sperre verloren. | Enable/Restart speichert zuerst dauerhaft `enabled:false`. Erst nach bestätigtem Stop/Drain folgt ein zweiter CAS-Commit mit `enabled:true`. Ein Stopfehler oder `close()` während Stop/Commit lässt den Zielprozess dauerhaft deaktiviert. Unabhängig durch Neuaufbau eines zweiten Dienstes aus denselben DB-Objekten geprüft. |
| Der neue Konfigurationsread konnte vor HTTP-Listen unbegrenzt warten und somit die Admin-Diagnose verhindern. | Initialisierung hat eine maximale Readfrist von fünf Sekunden. Bei Fehler bleibt die Prozessfreigabe gesperrt und ein konkreter Diagnosecode verfügbar; die Initialisierung kehrt zurück. Ein verspäteter DB-Read darf keine Prozesse freigeben. Unabhängiger Test mit absichtlich ausstehendem Read und später Auflösung bestanden. Die tatsächliche gesamte Web-Bootkette mit hängendem Controller wurde in dieser Reviewdatei nicht gestartet. |
| Der neue Control-POST prüfte Berechtigung nur vor dem JSON-Parser. Ein langsamer Body konnte Session-/Rollen-/CSRF-Widerruf während des Einlesens überbrücken. | Zweiter vollständiger Guard direkt nach dem Parser und vor Auftragsannahme. Drei echte HTTP-Tests halten den Body nach dem ersten vollständigen Guard an und widerrufen anschließend Session, Adminrolle beziehungsweise CSRF-Freigabe. Ergebnis jeweils 401/403, keine angenommene Prozessaktion. Die Authentifizierungsquelle ist im Test kontrolliert; Express-Route, Parser und TCP/HTTP-Verbindung sind echt. |
| UI-Pause während noch laufender Initialisierung konnte vor deren tatsächlichem Abschluss als fertig erscheinen. | Der Implementierungsverantwortliche ergänzte das Abwarten der gestarteten Initialisierung. Unabhängig gelesen: Pause sperrt sofort Schreib-/Neustartfreigabe, wartet PID-Ende, Initialisierung, angenommene Writes und Subscription-Cleanup; Resume verlangt abgeschlossenen Stop und erzeugt einen neuen Child. Terminales Stop bleibt terminal. Bestehende reale UI-Prozesstests einschließlich Pause/Resume und Write-Drain wurden unabhängig ausgeführt. |

`close()` sperrt neue Kontrollaufträge synchron und liefert eine Promise für den bereits angenommenen Auftrag. Die normale Admin-Unload-Strecke nimmt diesen Drain neben die Worker-Stops auf. Die vorhandene begrenzte ioBroker-Unload-Frist bleibt bestehen; ein erzwungenes Prozessende wird dadurch nicht zu einer nachträglichen physischen Gerätebestätigung erklärt.

Weitere geprüfte Grenzen:

- Nur feste interne Prozess-IDs; Admin-Prozess und externe `ocpp21.N`-Instanzen sind keine steuerbaren Ziele dieses Endpunkts.
- Aktionen verändern einen getrennten, geschützten Runtime-Konfigurationsdatensatz und überschreiben keine Geräteprofile, Migrationziele oder Namespace-Zuordnung.
- Globale Revision/CAS und ein laufender Auftrag begrenzen konkurrierende Aktionen. Ein Browserabbruch beendet nicht den angenommenen Auftrag oder dessen Sperre.
- Enable/Restart erfordern weiterhin Migration-, Lizenz-, Ownership- und Modulkonfigurationsfreigabe. Disable bleibt hinter normalen Startgates möglich. Ungültige oder nicht lesbare Runtime-Konfiguration wird nicht still als „alle an“ interpretiert.
- Generation, bestätigtes Prozessende und bereits angenommene Controller-Schreibvorgänge bleiben Grenzen für einen Ersatzprozess. Die UI und das EMS befinden sich weiterhin gemeinsam in einem Child; die Beschriftung behauptet keine zusätzliche Trennung innerhalb dieses Prozesses.

## Ressourcenprüfung im geänderten Kontrollpfad

Der Controlservice führt keinen zusätzlichen periodischen Poll ein. Er hält höchstens eine Initialisierungs-Promise, einen angenommenen Auftrag und feste Zustände für fünf Prozess-IDs. Fehler und Inhibit-Set sind durch diese feste ID-Menge begrenzt. Die Read-Deadline wird aufgeräumt; ein verspäteter Read erzeugt keine wiederholten Hintergrundversuche. Die HTTP-Gesundheitsabfrage behält ihre Zusammenfassung gleichzeitig laufender Reads bei.

UI-Pause löscht Heartbeat-/Restarttimer und schließt aktive HTTP-Anfragen; Abos werden nach tatsächlichem Erwerb freigegeben. Die neuen Steuerelemente erfordern keine schnelleren EMS- oder Messintervalle. Kein weiterer konkreter Timer-/Speicherblocker wurde in diesem lokalen Pfad gefunden. Separate Node-Prozesse besitzen eigene Laufzeitspeicher; dieses Review enthält keine gemessene RAM-Ersparnis und keine RAM-Garantie.

## Ausgeführte unabhängige Tests

| Lauf | Node 22.23.4 | Node 24.22.3 |
| --- | ---: | ---: |
| Eigene `test/eos-runtime-controls-review.test.cjs`: Transaktionen, verspätete Reads/Writes, dauerhafte Pause, HTTP-Widerrufe | 9/9 | 9/9 |
| Controlservice + UI-Prozess-/Operational-Suiten, einschließlich der ersten sechs unabhängigen Reviewfälle | 35/35 | 35/35 |

Die Zahlen überschneiden sich: Sechs Reviewfälle sind im 35er-Lauf bereits enthalten. Es sind nicht 44 unterschiedliche Tests je Node-Linie. Alle genannten Läufe haben null fehlgeschlagene und null übersprungene Tests. Die drei zusätzlichen HTTP-Fälle entstanden nach dem 35er-Lauf und wurden anschließend in der vollständigen 9er-Datei auf beiden Node-Linien ausgeführt.

Kommandos, jeweils mit dem entsprechenden Node-Binary im Repository:

```sh
node --test test/eos-runtime-controls-review.test.cjs

node --test --test-concurrency=2 \
  test/eos-runtime-control.test.cjs \
  test/eos-runtime-controls-review.test.cjs \
  test/eos-ui-process.test.cjs \
  test/eos-ui-process-review.test.cjs \
  test/eos-ui-operational-process-review.test.cjs
```

Der zweite Befehl enthält beim erneuten Lauf nach Ergänzung der drei HTTP-Fälle entsprechend mehr Tests. Die hier dokumentierten historischen Ausgaben sind unverändert unter `raw/runtime-review/` abgelegt.

## Ergebnis und Grenzen

Die konkret gemeldeten Kontrollpfad-Befunde sind im geprüften Stand geschlossen; aus diesem unabhängigen Review bleibt kein bestätigter Blocker offen. Die Kontroll- und HTTP-Tests verwenden eine synthetische Controllerdatenbank beziehungsweise kontrollierte Authquelle. Die UI-Suiten starten echte Betriebssystem-Childprozesse und tatsächliche UI-/EMS-Methoden mit Test-Owner. Raspberry Pi, produktiver ioBroker-Controller, reale Wallboxen und sonstige physische Geräte wurden hier nicht bedient.

Die vom Implementierungsverantwortlichen zusätzlich angelegte Devices-/OCPP-Kontrollprozesssuite ist nicht in diesen unabhängigen 9er-/35er-Zahlen enthalten. Vollständiger Releasebuild, gesamte Regression und Bedienprüfung werden separat integriert. Dieser Bericht behauptet weder vollständige Ausfallsicherheit noch eine unabhängige elektrische Schutzfunktion durch eigene PIDs.

## Ergänzender Quellreview: erneute Anmeldung bei pausierter UI

Der nachfolgende Recovery-Loginfix wurde unabhängig anhand von `src/lib/web.ts`, `src/lib/eosModuleHttp.js` und `ui/src-ts/runtime-executables/www/login.ts` geprüft. Kein bestätigter Blocker: Die vorhandene Loginseite und ihre fest benannten öffentlichen Abhängigkeiten werden im Parent bereitgestellt, mit Originprüfung und Sicherheitsheadern. Es wurde kein beliebiger Asset-/Dateipfad freigegeben. Status und reguläre Anmeldung bleiben Parent-Funktionen; `/runtime/` bleibt Admin vorbehalten. Eine Kiosksitzung ersetzt die erneute Adminanmeldung nicht. Der erlaubte Rücksprung nach `/runtime/` setzt eine bestätigte Adminrolle voraus und akzeptiert keine fremde URL.

Bei abgelaufener Sitzung werden die Steuerelemente gesperrt; ein erneuter Aufruf der Prozessseite führt zum Parent-Login. Eine automatische Weiterleitung bei Ablauf ist damit nicht behauptet. Diese Ergänzung ist ein Quellreview, ohne eigene zusätzliche Login-Testläufe oder Produktänderungen; die oben genannten Testzahlen wurden dafür nicht erhöht.
