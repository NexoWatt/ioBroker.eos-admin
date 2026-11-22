# Prüfbericht – NexoWatt UI 1.0.38

Stand: **22.11.2026**. Lieferumfang: vollständiges Repository mit Original-EOS-
Logo, neutralen sichtbaren UI-Texten, direktem HTTPS und Reparatur des Web-App-
Einstiegs. Ausgangspunkt ist das tatsächlich ausgelieferte Repository 1.0.37,
Archiv-SHA-256
`ddb1932159d37a5781e2d5fc62abff3b1424e955b5109657107927a59476b0fd`.

**Ergebnis:** Die gezielten Build-, HTTPS-, Authentifizierungs-, PWA-,
Kompatibilitäts- und Upgradeprüfungen sind bestanden. Der verpflichtende
Gesamtlauf `npm run test:all` wurde ausgeführt, endet aber am blockierten
Chromium-Start. Deshalb ist dies ein **Testpaket**, kein vollständiger
Gesamt-PASS und keine Produktiv- oder Gerätefreigabe. Es wurde keine Anlage
verändert und kein Paket extern veröffentlicht.

## 1. Behobene Ursachen und Produktänderungen

| Bereich | Befund und Korrektur |
| --- | --- |
| Original-EOS-Logo | Das gelieferte PNG ersetzt auf der Anmeldung das generische N-Zeichen und den zusätzlichen Textblock. Das Profil-Badge rechts entfällt. Die Originaldatei bleibt unverändert; Zuschnitt der transparenten Ränder erfolgt über CSS. |
| Sichtbare Texte | Eigene Plattformhinweise in Login, Admin-Konfiguration, Hinweisen und Fehleransichten sind neutral formuliert. Technische Kennungen, Paketverträge, Datenpunkt-IDs und fremde Lizenzinformationen bleiben erhalten. |
| Direkter HTTPS-Port | Der alte Server verwendete ausschließlich `app.listen`, also HTTP. `secure: true` aktiviert jetzt einen echten HTTPS-Listener am vorhandenen Web-Port mit ausdrücklich ausgewählten Zertifikaten. |
| Weiterleitung nach Anmeldung | Die historischen `admin-guard.js`-Verweise auf App-Center/Simulation konnten nach erfolgreichem Login auf Port 8081 umleiten. Sie sind entfernt; die echten serverseitigen Rollen-/Capability-Prüfungen bleiben aktiv. |
| Bedienung der bisherigen Web-App | Mehrere direkte Bedienseiten luden weder `runtime-base.js` noch `auth.js`. Dadurch fehlte bei bestehenden Schreibbefehlen der erforderliche CSRF-Header. Jetzt laden alle 19 geschützten klassischen HTML-Einstiege Runtime und Auth ausdrücklich vor ihren Anwendungsskripten. |
| App-Start und Aktualisierung | Login enthält Manifest, App-Metadaten und Icons. Sechs Einstiege verwenden denselben strikten PWA-Bootstrap mit Updateprüfung beim Start und Wiederaufnehmen. Der Worker bleibt auf den eigenen direkten Ursprung begrenzt. Cache v526 entfernt alte Anwendungscaches. |
| Sichere Einrichtungslinks | Der Admin-Resolver berücksichtigt `{port, secure}`. Installer und Weiterleitung warten auf ein bestätigtes Ziel; Lesefehler führen nicht zu geratenen Ports. Der alte Lizenz-Einstieg verweist auf den geschützten Installer, ohne Portsuche oder Lizenz-Redirectschleife. |

Das Logo liegt unter `www/nexowatt-eos-logo.png`; SHA-256:
`1ccf55be6d457b4e1891dd7f37adff64a386ed8c633e522e86b9adce055f1d95`.
Die vorhandenen App-Icons und Dashboard-Logos wurden nicht ersetzt.

## 2. Transport und Lebenszyklus

Die neue strikte TLS-Grenze prüft gewählte Zertifikatsnamen, tatsächliche
PEM-Typen, begrenzte Größen, Gültigkeitszeit, Schlüsselpaar und Kettenfolge.
Zwischenzertifikate werden tatsächlich hinter dem Serverzertifikat ausgeliefert.
TLS 1.2 ist die Mindestversion. Fehler erzeugen feste bereinigte Codes/Meldungen;
keine privaten Schlüssel, Standardzertifikate oder neuen Laufzeitbibliotheken
werden mitgeliefert. Ein fehlgeschlagener TLS-Start öffnet keinen HTTP-Ersatz.

Das Zertifikatslesen hat ein fünfsekündiges Startwarte-/Prüfbudget. Die
Controller-API bietet keinen physischen Abbruch ihrer internen I/O; verspätete
Antworten bleiben wirkungslos und offene Abfragen werden nicht parallel ersetzt.
Davon getrennt begrenzt Node unvollständige TLS-Handshakes auf fünf Sekunden.
Der vollständige Vertrag steht in
[UI_TLS_TRANSPORT_HELPER_DE.md](../../security/UI_TLS_TRANSPORT_HELPER_DE.md).

Die unabhängige Gegenprüfung fand zwei zusätzliche Lebenszyklusprobleme, die
vor Abschluss behoben und anschließend tatsächlich ausgeführt wurden:

- Ein eigener `UiTlsConfigurationError` sperrt nur den UI-Listener. Die
  vorhandene autonome EMS-/SmartHome-Initialisierung läuft weiter; der
  Webverbindungsstatus bleibt falsch. Andere allgemeine Startfehler behalten
  ihren bisherigen Vertrag.
- Ein Adapterstopp wird vor dem Serverstart sowie nach dem Zertifikats-Await
  geprüft. Eine spätere positive Zertifikatsantwort darf weder einen Listener
  öffnen noch die weitere Initialisierung nach dem Stopp starten.

Der [unabhängige Diff-Review](SECURITY_DIFF_REVIEW_DE.md) dokumentiert Befund,
Korrektur, Source-/Mirror-Parität und die erhaltenen Zugriffsgrenzen.

## 3. Erhalt bestehender Anlagen und App-Identität

Der [Bestandsvergleich](BESTANDSKOMPATIBILITAET_DE.md) und seine
[Hashliste](bestandskompatibilitaet-hashes.json) belegen gegenüber 1.0.37:

- **91 EMS-TS-Dateien, 91 ausgelieferte EMS-JS-Dateien und 10 EMS-JSON-Dateien
  sind bytegleich.** Regelalgorithmen und deren Parameter werden nicht migriert.
- Alle Werte unter den **32 bisherigen obersten native-Schlüsseln** bleiben
  tiefengleich. Neu sind ausschließlich `secure: false`, `certPublic: ''`,
  `certPrivate: ''` und `certChained: ''`. Eine alte Konfiguration wird nicht
  automatisch auf HTTPS umgestellt.
- SmartHome-Vertrag, Konfigurationseditor und Visu sind jeweils als TS-/JS-
  Quelle bytegleich. Bestehende Zuordnungen, Namen, Räume, Favoriten, Szenen
  und Detaildialogverträge bleiben erhalten.
- Authentifizierungsrichtlinie, Benutzer-/Rollenprüfung und Browser-Authwrapper
  sind unverändert. Die beiden Anmeldeprofile bleiben getrennt. Es gibt keine
  Passwortänderung, keinen neuen Standardbenutzer und keinen Auth-Bypass.
- Manifestname, Kurzname, Start-URL `.`, Scope `./`, Standalone-Modus, Farben
  und Iconreferenzen bleiben identisch. **14 App-Icons**, Apple-Touch-Icon,
  bestehende Logos und fünf Energieflussbilder sind bytegleich.
- Der unabhängige Stationsdisplay-/Maschinenvertrag bleibt erhalten; die
  dortige HTML-Seite bekommt keinen interaktiven Benutzer-Authbootstrap.

Dieser Vergleich prüft den Softwarebestand, keine kundenspezifische
Instanzkonfiguration oder reale Gerätekommunikation. Eine vorhandene App
bleibt an ihre frühere Adresse gebunden: Ein ausdrücklich vorgenommener Wechsel
von Protokoll, Host oder Port wird nicht automatisch auf einen Homescreen-
Shortcut übertragen.

## 4. Tatsächlich ausgeführte Prüfungen

Laufzeit: Node.js **24.22.3**, npm **11.19.1**. Die folgenden Angaben betreffen
den aktuellen 1.0.38-Stand, keine übernommenen Prüfzahlen früherer Versionen.
Die Protokolle liegen unter [evidence](evidence/).

| Prüfung | Ergebnis und Aussage |
| --- | --- |
| `npm run build:ts` | PASS; kanonische Runtime erzeugt, typisierte Spiegel erhalten, Typbuild erfolgreich. |
| `npm run admin:build` | PASS; neuer Admin-Build und Komponentenbeleg, Dateiliste auf tatsächlichen aktiven Bundlehash aktualisiert. |
| `npm run typecheck` | PASS einschließlich des neuen PWA-Bootstraps im übergreifenden NodeNext-Projekt. |
| `npm run docs:build` | PASS; 273 Quelldateien und 274 Verzeichnisseiten aktuell. |
| Direkte HTTPS-Integration | **34 Gruppen / 66 reale HTTP(S)-Anfragen PASS**; Details im [Laufzeitbericht](HTTPS_INTEGRATIONSPRUEFUNG_DE.md) und [hashgebundenen Beleg](direct-https-runtime-evidence.json). |
| Bestehende UI-Zugangsprüfung | **32 Gruppen PASS**; ausgelieferte HTTP-Runtime, beide Profile, lokale Controller-/EOS-Fixtures. |
| Auth-/Login-Frontend | **9 Gruppen PASS**; Originalcode in DOM-/VM-Host einschließlich der 19 tatsächlichen HTML-Startreihenfolgen. |
| PWA-Bootstrap | **21 Gruppen PASS**; tatsächlicher Bootstrap, direkte/Proxy-/Frame-Grenze, Wiederaufnahme, begrenzte parallele Aufträge, Fehlerisolation, HTML-Einstiege und Iconabmessungen. |
| Admin-HTTPS-Suite | **33 Transport-, 20 ProtectedRoute-, 20 RuntimeBase-, 8 ProxyHTML- und 25 React-Routing-Gruppen PASS**; [Routingnachweis](FRONTEND_ROUTING_DE.md). |
| Frontend-/Cache-Schutz | **55 Regressionen PASS**; APIs/private Seiten ohne Offline-Cache, Upgrade v526 und Logout-Bereinigung. |
| SmartHome | **9 UI-Vertragstests und 13 Import-Gruppen PASS**; bestehende Kacheln, Detaildialoge, Bedienpayloads und Zuordnungen. |
| Heartbeat/Lifecycle | PASS; bestehende unabhängige Adapter-/Scheduler-/Übersichts-Heartbeat-Verträge. |
| Strikte Projektgrenzen | **23 Positiv-/Negativfixtures, 9 exakte Quellbereiche PASS**; neue TLS-/PWA-Grenzen eingeschlossen. |
| Security-ESLint | PASS: **183 Quellen, 3097 Befunde**, davon 2957 historische offene und 140 individuell bewertete Vorkommen; **0 neue/verbotene Befunde**, 103 frühere abwesend. Kein befundfreier Gesamtscan behauptet. |
| `test:stable-1.0.12-publish` | PASS; echte vollständige `prepublishOnly`-Kette gegen lokale Testregistry, frische Kopie, alte Admin-Bundles, sichere Backups, Wiederholung und echter blockierender Secret-Fixturefall. Keine externe Veröffentlichung. |
| Paket-SBOM und Artefaktgate | PASS; Produkt-SBOM und explizit versiegelte Paketdateien werden beim Publish ausschließlich lesend verifiziert. |
| `npm pack --dry-run --json --ignore-scripts` | PASS; neues Logo, PWA-Bootstrap und TLS-Laufzeithelper sind im vorgesehenen Paket enthalten. |
| Echter ZIP-Frisch-/Überlagerungsfall | PASS; vollständiges Archiv tatsächlich entpackt und über das echte 1.0.37-Archiv gelegt. Veraltetes Admin-JS gesichert, Backuphash geprüft, zweiter Vorbereitungslauf ohne Änderungen; alle 546 versiegelten Dateien stimmen. |
| `npm run test:all` | **Nicht vollständig bestanden: BLOCKIERT beim Chromium-Start** von `test:rc66-station-display-browser`. `socket() failed: Operation not permitted` / `DevToolsActivePort`. Vorherige Build-/Typ-/Runtime-Stufen bestanden; nachfolgende Gesamtlaufstufen werden nicht pauschal als ausgeführt gezählt. Gezielte relevante Gruppen wurden separat ausgeführt. |

Die Gesamtprüfung deckte zunächst eine fehlende explizite Modulauflösung in
der neuen TLS-tsconfig sowie die PWA-Window-Typbindung im NodeNext-Projekt auf.
Beides wurde korrigiert; der endgültige Gesamtlauf gelangt anschließend bis
zur tatsächlichen Browserumgebungsblockade. Keine Typ-, Lint- oder
Berechtigungsregel wurde dafür abgeschwächt. Die Release-Dokumentation enthält
die vom vorhandenen Gate geforderte eindeutige Kennzeichnung als nicht
produktiv freigegebener Prüfstand.

## 5. Aussagekraft der HTTPS- und Web-App-Prüfung

Die Tests verwenden echten Express-/TLS-/HTTP-Code und die ausgelieferte
Adapterklasse. Die HTTPS-Clients vertrauen ausdrücklich einer temporären
Test-CA; Zertifikatsprüfung wird nicht deaktiviert. Die Prüfung umfasst IP-SAN,
falschen Namen/Aussteller, Root → Intermediate → Leaf und den negativen
Kontrollfall ohne Zwischenzertifikat. Testschlüssel werden temporär erzeugt
und entfernt, nicht mitgeliefert.

Der tatsächliche über HTTPS geladene `auth.js`-Wrapper setzt für einen
`fetch('/api/set')` den erforderlichen CSRF-Header selbst. Die Produkt-Route
erreicht genau den vorgesehenen lokalen Datenpunktersatz. Nach Logout folgt
kein weiterer Write. So wird die ursprüngliche Lücke im direkten HTML-Start
zusammen mit dem Serververtrag geprüft, nicht nur ein manuell mit Headern
versehener API-Aufruf.

Controller- und Gerätegrenzen sind lokale Testobjekte. Die echten `onReady`-
Kontrollflüsse beobachten nachgelagerte Initialisierungsgrenzen; sie führen
keine Hardware-/EMS-Regelzyklen aus. DOM-/VM-Tests sind keine visuelle
Browserprüfung. Eine tatsächliche Installation auf iOS/Android, Homescreen-
Darstellung, Touchbedienung und die Zertifikatskette des Kundengeräts bleiben
als Zielgerätetest offen. CSS-Einbindung und Original-Asset sind geprüft;
eine hier erfolgreich gerenderte neue Screenshotserie wird nicht behauptet.

## 6. Paket, Nachweise und Testbetrieb

Das vollständige ZIP enthält Source, erzeugte Laufzeit, Admin-Build,
Konfiguration, Prüfskripte und Dokumentation. Entwicklungsabhängigkeiten und
temporäre Build-/Prüfverzeichnisse sind ausgeschlossen. Der tatsächlich
ausgeführte [erste Archivvergleich](archive-candidate-evidence.json) ist
ausdrücklich als Kandidat vor Zusammenfassungs-/Logergänzung markiert; das
endgültige Lieferarchiv wird nach der letzten Dokumentationsversiegelung
erneut mit demselben Frisch-/Überlagerungsverfahren geprüft. Es enthält keine
automatische Neuversiegelung beim Publish.

Weitere Belege:

- [Einzelreview der Security-Fundstellen](ESLINT_EINZELREVIEW_DE.md)
- [Unabhängige Diff-Gegenprüfung](SECURITY_DIFF_REVIEW_DE.md)
- [Bestandskompatibilität](BESTANDSKOMPATIBILITAET_DE.md)
- [Releasebeschreibung 1.0.38](../../STABLE_1_0_38_RELEASE_DE.md)
- [HTTPS-/Web-App-Testanleitung](../../operations/TESTANLEITUNG_1_0_38_DE.md)

`release-manifests/release-status.json` bleibt `review` mit
`productionApproved:false`. Der konkrete Hersteller-/Zielgerätetest ist
weiterhin erforderlich. Dieser Nachtrag implementiert keine zuvor als offen
festgestellten Volleinspeiser-Netzpfade/Charts, freie Nulleinspeise-Messpunktwahl
oder verbindliche Viertelstunden-Tradingreservierungen; diese werden nicht
als Bestandteil von 1.0.38 ausgegeben.
