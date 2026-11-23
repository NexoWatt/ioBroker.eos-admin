# Gehostete UI: bestätigter Stopp vor Rückübergabe

Stand: 23.11.2026, NexoWatt EOS 9.0.11. Dieser Vermerk betrifft den lokalen UI-Lebenszyklus und dessen Stop-Vertrag; die übergeordnete Migration wird gesondert geprüft.

## Ausgangslage und Änderung

`createHostedRuntime.stop()` bestätigte bisher den ersten `onUnload`-Callback, obwohl `startServer()` oder `onReady()` noch liefen. Ein später Startabschluss erhielt lediglich einen weiteren unbeobachteten Cleanup-Aufruf. Eine Migration durfte diesen vorzeitigen Stop-Erfolg deshalb nicht als Beleg für die sichere Wiederaktivierung der alten Regelung verwenden.

Die neue Koordination setzt zunächst synchron und dauerhaft die lokale Start- und Schreibsperre. Sie bereinigt vorhandene Ressourcen, wartet die bereits begonnenen Shell- und Betriebsstarts sowie die angenommenen Controller-Schreibaufträge ab und wartet anschließend die finale Bereinigung ab. Erst dann wird der Stop bestätigt. Auch ein bereits eingeplanter Shell-Microtask prüft die Sperre vor dem Start. Gleichzeitige Stop-Aufrufe erhalten dasselbe Ergebnis.

Die Gesamtgrenze beträgt 4.000 ms. Ein hängender Start, ein nicht bestätigtes Cleanup oder eine Cleanup-Ausnahme ergeben `EOS_UI_STOP_UNCONFIRMED`. Das bleibt auch dann das Ergebnis, wenn der Start später endet. Ein später Abschluss erhält trotzdem seine finale Bereinigung. Der Status unterscheidet `stopping`, bestätigtes `stopped` und `stop-unconfirmed`; Bereitschaft und Schreibfreigabe bleiben nach jedem Stop-Aufruf gesperrt. Ein Fehler des bereits beendeten Startversuchs verhindert einen bestätigten Stop nicht, wenn beide Bereinigungen erfolgreich abgeschlossen wurden.

Der neue strikt typisierte Helfer liegt in `ui/src-ts/runtime-executables/lib/hosted-runtime-stop.ts`. `hosted-adapter.ts` erfasst die vier Foreign-State-Schreibmethoden vor der Controllerübergabe. Auch alle vier lokalen Schreibaliasse werden mit korrekt qualifiziertem Datenpunkt durch diese Erfassung geleitet, sowohl bei gleichem Namespace als auch bei übernommenem Alt-Namespace. Die ursprünglichen Promise-/synchronen Rückgabewerte sowie Callback-Kontext und -Argumente bleiben erhalten. Ein intern ergänzter Callback erlaubt die Beobachtung auch ohne Callback des Aufrufers. Gibt die Callback-API zusätzlich ein Promise zurück, müssen beide abgeschlossen sein. Ein Callbackfehler oder abgelehntes Promise ist ein bestätigter Abschluss, aber kein erfolgreicher Schreibauftrag. Fehlende Bestätigung oder eine synchrone Ausnahme nach möglicher Übergabe bleiben unklar.

Die Erfassung erlaubt höchstens 1.024 gleichzeitig offene Host-Schreibaufträge. Weitere Aufträge werden mit `EOS_UI_WRITES_BUSY` vor der Übergabe abgewiesen; es gibt weder Warteschlange noch automatische Wiederholung. Abgeschlossene Einträge werden entfernt, ohne pro Schreibauftrag einen Timer anzulegen. `stopStateWrites()` schließt die Annahme dauerhaft; die gemeinsame Stop-Deadline bewertet einen nicht abgeschlossenen Drain als unbestätigt.

`onUnload` beobachtet nun tatsächlich zurückgegebene Promises der vorhandenen Unterdienst-Stopps und gibt Fehler an den Stop-Koordinator weiter. Synchrone Stopps werden weiterhin sofort aufgerufen. Die bestehenden Betriebsarten, Lizenzprüfung und gerätespezifischen Schutzpfade werden nicht geändert. Das globale ioBroker-Unload-Callback ist keine Bestätigung dieses Stop-Vertrags.

## Prüfungen

Die elf Tests in `ui/test/unified/hosted-runtime-stop.test.cjs` prüfen den wirklichen kanonischen Factory-Code mit kontrolliert verzögerten Start- und Cleanup-Funktionen sowie den strikt typisierten Helfer:

- Warten auf beide Startversuche und finale Bereinigung.
- Erfolgreicher Stop nach bereits abgeschlossenem fehlgeschlagenem Start.
- Timeout mit später Bereinigung und dauerhaft abgelehntem Ergebnis.
- Synchrone Cleanup-Ausnahme, abgelehntes Cleanup und ausbleibende Bestätigung.
- Stop vor dem Shell-Microtask; kein nachträglicher Shell-Start.
- Verzögerter Betriebsstart, gesperrte reale HostedAdapter-Schreibmethode und weiterhin gesperrter Router.
- Verzögerter Shell-Start mit finaler Bereinigung.
- Timeout im tatsächlichen Hosted-Runtime-Wrapper einschließlich dauerhaftem Fehlerstatus.
- Tatsächlich angenommene Host-Schreibaufträge verzögern die Stop-Bestätigung.
- Das reale `onUnload` wartet asynchrone Unterdienst-Stopps ab und meldet deren Fehler.
- Hängende Unterdienst-Stopps und Host-Schreibaufträge bleiben unbestätigt.

Neun ergänzende Tests in `hosted-adapter-drain.test.cjs` prüfen beide Namespacefälle und alle lokalen Schreibaliasse, die Foreign-Async-Methoden, originale Rückgabewerte, Callback-Kontext und -Fehler, die Kombination von Promise und Callback in beiden Abschlussreihenfolgen, die 1.024-Aufträge-Grenze ohne zusätzlichen Dispatch, unklare Übergaben sowie die dauerhafte Sperre nach dem Stop.

Der vorhandene Test in `hosted-runtime.test.cjs` wurde auf den korrekten Vertrag angepasst: Ein Stop während eines laufenden Shell-Starts darf erst nach dessen Ende erfolgreich sein. Die neue Testdatei prüft die kanonischen Quellen; die bestehenden zehn Tests prüfen zusätzlich die zentral gebaute Laufzeit.

| Prüfung | Ergebnis | Rohbeleg |
| --- | --- | --- |
| Node.js 22.23.4, alle drei Testdateien | 30/30 bestanden | `raw/hosted-ui-runtime-node22.log` |
| Node.js 24.22.3, alle drei Testdateien | 30/30 bestanden | `raw/hosted-ui-runtime-node24.log` |
| Strict TypeScript, `ui/tsconfig.hosted-runtime-stop.json` | Exit 0 | `raw/hosted-ui-stop-typecheck.log` |
| Typinformiertes ESLint, `ui/eslint.hosted-runtime-stop.config.mjs` | Exit 0 | `raw/hosted-ui-stop-lint.log` |
| Strict TypeScript, `ui/tsconfig.hosted-adapter.json` | Exit 0 | `raw/hosted-adapter-drain-typecheck.log` |
| Typinformiertes ESLint, `ui/eslint.hosted-adapter.config.mjs` | Exit 0 | `raw/hosted-adapter-drain-lint.log` |

Ausgeführt: `node --test ui/test/unified/hosted-runtime.test.cjs ui/test/unified/hosted-runtime-stop.test.cjs ui/test/unified/hosted-adapter-drain.test.cjs` mit dem jeweiligen Node-Binary sowie `node node_modules/typescript/bin/tsc -p ui/tsconfig.hosted-runtime-stop.json`, `node node_modules/typescript/bin/tsc -p ui/tsconfig.hosted-adapter.json` und die jeweils zugehörigen typinformierten ESLint-Konfigurationen.

SHA-256 des geprüften Stop-Helpers: `2cf60c02b437d75b38cbde776a02891af4aa37410c90b3c9e7961609632ca67a`. SHA-256 von `hosted-adapter.ts`: `db9b5032a256b1e664cdcf2093b592908b9bcd0dab348ad9f21b480618a7d440`. SHA-256 der geprüften kanonischen `main.ts`: `cd098e757ba30517a1d6986f3474f6665816607d61d43797c74dcab030bb053c`. Spätere Release-Nachweise müssen den endgültigen Gesamtstand erneut binden.

## Grenzen und offene Anlagenprüfung

Die Tests sind lokale Softwaretests mit verzögerten Fixture-Starts, keine Geräteabnahme und keine bestätigte Live-Migration einer Kundenanlage. Die Stop-Bestätigung umfasst die erfassten Shell-/Betriebsstart-Promises, die Controller-Completion der angenommenen State-Schreibaufträge und die zurückgegebenen Abschluss-Promises der Unterdienst-Stopps. Ein Unterdienst, der intern weitere Arbeit startet und keine Completion zurückgibt, wird dadurch nicht pauschal nachweisbar beendet. Ebenso bleibt die bestehende SmartHome-Puls-Rücksetzung beim Unload eine gesondert zu prüfende Betriebsgrenze: Der lokale Schreibschutz kann solche nachträglichen Rücksetzversuche verwerfen. Eine Controller-Completion ist keine physische Gerätequittung; dieser Vermerk behauptet keine garantierte Transportstilllegung.

Vor einer allgemeinen Freigabe ist die koordinierte Übergabe mit den tatsächlich vorhandenen Geräte-/EEBUS-/Backup-Versionen, TLS-Startfehlern, Controller-Neustart und dokumentierter Rückfallprüfung auf der vorgesehenen Anlage zu erproben. Bei unbestätigtem Stop darf die Migration die alte Regelung nicht automatisch wieder starten.
