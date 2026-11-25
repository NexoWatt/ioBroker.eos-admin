# NexoWatt EOS 9.0.25 – Gerätestart und Prozessbedienung

Dieser Stand korrigiert die in 9.0.24 gemeldete gemeinsame Startsperre durch die optionale Übernahme eines separaten OCPP-Adapters. EOS bleibt ein npm-Paket mit getrennten Modulprozessen. Die neue Prozessbedienung arbeitet ohne zusätzliche Dauerprozesse; Statusabfragen werden gebündelt und bei verborgener Seite angehalten. Eine neue Aufteilung des EMS und eine umfassende RAM-Umstrukturierung sind nicht Bestandteil dieser Korrektur. Eine RAM-Einsparung auf der Anlage ist damit noch nicht gemessen.

## Behobener Bestandsfall

Auf der gemeldeten Anlage lief EOS 9.0.21. Nach Installation von 9.0.24 blieb die Oberfläche erreichbar, während EMS, Geräte, EEBUS und Sicherung nicht starteten. Der ausgelesene Status lautete:

```json
{"phase":"BLOCKED","code":"EOS_MIGRATION_SOURCE_VERSION","sources":[{"id":"ocpp","source":"ocpp21.0","namespacePreserved":false}],"updatedAt":null}
```

Die neue automatische OCPP-Vorprüfung blockierte den gemeinsamen Start, obwohl OCPP weiterhin separat betrieben werden sollte. Diese Vorprüfung hatte den bestehenden OCPP-Adapter noch nicht gestoppt oder übernommen. Der Nutzer bestätigte nach Rückstufung auf 9.0.21, dass alle Geräte wieder funktionieren.

9.0.25 übernimmt vorhandene separate OCPP-Adapter deshalb nicht mehr ungefragt. Die bewusste Übernahme im geschützten OCPP-Bereich bleibt möglich. Bereits tatsächlich übernommene Installationen behalten ihre Journale, Namensräume und Prüfungen. Die Korrektur löscht keine Übernahmejournale und umgeht keine Lizenz- oder Eigentumsprüfung. Eine veraltete BLOCKED-Statusanzeige wird nach erfolgreicher neuer Vorprüfung aktualisiert.

## Prozesse bedienen

Die geschützte Seite `/runtime/` bietet für Geräte, EEBUS, OCPP, Sicherung sowie Oberfläche/EMS die Aktionen **Aktivieren**, **Deaktivieren** und **Neustarten**. Der gespeicherte Prozesswunsch und der tatsächlich bestätigte Zustand werden getrennt angezeigt. Ein angenommener Befehl ist noch keine erfolgreiche Bereitschaftsmeldung.

Die Prozessfreigabe bleibt über einen EOS-Neustart erhalten. Ohne eine zuvor gespeicherte Auswahl sind alle fünf Prozessfreigaben standardmäßig **An**. Eine bewusste Abschaltung bleibt nach Neustarts erhalten. Die eigentliche Modulkonfiguration bleibt zusätzlich maßgeblich: Ein noch nicht eingerichtetes oder dort deaktiviertes Modul wird durch den Prozessschalter nicht heimlich konfiguriert. Die Seite zeigt den Einrichtungsbedarf und verlinkt die passenden Einstellungen.

Ein Start bleibt gesperrt, solange die erforderliche Lizenz, Gerätezuordnung oder bestätigte Übernahme fehlt. Der Grund wird angezeigt. Ein Neustart darf einen nicht bestätigten Stopp nicht übergehen. Bestehende Geräteparameter, Datenpunkte und Leistungsgrenzen werden durch diese Bedienung nicht zurückgesetzt.

Der zentrale Administrationsprozess bleibt als Bedien- und Wiederherstellungszugang aktiv; er beendet sich nicht über seine eigene Prozessseite. Ein dort angezeigter separater `ocpp21`-Adapter wird weiterhin über die ioBroker-Instanzverwaltung bedient. Die Anzeige löst keine Übernahme aus.

Die Prozessseite ist für Administratoren geschützt. Kiosk- und normale Benutzer erhalten keine Prozesssteuerung. Die bewusst deaktivierte Oberfläche/EMS kann über die weiterhin erreichbare Administration wieder aktiviert werden. Während EMS abgeschaltet ist, findet dessen Regelung nicht statt; vorhandene Protokoll-Watchdogs und Gerätebegrenzungen werden nicht abgeschaltet.

Die Administratoranmeldung bleibt auch für einen neuen Browser oder nach Sitzungsablauf erreichbar, wenn die UI/EMS abgeschaltet ist. `/runtime/` führt dazu ausdrücklich über die Passwortanmeldung zurück zur Prozessverwaltung.

## Tarifanbieter beim Update

Der ausgewählte Tarifanbieter, seine Zugangsdaten, Preisformeln und Tarifeinstellungen bleiben im bestehenden geschützten Konfigurationsspeicher. Ein Update oder normaler Neustart ersetzt vorhandene Werte nicht durch neue Paketdefaults. Das gilt auch für einen bereits übernommenen UI-Namensraum und für ausdrücklich gespeicherte Null-/Aus-Werte.

Die gezielte Regression liest mit dem Originalcode von 9.0.21 erzeugte Testkonfigurationen für sechs unterstützte Anbieterpfade. Sie prüft auch wiederholte Neustarts, die geschützte Ablage und die Übernahme. Sie verwendet keine echten Zugangsdaten und prüft keine Erreichbarkeit des jeweiligen Anbieters.

## Installation über den bisherigen Git-/npm-Weg

1. Bestehende Konfiguration und Daten sichern. Die vorhandene EOS-Instanz behalten.
2. Aus der vollständigen Repository-ZIP den Inhalt des inneren Ordners `iobroker.eos-admin` in den eigenen Repositoryordner übernehmen; `.git` und eigene Änderungen berücksichtigen.
3. Im Ordner mit `package.json` die Versionsausgabe prüfen und normal veröffentlichen:

```powershell
node -p "require('./package.json').version"
npm publish --tag next
```

Die Ausgabe muss `9.0.25` sein. Der passende Eintrag für das eigene ioBroker-Repository liegt in `nexowatt-eos-admin-repository-entry-v9-0-25.json`. Bekannte unveränderte Buildreste werden von der Publish-Vorbereitung gesichert bereinigt; eigene oder unbekannte Änderungen werden nicht still gelöscht. Keine Publish-Prüfung mit `--ignore-scripts` umgehen.

Ein zusätzliches npm-Paket für OCPP, Devices oder EEBUS ist für die integrierten Module nicht erforderlich. Ein bereits separat verwendeter OCPP-Adapter darf bis zu einer ausdrücklich geprüften Übernahme weiterlaufen. Nicht gleichzeitig zwei Prozesse als Eigentümer derselben Geräte starten.

## Kontrolle nach Installation

- In `/runtime/` müssen die zuvor aktiven Geräteprozesse bereit werden und EMS seine Bereitschaft bestätigen. Ein gültiger PID allein genügt nicht.
- Bestehende Geräte müssen aktuelle Werte und ihre bisherigen Zuordnungen behalten. Den Energiefluss mit gleichzeitig erfassten Quellwerten vergleichen; die Anzeigeaktualisierung bleibt bei fünf Sekunden.
- Den bestehenden separaten OCPP-Pfad einschließlich PV-Stopp, tatsächlicher Ladepause und Wiederaufnahme prüfen. Die Versionskorrektur erteilt keine neue Ladefreigabe.
- Die neuen Prozessaktionen zunächst gezielt an einem geeigneten Modul prüfen: bestätigtes Ende, erneuter Start, lesbare Fehler und gespeicherte Deaktivierung nach EOS-Neustart. Eine bewusste Abschaltung beeinflusst den zugehörigen Anlagenbetrieb.
- Ein unbekannter oder nicht übernommener externer OCPP-Adapter darf den sonstigen Geräte-/EMS-Start nicht mehr blockieren.

Der zugehörige [Prüfbericht](docs/reports/unified-9.0.25/PRUEFBERICHT.md) nennt tatsächlich ausgeführte Prüfungen und offene Hardwarefälle. Die erfolgreiche Rückkehr des Nutzers zu 9.0.21 ist kein Hardwaretest von 9.0.25. Veröffentlichung und Installation führt dieses Paket nicht selbst aus.
