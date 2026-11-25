# Bestätigte UI-Konfigurationswrites über die Prozessgrenze

Stand: 25.11.2026. Enger Fehlerfix im Recovery-Quellstand 9.0.25, ausgelöst durch den unabhängigen Tarif-Persistenzreview. Keine Änderung an der ausgelieferten/sealed 9.0.24 und kein Zugriff auf die Liveanlage.

## Belegter Fehler

Der neue UI-Worker benutzte dieselbe zweisekündige Frist sowohl zum Zulassen einer Mutation als auch zum Warten auf ihre Antwort. Das traf auch geschützte Installer-Konfiguration. Ein tatsächlicher Child mit echtem IPC und tatsächlicher `persistInstallerConfigToState`-Funktion meldete beim synthetisch um 2,2 Sekunden verzögerten Controller-Commit nach etwa 2,013 Sekunden einen fehlgeschlagenen Save. Der State wurde anschließend dennoch gespeichert, während die Laufzeit mit ihrer bisherigen Konfiguration weiterlief. Dies war keine belegte Löschung von Tarifanbietern beim Update und keine behauptete Ursache eines Liveanlagenfehlers.

Vorher-Nachweis: `raw/tariff-update/config-ack-result.json` und `reproduce-config-ack.cjs`.

## Änderung und Grenzen

`src/lib/eosUiProcessRpc.ts` trennt die Admissionfrist vor Ausführung von der Antwortfrist. Gültige, bereits abgelaufene Requests erhalten `EOS_UI_PROCESS_CALL_EXPIRED`; sie werden nicht ausgeführt. Generation, zulässige Methoden, Parent-Ownership und Write-Drain bleiben bestehen. Es werden keine Calls wiederholt.

`src/lib/eosUiProcessWorker.ts` verlängert ausschließlich die Antwortfrist genau benannter geschützter Konfigurationswrites:

| Operation | Admission vor Ausführung | Warten auf tatsächlichen Abschluss |
| --- | --- | --- |
| Physische/sonstige Mutationen, beliebige ACK-States und beliebige Objektwrites | weiterhin 2 Sekunden | weiterhin 2 Sekunden |
| `saveUi` | weiterhin 2 Sekunden | bis 30 Sekunden |
| Exakte Konfig-State-Ziele mit `setForeignStateAsync` / `setForeignStateChangedAsync`, `ack:true` und String-Wert | weiterhin 2 Sekunden | bis 30 Sekunden |
| Objekt/ACL-Anlage oder Ergänzung genau dieser Konfig-Ziele | weiterhin 2 Sekunden | bis 30 Sekunden |

Die festen Ziele sind `<gebundener UI-Namespace>.installer.configJson`, `<gebundener UI-Namespace>.simulation.backupConfigJson` sowie die beiden vorhandenen Sicherungs-States `0_userdata.0.nexowattVis.backupJson` und `backupJsonPrev`. Der UI-Namespace stammt wie in der bestehenden Hosted-Fassade ausschließlich aus geschützten gültigen Migrationsmetadaten (`nexowatt-ui.N`) oder dem Host-Namespace. Es gibt keinen allgemeinen Suffixvergleich, keinen erweiterten Löschpfad und keine Freigabe allein aufgrund von `ack:true`.

Eine eindeutige Controller-Ablehnung bleibt ein normaler Speicherfehler und löst keinen unnötigen Worker-Neustart aus. Bleibt die Bestätigung eines solchen Konfigurationswrites auch nach 30 Sekunden unbekannt, beendet sich der Worker. So regelt er nicht dauerhaft mit einer möglicherweise veralteten Laufzeitkonfiguration weiter. Die vorhandene Parent-Verfolgung offener Writes verhindert einen neuen Child, solange der alte Controllerauftrag ungeklärt ist. Nach Abschluss kann ein ausdrücklicher Wiederanlauf den tatsächlich gespeicherten Stand erneut laden. Ein später Commit ist weder ein Rollback-Nachweis noch ein Anlass zum automatischen Wiederholen des Auftrags.

## Laufzeitbelege

`test/eos-ui-config-ack.test.cjs`: **5/5 unter Node 22.23.4 und 5/5 unter Node 24.22.3**, ohne Skip. Jeder Fall verwendet einen tatsächlich geforkten UI-Worker. Die Fixture führt die realen UI-Speicher-/Ladefunktionen aus; Engine-/Netzwerkstart und die Controller-Datenbank sind gezielt synthetisch.

- 2,2-Sekunden-Commit bestätigt erst nach Abschluss und übernimmt dann dieselbe Laufzeitkonfiguration, sowohl im nativen als auch erhaltenen Namespace.
- Eindeutige Controller-Ablehnung erhält alte Daten und dieselbe PID.
- Pause wartet auf den angenommenen Write; danach startet eine neue PID und lädt den bestätigten Zustand ohne Replay.
- Die reale 30-Sekunden-Frist wird ohne Testuhrverkürzung durchlaufen: Child beendet, Diagnose `EOS_UI_PROCESS_WRITE_COMPLETION_UNKNOWN`, kein Wiederanlauf vor Drain, anschließend explizite Wiederaufnahme und tatsächliche erneute Hydration des gespeicherten Zustands.

Kommandos:

```sh
node --test --test-reporter=tap test/eos-ui-config-ack.test.cjs
node node_modules/typescript/bin/tsc -p tsconfig.ui-process.json --noEmit
node node_modules/eslint/bin/eslint.js src/lib/eosUiProcessWorker.ts src/lib/eosUiProcessRpc.ts
```

Strikte Typprüfung und gezieltes Lint bestehen. Rohlogs: `raw/tariff-update/ack-node22.tap`, `ack-node24.tap`; geprüfte Quellhashes: `commit-ack-sha256.txt`.

Der zusätzliche unabhängige Review hat ebenfalls keinen Blocker gefunden: `test/eos-ui-config-ack-review.test.cjs` besteht mit **5/5 unter jeder Node-Linie**. Die Datei prüft acht zulässige und elf unzulässige Klassifizierungen, die exakte Bindung an den erhaltenen Namespace, ungültige Namespaceangaben, tatsächlich mehr als zwei Sekunden verspätete IPC-Zustellung mit Ablehnung vor dem Datenbankaufruf sowie verspätete/alte Generationsantworten. Rohlogs: `raw/tariff-update/ack-review-node22.tap` und `ack-review-node24.tap`. Diese fünf Reviewtests sind zusätzlich zu den fünf eigentlichen Commit-Laufzeitfällen; globale Release-Prüfungen werden separat dokumentiert.

## Ressourcen und Betriebsgrenze

Keine zusätzliche periodische Aufgabe, kein Polling und kein neuer unbegrenzter Speicher. Die vorhandenen IPC-Limits von 256 offenen Calls, 16 MiB je Frame und 32 MiB Sendewarteschlange bleiben bestehen. Nur die Lebenszeit der bestehenden Antwort-Timer für die genannten Konfigurationswrites ändert sich. Ein bereits an die Datenbank übergebener Write lässt sich dadurch nicht rückwirkend abbrechen; der vorhandene Drain und die neue Fail-Closed-Behandlung der unbekannten Bestätigung bleiben deshalb erforderlich. Die Prüfung ist keine Hardware- oder Verfügbarkeitsgarantie.
