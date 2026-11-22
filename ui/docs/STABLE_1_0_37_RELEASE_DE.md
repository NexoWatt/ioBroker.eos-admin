# NexoWatt EOS 1.0.37 – UI / Security Review / Testpaket

Stand: 19.11.2026. Ausgangspunkt ist das vollständige Repository 1.0.36
(`NexoWatt_UI_1.0.36_LADEMODI_HTTPS_TEST_FULL_REPOSITORY.zip`, SHA-256
`122361f103d5d27dd0957d383811f629939d31b05de1e62c4a62e1b3f465abf2`).
Diese Lieferung enthält das vollständige UI-Repository mit gebauten Runtime-
und Admin-Dateien. Dieser Teststand ist nicht für den Produktivbetrieb freigegeben;
er wird als Repository zum Prüfen geliefert und nicht veröffentlicht.

## Änderung und Ergebnis

Die vorhandene Smarthome-Oberfläche erhält moderne EOS-Karten, klarere Zustände
und größere, mit Tastatur und Touch bedienbare Detaildialoge. Favoriten, Räume,
Gerätekennungen, Szenen, Timer und bestehende Schaltverträge werden fortgeführt.
Die Geräteerkennung verwendet weiterhin den vorhandenen Type-Detector 5.0.10;
`ioBroker.devices` ist keine neue Pflichtabhängigkeit. Aliasziele bleiben erhalten,
damit ioBroker weiterhin seine Umrechnungen und getrennten Lese-/Schreibziele nutzt.

Die Zugangsschranke gilt jetzt auch für Seiten, Datenabfragen und den Livekanal.
Die zwei Betriebsarten werden ausdrücklich konfiguriert: eigenständiger
ioBroker-Adapter mit lokalen Konten oder EOS mit zentral geprüfter Admin-Sitzung.
Ein Profilwechsel ist keine automatische Ausweichstrategie. Kennwörter werden
nicht in der UI gespeichert; Befehle werden nach einem Login nicht automatisch
wiederholt. Alte offene Kundenpolicies öffnen keine Oberfläche mehr.

## Unterlagen

- [Smarthome-Bedienung und Gestaltung](SMARTHOME_MODERN_1_0_37_DE.md)
- [Anmeldeprofile und Einrichtung](operations/ANMELDEPROFILE_1_0_37_DE.md)
- [Versionsgeprüfte EOS-dev9-Integration](integrations/EOS_ADMIN_DEV9_UI_LOGIN_DE.md)
- [Geräteimport und Aliaszuordnungen](SMARTHOME_IMPORT_DE.md)
- [Sicherung, Update, Prüfung und Rückfall](operations/TESTANLEITUNG_1_0_37_DE.md)
- [Sicherheitsgrenzen und Anforderungen](security/UI_ZUGRIFF_1_0_37_DE.md)
- [Prüfergebnisse und verbleibende Abnahme](reports/smarthome-auth-2026-11-19/PRUEFBERICHT_DE.md)
- [Vergleich mit bestehenden Anlagenverträgen](reports/smarthome-auth-2026-11-19/BESTANDSKOMPATIBILITAET_DE.md)

Die Änderung hängt keinen EMS-Regler an eine Browsersitzung und ersetzt keine
Geräte-/Anlageneinstellungen. Auswirkungen der verschärften Anmeldung auf
bisher anonyme Browser-/HTTP-Clients sind in der Testanleitung beschrieben.

## Freigabestatus

`release-manifests/release-status.json` bleibt `review`, `productionApproved:false`.
Eine erfolgreiche technische Prüfung ist keine Herstellerfreigabe. Die vorhandenen
offenen Anlagen-, OCPP-, Partner- und Gesamt-EOS-Nachweise werden weitergeführt.

