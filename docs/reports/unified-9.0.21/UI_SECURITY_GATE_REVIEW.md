# UI-Sicherheitsgate: konkrete Nachprüfung für 9.0.21

Geprüft am 24.11.2026 durch die EMS-/Zweitprüfungs-Arbeitsgruppe. Ausgangspunkt ist der unveränderte Lieferstand 9.0.20. Der erste echte Lauf von `ui/npm run lint:security` blockierte an der Ganzdateibindung von `main.ts`. Anschließend wurden mit unveränderten Scannerregeln alle 227 maßgeblichen Quellen ausgewertet: 3.201 Fundvorkommen, davon genau vier neue Fingerprints. Die Rohbestandsaufnahme wurde vor jeder Freigabe gespeichert.

Die Änderung betrifft ausschließlich `ui/docs/security/eslint-reviewed-findings.json`: neun bereits einzeln geprüfte Gruppen erhalten nach erneuter Quellprüfung ihre aktuelle Ganzdateibindung, vier konkrete Fundstellen erhalten jeweils eine eigene Begründung. Die historische Baseline, Scannerregeln, Scannerwerkzeuge und Produktquellen wurden für dieses Gate nicht geändert. Weder `any` noch Typunterdrückungen, Parserfehler oder zusätzliche allgemeine Pfadausnahmen wurden akzeptiert.

## Tatsächliches Quellcode-Delta

Der kommentarfreie Codevergleich findet genau sechs geänderte beziehungsweise neue Dateien im vollständigen Scannerumfang:

| Quelle | Tatsächliches Delta und Bewertung |
| --- | --- |
| `ems/engine.ts` | Fehlender NVP-Filterzustand wird nicht mehr zu 0; ungültige Messung verwirft den alten Filter. Keine neuen Scannerfundstellen. Ausführbare Nachweise im EMS-Stabilitätsbericht. |
| `ems/modules/tariff-provider.ts` | Ein begrenzter Hintergrundabruf statt Blockierung des lokalen Regelticks; Fehler-Backoff auch bei leerem Cache, Generation/Abbruch und ausdrücklicher Catch für Publikationsfehler. Keine neue Fundstelle oder gelockerte Datenvalidierung. |
| `ems/services/tariff-provider-registry.ts` | Übergeordnetes AbortSignal wird an den bestehenden 5-s-Gesamtabruf gebunden und Listener werden entfernt; ausschließlich fester zusätzlicher Fehlercode `provider_cancelled`. Ziele, Größenlimits, HTTPS und Antwortvalidierung bleiben erhalten. Keine neue Fundstelle. |
| `main.ts` | Der gesamte tatsächliche Diff besteht aus dem Farm-Serialisierungswrapper, Generation-/Stopprüfungen und bewachten bisherigen Statewrites. Der unveränderte Aggregationskörper liegt in einer benannten Hilfsmethode; dadurch ändern sich drei Fingerprints mit Funktionskontext. |
| `www/app.ts` | Ausschließlich festes `#updates`-Routing. Der ausgewählte Name läuft weiterhin durch die aus lokalen DOM-Schaltflächen erzeugte Positivliste. Kein Hash wird als HTML, URL-Ziel oder Code übernommen. Keine neue Fundstelle. |
| `www/eos-updates.ts` | Neue strikt typisierte Anzeige und Bestätigung. Endpunkte sind intern festgelegt, Ausgabe erfolgt über `textContent`, Status-/Versions-/Planfelder werden dekodiert. Mutationen beschaffen CSRF aus der aktuellen Sitzung; ein unbestätigter Start wird nicht automatisch wiederholt. Die einzige neue Scannerfundstelle ist die unten begründet geprüfte Versionsregex. Backend-/Workerberechtigungen sind Gegenstand der getrennten Update-Sicherheitsprüfung. |

Die vollständigen kommentarfreien Quellhashes stehen in `raw/ems/ui-code-delta-inventory.json`. Der `main.ts`-Diff liegt separat in `ui-main-full-delta.patch`. Außerhalb dieses Diffs wurden die neun vorhandenen Reviewstellen einschließlich ihrer Schlüsselherkunft erneut gelesen.

## Neun bestehende Reviewgruppen in main.ts

Alle bisherigen Fingerprints, Regeln und Vorkommenszahlen bleiben erhalten. Die Spalte Fingerprint zeigt zur Lesbarkeit den Anfang; der vollständige Wert und die Einzelbegründung stehen im Änderungsbeleg.

| Fingerprint | Anzahl | Erneut geprüfte Grenze |
| --- | ---: | --- |
| `52846315…` | 2 | Peerfehler werden im lokalen `Object.create(null)`-Reducer gezählt; feste lokale Fehlerklassifikation, keine Prototyp-Setter. |
| `284be3fe…` | 1 | Partner-App-ID kommt aus dem validierten Partnervertrag; feste `directMarketing`-zu-`grid`-Abbildung und anschließende Lizenz-/Aktivierungsprüfung. |
| `48c91c7b…` | 1 | Availability-Map wird durch Storage-Control mit Null-Prototyp angelegt; nur Lesezugriff, tatsächlicher Boolean und höchstens 15 s alter Messzeitpunkt. |
| `012aeb1f…` | 1 | Partnerprojektion nutzt ausschließlich feste Messwertkennungen im Cache-Lesehook. Keine fremde frei wählbare State-ID. |
| `a0f055d4…` | 1 | Telemetrie-Map mit Null-Prototyp; freigegebene Ressource wird nur gelesen und nach Zahlen-/Messzeitprüfung projiziert. |
| `f966fa82…` | 1 | `queryNumber` hat ausschließlich interne Aufrufe für `from`, `to`, `step`; primitive Typen, Zahlenbereich und maximal 4.096 Ergebnispositionen werden geprüft. |
| `3b107b89…` | 1 | History-Binärsuche über normalisierte sortierte Zahlenpaare; ganzzahliger Index innerhalb der Arraylänge, nur lesend. |
| `27297a9d…` | 1 | Verankerte Dezimalgrammatik; Ziffern-/Punktalternativen beginnen disjunkt, der optionale Exponent beginnt mit e/E. Keine überlappende wiederholte Alternative; nicht endliche Ergebnisse werden verworfen. |
| `fcd35d67…` | 1 | Lokaler Discovery-Fehlerlookup erst nach `Object.hasOwn`; feste Status-/Meldungspaare und feste Fallbackantwort. |

Die neue kommentarfreie Ganzdateibindung ist `68ebef5c4985ff739eee7aee192b28a00f0d3593d9704947ab7121879421b23b`. Diese Bindung sagt nicht, dass alle historischen Fundstellen in der großen Datei behoben seien. Sie bestätigt die erneut geprüften konkreten Stellen und das tatsächlich gelesene Delta.

## Vier neue Fingerprints

### Farm-Tokenparser – `f4e38272…`

Die Regex und ihre Datenherkunft sind unverändert; die Methode heißt nun `_nwUpdateStorageFarmDerivedSnapshot`. Die alte Fundstelle `da24e013…` und die neue Fundstelle haben denselben Statementhash. Die Regex sucht einen ersten Zifferntoken mit optionalem Vorzeichen, konsumiert Ziffern/Punkt/Komma und optional einen mit e/E beginnenden Exponenten. Der Exponent ist nicht erzwungen und es folgt kein scheiternder Pflichtsuffix: ein begonnener Zifferntoken kann unabhängig vom optionalen Exponenten erfolgreich enden. Dadurch entsteht keine wiederholt scheiternde verschachtelte Alternative. Die nachfolgende Normalisierung/Prüfung endlicher Zahlen bleibt erhalten.

### Zwei Medianzugriffe – `ca90f291…` und `1e2633de…`

Auch diese beiden Statements sind gegenüber den früheren Fingerprints `6a1be055…` beziehungsweise `b23fbb0b…` unverändert. Die Liste wird lokal aus endlichen SoC-Werten aufgebaut, vor dem Zugriff wird eine leere Liste abgefangen. `mid = Math.floor(arr.length / 2)` ist im ungeraden Fall eine gültige Position; im geraden, nichtleeren Fall beträgt die Länge mindestens zwei, womit auch `mid - 1` gültig ist. Die Position stammt nicht aus Fremdeingaben. Es sind ausschließlich arithmetische Array-Lesezugriffe.

Die drei Herkunftsbindungen wurden mit den tatsächlichen 9.0.20-ESLintmeldungen und identischen Statementhashes nachvollzogen, siehe `raw/ems/ui-farm-fingerprint-moves.json`. Die alte Baseline wurde nicht umgeschrieben.

### Versionsformat – `95d9eb9f…`

Der neue Browser-Decoder verwendet eine mit `^` und `$` vollständig verankerte Grammatik. Jedes der drei durch Punkt getrennten Zahlensegmente erlaubt höchstens sechs Ziffern. Ein optionaler, mit Bindestrich beginnender Suffix erlaubt höchstens 60 Zeichen. Somit beträgt die maximal akzeptierte Gesamtlänge 81 Zeichen; es gibt keine unbeschränkte Wiederholung und keine überlappenden wiederholten Alternativen. Die Regel meldet die syntaktisch verschachtelten Quantifizierer trotzdem. Diese einzelne Fundstelle wird deshalb begründet inventarisiert, ohne eine funktionierende Grammatik nur zur Beruhigung des Scanners umzuschreiben.

Die Regex dient dem Antwort-/Anzeigevertrag. Sie berechtigt weder zur Installation noch ersetzt sie die serverseitige Prüfung des vorbereiteten Plans. Die kommentarfreie Quellbindung lautet `c815598cb0b73a777ac517a57583a0d9c92663ea6a11f7742b97ddf9a9def6eb`.

## Ausführung und Grenzen

`npm run test:lint-security` besteht mit **27 aussagekräftigen Policy-/Negativprüfungen**. `npm run docs:check` bestätigt **317 synchrone deutsche Modulbeschreibungen und Quellverknüpfungen**. Es war kein Patch an Dokumentations- oder Scannerwerkzeugen erforderlich. Die abschließenden echten Gate-Läufe unter Node 22.23.4 und 24.22.3 bestehen jeweils mit **227 Quellen, 3.201 Fundvorkommen, 2.926 offenen historischen Hotspots, 275 einzeln geprüften Vorkommen und 0 blockierten neuen/verbotenen Befunden**; die beiden vollständigen Berichte sind identisch. Die Berichte sind in `raw/ems/ui-security-final-node22.json` und `ui-security-final-node24.json` gebunden.

Ein grünes Gate bedeutet weiterhin ausschließlich: keine zusätzlichen unbewerteten oder verbotenen Scannerbefunde. Historische offene Hotspots werden nicht als behoben, der Gesamtscan nicht als sauber und das Produkt nicht als ASVS-/CRA-konform erklärt. Runtime-, Browser-, Geräte- und Hardwareabnahme bleiben getrennte Nachweise.
