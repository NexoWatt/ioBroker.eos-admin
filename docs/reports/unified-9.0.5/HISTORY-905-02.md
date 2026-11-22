# HISTORY-905-02 – robuste, begrenzte History-Auswertung

Stand: 2026-11-22, Version 9.0.5. Dieser Befund ist eine zusätzliche Codehärtung. Der vom Nutzer gelieferte Neustart-Stack (`req.query.from` bei nicht vorhandenem `req.query`) wird separat an der Express-5/Express-4-Einbettungsgrenze behoben; die folgenden Fehler werden nicht als nachgewiesene Ursache dieses Feldabsturzes ausgegeben.

## Befund und Änderung

Die History-Route verarbeitete `sendTo`-Antworten in asynchronen Callbacks mit ungeschützten Zugriffen auf Zeilen wie `p.ts`. Null-Zeilen oder ungültige `series.values` konnten außerhalb des umgebenden `try/catch` werfen. Jeder Kandidat hatte zudem einen eigenen Acht-Sekunden-Timer; die Rastergröße war nicht begrenzt.

Die Route verwendet nun einen gemeinsamen monotonen Fünf-Sekunden-Zeitrahmen für alle Kandidaten, Zählerabfragen und aktuellen Zählerstände. Sie behandelt synchrone Transportfehler, verworfene Transport-Promises und Callback-Verarbeitungsfehler lokal. Fehler, Zeitablauf und Unload geben Timer und lokale Callback-Verweise frei; späte Antworten werden ignoriert. Wenn ein Zweig scheitert, werden noch laufende Geschwisterzweige beendet. Es werden keine globalen Ausnahmen unterdrückt.

| Grenze | Verhalten |
| --- | --- |
| Zeitrahmen | Insgesamt 5.000 ms; keine Verlängerung durch Kandidaten oder Fallbacks |
| Rohantwort | Höchstens 10.000 Zeilen pro Providerantwort; größere Antworten werden nicht kopiert/sortiert |
| Diagrammraster | Höchstens 4.096 Punkte pro Reihe; nicht endliche, rückwärts gerichtete oder zu große Abfragen ergeben HTTP 400 mit `EOS_HISTORY_RANGE_INVALID` |
| Gleichzeitige Berechnungen | Höchstens vier verschiedene Abfragen; identische Abfragen teilen dieselbe Berechnung; zusätzliche Abfragen ergeben HTTP 503 mit `EOS_HISTORY_BUSY` |
| Antwortcache | Höchstens vier Einträge; Antworten sind fünf Sekunden wiederverwendbar, abgelaufene Einträge werden bei Cachezugriff/-schreiben entfernt |
| Ladepunkt-Fallback | Beide Pfade verarbeiten jeweils höchstens acht Ladepunktabfragen gleichzeitig und geben temporäre Summierungsreihen frei |
| Jahresvergleich | Höchstens zwei Jahresabfragen gleichzeitig; alle bis zu zehn Jahre bleiben verfügbar |

Fehlercodes der Berechnung: `EOS_HISTORY_TIMEOUT`, `EOS_HISTORY_CANCELLED`, `EOS_HISTORY_UNAVAILABLE`, `EOS_HISTORY_RESPONSE_INVALID`. Interne Transportfehlermeldungen werden nicht an den Browser ausgegeben. Ein Fehler im optionalen zweiten EV-Auswertungspfad wird nicht als vollständiges `ok:true` verschluckt. Fehlende Anfangsintervalle bleiben in Energietotals unbekannt (`null`), ein gemessener Nullwert bleibt null Watt bzw. null kWh im numerischen Sinn (`0`).

Erhaltene Abfragen: Tag mit 600 s, Woche mit 1.800 s, Monat mit 3.600 s, Jahr mit 86.400 s; Jahresbericht mit 21.600 s. Ein Schaltjahr im Jahresbericht hat höchstens 1.465 Punkte und bleibt unter der Grenze. Benutzerdefinierte größere Zeiträume müssen ein gröberes Raster anfordern; es erfolgt keine stille Veränderung des angefragten Rasters.

## PRICE-905-03 – Rechenaufwand der Preisreihen

Die bisherige Hold-last-Suche durchlief für jeden Ausgabepunkt erneut die gesamte sortierte Reihe. Die Suche verwendet jetzt eine binäre Suche mit unveränderter Behandlung des letzten gültigen Werts und doppelter Zeitstempel. Die Normalisierung erzeugt weiterhin sortierte, endliche Reihen.

Ein isolierter Test mit vier maximalen Antworten und je 26 Reihen à 4.096 Punkten benötigte mit der alten Suchfunktion rund 53,7 Sekunden; nach der Änderung rund 0,3 Sekunden. Das sind Messungen der kontrollierten VM-Testfixture, keine Messung der Installation des Nutzers. Die Aussage ist keine garantierte Laufzeit auf anderen Geräten.

## Nachweis und Grenzen

`node --expose-gc --test --test-reporter=tap test/eos-history-api-stability.test.cjs test/eos-history-deadline.test.cjs`

Ergebnis: **30/30 bestanden**, davon 17 neue History-API-Tests und 13 erhaltene Deadline-/Messwerttests. Ausgeführt unter Node.js v24.22.3. Tests führen die unveränderte JavaScript-kompatible kanonische Route und echte Normalisierungs-/Cachemethoden aus, extrahiert über den TypeScript-AST. ioBroker-Transport, HTTP-Antwort und Deadline-Uhr sind kontrollierte Testdoubles. Eine reale HTTP-Prüfung der Express-Einbettung und der abschließende Paket-/Controllerlauf werden separat dokumentiert.

Geprüft wurden asynchrone ungültige Antworten, gültige Nullmessungen und mehrere Providerformate, gemeinsame Deadline inklusive Fallbacks, späte Antworten, Unload, geworfene und verworfene Transporte, Rohantwort- und Rasterlimits, alle bestehenden Zeitraumpresets, Deduplizierung und Parallelgrenze, Cachegröße/Alter, hängende aktuelle Zählerabfragen, 200 Ladepunkte, beide EV-Fallbacks, unvollständige Energietotals, exakte Preis-Hold-Semantik und der Zehnjahresbericht.

Die Ressourcenfixture hält vier maximale Antworten: **106.496 Wertepaare je Antwort**, maximal **1.919.024 Byte JSON je Antwort**, rund **32,93 MB zusätzlicher retained JavaScript-Heap** nach erzwungenem GC. Dabei werden der tatsächliche Allocator/GC, aber ein kontrollierter Provider verwendet. Dies misst weder RSS des gesamten Adapters noch die vom Nutzer gemeldeten 750 MB. Cache-/Variablen- und Testprozess-Overhead sind in der beobachteten Heap-Differenz enthalten. Es wird keine Aussage über die Größe anderer Adaptercaches oder Speicherverluste der vollständigen Installation getroffen.

Rohdaten: `history-api-focused.tap`, `history-api-resource-profile.json`. Letztere enthält die vollständige Testanweisung, Grenzen, Messkontext und SHA-256 der ausgeführten Quellen und Tests. Der frühere Zeitwert ist als direkte vorherige Toolbeobachtung gekennzeichnet; die gespeicherte TAP-Datei enthält den aktuellen Prüflauf.
