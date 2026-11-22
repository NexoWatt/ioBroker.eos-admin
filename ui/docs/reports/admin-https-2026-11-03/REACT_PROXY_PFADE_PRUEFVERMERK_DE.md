<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# Prüfvermerk: React-Ressourcen und Navigation im Admin-HTTPS-Proxy

Stand: 2026-11-03, Arbeitsstand 1.0.35. Dies ist ein enger Ergänzungsnachweis zur HTTPS-Anmeldekorrektur, keine Produktionsfreigabe oder CRA-Konformitätsbescheinigung.

## Befund und Änderung

Der Browsernachweis zeigte einen konkreten 404 für das dynamisch angefügte gemeinsame Stylesheet: `EmbeddedEmsFrame` lud `/static/styles.css` am Admin-Ursprung außerhalb des Instanzproxys. Das Stylesheet verwendet jetzt die bereits validierte Basis aus `getRuntimeProxyBase()`; im direkten EOS-Betrieb bleibt der Pfad unverändert.

Eine anschließende vollständige Suche in `src-admin-tab/src` nach Ressourcen, `href`, `window.open`, `location.pathname` und URL-Aufbauten ergab weitere konkrete Pfadabweichungen derselben Ursache:

- Die Links in `NotificationMailPage`, `MeshCoordinatorPage` und `DynamicGridPage` bleiben jetzt im gültigen Runtime-Instanzpfad; Queryparameter und Rahmeneinstellungen bleiben erhalten.
- Das eigenständige Datenpunkt-Auswahlfenster öffnet `ems-apps.html` unter derselben Runtime-Basis. Die bestehenden Prüfungen für Ursprung, Fenster und Auftragskennung bleiben erhalten.
- `App.tsx` entfernt für die Microgrid-Routenentscheidung ausschließlich das passende, validierte Proxy-Präfix. Eine echte `/ems/microgrid`-Runtime zeigt die Microgrid-Seite auch hinter dem Proxy; der Admin-Tab behält seine bisherige Weiterleitung.

Nicht betroffene Fundstellen sind der Transport selbst, ein lokaler Blob-Download, das gebündelte Logo sowie die Prüfungen für den Nachrichtenursprung. Der vollständige Suchnachweis liegt in `react-proxy-paths-scan.log`. Es wurden keine Rollen, Passwörter, Gerätebefehle oder Konfigurationen geändert.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis | Aussagegrenze |
| --- | --- | --- |
| `node scripts/verify-admin-react-proxy-paths.cjs` | 16 Fallgruppen bestanden | Originale TS/TSX-Funktionen im kontrollierten DOM-/Hook-Host; kein Browser |
| `tsc -p src-admin-tab/tsconfig.json` | Exit 0, keine Diagnosen | Strenge Typprüfung der Admin-Quelle |
| `node scripts/verify-cra-admin-router.cjs` | 44 Fälle bestanden | Bestehender Router-/Auth-Nachweis; Mock um neuen Transport-Helfer ergänzt |
| ESLint der sechs Produktdateien | Exit 1, 41 Meldungen | 20 in DynamicGrid und 21 in MeshCoordinator, ausschließlich `security/detect-object-injection`; kein pauschales Grün |

Die 16 Fallgruppen decken direkten HTTP- und HTTPS-Betrieb, Adminproxy an der Wurzel mit Instanz 0 sowie einen öffentlichen Admin-Pfad mit Instanz 7 ab. Je Kontext werden das tatsächliche Stylesheetziel, Ursprung und Listener-Abbau, alle betroffenen React-Navigationsziele, Runtime-/Admin-Tab-Unterscheidung und das tatsächliche Popupziel samt vollständiger Auswahl und Aufräumen geprüft. Die Testdaten sind synthetisch; es werden keine realen Konten oder Anlagen angesprochen.

Die 41 Lint-Fundstellen befinden sich in bestehenden dynamischen Objektzugriffen außerhalb der hier geänderten URL-Ausdrücke. Dieser Teilnachweis behauptet keine allgemeine Behebung dieser Befunde; der übergeordnete Sicherheitsreview bewertet ihren Stand. Die anderen vier Produktdateien haben in diesem Lauf jeweils null Meldungen. Es wurden keine Regeln unterdrückt.

## Rohdaten und Grenzen

- `react-proxy-paths.log`: vollständige Ausgabe der 16 Fallgruppen.
- `react-proxy-paths-eslint.json`: unveränderte ESLint-Diagnosen.
- `react-proxy-paths-results.json`: ausgeführte Prüfungen und SHA-256 der beteiligten Quellen und Tests.
- Der getrennte Browsernachweis des übergeordneten Änderungspakets muss das gebaute Frontend prüfen; dieser Vermerk nimmt dessen Ergebnis nicht vorweg.

Die Änderung gibt keine zusätzliche Berechtigung. Browser-, Adminproxy- und EOS-Authentifizierung werden weiter vom jeweiligen vorhandenen Transport und Backend durchgesetzt. Eine Prüfung auf der Kundeninstallation, ein Hardwaretest und eine produktive Installation sind hier nicht erfolgt.
