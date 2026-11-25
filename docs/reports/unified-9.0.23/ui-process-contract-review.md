# UI-/EMS-Prozess: unabhängige Vertragsprüfung

Prüfstand: Arbeitsstand 9.0.23, 25.11.2026. Geprüft wurden `src/lib/eosUiProcess.ts`, `eosUiProcessWorker.ts` und `eosUiProcessRpc.ts`. Die Prüfung änderte keine Produktdateien; Korrekturen erfolgten durch den zuständigen Implementierungsagenten.

## Ausgeführter Nachweis

`test/eos-ui-process-review.test.cjs` startet echte Node-Unterprozesse mit dem aktuellen IPC- und Supervisor-Code. ioBroker-Controller, Geräte, Kennwörter und Historienantworten sind synthetische Test-Doubles; es findet keine Gerätekommunikation statt.

| Fall | Node 22.23.4 | Node 24.22.3 |
| --- | --- | --- |
| `checkPassword` erhält Ergebnis und kanonischen Benutzernamen vollständig | bestanden | bestanden |
| Historienantwort nach 2,3 Sekunden bleibt lesend und erreicht den Callback | bestanden | bestanden |
| Physischer Schreibauftrag läuft während 2,4 Sekunden blockiertem Parent ab und wird nach Erholung nicht nachgesendet | bestanden | bestanden |
| Später Read-Abschluss einer alten Generation kann den Ersatzprozess nicht beenden | bestanden | bestanden |
| 17-MiB-Read-Antwort wird mit begrenztem Fehler abgelehnt; PID und Generation bleiben erhalten | bestanden | bestanden |
| SIGKILL des Supervisors beendet den tatsächlich gestarteten Runtime-Unterprozess | bestanden | bestanden |

Ergebnis: **6/6 Fälle je Node-Version bestanden**. Rohprotokolle: `ui-process-review-node22.tap` und `ui-process-review-node24.tap` in diesem Verzeichnis. Node 22 meldete zusätzlich die bereits durch die Testumgebung aktivierte experimentelle `EnvHttpProxyAgent`-Warnung; kein Test wurde deshalb übersprungen.

## Im Review geschlossene Befunde

- Callback-Transport ließ ursprünglich den von der Passwortprüfung benötigten Benutzernamen weg.
- Lesende `sendTo(..., 'getHistory', ...)`-Anfragen unterlagen zunächst derselben kurzen Frist wie physische Schreibbefehle.
- Ein nach Prozessende fertig gewordener RPC konnte zunächst über den globalen Fehlerpfad den Ersatzprozess beenden.
- Eine zu große Controller-Antwort beendete zunächst den gesamten UI-/EMS-Prozess. Jetzt erhält nur der betroffene Aufruf einen kleinen `EOS_UI_PROCESS_RESPONSE_LIMIT`-Fehler.
- Die gemeinsame Subscription-Bereinigung wurde gegen parallele Stop-/Exit-Aufrufer abgesichert; die verbleibende Start/Stop-Grenze wurde zusätzlich im Code geprüft.

## Grenzen

Dies ist ein automatisierter Prozess-/IPC-Vertragsnachweis mit ergänzender Codeprüfung, keine Hardware-, Last-, Langzeit- oder vollständige Sicherheitsabnahme. Die bisherige UI und ihre EMS-Logik teilen weiterhin einen eigenen Adapterprozess; ihre interne gegenseitige Isolation wird damit nicht behauptet. Der Admin-/HTTPS-Prozess ist davon getrennt. Endgültiger Paketbuild, vollständige Regression und Feldabnahme gehören zum übergeordneten Prüfbericht.
