# OCPP-Host, Rechte und Übernahme — EOS 9.0.24

Stand: 25.11.2026. Änderung: integriertes Modul `ocpp` auf Basis der bestehenden OCPP-Laufzeit; Modul-/Protokollimplementierung und echte WebSocket-Prüfungen werden zusätzlich in den OCPP-Berichten nachgewiesen.

## Prozess- und Datenvertrag

OCPP nutzt denselben bestehenden Modul-Supervisor wie Devices, EEBUS und Backup, aber einen eigenen Betriebssystemprozess und eine eigene Generation. Ein Neustart der UI-/EMS-Laufzeit beendet den OCPP-Prozess nicht. Der Parent bleibt für Lizenz, Eigentümerschaft, Konfigurationspersistenz und jede weitergereichte Datenbankoperation zuständig. Die gemeinsame Dienst-UID ist keine Sandbox gegen bösartigen lokalen Code.

Neue Anlagen verwenden `eos-admin.N.ocpp`. Übernommene Anlagen behalten `ocpp21.N` einschließlich bestehender Messwerte, Steuerpfade, `ts`, `q`, Historienreferenzen und optionaler Aliasnamen. Die Modulkonfiguration liegt verschlüsselt in `eos-admin.N.modules.ocpp.configuration`; Format, ACL 0600, Revisionsvergleich und Rückleseprüfung bleiben unverändert. Die zentrale Systemlizenz gilt mit; bestehende NWL2-Lizenzen behalten ihren ausdrücklich signierten Adapterscope `ocpp21`. Kein neues Lizenzformat und keine zweite Lizenzaktivierung wurden eingeführt.

Der Host erwirbt vor dem Start die konkrete Subscription `<OCPP-Namespace>.*`. Er hält sie unabhängig von Browserabonnements und gibt sie erst im bestätigten Stop einschließlich später Subscription-ACKs frei. Bestätigte Telemetrie (`ack:true`) wird vor IPC ausgefiltert; echte Befehle und deren ursprüngliche Zeit-/Qualitätswerte bleiben erhalten.

## Begrenzte Schnittstellen

- Eigene Objekt-/Stateoperationen bleiben unter dem wirksamen OCPP-Namespace. Fremde Adapter, Systemobjekte und beliebige Foreign-Methoden sind nicht freigegeben.
- Zustandsinventare sind auf 10.000 Einträge und 1 MiB begrenzt. Fremde Ergebnis-IDs, unvollständige/übermäßige Inventare und ein Generationswechsel während des Lesens werden abgewiesen.
- ObjectView erlaubt ausschließlich `system/state` für den konkreten eigenen Stationsbereich `.configuration.`; Start-/Endgrenze, Ergebnis-IDs sowie `value._id` und `doc._id` werden geprüft.
- Rekursive Löschungen bleiben unter einem eigenen lokalen Unterzweig. Optionale Fremdaliaszugriffe benötigen die vorhandenen Aliasflags, konkrete eigene Aliaspräfixe und Aliasziele im eigenen OCPP-Namespace. Gemeinsame Elternkanäle sind nur anlegbar, nicht überschreibbar oder löschbar.
- IPC behält Größen-, Mengen-, Frist- und Generationsgrenzen. Die Child-Lizenzlease läuft spätestens nach einer Sekunde aus. Eine monotone Berechtigungsgeneration macht zwischenzeitlichen Widerruf oder Ablauf auch nach sofortiger positiver Verlängerung erkennbar. Bereits begonnene Operationen dürfen diese Verlängerung nicht übernehmen.
- Meldet die OCPP-Laufzeit ihren irreversiblen Berechtigungsverlust, beendet der vorhandene Supervisor den alten Prozess bestätigt, bevor er mit begrenztem Backoff eine neue Generation startet. Ein lebender, aber dauerhaft gestoppter Child-Prozess wird dadurch nicht als laufende OCPP-Instanz weitergeführt.

## Migration und Rückfall

| Ausgangspunkt | Verhalten |
| --- | --- |
| Noch kein abgeschlossenes Übernahmejournal | OCPP 0.4.2/0.4.3 wird in den bestehenden Gesamtprozess aus Vorprüfung, verschlüsseltem Journal, Deaktivierung, bestätigtem Stopp, Rücklesen und Laufzeitprüfung aufgenommen. |
| EOS 9.0.23 mit bereits `COMMITTED` markiertem Journal | Keine nachträgliche automatische Abschaltung eines zusätzlich gefundenen OCPP-Adapters. Aktive oder nicht nachweislich gestoppte Altinstanzen blockieren den neuen Listener. |
| Manueller Import | Zuerst Altinstanz deaktivieren und ihren Stopp bestätigen lassen. Das Ziel muss deaktiviert sein. Import bindet Einstellungen und unveränderte Datenpunkt-IDs an den nochmals geprüften Quellstand; nach erfolgreicher verschlüsselter Speicherung bleibt das Ziel deaktiviert. Erst nach Prüfung explizit aktivieren. |
| Fehlgeschlagene laufende automatische Übernahme | Die bestehende koordinierte Rücknahme stoppt zunächst den neuen Runtime-Stand bestätigt, stellt anschließend die ursprüngliche Quellaktivierung wieder her und prüft deren Alive-Rückmeldung samt aktuellem Host. Erst danach wird ein vorhandener OCPP-Hosted-Marker zurückgenommen. |

Ein Crash, eine veraltete Telemetrie oder ein unbestätigter Stopp löscht `info.eosHostedRuntime` ausdrücklich nicht. Die Erkennung darf einen ausgefallenen Hosted-Prozess nicht mit einem laufenden Standalone-Adapter verwechseln. Es wurde kein neuer Rücknahme-Endpunkt für bereits abgeschlossene oder manuelle Übernahmen eingeführt; diese Fälle sind keine automatische Ein-Klick-Rücknahme.

Die gelieferte OCPP-Basis besitzt keine native TLS-/Basic-Auth-Konfiguration. Unbekannte entsprechende Quellfelder müssen die Vorprüfung blockieren; sie werden nicht still entfernt oder als übernommen ausgegeben. Protokoll- und Netzwerksicherheitsgrenzen stehen im separaten OCPP-Bericht.

## Prüfbelege

`test/eos-ocpp-host-migration.test.cjs` prüft mit echtem Host/Migrationskoordinator und synthetischer Controller-Datenbank: Lizenzscope, native Subscription vor Start, parallele Altinstanz, erhaltende manuelle Übernahme, Quelländerung während Konvertierung, automatische Journal-/Stopp-/Rücklese-Reihenfolge, bestätigte Rücknahme samt Hosted-Marker sowie bestehenden abgeschlossenen Journalstand. Der zusätzliche Lease-Test startet einen echten Child-Prozess mit einer kleinen Test-Runtime und prüft Widerruf, Ablauf, erneute Freigabe sowie bestätigtes Ende nach irreversibler Berechtigungsverlustmeldung.

Das unabhängige `test/eos-ocpp-isolation-review.test.cjs` prüft Namespace-Ausbrüche, begrenzte Inventare, Rückgabe-IDs, späte Ergebnisse, Generationen und ACK-Telemetrie. Rohbelege: `raw/ocpp-host-node22.tap`, `raw/ocpp-host-node24.tap`. Die vorhandenen Host-, ConfigStore-, Lizenz-, Migrations- und Prozessregressionen stehen in `raw/ocpp-host-regression-node22.tap` und `raw/ocpp-host-regression-node24.tap` (je 132/132 ohne Skips). Die fokussierten Host-/Migrations-/Scopeprüfungen umfassen je 15/15 erfolgreiche Tests unter beiden Laufzeiten. Scoped TypeScript-Prüfung (`tsconfig.eos-module-process.json`), ausführbares Linting aller geänderten JS-Grenzen und `git diff --check` wurden ausgeführt.

Dies sind Software-/Controller-Fixture- und Betriebssystemprozessprüfungen. Die physische Dousida-Wallbox, ihre Firmware, echte Lastvorgänge und Langzeitbetrieb wurden hier nicht abgenommen; daraus folgt keine Zusage vollständiger Fehlerfreiheit oder Zertifizierung.
