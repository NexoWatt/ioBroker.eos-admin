# Unabhängiger Befund: Offline-Speicher im Pipeline-Test

Anlass: Im vollständigen Node-22-Lauf schlug die Assertion in
`test/eos-device-ems-web-pipeline.test.cjs` fehl, die nach Geräteübernahme keinerlei
unbestätigte Geräte-Schreibaufträge erwartete (`actual 1`, `expected 0`).

Der unveränderte gesamte Test lief anschließend unter Node 22.23.4 und 24.22.3
jeweils mit 13/13 Prüfungen durch. Der einzelne Node-22-Fall bestand ebenfalls.
Das allein wäre kein Nachweis eines harmlosen Fehlers gewesen.

Eine gezielte Diagnose ließ im unveränderten Produktionscode nach der Aktivierung
2,5 Sekunden vor derselben Assertion verstreichen. Nur der Test wurde dafür im
Speicher instrumentiert; keine Produktdatei wurde verändert. Auf **beiden**
Node-Versionen schlug dann die alte Assertion reproduzierbar fehl. Sämtliche
beobachteten Gerätebefehle hatten exakt den numerischen Wert `0`, `ack: false`
und eines dieser Ziele:

- `eos-admin.0.devices.storage.home.aliases.v1.ctrl.powerSetpointW`
- `eos-admin.0.devices.storage.solax.aliases.v1.ctrl.powerSetpointW`

Die zugehörigen Produktdiagnosen meldeten `farm-stop`, geplante und angenommene
Leistung jeweils 0 W. Teilweise trat die Nullung des bereits vorhandenen manuellen
Speichers schon vor der neuen Geräteübernahme auf. Es wurde weder positive noch
negative Lade-/Entladeleistung beobachtet.

Der bestehende Dispatcher in `ui/src-ts/runtime-executables/main.ts` beschreibt
und implementiert ausdrücklich die Nullung veralteter, fehlerhafter oder nicht
verfügbarer Speicher. Die alte Testassertion widersprach diesem Sicherheitsverhalten
und hing davon ab, ob sie zufällig vor dem ersten Scheduler-Zyklus ausgeführt wurde.
Eine Node-spezifische Produktregression ist damit nicht belegt.

## Enge Korrektur ausschließlich am Test

Der Test wartet nun auf einen tatsächlich abgeschlossenen neuen EMS-Zyklus über
`_nwEmsSchedulerHealth.lastTickEndMs`. Das vorhandene Wartebudget von 100 Versuchen
zu 50 ms bleibt bestehen; es wird nicht nur auf eine unabhängige Heartbeatmeldung
gewartet. Anschließend werden ausschließlich die beiden oben genannten Ziele
mit einem endlichen numerischen Nullwert akzeptiert. Jeder andere Geräte-Zielpfad,
jeder nichtnumerische Wert sowie jede positive oder negative Leistung bleiben
ein Fehler. Die übrigen bestehenden Assertions bleiben unverändert. Die bestehende
reine Sollwertschnittstelle meldet ihre statische Stellfähigkeit auch ohne
Messrückmeldung; daraus darf keine frische Messung abgeleitet werden. Deshalb
wurde keine zusätzliche Annahme zum Zähler `storagesDispatchAvailable` übernommen.

Produktlogik, Sicherheitsnullung, Kommunikationsschutz und Timeouts wurden nicht
geändert. Die ursprüngliche 2,5-Sekunden-Diagnosepause ist nicht Bestandteil der
Testkorrektur.

## Abschließender Nachweis

Der endgültige Teststand bestand am 2026-11-25T21:11:13.553Z unter Node 22.23.4 und
24.22.3 jeweils mit **13/13 Prüfungen**, ohne Fehler, Abbruch oder Überspringen.
Der Test wurde vor und nach beiden Läufen unverändert als
`e5ad240b83326a70b7c2e5edce1ee134920e745487ed51b84751f653b2198a22` geprüft.
Der unveränderte Produktstand `ui/main.js` hatte SHA-256
`f284f6f3d83653dd52fd0f2d5d3d121cf29a5c9678f7c2c2724f087eef42a577`.
[Maschinenlesbarer Snapshot](raw/evcs-delete/pipeline-corrected-snapshot.json).

## Rohbelege

- [Node 22: unveränderter Gesamttest](raw/evcs-delete/node22-pipeline-repro.log)
- [Node 24: unveränderter Gesamttest](raw/evcs-delete/node24-pipeline-repro.log)
- [Node 22: einzelner Fall mit Fehlerdiagnostik](raw/evcs-delete/node22-pipeline-diagnostic.log)
- [Node 22: gezielte Tick-Probe, erwartete alte Assertion fehlgeschlagen](raw/evcs-delete/node22-pipeline-tick-probe.log)
- [Node 24: gezielte Tick-Probe, erwartete alte Assertion fehlgeschlagen](raw/evcs-delete/node24-pipeline-tick-probe.log)
- [Node 22: korrigierter Gesamttest](raw/evcs-delete/node22-pipeline-corrected.log)
- [Node 24: korrigierter Gesamttest](raw/evcs-delete/node24-pipeline-corrected.log)

Die Tests verwenden die Produktionspipeline mit synthetischem Controller und
gesperrten beziehungsweise simulierten Gerätetransporten. Es wurde keine reale
Anlage oder physische Speicherwirkung geprüft.
