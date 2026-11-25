# Integrierte Modullaufzeiten ab EOS 9.0.23

Devices, EEBUS und Backup laufen im Produktionspfad jeweils in einem eigenen Node.js-OS-Prozess. Der zentrale EOS-Adapter bleibt Eigentümer der ioBroker-Verbindung, Konfiguration, Lizenzentscheidung, Namensräume und Migration. Für gezielte Bestandstests bleibt die ausdrücklich injizierte Factory verfügbar; sie wird im Produktionspfad nicht verwendet.

Seit 9.0.24 laufen auch OCPP und die gemeinsame UI-/EMS-Laufzeit jeweils in eigenen Prozessen. Der HTTPS-Adminserver, Anmeldung und Prozessverwaltung bleiben im zentralen Adapter. Die Freigaben ab 9.0.25 steuern diese fünf vorhandenen Prozesse; sie erzeugen keinen zusätzlichen Prozess.

## Gespeicherte Prozessfreigaben ab EOS 9.0.25

Für UI/EMS, Devices, EEBUS, Backup und OCPP gibt es getrennte Aktionen zum Freigeben, Abschalten und Neustarten. Ohne gespeicherte Einstellung sind alle fünf Prozessfreigaben `true`. Beim erstmaligen Lesen dieser Vorgabe wird kein Konfigurationsobjekt geschrieben. Die Freigabe allein startet kein deaktiviertes oder noch nicht konfiguriertes Modul.

Eine manuelle Abschaltung wird vor dem Stoppen gespeichert und bleibt bei einem EOS-/Controller-Neustart bestehen. Sie verändert weder Geräteprofile noch die Modulkonfiguration. Erneutes Freigeben prüft weiterhin Lizenz, abgeschlossene Migration, eindeutige Eigentümerschaft und die eigene Aktivierung des Moduls. Ein Prozessschalter kann diese Voraussetzungen nicht ersetzen. Eine unlesbare oder ungültige Freigabekonfiguration erteilt keine Startfreigabe.

Die Einstellung liegt verschlüsselt im Konfigurationsobjekt `eos-admin.<Instanz>.modules.runtime.configuration`, getrennt vom Adapterinstanzobjekt und den einzelnen Modulkonfigurationen. Die Nutzdaten enthalten die fünf booleschen Freigaben `ui`, `devices`, `eebus`, `backup` und `ocpp`. Auch bei übernommenen Modulnamensräumen bleibt dieses Objekt beim zuständigen EOS-Adapter. Zugriffsrechte und Revisionsprüfung entsprechen dem bestehenden geschützten Konfigurationsspeicher. Eine Prozessaktion schreibt nicht `system.adapter.eos-admin.<Instanz>` und erzwingt daher keinen Neustart des gesamten Adapters.

| Anzeige | Bedeutung |
| --- | --- |
| Prozess freigegeben | Die gespeicherte Bedienentscheidung erlaubt den Betrieb. Weitere Startvoraussetzungen können ihn trotzdem sperren. |
| Prozess gestartet / PID vorhanden | Der Betriebssystemprozess existiert. Das belegt noch keine erfolgreiche Initialisierung oder Geräteverbindung. |
| Modul aktiv / EMS bereit | Die jeweilige Initialisierung und aktuelle Betriebsfreigabe sind bestätigt. Messwertfrische und physische Verbindung werden weiterhin gesondert geprüft. |

Die HTTPS-Administration bleibt beim Abschalten des UI-/EMS-Prozesses erreichbar. Über sie können Status, Fehlergründe und Freigaben geprüft werden. Die gestoppte UI-/EMS-Laufzeit liefert in dieser Zeit keine laufende Energieverwaltung. Ein Ausfall des zentralen Adapters selbst ist davon nicht abgedeckt.

Ein vorhandener externer OCPP-Adapter wird seit 9.0.25 beim normalen Start nicht automatisch übernommen. Er darf weiterlaufen; eine solche Instanz sperrt weiterhin den eingebetteten OCPP-Listener, solange ihr Stopp nicht bestätigt ist. Eine bewusste Übernahme erfolgt über den vorhandenen Importweg mit dessen Versions-, Besitz- und Stopprüfungen. Bereits persistierte Übernahmejournale bleiben verbindlich und werden vor einer neuen Startentscheidung geprüft. Das bloße Freigeben des OCPP-Prozesses führt keine Übernahme aus.

### Neustart und Bestätigung

Ein Neustart speichert zunächst ebenfalls die Abschaltung. Erst nach bestätigtem Ende des alten Prozesses und abgeschlossenen bereits angenommenen Parent-Mutationen wird die neue Freigabe gespeichert und der Prozess gestartet. Scheitert dieser Stopnachweis, bleibt der Neustart gesperrt. Ein Absturz zwischen dauerhaft gespeicherter Abschaltung und neuer Freigabe führt nach dem nächsten Start weiterhin zum abgeschalteten Zustand. Ist die neue Freigabe bereits gespeichert, gelten beim Wiederanlauf erneut alle Startprüfungen.

Die Annahme einer Bedienaktion ist noch keine Erfolgsmeldung über den tatsächlichen Neustart. Der Auftrag bleibt bis zu seinem Abschluss gesperrt; ein abgebrochener HTTP-Aufruf löst keinen parallelen zweiten Auftrag aus. Der angezeigte Status und Fehlergrund zeigen das Ergebnis. Veraltete Konfigurationsrevisionen werden zurückgewiesen. Beim zentralen Herunterfahren werden neue Aufträge sofort gesperrt und bereits ausgegebene Speicheraufträge im regulären Shutdown mit abgewartet; die bestehende äußere Shutdown-Frist bleibt bestehen.

Prozessgenerationen verhindern, dass ein alter wartender Steuerauftrag die Freigabe eines neuen Prozesses übernimmt. Der Integrationstest prüft dies für einen positiven OCPP-Befehl, der beim Abschalten noch auf eine Parent-Datenbankantwort wartet. Nach Wiederverbindung wird der alte gespeicherte positive Sollwert nicht erneut gesendet; erst ein neuer Befehl an den richtigen Namensraum wird ausgeführt. Ein Prozessstopp oder geschlossener Socket ist dennoch keine Bestätigung, dass ein physisches Gerät seinen letzten Sollwert verworfen hat.

## Lebenszyklus und Freigabe

Der Host startet einen Prozess erst nach den bestehenden Eigentums- und Lizenzprüfungen. Er überträgt nur die jeweilige Modulkonfiguration, benötigte lokale Verzeichnisse und explizite Adaptermetadaten. Der Worker erhält weder das Owner-Objekt noch beliebige ioBroker-Methoden. Konfigurationsvalidatoren und administrative Katalog-/Migrationsmetadaten verbleiben im zentralen Host.

Der Worker prüft eine lokale, monotone Freigabefrist vor den vorhandenen Moduloperationen. Der Parent erneuert diese maximal eine Sekunde gültige Freigabe alle 250 ms. Sequenz und Versand-Ablaufzeit verhindern, dass verzögerte oder ältere IPC-Freigaben ihre Gültigkeit beim Empfang erneuern. Bei Widerruf sendet der Host unmittelbar eine negative Freigabe. Jede Adapteroperation wird im Parent erneut gegen die aktuelle Generation, Lizenz, Eigentümerschaft und den bereits bestehenden Namensraum geprüft. Ein abgelaufener IPC-Auftrag wird vor Dispatch abgewiesen. Bereits angenommene Datenbankmutationen werden vor Freigabe eines Neustarts vollständig abgewartet und nicht wiederholt.

Jeder Worker sendet alle 250 ms ein Lebenszeichen. Bleibt es vier Sekunden aus, wird seine Generation gesperrt und der Prozess beendet. Der Stop versucht zunächst die modulspezifische Bereinigung; danach folgen gegebenenfalls SIGTERM nach 900 ms und SIGKILL nach 1.600 ms. Ohne bestätigtes Prozessende beziehungsweise bei unbestätigten Parent-Mutationen bleibt der Neustart gesperrt. Nach bestätigter Bereinigung startet nur das betroffene Modul erneut: Wartezeit 1, 2, 4, 8, 16, 32, maximal 60 Sekunden; nach 60 Sekunden stabilen Betriebs beginnt die Staffel wieder von vorne.

Backup behält seine bestehenden separaten Jobprozesse und deren Beendigung bei IPC-Verbindungsverlust. Der neue Modulprozess umschließt diese Ausführung, ersetzt den bestehenden Jobschutz jedoch nicht.

## Begrenzte IPC-Schnittstelle

| Grenze | Umsetzung |
| --- | --- |
| Methoden | Explizite Modul-/Adapter-Listen; kein dynamischer Owner-Zugriff |
| Nachrichten | Maximal 2 MiB JSON, Tiefe 24, gefährliche Objektschlüssel abgewiesen |
| Ausstehende Arbeit | Maximal 128 Anfragen beziehungsweise ausstehende Sendebestätigungen pro Richtung |
| Rate | Maximal 8.192 empfangene Nachrichten pro Sekunde und Kanal |
| Generation | Jede Nachricht trägt die Prozessgeneration; fremde Generationen werden verworfen |
| Fristen | Normalerweise 5 Sekunden; Start bleibt innerhalb der bestehenden Startbudgets |
| Timer | Lokal im Worker, maximal 256 Adaptertimer, kein Überlappen asynchroner Timer-Callbacks |
| Downloads | Maximal vier, maximal 64 KiB pro IPC-Block, Byte-Backpressure und begrenzter Restpuffer |
| Diagnose | Maximal 20 Logmeldungen pro Sekunde, Länge begrenzt, bekannte Geheimnisse und URL-Anmeldedaten redigiert |

Backup-Downloads übertragen keine Dateipfade zur freien Öffnung im Parent. Der Worker öffnet weiterhin über die bestehende geprüfte Archivfunktion. Ein vor dem ersten Lesen abgebrochener Download sowie ein verspätet abgeschlossenes Öffnen werden explizit geschlossen. EEBUS-Callbacks und bestätigte Vertrauenswiderrufe bleiben erhalten. Gewöhnliche Messwertbestätigungen werden entsprechend dem jeweiligen Modulvertrag nicht unnötig als Steuerereignisse übertragen.

## Status und Betriebsgrenzen

Die bestehende Modulstatus-API ergänzt `details.process`: Zustand, PID, Generation, Neustartzahl, letztes empfangenes Lebenszeichen, nächster Neustart und bereinigter Fehlercode. Ein vorhandener Prozess ist noch kein erfolgreich gestartetes Modul; `active` bleibt bis zum bestätigten Start falsch. Physische Verbindung und Prozesszustand bleiben getrennte Angaben.

Diese Änderung isoliert Eventloops und viele Prozessausfälle. Sie ist keine Betriebssystem-Rechtesandbox: Die Prozesse laufen weiterhin unter dem ioBroker-Benutzer mit dessen Dateisystem- und Netzwerkrechten. Prozessbeendigung schließt Verbindungen, setzt aber keine physischen Gerätesollwerte zurück. Vorhandene profilorientierte Wiederherstellung, Keepalive, Regelgrenzen und Geräteschutzfunktionen bleiben unverändert. Der Ausfall des zentralen Adapters oder Controllers bleibt eine gemeinsame Abhängigkeit.

Vor einer Gerätefreigabe sind kontrollierter Prozessabbruch, Wiederverbindung, Sollwertbeobachtung und Dauerbetrieb mit dem jeweiligen tatsächlichen Profil zu prüfen. Für die Erprobung zuerst Konfiguration und Wiederherstellung sichern; beim Rückfall den bisherigen vollständigen Stand wiederherstellen, ohne parallel alte und neue Eigentümer derselben Geräte zu starten. Softwaretests und ein bestandener Test mit synthetischen Gegenstellen ersetzen diese Geräteabnahme nicht.

Prüfbelege: `docs/reports/unified-9.0.23/MODULE_PROCESS_IMPLEMENTATION.md` und `module-process-contract-review.md` im gleichen Verzeichnis.

## Ressourcen- und Ausfallprüfung der Prozesssteuerung 9.0.25

Die neue Steuerung verwendet die vorhandenen Hosts, Worker und den vorhandenen Konfigurationsspeicher. Sie ergänzt im Parent eine feste Liste mit fünf Freigaben und höchstens einen gleichzeitig angenommenen Bedienauftrag. Ihr Initiallesen hat eine begrenzte Frist von höchstens fünf Sekunden. Sie startet keinen weiteren Worker und keinen eigenen periodischen Timer. Die bestehenden IPC-, Nachrichten-, Speicher- und Neustartgrenzen bleiben bestehen. Abschalten beendet den gewählten Worker; wie viel RAM dadurch frei wird, hängt vom tatsächlich geladenen Modul ab und wurde in diesen Funktionstests nicht als RSS/PSS gemessen.

Die Ausfallprüfung umfasst Stop/Start/Neustart mit echten Devices- und OCPP-Unterprozessen: neue PID und Generation ausschließlich beim gewählten Modul, unveränderte OCPP-Verbindung während Devices-Aktionen, verworfene alte OCPP-Befehle, erhaltene Abschaltung nach neuem Host und neuer Steuerungsinstanz sowie verweigerter Start bei deaktivierter Modulkonfiguration. Es wurden unter Node 22.23.4 und 24.22.3 jeweils fünf Tests ohne Fehler oder übersprungene Fälle ausgeführt. Die ioBroker-Datenbank und die OCPP-Gegenstelle sind isolierte Fixtures; echte Geräte und ein vollständiger Controller-Neustart auf der Kundenanlage sind damit nicht geprüft.

Der Test verwendet für Modulaktionen einen UI-Platzhalter, dessen Stop-/Startmethoden bei Aufruf fehlschlagen. Er belegt damit, dass diese Aktionen die UI-Steuerung nicht aufrufen; den echten UI-Prozess prüft die separate UI-Testreihe. Er ist weder ein Dauertest noch eine Aussage zur physischen Abschaltwirkung oder eine pauschale Zuverlässigkeitsgarantie.

Bei weiteren Änderungen sind Ressourcenwirkung und Ausfallverhalten erneut anhand des betroffenen Pfades zu prüfen. Messungen, Codeprüfung und Simulationsergebnisse sind dabei getrennt auszuweisen; RAM-Einsparungen dürfen nicht aus einer bloßen Prozessanzahl abgeleitet werden. Die Nachweise für diesen Stand stehen unter `docs/reports/unified-9.0.25/raw/runtime-processes/README.md`; der unabhängige Migrationsreview unter `docs/reports/unified-9.0.25/MIGRATION_INDEPENDENT_REVIEW.md`.
