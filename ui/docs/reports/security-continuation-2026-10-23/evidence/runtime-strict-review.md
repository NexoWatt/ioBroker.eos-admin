# Konfigurationsgrenzen: Änderung und Prüfvermerk für 1.0.30

Stand: 23.10.2026; Arbeitsbaum NexoWatt_UI_1.0.30 (Releaseversionierung/Artefaktbindung durch Root noch ausstehend). Node v24.19.0, TypeScript 5.8.3. Keine reale Anlage verwendet.

## Änderung und Sicherheitswirkung

Die kanonischen APIs für NVP und Dynamischer Netzanschluss verwenden jetzt echte strikte TypeScript-Verträge statt breit abgeschalteter Typgrenzen. Externe Eingaben, ioBroker-Objekte, Altstände und alte CommonJS-Validatorausgaben beginnen als `unknown`. Das neue gemeinsame Modul `config-boundary-contracts.ts` grenzt sie mit nativen Guards ein. Keine neue Laufzeitabhängigkeit, kein dynamisch geladener Code, keine Typbehauptungs-Casts oder Nicht-null-Assertions. Die konstante NVP-Aktivierungssperre sowie die festen Mapping-Schlüssellisten sind eingefroren.

Validatorausgaben benötigen geprüfte Fehlerstrukturen; erfolgreiche Konfigurationsausgaben müssen die tatsächlich gelesenen verschachtelten Typen besitzen. Beschädigte ioBroker-Objektmetadaten werden als nicht auflösbare Quelle behandelt. Ein defekter interner Installer-Merge kann keinen neuen Vertrag erzeugen. Neue leere Dictionary-Fallbacks besitzen einen Null-Prototyp. Bereits vorhandene Alias-/Einheits-/Schreibidentitäts-Dictionaries behalten ihren Null-Prototyp.

Kompatibilität: Eigene Routen, Installer-Middleware, öffentliche Fehlercodes, CAS-Versionierung, Save-Sperren, alte unvollständige Entwürfe, lokale Konfiguration, getrennte Alias-Lese-/Schreibidentitäten, Speicher-/PV-Bindungen, ursprüngliche Array-Indizes und die aktive Übergabe bleiben erhalten. Keine Änderungen an Lizenzen/NW1, Diensten, EMS-Algorithmen oder Gerätewrites. Die vorhandenen begrenzten vier ioBroker-Leser und der eine gehaltene Auftrag pro Adapter bleiben bestehen; ihre 3-s-Antwortfrist ist ausdrücklich kein Abbruch eines ioBroker-Aufrufs.

## Geprüft

- `./node_modules/.bin/tsc -p tsconfig.config-boundaries.json --pretty false`: PASS. Erbt echtes strict, exakte optionale Felder und geprüfte Indexzugriffe; `noCheck: false`, `noImplicitAny: true`.
- `node -r ../../evidence/runtime-strict-source-preload.cjs --test --test-reporter=tap test/config-boundaries.test.cjs test/nvp-config-api.test.cjs test/nvp-config-http.test.cjs test/dynamic-grid-config-api.test.cjs test/dynamic-grid-config-http.test.cjs`: PASS, 45/45 native Fälle. Der temporäre Preload lädt die vier betroffenen TS-Quellen statt noch unveränderter generierter JS-Dateien. API-Tests laden zusätzlich ihre bestehenden kanonischen TS-Testmodule. HTTP-Prüfung lokal, künstliche ioBroker-Objekte.
- Zehn neue gezielte Fälle: AST-/Strict-Regressionsschutz, fehlerhafte Validatorresultate, verschachtelte Eingaben, ioBroker-Objektformen, getrennte Aliasrichtungen, unveränderte Inventarindizes, Null-Prototyp-Dictionaries, lesende Altentwürfe, bereinigte Speicherfehler mit Sperrenfreigabe, ungültiger interner Patch-Merge.
- Vorläufiger breiter Lauf mit allen `nvp-*.test.cjs` und `dynamic-grid-*.test.cjs` meldete zwei React-Picker-Fails im parallel bearbeiteten Adminbereich. An Admin-Agent und Root gemeldet; keine Aussage über die Gesamtsuite daraus. Der endgültige Root-Lauf nach Integration ist maßgeblich.

Rohbelege: `runtime-strict-typecheck.log`, `runtime-strict-final-targeted.log`, `runtime-strict-boundaries.log`, `runtime-strict-api-regression.log`, vorläufig `runtime-strict-source-regression.log`. Der Preload ist nur Arbeitsnachweis außerhalb des Repositories und gehört nicht in den Lieferumfang.

## Integration durch Root

1. Die drei kanonischen Quellen über den bestehenden Runtime-Transpile-Workflow generieren. Neues Laufzeitmodul: `lib/config-boundary-contracts.js`; explizite Paket-/Quelllisten und Quelldokumentation ergänzen, sofern der Generator dies nicht selbst erledigt.
2. Neuen `tsconfig.config-boundaries.json` in den Security-Typecheck aufnehmen; `node --test test/config-boundaries.test.cjs` zur Security-Suite hinzufügen. Die übrigen bestehenden NVP/Dynamic-Grid-Suiten unverändert weiterführen.
3. Canonical-/Mirror-Integrität, Headerworkflow, Dokumentation/Sicherheitsbefundliste, Gesamtbuild, reale ausgelieferte JS-Prüfung, Paketstart und SBOM anschließend durch Root prüfen und versionieren. Root/CI-Agent wurden über Source-Freeze informiert.
4. `scripts/verify-http-error-boundary.cjs --source` nutzt für den neuen Helfer den generierten Stand; nach Runtime-Sync ist dieser vorhanden. Kein fehlendes Modul separat per Hand kopieren.

## Grenzen und Praxisprüfung

Keine Gesamtaussage zu ASVS/CRA oder globaler Strict-Migration: Die alten fachlichen CommonJS-Dienste besitzen noch breite Typen. Hier werden deren ausgegebene Verträge an den geänderten API-Grenzen geprüft. Keine Hardware-/Produktivfreigabe, kein vollständiger Penetrationstest.

Für den Hausanlagentest nach Sicherung/Rückfallvorbereitung: bestehenden Installerstand öffnen, Entwurf ohne Aktivierung speichern, aktuellen CAS-Stand bestätigen, allgemeine Netz-DP-Zuordnung und Aliasauflösung prüfen; paralleler veralteter Save muss 409 ergeben. Vorhandene Lizenz/EMS-/DP-Funktionen unverändert beobachten. Unvollständige Entwürfe bleiben speicherbar und deaktiviert, ungültige aktive Übergaben bleiben gesperrt. Keine Anlagenlimits für den Test ändern.

## Dateibindung zum Freeze

- `src-ts/runtime-executables/lib/config-boundary-contracts.ts`: `9f912784cde03899343c91fb0505d7b2740b532d967136d9b8ad6d98129ad68f`
- `src-ts/runtime-executables/lib/nvp-config-api.ts`: `bdecfc284d413d60022fc521bf24c2d6cf96696d322b509fcd885394496da0b7`
- `src-ts/runtime-executables/lib/dynamic-grid-config-api.ts`: `7161236b3cfd48a4cb98f4ee636001ec1802336105a1ec9454b9ef5fa8f79f7b`
- `tsconfig.config-boundaries.json`: `7407ce7a304a7ae311475bb715477dcea8f4461e893e6c87fac8b1f9f67a7043`
- `test/config-boundaries.test.cjs`: `d36fb35ce41c20cf35662db4200a50f9234c03ace902d67b77746a9c98f916cb`
