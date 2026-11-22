# Lieferkettenprüfung NexoWatt UI 1.0.22

Prüftag: 29.09.2026. Ausgangspunkt ist die bereitgestellte vollständige Repository-ZIP 1.0.21. Die Änderungen und Quellhashes stehen in `docs/reports/cra-2026-09-29/dependency-version-changes.json`; Befunde sind mit dem zentralen Befundregister und Prüfbericht zusammen zu lesen. Umgebung: Linux x64, Node.js 24.19.0, npm 11.9.0. Geräte-, Betriebssystem- und ioBroker-Controller-Bestand waren nicht Bestandteil dieses Dependency-Scans.

## Ergebnis und Änderungen

`npm ci --ignore-scripts --no-audit` gelang für Root und Admin ohne Lockfile-Neuberechnung. Beide Lockfiles verwenden npm-Format 3; alle archivierten Paketquellen kommen aus `https://registry.npmjs.org/` und besitzen Integritätswerte. Lifecycle-Skripte wurden bei Installation und Aktualisierung unterdrückt. Das ist eine Begrenzung ausgeführten Fremdcodes, keine vollständige Prüfung der npm-Pakete.

| Bereich | Ausgangsstand | Änderung / Nachweis |
| --- | --- | --- |
| HTTP-Laufzeit (SUP-01) | Express 4.22.2, body-parser 1.20.5, qs 6.15.2 | Gezieltes kompatibles Lockfile-Update auf Express 4.22.3, body-parser 1.20.8 und qs 6.16.0. Keine Express-5-Migration. |
| Entwicklungswerkzeuge | npm audit meldete insgesamt 16 betroffene Root-Pakete einschließlich Laufzeit; 7 high, 8 moderate, 1 low | Kompatible gezielte Updates von Axios, ZIP-, Formular-, YAML-, Protobuf- und Brace-Abhängigkeiten. Einzelne alte/neue Versionen im JSON-Nachweis; kein pauschales `audit fix --force`. |
| Ungenutzte Testbibliothek (SUP-02) | `@iobroker/testing` zog unter anderem anfälliges esbuild, diff und serialize-javascript nach | Paket entfernt, nachdem 1.464 Projekt-Code-/Konfigurationsdateien und sämtliche npm-Prüfbefehle keine Verwendung zeigten. 67 installierte Pakete entfielen. Eigene Node-/Assert-Prüfskripte bleiben bestehen. |
| Root-Schlussaudit | Zunächst 16 gemeldete Pakete; nach kompatiblen Updates noch 6 | Nach Entfernen der ungenutzten Testbibliothek: `npm audit --json` und `npm audit --omit=dev --json` jeweils Exit 0 und null Meldungen. |
| Admin-Router (SUP-03) | React Router / DOM 6.30.6, zwei moderate Paketmeldungen | Nach API-/Herstellerprüfung gezielt auf React Router DOM 7.18.4 migriert und exakt gepinnt. 36 neue Routing-/Zugriffsschutzprüfungen und Admin-Build bestanden. Schlussaudit: Exit 0, null Meldungen; `npm-audit-admin-final.json`. |
| Geheimnisschutz (SUP-04) | SMTP-, private Schlüssel-, Installationsdatei- und Altbundle-Schutz | Erkennbare GitHub-, GitLab-, npm-, AWS-, Slack- und OpenAI-Projekt-/Diensttoken ergänzt; Diagnosen nennen nur Pfad, Zeile und Regel. |

Die Baseline und Zwischenstände bleiben als eigene Rohbelege erhalten. npm zählt betroffene Pakete einschließlich abhängiger Eltern; das ist keine Anzahl unabhängig ausnutzbarer Produktlücken. Null Audit-Meldungen bedeuten ausschließlich, dass die abgefragte Advisory-Datenbank für diesen Baum keine Meldung lieferte.

Zum Schlussstand melden Root-Gesamtbaum, Root-Produktionsbaum und Admin-Gesamtbaum jeweils **null** Audit-Befunde. Root- und Admin-Lockfileänderungen sind getrennt in `dependency-version-changes.json` und `admin-dependency-version-changes.json` gegen das ursprüngliche ZIP belegt.

SUP-01: Der Herstellerfehler in body-parser betrifft ungültige Größenlimits; die geprüften EOS-Aufrufe verwenden feste gültige Limits. Die qs-Meldung betrifft eine besondere Serialisierungskette. Eine ausnutzbare EOS-Aufrufkette wurde nicht behauptet. Die betroffenen Versionen wurden vorsorglich entfernt und das Fehlerverhalten lokal nachgeprüft.

SUP-02: Der anfällige serialize-javascript-Code wurde nicht durch einen ungetesteten Major-Override ersetzt. Er ist nach Entfernung der ungenutzten Testbibliothek nicht mehr im aktuellen Root-Baum. Der Nachweis `unused-testing-dependency-review.json` benennt die Suchabdeckung; vollständige Regressionsergebnisse stehen im zentralen Prüfbericht.

SUP-03: Die ursprüngliche Routerbewertung fand ausschließlich `HashRouter`, `createRoot`, deklarative Routen sowie konstante interne Navigationsziele. Das SSR-Advisory schließt Declarative Mode ausdrücklich aus. Für das Redirect-Advisory wurde keine Übergabe angreifergesteuerter Pfade an die Navigation gefunden. Diese ursprüngliche Codeprüfung ersetzt weder die separate Migrationsprüfung noch Browser-/Installationstests.

Die anschließende bewusste Migration auf Router 7.18.4 entfernt dennoch den alten betroffenen Bibliotheksstand. Sie ist als geprüfte gezielte Major-Migration getrennt von den kompatiblen Root-Lockfileupdates dokumentiert; ein automatisches Major-Update wurde nicht verwendet. Nachweise: `scripts/verify-cra-admin-router.cjs` und `docs/security/frontend-review-de.md`.

## SBOM und Abgrenzung

Die [SBOM-Automatik](SBOM_AUTOMATIK_DE.md) erzeugt zusätzlich eine hashgebundene Produkt-SBOM automatisch vor der Release-Versiegelung und prüft sie schreibfrei vor jeder Veröffentlichung. Sie bleibt ausdrücklich von einem Inventar des tatsächlich installierten ioBroker-Hosts getrennt.

`node scripts/generate-cra-sbom.cjs --require-installed` verwendet das eingebaute `npm sbom` ohne Netz und ohne Installation. Erfasst werden Paketversionen, npm-PURLs, deklarierte Lizenzen, Tarball-Integritätswerte und Abhängigkeitskanten. Metadaten enthalten Generatorversion/-hash, Paket-/Lockfilehash, Node-Version, Plattform und Inventarart.

| Datei unter `release-manifests/` | Bedeutung |
| --- | --- |
| `sbom-root-lockfile.cdx.json`, `sbom-admin-lockfile.cdx.json` | Quell-/Lockfileinventare einschließlich Entwicklungs- und optionaler Plattformpakete; keine Installationsbehauptung. |
| `sbom-root-installed.cdx.json`, `sbom-admin-installed.cdx.json` | Tatsächlich vorgefundene installierte Prüfumgebungen einschließlich Buildwerkzeugen. |
| `sbom-root-installed-runtime.cdx.json`, `sbom-admin-installed-runtime.cdx.json` | Tatsächlich installierte npm-Abhängigkeitsbäume mit `--omit=dev`; noch kein Nachweis eines ausgelieferten Gerätes. |
| `admin-bundle-components.json` | Rollup-Modulgraph nach dem Schreiben der Ausgabe, tatsächlich gerenderte npm-JavaScript-Module sowie Hashes von Quellen, Eingangsdokument, Konfiguration, Lockfile und finalen Assets. |
| `sbom-admin-bundle.cdx.json` | Nur tatsächlich zum Browser-JavaScript beitragende npm-Pakete aus diesem Buildnachweis. Tarball-Hashes bezeichnen Ursprungspakete, nicht eine unveränderte Paketdatei im minifizierten Bundle. |
| `sbom-index.json` | Inventartyp, Komponentenanzahl und SHA-256 aller zugehörigen SBOM-Dateien. |

Komponentenanzahlen sind nach npm-SBOM-Identität zusammengefasste Pakete; Lockfile-Pfadanzahlen zählen gegebenenfalls dieselbe Version mehrfach. Fehlende optionale Fremdplattformpakete erklären weitere Unterschiede. Der Generator verweigert ein Bundleinventar bei geänderten Assets, Quellen, Modulen, Konfiguration oder Lockfile. Ein erneuter Admin-Build ist dann erforderlich. Nach finalen Paketänderungen ist die SBOM neu zu erzeugen.

Offene Systemgrenzen: Kein vollständiges Inventar von Betriebssystem, ioBroker/js-controller, weiteren Adaptern, Firmware oder tatsächlich beim Kunden installierten Paketen. Ungebündelte externe Skripte, Bilder, Schriften und deren Rechte werden von der npm-Bundle-SBOM nicht vollständig erfasst. npm-Metadaten sind keine abgeschlossene Lizenzprüfung. Registry-Signaturen, Provenance und ein reproduzierbarer Geräte-Image-Build wurden nicht verifiziert. `package-lock.json` wird durch npm regulär nicht als Installationssperre eines veröffentlichten Abhängigkeitspakets angewandt; Semverbereiche können bei späterer Geräteinstallation andere transitive Stände ergeben. Vor Serienfreigabe ist deshalb der tatsächliche Geräte-/Installationsbaum mit SBOM und Update-/Rückfallnachweis zu erfassen. Verantwortlich: NexoWatt Releaseverantwortung; Termin: vor Serienfreigabe.

## Ausgeführte Prüfungen und CI

Die Rohbelege liegen unter `docs/reports/cra-2026-09-29/`, jeweils mit UTC-Zeit, Befehl, Exitcode und Ausgabe:

- `npm-ci-root.*`, `npm-ci-admin.*`: reproduzierbare Installation, beide Exit 0.
- `npm-audit-root.json`, `npm-audit-admin.json`: Ausgangs-Audits; Zwischen- und Schlussaudits tragen eigene Dateinamen.
- `npm-update-runtime.*`, `npm-update-development.*`, `npm-remove-unused-testing.*`: tatsächlich vorgenommene Dependency-Änderungen.
- `dependency-regressions.*`: sechs bestandene lokale Prüfungen zu normalem JSON, 413-Größenlimit, 400 bei ungültigem JSON, weiter funktionsfähiger Query-Verarbeitung, manipulierter qs-Konstruktorinformation und ungültiger Limitkonfiguration. Loopback-Test; keine EOS-Geräteprüfung.
- `secret-scan-final.*`: erkannte Tokenformate, kurze Platzhalter, keine Werte in Ergebnissen, bereits vorhandene Staged-Index-/Hook-/Publish-Sperrtests; Exit 0. Keine vollständige Git-Historie oder generische Entropie-/Binärdateiprüfung.
- `admin-bundle-build.*`, `sbom-generation.*`, Router-Migrationsnachweise: Build und Inventarerzeugung. Die neuesten SBOMs beziehen sich auf den jeweiligen finalen Buildgraphen.

Die neu angelegte GitHub-Workflowdatei und Dependabot-Konfiguration sind lokal prüfbare Konfiguration, keine Behauptung aktivierter Repository-/Organisationsrichtlinien. Der Workflow nutzt begrenzte Tokenrechte, auf vollständige SHAs gesetzte offizielle Actions, fremde Pull Requests ohne Produktivgeheimnisse und keine Veröffentlichung. Branchschutz, MFA, verantwortliche Reviewer und dauerhafte Aufbewahrung der Prüfarbelege müssen am verbindlichen Remote-Repository eingerichtet beziehungsweise nachgewiesen werden. Vollständige Norm-/CRA-Konformität folgt aus diesen Prüfungen nicht.

## Herstellerquellen (abgerufen am 29.09.2026)

- npm-SBOM-Modi: <https://docs.npmjs.com/cli/v11/commands/npm-sbom/>
- body-parser: <https://github.com/expressjs/body-parser/security/advisories/GHSA-v422-hmwv-36x6>
- qs: <https://github.com/ljharb/qs/security/advisories/GHSA-4mjr-xmp4-gh2g>
- Ursprünglicher Router-Redirectbefund: <https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6>
- Ursprünglicher Router-SSRbefund: <https://github.com/remix-run/react-router/security/advisories/GHSA-337j-9hxr-rhxg>
- Entfernte Testabhängigkeiten: <https://github.com/yahoo/serialize-javascript/security/advisories/GHSA-5c6j-r48x-rmvq>, <https://github.com/evanw/esbuild/security/advisories/GHSA-67mh-4wv8-2f99>, <https://github.com/kpdecker/jsdiff/security/advisories/GHSA-73rr-hh4g-fpgx>
