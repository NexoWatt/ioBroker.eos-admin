# Ergänzende interne Sicherheitsprüfung

Prüfanlass: Anpassung des am 29.09.2026 bereitgestellten vollständigen Repositorys
`NexoWatt_UI_1.0.21_STABLE_FULL_REPOSITORY (1).zip` an die persönliche EOS-Sicherheitsvorgabe.
Ausgangsversion: 1.0.21. Der endgültige Lieferstand und seine Dateihashes stehen im
Release-Nachweis. Diese zusätzliche interne, KI-gestützte Quellcodeprüfung ist keine
unabhängige Zertifizierung, kein vollständiger Penetrationstest und keine CRA-Konformitätserklärung.

## Geprüfte Grenzen und konkrete Befunde

Die Rollen-, Sitzungs-, Browser-Origin- und Frontend-Prüfungen sind in den jeweiligen
Berichten beschrieben. Hier wurden ergänzend Konfigurationsimporte, Schreibgrenzen,
Kiosk-Datenflüsse, Dateipfade, Adapter-Nachrichten und optionale Tarifprovider geprüft.

| Kennung / Bereich | Befund im Ausgangsstand | Auswirkung und Voraussetzung | Bearbeitung / Nachweis |
| --- | --- | --- | --- |
| UI-CRA-API-04 – Adapterkern | `nwDeepMerge` folgte einem verschachtelten `__proto__`-Schlüssel bis zum globalen Objektprototyp. Die erlaubten Wurzelschlüssel von Installer-Konfiguration und Backup-Import schützten verschachtelte Daten nicht. | Ein manipulierter Installer-Patch konnte Eigenschaften in nachfolgende Objekte des Prozesses einbringen. Die konkrete Prototypmutation wurde reproduziert; eine darüber hinausgehende Codeausführung wurde nicht behauptet oder getestet. | An API-Verantwortlichen übergeben; gemeinsame Merge-Validierung ergänzt. Isolierter Vorher-Nachweis: `evidence/prototype-original-reproduction.json`; Nachprüfung im API-Testpaket. |
| UI-CRA-API-05 – generischer Setter | Der letzte `/api/set`-Fallback behandelte unbekannte `scope`-Werte wie `settings`. Die ausdrückliche Sperre für `peakShavingEnabled` griff nur beim wörtlichen Scope `settings`. | Ein zum Kundenschreiben zugelassener Aufrufer konnte die spezifische API-Sperre umgehen. Ob daraus eine reale Laständerung entsteht, hängt zusätzlich von Mapping und EMS ab und wurde nicht an Hardware geprüft. | Unbekannte Scopes werden zurückgewiesen; an API-Verantwortlichen übergeben, Regression im API-Testpaket. |
| UI-CRA-API-06 – Schnellsteuerung | `scope=flow` validierte generische Sollwerte nur auf eine endliche Zahl. Die für die Oberfläche bereitgestellten `ctrl.setpointMin` / `setpointMax` wurden vor dem Fremd-State-Write nicht durchgesetzt. | Ein zugelassener Kunde konnte den konfigurierten UI-Sollwertbereich verlassen. Der zugehörige Datenpunkt war weiterhin installerseitig zugeordnet; es handelt sich nicht um freie Datenpunktwahl. | API-Verantwortlicher ergänzt die Schnittmenge aus Konfigurations- und Datenpunktgrenzen vor Schreib-/Manual-Hold-Nebenwirkungen. Nachprüfung im API-Testpaket; gerätebezogene Inbetriebnahme bleibt erforderlich. |
| Kiosk – Token in öffentlichen Zuständen | `_nwDisplayPersistSessionOperatorStates` schrieb tokenhaltige Export-URLs in `chargeKiosk.stations.*.csvExportUrl`, `sessionExportJson` und `operatorSummaryJson`; der öffentliche Filter prüfte diese URL-Inhalte nicht. | Ein öffentlicher State-/SSE-Leser konnte nach einer Kiosk-Abfrage den als Bearer verwendeten Stationszugang erhalten und damit Stationsbefehle versuchen. | Umgehend an API-Verantwortlichen übergeben. Maßgeblich sind die Kennung und Nachprüfergebnisse im zentralen Befundregister/API-Bericht. |
| Kiosk – Modusfreigabe | Die Stations-API prüfte `station.allowedModes` für `start`, nicht für `set-mode`. | Ein Besitzer des Stations-Tokens konnte über den zweiten Bedienpfad eine stationsseitig nicht angebotene Moduswahl anfordern. Die nachgelagerten EMS-Grenzen bleiben ein eigener Schutz. | An API-Verantwortlichen übergeben; zentrale Befundzuordnung und Nachprüfung im API-Bericht. |
| UI-CRA-NET-04 – Tarifprovider | `fetchJson`, `fetchText` und OAuth lasen unbegrenzte Antworten, folgten Redirects und erlaubten konfigurierte HTTP-Ziele mit Zugangsdaten. Auszüge aus Provider-Fehlerantworten wurden als Fehlertext weitergegeben. | Fehlerhafter oder kompromittierter Provider beziehungsweise eine riskante Installer-Konfiguration konnten Speicher belegen oder Geheimnisse über Klartext/Weiterleitung/Fehlertexte exponieren. Beliebige Installer-Ziele sind eine bewusste Konfigurationsbefugnis, kein hier nachgewiesener anonymer SSRF-Zugriff. | In diesem Arbeitsstrang geändert und gezielt geprüft; siehe unten. |

Die Meldung eines Befunds ist von seiner abschließenden Schließung zu unterscheiden.
Für API-Befunde gelten die ausgeführten Tests und der endgültige Freigabestatus des
zusammengeführten Pakets; diese Tabelle ersetzt diese Nachweise nicht.

## Änderung UI-CRA-NET-04

Betroffene Quelle: `src-ts/runtime-executables/ems/services/tariff-provider-registry.ts`.
Die ausführbare Datei und der vorhandene TypeScript-Spiegel werden durch den
regulären Build erzeugt. Die Normalisierung auf EUR/kWh und die vorhandene
Frische-/Fallback-Logik des Tarifmoduls werden nicht fachlich umgestellt.

- Nur HTTP(S)-URLs ohne URL-Zugangsdaten und Fragment sind zulässig.
- TLS ist für Zugangsdaten, OAuth, Token-Queryparameter, nicht öffentliche
  Custom-Header und Request-Bodies erforderlich. Die normale Zertifikatsprüfung
  von Node.js bleibt aktiv.
- Weiterleitungen werden abgewiesen. Die konfigurierte Adresse muss daher der
  endgültige API-Endpunkt sein.
- Maximal 64 KiB Request-Body, 2 MiB tatsächlich gelesene Antwort nach
  Dekompression und 1–30 Sekunden Gesamttimeout einschließlich Antwortkörper.
- OAuth verwendet denselben begrenzten Transport. Fremde Fehlertexte und
  GraphQL-Fehlerdetails werden nicht in lokale API-/Log-Fehlermeldungen übernommen.

Öffentliche, geheimnisfreie Custom-REST-Abfragen können weiterhin HTTP verwenden,
beispielsweise zu einem lokalen Datenlieferanten. Ein enger DNS-/IP-Zielkatalog wurde
nicht eingeführt, weil die Installer-Konfiguration lokale und externe Quellen
unterstützt. Netzwerksegmentierung und vertrauenswürdige Konfiguration bleiben
notwendig. Externe Tarifanbieter sind optionale ausgehende Datenverbindungen; sie
sind im rein lokalen Betriebsprofil abzuschalten beziehungsweise durch lokale
Datenpunkte zu ersetzen. Diese Änderung richtet keinen neuen Cloud-Dienst ein.

## Tatsächlich ausgeführte Prüfungen

`node scripts/verify-cra-tariff.cjs --source` wurde unter Node.js 24.19.0 auf Linux
ausgeführt. Elf Prüfgruppen bestanden. Der genaue Zeit-/Quellbezug steht in
`evidence/tariff-source-provenance.json`, das Ergebnis in
`evidence/tariff-source-test.json`.

| Prüfung | Verfahren | Ergebnis |
| --- | --- | --- |
| Lokale HTTP-Preisquelle ohne Secrets | Echter Loopback-HTTP-Server, Normalisierung eines Preisintervalls | Bestanden |
| Redirect-Abweisung | Echter HTTP-302-Server; Zielserver-Zähler muss unverändert bleiben | Bestanden |
| Antwortgröße | Echter Stream ohne Content-Length sowie zu große deklarierte Länge | Bestanden |
| Antwort-Timeout | Server beginnt Body und beendet ihn nicht; Timeout muss abbrechen | Bestanden |
| Fehlertextbereinigung | Server liefert HTTP 502 mit vertraulichem Testtext | Bestanden; nur Fehlerklasse/Status übernommen |
| Klartextschutz vor Netzwerkzugriff | Bearer, Basic, API-Key, Custom-Header, Query-Token, Body, Tibber, ENTSO-E und OAuth | Bestanden; lokaler Zielzähler unverändert |
| URL-Schema / URL-Zugangsdaten | Lokale Negativfälle für Dateischema, Daten-URL, FTP, Userinfo und Fragment | Bestanden |
| HTTPS-Custom-REST / OAuth | Gemockte Fetch-Antworten; Header, Redirectmodus und Preisnormalisierung | Bestanden; keine reale TLS-/Providerintegration |
| Requestgröße | Zu großer POST-Body; Fetch darf nicht aufgerufen werden | Bestanden |

Der Standardaufruf `node scripts/verify-cra-tariff.cjs` wurde nach dem regulären
Build auch gegen die erzeugte Runtime ausgeführt: ebenfalls elf Prüfgruppen
bestanden. Ergebnis und Quellbezug stehen in `evidence/tariff-runtime-test.json`
und `evidence/tariff-runtime-provenance.json`. Test-Fixtures enthalten ausschließlich
erfundene Zugangsdaten.

Nicht ausgeführt: echte Tarifprovider-Anmeldungen, Zertifikats-/Proxy-Integration
auf einem EOS-Gerät, Anlagen-/Hardwaretests und eine externe Sicherheitsprüfung.
Auch Drittadapter und der ausgelieferte js-controller werden durch diese
Dateiprüfung nicht freigegeben. Die direkte EEBUS-Nachrichtenschnittstelle vertraut
weiterhin der ioBroker-Absender-/Transportgrenze; deren Sicherheit muss im
Gesamtprodukt mit dem tatsächlichen Controller- und EEBUS-Gateway-Stand geprüft werden.
