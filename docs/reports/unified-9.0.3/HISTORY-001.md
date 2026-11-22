# HISTORY-001 — begrenzte History-Abfragen und Erhalt guter Messwerte

Stand: 22.11.2026, Quellstand für NexoWatt EOS 9.0.3. Verantwortlicher Nachweisbereich: History-Helfer und `updateEnergyTotalsFromInflux` in `ui/src-ts/runtime-executables/main.ts`.

## Fehler und Änderung

`_nwGetHistoryAvgSeries` wartete ohne Deadline auf den `sendTo(..., 'getHistory', ..., callback)`-Callback. Ein schweigender History-Adapter ließ dadurch auch die beim Betriebsstart erwartete Energieaktualisierung offen. `_nwGetHistoryAvgSeriesAny` konnte mehrere Kandidaten seriell abfragen. Außerdem konnte der Energiecaller fehlende/ungültige History als Anlass nehmen, alte CO₂-Ausgangswerte mit einer neuen Zeit erneut zu publizieren.

Jede einzelne Abfrage hat jetzt ein maximales Budget von 5000 ms. Die Kandidatenfolge in `_nwGetHistoryAvgSeriesAny` teilt **eine einzige monotone Deadline von 5000 ms**, einschließlich bereits verbrauchter Zeit vor einem Fallback. Eine Korrektur der System-Wanduhr verlängert dieses Budget nicht. Nach Ablauf wird `EOS_HISTORY_TIMEOUT` zurückgegeben. Auch ein verspätet eintreffender Callback vor Ausführung des Timer-Callbacks wird anhand der Deadline abgewiesen. Verspätete und doppelte Callbacks werden nicht mehr normalisiert oder als neue Daten übernommen.

Der nahe Helfer `_nwCancelHistoryRequests` beendet ausstehende Anfragen mit `EOS_HISTORY_CANCELLED` und entfernt ihre Timer. Der Lifecycle-Bereich ruft ihn beim Unload nach dem Shutdown-Flag auf. Die Deadline nutzt absichtlich einen separaten, nicht prozesserhaltenden Timer: Der bisherige `_nwSetTimeout`-Guard unterdrückt beim Unload den Callback und könnte damit das Promise erneut offenlassen.

`updateEnergyTotalsFromInflux` lässt die bisherigen parallelen Energiezweige und ihre Integration unverändert. Fehlende Kandidaten, leere/ungültige Serien oder abgelehnte Anfragen erzeugen keine Ersatz-Nullwerte für den betroffenen Energiezweig. Dessen letzter guter Wert samt Zeit bleibt erhalten. Solange eine angeforderte History unvollständig ist, wird auch CO₂ nicht aus alten Cachewerten frisch publiziert. Andere erfolgreich gelesene Energiezweige dürfen echte neue Messwerte übernehmen. Tatsächlich gemessene Nullleistung bleibt ein gültiger Wert. Fehlende externe Energiewerte werden nicht mittels `Number(null)` als gemessene Null behandelt.

Der reale History-Normalizer akzeptiert nur endliche Messzahlen beziehungsweise nichtleere dezimale Zahlenstrings. `null`, Boolean, Leerstring, Objekte, unendliche Werte sowie fehlerhafte Zeilen oder Zeitstempel werden nicht zu Nullproben umgewandelt. Eine ungültige Teilserie wird insgesamt verworfen, damit kein unvollständiger Verlauf als neuer Gesamtwert erscheint. Die unterstützten Influx-Resultatformen, numerische Sekunden-/Millisekundenzeiten und ISO-Zeitstrings bleiben unterstützt.

Der Energiecaller protokolliert bei mindestens einem Timeout pro Aktualisierungszyklus höchstens einen konstanten Hinweis mit `EOS_HISTORY_TIMEOUT`. Ein monotoner Fünf-Minuten-Abstand begrenzt Wiederholungen über mehrere Zyklen. Die Meldung enthält keine Datenpunkt-IDs, URLs, Tokens, Rohantworten oder Fehlertexte; Cancellation beim Shutdown erzeugt keine Warnung.

Kein neuer Retry, keine neue Cache-Strategie und keine Änderung am vorhandenen stündlichen Aktualisierungsintervall. Die Begrenzung umfasst das Callback-Warten; die Event-Loop-Ausführung kann bei einem vollständig blockierten JavaScript-Prozess selbst nicht erzwungen werden. Ein nach einer solchen Blockade eingetroffener Callback darf jedoch keine Daten nach Fristablauf mehr durchreichen.

## Reproduktion und Nachweis

Befehl: `node --test test/eos-history-deadline.test.cjs`.

Der Test extrahiert die tatsächlichen kanonischen Klassenmethoden per TypeScript-AST und führt ihren unveränderten JavaScript-Text aus; es erfolgt keine Transpilierung oder Typentfernung. Die vorhandene UI-Generierung kopiert diese Quelle textuell. Deshalb stehen die neuen Typverträge ausschließlich in JavaScript-kompatiblem JSDoc. Ein zusätzlich erkannter Syntaxfehler durch echte TS-Annotationen wurde vor Freigabe korrigiert; der direkte JS-Test verhindert eine erneute verdeckte Typentfernung. Ausschließlich Timer/monotone Uhr, `sendTo` und State-Persistenz sind kontrollierte Fixtures. Dies ist kein Nachweis einer echten InfluxDB, eines laufenden Controllers oder realer Energietechnik.

- Vor Änderung: initiale sieben Fälle, davon sechs reproduzierbar fehlgeschlagen; `history-before.log`.
- Zusätzliche Reproduktion des Normalisierungsfehlers: zwei neue Fälle vor Normalizer-Korrektur fehlgeschlagen; `history-normalizer-before.log`.
- Nach Änderung und Ergänzung der Randfälle: dreizehn Fälle, dreizehn bestanden, keine übersprungen; `history-after.log`.
- Geprüft: ausbleibender Callback, pünktliche Antwort, verspätete/doppelte Antwort, gemeinsames Kandidatenbudget, Wanduhrsprung, verspätete Event-Loop-Zustellung, harte 5-s-Grenze, paralleler Abbruch beim Shutdown, keine Ersatzwerte/Neudatierung bei Fehlern, leere/ungültige Serien, fehlende Mappings, Teilausfall, echte Normalisierung ungültiger Werte/Zeiten/Zeilen, konstante und monotone gedrosselte Diagnose ohne Cancellation-Warnung und weiterhin richtige Integration echter Null-/Nichtnullleistung.

Die vollständige kanonische Datei wurde zusätzlich mit `node --check --input-type=commonjs` als unverändertes JavaScript erfolgreich geprüft; Nachweis `history-js-syntax.log`.

UI-Mirror-Generierung, Gesamt-Lint/Build und übergreifende HTTPS-/Controller-Startprüfungen werden vom Release-/Lifecycle-Verantwortlichen separat ausgeführt. Dieser Vermerk behauptet diese Prüfungen nicht.
