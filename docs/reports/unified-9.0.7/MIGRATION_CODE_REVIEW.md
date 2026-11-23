# Unabhängige interne Prüfung der Bestandsübernahme

Stand: 2026-11-23. Geprüft wurden der Migrationskoordinator, die geschützte Modulablage, die Namespace-Abbildung der eingebetteten UI sowie die Schnittstellen zu Ownership und Start-/Stoppablauf. Dies ist eine interne Quellcode- und Regressionsprüfung, keine externe Zertifizierung und kein Nachweis für jede Kundeninstallation.

## Bestätigte Fehler und Korrekturen

1. **Wiederanlauf nach verlorener oder falsch zugeordneter Zielkonfiguration.** Ein bereits abgeschlossenes Journal konnte zuvor trotz fehlender UI-Konfiguration fortgesetzt werden. Ebenso war eine abweichende Quellinstanz in den Metadaten möglich. `verifyDestinations()` verlangt jetzt für jede übertragene Journalquelle ein vorhandenes geschütztes Ziel, gültige entschlüsselbare Konfiguration und übereinstimmende Quellinstanz/Version mit erhaltenem Namespace. Fehler sperren die Schreibfreigabe, statt die Paketvorgaben als Kundenkonfiguration zu übernehmen.
2. **Bereits initialisierte UI ohne aktuelle Schreibberechtigung.** `emsReady` blieb bei verlorener Ownership wahr. Der Koordinator konnte dadurch die Übernahme zu früh abschließen. Er verlangt jetzt zusätzlich `canWrite === true` und eine erneut bestätigte Abschaltung sämtlicher Altinstanzen.
3. **Bewusst deaktivierte alte UI.** Deren `common.enabled=false` hatte bislang keine Entsprechung im Start des eingebetteten EMS. Dieser Fall wird jetzt bereits vor jeder Abschaltung oder Konfigurationsübertragung mit `EOS_MIGRATION_DISABLED_UI_REVIEW` zurückgestellt. Die bestehende deaktivierte Anlage bleibt unverändert und benötigt eine bewusste Übernahmeentscheidung.

Die ersten beiden Fälle wurden vor der Korrektur mit fehlschlagenden unabhängigen Regressionen nachgewiesen. Die dritte Regression prüft die ausdrücklich erhaltene Deaktivierung und das Ausbleiben jeder Übertragung. Die Laufzeitkorrekturen stammen vom verantwortlichen Migrationsautor; diese Prüfung ergänzt die Regressionen und kontrolliert die Änderungen separat.

## Geprüfte Grenzen

- Der Preflight läuft für alle Kandidaten vor dem ersten Abschalten. Mehrdeutige, unbekannte, bereits belegte oder unvollständig lesbare Quellen führen nicht zu einer Teilübernahme.
- Der geschützte, verschlüsselte Journalzustand unterscheidet Vorbereitung, bestätigte Übertragung, Abschluss und Rückfall. Ein unklarer Wiederanlauf erhält keine Schreibberechtigung.
- Alte Konfigurationen, Objekt- und History-IDs bleiben erhalten. Die UI-Fassade bildet lokale Methoden auf den übernommenen Namespace ab; Befehle werden nicht aus alten unbestätigten States wiederholt.
- Die Datenverzeichnisauflösung von `@iobroker/adapter-core` verwendet den unveränderten UI-Namespace. Die neue Konfigurationsablage verändert nicht die alte Instanzkonfiguration.
- Befehlsausgaben der migrierten UI passieren den laufenden Ownership-Guard. Der Stopp setzt den lokalen Guard vor dem asynchronen Aufräumen. Die Wiederaktivierung alter Instanzen erfolgt erst nach dem Stopp der neuen Laufzeit; unsicherer Modulstopp bleibt gesperrt.
- Bekannte externe RPC-Ziele, konkurrierende EOS-Instanzen, nicht bestätigtes Controller-Leben und zeitüberschrittene Datenbanklesevorgänge werden im Preflight berücksichtigt.

## Ausgeführter Nachweis

```sh
node --test test/eos-module-migration-review.test.cjs test/eos-module-legacy-migration.test.cjs test/eos-unified-ownership.test.cjs test/eos-hosted-boundary-http.test.cjs test/eos-hosted-eebus-bridge.test.cjs test/eos-module-migration-page.test.cjs
```

Ergebnis: **45 Tests bestanden, 0 fehlgeschlagen**. Vollständiges Protokoll: `migration-independent-review-tests.log`.

Nach dieser Prüfung besteht kein weiterer konkret nachgewiesener Blocker in dem geprüften Umfang. Die Tests ersetzen keinen installierten Controllerlauf und keinen Gerätetest. Die automatische Übernahme ist bewusst auf erkannte Versionsstände und eindeutig lesbare Bestände begrenzt; dynamisch berechnete externe Script-/RPC-Abhängigkeiten oder unbekannte Kundenerweiterungen sind damit nicht vollständig nachweisbar. Ein zurückgestellter Bestand wird nicht als erfolgreich migriert ausgewiesen. Ohne Messung unter der jeweiligen Geräte-/Historylast wird weder eine feste RAM-Ersparnis noch eine unterbrechungsfreie Übernahme zugesichert.
