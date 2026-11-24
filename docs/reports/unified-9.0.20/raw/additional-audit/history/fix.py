from pathlib import Path
p=Path('/workspace/scratch/741f792566ea/source-920/iobroker.eos-admin/ui/src-ts/runtime-executables/main.ts')
s=p.read_text()
start=s.index("  async updateHistorieExportStates(reason = 'timer') {")
end=s.index('\n  /**\n   * Code-Teil: scheduleRfidPolicyApply', start)
m=s[start:end]
m=m.replace("    const historyCoreMaxAgeMs = Math.max(30000, Number(this.config?.settings?.deviceStaleTimeoutSec || 60) * 1000);", """    const historyCoreMaxAgeMs = Math.max(30000, Number(this.config?.settings?.deviceStaleTimeoutSec || 60) * 1000);
    // History samples are observations, not a refresh of the last cached value.
    // Missing timestamps, stale values and missing measurements remain gaps.
    const readHistory = (key, maxAgeMs = historyCoreMaxAgeMs) => {
      const rec = this.stateCache && this.stateCache[key];
      const stamp = rec ? numericMeasurement(rec.ts) : null;
      if (stamp === null || stamp <= 0 || stamp > now || now - stamp > maxAgeMs) return null;
      return numericMeasurement(rec.value);
    };""")
m=m.replace("this._nwGetNumberFromCacheFresh('derived.core.pv.totalW', historyCoreMaxAgeMs, null, now)","readHistory('derived.core.pv.totalW')")
m=m.replace("this._nwGetNumberFromCache('pvPower') ?? this._nwGetNumberFromCache('productionTotal')", "readHistory('pvPower') ?? readHistory('productionTotal')")
m=m.replace("this._nwGetNumberFromCacheFresh('derived.core.building.loadTotalW', historyCoreMaxAgeMs, null, now)","readHistory('derived.core.building.loadTotalW')")
m=m.replace("Number.isFinite(Number(loadDerivedW)) ? Number(loadDerivedW) : this._nwGetNumberFromCache('consumptionTotal')", "loadDerivedW !== null ? loadDerivedW : readHistory('consumptionTotal')")
m=m.replace("const storageFlowHist = this._nwResolveBatteryFlowFromCache({ now });\n    let chgW = Number(storageFlowHist.chargeW);\n    let dchgW = Number(storageFlowHist.dischargeW);", """const storageFlowHist = this._nwResolveBatteryFlowFromCache({ now, strictStale: true });
    const storageMissing = ['missing', 'mapped-missing', 'storageFarm-missing-power', 'storageFarm-unavailable'].includes(storageFlowHist.src);
    const farmPowerAge = storageFlowHist.staleMs && numericMeasurement(storageFlowHist.staleMs.farmPower);
    const farmPowerStale = selectedStorageTopologyHist === 'farm'
      && (farmPowerAge === null || farmPowerAge === undefined || farmPowerAge > historyCoreMaxAgeMs);
    const chgW = storageMissing || farmPowerStale ? null : numericMeasurement(storageFlowHist.chargeW);
    const dchgW = storageMissing || farmPowerStale ? null : numericMeasurement(storageFlowHist.dischargeW);""")
m=m.replace("this._nwGetNumberFromCache('storageSoc')", "readHistory('storageSoc')")
m=m.replace("const evW = this._nwGetNumberFromCache('evcs.totalPowerW');", "const evW = readHistory('evcs.totalPowerW');")
m=m.replace("const gridBuy = Number.isFinite(gridBuyW) ? Math.max(0, gridBuyW) : 0;\n    const gridSell = Number.isFinite(gridSellW) ? Math.max(0, gridSellW) : 0;\n    const gridNet = gridBuy - gridSell;", """const gridBuy = Number.isFinite(gridBuyW) ? Math.max(0, gridBuyW) : null;
    const gridSell = Number.isFinite(gridSellW) ? Math.max(0, gridSellW) : null;
    const gridNet = gridBuy !== null && gridSell !== null ? gridBuy - gridSell : null;""")
m=m.replace("let pvTotal = Number.isFinite(Number(pvDerivedW))\n      ? Math.max(0, Number(pvDerivedW))\n      : (Number.isFinite(Number(pvW)) ? Math.max(0, Number(pvW)) : null);\n    const pvTotalFromDerived = Number.isFinite(Number(pvDerivedW));", """let pvTotal = pvDerivedW !== null
      ? Math.max(0, pvDerivedW)
      : (pvW !== null ? Math.max(0, pvW) : null);
    const pvTotalFromDerived = pvDerivedW !== null;""")
m=m.replace("if (!pvTotalFromDerived && sfEnabled && typeof this._nwMergeStorageFarmPvWithBase === 'function')", "if (!pvTotalFromDerived && sfEnabled && readHistory('storageFarm.totalPvPowerW') !== null\n      && typeof this._nwMergeStorageFarmPvWithBase === 'function')")
m=m.replace("} else if (singleStorageDcEnabled) {\n      const dcValueW = this._nwGetNumberFromCache('speicher.dcPvPowerW');", "} else if (!pvTotalFromDerived && singleStorageDcEnabled) {\n      const dcValueW = readHistory('speicher.dcPvPowerW');")
old="""        const socFarm = farmMetricsHist && Number.isFinite(Number(farmMetricsHist.soc))
          ? Number(farmMetricsHist.soc)
          : this._nwGetNumberFromCache('storageFarm.totalSocOnline');
        const socFarmFallback = Number.isFinite(Number(socFarm))
          ? Number(socFarm)
          : this._nwGetNumberFromCache('storageFarm.totalSoc');
        soc = Number.isFinite(Number(socFarmFallback))
          ? Math.max(0, Math.min(100, Number(socFarmFallback)))
          : null;"""
new="""        const socFarm = readHistory('storageFarm.totalSocOnline') ?? readHistory('storageFarm.totalSoc');
        soc = socFarm !== null ? Math.max(0, Math.min(100, socFarm)) : null;"""
assert old in m;m=m.replace(old,new)
m=m.replace("const chg = Number.isFinite(chgW) ? Math.max(0, chgW) : 0;\n    const dchg = Number.isFinite(dchgW) ? Math.max(0, dchgW) : 0;\n    const evAbs = Number.isFinite(evW) ? Math.abs(evW) : 0;", """const chg = Number.isFinite(chgW) ? Math.max(0, chgW) : null;
    const dchg = Number.isFinite(dchgW) ? Math.max(0, dchgW) : null;
    const evAbs = Number.isFinite(evW) ? Math.abs(evW) : null;""")
m=m.replace("if (loadTotal === null) {\n      const pvUse = pvTotal || 0;\n      loadTotal = Math.max(0, pvUse + gridBuy + dchg - gridSell - chg);\n    }", """if (loadTotal === null && pvTotal !== null && gridBuy !== null && gridSell !== null && chg !== null && dchg !== null) {
      loadTotal = Math.max(0, pvTotal + gridBuy + dchg - gridSell - chg);
    }""")
m=m.replace("const v = this._nwGetNumberFromCache(`consumer${i}Power`);", "const v = readHistory(`consumer${i}Power`);")
m=m.replace("const loadRest = Math.max(0, (loadTotal || 0) - evAbs - extrasConsumersSum);", "const loadRest = loadTotal !== null && evAbs !== null ? Math.max(0, loadTotal - evAbs - extrasConsumersSum) : null;")
m=m.replace("const n = Number(_rawCacheValue(key));\n        return Number.isFinite(n) ? n : fallback;", "const n = numericMeasurement(_rawCacheValue(key));\n        return n !== null ? n : fallback;")
m=m.replace("const providerPrice = _numOr('tarif.preisAktuellEurProKwh', null);\n    const providerAveragePrice = _numOr('tarif.preisDurchschnittEurProKwh', null);", """const tariffMaxAgeMs = Math.max(15 * 60000, Math.min(360 * 60000, _numOr('tarif.currentPriceMaxAgeMs', 90 * 60000)));
    const providerPrice = _rawCacheValue('tarif.currentPriceFresh') === false
      ? null : readHistory('tarif.preisAktuellEurProKwh', tariffMaxAgeMs);
    const providerAveragePrice = _rawCacheValue('tarif.curveFresh') === false
      ? null : readHistory('tarif.preisDurchschnittEurProKwh', tariffMaxAgeMs);""")
m=m.replace("'historie.core.pv.totalW', pvTotal || 0", "'historie.core.pv.totalW', pvTotal")
m=m.replace("'historie.core.building.loadTotalW', loadTotal || 0", "'historie.core.building.loadTotalW', loadTotal")
m=m.replace("'historie.core.building.loadRestW', loadRest || 0", "'historie.core.building.loadRestW', loadRest")
m=m.replace("const v = this._nwGetNumberFromCache(`evcs.${i}.powerW`);", "const v = readHistory(`evcs.${i}.powerW`);")
m=m.replace("const v = this._nwGetNumberFromCache(info.stateKey || info.key || `consumer${i}Power`);", "const v = readHistory(info.stateKey || info.key || `consumer${i}Power`);")
m=m.replace("const v = this._nwGetNumberFromCache(info.stateKey || info.key || `producer${i}Power`);", "const v = readHistory(info.stateKey || info.key || `producer${i}Power`);")
s=s[:start]+m+s[end:]
start=s.index('  _nwSetHistorieValue(localId, val, ts, tolAbs = 1) {');end=s.index('\n  /**',start)
x=s[start:end];x=x.replace('const n = Number(val);\n      if (!Number.isFinite(n)) return;', 'const n = numericMeasurement(val);\n      if (n === null) return;');s=s[:start]+x+s[end:]
p.write_text(s)
