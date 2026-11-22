<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# Anmeldemaske: klare Kontodaten und konsistente Zustände

Stand: NexoWatt UI 1.0.35, 03.11.2026. Ausgangsbasis: vollständiger Stand 1.0.34.
Änderung: `src-admin-tab/src/pages/ProtectedRuntimeRoute.tsx`.

## Problem und Korrektur

Der bisherige Platzhalter „installer oder admin“ konnte als festgelegter
Benutzername verstanden werden. Er lautet jetzt „ioBroker-Benutzername“.
Ein zugänglicher Hilfetext erklärt das eigene Passwort des Kontos und die
Rechtevergabe durch zugeordnete ioBroker-Gruppen. Die Änderung legt keine Konten
an und enthält kein Standardpasswort. Nur der zuletzt eingegebene Benutzername
wird wie bisher lokal gemerkt; Passwörter werden nicht im Browserspeicher abgelegt.

Eine Statusabfrage nach erfolgreichem Passwortnachweis konnte scheitern und
anschließend als fehlende Rolle dargestellt werden. Die Maske behält jetzt die
tatsächliche Statusfehlermeldung bei. Nur ein geprüftes aktives Konto mit passender
Capability und gegebenenfalls erlaubter Rolle öffnet die geschützten Inhalte.
Ein EOS-HTTP-401 bleibt ein Anmeldefehler; ein klassifizierter
`admin_proxy_auth_required`-Fehler verlangt dagegen eine erneute Admin-Anmeldung.

Generationen und Lifecycle-Prüfungen verhindern, dass späte Antworten eine
neuere Anmeldung, Abmeldung oder Route überschreiben. Während Anmeldung oder
Abmeldung starten keine Hintergrundprüfungen; parallele Statusabfragen werden
nicht mehrfach gestartet. Nach Abmeldung wird die Ansicht sofort gesperrt.
Kann der Server die Abmeldung nicht bestätigen, wird dies ausdrücklich gemeldet;
automatisches Polling öffnet eine eventuell verbliebene Sitzung nicht erneut.
Eine ausdrückliche erneute Prüfung oder Anmeldung bleibt möglich.

Diese UI-Prüfungen ersetzen keine serverseitige Autorisierung. Sie brechen
bereits laufende Serveroperationen nicht rückwirkend ab und treffen keine
Aussage über einen atomaren Widerruf aller HTTP-Anfragen. Transportwahl,
HTTP-Fristen, Sessioncookies und Proxykonfiguration werden im zentralen
Verbindungsmodul beziehungsweise Backend getrennt behandelt.

## Ausgeführte Prüfung

Umgebung: Node.js v24.22.1, vorhandene TypeScript- und Admin-Abhängigkeiten.

| Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| `node scripts/verify-protected-runtime-route.cjs` | 15 Prüfgruppen bestanden | `loginform.log` |
| `node scripts/verify-cra-admin-router.cjs` | 44 bestehende Fälle bestanden | `loginform-router.log` |
| `./node_modules/.bin/tsc -p src-admin-tab/tsconfig.json` | Strict-TypeScript ohne Fehler | `loginform-types.log` |

Der neue Test transpiliert die tatsächliche TSX-Komponente im Speicher und führt
deren Handler mit kontrollierten Hookzuständen, Lifecycle-Wechseln und verzögerten
API-Antworten aus. Geprüft wurden individuelle Passwortübergabe, fehlende Rolle,
Timeout nach erfolgreichem Login, Unterscheidung von EOS-/Proxyfehlern, doppelte
Anmeldung, alte Erfolgs-/Fehlerantworten, Abmeldung, Unmount und Routenwechsel.
Dies ist ein deterministischer Komponenten-Test und kein echter Browser- oder
Live-Admin-8-Test. Der vorhandene Router-Test nutzt echte React-Serverrenderer und
kontrollierte Hookzustände; seine beiden Fixtures wurden lediglich um `useRef`
ergänzt. Die Rechteerwartungen bleiben erhalten.

Die Einzelprüfung der geänderten TSX-Datei mit dem vorhandenen ESLint-Regelsatz
meldete keine Fehler oder Warnungen. Befehle, Exitcodes und Quellhash stehen in
`loginform-results.json`; die abschließende Gesamtprüfung und Artefaktbindung
erfolgen im zentralen Lieferbericht dieses Verzeichnisses. Keine lokale Prüfung
bestätigt bereits eine Anmeldung auf der gemeldeten Kundeninstallation.
