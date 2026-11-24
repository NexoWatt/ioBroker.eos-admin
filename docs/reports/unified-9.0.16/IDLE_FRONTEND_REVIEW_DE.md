# Gemeinsame Inaktivitätsabmeldung – Frontend-Nachprüfung

Stand: 23.11.2026, NexoWatt EOS 9.0.16. Technischer Teststand; kein Anlagen- oder Smartphone-Abnahmenachweis.

Der gemeinsame Client `ui/src-ts/runtime-executables/www/eos-session-idle.ts` meldet ausschließlich vertrauenswürdige Pointer-, Tastatur-, Touch- und Wheel-Ereignisse. Gedrückte Pointer werden auch in gleichursprünglichen Konfigurationsframes erkannt. Sichtbarkeit, Fokus, Status-GETs und Nachrichten anderer Tabs erneuern keine Sitzung. Die verbindliche Ablaufzeit, die Prüfung von Zugriffstoken/Refresh und die Sperre offener Verbindungen liegen im Server. Der Client ruft ausschließlich die drei festen Endpunkte `/api/auth/idle`, `/api/auth/activity` und `/api/auth/expire` auf. Er greift weder auf Gerätebefehle noch auf den EMS-Lebenszyklus zu.

Antworten sind auf 16 KiB und fünf Sekunden begrenzt; der Serververtrag wird zur Laufzeit geprüft. Die Darstellung wird bei erreichtem Ablauf vor der asynchronen Nachprüfung verdeckt. Eine noch aktive gemeinsame Sitzung aus einem anderen Tab kann durch diese Nachprüfung bestätigt werden. Unabhängige Anmeldungen werden nicht durch eine Frontend-Nachricht abgemeldet. BroadcastChannel transportiert nur die öffentliche Familienkennung; jede Nachricht veranlasst höchstens eine serverseitige Statusprüfung. Zugangsdaten und Sitzungsbefugnisse werden nicht im Browser-Speicher abgelegt.

Die expliziten Script-Einbindungen gelten für angemeldete EOS-Seiten einschließlich Admin, Installer, Geräte, EEBus, Backup, Lizenz, Zertifikate und Bestandsübernahme. Die Anmeldeseite sowie das bestehende DC-Stationsdisplay mit eigenständigem Maschinentoken bleiben ausgenommen. Die schmalen Ausnahmen im URL-Mapper und im Auth-Fetch-Wrapper halten exakt die gemeinsame Scriptdatei bzw. die drei API-Endpunkte beim EOS-Owner. Fachliche API-Schreibzugriffe bleiben unverändert geschützt.

## Bestehende Scanner-Fundstellen

Vergleich mit dem unveränderten ausgelieferten Repository-ZIP 9.0.15:

- `src-ts/runtime-executables/main.ts`: ausschließlich zwei feste `<script defer src="/eos-session-idle.js">`-Einbindungen in vorhandenen HTML-Antworten. Die neun bereits einzeln geprüften Scanner-Vorkommen dieser Datei wurden nicht geändert. Ihre Fingerprints, Anzahl, Begründungen und ursprünglichen Nachweise bleiben erhalten.
- `src-ts/runtime-executables/lib/runtime-proxy-html.ts`: ausschließlich die exakt verankerte Ausnahme für `/eos-session-idle.js` einschließlich optionaler Query. Sie verwendet weder fremde Hostnamen noch einen neuen Dateizugriff. Die fünf bereits geprüften Vorkommen bleiben unverändert; deren Fingerprints, Anzahl, Begründungen und ursprünglichen Nachweise bleiben erhalten.

Nur die gedruckten Code-Hashes dieser beiden bisherigen Einzelreviews werden nach diesem Vergleich aktualisiert. Die historische Baseline wird nicht angepasst. Neue Fundstellen benötigen weiterhin eine eigene Bewertung oder Korrektur.

## Ausgeführte gezielte Prüfungen

- `node --test test/eos-unified-idle-client.test.cjs`: 18 Prüfungen bestanden, darunter exakte Ablaufgrenze, echte und synthetische Eingaben, gebündelte letzte Eingabe, parallele Tabs, fremde Familiennachrichten, Offline-/BFCache-Rückkehr, CSRF-Rotation kurz vor Ablauf, Konfigurationsframes, doppelte Initialisierung, gesperrter BroadcastChannel, HTML-Abdeckung und Instanzproxy.
- `node ui/scripts/verify-auth-profiles-ui.cjs`: elf Prüfgruppen bestanden; einschließlich Idle-Zugriff vor abgeschlossenem Seiten-Bootstrap, unveränderter eigener CSRF-Nachweis und weiterhin gesperrte Fachmutationen ohne Anmeldung.
- Strikte Frontend-TypeScript-Prüfung und `ui/eslint.eos-session-idle.config.mjs`: bestanden.
- `EOS_TEST_RUNTIME=build node --test test/eos-unified-idle-client.test.cjs`: dieselben 18 Prüfungen bestanden gegen das tatsächlich erzeugte `ui/www/eos-session-idle.js`, einschließlich der erzeugten Admin-/Installer-HTML-Einstiege.
- `node ui/scripts/verify-eslint-security-test.cjs`: 27 negative und positive Prüfungen der Scanner-Grenzen bestanden.

VM-/DOM-/HTTP-Doubles ersetzen keinen realen Browser. Der abschließende Releasebericht enthält die Prüfungen der erzeugten Dateien und den vollständigen Scannerlauf. Die Abmeldung in den vorgesehenen Smartphone-Browsern und der laufende EMS-Betrieb auf dem Zielgerät bleiben Teil des dokumentierten Gerätetests.
