# Geprüfte Bestandsübernahme in 9.0.36

Für den gemeldeten Wechsel von einer abgeschalteten `nexowatt-ui.0` übernimmt EOS die geprüfte Konfiguration und verwendet die bestehenden Datenpunkt-IDs weiter. Der alte Adapter bleibt auch bei einem Rückfall abgeschaltet. Die Schalter für Oberfläche und EMS im Ziel bestimmen, welche Prozesse anschließend arbeiten.

| Ausgangslage | Verhalten von 9.0.36 |
|---|---|
| Unterstützte Alt-UI ist auf dem gleichen Host bestätigt beendet, das Ziel ist frei | EOS liest ihre Einstellungen, prüft die vorhandenen zu erhaltenden Zustände vor und nach der Übergabe und speichert den übernommenen Bestand verschlüsselt. Die Ausnahmen sind Transport-, Anmelde- und Lizenzfelder des neuen Hostadapters. |
| Unterstützte UI oder Devices laufen bereits | EOS prüft die beteiligten Quellen, protokolliert ihren ursprünglichen Aktivierungszustand und wartet nach dem Abschalten auf die Bestätigung des Controllers. |
| Eine bekannte Quelle kann nicht übernommen werden | Das Quellpaket bleibt gemeinsam zurückgestellt. Die Diagnose nennt den betroffenen Bereich, die Instanz und den Fehlercode. Unbeteiligte EOS-Bereiche können bei vorhandener Lizenz und bestätigter alleiniger Zuständigkeit starten. |
| Inventur insgesamt unzuverlässig, weiterer EOS-Schreiber aktiv oder Rückfall unbestätigt | EOS sperrt die operative Geräte- und EMS-Steuerung. Freigegebene, lizenzierte Prozesse können bei lesbarer Modulkonfiguration im passiven Wartezustand laufen. Eine vorhandene PID allein bestätigt keine Betriebsbereitschaft. |
| Separates `ocpp21` läuft | Die externe Station behält ihren Eigentümer. Der interne OCPP-Prozess kann im Wartezustand laufen. Er öffnet dabei keinen Ladeport. Eine tatsächliche Übernahme erfolgt über den manuellen OCPP-Import. |

## Stoppnachweis bei einer bereits abgeschalteten Alt-UI

Normalerweise bestätigt `system.adapter.nexowatt-ui.N.alive` den Stopp nach der letzten Änderung des Instanzobjekts. Bei einem späteren Metadatenupdate kann die Bestätigung älter sein. Für einen lokalen UI-Daemon außerhalb des Kompaktmodus vergleicht EOS dann zwei vom selben ioBroker-Host stammende Zustände. Der Host muss aktuell erreichbar sein. Seine bestätigte Meldung `alive=false` muss zeitlich **nach** seinem letzten belegten Start oder seiner Stoppanforderung liegen.

Im geprüften Quellcode von `iobroker.js-controller@7.2.5` setzt der Controller `sigKill` vor dem Start zurück, meldet die positive Prozessnummer nach dem Start und schreibt bei regulärem Stopp `sigKill=-1` als unbestätigte Anforderung. Nach dem Prozessende meldet er `alive=false`. Ein fehlender, gleichzeitiger, neuerer oder unklarer Lebenszyklusbeleg reicht bei einer nachträglichen Objektänderung nicht aus. EOS liest diese Zustände. Es quittiert den eigenen Stoppnachweis nicht selbst.

Quellnachweis im npm-Paket unter `build/esm/main.js`, Funktionen `startInstance` und `stopInstance`, insbesondere Zeilen 3733, 4024, 4105 und 4277. SHA-256 des untersuchten Tarballs ist `b1500c415bda5b40369eafc78ccc6b8751bfaa91059fd9496e43e89826d6edb5`.

## Bereitschaft und Rückfall

Für einen UI-Transfer wartet EOS auf den laufenden Präsentationsprozess sowie auf Betriebsbereitschaft und Schreibfreigabe des EMS. Eine ausdrücklich gespeicherte Pause wird anhand des tatsächlich gestoppten Zielprozesses geprüft. Prozessaufbau und eine noch ausstehende erste Konfigurationsabfrage bleiben innerhalb der bestehenden Frist ausstehend. Ein übernommener aktiver Gerätetreiber muss seinen Betriebszustand bestätigen. Bei einem gescheiterten Wechsel werden vorher aktive Quellen erst nach bestätigtem Stopp der neuen Prozesse wieder freigegeben.

Die Regressionstests verwenden kontrollierte Instanzobjekte, Zustände und Prozessmeldungen. Der ergänzende Web-Starttest führt bestätigte inaktive und aktive Alt-UI mit bestehendem Devices-Adapter über den echten EOS-Listener und die getrennten Kindprozesse. Die Prüfung deckt weder reale Kundenbusse noch alle individuellen Fremdskripte und Protokollgeräte ab.
