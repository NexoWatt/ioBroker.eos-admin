# EOS 9.0.7 – lokale NexoWatt-Zertifikatsverwaltung

Stand 23.11.2026. Gegenstand: `src/lib/eosTlsManager.ts`, `src/lib/eosTlsHttp.ts`, Einbindung in `src/lib/web.ts`, `public/eos-tls/`, `tools/eos-tls-issuer.cjs`. Ausgangsstand 9.0.6 verwendete die vorhandene ioBroker-Zertifikatsverwaltung ohne eigenen Geräte-CSR-/Herstellerprozess.

## Umsetzung und Grenzen

- Adminrolle, frische gemeinsame Sitzungsprüfung, Origin- und CSRF-Schutz vor jeder Änderung; öffentliche CSR und Root-Cert nur nach Authentifizierung herunterladbar. Lizenzstatus wird nicht als Ersatz für Authentifizierung verwendet.
- P-256-Geräteschlüssel bleibt in der privaten Instanzablage; keine privaten Hersteller-Schlüssel im Lieferumfang. Offline-CA-Werkzeug erzeugt verschlüsselte P-384-CA und signiert explizit erlaubte Endgeräte-SAN. Hersteller-CA und EOS-Lizenzschlüssel sind getrennte Schlüsselrollen.
- Privates Verzeichnis 0700 / Dateien 0600, Eigentümerprüfung, begrenzte Dateien, keine Symlinks/harten Mehrfachlinks an gelesenen Geheimdateien. Innerhalb desselben Dienstkontos besteht keine Isolation gegen bösartigen Code; keine solche Behauptung.
- Feste OpenSSL-Ausführung ohne Shell, bereinigte Laufzeitumgebung, maximal 5 Sekunden / 128 KiB Prozessausgabe, maximal ein Schreibvorgang gleichzeitig, maximal 32 SAN und fünf Kettenzertifikate. Crypto-Public-Key-Profile begrenzen RSA auf 2048–4096 Bit und EC auf P-256/P-384. Anwendungsprozess benötigt keine erhöhten Rechte.
- Prüfung von Schlüsselbindung, SAN ohne CN-/Wildcard-Ersatz, Endgeräte-CA-Verbot, explizitem HTTPS-EKU, CA-Signatur/Kette/Zeiten, Fingerabdruck und begrenzter Blatt-Laufzeit. Atomare Ablage, verknüpfte Anfrage-ID und Wiederanlauf verhindern gemischte Schlüsselstände beziehungsweise alte Antworten nach Anfragewechsel.
- Erstübernahme benötigt einen regulären Adapterneustart; kein Neustart durch den Webimport. Danach Erneuerung mit gemeinsamem Standard-/SNI-Kontext ohne Listenerneustart. Bestehende ioBroker-Zertifikatssammlungen bleiben im bisherigen Modus erhalten; die ausdrückliche Übernahme wählt anschließend den eigenen lokalen Gerätezertifikatsmodus.
- Private CA benötigt ausdrücklich eingerichtetes Vertrauen auf Endgeräten. DNS/mDNS/443 sind getrennt. Keine automatische Gerätevertrauenseinrichtung, kein öffentlich vertrauenswürdiger CA-Status, keine CA-Schlüsselverteilung auf Kunden-EOS, keine pauschale CRA- oder TLS-Produktzertifizierung.
- Betrieb benötigt verfügbares OpenSSL. Kein automatischer CRL-/OCSP-Dienst; kein Hintergrund-Ausstellungsdienst oder automatische Hersteller-CA-Erneuerung. Kundenbezogene Sperr-/Erneuerungs- und Supportprozesse sind vor Serienfreigabe festzulegen.

## Tatsächliche Prüfungen

`node --test test/eos-tls-management.test.cjs`: **9/9 bestanden**. Die Tests erzeugen eine ausschließlich synthetische, verschlüsselte CA in temporären Verzeichnissen und löschen die Dateien anschließend. Gemessene Laufzeit des Prüflaufs ungefähr 4,1 Sekunden. Node.js 24.22.3 / Linux, UID 1000 ohne Rootrechte; keine Verbindung zum Kundengerät.

| Prüfung | Ergebnis |
| --- | --- |
| Offline-CA-Werkzeug → privater Geräteschlüssel/CSR → signiertes Zertifikat → Import | Bestanden |
| Öffentliche Status-/Downloadantworten ohne private Schlüssel; Dateirechte | Bestanden |
| Tatsächlicher Produktions-Helfer `createEosServer` mit HTTPS: vom Root geprüfter SNI- und IP-Handshake | Bestanden |
| Erneuerung: neuer Fingerabdruck für IP und Namen, gleicher Listenerport; Persistenz nach erneutem Laden | Bestanden |
| Falsche SAN, falsche Anfrage-ID, falscher Fingerabdruck, anderer Geräteschlüssel, Nicht-CA, abgelaufenes Blatt und abgelaufene CA | Abgelehnt; vorherige Identität unverändert |
| Fehlgeschlagene atomare Speicherung und eingespritzter Fehler beim TLS-Kontextwechsel | Vorherige Identität und ausstehende Anfrage bleiben erhalten |
| Nach Commit fehlgeschlagene Bereinigung oder Verzeichnis-synchronisierung | Übernahme wird korrekt als erfolgt mit ausdrücklicher Warnung gemeldet; kein fälschlicher Misserfolg |
| Zwischen-CA läuft vor dem Gerätezertifikat ab | Früheste Kettengültigkeit und Erneuerungswarnung korrekt; bei abgelaufener Zwischen-CA Status ungültig |
| Parallelzugriff, ausdrücklicher Anfragewechsel, Wiederholung bereits verbrauchter Antwort, Stromausfall-Rest einer alten Anfrage | Bestanden |
| Ungültige Namen/Konfigurationsfragmente, zu viele Namen, ungeschütztes Verzeichnis und Symlink auf Geheimdatei | Abgelehnt |
| Echte HTTP-Routen + gemeinsame EOS-Sitzungsgrenze: Admin/Installer/anonym, Origin, CSRF, öffentlicher CSR-/Root-Download | Bestanden |
| Ungültiges JSON, übergroße Anfragen und unfreigegebene Dateipfade | Abgelehnt |

Ein zunächst reproduzierter Fehler bei verbotener Betriebssystem-Netzwerkschnittstellenabfrage wurde behoben: Die Abfrage dient nur als Vorschlag für SAN; ihr Ausfall verhindert weder CSR-Speicherung noch Statusseite. Das Ergebnis kennzeichnet `addressDiscoveryUnavailable` und lässt Namen/IP-Adressen manuell eingeben.

Typed ESLint für die beiden neuen TS-Module, die bestehenden Regeln für das Herstellerwerkzeug und `tsc --noEmit -p tsconfig.build.json` wurden ausgeführt, ohne Fehler. Die zentrale Build- und Paketprüfung wird im übergeordneten 9.0.7-Prüfbericht nach dem gemeinsamen Build dokumentiert; dieser Teilbericht beansprucht keinen noch nicht ausgeführten Gesamtbuild.

Zusätzlicher gemeinsamer Lauf `node --test test/eos-unified-listen.test.cjs test/eos-tls-management.test.cjs`: **34/34 bestanden**, einschließlich vorhandener Zertifikatssammlungen, HTTPS ohne Downgrade, benannter und IP-Zugänge, Sitzungs-/Loginweiterleitungen, verzögerter UI-Initialisierung und nicht wiederbelebbarer Steuerung nach Berechtigungsentzug. Die neue Installation-Root-Hook erhält im Controller-Test seine explizite `controllerDir`-Fixture.

## Noch vor Kundenfreigabe

Echte Windows-/iOS-/Android-/macOS-Vertrauensinstallation, Browserdarstellung, Zielgerät mit 443-Dienst, Hersteller-Sicherungs-/Wiederherstellungstest und tatsächliche EOS-Dauerlast sind hier **nicht ausgeführt**. Die HTTPS-Tests verwenden echte lokale TCP-/TLS-Verbindungen und synthetische Benutzer-/Controllerdaten; sie sind keine Hardware- oder Serienabnahme. Die Autorisierung eines Dateisystems unter Windows muss über dessen tatsächliche NTFS-Rechte geprüft werden.

Bedien- und Wiederherstellungsanleitung: `docs/unified/NEXOWATT_TLS_DE.md`. Rohbeleg des abschließenden TLS-Prüflaufs: `tls-tests.log` in diesem Berichtordner. Der Gesamtlieferstand bindet Quellen und Build über die Freigabemanifeste.

## Ergänzende Eingangsdateiprüfung des Herstellerwerkzeugs

Der separate Code-Review hat die CSR auf eine private Kopie festgelegt, die für Prüfung und Signierung unverändert verwendet wird. Der Dateileser prüft geöffnete Dateien über denselben Deskriptor und liest höchstens Limit + 1 Bytes; Symlink-/Dateiaustausch, Wachstum und Trunkierung umgehen die Größenprüfung nicht mehr. `node --test test/eos-tls-issuer-files.test.cjs test/eos-tls-management.test.cjs`: **12/12 bestanden**. Drei zusätzliche Prüfungen betreffen Symlinks/Dateirechte, Wachstum während des Lesens und Trunkierung. ESLint für `tools/eos-tls-issuer.cjs` ohne Fehler. Details und Rohbeleg: `TLS_CODE_REVIEW.md`, `tls-independent-review-tests.log`.
