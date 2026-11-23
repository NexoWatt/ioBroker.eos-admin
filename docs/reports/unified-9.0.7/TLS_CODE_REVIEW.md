# Separater Code-Review der TLS-Verwaltung

23.11.2026 · NexoWatt EOS 9.0.7. Prüfung durch einen vom implementierenden Arbeitsstrang getrennten Entwicklungsagenten. Dies ist ein interner Code-Review, keine externe unabhängige Sicherheitszertifizierung.

## Umfang

Gelesen: `src/lib/eosTlsManager.ts`, `src/lib/eosTlsHttp.ts`, `tools/eos-tls-issuer.cjs`, die neuen TLS-Hooks in `src/lib/web.ts`, die Zertifikatsoberfläche und die zugehörigen Tests. Betrachtet wurden Schlüsselrollen, SAN-/Ketten-/Schlüsselprüfung, frische Benutzerrechte, Origin/CSRF, begrenzte Dateigrößen und Prozesse, Speicherung/Erneuerung, Fehlerfolgen für bestehendes HTTPS und der Umgang mit Herstellergeheimnissen.

## Befunde und Nachprüfung

| Befund | Anpassung / Ergebnis |
| --- | --- |
| Die Gültigkeitsanzeige berücksichtigte zunächst nur Blatt und Stamm-CA. Eine früher ablaufende Zwischen-CA konnte einen falschen positiven Status erzeugen. | Alle Kettenzertifikate fließen in Gültigkeit und frühestes Ablaufdatum ein. Regression mit echter Zwischen-CA und vorgezogenem Prüfzeitpunkt bestanden. |
| Ein Fehler beim Entfernen der verbrauchten Anfrage konnte nach bereits erfolgreicher Zertifikatsübernahme als vollständiger Fehlschlag erscheinen. | Übernahme bleibt als erfolgt erkennbar; Bereinigungsfehler wird ausdrücklich als Warnung zurückgegeben. Anfrage-ID verhindert Wiederholung. Fehlerfallprüfung bestanden. |
| Ein Synchronisationsfehler des Verzeichnisses nach erfolgreichem Rename konnte den bereits eingetretenen Commit verschleiern. | Explizite Warnung über unbestätigte dauerhafte Speicherung statt falscher Behauptung eines unveränderten Zustands. Eingespritzter fsync-Fehler geprüft. |
| Die Status-Aktualisierung im Browser konnte eine Speicherwarnung durch die allgemeine Erfolgsmeldung ersetzen. | Fehler-/Warnanzeige hat Vorrang vor allgemeiner Erfolgsmeldung. Quellprüfung. |
| Das Offline-Werkzeug öffnete die eingereichte CSR für Prüfung und Signierung mehrfach über ihren ursprünglichen Pfad. | Eine private Kopie bindet die OpenSSL-Schritte an dieselben Anfragebytes. Kein erneut gelesener öffentlicher Download-/Freigabepfad zwischen Schlüsselprüfung und Signierung. |
| Die vorgelagerte Dateiprüfung und das Einlesen erfolgten zunächst getrennt über den Pfad. Ein gleichzeitig wachsender oder ersetzter öffentlicher Eingang konnte die ursprüngliche Größenprüfung umgehen. | Öffnen mit `O_NOFOLLOW` soweit unterstützt, Vergleich der Dateiidentität, Prüfung und begrenztes Lesen über denselben Dateideskriptor. Höchstens Limit + 1 Bytes werden gelesen. Größen-/Metadatenwechsel und Trunkierung werden abgewiesen. Drei gezielte Tests bestanden. |

Im geprüften Umfang wurde kein Umgehen der Admin-, Origin- oder CSRF-Prüfung festgestellt. Das Web-API nimmt keine privaten CA-Schlüssel an. Der auf EOS erzeugte private Geräteschlüssel wird mit dem importierten Blattzertifikat verglichen. Explizites `serverAuth`, SAN ohne CN- oder Wildcard-Ersatz, Root-Fingerabdruck, CA-Eigenschaften und strikte OpenSSL-Verifikation der Kette werden geprüft. Die Tests verwenden tatsächliche lokale TLS-Verbindungen und prüfen Standardkontext für IP-Zugriffe sowie SNI bei Erneuerung.

## Ausgeführte Nachprüfung

`node --test test/eos-tls-issuer-files.test.cjs test/eos-tls-management.test.cjs`: **12/12 bestanden** nach Korrektur der Status- und Commit-Befunde, Einbau der privaten CSR-Kopie sowie Härtung des Dateilesers. `eslint -c eslint.unified.config.mjs tools/eos-tls-issuer.cjs` wurde ebenfalls ohne Fehler ausgeführt. Rohbeleg: `tls-independent-review-tests.log`. Dieser Prüflauf stammt aus dem separaten Review-Arbeitsstrang. Die abschließende zentrale Typ-/Build-/Paketprüfung bleibt dem Lieferbericht zugeordnet.

Die kontrollierten Quellpfade `modules/`, `public/eos-tls/` und `src/lib/` enthielten bei der Dateiinventur keine PEM-/KEY-/CER-/CRT-/P12-/PFX-Dateien. Das ersetzt nicht die abschließende Geheimnisprüfung des tatsächlich gepackten Releases. Hersteller-CA-Dateien entstehen ausschließlich bei Bedienung des getrennten Offline-Werkzeugs; die Tests erzeugen nur temporäre künstliche Identitäten.

Die Backup-Integration wurde separat darauf abgestimmt, die private EOS-TLS-Ablage einschließlich aktiver/ausstehender Geräteschlüssel innerhalb der verschlüsselten Sicherung zu erhalten. Eine tatsächliche Kunden-Wiederherstellung wurde in diesem Review nicht durchgeführt.

## Grenzen

Keine Kundengeräte, produktiven Hersteller-Schlüssel oder externen Endgeräte-Vertrauensspeicher wurden verändert. Ein importiertes privates Stammzertifikat muss auf den Endgeräten ausdrücklich als vertrauenswürdig eingerichtet werden. Namensauflösung, Port 443, reale Browserbedienung, Zertifikatsverteilung und Herstellerprozesse für Widerruf/Schlüsselverlust bleiben getrennte Abnahmepunkte. Ein kompromittierter Prozess unter derselben Dienstidentität ist nicht durch Dateimodus 0600 isoliert.
