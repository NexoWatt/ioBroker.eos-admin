# Speicherfarm: Regelauftrag und Rückmeldung

Stand: 24.11.2026. Ergänzung nach den Anlagenbildern mit 1 % / 98 % SoC, zwei aktuellen Mitgliedern und 0 W gemessener Farmleistung.

## Befund und Grenze

Eine aktuelle Messung bzw. „Online / Standby“ belegt weder einen vorhandenen EMS-Regelauftrag noch seine erfolgreiche Verteilung oder reale Umsetzung. Die bisherige Tabellenanzeige konnte diese Unterschiede nicht zeigen. Aus den Bildern allein ist die Ursache der ausbleibenden Entladung deshalb nicht nachgewiesen. Die UI-Änderung behauptet keine Behebung der tatsächlichen Hardware-/Regelursache.

## Kleine, ausschließlich lesende UI-Ergänzung

Die Farmseite enthält unter den Mitgliedern drei kompakte Karten:

| Anzeige | Quelle | Bedeutung |
|---|---|---|
| Angefordert | Frische `storageFarm.lastDispatchJson.requestedW`; bei fehlender aktueller Verteilung separat gekennzeichnetes `speicher.regelung.sollW` | Anforderung, keine Messung und keine Freigabezusage |
| An Schreibpfad übergeben | Frisches `lastDispatchJson.acceptedDeliveredW` | Annahme im Schreibpfad; ausdrücklich keine bestätigte physische Batterieleistung |
| Tatsächlich gemessen | Vollständige aktuelle `storageFarm.overviewJson.battery.netW` mit übereinstimmender Mitglieder-/Messabdeckung | Unabhängige Batterie-Messung; Teilabdeckung bleibt unbekannt |

Eine gemeinsame Statuszeile unterscheidet fehlende aktuelle Verteilung, tatsächliche Nullanforderung, keine/teilweise Befehlsannahme, abweichende Annahmerichtung und zwischenzeitlich geändertes EMS-Ziel. Vorhandene Dispatcher-Status-/Grundcodes werden mit festen Übersetzungen oder unverfälschtem Code angezeigt. Fehlt die Ursache, wird sie nicht aus SoC, Online-Status oder 0 W erfunden.

Die frischen Werte von `speicher.regelung.aktiv`, `.sollW`, `.quelle` und `.grund` erscheinen separat. Ein offener Regelungsstatus wird nicht zu „deaktiviert“ oder „gesund“ umgedeutet.

Pro Mitglied gibt es ein aufklappbares Diagnosefeld:

- gemeldete allgemeine bzw. Entladesperren;
- konfiguriertes Entladelimit, ausdrücklich vom effektiven Limit getrennt;
- zugeteilte Lade-/Entladeleistung und angenommener Befehlsbetrag;
- `directionDispatchAvailable`, `dischargeFloorSocPct` und `effectiveMaxDischargeW` für den konkreten letzten aktuellen Auftrag, sofern mitgeteilt;
- konkrete Schreib-/Zuständigkeits-/Rücklesefehler und `statusMatch`.

Die neuen per-result Felder sind mit der Backend-Diagnoseänderung abgestimmt. Ein leeres Limit wird nicht als 0 W ausgegeben, und `dischargeDispatchAvailable` aus dem ursprünglichen Status wird nicht als effektive Verteilbarkeit nach SoC-Untergrenze missverstanden.

Zuordnung: zuerst eindeutiger stabiler `dispatchKey`. Nur für alte Ergebnisse ohne Schlüssel wird ein auf beiden Seiten eindeutiger Name verwendet. Doppelte Namen, doppelte Mitgliederschlüssel und widersprechende Ergebnis-Schlüssel bleiben unzugeordnet. Aufgeklappte Diagnosen bleiben bei Telemetrieaktualisierung offen.

## Aktualität und Bedienung

`lastDispatchJson` benötigt sowohl einen aktuellen State-Zeitstempel als auch einen aktuellen eingebetteten `ts`; ein neu eingelesenes altes JSON wird nicht künstlich verjüngt. Die atomare Messung benötigt ebenfalls aktuelle State-/`updatedAt`-Zeitstempel. Das Zeitfenster beträgt 30 s; Zeitstempel mehr als 5 s in der Zukunft werden verworfen. Offline, fehlend, null, boolesch oder ungültig bleibt unbekannt. Aktuelle 0 W bleiben 0 W.

Die Mitgliedertabelle verwendet nur den aktuellen Status-Snapshot und trennt „Messung online“ von Regelauftrag/Freigabe. Bei Verbindungsabbruch oder Alterung erscheinen keine alten Zeilen als aktuell. Die vorhandene 5-s-Alterungsanzeige aktualisiert nun auch die Diagnose.

Die Darstellung verwendet bestehende EOS-Farben/Karten, zwei Spalten für aufgeklappte Details und eine Spalte bei schmalem Bildschirm. Keine zusätzlichen Freigabeschalter, Konfigurationsänderungen, Hardwarebefehle oder Schreib-API-Aufrufe wurden hinzugefügt.

## Geänderte Quellen

- `ui/src-ts/runtime-executables/www/storagefarm-dispatch.ts` – neuer strikter Renderer.
- `ui/src-ts/runtime-executables/www/storagefarm.ts` – bestehende Seite delegiert Statusqualität/Diagnose und Alterung.
- `ui/www/storagefarm.html`, `ui/www/storagefarm-summary.css` – Karten/Details und begrenzte responsive Darstellung.
- `ui/tsconfig.storagefarm-dispatch-ui.json`, `ui/eslint.storagefarm-dispatch-ui.config.mjs` – strikte Prüfungen.
- `test/eos-storagefarm-dispatch-ui.test.cjs` – zehn neue verhaltensbezogene DOM-Regressionen.

`app.ts` und `main.ts` wurden in diesem UI-Nachtrag nicht geändert. Die Backend-Diagnoseänderung wird separat geprüft/dokumentiert.

## Verifikation

`test/eos-storagefarm-dispatch-ui.test.cjs` plus `test/eos-storagefarm-overview-ui.test.cjs`: **16/16 unter Node 22 und 16/16 unter Node 24 erfolgreich**. Die Tests führen den tatsächlichen neuen Renderer aus und prüfen tatsächliche HTML-IDs, unterschiedliche angeforderte/angenommene/gemessene Werte, 1-%-/98-%-Mitglieder mit 0-/600-W-Zuteilung, vertauschte Ergebnisreihenfolge, gleiche Namen bei verschiedenen Schlüsseln, ambige Altzuordnung, leere Werte, geändertes EMS-Ziel, abweichende Richtung, blockierte Schreibzuständigkeit, alte JSON-/State-Zeitstempel, Verbindungsverlust, HTML-Inhalte als Text und offenbleibende Details.

Strikter TypeScript-Check, eigener typgeprüfter ESLint und tatsächlicher UI-Security-ESLint **10.13.0**: alle erfolgreich, beim neuen Helper **keine Sicherheitsbefunde** und keine Ausnahme hinzugefügt. Protokolle: `raw/farm-diagnostics-ui-node22.txt`, `raw/farm-diagnostics-ui-node24.txt`, `raw/farm-diagnostics-ui-typecheck.txt`, `raw/farm-diagnostics-ui-lint.txt`, `raw/farm-diagnostics-ui-security.txt`.

Der erste DOM-Lauf hatte eine unpassende Textassertion („Befehl“ statt „Leistungsbefehl“); diese Assertion wurde berichtigt, anschließend bestanden beide Node-Versionen. Keine Verhaltensprüfung wurde abgeschwächt.

Chromium-Rendering bleibt in dieser Umgebung vor dem Seitenaufbau durch EPERM blockiert (siehe VISUALISIERUNG.md). Die responsive Darstellung ist deshalb quellengeprüft, nicht per echtem Screenshot abgenommen. Die echte Ursache der ausbleibenden Farm-Entladung benötigt die nun sichtbaren aktuellen Regel-/Verteilungsdiagnosen bzw. eine kontrollierte Geräteprüfung.

## Nachtrag: Eigenes Sollwert-Echo ist keine Gerätebestätigung

Die reale Diagnose mit 681 W verteiltem Sollwert und 31 W Messleistung bestätigt die Notwendigkeit dieser Trennung. Die Annahmekarte heißt ausdrücklich **„An Schreibpfad übergeben“**. Sie bestätigt weder den Treiber noch einen Wechselrichter oder physische Leistung.

Die Einzeldiagnose zeigt zusätzlich `writes.*.readback`:

- `ack:false`, `pending:true` oder `status:pending-ack`: nur Sollwert im ioBroker-DP, Treiberquittierung ausstehend. Auch ein älterer widersprüchlicher `status:confirmed`/`ok:true` bei `ack:false` wird nicht als Bestätigung angezeigt.
- Frischer Zeitstempel, `ack:true`, `readback.ok:true` und `readbackOk:true`: vom Treiber quittiert; ausdrücklich keine bestätigte physische Umsetzung.
- Alter Zeitstempel: aktuelle Quittierung unbestätigt. Fehlendes `ack`: Quittierungsstatus nicht mitgeteilt.

Das ist mit der Backend-Diagnose `confirmationLevel:requested/driver-acknowledged` abgestimmt. Ein ausstehendes Ack wird in der UI weder zur gemessenen Leistung noch automatisch zum Schreibfehler umgedeutet. Der neue DOM-Test deckt 681 W übergeben / 31 W gemessen, altes `confirmed` mit `ack:false`, den neuen Pending-Zustand, frische Treiberquittierung, Alterung und fehlendes Ack ab.

## Nachtrag: Konfiguration und numerische Gerätefreigabe

Bei neuen Status-Snapshots zeigt „Konfiguriertes Entladelimit“ ausschließlich `configuredMaxDischargeW`. Ein vorhandenes `null` bedeutet „Keine feste Grenze hinterlegt“ und wird nicht durch das wirksame Gerätelimit ersetzt. Nur in alten Snapshots ohne dieses Feld bleibt `maxDischargeW` der kompatible Rückfall.

Die getrennten Zeilen „Gerätefreigabe Laden/Entladen“ verwenden `chargeCapability` bzw. `dischargeCapability`: gültiger Wert inklusive echter 0 W, nicht zugeordnet, fehlend, ungültig oder veraltet. Fehlende/ungültige/veraltete Werte werden nicht als Gerätefreigabe 0 W dargestellt, obwohl der sichere Regelpfad intern auf 0 begrenzt. Die acht `charge/discharge_capability_{zero,missing,invalid,stale}`-Gründe haben feste deutsche Übersetzungen. Das effektive Limit der konkreten Verteilung bleibt separat aus `effectiveMaxDischargeW` sichtbar.

Regression: statisch 5000 W / Gerät 250 W / effektive Verteilung 250 W zeigt drei unterschiedliche korrekte Werte. Zusätzlich geprüft sind bewusst unbegrenzte Konfiguration, Altformat, echte Gerätesperre 0 W, fehlende/ungültige/veraltete Gerätefreigaben und nicht zugeordneter Capability-DP. Ack-Wortwahl und eigene DP-Echo-Behandlung bleiben unverändert.
