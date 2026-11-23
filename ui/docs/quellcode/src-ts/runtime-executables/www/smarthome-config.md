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
| [`nwShcNormalizeIconName`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L529) | value | Object.hasOwn, String, s.toLowerCase |
| [`nwShcSafeBadgeText`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L619) | value | String, s.replace, s.slice |
| [`nwShcParseDynamicIcon`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L633) | rawValue | String, lower.startsWith, raw.slice, raw.toLowerCase |
| [`nwShcDynamicDeviceIconSvg`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L660) | kind, labelRaw | nwEscapeHtml, nwShcSafeBadgeText |
| [`nwShcRenderIconPreview`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L712) | previewEl, iconValue | Object.hasOwn, String, normalized.slice, normalized.startsWith, nwShcDynamicDeviceIconSvg, nwShcNormalizeIconName, nwShcParseDynamicIcon |
| [`nwShcfgRenderIconPickerRow`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L936) | currentValue, onCommit, { showLabel = true, labelText = 'Icon' } | document.createElement, iconCustom.addEventListener, iconLine.appendChild, iconSelect.addEventListener, iconTop.appendChild, options.forEach, options.map, syncUiFromValue |
| [`commitIcon`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L979) | value | String, onCommit |
| [`setPreview`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L989) | value | nwShcRenderIconPreview |
| [`syncUiFromValue`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L998) | value | String, optionIds.has, setPreview |
| [`nwScheduleValidation`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1070) | – | clearTimeout, setTimeout |
| [`nwCssEscape`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1083) | value | String, s.replace, window.CSS.escape |
| [`nwEntityKey`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1094) | entity | – |
| [`nwPushIssue`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1106) | out, severity, title, message, entity | nwEntityKey, out.errors.push, out.warnings.push |
| [`nwLooksLikeDpId`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1131) | id | String, s.includes |
| [`nwValidateConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1144) | cfg | Array.isArray, devices.forEach, fns.forEach, rooms.forEach |
| [`chkDp`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1248) | label, dp | String, nwLooksLikeDpId, nwPushIssue |
| [`nwRenderValidationPanel`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1465) | result | badges.appendChild, document.createElement, document.getElementById, head.appendChild, host.appendChild, items.forEach |
| [`nwFocusEntity`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1568) | entity | document.querySelector, el.classList.add, el.classList.remove, el.scrollIntoView, nwCssEscape, setTimeout |
| [`nwApplyValidationToDom`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1599) | result | Object.keys, document.querySelectorAll |
| [`nwRunValidationNow`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1622) | – | nwApplyValidationToDom, nwRenderValidationPanel, nwValidateConfig |
| [`nwGetRoomLabel`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1635) | room | – |
| [`nwGetFunctionLabel`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1645) | fn | – |
| [`nwGetTypeLabel`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1655) | type | Object.hasOwn |
| [`nwSetStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1677) | text, variant | document.getElementById, el.classList.add, el.classList.remove |
| [`nwMarkDirty`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1690) | dirty | document.getElementById, nwScheduleValidation, nwSetStatus |
| [`nwFetchSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1711) | – | console.error, console.warn, fetch, nwSetStatus, res.json |
| [`nwDownloadTextFile`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1741) | filename, text, mimeType | URL.createObjectURL, a.click, console.error, document.body.appendChild, document.createElement, setTimeout, window.NW_RUNTIME?.url |
| [`nwNormalizeImportedSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1764) | rawCfg | Array.isArray, Object.assign |
| [`nwSetPagesStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1787) | msg, type | document.getElementById, el.classList.add, el.classList.remove |
| [`nwNormalizePageObject`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1801) | p, idx | Array.isArray, Number.isFinite, String, p.funcIds.map, p.roomIds.map, p.types.map |
| [`nwParsePagesJson`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1830) | text | Array.isArray, JSON.parse, String, pages.sort, parsed.map, seen.add, seen.has |
| [`nwBuildDefaultPages`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L1859) | cfg | Array.isArray, String, pages.push, roomsByFloor.get, roomsByFloor.has, roomsByFloor.set, roomsSorted.forEach, roomsSorted.map, sortedFloors.forEach, unassignedRooms.push |
| [`nwRenderPagesEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2033) | force | document.getElementById, nwPagesRenderEditor, nwPagesRenderList, nwPagesRenderStatus, nwPagesRenderTabs, nwParsePagesJson, nwShcState.pagesDraft.some |
| [`nwPagesRenderStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2077) | parsed | document.getElementById, st.classList.add, st.classList.contains, st.classList.remove |
| [`nwPagesRenderTabs`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2105) | – | document.getElementById, tabs.querySelectorAll |
| [`nwPagesBuildTree`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2127) | pages | arr.sort, byId.has, children.entries, children.get, children.has, children.set, roots.push, roots.sort |
| [`sortFn`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2154) | a, b | String |
| [`nwPagesFormatFilterSummary`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2166) | p | Array.isArray, parts.join, parts.push |
| [`nwPagesRenderList`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2183) | – | Array.isArray, document.createElement, document.getElementById, listEl.appendChild, nwPagesBuildTree, render |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2212) | arr, depth | Math.max, String, children.get, children.has, document.createElement, listEl.appendChild, nwEscapeHtml, nwPagesFormatFilterSummary, render, row.addEventListener, row.appendChild |
| [`nwSetSelectOptions`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2261) | selectEl, options, selectedValues, includeEmpty, emptyLabel | document.createElement, selectEl.appendChild |
| [`nwGetMultiSelectValues`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2288) | selectEl | Array.from |
| [`nwPagesGetSelectedPage`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2298) | – | – |
| [`nwPagesGetNewSeed`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2308) | – | – |
| [`nwPagesBuildEditorModel`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2320) | – | nwNormalizePageObject, nwPagesGetNewSeed, nwPagesGetSelectedPage |
| [`nwPagesRenderEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2335) | – | Array.from, Array.isArray, String, common.forEach, document.createElement, document.getElementById, funcs.map, funcs.sort, iconEl.appendChild, nwPagesBuildEditorModel, nwPagesBuildTree, nwSetSelectOptions, nwShcState.config.functions.slice, nwShcState.config.rooms.slice (weitere in der Quelle) |
| [`walk`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2377) | arr, depth | children.get, children.has, flat.push, walk |
| [`nwPagesSlugify`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2447) | s | String |
| [`nwPagesSetEditorStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2462) | msg, kind | document.getElementById, el.classList.add, el.classList.remove |
| [`nwPagesSaveFromEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2477) | – | Array.isArray, JSON.stringify, Number.isFinite, String, byId.get, document.getElementById, next.map, next.push, next.sort, nwGetMultiSelectValues, nwMarkDirty, nwNormalizePageObject, nwPagesSetEditorStatus, nwRenderPagesEditor (weitere in der Quelle) |
| [`nwPagesDeleteSelected`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2585) | – | Array.isArray, JSON.stringify, confirm, document.getElementById, nwMarkDirty, nwPagesSetEditorStatus, nwRenderPagesEditor, nwShcState.pagesDraft.slice |
| [`nwSetBackupStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2618) | msg, type | document.getElementById, el.classList.add, el.classList.remove |
| [`nwBackupExport`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2632) | – | JSON.stringify, fetch, nwDownloadTextFile, nwSetBackupStatus, res.json |
| [`nwBackupImport`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2648) | file, mode | JSON.parse, JSON.stringify, fetch, file.text, nwSetBackupStatus, res.json |
| [`nwBackupRestoreFromUserdata`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2672) | – | JSON.stringify, confirm, fetch, nwSetBackupStatus, res.json, res2.json |
| [`nwExportSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2699) | – | JSON.stringify, nwDownloadTextFile, nwNormalizeImportedSmartHomeConfig, nwSetStatus |
| [`nwImportSmartHomeConfigFromFile`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2721) | file | JSON.parse, JSON.stringify, confirm, console.error, file.text, nwMarkDirty, nwNormalizeDeviceOrder, nwNormalizeImportedSmartHomeConfig, nwNormalizeRoomFunctionOrder, nwRenderAll, nwRenderPagesEditor, nwSaveSmartHomeConfig, nwSetStatus, text.trim |
| [`nwSaveSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2788) | – | Array.isArray, JSON.stringify, confirm, console.error, document.getElementById, fetch, nwMarkDirty, nwParsePagesJson, nwRenderAll, nwRenderPagesEditor, nwRunValidationNow, nwSetStatus, nwShcfgControlEditorError, res.json |
| [`nwReloadSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2879) | – | Array.isArray, JSON.stringify, Object.assign, cfg.devices.map, cfg.floors.map, cfg.functions.map, cfg.pages.map, cfg.rooms.map, cfg.scenes.map, nwFetchSmartHomeConfig, nwMarkDirty, nwNormalizeDeviceOrder, nwNormalizeFloorOrder, nwNormalizeRoomFunctionOrder (weitere in der Quelle) |
| [`nwRenderAll`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2924) | – | nwRenderShcfgShell, nwScheduleValidation |
| [`nwShcfgSetMode`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2943) | mode, opts | allowed.includes, localStorage.setItem, nwEnsureShcfgUiState, nwRenderShcfgShell, setTimeout |
| [`nwShcfgEnterBuilder`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L2974) | opts | devices.filter, nwEnsureShcfgUiState, nwShcfgSetMode |
| [`nwInitShcfgShellUi`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3007) | – | backupBack.addEventListener, backupOpenClassic.addEventListener, bindStep, btnBackup.addEventListener, btnBuilding.addEventListener, btnClassic.addEventListener, btnDetect.addEventListener, btnLogic.addEventListener, btnScenes.addEventListener, btnTimers.addEventListener, builderBack.addEventListener, builderOpenClassic.addEventListener, builderSave.addEventListener, clocksAdd.addEventListener (weitere in der Quelle) |
| [`bindStep`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3108) | id, action | button.addEventListener, document.getElementById |
| [`nwShcfgApplyBuilderSizing`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3145) | – | Math.floor, Math.max, builder.querySelector, document.getElementById, layout.getBoundingClientRect, layout.style.setProperty |
| [`nwOpenSetupEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3165) | kind, entityId, templateId | Array.isArray, cancel, helper.cloneConfig, helper.hasDialog, helper.openDialog, nwAddDeviceFromTemplate, nwEnsureShcfgUiState, nwEnsureUniqueId, nwMarkDirty, nwSetStatus |
| [`cancel`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3193) | – | nwCloseDatapointDialog, nwMarkDirty, nwRenderAll |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3203) | body | nwRenderSetupEditorBody |
| [`onApply`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3205) | – | JSON.stringify, String, nwCloseDatapointDialog, nwMarkDirty, nwRenderAll, nwShcfgControlEditorError, tx.handle?.setError |
| [`nwRenderSetupEditorBody`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3227) | body, tx | body.appendChild, body.replaceChildren, document.createElement, nwCompactDeviceProperties, nwCreateFieldRow, nwRenderShcfgBuilderProps, nwShcfgCreateSelect, options.push, options.some |
| [`nwRenderSetupWorkspace`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3249) | – | document.getElementById, helper.mountSetup |
| [`onEdit`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3254) | kind, id | nwOpenSetupEditor |
| [`onAdd`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3254) | kind | nwOpenSetupEditor |
| [`onDetect`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3254) | – | nwShcfgSetMode |
| [`nwOpenDetectedDetails`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3256) | suggestionId | helper.hasDialog, helper.openDialog |
| [`render`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3261) | body | nwRenderShcfgDetectorDetails |
| [`beforeClose`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3261) | – | – |
| [`onCancel`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3261) | – | – |
| [`nwRenderShcfgDetector`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3263) | – | alias.canCreate, byId, helper.mountDetection |
| [`onImport`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3272) | ids, roomId | nwImportTypeDetectedBatch |
| [`nwImportTypeDetectedBatch`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3276) | selectedIds, targetRoomId | Array.isArray, JSON.stringify, Object.assign, String, alias.canCreate, alias.create, devices.push, devices.reduce, helper.cloneConfig, helper.hasDialog, nwAddDeviceFromTemplate, nwMarkDirty, nwNormalizeDeviceOrder, nwRenderAll (weitere in der Quelle) |
| [`nwRenderShcfgDeviceWorkspace`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3327) | – | nwRenderSetupWorkspace |
| [`nwRenderShcfgLayoutWorkspace`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3329) | – | Array.isArray, devices.map, document.getElementById, helper.mount |
| [`onChange`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3338) | patches | Array.isArray, Number.isFinite, baseline.get, baseline.set, changes.push, nwMarkDirty, nwSetStatus, seen.add, seen.has |
| [`nwCompactDeviceProperties`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3355) | container | Array.from, container.appendChild, container.querySelector, document.createElement, legacy.appendChild, marker.remove, node.classList.contains |
| [`nwRenderShcfgShell`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3370) | – | button.removeAttribute, button.setAttribute, document.getElementById, editor.handle?.refresh, legacy.replaceChildren, nwEnsureShcfgUiState, nwLoadTypeDetectorSuggestions, nwRenderDevicesEditor, nwRenderFunctionsEditor, nwRenderRoomsEditor, nwRenderSetupWorkspace, nwRenderShcfgBuilder, nwRenderShcfgDetector, nwRenderShcfgLayoutWorkspace (weitere in der Quelle) |
| [`nwSetDetectorStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3451) | text, kind | byId, el.classList.add, el.classList.remove, nwShcState.ui.detectorDialog.refresh, nwShcState.ui?.detectorDialog?.isOpen |
| [`nwLoadTypeDetectorSuggestions`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3467) | force | Array.isArray, Date.now, JSON.stringify, Number, Number.isFinite, String, nwSetDetectorStatus, window.NW_SH_SETUP.readDetection |
| [`nwShcfgGetDetectorAssignment`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3509) | suggestionId | Array.isArray |
| [`nwShcfgCloneJson`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3531) | value, fallback | JSON.parse, JSON.stringify |
| [`nwShcfgDetectorMatchesFilter`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3544) | suggestion, term | Array.isArray, String, parts.join, parts.push, states.forEach |
| [`nwShcfgAcceptDetectedAssignment`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3572) | suggestion, assignment, commit | Array.isArray, String, additions.forEach, additions.push, existing.some |
| [`nwShcfgDraftContainsSuggestion`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3593) | suggestion | Array.isArray, coreStates.map |
| [`nwImportTypeDetectedSuggestion`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3610) | suggestionId | Array.isArray, Object.assign, String, aliasHelper.canCreate, aliasHelper.create, config.devices.push, currentResults.includes, det.results.find, nwAddDeviceFromTemplate, nwMarkDirty, nwNormalizeDeviceOrder, nwRenderAll, nwRenderShcfgDetector, nwSetDetectorStatus (weitere in der Quelle) |
| [`nwShcfgImportFieldAllowed`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3675) | path | path.split |
| [`nwShcfgImportFieldValue`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3682) | device, path | Array.isArray, String, fields.find |
| [`nwApplyTypeDetectedUpdate`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3697) | suggestionId, selectedPaths, options | Array.from, Array.isArray, Number.isFinite, change.path.split, changes.push, controls.fields.filter, controls.fields.find, controls.fields.push, devices.findIndex, keys.pop, nwMarkDirty, nwRenderAll, nwSetDetectorStatus, nwShcfgCloneJson (weitere in der Quelle) |
| [`nwApplyTypeDetectedUpdateWithAliases`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3761) | suggestionId, selectedPaths | Array.isArray, JSON.stringify, aliasHelper.canCreate, aliasHelper.create, nwApplyTypeDetectedUpdate, nwMarkDirty, nwRenderAll, nwRenderShcfgDetector, nwSetDetectorStatus, selectedPaths.slice, window.confirm |
| [`nwRenderShcfgDetectorDetails`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3803) | root, suggestionId | Array.isArray, Number, Number.isFinite, aliasCheck.addEventListener, aliasHelper.canCreate, aliases.appendChild, byId, cfg.functions.slice, cfg.rooms.slice, det.results.filter, document.createElement, filterInput.addEventListener, live.setAttribute, mkBadge (weitere in der Quelle) |
| [`mkBadge`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L3884) | cls, text | document.createElement |
| [`format`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4045) | value | String |
| [`mkSelect`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4098) | labelText, items, value, onChange | document.createElement, items.forEach, sel.addEventListener, sel.appendChild, wrap.appendChild |
| [`withSuggestions`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4126) | existing, candidates | Array.isArray, existing.slice |
| [`nwSetTimersStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4177) | text, kind | byId, el.classList.add, el.classList.remove |
| [`nwShcfgCollectTimerDevicesFromConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4196) | cfg | Array.isArray, Object.create, String, idSet.add, idSet.has, out.push |
| [`nwLoadTimersModule`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4271) | force | Array.isArray, Object.assign, String, console.warn, devices.filter, fetch, nwFetchSmartHomeConfig, nwNormalizeImportedSmartHomeConfig, nwSetTimersStatus, nwShcfgCollectTimerDevicesFromConfig, tRes.json |
| [`nwSaveTimersModule`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4327) | – | Array.isArray, JSON.stringify, Object.assign, Object.keys, String, console.warn, fetch, nwLoadTimersModule, nwSetTimersStatus, res.json |
| [`nwRenderShcfgTimers`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4388) | – | Array.isArray, Object.assign, String, b.addEventListener, byId, card.appendChild, cb.addEventListener, ctrl.appendChild, del.addEventListener, devices.slice, document.createElement, grid.appendChild, inp.addEventListener, lab.appendChild (weitere in der Quelle) |
| [`markDirty`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4473) | – | Object.assign, nwSetTimersStatus |
| [`sync`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4541) | – | Array.from, timer.days.sort |
| [`mk`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4584) | labelText, value, onChange | document.createElement, inp.addEventListener, wrap.appendChild |
| [`nwSetLogicClocksStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4674) | text, kind | byId, el.classList.add, el.classList.remove |
| [`nwAddLogicClock`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4689) | – | Date.now, Math.random, nwSetLogicClocksStatus |
| [`nwLoadLogicClocksModule`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4714) | force | Array.isArray, Object.assign, String, console.warn, fetch, nwSetLogicClocksStatus, res.json |
| [`nwSaveLogicClocksModule`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4750) | – | Array.isArray, JSON.stringify, Object.assign, Object.keys, String, console.warn, fetch, nwLoadLogicClocksModule, nwSetLogicClocksStatus, res.json |
| [`nwRenderShcfgLogicClocks`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4802) | – | Array.isArray, Object.keys, b.addEventListener, byId, card.appendChild, cb.addEventListener, ctrl.appendChild, del.addEventListener, document.createElement, grid.appendChild, inp.addEventListener, lab.appendChild, mk, nwLoadLogicClocksModule (weitere in der Quelle) |
| [`markDirty`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4844) | – | nwSetLogicClocksStatus |
| [`sync`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4957) | – | Array.from, clock.days.sort |
| [`mk`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L4999) | labelText, value, onChange | document.createElement, inp.addEventListener, wrap.appendChild |
| [`nwSetScenesStatus`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5059) | text, kind | byId, el.classList.add, el.classList.remove |
| [`nwAddScene`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5074) | – | Array.isArray, Date.now, Math.random, cfg.scenes.push, nwSetScenesStatus |
| [`nwRenderShcfgScenes`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5100) | – | Array.isArray, addBtn.addEventListener, btnRow.appendChild, byId, card.appendChild, cb.addEventListener, ctrl.appendChild, del.addEventListener, document.createElement, inp.addEventListener, lab.appendChild, renderActionRow, root.appendChild, row.appendChild (weitere in der Quelle) |
| [`markDirty`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5146) | – | nwSetScenesStatus |
| [`renderActionRow`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5314) | a, idx | String, boolSel.addEventListener, boolSel.appendChild, coverSel.addEventListener, coverSel.appendChild, delBtn.addEventListener, devSel.addEventListener, devSel.appendChild, document.createElement, input.addEventListener, kindSel.addEventListener, kindSel.appendChild, playerSel.addEventListener, playerSel.appendChild (weitere in der Quelle) |
| [`nwShcfgDragSet`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5614) | e, payload | JSON.stringify, dt.setData, nwEnsureShcfgUiState |
| [`nwShcfgDragClear`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5639) | – | nwEnsureShcfgUiState |
| [`nwShcfgDragGet`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5654) | e | JSON.parse, dt.getData, nwEnsureShcfgUiState, raw.slice, raw.startsWith |
| [`nwRenderShcfgBuilder`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5688) | – | document.getElementById, document.querySelectorAll, nwCompactDeviceProperties, nwEnsureShcfgUiState, nwRenderShcfgBuilderLib, nwRenderShcfgBuilderProps, nwRenderShcfgBuilderWorkspace, tabBtns.forEach |
| [`nwShcfgLibGroup`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5723) | titleText, items, { forceOpen = false } | details.addEventListener, details.appendChild, document.createElement, items.forEach, nwEnsureShcfgUiState, sumLeft.appendChild, summary.appendChild |
| [`nwShcfgLibItem`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5782) | { icon, name, meta, payload } | document.createElement, item.addEventListener, item.appendChild, left.appendChild, nwShcRenderIconPreview, textWrap.appendChild |
| [`nwRenderShcfgBuilderLib`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5886) | container | container.appendChild, document.createElement, input.addEventListener, nwShcfgLibGroup, nwShcfgLibItem, renderGroups, row.appendChild, searchWrap.appendChild |
| [`renderGroups`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L5967) | – | String, byGroup.get, byGroup.has, byGroup.keys, byGroup.set, document.createElement, filterRaw.trim, groups.forEach, groupsWrap.appendChild, hay.includes, nwShcfgGetRoomById, nwShcfgGetTargetRoomIdForAdd, preferredOrder.filter |
| [`nwShcfgAddRoom`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6044) | { name = 'Neuer Raum', floorId = null, icon = 'generic' } | nwEnsureUniqueId, nwMarkDirty, nwNormalizeRoomOrder, nwPagesSlugify, rooms.push |
| [`nwShcfgAddFloor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6102) | presetId | floors.push, floors.reduce, nwEnsureUniqueId, nwMarkDirty, nwNormalizeFloorOrder, nwPagesSlugify |
| [`nwShcfgMoveRoomToFloor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6130) | roomId, floorId | nwMarkDirty, nwNormalizeRoomOrder, rooms.find |
| [`nwRenderShcfgBuilderWorkspace`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6156) | container | addFloorBtn.addEventListener, backBtn.addEventListener, container.appendChild, container.classList.remove, crumbs.appendChild, devices.filter, document.createElement, drop.addEventListener, floorList.forEach, floorList.push, floors.map, left.appendChild, nwRenderShcfgBuilderWorkspace, right.appendChild (weitere in der Quelle) |
| [`nwShcfgCreateSelect`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6643) | options, value, onChange | document.createElement, options.forEach, sel.addEventListener |
| [`nwShcfgCreateTextInput`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6663) | value, onChange, { placeholder = '' } | document.createElement, input.addEventListener |
| [`nwShcfgNullIfEmpty`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6679) | v | – |
| [`nwRenderShcfgBuilderProps`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L6689) | container | Array.isArray, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, String, addBehavior, addDp, addNumber, addSelect, addText, cfg.floors.slice, container.appendChild, del.addEventListener, devices.find (weitere in der Quelle) |
| [`ensureObject`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7024) | parent, key, defaults | Array.isArray, Object.keys |
| [`addDp`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7031) | label, owner, key | container.appendChild, nwCreateDpInput |
| [`addNumber`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7037) | label, owner, key, fallback, min, max, step | Number, Number.isFinite, String, container.appendChild, document.createElement, input.addEventListener, nwCreateFieldRow |
| [`addSelect`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7057) | label, owner, key, options, fallback | String, container.appendChild, nwCreateFieldRow, nwShcfgCreateSelect |
| [`addText`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7063) | label, owner, key, placeholder | container.appendChild, nwCreateFieldRow, nwShcfgCreateTextInput |
| [`addBehavior`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7069) | – | addNumber |
| [`nwSanitizeId`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7279) | raw | String, s.replace |
| [`nwEnsureUniqueId`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7296) | items, desiredId, skipItem | Array.isArray, exists, nwSanitizeId |
| [`exists`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7304) | candidate | list.some |
| [`nwNormalizeRoomFunctionOrder`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7323) | – | normalize, nwNormalizeRoomOrder |
| [`normalize`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7331) | arr, labelFn | Array.isArray, arr.slice, out.forEach, source.map, withIdx.map, withIdx.sort |
| [`nwMoveItem`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7360) | arr, index, dir | Array.isArray, arr.forEach, arr.splice |
| [`nwMoveItemTo`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7376) | arr, fromIndex, toIndex | Array.isArray, Math.trunc, Number.isFinite, arr.forEach, arr.splice |
| [`nwReplaceRoomIdInDevices`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7400) | oldId, newId | Array.isArray, nwShcState.config.devices.forEach |
| [`nwReplaceFunctionIdInDevices`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7412) | oldId, newId | Array.isArray, nwShcState.config.devices.forEach |
| [`nwAddRoom`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7424) | – | Array.isArray, nwEnsureUniqueId, nwMarkDirty, nwRenderAll, rooms.push |
| [`nwAddFunction`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7440) | – | Array.isArray, funcs.push, nwEnsureUniqueId, nwMarkDirty, nwRenderAll |
| [`nwRenderRoomsEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7456) | rooms | Array.isArray, arr.forEach, document.getElementById |
| [`nwRenderFunctionsEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7588) | functions | Array.isArray, arr.forEach, document.getElementById |
| [`nwNormalizeFloorOrder`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7725) | – | Array.isArray, floors.forEach, floors.sort |
| [`nwNormalizeRoomOrder`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7755) | – | Array.isArray, buckets.get, buckets.has, buckets.set, list.forEach, rooms.forEach |
| [`nwNormalizeDeviceOrder`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7798) | – | Array.isArray, arr.forEach, arr.map, arr.splice, stable.map, stable.sort |
| [`nwEnsureUniqueDeviceId`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7816) | devices, desiredId | Array.isArray, String, base.trim, list.some |
| [`nwAddDevice`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7835) | – | Array.isArray, devices.push, nwEnsureUniqueDeviceId, nwMarkDirty, nwNormalizeDeviceOrder, nwRenderAll |
| [`nwAddDeviceFromTemplate`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L7873) | templateId, opts | Array.isArray, NW_SHCFG_BUILDER_DEVICE_TEMPLATES.find, Object.assign, Object.prototype.hasOwnProperty.call, String, devices.push, document.getElementById, nwEnsureUniqueDeviceId, nwMarkDirty, nwNormalizeDeviceOrder, nwRenderAll, nwSetStatus, nwShcfgDefaultSensorUiFromTemplate, nwShcfgNullIfEmpty |
| [`nwCreateFieldRow`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8052) | labelText, controlElem | ctlWrap.appendChild, document.createElement, row.appendChild |
| [`nwDpFormatValueShort`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8077) | val | JSON.stringify, Math.abs, Math.round, Number.isFinite, String, s.slice |
| [`nwDpGetState`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8104) | dpId | String, encodeURIComponent, fetch, res.json |
| [`nwDpSetState`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8121) | dpId, val | JSON.stringify, String, fetch, res.json |
| [`nwShcfgControlEditorError`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8144) | dev | custom.validationError, helper.validationError |
| [`nwCreateDeviceDraftAliases`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8161) | dev, status, button | JSON.stringify, helper.canCreate, helper.create, nwMarkDirty, nwRenderAll, nwSetStatus, nwValidateConfig, window.confirm |
| [`nwMountAliasTools`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8190) | container, dev | button.addEventListener, container.appendChild, document.createElement, helper.canCreate, status.setAttribute, wrapper.appendChild |
| [`nwMountDeviceControlProfile`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8209) | container, dev, expanded | container.appendChild, custom.mount, document.createElement, helper.mount, nwMountAliasTools |
| [`currentEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8211) | – | – |
| [`getControls`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8217) | – | – |
| [`onChange`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8218) | view, mapping, rebuild | currentEditor, nwMarkDirty, nwRenderAll |
| [`createDpInput`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8243) | label, value, onChange | nwCreateDpInput |
| [`onChange`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8244) | mapping | currentEditor, nwMarkDirty |
| [`nwCreateDpInput`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8254) | labelText, value, onChange, options | String, btnPick.addEventListener, btnSet.addEventListener, btnTest.addEventListener, document.createElement, input.addEventListener, labelLower.includes, nwCreateFieldRow, window.NW_AUTH.hasCapability, wrapper.appendChild |
| [`currentEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8256) | – | – |
| [`onSelect`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8286) | id | currentEditor, input.value.trim, nwMarkDirty, onChange |
| [`setBadge`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8311) | kind, text | badge.classList.add, badge.classList.remove |
| [`nwRenderDevicesEditor`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8434) | devices, rooms, functions | devices.forEach, document.getElementById, functions.forEach, rooms.forEach |
| [`setCustomVisible`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8890) | on | – |
| [`syncIconUi`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L8899) | – | String, iconOptions.some, nwShcNormalizeIconName, nwShcRenderIconPreview, setCustomVisible |
| [`renderStations`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9696) | – | Array.isArray, stations.forEach |
| [`renderPlaylists`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L9792) | – | Array.isArray, playlists.forEach |
| [`nwDpSafeStr`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10057) | value | String |
| [`nwDpFetchJson`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10066) | url | fetch, res.json |
| [`nwDpSearch`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10080) | q | Array.isArray, encodeURIComponent, nwDpFetchJson, nwDpSafeStr |
| [`nwDpTree`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10091) | prefix | Array.isArray, encodeURIComponent, nwDpFetchJson, nwDpSafeStr |
| [`nwDpParentPrefix`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10102) | id | nwDpSafeStr, parts.join, parts.pop |
| [`nwDpMetaText`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10114) | it | String, parts.join, parts.push |
| [`nwCreateDpResultRow`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10128) | primary, meta, onActivate | document.createElement, nwDpSafeStr, row.addEventListener, row.appendChild |
| [`activate`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10156) | ev | ev.preventDefault, ev.stopPropagation, onActivate |
| [`nwRenderDpBreadcrumb`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10179) | prefix, wrap, onNavigate | mkCrumb, mkSep, nwDpSafeStr, wrap.appendChild |
| [`mkCrumb`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10190) | label, nextPrefix, clickable | btn.addEventListener, document.createElement |
| [`mkSep`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10216) | – | document.createElement |
| [`nwEnsureDpDialog`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10239) | – | backdrop.addEventListener, backdrop.appendChild, body.appendChild, btnClose.addEventListener, columns.appendChild, dlg.appendChild, document.body.appendChild, document.createElement, header.appendChild, input.addEventListener, resultsCol.appendChild, rootBtn.addEventListener, searchBtn.addEventListener, searchRow.appendChild (weitere in der Quelle) |
| [`nwSetDpDialogTreeMessage`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10400) | text, kind | nwEnsureDpDialog, nwEscapeHtml |
| [`nwSetDpDialogResultsMessage`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10413) | text, kind | nwEnsureDpDialog, nwEscapeHtml |
| [`nwDpDialogPick`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10425) | id | nwCloseDatapointDialog, nwDpDialogCurrent.onSelect, nwDpSafeStr |
| [`nwRenderDpDialogTree`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10439) | children | Array.isArray, children.forEach, nwCreateDpResultRow, nwEnsureDpDialog, wrap.appendChild |
| [`nwRenderDpDialogResults`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10490) | list | Array.isArray, list.forEach, nwEnsureDpDialog |
| [`nwRefreshDpDialogTree`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10517) | – | nwDpTree, nwEnsureDpDialog, nwRenderDpBreadcrumb, nwRenderDpDialogTree, nwSetDpDialogTreeMessage |
| [`nwRunDatapointDialogSearch`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10541) | – | nwDpSafeStr, nwDpSearch, nwEnsureDpDialog, nwRenderDpDialogResults, nwSetDpDialogResultsMessage |
| [`nwOpenDpDialogPrefix`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10565) | prefix | nwDpSafeStr, nwEnsureDpDialog, nwRefreshDpDialogTree |
| [`nwOpenDatapointDialog`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10576) | options | String, nwDpParentPrefix, nwEnsureDpDialog, nwRefreshDpDialogTree, nwRenderDpBreadcrumb, nwRunDatapointDialogSearch, nwSetDpDialogResultsMessage, nwSetDpDialogTreeMessage, setTimeout, state.input.value.trim |
| [`nwCloseDatapointDialog`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10611) | – | – |
| [`nwAttachToolbarHandlers`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10625) | – | addDeviceBtn.addEventListener, addFnBtn.addEventListener, addRoomBtn.addEventListener, addTplBtn.addEventListener, backupImportFile.addEventListener, btnBackupExport.addEventListener, btnPagesClear.addEventListener, btnPagesDefault.addEventListener, btnPagesValidate.addEventListener, btnRestoreUserdata.addEventListener, document.getElementById, exportBtn.addEventListener, importBtn.addEventListener, importFile.addEventListener (weitere in der Quelle) |
| [`nwInitSmartHomeConfig`](../../../../../src-ts/runtime-executables/www/smarthome-config.ts#L10969) | – | nwAttachToolbarHandlers, nwInitShcfgShellUi, nwReloadSmartHomeConfig |
