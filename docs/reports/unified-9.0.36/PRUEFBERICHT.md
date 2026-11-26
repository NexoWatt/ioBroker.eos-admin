# NexoWatt EOS 9.0.36 · Bestandsübernahme und Prozessstart

Ausgangspunkt ist die unveränderte Repo-ZIP 9.0.35 (SHA-256 `4791efb73d6a29050dbca8050834acb946b204294739ef730731095d792eb263`). Die auf der Kundenanlage gemeldete 9.0.34 wurde zusätzlich als unverändertes Paket zum Vergleich gestartet.

| Prüfung | Ergebnis |
|---|---|
| Vollständiges `npm test` unter Node.js 22.23.4 | 2.929 bestanden, 2 plattformabhängig übersprungen, 0 fehlgeschlagen |
| Vollständiges `npm test` unter Node.js 24.22.3 | 2.929 bestanden, 2 plattformabhängig übersprungen, 0 fehlgeschlagen |
| Typprüfung, Lint und Builds | Bestanden, sieben bereits vorhandene Lint-Warnungen |

Die beiden Plattformprüfungen betreffen die Syntaxprüfung mit dem installierten `nginx` und vererbte POSIX-ACLs mit `setfacl`. Beide Werkzeuge fehlten auf dem Prüfsystem.

## Fehlerbild und Korrektur

Die Statusabfrage der betroffenen Installation ergab `BLOCKED / EOS_MIGRATION_DISABLED_UI_REVIEW` bei der Quelle `nexowatt-ui.0`. In 9.0.34 und 9.0.35 genügte `common.enabled=false` zum Abbruch der gesamten Vorprüfung. Die Altinstanz konnte bereits ordnungsgemäß beendet sein. In der Prozessübersicht erschienen anschließend mehrere Modulkonfigurationen als defekt, obwohl der Modulhost sie noch gar nicht eingelesen hatte.

Im direkten Vergleich lief 9.0.36 mit demselben Zustand bis `COMMITTED`. Der alte UI-Prozess wurde kein einziges Mal reaktiviert. Nach einem weiteren Neustart erschienen 1.562 W aus der Modbus-TCP-Gegenstelle auf dem ursprünglichen Datenpunkt. Die gespeicherten Verweise auf Tibber und InfluxDB waren weiterhin vorhanden.

Ein zweiter Versuch mit aktiver alter UI und aktivem Geräteadapter zeigte eine weitere Regression. Während neue Kinder noch hochfuhren, deutete die Übernahmeprüfung einen vorläufigen Zustand bereits als endgültigen Fehler und leitete einen Rückfall ein.

9.0.36 prüft den belegten Stopp einer deaktivierten Alt-UI. Gespeicherte Konfiguration und Datenpunkte werden bei geeigneter Quelle und freiem Ziel unter ihrem bestehenden Namensraum übernommen. Das Journal hält den ursprünglichen Aktivierungszustand der Quelle fest. Das Startfenster erlaubt kontrollierten Anlauf. Ein tatsächlicher nicht auflösbarer Fehler bleibt ein Rückfallgrund.

## Prozess und Betrieb

Die Oberfläche trennt laufenden Prozess, bestätigten Heartbeat und Betriebsfreigabe. Fachlich unabhängige Module erhalten eigene Übernahmeentscheidungen. Ein alter Besitzer darf nicht gleichzeitig mit EOS denselben Port, dieselbe Verbindung oder dieselben Stellgrößen führen. Die Verwaltung zeigt an, welcher Bereich wartet. Das Kunden-Dashboard und der Benachrichtigungspfad werten eine bestätigte Bereitschaft entsprechend aus. Fehlende Lebenszeichen eines zuvor laufenden Prozesses bleiben erkennbar.

Im Parallelbetrieb mit einem alten Geräteadapter und einem externen OCPP-Adapter lief die neue Instanz mit sechs getrennten Kindprozessen. Geräte und OCPP meldeten während der Wartezeit jeweils eine eigene Prozessnummer und mehrere Heartbeats. Der Test beobachtete keinen Kontakt des neuen Gerätetreibers mit dem Prüfgerät. Der interne OCPP-Port blieb frei. Gleichzeitig arbeiteten Oberfläche, EMS, EEBUS und Sicherung mit ihren eigenen Freigaben.

Im Wartemodus erhält der neue Modulprozess weder die Betriebskonfiguration noch Gerätezugangsdaten. Er lädt den eigentlichen Treiber erst in der operativen Prozessgeneration. Die Prozessübersicht meldet eine bestätigte Wartezeit getrennt von einem Absturz. Das Dashboard zeigt „Wartet auf Übernahme“. Unbeobachtete Geräte lösen im Wartemodus weder eine Offline-Meldung noch eine Entwarnung aus.

Startet die Instanz vor der ersten gültigen Lizenzaktivierung, fordert sie nach erfolgreicher Aktivierung einmalig einen regulären Neustart über ioBroker an. Damit durchläuft sie die Bestandsprüfung auch bei dieser Installationsreihenfolge. Die Statusanzeige und die automatische Lizenzreaktion benötigen keinen zusätzlichen Abfragetakt.

Das Lesen jeder Modulkonfiguration unterscheidet einen noch ausstehenden Versuch von einem tatsächlichen Fehler. Ein vorübergehender Controller-Lesefehler führt zu begrenzten, zeitlich gestaffelten Folgeversuchen. Unlesbare oder abweichende gespeicherte Konfigurationen werden nicht durch Standardwerte überschrieben.

## Gleichzeitiger Neustart und Konfigurationsänderung

Im Geräte-Test blieb der Stopp des alten Treibers absichtlich ausstehend, während die neue Konfiguration gespeichert und die Zuständigkeit erneut geprüft wurde. 9.0.36 wartet auf den bestätigten Stopp. Anschließend startete genau eine neue Generation mit dem gespeicherten Abfrageintervall von 3.500 ms. Ein zweiter Test beobachtete bei 25 aufeinanderfolgenden Prüfungen denselben passiven Prozess. Unter Linux waren keine TCP-, UDP- oder Raw-Sockets dieses Kindes geöffnet.

[Nachweis der Prozessübergabe](raw/standby-independent-drain.log) · [PID und offene Sockets](raw/standby-independent-sockets.log) · [Wechsel von 9.0.34](raw/customer-934-node22-final.log) · [Wechsel von 9.0.35](raw/customer-935-node24-final.log)

## Schalter der Prozessverwaltung

Über den angemeldeten Admin-Zugang wurden Oberfläche, EMS, Geräte, EEBUS, Sicherung und OCPP einzeln deaktiviert. Der Aufruf stoppte jeweils den ausgewählten Prozess. Nach einem vollständigen Wechsel des Admin-Hostprozesses und einer neuen Anmeldung blieben alle sechs Pausen gespeichert. Der Versuch wurde unter Node.js 22 und 24 jeweils mit und ohne konkurrierende Altadapter durchgeführt. Jede Freigabe über den Steuerendpunkt erzeugte wieder einen Prozess mit eigener PID und aktuellem Heartbeat. Das galt auch während eines Konflikts mit alten Geräte- und OCPP-Adaptern. Der Geräteprozess öffnete dort keine Verbindung. Bei pausierter Oberfläche lief das EMS weiter.

[Admin-API und erneutes Aktivieren der sechs Prozesse](raw/customer-admin-six-controls24.log) · [Admin-Prozesswechsel auf Node.js 22](raw/customer-six-process-restart-node22.log) · [Admin-Prozesswechsel auf Node.js 24](raw/customer-six-process-restart-node24.log)

## Abhängigkeiten

Die Prüfung der Produktionsabhängigkeiten mit npm meldete zwei moderate Einträge für das über `ocpp-rpc` eingebundene `ajv` und sein abhängiges Paket. Sie meldete keine hohen oder kritischen Treffer. Der vollständige Prüfstand ist im [npm-Bericht](raw/npm-runtime-audit.json) enthalten.

## Ressourcen

Bei einer einzelnen Linux/x64-Messung unter Node.js 24.22.3 belegten die vier gleichzeitig wartenden Modulprozesse zusammen 49.915 KiB PSS (rund 48,7 MiB anteilig zugerechneter physischer Speicher). Diese Messung umfasst die passiven Prozesse für Geräte, EEBUS, Sicherung und OCPP. Der aktive Regelbetrieb und der Gesamtverbrauch der Instanz auf dem Raspberry Pi sind separat zu messen.

[Messwerte der vier Prozesse](raw/module-standby-linux-memory.log)

## Zielanlage

Die Labortests verwenden synthetische Geräte- und Kundeneinstellungen. Die Software wurde unter Linux/x64 geprüft. Für die Kundenanlage stehen die Abnahme an den physischen Geräten, der vom dortigen ioBroker bestätigte Übernahmestatus und die RAM-Messung auf dem Raspberry Pi im laufenden Betrieb aus. Die kundenspezifische ioBroker-Datenbank wurde nicht eingelesen.

[Details zur Übernahme und zum Rückfall](MIGRATION.md) · [Installationsanleitung](../../start/START_HIER_9.0.36.md) · [Prüfergebnisse](PRUEFERGEBNISSE.json) · [Rohbelege](raw/INDEX.json)
