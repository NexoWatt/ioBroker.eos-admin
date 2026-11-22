# NexoWatt EOS 9.0.5 – History und Stabilität

Dieses Update ist für die bestehende Instanz **`eos-admin.0`** bestimmt.
Gültige zentrale Lizenz, System-UUID, öffentliche Prüfschlüssel und Konfiguration
werden weiterverwendet. Für diese Korrektur ist keine ioBroker-Neuinstallation
und keine zweite Lizenzaktivierung im UI erforderlich. NexoWatt-Anteile bleiben
proprietär; Drittanbieterrechte bleiben erhalten.

## 1. Sichern und aktualisieren

Vor dem Update vollständige ioBroker-Konfiguration und EOS-Instanzdaten sichern.
Für die Lizenz müssen **`storage.key` und `license.enc` gemeinsam**, importierte
öffentliche Prüfschlüssel und ein vorhandener OS-Truststore gesichert werden.
Die Sicherung geschützt außerhalb des Geräts aufbewahren. Diese Dateien oder die
Instanz nicht als Reparaturmaßnahme löschen.

Das Paket **`iobroker.eos-admin-9.0.5.tgz`** über den vorgesehenen
ioBroker-Installationsweg übernehmen und die vorhandene Instanz aktualisieren.
Die Wartung unterbricht auch die im Adapter enthaltene EMS-Regelung; die vorgesehenen
unabhängigen Schutzfunktionen müssen wirksam bleiben. Keine zweite EOS-Instanz
oder frühere `nexowatt-ui`-Regelung parallel aktivieren.

Für Git gehören die Dateien aus dem ZIP-Ordner `iobroker.eos-admin` direkt in die
Wurzel von [NexoWatt/ioBroker.eos-admin](https://github.com/NexoWatt/ioBroker.eos-admin),
mit `package.json` auf dieser Ebene. Erst nach tatsächlichem Upload dieses Stands
ist eine Git-Installation von 9.0.5 möglich. Hier wurde nichts automatisch zu Git
oder npm veröffentlicht. Bei npm ist der Testkanal **`next`** vorgesehen.

## 2. Start, History und Logo prüfen

Der vorhandene ioBroker-Admin bleibt auf seinem bisherigen Port, hier **8081**.
EOS verwendet im Standardprofil **HTTPS auf 8188**:

**`https://192.168.10.153:8188/`**

1. In den Logs Version **9.0.5**, `LICENSE_VALID` und `EOS_HTTPS_READY` kontrollieren.
   Die HTTPS-Meldung bestätigt den Listener, nicht bereits die vollständige
   Betriebsbereitschaft aller Geräte oder die Qualität ihrer Messwerte.
2. Anmelden und die History mehrmals öffnen, Tages-/Wochenansicht wechseln und
   anschließend Dashboard und Systemverwaltung verwenden. Es darf kein Neustart
   mit `Cannot read properties of undefined (reading 'from')`,
   `unhandled promise rejection` oder Exitcode 6 auftreten.
3. Fehlende History-Daten dürfen als Fehler oder als fehlend erscheinen. Sie dürfen
   weder einen Absturz noch erfundene frische Nullmessungen erzeugen.
4. `/system/` einmal mit leerem Browsercache öffnen. Sowohl die frühe Startanzeige
   als auch die Ladeanzeige müssen das NexoWatt-Logo verwenden.
5. Livewerte nach mindestens zwei Minuten und nach einem regulären Adapterneustart
   erneut prüfen. Die vorhandene zentrale Lizenz muss ohne erneute Eingabe gelten.
6. RAM und CPU im selben Betriebszustand wie zuvor beobachten: direkt nach Start,
   nach wiederholten History-Aufrufen und nach 15–30 Minuten. RSS, Heap und Datenlast
   soweit verfügbar festhalten; kurzzeitige Spitzen von dauerhaftem Wachstum trennen.

Zertifikat und Vertrauenskette müssen zur aufgerufenen IP beziehungsweise zum
Gerätenamen passen. Der Name `NexoWattEOS` und ein optionaler HTTPS-Zugang auf 443
benötigen weiterhin die passende lokale DNS-/Zertifikat-/Proxyeinrichtung.

## 3. Was behoben wird und was die Meldungen bedeuten

Der konkrete Feldfehler in 9.0.4 liegt vor der eigentlichen History-Abfrage:
Beim Übergang vom Verwaltungsserver zur eingebetteten UI konnte `req.query`
verloren gehen. Der Zugriff auf `from` löste eine unbehandelte Promise-Ablehnung
aus und beendete den gemeinsamen Adapter. 9.0.5 sichert diese HTTP-Grenze und
behandelt asynchrone Routenfehler kontrolliert. History-Daten und Ressourcen
werden zusätzlich validiert beziehungsweise begrenzt. Die EMS-Datenpunktregistry
hält nur benötigte Quell-/Alias-/Verbindungswerte vor; fachfremde Admin-State-Payloads
werden dort nicht zusätzlich gespeichert.

`EOS_UI_UNAVAILABLE` war die sichtbare Folge einer ausgefallenen UI.
Die anschließenden `EOS_STATE_SUBSCRIPTIONS_STOPPED`-Meldungen entstanden beim
Herunterfahren; späte Abmeldungen werden als wiederholbarer Aufräumvorgang behandelt.
Die Meldungen „Unsubscribe from all states …“ und „Subscribe to all states again“
beschreiben dagegen die Ereignisbegrenzung der Oberfläche. Allein belegen sie keinen
Absturz. `NVP stale/split-stale` und fehlende PV-Prognosen sind separate Diagnosen;
Messpunkte, Aktualität und Datenquellen müssen unabhängig geprüft werden.

Die vom Nutzer beobachteten rund 750 MB sind kein nachgewiesener Zielwert und
keine vollständig erklärte Speicherursache. Tatsächliche Messungen und Grenzen
der Optimierung stehen im [Prüfbericht 9.0.5](docs/reports/unified-9.0.5/PRUEFBERICHT.md).
Es wird keine pauschale RAM-Ersparnis zugesagt.

## 4. Bei Abweichungen und Rückfall

Bei erneutem Ausfall die **erste** Fehlerzeile samt Stacktrace, Version, Uhrzeit und
Prozess-/Exitmeldung sichern; spätere Aufräummeldungen getrennt halten. Passwörter,
Lizenzcode und private Schlüssel weglassen. Betriebszustand und letzten UI-Schritt
notieren. Vor einem Rückfall den geprüften vorherigen Paket-/Konfigurationsstand
und dessen Sicherheitsgrenzen berücksichtigen; alte und neue Regler nicht parallel
starten. Ein Rückfall auf 9.0.4 bringt den bekannten History-Absturz wieder mit.

Dieser Stand ist eine Integrationstestlieferung für `next`. Tatsächliche Prüfungen,
offene Hardware-/Dauerlaufabnahme und Artefaktbezug stehen im
[versionsgebundenen Bericht](docs/reports/unified-9.0.5/PRUEFBERICHT.md).
Eine Serienfreigabe oder CRA-Konformitätserklärung wird damit nicht ersetzt.
