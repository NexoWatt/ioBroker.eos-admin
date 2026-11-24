# Login- und Home-Bildschirm-Logo

Stand: 9.0.20, 24.11.2026. Diese Änderung verwendet ausschließlich bereits vorhandene NexoWatt-PNGs. Es wurden keine neuen Logos erzeugt und keine Bildpixel verändert.

## Umgesetzte Frontendkorrektur

- Der Anmeldekartenbereich zeigt das vorhandene 192-Pixel-NexoWatt-Emblem oberhalb der Überschrift zusätzlich zur bisherigen Wortmarke. Ein eigenes 64×64-Element mit `object-fit: contain` zeigt es ohne Positionierung oder Beschneiden durch den Wortmarkenrahmen. Es bleibt während der Sitzungsermittlung sichtbar.
- Die zwölf vorhandenen Webapp-Seiten einschließlich Login und Dashboard sowie die Quellseite der EOS-Konsole deklarieren einheitlich das vorhandene 180×180-PNG als `apple-touch-icon`. Die URL ist `/assets/icons/nexowatt-180.png?v=083e11ab28ec`; der Cache-Schlüssel entspricht den gelieferten Bildbytes.
- Dieses 180-Pixel-PNG wurde bytegleich in das bisher fehlende `src-admin/public/assets/icons/`-Verzeichnis kopiert. Der bestehende Build-Rebaser erkennt es jetzt ausdrücklich, damit Vite daraus keinen geschützten `/system/assets/...`-Iconpfad macht.
- Die ursprüngliche hochauflösende Datei und `/apple-touch-icon.png` bleiben unverändert (1024×1024). Manifest, App-Identität, Start-URL und Scope wurden nicht geändert. Die bestehenden Sitzungs-, Passwort- und Lizenzprüfungen bleiben bestehen.

## Nachweis und klare Grenzen

Apple dokumentiert 180×180 für das Retina-iPhone-Webclip-Symbol und einen Größen-Fallback, falls nur größere Symbole vorhanden sind. Deshalb war die bisherige 1024-Deklaration allein **kein nachgewiesener iPhone-Fehler**. Die neue Deklaration macht die vorhandene passende Größe explizit und erhält das Original. Quelle: [Apple Safari Web Content Guide – Configuring Web Applications](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html), geprüft am 24.11.2026.

Ein Authentifizierungsblocker für das bisherige Icon wurde bei der anfänglichen Routenprüfung nicht nachgewiesen. Die ergänzten tatsächlichen anonymen TLS-/Routentests werden separat von der Backendprüfung dokumentiert. Diese Frontendprüfung belegt HTML-Links, Bildidentität, Abmessungen und bestehende Proxyprojektion, keinen physischen iPhone-Installationsversuch. Auf einem bereits installierten Home-Bildschirm kann ein zuvor gespeichertes Symbol weiterhin aus dem Gerätebestand stammen; dessen Aktualisierung wurde hier nicht getestet. Zertifikatsvertrauen auf Kundengeräten wurde nicht verändert.

## Prüfungen

`test/eos-login-pwa-branding.test.cjs`: 5/5 unter Node22.23.4 und24.22.3. Geprüft werden tatsächliche HTML-Quellen, unveränderte Bildhashes, genau eine Touch-Icon-Deklaration, richtiger öffentlicher Pfad samt Cache-Schlüssel, sichtbares Formularlogo, die echte Console-Build-Rebasefunktion und der vorhandene validierte Legacy-Proxy-HTML-Rewriter. Kein neuer Proxy-Scope oder Service Worker wurde eingeführt.

Belege: `login-pwa-branding-node22.txt`, `login-pwa-branding-node24.txt`, `login-pwa-branding-hashes.txt`. `node --check src-admin/build-tools/eos-public-assets.mjs` bestanden.

| Asset | SHA-256 |
|---|---|
| Bestehendes 180-Pixel-Symbol | `083e11ab28ec00b37d3d47776946c5fad4d79277fdc440cdbb20181a7f064f76` |
| Unverändertes hochauflösendes Original und Root-Fallback | `952ceb9cef3f7f22a150dd8ea396285f70b9d8c19de8e7c1452bf2ff983ae6bd` |

Der abschließende Konsolenbuild hat `src-admin/index.html`, den ergänzten Public-Assetpfad und den Rebaser übernommen; der Lauf vom 24.11.2026 um 21:04 UTC ist in `raw/frontend-build.result.json` belegt. Generierte `adminWww`-Dateien wurden nicht direkt bearbeitet.
