# NexoWatt EOS 1.0.27 – App-Center-Speicherkorrektur

Dieser Stand korrigiert den gemeldeten Fehler `DYNAMIC_GRID_VERSION_CONFLICT`
beim ersten Speichern der Installation „Dynamischer Netzanschluss“ unter EMS Apps.
Grundlage ist das vollständige Repository 1.0.26. Dieser Teststand ist
nicht für den Produktivbetrieb freigegeben.

Das App-Center hatte die vom Backend verlangte Konfigurationsversion nicht
mitgesendet. Es übermittelt jetzt den beim Laden erhaltenen Stand. Der Server
weist weiterhin echte veraltete Änderungen zurück. Für ältere Konfigurationen
ohne Versionsfeld wird beim Lesen dieselbe Anfangsversion wie beim Speichern
verwendet. Es werden keine Lizenzen, Zählerzuordnungen oder Speicherregler
zurückgesetzt.

Nach dem Update die EMS-Apps-Seite vollständig neu laden. Die App installieren
und die Installation mit „Speichern & EMS neu starten“ übernehmen. Danach im
Reiter „Dynamischer Netzanschluss“ M1 und die herstellerunabhängigen Zuordnungen
einrichten; M0 kommt weiterhin aus Allgemein. Erst mit vollständiger gültiger
Zuordnung aktivieren. Bei einer zwischenzeitlichen Änderung in einer anderen
Ansicht den aktuellen Stand bewusst neu laden und prüfen.

Bestehende gültige Lizenzen funktionieren nach derselben Strategie wie in
1.0.26. Die Einrichtung bleibt ausschließlich unter EMS Apps. Die spätere
Lizenzarchitektur gehört weiterhin zur eigenen EOS-Software.

Vor dem Update den bisherigen Quellstand und die Konfiguration sichern.
Rückfall auf 1.0.26 mit passender Konfigurationssicherung ist möglich; dessen
bekannter Erstinstallationsfehler besteht dann wieder. Eine aktive Anlage
bedarf weiterhin ihrer eigenen Funktionsprüfung.

- [Änderung und tatsächliche Prüfungen](reports/dynamic-grid-save-2026-10-23/PRUEFVERMERK_DE.md)
- [Einrichtung und Betrieb](DYNAMISCHER_NETZANSCHLUSS_DE.md)
- [Bestandslizenzen und EMS Apps](operations/EMS_APPS_LIZENZ_KOMPATIBILITAET_DE.md)
