# InfluxDB-2-Historie – Installer-Oberfläche

Stand: 9.0.20, 24.11.2026. Geprüfte Browserquellen und kontrollierte React-/API-Vertragstests; kein Browserlayout- oder Live-Datenbanknachweis.

## Einrichtung

Installer und EMS App-Center besitzen den Einstieg **Historie einrichten**. Die Route `/installer/#/history-setup` nutzt den vorhandenen React-Installer, die bestehende EOS-Sitzung und den gemeinsamen CSRF-Transport. Die React-Route verlangt `appcenter.open` und ausdrücklich die Rolle `admin` oder `installer`; zusätzlich erzwingt das Backend diese Rollen.

Der gespeicherte Adapterbetrieb bleibt bis zum ausdrücklichen Speichern erhalten. Der Benutzer kann zwischen einem bestehenden ioBroker-Historieadapter und direkter InfluxDB-2-Anbindung wählen. Bei direkter Anbindung werden Serveradresse einschließlich Port, Organisation, Bucket und Token eingegeben. Für HTTPS ist optional ein öffentliches CA-Zertifikat möglich; es gibt keinen Schalter zum Abschalten der Zertifikatsprüfung. HTTP ist entsprechend der Backend-Netzwerkregel ausschließlich für lokale Ziele vorgesehen.

Token und CA-Inhalt werden nicht aus der API in den Browser zurückgelesen. Leere Felder erhalten gespeicherte Werte. Ein geänderter Server-Origin verlangt einen neu eingegebenen Token. CA-Entfernung ist eine ausdrückliche Auswahl. Ein fehlerhafter oder konkurrierender Speichervorgang erhält den Entwurf; erneutes Speichern wird nicht automatisch versucht. Die API erhält nur die freigegebenen bearbeitbaren Felder. Das Backend übernimmt die Erhaltung weiterer vorhandener Historie-Einstellungen und Datenpunktzuordnungen.

## Verständliche und getrennte Diagnose

- Ein Verbindungstest prüft ausschließlich Erreichbarkeit und Lesezugriff. Er speichert den Entwurf nicht und bestätigt keine Schreibrechte.
- Der gespeicherte Betrieb zeigt Lese- und Schreibzeitpunkte getrennt; Fehler beider Richtungen bleiben separat sichtbar. Ein bereitgestellter Transport ohne bestätigten Zugriff heißt „Eingerichtet; Zugriff noch nicht bestätigt“.
- Ein Status-Refresh überschreibt keine ungespeicherten Felder oder deren ursprüngliche Konfigurationsrevision.
- Eine bisher konfigurierte ioBroker-InfluxDB-Aufzeichnung wird anhand von `legacyRecordingCount` angezeigt. Die Anzahl belegt aktivierte `common.custom`-Einträge, nicht einen laufenden Adapterprozess oder tatsächlich doppelte Schreibvorgänge. Der Installer soll Ziel-Bucket und Betriebsstatus prüfen und bei demselben Bucket gezielt die bisherige Aufzeichnung der betroffenen EOS-Datenpunkte deaktivieren. Die UI ändert fremde Adapter und deren Aufzeichnung nicht.
- Die Seite erklärt das reguläre 10-Minuten-Raster und dass ein Verbindungswechsel alte Daten weder kopiert noch gelöschte Daten wiederherstellt.
- Fehler für EOS-Sitzung/Rechte, InfluxDB 401/403, fehlenden Bucket/Endpunkt, TLS, Netzwerk, Zielbeschränkung, Token, Versionskonflikt, laufende Aufträge und Speicher-/Aktivierungsfehler werden mit festen deutschen Texten angezeigt. Ungefilterte Serverfehler mit potenziellen Zugangsdaten erscheinen nicht.

## Prüfungen

| Prüfung | Ergebnis / Beleg |
|---|---|
| Tatsächliche TS-/TSX-Quellen: Parser, Entwurf, Token-Origin, CA, Prüf-/Speichertrennung, Doppel-Klick, Konflikt, Authfehler, Entwurferhalt, Statusrefresh, Unmount, Proxy-Einstieg, unabhängige Lese-/Schreibfehler, Mitschreiberwarnung, Transport-Allowlist | 15/15 unter Node 22 und Node 24; `history-setup-ui-node22.txt`, `history-setup-ui-node24.txt` |
| Gesamte bestehende strikte React-TypeScript-Konfiguration | bestanden; `history-setup-ui-typecheck.txt` (kein Fehleroutput) |
| Typgestütztes Lint der neuen UI-Quellen | bestanden; `history-setup-ui-lint.txt` (kein Fehleroutput) |
| Tatsächlicher UI-Sicherheitsscanner, ohne Regelabschaltung/Ausnahme | bestanden; `history-setup-ui-security.txt` (kein Fehleroutput) |
| Bestehende Installer-SSR-Navigation | 6/6; `history-setup-navigation-ssr.txt` |
| Bestehende tatsächliche React-Handler für HTTP/HTTPS/Proxy/Port/Zielauflösung | 25 Fallgruppen; `history-setup-navigation-proxy.txt` |

Die beiden vorhandenen Navigationstests wurden an den bereits vorhandenen `installerNavigation`-Import, die aktuellen Modulpfade und den bestehenden Lizenzpfad `/nexowatt/license` angepasst; der neue Historie-Einstieg wurde ergänzt. Produktnavigation außerhalb dieses neuen Einstiegs bleibt unverändert.

## Build und Grenzen

Neue Produktquellen: `ui/src-admin-tab/src/lib/historySetup.ts` und `ui/src-admin-tab/src/pages/HistorySetupPage.tsx`. Angepasst: `adminConnection.ts`, `App.tsx`, `InstallerPage.tsx`, scoped `styles.css` und `ui/www/ems-apps.html`. Die Seite benötigt den regulären `ui`-Installer-/Admin-Build und die anschließende Dokumentations-/Lieferstandserzeugung durch die Release-Integration.

Die Tests verwenden die tatsächlichen Quellen in einem kontrollierten React-Hook-/Element-Host. Ein echter Browser-/Mobilgeräte-Pixeltest war in dieser Umgebung nicht möglich; Chromium konnte zuvor wegen EPERM nicht starten. Authentifizierung und CSRF werden in diesen UI-Tests nicht durch einen Live-Server nachgewiesen, sondern durch bestehende Transportschnittstellen und gesonderte Backendtests abgesichert. Ein realer InfluxDB-Server, Kundentoken und Anlage wurden nicht verwendet. Der Bericht allein ist keine Produktionsfreigabe.
