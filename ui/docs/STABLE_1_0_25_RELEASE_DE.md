# NexoWatt EOS 1.0.25 – Dynamischer Netzanschluss

Dieser Teststand ist **nicht für den Produktivbetrieb freigegeben**. Die historische Dateibenennung ist ein Repository-Vertrag, keine Stable-Freigabe. Die aktive App ist für den beauftragten Eigentest verfügbar.

Die eigene App **Dynamischer Netzanschluss** bündelt M1, M0/M1-Grenzen, generische Speicher-Datenpunkte, Betriebsarten und optionale PV-Zuordnungen. M0-Messdaten werden aus Allgemein übernommen. Installation und Aktivierung schalten die dynamische Regelung ein. Herstellerbeispiele erzeugen weder eine Whitelist noch eine Profilfreigabesperre.

Die Umsetzung verbindet die bestehenden Eigenverbrauchs-, SoC- und Tarifbausteine mit lokalen Gruppen und gemeinsam geprüften Netzbudgets. Ein zentraler Writer, Rückmeldungsprüfung und reservierte Ausgänge verhindern konkurrierende Gerätebefehle. Bestehende Konfigurationen bleiben ohne neue App-Aktivierung im bisherigen Betrieb.

Basis ist der vollständige 1.0.24-Quellstand, einschließlich Heizstab-Korrekturen aus 1.0.23. Keine Lizenzmigration, keine neue Cloud-Abhängigkeit und keine automatische Änderung einer Feldanlage.

- [Einrichtung und Betrieb](DYNAMISCHER_NETZANSCHLUSS_DE.md)
- [Technischer Datenvertrag](dev/DYNAMIC_GRID_CONTRACT.md)
- [Änderungs- und Prüfvermerk](reports/dynamic-grid-2026-10-23/PRUEFVERMERK_DE.md)

Vor Update die Installerkonfiguration und das vorherige vollständige Paket sichern. Reale Gerätereaktion, lokale Watchdogs, Fehlerfälle und Wiederherstellung sind an der jeweiligen Anlage nachzuweisen. Die Softwareprüfung enthält keine behauptete Hardwareabnahme.
