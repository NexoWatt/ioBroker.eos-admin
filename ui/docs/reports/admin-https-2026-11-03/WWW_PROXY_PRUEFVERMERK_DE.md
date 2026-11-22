# WWW-Frontend unter dem Admin-HTTPS-Proxy

Stand: 2026-11-03. Änderungsbasis: NexoWatt UI 1.0.34; Zielartefakt: 1.0.35.

Der Admin-Proxy entfernt vor der Weiterleitung den Instanzpfad. Die bisherigen WWW-Seiten verwendeten zahlreiche absolute URLs wie `/api/auth/me`, `/static/app.js` und `/events`. Ohne Anpassung landen diese am Admin-Ursprung außerhalb des EOS-Proxys. Der Patch hält API, Ressourcen, Navigation und Ereignisverbindungen im geprüften Instanzpfad. Die vorhandenen serverseitigen Authentifizierungs-, Gruppen-, Capability- und Lizenzprüfungen bleiben zuständig.

## Änderung und Sicherheitsgrenzen

Die neue kanonische Quelle `src-ts/runtime-executables/www/runtime-base.ts` stellt das eingefrorene Objekt `window.NW_RUNTIME` bereit. Der Backend-HTML-Sender fügt ihren lokalen Scriptpfad vor den Anwendungsskripten ein. Der direkte Runtime-Aufruf lädt diesen Bootstrap nicht; die angepassten Aufrufstellen behalten dort über ihren Fallback das bisherige Verhalten.

Der Kontext stammt aus dem eigenen Browserpfad. Er erlaubt höchstens 16 Public-Path-Segmente, jedes maximal 128 Zeichen aus `A–Z`, `a–z`, `0–9`, `.`, `_`, `~`, `-`; vollständige Punktsegmente, leere Segmente, Backslashes und Prozentkodierung sind ausgeschlossen. Der Proxypräfix ist höchstens 256 Zeichen lang und enthält eine kanonische Instanznummer von 0 bis 999999. Wiederholte kanonische Proxy-Instanzmarker werden als mehrdeutig abgewiesen. Queryparameter dürfen weder Host noch Proxyziel bestimmen.

`url()` erweitert ausschließlich bekannte gleichursprüngliche HTTP(S)-Runtimepfade. Bereits präfixierte Pfade, fremde Ursprünge einschließlich abweichender Ports/Protokolle, benutzerbezogene URL-Authorities, Protokoll-relativ-URLs, `blob:` und `data:` bleiben unverändert. Der Wrapper erteilt keine Zugriffsrechte und fügt keine Zugangsdaten hinzu. Er erhält `Request`, Body, Header, Methode, Credentials-Option, Abbruchsignal und explizite `fetch`-Init-Optionen. Das normale Verhalten eines bereits verbrauchten Requests wird nicht umgangen.

Die URL-Anpassung erfolgt an eigenen Aufrufstellen und über einen frühen Fetch-Wrapper. Es gibt keine Änderung von DOM-/Location-Prototypen, keine Laufzeit-Umschreibung beliebigen JavaScripts und keinen MutationObserver als Voraussetzung. Die sieben vorhandenen EventSource-Konstruktoren erhalten den expliziten präfixierten Pfad. Die Bestandsaufnahme fand keine WebSocket- oder XMLHttpRequest-Konstruktoren in diesen WWW-Skripten.

Die Rücklinks in Auth-Dialog, Admin-Guard, Lizenzseite, EMS-Appcenter und Einstellungen verwenden im Proxybetrieb denselben TLS-Ursprung, den tatsächlichen Admin-Public-Path und die aus dem Pfad validierte Instanz. Die drei Konstruktoren für eingebettete React-Apps übernehmen diese Instanz. Somit können `instance`-/`adminUrl`-Queryparameter im Proxybetrieb weder einen fremden Rückweg noch eine andere eingebettete Instanz erzwingen.

Fünf bestehende HTML-Service-Worker-Registrierungen sind im Proxybetrieb ausgesetzt. Der bisherige Worker ist für den separaten Runtime-Ursprung geschrieben und darf keinen gemeinsamen Admin-Ursprung kontrollieren. Eine absolute CSS-Logo-URL wurde in `www/styles.css` durch die relativ zum Stylesheet identische URL ersetzt. Die SW-Cacheversionsänderung wird separat im Hauptänderungsnachweis geführt.

## Umfang und Nachweise

Die Bestandsaufnahme erfasste 20 WWW-HTML-Dateien, 120 Fetch-Aufrufstellen und sieben EventSource-Konstruktoren. Der gemeinsame Bootstrap erreicht auch `index.html`, das zuvor keinen frühen Auth-Bootstrap hatte. Der Backend-Sender passt die HTML-Ressourcenattribute an; neun HTML-Dateien enthalten zusätzlich explizite Navigations-/Worker-Anpassungen. 23 bestehende kanonische WWW-TS-Dateien sowie der neue Bootstrap wurden für die Frontendpfade angepasst. Fünf manuell typisierte Spiegel (`app`, `history`, `smarthome`, `smarthome-config`, `ems-apps`) wurden fachlich entsprechend ergänzt, ohne ihre Typverträge durch generierte Rohkopien zu ersetzen. Ihre Original-Hashes werden erst nach der zentralen Runtime-Erzeugung aktualisiert.

| Prüfung | Ergebnis und Grenze |
| --- | --- |
| `node scripts/verify-runtime-base.cjs` | 19 Prüfgruppen bestanden; kompiliert die tatsächliche Bootstrap-TS-Quelle zuerst streng und prüft das ausgegebene JavaScript sämtlicher WWW-TS-Quellen mit dem nativen JS-Parser. |
| Präfixe und Ziele | Direkter Betrieb, Root-/verschachtelte Mounts, Sonderzeichen, Längen-/Instanzgrenzen, fremde Hosts/Ports/Protokolle, Query-Manipulation und bereits präfixierte URLs geprüft. |
| Native Request-Semantik | String, URL, Request, POST-Body, Header, Methode, Credentials-Option, Init-Override und tatsächliche Abort-Signal-Weitergabe geprüft. |
| Navigation | Echte Quellfunktionen für vier Admin-Rückwege ausgeführt; tatsächlicher Präfix/Instanz gewinnt gegen abweichende Queryparameter. |
| EventSource und Worker | Argumente sämtlicher sieben tatsächlichen EventSource-Aufrufstellen ausgeführt; alle fünf Worker-Registrierungen auf Proxy-Ausschluss geprüft. |
| ESLint für neuen Bootstrap | Keine Fehler, Warnungen, Inline-Ausnahmen oder zusätzliche `any`-/No-Check-Unterdrückung. |
| Browser und Release | Separater integrativer Lauf mit TLS, originalem Admin-8.3.5-Proxy und tatsächlichem EOS-Runtime-Harness durch den Hauptprüflauf. Dieser Vermerk allein behauptet kein Ergebnis dieses Laufs und keine Prüfung der Kundenanlage. |

Reproduzierbare Prüfdateien: `scripts/verify-runtime-base.cjs`, `tsconfig.runtime-base.json`. Rohbelege: `runtime-base-tests.log`, `runtime-base-eslint.json`. `www-proxy-changed-sources.json` enthält SHA-256 der hier angepassten kanonischen WWW-TS-/HTML-/CSS-Dateien gegenüber 1.0.34; generierte Laufzeitdateien und separat verantwortete SW-Version sind aus dieser Liste ausgenommen.

## CRA-Einordnung

Der Patch unterstützt die nachvollziehbare Transport- und Berechtigungsgrenze: Zugangsdaten werden nicht als Proxykonfiguration abgelegt, Fehler öffnen keine geschützte Seite und Frontend-Präfixe sind keine Identitätsnachweise. Quelländerungen, strenge Typprüfung, negative Tests und Artefaktprüfung werden dokumentiert. Diese Entwicklungsnachweise sind weder eine vollständige CRA-Konformitätsbewertung noch eine Herstellerfreigabe. Die abschließende Freigabe, SBOM, Paket-/Artefaktprüfung und End-to-End-Ergebnisse gehören zum gemeinsamen Release-Nachweis.

## Unabhängiger Review und Nachkorrektur

Der unabhängige Quellreview fand eine fehlende Gruppierung zwischen `??` und `||` am Admin-Link sowie zwei fachfremde URL-Wrapper auf `state.action` in der NexoLogic-Simulation. Die Gruppierung wurde in kanonischer Quelle und manuellem App-Spiegel berichtigt; die beiden Simulationszuweisungen wurden exakt auf ihr bisheriges Verhalten zurückgesetzt. Der zusätzliche Syntaxlauf kompiliert und parst jetzt sämtliche kanonischen WWW-TS-Dateien, damit auch von Legacy-No-Check übersehene JS-Grammatikfehler blockieren.

## Globale Typintegration

Die umfassende Typprüfung deckte auf, dass lokale `Window`-Interfaces bei Modulprüfung nicht auf andere WWW-Quellen wirken. `src-ts/types/browser-runtime.d.ts` stellt deshalb den gemeinsamen globalen Bootstrap-Vertrag auch für strikte Fachfrontends und die manuell typisierten Spiegel bereit. Der Bootstrap selbst und sämtliche Runtime-JavaScript-Dateien bleiben durch diese Typkorrektur bytegleich. Die eng begrenzten Konfigurationen für Runtime-Bootstrap und Ladepunkt-Dashboard sowie die Runtime-Erzeugung nehmen die Deklaration ausdrücklich auf. Es wurde kein Runtime-Exportmarker und keine Typ-Unterdrückung hinzugefügt.

`npm run typecheck`, `npm run typecheck:runtime-mirrors`, die isolierte Dashboard-Typprüfung und die 19 Runtime-Prüfgruppen sind bestanden. Die Rohlogs heißen `runtime-global-typecheck.log`, `runtime-global-mirrors-typecheck.log`, `runtime-dashboard-typecheck.log` und `runtime-base-tests.log`. Die Typdatei-/Konfigurationshashes stehen in `runtime-global-type-files.json`.
