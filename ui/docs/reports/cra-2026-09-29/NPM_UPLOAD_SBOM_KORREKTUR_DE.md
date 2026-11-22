# npm-Upload und automatische SBOM – Korrektur 1.0.22

Stand: 29.09.2026, dokumentierter Zwischenabschluss der Upload-/SBOM-Korrektur am noch nicht veröffentlichten Paketstand. Anschließend beauftragte HTTPS-/Credentialänderungen werden getrennt geprüft und sind nicht von den hier genannten Laufzeit-Gleichheitsnachweisen umfasst.
Änderungsbezug: NW-PROC-02 und Lieferkettennachweise. Kein Eingriff in die Adapter-/EMS-Laufzeit.

## Ursache und Korrektur

Der erste Sicherheits-Prüfstand hängte `release:approval` an `prepublishOnly`
und stellte dieselbe Prüfung vor `PUBLISH_NPM.cmd`. Dadurch scheiterte ein
technisch geprüftes npm-Testpaket zuletzt an `release-not-approved`. Dies
verwechselte den Paketupload mit der allgemeinen Herstellerfreigabe und
blockierte den vorgesehenen Eigentest auf einer Liveanlage.

Die normale npm-Kette prüft weiterhin verfügbare Version, Geheimnisse,
Altbundle-Vorbereitung, unveränderte Artefakte, Release-Metadaten, Syntax und
Paketstartpfade. Ausschließlich die zusätzliche Produktivfreigabe ist getrennt:
`npm run release:production-check` prüft zuerst die dokumentierte Entscheidung
und führt anschließend `release:check` aus. `release-status.json` bleibt
unverändert bei `review` und `productionApproved: false`.

`PUBLISH_NPM.cmd` verwendet `call npm publish --tag latest`, damit Windows nach
dem npm-Aufruf die Fehlerbehandlung ausführt. Für den fertigen unveränderten
Repositorystand reicht wie bisher `npm publish`; kein Neuversiegeln ist nötig.
Die Version bleibt 1.0.22, da der gemeldete Lifecycle-Fehler vor dem Upload lag.
Eine tatsächlich bereits auf npm veröffentlichte Version wird weiterhin blockiert.

## Automatische SBOM

`npm run release:generate-manifest` ruft vor der bewussten Versiegelung automatisch
`npm run sbom:cra:release` auf. Der Generator arbeitet offline, führt keine
Installationsskripte aus und verändert keine Produktquellen oder Adminbundles.

Das npm-Paket enthält die CycloneDX-Datei `release-manifests/sbom-product.cdx.json`,
ihren Dateibeleg `sbom-product-evidence.json` und den tatsächlichen archivierten
Rollup-Buildnachweis `admin-bundle-components.json`. Root-Laufzeitabhängigkeiten
aus dem Release-Lockfile und nachweislich zum Admin-JavaScript beitragende
Bibliotheken bleiben als unterschiedliche Inventararten erkennbar.

Vor jedem normalen npm-Upload ruft `publish:check` den rein lesenden SBOM-Verifier
automatisch auf. Er prüft Paketidentität, SBOM-/Dateihashes, Komponentenverweise
und im vollständigen Repository auch Quell-/Lockfile-/Admin-Buildbezüge. Fehlende,
veraltete oder veränderte Belege führen zu einem Fehler. Die Publish-Kette
regeneriert weder SBOM noch Artefaktmanifest und kann Änderungen daher nicht
selbst als geprüft neu versiegeln.

Für gezielte Einzelprüfung: `npm run sbom:check`. Zusätzliche Inventare des
wirklich installierten Buildbaums: `npm run sbom:cra -- --require-installed`.
Vor einer neuen Versiegelung zuerst fachlich prüfen und bei Produktänderungen
die vorgesehenen Builds ausführen; danach SBOM/Manifest erzeugen und sämtliche
Releaseprüfungen bestehen lassen.

## Tatsächliche Nachprüfung

Linux x64, Node.js 24.19.0, npm 11.9.0; Chromium wie beim ursprünglichen
Prüfstand. Rohdateien tragen das Präfix `followup-`; ältere Logs bleiben unverändert.

| Prüfung | Tatsächliches Ergebnis und Rohbeleg |
| --- | --- |
| Vollständige Regression | `npm run test:all`: Exit 0, 29.09.2026 20:57:14–20:59:48 UTC, 153,2 Sekunden; `followup-test-all.log` (80.384 Bytes). |
| TypeScript-Build und Spiegel | `npm run build:ts`: Exit 0; `followup-build-ts.log`. |
| Automatische SBOM-Erzeugung | Vollständiger installierter Prüfumgebungsbaum und anschließend automatischer Release-Hook: Exit 0; `followup-sbom-full.log`, `followup-release-seal.log`. |
| SBOM-Regression | 17 positive/negative Prüfgruppen, einschließlich fehlender/manipulierter Inventare, Paket-/Quellbindung und Offlinebetrieb ohne Entwicklungsabhängigkeiten; im Gesamtprüflog und `sbom-automation-regressions.log`. |
| Vollständige npm-Prüfkette | Bestandteil von `test:all`: frische Repository-Kopie und Overlay ohne `node_modules` erfolgreich, echter Geheimnis-Testfund blockiert. Ausschließlich lokale Testregistry; kein Upload. |
| Tatsächliches npm-Paket | Lokal gepackt, entpackt und geprüft: 402 Dateien, Produkt-SBOM mit 60 Komponenten, 400 hashgebundene Paketdateien, Paketstart-Smoke mit 232 JS/MJS-Dateien; `followup-packed-sbom.log`. |
| Getrennte Produktivfreigabe | `release:approval`: erwarteter Exit 1, Status bleibt unentschieden; `followup-production-approval.log`. |
| Unveränderte Produktlaufzeit | 398 Runtime-/Admin-/Quell-Dateien und beide Lockfiles bytegleich zur zuvor gelieferten 1.0.22-ZIP; `followup-runtime-unchanged.json`. |

`final-validation-index.json` führt die abschließenden Gate-Ergebnisse und
Loghashes zusammen. Der frühere Index wurde als `initial-review-validation-index.json`
erhalten. Audits vom ursprünglichen Sicherheitsreview gelten weiterhin für dieselben
unveränderten Lockfiles; sie wurden für diese reine Releasewerkzeugkorrektur nicht
als neue Abfragen ausgegeben.

## Geheimnisse und lokale Serverdateien

Geheimnissuche bleibt vor dem Upload verpflichtend und kann nicht durch die
Trennung der Produktivfreigabe übersprungen werden. Sie sperrt unter anderem
lokale Umgebungs-/npm-Konfiguration, Installationsdaten, SMTP-Zugangsdaten,
private Schlüssel und bekannte Tokenformate. Der echte Test mit zufällig erzeugtem
Geheimnis bestätigt auch, dass der Wert nicht in der Fehlermeldung erscheint.
Zusätzlich wird der Inhalt des tatsächlich entpackten npm-Pakets geprüft.

Die reine Upload-/SBOM-Korrektur benötigte keine neuen Zugangsdaten und keine
zusätzliche geheime Serverdatei. Die anschließend vertiefte Prüfung fand jedoch
einen eingebauten Lizenz-HMAC-Schlüssel; der endgültige Lieferstand erfordert
dessen gesonderte private Serverkonfiguration, siehe
[Lizenz-Auslagerung](LIZENZ_SECRET_AUSLAGERUNG_DE.md). Bestehende Zugänge gehören weiterhin zur lokalen ioBroker-/Server-
Konfiguration und nicht in den Quell- oder npm-Lieferstand. Sollten spätere
Installationsschritte private Daten benötigen, sind diese separat außerhalb des
Veröffentlichungsbaums zu provisionieren. Keine fremden Schlüssel werden erzeugt
oder als Beispiel in das Paket aufgenommen. Die Musterprüfung ist kein Beweis,
dass beliebige unbekannte oder verschlüsselte Geheimnisformate erkannt werden.

## Grenzen und Restarbeit

Eine SBOM ist ein nachvollziehbares Komponentenverzeichnis und eine Grundlage
für spätere Schwachstellenzuordnung. Sie beseitigt allein keine Schwachstellen.
Die Root-Komponenten beschreiben den Release-Referenzbaum: npm-Semverbereiche
können auf der eigenen Anlage andere transitive Versionen auflösen. Das Inventar
des dort tatsächlich installierten ioBroker-Hosts einschließlich OS, Controller,
Drittadaptern und Firmware muss vor einer allgemeinen Produktfreigabe ergänzt werden.

Diese Änderung installiert nichts auf einer Anlage und veröffentlicht kein Paket.
Hardware-, Windows-Ausführung und Restore auf dem konkreten Live-System wurden
hier nicht durchgeführt. Die plattformneutralen Skripte und Windows-Batchdatei
werden durch Codeprüfung sowie lokale Tests mit Leerzeichen/Unicode-Pfaden geprüft.
Offene Hersteller-/Gerätenachweise bleiben in `release-status.json` erhalten.
