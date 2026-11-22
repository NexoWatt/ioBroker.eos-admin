# EOS 9.0.1 – EMS-/UI-Regressionen

Prüfung am 22.11.2026 unter Node.js 24.22.3 / npm 11.19.1 im gemeinsamen Arbeitsstand für Version 9.0.1. Keine Produktivgeräte oder Kundenanlage wurden angesteuert. Die erste Regression war rein lesend. Ein anschließender bestätigter Fehler bei der Übergabe von einem alten UI-Regler wurde gezielt im kanonischen Startablauf korrigiert und die Runtime neu erzeugt; siehe den Änderungsnachweis unten. Die Energie-/Laderegelungsalgorithmen wurden nicht verändert. Alle hier zusammengefassten Prüfungen wurden nach diesem Fix erneut ausgeführt.

| Prüfung | Ausführung | Ergebnis | Beleg |
| --- | --- | --- | --- |
| NVP und dynamischer Netzanschluss | `cd ui` und `node --test test/nvp-*.test.cjs test/dynamic-grid-*.test.cjs` | 208 bestanden, 0 Fehler, 0 übersprungen | `nvp-dynamic-grid.tap` |
| Erhaltene Lade-/EMS-Fälle | Die 20 einzeln aufgeführten Node-Prüfskripte aus `ems-regressions.json`, jeweils mit Arbeitsverzeichnis `ui` | 20 erfolgreiche Skriptaufrufe, Exitcode jeweils 0 | `ems-regressions.json` und individuelle Logs |
| Kanonische TypeScript-Quellen / ausgelieferte Runtime | `node ui/scripts/build-ts-runtime-executables.js --check` | 163 produktive Runtime-Dateien stimmen mit der kanonischen Quelle überein | `runtime-executables-check.log` |

Die Lade-/EMS-Prüfskripte decken unter anderem OCPP-Stabilität, Compact-Mapping, Auto-/PV-Orchestrierung, §14a-Kommunikationsausfall, günstige Netzladefenster, bestätigte Modusschreibvorgänge, CSV-/Audit-Moduskontext, Nulleinspeisung, Speicherprobe und Heizstab ab. Es handelt sich um Softwareprüfungen mit synthetischen Zuständen, VM-/Browsermodellen oder isolierten Modulen; die Anzahl 20 bezeichnet erfolgreiche Skripte, nicht 20 Geräteprüfungen oder zwingend 20 einzelne Assertions.

Die NVP-/Netzanschlussprüfung umfasst unter anderem Domänenlogik, Konfiguration, Rollen-/HTTP-Grenzen, Zustandsübergänge, Alias-/Writer-Zuordnung sowie laufende Regelmodule mit Testdaten. Sie ersetzt keine Abnahme einer Anlage. Insbesondere sind reale Wallboxen, Wechselrichter, Speicher, Netzwerkausfälle am Zielgerät und die geforderten 50-/100-ms-Zeitziele auf Pi/IPC hier nicht geprüft. Es ergibt sich daraus weder eine Gesamtfreigabe noch eine CRA-Konformitätserklärung.

`tested-entrypoints.sha256` ordnet die verwendeten Prüfeinstiegspunkte zu. Die umfassende Zuordnung von Quellen, Runtime und Lieferpaket erfolgt durch das übergeordnete Release-Manifest nach Abschluss aller Arbeiten.

## Korrektur: Start nach bestätigter Reglerübergabe

**Befund:** Bei vorhandener zentraler Lizenz und einer noch aktiven alten UI setzte `onReady` den gehosteten Startstatus korrekt auf `blocked`. Der spätere Startweg akzeptierte jedoch nur `unlicensed`. Nach dem Abschalten des Altreglers und einer positiven Ownership-Prüfung blieb die Regelung deshalb bis zu einem Neustart ruhend. Zusätzlich blieb ein bereits abgeschlossener Startversuch als Promise gespeichert, wenn die Ownership zwischen Vorprüfung und dem erneuten Check in `onReady` verloren ging.

**Änderung:** `ui/src-ts/runtime-executables/main.ts` erlaubt einen erneuten Versuch ausschließlich aus `unlicensed` oder `blocked`, weiterhin nur mit aktuell gültiger zentraler Core-Lizenz und positiver Ownership-Prüfung. `onReady` prüft beides erneut vor operativen Schreibvorgängen. Ein abgeschlossener Versuch gibt seine Promise frei; ein bereits operativer Start bleibt durch `_hostedOperational` gegen doppelte Initialisierung geschützt. Der vorhandene Runtime-Generator hat daraus `ui/main.js` erzeugt. Der Übergang erfolgt beim nächsten gehosteten UI-Aufruf bzw. expliziten `startOperational()`-Aufruf; dieser Fix installiert keinen zusätzlichen Regler oder Hintergrunddienst.

**Regression:** Der neue Fall in `ui/test/unified/hosted-runtime.test.cjs` scheiterte vor der Korrektur (`ownership-resume-before.tap`) und besteht danach. Er prüft: keine operativen Writes bei aktivem Altregler, keine Freigabe allein durch Ownership ohne zentrale Lizenz, erneutes Sperren bei Ownershipverlust zwischen den beiden Prüfungen, erfolgreiche spätere Übergabe mit echter EMS-Initialisierung auf synthetischen Objekten sowie keine doppelte Initialisierung bei wiederholtem/parallelem Startaufruf.

**Nachweise nach Korrektur:** `node --test ui/test/unified/*.test.cjs`: 18/18 bestanden, 0 übersprungen (`ownership-resume-after.tap`). Die 208 NVP-/Netzanschlussfälle, 20 EMS-Skripte und der 163-Dateien-Kanonizitätscheck wurden ebenfalls erneut erfolgreich ausgeführt. `node --check ui/main.js` und ESLint für die geänderte Testdatei endeten mit Exitcode 0; das Lint-Log enthält lediglich eine npm-Umgebungswarnung zum vorhandenen `http-proxy`-Eintrag (`ownership-resume-lint.log`). Die erfolgreiche Neugenerierung ist in `ownership-resume-build.log` protokolliert.
