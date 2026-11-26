# NexoWatt EOS 9.0.33 auf der Pilotanlage

Die Lieferung enthält den vollständigen Stand des Adapters `iobroker.eos-admin`. Verwende dieselbe bestehende ioBroker-Instanz. Gerätemappings, ausgefüllte Tarifprofile und bewusst pausierte Module gehören zur vorhandenen Anlage.

## Git, npm und ioBroker

1. Vor dem Update eine aktuelle Sicherung der Anlage einschließlich der Instanzkonfiguration und des zugehörigen Wiederherstellungsschlüssels bereithalten. Bei älteren Installationen mit Impulsansteuerung die tatsächliche Stellung der Start-/Stoppkontakte feststellen.
2. Die ZIP entpacken und den **Inhalt des Unterordners `iobroker.eos-admin`** in den vorhandenen Git-Checkout übernehmen. Die Änderungsliste in Git kontrollieren. Die Liefernachweise liegen im benachbarten Ordner `docs/Liefernachweise`.
3. Für die Veröffentlichung das geprüfte npm-Archiv verwenden oder im übernommenen Git-Checkout den bestehenden npm-Ablauf ausführen. Der Testkanal des Pakets ist `next`. Das ioBroker-Repository kann anschließend auf die exakte Version zeigen.
4. **Erst nach der Veröffentlichung auf npm** im Adapterordner `node tools/nexowatt-patch-repo.cjs "/Pfad/zu/repo-nexowatt.json"` ausführen. Das Werkzeug liest die öffentliche Version und prüft das vollständige Archiv gegen die auf npm hinterlegte SHA-512-Prüfsumme. Erst nach erfolgreichem Lauf die aktualisierte Repository-Datei hochladen. Der mitgelieferte Eintrag `nexowatt-eos-admin-repository-entry-v9-0-33.json` ist die Offline-Vorlage.
5. Auf der Pilotanlage das Repository aktualisieren und die vorhandene Instanz auf 9.0.33 aktualisieren. In der Prozessübersicht müssen EMS, Oberfläche und die für die Anlage eingerichteten Module betriebsbereit werden. Der EOS-interne Updater benötigt seine vorhandene signierte Updatequelle. Ein npm-Archiv allein ersetzt diese Signatur nicht.

**Wiederanlauf bei einem abgebrochenen Standard-Update.** Wenn der ioBroker-Controller den Adapter schon gestoppt hat und die Installation anschließend scheitert, den Zustand von `eos-admin.0` kontrollieren. Eine zuvor laufende Instanz kann auch nach erfolgreicher Wiederholung ausgeschaltet bleiben. Nach wiederhergestellter Installation kann sie in der ioBroker-Instanzverwaltung gestartet werden. Bewusst pausierte Instanzen bleiben pausiert.

## Live-Test auf dem Raspberry Pi

| Situation | Was sich an der Anlage prüfen lässt |
|---|---|
| Gleichmäßiger Hausverbrauch | Den Zeitstempel der letzten bestätigten Gerätebeobachtung ansehen. Innerhalb der eingestellten Gültigkeit muss der Hauswert auch zwischen zwei Messungen sichtbar bleiben. Der sichtbare Monitor wechselt regulär alle zehn Sekunden. |
| PV nachts, Speicher in Ruhe | Bei gemessenen 0 W PV und 0 W Batterieleistung entspricht der Gesamtverbrauch dem Netzbezug. Bei unabhängiger AC- und DC-PV müssen beide Quellen in der Bilanz enthalten sein. |
| Reine PV-Ladung und Speicherschutz | An der Dousida PV-Laden aktivieren und die normale Abregelung bei sinkendem Überschuss beobachten. EMS-Anforderung, OCPP-Rückmeldung und gemessene Ladeleistung gemeinsam aufzeichnen. |
| Netzanschluss und Speicher | Richtung von Bezug/Einspeisung und Laden/Entladen mit dem Gerätezähler vergleichen. Bei einer tatsächlich abgelaufenen Netzmessung darf keine neue positive Ladefreigabe aus ihr entstehen. |
| Tarif und Neustart | Vor und nach einem normalen Instanzneustart Anbieter, Preis, aktuelles Zeitfenster sowie Speicher- und EV-Freigabe vergleichen. Der Tibber-Token bleibt über den vorhandenen Speicherweg hinterlegt. |
| Regelung und Bedienung | Bei stabilen Bedingungen die Oberfläche über die Prozessverwaltung neu starten. Am Zähler die fortlaufende Regelung und in EOS die unveränderte EMS-PID kontrollieren. Danach Anmeldung, Historie, Live-Seite und Stationsseite aufrufen. |
| Einzelne Aktoren | An Anlagen mit SG-Ready, Generator oder BHKW die zur tatsächlichen Verkabelung passende Kontaktfolge und Quittierung prüfen. Eine öffentliche OCPP-Verbindung erlaubt keinen Rückschluss auf die lokale Reaktion der Wallbox bei Verbindungsabbruch. |
| Speicherbedarf | Bei vergleichbaren Modulen und gleicher Anlagenlast vor und nach dem Update messen. Auf dem Pi die Prozessgruppe aus ioBroker-Adapter, GUI, EMS, Geräte-, EEBUS-, OCPP- und Sicherungsprozessen berücksichtigen. |

Für die Auswertung einer Meldung zum Gebäude den Zeitpunkt, die zugeordneten Messpunkte, Einheiten und die zugehörigen Originalwerte mit `ts`, `q` und – wo verfügbar – `ack` festhalten. Der Wert `lc` beschreibt nur die letzte Wertänderung und kann auch bei einer regelmäßig bestätigten, konstanten Leistung weit zurückliegen.

Die Richtung der tatsächlichen Batterieleistung mit der Geräteanzeige vergleichen. Ein Beispiel für die Abnahme sind 1,2 kW PV, 0,5 kW Einspeisung, 1,8 kW Entladung und eine ruhende Wallbox. In diesem Zustand muss die Bilanz ungefähr 2,5 kW für das Gebäude ergeben. Bei einer Bestandsanlage die Invertierung erst nach Vergleich mit dem Gerät ändern.

Bei Rückfall auf einen früheren geprüften Lieferstand die zugehörige Konfigurationssicherung verwenden und die Ausgänge kontrollieren. Eine nach 9.0.33 noch ausstehende Impulsrücknahme vor einem Downgrade abschließen. [Prüfergebnisse und Grenzen](../reports/unified-9.0.33/PRUEFBERICHT.md)
