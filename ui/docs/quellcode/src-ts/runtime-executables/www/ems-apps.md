# src-ts/runtime-executables/www/ems-apps.ts

Verbindet App-Center-Eingaben, Modulkonfiguration und Datenpunktzuordnung mit den geschützten Backend-Endpunkten.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/ems-apps.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`syncGridInvert`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L384) | val | – |
| [`_psVoltageKey`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L437) | v | String |
| [`_psThresholdForVoltage`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L447) | v | Object.prototype.hasOwnProperty.call, _psVoltageKey |
| [`_psNumOrNull`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L452) | v | Number, Number.isFinite |
| [`_psParseNumberList`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L457) | value, min, max | String, out.sort |
| [`_psFormatNumberList`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L478) | arr | Array.isArray, arr.map |
| [`_psNormalizeDateToken`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L482) | token | String, s.match |
| [`_psParseDateList`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L490) | value | String, out.sort |
| [`_psFormatDateList`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L507) | arr | Array.isArray, arr.map |
| [`_psSetNumberInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L511) | el, value | Number, Number.isFinite, String |
| [`_psSetTextInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L517) | el, value | String |
| [`_psRound2`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L522) | n | Math.round, Number, Number.isFinite |
| [`_psBuildAtypicalReviewFromUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L527) | – | Math.max, Math.min, _psNumOrNull, _psThresholdForVoltage |
| [`_psUpdateAtypicalReviewPreview`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L577) | – | Math.round, _psBuildAtypicalReviewFromUi, _psRound2, parts.join, parts.push |
| [`_psAtypicalReviewExportUrl`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L599) | format | Math.round, String, _psNumOrNull, params.set, params.toString |
| [`_psAtypicalReviewDefaultStatus`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L618) | – | – |
| [`_psOpenAtypicalReviewExport`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L622) | format | String, _psAtypicalReviewExportUrl, setTimeout, window.NW_RUNTIME?.url, window.open |
| [`_psRefreshAtypicalReviewExportStatus`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L637) | – | Array.isArray, Math.round, Number, String, _psNumOrNull, fetchJson, params.set, params.toString |
| [`_psSetSelect`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L664) | el, value, fallback | Array.from, String, options.includes |
| [`_tpEl`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L769) | id | document.getElementById |
| [`_tpStr`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L770) | id, fallback | String, _tpEl |
| [`_tpBool`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L774) | id, fallback | _tpEl |
| [`_tpNum`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L778) | id, fallback | Number, Number.isFinite, _tpStr |
| [`_tpSet`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L782) | id, value | String, _tpEl |
| [`_setTariffProviderStatus`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L788) | text, kind | String, _tpEl |
| [`loadTariffProviderRegistry`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L794) | force | Date.now, fetchJson |
| [`_tariffProviderInternalDpIds`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L800) | – | – |
| [`_coupleTariffProviderDatapointsSync`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L805) | – | String, _tariffProviderInternalDpIds, document.getElementById |
| [`coupleTariffProviderDatapoints`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L823) | showStatus | _coupleTariffProviderDatapointsSync, _setTariffProviderStatus, loadTariffProviderRegistry |
| [`collectTariffProviderConfig`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L834) | – | Math.max, Math.min, Math.round, String, _tpBool, _tpNum, _tpStr |
| [`applyTariffProviderUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L892) | config | String, _tpSet, loadTariffProviderRegistry |
| [`testTariffProviderConnection`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L942) | – | JSON.stringify, Number, Number.isFinite, _setTariffProviderStatus, collectTariffProviderConfig, coupleTariffProviderDatapoints, fetchJson |
| [`dynamicGridVersion`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1018) | value | Number.isSafeInteger |
| [`requireDynamicGridSaveVersion`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1021) | – | – |
| [`acceptDynamicGridChangeMessage`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1026) | event | Math.max, dynamicGridVersion, els.dynamicGridMount.querySelector, setStatus |
| [`partnerFrames`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1038) | – | – |
| [`requirePartnerSaveVersion`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1054) | – | – |
| [`validDpSelectionId`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1074) | id | id.trim |
| [`_licenseEdition`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1113) | – | String |
| [`_maxStorageCount`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1125) | – | _licenseEdition |
| [`_appLicenseFeature`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1130) | appId | String |
| [`_isFeatureLicensed`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1134) | feature | HOME_LICENSE_FEATURES.has, Object.prototype.hasOwnProperty.call, String, _licenseEdition |
| [`_isAppLicensed`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1144) | appId | HEMS_APP_IDS.has, String, _appLicenseFeature, _isFeatureLicensed, _licenseEdition |
| [`_maxEvcsCount`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1151) | – | Math.max, Math.min, Math.round, Number, Number.isFinite |
| [`_licenseLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1156) | – | _licenseEdition |
| [`_storagePowerProfileInfo`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1163) | – | Math.max, Number, Number.isFinite, String, _licenseEdition |
| [`updateStorageLicensePowerUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1183) | – | Number, Number.isFinite, _storagePowerProfileInfo, els.storageRatedPowerKW.removeAttribute |
| [`normalizeLicenseInfo`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1211) | raw | JSON.parse, Math.max, Math.round, Number, Number.isFinite, Object.keys, String, asBool, featuresJsonRaw.trim, unwrap |
| [`unwrap`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1213) | value | Object.prototype.hasOwnProperty.call |
| [`asBool`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1220) | value | String, unwrap |
| [`_licenseIsUsable`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1280) | info | – |
| [`_inferLicenseFromSuccessfulInstallerGate`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1284) | data, cfg | normalizeLicenseInfo |
| [`fetchLicenseInfoFallback`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1295) | – | Date.now, fetchJson, normalizeLicenseInfo |
| [`fetchLicenseInfoFromStateFallback`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1304) | – | Date.now, String, fetchJson, normalizeLicenseInfo, readVal |
| [`readVal`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1307) | key | Object.prototype.hasOwnProperty.call |
| [`_readApiStateValue`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1348) | statePayload, key, fallback | Object.keys, Object.prototype.hasOwnProperty.call, String |
| [`_parseStorageFarmRuntimeList`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1365) | raw | Array.isArray, JSON.parse, String |
| [`_recoverStorageFarmRowsFromStatusRows`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1378) | statusRows | Array.isArray |
| [`_normalizeRecoveredStorageFarmRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1404) | row, index | boolFrom, normalizeStorageVendorProfile, numberFrom, numberOrDefault, textFrom |
| [`textFrom`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1407) | keys | String |
| [`numberFrom`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1418) | keys | Number, Number.isFinite, String, raw.includes, raw.lastIndexOf, raw.replace |
| [`numberOrDefault`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1438) | fallback, keys | numberFrom |
| [`boolFrom`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1442) | fallback, keys | Object.prototype.hasOwnProperty.call, String |
| [`hydrateStorageFarmConfigFromRuntimeState`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1506) | cfg | Array.from, Array.isArray, Date.now, Math.max, Math.min, Math.round, Number, Number.isFinite, String, _parseStorageFarmRuntimeList, _readApiStateValue, _recoverStorageFarmRowsFromStatusRows, fetchJson, runtimeGroups.slice (weitere in der Quelle) |
| [`refreshLicenseForAppCenter`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1559) | reason | JSON.stringify, _licenseEdition, _licenseIsUsable, _licenseLabel, buildAppsUI, buildEvcsUI, fetchLicenseInfoFallback, fetchLicenseInfoFromStateFallback, normalizeLicenseInfo, scheduleValidation, setStatus, updateStorageLicensePowerUi |
| [`_decodeShadowDisplayText`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1586) | value | String, decodeURIComponent |
| [`_rememberOpenShadowDetails`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1592) | – | document.querySelectorAll |
| [`_ensureSettingsObj`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1608) | – | – |
| [`_ensureFlowPowerDpIsW`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1614) | – | _ensureSettingsObj |
| [`_getFlowPowerDpIsW`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1620) | key | Object.prototype.hasOwnProperty.call, _ensureSettingsObj |
| [`_setFlowPowerDpIsW`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1630) | key, isW | _ensureFlowPowerDpIsW, document.querySelectorAll |
| [`_collectFlowPowerDpIsWFromUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1640) | – | document.querySelectorAll |
| [`setStatus`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1650) | msg, kind | – |
| [`beginAppCenterMutation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1661) | – | closeDpModal, document.querySelector, main.setAttribute |
| [`setDirty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1673) | – | els.save.setAttribute |
| [`clearDirty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1681) | – | els.save.setAttribute |
| [`setBackupStatus`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1690) | msg, kind | – |
| [`downloadJsonFile`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1697) | filename, obj | JSON.stringify, URL.createObjectURL, a.click, document.body.appendChild, document.createElement, setTimeout, window.NW_RUNTIME?.url |
| [`readFileAsText`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1714) | file | – |
| [`fetchJson`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1727) | url, opts | Object.assign, fetch, res.json |
| [`_fmtAge`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1743) | ageMs | Math.round, Number, Number.isFinite |
| [`_setBadge`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1755) | inputId, kind, text | document.getElementById, el.classList.add, el.classList.remove |
| [`scheduleValidation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1763) | delayMs | Number.isFinite, clearTimeout, setTimeout |
| [`runValidation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1769) | showStatusMessage | Array.from, JSON.stringify, String, _fmtAge, _setBadge, document.querySelectorAll, fetchJson, ids.push, seen.add, seen.has, setStatus |
| [`deepMerge`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1846) | target, patches | Array.isArray, JSON.parse, JSON.stringify, Object.keys, deepMerge |
| [`valueOrEmpty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1862) | v | String |
| [`numOrEmpty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1866) | v | Number.isFinite, String |
| [`_aiSetNumberInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1870) | el, value, def | Number, Number.isFinite, String |
| [`_aiSetCheckbox`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1877) | el, value, def | – |
| [`_aiSetInputValue`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1882) | el, value, def | String |
| [`buildAiAdvisorUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1890) | – | String, _aiSetCheckbox, _aiSetInputValue, _aiSetNumberInput |
| [`collectAiAdvisorConfigFromUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1955) | base | String, deepMerge, n, str |
| [`n`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1958) | el, def, min, max, roundValue | Math.max, Math.min, Math.round, Number, Number.isFinite |
| [`str`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1966) | el, def | String |
| [`_nwHtmlEscape`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2043) | input | String |
| [`_nwSystemProfileCountry`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2060) | – | String |
| [`buildSystemProfileCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2066) | – | String, _nwSystemProfileCountry, card.querySelector, card.setAttribute, document.createElement, lang.toUpperCase, sel.addEventListener |
| [`buildNlP1Card`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2129) | – | Number, Number.isFinite, _nwHtmlEscape, _nwSystemProfileCountry, card.setAttribute, document.createElement |
| [`_chargeKioskHtmlEscape`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2173) | input | String |
| [`_chargeKioskStations`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2182) | – | Array.isArray |
| [`_chargeKioskToken`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2194) | – | Array.from, crypto.getRandomValues |
| [`_chargeKioskAssignedToText`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2203) | v | Array.isArray, arr.map |
| [`_chargeKioskStationCatalog`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2208) | – | Array.from, Array.isArray, byKey.values, evcs.forEach, groups.forEach |
| [`ensure`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2215) | rawKey | String, byKey.get, byKey.has, byKey.set |
| [`_chargeKioskAssignedForStation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2241) | stationKey | String, _chargeKioskStationCatalog, item.chargepoints.map |
| [`_chargeKioskStationOptionsHtml`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2247) | selectedKey | String, _chargeKioskStationCatalog, options.join |
| [`buildChargeKioskCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2257) | – | _chargeKioskStations, _licenseEdition, add.addEventListener, card.querySelector, card.querySelectorAll, card.setAttribute, document.createElement, stations.map |
| [`refreshChargeKioskAssignmentRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2355) | row | String, _chargeKioskAssignedForStation, _chargeKioskAssignedToText, row.querySelector |
| [`_meshHtmlEscape`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2423) | input | String |
| [`_meshNodes`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2431) | – | Array.isArray |
| [`_meshNodeRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2436) | node, index | Array.isArray, _meshHtmlEscape, n.targetGroupIds.join |
| [`buildMeshMicrogridCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2496) | – | _meshNodes, buildLegacyMeshMicrogridCard, card.appendChild, document.createElement, encodeURIComponent, legacy.appendChild, window.NW_RUNTIME?.url |
| [`buildDynamicGridCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2524) | – | card.appendChild, document.createElement, encodeURIComponent, frame.setAttribute, window.NW_RUNTIME?.url |
| [`buildPartnerIntegrationCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2546) | appId | card.appendChild, document.createElement, encodeURIComponent, frame.setAttribute, window.NW_RUNTIME?.url |
| [`buildLegacyMeshMicrogridCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2566) | – | Array.isArray, JSON.stringify, String, _licenseEdition, _meshHtmlEscape, _meshNodes, add.addEventListener, card.querySelector, cfg.tailscale.peerUrls.join, document.createElement |
| [`buildAppCenterStructurePanels`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2675) | – | _isAppLicensed, buildChargeKioskCard, buildDynamicGridCard, buildMeshMicrogridCard, buildNlP1Card, buildPartnerIntegrationCard, buildSystemProfileCard, els.arbitrageMount.querySelector, els.directMarketingPartnerMount.querySelector, els.dynamicGridMount.querySelector, els.ledgerPartnerMount.querySelector, mount, window.NexoWattNetOperatorAppCenter.render, window.NexoWattOperatingStrategiesAppCenter.render |
| [`mount`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2676) | el, card | el.appendChild |
| [`setupInstallerBackButton`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2763) | – | btn.addEventListener, btn.setAttribute, buildTarget, window.NW_RUNTIME?.url |
| [`parseQuery`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2768) | – | – |
| [`detectInstance`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2772) | – | Math.max, Math.round, Number, Number.isFinite, String, hash.match, parseQuery, qs.get |
| [`detectAdminOrigin`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2785) | – | String, parseQuery, qs.get |
| [`buildTarget`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2818) | – | detectAdminOrigin, detectInstance, window.NW_RUNTIME.adminBase |
| [`buildAppsUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2836) | – | APP_CATALOG.filter, _licenseEdition, _licenseLabel, _maxEvcsCount, actions.appendChild, appendAppConfigNavigation, buildAppCenterStructurePanels, card.appendChild, card.setAttribute, document.createElement, els.appsList.appendChild, getSt, header.appendChild, mkToggle (weitere in der Quelle) |
| [`getSt`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2840) | appId | – |
| [`appendAppConfigNavigation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2885) | body, app, st | String, body.appendChild, btn.addEventListener, btn.setAttribute, document.createElement, op.setAttribute, row.appendChild, row.setAttribute, window.NW_RUNTIME?.url |
| [`mkToggle`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2949) | id, label, checked, disabled, onLabel, offLabel, toggleKind | bOff.classList.add, bOff.setAttribute, bOn.classList.add, bOn.setAttribute, document.createElement, grp.appendChild, grp.classList.add, grp.setAttribute, wrap.appendChild, wrap.setAttribute |
| [`setAppsFromConfig`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3090) | cfg | applyAppDependentVisibility, document.getElementById, window.nwSyncToggleButtons |
| [`applyAppDependentVisibility`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3116) | – | appsTab.click, document.querySelector, isInstalled, toggleCard |
| [`isInstalled`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3118) | appId | document.getElementById |
| [`toggleCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3123) | cardKey, show | document.querySelector |
| [`_psDefaultWindow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3181) | – | – |
| [`_psGetPeakCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3195) | – | – |
| [`_psGetWindowsFromCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3202) | cfg | Array.isArray |
| [`buildAtypicalWindowsUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3209) | – | _psGetPeakCfg, _psGetWindowsFromCfg, document.createElement, els.psAtypicalWindows.appendChild, wins.forEach |
| [`_psCollectWindowRows`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3302) | – | Array.from, String, _psParseNumberList, els.psAtypicalWindows.querySelectorAll, get, out.push |
| [`get`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3308) | field | row.querySelector |
| [`_psUpdateAtypicalFieldState`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3334) | – | String, atypicalIds.forEach, els.psAtypicalWindows.querySelectorAll, standardIds.forEach |
| [`buildPeakShavingUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3369) | – | Math.round, Number, Number.isFinite, String, _psFormatDateList, _psGetPeakCfg, _psNumOrNull, _psSetNumberInput, _psSetSelect, _psSetTextInput, _psThresholdForVoltage, _psUpdateAtypicalFieldState, _psUpdateAtypicalReviewPreview, _psVoltageKey (weitere in der Quelle) |
| [`collectPeakShavingConfigFromUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3437) | baseCfg | Math.max, Math.min, Math.round, Object.keys, String, _psCollectWindowRows, _psNumOrNull, _psParseDateList, _psThresholdForVoltage, _psVoltageKey, deepMerge, setNum, setStr |
| [`setNum`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3445) | key, el, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`setStr`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3486) | key, el | String |
| [`buildDpTable`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3531) | container, fields, getter, setter, options | console.warn, container.appendChild, makeRow, options.afterRow, refreshAllMeta |
| [`isRequiredGroupSatisfied`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3537) | groupName | getVal |
| [`getVal`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3540) | key | String, fieldInputs.get |
| [`refreshAllMeta`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3550) | – | metaUpdaters.forEach |
| [`makeRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3556) | field | String, _getFlowPowerDpIsW, btn.addEventListener, document.createElement, fieldInputs.set, getter, input.addEventListener, left.appendChild, metaUpdaters.push, right.appendChild, row.appendChild, unitCb.addEventListener, unitCb.setAttribute, unitLabel.appendChild (weitere in der Quelle) |
| [`updateMeta`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3660) | – | String, isRequiredGroupSatisfied |
| [`commitDpValue`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3694) | – | String, setter |
| [`_ensureVis`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3748) | – | – |
| [`_normalizeFlowConsumerType`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3754) | raw | String |
| [`_getFlowConsumerTypeLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3762) | raw | _normalizeFlowConsumerType |
| [`_ensureFlowSlots`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3769) | – | Array.isArray, String, _ensureVis, norm |
| [`norm`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3789) | arr, count, kind | String, _normalizeFlowConsumerType, ensureBool, ensureString, ensureValue, out.push |
| [`ensureString`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3802) | key, def | String |
| [`ensureValue`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3812) | key, def | – |
| [`ensureBool`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3821) | key, def | – |
| [`_defaultSlotName`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3875) | kind, idx1based | – |
| [`buildFlowSlotsUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3885) | kind, slotCount | FLOW_ICON_CHOICES.forEach, String, _defaultSlotName, _ensureFlowSlots, _getFlowPowerDpIsW, _normalizeFlowConsumerType, addGenericField, addHeatPumpField, advBtn.addEventListener, advanced.appendChild, btn.setAttribute, consumerTypeSelect.addEventListener, container.appendChild, document.createElement (weitere in der Quelle) |
| [`ensureCtrl`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4096) | – | _ensureFlowSlots |
| [`mkDpField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4118) | labelText, id, value, onChange | String, b.setAttribute, document.createElement, dpWrap.appendChild, input.addEventListener, wrap.appendChild |
| [`mkSimpleField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4173) | labelText, id, type, value, placeholder, onChange | String, document.createElement, input.addEventListener, wrap.appendChild |
| [`mkCheckField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4209) | labelText, id, checked, onChange | document.createElement, input.addEventListener, row.appendChild, wrap.appendChild |
| [`addGenericField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4261) | el | ctrlFieldsGeneric.push, ctrlGrid.appendChild |
| [`addHeatPumpField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4272) | el | ctrlFieldsHeatPump.push, ctrlGrid.appendChild |
| [`setVisible`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4321) | el, visible | – |
| [`updateConsumerControlVisibility`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4331) | – | _normalizeFlowConsumerType, ctrlFieldsGeneric.forEach, ctrlFieldsHeatPump.forEach, setVisible |
| [`buildFlowPvNameRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4380) | – | String, _ensureFlowSlots, document.createElement, input.addEventListener, left.appendChild, right.appendChild, row.appendChild |
| [`_getFlowConsumerSlotCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4433) | slot | Array.isArray, _ensureFlowSlots |
| [`_getFlowConsumerName`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4444) | slot | String, _getFlowConsumerSlotCfg |
| [`_getFlowConsumerTypeForSlot`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4454) | slot | _getFlowConsumerSlotCfg, _normalizeFlowConsumerType |
| [`_getRawHeatingRodDeviceForSlot`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4464) | slot | Array.isArray, _clampInt, arr.find |
| [`_getHeatingRodStageDpPair`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4482) | slot, stageIdx | Array.isArray, String, _getFlowConsumerSlotCfg, _getRawHeatingRodDeviceForSlot |
| [`_countHeatingRodWiredStages`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4504) | slot | String, _getHeatingRodStageDpPair |
| [`_thermalDefaultSetpoints`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4518) | profile | String |
| [`_defaultHeatingRodStagePower`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4530) | maxPowerW, stageCount, index | Math.floor, Math.max, Math.round, Number, _clampInt |
| [`_computeHeatingRodStageDefaults`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4544) | maxPowerW, stageCount | Math.max, Math.round, _clampInt, _defaultHeatingRodStagePower, out.push |
| [`_syncHeatingRodDeviceStages`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4567) | dev, opts | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, String, _clampInt, _computeHeatingRodStageDefaults, next.push |
| [`_ensureThermalCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4605) | – | Array.isArray, Math.max, Math.round, Number, Number.isFinite, String, _clampInt, _thermalDefaultSetpoints, bySlot.get, bySlot.set, out.push |
| [`_normalizeHeatingRodAutoMode`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4666) | raw | String |
| [`_heatingRodAutoModeLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4683) | mode | _normalizeHeatingRodAutoMode |
| [`_normalizeHeatingRodClockTime`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4689) | raw, fallback | Math.max, Math.min, Math.round, Number, String |
| [`_ensureHeatingRodCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4704) | – | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, String, _clampInt, _getFlowConsumerSlotCfg, _normalizeHeatingRodAutoMode, _normalizeHeatingRodClockTime, _syncHeatingRodDeviceStages, bySlot.get, bySlot.set (weitere in der Quelle) |
| [`hn`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4751) | key, def, min, max | Math.max, Math.min, Math.round, Number, Number.isFinite |
| [`zn`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4782) | key, def, min, max, integer | Math.max, Math.min, Math.round, Number, Number.isFinite |
| [`_mkCfgInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4886) | type, value, onChange, opts | String, document.createElement, inp.addEventListener |
| [`commit`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4909) | – | Number, onChange |
| [`_mkHeatingRodNumberInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4932) | key, value, onChange, opts | String, _mkCfgInput |
| [`flushHeatingRodConfigFromDom`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4944) | – | document.querySelectorAll |
| [`_mkCfgSelect`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4971) | value, options, onChange, opts | document.createElement, sel.addEventListener |
| [`_mkCfgToggle`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4993) | checked, onChange, opts | cb.addEventListener, document.createElement |
| [`_mkCfgField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5008) | label, control, hint | document.createElement, wrap.appendChild |
| [`_mkCfgGroup`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5037) | title | document.createElement, wrap.appendChild |
| [`_mkCfgDetailsGroup`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5073) | title, open | document.createElement, wrap.appendChild |
| [`_mkCfgBadge`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5112) | text, tone | document.createElement |
| [`_mkDeviceRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5138) | title, subtitle, badges | document.createElement, left.appendChild, row.appendChild |
| [`buildThermalUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5188) | – | String, _ensureThermalCfg, cfg.devices.forEach |
| [`syncVisibility`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5306) | – | String |
| [`rebuildHeatingRodUIStable`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5326) | reason | String, buildHeatingRodUI, requestAnimationFrame |
| [`buildHeatingRodUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5365) | – | Array.from, _ensureHeatingRodCfg, _getFlowConsumerTypeForSlot, _heatingRodAutoModeLabel, _mkCfgDetailsGroup, _mkCfgField, _mkCfgGroup, _mkCfgInput, _mkCfgSelect, _mkCfgToggle, _mkHeatingRodNumberInput, document.createElement, els.heatingRodDevices.appendChild, grpAuto.body.appendChild (weitere in der Quelle) |
| [`mkStageDpField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5489) | labelText, inputId, value, onChange, placeholder | String, b.setAttribute, document.createElement, dpWrap.appendChild, input.addEventListener, wrap.appendChild |
| [`_ensureBhkwCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5761) | – | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, String, mkDefault, normalized.push, normalized.sort, used.add, used.has |
| [`mkDefault`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5782) | idx | – |
| [`buildBhkwUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5893) | – | _ensureBhkwCfg, _mkDpWrap, actions.appendChild, adv.appendChild, advBtn.addEventListener, body.appendChild, card.appendChild, document.createElement, els.bhkwDevices.appendChild, header.appendChild, headerTop.appendChild, mkCheckbox, mkFieldRow, mkNumInput (weitere in der Quelle) |
| [`mkFieldRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5909) | labelTxt, controlEl, hintTxt | ctrl.appendChild, document.createElement, row.appendChild |
| [`mkTextInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5948) | value, onChange, placeholder | String, document.createElement, i.addEventListener |
| [`mkNumInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5971) | value, onChange | String, document.createElement, i.addEventListener |
| [`mkCheckbox`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5999) | checked, text, onChange | cb.addEventListener, document.createElement, label.appendChild |
| [`mkSelect`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6030) | value, opts, onChange | String, document.createElement, s.addEventListener, s.appendChild |
| [`_ensureGeneratorCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6169) | – | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, String, mkDefault, normalized.push, normalized.sort, used.add, used.has |
| [`mkDefault`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6190) | idx | – |
| [`buildGeneratorUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6292) | – | _ensureGeneratorCfg, _mkDpWrap, actions.appendChild, adv.appendChild, advBtn.addEventListener, body.appendChild, card.appendChild, document.createElement, els.generatorDevices.appendChild, header.appendChild, headerTop.appendChild, mkCheckbox, mkFieldRow, mkNumInput (weitere in der Quelle) |
| [`mkFieldRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6309) | labelTxt, controlEl, hintTxt | ctrl.appendChild, document.createElement, row.appendChild |
| [`mkTextInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6348) | value, onChange, placeholder | String, document.createElement, i.addEventListener |
| [`mkNumInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6371) | value, onChange | String, document.createElement, i.addEventListener |
| [`mkCheckbox`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6397) | checked, text, onChange | cb.addEventListener, document.createElement, label.appendChild |
| [`mkSelect`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6430) | value, opts, onChange | String, document.createElement, s.addEventListener, s.appendChild |
| [`_ensureThresholdCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6566) | – | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, String, normCompare, normOutType, out.push, out.sort, used.add, used.has |
| [`normOutType`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6587) | v | String |
| [`normCompare`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6597) | v | String |
| [`_nextFreeThresholdIdx`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6657) | – | _ensureThresholdCfg, used.has |
| [`buildThresholdUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6671) | – | Number, String, _ensureThresholdCfg, del.addEventListener, document.createElement, document.createTextNode, els.thresholdRules.appendChild, en.addEventListener, enWrap.appendChild, grid.appendChild, head.appendChild, item.appendChild, left.appendChild, listWrap.appendChild (weitere in der Quelle) |
| [`mkHdr`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6702) | title, subtitle | document.createElement, wrap.appendChild |
| [`mkLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6736) | text | document.createElement |
| [`mkDpField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6757) | labelText, inputId, value, onChange, placeholder | String, b.setAttribute, document.createElement, dpWrap.appendChild, input.addEventListener, mkLabel, wrap.appendChild |
| [`mkNumField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6810) | labelText, inputId, value, onChange, placeholder, unit | String, document.createElement, input.addEventListener, mkLabel, row.appendChild, wrap.appendChild |
| [`mkTextField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6856) | labelText, inputId, value, onChange, placeholder | String, document.createElement, input.addEventListener, mkLabel, wrap.appendChild |
| [`mkSelectField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6886) | labelText, inputId, value, options, onChange | String, document.createElement, mkLabel, sel.addEventListener, sel.appendChild, wrap.appendChild |
| [`mkBoolSelect`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6920) | labelText, inputId, value, onChange | mkSelectField |
| [`mkChk`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6939) | labelText, inputId, checked, onChange | cb.addEventListener, document.createElement, document.createTextNode, lbl.appendChild, mkLabel, wrap.appendChild |
| [`updateRule`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6976) | idx, patch | Object.assign, String, _ensureThresholdCfg, t2.rules.find |
| [`_ensureRelayCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7152) | – | Array.isArray, Math.max, Math.min, Math.round, Number, String, normType, numOrNull, out.push, out.sort, used.add, used.has |
| [`normType`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7173) | v | String |
| [`numOrNull`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7183) | v | Number, Number.isFinite |
| [`_nextFreeRelayIdx`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7224) | – | _ensureRelayCfg, used.has |
| [`buildRelayUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7238) | – | Number, String, _ensureRelayCfg, del.addEventListener, document.createElement, document.createTextNode, els.relayControls.appendChild, en.addEventListener, enWrap.appendChild, grid.appendChild, head.appendChild, item.appendChild, left.appendChild, listWrap.appendChild (weitere in der Quelle) |
| [`mkHdr`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7269) | title, subtitle | document.createElement, wrap.appendChild |
| [`mkLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7303) | text | document.createElement |
| [`mkDpField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7324) | labelText, inputId, value, onChange, placeholder | String, b.setAttribute, document.createElement, dpWrap.appendChild, input.addEventListener, mkLabel, wrap.appendChild |
| [`mkTextField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7377) | labelText, inputId, value, onChange, placeholder | String, document.createElement, input.addEventListener, mkLabel, wrap.appendChild |
| [`mkNumField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7407) | labelText, inputId, value, onChange, unit | String, document.createElement, input.addEventListener, mkLabel, row.appendChild, wrap.appendChild |
| [`mkSelectField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7452) | labelText, inputId, value, options, onChange | String, document.createElement, mkLabel, sel.addEventListener, sel.appendChild, wrap.appendChild |
| [`mkChk`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7486) | labelText, inputId, checked, onChange | cb.addEventListener, document.createElement, document.createTextNode, lbl.appendChild, mkLabel, wrap.appendChild |
| [`updateRelay`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7523) | idx, patch | Object.assign, String, _ensureRelayCfg, r2.relays.find |
| [`_normalizeGridExportControlCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7669) | gc | Math.max, Math.min, Math.round, Number, Number.isFinite, String, probe.trim, value.trim |
| [`_ensureGridConstraintsCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7709) | – | Array.isArray, Math.round, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, _normalizeGridExportControlCfg |
| [`normInv`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7795) | it | Number, Number.isFinite, String |
| [`buildGridConstraintsUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7820) | – | Math.max, Math.round, Number, String, _ensureGridConstraintsCfg, advanced.appendChild, advancedFields.appendChild, basic.appendChild, clearAll, commands.appendChild, document.createElement, evuEl.appendChild, field.querySelector, fixedReserveW.toLocaleString (weitere in der Quelle) |
| [`mkMsg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7847) | text | document.createElement |
| [`clearAll`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7866) | – | – |
| [`mkLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7902) | text | document.createElement |
| [`mkFieldWrap`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7923) | labelText | document.createElement, mkLabel, wrap.appendChild |
| [`mkChk`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7942) | labelText, inputId, checked, onChange | cb.addEventListener, document.createElement, document.createTextNode, lbl.appendChild, mkFieldWrap, wrap.appendChild |
| [`mkNum`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7977) | labelText, inputId, value, onChange, unit, placeholder | String, document.createElement, input.addEventListener, mkFieldWrap, row.appendChild, wrap.appendChild |
| [`mkSelect`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8021) | labelText, inputId, value, options, onChange | String, document.createElement, mkFieldWrap, sel.addEventListener, sel.appendChild, wrap.appendChild |
| [`mkDpField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8053) | labelText, inputId, value, onChange, placeholder | String, b.setAttribute, document.createElement, dpWrap.appendChild, input.addEventListener, mkFieldWrap, wrap.appendChild |
| [`mkHint`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8103) | text | document.createElement |
| [`renderExportGuardRuntimeDiagnostics`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8119) | target | Date.now, document.createElement, fetchJson, target.appendChild |
| [`fmtW`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8127) | v | Math.abs, Math.round, Number, Number.isFinite |
| [`readVal`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8133) | data, key | Object.prototype.hasOwnProperty.call |
| [`parseJson`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8137) | raw | JSON.parse |
| [`renderGridImportRuntimeDiagnostics`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8346) | target | Date.now, document.createElement, fetchJson, target.appendChild |
| [`fmtW`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8354) | v | Math.abs, Math.round, Number, Number.isFinite |
| [`readVal`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8361) | data, key | Object.prototype.hasOwnProperty.call |
| [`stageLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8365) | stage | String |
| [`mkZeroSection`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8480) | parent, titleText, id, collapsed | document.createElement, parent.appendChild, section.appendChild |
| [`mkZeroFields`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8493) | parent | document.createElement, parent.appendChild |
| [`mkTitle`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8603) | text | document.createElement |
| [`mkBadge`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8622) | label, ok | document.createElement |
| [`mkInvItem`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8641) | list, idx, groupPrefix, groupLabel | Number.isFinite, String, advGrid.appendChild, advanced.appendChild, chips.appendChild, delBtn.addEventListener, document.createElement, editBtn.addEventListener, editBtn.setAttribute, kwpInput.addEventListener, kwpInput.setAttribute, meta.appendChild, mkBadge, mkDpField (weitere in der Quelle) |
| [`mkInvGroup`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8790) | target, titleText, list, groupPrefix, groupLabel, inactiveHint | add.addEventListener, document.createElement, listWrap.appendChild, mkHint, mkInvItem, mkTitle, target.appendChild |
| [`_ensurePara14aCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8894) | – | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, PARA14A_TYPES.some, String, ic.para14aActiveId.trim, ic.para14aEmsSetpointWId.trim, out.push |
| [`_mkDpWrap`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8956) | id, value, placeholder, onChange | String, b.setAttribute, document.createElement, dpWrap.appendChild, input.addEventListener |
| [`rebuildPara14aConsumersUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8995) | – | Array.isArray, _ensurePara14aCfg, document.createElement, els.para14aConsumers.appendChild, visibleRows.forEach |
| [`buildPara14aUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9186) | – | Math.round, Number, Number.isFinite, String, _ensurePara14aCfg, document.createElement, els.para14aConsumers.appendChild, lock, rebuildPara14aConsumersUI |
| [`lock`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9210) | el | – |
| [`getStorageMode`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9248) | – | String |
| [`getStorageCoupling`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9260) | – | String |
| [`normalizeStorageVendorProfile`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9271) | v | String |
| [`normalizeFeneconControlMode`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9280) | v | String |
| [`isFeneconGridTargetId`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9287) | value | String |
| [`isFeneconDirectEssSetpointId`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9295) | value | String |
| [`isFeneconGridMeasurementId`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9303) | value | String, isFeneconGridTargetId |
| [`isFeneconHybridUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9311) | profile, coupling | String, normalizeStorageVendorProfile |
| [`getStorageVendorProfile`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9321) | – | String, normalizeStorageVendorProfile |
| [`updateStorageCouplingUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9332) | – | getStorageCoupling |
| [`updateStorageVendorProfileUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9343) | – | String, getStorageCoupling, getStorageVendorProfile, isFeneconHybridUi |
| [`rebuildStorageTable`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9379) | – | STORAGE_DP_FIELDS.filter, buildDpTable, getStorageCoupling, getStorageMode, getStorageVendorProfile, updateStorageCouplingUi, updateStorageVendorProfileUi |
| [`_ensureStorageFarmCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9421) | – | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, String, String.fromCharCode, _clampInt, _normalizeRecoveredStorageFarmRow, grpOut.push, storOut.push |
| [`buildStorageFarmUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9484) | – | Math.max, Math.min, Math.round, Number, Number.isFinite, String, _ensureStorageFarmCfg, _licenseEdition, _maxStorageCount, btn.addEventListener, card.appendChild, detail.appendChild, document.createElement, document.getElementById (weitere in der Quelle) |
| [`mkField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9587) | labelText | document.createElement, wrap.appendChild |
| [`mkDpField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9611) | labelText, id, value, onChange, placeholder | String, b.setAttribute, document.createElement, dpWrap.appendChild, input.addEventListener, mkField, wrap.appendChild |
| [`mkTextField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9657) | labelText, id, value, onChange, placeholder | String, document.createElement, input.addEventListener, mkField, wrap.appendChild |
| [`mkNumField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9683) | labelText, id, value, onChange, placeholder | String, document.createElement, input.addEventListener, mkField, wrap.appendChild |
| [`mkSelectField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9712) | labelText, id, value, options, onChange | String, document.createElement, mkField, sel.addEventListener, wrap.appendChild |
| [`mkCheckField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9742) | labelText, id, checked, onChange | box.addEventListener, document.createElement, document.createTextNode, lbl.appendChild, mkField, wrap.appendChild |
| [`mkGridDivider`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9775) | text | document.createElement |
| [`mkGridHelp`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9802) | text | document.createElement |
| [`_ensureStorageMultiUseCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10152) | – | _clampInt |
| [`_renderStorageMultiUseSummary`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10212) | mu | _clampInt, document.createElement, els.muStorageSummary.appendChild |
| [`buildStorageMultiUseUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10253) | – | _ensureStorageMultiUseCfg, document.createElement, els.muStorageSummary.appendChild, setDisabled, syncFromCfgToUi |
| [`setDisabled`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10273) | d | – |
| [`syncFromCfgToUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10300) | – | _ensureStorageMultiUseCfg, _renderStorageMultiUseSummary, numOrEmpty |
| [`syncFromUiToCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10331) | – | Math.max, _clampInt, _ensureStorageMultiUseCfg, _renderStorageMultiUseSummary, numOrEmpty, scheduleValidation |
| [`_clampInt`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10410) | v, min, max, def | Math.max, Math.min, Math.round, Number, Number.isFinite |
| [`_ensureSettingsConfig`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10422) | – | – |
| [`_ensureChargingManagementConfig`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10433) | – | – |
| [`_ensureEvcsList`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10444) | count | Array.isArray, _clampInt, _ensureSettingsConfig, _maxEvcsCount, list.push |
| [`_updateEvcsField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10459) | idx, field, value | _clampInt, _ensureEvcsList, _ensureSettingsConfig, _maxEvcsCount |
| [`_buildEvcsBoostLimitInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10475) | row, onChange | Math.max, Number, Number.isFinite, String, document.createElement, input.addEventListener, raw.trim |
| [`buildEvcsUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10494) | – | Array.isArray, Number, Number.isFinite, String, _clampInt, _ensureEvcsList, _ensureSettingsConfig, _maxEvcsCount, actions.appendChild, body.appendChild, btnAddPort.addEventListener, btnSD.addEventListener, btnSU.addEventListener, card.appendChild (weitere in der Quelle) |
| [`mkRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10541) | label, controlEl | controlEl.classList.add, controlEl.matches, ctl.appendChild, ctl.classList.add, document.createElement, row.appendChild |
| [`mkIo`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10573) | id, value, onChange | btn.addEventListener, document.createElement, input.addEventListener, valueOrEmpty, wrap.appendChild |
| [`normKey`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10614) | k | String |
| [`ensureGroupForKey`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10658) | stationKey | groupIndexByKey.get, groupIndexByKey.has, groupIndexByKey.set, normKey, sc.stationGroups.push |
| [`moveStationGroup`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10680) | stationKey, dir | arr.forEach, buildEvcsUI, buildStationGroupsUI, groupIndexByKey.clear, groupIndexByKey.get, normKey |
| [`renameStationKey`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10712) | oldKey, newKey | buildEvcsUI, buildStationGroupsUI, groupIndexByKey.get, normKey |
| [`addPortToStation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10751) | stationKey | Math.min, Object.assign, String, _clampInt, _ensureEvcsList, _ensureSettingsConfig, _maxEvcsCount, buildEvcsUI, normKey |
| [`movePortWithinStation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10780) | portIdx, stationKey, dir | buildEvcsUI, normKey |
| [`createPortCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10819) | i, stationKey | Math.round, Number, Number.isFinite, String, _buildEvcsBoostLimitInput, _clampInt, actions.appendChild, adv.appendChild, allowBoostInp.addEventListener, body.addEventListener, body.appendChild, boostTInput.addEventListener, btnDown.addEventListener, btnUp.addEventListener (weitere in der Quelle) |
| [`mkSemanticInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11032) | field, placeholder | document.createElement, input.addEventListener, valueOrEmpty |
| [`mkSmallText`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11148) | field, placeholder | String, document.createElement, input.addEventListener |
| [`mkNumPhase`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11160) | field, placeholder, min, step, fallback | Number, Number.isFinite, String, document.createElement, input.addEventListener |
| [`refreshElectricalHint`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11308) | – | _ensureSettingsConfig, check.errors.join, window.NexoWattEvcsElectricalLimits.validateEvcsElectricalConfig |
| [`buildStationGroupsUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11493) | – | Array.isArray, _ensureSettingsConfig, arr.forEach, document.createElement, els.stationGroups.appendChild |
| [`collectSettingsConfigFromUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11595) | – | Array.isArray, Number, Number.isFinite, _clampInt, _ensureEvcsList, _ensureSettingsConfig, _maxEvcsCount, deepMerge, out.evcsList.filter |
| [`applyConfigToUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11621) | cfg | Math.max, Math.round, Number, Number.isFinite, String, _isAppLicensed, _licenseEdition, applyEnergyFlowTsModeToUi, applyTariffProviderUI, buildAiAdvisorUI, buildAppsUI, buildBhkwUI, buildDpTable, buildEvcsUI (weitere in der Quelle) |
| [`afterRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11715) | field, _row, container | buildFlowPvNameRow, container.appendChild |
| [`fetchOcppDiscovery`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11983) | – | Array.isArray, fetchJson |
| [`_ocppStationIdentityFromDp`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11994) | id | String, value.match |
| [`_ocppStationIdentityFromRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12005) | row | String, _ocppStationIdentityFromDp |
| [`_ocppStationIdentityFromConnector`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12023) | connector | _ocppStationIdentityFromDp |
| [`_isEmptyEvcsMappingRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12038) | row | – |
| [`_isKnownLegacyNexoWattOcppMapping`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12047) | field, currentId, replacementId | String, _ocppStationIdentityFromDp, current.toLowerCase, lower.endsWith, lower.startsWith, replacement.toLowerCase, replacementLower.startsWith |
| [`_applyOcppConnectorToRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12083) | row, c, opts | Math.max, Math.round, Number, Number.isFinite, Object.assign, String, setField |
| [`setField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12103) | k, v | String, _isKnownLegacyNexoWattOcppMapping, cur.trim |
| [`ocppAutoDetect`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12171) | – | Array.isArray, Math.max, Math.min, String, _applyOcppConnectorToRow, _ensureSettingsConfig, buildEvcsUI, buildStationGroupsUI, existingList.some, fetchOcppDiscovery, scheduleValidation, setStatus, window.confirm |
| [`ocppMapExisting`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12224) | – | JSON.stringify, Math.min, String, _applyOcppConnectorToRow, _clampInt, _ensureEvcsList, _ensureSettingsConfig, _ocppStationIdentityFromConnector, buildEvcsUI, buildStationGroupsUI, fetchOcppDiscovery, list.findIndex, list.push, list.slice (weitere in der Quelle) |
| [`_nwNormCat`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12307) | v | String |
| [`_nwDeviceClass`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12316) | dev | String |
| [`_isNwEvcsCategory`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12319) | cat | _nwNormCat |
| [`_isNwEvcsDevice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12323) | dev | _isNwEvcsCategory, _nwDeviceClass |
| [`_isNwPvDevice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12327) | dev | _isNwPvInverterCategory, _nwDeviceClass |
| [`_isNwHeatDevice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12331) | dev | _isNwHeatCategory, _nwDeviceClass |
| [`_isNwStorageDevice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12335) | dev | _nwDeviceClass |
| [`_isNwMeterDevice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12339) | dev | _isNwMeterCategory, _nwDeviceClass |
| [`_isNwPvInverterCategory`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12349) | cat | _nwNormCat |
| [`_isNwHeatCategory`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12358) | cat | _nwNormCat |
| [`_nwGetAlias`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12367) | dev, key | String |
| [`_nwGetWritableAlias`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12376) | dev, key | String, _nwGetAlias |
| [`_nwGetAliasUnit`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12381) | dev, key | String |
| [`_nwGetDpFallback`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12391) | dev, suffix | String |
| [`_applyNwDeviceToEvcsRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12402) | row, dev, opts | String, _nwGetAlias, _nwGetAliasUnit, _nwGetWritableAlias, _nwNormCat, currentChargeDemandId.startsWith, currentStatusId.startsWith, setIf |
| [`setIf`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12418) | k, v | String |
| [`_classifyHeatDevice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12524) | dev | String |
| [`_findFreeConsumerSlot`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12543) | range | String |
| [`_isNwMeterCategory`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12559) | cat | _nwNormCat |
| [`_isNwStorageCategory`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12569) | cat | _nwNormCat |
| [`_nwDevHaystack`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12579) | dev | String |
| [`_nwHasAlias`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12594) | dev, key | String, _nwGetAlias |
| [`_nwScoreGridMeter`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12603) | dev | _isNwMeterDevice, _isNwPvDevice, _isNwStorageDevice, _nwDevHaystack, _nwHasAlias, _nwNormCat |
| [`_nwScorePvSource`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12623) | dev | _isNwMeterDevice, _isNwPvDevice, _nwDevHaystack, _nwHasAlias, _nwNormCat |
| [`_nwScoreStorage`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12640) | dev | _isNwStorageDevice, _nwDevHaystack, _nwHasAlias, _nwNormCat |
| [`_nwPickBestDevice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12659) | devices, scorer, opts | Array.isArray, Number, Number.isFinite |
| [`_nwApplyFlowDpIfEmpty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12679) | key, value, opts | String, _setFlowPowerDpIsW, document.getElementById, inp.dispatchEvent |
| [`_nwApplyGeneralDpIfEmpty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12709) | key, value | String, els.gridPointConnectedId.dispatchEvent, els.gridPointWatchdogId.dispatchEvent |
| [`_nwAutoMapEnergyFlowFromDevices`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12751) | devices | Array.isArray, String, _ensureFlowSlots, _nwApplyFlowDpIfEmpty, _nwApplyGeneralDpIfEmpty, _nwGetAlias, _nwPickBestDevice, document.getElementById, list.filter, list.some, out.notes.push |
| [`_nwAutoMapStorageAppFromDevices`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12858) | devices | Array.isArray, String, _nwGetAlias, _nwGetWritableAlias, isFeneconDirectEssSetpointId, isFeneconGridMeasurementId, isFeneconGridTargetId, normalizeFeneconControlMode, normalizeStorageVendorProfile, result.notes.push, result.notes.unshift, setEmpty |
| [`setEmpty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12870) | key, value | String |
| [`nwDevicesQuickSetup`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12992) | – | Array.isArray, JSON.stringify, Math.max, Math.round, Number, Number.isFinite, String, _applyNwDeviceToEvcsRow, _clampInt, _classifyHeatDevice, _countHeatingRodWiredStages, _ensureEvcsList, _ensureFlowSlots, _ensureGridConstraintsCfg (weitere in der Quelle) |
| [`addOrUpdate`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13078) | dev | JSON.stringify, String, _nwGetAlias, _nwGetWritableAlias, list.find, list.push |
| [`findPara14aMatch`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13154) | dev, setId, enableId | String |
| [`loadConfig`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13319) | – | Date.now, _inferLicenseFromSuccessfulInstallerGate, _licenseIsUsable, applyConfigToUI, clearDirty, fetchJson, fetchLicenseInfoFallback, fetchLicenseInfoFromStateFallback, hydrateStorageFarmConfigFromRuntimeState, normalizeLicenseInfo, scheduleValidation, setStatus |
| [`applyReleaseSafetyGateToPatch`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13364) | patch | Array.isArray, restoreArrayIfDangerouslyEmpty, srcRows.slice |
| [`restoreArrayIfDangerouslyEmpty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13366) | section, key, markerName | Array.isArray, console.warn, currentRows.slice |
| [`collectPatchFromUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13410) | – | Array.from, Array.isArray, JSON.parse, Math.max, Math.min, Math.round, Number, Number.isFinite, Object.assign, String, _clampInt, _coupleTariffProviderDatapointsSync, _ensureFlowSlots, _ensurePara14aCfg (weitere in der Quelle) |
| [`readNlP1`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13459) | name | String, document.querySelector |
| [`readNlP1Dp`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13463) | name | String, document.querySelector |
| [`nlp1Number`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13467) | name, fallback, min, max | Math.max, Math.min, Math.round, Number, Number.isFinite, readNlP1 |
| [`readMesh`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13563) | row, field | String, row.querySelector |
| [`safeMeshId`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13567) | value, fallback | String |
| [`readMeshPowerLimit`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13613) | row, field | Math.round, Number, Number.isFinite, readMesh |
| [`splitLpList`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13651) | raw | String |
| [`readCk`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13655) | row, field | String, row.querySelector |
| [`readCkPrice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13659) | row, field | Math.max, Math.min, Math.round, Number, Number.isFinite, readCk |
| [`readCkInt`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13664) | row, field, fallback, min, max | Math.max, Math.min, Math.round, Number, Number.isFinite, readCk |
| [`_storageFarmStorageCount`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13980) | cfg | Array.isArray, sf.storages.filter |
| [`applyAppCenterRegressionSafetyGate`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13992) | patch | Date.now, _storageFarmStorageCount, deepMerge, guarded.push |
| [`_sgArray`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14038) | v | Array.isArray |
| [`_sgObject`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14039) | v | – |
| [`_sgNonEmptyString`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14040) | v | String |
| [`_sgCountStorages`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14041) | cfg | _sgArray, _sgObject |
| [`_sgCountGroups`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14042) | cfg | _sgArray, _sgObject |
| [`_sgCountEvcs`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14043) | cfg | Math.max, Number, _sgArray, _sgObject |
| [`_sgCountChargeKiosk`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14047) | cfg | _sgArray, _sgObject |
| [`_sgCountMeshNodes`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14048) | cfg | _sgArray, _sgObject |
| [`_sgCountMeshPeers`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14049) | cfg | Math.max, _sgArray, _sgObject |
| [`_sgCountNlP1Mappings`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14055) | cfg | Object.keys, _sgObject |
| [`_sgRestore`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14059) | report, path, reason | report.restored.push |
| [`applyReleaseRegressionSafetyGate`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14063) | patch | _sgArray, _sgCountChargeKiosk, _sgCountEvcs, _sgCountGroups, _sgCountMeshNodes, _sgCountMeshPeers, _sgCountNlP1Mappings, _sgCountStorages, _sgObject, _sgRestore, deepMerge, report.warnings.push |
| [`validateFeneconStorageConfiguration`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14138) | patch | Array.isArray, Math.max, Object.prototype.hasOwnProperty.call, String, _normalizeRecoveredStorageFarmRow, isDirectEssSetpoint, isGridMeasurement, isGridTarget, normalizeFeneconControlMode, rows.filter, sf.storages.filter, validateOne |
| [`normalizeId`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14140) | value | String |
| [`sameId`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14141) | a, b | normalizeId |
| [`isPowerBalance`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14146) | value | normalizeId |
| [`isDirectEssSetpoint`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14154) | value | isFeneconDirectEssSetpointId |
| [`isGridTarget`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14155) | value | isFeneconGridTargetId |
| [`isGridMeasurement`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14156) | value | isFeneconGridMeasurementId |
| [`validateOne`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14157) | { name = 'Speicher', vendorProfile, coupling, mode, nativeTarget, essActual, directTargets = [], otherWritableStorageCount = 0 } | String, directIds.push, directIds.some, directTargets.map, isDirectEssSetpoint, isGridMeasurement, isGridTarget, isPowerBalance, normalizeStorageVendorProfile, sameId |
| [`flushDpInputsToConfig`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14286) | – | Array.from, document.querySelectorAll, input.dispatchEvent |
| [`saveConfig`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14299) | – | Array.isArray, JSON.stringify, _maxStorageCount, _storageFarmStorageCount, applyAppCenterRegressionSafetyGate, applyConfigToUI, applyReleaseRegressionSafetyGate, beginAppCenterMutation, check.errors.join, clearDirty, collectPatchFromUI, endMutation, fetchJson, flushDpInputsToConfig (weitere in der Quelle) |
| [`_showTab`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14340) | tabId | Array.from, btns.forEach, document.querySelectorAll, els.tabs.querySelectorAll, panels.forEach, refreshChargingDiag, refreshEmsStatus |
| [`initTabs`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14366) | – | Array.from, _showTab, btns.forEach, btns.some, els.tabs.querySelectorAll |
| [`initFlowSubtabs`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14388) | – | Array.from, btns.forEach, document.getElementById, document.querySelectorAll, show, wrap.querySelectorAll |
| [`show`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14407) | id | String, btns.forEach, panels.forEach |
| [`_fmtTs`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14433) | ts | Number.isFinite, d.getTime, d.toLocaleString |
| [`renderEmsStatus`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14446) | payload | Array.isArray, Number.isFinite, String, _fmtTs, els.emsStatus.appendChild, mkItem |
| [`mkItem`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14455) | titleText, subtitleText, rightHtml, statusKind | document.createElement, left.appendChild, row.appendChild |
| [`_asBool`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14520) | v | v.trim |
| [`_asNum`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14532) | v, fallback | Number, Number.isFinite |
| [`renderChargingDiag`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14542) | payload | Array.isArray, Math.round, Number.isFinite, String, _asBool, _asNum, els.chargingDiag.appendChild, flags.join, flags.push, mkItem, targetA.toFixed |
| [`mkItem`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14551) | titleText, subtitleText, rightHtml, statusKind | document.createElement, left.appendChild, row.appendChild |
| [`_fmtW`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14642) | v | Math.abs, Math.round, Number, Number.isFinite |
| [`_fmtKwh`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14654) | v | Number, Number.isFinite, n.toFixed |
| [`_fmtEurKwh`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14665) | v | Number, Number.isFinite, n.toFixed |
| [`_fmtIsoShort`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14676) | v | Number.isFinite, String, d.getTime, d.toLocaleString |
| [`_fmtPct`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14689) | v | Math.round, Number, Number.isFinite |
| [`renderStationsDiag`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14700) | payload | Array.isArray, Math.round, Number, Number.isFinite, String, _fmtW, els.stationsDiag.appendChild, mkItem |
| [`mkItem`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14709) | titleText, subtitleText, rightHtml, statusKind | document.createElement, left.appendChild, row.appendChild |
| [`_fmtBool`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14776) | v, tTrue, tFalse | – |
| [`_parseShadowJson`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14794) | raw, fallback | JSON.parse, String, text.slice |
| [`_shadowDiffList`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14820) | shadow | Object.keys, String, add, readList |
| [`add`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14823) | label, jsVal, tsVal, diff | String, out.push |
| [`readList`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14826) | arr, prefix | Array.isArray, arr.forEach |
| [`_shadowKind`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14861) | shadow | _shadowDiffList |
| [`_shadowStatusLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14879) | kind, shadow | – |
| [`_shadowHumanExplanation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14900) | title, shadow, diffs | Array.isArray, String |
| [`_formatShadowJsonForDisplay`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14922) | value | JSON.stringify |
| [`_shadowDecodeDisplayText`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14938) | value | String, decodeURIComponent |
| [`_shadowEscape`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14956) | value | _shadowDecodeDisplayText |
| [`_openShadowJsonDialog`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14977) | title, payload | _formatShadowJsonForDisplay, _shadowEscape, backdrop.addEventListener, backdrop.querySelector, document.body.appendChild, document.createElement, document.getElementById, existing.remove, text.focus, text.setSelectionRange |
| [`close`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14999) | – | backdrop.remove |
| [`_normalizeEnergyFlowTsModeUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15030) | value | String |
| [`applyEnergyFlowTsModeToUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15046) | cfg | Math.max, Math.min, Math.round, Number, String, _normalizeEnergyFlowTsModeUi, renderEnergyFlowTsModeStatus |
| [`collectEnergyFlowTsMigrationFromUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15069) | base | Math.max, Math.min, Math.round, Number, Number.isFinite, _normalizeEnergyFlowTsModeUi, deepMerge |
| [`renderEnergyFlowTsModeStatus`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15096) | readiness | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, String, _decodeShadowDisplayText, _normalizeEnergyFlowTsModeUi, _shadowEscape, escape, plan.blockedReasons.map, safety.warnings.join |
| [`_renderShadowPlantEvaluationCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15145) | evaluation | Array.isArray, Number, String, btn.addEventListener, card.querySelector, document.createElement, escape, evaluation.recentSamples.slice, lines.map, recent.map |
| [`_renderHeatingRodTsRuntimeEvaluationCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15200) | evaluation | Array.isArray, Number, String, btn.addEventListener, card.querySelector, document.createElement, escape, evaluation.fallbackReasons.filter, rows.map |
| [`_renderEnergyFlowTsActiveTestCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15299) | activeTest, fixedSource | Array.isArray, Number, String, _decodeShadowDisplayText, activeTest.recentSamples.slice, blockers.join, btn.addEventListener, card.querySelector, document.createElement, escape, latest.blockers.map, lines.map, recent.map |
| [`_renderShadowReadinessCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15353) | readiness | Array.isArray, candidateSafety.blockers.map, candidateSafety.warnings.map, document.createElement, escape, items.map, readiness.blockers.map, readiness.warnings.map |
| [`renderShadowDiagnostics`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15426) | payload | Object.assign, _parseShadowJson, _rememberOpenShadowDetails, _renderEnergyFlowTsActiveTestCard, _renderHeatingRodTsRuntimeEvaluationCard, _renderShadowPlantEvaluationCard, _renderShadowReadinessCard, cards.forEach, document.createElement, els.shadowDiagnostics.appendChild, renderEnergyFlowTsModeStatus |
| [`renderChargingBudget`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15555) | payload | Array.isArray, JSON.parse, Math.max, Math.min, Math.round, Number, Number.isFinite, String, _fmtAge, _fmtBool, _fmtEurKwh, _fmtIsoShort, _fmtKwh, _fmtPct (weitere in der Quelle) |
| [`mkCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15584) | titleText, lines, statusKind | b.appendChild, card.appendChild, document.createElement, h.appendChild, statusKind.toUpperCase, top.appendChild |
| [`n`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15649) | x | Number |
| [`b`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15656) | x | – |
| [`refreshChargingDiag`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15934) | – | fetchJson, renderChargingBudget, renderChargingDiag, renderStationsDiag |
| [`refreshEmsStatus`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15948) | – | fetchJson, renderEmsStatus, window.NexoWattNvpDiagnostics?.render |
| [`startStatusPolling`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15960) | – | clearInterval, setInterval |
| [`openDpModal`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15979) | targetInputId, options | closeDpModal, currentId.split, currentInput.value.trim, currentParts.slice, document.getElementById, dpSelectableIds.clear, els.dpModal.classList.remove, els.dpModal.querySelector, els.dpModal.setAttribute, options.currentId.trim, refreshTree |
| [`closeDpModal`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16015) | selected | callback, dpSelectableIds.clear, els.dpModal.classList.add, els.dpModal.setAttribute, validDpSelectionId |
| [`setDpTargetValue`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16034) | id | closeDpModal, document.getElementById, dpSelectableIds.has, inp.dispatchEvent, validDpSelectionId |
| [`renderBreadcrumb`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16052) | – | els.dpBreadcrumb.appendChild, mkCrumb, sep |
| [`mkCrumb`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16063) | label, prefix, clickable | b.addEventListener, document.createElement |
| [`sep`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16085) | – | document.createElement |
| [`mkDpResultRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16110) | primary, meta, onClick | document.createElement, row.addEventListener, row.appendChild |
| [`refreshTree`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16139) | – | Array.isArray, String, document.createElement, dpSelectableIds.add, els.dpTree.appendChild, encodeURIComponent, fetchJson, metaBits.join, metaBits.push, mkDpResultRow, renderBreadcrumb, validDpSelectionId |
| [`doSearch`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16210) | – | Array.isArray, String, document.createElement, dpSelectableIds.add, els.dpResults.appendChild, encodeURIComponent, fetchJson, metaBits.join, metaBits.push, mkDpResultRow, validDpSelectionId |
| [`upOne`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16252) | – | parts.join, parts.pop, treePrefix.split |
| [`acceptDataPointPickerMessage`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16266) | event | closeDpModal, els.dynamicGridMount.querySelector, event.source.postMessage, openDpModal, request.source.postMessage |
| [`respond`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16281) | id | els.dynamicGridMount.querySelector, request.source.postMessage, window.close |
| [`getInstallerAdminUrl`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16323) | – | String, params.get, ref.hash.indexOf, ref.pathname.includes, window.NW_RUNTIME.adminBase |
| [`initInstallerBackLink`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16383) | – | getInstallerAdminUrl, link.addEventListener, link.setAttribute, window.NW_RUNTIME?.url |
| [`_updateStorageCoupling`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16440) | – | getStorageCoupling, rebuildStorageTable, scheduleValidation, updateStorageCouplingUi |
| [`_update`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16459) | – | Number, Number.isFinite |
| [`_updateStorageRatedPower`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16482) | – | Math.abs, Math.min, Math.round, Number, Number.isFinite, String, _storagePowerProfileInfo, scheduleValidation, updateStorageLicensePowerUi |
| [`_updateStorageSelfNvpControl`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16511) | – | _clampInt, scheduleValidation |
| [`_updateStorageVendorProfile`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16560) | – | String, _clampInt, getStorageCoupling, getStorageVendorProfile, rebuildStorageTable, scheduleValidation, updateStorageVendorProfileUi |
| [`backupRefreshInfo`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L17008) | – | String, fetchJson |
| [`backupExport`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L17040) | – | backupRefreshInfo, downloadJsonFile, fetchJson, setBackupStatus, ts.toISOString |
| [`backupDoImportFromObj`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L17064) | obj | JSON.stringify, backupRefreshInfo, beginAppCenterMutation, endMutation, fetchJson, loadConfig, requireDynamicGridSaveVersion, requirePartnerSaveVersion, setBackupStatus |
| [`backupImportFromFile`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L17082) | file | JSON.parse, backupDoImportFromObj, readFileAsText, setBackupStatus |
| [`backupRestoreFromUserdata`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L17101) | – | backupDoImportFromObj, fetchJson, setBackupStatus, window.confirm |
| [`requireAppCenterAccessBeforeLoad`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L17275) | – | Array.isArray, Date.now, caps.includes, fetch, r.json, window.NW_AUTH.requireCapability |
| [`updateAdminOnlyActions`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L17292) | – | document.getElementById, window.NW_AUTH.getState |
