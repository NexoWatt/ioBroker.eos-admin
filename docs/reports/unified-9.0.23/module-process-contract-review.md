# Modulprozesse – unabhängiger Vertragsreview

Stand: 25.11.2026. Geprüft wurde die gemeinsame Arbeitskopie 9.0.23; keine Kundenanlage oder produktive Geräteverbindung wurde verwendet.

## Ergebnis

Die ursprünglichen Verträge von Devices, EEBUS und Backup wurden mit der neuen IPC-Fassade abgeglichen. Zwölf gezielte Tests laufen mit echten Node-Kindprozessen und der produktiven Worker-/Supervisorimplementierung. Ergebnis: 12/12 bestanden, siehe `module-process-contract-review.tap`. Befehl: `node --test test/eos-module-process-contract-review.test.cjs`.

Die produktiven Änderungen an Supervisor/Worker/Protokoll wurden vom implementierenden Agenten vorgenommen. Dieser Review ergänzte ausschließlich den separaten Test und den vorliegenden Nachweis.

## Verträge und überprüfte Übergänge

| Bereich | Erhaltener Vertrag / Nachweis |
| --- | --- |
| Freigabe | `canOperate()` bleibt synchron. Abgelaufene und in falscher Reihenfolge eintreffende Leases können den Worker nicht erneut freigeben. Die Workerzeit verwendet für Restfristen eine lokale monotone Deadline. |
| ioBroker-Fassade | Namespace/Instanz/Konfiguration bleiben Daten. Objekt- und State-Methoden laufen per Promise-RPC. Die dritte ACK-Argumentform von `setStateAsync` bleibt erhalten. |
| EEBUS | `sendTo` behält den Callbackvertrag; doppelte Parentantworten bewirken keine zweite Annahme. `onMessage` und bestätigte Trust-Revoke-States (`ack:true`, `val:false`) gelangen unverändert in das Modul. Lokale Adaptertimer liefern nutzbare Timerhandles. |
| Backup-Kontext | `getHistoryBackupRequirement` bleibt ein eigener asynchroner Kontextabruf. Die Produktionsfunktion `coverage` wurde über den Worker aufgerufen. |
| Download | Byteweise Backpressure, Abbruch vor dem ersten Lesen, verspätetes Öffnen nach RPC-Timeout und Hash-/Größengleichheit über 32 MiB wurden geprüft. |
| Produktions-Devices | Echte Modulfabrik mit leerer Geräteliste: Start, Objekt-/State-Provisionierung, Status und Stop. Kein Gerät geöffnet. |
| Produktions-EEBUS | Echte Modulfabrik mit deaktiviertem SHIP-Server, Discovery, Auto-Connect und Bridge: lokale Identität, vier Subscriptions, Status und Stop. Keine EEBUS-Gegenstelle. |
| Produktions-Backup | Echte Modulfabrik: privates temporäres Datenverzeichnis (0700), Wiederherstellungsschlüssel, READY-Status, Historienabdeckung, Subscription und Stop. |
| Backup-Unterprozesse | Ein echter Backup-Jobworker startete eine synthetische Controller-CLI. Nach SIGKILL des umgebenden Modulprozesses beendete der bestehende Disconnecthandler sowohl den losgelösten Jobworker als auch dessen Controller-Unterprozess. Unter Linux wurden nicht mehr laufende Prozesse anhand `/proc` bestätigt; Zombiestatus bedeutet beendet. |
| Diagnose | MQTT-URL-Zugangswerte und ein langes konfiguriertes Geheimnis werden vor der Ausgabe geschwärzt; brauchbarer Diagnosetext und Größenlimit bleiben erhalten. |

## Im Review reproduzierte und nachgebesserte Fehler

1. **Downloadpuffer:** `Readable.from` im standardmäßigen Object-Mode interpretierte die High-Water-Marke als Anzahl von Chunks. Korrektur: expliziter Byte-Readable mit begrenzter Vorabaufnahme.
2. **Unbenutzter Download:** Abbruch vor dem ersten Lesen führte den Generator-`finally`-Block nicht aus; der Worker behielt das offene Streamhandle. Korrektur: eigener Destroy-Pfad mit Remote-Close.
3. **Verspätetes Öffnen:** Ein nach RPC-Timeout fertig geöffneter Download hatte keinen erreichbaren Parent mehr. Korrektur: Parent-Token vor dem Öffnen und Cancel-Markierung auch für laufende Opens; spätes Ergebnis schließt seinen Stream.
4. **Zusammengefasste Chunks:** Node-AsyncIterator darf mehrere interne Blöcke zusammenfassen. Die pauschale Zurückweisung oberhalb 64 KiB brach gültige Downloads ab. Korrektur: begrenzter Restpuffer und Aufteilung in maximal 64-KiB-IPC-Antworten.
5. **Diagnosekontext:** Reine Fehlercodes hätten normale Gerätefehlermeldungen verdrängt. Die ergänzte begrenzte Textweitergabe wurde auf MQTT-Zugangswerte und Geheimnispräfixe vor Trunkierung nachgeprüft.

## Testgrenzen

- Die Prozessgrenze trennt Eventloops und Heaps; sie ist keine Sicherheitsisolation gegen Module mit demselben OS-Benutzer und dessen Dateirechten.
- Der Backup-Unterprozesstest verwendet die echte Backup-/Worker-/Command-Implementierung, aber eine synthetische Controller-CLI. Nur die Herstellervertrauens-Abfrage wurde im Test auf den dokumentierten Fall „nicht vorhanden“ gesetzt; keine Produktdatei oder reale Vertrauensinformation wurde geändert.
- Echte Modbus-/MQTT-/EEBUS-Gerätekommunikation, Herstellerkompatibilität, Regelzeiten auf Pi/IPC und Produktions-Dauerbetrieb bleiben in diesem Teilnachweis offen.
- Diese gezielte Nachprüfung ersetzt nicht die vom Hauptauftrag geführten Host-Lebenszyklus-, Paketierungs- und Gesamtregressionstests. Sie begründet keine pauschale Serienfreigabe.
