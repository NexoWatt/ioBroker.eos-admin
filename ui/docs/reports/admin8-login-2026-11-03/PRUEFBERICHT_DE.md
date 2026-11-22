<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# NexoWatt UI 1.0.33 – EMS-Anmeldung bei Admin 8

Stand: 03.11.2026. Anlass: Gemeldete Ablehnung von Benutzername/Passwort im EMS bei installiertem Admin 8 und NexoWatt UI 1.0.32. Die genaue Admin-/Controller-Patchversion sowie ein Zugriff auf diese Anlage lagen nicht vor. **Der lokale Fehler wurde reproduziert und korrigiert; die konkrete Ursache auf der Nutzeranlage ist noch nicht durch einen dortigen Test bestätigt.**

## Ausgangspunkt und Ergebnis

Basis ist ausschließlich das vollständige Archiv `NexoWatt_UI_1.0.32_PARTNER_ARBITRAGE_TEST_FULL_REPOSITORY.zip`, SHA-256 `2b692e6b5b74b4211422c92ab922cfa6c72750ce31abd42654c51c42717a620a`. Dieser Stand baut auf der vom Nutzer geforderten Version 1.0.31 auf. Paket, Adapter, Webmanifest und Release-Nachweise wurden auf 1.0.33 fortgeschrieben; keine ältere GitHub-Version wurde als Basis eingesetzt.

Die direkte Passwortschnittstelle ist grundsätzlich mit dem ioBroker-Controllervertrag nutzbar, den auch Admin verwendet. Ein genereller Passwortformatwechsel durch Admin 8 wurde nicht belegt. Die Ursache des reproduzierten Fehlers liegt in der lokalen EMS-Zuordnung: 1.0.32 las vor der Passwortprüfung `system.user.` plus rohe Eingabe. Beispielsweise `Admin`, ein Anzeigename oder `system.user.admin` scheiterten dadurch bereits vor dem Controlleraufruf.

1.0.33 löst zuerst die tatsächliche Konto-ID auf und verwendet anschließend dieselbe Identität für Passwortprüfung, Fingerabdruck, Rolle, Sitzung und Antwort. Das neue Modul ist strikt typisiert. Es verändert weder Benutzerpasswörter noch Benutzerobjekte und übernimmt keine Admin-SSO-/OAuth-Tokens. Die Anlagenregelung und die Partnerfunktionen aus 1.0.32 werden weitergeführt.

## Befunde und Sicherheitswirkung

| Kennung | Reproduzierter Befund | Korrektur / Nachweis |
| --- | --- | --- |
| NW-AUTH-11 | Controllergültige Namen/IDs konnten wegen roher ID-Verkettung nicht angemeldet werden. | Öffentliche `getUserID`-Auflösung mit Controller-Fallback für Kurzkennungen; vollständige IDs eindeutig verwenden. Erfolgreiche HTTP-Regressionen für Kurzname, Großschreibung, Anzeigename und vollständige ID. |
| NW-AUTH-12 | Die Passwortprüfung bestätigte gegebenenfalls ein anderes Konto als das anschließend nach roher Eingabe berechtigte Konto. | Exakte Bindung an kanonische Objekt- und Callback-ID. Anzeigenamen wie „admin“/„installer“ vergeben keine Rolle. Der Test prüft den Fall eines Kundenkontos mit solchem Anzeigenamen ausdrücklich. |
| NW-AUTH-13 | `!!ok` akzeptierte unerwartete Truthy-Rückgaben des Passwortprüfers. | Ausschließlich Boolean `true` mit identischer ID gültig; Fehlerobjekte, Strings, fehlende oder abweichende IDs verweigern die Anmeldung. |

Die Namensverwechslung ist sicherheitsrelevant; ihre Ausnutzbarkeit im konkreten System hängt unter anderem davon ab, wer Benutzerobjekte beziehungsweise Anzeigenamen verändern darf. Der Test mit künstlichen Callbackfehlern belegt eine vorher unzureichende interne Vertragsprüfung, nicht einen Nachweis, dass ein entfernter Client diese Callbackwerte unmittelbar kontrolliert.

Passwortfingerabdrücke werden vor und nach der kanonischen Passwortprüfung verglichen. Eine zwischenzeitliche Passwortänderung, Kontosperre, Löschung oder ID-Abweichung verhindert die Anmeldung. Bestehende Sitzungen bleiben an Kontofingerabdruck und aktuelle Rolle gebunden. Rate-Limits, Sitzungsgrenzen und strikte Installer-/Admin-Rollen bleiben aktiv; es gibt keinen Auth-Aus-Bypass. Fehlermeldungen des Login-Catchs werden mit festem Diagnosecode statt fremden Fehlertexten protokolliert.

Ein monotones gemeinsames Zeitbudget von höchstens fünf Sekunden begrenzt Namensauflösung, Kontolesen und Passwortprüfung. Die ioBroker-Aufrufe sind nicht abbrechbar; nach Ablauf werden Ergebnisse verworfen und keine weiteren Prüfschritte gestartet. Späte Promise-Ablehnungen sind abgefangen. Die nachfolgende lokale Rollenauflösung und Status-/Gruppenabfragen liegen weiterhin außerhalb dieses Budgets; ein hängender lokaler Datenbankdienst bleibt eine bekannte Betriebsgrenze.

Im getrennten Review wurde zusätzlich ein Randfall bei kanonischen IDs mit führenden/nachlaufenden Leerzeichen gefunden und vor Auslieferung geschlossen. Solche IDs werden jetzt vor Kontolesen und Rollenbildung abgewiesen. Die abschließende Dokumentationsanpassung ergänzte nur die vorgeschriebenen Headerfelder; frühere Teilprüfhashes kennzeichnen ihren jeweiligen Stand. Das finale Vollarchivmanifest bindet sämtliche gelieferten Dateien.

## Tatsächlich ausgeführte Prüfungen

Prüfumgebung: Linux, Node.js v24.22.1, npm 11.9.0, TypeScript aus dem Lockfile. Die Auth-Integration verwendet den tatsächlichen ausgelieferten Express-Server über lokale HTTP-Verbindungen und synthetische ioBroker-Objekte/Callbackverträge. Es wurde keine reale Admin-8-Instanz und keine Kundenanlage angemeldet.

| Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| `npm run build:ts` | Exit 0; 14.38 s | `final-build.log` |
| `npm run docs:build` | Exit 0; 3.7 s | `final-docs.log` |
| `npm run docs:check` | Exit 0; 0.28 s | `final-docs-check.log` |
| `npm run release:generate-manifest` | Exit 0; 1.77 s | `final-seal.log` |
| `npm run test:all` | Exit 0; 241.44 s | `final-test-all.log` |
| `npm run publish:check` | Exit 0; 1.15 s | `final-publish-check.log` |
| `npm run test:package-runtime-start-smoke` | Exit 0; 1.19 s | `final-runtime-start.log` |
| `npm pack --dry-run --json --ignore-scripts` | Exit 0; 3.04 s | `final-pack-dry.log` |
| Auth-Modul einschließlich Strict-TypeScript | 16 Prüfgruppen bestanden | `iobroker-user-auth.log`, finaler Gesamtlauf |
| Tatsächliche HTTP-Anmeldung | 15 Prüfgruppen bestanden | `auth.log`, finaler Gesamtlauf |
| Bestehende Auth-/CRA-Regression | 19 Prüfgruppen bestanden | `existing-auth.log`, finaler Gesamtlauf |

Zusätzlich wurden 16 unabhängige Agentenprüffälle zur Identitätsbindung, Kontoänderung, Deadline und verspäteten Ablehnung ausgeführt. Dies ist eine getrennte KI-gestützte Prüfung, keine externe Zertifizierung. Der zugehörige Bericht und die bereinigten Belege liegen in diesem Verzeichnis. Die neue Authprüfung ist dauerhaft an `test:all` angebunden.

Der Gesamtumfang enthält auch die bestehenden EMS-, Partner-, Rechte-, CRA-, Browser-, Sicherheits- und Paketregressionen. Die frische Repositorykopie und das Überkopieren alter Admin-Dateien werden durch die echte `prepublishOnly`-Prüfkette gegen eine lokale Testregistry geprüft; ein künstlicher Secretfund muss sie blockieren. Es wird dabei nichts veröffentlicht. Vorhandene Auth-Fixtures wurden auf den tatsächlichen Controllervertrag mit kanonischer Callback-ID und `_id` aktualisiert; es wurden keine Rollen- oder Passwortgrenzen durch Test-Ausnahmen ersetzt.

## Abhängigkeiten und statische Prüfung

Die produktiven npm-Abhängigkeiten sowie der Admin-Buildbaum melden am Prüfdatum jeweils **0 bekannte Auditbefunde**. Das ist kein Nachweis vollständiger Schwachstellenfreiheit.

Im gesamten Root-Entwicklungsbaum wurden zunächst 14 betroffene Pakete gemeldet, darunter ein hoher Befund in `follow-redirects` 1.16.1. Das ausschließlich über die Entwicklungswerkzeuge eingebundene Paket wurde exakt auf **1.16.2** aktualisiert. Der Lockfilevergleich weist außer der Produktversion nur diesen Versionswechsel aus. Das offizielle Advisory nennt für die konkret enthaltene Axios-Version keine reproduzierte Ausnutzung; dennoch wurde der verfügbare Patch übernommen.

Der abschließende Root-Audit enthält noch **13 moderate Meldungen ausschließlich im Entwicklungsbaum**, im Wesentlichen weitergereichte Meldungen zu `glob`/`minimatch`. Diese sind offen dokumentiert. Keine pauschalen, potenziell inkompatiblen Major-Overrides oder erzwungenen Werkzeug-Downgrades wurden angewandt. Entwicklungswerkzeuge sollen bis zu ihrer separat geprüften Aktualisierung nur auf vertrauenswürdigen lokalen Projektdateien laufen. `node_modules` wird im Lieferarchiv nicht mitgeliefert.

Security-ESLint: 175 Quellen, 3067 Hinweise, davon 2971 historische offene Hotspots und 96 einzeln bewertete Vorkommen; **0 neue oder verbotene ungeprüfte Stellen**. Das neue Auth-Modul ist zusätzlich im strikten Bereich des Gates enthalten. Die Legacybaseline wurde nicht erweitert. Fünf bereits bewertete Main-Zugriffe auf begrenzte Partner-/Diagnosedaten wurden als unverändert geprüft und an den neuen AST-Codehash gebunden; Rohdateihashes und diese Codehashes sind unterschiedliche Nachweise. Ein bestandenes Gate bescheinigt keine vollständige ASVS-/IEC-/CRA-Erfüllung.

## Nachweise, Betrieb und Grenzen

Die bestehenden Auth-Befunde wurden um NW-AUTH-11 bis NW-AUTH-13 ergänzt. Releasehinweise, Betriebsdiagnose, Quellcodedokumentation, SBOM, Artefaktbindung und offene Freigabepunkte werden im selben Stand mitgeliefert. Der Produktstatus bleibt `review`, `productionApproved: false`. Die getrennte Produktionsfreigabe muss weiterhin sperren.

Vor dem Update Konfiguration sichern. Nach dem Update den UI-Adapter neu starten und dieselben lokalen ioBroker-Zugangsdaten erneut prüfen. Bei Namensgleichheit ist die vollständige Konto-ID eindeutig. Nach mehreren Fehlversuchen die angezeigte Sperrfrist abwarten; keine Benutzerobjekte oder Passwort-Hashes für eine Diagnose exportieren. Gegebenenfalls UI-/Admin-/Controller-Version, Wortlaut und HTTP-Status ohne Geheimnisse bereitstellen.

Für die Anlagenabnahme zu prüfen: erfolgreiche Anmeldung mit vorhandenem berechtigtem Konto, Ablehnung falscher Passwörter, Kunden-/Installer-/Admintrennung sowie Sitzungswiderruf nach Kontosperre. Die bekannte HTTP-/HTTPS-Proxy- und Mehrinstanz-Cookie-Grenze aus dem Bestandsbericht bleibt offen. Die vorhandenen weiteren Produktfreigabehindernisse einschließlich Anlagenabnahme, vollständigem EOS-Inventar, Remote-CodeQL, externem Sicherheitsreview und dokumentierter NW1-Kompatibilitätsausnahme bleiben bestehen.

Es wurden keine produktiven Zugangsdaten geändert, kein Livesystem aktualisiert und kein Paket extern veröffentlicht. Der Bericht unterstützt die CRA-Nachweisführung; er ersetzt keine Konformitätsbewertung oder Herstellerentscheidung.

## Offizielle Quellen und mitgelieferte Unterlagen

- Controllervertrag: https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/adapter/src/lib/adapter/adapter.ts – `getUserID`, Namenscache und `checkPassword`.
- Passwortprüfung: https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/common-db/src/lib/common/password.ts – PBKDF2-Prüfung, keine Passwortmigration im Prüfschritt.
- Admin-Änderungen: https://github.com/ioBroker/ioBroker.admin/blob/master/CHANGELOG_OLD.md – getrennte OAuth-/Sessionänderungen.
- Dev-Abhängigkeit: https://github.com/advisories/GHSA-mrwp-f3q8-3g9p – `follow-redirects`, gepatcht in 1.16.2.
- Einrichtung: `docs/operations/ADMIN8_EMS_ANMELDUNG_DE.md`.
- Einzelprüfung: `AUTH_PRUEFVERMERK_DE.md`; unabhängiger Review: `UNABHAENGIGER_REVIEW_DE.md`.
- Aktueller Paketbezug: `scripts/release-artifact-manifest.json`, `release-manifests/sbom-product.cdx.json`, `release-manifests/sbom-product-evidence.json` und `release-manifests/repository-payload-sha256.json`.
