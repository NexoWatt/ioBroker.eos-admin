# EOS-EEBUS-906 – Integration und gezielte Vertrauens-/Stabilitätsprüfung

Stand: 23.11.2026. Lieferkomponente: NexoWatt EOS 9.0.6, `modules/eebus`. Ausgangscode: `iobroker.eebus` 0.3.0, Commit `1c0eb410d516b90d60f6e475e6822bf5836bfd66`; siehe `modules/eebus/provenance.json`. Quell-/Build-Hashes werden im gemeinsamen Release-Integritätsmanifest gebunden.

## Änderung und Risiko

Der echte SHIP/SPINE-Kern wird ohne zweite adapter-core-Instanz unter `eos-admin.N.eebus.*` integriert. Hostautorisierung, zentrale EOS-Systemlizenz, explizite Aktivierung und gestoppte Legacy-Instanzen sind Voraussetzung. Neue produktive CLI-/Root-Hilfswege oder Cloud-Zugänge wurden nicht eingeführt. Der lokale OpenSSL-Aufruf zur Geräteidentität verwendet feste Argumentlisten ohne Shell und ein 5-Sekunden-Limit. Privilegierte Ports werden abgelehnt.

Betroffene Grenzen sind Geräte-TLS, Pairing, mDNS-Eingaben, CLS-Steuerbefehle, lokal geschützte Schlüsselablage, ioBroker-Konfiguration und der gemeinsame EOS-Prozess. Die Integration erzwingt TLS-Identität und Zertifikat-Pinning, hält untrusted Frames aus dem SPINE-/Regelpfad und begrenzt Ressourcen. Root-/Hostverwaltung sowie vorhandene unabhängige Anlagenschutzfunktionen werden nicht ersetzt.

## Geprüfte Befunde

| Kennung | Ausgangsbefund | Umsetzung und Nachweis |
| --- | --- | --- |
| EOS-EEBUS-906-01 | Ausgehende SHIP-Verbindung vertraute angekündigtem SKI ohne TLS-Abgleich; eingehend war Adressfallback ohne Zertifikat möglich. | Reales X.509-Zertifikat/P-256/Datum/SKI prüfen; ausgehend SKI-Abgleich, anschließend freigegebenes SHA-256-Pinning. CERT-001..003 und SHIP-001,004,006 bestanden. |
| EOS-EEBUS-906-02 | Ungepaarte SPINE-Daten und vorzeitige PIN-Zustände konnten den Handshake umgehen. | Geordnete CMI/Hello/Protokoll/PIN-Freigabe, explizite beobachtete Gerätefreigabe, Live-Revoke. SHIP-002,003,005,008,009,011 bestanden. |
| EOS-EEBUS-906-03 | Ungefangene asynchrone Aufrufe, mDNS-Fehler und unbeschränkte/überlappende Arbeit konnten EOS destabilisieren. | Begrenzte Frames/Sitzungen/Queues/Discovery, lokale Fehlerpfade, überlappungsfreie Timer, Bonjour-Transport- und Callback-Fehlerhandler. mDNS-Fehlertest (5 Fehlerpfade), SHIP-007,010,013,014 und Hosted-Lifecycle bestanden. |
| EOS-EEBUS-906-04 | Private Identität wurde in native Konfiguration geschrieben; beschädigte Identität konnte ersetzt werden. | Installationseigene Datei 0600/Verzeichnis 0700, Keypair-/Fingerprint-Abgleich, begrenzte Lesegröße, keine automatische Ersetzung bei Fehler. IDENTITY-001 bestanden. |
| EOS-EEBUS-906-05 | Dry-run deckte aktive eingehende CLS-Bridge nicht ab. | Dry-run + aktive CLS-Freigabe + Terminal-Lizenzprüfung gelten für Steuerweg. Bestehende Bridge-/CLS-Regressionen mit ausdrücklicher Freigabe bestanden; Standardkonfigurationsgrenze im Hosted-Test bestanden. |
| EOS-EEBUS-906-06 | Datenbankverzögerung konnte erstes CMI verlieren oder parallele doppelte Verbindungen zulassen. | Nachrichtenannahme vor erster DB-Wartephase, begrenzte Queue, erneute Verbindungseigentümer-/Kapazitätsprüfung nach Await. SHIP-010 und014 bestanden. |

Diese Befunde betreffen die integrierte Kopie. Der externe eigenständige EEBus-Repositorystand wird damit nicht als nachgebessert veröffentlicht.

## Tatsächliche Prüfungen

Buildumgebung: Linux, Node.js v24.22.3, TypeScript 6.0.3, OpenSSL 3.5.7; `ws` 8.22.0 und `bonjour-service` 1.4.4 aus dem Root-Lockfile.

- `tsc -p modules/eebus/tsconfig.json`: bestanden, Strict-TypeScript, keine Fake-Node-Shims übernommen.
- `tsc --allowJs --checkJs --noEmit --strict --target ES2022 --module Node16 --moduleResolution Node16 --skipLibCheck --types node modules/eebus/admin/index.js --ignoreConfig`: bestanden; Eingaben aus API werden für die Formularansicht geprüft, DOM-Ausgabe über textContent.
- `node --test modules/eebus/test/security.test.js modules/eebus/test/hosted.test.js modules/eebus/test/mdns-errors.test.js`: **23/23 bestanden** (18 Sicherheits-/Netzwerk-/Identitätstests, vier Hosted-/Migrations-/Konfigurationstests, ein mDNS-Fehlerinjektionstest).
- `node modules/eebus/test/config.js`: bestanden.
- `node modules/eebus/test/cls-control-parser.js`: bestanden.
- `node modules/eebus/test/nexowatt-bridge.js`: bestanden.
- `node modules/eebus/test/implementation-result-order.js`: bestanden.

Die SHIP-Suite nutzt echte temporäre Zertifikate und lokale TLS-/WebSocket-Verbindungen. Die gegenseitige Datenübertragung wurde mit zwei Instanzen dieses Protokollkerns geprüft. Zusätzlich simulieren Tests langsame Datenbankantworten, Widerruf während asynchroner Prüfung, doppelte Verbindungsanforderungen, beschädigte Identitätsdateien und Bonjour-Socketfehler. Die Legacy-Bridge-Testfixtures wurden auf ausdrückliches `commandDryRun=false` und explizites Gerätevertrauen umgestellt; vorherige Tests hatten unbeabsichtigt aktiven Betrieb trotz Dry-run angenommen. Der Kopplungsstandard bleibt geschlossen.

## Migration, Datenschutz und Betrieb

Import aktiviert kein Gerät: unterstützte Konfiguration wird deaktiviert übernommen, Testmodus aktiviert, aktive CLS-Übernahme deaktiviert und neue Kopplung verlangt. Alte Konfiguration/Zustände bleiben zur Wiederherstellung bestehen. Private Schlüssel/Zertifikate und PIN werden nicht unbemerkt übertragen. Gerätekennungen, lokale IP-Adressen und Messwerte verbleiben in den bestehenden lokalen ioBroker-Datenflüssen; keine neue Telemetrie. Aufbewahrung, Backups und Zugriffsrechte richten sich nach dem konkreten Betreiberprofil.

Adminformular, Kopplung, Import, Rückkehr zur Systemverwaltung und Dashboard sind enthalten. Serverrechte/CSRF und Host-API werden zusätzlich im Root-Integrationsbericht nachgewiesen. EEBus erhält keine eigene Lizenzaktivierung und keinen Hersteller-Signierschlüssel.

## Grenzen und Freigabestatus

Technisch geprüfter Integrations-/Feldteststand. Nicht ausgeführt: physische Wallbox-/CLS-/Wärmepumpen-/Speicherprüfung, Zielnetz-mDNS, aktive Anlagenwirkung, Dauerbetrieb/RAM auf dem Zielgerät, EEBus-Zertifizierungsprüfung. Herstellerabhängige SPINE-Adressen/Bindings/Use-Cases und PIN-Interoperabilität bleiben offen. Ausgangstypen besitzen weiterhin Legacy-`any`-Schnittstellen innerhalb des übernommenen Protokollkerns; neue Host-/Konfigurations-/Zertifikatsgrenzen sind enger typisiert und geprüft. Eine vollständige Typ-/Lintmodernisierung des übernommenen Feldtestkerns ist kein behauptetes Ergebnis.

Keine pauschale CRA-/IEC-/EEBus-Konformität oder Produktionsfreigabe. Produktabgrenzung und Lieferkettennachweis werden im gemeinsamen Release fortgeschrieben; die notwendige gerätebezogene Herstellerabnahme und organisatorische Konformitätsbewertung bleiben separat. Anleitung einschließlich Backup, Neu-Pairing, Testmodus und Rückfall: `modules/eebus/docs/INTEGRATION_9_0_6_DE.md`.
