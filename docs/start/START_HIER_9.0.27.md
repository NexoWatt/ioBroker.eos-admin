# NexoWatt EOS 9.0.27

Kontrollierter Teststand für OCPP-/Devices-Zuordnung, Tibber-Persistenz und Wiederanlauf. Ein gemeinsames EOS-Adapterpaket; getrennte interne Prozesse bleiben erhalten. Kein zusätzlicher Adapter erforderlich.

## Git und npm

Den vollständigen Ordner `iobroker.eos-admin` aus dem FULL_REPOSITORY-Paket in deinen Repository-Ordner übernehmen. Eigene Änderungen vorher sichern. Bei einer Übernahme in einen bestehenden Checkout die [Dokumentverschiebungen](../UMSORTIERTE_DATEIEN.tsv) im Git-Diff nachvollziehen. `node_modules` gehört nicht in Git. Vorhandene Prüfsiegel nicht selbst neu erstellen: gemischte oder unbekannte Dateien müssen geprüft werden. Die Publish-Prüfung übernimmt nur bekannte alte Builddateien in ihre Sicherung.

Mit `npm pack --dry-run` auf dem aktuellen Git-Stand den Paketinhalt lokal prüfen. Das bereits veröffentlichte npm-Paket 9.0.27 bleibt unter seiner Versionsnummer verfügbar. Die aufgeräumte ZIP dient zur Übernahme in Git. Für dein eigenes ioBroker-Repository den Eintrag `nexowatt-eos-admin-repository-entry-v9-0-27.json` im Adapterordner verwenden.

## Tibber und andere gespeicherte Tarife

Ein anderer Speichervorgang im EMS-App-Center konnte den Tarif bisher mit Standardwerten überschreiben. Dieser Pfad wird korrigiert: unveränderte Tarife werden nicht mitgespeichert; vorhandene Zugangsdaten bleiben hinter ihren Platzhaltern erhalten. Vor bestätigtem Laden der Konfiguration sind Konfigurationszugriffe gesperrt. Nach einem Anbieter- oder Zielwechsel werden alte Geheimnisse nicht an einen anderen Dienst weitergereicht.

Bereits gelöschte Tokens stellt das Update nicht automatisch wieder her. Falls der alte Stand sie bereits überschrieben hat, nach Installation den Tibber-Zugang einmal neu speichern und anschließend den Neustart prüfen.

## Update und Wiederanlauf

Vor dem Anlagenupdate eine aktuelle Konfigurationssicherung bereithalten. Ein abgebrochener Standard-ioBroker-Updateversuch kann die Instanz deaktiviert lassen. Ein weiterer Updateversuch hebt diese Deaktivierung nicht zwingend auf. Dieser externe Controllerpfad wurde nachgestellt, nicht auf deinem Pi geändert. Der EOS-eigene Updateweg prüft sein Paket vor dem Stopp und überwacht den anschließenden Instanzstart; unklare Teilinstallationen bleiben als Fehler sichtbar.

Nach Installation prüfen: eos-admin.0 aktiv, EOS erreichbar, UI/EMS bereit und eingerichtete Module betriebsbereit. War die Installation erfolgreich und die Instanz nur gestoppt, lässt sie sich in ioBroker bewusst wieder starten. Eine absichtlich deaktivierte Instanz wird nicht pauschal aktiviert.

## OCPP und Devices prüfen

Bereits gespeicherte alte Doppelzuordnungen werden nicht eigenmächtig zusammengeführt. Nach dem Update mit „Neu laden“ den aktuellen Stand öffnen, die überzählige bzw. alte Zuordnung ausdrücklich entfernen und speichern. Der korrigierte Erkennungsweg verhindert neue Doppelanlagen.

1. Interne Wallbox verbinden: automatisch genau eine native Steuergruppe als EMS-Ladepunkt, passende Datenpunkte, keine automatische Stations-/Displayzuordnung. Neue noch ungeprüfte elektrische Grenzen erteilen keine automatische Stellfreigabe.
2. OCPP-Erkennung mehrfach ausführen und speichern: kein zweiter identischer Ladepunkt. Bestehende Namen, Grenzen, Betriebsfreigaben und manuelle Stationen bleiben erhalten.
3. Bei unverändertem Formular wird vor der Erkennung der aktuelle Stand geladen. Ungespeicherte Eingaben bleiben bestehen; echte parallele Änderungen verlangen weiterhin bewusstes Neuladen und Vergleichen.
4. Eine EMS-Zeile löschen und speichern, dann neu starten: keine ungewollte Wiederanlage. OCPP kann bewusst erneut erkannt und gespeichert werden; bei Devices ist ein neuer ausdrücklicher EMS-Einrichtungsauftrag erforderlich.
5. Bestehende Tibber-Einstellungen, andere Geräte und bisherige Regelmodi kontrollieren. Bei einer Unklarheit nicht die ganze Konfiguration löschen. Vorherigen Lieferstand und Sicherung für einen bewussten Rückfall behalten.

Die zugehörigen Softwareprüfungen und offenen Zielsystem-/Browserprüfungen stehen in [Prüfbericht 9.0.27](../reports/unified-9.0.27/PRUEFBERICHT.md). Keine pauschale Produktionsfreigabe oder garantierte Fehlerfreiheit.
