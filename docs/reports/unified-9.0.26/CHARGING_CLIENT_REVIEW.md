# Unabhängige Prüfung der Ladepunkt-Befehlstoken im Frontend

Geprüft am 25.11.2026: `ui/src-ts/runtime-executables/www/app.ts`, `evcs.ts` und `dc-station-display.ts`. Der Reviewer hat diese Produktänderungen nicht implementiert. Die Prüfung umfasst die tatsächlichen Aufrufstellen und die ausführbaren Produktionsfunktionen; der vollständige Browser-/Backend-Abnahmelauf ist ein gesonderter Nachweis.

## Befunde und Abschluss

Zwei konkret benannte Bindungslücken wurden im gleichen Arbeitsstand geschlossen:

1. Die Stationsfunktion las den Token zunächst aus dem veränderlichen globalen `lastPayload`. Jetzt erfasst jeder Clickhandler den Token aus dem Payload seiner eigenen Darstellung und übergibt ihn ausdrücklich an `sendCommand`. Ein alter A-Handler erhält nach einem B-Refresh weiterhin A; der aktuelle B-Handler erhält B. Der tatsächliche Renderhandler wird im Regressionstest ausgeführt.
2. Nach einem fehlgeschlagenen ersten `/config`-Abruf blieb die Dokumentidentität zunächst offen. Beide Bootstrap-Fehlerpfade frieren nun eine leere Identität ein. Ein späterer automatischer Konfigurationsrefresh kann dieses unbestätigte Dokument nicht mit dem Token eines zwischenzeitlich ersetzten Ladepunkts aufwerten. Die Produktions-Catchblöcke werden im Regressionstest ausgeführt.

Im abschließend geprüften Clientstand bestehen keine weiteren blockierenden Befunde für diesen begrenzten Tokenvertrag:

- LIVE und Mehrladepunktseite kopieren die erste bestätigte Konfigurationsidentität. Spätere Mutation des Quellobjekts, Telemetrie und Config-Hotreload ersetzen diesen Snapshot nicht.
- Sämtliche vorhandenen direkten `/api/set`-Aufrufstellen der beiden Seiten verwenden den zentralen Wrapper. Beide vorhandenen Modus-Requesthelfer führen ebenfalls durch ihn. Die tatsächlich gesendeten Schlüssel für Stationsfreigabe, Regelung, Ladeziel, Modus, Quelle, Phasen und Speicherhilfe wählen den richtigen LP-Token. Globale und Legacy-Settings-Kommandos verwenden die Layoutrevision.
- Ein Identitätskonflikt mit HTTP 409 erzeugt einen festen Hinweis mit bewusster Neuladeaktion und wirft einen Fehler. Es wird weder ein neuer Token beschafft noch ein Schreibauftrag wiederholt. Vorhandene Modus-Readbacks lesen nur; die Stations-Nachprüfung ruft ebenfalls nur GET auf.
- Der Stationshandler bindet seine Darstellung, während serverseitige Stationstoken, Rechte, tatsächliche Zielvalidierung und Befehlsfreigabe eigenständig erforderlich bleiben. Ein Frontendtoken ersetzt keine Autorisierung.
- Die eingefügten Wrapper verändern übrige API-Aufrufe nicht und fügen keinen neuen periodischen Timer hinzu. Die vorhandenen Request-Timeouts und Readbackwege bleiben erhalten.

## Eigene Prüfung

`node --test test/eos-charging-control-client.test.cjs`: **12/12 bestanden unter Node 22.23.4 und Node 24.22.3**. Ein zunächst falsch ausgewählter AST-Testknoten wurde vor diesem erfolgreichen Wiederholungslauf korrigiert; der produktive Refreshpfad wurde dafür nicht verändert. Rohlogs: `raw/charging-control-client-review-node22.log` und `raw/charging-control-client-review-node24.log`. Der Test extrahiert und führt die Produktionsfunktionen einschließlich Render-Eventbindung aus; DOM und HTTP-Antworten sind Testvorrichtungen. Kein physischer Ladepunkt und kein realer Controller wurden gesteuert.

Der Hashsnapshot in `raw/charging-control-client-review-hashes.json` kennzeichnet den anschließend geprüften Quellstand. Persistente Identitätserzeugung, Migration, Schreibzaun und die tatsächliche serverseitige Ablehnung nach Reindex werden separat vom Backend-Review geprüft. Dieser Clientreview gibt diese Backendteile nicht stellvertretend frei.
