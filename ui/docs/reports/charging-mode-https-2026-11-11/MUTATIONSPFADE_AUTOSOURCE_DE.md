# Lademodus-Schreibpfade und Auto-Steuerquelle

Prüfung am 11.11.2026 am Arbeitsstand des Folgepakets zu 1.0.35. Die Zeilen
beziehen sich auf `src-ts/runtime-executables/`; generierte Runtime-Dateien werden
im gemeinsamen Releasebuild geprüft. Diese Prüfung verwendet keine reale Wallbox.

## Vollständigkeitsreview

| Pfad und Zeile | Auslöser / Ziel | Befund und HTTPS-Abdeckung |
| --- | --- | --- |
| `www/app.ts:9929` | Hauptseiten-Dialog: EMS `evcs.1.userMode`; ohne EMS alternativ `evcs:1.mode` oder `settings:evcsMode` | Eigener Hauptseitenhandler, relevant bei Einzelwallbox-Umleitung. Separater Fix und Tests im Hauptseitenreview. Alle POSTs gehen an `/api/set`. |
| `www/evcs.ts:1918` | Ladepunkt-Modustasten → `evcs.N.userMode` | Bestätigtes Readback, sichtbare Fehler, Timeout und gemeinsame Ladepunkt-Schreibsperre. |
| `www/evcs.ts:1979` | Standard/Betriebsstrategie → `evcs.N.autoSource` → `userAutoSource` | Zusätzlich reproduzierter gleicher UI-Fehler. In diesem Schritt korrigiert und getestet. |
| `www/dc-station-display.ts:383` | Kiosk-/DC-Display: Moduswahl, Start und Stop → `/api/display/station/:token/command` | Vorhandene HTTP-/JSON-Prüfung, Busy-Sperre und Serverpayload; keine optimistische Modusübernahme gefunden. Kein Hardwaretest. |
| `main.ts:21746`, `21907`, `23208` | Kiosk-/Display-API schreibt `userMode` bzw. Startmodus über Charging Management | Awaited Serverwrites und Fehlerantwort. Derselbe generische Ladepfad, kein eigener OCPP-Modusweg. |
| `www/ems-apps.ts:10968`, `14299` | Installer wählt Konfigurations-Standardmodus und speichert `/api/installer/config` | Ändert Konfigurationsentwurf; Save prüft HTTP/JSON. Kein direkter Laufzeit-Klickwert. |
| `main.ts:24934`, `25095` | `/api/set`, Scope EMS, einschließlich `emsMode`-Kompatibilitätsalias | Canonicalwerte `standard|strategy` bzw. `auto|pv|minpv|boost`; awaited Schreibvorgang, Cache und unmittelbarer EMS-Tick. |
| `main.ts:25476` | Legacy Scope EVCS → konfigurierter numerischer Modus-Datenpunkt | Backendpfad des Hauptseiten-Fallbacks. Kein direkter UI-`nativeMode`-Schreibpfad gefunden. |
| `main.ts:27789` | Extern/interner `evcs.N.mode`, ack=false → `userMode`; Gegenrichtung ack=true | ioBroker-State-Brücke außerhalb HTTPS. Siehe abgegrenzten Restpunkt unten. |
| `ems/modules/charging-management.ts:5506`, `6379`, `8469`, `8535` | Initialisierung leerer States, unzulässiger Boost, Boost-Timeout | Initialisierung überschreibt keine bestehende Nutzerwahl; beabsichtigte Boost-Rückkehr zu Auto. |

`www/runtime-base.ts:56–94` behandelt alle genannten `/api/...`-URLs im
Same-Origin-Fetch-Wrapper. Der HTML-Sender lädt diese Basis vor den Seitenskripten.
Es wurde in den untersuchten Modus-Schreibpfaden keine fest codierte
`http://`-Gegenstelle gefunden. Ein Sitzungs-/HTTP-Fehler kann trotzdem auftreten;
genau dafür ist die bestätigte Anzeige nötig. Der tatsächliche Vorfall ist durch
diese Codeprüfung allein nicht abschließend einer Ursache zugeordnet.

## Zusätzlich korrigierter Befund

Erweiterung zu **NW-EVCS-20261111-01**: Der Auto-Quellenhandler hatte weiterhin
sofort den lokalen State auf Standard/Strategie gesetzt und HTTP-Fehler sowie
Transportfehler verworfen. Bei abgelehntem POST zeigte er dadurch einen
unbestätigten Regelungsweg an.

Der Handler zeigt jetzt nur bestätigte Backendwerte. Beide legalen Werte bleiben
unverändert. Ein verlorener POST-Response wird durch State-Readback aufgelöst;
ungültiger/fehlender Readback behält den letzten bestätigten Wert und zeigt eine
Warnung. Mode und Auto-Quelle blockieren weitere Schreibaufträge am gleichen
Ladepunkt bis zum Abschluss; andere Ladepunkte bleiben bedienbar. Je Fetch
begrenzt ein echter AbortController den lokalen API-Auftrag auf zehn Sekunden.
Die Auto-Quelle wird ebenso wie der Modus gegen ältere Serverzeitstempel geschützt.

Die neuen UI-Statuscontainer verwenden Maps. Vollsnapshot- und SSE-Zusammenführung
erzeugen Dictionaries ohne Prototyp; JSON-`__proto__` bleibt ein Datenkey. Ein
gezielter Test bestätigt dieses Verhalten. Vorhandene HTTP-/Berechtigungsgrenzen,
Gerätedatenpunkte, Phasen- und Leistungsgrenzen werden nicht geändert.

## Ausgeführte Prüfungen

Node.js v24.22.1, VM mit DOM-/Fetch-Mocks, kein Netzwerk und keine Hardware:

- `node scripts/verify-evcs-mode-write-failure.cjs --canonical`
- Vor dem Quellenfix: bestehende 21 Modustests bestanden; von 15 ergänzten
  Quellentests schlugen 14 fehl. Der Test zur verlorenen Antwort konnte allein
  anhand des Endwerts auch mit dem alten optimistischen Handler bestehen und
  wurde danach zusätzlich auf tatsächliches Readback verschärft.
- Nach dem Fix: **37/37 bestanden** (21 bestehende Modustests, 15 Quellentests,
  ein zusätzlicher Prototyp-Key-Test).
- Quellenfälle: 401/403/500, `ok:false`, ungültiges JSON, Netzwerkfehler,
  Standard/Strategie-Erfolg, gegenseitige LP-Sperre, andere Ladepunkte,
  neuere SSE-Werte, Vollsnapshot, verlorene Schreibantwort, ungültiger Readback,
  Timeout/Retry und deaktivierte/ungültige Controls.
- Rohbelege: `evcs-auto-source-before.log`, `evcs-auto-source-after.log`.

Der gemeinsame Runtime-/Typ-/Releasecheck wird im Hauptprüfbericht nachgeführt.
Die Source- und Testdateien wurden hier nicht synchronisiert oder gebaut.

## Abgegrenzte Restpunkte

- Phase, Speicherunterstützung, Regelungsfreigabe und Zielvorgaben haben angrenzende,
  teilweise ebenfalls optimistische Handler. Sie sind keine `userMode`- oder
  `userAutoSource`-Mutationen und wurden in diesem Schritt nicht verändert. Ihre
  HTTP-Fehlerbehandlung bleibt separat zu härten; keine pauschale Fehlerfreiheit
  aller Wallbox-Bedienelemente ableiten.
- Die numerische State-Brücke in `main.ts:27799` aktualisiert den UI-Cache ohne
  awaited Persistenz und verwirft Schreibfehler. Das ist eine weitere sichtbare
  Zuverlässigkeitslücke im externen ioBroker-Kompatibilitätspfad, hier ohne
  Fehlerreproduktion und ohne Nachweis als Ursache der HTTPS-Beobachtung. Eine
  separate Prüfung mit fehlgeschlagenem `setStateAsync` ist erforderlich.
- Keine Live-OCPP-Verbindung, kein Nachtladeversuch und keine Prüfung des realen
  Stecker-/Statuswechsels durchgeführt. Diese Übergabe ist keine Hardwarefreigabe.
