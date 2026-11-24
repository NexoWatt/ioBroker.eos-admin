# src-ts/runtime-executables/www/app.ts

Verbindet das Kunden-Dashboard mit Livewerten, Energieflussanzeige, Bedienaktionen und Kundeneinstellungen.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/app.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

## Direkte Verknüpfungen

Statisch gefundene Imports/require-Aufrufe. Ein Import belegt eine Code-Verknüpfung; er beweist nicht, dass der Pfad in jeder Konfiguration ausgeführt wird.

| Import | Aufgelöste Datei |
| --- | --- |
| `./static/ts-mirrors/frontend/live-dashboard-format.mjs` | [src-ts/frontend/live-dashboard-format.ts](../../../../../src-ts/frontend/live-dashboard-format.ts) |
| `/static/ts-mirrors/frontend/customer-feature-visibility.mjs` | Node-Bordmittel oder externe Paketabhängigkeit. |

**Direkt importiert von:**

Kein direkter Import innerhalb des erfassten Quellbereichs. Mögliche HTML-, Adapter-, Build- oder dynamische Einstiege sind separat zu prüfen.

## Funktionen und Methoden

Parameter sind die Namen aus der Signatur, keine geratenen Datenverträge. Die Aufrufliste zeigt direkt sichtbare Ausdrücke ohne Auflösung dynamischer Objekte; anonyme Callbacks und aufgerufene Unterfunktionen sind nicht vollständig darin enthalten.

| Funktion / Methode | Parameter | Direkt sichtbare Aufrufe (Auszug) |
| --- | --- | --- |
| [`nwUiLocaleTag`](../../../../../src-ts/runtime-executables/www/app.ts#L98) | – | String, lang.startsWith, window.NexoWattI18n.localeTag |
| [`loadLiveDashboardTsFormat`](../../../../../src-ts/runtime-executables/www/app.ts#L100) | – | import |
| [`nxTryTsDashboardFormat`](../../../../../src-ts/runtime-executables/www/app.ts#L119) | name, args | fn |
| [`nwNormalizeBrandHeader`](../../../../../src-ts/runtime-executables/www/app.ts#L136) | – | Array.prototype.slice.call, document.querySelectorAll, document.title.replace, pwaTitles.forEach, topbarTitles.forEach |
| [`arcLenFromDeg`](../../../../../src-ts/runtime-executables/www/app.ts#L161) | r, deg | – |
| [`setArcAtAngle`](../../../../../src-ts/runtime-executables/www/app.ts#L168) | selector, r, angleDeg, arcDeg | Math.max, Math.min, arcLenFromDeg, dash.toFixed, document.querySelector, el.setAttribute, offset.toFixed |
| [`placeIconAtAngle`](../../../../../src-ts/runtime-executables/www/app.ts#L184) | sel, angleDeg | Math.cos, Math.max, Math.sin, document.querySelector, wrap.getBoundingClientRect |
| [`setArcInSlot`](../../../../../src-ts/runtime-executables/www/app.ts#L208) | selector, r, slotIndex, slotFillPct | L.toFixed, Math.max, Math.min, document.querySelector, el.setAttribute, start.toFixed |
| [`setArc`](../../../../../src-ts/runtime-executables/www/app.ts#L227) | selector, r, valuePct | Math.max, Math.min, dash.toFixed, document.querySelector, el.setAttribute, rest.toFixed |
| [`setDonut`](../../../../../src-ts/runtime-executables/www/app.ts#L241) | cls, pct, inner | Math.max, Math.min, dash.toFixed, document.querySelector, el.setAttribute, rest.toFixed |
| [`formatHours`](../../../../../src-ts/runtime-executables/www/app.ts#L260) | h | Math.floor, Math.round, isFinite |
| [`applyEnergyWebResponsiveLayout`](../../../../../src-ts/runtime-executables/www/app.ts#L282) | nextCfg | Math.floor, Math.max, Math.min, Math.round, Object.assign, _flowUiNum, document.querySelector, wrap.style.removeProperty, wrap.style.setProperty |
| [`scheduleEnergyWebResponsiveLayout`](../../../../../src-ts/runtime-executables/www/app.ts#L335) | nextCfg | Object.assign, cancelAnimationFrame, requestAnimationFrame |
| [`_flowUiNum`](../../../../../src-ts/runtime-executables/www/app.ts#L367) | v, fallback | Number, Number.isFinite |
| [`stabilizeFlowSigned`](../../../../../src-ts/runtime-executables/www/app.ts#L377) | key, rawW, opts | Date.now, Math.abs, Math.sign, _flowUiNum |
| [`stabilizeFlowAbs`](../../../../../src-ts/runtime-executables/www/app.ts#L423) | key, rawW, opts | Math.abs, Math.max, Object.assign, _flowUiNum, stabilizeFlowSigned |
| [`applyFlowCoreLabels`](../../../../../src-ts/runtime-executables/www/app.ts#L434) | – | document.getElementById |
| [`scheduleRender`](../../../../../src-ts/runtime-executables/www/app.ts#L457) | force | Date.now, Math.max, clearTimeout, setTimeout |
| [`scheduleLiveTelemetryRender`](../../../../../src-ts/runtime-executables/www/app.ts#L491) | force | Date.now, Math.max, clearTimeout, scheduleRender, setTimeout |
| [`formatPower`](../../../../../src-ts/runtime-executables/www/app.ts#L524) | v | Number, isNaN, n.toFixed, nxTryTsDashboardFormat |
| [`formatEnergyKwh`](../../../../../src-ts/runtime-executables/www/app.ts#L543) | v | Math.abs, Number, isFinite, isNaN, n.toFixed, nxTryTsDashboardFormat |
| [`formatCurrencyEur`](../../../../../src-ts/runtime-executables/www/app.ts#L555) | v | Number, isFinite, isNaN, n.toFixed |
| [`formatPowerSigned`](../../../../../src-ts/runtime-executables/www/app.ts#L567) | v | Math.abs, Number, abs.toFixed, isNaN, nxTryTsDashboardFormat |
| [`formatFlowPower`](../../../../../src-ts/runtime-executables/www/app.ts#L583) | v, decimals | Number, isNaN, nxTryTsDashboardFormat |
| [`formatNum`](../../../../../src-ts/runtime-executables/www/app.ts#L598) | v, suffix | Number, isNaN, n.toFixed |
| [`formatNum`](../../../../../src-ts/runtime-executables/www/app.ts#L614) | v, suffix | Number, isNaN |
| [`formatPricePerKwh`](../../../../../src-ts/runtime-executables/www/app.ts#L625) | v | window.NexoWattTariffDisplay.format |
| [`nwParsePriceCurve`](../../../../../src-ts/runtime-executables/www/app.ts#L643) | raw | window.NexoWattTariffDisplay.parseCurve |
| [`nwNiceStep`](../../../../../src-ts/runtime-executables/www/app.ts#L653) | range, targetTicks | Math.floor, Math.log10, Math.max, Math.pow, Number |
| [`nwClamp`](../../../../../src-ts/runtime-executables/www/app.ts#L671) | v, lo, hi | Math.max, Math.min, Number, Number.isFinite |
| [`nwQuantile`](../../../../../src-ts/runtime-executables/www/app.ts#L682) | arr, q | Array.isArray, Math.floor, Math.max, Math.min, Number |
| [`nwMedian`](../../../../../src-ts/runtime-executables/www/app.ts#L700) | arr | nwQuantile |
| [`nwResolveTariffThresholds`](../../../../../src-ts/runtime-executables/www/app.ts#L709) | pricesEur, cheapCandidate, expensiveCandidate | Array.isArray, Math.max, Math.min, Number, Number.isFinite, isValid, nwQuantile |
| [`isValid`](../../../../../src-ts/runtime-executables/www/app.ts#L729) | v | Number.isFinite |
| [`nwAggregateCurve`](../../../../../src-ts/runtime-executables/www/app.ts#L760) | curve, dayStartMs, dayEndMs, targetIntervalMs | Array.isArray, Math.max, Math.min, Number, Number.isFinite, out.push |
| [`nwFormatCt`](../../../../../src-ts/runtime-executables/www/app.ts#L810) | vEurKwh | Number, isNaN |
| [`nwTariffColorForPrice`](../../../../../src-ts/runtime-executables/www/app.ts#L820) | priceEurKwh, cheapThr, expensiveThr | Number, Number.isFinite |
| [`nwDrawTariffForecastChart`](../../../../../src-ts/runtime-executables/www/app.ts#L835) | canvas, curve, opts | Array.isArray, Date.now, Math.abs, Math.ceil, Math.floor, Math.max, Math.min, Math.round, Number, Number.isFinite, String, canvas.getContext, ctx.beginPath, ctx.clearRect (weitere in der Quelle) |
| [`xOf`](../../../../../src-ts/runtime-executables/www/app.ts#L915) | tMs | nwClamp |
| [`yOf`](../../../../../src-ts/runtime-executables/www/app.ts#L925) | pCt | nwClamp |
| [`initTariffForecastTooltip`](../../../../../src-ts/runtime-executables/www/app.ts#L1011) | – | btn.addEventListener, card.addEventListener, document.addEventListener, document.body.appendChild, document.createElement, document.getElementById, tip.addEventListener, tip.querySelector, tip.setAttribute, window.addEventListener |
| [`v`](../../../../../src-ts/runtime-executables/www/app.ts#L1060) | k | – |
| [`tsOf`](../../../../../src-ts/runtime-executables/www/app.ts#L1070) | k | Number |
| [`getTodayRange`](../../../../../src-ts/runtime-executables/www/app.ts#L1080) | – | Date.now, window.NexoWattTariffDisplay.dayRange |
| [`update`](../../../../../src-ts/runtime-executables/www/app.ts#L1089) | – | Array.isArray, Date.now, Math.max, Math.min, Number, Number.isFinite, _fmtTimeHHmm, curveToday.map, getTodayRange, nwDrawTariffForecastChart, nwFormatCt, nwParsePriceCurve, nwResolveTariffThresholds, ps.reduce (weitere in der Quelle) |
| [`place`](../../../../../src-ts/runtime-executables/www/app.ts#L1157) | – | Math.round, anchor.getBoundingClientRect, nwClamp, tip.classList.add, tip.classList.contains, tip.classList.remove, tip.getBoundingClientRect |
| [`show`](../../../../../src-ts/runtime-executables/www/app.ts#L1200) | anchor | clearInterval, place, requestAnimationFrame, setInterval, tip.classList.add, update |
| [`hide`](../../../../../src-ts/runtime-executables/www/app.ts#L1219) | – | clearInterval, clearTimeout, tip.classList.remove |
| [`toggle`](../../../../../src-ts/runtime-executables/www/app.ts#L1231) | anchor | hide, show |
| [`_fmtTempC`](../../../../../src-ts/runtime-executables/www/app.ts#L1326) | v | Number, isNaN |
| [`_fmtPct`](../../../../../src-ts/runtime-executables/www/app.ts#L1336) | v | Number, isNaN |
| [`_fmtKmh`](../../../../../src-ts/runtime-executables/www/app.ts#L1346) | v | Number, isNaN |
| [`_fmtNumLocal`](../../../../../src-ts/runtime-executables/www/app.ts#L1356) | v, digits | Number, isNaN, n.toFixed, n.toLocaleString, nwUiLocaleTag |
| [`_fmtTimeHHmm`](../../../../../src-ts/runtime-executables/www/app.ts#L1372) | ts | Number, String, d.getHours, d.getMinutes, isNaN |
| [`_pickWeatherIcon`](../../../../../src-ts/runtime-executables/www/app.ts#L1385) | code, text | Number, String, isNaN, t.includes |
| [`setWidth`](../../../../../src-ts/runtime-executables/www/app.ts#L1416) | id, pct | Math.max, Math.min, document.getElementById |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L1427) | id, text | document.getElementById |
| [`nwSetDisplay`](../../../../../src-ts/runtime-executables/www/app.ts#L1438) | id, visible, displayValue | document.getElementById |
| [`nwSetElementVisible`](../../../../../src-ts/runtime-executables/www/app.ts#L1449) | el, visible, displayValue | el.classList.toggle |
| [`nwAsBool`](../../../../../src-ts/runtime-executables/www/app.ts#L1460) | v, def | String |
| [`nwFeatureMappedRow`](../../../../../src-ts/runtime-executables/www/app.ts#L1475) | row | fields.some |
| [`nwConfiguredEvcsRows`](../../../../../src-ts/runtime-executables/www/app.ts#L1488) | inputCfg | Array.isArray, list.filter |
| [`nwEvcsFeatureFromConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L1506) | inputCfg | Number, Number.isFinite, nwConfiguredEvcsRows |
| [`nwEvcsCountFromConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L1526) | inputCfg | Math.max, Math.round, Number, Number.isFinite |
| [`nwOptionalFeatureFromConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L1542) | inputCfg, key, fallback | – |
| [`nwSmartHomeFeatureFromConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L1550) | inputCfg | nwOptionalFeatureFromConfig |
| [`nwStorageFarmAppCenterActiveFromConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L1554) | inputCfg | – |
| [`nwStorageFarmHasRealRowsFromConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L1568) | inputCfg | Array.isArray, rows.filter |
| [`nwStorageFarmFeatureFromConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L1587) | inputCfg, stateSnapshot | Number, Number.isFinite, nwAsBool, nwStorageFarmAppCenterActiveFromConfig, nwStorageFarmHasRealRowsFromConfig |
| [`nwTsFeatureVisibilityShadowEnabled`](../../../../../src-ts/runtime-executables/www/app.ts#L1633) | – | String, qs.get, window.localStorage.getItem |
| [`nwBuildTsFeatureVisibilityInput`](../../../../../src-ts/runtime-executables/www/app.ts#L1658) | inputCfg, stateSnapshot | Array.isArray, String, nwAsBool, nwConfiguredEvcsRows, nwSmartHomeFeatureFromConfig, nwStorageFarmFeatureFromConfig, rows.map, storageFarmStorages.map |
| [`nwRunTsFeatureVisibilityShadowCheck`](../../../../../src-ts/runtime-executables/www/app.ts#L1712) | inputCfg, stateSnapshot, legacyVisibility | console.debug, console.warn, import, keys.filter, mod.buildCustomerFeatureVisibility, nwBuildTsFeatureVisibilityInput, nwTsFeatureVisibilityShadowEnabled |
| [`nwApplyCustomerFeatureVisibility`](../../../../../src-ts/runtime-executables/www/app.ts#L1738) | inputCfg, stateSnapshot | document.getElementById, evSide.closest, evcsCard.classList.toggle, menuEvcsLink.classList.toggle, menuStorageFarmLink.classList.toggle, nwEvcsCountFromConfig, nwEvcsFeatureFromConfig, nwRunTsFeatureVisibilityShadowCheck, nwSetElementVisible, nwSmartHomeFeatureFromConfig, nwStorageFarmFeatureFromConfig, tabEvcs.classList.toggle, tabStorageFarm.classList.toggle, tile.querySelector |
| [`nwFormatDashboardTimestamp`](../../../../../src-ts/runtime-executables/www/app.ts#L1796) | ts | Number, Number.isFinite, String, d.getDate, d.getFullYear, d.getHours, d.getMinutes, d.getMonth, d.getSeconds |
| [`nwLatestStateTimestamp`](../../../../../src-ts/runtime-executables/www/app.ts#L1814) | keys | Array.isArray, Date.now, Object.keys, keys.forEach |
| [`scanKey`](../../../../../src-ts/runtime-executables/www/app.ts#L1823) | k | Number, Number.isFinite |
| [`nwSetLiveOnline`](../../../../../src-ts/runtime-executables/www/app.ts#L1845) | isOnline | document.getElementById, dot.classList.toggle, setText, updateEmsControlUi |
| [`getEvcsPowerW`](../../../../../src-ts/runtime-executables/www/app.ts#L1861) | readValue | d, mapped.trim, window.NexoWattPowerMeasurements?.resolveEvcsPower |
| [`updateDashboardShellUi`](../../../../../src-ts/runtime-executables/www/app.ts#L1873) | data | Math.abs, Math.max, Math.round, Number, Number.isFinite, String, coerceNumber, d, document.getElementById, formatFlowPower, getEvcsPowerW, liveDot.classList.contains, nwApplyCustomerFeatureVisibility, nwEvcsFeatureFromConfig (weitere in der Quelle) |
| [`_svgEl`](../../../../../src-ts/runtime-executables/www/app.ts#L1930) | tag, attrs | Object.entries, String, document.createElementNS, el.setAttribute |
| [`initEnergyWebExtras`](../../../../../src-ts/runtime-executables/www/app.ts#L1946) | flowSlots | Array.isArray, Math.max, Math.min, Number.isFinite, Object.assign, String, bhkwAll.filter, consumersAll.filter, document.getElementById, genAll.filter, nwEvcsFeatureFromConfig, parts.every, placeConsumersRightArc, placeProducersLeftArc (weitere in der Quelle) |
| [`placeItem`](../../../../../src-ts/runtime-executables/www/app.ts#L2047) | item, x, y, kind, idx, rNode | Math.max, Number, String, _svgEl, flowExtras.consumers.push, flowExtras.producers.push, formatFlowPower, g.addEventListener, g.appendChild, g.classList.add, g.setAttribute, gLines.appendChild, gNodes.appendChild, icoText.appendChild (weitere in der Quelle) |
| [`_readTranslate`](../../../../../src-ts/runtime-executables/www/app.ts#L2168) | id, fallback | Number, Number.isFinite, document.getElementById, el.getAttribute, tr.match |
| [`placeSpecialProducer`](../../../../../src-ts/runtime-executables/www/app.ts#L2195) | item, x, y, role, rNode | Array.isArray, Math.max, String, _svgEl, flowExtras.special.push, formatFlowPower, g.appendChild, g.setAttribute, gLines.appendChild, gNodes.appendChild, icoText.appendChild, rawLabel.slice |
| [`placeSpecialLowerLeftArc`](../../../../../src-ts/runtime-executables/www/app.ts#L2270) | items | Array.isArray, Math.cos, Math.max, Math.min, Math.sin, Number.isFinite, items.filter, placeSpecialProducer |
| [`clampFlowPoint`](../../../../../src-ts/runtime-executables/www/app.ts#L2360) | pt | Math.max, Math.min |
| [`sampleAngles`](../../../../../src-ts/runtime-executables/www/app.ts#L2370) | startDeg, endDeg, count | Array.from, Math.round |
| [`buildConsumerAngles`](../../../../../src-ts/runtime-executables/www/app.ts#L2389) | count | Math.ceil, sampleAngles, upper.concat |
| [`nudgeAway`](../../../../../src-ts/runtime-executables/www/app.ts#L2420) | pt, blocker, minDist | Math.hypot, Number.isFinite |
| [`resolveExtraNodePoint`](../../../../../src-ts/runtime-executables/www/app.ts#L2448) | kind, x, y, rNode, placed | Array.isArray, clampFlowPoint, fixedBlockers.concat, fixedBlockers.push, nudgeAway |
| [`placeConsumersRightArc`](../../../../../src-ts/runtime-executables/www/app.ts#L2490) | items | Math.cos, Math.min, Math.sin, buildConsumerAngles, placeItem, placed.push, resolveExtraNodePoint |
| [`placeProducersLeftArc`](../../../../../src-ts/runtime-executables/www/app.ts#L2521) | items | Math.cos, Math.sin, placeItem |
| [`isHeatingRodFlowItem`](../../../../../src-ts/runtime-executables/www/app.ts#L2592) | it | String |
| [`resolveHeatingRodFlowPower`](../../../../../src-ts/runtime-executables/www/app.ts#L2605) | it, d, fallbackRaw | Math.abs, Math.max, Math.round, Number, Number.isFinite, readN |
| [`readN`](../../../../../src-ts/runtime-executables/www/app.ts#L2613) | key | Number, Number.isFinite, d |
| [`updateEnergyWebExtras`](../../../../../src-ts/runtime-executables/www/app.ts#L2645) | d | Array.isArray, Math.abs, Number, d, formatFlowPower, isHeatingRodFlowItem, resolveHeatingRodFlowPower, setNodeActive, setRev, setText, show, stabilizeFlowAbs, stabilizeFlowSigned, sumSpecialPower |
| [`show`](../../../../../src-ts/runtime-executables/www/app.ts#L2653) | id, abs | Math.max, Math.min, Number, String, document.getElementById |
| [`setRev`](../../../../../src-ts/runtime-executables/www/app.ts#L2673) | id, rev | document.getElementById, el.classList.toggle |
| [`setNodeActive`](../../../../../src-ts/runtime-executables/www/app.ts#L2684) | nodeId, active | document.getElementById |
| [`sumSpecialPower`](../../../../../src-ts/runtime-executables/www/app.ts#L2719) | role, devices | Array.isArray, Number, Number.isFinite, String, d |
| [`setRingSegment`](../../../../../src-ts/runtime-executables/www/app.ts#L2783) | cls, pct | Math.max, Math.min, document.querySelector, el.setAttribute |
| [`computeDerived`](../../../../../src-ts/runtime-executables/www/app.ts#L2799) | – | Math.max, Math.min, Number, getGridImportExport, getNormalizedBatteryFlow, pick |
| [`get`](../../../../../src-ts/runtime-executables/www/app.ts#L2845) | k | – |
| [`pick`](../../../../../src-ts/runtime-executables/www/app.ts#L2852) | keys | coerceNumber, get |
| [`coerceNumber`](../../../../../src-ts/runtime-executables/www/app.ts#L2866) | v | Number.isFinite, String, parseFloat, s.replace |
| [`clamp01`](../../../../../src-ts/runtime-executables/www/app.ts#L2882) | v, lo, hi | Math.max, Math.min, Number.isFinite |
| [`isMappedDatapoint`](../../../../../src-ts/runtime-executables/www/app.ts#L2892) | key | Object.prototype.hasOwnProperty.call, String |
| [`getGridImportExport`](../../../../../src-ts/runtime-executables/www/app.ts#L2912) | read | Math.max, coerceNumber, getter, isMappedDatapoint |
| [`getStateAgeMs`](../../../../../src-ts/runtime-executables/www/app.ts#L2948) | key | Date.now, Math.max, Number, Number.isFinite |
| [`getFlowFreshMaxAgeMs`](../../../../../src-ts/runtime-executables/www/app.ts#L2964) | – | Math.max, Math.round, coerceNumber |
| [`getFreshFlowNumber`](../../../../../src-ts/runtime-executables/www/app.ts#L2980) | key, opts | Number, Number.isFinite, coerceNumber, getFlowFreshMaxAgeMs, getStateAgeMs, isMappedDatapoint |
| [`getStableFlowNumber`](../../../../../src-ts/runtime-executables/www/app.ts#L2997) | key, opts | Object.assign, getFreshFlowNumber |
| [`getConfiguredDatapointId`](../../../../../src-ts/runtime-executables/www/app.ts#L3008) | key | String |
| [`getBalanceDerivedBatteryFlow`](../../../../../src-ts/runtime-executables/www/app.ts#L3023) | opts | Math.abs, Math.max, Math.round, Number, Number.isFinite, coerceNumber, getGridImportExport, isMappedDatapoint, nwStorageFarmFeatureFromConfig, read |
| [`read`](../../../../../src-ts/runtime-executables/www/app.ts#L3033) | k | – |
| [`preferBalanceDerivedBatteryFlow`](../../../../../src-ts/runtime-executables/www/app.ts#L3090) | current, opts | Math.max, Number, Number.isFinite, Object.assign, String, getBalanceDerivedBatteryFlow |
| [`getNormalizedBatteryFlow`](../../../../../src-ts/runtime-executables/www/app.ts#L3114) | – | Math.abs, Math.max, Number, Number.isFinite, fromSigned, getBalanceDerivedBatteryFlow, getConfiguredDatapointId, getStableFlowNumber, nwStorageFarmFeatureFromConfig |
| [`fromSigned`](../../../../../src-ts/runtime-executables/www/app.ts#L3138) | raw, src | Math.abs, Number, Number.isFinite |
| [`getCanonicalPvPowerW`](../../../../../src-ts/runtime-executables/www/app.ts#L3223) | readValue | Math.abs, Math.max, Number, Number.isFinite, d, nwStorageFarmFeatureFromConfig |
| [`render`](../../../../../src-ts/runtime-executables/www/app.ts#L3255) | – | Math.max, Math.round, Number, String, _fmtKmh, _fmtNumLocal, _fmtPct, _fmtTempC, _fmtTimeHHmm, _pickWeatherIcon, autarkyN.toFixed, clamp01, co2FromPvT.toFixed, coerceNumber (weitere in der Quelle) |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L3263) | k | – |
| [`pct`](../../../../../src-ts/runtime-executables/www/app.ts#L3299) | v | Math.abs |
| [`bootstrap`](../../../../../src-ts/runtime-executables/www/app.ts#L3513) | – | Date.now, Object.keys, String, applyFlowCoreLabels, bindToggleButtonGroups, cfgRes.json, console.warn, document.documentElement.setAttribute, document.getElementById, fetch, initBhkwModal, initEnergyWebExtras, initGeneratorModal, initRelayModal (weitere in der Quelle) |
| [`applyConfigSnapshot`](../../../../../src-ts/runtime-executables/www/app.ts#L3599) | nextCfg | Math.max, Math.round, Number, Number.isFinite, applyFlowCoreLabels, console.warn, document.getElementById, initEnergyWebExtras, menuEvcsLink.classList.toggle, menuSmartHomeLink.classList.toggle, menuStorageFarmLink.classList.toggle, nwApplyCustomerFeatureVisibility, nwEvcsFeatureFromConfig, nwSmartHomeFeatureFromConfig (weitere in der Quelle) |
| [`refreshConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L3676) | – | applyConfigSnapshot, console.warn, fetch, refreshConfig, scheduleRender |
| [`startEvents`](../../../../../src-ts/runtime-executables/www/app.ts#L3731) | – | console.warn, document.getElementById, dot.classList.remove, setTimeout, window.NW_RUNTIME?.url |
| [`initMenu`](../../../../../src-ts/runtime-executables/www/app.ts#L3773) | – | btn.addEventListener, document.addEventListener, document.getElementById, menu.addEventListener, settingsBtn.addEventListener |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L3794) | – | menu.classList.toggle |
| [`close`](../../../../../src-ts/runtime-executables/www/app.ts#L3801) | – | menu.classList.add |
| [`initSettingsPanel`](../../../../../src-ts/runtime-executables/www/app.ts#L3840) | – | JSON.parse, String, applySoc, document.getElementById, dynToggle.addEventListener, elRef.addEventListener, elSoc.addEventListener, energyWalletToggle.addEventListener, localStorage.getItem, netFeeModelSel.addEventListener, netFeeTabs.querySelectorAll, netFeeToggle.addEventListener, normalizePriorityValue, notifyTestBtn.addEventListener (weitere in der Quelle) |
| [`updatePriorityLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L3870) | – | Number |
| [`updateTariffModeLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L3881) | – | Number |
| [`updateDynVisibility`](../../../../../src-ts/runtime-executables/www/app.ts#L3898) | – | syncToggleButtonsForInputId |
| [`updateEnergyWalletSettingsVisibility`](../../../../../src-ts/runtime-executables/www/app.ts#L3906) | – | syncToggleButtonsForInputId |
| [`normalizePriorityValue`](../../../../../src-ts/runtime-executables/www/app.ts#L3927) | – | Number, Number.isFinite, String |
| [`snapPriority`](../../../../../src-ts/runtime-executables/www/app.ts#L3954) | – | Number, Number.isFinite, String, updatePriorityLabel |
| [`snapTariffMode`](../../../../../src-ts/runtime-executables/www/app.ts#L3976) | – | Number, Number.isFinite, String, updateTariffModeLabel |
| [`setDynSubTab`](../../../../../src-ts/runtime-executables/www/app.ts#L4011) | tab | netFeeTabs.querySelectorAll |
| [`updateNetFeeUi`](../../../../../src-ts/runtime-executables/www/app.ts#L4030) | opts | String, setDynSubTab, syncToggleButtonsForInputId |
| [`updatePvSeasonUi`](../../../../../src-ts/runtime-executables/www/app.ts#L4085) | – | pvSeasonAiToggle.dispatchEvent, syncToggleButtonsForInputId |
| [`_nwBool`](../../../../../src-ts/runtime-executables/www/app.ts#L4150) | v | String |
| [`updateWeatherVisibility`](../../../../../src-ts/runtime-executables/www/app.ts#L4161) | – | _nwBool, syncToggleButtonsForInputId |
| [`updateWeatherModeUi`](../../../../../src-ts/runtime-executables/www/app.ts#L4186) | – | String, weatherBtns.querySelectorAll |
| [`applySoc`](../../../../../src-ts/runtime-executables/www/app.ts#L4364) | – | document.getElementById |
| [`applyInitialTabFromUrl`](../../../../../src-ts/runtime-executables/www/app.ts#L4395) | – | String, params.get, tryActivate, window.NW_RUNTIME?.url, window.location.replace |
| [`tryActivate`](../../../../../src-ts/runtime-executables/www/app.ts#L4420) | – | btn.classList.contains, btn.click, document.querySelector, setTimeout |
| [`_nwCssEscapeIdent`](../../../../../src-ts/runtime-executables/www/app.ts#L4440) | s | CSS.escape, String |
| [`syncToggleGroup`](../../../../../src-ts/runtime-executables/www/app.ts#L4453) | groupEl, checked | Array.from, btns.forEach, groupEl.querySelectorAll |
| [`syncToggleButtonsForInputId`](../../../../../src-ts/runtime-executables/www/app.ts#L4468) | inputId | _nwCssEscapeIdent, document.getElementById, document.querySelectorAll |
| [`syncAllToggleButtons`](../../../../../src-ts/runtime-executables/www/app.ts#L4481) | – | document.querySelectorAll |
| [`bindToggleButtonGroups`](../../../../../src-ts/runtime-executables/www/app.ts#L4500) | – | document.addEventListener, syncAllToggleButtons |
| [`hideAllPanels`](../../../../../src-ts/runtime-executables/www/app.ts#L4576) | – | document.body.classList.remove, document.querySelector, document.querySelectorAll |
| [`showDashboardTab`](../../../../../src-ts/runtime-executables/www/app.ts#L4588) | tab | String, document.body.classList.toggle, document.querySelector, document.querySelectorAll, window.NW_RUNTIME?.url |
| [`loadConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L4620) | – | console.warn, fetch, r.json |
| [`bindInputValue`](../../../../../src-ts/runtime-executables/www/app.ts#L4634) | el, stateKey | String, el.addEventListener, sk.slice, sk.startsWith, v.trim |
| [`updatePvSurplusSettingsUi`](../../../../../src-ts/runtime-executables/www/app.ts#L4713) | – | String, block.classList.toggle, document.getElementById, row.classList.toggle |
| [`setupPvSurplusSettingsUi`](../../../../../src-ts/runtime-executables/www/app.ts#L4730) | – | document.getElementById, enabled.addEventListener, select.addEventListener, updatePvSurplusSettingsUi |
| [`initSettingsPageTabs`](../../../../../src-ts/runtime-executables/www/app.ts#L4747) | – | Array.from, activatePage, buttons.forEach, document.querySelector, wrap.querySelectorAll |
| [`normalizePage`](../../../../../src-ts/runtime-executables/www/app.ts#L4758) | value | String, allowed.includes, buttons.map |
| [`activatePage`](../../../../../src-ts/runtime-executables/www/app.ts#L4777) | value | buttons.forEach, normalizePage, renderSettingsLogPanel, sessionStorage.setItem, wrap.querySelectorAll |
| [`_nwSettingsStateValue`](../../../../../src-ts/runtime-executables/www/app.ts#L4810) | key | – |
| [`_nwSettingsText`](../../../../../src-ts/runtime-executables/www/app.ts#L4820) | value, fallback | String |
| [`_nwSettingsBool`](../../../../../src-ts/runtime-executables/www/app.ts#L4831) | value | String |
| [`_nwSettingsCount`](../../../../../src-ts/runtime-executables/www/app.ts#L4845) | value | Math.round, Number, Number.isFinite, String |
| [`_nwSettingsTs`](../../../../../src-ts/runtime-executables/www/app.ts#L4855) | value | Number, Number.isFinite, nwUiLocaleTag |
| [`_nwSettingsPower`](../../../../../src-ts/runtime-executables/www/app.ts#L4866) | value | Number, Number.isFinite, formatPower |
| [`_nwSettingsDays`](../../../../../src-ts/runtime-executables/www/app.ts#L4876) | value | Math.round, Number, Number.isFinite |
| [`_nwSettingsJson`](../../../../../src-ts/runtime-executables/www/app.ts#L4886) | value | JSON.parse, JSON.stringify, _nwSettingsText |
| [`renderSettingsLogPanel`](../../../../../src-ts/runtime-executables/www/app.ts#L4897) | – | String, _nwSettingsBool, _nwSettingsCount, _nwSettingsDays, _nwSettingsJson, _nwSettingsPower, _nwSettingsStateValue, _nwSettingsText, _nwSettingsTs, document.getElementById, document.querySelector, set |
| [`set`](../../../../../src-ts/runtime-executables/www/app.ts#L4924) | id, value | document.getElementById |
| [`setupSettingsReportButtons`](../../../../../src-ts/runtime-executables/www/app.ts#L5008) | – | btn.addEventListener, document.getElementById |
| [`setupSettings`](../../../../../src-ts/runtime-executables/www/app.ts#L5027) | – | document.querySelectorAll, initSettingsPageTabs, renderSettingsLogPanel, setupPvSurplusSettingsUi, setupRfidBillingUi, setupRfidLearningUi, setupRfidWhitelistUi, setupSettingsReportButtons |
| [`parseJsonSafe`](../../../../../src-ts/runtime-executables/www/app.ts#L5050) | raw, fallback | JSON.parse, JSON.stringify |
| [`storageFarmGetStatusList`](../../../../../src-ts/runtime-executables/www/app.ts#L5063) | – | Array.isArray, parseJsonSafe |
| [`storageFarmUpdateModeLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L5075) | – | String, document.getElementById |
| [`storageFarmUpdateSummary`](../../../../../src-ts/runtime-executables/www/app.ts#L5088) | – | Number, document.getElementById, formatPower |
| [`storageFarmRenderStatusRows`](../../../../../src-ts/runtime-executables/www/app.ts#L5107) | list | Array.isArray, document.getElementById, list.forEach |
| [`mkCell`](../../../../../src-ts/runtime-executables/www/app.ts#L5132) | txt, label | String, d.setAttribute, document.createElement |
| [`storageFarmApply`](../../../../../src-ts/runtime-executables/www/app.ts#L5195) | – | storageFarmGetStatusList, storageFarmRenderStatusRows, storageFarmUpdateModeLabel, storageFarmUpdateSummary |
| [`initStorageFarmPanel`](../../../../../src-ts/runtime-executables/www/app.ts#L5209) | – | btnReload.addEventListener, document.getElementById, storageFarmApply |
| [`loadRfidCustomerState`](../../../../../src-ts/runtime-executables/www/app.ts#L5225) | – | Array.isArray, Date.now, JSON.stringify, Number, Object.assign, String, fetch, response.json |
| [`setupRfidWhitelistUi`](../../../../../src-ts/runtime-executables/www/app.ts#L5250) | – | btnAdd.addEventListener, btnReload.addEventListener, btnSave.addEventListener, document.getElementById, readWhitelistFromState, render |
| [`normRfid`](../../../../../src-ts/runtime-executables/www/app.ts#L5263) | v | String |
| [`safeText`](../../../../../src-ts/runtime-executables/www/app.ts#L5270) | v | String |
| [`readWhitelistFromState`](../../../../../src-ts/runtime-executables/www/app.ts#L5277) | – | Array.isArray, JSON.parse, String, arr.map |
| [`setMsg`](../../../../../src-ts/runtime-executables/www/app.ts#L5303) | t | – |
| [`render`](../../../../../src-ts/runtime-executables/www/app.ts#L5310) | – | setMsg |
| [`save`](../../../../../src-ts/runtime-executables/www/app.ts#L5360) | – | JSON.stringify, cleaned.push, fetch, normRfid, render, safeText, seen.add, seen.has, setMsg |
| [`reload`](../../../../../src-ts/runtime-executables/www/app.ts#L5393) | – | loadRfidCustomerState, readWhitelistFromState, render, setMsg |
| [`setupRfidLearningUi`](../../../../../src-ts/runtime-executables/www/app.ts#L5466) | – | applyUi, btnAdd.addEventListener, btnLearn.addEventListener, document.getElementById, loadRfidCustomerState |
| [`setMsg`](../../../../../src-ts/runtime-executables/www/app.ts#L5480) | t | – |
| [`setLearningActive`](../../../../../src-ts/runtime-executables/www/app.ts#L5487) | active | JSON.stringify, fetch |
| [`readStateVal`](../../../../../src-ts/runtime-executables/www/app.ts#L5504) | key | – |
| [`stopLearningPoll`](../../../../../src-ts/runtime-executables/www/app.ts#L5510) | – | clearTimeout |
| [`pollLearningState`](../../../../../src-ts/runtime-executables/www/app.ts#L5514) | – | Date.now, applyUi, loadRfidCustomerState, readStateVal, setTimeout, stopLearningPoll |
| [`startLearningPoll`](../../../../../src-ts/runtime-executables/www/app.ts#L5523) | – | Date.now, pollLearningState |
| [`applyUi`](../../../../../src-ts/runtime-executables/www/app.ts#L5533) | – | Number, String, nwUiLocaleTag, readStateVal, setMsg |
| [`setupRfidBillingUi`](../../../../../src-ts/runtime-executables/www/app.ts#L5606) | – | String, applyMode, btnOpen.addEventListener, document.getElementById, modeWrap.querySelectorAll, now.getFullYear, now.getMonth, pad2, renderOptions |
| [`pad2`](../../../../../src-ts/runtime-executables/www/app.ts#L5623) | n | Number, String |
| [`setMsg`](../../../../../src-ts/runtime-executables/www/app.ts#L5630) | t | – |
| [`getWhitelist`](../../../../../src-ts/runtime-executables/www/app.ts#L5637) | – | Array.isArray, JSON.parse, window.__nwRfidWhitelist.get |
| [`renderOptions`](../../../../../src-ts/runtime-executables/www/app.ts#L5663) | – | Array.isArray, String, document.createElement, getWhitelist, sel.appendChild |
| [`applyMode`](../../../../../src-ts/runtime-executables/www/app.ts#L5713) | m | modeWrap.querySelectorAll, monthRow.classList.toggle, setMsg, yearRow.classList.toggle |
| [`setupInstaller`](../../../../../src-ts/runtime-executables/www/app.ts#L5800) | – | btn.addEventListener, cancel.addEventListener, document.getElementById, form.addEventListener, refreshLock |
| [`refreshLock`](../../../../../src-ts/runtime-executables/www/app.ts#L5813) | – | fetch, formBox.classList.toggle, formBox.querySelectorAll, loginBox.classList.toggle, r.json |
| [`doLogin`](../../../../../src-ts/runtime-executables/www/app.ts#L5833) | – | JSON.stringify, String, alert, fetch, refreshLock |
| [`initInstallerPanel`](../../../../../src-ts/runtime-executables/www/app.ts#L5877) | – | document.getElementById, document.querySelectorAll, window.NW_RUNTIME?.url |
| [`initTabs`](../../../../../src-ts/runtime-executables/www/app.ts#L5893) | – | buttons.forEach, document.querySelectorAll |
| [`renderSmartHome`](../../../../../src-ts/runtime-executables/www/app.ts#L5912) | – | Number, document.getElementById, get, onTxt |
| [`onTxt`](../../../../../src-ts/runtime-executables/www/app.ts#L5919) | v | – |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L5926) | k | – |
| [`get`](../../../../../src-ts/runtime-executables/www/app.ts#L5933) | path | d |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L5965) | k | – |
| [`pctDeg`](../../../../../src-ts/runtime-executables/www/app.ts#L5990) | val, maxDeg | Math.max, Math.min |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L6009) | id, t | document.getElementById |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L6049) | k | – |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L6072) | id, t | document.getElementById |
| [`pct`](../../../../../src-ts/runtime-executables/www/app.ts#L6110) | v | Math.max, Math.min |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L6141) | k | – |
| [`pctDeg`](../../../../../src-ts/runtime-executables/www/app.ts#L6166) | val, maxDeg | Math.max, Math.min |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L6185) | id, t | document.getElementById |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L6225) | k | – |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L6248) | id, t | document.getElementById |
| [`pct`](../../../../../src-ts/runtime-executables/www/app.ts#L6286) | v | Math.max, Math.min |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L6309) | k | – |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L6318) | id, txt | document.getElementById |
| [`setSideValue`](../../../../../src-ts/runtime-executables/www/app.ts#L6333) | id, val | document.getElementById |
| [`updateEmsControlUi`](../../../../../src-ts/runtime-executables/www/app.ts#L6343) | – | Date.now, Number, Number.isFinite, String, card.classList.toggle, document.getElementById, formatPower, formatPricePerKwh, modal.classList.contains, modeWrap.querySelectorAll, prioWrap.querySelectorAll, setText, v, window.NexoWattTariffDisplay.display (weitere in der Quelle) |
| [`v`](../../../../../src-ts/runtime-executables/www/app.ts#L6358) | k | – |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L6387) | id, txt | document.getElementById |
| [`initEmsControlModal`](../../../../../src-ts/runtime-executables/www/app.ts#L6548) | – | closeBtn.addEventListener, document.getElementById, energyDetailsBtn.addEventListener, modal.addEventListener, modeWrap.querySelectorAll, openBtn.addEventListener, openSettingsBtn.addEventListener, prioWrap.querySelectorAll, tariffToggle.addEventListener |
| [`setSetting`](../../../../../src-ts/runtime-executables/www/app.ts#L6569) | key, value | JSON.stringify, fetch |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L6592) | e | e.preventDefault, modal.classList.remove, updateEmsControlUi |
| [`close`](../../../../../src-ts/runtime-executables/www/app.ts#L6603) | – | modal.classList.add |
| [`initThresholdModal`](../../../../../src-ts/runtime-executables/www/app.ts#L6663) | – | card.addEventListener, closeBtn.addEventListener, document.addEventListener, document.getElementById, modal.addEventListener |
| [`setHint`](../../../../../src-ts/runtime-executables/www/app.ts#L6680) | msg, isError | String |
| [`apiSet`](../../../../../src-ts/runtime-executables/www/app.ts#L6691) | key, value | JSON.stringify, fetch, resp.json, setHint |
| [`renderModal`](../../../../../src-ts/runtime-executables/www/app.ts#L6723) | – | Array.isArray, configured.forEach, document.createElement, listEl.appendChild, setHint |
| [`v`](../../../../../src-ts/runtime-executables/www/app.ts#L6734) | k | – |
| [`mkRow`](../../../../../src-ts/runtime-executables/www/app.ts#L6762) | r | Math.max, Math.min, Math.round, Number, Number.isFinite, String, body.appendChild, box.appendChild, btnWrap.appendChild, ctl.appendChild, document.createElement, head.appendChild, inp.addEventListener, mkBtn (weitere in der Quelle) |
| [`prettyStatus`](../../../../../src-ts/runtime-executables/www/app.ts#L6797) | raw | String |
| [`mkKpi`](../../../../../src-ts/runtime-executables/www/app.ts#L6842) | label, valueText | box.appendChild, document.createElement |
| [`setActive`](../../../../../src-ts/runtime-executables/www/app.ts#L6899) | uiVal | Array.from, btnWrap.querySelectorAll |
| [`mkBtn`](../../../../../src-ts/runtime-executables/www/app.ts#L6918) | label, uiVal, sendMode | String, b.addEventListener, b.classList.add, document.createElement |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L7061) | e | e.preventDefault, modal.classList.remove, renderModal |
| [`close`](../../../../../src-ts/runtime-executables/www/app.ts#L7072) | – | modal.classList.add |
| [`initRelayModal`](../../../../../src-ts/runtime-executables/www/app.ts#L7097) | – | card.addEventListener, closeBtn.addEventListener, document.addEventListener, document.getElementById, modal.addEventListener |
| [`setHint`](../../../../../src-ts/runtime-executables/www/app.ts#L7116) | msg, isError | String |
| [`apiSet`](../../../../../src-ts/runtime-executables/www/app.ts#L7127) | idx, prop, value | JSON.stringify, fetch, resp.json, setHint |
| [`fetchSnapshot`](../../../../../src-ts/runtime-executables/www/app.ts#L7159) | – | fetch, r.json |
| [`renderModal`](../../../../../src-ts/runtime-executables/www/app.ts#L7182) | – | Array.isArray, document.createElement, fetchSnapshot, listEl.appendChild, relays.filter, setHint, shown.forEach |
| [`mkRow`](../../../../../src-ts/runtime-executables/www/app.ts#L7221) | r | Number, Number.isFinite, String, body.appendChild, box.appendChild, btnWrap.appendChild, ctl.appendChild, document.createElement, head.appendChild, inp.addEventListener, mkBtn, mkKpi, row.appendChild |
| [`mkKpi`](../../../../../src-ts/runtime-executables/www/app.ts#L7265) | label, valueText | box.appendChild, document.createElement |
| [`mkBtn`](../../../../../src-ts/runtime-executables/www/app.ts#L7310) | label, val | b.addEventListener, document.createElement |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L7389) | e | clearInterval, e.preventDefault, modal.classList.remove, renderModal, setInterval |
| [`close`](../../../../../src-ts/runtime-executables/www/app.ts#L7412) | – | clearInterval, modal.classList.add |
| [`initBhkwModal`](../../../../../src-ts/runtime-executables/www/app.ts#L7439) | – | card.addEventListener, closeBtn.addEventListener, document.addEventListener, document.getElementById, modal.addEventListener |
| [`setHint`](../../../../../src-ts/runtime-executables/www/app.ts#L7458) | msg, isError | String |
| [`apiSet`](../../../../../src-ts/runtime-executables/www/app.ts#L7469) | idx, prop, value | JSON.stringify, fetch, resp.json, setHint |
| [`fetchSnapshot`](../../../../../src-ts/runtime-executables/www/app.ts#L7501) | – | fetch, r.json |
| [`renderModal`](../../../../../src-ts/runtime-executables/www/app.ts#L7524) | – | Array.isArray, devices.filter, document.createElement, fetchSnapshot, listEl.appendChild, setHint, shown.forEach |
| [`mkKpi`](../../../../../src-ts/runtime-executables/www/app.ts#L7565) | label, valueText | box.appendChild, document.createElement |
| [`mkRow`](../../../../../src-ts/runtime-executables/www/app.ts#L7591) | d | Math.round, Number, Number.isNaN, String, addBtn, body.appendChild, cmdRow.appendChild, ctl.appendChild, document.createElement, head.appendChild, mkKpi, modeBox.appendChild, row.appendChild, startBtn.addEventListener (weitere in der Quelle) |
| [`addBtn`](../../../../../src-ts/runtime-executables/www/app.ts#L7662) | val, label | b.addEventListener, b.classList.toggle, document.createElement, grp.appendChild |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L7738) | e | clearInterval, e.preventDefault, modal.classList.remove, renderModal, setInterval |
| [`close`](../../../../../src-ts/runtime-executables/www/app.ts#L7760) | – | clearInterval, modal.classList.add |
| [`initGeneratorModal`](../../../../../src-ts/runtime-executables/www/app.ts#L7783) | – | card.addEventListener, closeBtn.addEventListener, document.addEventListener, document.getElementById, modal.addEventListener |
| [`setHint`](../../../../../src-ts/runtime-executables/www/app.ts#L7802) | msg, isError | String |
| [`apiSet`](../../../../../src-ts/runtime-executables/www/app.ts#L7813) | idx, prop, value | JSON.stringify, fetch, resp.json, setHint |
| [`fetchSnapshot`](../../../../../src-ts/runtime-executables/www/app.ts#L7845) | – | fetch, r.json |
| [`renderModal`](../../../../../src-ts/runtime-executables/www/app.ts#L7868) | – | Array.isArray, devices.filter, document.createElement, fetchSnapshot, listEl.appendChild, setHint, shown.forEach |
| [`mkKpi`](../../../../../src-ts/runtime-executables/www/app.ts#L7909) | label, valueText | box.appendChild, document.createElement |
| [`mkRow`](../../../../../src-ts/runtime-executables/www/app.ts#L7935) | d | Math.round, Number, Number.isNaN, String, addBtn, body.appendChild, cmdRow.appendChild, ctl.appendChild, document.createElement, head.appendChild, mkKpi, modeBox.appendChild, row.appendChild, startBtn.addEventListener (weitere in der Quelle) |
| [`addBtn`](../../../../../src-ts/runtime-executables/www/app.ts#L8006) | val, label | b.addEventListener, b.classList.toggle, document.createElement, grp.appendChild |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L8082) | e | clearInterval, e.preventDefault, modal.classList.remove, renderModal, setInterval |
| [`close`](../../../../../src-ts/runtime-executables/www/app.ts#L8104) | – | clearInterval, modal.classList.add |
| [`updateRelayUi`](../../../../../src-ts/runtime-executables/www/app.ts#L8127) | – | Array.isArray, String, card.classList.add, card.classList.remove, document.getElementById, relays.filter, setText, visible.filter |
| [`updateThresholdUi`](../../../../../src-ts/runtime-executables/www/app.ts#L8166) | – | Array.isArray, String, card.classList.add, card.classList.remove, configured.filter, document.getElementById, rules.filter, setText |
| [`updateBhkwUi`](../../../../../src-ts/runtime-executables/www/app.ts#L8205) | – | Array.isArray, Number, String, card.classList.add, card.classList.remove, devs.filter, document.getElementById, setText, sv |
| [`sv`](../../../../../src-ts/runtime-executables/www/app.ts#L8248) | k | – |
| [`updateGeneratorUi`](../../../../../src-ts/runtime-executables/www/app.ts#L8268) | – | Array.isArray, Number, String, card.classList.add, card.classList.remove, devs.filter, document.getElementById, setText, sv |
| [`sv`](../../../../../src-ts/runtime-executables/www/app.ts#L8310) | k | – |
| [`_ensureThermalConsumerTiles`](../../../../../src-ts/runtime-executables/www/app.ts#L8335) | – | _thermalConsTiles.set, document.createElement, document.getElementById, grid.appendChild, tile.addEventListener, tile.setAttribute |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L8383) | – | console.warn, openFlowQc |
| [`_labelThermalMode`](../../../../../src-ts/runtime-executables/www/app.ts#L8417) | mode | String, m.toLowerCase |
| [`updateThermalConsumerUi`](../../../../../src-ts/runtime-executables/www/app.ts#L8438) | – | Array.isArray, Math.abs, Math.max, Number, Number.isFinite, String, _ensureThermalConsumerTiles, _labelThermalMode, _thermalConsTiles.get, document.getElementById, formatPower, normalizeConsumerType, sv |
| [`normalizeConsumerType`](../../../../../src-ts/runtime-executables/www/app.ts#L8465) | raw | String |
| [`sv`](../../../../../src-ts/runtime-executables/www/app.ts#L8486) | k | – |
| [`updateEnergyWeb`](../../../../../src-ts/runtime-executables/www/app.ts#L8569) | – | Date.now, Math.abs, Math.max, Number, Number.isFinite, String, T, d, document.getElementById, formatFlowPower, getCanonicalPvPowerW, getEvcsPowerW, getGridImportExport, getNormalizedBatteryFlow (weitere in der Quelle) |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L8576) | k | – |
| [`T`](../../../../../src-ts/runtime-executables/www/app.ts#L8715) | id, t | document.getElementById |
| [`show`](../../../../../src-ts/runtime-executables/www/app.ts#L8739) | id, on | document.getElementById |
| [`toggleRev`](../../../../../src-ts/runtime-executables/www/app.ts#L8762) | id, on | document.getElementById, el.classList.toggle |
| [`_nwAiAdvisorStateValue`](../../../../../src-ts/runtime-executables/www/app.ts#L8864) | key, fallback | – |
| [`_nwAiAdvisorBool`](../../../../../src-ts/runtime-executables/www/app.ts#L8879) | key, fallback | String, _nwAiAdvisorStateValue |
| [`_nwAiAdvisorPriorityLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L8894) | p | Number, Number.isFinite, String |
| [`_nwAiAdvisorCategoryLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L8914) | c | String |
| [`_nwEnergyWalletStateValue`](../../../../../src-ts/runtime-executables/www/app.ts#L8940) | key, fallback | Object.prototype.hasOwnProperty.call |
| [`_nwEnergyWalletNum`](../../../../../src-ts/runtime-executables/www/app.ts#L8949) | key, fallback | Number, Number.isFinite, _nwEnergyWalletStateValue |
| [`_nwEnergyWalletMoney`](../../../../../src-ts/runtime-executables/www/app.ts#L8954) | value | Number, Number.isFinite, n.toFixed, n.toLocaleString, nwUiLocaleTag |
| [`_nwEnergyWalletKwh`](../../../../../src-ts/runtime-executables/www/app.ts#L8961) | value | Number, Number.isFinite, n.toFixed, n.toLocaleString, nwUiLocaleTag |
| [`_nwEnergyWalletPricePerKwh`](../../../../../src-ts/runtime-executables/www/app.ts#L8967) | value | Number, Number.isFinite, n.toFixed, n.toLocaleString, nwUiLocaleTag |
| [`_nwEnergyWalletAgeLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L8973) | seconds | Math.max, Math.round, Number |
| [`_nwEnergyWalletEnsureExtendedUi`](../../../../../src-ts/runtime-executables/www/app.ts#L8982) | card | card.appendChild, document.createElement, document.getElementById |
| [`updateEnergyWalletLiveUi`](../../../../../src-ts/runtime-executables/www/app.ts#L9019) | – | Math.round, String, _nwEnergyWalletAgeLabel, _nwEnergyWalletEnsureExtendedUi, _nwEnergyWalletKwh, _nwEnergyWalletMoney, _nwEnergyWalletNum, _nwEnergyWalletPricePerKwh, _nwEnergyWalletStateValue, card.classList.toggle, document.getElementById, eg.classList.toggle, priceEl.classList.toggle, setText (weitere in der Quelle) |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L9034) | id, text | document.getElementById |
| [`_nwAiAdvisorParseSuggestions`](../../../../../src-ts/runtime-executables/www/app.ts#L9085) | – | Array.isArray, JSON.parse, String, _nwAiAdvisorStateValue, arr.filter |
| [`updateAiAdvisorLiveUi`](../../../../../src-ts/runtime-executables/www/app.ts#L9100) | – | String, _nwAiAdvisorBool, _nwAiAdvisorCategoryLabel, _nwAiAdvisorParseSuggestions, _nwAiAdvisorPriorityLabel, _nwAiAdvisorStateValue, badgeEl.setAttribute, card.classList.toggle, document.createElement, document.getElementById, item.appendChild, listEl.appendChild, suggestions.slice, toggleBtn.addEventListener (weitere in der Quelle) |
| [`openSettings`](../../../../../src-ts/runtime-executables/www/app.ts#L9222) | – | bindToggleButtonGroups, document.getElementById, document.querySelector, initSettingsPanel, sbtn.click, sec.classList.remove, setupSettings |
| [`qs`](../../../../../src-ts/runtime-executables/www/app.ts#L9261) | id | document.getElementById |
| [`apiSet`](../../../../../src-ts/runtime-executables/www/app.ts#L9296) | scope, key, value | JSON.stringify, fetch, r.text |
| [`renderModeWriteStatus`](../../../../../src-ts/runtime-executables/www/app.ts#L9358) | – | buttons.insertAdjacentElement, buttons.querySelectorAll, buttons.setAttribute, document.createElement, modeStatus.insertAdjacentElement, modeStatus.setAttribute |
| [`observeConfirmedMode`](../../../../../src-ts/runtime-executables/www/app.ts#L9384) | key, entry | Array.isArray, Number.isFinite, Number.isInteger, legacyNumToMode, normalizeEmsMode, raw.trim |
| [`modeEntry`](../../../../../src-ts/runtime-executables/www/app.ts#L9401) | snapshot, key | Array.isArray |
| [`fetchModeJson`](../../../../../src-ts/runtime-executables/www/app.ts#L9410) | url, options | clearTimeout, fetch, response.headers.get, response.json, setTimeout |
| [`modeRequestFailed`](../../../../../src-ts/runtime-executables/www/app.ts#L9430) | error, readback | – |
| [`touchGoalEdit`](../../../../../src-ts/runtime-executables/www/app.ts#L9451) | ms | Date.now |
| [`goalEditLocked`](../../../../../src-ts/runtime-executables/www/app.ts#L9461) | – | Date.now |
| [`bindGoalLock`](../../../../../src-ts/runtime-executables/www/app.ts#L9470) | el, ms | el.addEventListener |
| [`bump`](../../../../../src-ts/runtime-executables/www/app.ts#L9478) | – | touchGoalEdit |
| [`clampUiMode`](../../../../../src-ts/runtime-executables/www/app.ts#L9496) | v | Math.max, Math.min, Math.round, Number, isFinite |
| [`normalizeEmsMode`](../../../../../src-ts/runtime-executables/www/app.ts#L9507) | raw | String |
| [`normalizeEvcsPhaseMode`](../../../../../src-ts/runtime-executables/www/app.ts#L9518) | raw | String, s.replace |
| [`phaseModeLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L9527) | mode | normalizeEvcsPhaseMode |
| [`evcsConfigRow`](../../../../../src-ts/runtime-executables/www/app.ts#L9542) | index | Array.isArray, Math.max, Math.round, Number |
| [`evcsPhaseSwitchDpAssigned`](../../../../../src-ts/runtime-executables/www/app.ts#L9553) | index | String, evcsConfigRow |
| [`evcsStorageAssistCustomerAllowed`](../../../../../src-ts/runtime-executables/www/app.ts#L9558) | index | evcsConfigRow |
| [`applyStorageAssistUi`](../../../../../src-ts/runtime-executables/www/app.ts#L9563) | enabled | btns.forEach, storageAssistButtons.querySelectorAll |
| [`evcsConfiguredPhaseMode`](../../../../../src-ts/runtime-executables/www/app.ts#L9574) | index, fallbackPhases | Number, String, evcsConfigRow, normalizeEvcsPhaseMode |
| [`applyPhaseModeUi`](../../../../../src-ts/runtime-executables/www/app.ts#L9581) | mode | btns.forEach, normalizeEvcsPhaseMode, phaseButtons.querySelectorAll |
| [`legacyNumToMode`](../../../../../src-ts/runtime-executables/www/app.ts#L9593) | n | clampUiMode |
| [`nextTsFromTimeInput`](../../../../../src-ts/runtime-executables/www/app.ts#L9605) | hhmm | Number, String, d.getDate, d.getTime, d.setDate, d.setHours, isFinite, now.getTime, s.split, snapHhmmTo15Min |
| [`snapHhmmTo15Min`](../../../../../src-ts/runtime-executables/www/app.ts#L9629) | hhmm | Math.floor, Math.max, Math.min, Math.round, Number, String, isFinite, s.split |
| [`clockValueFromTs`](../../../../../src-ts/runtime-executables/www/app.ts#L9650) | ts | Number, Number.isFinite, String, dt.getHours, dt.getMinutes |
| [`modeToLegacyNum`](../../../../../src-ts/runtime-executables/www/app.ts#L9668) | mode | normalizeEmsMode |
| [`ensureAutoVisibility`](../../../../../src-ts/runtime-executables/www/app.ts#L9680) | – | autoBtn.classList.toggle, buttons.querySelector |
| [`applyModeUi`](../../../../../src-ts/runtime-executables/www/app.ts#L9691) | mode | btns.forEach, buttons.querySelectorAll, normalizeEmsMode |
| [`fmtP`](../../../../../src-ts/runtime-executables/www/app.ts#L9964) | val | Math.abs, Number, n.toFixed |
| [`nwHeatingRodNightStatus`](../../../../../src-ts/runtime-executables/www/app.ts#L10248) | ctl | Number, String, status.replace |
| [`openFlowQc`](../../../../../src-ts/runtime-executables/www/app.ts#L10276) | kind, idx | window.__nwFlowQcOpen |
| [`resetGaugeSmoothing`](../../../../../src-ts/runtime-executables/www/app.ts#L10337) | – | – |
| [`smoothGaugePower`](../../../../../src-ts/runtime-executables/www/app.ts#L10350) | valueW, maxW, opts | Math.abs, Math.max, Math.round, Number |
| [`showMsg`](../../../../../src-ts/runtime-executables/www/app.ts#L10384) | t, kind | – |
| [`modeLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L10395) | m | String, s.toLowerCase |
| [`getSlotMeta`](../../../../../src-ts/runtime-executables/www/app.ts#L10414) | k, i | Number, arr.find |
| [`getEntry`](../../../../../src-ts/runtime-executables/www/app.ts#L10426) | k, i | Number, arr.find |
| [`readStateNumber`](../../../../../src-ts/runtime-executables/www/app.ts#L10438) | key, fallback | Number, Number.isFinite |
| [`getHeatingRodDeviceCfg`](../../../../../src-ts/runtime-executables/www/app.ts#L10455) | idx | Array.isArray, Math.round, Number, devices.find |
| [`setFlowGaugeFill`](../../../../../src-ts/runtime-executables/www/app.ts#L10470) | valueW, maxW | Math.abs, Math.max, Math.min, Number, formatPower |
| [`resolveFlowPower`](../../../../../src-ts/runtime-executables/www/app.ts#L10490) | readbackData | Math.abs, Math.max, Number, Number.isFinite, String, getEntry, getHeatingRodDeviceCfg, getSlotMeta, readStateNumber |
| [`updatePower`](../../../../../src-ts/runtime-executables/www/app.ts#L10529) | readbackData | Math.abs, Number, String, formatPower, formatPowerSigned, resolveFlowPower, setFlowGaugeFill, smoothGaugePower |
| [`renderModeButtons`](../../../../../src-ts/runtime-executables/www/app.ts#L10547) | modes, activeMode | Array.isArray, list.forEach |
| [`readback`](../../../../../src-ts/runtime-executables/www/app.ts#L10569) | – | Array.isArray, Date.now, Math.ceil, Math.max, Number, Number.isFinite, String, fetch, formatPower, modeLabel, nwHeatingRodNightStatus, qp.toString, r.json, renderModeButtons (weitere in der Quelle) |
| [`setSwitch`](../../../../../src-ts/runtime-executables/www/app.ts#L10702) | v | JSON.stringify, fetch, setTimeout, showMsg |
| [`setSetpoint`](../../../../../src-ts/runtime-executables/www/app.ts#L10726) | v | JSON.stringify, Number, Number.isFinite, fetch, setTimeout, showMsg |
| [`setRegEnabled`](../../../../../src-ts/runtime-executables/www/app.ts#L10752) | enable | JSON.stringify, fetch, setTimeout, showMsg |
| [`setMode`](../../../../../src-ts/runtime-executables/www/app.ts#L10777) | mode | JSON.stringify, String, fetch, setTimeout, showMsg |
| [`setBoost`](../../../../../src-ts/runtime-executables/www/app.ts#L10804) | enable | JSON.stringify, fetch, setTimeout, showMsg |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L10829) | kind, idx | Number, String, clearInterval, getSlotMeta, isFinite, modal.classList.remove, readback, renderModeButtons, resetGaugeSmoothing, setInterval, showMsg, updatePower, window.nwSyncToggleButtons |
| [`close`](../../../../../src-ts/runtime-executables/www/app.ts#L10924) | – | clearInterval, modal.classList.add, resetGaugeSmoothing, showMsg |
