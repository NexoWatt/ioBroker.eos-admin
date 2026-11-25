# Unabhängige MQTT-Zweitprüfung an der EMS-/Gerätegrenze

Prüfdatum: 24.11.2026. Gegenstand ist die Stabilitätsänderung der Geräte-Arbeitsgruppe in `modules/devices/lib/drivers/mqtt.js`, `mqttPendingOperations.js` und `modules/devices/lib/deviceRuntime.js`. Diese Prüfung wurde von der getrennten EMS-Arbeitsgruppe durchgeführt. Produktänderungen blieben bei der Geräte-Arbeitsgruppe; eigene neue Assertiontests liegen in `modules/devices/test/mqttRuntimeSession.test.js`. Keine echte Kundenanlage wurde verbunden oder angesteuert.

## Tatsächlich geprüfte Aufrufketten

Die Prüfung verfolgte die Ereignisse `connect`, `message`, `close`, `offline` und `error` durch Transportgeneration, MQTT-Auftragsverwaltung, geordnete Nachrichtenverarbeitung, Runtime-Callbacks und ioBroker-Statewrites. Gelesen wurden außerdem die Betriebsfreigabe-Wrapper und der Operationskontext sowie der Pfad vom veröffentlichten Steuerauftrag bis zur Zeitüberschreitung und zum Stop. Ein MQTT-Broker-PUBACK bleibt von der physischen Leistungsreaktion getrennt; es werden keine Hardware-Readbacks durch einen lokalen Sollwert ersetzt.

Ein Ersatztransport erhält einen neuen MQTT.js-Client. Der interne MQTT.js-Reconnect und die QoS-0-Offlinewarteschlange sind abgeschaltet. Alte offene Aufträge werden mit ihrer Clientidentität beendet; neue Connect-/Publish-Aufrufe durchlaufen weiterhin die aktuelle Betriebsfreigabe. Bereits an das Netzwerk abgegebene Pakete können dadurch nicht zurückgerufen werden. Die Prüfung behauptet entsprechend nur, dass EOS alte Aufträge beim Ersatztransport nicht erneut absetzt, nicht, dass ein bereits gesendeter Befehl beim Empfänger ungeschehen wird.

## Im Review erkannte und korrigierte Grenzen

### 921-EMS-MQTT-001: Alte Runtime-Callbacks konnten Offline überschreiben

Die erste unabhängige Reproduktion hielt den tatsächlichen `DeviceRuntime._setStateCached()`-Datenbankauftrag einer alten MQTT-Sitzung an. Nach Invalidierung dieser Sitzung wurde Offline gemeldet; anschließend durfte der alte Auftrag abschließen. Die bisherige Runtime schrieb danach noch 19 alte Status-/Aliaswerte, einschließlich Verbindung, Leistungswerten und SoC. Ein Generationstest nur im Treiber vor dem Runtime-Callback genügte nicht, weil der Callback selbst mehrere asynchrone Datenbankaufträge ausführt.

Die Korrektur serialisiert MQTT-Runtime-Callbacks. Nach jedem bereits abgegebenen Datenbankauftrag wird die Sitzungsidentität erneut geprüft; Offline wird hinter dessen tatsächlichem Abschluss ausgeführt. Neue Sitzungen folgen anschließend. Ein bereits laufender Datenbankauftrag ist nicht abbrechbar, aber sein alter Callback darf keine weiteren Messwerte veröffentlichen. Stop invalidiert zuerst die MQTT-Sitzung und wartet auf die geordnete Verarbeitung, bevor er seinen endgültigen Offlinezustand bestätigt.

Drei Assertiontests gegen die unveränderte 9.0.20-Runtime schlagen an dieser Grenze fehl. Im Kandidaten prüfen die Tests sowohl endgültiges Offline als auch eine nachfolgende neue Verbindung und einen Stop während eines blockierten Writes. Der frühere rein diagnostische Reproduktionslauf und seine konkrete Statefolge sind separat erhalten; er wird nicht als bestandener Assertiontest gezählt.

### 921-EMS-MQTT-002: Vererbter Async-Kontext durfte keine FIFO-Sperre umgehen

In der ersten Korrektur erlaubte die FIFO bewusst direkte Wiederaufnahme innerhalb ihres aktiven Callbacks. Das vermeidet den Zyklus Offline → Treiberdiagnose → Alias-Callback → dieselbe FIFO. AsyncLocalStorage-Kontext wird jedoch auch an später laufende Timer vererbt. Ein Timer aus einem bereits abgeschlossenen Callback konnte so irrtümlich eine inzwischen anderweitig belegte FIFO umgehen.

Ein zusätzlicher Assertiontest reproduzierte diesen Fehler vor der Korrektur. Der Kontext trägt jetzt ein aktives Besitzertoken, das beim tatsächlichen Callbackabschluss in `finally` ungültig wird. Der Test prüft ausdrücklich einen geerbten, aber bereits abgeschlossenen Kontext. Der verschachtelte echte Diagnosepfad bleibt möglich und wird ebenfalls getestet.

### Weitere korrigierte Reviewpunkte

- Die Zeitgrenze für sichere Abschalt-Publishes war zunächst pro Schreibgruppe gerechnet. Sie ist jetzt ein gemeinsames monotones Budget von einer Sekunde für alle Gruppen, anschließend mit eigener Transportfrist. Der TCP-Test enthält drei Gruppen ohne PUBACK. Ein anschließender nicht abschließender Datenbankauftrag wird dadurch nicht plötzlich abbrechbar; er führt weiterhin zu einem unbestätigten Stop unter der äußeren Hostfrist.
- Eine Exception beim erzwungenen Transportende darf keinen zweiten Client neben einem unbestätigt alten Transport starten. Der betroffene Client bleibt für einen expliziten Stop erreichbar; `E_MQTT_STOP_UNCONFIRMED` wird sichtbar und automatischer Ersatz unterbleibt. Dafür existiert ein realer TCP-Fehlertest.
- Die Offline-/Reconnect-Folge wartet auf die reale Nachrichtenverarbeitung einschließlich schon abgegebener Rohdatenwrites. Der Nachrichtenhandler registriert den Folgeablauf beim Ausmustern eines Transports, wartet innerhalb seiner eigenen Queue aber nicht auf sich selbst. Die geordnete Offlinebarriere wird nicht wegen einer vollen Telemetriewarteschlange verworfen.

## Ressourcen- und Frischeprüfung

Der neue Nachrichteneingang begrenzt ausstehende Nachrichten auf 256, deren gesamte Payload auf 4 MiB und eine einzelne Payload auf 1 MiB. Pro Sitzung werden höchstens 512 erkannte Topics gehalten. Überlauf beendet die betreffende Sitzung sichtbar und verwirft deren alte noch wartende Nachrichten. Freigaben sind idempotent und werden in `finally` ausgeführt. Der Ersatztransport beginnt nach dem Drain; Topic-Erkennung wird für die neue Sitzung zurückgesetzt.

Die 1-MiB-Grenze wird am MQTT.js-`message`-Ereignis geprüft, also **nach dem MQTT-Paketparser**. Sie ist kein Nachweis einer vollständigen Netzwerkparser- oder RSS-Speicherobergrenze. Eine erzwungene Migration auf ein anderes MQTT-Protokoll wurde daraus nicht abgeleitet. Gleichfalls ist TCP-Verbindung kein Frischenachweis: Heartbeat und aktuelle Aliaswerte benötigen einen tatsächlichen zulässigen Messwert.

Die Runtime-FIFO begrenzt Telemetrieeinträge auf 32; Verbindungs-/Offlinebarrieren bleiben geordnet ausführbar. Getestet werden Überlast, verschachtelte Diagnose, vererbter Kontext und Drain. Ein dauerhafter Datenbankstillstand verhindert bewusst einen bestätigten Stop/Ersatztransport, statt Messwerte als frisch auszugeben. Eine harte Echtzeit- oder Hardware-Sicherheitsgarantie wird nicht behauptet.

## Nachweise

Die eigenen sechs Runtime-Tests wurden zusammen mit den echten TCP-Suiten `mqttCommandLifecycle.test.js`, `mqttResourceBounds.test.js` und `tesvoltMqttTransport.test.js` unter Node 22.23.4 und 24.22.3 ausgeführt: jeweils **25/25 bestanden, keine Skips**. Die abschließenden Rohlogs nach dem letzten expliziten Rejection-Catch heißen `raw/ems/mqtt-final-frozen-node22.log` und `mqtt-final-frozen-node24.log`; Ergebnis und Quellbindungen stehen in `raw/ems/evidence.json`.

Der frühere kombinierte Lauf mit 21 Tests ist ebenfalls erhalten: 20 bestanden, ein Test erwartete noch einen Ersatztransport **vor** Freigabe seines absichtlich gehaltenen alten Datenbankwrites. Dieser Testvertrag wurde an das korrigierte Drain-Verhalten angepasst: erst Offline/kein Ersatz bestätigen, dann den alten Write freigeben, anschließend Ersatzverbindung prüfen. Das war eine Korrektur der Testreihenfolge, keine Lockerung des Produktverhaltens. Ein früher eigener Test prüfte den internen Queuezähler vor dessen abschließendem Promise-Mikrotask; auch diese zeitliche Testannahme wurde durch echtes `drain()` ersetzt und der Zwischenlauf erhalten.

Diese Zweitprüfung ergänzt Geräte- und Gesamtregressionen. Sie ersetzt weder einen Hardware-Abnahmetest noch die abschließende Releaseprüfung oder eine CRA-Konformitätsbewertung.
