# NexoWatt EOS 9.0.9 – SmartHome-Bedienkacheln

Diese Version aktualisiert die vorhandene EOS-Instanz. Die Bedienmuster des
bereitgestellten ioBroker.devices 4.4.0 dienen als Referenz; die Oberflächen
werden im NexoWatt-Look umgesetzt. Ein zusätzlicher devices-Adapter ist dafür
nicht erforderlich.

## Was sich ändert

- Einheitliche Karten mit gut lesbaren Namen, Gerätezustand und Typ.
- Schalter mit beschrifteter Ein-/Aus-Bedienung; Szenen mit eigenem Auslöser.
- Helligkeit direkt in Dimmer- und Farblicht-Kacheln regeln; weitere Kanäle bleiben
  im Detaildialog erreichbar.
- Jalousien mit Position und Auf/Stopp/Ab; bestehende Sperren und Mappings gelten weiter.
- Raumtemperatur mit Ist-/Sollwert, Sensoren mit Wert/Einheit und Qualität,
  Mediengeräte mit Titelinformationen; Kamera- und Widget-Kacheln bleiben erhalten.
- Sichtbares Druckfeedback, Tastaturfokus und getrennte Anzeige für Senden,
  angenommene Anfrage, Fehler oder Zeitüberschreitung.
- Unterstützt der Browser Vibration, wird ein kurzer optionaler Impuls ausgelöst.
  Die Bedienung funktioniert auch ohne Vibrationsunterstützung.

„An EOS übergeben“ bestätigt die erfolgreiche API-Antwort, keine physische
Geräteausführung. Der tatsächliche Zustand stammt weiterhin aus den bestehenden
Datenpunkten. Nach einem Timeout kann ein Befehl bereits angekommen sein;
EOS wiederholt ihn nicht automatisch.

Touch-Regler übernehmen erst beim bewussten Loslassen. Vertikales Scrollen,
Abbruch, Mehrfachberührung und Fokusverlust lösen keinen Reglerbefehl aus.
Maus und Tastatur bleiben bedienbar. Das konkrete Verhalten auf deinen Smartphones,
Tablets und Touchpanels muss noch am Zielgerät abgenommen werden.

## Bestehende Anlage aktualisieren

1. Bestehende Installation und Instanzdaten sichern; 9.0.8 als Rückfallstand behalten.
2. Das Paket als Update derselben Instanz `eos-admin.0` installieren.
   Für Git den Inhalt des ZIP-Ordners `iobroker.eos-admin` in die Repositorywurzel
   übernehmen; die Laufzeitdateien sind enthalten. Dieser Download veröffentlicht nichts.
3. Version 9.0.9 und EOS-Bereitschaft im Protokoll kontrollieren.
4. SmartHome neu laden. Falls noch alte Elemente erscheinen, einmal vollständig
   neu laden (am Desktop Strg+F5); die neuen Bedienressourcen besitzen eigene Versions-URLs.
5. Vorhandene Schalter, Dimmer, Farbe, Jalousie samt Stopp, Heizung, Szenen,
   Sensoren, Medien, Kamera und Widgets mit deinen Zuordnungen prüfen.

Die Zuordnungen, Räume, Favoriten, Zeitpläne, Berechtigungen und zentrale Lizenz
werden durch diese Oberflächenänderung nicht migriert oder neu angelegt. Eine
Neuinstallation oder erneute Lizenzaktivierung ist hierfür nicht vorgesehen.
Die früher dokumentierten Grenzen der Übernahme alter Einzeladapter gelten weiter;
dieses UI-Update ist keine zusätzliche pauschale Migrationsfreigabe.

Der Zugang bleibt `https://192.168.10.153:8188/`; ioBroker Admin bleibt auf 8081.
SmartHome aktivieren: **Installer → SmartHome Config**. Das Anlegen einer
Gebäudestruktur ersetzt die separate Aktivierung nicht.
Node-Bereiche unverändert: `>=22.23.4 <23` oder `>=24.22.1 <25`.

## Prüfstand und Rückfall

Automatisierte Tests und tatsächlich ausgeführte Prüfungen stehen im
[Prüfbericht](../reports/unified-9.0.9/PRUEFBERICHT.md). Browser-/Touch- und
Hardwareabnahme sind offen; aus Simulationen folgt keine allgemeine Serienfreigabe.
Für einen Rückfall das vorherige 9.0.8-Paket in derselben Instanz wiederherstellen.
Falls zwischenzeitlich Einstellungen geändert wurden, die passende Sicherung
bewusst auswählen, statt neue Einstellungen ungeprüft zu überschreiben.

NexoWatt-Anteile bleiben proprietär; mitgelieferte Drittanbieter-Lizenzhinweise
bleiben bestehen. Der mitgelieferte Referenzhinweis macht EOS nicht frei lizenziert.
