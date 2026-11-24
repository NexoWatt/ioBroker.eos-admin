# src-ts/runtime-executables/www/customer-tariff.ts

Richtet den gemeinsamen Anlagentarif in den Kundeneinstellungen ein.

**Daten und Wirkung:** Schreibt ausschließlich geänderte Tarifparameter über die

**Bei Änderungen:** Quellwechsel, Pflichtfelder, Secret-Erhalt, Konflikte und

[Originalquelle](../../../../../src-ts/runtime-executables/www/customer-tariff.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`isRecord`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L30) | value | Array.isArray |
| [`ownValue`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L31) | value, key | Object.hasOwn, Reflect.get |
| [`text`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L32) | value, fallback | – |
| [`choices`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L33) | value | Array.isArray, value.slice |
| [`decode`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L42) | value | choices, isRecord |
| [`request`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L49) | body | AbortSignal.timeout, JSON.stringify, decode, fetch, response.json |
| [`initialize`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L59) | – | document.getElementById, element, form.addEventListener, input, panel.addEventListener, reload.addEventListener, select, synchronize, window.addEventListener |
| [`input`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L64) | id | document.getElementById |
| [`select`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L65) | id | document.getElementById |
| [`element`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L66) | id | document.getElementById |
| [`show`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L78) | message, error | String |
| [`setOptions`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L79) | target, items, selected, allowCurrent | document.createElement, items.some, supported.has, target.appendChild, target.replaceChildren |
| [`providerChoices`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L88) | – | setOptions, text, view.profiles.filter, view.providers.filter |
| [`secretKey`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L94) | – | – |
| [`mayKeepSecret`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L98) | key | – |
| [`visibility`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L105) | – | element, input, mayKeepSecret, secretKey, supported.has |
| [`values`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L127) | – | Number, Reflect.set, home.value.trim, input |
| [`patch`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L133) | – | Object.entries, Object.keys, Reflect.set, credential.value.trim, isRecord, ownValue, secretKey, values |
| [`controls`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L150) | – | – |
| [`render`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L151) | next | Number.isFinite, String, element, input, isRecord, ownValue, providerChoices, text, values, visibility |
| [`synchronize`](../../../../../src-ts/runtime-executables/www/customer-tariff.ts#L169) | saving | Object.keys, controls, credential.value.trim, form.reportValidity, mayKeepSecret, patch, render, request, secretKey, show, supported.has, view.providers.some |
