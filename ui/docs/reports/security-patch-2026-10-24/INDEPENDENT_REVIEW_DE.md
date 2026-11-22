<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Use, modification or distribution without express written permission is prohibited. -->
# Zweite KI-Gegenprüfung der Sicherheitspatches 1.0.31

Prüfdatum: 24.10.2026. Umgebung: Node.js v24.19.0, lokaler isolierter Arbeitsstand. Vergleichsbasis: vollständiger Arbeitsstand 1.0.30. Durchgeführt von einem gesonderten KI-Reviewagenten, der die geprüften Produktänderungen nicht implementiert hat. Dies ist eine zweite KI-gestützte Quell- und Regressionstestprüfung, **kein externer Penetrationstest, keine Zertifizierung und keine Produktionsfreigabe**.

## Ergebnis und Umfang

Im abgegrenzten Patch wurden keine neuen blockierenden Fehler oder nachgewiesenen Umgehungen festgestellt. Die Änderungen begrenzen die betroffenen HTTP-Eingangs- und Admin-Antwortpfade nachvollziehbar; normale unkomprimierte JSON-Anfragen und zulässige JSON-Antworten bestehen die gezielten Prüfungen. Eine Aussage über alle Anlagenfunktionen oder vollständige Schwachstellenfreiheit folgt daraus nicht.

Geprüft wurden:

- Paketänderungen `body-parser` 1.20.8 → 1.20.9 und `nodemailer` 10.0.10 → 10.1.4, ohne zusätzliche Laufzeitpakete.
- Alle vier `express.json`-Deklarationen in der kanonischen Quelle, dem manuellen TypeScript-Mirror und dem erzeugten `main.js`: nur `inflate:false` und erläuternder Kommentar; vorhandene Größenlimits und `strict`-Einstellungen bleiben erhalten.
- Die vollständige neue Streamingfunktion `readBoundedApiJson`, ihre Einbindung in beide Fetch-Pfade und ihre Verbindung mit Fehler-/Statusbehandlung und bestehender Strukturvalidierung.
- Neue Regressionstests einschließlich ihrer Assertions sowie die Anpassung des bestehenden Admin-Timeouttests an einen nativen Antwortstream. Der bestehende Test wurde nicht auf eine bloße Erfolgsannahme reduziert.
- Der bisher einzeln fachlich bewertete ESLint-Fund in `adminConnection.ts` und der unveränderte Diagnosezähler in der kanonischen `main.ts`.

## Fachliche Feststellungen

| Prüfpunkt | Feststellung |
| --- | --- |
| HTTP-Dekompression | `inflate:false` lehnt Gzip-/Deflate-JSON vor Dekompression mit HTTP 415 ab. Der Schutz hängt dadurch nicht allein von einem beim Kunden aktualisierten transitiven Paketbaum ab. Alle vier tatsächlichen Parserkonfigurationen wurden getestet. |
| Unveränderte Eingangsgrenzen | 5 MiB, 64 KiB, 64 KiB und 160 KiB bleiben erhalten. Normale JSON-Anfragen werden angenommen; fehlerhafte/zu große Daten bleiben kontrolliert HTTP 400/413. |
| Streaminggrenze | Die Summe tatsächlich gelieferter Bytes wird vor Kopieren, UTF-8-Decodierung und JSON-Parsing auf 16 MiB begrenzt. Fehlende oder zu kleine `Content-Length` umgehen diese Prüfung nicht. Automatisch dekomprimierte Fetch-Bytes zählen mit. |
| Ressourcen und Zeitlimits | Derselbe AbortController gilt für Fetch und Body. Timeout/Fehler brechen den Transport ab und kündigen den Reader; ein nach Abbruch geliefertes Ende wird nicht als erfolgreiche Teilantwort behandelt. Listener und Reader-Lock werden entfernt. Bestehende lokale Endpointbudgets bleiben erhalten. |
| Fehlerbehandlung | UTF-8-/JSON-/Streamfehler werden im API-Pfad in statische Meldungen überführt. HTTP 403 bleibt auch bei zu großem oder defektem Body erhalten und verhindert unzulässigen Port-Fallback. Kein unbeschränktes `json()`-/`text()`-Fallback. |
| Strukturgrenze | Nach JSON-Parsing bleiben Tiefe 40, Budget 100000 Knoten, Ablehnung der drei Poison-Keys und Kopien in `Object.create(null)` aktiv. Das neue Bytebudget ergänzt diese bestehende Kontrolle. |
| Mailpfad | Drei Advisory-Adressen werden vor dem Transport durch die bestehende Produktvalidierung verworfen. Der neue Nodemailer-Parser und eine normale Mail mit festem Absender wurden separat geprüft; keine reale Mail versendet. TLS-/Zertifikatsprüfung sowie Verbote von Datei-/URL-Anhängen bleiben erhalten. |
| Laufzeitpakete | Der Lockfilevergleich enthält nur die zwei genannten Paketaktualisierungen; `newPackagePaths` und `removedPackagePaths` sind leer. Der Admin-Lockfile bleibt unverändert. |

## ESLint-Einzelfundreview

Der bestehende Fund `security/detect-object-injection`, Fingerprint `59450ebe6a325b04febc0607640f2d4bdfba3f3cac204d14e709a7818272fa34`, betrifft weiterhin ausschließlich `result[key]` in `copyJsonValue`. Vor dem Schreiben werden `__proto__`, `prototype` und `constructor` abgewiesen; das Ziel ist ein neu erzeugtes Objekt ohne Prototyp. Rekursion und Knotenanzahl bleiben begrenzt. Die fachliche Begründung des bestehenden Eintrags bleibt gültig. Die neue Quellposition ist Zeile 165; der aktuelle Quellenhash steht unten. Der Implementierungsverantwortliche darf den bestehenden Eintrag an diesen geprüften Stand binden. **Keine pauschale Regelabschaltung, keine neue Fundbaseline und keine Übernahme ungeprüfter neuer Funde.**

Auch der bestehende Zählerfund in `src-ts/runtime-executables/main.ts` bleibt unverändert: `peers.reduce` initialisiert seinen Akkumulator mit `Object.create(null)`. Der Vergleich der Main-Quellen weist ausschließlich die beschriebenen Parseränderungen aus.

## Tatsächlich ausgeführte Gegenprüfungen

| Befehl/Ablauf | Soll | Ist |
| --- | --- | --- |
| `node scripts/verify-admin-response-limits.cjs` | Normale Daten erhalten; Byte-, UTF-8-, Abbruch- und Statusgrenzen wirksam | Exit 0; 16 Prüfgruppen bestanden; 16777216 Byte Grenzwert |
| `node scripts/verify-admin-connection-boundaries.cjs` | Bestehende ioBroker-/Auth-/Status-/Struktur- und Timeoutverträge erhalten | Exit 0; 9 Prüfgruppen bestanden |
| `node scripts/verify-runtime-security-updates.cjs` | Vier echte Parserkonfigurationen überleben alle sieben Szenarien; Mailvalidierung und Komposition erhalten | Exit 0; 28 HTTP-Fälle bestanden; 3 Parserfälle, 3 Ablehnungen vor Transport, lokale Mailkomposition bestanden |
| Zusätzlicher nativer HTTP-Gegenversuch | Normale echte Gzip-Antwort mit UTF-8/Emoji wird erfolgreich verarbeitet | Exit 0; korrekte Daten, kein Abbruch |
| Zusätzlicher nativer HTTP-Gegenversuch | Gültiges JSON-Präfix `{}` ohne Ende des Antwortstroms darf bei Abbruch nicht als Erfolg gelten | Exit 0; nach Abort abgewiesen, Reader-Lock freigegeben |

Die beiden Zusatzversuche kompilierten die unveränderte originale Admin-TypeScript-Datei mit dem vorhandenen Compiler in eine VM und verwendeten einen nativen `node:http`-Server ausschließlich an `127.0.0.1` mit zufälligem freien Port. Gzip kam aus `node:zlib`; der absichtlich offene Stream wurde nach 30 ms per Controller abgebrochen. Der Server und alle Verbindungen wurden im `finally` geschlossen. Keine Anlage, Hardware, Kundenadresse oder SMTP-Verbindung wurde angesprochen.

Nachprüfung einer Testdatenkorrektur am selben Tag: Der Geheimnisscanner stoppte zunächst einen wörtlichen künstlichen SMTP-Testwert im neuen Runtime-Regressionsskript. Es handelte sich um eine lokale Fixture, nicht um reale Zugangsdaten. Die Fixture erzeugt den erforderlichen nichtleeren Wert jetzt pro Lauf mit nativem `crypto.randomBytes(24)` und verwendet ihn ausschließlich im Speicher mit dem injizierten Streamtransport. Der Test gibt diesen Wert nicht aus; es entsteht keine SMTP-Verbindung. Keine Scannerausnahme wurde ergänzt. Der Reviewer hat diesen begrenzten Testfix geprüft und das gesamte Runtime-Regressionsskript erneut ausgeführt: Exit 0, wieder 28 HTTP-Fälle, drei Parser-/Ablehnungsfälle und normale Mailkomposition bestanden. Der unten genannte Skripthash bezeichnet diesen nachgeprüften Endstand; frühere Beobachtungsbelege können den vorherigen Skripthash enthalten.

Vorhandene Rohbelege wurden zusätzlich eingesehen: [Admin-Limits](evidence/admin-response-limits.log), [Admin-Verträge](evidence/admin-connection-regression.log), [Runtime-Grenzen](evidence/runtime-security-updates-final.log), [Paketvergleich](evidence/dependency-diff.json), [Root-Audit](evidence/npm-audit-root-final.json) und [Admin-Audit](evidence/npm-audit-admin-final.json). Die beiden Auditdateien weisen jeweils null gemeldete bekannte Schwachstellen aus; sie wurden in dieser Gegenprüfung gelesen, nicht als eigener zweiter Registryabruf ausgeführt.

## Nachvollziehbarer Quellstand

SHA-256 der unabhängig geprüften Dateien:

| Datei | SHA-256 |
| --- | --- |
| `src-ts/runtime-executables/main.ts` | `a300987130caeebcdb1d6aca97bd99750ccb9613bb63bafa07706dcd2c28799d` |
| `src-ts/runtime-mirrors/main.ts` | `f50acf17a3367d23e7acc2e0acae649a538fbd2a4941da06458314ee076dca78` |
| `main.js` | `a232aa700e0e8e97f692e6455c1efe00067b9293aadb9c0db59439e76a9320ed` |
| `src-admin-tab/src/lib/adminConnection.ts` | `6f7d387e01d9d5b640cc16d2adbc0ce63adda15c4198f57189062df08909d28e` |
| `lib/notification-mail.js` | `63ec344e52b32272e307750b7fffa63a07fe0a8c9fcfedec9ef50d52f897977c` |
| `scripts/verify-runtime-security-updates.cjs` | `8193d621d901fd8a8599db203b791a82912d303f2d71515515a8213111ec192e` |
| `scripts/verify-admin-response-limits.cjs` | `d3d400e5786327fa9f0e2c77d0ff2114270c2405027658d6cc8637811f41c1b7` |
| `scripts/verify-admin-connection-boundaries.cjs` | `a2ecd52c03c0c38b4880982407661c88da2d66ba7f157a8c59461a51e62dd03d` |

Release-Metadaten, fertige Browserassets und finale Paketmanifeste werden vom Releaseprozess separat gebaut, geprüft und versiegelt. Dieser Vermerk behauptet deren Abschluss nicht.

## Kompatibilität und verbleibender Nachweisumfang

- Clients, die komprimiertes JSON **senden**, erhalten jetzt HTTP 415 und müssen unkomprimiertes JSON senden. Komprimierte gültige **Antworten** bleiben innerhalb des dekodierten Limits zulässig.
- Admin-Antworten über 16 MiB werden absichtlich abgewiesen. Native `AbortController`- und `Response.body`-/ReadableStream-Unterstützung ist nun erforderlich; der bisherige Fallback ohne echten Abbruch entfällt.
- 16 MiB ist eine Grenze für Antwortbytes, kein harter Deckel für den gesamten Browserarbeitsspeicher. Pufferwachstum, UTF-8-Text, JSON-Objekte und die validierte Kopie benötigen zusätzlich Speicher. CPU-Zeit während synchronem JSON-Parsing wird nicht von einem Timer unterbrochen, bleibt aber durch das Bytebudget eingegrenzt.
- Die Abhängigkeitsprüfung beschreibt bekannte Registrybefunde zum Prüfzeitpunkt. Keine Aussage „keine Sicherheitslücken“, keine vollständige OWASP-/IEC-/CRA-Konformitätsbehauptung.
- Realbrowser, installierter ioBroker, physische Regelung, Stromtarife, zeitvariables Netzentgelt, Speicherladung, SMTP-Zustellung, Langzeitbetrieb und Update/Rollback auf einer Anlage wurden durch diesen Reviewer nicht ausgeführt. Die unabhängige Serien-/Kundenabnahme und vorhandene offene Befunde bleiben gesondert zu bearbeiten.

Entscheidung dieser Gegenprüfung: **Kein zusätzlicher Blocker im geprüften Patch; technische Releaseprüfungen können fortgesetzt werden.** Eine Hersteller-/Produktionsfreigabe wird hierdurch nicht erteilt.
