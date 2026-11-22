<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# NexoWatt UI 1.0.34 – Individuelle Passwörter und Gruppenrechte

Stand: 03.11.2026. Auftrag: Alle gültigen lokalen ioBroker-Benutzer unabhängig vom Benutzernamen unterstützen, ihr eigenes Passwort prüfen und die tatsächliche Berechtigungsgruppe berücksichtigen. Quellbasis ist das vollständige 1.0.33-Archiv, SHA-256 `58ced5bb86ce758cf2c853f64e4db0ca923793ce5aa2c1ba79d1b35823e0eb8c`. Dieser Stand baut auf 1.0.32 und 1.0.31 auf. Keine ältere Repositoryfassung wurde eingemischt.

## Ergebnis und Änderung

Jeder Benutzer meldet sich mit seinem eigenen lokalen ioBroker-Passwort an. Die vorhandene Kontoprüfung löst Kurzkennung, auflösbaren Anzeigenamen oder vollständige Konto-ID in dieselbe kanonische Identität auf und prüft diese über die öffentliche ioBroker-Passwortschnittstelle. Passwörter bleiben unverändert; ein Administratorpasswort ist kein Ersatz für das Passwort eines anderen Kontos. Eine erfolgreiche Passwortprüfung und eine passende EOS-Berechtigung sind getrennte Voraussetzungen.

Die lokale Rollenauflösung verwendet ab 1.0.34 ausschließlich tatsächliche Gruppenmitgliedschaften. Die bisherigen Ausnahmen für `admin`, `installer`, `kunde`, `user` und `customer` sowie konfigurierbare Benutzerlisten sind entfernt. Beispielsweise kann `system.user.dominique` durch die Administratorgruppe Administrator sein. Der Name `system.user.admin` allein reicht nicht aus. Die tatsächliche Konto-ID aus der Passwortprüfung wird für Gruppen, Rolle, Sitzung und Kontowiderruf durchgängig beibehalten.

| EOS-Rolle | Standardgruppen | Berechtigungsumfang |
| --- | --- | --- |
| Administrator | `system.group.administrator`, `system.group.eosAdmin`, `system.group.nexowattAdmin` | Vollzugriff einschließlich Lizenz-/Benachrichtigungsverwaltung. |
| Installateur | `system.group.installer`, `system.group.eosInstaller`, `system.group.nexowattInstaller` | Technische Einrichtung und EMS-Konfiguration, ohne Lizenz-/Benachrichtigungsverwaltung. |
| Kunde | `system.group.user`, `system.group.eosUser`, `system.group.nexowattUser` | Freigegebene Kundenbedienung und Kundeneinstellungen. Keine technische Einrichtung und keine reine Leserolle. |

Eigene Gruppen anderer Anbieter lassen sich in der vorhandenen ioBroker-Adapterkonfiguration unter **Sicherheit** einer dieser Rollen zuordnen. Die dort eingegebenen vollständigen Gruppen-IDs ergänzen die Standardgruppen. Ein Gruppenanzeigename, ein Benutzername oder ein einzelnes ioBroker-ACL-Flag erzeugt keine automatische Administratorberechtigung. Generische Objekt-/State-/Datei-ACLs und EOS-Funktionsrollen sind keine identischen Rechtemodelle. Unzugeordnete Konten erhalten trotz richtigen Passworts keine EOS-Freigabe. Bei mehreren passenden Gruppen gilt Administrator vor Installateur vor Kunde.

## Sicherheitsgrenze und Migration

Das neue Rollenmodul ist strikt typisiert und benötigt keine neue Abhängigkeit. Es prüft vollständige Gruppen-ID, exakte Objekt-ID, Objekttyp `group`, Mitgliederdatentypen und das optionale Boolean-Feld `enabled`. Mitgliedschaft verlangt die vollständige kanonische `system.user.*`-ID; verschachtelte Gruppen werden nicht aufgelöst. Fehlerhafte bestehende Objekte, Lesefehler, ungültige Konfiguration oder Fristüberschreitung verweigern die gesamte lokale Rollenauflösung. Nicht vorhandene oder explizit deaktivierte Gruppen vergeben keine Rolle.

Grenzen: 32 Einträge pro Gruppenfeld, 8192 Zeichen pro Texteingabe, 128 Zeichen pro ID-Suffix, 128 unterschiedliche zugeordnete Gruppen und 10000 direkte Mitglieder pro Gruppe. Ein gemeinsames Zeitbudget von höchstens fünf Sekunden begrenzt die Gruppenprüfung. Das Konto-/Passwortmodul besitzt ein eigenes Fünf-Sekunden-Budget. ioBroker-Leseaufrufe lassen sich nicht abbrechen; verspätete Ergebnisse werden verworfen und beginnen keine weiteren Gruppenabfragen. Der ältere separate Kontofingerabdruck-Lesezugriff beim Sitzungszugriff ist dadurch nicht zusätzlich begrenzt. Es wird keine harte Echtzeitgarantie für den gesamten HTTP-Aufruf behauptet.

Bestehende Sitzungen prüfen Konto und aktuelle Gruppen bei nachfolgenden autorisierten HTTP-Zugriffen erneut. Rollenabstufung, Mitgliedsentfernung, Gruppenlöschung und Deaktivierung wirken daher vor dem regulären Sitzungsablauf. Die DB-Abfragen sind keine atomare Transaktion; bereits laufende Vorgänge lassen sich durch einen späteren Gruppenentzug nicht rückwirkend aufheben. Es wird keine sofortige globale Transaktionssperre behauptet.

Vor dem Update Konfiguration sichern und mindestens ein vorgesehenes Administratorenkonto als tatsächliches Mitglied einer zugeordneten Administratorgruppe sicherstellen. Dies betrifft ausdrücklich auch das eingebaute `admin`-Konto. Frühere `accessControl.adminUsers`, `accessControl.installerUsers`, `accessControl.customerUsers` und `auth.installerUsers` vergeben keine Rolle mehr; eine feste Diagnose warnt bei bestehenden Benutzerlisten ohne deren Inhalt zu protokollieren. Die alte zusätzliche Gruppenliste `auth.installerGroups` bleibt unterstützt. Benutzerobjekte, Passwörter und Gruppen werden nicht automatisch verändert. Mitgliedschaften werden bewusst außerhalb des EMS im ioBroker-Admin gepflegt.

Die separate Trusted-Header-Anbindung bleibt als ausdrücklich konfigurierte Gatewaydelegation bestehen. Sie ist standardmäßig deaktiviert und verlangt das konfigurierte Geheimnis. Bei Aktivierung kann der vertrauenswürdige Gateway weiterhin Rolle/Gruppen übermitteln. Dies ist keine lokale Benutzer-/Passwortanmeldung und keine Behauptung, dass jede delegierte Identität über lokale DB-Gruppen authentifiziert wird. Eine ungültige lokale Gruppenpolicy sperrt auch diese Anbindung. Bestehende Origin-, Rate-Limit-, Sitzungs- und Capability-Grenzen bleiben erhalten.

## Befunde und Nachweise

| Kennung | Befund bis einschließlich 1.0.33 | Bearbeitung in 1.0.34 |
| --- | --- | --- |
| NW-AUTH-14 | Implizite beziehungsweise konfigurierte Benutzernamen konnten eine Rolle unabhängig von aktueller Gruppenmitgliedschaft vergeben. | Namensrollen entfernt; positive Tests für beliebige Kontonamen, negative Tests für reservierte Namen und ignorierte alte Benutzerlisten. |
| NW-AUTH-15 | Gruppen wurden ohne Bindung an exakte Objekt-ID, Typ und strikten Mitgliedervertrag ausgewertet. | Strikte Gruppenprüfung, begrenzte Konfiguration, Fehlerverweigerung und negative Tests. |

Die vorhandenen Befunde und Prüfnachweise NW-AUTH-11 bis -13 aus 1.0.33 bleiben erhalten. Sicherheits- und Betriebsdokumentation, Versionsmetadaten, Quellcodedokumentation, Paketbindung und SBOM wurden für diesen Stand aktualisiert. Anlagenregelung, Partner-/Arbitragefunktionen und produktive Abhängigkeiten werden in ihrem bestehenden Vertrag weitergeführt.

## Tatsächlich ausgeführte Prüfungen

Umgebung: Linux, Node.js v24.22.1, npm 11.9.0; TypeScript und Entwicklungswerkzeuge aus dem unveränderten Lockfile-Abhängigkeitsstand. HTTP-Prüfungen verwenden den tatsächlichen Express-Server des ausgelieferten Adapters mit synthetischen ioBroker-Objekten und individuellen zufälligen Testpasswörtern. Es wurde kein realer Benutzer auf der Kundenanlage angemeldet und kein Admin-8-Frontend live bedient. Vorhandene Browserregressionen verwenden lokalen Chromium 153.0.8010.0; der Browser gehört nicht zum Produktlieferumfang.

| Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| `npm run build:ts` | Exit 0; 14.86 s | `final-build.log` |
| `npm run docs:build` | Exit 0; 4.31 s | `final-docs.log` |
| `npm run docs:check` | Exit 0; 0.28 s | `final-docs-check.log` |
| `node scripts/verify-eslint-security.cjs --json` | Exit 0; 19.11 s | `final-lint.log` |
| `npm run release:generate-manifest` | Exit 0; 1.73 s | `final-seal.log` |
| `npm run test:all` | Exit 0; 236.63 s | `final-test-all.log` |
| `npm run publish:check` | Exit 0; 1.19 s | `final-publish-check.log` |
| `npm run test:package-runtime-start-smoke` | Exit 0; 1.18 s | `final-runtime-start.log` |
| `npm pack --dry-run --json --ignore-scripts` | Exit 0; 3.08 s | `final-pack-dry.log` |
| Striktes Gruppenmodul | 20 Prüfgruppen bestanden | `iobroker-user-roles.log`, finaler Gesamtlauf |
| Neue tatsächliche HTTP-Gruppenanmeldung | 29 Prüfgruppen bestanden | `http-groups.log`, finaler Gesamtlauf |
| Bestehende Konto-/Login-/CRA-Regression | 16 + 15 + 19 Prüfgruppen bestanden | finaler Gesamtlauf |
| Getrennter Review | 14 Prüfgruppen bestanden | `independent-group-review.json` |

Die 29 neuen HTTP-Prüfgruppen decken beliebige Benutzernamen, eigene Passwörter je Konto, Ablehnung fremder Konto- und Administratorpasswörter, Anzeigenamen und vollständige Konto-IDs, alle drei Rollen, eigene Anbietergruppen, Rollenpriorität, ignorierte Benutzerlisten, Gruppendefekte und laufenden Rollenentzug ab. Normale und strikte Anmelderouten sind geprüft; Kunden erhalten auf der strikten Einrichtungsroute keine Installateurrechte.

Die bestehenden Auth-Testfixtures wurden auf tatsächliche Gruppenobjekte und kanonische Mitgliedschaften umgestellt. Die Produktlogik wurde nicht durch Test-Ausnahmen abgeschwächt. Der vollständige vorhandene Regressionstest umfasst zusätzlich Rechte-, EMS-, Partner-, Browser-, Paket- und Sicherheitsprüfungen sowie die tatsächliche `prepublishOnly`-Kette gegen eine lokale Testregistry für frische und überkopierte Altstände. Dabei wird nichts extern veröffentlicht.

Ein getrennter KI-gestützter Review führte 14 zusätzliche Fälle aus und prüfte die Main-Anbindung. Fünf bestehende bewertete Main-Lintstellen mit sechs Zugriffen und ihre umgebenden Funktionen sind gegenüber 1.0.33 unverändert. Ihre bestehenden Fingerprints, Bewertungen und Anzahlen wurden beibehalten und an den geprüften neuen AST-Codehash gebunden. Der Review ist keine externe Sicherheitszertifizierung.

## Abhängigkeiten und offene Grenzen

Die aktuellen npm-Audits melden für die produktiven Abhängigkeiten und den Admin-Build jeweils **0 bekannte Befunde**. Der Root-Entwicklungsbaum enthält weiterhin **13 moderate Meldungen**, ausschließlich in Entwicklungspaketen; keine hohen/kritischen Meldungen. Diese offenen glob-/minimatch-Befunde bleiben separat zu bearbeiten. Der Lockfilevergleich zeigt ausschließlich die Produktversion 1.0.33 → 1.0.34; keine Abhängigkeit wurde geändert. Scannerergebnisse sind zeitgebunden und kein Nachweis vollständiger Schwachstellenfreiheit.

Security-ESLint: 176 Quellen, 3066 Hinweise; 2970 historische offene Hotspots, 96 individuell bewertete Vorkommen, **0 neue/verbotene ungeprüfte Stellen**. 90 alte Vorkommen fehlen im aktuellen Stand. Das neue Gruppenmodul ist im strikten Typprüfbereich enthalten und weist in seiner Einzelprüfung keine ESLint-Meldungen auf. Die Altbaseline wurde nicht erweitert. Diese Ergebnisse belegen keine vollständige ASVS-, IEC- oder CRA-Erfüllung.

Die konkrete Admin-/Controller-Installation, fremde Gruppenverträge, HTTPS-/Proxy- und Mehrinstanzverhalten sowie die reale Anlagenabnahme bleiben offen. Die bestehenden übrigen Freigabehindernisse werden weitergeführt. `release-manifests/release-status.json` bleibt `review`, `productionApproved: false`; die separate Produktionsfreigabe muss erwartungsgemäß sperren. Es wurden keine Produktivzugangsdaten geändert, keine Liveinstallation aktualisiert und kein Paket veröffentlicht.

## Anwendung und Rückfall

Nach Sicherung und Prüfung der Gruppenmitgliedschaften 1.0.34 einspielen, UI-Adapter neu starten und mit dem eigenen lokalen ioBroker-Passwort anmelden. Die vorgesehene Rolle, Ablehnung eines falschen beziehungsweise fremden Passworts, Trennung von Kunden-/Installateur-/Adminfunktionen und Entzug während einer Sitzung auf der Installation prüfen. Nach zu vielen Fehlversuchen die angezeigte Sperrfrist abwarten. Keine Passwörter oder Benutzerobjekte zur Diagnose weitergeben.

Für den Rückfall den vollständigen Stand 1.0.33 und die Konfigurationssicherung bereithalten. Ein Rückfall reaktiviert dessen dokumentierte Namensrollen und ist deshalb kein gleichwertiger Ersatz für die Sicherheitskorrektur.

Mitgelieferte Unterlagen: `docs/operations/BENUTZER_GRUPPENRECHTE_DE.md`, `docs/operations/ADMIN8_EMS_ANMELDUNG_DE.md`, `docs/security/auth-review-de.md`, `GRUPPENMODUL_PRUEFVERMERK_DE.md`, `UNABHAENGIGER_REVIEW_DE.md` sowie Rohlogs und JSON-Belege in diesem Berichtsverzeichnis. Paketbindung: `scripts/release-artifact-manifest.json`, `release-manifests/sbom-product.cdx.json`, `release-manifests/sbom-product-evidence.json`. Vollständige Quellarchivbindung: `release-manifests/repository-payload-sha256.json`.

Offizieller, im getrennten Review abgeglichener Gruppenvertrag: https://github.com/ioBroker/ioBroker.js-controller/blob/v7.2.5/packages/adapter/src/lib/adapter/adapter.ts (`checkGroup`, direkte Mitglieder-IDs; `calculatePermissions` enthält im Controller eine eigene Sonderbehandlung des eingebauten Admin-Kontos). Der EOS-Funktionsvertrag übernimmt diese Namensausnahme bewusst nicht.
