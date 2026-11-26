# Ladepunkt-Identität und Bedienwerte – 9.0.26

Stand: 25.11.2026. Dieser Bericht beschreibt lokale Softwareprüfungen. Keine Messung oder Geräteabnahme auf dem Raspberry Pi, kein realer Wallbox-Schaltversuch und keine Zusage vollständiger Ausfallsicherheit.

## Reproduzierter Fehler und Korrektur

Vorher konnte das Löschen des ersten Ladepunktes A den bisherigen zweiten Ladepunkt B auf `lp1` verschieben. Die indexbezogenen gespeicherten Bedienwerte von A (beispielsweise Boost) wurden dann für B gelesen. Die Korrektur übernimmt die Wünsche anhand der bestätigten Gerätezuordnung, bevor ein neuer Charging-Controller initialisiert wird. Alle bisherigen öffentlichen `lpN`- und `evcs.N`-Datenpunkte bleiben bestehen.

Das neue Register `chargingManagement.controlIdentityRegistry` enthält ausschließlich Hashes der Zuordnungen, Positionsnummern, zufällige Inkarnationstokens und gegebenenfalls ein Transferjournal. Es enthält keine Zugangsdaten oder Klartext-Datenpunktadressen. Das Register ist auf 50 Ladepunkte und 128 KiB begrenzt; das Objekt ist nur für Administratoren zugänglich und nicht als bedienbarer Schreibzustand ausgewiesen.

Übernommen werden die zehn vorhandenen EMS-Bedienfelder (Freigaben, Modus, Autoquelle, Phasenwunsch, Speicherfreigabe und Ladeziel), die bestehende numerische Modusdarstellung und die bisherigen Lade-/Boost-Zeitwerte. Ein unverändert identifizierter B-Ladepunkt behält seine legitime Sitzung und seinen gewählten Modus auch dann, wenn A gelöscht wird. Ein neuer oder nicht zuordenbarer Punkt bekommt ausschließlich seine Konfigurationsvorgaben; er übernimmt keine fremde Boost-Sitzung. Entfernte Positionen werden deaktiviert und ihre Sitzungstimer zurückgesetzt.

## Bestätigung, Teilfehler und Neustart

Der Konfigurationswechsel sperrt neue HTTP-Bedienbefehle und wartet auf bereits angenommene Bedien- und Kompatibilitätsspiegel-Schreibvorgänge. Der bisherige EMS-Motor muss seinen Stop bestätigen; anschließend wird seine Referenz freigegeben, damit spätere Initialisierungsschritte ihn nicht nochmals drainen. Ein unbestätigter Stop bleibt sichtbar und wird nicht als Freigabe behandelt.

Vor dem ersten Konfigurationscommit wird das bisherige Layout dauerhaft gebunden. Nach dem Konfigurationscommit werden sämtliche benötigten Quellwerte gelesen, bevor die erste Kopie beginnt. Das vollständige, validierte Journal wird mit bestätigtem Rücklesen gespeichert. Die Datenkopie nutzt höchstens vier gleichzeitige Schreibvorgänge; jeder Batch wartet auch bei einem Teilfehler auf alle bereits angenommenen Vorgänge. Erst danach wird die neue Layoutrevision bestätigt und der neue Controller darf initialisieren.

Ein Neustart nach dem Konfigurationscommit oder nach einer teilweise ausgeführten Kopie setzt das vorhandene Journal mit dem ursprünglichen Snapshot fort. Ein offenes Journal erlaubt keinen weiteren Konfigurationscommit auf ein anderes Ziel. Ein beschädigtes Journal, fehlende Pflichtfelder oder eine unpassende Zielkonfiguration sperren den Übergang. Ein fehlgeschlagener Konfigurationscommit lässt den bisherigen Motor gestoppt und die Bediensperre bestehen; ein erneutes erfolgreiches Speichern muss auch bei unverändertem altem Layout die Initialisierung erneut ausführen. Die Tests prüfen diesen Fall ausdrücklich mit `restartEms:false`.

Das Register ist im Prozess-IPC als exakte Konfigurationsmutation eingestuft. Es nutzt den vorhandenen bestätigten Konfigurations-Schreibpfad und nicht den kürzeren normalen RPC-Zeitrahmen. Ein realer Kindprozess wartet im Test bei beiden unterstützten Namespaces auf einen künstlich um 2,2 Sekunden verzögerten Owner-ACK.

## Alte Browser, Standardmodus und Stationslinks

Jede Positionsinkarnation erhält ein eigenes dauerhaft gespeichertes Token. Änderungen sekundärer Aktorziele drehen es ebenfalls; reine Metadatenänderungen normal angebundener Geräte drehen es nicht. Wiederverwendete oder entfernte Positionen bleiben dauerhaft als geschützt markiert. Ein alter Browserbefehl mit dem alten Token wird vor Diagnose- oder Geräteschreibvorgängen abgewiesen. Tokenlose Altclients bleiben nur für historisch unveränderte Positionen kompatibel. Globale Befehle brauchen nach einer Layoutänderung die aktuelle Layoutrevision.

Nur der exakte eigene Standardmodus-Datenpunkt `<namespace>.evcs.<slot>.mode` gilt als impliziter Spiegel. Ein anderer Slot oder eine andere EOS-Instanz bleibt ein ausdrücklich zugeordnetes Aktorziel. Beim Umzug eines eindeutig erkannten Punktes wird ausschließlich ein unverändert mitgeführter bisheriger eigener Standardspiegel auf den neuen Index umgesetzt. Bewusst fremde oder externe Modusziele bleiben erhalten. Der historische unbekannte Connectorwert `0` wird für die Identitätsbildung wie ein fehlender Standardconnector behandelt.

Unverändert gespeicherte manuelle/fallbackbezogene Stationszuordnungen werden im selben Konfigurationscommit auf ihre bisherigen physischen Ladepunkte umgestellt. Gelöschte Zuordnungen werden entfernt; bewusst neu gewählte Listen bleiben als neue Auswahl erhalten. Die gesonderten Stations-/HTTP-Tests prüfen unter anderem bestehende URLs, Neustart und alte Tokens.

## Bestehende generische Command-State-Brücken und Grenzen

Eine manuell konfigurierte Station mit `controlProfile=commandState`, konkretem `commandStateId` und ohne normale EVCS-Gerätedatenpunkte bleibt bedienbar. Der Fallback bindet sich an die tatsächlich aufgelösten Command-State-Ziele, Stationskennung und den im Payload enthaltenen LP-Schlüssel. Bei einem ansonsten unzugeordneten Punkt wird zusätzlich sein konfigurierter Anzeigename konservativ gebunden. Eine Umbenennung dieses Sonderfalls oder ein geändertes Ziel verlangt daher einen neuen bestätigten Stand. Ohne eine solche konkrete Brücke werden leere/unzugeordnete Punkte nicht pauschal von der Identitätsprüfung ausgenommen.

Aus diesen generischen Command-State-Daten lässt sich eine physische Geräteidentität über beliebige Indexwechsel nicht zuverlässig ableiten. Nicht eindeutig beibehaltene Zuordnungen werden deshalb nicht geraten; eine entfernte Stationszuordnung muss gegebenenfalls ausdrücklich neu konfiguriert werden. Normale Geräte mit zugeordneten Steuer-/Messdatenpunkten erhalten ihre bisherigen Wünsche über den Indexwechsel.

Direkte externe ioBroker-Automationen, die selbst auf `lpN` oder `evcs.N` schreiben, besitzen keinen Browser-Identitätstoken. Der bestehende Datenpunktvertrag wird nicht automatisch umgebaut. Solche externen Skripte müssen nach geänderten Ladepunktzuordnungen auf ihre Zielindizes geprüft werden. Die Übernahme und ihr Drain verhindern nicht, dass ein außerhalb von EOS später neu gesendeter indexbasierter Befehl auf die nun aktuelle Position wirkt.

## Prüfbelege

- `test/eos-evcs-control-identity.test.cjs`: 17 Fälle, unter anderem beide Boost/PV-Reihenfolgen, Entfernen/Leeren/Wiederverwenden, Umordnung, alle Bedien-/Zeitfelder, Cache, Crashgrenzen, fehlerhaftes Journal, verhinderten Engine-Start, echten Config→Engine→Charging-Tick, Standardspiegel, konkrete Command-Brücke und fehlgeschlagenen Configcommit.
- `test/eos-evcs-identity-ipc.test.cjs`: 2 Fälle mit realem Kindprozess und verzögertem Registry-ACK für `eos-admin.0` und `nexowatt-ui.3`.
- Zusammen jeweils **19/19 bestanden, 0 übersprungen**, auf Node 22.23.4 und Node 24.22.3. Logs: `raw/charging-identity/node22.log`, `raw/charging-identity/node24.log`.
- Neue Helper werden im bestehenden strikten `ui/tsconfig.ems-control-values.json` sowie der passenden ESLint-Konfiguration geprüft. Die neuen Testdateien bestehen `eslint.unified.config.mjs`.
- Separate Peer-Reviews und HTTP-/Stations-/Browserprüfungen ergänzen diese Belege; deren Berichte nennen ihren eigenen Prüfstand. Der vollständige Release- und installierte Pakettest ist gesondert im Releasebericht dokumentiert.

Die Änderung begrenzt Registergröße, parallele Schreibvorgänge und angenommene Bedienoperationen; sie ergänzt keine periodischen Pollingtimer. Eine quantitative RAM-Einsparung ist hier nicht gemessen und wird nicht behauptet.
