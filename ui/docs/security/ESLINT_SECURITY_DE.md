<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
Use, modification or distribution without express written permission is prohibited. -->
# ESLint-Sicherheitsprüfung und offene Altbefunde

Stand: 23.10.2026, Kandidat 1.0.30. Ein grünes Regressionsgate bedeutet, dass keine zusätzlichen oder ausdrücklich verbotenen Scannerfundstellen vorliegen. Es bedeutet **nicht**, dass der Adapter frei von Sicherheitslücken ist oder OWASP ASVS vollständig erfüllt.

## Ausführung und tatsächlicher Umfang

- `npm run lint:security`: echte ESLint-Ausführung plus Altbefund-/Reviewgate.
- `npm run test:lint-security`: 25 positive und negative Policy-/Scannerprüfungen.
- `npm run lint:full`: unbereinigte ESLint-Ausgabe aller Fundstellen; wegen bestehender Altbefunde ist derzeit Exitcode 1 zu erwarten.
- `NEXOWATT_LINT_REPORT=/absoluter/pfad/report.json npm run lint:security`: vollständiger lokaler Fundbericht ohne Quelltext-/Secretkopien.
- `npm run ci:security`: Linttests und Gate vor den bestehenden nativen Sicherheitsprüfungen und Abhängigkeitsaudits. Der GitHub-Workflow installiert Root- und Admin-Lockfiles mit `npm ci --ignore-scripts`.

ESLint prüft alle `.ts`/`.tsx` unter `src-ts/runtime-executables/` und `src-admin-tab/src/` sowie `src-admin-tab/vite.config.ts`. Die Dateiliste wird zusätzlich unabhängig vom ESLint-Glob rekursiv ermittelt; fehlende Konfiguration, Symlinks, unvollständige Scannerresultate und Parserfehler blockieren die Prüfung. Generierte JavaScript-/Admin-Bundles werden durch die vorhandenen Quell-/Build-/Paketprüfungen abgedeckt, nicht als zweite Kopie derselben Quelle gelintet. Andere Entwicklungswerkzeuge und historische Spiegelquellen gehören nicht zu diesem syntaktischen Lintumfang.

Alle 16 empfohlenen Regeln von `eslint-plugin-security` laufen mit Fehlerstufe. Hinzu kommen `no-explicit-any`, das Verbot aller `@ts-ignore`, `@ts-nocheck` und `@ts-expect-error`, sowie die Kernregeln gegen `eval`, implizites Eval, `new Function`, `__proto__`, Script-URLs und unsichere Kontrollflusskonstruktionen. `noInlineConfig` verhindert lokale ESLint-Abschaltungen. Das Gate kontrolliert die wirksame Konfiguration jeder Quelldatei, nicht nur den Text der Konfigurationsdatei.

Adminquellen sowie `http-error-boundary.ts`, `nvp-config-api.ts`, `dynamic-grid-config-api.ts`, `config-boundary-contracts.ts` und `mesh-peer-http.ts` dürfen selbst historische `any`-/TS-Unterdrückungsfundstellen nicht übernehmen. Ihre echte TypeScript-Typprüfung bleibt eine zusätzliche, unabhängige Prüfung.

## Werkzeuge und Laufzeitabhängigkeiten

| Entwicklungswerkzeug | Exakte Version |
| --- | --- |
| ESLint | 10.13.0 |
| `@typescript-eslint/parser` | 8.72.0 |
| `@typescript-eslint/eslint-plugin` | 8.72.0 |
| `eslint-plugin-security` | 4.2.0 |
| TypeScript, unverändert | 5.8.3 |

Die vier neuen Pakete sind ausschließlich `devDependencies`. Bestehende Adapter-Laufzeitabhängigkeiten wurden dafür nicht ergänzt. Der Adapter behält `engines.node >=22`; ESLint 10 benötigt für die Entwicklung Node 22.13.0 oder neuer innerhalb der 22er-Reihe beziehungsweise Node 24. Die CI-Matrix verwendet die aktuellen Patches von Node 22 und 24. Lokale Nachweise dieses Schritts liefen auf Node 24.19.0. Die Remote-CI-Matrix ist dadurch nicht als ausgeführt bestätigt.

ESLint 9 wurde bewusst nicht neu eingeführt: Die offizielle ESLint-Supporttabelle weist dessen Supportende zum 06.08.2026 aus. Primäre Referenzen: [ESLint-Version-Support](https://eslint.org/version-support/), [Flat Configuration](https://eslint.org/docs/latest/use/configure/configuration-files), [`no-explicit-any`](https://typescript-eslint.io/rules/no-explicit-any/), [Security-Plugin und Hinweise zu Fehlalarmen](https://github.com/eslint-community/eslint-plugin-security).

## Herkunft und Grenzen der historischen Bestandsaufnahme

`eslint-legacy-baseline.json` stammt ausschließlich aus dem unveränderten Eingangsarchiv `NexoWatt_UI_1.0.29_SICHERHEIT_TEST_FULL_REPOSITORY.zip`, SHA-256 `73714ad0975c6d1ae6a16f4a8fe8df354d04b075e915be72a35b53362f38a1ed`. Dokumentiert sind Werkzeugversionen, SHA-256 jeder der 161 ursprünglichen Quellen und 3.060 historische Fundvorkommen in 2.276 Gruppen. Ein unwirksames vorhandenes `eslint-disable-next-line eqeqeq` war zusätzlich sichtbar; es wurde ausdrücklich nicht freigegeben und aus der kanonischen PV-Prognosequelle entfernt.

Ein Fingerprint enthält gehasht Datei, Regel, Diagnosetyp, betroffenen Codeausschnitt, Quellzeile und benannten Funktionskontext. Zeilenverschiebungen durch Lizenzheader sind zulässig. Vorkommenszahlen verhindern, dass dieselbe bereits bekannte Stelle beliebig dupliziert wird. Neue Fundstellen, zusätzliche Vorkommen und nicht inventarisierte Parser-/Inline-Diagnosen blockieren. Abgebauter Bestand darf verschwinden. Es gibt keinen CI-Befehl zum automatischen Akzeptieren des aktuellen Bestands.

Fingerprints sind syntaktische Regressionskontrollen. Eine neue unsichere Datenquelle vor einer unveränderten alten Zugriffsstelle kann denselben Fingerprint behalten. Die historische Liste ist daher ein **offener Sanierungsbestand**, keine pauschale Sicherheitsfreigabe und keine Datenflussanalyse. Änderungen der Baseline erfordern nachvollziehbaren Quellvergleich und menschliche Prüfung im Änderungsprozess.

## Einzeln gepruefte Indexzugriffe

`eslint-reviewed-findings.json` dokumentiert ausschließlich einzeln nachgelesene neue `security/detect-object-injection`-Hinweise mit Fund-Fingerprint, Anzahl, Begründung und Quellbindung. Es enthält keine Freigabe für `any`, Typprüfungsunterdrückung oder Parserfehler.

Die 48 Vorkommen in 44 Gruppen betreffen interne konstante Formular-/Schema-Keys, geprüfte Arraypositionen, das kopierende Admin-JSON-Gate mit gesperrten Prototypschlüsseln, validierte ioBroker-Zuordnungen und Null-Prototyp-Dictionaries. Jeder Eintrag ist zusätzlich an den SHA-256 der gesamten durch TypeScript ohne Kommentare gedruckten Quelldatei gebunden. Änderungen am Code verlangen eine erneute Prüfung; reine Lizenzkommentare ändern diese Bindung nicht. Die Scannerregeln laufen auch für diese Stellen weiterhin und melden ihre Fundstellen.

## Tatsächlicher Befundstand des geprüften Kandidaten

| Regelgruppe | 1.0.29 | Geprüfter 1.0.30-Stand |
| --- | ---: | ---: |
| Object-Injection-Hotspots | 2.314 | 2.319 |
| Explizites `any` | 606 | 563 |
| TS-Unterdrückungen | 73 | 73 |
| Nichtliterale Dateipfade | 32 | 32 |
| Regex-Hotspots | 18 | 16 |
| Mögliche Timing-Angriffe | 12 | 12 |
| Nichtliterale RegExp-Konstruktoren | 4 | 3 |
| Nichtliterales `require` | 1 | 1 |
| Gesamte Scannerfundvorkommen | 3.060 | 3.019 |

165 Quellen wurden tatsächlich gescannt. 2.971 aktuelle Fundvorkommen gehören zum offenen historischen Bestand, 48 zu den einzeln geprüften Zugriffen; 89 frühere Fundvorkommen sind nicht mehr vorhanden. Neue oder verbotene Fundvorkommen: **0**. Null `eval`-/`new Function`-Treffer ist eine Aussage über diesen Scannerlauf und seinen Umfang, kein Nachweis einer umfassenden Abwesenheit dynamischer Ausführung.

Der ausführliche Prüfvermerk und die Regex-Triage stehen in `docs/reports/security-continuation-2026-10-23/ESLINT_PRUEFNACHWEIS_DE.md`. CodeQL/Datenflussanalyse, echte Feldtests und ASVS-Gesamtbewertung bleiben separat nachzuweisen.
