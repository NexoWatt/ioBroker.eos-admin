# Energiefluss: Backend-Korrekturen vom 25.11.2026

Dieser Teilnachweis beschreibt den aktuellen Quellstand im vollständigen 9.0.22-Lieferpaket. Paketprüfsummen und abschließender Releasebericht ordnen die Ergebnisse dem ausgelieferten Stand zu. Die Prüfungen verwenden echte ausgelieferte JavaScript-Methoden mit simulierten ioBroker-/Geräteschnittstellen; sie sind keine Messung an der Kundenanlage.

## Befunde und Korrektur

| Kennung | Befund | Umsetzung |
| --- | --- | --- |
| FLOW922-B01 | Negative oder Null-Bilanz wurde durch alte Last oder erfundene 100 W ersetzt. Der alte Lastwert erhielt immer wieder eine frische Zeit. | Fehlende/ungültige Bilanz bleibt `null`. Echte Null bleibt Null, auch während PV-Einspeisung. Gültiger direkter Gebäudemesswert bleibt vorrangig. |
| FLOW922-B02 | Gebäuderestlast unter Null wurde als gültige Null veröffentlicht. | Negative Restlast bleibt unbekannt. `derived.core.building.quality` und `inputsJson` zeigen den Grund und den unveränderten negativen Rohwert. Beide Diagnosewerte werden auch im API-/SSE-Cache veröffentlicht. |
| FLOW922-B03 | PV, zusätzliche Erzeuger/Verbraucher und EV-Summe verwendeten teilweise alte oder ungültige Beobachtungen. | Gemeinsamer streng typisierter Messwertleser trennt gültige Null, fehlend, veraltet, zukünftige Zeit, ungültige Qualität und ungültige Typen. Er führt keine Getter oder geerbten Cacheeinträge aus. |
| FLOW922-B04 | Die neue Einzelmessung eines Ladepunkts verjüngte alle alten Ladepunktwerte in der EV-Summe. | Summe benötigt alle konfigurierten Messglieder und behält den ältesten Quellzeitpunkt. Fehlerhafte Mitglieder machen die Summe unbekannt. |
| FLOW922-B05 | Mapped-Refresh und StateChange verwarfen die ioBroker-Qualität; fehlende EV-/Auto-PV-Zeit konnte künstlich ersetzt werden. | Quellqualität bleibt in Cache, Rohcache und EV-Spiegel erhalten. Fehlende Messzeit erzeugt keine neue Beobachtung. Qualitätswechsel werden auch bei unverändertem Wert/Zeit verarbeitet. |
| FLOW922-B06 | Identische PV-Quelle konnte als optionaler Erzeuger erneut gezählt werden; BHKW/Generator fehlten in der zusätzlichen Backendproduktion. | Bekannte Quellenidentität dedupliziert; aktive BHKW-/Generator-Messquellen werden einbezogen. `derived.core.production.extraW` veröffentlicht die deduplizierte zusätzliche Erzeugung. Legacy-Zuordnungen in `vis.flowSlots` bleiben wirksam. |
| FLOW922-B07 | Persistent gespeicherte PV und API-/SSE-Werte konnten unterschiedlich gültig/alt erscheinen. | Gültigkeit und Beobachtungszeit werden in beiden Ausgabepfaden identisch geführt. |

Das Rechenmodell bleibt: Gesamtverbrauch = PV + zusätzliche Erzeugung + Netzbezug + Speicherentladung − Netzeinspeisung − Speicherladung. Restverbrauch zieht normale Verbrauchsmagnituden und EV-Leistung ab. Zusätzliche Verbraucher werden nicht doppelt abgezogen, wenn exakt dieselbe Mess-ID mehrfach gemappt ist oder bereits als direkte EV-Summe verwendet wird. Separate Volleinspeisung ist nicht Teil dieser hinter dem Gebäudezähler liegenden Erzeugerbilanz. Eine beliebige Gesamtmessung und ihre nur anhand anderer IDs erkennbaren Unterzähler lassen sich ohne Anlagenwissen weiterhin nicht automatisch auseinanderhalten; deren Zuordnung muss bei der Anlagenabnahme geprüft werden.

Die neue Gültigkeitsprüfung verändert keine Schutzgrenzen, Lade-Sollwerte oder Betriebsarten direkt. Ungültige berechnete Messwerte dürfen jedoch in nachgelagerten EMS-Verbrauchern nicht durch `Number(null)` in Null umgewandelt werden. Die im Gesamtauftrag vorgenommenen Änderungen an Lademanagement und Speichersteuerung sind deshalb Teil der gemeinsamen Integrationsprüfung.

## Tatsächlich ausgeführt

- Node.js 24.22.3 und 22.23.4: jeweils 15 neue Backendprüfungen plus 10 vorhandene Historien-Integritätsprüfungen bestanden, keine ausgelassenen Tests. Rohbelege: `raw/flow-backend/node24.tap`, `node22.tap`.
- `tsc -p ui/tsconfig.flow-measurement.json`: bestanden mit aktivem Strict-Profil.
- Typgestütztes ESLint für `flow-measurement.ts`: bestanden.
- Weitere gezielte Prüfung von Gerätebefehl-Subscriptions und Energiefluss-Messwerten: 23 Prüfungen im zwischenzeitlichen Stand bestanden; maßgeblich ist der abschließende Gesamtprüflauf nach Integration aller Änderungen.

Die neue Testsuite führt `updateDerivedFlowStates`, `updateValue` und `_nwPublishEvcsInputBinding` aus der ausgelieferten `ui/main.js` aus. Die reine Gerätesource, Zeit sowie Datenbankausgabe sind kontrollierte Fixtures. Prüfungen decken bekannte Null-/Stale-/Zeit-/Qualitätsfälle, Auto-PV, reale Null bei aktiver Einspeisung, negative Last, Legacy-Slots, Duplikate, BHKW/Generator, EV-Mehrfachaggregation und einen ungültige Last wiederbelebenden simulierten TS-Kandidaten ab.

## Verbleibende Abnahme

Echte ioBroker-Ereignisreihenfolge unter Anlagenlast, Messintervalle der eingesetzten Geräte, realer Wirkungsgrad/Verlustanteil, tatsächliche Zählergrenzen sowie synchronisierte Netz-, PV-, Batterie- und Wallboxmessung auf der Kundenanlage sind offen. Kein 100-%-Zuverlässigkeitsnachweis und keine pauschale Produktivfreigabe werden aus den Softwaretests abgeleitet.

## Ergänzung: Zentrale PV-Budgeteingänge

Während der Prüfung des gemeldeten reinen PV-Ladens wurden drei weitere reproduzierbare Fehlerpfade im zentralen Budget geschlossen:

- `FLOW922-B08`: Der bisherige „Fresh“-Cacheleser akzeptierte fehlende oder zukünftige Zeitstempel, Fehlerqualität und implizite Nullwerte. Der zentrale PV-/NVP-/Verbrauchereingang verwendet jetzt denselben strengen Messwertleser. Speicherfluss wird ausdrücklich mit `strictStale: true` und der vorhandenen Deadline angefordert.
- `FLOW922-B09`: Die größte parallele PV-Messung konnte eine frischere kanonische Gesamtsumme einschließlich echter Null überstimmen. Die gültige kanonische PV-Summe ist vorrangig; nur wenn sie fehlt, bleibt die bisherige Auswahl aus geeigneten Fallbackquellen. Ein Test mit 5,7 kW bereits laufender EV-Aufnahme, 1 kW Netzbezug und gültig 2 kW Gesamt-PV zeigt maximal 2 kW PV-Budget (ohne Reserve), auch wenn ein anderer noch innerhalb des Zeitfensters liegender Alias 9 kW meldet.
- `FLOW922-B10`: Eine gehaltene PV-Obergrenze galt gleichzeitig als „trusted“ und erneuerte dadurch bei jedem Tick ihre eigene Ablaufzeit. Nur neue, nicht gehaltene Evidenz erneuert den Vertrauenszeitpunkt. Das bestehende 45-Sekunden-Fenster endet nun auch bei wiederholten Regelzyklen. Eine neue gültige PV-Beobachtung kann danach wieder freigeben.

`test/eos-core-pv-input-integrity.test.cjs` führt den ausgelieferten zentralen `_makeBudgetSnapshot` aus. Unter Node.js 22.23.4 und 24.22.3 sind jeweils alle 3 Prüfungen bestanden; sie umfassen mehrere Varianten je Eingabefeld und einen wiederholten Zeitverlauf bis nach Ablauf und anschließender Wiederaufnahme. Belege: `raw/flow-backend/core-pv-node22.tap`, `core-pv-node24.tap`. Die bestehenden Schutz-/Netz-/§14a-Grenzen und die zentrale Budgetformel werden nicht umdefiniert. Der auf der Anlage tatsächlich fehlerauslösende Pfad bleibt ohne passende Live-Diagnose eine offene Zuordnung; die Tests belegen diese konkreten Softwarefehler und ihre Korrektur.

Zwei zusätzlich angestoßene ältere Prüfscripte wurden **nicht bestanden**: `verify-core-limits-pv-physical-cap.js` bricht an einer hart codierten mehrzeiligen Quelltextsuche für einen inzwischen einzeiligen Fresh-Reader-Aufruf ab; `verify-central-pv-budget-orchestration.js` bricht nach den Rechenprüfungen an einer hart codierten Quelltextsuche für den inzwischen typisiert parametrisierten Speicher-Reservierungsaufruf ab. Diese statischen Textvergleiche wurden nicht umgeschrieben und werden nicht als grüne Prüfnachweise ausgegeben. Die neuen ausführbaren Regressionstests und der abschließende Gesamtprüflauf sind getrennt davon dokumentiert.
