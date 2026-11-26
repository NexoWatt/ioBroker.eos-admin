# NexoWatt EOS 9.0.35 · Systemstatus und Benachrichtigungen

## Was im Dashboard steht

„Alle Systeme normal“ erscheint bei bestätigter Verbindung, laufendem EMS, aktueller Netzpunktmeldung und unauffälliger Diagnose der für die Anlage aktiven Prozesse und Geräte. Ein Verbindungsaufbau, ein abgelaufener Messwert oder eine noch ausstehende Diagnose haben eigene Meldungen. Während eines erneuten Datenabgleichs innerhalb einer laufenden Live-Verbindung bleibt der aktuelle Status sichtbar.

Die Prozessüberwachung umfasst Oberfläche, EMS, Geräte, EEBus, Sicherung und OCPP der integrierten EOS-Instanz. Fällt ein freigegebener Prozess aus, nennt die Anzeige das betroffene Modul. Bewusst pausierte Module lösen keinen Ausfallalarm aus. Eine absichtlich pausierte EMS-Regelung wird als solche angezeigt. Der weiter erreichbare Administrationsprozess kann einen Ausfall auch dann bestätigen, wenn der Live-Datenstrom unterbrochen ist.

Bestätigt ein überwachtes Gerät einen Verbindungsverlust über seine Geräteanbindung, zeigt die Statuszeile den Gerätenamen. Bei mehreren Offlinegeräten nennt sie die ersten beiden und die Anzahl weiterer Geräte. Mit **Betroffene Geräte** lässt sich die Liste auch am Wandtablet aufklappen. Die Anzeige liefert bis zu zwölf Namen und die Gesamtzahl. Die integrierte Geräteanbindung überwacht eingerichtete, aktive Geräte über deren Kommunikation. Bei OCPP muss die Ladestation dem EOS bekannt und freigegeben sein. Eine nicht belegte, erreichbare Ladestation gilt als betriebsbereit. Nach einem OCPP-Neustart erkennt EOS zuvor bestätigte Stationen an ihrer lokalen Historie. Für Stationen ohne bestätigte Trennung erscheint bis zur Anmeldung oder zum Ablauf des konfigurierten OCPP-Zeitfensters der Zustand unbekannt. Eine bereits bestätigte Trennung bleibt sichtbar. Meldet eine Überwachungsquelle keine verwertbare Beobachtung, bleibt die Erreichbarkeit unbekannt.

**OVUM MIRA.** Wird eine TCP-Verbindung während des Lesens zurückgesetzt, kann EOS nach der Wiederverbindung wieder messen. Ein Verbindungsabbruch sperrt das Register für die elektrische Aufnahmeleistung nicht mehr als vermeintlich nicht unterstütztes Register.

**EEBus-Partner.** Bei einem gekoppelten Partner im EEBus-Gerätedialog die Überwachung aktivieren und einen verständlichen Namen vergeben. Voraussetzung sind eine bestätigte lokale Vertrauensstellung und ein erfolgreicher Datenaustausch. Nach einem Neustart hat der Partner 120 Sekunden Zeit zum Wiederverbinden. Manuelles Trennen und ein Vertrauenswiderruf pausieren die Überwachung dauerhaft. Sobald wieder eine vertrauenswürdige Verbindung mit Datenaustausch besteht, kann die Überwachung im Pairingdialog erneut aktiviert werden.

## Benachrichtigungen

Unter **Einstellungen → Benachrichtigungen** den Versand aktivieren und die gewünschte E-Mail-Adresse eintragen. **System, Adapter und EOS-Prozesse** steuert Systemmeldungen. **Kommunikationsausfälle von Geräten und Ladestationen** steuert Geräteausfälle. Für Wiederherstellungen gibt es den Schalter **Entwarnungen in Tageszusammenfassung**. SMTP richtet der Installateur im EOS-Admin ein. Die Alarmierung läuft auf der Anlage auch bei geschlossenem Dashboard. Bestätigte neue Prozess- und Geräteausfälle werden im nächsten verfügbaren Versandlauf berücksichtigt. Für eine Entwarnung in der Tageszusammenfassung muss die Erreichbarkeit mindestens fünf Minuten bestätigt sein. Eine absichtliche Deaktivierung gilt als Pause.

## Installation und Vor-Ort-Test

1. Die Instanzkonfiguration vor dem Pilotupdate sichern. Für Git den Inhalt von `iobroker.eos-admin` aus der Repository-ZIP in den bestehenden Checkout übernehmen. Die vom Projekt mitgelieferten Git- und npm-Belege liegen daneben unter `docs/Liefernachweise`.
2. TGZ zuerst auf der eigenen Pilotanlage prüfen. Für die Veröffentlichung den bestehenden npm-Ablauf verwenden und das öffentliche Archiv überprüfen, bevor der ioBroker-Repositoryeintrag auf 9.0.35 zeigt. Das Werkzeug `node tools/nexowatt-patch-repo.cjs "/Pfad/zu/repo-nexowatt.json"` übernimmt diese Integritätsprüfung.
3. Bei gesundem Betrieb das Dashboard über mehrere Anzeigeperioden beobachten. Dann an einem dafür vorgesehenen Testgerät die Kommunikation unterbrechen und wiederherstellen. Gerätebezeichnung, Anzahl der Meldungen und Wiedereintritt in den Normalzustand prüfen. Auch bei einem bereits per VPN geöffneten Browser kontrollieren.
4. Eine Prozessstörung und eine absichtliche Modul-Pause getrennt prüfen. Der Funktionstest an einer Betriebseinrichtung mit laufender Regelung gehört auf die Pilotanlage. Die Benachrichtigungseinstellungen, Zustellung über den eingesetzten SMTP-Server und den Versandzeitpunkt für die gewählte Kategorie prüfen.
5. Für einen Rückfall den vorigen geprüften Paketstand und die dazu passende Instanzsicherung bereithalten. Die bereits in der Anlage betriebenen Funktionen, zum Beispiel die lokale Wärmepumpenregelung, vor und nach dem Update vergleichen.

[Softwareprüfungen und Grenzen](../reports/unified-9.0.35/PRUEFBERICHT.md) · [Einrichtung der OVUM MIRA](START_HIER_9.0.34.md)
