<!-- Copyright (c) 2026 NexoWatt. All rights reserved. Confidential and Proprietary.
Use, modification or distribution without express written permission is prohibited. -->
# Serviceworker-v524: Aktualisierung des Regressionstests

Stand: 11.11.2026, NexoWatt UI 1.0.36. Änderung ausschließlich an `scripts/verify-cra-frontend.cjs`; keine Änderung an Produktcode, Cachefilter oder Sicherheitsregeln.

Der vorhandene Test erwartete noch das Löschverhalten für den aktiven Cache v523: v520, v521 und v522 löschen, v523 behalten. Der für diesen Testrelease bewusst auf v524 aktualisierte Serviceworker entfernt zusätzlich v523 korrekt. Die ursprüngliche Assertion scheiterte deshalb an der veralteten Testvorgabe.

Die Fixture enthält jetzt v520 bis einschließlich v524 sowie `other-app-cache`. Die unverändert strenge Array-Gleichheitsprüfung verlangt exakt die Löschung von v520, v521, v522 und v523. Dadurch werden auch das Beibehalten des aktuellen v524-Caches und des fremden Anwendungscaches geprüft. Die erwarteten Werte sind fest im Test definiert und werden nicht aus dem produktiven Ergebnis abgeleitet.

Prüfung: `node scripts/verify-cra-frontend.cjs` unter Node.js 24.22.1. Ergebnis: **46 Regressionen bestanden, Exitcode 0**. Beleg: `cra-frontend-v524.log`. Die Prüfung verwendet Originalfunktionen in einer Node-VM mit DOM-/Fetch-/Cache-Doubles. Ein realer Chromium-Lauf wurde damit nicht durchgeführt.

Für dieses `.cjs`-Prüfskript existiert kein TypeScript-Spiegel. Der vorhandene Skript-Spiegelworkflow betrifft `src-ts/scripts/publish-check-rules.ts` und `scripts/publish-check-rules.js`; diese Dateien wurden nicht verändert. Das geänderte Prüfskript und dieser Nachweis sind beim anschließenden finalen Artefaktsiegel zu berücksichtigen.
