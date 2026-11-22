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
| [`nwFetchDevices`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3071) | – | Array.isArray, fetch, res.json |
| [`nwToggleDevice`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3084) | id, value | JSON.stringify, fetch, res.json |
| [`nwSetLevel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3103) | id, level | JSON.stringify, fetch, res.json |
| [`nwSetColor`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3120) | id, colorOrPayload | Array.isArray, JSON.stringify, fetch, res.json |
| [`nwCoverAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3140) | id, action, value | JSON.stringify, fetch, res.json |
| [`nwPlayerAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3158) | id, action, value | JSON.stringify, fetch, res.json |
| [`nwPlayerActionMulti`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3180) | primaryId, action, value | Array.from, nwGetSelectedAudioZones, nwPlayerAction |
| [`nwSetRtrSetpoint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3199) | id, setpoint | JSON.stringify, fetch, res.json |
| [`nwClimateAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3212) | id, action, value | JSON.stringify, fetch, res.json |
| [`nwSetSmartHomeValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3225) | id, value | JSON.stringify, fetch, res.json |
| [`nwSaveDeviceTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3243) | deviceId, timer | JSON.stringify, fetch, res.json |
| [`nwDeleteDeviceTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3260) | deviceId | JSON.stringify, fetch, res.json |
| [`nwAdjustRtrSetpoint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3277) | dev, delta | nwReloadDevices, nwSetRtrSetpoint |
| [`nwClear`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3300) | el | el.removeChild |
| [`nwSortBy`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3310) | a, b | String |
| [`nwGetDeviceOrder`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3323) | dev | Number.isFinite |
| [`nwTypeLabel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3370) | type | String, t.charAt, t.slice |
| [`nwCompareDevices`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3381) | a, b | nwGetDeviceOrder, nwIsFavorite, nwSortBy, nwTypeLabel |
| [`nwGroupDevicesByType`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3413) | devices | Array.from, groups.sort, map.entries |
| [`nwFormatNumberDE`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3436) | value, precision | Number, Number.isFinite, v.toFixed |
| [`nwComputeRoomSummary`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3448) | roomId, allDevices | Array.isArray, Math.round, Number, Number.isFinite, String, allDevices.filter, devs.forEach, nwFormatNumberDE, nwNormalizeId, parts.join, parts.push, pick |
| [`pick`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3505) | arr | arr.sort |
| [`nwApplyFilters`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3532) | devices | Array.isArray, devices.slice, out.filter |
| [`nwGetAllFunctions`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3555) | devices | Array.from |
| [`nwGuessIconForFunctionLabel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3569) | label | String, s.includes |
| [`nwRenderViewChips`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3587) | – | document.getElementById, mkChip, nwClear |
| [`mkChip`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3597) | label, active, onClick | btn.addEventListener, document.createElement, wrap.appendChild |
| [`nwRenderTextSizeChips`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3626) | – | document.getElementById, mkChip, nwClear, nwNormTextSize |
| [`mkChip`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3636) | label, active, onClick | btn.addEventListener, document.createElement, wrap.appendChild |
| [`nwRenderFunctionChips`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3676) | devices | allFns.forEach, document.getElementById, mkChip, nwClear, nwGetAllFunctions |
| [`mkChip`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3698) | label, active, onClick, extraClass, disabled, title, iconName | btn.addEventListener, btn.querySelector, document.createElement, nwGetIconSvg, wrap.appendChild |
| [`nwGroupByRoom`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3761) | devices | Array.from, keys.map, keys.sort, map.keys |
| [`nwGroupByFunction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3832) | devices | Array.from, fns.map, map.keys |
| [`nwShowEmptyState`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3849) | show, ctx | document.getElementById, empty.classList.remove |
| [`nwEnsureShToast`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3899) | – | document.body.appendChild, document.createElement, el.setAttribute |
| [`nwHideShToast`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3914) | – | clearTimeout, nwShToastEl.classList.remove |
| [`nwShowShToastForTile`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3928) | dev | String, clearTimeout, document.createElement, nwClear, nwEnsureShToast, nwGetStateText, parts.join, parts.push, setTimeout, toast.appendChild, toast.classList.add |
| [`nwCreateTile`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L3966) | dev, opts | Date.now, Math.max, Math.min, Math.round, Number.isFinite, String, actions.appendChild, addMiniBtn, addMiniToggle, arc.appendChild, big.appendChild, btn.addEventListener, btnMinus.addEventListener, btnPlus.addEventListener (weitere in der Quelle) |
| [`stop`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4290) | ev | ev.stopPropagation |
| [`stop`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4405) | ev | ev.stopPropagation |
| [`addMiniToggle`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4443) | – | document.createElement, footer.appendChild, t.addEventListener, t.setAttribute |
| [`addMiniBtn`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4481) | label, title, onClick | b.addEventListener, b.setAttribute, document.createElement, footer.appendChild |
| [`mk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4563) | label, action, mapped, allowed | b.addEventListener, b.setAttribute, document.createElement |
| [`lpCancel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4614) | – | clearTimeout |
| [`nwCaptureDeviceFocus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4744) | element | element.closest |
| [`nwRestoreDeviceFocus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4754) | saved | Array.from, document.getElementById, document.querySelectorAll, target.focus, tile.querySelector, tile.querySelectorAll |
| [`nwPopoverFocusableElements`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4771) | – | Array.from, nwPopoverEl.querySelectorAll |
| [`nwActivatePopoverSurface`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4784) | anchorEl | Array.from, nwCaptureDeviceFocus, nwLockBodyScroll, nwPopoverBackdropEl.classList.remove, nwPopoverEl.classList.remove, requestAnimationFrame |
| [`nwSyncOpenPopoverFeedback`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4811) | devices | JSON.stringify, String, devices.find, indicators.replaceWith, nwClosePopover, nwCreateDeviceIndicators, nwGetQualityStatus, nwGetStateText, nwPopoverEl.querySelector |
| [`nwLockBodyScroll`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4845) | – | Math.max, document.body.classList.add |
| [`nwUnlockBodyScroll`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4873) | – | document.body.classList.remove, window.scrollTo |
| [`nwEnsurePopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4899) | – | document.addEventListener, document.body.appendChild, document.createElement, nwPopoverBackdropEl.addEventListener, nwPopoverEl.addEventListener, nwPopoverEl.setAttribute, window.addEventListener |
| [`close`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4933) | – | nwClosePopover |
| [`nwClosePopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L4988) | – | nwPopoverBackdropEl.classList.add, nwPopoverBackground.forEach, nwPopoverEl.classList.add, nwRestoreDeviceFocus, nwUnlockBodyScroll |
| [`nwOpenDevicePopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5012) | dev, anchorEl | nwActivatePopoverSurface, nwBuildPopoverContent, nwClosePopover, nwEnsurePopover, nwGetQualityStatus, nwPopoverEl.classList.contains |
| [`nwOpenTimerPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5041) | dev, anchorEl | nwActivatePopoverSurface, nwBuildTimerPopoverContent, nwClosePopover, nwEnsurePopover, nwPopoverEl.classList.contains |
| [`nwBuildTimerPopoverContent`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5065) | dev | Array.isArray, Math.max, Math.min, Math.round, Number.isNaN, String, b.addEventListener, body.appendChild, btn.addEventListener, closeBtn.addEventListener, closeBtn.setAttribute, delBtn.addEventListener, document.createElement, footer.appendChild (weitere in der Quelle) |
| [`fmtNext`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5137) | – | Date.now, Number, Number.isFinite, String, d.getHours, d.getMinutes |
| [`updateHeaderState`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5163) | – | fmtNext |
| [`rebuildDays`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5225) | – | Array.from, days.sort |
| [`mkTime`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5267) | lbl, val, onChange | document.createElement, inp.addEventListener, wrap.appendChild |
| [`nwPositionPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5382) | anchorEl | Math.max, Math.min, Math.round, nwPopoverEl.classList.contains |
| [`nwClampNumber`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5410) | v, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`nwRoundToStep`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5421) | v, step | Math.round, Number, Number.isFinite |
| [`nwUpdateRangeFill`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5437) | rangeEl | Math.max, Math.min, Number, Number.isFinite, clamped.toFixed, rangeEl.style.setProperty |
| [`nwLoadJsonLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5473) | key, defVal | JSON.parse, localStorage.getItem |
| [`nwSaveJsonLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5490) | key, obj | JSON.stringify, localStorage.setItem |
| [`nwLoadFavoriteOverrides`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5501) | – | Object.keys, nwLoadJsonLS |
| [`nwSaveFavoriteOverrides`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5519) | map | nwSaveJsonLS |
| [`nwGetInstallerFavorite`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5528) | dev | – |
| [`nwIsFavorite`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5537) | dev | Object.prototype.hasOwnProperty.call, String, nwGetInstallerFavorite |
| [`nwToggleFavorite`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5552) | dev | Object.prototype.hasOwnProperty.call, String, nwGetInstallerFavorite, nwIsFavorite, nwSaveFavoriteOverrides |
| [`nwLoadNumberLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5574) | key, defVal | Number, Number.isFinite, localStorage.getItem |
| [`nwSaveNumberLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5590) | key, val | String, localStorage.setItem |
| [`nwCreateStatusBadge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5601) | – | document.createElement, el.setAttribute |
| [`nwSetStatusBadge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5614) | el, kind, text | el.classList.add, el.classList.remove |
| [`nwLoadBoolLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5633) | key, defVal | localStorage.getItem |
| [`nwSaveBoolLS`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5650) | key, val | localStorage.setItem |
| [`nwLoadViewMode`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5661) | defMode | String, localStorage.getItem |
| [`nwSaveViewMode`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5675) | mode | localStorage.setItem |
| [`nwNormTextSize`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5686) | v | String |
| [`nwLoadTextSize`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5699) | defSize | localStorage.getItem, nwNormTextSize |
| [`nwSaveTextSize`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5712) | size | localStorage.setItem, nwNormTextSize |
| [`nwApplyTextSizeClass`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5723) | size | document.getElementById, nwNormTextSize, root.classList.add, root.classList.remove |
| [`nwCreateLivePreviewSender`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5742) | sendFn, intervalMs | – |
| [`schedule`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5755) | – | Date.now, Math.max, clearTimeout, setTimeout |
| [`trigger`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5803) | val, force | schedule |
| [`nwCreateSmartHomeRangeControl`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5815) | options | Math.max, Math.min, Number, Number.isFinite, String, document.createElement, format, header.appendChild, nwClampNumber, nwCreateStatusBadge, nwUpdateRangeFill, right.appendChild, slider.addEventListener, slider.setAttribute (weitere in der Quelle) |
| [`nwBuildPopoverContent`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5898) | dev | String, body.appendChild, close.addEventListener, close.setAttribute, document.createElement, hdr.appendChild, left.appendChild, nwCreateBlindPopover, nwCreateColorPopover, nwCreateDeviceIndicators, nwCreateIconElement, nwCreateLevelPopover, nwCreatePlayerPopover, nwCreateRtrPopover (weitere in der Quelle) |
| [`nwCreateLevelPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L5992) | dev, canWrite, opts | Math.round, Number.isFinite, String, btnRow.appendChild, document.createElement, liveBtn.addEventListener, liveBtn.setAttribute, minus.addEventListener, nwClampNumber, nwCreateLivePreviewSender, nwCreateSmartHomeRangeControl, nwCreateStatusBadge, nwCreateValueGauge, nwHasPrimaryState (weitere in der Quelle) |
| [`clearStatusTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6038) | – | clearTimeout |
| [`flashStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6050) | kind, text, ms | clearStatusTimer, nwSetStatusBadge, setTimeout |
| [`setBusy`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6066) | – | flashStatus |
| [`setOk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6073) | – | flashStatus |
| [`setErr`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6080) | – | flashStatus |
| [`commitLevel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6126) | nextVal, opts | Math.round, String, dial.nwSetValue, nwClampNumber, nwReloadDevices, nwSetLevel, nwUpdateRangeFill, setBusy, setErr, setOk |
| [`formatter`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6159) | val | Math.round |
| [`minmaxFormatter`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6160) | val | Math.round |
| [`onInput`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6161) | val | Math.round, String, liveSender.trigger, nwUpdateRangeFill |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6167) | val | commitLevel |
| [`syncStepBtns`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6237) | – | stepChoices.forEach |
| [`updateHint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6315) | – | – |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6344) | value | nwReloadDevices, nwSetColor |
| [`nwCreateColorPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6387) | dev, canWrite | Math.round, String, btnRow.appendChild, clamp01, current.toUpperCase, document.createElement, liveBtn.addEventListener, liveBtn.setAttribute, normHex, nwCreateLivePreviewSender, nwCreateSmartHomeRangeControl, nwCreateStatusBadge, nwHasPrimaryState, nwIsOn (weitere in der Quelle) |
| [`normHex`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6407) | val | String, s.slice, s.startsWith, s.toLowerCase |
| [`clamp01`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6433) | n | Math.max, Math.min, Number |
| [`clamp`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6440) | n, lo, hi | Math.max, Math.min, Number |
| [`hexToRgb`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6447) | hex | h.slice, normHex, parseInt, s.slice |
| [`rgbToHex`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6462) | r, g, b | Math.round, clamp |
| [`rgbToHsv`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6474) | r, g, b | Math.max, Math.min, clamp01 |
| [`hsvToRgb`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6499) | h, s, v | Math.abs, Math.round, Number, clamp01 |
| [`setHsvFromHex`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6527) | hex | hexToRgb, rgbToHsv |
| [`clearStatusTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6575) | – | clearTimeout |
| [`flashStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6587) | kind, text, ms | clearStatusTimer, nwSetStatusBadge, setTimeout |
| [`setBusy`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6603) | – | flashStatus |
| [`setOk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6610) | – | flashStatus |
| [`setErr`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6617) | – | flashStatus |
| [`hsvToHex`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6670) | h, s, vVal | hsvToRgb, rgbToHex |
| [`updateValueSliderGradient`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6680) | – | hsvToHex, valueSlider.style.setProperty |
| [`updateWheelMarker`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6691) | – | Math.cos, Math.sin, clamp01 |
| [`setUi`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6709) | hex | Math.round, String, clamp01, h.toUpperCase, normHex, setHsvFromHex, updateValueSliderGradient, updateWheelMarker |
| [`drawWheel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6725) | – | Math.atan2, Math.max, Math.min, Math.round, Math.sqrt, ctx.clearRect, ctx.createImageData, ctx.putImageData, ctx.setTransform, hsvToRgb, wheelCanvas.getContext |
| [`commitColor`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6782) | hex, opts | normHex, nwReloadDevices, nwSetColor, setBusy, setErr, setOk, setUi |
| [`updateFromWheelEvent`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6814) | ev, opts | Math.atan2, Math.sqrt, String, clamp01, hsvToHex, liveSender.trigger, setUi, wheelWrap.getBoundingClientRect |
| [`endWheel`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6860) | ev | commitColor, ev.preventDefault, updateFromWheelEvent |
| [`updateHint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6926) | – | – |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6952) | value | nwReloadDevices, nwSetColor |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6970) | value | nwReloadDevices, nwSetColor |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L6988) | value | nwReloadDevices, nwSetColor |
| [`nwCreateBlindPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7032) | dev, canWrite | Math.round, Number.isFinite, String, activeProtection.join, activeProtection.push, controls.appendChild, document.createElement, liveBtn.addEventListener, liveBtn.setAttribute, minus.addEventListener, mk, nwClampNumber, nwCreateLivePreviewSender, nwCreateSmartHomeRangeControl (weitere in der Quelle) |
| [`clearStatusTimer`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7099) | – | clearTimeout |
| [`flashStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7111) | kind, text, ms | clearStatusTimer, nwSetStatusBadge, setTimeout |
| [`setBusy`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7127) | – | flashStatus |
| [`setOk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7134) | – | flashStatus |
| [`setErr`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7141) | – | flashStatus |
| [`commitPos`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7185) | nextVal, opts | Math.round, String, dial.nwSetValue, nwClampNumber, nwReloadDevices, nwSetLevel, nwUpdateRangeFill, setBusy, setErr, setOk |
| [`formatter`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7218) | val | Math.round |
| [`minmaxFormatter`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7219) | val | Math.round |
| [`onInput`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7221) | val | Math.round, String, liveSender.trigger, nwUpdateRangeFill |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7227) | val | commitPos |
| [`syncStepBtns`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7297) | – | stepChoices.forEach |
| [`updateHint`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7375) | – | – |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7417) | value | nwCoverAction, nwReloadDevices |
| [`mk`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7440) | label, action | b.addEventListener, document.createElement |
| [`nwGetRtrRange`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7481) | dev | – |
| [`nwCreateRtrPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7493) | dev, canWrite | Math.round, String, actions.appendChild, appendRawCommand, button.addEventListener, buttons.appendChild, controls.appendChild, document.createElement, nwCreateSmartHomeRangeControl, nwCreateStatusBadge, nwFormatNumberDE, nwGetRtrRange, off.addEventListener, on.addEventListener (weitere in der Quelle) |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7546) | value | nwReloadDevices, nwSetRtrSetpoint |
| [`setStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7555) | kind, text | nwSetStatusBadge |
| [`sendAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7559) | action, value | nwClimateAction, nwReloadDevices, setStatus |
| [`appendRawCommand`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7598) | labelText, action, dpId, currentValue, disabledBySafety | String, actions.appendChild, controls.appendChild, document.createElement, row.appendChild, send.addEventListener |
| [`nwCreateValueGauge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7696) | opts | Array.isArray, Math.cos, Math.random, Math.sin, Number, Number.isFinite, String, active.classList.add, active.setAttribute, base.classList.add, base.setAttribute, btnMinus.addEventListener, btnPlus.addEventListener, btnRow.appendChild (weitere in der Quelle) |
| [`setValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7853) | v, silent, markKnown | Math.cos, Math.sin, active.setAttribute, formatter, knob.setAttribute, nwClampNumber, nwRoundToStep, onInput, wrap.classList.toggle, x.toFixed, y.toFixed |
| [`commit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7874) | – | onCommit |
| [`stop`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7893) | ev | ev.stopPropagation |
| [`pickFromClient`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7932) | clientX, clientY | Math.atan2, setValue, svg.getBoundingClientRect |
| [`onMouseDown`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7958) | ev | document.addEventListener, ev.preventDefault, ev.stopPropagation, pickFromClient |
| [`move`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7970) | e | pickFromClient |
| [`up`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L7983) | – | commit, document.removeEventListener |
| [`onTouchStart`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8007) | ev | document.addEventListener, ev.preventDefault, ev.stopPropagation, pickFromClient |
| [`move`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8026) | e | pickFromClient |
| [`end`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8036) | – | commit, document.removeEventListener |
| [`nwCreateThermostatGauge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8065) | opts | Math.cos, Math.max, Math.min, Math.random, Math.round, Math.sin, Number, Number.isFinite, String, active.classList.add, active.setAttribute, base.classList.add, base.setAttribute, btnMinus.addEventListener (weitere in der Quelle) |
| [`mkStop`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8122) | off, col | document.createElementNS, s.setAttribute |
| [`setValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8256) | v | Math.cos, Math.sin, active.setAttribute, knob.setAttribute, nwClampNumber, nwFormatNumberDE, nwRoundToStep, x.toFixed, y.toFixed |
| [`commit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8289) | – | onCommit |
| [`stop`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8308) | ev | ev.stopPropagation |
| [`pickFromClient`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8351) | clientX, clientY | Math.atan2, setValue, svg.getBoundingClientRect |
| [`onMouseDown`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8381) | ev | document.addEventListener, ev.preventDefault, ev.stopPropagation, pickFromClient |
| [`move`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8401) | e | pickFromClient |
| [`up`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8408) | – | commit, document.removeEventListener |
| [`onTouchStart`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8433) | ev | document.addEventListener, ev.preventDefault, ev.stopPropagation, pickFromClient |
| [`move`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8455) | e | pickFromClient |
| [`end`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8465) | – | commit, document.removeEventListener |
| [`nwCreateValuePopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8493) | dev, canWrite | Number, Number.isFinite, String, actions.appendChild, document.createElement, nwCreateStatusBadge, row.appendChild, send.addEventListener, wrap.appendChild |
| [`nwCreatePlayerPopover`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8584) | dev, canWrite | Array.isArray, Math.max, Math.round, Number, Number.isFinite, String, appendBooleanCommand, appendRawOrBooleanCommand, controls.appendChild, document.createElement, favBtn.addEventListener, filters.appendChild, head.appendChild, lib.appendChild (weitere in der Quelle) |
| [`renderZones`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8682) | – | allIds.every, nwClear, nwGetSelectedAudioZones, partyBtn.classList.toggle, soloBtn.classList.toggle, zones.forEach, zones.map |
| [`setStatus`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8732) | kind, text | nwSetStatusBadge |
| [`runPlayerAction`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8733) | action, value, refreshDelay | nwPlayerActionMulti, nwRefreshDevicesSoon, setStatus |
| [`mkBtn`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8750) | label, text, action, enabled, extraClass | b.addEventListener, b.setAttribute, document.createElement |
| [`appendBooleanCommand`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8790) | labelText, action, stateValue, readId, writeId, onText, offText | actions.appendChild, document.createElement, explicitToggles.appendChild, off.addEventListener, on.addEventListener, row.appendChild |
| [`onCommit`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8889) | value | runPlayerAction |
| [`appendRawOrBooleanCommand`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L8893) | labelText, action, stateValue, dpId | String, actions.appendChild, button.addEventListener, document.createElement, row.appendChild, send.addEventListener, wrap.appendChild |
| [`mkTab`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9017) | kind, label | b.addEventListener, document.createElement |
| [`getItems`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9094) | – | – |
| [`renderRecent`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9118) | – | document.createElement, nwClear, nwLoadPlayerRecent, recent.slice, recentWrap.appendChild |
| [`renderList`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9167) | – | String, document.createElement, getItems, items.forEach, list.appendChild, nwClear, nwLoadPlayerFavs, shown.forEach |
| [`matchesQuery`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9189) | it | String |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9305) | – | favBtn.classList.toggle, renderList, renderRecent, tabPlaylists.classList.toggle, tabStations.classList.toggle |
| [`nwCreateHalfDial`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9327) | opts | Number, Number.isFinite, active.setAttribute, base.setAttribute, document.createElement, document.createElementNS, knob.setAttribute, nwClampNumber, nwFormatNumberDE, nwRoundToStep, setValue, svg.addEventListener, svg.appendChild, svg.setAttribute (weitere in der Quelle) |
| [`setValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9405) | v | Math.cos, Math.sin, active.setAttribute, knob.setAttribute, nwClampNumber, nwFormatNumberDE, nwRoundToStep, x.toFixed, y.toFixed |
| [`posToValue`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9435) | ev | Math.atan2, Math.max, Math.min, Number.isFinite, svg.getBoundingClientRect |
| [`onDown`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9468) | ev | ev.preventDefault, ev.stopPropagation, posToValue, setValue, svg.setPointerCapture |
| [`onMove`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9489) | ev | ev.preventDefault, ev.stopPropagation, posToValue, setValue |
| [`onUp`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9509) | ev | ev.preventDefault, ev.stopPropagation, onCommit, posToValue, setValue, svg.releasePointerCapture |
| [`nwRenderRooms`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9550) | devices | Array.from, document.getElementById, floorKeys.forEach, floorKeys.sort, floorMap.keys, nwClear, nwGroupByRoom, roomGroups.forEach |
| [`renderRoomSection`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9596) | g | String, arr.forEach, arr.sort, document.createElement, header.appendChild, nwComputeRoomSummary, nwGroupDevicesByType, nwStaticIconHtml, section.appendChild, title.querySelector, typeGroups.forEach |
| [`nwComputeFunctionSummary`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9711) | funcName, funcDevices | Array.isArray, String, devs.forEach |
| [`nwRenderFunctions`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9733) | devices | document.getElementById, groups.forEach, nwClear, nwGroupByFunction |
| [`nwFindFloorPageId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9806) | floorId | Array.isArray, nwNormalizeId, pages.find, pages.some |
| [`nwFindRoomPageId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9822) | roomId | Array.isArray, nwNormalizeId, pages.find, pages.some |
| [`nwRenderHome`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9836) | devices | Array.isArray, all.filter, all.some, arr.forEach, cfg.floors.slice, cfg.rooms.slice, devices.slice, document.createElement, document.getElementById, favSec.appendChild, favs.slice, floorSec.appendChild, floorTiles.forEach, floorTiles.push (weitere in der Quelle) |
| [`sortByOrderName`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L9910) | a, b | Number.isFinite, String |
| [`go`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10030) | – | nwActivatePage, nwFindFloorPageId |
| [`nwNormalizeId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10067) | s | String |
| [`nwBuildMetaFromConfig`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10076) | cfg | Array.isArray, floors.forEach, funcs.forEach, rooms.forEach |
| [`nwBuildDefaultPagesFromConfig`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10118) | cfg | Array.isArray, nwNormalizeId, pages.push, roomsByFloor.get, roomsByFloor.has, roomsByFloor.set, roomsSorted.forEach, roomsSorted.map, sortedFloors.forEach, unassignedRooms.push |
| [`nwIsHomePage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10303) | page | String |
| [`nwIsLegacyFlatRoomPages`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10317) | pages, cfg | Array.isArray, arr.filter, arr.some, nwNormalizeId, roomIdSet.has, rooms.map, rooms.some, usedRoomIds.add, usedRoomIds.has |
| [`nwGetPagesFromConfig`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10360) | cfg | Array.isArray, nwBuildDefaultPagesFromConfig, nwIsLegacyFlatRoomPages |
| [`nwSetSidebarOpen`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10399) | open | String, document.getElementById, sidebar.classList.toggle, toggle.setAttribute |
| [`nwInitSidebarUi`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10416) | – | btn.addEventListener, document.addEventListener, document.getElementById, overlay.addEventListener, window.addEventListener |
| [`nwUpdatePageTitle`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10457) | – | Array.isArray, String, byId.get, chain.unshift, document.getElementById, pages.find, pages.map |
| [`nwCloseSidebar`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10510) | – | nwSetSidebarOpen |
| [`nwLoadExpandedIdsFromLs`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10519) | – | Array.isArray, JSON.parse, arr.filter, localStorage.getItem, nwBuildPageTree, nwSaveExpandedIdsToLs, rootWithChildren.map, rootWithChildren.some, roots.filter |
| [`nwSaveExpandedIdsToLs`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10561) | – | Array.from, JSON.stringify, localStorage.setItem |
| [`nwEnsureAncestorsExpanded`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10574) | pageId | byId.get, nwPageState.expandedIds.add, nwSaveExpandedIdsToLs |
| [`nwToggleNavExpanded`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10594) | pageId | nwLoadExpandedIdsFromLs, nwPageState.expandedIds.add, nwPageState.expandedIds.delete, nwPageState.expandedIds.has, nwRenderSidebarNav, nwSaveExpandedIdsToLs |
| [`nwResolvePageFilters`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10608) | page | Array.isArray, byId.get, chain.unshift, p.funcIds.slice, p.roomIds.slice, p.types.slice |
| [`nwIsFloorPage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10639) | page | id.startsWith |
| [`nwGetFloorIdFromPage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10649) | page | id.slice, id.startsWith |
| [`nwFilterDevicesForPage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10661) | allDevices, page | Array.isArray, allDevices.slice, eff.funcIds.map, eff.roomIds.map, eff.types.map, nwGetFloorIdFromPage, nwIsFloorPage, nwResolvePageFilters, out.filter |
| [`nwGetDevicesForPage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10706) | page | nwFilterDevicesForPage |
| [`nwUpdatePageCounts`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10715) | – | nwGetDevicesForPage |
| [`nwBuildPageTree`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10729) | pages | arr.sort, byId.has, children.entries, children.get, children.has, children.set, roots.push, roots.sort |
| [`sortFn`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10756) | a, b | String |
| [`nwRenderSidebarNav`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10768) | – | document.getElementById, nwBuildPageTree, nwLoadExpandedIdsFromLs, nwUpdatePageCounts, renderList |
| [`renderList`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10793) | list, depth | Math.max, String, btn.addEventListener, btn.appendChild, caret.addEventListener, children.get, children.has, document.createElement, el.appendChild, nwIsHomePage, nwPageState.expandedIds.has, nwStaticIconHtml, renderList |
| [`nwActivatePage`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10878) | pageId | Array.isArray, eff.funcIds.slice, eff.roomIds.slice, eff.types.slice, localStorage.setItem, nwApplyFiltersAndRender, nwEnsureAncestorsExpanded, nwNormalizeId, nwPageState.pages.find, nwRenderSidebarNav, nwResolvePageFilters, nwUpdatePageTitle |
| [`nwLoadSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10923) | – | Array.isArray, eff0.funcIds.slice, eff0.roomIds.slice, eff0.types.slice, fetch, localStorage.getItem, nwBuildMetaFromConfig, nwEnsureAncestorsExpanded, nwGetPagesFromConfig, nwInitSidebarUi, nwPageState.pages.find, nwPageState.pages.some, nwRenderSidebarNav, nwResolvePageFilters (weitere in der Quelle) |
| [`nwGetDeviceRoomId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10980) | dev | nwNormalizeId |
| [`nwGetDeviceFloorId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L10992) | dev | nwGetDeviceRoomId, nwNormalizeId |
| [`nwGetDeviceFuncId`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11007) | dev | nwNormalizeId |
| [`nwApplyPageFilters`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11019) | devices | Array.isArray, devices.slice, nwGetFloorIdFromPage, nwIsFloorPage, out.filter, p.funcIds.map, p.roomIds.map, p.types.map |
| [`nwApplyFiltersAndRender`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11055) | – | nwApplyFilters, nwApplyPageFilters, nwIsHomePage, nwRenderFunctionChips, nwRenderFunctions, nwRenderHome, nwRenderRooms, nwRenderTextSizeChips, nwRenderViewChips, nwShowEmptyState |
| [`nwDeviceRenderSignature`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11103) | devices | JSON.stringify, devices.map |
| [`withoutAge`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11104) | value | Array.isArray |
| [`nwReloadDevices`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11126) | opts | Array.isArray, String, console.error, document.getElementById, nwApplyFiltersAndRender, nwCaptureDeviceFocus, nwDeviceRenderSignature, nwFetchDevices, nwRenderSidebarNav, nwRestoreDeviceFocus, nwShowEmptyState, nwSyncOpenPopoverFeedback |
| [`nwRefreshDevicesSoon`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11163) | delayMs | Math.max, Number, clearTimeout, setTimeout |
| [`nwStartAutoRefresh`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11182) | intervalMs | setInterval |
| [`nwStopAutoRefresh`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11196) | – | clearInterval |
| [`nwInitMenu`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11207) | – | document.addEventListener, document.getElementById, menu.addEventListener, menuBtn.addEventListener |
| [`close`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11228) | – | menu.classList.add |
| [`toggle`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11235) | – | menu.classList.toggle |
| [`nwLoadUiConfigFlags`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11252) | – | Array.isArray, Math.max, Math.round, Number, document.getElementById, fetch, l.classList.toggle, sc.evcsList.filter, sfMenu.classList.toggle, sfTab.classList.toggle, sl.classList.toggle, t.classList.toggle |
| [`nwBootstrap`](../../../../../src-ts/runtime-executables/www/smarthome.ts#L11286) | – | document.addEventListener, document.getElementById, localStorage.removeItem, nwApplyTextSizeClass, nwInitMenu, nwLoadBoolLS, nwLoadFavoriteOverrides, nwLoadSmartHomeConfig, nwLoadTextSize, nwLoadUiConfigFlags, nwLoadViewMode, nwReloadDevices, nwStartAutoRefresh, viewsEl.classList.remove |
