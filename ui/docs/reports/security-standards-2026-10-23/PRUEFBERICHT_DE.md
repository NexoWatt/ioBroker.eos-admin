<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis untersagt. -->
# Sicherheitsprüfung und Änderungsnachweis – NexoWatt UI 1.0.28 / 1.0.29

Datum: 23.10.2026. Geltungsbereich: ausgeliefertes vollständiges Adapterpaket
1.0.28 und daraus abgeleiteter Sicherheits-Teststand 1.0.29. Keine Prüfung des
vollständigen EOS-Hosts, anderer Adapter oder einer realen Kundenanlage.

**Ergebnis: Die geforderten Regeln werden im Gesamtadapter nur teilweise erfüllt.**
Die bisherigen erfolgreichen Funktions-/Browserprüfungen sind kein Nachweis
vollständiger OWASP-ASVS-Konformität, vollständiger Typsicherheit oder allgemeiner
Fehlerfreiheit. Diese Prüfung ersetzt keine unabhängige Zertifizierung.

## Geprüfter Ausgangsstand

- Datei: `NexoWatt_UI_1.0.28_EMS_LAYOUT_DP_FULL_REPOSITORY.zip`
- SHA-256: `c807a69f3602225afe653e7c87c72c5523ab0d61a8c2b1b1d5f0e176612fe7e1`
- Quellen wurden frisch aus diesem Archiv entpackt. Historische Berichte wurden
  als Kontext, nicht als aktueller Schwachstellenstatus verwendet.
- Lokale Umgebung: Linux, Node.js 24.19.0, npm 11.9.0, TypeScript 5.8.3.
- Prüfverfahren: Konfigurations-/Quellenreview, TypeScript-AST-Inventar, reale
  lokale HTTP-Anfragen mit simuliertem Adapter, vorhandene Sicherheitsregressionen,
  aktuelle npm-Advisories und gezielte Nachprüfungen.

## Nutzerentscheidung und Sicherheitsarchitektur

Die zusätzliche Vorgabe lautete zunächst: keine npm-Abhängigkeiten, kein externer
Code/Konfigurationsnachschub, unveränderliche Konfiguration, keine `any`-Typen,
strikte Runtime-Validierung und proprietäre Dateiheader.
Nach Erläuterung der Architekturfolgen hat der Nutzer ausdrücklich
**„ioBroker erhalten“** gewählt. Die notwendige ioBroker-/HTTP-/Mail-/Frontend-
Integration bleibt daher als dokumentierte Ausnahme bestehen. Es wurden keine
neuen Laufzeitpakete allein für Validierung oder Fehlerbehandlung hinzugefügt.

Diese Ausnahme ist keine Aussage, dass Fremdpakete automatisch sicher sind.
Lockdateien, aktuelle Komponentenprüfungen und Regressionen bleiben erforderlich.
Auch TypeScript selbst und Node-Typdefinitionen sind Entwicklungswerkzeuge,
keine native TypeScript-Standardlaufzeit von Node.js.

Die vorhandene lokale Einrichtung über EMS Apps und Datenpunktzuordnung bleibt
bedienbar. Ausschließlich statische Umgebungsvariablen für sämtliche Parameter
sind deshalb im aktuellen Gesamtprodukt **nicht** umgesetzt. Lokale, berechtigt
vorgenommene Konfigurationsänderungen sind von nachgeladenem Remote-Code zu
unterscheiden. `Object.freeze` ist allein nur flach; es ersetzt weder tiefe
Validierung noch Zugriffsrechte und schützt nicht vor einem kompromittierten
Node.js-Prozess. Fehler werden an Vertrauensgrenzen behandelt; pauschales
Verschlucken aller Exceptions wäre kein Sicherheitsnachweis.

## Abgleich mit den geforderten Regeln

| Anforderung | Befund im Ausgangsstand 1.0.28 | Stand / Konsequenz |
| --- | --- | --- |
| OWASP Top 10 / ASVS | Rollen-, Sitzungs-, Origin-, Größen-/Timeout-, XSS- und Konfigurationsprüfungen vorhanden; ASVS 5.0.0 L2 nur als Ziel dokumentiert. | Teilweise nachgewiesen; vollständige Liste anwendbarer Einzelanforderungen mit Belegen fehlt. |
| CWE-Vermeidung | Mehrere frühere CWE-Klassen gezielt bearbeitet; aktuelle HTTP-Fehleroffenlegung reproduziert. | CWE ist eine Schwächenklassifikation, kein Gütesiegel. Neue Befunde unten. |
| `strict: true` | In `tsconfig.base.json` vorhanden, einschließlich weiterer strenger Optionen. | Allein nicht ausreichend: Runtime-Build `noCheck:true`, zahlreiche Datei-Ausnahmen. |
| Kein `any` | 654 echte AnyKeyword-Typknoten in 62/787 `src-ts`-Dateien; zusätzlich 9 im Admin. | Nicht erfüllt im Bestand. Neuer Sicherheitshelfer separat ohne `any` und ohne Prüfabschaltung abgesichert. |
| Vollständige TS-Prüfung | 581/787 `src-ts`-Dateien mit wirksamer `@ts-nocheck`-Direktive (73 Runtimequellen, 508 Spiegel). Admin vom Root-Typecheck ausgeschlossen. | Ein bestandener Typecheck gilt nur für den tatsächlich geprüften Anteil; Migration offen. |
| Runtime-Validierung | Native Validatoren für Konfigurationsbäume, Gerätezuordnung, Messwerte, Wetter und Tarife vorhanden. | Keine zusätzliche Zod-/ArkType-/io-ts-Abhängigkeit nötig; Vollständigkeit jeder Systemgrenze noch nicht belegt. |
| Prototype-Pollution-Abwehr | Gefährliche Konfigurationsschlüssel und Tiefe werden an zentralen Import-/Mergegrenzen abgefangen; mehrere Null-Prototyp-Dictionaries vorhanden. | Bestehende Negativtests vorhanden; keine Zusage, dass jedes Dictionary im Altbestand `Object.create(null)` verwendet. |
| ESLint und Security-Plugins | Keine entsprechende Konfiguration / direkte Abhängigkeit / CI-Lintstufe. | Offen. Neuer begrenzter AST-Guard ist ausdrücklich kein gleichwertiger Ersatz. |
| SCA | Dependabot und `npm audit` in CI konfiguriert. Frischer Scan hat fünf betroffene Pakete gefunden. | Aktuelle Patches und Nachprüfung unten; alte Null-Fund-Berichte waren zeitgebunden. |
| SAST | Kein CodeQL-/Sonar-Workflow im ZIP, keine Remoteausführung belegt. | Neuer Workflow ist Vorbereitung; erfolgreicher Remote-CodeQL-Lauf bleibt offen. |
| Null externe Pakete | Vier direkte Backend-Laufzeitabhängigkeiten sowie React-/Router-Frontend. | Nach ausdrücklicher Nutzerentscheidung notwendige Bestandsausnahme. |
| Null dynamische Codeausführung | Zwei `eval('module')`-Aufrufe in EMS-Helfern. Statischer String, kein Beleg einer Code-Injection. | In 1.0.29 durch statische CommonJS-Exporte ersetzt; Quellen und Laufzeitartefakte bei abgeschalteter String-Codegenerierung geprüft. |
| Nur interne/frozen Konfiguration | Bestehende lokale Benutzer-/Installerkonfiguration und optionale Wetter-/Tarifdaten. | Gesamtregel nicht erfüllt; erforderliche UI-Konfiguration bleibt erhalten. Keine Remote-Code-Beschaffung durch neue Härtung. |
| Proprietäre Header pro Datei | Zentrale proprietäre LICENSE/UNLICENSED vorhanden; Header fehlen in allen 144 Runtime-TS- und 15 Admin-Dateien der Stichprobeninventur. | Neue/geänderte Sicherheitsquellen erhalten Header; gesamte Altbestandsumstellung offen. Fremdlizenzen dürfen nicht überschrieben werden. |
| Keine sensiblen Fehlerantworten | Parserfehler und einzelne Routefehler legen interne Details offen. | Konkrete Korrektur in 1.0.29; Nachweise unten. |
| Sichere Übertragung | Server startet HTTP, standardmäßig 0.0.0.0:8188. TLS hängt vom Betriebsaufbau ab. | NW-OPEN-01 bleibt offen; kein geprüfter TLS-/Reverse-Proxy-Nachweis der realen Anlage. |
| Geheimnisse / Lizenzen | Historischer gemeinsamer NW1-Prüfwert zur Feldtestkompatibilität enthalten. | NW-SECRET-01 bewusst offen. Keine heimliche Sperrung oder Lizenzmigration; spätere EOS-Architektur getrennt. |

Die AST-Zahlen zählen Typsyntax, keine Kommentare oder bloße Zeichenfolgen.
Spiegeldateien sind in der Gesamtzahl enthalten und keine zusätzlichen unabhängigen
Produktfunktionen. `any` und `noCheck` sind zunächst Standard-/Nachweisdefizite,
kein Beweis einer jeweils ausnutzbaren Schwachstelle. `unknown` allein verhindert
keine Injection: konkrete Datenprüfung, Kontextkodierung und Rechteprüfung bleiben nötig.

## Neue und fortgeführte Befunde

| Kennung | Befund und Voraussetzungen | Priorität / Maßnahme |
| --- | --- | --- |
| NW-HTTP-01 | Nicht angemeldeter Aufrufer sendet syntaktisch defektes JSON an `/api/auth/login`. Ohne gesetztes NODE_ENV gibt Express einen HTML-Stacktrace mit Dateipfaden zurück. | Mittel; CWE-209. Feste JSON-Fehlerantwort und terminale Fehlergrenze, keine fremden `message`-/`stack`-Inhalte. |
| NW-HTTP-02 | Interne Fehlermeldungen werden beim Simulator, über gespeicherte Statuswerte sowie über fremde, wie Validierungsfehler geformte Installer-/NexoLogic-Exceptions ausgegeben. Synthetische Testmarker nachgewiesen. | Mittel; CWE-209. Unerwartete Fehler auf statische Diagnosecodes abbilden; Alt-Statuswerte beim Lesen bereinigen und echte interne Validierungsfehler über WeakMap-Identität statt fremder status/code-Felder erkennen. Kontrollierte Mesh-/Simulator-Bedienhinweise erhalten. |
| NW-TS-01 | `noCheck`-/`@ts-nocheck`-Ausnahmen und Admin-Prüflücke. | Hoch für die zugesagte Coding-Anforderung; kein pauschaler Angriffsnachweis. Schrittweise echte Typisierung mit Regression statt bloßes Entfernen von Direktiven. |
| NW-TS-02 | Explizite `any`-Typen im Bestand. | Mittel; konkrete Verträge/Type Guards ergänzen, kein blindes Ersetzen durch Casts oder `unknown as T`. |
| NW-CODE-01 | Zwei `eval('module')`-Aufrufe, obwohl statische CommonJS-Exporte ausreichen. | Niedrig für tatsächliche Ausnutzung, klare Abweichung von der neuen Regel. In 1.0.29 entfernt; CommonJS-Quellen-/Artefakttests und bestehende EVCS-Regressionen bestanden. |
| NW-PROC-04 | Kein genereller ESLint-Sicherheitslauf und kein belegter SAST-Lauf. | Mittel; begrenzten Guard transparent benennen, CodeQL bereitstellen, Remote-Lauf und Branchschutz nachweisen. |
| NW-LIC-02 | Proprietärer Header nicht durchgängig in eigenen Dateien. | Vorgabenabweichung; neue Quellen kennzeichnen, Altbestand über Generatoren konsistent migrieren. Keine rechtliche Begutachtung. |
| NW-DEP-04 | Aktuelle Advisories betreffen fünf gelockte Pakete. | Scanner-Schweregrad und konkrete Nutzung unten getrennt; kompatible Updates statt unkontrolliertem `audit fix --force`. |

Zuständig: EOS-Entwicklung. Produktbefunde vor Übernahme des betroffenen Stands
nachprüfen; vollständige Standardmigration mit eigenem kontrollierten Arbeitsumfang
fortführen. Die Kennungen NW-SECRET-01 und NW-OPEN-01 werden nicht neu nummeriert
oder aufgrund anderer bestandener Tests geschlossen.

## Aktuelle Abhängigkeiten

| Paket | 1.0.28 | Korrekturstand | Einordnung |
| --- | --- | --- | --- |
| proxy-addr | 2.0.7 | 2.0.8 | Express-Laufzeitbaum; Advisory kritisch. Betroffenes Vertrauenssubnetz-/Proxy-Szenario ist im Adapter nicht als tatsächlich aktiver Angriffspfad belegt. |
| @grpc/grpc-js | 1.14.4 | 1.14.6 | Entwicklungswerkzeugbaum; höchste Advisory-Stufe hoch. |
| follow-redirects | 1.16.0 | 1.16.1 | Entwicklungswerkzeugbaum; hoch. |
| source-map-js | 1.2.1 | 1.2.2 | Admin-Buildbaum; hoch. |
| vite | 7.3.6 | 7.3.7 | Entwicklungsserver/Buildwerkzeug; hoch. Der Vite-Server ist nicht die ausgelieferte statische Admin-Oberfläche. |

Ein Paket-/Advisory-Treffer beweist noch nicht dessen Ausnutzbarkeit in der
konkreten Anlage. Umgekehrt reicht eine aktuell nicht benutzte verwundbare
Teilfunktion nicht als dauerhafter Ersatz für das verfügbare Update.
Die aktuelle Komponentenliste und SBOM sind über die Release-Nachweise an den Lieferstand 1.0.29 gebunden.

## Umsetzung und abschließende Nachprüfungen

Die native Fehlergrenze liegt in
`src-ts/runtime-executables/lib/http-error-boundary.ts`. Sie verwendet echte
strikte Typprüfung, `unknown`, eigene Property-Deskriptoren, eingefrorene
Antwortverträge und eine interne WeakMap für die Identität öffentlicher
Validierungsfehler. Dafür wird kein zusätzliches Laufzeitpaket importiert.
Die kanonischen Main-, Mesh-, NVP-, Dynamic-Grid- und NexoLogic-Quellen nutzen
diese Grenze an den konkret bearbeiteten Fehlerpfaden. Die Simulation zeigt
kontrollierte Bedienhinweise als Text; fremdes Markup wird nicht interpretiert.
Die bestehenden Lizenzen und Regelberechnungen wurden nicht migriert.

| Tatsächlich ausgeführte Prüfung | Ergebnis / Beleg |
| --- | --- |
| `npm run test:all` | Bestanden, Exit 0, 163,51 Sekunden; `test-all.log`, `test-all-result.json`. Einschließlich Lizenz-/Rollen-/EMS-/Mesh-/CRA-bezogener Regressionen, Installation/Überkopieren sowie der neuen Sicherheitsprüfungen. |
| `npm run build:ts` | Bestanden; 145 kanonische Runtime-Dateien und 509 Spiegel synchronisiert. `build-ts-final.log`. Die oben benannten Legacy-Typprüfausnahmen bleiben sichtbar. |
| `npm run admin:build` | Bestanden mit Vite 7.3.7; `admin-build.log`. Keine Änderung des bisherigen EMS-/DP-Layouts. |
| `npm run test:security-standards` | Bestanden: 17 Guard-Selbsttests plus echter Strict-Compilerlauf für den neuen Helfer, 5 Generator-/Headerprüfungen, 6 statische Exportprüfungen, 23 reale HTTP-Prüfgruppen und 12 Simulation-UI-Vertragsprüfungen. `security-standards-final.log`. |
| Separate Gegenprüfung | 9 Probengruppen bestanden; 18 geprüfte Dateihashes, echter erzeugter HTTP-Laufzeitcode. `SECOND_REVIEW_DE.md`, `second-review-evidence.json`, reproduzierbar mit `independent_http_review.cjs`. Dies ist eine getrennte KI-Prüfung, keine externe Zertifizierung. |
| `npm run test:dynamic-grid-save-browser` | 6 Szenarien bestanden: echte Express-Routen, gebautes React, globales/Kind-Speichern, CAS-Konflikt und Backupimport. `browser-save.log`. |
| `npm run test:dynamic-grid-ui-browser` | 12 Szenarien bestanden: 1440/1920/390 Pixel, echte DP-Baum-/Suchrouten, Formularerhalt, Rollen und Popup. `browser-ui.log`, `browser-ui-final-result.json`. |
| Aktuelle npm-Audits | Root und Admin jeweils einschließlich dev: Exit 0, null bekannte Schwachstellen zum dokumentierten Abrufzeitpunkt. `npm-audit-1.0.29-root.json`, `npm-audit-1.0.29-admin.json`. |
| Dokumentation | 251 Modulbeschreibungen synchron und geprüft; `docs-build-final.log`, `docs-check-final.log`. |
| Paket-/Startprüfung | 253 ausgelieferte JS/MJS-Dateien syntaktisch geprüft, statische relative Abhängigkeiten vollständig, Main-/EMS-/§14a-Startkette mit neutralen externen Stubs konstruierbar. `package-runtime-final.log`. |
| Artefakt/SBOM und npm-Packliste | `release:generate-manifest`, `publish:check` und `npm pack --dry-run --json --ignore-scripts` bestanden. Endbelege `release-manifest-final.log`, `publish-check-final.log`, `npm-pack-dry-run.json`. Kein npm-Publish. |
| CodeQL | Workflow und YAML lokal geprüft, Action-Commits festgelegt. Kein erfolgreicher GitHub-Lauf und kein aktiver Branchschutz nachgewiesen. |

Die Rohlogs früherer fehlgeschlagener Vorläufe bleiben zur Nachvollziehbarkeit
erhalten und sind kein aktueller Erfolgsbeleg. Behoben wurden eine explizite
NodeNext-Resolverangabe für den vorhandenen Konfigurationsprüfer, der fehlende
echte Fehlerhelferimport in einer älteren Teil-AST-Lizenztesthilfe, verlorene
Mesh-/Simulator-Bedienhinweise und die vom Releaseprüfer verlangte Produktnennung.
Die Lizenz- und Berechtigungsassertions wurden nicht abgeschwächt.

Der Browser-DP-Test prüfte einmal zu früh: Das Verbergen des übergeordneten
Dialogs liegt vor der asynchronen `postMessage`-/React-Feldübernahme. Der Test
wartet jetzt höchstens zwei Sekunden auf den exakten erwarteten Feldwert und
behält dieselbe Gleichheitsprüfung. Der vollständige Browserlauf bestand danach.
Dieser abschließende Testhilfen- und Dokumentationsabgleich änderte den zuvor
vollständig geprüften Produktcode nicht.

Die aktuelle Produkt-SBOM und Quellen-/Artefaktbindung sind in
`release-manifests/sbom-product.cdx.json`, `sbom-product-evidence.json` und
`scripts/release-artifact-manifest.json` dem Stand 1.0.29 zugeordnet. Für das
vollständige Repository ergänzt `release-manifests/repository-payload-sha256.json`
die einzelnen Datei-Hashes. Das mitgelieferte `package_full_repository.py`
prüft ZIP-Pfade, Pflichtdateien, CRC und Hashgleichheit; der eigene Manifestpfad
ist vom Selbsthash ausgeschlossen. Entwicklungsabhängigkeiten und temporäre
Buildverzeichnisse sind nicht Teil des vollständigen Repository-ZIPs.

Keine Hardware- oder Feldtests, keine Anmeldung am Livegerät und keine
Veröffentlichung werden behauptet. Nicht erledigt durch diese Teilkorrektur:
vollständige Strict-/no-any-Umstellung, ESLint-Abdeckung, sämtliche proprietären
Header, ausschließlich statische Gesamtkonfiguration, ASVS-L2-Klauselprüfung,
realer TLS-/Hostnachweis, unabhängiger Penetrationstest und spätere neue
Lizenzarchitektur. Der Stand bleibt **nicht für den Produktivbetrieb freigegeben**.

## Offizielle Referenzen (abgerufen 23.10.2026)

- OWASP Top 10:2025: https://top10.owasp.org/2025/ – Risikobewusstsein, keine vollständige Prüfnorm.
- OWASP ASVS 5.0.0: https://asvs.owasp.org/ – verifizierbare Anforderungen; L2 als Projektziel.
- TypeScript strict: https://www.typescriptlang.org/tsconfig/strict.html
- Explizites any: https://typescript-eslint.io/rules/no-explicit-any/
- CWE: https://cwe.mitre.org/about/faq
- ESLint-Sicherheitsplugin: https://github.com/eslint-community/eslint-plugin-security
- CodeQL: https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning

Die genaue Advisory-Triage und Versionsnachweise stehen in
[LIEFERKETTE_DE.md](LIEFERKETTE_DE.md), die Ausgangsinventur in
[typescript-inventory-1.0.28.json](typescript-inventory-1.0.28.json) und die
Compiler-/CI-Bewertung in [typescript-ci-ausgangsbefund.txt](typescript-ci-ausgangsbefund.txt). ASVS/CWE/OWASP-Zielbezug wird nicht mit einer Zertifizierung oder
vollständiger CRA-Konformität gleichgesetzt.
