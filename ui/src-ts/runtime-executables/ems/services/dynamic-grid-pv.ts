/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Führt lokale und übergeordnete PV-Grenzen sowie vorhandene EVU-Stufen zu genau einem Generation-Sollwert je zugeordnetem Wechselrichter zusammen.
 * Daten und Wirkung: Frische Messungen in W, generische DP-Verträge und reservierte Speicherintervalle hinein; getrennte Rechenpläne und bewachte Schreibaufträge hinaus.
 * Bei Änderungen: M0 enthält M1 bereits. Ladefreigaben sind keine garantierten Senken, Generation-Obergrenzen keine Mindestproduktion und Schreib-ACKs keine physische Wirkung.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/ems/services/dynamic-grid-pv.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
'use strict';

declare const module: { exports: unknown };
declare function require(id: string): any;
type Dict = Record<string, any>;
const { affectsPoint, readMeasurement, collectSnapshot } = require('./nvp-topology');
const { operatingLimits, computePvLimit } = require('./nvp-budget');
const { resolveZeroExportPvTarget } = require('./grid-import-limit-policy');
const { dynamicGridHasControl } = require('./dynamic-grid-ownership');
const { getAcceptedPowerEffectSnapshot } = require('./accepted-power-effects');
const finite = (value: any): value is number => typeof value === 'number' && Number.isFinite(value);
const record = (value: any): value is Dict => value !== null && typeof value === 'object' && !Array.isArray(value);
const identifier = (value: any) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value);
const stateId = (value: any) => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 512 && !/[\x00-\x1f\x7f]/.test(value);
const fresh = (value: any, now: number, maxAgeMs: number) => record(value) && value.valid === true && finite(value.ts) && value.ts > 0 && value.ts <= now && now - value.ts <= maxAgeMs;
const readsInFlight = new WeakMap<object, Promise<Dict>>();

/** Die vorhandene Mesh-Vertragsprüfung liefert aktuelle Kategorie- und Standortgrenzen. Ein fehlerhafter erforderlicher Vertrag eröffnet keinen neuen PV-Spielraum. */
function currentDynamicPvMesh(adapter: Dict): Dict {
  if (typeof adapter?._meshCoordinator?.currentLimits !== 'function') return { required: false };
  try { return adapter._meshCoordinator.currentLimits() || { required: false }; }
  catch { return { required: true, limits: { pvW: 0, exportW: 0 } }; }
}

/** Begrenzt den EMS-Warteweg auf 1500 ms. Ein nicht abbrechbarer ioBroker-Auftrag behält seinen Slot bis zum tatsächlichen Abschluss; kein wachsender Ersatzauftrag-Stapel. */
async function readDynamicPvStates(adapter: Dict, ids: string[], timeoutMs = 1500): Promise<Dict> {
  if (readsInFlight.has(adapter)) return { valid: false, reason: 'measurement-read-busy' };
  const job = Promise.resolve().then(() => adapter.getForeignStatesAsync(ids));
  readsInFlight.set(adapter, job);
  const release = () => { if (readsInFlight.get(adapter) === job) readsInFlight.delete(adapter); };
  void job.then(release, release);
  let timer: any;
  try {
    const limit = finite(timeoutMs) ? Math.max(50, Math.min(1500, timeoutMs)) : 1500;
    const result = await Promise.race([job, new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('measurement-read-timeout')), limit); })]);
    return record(result) ? { valid: true, states: result } : { valid: false, reason: 'measurement-read-invalid' };
  } catch (error: any) { return { valid: false, reason: error?.message === 'measurement-read-timeout' ? 'measurement-read-timeout' : 'measurement-read-failed' }; }
  finally { clearTimeout(timer); }
}

/** Spiegelt ausschließlich die tatsächlich schreibenden Zero-Export-Gates des Bestands. Separate EVU-Ausgänge bleiben außerhalb dieser Übernahmeprüfung. */
function requiredLegacyPvTargets(rootConfig: Dict): Dict[] {
  const cfg = record(rootConfig?.gridConstraints) ? rootConfig.gridConstraints : {};
  if (cfg.zeroExportEnabled !== true) return [];
  const approved = typeof cfg.exportLimitInstallerApproved === 'boolean' ? cfg.exportLimitInstallerApproved
    : typeof cfg.zeroExportInstallerApproved === 'boolean' ? cfg.zeroExportInstallerApproved : true;
  if (!approved) return [];
  const mode = String(cfg.exportLimitRunMode ?? cfg.zeroExportRunMode ?? cfg.exportGuardMode ?? 'active').trim().toLowerCase();
  if (['diagnostic', 'test', 'dryrun', 'dry-run', 'simulation'].includes(mode)) return [];
  const output: Dict[] = [];
  const add = (raw: any, kind: string, path: string) => {
    if (typeof raw === 'string' && stateId(raw.trim())) output.push({ stateId: raw.trim(), kind, path });
  };
  if (Array.isArray(cfg.pvCurtailInvertersZero) && cfg.pvCurtailInvertersZero.length > 0) {
    cfg.pvCurtailInvertersZero.forEach((row: any, index: number) => {
      if (!record(row)) return;
      for (const [field, kind] of [['feedInLimitWId', 'export'], ['pvLimitWId', 'generationW'], ['pvLimitPctId', 'generationPct']] as const) add(row[field], kind, `gridConstraints.pvCurtailInvertersZero[${index}].${field}`);
    });
  } else {
    let controlMode = String(cfg.pvCurtailMode || 'auto');
    if (controlMode === 'auto') controlMode = cfg.pvFeedInLimitWId ? 'feedInLimitW' : cfg.pvLimitWId ? 'pvLimitW' : cfg.pvLimitPctId ? 'pvLimitPct' : 'off';
    if (controlMode === 'feedInLimitW') add(cfg.pvFeedInLimitWId, 'export', 'gridConstraints.pvFeedInLimitWId');
    if (controlMode === 'pvLimitW') add(cfg.pvLimitWId, 'generationW', 'gridConstraints.pvLimitWId');
    if (controlMode === 'pvLimitPct') add(cfg.pvLimitPctId, 'generationPct', 'gridConstraints.pvLimitPctId');
  }
  return output;
}

/** Liefert nur die aktiven Bestandsausgänge, die vor Übernahme des finalen PV-Slots geprüft werden müssen. */
function extractRequiredLegacyDynamicPvIds(rootConfig: Dict): string[] {
  return [...new Set(requiredLegacyPvTargets(rootConfig).map(row => row.stateId))];
}

/**
 * Verhindert, dass die App eine bisher aktive Zero-Export-Stellstrecke lautlos
 * entfernt. Der Backend-Resolver vergleicht terminale Alias-WRITE-Identitäten;
 * kein Herstellername und keine optionale reine EVU-Zuordnung ist erforderlich.
 */
function validateLegacyDynamicPvCoverage(rootConfig: Dict, pvAssignments: Dict[], options: Dict = {}): Dict {
  const errors: Dict[] = [], required = requiredLegacyPvTargets(rootConfig);
  const physical = (id: string): string | null => {
    if (typeof options.resolveWriteId !== 'function') return id;
    try { const value = options.resolveWriteId(id); return typeof value === 'string' && value.trim() ? value.trim() : null; } catch { return null; }
  };
  const assigned = new Set((Array.isArray(pvAssignments) ? pvAssignments : []).map(pv => stateId(pv.command?.stateId) ? physical(pv.command.stateId) : null).filter(Boolean));
  for (const target of required) {
    const id = physical(target.stateId);
    if (!id) errors.push({ path: target.path, code: 'legacy-pv-output-unresolved', message: `Der bisher aktive PV-Ausgang „${target.stateId}“ konnte nicht eindeutig aufgelöst werden. Vor dem Appwechsel die vorhandene PV-Zuordnung prüfen.` });
    else if (target.kind === 'export') errors.push({ path: target.path, code: 'legacy-pv-export-limit-semantic', message: `Der bisher aktive Ausgang „${target.stateId}“ ist eine Netzexportgrenze, kein PV-Erzeugungslimit. Für den Appwechsel die bisherige PV-Regelung auf einen geeigneten Erzeugungslimit-Ausgang umstellen und diesen in der App „Dynamischer Netzanschluss“ zuordnen.` });
    else if (!assigned.has(id)) errors.push({ path: target.path, code: 'legacy-pv-assignment-required', message: `Der bisher aktive PV-Ausgang „${target.stateId}“ fehlt in der App „Dynamischer Netzanschluss“. Diesen Ausgang dort einem PV-Wechselrichter mit Istleistung und Anschlussbereich zuordnen, damit die vorhandene Einspeisebegrenzung beim Aktivieren erhalten bleibt.` });
  }
  return { valid: errors.length === 0, errors, requiredIds: [...new Set(required.map(row => row.stateId))] };
}

/** Validiert freie, herstellerunabhängige Generation-DPs. Exportlimit-DPs haben einen anderen Vertrag und sind hier ausdrücklich keine Generation-Ausgänge. */
function validateDynamicPvAssignments(raw: any, options: Dict = {}): Dict {
  const errors: Dict[] = [], activationErrors: Dict[] = [], warnings: Dict[] = [], pvAssignments: Dict[] = [];
  const add = (path: string, code: string, message: string) => errors.push({ path, code, message });
  const required = (path: string, code: string, message: string) => activationErrors.push({ path, code, message });
  const missing = (value: any) => value === undefined || value === null || value === '';
  if (raw === undefined) return { valid: true, pvAssignments, errors, activationErrors, warnings };
  if (!Array.isArray(raw) || raw.length > 64) return { valid: false, pvAssignments, errors: [{ path: 'pvAssignments', code: 'array', message: 'Höchstens 64 PV-Zuordnungen sind zulässig.' }], warnings };
  const ids = new Set<string>(), outputs = new Set<string>(), measurements = new Set<string>();
  const identity = (id: string, write = false) => {
    const resolve = write ? options.resolveWriteId || options.resolveSourceId : options.resolveSourceId;
    if (typeof resolve !== 'function') return id;
    try { return resolve(id) || id; } catch { return id; }
  };
  raw.forEach((entry: any, index: number) => {
    const path = `pvAssignments[${index}]`;
    if (!record(entry)) { add(path, 'object', 'PV-Zuordnung muss ein Objekt sein.'); return; }
    const row: Dict = { id: entry.id, connectionPointId: entry.connectionPointId, referencePowerW: entry.referencePowerW, evuControl: entry.evuControl === true };
    if (!identifier(row.id) || ids.has(row.id)) add(`${path}.id`, 'pv-id', 'Eindeutige PV-Kennung erforderlich.');
    ids.add(row.id);
    if (!['M0', 'M1'].includes(row.connectionPointId)) add(`${path}.connectionPointId`, 'point-id', 'PV-Anschlussbereich muss M0 oder M1 sein.');
    if (missing(row.referencePowerW)) required(`${path}.referencePowerW`, 'reference-power-required', 'Positive AC-Bezugsleistung in W fehlt.');
    else if (!finite(row.referencePowerW) || row.referencePowerW <= 0 || row.referencePowerW > 1000000000) add(`${path}.referencePowerW`, 'reference-power', 'Positive AC-Bezugsleistung in W erforderlich.');
    if (entry.evuControl !== undefined && typeof entry.evuControl !== 'boolean') add(`${path}.evuControl`, 'boolean', 'EVU-Zuordnung muss true oder false sein.');
    const measurement = entry.powerMeasurement;
    if (missing(measurement)) required(`${path}.powerMeasurement`, 'measurement', 'PV-Istleistungszuordnung fehlt.');
    else if (!record(measurement)) add(`${path}.powerMeasurement`, 'measurement', 'PV-Istleistungszuordnung muss ein Objekt sein.');
    else {
      row.powerMeasurement = { stateId: measurement.stateId, unit: measurement.unit, sign: measurement.sign, maxAgeMs: measurement.maxAgeMs };
      if (missing(measurement.stateId)) required(`${path}.powerMeasurement.stateId`, 'stateId', 'PV-Messdatenpunkt fehlt.');
      else if (!stateId(measurement.stateId)) add(`${path}.powerMeasurement.stateId`, 'stateId', 'Gültiger PV-Messdatenpunkt erforderlich.');
      if (!['W', 'kW'].includes(measurement.unit) || ![1, -1].includes(measurement.sign) || !finite(measurement.maxAgeMs) || measurement.maxAgeMs <= 0 || measurement.maxAgeMs > 60000) add(`${path}.powerMeasurement`, 'measurement-contract', 'PV-Messung benötigt W/kW, Vorzeichen und eine Frischegrenze bis 60000 ms.');
      if (stateId(measurement.stateId)) {
        const physicalId = identity(measurement.stateId);
        if (measurements.has(physicalId)) add(`${path}.powerMeasurement`, 'duplicate-pv-measurement', 'Eine PV-Istleistung darf nicht doppelt bilanziert werden.');
        measurements.add(physicalId);
      }
    }
    const command = entry.command;
    if (missing(command)) required(`${path}.command`, 'command', 'Ein Generation-Sollwertdatenpunkt fehlt.');
    else if (!record(command)) add(`${path}.command`, 'command', 'Generation-Sollwertzuordnung muss ein Objekt sein.');
    else {
      row.command = { stateId: command.stateId, unit: command.unit, scale: command.scale === undefined ? 1 : command.scale };
      if (missing(command.stateId)) required(`${path}.command.stateId`, 'stateId', 'PV-Schreibdatenpunkt fehlt.');
      else if (!stateId(command.stateId)) add(`${path}.command.stateId`, 'stateId', 'Gültiger PV-Schreibdatenpunkt erforderlich.');
      if (!['W', '%'].includes(command.unit)) add(`${path}.command.unit`, 'generation-unit', 'Generation-Sollwert muss W oder % sein; eine Exportgrenze ist kein Generation-Sollwert.');
      if (!finite(row.command.scale) || row.command.scale <= 0 || row.command.scale > 1000000) add(`${path}.command.scale`, 'scale', 'Positive Sollwert-Skalierung erforderlich.');
      if (command.readbackStateId !== undefined && command.readbackStateId !== '') {
        if (!stateId(command.readbackStateId)) add(`${path}.command.readbackStateId`, 'stateId', 'Ungültiger Sollwert-Rückmeldedatenpunkt.');
        else row.command.readbackStateId = command.readbackStateId;
      }
      if (stateId(command.stateId)) {
        const physicalId = identity(command.stateId, true);
        if (outputs.has(physicalId)) add(`${path}.command`, 'duplicate-pv-output', 'Ein physischer Generation-Ausgang darf nur eine PV-Zuordnung besitzen.');
        outputs.add(physicalId);
      }
    }
    pvAssignments.push(row);
  });
  return { valid: errors.length === 0 && (options.active === false || activationErrors.length === 0), pvAssignments, errors, activationErrors, warnings };
}

/** Ergänzt einen kohärenten M0/M1-/Speicherzyklus um getrennte PV-Istwerte; weder null noch alte Werte werden zu 0 W umgedeutet. */
function collectDynamicPvSnapshot(config: Dict, states: Dict, now = Date.now(), baseSnapshot?: Dict): Dict {
  const base = baseSnapshot || collectSnapshot(config, states, now);
  const pv: Dict = Object.create(null), errors: Dict[] = [...(base.errors || [])];
  const timestamps: number[] = [];
  for (const group of [base.points, base.storages]) for (const sample of Object.values(group || {}) as Dict[]) if (sample.valid && finite(sample.ts)) timestamps.push(sample.ts);
  for (const row of config.pvAssignments || []) {
    const sample = readMeasurement(row.powerMeasurement, states[row.powerMeasurement.stateId], now);
    if (sample.valid && sample.valueW < 0) { sample.valid = false; sample.reason = 'negative-generation'; sample.valueW = null; }
    pv[row.id] = sample;
    if (sample.valid) timestamps.push(sample.ts);
    else errors.push({ path: `pv.${row.id}`, code: sample.reason, message: `${row.id}: PV-Istleistung ist nicht verwendbar (${sample.reason}).` });
  }
  const skewMs = timestamps.length ? Math.max(...timestamps) - Math.min(...timestamps) : null;
  if (!finite(skewMs) || skewMs > config.maxSkewMs) errors.push({ path: 'measurements', code: 'skew', message: 'PV und Bereichsmessungen stammen nicht aus einem kohärenten Messzyklus.' });
  return { ...base, valid: base.valid === true && errors.length === 0, pv, errors, skewMs, ts: now };
}

/** Vorhandene EVU-Relais gelten nur für ausdrücklich zugeordnete PV. Ein fehlendes/veraltetes Relais ergibt niemals stillschweigend 100 %. */
function readDynamicEvuLimits(config: Dict, rootConfig: Dict, states: Dict, now = Date.now()): Dict {
  const cfg = rootConfig.gridConstraints || {}, result: Dict = Object.create(null);
  const maxAgeMs = finite(cfg.staleTimeoutSec) && cfg.staleTimeoutSec > 0 ? Math.min(60000, cfg.staleTimeoutSec * 1000) : 15000;
  for (const pv of config.pvAssignments || []) {
    if (pv.evuControl !== true || cfg.pvEvuEnabled !== true) { result[pv.id] = { valid: true, limitW: pv.referencePowerW, stagePct: 100, reason: 'evu-not-assigned' }; continue; }
    let stagePct = 100, valid = true, configured = 0;
    for (const stage of [60, 30, 0]) {
      const id = cfg[`pvEvuRelay${stage}Id`];
      if (!stateId(id)) continue;
      configured++;
      const state = states[id];
      if (!record(state) || ![true, false, 0, 1].includes(state.val) || !finite(state.ts) || state.ts <= 0 || state.ts > now || now - state.ts > maxAgeMs || (state.q !== undefined && state.q !== 0) || state.connected === false) { valid = false; continue; }
      if (state.val === true || state.val === 1) stagePct = Math.min(stagePct, stage);
    }
    valid = valid && configured > 0;
    result[pv.id] = { valid, limitW: valid ? pv.referencePowerW * stagePct / 100 : null, stagePct: valid ? stagePct : null, reason: valid ? 'evu-stage' : 'evu-unavailable' };
  }
  return result;
}

/**
 * Berechnet ein gemeinsames Generation-Maximum. Vorzeichen: Bezug und Speicherentladung positiv.
 * Für jeden Punkt: Rest ohne PV = Netz-Ist + enthaltene PV-Ist - (maximale Speicherentladung - Speicher-Ist).
 * Erst M1, dann M0 begrenzen; der M1-Wert wird dabei nie zum M0-Wert addiert.
 * Die alte/neue Speicherintervallhülle verhindert eine Freigabe aus bloß erlaubter Ladung.
 */
function planDynamicPv(config: Dict, snapshot: Dict, options: Dict = {}): Dict {
  const now = finite(options.nowMs) ? options.nowMs : Date.now();
  const errors: Dict[] = [], requests: Dict[] = [], points: Dict[] = [];
  const out: Dict = { valid: false, status: 'measurement_invalid', applied: false, requests, points, errors, ts: now, configVersion: config.configVersion };
  if (!snapshot || snapshot.valid !== true || snapshot.configVersion !== config.configVersion) return { ...out, errors: [{ code: 'snapshot-invalid', message: 'Kein aktueller kohärenter Messzyklus.' }] };
  const otherEffects = (Array.isArray(options.otherEffects) ? options.otherEffects : []).filter((effect: Dict) => effect.accepted === true && !String(effect.key || '').startsWith('dynamicGrid.'));
  if (otherEffects.some((effect: Dict) => effect.uncertain === true || !finite(effect.netLoadDeltaW))) return { ...out, status: 'other_actuator_transition', errors: [{ code: 'other-actuator-uncertain', message: 'Ein anderer Aktor hat eine noch nicht messbar begrenzte Wirkung.' }] };
  const intervals = Array.isArray(options.pendingIntervals) ? options.pendingIntervals : [];
  const byId = new Map<string, Dict>();
  for (const interval of intervals) {
    if (!record(interval) || byId.has(interval.id) || !finite(interval.minPowerW) || !finite(interval.maxPowerW) || interval.minPowerW > interval.maxPowerW) return { ...out, errors: [{ code: 'storage-interval-invalid', message: 'Speicherübergang ist nicht eindeutig begrenzt.' }] };
    byId.set(interval.id, interval);
  }
  for (const point of config.points || []) if (!fresh(snapshot.points?.[point.id], now, point.measurement.maxAgeMs)) errors.push({ code: 'point-stale', pointId: point.id });
  for (const storage of config.storages || []) {
    const sample = snapshot.storages?.[storage.id], interval = byId.get(storage.id);
    if (!fresh(sample, now, storage.powerMeasurement.maxAgeMs) || !interval || interval.connectionPointId !== storage.connectionPointId) errors.push({ code: 'storage-interval-unavailable', storageId: storage.id });
  }
  for (const pv of config.pvAssignments || []) if (!fresh(snapshot.pv?.[pv.id], now, pv.powerMeasurement.maxAgeMs) || !finite(snapshot.pv?.[pv.id]?.valueW) || snapshot.pv[pv.id].valueW < 0) errors.push({ code: 'pv-stale', pvId: pv.id });
  if (errors.length) return out;
  const previous = record(options.previousCaps) ? options.previousCaps : {};
  const evu = record(options.evuLimits) ? options.evuLimits : {};
  const mesh = record(options.meshLimits) ? options.meshLimits : {};
  const meshPvW = mesh.required === true ? (finite(mesh.limits?.pvW) ? Math.max(0, mesh.limits.pvW) : 0) : null;
  const meshExportW = mesh.required === true ? (finite(mesh.limits?.exportW) ? Math.max(0, mesh.limits.exportW) : 0) : null;
  for (const pv of config.pvAssignments || []) {
    const evuLimit = evu[pv.id];
    const previousW = finite(previous[pv.id]) ? previous[pv.id] : null;
    // Ein unbekanntes EVU-Signal darf den letzten übernommenen Wert nur halten
    // oder reduzieren. Beim Erststart ist ohne gültige Stufe kein Auftrag erlaubt.
    if (!evuLimit || evuLimit.valid !== true) {
      if (previousW === null) { errors.push({ code: 'evu-unavailable', pvId: pv.id }); continue; }
      requests.push({ id: pv.id, connectionPointId: pv.connectionPointId, limitW: previousW, reason: 'evu-stale-hold', evuStale: true });
    } else {
      const merged = computePvLimit({ deviceMaxW: pv.referencePowerW, requirements: [{ valid: true, kind: 'generation', source: 'evu', limitW: evuLimit.limitW }] });
      if (!merged.valid) errors.push({ code: 'evu-invalid', pvId: pv.id });
      else requests.push({ id: pv.id, connectionPointId: pv.connectionPointId, limitW: merged.limitW, reason: 'device-evu', evuStale: false });
    }
    if (options.handover === true) {
      const request = requests.find(row => row.id === pv.id);
      if (request) {
        request.limitW = Math.min(request.limitW, previousW === null ? snapshot.pv[pv.id].valueW : previousW);
        request.reason += ',handover-hold';
      }
    }
  }
  if (errors.length) return { ...out, status: 'evu_unavailable' };
  for (const pointId of ['M1', 'M0']) {
    const point = (config.points || []).find((entry: Dict) => entry.id === pointId);
    if (!point) { errors.push({ code: 'point-missing', pointId }); continue; }
    const limits = operatingLimits(point);
    if (!limits.valid) { errors.push({ code: 'point-limits-invalid', pointId }); continue; }
    if (pointId === 'M0' && meshExportW !== null) limits.exportLimitW = Math.min(limits.exportLimitW, meshExportW);
    const localPv = (config.pvAssignments || []).filter((pv: Dict) => affectsPoint(pv.connectionPointId, pointId));
    const actualPvW = localPv.reduce((sum: number, pv: Dict) => sum + snapshot.pv[pv.id].valueW, 0);
    let exportGridW = snapshot.points[pointId].valueW, importGridW = snapshot.points[pointId].valueW;
    for (const effect of otherEffects) {
      // Ohne eigene Bereichszuordnung ist für M1 wie M0 die jeweils ungünstige
      // Möglichkeit reserviert. Zusätzliche Last ist keine garantierte PV-Senke.
      exportGridW += Math.min(0, effect.netLoadDeltaW);
      importGridW += Math.max(0, effect.netLoadDeltaW);
    }
    for (const storage of config.storages || []) {
      if (!affectsPoint(storage.connectionPointId, pointId)) continue;
      const interval = byId.get(storage.id)!, actualW = snapshot.storages[storage.id].valueW;
      exportGridW -= Math.max(interval.maxPowerW, actualW) - actualW;
      importGridW -= Math.min(interval.minPowerW, actualW) - actualW;
    }
    const rows = requests.filter(row => affectsPoint(row.connectionPointId, pointId));
    const currentCapW = rows.reduce((sum, row) => sum + row.limitW, 0);
    const referenceW = localPv.reduce((sum: number, pv: Dict) => sum + pv.referencePowerW, 0);
    const target = limits.exportLimitW === null ? { targetW: referenceW, usable: true } : resolveZeroExportPvTarget({ ratedPvW: referenceW, pvActualW: actualPvW, projectedNvpW: exportGridW, targetNvpW: -limits.exportLimitW, storageActualW: 0, storageTargetW: 0 });
    if (!target.usable || !finite(target.targetW)) { errors.push({ code: 'point-generation-invalid', pointId }); continue; }
    let maxGenerationW = Math.floor(Math.max(0, limits.exportLimitW === null ? target.targetW : Math.min(target.targetW, actualPvW + exportGridW + limits.exportLimitW)));
    // Mesh-pvW ist eine gemeinsame Kategoriegrenze, kein Budget pro Gerät.
    if (pointId === 'M0' && meshPvW !== null) maxGenerationW = Math.min(maxGenerationW, Math.floor(meshPvW));
    if (currentCapW > maxGenerationW && currentCapW > 0) for (const row of rows) {
      row.limitW = Math.max(0, Math.floor(row.limitW * maxGenerationW / currentCapW));
      row.reason = `${row.reason},${pointId}-export`;
    }
    const sumCapsW = rows.reduce((sum, row) => sum + row.limitW, 0);
    const minimumGridW = exportGridW + actualPvW - sumCapsW;
    // PV ist auch bei hohem Sollwert keine garantierte Quelle. Diese Grenze
    // beschreibt deshalb zusätzlich den vollständigen Generation-Ausfall.
    const maximumGridW = importGridW + actualPvW;
    const exportViolationW = limits.exportLimitW === null ? 0 : Math.max(0, -limits.exportLimitW - minimumGridW);
    const importViolationW = limits.importLimitW === null ? 0 : Math.max(0, maximumGridW - limits.importLimitW);
    points.push({ id: pointId, actualPvW, maxGenerationW, minimumGridW, maximumGridW, exportViolationW, importViolationW, ...(pointId === 'M0' ? { meshPvW, meshExportW } : {}) });
  }
  if (errors.length) return { ...out, status: 'configuration_invalid' };
  const residualViolation = points.some(point => point.exportViolationW > 0 || point.importViolationW > 0);
  return { ...out, valid: true, status: residualViolation ? 'residual_limit_violation' : requests.some(row => row.evuStale) ? 'evu_stale_hold' : 'ready', residualViolation };
}

/** Zustand der separaten App verhindert den Rückfall auf einen konkurrierenden globalen PV-Regler während Initialisierung oder Fehlern. */
function dynamicPvOwnsCycle(adapter: Dict): boolean {
  return dynamicGridHasControl(adapter);
}

/**
 * Finaler PV-Slot nach der Speicherregelung. Liest nochmals alle Istwerte;
 * jede einzelne Ausgabe prüft den gleichen Generation-/Konfigurationszaun wie
 * der Speicherwriter. Übernommene Befehle werden niemals als angewandt gemeldet.
 */
async function runDynamicGridPv(adapter: Dict, options: Dict = {}): Promise<Dict> {
  const runtime = adapter._nwDynamicGridConnectionRuntime;
  const previous = adapter._nwDynamicGridPvRuntime;
  const stopped = (reason: string) => {
    const output = { action: 'dynamic-pv-hold', status: reason, applied: false, accepted: false, results: [], pendingEffects: previous?.pendingEffects || [], acceptedCaps: previous?.acceptedCaps || {}, pendingCaps: previous?.pendingCaps || {}, configVersion: previous?.configVersion, ts: Date.now() };
    adapter._nwDynamicGridPvRuntime = output;
    return output;
  };
  if (!runtime || runtime.active !== true || typeof runtime.isCurrent !== 'function' || !runtime.isCurrent() || !runtime.writer || typeof runtime.writer.writePv !== 'function') return stopped('runtime-unavailable');
  const config = runtime.config;
  if (!(config.pvAssignments || []).length) {
    const empty = { ...stopped('no-pv-assigned'), action: 'dynamic-pv-off', configVersion: config.configVersion, pendingEffects: [], acceptedCaps: {} };
    adapter._nwDynamicGridPvRuntime = empty; return empty;
  }
  const ids = new Set<string>();
  if (Array.isArray(runtime.measurementIds)) for (const id of runtime.measurementIds) if (stateId(id)) ids.add(id);
  for (const point of config.points || []) if (stateId(point.measurement?.stateId)) ids.add(point.measurement.stateId);
  for (const storage of config.storages || []) ids.add(storage.powerMeasurement.stateId);
  for (const pv of config.pvAssignments || []) ids.add(pv.powerMeasurement.stateId);
  const evuCfg = adapter.config.gridConstraints || {};
  const evuFingerprint = JSON.stringify(evuCfg);
  for (const stage of [60, 30, 0]) if (stateId(evuCfg[`pvEvuRelay${stage}Id`])) ids.add(evuCfg[`pvEvuRelay${stage}Id`]);
  const read = await readDynamicPvStates(adapter, [...ids], options.readTimeoutMs);
  if (!read.valid) return stopped(read.reason);
  const states: Dict = read.states;
  if (!runtime.isCurrent()) return stopped('configuration-changed');
  const now = Date.now();
  const base = typeof runtime.collectSnapshot === 'function' ? runtime.collectSnapshot(states, now) : undefined;
  const snapshot = collectDynamicPvSnapshot(config, states || {}, now, base);
  const acceptedCaps: Dict = previous?.configVersion === config.configVersion && record(previous.acceptedCaps) ? { ...previous.acceptedCaps } : {};
  const pendingCaps: Dict = previous?.configVersion === config.configVersion && record(previous.pendingCaps) ? { ...previous.pendingCaps } : {};
  for (const pv of config.pvAssignments || []) if (!finite(pendingCaps[pv.id])) pendingCaps[pv.id] = pv.referencePowerW;
  const effects = () => (config.pvAssignments || []).map((pv: Dict) => {
    const actualW = snapshot.pv[pv.id]?.valid === true ? snapshot.pv[pv.id].valueW : null;
    return { id: pv.id, connectionPointId: pv.connectionPointId, actualW, minGenerationW: 0, maxGenerationW: finite(actualW) ? Math.max(actualW, pendingCaps[pv.id]) : pendingCaps[pv.id], ts: now };
  });
  const evuLimits = readDynamicEvuLimits(config, adapter.config, states || {}, now);
  const planOptions = { nowMs: now, pendingIntervals: runtime.pendingIntervals, previousCaps: acceptedCaps, evuLimits, otherEffects: getAcceptedPowerEffectSnapshot(adapter).entries, meshLimits: currentDynamicPvMesh(adapter), handover: runtime.handover === true };
  const plan = planDynamicPv(config, snapshot, planOptions);
  const results: Dict[] = [];
  // Eine eindeutig frische EVU-Einschränkung bleibt auch bei ausgefallenen
  // Netz-/PV-Messungen wirksam. Das ist ausschließlich ein strengerer bekannter
  // Generation-Cap; aus unbekanntem Altwert ist nur die explizite 0-%-Stufe sicher.
  const finalRequests = plan.valid ? plan.requests : (config.pvAssignments || []).filter((pv: Dict) => pv.evuControl === true
    && evuLimits[pv.id]?.valid === true
    && (evuLimits[pv.id].limitW === 0 || (finite(acceptedCaps[pv.id]) && evuLimits[pv.id].limitW < acceptedCaps[pv.id])))
    .map((pv: Dict) => ({ id: pv.id, limitW: evuLimits[pv.id].limitW, evuOnly: true }));
  for (const request of finalRequests) {
    if (!runtime.isCurrent()) break;
    const pv = config.pvAssignments.find((row: Dict) => row.id === request.id);
    const measurementFence = () => {
      const at = Date.now();
      if (!runtime.isCurrent() || JSON.stringify(adapter.config.gridConstraints || {}) !== evuFingerprint) return false;
      const evuNow = readDynamicEvuLimits(config, adapter.config, states || {}, at)[pv.id];
      const meshNow = currentDynamicPvMesh(adapter);
      if (request.evuOnly === true) {
        const totalReferenceW = config.pvAssignments.reduce((sum: number, row: Dict) => sum + row.referencePowerW, 0);
        const allocatedMeshW = meshNow.required === true ? (finite(meshNow.limits?.pvW) ? Math.max(0, meshNow.limits.pvW) * pv.referencePowerW / totalReferenceW : 0) : pv.referencePowerW;
        return evuNow?.valid === true && request.limitW <= evuNow.limitW && request.limitW <= allocatedMeshW;
      }
      if (evuNow?.valid !== true && !(finite(acceptedCaps[pv.id]) && request.limitW <= acceptedCaps[pv.id])) return false;
      // Mesh kann auch innerhalb eines Geräte-await strenger werden. Der
      // Finalguard berechnet die gemeinsame Grenze neu und verwirft jede nun
      // unzulässige Einzelvorgabe, statt den alten Plan weiterzuschreiben.
      const livePlan = planDynamicPv(config, snapshot, { ...planOptions, nowMs: at, meshLimits: meshNow, handover: runtime.handover === true });
      const liveRequest = livePlan.valid && livePlan.requests.find((row: Dict) => row.id === pv.id);
      if (!liveRequest || request.limitW > liveRequest.limitW) return false;
      return fresh(snapshot.pv[pv.id], at, pv.powerMeasurement.maxAgeMs)
        && config.points.every((point: Dict) => fresh(snapshot.points[point.id], at, point.measurement.maxAgeMs))
        && config.storages.every((storage: Dict) => fresh(snapshot.storages[storage.id], at, storage.powerMeasurement.maxAgeMs));
    };
    let result: Dict;
    // Eine vorübergehend fehlgeschlagene Antwort schließt einen später wirksam
    // werdenden Write nicht aus. Neue mögliche Generation deshalb VOR await
    // reservieren und bis zur expliziten Cap-Rückmeldung nicht wieder freigeben.
    pendingCaps[pv.id] = Math.max(pendingCaps[pv.id], request.limitW);
    adapter._nwDynamicGridPvRuntime = { status: 'writing', applied: false, configVersion: config.configVersion, pendingEffects: effects(), acceptedCaps: { ...acceptedCaps }, pendingCaps: { ...pendingCaps }, generation: runtime.generation, ts: now };
    try { result = await runtime.writer.writePv(pv, request.limitW, measurementFence); }
    catch { result = { accepted: false, reason: 'write-failed' }; }
    results.push({ id: pv.id, limitW: request.limitW, evuOnly: request.evuOnly === true, ...result, applied: false });
    if (result.accepted === true) acceptedCaps[pv.id] = request.limitW;
    if (result.commandConfirmed === true && stateId(pv.command.readbackStateId)) pendingCaps[pv.id] = request.limitW;
  }
  const pendingEffects = effects();
  const output: Dict = { action: plan.valid ? 'dynamic-pv-final' : 'dynamic-pv-hold', ...plan, accepted: results.some(row => row.accepted === true), applied: false, results, pendingEffects, acceptedCaps, pendingCaps, generation: runtime.generation };
  if (plan.valid && results.some(row => row.accepted !== true)) output.status = 'write_incomplete';
  if (runtime.isCurrent()) adapter._nwDynamicGridPvRuntime = output;
  return output;
}

module.exports = { validateDynamicPvAssignments, extractRequiredLegacyDynamicPvIds, validateLegacyDynamicPvCoverage, collectDynamicPvSnapshot, readDynamicEvuLimits, planDynamicPv, dynamicPvOwnsCycle, readDynamicPvStates, runDynamicGridPv };
