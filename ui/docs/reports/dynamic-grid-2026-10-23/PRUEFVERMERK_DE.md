# Änderungs- und Prüfvermerk – Dynamischer Netzanschluss 1.0.25

Datum: 23.10.2026. Basis: vollständiger 1.0.24-Repositorystand, Commit `e59d421`. Bearbeitungszweig: `feature/dynamic-grid-app`. Die Quell- und Artefakthashes werden mit dem abschließenden Release-Manifest verbunden.

## Auftrag und Änderung

Die Nutzerkorrektur ersetzt die bisherige Verteilung von Diagnose-/Zuordnungsfeldern durch eine eigene aktive App. Hersteller sind Beispiele, keine Voraussetzung. M0-Messung wird aus Allgemein übernommen, M1 und alle Speicher-Datenpunkte/Betriebsarten stehen in der App. Bestehende Strategiebausteine werden mit getrennten Regelbereichen und einem gemeinsamen finalen Budget verknüpft.

Betroffen: App-Center, React-Seite, Backend/CAS/Lifecycle, generischer Konfigurationsvertrag, Gruppenplaner, M0/M1-Solver, zentraler Speicher-/PV-Writer, Modulreihenfolge und Aktor-Schreibhoheit. Die alte Diagnosekonfiguration bleibt als historische Kompatibilität erhalten. Ohne Aktivierung der neuen App wird keine neue Regelung eingeschaltet.

## Risiken und Nachweise

| Risiko | Umsetzung / gezielte Prüfung |
| --- | --- |
| M0 doppelt oder falsch zugeordnet | Allgemein als einzige Quelle; signed/split, Einheit, Aliasidentität und kohärente Frische |
| Speicher außerhalb M1 überdeckt lokale Verletzung | Physischer Bereich und lokale Gruppe; gemeinsame, geschachtelte Punktgrenzen |
| Alter Regler oder manuelle API schreibt parallel | Permanente Ownership vor erstem Write, Alias-Schreibseiten, Keepalive-/Skipped-Write-Prüfung |
| Konfigurationswechsel während Gerätezugriff | CAS, gemeinsame Speichersperre, Generation direkt vor finalem Write |
| Schreibecho wird als reale Entlastung gebucht | ACK-/Rückmeldestatus getrennt von Istleistung, Alt-/Neufreigaben als Intervalle |
| Stale-Messung oder Ausfall setzt unsicher auf null | Frischeprüfung, kontrollierte Übergabe und nicht verschlechternde Stütz-/Begrenzungsschritte |
| PV-/EVU-Regler konkurrieren | Ein abschließender App-PV-Schreibpfad je Wechselrichter, expliziter EVU-Geltungsbereich |
| Einheiten-/Vorzeichenfehler bei freien DPs | Expliziter W/Rohwert-Vertrag; generische Ausgabe mit Rückmeldung und Split-Reihenfolge |

## Tatsächliche Prüfungen

Abschließender Gesamtlauf am 23.10.2026 erfolgreich, Exit 0. Umgebung: Linux, Node.js 24.19.0, npm 11.9.0, TypeScript 5.8.3; Browserprüfung mit Chromium 153.0.8010.0. Alle folgenden Prüfungen wurden tatsächlich ausgeführt.

| Prüfung | Tatsächliches Ergebnis | Rohprotokoll |
| --- | --- | --- |
| `npm run test:all` | Gesamte Prüfkette erfolgreich, einschließlich bestehender Typ-, Regelungs-, Sicherheits-, Lizenz- und Installationsregressionen | [test-all.log](test-all.log) |
| Dynamic Grid innerhalb der Gesamtprüfung | 117/117 Tests, darunter 9 Integrationstests mit echten Modul-, Writer-, Registry-, Arbiter- und API-Implementierungen; Hardware/I/O simuliert | [dynamic-grid-tests.log](dynamic-grid-tests.log) |
| Bisherige NVP-Domäne innerhalb der Gesamtprüfung | 72/72 Tests; einschließlich lokaler Gruppen und gemeinsamer M0/M1-Budgets | [test-all.log](test-all.log) |
| React-Frontend | 9/9 Prüfungen tatsächlicher Handler und gerenderter Zustände | [frontend-ui.log](frontend-ui.log) |
| Chromium | 15/15 Szenarien, einschließlich Aktivierung, CAS-Konflikt, freier Zuordnung, Rollenprüfung und Mobilansicht | [browser-ui.log](browser-ui.log) |
| `npm run admin:build` | Ausgelieferte Admin-Assets erfolgreich gebaut | [admin-build.log](admin-build.log) |
| `npm run build:ts` | Kanonische Quellen, ausgelieferte JS-Dateien und 508 Runtime-Spiegel synchronisiert; Typbuild erfolgreich | [build-ts.log](build-ts.log) |
| `npm run docs:build` / `npm run docs:check` | Quellcodeverknüpfungen erzeugt und Dokumentationskonsistenz bestätigt | [docs-build.log](docs-build.log), [docs-check.log](docs-check.log) |
| `npm run test:package-runtime-start-smoke` | 247 JS/MJS-Dateien geprüft; relative Imports vollständig; Main-/EMS-/§14a-Startkette konstruierbar | [package-smoke.log](package-smoke.log) |
| `npm pack --dry-run --json --ignore-scripts` | Paketumfang vollständig, 427 Paketdateien; kein Upload | [pack-dry-run.json](pack-dry-run.json) |
| Release-Vorbereitung, SBOM und Artefaktprüfung | Alte Bundle-Assets bereinigt, Paket-/Versionskonsistenz und Secret-Prüfung bestanden; abschließendes Manifest explizit erzeugt und geprüft | [release-prepare.log](release-prepare.log), [release-manifest.log](release-manifest.log), [publish-check.log](publish-check.log) |

Die echte Publish-Prüfkette wurde innerhalb von `test:all` sowohl in einer frischen Repository-Kopie ohne Entwicklungsabhängigkeiten als auch nach einem ZIP-Überkopieren ausgeführt. Hierfür wurde eine lokale Registry-Antwort verwendet; es gab keine externe Veröffentlichung. Ein absichtlich eingebrachter Testfund wurde weiterhin durch die Secret-Prüfung blockiert.

Die Regressionen trennen Schreibannahme, angewandte Grenzen und gemessene Wirkung. Sie prüfen insbesondere freie Alias-Ziele vor dem ersten Tick, Schutz vor konkurrierenden Schreibern, Konfigurationswechsel während eines Writes, veraltete Messwerte, Split-Richtungswechsel, ausstehende PV-Wirkung bei Übergabe sowie gemeinsame §14a-, Mesh- und Lizenzgrenzen. 250 deterministische Solver-Szenarien prüfen die Alt-/Neu-Endpunktkombinationen. Der Testumfang ist ein Software-Nachweis und keine Geräteabnahme.

Im Gesamtlauf mussten zwei ältere AST-/VM-Testaufbauten um echte neue Konfigurationsimporte ergänzt werden. Es wurden keine Schutzprüfungen durch Erfolgs-Stubs ersetzt. Der abschließende Gesamtlauf erfolgte nach dieser Korrektur.

## Abgrenzung

Keine reale Geräte-/Anlagenprüfung, kein Eingriff in eine Feldanlage und kein externer npm-Upload wurden ausgeführt. Die Softwaretests verwenden deterministische Geräte-/Adaptermodelle beziehungsweise Browser mit API-Testserver. Sie belegen keine physische Watchdogwirkung, Reglerreaktionszeit oder Netzgrenze einer konkreten Anlage.

Offen bleiben die Anlagenabnahme der verwendeten generischen DP-Verträge, Reaktionszeiten, lokale Ablauf-/Ausfallwirkung und Wiederherstellung am Zielsystem. Eine Hersteller-Whitelist oder vorab bestätigtes Markenprofil ist keine Aktivierungsvoraussetzung. Bestehende allgemeine Sicherheits-/Freigabethemen bleiben im [Freigabestatus](../../../release-manifests/release-status.json) erhalten.
