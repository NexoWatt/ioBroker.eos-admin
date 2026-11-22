<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis untersagt. -->
# Eigene TS-/JS-Lizenzköpfe und unveränderte Programmlogik

Bezug: **NW-LIC-02**, NexoWatt UI 1.0.30, 23.10.2026. Die zentrale
proprietäre Lizenz wird in eigenen Programmquellen und deren erzeugter Runtime
einheitlich sichtbar und durch eine wiederholbare Prüfung abgesichert.
Eine vollständige Rechteprüfung oder ein proprietärer Lizenzanspruch an
Drittkomponenten wird damit nicht behauptet.

## Verbindlicher Scope

| Bereich | Behandlung |
| --- | --- |
| `src-ts/**` ohne automatisch erzeugte Runtime-Spiegel | Eigene TS-/TSX-Quellen; Kommentarpräfix darf ergänzt werden. |
| `src-admin-tab/src/**` | Eigene Admin-TS-/TSX-/JS-Quellen; keine Änderung der JSX-/Programmlogik. |
| Direkt gepflegte `scripts/**`, `eslint.config.cjs`, `src-admin-tab/vite.config.ts` | Eigene Build-/Prüfwerkzeuge und Konfiguration als Code; derselbe Kopf. |
| Neun manuell typisierte Runtime-Spiegel | Nur Lizenzpräfix ergänzen; Typverträge und Code niemals durch rohe JS-Spiegel ersetzen. Der Original-Hash wird nicht vom Headerwerkzeug geändert. |
| Generierte Runtime aus `runtime-executables`, Helper unter `lib/ts-mirrors` und `www/static/ts-mirrors`, generierte Runtime-Spiegel, `scripts/publish-check-rules.js` | Der zuständige Generator setzt den Kopf; der Headercheck prüft die Ausgaben. |
| Admin-React-Bundles mit Drittcode, `node_modules`, Third-Party-Notices, JSON, HTML, CSS, Bilder und andere Binärdateien | Außerhalb dieser Codeheader-Migration; vorhandene Lizenzen und Dateien bleiben erhalten. |

`scripts/ts-scaffold-rules.js` ist ein direkt gepflegter JS-Spiegel ohne eigenen
Generator und gehört zum Quellen-Scope. Die genaue Aufzählung, einschließlich
der neun geschützten Spiegel, steht in `scripts/sync-proprietary-headers.cjs`.
Es gibt keine pauschale Aussage „alle Dateien sind proprietär gekennzeichnet“.

Die Quellen wurden entsprechend dem Quellcode-Wegweiser und den vorhandenen
Dateikommentaren eingeordnet. Fremde oder unklare Copyright-/Lizenzhinweise
im Dateiprolog stoppen die Migration vor dem ersten Schreibzugriff;
der Prüfmechanismus ersetzt keine rechtliche Herkunftsbegutachtung.

## Werkzeuge und Erhaltung der Funktion

`scripts/proprietary-header-policy.cjs` verwendet ausschließlich Node.js-
Standardmittel und reine Textfunktionen. Der feste eigene Kopf steht vor
Migrations-/Buildhinweisen, nach einem technisch erforderlichen Shebang.
`'use strict'` bleibt die erste Programmanweisung. Ein erneuter Lauf fügt
keinen weiteren Kopf ein; BOM, Zeilenenden und der bisherige Quelltext hinter
dem Lizenzprolog bleiben erhalten. Symbole in Strings gelten nicht als
Dateilizenz oder TypeScript-Pragma. Symbolische Links im Scope werden abgewiesen.

```sh
node scripts/sync-proprietary-headers.cjs --write
node scripts/sync-proprietary-headers.cjs --check --sources-only
node --test scripts/verify-proprietary-headers.cjs scripts/verify-runtime-license-header.cjs
```

`--write` verändert nur die direkt gepflegten Quellen. Danach sind die regulären
Generatoren auszuführen. Bei manuell typisierten Spiegeln muss zuerst der
fachliche Vergleich erfolgen; für reine Lizenz-/Generatorkommentare ist die
Gleichheit der Programm-Tokens vor und nach dem Runtime-Build zu belegen.
Erst dann darf deren Original-Hash nachgeführt werden. `npm run build:ts`
und der abschließende vollständige Headercheck dürfen keine Abweichungen melden.
Build- oder Publishprüfungen dürfen fehlende Header nicht automatisch reparieren.

Der bestehende Runtime-Executable-Generator erkennt nur den exakt geformten
führenden eigenen Lizenzblock. Ein `@runtime-transpile` in einem beliebigen
Kommentar oder String aktiviert keine Transpilierung. Die übrigen Generatoren
verwenden den gemeinsamen Helfer. Lizenzköpfe in erhaltenen Quellkommentaren
können zusätzlich im erzeugten Körper stehen; der führende Kopf ist maßgeblich.

## Ehrliche TypeScript-Prüfungen trotz zusätzlichem Kopf

Die bisherigen Typprüfungen für Core-Limits, Heizstab und AI-Advisor sowie
der RC62-Scan entfernten `@ts-nocheck` nur an Byteposition null. Der Kopf darf
diese Prüfungen nicht still deaktivieren. Sie entfernen jetzt tatsächliche
No-Check-Pragmas aus führenden Zeilenkommentaren, auch nach dem
`@runtime-transpile`-Kommentar. Ein letzter `@ts-check` gewinnt wie beim Compiler.
Strings, Blockkommentar-Beispiele und Direktiven hinter Programmcode bleiben
unangetastet. Die native Erkennung wird gegen `TypeScript.checkJsDirective`
im gesamten eigenen TS-Quellscope geprüft. Ein bewusster Typfehler im Fixture
wird nach Entfernen der echten Direktive wieder vom Compiler erkannt.

Der alte No-Check-Budgetstand 0.8.202 umfasste 60 Dateinamen und übersah
spätere Köpfe sowie vorgeschaltete Transpilierungsmarker. Eine Rekonstruktion
aus dem unveränderten vollständigen 1.0.29-Archiv ergab **73 tatsächlich
ungeprüfte Runtimequellen und 169.555 Zeilen** ohne eigenen Lizenzprolog.
Die Herkunft ist gebunden an SHA-256
`73714ad0975c6d1ae6a16f4a8fe8df354d04b075e915be72a35b53362f38a1ed`.

In 1.0.30 bleibt die Zahl 73. Die explizit geprüften Sicherheitsänderungen
ergeben einmalig **+47 Zeilen**: +52 für den linearen Tarif-Parser,
−1 bei PV-Forecast-Kommentar/Prüfung und −4 beim korrigierten Main-Feldtestpfad.
Die korrigierte Grenze beträgt daher 169.602; es werden keine neuen
No-Check-Dateien freigegeben. Quellen-/Körperhashes und jede Datei mit
Vorher-/Nachherzeilen stehen im Rekonstruktionsnachweis. Das ist eine
Berichtigung und begründete Sicherheitsänderung, keine generelle Lockerung.
Der eigene Lizenzprolog verbraucht kein Codezeilenbudget. Neue ungeprüfte
Dateien und weiteres Zeilenwachstum werden wieder abgewiesen.

## Prüfbelege und Restgrenzen

Die fokussierten Tests prüfen Präfixposition, unveränderte Tokens, Shebang,
Strict-Semantik, Idempotenz, Fremdlizenzsperre, Symlink-Sperre, Scopegrenzen,
fehlende Runtime, echte Typfehler und unverändert geschützte manuelle Spiegel.
Zwei Originalgeneratoren werden ausschließlich in temporären Fixtures
ausgeführt. Der bestehende Runtime-Header-/Marker-Test ergänzt diese Fälle.

Tatsächlich geprüft am 23.10.2026 unter Linux, Node.js 24.19.0 und
TypeScript 5.8.3: **18/18 fokussierte Tests bestanden**. Der Headerlauf
inventarisierte 771 Quellen und ergänzte 732 Köpfe. Für jede dieser Quellen
sind Körper- und Tokenidentität vor/nach dem Lauf belegt; der zweite
Schreiblauf änderte null Dateien. Alle neun erzeugten Runtime-Dateien der
manuellen Spiegel behielten ihre Programm-Tokens. Die Spiegel erhielten
ausschließlich Kommentaränderungen. Der Main-Feldtestblock war zuvor
unabhängig bytegleich in Quelle, manuellem Spiegel und Runtime bestätigt.

`npm run build:ts`, die Prüfung aller 511 Runtime-Spiegel, der korrigierte
No-Check-Gate und der Main-Vertragstypecheck bestanden. RC62 prüfte alle
147 Runtimequellen ohne ungelöste TS2304-/TS2552-Bezeichner. Der vollständige
Headercheck meldete keine fehlenden oder gesperrten Dateien. Die zusätzlich
nach dem Bulk eingeführte Strict-Config-Prüfdatei trägt bereits denselben Kopf.
Rohbelege liegen unter
[`docs/reports/security-continuation-2026-10-23/header-migration/`](../reports/security-continuation-2026-10-23/header-migration/).

Die konkreten Ergebnisse, Quellhashes, Bulk-Änderungen, neun Spiegelvergleiche
und vollständigen Buildprüfungen gehören in den releasegebundenen
1.0.30-Prüfbericht. Die Headeränderung selbst behauptet keine Beseitigung
aller `any`-/No-Check-Ausnahmen, keine OWASP-Zertifizierung und keine
Geräte-/Anlagenfreigabe. Für NW-LIC-02 ist der hier definierte eigene
TS-/JS-Scope maßgeblich; ausgeschlossene Formate und Drittcode bleiben
ausdrücklich getrennt.
