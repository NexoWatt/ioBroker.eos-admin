# NexoWatt EOS 9.0.15 – Smartphone-Webapp, App-Symbol und Migrationsnavigation

Stand: 23.11.2026. Ausgangsstand: ausgelieferte 9.0.14. Der Lieferstand ergänzt das vom Nutzer gewünschte Smartphone-App-Symbol und den sichtbaren Einstieg zur Bestandsübernahme; er ist kein Nachweis einer bereits erfolgreichen Live-Migration.

## Befund und Änderung

Die vorhandenen kleinen NexoWatt-Icons waren bereits enthalten. Der Systemverwaltung fehlte jedoch der Manifest-Link; einzelne UI-Seiten enthielten doppelte Manifest- und konkurrierende Apple-Icon-Verweise. Relative Links konnten unter einem Unterpfad zur falschen Manifest-Adresse führen.

Dreizehn Einstiegsseiten verwenden nun genau einen absoluten Verweis auf `/manifest.webmanifest` und genau ein Apple-App-Symbol. Anmeldung, Dashboard und Systemverwaltung beziehen dadurch die gemeinsame Root-App. Das neue explizite `id: "/"` entspricht der bisherigen wirksamen Identität des am Root ausgelieferten UI-Manifests; `start_url: "."` und `scope: "./"` bleiben erhalten und lösen dort weiterhin zu `/` auf. Die ältere Admin-Manifestdatei erhält dieselbe Root-Identität und absolute Icon-URLs. Andere Hostnamen, IP-Adressen oder Ports bleiben getrennte Origins.

Die Prüfung des gebauten Admins deckte zusätzlich auf, dass Vite mit dem benötigten relativen Bundle-Basispfad diese absoluten Metadaten-URLs wieder relativ erzeugt. Der bestehende Frontend-Build korrigiert deshalb nach dem Bundeln ausschließlich die fest benannten Manifest-, Apple-Icon- und Favicon-Verweise. JavaScript- und CSS-Bundlepfade sowie das rollenabhängige Laden bleiben unverändert. Die neue Regression prüft sowohl die HTML-Quellen als auch das tatsächlich ausgelieferte `adminWww/index.html`.

Das Nutzer-PNG wurde bytegenau nach `ui/www/assets/icons/nexowatt-1024.png` und `ui/www/apple-touch-icon.png` kopiert, ebenso in die statische Admin-Buildquelle. SHA-256: `952ceb9cef3f7f22a150dd8ea396285f70b9d8c19de8e7c1452bf2ff983ae6bd`. Keine Bildgenerierung, kein Neuzeichnen und keine Umfärbung. Die tatsächlichen Maße 1024×1024 werden korrekt angegeben. Das Original wird als `any`, nicht als `maskable` deklariert. Die vorhandenen korrekt dimensionierten 192-/512-Pixel-Icons und vorhandenen Maskable-Varianten bleiben verfügbar. Die Apple-URL enthält einen festen, vom Logo-Hash abgeleiteten Cachehinweis, keine Sitzungsdaten.

Für den iOS-Standalone-Modus bleibt die Statusleiste deckend (`black`), damit Inhalte nicht unter sie gelegt werden. Die UTF-8-Deklaration steht auf allen bearbeiteten Seiten direkt nach dem öffnenden Head-Tag innerhalb der ersten 1024 Bytes.

Die Root-Startseite entscheidet weiterhin anhand der Sitzung über Anmeldung oder Dashboard. Erstpasswortwechsel und Lizenzaktivierung bleiben vorgeschaltet. Es wurden keine öffentlichen API-Freigaben erweitert. Der vorhandene Retirement-Worker, der alte EOS-Caches entfernt und sich abmeldet, bleibt unverändert. Insbesondere werden keine Reglerseiten, API-Antworten, Zugangsdaten oder Stellbefehle für Offline-Betrieb zwischengespeichert.

## Migrationsnavigation und Publish-Diagnose

Der Nutzer bestätigte, dass der Menüeintrag fehlt. Der bestehende Admin-Eintrag „Übernahme“ wird eindeutig „Bestandsübernahme“ benannt; in den Dashboard-Einstellungen kommt ein zunächst ausgeblendeter Link hinzu, der nur nach bestätigter Administratoranmeldung sichtbar wird und im selben Tab öffnet. Die vorhandenen Server-Routen und Administratorrechte bleiben maßgeblich. Der Seitenaufruf startet keine Übernahme.

Der zuletzt gemeldete Publish-Abbruch war `ENOENT ...\ioBroker\package.json`: npm wurde im übergeordneten Ordner ausgeführt. Es gibt für diese Ursache keinen notwendigen Adapter-Codefix. Die Anleitung nennt deshalb den Paketordner und die Versionsprüfung ausdrücklich. Die ausgelieferte 9.0.14 wurde zusätzlich frisch und als Kopie über 9.0.13 mit dem echten npm-Verzeichnis-Trockenlauf geprüft; beide Fälle gelangen. Die neuen Lieferprüfungen für 9.0.15 bleiben separat ausgewiesen.

## Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Vollständiges `npm test`, Node.js 22.23.4 | 1329 Tests, 1327 bestanden, 0 fehlgeschlagen, 2 ausgelassen |
| Vollständiges `npm test`, Node.js 24.22.3 | Gleicher Umfang und gleiche Ergebnisse |
| Typprüfung | Konfigurierte Gesamtprüfung auf Node 22/24 bestanden; Admin-TypeScript-Prüfung zusätzlich im Build |
| Linting | Konfigurierte Gesamtprüfung bestanden; neue Build-Hilfe zusätzlich per Syntax- und PWA-Regressionsprüfung geprüft |
| Builds | Backend, Admin-Frontend, Installer, Module und UI-Runtime erfolgreich; Runtimequellen und deutsche Code-Dokumentation synchron |
| Webapp-Regression | Tatsächlicher Owner-HTTP-Mount, bytegenaue Icon-Auslieferung, öffentliche Metadaten vor Anmeldung/Freigabe, Session-/Passwort-/Lizenz-Gates und absolute Links im gebauten Admin bestanden |
| Migrationsnavigation | Bestandsübernahme-Link im selben Tab; Administratoranzeige, Rollenwechsel und Logout über vorhandenen Auth-Vertrag geprüft |
| Lizenzregression | Echte Keygen-1.0.4-Quelle im gesamten Testlauf verwendet; temporäre Testschlüssel, keine Herstellerschlüssel |
| UI-Geheimnisprüfung | Keine Treffer; zusätzliche Paket-Geheimnisprüfung im Release-Gate |
| UI-Sicherheitsgate | 209 Quellen; 0 neue blockierte Befunde; historische Baseline unverändert |
| npm-Audit Laufzeit | 0 gemeldete Advisories |
| npm-Audit gesamte Entwicklungsumgebung | 14 moderate, 0 hohe/kritische Advisories |
| SBOM | Versionsbezug 9.0.15; Vendoring-Abgleich bestanden |

Die zwei ausgelassenen Fälle benötigen `nginx` beziehungsweise `setfacl`. Die vollständigen Tests verwenden lokale HTTP-/Controller-/Gerätemodelle. Sie bestätigen keine erfolgreiche Übergabe auf der tatsächlichen Liveanlage. Die konkrete Live-Patchversion Node.js 22.23.5 wurde nicht ausgeführt; getestet sind die oben angegebenen Versionen.

Das Sicherheitsgate führt weiterhin 3222 aktuelle Scannerfundstellen: 2952 historische offene und 270 einzeln geprüfte. Die Baseline und quellgebundenen Einträge sind gegenüber 9.0.14 unverändert; keine Befundbudgets wurden gelockert. Historischer Kontext: [Sicherheitsdelta 9.0.14](../unified-9.0.14/UI_SECURITY_DELTA_REVIEW.md). Dies ist kein vollständiger Sicherheitsnachweis des Gesamtbestands.

Die versionsgebundenen Rohbelege stehen in `raw/INDEX.json`. Nach Abschluss dieser unveränderlichen Quellen werden Repo-ZIP, Paket, frische Extraktion und tatsächliche npm-Verzeichnis-Trockenläufe geprüft. Deren Ergebnisse einschließlich Hashes stehen getrennt in `NexoWatt_EOS_9.0.15_Lieferpruefung.json`; diese abschließenden Paketbelege können nicht selbst in ihrem eigenen unveränderlichen Quellhash enthalten sein.

## Grenzen und Installation

Die automatisierten Prüfungen ersetzen keine visuelle Installation auf einem physischen iPhone oder Android-Gerät. Ein Browser-Installationsangebot hängt zusätzlich von Browserversion, Nutzeraktion, Zertifikatsvertrauen und einem eventuell bereits vorhandenen App-Eintrag ab. Der Server installiert weder Apps noch CA-Vertrauen ungefragt auf Endgeräten. Ein bestehendes Home-Screen-Symbol kann bis zur erneuten Installation seinen alten Stand behalten.

Die Quell-/Zielübergabe, Geräteanzahl, Regeltakte und frischen Werte einer Kundenanlage müssen weiterhin vor Ort bestätigt werden. Der bereits gelieferte 9.0.14-Migrationsfix bleibt enthalten; dieser kosmetische Folgestand bestätigt keine durchgeführte Migration. Keine neue CRA-Konformitäts- oder allgemeine Produktionsfreigabe wird behauptet.

## Primärquellen

- [Apple, Statusleiste im Standalone-Modus](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariHTMLRef/Articles/MetaTags.html)
- [WHATWG, Position der Zeichencodierungsdeklaration](https://html.spec.whatwg.org/multipage/semantics.html#charset)

- [Apple, Web-Clip-Icons und Wahl einer größeren Auflösung, archivierte Entwicklerdokumentation](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [Apple, Website als App hinzufügen](https://support.apple.com/de-de/guide/iphone/iphea86e5236/ios)
- [Google, Web-App-Installationskriterien einschließlich 192-/512-Pixel-Icons](https://web.dev/articles/install-criteria)
- [W3C, Web Application Manifest; aktueller Stand als Working Draft gekennzeichnet](https://www.w3.org/TR/appmanifest/)
- [Apple, manuell installierten Zertifikaten vertrauen](https://support.apple.com/en-us/102390)

Die Angaben stützen die technische Auswahl. Sie sind kein eigener Geräte- oder Zertifizierungsnachweis.
