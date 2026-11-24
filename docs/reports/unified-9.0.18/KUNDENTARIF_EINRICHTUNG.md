# Dynamischen Tarif in den Kundeneinstellungen einrichten

Unter **Einstellungen → Dynamische Zeittarife → Stromtarif verbinden** lässt sich die Preisquelle direkt einrichten. Der Tarif gilt gemeinsam für die EOS-Anlage, nicht getrennt für einzelne Benutzerkonten.

1. Land und Tarifquelle wählen. Die Liste berücksichtigt Deutschland beziehungsweise die Niederlande.
2. Nur die passenden Zugangsdaten eintragen: Tibber benötigt einen Access Token, ENTSO-E einen Security Token; die öffentliche EnergyZero-Preisquelle benötigt keinen Token. Bei mehreren Tibber-Haushalten die passende Home-ID angeben.
3. Bei **Anbieterprofil** zusätzlich Marktpreisquelle und Anbieterprofil wählen. Diese Profile berechnen Preise aus einer Marktpreisquelle und den eigenen Vertragsbestandteilen; sie sind keine direkte Anmeldung beim ausgewählten Stromanbieter.
4. Bei Bedarf **Vertragliche Preisbestandteile** öffnen und die Werte aus dem Vertrag eintragen. Beträge sind in **€/kWh** beschriftet; die Mehrwertsteueroption verhindert eine ungewollte erneute Berechnung, wenn die Preise bereits Mehrwertsteuer enthalten. Ein Anbieterprofil führt keinen Vertragsabgleich durch.
5. **Preise direkt abrufen** schaltet den Providerabruf ein. **Diese Preise im EOS verwenden** ist die ausdrückliche Auswahl, die vier Tarif-Lesewerte mit der bestehenden Tarifverwendung zu verbinden. Anschließend **Tarifanbindung speichern** wählen.

Das Speichern der Tarifquelle aktiviert keine zusätzliche EMS-App und verändert keine Betriebsfreigaben, Anlagenlimits oder den Tarif-Regelmodus. Der bestehende Tarif-Schalter der Kundeneinstellungen bleibt separat. Ein bestätigter Speicherstand und ein erfolgreicher Preisabruf sind unterschiedliche Ergebnisse; darunter wird der tatsächliche Abrufstatus einschließlich verfügbarer letzter Aktualisierung angezeigt. **Gespeicherten Tarif laden** aktualisiert die Anzeige und fragt vorher, falls noch ungespeicherte Eingaben vorhanden sind.

Gespeicherte Zugangsschlüssel werden nicht angezeigt. Bei unverändertem Anbieter und unveränderter vertrauenswürdiger Preisquelle bedeutet ein leeres Tokenfeld **beibehalten**. Ein Wechsel des Anbieters oder der Preisquelle verlangt eine erneute ausdrückliche Token-Eingabe, auch beim Wechsel von direktem ENTSO-E zu einem Anbieterprofil mit ENTSO-E. Alte Zugangsdaten werden nicht als Token der neuen Verbindung verwendet. Ein Formularfehler oder Versionskonflikt verwirft die Eingaben nicht und sendet den Schreibvorgang nicht automatisch erneut.

Vorhandene Ostrom-, benutzerdefinierte REST- oder anderweitig speziell eingerichtete Anbindungen erscheinen als **vom Installateur eingerichtet**. Sie bleiben erhalten. Der Kunde kann bewusst auf eine angebotene direkte Quelle wechseln; technische Endpunkte, beliebige URLs und Experteneinstellungen werden in diesem Formular nicht angeboten. Die bestehende Expertenkonfiguration im App-Center bleibt verfügbar.

Die Geräte- und Messwertzuordnung ist in [Geräte direkt dem EMS zuordnen](GERAETE_EMS_EINRICHTUNG.md) beschrieben. Eine Tarifquelle allein verbindet noch keine Wallbox und erteilt keine Speicher-Betriebsfreigabe.

## Prüfstand

- `node --test test/eos-customer-tariff-ui.test.cjs`: 13 DOM-/API-Vertragstests bestanden.
- `node_modules/.bin/tsc -p ui/tsconfig.customer-tariff-ui.json`: strikte Typprüfung bestanden.
- `node_modules/.bin/eslint -c ui/eslint.customer-tariff-ui.config.mjs ui/src-ts/runtime-executables/www/customer-tariff.ts`: typisiertes Linting bestanden.

Die Prüfungen decken gezielte Tarifänderungen ohne gesamte App-Center-Konfiguration, den Secret-Erhalt bei unverändertem Anbieter und unveränderter Quelle, erneute Token-Eingabe bei Anbieter-/Quellwechsel, geschützte Installateurkonfigurationen, explizite Preiszuordnung, sichere Textanzeige, Konflikte und fehlgeschlagene Anmeldungen ohne Schreibwiederholung ab. Der Fall direkter ENTSO-E zu Anbieterprofil mit ENTSO-E prüft zusätzlich die tatsächlichen Backend-Funktionen: ohne neue Eingabe blockiert die Oberfläche, mit neuer Eingabe akzeptiert die Backendvalidierung den gezielten Patch. Die vorhandene Authentifizierungsschicht und die dedizierte Backend-API prüfen Sitzung, CSRF, Rolle und Lizenz separat; diese DOM-Fixture ersetzt deren HTTP-Backendtests nicht.

Ein echter grafischer Browsernachweis ist in dieser Umgebung weiterhin offen: Chromium wurde bereits vor dem Seitenaufruf durch `socket() Operation not permitted` blockiert. Es wurden keine echten Providerkonten verwendet und keine reale Vertrags-/Preisabrechnung bestätigt. Die Backend- und Gesamtprüfungen stehen im Releasebericht.
