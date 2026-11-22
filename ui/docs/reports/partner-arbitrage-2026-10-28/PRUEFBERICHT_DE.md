<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# NexoWatt EOS 1.0.32 – Umsetzung und Prüfbericht

Stand: 28.10.2026. Lieferart: vollständiger Quell- und Laufzeitstand zur technischen Prüfung. **Keine Produktivfreigabe, keine Veröffentlichung und keine Änderung an einer Kundenanlage.**

## Verbindliche Ausgangsbasis

Die Umsetzung baut auf dem gelieferten vollständigen Archiv `NexoWatt_UI_1.0.31_SICHERHEIT_TEST_FULL_REPOSITORY.zip` auf. Dessen SHA-256 ist `07c0be3508a13161b2e9355b7126e840ab421a11cb9808666e01e829da1e271e`. Es wurde kein älterer GitHub-Stand als Basis eingesetzt. Die neue Paket-, Adapter- und Releaseversion lautet **1.0.32**. Die bestehende NW1-Kompatibilitätsentscheidung und die offenen Befunde des Ausgangsstands bleiben ausdrücklich erhalten.

Der Lieferstand enthält kanonische TypeScript-Quellen, daraus erzeugte Runtime-/Frontendspiegel, gebaute React-Dateien, Lockfiles, Tests und Dokumentation. Der finale Vollarchivnachweis ist `release-manifests/repository-payload-sha256.json`; die npm-Laufzeitartefakte besitzen zusätzlich die vorhandene Releaseversiegelung und SBOM. Teilberichte mit früher aufgenommenen Quellenhashes belegen ihre jeweiligen Reviewzeitpunkte und ersetzen diesen finalen Vollarchivnachweis nicht. Historische Dateien wie `input-source.json` und der SBOM-Index vom 29.09.2026 bleiben als Bestandsunterlagen erhalten; sie sind weder der Herkunftsnachweis dieser Umsetzung noch deren aktueller Produkt-SBOM-Nachweis.

## Umgesetzter Funktionsumfang

| Bereich | Verhalten in 1.0.32 |
| --- | --- |
| Arbitrage-App | Eigene App im EMS-AppCenter mit Haushaltsprofil und reinem Speicherhandel. Keine Abhängigkeit von PV, Wallbox, Bilanz oder dynamischem Netzanschluss. Die vorhandene lokale Speicherregelung muss eingerichtet und aktiv sein. |
| Speichersteuerung | Kurzlebige Partneranforderungen für den generischen Einzelspeicher `single`; optional vorhandene dynamische EOS-Arbitragegruppen. Leistungs-, SoC-, Netz-, Geräte-, Lizenz- und Inbetriebnahmegrenzen bleiben vorgeschaltet. |
| Bilanz | Eigene Freigabeansicht; begrenzte Projektion des letzten vollständigen Bilanzintervalls. Ausschließlich Leserechte, keine Speichersteuerung. |
| Direktvermarktung | Freigabeansicht in der vorhandenen PV-/EVU-App; aktuelle Daten und Fähigkeiten. Aktive PV-Abregelung wird noch ausdrücklich abgewiesen. |
| Partnerverbindung | Ausschließlich ausgehendes WSS mit gemeinsamem Partnerprofil und getrennten Rechten je App/Ressource. Kein zusätzlicher eingehender Internetport. |
| Einrichtung | Geschützte Installer-/Admin-API, Vorschau, Versionskonflikterkennung, Widerruf und nachvollziehbare Statusanzeige. Verbindung, Rechte und Steuerfreigaben beginnen ausgeschaltet. |

Version 1 ist ein generischer EOS-Protokollvertrag, noch kein Adapter für einen bestimmten Händler. Mehrere gleichzeitige Partner, Fahrpläne und aktive Direktvermarktungsabregelung sind nicht implementiert. Legacy-Speicherfarm sowie die herstellerspezifischen Standalone-Pfade FENECON, Sungrow und E3DC bleiben für Partnersteuerung gesperrt. Der Partnerlaufzeitpfad wird unter Windows bis zum passenden ACL-Nachweis gesperrt.

## Sicherheitsgrenzen der Umsetzung

Die Partnerseite darf ausschließlich benannte Fachoperationen mit ausdrücklich freigegebenen Ressourcen anfordern. Es gibt keine fremden ioBroker-Datenpunktnamen, Skripte oder unmittelbaren Geräteschreibzugriffe. Nur der vorhandene zentrale Writer wirkt auf die Geräte. Er prüft die Partnerberechtigung erneut unmittelbar vor dem tatsächlichen Schreibaufruf, auch nach asynchronen Zwischenschritten. Bereits physisch übergebene Befehle lassen sich durch einen späteren Softwarewiderruf nicht rückwirkend zurücknehmen.

TLS-Zertifikats-/Hostprüfung, DNS-Pinning, Zieladressbeschränkung, Verbot von Redirects, begrenzte Frames/Nachrichten/Raten, ausgeschaltete Kompression, Heartbeats und Wiederverbindungsgrenzen schützen den Transport. Zugangsdaten werden über geschützte benannte Umgebungsreferenzen bereitgestellt; sie stehen nicht in den Browserformularen oder der exportierten Partnerkonfiguration.

Anforderungen werden vor Annahme in einem begrenzten Journal festgehalten. Kennung, Inhalt, Reihenfolge, Konfigurationsrevision, Verbindungsgeneration und monotone Laufzeit begrenzen Wiederholungen und alte Aufträge. Wiederverbindung und Neustart aktivieren keine alten Wünsche. Eine persistente Widerrufsschranke sperrt die alte Revision auch bei anschließend fehlgeschlagenem Konfigurationscommit. Falls das Schreiben dieser Schranke selbst fehlschlägt, bleibt die laufende Instanz gesperrt und meldet den Fehler; eine nicht gespeicherte Sperre kann für einen späteren Neustart nicht zugesichert werden.

Dateien werden mit begrenzten Rechten, Symlink-Abwehr und atomarer, synchronisierter Persistenz verarbeitet. Diese Maßnahmen schützen nicht gegen vollständige Kompromittierung desselben OS-Benutzers oder manipulierten Restore durch einen privilegierten Angreifer. Hostschutz und Wiederherstellungsverfahren bleiben Teil der Anlagenverantwortung.

`accepted` beziehungsweise eine identische Wiederholungsquittung bestätigt die journalierte Annahme, **keine Gerätewirkung**. Eine Wiederholungsantwort aktiviert keinen abgelaufenen Auftrag; den aktuellen Wunsch zeigt `dispatch.status`. Gerätequittierung wird ausdrücklich als `deviceAcknowledged: false` ausgewiesen. Bei Ablauf oder Verbindungsverlust greift die vorhandene lokale Rückfallregelung; im reinen Handelsprofil wird neutral geplant. Reaktionszeit und tatsächlicher Gerätezustand sind an der realen Anlage zu messen.

Die UI erhält Entwürfe bei CAS-Konflikten und sperrt unklare Wiederholungen bis zum Neuladen. Generische Konfigurationsimporte dürfen keine abweichenden Partnerfreigaben einschleusen. Eingebettete Formulare prüfen Origin und konkretes Fenster. Die neuen geschützten Seiten sind vom PWA-Offlinecache ausgenommen; Cacheversion v522 lädt die aktualisierten AppCenter-Dateien.

## Tatsächlich ausgeführte Prüfungen

Prüfumgebung: Linux-Container, Node.js v24.22.1, npm 11.9.0, TypeScript aus den Lockfiles. Chromium 153 wurde ausschließlich als externes Prüfwerkzeug verwendet; es ist keine neue Produktabhängigkeit. Die Browseroberfläche wurde auf 1440 × 1000 und 390 × 844 geprüft. Screenshots wurden lokal visuell beurteilt; der Lieferumfang enthält Ergebnisse und Hashbezüge, nicht die Browserbilder.

| Befehl | Ergebnis | Rohbeleg |
| --- | --- | --- |
| `npm run build:ts`, `npm run docs:build`, `npm run docs:check`, `npm run release:generate-manifest` | Jeweils Exit 0; TypeScript-/Dokumentationsbuild und explizite Versiegelung | `build-ts-final.log`, `docs-build.log`, `docs-check.log`, `release-seal.log`; aktuelle Artefakte zusätzlich im finalen Gate geprüft |
| `npm run test:all` | Exit 0; 386.89 s | `verified-final-test-all.log` |
| `npm run publish:check` | Exit 0; 2.01 s | `verified-final-publish-check.log` |
| `npm run test:package-runtime-start-smoke` | Exit 0; 3.92 s | `verified-final-runtime-start.log` |
| `npm pack --dry-run --json --ignore-scripts` | Exit 0; 482 Einträge, 8.72 MB geschätztes npm-Archiv; kein Publish | `verified-final-npm-pack-dry-run.json` |
| `node scripts/verify-release-approval.cjs` | Erwartet Exit 1: Produktion gesperrt | `production-gate.log`; zusätzlich im Overlaytest geprüft |

Die Gesamtprüfung umfasst die bestehenden Regressionen sowie die neue Partnerkette. Der enthaltene Overlaytest führt die echte `prepublishOnly`-Prüfkette in einer frischen Repositorykopie ohne Entwicklungsabhängigkeiten und nach simuliertem Überkopieren alter Admin-Bundles aus. Eine lokale Testregistry beantwortet die Versionsabfrage kontrolliert. Ein echter künstlicher Secretfund muss die Kette abbrechen, ohne seinen Wert auszugeben. Es erfolgt kein `npm publish` und keine Installation auf einer Kundenanlage.

| Schwerpunkt | Ausgeführter Umfang |
| --- | --- |
| Fachvertrag und API | 26 Tests: Rechte, Rollen, Ressourcen, CAS, Journalfehler, Replay, Reihenfolge, monotone Ablaufzeit, Widerruf und eingereihte alte Nachrichten. Strikte isolierte Kompilierung der echten Module. |
| WSS-Transport | 15 Prüfungen einschließlich echtem lokalen TLS-Transport, negativer Gegenstellenprüfung, Nachrichten-/Zeitgrenzen und Sitzungswechseln. |
| Partnerlaufzeit | 20 Prüfgruppen: echte Dateipersistenz, Rechte, Journalverlust, Rotation, Neustart, Refresh und Widerrufsschranke. |
| Main-Integration | 16 Prüfungen an den tatsächlichen Adaptermethoden mit isolierter ioBroker-I/O. |
| Steuergrenze und Writer | 71 Tests über Evaluator, Single-Tick, zentrale Hoheit und dynamische Laufzeit. Tatsächliche Aufrufe des vorhandenen Writers werden mit simulierter Geräte-I/O gezählt. Widerruf während eines await verhindert den anschließenden Write. |
| UI | 9 Vertragsprüfgruppen; 10 Chromium-Prüfgruppen, Desktop/Mobil, Rollenfehler, Konflikte, eingebettete Formulare, keine beobachteten Seitenfehler oder horizontalen Überläufe. |
| Bestandsintegration | Unter anderem 9 Credential-/Persistenzfälle jeweils an Runtime und kanonischer Quelle, 6 NVP-/Dynamic-HTTP-Fälle, 29 Navigations-/CAS-VM-Fälle sowie 6 Rendererfälle. |
| Frontend-Sicherheit | 46 Prüfungen einschließlich geschützter Partnerseiten und Bereinigung alter PWA-Caches. |
| Lizenzumfang | Home- und Pro-Freigaben sowie bestehende sichere Lizenzabfrage geprüft; neue App nutzt den vorhandenen Speicher-Lizenzbereich. |

Die neuen risikorelevanten Module wurden strikt typgeprüft. Das ist keine Behauptung einer vollständigen Strict-/no-any-Migration des historischen Gesamtbestands. Bestehende VM-Fixtures wurden um die tatsächlichen neuen Imports und Closurewerte ergänzt; die neuen Schutzfunktionen werden darin ausgeführt. Die Home-Fallbackliste und die Lizenzprüfung wurden an den bereits maßgeblichen Lizenzvertrag beziehungsweise den vorhandenen sicheren Endpunkt angepasst.

Ein separater KI-gestützter Quellreview reproduzierte während der Entwicklung unter anderem einen Writerdurchlass bei fehlendem Autoritätsobjekt, einen fehlenden Schutz eines als `recovery` markierten Übergangs und alte eingereihte Sitzungsnachrichten. Die Befunde wurden korrigiert und durch negative Regressionen geprüft. Der Bericht `INDEPENDENT_REVIEW_DE.md` bezeichnet die getrennte Reviewarbeit, **keinen externen zertifizierten Sicherheitsprüfer**.

Ein früherer Gesamtlauf meldete Exitcode 0, sein gespeicherter Rohlog war jedoch unvollständig. Er dient nicht als abschließender Vollnachweis. Der oben ausgewiesene erneute Gesamtlauf erfasst stdout/stderr vollständig, speichert den tatsächlichen Prozessrückgabecode und bindet die Logdatei per SHA-256. Frühere Entwicklungslogs können erwartete oder inzwischen behobene Fehler enthalten; maßgeblich sind die finalen `verified-final-*`-Belege.

## Abhängigkeiten, Scanner und CRA-Nachweise

Neu hinzugefügt sind `ws` exakt 8.22.0 und die zugehörigen Entwicklungstypen `@types/ws` 8.18.2. Der während der Prüfung gefundene moderate qs-Befund GHSA-6pq8-jhm2-2vcw wurde durch exakte Auflösung auf qs 6.16.1 korrigiert. Die anschließenden Root- und Admin-Audits melden jeweils **0 bekannte Schwachstellen** zum Prüfzeitpunkt; dies ist kein allgemeiner Schwachstellenfreiheitsnachweis. Ausgangs- und Folgeaudit sind getrennt aufbewahrt.

Der Security-ESLint-Lauf prüft 174 Quellen und führt 3067 Hinweise: 2971 historische offene Hotspots und 96 einzeln bewertete Vorkommen; 0 neue oder verbotene ungeprüfte Stellen. Die Legacybaseline wurde nicht erweitert. Eine problematische neue Hostname-Regex wurde vereinfacht. 25 bestehende Gate-Negativtests sowie 12 zusätzliche Negativfälle für die sechs neuen strikten Module prüfen, dass die Grenzen nicht durch Inventareinträge oder Typunterdrückungen ausgehebelt werden. Scannerhinweise sind keine Zählung bestätigter Sicherheitslücken.

| Nachweisbereich | Mitgelieferter Stand / Grenze |
| --- | --- |
| Architektur, Datenflüsse, Rechte und Fehlerszenarien | `docs/PARTNER_ARBITRAGE_1_0_32_DE.md` einschließlich risikobasierter CRA-Zuordnung. |
| Schnittstelle und Provisionierung | Protokoll-v1-Dokument, geschützte Bereitstellung, Widerruf, Wiederanlauf und Betriebshinweise. |
| Secure Development und Codeprüfung | Strikte neue Sicherheitsmodule, Schemas, Negativtests, dokumentierte Einzelfundbewertungen und separater Review. |
| Softwarelieferkette und Integrität | Exakte Lockfiles, Auditergebnisse, Release-SBOM, Laufzeitartefaktversiegelung und Vollarchivmanifest. |
| Regressions- und Installationsnachweise | Tatsächliche lokale Gesamtprüfung, Browser-/TLS-/Dateisystemtests, frische Paket-/Overlayprüfung. |
| Noch nicht vollständig | Gesamtes EOS-Inventar einschließlich Betriebssystem, js-controller und Drittadaptern; externer Sicherheitsnachweis, Remote-CodeQL-Lauf, vollständige ASVS-Zuordnung, Produkt-/Support-/Konformitätsentscheidung. |

Die Dokumentation unterstützt die technische CRA-Nachweisführung. Sie ist keine abgeschlossene CRA-Konformitätsbewertung, keine Zertifizierung und keine Herstellererklärung. Historische offene Befunde einschließlich der ausdrücklich beibehaltenen NW1-Ausnahme sind im Release-Status weiterhin sichtbar.

## Abnahmegrenzen und Übergabe

Vor Handelsbetrieb fehlen ein konkreter Anbieter-/Sandbox-End-to-End-Test und die Abnahme an der vorgesehenen Speicherhardware. Dazu gehören Vorzeichen, echte SoC-/Leistungswerte, Geräte- und Netzgrenzen, lokaler Vorrang, Ablauf und Widerruf während I/O, Wiederverbindung, Neustart, Gerätewatchdog sowie gemessene Rückfallzeiten. Zielsystemlast und physischer Stromausfall während Dateisynchronisierung sind ebenfalls nicht durch die lokalen Softwaretests nachgewiesen. Das Markt-/Mess-/Netzkonzept und die Berechtigung zur Datenverwendung sind anlagen- und vertragsbezogen zu klären; ein UI-Schalter erteilt keine solche Berechtigung.

`release-manifests/release-status.json` bleibt auf `status: review` und `productionApproved: false`. Die Produktionsfreigabeprüfung muss deshalb weiterhin mit `release-not-approved` sperren. Technische Paketprüfungen ersetzen diese Entscheidung nicht.

Für die Einrichtung sind im Vollarchiv die Dokumente `docs/PARTNER_RUNTIME_PROVISIONIERUNG_DE.md`, `docs/PARTNER_INTEGRATION_PROTOCOL_V1_DE.md` und `docs/STABLE_1_0_32_RELEASE_DE.md` maßgeblich. Vor einem Update Konfiguration und Zustand sichern; die neue Verbindung und Steuerfreigaben sind standardmäßig aus. Es wurden keine echten Zugangsdaten eingerichtet, kein Händler verbunden und keine Speicherleistung auf einer realen Anlage verändert.
