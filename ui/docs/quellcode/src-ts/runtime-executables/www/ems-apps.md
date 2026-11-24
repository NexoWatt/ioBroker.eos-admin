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
| [`dynamicGridVersion`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1019) | value | Number.isSafeInteger |
| [`requireDynamicGridSaveVersion`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1022) | – | – |
| [`acceptDynamicGridChangeMessage`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1027) | event | Math.max, dynamicGridVersion, els.dynamicGridMount.querySelector, setStatus |
| [`partnerFrames`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1039) | – | – |
| [`requirePartnerSaveVersion`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1055) | – | – |
| [`validDpSelectionId`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1075) | id | id.trim |
| [`_licenseEdition`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1114) | – | String |
| [`_maxStorageCount`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1126) | – | _licenseEdition |
| [`_appLicenseFeature`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1131) | appId | String |
| [`_isFeatureLicensed`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1135) | feature | HOME_LICENSE_FEATURES.has, Object.prototype.hasOwnProperty.call, String, _licenseEdition |
| [`_isAppLicensed`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1145) | appId | HEMS_APP_IDS.has, String, _appLicenseFeature, _isFeatureLicensed, _licenseEdition |
| [`_maxEvcsCount`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1152) | – | Math.max, Math.min, Math.round, Number, Number.isFinite |
| [`_licenseLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1157) | – | _licenseEdition |
| [`_storagePowerProfileInfo`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1164) | – | Math.max, Number, Number.isFinite, String, _licenseEdition |
| [`updateStorageLicensePowerUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1184) | – | Number, Number.isFinite, _storagePowerProfileInfo, els.storageRatedPowerKW.removeAttribute |
| [`normalizeLicenseInfo`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1212) | raw | JSON.parse, Math.max, Math.round, Number, Number.isFinite, Object.keys, String, asBool, featuresJsonRaw.trim, unwrap |
| [`unwrap`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1214) | value | Object.prototype.hasOwnProperty.call |
| [`asBool`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1221) | value | String, unwrap |
| [`_licenseIsUsable`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1281) | info | – |
| [`_inferLicenseFromSuccessfulInstallerGate`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1285) | data, cfg | normalizeLicenseInfo |
| [`fetchLicenseInfoFallback`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1296) | – | Date.now, fetchJson, normalizeLicenseInfo |
| [`fetchLicenseInfoFromStateFallback`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1305) | – | Date.now, String, fetchJson, normalizeLicenseInfo, readVal |
| [`readVal`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1308) | key | Object.prototype.hasOwnProperty.call |
| [`_readApiStateValue`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1349) | statePayload, key, fallback | Object.keys, Object.prototype.hasOwnProperty.call, String |
| [`_parseStorageFarmRuntimeList`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1366) | raw | Array.isArray, JSON.parse, String |
| [`_recoverStorageFarmRowsFromStatusRows`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1379) | statusRows | Array.isArray |
| [`_normalizeRecoveredStorageFarmRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1405) | row, index | boolFrom, normalizeStorageVendorProfile, numberFrom, numberOrDefault, textFrom |
| [`textFrom`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1408) | keys | String |
| [`numberFrom`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1419) | keys | Number, Number.isFinite, String, raw.includes, raw.lastIndexOf, raw.replace |
| [`numberOrDefault`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1439) | fallback, keys | numberFrom |
| [`boolFrom`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1443) | fallback, keys | Object.prototype.hasOwnProperty.call, String |
| [`hydrateStorageFarmConfigFromRuntimeState`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1508) | cfg | Array.from, Array.isArray, Date.now, Math.max, Math.min, Math.round, Number, Number.isFinite, String, _parseStorageFarmRuntimeList, _readApiStateValue, _recoverStorageFarmRowsFromStatusRows, fetchJson, runtimeGroups.slice (weitere in der Quelle) |
| [`refreshLicenseForAppCenter`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1561) | reason | JSON.stringify, _licenseEdition, _licenseIsUsable, _licenseLabel, buildAppsUI, buildEvcsUI, fetchLicenseInfoFallback, fetchLicenseInfoFromStateFallback, normalizeLicenseInfo, scheduleValidation, setStatus, updateStorageLicensePowerUi |
| [`_decodeShadowDisplayText`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1588) | value | String, decodeURIComponent |
| [`_rememberOpenShadowDetails`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1594) | – | document.querySelectorAll |
| [`_ensureSettingsObj`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1610) | – | – |
| [`_ensureFlowPowerDpIsW`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1616) | – | _ensureSettingsObj |
| [`_getFlowPowerDpIsW`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1622) | key | Object.prototype.hasOwnProperty.call, _ensureSettingsObj |
| [`_setFlowPowerDpIsW`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1632) | key, isW | _ensureFlowPowerDpIsW, document.querySelectorAll |
| [`_collectFlowPowerDpIsWFromUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1642) | – | document.querySelectorAll |
| [`setStatus`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1652) | msg, kind | – |
| [`beginAppCenterMutation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1663) | – | closeDpModal, document.querySelector, main.setAttribute |
| [`setDirty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1675) | – | els.save.setAttribute |
| [`clearDirty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1683) | – | els.save.setAttribute |
| [`setBackupStatus`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1692) | msg, kind | – |
| [`downloadJsonFile`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1699) | filename, obj | JSON.stringify, URL.createObjectURL, a.click, document.body.appendChild, document.createElement, setTimeout, window.NW_RUNTIME?.url |
| [`readFileAsText`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1716) | file | – |
| [`fetchJson`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1729) | url, opts | Object.assign, String, data.message.slice, fetch, res.json |
| [`_fmtAge`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1754) | ageMs | Math.round, Number, Number.isFinite |
| [`_setBadge`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1766) | inputId, kind, text | document.getElementById, el.classList.add, el.classList.remove |
| [`scheduleValidation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1774) | delayMs | Number.isFinite, clearTimeout, setTimeout |
| [`runValidation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1780) | showStatusMessage | Array.from, JSON.stringify, String, _fmtAge, _setBadge, document.querySelectorAll, fetchJson, ids.push, seen.add, seen.has, setStatus, window.NexoWattPowerMeasurements?.validatePowerReference |
| [`deepMerge`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1864) | target, patches | Array.isArray, JSON.parse, JSON.stringify, Object.keys, deepMerge |
| [`valueOrEmpty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1880) | v | String |
| [`numOrEmpty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1884) | v | Number.isFinite, String |
| [`_aiSetNumberInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1888) | el, value, def | Number, Number.isFinite, String |
| [`_aiSetCheckbox`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1895) | el, value, def | – |
| [`_aiSetInputValue`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1900) | el, value, def | String |
| [`buildAiAdvisorUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1908) | – | String, _aiSetCheckbox, _aiSetInputValue, _aiSetNumberInput |
| [`collectAiAdvisorConfigFromUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1973) | base | String, deepMerge, n, str |
| [`n`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1976) | el, def, min, max, roundValue | Math.max, Math.min, Math.round, Number, Number.isFinite |
| [`str`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L1984) | el, def | String |
| [`_nwHtmlEscape`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2061) | input | String |
| [`_nwSystemProfileCountry`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2078) | – | String |
| [`buildSystemProfileCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2084) | – | String, _nwSystemProfileCountry, card.querySelector, card.setAttribute, document.createElement, lang.toUpperCase, sel.addEventListener |
| [`buildNlP1Card`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2147) | – | Number, Number.isFinite, _nwHtmlEscape, _nwSystemProfileCountry, card.setAttribute, document.createElement |
| [`_chargeKioskHtmlEscape`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2191) | input | String |
| [`_chargeKioskStations`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2200) | – | Array.isArray |
| [`_chargeKioskToken`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2212) | – | Array.from, crypto.getRandomValues |
| [`_chargeKioskAssignedToText`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2221) | v | Array.isArray, arr.map |
| [`_chargeKioskStationCatalog`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2226) | – | Array.from, Array.isArray, byKey.values, evcs.forEach, groups.forEach |
| [`ensure`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2233) | rawKey | String, byKey.get, byKey.has, byKey.set |
| [`_chargeKioskAssignedForStation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2259) | stationKey | String, _chargeKioskStationCatalog, item.chargepoints.map |
| [`_chargeKioskStationOptionsHtml`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2265) | selectedKey | String, _chargeKioskStationCatalog, options.join |
| [`buildChargeKioskCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2275) | – | _chargeKioskStations, _licenseEdition, add.addEventListener, card.querySelector, card.querySelectorAll, card.setAttribute, document.createElement, stations.map |
| [`refreshChargeKioskAssignmentRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2373) | row | String, _chargeKioskAssignedForStation, _chargeKioskAssignedToText, row.querySelector |
| [`_meshHtmlEscape`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2441) | input | String |
| [`_meshNodes`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2449) | – | Array.isArray |
| [`_meshNodeRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2454) | node, index | Array.isArray, _meshHtmlEscape, n.targetGroupIds.join |
| [`buildMeshMicrogridCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2514) | – | _meshNodes, buildLegacyMeshMicrogridCard, card.appendChild, document.createElement, encodeURIComponent, legacy.appendChild, window.NW_RUNTIME?.url |
| [`buildDynamicGridCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2542) | – | card.appendChild, document.createElement, encodeURIComponent, frame.setAttribute, window.NW_RUNTIME?.url |
| [`buildPartnerIntegrationCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2564) | appId | card.appendChild, document.createElement, encodeURIComponent, frame.setAttribute, window.NW_RUNTIME?.url |
| [`buildLegacyMeshMicrogridCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2584) | – | Array.isArray, JSON.stringify, String, _licenseEdition, _meshHtmlEscape, _meshNodes, add.addEventListener, card.querySelector, cfg.tailscale.peerUrls.join, document.createElement |
| [`buildAppCenterStructurePanels`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2693) | – | _isAppLicensed, buildChargeKioskCard, buildDynamicGridCard, buildMeshMicrogridCard, buildNlP1Card, buildPartnerIntegrationCard, buildSystemProfileCard, els.arbitrageMount.querySelector, els.directMarketingPartnerMount.querySelector, els.dynamicGridMount.querySelector, els.ledgerPartnerMount.querySelector, mount, window.NexoWattNetOperatorAppCenter.render, window.NexoWattOperatingStrategiesAppCenter.render |
| [`mount`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2694) | el, card | el.appendChild |
| [`setupInstallerBackButton`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2781) | – | btn.addEventListener, btn.setAttribute, buildTarget, window.NW_RUNTIME?.url |
| [`parseQuery`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2786) | – | – |
| [`detectInstance`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2790) | – | Math.max, Math.round, Number, Number.isFinite, String, hash.match, parseQuery, qs.get |
| [`detectAdminOrigin`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2803) | – | String, parseQuery, qs.get |
| [`buildTarget`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2836) | – | – |
| [`buildAppsUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2850) | – | APP_CATALOG.filter, _licenseEdition, _licenseLabel, _maxEvcsCount, actions.appendChild, appendAppConfigNavigation, buildAppCenterStructurePanels, card.appendChild, card.setAttribute, document.createElement, els.appsList.appendChild, getSt, header.appendChild, mkToggle (weitere in der Quelle) |
| [`getSt`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2854) | appId | – |
| [`appendAppConfigNavigation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2899) | body, app, st | String, body.appendChild, btn.addEventListener, btn.setAttribute, document.createElement, op.setAttribute, row.appendChild, row.setAttribute, window.NW_RUNTIME?.url |
| [`mkToggle`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L2963) | id, label, checked, disabled, onLabel, offLabel, toggleKind | bOff.classList.add, bOff.setAttribute, bOn.classList.add, bOn.setAttribute, document.createElement, grp.appendChild, grp.classList.add, grp.setAttribute, wrap.appendChild, wrap.setAttribute |
| [`setAppsFromConfig`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3104) | cfg | applyAppDependentVisibility, document.getElementById, window.nwSyncToggleButtons |
| [`applyAppDependentVisibility`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3130) | – | appsTab.click, document.querySelector, isInstalled, toggleCard |
| [`isInstalled`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3132) | appId | document.getElementById |
| [`toggleCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3137) | cardKey, show | document.querySelector |
| [`_psDefaultWindow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3195) | – | – |
| [`_psGetPeakCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3209) | – | – |
| [`_psGetWindowsFromCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3216) | cfg | Array.isArray |
| [`buildAtypicalWindowsUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3223) | – | _psGetPeakCfg, _psGetWindowsFromCfg, document.createElement, els.psAtypicalWindows.appendChild, wins.forEach |
| [`_psCollectWindowRows`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3316) | – | Array.from, String, _psParseNumberList, els.psAtypicalWindows.querySelectorAll, get, out.push |
| [`get`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3322) | field | row.querySelector |
| [`_psUpdateAtypicalFieldState`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3348) | – | String, atypicalIds.forEach, els.psAtypicalWindows.querySelectorAll, standardIds.forEach |
| [`buildPeakShavingUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3383) | – | Math.round, Number, Number.isFinite, String, _psFormatDateList, _psGetPeakCfg, _psNumOrNull, _psSetNumberInput, _psSetSelect, _psSetTextInput, _psThresholdForVoltage, _psUpdateAtypicalFieldState, _psUpdateAtypicalReviewPreview, _psVoltageKey (weitere in der Quelle) |
| [`collectPeakShavingConfigFromUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3451) | baseCfg | Math.max, Math.min, Math.round, Object.keys, String, _psCollectWindowRows, _psNumOrNull, _psParseDateList, _psThresholdForVoltage, _psVoltageKey, deepMerge, setNum, setStr |
| [`setNum`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3459) | key, el, min, max | Math.max, Math.min, Number, Number.isFinite |
| [`setStr`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3500) | key, el | String |
| [`buildDpTable`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3545) | container, fields, getter, setter, options | console.warn, container.appendChild, makeRow, options.afterRow, refreshAllMeta |
| [`isRequiredGroupSatisfied`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3551) | groupName | getVal |
| [`getVal`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3554) | key | String, fieldInputs.get |
| [`refreshAllMeta`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3564) | – | metaUpdaters.forEach |
| [`makeRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3570) | field | String, _getFlowPowerDpIsW, btn.addEventListener, document.createElement, fieldInputs.set, getter, input.addEventListener, left.appendChild, metaUpdaters.push, right.appendChild, row.appendChild, unitCb.addEventListener, unitCb.setAttribute, unitLabel.appendChild (weitere in der Quelle) |
| [`updateMeta`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3675) | – | String, isRequiredGroupSatisfied |
| [`commitDpValue`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3709) | – | String, setter |
| [`_ensureVis`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3763) | – | – |
| [`_normalizeFlowConsumerType`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3769) | raw | String |
| [`_getFlowConsumerTypeLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3777) | raw | _normalizeFlowConsumerType |
| [`_ensureFlowSlots`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3784) | – | Array.isArray, String, _ensureVis, norm |
| [`norm`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3804) | arr, count, kind | String, _normalizeFlowConsumerType, ensureBool, ensureString, ensureValue, out.push |
| [`ensureString`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3817) | key, def | String |
| [`ensureValue`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3827) | key, def | – |
| [`ensureBool`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3836) | key, def | – |
| [`_defaultSlotName`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3890) | kind, idx1based | – |
| [`buildFlowSlotsUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L3900) | kind, slotCount | FLOW_ICON_CHOICES.forEach, String, _defaultSlotName, _ensureFlowSlots, _getFlowPowerDpIsW, _normalizeFlowConsumerType, addGenericField, addHeatPumpField, advBtn.addEventListener, advanced.appendChild, btn.setAttribute, consumerTypeSelect.addEventListener, container.appendChild, document.createElement (weitere in der Quelle) |
| [`ensureCtrl`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4112) | – | _ensureFlowSlots |
| [`mkDpField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4134) | labelText, id, value, onChange | String, b.setAttribute, document.createElement, dpWrap.appendChild, input.addEventListener, wrap.appendChild |
| [`mkSimpleField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4189) | labelText, id, type, value, placeholder, onChange | String, document.createElement, input.addEventListener, wrap.appendChild |
| [`mkCheckField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4225) | labelText, id, checked, onChange | document.createElement, input.addEventListener, row.appendChild, wrap.appendChild |
| [`addGenericField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4277) | el | ctrlFieldsGeneric.push, ctrlGrid.appendChild |
| [`addHeatPumpField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4288) | el | ctrlFieldsHeatPump.push, ctrlGrid.appendChild |
| [`setVisible`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4337) | el, visible | – |
| [`updateConsumerControlVisibility`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4347) | – | _normalizeFlowConsumerType, ctrlFieldsGeneric.forEach, ctrlFieldsHeatPump.forEach, setVisible |
| [`buildFlowPvNameRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4396) | – | String, _ensureFlowSlots, document.createElement, input.addEventListener, left.appendChild, right.appendChild, row.appendChild |
| [`_getFlowConsumerSlotCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4449) | slot | Array.isArray, _ensureFlowSlots |
| [`_getFlowConsumerName`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4460) | slot | String, _getFlowConsumerSlotCfg |
| [`_getFlowConsumerTypeForSlot`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4470) | slot | _getFlowConsumerSlotCfg, _normalizeFlowConsumerType |
| [`_getRawHeatingRodDeviceForSlot`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4480) | slot | Array.isArray, _clampInt, arr.find |
| [`_getHeatingRodStageDpPair`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4498) | slot, stageIdx | Array.isArray, String, _getFlowConsumerSlotCfg, _getRawHeatingRodDeviceForSlot |
| [`_countHeatingRodWiredStages`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4520) | slot | String, _getHeatingRodStageDpPair |
| [`_thermalDefaultSetpoints`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4534) | profile | String |
| [`_defaultHeatingRodStagePower`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4546) | maxPowerW, stageCount, index | Math.floor, Math.max, Math.round, Number, _clampInt |
| [`_computeHeatingRodStageDefaults`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4560) | maxPowerW, stageCount | Math.max, Math.round, _clampInt, _defaultHeatingRodStagePower, out.push |
| [`_syncHeatingRodDeviceStages`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4583) | dev, opts | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, String, _clampInt, _computeHeatingRodStageDefaults, next.push |
| [`_ensureThermalCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4621) | – | Array.isArray, Math.max, Math.round, Number, Number.isFinite, String, _clampInt, _thermalDefaultSetpoints, bySlot.get, bySlot.set, out.push |
| [`_normalizeHeatingRodAutoMode`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4682) | raw | String |
| [`_heatingRodAutoModeLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4699) | mode | _normalizeHeatingRodAutoMode |
| [`_normalizeHeatingRodClockTime`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4705) | raw, fallback | Math.max, Math.min, Math.round, Number, String |
| [`_ensureHeatingRodCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4720) | – | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, String, _clampInt, _getFlowConsumerSlotCfg, _normalizeHeatingRodAutoMode, _normalizeHeatingRodClockTime, _syncHeatingRodDeviceStages, bySlot.get, bySlot.set (weitere in der Quelle) |
| [`hn`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4767) | key, def, min, max | Math.max, Math.min, Math.round, Number, Number.isFinite |
| [`zn`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4798) | key, def, min, max, integer | Math.max, Math.min, Math.round, Number, Number.isFinite |
| [`_mkCfgInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4902) | type, value, onChange, opts | String, document.createElement, inp.addEventListener |
| [`commit`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4925) | – | Number, onChange |
| [`_mkHeatingRodNumberInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4948) | key, value, onChange, opts | String, _mkCfgInput |
| [`flushHeatingRodConfigFromDom`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4960) | – | document.querySelectorAll |
| [`_mkCfgSelect`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L4987) | value, options, onChange, opts | document.createElement, sel.addEventListener |
| [`_mkCfgToggle`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5009) | checked, onChange, opts | cb.addEventListener, document.createElement |
| [`_mkCfgField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5024) | label, control, hint | document.createElement, wrap.appendChild |
| [`_mkCfgGroup`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5053) | title | document.createElement, wrap.appendChild |
| [`_mkCfgDetailsGroup`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5089) | title, open | document.createElement, wrap.appendChild |
| [`_mkCfgBadge`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5128) | text, tone | document.createElement |
| [`_mkDeviceRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5154) | title, subtitle, badges | document.createElement, left.appendChild, row.appendChild |
| [`buildThermalUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5204) | – | String, _ensureThermalCfg, cfg.devices.forEach |
| [`syncVisibility`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5322) | – | String |
| [`rebuildHeatingRodUIStable`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5342) | reason | String, buildHeatingRodUI, requestAnimationFrame |
| [`buildHeatingRodUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5381) | – | Array.from, _ensureHeatingRodCfg, _getFlowConsumerTypeForSlot, _heatingRodAutoModeLabel, _mkCfgDetailsGroup, _mkCfgField, _mkCfgGroup, _mkCfgInput, _mkCfgSelect, _mkCfgToggle, _mkHeatingRodNumberInput, document.createElement, els.heatingRodDevices.appendChild, grpAuto.body.appendChild (weitere in der Quelle) |
| [`mkStageDpField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5505) | labelText, inputId, value, onChange, placeholder | String, b.setAttribute, document.createElement, dpWrap.appendChild, input.addEventListener, wrap.appendChild |
| [`_ensureBhkwCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5777) | – | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, String, mkDefault, normalized.push, normalized.sort, used.add, used.has |
| [`mkDefault`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5798) | idx | – |
| [`buildBhkwUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5909) | – | _ensureBhkwCfg, _mkDpWrap, actions.appendChild, adv.appendChild, advBtn.addEventListener, body.appendChild, card.appendChild, document.createElement, els.bhkwDevices.appendChild, header.appendChild, headerTop.appendChild, mkCheckbox, mkFieldRow, mkNumInput (weitere in der Quelle) |
| [`mkFieldRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5925) | labelTxt, controlEl, hintTxt | ctrl.appendChild, document.createElement, row.appendChild |
| [`mkTextInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5964) | value, onChange, placeholder | String, document.createElement, i.addEventListener |
| [`mkNumInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L5987) | value, onChange | String, document.createElement, i.addEventListener |
| [`mkCheckbox`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6015) | checked, text, onChange | cb.addEventListener, document.createElement, label.appendChild |
| [`mkSelect`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6046) | value, opts, onChange | String, document.createElement, s.addEventListener, s.appendChild |
| [`_ensureGeneratorCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6185) | – | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, String, mkDefault, normalized.push, normalized.sort, used.add, used.has |
| [`mkDefault`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6206) | idx | – |
| [`buildGeneratorUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6308) | – | _ensureGeneratorCfg, _mkDpWrap, actions.appendChild, adv.appendChild, advBtn.addEventListener, body.appendChild, card.appendChild, document.createElement, els.generatorDevices.appendChild, header.appendChild, headerTop.appendChild, mkCheckbox, mkFieldRow, mkNumInput (weitere in der Quelle) |
| [`mkFieldRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6325) | labelTxt, controlEl, hintTxt | ctrl.appendChild, document.createElement, row.appendChild |
| [`mkTextInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6364) | value, onChange, placeholder | String, document.createElement, i.addEventListener |
| [`mkNumInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6387) | value, onChange | String, document.createElement, i.addEventListener |
| [`mkCheckbox`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6413) | checked, text, onChange | cb.addEventListener, document.createElement, label.appendChild |
| [`mkSelect`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6446) | value, opts, onChange | String, document.createElement, s.addEventListener, s.appendChild |
| [`_ensureThresholdCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6582) | – | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, String, normCompare, normOutType, out.push, out.sort, used.add, used.has |
| [`normOutType`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6603) | v | String |
| [`normCompare`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6613) | v | String |
| [`_nextFreeThresholdIdx`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6673) | – | _ensureThresholdCfg, used.has |
| [`buildThresholdUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6687) | – | Number, String, _ensureThresholdCfg, del.addEventListener, document.createElement, document.createTextNode, els.thresholdRules.appendChild, en.addEventListener, enWrap.appendChild, grid.appendChild, head.appendChild, item.appendChild, left.appendChild, listWrap.appendChild (weitere in der Quelle) |
| [`mkHdr`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6718) | title, subtitle | document.createElement, wrap.appendChild |
| [`mkLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6752) | text | document.createElement |
| [`mkDpField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6773) | labelText, inputId, value, onChange, placeholder | String, b.setAttribute, document.createElement, dpWrap.appendChild, input.addEventListener, mkLabel, wrap.appendChild |
| [`mkNumField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6826) | labelText, inputId, value, onChange, placeholder, unit | String, document.createElement, input.addEventListener, mkLabel, row.appendChild, wrap.appendChild |
| [`mkTextField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6872) | labelText, inputId, value, onChange, placeholder | String, document.createElement, input.addEventListener, mkLabel, wrap.appendChild |
| [`mkSelectField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6902) | labelText, inputId, value, options, onChange | String, document.createElement, mkLabel, sel.addEventListener, sel.appendChild, wrap.appendChild |
| [`mkBoolSelect`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6936) | labelText, inputId, value, onChange | mkSelectField |
| [`mkChk`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6955) | labelText, inputId, checked, onChange | cb.addEventListener, document.createElement, document.createTextNode, lbl.appendChild, mkLabel, wrap.appendChild |
| [`updateRule`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L6992) | idx, patch | Object.assign, String, _ensureThresholdCfg, t2.rules.find |
| [`_ensureRelayCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7168) | – | Array.isArray, Math.max, Math.min, Math.round, Number, String, normType, numOrNull, out.push, out.sort, used.add, used.has |
| [`normType`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7189) | v | String |
| [`numOrNull`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7199) | v | Number, Number.isFinite |
| [`_nextFreeRelayIdx`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7240) | – | _ensureRelayCfg, used.has |
| [`buildRelayUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7254) | – | Number, String, _ensureRelayCfg, del.addEventListener, document.createElement, document.createTextNode, els.relayControls.appendChild, en.addEventListener, enWrap.appendChild, grid.appendChild, head.appendChild, item.appendChild, left.appendChild, listWrap.appendChild (weitere in der Quelle) |
| [`mkHdr`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7285) | title, subtitle | document.createElement, wrap.appendChild |
| [`mkLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7319) | text | document.createElement |
| [`mkDpField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7340) | labelText, inputId, value, onChange, placeholder | String, b.setAttribute, document.createElement, dpWrap.appendChild, input.addEventListener, mkLabel, wrap.appendChild |
| [`mkTextField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7393) | labelText, inputId, value, onChange, placeholder | String, document.createElement, input.addEventListener, mkLabel, wrap.appendChild |
| [`mkNumField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7423) | labelText, inputId, value, onChange, unit | String, document.createElement, input.addEventListener, mkLabel, row.appendChild, wrap.appendChild |
| [`mkSelectField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7468) | labelText, inputId, value, options, onChange | String, document.createElement, mkLabel, sel.addEventListener, sel.appendChild, wrap.appendChild |
| [`mkChk`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7502) | labelText, inputId, checked, onChange | cb.addEventListener, document.createElement, document.createTextNode, lbl.appendChild, mkLabel, wrap.appendChild |
| [`updateRelay`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7539) | idx, patch | Object.assign, String, _ensureRelayCfg, r2.relays.find |
| [`_normalizeGridExportControlCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7685) | gc | Math.max, Math.min, Math.round, Number, Number.isFinite, String, probe.trim, value.trim |
| [`_ensureGridConstraintsCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7725) | – | Array.isArray, Math.round, Number, Number.isFinite, Object.prototype.hasOwnProperty.call, _normalizeGridExportControlCfg |
| [`normInv`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7811) | it | Number, Number.isFinite, String |
| [`buildGridConstraintsUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7836) | – | Math.max, Math.round, Number, String, _ensureGridConstraintsCfg, advanced.appendChild, advancedFields.appendChild, basic.appendChild, clearAll, commands.appendChild, document.createElement, evuEl.appendChild, field.querySelector, fixedReserveW.toLocaleString (weitere in der Quelle) |
| [`mkMsg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7863) | text | document.createElement |
| [`clearAll`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7882) | – | – |
| [`mkLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7918) | text | document.createElement |
| [`mkFieldWrap`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7939) | labelText | document.createElement, mkLabel, wrap.appendChild |
| [`mkChk`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7958) | labelText, inputId, checked, onChange | cb.addEventListener, document.createElement, document.createTextNode, lbl.appendChild, mkFieldWrap, wrap.appendChild |
| [`mkNum`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L7993) | labelText, inputId, value, onChange, unit, placeholder | String, document.createElement, input.addEventListener, mkFieldWrap, row.appendChild, wrap.appendChild |
| [`mkSelect`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8037) | labelText, inputId, value, options, onChange | String, document.createElement, mkFieldWrap, sel.addEventListener, sel.appendChild, wrap.appendChild |
| [`mkDpField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8069) | labelText, inputId, value, onChange, placeholder | String, b.setAttribute, document.createElement, dpWrap.appendChild, input.addEventListener, mkFieldWrap, wrap.appendChild |
| [`mkHint`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8119) | text | document.createElement |
| [`renderExportGuardRuntimeDiagnostics`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8135) | target | Date.now, document.createElement, fetchJson, target.appendChild |
| [`fmtW`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8143) | v | Math.abs, Math.round, Number, Number.isFinite |
| [`readVal`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8149) | data, key | Object.prototype.hasOwnProperty.call |
| [`parseJson`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8153) | raw | JSON.parse |
| [`renderGridImportRuntimeDiagnostics`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8362) | target | Date.now, document.createElement, fetchJson, target.appendChild |
| [`fmtW`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8370) | v | Math.abs, Math.round, Number, Number.isFinite |
| [`readVal`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8377) | data, key | Object.prototype.hasOwnProperty.call |
| [`stageLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8381) | stage | String |
| [`mkZeroSection`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8496) | parent, titleText, id, collapsed | document.createElement, parent.appendChild, section.appendChild |
| [`mkZeroFields`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8509) | parent | document.createElement, parent.appendChild |
| [`mkTitle`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8619) | text | document.createElement |
| [`mkBadge`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8638) | label, ok | document.createElement |
| [`mkInvItem`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8657) | list, idx, groupPrefix, groupLabel | Number.isFinite, String, advGrid.appendChild, advanced.appendChild, chips.appendChild, delBtn.addEventListener, document.createElement, editBtn.addEventListener, editBtn.setAttribute, kwpInput.addEventListener, kwpInput.setAttribute, meta.appendChild, mkBadge, mkDpField (weitere in der Quelle) |
| [`mkInvGroup`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8806) | target, titleText, list, groupPrefix, groupLabel, inactiveHint | add.addEventListener, document.createElement, listWrap.appendChild, mkHint, mkInvItem, mkTitle, target.appendChild |
| [`_ensurePara14aCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8910) | – | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, PARA14A_TYPES.some, String, ic.para14aActiveId.trim, ic.para14aEmsSetpointWId.trim, out.push |
| [`_mkDpWrap`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L8972) | id, value, placeholder, onChange | String, b.setAttribute, document.createElement, dpWrap.appendChild, input.addEventListener |
| [`rebuildPara14aConsumersUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9011) | – | Array.isArray, _ensurePara14aCfg, document.createElement, els.para14aConsumers.appendChild, visibleRows.forEach |
| [`buildPara14aUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9202) | – | Math.round, Number, Number.isFinite, String, _ensurePara14aCfg, document.createElement, els.para14aConsumers.appendChild, lock, rebuildPara14aConsumersUI |
| [`lock`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9226) | el | – |
| [`getStorageMode`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9264) | – | String |
| [`getStorageCoupling`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9276) | – | String |
| [`normalizeStorageVendorProfile`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9287) | v | String |
| [`normalizeFeneconControlMode`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9296) | v | String |
| [`isFeneconGridTargetId`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9303) | value | String |
| [`isFeneconDirectEssSetpointId`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9311) | value | String |
| [`isFeneconGridMeasurementId`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9319) | value | String, isFeneconGridTargetId |
| [`isFeneconHybridUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9327) | profile, coupling | String, normalizeStorageVendorProfile |
| [`getStorageVendorProfile`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9337) | – | String, normalizeStorageVendorProfile |
| [`updateStorageCouplingUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9348) | – | getStorageCoupling |
| [`updateStorageVendorProfileUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9359) | – | String, getStorageCoupling, getStorageVendorProfile, isFeneconHybridUi |
| [`rebuildStorageTable`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9395) | – | STORAGE_DP_FIELDS.filter, buildDpTable, getStorageCoupling, getStorageMode, getStorageVendorProfile, updateStorageCouplingUi, updateStorageVendorProfileUi |
| [`_ensureStorageFarmCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9437) | – | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, String, String.fromCharCode, _clampInt, _normalizeRecoveredStorageFarmRow, grpOut.push, storOut.push |
| [`buildStorageFarmUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9500) | – | Math.max, Math.min, Math.round, Number, Number.isFinite, String, _ensureStorageFarmCfg, _licenseEdition, _maxStorageCount, btn.addEventListener, card.appendChild, detail.appendChild, document.createElement, document.getElementById (weitere in der Quelle) |
| [`mkField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9603) | labelText | document.createElement, wrap.appendChild |
| [`mkDpField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9627) | labelText, id, value, onChange, placeholder | String, b.setAttribute, document.createElement, dpWrap.appendChild, input.addEventListener, mkField, wrap.appendChild |
| [`mkTextField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9673) | labelText, id, value, onChange, placeholder | String, document.createElement, input.addEventListener, mkField, wrap.appendChild |
| [`mkNumField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9699) | labelText, id, value, onChange, placeholder | String, document.createElement, input.addEventListener, mkField, wrap.appendChild |
| [`mkSelectField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9728) | labelText, id, value, options, onChange | String, document.createElement, mkField, sel.addEventListener, wrap.appendChild |
| [`mkCheckField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9758) | labelText, id, checked, onChange | box.addEventListener, document.createElement, document.createTextNode, lbl.appendChild, mkField, wrap.appendChild |
| [`mkGridDivider`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9791) | text | document.createElement |
| [`mkGridHelp`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L9818) | text | document.createElement |
| [`_ensureStorageMultiUseCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10170) | – | _clampInt |
| [`_renderStorageMultiUseSummary`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10230) | mu | _clampInt, document.createElement, els.muStorageSummary.appendChild |
| [`buildStorageMultiUseUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10271) | – | _ensureStorageMultiUseCfg, document.createElement, els.muStorageSummary.appendChild, setDisabled, syncFromCfgToUi |
| [`setDisabled`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10291) | d | – |
| [`syncFromCfgToUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10318) | – | _ensureStorageMultiUseCfg, _renderStorageMultiUseSummary, numOrEmpty |
| [`syncFromUiToCfg`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10349) | – | Math.max, _clampInt, _ensureStorageMultiUseCfg, _renderStorageMultiUseSummary, numOrEmpty, scheduleValidation |
| [`_clampInt`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10428) | v, min, max, def | Math.max, Math.min, Math.round, Number, Number.isFinite |
| [`_ensureSettingsConfig`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10440) | – | – |
| [`_ensureChargingManagementConfig`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10451) | – | – |
| [`_ensureEvcsList`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10462) | count | Array.isArray, _clampInt, _ensureSettingsConfig, _maxEvcsCount, list.push |
| [`_updateEvcsField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10477) | idx, field, value | _clampInt, _ensureEvcsList, _ensureSettingsConfig, _maxEvcsCount |
| [`_buildEvcsBoostLimitInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10493) | row, onChange | Math.max, Number, Number.isFinite, String, document.createElement, input.addEventListener, raw.trim |
| [`buildEvcsUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10512) | – | Array.isArray, Number, Number.isFinite, String, _clampInt, _ensureEvcsList, _ensureSettingsConfig, _maxEvcsCount, actions.appendChild, body.appendChild, btnAddPort.addEventListener, btnSD.addEventListener, btnSU.addEventListener, card.appendChild (weitere in der Quelle) |
| [`mkRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10559) | label, controlEl | controlEl.classList.add, controlEl.matches, ctl.appendChild, ctl.classList.add, document.createElement, row.appendChild |
| [`mkIo`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10591) | id, value, onChange | btn.addEventListener, document.createElement, input.addEventListener, valueOrEmpty, wrap.appendChild |
| [`normKey`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10632) | k | String |
| [`ensureGroupForKey`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10676) | stationKey | groupIndexByKey.get, groupIndexByKey.has, groupIndexByKey.set, normKey, sc.stationGroups.push |
| [`moveStationGroup`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10698) | stationKey, dir | arr.forEach, buildEvcsUI, buildStationGroupsUI, groupIndexByKey.clear, groupIndexByKey.get, normKey |
| [`renameStationKey`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10730) | oldKey, newKey | buildEvcsUI, buildStationGroupsUI, groupIndexByKey.get, normKey |
| [`addPortToStation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10769) | stationKey | Math.min, Object.assign, String, _clampInt, _ensureEvcsList, _ensureSettingsConfig, _maxEvcsCount, buildEvcsUI, normKey |
| [`movePortWithinStation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10798) | portIdx, stationKey, dir | buildEvcsUI, normKey |
| [`createPortCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L10837) | i, stationKey | Math.round, Number, Number.isFinite, String, _buildEvcsBoostLimitInput, _clampInt, actions.appendChild, adv.appendChild, allowBoostInp.addEventListener, body.addEventListener, body.appendChild, boostTInput.addEventListener, btnDown.addEventListener, btnUp.addEventListener (weitere in der Quelle) |
| [`mkSemanticInput`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11050) | field, placeholder | document.createElement, input.addEventListener, valueOrEmpty |
| [`mkSmallText`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11166) | field, placeholder | String, document.createElement, input.addEventListener |
| [`mkNumPhase`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11178) | field, placeholder, min, step, fallback | Number, Number.isFinite, String, document.createElement, input.addEventListener |
| [`refreshElectricalHint`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11326) | – | _ensureSettingsConfig, check.errors.join, window.NexoWattEvcsElectricalLimits.validateEvcsElectricalConfig |
| [`buildStationGroupsUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11511) | – | Array.isArray, _ensureSettingsConfig, arr.forEach, document.createElement, els.stationGroups.appendChild |
| [`collectSettingsConfigFromUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11613) | – | Array.isArray, Number, Number.isFinite, _clampInt, _ensureEvcsList, _ensureSettingsConfig, _maxEvcsCount, deepMerge, out.evcsList.filter |
| [`applyConfigToUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11639) | cfg | Math.max, Math.round, Number, Number.isFinite, String, _isAppLicensed, _licenseEdition, applyEnergyFlowTsModeToUi, applyTariffProviderUI, buildAiAdvisorUI, buildAppsUI, buildBhkwUI, buildDpTable, buildEvcsUI (weitere in der Quelle) |
| [`afterRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L11733) | field, _row, container | buildFlowPvNameRow, container.appendChild |
| [`fetchOcppDiscovery`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12001) | – | Array.isArray, fetchJson |
| [`_ocppStationIdentityFromDp`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12012) | id | String, value.match |
| [`_ocppStationIdentityFromRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12023) | row | String, _ocppStationIdentityFromDp |
| [`_ocppStationIdentityFromConnector`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12041) | connector | _ocppStationIdentityFromDp |
| [`_isEmptyEvcsMappingRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12056) | row | – |
| [`_isKnownLegacyNexoWattOcppMapping`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12065) | field, currentId, replacementId | String, _ocppStationIdentityFromDp, current.toLowerCase, lower.endsWith, lower.startsWith, replacement.toLowerCase, replacementLower.startsWith |
| [`_applyOcppConnectorToRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12101) | row, c, opts | Math.max, Math.round, Number, Number.isFinite, Object.assign, String, setField |
| [`setField`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12121) | k, v | String, _isKnownLegacyNexoWattOcppMapping, cur.trim |
| [`ocppAutoDetect`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12189) | – | Array.isArray, Math.max, Math.min, String, _applyOcppConnectorToRow, _ensureSettingsConfig, buildEvcsUI, buildStationGroupsUI, existingList.some, fetchOcppDiscovery, scheduleValidation, setStatus, window.confirm |
| [`ocppMapExisting`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12242) | – | JSON.stringify, Math.min, String, _applyOcppConnectorToRow, _clampInt, _ensureEvcsList, _ensureSettingsConfig, _ocppStationIdentityFromConnector, buildEvcsUI, buildStationGroupsUI, fetchOcppDiscovery, list.findIndex, list.push, list.slice (weitere in der Quelle) |
| [`_nwNormCat`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12325) | v | String |
| [`_nwDeviceClass`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12334) | dev | String |
| [`_isNwEvcsCategory`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12337) | cat | _nwNormCat |
| [`_isNwEvcsDevice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12341) | dev | _isNwEvcsCategory, _nwDeviceClass |
| [`_isNwPvDevice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12345) | dev | _isNwPvInverterCategory, _nwDeviceClass |
| [`_isNwHeatDevice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12349) | dev | _isNwHeatCategory, _nwDeviceClass |
| [`_isNwStorageDevice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12353) | dev | _nwDeviceClass |
| [`_isNwMeterDevice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12357) | dev | _isNwMeterCategory, _nwDeviceClass |
| [`_isNwPvInverterCategory`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12367) | cat | _nwNormCat |
| [`_isNwHeatCategory`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12376) | cat | _nwNormCat |
| [`_nwGetAlias`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12385) | dev, key | String |
| [`_nwGetWritableAlias`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12394) | dev, key | String, _nwGetAlias |
| [`_nwGetAliasUnit`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12399) | dev, key | String |
| [`_nwGetDpFallback`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12409) | dev, suffix | String |
| [`_applyNwDeviceToEvcsRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12420) | row, dev, opts | String, _nwGetAlias, _nwGetAliasUnit, _nwGetWritableAlias, _nwNormCat, currentChargeDemandId.startsWith, currentStatusId.startsWith, setIf |
| [`setIf`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12436) | k, v | String |
| [`_classifyHeatDevice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12542) | dev | String |
| [`_findFreeConsumerSlot`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12561) | range | String |
| [`_isNwMeterCategory`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12577) | cat | _nwNormCat |
| [`_isNwStorageCategory`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12587) | cat | _nwNormCat |
| [`_nwDevHaystack`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12597) | dev | String |
| [`_nwHasAlias`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12612) | dev, key | String, _nwGetAlias |
| [`_nwScoreGridMeter`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12621) | dev | _isNwMeterDevice, _isNwPvDevice, _isNwStorageDevice, _nwDevHaystack, _nwHasAlias, _nwNormCat |
| [`_nwScorePvSource`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12641) | dev | _isNwMeterDevice, _isNwPvDevice, _nwDevHaystack, _nwHasAlias, _nwNormCat |
| [`_nwScoreStorage`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12658) | dev | _isNwStorageDevice, _nwDevHaystack, _nwHasAlias, _nwNormCat |
| [`_nwPickBestDevice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12677) | devices, scorer, opts | Array.isArray, Number, Number.isFinite |
| [`_nwApplyFlowDpIfEmpty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12697) | key, value, opts | String, _setFlowPowerDpIsW, document.getElementById, inp.dispatchEvent |
| [`_nwApplyGeneralDpIfEmpty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12727) | key, value | String, els.gridPointConnectedId.dispatchEvent, els.gridPointWatchdogId.dispatchEvent |
| [`_nwAutoMapEnergyFlowFromDevices`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12769) | devices | Array.isArray, String, _ensureFlowSlots, _nwApplyFlowDpIfEmpty, _nwApplyGeneralDpIfEmpty, _nwGetAlias, _nwPickBestDevice, document.getElementById, list.filter, list.some, out.notes.push |
| [`_nwAutoMapStorageAppFromDevices`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12876) | devices | Array.isArray, String, _nwGetAlias, _nwGetWritableAlias, isFeneconDirectEssSetpointId, isFeneconGridMeasurementId, isFeneconGridTargetId, normalizeFeneconControlMode, normalizeStorageVendorProfile, result.notes.push, result.notes.unshift, setEmpty |
| [`setEmpty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L12888) | key, value | String |
| [`nwDevicesQuickSetup`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13010) | – | Array.isArray, JSON.stringify, Math.max, Math.round, Number, Number.isFinite, String, _applyNwDeviceToEvcsRow, _clampInt, _classifyHeatDevice, _countHeatingRodWiredStages, _ensureEvcsList, _ensureFlowSlots, _ensureGridConstraintsCfg (weitere in der Quelle) |
| [`addOrUpdate`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13096) | dev | JSON.stringify, String, _nwGetAlias, _nwGetWritableAlias, list.find, list.push |
| [`findPara14aMatch`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13172) | dev, setId, enableId | String |
| [`loadConfig`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13337) | – | Date.now, _inferLicenseFromSuccessfulInstallerGate, _licenseIsUsable, applyConfigToUI, clearDirty, fetchJson, fetchLicenseInfoFallback, fetchLicenseInfoFromStateFallback, hydrateStorageFarmConfigFromRuntimeState, normalizeLicenseInfo, scheduleValidation, setStatus |
| [`applyReleaseSafetyGateToPatch`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13383) | patch | Array.isArray, restoreArrayIfDangerouslyEmpty, srcRows.slice |
| [`restoreArrayIfDangerouslyEmpty`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13385) | section, key, markerName | Array.isArray, console.warn, currentRows.slice |
| [`collectPatchFromUI`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13429) | – | Array.from, Array.isArray, JSON.parse, Math.max, Math.min, Math.round, Number, Number.isFinite, Object.assign, String, _clampInt, _coupleTariffProviderDatapointsSync, _ensureFlowSlots, _ensurePara14aCfg (weitere in der Quelle) |
| [`readNlP1`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13478) | name | String, document.querySelector |
| [`readNlP1Dp`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13482) | name | String, document.querySelector |
| [`nlp1Number`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13486) | name, fallback, min, max | Math.max, Math.min, Math.round, Number, Number.isFinite, readNlP1 |
| [`readMesh`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13582) | row, field | String, row.querySelector |
| [`safeMeshId`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13586) | value, fallback | String |
| [`readMeshPowerLimit`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13632) | row, field | Math.round, Number, Number.isFinite, readMesh |
| [`splitLpList`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13670) | raw | String |
| [`readCk`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13674) | row, field | String, row.querySelector |
| [`readCkPrice`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13678) | row, field | Math.max, Math.min, Math.round, Number, Number.isFinite, readCk |
| [`readCkInt`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13683) | row, field, fallback, min, max | Math.max, Math.min, Math.round, Number, Number.isFinite, readCk |
| [`_storageFarmStorageCount`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L13999) | cfg | Array.isArray, sf.storages.filter |
| [`applyAppCenterRegressionSafetyGate`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14011) | patch | Date.now, _storageFarmStorageCount, deepMerge, guarded.push |
| [`_sgArray`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14057) | v | Array.isArray |
| [`_sgObject`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14058) | v | – |
| [`_sgNonEmptyString`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14059) | v | String |
| [`_sgCountStorages`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14060) | cfg | _sgArray, _sgObject |
| [`_sgCountGroups`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14061) | cfg | _sgArray, _sgObject |
| [`_sgCountEvcs`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14062) | cfg | Math.max, Number, _sgArray, _sgObject |
| [`_sgCountChargeKiosk`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14066) | cfg | _sgArray, _sgObject |
| [`_sgCountMeshNodes`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14067) | cfg | _sgArray, _sgObject |
| [`_sgCountMeshPeers`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14068) | cfg | Math.max, _sgArray, _sgObject |
| [`_sgCountNlP1Mappings`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14074) | cfg | Object.keys, _sgObject |
| [`_sgRestore`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14078) | report, path, reason | report.restored.push |
| [`applyReleaseRegressionSafetyGate`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14082) | patch | _sgArray, _sgCountChargeKiosk, _sgCountEvcs, _sgCountGroups, _sgCountMeshNodes, _sgCountMeshPeers, _sgCountNlP1Mappings, _sgCountStorages, _sgObject, _sgRestore, deepMerge, report.warnings.push |
| [`validateFeneconStorageConfiguration`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14157) | patch | Array.isArray, Math.max, Object.prototype.hasOwnProperty.call, String, _normalizeRecoveredStorageFarmRow, isDirectEssSetpoint, isGridMeasurement, isGridTarget, normalizeFeneconControlMode, rows.filter, sf.storages.filter, validateOne |
| [`normalizeId`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14159) | value | String |
| [`sameId`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14160) | a, b | normalizeId |
| [`isPowerBalance`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14165) | value | normalizeId |
| [`isDirectEssSetpoint`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14173) | value | isFeneconDirectEssSetpointId |
| [`isGridTarget`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14174) | value | isFeneconGridTargetId |
| [`isGridMeasurement`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14175) | value | isFeneconGridMeasurementId |
| [`validateOne`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14176) | { name = 'Speicher', vendorProfile, coupling, mode, nativeTarget, essActual, directTargets = [], otherWritableStorageCount = 0 } | String, directIds.push, directIds.some, directTargets.map, isDirectEssSetpoint, isGridMeasurement, isGridTarget, isPowerBalance, normalizeStorageVendorProfile, sameId |
| [`flushDpInputsToConfig`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14305) | – | Array.from, document.querySelectorAll, input.dispatchEvent |
| [`saveConfig`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14318) | – | Array.isArray, JSON.stringify, _maxStorageCount, _storageFarmStorageCount, applyAppCenterRegressionSafetyGate, applyConfigToUI, applyReleaseRegressionSafetyGate, beginAppCenterMutation, check.errors.join, clearDirty, collectPatchFromUI, endMutation, fetchJson, flushDpInputsToConfig (weitere in der Quelle) |
| [`_showTab`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14360) | tabId | Array.from, btns.forEach, document.querySelectorAll, els.tabs.querySelectorAll, panels.forEach, refreshChargingDiag, refreshEmsStatus |
| [`initTabs`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14386) | – | Array.from, _showTab, btns.forEach, btns.some, els.tabs.querySelectorAll, linkedTabs.has |
| [`initFlowSubtabs`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14409) | – | Array.from, btns.forEach, document.getElementById, document.querySelectorAll, show, wrap.querySelectorAll |
| [`show`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14428) | id | String, btns.forEach, panels.forEach |
| [`_fmtTs`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14454) | ts | Number.isFinite, d.getTime, d.toLocaleString |
| [`renderEmsStatus`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14467) | payload | Array.isArray, Number.isFinite, String, _fmtTs, details.filter, details.push, document.createElement, els.emsStatus.appendChild, mkItem, startup.message.slice, startup.phaseLabel.slice |
| [`mkItem`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14476) | titleText, subtitleText, rightHtml, statusKind | document.createElement, left.appendChild, row.appendChild |
| [`_asBool`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14556) | v | v.trim |
| [`_asNum`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14568) | v, fallback | Number, Number.isFinite |
| [`renderChargingDiag`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14578) | payload | Array.isArray, Math.round, Number.isFinite, String, _asBool, _asNum, els.chargingDiag.appendChild, flags.join, flags.push, mkItem, targetA.toFixed |
| [`mkItem`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14587) | titleText, subtitleText, rightHtml, statusKind | document.createElement, left.appendChild, row.appendChild |
| [`_fmtW`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14678) | v | Math.abs, Math.round, Number, Number.isFinite |
| [`_fmtKwh`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14690) | v | Number, Number.isFinite, n.toFixed |
| [`_fmtEurKwh`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14701) | v | Number, Number.isFinite, n.toFixed |
| [`_fmtIsoShort`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14712) | v | Number.isFinite, String, d.getTime, d.toLocaleString |
| [`_fmtPct`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14725) | v | Math.round, Number, Number.isFinite |
| [`renderStationsDiag`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14736) | payload | Array.isArray, Math.round, Number, Number.isFinite, String, _fmtW, els.stationsDiag.appendChild, mkItem |
| [`mkItem`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14745) | titleText, subtitleText, rightHtml, statusKind | document.createElement, left.appendChild, row.appendChild |
| [`_fmtBool`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14812) | v, tTrue, tFalse | – |
| [`_parseShadowJson`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14830) | raw, fallback | JSON.parse, String, text.slice |
| [`_shadowDiffList`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14856) | shadow | Object.keys, String, add, readList |
| [`add`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14859) | label, jsVal, tsVal, diff | String, out.push |
| [`readList`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14862) | arr, prefix | Array.isArray, arr.forEach |
| [`_shadowKind`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14897) | shadow | _shadowDiffList |
| [`_shadowStatusLabel`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14915) | kind, shadow | – |
| [`_shadowHumanExplanation`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14936) | title, shadow, diffs | Array.isArray, String |
| [`_formatShadowJsonForDisplay`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14958) | value | JSON.stringify |
| [`_shadowDecodeDisplayText`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14974) | value | String, decodeURIComponent |
| [`_shadowEscape`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L14992) | value | _shadowDecodeDisplayText |
| [`_openShadowJsonDialog`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15013) | title, payload | _formatShadowJsonForDisplay, _shadowEscape, backdrop.addEventListener, backdrop.querySelector, document.body.appendChild, document.createElement, document.getElementById, existing.remove, text.focus, text.setSelectionRange |
| [`close`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15035) | – | backdrop.remove |
| [`_normalizeEnergyFlowTsModeUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15066) | value | String |
| [`applyEnergyFlowTsModeToUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15082) | cfg | Math.max, Math.min, Math.round, Number, String, _normalizeEnergyFlowTsModeUi, renderEnergyFlowTsModeStatus |
| [`collectEnergyFlowTsMigrationFromUi`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15105) | base | Math.max, Math.min, Math.round, Number, Number.isFinite, _normalizeEnergyFlowTsModeUi, deepMerge |
| [`renderEnergyFlowTsModeStatus`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15132) | readiness | Array.isArray, Math.max, Math.min, Math.round, Number, Number.isFinite, String, _decodeShadowDisplayText, _normalizeEnergyFlowTsModeUi, _shadowEscape, escape, plan.blockedReasons.map, safety.warnings.join |
| [`_renderShadowPlantEvaluationCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15181) | evaluation | Array.isArray, Number, String, btn.addEventListener, card.querySelector, document.createElement, escape, evaluation.recentSamples.slice, lines.map, recent.map |
| [`_renderHeatingRodTsRuntimeEvaluationCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15236) | evaluation | Array.isArray, Number, String, btn.addEventListener, card.querySelector, document.createElement, escape, evaluation.fallbackReasons.filter, rows.map |
| [`_renderEnergyFlowTsActiveTestCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15335) | activeTest, fixedSource | Array.isArray, Number, String, _decodeShadowDisplayText, activeTest.recentSamples.slice, blockers.join, btn.addEventListener, card.querySelector, document.createElement, escape, latest.blockers.map, lines.map, recent.map |
| [`_renderShadowReadinessCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15389) | readiness | Array.isArray, candidateSafety.blockers.map, candidateSafety.warnings.map, document.createElement, escape, items.map, readiness.blockers.map, readiness.warnings.map |
| [`renderShadowDiagnostics`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15462) | payload | Object.assign, _parseShadowJson, _rememberOpenShadowDetails, _renderEnergyFlowTsActiveTestCard, _renderHeatingRodTsRuntimeEvaluationCard, _renderShadowPlantEvaluationCard, _renderShadowReadinessCard, cards.forEach, document.createElement, els.shadowDiagnostics.appendChild, renderEnergyFlowTsModeStatus |
| [`renderChargingBudget`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15591) | payload | Array.isArray, JSON.parse, Math.max, Math.min, Math.round, Number, Number.isFinite, String, _fmtAge, _fmtBool, _fmtEurKwh, _fmtIsoShort, _fmtKwh, _fmtPct (weitere in der Quelle) |
| [`mkCard`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15620) | titleText, lines, statusKind | b.appendChild, card.appendChild, document.createElement, h.appendChild, statusKind.toUpperCase, top.appendChild |
| [`n`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15685) | x | Number |
| [`b`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15692) | x | – |
| [`refreshChargingDiag`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15970) | – | fetchJson, renderChargingBudget, renderChargingDiag, renderStationsDiag |
| [`refreshEmsStatus`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15984) | – | fetchJson, renderEmsStatus, window.NexoWattNvpDiagnostics?.render |
| [`startStatusPolling`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L15996) | – | clearInterval, setInterval |
| [`openDpModal`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16015) | targetInputId, options | closeDpModal, currentId.split, currentInput.value.trim, currentParts.slice, document.getElementById, dpSelectableIds.clear, els.dpModal.classList.remove, els.dpModal.querySelector, els.dpModal.setAttribute, options.currentId.trim, refreshTree |
| [`closeDpModal`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16051) | selected | callback, dpSelectableIds.clear, els.dpModal.classList.add, els.dpModal.setAttribute, validDpSelectionId |
| [`setDpTargetValue`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16070) | id | closeDpModal, document.getElementById, dpSelectableIds.has, inp.dispatchEvent, validDpSelectionId |
| [`renderBreadcrumb`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16088) | – | els.dpBreadcrumb.appendChild, mkCrumb, sep |
| [`mkCrumb`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16099) | label, prefix, clickable | b.addEventListener, document.createElement |
| [`sep`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16121) | – | document.createElement |
| [`mkDpResultRow`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16146) | primary, meta, onClick | document.createElement, row.addEventListener, row.appendChild |
| [`refreshTree`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16175) | – | Array.isArray, String, document.createElement, dpSelectableIds.add, els.dpTree.appendChild, encodeURIComponent, fetchJson, metaBits.join, metaBits.push, mkDpResultRow, renderBreadcrumb, validDpSelectionId |
| [`doSearch`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16246) | – | Array.isArray, String, document.createElement, dpSelectableIds.add, els.dpResults.appendChild, encodeURIComponent, fetchJson, metaBits.join, metaBits.push, mkDpResultRow, validDpSelectionId |
| [`upOne`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16288) | – | parts.join, parts.pop, treePrefix.split |
| [`acceptDataPointPickerMessage`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16302) | event | closeDpModal, els.dynamicGridMount.querySelector, event.source.postMessage, openDpModal, request.source.postMessage |
| [`respond`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16317) | id | els.dynamicGridMount.querySelector, request.source.postMessage, window.close |
| [`getInstallerAdminUrl`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16359) | – | – |
| [`initInstallerBackLink`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16369) | – | getInstallerAdminUrl, link.addEventListener, link.setAttribute, window.NW_RUNTIME?.url |
| [`_updateStorageCoupling`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16426) | – | getStorageCoupling, rebuildStorageTable, scheduleValidation, updateStorageCouplingUi |
| [`_update`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16445) | – | Number, Number.isFinite |
| [`_updateStorageRatedPower`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16468) | – | Math.abs, Math.min, Math.round, Number, Number.isFinite, String, _storagePowerProfileInfo, scheduleValidation, updateStorageLicensePowerUi |
| [`_updateStorageSelfNvpControl`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16497) | – | _clampInt, scheduleValidation |
| [`_updateStorageVendorProfile`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16546) | – | String, _clampInt, getStorageCoupling, getStorageVendorProfile, rebuildStorageTable, scheduleValidation, updateStorageVendorProfileUi |
| [`backupRefreshInfo`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L16994) | – | String, fetchJson |
| [`backupExport`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L17026) | – | backupRefreshInfo, downloadJsonFile, fetchJson, setBackupStatus, ts.toISOString |
| [`backupDoImportFromObj`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L17050) | obj | JSON.stringify, backupRefreshInfo, beginAppCenterMutation, endMutation, fetchJson, loadConfig, requireDynamicGridSaveVersion, requirePartnerSaveVersion, setBackupStatus |
| [`backupImportFromFile`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L17068) | file | JSON.parse, backupDoImportFromObj, readFileAsText, setBackupStatus |
| [`backupRestoreFromUserdata`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L17087) | – | backupDoImportFromObj, fetchJson, setBackupStatus, window.confirm |
| [`requireAppCenterAccessBeforeLoad`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L17261) | – | Array.isArray, Date.now, caps.includes, fetch, r.json, window.NW_AUTH.requireCapability |
| [`updateAdminOnlyActions`](../../../../../src-ts/runtime-executables/www/ems-apps.ts#L17278) | – | document.getElementById, window.NW_AUTH.getState |
