# src-ts/runtime-executables/www/evcs.ts

Verbindet Ladepunkt-Anzeige, Moduswahl und Kundenvorgaben mit den freigegebenen Lade-APIs.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/evcs.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`_hasPendingEvcsControlWrite`](../../../../../src-ts/runtime-executables/www/evcs.ts#L80) | idx | _modeWriteRequests.has |
| [`_fetchEvcsModeJson`](../../../../../src-ts/runtime-executables/www/evcs.ts#L86) | url, options | clearTimeout, fetch, response.json, setTimeout |
| [`_setPendingWrite`](../../../../../src-ts/runtime-executables/www/evcs.ts#L103) | key, value, ttlMs | Date.now, String |
| [`_clearPendingWrite`](../../../../../src-ts/runtime-executables/www/evcs.ts#L114) | key, expectedValue | String |
| [`_isOlderEvcsModeEntry`](../../../../../src-ts/runtime-executables/www/evcs.ts#L128) | key, incoming, current | Number, Number.isFinite |
| [`_replaceStateSnapshot`](../../../../../src-ts/runtime-executables/www/evcs.ts#L140) | payload | Object.assign, Object.create, Object.entries, _isOlderEvcsModeEntry |
| [`_mergeUpdatePayload`](../../../../../src-ts/runtime-executables/www/evcs.ts#L153) | payload | Date.now, Object.assign, Object.create, Object.entries, String, _isOlderEvcsModeEntry |
| [`_isEvcsRelevantPayload`](../../../../../src-ts/runtime-executables/www/evcs.ts#L185) | payload | Object.keys, k.startsWith |
| [`scheduleRender`](../../../../../src-ts/runtime-executables/www/evcs.ts#L199) | – | Date.now, Math.max, clearTimeout, setTimeout |
| [`d`](../../../../../src-ts/runtime-executables/www/evcs.ts#L223) | key | Object.prototype.hasOwnProperty.call |
| [`fmtW`](../../../../../src-ts/runtime-executables/www/evcs.ts#L236) | w | Math.abs, Math.round, Number, isNaN |
| [`fmtPct`](../../../../../src-ts/runtime-executables/www/evcs.ts#L248) | v | Math.round, Number, isFinite |
| [`fmtKwh`](../../../../../src-ts/runtime-executables/www/evcs.ts#L259) | v | Number, isNaN |
| [`fmtMin`](../../../../../src-ts/runtime-executables/www/evcs.ts#L269) | v | Math.round, Number, isFinite |
| [`fmtClock`](../../../../../src-ts/runtime-executables/www/evcs.ts#L281) | ts | Number, String, dt.getHours, dt.getMinutes, isFinite |
| [`nextTsFromTimeInput`](../../../../../src-ts/runtime-executables/www/evcs.ts#L299) | hhmm | Number, String, dt.getDate, dt.getTime, dt.setDate, dt.setHours, isFinite, now.getTime, s.split, snapHhmmTo15Min |
| [`snapHhmmTo15Min`](../../../../../src-ts/runtime-executables/www/evcs.ts#L325) | hhmm | Math.floor, Math.max, Math.min, Math.round, Number, String, isFinite, s.split |
| [`esc`](../../../../../src-ts/runtime-executables/www/evcs.ts#L348) | s | String |
| [`safeIdPart`](../../../../../src-ts/runtime-executables/www/evcs.ts#L359) | input | String, s.toLowerCase |
| [`rfidLabel`](../../../../../src-ts/runtime-executables/www/evcs.ts#L370) | i | d, titleParts.join, titleParts.push |
| [`reasonHint`](../../../../../src-ts/runtime-executables/www/evcs.ts#L404) | reason, applyStatus | String |
| [`emsModeToUi`](../../../../../src-ts/runtime-executables/www/evcs.ts#L448) | mode | String |
| [`clampEmsUi`](../../../../../src-ts/runtime-executables/www/evcs.ts#L461) | v | Math.max, Math.min, Math.round, Number, isFinite |
| [`normalizeEvcsPhaseMode`](../../../../../src-ts/runtime-executables/www/evcs.ts#L467) | raw | String |
| [`phaseModeLabel`](../../../../../src-ts/runtime-executables/www/evcs.ts#L475) | mode | normalizeEvcsPhaseMode |
| [`clampUiMode`](../../../../../src-ts/runtime-executables/www/evcs.ts#L489) | v | Math.max, Math.min, Math.round, Number, isFinite |
| [`evcsMetaRow`](../../../../../src-ts/runtime-executables/www/evcs.ts#L500) | index | Array.isArray, Math.max, Math.round, Number |
| [`evcsPhaseSwitchDpAssigned`](../../../../../src-ts/runtime-executables/www/evcs.ts#L505) | index | String, evcsMetaRow |
| [`evcsStorageAssistCustomerAllowed`](../../../../../src-ts/runtime-executables/www/evcs.ts#L510) | index | evcsMetaRow |
| [`evcsGlobalStorageAssistCustomerAllowed`](../../../../../src-ts/runtime-executables/www/evcs.ts#L515) | – | evcsGlobalStorageAssistIndices |
| [`evcsGlobalStorageAssistIndices`](../../../../../src-ts/runtime-executables/www/evcs.ts#L520) | – | Array.isArray, out.push |
| [`renderEvcsGlobalStorageAssistControl`](../../../../../src-ts/runtime-executables/www/evcs.ts#L531) | – | document.getElementById, evcsGlobalStorageAssistCustomerAllowed, evcsGlobalStorageAssistIndices, indices.map, values.every, wrap.classList.toggle, wrap.querySelectorAll |
| [`storageAssistLabel`](../../../../../src-ts/runtime-executables/www/evcs.ts#L556) | enabled | – |
| [`evcsConfiguredPhaseMode`](../../../../../src-ts/runtime-executables/www/evcs.ts#L560) | index, fallbackPhases | Number, String, evcsMetaRow, normalizeEvcsPhaseMode |
| [`_touchModalInteraction`](../../../../../src-ts/runtime-executables/www/evcs.ts#L578) | ttlMs | Date.now |
| [`_scheduleModalRerenderRetry`](../../../../../src-ts/runtime-executables/www/evcs.ts#L588) | delayMs | Math.max, Math.min, Math.round, Number, setTimeout |
| [`_isModalLocked`](../../../../../src-ts/runtime-executables/www/evcs.ts#L609) | modalEl | Date.now, ae.getAttribute, modalEl.contains |
| [`_hasEms`](../../../../../src-ts/runtime-executables/www/evcs.ts#L651) | – | d |
| [`_computeBoostQueueRank`](../../../../../src-ts/runtime-executables/www/evcs.ts#L660) | count | Number, String, boostArr.push, boostArr.sort, d, isFinite |
| [`_modeBadge`](../../../../../src-ts/runtime-executables/www/evcs.ts#L694) | emsUserMode | String |
| [`_evcsBoolOrNull`](../../../../../src-ts/runtime-executables/www/evcs.ts#L708) | value | Number.isFinite, String |
| [`_resolveEvcsDisplayStatus`](../../../../../src-ts/runtime-executables/www/evcs.ts#L720) | { hasEms = false, rawStatus = '', effectiveStatus = '', statusClass = '', statusFresh = false, statusIgnoredReason = '', faultActive = false, unavailableActive = false, online = null, reason = '', } | String, _evcsBoolOrNull, cls.startsWith, raw.toLowerCase |
| [`_tileStateClass`](../../../../../src-ts/runtime-executables/www/evcs.ts#L768) | { powerW, reason, regEnabled, online, statusClass, faultActive, unavailableActive } | Math.abs, Number, String, _evcsBoolOrNull, cls.startsWith, isFinite |
| [`_shortStatusText`](../../../../../src-ts/runtime-executables/www/evcs.ts#L783) | statusInfo, reason, online | String, _resolveEvcsDisplayStatus |
| [`_evcsStatusInfoForIndex`](../../../../../src-ts/runtime-executables/www/evcs.ts#L791) | i, hasEms | String, _evcsBoolOrNull, _hasEms, _resolveEvcsDisplayStatus, d |
| [`openEvcsModal`](../../../../../src-ts/runtime-executables/www/evcs.ts#L820) | idx | Number, Number.isFinite, String, _evcsStatusInfoForIndex, _hasEms, _touchModalInteraction, buildEvcsModalBodyHtml, d, document.getElementById, fmtPct, fmtW, modal.classList.remove, modal.setAttribute, parts.join (weitere in der Quelle) |
| [`closeEvcsModal`](../../../../../src-ts/runtime-executables/www/evcs.ts#L864) | – | clearTimeout, document.getElementById, modal.classList.add, modal.setAttribute |
| [`buildEvcsModalBodyHtml`](../../../../../src-ts/runtime-executables/www/evcs.ts#L885) | i | Array.isArray, Math.ceil, Math.max, Math.round, Number, Number.isFinite, String, _evcsBoolOrNull, _hasEms, _modeWriteErrors.get, _modeWriteRequests.has, _resolveEvcsDisplayStatus, clampEmsUi, d (weitere in der Quelle) |
| [`render`](../../../../../src-ts/runtime-executables/www/evcs.ts#L1314) | – | Array.isArray, Date.now, Math.abs, Math.max, Math.round, Number, String, _computeBoostQueueRank, _evcsBoolOrNull, _evcsStatusInfoForIndex, _hasEms, _isModalLocked, _modeBadge, _scheduleModalRerenderRetry (weitere in der Quelle) |
| [`initMenu`](../../../../../src-ts/runtime-executables/www/evcs.ts#L1482) | – | btn.addEventListener, dd.addEventListener, document.addEventListener, document.getElementById |
| [`bindControls`](../../../../../src-ts/runtime-executables/www/evcs.ts#L1507) | – | closeBtn.addEventListener, document.addEventListener, document.getElementById, globalStorageAssist.addEventListener, list.addEventListener, modal.addEventListener |
| [`bumpLock`](../../../../../src-ts/runtime-executables/www/evcs.ts#L1612) | ev | String, _touchModalInteraction, document.getElementById, m.contains, t.closest |
| [`_syncModeButtonsUi`](../../../../../src-ts/runtime-executables/www/evcs.ts#L1888) | idx, mode | Array.from, String, bs.forEach, document.querySelectorAll |
| [`_syncAutoSourceButtonsUi`](../../../../../src-ts/runtime-executables/www/evcs.ts#L1899) | idx, source | Array.from, String, buttons.forEach, document.querySelectorAll |
| [`handleModeButton`](../../../../../src-ts/runtime-executables/www/evcs.ts#L1915) | btn | Date.now, JSON.stringify, Number, Number.isFinite, Number.isInteger, Object.prototype.hasOwnProperty.call, String, _clearPendingWrite, _fetchEvcsModeJson, _hasPendingEvcsControlWrite, _mergeUpdatePayload, _modeWriteErrors.delete, _modeWriteErrors.set, _modeWriteRequests.delete (weitere in der Quelle) |
| [`bootstrap`](../../../../../src-ts/runtime-executables/www/evcs.ts#L2118) | – | Array.isArray, Math.max, Math.round, Number, _replaceStateSnapshot, bindControls, document.getElementById, fetch, initMenu, l.classList.toggle, n.classList.toggle, sc.evcsList.filter, scheduleRender, sfMenu.classList.toggle (weitere in der Quelle) |
