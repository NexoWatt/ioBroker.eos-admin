# Änderungs- und Prüfvermerk – Einheitliche EMS-App-Bedienung 1.0.28

Datum: 23.10.2026. Ausgangsstand 1.0.27, Commit `c70ce72`.

## Nutzerbefund und Umfang

Die eingebettete Einrichtung „Dynamischer Netzanschluss“ verwendete einen
zusätzlichen React-Seitenrahmen mit eigener maximaler Breite, Überschrift und
fester innerer Scrollfläche. Dadurch blieb ein erheblicher Teil der unteren
EMS-App-Kachel ungenutzt. Die Zuordnungsfelder boten nur direkte ID-Eingabe und
keine Auswahlbuttons wie die anderen EMS-Apps.

Vergleichsgrundlage sind die bestehenden App-Center-Formulare, insbesondere
Speicherzuordnung, Nulleinspeisung und der gemeinsame Datenpunkt-Dialog. Der
Patch betrifft die Darstellung und Zuordnung im Entwurf. Er verändert keine
Regelberechnung, Lizenzstrategie oder Geräte-Schreibverträge.

## Umsetzung

Die App nutzt unter **EMS Apps** die vollständige untere Kachel. Die äußere,
gemeinsam genutzte App-Center-Hülle bleibt erhalten. Nur der zweite Seitenkopf,
die innere Maximalbreite und die feste innere Scrollbox entfallen. Die
eingebettete Oberfläche lädt das vorhandene EMS-Stylesheet und verwendet dessen
Formular-, Karten- und Buttonklassen. Die Rahmenhöhe folgt dem tatsächlichen
Inhalt; Größe und Nachrichten werden ausschließlich vom aktuellen iframe mit
demselben Ursprung angenommen.

**DP wählen** öffnet für M1, Speicher und PV denselben Datenpunkt-Dialog wie
die bestehenden Apps. Objektbaum, Suche und direkte ID-Eingabe bleiben
herstellerunabhängig. Die Auswahl ändert ausschließlich den Entwurf. Erst
Speichern übernimmt ihn; M0 bleibt eine schreibgeschützte Anzeige aus Allgemein.
Die eigenständige Adapteransicht öffnet den gemeinsamen Dialog als Popup.

Auswahlaufträge sind an Fenster, Ursprung, Request-ID und Formularrevision
gebunden. Schließen, geänderte Zeilen, veraltete Konfigurationen sowie laufende
Speicher- oder Importvorgänge verhindern die Übernahme verspäteter Antworten.
Der Speicherfix aus 1.0.27 und die historische Lizenzstrategie bleiben erhalten.

## Tatsächlicher Prüfstand

Prüfumgebung: Linux, Node.js 24.19.0, npm 11.9.0, TypeScript 5.8.3,
Chromium 153.0.8010.0. Alle nachfolgenden Abschlussprüfungen sind bestanden.

| Prüfung | Ergebnis und Rohbeleg |
| --- | --- |
| React-Build | Vite-Build erfolgreich; [admin-build.log](admin-build.log) |
| Runtime und TypeScript | Kanonische Quellen synchronisiert, 508 Spiegel geprüft und Typ-Build erfolgreich; [runtime-sync.log](runtime-sync.log), [build-ts.log](build-ts.log) |
| Formular, Navigation und Versionen | 10 Formular-, 6 Navigations- und 25 Versions-/Abbruchchecks; [frontend-form.log](frontend-form.log), [frontend-navigation.log](frontend-navigation.log), [frontend-version.log](frontend-version.log) |
| DP-Bridge und Client | 6 Tests zu Ursprung, Fenster, Request, alten Antworten, bestehenden Feldern, Abbruch und Popup-Lebenszyklus; [picker-bridge.log](picker-bridge.log) |
| Tatsächliche Browser-/API-Bedienung | 12 Abläufe gegen ausgelieferte Oberfläche, echte Express-Discovery und Installer-Persistenz; [browser-real-ui.log](browser-real-ui.log) |
| Tatsächliches Speichern | 6 Abläufe zu Installation, wiederholtem Save, Child-/Parent-Versionen, Konflikt und Backupimport; [browser-real-save.log](browser-real-save.log) |
| Bestehende Browserregressionen | 15 Formular- und 9 Navigationsszenarien; [browser-form.log](browser-form.log), [browser-navigation.log](browser-navigation.log) |
| Backend und HTTP | 20 Prüfungen; [backend-http.log](backend-http.log) |
| Rollen und Sicherheitsregressionen | Router 44 Checks, gesamte CRA-Testsammlung erfolgreich; [cra-admin-router.log](cra-admin-router.log), [cra-suite.log](cra-suite.log) |
| Home-App-Center | Bestehende Home-Lizenz und authentifizierter Zugriff bleiben funktionsfähig; [home-appcenter-regression.log](home-appcenter-regression.log) |
| Gesamter Regressionstest | `npm run test:all` vollständig mit Exit 0, einschließlich Erstinstallation, Update-Overlay, lokaler Publish-Kette, Lizenzen, EMS-Regelungen und neuer Picker-Tests; [test-all.log](test-all.log) |
| Dokumentation | 250 Quellbeschreibungen aktuell; [docs-build.log](docs-build.log), [docs-check.log](docs-check.log) |
| Release und Paket | Metadaten konsistent, Produkt-SBOM und 433 Manifestdateien geprüft; npm-Dry-Run mit 434 Paketdateien. [release-metadata.log](release-metadata.log), [release-prepare.log](release-prepare.log), [release-manifest.log](release-manifest.log), [publish-check.log](publish-check.log), [pack-dry-run.json](pack-dry-run.json) |

Die tatsächliche Browserprüfung misst bei Fensterbreiten 1440/1920/390 Pixel
eine verfügbare Formularbreite von rund 1321/1404/330 Pixel. Slot, iframe und
Formular nutzen dieselbe Breite. In den geprüften Zuständen gibt es weder
horizontalen Formularüberlauf noch eine zusätzliche innere Scrollfläche, auch
beim erweiterten Mobilformular. Desktop- und Mobilbilder wurden visuell geprüft.
Interne Screenshots bleiben außerhalb des neuen Quellpakets.

Die Browserprüfung wählt M1 über den Objektbaum sowie Speicherleistung, SoC,
Schreibziel, Rücklesung, Verfügbarkeit, Arbitrage und PV über die echte Suche.
Sie prüft den bisherigen Speicher-App-Picker, leere Suche, Abbruch und eine
absichtlich verspätete echte DB-Antwort. Die Auswahl erzeugt keinen POST; der
anschließende explizite Save persistiert die IDs mit dem ursprünglichen
Versions-Token als inaktiven Entwurf. Ein echter konkurrierender Save bricht
den offenen Picker ab und sperrt weitere Auswahl/Speicherung, ohne den lokalen
Entwurf zu verwerfen. Kunden erhalten weiterhin HTTP 403.

Ein separater KI-Arbeitsstrang hat Quellen, eigene 47 Checks, Browserbelege und
Bilder geprüft: [Zweitreview](SECOND_REVIEW_DE.md). Er meldet im geprüften Umfang
keine offenen blockierenden Befunde; dies ist keine externe Zertifizierung.

## Während der Prüfung korrigierte Punkte

Die gemeinsame Topbar-Gestaltung erzeugte zunächst auch im iframe einen
leeren oberen Abstand. Die auf die Einbettung beschränkten Regeln setzen
diesen Abstand zurück. Im Bridge-Review wurden die Initialisierung nach
Rollenfreigabe sowie die Sperre und Bereinigung alter Auswahlaufträge präzisiert.

Der erste Gesamtlauf stoppte, weil der bestehende Router-Testloader die neue
Layout-Komponente noch nicht kannte. Der Loader lädt jetzt die echte Komponente;
die Rollenprüfungen wurden um eingebettete Fälle ergänzt. Der gezielte
Routertest, die CRA-Testsammlung und der anschließend wiederholte Gesamtlauf
bestanden. Der erste Lauf bleibt als Nachweis erhalten:
[test-all-initial-loader-failure.log](test-all-initial-loader-failure.log).

Frühere FAIL-Einträge im neuen Browserlog betreffen Testselektoren, einen am
Baumwurzelpunkt bereits deaktivierten Startknopf, eine unvollständige PV-Fixture
ohne Anschlussbereich und die Erwartung eines React-Gates statt der echten
serverseitigen 403-Seite. Diese Testannahmen wurden korrigiert; fachliche
Validierung und Zugriffsprüfung wurden nicht abgeschwächt. Maßgeblich ist der
abschließende PASS-Lauf mit allen 12 Abläufen.

## Update

Vorherige Konfiguration und Quellversion sichern. Nach Einspielen von 1.0.28 die
EMS-Apps-Seite vollständig neu laden. M0 bleibt unter Allgemein; M1, Speicher
und PV werden in der App eingerichtet. Die Datenpunktauswahl speichert nicht
automatisch. Anleitung: [Einrichtung und Betrieb](../../DYNAMISCHER_NETZANSCHLUSS_DE.md).

## Grenzen

Die Prüfungen verwenden lokale Browser, tatsächliche Produktquellen und
simulierte ioBroker-Objekte. Es gibt keinen Zugriff auf die Hausanlage des
Nutzers und keine behauptete Hardwareabnahme. Es erfolgt kein externer
npm-Upload oder automatisches Update eines Live-Geräts. Die bestehenden
Freigabegrenzen aus `release-manifests/release-status.json` bleiben erhalten.
