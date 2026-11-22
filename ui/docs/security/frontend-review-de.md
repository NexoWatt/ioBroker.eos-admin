# Frontend-Sicherheitsprüfung – 1.0.22

Prüfbasis: vollständiges NexoWatt-UI-Repository 1.0.21, übergeben am
29.09.2026; Änderungen im Sicherheits-Prüfstand 1.0.22. Maßgeblich sind die
kanonischen Quellen unter `src-ts/runtime-executables/www/` sowie
`src-admin-tab/index.html`. Die Hashbindung erfolgt im Liefermanifest des
Gesamtpakets. Verantwortlichkeit für weitere Freigabe: NexoWatt Entwicklung.

Dies ist eine gezielte Code- und Regressionstestprüfung. Sie ist weder ein
vollständiger ASVS-Nachweis noch eine unabhängige Sicherheitszertifizierung.

## Befunde und Änderungen

| Kennung | Komponente / Befund in 1.0.21 | Angriffsbedingung und Wirkung | Änderung und Nachprüfung |
| --- | --- | --- | --- |
| UI-CRA-FE-01 | History, Logikeditor und SmartHome-Konfiguration: konfigurierbare Texte wurden ohne HTML-Maskierung in `innerHTML` übernommen. Logik-Parameter lagen auch in `value`-Attributen. | Ein Angreifer muss kontrollierte Namen, Graph-/Szenendaten oder Konfigurations-/Importinhalte in die entsprechenden Datenpfade bringen. Ein späterer Aufruf kann Code mit der Browsersitzung des Betrachters ausführen. Ein anonymer Schreibzugriff ist durch diese Prüfung nicht belegt. Priorität hoch. | History-Karten und Tooltips, Logik-Bausteinname/Parameter/Szenen/Fehlertexte sowie SmartHome-Seitenliste/DP-Fehlertexte werden passend für Text bzw. doppelt zitierte Attribute maskiert. Original-Renderer mit HTML- und Attribut-Payloads geprüft. Im getesteten Umfang behoben. |
| UI-CRA-FE-02 | SmartHome: beliebige Schemas für Widgets, Kameras und Navigationsseiten; Iframe mit `allow-scripts` und `allow-same-origin`. | Manipulierte gespeicherte Widget-/Seiten-URL kann beim Rendern oder Anklicken ein ausführbares Schema erreichen. Bei originidentischem Iframe-Inhalt sind zusammen mit Skriptrechten Zugriffe auf die Elternseite möglich. Voraussetzung ist Kontrolle des betreffenden Konfigurationswertes/Inhalts. Priorität hoch. | Alle betroffenen Browser-Sinks verwenden HTTP(S)-Prüfung, lehnen Steuerzeichen, eingebettete Zugangsdaten und andere Schemas ab. Relative lokale Links bleiben nutzbar. Iframes erhalten keine Same-Origin-Freigabe. Kamerabilder/Playercover senden keinen Referrer. Positiv- und Negativfälle geprüft; Iframe-Policy als Quellvertrag geprüft. |
| UI-CRA-FE-03 | Service Worker: `.json` wurde vor `/api/` geprüft und Antwort unabhängig von Cache-Control gespeichert; API-Offlinepfad durfte Cache lesen. | Autorisierte JSON-Nachweise konnten im Browsercache liegen und bei Netzwerkausfall ohne erneute Serverprüfung erscheinen, z. B. nach Sitzungswechsel. Voraussetzung: aktivierter Service Worker und vorheriger Abruf. Priorität hoch für vertrauliche Berichte. | API-Routen haben Vorrang vor Endungen, werden mit `no-store` abgerufen und liefern offline 503 ohne Cachezugriff. Keine Speicherung von Fehlerantworten, Redirects, `private` oder `no-store`. Fremdorigins werden nicht verarbeitet. Cache v520 entfernt ältere EOS-Caches beim Aktivieren. Fetch-/Cache-Verhalten mit Originalhandler geprüft. |
| UI-CRA-FE-04 | React-Admin-Einstieg im Devbetrieb auf Port 5173/3000: Queryparameter `host`/`port` bestimmten die nachgeladene Socket.IO-Skriptquelle. | Präparierter Link an jemanden mit geöffneter Entwicklungsoberfläche kann fremdes JavaScript im Admin-Frontend laden. Produktionsport außerhalb 5173/3000 ist von diesem Pfad nicht betroffen. Priorität mittel. | Dev-Socket.IO kommt ausschließlich vom aktuellen Host auf Port 8081. Queryparameter können die Quelle nicht mehr ändern; Loader mit manipulierten Parametern ausgeführt. |
| UI-CRA-FE-05 | Stationsdisplay-Token: nur acht Alphabetzeichen (etwa 40 Bit), mit `Math.random` als Ersatz bei Crypto-Ausfall. | Display-URLs sind Bearer-Zugänge für freigegebene Stationsaktionen. Kurze oder vorhersehbare Tokens reduzieren den Schutz gegen Raten; ein erfolgreicher Brute-Force-Angriff wurde nicht ausgeführt. Priorität hoch wegen möglicher Bedienaktionen. | Neue Tokens nutzen 16 `crypto.getRandomValues`-Bytes (128 Bit), formatiert als `ST-` und 32 Hex-Zeichen. Ohne sicheren Zufall wird abgebrochen. Bestehende Tokens bleiben erhalten, bekommen aber im alten Format einen Hinweis zur Erneuerung. Positivtest mit exakt 16 RNG-Bytes, Formatprüfung und Fail-closed-Test ohne Crypto bestanden. Altanlagen-Rotation bleibt offen. |

Die Kennungen gelten für diese Frontendprüfung. Sie ersetzen keine bestehenden
plattformweiten F01–F08-Befunde und enthalten keine CVE-Zuordnung.

## Tatsächlich durchgeführte Prüfungen

| Test | Befehl / Umfang | Ergebnis |
| --- | --- | --- |
| FE-REG-01 | `node scripts/verify-cra-frontend.cjs` | 42 bestandene Regressionen mit aus den Originalquellen extrahierten Funktionen sowie dem vollständigen originalen Service-Worker-Fetchhandler. DOM, Netzwerk und Cache werden kontrolliert simuliert. |
| FE-BROWSER-01 | `CHROMIUM_BIN=<Chromium-Pfad> node scripts/verify-cra-frontend.cjs --browser` | Bestanden mit Chromium 153.0.8010.0: zuvor erzeugte Original-Renderer-Ausgaben in echtem DOM ohne eingeschleuste Bilder/Handler. Der erste Start ohne Browserdatei war nicht ausführbar; nach Bereitstellung eines isolierten Testbrowsers erfolgreich wiederholt. Kein vollständiger UI- oder Service-Worker-Lebenszyklustest. |
| FE-REVIEW-01 | Statische Suche nach DOM-Sinks, URL-Nutzung, Browser-Speicherung und React-Auth-Gates, danach Datenflussprüfung der beschriebenen Befunde | Obige Befunde reproduzierbar aus dem Quellcode eingegrenzt und korrigiert. Keine Aussage, dass alle übrigen Sinks oder alle Betriebswege fehlerfrei sind. |

Rohbelege: `reports/security/frontend-regression.log` und
`reports/security/frontend-browser-regression.log`. Laufzeit und Zeitpunkt:
`reports/security/frontend-environment.json`. Das Testskript meldet fehlende
Originalfunktionen bzw. geänderte Sink-Verträge als Fehler. Bestehende
System-, Build- und Releaseprüfungen bleiben erforderlich und werden im
Gesamtprüfbericht gesondert nachgewiesen.

## Betrieb und verbleibende Prüfungen

- Für Widgets mit eigener Anmeldung oder originabhängigen Browserfunktionen
  kann das entfernte `allow-same-origin` einen Unterschied machen. Solche
  Geräteoberflächen über die vorhandene Schaltfläche „Öffnen“ separat nutzen
  und die benötigten Integrationen vor Einsatz prüfen. Keine erneute gemeinsame
  Freigabe von Skripten und EOS-Origin ohne erneute Sicherheitsbewertung.
- URLs mit `benutzer:passwort@host` werden nicht mehr verwendet. Geheimnisse
  gehören nicht in sichtbare Konfigurationslinks. Bestehende Kameraintegration
  gegebenenfalls auf herstellereigene Anmeldung bzw. geeigneten lokalen Proxy
  umstellen. Der Patch richtet keinen Proxy und keine Cloudverbindung ein.
- HTTP bleibt zur Kompatibilität lokaler Geräte möglich; diese Browserprüfung
  verschlüsselt die Geräteverbindung nicht. Netzsegmentierung und TLS bleiben
  Teil des Betriebs- und Systemnachweises.
- Der neue Service Worker muss aktiviert werden, damit v519-Altcaches entfernt
  sind. Aktualisierung, erneutes Laden, Abmeldung und Offlinezugriff sind in
  einem echten Browser zusätzlich zu prüfen. Ein beliebiges bereits
  kompromittiertes Browserprofil wird durch diesen Patch nicht bereinigt.
- UI-Rollenprüfungen sind keine Berechtigungsgrenze. Backendprüfung,
  Rechtewiderruf und alle Schreibpfade müssen separat nachgewiesen bleiben.
  Im gesichteten Code speichern die Auth-Oberflächen Benutzername und
  Darstellungspräferenzen, keine Sitzungspasswörter; alte Lizenzschlüssel werden
  bereits aus Browser-Speichern entfernt. Das ist keine vollständige
  Geheimnisinventur des Gesamtsystems.
- Bestehende Stationsdisplay-Tokens werden nicht automatisch ersetzt. Vor
  Freigabe in den Stationsdisplay-Einstellungen „Neu erzeugen“ verwenden,
  speichern und den neuen Link auf dem Display hinterlegen. Alte gespeicherte
  Links dürfen danach keinen Zugang mehr gewähren; dies ist auf der Anlage
  nachzuprüfen. Tokenlänge allein beweist bei manuell eingegebenen Werten keine
  Entropie. Die UI erzeugt die neuen Werte kryptografisch zufällig. Serverseitige
  Prüfung, Zustandsfilterung und Stationsrechte werden separat dokumentiert.
- Der Dev-Socket.IO-Loader erwartet jetzt Port 8081 desselben Hosts. Abweichende
  Entwicklungsports benötigen eine bewusst konfigurierte lokale
  Entwicklungsumgebung; frei wählbare URL-Parameter sind kein Ersatz.

Keine Hardware-Regelung und kein Gerätesollwert wurden durch diese
Frontendänderungen verändert. Eine Produktionsfreigabe wird hier nicht erteilt.


## Nachtrag: React Router 6 → 7.18.4

Die Admin-Abhängigkeit `react-router-dom` wurde im Manifest exakt auf `7.18.4`
fixiert; das Lockfile und der tatsächliche Admin-Build wurden aktualisiert.
`@remix-run/router` wird durch den neuen Abhängigkeitsbaum nicht mehr benötigt.
Es wurden keine Routen, Rollenanforderungen oder Laufzeit-APIs umgebaut.

Grund sind die Hersteller-Advisories
[GHSA-wrjc-x8rr-h8h6](https://github.com/remix-run/react-router/security/advisories/GHSA-wrjc-x8rr-h8h6)
und
[GHSA-337j-9hxr-rhxg](https://github.com/remix-run/react-router/security/advisories/GHSA-337j-9hxr-rhxg).
Beide nennen eine Korrektur ab 7.18.0. Das zweite Advisory schließt den hier
verwendeten deklarativen Modus ausdrücklich aus. Für das erste wurde in der
Admin-Anwendung kein Datenfluss fremdgesteuerter Werte zu Router-Linkzielen
festgestellt: die geprüften Ziele sind konstant. Trotzdem wird der im
Abhängigkeitsbaum betroffene Versionsstand ersetzt; dies ist kein behaupteter
Nachweis eines zuvor ausnutzbaren Produktangriffs.

Die offizielle, versionierte
[Migrationsanleitung für 7.18.4](https://reactrouter.com/7.18.4/upgrading/v6)
wurde am 29.09.2026 mit dem konkreten Quellcode abgeglichen:

| Migrationspunkt | Anwendung auf dieses Admin-Frontend |
| --- | --- |
| Node ≥20 und React/React-DOM ≥18 | Erfüllt: Paketbetrieb fordert Node ≥22, vorhandene React-Version 18.3.1. |
| Geänderte relative Auflösung bei mehrsegmentigen Splat-Routen | Keine solchen Routen. Nur feste Pfade und ein einzelnes `*` mit fester Weiterleitung `/installer`. |
| Transition-Verhalten / komponentenlokales `React.lazy` | Kein `React.lazy` oder entsprechende Suspense-Nutzung im App-Router. |
| Fetcher-, Formular-, Hydration- und Action-Revalidierungsänderungen | Kein Data-/Framework-Router, keine Router-Loader/Actions und kein Produkt-SSR. |
| Paketimporte | Bestehende `react-router-dom`-Importe bleiben über das v7-Kompatibilitätspaket funktionsfähig; keine v8-Migration. |

`node scripts/verify-cra-admin-router.cjs` bestand **36 Fälle** mit dem
installierten Router 7.18.4: tatsächliche HashRouter-/Route-Komponenten,
Original-TSX-Routen, Erstrender mit gesperrten sensiblen Kindkomponenten,
konstante Fallbacknavigation und Original-Auth-Gate mit kontrollierten
Hookzuständen für Admin, Installer, User, fehlende Sitzung und deaktivierte
Authentifizierung. Der Node-Renderer wird ausschließlich im Test eingesetzt;
das Produkt erhält dadurch keine SSR-Funktion. Die Hookzustandssimulation
ersetzt keinen echten Browser-Anmelde-/Widerrufstest.

`npm run admin:build` bestand mit Vite 7.3.6 und erzeugte die aktualisierten
Assets `index-B57EouZG.js` und `index-guFGGMRU.css`. Nachweise:
`reports/security/admin-router-regression.log`,
`reports/security/admin-router-build.log` und
`release-manifests/admin-bundle-components.json`. Audit und finale SBOM werden
nach diesem Build im Lieferkettenbericht aktualisiert.
