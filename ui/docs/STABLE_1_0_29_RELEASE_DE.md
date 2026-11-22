<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis untersagt. -->
# NexoWatt EOS 1.0.29 – Sicherheitsprüfung des NexoWatt-UI-Adapters

Geprüft wird ausschließlich der bestehende ioBroker-Adapter NexoWatt UI;
dies ist keine neue eigenständige EOS-Laufzeitarchitektur.

Dieser Stand ist nicht für den Produktivbetrieb freigegeben. Die technische
Testveröffentlichung ist von der allgemeinen Hersteller-/Anlagenfreigabe getrennt.

Ausgangspunkt ist das vollständige Paket 1.0.28. Die Prüfung zeigt: Die vom Nutzer
geforderten Sicherheitsregeln sind im Gesamtbestand nur teilweise erfüllt.
Dieser Stand behebt die konkret nachgewiesene HTTP-Fehleroffenlegung, entfernt
zwei statische eval-Aufrufe und aktualisiert fünf betroffene Abhängigkeiten.
Eine neue native TypeScript-Fehlergrenze wird ohne neue Laufzeitabhängigkeit
streng geprüft. Die bestehende ioBroker-Anbindung bleibt nach Nutzerentscheidung
erhalten. Die vollständige Strict-/no-any-Migration, allgemeine Lintabdeckung,
Dateiheader im gesamten Altbestand und der ASVS-Einzelnachweis bleiben offen.

Die historischen Feldtestlizenzen, EMS-App-Einordnung, Datenpunktzuordnung und
Regelberechnungen bleiben erhalten. Der bekannte Restbefund der historischen
symmetrischen Lizenzprüfung wird nicht als behoben dargestellt.

Vor Update den vorherigen Paketstand sowie ioBroker-Konfiguration und States
sichern. Anschließend Adapter neu starten und Oberfläche vollständig neu laden.
Auf der eigenen Testanlage Anmeldung/Rollen, bestehende Lizenz, EMS Apps und
DP-Auswahl sowie vorhandene Speicher-/Heizstab-/Ladefunktionen prüfen. Der
Client darf bei defektem JSON oder einem internen API-Fehler keinen Stacktrace,
Dateipfad oder fremden Ausnahmetext anzeigen. Für Rückfall auf 1.0.28 die dazu
passende Sicherung verwenden; die in 1.0.28 dokumentierten Sicherheitsbefunde
bestehen dann wieder. Keine Liveinstallation durch diese Bearbeitung.

Details, tatsächliche Testergebnisse, Grenzen und Quellen:
[Prüfbericht](reports/security-standards-2026-10-23/PRUEFBERICHT_DE.md).
