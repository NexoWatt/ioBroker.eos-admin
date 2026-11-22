<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary. Nutzung, Modifikation oder Verbreitung ohne ausdrückliche Erlaubnis untersagt. -->
# Getrennte Nachprüfung: Konfigurationsgrenzen und ENTSO-E

Datum 23.10.2026, Kandidat 1.0.30 aus dem ursprünglichen 1.0.29-ZIP.
Diese Prüfung wurde durch einen anderen KI-Arbeitsagenten als die jeweiligen
Implementierer durchgeführt. Sie ist keine externe Zertifizierung und keine
Hausanlagenprüfung. Der prüfende Agent hat die Konfigurations- und Tarifquellen
nicht selbst geändert; sein eigener Mesh-Fix wird getrennt nachgeprüft.

## Strikte NVP-/Dynamic-Grid-Grenzen

Gelesen wurden beide kanonischen API-Quellen und
`lib/config-boundary-contracts.ts`; zusätzlich wurden alter und neuer Code mit
TypeScript ohne Kommentare transpiliert und die tatsächlichen Verhaltensänderungen
verglichen. Die zusätzlichen Guards grenzen unbekannte Werte vor ihrer Nutzung
ein. Die fachlichen Validatoren und bestehenden CAS-/Alias-/Aktivierungsgrenzen
bleiben erhalten. Fehlerhafte Fremdobjekte werden gezielt abgewiesen.

Eine zusätzliche Differentialprobe verglich 44 Fälle der tatsächlichen generierten
API-Module mit den Originalmodulen aus dem 1.0.29-ZIP: fehlende, falsche, alte und
vollständige Konfigurationen, statischer/aktiver Modus, unvollständige Gerätezeilen
und unterschiedliche Versionswerte. Kein unerwarteter Ergebnisunterschied.
`tsc --noEmit -p tsconfig.config-boundaries.json` und 39 vorhandene/neue native
Tests der drei Dateien `test/config-boundaries.test.cjs`,
`test/nvp-config-api.test.cjs` und `test/dynamic-grid-config-api.test.cjs` bestanden.
Keine bestätigte neue kritische Lücke im begrenzten Änderungsscope gefunden.

## ENTSO-E-Parser

Beim echten Runtime-Sync fiel zunächst ein konkreter Integrationsfehler auf:
TypeScript-Funktionsannotationen waren in einer bislang textkopierten Runtimequelle
enthalten und erzeugten syntaktisch ungültiges JavaScript. Der Implementierer
entfernte diese Annotationen. Die nachfolgenden Prüfungen liefen gegen den
korrigierten erzeugten Tarifcode; der ursprüngliche Fehler gilt nicht als offen.

Der neue Scanner läuft vorwärts und begrenzt Tiefe, Elemente, Taglänge und Body.
Perioden und Punkte sind disjunkte Teiltexte; ihre wiederholten festen Feldabfragen
führen nicht zum früheren erneuten Rückwärtssuchen durch den gesamten Resttext.
DTD-/Entity-Nachladen wird nicht eingeführt. Eine eigene Differentialprobe am
wirklich erzeugten Modul verglich 18 gültige Preisreihen mit dem ursprünglichen
1.0.29-Modul: ein, zwei und vier Tage mit 96/48/24 Intervallen pro Tag, negative
Preise sowie vorhandene Formelanwendung. Alle Ergebnisse blieben identisch.
Ein 560.000-Byte-Text aus ungeschlossenen Period-Tags wurde in dieser Umgebung
nach rund 1,1 ms abgewiesen. Das ist ein gemessener lokaler Wert, keine zugesagte
Echtzeitgrenze auf der Zielhardware.

Die bestehenden Tarif-Runtime-, Freshness- und Storage-Status-Prüfer sowie die
18 Parserprüfungen bestanden nach der Buildkorrektur. Nicht getestet wurden eine
reale Anbieteranmeldung, ein tatsächlicher Tarifabruf oder physische Anlagenwirkung.

## Reproduzierbare Belege

- `review-config-differential.cjs` und `review-config-differential.log`: 44 zusätzliche Vergleiche.
- `config-independent-typecheck.log` und `config-independent-tests.log`: Strict und 39 Tests.
- `review-entsoe-generated.cjs` und `review-entsoe-generated.log`: 18 Vergleiche und CPU-Probe.
- `entsoe-independent-existing.log`: bestehende Tarifprüfungen plus 18 Parserprüfungen.

Die Baselines wurden aus dem unveränderten Eingangspaket extrahiert. Der
übergeordnete Releasebericht führt die bereinigten Belege und endgültige
Quellen-/Artefaktbindung zusammen. Ein erfolgreicher Gesamtlauf und die
Paketprüfung bleiben Aufgaben der Releaseintegration; sie werden hier nicht
vorweggenommen.
