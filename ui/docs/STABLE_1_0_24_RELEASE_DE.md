# NexoWatt EOS 1.0.24 – NVP-Diagnose-Teststand

Dieser Stand ist **nicht für den Produktivbetrieb freigegeben**. Die bestehende numerische Paketversion bezeichnet den Quellstand; die Bezeichnung dieser Datei ist ein vorhandener Release-Vertrag, keine Stable-Freigabe.

Neu sind Konfiguration, Bedienoberfläche, getrennte Messkontexte und hypothetische Bereichs-/Budgetdiagnose für M0/M1. Der aktive dynamische Modus ist bewusst nicht verfügbar. Die bisherige Regelung bleibt bei Diagnose unverändert einschließlich ihrer bestehenden Geräte-Schreibhoheit.

Basis ist NexoWatt_UI_1.0.23_HEIZSTAB_NACHT_PV_TEST_FULL_REPOSITORY.zip vom 08.10.2026. Die Heizstab-Korrekturen bleiben enthalten. Keine EOS-Monorepo-Migration, neue Lizenzarchitektur oder Laufzeitumstellung.

- [Bedienung und Architektur](NVP_TOPOLOGIE_DIAGNOSE_DE.md)
- [Abnahme- und Restarbeitsplan](reports/NVP_2026_10_22_PRUEFPLAN_DE.md)
- [Tatsächlicher Änderungs-/Prüfvermerk](reports/nvp-2026-10-22/PRUEFVERMERK_DE.md)

Vor Test: Installerkonfiguration exportieren, vorheriges vollständiges Paket aufbewahren. Nach Update steht ohne neue Konfiguration weiterhin Statisch. In der neuen NVP-Oberfläche zunächst Grenzen, Messquellen und Gerätezuordnungen anlegen und die Diagnose prüfen. Keine reale Anlage aufgrund hypothetischer Budgetwerte neu belasten. Rückkehr über statische Auswahl und gegebenenfalls gesicherte Konfiguration/1.0.23-Paket. Rückfall ist nicht als Hardwaretest durchgeführt worden.
