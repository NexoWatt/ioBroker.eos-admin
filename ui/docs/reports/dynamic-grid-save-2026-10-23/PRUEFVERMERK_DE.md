# Änderungs- und Prüfvermerk – App-Center-Speichern 1.0.27

Datum: 23.10.2026. Ausgangsstand: 1.0.26, Commit `0314b28`.

## Gemeldeter Fehler und Ursache

Auf dem eigenen Live-Gerät des Nutzers erscheint bei der Erstinstallation von
„Dynamischer Netzanschluss“ im EMS App-Center der Fehler
`DYNAMIC_GRID_VERSION_CONFLICT`. Die Einrichtung ist noch nicht geöffnet, weil
die Installation zuerst gespeichert werden muss.

Der globale App-Center-Save sendete weder `expectedDynamicGridConfigVersion`
noch einen ausdrücklich versionierten Dynamic-Grid-Vertrag. Der Backend-Schutz
gegen veraltete Schreibzugriffe wies die Änderung deshalb korrekt mit HTTP 409
ab. Zusätzlich lieferte die Lese-API ältere Konfigurationsobjekte ohne Versionsfeld
unverändert aus, obwohl der Schreibpfad intern Anfangsversion 1 verwendet.

Die bisherigen Navigations-Browsertests simulierten erfolgreiche Antworten des
Speicherendpunkts. Sie belegten nicht das Zusammenspiel des App-Center-Payloads
mit der wirklichen Backend-Versionsprüfung. Diese Prüflücke wird gezielt ergänzt.

## Umfang

App-Center-Payload, versionsgebundener Lesestand, verständliche Konfliktmeldung
und Abstimmung zwischen Elternseite und eingebetteter Einrichtung. Backend-CAS,
Rollenprüfung und kontrollierte Übergabe bleiben verbindlich. Keine Änderung
an Lizenzstrategie, Herstellerunabhängigkeit, M0-/M1-Regelberechnung oder
Geräteausgängen.

## Tatsächlicher Prüfstand

Die nachstehenden Prüfungen wurden lokal am Stand 1.0.27 ausgeführt. Umgebung:
Linux, Node.js 24.19.0, npm 11.9.0, TypeScript 5.8.3, Chromium 153.0.8010.0.
Die Rohprotokolle gehören zu diesem vollständigen Repository-Lieferstand.

| Prüfung | Ergebnis | Nachweis |
| --- | --- | --- |
| `npm run test:all` | Gesamtkette Exit 0; bestehende Typ-, EMS-, Lizenz-, Rollen-, Sicherheits- und Installationsregressionen sowie neue Versionsprüfungen bestanden | [test-all.log](test-all.log) |
| API-/HTTP-Regressionsprüfung | 20/20; tatsächliche erzeugte Runtime und zentrale Persistenz, erste Installation bei fehlendem/leeren/älteren Vertrag, getrennte Appänderungen, echte veraltete Tokens, Import und Rollen | [backend-http.log](backend-http.log) |
| Echter Browser-Speicherablauf | 6/6; ausgeliefertes App-Center und React mit echten Express-Routen und tatsächlichem Persistenzpfad; keine nachgebildeten API-Speicherantworten | [browser-real-save.log](browser-real-save.log) |
| Neue Frontend-Versionsprüfungen | 23/23; kanonische Quelle und typisierter Spiegel, Save/Import-Payload, fremde/ältere Nachrichten, Entwurfserhalt, Mutationseingabesperre und verspätete React-Poll-/Reloadantworten | [frontend-version.log](frontend-version.log) |
| Bestehende Frontendprüfungen | 9 Formular- und 4 Navigationsprüfungen bestanden | [frontend-dynamic-grid.log](frontend-dynamic-grid.log), [frontend-navigation.log](frontend-navigation.log) |
| Bestehende Browserprüfungen | 15 Formular- und 9 Navigationsszenarien sowie Home-App-Center-Regression bestanden; diese verwenden lokale API-Fixtures | [browser-form.log](browser-form.log), [browser-navigation.log](browser-navigation.log), [home-appcenter-regression.log](home-appcenter-regression.log) |
| Admin-Build | Erfolgreich; geprüfte Ausgabe `index-C2FHbrz4.js` | [admin-build.log](admin-build.log) |
| `npm run build:ts` | Erfolgreich; kanonische Runtime und 508 Laufzeitspiegel synchronisiert, Typbuild bestanden | [build-ts.log](build-ts.log), [runtime-sync.log](runtime-sync.log) |
| Dokumentation | Erzeugung und Konsistenzprüfung bestanden | [docs-build.log](docs-build.log), [docs-check.log](docs-check.log) |
| Release-Metadaten, SBOM und Paketbindung | Version 1.0.27 konsistent; Paket vorbereitet, SBOM und Manifest ausdrücklich erzeugt; Paketprüfung bestanden | [release-metadata.log](release-metadata.log), [release-prepare.log](release-prepare.log), [release-manifest.log](release-manifest.log), [publish-check.log](publish-check.log) |
| npm-Paketvorschau | `npm pack --dry-run --json --ignore-scripts` erfolgreich, ohne Upload | [pack-dry-run.json](pack-dry-run.json) |
| Zweiter technischer Review | Begrenzt auf die geänderten Speicher-/Versionspfade; eigener zusätzlicher 20/20-Lauf und Quell-/Belegprüfung | [SECOND_REVIEW_DE.md](SECOND_REVIEW_DE.md) |

Die sechs echten Browserszenarien belegen erste Installation Version 1→2,
unveränderten Wiederholungssave ohne Versionssprung, Kind-Save 2→3 mit
Entwurfserhalt im Parent, globalen M0-Save 3→4 mit Entwurfserhalt im Kind,
zwischenzeitlichen fremden Save 4→5 mit tatsächlichem HTTP 409 beim alten
Browserstand und Backup-Dateiimport mit Inhaltsversion 1, geladenem Token 5
und gespeichertem Stand 6. Ein erfolgreicher Speicheraufruf umfasst den
Neustartaufruf; der EMS-Neustart selbst bleibt im Test simuliert.

Der neue Frontendtest ist über `test:ems-navigation` dauerhaft in `test:all`
eingebunden. Der echte Browserablauf ist zusätzlich mit
`npm run test:dynamic-grid-save-browser` ausführbar und benötigt Chromium
(`CHROMIUM_BIN`) sowie Playwright (`NW_PLAYWRIGHT_MODULE`). Die Gesamtkette enthält
weiterhin die Prüfung frischer Pakete und des Überkopierens auf einen älteren
Repositorystand mit realer `prepublishOnly`-Kette gegen eine lokale Testregistry.

Im Browser-Rohlog bleiben zwei Zwischenfehler transparent erhalten: Der geplante
Vorfixlauf wurde bereits nach Synchronisierung der Korrektur ausgeführt und
lieferte deshalb 200 statt erwarteter 409; dies ist kein bestandener
Vorfix-Browsernachweis. Beim ersten vollständigen Lauf erwartete der Test das
falsche Backupfeld `patch`; nach Abgleich mit dem tatsächlichen Exportformat
`configPatch` bestand der vollständige Lauf. Die ursprüngliche fehlende
Versionsübergabe wird zusätzlich durch den HTTP-Negativfall nachgewiesen.
Die abschließenden Prüfungen verwenden den korrigierten, synchronisierten Stand.

## Grenzen

Die Reproduktion verwendet die tatsächlichen Softwarepfade mit simuliertem
ioBroker und Gerätedaten. Es besteht kein Zugriff auf das Live-Gerät des Nutzers;
eine dort erfolgreich abgeschlossene Speicherung wird nicht behauptet.
Kein externer npm-Upload und keine Fernänderung einer Feldanlage.

Die allgemeine, vorbestehende Race-Bedingung beim ausdrücklich ausgelösten
Neuladen und gleichzeitigem Bearbeiten anderer Einstellungen wurde bei der
Quellprüfung beobachtet und als DGS-OBS-01 im Zweitreview festgehalten. Sie ist
nicht als behoben oder als Browserfall reproduziert ausgewiesen. Die hier
geprüften Save-/Importaktionen sperren Eingaben während ihrer Anfrage; die
Versionsprüfung verhindert veraltete Änderungen des dynamischen Vertrags.

Die bekannten Freigabegrenzen aus `release-manifests/release-status.json`
bleiben bestehen, einschließlich realer Anlagenabnahme und NW-SECRET-01.
