<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis untersagt. -->
# Admin: begrenzte HTTP-Antworten vor der JSON-Verarbeitung

Datum: 24.10.2026. Ausgangsstand: unveränderte Lieferung 1.0.30.
Korrekturstand: Arbeitskopie 1.0.31. Gegenstand ist die React-Adminoberfläche;
keine Änderung an Leistungsreglern, Lizenzverträgen oder Gerätezuordnungen.

## Befund und Wirkung

Die beiden zentralen Fetchfunktionen in `src-admin-tab/src/lib/adminConnection.ts`
lasen Antworten bisher mit `Response.json()` vollständig ein. Die anschließend
vorhandenen Tiefen-, Knoten- und Prototypprüfungen begrenzen nicht die zuvor
empfangenen Bytes. Eine synthetische Antwort mit 16.777.237 Byte wurde über den
tatsächlichen `dynamicGridRequest`-Pfad in 1.0.30 angenommen. Diese Probe belegt
die fehlende Begrenzung; sie ist kein Nachweis eines Angriffs auf eine Liveanlage.

## Korrektur

- Alle React-HTTP-JSON-Aufrufe verwenden weiterhin die beiden zentralen
  GET-/POST-Helfer. Diese lesen jetzt einen nativen Fetch-Stream mit höchstens
  **16 MiB tatsächlich gelieferter, browserseitig dekomprimierter Bytes**.
- Eine zu große deklarierte `Content-Length` wird vor dem ersten Reader-Aufruf
  abgewiesen. Fehlende oder zu kleine Header umgehen das tatsächliche Bytebudget
  nicht. Ungültige Headerzahlen werden kontrolliert verworfen. Komprimierte
  Wire-Längen werden nicht fälschlich mit dekodierten Längen gleichgesetzt.
- Der Bytepuffer wächst begrenzt. Sehr kleine Chunks erzeugen keine unbegrenzt
  große Liste einzelner Puffer oder Textfragmente. Erst danach folgen strikte
  UTF-8-Decodierung und `JSON.parse` mit `unknown`-Ergebnis.
- Größen-, UTF-8-, JSON- und Abbruchfehler schließen den Reader und brechen den
  tatsächlichen Fetch-Controller ab. Fehlende/gesperrte Body-Streams werden ohne
  unbeschränkten `json()`-/`text()`-Fallback abgewiesen.
- Die vorhandenen endpointabhängigen 1,5-/3,5-/5-/6-/10-Sekunden-Fristen bleiben
  erhalten. Insbesondere erhalten lokale Mesh-/Mailoperationen weiterhin ihr
  bisheriges 10-Sekunden-Budget. Das gemeinsame Dynamic-Grid-Budget bleibt 5 s.
- HTTP-Status bleibt auch bei ungültigen/zu großen Fehlerantworten erhalten.
  Ein HTTP403 wird nicht in einen anderen Port-Fallback umgedeutet; Mutationen
  des dynamischen Netzanschlusses werden weiterhin nicht erneut gesendet.
- Tiefen-/Knotengrenzen und Null-Prototyp-Kopien gelten unverändert nach dem
  Einlesen. Keine neuen Pakete, kein expliziter ungesicherter Typ und keine
  Abschaltung der strikten Typprüfung wurden eingeführt.

Die Grenze liegt über den bestehenden 5-MiB-Konfigurations-Requestverträgen
einschließlich Antwortmetadaten/Vorschau. Die vorhandenen Archivseiten liefern
höchstens 200 Records; deren Journalformat begrenzt jeden Record auf 4000 Byte.
Es wird ausdrücklich keine unbegrenzte Gesamtarchivantwort eingeführt. Die
vorhandene seitenweise Archivabfrage bleibt erhalten. Ungewöhnlich große
zukünftige API-Verträge müssen vor einer Änderung der Grenze geprüft werden.

Die Adminoberfläche setzt dafür native `AbortController`, `Response.body` und
`ReadableStream` voraus. Ein Browser ohne diese APIs erhält einen kontrollierten
Fehler; ein Netzwerkabruf ohne wirksame Abbruchmöglichkeit wird nicht mehr
gestartet. Die 16 MiB begrenzen die Antwortbytes. Sie sind kein Gesamtspeicherlimit
für den Browser: Bytepuffer, decodierter Text, JSON-Objekte und die geprüfte Kopie
benötigen zusätzlich Speicher.

## Tatsächliche Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Vorher/Nachher über echten Admin-API-Pfad | 16.777.237 Byte: 1.0.30 angenommen; 1.0.31 mit statischer Grenzmeldung und wirklichem Abort abgewiesen |
| Native Antwortgrenzen | 16 Gruppen bestanden: UTF-8-Chunks, exakte 16 MiB, ein Byte darüber, fehlende/falsche/ungültige Header, hängender Body, Cancel-Fehler, kein Fallback, 403-Erhalt, Null-Prototyp/Poison-Key-Abwehr |
| Nativer HTTP-Gzip-Test | Kleiner komprimierter Loopback-Body wird nach Dekompression als zu groß abgebrochen |
| Bestehende Connection-Regressionsprüfung | 9 Gruppen bestanden; früherer reiner `json()`-Timeoutmock auf nativen Stream umgestellt, Abbruchassertion erhalten |
| Strikte Admin-TypeScript-Prüfung | Beide vorhandenen Compilerkonfigurationen bestanden; Umfang bleibt 17 Adminquellen plus Vite-Konfiguration |
| Direkte ESLint-Dateiprüfung | Eine unveränderte historische `detect-object-injection`-Fundstelle in der bereits geprüften Null-Prototyp-Kopie; keine neue Fundstelle durch den Streamleser |

Die bestehende dateihashgebundene ESLint-Einzelfreigabe verlangt nach der
Quelländerung eine neue Bindung. Der dokumentierte Hinweis liegt weiterhin bei
`result[key]`: Schlüssel `__proto__`, `prototype`, `constructor` werden zuvor
verworfen; das Ziel ist `Object.create(null)`. Die projekweite Quellhashbindung wurde nach erneuter fachlicher Gegenprüfung
aktualisiert; der abschließende Build und die vollständige Regression bestanden.
Die Einzel-Exitcodes stehen in `evidence/final-validation-results.json`.
Eine zusätzliche pauschale Regelunterdrückung wurde nicht hinzugefügt.

Belege unter `evidence/`: `admin-response-validation.json`,
`admin-response-baseline-comparison.json`, `admin-response-limits.log`,
`admin-connection-regression.log`, `admin-strict-typecheck.log`,
`admin-response-eslint.json`. Der zwischenzeitliche Gate-Stopp wegen der
geänderten Quellbindung ist in `admin-security-gate.log` erhalten.

Reproduktion im Repository:

```sh
node scripts/verify-admin-response-limits.cjs
node scripts/verify-admin-connection-boundaries.cjs
npm --prefix src-admin-tab run typecheck
```

Das ist ein Software-/Transportnachweis mit synthetischen Daten. Die gesamte
Sicherheit der Kundenanlage, reale Browser-/Installationsfreigaben und
Anlagenregler sind damit nicht als geprüft erklärt. Verantwortlich für
Korrektur und Releaseintegration: EOS-Entwicklung.
