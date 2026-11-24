# Unabhängiger Abschlussreview 9.0.19 – Geräte und EMS

Geprüft am 24.11.2026 gegen den Entwicklungsstand `source-919`. Umfang: Produktionsänderungen an Geräte-EMS-Planer, Inventar/Service, ModuleHost sowie Engine-Rekonfiguration. Keine Hardwarefreigabe und kein Nachweis sämtlicher Gerätekategorien; die fachliche Abdeckung steht gesondert in `EMS_KATEGORIEN_ABDECKUNG.md`.

## Bestätigte Eigenschaften

| Bereich | Geprüfte Wirkung |
| --- | --- |
| Explizite Aktivierung | Aktivierung und Deaktivierung benutzen einen einzeln gespeicherten Auftrag. Ein verbrauchter Auftrag aktiviert eine später im AppCenter abgeschaltete App nicht erneut. Änderungen an Topologie oder Grenzen brauchen einen neuen Auftrag. |
| Persistenz und Übernahme | Gerätezuordnungen und Auftragstoken werden gemeinsam versioniert gespeichert. Scheitert danach die Laufzeitübernahme, bleibt der Auftrag im Arbeitsspeicher als ausstehend markiert. Ein unveränderter Plan muss die Übernahme erneut durchführen, bevor Erfolg zurückgegeben wird. |
| Eigenständige Fehlerregression | `test/eos-device-ems-review.test.cjs` entfernt den Persistenzstub des HTTP-Harness und verwendet den echten `installer.configJson`-Schreibpfad. Der Test erzwingt einen Fehler nach Persistierung und prüft die erfolgreiche Wiederholung sowie die anschließende absichtliche App-Deaktivierung. Datenbank und Geräte sind Fixtures. |
| Laufzeitwechsel | Die alte Engine wird vor Sichtbarkeit neuer Datenpunkte gesperrt. Laufende Zyklen, auch hinter einem äußeren Modul-Timeout noch laufende Aufgaben und asynchrone Modul-Stopps müssen enden. Ein Timeout lässt die alte Engine gesperrt; eine zweite Registry wird dann nicht gestartet. |
| Eigentümerschaft | ModuleHost erneuert die befristete Freigabe unabhängig vom Erststart anderer Module. Generation, Lizenz und EOS-Eigentümerschaft bleiben in `canOperate` pro Operation erforderlich. Alte Generationen können keine neue Lease erhalten. |
| Inventar | Alias V1 wird nur mit passendem Namespace, Geräte-ID, Profil-ID, Vertrag und angebotener Capability übernommen. Alte oder fremde Aliasobjekte sind keine neue Erkennungsquelle. |
| Bestehende Einstellungen | Der Planer ergänzt fehlende Zuordnungen und Grenzen. Konflikte verwerfen den Geräte-Teilplan; begrenzte explizite Korrekturen betreffen die dokumentierten falschen FENECON- und booleschen EV-Leistungszuordnungen. |

## Im Review reproduzierte Korrekturpunkte

1. **Profilwechsel und verbrauchte Freigabe – korrigiert:** Die bisherige Auftragsidentität enthielt Rolle und Grenzen, aber keine Profil-ID/Geräteklasse. Ein Ersatzprofil unter gleicher Geräte-ID behielt daher die aktive Zeile. Die unabhängige Regression bestätigt jetzt `ACTIVATION_PROFILE_CHANGED`, keine angewendete Freigabe und eine deaktivierte eigene Zeile bei Erhalt aller Zuordnungen und Grenzen. Der vorgeschaltete ModuleHost-Schutz lehnt einen aktiven Profil-/Protokollwechsel vor Persistierung und Geräte-Stopp ab; direkte Geräte-Aliase und externe ioBroker-Aliase sind berücksichtigt. Ein reiner Controller-Adressoffset bei gleichbleibender Profilidentität invalidiert unveränderte Lesebindungen nicht.
2. **Erfolgsstatus bei fehlendem aktuellem Inventar – korrigiert:** Ein früher verbrauchter Token überschrieb den aktuellen Discovery-Fehler mit `ACTIVATION_APPLIED`. Die Regression bestätigt jetzt den aktuellen Fehler und `activationApplied=false`, ohne die gespeicherte Konfiguration zu löschen.
3. **Gemeinsam genutzte App und ruhender manueller Controller – korrigiert:** Der ergänzte Schutz gegen das unbeabsichtigte Mitstarten anderer Controller berücksichtigte zunächst nur `enabled`. Ein gespeicherter Zustand `installed=false, enabled=true` war jedoch noch nicht aktiv. Der Guard prüft jetzt beide App-Felder. Die unabhängige Regression bestätigt, dass der neue Geräteauftrag weder diesen manuellen Controller mitstartet noch dessen bestehende Einstellungen verändert.

Die sechs unabhängigen Tests in `test/eos-device-ems-review.test.cjs` bestehen unter Node.js 24.22.3. Zusätzlich meldet der Planer-Verantwortliche bestandene Kern-, Aktivierungs- und Reviewtests unter Node.js 22. Der Review selbst hat ausschließlich Regressionen, diesen Bericht und einen fehlenden deutschen Modulkommentar ergänzt; Produktionskorrekturen liegen bei den jeweiligen Verantwortlichen.

## Zusatzreview der neuen Farmübersicht

Geprüft wurden der neue `buildFarmOverview`-Vertrag, der tatsächliche Collector in `main.ts`, der strikt typisierte Browser-Renderer und dessen Einbindung in die Farmseite. Die Übersicht verwendet eine atomare JSON-Probe. Laden und Entladen werden über die einzelnen Batterien vor der Nettierung summiert. Veraltete/fehlende Leistungswerte ergeben keine vollständige Summe; das arithmetische SoC-Teilmittel ist entsprechend gekennzeichnet. Die Oberfläche leert Live-Leistung und SoC bei Verbindungsverlust oder abgelaufener Übersicht, während hinterlegte Kapazität ausdrücklich als Konfiguration erhalten bleiben darf.

Drei enge Randfälle wurden mit dem echten Collector in `test/eos-storagefarm-review.test.cjs` reproduziert und dem Laufzeit-Verantwortlichen zur Korrektur übergeben:

- Erlaubte gepunktete Geräte-IDs wie `storage.home` und `storage.solax` wurden von einer bestehenden PV-Heuristik am ersten Punkt abgeschnitten und damit fälschlich als dieselbe Quelle behandelt.
- Dieselbe Batterie-Messquelle konnte durch zwei unterschiedliche Geräte-Eigentumsmarker in der neuen Anzeige doppelt gezählt werden.
- Ausdrückliche Energieeinheiten `Wh`/`kWh` wurden im bisherigen allgemeinen Reader nicht als ungültige Leistungsquelle erkannt und konnten daher in der neuen Anzeige als Watt erscheinen.

Die Korrekturen sind auf die neue Übersicht begrenzt: eindeutige Quellidentität, tatsächlicher Leistungs-DP vor Eigentumsmarker sowie passende Leistungseinheiten im Display-Lesepfad. Nach Synchronisierung der Laufzeitdateien bestehen alle drei unabhängigen Collector-Regressionen und alle sechs UI-Vertragstests unter Node.js 24.22.3. Die ursprünglichen Regler-Summen und die alte PV-Regellogik wurden im Review nicht verändert. Ein Browser-Sichttest ist durch die reinen Vertrags-/Collector-Tests nicht ersetzt.

## Zusätzliche Prüfung des vorgeschalteten Profilwechsel-Schutzes

Die reale Engine wurde mit der Liste aktiver Profilreferenzen verglichen. Die erfassten App-IDs und Aktivierungsflags für Speicher, Ladepunkte, Thermik, Heizstab, Schwellenwert, Generator, BHKW und dynamischen Netzanschluss passen. Der bestehende Einzel-Speicher ohne neuen Geräteeigentumsmarker bleibt entsprechend seiner alten App-Semantik geschützt, auch wenn `storage.enabled` falsch ist.

Zwei fehlende aktive Referenzpfade wurden gezielt gemeldet, korrigiert und mit einer bestandenen unabhängigen Regression abgesichert: die tatsächlichen NVP-Splitmessungen `datapoints.gridBuyPower`/`gridSellPower` und `peakShaving.gridPointPowerId` sowie `peakShaving.actuators[].setpointId`/`enableId`. Der Peak-Shaving-Modulmanager kann sowohl durch das normale Aktivierungsflag als auch durch `peakShaving.atypical.enabled` aktiv sein; der Schutz deckt beide Pfade ab.

Der Runtime-Verantwortliche bestätigt die echten HTTP-Fälle für Profilwechsel vor Persistierung, externe Aliasketten, vorherige AppCenter-Deaktivierung, gemeinsame Mutationssperre und Datenbankfehler. Als zusätzliche noch nicht reproduzierte Übergangskante wurde die Wiederverwendung einer gerade gelöschten Geräte-ID an den Verantwortlichen gemeldet: Neue IDs dürfen eine bis zum EMS-Reconcile noch aktive alte Referenz nicht umgehen. Der Runtime-Owner hat anschließend auch neu eingeführte IDs in dieselbe Admission aufgenommen. Die tatsächliche HTTP-Pipeline mit zwölf bestandenen Tests enthält nun die Ablehnung des Wiederanlegens bei weiterhin aktiver Referenz. Neue Geräte können bei noch unbekannter Startkonfiguration erst nach Bereitschaft gespeichert werden; es wird vorher nichts stillschweigend persistiert. Details und Testgrenzen stehen im Runtime-Review.
