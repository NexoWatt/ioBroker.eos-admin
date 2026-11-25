# Integrierte Modullaufzeiten ab EOS 9.0.23

Devices, EEBUS und Backup laufen im Produktionspfad jeweils in einem eigenen Node.js-OS-Prozess. Der zentrale EOS-Adapter bleibt Eigentümer der ioBroker-Verbindung, Konfiguration, Lizenzentscheidung, Namensräume und Migration. Für gezielte Bestandstests bleibt die ausdrücklich injizierte Factory verfügbar; sie wird im Produktionspfad nicht verwendet.

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
