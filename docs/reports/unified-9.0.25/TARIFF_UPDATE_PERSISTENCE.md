# Tarifanbieter bei Updates erhalten – unabhängige Prüfung 9.0.21 → 9.0.25

Stand: 25.11.2026. Die vom Nutzer bestätigte funktionierende Anlage läuft wieder auf 9.0.21. Diese Prüfung verwendet ausschließlich die Originalquellen von 9.0.21, den Recovery-Quellstand von 9.0.25 und synthetische Controllerdaten. Keine Liveanlage, keine echten Zugangsdaten und kein Anbieter-Cloudzugriff.

## Ergebnis

Die geprüften gespeicherten Tarifanbieter, Zugangsdaten, Preisformeln, Anbieterprofile, manuellen Preis-Zuordnungen und Tarif-Schalter bleiben beim Upgrade und wiederholten Neustart erhalten. **9/9 gezielte Laufzeitregressionen bestehen jeweils unter Node 22.23.4 und Node 24.22.3.** Es war für diesen Updatepfad keine Produktänderung erforderlich.

Die Testdaten wurden nicht lediglich nachgebaut: Die tatsächlich ausgeführte Originalfunktion `NexoWattVis.persistInstallerConfigToState` aus 9.0.21 hat die sechs gespeicherten Anbieter-Konfigurationen erzeugt. Diese unveränderten JSON-Werte sind als portable Fixture enthalten; alle Zugangsdaten sind ausdrücklich künstlich. Der aktuelle Test lädt diese Daten über die echten Laufzeitfunktionen, prüft die Migration und verwendet die echte geschützte Konfigurationsablage.

## Speichervertrag und geprüfte Grenzen

| Bestandteil | Tatsächlicher Speicher-/Startpfad | Geprüftes Verhalten |
| --- | --- | --- |
| Anbieterauswahl, Tokens, Profil, Preisformel, Tarif-Zuordnungen | `<UI-Namespace>.installer.configJson`, ACL `0x600`, `common.read:false` | Vorhandener State ist maßgeblich; normale Initialisierung schreibt weder normalisierte Defaults noch ältere Sicherungen darüber. Auch Timestamp, ACK und Qualität bleiben unverändert. |
| Dynamischer Tarif, Modus, feste Preise, Saisonprofil, zeitvariables Netzentgelt | `<UI-Namespace>.settings.*` | `ensureSettingsStates()` legt nur tatsächlich fehlende States an. Bestehende `false`- und `0`-Werte bleiben erhalten. |
| Native UI-Konfiguration nach Übernahme/gesonderter Speicherung | `eos-admin.N.modules.ui.configuration` | Echter `EosModuleConfigStore` speichert geschützt und verschlüsselt; neue Instanz lädt denselben Inhalt statt Paketdefaults. |
| Bereits übernommene alte UI | Geschützte Migrationsmetadaten mit `preserveNamespace:true` | `nexowatt-ui.N.installer.configJson` und bestehende Tarif-State-IDs bleiben erhalten. Es entsteht keine leere zweite Anbieter-Konfiguration im Host-Namespace. |
| Beschädigter oder nicht lesbarer bestehender State | `parseInstallerConfigState` / `loadInstallerConfigFromState` | Expliziter Fehler; keine Rücksetzung auf Defaults, kein Überschreiben durch ein älteres Backup. |

Quellstellen: `ui/src-ts/runtime-executables/main.ts`, Funktionen `ensureSettingsStates`, `nwNormalizeInstallerPatch`, `loadInstallerConfigFromState`, `persistInstallerConfigToState`, `migrateNativeConfig`; `ui/src-ts/runtime-executables/lib/preserved-ui-config.ts`; `src/lib/eosLegacyMigration.js`, Funktionen `candidate`, `saveUi`, `loadDestinations`, `verifyDestinations`; `src/lib/eosModuleConfigStore.js`.

Der zusätzliche unabhängige Quellvergleich bestätigt: Provider-Modul, Registry und Kunden-Tarif-Helfer sind gegenüber 9.0.21 unverändert. Speicherfunktion, native Migration, Installer-Normalisierung, Laufzeitübernahme, Sicherungsfunktionen und Secret-Merge sind ebenfalls unverändert. `loadInstallerConfigFromState` ergänzt lediglich eine Kennzeichnung vorhandener History-Installationen. Der korrigierte optionale OCPP-Inventarpfad verändert den Tarif-Speichervertrag nicht.

## Regressionen

Datei: `test/eos-customer-tariff-update-persistence.test.cjs`.

1. Sechs getrennte Fälle für Tibber, ENTSO-E, EnergyZero, Marktprofil, vorhandenes Custom-REST und manuelle Datenpunkte: Original-9.0.21-Speicherformat laden, zweimal neu konstruieren/startinitialisieren, tatsächliches Speichern und erneutes Laden. Anbieter, aktuelle und zurückbehaltene Test-Credentials sowie Einstellungen bleiben gleich. Es wird kein Custom-REST-Aufruf ausgeführt oder eine neue Auswahl dafür freigeschaltet.
2. Tatsächliche UI-Übernahme mit geprüftem Quellstopp, erhaltenem Namespace, verschlüsseltem Konfigurationsspeicher und anschließend erneut geladenem COMMITTED-Journal. Betriebsbereitschaft wird für den Journalabschluss als Controller-Fixture gemeldet; dies ist keine Hardwareprüfung.
3. Bestehende EOS-Konfiguration ohne Übergabejournal: geschützte UI-Konfiguration wieder laden, Tarife erhalten und externes altes OCPP unverändert separat lassen.
4. Nicht lesbare oder beschädigte vorhandene Daten: bisherige Laufzeit-Konfiguration erhalten, keine Backup-/Default-Rücksetzung.

Reproduzierbarer aktueller Test:

```sh
node --test --test-reporter=tap test/eos-customer-tariff-update-persistence.test.cjs
```

Rohbelege: `raw/tariff-update/node22.tap`, `raw/tariff-update/node24.tap`, `raw/tariff-update/reviewed-sha256.txt`. Der einmalige historische Fixture-Erzeuger liegt unter `raw/tariff-update/generate-921-fixture.cjs`; seine Quellpfade sind die dokumentierten Prüf-Workspaces. Der normale Regressionstest benötigt diese Workspaces nicht. Herkunft und SHA-256 der tatsächlich ausgeführten 9.0.21-Datei stehen in `test/fixtures/tariff-provider-9.0.21.json`.

## Separater Befund beim absichtlichen Speichern unter hoher DB-Latenz

Der unabhängige Review fand zusätzlich eine neue IPC-Bestätigungsgrenze: `src/lib/eosUiProcessWorker.ts` behandelt auch Konfigurations- und Objektwrites mit einer zweisekündigen Antwortfrist. Ein separater Reproduzent verwendet einen echten UI-Child, echtes IPC und die tatsächliche Funktion `persistInstallerConfigToState`; ausschließlich die Controller-Antwort wird um 2,2 Sekunden verzögert. Ergebnis: Nach etwa 2,013 Sekunden meldet die Funktion `false`, der neue Installer-State wird bei 2,2 Sekunden trotzdem committed, während der Child mit der bisherigen Laufzeitkonfiguration weiterläuft. Der vorhandene Stop-/Write-Drain wartet korrekt auf den bereits begonnenen Commit, gleicht die beiden Konfigurationen aber nicht ab.

Dies ist eine belegte Latenz-/Bestätigungsregression beim **expliziten Speichern**, kein nachgewiesener Verlust bestehender Anbieter beim Upgrade und kein nachgewiesener Fehler der Liveanlage. Nachweis: `raw/tariff-update/reproduce-config-ack.cjs` und `raw/tariff-update/config-ack-result.json`. Der danach ausdrücklich beauftragte enge Produktfix, seine Scope-/Zeitgrenzen und fünf zusätzliche echte Child-Regressionen je Node 22/24 sind separat in `UI_CONFIG_COMMIT_ACK.md` dokumentiert. Die neun Updatefälle wurden unverändert beibehalten; sie ersetzen diese Commit-Prüfung nicht.

## Aussagegrenze

Geprüft ist der Erhalt gespeicherter Kundendaten unter den beschriebenen Update-, Neustart- und Migrationspfaden. Ein absichtlich bestätigter Anbieterwechsel, beschädigte Datenträger, verlorene Controller-Schlüssel oder Anbieter-Störungen sind damit nicht ausgeschlossen. Es gibt weder eine gemessene RAM-Zusage noch eine hundertprozentige Verfügbarkeits- oder Hardwaregarantie. Globale Release-Tests werden separat dokumentiert und sind nicht in den neun Fällen enthalten.
