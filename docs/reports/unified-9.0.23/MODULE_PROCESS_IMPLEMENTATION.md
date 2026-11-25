# EOS 9.0.23 – Modulprozesse: Umsetzung und Prüfstand

Stand: 25.11.2026. Isolierter Arbeitsbaum `work-923/iobroker.eos-admin`, fortgeführt aus dem ausgelieferten 9.0.22-Stand. Versions-/Paketmetadaten werden separat durch die Releaseintegration gesetzt. Keine laufende Anlage verändert.

## Änderung

`eosModuleHost.js` startet die produktiven Laufzeiten Devices, EEBUS und Backup über echte `child_process.fork`-Prozesse. `eosModuleProcess.js`, `eosModuleProcessWorker.js` und `eosModuleProcessProtocol.js` implementieren Supervisor, Worker und begrenztes IPC. Die bestehende Parent-Fassade, deren Namensräume, Lizenz-/Eigentumskontrollen, bestätigte Metadatenfortschritte und das Abwarten bereits angenommener Mutationen bleiben maßgeblich. Factory-Injektion für Bestandstests bleibt erhalten.

Neue Freigaben tragen Generation, Sequenz und Ablaufzeit. Abgelaufene RPC-Aufträge werden vor Ausführung abgewiesen. Der Parent bestätigt das tatsächliche Prozessende vor einem begrenzten exponentiellen Neustart. Unbestätigte Mutationen oder Stopzustände verhindern Wiederaufnahme. Konfiguration und technische/physische Regelgrenzen wurden nicht geändert.

## Durchgeführte Prüfungen

Umgebung: Linux, Node.js v24.22.3; synthetische ioBroker-Fassaden, temporäre Verzeichnisse, keine angeschlossene Hardware.

| Prüfung | Tatsächliches Ergebnis |
| --- | --- |
| `node --test test/eos-module-process.test.cjs test/eos-module-process-contract-review.test.cjs` | 19 bestanden, 0 fehlgeschlagen, 0 übersprungen; Rohbeleg `module-process-final.tap` |
| Bestehende Host-, Stop-, Save-, Migrationsstartbudget-, Kommandoabonnement-, EEBUS-Bridge- und reale Modulverträge | 65 bestanden, 0 fehlgeschlagen; konkrete Dateiliste unten, terminalseitig ausgeführt |
| `tsc -p tsconfig.eos-module-process.json` | Separate strenge JS-Typprüfung aller drei neuen ausführbaren Prozessdateien, `strict` und `checkJs` aktiv |
| `tsc -p tsconfig.build.json --noEmit` | Gesamte deklarierte Integration kompiliert; ersetzt ausdrücklich nicht die neue strenge JS-Prüfung |
| ESLint mit `eslint.unified.config.mjs` | Host und drei neue Prozessdateien geprüft |

Die 19 Tests prüfen reale unterschiedliche PIDs, eingeschränkte Fassade/Umgebung, einen tatsächlich blockierten Worker-Eventloop bei weiterlaufendem Parent und zweitem Worker, erzwungenes Beenden bei blockierendem Stop, isolierten Neustart mit neuer Generation/PID, Drain einer bereits angenommenen Datenbankmutation, veraltete Generationen, abgelaufene Nachrichten und die 128er-Anfragegrenze.

Der unabhängige Vertragsreview ergänzt EEBUS-Callback-/ACK-Erhalt, lokale Timer, gealterte/vertauschte Leases, Downloadabbruch vor erstem Lesen, verspätetes Öffnen, Byte-Backpressure und vollständige 32-MiB-Übertragung mit SHA-256-Vergleich. Vier dabei reproduzierte Streamfehler wurden korrigiert und nachgeprüft. Reale Produktionsmodule wurden gestartet: Devices mit leerer Geräteliste, EEBUS mit deaktivierten Netzwerkdiensten aber echter Identitäts- und Abonnementverwaltung sowie Backup mit Schlüssel, READY-Status und History-Abfrage. Ein echter Backup-Jobworker und ein synthetischer Controller-Unterprozess wurden nach SIGKILL des Modulprozesses nachweislich beendet. Detailbeleg: `module-process-contract-review.md`.

Bestehende Regressionstestdateien:

```text
test/eos-module-host.test.cjs
test/eos-module-real-contract.test.cjs
test/eos-module-stop-lifecycle.test.cjs
test/eos-device-command-subscriptions.test.cjs
test/eos-hosted-eebus-bridge.test.cjs
test/eos-module-save-lifecycle.test.cjs
test/eos-module-migration-start-budget.test.cjs
```

## Grenzen und Freigabe

Die Prozessgrenze ist keine OS-Berechtigungssandbox und beseitigt nicht die Abhängigkeit vom zentralen ioBroker-Controller. Sie schreibt bei einem Ausfall keine generischen Abschaltwerte an Geräte. Nach Neustart gelten die vorhandenen gerätespezifischen Wiederherstellungs- und Keepalive-Regeln weiter. Es fand keine Geräte-, Last-, Langzeit-, Zielhost- oder Hausanlagenabnahme statt. Der Prozessnachweis gilt für die hier genannten Softwarepfade, nicht für eine pauschale Zuverlässigkeit oder Produktionsfreigabe des EMS.

Die neue eigenständige `tsconfig.eos-module-process.json`, die drei JS-Dateien und beide Prozess-Testdateien müssen in die Releaseprüfskripte aufgenommen werden. Laufzeitkopien und endgültige Paket-/SBOM-/Artefakthashes werden durch die zentrale Releaseintegration erzeugt und geprüft; diese Dateien wurden hier nicht ersetzt.
