# Unabhängige Abschlussprüfung: CI, strikte Prüfumfänge und Paketdateien

Stand: 23.10.2026, NexoWatt UI 1.0.30 im gemeinsamen Arbeitsbaum. Read-only-Review; ausschließlich der anschließend ausdrücklich beauftragte zusätzliche Prüfer `scripts/verify-strict-boundary-configs.cjs` wurde implementiert. Keine Produktquellen, Veröffentlichung oder Zielanlage verändert.

## Testintegration

`test:security-continuation` enthält den neuen zentralen Strict-Guard, die echte Admin-Typprüfung (Oberfläche und Buildtools), Config-/Peer-Typprüfungen, alle drei Admin-Grenzprüfer, native Config-/Peerfälle, Headercheck/-tests, die ESLint-Selbsttests und das echte Lintgate sowie den ENTSO-E-Parsercheck. Die Suite hängt an `test:security-standards`, damit auch an `test:all`, `ci:check` und dem bestehenden Security-CI-Pfad. Root integriert den zentralen Guard ebenfalls in die explizite Paketdateiliste.

Festgestellte Lücke: Ein nachträglicher `noCheck`-/Strict-Unteroptions-Override oder ein verkleinerter Dateiscope konnte vorher beim Peer-/Config-/Adminteil unbemerkt bleiben. Jetzt prüft der zentrale Guard tatsächliche geerbte TypeScript-Konfigurationen, `strict:true`, sämtliche **neun** Strict-Unteroptionen (einschließlich `noImplicitThis`), explizit `noCheck:false`, `noEmit:true`, kein JavaScript-Scope und exakte Dateimengen. Config: vier Dateien; Peer: eine; Admin: alle aktuell 17 TS/TSX/Deklarationsdateien des Quellbaums; Vite-Konfiguration separat eine Datei. Kein Mindestanzahl-Ersatz für Abdeckung. Tatsächliche Compiler-Pragmas und AST-Typknoten verhindern Ignore/Nocheck/ExpectError und explizites `any` in diesen Bereichen.

23 native Positiv-/Negativfixtures lesen echte temporäre Basiskonfigurationen und Overrides. Sie prüfen Optionsabschwächungen, Scopeentfernung/-erweiterung, Unterdrückungsdirektiven und die Unterscheidung zu harmlosem Stringinhalt. Ausführung direkt und über das integrierte npm-Script: **PASS**. Der Prüfer wurde vom CI-Agenten gegengelesen; Root ergänzte im Review das zunächst fehlende `noImplicitThis`, dessen eigener Negativfall jetzt mitläuft.

Das bestehende ESLint-Gate wurde gelesen und seine 25 Policy-/Negativprüfungen unabhängig ausgeführt: **PASS**. Empfohlene Security-Regeln sind verpflichtend aktiv; Inline-Abschaltung wirkt nicht. Neue oder duplizierte Fundstellen blockieren. Strikte Scope-Dateien dürfen keine Typ-Unterdrückungs-/Any-Ausnahme bekommen. Einzelne bewertete Indexzugriffe sind an kommentarfrei normalisierte Quelldateihashes gebunden. Altbefunde bleiben ausdrücklich offen und werden nicht als sauberer SAST-Bericht ausgegeben.

## Remote-CI-Scope

Security-Workflow: Push/PR/manuell, gehostete Ubuntu-Runner, Node 22 und 24, Lesezugriff auf Repository, keine persistierten Checkout-Zugangsdaten, Installation mit `npm ci --ignore-scripts`, Tests, Audit, Build, Dokumentations-/Paketstartprüfung und Pack-Dry-Run. Kein Publish-/Deploymentaufruf, keine Produktivsecrets, kein privilegierter Self-hosted-Runner oder `pull_request_target`.

CodeQL: eigener Workflow mit JavaScript-/TypeScript-Analyse ohne Buildausführung, Security-extended-Abfragen, kanonischer `src-ts`-Produktquellbaum und Admin-src/Vite. Generierte Runtime-Mirror, Tests und Deklarationsdateien sind ausgeschlossene Duplikate bzw. Nicht-Laufzeitquellen. Nur der Analysejob besitzt zusätzlich `security-events:write`. Drittanbieter-Actions sind mit vollständigen Commit-IDs fixiert. Die tatsächliche Remote-Ausführung und Repository-Zweigschutz wurden hier **nicht** nachgewiesen; ein vorhandener Workflow ist kein bestandener GitHub-Lauf.

## Abhängigkeiten und Paketumfang

Gegen die originale 1.0.29-Quell-ZIP unabhängig verglichen:

- Root- und Admin-Runtime-Abhängigkeitsdeklarationen unverändert.
- Alle **78 produktiven Root-Lockeinträge vollständig identisch**, einschließlich Herkunft, Integrität, Versionen und abhängigen Paketen; keine neue Runtime-Abhängigkeit.
- Neue Werkzeuge sind Entwicklungsabhängigkeiten. Die neuen Runtimehelfer verwenden lokale bzw. native Node-Module.
- `lib/config-boundary-contracts.js` und `lib/mesh-peer-http.js` sind vorhanden und ausdrücklich in `files` enthalten; auch der neue Strict-Guard ist gelistet.
- Momentaufnahme während des laufenden Admin-Builds: alter Assetlistenverweis `admin/react/assets/index-DPu0nhp3.js` fehlt. Root wurde informiert; der ohnehin anstehende Release-/Assetabgleich muss den endgültigen Bundlehash eintragen. Die endgültige Pack-/Publishprüfung erfolgt nach diesem Schritt durch Root. Keine vorweggenommene Paketfreigabe aus der Zwischenaufnahme.

Belege: `runtime-ci-package-dependencies.json`, `runtime-ci-eslint-policy-tests.log`, `runtime-strict-config-guard.log`, `runtime-ci-integrated-strict-guard.log`. Der ältere Dependency-Momentbericht enthält den vor dem Assetabgleich beobachteten fehlenden Dateinamen; die übergeordneten endgültigen Artefaktbelege sind danach maßgeblich.

## Ergebnisgrenzen

Die bestätigte Strict-Guard-Lücke ist geschlossen. Keine weiteren bestätigten Blocker in der geprüften Test-/CI-Integration. Gesamtsuite, finaler Bundle-/Paketabgleich, SBOM und Start des tatsächlichen Pakets bleiben beim Root-Abschlusslauf. Keine Aussage über externe CI-Ausführung, reale Geräte, vollständige ASVS-/CRA-Erfüllung oder allgemeine Produktionsfreigabe.
