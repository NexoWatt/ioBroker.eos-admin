# Kiosk-Frontend — unabhängige Browser- und Regressionsprüfung

Prüfstand: 25.11.2026. Die Umsetzung von Auth, Login, Idle-Client, Kiosk-Settings und Settings-Markup stammt vom Root-Agent; diese Prüfung hat diese Produktdateien nicht verändert.

## Ergebnis

**8 Browserabläufe bestanden**, jeweils unter Node.js **24.22.3** und **22.23.4** mit echtem Headless Chromium **158.0.8127.0**. Die beiden Läufe beziehen sich auf identische Produktdatei-Hashes. Der Runner prüft zusätzlich, dass sich diese Dateien während des jeweiligen Browserlaufs nicht verändern.

1. Die echte Settings-Seite zeigt den gespeicherten ausgeschalteten Zustand und einen freigegebenen Admin-Button. Der vom Nutzer nicht mehr gewünschte Bestandsübernahme-/Migrationseinstieg fehlt ausdrücklich.
2. Aktivieren sendet `PUT /api/eos/kiosk` mit korrekter Revision und CSRF, persistiert den Zustand und entzieht der vorherigen Admin-Sitzung ihre Autorität. Danach öffnet sich das begrenzte Kiosk-Dashboard.
3. Ohne Benutzereingabe bleibt der Kiosk nach **660.001 ms Chromium Virtual Time** offen. Das sind elf Minuten ausgeführte Browserzeit, kein elfminütiger Echtzeit-Dauerlauf.
4. „Admin öffnen“ funktioniert auch bei 390 Pixel Breite und öffnet `/login.html?admin=1&returnTo=/system/` mit der echten Zugangsdatenmaske. Es entsteht keine Kiosk-Weiterleitungsschleife.
5. Ein normaler angemeldeter Kunde bleibt auf dieser Admin-Zugangsdatenmaske und erhält für die Admin-Konfiguration HTTP 403.
6. Deaktivieren persistiert `enabled:false` mit der nächsten Revision und zeigt erst danach den bestätigten ausgeschalteten Status.
7. Eine bereits geöffnete, getrennte Tablet-Browsersitzung mit Kiosk-Cookie sperrt beim nächsten serverseitigen Recheck nach der Deaktivierung; ihre Dashboard-API liefert 401.
8. Das alte Kiosk-Cookie kann die Seite nach Deaktivierung auch bei erneutem Öffnen nicht wieder freigeben; die echte Anmeldung erscheint.

Keine JavaScript-Seitenfehler in beiden Läufen.

## Tatsächlicher Prüfumfang

`test/eos-kiosk-browser.cjs` verwendet Produktions-TS für `runtime-base`, `auth`, `login`, `eos-session-idle` und `eos-kiosk-settings`, im Speicher transpiliert. Login- und Settings-Markup stammen unverändert aus dem Produkt. Die kleine Dashboard-Hülle dient ausschließlich dazu, die Sichtbarkeit und Auth-/Idle-Grenze zu prüfen. Nicht beteiligte Tarif-/Update-/Telemetrieskripte der Settings-Seite werden in dieser Fixture ausgelassen.

Die HTTP-Grenze ist tatsächlich `Web.mountUnifiedRuntime`, `EosKiosk`, `UnifiedSessions`, das gepinnte OAuth-Modell und `EosSessionSecurity`; CSRF, Kiosk-Cookies, Rollenprüfung, Revision/Persistenz und Entzug werden durch diesen Produktcode durchlaufen. Controller-Persistenz, Passwort-/Gruppenabfrage sind Testdoubles. Der UI-Prozess wird über den bestehenden In-Process-Testeingang geladen; separate Prozessisolation und reales OCPP-Gerät sind nicht Gegenstand dieses Browsernachweises.

## Regressionen

Auf beiden Node-Linien bestanden zusätzlich:

- **32/32 Tests**: `eos-unified-idle-client.test.cjs`, `eos-idle-integration.test.cjs`, `eos-login-pwa-branding.test.cjs`. Darunter die bisherige Zehn-Minuten-Frist echter Sitzungen, echte Bedienung/CSRF, mehrere Tabs, Offline/BFCache, SSE-Sperre, sowie vier neue Kiosk-Prüfungen: 30 Minuten kontrollierte Clientzeit ohne Aktivitätswrites, Disable/Offline, geschützte alte Admin-DOMs und unveränderte echte Admin-Frist.
- **13/13 Auth-Profil-Prüfgruppen** aus `verify-auth-profiles-ui.cjs`. Neue Fälle zeigen die Passwortmaske bei expliziter Adminabsicht selbst mit vorhandener Admin-Sitzung; erst bestätigtes Passwort-POST als Admin darf `/system/` öffnen. Ein erfolgreich angemeldeter Kunde erhält dadurch keine Adminrechte. Ungültige Kiosk-Identitäten mit Konto, Adminrolle oder technischen Capabilities bleiben gesperrt.

Die bestehende Idle-Testfixture musste die nun absichtlich ergänzte Query `?admin=1` auf geschützten Seiten akzeptieren. Sie prüft fachlich weiterhin den URL-Pfad und jetzt zusätzlich die tatsächliche geschützte Query sowie den Admin-Login-Rücksprung. Die Frist wurde nicht abgeschwächt.

## Belege und Wiederholung

- `raw/kiosk-browser-node24.json`, `raw/kiosk-browser-node22.json`: Browserdaten, acht Ergebnisse, Fehlerliste und tatsächliche Produktdatei-Hashes.
- `raw/kiosk-idle-node24.log`, `raw/kiosk-idle-node22.log`.
- `raw/kiosk-auth-profiles-node24.log`, `raw/kiosk-auth-profiles-node22.log`.

Befehle:

```sh
EOS_CHROMIUM_PATH=/pfad/zu/chromium node test/eos-kiosk-browser.cjs
node --test test/eos-unified-idle-client.test.cjs test/eos-idle-integration.test.cjs test/eos-login-pwa-branding.test.cjs
node ui/scripts/verify-auth-profiles-ui.cjs
```

Es wurden keine realen Zugangsdaten oder Anlagengeräte verwendet. Der Nachweis ist ein lokaler Funktions-/Regressionsstand und keine allgemeine Sicherheitszertifizierung oder Garantie für jede Tablet-/Netzwerkumgebung.
