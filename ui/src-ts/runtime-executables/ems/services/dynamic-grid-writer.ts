/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Schreibt herstellerunabhängige Speicher- und PV-Befehle der dynamischen Netzanschluss-App.
 * Daten und Wirkung: Wandelt Watt über explizite DP-Verträge in Rohwerte um, nutzt die bestehende DatapointRegistry und prüft jeden Einzelschritt gegen die aktuelle Schreibhoheit. Ein bestätigter Befehl ist keine gemessene Istwirkung.
 * Bei Änderungen: Split-Neutralisierung, Alias-/Einheitenvertrag, Generationenwechsel und alte Freigaben gemeinsam prüfen; nach fehlgeschlagenem Zwischenschritt niemals weiter freigeben.
 * Verknüpfungen: docs/dev/DYNAMIC_GRID_CONTRACT.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
'use strict';
declare const module: { exports: unknown };
declare function require(id: string): any;
type Dict = Record<string, any>;
const { DatapointRegistry } = require('../datapoints');
const { withActuatorShadowContext } = require('./actuator-shadow-arbiter');
const finite = (value: any): value is number => typeof value === 'number' && Number.isFinite(value);
const current = (guard: any) => typeof guard === 'function' && guard() === true;

/** Transport und DP-Rückmeldung bleiben getrennt. Ein Timeout startet keinen Hintergrund-Folgebefehl. */
async function bounded(work: Promise<any>, timeoutMs: number): Promise<any> {
  let timer: any;
  try { return await Promise.race([work, new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('io-timeout')), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}

class DynamicGridWriter {
  adapter: Dict;
  dp: any;
  bindings: Map<string, string>;
  timeoutMs: number;
  confirmations: Map<string, Dict>;
  inFlightWrites: Set<Promise<any>>;
  constructor(adapter: Dict, options: Dict = {}) {
    this.adapter = adapter;
    this.dp = new DatapointRegistry(adapter, []);
    this.bindings = new Map();
    this.confirmations = new Map();
    this.inFlightWrites = new Set();
    this.timeoutMs = finite(options.timeoutMs) ? Math.max(50, Math.min(2000, options.timeoutMs)) : 750;
  }

  hasPendingWrites(): boolean { return this.inFlightWrites.size > 0; }

  /** Explizite Skalierung W/Rohwert ist autoritativ; keine zweite automatische Einheitenumrechnung. */
  async configure(_config: Dict, _guard?: () => boolean): Promise<void> {}

  async binding(id: string, field: string, mapping: Dict, guard: () => boolean): Promise<string> {
    if (!mapping || typeof mapping.stateId !== 'string' || !mapping.stateId || !current(guard)) throw new Error('mapping-or-generation-invalid');
    const key = `dynamicGrid.${id}.${field}`;
    const fingerprint = JSON.stringify(mapping);
    if (this.bindings.get(key) === fingerprint) return key;
    const object = await bounded(this.adapter.getForeignObjectAsync(mapping.stateId), this.timeoutMs);
    if (!current(guard)) throw new Error('generation-changed');
    if (!object || object.type !== 'state' || object.common?.write !== true) throw new Error('output-not-writable');
    await bounded(this.dp.upsert({ key, objectId: mapping.stateId, direction: 'out', unit: '', scale: finite(mapping.scale) && mapping.scale > 0 ? mapping.scale : 1, offset: 0, invert: mapping.sign === -1, deadband: 0 }), this.timeoutMs);
    if (!current(guard)) throw new Error('generation-changed');
    this.bindings.set(key, fingerprint);
    return key;
  }

  /** Ein ACK=false-Echo des eigenen Sollwerts gilt ausdrücklich nicht als Gerätebestätigung. */
  async output(id: string, field: string, mapping: Dict, value: number | boolean, guard: () => boolean): Promise<Dict> {
    const result: Dict = { field, stateId: mapping?.stateId || '', accepted: false, commandConfirmed: false, writeIssued: false, applied: false, value, ts: Date.now() };
    try {
      if (!finite(value) && typeof value !== 'boolean') throw new Error('nonfinite-command');
      const key = await this.binding(id, field, mapping, guard);
      if (!current(guard)) throw new Error('generation-changed');
      const expected = typeof value === 'boolean' ? (mapping.sign === -1 ? !value : value) : value / (finite(mapping.scale) && mapping.scale > 0 ? mapping.scale : 1) * (mapping.sign === -1 ? -1 : 1);
      const matches = (feedback: Dict, after: number) => {
        const same = typeof expected === 'boolean' ? feedback?.val === expected : finite(feedback?.val) && Math.abs(feedback.val - expected) <= Math.max(1e-6, Math.abs(expected) * 1e-6);
        return same && feedback?.ack === true && (!('q' in feedback) || feedback.q === 0) && finite(feedback?.ts) && feedback.ts >= after && feedback.ts <= Date.now();
      };
      const previous = this.confirmations.get(key);
      const sameCommand = previous?.value === value && previous?.mapping === JSON.stringify(mapping);
      if (sameCommand) {
        const feedback = await bounded(this.adapter.getForeignStateAsync(mapping.readbackStateId || mapping.stateId), this.timeoutMs);
        if (!current(guard)) throw new Error('generation-changed');
        previous!.confirmed = matches(feedback, previous!.sentAt);
        const elapsed = Date.now() - previous!.sentAt;
        const confirmationTimeout = finite(mapping.commandTimeoutMs) ? mapping.commandTimeoutMs : 5000;
        const keepalive = finite(mapping.keepaliveMs) ? mapping.keepaliveMs : 1000;
        if ((!previous!.confirmed && elapsed < confirmationTimeout) || (previous!.confirmed && elapsed < keepalive)) {
          return { ...result, accepted: true, commandConfirmed: previous!.confirmed, ts: previous!.sentAt, reason: previous!.confirmed ? 'command-confirmed' : 'command-feedback-pending' };
        }
      }
      const sentAt = Date.now();
      if (this.hasPendingWrites()) throw new Error('previous-hardware-write-still-pending');
      // Vor Transportbeginn merken: ein Timeout lässt die Annahme offen.
      this.confirmations.set(key, { value, mapping: JSON.stringify(mapping), sentAt, confirmed: false });
      const physicalWrite = Promise.resolve(withActuatorShadowContext(this.adapter, { owner: id.startsWith('pv.') ? 'dynamicGridConnection.pv' : 'dynamicGridConnection', module: 'dynamicGridConnection', enforceAuthority: true, priority: 940, dynamicGridGuard: guard, reason: field, cycleId: this.adapter._nwActiveEmsCycleId }, () => {
        if (!current(guard)) return false;
        return typeof value === 'boolean' ? this.dp.writeBoolean(key, value, false) : this.dp.writeNumber(key, value, false);
      }));
      this.inFlightWrites.add(physicalWrite);
      physicalWrite.then(() => this.inFlightWrites.delete(physicalWrite), () => this.inFlightWrites.delete(physicalWrite));
      result.ts = sentAt;
      result.writeIssued = true;
      const written = await bounded(physicalWrite, this.timeoutMs);
      result.accepted = written !== false;
      if (!result.accepted) { this.confirmations.delete(key); result.writeIssued = false; throw new Error('write-rejected'); }
      if (!current(guard)) throw new Error('generation-changed-after-write');
      const feedback = await bounded(this.adapter.getForeignStateAsync(mapping.readbackStateId || mapping.stateId), this.timeoutMs);
      result.commandConfirmed = current(guard) && matches(feedback, sentAt);
      this.confirmations.get(key)!.confirmed = result.commandConfirmed;
      result.reason = result.commandConfirmed ? 'command-confirmed' : 'command-feedback-pending';
    } catch (error: any) { result.reason = String(error?.message || error); }
    return result;
  }

  async flag(id: string, field: string, mapping: Dict | undefined, enabled: boolean, guard: () => boolean): Promise<Dict | null> {
    if (!mapping) return null;
    const value = enabled ? mapping.onValue : mapping.offValue;
    return this.output(id, field, { ...mapping, scale: 1, sign: 1 }, value, guard);
  }

  /** EOS-Ziele: erst Gegenrichtung neutralisieren, dann Ziel und zuletzt Freigaben setzen. */
  async writeStorage(storage: Dict, command: Dict, guard: () => boolean): Promise<Dict> {
    const contract = storage.command || {};
    const result: Dict = { id: storage.id, accepted: false, commandConfirmed: false, applied: false, writes: [], reason: 'invalid-command', ts: Date.now() };
    const add = async (field: string, mapping: Dict, value: number | boolean) => {
      const write = await this.output(storage.id, field, { ...mapping, commandTimeoutMs: storage.commandTimeoutMs, keepaliveMs: contract.watchdog ? Math.max(100, contract.watchdog.ttlMs / 3) : 1000 }, value, guard);
      result.writes.push(write);
      if (!write.commandConfirmed) result.reason = write.reason;
      return write.commandConfirmed === true;
    };
    if (!current(guard)) { result.reason = 'generation-changed'; return result; }
    if (contract.mode === 'signedTarget' && finite(command.targetW)) {
      if (!await add('signedTarget', contract.signedTarget, command.targetW)) { result.accepted = result.writes.some((w: Dict) => w.accepted); return result; }
    } else if (contract.mode === 'splitTarget' && finite(command.targetW)) {
      const charging = command.targetW < 0;
      if (!await add(charging ? 'dischargeTarget' : 'chargeTarget', charging ? contract.dischargeTarget : contract.chargeTarget, 0)) { result.accepted = result.writes.some((w: Dict) => w.accepted); return result; }
      if (!await add(charging ? 'chargeTarget' : 'dischargeTarget', charging ? contract.chargeTarget : contract.dischargeTarget, Math.abs(command.targetW))) { result.accepted = result.writes.some((w: Dict) => w.accepted); return result; }
    } else if (contract.mode === 'externalLimits' && finite(command.minPowerW) && finite(command.maxPowerW) && command.minPowerW <= 0 && command.maxPowerW >= 0) {
      const values = [{ field: 'maxCharge', value: -command.minPowerW }, { field: 'maxDischarge', value: command.maxPowerW }];
      // Jede Verkürzung vor einer Erweiterung; der Solver reserviert dennoch die
      // Vereinigung von altem und neuem Korridor bis zum tatsächlichen Ablauf.
      values.sort((a, b) => Number(a.value > (command.previousLimits?.[a.field] ?? 0)) - Number(b.value > (command.previousLimits?.[b.field] ?? 0)));
      for (const item of values) if (!await add(item.field, contract[item.field], item.value)) { result.accepted = result.writes.some((w: Dict) => w.accepted); return result; }
      // Watchdog wird nach bestätigtem Limit aktualisiert, nicht vor einem
      // möglicherweise fehlgeschlagenen neuen Vertrag verlängert.
      const watchdog = contract.watchdog;
      if (watchdog?.stateId) {
        const value = watchdog.writeValue;
        if (!await add('watchdog', watchdog, value)) { result.accepted = true; return result; }
      }
    } else return result;
    for (const [field, enabled] of [['chargeEnable', finite(command.targetW) ? command.targetW < 0 : command.minPowerW < 0], ['dischargeEnable', finite(command.targetW) ? command.targetW > 0 : command.maxPowerW > 0], ['run', finite(command.targetW) ? command.targetW !== 0 : command.minPowerW < 0 || command.maxPowerW > 0]] as Array<[string, boolean]>) {
      const write = await this.flag(storage.id, field, contract[field], enabled, guard);
      if (write) { result.writes.push(write); if (!write.commandConfirmed) { result.accepted = result.writes.some((w: Dict) => w.accepted); result.reason = write.reason; return result; } }
    }
    result.accepted = true;
    result.commandConfirmed = true;
    result.reason = 'command-confirmed-awaiting-measurement';
    return result;
  }

  /** Ein finaler PV-Erzeugungsgrenzwert, niemals ein als Erzeugung ausgegebener Exportgrenzwert. */
  async writePv(pv: Dict, limitW: number, guard: () => boolean): Promise<Dict> {
    const mapping = pv.command || pv.generationLimit;
    if (!finite(limitW) || limitW < 0 || !finite(pv.referencePowerW) || pv.referencePowerW <= 0) return { accepted: false, commandConfirmed: false, applied: false, reason: 'invalid-pv-command', writes: [], ts: Date.now() };
    const value = mapping?.unit === '%' ? Math.min(100, limitW / pv.referencePowerW * 100) : Math.min(pv.referencePowerW, limitW);
    const write = await this.output(`pv.${pv.id}`, 'generationLimit', mapping, value, guard);
    return { ...write, id: pv.id, limitW, writes: [write] };
  }
}
module.exports = { DynamicGridWriter };
