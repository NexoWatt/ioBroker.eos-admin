# Zusätzlicher unabhängiger Code-Review für 9.0.14

Stand: 23.11.2026. Separate Prüfung durch einen zweiten Reviewer innerhalb derselben Entwicklungsarbeit, keine externe Zertifizierung. Geprüft wurden Bestandsmigration, Ownership, UI-Startdiagnose, Wiederherstellung und manueller Modulimport. Der Reviewer hat keine Produktdateien und keine Live-Anlage verändert; dieser Bericht ist seine einzige Dateiänderung.

## Ergebnis

Im abschließend geprüften Umfang bestehen keine offenen blockierenden Befunde. Zwei zusätzliche Fehler wurden während dieses Reviews gefunden, an den Implementierungsverantwortlichen übergeben, von diesem korrigiert und anschließend erneut geprüft. Die Aussage ersetzt weder die vollständigen Releaseprüfungen noch einen Test an der Kundenanlage.

Der vom Nutzer bestätigte Migrationsstatus `LICENSE_REQUIRED` passt zum bereits belegten Ablauf: Der Adapter wurde ohne gültigen Vertrauensanker gestartet und die Lizenz später aktiviert. Die Bestandsprüfung war in diesem Prozess noch nicht ausgeführt. Die Änderungen erlauben daraus keine nachträgliche Freigabe einer bereits mit Standardkonfiguration konstruierten Laufzeit. Ein vollständiger neuer Start muss zuerst die Quellen, Ziele und Zuständigkeiten prüfen.

## Zusätzlich gefundene und korrigierte Fehler

### Import während der Hostinitialisierung

Betroffene Datei: `src/lib/eosModuleHost.js`.

Ein frisch erzeugter Modulhost enthielt zunächst deaktivierte leere In-Memory-Einträge. `importLegacy()` konnte diesen Zwischenzustand als gespeicherte Deaktivierung akzeptieren. Parallel laufendes `start()` respektierte die Importsperre nicht und konnte eine tatsächlich aktivierte Zielkonfiguration laden und starten. Anschließend ersetzte der Import diese Konfiguration durch seine deaktivierte Kopie.

Die Reproduktion wurde als lokales Node-Skript über Standardeingabe ausgeführt, ausschließlich mit InMemory-Objekt-/State-Fixtures und einem Dummy-Modul ohne Gerätekommunikation:

1. Neuer Host; persistierte Devices-Konfiguration mit `enabled: true`, InMemory-Eintrag zunächst deaktiviert.
2. Manuellen Import einer bestätigt gestoppten Legacy-Quelle beginnen; Konvertierung an einem kontrollierten Promise pausieren.
3. Währenddessen `await host.start()` ausführen: Der Dummy-Zielruntime startet einmal.
4. Konvertierung freigeben und Import abwarten: Eine Zielkonfiguration wird gespeichert, das Ziel ist anschließend deaktiviert.

Die tatsächlich beobachtete Ausgabe lautete:

```json
{"runtimeStartedDuringImport":1,"persistedImports":1,"targetEnabledAfterImport":false}
```

Für diese einmalige Reproduktion wurde keine eigenständige Rohlogdatei gespeichert. Die obige Ausgabe ist aus dem ausgeführten Prozess übernommen, keine nachträglich erzeugte Logdatei.

Die Korrektur wurde danach im Quellcode und in Regressionstests geprüft:

- `startPromise` fasst gleichzeitige Startaufrufe zusammen.
- Die Initialisierung reserviert dieselbe Mutationssperre wie Speichern und Import.
- `initialized` wird erst nach Konfigurationslesen, Subscriptions und Stopprüfungen gesetzt.
- `configLoaded` unterscheidet einen erfolgreich geladenen Eintrag von einem leeren Standardwert oder einem Lesefehler.
- Speichern und Import bleiben vor bestätigter Initialisierung beziehungsweise bei ungeladener Zielkonfiguration gesperrt.
- `canOperate()` und `reconcile()` verlangen den initialisierten Host.
- Die Importvoraussetzungen werden nach der asynchronen Konvertierung erneut geprüft.

Insbesondere bleibt auch ein wegen Migrationsblockade absichtlich nicht gestarteter Host geschlossen. Sein leerer Zwischenzustand darf keine Kundenkonfiguration ersetzen. Ein fehlgeschlagener Konfigurationslesevorgang wird nicht über einen vermeintlichen Reparatur-Save mit Standardwerten umgangen.

### Falscher Zielpräfix im Backup-Importbericht

Betroffene Datei: `src/lib/eosModuleHost.js`, Ergebnis von `importLegacy()`.

Der Bericht setzte für sämtliche Nicht-Devices-Module den EEBus-Präfix ein. Für Backup war deshalb `.eebus.` statt `.backup.` angegeben. Der Bericht verwendet jetzt die tatsächliche Modul-ID. Diese Änderung korrigiert die Diagnose; sie schreibt keine vorhandenen Datenpunkte um. Ein zusätzlicher Regressionstest bestätigt den Backup-Präfix.

## Weitere geprüfte Grenzen

| Bereich | Ergebnis der Quellcodeprüfung |
| --- | --- |
| `src/lib/eosLegacyMigration.js` | `LICENSE_REQUIRED` sperrt neue operative Starts und Writes. Spätere Aktivierung ändert die Diagnose auf `EOS_MIGRATION_RESTART_REQUIRED`, führt aber keine Migration in die bestehende Laufzeit aus. |
| `src/lib/eosUnifiedOwnership.js` | Eine Migrationssperre wird von abgelaufenem Controller-Nachweis unterschieden. Die Diagnose selbst verleiht keine Zuständigkeit. |
| `src/lib/web.ts` | Die Bereitschaftsbrücke liefert einen lesenden Snapshot; der getrennte operative Start bleibt bei blockierter Migration geschlossen. |
| `ui/src-ts/runtime-executables/lib/hosted-startup-status.ts` | Statusfelder, Codes und Instanznamen werden begrenzt übernommen. Freie Fehlermeldungen, Konfigurationen und Zugangsdaten werden nicht weitergereicht. |
| `ui/src-ts/runtime-executables/main.ts` | Authentifizierung, Rollen und CSRF bleiben vor den Schreiboperationen wirksam. Ein gesperrter Restore erreicht die eigentliche Importmutation nicht. |
| `ui/src-ts/runtime-executables/lib/hosted-adapter.ts` | Der Restore liest für seine eigene beziehungsweise übernommene UI-Identität die aktuelle geschützte EOS-UI-Konfiguration; ein vermuteter Rückgriff auf veraltete Legacy-Native-Daten bestätigte sich nicht. |
| Modulimport | Bestehende Original-Namespace-Bindungen blockieren manuellen Reimport. Quellreaktivierung oder Hoststopp während der Konvertierung verhindern die Speicherung. |

Ein vorhandenes Backup bei gleichzeitig abgewiesenem Restore ist erklärbar: GET `/api/installer/backup/userdata` bleibt administrativ lesbar, während der globale Startschutz POST `/api/installer/backup/import` bereits vor dem Restorehandler abweist. Das beweist keine beschädigte Sicherung. Der App-Center-Import ist außerdem kein Ersatz für eine vollständige Native-/SmartHome-/Namespace-Übernahme.

## Tatsächlich ausgeführte unabhängige Nachtests

Arbeitsverzeichnis war die Repositorywurzel, Laufzeit Node.js `v24.22.3`. Die folgenden Befehle wurden vom Reviewer selbst ausgeführt. Ihre Ausgaben erschienen als Prozessergebnis im Arbeitsprotokoll; es wurden dafür keine separaten Rohlogdateien umgeleitet. Die Testmengen überschneiden sich und werden nicht zu einer Zahl unterschiedlicher Tests addiert.

Vor dem zusätzlichen Initialisierungsfix:

```sh
node --test test/eos-unified-ownership.test.cjs test/eos-module-legacy-migration.test.cjs test/eos-module-migration-review.test.cjs test/eos-module-import-recovery.test.cjs
```

Ergebnis: **72 bestanden, 0 fehlgeschlagen, 0 übersprungen**.

```sh
node --test ui/test/unified/hosted-startup-status.test.cjs test/eos-unified-migration-startup.test.cjs test/eos-module-migration-page.test.cjs
```

Ergebnis: **22 bestanden, 0 fehlgeschlagen, 0 übersprungen**. Enthalten sind die tatsächlichen HTTP-Routen mit kontrollierten Fixtures, blockierte Restoreoperationen, unveränderte Konfiguration/States sowie die Status-/Linkdarstellung im DOM-Modell.

Nach dem zusätzlichen Initialisierungsfix und der Präfixkorrektur:

```sh
node --test test/eos-module-import-recovery.test.cjs test/eos-module-host.test.cjs test/eos-module-editor-session.test.cjs
```

Ergebnis: **37 bestanden, 0 fehlgeschlagen, 0 übersprungen**. Insbesondere bestanden die neuen Fälle für noch nicht gestartete Hosts, überlappende Initialisierung, gemeinsam abgewartete Startaufrufe, unlesbare gespeicherte Ziele und den tatsächlichen Backup-Zielpräfix.

## Bereits vorhandene Rohbelege anderer Teilprüfungen

Die folgenden echten Dateien wurden bei Erstellung dieses Berichts gelesen. Sie stammen aus den separat ausgeführten Teilprüfungen, nicht aus den drei oben genannten unabhängigen Aufrufen. Die Pfade benennen die damalige lokale Prüfumgebung und liegen außerhalb des Repositorys; dieser Bericht behauptet nicht, dass sie in einer Repository-ZIP enthalten sind.

| Tatsächlicher Logpfad | Gelesenes Ergebnis |
| --- | --- |
| `/workspace/scratch/741f792566ea/setup-914/migration-node24.log` | 68 bestanden, 0 fehlgeschlagen, 0 übersprungen |
| `/workspace/scratch/741f792566ea/setup-914/ui-startup-status-final-node24.tap` | 10 bestanden, 0 fehlgeschlagen, 0 übersprungen |

Die vollständigen Node-22-/Node-24-Releaseprüfungen werden vom Releaseverantwortlichen separat dokumentiert. Laufende Gesamtprüfungen sind hier nicht vorweggenommen.

## Controller-Zugriffsgrenze anhand der Originalquelle

Für js-controller 7.2.5 wurden die offiziellen Quellen gelesen:

- [Adapterimplementierung, `getForeignObject`](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/adapter/src/lib/adapter/adapter.ts#L5485)
- [Ausnahmen für geschützte Native-Felder](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/adapter/src/lib/adapter/constants.ts#L15)

Der Controller entfernt fremde `protectedNative`-Werte abhängig vom Adapternamen. Ausgenommen sind `admin`, `iot`, `cloud`, `discovery` sowie der eigene Adaptername. `eos-admin` ist keine dieser Ausnahmen; eine Benutzeroption mit Administratorkennung ersetzt diese Prüfung nicht. Dasselbe Schutzverhalten besteht bei Mehrfachlesezugriffen und Objektänderungsereignissen. Der Patch führt keinen Ersatzweg über ungefilterte Objektlisten ein.

Die vorhandenen Originalstände Devices 0.5.176 und EEBus 0.3.0 sowie die UI 1.0.38 aus dem historischen Alpha-Archiv weisen in ihren Paketmetadaten keine solchen Felder aus. Der exakte ursprüngliche UI-Stand 1.0.37 war hier nicht separat verfügbar. Backup 1.0.10 weist dagegen elf geschützte und verschlüsselte Felder aus. Eine allgemeine Zusage, sämtliche geschützten Geheimnisse automatisch übernehmen zu können, ist damit nicht belegt.

## Abnahmegrenzen

Es erfolgten keine Zugriffe auf die laufende Kundenanlage, keine realen Gerätebefehle und keine npm-Veröffentlichung. Die Prüfungen ersetzen keine Bestandsabnahme mit tatsächlichen Geräteanzahlen, erhaltenen Original-IDs, EMS-Zuordnungen, Messwerten und bestätigter einzelner Reglerzuständigkeit. Vorhandene Zielkonfigurationen, deaktivierte alte UI-Instanzen, beschädigte Zustände und nicht bestätigte Stopps bleiben echte mögliche Vorprüfungsgründe und dürfen nicht durch Löschen oder erzwungene Freigaben umgangen werden.
