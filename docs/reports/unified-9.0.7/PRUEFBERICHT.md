# NexoWatt EOS 9.0.7 – Änderungs- und Prüfbericht

Stand: 23.11.2026. Basis: ausgeliefertes EOS 9.0.6. Ziel: vorhandene Instanz
`eos-admin.N`, Prüfkanal `next`. Prüfumgebung: Linux x64, Node.js 24.22.3.
Dies ist eine Integrationstestlieferung, keine allgemeine Kunden-/Serienfreigabe
und keine CRA-Konformitätserklärung. Es bestand kein Zugriff auf das Kundengerät.

## Ergebnis und behobene Fehler

**Geräte speichern:** Das Schreiben in die eigene ioBroker-Instanz löste nach
Controller-Verhalten einen Neustart aus. Gerätekonfiguration liegt jetzt in einem
separaten, verschlüsselten Objekt mit restriktiver ACL, Revision und Rückleseprüfung.
Der Editor erhält bei echtem Sitzungsablauf den Entwurf. Sitzungsschutz und CSRF
bleiben aktiv; kein Schreibauftrag wird ungefragt wiederholt.

**Bestandsübernahme:** Vorprüfung aller Quellen vor dem ersten Stop, verschlüsseltes
Journal, bestätigte Prozessübergabe und erhaltene Namespaces/Zuordnungen. Geschützte
fehlende Einstellungen, mehrdeutige oder inkompatible Quellen und erkannte alte
RPC-Ziele blockieren den Wechsel vor Abschaltung. Wiederanlauf prüft vorhandene und
richtig zugeordnete Zielkonfigurationen; später legitim gespeicherte Änderungen
bleiben erhalten. Eine deaktivierte alte UI wird nicht ungefragt aktiviert.
Startbereitschaft ohne Schreibzuständigkeit reicht nicht als erfolgreicher Abschluss.

**NexoWatt Backup:** Eigene Quelle 1.0.10 integriert; kein zusätzlicher Standard-
Backitup-Prozess für den dokumentierten Umfang. Bedarfsgesteuerter Worker,
verschlüsselte Archive, private Geräteidentitäten, lokale und externe Speicherziele,
Altdatenimport, Zeitpläne und Benachrichtigungen. Aufräumen entfernter Ziele betrifft
nur nachweislich eigene Sicherungen. Ressourcen-, Abbruch-, Rekursions- und
Wiederherstellungsschutz sind getestet. Der Recovery-Schlüssel wird getrennt gesichert.
Die vollständige Matrix einschließlich bewusst blockierter Altbetriebsarten steht in
[modules/backup/README.md](../../../modules/backup/README.md).

**Lokale TLS-Verwaltung:** Geräte erzeugen einen eigenen P-256-Schlüssel und eine
CSR. Ein getrenntes Offline-Werkzeug stellt mit einer NexoWatt-CA Zertifikate aus.
Import prüft Schlüssel, Namen/IP-SAN, Kette, EKU, Laufzeit und CA-Fingerabdruck.
Kein Hersteller-Privatschlüssel ist im Adapter enthalten. Ersteinrichtung wird beim
regulären Neustart wirksam, spätere verwaltete Erneuerungen können den TLS-Kontext
wechseln. Endgeräte benötigen einmaliges ausdrückliches CA-Vertrauen.

**Oberfläche und RAM:** Geräte und EEBus verwenden EOS-Logo, Farben, Navigation und
responsive Formulare. Abgelaufene Erkennungs-/History-Caches werden im Leerlauf
freigegeben; gleichzeitige Erkennungsanfragen teilen einen Objektabruf. Der
synthetische Vergleich mit 25.000 Objekten zeigt 46,9 MiB weniger gehaltenen Heap.
Das ist weder eine Messung des Kunden-RSS noch eine zugesagte Gesamtersparnis.
EMS-Takte, Messwerte, Limits und Regelprioritäten wurden nicht reduziert.

Die History-/Express-Korrektur, Socket-Schutz, zentrale Anmeldung und gemeinsame
NWL3-Lizenz aus den Vorgängerversionen bleiben erhalten. Ein zusätzlicher
Feature-Lookup akzeptiert nur eigene explizit wahre Eigenschaften; Prototypnamen
geben keine Lizenzfunktion frei. ioBroker Admin auf 8081 wird nicht umkonfiguriert.

## Ausgeführte Softwareprüfungen

| Prüfung | Ergebnis / Beleg |
| --- | --- |
| Gesamtsuite `npm test`, tatsächlicher Keygen 1.0.4 eingebunden | **793 bestanden**, 2 Umgebungs-Skips, kein Fehler; `all-tests-final.log` |
| Aufteilung der Gesamtsuite | Unified 393, retained 48, Module 297, übernommene EEBus-Scripte 4, Backup 51 |
| NVP / dynamischer Netzanschluss | 208 Tests, Typprüfung und Frontend-Vertrag bestanden |
| §14a | Direkt-API und Kommunikationsfallback bestanden |
| Admin-/Installer-Navigation | 10 Tests bestanden; beide Frontends erfolgreich gebaut |
| Backend und Module | Build, strikte Typprüfungen und Backend-/Unified-/Backup-Lint erfolgreich |
| Ausgelieferter TLS-Build und Offline-Aussteller | 12 Tests bestanden, echte temporäre OpenSSL-Kette und verifiziertes HTTPS; `tls-built-runtime-final.log` |
| Runtime-Quelltreue | 165 produktive UI-Runtime-Dateien entsprechen kanonischem TypeScript |
| Dokumentation | 277 deutsche Modulbeschreibungen und Verknüpfungen synchron geprüft |
| Metadaten | Unverändertes ioBroker-Schema, JSON-Konfiguration und Paketvertrag: 3 Tests bestanden |
| Bestandsübernahme | 43 fokussierte Autorenprüfungen und 45 Prüfungen im zweiten Review; Teilmengen/Überschneidungen mit Gesamtsuite, nicht zusätzlich aufsummiert |
| Paketinstallation und echte Controller-Datenbanken | 15 bestanden, 2 Umgebungsfälle offen; unten separat erläutert |

Die zwei Umgebungs-Skips betreffen fehlendes `nginx` und `setfacl`. Es wurde kein
Schutz für diese Prüfungen abgeschaltet. Geräte-, Cloud- und Controllerfixtures
werden in den Teilberichten ausdrücklich von realen Anlagenprüfungen getrennt.

Die erste Gesamtsuite fand zwei veraltete EEBus-Testdoubles ohne die neue öffentliche
`setForeignObjectAsync`-Schnittstelle. Die Fixture wurde auf den tatsächlich genutzten
Controllervertrag ergänzt und verbietet dabei eigene Instanzwrites. Die unveränderten
EEBus-Vertragstests sowie die gesamte Suite bestanden im anschließenden Lauf.
Die Metadatenprüfung begrenzte außerdem die Versionsmeldungen auf die zulässigen
20 Einträge; historische Berichte bleiben erhalten.

## Abhängigkeiten, statische Prüfung und Herkunft

Runtime-Audit: **0 bekannte Befunde**. Frontend und Installer ebenfalls 0. Im
vollständigen Backend-Entwicklungsbaum verbleiben 14 moderate, im historischen
UI-Entwicklungslock 12 moderate Befunde; keine hohen oder kritischen. Die Rohdaten
stehen in den fünf `audit-*-final.json`-Dateien. Es wurde kein pauschales
`npm audit fix --force` angewandt und kein Entwicklungsserver ausgeliefert.

Die neue Backup-Integration verwendet benötigte Bibliotheken aus dem gesperrten
Paketbaum. Eine zunächst geprüfte alte Dropbox-Abhängigkeitskette wurde wegen
bekannter Schwachstellen vollständig durch das offizielle SDK ersetzt. Der XML-
Parser wurde auf 5.12.1 aktualisiert; die nicht benötigten Kandidaten sind entfernt.
Runtime-SBOM: 416 Komponenten einschließlich vendortem Webserver und drei
integrierten Modulbäumen; 34 direkte Runtime-Abhängigkeiten. Der vollständige
Buildbaum hat 825 Komponenten. Die übrigen SBOMs dokumentieren die Frontends.

UI-Sicherheitsgate: 187 Quellen, 3.097 inventarisierte Hinweise, davon 2.955
historisch offen und 142 einzeln geprüft; keine neuen blockierenden Hinweise.
Das ist ausdrücklich **kein mängelfreier Sicherheitsgesamtscan**. Einzelbewertung
und zusätzliche Feature-Regression: [STATIC_REVIEW_DE.md](STATIC_REVIEW_DE.md).
Neue Backup-Quellen wurden separat vollständig typgestützt gelintet.

Eigene NexoWatt-Anteile bleiben proprietär. Insbesondere die MIT-Rechte der
ursprünglichen Backup-/Admin-Anteile bleiben erhalten. Herkunft, originale Notices,
SBOM und Quell-/Buildhashes sind Bestandteil der Lieferung. Ein Hashmanifest ist
keine digitale Herstellersignatur. Es erfolgte keine Veröffentlichung auf GitHub
oder npm und keine Änderung an einer laufenden Kundenanlage.

## Noch separat abzunehmen

- Reale Gerätetelegramme, EEBus-Kopplungen, Stellgrößen und Rückmeldungen, Betrieb
  während kontrollierter Migration sowie dynamische kundeneigene RPC-Skripte.
- Vollständige Wiederherstellung auf Ersatzhardware, tatsächliche Datenbanken,
  CCU, NAS/SD und eingerichtete Cloudkonten. Keine echten Benachrichtigungen wurden
  während der Tests verschickt. Multi-Host-Backup ist noch keine unterstützte Übernahme.
- Browser-Sichtprüfung: Chromium konnte hier wegen `EPERM` am IPC-Socket nicht
  starten. DOM-/CSS-/HTTP-Prüfungen ersetzen diesen visuellen Nachweis nicht.
- Client-Vertrauen der NexoWatt-CA, reale Namensauflösung und optionaler Port 443.
  `nexowatt.local` ist der selbst angekündigte mDNS-Name; der kurze Name `nexowatt`
  benötigt passende Auflösung im Netz. Kein OS-Dienst wurde automatisch eingerichtet.
- Reale RSS-/CPU-/IO-/Latenzwerte und Dauerlauf bei gleicher Anlagenlast. Der
  Backup-Worker hat ein V8-Heap-Limit, kein universelles RSS-Limit. Node 22 und
  Raspberry-Pi-/ARM-Hardware wurden in diesem Lauf nicht praktisch geprüft.
- Organisatorische Produkt-/CRA-Unterlagen, Support- und Schwachstellenprozesse
  sowie die abschließende Herstellerfreigabe bleiben gesonderte Nachweise.

## Teilberichte und Anleitung

[Update](../../start/START_HIER_9.0.7.md), [Sitzungsfehler](MODULE_SESSION_FIX.md),
[Bestandsübernahme](MIGRATION_PRUEFVERMERK.md), [Migrationsreview](MIGRATION_CODE_REVIEW.md),
[Backup](BACKUP_INTEGRATION_DE.md), [Backup-Speicherziele](BACKUP_STORAGE_PRUEFUNG.md),
[TLS](TLS_PRUEFUNG.md), [TLS-Review](TLS_CODE_REVIEW.md),
[RAM](MEMORY_REVIEW_DE.md), [Oberfläche](MODUL_OBERFLAECHEN.md),
[Sicherheitsänderungen](SECURITY_DELTA_DE.md).

## Installationsnachweis

Das versiegelte npm-Paket wurde unter Controller 7.2.5 neu installiert. Ein echter
Adapterprozess lief gegen dessen echte Objekt-/Zustandsdatenbanken: **15 Prüfungen
bestanden, 2 Umgebungsfälle offen**, kein Fehler im abschließenden Lauf.
`controller-integration-final.log` enthält den Nachweis.

Geprüft wurden Start, Ereignisburst ohne Socketclient und Erholung, verifiziertes
HTTPS mit IP-/Namens-SAN, Login, Modulseiten und Zugriffsgrenzen, Gerätekonfiguration,
CSR-Erzeugung, Abmeldung sowie Stop und Neustart gegen dieselbe Datenbank.
Das Gerätespeichern erhielt die Sitzung auch nach dem bekannten 2,5-Sekunden-Fenster
für Controller-Instanzänderungen; zusätzlich blieb das eigene Instanzobjekt
unverändert. Der erste Testlauf verwendete versehentlich das Mocha-Standardlimit
von zwei Sekunden für den bewusst 3,5 Sekunden wartenden Test. Nur dieses
Testzeitlimit wurde auf zehn Sekunden berichtigt, danach wurde in einer frischen
Installation erneut geprüft. Dafür war keine Produktänderung erforderlich.

Admin:8081 blieb als aktivierte Datenbank-Recovery-Fixture unverändert; ein zweiter
Admin-Webserver wurde nicht gleichzeitig betrieben. Die Host-/Repositorywarnungen
stammen aus dieser isolierten Testinstallation. Hostangaben mit `:443` testen den
Zugriffsvertrag am tatsächlichen 8188-Listener, keinen installierten 443-Proxy.

Die zwei offenen Fälle betreffen Hersteller-Prüfschlüsselimport: `/` und `/etc`
besitzen hier nicht den produktiv verlangten POSIX-root-Eigentümer. Der Schutz
meldete korrekt `TRUST_PERMISSIONS`. Rechte wurden nicht aufgeweicht.
Erfolgreicher Keygen-1.0.4-Import, Aktivierung, verschlüsselte Persistenz und Neustart
wurden separat mit echtem HTTPS und ausdrücklich modellierter Test-Vertrauensgrenze
geprüft. Dies wird nicht als vollständig lizenzierter Hardware-Regelbetrieb unter
dem Controller ausgegeben.

## Endgültige Artefakte

Nach Aufnahme der Prüfberichte wurde erneut versiegelt und gepackt. Die gesonderte
`NexoWatt_EOS_9.0.7_Lieferpruefung.json` vergleicht ZIP und npm-Paket bytegenau mit
dem Quellstand, prüft eine frische ZIP-Extraktion und den gezielten Secret-Scan.
Zusätzlich werden die ausgelieferten Runtime-, Modul-, Frontend-, Deployment- und
Paketmetadatendateien mit dem tatsächlich installierten Test-Tarball verglichen.
Damit können ergänzte Berichte nicht unbemerkt einen anderen Laufzeitstand verdecken.
SHA-256-Werte stehen in `NexoWatt_EOS_9.0.7_SHA256SUMS.txt`.

Die Build-Lockfiles dokumentieren die geprüfte Auflösung. npm kann bei einer
späteren Installation zulässige Versionsbereiche neu auflösen; der tatsächlich
installierte Abhängigkeitsstand ist deshalb bei der Anlagenabnahme zu erfassen.
Die vorliegende erfolgreiche Neuinstallation bezieht sich auf diesen Prüfzeitpunkt.
