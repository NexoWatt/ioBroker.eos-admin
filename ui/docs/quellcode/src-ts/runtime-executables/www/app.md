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
| [`refreshLiveMeasurementAge`](../../../../../src-ts/runtime-executables/www/app.ts#L520) | – | document.getElementById, scheduleLiveTelemetryRender |
| [`formatPower`](../../../../../src-ts/runtime-executables/www/app.ts#L535) | v | Number, isNaN, n.toFixed, nxTryTsDashboardFormat |
| [`formatEnergyKwh`](../../../../../src-ts/runtime-executables/www/app.ts#L554) | v | Math.abs, Number, isFinite, isNaN, n.toFixed, nxTryTsDashboardFormat |
| [`formatCurrencyEur`](../../../../../src-ts/runtime-executables/www/app.ts#L566) | v | Number, isFinite, isNaN, n.toFixed |
| [`formatPowerSigned`](../../../../../src-ts/runtime-executables/www/app.ts#L578) | v | Math.abs, Number, abs.toFixed, isNaN, nxTryTsDashboardFormat |
| [`formatFlowPower`](../../../../../src-ts/runtime-executables/www/app.ts#L594) | v, decimals | Number, isNaN, nxTryTsDashboardFormat |
| [`formatNum`](../../../../../src-ts/runtime-executables/www/app.ts#L609) | v, suffix | Number, isNaN, n.toFixed |
| [`formatNum`](../../../../../src-ts/runtime-executables/www/app.ts#L625) | v, suffix | Number, isNaN |
| [`formatPricePerKwh`](../../../../../src-ts/runtime-executables/www/app.ts#L636) | v | window.NexoWattTariffDisplay.format |
| [`nwParsePriceCurve`](../../../../../src-ts/runtime-executables/www/app.ts#L654) | raw | window.NexoWattTariffDisplay.parseCurve |
| [`nwNiceStep`](../../../../../src-ts/runtime-executables/www/app.ts#L664) | range, targetTicks | Math.floor, Math.log10, Math.max, Math.pow, Number |
| [`nwClamp`](../../../../../src-ts/runtime-executables/www/app.ts#L682) | v, lo, hi | Math.max, Math.min, Number, Number.isFinite |
| [`nwQuantile`](../../../../../src-ts/runtime-executables/www/app.ts#L693) | arr, q | Array.isArray, Math.floor, Math.max, Math.min, Number |
| [`nwMedian`](../../../../../src-ts/runtime-executables/www/app.ts#L711) | arr | nwQuantile |
| [`nwResolveTariffThresholds`](../../../../../src-ts/runtime-executables/www/app.ts#L720) | pricesEur, cheapCandidate, expensiveCandidate | Array.isArray, Math.max, Math.min, Number, Number.isFinite, isValid, nwQuantile |
| [`isValid`](../../../../../src-ts/runtime-executables/www/app.ts#L740) | v | Number.isFinite |
| [`nwAggregateCurve`](../../../../../src-ts/runtime-executables/www/app.ts#L771) | curve, dayStartMs, dayEndMs, targetIntervalMs | Array.isArray, Math.max, Math.min, Number, Number.isFinite, out.push |
| [`nwFormatCt`](../../../../../src-ts/runtime-executables/www/app.ts#L821) | vEurKwh | Number, isNaN |
| [`nwTariffColorForPrice`](../../../../../src-ts/runtime-executables/www/app.ts#L831) | priceEurKwh, cheapThr, expensiveThr | Number, Number.isFinite |
| [`nwDrawTariffForecastChart`](../../../../../src-ts/runtime-executables/www/app.ts#L846) | canvas, curve, opts | Array.isArray, Date.now, Math.abs, Math.ceil, Math.floor, Math.max, Math.min, Math.round, Number, Number.isFinite, String, canvas.getContext, ctx.beginPath, ctx.clearRect (weitere in der Quelle) |
| [`xOf`](../../../../../src-ts/runtime-executables/www/app.ts#L926) | tMs | nwClamp |
| [`yOf`](../../../../../src-ts/runtime-executables/www/app.ts#L936) | pCt | nwClamp |
| [`initTariffForecastTooltip`](../../../../../src-ts/runtime-executables/www/app.ts#L1022) | – | btn.addEventListener, card.addEventListener, document.addEventListener, document.body.appendChild, document.createElement, document.getElementById, tip.addEventListener, tip.querySelector, tip.setAttribute, window.addEventListener |
| [`v`](../../../../../src-ts/runtime-executables/www/app.ts#L1071) | k | – |
| [`tsOf`](../../../../../src-ts/runtime-executables/www/app.ts#L1081) | k | Number |
| [`getTodayRange`](../../../../../src-ts/runtime-executables/www/app.ts#L1091) | – | Date.now, window.NexoWattTariffDisplay.dayRange |
| [`update`](../../../../../src-ts/runtime-executables/www/app.ts#L1100) | – | Array.isArray, Date.now, Math.max, Math.min, Number, Number.isFinite, _fmtTimeHHmm, curveToday.map, getTodayRange, nwDrawTariffForecastChart, nwFormatCt, nwParsePriceCurve, nwResolveTariffThresholds, ps.reduce (weitere in der Quelle) |
| [`place`](../../../../../src-ts/runtime-executables/www/app.ts#L1168) | – | Math.round, anchor.getBoundingClientRect, nwClamp, tip.classList.add, tip.classList.contains, tip.classList.remove, tip.getBoundingClientRect |
| [`show`](../../../../../src-ts/runtime-executables/www/app.ts#L1211) | anchor | clearInterval, place, requestAnimationFrame, setInterval, tip.classList.add, update |
| [`hide`](../../../../../src-ts/runtime-executables/www/app.ts#L1230) | – | clearInterval, clearTimeout, tip.classList.remove |
| [`toggle`](../../../../../src-ts/runtime-executables/www/app.ts#L1242) | anchor | hide, show |
| [`_fmtTempC`](../../../../../src-ts/runtime-executables/www/app.ts#L1337) | v | Number, isNaN |
| [`_fmtPct`](../../../../../src-ts/runtime-executables/www/app.ts#L1347) | v | Number, isNaN |
| [`_fmtKmh`](../../../../../src-ts/runtime-executables/www/app.ts#L1357) | v | Number, isNaN |
| [`_fmtNumLocal`](../../../../../src-ts/runtime-executables/www/app.ts#L1367) | v, digits | Number, isNaN, n.toFixed, n.toLocaleString, nwUiLocaleTag |
| [`_fmtTimeHHmm`](../../../../../src-ts/runtime-executables/www/app.ts#L1383) | ts | Number, String, d.getHours, d.getMinutes, isNaN |
| [`_pickWeatherIcon`](../../../../../src-ts/runtime-executables/www/app.ts#L1396) | code, text | Number, String, isNaN, t.includes |
| [`setWidth`](../../../../../src-ts/runtime-executables/www/app.ts#L1427) | id, pct | Math.max, Math.min, document.getElementById |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L1438) | id, text | document.getElementById |
| [`nwSetDisplay`](../../../../../src-ts/runtime-executables/www/app.ts#L1449) | id, visible, displayValue | document.getElementById |
| [`nwSetElementVisible`](../../../../../src-ts/runtime-executables/www/app.ts#L1460) | el, visible, displayValue | el.classList.toggle |
| [`nwAsBool`](../../../../../src-ts/runtime-executables/www/app.ts#L1471) | v, def | String |
| [`nwFeatureMappedRow`](../../../../../src-ts/runtime-executables/www/app.ts#L1486) | row | fields.some |
| [`nwConfiguredEvcsRows`](../../../../../src-ts/runtime-executables/www/app.ts#L1499) | inputCfg | Array.isArray, list.filter |
| [`nwEvcsFeatureFromConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L1517) | inputCfg | Number, Number.isFinite, nwConfiguredEvcsRows |
| [`nwEvcsCountFromConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L1537) | inputCfg | Math.max, Math.round, Number, Number.isFinite |
| [`nwOptionalFeatureFromConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L1553) | inputCfg, key, fallback | – |
| [`nwSmartHomeFeatureFromConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L1561) | inputCfg | nwOptionalFeatureFromConfig |
| [`nwStorageFarmAppCenterActiveFromConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L1565) | inputCfg | – |
| [`nwStorageFarmHasRealRowsFromConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L1579) | inputCfg | Array.isArray, rows.filter |
| [`nwStorageFarmFeatureFromConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L1598) | inputCfg, stateSnapshot | Number, Number.isFinite, nwAsBool, nwStorageFarmAppCenterActiveFromConfig, nwStorageFarmHasRealRowsFromConfig |
| [`nwTsFeatureVisibilityShadowEnabled`](../../../../../src-ts/runtime-executables/www/app.ts#L1644) | – | String, qs.get, window.localStorage.getItem |
| [`nwBuildTsFeatureVisibilityInput`](../../../../../src-ts/runtime-executables/www/app.ts#L1669) | inputCfg, stateSnapshot | Array.isArray, String, nwAsBool, nwConfiguredEvcsRows, nwSmartHomeFeatureFromConfig, nwStorageFarmFeatureFromConfig, rows.map, storageFarmStorages.map |
| [`nwRunTsFeatureVisibilityShadowCheck`](../../../../../src-ts/runtime-executables/www/app.ts#L1723) | inputCfg, stateSnapshot, legacyVisibility | console.debug, console.warn, import, keys.filter, mod.buildCustomerFeatureVisibility, nwBuildTsFeatureVisibilityInput, nwTsFeatureVisibilityShadowEnabled |
| [`nwApplyCustomerFeatureVisibility`](../../../../../src-ts/runtime-executables/www/app.ts#L1749) | inputCfg, stateSnapshot | document.getElementById, evSide.closest, evcsCard.classList.toggle, menuEvcsLink.classList.toggle, menuStorageFarmLink.classList.toggle, nwEvcsCountFromConfig, nwEvcsFeatureFromConfig, nwRunTsFeatureVisibilityShadowCheck, nwSetElementVisible, nwSmartHomeFeatureFromConfig, nwStorageFarmFeatureFromConfig, tabEvcs.classList.toggle, tabStorageFarm.classList.toggle, tile.querySelector |
| [`nwFormatDashboardTimestamp`](../../../../../src-ts/runtime-executables/www/app.ts#L1807) | ts | Number, Number.isFinite, String, d.getDate, d.getFullYear, d.getHours, d.getMinutes, d.getMonth, d.getSeconds |
| [`nwLatestStateTimestamp`](../../../../../src-ts/runtime-executables/www/app.ts#L1825) | keys | Array.isArray, Date.now, Object.keys, keys.forEach |
| [`scanKey`](../../../../../src-ts/runtime-executables/www/app.ts#L1834) | k | Number, Number.isFinite |
| [`nwSetLiveOnline`](../../../../../src-ts/runtime-executables/www/app.ts#L1856) | isOnline | document.getElementById, dot.classList.toggle, setText, updateEmsControlUi |
| [`getEvcsPowerW`](../../../../../src-ts/runtime-executables/www/app.ts#L1877) | readValue | d, mapped.trim, window.NexoWattPowerMeasurements?.resolveEvcsPower |
| [`updateDashboardShellUi`](../../../../../src-ts/runtime-executables/www/app.ts#L1889) | data | Date.now, Math.abs, Math.max, Math.round, Number, Number.isFinite, String, d, document.getElementById, formatFlowPower, getEvcsPowerW, getFreshFlowNumber, getLiveMeasurementView, liveDot.classList.contains (weitere in der Quelle) |
| [`_svgEl`](../../../../../src-ts/runtime-executables/www/app.ts#L1943) | tag, attrs | Object.entries, String, document.createElementNS, el.setAttribute |
| [`initEnergyWebExtras`](../../../../../src-ts/runtime-executables/www/app.ts#L1959) | flowSlots | Array.isArray, Math.max, Math.min, Number.isFinite, Object.assign, String, bhkwAll.filter, consumersAll.filter, document.getElementById, genAll.filter, nwEvcsFeatureFromConfig, parts.every, placeConsumersRightArc, placeProducersLeftArc (weitere in der Quelle) |
| [`placeItem`](../../../../../src-ts/runtime-executables/www/app.ts#L2060) | item, x, y, kind, idx, rNode | Math.max, Number, String, _svgEl, flowExtras.consumers.push, flowExtras.producers.push, formatFlowPower, g.addEventListener, g.appendChild, g.classList.add, g.setAttribute, gLines.appendChild, gNodes.appendChild, icoText.appendChild (weitere in der Quelle) |
| [`_readTranslate`](../../../../../src-ts/runtime-executables/www/app.ts#L2181) | id, fallback | Number, Number.isFinite, document.getElementById, el.getAttribute, tr.match |
| [`placeSpecialProducer`](../../../../../src-ts/runtime-executables/www/app.ts#L2208) | item, x, y, role, rNode | Array.isArray, Math.max, String, _svgEl, flowExtras.special.push, formatFlowPower, g.appendChild, g.setAttribute, gLines.appendChild, gNodes.appendChild, icoText.appendChild, rawLabel.slice |
| [`placeSpecialLowerLeftArc`](../../../../../src-ts/runtime-executables/www/app.ts#L2283) | items | Array.isArray, Math.cos, Math.max, Math.min, Math.sin, Number.isFinite, items.filter, placeSpecialProducer |
| [`clampFlowPoint`](../../../../../src-ts/runtime-executables/www/app.ts#L2373) | pt | Math.max, Math.min |
| [`sampleAngles`](../../../../../src-ts/runtime-executables/www/app.ts#L2383) | startDeg, endDeg, count | Array.from, Math.round |
| [`buildConsumerAngles`](../../../../../src-ts/runtime-executables/www/app.ts#L2402) | count | Math.ceil, sampleAngles, upper.concat |
| [`nudgeAway`](../../../../../src-ts/runtime-executables/www/app.ts#L2433) | pt, blocker, minDist | Math.hypot, Number.isFinite |
| [`resolveExtraNodePoint`](../../../../../src-ts/runtime-executables/www/app.ts#L2461) | kind, x, y, rNode, placed | Array.isArray, clampFlowPoint, fixedBlockers.concat, fixedBlockers.push, nudgeAway |
| [`placeConsumersRightArc`](../../../../../src-ts/runtime-executables/www/app.ts#L2503) | items | Math.cos, Math.min, Math.sin, buildConsumerAngles, placeItem, placed.push, resolveExtraNodePoint |
| [`placeProducersLeftArc`](../../../../../src-ts/runtime-executables/www/app.ts#L2534) | items | Math.cos, Math.sin, placeItem |
| [`isHeatingRodFlowItem`](../../../../../src-ts/runtime-executables/www/app.ts#L2605) | it | String |
| [`resolveHeatingRodFlowPower`](../../../../../src-ts/runtime-executables/www/app.ts#L2618) | it, d, fallbackRaw | Math.abs, Math.max, Math.round, Number, Number.isFinite, readN |
| [`readN`](../../../../../src-ts/runtime-executables/www/app.ts#L2626) | key | Number, Number.isFinite, d |
| [`updateEnergyWebExtras`](../../../../../src-ts/runtime-executables/www/app.ts#L2655) | d | Array.isArray, Math.abs, Number, Number.isFinite, coerceNumber, d, formatFlowPower, isHeatingRodFlowItem, resolveHeatingRodFlowPower, setNodeActive, setRev, setText, show, stabilizeFlowAbs (weitere in der Quelle) |
| [`show`](../../../../../src-ts/runtime-executables/www/app.ts#L2664) | id, abs | Math.max, Math.min, Number, String, document.getElementById |
| [`setRev`](../../../../../src-ts/runtime-executables/www/app.ts#L2684) | id, rev | document.getElementById, el.classList.toggle |
| [`setNodeActive`](../../../../../src-ts/runtime-executables/www/app.ts#L2695) | nodeId, active | document.getElementById |
| [`sumSpecialPower`](../../../../../src-ts/runtime-executables/www/app.ts#L2730) | role, devices | Array.isArray, Number, String, coerceNumber, d |
| [`setRingSegment`](../../../../../src-ts/runtime-executables/www/app.ts#L2799) | cls, pct | Math.max, Math.min, document.querySelector, el.setAttribute |
| [`computeDerived`](../../../../../src-ts/runtime-executables/www/app.ts#L2815) | – | Math.max, Math.min, getLiveMeasurementView |
| [`coerceNumber`](../../../../../src-ts/runtime-executables/www/app.ts#L2832) | v | Number.isFinite, String, parseFloat, s.replace |
| [`clamp01`](../../../../../src-ts/runtime-executables/www/app.ts#L2848) | v, lo, hi | Math.max, Math.min, Number.isFinite |
| [`isMappedDatapoint`](../../../../../src-ts/runtime-executables/www/app.ts#L2858) | key | Object.prototype.hasOwnProperty.call, String |
| [`getGridImportExport`](../../../../../src-ts/runtime-executables/www/app.ts#L2878) | read | Math.max, coerceNumber, getter, isMappedDatapoint |
| [`getStateAgeMs`](../../../../../src-ts/runtime-executables/www/app.ts#L2914) | key | Date.now, Math.max, Number, Number.isFinite |
| [`getFlowFreshMaxAgeMs`](../../../../../src-ts/runtime-executables/www/app.ts#L2930) | – | Math.max, Math.round, coerceNumber |
| [`getFreshFlowNumber`](../../../../../src-ts/runtime-executables/www/app.ts#L2946) | key, opts | Date.now, getFlowFreshMaxAgeMs, isMappedDatapoint, window.NexoWattLiveDisplay?.read |
| [`getStableFlowNumber`](../../../../../src-ts/runtime-executables/www/app.ts#L2956) | key, opts | getFreshFlowNumber |
| [`getConfiguredDatapointId`](../../../../../src-ts/runtime-executables/www/app.ts#L2967) | key | String |
| [`getBalanceDerivedBatteryFlow`](../../../../../src-ts/runtime-executables/www/app.ts#L2982) | opts | Math.abs, Math.max, Math.round, Number, Number.isFinite, coerceNumber, getFlowFreshMaxAgeMs, getGridImportExport, getStateAgeMs, isMappedDatapoint, nwStorageFarmFeatureFromConfig, read |
| [`read`](../../../../../src-ts/runtime-executables/www/app.ts#L2992) | k | getFreshFlowNumber |
| [`preferBalanceDerivedBatteryFlow`](../../../../../src-ts/runtime-executables/www/app.ts#L3051) | current, opts | Math.max, Number, Number.isFinite, Object.assign, String, getBalanceDerivedBatteryFlow |
| [`getNormalizedBatteryFlow`](../../../../../src-ts/runtime-executables/www/app.ts#L3075) | – | Math.abs, Math.max, Number, Number.isFinite, fromSigned, getBalanceDerivedBatteryFlow, getConfiguredDatapointId, getStableFlowNumber, nwStorageFarmFeatureFromConfig |
| [`fromSigned`](../../../../../src-ts/runtime-executables/www/app.ts#L3099) | raw, src | Math.abs, Number, Number.isFinite |
| [`getCanonicalPvPowerW`](../../../../../src-ts/runtime-executables/www/app.ts#L3185) | readValue | Math.abs, Math.max, Number, coerceNumber, d, nwStorageFarmFeatureFromConfig |
| [`getLiveMeasurementView`](../../../../../src-ts/runtime-executables/www/app.ts#L3213) | – | Date.now, String, fresh, getCanonicalPvPowerW, getFlowFreshMaxAgeMs, getGridImportExport, getNormalizedBatteryFlow, getStateAgeMs, nwStorageFarmFeatureFromConfig, window.NexoWattLiveDisplay?.farm |
| [`fresh`](../../../../../src-ts/runtime-executables/www/app.ts#L3214) | key | getFreshFlowNumber |
| [`render`](../../../../../src-ts/runtime-executables/www/app.ts#L3239) | – | Math.max, Math.round, Number, String, _fmtKmh, _fmtNumLocal, _fmtPct, _fmtTempC, _fmtTimeHHmm, _pickWeatherIcon, autarkyN.toFixed, clamp01, co2FromPvT.toFixed, coerceNumber (weitere in der Quelle) |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L3247) | k | – |
| [`pct`](../../../../../src-ts/runtime-executables/www/app.ts#L3267) | v | Math.abs |
| [`bootstrap`](../../../../../src-ts/runtime-executables/www/app.ts#L3481) | – | Date.now, Object.keys, String, applyFlowCoreLabels, bindToggleButtonGroups, cfgRes.json, console.warn, document.documentElement.setAttribute, document.getElementById, fetch, initBhkwModal, initEnergyWebExtras, initGeneratorModal, initRelayModal (weitere in der Quelle) |
| [`applyConfigSnapshot`](../../../../../src-ts/runtime-executables/www/app.ts#L3567) | nextCfg | Math.max, Math.round, Number, Number.isFinite, applyFlowCoreLabels, console.warn, document.getElementById, initEnergyWebExtras, menuEvcsLink.classList.toggle, menuSmartHomeLink.classList.toggle, menuStorageFarmLink.classList.toggle, nwApplyCustomerFeatureVisibility, nwEvcsFeatureFromConfig, nwSmartHomeFeatureFromConfig (weitere in der Quelle) |
| [`refreshConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L3644) | – | applyConfigSnapshot, console.warn, fetch, refreshConfig, scheduleRender |
| [`startEvents`](../../../../../src-ts/runtime-executables/www/app.ts#L3699) | – | console.warn, document.getElementById, dot.classList.remove, setTimeout, window.NW_RUNTIME?.url |
| [`initMenu`](../../../../../src-ts/runtime-executables/www/app.ts#L3741) | – | btn.addEventListener, document.addEventListener, document.getElementById, menu.addEventListener, settingsBtn.addEventListener |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L3762) | – | menu.classList.toggle |
| [`close`](../../../../../src-ts/runtime-executables/www/app.ts#L3769) | – | menu.classList.add |
| [`initSettingsPanel`](../../../../../src-ts/runtime-executables/www/app.ts#L3808) | – | JSON.parse, String, applySoc, document.getElementById, dynToggle.addEventListener, elRef.addEventListener, elSoc.addEventListener, energyWalletToggle.addEventListener, localStorage.getItem, netFeeModelSel.addEventListener, netFeeTabs.querySelectorAll, netFeeToggle.addEventListener, normalizePriorityValue, notifyTestBtn.addEventListener (weitere in der Quelle) |
| [`updatePriorityLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L3838) | – | Number |
| [`updateTariffModeLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L3849) | – | Number |
| [`updateDynVisibility`](../../../../../src-ts/runtime-executables/www/app.ts#L3866) | – | syncToggleButtonsForInputId |
| [`updateEnergyWalletSettingsVisibility`](../../../../../src-ts/runtime-executables/www/app.ts#L3874) | – | syncToggleButtonsForInputId |
| [`normalizePriorityValue`](../../../../../src-ts/runtime-executables/www/app.ts#L3895) | – | Number, Number.isFinite, String |
| [`snapPriority`](../../../../../src-ts/runtime-executables/www/app.ts#L3922) | – | Number, Number.isFinite, String, updatePriorityLabel |
| [`snapTariffMode`](../../../../../src-ts/runtime-executables/www/app.ts#L3944) | – | Number, Number.isFinite, String, updateTariffModeLabel |
| [`setDynSubTab`](../../../../../src-ts/runtime-executables/www/app.ts#L3979) | tab | netFeeTabs.querySelectorAll |
| [`updateNetFeeUi`](../../../../../src-ts/runtime-executables/www/app.ts#L3998) | opts | String, setDynSubTab, syncToggleButtonsForInputId |
| [`updatePvSeasonUi`](../../../../../src-ts/runtime-executables/www/app.ts#L4053) | – | pvSeasonAiToggle.dispatchEvent, syncToggleButtonsForInputId |
| [`_nwBool`](../../../../../src-ts/runtime-executables/www/app.ts#L4118) | v | String |
| [`updateWeatherVisibility`](../../../../../src-ts/runtime-executables/www/app.ts#L4129) | – | _nwBool, syncToggleButtonsForInputId |
| [`updateWeatherModeUi`](../../../../../src-ts/runtime-executables/www/app.ts#L4154) | – | String, weatherBtns.querySelectorAll |
| [`applySoc`](../../../../../src-ts/runtime-executables/www/app.ts#L4332) | – | document.getElementById |
| [`applyInitialTabFromUrl`](../../../../../src-ts/runtime-executables/www/app.ts#L4363) | – | String, params.get, tryActivate, window.NW_RUNTIME?.url, window.location.replace |
| [`tryActivate`](../../../../../src-ts/runtime-executables/www/app.ts#L4388) | – | btn.classList.contains, btn.click, document.querySelector, setTimeout |
| [`_nwCssEscapeIdent`](../../../../../src-ts/runtime-executables/www/app.ts#L4408) | s | CSS.escape, String |
| [`syncToggleGroup`](../../../../../src-ts/runtime-executables/www/app.ts#L4421) | groupEl, checked | Array.from, btns.forEach, groupEl.querySelectorAll |
| [`syncToggleButtonsForInputId`](../../../../../src-ts/runtime-executables/www/app.ts#L4436) | inputId | _nwCssEscapeIdent, document.getElementById, document.querySelectorAll |
| [`syncAllToggleButtons`](../../../../../src-ts/runtime-executables/www/app.ts#L4449) | – | document.querySelectorAll |
| [`bindToggleButtonGroups`](../../../../../src-ts/runtime-executables/www/app.ts#L4468) | – | document.addEventListener, syncAllToggleButtons |
| [`hideAllPanels`](../../../../../src-ts/runtime-executables/www/app.ts#L4544) | – | document.body.classList.remove, document.querySelector, document.querySelectorAll |
| [`showDashboardTab`](../../../../../src-ts/runtime-executables/www/app.ts#L4556) | tab | String, document.body.classList.toggle, document.querySelector, document.querySelectorAll, window.NW_RUNTIME?.url |
| [`loadConfig`](../../../../../src-ts/runtime-executables/www/app.ts#L4588) | – | console.warn, fetch, r.json |
| [`bindInputValue`](../../../../../src-ts/runtime-executables/www/app.ts#L4602) | el, stateKey | String, el.addEventListener, sk.slice, sk.startsWith, v.trim |
| [`updatePvSurplusSettingsUi`](../../../../../src-ts/runtime-executables/www/app.ts#L4681) | – | String, block.classList.toggle, document.getElementById, row.classList.toggle |
| [`setupPvSurplusSettingsUi`](../../../../../src-ts/runtime-executables/www/app.ts#L4698) | – | document.getElementById, enabled.addEventListener, select.addEventListener, updatePvSurplusSettingsUi |
| [`initSettingsPageTabs`](../../../../../src-ts/runtime-executables/www/app.ts#L4715) | – | Array.from, activatePage, buttons.forEach, document.querySelector, window.addEventListener, wrap.querySelectorAll |
| [`normalizePage`](../../../../../src-ts/runtime-executables/www/app.ts#L4726) | value | String, allowed.includes, buttons.map |
| [`activatePage`](../../../../../src-ts/runtime-executables/www/app.ts#L4745) | value | buttons.forEach, normalizePage, renderSettingsLogPanel, sessionStorage.setItem, wrap.querySelectorAll |
| [`_nwSettingsStateValue`](../../../../../src-ts/runtime-executables/www/app.ts#L4779) | key | – |
| [`_nwSettingsText`](../../../../../src-ts/runtime-executables/www/app.ts#L4789) | value, fallback | String |
| [`_nwSettingsBool`](../../../../../src-ts/runtime-executables/www/app.ts#L4800) | value | String |
| [`_nwSettingsCount`](../../../../../src-ts/runtime-executables/www/app.ts#L4814) | value | Math.round, Number, Number.isFinite, String |
| [`_nwSettingsTs`](../../../../../src-ts/runtime-executables/www/app.ts#L4824) | value | Number, Number.isFinite, nwUiLocaleTag |
| [`_nwSettingsPower`](../../../../../src-ts/runtime-executables/www/app.ts#L4835) | value | Number, Number.isFinite, formatPower |
| [`_nwSettingsDays`](../../../../../src-ts/runtime-executables/www/app.ts#L4845) | value | Math.round, Number, Number.isFinite |
| [`_nwSettingsJson`](../../../../../src-ts/runtime-executables/www/app.ts#L4855) | value | JSON.parse, JSON.stringify, _nwSettingsText |
| [`renderSettingsLogPanel`](../../../../../src-ts/runtime-executables/www/app.ts#L4866) | – | String, _nwSettingsBool, _nwSettingsCount, _nwSettingsDays, _nwSettingsJson, _nwSettingsPower, _nwSettingsStateValue, _nwSettingsText, _nwSettingsTs, document.getElementById, document.querySelector, set |
| [`set`](../../../../../src-ts/runtime-executables/www/app.ts#L4893) | id, value | document.getElementById |
| [`setupSettingsReportButtons`](../../../../../src-ts/runtime-executables/www/app.ts#L4977) | – | btn.addEventListener, document.getElementById |
| [`setupSettings`](../../../../../src-ts/runtime-executables/www/app.ts#L4996) | – | document.querySelectorAll, initSettingsPageTabs, renderSettingsLogPanel, setupPvSurplusSettingsUi, setupRfidBillingUi, setupRfidLearningUi, setupRfidWhitelistUi, setupSettingsReportButtons |
| [`parseJsonSafe`](../../../../../src-ts/runtime-executables/www/app.ts#L5019) | raw, fallback | JSON.parse, JSON.stringify |
| [`storageFarmGetStatusList`](../../../../../src-ts/runtime-executables/www/app.ts#L5032) | – | Array.isArray, parseJsonSafe |
| [`storageFarmUpdateModeLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L5044) | – | String, document.getElementById |
| [`storageFarmUpdateSummary`](../../../../../src-ts/runtime-executables/www/app.ts#L5057) | – | Number, document.getElementById, formatPower |
| [`storageFarmRenderStatusRows`](../../../../../src-ts/runtime-executables/www/app.ts#L5076) | list | Array.isArray, document.getElementById, list.forEach |
| [`mkCell`](../../../../../src-ts/runtime-executables/www/app.ts#L5101) | txt, label | String, d.setAttribute, document.createElement |
| [`storageFarmApply`](../../../../../src-ts/runtime-executables/www/app.ts#L5164) | – | storageFarmGetStatusList, storageFarmRenderStatusRows, storageFarmUpdateModeLabel, storageFarmUpdateSummary |
| [`initStorageFarmPanel`](../../../../../src-ts/runtime-executables/www/app.ts#L5178) | – | btnReload.addEventListener, document.getElementById, storageFarmApply |
| [`loadRfidCustomerState`](../../../../../src-ts/runtime-executables/www/app.ts#L5194) | – | Array.isArray, Date.now, JSON.stringify, Number, Object.assign, String, fetch, response.json |
| [`setupRfidWhitelistUi`](../../../../../src-ts/runtime-executables/www/app.ts#L5219) | – | btnAdd.addEventListener, btnReload.addEventListener, btnSave.addEventListener, document.getElementById, readWhitelistFromState, render |
| [`normRfid`](../../../../../src-ts/runtime-executables/www/app.ts#L5232) | v | String |
| [`safeText`](../../../../../src-ts/runtime-executables/www/app.ts#L5239) | v | String |
| [`readWhitelistFromState`](../../../../../src-ts/runtime-executables/www/app.ts#L5246) | – | Array.isArray, JSON.parse, String, arr.map |
| [`setMsg`](../../../../../src-ts/runtime-executables/www/app.ts#L5272) | t | – |
| [`render`](../../../../../src-ts/runtime-executables/www/app.ts#L5279) | – | setMsg |
| [`save`](../../../../../src-ts/runtime-executables/www/app.ts#L5329) | – | JSON.stringify, cleaned.push, fetch, normRfid, render, safeText, seen.add, seen.has, setMsg |
| [`reload`](../../../../../src-ts/runtime-executables/www/app.ts#L5362) | – | loadRfidCustomerState, readWhitelistFromState, render, setMsg |
| [`setupRfidLearningUi`](../../../../../src-ts/runtime-executables/www/app.ts#L5435) | – | applyUi, btnAdd.addEventListener, btnLearn.addEventListener, document.getElementById, loadRfidCustomerState |
| [`setMsg`](../../../../../src-ts/runtime-executables/www/app.ts#L5449) | t | – |
| [`setLearningActive`](../../../../../src-ts/runtime-executables/www/app.ts#L5456) | active | JSON.stringify, fetch |
| [`readStateVal`](../../../../../src-ts/runtime-executables/www/app.ts#L5473) | key | – |
| [`stopLearningPoll`](../../../../../src-ts/runtime-executables/www/app.ts#L5479) | – | clearTimeout |
| [`pollLearningState`](../../../../../src-ts/runtime-executables/www/app.ts#L5483) | – | Date.now, applyUi, loadRfidCustomerState, readStateVal, setTimeout, stopLearningPoll |
| [`startLearningPoll`](../../../../../src-ts/runtime-executables/www/app.ts#L5492) | – | Date.now, pollLearningState |
| [`applyUi`](../../../../../src-ts/runtime-executables/www/app.ts#L5502) | – | Number, String, nwUiLocaleTag, readStateVal, setMsg |
| [`setupRfidBillingUi`](../../../../../src-ts/runtime-executables/www/app.ts#L5575) | – | String, applyMode, btnOpen.addEventListener, document.getElementById, modeWrap.querySelectorAll, now.getFullYear, now.getMonth, pad2, renderOptions |
| [`pad2`](../../../../../src-ts/runtime-executables/www/app.ts#L5592) | n | Number, String |
| [`setMsg`](../../../../../src-ts/runtime-executables/www/app.ts#L5599) | t | – |
| [`getWhitelist`](../../../../../src-ts/runtime-executables/www/app.ts#L5606) | – | Array.isArray, JSON.parse, window.__nwRfidWhitelist.get |
| [`renderOptions`](../../../../../src-ts/runtime-executables/www/app.ts#L5632) | – | Array.isArray, String, document.createElement, getWhitelist, sel.appendChild |
| [`applyMode`](../../../../../src-ts/runtime-executables/www/app.ts#L5682) | m | modeWrap.querySelectorAll, monthRow.classList.toggle, setMsg, yearRow.classList.toggle |
| [`setupInstaller`](../../../../../src-ts/runtime-executables/www/app.ts#L5769) | – | btn.addEventListener, cancel.addEventListener, document.getElementById, form.addEventListener, refreshLock |
| [`refreshLock`](../../../../../src-ts/runtime-executables/www/app.ts#L5782) | – | fetch, formBox.classList.toggle, formBox.querySelectorAll, loginBox.classList.toggle, r.json |
| [`doLogin`](../../../../../src-ts/runtime-executables/www/app.ts#L5802) | – | JSON.stringify, String, alert, fetch, refreshLock |
| [`initInstallerPanel`](../../../../../src-ts/runtime-executables/www/app.ts#L5846) | – | document.getElementById, document.querySelectorAll, window.NW_RUNTIME?.url |
| [`initTabs`](../../../../../src-ts/runtime-executables/www/app.ts#L5862) | – | buttons.forEach, document.querySelectorAll |
| [`renderSmartHome`](../../../../../src-ts/runtime-executables/www/app.ts#L5881) | – | Number, document.getElementById, get, onTxt |
| [`onTxt`](../../../../../src-ts/runtime-executables/www/app.ts#L5888) | v | – |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L5895) | k | – |
| [`get`](../../../../../src-ts/runtime-executables/www/app.ts#L5902) | path | d |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L5934) | k | – |
| [`pctDeg`](../../../../../src-ts/runtime-executables/www/app.ts#L5959) | val, maxDeg | Math.max, Math.min |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L5978) | id, t | document.getElementById |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L6018) | k | – |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L6041) | id, t | document.getElementById |
| [`pct`](../../../../../src-ts/runtime-executables/www/app.ts#L6079) | v | Math.max, Math.min |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L6110) | k | – |
| [`pctDeg`](../../../../../src-ts/runtime-executables/www/app.ts#L6135) | val, maxDeg | Math.max, Math.min |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L6154) | id, t | document.getElementById |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L6194) | k | – |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L6217) | id, t | document.getElementById |
| [`pct`](../../../../../src-ts/runtime-executables/www/app.ts#L6255) | v | Math.max, Math.min |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L6278) | k | – |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L6287) | id, txt | document.getElementById |
| [`setSideValue`](../../../../../src-ts/runtime-executables/www/app.ts#L6302) | id, val | document.getElementById |
| [`updateEmsControlUi`](../../../../../src-ts/runtime-executables/www/app.ts#L6312) | – | Date.now, Number, Number.isFinite, String, card.classList.toggle, document.getElementById, formatPower, formatPricePerKwh, modal.classList.contains, modeWrap.querySelectorAll, prioWrap.querySelectorAll, setText, v, window.NexoWattTariffDisplay.display (weitere in der Quelle) |
| [`v`](../../../../../src-ts/runtime-executables/www/app.ts#L6327) | k | – |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L6356) | id, txt | document.getElementById |
| [`initEmsControlModal`](../../../../../src-ts/runtime-executables/www/app.ts#L6517) | – | closeBtn.addEventListener, document.getElementById, energyDetailsBtn.addEventListener, modal.addEventListener, modeWrap.querySelectorAll, openBtn.addEventListener, openSettingsBtn.addEventListener, prioWrap.querySelectorAll, tariffToggle.addEventListener |
| [`setSetting`](../../../../../src-ts/runtime-executables/www/app.ts#L6538) | key, value | JSON.stringify, fetch |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L6561) | e | e.preventDefault, modal.classList.remove, updateEmsControlUi |
| [`close`](../../../../../src-ts/runtime-executables/www/app.ts#L6572) | – | modal.classList.add |
| [`initThresholdModal`](../../../../../src-ts/runtime-executables/www/app.ts#L6632) | – | card.addEventListener, closeBtn.addEventListener, document.addEventListener, document.getElementById, modal.addEventListener |
| [`setHint`](../../../../../src-ts/runtime-executables/www/app.ts#L6649) | msg, isError | String |
| [`apiSet`](../../../../../src-ts/runtime-executables/www/app.ts#L6660) | key, value | JSON.stringify, fetch, resp.json, setHint |
| [`renderModal`](../../../../../src-ts/runtime-executables/www/app.ts#L6692) | – | Array.isArray, configured.forEach, document.createElement, listEl.appendChild, setHint |
| [`v`](../../../../../src-ts/runtime-executables/www/app.ts#L6703) | k | – |
| [`mkRow`](../../../../../src-ts/runtime-executables/www/app.ts#L6731) | r | Math.max, Math.min, Math.round, Number, Number.isFinite, String, body.appendChild, box.appendChild, btnWrap.appendChild, ctl.appendChild, document.createElement, head.appendChild, inp.addEventListener, mkBtn (weitere in der Quelle) |
| [`prettyStatus`](../../../../../src-ts/runtime-executables/www/app.ts#L6766) | raw | String |
| [`mkKpi`](../../../../../src-ts/runtime-executables/www/app.ts#L6811) | label, valueText | box.appendChild, document.createElement |
| [`setActive`](../../../../../src-ts/runtime-executables/www/app.ts#L6868) | uiVal | Array.from, btnWrap.querySelectorAll |
| [`mkBtn`](../../../../../src-ts/runtime-executables/www/app.ts#L6887) | label, uiVal, sendMode | String, b.addEventListener, b.classList.add, document.createElement |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L7030) | e | e.preventDefault, modal.classList.remove, renderModal |
| [`close`](../../../../../src-ts/runtime-executables/www/app.ts#L7041) | – | modal.classList.add |
| [`initRelayModal`](../../../../../src-ts/runtime-executables/www/app.ts#L7066) | – | card.addEventListener, closeBtn.addEventListener, document.addEventListener, document.getElementById, modal.addEventListener |
| [`setHint`](../../../../../src-ts/runtime-executables/www/app.ts#L7085) | msg, isError | String |
| [`apiSet`](../../../../../src-ts/runtime-executables/www/app.ts#L7096) | idx, prop, value | JSON.stringify, fetch, resp.json, setHint |
| [`fetchSnapshot`](../../../../../src-ts/runtime-executables/www/app.ts#L7128) | – | fetch, r.json |
| [`renderModal`](../../../../../src-ts/runtime-executables/www/app.ts#L7151) | – | Array.isArray, document.createElement, fetchSnapshot, listEl.appendChild, relays.filter, setHint, shown.forEach |
| [`mkRow`](../../../../../src-ts/runtime-executables/www/app.ts#L7190) | r | Number, Number.isFinite, String, body.appendChild, box.appendChild, btnWrap.appendChild, ctl.appendChild, document.createElement, head.appendChild, inp.addEventListener, mkBtn, mkKpi, row.appendChild |
| [`mkKpi`](../../../../../src-ts/runtime-executables/www/app.ts#L7234) | label, valueText | box.appendChild, document.createElement |
| [`mkBtn`](../../../../../src-ts/runtime-executables/www/app.ts#L7279) | label, val | b.addEventListener, document.createElement |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L7358) | e | clearInterval, e.preventDefault, modal.classList.remove, renderModal, setInterval |
| [`close`](../../../../../src-ts/runtime-executables/www/app.ts#L7381) | – | clearInterval, modal.classList.add |
| [`initBhkwModal`](../../../../../src-ts/runtime-executables/www/app.ts#L7408) | – | card.addEventListener, closeBtn.addEventListener, document.addEventListener, document.getElementById, modal.addEventListener |
| [`setHint`](../../../../../src-ts/runtime-executables/www/app.ts#L7427) | msg, isError | String |
| [`apiSet`](../../../../../src-ts/runtime-executables/www/app.ts#L7438) | idx, prop, value | JSON.stringify, fetch, resp.json, setHint |
| [`fetchSnapshot`](../../../../../src-ts/runtime-executables/www/app.ts#L7470) | – | fetch, r.json |
| [`renderModal`](../../../../../src-ts/runtime-executables/www/app.ts#L7493) | – | Array.isArray, devices.filter, document.createElement, fetchSnapshot, listEl.appendChild, setHint, shown.forEach |
| [`mkKpi`](../../../../../src-ts/runtime-executables/www/app.ts#L7534) | label, valueText | box.appendChild, document.createElement |
| [`mkRow`](../../../../../src-ts/runtime-executables/www/app.ts#L7560) | d | Math.round, Number, Number.isNaN, String, addBtn, body.appendChild, cmdRow.appendChild, ctl.appendChild, document.createElement, head.appendChild, mkKpi, modeBox.appendChild, row.appendChild, startBtn.addEventListener (weitere in der Quelle) |
| [`addBtn`](../../../../../src-ts/runtime-executables/www/app.ts#L7631) | val, label | b.addEventListener, b.classList.toggle, document.createElement, grp.appendChild |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L7707) | e | clearInterval, e.preventDefault, modal.classList.remove, renderModal, setInterval |
| [`close`](../../../../../src-ts/runtime-executables/www/app.ts#L7729) | – | clearInterval, modal.classList.add |
| [`initGeneratorModal`](../../../../../src-ts/runtime-executables/www/app.ts#L7752) | – | card.addEventListener, closeBtn.addEventListener, document.addEventListener, document.getElementById, modal.addEventListener |
| [`setHint`](../../../../../src-ts/runtime-executables/www/app.ts#L7771) | msg, isError | String |
| [`apiSet`](../../../../../src-ts/runtime-executables/www/app.ts#L7782) | idx, prop, value | JSON.stringify, fetch, resp.json, setHint |
| [`fetchSnapshot`](../../../../../src-ts/runtime-executables/www/app.ts#L7814) | – | fetch, r.json |
| [`renderModal`](../../../../../src-ts/runtime-executables/www/app.ts#L7837) | – | Array.isArray, devices.filter, document.createElement, fetchSnapshot, listEl.appendChild, setHint, shown.forEach |
| [`mkKpi`](../../../../../src-ts/runtime-executables/www/app.ts#L7878) | label, valueText | box.appendChild, document.createElement |
| [`mkRow`](../../../../../src-ts/runtime-executables/www/app.ts#L7904) | d | Math.round, Number, Number.isNaN, String, addBtn, body.appendChild, cmdRow.appendChild, ctl.appendChild, document.createElement, head.appendChild, mkKpi, modeBox.appendChild, row.appendChild, startBtn.addEventListener (weitere in der Quelle) |
| [`addBtn`](../../../../../src-ts/runtime-executables/www/app.ts#L7975) | val, label | b.addEventListener, b.classList.toggle, document.createElement, grp.appendChild |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L8051) | e | clearInterval, e.preventDefault, modal.classList.remove, renderModal, setInterval |
| [`close`](../../../../../src-ts/runtime-executables/www/app.ts#L8073) | – | clearInterval, modal.classList.add |
| [`updateRelayUi`](../../../../../src-ts/runtime-executables/www/app.ts#L8096) | – | Array.isArray, String, card.classList.add, card.classList.remove, document.getElementById, relays.filter, setText, visible.filter |
| [`updateThresholdUi`](../../../../../src-ts/runtime-executables/www/app.ts#L8135) | – | Array.isArray, String, card.classList.add, card.classList.remove, configured.filter, document.getElementById, rules.filter, setText |
| [`updateBhkwUi`](../../../../../src-ts/runtime-executables/www/app.ts#L8174) | – | Array.isArray, Number, String, card.classList.add, card.classList.remove, devs.filter, document.getElementById, setText, sv |
| [`sv`](../../../../../src-ts/runtime-executables/www/app.ts#L8217) | k | – |
| [`updateGeneratorUi`](../../../../../src-ts/runtime-executables/www/app.ts#L8237) | – | Array.isArray, Number, String, card.classList.add, card.classList.remove, devs.filter, document.getElementById, setText, sv |
| [`sv`](../../../../../src-ts/runtime-executables/www/app.ts#L8279) | k | – |
| [`_ensureThermalConsumerTiles`](../../../../../src-ts/runtime-executables/www/app.ts#L8304) | – | _thermalConsTiles.set, document.createElement, document.getElementById, grid.appendChild, tile.addEventListener, tile.setAttribute |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L8352) | – | console.warn, openFlowQc |
| [`_labelThermalMode`](../../../../../src-ts/runtime-executables/www/app.ts#L8386) | mode | String, m.toLowerCase |
| [`updateThermalConsumerUi`](../../../../../src-ts/runtime-executables/www/app.ts#L8407) | – | Array.isArray, Math.abs, Math.max, Number, Number.isFinite, String, _ensureThermalConsumerTiles, _labelThermalMode, _thermalConsTiles.get, document.getElementById, formatPower, normalizeConsumerType, sv |
| [`normalizeConsumerType`](../../../../../src-ts/runtime-executables/www/app.ts#L8434) | raw | String |
| [`sv`](../../../../../src-ts/runtime-executables/www/app.ts#L8455) | k | – |
| [`updateEnergyWeb`](../../../../../src-ts/runtime-executables/www/app.ts#L8538) | – | Math.abs, Math.max, Number, Number.isFinite, String, T, document.getElementById, formatFlowPower, formatPower, getEvcsPowerW, getLiveMeasurementView, isNaN, lg.classList.add, lg.classList.remove (weitere in der Quelle) |
| [`d`](../../../../../src-ts/runtime-executables/www/app.ts#L8545) | k | – |
| [`T`](../../../../../src-ts/runtime-executables/www/app.ts#L8653) | id, t | document.getElementById |
| [`show`](../../../../../src-ts/runtime-executables/www/app.ts#L8688) | id, on | document.getElementById |
| [`toggleRev`](../../../../../src-ts/runtime-executables/www/app.ts#L8711) | id, on | document.getElementById, el.classList.toggle |
| [`_nwAiAdvisorStateValue`](../../../../../src-ts/runtime-executables/www/app.ts#L8813) | key, fallback | – |
| [`_nwAiAdvisorBool`](../../../../../src-ts/runtime-executables/www/app.ts#L8828) | key, fallback | String, _nwAiAdvisorStateValue |
| [`_nwAiAdvisorPriorityLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L8843) | p | Number, Number.isFinite, String |
| [`_nwAiAdvisorCategoryLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L8863) | c | String |
| [`_nwEnergyWalletStateValue`](../../../../../src-ts/runtime-executables/www/app.ts#L8889) | key, fallback | Object.prototype.hasOwnProperty.call |
| [`_nwEnergyWalletNum`](../../../../../src-ts/runtime-executables/www/app.ts#L8898) | key, fallback | Number, Number.isFinite, _nwEnergyWalletStateValue |
| [`_nwEnergyWalletMoney`](../../../../../src-ts/runtime-executables/www/app.ts#L8903) | value | Number, Number.isFinite, n.toFixed, n.toLocaleString, nwUiLocaleTag |
| [`_nwEnergyWalletKwh`](../../../../../src-ts/runtime-executables/www/app.ts#L8910) | value | Number, Number.isFinite, n.toFixed, n.toLocaleString, nwUiLocaleTag |
| [`_nwEnergyWalletPricePerKwh`](../../../../../src-ts/runtime-executables/www/app.ts#L8916) | value | Number, Number.isFinite, n.toFixed, n.toLocaleString, nwUiLocaleTag |
| [`_nwEnergyWalletAgeLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L8922) | seconds | Math.max, Math.round, Number |
| [`_nwEnergyWalletEnsureExtendedUi`](../../../../../src-ts/runtime-executables/www/app.ts#L8931) | card | card.appendChild, document.createElement, document.getElementById |
| [`updateEnergyWalletLiveUi`](../../../../../src-ts/runtime-executables/www/app.ts#L8968) | – | Math.round, String, _nwEnergyWalletAgeLabel, _nwEnergyWalletEnsureExtendedUi, _nwEnergyWalletKwh, _nwEnergyWalletMoney, _nwEnergyWalletNum, _nwEnergyWalletPricePerKwh, _nwEnergyWalletStateValue, card.classList.toggle, document.getElementById, eg.classList.toggle, priceEl.classList.toggle, setText (weitere in der Quelle) |
| [`setText`](../../../../../src-ts/runtime-executables/www/app.ts#L8983) | id, text | document.getElementById |
| [`_nwAiAdvisorParseSuggestions`](../../../../../src-ts/runtime-executables/www/app.ts#L9034) | – | Array.isArray, JSON.parse, String, _nwAiAdvisorStateValue, arr.filter |
| [`updateAiAdvisorLiveUi`](../../../../../src-ts/runtime-executables/www/app.ts#L9049) | – | String, _nwAiAdvisorBool, _nwAiAdvisorCategoryLabel, _nwAiAdvisorParseSuggestions, _nwAiAdvisorPriorityLabel, _nwAiAdvisorStateValue, badgeEl.setAttribute, card.classList.toggle, document.createElement, document.getElementById, item.appendChild, listEl.appendChild, suggestions.slice, toggleBtn.addEventListener (weitere in der Quelle) |
| [`openSettings`](../../../../../src-ts/runtime-executables/www/app.ts#L9171) | – | bindToggleButtonGroups, document.getElementById, document.querySelector, initSettingsPanel, sbtn.click, sec.classList.remove, setupSettings |
| [`qs`](../../../../../src-ts/runtime-executables/www/app.ts#L9210) | id | document.getElementById |
| [`apiSet`](../../../../../src-ts/runtime-executables/www/app.ts#L9245) | scope, key, value | JSON.stringify, fetch, r.text |
| [`renderModeWriteStatus`](../../../../../src-ts/runtime-executables/www/app.ts#L9307) | – | buttons.insertAdjacentElement, buttons.querySelectorAll, buttons.setAttribute, document.createElement, modeStatus.insertAdjacentElement, modeStatus.setAttribute |
| [`observeConfirmedMode`](../../../../../src-ts/runtime-executables/www/app.ts#L9333) | key, entry | Array.isArray, Number.isFinite, Number.isInteger, legacyNumToMode, normalizeEmsMode, raw.trim |
| [`modeEntry`](../../../../../src-ts/runtime-executables/www/app.ts#L9350) | snapshot, key | Array.isArray |
| [`fetchModeJson`](../../../../../src-ts/runtime-executables/www/app.ts#L9359) | url, options | clearTimeout, fetch, response.headers.get, response.json, setTimeout |
| [`modeRequestFailed`](../../../../../src-ts/runtime-executables/www/app.ts#L9379) | error, readback | – |
| [`touchGoalEdit`](../../../../../src-ts/runtime-executables/www/app.ts#L9400) | ms | Date.now |
| [`goalEditLocked`](../../../../../src-ts/runtime-executables/www/app.ts#L9410) | – | Date.now |
| [`bindGoalLock`](../../../../../src-ts/runtime-executables/www/app.ts#L9419) | el, ms | el.addEventListener |
| [`bump`](../../../../../src-ts/runtime-executables/www/app.ts#L9427) | – | touchGoalEdit |
| [`clampUiMode`](../../../../../src-ts/runtime-executables/www/app.ts#L9445) | v | Math.max, Math.min, Math.round, Number, isFinite |
| [`normalizeEmsMode`](../../../../../src-ts/runtime-executables/www/app.ts#L9456) | raw | String |
| [`normalizeEvcsPhaseMode`](../../../../../src-ts/runtime-executables/www/app.ts#L9467) | raw | String, s.replace |
| [`phaseModeLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L9476) | mode | normalizeEvcsPhaseMode |
| [`evcsConfigRow`](../../../../../src-ts/runtime-executables/www/app.ts#L9491) | index | Array.isArray, Math.max, Math.round, Number |
| [`evcsPhaseSwitchDpAssigned`](../../../../../src-ts/runtime-executables/www/app.ts#L9502) | index | String, evcsConfigRow |
| [`evcsStorageAssistCustomerAllowed`](../../../../../src-ts/runtime-executables/www/app.ts#L9507) | index | evcsConfigRow |
| [`applyStorageAssistUi`](../../../../../src-ts/runtime-executables/www/app.ts#L9512) | enabled | btns.forEach, storageAssistButtons.querySelectorAll |
| [`evcsConfiguredPhaseMode`](../../../../../src-ts/runtime-executables/www/app.ts#L9523) | index, fallbackPhases | Number, String, evcsConfigRow, normalizeEvcsPhaseMode |
| [`applyPhaseModeUi`](../../../../../src-ts/runtime-executables/www/app.ts#L9530) | mode | btns.forEach, normalizeEvcsPhaseMode, phaseButtons.querySelectorAll |
| [`legacyNumToMode`](../../../../../src-ts/runtime-executables/www/app.ts#L9542) | n | clampUiMode |
| [`nextTsFromTimeInput`](../../../../../src-ts/runtime-executables/www/app.ts#L9554) | hhmm | Number, String, d.getDate, d.getTime, d.setDate, d.setHours, isFinite, now.getTime, s.split, snapHhmmTo15Min |
| [`snapHhmmTo15Min`](../../../../../src-ts/runtime-executables/www/app.ts#L9578) | hhmm | Math.floor, Math.max, Math.min, Math.round, Number, String, isFinite, s.split |
| [`clockValueFromTs`](../../../../../src-ts/runtime-executables/www/app.ts#L9599) | ts | Number, Number.isFinite, String, dt.getHours, dt.getMinutes |
| [`modeToLegacyNum`](../../../../../src-ts/runtime-executables/www/app.ts#L9617) | mode | normalizeEmsMode |
| [`ensureAutoVisibility`](../../../../../src-ts/runtime-executables/www/app.ts#L9629) | – | autoBtn.classList.toggle, buttons.querySelector |
| [`applyModeUi`](../../../../../src-ts/runtime-executables/www/app.ts#L9640) | mode | btns.forEach, buttons.querySelectorAll, normalizeEmsMode |
| [`fmtP`](../../../../../src-ts/runtime-executables/www/app.ts#L9913) | val | Math.abs, Number, n.toFixed |
| [`nwHeatingRodNightStatus`](../../../../../src-ts/runtime-executables/www/app.ts#L10197) | ctl | Number, String, status.replace |
| [`openFlowQc`](../../../../../src-ts/runtime-executables/www/app.ts#L10225) | kind, idx | window.__nwFlowQcOpen |
| [`resetGaugeSmoothing`](../../../../../src-ts/runtime-executables/www/app.ts#L10286) | – | – |
| [`smoothGaugePower`](../../../../../src-ts/runtime-executables/www/app.ts#L10299) | valueW, maxW, opts | Math.abs, Math.max, Math.round, Number |
| [`showMsg`](../../../../../src-ts/runtime-executables/www/app.ts#L10333) | t, kind | – |
| [`modeLabel`](../../../../../src-ts/runtime-executables/www/app.ts#L10344) | m | String, s.toLowerCase |
| [`getSlotMeta`](../../../../../src-ts/runtime-executables/www/app.ts#L10363) | k, i | Number, arr.find |
| [`getEntry`](../../../../../src-ts/runtime-executables/www/app.ts#L10375) | k, i | Number, arr.find |
| [`readStateNumber`](../../../../../src-ts/runtime-executables/www/app.ts#L10387) | key, fallback | Number, Number.isFinite |
| [`getHeatingRodDeviceCfg`](../../../../../src-ts/runtime-executables/www/app.ts#L10404) | idx | Array.isArray, Math.round, Number, devices.find |
| [`setFlowGaugeFill`](../../../../../src-ts/runtime-executables/www/app.ts#L10419) | valueW, maxW | Math.abs, Math.max, Math.min, Number, formatPower |
| [`resolveFlowPower`](../../../../../src-ts/runtime-executables/www/app.ts#L10439) | readbackData | Math.abs, Math.max, Number, Number.isFinite, String, getEntry, getHeatingRodDeviceCfg, getSlotMeta, readStateNumber |
| [`updatePower`](../../../../../src-ts/runtime-executables/www/app.ts#L10478) | readbackData | Math.abs, Number, String, formatPower, formatPowerSigned, resolveFlowPower, setFlowGaugeFill, smoothGaugePower |
| [`renderModeButtons`](../../../../../src-ts/runtime-executables/www/app.ts#L10496) | modes, activeMode | Array.isArray, list.forEach |
| [`readback`](../../../../../src-ts/runtime-executables/www/app.ts#L10518) | – | Array.isArray, Date.now, Math.ceil, Math.max, Number, Number.isFinite, String, fetch, formatPower, modeLabel, nwHeatingRodNightStatus, qp.toString, r.json, renderModeButtons (weitere in der Quelle) |
| [`setSwitch`](../../../../../src-ts/runtime-executables/www/app.ts#L10651) | v | JSON.stringify, fetch, setTimeout, showMsg |
| [`setSetpoint`](../../../../../src-ts/runtime-executables/www/app.ts#L10675) | v | JSON.stringify, Number, Number.isFinite, fetch, setTimeout, showMsg |
| [`setRegEnabled`](../../../../../src-ts/runtime-executables/www/app.ts#L10701) | enable | JSON.stringify, fetch, setTimeout, showMsg |
| [`setMode`](../../../../../src-ts/runtime-executables/www/app.ts#L10726) | mode | JSON.stringify, String, fetch, setTimeout, showMsg |
| [`setBoost`](../../../../../src-ts/runtime-executables/www/app.ts#L10753) | enable | JSON.stringify, fetch, setTimeout, showMsg |
| [`open`](../../../../../src-ts/runtime-executables/www/app.ts#L10778) | kind, idx | Number, String, clearInterval, getSlotMeta, isFinite, modal.classList.remove, readback, renderModeButtons, resetGaugeSmoothing, setInterval, showMsg, updatePower, window.nwSyncToggleButtons |
| [`close`](../../../../../src-ts/runtime-executables/www/app.ts#L10873) | – | clearInterval, modal.classList.add, resetGaugeSmoothing, showMsg |
