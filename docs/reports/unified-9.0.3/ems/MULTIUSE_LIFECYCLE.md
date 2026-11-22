# MultiUse: Objektanlage beim deaktivierten Kaltstart

Prüfstand: 22.11.2026, Node.js 24.22.3. Ausgangsstand EOS 9.0.2, Korrektur für das folgende Reparaturpaket. Kein Zielgerät und keine reale Anlage wurden verändert.

## Bestätigte Ursache und Änderung

Der Modulmanager ruft vor der sicheren Deaktivierung eines Aktormoduls dessen `init()` auf, damit Diagnoseobjekte existieren. `MultiUseModule.init()` kehrte bei `enableMultiUse=false` jedoch sofort zurück. Anschließend schrieb `deactivate()` die Zustände `multiUse.control.active`, `requestW`, `budgetW` und `status` ohne vorherige Objektanlage. Der neue Test reproduziert genau diese vier Warnungen aus dem Nutzerprotokoll.

Der frühe Rücksprung wurde ausschließlich aus `init()` entfernt. Die vorhandene Objektanlage und Vorbereitung eventuell bestehender Legacy-Mappings erfolgt nun auch für das deaktivierte Modul. `init()` gibt keine Hardware-Sollwerte aus; der vorhandene Aktivierungscheck in `tick()`, die Lizenzfreigabe des Modulmanagers und sämtliche Aktor-/NVP-Schutzprüfungen bleiben erhalten. Vorhandene Einstellungen, Legacy-Ziele und Objekte werden nicht zurückgesetzt. Scheitert die Objektanlage, wird der bereits bestehende Fehlerweg des Modulmanagers genutzt; die Deaktivierung wird nicht fälschlich als erfolgreich bestätigt.

Geänderte fachliche Quelle: `ui/src-ts/runtime-executables/ems/modules/multi-use.ts`. Daraus wurde `ui/ems/modules/multi-use.js` mit dem vorhandenen Runtime-Generator erzeugt. Neue Regression: `ui/test/unified/multiuse-lifecycle.test.cjs`.

## Ausgeführte Nachweise

| Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| Neue Regression vor Korrektur | 3 Fehler; erster Fall zeigt exakt vier fehlende control-Objekte | `multiuse-before.tap` |
| Neue Regression nach Korrektur | 3/3 bestanden, 0 übersprungen | `multiuse-after.tap` |
| Bestehende MultiUse-, Lifecycle-, Deaktivierungs-, Safety-Envelope- und Stage-A-Prüfskripte | 8/8 Aufrufe mit Exitcode 0 | `related-regressions.json` und individuelle Logs |
| NVP und dynamischer Netzanschluss | 208/208 bestanden, 0 übersprungen | `nvp-dynamic-grid.tap` |
| Runtime-Generator | Erfolgreich; 163 Dateien aus kanonischer Quelle erzeugt | `multiuse-runtime-build.log` |
| JavaScript-Syntax des generierten MultiUse-Moduls | `node --check ui/ems/modules/multi-use.js`: Exitcode 0 | Ausführung im Arbeitsstand |
| ESLint der neuen Testdatei | Exitcode 0; lediglich vorhandene npm-Umgebungswarnung zu `http-proxy` | `multiuse-lint.log` |

Die Regression verwendet den realen Modulmanager-Lifecycle und das reale MultiUse-Modul mit synthetischem ioBroker-Objekt-/State-Speicher. Sie prüft Objekt-vor-State-Reihenfolge, idle Verhalten deaktivierter Ticks, unveränderte Konfiguration, keine Hardwarekommandos während Initialisierung, Erhalt alter Zielwerte, spätere Policy-Aktivierung sowie fehlgeschlagene Objektanlage. Die ergänzenden Skripte prüfen die erhaltenen Schutz- und Deaktivierungspfade. Das ist kein physischer Aktor-/Anlagentest.

## Abgrenzung zum Webzugang und zu NVP-Meldungen

Die Meldung `Embedded engine started` wird nach dem Start des EMS-Schedulers ausgegeben. Danach folgen im bisherigen `onReady` weitere asynchrone Initialisierungen. Wenn der übergeordnete Webserver auf diesen gesamten Ablauf wartet, kann ein später hängender Aufruf den Listenerstart verzögern. Die Entkopplung dieses Web-/EMS-Lifecycles wird separat korrigiert und geprüft; die MultiUse-Objektwarnungen allein belegen keinen TLS-Fehler.

NVP-Meldungen wie `stale`, `split` oder `split-stale` werden nicht unterdrückt. Sie müssen bei fehlenden, veralteten oder inkohärenten Messwerten weiterhin sichtbar bleiben und dürfen keine positive Leistungsfreigabe erzeugen. Aus dem vorliegenden Protokoll lässt sich weder die konkrete falsche Messwertzuordnung noch ein defektes Messgerät beweisen. Es wurden keine Kundeneinstellungen oder Zeitgrenzen verändert. Ein Scheduler-Log mit 1000 ms ist kein Nachweis der geforderten 50-/100-ms-Reaktionszeiten; solche Ziele benötigen eigene Messungen am Zielsystem.
