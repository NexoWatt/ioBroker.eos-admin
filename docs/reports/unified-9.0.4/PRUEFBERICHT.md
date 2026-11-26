# NexoWatt EOS 9.0.4 – Absturz bei Ereignislast behoben

Stand: 22.11.2026 · Paket `iobroker.eos-admin@9.0.4` · NexoWatt / Dominique Manteufel.
Technischer Teststand für `next`; keine allgemeine Anlagen-, Serien- oder CRA-Freigabe.

## Ausgangslage und reproduzierter Befund EOS-SOCKET-001

Der Anwender meldete nach 9.0.3 einen wiederholten Adapterabbruch mit Exitcode 6
(`UNCAUGHT_EXCEPTION`). Nach dem EMS-Start aktivierte sich die Ereignisbegrenzung;
`Object.keys()` erhielt einen fehlenden Wert in
`@iobroker/socket-classes/build/lib/socketCommandsAdmin.js:777:46`.
`NexoLogic init failed: EOS_UI_STOPPING` erschien erst nach Einleitung des Stopps.
Es wurde kein Zugriff auf das Kundengerät ausgeführt.

**Vorher-Nachweis:** Der unveränderte 9.0.3-Produktcode reproduziert im tatsächlich
installierten ioBroker-Controller 7.2.5 dieselbe Ausnahme und beendet den Prozess.
Der neue Regressionstest scheitert dort ausdrücklich an der unbehandelten
Promise-Ablehnung. Geprüft wurden 1.068 installierte Paketdateien gegen das
ursprüngliche 9.0.3-TGZ; nur die für diesen isolierten Test neu erstellte
Integritätsdatei unterscheidet sich. Im ursprünglichen Repository-Snapshot wurden
nur Test und Testversiegelung geändert. Original-Lieferdateien bleiben unverändert.
Belege: `socket-controller-before.json` und `socket-controller-before.log`.

Ursache: Die Bibliothek beginnt mit einem leeren Abonnementbestand und legt
`subscribes.stateChange` erst bei einer Browser-State-Anmeldung an. EOS liefert
bereits ohne Browser State-Ereignisse an den Socket-Teil. Mehr als 200 Ereignisse
pro Sekunde in drei aufeinanderfolgenden Intervallen lösen den Timer aus, der
den fehlenden Bestand ohne Prüfung liest. Die früheren 9.0.3-Tests deckten diesen
Lastfall nicht ab; ihre Ergebnisse werden hier nicht als neue Nachweise ausgegeben.

Ein zweiter bestätigter Integrationsfehler betrifft gemeinsame Abonnements:
Controller-Abonnements sind Mengen, keine Referenzzähler. Browser-Abmeldung oder
Drosselung eines Musters konnte deshalb das gleiche EMS-/Ownership-Muster entfernen.

**Auswirkung / Einordnung:** Hohe Verfügbarkeitsrelevanz im gemeinsamen
UI-/EMS-Prozess; STRIDE D, CWE-248/400 als Risikozuordnung, keine behauptete CVE.
Verantwortung für Lieferung und Zielabnahme: NexoWatt.

## Umsetzung und erhaltene Grenzen

- `src/lib/eosSocketAdmin.ts` stellt den gültigen leeren Startzustand her und
  übernimmt ausschließlich den Lebenszyklus der Ereignisbegrenzung. Konfiguriertes
  Limit, drei Prüfintervalle und automatische Wiederaufnahme nach 60 Sekunden
  bleiben erhalten. Auch der manuelle Befehl benutzt den abbrechbaren Ablauf und
  behält die ursprüngliche Berechtigungsprüfung. Ausstehende Timer werden beim
  Schließen beendet; überholte asynchrone Fortsetzungen führen keine nächsten
  Abonnementaktionen aus. Fehler werden lokal behandelt und konstant diagnostiziert.
- `src/lib/eosStateSubscriptions.ts` verwaltet Host-/EMS- und Browserinteressen je
  exaktem Muster. Erst wenn beide Seiten ein Muster freigeben, wird es im Controller
  abgemeldet. Callback-/Promise- und eigene/fremde State-APIs benutzen dieselbe
  Verwaltung. Fehlgeschlagene Änderungen werden nicht als erfolgreich verbucht.
- Die gemeinsame Datenzufuhr verwendet die Dienstidentität. Die reale Socket-
  Bibliothek entscheidet weiterhin pro Browser, Befehl und veröffentlichtem State
  über den Zugriff. Negative Tests prüfen verweigerte States und den Widerruf
  eines zuvor zwischengespeicherten Leserechts. Das bestehende Controller-7-Verhalten
  für States ohne Objekt wird nicht verändert: Ein fehlendes Objekt ohne
  Datenbank-Berechtigungsfehler wird vom Upstream als lesbar behandelt; dieser
  Sonderfall wird ausdrücklich getestet, nicht als Ablehnung behauptet.
- `src/main.ts` installiert die Verwaltung vor `ready`, leitet State-Ereignisse
  zuerst an Ownership/EMS und anschließend an den Browserteil und räumt beide
  Interessenbereiche beim Stoppen auf. Während der Begrenzung bleiben
  `system.adapter.*`-Ereignisse und ihre Zugriffskontrollen erhalten; übrige
  Browser-State-Ereignisse werden begrenzt, auch wenn das EMS sie weiter benötigt.
- `@iobroker/socket-classes` ist exakt an die bereits verwendete Version **2.10.0**
  gebunden. Die neue schmale Integrationsschicht prüft den erwarteten Vertrag.
  Kein Laufzeitpatch in `node_modules`, keine neue npm-Laufzeitabhängigkeit,
  kein erhöhtes Ereignislimit und kein globales Verschlucken von Prozessfehlern.

Lizenz, Rollen, Origin-/CSRF-Grenzen und Schreibzuständigkeit bleiben serverseitig
wirksam. Bestehende Lizenz, System-UUID, Prüfschlüssel und Konfiguration werden
weiterverwendet. ioBroker-Admin bleibt auf seinem vorhandenen Zugang; EOS-Default
ist authentifiziertes HTTPS auf `0.0.0.0:8188`. History-/HTTPS-/MultiUse-Korrekturen
aus 9.0.3 sind enthalten. NVP-Stale-Warnungen und fehlende Prognosequellen bleiben
separat zu prüfen und werden nicht unterdrückt.

## Tatsächlich ausgeführte Prüfungen

Linux, Node.js 24.22.3, npm 11.19.1, Socket-Komponente 2.10.0;
Controllerintegration mit 7.2.5. Keine physische Energieanlage angesteuert.
Teilmengen und Wiederholungen gegen den gebauten Code nicht zu einer unabhängigen
Gesamtsumme addieren.

| Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| Original 9.0.3 im echten Controller, Last vor erster Browserverbindung | Erwartet fehlgeschlagen; derselbe Stack und Prozessabbruch, 0 bestanden / 1 fehlgeschlagen | `socket-controller-before.json`, `socket-controller-before.log` |
| Backend-Typprüfung/Build, UI-Runtime, Systemfrontend und Installer | Alle vier Builds bestanden; 163 Runtime-Dateien aus kanonischer Quelle | jeweilige `*-build.log` |
| Unified-Suite einschließlich neuer Socket-, Abonnement- und Shutdown-Fälle | 330 Fälle: 328 bestanden, 0 Fehler, 2 bedingt übersprungen | `unit-tests.log` |
| Beibehaltene Auth-/Session-/Uploadregressionen | 48/48 bestanden | `unit-tests.log` |
| Neue/fokussierte Socket-/Abonnement-/Lifecycle-Prüfungen | 41/41 innerhalb der Unified-Suite; 9 Threshold-, 14 Abonnement-, 18 Access-/Shutdown-Fälle | `unit-tests.log` |
| Gebaute Runtime: Socket, Abonnements, HTTPS-Start und NWL3 mit Original-Keygen 1.0.4 | 51/51 bestanden, 0 übersprungen | `built-runtime-tests.log` |
| Frontendnavigation, Einstiegskacheln und Buildbelege | 14/14 bestanden; Assetgraph konsistent | `frontend-tests.log`, `frontend-graph.log` |
| Gezieltes Backend-Lint und Unified-Lint | Exit 0, keine Lintfehler | `changed-backend-lint.log`, `lint-unified.log` |
| Installiertes 9.0.4 im Controller: Last, natürliche Wiederaufnahme, HTTPS und Prozessneustart | 12 bestanden, 0 Fehler, 2 umgebungsbedingt übersprungen | `integration-release.log` |
| Frische Audits: Runtime, Frontend, Installer | Jeweils 0 bekannte Befunde | jeweilige `*-audit.json` |
| Build-/Entwicklungsaudit | 14 moderate, 0 hohe, 0 kritische Befunde | `build-audit.json` |

Die fokussierten Tests verwenden die tatsächlichen Socket-Klassen; Controller-
Metadatensuche wird in isolierten Bibliothekstests ersetzt. Ein kontrollierter
Timer erlaubt dort schnelle Grenz-/Abbruchprüfungen. Zusätzlich wird der originale
Fehler in einem eigenen Kindprozess mit der unveränderten Bibliothek reproduziert.
Controller-Promise-Wrapper werden unverändert aus der vorhandenen Controllerquelle
geprüft, um Rekursion durch die API-Umleitung auszuschließen. Diese Fälle sind
keine Tests an Kundenhardware.

Der neue Controller-Lastfall erzeugt vor jeder Browserverbindung echte Datenbank-
Ereignisse für einen synthetischen Host-Heartbeat. Das produktive 200/s-Limit und
seine drei Intervalle bleiben unverändert. Der ursprüngliche Prozess bleibt bei
Aktivierung und natürlicher Wiederaufnahme nach 60 Sekunden am Leben; ein Ersatz-
prozess kann den Test nicht bestehen. HTTPS und die bestehende Admin-Konfiguration
werden nach beiden Übergängen erneut geprüft. Danach bestehen Anmeldung, CSRF,
Logout, geordneter Stop und Neustart des installierten Pakets an denselben Datenbanken.

Der aktivierte `admin.0`-Objektbestand mit Port 8081 und Bindung `0.0.0.0` bleibt
unverändert; ein zusätzlicher alter Admin-Webserver wird hier nicht gestartet.
Die Testumgebung nutzt eine ausdrücklich aktivierte Loopback-Fixture ausschließlich
für die hier gesperrte Netzwerkschnittstellen-Aufzählung. TCP, TLS, Datenbanken
und Adapterprozess sind echt. Der Testcontroller bleibt unlizenziert: `/` und
`/etc` besitzen hier nicht die erforderliche POSIX-Root-Eigentümerschaft. Die
unveränderte produktive Prüfung verweigert den Herstellerimport mit
`TRUST_PERMISSIONS`; zwei positive Import-Folgefälle werden deshalb übersprungen.
Diese Sperre wird für ein grünes Testergebnis nicht abgeschwächt.

Die zwei bedingten Unified-Skips betreffen hier nicht installierte Programme
`nginx` und `setfacl`. HTTPS-Tests nutzen explizites Zertifikatsvertrauen und
Hostnamenprüfung. Kein echter 443-Proxy, keine Namensauflösung im Kundennetz und
kein visueller Browserlauf sind für diesen Stand nachgewiesen. Positive NWL3-
und lizenzierte Webstartfälle werden als gesonderte Dienst-/Routerprüfungen mit
kontrollierten Vertrauens-/Status-Fixtures ausgewiesen.

## Lieferintegrität, SBOM und Grenzen

Neue CycloneDX-SBOMs für 9.0.4 wurden aus den vorhandenen Abhängigkeitsbäumen
gebildet und geprüft: 304 Runtime-Komponenten einschließlich des dokumentierten
Webserver-Vendorpatches und 717 Komponenten im vollständigen Buildgraph.
Frontend und Installer besitzen eigene SBOMs. Der Socket-Versionsbereich wurde
auf den bereits installierten Stand eingegrenzt; keine Abhängigkeit wurde aktualisiert.
Null Auditbefunde sind kein Nachweis vollständiger Sicherheit.

**807 produktive Dateien** wurden byteweise mit dem tatsächlich installierten
Controller-Testpaket verglichen; alle stimmen überein. Nachfolgende Dokumentations-
und Archivarbeiten ändern diese Laufzeit nicht (`installed-runtime-comparison.json`).
Das finale npm-Paket und vollständige Repository-ZIP werden einschließlich
Pfadsicherheit, Versionsbezug und gezielter Geheimnismuster geprüft. Das ZIP wird
neu entpackt und seine Versiegelung und SBOM werden erneut geprüft. Die finalen
Dateizahlen, Archivgrößen, Prüfsummen und der Publish-Dry-Run stehen in
`NexoWatt_EOS_9.0.4_Lieferpruefung.json` und `NexoWatt_EOS_9.0.4_SHA256SUMS.txt`.

NexoWatt-Anteile bleiben proprietär, Drittanbieterrechte bleiben erhalten.
Private Signierschlüssel, Keygen-Tresor und Kunden-Lizenzdateien sind kein
Lieferbestandteil. Es wurde nichts nach Git oder npm veröffentlicht.
SHA-256-Werte und Versiegelung sind Integritätsbelege, keine digitale Herstellersignatur.

Die Architektur bleibt ein gemeinsamer Prozess und eine gemeinsame Controller-
Verbindung. Die Interessenverwaltung isoliert Abonnements, keine Prozesse oder
Betriebssystemrechte. Bereits laufende Datenbankaufrufe können nicht abgebrochen
werden; der bestehende Zwei-Sekunden-Unload-Deadline begrenzt weiter das Warten
des Controllers. Fristen für reale 50-/100-ms-Regelung, physische Geräte,
Hersteller-/CRA-Unterlagen und die weiteren vorhandenen Befunde sind gesonderte
Abnahmen, die diese Reparatur nicht ersetzt.

## Update und Prüfung auf dem Gerät

Nach einer Sicherung die vorhandene Instanz mit 9.0.4 aktualisieren; keine
ioBroker-Neuinstallation und keine erneute Lizenzaktivierung sind vorgesehen.
Anleitung: [START_HIER_9.0.4.md](../../start/START_HIER_9.0.4.md).
Nach dem Start Version 9.0.4 und `EOS_HTTPS_READY` prüfen, anmelden und Dashboard
sowie Systemverwaltung aufrufen. Mindestens zwei Minuten beobachten, danach
einmal kontrolliert neu starten. Erwartet: kein `UNCAUGHT_EXCEPTION`, Lizenz
weiter gültig, Webzugang erreichbar, bestehende Anlagenkonfiguration erhalten.
Keine Lastflut auf der realen Anlage erzeugen; dieser Test wurde isoliert durchgeführt.

Die tatsächliche Erreichbarkeit, Gerätekommunikation und Messpunktzuordnung
auf Dominiques Gerät bleiben offen. Ein zusätzlicher dortiger Konfigurations-
oder Hardwarefehler wird durch den nachgewiesenen Softwarefix nicht ausgeschlossen.
