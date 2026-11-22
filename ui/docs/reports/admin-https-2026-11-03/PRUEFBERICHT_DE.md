<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# NexoWatt UI 1.0.35 – HTTPS-Adminzugang und EOS-Anmeldung

Stand: 03.11.2026. Anlass: Der Nutzer meldet im Admin 8.3.5 sowohl beim Sitzungsstatus als auch beim Anmelden „signal is aborted without reason“ und bestätigt den Zugriff über HTTPS. Der Benutzername „nexowatt“ und ein verdecktes Passwort wurden eingegeben. Aus den Bildern lässt sich weder die Richtigkeit des Passworts noch die konkrete Server-/Proxykonfiguration ableiten. Die abgebrochene Anfrage ist kein Nachweis eines falschen Passworts.

## Ausgangspunkt und Ergebnis

Basis ist ausschließlich das vollständige Archiv `NexoWatt_UI_1.0.34_BENUTZER_GRUPPENRECHTE_FULL_REPOSITORY.zip`, SHA-256 `22e0624cd470b0c730ffa1c7253dcd225541328330d947c81d892148b2cf451b`. Dieser Stand enthält die Folgeschritte auf 1.0.33, 1.0.32 und der ausdrücklich verlangten Ausgangsbasis 1.0.31. Die vorhandenen Partneranbindungen, die eigenständige Arbitrage-App, die zugehörigen Schutzgrenzen und deren weiterhin offenen Anlagenabnahmen werden mitgeführt. Es wurde keine ältere Repositoryversion als Ersatz eingesetzt.

1.0.35 korrigiert den browserseitigen Verbindungsweg: Ein HTTPS-Admin-Tab verwendet den offiziellen Instanzproxy von ioBroker-Admin ab 8.3 auf derselben Origin. Dadurch wird nicht länger das Browserprotokoll pauschal auf einen separaten Port übertragen, auf dem die EOS-Runtime tatsächlich HTTP bereitstellt. Die Anmeldung verwendet ein eindeutig bestimmtes Ziel; Passwörter und schreibende Anfragen werden nicht auf vermuteten anderen Ports erneut ausprobiert.

Die persönliche Anmeldung aus 1.0.33/1.0.34 bleibt erhalten: Jeder lokale ioBroker-Benutzer verwendet sein eigenes bestehendes Passwort. Die vom Controller bestätigte kanonische Konto-ID ist Grundlage für Passwortprüfung, Kontowiderruf, Gruppen, Rolle und EOS-Sitzung. Tatsächliche Gruppenmitgliedschaften bestimmen die EOS-Rechte; weder `admin` noch `installer` als Benutzer-/Anzeigename verleihen zusätzliche Rechte. Dieses Update legt keine Benutzer oder Gruppen an, ändert keine Passwörter und enthält kein zusätzliches Standardkennwort.

Der Quellfehler und die lokalen Reproduktionen erklären die gemeldete Art des Abbruchs. Der erfolgreiche Zugang auf der konkreten Kundeninstallation ist erst durch deren Test bestätigt; eine Liveabnahme wurde hier nicht vorweggenommen.

## Verbindungsweg und getrennte Berechtigungsgrenzen

| Grenze | Umsetzung und Bedeutung |
| --- | --- |
| Browser → Admin | Derselbe HTTPS-Origin und gegebenenfalls derselbe öffentliche Admin-Unterpfad. Kein automatischer Rückfall von HTTPS auf HTTP. |
| Admin → UI-Instanz | Offizieller Opt-in-Vertrag `common.adminTab.proxy: true`; Ziel aus Instanz-/Hostkonfiguration. Der Pfad bindet die ausgewählte Instanz, beispielsweise `/admin/proxy/nexowatt-ui.0/`. |
| Zugang zum Adminproxy | Eine gültige Adminsitzung und Mitgliedschaft in `system.group.administrator` sind eine zusätzliche ioBroker-Admin-Grenze. Eine EOS-Installateurrolle allein genügt hierfür nicht. |
| EOS-Anmeldung | Eigenes lokales ioBroker-Passwort und passende tatsächliche EOS-Gruppen. Die Adminsitzung ersetzt diesen Nachweis nicht. |
| EOS-Fachfunktionen | Bestehende serverseitige Rollen-/Capabilityprüfungen bleiben für jeden geschützten Zugriff maßgeblich. Eine erfolgreiche Browserdarstellung ersetzt sie nicht. |
| Direkter EOS-Zugang | Bleibt für berechtigte Installateure und Kunden ohne ioBroker-Administratorgruppe erhalten. Er muss entsprechend dem vorgesehenen Netz-/HTTPS-Betrieb gesondert abgesichert werden. |

„Admin 8“ allein beschreibt den neuen Transport nicht ausreichend: Die Proxyfunktion wurde offiziell in 8.3 eingeführt und am versionierten Quellstand 8.3.5 abgeglichen. Frühere 8.x-Versionen können diesen Proxy nicht bereitstellen. Die Konfiguration macht Benutzer nicht automatisch zu ioBroker-Administratoren; ihnen wird keine zusätzliche Gruppe zugewiesen.

## Umgesetzte Änderungen und Befunde

| Kennung | Befund bis 1.0.34 | Bearbeitung in 1.0.35 |
| --- | --- | --- |
| NW-AUTH-16 | HTTPS-Admin konstruierte eine HTTPS-Adresse zum HTTP-Laufzeitport. Status und Anmeldung konnten abbrechen. | Same-Origin-Instanzproxy für den HTTPS-Admin; feste, verständliche Fehler für Proxy, Netzwerk und Zeitüberschreitung. |
| NW-AUTH-17 | Trotz gelesener Instanzkonfiguration konnte zuerst der Standardport 8188 verwendet werden. Ein dortiges 401 beendete den Versuch; der `instance`-Queryparameter band das tatsächliche Ziel nicht. | Instanz im Proxy-Pfad beziehungsweise autoritativ ermittelter direkter HTTP-Port; keine Passwort-/Mutationsversuche auf alternativen Ports. |
| NW-AUTH-18 | Ein Status-Netzwerkfehler nach Login wurde als fehlende Rolle ausgegeben. Späte Statusantworten konnten neuere An-/Abmeldungen überschreiben. | Unterschiedene Zustände, Generationen-/Lifecycleprüfungen und gesperrte parallele Prüfungen während Anmeldung/Abmeldung. |

Die Anmeldemaske trägt jetzt den Platzhalter „ioBroker-Benutzername“ und erklärt das eigene Passwort sowie Gruppenrechte. Ein echter EOS-JSON-401 bleibt als falsche Zugangsdaten erkennbar. Ein klassifizierter Admin-Proxy-401 verlangt dagegen eine erneute Admin-Anmeldung. Eine fehlende Proxyberechtigung, eine fehlende Instanzfreigabe und ein unerreichbares Backend werden nicht als falsches EOS-Passwort dargestellt. Antwortinhalte und fremde Netzwerkfehler werden nicht ungeprüft als Diagnose ausgegeben.

Nach erfolgreicher Passwortprüfung bleibt eine nachfolgende Cookie-/Statusbestätigung erforderlich. Wenn sie scheitert, bleiben geschützte Inhalte verborgen. Ein echter Rollenentzug wird weiterhin durch die Backendprüfung wirksam. Die UI verwirft alte Antworten nach neuer Anmeldung, Abmeldung, Unmount oder Routenwechsel. Eine nicht bestätigte Serverabmeldung wird ausdrücklich gemeldet; die lokale Ansicht bleibt gesperrt und Hintergrundpolling öffnet die eventuell noch vorhandene Sitzung nicht selbstständig erneut.

Die lokale Statusabfrage erhält ein endliches Fetch-/Body-Budget von sechs Sekunden, der Login zwölf Sekunden für die getrennten serverseitigen Konto- und Gruppenprüfungen. Diese Fristen betreffen die lokale EOS-Anmeldung, nicht die getrennt begrenzten externen Wetter-/Tarifdienste. Ein Browserabbruch ist kein rückwirkender Abbruch bereits laufender Serververarbeitung. Die UI-Generationen behaupten keinen atomaren Widerruf sämtlicher HTTP-Anfragen oder bereits gesetzter Cookies.

## Durchgängiger Proxy-Unterpfad

Ein erfolgreicher Proxylogin reicht nicht, wenn nachfolgende Fachseiten erneut am Proxy vorbeiführen: Der Adminproxy begrenzt den EOS-Cookiepfad auf seine Instanzroute. Deshalb verwenden die geschützten React-API-Aufrufe, Navigation und vorgesehenen Laufzeitseiten denselben Instanzbereich.

Eigene HTML-Seiten erhalten die lokale frühe Pfadauflösung. Der begrenzte HTML-Sender passt lokale URL-Attribute an und erhält rohe Skript-, Style- und Kommentarinhalte. Gültige eigene Dateien unter `www` beziehungsweise `admin/react` sind auf höchstens 2 MiB und 16 parallele Lesevorgänge begrenzt. Pfad-/Dateitypprüfungen, sichere Fehlerausgabe und die bisherigen Auth-/Lizenzgates bleiben vor beziehungsweise um die Dateiauslieferung bestehen. Externe Links werden nicht zum Proxy umgebogen.

Frontendabrufe, Ereignisströme und Navigation berücksichtigen den geprüften Proxypräfix. Der vorhandene Root-PWA-Serviceworker wird in diesem Betrieb nicht registriert; dadurch wird der Admin-Origin nicht mit einer EOS-Offlineschicht überlagert. Für den direkten Betrieb wird die bestehende PWA-Version fortgeschrieben. Direkte HTTP-Seiten bleiben ein eigener unterstützter Betriebsweg.

Ein Forwarded-Präfix wird nur nach strenger Begrenzung und Bindung an die eigene Instanz für die URL-Darstellung verwendet. Forwarded-Header verleihen weder Identität noch Rolle oder Clientberechtigungen. Der zusätzliche HTTPS-Hinweis darf ausschließlich das `Secure`-Attribut eines Cookies ergänzen; er ist kein Nachweis einer verschlüsselten Backendverbindung und ersetzt keine Authentifizierung. Die Drittkomponente schreibt ihrerseits den Cookiepfad um. Bestehende `HttpOnly`-/`SameSite`-Eigenschaften und EOS-Sitzungsprüfungen bleiben erhalten.

## Tatsächlich ausgeführte Prüfungen

Prüfumgebung: Linux, Node.js v24.22.1, npm 11.9.0 und die im Projekt vorhandenen Build-/Testabhängigkeiten. Synthetische ioBroker-Objekte und zufällige Testpasswörter ersetzen Kundendaten. Die Arten der Nachweise werden getrennt ausgewiesen: reine Quell-/Typprüfung, kontrollierte Komponentenprüfungen, tatsächliche lokale HTTP-/Proxyintegration sowie gegebenenfalls Browserprüfungen.

| Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| `npm run admin:build` | Exit 0; 9.91 s | `final-admin-build.log` |
| `npm run build:ts` | Exit 0; 13.54 s | `final-build.log` |
| `npm run docs:build` | Exit 0; 3.92 s | `final-docs.log` |
| `npm run docs:check` | Exit 0; 0.25 s | `final-docs-check.log` |
| `node scripts/verify-eslint-security.cjs` | Exit 0; 17.91 s | `final-lint.log` |
| `npm run release:generate-manifest` | Exit 0; 1.58 s | `final-seal.log` |
| `npm run test:all` | Exit 0; 246.61 s | `final-test-all.log` |
| `npm run publish:check` | Exit 0; 1.23 s | `final-publish-check.log` |
| `npm run test:package-runtime-start-smoke` | Exit 0; 1.17 s | `final-runtime-start.log` |
| `npm pack --dry-run --json --ignore-scripts` | Exit 0; 2.97 s | `final-pack-dry.log` |
| Admintransport | 25 neue und 9 bestehende Prüfgruppen bestanden | `admin-transport.log`, `admin-boundaries.log` |
| React-Proxyseiten | 16 CSS-/Link-/Popup-/Microgrid-Routenfälle bestanden | finaler Gesamtlauf |
| Anmeldemaske | 15 neue Komponentenfälle und 44 bestehende Routerfälle bestanden | `LOGINFORM_PRUEFVERMERK_DE.md` |
| Laufzeitpfade | 19 Prüfgruppen einschließlich JavaScript-Parser für alle WWW-Quellen bestanden | finaler Gesamtlauf |
| HTML-Proxy | 7 Prüfgruppen mit tatsächlich generiertem JS und lokalen HTTP-Routen bestanden | finaler Gesamtlauf |

Bereits separat dokumentiert sind 25 Transportprüfungen des tatsächlichen TypeScript-Codes sowie neun bestehende Verbindungsgrenzen. Darunter sind HTTPS-Adminpfad mit öffentlichem Unterpfad, strikte Instanz-/Pfadprüfung, eigener direkter HTTP-Port ohne 8188-Versuch, unterschiedliche EOS-/Proxyfehler, tatsächlicher Fetch-/Bodyabbruch und ungültige Anmeldestatusfelder. Die Rohbelege stehen in `admin-transport.log`, `admin-boundaries.log` und `admin-transport-results.json`; ihr jeweiliger Quellhash kennzeichnet den geprüften Teilstand.

Für die tatsächliche TSX-Anmeldemaske wurden 15 deterministische asynchrone Komponentenfälle ausgeführt. Sie prüfen unter anderem individuelle Passwortübergabe, fehlende Rolle, Timeout nach Login, Proxy401 gegenüber EOS401, doppelte Anmeldung, alte Erfolgs-/Fehlerantworten, Abmeldung, Unmount und Routenwechsel. Hinzu kommen 44 bestehende Routerfälle und Strict-TypeScript. Diese Hook-/Node-Rendererprüfungen sind ausdrücklich keine echten Browserlebenszyklen. Belege: `LOGINFORM_PRUEFVERMERK_DE.md`, `loginform-results.json` und die zugehörigen Rohlogs.

Der unveränderte offizielle `InstanceProxy` aus Admin 8.3.5 wurde außerdem mit einer synthetischen Admin-Sitzungs-/Objektdatenbank und tatsächlichen lokalen EOS-HTTP-Routen verbunden. Die HTTPS-Testverbindung prüfte das Zertifikat gegen eine ausdrücklich vertraute kurzlebige Test-CA; ihre Gegenstellenprüfung wurde nicht abgeschaltet. Neun Fälle bestanden: HTTPS zum konfigurierten HTTP-Ziel unter öffentlichem Unterpfad, eigenes Kontopasswort, kanonische EOS-Sitzung, begrenzter Cookiepfad, geschützte Folgeaufrufe, falsches Passwort, fehlende Adminsitzung, fehlende Proxy-Administratorgruppe, fehlendes Instanz-Opt-in, wirksame EOS-Originprüfung und Sitzungswiderruf nach EOS-Gruppenentzug sind darin als kombinierte Prüffälle enthalten. Dieser Komponentenversuch ist keine vollständige Admininstallation und bestätigt nicht automatisch alle danach geänderten Frontendartefakte. Die abschließenden Releaseprüfungen binden den finalen Lieferstand gesondert.

Der abschließende Browserlauf mit Chromium 153.0.8010.0 bestand **8 Prüfgruppen**. Verwendet wurden der echte gebaute React-Tab, die Laufzeitseiten, die tatsächlichen EOS-HTTP-Routen und der unveränderte Instanzproxy aus Admin 8.3.5. Die Admin-Sitzung und ioBroker-Datenbank waren synthetische Fixtures; es wurde keine Kundenanlage verbunden. Das kurzlebige lokale Testzertifikat war gezielt per SPKI gebunden; `ignoreHTTPSErrors` blieb ausgeschaltet. Keine Screenshots oder Zugangsdaten sind Teil der Lieferung.

- Actual Admin React login accepts arbitrary account own password once and unlocks Installer with proxy-scoped HttpOnly Secure SameSite session
- Built Admin React module, stylesheet and decoded logo load below public Admin prefix
- Installer opens real EMS App-Center with working styles, shared EOS session and correct Admin-prefix backlink
- Real App-Center nested dynamic-grid React iframe loads and reuses authenticated proxy session
- Real VIS loads styles and decoded images and establishes EventSource below proxy prefix
- Simulation opens with real proxied scripts, styles and authenticated status
- SmartHome configuration renders protected real page and styles without writes
- No root API/static/EventSource escape, failed assets, uncaught browser errors or configuration writes

Beleg: `proxy-browser-results.json` und `proxy-browser.log`, mit Hashbindung an die geprüften Produktdateien. Der gesonderte Originalproxy-/HTTP-Lauf bestand alle neun Fälle erneut, einschließlich Secure-, HttpOnly-, SameSite- und instanzgebundenem Cookiepfad. Diese Befunde ersetzen keine vollständige installierte Admin-/Controller-/Anlagenabnahme.

Die Microgrid-Routenwahl und Datenpunkt-Popup-Pfade wurden in 16 fokussierten React-Tests für direkten Zugriff und Proxybetrieb geprüft. Ein vollständig initialisierter Microgrid-Dienst war nicht Bestandteil des Browser-End-to-End-Versuchs; dessen Anlagenablauf bleibt separat abzunehmen. Dynamische Stylesheets, Rücklinks und diese Popuppfade verwenden ebenfalls den geprüften Instanzpräfix.

## Statische Prüfung, Abhängigkeiten und Integrität

Die bestehenden VM-Testumgebungen für Navigation und Datenpunktauswahl wurden um die ausdrücklich importierte Pfadhilfe ergänzt; ihre bisherigen Origin-/Source-/Request- und Abbruchprüfungen bleiben erhalten. Die PWA-Tests prüfen jetzt auch das Entfernen des alten v522-Caches und den Erhalt des aktuellen v523-Caches. Die neuen Proxyfälle laufen ergänzend gegen die echten Funktionen.

Die projektweite Typprüfung verwendet zusätzlich eine gemeinsame Browserdeklaration für `NW_RUNTIME`. Die betroffenen Teilkonfigurationen wurden nach dem bestehenden NodeNext-/Bundler-Standard integriert; eine Typfehlerunterdrückung wurde nicht eingeführt. Der Laufzeitcode und die bereits im Browser geprüften JavaScript-Dateien blieben dabei unverändert.

Die Security-Regressionssperre prüfte 178 maßgebliche Quellen: **0 neue ungeprüfte oder verbotene Befunde**. Sichtbar bleiben 2970 historische offene Scannerstellen und 101 individuell bewertete Vorkommen. Fünf neue Dateisystemstellen im HTML-Sender wurden einzeln anhand ihrer Pfad-/Dateityp-/Größen-/Parallelitätsgrenzen geprüft und an Fingerprints sowie den kommentarfreien Dateihash gebunden. 31 vorhandene bewertete Stellen in `main.ts`, `adminConnection.ts`, `DynamicGridPage.tsx` und `MeshCoordinatorPage.tsx` wurden nach unverändertem Fundstellenvergleich erneut gebunden. Die historische Baseline wurde nicht erweitert. Der unabhängige WWW-Abgleich fand keine zusätzlichen Scannerfingerprints; zwei dabei gefundene Pfadmigrationsfehler wurden vor dem endgültigen Build behoben. Das ist keine vollständige Sicherheitsfreigabe aller Altquellen.

Die aktuellen npm-Audits melden für produktive Abhängigkeiten und den Admin-Build jeweils **0 bekannte Befunde**. Im Root-Entwicklungsbaum verbleiben **13 moderate Meldungen**, keine hohen oder kritischen Meldungen. Diese Entwicklungspaket-Befunde bleiben offen; sie wurden nicht verdeckt oder als behoben ausgegeben. Der Lockfilevergleich zeigt ausschließlich die Produktversion 1.0.34 → 1.0.35; keine Abhängigkeit wurde geändert. Scannerergebnisse sind zeitgebunden und kein Nachweis vollständiger Schwachstellenfreiheit.

Vorhandene bewertete Lintstellen werden bei verändertem Dateihash nur nach fachlichem Abgleich neu gebunden. Die vorhandene begrenzte Nullprototyp-JSON-Kopie `copyJsonValue` in `adminConnection.ts` wurde anhand ihres kommentarfreien TypeScript-AST als unverändert gegenüber 1.0.34 bestätigt. Dies ist keine Sicherheitszertifizierung der ganzen Datei. Weitere bewertete Stellen und offene Altbefunde sind dem finalen Lintnachweis zu entnehmen; eine bestandene Sperre gegen neue Befunde bedeutet nicht null historische Befunde.

Der Admin-Build wird aus den geänderten Quellen erzeugt. Produktversion, io-package, Paketlisten, Quellcodedokumentation, SBOM und Artefaktmanifest gehören zum selben Lieferstand. Die endgültige Paketprüfung darf keinen Produktcode nachbauen oder unbesehen neu versiegeln. Der vollständige Regressionstest und die Paket-/Archivprüfungen werden mit tatsächlichen Exitcodes und Rohlogs dokumentiert. Ein finaler Quellarchivhash sowie Einzeldateihashes dienen der Lieferbindung; sie behaupten keine Codefreiheit von unbekannten Schwachstellen.

## Update, Metadaten und Anlagenprüfung

1. Vor der Installation Adapterkonfiguration sichern und den vollständigen Stand 1.0.34 für einen bewussten Rückfall aufbewahren. Vorhandene Benutzer, eigene Kontopasswörter und tatsächliche Gruppenmitgliedschaften bleiben erforderlich. Für diesen HTTPS-Fehler ist kein Passwortreset vorgesehen.
2. Für die bestehende npm-Testbereitstellung das vollständige Repository einschließlich der geprüften Artefakte verwenden. Die vorhandene Test-Publishkette beziehungsweise `PUBLISH_NPM.cmd` führt weiterhin die technischen Paketprüfungen aus; es wurde hier nichts extern veröffentlicht.
3. Anschließend ein normales ioBroker-Adapterupgrade auf 1.0.35 durchführen. Dieses überträgt im geprüften Controllervertrag `common.adminTab.proxy: true` aus dem Paket in die Instanzobjekte. Nur Dateien kopieren oder ausschließlich Webseiten hochladen ist kein vollständiger Metadaten-Upgrade. Kein manueller Rollen-/Gruppenumbau wird daraus abgeleitet.
4. Den UI-Adapter nach dem Upgrade neu starten und den Admin vollständig neu laden. Werden noch die alten Admin-Dateien angezeigt, die normale ioBroker-Webdateiübernahme des installierten Adapters prüfen und den Tab ohne alten Browsercache erneut öffnen. Der aktuelle Platzhalter lautet „ioBroker-Benutzername“.
5. Im HTTPS-Admin mit dem eigenen ioBroker-Konto und dessen bestehendem Passwort anmelden. Die erwartete EOS-Rolle, eine freigegebene Funktion und die vorgesehenen EMS-/VIS-Seiten prüfen. Im Proxybetrieb müssen die betreffenden lokalen Abrufe und Seiten unter demselben HTTPS-Origin und Instanzpräfix bleiben.
6. Falsches Passwort, fehlende EOS-Gruppe, Rollenentzug während einer Sitzung und Abmeldung prüfen. Kunden-/Installateurkonten ohne ioBroker-Administratorgruppe separat über den vorgesehenen direkten beziehungsweise abgesicherten EOS-Zugang testen. Keine fehlende Proxyberechtigung durch Vergabe unnötiger Administratorrechte umgehen.

Ein Proxy-404 verlangt die Prüfung von Admin-Mindestversion und tatsächlichem Instanz-Opt-in. Ein Proxy-502 verlangt die Prüfung von laufender UI-Instanz, Port, Bind-Adresse und interner Erreichbarkeit. Eine abgelaufene Adminsitzung ist getrennt von einem EOS-Passwortfehler zu behandeln. Für die Diagnose genügen Versionen, Wortlaut, Status und bereinigter Zugriffsweg; Passwörter, Sitzungstoken und vollständige Benutzerobjekte werden nicht benötigt.

Ein Rückfall auf 1.0.34 reaktiviert dessen früheren Verbindungsweg und behebt den HTTPS-Portkonflikt nicht. Der Stand bleibt deshalb eine Rückfallmöglichkeit für den bisherigen Betrieb, kein gleichwertiger HTTPS-Fix.

## Verbleibende Grenzen und Freigabe

Die konkrete Admin-8.3.5-/Controllerinstallation, ihre Zertifikate, ein möglicher vorgeschalteter Reverse-Proxy, individuell gesetzte Bind-Adressen und die Anlage wurden nicht aus der Ferne abgenommen. Die Runtime berücksichtigt bei ihrer Bind-Adresse auch das ältere Feld `native.ip`; der offizielle Adminproxy orientiert sich an `native.bind`, `native.port` und `native.secure`. Individuelle Abweichungen dieser Werte müssen vor Ort zu einer tatsächlich erreichbaren und beabsichtigten Adresse passen. Das Update öffnet keine Firewallports und erweitert keine Bind-Adresse automatisch.

Im Standardbetrieb auf demselben ioBroker-Host erfolgt die interne Verbindung zum HTTP-EOS-Dienst über Loopback. Bei getrennten Hosts ist die interne Strecke gesondert zu sichern. HTTPS im Browser belegt keine Ende-zu-Ende-Verschlüsselung aller internen Netzsegmente. Die optionale HTTPS-Upstreamimplementierung von Admin 8.3.5 deaktiviert dort die Zertifikatsprüfung; sie wurde für diesen Lieferstand nicht als geprüfte Sicherheitsfunktion freigegeben. Diese bekannte Eigenschaft der Drittkomponente und die Grenzen ihres Cookie-Rewrites bleiben dokumentiert.

Bestehende offene Produkt-/Anlagenbefunde einschließlich realer Partner-/Arbitrageabnahme, vollständigem EOS-Inventar, Remote-CodeQL, externem Sicherheitsreview, Support-/Konformitätsentscheidung und dokumentierter NW1-Kompatibilitätsausnahme werden weitergeführt. Der Status bleibt `review`, `productionApproved: false`. Die getrennte Produktionsfreigabe darf nicht als bestanden ausgegeben werden. Das Testpaket ersetzt keine Herstellerentscheidung, CRA-Konformitätsbewertung, IEC-/ASVS-Vollprüfung oder Zertifizierung.

Es wurde keine Kundeninstallation aktualisiert, kein produktives Passwort geändert, keine Gruppenmitgliedschaft angelegt und kein Paket veröffentlicht. Die Dokumentation dient der nachvollziehbaren Entwicklungs- und CRA-Nachweisführung innerhalb des tatsächlich geprüften Umfangs.

## Quellen und mitgelieferte Nachweise

- `docs/operations/ADMIN_HTTPS_PROXY_DE.md`: Update, Diagnose, Mindestversion und Betriebsgrenzen.
- `docs/operations/BENUTZER_GRUPPENRECHTE_DE.md`: individuelle Konten, Gruppenrollen und Migration aus älteren Namensrollen.
- `docs/security/auth-review-de.md`: fortgeschriebene Befunde NW-AUTH-11 bis NW-AUTH-18.
- `ADMIN_PROXY_QUELLEN_DE.md`: versionierter offizieller Admin-/Controllervertrag, Einbindung und Grenzen.
- `LOGINFORM_PRUEFVERMERK_DE.md`: Komponentenfälle und Grenzen der UI-Prüfung.
- `scripts/release-artifact-manifest.json`, `release-manifests/sbom-product.cdx.json`, `release-manifests/sbom-product-evidence.json` und `release-manifests/repository-payload-sha256.json`: Paket-/Quell-/Artefaktbindung.

Offizieller Proxy: https://github.com/ioBroker/ioBroker.admin/blob/v8.3.5/src/lib/instanceProxy.ts – geprüfter Fremdquell-SHA-256 `ccfd3fcab5466e24166e938dca305a67d8741a0bb85eea027a4b328b9f9b35d2`. Das normale Metadatenupgrade wurde im versionierten Controller 7.2.5 an `packages/cli/src/lib/setup/setupUpgrade.ts` und `setupUpload.ts` abgeglichen. Der unveränderte Drittquelltext ist ein Prüfmittel, dadurch kein Bestandteil des ausgelieferten EOS-Produktcodes.
