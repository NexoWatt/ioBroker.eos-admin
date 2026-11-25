# EMS-Stabilität: NVP-Wiederanlauf und Farm-Aggregation

Prüfdatum: 24.11.2026. Referenz ist der unveränderte, versiegelte Lieferstand 9.0.20. Gegenstand sind zusätzliche reproduzierbare Fehler, nicht eine erneute Behauptung bereits in 9.0.20 korrigierter Funktionen. Die kanonische Engine-Quelle wurde für die neuen Regressionen im Speicher übersetzt. Die kanonische `main.ts` folgt weiterhin ihrem direkten JavaScript-Buildvertrag und wird ohne Übersetzung syntaktisch geprüft und ausgeführt. ioBroker-Datenbankzugriffe sind kontrollierte Fixtures. Kein Kundengerät wurde angesteuert.

## 921-EMS-001 – NVP-Filter startet aus erfundener 0 und übernimmt alte Messlage

**Priorität: hoch.** `EmsEngine.tick()` prüfte den anfangs fehlenden Mittelwert mit `Number.isFinite(Number(null))`. Dadurch wurde fehlend zu 0. Die erste gültige Messung von 600 W wurde mit der normalen 10-s-Glättung als 55 W veröffentlicht, −600 W als −55 W. Rohmesswert und Frischebewertung waren korrekt; der gefilterte NVP für nachfolgende Module war abweichend.

Bei Messausfall blieb der alte Filterzustand außerdem erhalten. Nach zuvor −5000 W Einspeisung, zwischenzeitlich explizit unbrauchbarer NVP-Messung und neuem 600 W-Bezug veröffentlichte der bisherige Code im zeitlich verdichteten Test −4972 W. Derselbe Fehler wurde für getrennte Verbindung, veraltete Messung, fehlenden State und Resolverfehler nachgewiesen.

Korrektur: Nur ein endlicher numerischer Filterzustand ist gültig. Unbrauchbare oder fehlgeschlagene NVP-Auflösung verwirft die Filterhistorie; der erste wieder gültige Messwert initialisiert sie neu. Während des Ausfalls werden keine erfundenen Leistungswerte mit frischem Zeitstempel publiziert. Ein tatsächlich gemessener 0-W-Wert bleibt dagegen eine gültige Glättungsbasis. Frischegrenzen, Rohmessung, Stellgrößen, Grenzen und Modulreihenfolge sind unverändert.

`test/eos-ems-nvp-recovery.test.cjs`: Baseline auf Node22.23.4 und 24.22.3 jeweils **6 Fehler / 3 bestanden**; Kandidat jeweils **9/9 bestanden**. Zusätzlich wird ein Burst von 100 gleichzeitigen Tick-Anforderungen bei blockiertem Modul geprüft: genau ein realer Modulaufruf, keine wachsende Menge aktiver Zyklen, Freigabe nach gezielt abgewiesener Modul-Promise und erfolgreicher Folgezyklus.

## 921-EMS-002 – Überlappende Farm-Snapshots und verspätete Veröffentlichung

**Priorität: hoch.** Der Farm-Timer und explizite Dispatch-/Konfigurationsaufrufe konnten dieselbe asynchrone Aggregation gleichzeitig starten. Bei verzögerter Datenbankantwort begannen 100 zusätzliche Timeranforderungen 101 Snapshots einschließlich des ersten; ein später abgeschlossener alter Snapshot konnte neuere Messwerte wieder überschreiben. Ein expliziter Preflight wartete nicht auf den älteren Lauf. Nach Shutdown oder ersetzter Konfiguration schrieb der alte Lauf im Reproduktionstest noch 33 Farmstates.

Korrektur ausschließlich im Aggregationspfad:

- Pro Runtime läuft höchstens ein Farm-Snapshot. Timeraufrufe während eines laufenden Snapshots werden verworfen und erzeugen keine wartende Kette.
- Explizite Aufrufe warten auf den bestehenden Lauf und lesen danach erneut. Damit erhalten Übernahme und Dispatch-Preflight einen neuen Snapshot.
- Verzögerte Leseantworten sowie jede Zustandsveröffentlichung prüfen Shutdown und Identität der verwendeten Konfiguration. Nach Austausch der Konfiguration werden alte Ergebnisse verworfen; der Runtime-Cache wird nicht frischgestempelt.
- Die Veröffentlichungssperre wird vor und nach jedem Datenbank-Write geprüft. Ein bereits an die Datenbank übergebener Write kann noch abschließen; weitere Writes und das abschließende Cacheupdate werden unterbunden. Es wird keine atomare Rücknahme bereits ausgeführter Datenbankaufträge behauptet.
- `finally` gibt den einzelnen Aggregationslauf auch nach Fehlern frei. Keine Änderung an Allokation, Mindest-SoC, 0-W-Limits, BMS-Freigaben, SolaX-Registern oder Aktor-Schreibwegen.

`test/eos-storagefarm-concurrency.test.cjs`: Baseline Node 24 **6 Fehler / 1 bestanden**; Kandidat Node 22.23.4 und 24.22.3 jeweils **7/7 bestanden**. Abgedeckt:100 Timeranforderungen bei gehaltenem DB-Read, expliziter Preflight, Konfigurationswechsel/Shutdown während Lesen und Schreiben sowie fehlgeschlagene Veröffentlichung mit erfolgreichem Folgeaufruf.

## Statische Prüfung und Grenzen

Die schmale Änderung betrifft `ui/src-ts/runtime-executables/ems/engine.ts` und die unmittelbar benachbarten Farm-Aggregationsmethoden in `main.ts`. Keine Abhängigkeit, Kundenkonfiguration, Datenpunkt-ID, Einheit oder Gerätefähigkeitsdeklaration wird verändert. ESLint 10.13.0 meldet auf diesen beiden Dateien 484 historische Befunde vor und nach der Änderung; der Vergleich nach Datei/Regel/Meldung enthält **keinen neu eingeführten Befund**. Der vollständige Scanner ist deshalb nicht als fehlerfrei zu bezeichnen. Die Ganzdateibindung und unabhängige Prüfung der endgültigen kombinierten Version erfolgen im abschließenden Releasegate.

Ein Zwischenbuild erkannte ausdrücklich ergänzte TypeScript-Signaturen in der bisher direkt kopierten `main.ts` als ungültiges Runtime-JavaScript. Diese vier Signaturannotationen wurden entfernt; die neue Publikationsfunktion trägt passende JSDoc-Typen. Der Buildvertrag wurde nicht geändert. Der Farmtest prüft seitdem zusätzlich genau diesen direkten JavaScript-Vertrag und könnte den Zwischenfehler nicht mehr durch seine eigene Übersetzung verdecken. Der abschließende erzeugte Runtime-Build bleibt ein eigener Freigabeschritt.

Nach der Korrektur wurde die tatsächlich neu erzeugte Runtime zusätzlich mit sieben bestehenden Farm-/Controller-/Kommandobestätigungs-/EMS-Rekonfigurationssuiten geprüft: **72/72 bestanden unter Node 22.23.4 und 24.22.3**, keine Skips. Diese decken unter anderem Mindest-SoC, dynamische sowie ausdrücklich 0-W-Leistungsgrenzen, 1 % / 98 %-Verteilung, fehlende physische Reaktion trotz angenommenem Auftrag, verzögerte Modulstopps und fehlgeschlagene Initialisierung ab. Zusammen mit den beiden neuen Suiten sind das jeweils 88 bestehende/neue Einzelergebnisse; dies ersetzt nicht das vollständige abschließende Releasegate.

Die vorhandene Farmprüfung 1 % / 98 %, Mindest-SoC 10 %, legt dem freigegebenen zweiten Mitglied den Bedarf zu und dem leeren Mitglied 0 W. Diese bereits in 9.0.20 nachgewiesene Allokation wird durch die Korrektur nicht ersetzt. Reale SolaX-Leistungsannahme und physische Entladung sind weiterhin getrennt von ioBroker-Schreibannahme und Treiberbestätigung zu bewerten. Nicht geprüft sind reale Gerätefirmware, Hardware-Watchdogs, Langzeitbetrieb, Betriebssystem-Scheduling oder harte Echtzeitgarantien. Weder dieser Bericht noch die Simulation erklären das Gesamtsystem CRA-konform oder funktional sicher.

Ein dauerhaft nicht abschließender ioBroker-Datenbankauftrag kann nicht durch diese Anwendungsfunktion abgebrochen werden. Der neue Farm-Timer erzeugt währenddessen keine weiteren Snapshots; explizite Aufrufer warten weiterhin auf die echte Beendigung. Die bestehende äußere Rekonfigurations-/EMS-Deadline und deren Sperrverhalten bleiben erhalten. Mehrere ausdrücklich ausgelöste Aufrufe werden serialisiert, nicht parallel abgearbeitet.

Rohbelege unter `raw/ems/`: Baseline- und Kandidatenläufe, Diff ausschließlich der eigenen Methoden, ESLint-Ausgaben/-Delta und SHA256-Zuordnung in `evidence.json`.
