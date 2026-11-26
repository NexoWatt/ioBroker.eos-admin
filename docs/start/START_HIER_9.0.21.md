# NexoWatt EOS 9.0.21 – Stabilität und Kundenupdates

Dieser Lieferstand verbessert MQTT-Verbindungen, EMS-Messwertverarbeitung und das Speichern von Einstellungen. Außerdem können angemeldete Kunden unter **Einstellungen → EOS-Updates** eine freigegebene neue EOS-Version prüfen und ausdrücklich installieren. Tatsächliche Prüfergebnisse und verbleibende Grenzen stehen im [Prüfbericht](../reports/unified-9.0.21/PRUEFBERICHT.md). Die Versionsnummer allein ist keine Anlagen- oder CRA-Freigabe.

## Bestehende Installation aktualisieren

1. Gerätekonfiguration und EMS-Einstellungen exportieren; eine aktuelle ioBroker-Sicherung bereithalten.
2. Die bestehende EOS-Instanz aktualisieren. Sie nicht löschen, Geräte nicht erneut anlegen und eine abgeschlossene Bestandsübernahme nicht nochmals importieren.
3. Nach dem Neustart Geräte, Alias-V1-Zuordnungen, Leistungsgrenzen, Farm, Kundentarif und Historie mit dem bisherigen Stand vergleichen.
4. Aktuelle Messwerte und echte Gerätequittierungen prüfen. „Verbunden“ und ein passender `ack:false`-Sollwert allein bestätigen keine Geräteübernahme.

Standard-Admin und Backitup bleiben eigenständige Adapter. EOS ändert für diese Aktualisierung keine globalen Benutzergruppen, Dateirechte oder fremden Adaptereinstellungen. Die bestehende zentrale Lizenz und die vorhandenen ioBroker-Benutzer werden weiterverwendet.

## Neue Version direkt in EOS installieren

Die Updateanzeige verwendet den stabilen npm-Kanal **latest** des Pakets `iobroker.eos-admin`. Versionen, die ausschließlich unter **next** veröffentlicht sind, werden Kunden nicht als stabile Updates angeboten. Die Prüfung erfolgt bei Nutzung der Oberfläche mit begrenztem Cache; ohne Internet bleibt der lokale Anlagenbetrieb unabhängig davon verfügbar.

1. **Einstellungen → EOS-Updates** öffnen. Installierte Version, angebotene Version und letzter Prüfzeitpunkt werden angezeigt.
2. Neue Version prüfen und vorbereiten. EOS prüft Paketidentität, Node-Kompatibilität, Registry-Signatur und Paketinhalt und sichert die relevante EOS-Konfiguration verschlüsselt.
3. Den Installationsdialog lesen und **Jetzt installieren** ausdrücklich bestätigen. Auch ein angemeldeter Kunde darf diese eng begrenzte EOS-Aktion ausführen. Dadurch entstehen keine allgemeinen ioBroker-Administrator- oder Befehlsrechte.
4. Während Installation und Neustart sind EOS-Oberfläche und EMS-Regelung zeitweise nicht verfügbar. Einen geeigneten Wartungszeitpunkt wählen. Der Vorgang aktualisiert ausschließlich EOS.
5. Nach der Rückkehr zur Oberfläche Version und Status prüfen. Erst die bestätigte neue Version mit erhaltenen bisherigen Konfigurationswerten gilt als abgeschlossen. Bei fehlender Antwort keinen zweiten Updateauftrag starten; Status nach Wiederanmeldung prüfen.

Der erste integrierte Installationsweg ist auf **Linux, einen nicht privilegierten ioBroker-Prozess, js-controller 7.2.5 und genau eine EOS-Instanz auf dem Host** begrenzt. Andere Umgebungen werden mit einem konkreten Hinweis gesperrt; sie benötigen die reguläre ioBroker-Adapteraktualisierung. Metadaten, Signaturschlüssel und Paketabruf haben zusammen ein begrenztes externes Zeitbudget von fünf Sekunden. Reicht die Internetverbindung dafür nicht aus, bricht die Vorbereitung mit einem Fehler ab; die laufende Installation bleibt erhalten und die reguläre ioBroker-Aktualisierung bleibt verfügbar. Ein vorbereitetes Angebot gilt zehn Minuten. Ändert sich zwischen Vorbereitung und Start die Konfiguration, muss neu vorbereitet werden. Ein ausstehender Konfigurationsspeichervorgang oder eine laufende Bestandsübernahme verhindert den Start.

Die verschlüsselte EOS-Konfigurationssicherung ist keine vollständige ioBroker-, InfluxDB- oder Datenträgersicherung. Für ihre Entschlüsselung wird das vorhandene ioBroker-Systemgeheimnis benötigt. Nach einer unklaren oder abgebrochenen Installation wird kein Update automatisch wiederholt und kein ungeprüfter Softwarestand automatisch gestartet. Ein unmittelbar vor der Installation gestoppter, unveränderter alter Stand kann kontrolliert wieder gestartet werden; nach einem begonnenen Installationsversuch ist eine unbestätigte Rückkehr ausdrücklich kein Erfolg.

Die geprüfte npm-Registry-Signatur und der Paket-Hash schützen den konkreten Bezugsweg. Sie ersetzen keine unabhängige NexoWatt-Herstellersignatur und keine formale Produktfreigabe. Automatische unbeaufsichtigte Installationen sind nicht Bestandteil dieses Ablaufs.

## Anlagenprüfung nach dem Update

- SMA/M0/NVP: aktuelle Gesamt- und Phasenwerte, richtiges Vorzeichen und richtige Einheit; Ausfall und Wiederkehr müssen einen eindeutigen Frischestatus liefern.
- FENECON und SolaX: 2/2 aktuelle Farm-Mitglieder, Kapazitäten, Summen und Durchschnitts-SoC. Bei 1 % / 98 % SoC und 10 % Mindest-SoC darf der leere Speicher den zweiten Speicher nicht pauschal sperren. Sollwert, Treiberquittierung, Geräte-Readback und gemessene Leistung getrennt prüfen.
- MQTT: Verbindungsabbruch und Wiederkehr dürfen keine alten Leistungsbefehle erneut ausführen. Alte Rückrufe dürfen den neuen Offline-/Online-Status nicht überschreiben.
- Geräte speichern: Ein bereits veraltetes zweites Browserformular muss zum Neuladen auffordern und darf neuere Einstellungen nicht überschreiben. Bei Fehlern bleiben Eingaben zur Prüfung erhalten.
- Tibber: aktuelle Viertelstundenpreise, richtige Einheit sowie Null- und Negativpreise prüfen. Ein Ausfall der Preisquelle darf den EMS-Takt nicht aufhalten.
- Historie: Lesen und tatsächliches Schreiben prüfen; eine erreichbare Datenbank allein bestätigt keine Tokenrechte. Die vorhandene InfluxDB-Direktanbindung und deren begrenzte Warteschlange bleiben bestehen.
- Standard-Admin und Backitup separat öffnen; EOS-Regelung auch ohne geöffnete Browserfenster prüfen.

Weitere Einrichtungshinweise zu Alias-Zuordnung, direktem InfluxDB 2, iPhone-Symbol und Zertifikaten bleiben in [9.0.20](START_HIER_9.0.20.md) beschrieben. Öffentliche Zertifikate ohne Domain-/Vertrauenskonzept sind weiterhin nicht automatisch verfügbar. Weitere Tarifanbieter sind wie vereinbart aufgeschoben.

## npm weiterhin aus der Repository-ZIP

Die ZIP enthält vorbereitete Builds. In PowerShell den entpackten Ordner mit `package.json` öffnen:

```powershell
node -p "require('./package.json').version"
npm publish
```

Die Versionsausgabe muss **9.0.21** lauten. Die vorhandenen Publish-Prüfungen bleiben aktiv. Bekannte alte Builddateien eines überkopierten Lieferstands werden gesichert bereinigt; unbekannte eigene Änderungen werden nicht gelöscht. `--ignore-scripts` oder ein manuelles Überschreiben des Inhaltssiegels sind keine Reparatur.

Dieser Lieferstand ist standardmäßig für **next** vorgesehen. Erst nach Herstellerfreigabe kann die dafür geprüfte Version dem npm-Kanal `latest` zugeordnet werden. Der Kundenupdater überspringt keine Hauptversion und installiert keine beliebigen Git-URLs. In dieser Bearbeitung wurde nichts auf npm veröffentlicht und keine Kundenanlage aktualisiert.
