# Node.js 22 und 24 – Kompatibilitätsnachweis 9.0.8

Stand: 23.11.2026. Node.js 22 bleibt eine unterstützte Laufzeitlinie.

## Vertrag

Das bestehende Paketprofil bleibt `>=22.23.4 <23 || >=24.22.1 <25`.
Ein Wechsel bestehender Node-22-Anlagen auf Node 24 wird durch dieses Adapterupdate
nicht erzwungen. Ältere Node-22-Patchstände müssen auf einen zulässigen Patchstand
der 22er Linie aktualisiert werden.

Die CI-Datei `.github/workflows/test-and-release.yml` prüft jetzt getrennt mit
Node.js **22.23.4** und **24.22.3**; `fail-fast: false` erhält die Ergebnisse beider
Laufzeitlinien. Build, Typprüfung, Linting, Tests und Frontend-Builds werden in beiden
Jobs ausgeführt. Das ist die eingecheckte Konfiguration; ein GitHub-CI-Lauf wurde
hier nicht gestartet.

## Tatsächliche lokale Umgebung

Linux x64, unprivilegierter Prozess. Node.js 22.23.4 wurde isoliert aus dem
versionierten Paket `node-linux-x64@22.23.4` geladen; die vorhandene Node-24-Laufzeit
und die Systeminstallation wurden nicht ersetzt. npm-Paketintegrität zusätzlich
mit SHA-512 gegen die Registry-Angabe geprüft:

`sha512-Bi7VlP4LNQBy6W40tvqfXKPMGT9tnrs7pybiox7yqQMSiMagKuZyyIIb/pYM2dbtPlXyQnLif0ZtgyUIImQQkQ==`

Der entpackte Interpreter meldet `v22.23.4`. Vor dem Entpacken wurden Archivpfade,
Dateitypen und Gesamtgröße geprüft.

## Ergebnisse

- `npm test` mit Node.js 22.23.4: **846 bestanden, 2 übersprungen, 0 fehlgeschlagen**.
  Aufteilung: Unified 430 bestanden/2 übersprungen, Bestandsregressionen 48,
  Module 301, EEBus-Bestandsfälle 4, Backup 63.
- `npm run typecheck` unter Node.js 22.23.4: **bestanden**, einschließlich der
  neuen SmartHome-Aktivierung, Frontend- und Bestandskonfigurations-Typprüfungen.
- Keygen 1.0.4 → HTTPS-Schlüsselimport → Aktivierung → verschlüsselte Ablage →
  Neustart: im Unified-Test enthalten und bestanden. Testschlüssel wurden nur
  temporär erzeugt.
- Übersprungen: nginx-Syntaxprüfung (`nginx` fehlt) und vererbte POSIX-ACL-Prüfung
  (`setfacl` fehlt). Diese Prüfungen werden nicht als bestanden ausgewiesen.
- Produktionsabhängigkeiten laut finalem Lockfile mit `cron-parser@5.10.6`:
  **249 deklarierte Node-Engine-Bereiche geprüft, 0 inkompatibel** mit 22.23.4.
  Ein passender Engine-Bereich allein ist kein Funktionsnachweis.
- Import-Smoke-Test unter Node 22 für Express 4/5, Modbus-Serial, Serialport, MQTT
  und Cron-Parser: bestanden; keine physischen Verbindungen geöffnet.

Protokolle: `node22-npm-test-privacy-final.log`, `node22-typecheck-privacy-final.log` und
`node22-runtime-engines.json` im Lieferprüflauf. Die zuvor aufgefundene
Metadatenüberschreitung (mehr als 20 News-Einträge) wurde korrigiert; die
abschließenden Ergebnisse oben stammen aus dem erneuten vollständigen Lauf.

## Datenschutzgrenze des Controller-Prüflaufs

Der ausschließlich im Test eingesetzte Preload begrenzt HTTP(S), Fetch, rohe
Node-TCP-/TLS-Verbindungen und DNS-Auflösung des installierten Adapterprozesses
auf Loopback. Auch absolute Proxy-URLs und externe CONNECT-Ziele werden vor
Transportaufruf gesperrt. npm-Installationsprozesse bleiben für den kontrollierten
Paketdownload getrennt. Sechs Prüfungen dieser Grenze bestanden unter beiden
Node-Linien; externe Ratings-URLs wurden ausschließlich gegen Transportspione
geprüft, ohne Übermittlung an den externen Dienst. Ein echter lokaler
HTTP-Austausch und die automatische Preload-Rollenerkennung wurden mitgeprüft.
Dies ist eine Testgrenze für Node-Transporte, keine Betriebssystem-Firewall.

Zusätzlich ist die optionale Bewertungsabfrage im Produkt standardmäßig
deaktiviert. Ohne ausdrückliche Freigabe wird dafür keine System-UUID gelesen
oder übertragen. Die zugehörigen Tests verwenden einen lokalen Axios-Stub.

## Installiertes Paket mit echtem Controller unter Node 22

`npm run test:integration` mit isolierter Node.js 22.23.4, Controller 7.2.5,
echten Controller-Datenbanken, installiertem 9.0.8-Tarball und eigenem
Adapterprozess: **15 bestanden, 2 umgebungsbedingt ausgesetzt, Exitcode 0**.

Geprüft wurden unter anderem Start/Stop/Neustart, tatsächliche
State-Burst-Schwelle mit automatischer Erholung, TLS einschließlich CA-/SAN-Prüfung,
Anmeldung/CSRF/Logout, Geräte-, EEBus- und Backup-Oberflächen, Speichern ohne
Controller-Neustart/Sitzungsverlust, Übernahme- und Zertifikatseiten sowie CSR.
Der Adapter meldete dabei ausdrücklich `node: v22.23.4, js-controller: 7.2.5`.
Nach Testende wurde die Freigabe von Port 8188 separat bestätigt.

Die zwei ausgesetzten Fälle betreffen erfolgreichen Hersteller-Prüfschlüsselimport
und anschließende Ablehnung eines fremden Schlüssels auf diesem Trust-Pfad.
`/` und `/etc` gehören im Testcontainer keinem POSIX-root-Benutzer, deshalb greift
die unveränderte Produktionssperre `TRUST_PERMISSIONS`. Der erfolgreiche
Keygen-/Import-/Persistenzablauf wurde im separaten oben genannten Unified-Test
geprüft; diese beiden Controller-Fälle werden nicht als bestanden gezählt.

Prüfgrenzen: `admin.0` ist eine aktivierte Datenbankfixture für den erhaltenen
8081-Zugang, kein zusätzlich gestarteter Admin-Webserver. Host-/443-Anfragen
prüfen Authorities auf dem realen 8188-Listener, keinen tatsächlichen 443-Proxy.
Der Prüflauf benötigt keine Produktivgeräte und weist deren Kommunikation nicht
nach. Protokoll des abschließenden Laufs: `node22-integration-loopback-final.log`.
Dieser Lauf verwendet den finalen Produktcode mit standardmäßig abgeschalteten
externen Ratings sowie den isolierten Egress-Preload. Ein vorheriger Prüflauf
scheiterte ausschließlich an der zu engen Test-DNS-Regel für den lokalen
Wildcard-Bind `0.0.0.0`; die Fixture wurde korrigiert und mit einer tatsächlichen
Wildcard-Listenerprüfung ergänzt. Verbindungen zu nicht lokalen Zielen bleiben
gesperrt. Die oben genannten 15 bestandenen Controller-Fälle stammen aus dem
frischen vollständigen Wiederholungslauf.

## Grenzen

Lokale Softwaretests sind keine Anlagenabnahme. Physische Modbus-/Seriell-/EEBus-
Geräte, Linux ARM64 und ein Kundenbestand müssen auf der jeweiligen Zielanlage
geprüft werden. Die Mindestpatchstände ersetzen keine laufende Bewertung neuer
Node.js-Sicherheitsmeldungen.
