# src-ts/runtime-executables/www/smarthome.ts

Stellt die konfigurierte SmartHome-Oberfläche dar und übermittelt freigegebene Geräte-/Szenenaktionen.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/smarthome.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`nwLsReadJson`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L102) | key, fallback | JSON.parse, localStorage.getItem |
| [`nwLsWriteJson`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L117) | key, value | JSON.stringify, localStorage.setItem |
| [`nwGetAllPlayerZones`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L130) | – | Array.isArray, nwAllDevices.filter |
| [`nwLoadAudioZoneSelection`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L141) | – | Array.isArray, ids.filter, nwLsReadJson |
| [`nwSaveAudioZoneSelection`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L151) | ids | Array.isArray, ids.filter, nwLsWriteJson |
| [`nwGetSelectedAudioZones`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L161) | primaryId | nwGetAllPlayerZones, nwLoadAudioZoneSelection, sel.includes, sel.unshift |
| [`nwSetSelectedAudioZones`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L174) | ids, primaryId | Array.isArray, arr.includes, arr.unshift, ids.filter, nwSaveAudioZoneSelection |
| [`nwPlayerFavKey`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L187) | devId, kind | String |
| [`nwLoadPlayerFavs`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L196) | devId, kind | Array.isArray, arr.map, nwLsReadJson, nwPlayerFavKey |
| [`nwSavePlayerFavs`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L206) | devId, kind, favs | Array.isArray, favs.map, nwLsWriteJson, nwPlayerFavKey |
| [`nwTogglePlayerFav`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L216) | devId, kind, value | String, favs.indexOf, favs.push, favs.splice, nwLoadPlayerFavs, nwSavePlayerFavs |
| [`nwMovePlayerFav`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L234) | devId, kind, value, dir | String, favs.indexOf, nwLoadPlayerFavs, nwSavePlayerFavs |
| [`nwPlayerRecentKey`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L253) | devId | String |
| [`nwLoadPlayerRecent`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L262) | devId | Array.isArray, nwLsReadJson, nwPlayerRecentKey |
| [`nwAddPlayerRecent`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L272) | devId, item | Date.now, String, filtered.slice, filtered.unshift, list.filter, nwLoadPlayerRecent, nwLsWriteJson, nwPlayerRecentKey |
| [`nwGetIconSvg`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2173) | name, isOn | String |
| [`nwIsEmojiLike`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2187) | str | String |
| [`nwEscapeHtml`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2199) | str | String |
| [`nwSafeWebUrl`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2215) | value | value.trim |
| [`nwSafeBadgeText`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2230) | value | String, s.replace, s.slice |
| [`nwParseDynamicIcon`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2244) | rawValue | String, lower.startsWith, raw.slice, raw.toLowerCase |
| [`nwDynamicDeviceIconSvg`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2271) | kind, labelRaw, isOn | nwEscapeHtml, nwSafeBadgeText |
| [`nwStaticIconHtml`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2324) | iconValue | String, nwDynamicDeviceIconSvg, nwEscapeHtml, nwNormalizeIconName, nwParseDynamicIcon |
| [`nwNormalizeIconName`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2345) | raw | String |
| [`nwLooksLikeTemperatureDevice`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2484) | dev | String, unit.includes |
| [`nwNormalizeTemperatureUnit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2517) | dev, unit | String, nwLooksLikeTemperatureDevice, raw.toLowerCase |
| [`nwGuessIconName`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2533) | dev | String, hay.match, nwLooksLikeTemperatureDevice |
| [`nwGetIconSpec`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2573) | dev | String, nwGuessIconName, nwIsEmojiLike, nwNormalizeIconName, nwParseDynamicIcon |
| [`nwGetAccentColor`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2603) | dev, iconName | String, fn.includes, iconKey.slice, iconKey.startsWith |
| [`nwGetQualityStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2653) | dev | String |
| [`nwGetQualityLabel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2659) | dev | nwGetQualityStatus |
| [`nwGetDeviceIndicators`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2676) | dev | Number.isFinite, String, error.trim, items.push, nwFormatNumberDE |
| [`nwCreateDeviceIndicators`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2697) | dev | document.createElement, nwGetDeviceIndicators |
| [`nwHasPrimaryState`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2709) | dev | String, nwGetQualityStatus |
| [`nwIsMomentaryDevice`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2722) | dev | String |
| [`nwIsOn`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2733) | dev | String, nwHasPrimaryState |
| [`nwSupportsTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2773) | dev | String |
| [`nwGetStateText`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2787) | dev | Math.round, String, nwClampNumber, nwGetQualityLabel, nwGetQualityStatus, nwHasPrimaryState, nwIsMomentaryDevice, nwNormalizeTemperatureUnit, st.climateError.trim, st.currentTemp.toFixed, st.setpoint.toFixed, st.value.toFixed |
| [`nwGetTileHint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2874) | dev | String, nwHasWriteAccess |
| [`nwFormatBigValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2895) | dev | Number.isNaN, String, formatUnit, st.currentTemp.toFixed, st.setpoint.toFixed, st.value.toFixed |
| [`formatUnit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2905) | unit | nwNormalizeTemperatureUnit |
| [`nwGetTileSize`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2962) | dev | – |
| [`nwHasWriteAccess`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2974) | dev | String |
| [`nwCreateIconElement`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3017) | dev, isOn, iconSpec, accent | String, document.createElement, name.startsWith, nwDynamicDeviceIconSvg, wrap.appendChild, wrap.classList.add |
| [`nwSmartHomePost`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3073) | endpoint, payload, deviceId | JSON.stringify, String, clearTimeout, fetch, response.json, setTimeout, window.NW_SH_FEEDBACK.post |
| [`nwBindSmartHomeControls`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3090) | root, deviceId | String, root.querySelectorAll, window.NW_SH_FEEDBACK?.attachStatus |
| [`nwFetchDevices`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3102) | – | Array.isArray, fetch, res.json |
| [`nwToggleDevice`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3115) | id, value | nwSmartHomePost |
| [`nwSetLevel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3127) | id, level | nwSmartHomePost |
| [`nwSetColor`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3137) | id, colorOrPayload | Array.isArray, nwSmartHomePost |
| [`nwCoverAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3148) | id, action, value | nwSmartHomePost |
| [`nwPlayerAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3159) | id, action, value | nwSmartHomePost |
| [`nwPlayerActionMulti`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3173) | primaryId, action, value | Array.from, nwGetSelectedAudioZones, nwPlayerAction |
| [`nwSetRtrSetpoint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3192) | id, setpoint | nwSmartHomePost |
| [`nwClimateAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3198) | id, action, value | nwSmartHomePost |
| [`nwSetSmartHomeValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3205) | id, value | nwSmartHomePost |
| [`nwSaveDeviceTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3217) | deviceId, timer | nwSmartHomePost |
| [`nwDeleteDeviceTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3227) | deviceId | nwSmartHomePost |
| [`nwAdjustRtrSetpoint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3237) | dev, delta | nwReloadDevices, nwSetRtrSetpoint |
| [`nwClear`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3260) | el | el.removeChild |
| [`nwSortBy`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3270) | a, b | String |
| [`nwGetDeviceOrder`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3283) | dev | Number.isFinite |
| [`nwTypeLabel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3330) | type | String, t.charAt, t.slice |
| [`nwCompareDevices`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3341) | a, b | nwGetDeviceOrder, nwIsFavorite, nwSortBy, nwTypeLabel |
| [`nwGroupDevicesByType`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3373) | devices | Array.from, groups.sort, map.entries |
| [`nwFormatNumberDE`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3396) | value, precision | Number, Number.isFinite, v.toFixed |
| [`nwComputeRoomSummary`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3408) | roomId, allDevices | Array.isArray, Math.round, Number, Number.isFinite, String, allDevices.filter, devs.forEach, nwFormatNumberDE, nwNormalizeId, parts.join, parts.push, pick |
| [`pick`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3465) | arr | arr.sort |
| [`nwApplyFilters`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3492) | devices | Array.isArray, devices.slice, out.filter |
| [`nwGetAllFunctions`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3515) | devices | Array.from |
| [`nwGuessIconForFunctionLabel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3529) | label | String, s.includes |
| [`nwRenderViewChips`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3547) | – | document.getElementById, mkChip, nwClear |
| [`mkChip`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3557) | label, active, onClick | btn.addEventListener, document.createElement, wrap.appendChild |
| [`nwRenderTextSizeChips`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3586) | – | document.getElementById, mkChip, nwClear, nwNormTextSize |
| [`mkChip`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3596) | label, active, onClick | btn.addEventListener, document.createElement, wrap.appendChild |
| [`nwRenderFunctionChips`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3636) | devices | allFns.forEach, document.getElementById, mkChip, nwClear, nwGetAllFunctions |
| [`mkChip`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3658) | label, active, onClick, extraClass, disabled, title, iconName | btn.addEventListener, btn.querySelector, document.createElement, nwGetIconSvg, wrap.appendChild |
| [`nwGroupByRoom`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3721) | devices | Array.from, keys.map, keys.sort, map.keys |
| [`nwGroupByFunction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3792) | devices | Array.from, fns.map, map.keys |
| [`nwShowEmptyState`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3809) | show, ctx | document.getElementById, empty.classList.remove |
| [`nwEnsureShToast`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3859) | – | document.body.appendChild, document.createElement, el.setAttribute |
| [`nwHideShToast`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3874) | – | clearTimeout, nwShToastEl.classList.remove |
| [`nwShowShToastForTile`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3888) | dev | String, clearTimeout, document.createElement, nwClear, nwEnsureShToast, nwGetStateText, parts.join, parts.push, setTimeout, toast.appendChild, toast.classList.add |
| [`nwReleaseUnusedCustomTiles`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3927) | – | nwCustomTilePool.delete, window.NW_SH_CUSTOM_VIEWS?.destroy |
| [`nwCreateTile`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3936) | dev, opts | Date.now, Math.max, Math.min, Math.round, Number.isFinite, String, actions.appendChild, addMiniBtn, addMiniToggle, arc.appendChild, big.appendChild, btn.addEventListener, btnRow.appendChild, complete.classList.add (weitere in der Quelle) |
| [`stop`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4368) | ev | ev.stopPropagation |
| [`addMiniToggle`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4406) | – | document.createElement, footer.appendChild, t.addEventListener, t.setAttribute |
| [`addMiniBtn`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4444) | label, title, onClick | b.addEventListener, b.setAttribute, document.createElement, footer.appendChild |
| [`mk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4508) | label, action, mapped, allowed | b.addEventListener, b.setAttribute, document.createElement |
| [`lpCancel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4559) | – | clearTimeout |
| [`nwCaptureDeviceFocus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4691) | element | element.closest |
| [`nwRestoreDeviceFocus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4701) | saved | Array.from, document.getElementById, document.querySelectorAll, target.focus, tile.querySelector, tile.querySelectorAll |
| [`nwPopoverFocusableElements`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4718) | – | Array.from, nwPopoverEl.querySelectorAll |
| [`nwActivatePopoverSurface`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4731) | anchorEl | Array.from, nwCaptureDeviceFocus, nwLockBodyScroll, nwPopoverBackdropEl.classList.remove, nwPopoverEl.classList.remove, requestAnimationFrame |
| [`nwSyncOpenPopoverFeedback`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4758) | devices | JSON.stringify, String, devices.find, indicators.replaceWith, nwClosePopover, nwCreateDeviceIndicators, nwGetQualityStatus, nwGetStateText, nwPopoverEl.querySelector |
| [`nwLockBodyScroll`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4792) | – | Math.max, document.body.classList.add |
| [`nwUnlockBodyScroll`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4820) | – | document.body.classList.remove, window.scrollTo |
| [`nwEnsurePopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4846) | – | document.addEventListener, document.body.appendChild, document.createElement, nwPopoverBackdropEl.addEventListener, nwPopoverEl.addEventListener, nwPopoverEl.setAttribute, window.addEventListener |
| [`close`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4880) | – | nwClosePopover |
| [`nwClosePopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4935) | – | nwPopoverBackdropEl.classList.add, nwPopoverBackground.forEach, nwPopoverEl.classList.add, nwRestoreDeviceFocus, nwUnlockBodyScroll, window.NW_SH_TOUCH?.cancel |
| [`nwOpenDevicePopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4960) | dev, anchorEl | nwActivatePopoverSurface, nwBindSmartHomeControls, nwBuildPopoverContent, nwClosePopover, nwEnsurePopover, nwGetQualityStatus, nwPopoverEl.classList.contains |
| [`nwOpenTimerPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4990) | dev, anchorEl | nwActivatePopoverSurface, nwBindSmartHomeControls, nwBuildTimerPopoverContent, nwClosePopover, nwEnsurePopover, nwPopoverEl.classList.contains |
| [`nwBuildTimerPopoverContent`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5015) | dev | Array.isArray, Math.max, Math.min, Math.round, Number.isNaN, String, b.addEventListener, body.appendChild, btn.addEventListener, closeBtn.addEventListener, closeBtn.setAttribute, delBtn.addEventListener, document.createElement, footer.appendChild (weitere in der Quelle) |
| [`fmtNext`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5087) | – | Date.now, Number, Number.isFinite, String, d.getHours, d.getMinutes |
| [`updateHeaderState`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5113) | – | fmtNext |
| [`rebuildDays`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5175) | – | Array.from, days.sort |
| [`mkTime`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5217) | lbl, val, onChange | document.createElement, inp.addEventListener, wrap.appendChild |
| [`nwPositionPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5332) | anchorEl | Math.max, Math.min, Math.round, nwPopoverEl.classList.contains |
| [`nwClampNumber`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5360) | v, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`nwRoundToStep`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5371) | v, step | Math.round, Number, Number.isFinite |
| [`nwUpdateRangeFill`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5387) | rangeEl | Math.max, Math.min, Number, Number.isFinite, clamped.toFixed, rangeEl.style.setProperty |
| [`nwLoadJsonLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5419) | key, defVal | JSON.parse, localStorage.getItem |
| [`nwSaveJsonLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5436) | key, obj | JSON.stringify, localStorage.setItem |
| [`nwLoadFavoriteOverrides`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5447) | – | Object.keys, nwLoadJsonLS |
| [`nwSaveFavoriteOverrides`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5465) | map | nwSaveJsonLS |
| [`nwGetInstallerFavorite`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5474) | dev | – |
| [`nwIsFavorite`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5483) | dev | Object.prototype.hasOwnProperty.call, String, nwGetInstallerFavorite |
| [`nwToggleFavorite`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5498) | dev | Object.prototype.hasOwnProperty.call, String, nwGetInstallerFavorite, nwIsFavorite, nwSaveFavoriteOverrides |
| [`nwLoadNumberLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5520) | key, defVal | Number, Number.isFinite, localStorage.getItem |
| [`nwSaveNumberLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5536) | key, val | String, localStorage.setItem |
| [`nwCreateStatusBadge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5547) | – | document.createElement, el.setAttribute |
| [`nwSetStatusBadge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5560) | el, kind, text | el.classList.add, el.classList.remove |
| [`nwLoadBoolLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5579) | key, defVal | localStorage.getItem |
| [`nwSaveBoolLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5596) | key, val | localStorage.setItem |
| [`nwLoadViewMode`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5607) | defMode | String, localStorage.getItem |
| [`nwSaveViewMode`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5621) | mode | localStorage.setItem |
| [`nwNormTextSize`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5632) | v | String |
| [`nwLoadTextSize`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5645) | defSize | localStorage.getItem, nwNormTextSize |
| [`nwSaveTextSize`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5658) | size | localStorage.setItem, nwNormTextSize |
| [`nwApplyTextSizeClass`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5669) | size | document.getElementById, nwNormTextSize, root.classList.add, root.classList.remove |
| [`nwCreateLivePreviewSender`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5688) | sendFn, intervalMs | – |
| [`schedule`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5701) | – | Date.now, Math.max, clearTimeout, setTimeout |
| [`trigger`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5749) | val, force | schedule |
| [`nwCreateSmartHomeRangeControl`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5761) | options | Math.max, Math.min, Number, Number.isFinite, String, document.createElement, format, header.appendChild, nwClampNumber, nwCreateStatusBadge, nwUpdateRangeFill, right.appendChild, slider.addEventListener, slider.setAttribute (weitere in der Quelle) |
| [`nwBuildPopoverContent`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5844) | dev | String, body.appendChild, close.addEventListener, close.setAttribute, document.createElement, hdr.appendChild, left.appendChild, nwCreateBlindPopover, nwCreateColorPopover, nwCreateDeviceIndicators, nwCreateIconElement, nwCreateLevelPopover, nwCreatePlayerPopover, nwCreateRtrPopover (weitere in der Quelle) |
| [`nwCreateLevelPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5938) | dev, canWrite, opts | Math.round, Number.isFinite, String, btnRow.appendChild, document.createElement, liveBtn.addEventListener, liveBtn.setAttribute, nwClampNumber, nwCreateLivePreviewSender, nwCreateSmartHomeRangeControl, nwCreateStatusBadge, nwCreateValueGauge, nwHasPrimaryState, nwIsOn (weitere in der Quelle) |
| [`clearStatusTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5984) | – | clearTimeout |
| [`flashStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5996) | kind, text, ms | clearStatusTimer, nwSetStatusBadge, setTimeout |
| [`setBusy`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6012) | – | flashStatus |
| [`setOk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6019) | – | flashStatus |
| [`setErr`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6026) | – | flashStatus |
| [`commitLevel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6072) | nextVal, opts | Math.round, String, dial.nwSetValue, nwClampNumber, nwReloadDevices, nwSetLevel, nwUpdateRangeFill, setBusy, setErr, setOk |
| [`formatter`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6105) | val | Math.round |
| [`minmaxFormatter`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6106) | val | Math.round |
| [`onInput`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6107) | val | Math.round, String, liveSender.trigger, nwUpdateRangeFill |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6113) | val | commitLevel |
| [`updateHint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6169) | – | – |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6195) | value | nwReloadDevices, nwSetColor |
| [`nwCreateColorPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6238) | dev, canWrite | Math.round, String, btnRow.appendChild, clamp01, current.toUpperCase, document.createElement, liveBtn.addEventListener, liveBtn.setAttribute, normHex, nwCreateLivePreviewSender, nwCreateSmartHomeRangeControl, nwCreateStatusBadge, nwHasPrimaryState, nwIsOn (weitere in der Quelle) |
| [`normHex`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6258) | val | String, s.slice, s.startsWith, s.toLowerCase |
| [`clamp01`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6284) | n | Math.max, Math.min, Number |
| [`clamp`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6291) | n, lo, hi | Math.max, Math.min, Number |
| [`hexToRgb`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6298) | hex | h.slice, normHex, parseInt, s.slice |
| [`rgbToHex`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6313) | r, g, b | Math.round, clamp |
| [`rgbToHsv`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6325) | r, g, b | Math.max, Math.min, clamp01 |
| [`hsvToRgb`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6350) | h, s, v | Math.abs, Math.round, Number, clamp01 |
| [`setHsvFromHex`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6378) | hex | hexToRgb, rgbToHsv |
| [`clearStatusTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6426) | – | clearTimeout |
| [`flashStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6438) | kind, text, ms | clearStatusTimer, nwSetStatusBadge, setTimeout |
| [`setBusy`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6454) | – | flashStatus |
| [`setOk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6461) | – | flashStatus |
| [`setErr`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6468) | – | flashStatus |
| [`hsvToHex`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6521) | h, s, vVal | hsvToRgb, rgbToHex |
| [`updateValueSliderGradient`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6531) | – | hsvToHex, valueSlider.style.setProperty |
| [`updateWheelMarker`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6542) | – | Math.cos, Math.sin, clamp01 |
| [`setUi`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6560) | hex | Math.round, String, clamp01, h.toUpperCase, normHex, setHsvFromHex, updateValueSliderGradient, updateWheelMarker |
| [`drawWheel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6576) | – | Math.atan2, Math.max, Math.min, Math.round, Math.sqrt, ctx.clearRect, ctx.createImageData, ctx.putImageData, ctx.setTransform, hsvToRgb, wheelCanvas.getContext |
| [`commitColor`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6633) | hex, opts | normHex, nwReloadDevices, nwSetColor, setBusy, setErr, setOk, setUi |
| [`updateFromWheelEvent`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6665) | ev, opts | Math.atan2, Math.sqrt, String, clamp01, hsvToHex, liveSender.trigger, setUi, wheelWrap.getBoundingClientRect |
| [`endWheel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6711) | ev | commitColor, ev.preventDefault, updateFromWheelEvent |
| [`updateHint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6777) | – | – |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6801) | value | nwReloadDevices, nwSetColor |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6819) | value | nwReloadDevices, nwSetColor |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6837) | value | nwReloadDevices, nwSetColor |
| [`nwCreateBlindPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6881) | dev, canWrite | Math.round, Number.isFinite, String, activeProtection.join, activeProtection.push, controls.appendChild, document.createElement, liveBtn.addEventListener, liveBtn.setAttribute, mk, nwClampNumber, nwCreateLivePreviewSender, nwCreateSmartHomeRangeControl, nwCreateStatusBadge (weitere in der Quelle) |
| [`clearStatusTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6948) | – | clearTimeout |
| [`flashStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6960) | kind, text, ms | clearStatusTimer, nwSetStatusBadge, setTimeout |
| [`setBusy`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6976) | – | flashStatus |
| [`setOk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6983) | – | flashStatus |
| [`setErr`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6990) | – | flashStatus |
| [`commitPos`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7034) | nextVal, opts | Math.round, String, dial.nwSetValue, nwClampNumber, nwReloadDevices, nwSetLevel, nwUpdateRangeFill, setBusy, setErr, setOk |
| [`formatter`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7067) | val | Math.round |
| [`minmaxFormatter`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7068) | val | Math.round |
| [`onInput`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7070) | val | Math.round, String, liveSender.trigger, nwUpdateRangeFill |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7076) | val | commitPos |
| [`updateHint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7132) | – | – |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7172) | value | nwCoverAction, nwReloadDevices |
| [`mk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7195) | label, action | b.addEventListener, b.setAttribute, document.createElement |
| [`nwGetRtrRange`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7236) | dev | – |
| [`nwCreateRtrPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7248) | dev, canWrite | Math.round, String, actions.appendChild, appendRawCommand, button.addEventListener, buttons.appendChild, controls.appendChild, document.createElement, nwCreateSmartHomeRangeControl, nwCreateStatusBadge, nwFormatNumberDE, nwGetRtrRange, off.addEventListener, on.addEventListener (weitere in der Quelle) |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7301) | value | nwReloadDevices, nwSetRtrSetpoint |
| [`setStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7310) | kind, text | nwSetStatusBadge |
| [`sendAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7314) | action, value | nwClimateAction, nwReloadDevices, setStatus |
| [`appendRawCommand`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7353) | labelText, action, dpId, currentValue, disabledBySafety | String, actions.appendChild, controls.appendChild, document.createElement, row.appendChild, send.addEventListener |
| [`nwCreateValueGauge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7451) | opts | Array.isArray, Math.cos, Math.random, Math.sin, Number, Number.isFinite, String, active.classList.add, active.setAttribute, base.classList.add, base.setAttribute, canvas.appendChild, center.appendChild, defs.appendChild (weitere in der Quelle) |
| [`setValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7608) | v, silent, markKnown | Math.cos, Math.sin, active.setAttribute, formatter, knob.setAttribute, nwClampNumber, nwRoundToStep, onInput, wrap.classList.toggle, x.toFixed, y.toFixed |
| [`commit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7629) | – | onCommit |
| [`stop`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7648) | ev | ev.stopPropagation |
| [`pickFromClient`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7668) | clientX, clientY | Math.atan2, setValue, svg.getBoundingClientRect |
| [`onMouseDown`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7694) | ev | document.addEventListener, ev.preventDefault, ev.stopPropagation, pickFromClient |
| [`move`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7706) | e | pickFromClient |
| [`up`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7719) | – | commit, document.removeEventListener |
| [`onTouchStart`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7743) | ev | document.addEventListener, ev.preventDefault, ev.stopPropagation, pickFromClient |
| [`move`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7762) | e | pickFromClient |
| [`end`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7772) | – | commit, document.removeEventListener |
| [`nwCreateThermostatGauge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7801) | opts | Math.cos, Math.max, Math.min, Math.random, Math.round, Math.sin, Number, Number.isFinite, String, active.classList.add, active.setAttribute, base.classList.add, base.setAttribute, canvas.appendChild (weitere in der Quelle) |
| [`mkStop`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7858) | off, col | document.createElementNS, s.setAttribute |
| [`setValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7991) | v | Math.cos, Math.sin, active.setAttribute, knob.setAttribute, nwClampNumber, nwFormatNumberDE, nwRoundToStep, x.toFixed, y.toFixed |
| [`commit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8024) | – | onCommit |
| [`stop`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8043) | ev | ev.stopPropagation |
| [`pickFromClient`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8067) | clientX, clientY | Math.atan2, setValue, svg.getBoundingClientRect |
| [`onMouseDown`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8097) | ev | document.addEventListener, ev.preventDefault, ev.stopPropagation, pickFromClient |
| [`move`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8117) | e | pickFromClient |
| [`up`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8124) | – | commit, document.removeEventListener |
| [`onTouchStart`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8149) | ev | document.addEventListener, ev.preventDefault, ev.stopPropagation, pickFromClient |
| [`move`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8171) | e | pickFromClient |
| [`end`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8181) | – | commit, document.removeEventListener |
| [`nwCreateValuePopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8209) | dev, canWrite | Number, Number.isFinite, String, actions.appendChild, document.createElement, nwCreateStatusBadge, row.appendChild, send.addEventListener, wrap.appendChild |
| [`nwCreatePlayerPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8300) | dev, canWrite | Array.isArray, Math.max, Math.round, Number, Number.isFinite, String, appendBooleanCommand, appendRawOrBooleanCommand, controls.appendChild, document.createElement, favBtn.addEventListener, filters.appendChild, head.appendChild, lib.appendChild (weitere in der Quelle) |
| [`renderZones`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8398) | – | allIds.every, nwClear, nwGetSelectedAudioZones, partyBtn.classList.toggle, soloBtn.classList.toggle, zones.forEach, zones.map |
| [`setStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8448) | kind, text | nwSetStatusBadge |
| [`runPlayerAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8449) | action, value, refreshDelay | nwPlayerActionMulti, nwRefreshDevicesSoon, setStatus |
| [`mkBtn`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8466) | label, text, action, enabled, extraClass | b.addEventListener, b.setAttribute, document.createElement |
| [`appendBooleanCommand`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8506) | labelText, action, stateValue, readId, writeId, onText, offText | actions.appendChild, document.createElement, explicitToggles.appendChild, off.addEventListener, on.addEventListener, row.appendChild |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8605) | value | runPlayerAction |
| [`appendRawOrBooleanCommand`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8609) | labelText, action, stateValue, dpId | String, actions.appendChild, button.addEventListener, document.createElement, row.appendChild, send.addEventListener, wrap.appendChild |
| [`mkTab`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8733) | kind, label | b.addEventListener, document.createElement |
| [`getItems`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8810) | – | – |
| [`renderRecent`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8834) | – | document.createElement, nwClear, nwLoadPlayerRecent, recent.slice, recentWrap.appendChild |
| [`renderList`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8883) | – | String, document.createElement, getItems, items.forEach, list.appendChild, nwClear, nwLoadPlayerFavs, shown.forEach |
| [`matchesQuery`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8905) | it | String |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9021) | – | favBtn.classList.toggle, renderList, renderRecent, tabPlaylists.classList.toggle, tabStations.classList.toggle |
| [`nwCreateHalfDial`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9043) | opts | Number, Number.isFinite, active.setAttribute, base.setAttribute, document.createElement, document.createElementNS, knob.setAttribute, nwClampNumber, nwFormatNumberDE, nwRoundToStep, setValue, svg.addEventListener, svg.appendChild, svg.setAttribute (weitere in der Quelle) |
| [`setValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9121) | v | Math.cos, Math.sin, active.setAttribute, knob.setAttribute, nwClampNumber, nwFormatNumberDE, nwRoundToStep, x.toFixed, y.toFixed |
| [`posToValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9151) | ev | Math.atan2, Math.max, Math.min, Number.isFinite, svg.getBoundingClientRect |
| [`onDown`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9184) | ev | ev.preventDefault, ev.stopPropagation, posToValue, setValue, svg.setPointerCapture |
| [`onMove`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9205) | ev | ev.preventDefault, ev.stopPropagation, posToValue, setValue |
| [`onUp`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9225) | ev | ev.preventDefault, ev.stopPropagation, onCommit, posToValue, setValue, svg.releasePointerCapture |
| [`nwRenderRooms`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9266) | devices | Array.from, document.getElementById, floorKeys.forEach, floorKeys.sort, floorMap.keys, nwClear, nwGroupByRoom, roomGroups.forEach |
| [`renderRoomSection`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9312) | g | String, arr.forEach, arr.sort, document.createElement, header.appendChild, nwComputeRoomSummary, nwGroupDevicesByType, nwStaticIconHtml, section.appendChild, title.querySelector, typeGroups.forEach |
| [`nwComputeFunctionSummary`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9427) | funcName, funcDevices | Array.isArray, String, devs.forEach |
| [`nwRenderFunctions`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9449) | devices | document.getElementById, groups.forEach, nwClear, nwGroupByFunction |
| [`nwFindFloorPageId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9522) | floorId | Array.isArray, nwNormalizeId, pages.find, pages.some |
| [`nwFindRoomPageId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9538) | roomId | Array.isArray, nwNormalizeId, pages.find, pages.some |
| [`nwRenderHome`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9552) | devices | Array.isArray, all.filter, all.some, arr.forEach, cfg.floors.slice, cfg.rooms.slice, devices.slice, document.createElement, document.getElementById, favSec.appendChild, favs.slice, floorSec.appendChild, floorTiles.forEach, floorTiles.push (weitere in der Quelle) |
| [`sortByOrderName`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9626) | a, b | Number.isFinite, String |
| [`go`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9746) | – | nwActivatePage, nwFindFloorPageId |
| [`nwNormalizeId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9783) | s | String |
| [`nwBuildMetaFromConfig`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9792) | cfg | Array.isArray, floors.forEach, funcs.forEach, rooms.forEach |
| [`nwBuildDefaultPagesFromConfig`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9834) | cfg | Array.isArray, nwNormalizeId, pages.push, roomsByFloor.get, roomsByFloor.has, roomsByFloor.set, roomsSorted.forEach, roomsSorted.map, sortedFloors.forEach, unassignedRooms.push |
| [`nwIsHomePage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10019) | page | String |
| [`nwIsLegacyFlatRoomPages`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10033) | pages, cfg | Array.isArray, arr.filter, arr.some, nwNormalizeId, roomIdSet.has, rooms.map, rooms.some, usedRoomIds.add, usedRoomIds.has |
| [`nwGetPagesFromConfig`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10076) | cfg | Array.isArray, nwBuildDefaultPagesFromConfig, nwIsLegacyFlatRoomPages |
| [`nwSetSidebarOpen`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10115) | open | String, document.getElementById, sidebar.classList.toggle, toggle.setAttribute |
| [`nwInitSidebarUi`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10132) | – | btn.addEventListener, document.addEventListener, document.getElementById, overlay.addEventListener, window.addEventListener |
| [`nwUpdatePageTitle`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10173) | – | Array.isArray, String, byId.get, chain.unshift, document.getElementById, pages.find, pages.map |
| [`nwCloseSidebar`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10226) | – | nwSetSidebarOpen |
| [`nwLoadExpandedIdsFromLs`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10235) | – | Array.isArray, JSON.parse, arr.filter, localStorage.getItem, nwBuildPageTree, nwSaveExpandedIdsToLs, rootWithChildren.map, rootWithChildren.some, roots.filter |
| [`nwSaveExpandedIdsToLs`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10277) | – | Array.from, JSON.stringify, localStorage.setItem |
| [`nwEnsureAncestorsExpanded`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10290) | pageId | byId.get, nwPageState.expandedIds.add, nwSaveExpandedIdsToLs |
| [`nwToggleNavExpanded`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10310) | pageId | nwLoadExpandedIdsFromLs, nwPageState.expandedIds.add, nwPageState.expandedIds.delete, nwPageState.expandedIds.has, nwRenderSidebarNav, nwSaveExpandedIdsToLs |
| [`nwResolvePageFilters`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10324) | page | Array.isArray, byId.get, chain.unshift, p.funcIds.slice, p.roomIds.slice, p.types.slice |
| [`nwIsFloorPage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10355) | page | id.startsWith |
| [`nwGetFloorIdFromPage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10365) | page | id.slice, id.startsWith |
| [`nwFilterDevicesForPage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10377) | allDevices, page | Array.isArray, allDevices.slice, eff.funcIds.map, eff.roomIds.map, eff.types.map, nwGetFloorIdFromPage, nwIsFloorPage, nwResolvePageFilters, out.filter |
| [`nwGetDevicesForPage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10422) | page | nwFilterDevicesForPage |
| [`nwUpdatePageCounts`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10431) | – | nwGetDevicesForPage |
| [`nwBuildPageTree`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10445) | pages | arr.sort, byId.has, children.entries, children.get, children.has, children.set, roots.push, roots.sort |
| [`sortFn`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10472) | a, b | String |
| [`nwRenderSidebarNav`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10484) | – | document.getElementById, nwBuildPageTree, nwLoadExpandedIdsFromLs, nwUpdatePageCounts, renderList |
| [`renderList`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10509) | list, depth | Math.max, String, btn.addEventListener, btn.appendChild, caret.addEventListener, children.get, children.has, document.createElement, el.appendChild, nwIsHomePage, nwPageState.expandedIds.has, nwStaticIconHtml, renderList |
| [`nwActivatePage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10594) | pageId | Array.isArray, eff.funcIds.slice, eff.roomIds.slice, eff.types.slice, localStorage.setItem, nwApplyFiltersAndRender, nwEnsureAncestorsExpanded, nwNormalizeId, nwPageState.pages.find, nwRenderSidebarNav, nwResolvePageFilters, nwUpdatePageTitle |
| [`nwLoadSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10639) | – | Array.isArray, eff0.funcIds.slice, eff0.roomIds.slice, eff0.types.slice, fetch, localStorage.getItem, nwBuildMetaFromConfig, nwEnsureAncestorsExpanded, nwGetPagesFromConfig, nwInitSidebarUi, nwPageState.pages.find, nwPageState.pages.some, nwRenderSidebarNav, nwResolvePageFilters (weitere in der Quelle) |
| [`nwGetDeviceRoomId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10696) | dev | nwNormalizeId |
| [`nwGetDeviceFloorId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10708) | dev | nwGetDeviceRoomId, nwNormalizeId |
| [`nwGetDeviceFuncId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10723) | dev | nwNormalizeId |
| [`nwApplyPageFilters`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10735) | devices | Array.isArray, devices.slice, nwGetFloorIdFromPage, nwIsFloorPage, out.filter, p.funcIds.map, p.roomIds.map, p.types.map |
| [`nwApplyFiltersAndRender`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10771) | – | document.getElementById, nwApplyFilters, nwApplyPageFilters, nwClear, nwIsHomePage, nwReleaseUnusedCustomTiles, nwRenderFunctionChips, nwRenderFunctions, nwRenderHome, nwRenderRooms, nwRenderTextSizeChips, nwRenderViewChips, nwShowEmptyState |
| [`nwDeviceRenderSignature`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10823) | devices | JSON.stringify, devices.map |
| [`withoutAge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10824) | value | Array.isArray |
| [`nwReloadDevices`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10848) | opts | Array.isArray, String, console.error, document.getElementById, nwApplyFiltersAndRender, nwCaptureDeviceFocus, nwDeviceRenderSignature, nwFetchDevices, nwRenderSidebarNav, nwRestoreDeviceFocus, nwShowEmptyState, nwSyncOpenPopoverFeedback, window.NW_SH_CUSTOM_VIEWS?.isInteracting, window.NW_SH_DEVICE_CONTROLS?.isInteracting (weitere in der Quelle) |
| [`nwRefreshDevicesSoon`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10886) | delayMs | Math.max, Number, clearTimeout, setTimeout |
| [`nwStartAutoRefresh`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10905) | intervalMs | setInterval |
| [`nwStopAutoRefresh`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10919) | – | clearInterval |
| [`nwInitMenu`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10930) | – | document.addEventListener, document.getElementById, menu.addEventListener, menuBtn.addEventListener |
| [`close`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10951) | – | menu.classList.add |
| [`toggle`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10958) | – | menu.classList.toggle |
| [`nwLoadUiConfigFlags`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10975) | – | Array.isArray, Math.max, Math.round, Number, document.getElementById, fetch, l.classList.toggle, sc.evcsList.filter, sfMenu.classList.toggle, sfTab.classList.toggle, sl.classList.toggle, t.classList.toggle |
| [`nwBootstrap`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11009) | – | document.addEventListener, document.getElementById, localStorage.removeItem, nwApplyTextSizeClass, nwInitMenu, nwLoadBoolLS, nwLoadFavoriteOverrides, nwLoadSmartHomeConfig, nwLoadTextSize, nwLoadUiConfigFlags, nwLoadViewMode, nwReloadDevices, nwStartAutoRefresh, viewsEl.classList.remove (weitere in der Quelle) |
