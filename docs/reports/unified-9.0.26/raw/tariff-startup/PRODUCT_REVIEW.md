# Tarifstart: unabhängiger Produktcode-Review

Stand: 25.11.2026. Geprüft wurden die positive Hydrationsmarkierung und die Tarif-API in `ui/src-ts/runtime-executables/main.ts` sowie `ui/src-ts/runtime-executables/www/customer-tariff.ts`. Der Reviewer hat diese Produktänderungen nicht implementiert. Er hat den ergänzenden Chromium-Test geschrieben; dessen Ergebnisse sind deshalb keine zweite unabhängige Testimplementierung.

## Ergebnis

Kein blockierender Befund im geprüften Tarifstartfix.

- `_nwInstallerConfigHydrated` wird zu Beginn der Hydration und des Betriebsstarts gelöscht. Erst nach erfolgreichem Laden, Validieren und gegebenenfalls benötigtem Erstcommit wird die Markierung gesetzt. Ein fehlgeschlagener Lese-/Parse-/Erstschreibvorgang erreicht diese Freigabe nicht.
- Die Kunden-Tarifroute verlangt diese positive Markierung sowohl für GET als auch PUT. `idle`/`starting` liefert den festen Fehler `EOS_TARIFF_CONFIG_LOADING`; ein gescheiterter Start liefert `EOS_TARIFF_CONFIG_UNAVAILABLE`. Es wird kein vermeintlich bestätigter Standardtarif ausgeliefert. Rollen-/Lizenzprüfung, zentrale Authentifizierung/CSRF und Schreibsperre beim Systemstart bleiben vorgeschaltet.
- Die Lesefreigabe hängt nach erfolgreicher Hydration nicht von vollständiger EMS-Bereitschaft ab. Bei späterem, sachlich unabhängigem EMS-Fehler bleiben die gespeicherten Tarife lesbar. Schreibfreigaben werden dadurch nicht erweitert.
- Das Frontend wiederholt ausschließlich den noch nicht bestätigten initialen GET und ausschließlich bei dem festen Loading-Code: insgesamt höchstens sechs Versuche, jeweils zwei Sekunden Abstand. Ein vorhandener View oder Entwurf verhindert diese Wiederholungen. Permanente Fehler sowie PUT werden nicht wiederholt.
- Zu jeder Zeit bestehen höchstens ein aktiver Lesevorgang und ein Wartetimer pro Tarifbereich. Schließen oder `pagehide` bricht den Controller und den zugehörigen Timer ab. Ein verspätetes Ergebnis eines abgebrochenen Lesevorgangs wird nicht gerendert. Der alte `finally`-Block kann einen inzwischen neu gestarteten Lesevorgang nicht entsperren.
- Fehlgeschlagene Speicheranfragen ersetzen weder die bestätigte Revision noch Eingaben oder eingegebene Zugangsdaten. Zugangsdaten werden wie zuvor beim Verlassen der Seite entfernt. Nur eine erfolgreiche Antwort oder ein ausdrücklich bestätigtes Neuladen darf den Formularstand ersetzen.

## Nachweise

Der ursprüngliche Anzeigefehler wurde vor dem Fix mit der produktiven HTTP-Route und einer synthetischen historischen Tibber-Konfiguration nachvollzogen: während des Startfensters HTTP 200 mit `manual-dp`/`false`, nach Hydration HTTP 200 mit `tibber`/`true`; der gespeicherte Konfigurationsstate blieb unverändert. Das belegt einen Anzeigeverlustpfad, nicht einen tatsächlichen Verlust der Kundendatenbank.

Der unabhängige Wiederholungslauf unter Node 24 bestand mit **27/27 Tests**:

```sh
node --test test/eos-customer-tariff-api.test.cjs test/eos-customer-tariff-ui.test.cjs test/eos-customer-tariff-process-persistence.test.cjs
```

Rohlog: `independent-review-node24.log`. Der Prozessfall verwendet den echten UI-Kindprozess und hält den Konfigurationslesevorgang während eines vollständigen Neustarts kontrolliert an.

Die separaten Chromium-Nachweise enthalten je **6/6 Prüfgruppen** unter Node 22.23.4 und Node 24.22.3, jeweils ohne Browserfehler. Rohberichte: `node22-browser.json` und `node24-browser.json`. Quellhashes wurden jeweils vor und nach dem Lauf verglichen. Gemessene erste Wiederholung: 2016 beziehungsweise 2018 ms. Der Frontendtest verwendet eine synthetische API und ersetzt nicht den echten Prozess-/Persistenztest.

Die Prüfung verwendet ausschließlich synthetische Konfigurationen. Sie belegt keine reale Tibber-Verbindung oder Abnahme der Raspberry-Pi-Anlage. Der Fix verhindert die nachgewiesene Bestätigung eines noch nicht geladenen Standardtarifs; ein bislang nicht nachgewiesener weiterer Verlustpfad wäre separat zu untersuchen.
