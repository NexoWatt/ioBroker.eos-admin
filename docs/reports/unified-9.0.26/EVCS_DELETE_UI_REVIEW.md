# Ladepunkte löschen: UI und Persistenzprüfung

Prüfstand: 25.11.2026, Version 9.0.26, abschließende Browserläufe nach dem
gemeinsamen Runtime- und Backend-Build. Zeitstempel und Quellstand sind in den
unten verlinkten SHA-256-Listen festgehalten. Spätere Änderungen benötigen
ihren eigenen Nachweis.

## Befund und Änderung

Die gemeldete Fehlermeldung bezeichnet einen Konfigurationskonflikt. Das Backend
ermittelte den Revisionstoken des Installer-GET vor einer asynchronen Lizenzprüfung,
den zugehörigen Konfigurationsstand jedoch danach. Dieser Fehler wird separat im
Backend behoben; echte Änderungen durch einen zweiten Bearbeiter bleiben geschützt.

Im Frontend fehlte zudem ein einzelner Löschknopf für einen Ladepunkt. Eine bewusst
auf null gesetzte Anzahl übermittelte keine ausdrückliche Leerlistenfreigabe; der
serverseitige Schutz gegen versehentlich leere Formulare konnte damit den letzten
Ladepunkt wiederherstellen.

`ems-apps.ts` bietet nun „Ladepunkt entfernen“ an jeder Ladepunktkarte. Die Aktion
ändert zunächst den Entwurf und zeigt an, dass erst „Speichern“ die Zuordnung
entfernt. Andere Ladepunktzeilen bleiben erhalten. Bei ausdrücklicher Löschung des
letzten Ladepunkts beziehungsweise Änderung der Anzahl auf null wird einmalig
`settingsConfig.__allowEmptyEvcsList` gesendet. Dieser Intent wird nicht aus alter
Konfiguration übernommen, bei erfolgreichem Übernehmen/Neuladen verworfen und
serverseitig vor dem Speichern aus der Konfiguration entfernt.

Laden, Speichern und Import teilen denselben Frontend-Mutationsschutz. Der
Revisionstoken wird erst nach Übernahme seines vollständigen Formularstands
gesetzt. Ein Save darf nicht den alten Entwurf mit einem bereits aktualisierten
Token während einer noch laufenden Ladephase überschreiben. Es gibt keinen
automatischen Retry mit neuem Token und keinen unbedingten Überschreibpfad.

Die UI-Änderung wurde durch den koordinierenden Root-Agent unabhängig geprüft;
es wurden dabei keine blockierenden Befunde festgestellt. Die Backend-Änderungen
und die laufende Index-/Identitätsmigration werden gesondert überprüft.

## Ausgeführte Browserprüfung

`test/eos-evcs-delete-browser.cjs` verwendet Chromium, die ausgelieferte App-Center-
Seite, reale Konfigurationsrouten, CAS, State-Persistenz und Runtime-Apply. Nur
ioBroker-Datenbank, Sitzung und hardwareführende EMS-Schleife sind Test-Fixtures.
Konfigurationsantworten werden weder im Browser abgefangen noch nachgebildet.

| Prüfung | Node 22.23.4 | Node 24.22.3 |
| --- | --- | --- |
| Ersten Ladepunkt mit fehlendem Altadapter/fehlenden DPs löschen; aktiven zweiten inklusive unbekanntem Kundenfeld erhalten | Bestanden | Bestanden |
| Bereits geöffnete echte EVCS-Seite sendet alten A-Boost nach B-Reindex: HTTP 409, Hinweis zum Neuladen, keine B-Modusänderung | Bestanden | Bestanden |
| Echte Änderung durch zweiten API-Bearbeiter: HTTP 409, persistierter Stand unverändert, Löschentwurf bleibt sichtbar | Bestanden | Bestanden |
| Letzten Ladepunkt ausdrücklich löschen, null Ladepunkte persistieren, Marker verbrauchen | Bestanden | Bestanden |
| Anzahl bewusst auf null setzen und leere Liste speichern | Bestanden | Bestanden |
| Laufenden echten Konfigurations-GET abwarten; gleichzeitiger Save sendet keinen POST | Bestanden | Bestanden |

Nach erster und letzter Löschung wird zusätzlich jeweils ein neuer Runtime-Owner
erzeugt, der vorher keinen Installer-Patch enthält. Dieser lädt die gespeicherten
DB-Zustände über `loadInstallerConfigFromState` und übernimmt sie über den realen
Runtime-Apply-Pfad. Die EMS-Testschleife erhält genau den verbleibenden Ladepunkt
beziehungsweise eine leere Liste. Das ist mehr als ein Browser-Neuladen, jedoch
kein Prozessneustart auf Kundenhardware und kein Nachweis physischer Wallboxwirkung.

Beide Läufe prüfen identische Quellhashes vor und nach der Ausführung. Je Lauf sechs
Szenarien, null Seitenfehler. ESLint für den neuen Browserrunner: bestanden.

- [Node 22: Rohbericht und Quellhashes](raw/evcs-delete/node22-browser.json)
- [Node 22: Rohlog](raw/evcs-delete/node22-browser.log)
- [Node 24: Rohbericht und Quellhashes](raw/evcs-delete/node24-browser.json)
- [Node 24: Rohlog](raw/evcs-delete/node24-browser.log)
- [ESLint-Rohlog](raw/evcs-delete/browser-lint.log)

Aufruf (Browserpfad umgebungsabhängig):

```sh
EOS_CHROMIUM_PATH=/pfad/zu/chromium node test/eos-evcs-delete-browser.cjs
```

Interne Screenshots liegen außerhalb des Lieferverzeichnisses. Diese Prüfung
liefert keine pauschale Ausfallsicherheits- oder Produktionsfreigabe.

## Ergänzung: Bedienung aus bereits geöffneten Seiten

Eine abgeschlossene Verschiebung von Ladepunkt B auf den bisherigen Index von A
muss auch alte Browserbefehle abweisen. Eine Startsperre während der Übernahme
allein genügt dafür nicht. Die API erhält deshalb bestätigte Slot-Identitäten und
eine Layoutrevision aus dem persistenten Identitätsregister. Wiederverwendete
Slots benötigen eine passende erwartete Identität; unveränderte Altclients ohne
Token bleiben nur an historisch unveränderten Slots kompatibel. Globale
Ladepunktbefehle werden an die Layoutrevision gebunden.

Dashboard und EVCS-Seite merken den Identitätsstand des ersten Konfigurations-
Ladevorgangs für die Lebensdauer des Dokuments. Auch ein fehlgeschlagener erster
Abruf friert einen unbestätigten Stand ein; ein späterer automatischer Refresh
darf keinen alten Befehl aufwerten. Die Stationsseite bindet den Token an den
jeweils gerenderten Button-Callback. Ein aufbewahrter A-Callback verwendet somit
auch nach einem B-Render weiterhin A. Abgelehnte Identitätsbefehle werden nicht
wiederholt; die Oberfläche fordert zum Neuladen auf.

`test/eos-charging-control-client.test.cjs` führt die tatsächlichen Frontend-
Funktionen und den produktiven Stations-Renderhandler aus. Zwölf Szenarien prüfen
Snapshotbindung, Fehlstart, einzelne und globale Befehle, sichtbare Ablehnung,
vollständige Senderverdrahtung sowie alte Stationscallbacks. DOM/HTTP sind hier
Fixtures. Die getrennten Backend-Tests prüfen den realen HTTP-Schreibschutz.

Der unabhängige Review durch den Activation-Agent fand zunächst die Bindung an
`lastPayload` und den ersten fehlgeschlagenen Konfigurationsabruf als Lücken.
Beide wurden wie oben beschrieben geschlossen und durch Regressionen abgedeckt.

Zusätzlich wurde der neue Worker-Handshake unabhängig gelesen und mit echten
Kindprozessen ausgeführt: Factory-Bestätigung verleiht keine Schreibfreigabe;
der Parent prüft die Berechtigung erneut, erneuert die Lease und startet erst
danach. Vorbereitung und Start teilen dieselbe begrenzte Gesamtlaufzeit. Vier
Szenarien decken langsamen Import, Freigabeverlust, gleichzeitiges Stoppen und
Überschreiten der gemeinsamen Deadline ab.

Client- und Handshakeprüfung zusammen: jeweils 16/16 bestanden unter Node
22.23.4 und 24.22.3. Der unabhängige Client-Review einschließlich seiner separaten
Wiederholungsläufe ist in [CHARGING_CLIENT_REVIEW.md](CHARGING_CLIENT_REVIEW.md)
festgehalten.

- [Node 22: Client- und Worker-Handshakelog](raw/evcs-delete/node22-client-handshake.log)
- [Node 24: Client- und Worker-Handshakelog](raw/evcs-delete/node24-client-handshake.log)
