# EOS 9.0.38 · Bestandsübernahme mit InfluxDB

## Von 9.0.36 auf 9.0.38 wechseln

In 9.0.36 konnte `EOS_MIGRATION_SOURCE_VERSION` bereits durch Devices 0.5.172 ausgelöst werden. Für Devices stand nur 0.5.176 in der Freigabeliste. Das Deaktivieren in ioBroker änderte die Versionsprüfung nicht. In 9.0.38 prüft EOS bei den beiden NexoWatt-Quelladaptern die vorhandenen Einstellungen und Geräteprofile. Das funktioniert auch mit einer bereits gestoppten Quellinstanz.

1. Die vorhandene Anlagenkonfiguration sichern und die Wiederherstellbarkeit der InfluxDB-Sicherung prüfen. Einen bekannten Datenpunkt mit einem Messwert oder Verlauf vor der Umstellung für den Vergleich festhalten.
2. Die alten Instanzen von `nexowatt-ui` und `nexowatt-devices` in ioBroker installiert lassen. Bereits deaktivierte Altinstanzen können deaktiviert bleiben. Die für die Althistorie eingerichtete InfluxDB und ihren ioBroker-Adapter für die Abnahme verfügbar halten.
3. Die vorhandene `eos-admin`-Instanz direkt auf **9.0.38** aktualisieren. Im **EOS Admin → Bestandsübernahme** den Stand lesen. Bei **Übernahme abgeschlossen** mit der Geräte- und Historienprüfung fortfahren.
4. Steht ein neuer Versuch zur Verfügung, **Übernahme prüfen und starten** wählen. Soll der integrierte Gerätebetrieb nach Übernahme einer ausgeschalteten Geräteinstanz sofort anlaufen, vorher **Integriertes Gerätemodul nach der Übernahme freigeben** auswählen. **Status aktualisieren** liest den aktuellen Zustand. Die Altinstanzen bleiben im ioBroker vorhanden.
5. Nach einer automatischen Übernahme kann der interne Gerätebetrieb weiterhin pausiert sein. Über den Link zur Prozessverwaltung oder unter **EOS Admin → Prozessdiagnose → Geräte → Aktivieren** einschalten, wenn er an dieser Anlage laufen soll. Anschließend einen frischen Istwert unter seiner bisherigen Geräte-ID und die Anzeige im Dashboard prüfen. Die alten Einzelinstanzen bleiben ausgeschaltet.

## Verlauf prüfen

Unter **Historie** denselben Datenpunkt und denselben Zeitraum **vor** der Übergabe aufrufen. Dann einen Zeitraum über die Übergabe hinweg auswählen und nach einem regulären Aufzeichnungsintervall prüfen, ob neue Werte hinzukommen. Das gespeicherte Intervall und die Änderungsaufzeichnung der Anlage bestimmen, wann neue Werte erscheinen.

Die ältere UI 1.0.35 fragt ihren eingerichteten Historienadapter ab. Für diese Bestandsanlage verwendet EOS weiterhin diese Instanz sowie die bisherigen Datenpunktnamen unter `nexowatt-ui.N` und `nexowatt-devices.N`. Auch die ioBroker-Aufzeichnung je Datenpunkt bleibt erhalten. Dadurch greift die neue UI auf vorhandene Zeitreihen im bisherigen InfluxDB-Bucket zu. Die Übergabe schreibt den Bestand nicht in einen neuen Bucket um. Ein leerer oder bereits gelöschter Bucket lässt sich nur aus einer vorhandenen Datensicherung wiederherstellen.

Wenn Daten fehlen, zuerst die Erreichbarkeit der bisherigen InfluxDB-Instanz, den exakten Datenpunkt oder Alias und den Zeitraum prüfen. Eine bestehende Quellinstanz zu löschen würde die Abnahme erschweren. Bei einem belegten Ziel, einer mehrdeutigen Zuordnung oder einem unbekannten Geräteprofil den unter **Erfasste Instanzen** gemeldeten Grund prüfen. Wiederholtes Klicken ändert diese Voraussetzungen nicht.

[Prüfbericht](../reports/unified-9.0.38/PRUEFBERICHT.md) · [Dashboard, EMS und Speicherwarnungen](START_HIER_9.0.37.md)
