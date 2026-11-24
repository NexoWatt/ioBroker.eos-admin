# Tarifbericht: Messwert- und Kostenintegrität

Stand: 24.11.2026, 9.0.20. Enger Nachtrag zur unabhängigen Codeprüfung von `/api/tariff/report` und dessen eigener Darstellung/CSV-Ausgabe. Keine Änderung von Tarifprovidern oder Regelungsfreigaben.

## Bestätigter Fehler und Korrektur

Der bisherige Bericht wandelte fehlende Preis- und Bezugswerte über `Number(null)` in echte Nullwerte um, schrieb ältere Intervallwerte unbegrenzt fort und begrenzte negative Gesamt-/Basispreise auf −5 EUR/kWh. Dadurch erschienen unvollständige Berichte als vollständige Null- oder Minderkosten. `from`/`to` begrenzten außerdem weder Abfragedauer noch Zeilenanzahl. Die eigene Berichtsdarstellung und der CSV-Export wandelten unbekannte Werte erneut in Null um.

Die Korrektur umfasst:

- Fehlende Viertelstunden bleiben Datenlücken. Ein Messwert vor dem Zeitraum oder aus einem früheren Intervall wird nicht in spätere Intervalle übernommen.
- Echte Nullpreise und kanonische negative EUR/kWh bleiben erhalten. Der bestehende nichtnegative Netzentgeltaufschlag bleibt unverändert; bei aktivem Netzentgelt mit fehlendem Wert bleibt die Aufteilung unbekannt.
- Fehlende dynamische Preise verwenden keinen aktuell konfigurierten Festpreis. Bei statischem Tarif bleibt dessen vorhandener Fallback möglich und wird ausdrücklich als Schätzung gekennzeichnet; aufgezeichnete historische Preise haben Vorrang.
- Fehlende Preise oder Bezugswerte liefern `null` für nicht berechenbare Kosten. Betroffene Summen des gesamten Zeitraums werden nicht aus einem stillschweigend verkürzten Teilzeitraum berechnet. Verfügbare Mindest-/Höchstpreise bleiben nutzbar; die Datenabdeckung wird separat ausgewiesen.
- Die noch offene aktuelle Viertelstunde liefert noch keine vollständige Intervallenergie oder -kosten. `coverage` benennt vollständige, fehlende und offene Intervalle sowie verwendete Festpreis-Schätzungen.
- Vor jeder Historie-Abfrage/Array-Erzeugung werden Zeitwerte, Reihenfolge und Dauer validiert. Der vorhandene 730-Tage-Horizont bleibt erhalten; maximal **70.081** Viertelstunden einschließlich eines Randintervalls. Ungültige Anfragen erhalten HTTP 400 / `EOS_HISTORY_RANGE_INVALID`.
- Eigene Tarifberichtsanzeige und CSV erhalten die Unterscheidung: unbekannt als Gedankenstrich beziehungsweise leeres CSV-Feld, echte Null und negative Werte numerisch. Unvollständige Daten und statische Schätzungen werden sichtbar benannt.

## Nachweise

`test/eos-tariff-report-integrity.test.cjs` prüft neun Fälle über die echte HTTP-Route beziehungsweise die tatsächlichen Frontend-Funktionen: unbekannte Werte, Null/negative Preise, Lücken, fehlendes Netzentgelt, statischen Nullpreis, offene Viertelstunde, ungültige/überlange Bereiche, Erhalt des 730-Tage-Horizonts sowie Anzeige/CSV. Bei der maximalen gültigen Dauer endet der Test gezielt an der Historie-IO-Grenze; er erzeugt keine 70.080 leeren Testtabellenzeilen.

**22/22 Tarif-Regressionsprüfungen unter Node.js 22.23.4 und 24.22.3 bestanden**, darunter alle neun neuen Fälle. Der Vorherlauf gegen die bis dahin erzeugte 9.0.20-Runtime ohne diesen Tarifbericht-Fix zeigt sieben erwartete Fehler; die zwei bereits erfüllten Fälle bestanden. Dieser Rohbeleg ist ausdrücklich kein vollständiger Testlauf des versiegelten 9.0.19.

Die unabhängige Nachprüfung von `main.ts` meldet unveränderte Scannerfingerprints und keine neue Ausnahme. Gesamtbuild, weitere Security-/Frontendprüfungen und Release-Zuordnung stehen im übergeordneten Freigabebericht. Rohlogs und Hashes: `raw/tariff-report-evidence.json`.

## Grenzen

Historische Datenbankantworten sind Testfixtures. Reale Influx-/SQL-Abfragen und browserbasierte Pixelprüfung sind durch diese Tests nicht belegt. Ältere Aufzeichnungen ausschließlich bei Wertänderung können dadurch sichtbare Lücken enthalten: Ohne bestätigte zeitliche Gültigkeit werden daraus keine vollständigen Viertelstunden erfunden. Der statische Festpreis-Fallback ist eine ausdrücklich gekennzeichnete Schätzung und keine Bestätigung früherer Abrechnungspreise. Unvollständige Werte werden durch diesen Fix nicht nachträglich rekonstruiert.
