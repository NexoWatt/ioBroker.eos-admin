# OCPP-Rückmeldung und Prozessfreigabe im tatsächlichen Lademanagement

Stand: 25.11.2026, EOS 9.0.23. Lokaler Integrationsnachweis mit simulierten ioBroker-States; keine reale Ladestation wurde angesteuert.

`test/eos-ocpp-runtime-feedback.test.cjs` verwendet den vorhandenen `makeHarness` und das ausführbare Produktionsmodul `ui/ems/modules/charging-management.js`. Die drei alten Fixture-Stubs für Allocation, Phasenbehandlung und abschließende Stationsdiagnose werden entfernt, damit tatsächliche Leistungszuteilung und finaler Writer laufen. Das Budget verwendet `makeBudgetRuntime`. Der ergänzte Datenpunktcache enthält `val`, `ack`, `q`, `sourceTs`, `ts`, `lc` und `receivedTs`. Ein fehlender Quellzeitstempel bleibt `sourceTs:0`; der Empfangszeitpunkt kann ihn nicht zu einer frischen Quellmeldung machen.

Elf Integrationsfälle sind nachgewiesen:

1. Der tatsächliche CM liest atomar bestätigte 10929,6 W und verwechselt sie nicht mit dem getrennten Leitungswert 14,4 A. Positive Befehle gehen an den nativen Watt-Datenpunkt `control.chargeLimit`.
2. `pending` und `rejected` bleiben trotz alter erfolgreicher Einzelzustände unbestätigt.
3. Eine alte OCPP-Session, veraltete Meldung, Qualität 64, fehlendes ACK oder fehlender Quellzeitstempel können keine Ladeprofilbestätigung erzeugen.
4. Ein bestätigtes 0-W-Profil bleibt gültig, während unabhängig davon gemessene 5700 W weiterhin als tatsächliche Leistung sichtbar sind. Profilbestätigung ist keine Bestätigung physisch bereits beendeten Ladens.
5. Zwei Zuordnungen desselben nativen Stationsaktors erzeugen keine positiven Sollwerte. Nur der erste zugeordnete Writer darf den konservativen Nullbefehl senden; die doppelte Zuordnung erneuert keine Prozessfreigabe.
6. `CONTRACT_INCOMPLETE` verhindert positive Leistung im tatsächlichen finalen Writer.
7. Zwei getrennte Legacy-OCPP-Connectoren behalten ihre unabhängigen Aktoren und werden nicht als nativer gemeinsamer Stationsaktor behandelt. Der Integrationsreview deckte diese Abgrenzung auf; der native Guard wurde im Produktionscode korrigiert.
8. Ein abgelehnter oder fehlgeschlagener Lease-Schreibaufruf erzwingt Ziel 0 und verhindert positive Leistung.
9. Der positive Leistungsbefehl wartet auf das aufgelöste Lease-Schreib-Promise. Ein bloßer Schreibversuch reicht nicht.
10. Ein atomarer nativer Vertrag kann die Lease nicht durch einen fehlenden, falschen, ungültigen oder zeitlich unbekannten Supportmarker umgehen.
11. Die Lease wird nach fünf Sekunden und bei OCPP-Sessionwechsel unmittelbar erneuert. Eine neue Lease bestätigt kein altes Ladeprofil. Ein erfolgreicher Lease-Schreibwert liegt 15 Sekunden voraus; die lokale Schreibannahme wird nicht als OCPP-/Hardwarebestätigung ausgegeben.

Mit `node --test test/eos-ocpp-runtime-feedback.test.cjs test/eos-ocpp-limit-feedback.test.cjs test/eos-charging-pure-pv-ocpp.test.cjs` bestehen zusammen 20 Tests. Der gemeinsame Lauf erhält außerdem die vorhandene Pure-PV-Semantik, einschließlich Stop/Resume und der Abgrenzung gegen negative Preise. Lint des neuen Integrationsfixtures ist bestanden.

Rohnachweise: `raw/current/ocpp-runtime-feedback-tests.txt` und `raw/current/ocpp-runtime-feedback-lint.txt`. Der Test der Fünf-Sekunden-Renewal verwendet eine kontrollierte Uhr; es ist kein Echtzeit-Watchdog-Nachweis. Adapterseitiger Lease-Ablauf, Prozessabsturz, WebSocket-Reconnect, tatsächliches `SetChargingProfile` und Verhalten eines realen Ladegerätes benötigen die getrennten Adapter-/Prozess-/Gerätenachweise. Die hier verwendeten Transportantworten und Zustände sind bewusst Simulationen.

## Ergänzung: echter OCPP-Adapterhandler 0.4.3

Der optionale Source-Test in `test/eos-evcs-stop-writer.test.cjs` wurde für die bereitgestellte OCPP-Version 0.4.3 aktualisiert. Mit `EOS_TEST_OCPP21_MAIN=/…/iobroker.ocpp21/main.js` lädt er deren tatsächlichen Adapterhandler einschließlich privater Vertrags-/Normalisierungsmodule. Nur ioBroker-Persistenz und die Serverkonstruktion werden ersetzt; ein Server wird nicht gestartet. Die Controller-Fassade speichert den unbestätigten Eingabestate mit Originalzeitstempel vor `onStateChange`, sodass die tatsächliche aktuelle ACK-Prüfung des Adapters durchläuft.

Für OCPP 1.6, 2.0.1 und 2.1 werden jeweils angenommene und abgelehnte Antworten geprüft. Der reale EOS-Consumer und die reale Datenpunktregistry führen durch den tatsächlichen Adapterhandler zu genau 5700 W und anschließend 0 W im `SetChargingProfile`. Das historische `keepLast`-Konfigurationsfeld kann die Nullgrenze nicht in „weiterladen“ oder `ClearChargingProfile` verwandeln. Bei `Rejected` bleiben atomischer Profilstatus und Gültigkeitsflag falsch, obwohl der lokale Steuerstate als bearbeitet bestätigt wird. Auch bei `Accepted` bleibt die unabhängig simulierte Messleistung von 5700 W unverändert.

Ergebnis unter Node 24.22.3: 11/11 Tests einschließlich sechs Protokoll-/Antwort-Unterfällen bestanden, keine übersprungenen Fälle; Lint bestanden. Rohlog: `raw/current/evcs-stop-writer-ocpp043.txt`. Dieser Test führt keinen echten WebSocket-Dialog und keine physische Ladestation aus; diese Nachweise liegen im getrennten OCPP-Adapterprüfumfang.
