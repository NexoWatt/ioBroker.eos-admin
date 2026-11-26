# Modul-Lebenszyklus und Ereignisarbeit – 9.0.26

## Befund und Korrektur

Die angezeigte Generation ist kein Zähler gestarteter Betriebssystemprozesse. Im Stand 9.0.25 erhöhten auch Alive-Ereignisse des externen OCPP-Adapters die Generation eines ausgeschalteten internen OCPP-Moduls. Untergeordnete Objektdefinitionen lösten zusätzlich unnötige Reconcile-Aufrufe aus. Der korrigierte Host behandelt nur tatsächliche Instanzobjekte und Alive-Zustände als Eigentumsereignisse. Deaktivierte beziehungsweise nicht erfolgreich geladene interne Module haben keine freigegebene Autorität; diese Ereignisse erzeugen dort keine neue Generation. Aktive und startende Module werden bei relevanten Eigentumsänderungen weiterhin sofort gesperrt.

Ein fehlgeschlagener Konfigurationsimport blieb bisher intern als Fehler gespeichert, wurde im Laufzeitstatus aber durch `DISABLED` verdeckt. Der Status bewahrt nun `CONFIG_INVALID` und einen begrenzten technischen Fehlercode. Fehlende Node-Abhängigkeiten werden über die Prozessgrenze als `EOS_MODULE_DEPENDENCY_MISSING` übertragen. Der fehlende Import und relative Paketquellen können im begrenzten Serverlog diagnostiziert werden; absolute Installationspfade und rohe Fehlertexte gehen nicht in den Prozessstatus ein.

Nach bestätigter Bereinigung werden permanente Paket-/Syntax-/Initialisierungsfehler nicht automatisch wiederholt. Eine bewusste Aktivierung, ein Neustart oder eine validierte Konfigurationsänderung ermöglicht einen neuen Versuch. Ein initial fehlgeschlagener Konfigurationsimport wird ausschließlich im ausdrücklichen Start-/Aktivierungsauftrag erneut gelesen. Übliche Statusabfragen starten keine Wiederholung. Vorübergehende Prozessausfälle behalten den vorhandenen begrenzten exponentiellen Rücklauf von 1 bis maximal 60 Sekunden; bereits angenommene Schreibvorgänge werden vorher abgewartet. Alte Befehle werden nicht wiederholt.

`enableProcessModule` verwendet die vollständige gespeicherte Konfiguration und den vorhandenen validierten Commitpfad. Die Runtime-Freigabe bleibt währenddessen gesperrt. Die tatsächliche Datenbanktransaktion wird auch dann abgewartet, wenn die übliche HTTP-Antwortfrist von fünf Sekunden bereits abgelaufen ist. Eine bereits aktivierte Konfiguration erzeugt keinen zusätzlichen Schreibauftrag.

## Startfreigabe nach synchronem Paketimport

Ein zwischenzeitlicher vollständiger Testlauf meldete beim erneuten Start von OCPP `EOS_MODULE_PROCESS_INACTIVE`. Die Ursache ließ sich mit einem echten Worker und einer 1.200 ms synchron ladenden Factory deterministisch reproduzieren: Der Parent stellte `start` bereits hinter `init` in die IPC-Warteschlange. Die ursprüngliche maximal eine Sekunde gültige Freigabe war nach dem blockierenden Import abgelaufen; eine inzwischen gesendete Erneuerung stand hinter dem Startauftrag.

Ein begrenzter `prepare`-Auftrag bestätigt jetzt zuerst die fertig geladene Factory. Der Parent prüft anschließend die aktuelle Freigabe und seinen Stopzustand, sendet eine frische Freigabe und erst danach `start`. Vorbereitung und Start teilen dieselbe bereits bestehende Gesamtfrist. Heartbeat-, Stop- und Autoritätsfristen wurden nicht erhöht. Die Vorbereitung aktiviert keine Hardware und kann einen zwischenzeitlichen Widerruf nicht aufheben.

`test/eos-module-startup-handshake.test.cjs` prüft vier Fälle mit echten Unterprozessen: langer synchroner Import mit erfolgreichem Start; Freigabeverlust während des Imports; Stop während des Imports ohne späteren Start; gemeinsame 1.500-ms-Frist bei 1.200-ms-Import plus 600-ms-Start. Alle vier bestanden unter Node 22.23.4 und Node 24.22.3. Es wurden keine Test-Timeouts oder fachlichen Erfolgsassertionen gelockert.

## Reproduzierbare Ereignismessung

`node tools/eos-lifecycle-benchmark.cjs /absoluter/pfad/zum/vergleichsstand` verwendet einen begrenzten synthetischen Host. Die folgende Messung wurde gegen den unveränderten ausgelieferten 9.0.25-Stand und den Kandidaten ausgeführt; Node 22.23.4 und Node 24.22.3 lieferten dieselben Zähler.

| Arbeitslast | Zähler | 9.0.25 | 9.0.26 |
| --- | --- | ---: | ---: |
| 459 externe Alive-Ereignisse, internes OCPP aus | Generationserhöhungen | 459 | 0 |
| dieselben Ereignisse | Widerrufsaufrufe | 459 | 0 |
| 459 untergeordnete Objektdefinitionen | Reconcile-Aufrufe | 459 | 0 |
| dieselben Ereignisse | Generationserhöhungen | 459 | 0 |
| dieselben Ereignisse | Widerrufsaufrufe | 463 | 0 |

Bei beiden Ständen entstanden in diesen synthetischen Arbeitslasten keine Kindprozesse und keine zusätzlichen Eigentums-Datenbankabfragen. Die Messung belegt vermiedene Ereignisarbeit, keine RAM-Ersparnis auf einem Raspberry Pi und keine belegte Anzahl realer Prozessabstürze auf der betroffenen Anlage.

## Regressionen

`test/eos-module-startup-retry.test.cjs` umfasst elf Tests mit echten Workerprozessen, soweit ein Prozessstart erforderlich ist:

- Fehlende Abhängigkeit bei Fabrikerstellung und Modulstart: bestätigtes Prozessende, Fehlerstatus, keine automatischen Ersatzprozesse trotz reparierter Datei, bewusster Neustart erfolgreich.
- Validierte Konfigurationsänderung hebt die Fehlersperre auf und erhält gespeicherte Geheimnisse.
- Initial fehlgeschlagener Konfigurationsimport: sichtbarer Fehler, Statusabfragen ohne erneuten Import, bewusster Start und kombinierte Aktivierung laden die reparierte Fabrik erfolgreich neu.
- Deaktiviertes OCPP verarbeitet 459 externe Alive- und 459 irrelevante Objekt-Ereignisse ohne neue Generation.
- Aktive echte Worker verlieren bei externem Instanz- oder Alive-Wechsel sofort ihre Schreibautorität.
- Ein aktiver externer OCPP-Adapter verhindert den internen Prozessstart mit `EOS_MODULE_LEGACY_RUNNING`, ohne Gerätebefehle oder einen konkurrierenden Kindprozess.
- Ein tatsächlich 5,2 Sekunden blockierter Konfigurationscommit hält die Aktivierung gesperrt; vollständige Einstellungen und Geheimnisse bleiben erhalten; wiederholtes Aktivieren ist schreibfrei.

Diese elf Tests bestanden auf Node 22.23.4 und Node 24.22.3 ohne übersprungene Tests. ESLint und der strikte TypeScript-Vertrag `tsconfig.eos-module-process.json` bestanden. Die ergänzende bestehende Lifecycle-/Prozess-/EMS-/Konfigurationsregression bleibt Bestandteil der vollständigen Freigabeprüfung; sie ersetzt keinen Test mit den physischen Geräten der Anlage.
