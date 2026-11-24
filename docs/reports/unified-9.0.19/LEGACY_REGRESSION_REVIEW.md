# Zusätzliche Bestandsregressionen 9.0.19

Geprüft wurden elf bestehende Funktionsgruppen einschließlich der nachgelagerten Netzlimitprüfungen. Alle fachlichen Szenarien sind erfolgreich. Die unveränderten historischen npm-Aufrufe haben drei gesondert dokumentierte Loader-/Metadatenfehler; diese werden nicht als ursprünglich grün ausgegeben.

## Aussage und Grenzen

- OCPP-Stabilität und OCPP21-/Speicher-Safety: unveränderte bestehende Skripte erfolgreich.
- Auto-PV: **37 bestehende Szenariogruppen** einschließlich realer Modul-Ticks und Phasenexecutor erfolgreich.
- Lademodus-Wiederherstellung: fünf ursprüngliche Skripte erfolgreich; der letzte isolierte LIVE-Modaltest benötigte die inzwischen vorhandenen tatsächlichen `getEvcsPowerW`-/`power-measurements.js`-Abhängigkeiten im VM-Kontext. Danach **48 bestanden, 0 fehlgeschlagen**; alle ursprünglichen Assertions unverändert.
- Funktionale Speichersicherheit und AppCenter-DP-Erhalt: ursprüngliche Skripte erfolgreich.
- Farm-Dispatch-Recovery und zusätzliche Topologieprüfung: alte Testloader erzwangen einen fehlenden Type-Detector und benutzten die entfernte eigenständige Adapterfactory. Im isolierten Testloader wurden die installierte Abhängigkeit und die tatsächliche Hosted-Runtime-Fassade verwendet; die bisherigen Fake-Datenbank-/Aktormethoden und alle fachlichen Assertions blieben unverändert. Beide Skripte sind so erfolgreich.
- Dauerhafter Netzschutz: unveränderte Gruppe erfolgreich. Die Import-Grid-Gruppe enthielt zusätzlich die obsolete Annahme eines aktiven Offline-Serviceworker-Caches. Nur diese Metadatenassertion wurde im isolierten Loader auf den inzwischen strengeren tatsächlichen Vertrag umgestellt: alte Caches löschen, Worker abmelden, keine Fetch-Interception. Sämtliche Netz-/Budget-/Safety-Assertions blieben unverändert und bestanden. Alle sechs zunächst durch `&&` nicht erreichten nachgelagerten Netzlimitskripte wurden einzeln unverändert ausgeführt und bestanden.
- History: **30 echte HTTP-/Deadline-Regressionen** bestanden, ohne übersprungene Fälle.
- Keine Produktquelle oder originale Testdatei wurde durch diese Zusatzprüfung geändert. Die Anpassungen sind ausschließlich im separaten dokumentierten `setup-919/legacy-test-loader.cjs`; jede Ausgabe nennt den Originalpfad, dessen SHA-256 und die konkrete Anpassung. Keine Assertions zu Steuerung, Grenzen oder Zustandsbestätigung wurden entfernt oder abgeschwächt.
- Kein Hardware-/Dauerlastnachweis. Testgeräte, Browser-DOM und IO sind wie in den ursprünglichen Szenarien simuliert. Die vollständige Releaseprüfung läuft zusätzlich.

## Protokollierte Aufrufe

Alle Aufrufe erfolgten über `setup-919/run-check.py`. Zu jedem Namen liegen `.log` und `.result.json` mit exaktem Befehl, Zeit, Exitcode und Log-Hash vor. **20 protokollierte Aufrufe, 17 grün, drei erhaltene Originalfehler**, danach fachlich vollständig grüne isolierte Wiederholungen. Summe der Prozesslaufzeiten: **10.369 Sekunden**; Loaderanalyse und Einrichtung sind darin nicht enthalten.

| Prüfung | Exitcode | Dauer s |
|---|---:|---:|
| legacy-auto-pv | 0 | 0.502 |
| legacy-charging-grid-cap-clamp | 0 | 0.283 |
| legacy-charging-grid-cap-safe | 0 | 0.356 |
| legacy-charging-mode-recovery | 1 | 0.862 |
| legacy-core-limits-phase1 | 0 | 0.57 |
| legacy-core-limits-phase2 | 0 | 0.501 |
| legacy-farm-dispatch-loader-current | 0 | 0.375 |
| legacy-final-write-envelope | 0 | 0.349 |
| legacy-history-http | 0 | 1.693 |
| legacy-import-grid-budget | 1 | 0.38 |
| legacy-import-grid-contract-current | 0 | 0.093 |
| legacy-live-mode-loader-current | 0 | 0.156 |
| legacy-load-grid-sanity | 0 | 0.322 |
| legacy-ocpp-stability | 0 | 0.505 |
| legacy-ocpp21-storage-safety | 0 | 0.472 |
| legacy-permanent-grid-protection | 0 | 1.109 |
| legacy-storage-dp-persistence | 0 | 0.456 |
| legacy-storage-farm-dispatch-recovery | 1 | 0.511 |
| legacy-storage-functional-safety | 0 | 0.477 |
| legacy-storage-topology-loader-current | 0 | 0.397 |
