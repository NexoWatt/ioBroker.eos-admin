# Frontend-Anmeldung 1.0.37 – Änderungs- und Prüfvermerk

Stand: 19.11.2026. Umfang: geänderte Login-/Auth-Oberflächen, Konfiguration und
optionaler EOS-dev9-Einstieg. Serverseitige Authentifizierungs- und
Releaseprüfungen stehen im übergeordneten Prüfbericht.

## Änderung und Sicherheitswirkung

Das ausdrücklich gewählte Profil trennt eigenständigen ioBroker-Login und
zentrale EOS-Sitzung. Die neue Loginseite bietet im EOS-Profil nur den
zentralen Einstieg; eigenständig verwendet sie das vorhandene ioBroker-Konto.
Passwörter werden nicht in Local Storage oder Konfiguration abgelegt.
Passwortmanager und Einfügen bleiben möglich. Kunden erhalten die UI;
technische Einstiege bleiben an bestätigte Rollen und Fähigkeiten gebunden.
Es werden keine Standardzugänge oder Gruppenrechte automatisch eingerichtet.

Die UI bleibt bis zur bestätigten, konfigurierten Serversitzung gesperrt.
Fehlende Profile/CSRF-Tokens, Offlinebetrieb, BFCache-Wiederaufnahme und ein
unbekannter Sitzungszustand entsperren sie nicht. Der CSRF-Header geht nur an
eigene gleichursprüngliche Mutationen; fremde Kameraziele erhalten ihn nicht.
Nach einer Anmeldung werden Schreibvorgänge nicht automatisch wiederholt.
Logout hält die lokale Oberfläche bis zur neuen bestätigten Anmeldung gesperrt.

Die eingebettete React-Admin-Oberfläche verweist auf den vorgesehenen
Anmeldeeinstieg und prüft nach Rückkehr erneut; sie enthält keine eigene
Passwortmaske mehr. Der Lifecycle-Guard verhindert nach asynchroner
Logout-Zielauflösung verspätete State-Änderungen an ausgehängten Komponenten.
Die tatsächlichen React-/HTTP-Regressionsfälle laufen in den bestehenden
Suiten des Gesamtstands.

## Ausgeführte lokale Prüfungen

| Prüfung | Ergebnis und Aussagegrenze |
| --- | --- |
| Isolierter strikter TypeScript-Lauf für `runtime-base.ts`, `auth.ts`, `login.ts` | PASS mit `--noEmit --strict --skipLibCheck --target ES2022 --module none --lib ES2022,DOM --moduleResolution node`. Zusätzlich wurde der dauerhafte Projekt-Gate `tsconfig.ui-auth-frontend.json` eingerichtet. |
| `tsc --noEmit -p src-admin-tab/tsconfig.json` | PASS im bearbeiteten Admin-Frontend; der finale Stand wird im Gesamt-Gate geprüft. |
| `node scripts/verify-auth-profiles-ui.cjs --report` | Acht Gruppen PASS: transpiliertes Frontend mit DOM-/HTTP-Doubles, Sperren, CSRF-Grenzen, 403-Verhalten, Offline/BFCache, EOS-Logout, Passwortmaskenbegrenzung, einmalige unveränderte Passwortübermittlung und sichere Rücksprünge. |
| `node scripts/verify-eos-dev9-ui-integration.cjs --report` | Acht Gruppen PASS: tatsächliche gepatchte Rollenfunktionen, Hashes, Sicherungen, Instanzen, Symlinks, Zwischenänderung und begrenzter Proxyvertrag; keine Live-Anwendung. |

`ui-contract-evidence.json` und `eos-integration-evidence.json` enthalten die
geprüften Datei-Hashes, Laufzeit und Einzelgruppen. Standardaufrufe verändern
diese Belege nicht. Laufzeit: Node.js 24.22.3, TypeScript 5.8.3. Testpasswörter
und Sitzungstokens werden nicht in den Belegen ausgegeben.

## Browserprüfung: nicht ausgeführt

`scripts/verify-auth-profiles-browser.cjs` verwendet kontrollierte
Fixture-Antworten. Der Start mit Playwrights Standardbrowser scheiterte am
fehlenden Browser-Binary. Der Versuch mit vorhandenem `/usr/bin/chromium`
scheiterte vor dem ersten Test an einer Umgebungsbeschränkung
(`socket(): Operation not permitted`, Process-Singleton/ptrace). Es wurde kein
Browser installiert und keine Beschränkung umgangen. Es liegen keine
bestandenen Browserfälle oder erzeugten Layout-Screenshots aus diesem Lauf vor.

Die Versuche waren:

```sh
node scripts/verify-auth-profiles-browser.cjs
NW_BROWSER_EXECUTABLE=/usr/bin/chromium node scripts/verify-auth-profiles-browser.cjs
```

DOM-Doubles und TypeScript sind kein Ersatz für Browser-, TLS-, Proxy- und
Betriebsabnahme. Keine realen Konten wurden geändert, kein Login an einer
Kundenanlage ausgeführt und kein Gerät geschaltet. Die konfigurierte
Proxyverbindung sowie bestehende zentrale Erstpasswort-/MFA-Verfahren bleiben
betriebliche Integrationspunkte. Eine allgemeine Produktivfreigabe oder
Konformität wird aus diesen Prüfungen nicht abgeleitet.
