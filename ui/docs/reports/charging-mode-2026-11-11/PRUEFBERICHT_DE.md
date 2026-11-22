# NexoWatt UI – Lademodi und ausbleibender Ladestart

Prüfdatum: 11.11.2026. Geprüfte Basis: **NexoWatt UI 1.0.35**, aus `NexoWatt_UI_1.0.35_ADMIN_HTTPS_FIX_FULL_REPOSITORY.zip` vom 03.11.2026. Dies ist der jüngste in der Dateisuche gefundene vollständige UI-Quellstand. Die tatsächlich installierte Version, Wallbox, Firmware und Kommunikationsadapter sind noch nicht bestätigt.

**Ergebnis:** Mehrere konkrete Codefehler sind reproduziert und als Quellkorrektur vorbereitet. Eine eindeutige Zuordnung des nächtlichen Vorfalls zu einem einzelnen Fehler ist mit diesem CSV nicht möglich. Der mögliche OCPP-Wiederanlaufdefekt bleibt offen. Dieses Paket ist ein **Review-Quellpatch, kein installierbares oder npm-fertiges Release**. Die produktiven JavaScript-Dateien und Versionsnummern wurden nicht geändert.

## 1. Was der Log belegt

Quelle: `nexowatt-lademanagement-log-2026-11-11T05-07-49-062Z.csv`, 240 Datensätze, ausschließlich LP1. SHA-256: `fb16301f7f083f3ba78e8eb598931adf31211e3a6aa987db9776e7b47df57687`.

Alle folgenden Zeiten sind am 11.11.2026 in Deutschland, MEZ (UTC+1). CSV-Zeilen zählen einschließlich Kopfzeile.

| Zeit | CSV-Zeilen | Beobachtung |
|---|---:|---|
| 04:40:17–05:39:01 | 2–155 | Effektiver Modus `pv`, Anforderung/Soll/Ist 0 W, `no-charge-demand`, `safe-zero`. |
| 05:39:13 | 156 | Wechsel zu `boost`, Anforderung und Soll 11.000 W, `applied`, `safety-approved`. Ist bleibt 0 W. |
| 05:41:41–05:41:44 | 164–165 | Diagnose wechselt kurz von `no-charge-demand` zu `none` und zurück. |
| ab 05:42:04 | ab 166 | Diagnose dauerhaft `none`, zunächst weiter 0 W Ist. |
| 05:42:41 | 169 | Erste enthaltene positive Istleistung: 10.719 W, 3:28 Minuten nach erstem 11-kW-Soll. |
| bis 06:07:42 | bis 241 | Istleistung durchgehend etwa 10,5–10,7 kW. Safety-Stufe im gesamten Export `NORMAL`. |

Der Export enthält **den Vorabend und das ursprüngliche Einstecken nicht**. Der Audit-Ringpuffer ist im Code auf 240 Ereignisse begrenzt. Der genaue Zeitpunkt des Aus-/Einsteckens sowie Protokollantworten fehlen. `applied` in dieser Diagnose ist kein Nachweis einer physisch gestarteten Ladung.

Die Spalte `Modus` enthält laut `charging-management-audit.ts` den effektiven Modus. Ein vom Benutzer gewähltes Auto kann regulär eine PV-Teilstrategie ausführen. Das Fehlen von `auto` in dieser Spalte beweist deshalb nicht, dass die Auswahl verloren ging.

Die Stromspalte enthält ab Boost wörtlich `15. Sep`; der Name erscheint als `3,11107E+17`. Das spricht für eine Tabellenkonvertierung. Ursprüngliche Stromwerte oder Kennungen wurden daraus nicht zurückgerechnet. Für weitere Diagnose den JSON-Export oder unveränderten Originalexport verwenden.

## 2. Reproduzierte Befunde und Korrekturen

### NW-EVCS-20261111-01 – Oberfläche bestätigt fehlgeschlagenen Moduswechsel

**Priorität: hoch.** Im ursprünglichen `www/evcs.js`, Funktion `handleModeButton` (Zeilen 1874–1909), wird der Modus vor dem Speichern lokal gesetzt. HTTP-Fehler werden nicht geprüft; Netzwerkfehler werden still abgefangen. In isolierten Tests bleibt Auto angezeigt, obwohl der Backendmodus nach HTTP 403 oder Netzwerkfehler PV ist. Das passt zum beschriebenen Unterschied zwischen Anzeige und Regelung, ist aber noch kein Beleg für den konkreten Vorfall.

Korrektur in `src-ts/runtime-executables/www/evcs.ts`: Modus aus bestätigtem Backendzustand anzeigen; HTTP- und JSON-Ergebnis prüfen; nach Schreibversuch den Zustand zurücklesen; Fehler sichtbar machen. Pro Ladepunkt wird nur eine Modusanfrage gleichzeitig zugelassen. Ältere Snapshots dürfen neuere mit Zeitstempel versehene Moduszustände nicht überschreiben. Anfragen haben einen Abbruchzeitgeber. Ein erfolgreicher Readback bestätigt auch dann den tatsächlichen Servermodus, wenn die vorherige POST-Antwort verloren ging. Keine Änderung an serverseitigen Berechtigungen.

Nachweis: `scripts/verify-evcs-mode-write-failure.cjs --canonical`, echte UI-Funktionen in isolierter VM, kein vollständiger Browser-/Gerätetest. Bei gleichen Zeitstempeln oder rückspringender Serverzeit ist ohne Sequenznummer keine vollständige Ereignisordnung bewiesen.

### NW-EVCS-20261111-02 – Auto mit „cheap-grid“ übersieht positive günstige Preise

**Priorität: hoch, bedingte Konfiguration.** Im ursprünglichen `ems/modules/charging-management.js:8597` prüft `energySourcePolicy='cheap-grid'` ausschließlich `tarif.netzbezugBevorzugt`. Dieses Flag wird im Tarifmodul für den negativen Preissonderfall verwendet. Ein positiver günstiger Preis allein öffnet diesen Strategiepfad deshalb nicht.

Repro: Auto, aktive Betriebsstrategie `cheap-grid`, frischer günstiger Tarif 0,10 €/kWh, erteilte EVCS-Netzfreigabe, Fahrzeug B2, kein PV, 11 kW Budget. Vorher: `pv`, Soll 0 W. Korrigiert: `normal`, begrenzter Start mit 4.140 W im verwendeten Mock.

Korrektur in `src-ts/runtime-executables/ems/modules/charging-management.ts`: günstige positive und negative Fenster zulassen, aber nur mit aktivem/frischem Tarif und bestehender entprellter Netzfreigabe. HT-/NT-, Prioritäts-, Hold- und Leistungsgrenzen bleiben wirksam. Dieser Befund erklärt den Feldvorfall nur, wenn diese Betriebsstrategie tatsächlich aktiv war.

Nachweis: `scripts/verify-auto-cheap-grid-window.cjs --canonical`, 16 Mock-Regelticks, unter anderem günstige/negative/teure/neutrale Preise, HT, NT, fehlende Freigabe, alte Preise, deaktivierter Tarif, Hold, Pause, PV-only, zu kleines Budget, explizit PV/Boost.

### NW-EVCS-20261111-03 – Diagnose meldet Bedarfssperre trotz positivem Soll

**Priorität: mittel.** `buildChargingAuditSnapshot` bildet `targetW` nach `targetPowerW` ab. `deriveChargingAuditLimiter` prüft anschließend weiter `entry.targetW`. Das fehlende Feld wird zu 0; bei angeschlossenem Fahrzeug und unbestätigtem Bedarf erscheint dadurch `no-charge-demand`, obwohl etwa Boost bereits 11.000 W Soll hat. Dieser Codefehler reproduziert genau die widersprüchliche Kombination im CSV; er ist selbst keine Ladeleistungsbegrenzung.

Korrektur in `src-ts/runtime-executables/ems/services/charging-management-audit.ts`: korrektes Snapshotfeld mit Rückwärtskompatibilität für direkte `targetW`-Aufrufer nutzen. Schreib-/Zuordnungsfehler werden vor der rein informativen Bedarfsmeldung ausgewiesen; bestehende Schutzlimit-Prioritäten bleiben erhalten.

Zusätzlich führen Audit-Ereignisse nun Benutzermodus, Verbindungsstatus, bestätigten Bedarf, Bedarfsgrund und Fahrzeugstatus mit. Reine Änderungen dieser Diagnosefelder werden erkannt. CSV hängt fünf Spalten an; bisherige Spalten bleiben an ihrer Position. Ältere Ereignisse bleiben mit leeren Zusatzfeldern lesbar. Der Ringpuffer bleibt begrenzt.

Nachweise: `scripts/verify-charging-audit-start-mode.cjs --canonical` und `scripts/verify-charging-csv-mode-context.cjs --canonical`. Reale Snapshot-/Ereignis-/Exportfunktionen; kein vollständiger Browser-/Gerätetest.

### NW-EVCS-20261111-04 – „No EV connected“ wird als verbunden erkannt

**Priorität: mittel.** Die positive Teilzeichenfolge `evconnected` wird vor ihrer negierten Form ausgewertet. Auch zusammengesetzte Texte wie „No EV connected, charging disabled“ können dadurch falsch als verbunden/startfähig gelten. Das ist ein eigenständiger Fehler; er erklärt nicht automatisch eine übersehene Verbindung.

Korrektur in `src-ts/runtime-executables/ems/modules/charging-management.ts`: bekannte negierte Fahrzeugtexte vor allgemeinen positiven Textmustern behandeln. Explizite Fehler-/Offline-/Unavailable-Signale, konfigurierte Zuordnungen und CP-Priorität bleiben bestehen.

Nachweis: `scripts/verify-evcs-vehicle-status-regressions.cjs --canonical`, 27 Parser- und Prioritätsfälle einschließlich zusammengesetzter Texte, echter Pause, Finishing und Fehlerpriorität.

## 3. Offener Wiederanlaufbefund

**NW-EVCS-20261111-05, Priorität hoch zur Klärung:** Im OCPP-Pfad kann ein 24 Stunden alter `transactions.chargingState='SuspendedEV'` durch aktuelle Stations-/Transaktions-Liveness weiterhin als frisch gelten. Bei Zusammenführung überstimmt er einen neueren `Preparing`-Status; Startberechtigung bleibt false. Der originale Frischeausdruck und die tatsächlichen Normalisierungs-/Mergefunktionen reproduzieren diesen Zustand auch mit `transactionActive=false`.

Die Konstellation beweist noch keine tatsächliche alte Sitzung. `transactionActive=false` kann auch vor Transaktionsbeginn gelten. Eine pauschale Alterskorrektur könnte eine echte Fahrzeugpause übergehen. **Daher enthält der Patch keine automatische Aufhebung von SuspendedEV und keine Änderung dieses Frischepfads.** Der offene Fall wird im neuen Statustest ausdrücklich als `OPEN` ausgegeben, nicht als bestandene Wiederanlaufkorrektur.

Für die gezielte Lösung fehlen Wallbox-/Firmware-/Adapterversion, Rohstatus mit Zeitstempeln, Transaktions-/Sessionkennung, CP-/Plugstatus, Freigabe und Schreibantworten. Das konkrete erneute Einstecken ist im CSV nicht markiert. Ziel der Fortsetzung ist ein nachgewiesener Sitzungswechsel und kontrollierter Wiederanlauf, bei dem echte Fahrzeugpause und Störung erhalten bleiben.

## 4. Durchgeführte Prüfungen und Grenzen

Umgebung: Linux-Testcontainer, Node.js v24.22.1. Kanonische Quellen werden mit `node:module.stripTypeScriptTypes` im Speicher ausgeführt. Das ist eine experimentelle Node-API und **kein TypeScript-Typecheck, kein regulärer Produktbuild und kein Hardwaretest**. Vorhandene Laufzeitabhängigkeiten und bestehende Mock-Harnesses werden verwendet. Rohbelege und Quellhashes sind dem Paket beigelegt.

Neue gezielte Regressionstests prüfen die korrigierten Pfade mit `--canonical`. Ihre Ausgaben und Exitcodes stehen in `evidence/final-tests.json`. Tests gegen unverändertes Runtime-JavaScript reproduzieren die Ausgangsfehler. Die generierten Produktdateien bleiben bewusst dem Originalstand zugeordnet.

22 bestehende Regressionen wurden zusätzlich mit kanonischem Charging-/Audit-Modul ausgeführt:

- **18 bestanden**, darunter Auto-Wallboxvertrag, Orchestrator, Bedarf/Reservierung, Statusnormalisierung, Stationsfreigabe, Min+PV-Funktion, Netz-/Phasen-/Stationsbudget, Speicher-Warteverhalten und Diagnose.
- **3 nicht ausführbar**, weil das vorhandene Projektwerkzeug `typescript` in dieser Umgebung fehlt: Input-Refresh-Hardening, Zero-Export-Charging und Stable-1.0.18-Charging. Ohne Quellkorrekturen tritt derselbe Abhängigkeitsfehler auf.
- **1 bestehender Testfehler:** `verify-charging-minpv-base-mode-reaction.js` erwartet einen exakten alten Quelltext. Die erwartete Zeichenfolge fehlt bereits im Original-ZIP. Der separate funktionale Min+PV-Test besteht. Der Quelltexttest wurde nicht passend zur Implementierung umgeschrieben.

Der vorhandene Repository-Geheimnisguard wurde ausgeführt: keine Treffer innerhalb seiner unterstützten Regeln. Dies ist keine Garantie vollständiger Geheimnis- oder Schwachstellenfreiheit. Es wurden keine neuen Abhängigkeiten, Cloudabrufe oder produktiven Gerätebefehle eingeführt.

Nicht ausgeführt: vollständige Release-/Build-/Typecheckkette, neue JavaScript-Generierung, npm-Paketprüfung, vollständiger Browserlauf, echte ioBroker-/Wallboxintegration und Nacht-/Feldtest. Es wurde nichts veröffentlicht oder auf der Anlage geändert. Es wird keine Produktionsfreigabe, 100-prozentige Fehlerfreiheit oder CRA-Konformität bescheinigt.

## 5. Übernahme und Abnahme

Der Patch enthält vier geänderte kanonische Produktdateien, fünf neue Regressionstests und diesen Prüfbericht. `source/` enthält die betroffenen vollständigen Dateien zum Vergleich. `changes.patch` ist gegen das unveränderte 1.0.35-Archiv erzeugt. `review-manifest.json` bindet Ausgangsarchiv und Dateien über SHA-256. Das ist ein Prüfmanifest, keine Release-SBOM. Bestehende Komponenten wurden nicht verändert; für ein späteres Release sind die tatsächliche SBOM und Artefaktprüfung neu zu erzeugen.

1. Tatsächlich installierte Version und verbindlichen aktuellen Entwicklungsstand abgleichen. Bei einem neueren Stand Änderungen fachlich übernehmen, kein Downgrade auf 1.0.35 durchführen.
2. In einem gesicherten Entwicklungscheckout `git apply --check changes.patch` prüfen und den Patch übernehmen. Ohne Git entsprechend die kanonischen Dateien und Tests vergleichen. Keine Quelltexte direkt in ein laufendes ioBroker-Paket kopieren.
3. Mit den vorhandenen Projektabhängigkeiten den Runtime-Sync ausführen, alle neuen Tests ohne `--canonical` sowie die vorgeschriebenen Typecheck-, Build-, Dokumentations-, Sicherheits- und Releaseprüfungen durchführen. Vor dem Release regulär versionieren und Nachweise aktualisieren. Die fehlenden und fehlgeschlagenen Prüfungen sind vor Freigabe zu klären.
4. Auf der betroffenen Anlage gezielt prüfen: Moduswechsel mit gültiger/abgelaufener Anmeldung; Auto bei PV und günstiger/teurer Tarifphase; PV ohne Netzbezug; Min+PV; Boost samt Abbruch; Zielladen über Mitternacht; Einstecken ohne PV, lange Pause, Fortsetzung ohne Umstecken; Wiederverbindung/Neustart. Störungen und gesetzte Netz-/Stationsgrenzen müssen weiterhin Vorrang haben. Hardwareprüfungen erst nach Sicherung und mit Rückfall auf den vorherigen Stand.
5. Für jeden Fall Version, Gerät, Einstellungen, Soll-/Istverhalten und unveränderten JSON-Export sichern. Erst danach den offenen Wiederanlaufbefund schließen.

Nächste benötigte Angaben vom Betreiber: installierte UI-Version, Wallboxmodell und Anbindungsadapter; außerdem JSON-Diagnose bzw. Rohzustände rund um den gescheiterten Start. Der bereits hochgeladene CSV bleibt unverändert.
