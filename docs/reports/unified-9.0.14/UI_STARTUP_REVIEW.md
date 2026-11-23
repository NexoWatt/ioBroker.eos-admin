# Eingebettete UI: Betriebsstart und EMS-Diagnose 9.0.14

Stand: 23.11.2026. Umfang dieses Teilreviews: UI-Startstatus, EMS-Statusansicht und Antwort auf eine während des Starts gesperrte App-Center-Wiederherstellung.

## Befund

Die bisherigen Oberflächenangaben reichten zur Fehlerbestimmung nicht aus:

- Der globale Schreibschutz antwortete für jeden noch nicht bereiten UI-Zustand mit `EOS_UI_STARTING`. Dadurch erschienen auch eine fehlende Lizenz, eine blockierte Bestandsübernahme und eine fehlende eindeutige Steuerungsfreigabe wie ein noch laufender Start.
- `/api/ems/status` meldete nur den Engine-Timer. `STOPPED`, unbekanntes Tick-Intervall und leere Moduldiagnosen unterschieden einen absichtlich gesperrten Betriebsstart nicht von einem fehlgeschlagenen EMS-Start.
- Der Wiederherstellungsdialog zeigte nur den technischen Fehlercode und keine für die Installation brauchbare Erklärung.

Der Startablauf lädt die bestehende Konfiguration vor dem EMS und schützt jeden asynchronen Startschritt mit aktueller zentraler Lizenz und Steuerungsfreigabe. In den geprüften vollständigen Startfällen war kein unabhängiger Hänger von `initEmsEngine()` reproduzierbar. Eine blockierte Host-Migration kann bereits verhindern, dass der operative UI-Start überhaupt aufgerufen wird. Die Authentifizierungsoberfläche bleibt dabei absichtlich erreichbar.

Die Feldfolge „Start ohne vertrauenswürdigen Lizenzschlüssel, Lizenz später aktiviert, kein anschließender Neustart“ ist vom Host-Migrationsablauf getrennt zu behandeln. Der neue Diagnosevertrag bildet dafür ausdrücklich `LICENSE_REQUIRED` zusammen mit `EOS_MIGRATION_RESTART_REQUIRED` ab: Lizenz inzwischen aktiv, einmaliger EOS-Neustart zur vorgelagerten Bestandsprüfung erforderlich. Die Host-Freigabe und die eigentliche Migrationskorrektur gehören zum separaten Host-/Migrationsreview; dieser UI-Patch führt selbst keine Migration aus.

## Änderung

Der neue strikt typisierte Helfer `ui/src-ts/runtime-executables/lib/hosted-startup-status.ts` erstellt ausschließlich eine lesende, begrenzte Statusdarstellung. Er unterscheidet `idle`, `starting`, `ready`, `unlicensed`, `blocked`, `degraded` und `stopped`. Fehlercodes, Ablaufphasen und Instanznamen werden format- und mengenbegrenzt übernommen; freie Providerfehlermeldungen, Konfigurationen, Gerätewerte und Geheimnisse werden nicht kopiert.

`main.ts` kennzeichnet die aktuellen Startabschnitte und ergänzt `/api/ems/status` um den lesenden Snapshot aus UI-Lifecycle und Host-Freigabe. Wiederherstellungs- und andere Schreibanfragen bleiben bis zur Betriebsbereitschaft gesperrt. Die Antwort nennt jetzt den tatsächlichen Grund. Ein Providerfehler erteilt keine Freigabe und verändert weder Lifecycle noch Konfiguration.

Die EMS-Ansicht zeigt neben dem tatsächlichen Engine-Status den Betriebsstart samt Grund. Ein Link zur tatsächlichen Bestandsübernahme-Route `/migration/` wird nur für EOS-Administratoren mit `license.manage` geliefert und im selben Tab geöffnet. Installateure erhalten Diagnoseinformationen, aber keinen Link auf eine ihnen gesperrte Verwaltungsseite. Kundensitzungen erhalten am globalen Schreibschutz ausschließlich den Fehlercode, keine erweiterten Diagnosedaten. Die Wiederherstellung zeigt die übersetzte Erklärung samt technischem Fehlercode; es gibt keinen versteckten Wiederholungsversuch.

Authentifizierung, Rollenprüfung, CSRF, zentrale Lizenz, Migrationsschutz und aktueller Schreibschutz bleiben erhalten. Es werden keine Regler gestartet, alte Instanzen gestoppt, Konfigurationen importiert oder Migrationen bestätigt, nur weil eine Diagnoseseite aufgerufen wird.

## Nachweise

Ausgeführt wurden die tatsächlichen HTTP-Routen mit kontrollierten Host-/Datenbankfixtures sowie die produktiven Frontendfunktionen in einer begrenzten DOM-Testumgebung. Der vollständige UI-Start und Stop-Ablauf wurde zusätzlich durch die bestehenden Regressionstests ausgeführt.

| Prüfung | Ergebnis |
| --- | --- |
| Strikter TypeScript-Lauf `ui/tsconfig.hosted-startup-status.json` | bestanden |
| Typgestützter ESLint-Lauf `ui/eslint.hosted-startup-status.config.mjs` | bestanden |
| 10 neue Status-, HTTP-, Rechte- und Frontendfälle | bestanden |
| 26 bestehende Start-, Stop-, Lizenz-, Ownership- und Bestandshydrationsfälle | bestanden |
| Gesamter ausgewählter Satz mit Node.js 24.22.3 | 36 bestanden, 0 fehlgeschlagen, 0 übersprungen |
| Derselbe Satz mit Node.js 22.23.4 | 36 bestanden, 0 fehlgeschlagen, 0 übersprungen |

Testdateien: `hosted-startup-status.test.cjs`, `full-startup.test.cjs`, `preserved-ui-startup.test.cjs`, `hosted-runtime-stop.test.cjs`, `hosted-runtime.test.cjs` unter `ui/test/unified/`.

Abgedeckt sind insbesondere die konkrete spätere Lizenzaktivierung mit erforderlichem Neustart, Migrationsblockade statt irreführendem `STARTING`, fehlende Steuerungsfreigabe, Initialisierungsfehler, unveränderte Konfiguration bei gesperrter Wiederherstellung, CSRF-Ablehnung, anonyme und unberechtigte Zugriffe, Linkrechte, inerte Darstellung von Diagnosetext und ausbleibende versteckte Wiederholungsanfragen. Ein vorhandenes userdata-Backup der UI-Version 1.0.38 bleibt in allen geprüften unvollständigen Startzuständen lesbar, während dessen Import weiterhin gesperrt ist; der Test bestätigt null Konfigurationsspeicherungen, null Backup-Schreibvorgänge und null EMS-Starts sowie unveränderte States. Die geschützte Backup-Objektbereitstellung ist bei diesem Routen-Test ausdrücklich eine Fixture. Die bestehenden Stop-Tests prüfen weiterhin, dass späte Startabschlüsse einen bestätigten Stopp nicht rückgängig machen.

## Grenzen

Dieser Teilreview ist kein Nachweis der Migration einer konkreten Kundenanlage und keine Prüfung realer Geräte, ioBroker-Datenbanken oder EMS-Aktorik. Die Frontendtests sind Ausführungstests mit DOM-Fixture, kein visueller Browsertest. Die exakte Feldversion Node.js 22.23.5 wurde in diesem Teilreview nicht ausgeführt. Vollständige Releaseprüfungen, Paket-/Artefaktabgleich und die Host-Migrationsnachweise werden separat dokumentiert.
