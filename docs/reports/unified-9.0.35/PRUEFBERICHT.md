# NexoWatt EOS 9.0.35 · Prüfung der System- und Geräteanzeige

Die Entwicklung basiert auf der vollständig geprüften Repository-ZIP 9.0.34. Der gemeldete Fehler wurde zusätzlich an der ausgelieferten 9.0.33 in Chromium untersucht.

| Prüfung | Ergebnis |
|---|---|
| Vollständiges `npm test` unter Node.js 22.23.4 | 2.893 bestanden, 2 plattformabhängig übersprungen, 0 fehlgeschlagen |
| Vollständiges `npm test` unter Node.js 24.22.3 | 2.893 bestanden, 2 plattformabhängig übersprungen, 0 fehlgeschlagen |
| Typprüfung, Lint und Builds | Bestanden, sieben bereits vorhandene Lint-Warnungen |

Die beiden Plattformprüfungen betreffen die Syntaxprüfung mit dem installierten `nginx` und vererbte POSIX-ACLs mit `setfacl`. Beide Werkzeuge fehlten auf dem Prüfsystem.

## Ursache und Behebung

Die Ladepunktanzeige, die Auswertung von EMS und Netzmessung sowie der Verbindungshandler beschrieben in 9.0.33 und 9.0.34 dieselbe Statuszeile. Ein vollständiges Live-Paket schrieb bei einer bereits gesunden Verbindung erneut „Verbindung hergestellt · Betriebsstatus wird geprüft“. Im folgenden Renderdurchlauf überschrieb ein unauffälliger Ladepunkt auch eine EMS-Stopp- oder Offline-Meldung mit „Alle Systeme normal“.

Mit unveränderter 9.0.33, einer simulierten gesunden Wallbox und 60 wiederholten vollständigen SSE-Paketen wurde der Prüftext zweimal in tatsächlich abgetasteten Browserframes beobachtet. Ein anschließender simulierter EMS-Stopp und der danach unterbrochene Datenstrom legten die widersprüchliche Entwarnung offen. Diese Reproduktion weist den Anzeigefehler nach. Der konkrete Auslöser für erneute Datenpakete auf der Kundenanlage ist aus dem Bildschirmfoto allein nicht feststellbar. [Originalmessung](raw/vergleich-9.0.33.json)

9.0.35 entscheidet an einer Stelle über Text und Schweregrad. Ein unveränderter Zustand lässt denselben Textknoten stehen. Die Ereignisfolge unterscheidet den ersten Snapshot nach der Verbindung vom erneuten Abgleich auf demselben Datenstrom. Warnungen und das Lesen der Prozessdiagnose sind von der Zehn-Sekunden-Anzeige der elektrischen Momentanwerte unabhängig.

Unter Chromium 158 blieb der Textknoten bei unverändert gesundem Betrieb trotz erneuter vollständiger Datenpakete unverändert. Die Prüfung lief mit dem ausgelieferten Dashboard in Deutsch, Englisch und Niederländisch. Über alle drei Sprachen wurden unter anderem Netzmessfehler, ein gestopptes EMS, der Abbruch und die Wiederherstellung der Live-Verbindung, der Ausfall mehrerer Module sowie mehrere benannte Offlinegeräte geprüft. Auf dem Wandtablet können die übrigen Namen über **Betroffene Geräte** aufgeklappt werden. Das endgültige Artefakt wurde zusätzlich auf Übereinstimmung mit seinen Soll-Prüfsummen geprüft. [Browserbeleg für die drei Sprachen](raw/dashboard-de-en-nl.json)

## Überwachung

Der Kundenendpunkt projiziert den lokalen Supervisorzustand auf Modulkennung, Beobachtungszeitpunkt, Störung und Pause sowie eine begrenzte Liste benannter Geräteausfälle. Verwaltungsbefehle, Prozessnummern, Zugänge und rohe Fehler gehören nicht zu dieser Antwort. Die Abfrage läuft alle zehn Sekunden auf dem sichtbaren Dashboard. Es läuft höchstens eine Abfrage gleichzeitig. Geräteworker übertragen ihre begrenzte Diagnose im vorhandenen Heartbeat. Bei unveränderter Diagnose genügt im Heartbeat eine Bestätigung. Die Anzeige benötigt keinen zusätzlichen Node-Prozess. Ein nicht erreichbarer Prozess ist für sich allein kein Beleg dafür, dass alle dahinterliegenden Geräte ausgeschaltet sind.

Der Test mit einem echten, lokal gestarteten EMS-Kindprozess beendete diesen Prozess bei erreichbarer Oberfläche. Die Kundenroute meldete den EMS-Ausfall und nahm ihn erst nach dem Wiederanlauf zurück. Der browsertaugliche Status enthält weder PIDs noch interne Fehlertexte. Ein getrennter Funktionstest benutzte bestätigte Modbus-Lesevorgänge am simulierten Wärmepumpenmodul. Nach dem Schließen des TCP-Ports bestätigten Geräteworker und Dashboard die Störung; nach dem Öffnen desselben Ports und echten Leseantworten bestätigten beide die Rückkehr. Das bewusst deaktivierte Gerätemodul erzeugte keinen physischen Gerätealarm. [EMS-Prozessausfall](raw/live-ems-loss.log) · [Geräteprozess bis zum Browser](raw/device-chain.json)

Mit einer lokalen OCPP-Gegenstelle wurden Boot, Verlust der freigegebenen Sitzung, Wiederverbinden, Entzug der Freigabe sowie eine erreichbare Ladestation ohne Fahrzeug geprüft. Die öffentliche Geräteliste enthält höchstens zwölf Namen und die Gesamtzahl. Für bekannte OCPP-Stationen ohne geeigneten Anzeigenamen verwendet EOS eine Stationsnummer. [OCPP unter Node 22](raw/ocpp-dashboard-stations-node22.log) · [OCPP unter Node 24](raw/ocpp-dashboard-stations-node24.log)

Beim Neustart liest der OCPP-Prozess zusätzlich die lokal bestätigte Stationshistorie. Eine vorher bestätigte Trennung bleibt gemeldet. Bei einer zuvor belegten Sitzung ohne bestätigte Trennung wartet EOS das längere Zeitfenster aus Aktivitätsgrenze und Heartbeat-Intervall mal Timeoutfaktor ab. Mit den Standardwerten sind das 750 Sekunden. Eine nie beobachtete Kennung in der Zulassungsliste löst keinen Alarm aus. Ein Test hielt die Antwort der historischen Abfrage gezielt zurück. Währenddessen konnte sich eine lokale Teststation am echten WebSocket-Server anmelden und eine OCPP-Nachricht austauschen. Alle 90 OCPP-Tests bestanden auf jeder der beiden Node-Versionen, darunter 16 Integrationsfälle im eingebetteten OCPP-Modul. [OCPP-Neustart unter Node 22](raw/cold-ocpp-22.log) · [OCPP-Neustart unter Node 24](raw/cold-ocpp-24.log) · [OCPP-Regressionslauf](raw/ocpp-history-node24.log)

Unterbrochenes TCP und ein zurückgesetzter Socket wurden auch getrennt geprüft. Bei MIRA konnten Transportfehler in der 300-Sekunden-Sperrliste für nicht unterstützte Registergruppen landen. EOS verwirft jetzt beim Transportabbruch den laufenden MIRA-Messzyklus und kann nach Rückkehr wieder messen. Echte Modbus-Antworten zu nicht unterstützten optionalen Registern behalten ihren eigenen Wiederholabstand. In beiden Fällen stieg im selben Geräteworker die Anzahl erfolgreicher Registerlesungen nach der Wiederverbindung von 22 auf 42 beim geschlossenen Port und auf 41 beim TCP-Reset. Die 71 ergänzenden Modbus- und MIRA-Tests bestanden unter beiden Node-Versionen. [Node 22](raw/node22-mira-reconnect-integrity.log) · [Node 24](raw/node24-mira-reconnect-integrity.log) · [Port geschlossen](raw/device-chain-closed-fixed.json) · [Verbindungen zurückgesetzt](raw/device-chain-rst-fixed.json)

Bei EEBus wurde der Verbindungsverlust mit zwei lokalen TLS-/SHIP-Gegenstellen geprüft. Erst nach bestätigtem Datenaustausch kann der Installateur die Überwachung unter einem verständlichen Namen einschalten. Bei einem Neustart erhält der Partner 120 Sekunden Zeit zum Wiederverbinden. Manuelles Trennen oder Widerrufen des Vertrauens pausiert die Überwachung dauerhaft bis zur erneuten Aktivierung. 31 EEBus-Tests bestanden auf jeder der beiden Node-Versionen. In Chromium wurden Aktivieren, Pausieren und Entfernen anhand des ausgelieferten Gerätedialogs geprüft. [Node 22](raw/eebus-monitor-node22.log) · [Node 24](raw/eebus-monitor-node24.log) · [Pairingdialog](raw/eebus-monitor-browser.json)

## Benachrichtigungen

Die zentrale EOS-Administration ermittelt Prozess- und Geräteausfälle unabhängig von einem geöffneten Browser. Die vorhandenen Benachrichtigungseinstellungen bestimmen Empfänger, Kategorien und Entwarnungen. Bestätigte Prozess- und Geräteausfälle werden im nächsten verfügbaren Versandlauf als kritische Vorfälle berücksichtigt. Ein durchgehend aktiver Vorfall behält seine Versandhistorie bei einem Neustart. Namen sind Anzeigetexte. Gleichnamige Geräte verschiedener Anbindungen behalten eigene Vorfälle.

Neun gezielte Mailtests bestanden unter jeder Node-Version. Lokale Tests mit zwei getrennten Node-Prozessen prüften den gemeinsamen Versand, Quoten, die Behandlung eines bereits früher gemeldeten Wechselrichters, den Wechsel von Empfänger und Freigabe während einer laufenden Erfassung sowie das Zurückgeben eines migrierten Namensraums vor und während eines laufenden SMTP-Versands. Eine unbekannte Erreichbarkeit oder ein Prozessneustart unterbricht die fünfminütige Bestätigung für eine Entwarnung. Ein zielgerichteter Test mit 256 Geräteausfällen bestätigte, dass ein weiterer EMS-Prozessausfall vorrangig zugestellt werden kann. In der Benachrichtigungspipeline werden bis zu 256 Einzelgeräte pro Anbindung und sechs Prozesse berücksichtigt. Die öffentliche Statuszeile zeigt die getrennt ermittelte Gesamtzahl der Offlinegeräte. Der lokale SMTP-Test prüft die Annahme am Mailserver. Tritt unmittelbar danach und vor der Speicherung der Versandbestätigung ein harter Prozessabbruch auf, kann ein Wiederholversuch eine zweite E-Mail auslösen. Die Zustellung bis ins Kundenpostfach ist Teil der Pilotabnahme. [Node 22](raw/notifications-node22.log) · [Node 24](raw/notifications-node24.log) · [Lokaler SMTP-Test](raw/notifications-legacy-node24.log) · [SMTP-Einstellungen in Chromium](raw/legacy-mail-setup-browser.log)

## Paketabhängigkeiten

Die npm-Prüfung der Produktionsabhängigkeiten meldete zwei Einträge mit mittlerer Einstufung für denselben bereits vorhandenen Abhängigkeitspfad von `ocpp-rpc` zu `ajv`. Hohe und kritische Einträge lagen in dieser Auswertung bei null. [npm-Prüfergebnis](raw/npm-runtime-audit.json)

## Offene Abnahme

Die Softwareprüfungen erfolgten auf Linux/x64. Auf einem Raspberry Pi mit einer physischen Anlage sind die Zeit bis zur bestätigten Geräteerkennung, das lokale Wiederanlaufverhalten, RAM unter Dauerlast und die Zustellung über das tatsächlich eingesetzte SMTP-Postfach zu prüfen. Ein stromloses oder vollständig ausgefallenes EOS kann aus eigener Kraft keine Nachricht mehr versenden. Die unabhängige Überwachung eines vollständigen Host-Ausfalls setzt einen externen Beobachter voraus.

[Maschinenlesbare Prüfergebnisse](PRUEFERGEBNISSE.json) · [Rohbelege](raw/INDEX.json) · [Pilotabnahme](../../start/START_HIER_9.0.35.md)
