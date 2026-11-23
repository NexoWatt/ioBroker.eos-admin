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
| [`nwGetQualityStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2645) | dev | String |
| [`nwGetQualityLabel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2651) | dev | nwGetQualityStatus |
| [`nwGetDeviceIndicators`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2668) | dev | Number.isFinite, String, error.trim, items.push, nwFormatNumberDE |
| [`nwCreateDeviceIndicators`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2689) | dev | document.createElement, nwGetDeviceIndicators |
| [`nwHasPrimaryState`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2701) | dev | String, nwGetQualityStatus |
| [`nwIsMomentaryDevice`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2714) | dev | String |
| [`nwIsOn`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2725) | dev | String, nwHasPrimaryState |
| [`nwSupportsTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2765) | dev | String |
| [`nwGetStateText`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2779) | dev | Math.round, String, nwClampNumber, nwGetQualityLabel, nwGetQualityStatus, nwHasPrimaryState, nwIsMomentaryDevice, nwNormalizeTemperatureUnit, st.climateError.trim, st.currentTemp.toFixed, st.setpoint.toFixed, st.value.toFixed |
| [`nwGetTileHint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2866) | dev | String, nwHasWriteAccess |
| [`nwFormatBigValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2887) | dev | Number.isNaN, String, formatUnit, st.currentTemp.toFixed, st.setpoint.toFixed, st.value.toFixed |
| [`formatUnit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2897) | unit | nwNormalizeTemperatureUnit |
| [`nwGetTileSize`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2954) | dev | – |
| [`nwHasWriteAccess`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L2966) | dev | String |
| [`nwCreateIconElement`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3009) | dev, isOn, iconSpec, accent | String, document.createElement, name.startsWith, nwDynamicDeviceIconSvg, wrap.appendChild, wrap.classList.add |
| [`nwSmartHomePost`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3065) | endpoint, payload, deviceId | JSON.stringify, String, clearTimeout, fetch, response.json, setTimeout, window.NW_SH_FEEDBACK.post |
| [`nwBindSmartHomeControls`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3082) | root, deviceId | String, root.querySelectorAll, window.NW_SH_FEEDBACK?.attachStatus |
| [`nwFetchDevices`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3094) | – | Array.isArray, fetch, res.json |
| [`nwToggleDevice`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3107) | id, value | nwSmartHomePost |
| [`nwSetLevel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3119) | id, level | nwSmartHomePost |
| [`nwSetColor`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3129) | id, colorOrPayload | Array.isArray, nwSmartHomePost |
| [`nwCoverAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3140) | id, action, value | nwSmartHomePost |
| [`nwPlayerAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3151) | id, action, value | nwSmartHomePost |
| [`nwPlayerActionMulti`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3165) | primaryId, action, value | Array.from, nwGetSelectedAudioZones, nwPlayerAction |
| [`nwSetRtrSetpoint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3184) | id, setpoint | nwSmartHomePost |
| [`nwClimateAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3190) | id, action, value | nwSmartHomePost |
| [`nwSetSmartHomeValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3197) | id, value | nwSmartHomePost |
| [`nwSaveDeviceTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3209) | deviceId, timer | nwSmartHomePost |
| [`nwDeleteDeviceTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3219) | deviceId | nwSmartHomePost |
| [`nwAdjustRtrSetpoint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3229) | dev, delta | nwReloadDevices, nwSetRtrSetpoint |
| [`nwClear`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3252) | el | el.removeChild |
| [`nwSortBy`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3262) | a, b | String |
| [`nwGetDeviceOrder`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3275) | dev | Number.isFinite |
| [`nwTypeLabel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3322) | type | String, t.charAt, t.slice |
| [`nwCompareDevices`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3333) | a, b | nwGetDeviceOrder, nwIsFavorite, nwSortBy, nwTypeLabel |
| [`nwGroupDevicesByType`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3365) | devices | Array.from, groups.sort, map.entries |
| [`nwFormatNumberDE`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3388) | value, precision | Number, Number.isFinite, v.toFixed |
| [`nwComputeRoomSummary`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3400) | roomId, allDevices | Array.isArray, Math.round, Number, Number.isFinite, String, allDevices.filter, devs.forEach, nwFormatNumberDE, nwNormalizeId, parts.join, parts.push, pick |
| [`pick`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3457) | arr | arr.sort |
| [`nwApplyFilters`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3484) | devices | Array.isArray, devices.slice, out.filter |
| [`nwGetAllFunctions`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3507) | devices | Array.from |
| [`nwGuessIconForFunctionLabel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3521) | label | String, s.includes |
| [`nwRenderViewChips`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3539) | – | document.getElementById, mkChip, nwClear |
| [`mkChip`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3549) | label, active, onClick | btn.addEventListener, document.createElement, wrap.appendChild |
| [`nwRenderTextSizeChips`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3578) | – | document.getElementById, mkChip, nwClear, nwNormTextSize |
| [`mkChip`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3588) | label, active, onClick | btn.addEventListener, document.createElement, wrap.appendChild |
| [`nwRenderFunctionChips`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3628) | devices | allFns.forEach, document.getElementById, mkChip, nwClear, nwGetAllFunctions |
| [`mkChip`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3650) | label, active, onClick, extraClass, disabled, title, iconName | btn.addEventListener, btn.querySelector, document.createElement, nwGetIconSvg, wrap.appendChild |
| [`nwGroupByRoom`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3713) | devices | Array.from, keys.map, keys.sort, map.keys |
| [`nwGroupByFunction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3784) | devices | Array.from, fns.map, map.keys |
| [`nwShowEmptyState`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3801) | show, ctx | document.getElementById, empty.classList.remove |
| [`nwEnsureShToast`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3851) | – | document.body.appendChild, document.createElement, el.setAttribute |
| [`nwHideShToast`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3866) | – | clearTimeout, nwShToastEl.classList.remove |
| [`nwShowShToastForTile`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3880) | dev | String, clearTimeout, document.createElement, nwClear, nwEnsureShToast, nwGetStateText, parts.join, parts.push, setTimeout, toast.appendChild, toast.classList.add |
| [`nwCreateTile`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3918) | dev, opts | Date.now, Math.max, Math.min, Math.round, Number.isFinite, String, actions.appendChild, addMiniBtn, addMiniToggle, arc.appendChild, big.appendChild, btn.addEventListener, btnMinus.addEventListener, btnPlus.addEventListener (weitere in der Quelle) |
| [`stop`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4242) | ev | ev.stopPropagation |
| [`stop`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4359) | ev | ev.stopPropagation |
| [`addMiniToggle`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4397) | – | document.createElement, footer.appendChild, t.addEventListener, t.setAttribute |
| [`addMiniBtn`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4435) | label, title, onClick | b.addEventListener, b.setAttribute, document.createElement, footer.appendChild |
| [`mk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4517) | label, action, mapped, allowed | b.addEventListener, b.setAttribute, document.createElement |
| [`lpCancel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4568) | – | clearTimeout |
| [`nwCaptureDeviceFocus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4700) | element | element.closest |
| [`nwRestoreDeviceFocus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4710) | saved | Array.from, document.getElementById, document.querySelectorAll, target.focus, tile.querySelector, tile.querySelectorAll |
| [`nwPopoverFocusableElements`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4727) | – | Array.from, nwPopoverEl.querySelectorAll |
| [`nwActivatePopoverSurface`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4740) | anchorEl | Array.from, nwCaptureDeviceFocus, nwLockBodyScroll, nwPopoverBackdropEl.classList.remove, nwPopoverEl.classList.remove, requestAnimationFrame |
| [`nwSyncOpenPopoverFeedback`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4767) | devices | JSON.stringify, String, devices.find, indicators.replaceWith, nwClosePopover, nwCreateDeviceIndicators, nwGetQualityStatus, nwGetStateText, nwPopoverEl.querySelector |
| [`nwLockBodyScroll`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4801) | – | Math.max, document.body.classList.add |
| [`nwUnlockBodyScroll`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4829) | – | document.body.classList.remove, window.scrollTo |
| [`nwEnsurePopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4855) | – | document.addEventListener, document.body.appendChild, document.createElement, nwPopoverBackdropEl.addEventListener, nwPopoverEl.addEventListener, nwPopoverEl.setAttribute, window.addEventListener |
| [`close`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4889) | – | nwClosePopover |
| [`nwClosePopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4944) | – | nwPopoverBackdropEl.classList.add, nwPopoverBackground.forEach, nwPopoverEl.classList.add, nwRestoreDeviceFocus, nwUnlockBodyScroll, window.NW_SH_TOUCH?.cancel |
| [`nwOpenDevicePopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4969) | dev, anchorEl | nwActivatePopoverSurface, nwBindSmartHomeControls, nwBuildPopoverContent, nwClosePopover, nwEnsurePopover, nwGetQualityStatus, nwPopoverEl.classList.contains |
| [`nwOpenTimerPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4999) | dev, anchorEl | nwActivatePopoverSurface, nwBindSmartHomeControls, nwBuildTimerPopoverContent, nwClosePopover, nwEnsurePopover, nwPopoverEl.classList.contains |
| [`nwBuildTimerPopoverContent`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5024) | dev | Array.isArray, Math.max, Math.min, Math.round, Number.isNaN, String, b.addEventListener, body.appendChild, btn.addEventListener, closeBtn.addEventListener, closeBtn.setAttribute, delBtn.addEventListener, document.createElement, footer.appendChild (weitere in der Quelle) |
| [`fmtNext`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5096) | – | Date.now, Number, Number.isFinite, String, d.getHours, d.getMinutes |
| [`updateHeaderState`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5122) | – | fmtNext |
| [`rebuildDays`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5184) | – | Array.from, days.sort |
| [`mkTime`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5226) | lbl, val, onChange | document.createElement, inp.addEventListener, wrap.appendChild |
| [`nwPositionPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5341) | anchorEl | Math.max, Math.min, Math.round, nwPopoverEl.classList.contains |
| [`nwClampNumber`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5369) | v, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`nwRoundToStep`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5380) | v, step | Math.round, Number, Number.isFinite |
| [`nwUpdateRangeFill`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5396) | rangeEl | Math.max, Math.min, Number, Number.isFinite, clamped.toFixed, rangeEl.style.setProperty |
| [`nwLoadJsonLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5432) | key, defVal | JSON.parse, localStorage.getItem |
| [`nwSaveJsonLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5449) | key, obj | JSON.stringify, localStorage.setItem |
| [`nwLoadFavoriteOverrides`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5460) | – | Object.keys, nwLoadJsonLS |
| [`nwSaveFavoriteOverrides`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5478) | map | nwSaveJsonLS |
| [`nwGetInstallerFavorite`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5487) | dev | – |
| [`nwIsFavorite`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5496) | dev | Object.prototype.hasOwnProperty.call, String, nwGetInstallerFavorite |
| [`nwToggleFavorite`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5511) | dev | Object.prototype.hasOwnProperty.call, String, nwGetInstallerFavorite, nwIsFavorite, nwSaveFavoriteOverrides |
| [`nwLoadNumberLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5533) | key, defVal | Number, Number.isFinite, localStorage.getItem |
| [`nwSaveNumberLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5549) | key, val | String, localStorage.setItem |
| [`nwCreateStatusBadge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5560) | – | document.createElement, el.setAttribute |
| [`nwSetStatusBadge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5573) | el, kind, text | el.classList.add, el.classList.remove |
| [`nwLoadBoolLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5592) | key, defVal | localStorage.getItem |
| [`nwSaveBoolLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5609) | key, val | localStorage.setItem |
| [`nwLoadViewMode`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5620) | defMode | String, localStorage.getItem |
| [`nwSaveViewMode`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5634) | mode | localStorage.setItem |
| [`nwNormTextSize`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5645) | v | String |
| [`nwLoadTextSize`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5658) | defSize | localStorage.getItem, nwNormTextSize |
| [`nwSaveTextSize`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5671) | size | localStorage.setItem, nwNormTextSize |
| [`nwApplyTextSizeClass`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5682) | size | document.getElementById, nwNormTextSize, root.classList.add, root.classList.remove |
| [`nwCreateLivePreviewSender`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5701) | sendFn, intervalMs | – |
| [`schedule`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5714) | – | Date.now, Math.max, clearTimeout, setTimeout |
| [`trigger`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5762) | val, force | schedule |
| [`nwCreateSmartHomeRangeControl`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5774) | options | Math.max, Math.min, Number, Number.isFinite, String, document.createElement, format, header.appendChild, nwClampNumber, nwCreateStatusBadge, nwUpdateRangeFill, right.appendChild, slider.addEventListener, slider.setAttribute (weitere in der Quelle) |
| [`nwBuildPopoverContent`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5857) | dev | String, body.appendChild, close.addEventListener, close.setAttribute, document.createElement, hdr.appendChild, left.appendChild, nwCreateBlindPopover, nwCreateColorPopover, nwCreateDeviceIndicators, nwCreateIconElement, nwCreateLevelPopover, nwCreatePlayerPopover, nwCreateRtrPopover (weitere in der Quelle) |
| [`nwCreateLevelPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5951) | dev, canWrite, opts | Math.round, Number.isFinite, String, btnRow.appendChild, document.createElement, liveBtn.addEventListener, liveBtn.setAttribute, minus.addEventListener, nwClampNumber, nwCreateLivePreviewSender, nwCreateSmartHomeRangeControl, nwCreateStatusBadge, nwCreateValueGauge, nwHasPrimaryState (weitere in der Quelle) |
| [`clearStatusTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5997) | – | clearTimeout |
| [`flashStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6009) | kind, text, ms | clearStatusTimer, nwSetStatusBadge, setTimeout |
| [`setBusy`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6025) | – | flashStatus |
| [`setOk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6032) | – | flashStatus |
| [`setErr`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6039) | – | flashStatus |
| [`commitLevel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6085) | nextVal, opts | Math.round, String, dial.nwSetValue, nwClampNumber, nwReloadDevices, nwSetLevel, nwUpdateRangeFill, setBusy, setErr, setOk |
| [`formatter`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6118) | val | Math.round |
| [`minmaxFormatter`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6119) | val | Math.round |
| [`onInput`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6120) | val | Math.round, String, liveSender.trigger, nwUpdateRangeFill |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6126) | val | commitLevel |
| [`syncStepBtns`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6196) | – | stepChoices.forEach |
| [`updateHint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6274) | – | – |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6303) | value | nwReloadDevices, nwSetColor |
| [`nwCreateColorPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6346) | dev, canWrite | Math.round, String, btnRow.appendChild, clamp01, current.toUpperCase, document.createElement, liveBtn.addEventListener, liveBtn.setAttribute, normHex, nwCreateLivePreviewSender, nwCreateSmartHomeRangeControl, nwCreateStatusBadge, nwHasPrimaryState, nwIsOn (weitere in der Quelle) |
| [`normHex`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6366) | val | String, s.slice, s.startsWith, s.toLowerCase |
| [`clamp01`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6392) | n | Math.max, Math.min, Number |
| [`clamp`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6399) | n, lo, hi | Math.max, Math.min, Number |
| [`hexToRgb`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6406) | hex | h.slice, normHex, parseInt, s.slice |
| [`rgbToHex`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6421) | r, g, b | Math.round, clamp |
| [`rgbToHsv`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6433) | r, g, b | Math.max, Math.min, clamp01 |
| [`hsvToRgb`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6458) | h, s, v | Math.abs, Math.round, Number, clamp01 |
| [`setHsvFromHex`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6486) | hex | hexToRgb, rgbToHsv |
| [`clearStatusTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6534) | – | clearTimeout |
| [`flashStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6546) | kind, text, ms | clearStatusTimer, nwSetStatusBadge, setTimeout |
| [`setBusy`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6562) | – | flashStatus |
| [`setOk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6569) | – | flashStatus |
| [`setErr`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6576) | – | flashStatus |
| [`hsvToHex`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6629) | h, s, vVal | hsvToRgb, rgbToHex |
| [`updateValueSliderGradient`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6639) | – | hsvToHex, valueSlider.style.setProperty |
| [`updateWheelMarker`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6650) | – | Math.cos, Math.sin, clamp01 |
| [`setUi`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6668) | hex | Math.round, String, clamp01, h.toUpperCase, normHex, setHsvFromHex, updateValueSliderGradient, updateWheelMarker |
| [`drawWheel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6684) | – | Math.atan2, Math.max, Math.min, Math.round, Math.sqrt, ctx.clearRect, ctx.createImageData, ctx.putImageData, ctx.setTransform, hsvToRgb, wheelCanvas.getContext |
| [`commitColor`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6741) | hex, opts | normHex, nwReloadDevices, nwSetColor, setBusy, setErr, setOk, setUi |
| [`updateFromWheelEvent`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6773) | ev, opts | Math.atan2, Math.sqrt, String, clamp01, hsvToHex, liveSender.trigger, setUi, wheelWrap.getBoundingClientRect |
| [`endWheel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6819) | ev | commitColor, ev.preventDefault, updateFromWheelEvent |
| [`updateHint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6885) | – | – |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6911) | value | nwReloadDevices, nwSetColor |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6929) | value | nwReloadDevices, nwSetColor |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6947) | value | nwReloadDevices, nwSetColor |
| [`nwCreateBlindPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6991) | dev, canWrite | Math.round, Number.isFinite, String, activeProtection.join, activeProtection.push, controls.appendChild, document.createElement, liveBtn.addEventListener, liveBtn.setAttribute, minus.addEventListener, mk, nwClampNumber, nwCreateLivePreviewSender, nwCreateSmartHomeRangeControl (weitere in der Quelle) |
| [`clearStatusTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7058) | – | clearTimeout |
| [`flashStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7070) | kind, text, ms | clearStatusTimer, nwSetStatusBadge, setTimeout |
| [`setBusy`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7086) | – | flashStatus |
| [`setOk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7093) | – | flashStatus |
| [`setErr`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7100) | – | flashStatus |
| [`commitPos`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7144) | nextVal, opts | Math.round, String, dial.nwSetValue, nwClampNumber, nwReloadDevices, nwSetLevel, nwUpdateRangeFill, setBusy, setErr, setOk |
| [`formatter`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7177) | val | Math.round |
| [`minmaxFormatter`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7178) | val | Math.round |
| [`onInput`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7180) | val | Math.round, String, liveSender.trigger, nwUpdateRangeFill |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7186) | val | commitPos |
| [`syncStepBtns`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7256) | – | stepChoices.forEach |
| [`updateHint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7334) | – | – |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7376) | value | nwCoverAction, nwReloadDevices |
| [`mk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7399) | label, action | b.addEventListener, document.createElement |
| [`nwGetRtrRange`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7440) | dev | – |
| [`nwCreateRtrPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7452) | dev, canWrite | Math.round, String, actions.appendChild, appendRawCommand, button.addEventListener, buttons.appendChild, controls.appendChild, document.createElement, nwCreateSmartHomeRangeControl, nwCreateStatusBadge, nwFormatNumberDE, nwGetRtrRange, off.addEventListener, on.addEventListener (weitere in der Quelle) |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7505) | value | nwReloadDevices, nwSetRtrSetpoint |
| [`setStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7514) | kind, text | nwSetStatusBadge |
| [`sendAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7518) | action, value | nwClimateAction, nwReloadDevices, setStatus |
| [`appendRawCommand`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7557) | labelText, action, dpId, currentValue, disabledBySafety | String, actions.appendChild, controls.appendChild, document.createElement, row.appendChild, send.addEventListener |
| [`nwCreateValueGauge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7655) | opts | Array.isArray, Math.cos, Math.random, Math.sin, Number, Number.isFinite, String, active.classList.add, active.setAttribute, base.classList.add, base.setAttribute, btnMinus.addEventListener, btnPlus.addEventListener, btnRow.appendChild (weitere in der Quelle) |
| [`setValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7812) | v, silent, markKnown | Math.cos, Math.sin, active.setAttribute, formatter, knob.setAttribute, nwClampNumber, nwRoundToStep, onInput, wrap.classList.toggle, x.toFixed, y.toFixed |
| [`commit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7833) | – | onCommit |
| [`stop`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7852) | ev | ev.stopPropagation |
| [`pickFromClient`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7891) | clientX, clientY | Math.atan2, setValue, svg.getBoundingClientRect |
| [`onMouseDown`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7917) | ev | document.addEventListener, ev.preventDefault, ev.stopPropagation, pickFromClient |
| [`move`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7929) | e | pickFromClient |
| [`up`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7942) | – | commit, document.removeEventListener |
| [`onTouchStart`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7966) | ev | document.addEventListener, ev.preventDefault, ev.stopPropagation, pickFromClient |
| [`move`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7985) | e | pickFromClient |
| [`end`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7995) | – | commit, document.removeEventListener |
| [`nwCreateThermostatGauge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8024) | opts | Math.cos, Math.max, Math.min, Math.random, Math.round, Math.sin, Number, Number.isFinite, String, active.classList.add, active.setAttribute, base.classList.add, base.setAttribute, btnMinus.addEventListener (weitere in der Quelle) |
| [`mkStop`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8081) | off, col | document.createElementNS, s.setAttribute |
| [`setValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8215) | v | Math.cos, Math.sin, active.setAttribute, knob.setAttribute, nwClampNumber, nwFormatNumberDE, nwRoundToStep, x.toFixed, y.toFixed |
| [`commit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8248) | – | onCommit |
| [`stop`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8267) | ev | ev.stopPropagation |
| [`pickFromClient`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8310) | clientX, clientY | Math.atan2, setValue, svg.getBoundingClientRect |
| [`onMouseDown`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8340) | ev | document.addEventListener, ev.preventDefault, ev.stopPropagation, pickFromClient |
| [`move`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8360) | e | pickFromClient |
| [`up`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8367) | – | commit, document.removeEventListener |
| [`onTouchStart`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8392) | ev | document.addEventListener, ev.preventDefault, ev.stopPropagation, pickFromClient |
| [`move`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8414) | e | pickFromClient |
| [`end`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8424) | – | commit, document.removeEventListener |
| [`nwCreateValuePopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8452) | dev, canWrite | Number, Number.isFinite, String, actions.appendChild, document.createElement, nwCreateStatusBadge, row.appendChild, send.addEventListener, wrap.appendChild |
| [`nwCreatePlayerPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8543) | dev, canWrite | Array.isArray, Math.max, Math.round, Number, Number.isFinite, String, appendBooleanCommand, appendRawOrBooleanCommand, controls.appendChild, document.createElement, favBtn.addEventListener, filters.appendChild, head.appendChild, lib.appendChild (weitere in der Quelle) |
| [`renderZones`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8641) | – | allIds.every, nwClear, nwGetSelectedAudioZones, partyBtn.classList.toggle, soloBtn.classList.toggle, zones.forEach, zones.map |
| [`setStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8691) | kind, text | nwSetStatusBadge |
| [`runPlayerAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8692) | action, value, refreshDelay | nwPlayerActionMulti, nwRefreshDevicesSoon, setStatus |
| [`mkBtn`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8709) | label, text, action, enabled, extraClass | b.addEventListener, b.setAttribute, document.createElement |
| [`appendBooleanCommand`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8749) | labelText, action, stateValue, readId, writeId, onText, offText | actions.appendChild, document.createElement, explicitToggles.appendChild, off.addEventListener, on.addEventListener, row.appendChild |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8848) | value | runPlayerAction |
| [`appendRawOrBooleanCommand`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8852) | labelText, action, stateValue, dpId | String, actions.appendChild, button.addEventListener, document.createElement, row.appendChild, send.addEventListener, wrap.appendChild |
| [`mkTab`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8976) | kind, label | b.addEventListener, document.createElement |
| [`getItems`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9053) | – | – |
| [`renderRecent`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9077) | – | document.createElement, nwClear, nwLoadPlayerRecent, recent.slice, recentWrap.appendChild |
| [`renderList`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9126) | – | String, document.createElement, getItems, items.forEach, list.appendChild, nwClear, nwLoadPlayerFavs, shown.forEach |
| [`matchesQuery`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9148) | it | String |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9264) | – | favBtn.classList.toggle, renderList, renderRecent, tabPlaylists.classList.toggle, tabStations.classList.toggle |
| [`nwCreateHalfDial`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9286) | opts | Number, Number.isFinite, active.setAttribute, base.setAttribute, document.createElement, document.createElementNS, knob.setAttribute, nwClampNumber, nwFormatNumberDE, nwRoundToStep, setValue, svg.addEventListener, svg.appendChild, svg.setAttribute (weitere in der Quelle) |
| [`setValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9364) | v | Math.cos, Math.sin, active.setAttribute, knob.setAttribute, nwClampNumber, nwFormatNumberDE, nwRoundToStep, x.toFixed, y.toFixed |
| [`posToValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9394) | ev | Math.atan2, Math.max, Math.min, Number.isFinite, svg.getBoundingClientRect |
| [`onDown`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9427) | ev | ev.preventDefault, ev.stopPropagation, posToValue, setValue, svg.setPointerCapture |
| [`onMove`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9448) | ev | ev.preventDefault, ev.stopPropagation, posToValue, setValue |
| [`onUp`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9468) | ev | ev.preventDefault, ev.stopPropagation, onCommit, posToValue, setValue, svg.releasePointerCapture |
| [`nwRenderRooms`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9509) | devices | Array.from, document.getElementById, floorKeys.forEach, floorKeys.sort, floorMap.keys, nwClear, nwGroupByRoom, roomGroups.forEach |
| [`renderRoomSection`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9555) | g | String, arr.forEach, arr.sort, document.createElement, header.appendChild, nwComputeRoomSummary, nwGroupDevicesByType, nwStaticIconHtml, section.appendChild, title.querySelector, typeGroups.forEach |
| [`nwComputeFunctionSummary`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9670) | funcName, funcDevices | Array.isArray, String, devs.forEach |
| [`nwRenderFunctions`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9692) | devices | document.getElementById, groups.forEach, nwClear, nwGroupByFunction |
| [`nwFindFloorPageId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9765) | floorId | Array.isArray, nwNormalizeId, pages.find, pages.some |
| [`nwFindRoomPageId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9781) | roomId | Array.isArray, nwNormalizeId, pages.find, pages.some |
| [`nwRenderHome`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9795) | devices | Array.isArray, all.filter, all.some, arr.forEach, cfg.floors.slice, cfg.rooms.slice, devices.slice, document.createElement, document.getElementById, favSec.appendChild, favs.slice, floorSec.appendChild, floorTiles.forEach, floorTiles.push (weitere in der Quelle) |
| [`sortByOrderName`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9869) | a, b | Number.isFinite, String |
| [`go`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9989) | – | nwActivatePage, nwFindFloorPageId |
| [`nwNormalizeId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10026) | s | String |
| [`nwBuildMetaFromConfig`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10035) | cfg | Array.isArray, floors.forEach, funcs.forEach, rooms.forEach |
| [`nwBuildDefaultPagesFromConfig`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10077) | cfg | Array.isArray, nwNormalizeId, pages.push, roomsByFloor.get, roomsByFloor.has, roomsByFloor.set, roomsSorted.forEach, roomsSorted.map, sortedFloors.forEach, unassignedRooms.push |
| [`nwIsHomePage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10262) | page | String |
| [`nwIsLegacyFlatRoomPages`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10276) | pages, cfg | Array.isArray, arr.filter, arr.some, nwNormalizeId, roomIdSet.has, rooms.map, rooms.some, usedRoomIds.add, usedRoomIds.has |
| [`nwGetPagesFromConfig`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10319) | cfg | Array.isArray, nwBuildDefaultPagesFromConfig, nwIsLegacyFlatRoomPages |
| [`nwSetSidebarOpen`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10358) | open | String, document.getElementById, sidebar.classList.toggle, toggle.setAttribute |
| [`nwInitSidebarUi`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10375) | – | btn.addEventListener, document.addEventListener, document.getElementById, overlay.addEventListener, window.addEventListener |
| [`nwUpdatePageTitle`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10416) | – | Array.isArray, String, byId.get, chain.unshift, document.getElementById, pages.find, pages.map |
| [`nwCloseSidebar`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10469) | – | nwSetSidebarOpen |
| [`nwLoadExpandedIdsFromLs`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10478) | – | Array.isArray, JSON.parse, arr.filter, localStorage.getItem, nwBuildPageTree, nwSaveExpandedIdsToLs, rootWithChildren.map, rootWithChildren.some, roots.filter |
| [`nwSaveExpandedIdsToLs`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10520) | – | Array.from, JSON.stringify, localStorage.setItem |
| [`nwEnsureAncestorsExpanded`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10533) | pageId | byId.get, nwPageState.expandedIds.add, nwSaveExpandedIdsToLs |
| [`nwToggleNavExpanded`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10553) | pageId | nwLoadExpandedIdsFromLs, nwPageState.expandedIds.add, nwPageState.expandedIds.delete, nwPageState.expandedIds.has, nwRenderSidebarNav, nwSaveExpandedIdsToLs |
| [`nwResolvePageFilters`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10567) | page | Array.isArray, byId.get, chain.unshift, p.funcIds.slice, p.roomIds.slice, p.types.slice |
| [`nwIsFloorPage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10598) | page | id.startsWith |
| [`nwGetFloorIdFromPage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10608) | page | id.slice, id.startsWith |
| [`nwFilterDevicesForPage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10620) | allDevices, page | Array.isArray, allDevices.slice, eff.funcIds.map, eff.roomIds.map, eff.types.map, nwGetFloorIdFromPage, nwIsFloorPage, nwResolvePageFilters, out.filter |
| [`nwGetDevicesForPage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10665) | page | nwFilterDevicesForPage |
| [`nwUpdatePageCounts`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10674) | – | nwGetDevicesForPage |
| [`nwBuildPageTree`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10688) | pages | arr.sort, byId.has, children.entries, children.get, children.has, children.set, roots.push, roots.sort |
| [`sortFn`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10715) | a, b | String |
| [`nwRenderSidebarNav`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10727) | – | document.getElementById, nwBuildPageTree, nwLoadExpandedIdsFromLs, nwUpdatePageCounts, renderList |
| [`renderList`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10752) | list, depth | Math.max, String, btn.addEventListener, btn.appendChild, caret.addEventListener, children.get, children.has, document.createElement, el.appendChild, nwIsHomePage, nwPageState.expandedIds.has, nwStaticIconHtml, renderList |
| [`nwActivatePage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10837) | pageId | Array.isArray, eff.funcIds.slice, eff.roomIds.slice, eff.types.slice, localStorage.setItem, nwApplyFiltersAndRender, nwEnsureAncestorsExpanded, nwNormalizeId, nwPageState.pages.find, nwRenderSidebarNav, nwResolvePageFilters, nwUpdatePageTitle |
| [`nwLoadSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10882) | – | Array.isArray, eff0.funcIds.slice, eff0.roomIds.slice, eff0.types.slice, fetch, localStorage.getItem, nwBuildMetaFromConfig, nwEnsureAncestorsExpanded, nwGetPagesFromConfig, nwInitSidebarUi, nwPageState.pages.find, nwPageState.pages.some, nwRenderSidebarNav, nwResolvePageFilters (weitere in der Quelle) |
| [`nwGetDeviceRoomId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10939) | dev | nwNormalizeId |
| [`nwGetDeviceFloorId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10951) | dev | nwGetDeviceRoomId, nwNormalizeId |
| [`nwGetDeviceFuncId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10966) | dev | nwNormalizeId |
| [`nwApplyPageFilters`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10978) | devices | Array.isArray, devices.slice, nwGetFloorIdFromPage, nwIsFloorPage, out.filter, p.funcIds.map, p.roomIds.map, p.types.map |
| [`nwApplyFiltersAndRender`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11014) | – | nwApplyFilters, nwApplyPageFilters, nwIsHomePage, nwRenderFunctionChips, nwRenderFunctions, nwRenderHome, nwRenderRooms, nwRenderTextSizeChips, nwRenderViewChips, nwShowEmptyState |
| [`nwDeviceRenderSignature`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11062) | devices | JSON.stringify, devices.map |
| [`withoutAge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11063) | value | Array.isArray |
| [`nwReloadDevices`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11085) | opts | Array.isArray, String, console.error, document.getElementById, nwApplyFiltersAndRender, nwCaptureDeviceFocus, nwDeviceRenderSignature, nwFetchDevices, nwRenderSidebarNav, nwRestoreDeviceFocus, nwShowEmptyState, nwSyncOpenPopoverFeedback, window.NW_SH_TOUCH?.isInteracting |
| [`nwRefreshDevicesSoon`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11123) | delayMs | Math.max, Number, clearTimeout, setTimeout |
| [`nwStartAutoRefresh`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11142) | intervalMs | setInterval |
| [`nwStopAutoRefresh`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11156) | – | clearInterval |
| [`nwInitMenu`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11167) | – | document.addEventListener, document.getElementById, menu.addEventListener, menuBtn.addEventListener |
| [`close`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11188) | – | menu.classList.add |
| [`toggle`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11195) | – | menu.classList.toggle |
| [`nwLoadUiConfigFlags`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11212) | – | Array.isArray, Math.max, Math.round, Number, document.getElementById, fetch, l.classList.toggle, sc.evcsList.filter, sfMenu.classList.toggle, sfTab.classList.toggle, sl.classList.toggle, t.classList.toggle |
| [`nwBootstrap`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11246) | – | document.addEventListener, document.getElementById, localStorage.removeItem, nwApplyTextSizeClass, nwInitMenu, nwLoadBoolLS, nwLoadFavoriteOverrides, nwLoadSmartHomeConfig, nwLoadTextSize, nwLoadUiConfigFlags, nwLoadViewMode, nwReloadDevices, nwStartAutoRefresh, viewsEl.classList.remove (weitere in der Quelle) |
