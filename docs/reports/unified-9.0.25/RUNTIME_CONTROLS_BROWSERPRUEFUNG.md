# Prozessbedienung: Browserprüfung für 9.0.25

Prüfdatum: 25.11.2026. Gegenstand ist der Wiederherstellungsstand 9.0.25, nicht die versiegelte 9.0.24. Die SHA-256-Werte der geprüften Frontend-, HTTP-, Status- und Steuerungsquellen stehen in den zugehörigen JSON-Nachweisen unter `raw/runtime-controls/`.

## Sollverhalten und Umsetzung

Die Administrationsseite `/runtime/` bietet **Aktivieren, Deaktivieren und Neustarten** für Oberfläche/EMS, Geräte, EEBus, Sicherung und das integrierte OCPP-Modul. Alle fünf Prozessfreigaben sind ohne vorhandene Benutzereinstellung standardmäßig aktiviert. Die gewünschte, dauerhaft gespeicherte Prozessfreigabe wird getrennt vom bestätigten Prozesszustand und der EMS-Bereitschaft angezeigt. Ein noch nicht aktiviertes Modul erhält die Kennzeichnung „Modul deaktiviert“ mit Link zu seinen Einstellungen. Die bestehende Modulkonfiguration bleibt eine zusätzliche Startvoraussetzung.

Der Administrationsprozess bleibt erreichbar, auch wenn Oberfläche/EMS gestoppt wird. Externe `ocpp21`-Instanzen werden separat angezeigt und bleiben über die ioBroker-Verwaltung bedienbar; die EOS-Prozessschalter starten oder stoppen diese nicht.

Die Oberfläche übernimmt ausschließlich die serverseitig erlaubten Aktionen und sendet die aktuelle Konfigurationsrevision mit CSRF-Token. Die API prüft die Administratorberechtigung unabhängig vom Browser. Eine angenommene Aktion (HTTP 202) wird als angenommen angezeigt, nicht als abgeschlossen. Während laufender Aufträge sind weitere Aktionen gesperrt. Grün erscheint erst bei bestätigtem laufendem Prozess. Fehlende Antworten werden nicht durch automatische Wiederholung eines Schreibauftrags behandelt; stattdessen wird der tatsächliche Status erneut gelesen. Startblockaden, veraltete Einstellungen, fehlende Administratorrechte und ein unbestätigtes Prozessende erhalten verständliche Meldungen.

## Ausgeführte Prüfungen

| Prüfung | Node.js 24.22.3 | Node.js 22.23.4 |
| --- | --- | --- |
| `test/eos-runtime-controls-browser.cjs` | 13/13 bestanden | 13/13 bestanden |
| `test/eos-runtime-health-browser.cjs` | 7/7 bestanden | 7/7 bestanden |
| `test/eos-runtime-login-browser.cjs` | 4/4 bestanden | 4/4 bestanden |

Browser: `HeadlessChrome/158.0.8127.0`. Insgesamt 48 Browserfälle in sechs Läufen, ohne JavaScript-Seitenfehler. Prüfumgebung für Steuerung und Status: echtes Chromium und produktive HTML-/JS-/CSS-Dateien, produktive HTTP-Routen, `EosRuntimeControl` sowie geschützter Konfigurationsspeicher. ioBroker-Objektdatenbank, Anmeldequelle und Prozesslebenszyklen sind dort ausdrücklich synthetische Fixtures. Es wurden keine echten Geräte, Kundenkonfigurationen oder laufenden Anlagen angesprochen.

Die 13 Steuerungsfälle prüfen:

1. Fünf steuerbare EOS-Kinder; Administration und externer OCPP ausschließlich zur Anzeige; Einrichtungshinweis bei deaktiviertem Modul.
2. Fehlendes CSRF-Token wird durch die produktive API ohne Lebenszyklusänderung abgelehnt.
3. Deaktivieren speichert die Freigabe, bleibt bis zur Stop-Bestätigung beschäftigt und behauptet keinen vorzeitigen Abschluss.
4. Gespeichertes Deaktivieren bleibt nach Seitenneuladen und neuer Instanz des produktiven Konfigurationsdiensts erhalten.
5. Aktivieren zeigt zunächst „Startet“ und erst nach bestätigtem Start „Läuft“.
6. Neustarten führt über den produktiven Steuerungsdienst erst Stop, danach Start aus.
7. Eine Übernahmesperre verhindert Starts; Stop bleibt möglich und der Übernahmestatus ist verlinkt.
8. Eine zwischenzeitlich geänderte Revision verhindert einen veralteten Schreibauftrag und aktualisiert die Bedienelemente.
9. Ein nicht bestätigter Stop bleibt sichtbar unbestätigt und wird nicht als erfolgreiche Deaktivierung ausgegeben; Aktivieren und Neustarten bleiben gesperrt, ein regulärer Adapterneustart wird erklärt.
10. Oberfläche/EMS kann deaktiviert und von der weiterhin erreichbaren Administrationsseite wieder aktiviert werden.
11. Eine verlorene HTTP-Antwort führt zu einer verständlichen Meldung ohne automatische Befehlswiederholung.
12. Auf 390 Pixel Breite entstehen kein horizontaler Überlauf und keine zu kleinen Prozessschaltflächen.
13. Entzogene Administratorrechte verhindern den Schreibauftrag und entfernen bedienbare Statuskarten.

Die sieben bestehenden Browser-Regressionsfälle prüfen zusätzlich getrennte Statuskarten, tatsächliche Fünf-Sekunden-Abstände mit echten Timern, höchstens eine laufende Statusabfrage, Entfernen alter grüner Zustände bei HTTP-Fehlern, Wiederherstellung nach erfolgreicher Abfrage, Abbruch beim Verbergen der Seite, einmaliges sofortiges Aktualisieren bei Rückkehr/BFcache und Ende automatischer Abfragen bei Rechteverlust. Sichtbarkeits- und BFcache-Ereignisse werden dabei gezielt simuliert.

Die vier ergänzenden Wiederanmeldungsfälle verwenden den **produktiven Webmount, tatsächlich ausgelieferte Login-Assets und die produktive OAuth-/Sitzungsgrenze** mit synthetischer Controllerdatenbank und Testidentität. Die im Test innerhalb des Prozesses gehostete UI wird ausdrücklich gestoppt. Geprüft wird:

1. Anonymer Aufruf von `/runtime/` erreicht weiterhin das vom Administrationsprozess gelieferte Passwortformular mit `admin=1&returnTo=%2Fruntime%2F`.
2. Ein tatsächlicher Passwort-POST samt serverseitiger Sitzungsprüfung bringt den Administrator zurück zu `/runtime/`; die geschützte Prozess-API antwortet mit 200, während die UI gestoppt bleibt.
3. Die ausdrückliche Administratorabsicht verlangt auch bei vorhandener Adminsitzung weiterhin die Passworteingabe.
4. Ein korrektes Kundenpasswort führt nicht in die Prozessverwaltung; die Prozess-API antwortet für die Kundenrolle mit 403 und das Passwortfeld wird geleert.

Die Login-Zielprüfung lässt ausschließlich das gleichursprüngliche `/runtime/` für die bestätigte Adminrolle zusätzlich zu. Die vorhandene Anmeldeprüfung bleibt erhalten. Queryparameter und Hash werden nicht übernommen. Der vollständige Frontend-Vertragstest `ui/scripts/verify-auth-profiles-ui.cjs` besteht zusätzlich unter Node 22.23.4 und 24.22.3 alle **14 Prüfgruppen**; die neue Gruppe schließt Kunden, Installer und Kiosk sowie externe Ziele, API-Ziele und Unterpfade aus. Dieser ergänzende Test verwendet VM-/DOM-/HTTP-Doubles und ist kein Browsernachweis.

Die kanonische Änderung liegt in `ui/src-ts/runtime-executables/www/login.ts`; ausschließlich `ui/www/login.js` wurde mit dem unveränderten produktiven Generator in einer isolierten Ein-Datei-Umgebung erzeugt und per `--check` geprüft. Der beim erstmals typinformierten Lint auffällige bestehende asynchrone DOM-Callback ist als benannte asynchrone Funktion mit ausdrücklichem `void`-Aufruf angebunden; die Anmeldelogik bleibt gleich.

Desktop (1440 Pixel) und Mobilansicht (390 Pixel) wurden zusätzlich visuell geprüft. Karten, Zustandsmeldungen und Schaltflächen sind lesbar und überlappen nicht. Im isolierten Browserfixture wird das Logo absichtlich nicht geladen; dies ist keine Änderung der produktiven Grafik. Die Prüfbilder bleiben ausschließlich temporäre Arbeitsdateien und sind kein Lieferbestandteil.

Statische Prüfungen bestanden:

```sh
node node_modules/typescript/bin/tsc -p tsconfig.eos-runtime-health.json
node node_modules/eslint/bin/eslint.js -c eslint.runtime-health.config.mjs public/eos-runtime/index.js test/eos-runtime-controls-browser.cjs test/eos-runtime-health-browser.cjs
node node_modules/typescript/bin/tsc -p ui/tsconfig.ui-auth-frontend.json
node node_modules/eslint/bin/eslint.js -c ui/eslint.eos-session-idle.config.mjs ui/src-ts/runtime-executables/www/login.ts
node node_modules/eslint/bin/eslint.js -c eslint.runtime-health.config.mjs test/eos-runtime-login-browser.cjs
node ui/scripts/verify-auth-profiles-ui.cjs
```

Browserläufe lassen sich mit dem jeweiligen Node.js-Interpreter und einem verfügbaren Chromium wiederholen:

```sh
EOS_CHROMIUM_PATH=/pfad/zu/chromium node test/eos-runtime-controls-browser.cjs
EOS_CHROMIUM_PATH=/pfad/zu/chromium node test/eos-runtime-health-browser.cjs
EOS_CHROMIUM_PATH=/pfad/zu/chromium node test/eos-runtime-login-browser.cjs
```

Der erste Versuch mit dem allgemeinen UI-ESLint-Profil war wegen des in dieser Prüfinstallation fehlenden Pakets `eslint-plugin-security` nicht ausführbar. Für die geänderte Loginquelle wurde anschließend das vorhandene typinformierte Auth-Profil erweitert und erfolgreich ausgeführt; der blockierte allgemeine Profilaufruf gilt nicht als bestandener Security-Scan.

## Ressourcen und Grenzen

Der vorhandene Abfragetakt bleibt bei fünf Sekunden. Die Seite begrenzt sich auf eine aktive Statusabfrage, verwirft überholte Antworten nach Bedienaktionen, pausiert in unsichtbaren Tabs und entfernt laufende Abfragetimer bei Verlassen. Es wurden keine zusätzlichen Laufzeitabhängigkeiten eingeführt. Eine Verringerung des EMS-RAM-Verbrauchs wird durch diese Prüfung weder gemessen noch behauptet.

Offen bleiben der vollständige Installations-/Neustartversuch auf Dominiques Raspberry Pi mit realem ioBroker und die Geräte-/Regelungsprüfung. Für diesen Praxistest sind nach Sicherung und Installation zuerst die standardmäßig aktivierten Prozessfreigaben, tatsächliche PIDs, Gerätewerte und EMS-Bereitschaft zu prüfen. Einen konfigurierten Prozess gezielt deaktivieren, den bestätigten Stillstand abwarten, wieder aktivieren und den neuen Prozess sowie aktuelle Gerätewerte prüfen. Oberfläche/EMS erst in einem geeigneten Testfenster stoppen. Nach regulärem Adapterneustart müssen die zuvor gewählten Freigaben erhalten bleiben. Parallel laufenden externen OCPP nicht zusätzlich durch ein integriertes Modul auf demselben Port oder denselben Ladepunkten übernehmen. Bei fehlerhaften Zuständen den aktuellen Prozessstatus und bereinigte Protokollmeldungen sichern; den dokumentierten Rückfallplan des Wiederherstellungsstands verwenden.

Diese Browsernachweise belegen die genannten Bedien- und HTTP-Verträge. Sie sind kein Nachweis für reale Stellbefehle, Hardware-Abschaltzeiten, Dauerbetrieb oder eine allgemeine Produktionsfreigabe.
