# Änderungs- und Prüfvermerk – Bestandslizenzen / EMS Apps 1.0.26

Datum: 23.10.2026. Ausgangsstand: 1.0.25, Commit `91054e1`.
Historische Vergleichsquelle: vollständiges Repository 1.0.21.

## Nutzerauftrag und Umsetzung

Die bestehenden Feldtestanlagen sollen ihre bereits erteilten Lizenzen ohne
zusätzliche Dienstmigration weiterverwenden. Die neue dynamische Regelung gehört
ausschließlich unter EMS Apps. Die spätere Lizenzarchitektur wird der eigenen
EOS-Software vorbehalten.

Betroffen sind Lizenz-Verifikation und ihre Runtime-Spiegel, der eng begrenzte
Legacy-Ausnahmefall der Geheimnissuche, App-Center-Navigation, Installerstartseite
und Speicherfarm-Verknüpfung. Die vorhandenen UUID-, Editions-, Laufzeit-, Rollen-
und Geräteprüfungen dürfen dadurch nicht umgangen werden.

## Tatsächliche Prüfungen

Abschließender Gesamtlauf am 23.10.2026 erfolgreich, Exit 0. Umgebung: Linux,
Node.js 24.19.0, npm 11.9.0, TypeScript 5.8.3 und Chromium 153.0.8010.0.
Die folgenden Ergebnisse wurden tatsächlich ermittelt:

| Prüfung | Ergebnis | Nachweis |
| --- | --- | --- |
| `npm run test:all` | Vollständige Prüfkette bestanden, einschließlich bestehender Typ-, EMS-, Rollen-, Lizenz-, Sicherheits- und Installationsregressionen | [test-all.log](test-all.log) |
| Historische Lizenzkompatibilität | Alle sechs Formate, fehlende und neun fehlerhafte ENV-Fälle, zusätzliche private Signaturen, UUID-/Signaturfehler und Trial-Fortsetzung/Ablauf/Rückdatierung geprüft | [license-runtime.log](license-runtime.log), [license-compatibility-mirror.log](license-compatibility-mirror.log) |
| Vergleich gegen Original 1.0.21 | 16 zufällige UUIDs × sechs Formate: identische Signaturen; tatsächliche Prüfung des ausgelieferten `main.js` sowie kanonischer Quelle und manuell typisiertem Spiegel | dieselben Lizenzprotokolle |
| Zusätzlicher technischer Review | 44 Manipulationsproben und 18 Proben der engen Scanner-Ausnahme bestanden, zwei reproduzierbare Tests | [SECOND_REVIEW_DE.md](SECOND_REVIEW_DE.md), `test/license-compatibility-negative.test.cjs`, Gesamtlauf |
| Frontend | Vier neue Navigations- und neun bestehende Formularprüfungen bestanden | [frontend-ems-navigation.log](frontend-ems-navigation.log), [frontend-dynamic-grid.log](frontend-dynamic-grid.log) |
| Chromium-Navigation und Formular | Neun Navigationsszenarien und 15 bestehende Formularszenarien bestanden; Desktop und Mobilansicht geprüft | [browser-ems-navigation.log](browser-ems-navigation.log), [browser-dynamic-grid-form.log](browser-dynamic-grid-form.log) |
| Speicherfarm-Menü | Bestehende Kundenansicht und App-Grenze erhalten | [storagefarm-menu.log](storagefarm-menu.log) |
| `npm run admin:build` | Erfolgreich, Browserprüfung mit aktuellem Bundle `index-IO0DGu6L.js` | [Nachweisvermerk](admin-build.log); ursprüngliche Ausgabe nur im Werkzeuglauf, kein nachträglich behaupteter Rohlog |
| `npm run build:ts` | Runtime, 508 Runtime-Spiegel und Typbuild erfolgreich synchronisiert/gebaut | [build-ts.log](build-ts.log) |
| Dokumentation | Quellenverknüpfungen erzeugt, Konsistenzprüfung bestanden | [docs-build.log](docs-build.log), [docs-check.log](docs-check.log) |
| Release-Metadaten und Secret-Guard | Konsistente Version 1.0.26; allgemeine Geheimnisregeln und genaue Legacy-Ausnahme positiv/negativ geprüft | [release-metadata.log](release-metadata.log), [secret-guard.log](secret-guard.log) |
| Paketprüfung | `npm pack --dry-run --json --ignore-scripts` erfolgreich; 430 Paketdateien, kein Upload | [pack-dry-run.json](pack-dry-run.json) |
| Vorbereitung, SBOM und Artefaktbindung | Release vorbereitet, SBOM/Hashes explizit erzeugt und finale Paketprüfung bestanden | [release-prepare.log](release-prepare.log), [release-manifest.log](release-manifest.log), [publish-check.log](publish-check.log) |

Die Gesamtprüfung enthält weiterhin 72 NVP- und 117 Dynamic-Grid-Tests. Die
tatsächliche `prepublishOnly`-Kette bestand sowohl in einer frischen Kopie ohne
Entwicklungsabhängigkeiten als auch beim Überkopieren auf einen älteren Stand.
Dabei wurden eine lokale Registry-Antwort und simulierte ioBroker-/Gerätezugriffe
verwendet. Es erfolgte keine externe Veröffentlichung.

Vor dem abschließenden Lauf wurden die Versionskennzeichnung in den Release-
Unterlagen und die Dateiliste des neu gebauten Admin-Bundles abgeglichen.
Scanner-Fundstellen in neu konstruierten Test-Fixtures wurden durch reine
Laufzeit-Fixtures beseitigt; die allgemeinen Regeln wurden dafür nicht gelockert.
Der Review durch einen zweiten KI-Agenten ist kein externes Audit und keine
unabhängige Zertifizierung.

## Bekannte Grenzen und Rückfall

NW-SECRET-01 bleibt offen: Der bereits ausgelieferte symmetrische Altvertrag ist
kein vertrauliches Lizenzgeheimnis. Seine fortgesetzte Verwendung folgt dem
ausdrücklichen Kompatibilitätsauftrag. Neue Geheimnisse und andere HMAC-Literale
bleiben durch die allgemeinen Regeln gesperrt. Die Ausnahme ist auf historischen
Hash, Methode, Variable und drei Main-Pfade begrenzt; sie ist kein allgemeiner
Scanner-Ausschluss.

Es gab keine Installation auf einer Feldanlage, keinen externen npm-Upload und
keine Hardwareabnahme. Vor Update sichern; für einen Rückfall einen zur vorhandenen
Lizenz passenden Stand verwenden. 1.0.25 benötigt für die historische Lizenz noch
die damalige zusätzliche Dienstkonfiguration. Eine neue Trial-Aktivierung oder
ein Löschen des ursprünglichen Trialbeginns ist keine Rückfallmaßnahme.
