# Sicherheits-Deltareview: NexoWatt EOS 9.0.11

Stand: 23.11.2026. Gegenstand ist die Härtung der automatischen Bestandsübernahme gegenüber 9.0.10: frühe Startüberwachung, Wiederherstellung nach Startfehlern sowie der bestätigte Stopp bereits begonnener UI- und Modulstarts. Die Prüfung umfasst konkrete Quellen und lokale Regressionstests. Sie ist keine vollständige Produktprüfung, unabhängige Zertifizierung oder CRA-Konformitätserklärung.

## Geprüfte Änderungen und Vertrauensgrenzen

| Bereich | Geprüfte Grenze |
| --- | --- |
| `src/lib/eosLegacyMigration.js` | Ein übernommener Bestand wird bereits vor der Webinitialisierung überwacht. Lizenz, Schreibzuständigkeit und tatsächliche Betriebsbereitschaft werden nach asynchroner Quellenprüfung erneut gelesen. Ein vorhandenes Modulobjekt allein gilt nicht als erfolgreicher Start. |
| Startfehler in `src/main.ts` und `src/lib/web.ts` | Fehler bei Ownership, Sessioninitialisierung, TLS oder Listener führen in den koordinierten Wiederherstellungspfad. Die authentifizierte Wartungsoberfläche ist von der Freigabe operativer Starts getrennt. |
| `createHostedRuntime` und `lib/hosted-runtime-stop.ts` | Der Stop setzt vor jedem Await eine dauerhafte Start-/Schreibsperre. Er erfasst laufende Shell- und Betriebsstart-Promises, wartet deren Ende und danach die abschließende Bereinigung ab. Vier Sekunden ohne bestätigten Abschluss ergeben einen dauerhaften unbestätigten Stop. Späteres Cleanup darf daraus keinen Erfolg machen. |
| `lib/hosted-adapter.ts` | Die vier Foreign-State-Schreibmethoden und ihre lokalen Aliasse werden in beiden Namespace-Modi verfolgt. Ein bestätigter UI-Stop wartet auf alle bereits angenommenen Controller-Aufträge. Callback-Methoden benötigen den Callbackabschluss und bei zusätzlicher Promise-Rückgabe auch dessen Abschluss. Höchstens 1.024 offene Aufträge; keine Queue, zusätzlichen Befehle oder Wiederholungen. |
| `src/lib/eosModuleHost.js` | Die originale Modul-/Startreferenz bleibt für das abschließende Cleanup erhalten, auch nachdem der aktive Eintrag entfernt wurde. Generation, Lease und Schreibfreigabe werden sofort entzogen. Nach einem laufenden Start erfolgt ein zweiter Stop. Die öffentliche Stopgrenze von höchstens 3.500 ms ist keine Stillstandsbestätigung. |
| Rollback und Journal | Alte Regler werden erst nach bestätigtem Stop neuer Laufzeiten reaktiviert. Quellenkonfiguration, Host und Version werden unmittelbar vor jeder Reaktivierung erneut geprüft. Ein unbekannter Stop bleibt `ROLLBACK_REQUIRED`, auch über Neustarts. Ein unterbrochenes `ROLLING_BACK` benötigt einen ausdrücklich gespeicherten Stopnachweis. |

Die übergeordnete Wiederherstellung wartet höchstens fünf Sekunden auf die Laufzeitstopps. Fehler oder Zeitüberschreitungen halten die Start-/Schreibsperre aufrecht und erlauben keine automatische Reaktivierung alter Regler. Gleichzeitige Startfehler teilen einen Wiederherstellungsvorgang. Ein bereits laufender Journal-Commit wird vor einer widersprechenden Rückfalldokumentation berücksichtigt; ein abgelehnter Commit bleibt kein scheinbar erfolgreicher `COMMITTED`-Zustand.

Die UI wartet außerdem auf die tatsächlich zurückgegebenen Abschluss-Promises vorhandener Unterdienst-Stopps; deren Ablehnung beziehungsweise synchrone Ausnahme wird als unbestätigtes Cleanup weitergereicht. Der ModuleHost verfolgt bis zu 4.096 bereits angenommene State-/Create-/Extend-Aufträge, prüft seine Generation vor der Controllerübergabe erneut und wartet unter derselben Stopfrist auf deren Ende. Controller-Abschluss ist ausdrücklich keine physische Gerätequittung. Nach einem bereits angeforderten Adapter-Unload beginnt eine verspätet abgelehnte Readiness-Abfrage keine neue Wiederherstellung.

Im unabhängigen Review wurden die zuvor vorzeitige UI-Stopbestätigung, die verlorene Referenz auf einen noch startenden Modultransport, die erneute Herkunftsprüfung direkt vor der Altaktivierung und die veraltete Bereitschaftsentscheidung nach asynchronen Quellenprüfungen konkret nachverfolgt. Die zugehörigen Quellen und Regressionen wurden nach den Korrekturen erneut gelesen. Die Testbelege für die gesamte Migration stehen zusätzlich in `PRUEFBERICHT.md`; die genaue Grenze des UI-Stopvertrags ist in `HOSTED_UI_LIFECYCLE.md` beschrieben.

## Quellbezogene Scannerbewertung

Der vollständige UI-Sicherheitslauf verwendet Node.js 24.22.3, die UI-Installation von ESLint 10.13.0 und die vom Gate verwendete TypeScript-Version 5.8.3. `noInlineConfig`, die vorgeschriebenen Sicherheitsregeln und die Sperre neuer Typunterdrückungen bleiben wirksam. Der neue strikt typisierte Stophelfer und `hosted-adapter.ts` wurden ausdrücklich in die strikte Typregelgrenze aufgenommen. Weder eine Dateiausnahme noch eine `any`-, Parser- oder Typunterdrückungsausnahme wurde ergänzt.

Die historische Baseline wurde nicht geändert; SHA-256 von `ui/docs/security/eslint-legacy-baseline.json`:

```text
c7fd7ea7039fdfff2c3f7e00abcbc00b76f4984c1f612edcf73bddaf62d8a3b9
```

Die Lifecycle-Änderung in `main.ts` ändert dessen gesamten AST-Codehash und verlangt deshalb eine erneute Einzelprüfung der dort gebundenen früheren Bewertungen. Alle neun Vorkommen in acht Fingerprints wurden an ihren tatsächlichen Quellen erneut geprüft:

- Zwei Diagnosezählerzugriffe auf ein neu angelegtes Dictionary ohne Prototyp.
- Ein Lesezugriff über validierte Partner-App-IDs mit anschließender App-/Lizenzprüfung.
- Je ein Lesezugriff auf lokale Availability- und Telemetriemaps ohne Prototyp sowie der Statecache-Callback mit den fest vorgegebenen Partnerprojektionen.
- Der History-Queryzugriff mit ausschließlich festen Namen `from`, `to` und `step` und nachfolgender Begrenzung.
- Ein ganzzahliger binärer Suchindex innerhalb normalisierter Zahlenpaare.
- Die unveränderte verankerte Dezimalgrammatik mit disjunkten Zahl-/Punkt-/Exponentsegmenten.

In `ui/docs/security/eslint-reviewed-findings.json` wurden für diese acht vorhandenen Einträge die Zeilenposition, der geprüfte Dateicodehash und der ergänzende Reviewverweis aktualisiert. Fingerprint, Anzahl, ursprüngliche Begründung und ursprünglicher Nachweis bleiben erhalten. Es gibt keine Übertragung alter Bewertungen auf neue Fundstellen. Der neue Stophelfer erzeugt im vorgeschriebenen Regelsatz keinen Scannerbefund.

Zwei neue `security/detect-object-injection`-Fundstellen in `hosted-adapter.ts` wurden eigenständig bewertet. `writeAsync` wählt ausschließlich `setForeignStateAsync` oder `setForeignStateChangedAsync`; `writeCallback` ausschließlich `setForeignState` oder `setForeignStateChanged`. Sämtliche tatsächlichen Aufrufstellen übergeben einen festen internen Methodennamen. Request-, Geräte- und Konfigurationswerte können diese Methodenauswahl nicht erweitern. Die Einzelbewertungen sind an ihre zwei exakten Fingerprints, je ein Vorkommen und den gesamten geprüften AST-Dateicodehash gebunden. Die neuen Drain-Tests prüfen beide Namespace-Modi, Originalargumente/Rückgaben und ausbleibende Bestätigung.

## Ausgeführte Prüfungen

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| Gezielter Reviewlauf über UI-Factory, Stophelfer und HostedAdapter | 493 Fundstellen: 482 historische offene, neun vorhandene Einzelbewertungen und zwei anschließend konkret bewertete interne Methodenaufrufe. |
| Neuer UI-/Modul-Stop- und Drainvertrag | 30/30 Tests unter Node.js 24.22.3 bestanden; keine Fehler oder ausgelassenen Tests. Verzögerte/abgelehnte Starts, mehrfache Stopps, spätes Cleanup, ausstehende Controller-Aufträge, Callback/Promise-Reihenfolge, Kapazität, Timeout und Schreib-/Timersperre werden mit kontrollierten Fixtures geprüft. |
| Neue UI-Stop-/Drain-Quelltests | 20/20 unter Node.js 22.23.4 und 24.22.3 bestanden; `raw/hosted-ui-drain-source-node22.log` und `raw/hosted-ui-drain-source-node24.log`. Compiler-/Lintnachweise siehe `HOSTED_UI_LIFECYCLE.md`. |
| Migrations-Regressionen | 39/39 unter Node.js 22.23.4 und 24.22.3 bestanden; `migration-lifecycle-final-node22.log` und `migration-lifecycle-final-node24.log`. Darunter frische Freigabe nach Quellenprüfung, Stopfehler über Neustart und späte Readiness-Ablehnung nach Unload. |
| Sicherheitsgate-Regression | 25 Policy-/Negativprüfungen bestanden. |
| Offizielles vollständiges UI-Sicherheitsgate | Exitcode 0; Messwerte unten. |

```sh
node --test ui/test/unified/hosted-runtime-stop.test.cjs ui/test/unified/hosted-adapter-drain.test.cjs test/eos-module-stop-lifecycle.test.cjs
node ui/scripts/verify-eslint-security-test.cjs
NEXOWATT_LINT_REPORT=/workspace/scratch/741f792566ea/setup-911/ui-security-final.json node ui/scripts/verify-eslint-security.cjs
```

| Messgröße | Ergebnis |
| --- | ---: |
| Geprüfte Quellen | 207 |
| Aktuelle Scannerfundstellen | 3.199 |
| Davon historische offene Fundstellen | 2.952 |
| Davon individuell bewertete aktuelle Fundstellen | 247 |
| Neue unbewertete oder verbotene Fundstellen | 0 |
| Frühere, derzeit abwesende Fundstellen | 108 |

Rohbelege im Release-Prüfpaket: `ui-security-final.json`, `ui-security-final.log`, `security-stop-lifecycle.log` und `security-policy-regression.log`. Der vollständige Lauf erfolgte auf den eingefrorenen UI-Quellen. Gegenüber 9.0.10 sind eine geprüfte Quelldatei und die beiden beschriebenen, individuell bewerteten Fundstellen hinzugekommen; die historische offene Befundzahl ist unverändert.

Nach dem offiziellen Lauf wurden sämtliche Codehashbindungen des individuellen Inventars nochmals gegen die Quellen geprüft: 210 Einträge mit einem Gesamtbudget von 247 Vorkommen in 37 Dateien; keine Abweichung.

## Verbleibende Grenzen

Die 2.952 historischen Fundstellen bleiben offen und werden durch diesen Review nicht pauschal als Fehlalarme eingestuft. Enthaltene alte Typunterdrückungs-/`any`-Befunde werden nicht als neue Ausnahmen freigegeben. Dieser Deltanachweis ersetzt keine gesonderte Abhängigkeits-, Geheimnis-, Build- oder Paketintegritätsprüfung.

Die Stopbestätigung der UI bezieht sich auf die erfassten Start-Promises, angenommenen Controller-Stateaufträge und tatsächlich zurückgegebenen Unterdienst-Stopabschlüsse. Ein Unterdienst, der intern weitere Arbeit startet und dafür keine Completion zurückgibt, wird dadurch nicht pauschal nachweisbar beendet. Die durch den Shutdown-Schreibschutz möglicherweise verworfene ältere SmartHome-Pulsrücksetzung bleibt eine gesondert zu prüfende Bestandsgrenze. Es wird keine physische Rückmeldung oder lückenlose Transportstilllegung behauptet. Neue gewöhnliche Bedienbefehle erhalten währenddessen keine Schreibfreigabe.

ioBroker-Objekt-/Stateoperationen besitzen hier keinen allgemeinen Abbruch-/Compare-and-swap-Vertrag. Eine bereits an den Controller übergebene Mutation lässt sich nicht durch einen Promise-Timeout zurücknehmen. Die erneute Quellenprüfung begrenzt den Entscheidungsabstand, ersetzt aber keine atomare Transaktion gegen gleichzeitig administrativ veränderte Objekte. Auch das Persistieren des geschützten Journals ist kein zugesagter vollständig abbrechbarer Gesamtvorgang; bei Unklarheit bleibt die Freigabe gesperrt.

Reale Kundenmigrationen, Stromausfall, tatsächliche untergeordnete Prozesse und Geräte-/EEBUS-Transporte sowie Hardwarelatenzen wurden in diesen lokalen Tests nicht geprüft. Die allgemeine Freigabe benötigt den dokumentierten Anlagenversuch und die produktbezogene Herstellerbewertung. Ein positiver Softwaretest oder dieses Gate begründet keine vollständige CRA-/ASVS-Konformität.
