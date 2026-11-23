# Zusätzliche technische Durchsicht der Bestandsübernahme

23.11.2026, Entwicklungsstand 9.0.7. Separate Durchsicht während der Umsetzung;
keine unabhängige externe Sicherheitszertifizierung.

## Reproduzierte und nachgeprüfte Fehlergrenzen

1. **Unterschiedliche Sicht auf geschützte Einstellungen:** Der installierte
   Controller 7.2.5 gibt bei der Instanzansicht und bei `getForeignObject`
   unterschiedliche Inhalte zurück: Der zweite Weg entfernt geschützte
   `protectedNative`-Felder fremder Adapter. Vorprüfung, Abschaltung und Rücknahme
   verwenden deshalb dieselbe Zugriffsschnittstelle. Fehlen beispielsweise
   EEBus-Schlüssel oder PIN, bleibt die gesamte Übernahme vor der ersten
   Abschaltung gesperrt; zuvor gefundene UI-/Geräteadapter laufen weiter.
2. **Beschädigtes Wiederanlaufjournal:** Ungültige verschlüsselte Journaldaten
   setzen den Migrationsstatus auf `ROLLBACK_REQUIRED` und sperren die
   Schreibfreigabe. Die Anwendung läuft nicht versehentlich mit dem anfänglichen
   Status `IDLE` in eine unbestätigte Übergabe.
3. **Fehler beim Laden der übernommenen UI-Konfiguration:** Auch ein Fehler vor
   dem Lesen des Journals sperrt die Migrations-Schreibfreigabe.

Nachweis:

```text
node --test test/eos-module-migration-review.test.cjs
```

Drei Tests bestanden. Rohbeleg: `migration-independent-review-tests.log`.
Die Datenbank und ihre API-Filterung sind kontrolliert modelliert; dies ist kein
echter Bestandsanlagen- oder EEBus-Hardwaretest. Die Filterwirkung wurde zusätzlich
im tatsächlich installierten Adapter-/Controllercode nachgelesen.

## Weitere im Code geprüfte Korrekturen

- Ein übernommener UI-Namespace erhält den passenden Adapternamen und seine
  ursprüngliche Instanznummer, einschließlich Instanz `0`. Konfigurationszugriffe
  verwenden dadurch weiterhin die richtige Instanzidentität.
- UI-Konfigurationslesezugriffe nutzen nach einer Speicherung die aktuelle
  geschützte Konfiguration und nicht den inzwischen veralteten 9.0.6-Fallback im
  Instanzobjekt.
- Umgeleitete lokale State-Schreibzugriffe durchlaufen die vorhandene
  Ownership-Prüfung. Eine Namespace-Übernahme darf keine Umgehung des
  Schreibentzugs schaffen.
- Der Schutz geheimnishaltiger Installer-/Simulationsstates berücksichtigt den
  ausdrücklich übernommenen Namespace und behält Positivliste und ACL-Prüfung.
- Rücknahme prüft die ursprüngliche Host-/Versionszuordnung sowie eine bestätigte
  Wiederaufnahme der alten Instanzen. Ein bloß gesetztes `enabled: true` ist noch
  kein Nachweis, dass der alte Prozess wieder läuft.

Die zugehörigen Laufzeit-/Namespace-Prüfungen stehen im Migrations- und
Gesamtprüfbericht. Obige Codeprüfung allein ist kein Hardware-Funktionsnachweis.

## Grenze für die Auslieferung

Eine automatische Übernahme ist nur bei vollständig lesbaren und geprüften
Quellkonfigurationen möglich. Insbesondere darf EOS die Zugriffssperre für private
EEBus-Identitäten nicht durch eine gefälschte Adapteridentität umgehen. Die
gesperrte Übernahme erhält den laufenden Altbestand. Eine uneingeschränkte Zusage
„alle Einstellungen aller Altversionen werden immer automatisch übernommen“ wäre
mit diesem Prüfstand nicht belegt.

## Statusanzeige für die Administration

Unter `/migration/` zeigt EOS den Übernahmestand mit deutschen Erläuterungen,
Meldungscode und erfassten Instanzen. Bei einer gesperrten Vorprüfung wird
ausdrücklich angezeigt, dass keine bisherigen Adapter angehalten oder deren
Einstellungen verändert wurden. Bei einer laufenden oder fehlgeschlagenen
Rücknahme wird diese Aussage nicht angezeigt. Datenpunktnamen werden erst nach
Übertragung beziehungsweise Abschluss als übernommen markiert.

`GET /api/eos/migration` verlangt eine aktuelle Administratorsitzung und die
bestehende Origin-Prüfung. Der Endpunkt liefert nur freigegebene Statusfelder;
verschlüsselte Journale, Konfigurationen, Zugangsdaten und Dateipfade werden nicht
weitergegeben. Andere Methoden werden mit 405 abgewiesen. Seite und Skript sind
ebenfalls geschützt. Die Seite besitzt eine CSP ohne Inline-Skripte und setzt
alle dynamischen Angaben als Text. Es gibt keine Übernahme-, Wiederholungs- oder
Freigabeaktion; „Status aktualisieren“ liest ausschließlich den Stand.

Zusätzlicher Nachweis:

```text
node --test test/eos-module-http.test.cjs test/eos-module-migration-page.test.cjs
node_modules/.bin/eslint -c eslint.unified.config.mjs src/lib/eosModuleHttp.js
node_modules/.bin/eslint -c eslint.unified.config.mjs --global document --global fetch --global AbortSignal public/eos-migration/index.js
```

Zehn Tests bestanden, beide Lintprüfungen bestanden. Belege:
`migration-status-page-tests.log`, `migration-status-page-lint.log` und
`module-http-lint.log`. Enthalten sind echte HTTP-Prüfungen der Zugriffsgrenzen,
Statusprojektion und Methoden sowie Browserskript-Prüfungen mit einem DOM-Modell
gegen HTML-Einschleusung und unbeabsichtigte Schreibanfragen. Ein visueller
Browsernachweis ist damit nicht verbunden.
