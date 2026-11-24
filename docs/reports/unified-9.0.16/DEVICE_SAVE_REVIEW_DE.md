# Geräte-Speicherung – interner zweiter Code-Review 9.0.16

Stand: 23.11.2026. Zusätzlich zur Umsetzung erfolgte eine getrennte Code-Durchsicht durch einen weiteren Entwicklungsagenten. Dies ist keine externe Sicherheitsprüfung, Zertifizierung oder Hardwareabnahme.

Der Review fand nach dem letzten Start-/Speicherfix keinen weiteren konkreten Blocker im geprüften Änderungsumfang. Ein angenommener Speichervorgang wird vom operativen Start abgewartet; danach wird der maßgebliche Konfigurationsspeicher erneut gelesen. Schreibfehler bleiben beim Speicheraufrufer sichtbar. Ein zwischenzeitlicher Stopp verhindert den Modulstart. Ein Lesefehler nach Freigabe einer zuvor blockierten Übernahme entfernt die Schreibfreigabe, statt den vorherigen Entwurf freizugeben.

Die Speicherung nutzt ein geschütztes separates Konfigurationsobjekt und verändert das restartauslösende Adapter-Instanzobjekt nicht. Secrets, kompatible Zusatzfelder und die ursprüngliche Migrations-/Namensraumhülle bleiben erhalten. Ein fehlgeschlagener gewöhnlicher Browser-Reload kann den lokalen Entwurf stehenlassen; vor jeder PUT-Anfrage werden jedoch der aktuelle authentifizierte GET und die serverseitige Konfigurationsfreigabe geprüft. Daraus ergab sich kein nachgewiesener Schreib-Bypass.

Die gezielten Regressionen unter Node 22 und 24 sind in `raw/devices-save-regression-node22.log` und `raw/devices-save-regression.log` enthalten. Sie modellieren Controller und Gerätetransport; keine Liveanlage wurde verändert oder als abgenommen ausgewiesen.

## Geprüfte Dateien

| Datei | SHA-256 |
| --- | --- |
| `src/lib/eosModuleHost.js` | `eaafd4c56bbd233a8bc7ff7459d18df267b701ea6dcaf0e04199ac3dcdd3fcd6` |
| `src/lib/eosModuleConfigStore.js` | `eb78f98f57e2b17c85a9e592bcc37a2be0c6b2c21c5dbd99ddc25e4840a04131` |
| `modules/devices/admin/host-bridge.js` | `590cbe3072a25b0e3753b984d4d96f059073e4d19f70477bfe286ea1efacfd47` |
| `test/eos-module-device-save.test.cjs` | `05981c1d35c7fc6cb809b01f701fba275019c78928805ebc28d200308e32ea5c` |
