<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
Use, modification or distribution without express written permission is prohibited. -->
# ESLint- und Sicherheitsreview der Modusänderungen

Datum: 11.11.2026. Zielstand: NexoWatt UI 1.0.36, Testrelease. Ausgangspunkt ist das unveränderte vollständige 1.0.35-Archiv. Dieses Review bewertet die geänderten Quellpfade; es ist weder unabhängige Zertifizierung noch Hardwareabnahme.

## Verfahren und Quellbindung

Der echte ESLint-Sicherheitslauf verwendet die unveränderte Konfiguration, alle vorgeschriebenen Regeln auf Fehlerstufe und `noInlineConfig`. `scripts/verify-eslint-security.cjs` prüft sämtliche 178 Runtime-/Adminquellen. Die historische Baseline aus 1.0.29 wurde nicht verändert. Bereits einzeln geprüfte Fundstellen wurden auf ihre vollständigen Codehashes geprüft: Für diese Änderung war keine Neubindung vorhandener Revieweinträge nötig.

Fünf veränderte Quellen wurden zusätzlich mit ihren exakten Originaldateien aus dem 1.0.35-Archiv verglichen. Der Vergleich ermittelt für beide Versionen echte ESLint-Meldungen und die produktiven Fund-Fingerprints. Quelle, SHA-256, gedruckter TypeScript-Codehash, Fundanzahl sowie neue/entfallene Fundstellen stehen in `eslint-original-comparison.json`. Dabei wurden keine Quelltexte, Zugangsdaten oder Kundendaten in die Lintberichte übernommen.

| Quelle | Ursprüngliche Treffer | Aktuelle Treffer | Neue Vorkommen | Entfallen |
| --- | ---: | ---: | ---: | ---: |
| `www/evcs.ts` | 25 | 29 | 6 | 2 |
| `www/app.ts` | 81 | 81 | 0 | 0 |
| `ems/modules/charging-management.ts` | 39 | 39 | 0 | 0 |
| `ems/services/charging-management-audit.ts` | 5 | 5 | 0 | 0 |
| `www/charging-diagnostics-appcenter.ts` | 6 | 6 | 0 | 0 |

Die Tabelle verwendet die Pfade unter `src-ts/runtime-executables/`. Unveränderte Scannerfundstellen sind kein Nachweis unveränderter Datenflüsse; die neuen Übergänge wurden zusätzlich fachlich gelesen.

## Vor der Einzelprüfung verbesserter Code

- Neue UI-Pending-/Fehlerzustände verwenden `Map`; hierfür wurde keine Object-Injection-Ausnahme aufgenommen.
- Vollsnapshot und SSE-Merge kopieren in Dictionaries ohne Prototyp. `__proto__` und `constructor` werden als eigene Datenkeys behandelt, nicht als Prototypoperationen.
- Modus und Auto-Quelle werden ausschließlich aus Backend-State-Readback übernommen. Der Ladepunktindex wird vor dem Aufbau der State-ID als positive Ganzzahl geprüft. Readback verlangt einen eigenen Property-Key und erlaubte Modus-/Quellenwerte.
- Keine neuen `any`-, `ts-ignore`-, `ts-nocheck`- oder Parserausnahmen wurden erteilt. Die Regelkonfiguration und die historische Baseline bleiben unverändert.

## Eng geprüfte verbleibende Indexzugriffe

Sechs Vorkommen in vier Fingerprintgruppen werden ausschließlich für den final geprüften Codehash der EVCS-Quelle einzeln gebunden. Die Scannerregel bleibt aktiv. Eine fachliche Codeänderung muss erneut geprüft werden.

| Fingerprint-Präfix | Anzahl | Stelle und Begründung |
| --- | ---: | --- |
| `0e3a59a0818d` | 2 | `_replaceStateSnapshot`: lesender Zugriff auf den bisherigen State. Der Vergleich akzeptiert ausschließlich die feste Grammatik `chargingManagement.wallboxes.lp<Ziffern>.userMode` beziehungsweise `userAutoSource`; andere Keys bewirken keine Übernahme. Kein Aufruf des gelesenen Werts. |
| `64a7b25eac41` | 1 | `_replaceStateSnapshot`: Schreiben in den neu angelegten Null-Prototyp-Snapshot nur nach erfolgreichem Modus-/Quellen-Zeitstempelvergleich. Es wird ein bereits vorhandener bestätigter State übernommen, kein fremdes Objektziel angesprochen. |
| `4d5638a030a8` | 1 | `_mergeUpdatePayload`: ausschließlich lesender Vergleich aus dem Null-Prototyp-Merge-Dictionary; nicht passende Keys verlassen den spezialisierten Modus-/Quellenvergleich sofort. Keine Shell-, Pfad-, Funktions- oder Prototypverwendung. |
| `a7cd824fdb5b` | 2 | `handleModeButton`: genau die aus festem Präfix, geprüftem Ganzzahlindex und festem Feldnamen erzeugte State-ID. Vor dem Readback-Zugriff wird `Object.prototype.hasOwnProperty.call` geprüft. Der gelesene Wert muss anschließend einen erlaubten Modus beziehungsweise `standard`/`strategy` enthalten. |

EVCS-Codehash (TypeScript-Ausgabe ohne Kommentare): `649c1265f8718e74a2c052904a0440a0f1c3ea936a735e57ed7e5ded75eb2d13`.

## Manuelles Review der Hauptseiten-Modusbedienung

Der Hauptseitendialog in `app.ts` verwendet drei feste Modusquellen, validiert die jeweiligen String-/Zahlwerte und nimmt den Zeitstempelvergleich vor Übernahme vor. Eine offene Anfrage sperrt konkurrierende Modusaufträge dieses Dialogs. HTTP-, JSON-, Anmelde- und Timeoutfehler erzeugen lokale statische Meldungen. Der manuelle Anmeldelink bleibt auf demselben Origin; Serverantworten und Zugangsdaten werden nicht in das DOM kopiert. Der Schreibauftrag wird nicht automatisch wiederholt. Nach verlorener POST-Antwort kann ein gültiger Readback den tatsächlich gespeicherten Zustand bestätigen. API-Bestätigung bezeichnet die gewählte Backend-Einstellung, nicht die physische Ladung des Fahrzeugs.

## Tatsächlich ausgeführte Nachweise

| Prüfung | Ergebnis | Rohbeleg |
| --- | --- | --- |
| `node scripts/verify-eslint-security-test.cjs` | 25 Policy-/Negativprüfungen bestanden | `eslint-policy-regressions.log` |
| Originalvergleich der fünf Fachquellen | Keine neue Type-Unterdrückung; nur sechs erläuterte Object-Injection-Hotspots | `eslint-original-comparison.json` |
| `node scripts/verify-live-evcs-mode-confirmation.cjs --canonical` | 48/48 bestanden; Hauptseitendialog mit echter Runtime-URL-Umschreibung im VM-Test | `app-mode-review-tests.log` |
| `node scripts/verify-evcs-mode-write-failure.cjs --canonical` | 37/37 bestanden; Modus, Auto-Quelle, Snapshot-/SSE-Reihenfolge, Timeout, unabhängige Ladepunkte und Prototypschlüssel | `evcs-mode-review-tests.log` |

Die Browsernachweise sind VM-Tests mit simulierten Antworten, keine realen Browser-, Proxy- oder Hardwaretests. Die Prototypschlüsselprüfung bestätigt unverändertes `Object.prototype`, eigene Datenkeys sowie deren Entfernung beim leeren Vollsnapshot.

## Finaler Lintstand und Grenzen

Der abschließende Gate-Lauf ist bestanden: **178 Quellen, 3.075 aktuelle Scannerfundvorkommen, 2.968 offene historische Vorkommen, 107 einzeln geprüfte Vorkommen, 0 ungeprüfte neue/verbotene Vorkommen, 92 frühere Vorkommen abwesend**. Exitcode 0. Keine Quellcodeänderung während dieses Laufs wurde festgestellt. Die exakten Werkzeug-/Quellhashes stehen in `eslint-final.log`, `eslint-final.json` und `eslint-review-environment.json`. Die vor dem Review verbleibenden sechs Vorkommen stehen vollständig in `eslint-before-review.json`; sie wurden nicht aus dem Scannerergebnis entfernt. `eslint-inventory-integrity.json` belegt den unveränderten historischen Bestand und alle 88 unverändert erhaltenen früheren Reviewgruppen.

Ausführungsumgebung: Node.js 24.22.1, ESLint 10.13.0, eslint-plugin-security 4.2.0, TypeScript-ESLint Parser/Plugin 8.72.0 und TypeScript 5.8.3. Es wurden keine Compiler- oder Lint-Regeln für diesen Lauf abgeschaltet.

Der vorhandene Altbestand bleibt offen. Ein bestandenes Regressionsgate bedeutet ausschließlich, dass kein zusätzlicher ungeprüfter oder ausdrücklich verbotener Fund vorliegt. Es bescheinigt weder Fehlerfreiheit noch ASVS-/IEC-/CRA-Konformität. Die alte OCPP-Pausen-/Sessionmehrdeutigkeit wird durch diese Änderungen nicht übergangen; ihre Prüfung am konkreten Adapter und Fahrzeug bleibt offen.
