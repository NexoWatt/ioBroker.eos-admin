# src-ts/runtime-executables/www/smarthome-presentation.ts

Ergänzt bestehende SmartHome-Kacheln um einheitliche Typ- und Zustandsanzeigen.

**Daten und Wirkung:** Liest den vorhandenen Gerätevertrag und ergänzt ausschließlich lokale DOM-Texte und sichere Stilwerte.

**Bei Änderungen:** Fehlende und veraltete Werte, vorhandene Bedienelemente und idempotente Dekoration ohne Gerätebefehle prüfen.

[Originalquelle](../../../../../src-ts/runtime-executables/www/smarthome-presentation.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`isRecord`](../../../../../src-ts/runtime-executables/www/smarthome-presentation.ts#L35) | value | Array.isArray |
| [`record`](../../../../../src-ts/runtime-executables/www/smarthome-presentation.ts#L39) | value | isRecord |
| [`text`](../../../../../src-ts/runtime-executables/www/smarthome-presentation.ts#L43) | value | value.trim |
| [`finite`](../../../../../src-ts/runtime-executables/www/smarthome-presentation.ts#L47) | value | Number.isFinite |
| [`fieldUsable`](../../../../../src-ts/runtime-executables/www/smarthome-presentation.ts#L51) | device, field | record, text, unusable.has |
| [`element`](../../../../../src-ts/runtime-executables/www/smarthome-presentation.ts#L62) | className, value | document.createElement |
| [`labelToggle`](../../../../../src-ts/runtime-executables/www/smarthome-presentation.ts#L69) | tile, device, type | document.createElement, fieldUsable, finite, record, tile.querySelector, toggle.appendChild, toggle.getAttribute, toggle.querySelector |
| [`decorateBlind`](../../../../../src-ts/runtime-executables/www/smarthome-presentation.ts#L91) | tile, device | Math.round, arc.replaceWith, dial.classList.add, dial?.querySelector, element, fieldUsable, finite, preview.appendChild, preview.style.setProperty, record, tile.querySelector, visual.appendChild, visual.setAttribute |
| [`decorateClimate`](../../../../../src-ts/runtime-executables/www/smarthome-presentation.ts#L114) | tile, device | big.classList.add, fieldUsable, finite, record, tile.querySelector |
| [`decoratePlayer`](../../../../../src-ts/runtime-executables/www/smarthome-presentation.ts#L125) | tile, device | element, fieldUsable, record, stateNode.textContent?.startsWith, summary.appendChild, text, tile.appendChild, tile.insertBefore, tile.querySelector, unusable.has |
| [`decorate`](../../../../../src-ts/runtime-executables/www/smarthome-presentation.ts#L156) | tile, rawDevice | decorateBlind, decorateClimate, decoratePlayer, document.createElement, element, kinds.get, labelToggle, record, text, tile.classList.contains, tile.querySelector, title.insertBefore, title.querySelector, trigger.appendChild (weitere in der Quelle) |
