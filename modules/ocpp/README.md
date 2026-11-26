# Integriertes OCPP-Modul 0.4.4

Dieses Modul ist seit NexoWatt EOS 9.0.24 Teil der gemeinsamen Installation. Es enthält den gelieferten und geprüften OCPP-Kern 0.4.3 unter MIT-Lizenz sowie eine neue typisierte Prozessgrenze. Eine zweite Installation von `iobroker.ocpp21` ist für neue Anlagen nicht erforderlich. Herkunft, Originalprüfsummen und Änderungen stehen in `provenance.json`.

## Stationszustand im LIVE-Dashboard ab EOS 9.0.35

Ein Boot, Heartbeat oder empfangener Status- bzw. Messwert bestätigt die OCPP-Sitzung. Nach einem Verbindungsabbruch oder nach Ablauf des vorhandenen OCPP-Aktivitätsfensters meldet der Worker eine bestätigte Station als offline. Beim Wiederverbinden wartet er auf die erste Stationsmeldung. Eine betriebsbereite Station ohne Fahrzeug gilt als online.

Im Dashboard erscheinen fortlaufende Namen wie „Ladestation 1“. Ihre Reihenfolge richtet sich nach der Anmeldung im aktuellen Prozess. Die Anzahl ausgefallener Stationen umfasst auch Fälle über die ersten zwölf Namen hinaus. Für interne Benachrichtigungen liefert der Worker bis zu 256 pseudonyme Stationsschlüssel. Die OCPP-Zulassungsliste erlaubt Anmeldungen. Ein Eintrag allein macht eine Station noch nicht zu einem erwarteten Gerät. EOS merkt sich nach bestätigtem Boot, Heartbeat, Status oder Messwert einen pseudonymen Schlüssel im Stationskanal. Beim Neustart lädt es diese Nachweise aus dem verwendeten ioBroker-Namensraum. Bei älteren Ständen zählen ein durch Boot gesetztes Heartbeat-Intervall oder gespeicherte Boot-, Heartbeat- und Messwertzeiten zusammen mit der bestätigten Stationsidentität. Eine Socket-Anmeldung oder ein Eintrag in der Zulassungsliste genügt dafür nicht.

Vorher bestätigte Stationen erscheinen bis zur Wiederanmeldung als unbekannt. Liegt vor dem Neustart ein bestätigter Verbindungsabbruch vor, bleibt die Station offline. Nach Ablauf des regulären OCPP-Aktivitätsfensters gilt auch eine weiterhin ausbleibende Anmeldung als Ausfall. Mit den Standardwerten beträgt das Fenster 750 Sekunden. Erst eine neue OCPP-Aktivität bestätigt die Rückkehr. Beim Start werden höchstens 1.024 Stationswurzeln ausgewertet. Fehlende oder unvollständige historische Auskunft ergibt einen unbekannten Status. Die Datenbankabfrage läuft unabhängig vom Serverstart. Die laufende Dashboard-Abfrage liest ausschließlich aus dem Arbeitsspeicher.

## Laufzeit und Zuständigkeit

Der generische EOS-Modulhost startet OCPP in einem eigenen Node-Prozess. Die bestehende Stations-, Messwert-, Konfigurations- und Protokollimplementierung läuft tatsächlich in diesem Prozess. Sie instanziiert keinen zweiten ioBroker-Adapter und keinen zusätzlichen Controller. IO-Aufrufe gehen über die beschränkte, generationengebundene Host-Schnittstelle.

Der OCPP-Prozess ist unabhängig vom UI-/EMS-Prozess. Ein UI-/EMS-Neustart beendet weder den OCPP-Listener noch EEBUS oder Devices. Ein Widerruf der OCPP-Modulberechtigung hingegen sperrt alte Operationen und schließt dessen Listener. Der Host kann danach eine neue Prozessgeneration starten; eine widerrufene Instanz nimmt alte Aufträge auch nach einer erneuten Freigabe nicht wieder auf.

Neue Anlagen verwenden `eos-admin.N.ocpp`. Die geprüfte Übergabe einer vorhandenen Instanz 0.4.2 oder 0.4.3 kann deren Wurzel `ocpp21.N` erhalten. Die zentrale Übergabe muss den bisherigen Prozess vor Übernahme stoppen und die alleinige Zuständigkeit sichern. Stations-IDs und vorhandene Konfigurationen bleiben dann unter derselben Wurzel. Der Import selbst konvertiert keine Identitäten und liest keine externen Schlüsseldateien.

`info.eosHostedRuntime=true` kennzeichnet die integrierte Laufzeit. `info.runtimeAlive` stammt vom OCPP-Kindprozess, wird nach erfolgreichem Listenerstart und anschließend alle fünf Sekunden mit bestätigtem Zeitstempel geschrieben. Beim Stop erfolgt bestmöglich `false`. Der Zustand des EOS-Elternprozesses ersetzt diesen Nachweis nicht. Zusätzlich bleiben die ursprünglichen Stationsindikatoren für Verbindung, Aktivität und Messwertfrische erforderlich.

## Konfiguration und Kompatibilität

Der Export `createHostedModule({adapter, config, canOperate, getAuthorityGeneration, onAuthorityLost, dataDir})` liefert `start`, `stop`, `getStatus`, `onStateChange` und `command`. `command` erlaubt nur die Statusabfrage. Native Stationsbefehle laufen über die bestehenden kontrollierten States.

`native-defaults.json` enthält alle gelieferten nativen Standardeinstellungen plus `enabled:false`. Erst eine gültige aktivierte Konfiguration und aktuelle Modulberechtigung öffnen den Listener. Der Port ist eine Ganzzahl von 1024 bis 65535, Standard 9220. OCPP 1.6, 2.0.1 und 2.1 bleiben verfügbar. Native Einheiten, Phasen- und Profilparameter bleiben erhalten. Importierte ältere Einstellungen für Alias-Erzeugung und Objektbereinigung werden weiter berücksichtigt; frische Installationen aktivieren diese nicht.

Unbekannte Einstellungen werden abgewiesen. Insbesondere werden nicht implementierte TLS-, Zertifikat- oder Authentifizierungseinstellungen nicht stillschweigend als Klartextbetrieb importiert. Die gelieferte Implementierung bindet standardmäßig einen normalen WebSocket-Listener an `0.0.0.0`; eine Identitätsliste ist ein Namensfilter, kein kryptografischer Stationsnachweis. Die getrennten EOS-Stationsanzeige-Links sind eine andere Funktion und ändern dieses OCPP-Protokoll nicht.

Die neue Prozessgrenze begrenzt Stationsidentitäten auf 128 Zeichen, 256 verschiedene Identitäten je Laufzeit und 256 gleichzeitig registrierte Clients. Die reservierte Identität `info` ist nicht zulässig. WebSocket-Nachrichten sind auf 1 MiB begrenzt; maximal fünf ungültige RPC-Nachrichten werden zugelassen. Die Konfiguration ist auf 128 Schlüssel und 64 KiB begrenzt. Diese Softwaregrenzen ersetzen keine Anlagenprüfung.

## Regelleistung und EMS-Ausfall

Die vorhandene Stationsregelung ist stationsweit: ein Regelobjekt pro physischer Station. Mehrere Stecker sind keine unabhängigen Regler. Wattvorgaben bleiben Watt; ein echtes Nullprofil wird nicht auf einen Mindeststrom angehoben. Eine Eingangsbestätigung des ioBroker-States bestätigt allein noch keine physische Umsetzung.

`control.chargeLimitStatus` ist die atomare Rückmeldung mit Schema 1, aktuellem `sessionId`, `requestedW`, `appliedW`, `appliedAtMs`, `updatedAtMs`, `valid`, `reason` und `error`. Nur eine passend zur aktuellen Verbindung erhaltene `Accepted`-Antwort bestätigt das Profil. Andere Konfigurationsantworten erzeugen keine Leistungsbestätigung. Zurückgewiesene, abgelaufene oder veraltete Antworten dürfen keine alte gültige Leistungsrückmeldung wiederherstellen.

Der opt-in EOS-Steuerlease bleibt unabhängig vom EMS-Prozess erhalten:

- `info.eosControlLeaseSupported` zeigt die Fähigkeit an.
- Ein neuer gültiger Schreibauftrag an `control.eosLeaseUntilMs` aktiviert die persistente Verriegelung `control.eosLeaseArmed`. Eine Frist muss in der Zukunft und höchstens 30 Sekunden entfernt liegen. Der Auftrag muss aktuell und von bestätigter Qualität sein.
- EOS erneuert im Betrieb die 15-Sekunden-Frist alle fünf Sekunden. Ein separater Ein-Sekunden-Watchdog im OCPP-Prozess überwacht sie.
- Bei Ablauf wird ein echtes Nullprofil in der vorhandenen seriellen Befehlsfolge angefordert. Neue positive Profile sind gesperrt; verspätete Antworten eines früheren positiven Auftrags bestätigen keinen aktuellen Sollwert.
- Eine Erneuerung stellt die alte positive Leistung nicht automatisch wieder her. Nach einem bestätigten Nullprofil ist ein neuer Leistungsauftrag erforderlich.
- Nach einem OCPP-Neustart bleibt die Verriegelung erhalten; gespeicherte Fristen werden nicht als neue Berechtigung wiederverwendet. Ohne zuvor aktivierten EOS-Lease bleibt der eigenständige native Stationsbetrieb erhalten.

Wenn die Netzwerkverbindung zur Station unterbrochen ist oder die Station das Nullprofil ablehnt, kann Software keinen physischen Ladestopp garantieren. Dies wird als unbestätigt dargestellt und erneut versucht. Eine abgelaufene Modulberechtigung schließt die Verbindung; sie berechtigt nicht zu weiteren Steuerbefehlen.

## Persistenz und Sicherung

Das Modul selbst legt keine zusätzlichen Schlüssel- oder Messwertdateien im Datenverzeichnis an. Die zentrale EOS-Modulkonfiguration und die ioBroker-Objekte/States bilden den dauerhaften Zustand. Zu den stationsbezogenen Konfigurationswerten gehören `control.eosLeaseArmed`, `control.numberOfPhases`, `control.chargeLimitType` und die vorhandenen `configuration.*`-Werte samt Metadaten. Gesicherte Telemetrie, Session-IDs, Sollwerte oder alte Lease-Fristen sind bei einer Wiederherstellung keine neue Steuerfreigabe.

## Reproduzierbare Softwareprüfung

Vom EOS-Projektverzeichnis:

```sh
node node_modules/typescript/bin/tsc -p modules/ocpp/tsconfig.json
node node_modules/eslint/bin/eslint.js --config modules/ocpp/eslint.config.mjs modules/ocpp/src/*.ts
node --test modules/ocpp/test/*.test.*
node --test test/eos-module-ems-independence.test.cjs
```

Die neue Lifecycle-, Konfigurations-, Netzwerk- und Dispatch-Grenze ist mit `strict:true` typgeprüft und gelintet. Der übernommene native JavaScript-Kern wird dadurch nicht nachträglich als vollständig TypeScript-geprüft ausgegeben. Seine 74 ursprünglichen Regressionstests bleiben erhalten. Hinzu kommen zehn echte Loopback-WebSocket-/Hosttests, einschließlich aller drei Protokolle, Übernahme des Namensraums, hartem Nullprofil, Leaseablauf, Portkonflikt, Widerruf während eines ausstehenden Befehls und abgelaufener Stationsaktivität. Die eigenen 84 Tests bestanden auf Node 22.23.4 und 24.22.3. Ein separater Integrationstest startet die tatsächlichen Modulprozesse und beendet/ersetzt den tatsächlichen UI-/EMS-Prozess während einer offenen OCPP-Verbindung.

Die produktive Abhängigkeit ist exakt `ocpp-rpc@2.2.1` aus dem zentralen EOS-Lockfile. Dessen upstream gepinntes AJV 8.14.0 bleibt erhalten. Der Produktionsaudit meldet dafür zwei moderate Einträge (AJV und abhängiges ocpp-rpc; GHSA-2g4f-4pwh-qvx6). Das betroffene `$data`-Feature ist im geprüften `new Ajv({strictSchema:false})` nicht aktiviert. Ein zuvor tatsächlich geprüfter Override auf AJV 8.20.0 brach bereits den Modulimport wegen inkompatibler URN-Schemaauflösung und wurde zurückgenommen. Der Befund bleibt offen dokumentiert, nicht als behoben ausgegeben.

Die Prüfungen verwenden lokale Protokollgegenstellen und echte Prozesse. Sie belegen keine Zertifizierung oder vollständige Interoperabilität mit noch nicht angeschlossener Hardware.
