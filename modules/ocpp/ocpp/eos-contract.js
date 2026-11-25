'use strict';

// Native EOS 0.4 contract. No alias dependency or additional command writer.
const { statusImpliesZero, chargingStateImpliesZero } = require('./freshness');
const FLOW = /^(?:powerW|powerExportW|currentA|currentExportA|netPowerW)(?:L[123])?$/;
const ENERGY = /^(?:energy(?:Export)?(?:Wh|KWh))$/;
const SOC = /^socPercent$/;
const isManaged = key => FLOW.test(key) || ENERGY.test(key) || SOC.test(key);
const PORT = /^([1-9]\d*):([1-9]\d*)$/;
const validId = n => Number.isSafeInteger(n) && n >= 0;
const scopeKey = (protocol, evse, connector) => protocol === 'ocpp1.6'
  ? (connector === 0 ? 'station' : validId(connector) ? `c${connector}` : '')
  : (evse === 0 ? 'station' : validId(evse) ? `e${evse}` : '');
const statePriority = ['Charging', 'Occupied', 'Preparing', 'EVConnected', 'SuspendedEV', 'SuspendedEVSE', 'Finishing', 'Faulted', 'Unavailable', 'Reserved', 'Available', 'Idle'];
function preferredStatus(values) {
  const list = [...values].filter(Boolean);
  return statePriority.find(s => list.some(v => String(v).toLowerCase() === s.toLowerCase())) || list[0] || '';
}
class StationTelemetry {
  constructor(protocol, declared = [], observed = []) {
    this.protocol = protocol;
    this.declared = new Set([...declared].filter(k => PORT.test(k)));
    this.ports = new Set([...this.declared, ...observed].filter(k => PORT.test(k)));
    this.scopes = new Set([...this.ports].map(k => scopeKey(protocol, ...k.split(':').map(Number))));
    this.inventoryMismatch = false;
    this.statuses = new Map(); this.transactions = new Map(); this.samples = new Map(); this.idle = new Set();
  }
  add(evse, connector) {
    const key = scopeKey(this.protocol, evse, connector);
    if (this.declared.size && key !== 'station' && (!this.scopes.has(key) || (evse > 0 && connector > 0 && !this.declared.has(`${evse}:${connector}`)))) this.inventoryMismatch = true;
    if (evse > 0 && connector > 0) this.ports.add(`${evse}:${connector}`);
    if (key && key !== 'station') this.scopes.add(key);
    return key;
  }
  clearFlow(key) {
    for (const k of [key, 'station']) {
      const m = this.samples.get(k);
      if (m) for (const name of m.keys()) if (FLOW.test(name)) m.delete(name);
    }
  }
  status(evse, connector, value) {
    const key = this.add(evse, connector);
    if (!key) return;
    const port = `${evse}:${connector}`;
    this.statuses.set(port, String(value || ''));
    // A station-level status is not evidence that each physical outlet is idle.
    if (key === 'station') return;
    const ports = [...this.ports].filter(p => scopeKey(this.protocol, ...p.split(':').map(Number)) === key);
    const zero = ports.length && ports.every(p => statusImpliesZero(this.protocol, this.statuses.get(p)));
    if (zero) { if (!this.idle.has(key)) this.clearFlow(key); this.idle.add(key); }
    else { if (this.idle.delete(key)) this.clearFlow(key); }
    // Clear vehicle-specific history on confirmed disconnection, not a pause.
    if (String(value).toLowerCase() === 'available') {
      this.samples.get(key)?.delete('socPercent');
      if (this.scopes.size === 1) this.samples.get('station')?.delete('socPercent');
    }
  }
  transaction(evt) {
    const key = this.add(Number(evt.evseId), Number(evt.connectorId));
    if (!key || key === 'station') return;
    const previous = this.transactions.get(key);
    const txId = evt.txId == null ? '' : String(evt.txId);
    // A late Stop for another transaction must not end the current one.
    if (previous && previous.active && txId && previous.id && txId !== previous.id && evt.type !== 'Start') return;
    const seq = evt.seqNo == null ? undefined : Number(evt.seqNo);
    if (previous && previous.id === txId && Number.isFinite(seq) && Number.isFinite(previous.seq) && seq <= previous.seq) return;
    const active = evt.type !== 'Stop';
    const chargingState = evt.chargingState === undefined ? (previous?.state || '') : String(evt.chargingState);
    this.transactions.set(key, { id: txId, active, state: chargingState, seq });
    if (evt.type === 'Start' && previous?.id !== txId) { this.clearFlow(key); this.samples.get(key)?.delete('socPercent'); this.samples.get('station')?.delete('socPercent'); }
    if (evt.type === 'Stop' || chargingStateImpliesZero(chargingState)) {
      if (!this.idle.has(key)) this.clearFlow(key);
      this.idle.add(key);
    } else { if (this.idle.delete(key)) this.clearFlow(key); }
  }
  meter(evse, connector, values, at, sourceAt) {
    const key = this.add(evse, connector);
    if (!key) return;
    if (!this.samples.has(key)) this.samples.set(key, new Map());
    const map = this.samples.get(key);
    for (const [name, item] of Object.entries(values || {})) {
      if (!isManaged(name) || !Number.isFinite(item.val)) continue;
      const previous = map.get(name);
      const source = item.sourceAt || sourceAt || at;
      if (previous && source < previous.sourceAt) continue;
      // Replayed identical source timestamps are not new samples.
      if (previous && source === previous.sourceAt && item.val === previous.val) continue;
      map.set(name, { val: item.val, at, sourceAt: source, category: item.category });
      if (FLOW.test(name) && Math.abs(item.val) > 1e-9) {
        if (key === 'station') this.idle.clear(); else this.idle.delete(key);
      }
    }
  }
  snapshot(now, ttl, socTtl, allowIdleZero = true) {
    const scopes = [...this.scopes];
    const onlineSample = (scope, name) => {
      const v = this.samples.get(scope)?.get(name);
      const age = name === 'socPercent' ? socTtl : ttl;
      return v && (ENERGY.test(name) || (now - v.at <= age && now - v.sourceAt <= age)) ? v : undefined;
    };
    const names = new Set(['powerW', 'powerExportW', 'currentA', 'currentExportA', 'energyWh', 'energyKWh', 'socPercent']);
    for (const m of this.samples.values()) for (const name of m.keys()) names.add(name);
    const result = {};
    for (const name of names) {
      if (this.inventoryMismatch) continue;
      const direct = onlineSample('station', name);
      if (name === 'socPercent' && scopes.length > 1) continue;
      if (direct) { result[name] = {...direct, source: 'station-meter'}; continue; }
      if (!scopes.length) continue;
      // Without phase topology a multi-port maximum phase current cannot be derived from per-port maxima.
      if (scopes.length > 1 && /^(?:currentA|currentExportA)$/.test(name)) continue;
      const values = scopes.map(key => {
        const v = onlineSample(key, name);
        if (allowIdleZero && FLOW.test(name) && this.idle.has(key)) return { val: 0, at: now, sourceAt: now, category: 'safeZero' };
        return v;
      });
      if (values.some(v => !v)) continue;
      result[name] = { val: values.reduce((sum, v) => sum + v.val, 0), at: Math.min(...values.map(v => v.at)),
        sourceAt: Math.min(...values.map(v => v.sourceAt)), category: values.every(v => v.category === 'safeZero') ? 'safeZero' : values[0].category === 'safeZero' ? 'realtime' : values[0].category,
        source: scopes.length === 1 ? 'single-outlet' : 'sum-of-outlets' };
    }
    return { result, connectorCount: this.ports.size, evseCount: scopes.length, topologySource: this.inventoryMismatch ? 'inventory-mismatch' : this.declared.size ? 'commissioned' : 'observed',
      status: preferredStatus(this.statuses.values()), active: [...this.transactions.values()].some(t => t.active),
      chargingState: preferredStatus([...this.transactions.values()].filter(t => t.active).map(t => t.state)) || (this.transactions.size ? 'Idle' : ''),
      allIdle: scopes.length > 0 && scopes.every(k => this.idle.has(k)) };
  }
}
function normalizeEosLimit(value, unit, phases, config = {}) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw new Error('Invalid charging limit');
  if (!['A','W'].includes(unit) || !Number.isInteger(phases) || phases < 1 || phases > 3) throw new Error('Invalid unit or phase count');
  const minA = Math.max(0, Number(config.minimumChargingCurrentA) || 6);
  // W is a hard ceiling, including for DC. No AC-voltage approximation.
  const voltage = Math.max(253, Number(config.maximumPhaseVoltageV) || 253);
  // The native chargeLimit DP is ALWAYS watts. An AC station needing amperes
  // uses a conservative voltage ceiling and the configured maximum phase count.
  // Floor, never round upwards. This assumes the commissioned AC topology.
  const amp = Math.floor(value / (voltage * phases) * 10) / 10;
  const effectiveLimit = unit === 'A' ? (amp < minA ? 0 : amp) : value;
  const effectiveLimitW = unit === 'A' ? effectiveLimit * voltage * phases : effectiveLimit;
  return { requestedLimit: value, effectiveLimit, effectiveLimitW, rateUnit: unit, phases, action: 'set', reason: value === 0 ? 'explicit-zero-ceiling' : unit === 'A' && effectiveLimit === 0 ? 'below-minimum-current-paused' : unit === 'A' ? 'watt-to-ampere-conservative' : 'accepted' };
}
function shouldSendLimit(previous, next, config = {}) {
  if (!previous || previous.action !== 'set' || previous.rateUnit !== next.rateUnit || previous.phases !== next.phases) return true;
  if (next.effectiveLimit < previous.effectiveLimit) return true;
  if (next.effectiveLimit === previous.effectiveLimit) return false;
  const db = next.rateUnit === 'A' ? Number(config.smartChargingDeadbandA ?? 0.2) : Number(config.smartChargingDeadbandW ?? 100);
  return next.effectiveLimit - previous.effectiveLimit >= Math.max(0, Number.isFinite(db) ? db : 0) || previous.effectiveLimit === 0;
}
module.exports = { StationTelemetry, isManaged, normalizeEosLimit, shouldSendLimit, scopeKey };
