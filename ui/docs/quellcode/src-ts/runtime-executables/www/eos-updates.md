# src-ts/runtime-executables/www/eos-updates.ts

Zeigt verfügbare EOS-Versionen und führt angemeldete Kunden durch Vorbereitung und bestätigten Update-Start.

**Daten und Wirkung:** Liest ausschließlich die begrenzte EOS-Update-API; ein Start benötigt eine aktuelle Sitzung, CSRF und den serverseitig geprüften Plan. Ein unbestätigter Start wird nie automatisch wiederholt.

**Bei Änderungen:** Verbindungsabbruch, abgelaufene Sitzung, verworfene Pläne und bestätigte Zielversion getrennt testen; niemals Browserwerte als Installationsfreigabe behandeln.

[Originalquelle](../../../../../src-ts/runtime-executables/www/eos-updates.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| Keine direkten Imports | Browser-Globals, HTML-Script-Reihenfolge und API-Aufrufe können trotzdem Verbindungen herstellen. |

**Direkt importiert von:**

Kein direkter Import innerhalb des erfassten Quellbereichs. Mögliche HTML-, Adapter-, Build- oder dynamische Einstiege sind separat zu prüfen.

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`record`](../../../../../src-ts/runtime-executables/www/eos-updates.ts#L23) | value | Array.isArray |
| [`safeVersion`](../../../../../src-ts/runtime-executables/www/eos-updates.ts#L24) | value | versionPattern.test |
| [`epoch`](../../../../../src-ts/runtime-executables/www/eos-updates.ts#L25) | value | Number.isSafeInteger |
| [`decode`](../../../../../src-ts/runtime-executables/www/eos-updates.ts#L26) | value | epoch, record, safeVersion, states.has |
| [`request`](../../../../../src-ts/runtime-executables/www/eos-updates.ts#L40) | action, signal, body, dispatched | JSON.stringify, decode, dispatched, fetch, record, response.json |
| [`start`](../../../../../src-ts/runtime-executables/www/eos-updates.ts#L60) | – | cancel?.addEventListener, check?.addEventListener, confirmStart?.addEventListener, document.addEventListener, document.getElementById, document.querySelector, gear?.getAttribute, load, prepare?.addEventListener, window.addEventListener |
| [`show`](../../../../../src-ts/runtime-executables/www/eos-updates.ts#L108) | message, error | String |
| [`planReady`](../../../../../src-ts/runtime-executables/www/eos-updates.ts#L111) | – | Date.now |
| [`render`](../../../../../src-ts/runtime-executables/www/eos-updates.ts#L114) | – | badge.setAttribute, badge?.remove, document.createElement, gear.appendChild, gear.setAttribute, planReady, show |
| [`schedule`](../../../../../src-ts/runtime-executables/www/eos-updates.ts#L142) | – | clearTimeout, setTimeout |
| [`errorMessage`](../../../../../src-ts/runtime-executables/www/eos-updates.ts#L149) | error | confirm.close, render, show |
| [`call`](../../../../../src-ts/runtime-executables/www/eos-updates.ts#L165) | action, body, dispatched | clearTimeout, request, setTimeout |
| [`load`](../../../../../src-ts/runtime-executables/www/eos-updates.ts#L176) | – | call, confirm.close, errorMessage, render, schedule |
| [`action`](../../../../../src-ts/runtime-executables/www/eos-updates.ts#L195) | kind | call, confirm.close, confirm.showModal, errorMessage, planReady, render, schedule, show |
