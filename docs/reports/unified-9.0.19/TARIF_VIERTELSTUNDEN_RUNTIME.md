# Tarifreihe und Laufzeit – 9.0.19

Prüfstand 24.11.2026. Dieser Nachweis betrifft die lokale Providerverarbeitung mit kontrollierten Antworten; ein Abruf eines echten Tibber-Kundenkontos wurde nicht durchgeführt.

## Nachgewiesenes Verhalten

- Die Tariflaufzeit wählt den jeweils aktuellen Viertelstundenpreis aus dem bereits validierten Cache aus. Ein Intervallwechsel benötigt keinen weiteren API-Abruf. Null- und Negativpreise bleiben fachlich gültige Zahlen; ein fehlender Preis wird nicht als 0 angenommen.
- Tibber wird jetzt ausdrücklich mit `QUARTER_HOURLY` abgefragt. Auch eine ältere gespeicherte 60-Minuten-Auswahl ändert die effektive Tibber-Auflösung nicht mehr. Der Normalisierer ergänzt Endzeitpunkte passend mit 15 Minuten. Andere Anbieter behalten ihre bisherige Auflösung; bestehende gespeicherte Einstellungen werden durch diese Laufzeitkorrektur nicht pauschal umgeschrieben.
- Bestätigter Fehler: Die bisherige Tibber-Cacheplanung konnte bei vorhandenen Morgenpreisen den nächsten Abruf auf sechs Stunden zuzüglich Jitter legen, obwohl die konfigurierte Frischegrenze standardmäßig drei Stunden betrug. Der nächste Abruf wird jetzt nach Jitter auf einen Zeitpunkt vor der bestehenden Frischegrenze begrenzt, einschließlich einer Reserve für den beschränkten Abruf und weitere Versuche. Der Kundenwert für die Frischegrenze bleibt bestehen. Dieselbe Begrenzung verhindert entsprechende geplante Lücken bei anderen Anbietern; liegt deren bisheriger Abruf innerhalb der Grenze, bleibt sein Zeitpunkt unverändert.
- Fehlgeschlagene Abrufe verlängern weder Erfolgszeitpunkt noch Frische. Wiederholungen unmittelbar vor Ablauf erfolgen höchstens einmal pro Minute. Nach tatsächlichem Ablauf werden aktuelle/durchschnittliche Preise `null` und operative Kurven leer; es wird keine künstliche Verfügbarkeit erzeugt.
- Bestätigter DST-Fehler: „morgen“ wurde bislang durch `jetzt + 24 Stunden` ermittelt. Das konnte am langen Herbsttag denselben Kalendertag oder vor der Frühjahrsumstellung einen falschen Folgetag auswählen. Jetzt wird der nächste lokale Kalendertag verwendet; 92, 96 und 100 Viertelstunden bleiben vollständig erhalten.

## Prüfungen

- `test/eos-tariff-quarter-hour-runtime.test.cjs`: fünf Verhaltenstests für Query/Normalisierung bei alten Einstellungen, 0/negative/fehlende Preise, beide DST-Grenzen, echte Provider-Ticks mit gecachten Viertelstundenwechseln, rechtzeitigen erneuten Abruf, Ausfall/Frischeablauf und unveränderte normale EnergyZero-Planung.
- Die bestehende CRA-Tarifprüfung auf den kanonischen Quellen bestand mit 23 Prüfungen, einschließlich kompletter Antwortvalidierung, Fehlerbereinigung, begrenzten HTTPS-/OAuth-Abrufen und unveränderten Erfolgszeitpunkten bei Fehlern.
- UI-Darstellung, Kunden-Speicherpfad und nachgelagerte Wallet-/EMS-Nullwertkorrekturen werden separat geprüft. Die Providerkorrektur allein ist kein Nachweis für sämtliche Anzeige- und Abrechnungspfade.
