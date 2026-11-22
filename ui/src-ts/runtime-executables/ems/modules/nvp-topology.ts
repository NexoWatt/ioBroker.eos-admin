/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Liest ausdrücklich konfigurierte M0/M1-Messkontexte und veröffentlicht
 * eine schreibfreie Bereichs-/Budgetdiagnose neben der unveränderten Bestandsregelung.
 * Daten und Wirkung: W, Bezug positiv, Batterieentladung positiv; ausschließlich
 * nvpTopology.*-Diagnosestates werden geschrieben. Es existiert kein Gerätewriter.
 * Bei Änderungen: Aktivierung erst nach Integration exklusiver Bereichswriter und
 * nachgewiesener Geräteausfallpfade. Diagnosewerte sind keine Leistungsfreigaben.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/ems/modules/nvp-topology.md
 */
'use strict';

declare const require: (id: string) => any;
declare const module: { exports: unknown };
type Dict = Record<string, any>;
const { validateTopology, collectSnapshot, affectsPoint } = require('../services/nvp-topology');
const { operatingLimits, allocateIndependentBudgets } = require('../services/nvp-budget');
const { planGroups } = require('../services/nvp-group-planner');

const ACTIVATION_BLOCKERS = [
  'RUNTIME_SCOPED_DISPATCH_NOT_IMPLEMENTED',
  'DEVICE_FAILURE_PROFILES_NOT_VERIFIED',
];

/**
 * Baut eine reine Momentaufnahme. M0 enthält den M1-Zweig bereits. Zum Entfernen
 * der bekannten Batterie-Istwirkung wird pro Messgrenze nur die dort enthaltene
 * Speicherleistung addiert. Zusätzliche Last-/PV-Schwankungen sind nicht bekannt;
 * daher bleiben alle errechneten Korridore ausdrücklich hypothetisch.
 */
function buildTopologyStatus(config: Dict, snapshot: Dict, rootConfig: Dict = {}, previousState: Dict = {}, storageTelemetry: Dict = {}): Dict {
  const base: Dict = {
    schemaVersion: 1, configVersion: config.configVersion,
    mode: config.mode, operation: config.operation,
    timestamp: snapshot.ts, measurements: snapshot,
    activationSupported: false, activationBlockedReasons: ACTIVATION_BLOCKERS.slice(),
    writesPerformed: 0, legacyControl: 'unchanged',
    isAuthorization: false, basis: 'instantaneous-diagnostic-only',
    status: 'diagnostic',
    reason: 'Momentaufnahme: keine Gerätesollwerte oder Freigaben; bisherige Regelung unverändert.',
    groups: [], participants: [], budget: null, errors: snapshot.errors || [],
  };
  if (config.mode !== 'dynamic') return { ...base, status: 'static', reason: 'Bisheriger statischer Betrieb.' };
  if (config.operation === 'active') return { ...base, status: 'activation_blocked', reason: 'Aktiver dynamischer Betrieb ist in diesem Teststand nicht implementiert. Keine dynamischen Gerätebefehle.' };
  if (!snapshot.valid) return { ...base, status: 'measurement_invalid', reason: 'Messkontext fehlt, ist veraltet oder inkonsistent. Kein belastbares Budget berechenbar.' };
  const planned = planGroups(config, snapshot, { nowMs: snapshot.ts, rootConfig, previousState, storageTelemetry });
  const points = config.points.map((point: Dict) => ({ id: point.id, ...operatingLimits(point) }));
  const residuals: Dict = {};
  for (const point of config.points) {
    let residualW = snapshot.points[point.id].valueW;
    for (const storage of config.storages) {
      if (affectsPoint(storage.connectionPointId, point.id)) residualW += snapshot.storages[storage.id].valueW;
    }
    residuals[point.id] = { minW: residualW, maxW: residualW };
  }
  // Alle unabhängigen Korridore werden gemeinsam budgetiert. Es wird keinerlei
  // aktuell gemessene externe Ladung als vertraglich zugesicherte PV-Senke genutzt.
  const participants = config.storages.map((storage: Dict) => ({
    id: storage.id, connectionPointId: storage.connectionPointId,
    desiredMinW: -storage.maxChargeW, desiredMaxW: storage.maxDischargeW,
    minPowerW: -storage.maxChargeW, maxPowerW: storage.maxDischargeW,
    reservedMinW: 0, reservedMaxW: 0, priority: 0,
  }));
  const budget = allocateIndependentBudgets({ points, residuals, participants });
  // Nicht erfüllbare hypothetische Budgets müssen auch ohne JSON-Inspektion
  // sichtbar sein. Das ist kein Nachweis einer tatsächlichen NVP-Überschreitung:
  // die Restbilanz enthält bewusst keine unbestätigte Speicherstützung/-aufnahme.
  // Veraltete Messungen wurden oben bereits getrennt als measurement_invalid
  // behandelt und dürfen hier nicht zu einem erfundenen Grenzverstoß werden.
  const budgetErrors: Dict[] = [];
  for (const point of Array.isArray(budget.points) ? budget.points : []) {
    for (const [side, label] of [['import', 'Bezug'], ['export', 'Einspeisung']]) {
      const violationW = point[`${side}ViolationW`];
      if (typeof violationW === 'number' && Number.isFinite(violationW) && violationW > 0) {
        budgetErrors.push({
          path: `points.${point.id}.${side}LimitW`,
          code: side === 'import' ? 'NVP_IMPORT_BUDGET_EXCEEDED' : 'NVP_EXPORT_BUDGET_EXCEEDED',
          pointId: point.id, violationW,
          message: `${point.id}: Hypothetischer ${label} überschreitet die Betriebsgrenze um ${Math.ceil(violationW)} W. Verbindliche Entlastung erforderlich; keine dynamische Leistungsfreigabe.`,
        });
      }
    }
  }
  const budgetUnavailable = budget.valid !== true || budget.safe !== true;
  if (budgetUnavailable && !budgetErrors.length) budgetErrors.push({
    path: 'budget', code: 'NVP_BUDGET_INVALID',
    message: `Hypothetisches NVP-Budget nicht belastbar berechenbar (${String(budget.reason || 'unbekannter Rechenfehler')}). Keine dynamische Leistungsfreigabe.`,
  });
  return {
    ...base, groups: planned.groups, participants: planned.requests,
    status: budgetUnavailable ? (budgetErrors.some(error => error.pointId) ? 'budget_infeasible' : 'budget_invalid') : base.status,
    reason: budgetUnavailable
      ? (budgetErrors.some(error => error.pointId)
        ? 'Hypothetisches Budget ohne verbindliche Entlastung nicht erfüllbar. Die bisherige Regelung bleibt unverändert; keine dynamische Freigabe.'
        : 'Hypothetisches Budget nicht belastbar berechenbar. Die bisherige Regelung bleibt unverändert; keine dynamische Freigabe.')
      : base.reason,
    errors: [...base.errors, ...budgetErrors],
    planningIssues: planned.issues, nextPlannerState: planned.nextState,
    budget: { ...budget, residuals, isAuthorization: false,
      assumption: 'Momentane Restleistung; eingetragene Geräteleistung, ohne bestätigte SoC-, Phasen-, Scheinleistungs-, Störungs- oder Altfreigabegrenzen.' },
  };
}

/**
 * Nicht blockierender Diagnosesampler. Genau ein Datenbank-Leseauftrag bleibt
 * gleichzeitig offen, auch nach Timeout. Das verhindert unbegrenzte Aufträge bei
 * einer gestörten ioBroker-Datenbank. Der EMS-Regeltakt wartet nicht darauf.
 */
class NvpTopologyModule {
  adapter: Dict;
  private stopped = false;
  private readBusy = false;
  private pending: Promise<unknown> | null = null;
  private generation = 0;
  private lastStarted = 0;
  private statesReady = false;
  private lastPublishedMode = '';
  private plannerState: Dict = {};
  private readonly previewHook: (raw: unknown) => Promise<Dict>;

  constructor(adapter: Dict, _dp?: unknown) {
    this.adapter = adapter;
    this.previewHook = (raw: unknown) => this.preview(raw);
    adapter._nwPreviewNvpTopology = this.previewHook;
  }

  async init(): Promise<void> { /* Keine neuen States oder Gerätezugriffe im statischen Bestand. */ }

  /** Einzelne ioBroker-Abfrage mit begrenztem Warten; niemals Zeitstempel erfinden. */
  private async readStates(ids: string[]): Promise<Dict> {
    if (this.readBusy) return { error: 'measurement_read_busy', states: {} };
    this.readBusy = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = Promise.resolve().then(() => this.adapter.getForeignStatesAsync(ids))
      .then((states: Dict) => ({ states: states || {} }), () => ({ error: 'measurement_read_failed', states: {} }))
      .finally(() => { this.readBusy = false; });
    try {
      return await Promise.race([read, new Promise<Dict>((resolve) => {
        timer = setTimeout(() => resolve({ error: 'measurement_read_timeout', states: {} }), 1500);
      })]);
    } finally { if (timer) clearTimeout(timer); }
  }

  /** Vorschau verändert weder Konfiguration noch Reglerzustände noch Gerätesollwerte. */
  async preview(raw: unknown, remember = false): Promise<Dict> {
    const validation = typeof this.adapter._nwValidateNvpTopology === 'function'
      ? await this.adapter._nwValidateNvpTopology(raw)
      : validateTopology(raw);
    const now = Date.now();
    if (!validation.valid) return {
      mode: 'dynamic', operation: 'diagnostic', status: 'config_invalid', timestamp: now,
      reason: 'NVP-Konfiguration ungültig.', errors: validation.errors,
      activationSupported: false, activationBlockedReasons: ACTIVATION_BLOCKERS.slice(),
      writesPerformed: 0, legacyControl: 'unchanged', isAuthorization: false,
    };
    const config = validation.config;
    if (config.mode !== 'dynamic' || config.operation === 'active') {
      return buildTopologyStatus(config, { valid: true, ts: now, points: {}, storages: {}, errors: [] });
    }
    const ids: string[] = [...new Set<string>([
      ...config.points.map((p: Dict) => p.measurement.stateId),
      ...config.storages.map((s: Dict) => s.powerMeasurement.stateId),
    ])];
    const result = await this.readStates(ids);
    let snapshot = collectSnapshot(config, result.states, Date.now());
    if (result.error) snapshot = { ...snapshot, valid: false, errors: [...snapshot.errors, { code: result.error, message: 'Messwerte konnten nicht vollständig gelesen werden.' }] };
    const status = buildTopologyStatus(config, snapshot, this.adapter.config || {}, remember ? this.plannerState : {});
    if (remember && status.nextPlannerState) this.plannerState = status.nextPlannerState;
    delete status.nextPlannerState;
    return status;
  }

  /** Publiziert ausschließlich eigene, schreibgeschützte Diagnoseobjekte. */
  private async publish(status: Dict, epoch: number): Promise<void> {
    if (this.stopped || epoch !== this.generation) return;
    if (!this.statesReady) {
      await this.adapter.setObjectNotExistsAsync('nvpTopology', { type: 'channel', common: { name: 'NVP-Bereichsdiagnose (keine Steuerung)' }, native: {} });
      for (const [id, type, name] of [
        ['statusJson', 'string', 'Bereichs-/Budgetdiagnose'],
        ['status', 'string', 'Diagnosestatus'],
        ['activationSupported', 'boolean', 'Aktiver dynamischer Betrieb unterstützt'],
      ]) {
        await this.adapter.setObjectNotExistsAsync(`nvpTopology.${id}`, { type: 'state', common: { name, type, role: type === 'boolean' ? 'indicator' : 'text', read: true, write: false }, native: {} });
      }
      this.statesReady = true;
    }
    if (this.stopped || epoch !== this.generation) return;
    this.adapter._nwNvpTopologyStatus = status;
    for (const [id, val] of Object.entries({ statusJson: JSON.stringify(status), status: status.status, activationSupported: false })) {
      if (this.stopped || epoch !== this.generation) return;
      await this.adapter.setStateAsync(`nvpTopology.${id}`, { val, ack: true });
    }
    this.lastPublishedMode = status.mode;
  }

  /** Löst maximal einmal je Sekunde eine isolierte Diagnose aus; kein Hardwarewriter. */
  async tick(): Promise<void> {
    if (this.stopped) return;
    const raw = this.adapter.config && this.adapter.config.nvpTopology;
    if (!raw || raw.mode === undefined || raw.mode === 'static') {
      this.generation++;
      this.plannerState = {};
      const status = { configVersion: raw?.configVersion || 1, mode: 'static', operation: 'diagnostic', status: 'static', timestamp: Date.now(), legacyControl: 'unchanged', activationSupported: false, writesPerformed: 0 };
      this.adapter._nwNvpTopologyStatus = status;
      // Nur bereits benutzte Diagnosestates zurücksetzen; Altinstallationen ohne
      // dynamische Konfiguration behalten null zusätzliche State-Schreibzugriffe.
      if (this.statesReady && this.lastPublishedMode !== 'static' && !this.pending) {
        this.pending = this.publish(status, this.generation).catch(() => {}).finally(() => { this.pending = null; });
      }
      return;
    }
    if (this.pending || Date.now() - this.lastStarted < 1000) return;
    this.lastStarted = Date.now();
    const epoch = ++this.generation;
    const fingerprint = JSON.stringify(raw);
    this.pending = this.preview(raw, true).then(async (status) => {
      if (fingerprint !== JSON.stringify(this.adapter.config && this.adapter.config.nvpTopology)) return;
      await this.publish(status, epoch);
    }).catch(() => {
      // Keine unhandled rejection und keine zusätzlichen Schreibversuche bei DB-Ausfall.
      if (!this.stopped && epoch === this.generation) this.adapter._nwNvpTopologyStatus = {
        mode: 'dynamic', status: 'diagnostic_failed', reason: 'NVP-Diagnose nicht verfügbar.',
        activationSupported: false, writesPerformed: 0, legacyControl: 'unchanged',
      };
    }).finally(() => { this.pending = null; });
  }

  stop(): void {
    this.stopped = true;
    this.generation++;
    if (this.adapter._nwPreviewNvpTopology === this.previewHook) delete this.adapter._nwPreviewNvpTopology;
  }
}

module.exports = { NvpTopologyModule, buildTopologyStatus, ACTIVATION_BLOCKERS };
