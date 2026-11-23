# DEVICES-HTTP-906-001 – HTTP- und TA-CMI-Grenzen

Stand: 2026-11-23. Betroffen: `modules/devices/lib/drivers/http.js`, `taCmi.js` und neuer gemeinsamer Transport `boundedHttp.js`. Andere Gerätetreiber bleiben außerhalb dieses Änderungsumfangs.

## Verhalten und Migration

- Zertifikats- und Hostnamenprüfung bleibt immer aktiv; mindestens TLS 1.2. Die bisherigen Umgehungsoptionen `insecureTls`, `insecureTLS`, `allowInsecureTls` und `rejectUnauthorized: false` werden mit `E_HTTP_TLS_VERIFICATION_REQUIRED` abgelehnt. Für lokale HTTPS-Geräte kann `connection.trustedCaPem` eine ausdrücklich gewählte öffentliche PEM-Zertifikatskette enthalten (höchstens 64 KiB, 8 Zertifikate). Die Kette ersetzt keine Hostnamenprüfung. Ein Zertifikat muss also weiterhin zum konfigurierten Host passen. Die alten Umgehungsoptionen müssen beim Umstellen entfernt werden.
- Eine explizite HTTP(S)-Basisadresse ohne Benutzerinfo, Fragment oder Query ist erforderlich. Endpunkte bleiben auf deren Origin. API-Pfade/Queryparameter gehören in die vorgesehenen Endpunktfelder. Redirects und automatische Umgebungs-Proxys sind für diese lokalen Geräteverbindungen deaktiviert; keine automatische Klartext-Ausweichverbindung.
- Ein vollständiger HTTP-Poll teilt ein Gesamtbudget von höchstens 5.000 ms über alle Gruppen; konfiguriert kürzere Fristen bleiben kürzer (mindestens 100 ms). TA-CMI nutzt dasselbe Budget für den einzelnen API-Abruf. Es gibt keine automatischen Wiederholungen. Der AbortController bricht bei Fristablauf und Disconnect den tatsächlichen Axios-Request sowie den Response-Stream ab. Die begleitende Promise-Grenze begrenzt außerdem fehlerhafte Transportimplementierungen. Späte Auflösungen/Fehler bleiben beobachtet und liefern keine alten Werte.
- Antwortkörper: höchstens 2 MiB nach Dekompression. Schreibkörper: höchstens 256 KiB. Antwortbäume: höchstens 50.000 Knoten/32 Ebenen; gefährliche Prototypschlüssel werden verworfen. Je Treiber höchstens vier ausstehende Anfragen, kein wachsender Wartepuffer.
- HTTP-Werte werden vor Rückgabe gegen den Datapunkttyp geprüft; ungültige numerische oder boolesche Werte werden nicht als Messwerte übernommen. Erfolgreiche Gruppen bleiben bei unabhängigen Endpunktfehlern erhalten. Ein Disconnect, eine widerrufene Modulfreigabe oder eine verstrichene Gesamtfrist beendet den Poll.
- TA-CMI prüft den vollständigen API-Datensatz vor dynamischen Knotenobjekten/Messwerten: Metadaten, Status, endliche Analogwerte, digitale Werte/State 0 oder 1, RAS 0 bis 3 sowie Gruppen-/Zeilen-/Textlimits. Die vorhandene Mindestpause von 60 Sekunden bleibt erhalten. Die Modbus-Brücke prüft die aktuelle zentrale Modulfreigabe auch bei synchronen Lese- und asynchronen Schreibcallbacks. Ein verzögertes Connect darf nach Disconnect keinen Server neu starten.
- Geräteprotokolle enthalten nur stabile Fehlercodes. Axios-Konfigurationen, Antwortkörper, Zugangsdaten und URL-Querywerte werden nicht durch Fehlerdiagnosen ausgegeben.

## Nachweise

`node --test modules/devices/test/http-security.test.js modules/devices/test/taCmi.test.js`: **20/20 bestanden** auf Node.js 24.22.3. Die Prüfungen nutzen den echten Axios-HTTP-Adapter mit injiziertem Node-Stream-Transport: Gruppenbildung, Zielbindung, dekomprimierte Größenüberschreitung, Schreiblimit, tatsächliche Request-Zerstörung, gemeinsame Deadline einschließlich Timer-/Uhr-Rundungsrand, verspätete Antworten/Ablehnungen, Stop/Connect-Rennen, Modulwiderruf, vollständige CMI-Validierung, Typprüfung und begrenzte Parallelität. Die vorhandenen fünf CMI-Regressionsprüfungen bleiben erfolgreich. Syntaxprüfungen der drei Produktdateien bestanden.

Ein realer TLS-Handshake und Hardware-Inbetriebnahme sind hier nicht nachgewiesen. Die TLS-Tests prüfen die tatsächliche Agent-Konfiguration und das Ablehnen ungültiger CA-/Unsicherheitskonfigurationen. Die Stream-Tests umgehen nur das reale Netzwerk; Axios' Limit-, Dekompressions- und Abbruchverarbeitung bleibt aktiv. Auf dem Zielgerät sind CA-Kette/Hostname, individuelle HTTP-Endpunkte und die CMI-Modbus-Brücke zu prüfen. Daraus folgt keine pauschale CRA-Konformitätserklärung.

## Primärquellen

- [Axios Request config](https://axios-http.com/docs/req_config): Größenlimits, Redirect-/Transportkonfiguration.
- [Axios Cancellation](https://axios-http.com/docs/cancellation): AbortController.
- [Node.js HTTPS](https://nodejs.org/api/https.html): HTTPS-Agent/TLS-Optionen.
- [Technische Alternative CMI JSON API Version 8, 2025-10-08](https://www.ta.co.at/en/downloads/file/1751): Status-/Headerformat, digitale Werte und State 0/1, RAS 0–3, Abfragebeschränkung. Schema gegen diese Herstellerquelle geprüft.
