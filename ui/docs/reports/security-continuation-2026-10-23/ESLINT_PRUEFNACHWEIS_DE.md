<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
Use, modification or distribution without express written permission is prohibited. -->
# Tatsächlicher Nachweis: ESLint, Abhängigkeiten und ENTSO-E-Parser

Datum: 23.10.2026. Gegenstand: Arbeitsstand 1.0.30 aus unverändertem 1.0.29-Eingangsarchiv. Lokale Umgebung Node 24.19.0; keine Remote-CI-Ausführung oder Produktivinstallation durch diese Prüfung.

## Ausgeführte Prüfungen

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| Root `npm ci --ignore-scripts --no-audit` vor Änderungen | Erfolgreich; bestehendes TypeScript 5.8.3 verfügbar |
| Exakte ESLint-/TypeScript-ESLint-/Security-Plugin-Installation als Devtools | Erfolgreich; keine neue Runtime-Abhängigkeit |
| Historische ESLint-Erfassung aus SHA-geprüftem 1.0.29-ZIP | 161 Quellen, 3.060 Fundvorkommen, 2.276 Fingerprintgruppen; Inline-Abschaltung nicht zugelassen |
| Echter aktueller ESLint-Lauf plus Gate | 165 Quellen; 3.019 aktuelle Hinweise; 2.971 historisch offen, 48 einzeln geprüft, 0 neue/verbotene Treffer |
| `node scripts/verify-eslint-security-test.cjs` | 25 Checks grün: tatsächliche Regeln, neue Stelle, mehr Vorkommen, alte Stelle entfernt, Header verschoben, striktes Admin-`any`, Parserfehler, Inline-Abschaltung, abgeschwächte Policy und Codebindung |
| Root `npm audit --json` nach Devtoolinstallation | 0 bekannte Schwachstellen: info/low/moderate/high/critical jeweils 0; 369 erfasste Paketinstanzen einschließlich Entwicklung/optional |
| `node --test scripts/verify-entsoe-linear-parser.cjs` | 19 Tests grün, einschließlich direkt ausführbarer Legacy-Copyquelle |
| Runtime-Synchronisierung und `node --check ems/services/tariff-provider-registry.js` | Erfolgreich nach Korrektur der versehentlich eingefügten TS-Syntax in der Legacy-Copyquelle |
| Bestehendes `node scripts/verify-cra-tariff.cjs` auf erzeugter Runtime | 23 Fälle grün, darunter HTTPS-/Redirect-/Body-/Gesamtbudget, OAuth-Budget, negative Preise, ENTSO-E und Cache-Ausfallverhalten |

Die nativen bisherigen Sicherheitsguards bleiben eingebunden. `lint:full` ist absichtlich kein grüner „bereinigter“ Scan: Dort erscheinen sämtliche Altbefunde weiterhin. Der GitHub-Security-Workflow ruft `ci:security` auf; eine erfolgreiche Remote-Ausführung wird hier nicht behauptet. Ein späterer gesamter Integrationslauf und Paket-/Overlayprüfungen werden im übergeordneten Prüfbericht getrennt dokumentiert.

## NW-REGEX-01: bestätigter CPU-Befund und Korrektur

Die historische ENTSO-E-Normalisierung suchte Period-/Point-Blöcke mit einem Muster, das nach jedem ungeschlossenen Starttag erneut bis zum Ende suchen konnte. Ein isolierter Test des Originalmusters zeigte bei 8 KiB ungefähr 1,6 ms, bei 32 KiB ungefähr 18,5 ms und bei 128 KiB ungefähr 311 ms. Bei 512 KiB musste der Kindprozess nach zwei Sekunden beendet werden. Die vorhandene 2-MiB-Antwortgrenze und ein asynchrones Fünf-Sekunden-Abbruchsignal begrenzen solche synchrone Regex-Arbeit nicht ausreichend.

Betroffene kanonische Quelle: `src-ts/runtime-executables/ems/services/tariff-provider-registry.ts`, ursprüngliche `Period`-/`Point`-Muster sowie die verwandte dynamische Suchroutine `xmlText`. Angriffspfad ist eine fehlerhafte/kompromittierte konfigurierte Anbieterantwort; die Messung ist kein Nachweis eines extern anonym erreichbaren Endpunkts.

Die neue native `xmlBlocks`-Routine durchläuft die Eingabe vorwärts, hält einen maximal 32 Elemente tiefen Stack und begrenzt Knotenzahl auf 65.536 sowie Taglänge auf 16 KiB. Auch direkte Normalisiereraufrufe erhalten die 2-MiB-Bytegrenze. DTD-/Entity-Verarbeitung findet nicht statt. Ungeschlossene, verschachtelte gleichnamige Zielblöcke und widersprüchliche Schließtags werden verworfen. Prefix-Namensräume, normale Attribute mit Anführungszeichen und `>` im Attributwert, XML-Deklaration und Kommentare bleiben unterstützt. Dies ist ein begrenzter Parser für die vorhandenen ENTSO-E-Preisfelder, kein allgemeiner XML-Prozessor.

Die Regressionstests erhalten Viertelstunden, mehrere Perioden, korrekte Zeitgrenzen, Preise unter null und EUR/MWh-Umrechnung. Fehlende Auflösung, fehlende Preise, falsche Positionen, unvollständige Attribute, übergroße Quellen/Tags und externe Deklarationen werden abgelehnt. Wiederholte ungeschlossene `Period`-, `Point`- und `start`-Tags mit rund 0,49–0,56 MiB wurden nach der Korrektur lokal in ungefähr 1–2 ms verworfen; jeder Angriffstest hat zusätzlich einen äußeren Zwei-Sekunden-Kindprozess-Abbruch. Diese Messwerte sind umgebungsabhängige Nachweise und kein SLA.

Die Funktionsprüfung transpiliert die kanonische Testquelle. Zusätzlich prüft ein eigener Test ihre direkte JavaScript-Syntax, weil dieser historische Quellteil vom Runtime-Generator kopiert wird. Damit würde die während des Reviews entdeckte, inzwischen behobene Integration von TS-Annotationen in eine kopierte Runtime erneut fehlschlagen.

## Triage aller 18 ursprünglichen Regex-Hotspots

| Quelle / Funktion | Ursprüngliche Treffer | Ergebnis der gezielten Sichtprüfung |
| --- | ---: | --- |
| `ems/evcs-control-mapping.ts`, Demand-/Status-ID-Erkennung | 2 | Optionale feste Präfixe, keine unbeschränkt wiederholte innere Gruppe; kein konkreter ReDoS bestätigt |
| `ems/modules/charging-management.ts`, `isObservationOnlyEvcsDemandObjectId` | 1 | Gleicher fester Präfix/Suffix-Fall; kein konkreter ReDoS bestätigt |
| `ems/modules/ai-advisor.ts`, `parseClockMinutes` | 1 | Zifferngruppen auf 1–2 Zeichen begrenzt |
| `ems/modules/pv-forecast.ts`, Datums-/Uhrzeitparser | 2 | Begrenzte Zifferngruppen; einzelne disjunkte Whitespace-Wiederholung |
| `ems/modules/tarif-vis.ts`, `_parseTimeToMinutes` | 1 | Begrenzte Uhrzeitfelder plus einzelne Dezimalziffernfolge; kein konkreter ReDoS bestätigt |
| `ems/services/open-meteo-pv-forecast.ts`, aktuelle Zeit und `forecastTimestamp` | 2 | Begrenzte ISO-Zeitfelder |
| Dieselbe Wetterquelle, `meaningfulLocationLabel` | 1 | Getrennte Zahlen-/Separatorfelder; kein konkreter ReDoS bestätigt |
| `ems/services/tariff-provider-registry.ts`, `toIso` | 1 | ISO-Felder und Nachkommastellen begrenzt |
| Dieselbe Tarifquelle, `parseIsoDurationMinutes` | 1 | Einzelne Ziffernfolgen mit unterschiedlichen H-/M-Trennzeichen; kein konkreter ReDoS bestätigt |
| Dieselbe Tarifquelle, Period-/Point-Suche | 2 | **NW-REGEX-01 bestätigt und durch begrenzten vorwärtslaufenden Scanner ersetzt** |
| Dieselbe Tarifquelle, numerischer Preis | 1 | Verankerte Dezimalzahl mit getrennten Alternativen; kein konkreter ReDoS bestätigt |
| `lib/mesh-coordinator-writer.ts`, `clampMeshWrite` | 1 | Feste Pfadbestandteile und einzelne Ziffernfolge |
| `main.ts`, Extraktion eines Zahlentokens | 1 | Unverankerte Suche akzeptiert bereits den ersten Zahlentoken; kein teurer erfolgloser Endankerpfad bestätigt |
| `www/smarthome-config.ts`, Cover-Select-Konvertierung | 1 | Verankerte Ganz-/Dezimalzahl aus Formularauswahl; kein konkreter ReDoS bestätigt |

Die übrigen 16 Regex-Hinweise verbleiben sichtbar im historischen Scannerbestand. Die Sichtprüfung ist kein formaler Laufzeitbeweis für sämtliche Eingaben. Die zwölf Timing-Hinweise betreffen nach erster Sicht vorwiegend boolesche Policy-/Authentifizierungsfelder und werden nicht pauschal als Kryptografielücken oder als erledigt eingestuft.

Der einzelne `security/detect-non-literal-require`-Hinweis in `main.ts` lädt den Energy-Flow-Spiegel ausschließlich über `path.join(__dirname, 'lib', 'ts-mirrors', 'energy-flow', 'resolvers', 'energy-flow-resolver.js')`. Alle Pfadsegmente sind interne Literale; es werden weder Remote-URLs noch Benutzereingaben als Modulnamen eingesetzt. Der Scannerhinweis bleibt im offenen Bestand sichtbar. Die 32 Dateipfad- und übrigen Object-Injection-Hinweise sind weiterhin nicht vollständig einzeln sicherheitstechnisch bewertet.

## Grenzen und Rohbelege

Rohbelege des Arbeitslaufs: `eslint-initial.json`, `eslint-final.json`, `eslint-final.log`, `npm-audit-root.json`, `regex-cpu-original.json`, `regex-cpu-probe.cjs`, `entsoe-linear-parser.log` und `cra-tariff-after-parser.log`. Die historischen Quellen wurden separat aus dem SHA-geprüften Eingangsarchiv gelesen; der Kandidat wurde nicht als eigene Altbefundfreigabe verwendet.

Offen bleiben 563 explizite `any` und 73 TS-Unterdrückungsdiagnosen im historischen Quellbestand außerhalb der strikt geschützten Teilbereiche. Keine dieser Zahlen wird als vollständig strikter Adapter umgedeutet. Auch „0 bekannte npm-Schwachstellen“ ist eine zeitpunktbezogene Registerabfrage, kein Beleg der Harmlosigkeit aller Abhängigkeiten. Weitere Datenfluss-/ASVS-Prüfung, funktionsbezogene Feldtests und endgültige Releaseentscheidung bleiben erforderlich.
