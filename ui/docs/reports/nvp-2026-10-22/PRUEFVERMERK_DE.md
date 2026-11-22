# 1.0.24 – Änderungs- und Prüfvermerk zum NVP-Diagnose-Teststand

Stand: 22.10.2026. Anforderung: `NW-UI-NVP-ZONEN-20261022`, Version 1.0.
Die [übergebene Spezifikation](../../requirements/NVP_MODUS_SPEZIFIKATION_2026_10_22.md)
ist im Repository unverändert mitgeführt.

**Liefergrenze:** Konfiguration, Bedienung und M0/M1-Diagnose sind umgesetzt.
Der beauftragte aktive dynamische NVP-Modus ist damit noch nicht vollständig
implementiert. `operation: active` bleibt serverseitig gesperrt; kein neuer
dynamischer Hardwarewriter ist vorhanden. Bestehende Speicher-/PV-Regelung
und deren Stellhoheit laufen auch bei dynamisch gespeicherter Diagnose weiter.
Dieser Stand ist ein Testpaket, keine Produktiv- oder Konformitätsfreigabe.

## Herkunft und Umgebung

- Basis: `NexoWatt_UI_1.0.23_HEIZSTAB_NACHT_PV_TEST_FULL_REPOSITORY.zip`,
  verfügbarer vollständiger Stand vom 08.10.2026. Die tatsächlich installierte
  Anlagenversion wurde nicht festgestellt.
- SHA-256 des Basisarchivs:
  `989ec3289ec7e4ab7d532522cc3b607b201b9fd1ff1b07e18d0b0452474e1dbe`.
- Neue Version: `iobroker.nexowatt-ui@1.0.24`.
- Prüfplattform: Linux, Node.js 24.19.0, npm 11.9.0, TypeScript 5.8.3.
- Browser für die lokale Prüfung: Chromium 153.0.8010.0 aus dem getrennt
  installierten Testwerkzeug `@sparticuz/chromium@153.0.0`; kein Bestandteil
  des Produktpakets und keine neue Projektabhängigkeit.
- Abhängigkeiten über vorhandene Lockfiles mit `npm ci` im Repository und
  `src-admin-tab` installiert. Keine neue Produktabhängigkeit hinzugefügt.
- Kanonische Änderungen unter `src-ts/runtime-executables/` und React unter
  `src-admin-tab/src/`; ausgelieferte Runtime mit bestehender Buildkette erzeugt.
  Typisierte Main-/Frontend-Spiegel wurden gezielt ergänzt und erhalten.
- Alle Befehle dieses Vermerks beziehen sich auf das Wurzelverzeichnis des
  vollständigen Repositorypakets. Die Logs liegen neben diesem Vermerk.

## Umgesetzte Änderungen

| Teil | Änderung und Nachweisgrenze |
| --- | --- |
| M0/M1-Schema | Eindeutige Messstellen, physische Anschlussbereiche, Regelmesspunkte, Gruppen, Zweck und Stellhoheit getrennt; null und echte Nullgrenzen unterschieden. |
| Messkontext | Endliche numerische Werte, Einheit/Vorzeichen, Qualität, Zeitstempel, Alter und Zeitversatz geprüft. Fehlende Werte werden nicht null Watt. |
| Budgets | Gemeinsame unabhängige Intervalle, Wirkungsmatrix und Reservierungen; alle Momentanbudgets ausdrücklich hypothetisch. |
| Gruppenplaner | Bereichsbezogene Rechenanforderungen, getrennte Zustände, kein externer Sollwert. Ohne bestätigte Live-Fähigkeit keine angeblich ausführbare Speicherzuteilung. |
| Freigabeautomat | Reiner, getesteter Zustandsautomat für Sitzung/Sequenz/Empfang/Anwendung/Ablauf. Keine Geräte- oder Runtime-Freigabeintegration behauptet. |
| Runtime | Isolierter nicht blockierender Diagnosesampler, höchstens ein offener State-Leseauftrag, eigene schreibgeschützte Diagnosestates. Statischer Bestand ohne zusätzliche NVP-Zugriffe oder generische NVP-Modultelemetrie. |
| API | Installer-/Adminschutz, begrenzte Aliasauflösung und Bindung an vorhandene Geräte, gemeinsame Versionsprüfung, unveränderte andere Konfigurationsfelder, keine öffentlichen NVP-Diagnosedaten. |
| Oberfläche | Installerseite `/ems/nvp/#/nvp-topology`, ausdrückliche Zuordnung und Diagnosevorschau, Versionskonflikte sichtbar, aktive Auswahl gesperrt. Ergänzende Speicherfarm-Diagnose nur mit Installerrechten. |

Die mathematischen Hilfsfunktionen für PV-Minimum und Hybrid-AC-Grenzen sind
keine aktive Zusammenführung der bestehenden PV-Writer. Die neue
`authority: external` ist eine Diagnosezuordnung und schaltet den bestehenden
Speicherwriter nicht ab. Diese Grenzen stehen in Oberfläche und Bedienungsdokument.

## Tatsächlich ausgeführte Prüfungen

Die Tabelle unterscheidet ausgeführte Softwareprüfungen von weiterhin
fehlenden Anlagen- und Gerätenachweisen.

| Befehl / Prüfung | Ergebnis | Rohbeleg |
| --- | --- | --- |
| `npm run admin:build` | Bestanden, Exit 0; gebündelte React-Oberfläche erzeugt. | `admin-build.log` |
| `npm run typecheck:nvp` | Bestanden, Exit 0; neue NVP-Bausteine strikt typgeprüft. | `nvp-typecheck.log` |
| `node --test test/nvp-domain.test.cjs test/nvp-group-planner.test.cjs test/nvp-runtime.test.cjs test/nvp-manager.test.cjs` | 46/46 bestanden, Exit 0. | `nvp-core-tests.log` |
| `node test/frontend-nvp-topology.cjs` | 8/8 bestanden, Exit 0; echter React-Renderer und Formhandler. | `frontend-nvp.log` |
| `npm run test:nvp-topology` einschließlich HTTP | 61/61 bestanden, Exit 0, keine übersprungenen Fälle. | `nvp-tests.log`, zusätzliche Backend-Auswertung `api-http.log` (15/15) |
| `npm run build:ts` | Bestanden, Exit 0; vollständig aus den Quellen gebaut. Abschließender Lauf nach Gesamtregression. | `build-ts.log` |
| `npm run test:all` | Bestanden, Exit 0; gesamte konfigurierte Prüfkette einschließlich vorhandener Browser-, Sicherheits-, Speicher-, PV-, Heizstab- und neuer NVP-Tests. | `test-all.log` |
| `npm run docs:build` / `npm run docs:check` | Bestanden, jeweils Exit 0; 241 Quelldateien dokumentiert. | `docs-build.log`, `docs-check.log` |
| `npm run release:prepare` / `npm run release:generate-manifest` | Bestanden, jeweils Exit 0; Produkt-SBOM erzeugt, 414 Paketdateien versiegelt. | `release-prepare.log`, `release-seal.log` |
| `npm run publish:check` | Bestanden, Exit 0; Artefakte, Dokumentation, SBOM und gebundene Quellen unverändert. | `publish-check.log` |
| `npm pack --dry-run --json --ignore-scripts` | Bestanden, Exit 0; 415 Einträge inklusive npm-Paketmetadaten. Keine Veröffentlichung. | `npm-pack-dry-run.json`, `npm-pack-dry-run.stderr.log` |
| `npm run test:publish-overlay` | Bestanden, Exit 0; echte `prepublishOnly`-Kette frisch und überlagert ohne Entwicklungsabhängigkeiten, lokaler 404-Testregistry, Secret-Negativtest blockiert. | `publish-overlay.log` |
| `npm run check:secrets` | Bestanden, Exit 0; keine Treffer in den unterstützten Regeln. Kein umfassendes unabhängiges Sicherheitsaudit. | `secrets.log` |
| `node test/browser-nvp-topology.cjs` mit lokalem Chromium/Playwright | Bestanden, Exit 0; 11 Szenarien an der tatsächlich gebauten React-Oberfläche mit lokaler Mock-API und realer Domain-Diagnose. Desktop/mobile Screenshots separat geprüft. | `browser-nvp.log`, PNG-Dateien in diesem Ordner |
| Reale ioBroker-Anlage, Geräte, Netz-/Kommunikationsausfall | **Nicht durchgeführt.** HTTP und Runtime arbeiten in Softwaretests mit Mocks. | Offen vor Inbetriebnahme. |

Die Rechentests enthalten die fünf vorgegebenen Korridorbeispiele, den
135/165-kW-Übergang und den 175/145-kW-Rücknahmefall sowie 250 deterministische
Mehrteilnehmerfälle mit unabhängiger Nachrechnung sämtlicher acht Ecken.
Eine bestandene Rechenprüfung belegt keine physische Entlastung und kein
lokal wirksames Geräteverhalten bei EOS-Ausfall.

Für den vollständigen Browser-Gesamtlauf waren `CHROMIUM_BIN` und
`NW_CHROMIUM_EXECUTABLE` auf die lokale Chromium-Datei sowie
`NW_PLAYWRIGHT_MODULE` auf das installierte Playwright-Modul gesetzt. Die
vorher fehlende Browserumgebung wurde bereitgestellt; kein Pflichtgate wurde
abgeschwächt oder aus `test:all` entfernt.

Die NVP-Browserprüfung deckt statisches Speichern, bewusste Geräte-/Bereichswahl,
Null/fehlende Grenzen, Pflichtfelder, optionale Messidentität, unveränderte
Stellhoheit, Diagnosevorschau, Aktivierungssperre, Versionskonflikt ohne
Schreibwiederholung sowie 390-Pixel-Darstellung und Kunden-Deep-Link-Sperre ab.
Die Selektoren des Browsertests wurden an die tatsächlichen Labelnamen mit
Hilfetext angepasst; dafür war keine Produktänderung erforderlich.

## In der Prüfung gefundene und korrigierte Probleme

- Dediziertes NVP-Speichern normalisierte zunächst andere Alt-Felder mit.
  Es ersetzt jetzt ausschließlich `nvpTopology`; der HTTP-Test vergleicht die
  übrige Konfiguration unverändert und prüft fehlgeschlagene Persistenz.
- Alter Diagnosestatus konnte nach erfolgreichem Speichern neben einer neuen
  Version erscheinen. Die API filtert Version, Modus und Betriebsphase und
  liefert bei Abweichung `pending` ohne alte Messungen oder neue Scheindatierung.
- Unzulässige hypothetische Budgets waren nur im Detail-JSON erkennbar.
  Fehlerstatus und sichtbare Fehlerliste nennen jetzt Messpunkt, Richtung und
  Überschreitung; veraltete Messungen bleiben getrennt Messfehler.
- Eine normale Modulregistrierung hätte im statischen Bestand zusätzliche
  generische Telemetrie geschrieben. Der Diagnosebeobachter ist nun getrennt
  von der Aktor-/Telemetrieliste; die Managerintegration ist regressionsgeprüft.
- Zusätzliche strikte Typprüfungen fanden undefinierte Indexzugriffe in
  Gruppenverteilung und API-Tupeln; diese wurden vor dem Schlusslauf korrigiert.
- Der bestehende isolierte ACL-Test benötigte im VM-Kontext den neu eingeführten
  tatsächlichen Import `assertNvpPersistence`. Dieser wurde ergänzt, ohne die
  Persistenzprüfung durch einen Stub zu ersetzen. Alle acht ACL-Fälle bestehen;
  siehe `credential-state.log`. Der davor fehlgeschlagene separate Teillauf
  bleibt als `historisch-teillauf-vor-acl-testkontext-fix.log` nachvollziehbar.
- Bestehende Simulation-, SmartHome- und Logic-Saves konnten einen älteren
  Gesamtpatch nach einem NVP-Save persistieren. Alle betroffenen Pfade und die
  Startmigration teilen nun die Sperre über den gesamten Mutationsablauf.
  Ein echter HTTP-Test hält den DB-Write nach der Validierung an und prüft
  konkurrierende Aufrufe in beiden Richtungen. Logic bewahrt außerdem den
  Gesamtpatch und entpackt den Normalisierungswrapper korrekt.

## Offene Umsetzung und Freigabe

Die Zuordnung aller T01–T33 einschließlich offener aktiver Teile steht im
[Prüfplan](../NVP_2026_10_22_PRUEFPLAN_DE.md). Maßgebliche offene Punkte sind
NVP-ACT-01 bis NVP-ACT-06: endgültige Bereichswriter, reale externe
Freigabe-/Ausfallverträge, gemeinsame PV-Ausgabe, Live-Fähigkeitsgrenzen,
Tarif-/Peak-Reserven und Anlagen-/Gerätenachweise. Sie bleiben im
[Befundregister](../../security/BEFUNDREGISTER_DE.md) offen.

Vor einer aktiven Implementierung müssen insbesondere die konkreten
TESVOLT-/FENECON-/KOSTAL-Profile und die wirksame Schreibhoheit geklärt werden.
Ein Profilname oder ein Empfangs-ACK ist kein Nachweis angewandter Grenzen.
Bestehende offene Sicherheits- und Heizstab-Feldprüfungen aus 1.0.23 werden
durch diesen NVP-Teststand nicht als erledigt markiert.

## Paket und Rückweg

Das vollständige ZIP enthält Quellen, gebaute Runtime, Dokumentation,
Tests, Rohlogs, CycloneDX-SBOM und unveränderlich geprüfte Paketmanifestdateien.
Produkt- und Quellenbindung: `release-manifests/sbom-product-evidence.json`
und `scripts/release-artifact-manifest.json`; zusätzliche Prüfsummen der
Quellen, Tests und Runtime in `QUELLSTAND_SHA256SUMS.txt`. Es wurde kein npm-Paket extern
veröffentlicht und keine reale Anlage verändert.

Vor Einspielen Konfiguration exportieren und bisheriges Paket aufbewahren.
Ohne neue Zuordnung bleibt Statisch. Für einen Rückweg die statische Auswahl
speichern und gegebenenfalls den gesicherten vollständigen 1.0.23-Stand
wiederherstellen. Der Rückweg ist dokumentiert, aber nicht auf Hardware
durchgeführt. Die Diagnose hat keine neuen dynamischen Gerätegrants erteilt.
