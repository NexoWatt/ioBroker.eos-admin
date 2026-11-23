# Sicherheits-Deltareview: NexoWatt EOS 9.0.12

Stand: 23.11.2026. Geprüft wurde die Änderung gegenüber 9.0.11: SmartHome-Einrichtung mit getrennten Bearbeitungsdialogen, kompakte Geräteerkennung, bewusst ausgewählter Stapelimport und begrenzte Discovery-Anfragen. Dieser Bericht bewertet konkrete Quellen und lokale Regressionen. Er ist keine vollständige Produktprüfung, Browser-/Geräteabnahme oder CRA-Konformitätserklärung.

## Geprüfte Vertrauensgrenzen

| Bereich | Nachgeprüftes Verhalten |
| --- | --- |
| `www/smarthome-setup.ts` | Neuer strikt typisierter Browserhelfer. Namen und Meldungen werden als Text gerendert; kein dynamisches HTML, Code oder neuer Schreibendpunkt. Der Konfigurationsklon begrenzt Tiefe, Knoten und serialisierte Länge und verwirft gefährliche Prototypschlüssel. |
| Dialog in `www/smarthome-config.ts` | Ein eigener vollständiger Entwurf hält Kundeneinstellungen getrennt von der Basis. Abbrechen/Escape stellt ursprüngliche Objektidentität, Auswahl und Dirty-Status wieder her. Anwenden validiert und verändert nur den weiterhin ungespeicherten Gesamtdraft. |
| Asynchrone Editoraktionen | Profil- und Datenpunktcallbacks sind an die aktuelle aktive Editortransaktion gebunden. Nach Abbruch dürfen sie die wiederhergestellte Basis weder verändern noch als geändert markieren. Während eines Dialogs sind Speichern, Neuladen und Import gesperrt. |
| Speichern, Neuladen und Dateiimport | Single-Flight-/Busy-Sperren verhindern widersprechende Vorgänge. Vor und nach einer asynchronen Antwort werden Konfigurationsidentität und Inhalts-Snapshot verglichen. Ein erfolgreicher älterer Save ersetzt keinen neueren lokalen Entwurf und räumt dessen Dirty-Status nicht ab. |
| Stapelübernahme | Höchstens 100 ausdrücklich ausgewählte Vorschläge, vorhandener Zielraum oder ausdrückliches „Ohne Raum“, Dublettenprüfung, eindeutige Geräte-IDs und vollständige Vorbereitung vor der Übernahme. Höchstens 2.000 zugeordnete Profilfelder im Stapel und 2.000 Geräte beim Hinzufügen zum Projekt; bestehende Datensätze werden nicht automatisch gekürzt. |
| Optionale Aliasanlage | Höchstens ein Aufruf der vorhandenen Alias-API für den vorbereiteten Stapel. Danach müssen Konfigurationsreferenz/-inhalt sowie Vorschlagsreferenzen/-inhalt unverändert sein. Erst dann wird die Geräteliste gemeinsam in den lokalen Entwurf übernommen. Teilfehler verändern den Geräteentwurf nicht; bereits entstandene Alias-Objekte bleiben ausdrücklich benannt. Kein automatischer Retry oder Save. |
| Browser-Discovery | Fester Same-Origin-GET, 35 Sekunden Abbruchsignal und maximal 16 MiB gelesene Antwortbytes. Streamfehler beenden den Reader; der Abschluss bricht das Fetch-Signal ab. Eine verspätete Scanantwort ersetzt keine Vorschläge für einen inzwischen geänderten Entwurf. |
| Backend-Discovery | Vorhandene `mapping.edit`-Route bleibt erhalten. Objektlesen und Scan besitzen eigene Mengen-/Zeitgrenzen. Abbruch, Stilllegung, Timeout oder Teilfehler werden nicht als vollständiges leeres Ergebnis ausgegeben oder als erfolgreicher Scan gecacht. |

Der Batch und die Dialoge schaffen keine neue Geräte-Schreibschnittstelle. Erkennung und Formularvorbereitung schreiben keine Aktorwerte. Die optionale, ausdrücklich bestätigte Aliasanlage bleibt eine getrennte Objektmutation; ihre vorhandene serverseitige Autorisierung und Validierung werden weiterverwendet. Das globale Speichern bleibt ein zusätzlicher bewusster Vorgang. Sichtbarkeit beziehungsweise ein deaktivierter Button ersetzt keine Backend-Berechtigung.

## Konkrete Befunde und erneute Prüfung

Die QA reproduzierte einen echten Datenverlustpfad: Eine verspätete erfolgreiche Konfigurationsantwort ersetzte zwischenzeitlich geänderte Eingaben und löschte deren Dirty-Markierung. Der korrigierte Speicherpfad vergleicht die abgesendete Konfiguration und den Seitentext mit dem aktuellen Entwurf. Bei Abweichung bleiben die neueren Eingaben erhalten. Zusätzlich wurden zuvor gestartetes Neuladen und verzögertes `file.text()` mit einer nachfolgenden Dialogöffnung beziehungsweise lokalen Änderung geprüft. Busy-Sperre und Antwort-Snapshot verhindern die verspätete Übernahme. Die Sperre eines laufenden Backupimports ist ebenfalls im Dateiimport, Save, Reload und Editor nachgewiesen.

Ein nach Cancel eintreffender Profilcallback konnte zuvor die wiederhergestellte Basis als geändert markieren. Die aktuelle Transaktionsprüfung verwirft diesen Callback und verspätete Datenpunktauswahl. Die Regressionen prüfen die ursprüngliche Referenz, vollständigen Kundeninhalt und den vorherigen Dirty-Zustand. Apply führt keinen Netzwerk-Save aus; ein ungültiges Apply bleibt mit Rückmeldung geöffnet.

Im Backend wurde unabhängig ein Erkennungsfehler reproduziert: Eine mit `localeCompare` sortierte Objektliste war für den binär suchenden TypeDetector fälschlich als passend vorsortiert markiert. Die JavaScript-Stringsortierung erkennt nun alle sieben gemischten Groß-/Kleinschreibungsfälle der Fixture. Einzelheiten, die tatsächlichen Detector-Muster und die Abbruch-/Cachetests stehen in `DETECTION-REVIEW.md`.

Der Scan begrenzt 100.000 Objekte, 20.000 Kandidatenwurzeln und 10.000 Vorschläge. Er verwendet ein kooperatives Gesamtbudget von 30 Sekunden und maximal fünf Sekunden Wartezeit für das lokale Objektlesen. Eine Lesegeneration verhindert das Cachen verspäteter Ergebnisse. Die vorhandene gemeinsame Read-Promise verhindert parallele Objektabfragen. Die Fehlerantwort verwendet ausschließlich eine eigene feste Zuordnung mit `Object.hasOwn`; interne Ausnahmedetails werden nicht weitergegeben.

## Quellbezogene Scannerbewertung

Das Gate prüft die kanonischen UI-Quellen mit Node.js 24.22.3 und der UI-Installation von ESLint 10.13.0. Der neue Browserhelfer gehört ausdrücklich zur strikten Typregelgrenze. Vorgeschriebene Sicherheitsregeln, `noInlineConfig` und die Sperre neuer Typunterdrückungen bleiben aktiv. Es wurden keine Datei-, Parser-, `any`- oder `ts-nocheck`-Ausnahmen eingeführt.

Die historische Baseline bleibt bytegleich. SHA-256 von `ui/docs/security/eslint-legacy-baseline.json`:

```text
c7fd7ea7039fdfff2c3f7e00abcbc00b76f4984c1f612edcf73bddaf62d8a3b9
```

28 bereits bewertete Fingerprints mit 34 Vorkommen in den geänderten Dateien wurden anhand ihrer tatsächlichen Quelle erneut geprüft und an den neuen gesamten AST-Dateicodehash gebunden. Ihre Anzahl, ursprünglichen Begründungen und ursprünglichen Nachweise bleiben erhalten:

- `main.ts`: neun Vorkommen für lokale Diagnose-/Telemetriemaps, geprüfte Partnerprojektionen, feste History-Querynamen, begrenzte Arrayindizes und die bestehende Dezimalgrammatik.
- `smarthome-device-detection.ts`: drei unveränderte Vorkommen für validierte Objekt-/Aliasmetadaten und den begrenzten, aus dem festen Profilkatalog erzeugten Slot-Regex.
- `smarthome-config.ts`: 22 Vorkommen für eigene Labelmaps, die festen Raum-/Funktionslisten, freigegebene Importpfade mit Prototypsperre, ausschließlich lokale Aktualisierungskopien und bereits vorhandene Alias-Snapshotprüfungen.

Die neuen 23 Vorkommen von `security/detect-object-injection` wurden in 16 exakten Fingerprints einzeln bewertet:

| Quellenbereich | Vorkommen | Konkrete Bewertung |
| --- | ---: | --- |
| Detection-Limits und HTTP-Fehlermap | 2 | Interne Union `roots`/`suggestions` liest die gefrorene Limitmap; Fehlertext wird nur nach Own-Key-Prüfung aus einer festen Map gelesen. |
| Dialogentwurf | 8 | Collection ausschließlich `floors`/`rooms`/`devices` aus geprüfter Auswahl; Lesen/Initialisieren/Ergänzen nur am isolierten Entwurf. Keine vom Nutzer gelieferte Eigenschaftskette. |
| Vorlagenwechsel | 2 | `findIndex` auf vorhandene Geräte-ID, Prüfung auf nichtnegativen Index und unmittelbar folgende lokale Ersetzung. Kein asynchroner Abstand zwischen Prüfung und Zugriff. |
| Batch-Vorbereitung | 9 | Ausschließlich feste Listen für kopierte Gerätefelder sowie `behavior`/`ui`. Der vollständige Entwurf wird vor Hostaktion und Commit nochmals geprüft; keine dynamischen Propertynamen aus Vorschlagsdaten. |
| Neuer Browserhelfer | 2 | Typtext aus eigener Map nach `Object.hasOwn`; Fokusindex stammt aus der vorhandenen Formular-NodeList und wird begrenzt beziehungsweise optional gelesen. |

Jede Einzelbewertung enthält Quelle, Regel, Fingerprint, zulässige Vorkommenszahl, konkrete Begründung, Test-/Berichtsverweis und gesamten AST-Dateicodehash. Eine passende Regel allein erlaubt keine weitere Fundstelle. Frühere Bewertungen wurden nicht auf neue Stellen übertragen; keine bisherige Einzelbewertung musste entfernt werden.

## Ausgeführte Prüfungen

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| Gemeinsamer unabhängiger Setup-/Detection-Route-Lauf | 37/37 unter Node.js 24.22.3; keine Fehler oder ausgelassenen Fälle. Tatsächliche Produktfunktionen mit kontrollierten DOM-/API-Fixtures. |
| Setup-Regressionen der QA | Jeweils 27/27 unter Node.js 22.23.4 und 24.22.3; Nachweise in `SMARTHOME_SETUP_REVIEW.md`. |
| Backend-Erkennung und Alias-/Importregressionen | Jeweils 26/26 unter Node.js 22.23.4 und 24.22.3; Nachweise in `DETECTION-REVIEW.md`. |
| Gate-Policy-/Negativtests | 25 Prüfungen bestanden; unerlaubte Typ-/Parserausnahmen und abgeschwächte Regeln bleiben blockiert. |
| Offizielles vollständiges UI-Sicherheitsgate | Exitcode 0; 208 Quellen, keine neuen unbewerteten oder verbotenen Fundstellen. |

Die Testgruppen überschneiden sich und werden nicht als zusätzliche Gesamttestzahl addiert. Compiler-, typgestützte Lint-, Build-, Abhängigkeits- und Gesamttestnachweise stehen im übergeordneten `PRUEFBERICHT.md`.

```sh
node --test ui/test/unified/smarthome-setup-flow.test.cjs ui/test/unified/smarthome-detection-route.test.cjs
node ui/scripts/verify-eslint-security-test.cjs
NEXOWATT_LINT_REPORT=/workspace/scratch/741f792566ea/setup-912/ui-security-final.json node ui/scripts/verify-eslint-security.cjs
```

| Messgröße | Ergebnis |
| --- | ---: |
| Geprüfte Quellen | 208 |
| Aktuelle Scannerfundstellen | 3.222 |
| Historische offene Fundstellen | 2.952 |
| Individuell bewertete aktuelle Fundstellen | 270 |
| Neue unbewertete oder verbotene Fundstellen | 0 |
| Frühere, derzeit abwesende Fundstellen | 108 |

Gegenüber 9.0.11 kamen eine Quelldatei und die beschriebenen 23 individuell bewerteten Vorkommen hinzu. Der historische Bestand blieb unverändert. Nach dem Gate wurden alle Codehashbindungen erneut gegen die Quellen geprüft: 226 Einträge mit 270 zulässigen Vorkommen in 38 Dateien; keine Abweichung.

Rohbelege: `raw/ui-security-final.json`, `raw/ui-security-final.log`, `raw/security-setup-detection.log` und `raw/security-policy-regression.log`. Der endgültige Gate-Lauf folgt auf den Quellenfreeze; ausschließlich kommentarbezogene Headerkorrekturen wurden zusätzlich anhand des unveränderten AST-Codehashes und erneuter Helperanalyse abgeglichen.

## Verbleibende Grenzen

Die historischen offenen Scannerhinweise werden nicht pauschal als Fehlalarme freigegeben. Dieser Deltareview behauptet weder einen vollständig sauberen Altbestand noch vollständige ASVS-/CRA-Konformität. Die weiterhin offenen Entwicklungsabhängigkeiten werden separat im Releasebericht ausgewiesen.

Das lokale Minimal-DOM berechnet kein Browserlayout und bildet native Event-Reihenfolgen nicht vollständig ab. Echte Touch-/Zoom-/Fokus-/Scrollprüfung auf Endgeräten, reale Kundenmigration, tatsächliche Discovery großer Anlagen, Alias-Persistierung auf dem Kundengerät und physische Gerätequittungen sind durch diese Tests nicht abgedeckt.

Die Begrenzung des Backendscans ist kooperativ: Ein synchroner Detector-Schritt kann nicht präemptiv beendet werden. Das zugrunde liegende ioBroker-Objektlesen besitzt keinen Abbruchvertrag; eine bereits begonnene Abfrage kann nach der HTTP-Antwort noch enden. Der Browserabbruch nimmt bereits angelegte Alias-Objekte nicht zurück. Ein Teilfehler darf daher nur als fehlgeschlagener Entwurfsimport mit verbleibenden Aliasobjekten beschrieben werden, nicht als atomarer Rollback sämtlicher Hoständerungen.

Die Schutz-Snapshots beziehen sich auf den Entwurf dieser Seite und die betreffenden Vorschläge. Sie sind kein systemweiter Compare-and-swap-Vertrag gegen Änderungen einer zweiten Sitzung oder anderer Administratoren. Die bestehende serverseitige Konfigurationsprüfung und Autorisierung bleiben erforderlich. Im konkret geprüften Änderungsumfang blieb nach den Korrekturen kein belegter offener Releaseblocker; die genannten Anlagen- und Browsernachweise bleiben eigenständige Abnahmepunkte.
