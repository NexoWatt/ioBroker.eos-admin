# Produktionsabhängigkeiten EOS 9.0.27 – begrenzte Nachprüfung

`npm audit --omit=dev --json` wurde erfolgreich gegen die Registry ausgeführt und endet wegen vorhandener Meldungen mit Exitcode 1: **2 moderate, 0 hohe, 0 kritische Einträge**. Das sind dieselben Vulnerability-Objekte wie im gespeicherten Produktionsaudit von 9.0.26. Die Ausgabe ist kein Scanfehler und kein vollständig grüner Audit.

## Befund und Erreichbarkeit

- Direkt betroffen gemeldet: `ocpp-rpc` 2.2.1. Der Eintrag entsteht durch dessen fest gepinntes, verschachteltes `ajv` 8.14.0; es sind zwei Paketmeldungen zu einem Advisory, keine zwei unabhängigen Schwachstellen.
- Advisory: [GHSA-2g4f-4pwh-qvx6 / CVE-2025-69873](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6). Betroffener AJV-8-Bereich: <8.18.0, konkrete Voraussetzung dynamische Muster mit aktivierter `$data`-Option.
- `node_modules/ocpp-rpc/lib/validator.js:58` erzeugt ausschließlich `new Ajv({strictSchema:false})`; `$data` wird nicht eingeschaltet. `standard-validators.js` nutzt diesen Konstruktor für OCPP 1.6, 2.0.1 und 2.1.
- Die tatsächlichen drei geladenen Validatoren wurden geprüft: `$data` überall deaktiviert. Ein harmloses Schema mit dynamischem `$data`-Pattern wird vor Verarbeitung abgewiesen (`pattern must be string`). Kein angreifender Regex-/DoS-Payload ausgeführt.
- Der integrierte Server verwendet den lokalen `ocpp-rpc`-Export, keine fremd konfigurierbaren AJV-Optionen oder benutzerdefinierten Validatoren. Seine aktuelle `strictMode:false`-Wahl ist eine bestehende Protokollentscheidung; die Bewertung dieses Advisories beruht auf der fehlenden `$data`-Option, nicht auf abgeschalteter Validierung.
- Der separate AJV-Aufruf in `src/lib/web.ts` löst auf die gepatchte Root-Version 8.20.0 auf. Die relevanten Produktquellen stimmen mit 9.0.26 überein.

## Bewertung

Kein neu erreichbarer Ausnutzungspfad für dieses konkrete Advisory und kein neuer Blocker in diesem begrenzten Prüfumfang festgestellt. Die offene moderate Auditmeldung bleibt sichtbar. Keine Abhängigkeit wurde aktualisiert, unterdrückt oder überschrieben. Der npm-Vorschlag ist ein Wechsel von `ocpp-rpc` auf 2.1.1 und keine automatisch kompatible Reparatur; nicht ausgeführt. Die frühere 9.0.25-Bewertung der nicht aktivierten `$data`-Option ist durch die aktuellen Quellen und die Optionsprüfung bestätigt. Den damals dokumentierten inkompatiblen AJV-Override habe ich nicht erneut ausgeführt.

Dies ist keine Aussage über allgemeine Schwachstellenfreiheit, keine vollständige Penetrationsprüfung und keine Hardwareprüfung. Der Entwicklungsabhängigkeits-Audit gehört nicht zum hier ausgeführten Produktionsaudit.

## Belege

- `raw/npm-audit-production.json`: unbearbeitete npm-Audit-JSON-Ausgabe.
- `raw/npm-production-ajv-tree.json` und `raw/npm-production-ajv-tree.stderr`: tatsächlich installierte Produktionsabhängigkeiten (`npm ls`, Exitcode 0).
- `raw/ajv-production-reachability.json`: geladene Versionen/Optionen, Schema-Ablehnung und Dateihashes.
- `raw/production-audit-review.json`: Aufruf, Exitcode, beobachtete npm-Konfigurationswarnung, Vergleich mit 9.0.26 und begrenzte Bewertung.

Umgebung der Optionsprüfung: Node.js 24.22.3. Keine Änderungen an Produktdateien, installierten Abhängigkeiten oder Buildartefakten.
