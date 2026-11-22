# Einzel-Ladepunkt: bestätigte Moduswahl und HTTPS-Fehler

Stand: 11.11.2026; Ausgangspaket 1.0.35, korrigierter Quellstand für Testversion 1.0.36.

## Reproduzierter Befund

Bei genau einem Ladepunkt öffnet die LIVE-Kachel den Modusdialog aus `www/app.js`.
Erst ab zwei Ladepunkten führt sie zu `evcs.html`. Der einzelne Modus-Schreibpfad
in `src-ts/runtime-executables/www/app.ts` verwendete denselben optimistischen
Klickwert sowohl für die Hervorhebung als auch für die Zielladen-Sichtbarkeit.
Er prüfte weder HTTP-Status noch JSON-Erfolg und las den Servermodus nicht zurück.
HTTP 401/403, Fehlerantworten und weitergeleitete Login-Seiten konnten deshalb
kurzzeitig Auto anzeigen, obwohl der Server weiterhin PV führte. Bei ausbleibendem
Live-Update konnte diese Anzeige bestehen bleiben. Dieser Befund erklärt eine
mögliche Anzeige-/Serverabweichung; er beweist nicht die Ursache des konkreten
OCPP-Ladeausfalls des Nutzers.

Der unveränderte Originalcode wurde ausschließlich aus
`NexoWatt_UI_1.0.35_ADMIN_HTTPS_FIX_FULL_REPOSITORY.zip` entnommen.
SHA-256 Original `www/app.js`:
`e88c2e18009704320f62f0ebd6c66dafd48f2b31af34a4187a509645d8b98ea8`.

Der Vergleich des gesamten Modalblocks aus den Originalarchiven 1.0.34 und 1.0.35
zeigt genau eine Änderung: die Navigation zur Mehrladepunktseite wird durch
`NW_RUNTIME.url` geführt. Der fehlerhafte Einzel-Ladepunkt-Schreibhandler selbst
ist unverändert. Der Bestätigungsfehler bestand somit bereits vor dem HTTPS-Fix;
eine zusätzliche Sitzung kann ihn auslösen, ist aber nicht seine Codeursache.
Beleg: `app-modal-1.0.34-1.0.35.diff`.

## Änderung

- Alle drei Moduspfade desselben Dialogs sind abgedeckt: EMS
  `ems / evcs.1.userMode`, Legacy `evcs / 1.mode` und
  Legacy `settings / evcsMode`.
- Der letzte bestätigte Backend-Modus bleibt während der Anfrage sichtbar.
  Der Dialog zeigt den laufenden Speichervorgang gesondert und sperrt weitere
  Modusklicks bis zum Abschluss. Ein Live-Update hebt diese Sperre nicht auf.
- Jede Anfrage prüft HTTP-Erfolg und JSON. Der POST benötigt zusätzlich
  `{ "ok": true }`. Danach erfolgt genau ein lesender, ungecachter `/api/state`-
  Abruf; es gibt keine automatische Wiederholung des Schreibauftrags.
- Ein verlorener POST kann bereits ausgeführt sein. Ein gültiger Readback des
  gewünschten Zustands bestätigt ihn trotzdem. Bei einem abweichenden Readback
  wird der tatsächliche Zustand angezeigt und die Abweichung erklärt.
- Moduswerte, Datentyp und Zeitstempel werden geprüft. Ältere Readbacks oder
  Snapshots verdrängen keinen bereits bestätigten neueren Modus. Ein Wechsel der
  Modusquelle während der Anfrage verwirft die Antwort der alten Quelle.
- POST und Readback haben jeweils 5 Sekunden Abbruchfrist einschließlich
  Antwortkörper. Timer werden geschlossen, Bedienelemente danach freigegeben.
- HTTP 401/403 und Login-HTML erhalten einen sichtbaren Hinweis auf Anmeldung und
  Berechtigung. Ein ausdrücklich anzuklickender Link lädt dieselbe Seite auf
  derselben Origin neu. Kein globales Auth-Skript, fremder Login-Endpunkt oder
  automatischer Schreib-Retry wurde ergänzt. Antworttexte werden nicht angezeigt.

Die UI bestätigt damit die gewünschte Betriebsart im NexoWatt-Backend. Eine
bestätigte Moduswahl ist weiterhin keine physische Ladestartbestätigung der Wallbox.
Backend-Berechtigungen, OCPP-Kommandos, Anlagenlimits und Schutzfunktionen bleiben
unverändert.

## HTTPS-Abgrenzung

`runtime-base.js` schreibt die eigenen API-Pfade im Admin-Proxy auf denselben
HTTPS-Ursprung mit Instanzpräfix um. Die Modaltests führen diesen tatsächlichen
Wrapper aus, einschließlich Header, Request-Body, Credentials und Abort-Signal.
Ein direkter Pfadfehler durch HTTP-/HTTPS-Mischung wurde dabei nicht gefunden.
Die zusätzliche Admin-Sitzung kann aber eine 401/403- oder HTML-Loginantwort
verursachen und somit den vorhandenen Bestätigungsfehler sichtbar machen.

Die separate Prüfung von Laufzeitpfaden bestand 12/12 VM-Fälle für direkten
HTTP-/HTTPS-Zugriff und die Proxyvarianten mit und ohne öffentlichem Admin-Präfix.
`/events` verwendet denselben URL-Helfer. Der Service Worker wird unter dem
Admin-Proxy nicht registriert; sein vorhandener Fetch-Handler verarbeitet keine
POSTs und behandelt API-Daten ungecacht. Ein HTTP-Service-Worker kontrolliert
keine neue HTTPS-Origin. Daraus ergibt sich kein belegter Cache-Auslöser.

## Nachweis

Prüfumgebung: Node 24.22.1, VM mit synthetischer DOM-Fassade und simulierten
HTTP-Antworten. Ausgeführt werden der echte Modalblock und der echte
`www/runtime-base.js`-Wrapper. Kein Browser-E2E, kein Admin-Server, kein Netzaufruf
und keine OCPP-Hardwareverbindung in diesen Tests.

Reproduzierbarer Test:
`node scripts/verify-live-evcs-mode-confirmation.cjs --canonical`.

- Korrigierter kanonischer Stand: **48/48 bestanden**.
- Original 1.0.35: **1 bestanden / 47 erwartete Regressionstestfehler**. Die
  Negativfälle reproduzieren insbesondere Auto trotz abgewiesener Speicherung.
  Erfolgsfälle des neuen Vertrags schlagen im Original zusätzlich wegen des
  fehlenden Readbacks fehl; sie sind keine 47 unabhängigen Produktfehler.
- Direkt HTTP und HTTPS-Admin-Proxy: Auto, Boost, Min+PV, PV; HTTP 401/403/500,
  JSON-Ablehnung, ungültiges JSON, 302 gefolgt von Login-HTML, Netzabbruch;
  getrennte Fehler bei POST und Readback; Zeitlimit vor und nach den Headern;
  Legacy-Modi; Boost-Abbruch; Doppelaktion; veraltete Antworten; Quellwechsel;
  ungültige/fehlende Zustände; neuere Live-Änderung nach erfolgtem Readback.

Rohbelege: `live-mode-canonical.json`, `live-mode-original.json`,
`runtime-path-check-results.json`. Die JSON-Nachweise binden die geprüften
Produktdateien per SHA-256. Generierte JS-Dateien müssen im finalen Release nach
dem Build erneut mit demselben Test geprüft werden.

## Angrenzende Pfade und offene Abnahme

Im selben LIVE-Dialog sind `evcs.1.stationEnabled` und `evcs.1.regEnabled` separate
optimistische Schalter mit ungeprüftem `fetch`. Zielladen-Felder, Phasenmodus und
Speicherfreigabe nutzen dort den älteren `apiSet`-Helfer mit HTTP-Prüfung, jedoch
ohne denselben JSON-/Readback-Vertrag. Sie schreiben keine `userMode`-Werte und
sind nicht Bestandteil dieser fokussierten Modusänderung. Die Auto-Quellenwahl
Standard/Strategie liegt in `evcs.ts` und wird separat nachgebessert.

Ein realer Ablauf mit ablaufender Admin-/EOS-Sitzung, installierter Testversion,
OCPP-Wallbox, Nachtladung und gegebenenfalls Fahrzeug-Aufwecken ist weiterhin
auf der Anlage zu prüfen. Aus den VM-Prüfungen wird keine vollständige
Hardwarefreigabe oder Fehlerfreiheit aller Ladekonfigurationen abgeleitet.
