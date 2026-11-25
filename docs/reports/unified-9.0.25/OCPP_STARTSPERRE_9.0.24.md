# Korrektur der gemeinsamen Startsperre durch externes OCPP

Stand: 25.11.2026. Zielstand: Recovery 9.0.25. Diese Korrektur enthält keine RAM-Optimierung.

## Belegter Anlagenfehler

Nach Installation von 9.0.24 meldete der Nutzer ausgefallene Geräte. Die Prozessdiagnose zeigte einen laufenden Admin- und UI-Prozess, jedoch `EMS bereit: Nein`, keine gestarteten Geräte-/EEBUS-/Backup-Prozesse und weiterhin einen laufenden externen Adapter `ocpp21.0`.

Der vom Nutzer gelieferte Zustand `info.legacyMigration` lautete:

```json
{
  "phase": "BLOCKED",
  "code": "EOS_MIGRATION_SOURCE_VERSION",
  "sources": [
    { "id": "ocpp", "source": "ocpp21.0", "namespacePreserved": false }
  ],
  "updatedAt": null
}
```

Damit ist der gemeinsame Migrations-Startblock belegt. Eine bestimmte alte OCPP-Versionsnummer wurde durch diesen Zustand nicht mitgeteilt. Die Regressionstests verwenden dafür ausdrücklich eine synthetische Version `0.2.2`.

Der Nutzer hat anschließend bestätigt, dass nach Rückkehr zu **9.0.21 wieder alles läuft**. Das ist eine erfolgreiche Wiederherstellung laut Nutzerbeobachtung, keine unabhängig durchgeführte Hardwareabnahme. Der versiegelte 9.0.24-Lieferstand wurde bei der Untersuchung nicht geändert.

## Ursache und Änderung

9.0.24 nahm externe `ocpp21`-Instanzen neu in die automatische Erstinventur auf. Ohne vorhandenes Migrationsjournal konnte eine nicht unterstützte OCPP-Version deshalb `BLOCKED` auslösen. `web.ts` prüft diesen gemeinsamen Zustand vor beiden Aufrufen `eosModuleHost.start()` und `eosHostedRuntime.startOperational()`. Dadurch blieb auch bereits konfigurierte Geräte-/EMS-Funktionalität gesperrt; die vorher gestartete, authentifizierte Oberfläche war weiterhin erreichbar.

`src/lib/eosLegacyMigration.js` überspringt OCPP jetzt ausschließlich bei der impliziten Auswahl neuer Migrationskandidaten. Ein vorhandener externer OCPP-Adapter bleibt standardmäßig eigenständig. Eine Übernahme ist weiterhin über die vorhandene ausdrücklich ausgelöste OCPP-Importfunktion möglich; deren bestätigter Altstopp, Konfigurationsprüfung, Namespace-Erhalt und zunächst deaktivierte neue Konfiguration bleiben bestehen.

OCPP bleibt in der Liste unterstützter Journalquellen und in der Versions-/Namespaceprüfung. Bereits vorhandene `TRANSFERRED`-/`COMMITTED`-Journale werden weiterhin geprüft und berücksichtigt. Ein fehlendes geschütztes Migrationsziel oder ein unbestätigter Stop bleibt eine Sperre. Lizenzprüfung, Eigentümerschaft, alte Geräteprüfungen und Prozesse bleiben unverändert.

Eine erfolgreiche Inventur ohne Übernahme veröffentlicht außerdem `NOT_NEEDED` erneut. Dadurch bleibt nach dem Neustart nicht der alte, nur diagnostisch gespeicherte `BLOCKED`-Zustand in `info.legacyMigration` stehen. Es entsteht dabei kein künstliches Übergabejournal.

## Nachweise

| Prüfung | Ergebnis |
| --- | --- |
| Derselbe neue Regressionstest gegen unveränderte 9.0.24-Migrationsklasse | Fehler vor Korrektur reproduziert: `BLOCKED` statt `NOT_NEEDED` |
| Externes OCPP mit unbekannter oder unterstützter Version; zwei externe Instanzen; fehlender Grant für eingebettetes OCPP | Vorhandene gültige Devices-Konfiguration bleibt startfähig; externe Instanzobjekte, Alive-/Messwerte und ursprüngliche Geräte-Konfiguration unverändert |
| Tatsächlicher Devices-Worker nach vorherigem diagnostischem Live-Fehlerzustand | Eigener PID, `RUNNING`, alte OCPP-Instanz bleibt unangetastet, Hosted-OCPP deaktiviert; Controllerdatenbank simuliert, keine physische Hardware |
| Früheres OCPP-`TRANSFERRED`-/`COMMITTED`-Journal | Geprüftes Migrationsziel und ursprünglicher Namespace bleiben aktiv; fehlendes Ziel blockiert weiterhin |
| OCPP-Rollback und manuelle Übernahme | Stopbestätigung, Rückgabe des Originalnamensraums, Marker-Freigabe und geänderte Quellen weiterhin geprüft |
| Core-Lizenz fehlt oder tatsächlich zu migrierendes Devices-Quellobjekt ist ungültig | Start bleibt gesperrt |
| Fünf betroffene Migrationssuiten, Node 22.23.4 | **69/69 bestanden**, keine übersprungenen Tests |
| Dieselben Suiten, Node 24.22.3 | **69/69 bestanden**, keine übersprungenen Tests |
| ESLint für die geänderte Migrationsdatei | Bestanden |

Betroffene Testdateien:

- `test/eos-ocpp-optional-migration.test.cjs` – neue Reproduktion und tatsächlicher Devices-Prozessstart.
- `test/eos-ocpp-host-migration.test.cjs` – manuelle Übernahme und früher persistierte OCPP-Journale.
- `test/eos-module-legacy-migration.test.cjs`.
- `test/eos-module-migration-review.test.cjs`.
- `test/eos-module-migration-start-budget.test.cjs`.

Zusätzlicher Gegencheck: Die tatsächliche Migrations- und ConfigStore-Implementierung aus dem originalen 9.0.21-Archiv erzeugte im Labor ein `COMMITTED`-Gerätejournal. Das anschließende Laden durch 9.0.24 mit weiter laufendem externem OCPP startete die Geräte korrekt. Damit wurde nicht pauschal das Vorhandensein eines externen OCPP-Prozesses als Ursache behauptet; relevant war der belegte Pfad **ohne abgeschlossenes früheres Journal**.

Die Prozesstests liefen unter Linux/x64 mit synthetischer Controllerdatenbank. Ein 9.0.25-Test auf der konkreten Raspberry-Pi-Anlage und die Prüfung der physischen Geräte stehen noch aus. Die 69 Tests sind ein abgegrenzter Migrationsnachweis und keine Behauptung über eine vollständige Release- oder Anlagenabnahme. Die parallel geplanten Bedienknöpfe für Prozessstart/-stop/-neustart werden durch diesen Bericht nicht mitgeprüft.
