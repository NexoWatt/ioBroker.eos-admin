# Unabhängiger Review: optionale OCPP-Migration

Datum: 2026-11-25. Prüfer: separater Review-Agent, nicht Autor des Migrationsfixes.

**Ergebnis: kein Blocker im geprüften Migrationsfix gefunden.** Der Fix beseitigt die bestätigte Startblockade durch eine externe OCPP-Instanz, ohne bereits persistierte Übernahme- oder Rückrollsperren zu umgehen. Es wurden keine Produktdateien durch diesen Review geändert; die versiegelte Quelle 9.0.24 blieb unverändert.

## Bestätigter Fehler und gezielte Änderung

Der gemeldete Livezustand war `BLOCKED / EOS_MIGRATION_SOURCE_VERSION` mit ausschließlich `ocpp21.0` als Quelle und ohne persistiertes Migrationsjournal. Die Diagnose passt zur gemeinsamen Startschranke in `src/lib/web.ts:3635`: Sie verhindert sowohl `eosModuleHost.start()` als auch `startOperational()`. Dadurch kann die Oberfläche bereits erreichbar sein, während Devices, EEBUS, Backup und EMS noch nicht starten.

Der Vergleich mit der versiegelten 9.0.24 zeigt in `src/lib/eosLegacyMigration.js` genau zwei Änderungen:

- Zeile 327 überspringt OCPP ausschließlich beim erstmaligen automatischen Kandidatenscan. Eine vorhandene externe OCPP-Instanz wird dabei weder importiert noch gestoppt, umkonfiguriert oder als neuer eingebetteter Listener gestartet.
- Zeilen 345–350 veröffentlichen `NOT_NEEDED`, damit ein vorheriger rein diagnostischer `BLOCKED`-Status nach Neustart ersetzt wird. Es entsteht dabei kein Übernahmejournal.

## Geprüfte Schutzgrenzen

| Grenze | Befund und Codebezug |
| --- | --- |
| Bestehende OCPP-Journale | OCPP bleibt in `SOURCES` und `VERSIONS` (Zeilen 10–11). `prepare()` lädt und validiert vorhandene Journale vor dem neuen Scan (283–305). `TRANSFERRED` und `COMMITTED` prüfen weiterhin die persistierten Zielbindungen; fehlende Ziele blockieren. |
| Unterbrochene Übergabe | `PREPARED`/`STOPPING` und bestätigte Rückrollphasen behalten den bisherigen Wiederherstellungspfad. `ROLLBACK_REQUIRED` und `ROLLED_BACK` bleiben sperrend. Die Änderung ergänzt keinen Neustart- oder Freigabeweg. |
| Manuelle OCPP-Übernahme | `eosModuleHost.js:1033` verlangt weiterhin eine geeignete, ausgeschaltete Quelle der Version 0.4.2/0.4.3. Vor und nach asynchroner Konvertierung werden Besitz und Stopnachweise geprüft; Quelle, Version, Einstellungen und Host werden erneut gebunden (1071–1088). Der importierte Zielzustand bleibt `enabled:false`; alte IDs bleiben erhalten. |
| Doppelter OCPP-Listener | `inspectOwnership()` (256–285) sperrt den eingebetteten Listener bei aktiver oder nicht nachweislich gestoppter externer Instanz. Der automatische Kandidatenscan ist nicht diese Betriebsfreigabe. Die betreffenden Besitz- und Importprüfungen sind gegenüber 9.0.24 unverändert. |
| Andere Migrationen und Lizenz | Ungültige echte Devices-Migrationsquellen blockieren weiterhin. Die zentrale Lizenzprüfung vor dem Kandidatenscan bleibt erhalten. Bestehende UI-/Devices-/EEBUS-/Backup-Übernahmen werden durch den OCPP-Ausschluss nicht übersprungen. |
| Datenbestand | Die neue Regression vergleicht externe OCPP-Objekte und States sowie das vorhandene verschlüsselte Devices-Konfigurationsobjekt unverändert. Kein Replay von Steuerzuständen und keine implizite OCPP-Zielkonfiguration. |

Andere Änderungen an der Prozesssteuerung in `eosModuleHost.js` sind ein separater Reviewumfang. Dieser Bericht bewertet die genannten Migrations-, Import- und Besitzgrenzen und führt Tests gegen den aktuellen Recovery-Stand aus.

## Selbst ausgeführte Prüfungen

Unter **Node 24.22.3 und Node 22.23.4 jeweils 103/103 erfolgreich**, 0 fehlgeschlagen, 0 übersprungen. Ausgeführt wurde jeweils:

```sh
node --test --test-timeout=180000 --test-concurrency=4 \
  test/eos-ocpp-optional-migration.test.cjs \
  test/eos-ocpp-host-migration.test.cjs \
  test/eos-module-legacy-migration.test.cjs \
  test/eos-module-migration-review.test.cjs \
  test/eos-unified-migration-startup.test.cjs \
  test/eos-module-migration-start-budget.test.cjs \
  test/eos-unified-ownership.test.cjs
```

Für Node 22 wurde `/workspace/scratch/741f792566ea/node22-runtime/package/bin/node` verwendet. Die Suites enthalten insbesondere frühere `TRANSFERRED`-/`COMMITTED`-OCPP-Journale, fehlende Ziele, unbestätigten Runtime-Stopp, manuelle Übernahme mit nachträglich veränderter Quelle, konkurrierende Controller, tatsächlichen `onReady()`-Start sowie eine reale Devices-Kindprozessinstanz nach vorheriger BLOCKED-Diagnose.

Ein zusätzlicher unabhängiger Vergleich führt dieselbe synthetische Controller-Fixture gegen die tatsächlichen Migrationsklassen aus 9.0.22, versiegelter 9.0.24 und dem Fixstand aus:

| Fixture ohne vorheriges Journal | 9.0.22 | 9.0.24 | Fixstand |
| --- | --- | --- | --- |
| Externe OCPP-Version 0.2.2 | `NOT_NEEDED`, Start erlaubt | `SOURCE_VERSION`, blockiert | `NOT_NEEDED`, Start erlaubt |
| Zwei externe OCPP-Instanzen 0.4.3 | `NOT_NEEDED`, Start erlaubt | `AMBIGUOUS`, blockiert | `NOT_NEEDED`, Start erlaubt |
| Externes OCPP 0.4.3 ohne eingebettete OCPP-Modulfreigabe | `NOT_NEEDED`, Start erlaubt | `MODULE_LICENSE_REQUIRED`, blockiert | `NOT_NEEDED`, Start erlaubt |

In allen neun Vergleichsläufen blieben die externe Aktivierung und die vorhandene Devices-Konfiguration unverändert. Die Version 0.2.2 ist ein reproduzierbarer Testwert für eine nicht unterstützte Version, keine Behauptung über die genaue Version der Kundeninstallation.

Rohbelege im Arbeitsverzeichnis `/workspace/scratch/b0b00b64c39c/incident-924-flow/`:

- `recovery-review-node24.tap`
- `recovery-review-node22.tap`
- `recovery-comparison.cjs`
- `recovery-comparison-result.json`

## Quellbindung und Grenzen

SHA-256 zum Reviewzeitpunkt:

```text
ab8f406aa8ae340d4698a67eb1405f273bb39b09d23ab73711bf542ca77c66e2  src/lib/eosLegacyMigration.js
435b2febd8b84c4e8c29fdcf9ff0acd53879fc6f771b675e5271cc07823e230c  src/lib/eosModuleHost.js
7b09daee4536a5b380184625e1514d1c267165df146437a22ae4babc23f9cdc2  test/eos-ocpp-optional-migration.test.cjs
1746f0bca6a90bcab24c84ec430443cec8a21d5f4ca3c3f96067acf4dd4c7858  test/eos-ocpp-host-migration.test.cjs
```

Die Datenbank ist synthetisch; die untersuchten Klassen und die Devices-Kindprozessinstanz sind echt. Keine Installation auf dem Kundensystem, keine Kommunikation mit realen Geräten und kein Nachweis physischer Lade-/Schaltwirkung wurden durchgeführt. Der Review belegt die gezielte Korrektur der bestätigten Startursache und den Erhalt der geprüften Sperren; er ist keine Freigabe aller übrigen Releaseänderungen oder eine Zusage vollständiger Anlagenzuverlässigkeit.
