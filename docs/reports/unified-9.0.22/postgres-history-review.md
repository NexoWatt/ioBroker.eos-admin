# PostgreSQL-Historie – gezielte Nachprüfung 9.0.22

Stand: 25.11.2026. Prüfung an der getrennten Arbeitskopie; kein Zugriff auf eine Kundenanlage.

## Ergebnis

Die bereits vorhandene PostgreSQL-Historienimplementierung wurde anhand der Umsetzungsvorgabe erneut gelesen und mit gezielten Software- sowie echten Datenbanktests geprüft. Im geprüften Bereich wurde kein zusätzlicher reproduzierbarer Produktfehler gefunden; deshalb wurde hier kein Produktcode geändert. Die Ergebnisse gelten für die unten erfassten Dateien, nicht als pauschale Produktivfreigabe.

| Prüfung | Tatsächlich ausgeführt | Ergebnis / Beleg |
| --- | --- | --- |
| Unit- und authentifizierte API-Regression | `node --test test/eos-postgres-history.test.cjs test/eos-postgres-history-api.test.cjs` | 17/17 bestanden; `postgres-review-unit-api.tap` |
| Reale PostgreSQL-Integration | `node --test test/eos-postgres-real-integration.cjs` mit `EOS_TEST_PG_BIN`, `EOS_TEST_PG_SHARE` und passendem extrahiertem `libpq` | 9/9 einschließlich übergeordnetem Test bestanden; `postgres-real-review.tap` |
| Typprüfung | `tsc -p ui/tsconfig.postgres-history.json` | Exit 0; `postgres-review-typecheck.log` |
| Typinformiertes Linting | `eslint -c ui/eslint.postgres-history.config.mjs ui/src-ts/runtime-executables/lib/postgres-history.ts ui/src-ts/runtime-executables/lib/postgres-history-config.ts` | Exit 0; `postgres-review-lint.log` |

Umgebung: Linux, gewöhnlicher Benutzer `agent` UID 1000, Node.js v24.22.3, PostgreSQL 17.12 (Debian 17.12-0+deb13u1). PostgreSQL wurde ausschließlich für den Test als temporärer unprivilegierter Cluster gestartet, anschließend beendet und entfernt. Keine Betriebssystempakete oder Systemdienste wurden installiert.

## Nachgewiesener Umfang

- Historienprofil ist instanzgebunden und auf den lokalen Host/Port, feste Datenbankrollen und geschützte Profilpfade begrenzt. PostgreSQL-Neuauswahl verlangt ausdrücklich eine Neuanlage; vorhandene Historieneinstellungen blockieren die automatische Umstellung. API-Tests erhalten Zuordnungen, andere Einstellungen und historische Namespace-IDs.
- Im echten Datenbanktest wurde TLS 1.3 ausgehandelt. Klartext, unbekannte CA, falscher Gegenstellenname, falsches Passwort, falsche Datenbankinstanz und ein abgelaufenes Serverzertifikat wurden abgewiesen. Laufzeitrolle besitzt keine administrativen Rechte; Schreib-/DDL-/Rollenverbote wurden real geprüft.
- Zahlen einschließlich Null/negativer Werte, Boolean und Text behalten ihren Datentyp. Historische Zeitstempel, Min-/Max-Auswahl, Mittelwert, Anzahl und idempotente Überschreibungen gleicher ID/Zeit wurden mit echten Daten verifiziert. SQL-Abfragen sind parametrisiert und erzeugen keine Nullmesswerte für fehlende Zeitfenster.
- Lesefrist zerstört eine blockierte Verbindung; nach Freigabe der Tabellensperre ist erneutes Lesen möglich. Softwaretests erfassen begrenzte Schreibwiederholungen, unveränderte Originalmesspunkte, sichtbaren Datenverlust nach ausgeschöpften Wiederholungen, vollständigen Datenträger, spätere erfolgreiche Aufzeichnung, freigehaltene Schreibkapazität und sichtbare Startfehler.
- Die echte Backuprolle kann historische Daten lesen, aber auch nach Abschalten ihres read-only Defaults nicht schreiben. Der vorhandene Backup-Exporter erzeugte über verifiziertes TLS ein Dump; der Wiederaufbau in eine getrennte Testdatenbank enthielt dieselben typisierten historischen Messpunkte. Anschließend wurden Schema-Wiederholung und Datenbankneustart mit erneutem Schreiben/Lesen geprüft.

## Grenzen und noch offene Abnahme

- Der echte Test verwendet die produktiven Rollen-/Schema-/PostgreSQL-Konfigurationsvorlagen und den Historienclient. Für die isolierte Umgebung wurden nur Binär-/CA-Pfade sowie der Test-Maintenancezugang angepasst; ein AF_UNIX-Socket war dort nicht verfügbar. Dies ersetzt keinen vollständigen Debian-Systemsetup-/systemd-Test und keine Installation über den Kunden-Updater.
- Ein tatsächlicher Verbindungsversuch von einer LAN-/WAN-/VPN-Schnittstelle wurde nicht durchgeführt: Die Umgebung verweigert die Inventarisierung von Netzwerkschnittstellen. `SHOW listen_addresses` bestätigt ausschließlich `127.0.0.1`; diese Teilprüfung ist kein Ersatz für den externen Anschlussversuch auf Zielhardware.
- UI-Diagramme, vollständige EOS-Gesamtsicherung einschließlich Benutzer/Geräteidentitäten/Lizenzvertrauen, Betrieb mit realen Geräten und Langzeit-/Latenzabnahme sind durch diesen Teilbericht nicht abgenommen.
- Die historische Datenbank wächst nach der vorhandenen Aufzeichnungsstrategie. Datenträgerüberwachung und die projektspezifische Aufbewahrung benötigen im Betrieb Aufmerksamkeit; hier wurde keine automatische Datenlöschung ergänzt.

## Geprüfte Dateihashes

| Datei | SHA-256 |
| --- | --- |
| `ui/src-ts/runtime-executables/lib/postgres-history.ts` | `738e0c932792572737e4f4d9a172ad7aa547275a03a8ef90ec602e2a59662b38` |
| `ui/src-ts/runtime-executables/lib/postgres-history-config.ts` | `67068de65cc570f8a0a489acfa6b6afa902b63867afdcb608d3f52c5159b3090` |
| `ui/lib/postgres-history.js` | `22d70f609e08eec46b8b56d2ccda9747af6a845414317e46dd8cb264e23bd1ca` |
| `ui/lib/postgres-history-config.js` | `2dd50f67f8aedbb51222803cde967e6e985615941a2db5c2d9ae7f431236c9ff` |
| `test/eos-postgres-history.test.cjs` | `ed941911d89715b5c3c94e8508b71ad928332b034d89aa42fe8b179b0d3833cc` |
| `test/eos-postgres-history-api.test.cjs` | `45b5ec5127b7a1c1864e408816ff5df31fc9217cfcf25d0bd1fd32b917a55ef1` |
| `test/eos-postgres-real-integration.cjs` | `0db2e0acb8b989ba0d2b495eed1e46316909cebb9c0aaba301c14f797604b926` |
