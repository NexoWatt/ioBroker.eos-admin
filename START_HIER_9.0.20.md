# NexoWatt EOS 9.0.20 – Update und Anlagenprüfung

Diese Version korrigiert weitere in 9.0.19 reproduzierte Fehler. Sie ersetzt die Prüfung am angeschlossenen Gerät nicht. Vollständige Abdeckung und konkrete Sollwerte: [Anforderungen und Inbetriebnahme](docs/reports/unified-9.0.20/ANFORDERUNGEN_UND_INBETRIEBNAHME.md).

## Bestehende Anlage aktualisieren

1. Aktuelle Gerätekonfiguration und EMS-Konfiguration exportieren und die vorhandene ioBroker-Sicherung bereithalten. Bestehende EOS-Instanz aktualisieren, nicht löschen und neu anlegen. Eine abgeschlossene Bestandsübernahme nicht nochmals manuell importieren.
2. Das mitgelieferte TGZ über die vorhandene ioBroker-Adapterinstallation installieren. Standard-Admin und Backitup bleiben eigenständige Adapter. Keine globalen Rechte, Cookies, Icons oder deren Ports umstellen.
3. Nach dem Neustart den Geräte-/EMS-Status abwarten. „Startet“ bedeutet noch keine erfolgreiche Kommunikation. Eine bestehende Geräteaktivierung oder Zuordnung nicht vorsorglich neu erstellen.
4. Prüfen, dass SMA, FENECON und SolaX ihre vorhandenen IDs, Adressen, Kennwörter, Zuordnungen und Grenzwerte behalten haben. Auf allen drei Geräten müssen Empfangs-/Heartbeat-Zeitpunkte und die Alias-V1-Messwertfrische weiterlaufen; ein bloßes „verbunden“ reicht dafür nicht. Unveränderte Rohwerte werden teils nur bei Wertänderung geschrieben, daher ihren Zeitstempel nicht allein als Ausfallbeleg verwenden.
5. Neue, bisher noch nicht in Betrieb genommene Geräte über „Im EMS verwenden und aktivieren“ mit passenden Grenzen übernehmen. Wiederholtes Speichern darf keine Doppelgeräte erzeugen und keine später bewusst deaktivierte App reaktivieren.

## Vor Freigabe der Regelung

- SMA am vorgesehenen M0/NVP: plausibles Vorzeichen und Einheit, aktuelle Gesamt- und Phasenwerte.
- FENECON und SolaX: beide Farm-Mitglieder, richtige Kapazitäten und Lade-/Entladegrenzen. Farm-Anzeige muss 2/2 frische Teilnehmer, Gesamtleistung und Durchschnitts-SoC zeigen. Konverterleistung und Batterieanteil bleiben getrennte Messgrößen. Bei 1 % / 98 % SoC und 10 % Mindest-SoC muss nur der zweite Speicher einen positiven Entladeauftrag erhalten, sofern die weiteren Richtungs-/Leistungsfreigaben vorliegen. Auftrag, Treiberquittierung und gemessene Entladung getrennt prüfen; ein passender `ack:false`-Sollwert bestätigt noch keine Geräteübernahme.
- Steuerung mit geschlossenen EOS-/Admin-Browserfenstern prüfen: Gerätebefehle müssen über das eigene Modul-Abonnement weiterlaufen. Eine geöffnete Objektansicht darf keine Voraussetzung für Speicherregelung sein.
- Bereits erkannte und zugeordnete dynamische Geräte-Leistungsgrenzen müssen frisch sein. Eine bestätigte Grenze von 0 W sperrt nur die entsprechende Richtung dieses Speichers. Manuell konfigurierte kleinere Grenzen bleiben wirksam. Noch nie erfolgreich gelesene optionale Register werden nicht blind gebunden.
- Wallbox: Leistungswert in W/kW, kein boolesches `transactionActive` im Leistungsfeld. Start/Stopp, Betriebsarten und Rückmeldungen am Gerät prüfen.
- Tibber: aktuelle Viertelstundenpreise und richtige Einheit. Null- und Negativpreise sind gültig; ein abgelaufener Preis darf nicht als kostenloser Strom weiterverwendet werden.
- Ausfall und Wiederkehr eines Gerätes in einem geeigneten Anlagenzustand prüfen. Fehlende Daten müssen als fehlend/veraltet erscheinen; Regelgrenzen und gerätespezifische Schutzfunktionen bleiben maßgeblich.
- Nach Speichern und Neustart Geräte, EMS-Zuordnungen, Räume und Kundeneinstellungen vergleichen.

## NexoWatt auf dem iPhone-Home-Bildschirm

Die Anmeldeseite zeigt das vorhandene NexoWatt-Symbol direkt am Anmeldeformular. Für den Home-Bildschirm ist zusätzlich das vorhandene 180-Pixel-Apple-Symbol mit einer inhaltsabhängigen Versionskennung hinterlegt. Symbol und Manifest sind bereits ohne Anmeldung abrufbar; private API-Antworten bleiben geschützt.

Nach dem Update die EOS-Anmeldeseite in Safari neu öffnen und über **Teilen → Zum Home-Bildschirm** hinzufügen. Falls bereits eine Verknüpfung mit falschem Symbol vorhanden ist, nur diese Verknüpfung entfernen und neu hinzufügen. Die EOS-Konfiguration wird dadurch nicht gelöscht. Die Anzeige auf einem echten iPhone ist noch am Zielgerät zu prüfen.

Eine Zertifikatswarnung entsteht vor dem Laden der Anmeldeseite und wird durch das Logo-Update nicht behoben. Für öffentliches Vertrauen benötigt eine lokale Anlage einen echten Domainnamen mit passendem Zertifikat und lokaler Namensauflösung. Automatische öffentliche Ausstellung und Erneuerung per DNS-01 sind in diesem Paket noch nicht integriert. Die vorhandene Verwaltung der privaten NexoWatt-Zertifikate setzt weiterhin voraus, dass deren CA auf dem Endgerät vertraut wird.

## InfluxDB 2 direkt einrichten

Die Datenbank bleibt erforderlich. EOS kann die Historienverbindung jetzt selbst übernehmen; dafür wird kein zusätzlicher ioBroker-InfluxDB-Adapter benötigt. Nach einem Update bleibt die bisherige Anbindung zunächst ausgewählt.

1. Im Installer **Historie einrichten** öffnen und **InfluxDB 2 direkt** wählen.
2. Serveradresse, Organisation und vorhandenen Bucket eintragen. Für den bestätigten lokalen InfluxDB-2.7.5-Server lautet die Adresse `http://127.0.0.1:8086`, wenn EOS und InfluxDB im selben Netzwerk-Namensraum laufen. Bei getrennten Containern oder Geräten die vom EOS-Prozess erreichbare Serveradresse verwenden.
3. Einen eigenen API-Token mit Lese- und Schreibzugriff auf diesen Bucket eintragen. Die direkte EOS-Verbindung benötigt keine Auflistung sämtlicher Organisationen oder Benutzer. Token nicht in Screenshots oder Protokolle kopieren.
4. **Verbindung prüfen** bestätigt Erreichbarkeit und Lesezugriff. Anschließend ausdrücklich **Speichern**. Unter dem Betriebsstatus den ersten tatsächlichen Schreibzugriff und danach die Historienansicht prüfen. Die regelmäßigen kanonischen EOS-Messreihen behalten ihr bisheriges Zehn-Minuten-Raster; Tarif- und Ereignisreihen behalten ihre jeweiligen Auslöser.
5. Die frühere Aufzeichnung derselben EOS-Reihen im Influx-Adapter nach erfolgreicher Übergabe beenden, damit nicht zwei Schreiber dieselben Daten aufzeichnen. Wenn der Adapter ausschließlich EOS bedient, kann er anschließend deaktiviert werden. Für andere manuell historisierte Datenpunkte seine Nutzung gesondert prüfen; EOS stoppt keinen fremden Adapter automatisch.

Die Aufbewahrungsfrist des gewählten Buckets in InfluxDB prüfen: Sie muss den benötigten Berichtszeitraum abdecken. Für die vorhandenen EOS-Nachweisreihen sind 730 Tage als Ziel hinterlegt. EOS ändert diese Bucket-Einstellung nicht; eine angezeigte Zielvorgabe bestätigt noch keine tatsächlich konfigurierte Aufbewahrungsfrist.

Die Direktanbindung schreibt die bereits vorgesehenen EOS-Export-, Tarif-, Ereignis- und Nachweisreihen. Sie übernimmt keine beliebige `common.custom`-Historisierung fremder Datenpunkte und kopiert keine alten Messreihen in einen anderen Bucket. Bereits vorhandene kompatible Reihen im gewählten Bucket können weiter gelesen werden. Ein vorhandener Bucket beweist nicht, dass zuvor gelöschte Messwerte noch darin liegen.

Der Token wird verschlüsselt gespeichert und in normalen Konfigurationsantworten ausgeblendet. Bei unverändertem Server erhält ein leeres Tokenfeld den bestehenden Wert. Gesicherte verschlüsselte Zugangsdaten benötigen beim Wiederherstellen das ursprüngliche ioBroker-Systemgeheimnis; andernfalls bleibt die übrige Konfiguration erhalten und nur für Influx muss ein neuer Token eingetragen werden. HTTPS prüft Zertifikat und Servernamen; ein eigenes öffentliches CA-Zertifikat kann hinterlegt werden. HTTP ist auf lokale Netze beschränkt und überträgt Daten unverschlüsselt.

Die Warteschlange ist begrenzt und nicht auf Datenträger dauerhaft gespeichert. Datenbankausfälle und ein erzwungener Prozessabbruch können nicht geschriebene Messpunkte verlieren; verworfene Punkte werden im Betriebsstatus gezählt. Ein normaler Stopp versucht die verbliebenen Schreibvorgänge innerhalb der begrenzten Stopfrist abzuschließen. Geräte- und EMS-Einstellungen werden dadurch nicht zurückgesetzt.

## npm wie gewohnt aus dem Repository

ZIP in einen Ordner entpacken. In PowerShell genau den Ordner öffnen, der `package.json` enthält, dann:

```powershell
node -p "require('./package.json').version"
npm publish
```

Die Ausgabe muss `9.0.20` nennen. Die vorbereiteten Frontends sind enthalten. `prepublishOnly` und `prepack` bleiben aktiv. Bekannte alte Build-Dateien eines überkopierten Lieferstands werden gesichert bereinigt; eigene unbekannte Änderungen werden nicht automatisch gelöscht. Proprietäre Lizenz und zentraler EOS-Lizenzschutz bleiben erhalten. Es wurde keine Veröffentlichung auf npm für dich ausgelöst.

## Abgrenzung

Automatische Grundzuordnung: M0/M1-Zähler, kompatible Einzel-/Farmspeicher und Ladepunkte. Spezielle PV-Abregelung, Wärme-/SG-Ready-/IO-Regelrollen benötigen weiterhin die ergänzende App-Center-Einrichtung. Weitere Tarifanbieter bleiben wie vereinbart späteren Versionen vorbehalten.

`https://nexowatt` ohne Port benötigt weiterhin passende Namensauflösung, einen HTTPS-Zugang auf Port 443 und Vertrauen in die lokale Zertifizierungsstelle auf dem Endgerät. Das Adapterupdate allein installiert kein Zertifikatsvertrauen auf Smartphones. Eine vollständige Backup-Wiederherstellung benötigt Wartungsbetrieb.
