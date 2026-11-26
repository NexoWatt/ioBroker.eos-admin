# NexoWatt EOS 9.0.24

Stand: 25.11.2026. OCPP ist jetzt in denselben EOS-Adapter integriert wie Devices, EEBUS, UI/EMS und Backup. Der technische Paketname bleibt `iobroker.eos-admin`. Die bisherigen Korrekturen an Energiefluss, dynamischem Tarif, reinem PV-Laden und OCPP-Rückmeldungen bleiben enthalten.

## Ein Adapter mit getrennten Prozessen

| Bestandteil | Betrieb in 9.0.24 |
| --- | --- |
| Admin, HTTPS, Anmeldung und zentrale Berechtigungen | ioBroker-Hauptprozess |
| Bisherige EOS-Oberfläche und EMS | Eigener beaufsichtigter Betriebssystemprozess |
| Devices | Eigener beaufsichtigter Betriebssystemprozess |
| EEBUS | Eigener beaufsichtigter Betriebssystemprozess |
| OCPP 0.4.4, Basis 0.4.3 | Eigener beaufsichtigter Betriebssystemprozess innerhalb desselben EOS-Adapters |
| Backup | Eigener beaufsichtigter Betriebssystemprozess; vorhandene Jobprozesse bleiben separat |

Der Zielbetrieb braucht keinen zusätzlichen `ocpp21`-Adapter. UI und EMS teilen weiterhin ihren eigenen Kindprozess; einzelne Geräte erhalten keinen eigenen Prozess. Ein UI-/EMS-Neustart beendet nicht gleichzeitig die OCPP-Verbindung. Jeder Prozess hat einen eigenen Heap und Event-Loop, teilt aber Betriebssystem, Dienstkonto, Controller und Hardware. RAM und Reaktionszeiten müssen auf dem vorgesehenen Pi beziehungsweise IPC gemessen werden.

Unter `/runtime/` sind Prozesszustand, PID, Neustarts und Bereitschaft sichtbar. Eine laufende PID allein beweist weder eine frische Messung noch die elektrische Umsetzung eines Sollwerts.

## OCPP einrichten und vorhandene Stationen erhalten

OCPP wird im geschützten Bereich `/modules/ocpp/` eingerichtet. Der **WebSocket-Port ist ein frei editierbares Zahlenfeld (1024–65535)**, vorbelegt mit **9220**. Speichern übernimmt den gewählten Port; ein belegter Port führt zum sichtbaren Startfehler und nicht zu einem stillen Ersatzport. Neue Anlagen verwenden den Namespace `eos-admin.N.ocpp`. Die lokale WebSocket-Adresse, der konfigurierte Port, die eindeutige Stationskennung und die aktivierten OCPP-Versionen müssen zur Ladestation passen. Das integrierte Modul erhält die Transportfunktionen der bisherigen OCPP-Basis; daraus folgt keine neue TLS- oder Passwortfähigkeit des OCPP-Protokolls.

Bei vorhandener `ocpp21.N`-Instanz bleiben deren Datenpunktnamen und bestehende Zuordnungen durch die kontrollierte Übernahme erhalten. Zwei Listener beziehungsweise Schreiber dürfen nicht gleichzeitig dieselbe Anlage übernehmen.

1. Konfiguration und Daten sichern; alten OCPP-Port und Stationskennungen notieren.
2. Vor einem manuellen Import die bisherige `ocpp21.N`-Instanz deaktivieren und vollständig stoppen. EOS verlangt eine bestätigte Stoppmeldung und einen aktuellen Hostzustand.
3. Die gestoppte Instanz im OCPP-Bereich übernehmen. Einstellungen werden verschlüsselt gespeichert und zurückgelesen; die bestehenden IDs bleiben erhalten. Das neue Modul bleibt zunächst deaktiviert.
4. Port, Stationen, vorhandene Zuordnungen und elektrische Grenzen prüfen; anschließend das integrierte Modul ausdrücklich aktivieren.
5. Die automatisch erkannte Ladepunktzeile im App-Center prüfen. Neue Zeilen sind bereits verknüpft, bleiben aber bis zur Prüfung deaktiviert. Erst nach Kontrolle von Phasen, Mindest-/Höchststrom und Leistungsgrenzen die EMS-Regelung aktivieren.

Bei einer noch nicht abgeschlossenen Gesamtübernahme kann der vorhandene Migrationskoordinator OCPP mit Journal, bestätigtem Altprozess-Stopp und Rückfallprüfung übernehmen. Ein bereits abgeschlossener 9.0.23-Übernahmevorgang wird durch 9.0.24 nicht still erneut ausgeführt; dort gilt der manuelle Ablauf. Der allgemeine Migrationsbutton im Dashboard entfällt. Technische Übernahmefunktionen bleiben dem geschützten Einrichtungsbereich vorbehalten.

Der bisherige Stationsvertrag stellt eine stationsweite Regelgröße bereit. Mehrere Anschlüsse sind keine Zusage unabhängiger Stellkanäle. Manuelle Einstellungen und reine Messzuordnungen werden nicht ungefragt in aktive Hardware-Schreibpfade umgewandelt.

## Kiosk, Administration und Stationsanzeigen

Unter **Einstellungen → Allgemein → Kioskmodus für Wandtablets** kann ein angemeldeter Administrator den Modus aktivieren. Die Aktivierung beendet bestehende Administratorsitzungen und öffnet das Dashboard. Zum Deaktivieren auf **Admin öffnen** klicken, Benutzername und Passwort eingeben und denselben Schalter in den Einstellungen ausschalten.

Ein ausdrücklich aktivierter Kiosk zeigt das Kundendashboard ohne automatische Abmeldung durch Sitzungsablauf oder Inaktivität. Er ist für dauerhaft geöffnete Anzeigen gedacht. Administration und geschützte Einstellungen verlangen eine frische Anmeldung mit Administrator-Benutzername und Passwort; Kiosk-Zugriff bedeutet keine Administrationsberechtigung.

Stations-Anzeigeseiten bleiben über ihren bestehenden separaten Display-Link ohne Login- oder Inaktivitätssperre nutzbar. Das ist ein eigener Anzeigezugang und keine OCPP-Protokollauthentifizierung. Er schaltet keine technischen Einstellungen oder Administration frei.

## Prüfung an der Anlage

Bei der Dousida Energyline sind mindestens positiver Sollwert, reines PV-Laden bei zu geringem Überschuss, 0-W-Anforderung, tatsächliche Ladepause und Wiederaufnahme ohne Aus-/Einstecken zu prüfen. Außerdem Verbindungsabbruch, Wiederverbindung, EMS-Prozessneustart und OCPP-Prozessneustart testen. Lokaler Datenpunkt-Schreiberfolg, Annahme eines Ladeprofils und gemessene Ladeleistung sind unterschiedliche Rückmeldungen.

Der OCPP-Prozess überwacht die bisherige zeitlich begrenzte EMS-Freigabe. Bei deren Ablauf fordert er den vorgesehenen Stopp an und übernimmt keinen alten positiven Sollwert allein aufgrund einer späteren Verlängerung. Eine Protokollanforderung ersetzt jedoch keine physische Rückmeldung. Geräteeigene Schutzfunktionen, korrekte Anlagenlimits und das Ausfallverhalten der Wallbox müssen wirksam bleiben.

Energiefluss und Tarifstatus mit gleichzeitig erfassten Quellwerten vergleichen. Ungültige oder veraltete Werte dürfen nicht als aktuelle Nullmessung erscheinen. Langzeitbetrieb, RAM und CPU unter tatsächlicher Gerätezahl gehören zur Anlagenabnahme.

## npm unter Windows / PowerShell

Das vollständige neue ZIP in ein frisches Verzeichnis entpacken und in den enthaltenen Repositoryordner mit der `package.json` wechseln. Die separat gelieferten alten 9.0.23-Anleitungen bleiben historische Unterlagen; für 9.0.24 wird kein zweiter OCPP-Adapter veröffentlicht.

```powershell
Set-Location "C:\NexoWatt\EOS-9.0.24\iobroker.eos-admin"
node --version
npm publish --tag next
```

Den Beispielpfad an den tatsächlichen Entpackordner anpassen. Erforderlich ist eine unterstützte EOS-Node-Linie (`>=22.23.4 <23` oder `>=24.22.1 <25`) sowie die Veröffentlichungsberechtigung im eigenen npm-Konto. `next` ist der vorgesehene Testkanal. Diese Anleitung führt keine Veröffentlichung aus; das npm-Konto wurde nicht benutzt.

Der gemeldete Fehler `EOS_PUBLISH_EXTRA_UNKNOWN adminWww/assets/hostInit-BNFIx0-f.js` ist durch einen belegten historischen Dateikatalog korrigiert. Auch beim Überkopieren werden bekannte unveränderte Frontend-Reste aus 9.0.21, 9.0.22 und 9.0.23 zuerst außerhalb des Repositorys gesichert und anschließend bereinigt. Veränderte oder unbekannte Dateien bleiben erhalten und blockieren die Vorbereitung. Keine aktuellen Dateien manuell löschen und keine Prüfung durch Neuversiegelung eines ungeprüften Ordners umgehen.

## Prüfstand und Grenzen

Die abschließenden Testzahlen, Builds und Artefaktprüfsummen gehören zum [Prüfbericht 9.0.24](../reports/unified-9.0.24/PRUEFBERICHT.md). Ergänzend: [OCPP-Host und Migration](../reports/unified-9.0.24/OCPP_HOST_MIGRATION.md) und [Publish-Korrektur](../reports/unified-9.0.24/PUBLISH_OVERLAY_9_0_21.md). Zwei bereits bestehende Plattform-Skips werden im Gesamtprüfstand ausdrücklich ausgewiesen und nicht als bestandene Fälle gezählt.

Automatisierte Software-, Controller-Fixture- und WebSocket-Simulationen ersetzen weder die physische Dousida-Energyline-Abnahme noch den Langzeitbetrieb. 9.0.24 bleibt ein kontrollierter Integrations-Teststand für `next`; eine pauschale 100-%-Zuverlässigkeitsgarantie oder Normzertifizierung wird daraus nicht abgeleitet.
