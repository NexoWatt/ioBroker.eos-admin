# NexoWatt EOS 9.0.4 – Update bei Socket-Startabbruch

Dominique, dieses Paket ist für die bestehende Instanz **`eos-admin.0`** bestimmt.
Die gültige zentrale Lizenz, die System-UUID und die öffentlichen Prüfschlüssel
werden weiterverwendet. Eine ioBroker-Neuinstallation oder erneute Lizenzaktivierung
ist für diese Korrektur nicht erforderlich. NexoWatt-Anteile bleiben proprietär.

## 1. Bestehenden Stand sichern und aktualisieren

Wenn die Instanz fortlaufend mit Exitcode 6 neu startet, die betroffene EOS-Instanz
über den vorhandenen ioBroker-Admin kontrolliert deaktivieren. Der gemeinsame
Adapter enthält auch die EMS-Regelung; während der Wartung ist sie nicht verfügbar.
Die für die Anlage vorgesehenen unabhängigen Schutzfunktionen müssen wirksam sein.

Vor dem Update die vollständige ioBroker-Konfiguration und das EOS-Datenverzeichnis
sichern. Zu einer wiederherstellbaren Lizenz gehören **`storage.key` und
`license.enc` gemeinsam**, importierte öffentliche Prüfschlüssel sowie ein
vorhandener OS-Truststore. Diese Sicherung geschützt außerhalb des Geräts ablegen.
Lizenzdateien, Truststore oder die Instanz nicht als Reparaturmaßnahme löschen.

Das bereitgestellte **`iobroker.eos-admin-9.0.4.tgz`** über den vorgesehenen
ioBroker-Installationsweg übernehmen und die vorhandene Instanz aktualisieren.
Danach die zuvor deaktivierte EOS-Instanz wieder aktivieren. Keine zweite
EOS-Instanz und keine alte `nexowatt-ui`-Regelung parallel starten.

Für einen Git-Upload gehören die Dateien aus dem ZIP-Verzeichnis
`iobroker.eos-admin` direkt ins Hauptverzeichnis des vorgesehenen Repositorys
[NexoWatt/ioBroker.eos-admin](https://github.com/NexoWatt/ioBroker.eos-admin),
mit `package.json` auf dieser Ebene. Eine Installation aus Git setzt voraus, dass
**genau dieser 9.0.4-Stand** dort tatsächlich hochgeladen wurde. Dieses Paket wurde
nicht automatisch nach Git oder npm veröffentlicht.

## 2. Start und Zugang prüfen

Der vorhandene ioBroker-Admin bleibt auf seinem bisherigen Port, hier **8081**.
EOS verwendet im Standardprofil **HTTPS auf 8188**:

**`https://192.168.10.153:8188/`**

Nach dem Start muss die Meldung **`EOS_HTTPS_READY`** erscheinen. Beim Standardprofil:

```text
EOS_HTTPS_READY: https server listening on 0.0.0.0:8188; login and system console available
```

`0.0.0.0` ist die Bindadresse, keine Browseradresse. Zertifikat und Vertrauenskette
müssen weiterhin zur aufgerufenen IP beziehungsweise zum Gerätenamen passen.

Anmeldung, Dashboard/Systemverwaltung und aktuelle Livewerte prüfen. Nach
mindestens **zwei Minuten** erneut prüfen und anschließend einen regulären
Adapterneustart durchführen. Der Prozess darf sich dabei nicht mit
`Cannot convert undefined or null to object`, `unhandled promise rejection` oder
`UNCAUGHT_EXCEPTION` beenden. Auch nach Schließen und erneutem Öffnen des Browsers
müssen benötigte Messwerte weiter aktualisiert werden.

## 3. Was diese Version korrigiert

Der Startfehler in 9.0.3 war ein weiterer, vom History-Problem unabhängiger Befund:
Die Socket-Verwaltung erhielt bereits beim EMS-Start viele State-Ereignisse.
Ihre Ereignisbegrenzung konnte auf eine noch nicht vorhandene Browser-
Abonnementliste zugreifen und dadurch den gesamten Adapter beenden.
`EOS_UI_STOPPING` erschien anschließend als Folge des eingeleiteten Stopps.

9.0.4 behandelt den leeren Abonnementbestand und trennt die Zuständigkeit für
Browser-Abonnements von den benötigten Abonnements der gemeinsamen EMS-Laufzeit.
Die Ereignisbegrenzung bleibt erhalten. Die Korrekturen aus 9.0.3 zu HTTPS-Start,
History-Deadlines und MultiUse-Objektanlage sind weiterhin enthalten.

`LICENSE_VALID` bestätigt die Lizenz; `EOS_HTTPS_READY` bestätigt den Webstart.
Beide Meldungen ersetzen keine Prüfung des vollständigen Anlagenbetriebs.
**NVP `stale`/`split-stale` bleibt eine eigenständige Messdaten-/Schutzdiagnose.**
Die konkrete Zählerzuordnung und Aktualität sind separat zu prüfen; fehlende
Messungen werden nicht durch Abschalten der Warnung behoben.

## 4. Nachweise und Rückfall

Aktuelle Testergebnisse und Grenzen:
[Prüfbericht 9.0.4](../reports/unified-9.0.4/PRUEFBERICHT.md).
Der Prüfbericht 9.0.3 bleibt ein historischer Nachweis seines damaligen Prüfumfangs;
er hatte den jetzt gemeldeten Socket-Lastfall nicht abgedeckt.

Bei weiterem Abbruch den bereinigten Startlog mit Versionsmeldung und erstem
Fehler sichern. Eine Sicherungswiederherstellung nur über den vorgesehenen
Recovery-Weg und mit kompatiblem Paket-/Konfigurationsstand durchführen. **9.0.3
ist wegen dieses bekannten Fehlers kein pauschal geeigneter Rückfallstand.**
Die Regeln zur einzigen aktiven Regelungsinstanz bleiben verbindlich.

9.0.4 wird als technischer Teststand für `next` bereitgestellt. Die Zielgeräte-
und Anlagenabnahme bleibt erforderlich; die Bereitstellung erklärt keine
allgemeine Produktions- oder CRA-Freigabe. Details:
[Installation](../unified/INSTALL_PUBLISH.md),
[Prüfplan](../unified/COMMISSIONING.md).
