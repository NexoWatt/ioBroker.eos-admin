# Tarifpreise: fehlende Werte, Frische und Kundenanzeige

## Reproduktion und enger Fix

Die tatsächliche `EnergyWalletModule._prices()`-Methode lieferte vor der Änderung bei einem frisch veröffentlichten Budgetpreis `null` den Wert **0 EUR/kWh**, obwohl der direkte aktuelle Tarifpreis **0,2531 EUR/kWh** betrug. Ursache war die JavaScript-Konvertierung `Number(null) === 0`; die zusätzliche Prüfung `Number.isFinite(Number(tariffNow))` behandelte auch einen fehlenden Preis erneut als gültig. Der Core-Limits-Tarifleser konnte diese falsche Null zuvor schon in den Budgetzustand schreiben.

Der neue, streng geprüfte gemeinsame Preisleser akzeptiert Zahlen und nichtleere numerische Zeichenketten. `null`, `undefined`, leere Zeichenketten, Booleans, Arrays, Objekte und nichtendliche Zahlen sind keine Preise. Echte Nullwerte und negative Preise bleiben gültig. Core-Limits verwendet diesen Leser ausschließlich für die beiden Tarifpreisfelder; Netzlimits und andere Messwertleser bleiben unverändert. Eine ausdrücklich falsche Tarif-Frischefreigabe lässt den aktuellen Budgetpreis `null` bleiben.

Das Wertkonto prüft bei jedem Kandidaten dessen tatsächlichen Zeitstempel und Qualitätskennung. Ein fehlender, ungültiger oder veralteter Budgetpreis verdeckt keinen frischen direkten Tarifpreis mehr. Ohne brauchbaren aktuellen Preis bleibt der konfigurierte Festpreis mit Diagnosehinweis wirksam. Kanonische, ausdrücklich in EUR/kWh benannte Tarifzustände durchlaufen keine größenabhängige Cent-Umrechnung. Die Kompatibilitätsbehandlung älterer, nicht eindeutig benannter Preisquellen und deren bisherige Plausibilitätsgrenzen bleiben bestehen.

Die unabhängige Prüfung fand zusätzlich eine vorgelagerte Cent-Heuristik in `TarifVis`: ein bereits normierter Providerpreis von **3,25 EUR/kWh** kam dort als **0,0325 EUR/kWh** an. Aktueller Preis, Durchschnitt und Kurven verwenden deshalb jetzt den exakten eigenen Provider-Datenpunktvertrag beziehungsweise eine explizite Mapping-/Objekteinheit. Normierte Kurvenzeilen mit `total`, `startsAt` und `currency: EUR` bleiben EUR/kWh. Eindeutige Preise verwenden durchgehend die bereits bestehende Provider-Plausibilitätsgrenze ±100 EUR/kWh; untypisierte Altquellen behalten ihre Cent-Heuristik und bisherigen Grenzen. Status-Booleans werden auch im direkten TarifVis-Normalizer abgewiesen. Frische- und Betriebsfreigaben wurden dabei nicht erweitert.

## Kundenvertrag und Datenschutz

- Ein ausdrückliches Speichern der Tibber-Einstellungen setzt `resolutionMinutes: 15`, auch wenn zuvor 60 gespeichert war. Andere Anbieter, Zugangsdaten, vorhandene Ladepunkte und Betriebsfreigaben werden dadurch nicht umgestellt.
- `/config` liefert nur `tariffDisplay.currentSource`, `averageSource`, `currentUnit` und `averageUnit`. Quellen sind `provider`, `mapped` oder `none`; die erlaubten Einheiten sind fest begrenzt. Objektpfade, Endpunkte und Zugangsdaten werden darüber nicht veröffentlicht.
- Die eigenen Provider-Zustände für Durchschnittspreis, Frische und Status werden beim Öffnen der Oberfläche mitgeladen. Die Oberfläche kann damit eine bekannte Providerquelle unabhängig vom Freigabeschalter der Tarifoptimierung anzeigen. Diese Ergänzung aktiviert keine Regelung.

## Nachweise

`node --test test/eos-customer-tariff-api.test.cjs test/eos-customer-tariff-price-values.test.cjs`: **14 bestanden, 0 fehlgeschlagen, 0 übersprungen**. Darin sind tatsächliche HTTP-GET/PUT-Aufrufe, die geschützte Konfigurationspersistenz, ein tatsächlicher Core-Limits-Tick mit unverändertem physischen 15-kW-Netzlimit und die tatsächliche Wallet-Preisberechnung enthalten. Die sechs neuen Fälle prüfen fehlende Werte, Frische und Fallback, echte Null-/Negativpreise, den öffentlichen DTO und die Tibber-Umstellung mit erhaltenen bestehenden Einstellungen und Geheimnissen.

Zusätzlich durchläuft `test/eos-customer-tariff-price-chain.test.cjs` die tatsächliche Kette **Provider-Normalisierung → Provider-Publikation → DatapointRegistry → TarifVis-Tick → Core-Limits-Tick → Wallet** mit 3,25, 0, −0,24, 8,5 und −3,25 EUR/kWh. Alle drei Fälle einschließlich manueller Cent-/EUR-Zuordnung, strukturierten Kurven und unveränderter Frischegrenzen sind grün. Eine protokollierte Gegenprobe ersetzt ausschließlich TarifVis durch die unveränderte 9.0.18-Klasse: **0/3 grün**, konkret `0.0325 !== 3.25`; der aktuelle Stand besteht **3/3**. Beide vollständigen Protokolle liegen unter `tariff-price-chain-old-918` und `tariff-price-chain-919` in `setup-919`.

Zusammen mit der vorhandenen tatsächlichen Providerwechsel-/verspäteter-DB-Schreibtestdatei sind **19/19** fokussierte API-/Verbraucher-/Preisprüfungen grün. Die bestehenden `test:tariff-freshness-safety`, `test:tariff-storage-status-truth` und `test:energy-wallet-diagnostics` wurden nach der Einheitkorrektur unverändert erfolgreich ausgeführt.

Die strikten TypeScript- und typisierten ESLint-Prüfungen für `installer-lifecycle`, `storage-farm-overview`, `tariff-price` und `customer-tariff` sind erfolgreich. Die Runtime wurde aus der kanonischen TypeScript-Quelle erzeugt; generierte JavaScript-Dateien wurden nicht separat bearbeitet.

Die unveränderten Bestandsprüfungen `test:energy-wallet-diagnostics` und `test:core-limits-typed-runtime-phase1` wurden nach dem Fix erneut ausgeführt und sind grün. Protokolle: `legacy-energy-wallet-final` (0,263 s) und `legacy-core-limits-tariff-final` (0,606 s), jeweils über `setup-919/run-check.py` mit vollständigem Befehl und Log-Hash.

Dies ist ein Software-Regressionsnachweis mit simulierten Datenbank-/Hardwaregrenzen, kein Nachweis eines realen Tibber-Kontos, physischer Aktoren oder eines Dauerbetriebs. Provider-Abrufplanung, Kalender-/DST-Verarbeitung und Viertelstunden-Grafik werden in den gesonderten Tarifprüfungen nachgewiesen.
