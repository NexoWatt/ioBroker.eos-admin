# Gespeicherte Tarifanbindung während eines Neustarts

Befund `EOS-926-TARIFF-STARTUP`: Die frühe Tarif-API konnte bereits HTTP 200 mit der nativen Standardquelle „Vorhandene Datenpunkte“ und ausgeschaltetem Direktabruf liefern, während der gespeicherte Installerstand noch geladen wurde. Das Kundentarifpanel übernahm diesen ersten erfolgreichen Snapshot und las ihn danach nicht selbst erneut. Dadurch konnte ein unverändert gespeicherter Tibber-Anbieter nach einem Neustart als verschwunden erscheinen.

Der Fehler wurde vor der Änderung mit einem echten UI-Unterprozess in beiden unterstützten Namespaceformen reproduziert: Nach bestätigtem Tibber-Speichern wurde der gesamte Besitzer neu erstellt und der Datenbank-Lesezugriff gezielt angehalten. Der frühe GET lieferte 200 statt 503, obwohl im Controller-Teststore weiterhin Tibber gespeichert war. Diese Reproduktion belegt einen Anzeige-/Initialisierungsfehler. Sie beweist nicht, dass jeder auf der Kundenanlage beobachtete Verlust ausschließlich diese Ursache hatte.

## Änderung

`loadInstallerConfigFromState` setzt eine positive Hydrationsmarkierung erst nach erfolgreichem Laden, Validieren und gegebenenfalls bestätigter Erstpersistenz. Beim Start und vor einem erneuten Laden ist diese Markierung gesperrt. Beide Tarifmethoden, GET und PUT, verlangen die positive Markierung zusätzlich zu ihren bestehenden Rechte-, Lizenz-, CSRF- und Revisionsprüfungen. Ein früher GET enthält keine Konfiguration, sondern 503 mit `EOS_TARIFF_CONFIG_LOADING`. Nach einem fehlgeschlagenen Laden wird kein Standardstand als gespeicherter Tarif ausgegeben. Bereits erfolgreich geladene Einstellungen bleiben bei einem späteren unabhängigen EMS-Fehler lesbar.

Das geöffnete Tarifpanel wiederholt ausschließlich den noch unbestätigten ersten GET bei genau diesem Ladecode: höchstens sechs Versuche insgesamt mit zwei Sekunden Abstand, jeweils seriell. Währenddessen bleiben Formular und Speichern gesperrt. Nach erfolgreichem Laden wird Tibber angezeigt, ohne einen weiteren Klick zu verlangen. Schließen und `pagehide` brechen den ausstehenden Lesezugriff bzw. Wartetimer ab. Normale Fehler, fehlende Rechte, vorhandene Ansichten und Benutzerentwürfe werden nicht automatisch neu geladen; PUT wird niemals wiederholt. Nach ausgeschöpftem Ladeversuch bleibt „Neu laden“ verfügbar.

Die bisherigen Speicherwege, Anbieterzugänge, Zuordnungen, Geheimnisbehandlung und Anlagenschalter bleiben unverändert. Es erfolgt keine Konfigurationsmigration und kein zusätzlicher periodischer Abruf. Der neue vorübergehende Lesepfad hält maximal einen Wartetimer und einen aktiven Request; nach Erfolg, Fehler oder Abbruch verbleibt kein Wiederholungs-Timer. Für einzelne Requests gilt weiterhin die vorhandene Zeitgrenze von 15 Sekunden. Daraus wird keine gemessene RAM-Einsparung auf dem Raspberry Pi abgeleitet.

## Prüfung

Unter Node 22.23.4 und 24.22.3 bestanden jeweils **58/58 Tarifprüfungen**. Der neue `test/eos-customer-tariff-process-persistence.test.cjs` startet die produktive UI-Laufzeit in echten Node-Unterprozessen mit produktivem Parent/Worker-IPC und produktiven HTTP-Routen. Nur Controller-Datenbank, Sitzungsautorität und Instanz-Datenverzeichnis sind lokale Testvorrichtungen. Ausgehende Anbieterabrufe sind gesperrt; es wurden synthetische Zugangsdaten verwendet.

Der Prozessnachweis prüft:

- Ein erfolgreicher Customer-PUT wird erst nach dem wirklichen Parent-State-Commit beantwortet.
- Der gespeicherte Anbieter, die Aktivierung und der geheime Zugang bleiben nach UI-Prozesswechsel erhalten.
- Nach vollständigem Stop werden beide Controller-Testdatenbanken serialisiert, neu aufgebaut und mit einem neuen Besitzer samt nativen Standardwerten geladen. Der gespeicherte Tibberstand hat weiterhin Vorrang.
- Ein während dieser echten Startphase angehaltener Konfigurationsread erlaubt weder eine bestätigte Defaultansicht noch ein überschreibendes PUT.
- Nach Freigabe des Reads zeigt GET erneut Tibber mit bestätigter Zugangsdaten-Präsenz. HTTP-Antworten und Protokolle enthalten den geheimen Testwert nicht; der Konfigurationsstate behält ACL `0x600`.
- Ein zusätzlich provozierter Datenbank-Lesefehler beim nächsten vollständigen Neustart liefert weiterhin 503 ohne Defaultkonfiguration; der gespeicherte Tibberstand bleibt exakt unverändert.
- Dieselben Abläufe gelten für `eos-admin.0` und einen erhaltenen `nexowatt-ui.3`-Namespace.

Zusätzliche produktive HTTP-Tests prüfen gesperrtes PUT auch bei irrtümlich als bereit markiertem Startup ohne positive Hydration sowie lesbare gespeicherte Tarife bei unabhängigem EMS-Degraded. Die bestehenden API-, Credential-, Forecast-, Preiswert-, Revision-, Fehler- und Update-Regressionsprüfungen bleiben grün.

Der separate echte Chromium-Test `test/eos-customer-tariff-startup-browser.cjs` verwendet das produktive Frontendskript und den unveränderten Tarifbereich aus `settings.html` gegen eine synthetische Start-/Fehler-API. Unter beiden Nodeversionen bestanden **6/6 Prüfgruppen**, ohne Browserfehler. Gemessene Folgeabrufe erfolgten nach 2016 bzw. 2018 ms. Er prüft zusätzlich Abbruch, sechs Gesamtversuche, unveränderte Entwürfe samt Eingabetoken, exakt einmaliges PUT und manuelles Wiederladen. Strenger Frontend-Typecheck und ESLint bestanden.

Belege: [`raw/tariff-startup/node22-tests.log`](raw/tariff-startup/node22-tests.log), [`node24-tests.log`](raw/tariff-startup/node24-tests.log), [`node22-browser.json`](raw/tariff-startup/node22-browser.json), [`node24-browser.json`](raw/tariff-startup/node24-browser.json). Browserberichte binden den geprüften Stand an vor und nach dem Lauf verglichene Quellhashes. Die abschließenden echten Prozessfälle einschließlich absichtlich fehlgeschlagenem Read bestanden unter beiden Nodeversionen erneut; [`process-verification.json`](raw/tariff-startup/process-verification.json) bindet diese Läufe an die unveränderten produktiven Parent-/Worker-/UI-Dateien. Zwei getrennte Codeprüfungen fanden keine blockierenden Befunde; der zweite Prüfer führte zusätzlich 27 API-/Frontend-/Prozessfälle erfolgreich aus, siehe [`PRODUCT_REVIEW.md`](raw/tariff-startup/PRODUCT_REVIEW.md).

```sh
node --test test/eos-customer-tariff*.test.cjs
node node_modules/typescript/bin/tsc -p ui/tsconfig.customer-tariff-ui.json
node node_modules/eslint/bin/eslint.js -c ui/eslint.customer-tariff-ui.config.mjs ui/src-ts/runtime-executables/www/customer-tariff.ts
EOS_CHROMIUM_PATH=/pfad/zu/chromium node test/eos-customer-tariff-startup-browser.cjs
```

Ein realer Tibber-Cloudabruf, ein vollständiger ioBroker-Controller-Daemon und der Raspberry Pi der Kundenanlage waren nicht Teil dieses Nachweises. Für den Anlagentest: Tibber speichern, bestätigten Status prüfen, Adapter neu starten und das Tarifpanel bereits während des Starts öffnen. Zuerst muss der Ladehinweis erscheinen, anschließend der gespeicherte Anbieter; bei längerer Startphase kann bewusst „Neu laden“ verwendet werden. Kein erneutes Eintragen des Tokens sollte nötig sein. Bei weiterhin abweichendem Anbieter sind tatsächlicher Namespace, Startstatus und zeitlicher Ablauf zu prüfen, ohne Tokens zu veröffentlichen.
