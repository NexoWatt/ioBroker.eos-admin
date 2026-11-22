<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. -->
# HTTPS-Proxy-Nachweise reproduzieren

Diese Hilfsprogramme liegen bewusst bei den Prüfbelegen. Sie ändern weder `test:all` noch Produktkonfigurationen. Ausgeführt werden ausschließlich lokale, synthetische ioBroker-/Admin-Konten und Gerätefixtures; echte HTTP-Routen, der gebaute EOS-Frontendstand und die unveränderte offizielle Proxyklasse werden verwendet. Eine vollständige Admin-Installation oder Kundenanlage ist nicht enthalten.

## Voraussetzungen

- Vollständiges NexoWatt-UI-Quellpaket mit den gebauten `main.js`, `lib/`, `www/` und `admin/react/` sowie den zugehörigen Entwicklungsabhängigkeiten. Die vorhandenen Build-/Integritätsprüfungen bleiben maßgeblich. Während des Browserlaufs keine Produktdateien verändern oder neu bauen.
- In dieser Prüfung verwendet: Node.js `v24.22.1`, Chromium `153.0.8010.0`, Playwright `1.62.1`. Die konkrete installierte Playwright-Version lässt sich mit `node -p "require(process.env.NW_PLAYWRIGHT_MODULE + '/package.json').version"` ermitteln. Playwright ist ausschließlich ein Prüfwerkzeug, keine neu eingeführte Adapter-Laufzeitabhängigkeit.
- Lokal verfügbare Programme `openssl` und Chromium; bei Playwrights verwaltetem Browser kann `NW_CHROMIUM_EXECUTABLE` entfallen. `NW_PLAYWRIGHT_MODULE` zeigt bei einer externen Installation auf deren `playwright`-Modulverzeichnis.
- Für den Quellenvergleich zusätzlich der unveränderte entpackte Quellstand `1.0.34` unter `NEXOWATT_PROXY_BASELINE_ROOT`.

## Offizielle Proxyquelle

Die Drittquelle ist nicht im Produktpaket enthalten. Genau die Datei `src/lib/instanceProxy.ts` aus dem offiziellen Tag `v8.3.5` verwenden:

- [Versionierte Quelle](https://github.com/ioBroker/ioBroker.admin/blob/v8.3.5/src/lib/instanceProxy.ts)
- [Unformatierte Datei](https://raw.githubusercontent.com/ioBroker/ioBroker.admin/v8.3.5/src/lib/instanceProxy.ts)
- Erwarteter SHA-256: `ccfd3fcab5466e24166e938dca305a67d8741a0bb85eea027a4b328b9f9b35d2`
- Git-Blob-SHA: `d88bedf3b81f66bc4456bf76de5891fe7213ff6d`

Die Datei außerhalb des Produktbaums ablegen und `NEXOWATT_ADMIN_PROXY_SOURCE` darauf setzen. Beide Integrationsprogramme vergleichen den SHA-256 vor Ausführung und brechen bei einer Abweichung ab. Die Quelle wird nur für die Prüfung im Speicher transpiliert; sie wird nicht in den Adapter eingebaut.

## Aufruf

Aus dem vollständigen Quellpaket aufrufen; die Pfadwerte auf die eigene Prüfumgebung setzen:

```sh
export NEXOWATT_ADMIN_PROXY_SOURCE=/absoluter/pruefpfad/instanceProxy.ts
export NW_PLAYWRIGHT_MODULE=/absoluter/pruefpfad/node_modules/playwright
export NW_CHROMIUM_EXECUTABLE=/absoluter/pruefpfad/chromium
export NEXOWATT_PROXY_BASELINE_ROOT=/absoluter/pruefpfad/NexoWatt_UI_1.0.34

node docs/reports/admin-https-2026-11-03/reproduce/verify-official-admin-proxy.cjs
node docs/reports/admin-https-2026-11-03/reproduce/verify-proxy-browser.cjs
node docs/reports/admin-https-2026-11-03/reproduce/verify-proxy-source-review.cjs
```

Standardmäßig bestimmen die Programme den Produktwurzelpfad relativ zu diesem Verzeichnis. Optional kann `NEXOWATT_PROXY_TEST_ROOT` ausdrücklich auf einen anderen entpackten Stand zeigen. Die JSON-Ergebnisse werden jeweils neben den Hilfsprogrammen geschrieben; für getrennte Rohbelege kann die Ausgabe zusätzlich in eine lokale Datei umgeleitet werden. Die Programme enthalten keine Passwörter oder privaten Schlüssel. Temporäre zufällige Kontowerte bleiben im Prozess; kurzlebige lokale Zertifikate liegen in einem nur für den Besitzer zugänglichen temporären Verzeichnis und werden regulär wieder entfernt. Es werden keine Screenshots angefertigt.

## Grenzen und Sollverhalten

Der Node-Integrationstest prüft die TLS-Gegenstelle gegen sein konkretes kurzlebiges Testzertifikat. Chromium erhält ausschließlich den SPKI-Pin dieses lokalen Testzertifikats; `ignoreHTTPSErrors` bleibt `false`. Das ist keine Abschaltung der Zertifikatsprüfung im Produkt und keine Freigabe fremder Zertifikate.

Erwartet werden neun bestandene Proxy-/EOS-Vertragsgruppen sowie ein vollständig bestandener Browserablauf: individuelles Passwort genau einmal; Installerfreigabe; sichere, instanzgebundene Cookies; EMS-App-Center; eingebettete React-Ansicht einschließlich dynamischem Stylesheet; VIS samt EventSource; Simulation; SmartHome-Konfiguration; korrekter Admin-Rückweg; keine entwichenen Root-API-/Assetpfade, Konfigurationsschreibvorgänge oder Browserausnahmen. Der Browserbericht enthält die tatsächlich geprüften Dateihashes und prüft, dass diese während des Laufs unverändert bleiben.

Der Quellenvergleich führt echte ESLint-Prüfungen gegen `1.0.34` und den gewählten Stand durch. Identische Fingerprints bedeuten unveränderte Scannerstellen, keine allgemeine Sicherheitsfreigabe. Die fünf dynamischen Dateizugriffe des neuen HTML-Senders werden im Review zusätzlich anhand von Pfadbindung, regulären Dateien, Größen-/Parallelitätsgrenzen und Ressourcenfreigabe fachlich bewertet.
