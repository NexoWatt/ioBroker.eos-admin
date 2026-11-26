# NexoWatt EOS 9.0.23 mit OCPP 0.4.3

Stand: 25.11.2026. Dieser Stand setzt die Prozessaufteilung und automatische Zuordnung des bereitgestellten OCPP-Adapters um. Er baut auf EOS 9.0.22 auf. Die Korrekturen am Energiefluss, am Tarifstatus, am reinen PV-Laden und am 5-Sekunden-Anzeigetakt bleiben enthalten.

## Pakete und Prozesse

| Bestandteil | Betrieb |
| --- | --- |
| EOS Admin, Anmeldung und zentrale Verwaltung | Eigener ioBroker-Adapterprozess, Compact-Modus aus |
| Bisherige EOS-Oberfläche mit EMS | Eigener beaufsichtigter Node-Kindprozess |
| Geräteanbindung | Eigener beaufsichtigter Node-Kindprozess |
| EEBUS | Eigener beaufsichtigter Node-Kindprozess |
| Backup | Eigener beaufsichtigter Node-Kindprozess; bestehende Jobprozesse bleiben separat |
| OCPP 0.4.3 | Separater ioBroker-Adapter `ocpp21`, Compact-Modus aus |

Die gemeinsame Bedienoberfläche bleibt erhalten. Einzelne Geräte erhalten keinen eigenen Node-Prozess; die Trennung gilt für die Adapter beziehungsweise Laufzeitmodule. Oberfläche und EMS der bisherigen UI bleiben gemeinsam in einem Kindprozess. Es wird keine neue eigene JavaScript-Runtime benötigt. Jeder Prozess besitzt einen eigenen Heap und eine eigene Ereignisschleife; die Prozesse teilen weiterhin Betriebssystem, Dienstkonto, Controller und Hardware. Das ist Fehlerbegrenzung, keine vollständige Sicherheits-Sandbox oder garantierte Echtzeit.

Der Parent überwacht Start, Heartbeat, Ende und Neustart. Ein Ersatzprozess startet erst nach dem Ende der alten Generation und bereinigten Schreib-/Abonnementvorgängen. Ungeklärte ausstehende Schreibvorgänge führen zu einem sichtbaren Fehlerzustand statt zu konkurrierenden Reglern. Wiederholte Abstürze werden begrenzt; eine unendliche Neustartschleife wird verhindert.

## OCPP wird automatisch zugeordnet

Sobald der Adapter seinen nativen Stationsvertrag veröffentlicht, erkennt EOS die Station, legt ihre Konfigurationszeile an und verknüpft die geprüften Mess-, Status- und Steuerdatenpunkte. Der ereignisgesteuerte Abgleich fasst Registrierungsereignisse kurz zusammen; ein periodischer Wiederholungsabgleich holt Teilregistrierungen und Fehler nach. Verbindungsabbrüche oder Neustarts erzeugen keine zweite Station.

Neue Stationen werden sichtbar, bleiben aber bis zur Inbetriebnahme deaktiviert. Phasen, Mindest- und Höchststrom beziehungsweise zulässige Leistung werden nicht aus dem Gerätenamen geraten. Nach Prüfung dieser Werte die Regelung im Installer aktivieren. Bestehende manuelle Werte und Zuordnungen bleiben erhalten. Eine bislang reine Messzuordnung erhält keinen neuen Hardware-Schreibpfad ohne Prüfung. Bei ausgeschöpfter Lizenz werden weitere erkannte Stationen mit `LICENSE_LIMIT` angezeigt.

Der bereitgestellte Adapter bietet eine stationsweite Stellgröße. Mehrere physische Anschlüsse werden als Topologie erkannt, erhalten aber keine erfundenen unabhängigen Sollwertkanäle. Zwei EOS-Regler dürfen dasselbe Stationslimit nicht gleichzeitig schreiben. Unabhängig steuerbare Anschlüsse des bisherigen `ocpp`-Adapters bleiben davon unberührt.

## Bestätigung und Ausfallverhalten

OCPP 0.4.3 ergänzt eine atomare, an die aktuelle Verbindung gebundene Sollwertrückmeldung. EOS unterscheidet lokalen Datenpunkt-Schreibvorgang, Annahme des Ladeprofils durch die Station und tatsächliche gemessene Ladeleistung. Amperewerte im OCPP-Protokoll werden nicht mehr als Watt interpretiert. Ablehnung, Timeout, alte Verbindung, ungültige Qualität und fehlende Zeitstempel ergeben keine bestätigte Regelung.

Bei einer von EOS gesteuerten 0.4.3-Station erneuert EOS seine Prozessfreigabe alle 5 Sekunden für weitere 15 Sekunden. Der unabhängige OCPP-Watchdog erkennt den Ablauf und fordert ein 0-W-Profil an. Positive Befehle bleiben ohne frische Freigabe gesperrt; eine Erneuerung allein stellt keinen alten positiven Sollwert wieder her. Der Schutz bleibt nach einem Adapterneustart für zuvor übernommene Stationen vorgemerkt und benötigt ein neues Freigabeereignis. Stationen, die nie durch EOS übernommen wurden, behalten den eigenständigen Adapterbetrieb.

Die 15 Sekunden sind die Freigabedauer, keine garantierte elektrische Abschaltzeit. Die Watchdogprüfung erfolgt jede Sekunde; ein laufender Protokollaufruf, dessen Timeout und die Reaktion der Station beeinflussen den Stoppversuch. Bei unterbrochener Geräteverbindung, ausgefallenem OCPP-Prozess oder ausgefallenem Rechner kann Software keinen physischen Stopp bestätigen. Geräteeigene Schutz- und Ausfallfunktionen bleiben erforderlich. Bei anderen Geräteprotokollen gelten weiterhin deren vorhandene profilbezogene Ausfall- und Wiederanlaufregeln.

## Diagnose und Inbetriebnahme

Unter `/runtime/` zeigt EOS Prozesszustand, PID, Neustarts und EMS-Bereitschaft. Der sichtbare Bildschirm aktualisiert alle 5 Sekunden und kennzeichnet unbekannte beziehungsweise ausgefallene Quellen ausdrücklich. Ein laufender Prozess bedeutet nicht automatisch eine betriebsbereite Regelung.

1. Bestehende Konfiguration und Daten sichern. EOS und OCPP gemeinsam auf einer Testanlage aktualisieren; beide Installationspakete liegen bei.
2. Den OCPP-Adapter separat betreiben und die Wallbox an dessen bestehendem Server anmelden. Netzwerk-/Portkonfiguration und Stationsidentität bleiben im OCPP-Adapter.
3. Automatisch erkannte Station im EOS-Installer kontrollieren, elektrische Grenzwerte eintragen und aktivieren. Stationsweite Regelung bei mehreren Anschlüssen beachten.
4. Dousida Energyline prüfen: positiver Sollwert, reines PV-Laden, Unterschreiten des Überschusses, 0-W-Anforderung, tatsächliche gemessene Ladepause und Wiederaufnahme ohne Aus-/Einstecken.
5. Wiederverbindung, EOS-Kindprozess-Neustart, fehlende Freigabe, abgelehntes Ladeprofil und OCPP-Neustart prüfen. Reale Leistung und Fehlermeldungen kontrollieren; eine lokale Bestätigung reicht nicht.
6. Energiefluss-Bilanz, Tarifstatus und sichtbaren 5-Sekunden-Takt mit gleichzeitig erfassten Quellwerten prüfen. Anschließend RAM, CPU und Reaktionszeiten auf dem vorgesehenen Pi beziehungsweise IPC über einen längeren Betrieb beobachten.

Ein Produktionssystem wurde in dieser Bearbeitung weder aktualisiert noch veröffentlicht. Automatisierte Nachweise und ihre Grenzen stehen in `docs/reports/unified-9.0.23/`; die Paket- und Quellprüfsummen gehören zum Lieferpaket. Reale Dousida-Hardware und Langzeitbetrieb sind noch abzunehmen. Eine pauschale 100-%-Zuverlässigkeitsgarantie wird daraus nicht abgeleitet.
