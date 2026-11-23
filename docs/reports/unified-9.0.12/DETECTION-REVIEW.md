# SmartHome-Erkennung – gezielte Backendprüfung 9.0.12

Stand: 23.11.2026. Softwareprüfung mit synthetischen ioBroker-Objekten und dem tatsächlich installierten `@iobroker/type-detector` 6.2.0. Keine Geräte-, Browser- oder Kundenanlagenabnahme.

## Befund und Korrektur

**SH-DETECT-01:** Der vorhandene Objektcache sortierte Datenpunkt-IDs mit `localeCompare`, markierte sie aber gegenüber dem Detector als bereits sortiert. Dessen binäre Unterbaumsuche verwendet JavaScript-Stringvergleich. In einer reproduzierbaren Fixture mit den Kanälen `A`, `a`, `B`, `b`, `Z`, `z`, `_a` wurden damit die drei Großbuchstabenkanäle nicht erkannt. Die korrigierte binäre Sortierung erkennt alle sieben. Die Sortierung der angezeigten Gerätenamen bleibt davon getrennt.

**SH-DETECT-02:** Ein Fehler eines Detector-Aufrufs wurde zuvor wie ein erfolgloser Treffer behandelt. Nun bricht der gesamte Scan mit `EOS_DETECTION_FAILED` ab. Unvollständige Vorschläge werden weder als vollständig ausgegeben noch im Ergebniscache gespeichert. Eine fachlich vollständig leere Suche ist dagegen erfolgreich lesbar und wird ausdrücklich mit `diagnostics.emptyReason` (`NO_CANDIDATES` oder `NO_MATCHES`) gekennzeichnet.

**SH-DETECT-03:** Discovery erhält eigene Betriebsgrenzen: maximal 100.000 Objektmetadaten, 20.000 Kandidatenwurzeln, 10.000 eindeutige Vorschläge, 30 Sekunden kooperatives Gesamtbudget sowie 5 Sekunden Wartebudget für das lokale Objektlesen. Überschreitungen liefern `EOS_DETECTION_LIMIT` oder `EOS_DETECTION_TIMEOUT`; ein geschlossener Browserrequest beendet die Suche mit `EOS_DETECTION_ABORTED`. Gespeicherte Kundengeräte werden durch diese Suchgrenzen nicht verändert oder zahlenmäßig beschnitten.

Der vorhandene `ExpiringSnapshot` bleibt unverändert und verhindert weiterhin parallele Objektlesevorgänge. Eine Lesegeneration verwirft verspätete Antworten nach Abbruch oder Timeout, bevor diese den Cache füllen können. Das zugrunde liegende ioBroker-Objektlesen bietet keine Abbruchschnittstelle: ein bereits laufender Lesevorgang kann noch enden, und bis zu seinem Ende wird kein zweiter gestartet. Ein synchroner Detector-Schritt kann nicht präemptiv unterbrochen werden. Die 30 Sekunden sind deshalb kein hartes Eventloop- oder Laufzeitversprechen.

## Verträglichkeit und Berechtigungen

`GET /api/smarthome/type-detect` behält `suggestions`, `stats`, `scannedAt` und deren bisherigen Bedeutungen. Ergänzt wird ausschließlich die optionale Diagnose. Vorhandene Alias-DPs, Konvertierungen, Herkunft, Raumzuordnung, Kundennamen, Favoriten, manuelle Zuordnungen und Schutz-DPs bleiben erhalten. Die Suche schreibt keine States, Objekte oder Konfiguration; Import und Aliasanlage bleiben ausdrücklich getrennte Vorgänge. Die bestehende serverseitige Berechtigung `mapping.edit` bleibt an der Route. Keine Lizenz-, Sitzungs- oder Rollenprüfung wird umgangen.

## Prüfungen

| Prüfung | Ergebnis | Beleg |
| --- | --- | --- |
| Tatsächliche Route, Sortierung, Alias-/Importregressionen, 26 Tests, Node 24.22.3 | bestanden | `raw/detection-node24.log` |
| Dieselben 26 Tests, Node 22.23.4 | bestanden | `raw/detection-node22.log` |
| Strict-TypeScript, `ui/tsconfig.smarthome-device-detection.json` | bestanden | `raw/detection-typecheck.log` |
| Typgestütztes ESLint des geänderten Helpers | bestanden | `raw/detection-eslint.log` |

Die Tests führen den kanonischen Route-Quelltext und reale Detector-Muster aus. Sie prüfen unter anderem Abbruch, verspätete IO, erhaltenes Single-Flight bei wiederholtem Timeout, tatsächlichen Zeitgeberablauf mit Testuhr, Mengenbegrenzung, Shutdown, vertrauliche Fehlerdetails, unveränderte Eingabeobjekte, getrennte Alias-Lese-/Schreibziele und manuelle Kundenanpassungen. Die Autorisierungs-Middleware und reale HTTP-Sitzungen werden in diesem Teiltest nicht ausgeführt; entsprechende Prüfungen gehören zur separaten API-/Releaseprüfung.

Für die Hausanlagenprüfung: Geräteliste erneut erkennen lassen, insbesondere IDs mit gemischter Groß-/Kleinschreibung vergleichen, ein bereits konfiguriertes Aliasgerät kontrollieren und den Dialog während einer Suche schließen. Erwartet werden eindeutige Ergebnisse beziehungsweise ein erklärter Abbruch; ohne bewussten Import und Speichern bleiben Geräte und Raumzuordnungen unverändert. Browserdialog, Gesamtrelease und Hardwareintegration werden im übergeordneten Prüfbericht gesondert bewertet.
