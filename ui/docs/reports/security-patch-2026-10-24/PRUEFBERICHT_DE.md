<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis untersagt. -->
# NexoWatt UI 1.0.31 – Sicherheitskorrektur und Kundenfreigabegrenzen

Datum: 24.10.2026 (Europe/Berlin). Ausgangsstand: vollständiges Lieferpaket 1.0.30. Gegenstand: NexoWatt-UI-Adapter und React-Admin-Oberfläche; kein vollständiger EOS-Host und keine unabhängige Zertifizierung.

**Abgeschlossene lokale Softwareprüfung:** Build, vollständige vorhandene Regression, neue Sicherheitsprüfungen und technische Paketprüfungen für 1.0.31 sind bestanden. Die Kunden-/Anlagenfreigabe bleibt ausdrücklich offen: `review`, `productionApproved: false`. Maßgeblich sind die nachstehenden tatsächlichen Ergebnisse; ein sicherer Gesamtbetrieb der Kundenanlage ist damit nicht bescheinigt.

## Anlass und Ausgangsnachweis

Der Nutzer fordert sichere Programmierung nach aktuellen Sicherheitsmaßstäben vor einer möglichen Kundeninstallation. Seine Rückmeldung, dass der gehärtete Adapter bisher auf der eigenen Liveanlage ohne Auffälligkeiten läuft, wird als Nutzerbeobachtung zur Funktion erfasst. Daraus folgt weder ein bestandener Angriffstest noch die Freigabe eines unbekannten Kundensystems. Konkrete Sicherheitsanforderungen des genannten Interessenten liegen nicht vor; eine Apple-Freigabe oder Apple-Zertifizierung wird nicht behauptet.

Das unveränderte vollständige Eingangspaket 1.0.30 hat SHA-256
`46c54eb665b865d97585492180ec83c71dba19bc80d041204279f8c04fbdaf36`.
Die neue Arbeitskopie wird getrennt geführt. Am 24.10.2026 meldete `npm audit --omit=dev --ignore-scripts --json` für diesen Ausgangsstand zwei betroffene Backendpakete, davon eines hoch und eines moderat. Der separate Admin-Laufzeitbaum hatte bei diesem Abruf keinen Treffer. Die drei Nodemailer-Advisories zählen als ein betroffenes Paket, nicht als drei zusätzliche Pakete.

Der vorherige Null-Fund-Bericht vom 23.10.2026 wird nicht rückwirkend überschrieben. Er ist ein zeitgebundenes Scannergebnis; der aktuelle Datenbankstand ersetzt ihn als Aussage über bekannte Paketbetroffenheiten. Veröffentlichungsdatum einer Advisory, Zeitpunkt ihrer Aufnahme in eine Datenbank und Zeitpunkt unseres Scans sind zu unterscheiden.

## Konkrete Befunde und Änderungen

| Kennung | Betroffenheit im Ausgangsstand | Änderung für 1.0.31 / Prüfgrenze |
| --- | --- | --- |
| NW-DEP-05 | Express 4.22.3 verwendet gelockt `body-parser` 1.20.8. GHSA-27r3-jxmh-p828 beschreibt einen Prozessabbruch durch nachlaufende Fehlerbytes komprimierter Requestbodys. Der globale JSON-Parser liegt vor Login-/Rollenprüfungen; komprimierte Anfragen werden im Ausgangsstand standardmäßig dekomprimiert. Auf einem gültig lizenzierten und netzwerkseitig erreichbaren Host ist dieser Produktpfad ohne Anmeldung erreichbar. Keine Ausnutzung einer Liveanlage behauptet. | Lockfile auf `body-parser` 1.20.9. Zusätzlich `inflate: false` an allen vier JSON-Parsern in kanonischer Main-Quelle und manuellem Spiegel. So hängt die Abwehr nicht allein vom tatsächlich aufgelösten Installationsbaum ab. Komprimierte Anfragen sollen vor Dekompression mit 415 abgewiesen werden; bisherige unkomprimierte Größenlimits bleiben. Im isolierten Ausgangsversuch war der unbehandelte Decoderfehler mit Prozess-Exit 1 reproduzierbar. Im korrigierten Stand bestanden alle 28 HTTP-Fälle und die Wiederaufnahme mit normalen Anfragen; Gesamtbuild bestanden. |
| NW-DEP-06 | `nodemailer` 10.0.10 fällt in die betroffenen Bereiche von GHSA-8c8m-p3m8-cjg8, GHSA-m943-m63m-w62w und GHSA-85x2-q946-cp5h. Die vorhandene Einzeladressprüfung verwirft die drei veröffentlichten Beispielformen vor `sendMail`; eine konkrete Empfängerfehlleitung im Produktpfad wurde dadurch nicht reproduziert. Das ist kein vollständiger Ausschluss aller Varianten. | Exakte Aktualisierung auf 10.1.4, die veröffentlichte Korrekturversion. Bestehende TLS-/Einzeladress- und Versandbegrenzungen erhalten. Drei Parserfälle, drei Ablehnungen vor Transport und normale Benachrichtigungskomposition im Speicher bestanden; keine echte SMTP-Zustellung behauptet. |
| NW-ADMIN-HTTP-01 | Allgemeine Admin-Antworten wurden erst nach `Response.json()` auf Struktur und Knotenzahl geprüft. Ein vorheriges Bytebudget fehlte. Übergroße Antworten können Browserressourcen beanspruchen; kein eigener ausnutzbarer Remote-Angriff auf die Anlage wurde nachgewiesen. | Native Begrenzung auf 16 MiB tatsächlich gelesene Antwortbytes vor `JSON.parse`, Abbruch bei Grenzverletzung und Erhalt der bisherigen Endpoint-Zeitbudgets. Strukturprüfung und Type Guards bleiben zusätzlich nötig. 16 neue Stream-/Byte-/Fehlergruppen sowie neun bestehende Connection-Gruppen und der strikte Admin-Typecheck bestanden. |

Die transitive Parseraktualisierung allein garantiert nicht den Abhängigkeitsbaum einer bereits installierten ioBroker-Umgebung. Ein `overrides`-Eintrag im Paket eines konsumierten Adapters wäre ebenfalls kein allgemeiner Installationsnachweis. Deshalb wird die unbenötigte Dekompression zusätzlich an den tatsächlichen API-Eingangsstellen deaktiviert. Die API-Clients des Produktes verwenden unkomprimiertes JSON. Externe eigene Clients müssen dies ebenfalls tun; die Ablehnung komprimierter Bodys ist eine dokumentierte Schnittstellenänderung.

Der Admin-Grenzwert liegt über dem bisherigen 5-MiB-Konfigurationsbudget. Archivdaten bleiben seitenweise begrenzt. Gezählt werden die vom Browser gelieferten Antwortbytes, einschließlich der nach Transportdekompression vorliegenden Daten; ein möglicherweise falscher oder fehlender `Content-Length`-Header darf die Streaminggrenze nicht umgehen. Die bisherigen kürzeren beziehungsweise längeren lokalen Endpoint-Fristen werden nicht pauschal durch eine andere Dauer ersetzt.

Keine zusätzliche Laufzeitbibliothek, keine Änderung von Geräte-Datenpunkten, Leistungsgrenzen, Tarif-/NT-Entscheidungen, Speicher-Stellhoheit oder Lizenzarchitektur ist Bestandteil dieser Korrektur. Der historische NW1-Vertrag bleibt auf ausdrücklichen Nutzerauftrag kompatibel; NW-SECRET-01 bleibt offen.

## Prüfplan und tatsächlicher Abschlussstand

| Prüfung | Tatsächliches Ergebnis / Nachweis |
| --- | --- |
| Ausgangsaudits 1.0.30 | Backend: zwei betroffene Laufzeitpakete, high/moderate. Admin: kein Laufzeittreffer. `evidence/baseline-1.0.30-npm-audit-*-runtime.json`. |
| HTTP- und Mailkorrektur | 28 echte lokale HTTP-Fälle aus den vier Produkt-Parserkonfigurationen bestanden, jeweils weitere normale Anfrage erfolgreich. Drei Mailparserfälle, drei Produktablehnungen vor Transport und lokale Mailkomposition bestanden. `evidence/runtime-security-updates-final.log`. |
| Admin-Antwortgrenzen und Verträge | 16 neue Prüfgruppen plus neun bestehende Connection-Gruppen, tatsächlicher Abbruch und strikte Admin-Typechecks bestanden. [Detailbericht](ADMIN_ANTWORTGRENZE_DE.md). |
| Zweite KI-Gegenprüfung | Keine neuen Blocker im abgegrenzten Patch; zwei zusätzliche native HTTP-Versuche bestanden. [Gegenprüfungsbericht](INDEPENDENT_REVIEW_DE.md). Kein externer Pentest. |
| Abhängigkeiten einschließlich Entwicklungswerkzeugen | Root und Admin am 24.10.2026 jeweils 0 bekannte gemeldete Schwachstellen, Exit 0. `evidence/npm-audit-root-final.json` und `evidence/npm-audit-admin-final.json`. |
| TypeScript-, Admin- und Dokumentationsbuild | Alle bestanden. Strikte Adminquelle und vorhandene gesonderte strikte Sicherheitsgrenzen geprüft; keine Behauptung vollständiger Runtime-Strict-Abdeckung. `build-ts-final.log`, `admin-build-final.log`, `docs-build-post-fixture.log`. |
| Gesamte vorhandene Testsuite | `npm run test:all`: Exit 0, 200.95 Sekunden. Enthält EMS-/Speicher-/Tarif-/NVP-, Zugriffs-, Browser-, Update-, Typ-, Lint- und neue Patchprüfungen. `evidence/test-all-complete.log`. |
| Update-/Überkopierprüfung | In der Gesamtsuite bestanden: 15 Upgrade-/Sicherheitsfälle, alte Admin-Assets, Sicherungen, Wiederholungen, indirekte Chunks und lokaler Publish-Vertrag. Keine externe Veröffentlichung. |
| Paketstart, Dokumentationsabgleich und Publizierbarkeitsprüfung | `test:package-runtime-start-smoke`, `docs:check`, `publish:check` und `npm pack --dry-run --json --ignore-scripts` bestanden. Einzel-Exitcodes in `evidence/final-validation-results.json`. |
| Vollrepository-Verpackung | Verpackungshelfer verlangt alle 470 deklarierten Paketdateien und vollständige Quell-/Testbäume; prüft jede Archivdatei, CRC und SHA-256. Endgültige Archivprüfsumme und Frischentpackungsprüfung werden im separat beigefügten Auslieferungsnachweis dokumentiert, weil sich ein ZIP nicht selbst mit seiner eigenen Prüfsumme enthalten kann. |
| Remote-CodeQL, externe Sicherheitsprüfung, Zielhost/Hardware | Nicht ausgeführt; kein Ersatz durch lokale Tests oder diesen Bericht. |

Prüfumgebung: Linux, Node.js 24.19.0, npm 11.9.0, TypeScript 5.8.3; Browserprüfungen mit separatem Chromium 153. Umgebung und relevante Quellhashes stehen in `evidence/validation-environment.json`. Rohbelege unter `evidence/` sind im vollständigen Repository-ZIP enthalten. Das kleinere npm-Laufzeitpaket enthält ausgewählte Berichte, aber nicht sämtliche Rohbelege.

Der Hashvergleich bestätigt unveränderte Inhalte aller 100 Dateien unter `ems/`, 90 kanonischen EMS-Quellen, 21 kanonischen Lib-Quellen und 64 Lib-Dateien. Unter `www/` ändert sich ausschließlich die Versionsangabe des Webmanifests. `io-package.json` bleibt nach Ausklammerung von Version und Releasehinweisen identisch. Nachweis: `evidence/control-code-comparison.json`. Die Main-Änderungen beschränken sich auf die vier Parseroptionen, den erläuternden Kommentar und die korrekte Spiegelhashbindung.

Drei Zwischenstopps wurden vor dem erfolgreichen Abschluss behoben: Die Auslieferungsliste verwies nach dem Admin-Build noch auf das alte Bundle; sie wurde auf den tatsächlich erzeugten und geprüften Einstieg aktualisiert. Der Geheimnisscanner lehnte einen wörtlichen künstlichen SMTP-Testwert ab; der lokale Test erzeugt ihn jetzt ausschließlich kurzlebig mit nativer Kryptografie. Keine reale Zugangsinformation und keine neue Scanner-Ausnahme. Ein älterer Frontend-Test simulierte HTTP 409 nur mit `json()` statt mit einem nativen Antwortstream; er verwendet jetzt eine native `Response` und den nativen `TextDecoder`, weiterhin mit unveränderten Prüfungen der Fehlermeldung und des Verbots einer erneuten Mutation. Frühere fehlgeschlagene Logs bleiben als `*-prior-*.log` erhalten. Die ESLint-Quellhashbindungen der zwei bereits fachlich geprüften Null-Prototyp-Zugriffe wurden erst nach erneuter Gegenprüfung aktualisiert.

Das Security-Lint-Gate besteht mit **0 neuen/verbotenen Funden**, jedoch weiterhin **2971 historischen offenen Scannerhinweisen** und 48 einzeln geprüften Hinweisen. Scannerhinweise sind keine entsprechend hohe Anzahl nachgewiesener Sicherheitslücken. Sie sind auch kein sauberer Gesamt-Scan und bleiben fachlich abzuarbeiten. Zuständig für Softwarekorrektur und Nachprüfung: EOS-Entwicklung; die reale Anlagenfreigabe bleibt Aufgabe des Anlagen-/Produktverantwortlichen.

## Aktuelle Maßstäbe für sichere Entwicklung

| Maßstab | Verwendung und Grenze |
| --- | --- |
| OWASP ASVS 5.0.0 | Aktuelle stabile ASVS-Fassung laut offizieller Projektquelle am 24.10.2026. Level 2 bleibt Ausgangspunkt für die Web-/API-Anforderungsakte; zusätzliche Anforderungen sind aus dem Anlagenrisiko abzuleiten. Die vollständige anwendbare Einzelprüfung ist weiterhin offen. |
| IEC 62443-4-1:2018 | Anforderungen an den sicheren Produktentwicklungsprozess. System-/Komponentenanforderungen aus 62443-3-3 beziehungsweise 4-2 sind gesondert abzugrenzen. Die Ausrichtung ist keine IEC-Zertifizierung und kein automatischer CRA-Nachweis. |
| NIST SSDF, SP 800-218 Version 1.1 | Auf der offiziellen Veröffentlichungsseite als final geführt. Version 1.2 / SP 800-218 Rev. 1 wird dort als Entwurf geführt; sie wird hier nicht als bereits verabschiedete Pflichtfassung ausgegeben. |

Die Entwicklungsanforderungen umfassen echte strikte Typprüfung, überprüfte `unknown`-Eingaben, serverseitige Berechtigungen, Kontextkodierung, begrenzte Ressourcen und sichere Fehlerbehandlung. Der gesamte React-Admin und die gesonderten Sicherheitsgrenzen werden tatsächlich strikt geprüft. Der historische Runtimebestand einschließlich der Main-Datei ist noch nicht durchgehend strikt beziehungsweise `any`-frei; die eng begrenzte Parserkorrektur beseitigt diese Altlast nicht. Geheimnisse bleiben aus Quelltext, Protokollen und Auslieferungsunterlagen heraus; die bekannte NW1-Ausnahme ist eng begrenzt und kein Geheimnisschutz. Sicherheitslint, Abhängigkeitsprüfung, Quell-/Artefaktbindung und passende positive/negative Regressionen sind technische Prüfschritte. Eine Prüfung darf nicht durch neue pauschale Ausnahmen oder bloßes Neuschreiben von Prüfsummen umgangen werden.

## Was vor einer allgemeinen Kundenfreigabe offen bleibt

- NW-OPEN-01/05: tatsächlicher TLS-/Proxy-/Firewallbetrieb, direkte Erreichbarkeit von Port 8188 und Inventar von Betriebssystem, Node, js-controller, ioBroker und aktiven Drittadaptern am Liefergerät.
- NW-OPEN-02: mögliche kurze historische Displaytokens und `all`-/`lan`-Bedienfreigaben auf dem konkreten Gerät prüfen und erforderliche Umstellungen mit Funktionsnachweis durchführen. Ihr Vorhandensein auf einer bestimmten Anlage ist bisher nicht festgestellt.
- NW-SECRET-01: die bekannte Möglichkeit, historische NW1-Lizenznachweise nachzubilden, bleibt durch die ausdrücklich gewünschte Kompatibilität bestehen. Kein Beleg einer Login-/Adminübernahme; eine Kundenentscheidung oder neue Lizenzarchitektur ist getrennt nötig.
- NW-PROC-04 sowie NW-TS-01/02: belegter Remote-CodeQL-Lauf, vollständige ASVS-Einzelprüfung und schrittweise Bearbeitung des noch nicht vollständig strikt typisierten Altbestands. Lint-/Typbefunde sind nicht jeweils ein nachgewiesener Angriff.
- NW-OPEN-03/06/07: reale Fehler-/Wiederanlauftests, Backup/Restore/Rollback, Support-/Schwachstellenprozess und unabhängige Sicherheitsprüfung des definierten Lieferumfangs.
- Die am 24.10.2026 separat nachgewiesenen Tarif-/NVP-Anzeigeprobleme: widersprüchlicher STANDARD-Hinweis und mögliche Verwendung alter Single-/Farm-Diagnosen bei dynamischer Stellhoheit. Keine durch diesen Patch behobene Ladeblockade und kein nachgewiesener Cyberangriffspfad.

Ein bestandener Scan bedeutet „keine Treffer im verwendeten Datenbestand für den geprüften Baum zum Prüfzeitpunkt“. Die Aussagen „keine Sicherheitslücken“, „100 % sicher“ oder eine allgemeine Kundenfreigabe werden daraus nicht abgeleitet.

## Offizielle Quellen

- [body-parser GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828)
- [Nodemailer – verschachtelte Kommentare](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8)
- [Nodemailer – Gruppentrenner in Kommentaren/Zeichenketten](https://github.com/advisories/GHSA-m943-m63m-w62w)
- [Nodemailer – Winkelklammer innerhalb eines lokalen Adressteils](https://github.com/advisories/GHSA-85x2-q946-cp5h)
- [OWASP ASVS](https://asvs.owasp.org/)
- [IEC 62443-4-1:2018](https://webstore.iec.ch/en/publication/33615)
- [NIST SSDF – Veröffentlichungen und Status](https://csrc.nist.gov/projects/ssdf/publications)

Quellen wurden im Rahmen der Prüfung am 24.10.2026 herangezogen. Technische Produktbelege sind zusätzlich die konkreten Quellen, Lockdateien und tatsächlich ausgeführten Tests dieses Lieferstands.

Der Adapter ist weiterhin nicht npm-abhängigkeitsfrei: Die bestehende ioBroker-/Express-/Mailintegration bleibt erhalten. Dieser Patch fügt keine neue Laufzeitbibliothek hinzu; die zwei aktualisierten Pakete und der unveränderte Admin-Lockfile sind in `evidence/dependency-diff.json` dokumentiert.
