# Installiertes npm-Paket: Untersuchung von MODULE_NOT_FOUND

Stand: 25.11.2026. Untersucht wurde das tatsächlich ausgelieferte
`iobroker.eos-admin-9.0.25.tgz`, SHA-256
`4629bd42a87f8aca652a092889b2382a57649d2da7b398e00524d61b3ec7128b`.

**Ergebnis: Der Git-Lieferweg verliert nachweislich kompilierte Moduldateien;
das vollständige npm-Paket startet in der isolierten Prüfung erfolgreich.**
Die beiden Befunde sind zu trennen. Der Nutzer bestätigt inzwischen, dass
über npm alle betroffenen Module einschließlich OCPP wieder laufen. Dies ist
ein Nutzerbericht, kein selbst durchgeführter Geräte- oder Steuerungstest.
Die vorherige konkrete Ursache des OCPP-Fehlers auf dem Pi ist nicht belegt.

## Bestätigter Git-Fehler und tatsächlicher npm-Registry-Abgleich

Die ausgelieferte 9.0.25-`.gitignore` enthält `**/build` mit einer Ausnahme
ausschließlich für das Root-Buildverzeichnis. Ein frisches `git add .` und
anschließendes `git archive` verlieren dadurch 47 kompilierte Dateien unter
`modules/eebus/build`, `modules/backup/build` und `modules/ocpp/build`.
Im tatsächlich exportierten 9.0.25-Code laden die Geräte weiterhin; EEBus,
Sicherung und OCPP scheitern alle unmittelbar mit
`MODULE_NOT_FOUND: Cannot find module './build/index.js'`.
`baseline925-git-export.json` dokumentiert diese Reproduktion.
Die 9.0.26-Ausnahmen nehmen gezielt diese drei gelieferten Buildverzeichnisse
in Git auf. Ein Regressionstest prüft sämtliche enthaltenen Dateien mit einem
frischen Git-Index und Archiv; fremde Build- und Abhängigkeitsverzeichnisse
bleiben ausgeschlossen. Weitere Git-Lieferpfade werden im unabhängigen Review
und im abschließenden Git-Exporttest geprüft.

Zusätzlich wurde `iobroker.eos-admin@9.0.25` tatsächlich aus der öffentlichen
npm-Registry gelesen und heruntergeladen, ohne etwas zu veröffentlichen.
Alle **3.186 entpackten Dateien** besitzen dieselben SHA-256-Dateihashes wie
das ursprünglich ausgelieferte TGZ: keine fehlende oder abweichende Datei.
Die OCPP-Einstiege, `build/server.js`, `runtime.js` und `native-defaults.json`
sind enthalten. Die TGZ-Container haben unterschiedliche Hashes; das ist
kein Unterschied ihrer Dateiinhalte. Details und beide Archivhashes stehen
in `registry925-comparison.json`. Ein allgemeiner fehlender npm-Lieferbestand
ist damit für diese geprüfte Registry-Version nicht nachgewiesen.

## Reproduktion

Das TGZ wurde für Node 22.23.4 und Node 24.22.3 jeweils in ein eigenes Verzeichnis
außerhalb des Quellbaums entpackt. Das zum gleichen ausgelieferten ZIP gehörende
Root-Lockfile wurde ergänzt. Anschließend:

```sh
npm ci --omit=dev --no-audit --no-fund --offline
NODE_PATH= NODE_OPTIONS= EOS_INSTALLED_PACKAGE_ROOT=/absolute/path/to/extracted/package node --no-global-search-paths --test --test-concurrency=1 test/eos-installed-package.integration.cjs
```

Beide Installationen mit npm 11.19.1 waren erfolgreich und installierten je
451 Pakete. Installationsskripte waren im dokumentierten abschließenden Lauf
**aktiv**. Alle sieben install/postinstall-Hooks endeten mit Exit 0; die
entsprechenden npm-Protokollzeilen liegen in `baseline925-node*-lifecycle.log`.
Ein anfänglicher Orientierungslauf mit `--ignore-scripts` ist nicht Grundlage
dieses Installationsnachweises. `--offline` verwendet den lokalen npm-Cache mit
Lockfile-Integritätsprüfung, keine bereits vorhandene node_modules-Struktur.
Der Pakettest lehnt zusätzlich existierende externe Modul-Suchverzeichnisse
ab. Damit können weder Quellbaum-Abhängigkeiten noch globale Laufzeitpakete
einen fehlenden Import verdecken. Worker übernehmen `NODE_PATH` ohnehin nicht.

## Durchgeführte Prüfung

| Prüfung | Node 22 | Node 24 |
| --- | --- | --- |
| Produktionsabhängigkeiten innerhalb des isolierten Pakets; keine node_modules-Verknüpfung zum Quellbaum | bestanden | bestanden |
| Alle vier realen Modulvalidatoren: aktivierte Konfiguration und gespeichertes Aus | bestanden | bestanden |
| Tatsächlicher kompilierter Host: Konfiguration laden und Geräte, EEBus, Sicherung, OCPP als eigene Worker starten | bestanden | bestanden |
| Moduleinstellungen und Prozessstatus über echte HTTP-Routen aus dem Paket | bestanden | bestanden |
| Unauthentifizierter API-Aufruf abgelehnt | bestanden | bestanden |
| OCPP 1.6, 2.0.1 und 2.1: BootNotification und Heartbeat über Loopback-WebSocket | bestanden | bestanden |
| EEBus-Worker beenden und starten: neue PID, gleiche Identität, OCPP bleibt aktiv | bestanden | bestanden |

Die beiden Testfälle enthalten diese mehreren Prüfungen; Rohprotokolle:
`baseline925-node22.log` und `baseline925-node24.log`.

## Änderung für die Fehlerdiagnose

`eosModuleLoad` normalisiert fehlende Imports zu
`EOS_MODULE_DEPENDENCY_MISSING`. Das Serverprotokoll nennt ausschließlich den
geprüften Importnamen und relative Quellpfade innerhalb des installierten
Pakets. Es gibt keine rohen Fehlertexte, absoluten Installationspfade oder
Konfigurationswerte aus. Parent und Worker verwenden denselben Diagnosepfad;
die Prozessgrenze transportiert nur den Fehlercode. Tests enthalten einen
tatsächlich fehlenden relativen Import sowie unterdrückte fremde Pfade und
Fehlertexte. Die Wiederanlaufbehandlung dieses permanenten Fehlers wird separat
in den Lebenszyklustests geprüft.

## Aussagegrenzen und nächster Schritt

Linux x64, kein Raspberry Pi/ARM64. Die Datenbank-, Lizenz- und
Sitzungsbereitstellung sind kontrollierte Fixtures. Die realen Modulprozesse,
Pakete, Netzwerk-Routen und OCPP-Transporte wurden nicht ersetzt. Geräte sind
leer konfiguriert, EEBus-Discovery/SHIP-Server/Autoverbindung und Backup-Zeitpläne
explizit ausgeschaltet. Es wurde kein physisches Gerät geschaltet, kein Backup
ausgeführt und keine EEBus-Multicast-Interoperabilität bestätigt. Die gesonderte
vollständige ioBroker-Controller-Integration bleibt durch die bekannte
`os.networkInterfaces()`-Einschränkung der Prüfumgebung begrenzt.

Der final gepackte 9.0.26-Lieferstand muss denselben expliziten Pakettest nach
einer neuen isolierten Produktionsinstallation bestehen. Falls ein fehlender
Import erneut auftritt, macht die neue Diagnose den betroffenen Import und
seinen relativen Quellpfad sichtbar. Die inzwischen vom Nutzer bestätigte
Wiederherstellung über npm ersetzt keine Prüfung physischer Gerätebefehle,
des PV-Ladestopps oder des Dauerbetriebs auf dem Raspberry Pi.
