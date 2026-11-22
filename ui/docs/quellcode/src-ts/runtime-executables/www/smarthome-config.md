# src-ts/runtime-executables/www/smarthome-config.ts

Ermöglicht Installern und Admins die Einrichtung von Etagen, Räumen, Geräten, Seiten und Szenen und speichert den gemeinsamen SmartHome-Vertrag.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/smarthome-config.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`nwShcfgDefaultSensorUiFromTemplate`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L149) | tpl | String, meta.includes |
| [`byId`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L168) | id | document.getElementById |
| [`nwEnsureShcfgUiState`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L177) | – | JSON.parse, Object.assign, localStorage.getItem |
| [`nwShcfgPersistLibCollapsed`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L245) | – | JSON.stringify, localStorage.setItem, nwEnsureShcfgUiState |
| [`nwShcfgGetTargetRoomIdForAdd`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L258) | – | nwEnsureShcfgUiState |
| [`nwShcfgGetRoomById`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L276) | roomId | Array.isArray, rooms.find |
| [`nwShcfgGetSelectedFloorIdForAddRoom`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L287) | – | Array.isArray, floors.find, nwEnsureShcfgUiState, rooms.find |
| [`nwNormalizeSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L318) | cfg | Array.isArray |
| [`nwEscapeHtml`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L338) | value | String |
| [`nwSortByOrder`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L355) | a, b | Number, Number.isFinite, String, aKey.localeCompare |
| [`nwShcNormalizeIconName`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L529) | value | String, s.toLowerCase |
| [`nwShcSafeBadgeText`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L619) | value | String, s.replace, s.slice |
| [`nwShcParseDynamicIcon`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L633) | rawValue | String, lower.startsWith, raw.slice, raw.toLowerCase |
| [`nwShcDynamicDeviceIconSvg`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L660) | kind, labelRaw | nwEscapeHtml, nwShcSafeBadgeText |
| [`nwShcRenderIconPreview`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L712) | previewEl, iconValue | String, nwShcDynamicDeviceIconSvg, nwShcNormalizeIconName, nwShcParseDynamicIcon |
| [`nwShcfgRenderIconPickerRow`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L935) | currentValue, onCommit, { showLabel = true, labelText = 'Icon' } | document.createElement, iconCustom.addEventListener, iconLine.appendChild, iconSelect.addEventListener, iconTop.appendChild, options.forEach, options.map, syncUiFromValue |
| [`commitIcon`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L978) | value | String, onCommit |
| [`setPreview`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L988) | value | nwShcRenderIconPreview |
| [`syncUiFromValue`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L997) | value | String, optionIds.has, setPreview |
| [`nwScheduleValidation`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1069) | – | clearTimeout, setTimeout |
| [`nwCssEscape`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1082) | value | String, s.replace, window.CSS.escape |
| [`nwEntityKey`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1093) | entity | – |
| [`nwPushIssue`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1105) | out, severity, title, message, entity | nwEntityKey, out.errors.push, out.warnings.push |
| [`nwLooksLikeDpId`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1130) | id | String, s.includes |
| [`nwValidateConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1143) | cfg | Array.isArray, devices.forEach, fns.forEach, rooms.forEach |
| [`chkDp`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1244) | label, dp | String, nwLooksLikeDpId, nwPushIssue |
| [`nwRenderValidationPanel`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1461) | result | badges.appendChild, document.createElement, document.getElementById, head.appendChild, host.appendChild, items.forEach |
| [`nwFocusEntity`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1564) | entity | document.querySelector, el.classList.add, el.classList.remove, el.scrollIntoView, nwCssEscape, setTimeout |
| [`nwApplyValidationToDom`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1595) | result | Object.keys, document.querySelectorAll |
| [`nwRunValidationNow`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1618) | – | nwApplyValidationToDom, nwRenderValidationPanel, nwValidateConfig |
| [`nwGetRoomLabel`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1631) | room | – |
| [`nwGetFunctionLabel`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1641) | fn | – |
| [`nwGetTypeLabel`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1651) | type | – |
| [`nwSetStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1672) | text, variant | document.getElementById, el.classList.add, el.classList.remove |
| [`nwMarkDirty`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1685) | dirty | document.getElementById, nwScheduleValidation, nwSetStatus |
| [`nwFetchSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1706) | – | console.error, console.warn, fetch, nwSetStatus, res.json |
| [`nwDownloadTextFile`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1736) | filename, text, mimeType | URL.createObjectURL, a.click, console.error, document.body.appendChild, document.createElement, setTimeout, window.NW_RUNTIME?.url |
| [`nwNormalizeImportedSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1759) | rawCfg | Array.isArray, Object.assign |
| [`nwSetPagesStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1782) | msg, type | document.getElementById, el.classList.add, el.classList.remove |
| [`nwNormalizePageObject`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1796) | p, idx | Array.isArray, Number.isFinite, String, p.funcIds.map, p.roomIds.map, p.types.map |
| [`nwParsePagesJson`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1825) | text | Array.isArray, JSON.parse, String, pages.sort, parsed.map, seen.add, seen.has |
| [`nwBuildDefaultPages`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1854) | cfg | Array.isArray, String, pages.push, roomsByFloor.get, roomsByFloor.has, roomsByFloor.set, roomsSorted.forEach, roomsSorted.map, sortedFloors.forEach, unassignedRooms.push |
| [`nwRenderPagesEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2028) | force | document.getElementById, nwPagesRenderEditor, nwPagesRenderList, nwPagesRenderStatus, nwPagesRenderTabs, nwParsePagesJson, nwShcState.pagesDraft.some |
| [`nwPagesRenderStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2072) | parsed | document.getElementById, st.classList.add, st.classList.contains, st.classList.remove |
| [`nwPagesRenderTabs`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2100) | – | document.getElementById, tabs.querySelectorAll |
| [`nwPagesBuildTree`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2122) | pages | arr.sort, byId.has, children.entries, children.get, children.has, children.set, roots.push, roots.sort |
| [`sortFn`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2149) | a, b | String |
| [`nwPagesFormatFilterSummary`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2161) | p | Array.isArray, parts.join, parts.push |
| [`nwPagesRenderList`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2178) | – | Array.isArray, document.createElement, document.getElementById, listEl.appendChild, nwPagesBuildTree, render |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2207) | arr, depth | Math.max, String, children.get, children.has, document.createElement, listEl.appendChild, nwEscapeHtml, nwPagesFormatFilterSummary, render, row.addEventListener, row.appendChild |
| [`nwSetSelectOptions`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2256) | selectEl, options, selectedValues, includeEmpty, emptyLabel | document.createElement, selectEl.appendChild |
| [`nwGetMultiSelectValues`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2283) | selectEl | Array.from |
| [`nwPagesGetSelectedPage`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2293) | – | – |
| [`nwPagesGetNewSeed`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2303) | – | – |
| [`nwPagesBuildEditorModel`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2315) | – | nwNormalizePageObject, nwPagesGetNewSeed, nwPagesGetSelectedPage |
| [`nwPagesRenderEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2330) | – | Array.from, Array.isArray, String, common.forEach, document.createElement, document.getElementById, funcs.map, funcs.sort, iconEl.appendChild, nwPagesBuildEditorModel, nwPagesBuildTree, nwSetSelectOptions, nwShcState.config.functions.slice, nwShcState.config.rooms.slice (weitere in der Quelle) |
| [`walk`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2372) | arr, depth | children.get, children.has, flat.push, walk |
| [`nwPagesSlugify`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2442) | s | String |
| [`nwPagesSetEditorStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2457) | msg, kind | document.getElementById, el.classList.add, el.classList.remove |
| [`nwPagesSaveFromEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2472) | – | Array.isArray, JSON.stringify, Number.isFinite, String, byId.get, document.getElementById, next.map, next.push, next.sort, nwGetMultiSelectValues, nwMarkDirty, nwNormalizePageObject, nwPagesSetEditorStatus, nwRenderPagesEditor (weitere in der Quelle) |
| [`nwPagesDeleteSelected`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2580) | – | Array.isArray, JSON.stringify, confirm, document.getElementById, nwMarkDirty, nwPagesSetEditorStatus, nwRenderPagesEditor, nwShcState.pagesDraft.slice |
| [`nwSetBackupStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2613) | msg, type | document.getElementById, el.classList.add, el.classList.remove |
| [`nwBackupExport`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2627) | – | JSON.stringify, fetch, nwDownloadTextFile, nwSetBackupStatus, res.json |
| [`nwBackupImport`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2643) | file, mode | JSON.parse, JSON.stringify, fetch, file.text, nwSetBackupStatus, res.json |
| [`nwBackupRestoreFromUserdata`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2664) | – | JSON.stringify, confirm, fetch, nwSetBackupStatus, res.json, res2.json |
| [`nwExportSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2687) | – | JSON.stringify, nwDownloadTextFile, nwNormalizeImportedSmartHomeConfig, nwSetStatus |
| [`nwImportSmartHomeConfigFromFile`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2709) | file | JSON.parse, JSON.stringify, confirm, console.error, file.text, nwMarkDirty, nwNormalizeDeviceOrder, nwNormalizeImportedSmartHomeConfig, nwNormalizeRoomFunctionOrder, nwRenderAll, nwRenderPagesEditor, nwSaveSmartHomeConfig, nwSetStatus, text.trim |
| [`nwSaveSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2773) | – | Array.isArray, JSON.stringify, confirm, console.error, fetch, nwMarkDirty, nwParsePagesJson, nwRenderAll, nwRenderPagesEditor, nwRunValidationNow, nwSetStatus, res.json |
| [`nwReloadSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2847) | – | Array.isArray, JSON.stringify, Object.assign, cfg.devices.map, cfg.floors.map, cfg.functions.map, cfg.pages.map, cfg.rooms.map, cfg.scenes.map, nwFetchSmartHomeConfig, nwMarkDirty, nwNormalizeDeviceOrder, nwNormalizeFloorOrder, nwNormalizeRoomFunctionOrder (weitere in der Quelle) |
| [`nwRenderAll`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2888) | – | nwRenderDevicesEditor, nwRenderFunctionsEditor, nwRenderRoomsEditor, nwRenderShcfgShell, nwScheduleValidation |
| [`nwShcfgSetMode`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2911) | mode, opts | allowed.includes, localStorage.setItem, nwEnsureShcfgUiState, nwRenderShcfgShell, setTimeout |
| [`nwShcfgEnterBuilder`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2941) | opts | devices.filter, nwEnsureShcfgUiState, nwShcfgSetMode |
| [`nwInitShcfgShellUi`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2974) | – | backupBack.addEventListener, backupOpenClassic.addEventListener, btnBackup.addEventListener, btnBuilding.addEventListener, btnClassic.addEventListener, btnDetect.addEventListener, btnLogic.addEventListener, btnScenes.addEventListener, btnTimers.addEventListener, builderBack.addEventListener, builderOpenClassic.addEventListener, builderSave.addEventListener, clocksAdd.addEventListener, detectBack.addEventListener (weitere in der Quelle) |
| [`nwShcfgApplyBuilderSizing`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3090) | – | Math.floor, Math.max, builder.querySelector, document.getElementById, layout.getBoundingClientRect, layout.style.setProperty |
| [`nwRenderShcfgShell`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3108) | – | document.getElementById, nwEnsureShcfgUiState, nwLoadTypeDetectorSuggestions, nwRenderShcfgBuilder, nwRenderShcfgDetector, nwRenderShcfgScenes, nwRenderShcfgTimers, setTimeout |
| [`nwSetDetectorStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3164) | text, kind | byId, el.classList.add, el.classList.remove |
| [`nwLoadTypeDetectorSuggestions`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3179) | force | Array.isArray, Date.now, Number, Number.isFinite, String, fetch, nwSetDetectorStatus, res.json |
| [`nwShcfgGetDetectorAssignment`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3217) | suggestionId | Array.isArray |
| [`nwShcfgCloneJson`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3239) | value, fallback | JSON.parse, JSON.stringify |
| [`nwShcfgDetectorMatchesFilter`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3252) | suggestion, term | Array.isArray, String, parts.join, parts.push, states.forEach |
| [`nwShcfgAcceptDetectedAssignment`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3280) | suggestion, assignment | Array.isArray, String, additions.forEach, additions.push, existing.some |
| [`nwShcfgDraftContainsSuggestion`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3300) | suggestion | – |
| [`nwImportTypeDetectedSuggestion`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3311) | suggestionId | Array.isArray, Object.assign, String, det.results.find, nwAddDeviceFromTemplate, nwMarkDirty, nwNormalizeDeviceOrder, nwRenderAll, nwSetDetectorStatus, nwShcfgAcceptDetectedAssignment, nwShcfgCloneJson, nwShcfgDraftContainsSuggestion, nwShcfgGetDetectorAssignment |
| [`nwShcfgImportFieldAllowed`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3376) | path | path.split |
| [`nwShcfgImportFieldValue`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3381) | device, path | String |
| [`nwApplyTypeDetectedUpdate`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3390) | suggestionId, selectedPaths | Array.from, Array.isArray, Number.isFinite, change.path.split, changes.push, devices.findIndex, keys.pop, nwMarkDirty, nwRenderAll, nwSetDetectorStatus, nwShcfgCloneJson, nwShcfgImportFieldAllowed, nwShcfgImportFieldValue |
| [`nwRenderShcfgDetector`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3437) | – | Array.isArray, Number, Number.isFinite, byId, cfg.functions.slice, cfg.rooms.slice, det.results.slice, document.createElement, filterInput.addEventListener, mkBadge, results.filter, root.appendChild, showConfigured.addEventListener, showConfiguredLabel.appendChild (weitere in der Quelle) |
| [`mkBadge`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3506) | cls, text | document.createElement |
| [`format`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3665) | value | String |
| [`mkSelect`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3718) | labelText, items, value, onChange | document.createElement, items.forEach, sel.addEventListener, sel.appendChild, wrap.appendChild |
| [`withSuggestions`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3746) | existing, candidates | Array.isArray, existing.slice |
| [`nwSetTimersStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3796) | text, kind | byId, el.classList.add, el.classList.remove |
| [`nwShcfgCollectTimerDevicesFromConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3815) | cfg | Array.isArray, Object.create, String, idSet.add, idSet.has, out.push |
| [`nwLoadTimersModule`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3890) | force | Array.isArray, Object.assign, String, console.warn, devices.filter, fetch, nwFetchSmartHomeConfig, nwNormalizeImportedSmartHomeConfig, nwSetTimersStatus, nwShcfgCollectTimerDevicesFromConfig, tRes.json |
| [`nwSaveTimersModule`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3946) | – | Array.isArray, JSON.stringify, Object.assign, Object.keys, String, console.warn, fetch, nwLoadTimersModule, nwSetTimersStatus, res.json |
| [`nwRenderShcfgTimers`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4007) | – | Array.isArray, Object.assign, String, b.addEventListener, byId, card.appendChild, cb.addEventListener, ctrl.appendChild, del.addEventListener, devices.slice, document.createElement, grid.appendChild, inp.addEventListener, lab.appendChild (weitere in der Quelle) |
| [`markDirty`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4092) | – | Object.assign, nwSetTimersStatus |
| [`sync`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4160) | – | Array.from, timer.days.sort |
| [`mk`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4203) | labelText, value, onChange | document.createElement, inp.addEventListener, wrap.appendChild |
| [`nwSetLogicClocksStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4293) | text, kind | byId, el.classList.add, el.classList.remove |
| [`nwAddLogicClock`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4308) | – | Date.now, Math.random, nwSetLogicClocksStatus |
| [`nwLoadLogicClocksModule`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4333) | force | Array.isArray, Object.assign, String, console.warn, fetch, nwSetLogicClocksStatus, res.json |
| [`nwSaveLogicClocksModule`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4369) | – | Array.isArray, JSON.stringify, Object.assign, Object.keys, String, console.warn, fetch, nwLoadLogicClocksModule, nwSetLogicClocksStatus, res.json |
| [`nwRenderShcfgLogicClocks`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4421) | – | Array.isArray, Object.keys, b.addEventListener, byId, card.appendChild, cb.addEventListener, ctrl.appendChild, del.addEventListener, document.createElement, grid.appendChild, inp.addEventListener, lab.appendChild, mk, nwLoadLogicClocksModule (weitere in der Quelle) |
| [`markDirty`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4463) | – | nwSetLogicClocksStatus |
| [`sync`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4576) | – | Array.from, clock.days.sort |
| [`mk`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4618) | labelText, value, onChange | document.createElement, inp.addEventListener, wrap.appendChild |
| [`nwSetScenesStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4678) | text, kind | byId, el.classList.add, el.classList.remove |
| [`nwAddScene`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4693) | – | Array.isArray, Date.now, Math.random, cfg.scenes.push, nwSetScenesStatus |
| [`nwRenderShcfgScenes`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4719) | – | Array.isArray, addBtn.addEventListener, btnRow.appendChild, byId, card.appendChild, cb.addEventListener, ctrl.appendChild, del.addEventListener, document.createElement, inp.addEventListener, lab.appendChild, renderActionRow, root.appendChild, row.appendChild (weitere in der Quelle) |
| [`markDirty`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4765) | – | nwSetScenesStatus |
| [`renderActionRow`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4933) | a, idx | String, boolSel.addEventListener, boolSel.appendChild, coverSel.addEventListener, coverSel.appendChild, delBtn.addEventListener, devSel.addEventListener, devSel.appendChild, document.createElement, input.addEventListener, kindSel.addEventListener, kindSel.appendChild, playerSel.addEventListener, playerSel.appendChild (weitere in der Quelle) |
| [`nwShcfgDragSet`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5232) | e, payload | JSON.stringify, dt.setData, nwEnsureShcfgUiState |
| [`nwShcfgDragClear`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5257) | – | nwEnsureShcfgUiState |
| [`nwShcfgDragGet`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5272) | e | JSON.parse, dt.getData, nwEnsureShcfgUiState, raw.slice, raw.startsWith |
| [`nwRenderShcfgBuilder`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5306) | – | document.getElementById, document.querySelectorAll, nwEnsureShcfgUiState, nwRenderShcfgBuilderLib, nwRenderShcfgBuilderProps, nwRenderShcfgBuilderWorkspace, tabBtns.forEach |
| [`nwShcfgLibGroup`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5340) | titleText, items, { forceOpen = false } | details.addEventListener, details.appendChild, document.createElement, items.forEach, nwEnsureShcfgUiState, sumLeft.appendChild, summary.appendChild |
| [`nwShcfgLibItem`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5399) | { icon, name, meta, payload } | document.createElement, item.addEventListener, item.appendChild, left.appendChild, nwShcRenderIconPreview, textWrap.appendChild |
| [`nwRenderShcfgBuilderLib`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5503) | container | container.appendChild, document.createElement, input.addEventListener, nwShcfgLibGroup, nwShcfgLibItem, renderGroups, row.appendChild, searchWrap.appendChild |
| [`renderGroups`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5584) | – | String, byGroup.get, byGroup.has, byGroup.keys, byGroup.set, document.createElement, filterRaw.trim, groups.forEach, groupsWrap.appendChild, hay.includes, nwShcfgGetRoomById, nwShcfgGetTargetRoomIdForAdd, preferredOrder.filter |
| [`nwShcfgAddRoom`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5661) | { name = 'Neuer Raum', floorId = null, icon = 'generic' } | nwEnsureUniqueId, nwMarkDirty, nwNormalizeRoomOrder, nwPagesSlugify, rooms.push |
| [`nwShcfgAddFloor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5719) | presetId | floors.push, floors.reduce, nwEnsureUniqueId, nwMarkDirty, nwNormalizeFloorOrder, nwPagesSlugify |
| [`nwShcfgMoveRoomToFloor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5747) | roomId, floorId | nwMarkDirty, nwNormalizeRoomOrder, rooms.find |
| [`nwRenderShcfgBuilderWorkspace`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5773) | container | addFloorBtn.addEventListener, backBtn.addEventListener, container.appendChild, container.classList.remove, crumbs.appendChild, devices.filter, document.createElement, drop.addEventListener, floorList.forEach, floorList.push, floors.map, left.appendChild, nwRenderShcfgBuilderWorkspace, right.appendChild (weitere in der Quelle) |
| [`nwShcfgCreateSelect`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6263) | options, value, onChange | document.createElement, options.forEach, sel.addEventListener |
| [`nwShcfgCreateTextInput`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6283) | value, onChange, { placeholder = '' } | document.createElement, input.addEventListener |
| [`nwShcfgNullIfEmpty`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6299) | v | – |
| [`nwRenderShcfgBuilderProps`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6309) | container | Array.isArray, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String, addBehavior, addDp, addNumber, addSelect, addText, cfg.floors.slice, container.appendChild, del.addEventListener, devices.find (weitere in der Quelle) |
| [`ensureObject`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6639) | parent, key, defaults | Array.isArray, Object.keys |
| [`addDp`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6646) | label, owner, key | container.appendChild, nwCreateDpInput |
| [`addNumber`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6652) | label, owner, key, fallback, min, max, step | Number, Number.isFinite, String, container.appendChild, document.createElement, input.addEventListener, nwCreateFieldRow |
| [`addSelect`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6672) | label, owner, key, options, fallback | String, container.appendChild, nwCreateFieldRow, nwShcfgCreateSelect |
| [`addText`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6678) | label, owner, key, placeholder | container.appendChild, nwCreateFieldRow, nwShcfgCreateTextInput |
| [`addBehavior`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6684) | – | addNumber |
| [`nwSanitizeId`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6893) | raw | String, s.replace |
| [`nwEnsureUniqueId`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6910) | items, desiredId, skipItem | Array.isArray, exists, nwSanitizeId |
| [`exists`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6918) | candidate | list.some |
| [`nwNormalizeRoomFunctionOrder`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6937) | – | normalize, nwNormalizeRoomOrder |
| [`normalize`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6945) | arr, labelFn | Array.isArray, arr.slice, out.forEach, source.map, withIdx.map, withIdx.sort |
| [`nwMoveItem`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6974) | arr, index, dir | Array.isArray, arr.forEach, arr.splice |
| [`nwMoveItemTo`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6990) | arr, fromIndex, toIndex | Array.isArray, Math.trunc, Number.isFinite, arr.forEach, arr.splice |
| [`nwReplaceRoomIdInDevices`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7015) | oldId, newId | Array.isArray, nwShcState.config.devices.forEach |
| [`nwReplaceFunctionIdInDevices`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7027) | oldId, newId | Array.isArray, nwShcState.config.devices.forEach |
| [`nwAddRoom`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7039) | – | Array.isArray, nwEnsureUniqueId, nwMarkDirty, nwRenderAll, rooms.push |
| [`nwAddFunction`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7055) | – | Array.isArray, funcs.push, nwEnsureUniqueId, nwMarkDirty, nwRenderAll |
| [`nwRenderRoomsEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7071) | rooms | Array.isArray, arr.forEach, document.getElementById |
| [`nwRenderFunctionsEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7203) | functions | Array.isArray, arr.forEach, document.getElementById |
| [`nwNormalizeFloorOrder`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7340) | – | Array.isArray, floors.forEach, floors.sort |
| [`nwNormalizeRoomOrder`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7370) | – | Array.isArray, buckets.get, buckets.has, buckets.set, list.forEach, rooms.forEach |
| [`nwNormalizeDeviceOrder`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7413) | – | Array.isArray, arr.forEach |
| [`nwEnsureUniqueDeviceId`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7426) | devices, desiredId | Array.isArray, String, base.trim, list.some |
| [`nwAddDevice`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7445) | – | Array.isArray, devices.push, nwEnsureUniqueDeviceId, nwMarkDirty, nwNormalizeDeviceOrder, nwRenderAll |
| [`nwAddDeviceFromTemplate`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7483) | templateId, opts | Array.isArray, NW_SHCFG_BUILDER_DEVICE_TEMPLATES.find, Object.assign, Object.prototype.hasOwnProperty.call, String, devices.push, document.getElementById, nwEnsureUniqueDeviceId, nwMarkDirty, nwNormalizeDeviceOrder, nwRenderAll, nwSetStatus, nwShcfgDefaultSensorUiFromTemplate, nwShcfgNullIfEmpty |
| [`nwCreateFieldRow`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7661) | labelText, controlElem | ctlWrap.appendChild, document.createElement, row.appendChild |
| [`nwDpFormatValueShort`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7686) | val | JSON.stringify, Math.abs, Math.round, Number.isFinite, String, s.slice |
| [`nwDpGetState`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7713) | dpId | String, encodeURIComponent, fetch, res.json |
| [`nwDpSetState`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7730) | dpId, val | JSON.stringify, String, fetch, res.json |
| [`nwCreateDpInput`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7751) | labelText, value, onChange | String, btnPick.addEventListener, btnSet.addEventListener, btnTest.addEventListener, document.createElement, input.addEventListener, labelLower.includes, nwCreateFieldRow, window.NW_AUTH.hasCapability, wrapper.appendChild |
| [`onSelect`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7779) | id | input.value.trim, nwMarkDirty, onChange |
| [`setBadge`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7803) | kind, text | badge.classList.add, badge.classList.remove |
| [`nwRenderDevicesEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7926) | devices, rooms, functions | devices.forEach, document.getElementById, functions.forEach, rooms.forEach |
| [`setCustomVisible`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8381) | on | – |
| [`syncIconUi`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8390) | – | String, iconOptions.some, nwShcNormalizeIconName, nwShcRenderIconPreview, setCustomVisible |
| [`renderStations`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9187) | – | Array.isArray, stations.forEach |
| [`renderPlaylists`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9283) | – | Array.isArray, playlists.forEach |
| [`nwDpSafeStr`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9547) | value | String |
| [`nwDpFetchJson`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9556) | url | fetch, res.json |
| [`nwDpSearch`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9570) | q | Array.isArray, encodeURIComponent, nwDpFetchJson, nwDpSafeStr |
| [`nwDpTree`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9581) | prefix | Array.isArray, encodeURIComponent, nwDpFetchJson, nwDpSafeStr |
| [`nwDpParentPrefix`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9592) | id | nwDpSafeStr, parts.join, parts.pop |
| [`nwDpMetaText`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9604) | it | String, parts.join, parts.push |
| [`nwCreateDpResultRow`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9618) | primary, meta, onActivate | document.createElement, nwDpSafeStr, row.addEventListener, row.appendChild |
| [`activate`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9646) | ev | ev.preventDefault, ev.stopPropagation, onActivate |
| [`nwRenderDpBreadcrumb`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9669) | prefix, wrap, onNavigate | mkCrumb, mkSep, nwDpSafeStr, wrap.appendChild |
| [`mkCrumb`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9680) | label, nextPrefix, clickable | btn.addEventListener, document.createElement |
| [`mkSep`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9706) | – | document.createElement |
| [`nwEnsureDpDialog`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9729) | – | backdrop.addEventListener, backdrop.appendChild, body.appendChild, btnClose.addEventListener, columns.appendChild, dlg.appendChild, document.body.appendChild, document.createElement, header.appendChild, input.addEventListener, resultsCol.appendChild, rootBtn.addEventListener, searchBtn.addEventListener, searchRow.appendChild (weitere in der Quelle) |
| [`nwSetDpDialogTreeMessage`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9890) | text, kind | nwEnsureDpDialog, nwEscapeHtml |
| [`nwSetDpDialogResultsMessage`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9903) | text, kind | nwEnsureDpDialog, nwEscapeHtml |
| [`nwDpDialogPick`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9915) | id | nwCloseDatapointDialog, nwDpDialogCurrent.onSelect, nwDpSafeStr |
| [`nwRenderDpDialogTree`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9929) | children | Array.isArray, children.forEach, nwCreateDpResultRow, nwEnsureDpDialog, wrap.appendChild |
| [`nwRenderDpDialogResults`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9980) | list | Array.isArray, list.forEach, nwEnsureDpDialog |
| [`nwRefreshDpDialogTree`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10007) | – | nwDpTree, nwEnsureDpDialog, nwRenderDpBreadcrumb, nwRenderDpDialogTree, nwSetDpDialogTreeMessage |
| [`nwRunDatapointDialogSearch`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10031) | – | nwDpSafeStr, nwDpSearch, nwEnsureDpDialog, nwRenderDpDialogResults, nwSetDpDialogResultsMessage |
| [`nwOpenDpDialogPrefix`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10055) | prefix | nwDpSafeStr, nwEnsureDpDialog, nwRefreshDpDialogTree |
| [`nwOpenDatapointDialog`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10066) | options | String, nwDpParentPrefix, nwEnsureDpDialog, nwRefreshDpDialogTree, nwRenderDpBreadcrumb, nwRunDatapointDialogSearch, nwSetDpDialogResultsMessage, nwSetDpDialogTreeMessage, setTimeout, state.input.value.trim |
| [`nwCloseDatapointDialog`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10101) | – | – |
| [`nwAttachToolbarHandlers`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10115) | – | addDeviceBtn.addEventListener, addFnBtn.addEventListener, addRoomBtn.addEventListener, addTplBtn.addEventListener, backupImportFile.addEventListener, btnBackupExport.addEventListener, btnPagesClear.addEventListener, btnPagesDefault.addEventListener, btnPagesValidate.addEventListener, btnRestoreUserdata.addEventListener, document.getElementById, exportBtn.addEventListener, importBtn.addEventListener, importFile.addEventListener (weitere in der Quelle) |
| [`nwInitSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10459) | – | document.getElementById, fetch, nwAttachToolbarHandlers, nwInitShcfgShellUi, nwReloadSmartHomeConfig |
