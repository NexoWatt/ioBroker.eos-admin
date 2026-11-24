# Geräte-Startausfall und ausbleibende Messwerte

Prüfstand: 24.11.2026. Automatisierte Laufzeitprüfung; kein Test an einer physischen Kundenanlage. Die gelieferten Kundenmeldungen zeigen einen Modulstartabbruch nach ungefähr zehn Sekunden. Zwei Fehler wurden unabhängig davon im tatsächlichen Programmablauf reproduziert.

## 1. Die Objektbereitstellung überschritt die pauschale Startfrist

Mit den tatsächlichen Profilen `ess.fenecon.FeneconHomeEssImpl`, `ess.solax.SolaXHybridX1X3Ess` und `meter.sma.SmaEnergyMeterSpeedwireImpl`, echten Laufzeiten und 30 ms Verzögerung je Controller-Objektschreibvorgang überschritt bereits die Metadatenbereitstellung die bisherige gemeinsame Zehn-Sekunden-Frist. Der Start brach nach 905 begonnenen Objektoperationen ab; bereits begonnene Geräte verloren ihre Berechtigung. Die physischen Erstantworten wurden für diese Prüfung gezielt gehalten. Im unveränderten Prüfaufbau konnte deren Stop deshalb nicht bestätigt werden; `STOP_FAILED_RESTART_REQUIRED` ist in diesem alten Fehlerbeleg ein beabsichtigter Sicherheitszustand, kein behaupteter erfolgreicher Stop.

Der Devices-Start überwacht jetzt erfolgreiche Objektbereitstellung: Zehn Sekunden ohne erfolgreich abgeschlossene Objektoperation beenden den Start. Auch bei fortlaufendem Fortschritt gilt eine unveränderliche Gesamtobergrenze von 120 Sekunden. Telemetrie, fehlgeschlagene IO oder alte Generationen verlängern keine dieser Grenzen. Andere Module behalten ihre bisherigen Startfristen. Die Berechtigungserneuerung bleibt vom ausstehenden Start unabhängig.

Der Host meldet währenddessen `STARTING`; `RUNNING` und `active=true` setzen den abgeschlossenen tatsächlichen Modulstart voraus. Die zusätzlichen öffentlichen Felder `details.startup.completedObjects`, `pending` und `error` enthalten ausschließlich Zähler, Zustand und begrenzte Fehlercodes. HTTP-Konfigurationsbereitschaft und EMS-Zuordnung sind weiterhin eigene Zustände.

Der identische Drei-Profil-Prüfaufbau startet nach der Änderung in etwa 14 Sekunden vollständig. Eine zusätzliche Zwischenprüfung nach elf Sekunden bestätigt `STARTING`, `active=false` und fortschreitende Objektbereitstellung. Alle drei Erstanfragen werden unabhängig beobachtet; Metadatenbereitschaft behauptet keine vorhandenen Messwerte.

## 2. Eine kurz abgelaufene Lease konnte das Modul dauerhaft intern stoppen

Ein echter lokaler UDP-Sender versorgt den echten Speedwire-Socket, Parser, Gerätescheduler und Modulhost mit SMA-Telegrammen. Eine gezielte 12,5-sekündige Eventloop-Unterbrechung lässt die tatsächliche monotone Zwölf-Sekunden-Lease ablaufen; die anschließende Eigentumsprüfung dauert 200 ms. Der Test ersetzt weder Uhr noch Lease oder `canOperate`. Er prüft ausdrücklich, dass die Berechtigung wirklich abgelaufen ist.

Im unveränderten Stand 9.0.18 bleibt die Messung danach aus. Der finale Fehlerbeleg zeigt gleichzeitig `status.active=true`, `reason=RUNNING`, aber intern `state=stopped`, `running=0` und `runtime.started=false`. Ursache: `Devices.refresh()` stoppte intern, während der Host weiterhin dieselbe Modulinstanz führte und nach erfolgreicher Lease-Erneuerung wieder als laufend auswies. Der gleiche Test scheiterte vor der Korrektur auch im damaligen 9.0.19-Arbeitsstand.

Jetzt besitzt ausschließlich der Modulhost die Stopentscheidung und deren Bestätigung. Während einer vorübergehend fehlenden Berechtigung meldet Devices `blocked` und offline. Alle tatsächlichen Treiber-/Schreibzugriffe bleiben synchron durch dieselbe Berechtigungsschranke geschützt. Echte Lizenz-/Eigentumsentzüge führen weiterhin zum Host-Stop. Nach einer nur kurz unterbrochenen Lease nehmen gültige Geräteabrufe wieder teil; ein unbekannter oder fehlgeschlagener Stop erlaubt keinen zweiten Treiberstart.

## Prüfungen und Rohbelege

| Prüfung | Ergebnis und Grenze |
| --- | --- |
| `test/eos-devices-start-lifecycle.test.cjs` | Drei reale Profile, langsame Controller-Metadaten, beobachtete Erstantworten, verspätete Antwort nach Stop; zusätzlicher IO-Stillstand wird nach zehn Sekunden begrenzt. Unbestätigter Stop bleibt gesperrt. |
| Harte Startobergrenze | Die 120-Sekunden-Grenze wird in einem isolierten Watchdog-Test mit eingespeister monotoner Uhr geprüft; kein 120-sekündiger realer Lasttest behauptet. Auch gerade bestätigter Metadatenfortschritt hebt sie nicht auf. |
| Stop während gehaltener Metadaten-IO | Unveränderte maximale Stopfrist von 3,5 Sekunden. Die ursprüngliche Start-/Schreiboperation bleibt für die spätere Bereinigung beobachtet; danach entsteht kein Transport. |
| `test/eos-device-ems-udp-lifecycle.test.cjs` | Echte UDP-Sockets und Telegramme: Save/Treiberersatz, Eigentumsabfrage-Timeout mit bestätigtem Wiederanlauf, tatsächlicher Lease-Ablauf mit Erholung und echter Berechtigungsentzug ohne alte Wertepublikation. Keine reale SMA-Hardware. |
| Gezielt kombinierter Testlauf | 60 Tests bestanden; Host-, Save-, Service-, Start- und UDP-Fälle. Keine Addition mit überlappenden früheren Teilprüfungen. |
| Tatsächliche Web-/HTTP-Pipeline | 12 Tests einschließlich Untertests bestanden, mit produktivem Bridge-/HTTP-/Host-/Runtime-Pfad und ersetzten physischen Transporten. |
| Build und statische Prüfungen | Backend-Build, striktes CheckJS für Planer/Übergabedienst, Devices-Hosted-Typprüfung und vorhandene Lintprofile der geänderten Host-/Moduldateien bestanden. Die Hosted-Typkonfiguration löst jetzt das tatsächlich importierte Alias-JSON auf. |

Die unveränderten Rohbytes der ausgeführten Läufe liegen in `raw/devices-incident-*.log`. `metadata-before` und `lease-918-before` sind **erwartet fehlgeschlagene Vorher-Reproduktionen**. Es wurden keine nachträglichen Zeit-/Prozessmetadaten für diese historischen Läufe erfunden. `metadata-after`, `host-final`, `web-pipeline` und `lease-after` dokumentieren die jeweiligen erfolgreichen Nachprüfungen. Die allgemeine Release-Belegerstellung bildet zusätzlich Hashes dieser Dateien.

Die separate Speedwire-Socket-/Shared-Hub-Korrektur und die Behandlung vorübergehender Autorisierungsfehler in Modbus-Optionalgruppen sind eigene Prüfbereiche. Die vorliegenden Ergebnisse beweisen keine durchgängig fehlerfreie Kundenanlage; Netzwerk, tatsächliche Herstellerantworten und Hardwarebetrieb bleiben getrennt zu prüfen.
