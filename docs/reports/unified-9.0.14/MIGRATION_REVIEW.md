# Bestandsübernahme und Spätlizenz – Prüfung für 9.0.14

Stand: 23.11.2026. Dieser Bericht beschreibt Codeprüfung und lokale Regressionstests. Er bestätigt keine erfolgreiche Übergabe auf der Kundenanlage.

## Belegter Fehler: Freigabe nach dem ersten Start

Die Bestandsübernahme wird beim Adapterstart vor dem Aufbau der integrierten Laufzeiten ausgeführt. Ohne gültige zentrale Lizenz endet diese Prüfung vor der Inventur mit `LICENSE_REQUIRED`. Bis einschließlich des untersuchten Ausgangsstands war diese Phase in `allowsStartup()` und damit `allowsWrites()` nicht gesperrt. Eine spätere Lizenzaktivierung startete keine erneute Bestandsprüfung. Sobald die separate Controller-Eigentumsprüfung frei war, konnten dadurch Laufzeiten mit noch nicht übernommenen Einstellungen starten.

Die nachgereichten Live-Logs zeigen diese Reihenfolge: Start von 9.0.12 ohne Vertrauensanker, späterer Import des Vertrauensankers und Lizenzaktivierung, danach kein dokumentierter Neustart. Die danach vom Nutzer aufgerufene Übernahmeseite bestätigt `LICENSE_REQUIRED`; UI und Devices sind laut Nutzer weiterhin eingeschaltet. Damit ist der fehlende erneute Migrationslauf belegt. Ob weitere Blockaden durch bereits gespeicherte Zielkonfigurationen oder fehlende geschützte Felder vorliegen, muss die vollständige Vorprüfung zeigen. Der Screenshot `EOS_UI_STARTING` allein beantwortet diese Frage nicht.

9.0.14 hält `LICENSE_REQUIRED` bis zum nächsten vollständigen Startlauf für neue operative Laufzeiten und Schreibzugriffe gesperrt. Der Status unterscheidet:

| Zustand | Diagnose | Bedeutung |
| --- | --- | --- |
| Systemfreigabe weiterhin ungültig | `EOS_MIGRATION_LICENSE_REQUIRED` | Übernahme noch nicht geprüft |
| Systemfreigabe inzwischen gültig | `EOS_MIGRATION_RESTART_REQUIRED` | Adapterneustart erforderlich, damit die vollständige Vorprüfung vor dem Betrieb erfolgt |

Es wird weder automatisch neu gestartet noch die Migration an einer bereits aufgebauten Runtime wiederholt. Letzteres würde bereits gebundene Namespaces und beim Modulstart geladene Konfigurationen nicht zuverlässig neu aufbauen. Auch eine frische Installation prüft nach diesem Neustart die dann leere Altadapterinventur und erreicht `NOT_NEEDED`. Ein ungültiger Lizenzstatus oder ein Fehler beim diagnostischen Lesen erteilt keine Betriebsfreigabe.

Die Wiederherstellungsseite zeigt bei inzwischen gültiger Lizenz ausdrücklich den noch notwendigen Neustart statt weiterhin eine fehlende Lizenz zu behaupten. `updatedAt` bleibt der tatsächlich gespeicherte Journalzeitpunkt beziehungsweise `null`; aus einer rein lesenden Statusabfrage entsteht kein erfundener Übergabezeitpunkt.

## Belegter Diagnosefehler: Eigentumsfreigabe

Eine gültige Controller-Prüfung bei gleichzeitig gesperrter Bestandsübernahme wurde bisher pauschal als `EVIDENCE_EXPIRED` angezeigt. Jetzt lautet dieser Zustand `MIGRATION_BLOCKED`. Zusätzlich werden ausschließlich eine validierte bekannte `phase` und ein begrenzter Diagnose-`code` ausgegeben. Konfiguration, verschlüsseltes Journal, Quelleninhalte und Fehlertexte werden nicht weitergereicht.

Die synchrone Entscheidung `canWrite()` bleibt unverändert. Ein aktiver konkurrierender Altregler behält seinen Controller-Blockadegrund; eine zusätzliche Migrationssperre wird nur ergänzend sichtbar. Weder eine Anzeige noch ein späterer Lizenzstatus hebt einen Stopnachweis, eine Eigentumssperre oder einen Rollbackzustand auf.

## Geschützte Altadapterfelder: tatsächliches Controller-Verhalten

Die Prüfung verwendete das unveränderte npm-Originalpaket `@iobroker/js-controller-adapter@7.2.5`, SHA-1 des Tarballs `a3297168ef48a3a9f36857e1460e600c23a93d8e`. In `build/esm/lib/adapter/adapter.js`, `_getForeignObject()` ab Zeile 3200, entfernt der Controller die unter `protectedNative` genannten Felder, wenn der lesende Adapter weder derselbe Adapter noch in der Ausnahmeliste ist. `build/esm/lib/adapter/constants.js:15` enthält `admin`, `iot`, `cloud` und `discovery`; `eos-admin` gehört nicht dazu. `options.user = system.user.admin` ändert diese Adaptername-Prüfung nicht. Entsprechende Filter sind auch in den Mehrfachabfragen und bei Objektänderungen vorhanden.

Primärquellen:

- [ioBroker js-controller 7.2.5, Adapterimplementierung](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/adapter/src/lib/adapter/adapter.ts)
- [ioBroker js-controller 7.2.5, Ausnahmeliste](https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/adapter/src/lib/adapter/constants.ts)
- [Unverändertes npm-Paket](https://registry.npmjs.org/@iobroker/js-controller-adapter/-/js-controller-adapter-7.2.5.tgz)

Die EOS-Vorprüfung benutzt deshalb weiter die geschützte Adapterabfrage und stoppt bei `EOS_MIGRATION_PROTECTED_FIELDS_UNAVAILABLE`, bevor ein Altadapter verändert wird. Ein ungefilterter View, eine neue Adapteridentität oder leere Ersatzpasswörter sind keine zulässige Übergabe. Für betroffene Altadapter bleibt eine explizite, geprüfte Bereitstellung der geschützten Einstellungen erforderlich. Diese Änderung implementiert keine Umgehung und behauptet keine vollständige automatische Übernahme solcher Daten.

## Weitere überprüfte Grenzen

- UI-Versionen 1.0.37 und 1.0.38 sind bereits in der geprüften Versionsliste enthalten. Eine Sicherungsanzeige mit 1.0.38 beweist allerdings nicht, dass diese Daten als operative Zielkonfiguration übernommen wurden.
- Eine absichtlich deaktivierte alte UI wird weiterhin mit `EOS_MIGRATION_DISABLED_UI_REVIEW` blockiert. Sie automatisch in einen aktiven EMS-Regler umzuwandeln wäre eine nicht bestätigte Betriebsänderung.
- Eine gespeicherte Zielkonfiguration wird nicht durch den Altbestand überschrieben, auch wenn sie nur bewusst gespeicherte Standardwerte enthält. `EOS_MIGRATION_DESTINATION_CONFIGURED` erfordert eine Prüfung des Bestands.
- Der manuelle Geräteimport benötigt weiterhin ein deaktiviertes Ziel und einen bestätigten Stop der alten Quelle. `EOS_MODULE_IMPORT_REQUIRES_DISABLED` ist diese Schutzbedingung und kein Beleg, dass die Quellkonfiguration verloren ist.
- Bisherige Datenpunktnamen, kundeneigene States, History-Metadaten, verschlüsselte Einstellungen und Rollbacknachweise bleiben erhalten. Unbestätigte Befehle werden nicht nachgespielt.
- Separat an die Geräteprüfung übergeben wurde ein belegter Altformatfehler: Devices 0.5.176 unterstützt eine leere `devices`-Liste neben einer gefüllten `devicesJson`-Liste (`main.js`, `autoMigrateLegacyDevicesJson`, ab Zeile 207). Die vorherige vereinheitlichte Validierung verwarf diese JSON-Liste. Die Korrektur gehört in die explizite Altformatübernahme, ohne ein absichtliches Leeren heutiger Einstellungen umzudeuten.

## Verifikation

Ausgeführt mit Node.js 22.23.4 und Node.js 24.22.3:

```text
node --test test/eos-unified-ownership.test.cjs
            test/eos-module-legacy-migration.test.cjs
            test/eos-module-migration-review.test.cjs
            test/eos-module-migration-page.test.cjs
```

Ergebnis je Lauf: **68 bestanden, 0 fehlgeschlagen, 0 übersprungen**. Rohprotokolle der Arbeitsprüfung: `setup-914/migration-node22.log`, `setup-914/migration-node24.log`. ESLint für `src/lib/eosLegacyMigration.js` und `src/lib/eosUnifiedOwnership.js` mit `eslint.unified.config.mjs`: Exitcode 0.

Neue Regressionen prüfen insbesondere den nachträglichen Lizenzwechsel ohne neue Inventur, die danach erforderliche vollständige Übernahme mit erhaltener UI-Konfiguration und ursprünglichem Namespace, eine frische Installation ohne Altbestand, die korrekte Ownership-Diagnose ohne interne Daten sowie die lesende Wiederherstellungsanzeige. Vorhandene Negativtests decken unter anderem fehlende Stopbestätigung, verlorene Zielkonfiguration, geschützte Felder, deaktivierte Alt-UI, Zeitüberschreitungen und Rollbackrennen ab.

Die Tests verwenden synthetische Instanzen und simulierte Controllerdaten. Sie ersetzen weder die noch ausstehende vollständige Vorprüfung auf der Live-Anlage noch einen Hardwaretest, einen physischen Stopnachweis oder eine Abnahme der tatsächlichen Kundenkonfiguration.
