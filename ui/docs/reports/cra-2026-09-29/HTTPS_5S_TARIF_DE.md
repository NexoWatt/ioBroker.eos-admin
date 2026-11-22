# Tarifabruf: HTTPS, 5-Sekunden-Budget und Datentriage

Änderung UI-CRA-NET-04 / NW-HTTPS-5S, NexoWatt UI 1.0.22, 29.09.2026.
Dieser Nachweis ergänzt den ursprünglichen Tarif-Transporttest. Er bescheinigt
weder eine CRA-/IEC-Zertifizierung noch eine Freigabe der konkreten Anlage.

## Änderung und Risiko

Die bisherige Tarifregistry konnte bis zu 30 Sekunden je HTTP-Aufruf warten;
OAuth-Token und Preisabruf hatten getrennte Budgets. Außerdem wurden teilweise
falsche Zeilen entfernt oder Zahlen aus Strings konvertiert. Eine verbliebene
Teilantwort konnte dadurch als neuer erfolgreicher Abruf erscheinen.

`fetchProvider` setzt jetzt ein gemeinsames Budget von höchstens **5.000 ms**
für die vollständige Abfrage: OAuth-Token, DNS/Verbindung, Antwort-Header,
Antwortkörper und Normalisierung. Kürzere konfigurierte Fristen bleiben möglich.
Ein gemeinsames `AbortSignal` beendet die Übertragung; ein zusätzliches
`Promise.race` gibt auch bei einem nicht kooperierenden Transport einen Fehler
zurück. Nach dem Parsing wird die monotone Frist nochmals geprüft. Keine
synchronen Wartezeiten und keine zusätzlichen Wiederholungen innerhalb des
Abrufs. Die vorhandenen späteren Wiederholungen mit Backoff bleiben erhalten.

Alle Providerpfade verlangen HTTPS ohne Redirects und verwenden die normale
Zertifikatsprüfung von Node.js. HTTP-Endpunkte, auch bisher öffentliche oder
lokale Custom-REST-Endpunkte, werden mit `provider_https_required` abgelehnt.
Bestehende HTTP-Konfigurationen müssen auf einen korrekt abgesicherten
HTTPS-Endpunkt umgestellt werden. Request: höchstens 64 KiB; dekodierte Antwort:
höchstens 2 MiB. Es wurde keine zusätzliche HTTP-/Axios-Abhängigkeit eingebaut.

## Validierung vor ioBroker-States

Die Registry schreibt selbst keine States. Sie gibt eine Antwort nur zurück,
wenn sämtliche Preisintervalle gültig sind:

- JSON-Preise sind endliche Zahlen; `null`, Booleans, Zahlenstrings und Objekte
  werden nicht in Preise umgewandelt. Negative Strompreise bleiben zulässig.
- Erforderlicher Start: ISO-8601 mit expliziter Zeitzone oder positive numerische
  Epoch-Zeit. Kalenderdatum und Zeitangaben werden geprüft.
- Ein fehlendes Ende darf aus der konfigurierten Auflösung berechnet werden;
  ein vorhandenes ungültiges Ende verwirft die Antwort. Dauer größer null und
  höchstens 24 Stunden, keine überlappenden Intervalle.
- Nur EUR und bekannte Umrechnungseinheiten; Marktpreis und berechneter Endpreis
  jeweils innerhalb −100 bis +100 EUR/kWh. Höchstens 4.096 Intervalle.
- Tibber benötigt einen passenden Haushalt und eine vollständige heutige
  Preisliste. Eine leere morgige Liste bleibt zulässig, da deren Veröffentlichung
  später erfolgen kann. Fehlende oder ungültige einzelne Pflichtwerte verwerfen
  die komplette Antwort. Zeitliche Lücken zwischen gelieferten Intervallen
  werden nicht mit erfundenen Preisen aufgefüllt.
- ENTSO-E liefert XML. Dort sind nur explizite Dezimalzahlen, vorhandene gültige
  Auflösung und fortlaufende positive Positionsnummern zulässig. Ungültige
  Perioden, externe Entitätsdefinitionen und fremde Fehlertexte werden verworfen.

`TariffProviderModule._refresh` fängt Fehler asynchron ab. Ungültige Antworten
ersetzen weder die letzten gültigen Intervalle noch den Erfolgszeitpunkt.
Unmittelbar vor der State-Übernahme muss die Antwort zudem einen jetzt gültigen
Preis enthalten. Vollständig abgelaufene und ausschließlich zukünftige Daten
werden mit `provider_prices_not_current` abgewiesen. Die reinen Parser bleiben
für historische Diagnose verwendbar; die zeitliche Annahmeprüfung sitzt an der
produktiven State-Grenze.

Ein Fehler oder unveränderter Tick schreibt auch **keine neuen Zeitstempel** auf
aktuelle/durchschnittliche Preise, Preis-Kurven oder den Erfolgs-State. Eine
erneute Veröffentlichung ist nur bei erfolgreicher Abfrage, einem tatsächlichen
Intervallwechsel oder Änderung der Gültigkeit vorgesehen. Status-/Fehler-States
dürfen weiterhin aktualisiert werden.
Die bestehende Frischegrenze läuft weiter: danach werden aktuelle Preise `null`
und alle veröffentlichten Kurven einschließlich `normalizedJson` einmalig leer.
Das erzeugt keine Geräte-Abschaltbefehle und
ändert keine physischen Schutzfunktionen. Die Installer-Test-API fängt dieselben
Fehler ebenfalls ab. Fehler enthalten feste Codes, keine URLs, Token oder
Antwortinhalte.

## Geheimnisse und Betrieb

Der Abruf liest Zugangsdaten aus `config.credentials`, also aus der vorhandenen
ioBroker-/Installer-Konfiguration. Es gibt keine produktiven Zugangsdaten im
Code oder in den Testdaten. Tests verwenden ausdrücklich wertlose Fixture-Werte.
Eine separate Serverkomponente ist für diesen Transport nicht erforderlich.
Die Konfigurations- und Backup-States mit Zugangsdaten müssen administrativ
geschützt sein; dieser Transporttest allein prüft deren ioBroker-ACL nicht.

## Ausgeführte Prüfung

Node.js 24.19.0 unter Linux, 29.09.2026, 21:19 UTC. Befehl:

```text
node scripts/verify-cra-tariff.cjs --source
```

**23 Prüfgruppen bestanden**, Exit-Code 0. Laufzeit rund 5,4 Sekunden. Geprüft
wurden echte lokale HTTP-Streams hinter einer ausdrücklich simulierten HTTPS-URL,
kontrollierte HTTPS-/DNS-Mocks und ein Test-Adapter für State-Schreibvorgänge.
Keine Verbindung zu einem produktiven Anbieter, keine echten Token und keine
globale TLS-Abschaltung. Positive Fälle umfassen Tibber, EnergyZero, ENTSO-E,
Custom REST, OAuth, negative Preise und numerische Zeitstempel. Negativfälle
umfassen Offlinebetrieb, stagnierenden Body, ignoriertes AbortSignal, gemeinsame
OAuth-Frist, Redirects, Größenlimits, HTTP, Fehlertextbereinigung, falsche Typen,
unvollständige Daten und den Erhalt beziehungsweise Ablauf der letzten Preise.
Zusätzliche Zähler prüfen, dass Fehler und unveränderte Ticks keine Preis-/Kurven-
oder Erfolgs-States erneut schreiben. Vergangene und zukünftige Antworten
ersetzen keinen gültigen Cache; eine gültige aktuelle Antwort aktualisiert ihn.

Rohbelege: [Testausgabe](tariff-five-seconds-source.log),
[Ausführungsdaten](tariff-five-seconds-source.json),
[Hashbindung der geprüften Quellen](tariff-five-seconds-source-hashes.json).
Die Prüfung der generierten JavaScript-Laufzeit und des vollständigen Pakets
erfolgt zusätzlich im abschließenden gemeinsamen Build-/Release-Prüflauf.

## Offene Grenzen

Ein 5.000-ms-Timer ist keine harte Echtzeitgarantie des Betriebssystems. Die
gemessene Rejection lag in diesem kontrollierten Lauf bei etwa 5.003 ms; der
Test lässt ausschließlich für Scheduler-/CI-Streuung bis 500 ms Messabweichung
zu. Im Produkt wird das Budget dadurch nicht erhöht. Ein blockierter Event-Loop
oder Betriebssystemstillstand kann JavaScript-Timer verzögern. Der verkürzte
OAuth-Test zeigt zusätzlich, dass Token- und Preisabruf dieselbe Frist teilen.

Echte TLS-/DNS-Ausfälle beim Anbieter, Anbieter-Vertragsdaten, Raspberry Pi 5,
ioBroker-ACL-Durchsetzung, Regelverhalten der Live-Anlage und VPN-Konfiguration
sind hier nicht auf Hardware getestet. Vor Ort müssen Diagnose, gültige
Preiszuordnung, Fehlerstatus und sicheres Wiederanlaufen beobachtet werden.
IEC-/CRA-Anwendbarkeit und übrige Nachweise stehen in der ergänzenden
[Anforderungsakte](HTTPS_5S_CRA_IEC_ANFORDERUNGEN_DE.md).
