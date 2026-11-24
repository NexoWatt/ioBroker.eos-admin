from pathlib import Path
root=Path('/workspace/scratch/741f792566ea/source-920/iobroker.eos-admin')
p=root/'ui/src-ts/runtime-executables/www/app.ts'
s=p.read_text()
# Preserve raw engineering zero; never substitute a fabricated or indefinitely held load.
start=s.index('  // Anti-glitch: if the building load temporarily drops to 0 W')
end=s.index('  // -------- Anzeige-Werte',start)
s=s[:start]+'  // Echte 0 W bleiben 0 W. Fehlende Messung wird unten als unbekannt gezeigt;\n  // Anzeige-Glättung darf keinen Ersatzverbrauch erfinden oder Zeitstempel erneuern.\n\n'+s[end:]
# Strict missing distinction in canonical PV resolver.
s=s.replace("  const derived = Number(d('derived.core.pv.totalW'));\n  if (Number.isFinite(derived) && derived >= 0) return derived;", "  const derived = coerceNumber(d('derived.core.pv.totalW'));\n  if (derived !== null && derived >= 0) return derived;")
s=s.replace("  let base = Number(d('pvPower') ?? d('productionTotal') ?? 0);\n  if (!Number.isFinite(base)) base = 0;\n  const baseAbs = Math.abs(base);", "  const base = coerceNumber(d('pvPower') ?? d('productionTotal'));\n  const baseAbs = base === null ? null : Math.abs(base);")
s=s.replace("  if (baseAbs <= 0) return farmTotal;\n  if (farmTotal <= 0) return baseAbs;", "  if (baseAbs === null || baseAbs <= 0) return farmTotal > 0 ? farmTotal : baseAbs;\n  if (farmTotal <= 0) return baseAbs;")
# Never read stale values as stable merely because they did not change.
s=s.replace("  // Kern-Energiefluss-DPs dürfen nicht als fehlend gelten, nur weil ein konstanter\n  // Wert (typisch 0 W bei Speicher Laden/Entladen) lange nicht geändert wurde.\n  return getFreshFlowNumber(key, Object.assign({}, opts, { maxAgeMs: null }));", "  // Aktualität folgt dem Messzeitstempel (ts), nicht dem Änderungszeitpunkt (lc).\n  // Auch unveränderte echte Messungen werden vom Gerät regelmäßig bestätigt.\n  return getFreshFlowNumber(key, opts);")
a=s.index('function getFreshFlowNumber(key, opts = {}) {');b=s.index('\n}',a)+2
s=s[:a]+'''function getFreshFlowNumber(key, opts = {}) {
  if (opts.onlyIfMapped && !isMappedDatapoint(key)) return null;
  return window.NexoWattLiveDisplay?.read(state, key, Date.now(), getFlowFreshMaxAgeMs(), window.__nwTariffLiveOnline !== false) ?? null;
}'''+s[b:]
# Status must not turn connection success into an unconditional system-health claim.
s=s.replace("  setText('sideStatusText', online ? 'Alle Systeme normal' : 'Verbindung wird aufgebaut');", "  setText('sideStatusText', online ? 'Verbindung hergestellt · Betriebsstatus wird geprüft' : 'Verbindung unterbrochen');")
s=s.replace("  setText('sideEms', safety === 'EOS-SAFETY-STOP' ? 'Safety aktiv' : 'Aktiv');\n  setText('sideGridStatus', p14Fallback ? '§14a Fallback' : (p14 ? '§14a aktiv' : (peak === 'active' ? 'Peak aktiv' : 'Stabil')));", "  const health = window.NexoWattLiveDisplay?.status(window.latestState || state || {}, window.__nwTariffLiveOnline !== false, Date.now());\n  setText('sideEms', safety === 'EOS-SAFETY-STOP' ? 'Safety aktiv' : health?.ems || 'Status unbekannt');\n  setText('sideGridStatus', p14Fallback ? '§14a Fallback' : (p14 ? '§14a aktiv' : (peak === 'active' ? 'Peak aktiv' : health?.grid || 'Messstatus unbekannt')));\n  setText('sideStatusText', health?.summary || 'Betriebsstatus unbekannt');")
# Shared visible measurement bundle, reused by side cards, main cards and flow.
insert=s.index('// Abschnitt: Haupt-Renderlauf')
s=s[:insert]+'''/** Anzeigeprojektion: Fehlend/veraltet/offline bleibt null, echte 0 bleibt erhalten.
 * Keine Regelung, keine Ersatzmessung und keine Änderung der Kundenzuordnung. */
function getLiveMeasurementView() {
  const fresh = key => getFreshFlowNumber(key);
  const grid = getGridImportExport(fresh);
  const nvp = state?.['ems.gridMeasurementFresh'];
  const nvpUsable = !nvp || (nvp.value === true && getStateAgeMs('ems.gridMeasurementFresh') !== null && getStateAgeMs('ems.gridMeasurementFresh') <= getFlowFreshMaxAgeMs());
  const gridAvailable = nvpUsable && (grid.rawBuy !== null || grid.rawSell !== null || grid.rawNet !== null);
  const battery = getNormalizedBatteryFlow();
  const batteryAvailable = !['missing', 'mapped-missing', 'storageFarm-missing-power', 'storageFarm-unavailable', 'stale-or-missing'].includes(String(battery.src)) && battery.incomplete !== true;
  const farm = nwStorageFarmFeatureFromConfig(window.__nwCfg || {}, state || {});
  const farmView = farm ? window.NexoWattLiveDisplay?.farm(state, Date.now(), window.__nwTariffLiveOnline !== false) : null;
  return {
    pv: getCanonicalPvPowerW(fresh), load: fresh('consumptionTotal'),
    buy: gridAvailable ? grid.buy : null, sell: gridAvailable ? grid.sell : null,
    charge: farmView ? farmView.charge : batteryAvailable ? battery.chargeW : null,
    discharge: farmView ? farmView.discharge : batteryAvailable ? battery.dischargeW : null,
    soc: farmView ? farmView.soc : farm ? fresh('storageFarm.totalSoc') ?? fresh('storageFarm.medianSoc') : fresh('storageSoc'),
  };
}

'''+s[insert:]
# Main card rendering use same view, keep geometry numeric only.
a=s.index('function render() {');b=s.index('\nfunction ',a+30)
part=s[a:b]
x=part.index('  // Der sichtbare PV-Wert');y=part.index('  const maxVal',x)
part=part[:x]+'''  const measurements = getLiveMeasurementView();
  const { pv, load, buy, sell, charge, discharge, soc } = measurements;
'''+part[y:]
for field in ['pv','buy','sell','load','charge','discharge']:
 part=part.replace('formatPower('+field+' ?? 0)', "("+field+" === null ? '--' : formatPower("+field+"))")
part=part.replace("setText('storagePower', formatPower(batPower));", "setText('storagePower', charge === null || discharge === null ? '--' : formatPower(batPower));")
part=part.replace("formatPower(d('consumptionTotal') ?? 0)","(load === null ? '--' : formatPower(load))")
part=part.replace("formatPower(d('productionTotal') ?? pv ?? 0)","(pv === null ? '--' : formatPower(pv))")
s=s[:a]+part+s[b:]
# Flow takes same values and null quality before numeric-only geometry.
a=s.index('function updateEnergyWeb() {');b=s.index('\n\n\n\n// KI',a)
part=s[a:b]
x=part.index('  // Backend-konsolidierte');y=part.index('  // Invert toggles',x)
part=part[:x]+'''  const measurements = getLiveMeasurementView();
  let pv = measurements.pv ?? 0;
  let buy = measurements.buy ?? 0, sell = measurements.sell ?? 0;
  const load = measurements.load ?? 0;
  const evcsPowerW = getEvcsPowerW(d);
  let c2 = evcsPowerW ?? 0; // Nur Geometrie, niemals Ersatzmessung.
  const batCharge = measurements.charge ?? 0, batDischarge = measurements.discharge ?? 0;
  const soc = measurements.soc;

'''+part[y:]
part=part.replace("T('pvVal', formatFlowPower(pvValNum));", "T('pvVal', measurements.pv === null ? '--' : formatFlowPower(pvValNum));")
part=part.replace("T('gridVal', gridShowVal ?", "T('gridVal', measurements.buy === null ? '--' : gridShowVal ?")
part=part.replace("T('restVal', batShowVal ?", "T('restVal', measurements.charge === null || measurements.discharge === null ? '--' : batShowVal ?")
part=part.replace("T('centerPower', formatFlowPower(Math.max(0, loadDisplay)));", "T('centerPower', measurements.load === null || (evAvail && subEvFromLoad && evcsPowerW === null) ? '--' : formatFlowPower(Math.max(0, loadDisplay)));")
part=part.replace("if (soc===undefined || isNaN(Number(soc)))", "if (soc===undefined || soc===null || typeof soc === 'boolean' || !Number.isFinite(Number(soc)))")
s=s[:a]+part+s[b:]
# Side cards independently use same projection. Do not coerce null to 0.
a=s.index('function updateDashboardShellUi(data) {');b=s.index('// ------------------------------',a)
part=s[a:b]
x=part.index('  const pv = Number(');y=part.index('  const evcsAvailable',x)
part=part[:x]+'''  const { pv, buy, sell, load, charge, discharge } = getLiveMeasurementView();
  const batterySigned = charge === null || discharge === null ? null : discharge - charge;
'''+part[y:]
for name,expr in [('sideConsumptionTotal','Math.max(0, load)'),('sidePvPower','Math.abs(pv)'),('sideBuildingPower','Math.max(0, load)'),('sideGridBuyPower','Math.max(0, buy)'),('sideGridSellPower','Math.max(0, sell)')]:
 field={'sideConsumptionTotal':'load','sidePvPower':'pv','sideBuildingPower':'load','sideGridBuyPower':'buy','sideGridSellPower':'sell'}[name]
 part=part.replace("setText('"+name+"', formatFlowPower("+expr+"));", "setText('"+name+"', "+field+" === null ? '--' : formatFlowPower("+expr+"));")
part=part.replace("setText('sideBatteryPower', (batterySigned < 0 ? '-' : '') + formatFlowPower(Math.abs(batterySigned)));", "setText('sideBatteryPower', batterySigned === null ? '--' : (batterySigned < 0 ? '-' : '') + formatFlowPower(Math.abs(batterySigned)));")
s=s[:a]+part+s[b:]
# Grid getter may be called by legacy functions: use fresh values consistently.
s=s.replace("  const getter = (typeof read === 'function') ? read : (k) => read?.[k]?.value;", "  const getter = (typeof read === 'function') ? read : (k) => read?.[k]?.value;")
# The recursive battery-balance fallback must also respect freshness.
s=s.replace("    const read = (k) => st && st[k] ? st[k].value : undefined;", "    const read = (k) => getFreshFlowNumber(k);")
# Mark metric refresh on disconnection without recursing into full render.
s=s.replace("  if (dot) dot.classList.toggle('is-offline', !online);\n}", "  if (dot) dot.classList.toggle('is-offline', !online);\n  if (!online) {\n    for (const id of ['pvPower', 'gridBuyPower', 'gridSellPower', 'storagePower', 'consumptionTotal', 'sidePvPower', 'sideBuildingPower', 'sideBatteryPower', 'sideGridBuyPower', 'sideGridSellPower', 'pvVal', 'gridVal', 'restVal', 'centerPower']) setText(id, '--');\n    setText('batterySocIn', '-- %'); setText('sideStorage', '-- %'); setText('sideBatterySoc', '-- %');\n    setText('sideEms', 'Verbindung unterbrochen'); setText('sideGridStatus', 'Messstatus unbekannt');\n  }\n}")
p.write_text(s)
for name in ['index.html','settings.html']:
 p=root/'ui/www'/name;html=p.read_text();needle='<script src="/static/app.js">';assert needle in html
 html=html.replace(needle,'<script src="/static/live-display.js"></script>\n'+needle);p.write_text(html)
