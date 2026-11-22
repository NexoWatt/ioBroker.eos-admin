# NexoWatt EOS 9.0.5 – Prüf- und Lieferbericht

**Status: geprüfte Integrationstestlieferung 9.0.5 für den Kanal `next`; Zielgeräte-/Serienabnahme offen.**
**Datum:** 22.11.2026 · **Kanal:** `next` · **Technisches Paket:** `iobroker.eos-admin`

Dieser Bericht gehört ausschließlich zu 9.0.5. Ergebnisse früherer Lieferungen
werden nicht als neue Nachweise übernommen. Quell-/Buildhashes und tatsächliche Ergebnisse stehen in `release-validation.json`,
Rohbelegen und dem versionsgebundenen Liefermanifest.

## Anlass und belegte Ausgangslage

Der Nutzer berichtet, dass 9.0.4 startet und die Lizenz aktiv ist. Beim Öffnen von
History beendet sich der gemeinsame Adapter. Der vorgelegte Logauszug zeigt:

```text
TypeError: Cannot read properties of undefined (reading 'from')
 at .../iobroker.eos-admin/ui/main.js:17999:38
 at .../express4/lib/router/layer.js:95:5
unhandled promise rejection
terminated with code 6 (UNCAUGHT_EXCEPTION)
```

Das ist ein Nutzerbeleg von Node 24.22.3 / js-controller 7.2.5 / EOS 9.0.4,
kein eigener Zielgerätetest. `EOS_UI_UNAVAILABLE` und nachfolgende
`EOS_STATE_SUBSCRIPTIONS_STOPPED` sind Folgeanzeigen des Ausfalls/Stopps.
Die State-Drosselungsmeldungen allein belegen keinen Absturz. Die beobachteten
rund 750 MB RAM wurden vom Nutzer gemeldet; Messmethode und Langzeitverlauf liegen
noch nicht als reproduzierbarer Zielgerätebefund vor.

## Änderungen und Befundstatus

| Kennung | Umfang | Nachweisstatus |
| --- | --- | --- |
| EOS-HTTP-QUERY-001 | Query-Vertrag an Express-5/Express-4-Hosted-Grenze und lokale Behandlung asynchroner Routenfehler | Mit realem Express 5/4 reproduziert und korrigiert; vollständige produktive History-Route liefert den angefragten Zeitraum. Lokale asynchrone Fehlerbehandlung, Auth/CSRF/Origin und Prototypwiederherstellung geprüft. |
| HISTORY-905-02 | Laufzeitvalidierung von History-Eingaben und Callback-Daten; begrenzte Verarbeitung und Ressourcen | 17 neue API-Prüfungen und 13 bestehende Deadline-Prüfungen bestanden; alle im abschließenden Gesamtlauf enthalten. |
| EOS-SHUTDOWN-001 | Späte Abmeldungen nach geschlossenem Abonnementmanager als idempotentes Aufräumen; neue Anmeldungen bleiben gesperrt. | Vorher-/Nachher-Belege: shutdown-before.log und shutdown-after.log; 15 gezielte Tests bestanden, einschließlich im abschließenden Release-Regressionslauf. |
| EOS-BRANDING | NexoWatt-Startanzeige für HTML-Bootstrap und React-Ladezustand der EOS-Systemverwaltung | HTML-/React-Baustein und gebaute lokale Assets geprüft; vollständiger Browserlauf hier durch Chromium-Umgebungsfehler blockiert. |
| EOS-MEMORY | Begrenzung fachfremder State-Payloads im EMS-Datenpunktcache | Registry beschränkt auf konfigurierte Quellen/Aliase/Verbindungen; 12 Tests am generierten JavaScript bestanden, einschließlich verzögerter DB-Antworten und Löschereignissen. Keine Zielgeräteersparnis behauptet. |

Die Korrekturen ändern keinen Lizenzvertrag, führen keine zusätzliche UI-Aktivierung
ein und verleihen keine neuen Systemrechte. Bestehende Instanz, öffentliche
Prüfschlüssel, verschlüsselter Lizenzbestand und Adminzugang bleiben erhalten.
Die gemeinsame Prozessarchitektur bleibt bestehen; sie ist keine Isolation der
Regelung von allen UI-/Verwaltungsfehlern.

## Durchgeführte Prüfungen

Ausführung auf Node.js 24.22.3. Tests mit Datenbank-/Zeit-Doubles, echte lokale HTTP-Verbindungen und Controllerprüfung sind getrennt ausgewiesen. Die folgenden Zählungen überlappen teilweise und werden nicht zu einer vermeintlichen Gesamtzahl addiert.

| Prüfung | Ergebnis / Rohbeleg |
| --- | --- |
| Backend, Frontend, Installer, UI-Runtime | Alle Builds Exit 0; 164 kanonische Runtime-Dateien erzeugt. `*-build.log` |
| Gesamter Unit-/Integrationstest der Module | 364 bestanden, 0 fehlgeschlagen, 2 umgebungsbedingte Auslassungen; `all-unit-tests.log` |
| Beibehaltene Sicherheitsprüfungen | 48 bestanden, 0 fehlgeschlagen; zweiter Lauf in `all-unit-tests.log` |
| Erzeugte Backend-/HTTP-Runtime | 59 bestanden, 0 fehlgeschlagen; `built-runtime-tests.log` |
| Hosted-HTTP nach ergänzten Quellkommentaren | 17 bestanden; `hosted-final-tests.log` |
| Frontend-Navigation/Artefaktprüfung | 14 bestanden; 74 erfasste JS-Module, 73 über App/Federation erreichbar; `frontend-tests.log`, `frontend-graph.log` |
| Neue HTTP-Grenze, Typprüfung/Lint | Strikte TypeScript-Prüfung und gezieltes ESLint bestanden; `hosted-http-typecheck.log`, `changed-http-lint.log` |
| Subscription-Änderung und allgemeines Lint | Exit 0; `changed-backend-lint.log`, `unified-lint.log`; 15 Subscription-Tests einschließlich späten Disconnects |
| Registry/Host-Löschung | 12 bestanden gegen ausgeliefertes JavaScript; `datapoint-cache-after-runtime.tap` |
| History-Ressourcen und Fehlerfälle | 30 bestanden im fokussierten Lauf; `history-api-focused.tap`, `HISTORY-905-02.md` |
| EMS-Regressionsprüfung | 208 NVP-/Dynamic-Grid-Tests und 14 gezielte EMS-Skripte bestanden; zwei nachweislich bereits in 9.0.4 veraltete Testannahmen aktualisiert. Vorher-/Baseline-/Nachher-Belege in `datapoint-ems-regressions/README.md`; keine Produktionsänderung dafür. |
| Controller und TLS | 12 bestanden, 2 durch Dateisystemrechte bedingte Auslassungen, Exit 0; `controller-integration.log`. Installierte Runtime: 809 Dateien bytegleich, 0 Abweichungen; `installed-runtime-comparison.json`. |
| Bootgrafik | React-Server-Rendering, TypeScript und Assetprüfung bestanden; `BOOT-BRANDING-001.md`, `boot-assets.json`. Chromium startet hier wegen `socket() failed: Operation not permitted` nicht; kein kompletter Browser-/Zielgeräteerfolg behauptet. |
| Abhängigkeiten | Runtime, Frontend und Installer: 0 npm-Audit-Befunde. Root-Entwicklungsbaum: 14 moderate, 0 hohe/kritische Befunde; `audit-*.json`. Keine automatische Abhängigkeitsänderung. |
| SBOM | CycloneDX erzeugt; vendorten Webserver berücksichtigt; 717 Komponenten im Build-SBOM, 304 im Runtime-SBOM |

Die zwei ausgelassenen Unitprüfungen benötigen `nginx` beziehungsweise `setfacl`, die hier fehlen. Produktionsprüfungen oder Zugriffsschutz wurden dafür nicht abgeschwächt. Ein positiver Lizenztest mit dem echten Keygen 1.0.4 und kontrolliertem Trustpfad ist Bestandteil der Modultests; das ersetzt keinen positiven Hersteller-Trustimport im realen Controller unter den lokalen Dateisystemrechten.

## Reale Controllerprüfung und ihre Grenzen

Eine frische Installation des erzeugten npm-Pakets startete auf js-controller
7.2.5 mit echten Objekt-/State-Datenbanken, eigenem Adapterprozess und TLS-Listener
8188. Ein State-Sturm löste vor der ersten Browserverbindung die Socket-Drosselung
aus; nach ihrer natürlichen Erholung blieb derselbe Prozess erreichbar. Geprüft
wurden zertifikatsgeprüftes HTTPS, Anmeldung, Secure/HttpOnly-Cookie, CSRF/Origin,
Abmeldung sowie Stop und erneuter Start am selben Datenbestand. Die vorhandenen
`admin.0`-Zugangswerte einschließlich Port 8081 und Bind-Adresse blieben erhalten.
Das Admin-Objekt ist eine DB-Fixture; ein separater alter Admin-Webserver wurde
hier nicht gestartet. Hostnamen/443 wurden als Authority auf dem 8188-Listener
geprüft, nicht als eingerichteter DNS-/443-Proxy.

Die Umgebung liefert für `/` und `/etc` keine POSIX-Root-Eigentümerschaft.
Der reale Controller verweigert deshalb erwartungsgemäß den Trustimport mit
`TRUST_PERMISSIONS`; zwei davon abhängige positive Importprüfungen sind als
übersprungen dokumentiert. In diesem Controllerlauf wurde daher kein vollständig
lizenziertes EMS gestartet. Der positive Keygen-1.0.4-/Import-/Aktivierungs-/
Speicher-/Neustartpfad wurde separat über echte HTTPS-Routen mit kontrollierter
Trust-Fixture geprüft. Die vollständige History-Route wurde separat durch die
echte Express-5/4-Hostkombination mit kontrollierter Session/Lizenz geprüft.

Nur die Ermittlung der Netzwerkschnittstellen wurde wegen der Containergrenze
auf Loopback festgelegt (`test/fixtures/loopback-network.cjs`); Datenbanken,
Adapterprozess, HTTP-Routen und TLS waren real. Fehlende Repository-/Newsdaten
und der nicht durchgehend laufende Harness-Host erzeugen dokumentierte
Harness-Meldungen; dies wird nicht als funktionierender externer Repositoryabruf
ausgegeben. Keine Zugriffsprüfung wurde für den Test umgangen.

## Konkrete History-Grenzen

`HISTORY-905-02` ist ein zusätzlich bei der Prüfung gefundener Fehlerbereich:
Ungeschützte asynchrone Provider-Callbacks konnten bei `null` oder fehlerhaften
Zeilen werfen. Außerdem liefen Fallbacks bisher mit Einzelbudgets und konnten ein
unbegrenztes dichtes Zeitraster erzeugen. Das ist vom belegten vorgelagerten
`req.query.from`-Absturz getrennt zu bewerten.

Der neue Pfad verwendet insgesamt 5.000 ms für Reads/Fallbacks, höchstens 10.000
Rohzeilen und 4.096 Rasterpunkte, 4 verschiedene parallele Berechnungen sowie
höchstens 4 zwischengespeicherte Antwortpayloads mit 5 Sekunden Gültigkeit.
Größere Raster liefern 400 `EOS_HISTORY_RANGE_INVALID`, Überlast 503
`EOS_HISTORY_BUSY`. Jahresberichte verwenden 2 parallele Worker und unterstützen
weiterhin bis zu 10 Jahre. Timeout/Unload/ungültige Daten liefern bereinigte Fehlercodes. Verspätete
Antworten und Abbruch beim Stoppen sind geprüft. Ein Abbruch eines einzelnen
Browser-Clients beendet eine mit anderen Clients geteilte Berechnung nicht sofort;
sie bleibt durch die gemeinsame Deadline begrenzt.

## Synthetischer Speichervergleich der Datenpunktregistry

**Umgebung:** Node 24.22.3; isolierte Registry, 256 aktive Mappings und 50.000
fachfremde State-Ereignisse. Die Ereignisse enthalten zu 90 % Zahlen und zu 10 %
individuelle Texte mit 2 KiB. Heap-Werte werden nach ausdrücklich ausgelöster
Garbage Collection verglichen. Dies ist kein realer Adapter-/Geräte-Dauerlauf.

| Messgröße | Vorher | Nachher |
| --- | ---: | ---: |
| Zurückgehaltene Cacheeinträge | 50.256 | 256 |
| Heap-Differenz nach GC | 20.604.160 Bytes | 40.672 Bytes |
| RSS-Differenz | 51.699.712 Bytes | 12.746.752 Bytes |

Rohbelege: [datapoint-cache-memory-before.json](datapoint-cache-memory-before.json)
und [datapoint-cache-memory-after.json](datapoint-cache-memory-after.json).
Die neue Registry speichert nur konfigurierte Quell-/Alias-/Verbindungswerte.
Heartbeat-Verwandtschaft benötigt deren Zeitstempel, nicht den fremden Payload.
Elf Registry-Tests und ein Test des tatsächlichen Host-Ereigniseingangs bestehen
am erzeugten JavaScript. Generationen und Ereigniszähler verhindern, dass eine
verspätete Datenbankantwort ein neues Mapping, einen Livewert oder eine Löschung
überschreibt. Der finale Nachher-Messlauf ist an das ausgelieferte JavaScript
gebunden; Details: [MEMORY-REGISTRY-001.md](MEMORY-REGISTRY-001.md).

Die Differenzen zeigen eine konkrete vermeidbare Cachebelegung unter diesem
synthetischen Profil. Sie erklären weder den gesamten vom Nutzer berichteten
750-MB-Wert noch beweisen sie einen allgemeinen Leak oder eine feste prozentuale
Ersparnis. Der Cachebefund wird nicht als Ursache des History-Absturzes ausgegeben.

## Ergänzendes Review und Dateninterpretation

Das getrennte Code-Review fand einen Randfall bei verspäteten DB-Antworten nach
A→B→A-Wechsel; dieser wurde vor Lieferung korrigiert. Details stehen in
[read-only-review.md](read-only-review.md). Dies ist ein internes KI-Review, kein
externer Audit. Bestehende EV-Aggregate können verfügbare Teilreihen enthalten,
wenn andere Ladepunkte fehlen; Tarifhistorien nutzen vorhandene manuelle/Null-
Fallbacks. Die Stabilitätskorrektur ist keine vollständige Abrechnungsfreigabe.

## Messgrenzen und offene Abnahme

- RAM-Vergleiche müssen denselben Datenbestand und dasselbe Lastprofil verwenden.
  RSS, Heap und externe Puffer getrennt erfassen. Eine synthetische Cacheeinsparung
  ist kein Beleg für dieselbe Differenz am Nutzergerät.
- Positive Lizenz-/Trust-Prüfungen, OS-Dateirechte und reale Controllerprüfungen
  mit tatsächlichen Umgebungsgrenzen ausweisen. Keine ausgefallene Prüfung als
  bestanden umetikettieren oder Zugriffsprüfung dafür abschwächen.
- Hardware-/Regellatenzen, Gerätebefehle, NVP-Messqualität und Dauerbetrieb sind
  gesondert zu prüfen. NVP-`stale` ist kein durch die HTTP-Korrektur erklärter Fehler.
- Serienfreigabe und CRA-Konformitätsbewertung bleiben Herstelleraufgaben.
  Offene Befunde aus [SECURITY_CRA.md](../../unified/SECURITY_CRA.md) und
  [LICENSING_RUNTIME_LIMITS.md](../../unified/LICENSING_RUNTIME_LIMITS.md) bleiben gültig.

## Lieferbindung und Bedienung

Geliefert werden `NexoWatt_EOS_9.0.5_FULL_REPOSITORY.zip` und
`iobroker.eos-admin-9.0.5.tgz`. Quell-/Runtimebindung steht in
`release-validation.json`, `installed-runtime-comparison.json` und
`release-manifests/unified/`. Die abschließende Archivprüfung und externen
Artefakthashes stehen in der beigefügten `NexoWatt_EOS_9.0.5_Lieferpruefung.json`
und `NexoWatt_EOS_9.0.5_SHA256SUMS.txt`. Diese externen Prüfsummen vermeiden eine
zirkuläre Selbstreferenz im Archiv. Der lokale Veröffentlichungs-Probelauf ist
kein Upload: Git/npm und das Kundengerät wurden nicht verändert.

Anleitung: [START_HIER_9.0.5.md](../../../START_HIER_9.0.5.md).
Abnahmeschritte: [COMMISSIONING.md](../../unified/COMMISSIONING.md).
Historischer Vergleich: [Prüfbericht 9.0.4](../unified-9.0.4/PRUEFBERICHT.md).
