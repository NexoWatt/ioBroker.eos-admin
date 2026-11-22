# NexoWatt EOS 9.0.2 – Lizenzkorrektur und Wiederherstellung

Stand: 22.11.2026 · NexoWatt / Dominique Manteufel  
Paket: `iobroker.eos-admin@9.0.2` · kontrollierter Teststand für `next`.

## Ergebnis

Ein reproduzierbarer Fehler im Lizenzspeicher ist korrigiert: Die bisherige
Pfadprüfung konnte gruppenbeschreibbare ioBroker-Laufzeitverzeichnisse ablehnen,
obwohl sie dem Dienstbenutzer und seiner primären Gruppe gehören. Dadurch konnte
die Lizenzinitialisierung mit `STORAGE_UNSAFE_PATH` scheitern. Der Screenshot
allein beweist nicht, dass dies die einzige Ursache auf dem Kundengerät war.

Die neue Prüfung begrenzt die Ausnahme auf die explizit aus dem Controllerpfad
abgeleitete Runtime. Fremde Eigentümer/Gruppen, Symlinks, unzulässige Schreibrechte
und Pfade außerhalb dieser Grenze bleiben gesperrt. Der private Lizenzordner
bleibt 0700, Dateien bleiben 0600. Vorhandene Hostrechte werden nicht umgeschrieben.
Die ioBroker-Dienstgruppe gehört zur Vertrauensgrenze, da sie bereits den
Runtimecode und die Daten verändern kann.

Die Lizenzseite und der Systemdialog besitzen den Reiter **„Öffentliche
Prüfschlüssel & Wiederherstellung“**: öffentlicher JSON-Import, Export, Anzeige
von Aussteller-ID/Fingerprint und erneute Prüfung der gespeicherten Lizenz.
Konkrete Fehlercodes erscheinen auch oben im Statusbereich. Eine fehlgeschlagene
oder noch laufende Prüfung zeigt keine veraltete Freigabe mehr an.

Der vollständige positive Softwareweg wurde mit dem Original-Aussteller des
Keygen 1.0.4 und temporären Testschlüsseln geprüft: echte HTTPS-Anfrage, Import,
NWL3-Pro-Aktivierung, verschlüsselte Speicherung unter einer Runtime mit Modus
2775 und gültige Lizenz nach Dienstneustart. Derselbe Test ist gegen die gebaute
JavaScript-Laufzeit bestanden. Es wurde keine Kundenlizenz erzeugt und kein
privater Herstellertresor verwendet.

## Öffentliche Schlüssel und Lizenzvertrag

Die vom Hersteller bereitgestellte öffentliche Datei ist in den Freigabemetadaten
von 9.0.2 autorisiert:

- Aussteller-ID: `nexowattEOS-3cb665e3fc6f4085a04b8db3e692cac5`
- SHA-256 über kanonisches SPKI-DER:
  `a485fd6e28195a0a0e458b304e95025c0bd516d97f3cb1443beb78ed9cfe4856`

Die Freigabemetadaten aktivieren weder einen Truststore noch eine Lizenz
automatisch. Der Administrator muss den öffentlichen Schlüssel importieren oder
eine gültige OS-Provisionierung verwenden. Beliebige neue Schlüssel, private
Tresordateien und abweichende Schlüssel unter gleicher ID werden abgewiesen.
Eine zur Geräte-UUID passende, korrekt signierte Lizenz bleibt erforderlich.

Importierte Schlüssel werden bei jeder Auswertung erneut autorisiert. Ein
explizites `NEXOWATT_LICENSE_TRUST_FILE` ist eine abschließende OS-Allowlist;
Release-Pins dürfen sie nicht erweitern. Unsicherer vorhandener OS-Trust sperrt
auch den Wiederherstellungsweg. Default-OS-Trust und bewusst importierte
Release-Pins sind unabhängig: Ein Pin wird durch ein Release-Pin-Update oder eine
einschränkende explizite OS-Policy entzogen, nicht allein durch Löschen einer
Default-OS-Datei. Details: `docs/unified/LICENSE_RECOVERY_9.0.2.md`.

Imports schreiben atomar eine feste Datei im privaten Instanzspeicher. Ungültige
Uploads ersetzen keine gültige Lizenz. Fehlerhafte Bestandsdateien werden nicht
stillschweigend gelöscht; eine gezielte Reparatur bleibt erforderlich. Die
Wiederherstellung setzt weder den Zeit-Höchststand noch eine erkannte
Uhr-Rollback-Sperre zurück. TLS, Administratorrolle, Erstpasswortwechsel,
Origin-/CSRF-Prüfung, Raten- und Größenbegrenzungen gelten auch für neue Endpunkte.

NWL3 bleibt eine zentrale Systemlizenz für Systembereich und gehostete UI;
es gibt keine zweite UI-Aktivierung. NWL2 erhält keine zusätzlichen Rechte über
seinen signierten Umfang hinaus. Beim Wechsel des Keygen-PCs sind Tresor-Backup
und Passphrase erforderlich; der öffentliche Export ersetzt den privaten Tresor
nicht. Eine neue Geräte-UUID benötigt eine dazu passende Lizenz.

## Durchgeführte Softwareprüfungen

Linux, Node.js 24.22.3, npm 11.19.1. Tests arbeiten mit isolierten Daten und
temporären Schlüsseln; keine Energiegeräte wurden angesteuert. Teilmengen werden
nicht zu einer scheinbar unabhängigen Gesamtzahl addiert.

| Prüfung | Ergebnis | Beleg in diesem Verzeichnis |
| --- | --- | --- |
| Backendbuild | Bestanden | `backend-build.log` |
| Systemfrontend inklusive TypeScript | Bestanden | `frontend-build.log` |
| Installerfrontend und kanonische UI-Runtime | Bestanden; 163 produktive Runtime-Dateien geprüft | `installer-build.log`, `ui-runtime-build.log` |
| Unified-Suite einschließlich Lizenz-, HTTP-, UI- und Sicherheitsregressionen | 273 Fälle: 271 bestanden, 0 Fehler, 2 übersprungen | `unit-tests.log` |
| Beibehaltene Authentisierungs-, Sitzungs- und Uploadregressionen | 48 bestanden, 0 Fehler | `unit-tests.log` |
| Frontendnavigation und Buildbelege | 10 bestanden, 0 Fehler | `frontend-tests.log` |
| Frontend-Assetgraph | 74 erfasste JS-Module, 73 von Einstiegen erreichbar, ein HTML5-Backend | `frontend-graph.log` |
| Echte HTTPS-Lizenzkette gegen gebaute Runtime, Original-Keygen 1.0.4 | 5 bestanden, 0 Fehler, 0 übersprungen | `built-runtime-https-tests.log` |
| Unified-Lint und geänderte TypeScript-/Trust-Dateien | Exit 0 | `lint-unified.log`, `changed-typescript-eslint.log` |
| Zusätzliche Lizenz-Service-Typprüfung und Teilprüfungen | Bestanden im dokumentierten Umfang | `LICENSING.md` und zugehörige Logs |
| Installiertes npm-Paket im echten ioBroker-Controller | 11 bestanden, 0 Fehler, 2 umgebungsbedingt übersprungen | `integration-release.log` |

Die zwei bedingten Unified-Fälle benötigen `nginx` beziehungsweise `setfacl`, die
hier fehlen. POSIX-Modus-/UID-/GID-Tests sind davon getrennt bestanden. Die
vererbten Gruppen-ACLs des tatsächlichen Zielsystems und die optionale
443-Proxykette bleiben zu prüfen.

Ein Browserlauf wurde versucht, konnte wegen `socket() EPERM` beim Chromiumstart
aber nicht ausgeführt werden. Es gibt keine Browser-Screenshots oder visuelle
Abnahme. DOM-/API-Tests und Quellbuilds sind separat nachgewiesen; siehe
`browser-check.txt`.

## Controllerintegration und Reichweite

Der tatsächlich installierte Adapter läuft mit Controller **7.2.5**, echten
Objekt-/State-Datenbanken, TLS-Listener auf 8188 und echtem Prozessneustart.
**11 Fälle bestanden, 0 Fehler, 2 übersprungen.** Geprüft sind Zertifikats- und
Hostnamevalidierung, Loginressourcen, IP-/Namens-Authorities, anonyme/fremde
Origins, Secure-/HttpOnly-Cookie, CSRF/Logout, Aktivierungsweiterleitung sowie
Erhalt der aktivierten `admin.0`-Konfiguration auf 8081 über Start, Ereignisse,
Stop und Neustart. Der alte Admin-Webserver selbst wird nicht gestartet.
`:443`-Authorityfälle am 8188-Socket ersetzen keine Nginx-/443-Prüfung.

In dieser Ausführungsumgebung gehören `/` und `/etc` nicht POSIX-UID 0.
Der produktive Truststore-Leser lehnt dies unverändert mit `TRUST_PERMISSIONS`
ab. Der Test bestätigt diese sichere Sperre vor dem Überspringen der beiden
Herstellerschlüssel-Importfälle und nach Neustart. Auf normalem Linux mit
root-eigenen Pfaden müssen diese Fälle laufen. Eine erfolgreiche Aktivierung
innerhalb dieses Controllerlaufs wird daher nicht behauptet; der positive
HTTPS-/Keygen-/Neustartnachweis mit echter Ablage und expliziter OS-Lesefixture
ist der separat ausgewiesene Diensttest, kein Test mit einem Kundentresor.

Die Umgebung benötigt die ausdrücklich optierte Fixture
`EOS_TEST_NETWORK_FIXTURE=loopback` und
`NODE_OPTIONS="--require ./test/fixtures/loopback-network.cjs"` mit absolutem
Fixturepfad für Kindprozesse. Sie ersetzt ausschließlich die hier gesperrte
Netzwerkschnittstellen-Aufzählung; TCP, TLS, Datenbanken und Adapterprozesse
bleiben real. Der erste Vorlauf ohne diese Fixture scheiterte bereits vor
Adapterstart: Controllerinstallation unvollständig, Datenbankmodul nicht
auflösbar. Beleg: `integration-bootstrap-failed.log`. Der anschließende Lauf
mit Fixture ist `integration-release.log`; die Produktrechte wurden nicht
abgeschwächt.

**803 produktive Dateien** wurden anschließend byteweise zwischen dem
installierten Paket und den finalen Runtimequellen verglichen; alle stimmen
überein (`installed-runtime-comparison.json`). Danach geänderte Lieferberichte
ändern diese Runtime nicht.

## Abhängigkeiten, Integrität und Lieferung

Frische npm-Audits melden jeweils 0 bekannte Befunde für Runtime, Systemfrontend
und Installer. Im Entwicklungs-/Buildbaum bestehen weiterhin **14 moderate,
0 hohe und 0 kritische** Befunde; sie werden nicht als behoben ausgegeben.
Belege: `runtime-audit.json`, `frontend-audit.json`, `installer-audit.json` und
`build-audit.json`. Ein Audit ersetzt keine vollständige Sicherheitsbewertung.

Die SBOMs wurden für 9.0.2 neu erzeugt. Runtime: 304 Komponenten einschließlich
geprüftem vendortem WebServer; vollständiger Buildbaum: 717 Komponenten.
`tools/eos-sbom-vendored.cjs --check` prüft Herkunft, Patchbindung und Graph.
Keine neuen Laufzeitabhängigkeiten wurden für die Wiederherstellung hinzugefügt.

Das Repository enthält Quellen, gebaute Runtime, Oberflächen, proprietäre
NexoWatt-Lizenz, Drittanbieterhinweise, Tests und Integritätsmanifest. Der finale
Lieferlauf prüft npm-Pack, Archivpfade, bytegleichen Paketinhalt, private
PEM-Nutzlasten und das neu entpackte ZIP einschließlich Release-/SBOM-Prüfung.
Die SHA256SUMS-Datei bindet die fertigen Downloads. Prüfsummen sind keine digitale
Herstellersignatur. Es erfolgt kein Git- oder npm-Upload.

NexoWatt-eigene Anteile bleiben proprietär. Die Lizenzen übernommener Komponenten
bleiben erhalten. Ein öffentlich veröffentlichtes npm-Paket bietet keinen
Vertraulichkeitsschutz für seine Dateien.

## Verbleibende Zielgeräteabnahme

ioBroker-Admin bleibt durch EOS auf seiner bisherigen Konfiguration, regulär
8081; EOS verwendet standardmäßig HTTPS auf 8188. Die optionale Erreichbarkeit
unter `https://NexoWattEOS/` benötigt eigene Namensauflösung und 443-Konfiguration.
Diese Änderung richtet keine solchen Systemdienste ein.

Vor einer Produktionsfreigabe sind Aktualisierung der vorhandenen Instanz,
reales Anmelden/Erstsetup, Import der Herstellerdatei, Aktivierung und Neustart
auf dem Zielgerät sowie die Browserbedienung abzunehmen. Zertifikatsvertrauen,
IP-/Namens-SAN und gegebenenfalls Proxy/WebSocket/SSE gehören dazu. Physische
EMS-/Laderegelung und 50-/100-ms-Timingziele werden durch diese Lizenztests nicht
abgenommen. Historische EMS-Nachweise für 9.0.1 bleiben historische Nachweise;
9.0.2 verändert die wirtschaftlichen Regelalgorithmen nicht.

Die offenen Fortsetzungsgrenzen bei Lizenzverlust (`LIC-RUNTIME-01` bis `-03`),
TOTP-/Passkeyflow, globaler Logout und gemeinsame Prozesslaufzeit bleiben wie in
`docs/unified/LICENSING_RUNTIME_LIMITS.md` und dem 9.0.1-Bericht dokumentiert.
Dieser Teststand ist keine allgemeine Produktionsfreigabe und keine
CRA-Konformitätserklärung. Risikobewertung, Herstellerprozesse und reale
Systemabnahme bleiben gesonderte Aufgaben.
