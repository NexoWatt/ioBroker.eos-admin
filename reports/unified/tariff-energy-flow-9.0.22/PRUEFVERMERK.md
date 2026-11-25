# Tarifregelung und Status im Energiefluss – 9.0.22

Stand: 25.11.2026. Auftrag: fehlende Tarifstatusanzeige und abweichendes Tarifverhalten gegenüber der alten NexoWatt UI untersuchen. Installierter Ausgangsstand laut Nutzer: 9.0.21. Dieser Vermerk betrifft die Tarifkette; Energieflussbilanz, Systemsetup und Backup sind separat geprüft.

## Nachgewiesene Ursache und Änderung

**TR922-01 – falscher Standard-Namespace.** Der Tarifverbraucher `TarifVisModule._getVisInstance()` fiel ohne ausdrücklich eingetragene `vis.instance` auf `nexowatt-ui.0` zurück. Der Befund ist auch im archivierten `NexoWatt_EOS_9.0.21_FULL_REPOSITORY.zip` nachgewiesen. Bei einer eingebetteten Oberfläche unter `eos-admin.N` las die Tarifregelung dadurch andere oder nicht vorhandene Einstellungen: Der sichtbare Schalter war aktiv, die Tarifentscheidung intern aus, der Status leer. Bisherige Tarif-Integrationstests setzten eine passende `vis.instance` explizit und deckten diesen Fall nicht ab.

Der Standard verwendet jetzt `adapter.namespace`, also den tatsächlichen Namespace der eingebetteten Laufzeit. Explizite VIS-Zuordnungen bleiben maßgeblich; eine bestätigte Migration mit erhaltenem `nexowatt-ui.N` bleibt erhalten. Preisgrenzen, Vorranglogik, Netzanschlussgrenzen, AppCenter-Freigabe, SOC-Regelung und HT/NT-Entscheidungen sind unverändert.

**TR922-02 – aktivierte Optimierung ohne sichtbaren Status.** Der bisherige Frontendblock blendete die gesamte Statuszeile bei leerem Backendtext und `tarif.state=aus` aus. Die bestehende Zeile im Energiefluss zeigt jetzt bei aktivierter Tarif-/Netzentgeltregelung immer einen verständlichen Zustand. Bei vorhandenem frischen Snapshot erscheint derselbe kompakte Backendtext wie zuvor, einschließlich Preis und tatsächlichem Speicherzustand. Es wird kein neuer Regelalgorithmus im Browser eingeführt.

Ohne Status: „warte auf aktuellen Regelungsstatus“; bei widersprüchlichem/inaktivem Snapshot: „Regelung noch nicht bestätigt“; nach Ablauf: „Regelungsstatus veraltet“. Ein Verbindungsabbruch entfernt alte Lade-/Entladebehauptungen unmittelbar. `tarif.statusJson` bildet den Heartbeat für unveränderte Statusmeldungen. Äußerer State-Zeitstempel, innerer Snapshot-Zeitstempel und vorhandenes Qualitätsflag müssen gültig sein. Die PV-Reserve wird aus dem zeitgestempelten atomaren `speicher.regelung.policyJson` in den Tarifstatus übernommen. Damit bleibt eine konstante aktive Sperre trotz altem Einzelstate-Zeitstempel sichtbar; fehlt der Speicherregler-Heartbeat oder ist dessen Qualitätsflag fehlerhaft, wird sie nicht als aktuelle Sperre ausgegeben. Alle Texte werden über `textContent`/`title` gesetzt.

## Änderungen

- `ui/src-ts/runtime-executables/ems/modules/tarif-vis.ts`, zugehörige Runtime.
- `ui/src-ts/runtime-executables/ems/modules/tariff-status.ts`, zugehörige Runtime: atomare PV-Reserve-Diagnose.
- `ui/src-ts/runtime-executables/www/tariff-display.ts`, zugehörige Runtime.
- `ui/src-ts/runtime-executables/www/app.ts`, zugehörige Runtime: `updateEmsControlUi` und bisheriger Tarifstatusblock; die getrennt bearbeitete Energiebilanz bleibt eigenständiger Scope.
- Neue Regression `test/eos-tariff-runtime-namespace.test.cjs`.
- Ergänzte Status-/Fehlerfalltests `test/eos-tariff-display.test.cjs`.

## Ausgeführte Prüfung

Lokale Node.js-24.22.3-Testumgebung; reale EMS-Module und Datenpunktregistry, simulierte ioBroker-Datenbank und DOM. Keine physischen Geräte, keine externen Providerzugriffe und keine Änderungen an einer Kundenanlage.

| Prüfung | Ergebnis |
| --- | --- |
| Reproduktion vor Fix: Namespace-Tests | 2 fehlgeschlagen, 1 bestanden; falsches `nexowatt-ui.0` und fehlende Netzladefreigabe reproduziert |
| `node --test test/eos-tariff-runtime-namespace.test.cjs test/eos-tariff-display.test.cjs test/eos-customer-tariff-consumer.test.cjs test/eos-customer-tariff-price-chain.test.cjs test/eos-tariff-quarter-hour-runtime.test.cjs` | 27/27 bestanden |
| `node node_modules/typescript/bin/tsc -p ui/tsconfig.tariff-display-ui.json` | Bestanden |
| TypeScript-Programmprüfung `tariff-status.ts` mit strict/noEmit/ES2022/types=[] | Bestanden |
| `node node_modules/eslint/bin/eslint.js -c ui/eslint.tariff-display-ui.config.mjs ui/src-ts/runtime-executables/www/tariff-display.ts` | Bestanden |
| `node ui/scripts/verify-tariff-storage-status-truth.js` | Bestanden; Wunsch, Write und bestätigter Istwert getrennt |
| `node ui/scripts/verify-rc64-storage-grid-charge-policy.js` | Bestanden; günstiger/frischer Tarif, Freigaben und aktiviertes NT-Fenster weiterhin erforderlich |

Abgedeckt: `eos-admin.0`, `eos-admin.3`, erhaltenes `nexowatt-ui.2`, explizite fremde VIS-Zuordnung; Aktivierung/Deaktivierung; fehlender/veralteter Preis; AppCenter-Sperre; fehlender/widersprüchlicher/veralteter Status; Qualitätsfehler; SSE-Abbruch/Wiederkehr; unveränderter Statustext mit aktuellem JSON-Heartbeat; Viertelstunden und Zeitumstellung; Null-/Negativpreise; Quellenwechsel mit verspäteten Antworten.

## Grenzen und Anlagenprüfung

Die konkrete Kundenkonfiguration und echte Gerätetelemetrie wurden nicht ausgelesen. Der reproduzierte Namespacefehler erklärt das gemeldete Verhalten bei fehlender expliziter VIS-Zuordnung; er beweist ohne Anlagenkonfiguration keine alleinige Ursache vor Ort. Nach Installation Tarif aktivieren, gespeicherten Modus/Preis/Leistungsfreigabe prüfen, Status samt Preis im Monitor ansehen und reale Speicherantwort mit der Anzeige vergleichen. Einen erlaubten Preiswechsel sowie Datenunterbrechung/Wiederkehr prüfen, ohne Schutzgrenzen zu verändern.

Dieser Nachweis ist Software-Regression, keine allgemeine Produktivfreigabe, Sicherheitszertifizierung oder Garantie vollständiger Fehlerfreiheit. Browserprüfung und abschließender Paket-/Quellbezug werden im Gesamtprüfbericht ergänzt.
