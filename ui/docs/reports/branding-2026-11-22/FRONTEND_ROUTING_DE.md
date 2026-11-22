# 1.0.38 – Direkter HTTPS-Einstieg und Frontend-Navigation

Stand: 22.11.2026, Prüfabschluss dieses Arbeitsschritts 07:54 UTC.
Umgebung: Linux, Node.js 24.22.3, vorhandenes TypeScript und React im Repository.
Änderungsumfang: Browsernavigation und Transport-Zielermittlung. Nativer
TLS-Listener, Zertifikate, Service Worker und gemeinsame PWA-Initialisierung
werden im zugehörigen Integrationsnachweis getrennt geprüft.

## Befunde und Korrekturen

| Kennung | Reproduzierter Befund | Korrektur |
| --- | --- | --- |
| UI38-N01 | Ein frischer direkter Aufruf von `https://IP:8188/ems-apps.html` wurde durch `admin-guard.ts` ohne historische Query-/SessionStorage-Kennung nach `https://IP:8081/` umgeleitet. Die neue Anmeldung liefert diese Kennung nicht; die Seite war bereits serverseitig autorisiert. | Die beiden Script-Verweise in App-Center und Simulation sind entfernt. Beide Seiten laden ausdrücklich `runtime-base.js` vor `auth.js`; ihre Capability-Attribute bleiben bestehen. Serverseitige Rollen-/Seitengates werden durch diesen Arbeitsschritt nicht geändert. |
| UI38-N02 | Die Admin-Zielermittlung übernahm nur `native.port`. Bei `native.secure:true` erzeugte der HTTP-Admin weiterhin eine HTTP-Adresse für den HTTPS-Port. | `readAdapterRuntimeTarget` liest eine validierte Struktur `{port, secure}` aus genau der ausgewählten Instanz. Der gemeinsame Resolver berücksichtigt das Protokoll; bekannte Runtime-/Proxy-Kontexte bleiben auf ihrem tatsächlichen Ursprung. |
| UI38-N03 | Installer- und Weiterleitungsseite bauten schon vor Abschluss der Konfigurationslesung Ziele mit Port 8188. TLS-Information ging über die reine Port-Rückgabe verloren. | Beide Seiten warten auf `resolveRuntimeBaseUrl`. Bis dahin bleiben ihre Aktionen gesperrt. Lesefehler liefern kein geratenes Ziel. Verspätete Resultate und geplante Fensterwechsel nach dem Aushängen werden verworfen. |
| UI38-N04 | `admin/license.html` übernahm das Schema des Adminfensters und nutzte bei fehlender Konfiguration einen Port-Fallback. | Die alte Einstiegsdatei zeigt einen festen relativen Link zum geschützten Installer mit kanonischer Instanz. Dort wird „Lizenz“ gewählt. Sie fragt keine Runtime ab und nimmt keine Zieladresse oder Portvorgabe aus der Query an. |

Der letzte Einstieg verwendet bewusst `#/installer`: Der vorhandene frühe
Lizenz-Deep-Link im React-HTML führt `#/license` nach `admin/license.html` zurück.
Ein Rückverweis auf denselben Lizenz-Hash würde eine Schleife erzeugen.

`secure` muss im bestätigten Instanzobjekt ein Boolean sein; ein fehlendes Feld
behält das bisherige HTTP-Default. Ungültige Werte werden abgewiesen. Der
Standardport gilt weiterhin nur bei einem vorhandenen gültigen Instanzobjekt
ohne Portfeld, niemals als Ersatz für eine fehlgeschlagene Zielermittlung.

## Erhaltene Sicherheits- und Funktionsgrenzen

Die Änderung erteilt keine neuen Rollen oder Capabilities und verändert keine
Gerätewerte. Passwort- und andere Schreibaufrufe dürfen weiterhin nur an den
eigenen Ursprung gehen. Die richtige HTTPS-Adresse einer anderen Portinstanz
ist keine Freigabe für portübergreifende Authentifizierung. CSRF-Prüfung,
Fristen, Antwortgrenzen, unbekannte HTTPS-Kontexte und Instanzbindung bleiben
wirksam. Ein fremder Admin-Origin benötigt den vorgesehenen sicheren Einstieg;
es gibt keinen automatischen Protokoll- oder Passwort-Fallback.

Die Installer-Navigation behält alle bisherigen Bereiche und die Trennung
zwischen Installateur und Administrator. Die eigentlichen EMS-Einstiege laufen
weiter über EMS Apps. Alle sieben direkten React-Fachpfade behalten unter
HTTP und HTTPS ihren tatsächlich aufgerufenen Ursprung. `admin/tab.html` und
`admin/appcenter.html` erhalten bei ihrer vorhandenen relativen Weiterleitung
Schema, Host, Port, Admin-Präfix und Instanz; sie wurden nicht geändert.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis | Umfang |
| --- | --- | --- |
| `node scripts/verify-admin-runtime-transport.cjs` | 33 Gruppen PASS | Tatsächliche TypeScript-Quelle in VM, synthetische HTTP-/Adminantworten; TLS-Ziel, ungültige Konfiguration, direkte HTTPS-Routen, erhaltene Cross-Origin-/CSRF-Sperren, HTML-Startup und sicherer Lizenz-Einstieg. |
| `node scripts/verify-admin-react-proxy-paths.cjs` | 25 Gruppen PASS | Tatsächliche TSX-Funktionen im DOM-/Hook-Host; alle bestätigten Installer-Ziele, Proxy und HTTPS, keine vorläufigen Portziele, Fehler, verspätete Resultate und Timerabbau. |
| `node test/frontend-ems-navigation.cjs` | 6 Gruppen PASS | Tatsächlicher React-Serverrenderer; Rollen-/Aktionssichtbarkeit, gesperrte Anfangsaktionen, EMS-Sammeleinstieg, M0-Link und eingebettete Darstellung. |
| `./node_modules/.bin/tsc --noEmit -p src-admin-tab/tsconfig.json` | PASS | Strikte Prüfung der gesamten Adminquelle ohne Buildausgabe. |

Die ursprüngliche SSR-Fixture wurde an den tatsächlichen neuen Anfangszustand
angepasst: Ohne bestätigtes Ziel öffnet kein Handler eine Seite. Die positiven
Zielprüfungen aller sieben Admin-Aktionen sind in der zustandsfähigen
React-Routing-Suite enthalten. Bestehende Transport-Negativprüfungen wurden
nicht entfernt.

Kein Browser, kein echter Admin-Proxy und keine installierte Telefon-/Tablet-App
wurden in diesem Arbeitsschritt ausgeführt. Es wurden keine generierten
Runtime-Dateien oder Admin-Bundles gebaut. Deren Synchronisierung und der
abschließende Paketlauf gehören zum gemeinsamen Integrationsschritt.

## Lesender Vergleich der vorhandenen Web-App

Verglichen wurden die bereitgestellte Basis 1.0.36, der übergebene Stand 1.0.37
und die bestehenden PWA-Ressourcen des 1.0.38-Arbeitsstands:

- `name` und `short_name`: jeweils `NexoWatt EOS`.
- `start_url`: jeweils `.`, `scope`: jeweils `./`, `display`: jeweils `standalone`.
- Hintergrund- und Themefarbe: jeweils `#0c0f12`.
- Alle sechs vorhandenen Manifest-Iconeinträge stimmen überein.
- Alle sechs zugehörigen PNGs, `www/apple-touch-icon.png` und
  `www/nexowatt-logo.png` sind über die drei Stände byteidentisch.

Damit ist in diesen Dateien kein Wechsel der bisherigen App-Identität oder
Icons belegt. 1.0.37 änderte den Service Worker von v524 auf v525 und entfernte
private Offline-Shells zugunsten der verpflichtenden Sitzungsprüfung. Diese
Sicherheitsgrenze wird nicht rückgängig gemacht. Die gemeinsame
1.0.38-PWA-Korrektur einschließlich v526 ist ein eigener Arbeitsschritt.

Die konkrete installierte App bleibt auf dem Zielgerät zu prüfen: tatsächliche
Startadresse, Schema, Host, Port, Zertifikatsvertrauen und Sitzung. Die
Wiederherstellung von HTTPS unter derselben Adresse ist getrennt von einem
Wechsel auf einen anderen Browserursprung zu betrachten. Dieser Vergleich
bestätigt keine automatische Übertragung einer vorhandenen Installation auf
eine andere Adresse und keine bereits erfolgte Geräteabnahme.

## Bindung an den geprüften Quellstand

| Datei | SHA-256 |
| --- | --- |
| `src-admin-tab/src/lib/adminConnection.ts` | `7eb631d0025cdfc9cdf08968d4e5ac93e1aad577c35976114cd9d526dc7fd7ac` |
| `src-admin-tab/src/pages/InstallerPage.tsx` | `01310ba014c5db71c3648b26e5ae84e0099848d20c8d0617fe8ed2ee90441245` |
| `src-admin-tab/src/pages/RedirectPage.tsx` | `7d47890d30f17f2a820d8f7025e980df11896400eb562dbafe3413df4738f062` |
| `admin/license.html` | `390210acd06a4d82535eb28f70e1112b8d8b1004a6f07818b7cc82e2e5bf8b47` |
| `www/ems-apps.html` | `2679b07eae367104113535a5d372d7b0241c4d5e9e77bfad3ae1ed8282f2f4af` |
| `www/simulation.html` | `f7a0da53cffd0fdbc14fa2d0d87dab4e51a361404b150c35e8d35402ac73d0c3` |
| `scripts/verify-admin-runtime-transport.cjs` | `58370fe3b391a678772ec0f0847e6c1ca3b1beb7e775b44fca6aec37bc698dab` |
| `scripts/verify-admin-react-proxy-paths.cjs` | `14a473718988ce51d1b0e02686c8f62411ac6f682dc59cca280f2fe3ade58952` |
| `test/frontend-ems-navigation.cjs` | `de583558202705635d110da62ad335b74250f0a8680aeb04da29d571d8d06e3e` |

<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
