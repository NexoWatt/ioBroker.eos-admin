# NexoWatt EOS 9.0.30 – Einstieg

## Aktualisieren und prüfen

1. Vor dem Update die Anlage über die vorgesehenen geschützten Sicherungen sichern. Beziehe die bestehende Prozesskonfiguration, Gerätezuordnungen, Historienverbindung und TLS-Identität ein.
2. `iobroker.eos-admin` in derselben ioBroker-Instanz aktualisieren. Unter **Prozesse** die separaten Einträge **Oberfläche** und **Energiemanagement (EMS)** und die eingerichteten Module prüfen. Eine bisher gespeicherte gemeinsame Deaktivierung bleibt für beide Prozesse wirksam.
3. Bei einer kontrollierten Anlagenprüfung die Oberfläche neu starten. Dabei EMS-Bereitschaft, EMS-Prozessnummer und Messwertaktualisierung beobachten. Bei geeigneten sicheren Testbedingungen die tatsächliche Regelreaktion prüfen. Dashboard, Kiosk, Datenpunktauswahl, Historie, Ladepunkt und Sicherung entsprechend der Anlagenkonfiguration prüfen.
4. Für einen RAM-Vergleich dieselbe Geräte- und Modulausstattung und dieselbe Last verwenden. Prozess-PSS, verfügbaren System-RAM, Swap-Aktivität und EMS-Regelzeiten erfassen. Normalbetrieb und parallele Nutzung von Dashboard, Historienabfrage und Sicherung getrennt beobachten.

Ein Rückfall auf 9.0.29 setzt die gesicherte Prozesskonfiguration dieses Stands voraus, falls bereits eine neue Prozessaktion gespeichert wurde. Der ältere gemeinsame Prozess liest die neue Konfiguration mit zwei separaten Freigaben nicht. Den kombinierten Betriebszustand vor dem Wiederanlauf prüfen. [Details zur Prozesssteuerung](../MODULE_PROCESS_RUNTIME.md)

## Git und npm

Den vollständigen Ordner `iobroker.eos-admin` aus der ZIP übernehmen. Mit `npm pack --dry-run` lässt sich der Paketinhalt samt Verpackungsprüfungen lokal prüfen. Der beiliegende [ioBroker-Repository-Eintrag](../../nexowatt-eos-admin-repository-entry-v9-0-30.json) verweist auf die Paketversion und setzt deren npm-Veröffentlichung voraus.

[Prüfbericht](../reports/unified-9.0.30/PRUEFBERICHT.md) · [Zertifikatsleitfaden](../unified/NEXOWATT_TLS_DE.md)
