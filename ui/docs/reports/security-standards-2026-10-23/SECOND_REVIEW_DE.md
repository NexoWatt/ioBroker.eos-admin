<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis untersagt. -->
# Separate KI-Zweitprüfung der neuen Fehlergrenze

Prüfzeit der abschließenden Proben: **23.10.2026, 22:12:31 Uhr Europe/Berlin**
(20:12:31 UTC). Umgebung: Linux, Node 24.19.0, tatsächlicher lokaler
Express-HTTP-Server des erzeugten Adaptercodes, simulierte ioBroker-Speicherung
und Konten, ausschließlich künstliche Fehlermarker. Keine Geräte, keine
Produktivinstallation und keine Veröffentlichung. Geprüfte Dateihashes und
Einzelergebnisse: `second-review-evidence.json`.

Diese Zweitprüfung wurde von einem getrennten KI-Arbeitsgang durchgeführt.
Sie ist **keine unabhängige externe Sicherheitszertifizierung** und keine
vollständige ASVS-Abnahme. Die Gesamtregression und Releaseprüfung führt der
Hauptprüfbericht getrennt.

## Gefundene Restlücken und Nachprüfung

Die Prüfung der Zwischenstände fand drei zusätzliche Offenlegungspfade:

1. Der Installer-Speicherpfad gab weiterhin beliebige `message`-/`details`-
   Eigenschaften fremder Fehler aus, sobald deren `status` und `code` wie ein
   Konfigurationsfehler aussahen. Eine simulierte Speicherausnahme mit HTTP 409,
   `DYNAMIC_GRID_VERSION_CONFLICT` und künstlichem Geheimnismarker konnte so
   fremde Nachrichten und Details zurückgeben.
2. Die Simulations-API bereinigte die unmittelbare Fehlerantwort, schrieb den
   fremden Fehlertext jedoch nach `simulation.lastError`. Ein folgender
   Statusabruf lieferte denselben Marker wieder aus. Vorhandene alte Werte
   waren damit ebenfalls relevant.
3. Der bereits geänderte NexoLogic-Speicherpfad vertraute weiterhin einem
   fremden `code: NEXOLOGIC_CONFIG_INVALID` und gab dessen beliebige `issues`
   aus. Eine simulierte Ausnahme aus `replaceLogicEngine` mit diesem Code
   und `issues: ['SYNTHETIC_REVIEW_SECRET']` wurde über POST
   `/api/logic/editor` mit HTTP 400 und unverändertem Marker reproduziert.

Alle drei Punkte wurden vor dem abschließenden Test nachgebessert:
Öffentliche Konfigurationsfehler erhalten einen internen WeakMap-Vertrag;
fremde gleichartig aussehende Objekte werden nicht dadurch legitimiert.
Simulation schreibt feste Codes und bereinigt auch historische Fehlerwerte
beim Statusabruf. NexoLogic gibt nur registrierte eigene Validierungsdetails
weiter. Die Gesamtregression deckte zwischenzeitlich außerdem einen verloren
gegangenen Mesh-Hinweis zur Stillsetzung auf. Die Korrektur registriert eigene
Mesh-Fehler, statt beliebige gleichnamige Fehler zuzulassen.

Die folgenden **neun separaten Probengruppen** wurden anschließend gegen den
**abschließend erzeugten Laufzeitcode** ausgeführt und bestanden. Die SHA256
von 18 benannten Quell-, Laufzeit-, Generator- und CI-Dateien wurden vor und
nach dem Test verglichen und blieben unverändert:

| Probe | Erwartetes und beobachtetes Ergebnis |
| --- | --- |
| Fremder Speicherfehler mit Status 409, echtem Namen `DYNAMIC_GRID_VERSION_CONFLICT`, fremder Nachricht und Details | Installer-POST ergibt HTTP 500 mit `internal_error`; weder Nachricht noch Details gelangen in die Antwort. |
| Bereits gespeicherter fremder Text in `simulation.lastError` | Status-GET ergibt HTTP 200 und den festen Fehlercode `internal_error`. |
| Neu ausgelöster Simulationsfehler | Unmittelbare Antwort HTTP 500; gespeicherter Fehler und folgender Statusabruf enthalten ausschließlich `internal_error`. |
| Defektes JSON an der anonymen Anmeldung bei nicht gesetztem NODE_ENV | HTTP 400 `invalid_json`; kein SyntaxError, Dateipfad, Stack oder Eingabemarker. |
| Tatsächlich abgebrochener HTTP-Client während eines unvollständigen JSON-Körpers | Server bleibt erreichbar; anschließender autorisierter Statusabruf HTTP 200. |
| Bereits gestartete Antwort, danach weitergereichte Ausnahme | Antwort wird ohne zweite JSON-Antwort beendet; der bereits gesendete Inhalt `partial` bleibt unverändert, kein Fehlermarker erscheint. |
| Intern erzeugter Konfliktfehler, dessen Error-Nachricht nachträglich verändert wird | Gespeicherter unveränderlicher Vertrag behält HTTP 409 und die ursprünglich begrenzte fachliche Meldung. |
| Eigene Mesh-Stillsetzung und fremde gleichnamige Fehler | Installer- und Backup-POST behalten HTTP 409 mit `MESH_APP_PROTECTED` und Stillsetzungshinweis; kein Speichern bei Ablehnung. Direkte Mesh-Konfiguration behält HTTP 422 mit Stillsetzungshinweis. Fremde Objekte mit denselben Status-/Code-Feldern ergeben auf allen drei Pfaden HTTP 500 `internal_error` ohne Marker. |
| Eigene NexoLogic-Validierung und fremde `issues` | Echter Engine-Validator behält HTTP 400 mit `NEXOLOGIC_CONFIG_INVALID` und strukturiertem `node-type-unknown`; fremde Ausnahme mit gefälschtem Code und beliebigen Issues ergibt HTTP 500, leere Issues und keinen Marker in Antwort oder aufgezeichneten Warnungen. |

Die Proben verwendeten das vorhandene `createHarness` aus
`scripts/verify-stable-1.0.9-access.cjs`. Der Installerfehler wurde in
`persistInstallerConfigToState` ausgelöst und mit POST
`/api/installer/config`, `{patch:{},restartEms:false}` geprüft. Die
Simulationsproben ersetzten `nwSimEnable`, `nwSimWriteStatus` und nur die
Rückgabe des States `simulation.lastError`; getestet wurden POST
`/api/sim/enable` und GET `/api/sim/status`. Beim Abbruchtest wurde über
`node:http` ein Content-Length von 99999 angekündigt, ein unvollständiger
JSON-Körper geschrieben und der Client nach 20 ms geschlossen. Für den
Headerfall wurde ausschließlich im Arbeitsspeicher eine synthetische Route
unmittelbar vor der abschließenden Fehler-Middleware eingefügt; nach
`res.write('partial')` folgte `next(new Error(...))`. Diese Test-Route ist
kein Bestandteil des Lieferpakets.

Die Mesh-Probe setzt eine echte `MeshCoordinator`-Instanz im Testadapter ein,
schützt zunächst die aktive App und danach die gesperrte Konfiguration. Erst
für die Negativkontrolle werden `assertAppChange` bzw. `configure` durch einen
fremden Fehler ersetzt. Die NexoLogic-Positivkontrolle verwendet eine echte
`initLogicEngine`-Validierung mit unbekanntem Knotentyp; anschließend ersetzt
die Negativkontrolle ausschließlich `replaceLogicEngine` durch den oben
beschriebenen Fehler. Die Quellprüfung der Simulator-UI bestätigt zusätzlich,
dass der öffentliche `message`-Text wieder bevorzugt angezeigt wird und die
drei eigenen festen Simulationscodes beim Statusabruf erhalten bleiben; das
ist keine zusätzliche Browser-Laufzeitprobe.

Damit sind die drei Zusatzbefunde **im dokumentierten Softwareumfang
korrigiert und nachgeprüft**; der geprüfte Mesh-Stillsetzungshinweis bleibt
erhalten. Daraus folgt keine Zusage, dass jeder bislang ungeprüfte
Legacy-Fehlerpfad geheimnisfrei ist.

Das separate reproduzierbare Skript liegt als `independent_http_review.cjs`
in diesem Berichtordner. Aus der Repository-Wurzel mit bereits installierten
Entwicklungsabhängigkeiten und erzeugtem Laufzeitcode:

```sh
node docs/reports/security-standards-2026-10-23/independent_http_review.cjs . /tmp/nexowatt-second-review.json
```

Es startet ausschließlich Loopback-Testserver, beendet diese wieder und
schreibt nur die angegebene Ergebnisdatei. Der Skripthash ist im mitgelieferten
`second-review-evidence.json` festgehalten.

## Quellprüfung von Generator, Guard und CodeQL

- Der Generator trennt nur den exakt definierten eigenen führenden Lizenzblock
  vom Source-Header und setzt ihn vor den erzeugten Build-Hinweis. Ein
  Transpilierungsmarker in einem gewöhnlichen Kommentar oder String aktiviert
  diesen Pfad nicht. Die mitgelieferten Generatortests decken diese Varianten ab.
- Der neue Compiler-/Syntaxguard bezieht sich ausdrücklich auf die benannte
  Fehlergrenze. Er verlangt echte strikte Typprüfung ohne `noCheck`, keine
  expliziten `any`, keine Unterdrückungsdirektiven, keinen Import und keinen
  erkannten dynamischen Ausführungskonstruktor in diesem Modul. Die Auswertung
  ist eine begrenzte Syntaxprüfung; sie ist weder ESLint noch eine vollständige
  Datenflussanalyse und kein Beweis gegen jede absichtlich verschleierte
  JavaScript-Konstruktion.
- Die CodeQL-Konfiguration analysiert maßgebliche TS-/Admin-Quellen und lässt
  generierte Spiegel, Tests und Fremdpakete aus. Der Workflow verwendet
  festgelegte Action-Commits, minimale Standardrechte und kein npm-Installieren
  oder Ausführen des Produktcodes. Das Schreiben von Sicherheitsresultaten ist
  auf den Analysejob beschränkt. Ein erfolgreicher Lauf in GitHub oder
  aktivierter Branchschutz wurde durch diese Quellprüfung nicht nachgewiesen.

**Abschluss:** Keine weitere blockierende Regression in den gezielt geprüften
Änderungen gefunden. Offene Bestandsfragen (`any`/`@ts-nocheck`, vollständige
ASVS-Zuordnung, TLS-/Proxy-Zielumgebung, alte Lizenzarchitektur und tatsächlicher
Remote-CI-Lauf) bleiben ausdrücklich offen.
