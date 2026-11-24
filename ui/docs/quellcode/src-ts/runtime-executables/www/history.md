# src-ts/runtime-executables/www/history.ts

Lädt historische Anlagenwerte und steuert Diagramme, Zeitraumwahl, Zoom sowie die zugehörigen Berichte.

**Daten und Wirkung:** Verbindet die in dieser Datei sichtbaren Browser-Eingaben, Anzeigeelemente und API-/Hilfsaufrufe. Der Backend-Pfad entscheidet weiterhin über Berechtigungen und zulässige Schreibwirkungen.

**Bei Änderungen:** DOM-/API-Verträge und Rollenrechte mitprüfen; Kommentare und docs:build nach fachlichen Änderungen aktualisieren.

[Originalquelle](../../../../../src-ts/runtime-executables/www/history.ts) · [Gesamtübersicht](../../../../QUELLCODE_VERKNUEPFUNGEN_DE.md)

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
| [`nwHistoryEscapeHtml`](../../../../../src-ts/runtime-executables/www/history.ts#L78) | value | String |
| [`resize`](../../../../../src-ts/runtime-executables/www/history.ts#L106) | – | Math.max, Math.round |
| [`scheduleHistoryFrame`](../../../../../src-ts/runtime-executables/www/history.ts#L128) | – | window.requestAnimationFrame, window.setTimeout |
| [`render`](../../../../../src-ts/runtime-executables/www/history.ts#L130) | – | draw, drawPricingHistoryChart, resize |
| [`fmt`](../../../../../src-ts/runtime-executables/www/history.ts#L161) | ts | d.toLocaleTimeString |
| [`eventClientPoint`](../../../../../src-ts/runtime-executables/www/history.ts#L171) | ev | Number, Number.isFinite |
| [`canvasPointFromEvent`](../../../../../src-ts/runtime-executables/www/history.ts#L183) | targetCanvas, ev | Number, eventClientPoint, targetCanvas.getBoundingClientRect |
| [`isMobileHistorySurface`](../../../../../src-ts/runtime-executables/www/history.ts#L198) | – | Boolean, Number, window.matchMedia |
| [`showFloatingTip`](../../../../../src-ts/runtime-executables/www/history.ts#L213) | tip, html, clientX, clientY | Math.max, Math.min, Math.round, Number, isMobileHistorySurface, tip.classList.toggle, tip.getBoundingClientRect |
| [`scheduleHistoryRenderBurst`](../../../../../src-ts/runtime-executables/www/history.ts#L286) | – | clearTimeout, scheduleHistoryFrame, setTimeout |
| [`countRenderableHistoryPoints`](../../../../../src-ts/runtime-executables/www/history.ts#L297) | res | Object.keys |
| [`scan`](../../../../../src-ts/runtime-executables/www/history.ts#L305) | arr | Array.isArray, Number, Number.isFinite, toTsMs |
| [`scheduleHistoryRetry`](../../../../../src-ts/runtime-executables/www/history.ts#L332) | delayMs | Math.max, Number, setTimeout |
| [`bootHistoryOnce`](../../../../../src-ts/runtime-executables/www/history.ts#L346) | – | load, resize, scheduleHistoryRenderBurst |
| [`isPriceSeriesVisible`](../../../../../src-ts/runtime-executables/www/history.ts#L371) | key | String, hiddenPriceSeries.has |
| [`setPriceSeriesVisible`](../../../../../src-ts/runtime-executables/www/history.ts#L378) | key, visible | String, hiddenPriceSeries.add, hiddenPriceSeries.delete |
| [`applyPriceLegendState`](../../../../../src-ts/runtime-executables/www/history.ts#L389) | – | Array.from, document.querySelectorAll, items.forEach |
| [`bindPriceLegendItem`](../../../../../src-ts/runtime-executables/www/history.ts#L406) | el | el.addEventListener, el.hasAttribute, el.setAttribute |
| [`isSeriesVisible`](../../../../../src-ts/runtime-executables/www/history.ts#L438) | key | String, hiddenSeries.has |
| [`setSeriesVisible`](../../../../../src-ts/runtime-executables/www/history.ts#L445) | key, visible | String, hiddenSeries.add, hiddenSeries.delete |
| [`applyLegendState`](../../../../../src-ts/runtime-executables/www/history.ts#L456) | – | Array.from, document.querySelectorAll, items.forEach |
| [`bindLegendItem`](../../../../../src-ts/runtime-executables/www/history.ts#L473) | el | el.addEventListener, el.hasAttribute, el.setAttribute |
| [`getChartMargins`](../../../../../src-ts/runtime-executables/www/history.ts#L511) | – | – |
| [`getExtras`](../../../../../src-ts/runtime-executables/www/history.ts#L527) | – | Array.isArray |
| [`buildSeriesAll`](../../../../../src-ts/runtime-executables/www/history.ts#L540) | – | Object.assign, ex.consumers.forEach, ex.producers.forEach, getExtras |
| [`colorForExtra`](../../../../../src-ts/runtime-executables/www/history.ts#L570) | kind, idx | Math.max, Math.min, Number |
| [`updateLegend`](../../../../../src-ts/runtime-executables/www/history.ts#L581) | – | Array.from, applyLegendState, document.getElementById, ex.consumers.forEach, ex.producers.forEach, getExtras, legend.querySelectorAll |
| [`addItem`](../../../../../src-ts/runtime-executables/www/history.ts#L595) | label, color, key | bindLegendItem, document.createElement, el.appendChild, legend.appendChild |
| [`drawBars`](../../../../../src-ts/runtime-executables/www/history.ts#L633) | – | Math.max, allKeys.filter, allKeys.forEach, bucketizeRange, buckets.map, buildSeriesAll, ctx.clearRect, ctx.fillRect, ctx.fillText, d.toLocaleDateString, keys.slice, y |
| [`y`](../../../../../src-ts/runtime-executables/www/history.ts#L661) | val | – |
| [`draw`](../../../../../src-ts/runtime-executables/www/history.ts#L705) | – | Array.from, Math.max, Object.values, buildSeriesAll, ctx.beginPath, ctx.clearRect, ctx.fillRect, ctx.fillText, ctx.lineTo, ctx.moveTo, ctx.restore, ctx.save, ctx.stroke, drawBars (weitere in der Quelle) |
| [`x`](../../../../../src-ts/runtime-executables/www/history.ts#L739) | t | – |
| [`isNeg`](../../../../../src-ts/runtime-executables/www/history.ts#L784) | k | – |
| [`yPow`](../../../../../src-ts/runtime-executables/www/history.ts#L825) | kw | – |
| [`ySoc`](../../../../../src-ts/runtime-executables/www/history.ts#L845) | pct | Math.max, Math.min, Number |
| [`mapKW`](../../../../../src-ts/runtime-executables/www/history.ts#L863) | k, w | Math.abs, String, historyNumericValue |
| [`hexToRgba`](../../../../../src-ts/runtime-executables/www/history.ts#L887) | hex, a | String, h.match, parseInt |
| [`line`](../../../../../src-ts/runtime-executables/www/history.ts#L915) | k, color, accessor, dash, width | Number, Number.isFinite, ctx.beginPath, ctx.restore, ctx.save, ctx.setLineDash, ctx.stroke, vals.forEach, xs.forEach |
| [`drawStackedAreas`](../../../../../src-ts/runtime-executables/www/history.ts#L949) | – | Math.max, Math.min, Number.isFinite, all.forEach, negKeys.forEach, posKeys.concat, posKeys.forEach |
| [`drawArea`](../../../../../src-ts/runtime-executables/www/history.ts#L989) | k | Math.abs, Number.isFinite, ctx.beginPath, ctx.closePath, ctx.fill, ctx.lineTo, ctx.moveTo, ctx.restore, ctx.save, ctx.stroke, hexToRgba, seg.lower.at, seg.upper.at, x (weitere in der Quelle) |
| [`fmtKWAxis`](../../../../../src-ts/runtime-executables/www/history.ts#L1075) | v | Math.abs, Number, Number.isFinite, n.toLocaleString |
| [`bucketizeRange`](../../../../../src-ts/runtime-executables/www/history.ts#L1136) | fromMs, toMs, mode | buckets.filter, cur.getFullYear, cur.getMonth, cur.getTime, cur.setHours, e.getDate, e.setDate, pushBucket, start.getFullYear, start.getMonth |
| [`pushBucket`](../../../../../src-ts/runtime-executables/www/history.ts#L1146) | s, e | buckets.push |
| [`historyNumericValue`](../../../../../src-ts/runtime-executables/www/history.ts#L1182) | value | Number, Number.isFinite, value.trim |
| [`aggregateEnergyKWh`](../../../../../src-ts/runtime-executables/www/history.ts#L1187) | vals, buckets | Math.abs, Math.min, Number.isFinite, buckets.map, historyNumericValue, vals.at |
| [`toTsMs`](../../../../../src-ts/runtime-executables/www/history.ts#L1221) | t | Date.parse, Number, Number.isFinite, Number.isNaN, t.getTime, t.trim |
| [`sumEnergyKWh`](../../../../../src-ts/runtime-executables/www/history.ts#L1247) | vals | Array.isArray, Math.abs, Number.isFinite |
| [`pickEnergyKwh`](../../../../../src-ts/runtime-executables/www/history.ts#L1273) | counterVal, integratedVal | Math.max, Number.isFinite, historyNumericValue |
| [`formatMoney2`](../../../../../src-ts/runtime-executables/www/history.ts#L1290) | v | Number.isFinite, historyNumericValue, n.toFixed |
| [`formatPrice2`](../../../../../src-ts/runtime-executables/www/history.ts#L1297) | v | Number.isFinite, historyNumericValue, n.toFixed |
| [`formatKwh2`](../../../../../src-ts/runtime-executables/www/history.ts#L1304) | v | Number, Number.isFinite |
| [`normalizeNumericSeries`](../../../../../src-ts/runtime-executables/www/history.ts#L1311) | vals | Array.isArray, out.push |
| [`valueAtHold`](../../../../../src-ts/runtime-executables/www/history.ts#L1329) | points, ts | Array.isArray, Math.floor, Number, Number.isFinite |
| [`buildPricingIntervals`](../../../../../src-ts/runtime-executables/www/history.ts#L1345) | res | Array.from, Number, Number.isFinite, aggregateEnergyKWh, buckets.map, buckets.push, normalizeNumericSeries |
| [`aggregatePricingIntervals`](../../../../../src-ts/runtime-executables/www/history.ts#L1410) | intervals, fromMs, toMs, mode | Array.isArray, bucketizeRange, buckets.map, src.map |
| [`summarizePricingIntervals`](../../../../../src-ts/runtime-executables/www/history.ts#L1454) | intervals | Array.isArray, Math.max, Math.min, prices.reduce, src.map, src.reduce |
| [`renderPricingCards`](../../../../../src-ts/runtime-executables/www/history.ts#L1490) | summary | card, document.getElementById, formatKwh2, formatMoney2, formatPrice2 |
| [`card`](../../../../../src-ts/runtime-executables/www/history.ts#L1500) | title, val | cards.appendChild, document.createElement, nwHistoryEscapeHtml |
| [`buildPricingNote`](../../../../../src-ts/runtime-executables/www/history.ts#L1520) | pricing, intervals | Array.isArray, intervals.some, parts.join, parts.push |
| [`syncPricingLegend`](../../../../../src-ts/runtime-executables/www/history.ts#L1537) | – | Array.from, applyPriceLegendState, document.querySelectorAll |
| [`renderPricingHistory`](../../../../../src-ts/runtime-executables/www/history.ts#L1547) | res | Number, aggregatePricingIntervals, buildPricingIntervals, buildPricingNote, document.getElementById, drawPricingHistoryChart, renderPricingCards, resize, section.classList.add, section.classList.remove, summarizePricingIntervals, syncPricingLegend, window.__nxHistoryHidePriceTip |
| [`drawPricingHistoryChart`](../../../../../src-ts/runtime-executables/www/history.ts#L1602) | – | Array.isArray, Math.max, Math.min, Number, document.getElementById, drawLine, fmt, isPriceSeriesVisible, leftVals.push, points.forEach, points.map, priceCtx.beginPath, priceCtx.clearRect, priceCtx.fillRect (weitere in der Quelle) |
| [`x`](../../../../../src-ts/runtime-executables/www/history.ts#L1671) | ts | Math.max, Math.min |
| [`yLeft`](../../../../../src-ts/runtime-executables/www/history.ts#L1681) | val | Math.max, Number |
| [`yRight`](../../../../../src-ts/runtime-executables/www/history.ts#L1688) | val | Number |
| [`drawLine`](../../../../../src-ts/runtime-executables/www/history.ts#L1766) | key, accessor, color, dash | Array.isArray, isPriceSeriesVisible, points.forEach, points.map, priceCtx.beginPath, priceCtx.restore, priceCtx.save, priceCtx.setLineDash, priceCtx.stroke |
| [`initPricingTooltip`](../../../../../src-ts/runtime-executables/www/history.ts#L1811) | – | document.addEventListener, document.body.appendChild, document.createElement, priceCanvas.addEventListener, tip.setAttribute, window.addEventListener |
| [`hidePriceTip`](../../../../../src-ts/runtime-executables/www/history.ts#L1839) | silent | drawPricingHistoryChart |
| [`formatHeader`](../../../../../src-ts/runtime-executables/www/history.ts#L1853) | ts | d.toLocaleDateString, d.toLocaleTimeString |
| [`row`](../../../../../src-ts/runtime-executables/www/history.ts#L1865) | label, val | nwHistoryEscapeHtml |
| [`showPriceTipFromEvent`](../../../../../src-ts/runtime-executables/www/history.ts#L1874) | ev | Array.isArray, Math.abs, Math.max, canvasPointFromEvent, drawPricingHistoryChart, formatHeader, formatKwh2, formatMoney2, formatPrice2, hidePriceTip, isPriceSeriesVisible, row, rows.join, rows.push (weitere in der Quelle) |
| [`load`](../../../../../src-ts/runtime-executables/www/history.ts#L1960) | force | Date.now, document.getElementById, from.getTime, reqPromise.finally, scheduleHistoryRenderBurst, to.getTime |
| [`clipArr`](../../../../../src-ts/runtime-executables/www/history.ts#L2041) | arr | Array.isArray, arr.filter |
| [`scan`](../../../../../src-ts/runtime-executables/www/history.ts#L2095) | arr | Array.isArray, Number.isFinite, toTsMs |
| [`exactNum`](../../../../../src-ts/runtime-executables/www/history.ts#L2157) | key | Number.isFinite, exactValues.get, historyNumericValue |
| [`card`](../../../../../src-ts/runtime-executables/www/history.ts#L2168) | title, val | cards.appendChild, document.createElement, nwHistoryEscapeHtml |
| [`toLocal`](../../../../../src-ts/runtime-executables/www/history.ts#L2244) | dt | d.toISOString, dt.getTime, dt.getTimezoneOffset |
| [`pad2`](../../../../../src-ts/runtime-executables/www/history.ts#L2255) | n | String |
| [`toDateInput`](../../../../../src-ts/runtime-executables/www/history.ts#L2262) | dt | d.getDate, d.getFullYear, d.getMonth, pad2 |
| [`fromDateInput`](../../../../../src-ts/runtime-executables/www/history.ts#L2272) | str | Number, Number.isFinite, String, d.getTime |
| [`getAnchorDate`](../../../../../src-ts/runtime-executables/www/history.ts#L2289) | – | document.getElementById, fromDateInput |
| [`setAnchorDate`](../../../../../src-ts/runtime-executables/www/history.ts#L2300) | d | document.getElementById, toDateInput |
| [`applyRangeForMode`](../../../../../src-ts/runtime-executables/www/history.ts#L2311) | mode | anchor.getFullYear, anchor.getMonth, document.getElementById, endDay.setHours, from.getDate, from.setDate, from.setHours, getAnchorDate, to.getDate, to.setDate, toLocal |
| [`apply`](../../../../../src-ts/runtime-executables/www/history.ts#L2378) | – | stackBtn.classList.toggle |
| [`setActive`](../../../../../src-ts/runtime-executables/www/history.ts#L2436) | mode | __stopAuto, applyRangeForMode, btns.forEach, load, window.__nxHistoryShowZoomReset |
| [`hideTip`](../../../../../src-ts/runtime-executables/www/history.ts#L2489) | silent | draw |
| [`xToTs`](../../../../../src-ts/runtime-executables/www/history.ts#L2503) | x, start, end, L, R, W | Math.max, Math.min |
| [`tsToX`](../../../../../src-ts/runtime-executables/www/history.ts#L2513) | ts, start, end, L, R, W | – |
| [`showTipFromEvent`](../../../../../src-ts/runtime-executables/www/history.ts#L2523) | ev | Array.isArray, Math.abs, Math.floor, Math.max, Math.min, Number, Number.isFinite, Object.entries, buildSeriesAll, canvasPointFromEvent, d.toLocaleDateString, draw, dt.toLocaleTimeString, extraLines.forEach (weitere in der Quelle) |
| [`kv`](../../../../../src-ts/runtime-executables/www/history.ts#L2571) | label, val, unit | Number, nwHistoryEscapeHtml |
| [`kv2`](../../../../../src-ts/runtime-executables/www/history.ts#L2631) | label, val, unit | Number.isFinite, historyNumericValue, nwHistoryEscapeHtml, value.toFixed |
| [`showReset`](../../../../../src-ts/runtime-executables/www/history.ts#L2777) | – | resetBtn.classList.toggle |
| [`addMonths`](../../../../../src-ts/runtime-executables/www/history.ts#L2788) | date, delta | Math.min, d.getDate, d.getFullYear, d.getMonth, d.setDate, d.setMonth |
| [`shiftRange`](../../../../../src-ts/runtime-executables/www/history.ts#L2803) | dir | __stopAuto, addMonths, anchor.getTime, applyRangeForMode, getAnchorDate, isFinite, load, next.getDate, next.getFullYear, next.getTime, next.setDate, next.setFullYear, setAnchorDate, today.getTime (weitere in der Quelle) |
| [`xToTs`](../../../../../src-ts/runtime-executables/www/history.ts#L2859) | x, start, end | Math.max, Math.min, getChartMargins |
| [`setInputs`](../../../../../src-ts/runtime-executables/www/history.ts#L2871) | fromMs, toMs | document.getElementById, toLocal |
| [`clearSel`](../../../../../src-ts/runtime-executables/www/history.ts#L2884) | redraw | draw |
| [`scheduleHistoryTouchDraw`](../../../../../src-ts/runtime-executables/www/history.ts#L2916) | – | window.requestAnimationFrame, window.setTimeout |
| [`run`](../../../../../src-ts/runtime-executables/www/history.ts#L2918) | – | draw |
| [`__toLocal`](../../../../../src-ts/runtime-executables/www/history.ts#L3190) | dt | d.toISOString, dt.getTime, dt.getTimezoneOffset |
| [`__setToNow`](../../../../../src-ts/runtime-executables/www/history.ts#L3197) | – | __toLocal, document.getElementById |
| [`__startAuto`](../../../../../src-ts/runtime-executables/www/history.ts#L3204) | – | __setToNow, __stopAuto, setInterval |
| [`__stopAuto`](../../../../../src-ts/runtime-executables/www/history.ts#L3211) | – | clearInterval |
| [`isNearNow`](../../../../../src-ts/runtime-executables/www/history.ts#L3220) | – | Date.now, Math.abs, isFinite |
| [`connect`](../../../../../src-ts/runtime-executables/www/history.ts#L3237) | – | dot.classList.remove, setTimeout, window.NW_RUNTIME?.url |
| [`close`](../../../../../src-ts/runtime-executables/www/history.ts#L3271) | – | menu.classList.add |
| [`toggle`](../../../../../src-ts/runtime-executables/www/history.ts#L3278) | – | menu.classList.toggle |
