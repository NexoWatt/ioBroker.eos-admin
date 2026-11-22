<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# NexoWatt UI 1.0.36 – Lademodi, HTTPS-Bedienung und offener OCPP-Wiederanlauf

Stand: 11.11.2026. Basis: vollständiger Quellstand 1.0.35. Der Betreiber bestätigt 1.0.35 und eine OCPP-Wallbox; Modell, Firmware und OCPP-Adapterversion sind noch nicht belegt. Der hier fortgeschriebene Stand enthält die gezielten Quellkorrekturen aus der [vorangegangenen Prüfung](../charging-mode-2026-11-11/PRUEFBERICHT_DE.md). Deren damalige Buildgrenzen und Quellpatch-Aussagen sind historisch. Dieser Lieferstand wurde regulär gebaut; die tatsächlichen Ergebnisse und verbleibenden Grenzen stehen unten. Er ist eine vollständige Testversion, keine Produktivfreigabe.

## Befundumfang

| Befund | Änderung bzw. Status in 1.0.36 | Nachweisumfang |
| --- | --- | --- |
| NW-EVCS-20261111-01 | Moduswechsel auf EVCS-Seite und Hauptseite nur anhand bestätigtem Backendzustand darstellen; Fehler und konkurrierende Anfragen behandeln. | Gezielt ausgeführte Funktions-/VM-Prüfungen; finale Build-/Regressionsbelege unten. |
| NW-EVCS-20261111-02 | Positive günstige Tariffenster im Auto-Strategiepfad `cheap-grid` mit aktiver/frischer und bestehender Tarif-/Netzfreigabe berücksichtigen. | Mock-Regelticks, keine Hardwareabnahme. |
| NW-EVCS-20261111-03 | Diagnose verwendet das korrekte Sollwertfeld; Benutzermodus und Fahrzeug-/Bedarfszustand in Audit/CSV ergänzen. | Snapshot-, Ereignis- und Exportfunktionen. |
| NW-EVCS-20261111-04 | Bekannte negierte Fahrzeugtexte vor allgemeinen positiven Textmustern auswerten. | Parser-/Prioritätsregressionen. |
| NW-EVCS-20261111-05 | Offen: alter OCPP-Transaktionsstatus kann aktuelle Vorbereitung überstimmen. Keine automatische Aufhebung einer möglicherweise echten Fahrzeugpause. | Bedingter Fehlerpfad lokal reproduziert; tatsächliche Sessiongrenze und Feldursache fehlen. |

HTTPS über den Adminproxy betrifft Browsertransport und Sitzungsgrenzen. Es stellt nicht selbst die Wallboxverbindung auf WSS um. Alle 91 kanonischen EMS-Dateien sind in den Originalarchiven 1.0.34 und 1.0.35 bytegleich; die untersuchten HTTPS-Änderungen betreffen Proxy, HTML und Cookies. Der UI-Adapter schreibt weiterhin ioBroker-Datenpunkte, der separate OCPP-Adapter besitzt die Wallboxverbindung. Ein abgewiesener Browser-Modusbefehl und eine anschließend unzutreffende lokale Anzeige können die Beobachtung „Auto angezeigt, intern PV“ erklären. Eine konkrete Verursachung durch HTTPS ist damit nicht bewiesen.

Der Einzelwallbox-Dialog auf der Hauptseite besitzt einen eigenen Schreibpfad und wurde ebenfalls korrigiert, einschließlich seiner beiden Legacy-Varianten. Auch die Auto-Quelle Standard/Strategie wird auf der EVCS-Seite erst nach bestätigtem Readback übernommen. Netzwerkfehler, HTTP 401/403, Login-HTML, ungültige Antworten, Zeitüberschreitung, Doppelklicks und ältere Antworten werden geprüft. Fehlgeschlagene Schreibanfragen werden nicht automatisch wiederholt. Der Serviceworker wurde auf v524 angehoben, damit neue Webdateien übernommen werden.

Die vorgelegte CSV enthält 240 Einträge für LP1 und ausschließlich den Morgen von 04:40:17 bis 06:07:42 MEZ am 11.11.2026. Der Abend fehlt. „Modus“ bezeichnet dort den effektiven Modus; Auto darf zeitweise PV wählen. Ab 05:39:13 stehen Boost und 11.000 W Sollwert im Log, erstmals um 05:42:41 etwa 10.719 W Istleistung. Safety bleibt NORMAL. Der genaue Zeitpunkt des Umsteckens und die OCPP-Transaktionszustände fehlen. Deshalb wird weder eine konkrete Abendursache noch ein erfolgreich behobener OCPP-Wiederanlauf behauptet. Die neue Diagnose trennt Benutzermodus und wirksamen Modus und ergänzt Status-/Bedarfsinformationen.

Im vollständigen Mock-Regeltick mit Original-1.0.35 kann ein 24 Stunden alter SuspendedEV-Transaktionsstatus trotz frischem Preparing 0 W bewirken. Ein frischer EVConnected-Status ermöglicht wieder 4.200 W, auch ohne geöffneten Browser. Ein Modulneustart mit denselben gespeicherten Zuständen beseitigt das Problem nicht. Ohne verlässliche Sessiongrenze könnte ein pauschales Ignorieren des Pausenstatus echte Fahrzeugpausen aufheben. Dieser Pfad wurde deshalb nicht automatisch übersteuert; Nachweise stehen in `ocpp-restart-probe.json`.

## Prüfstatus dieses Lieferstands

Alle nachfolgend als bestanden bezeichneten Prüfungen wurden ausgeführt. Die vollständige `test:all`-Kette ist nicht grün: Sie bricht beim ersten Chromium-Start ab. Danach wurden alle verbleibenden 57 Gruppen einzeln ausgeführt, ohne die Produkt-Gates zu verändern. Ergebnis: 72 von 81 Gruppen bestanden, neun Browsergruppen durch die Umgebung blockiert. Die Einzelergebnisse stehen in `test-execution-summary.json`, Rohprotokolle in `test-logs/`.

Registrierte neue Testsuite: `npm run test:charging-mode-recovery`. Sie umfasst:

1. `verify-auto-cheap-grid-window.cjs`
2. `verify-evcs-vehicle-status-regressions.cjs`
3. `verify-charging-audit-start-mode.cjs`
4. `verify-charging-csv-mode-context.cjs`
5. `verify-evcs-mode-write-failure.cjs`
6. `verify-live-evcs-mode-confirmation.cjs`

Die Release-Tests führen das erzeugte Produkt-JavaScript ohne `--canonical` aus. Die vorherige isolierte Quellprüfung mit `--canonical` bleibt ein gesonderter Nachweistyp. Die sechs Tests bestehen mit 16 + 27 + 16 + 9 + 37 + 48 = 153 Fällen. Sie sind dauerhaft in `test:all` und dem alternativen Releaseplan mit jetzt 251 Schritten eingebunden; ihre Skripte gehören zur npm-Dateiliste. Die reine Planvalidierung ist kein ausgeführter Lauf aller 251 Schritte.

| Prüfung | Tatsächliches Ergebnis | Beleg |
| --- | --- | --- |
| Versions-/Testregistrierung 1.0.36 | Versionen konsistent; alternativer Releaseplan und TS-Scaffold bestanden | `test-logs/publish-plan-251-verify.log`, `test-logs/publish-plan-251-scaffold.log` |
| Runtime-Sync / regulärer Build | `npm run build:ts` bestanden, manuelle Typverträge erhalten | `test-logs/build-1.0.36.log` |
| Neue Runtime-Regressionssuite | 153/153 bestanden, gegen erzeugtes JavaScript; VM/Mocks | `test-logs/charging-mode-runtime-1.0.36.log` |
| Gesamtregression | 72/81 Gruppen bestanden; neun Browsergruppen wegen Chromium-Socket-EPERM/Debug-Port-Timeout blockiert | `test-execution-summary.json`, `test-logs/test-all-1.0.36.log` und Fortsetzungslogs |
| CRA-Regressionen | Nach enger Aktualisierung der Cache-Testfixture vollständig bestanden; aktueller v524-Cache und fremder Cache müssen erhalten bleiben | `test-logs/cra-rerun-1.0.36.log`, `SW_V524_TESTAKTUALISIERUNG_DE.md` |
| HTTPS-/Admin-/Gruppenregressionen | Bestehende Admin-HTTPS-, Admin-8- und Gruppenberechtigungsgruppen bestanden; lokales HTTP/VM, keine echte Kunden-TLS-Strecke | Entsprechende `remaining-test-admin-https`, `remaining-test-admin8-auth`, `remaining-test-group-access`-Logs |
| Sicherheitsprüfung | Bestanden: 178 Quellen, keine neuen ungeprüften/verbotenen Lint-Funde; 2.968 historische offene Vorkommen bleiben offen | `ESLINT_PRUEFNACHWEIS_DE.md`, `test-logs/remaining-test-security-standards.log` |
| Produktionsabhängigkeiten | `npm audit --omit=dev`: zum Prüfzeitpunkt 0 gemeldete Schwachstellen; keine Aussage über Gesamtprodukt oder unbekannte Lücken | `test-logs/npm-audit-production-1.0.36.json` |
| Paket-/SBOM-/Integritätsprüfung | Read-only Paketprüfung und SBOM-Bindung bestanden; 499 explizite Paketdateien | `test-logs/publish-check-1.0.36.log` |
| Paketstart | 285 JS/MJS-Dateien, relative Imports sowie main-/EMS-/§14a-Startkette mit neutralen externen Stubs bestanden | `test-logs/runtime-smoke-1.0.36.log` |
| Publish-/Upgrade-Regressionsgruppe | Frische Kopie, Überkopieren und Secret-Negativfall mit echter Prüfkette gegen lokale Testregistry bestanden; keine Veröffentlichung | `test-logs/remaining-test-stable-1.0.12-publish.log` |
| Öffentliche npm-Versionsverfügbarkeit | Nicht bestätigt: Proxy-Verbindung lief in Timeout; Schutz blockiert sicher | `test-logs/npm-version-free-1.0.36.log` |
| Konkrete Wallbox, ioBroker-Installation und Nachtversuch | Nicht durchgeführt | Betreiberabnahme erforderlich |

Die endgültigen ZIP-/TGZ-Hashes und Prüfungen der frisch extrahierten Lieferarchive werden separat in den Liefernachweisen festgehalten, damit kein nachträgliches Umschreiben der versiegelten Archive erforderlich ist. Die Roh-CSV mit Anlagendaten wird nicht in das Quellarchiv übernommen. Ihre SHA-256 lautet `fb16301f7f083f3ba78e8eb598931adf31211e3a6aa987db9776e7b47df57687`.

Die Prüfung ist keine vollständige Härtung sämtlicher sonstiger Bedienfelder: Phase, Speicherfreigabe, Ladeziele und Regelungsfreigabe besitzen weitere Schreibpfade. Ein älterer externer numerischer Moduspfad mit vorgezogener Cacheübernahme wurde separat vermerkt, aber nicht als Ursache dieses Vorfalls reproduziert; siehe `MUTATIONSPFADE_AUTOSOURCE_DE.md`. Der ungenutzte ältere Textvergleichstest `verify-charging-minpv-base-mode-reaction.js` scheitert auch im Original; der registrierte funktionale Test `verify-charging-minpv-base-reaction.js` besteht.

## Update und offene Abnahme

Sicherung und Rückfall auf 1.0.35 vorsehen. Reguläres Adapterupgrade und vollständiges Neuladen der Browserseiten durchführen. Kein automatisches Downgrade von HTTPS auf HTTP, keine Abschaltung der Zertifikats-/Benutzerprüfung und keine Änderung der OCPP-Verbindungsadresse zur Umgehung einer fehlgeschlagenen Browseranmeldung.

Die tatsächliche Wallbox-/Firmware-/Adapterkombination benötigt einen Test von Einstecken bei fehlendem PV, Tarif- und Zielladewechseln, langer Fahrzeugpause, Wiederanlauf ohne Neu-Einstecken, Adapter-/Kommunikationsneustart und unveränderten Netz-/Stationsgrenzen. Fahrzeugpause, Fehler und Abwesenheit müssen zuverlässig unterschieden werden. Unveränderten JSON-Export und protokollnahe Zustände mit Zeitstempeln und Session-/Transaktionskennung sichern.

Freigabestatus: `review`, `productionApproved: false`. Offene übergreifende Produkt-/Sicherheits-/CRA-Nachweise aus 1.0.35 werden in `release-manifests/release-status.json` weitergeführt. Es wurde weder eine produktive Anlage geändert noch eine npm-Veröffentlichung vorgenommen. Die Releaseversion bezeichnet den Quellstand, keine hundertprozentige Funktionsgarantie und keine Zertifizierung.
