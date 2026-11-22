# Gezieltes Security-ESLint-Re-Review der Partnererweiterung

Datum: 28.10.2026. Umfang: neue Scannerstellen der Partner-/Arbitrageerweiterung
sowie erneute Prüfung bereits einzeln bewerteter Stellen in `adminConnection.ts`
und `main.ts`, deren Dateicode sich geändert hat. Diese KI-gestützte Quellprüfung
ist keine unabhängige Zertifizierung, kein vollständiger Normaudit und kein
Nachweis eines insgesamt schwachstellenfreien Bestands.

## Ausgangspunkt und Verfahren

Der unveränderte Security-Scanner meldete vor dem Review 174 Quellen, 3068 aktuelle
Hinweise und 49 neue Fundstellen. Die Bindung bereits überprüfter Befunde an den
gesamten gedruckten Dateicode blockierte zusätzlich bei `adminConnection.ts` und
`main.ts`. Der erste Rohbefund wurde vor jeglicher Reviewfreigabe in
`evidence/eslint-before-review.json` gespeichert. Die Datei enthält Fingerprints,
Regeln und Positionen, keine Quellfragmente oder Geheimnisse.

Alle neuen Fundstellen wurden im Quellkontext geprüft. Die Legacybaseline wurde
weder erweitert noch neu erzeugt. Bestehende Regelstärken, `noInlineConfig`,
Fingerprints, Häufigkeitsgrenzen und Hashprüfungen bleiben erhalten. Der Guard
erhält ausschließlich eine additive Erweiterung seines strikten Typbereichs um
`partner-contracts`, `partner-config-api`, `partner-service`, `partner-runtime`,
`partner-websocket` und `arbitrage-control`. `any`, Typunterdrückungen und Parser-
fehler werden dafür auch bei einem vorhandenen Inventareintrag nicht zugelassen.

## Tatsächlich geänderter Code

Der neue WSS-Hostnamevalidator enthielt eine verschachtelte Regex-Wiederholung,
die `security/detect-unsafe-regex` meldete. Obwohl die URL schon begrenzt war, wurde
die Stelle verbessert: begrenzte DNS-Labels werden jetzt einzeln mit einem einfachen
Zeichenklassenmuster und expliziten Längen-/Bindestrichregeln geprüft. Dafür wurde
keine Scanner-Ausnahme angelegt. Die vorhandenen Transport-Negativtests sowie der
isolierte Strict-Build werden nach der Änderung erneut ausgeführt.

## Einzelentscheidungen zu verbleibenden Scannerstellen

Die folgende Begründung ist jeweils in `docs/security/eslint-reviewed-findings.json`
mit exaktem Fingerprint, Anzahl, Quellcodehash und diesem Nachweis verbunden.
Änderungen am betreffenden Dateicode erzwingen weiterhin ein neues Review.

| Bereich | Geprüfter Datenfluss und Entscheidung |
| --- | --- |
| `PartnerIntegrationsPage.tsx`, Statuslabel | `reasonNames[code]` folgt unmittelbar auf `Object.hasOwn`; nur die eigenen fest definierten Labels werden gelesen. Unbekannte Codes werden von React als Text gerendert. Keine Prototypmutation und kein HTML-/Code-Sink. |
| `PartnerIntegrationsPage.tsx`, App-/Rechtelabels | App-IDs stammen aus expliziten internen Routen oder dem festen Standard; Server-Grants und Permissions werden durch `parsePartnerConfig`/`oneOf` gegen endliche Listen geprüft. Die angezeigten Permissionlabels lesen feste lokale Dictionaries. Keine fremde Eigenschaft wird geschrieben. |
| `arbitrage-control.ts`, `data` | Fremde Schlüssel werden gegen `__proto__`, `prototype` und `constructor` gesperrt. Nur eigene passive Datendeskriptoren werden in ein neues Null-Prototyp-Dictionary kopiert. Getter werden nicht ausgeführt; Klassen/Arrays sind hier ausgeschlossen. |
| `partner-contracts.ts`, `partnerAppState` | `id` ist eine endliche fachliche App-ID aus validierten Aufrufern, mit festem Default. Der Zugriff liest ausschließlich den vorhandenen lokalen Appzustand; er schreibt weder Objektpfade noch Prototypen. |
| `partner-service.ts`, Datenprojektion | Sämtliche dynamisch indizierten Schlüssel stammen aus den im Modul festgelegten Bilanz-, Telemetrie- und Fähigkeitslisten. Werte werden vor Übernahme auf echte endliche Zahlen, Zeitstempel oder Boolean geprüft. Ausgabe erfolgt in `Object.create(null)`, ohne Kopie interner Konfiguration. |
| `partner-runtime.ts`, Credentialreferenz | Die Umgebungsreferenz muss das begrenzte Präfixmuster `NEXOWATT_PARTNER_` erfüllen. Der gelesene Wert ist größenbegrenzt und wird als JSON geprüft; Partneridentität und Endpunkt sind gebunden. Die vier kopierten Credentialfelder stammen aus einer internen `as const`-Liste. Geheimniswerte verlassen diesen Aufbereitungspfad nicht über Status oder Logs. |
| `partner-runtime.ts`, Bilanzprojektion | Die sechs Quellanteile stammen aus einer festen lokalen Feldliste. Ihre Werte sind begrenzt und numerisch geprüft; Ausgabe ist ein Null-Prototyp-Dictionary. Der Reader liest ein festes Bilanz-State und keine vom Partner übergebene State-ID. |
| `partner-runtime.ts`, Dateiaufrufe | Journal-, Widerrufs- und Markerpfad entstehen ausschließlich unter dem vom Adapter gelieferten absoluten Datenverzeichnis mit festen eigenen Dateinamen. Temporärnamen entstehen mit `randomBytes`. Kein Nachrichtentext oder Partnerparameter wird als Dateipfad verwendet. `O_NOFOLLOW`, `O_EXCL`, Deskriptorprüfung, Besitzer-/Modusprüfung, begrenzte Reads, serialisierte atomare Writes und fsync sind vorhanden. |
| `dynamic-grid-connection.ts`, Messarrays | `samples[index]` und `telemetry[index]` verwenden den numerischen Index von `every` über dieselbe unveränderte Speicherliste, aus der beide Arrays unmittelbar zuvor mit `map` erzeugt wurden. Zwischen Erzeugung und Prüfung liegt kein `await`; der fremde Partner liefert keinen Arrayindex. Werte werden auf Aktualität, Endlichkeit und Verfügbarkeit geprüft. |
| `main.ts`, lokale Appzustände | Der neue `localId` wird nur aus den fachlich festgelegten App-IDs gebildet; `directMarketing` wird ausdrücklich auf die bestehende lokale App `grid` abgebildet. Die Aufrufer erhalten bereits validierte Partner-App-IDs. Lizenz sowie installed/enabled bleiben zusätzlich erforderlich. |
| `main.ts`, Availability/Telemetry | Die neuen Ressourcenlesezugriffe lesen die von der lokalen Regelung geführten Null-Prototyp-Maps. Sie ändern keine Objektstruktur; Verfügbarkeit besitzt zusätzliche Typ-, Zeit- und Altersprüfung. Die Ressourcen werden zuvor vom Partnerdienst mit der konkreten Freigabe abgeglichen. |
| `main.ts`, `stateCache`-Reader | Der Reader wird ausschließlich durch `readPartnerProjection` mit fest codierten State-IDs für Bilanz, PV sowie Bezug/Einspeisung aufgerufen. Die Partnernachricht kann keinen beliebigen Datenpunkt an diesen Callback reichen. |
| `adminConnection.ts`, bestehender JSON-Wrapper | Die erneut geprüfte Kopierstelle sperrt die drei Prototypschlüssel und schreibt in ein frisches Null-Prototyp-Dictionary; Rekursion/Knotenbudget bleiben begrenzt. Neue Partneraufrufe nutzen eine feste Suffixliste, begrenzte Antwortverarbeitung, lokale Session und ein gemeinsames Abbruchbudget. Fehlgeschlagene Mutationen werden nicht automatisch wiederholt. |
| `main.ts`, bestehender Fehlerklassenzähler | Die vorhandene einzeln geprüfte Stelle verwendet weiterhin `Object.create(null)` als Akkumulator. Der Peerclient liefert feste eigene Fehlercodes; die Änderung anderer Main-Bereiche hebt diese Begrenzung nicht auf. Der Befund wird gezielt neu gebunden, nicht als Audit aller Main-Funktionen ausgegeben. |

Die dynamischen Dateipfade sind notwendige lokale Persistenzzugriffe und deshalb
weiterhin sichtbare Scanner-Hotspots. Ein Angreifer mit denselben OS-Rechten kann
den Speicherbereich manipulieren; der Schutz des Hosts bleibt erforderlich.
Pfadprüfungen sind kein Schutz gegen einen bereits vollständig kompromittierten
Dienstnutzer. Windows wird ohne passenden ACL-Nachweis nicht still freigegeben.

## Belege und Ergebnisgrenzen

Ergebnis des abschließenden echten Gate-Laufs: **bestanden, Exitcode 0**. Von 174
Quellen enthalten die Scanner weiterhin 3067 Hinweise: 2971 historische offene
Hotspots und 96 einzeln geprüfte Vorkommen. Neue oder verbotene ungeprüfte Stellen:
0. 89 frühere Inventarvorkommen sind nicht mehr vorhanden. Die 39 neu angelegten
Revieweinträge beschreiben 48 konkret geprüfte Vorkommen. Die Legacybaseline blieb
unverändert. Diese Zahlen sind Scanner-/Inventarwerte und keine Zahl nachgewiesener
Schwachstellen.

Nach der Hostnamekorrektur bestanden die 15 Transportprüfungen einschließlich
isoliertem Strict-Build. Die vorhandenen 25 Security-Gate-Negativtests bestanden.
Zusätzlich wiesen 12 Negativprüfungen nach, dass alle sechs neu aufgenommenen
strikten Module `any` und Typunterdrückungen selbst bei passendem Inventareintrag
weiterhin blockieren. Der finale dynamische Reglerstand wurde nach seiner letzten
Änderung separat erneut gescannt und an den aktuellen Codehash gebunden.

- `evidence/eslint-before-review.json`: vollständiger Ausgangsbefund vor Einzelfreigaben.
- `evidence/eslint-review-candidates.json`: nach Regexkorrektur erfasste Fundstellen
  und Quellcodehashes der erneut zu prüfenden Bereiche.
- `evidence/eslint-final.json`: Ergebnis des unveränderten Gate-Verfahrens nach
  Eintragung der konkret geprüften Stellen; verbleibende Bestandsbefunde bleiben sichtbar.
- `evidence/strict-scope-negative.json`: 12 bestandene Negativfälle für den additiv
  erweiterten strikten Typbereich.
- `node scripts/verify-partner-websocket.cjs`: erneuter isolierter Strict-Build und
  risikobezogene Transportfälle nach der Hostnamekorrektur.
- `node scripts/verify-eslint-security-test.cjs`: vorhandene Negativtests gegen
  Scanner-/Gateabschwächung; zusätzlich wird die additive Typgrenze geprüft.

Ein bestandenes Gate bedeutet: keine unbewerteten neuen oder verbotenen
Scannerstellen im geprüften Stand. Es bedeutet ausdrücklich keinen sauberen
Gesamtscan, keine abgeschlossene Behandlung aller historischen Hotspots und keine
ASVS-, IEC- oder CRA-Konformität.
