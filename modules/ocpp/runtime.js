'use strict';
// Actual 0.4.3 station runtime; explicit base injection.
function createOcppRuntime(AdapterBase) {
const { randomUUID, createHash } = require('node:crypto');
const { OcppRpcServer } = require('./ocpp/server');
const { StationTelemetry, normalizeEosLimit, shouldSendLimit } = require('./ocpp/eos-contract');
const {
  sanitizeStationIdentity,
  deriveConnectionHealth,
  hasConfirmedSessionActivity,
  commandTimeoutMs,
  isTriggerAccepted,
  isTriggerUnsupported,
  isTriggerRejected,
  buildTriggerPayload,
  isChargingState,
  statusImpliesZero,
  chargingStateImpliesZero,
  isRealtimeMetricId,
  isCounterMetricId,
  isActualPowerOrCurrentId,
  dataFreshForEos,
  selectCachedStatesForRepublish,
  takeRotatingItems,
  parseDeviceModelValue,
} = require('./ocpp/freshness');
const {
  compactKeyFromLegacyAggregate,
  measurementCommon,
  measurementDefinition,
  sanitizeFlatKey,
  canonicalPhase,
  aggregatePhaseValues,
  deterministicChargingProfileIds,
  normalizeChargingLimit,
  chargingLimitChanged,
} = require('./ocpp/compact');
const {
  RESERVED_CONFIGURATION_KEYS,
  cloneOcppReference,
  canonicalConfigurationKey16,
  canonicalDeviceModelKey,
  configurationStateKey16,
  configurationStateKey2,
  inferOcpp16Value,
  configurationSensitive,
  redactConfigurationReport,
  configurationRefreshDiagnostic,
  stateRoleForConfiguration,
  parseValuesList,
  configurationWritable,
  buildConfigurationRefreshCall,
  buildConfigurationWriteCall,
  interpretConfigurationRefreshResponse,
  interpretConfigurationWriteResponse,
} = require('./ocpp/configuration');

class NexoWattOcppAdapter extends AdapterBase {
  constructor(options) {
    super({ ...options, name: 'ocpp21' });
    this.server = null;
    this.runtimeIndex = new Map();
    this._eosLeases = new Map();
    this._eosLeaseTimer = null;
    this._eosLeaseWatchdogRunning = false;
    this._startedAtMs = Date.now();
    this._sessionPublications = new Map();
    this._chargeLimitPublications = new Map(); // Serializes status writes across reconnects, not just within one socket.

    // Runtime caches to avoid excessive object creation overhead
    this._dpObjCache = new Set();
    this._dpCounts = new Map();
    this._aliasDone = new Set();
    this._configurationIndex = new Map(); // relative/full state ID -> OCPP write metadata
    this._configurationValueCache = new Map(); // relative state ID -> last confirmed value
    this._configurationByIdentity = new Map(); // identity -> Map(stateKey, metadata)
    this._rawToStateIdentity = new Map();
    this._stateToRawIdentity = new Map();
    this._freshStateCache = new Map(); // identity -> Map(stateId, { val, ack, category, updatedAt })
    this._phaseMetricCache = new Map();
    this._identityStructureReady = new Set();
    this._connectorStructureReady = new Set();
    this._connectorCleanupDone = new Set();
    this._advancedStructureReady = new Set();
    this._legacyCleanupDone = new Set();
    this._legacySubfolderCleanupDone = new Set();
    this._measurementAliasCleanupDone = new Set();
    this._watchdogTimer = null;
    this._watchdogRunning = false;
    this._shuttingDown = false;

    this.on('ready', this.onReady.bind(this));
    this.on('unload', this.onUnload.bind(this));
    this.on('stateChange', this.onStateChange.bind(this));
  }

  _stripNs(id) { return id.startsWith(this.namespace + '.') ? id.slice(this.namespace.length + 1) : id; }

  _sanitizeSeg(seg) {
    return String(seg || '')
      .trim()
      .replace(/[^A-Za-z0-9_\-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      || 'x';
  }

  resolveStationIdentity(rawIdentity) {
    const raw = String(rawIdentity ?? '').trim();
    if (this._rawToStateIdentity.has(raw)) return this._rawToStateIdentity.get(raw);
    let stateId = sanitizeStationIdentity(raw);
    const existingRaw = this._stateToRawIdentity.get(stateId);
    if (existingRaw && existingRaw !== raw) {
      let suffix = 2;
      const base = stateId;
      while (this._stateToRawIdentity.has(`${base}_${suffix}`)) suffix++;
      stateId = `${base}_${suffix}`;
    }
    this._rawToStateIdentity.set(raw, stateId);
    this._stateToRawIdentity.set(stateId, raw);
    return stateId;
  }

  _identityFromStateId(id) {
    const rel = this._stripNs(String(id || ''));
    return rel.split('.')[0] || '';
  }

  _cacheFreshState(id, val, ack, category) {
    if (!category || ['payload', 'health', 'control', 'dm', 'configuration'].includes(category)) return;
    const rel = this._stripNs(id);
    const identity = this._identityFromStateId(rel);
    if (!identity) return;
    if (!this._freshStateCache.has(identity)) this._freshStateCache.set(identity, new Map());
    this._freshStateCache.get(identity).set(rel, { val, ack: !!ack, category, updatedAt: Date.now() });
  }

  async _setStateFreshAsync(id, val, ack = true, category = 'status') {
    const rel = this._stripNs(id);
    await this.setStateAsync(rel, { val, ack: !!ack });
    this._cacheFreshState(rel, val, ack, category);
  }

  _metricCategoryFromId(id) {
    if (isCounterMetricId(id)) return 'counter';
    if (/(?:^|\.)(?:SoC|soc(?:Percent)?)(?:_|\.|$)/.test(String(id || ''))) return 'soc';
    if (isRealtimeMetricId(id)) return 'realtime';
    return 'status';
  }

  _indexClient(identity, proto, client, rawIdentity) {
    const now = Date.now();
    const old = this.runtimeIndex.get(identity);
    if (old && old.client !== client) {
      this.log.warn(`Charging station identity ${rawIdentity || identity} connected again; the newer connection replaces the old runtime session.`);
      if (old.client && typeof old.client.close === 'function') {
        Promise.resolve(old.client.close({ code: 1008, reason: 'Superseded by a newer connection' })).catch(() => undefined);
      }
    }
    // Never carry realtime timestamps or phase fragments across OCPP sessions.
    this._freshStateCache.delete(identity);
    for (const key of [...this._phaseMetricCache.keys()]) if (key.startsWith(`${identity}|`)) this._phaseMetricCache.delete(key);
    this.runtimeIndex.set(identity, {
      sessionId: randomUUID(),
      // Keep the identity known across socket replacements, while requiring fresh evidence for each session.
      dashboardPreviouslyConfirmed: old?.dashboardPreviouslyConfirmed === true || hasConfirmedSessionActivity(old),
      proto,
      client,
      rawIdentity: rawIdentity || identity,
      connectedAt: now,
      socketConnected: true,
      lastMessageAt: now,
      lastAction: 'Connect',
      lastHeartbeatAt: 0,
      lastMeterAt: 0,
      lastPowerAt: 0,
      lastExportPowerAt: 0,
      lastCurrentAt: 0,
      lastSocAt: 0,
      lastStatusAt: 0,
      heartbeatIntervalSec: Math.max(10, Number(this.config.heartbeatIntervalSec) || 300),
      connectors: new Set(old?.connectors || []),
      statuses: new Map(),
      transactionActive: false,
      chargingState: '',
      refreshInFlight: false,
      nextRefreshAt: now,
      triggerSupport: { MeterValues: 'unknown', StatusNotification: 'unknown' },
      triggerRetryAt: { MeterValues: 0, StatusNotification: 0 },
      lastTriggerAt: 0,
      lastTriggerMessage: '',
      refreshSuppressedUntil: old ? Math.max(0, Number(old.refreshSuppressedUntil) || 0) : 0,
      refreshSuppressedReason: old ? String(old.refreshSuppressedReason || '') : '',
      refreshRelatedDisconnects: old ? Math.max(0, Number(old.refreshRelatedDisconnects) || 0) : 0,
      lastRefreshAttemptAt: 0,
      lastRefreshSuccessAt: 0,
      lastRefreshError: '',
      lastStateRepublishAt: 0,
      republishCursor: 0,
      refreshConnectorCursor: 0,
      safeZeroAt: 0,
      safeZeroReason: '',
      booted: false,
      deferredTail: Promise.resolve(),
      deferredDepth: 0,
      deferredMaxDepth: 0,
      deferredDropped: 0,
      deferredErrors: 0,
      lastDeferredError: '',
      reconnectCount: old ? Math.max(0, Number(old.reconnectCount) || 0) + 1 : 0,
      disconnectCount: old ? Math.max(0, Number(old.disconnectCount) || 0) : 0,
      lastDisconnectAt: old ? old.lastDisconnectAt || 0 : 0,
      lastDisconnectCode: old ? old.lastDisconnectCode || 0 : 0,
      lastDisconnectReason: old ? old.lastDisconnectReason || '' : '',
      outboundCallCount: old ? Math.max(0, Number(old.outboundCallCount) || 0) : 0,
      outboundErrorCount: old ? Math.max(0, Number(old.outboundErrorCount) || 0) : 0,
      lastOutboundMethod: '',
      lastOutboundAt: 0,
      outboundControlTail: Promise.resolve(),
      smartChargingTail: Promise.resolve(),
      smartChargingGeneration: 0,
      smartChargingPending: 0,
      lastSmartCharging: undefined, // Never deduplicate against a previous WebSocket session.
      lastSmartChargingAt: old ? old.lastSmartChargingAt || 0 : 0,
      configurationTail: Promise.resolve(),
      configurationPending: 0,
      configurationWriteGeneration: new Map(),
      configurationRefreshInFlight: false,
      configurationRequestId: old ? Math.max(0, Number(old.configurationRequestId) || 0) : 0,
      configurationPendingRequestId: 0,
      configurationReportDeadlineAt: 0,
      configurationReportRequestId: 0,
      configurationReportCount: 0,
      configurationReportSequences: new Set(),
      configurationInventorySeen: new Set(),
      configurationRebootRequired: false,
      configurationAutoRefreshDone: false,
      configurationAutoRefreshAt: now + Math.max(5, Number(this.config.configurationRefreshDelaySec) || 15) * 1000,
    });
    const entry = this.runtimeIndex.get(identity);
    // Publish the new session fence independently of any old profile publication.
    const publishSession = async () => {
      await this.ensureStructure(identity);
      if (this.runtimeIndex.get(identity) !== entry) return;
      await this._setStateFreshAsync(`${identity}.info.sessionId`, entry.sessionId, true, 'control');
    };
    const previousSession = this._sessionPublications.get(identity) || Promise.resolve();
    entry.sessionPublication = previousSession.then(publishSession, publishSession);
    this._sessionPublications.set(identity, entry.sessionPublication);
    this._ensureEosLease(identity).then(lease => {
      if (lease.armed && this.runtimeIndex.get(identity) === entry) {
        lease.stopSessionId = '';
        if (!this._eosLeaseFresh(lease)) lease.stopRequired = true;
      }
    }).catch(error => this.log.warn(`Could not restore EOS lease: ${error.message}`));
    this._publishChargeLimitStatus(identity, entry, { valid: false, reason: 'connected-awaiting-profile' })
      .catch(error => this.log.warn(`Could not invalidate charging limit on connect: ${error.message}`));
  }

  _unindexClient(identity, client) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry || (client && entry.client !== client)) return false;
    // Retain the runtime diagnostics while the station is offline. This lets us
    // distinguish a clean reconnect from a brand-new station and preserves the
    // deferred processing counters used to diagnose intermittent disconnects.
    entry.client = null;
    entry.socketConnected = false;
    entry.booted = false;
    entry.refreshInFlight = false;
    entry.configurationRefreshInFlight = false;
    entry.configurationPendingRequestId = 0;
    entry.configurationReportDeadlineAt = 0;
    entry.configurationReportSequences = new Set();
    entry.configurationInventorySeen = new Set();
    this._publishChargeLimitStatus(identity, entry, { valid: false, reason: 'disconnected' })
      .catch(error => this.log.warn(`Could not invalidate charging limit on disconnect: ${error.message}`));
    return true;
  }

  _deferStationTask(identity, label, task, options = {}) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry || this._shuttingDown) return false;
    const maxDepth = Math.max(25, Number(this.config.maxDeferredTasks) || 250);
    const droppable = options.droppable === true;
    if (droppable && entry.deferredDepth >= maxDepth) {
      entry.deferredDropped++;
      entry.lastDeferredError = `Dropped ${label}: deferred queue reached ${maxDepth}`;
      return false;
    }
    entry.deferredDepth++;
    entry.deferredMaxDepth = Math.max(entry.deferredMaxDepth || 0, entry.deferredDepth);
    const run = async () => {
      try {
        if (this.runtimeIndex.get(identity) !== entry && options.allowAfterReconnect !== true) {
          entry.deferredDropped++;
          entry.lastDeferredError = `Dropped ${label}: OCPP session was superseded`;
          return;
        }
        await task();
      } catch (error) {
        entry.deferredErrors++;
        entry.lastDeferredError = `${label}: ${error && error.message || error}`;
        this.log.warn(`Deferred OCPP processing failed (${identity}, ${label}): ${error && error.stack || error}`);
      } finally {
        entry.deferredDepth = Math.max(0, entry.deferredDepth - 1);
      }
    };
    entry.deferredTail = Promise.resolve(entry.deferredTail).then(run, run);
    return true;
  }

  async _noteDisconnect(identity, client, details = {}) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry || (client && entry.client !== client)) return;
    const now = Date.now();
    entry.socketConnected = false;
    entry.disconnectCount = Math.max(0, Number(entry.disconnectCount) || 0) + 1;
    entry.lastDisconnectAt = now;
    entry.lastDisconnectCode = Number(details.code) || 0;
    entry.lastDisconnectReason = String(details.reason || 'socket-closed');
    // Some station firmwares disconnect shortly after an actively requested
    // TriggerMessage. Treat this as a correlation signal (not proof), suppress
    // further active refresh for six hours and keep passive push telemetry
    // running. This prevents a diagnostic refresh loop from repeatedly
    // interrupting an otherwise stable charge.
    if (entry.lastTriggerAt && now - entry.lastTriggerAt <= 30_000) {
      entry.refreshRelatedDisconnects = Math.max(0, Number(entry.refreshRelatedDisconnects) || 0) + 1;
      entry.refreshSuppressedUntil = now + 6 * 60 * 60 * 1000;
      entry.refreshSuppressedReason = `disconnect-after-${entry.lastTriggerMessage || 'TriggerMessage'}`;
      entry.triggerRetryAt.MeterValues = entry.refreshSuppressedUntil;
      entry.triggerRetryAt.StatusNotification = entry.refreshSuppressedUntil;
    }
    try {
      await this.ensureStructure(identity);
      await this._setStateFreshAsync(`${identity}.health.lastDisconnectAt`, new Date(now).toISOString(), true, 'health');
      await this._setStateFreshAsync(`${identity}.health.lastDisconnectCode`, entry.lastDisconnectCode, true, 'health');
      await this._setStateFreshAsync(`${identity}.health.lastDisconnectReason`, entry.lastDisconnectReason, true, 'health');
      await this._setStateFreshAsync(`${identity}.health.disconnectCount`, entry.disconnectCount, true, 'health');
      await this._setStateFreshAsync(`${identity}.health.refreshRelatedDisconnects`, entry.refreshRelatedDisconnects || 0, true, 'health');
      await this._setStateFreshAsync(`${identity}.health.refreshSuppressedUntil`, entry.refreshSuppressedUntil ? new Date(entry.refreshSuppressedUntil).toISOString() : '', true, 'health');
      await this._setStateFreshAsync(`${identity}.health.refreshSuppressedReason`, entry.refreshSuppressedReason || '', true, 'health');
    } catch (error) {
      this.log.debug(`Could not persist disconnect diagnostics for ${identity}: ${error && error.message || error}`);
    }
  }

  _noteMessage(identity, action) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry) return;
    const now = Date.now();
    entry.lastMessageAt = now;
    entry.lastAction = String(action || '');
  }

  _rememberDashboardStation(identity, entry) {
    if (entry.dashboardMarkerPending || entry.dashboardMarkerSaved) return;
    entry.dashboardMarkerPending = true;
    // This observation outlives a socket. Never restore a present-session online flag from it.
    void this.ensureStructure(identity).then(async () => {
      if (this.runtimeIndex.get(identity)?.rawIdentity !== entry.rawIdentity) return;
      const key = createHash('sha256').update(entry.rawIdentity).digest('hex');
      await this._setStateFreshAsync(`${identity}.health.dashboardConfirmedKey`, key, true, 'static');
      entry.dashboardMarkerSaved = true;
    }).catch(() => { /* Retry on the next confirmed packet. */ })
      .finally(() => { entry.dashboardMarkerPending = false; });
  }

  _noteBoot(identity, intervalSec) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry) return;
    const now = Date.now();
    entry.booted = true;
    entry.heartbeatIntervalSec = Math.max(10, Number(intervalSec) || entry.heartbeatIntervalSec || 300);
    // Boot is activity, not a Heartbeat.
    entry.lastMessageAt = Math.max(entry.lastMessageAt || 0, now);
    entry.nextRefreshAt = now + Math.max(30, Number(this.config.activeRefreshIntervalSec) || 60) * 1000;
    entry.lastBootAt = now;
    this._rememberDashboardStation(identity, entry);
    entry.configurationRebootRequired = false;
    entry.configurationAutoRefreshDone = false;
    entry.configurationAutoRefreshAt = now + Math.max(5, Number(this.config.configurationRefreshDelaySec) || 15) * 1000;
    // RebootRequired is a latch: it stays true after an accepted write until
    // the station registers again with BootNotification. Clearing it here is
    // diagnostic only and never sends a Reset command.
    this._deferStationTask(identity, 'configuration:clear-reboot-required', async () => {
      await this._recordConfigurationStatus(identity, { rebootRequired: false });
    });
  }

  _noteHeartbeat(identity, timestamp) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry) return;
    // Heartbeat freshness is based on local receipt time. The remote clock is
    // retained only for display and must not make an old connection appear new.
    const now = Date.now();
    entry.lastHeartbeatAt = now;
    this._rememberDashboardStation(identity, entry);
    entry.lastMessageAt = Math.max(entry.lastMessageAt || 0, now);
    entry.lastHeartbeatSourceTimestamp = timestamp || '';
  }

  _getStationTelemetry(identity, entry) {
    if (!entry.telemetry) {
      const declared = this.chargePointInventory?.stations?.get(entry.rawIdentity) || [];
      entry.telemetry = new StationTelemetry(entry.proto, declared, [...entry.connectors]);
    }
    return entry.telemetry;
  }

  async _publishStationTelemetry(identity, entry) {
    if (this.runtimeIndex.get(identity) !== entry || !entry.client || !entry.socketConnected) return;
    const telemetry = this._getStationTelemetry(identity, entry);
    const now = Date.now();
    const snapshot = telemetry.snapshot(now, Math.max(15, Number(this.config.telemetryMaxAgeSec) || 90) * 1000,
      Math.max(30, Number(this.config.socMaxAgeSec) || 300) * 1000, this.config.zeroPowerWhenIdle !== false);
    await this.ensureStructure(identity);
    if (this.runtimeIndex.get(identity) !== entry || !entry.client || !entry.socketConnected) return;
    const write = (key, val, category = 'health') => this._setStateFreshAsync(`${identity}.${key}`, val, true, category);
    // Invalidate before changing the value; consumers must never see a partial sum as fresh.
    const power = snapshot.result.powerW;
    const allowed = this.config.zeroPowerWhenIdle !== false;
    const usable = !!power && (power.category !== 'safeZero' || allowed);
    entry.lastPowerAt = usable && power.category !== 'safeZero' ? Math.min(power.at, power.sourceAt) : 0;
    entry.lastExportPowerAt = snapshot.result.powerExportW && snapshot.result.powerExportW.category !== 'safeZero' ? Math.min(snapshot.result.powerExportW.at, snapshot.result.powerExportW.sourceAt) : 0;
    entry.lastCurrentAt = snapshot.result.currentA && snapshot.result.currentA.category !== 'safeZero' ? Math.min(snapshot.result.currentA.at, snapshot.result.currentA.sourceAt) : 0;
    entry.lastSocAt = snapshot.result.socPercent ? Math.min(snapshot.result.socPercent.at, snapshot.result.socPercent.sourceAt) : 0;
    entry.safeZeroAt = allowed && snapshot.allIdle && power?.category === 'safeZero' ? now : 0;
    entry.safeZeroReason = entry.safeZeroAt ? 'all-outlets-confirmed-idle' : '';
    entry.transactionActive = snapshot.active;
    entry.chargingState = snapshot.chargingState;
    if (!usable) await write('health.dataFresh', false);
    if (!entry.lastSocAt) {
      await write('health.socFresh', false);
      await write('measurements.socPercent', null, 'soc');
      await write('vehicle.socPercent', null, 'soc');
    }
    const last = entry.telemetryPublished || (entry.telemetryPublished = new Map());
    // A real new sample with unchanged value still advances its source timestamp.
    // An unrelated heartbeat/counter may never republish a previous measurement as new.
    for (const [key, item] of Object.entries(snapshot.result)) {
      if (item.category === 'safeZero' && !allowed) continue;
      const prior = last.get(key);
      if (prior && prior.at === item.at && prior.sourceAt === item.sourceAt && prior.val === item.val && prior.category === item.category) continue;
      if (item.category === 'safeZero' && prior?.category === 'safeZero' && prior.val === item.val) continue;
      await this.ensureMeasurement(identity, key);
      await write(`measurements.${key}`, item.val, item.category || 'realtime');
      if (key === 'socPercent') await write('vehicle.socPercent', item.val, 'soc');
      last.set(key, item);
    }
    for (const [key, val] of Object.entries({
      'info.connectorCount': snapshot.connectorCount, 'info.evseCount': snapshot.evseCount,
      'info.topologySource': snapshot.topologySource, 'info.eosContract': 'nexowatt-ocpp21-0.4-native',
      'info.deviceType': 'evCharger', 'info.controlScope': 'station', 'health.powerSource': usable ? power.source : 'unknown-or-incomplete',
      'health.powerFresh': usable && power.category !== 'safeZero', 'health.currentFresh': !!entry.lastCurrentAt,
      'health.exportPowerFresh': !!entry.lastExportPowerAt, 'health.socFresh': !!entry.lastSocAt,
      'health.safeZeroApplied': !!entry.safeZeroAt, 'health.safeZeroReason': entry.safeZeroReason,
      'transactions.transactionActive': snapshot.active, 'transactions.chargingState': snapshot.chargingState,
    })) await write(key, val, key.startsWith('health.') ? 'health' : 'status');
    if (snapshot.status) await write('info.status', snapshot.status, 'status');
    if (entry.lastPowerAt) await write('health.lastPowerValue', new Date(entry.lastPowerAt).toISOString());
    if (entry.lastSocAt) await write('health.lastSoc', new Date(entry.lastSocAt).toISOString());
    const connection = deriveConnectionHealth({ now, socketConnected: entry.socketConnected, connectedAt: entry.connectedAt, lastMessageAt: entry.lastMessageAt,
      lastHeartbeatAt: entry.lastHeartbeatAt, heartbeatIntervalSec: entry.heartbeatIntervalSec, heartbeatTimeoutFactor: this.config.heartbeatTimeoutFactor, activityTimeoutSec: this.config.activityTimeoutSec });
    await write('health.dataFresh', connection.online && (usable || !!entry.safeZeroAt));
  }

  async _publishScopedMeter(identity, evseId, connectorId, values, at, sourceAt) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry || !entry.client || !entry.socketConnected) return;
    const telemetry = this._getStationTelemetry(identity, entry);
    telemetry.meter(evseId, connectorId, values, at, sourceAt);
    if (evseId > 0 && connectorId > 0) entry.connectors.add(`${evseId}:${connectorId}`);
    entry.lastMeterAt = at;
    this._rememberDashboardStation(identity, entry);
    await this._setStateFreshAsync(`${identity}.health.lastMeterValue`, new Date(at).toISOString(), true, 'health');
    await this._publishStationTelemetry(identity, entry);
  }

  async _publishScopedSoc(identity, evseId, connectorId, val) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry || !entry.client || !entry.socketConnected || !Number.isFinite(val) || val < 0 || val > 100) return;
    const telemetry = this._getStationTelemetry(identity, entry);
    if (!Number.isSafeInteger(evseId) || evseId < 1) {
      if (telemetry.scopes.size > 1) return;
      evseId = 0; connectorId = 0;
    }
    const now = Date.now();
    telemetry.meter(evseId, connectorId, { socPercent: { val, category: 'soc' } }, now, now);
    await this._publishStationTelemetry(identity, entry);
  }

  async _noteStatus(identity, evseId, connectorId, status) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry || !entry.client || !entry.socketConnected) return;
    entry.lastStatusAt = Date.now();
    this._rememberDashboardStation(identity, entry);
    if (evseId > 0 && connectorId > 0) entry.connectors.add(`${evseId}:${connectorId}`);
    entry.statuses.set(`${evseId}:${connectorId}`, String(status || ''));
    this._getStationTelemetry(identity, entry).status(evseId, connectorId, status);
    await this._publishStationTelemetry(identity, entry);
  }

  async _noteMeterValue(identity, evseId, connectorId, timestamp, flags = {}) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry) return;
    // Freshness is based on local receipt time. A station clock can be wrong,
    // in the future or far in the past and must not falsify EOS data quality.
    const now = Date.now();
    entry.lastMeterAt = Math.max(entry.lastMeterAt || 0, now);
    this._rememberDashboardStation(identity, entry);
    if (flags.hasPower) entry.lastPowerAt = Math.max(entry.lastPowerAt || 0, now);
    if (flags.hasExportPower) entry.lastExportPowerAt = Math.max(entry.lastExportPowerAt || 0, now);
    if (flags.hasCurrent) entry.lastCurrentAt = Math.max(entry.lastCurrentAt || 0, now);
    entry.connectors.add(`${Math.max(0, Number(evseId) || 0)}:${Math.max(0, Number(connectorId) || 0)}`);
    // A valid, non-zero actual-flow sample contradicts a previously derived
    // idle zero. Counter-only, SoC-only or zero-valued samples do not: an
    // unchanged Available/Idle protocol state remains authoritative while the
    // station is online.
    if (flags.hasNonZeroActualFlow) {
      entry.safeZeroAt = 0;
      entry.safeZeroReason = '';
    }
    await this.ensureStructure(identity, evseId, connectorId);
    await this._setStateFreshAsync(`${identity}.health.lastMeterValue`, new Date(entry.lastMeterAt).toISOString(), true, 'health');
    if (flags.hasPower) await this._setStateFreshAsync(`${identity}.health.lastPowerValue`, new Date(entry.lastPowerAt).toISOString(), true, 'health');
    if (flags.hasExportPower) await this._setStateFreshAsync(`${identity}.health.lastExportPowerValue`, new Date(entry.lastExportPowerAt).toISOString(), true, 'health');
    if (flags.hasCurrent) await this._setStateFreshAsync(`${identity}.health.lastCurrentValue`, new Date(entry.lastCurrentAt).toISOString(), true, 'health');
  }

  async _noteSoc(identity, timestamp) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry) return;
    // As with meter freshness, use receipt time rather than the EV/station
    // timestamp so clock skew cannot falsify health.socFresh.
    const now = Date.now();
    entry.lastSocAt = Math.max(entry.lastSocAt || 0, now);
    await this.ensureStructure(identity);
    await this._setStateFreshAsync(`${identity}.health.lastSoc`, new Date(entry.lastSocAt).toISOString(), true, 'health');
  }

  _recordPhaseMetric(identity, evseId, connectorId, measurand, phase, value, unit, ts) {
    const phaseKey = canonicalPhase(phase);
    if (!phaseKey) return;
    const key = `${identity}|${evseId}|${connectorId}|${measurand}`;
    if (!this._phaseMetricCache.has(key)) this._phaseMetricCache.set(key, new Map());
    this._phaseMetricCache.get(key).set(phaseKey, { value: Number(value), unit: unit || '', ts: Number(ts) || Date.now() });
  }

  _getPhaseMetricTotal(identity, evseId, connectorId, measurand) {
    const key = `${identity}|${evseId}|${connectorId}|${measurand}`;
    const values = this._phaseMetricCache.get(key);
    if (!values) return undefined;
    const maxAgeMs = Math.max(15, Number(this.config.telemetryMaxAgeSec) || 90) * 1000;
    const cutoff = Date.now() - maxAgeMs;
    const samples = [];
    let unit = '';
    for (const [phase, sample] of values.entries()) {
      if (!sample || sample.ts < cutoff || !Number.isFinite(sample.value)) {
        values.delete(phase);
        continue;
      }
      samples.push(sample.value);
      unit = unit || sample.unit || '';
    }
    const value = aggregatePhaseValues(measurand, samples);
    return Number.isFinite(value) ? { value, unit, phaseCount: samples.length } : undefined;
  }

  async _noteTransaction(identity, evt) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry || !entry.client || !entry.socketConnected) return;
    if (Number(evt.evseId) > 0 && Number(evt.connectorId) > 0) entry.connectors.add(`${evt.evseId}:${evt.connectorId}`);
    this._getStationTelemetry(identity, entry).transaction(evt);
    await this._publishStationTelemetry(identity, entry);
  }

  async _zeroActualFlow(identity, reason, evseId, connectorId) {
    await this.ensureStructure(identity, evseId || 1, connectorId || 1);
    const now = Date.now();
    const entry = this.runtimeIndex.get(identity);
    const ids = new Set([
      `${identity}.measurements.powerW`,
      `${identity}.measurements.powerExportW`,
      `${identity}.measurements.currentA`,
      `${identity}.measurements.currentExportA`,
    ]);
    const cache = this._freshStateCache.get(identity);
    if (cache) {
      for (const stateId of cache.keys()) if (isActualPowerOrCurrentId(stateId)) ids.add(stateId);
    }
    if (this.config.connectorDetails === true && evseId !== undefined && connectorId !== undefined) {
      const base = this._connectorBase(identity, evseId, connectorId);
      ids.add(`${base}.powerW`);
      ids.add(`${base}.powerExportW`);
      ids.add(`${base}.currentA`);
      ids.add(`${base}.currentExportA`);
    }
    for (const stateId of ids) {
      const key = stateId.split('.').pop();
      if (stateId.includes('.measurements.')) await this.ensureMeasurement(identity, key, key.toLowerCase().includes('current') ? 'A' : 'W');
      await this._setStateFreshAsync(stateId, 0, true, 'safeZero');
    }
    for (const key of [...this._phaseMetricCache.keys()]) if (key.startsWith(`${identity}|`)) this._phaseMetricCache.delete(key);
    if (entry) {
      entry.safeZeroAt = now;
      entry.safeZeroReason = reason;
    }
    await this._setStateFreshAsync(`${identity}.health.safeZeroApplied`, true, true, 'health');
    await this._setStateFreshAsync(`${identity}.health.safeZeroReason`, reason, true, 'health');
  }

  async _touchCachedStates(identity, safeZero, now = Date.now(), cursor = 0) {
    const cache = this._freshStateCache.get(identity);
    if (!cache || cache.size === 0) return 0;
    const maxStates = Math.max(25, Number(this.config.maxRepublishedStates) || 250);
    const selection = selectCachedStatesForRepublish(cache.entries(), {
      cursor,
      limit: maxStates,
      now,
      telemetryMaxAgeSec: this.config.telemetryMaxAgeSec,
      socMaxAgeSec: this.config.socMaxAgeSec,
      safeZero,
    });
    for (const [stateId, item] of selection.entries) {
      if (cache.get(stateId) !== item) continue;
      await this.setStateAsync(stateId, { val: item.val, ack: item.ack });
    }
    return selection.nextCursor;
  }

  async _callClient(identity, method, payload, options = {}) {
    if (typeof this.assertCanOperate === 'function') this.assertCanOperate();
    const entry = this.runtimeIndex.get(identity);
    if (!entry || !entry.client) throw new Error(`No connected charging station for ${identity}`);
    const timeoutMs = commandTimeoutMs(this.config.callTimeoutSec);
    entry.outboundCallCount = Math.max(0, Number(entry.outboundCallCount) || 0) + 1;
    entry.lastOutboundMethod = String(method || '');
    entry.lastOutboundAt = Date.now();
    const captureEnabled = options.capture !== false && this.config.captureRawMessages === true;
    if (captureEnabled) {
      this._deferStationTask(identity, `capture-out:${method}`, () => this.captureOcppPayload(identity, entry.proto, 'out', method, payload), { droppable: true });
    }
    let timer;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${method} timeout after ${timeoutMs} ms`)), timeoutMs);
      });
      const client = entry.client;
      if (typeof this.assertCanOperate === 'function') this.assertCanOperate();
      const response = await Promise.race([client.call(method, payload), timeout]);
      if (this.runtimeIndex.get(identity) !== entry || entry.client !== client || !entry.socketConnected) throw new Error('OCPP session changed during command');
      if (typeof this.assertCanOperate === 'function') this.assertCanOperate();
      // A CALLRESULT is valid OCPP application activity as well. It keeps
      // activityFresh/health.online alive without pretending that a Heartbeat
      // was received.
      if (this.runtimeIndex.get(identity) === entry) {
        entry.lastMessageAt = Date.now();
        entry.lastAction = `${method}Response`;
      }
      if (captureEnabled) {
        this._deferStationTask(identity, `capture-out:${method}Response`, () => this.captureOcppPayload(identity, entry.proto, 'out', `${method}Response`, response), { droppable: true });
      }
      return response;
    } catch (error) {
      entry.outboundErrorCount = Math.max(0, Number(entry.outboundErrorCount) || 0) + 1;
      if (captureEnabled) {
        this._deferStationTask(identity, `capture-out:${method}Error`, () => this.captureOcppPayload(identity, entry.proto, 'out', `${method}Error`, { error: String(error && error.message || error) }), { droppable: true });
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  _assertCallAccepted(method, response) {
    if (!response || typeof response !== 'object' || typeof response.status !== 'string') throw new Error(`${method}: missing response status`);
    const status = response.status.trim();
    const accepted = new Set(['accepted', 'scheduled', 'rebootrequired', 'ok']);
    if (!accepted.has(status.toLowerCase())) throw new Error(`${method} returned status ${status}`);
    return response;
  }

  _stringifyControlValue(value) {
    if (value === undefined) return '';
    if (typeof value === 'string') return value;
    try { return JSON.stringify(value); } catch (e) { return String(value); }
  }

  async _recordControlResult(identity, method, response, error) {
    await this.ensureStructure(identity);
    const now = new Date().toISOString();
    const errorText = error ? String(error && error.message || error) : '';
    // Profile validity is owned by the profile/session lifecycle. An older
    // command's generic diagnostics must not invalidate a newer accepted one.
    await this._setStateFreshAsync(`${identity}.control.lastCommand`, String(method || ''), true, 'control');
    await this._setStateFreshAsync(`${identity}.control.lastCommandAt`, now, true, 'control');
    await this._setStateFreshAsync(`${identity}.control.lastResponse`, errorText ? '' : this._stringifyControlValue(response), true, 'control');
    await this._setStateFreshAsync(`${identity}.control.lastError`, errorText, true, 'control');
    await this._setStateFreshAsync(`${identity}.control.lastSuccess`, !errorText, true, 'control');
  }

  _configurationMap(identity) {
    if (!this._configurationByIdentity.has(identity)) this._configurationByIdentity.set(identity, new Map());
    return this._configurationByIdentity.get(identity);
  }

  _configurationDisplayName(meta) {
    if (!meta) return 'OCPP configuration';
    if (meta.kind === 'ocpp16') return String(meta.key || 'OCPP 1.6 configuration');
    const component = meta.component || {};
    const variable = meta.variable || {};
    const componentParts = [component.name || 'Component'];
    if (component.instance) componentParts.push(`[${component.instance}]`);
    if (component.evse && component.evse.id !== undefined) {
      componentParts.push(`EVSE ${component.evse.id}`);
      if (component.evse.connectorId !== undefined) componentParts.push(`Connector ${component.evse.connectorId}`);
    }
    const variableParts = [variable.name || 'Variable'];
    if (variable.instance) variableParts.push(`[${variable.instance}]`);
    return `${componentParts.join(' ')} · ${variableParts.join(' ')} · ${meta.attributeType || 'Actual'}`;
  }

  _configurationNative(meta, value, hasValue = true) {
    const native = {
      kind: meta.kind,
      protocol: meta.protocol,
      canonicalKey: meta.canonicalKey,
      key: meta.key,
      readonly: meta.readonly,
      component: cloneOcppReference(meta.component),
      variable: cloneOcppReference(meta.variable),
      attributeType: meta.attributeType,
      mutability: meta.mutability,
      persistent: meta.persistent,
      constant: meta.constant,
      dataType: meta.dataType,
      unit: meta.unit,
      minLimit: meta.minLimit,
      maxLimit: meta.maxLimit,
      valuesList: meta.valuesList,
      supportsMonitoring: meta.supportsMonitoring,
      sensitive: meta.sensitive === true || configurationSensitive(meta),
      stale: meta.stale === true,
      inventoryPending: meta.inventoryPending === true,
      stateKey: meta.stateKey,
    };
    for (const key of Object.keys(native)) if (native[key] === undefined) delete native[key];
    if (native.sensitive) {
      native.lastConfirmedValue = null;
      native.lastConfirmedAt = '';
    } else if (hasValue) {
      native.lastConfirmedValue = value;
      native.lastConfirmedAt = new Date().toISOString();
    } else if (Object.prototype.hasOwnProperty.call(meta, 'lastConfirmedValue')) {
      native.lastConfirmedValue = meta.lastConfirmedValue;
      if (meta.lastConfirmedAt) native.lastConfirmedAt = meta.lastConfirmedAt;
    }
    return native;
  }

  _configurationStateCommon(meta, value) {
    const sensitive = meta.sensitive === true || configurationSensitive(meta);
    const type = sensitive ? 'string' : meta.stateType || (typeof value === 'boolean' ? 'boolean' : typeof value === 'number' ? 'number' : 'string');
    const writable = configurationWritable(meta, this.config.configurationWriteEnabled !== false);
    let role = sensitive ? 'text' : stateRoleForConfiguration(type, value);
    if (type === 'boolean' && !writable) role = 'indicator';
    const mutability = String(meta.mutability || '').toLowerCase();
    const common = {
      name: this._configurationDisplayName(meta),
      type,
      role,
      read: !sensitive && (meta.kind !== 'deviceModel' || mutability !== 'writeonly'),
      write: writable,
    };
    if (meta.unit) common.unit = String(meta.unit);
    if (type === 'number' && Number.isFinite(Number(meta.minLimit))) common.min = Number(meta.minLimit);
    if (type === 'number' && Number.isFinite(Number(meta.maxLimit))) common.max = Number(meta.maxLimit);
    if (String(meta.dataType || '').toLowerCase() === 'optionlist') {
      const states = parseValuesList(meta.valuesList);
      if (states) common.states = states;
    }
    return common;
  }

  async _upsertConfigurationState(identity, meta, value, hasValue = true) {
    await this.ensureStructure(identity);
    const stateKey = String(meta.stateKey || '').trim();
    if (!stateKey || RESERVED_CONFIGURATION_KEYS.has(stateKey)) throw new Error(`Invalid configuration state key ${stateKey || '<empty>'}`);
    const relId = `${identity}.configuration.${stateKey}`;
    let existing;
    try {
      if (typeof this.getObjectAsync === 'function') existing = await this.getObjectAsync(relId);
      else if (typeof this.getForeignObjectAsync === 'function') existing = await this.getForeignObjectAsync(`${this.namespace}.${relId}`);
    } catch (error) {
      this.log.debug(`Could not inspect OCPP configuration object ${relId}: ${error && error.message || error}`);
    }
    const previousNative = existing && existing.native && existing.native.ocppConfiguration;
    const cachedConfirmed = this._configurationValueCache.has(relId)
      ? this._configurationValueCache.get(relId)
      : previousNative && Object.prototype.hasOwnProperty.call(previousNative, 'lastConfirmedValue')
        ? previousNative.lastConfirmedValue
        : undefined;
    const storedMeta = {
      ...meta,
      stateKey,
      stateId: relId,
      stale: false,
      inventoryPending: meta.inventoryPending === true,
    };
    storedMeta.sensitive = meta.sensitive === true || configurationSensitive(storedMeta);
    const effectiveHasValue = hasValue && !storedMeta.sensitive;
    if (!effectiveHasValue && !storedMeta.sensitive && cachedConfirmed !== undefined) {
      storedMeta.lastConfirmedValue = cachedConfirmed;
      storedMeta.lastConfirmedAt = previousNative && previousNative.lastConfirmedAt;
    }
    const common = this._configurationStateCommon(storedMeta, effectiveHasValue ? value : cachedConfirmed);
    const native = { ocppConfiguration: this._configurationNative(storedMeta, value, effectiveHasValue) };
    if (!existing) {
      await this.setObjectNotExistsAsync(relId, { type: 'state', common, native });
    } else if (typeof this.extendObjectAsync === 'function') {
      await this.extendObjectAsync(relId, { common, native });
    }
    this._dpObjCache.add(relId);
    this._configurationIndex.set(relId, storedMeta);
    this._configurationIndex.set(`${this.namespace}.${relId}`, storedMeta);
    this._configurationMap(identity).set(stateKey, storedMeta);
    if (storedMeta.sensitive) {
      this._configurationValueCache.delete(relId);
      await this._setStateFreshAsync(relId, '', true, 'configuration');
    } else if (effectiveHasValue) {
      this._configurationValueCache.set(relId, value);
      await this._setStateFreshAsync(relId, value, true, 'configuration');
    }
    return relId;
  }

  async _recordConfigurationStatus(identity, patch = {}) {
    await this.ensureStructure(identity);
    const known = new Set([
      'lastRefresh', 'status', 'error', 'count', 'reportInProgress', 'requestId', 'lastSequence',
      'lastChangedKey', 'lastChangedAt', 'lastChangeStatus', 'lastChangeResponse', 'rebootRequired',
      'unknownKeysJson', 'indexJson',
    ]);
    for (const [key, rawValue] of Object.entries(patch)) {
      if (!known.has(key) || rawValue === undefined) continue;
      let value = rawValue;
      if (['lastChangeResponse', 'unknownKeysJson', 'indexJson'].includes(key) && typeof value !== 'string') {
        value = this._stringifyControlValue(value);
      }
      await this._setStateFreshAsync(`${identity}.configuration.${key}`, value, true, 'configuration');
    }
  }

  async _updateConfigurationIndex(identity) {
    const map = this._configurationMap(identity);
    const index = {};
    for (const [stateKey, meta] of [...map.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      if (meta.kind === 'ocpp16') {
        index[stateKey] = {
          protocol: meta.protocol,
          key: meta.key,
          dataType: meta.dataType,
          sensitive: meta.sensitive === true || configurationSensitive(meta),
          stale: meta.stale === true,
          inventoryPending: meta.inventoryPending === true,
          writable: configurationWritable(meta, this.config.configurationWriteEnabled !== false),
        };
      } else {
        index[stateKey] = {
          protocol: meta.protocol,
          component: meta.component && meta.component.name,
          componentInstance: meta.component && meta.component.instance,
          evseId: meta.component && meta.component.evse && meta.component.evse.id,
          connectorId: meta.component && meta.component.evse && meta.component.evse.connectorId,
          variable: meta.variable && meta.variable.name,
          variableInstance: meta.variable && meta.variable.instance,
          attributeType: meta.attributeType || 'Actual',
          dataType: meta.dataType,
          unit: meta.unit,
          sensitive: meta.sensitive === true || configurationSensitive(meta),
          stale: meta.stale === true,
          inventoryPending: meta.inventoryPending === true,
          writable: configurationWritable(meta, this.config.configurationWriteEnabled !== false),
        };
      }
      for (const key of Object.keys(index[stateKey])) if (index[stateKey][key] === undefined) delete index[stateKey][key];
    }
    await this._recordConfigurationStatus(identity, { indexJson: index });
  }

  async _hydrateConfigurationIndex(identity) {
    if (typeof this.getObjectViewAsync !== 'function') return 0;
    const prefix = `${this.namespace}.${identity}.configuration.`;
    let view;
    try {
      view = await this.getObjectViewAsync('system', 'state', {
        startkey: prefix,
        endkey: `${prefix}\u9999`,
      });
    } catch (error) {
      this.log.debug(`Could not load existing OCPP configuration objects for ${identity}: ${error && error.message || error}`);
      return 0;
    }

    let hydrated = 0;
    const rows = Array.isArray(view && view.rows) ? view.rows : [];
    for (const row of rows) {
      const fullId = String(row && row.id || '');
      const relId = this._stripNs(fullId);
      const stateKey = relId.startsWith(`${identity}.configuration.`)
        ? relId.slice(`${identity}.configuration.`.length)
        : '';
      if (!stateKey || stateKey.includes('.') || RESERVED_CONFIGURATION_KEYS.has(stateKey)) continue;
      const object = row && (row.value || row.doc);
      const nativeMeta = object && object.native && object.native.ocppConfiguration;
      if (!nativeMeta || !['ocpp16', 'deviceModel'].includes(nativeMeta.kind)) continue;
      const meta = {
        ...nativeMeta,
        component: cloneOcppReference(nativeMeta.component),
        variable: cloneOcppReference(nativeMeta.variable),
        stateKey: nativeMeta.stateKey || stateKey,
        stateId: relId,
      };
      this._configurationIndex.set(relId, meta);
      this._configurationIndex.set(`${this.namespace}.${relId}`, meta);
      this._configurationMap(identity).set(meta.stateKey, meta);
      if (meta.sensitive !== true && Object.prototype.hasOwnProperty.call(meta, 'lastConfirmedValue')
        && meta.lastConfirmedValue !== null) {
        this._configurationValueCache.set(relId, meta.lastConfirmedValue);
      }
      hydrated++;
    }
    return hydrated;
  }

  async _setConfigurationInventoryPending(identity, protocol, pending) {
    const map = this._configurationMap(identity);
    let changed = 0;
    for (const [stateKey, currentMeta] of map.entries()) {
      if (!currentMeta || currentMeta.protocol !== protocol || currentMeta.stale === true
        || currentMeta.inventoryPending === pending) continue;
      const relId = `${identity}.configuration.${stateKey}`;
      const meta = { ...currentMeta, inventoryPending: pending === true, stateKey, stateId: relId };
      this._configurationIndex.set(relId, meta);
      this._configurationIndex.set(`${this.namespace}.${relId}`, meta);
      map.set(stateKey, meta);
      const currentValue = this._configurationValueCache.has(relId)
        ? this._configurationValueCache.get(relId)
        : meta.lastConfirmedValue;
      try {
        if (typeof this.extendObjectAsync === 'function') {
          await this.extendObjectAsync(relId, {
            common: this._configurationStateCommon(meta, currentValue),
            native: { ocppConfiguration: this._configurationNative(meta, currentValue, false) },
          });
        }
      } catch (error) {
        this.log.debug(`Could not update OCPP configuration inventory state ${relId}: ${error && error.message || error}`);
      }
      changed++;
    }
    return changed;
  }

  async _finalizeConfigurationInventoryStates(identity, seenStateKeys, protocol) {
    const seen = seenStateKeys instanceof Set ? seenStateKeys : new Set(seenStateKeys || []);
    const map = this._configurationMap(identity);
    let finalized = 0;
    for (const stateKey of seen) {
      const currentMeta = map.get(stateKey);
      if (!currentMeta || currentMeta.protocol !== protocol) continue;
      const relId = `${identity}.configuration.${stateKey}`;
      const meta = {
        ...currentMeta,
        stale: false,
        inventoryPending: false,
        stateKey,
        stateId: relId,
      };
      this._configurationIndex.set(relId, meta);
      this._configurationIndex.set(`${this.namespace}.${relId}`, meta);
      map.set(stateKey, meta);
      const currentValue = this._configurationValueCache.has(relId)
        ? this._configurationValueCache.get(relId)
        : meta.lastConfirmedValue;
      try {
        if (typeof this.extendObjectAsync === 'function') {
          await this.extendObjectAsync(relId, {
            common: this._configurationStateCommon(meta, currentValue),
            native: { ocppConfiguration: this._configurationNative(meta, currentValue, false) },
          });
        }
      } catch (error) {
        this.log.debug(`Could not finalize OCPP configuration state ${relId}: ${error && error.message || error}`);
      }
      finalized++;
    }
    return finalized;
  }

  _queueOutboundControlOperation(identity, entry, task) {
    const run = async () => {
      if (this.runtimeIndex.get(identity) !== entry || !entry.client) {
        throw new Error('Charging station is not connected');
      }
      const lease = this._eosLeases.get(identity);
      if (lease?.armed && (!this._eosLeaseFresh(lease) || lease.stopRequired)) throw new Error('EOS_LEASE_EXPIRED');
      return task();
    };
    entry.outboundControlTail = Promise.resolve(entry.outboundControlTail).then(run, run);
    return entry.outboundControlTail;
  }

  async _restoreConfigurationState(relId, meta) {
    const rel = this._stripNs(relId);
    if (meta && (meta.sensitive === true || configurationSensitive(meta))) {
      await this._setStateFreshAsync(rel, '', true, 'configuration');
      return '';
    }
    if (this._configurationValueCache.has(rel)) {
      const value = this._configurationValueCache.get(rel);
      await this._setStateFreshAsync(rel, value, true, 'configuration');
      return value;
    }
    if (meta && Object.prototype.hasOwnProperty.call(meta, 'lastConfirmedValue') && meta.lastConfirmedValue !== null) {
      await this._setStateFreshAsync(rel, meta.lastConfirmedValue, true, 'configuration');
      return meta.lastConfirmedValue;
    }
    // No value was ever confirmed by the station. Acknowledging the user's
    // rejected value would be misleading, so expose an explicit empty state.
    await this._setStateFreshAsync(rel, null, true, 'configuration');
    return null;
  }

  async _retireMissingConfigurationStates(identity, seenStateKeys, protocol) {
    const seen = seenStateKeys instanceof Set ? seenStateKeys : new Set(seenStateKeys || []);
    const map = this._configurationMap(identity);
    let retired = 0;
    for (const [stateKey, currentMeta] of map.entries()) {
      if (!currentMeta || seen.has(stateKey) || currentMeta.stale === true) continue;
      const relId = `${identity}.configuration.${stateKey}`;
      const meta = {
        ...currentMeta,
        stale: true,
        inventoryPending: false,
        stateKey,
        stateId: relId,
      };
      if (!Object.prototype.hasOwnProperty.call(meta, 'lastConfirmedValue') && this._configurationValueCache.has(relId)) {
        meta.lastConfirmedValue = this._configurationValueCache.get(relId);
      }
      this._configurationIndex.set(relId, meta);
      this._configurationIndex.set(`${this.namespace}.${relId}`, meta);
      map.set(stateKey, meta);
      const currentValue = this._configurationValueCache.has(relId)
        ? this._configurationValueCache.get(relId)
        : meta.lastConfirmedValue;
      try {
        if (typeof this.extendObjectAsync === 'function') {
          await this.extendObjectAsync(relId, {
            common: this._configurationStateCommon(meta, currentValue),
            native: { ocppConfiguration: this._configurationNative(meta, currentValue, false) },
          });
        }
      } catch (error) {
        this.log.debug(`Could not retire stale OCPP configuration state ${relId}: ${error && error.message || error}`);
      }
      retired++;
    }
    return retired;
  }

  _nextConfigurationRequestId(entry) {
    const current = Math.max(0, Math.trunc(Number(entry && entry.configurationRequestId) || 0));
    const next = current >= 0x7ffffffe ? 1 : current + 1;
    if (entry) entry.configurationRequestId = next;
    return next;
  }

  _typedConfigurationValue(meta, valueString) {
    if (meta && meta.kind === 'ocpp16') return inferOcpp16Value(valueString).val;
    const parsed = parseDeviceModelValue(valueString, meta && meta.dataType || 'string');
    return parsed.val === undefined ? String(valueString ?? '') : parsed.val;
  }

  async _persistConfigurationConfirmedValue(relId, meta, value) {
    const rel = this._stripNs(relId);
    const sensitive = meta.sensitive === true || configurationSensitive(meta);
    meta.sensitive = sensitive;
    if (sensitive) {
      this._configurationValueCache.delete(rel);
      delete meta.lastConfirmedValue;
      delete meta.lastConfirmedAt;
    } else {
      this._configurationValueCache.set(rel, value);
      meta.lastConfirmedValue = value;
      meta.lastConfirmedAt = new Date().toISOString();
    }
    this._configurationIndex.set(rel, meta);
    this._configurationIndex.set(`${this.namespace}.${rel}`, meta);
    try {
      if (typeof this.extendObjectAsync === 'function') {
        await this.extendObjectAsync(rel, {
          native: { ocppConfiguration: this._configurationNative(meta, value, !sensitive) },
        });
      }
    } catch (error) {
      this.log.debug(`Could not persist confirmed OCPP configuration metadata for ${rel}: ${error && error.message || error}`);
    }
    await this._setStateFreshAsync(rel, sensitive ? '' : value, true, 'configuration');
  }

  async _resolveConfigurationMeta(relId) {
    const rel = this._stripNs(String(relId || ''));
    let meta = this._configurationIndex.get(rel) || this._configurationIndex.get(`${this.namespace}.${rel}`);
    if (meta) return meta;
    let object;
    try {
      if (typeof this.getObjectAsync === 'function') object = await this.getObjectAsync(rel);
      else if (typeof this.getForeignObjectAsync === 'function') object = await this.getForeignObjectAsync(`${this.namespace}.${rel}`);
    } catch (error) {
      this.log.debug(`Could not load OCPP configuration metadata for ${rel}: ${error && error.message || error}`);
    }
    const nativeMeta = object && object.native && object.native.ocppConfiguration;
    if (!nativeMeta || !['ocpp16', 'deviceModel'].includes(nativeMeta.kind)) return undefined;
    meta = {
      ...nativeMeta,
      component: cloneOcppReference(nativeMeta.component),
      variable: cloneOcppReference(nativeMeta.variable),
      stateKey: nativeMeta.stateKey || rel.split('.').pop(),
      stateId: rel,
    };
    this._configurationIndex.set(rel, meta);
    this._configurationIndex.set(`${this.namespace}.${rel}`, meta);
    const identity = this._identityFromStateId(rel);
    if (identity && meta.stateKey) this._configurationMap(identity).set(meta.stateKey, meta);
    if (nativeMeta.sensitive !== true && Object.prototype.hasOwnProperty.call(nativeMeta, 'lastConfirmedValue')
      && nativeMeta.lastConfirmedValue !== null) {
      this._configurationValueCache.set(rel, nativeMeta.lastConfirmedValue);
    }
    return meta;
  }

  async ingestConfiguration16(identity, response) {
    const list = Array.isArray(response && response.configurationKey) ? response.configurationKey : [];
    const seenStateKeys = new Set();
    for (const item of list) {
      const key = String(item && item.key || '').trim();
      if (!key) continue;
      const parsed = inferOcpp16Value(item && item.value);
      const stateKey = configurationStateKey16(key);
      seenStateKeys.add(stateKey);
      await this._upsertConfigurationState(identity, {
        kind: 'ocpp16',
        protocol: 'ocpp1.6',
        canonicalKey: canonicalConfigurationKey16(key),
        key,
        readonly: !(item && item.readonly === false),
        dataType: parsed.dataType,
        stateType: parsed.type,
        stateKey,
      }, parsed.val, true);
    }
    await this._retireMissingConfigurationStates(identity, seenStateKeys, 'ocpp1.6');
    const unknown = Array.isArray(response && response.unknownKey) ? response.unknownKey.map(String) : [];
    const entry = this.runtimeIndex.get(identity);
    if (entry) {
      entry.configurationRefreshInFlight = false;
      entry.configurationPendingRequestId = 0;
      entry.configurationReportDeadlineAt = 0;
      entry.configurationInventorySeen = seenStateKeys;
      entry.configurationReportSequences = new Set();
    }
    await this._updateConfigurationIndex(identity);
    await this._recordConfigurationStatus(identity, {
      status: list.length ? 'ready' : 'empty',
      error: '',
      count: seenStateKeys.size,
      reportInProgress: false,
      lastRefresh: new Date().toISOString(),
      unknownKeysJson: unknown,
    });
    return list.length;
  }

  async _refreshConfiguration(identity, options = {}) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry || !entry.client) {
      await this._recordConfigurationStatus(identity, {
        status: 'offline', error: 'Charging station is not connected', reportInProgress: false,
      });
      throw new Error('Charging station is not connected');
    }
    if (entry.transactionActive && this.config.allowConfigurationDuringCharging !== true) {
      await this._recordConfigurationStatus(identity, {
        status: 'busy-charging',
        error: 'Configuration operations are disabled during an active charging transaction',
        reportInProgress: false,
      });
      throw new Error('Configuration operations are disabled during an active charging transaction');
    }
    if ((entry.smartChargingPending || 0) > 0 || entry.refreshInFlight || (entry.configurationPending || 0) > 0) {
      await this._recordConfigurationStatus(identity, {
        status: 'busy',
        error: 'Another station command or refresh is still in progress',
        reportInProgress: false,
      });
      throw new Error('Another station command or refresh is still in progress');
    }
    if (entry.configurationRefreshInFlight) return { status: 'AlreadyInProgress' };
    const requestId = entry.proto === 'ocpp1.6' ? 0 : this._nextConfigurationRequestId(entry);
    const call = buildConfigurationRefreshCall(entry.proto, requestId);
    entry.configurationRefreshInFlight = true;
    entry.configurationPendingRequestId = requestId;
    entry.configurationReportRequestId = requestId;
    entry.configurationInventorySeen = new Set();
    entry.configurationReportSequences = new Set();
    entry.configurationReportCount = 0;
    // The outbound CALL has its own command timeout. Start the longer
    // asynchronous NotifyReport timeout only after GetBaseReport was accepted.
    entry.configurationReportDeadlineAt = 0;
    let response;
    try {
      // Load configuration objects that survived an adapter restart before the
      // new inventory is compared. Without this hydration a removed firmware
      // variable could remain visibly writable until the station rejects it.
      await this._hydrateConfigurationIndex(identity);
      if (entry.proto === 'ocpp2.0.1' || entry.proto === 'ocpp2.1') {
        // OCPP 2.x inventories arrive asynchronously. Existing values become
        // temporarily read-only until the complete matching report is received.
        // A timeout therefore cannot leave a partially refreshed mapping writable.
        const pendingChanged = await this._setConfigurationInventoryPending(identity, entry.proto, true);
        if (pendingChanged) await this._updateConfigurationIndex(identity);
      }
      await this._recordConfigurationStatus(identity, {
        status: options.automatic ? 'auto-refreshing' : 'refreshing',
        error: '',
        reportInProgress: entry.proto !== 'ocpp1.6',
        requestId,
      });
      // Configuration reads share the same per-station outbound command slot as
      // Smart Charging and configuration writes. The potentially large
      // asynchronous NotifyReport itself remains inbound and does not block
      // later EOS charging limits after GetBaseReport has been acknowledged.
      response = await this._queueOutboundControlOperation(
        identity,
        entry,
        () => this._callClient(identity, call.method, call.payload, { capture: false }),
      );
      const interpreted = interpretConfigurationRefreshResponse(entry.proto, response);
      if (!interpreted.accepted) throw new Error(`${call.method} returned status ${interpreted.status}`);
      await this._recordControlResult(identity, call.method, configurationRefreshDiagnostic(entry.proto, response), undefined);
      if (entry.proto === 'ocpp1.6') {
        await this.ingestConfiguration16(identity, response);
        return { status: 'Accepted', response };
      }
      if (interpreted.empty) {
        await this._retireMissingConfigurationStates(identity, new Set(), entry.proto);
        await this._updateConfigurationIndex(identity);
        entry.configurationRefreshInFlight = false;
        entry.configurationPendingRequestId = 0;
        entry.configurationReportDeadlineAt = 0;
        entry.configurationInventorySeen = new Set();
        entry.configurationReportSequences = new Set();
        await this._recordConfigurationStatus(identity, {
          status: 'empty', error: '', count: 0, reportInProgress: false, lastRefresh: new Date().toISOString(), requestId,
        });
        return { status: interpreted.status, response };
      }
      entry.configurationReportDeadlineAt = Date.now()
        + Math.max(30, Number(this.config.configurationReportTimeoutSec) || 120) * 1000;
      await this._recordConfigurationStatus(identity, {
        status: 'waiting-report', error: '', reportInProgress: true, requestId,
      });
      return { status: interpreted.status, response, reportExpected: true, requestId };
    } catch (error) {
      entry.configurationRefreshInFlight = false;
      entry.configurationPendingRequestId = 0;
      entry.configurationReportDeadlineAt = 0;
      entry.configurationInventorySeen = new Set();
      entry.configurationReportSequences = new Set();
      await this._recordControlResult(identity, call.method, response, error);
      await this._recordConfigurationStatus(identity, {
        status: /notsupported|not supported/i.test(String(error && error.message || error)) ? 'not-supported' : 'error',
        error: String(error && error.message || error),
        reportInProgress: false,
        requestId,
      });
      throw error;
    }
  }

  async _maybeAutoRefreshConfiguration(identity, entry, now = Date.now()) {
    if (this.config.autoConfigurationRefresh !== true || !entry || !entry.client || !entry.booted) return;
    if (entry.configurationAutoRefreshDone || entry.configurationRefreshInFlight || now < (entry.configurationAutoRefreshAt || 0)) return;
    if (entry.transactionActive || (entry.smartChargingPending || 0) > 0 || entry.refreshInFlight || (entry.configurationPending || 0) > 0) {
      entry.configurationAutoRefreshAt = now + 60_000;
      return;
    }
    if (entry.lastOutboundAt && now - entry.lastOutboundAt < 10_000) {
      entry.configurationAutoRefreshAt = now + 30_000;
      return;
    }
    entry.configurationAutoRefreshDone = true;
    try {
      await this._refreshConfiguration(identity, { automatic: true });
    } catch (error) {
      this.log.warn(`Automatic OCPP configuration refresh failed (${identity}): ${error && error.message || error}`);
    }
  }

  async _writeConfigurationValue(identity, relId, requestedValue, isCurrent = () => true) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry || !entry.client) throw new Error('Charging station is not connected');
    const rel = this._stripNs(relId);
    const lease = this._eosLeases.get(identity);
    if (lease?.armed && (!this._eosLeaseFresh(lease) || lease.stopRequired)) throw new Error('EOS_LEASE_EXPIRED');
    const meta = await this._resolveConfigurationMeta(rel);
    if (!meta) throw new Error('Missing OCPP configuration metadata; refresh the configuration inventory first');
    if (meta.protocol && meta.protocol !== entry.proto) {
      throw new Error(`Configuration mapping belongs to ${meta.protocol}; refresh it for the connected ${entry.proto} session first`);
    }
    if (entry.configurationRefreshInFlight) {
      throw new Error('Configuration inventory refresh is still in progress');
    }
    if (entry.transactionActive && this.config.allowConfigurationDuringCharging !== true) {
      throw new Error('Configuration operations are disabled during an active charging transaction');
    }
    if (!configurationWritable(meta, this.config.configurationWriteEnabled !== false)) throw new Error('This OCPP configuration value is read-only');
    if (!isCurrent()) return { status: 'Superseded' };
    const sensitive = meta.sensitive === true || configurationSensitive(meta);
    if (sensitive) await this._setStateFreshAsync(rel, '', true, 'configuration');
    const call = buildConfigurationWriteCall(entry.proto, meta, requestedValue);
    const changedKey = meta.kind === 'ocpp16' ? meta.key : this._configurationDisplayName(meta);
    await this._recordConfigurationStatus(identity, {
      status: 'write-pending', error: '', lastChangedKey: changedKey, lastChangedAt: new Date().toISOString(),
    });
    let response;
    try {
      if (lease?.armed && (!this._eosLeaseFresh(lease) || lease.stopRequired)) throw new Error('EOS_LEASE_EXPIRED');
      response = await this._callClient(identity, call.method, call.payload, { capture: false });
      const result = interpretConfigurationWriteResponse(entry.proto, response);
      if (!result.accepted) throw new Error(`${call.method} returned status ${result.status}`);
      if (!isCurrent()) return { status: 'Superseded', response };
      const confirmedValue = this._typedConfigurationValue(meta, call.valueString);
      await this._persistConfigurationConfirmedValue(rel, meta, confirmedValue);
      if (result.rebootRequired) entry.configurationRebootRequired = true;
      await this._recordControlResult(identity, call.method, response, undefined);
      await this._recordConfigurationStatus(identity, {
        status: result.rebootRequired ? 'reboot-required' : 'write-accepted',
        error: '',
        lastChangedKey: changedKey,
        lastChangedAt: new Date().toISOString(),
        lastChangeStatus: result.status,
        lastChangeResponse: response,
        rebootRequired: entry.configurationRebootRequired === true,
      });
      return { ...result, response, confirmedValue, method: call.method };
    } catch (error) {
      const status = response ? interpretConfigurationWriteResponse(entry.proto, response).status : 'Error';
      await this._recordControlResult(identity, call.method, response, error);
      await this._recordConfigurationStatus(identity, {
        status: 'write-error',
        error: String(error && error.message || error),
        lastChangedKey: changedKey,
        lastChangedAt: new Date().toISOString(),
        lastChangeStatus: status,
        lastChangeResponse: response || {},
      });
      await this._restoreConfigurationState(rel, meta);
      throw error;
    }
  }

  _queueConfigurationWrite(identity, relId, requestedValue) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry || !entry.client) return Promise.reject(new Error('Charging station is not connected'));
    const rel = this._stripNs(relId);
    const generation = (entry.configurationWriteGeneration.get(rel) || 0) + 1;
    entry.configurationWriteGeneration.set(rel, generation);
    entry.configurationPending = Math.max(0, Number(entry.configurationPending) || 0) + 1;
    const run = async () => {
      try {
        return await this._writeConfigurationValue(
          identity,
          rel,
          requestedValue,
          () => this.runtimeIndex.get(identity) === entry && entry.client && entry.configurationWriteGeneration.get(rel) === generation,
        );
      } finally {
        entry.configurationPending = Math.max(0, (Number(entry.configurationPending) || 1) - 1);
      }
    };
    entry.outboundControlTail = Promise.resolve(entry.outboundControlTail).then(run, run);
    entry.configurationTail = entry.outboundControlTail;
    return entry.outboundControlTail;
  }

  _buildChargingProfileCall(protocol, limit, rateUnit, phases, identity, functionKey = 'eos-charge-limit') {
    const connectorId = this.config.smartChargingConnectorId === 0 ? 0 : Math.max(1, Math.trunc(Number(this.config.smartChargingConnectorId) || 1));
    const scope = protocol === 'ocpp1.6' ? `connector-${connectorId}` : 'charging-station';
    const { chargingProfileId, scheduleId } = deterministicChargingProfileIds(identity, functionKey, scope);
    if (protocol === 'ocpp1.6') {
      return {
        method: 'SetChargingProfile',
        payload: {
          connectorId,
          csChargingProfiles: {
            chargingProfileId,
            stackLevel: 0,
            chargingProfilePurpose: connectorId === 0 ? 'ChargePointMaxProfile' : 'TxDefaultProfile',
            chargingProfileKind: 'Absolute',
            chargingSchedule: {
              chargingRateUnit: rateUnit,
              chargingSchedulePeriod: [{ startPeriod: 0, limit, numberPhases: phases }],
            },
          },
        },
      };
    }
    return {
      method: 'SetChargingProfile',
      payload: {
        evseId: 0,
        chargingProfile: {
          id: chargingProfileId,
          stackLevel: 0,
          chargingProfilePurpose: 'ChargingStationMaxProfile',
          chargingProfileKind: 'Absolute',
          chargingSchedule: [{
            id: scheduleId,
            chargingRateUnit: rateUnit,
            chargingSchedulePeriod: [{ startPeriod: 0, limit, numberPhases: phases }],
          }],
        },
      },
    };
  }

  _buildClearChargingProfileCall(protocol, identity, functionKey = 'eos-charge-limit') {
    const connectorId = this.config.smartChargingConnectorId === 0 ? 0 : Math.max(1, Math.trunc(Number(this.config.smartChargingConnectorId) || 1));
    const scope = protocol === 'ocpp1.6' ? `connector-${connectorId}` : 'charging-station';
    const { chargingProfileId } = deterministicChargingProfileIds(identity, functionKey, scope);
    if (protocol === 'ocpp1.6') {
      return { method: 'ClearChargingProfile', payload: { id: chargingProfileId } };
    }
    return { method: 'ClearChargingProfile', payload: { chargingProfileId } };
  }

  _ensureEosLease(identity) {
    const existing = this._eosLeases.get(identity);
    if (existing) return existing.ready;
    const lease = { armed: false, active: false, untilMs: 0, deadline: 0, lastEventTs: 0,
      stopRequired: false, stopPending: false, stopSessionId: '', lastStopAttemptMono: -Infinity, updateTail: Promise.resolve() };
    this._eosLeases.set(identity, lease);
    lease.ready = (async () => {
      await this.ensureStructure(identity);
      const persisted = await this.getStateAsync(`${identity}.control.eosLeaseArmed`);
      lease.armed = persisted?.val === true;
      lease.stopRequired = lease.armed;
      await this._setStateFreshAsync(`${identity}.info.eosControlLeaseSupported`, true, true, 'control');
      await this._setStateFreshAsync(`${identity}.control.eosLeaseState`, lease.armed ? 'expired-awaiting-renewal' : 'unarmed', true, 'control');
      return lease;
    })().catch(error => {
      if (this._eosLeases.get(identity) === lease) this._eosLeases.delete(identity);
      throw error;
    });
    return lease.ready;
  }

  _eosLeaseFresh(lease) {
    return !lease?.armed || (lease.active && Date.now() < lease.untilMs && performance.now() < lease.deadline);
  }

  async _renewEosLease(identity, state) {
    const lease = await this._ensureEosLease(identity);
    const run = async () => {
      const now = Date.now();
      const ts = state.ts;
      // Only a new live ioBroker write event may renew a lease. Never replay a
      // persisted future deadline after startup or accept an older queued event.
      if (state.ack !== false || (state.q !== undefined && state.q !== 0) || typeof ts !== 'number' || !Number.isFinite(ts) || ts < this._startedAtMs || ts <= lease.lastEventTs || ts > now + 1000 || now - ts > 5000) return false;
      lease.lastEventTs = ts;
      const until = state.val;
      const accepted = typeof until === 'number' && Number.isFinite(until) && until > now && until <= now + 30000;
      if (accepted) {
        const wasExpired = lease.armed && !this._eosLeaseFresh(lease);
        lease.armed = true;
        // Persist the latch BEFORE permitting positive power. If this write
        // fails, the lease remains inactive and no positive command is allowed.
        await this._setStateFreshAsync(`${identity}.control.eosLeaseArmed`, true, true, 'control');
        lease.untilMs = until;
        lease.deadline = performance.now() + Math.max(0, until - Date.now());
        lease.active = true;
        if (wasExpired && !lease.stopSessionId) lease.stopRequired = true;
      } else if (lease.armed) {
        lease.active = false;
        lease.untilMs = 0;
        lease.deadline = 0;
        lease.stopRequired = true;
        lease.stopSessionId = '';
      }
      await this._setStateFreshAsync(`${identity}.control.eosLeaseState`, !lease.armed ? 'unarmed-invalid-renewal'
        : !this._eosLeaseFresh(lease) ? 'expired' : lease.stopRequired ? 'renewed-awaiting-zero' : 'active', true, 'control');
      const current = await this.getStateAsync(`${identity}.control.eosLeaseUntilMs`);
      if (current?.ack === false && current.ts === state.ts && current.val === state.val) {
        await this._setStateFreshAsync(`${identity}.control.eosLeaseUntilMs`, state.val, true, 'control');
      }
      return accepted;
    };
    const update = lease.updateTail.then(run, run);
    lease.updateTail = update.catch(() => {
      lease.active = false;
      if (lease.armed) { lease.stopRequired = true; lease.stopSessionId = ''; }
    });
    return update;
  }

  async _eosLeaseWatchdogCycle() {
    if (this._shuttingDown || this._eosLeaseWatchdogRunning) return;
    this._eosLeaseWatchdogRunning = true;
    try {
      for (const [identity, entry] of this.runtimeIndex) {
        try {
          let lease;
          try { lease = await this._ensureEosLease(identity); }
          catch (error) { this.log.warn(`EOS lease state unavailable (${identity}): ${error.message}`); continue; }
          if (!lease.armed) continue;
          if (!this._eosLeaseFresh(lease) && lease.active) {
            lease.active = false;
            lease.stopRequired = true;
            lease.stopSessionId = '';
          }
          if (!lease.stopRequired || lease.stopPending) continue;
          this._publishChargeLimitStatus(identity, entry, { valid: false, reason: 'EOS_LEASE_EXPIRED', error: 'EOS_LEASE_EXPIRED' })
            .catch(() => this.log.warn(`EOS lease invalidation publication failed (${identity})`));
          if (!entry.client || !entry.socketConnected) {
            this._setStateFreshAsync(`${identity}.control.eosLeaseState`, 'expired-offline-zero-unconfirmed', true, 'control')
              .catch(() => this.log.warn(`EOS lease offline status unavailable (${identity})`));
            continue;
          }
          if (performance.now() - lease.lastStopAttemptMono < 5000) continue;
          lease.lastStopAttemptMono = performance.now();
          lease.stopPending = true;
          this._setStateFreshAsync(`${identity}.control.eosLeaseState`, 'expired-zero-pending', true, 'control')
            .catch(() => this.log.warn(`EOS lease pending publication failed (${identity})`));
          // Existing outbound serialization keeps a late positive CALLRESULT in
          // front of this zero command. Its generation can no longer confirm it.
          this._queueSmartCharging(identity, 0, 'W', 3).then(async result => {
            if (this.runtimeIndex.get(identity) !== entry || !entry.socketConnected || !['Applied', 'Unchanged'].includes(result.status)) return;
            lease.stopRequired = false;
            lease.stopSessionId = entry.sessionId;
            await this._setStateFreshAsync(`${identity}.control.eosLeaseState`, this._eosLeaseFresh(lease) ? 'active-awaiting-new-setpoint' : 'expired-zero-confirmed', true, 'control');
          }).catch(async error => {
            this.log.warn(`EOS lease zero not confirmed (${identity}): ${error.message}`);
            await this._setStateFreshAsync(`${identity}.control.eosLeaseState`, 'expired-zero-failed', true, 'control');
          }).finally(() => { lease.stopPending = false; }).catch(error => {
            this.log.warn(`EOS lease diagnostic publication failed (${identity}): EOS_LEASE_DIAGNOSTIC_FAILED`);
          });
        } catch (error) {
          this.log.warn(`EOS lease station check failed (${identity}): EOS_LEASE_CHECK_FAILED`);
        }
      }
    } catch (error) {
      this.log.warn(`EOS lease watchdog failed: ${error.message}`);
    } finally {
      this._eosLeaseWatchdogRunning = false;
    }
  }

  _publishChargeLimitStatus(identity, entry, patch, isCurrent = () => true, legacyResult = null) {
    const sessionId = entry?.sessionId || '';
    const client = entry?.client;
    const current = () => this.runtimeIndex.get(identity) === entry && isCurrent();
    const valid = () => current() && !!client && entry.client === client && entry.socketConnected && !this._shuttingDown
      && (!(patch.appliedW > 0) || (this._eosLeaseFresh(this._eosLeases.get(identity)) && !this._eosLeases.get(identity)?.stopRequired));
    const finiteW = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
    const code = value => String(value || '').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
    const run = async () => {
      await this.ensureStructure(identity);
      if (entry?.sessionPublication) await entry.sessionPublication;
      if (!current() || (patch.valid && !valid())) return false;
      const status = {
        schema: 1, valid: patch.valid === true,
        requestedW: finiteW(patch.requestedW), appliedW: patch.valid ? finiteW(patch.appliedW) : null,
        appliedAtMs: patch.valid && Number.isFinite(patch.appliedAtMs) ? patch.appliedAtMs : 0,
        sessionId, updatedAtMs: Date.now(), reason: code(patch.reason), error: code(patch.error),
      };
      // Legacy fields remain supported, with validity false throughout updates.
      await this._setStateFreshAsync(`${identity}.control.appliedChargeLimitValid`, false, true, 'control');
      if (!current() || (status.valid && !valid())) return false;
      if (legacyResult) {
        const fields = {
          requestedChargeLimit: legacyResult.requestedLimit,
          appliedChargeLimit: legacyResult.effectiveLimit,
          appliedChargeLimitUnit: legacyResult.rateUnit,
          appliedChargeLimitW: legacyResult.effectiveLimitW,
          chargeLimitReason: String(legacyResult.reason || ''),
          chargeLimitClamped: legacyResult.effectiveLimit !== legacyResult.requestedLimit,
        };
        for (const [key, value] of Object.entries(fields)) {
          if (!valid()) return false;
          await this._setStateFreshAsync(`${identity}.control.${key}`, value, true, 'control');
        }
      }
      if (!current() || (status.valid && !valid())) return false;
      // This single JSON value is the authoritative, internally consistent result.
      await this._setStateFreshAsync(`${identity}.control.chargeLimitStatus`, JSON.stringify(status), true, 'control');
      if (status.valid && valid()) {
        await this._setStateFreshAsync(`${identity}.control.appliedChargeLimitValid`, true, true, 'control');
      }
      if (status.valid && !valid()) {
        // A reconnect/new request can happen while an ioBroker write is awaited.
        // Serialize this invalidation before the next session/request publication.
        const invalid = { ...status, valid: false, appliedW: null, appliedAtMs: 0,
          updatedAtMs: Date.now(), reason: 'superseded', error: '' };
        await this._setStateFreshAsync(`${identity}.control.appliedChargeLimitValid`, false, true, 'control');
        await this._setStateFreshAsync(`${identity}.control.chargeLimitStatus`, JSON.stringify(invalid), true, 'control');
        return false;
      }
      return true;
    };
    const previous = this._chargeLimitPublications.get(identity) || Promise.resolve();
    const publication = previous.then(run, run);
    this._chargeLimitPublications.set(identity, publication);
    return publication;
  }

  async _persistSmartChargingResult(identity, result, entry, isCurrent) {
    const expired = !this._eosLeaseFresh(this._eosLeases.get(identity));
    return this._publishChargeLimitStatus(identity, entry, {
      valid: !expired, requestedW: result.requestedLimit, appliedW: result.effectiveLimitW,
      appliedAtMs: entry.lastSmartChargingAt, reason: expired ? 'EOS_LEASE_EXPIRED' : result.reason || 'accepted',
      error: expired ? 'EOS_LEASE_EXPIRED' : '',
    }, isCurrent, result);
  }

  async _applySmartCharging(identity, requestedLimit, rateUnit, phases, isCurrent = () => true) {
    const entry = this.runtimeIndex.get(identity);
    const lease = await this._ensureEosLease(identity);
    const emergencyZero = requestedLimit === 0 && lease.armed && lease.stopRequired;
    if (!emergencyZero) await lease.updateTail;
    const pendingPublication = this._publishChargeLimitStatus(identity, entry, {
      valid: false, requestedW: requestedLimit, reason: emergencyZero ? 'EOS_LEASE_EXPIRED' : 'pending',
    }, isCurrent);
    if (emergencyZero) pendingPublication.catch(() => this.log.warn(`EOS emergency zero pending status unavailable (${identity})`));
    else await pendingPublication;
    try {
      if (Number(requestedLimit) > 0 && (!this._eosLeaseFresh(lease) || lease.stopRequired)) throw new Error('EOS_LEASE_EXPIRED');
      return await this._applySmartChargingCurrent(identity, requestedLimit, rateUnit, phases, isCurrent);
    } catch (error) {
      if (this.runtimeIndex.get(identity) === entry && isCurrent()) {
        if (entry) entry.lastSmartCharging = undefined;
        const message = String(error?.message || error);
        const errorCode = message === 'EOS_LEASE_EXPIRED' ? 'EOS_LEASE_EXPIRED' : /timeout/i.test(message) ? 'timeout' : /returned/i.test(message) ? 'rejected'
          : /session|connected/i.test(message) ? 'session-changed' : 'invalid-request';
        await this._publishChargeLimitStatus(identity, entry, {
          valid: false, requestedW: requestedLimit, reason: 'failed', error: errorCode,
        }, isCurrent);
      }
      throw error;
    }
  }

  async _applySmartChargingCurrent(identity, requestedLimit, rateUnit, phases, isCurrent = () => true) {
    const entry = this.runtimeIndex.get(identity);
    if (!entry || !entry.client) throw new Error('Charging station is not connected');
    const normalized = normalizeEosLimit(requestedLimit, rateUnit, phases, this.config);
    const topology = this._getStationTelemetry(identity, entry);
    if (topology.inventoryMismatch) throw new Error('EOS_CONNECTOR_INVENTORY_MISMATCH');
    const configuredConnector = this.config.smartChargingConnectorId === 0 ? 0 : Number(this.config.smartChargingConnectorId) || 1;
    if (entry.proto === 'ocpp1.6' && configuredConnector !== 0 && (topology.scopes.size > 1 || (topology.scopes.size === 1 && !topology.scopes.has(`c${configuredConnector}`)))) throw new Error('OCPP 1.6 station limit requires the correct connector or explicit station scope (0)');

    // EOS may write a new setpoint while an older one is still waiting for the
    // OCPP command slot. Never send a queued value that has already been
    // superseded by a newer control cycle.
    if (!isCurrent()) return { status: 'Superseded', ...normalized };

    if (!shouldSendLimit(entry.lastSmartCharging, normalized, this.config)) {
      normalized.reason = 'unchanged-within-deadband';
      normalized.effectiveLimit = entry.lastSmartCharging.effectiveLimit;
      normalized.effectiveLimitW = entry.lastSmartCharging.effectiveLimitW;
      if (!await this._persistSmartChargingResult(identity, normalized, entry, isCurrent)) return { status: 'Superseded', ...normalized };
      return { status: 'Unchanged', ...normalized };
    }

    const minIntervalMs = Math.max(1000, Number(this.config.smartChargingMinIntervalMs) || 5000);
    const waitMs = Math.max(0, minIntervalMs - (Date.now() - (entry.lastSmartChargingAt || 0)));
    // Reductions are safety limits, never delayed by the increase rate limiter.
    if (waitMs > 0 && entry.lastSmartCharging && normalized.effectiveLimit > entry.lastSmartCharging.effectiveLimit) await new Promise((resolve) => setTimeout(resolve, waitMs));
    if (!isCurrent()) return { status: 'Superseded', ...normalized };

    const call = normalized.action === 'clear'
      ? this._buildClearChargingProfileCall(entry.proto, identity)
      : this._buildChargingProfileCall(entry.proto, normalized.effectiveLimit, normalized.rateUnit, normalized.phases, identity);
    if (normalized.effectiveLimitW > 0 && (!this._eosLeaseFresh(this._eosLeases.get(identity)) || this._eosLeases.get(identity)?.stopRequired)) throw new Error('EOS_LEASE_EXPIRED');
    const response = await this._callClient(identity, call.method, call.payload);
    if (response?.status !== 'Accepted') throw new Error(`${call.method} returned ${response?.status || 'no status'}`);
    entry.lastSmartChargingAt = Date.now();
    entry.lastSmartCharging = { ...normalized };
    if (normalized.effectiveLimitW > 0) this._eosLeases.get(identity).stopSessionId = '';
    if (!isCurrent()) return { status: 'Superseded', ...normalized };
    if (!await this._persistSmartChargingResult(identity, normalized, entry, isCurrent)) return { status: 'Superseded', ...normalized };
    return { status: 'Applied', method: call.method, response, ...normalized };
  }

  async _queueSmartCharging(identity, requestedLimit, rateUnit, phases) {
    const lease = await this._ensureEosLease(identity);
    if (!(requestedLimit === 0 && lease.armed && lease.stopRequired)) await lease.updateTail;
    if (Number(requestedLimit) > 0 && (!this._eosLeaseFresh(lease) || lease.stopRequired)) {
      await this._publishChargeLimitStatus(identity, this.runtimeIndex.get(identity), { valid: false, requestedW: requestedLimit, reason: 'EOS_LEASE_EXPIRED', error: 'EOS_LEASE_EXPIRED' });
      throw new Error('EOS_LEASE_EXPIRED');
    }
    const entry = this.runtimeIndex.get(identity);
    if (!entry || !entry.client) return Promise.reject(new Error('Charging station is not connected'));
    const generation = (entry.smartChargingGeneration || 0) + 1;
    entry.smartChargingGeneration = generation;
    const isCurrent = () => this.runtimeIndex.get(identity) === entry && !!entry.client && entry.smartChargingGeneration === generation
      && (!(Number(requestedLimit) > 0) || (this._eosLeaseFresh(lease) && !lease.stopRequired));
    this._publishChargeLimitStatus(identity, entry, { valid: false, requestedW: requestedLimit, reason: 'pending' }, isCurrent)
      .catch(error => this.log.warn(`Could not publish pending charging limit: ${error.message}`));
    entry.smartChargingPending = Math.max(0, Number(entry.smartChargingPending) || 0) + 1;
    const run = async () => {
      try {
        return await this._applySmartCharging(
          identity,
          requestedLimit,
          rateUnit,
          phases,
          isCurrent,
        );
      } finally {
        entry.smartChargingPending = Math.max(0, (Number(entry.smartChargingPending) || 1) - 1);
      }
    };
    entry.outboundControlTail = Promise.resolve(entry.outboundControlTail).then(run, run);
    entry.smartChargingTail = entry.outboundControlTail;
    return entry.outboundControlTail;
  }

  async _requestFreshData(identity, entry) {
    if (!entry || !entry.client || entry.refreshInFlight || this.config.activeRefresh === false) return;
    if ((entry.smartChargingPending || 0) > 0) return;
    if ((entry.configurationPending || 0) > 0 || entry.configurationRefreshInFlight) return;
    if ((entry.deferredDepth || 0) > Math.max(10, Number(this.config.maxDeferredTasks) || 250) / 2) return;
    const now = Date.now();
    if (entry.refreshSuppressedUntil && now < entry.refreshSuppressedUntil) return;
    if (entry.refreshSuppressedUntil && now >= entry.refreshSuppressedUntil) {
      entry.refreshSuppressedUntil = 0;
      entry.refreshSuppressedReason = '';
    }
    if (now < (entry.nextRefreshAt || 0)) return;
    entry.refreshInFlight = true;
    entry.lastRefreshAttemptAt = now;
    if (entry.lastOutboundAt && now - entry.lastOutboundAt < 5000) {
      entry.nextRefreshAt = now + 10000;
      entry.refreshInFlight = false;
      return;
    }
    entry.nextRefreshAt = now + Math.max(30, Number(this.config.activeRefreshIntervalSec) || 60) * 1000;
    const connectorSelection = takeRotatingItems(
      entry.connectors,
      entry.refreshConnectorCursor,
      Math.max(1, Number(this.config.maxConnectorsPerRefresh) || 8),
    );
    const connectors = connectorSelection.items;
    entry.refreshConnectorCursor = connectorSelection.nextCursor;
    let accepted = 0;
    let attempted = 0;
    let skippedFresh = 0;
    let skippedBackoff = 0;
    const errors = [];
    try {
      await this._setStateFreshAsync(`${identity}.health.refreshLastAttempt`, new Date(now).toISOString(), true, 'health');
      for (const key of connectors.length ? connectors : ['1:1']) {
        const [evseId, connectorId] = key.split(':').map(Number);
        for (const requestedMessage of ['MeterValues', 'StatusNotification']) {
          if (requestedMessage === 'MeterValues' && this.config.refreshMeterValues === false) continue;
          if (requestedMessage === 'StatusNotification' && this.config.refreshStatusNotification === false) continue;
          // MeterValues refresh is driven by active-import power freshness,
          // not by unrelated counters, SoC or temperature samples.
          const freshAt = requestedMessage === 'MeterValues' ? entry.lastPowerAt : entry.lastStatusAt;
          const refreshIntervalMs = Math.max(30, Number(this.config.activeRefreshIntervalSec) || 60) * 1000;
          if (freshAt && now - freshAt < Math.max(3000, refreshIntervalMs * 0.8)) {
            skippedFresh++;
            continue;
          }
          if (entry.triggerRetryAt[requestedMessage] && now < entry.triggerRetryAt[requestedMessage]) {
            skippedBackoff++;
            continue;
          }
          attempted++;
          try {
            entry.lastTriggerAt = Date.now();
            entry.lastTriggerMessage = requestedMessage;
            const response = await this._callClient(identity, 'TriggerMessage', buildTriggerPayload(entry.proto, requestedMessage, evseId, connectorId), { capture: false });
            const status = String(response && response.status || 'Unknown');
            entry.triggerSupport[requestedMessage] = status;
            if (isTriggerAccepted(response)) {
              accepted++;
              entry.triggerRetryAt[requestedMessage] = 0;
            } else if (isTriggerUnsupported(response)) {
              entry.triggerRetryAt[requestedMessage] = now + 6 * 60 * 60 * 1000;
            } else if (isTriggerRejected(response)) {
              entry.triggerRetryAt[requestedMessage] = now + 10 * 60 * 1000;
            } else {
              entry.triggerRetryAt[requestedMessage] = now + 10 * 60 * 1000;
              errors.push(`${requestedMessage}: unexpected status ${status}`);
            }
          } catch (e) {
            entry.triggerSupport[requestedMessage] = 'error';
            entry.triggerRetryAt[requestedMessage] = now + 10 * 60 * 1000;
            errors.push(`${requestedMessage}: ${e && e.message || e}`);
          }
        }
      }
      if (accepted > 0) entry.lastRefreshSuccessAt = Date.now();
      entry.lastRefreshError = errors.join('; ');
      let refreshStatus = 'not-run';
      if (accepted > 0) refreshStatus = 'requested';
      else if (errors.length) refreshStatus = 'error/backoff';
      else if (attempted === 0 && skippedFresh > 0) refreshStatus = 'fresh-no-request';
      else if (attempted === 0 && skippedBackoff > 0) refreshStatus = 'backoff';
      else if (attempted > 0) refreshStatus = 'not-accepted/backoff';
      await this._setStateFreshAsync(`${identity}.health.refreshStatus`, refreshStatus, true, 'health');
      await this._setStateFreshAsync(`${identity}.health.refreshSupport`, JSON.stringify(entry.triggerSupport), true, 'health');
      await this._setStateFreshAsync(`${identity}.health.refreshLastError`, entry.lastRefreshError, true, 'health');
      if (entry.lastRefreshSuccessAt) await this._setStateFreshAsync(`${identity}.health.refreshLastSuccess`, new Date(entry.lastRefreshSuccessAt).toISOString(), true, 'health');
    } finally {
      entry.refreshInFlight = false;
    }
  }

  async _watchdogCycle() {
    if (this._watchdogRunning || this._shuttingDown) return;
    this._watchdogRunning = true;
    try {
      const now = Date.now();
      for (const [identity, entry] of this.runtimeIndex.entries()) {
        await this.ensureStructure(identity);
        const connectionHealth = deriveConnectionHealth({
          now,
          socketConnected: entry.socketConnected,
          connectedAt: entry.connectedAt,
          lastMessageAt: entry.lastMessageAt,
          lastHeartbeatAt: entry.lastHeartbeatAt,
          heartbeatIntervalSec: entry.heartbeatIntervalSec,
          heartbeatTimeoutFactor: this.config.heartbeatTimeoutFactor,
          activityTimeoutSec: this.config.activityTimeoutSec,
        });
        const lastActivityAt = connectionHealth.lastActivityAt;
        const messageAgeSec = entry.lastMessageAt ? Math.max(0, (now - entry.lastMessageAt) / 1000) : -1;
        const heartbeatAgeSec = entry.lastHeartbeatAt ? Math.max(0, (now - entry.lastHeartbeatAt) / 1000) : -1;
        const meterAgeSec = entry.lastMeterAt ? Math.max(0, (now - entry.lastMeterAt) / 1000) : -1;
        const powerAgeSec = entry.lastPowerAt ? Math.max(0, (now - entry.lastPowerAt) / 1000) : -1;
        const exportPowerAgeSec = entry.lastExportPowerAt ? Math.max(0, (now - entry.lastExportPowerAt) / 1000) : -1;
        const currentAgeSec = entry.lastCurrentAt ? Math.max(0, (now - entry.lastCurrentAt) / 1000) : -1;
        const statusAgeSec = entry.lastStatusAt ? Math.max(0, (now - entry.lastStatusAt) / 1000) : -1;
        const socAgeSec = entry.lastSocAt ? Math.max(0, (now - entry.lastSocAt) / 1000) : -1;
        const socketConnected = connectionHealth.socketConnected;
        const activityFresh = connectionHealth.activityFresh;
        const online = connectionHealth.online;
        const heartbeatAlive = connectionHealth.heartbeatAlive;
        const telemetryMaxAgeSec = Math.max(15, Number(this.config.telemetryMaxAgeSec) || 90);
        const meterFresh = socketConnected && entry.lastMeterAt > 0 && meterAgeSec <= telemetryMaxAgeSec;
        const powerFresh = socketConnected && entry.lastPowerAt > 0 && powerAgeSec <= telemetryMaxAgeSec;
        const exportPowerFresh = socketConnected && entry.lastExportPowerAt > 0 && exportPowerAgeSec <= telemetryMaxAgeSec;
        const currentFresh = socketConnected && entry.lastCurrentAt > 0 && currentAgeSec <= telemetryMaxAgeSec;
        const socFresh = socketConnected && entry.lastSocAt > 0 && socAgeSec <= Math.max(30, Number(this.config.socMaxAgeSec) || 300);
        // safeZeroAt is cleared immediately by a charging event or a
        // contradictory non-zero actual-flow sample. Therefore a previously
        // confirmed idle/end state remains valid across later counter, SoC or
        // zero-only MeterValues messages.
        const safeZero = socketConnected && entry.safeZeroAt > 0;
        // EOS data freshness is tied to the canonical active-import power or a
        // protocol-derived safe zero. Heartbeat/current/reactive power alone do
        // not make an old power datapoint suitable for closed-loop control.
        const dataFresh = dataFreshForEos(online, powerFresh, safeZero);
        let staleReason = '';
        if (!socketConnected) staleReason = 'socket-disconnected';
        else if (!online) staleReason = 'no-ocpp-activity';
        else if (!dataFresh && exportPowerFresh) staleReason = 'export-power-only-no-import-power';
        else if (!dataFresh && !entry.lastPowerAt) staleReason = 'awaiting-power-or-idle-status';
        else if (!dataFresh) staleReason = 'power-values-stale';

        // ioBroker's conventional info.connection flag represents the real
        // transport connection. Activity and heartbeat quality stay in health.*
        // so a delayed Heartbeat cannot make EOS believe the socket vanished.
        await this._setStateFreshAsync(`${identity}.info.connection`, socketConnected, true, 'status');
        await this._setStateFreshAsync(`${identity}.info.socketConnected`, socketConnected, true, 'status');
        await this._setStateFreshAsync(`${identity}.health.online`, online, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.activityFresh`, activityFresh, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.socketConnected`, socketConnected, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.heartbeatAlive`, heartbeatAlive, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.meterFresh`, meterFresh, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.powerFresh`, powerFresh, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.exportPowerFresh`, exportPowerFresh, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.currentFresh`, currentFresh, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.dataFresh`, dataFresh, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.socFresh`, socFresh, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.staleReason`, staleReason, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.messageAgeSec`, Math.round(messageAgeSec), true, 'health');
        await this._setStateFreshAsync(`${identity}.health.activityAgeSec`, lastActivityAt ? Math.round(Math.max(0, (now - lastActivityAt) / 1000)) : -1, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.activityTimeoutSec`, Math.round(connectionHealth.activityWindowMs / 1000), true, 'health');
        await this._setStateFreshAsync(`${identity}.health.heartbeatTimeoutSec`, Math.round(connectionHealth.heartbeatWindowMs / 1000), true, 'health');
        await this._setStateFreshAsync(`${identity}.health.heartbeatAgeSec`, Math.round(heartbeatAgeSec), true, 'health');
        await this._setStateFreshAsync(`${identity}.health.meterAgeSec`, Math.round(meterAgeSec), true, 'health');
        await this._setStateFreshAsync(`${identity}.health.powerAgeSec`, Math.round(powerAgeSec), true, 'health');
        await this._setStateFreshAsync(`${identity}.health.exportPowerAgeSec`, Math.round(exportPowerAgeSec), true, 'health');
        await this._setStateFreshAsync(`${identity}.health.currentAgeSec`, Math.round(currentAgeSec), true, 'health');
        await this._setStateFreshAsync(`${identity}.health.statusAgeSec`, Math.round(statusAgeSec), true, 'health');
        await this._setStateFreshAsync(`${identity}.health.socAgeSec`, Math.round(socAgeSec), true, 'health');
        await this._setStateFreshAsync(`${identity}.health.safeZeroApplied`, safeZero, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.safeZeroReason`, entry.safeZeroReason || '', true, 'health');
        await this._setStateFreshAsync(`${identity}.health.lastSeenMs`, entry.lastMessageAt || 0, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.lastSeen`, entry.lastMessageAt ? new Date(entry.lastMessageAt).toISOString() : '', true, 'health');
        await this._setStateFreshAsync(`${identity}.health.lastAction`, entry.lastAction || '', true, 'health');
        await this._setStateFreshAsync(`${identity}.health.lastHeartbeatMs`, entry.lastHeartbeatAt || 0, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.heartbeat`, entry.lastHeartbeatAt ? new Date(entry.lastHeartbeatAt).toISOString() : '', true, 'health');
        await this._setStateFreshAsync(`${identity}.info.lastHeartbeat`, entry.lastHeartbeatAt ? new Date(entry.lastHeartbeatAt).toISOString() : '', true, 'status');
        if (entry.lastBootAt) await this._setStateFreshAsync(`${identity}.health.lastBoot`, new Date(entry.lastBootAt).toISOString(), true, 'health');
        await this._setStateFreshAsync(`${identity}.health.reconnectCount`, entry.reconnectCount || 0, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.disconnectCount`, entry.disconnectCount || 0, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.queueDepth`, entry.deferredDepth || 0, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.queueMaxDepth`, entry.deferredMaxDepth || 0, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.queueDropped`, entry.deferredDropped || 0, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.queueErrors`, entry.deferredErrors || 0, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.queueLastError`, entry.lastDeferredError || '', true, 'health');
        await this._setStateFreshAsync(`${identity}.health.outboundCallCount`, entry.outboundCallCount || 0, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.outboundErrorCount`, entry.outboundErrorCount || 0, true, 'health');
        await this._setStateFreshAsync(`${identity}.health.lastOutboundMethod`, entry.lastOutboundMethod || '', true, 'health');
        await this._setStateFreshAsync(`${identity}.health.lastOutboundAt`, entry.lastOutboundAt ? new Date(entry.lastOutboundAt).toISOString() : '', true, 'health');
        await this._setStateFreshAsync(`${identity}.health.refreshSuppressedUntil`, entry.refreshSuppressedUntil ? new Date(entry.refreshSuppressedUntil).toISOString() : '', true, 'health');
        await this._setStateFreshAsync(`${identity}.health.refreshSuppressedReason`, entry.refreshSuppressedReason || '', true, 'health');
        await this._setStateFreshAsync(`${identity}.health.refreshRelatedDisconnects`, entry.refreshRelatedDisconnects || 0, true, 'health');

        if (entry.configurationRefreshInFlight
          && entry.configurationReportDeadlineAt
          && now >= entry.configurationReportDeadlineAt) {
          entry.configurationRefreshInFlight = false;
          entry.configurationPendingRequestId = 0;
          entry.configurationReportDeadlineAt = 0;
          entry.configurationInventorySeen = new Set();
          entry.configurationReportSequences = new Set();
          await this._recordConfigurationStatus(identity, {
            status: 'timeout',
            error: 'Timed out waiting for the OCPP configuration report',
            reportInProgress: false,
          });
        }

        const republishMs = Math.max(5, Number(this.config.stateRefreshIntervalSec) || 10) * 1000;
        if (online && now - (entry.lastStateRepublishAt || 0) >= republishMs) {
          entry.republishCursor = await this._touchCachedStates(identity, safeZero, now, entry.republishCursor || 0);
          entry.lastStateRepublishAt = now;
          await this._setStateFreshAsync(`${identity}.health.lastRepublish`, new Date(now).toISOString(), true, 'health');
        }
        if (online && entry.booted) {
          // Active refresh may wait for a slow or non-compliant station. Do not
          // block health processing for this or any other connected station.
          this._requestFreshData(identity, entry).catch((e) => {
            this.log.warn(`Active refresh failed for ${identity}: ${e && e.message || e}`);
          });
          this._maybeAutoRefreshConfiguration(identity, entry, now).catch((e) => {
            this.log.warn(`Configuration auto-refresh failed for ${identity}: ${e && e.message || e}`);
          });
        }
      }
    } catch (e) {
      this.log.warn(`NexoWatt OCPP freshness watchdog failed: ${e && e.stack || e}`);
    } finally {
      this._watchdogRunning = false;
    }
  }

  _looksLikeIsoTime(s) {
    if (typeof s !== 'string') return false;
    // very lightweight ISO-8601 date-time heuristic
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s);
  }

  async _setObjectNotExistsCached(id, obj) {
    if (this._dpObjCache.has(id)) return;
    await this.setObjectNotExistsAsync(id, obj);
    this._dpObjCache.add(id);
  }

  _flattenJson(value, out, path, depth, maxDepth, maxArray) {
    if (depth > maxDepth) {
      out.push({ path, value: JSON.stringify(value), kind: 'json' });
      return;
    }
    if (value === null || value === undefined) {
      out.push({ path, value: null, kind: 'null' });
      return;
    }
    const t = typeof value;
    if (t === 'string' || t === 'number' || t === 'boolean') {
      out.push({ path, value, kind: t });
      return;
    }
    if (Array.isArray(value)) {
      const len = value.length;
      const n = Math.min(len, maxArray);
      for (let i = 0; i < n; i++) {
        this._flattenJson(value[i], out, path.concat(String(i)), depth + 1, maxDepth, maxArray);
      }
      if (len > maxArray) {
        out.push({ path: path.concat('_truncated'), value: `array(${len}) truncated to ${maxArray}`, kind: 'string' });
      }
      return;
    }
    if (t === 'object') {
      for (const [k, v] of Object.entries(value)) {
        this._flattenJson(v, out, path.concat(String(k)), depth + 1, maxDepth, maxArray);
      }
      return;
    }
    // fallback
    out.push({ path, value: String(value), kind: 'string' });
  }

  async _ensureAdvancedStructure(identity) {
    if (this._advancedStructureReady.has(identity)) return;
    await this._setObjectNotExistsCached(`${identity}.advanced`, {
      type: 'channel',
      common: { name: { en: 'Advanced OCPP diagnostics', de: 'Erweiterte OCPP-Diagnose' } },
      native: {},
    });
    const states = {
      lastIncoming: ['string', 'json', ''],
      lastOutgoing: ['string', 'json', ''],
      lastIncomingAction: ['string', 'text', ''],
      lastOutgoingAction: ['string', 'text', ''],
      lastProtocol: ['string', 'text', ''],
      lastTimestamp: ['string', 'value.time', ''],
      incomingCount: ['number', 'value', 0],
      outgoingCount: ['number', 'value', 0],
      lastMessageBytes: ['number', 'value', 0],
      lastMessageTruncated: ['boolean', 'indicator', false],
      deviceModelReport: ['string', 'json', ''],
      deviceModelReportAt: ['string', 'value.time', ''],
    };
    for (const [key, [type, role, def]] of Object.entries(states)) {
      await this._setObjectNotExistsCached(`${identity}.advanced.${key}`, {
        type: 'state',
        common: { name: key, type, role, read: true, write: false, def },
        native: {},
      });
    }
    this._advancedStructureReady.add(identity);
  }

  async captureOcppPayload(identity, protocol, direction, action, payload) {
    if (this.config.captureRawMessages !== true) return;
    await this._ensureAdvancedStructure(identity);
    const dir = String(direction || '').toLowerCase() === 'out' ? 'Outgoing' : 'Incoming';
    const countKey = dir === 'Outgoing' ? 'outgoingCount' : 'incomingCount';
    const rawKey = dir === 'Outgoing' ? 'lastOutgoing' : 'lastIncoming';
    const actionKey = dir === 'Outgoing' ? 'lastOutgoingAction' : 'lastIncomingAction';
    const counterMapKey = `${identity}|advanced|${countKey}`;
    const count = (this._dpCounts.get(counterMapKey) || 0) + 1;
    this._dpCounts.set(counterMapKey, count);

    let raw;
    try { raw = JSON.stringify(payload ?? {}); } catch (error) { raw = JSON.stringify({ serializationError: String(error && error.message || error) }); }
    const bytes = Buffer.byteLength(raw, 'utf8');
    const maxBytes = Math.max(4096, Number(this.config.maxRawPayloadBytes) || 65536);
    let truncated = false;
    if (bytes > maxBytes) {
      raw = `${raw.slice(0, maxBytes)}…[truncated ${bytes - maxBytes} bytes]`;
      truncated = true;
    }
    const now = new Date().toISOString();
    await this._setStateFreshAsync(`${identity}.advanced.${rawKey}`, raw, true, 'payload');
    await this._setStateFreshAsync(`${identity}.advanced.${actionKey}`, String(action || ''), true, 'payload');
    await this._setStateFreshAsync(`${identity}.advanced.lastProtocol`, String(protocol || ''), true, 'payload');
    await this._setStateFreshAsync(`${identity}.advanced.lastTimestamp`, now, true, 'payload');
    await this._setStateFreshAsync(`${identity}.advanced.${countKey}`, count, true, 'payload');
    await this._setStateFreshAsync(`${identity}.advanced.lastMessageBytes`, bytes, true, 'payload');
    await this._setStateFreshAsync(`${identity}.advanced.lastMessageTruncated`, truncated, true, 'payload');
  }

  async ingestNotifyReport(identity, protocol, params) {
    const reportData = Array.isArray(params && params.reportData) ? params.reportData : [];
    if (this.config.captureDeviceModelReport === true) {
      await this._ensureAdvancedStructure(identity);
      let raw = '';
      try {
        raw = JSON.stringify(redactConfigurationReport(params || {}));
      } catch (error) {
        raw = JSON.stringify({ serializationError: String(error && error.message || error) });
      }
      const maxBytes = Math.max(4096, Number(this.config.maxRawPayloadBytes) || 65536);
      if (Buffer.byteLength(raw, 'utf8') > maxBytes) raw = `${raw.slice(0, maxBytes)}…[truncated]`;
      await this._setStateFreshAsync(`${identity}.advanced.deviceModelReport`, raw, true, 'payload');
      await this._setStateFreshAsync(`${identity}.advanced.deviceModelReportAt`, new Date().toISOString(), true, 'payload');
    }

    await this.ensureStructure(identity);
    const entry = this.runtimeIndex.get(identity);
    const requestId = Number.isFinite(Number(params && params.requestId)) ? Number(params.requestId) : 0;
    const seqNo = Number.isFinite(Number(params && params.seqNo)) ? Number(params.seqNo) : 0;
    const tbc = params && params.tbc === true;
    const configurationReportMatches = !!entry
      && entry.configurationRefreshInFlight
      && entry.configurationPendingRequestId > 0
      && entry.configurationPendingRequestId === requestId;
    let duplicateConfigurationSequence = false;
    if (configurationReportMatches) {
      if (entry.configurationReportRequestId !== requestId) {
        entry.configurationReportCount = 0;
        entry.configurationInventorySeen = new Set();
        entry.configurationReportSequences = new Set();
      }
      entry.configurationReportRequestId = requestId;
      if (!(entry.configurationReportSequences instanceof Set)) entry.configurationReportSequences = new Set();
      duplicateConfigurationSequence = entry.configurationReportSequences.has(seqNo);
      entry.configurationReportSequences.add(seqNo);
      if (!(entry.configurationInventorySeen instanceof Set)) entry.configurationInventorySeen = new Set();
    }

    for (const rd of reportData) {
      const component = rd && rd.component;
      const variable = rd && rd.variable;
      if (!component || !variable) continue;
      const componentName = String(component.name || '').toLowerCase();
      const variableName = String(variable.name || '').toLowerCase();
      const characteristics = rd.variableCharacteristics || {};
      const attrs = Array.isArray(rd.variableAttribute) ? rd.variableAttribute : [];

      for (const attribute of attrs) {
        const attributeType = String(attribute && attribute.type || 'Actual');
        const hasRawValue = !!attribute && Object.prototype.hasOwnProperty.call(attribute, 'value') && attribute.value !== undefined;
        const parsed = parseDeviceModelValue(attribute && attribute.value, characteristics.dataType || 'string');
        const hasConfirmedValue = hasRawValue && parsed.val !== undefined;

        // A compact configuration inventory is created only for the explicit
        // ConfigurationInventory request sent by this adapter. Other Device
        // Model reports must not unexpectedly grow the object tree.
        if (configurationReportMatches && !duplicateConfigurationSequence) {
          const stateKey = configurationStateKey2(component, variable, attributeType);
          // Count distinct flat datapoints through the Set itself. Some
          // stations repeat an item in multipart or retried report chunks.
          entry.configurationInventorySeen.add(stateKey);
          await this._upsertConfigurationState(identity, {
            kind: 'deviceModel',
            protocol,
            canonicalKey: canonicalDeviceModelKey(component, variable, attributeType),
            component: cloneOcppReference(component),
            variable: cloneOcppReference(variable),
            attributeType,
            mutability: String(attribute && attribute.mutability || 'ReadOnly'),
            persistent: attribute && attribute.persistent === true,
            constant: attribute && attribute.constant === true,
            dataType: String(characteristics.dataType || 'string'),
            stateType: parsed.type,
            unit: characteristics.unit,
            minLimit: characteristics.minLimit,
            maxLimit: characteristics.maxLimit,
            valuesList: characteristics.valuesList,
            supportsMonitoring: characteristics.supportsMonitoring,
            inventoryPending: true,
            stateKey,
          }, parsed.val, hasConfirmedValue);
        }

        // Mirror ConnectedEV.StateOfCharge into the compact EOS measurements,
        // regardless of which Device Model report carried the value.
        if (componentName === 'connectedev'
          && variableName === 'stateofcharge'
          && attributeType.toLowerCase() === 'actual'
          && typeof parsed.val === 'number'
          && Number.isFinite(parsed.val)) {
          const socId = await this.ensureMeasurement(identity, 'socPercent', '%', {
            name: { en: 'Vehicle state of charge', de: 'Fahrzeug-Ladezustand' },
            role: 'value.battery',
          });
          await this._publishScopedSoc(identity, Number(rd.component?.evse?.id), Number(rd.component?.evse?.connectorId ?? 0), parsed.val);
          // scoped SoC already published
        }
      }
    }

    if (!configurationReportMatches) return;

    entry.configurationReportCount = entry.configurationInventorySeen.size;
    if (!tbc) {
      await this._finalizeConfigurationInventoryStates(identity, entry.configurationInventorySeen, protocol);
      await this._retireMissingConfigurationStates(identity, entry.configurationInventorySeen, protocol);
      await this._updateConfigurationIndex(identity);
      entry.configurationRefreshInFlight = false;
      entry.configurationPendingRequestId = 0;
      entry.configurationReportDeadlineAt = 0;
    }
    await this._recordConfigurationStatus(identity, {
      status: tbc ? 'receiving-report' : 'ready',
      error: '',
      count: entry.configurationReportCount,
      reportInProgress: tbc,
      requestId,
      lastSequence: seqNo,
      lastRefresh: !tbc ? new Date().toISOString() : undefined,
    });
  }

  async ensureAliases(identity) {
    if (this._aliasDone.has(identity)) return;
    const publicAliasBase = /^ocpp21\.\d+$/.test(this.namespace) ? `alias.0.nexowatt.ocpp.${this.instance}` : `alias.0.nexowatt.${this.namespace}`;
    const technicalAliasBase = `alias.0.${this.namespace}`;
    const ancestors = (base) => base.split('.').slice(2).map((_, i, parts) => [`alias.0.${parts.slice(0, i + 1).join('.')}`, 'NexoWatt OCPP']);
    const roots = [{ root: `${publicAliasBase}.${identity}`, parents: ancestors(publicAliasBase) }];
    if (this.config.createTechnicalAliases === true) roots.push({ root: `${technicalAliasBase}.${identity}`, parents: ancestors(technicalAliasBase) });

    const connector1 = this._connectorBase(identity, 1, 1);
    const aliases = [
      ['connected', `${identity}.info.connection`, 'boolean', 'indicator.connected', false],
      ['socketConnected', `${identity}.info.socketConnected`, 'boolean', 'indicator.connected', false],
      ['activityFresh', `${identity}.health.activityFresh`, 'boolean', 'indicator.connected', false],
      ['heartbeatAlive', `${identity}.health.heartbeatAlive`, 'boolean', 'indicator.connected', false],
      ['dataFresh', `${identity}.health.dataFresh`, 'boolean', 'indicator', false],
      ['powerFresh', `${identity}.health.powerFresh`, 'boolean', 'indicator', false],
      ['socFresh', `${identity}.health.socFresh`, 'boolean', 'indicator', false],
      ['status', `${identity}.info.status`, 'string', 'indicator.status', false],
      ['protocol', `${identity}.info.protocol`, 'string', 'text', false],
      ['rfid', `${identity}.info.rfid`, 'string', 'text', false],
      ['powerW', `${identity}.measurements.powerW`, 'number', 'value.power', false],
      ['powerExportW', `${identity}.measurements.powerExportW`, 'number', 'value.power', false],
      ['currentTotalA', `${identity}.measurements.currentA`, 'number', 'value.current', false],
      ['energyWh', `${identity}.measurements.energyWh`, 'number', 'value.energy', false],
      ['energyKWh', `${identity}.measurements.energyKWh`, 'number', 'value.energy', false],
      ['soc', `${identity}.measurements.socPercent`, 'number', 'value.battery', false],
      ['voltageL1', `${identity}.measurements.voltageVL1`, 'number', 'value.voltage', false],
      ['voltageL2', `${identity}.measurements.voltageVL2`, 'number', 'value.voltage', false],
      ['voltageL3', `${identity}.measurements.voltageVL3`, 'number', 'value.voltage', false],
      ['currentL1', `${identity}.measurements.currentAL1`, 'number', 'value.current', false],
      ['currentL2', `${identity}.measurements.currentAL2`, 'number', 'value.current', false],
      ['currentL3', `${identity}.measurements.currentAL3`, 'number', 'value.current', false],
      ['powerL1', `${identity}.measurements.powerWL1`, 'number', 'value.power', false],
      ['powerL2', `${identity}.measurements.powerWL2`, 'number', 'value.power', false],
      ['powerL3', `${identity}.measurements.powerWL3`, 'number', 'value.power', false],
      ['frequencyHz', `${identity}.measurements.frequencyHz`, 'number', 'value.frequency', false],
      ['txActive', `${identity}.transactions.transactionActive`, 'boolean', 'indicator.working', false],
      ['chargingState', `${identity}.transactions.chargingState`, 'string', 'indicator.status', false],
      ['txId', `${identity}.transactions.lastId`, 'string', 'text', false],
      ['txEnergyKWh', `${identity}.transactions.lastTransactionConsumption_kWh`, 'number', 'value.energy', false],
      ['chargeLimit', `${identity}.control.chargeLimit`, 'number', 'value.power', true],
      ['numberPhases', `${identity}.control.numberOfPhases`, 'number', 'value', true],
      ['availability', `${identity}.control.availability`, 'boolean', 'switch.power', true],
    ];
    if (this.config.connectorDetails === true) {
      aliases.push(
        ['connector1Status', `${connector1}.status`, 'string', 'indicator.status', false],
        ['connector1EnergyKWh', `${connector1}.energyKWh`, 'number', 'value.energy', false],
      );
    }

    try {
      for (const definition of roots) {
        for (const [parent, name] of definition.parents) {
          await this.setForeignObjectNotExistsAsync(parent, { type: 'channel', common: { name }, native: {} });
        }
        await this.setForeignObjectNotExistsAsync(definition.root, {
          type: 'channel',
          common: { name: this._stateToRawIdentity.get(identity) || identity },
          native: {},
        });
        for (const [name, target, type, role, write] of aliases) {
          const aliasId = `${definition.root}.${name}`;
          const object = {
            type: 'state',
            common: { name, type, role, read: true, write: !!write, alias: { id: `${this.namespace}.${target}` } },
            native: {},
          };
          await this.setForeignObjectNotExistsAsync(aliasId, object);
          // Existing aliases from 0.3.x pointed to the old deep tree. Update
          // them in place so EOS mappings continue to work after migration.
          if (typeof this.extendForeignObjectAsync === 'function') await this.extendForeignObjectAsync(aliasId, object);
        }
        // Existing connector aliases are preserved.
      }
      this._aliasDone.add(identity);
    } catch (error) {
      this.log.debug(`Alias creation will be retried (${identity}): ${error}`);
    }
  }

  _connectorBase(identity, evseId = 1, connectorId = 1) {
    const evse = Math.max(0, Math.trunc(Number(evseId) || 0));
    const connector = Math.max(0, Math.trunc(Number(connectorId) || 0));
    return `${identity}.connectors.${evse}_${connector}`;
  }

  async ensureMeasurement(identity, key, unit, options = {}) {
    const cleanKey = sanitizeFlatKey(key);
    await this._setObjectNotExistsCached(`${identity}.measurements`, {
      type: 'channel',
      common: { name: { en: 'Measurements', de: 'Messwerte' } },
      native: {},
    });
    const id = `${identity}.measurements.${cleanKey}`;
    await this._setObjectNotExistsCached(id, {
      type: 'state',
      common: measurementCommon(cleanKey, unit, options),
      native: {},
    });
    return id;
  }

  async ensureTextMeasurement(identity, key, name, role = 'text') {
    const cleanKey = sanitizeFlatKey(key);
    await this._setObjectNotExistsCached(`${identity}.measurements`, {
      type: 'channel',
      common: { name: { en: 'Measurements', de: 'Messwerte' } },
      native: {},
    });
    const id = `${identity}.measurements.${cleanKey}`;
    await this._setObjectNotExistsCached(id, {
      type: 'state',
      common: { name: name || cleanKey, type: 'string', role, read: true, write: false, def: '' },
      native: {},
    });
    return id;
  }

  async ensureConnectorStructure(identity, evseId = 1, connectorId = 1) {
    if (this.config.connectorDetails !== true) return undefined;
    const evse = Math.max(0, Math.trunc(Number(evseId) || 0));
    const connector = Math.max(0, Math.trunc(Number(connectorId) || 0));
    const connectorKey = `${identity}|${evse}|${connector}`;
    const base = this._connectorBase(identity, evse, connector);
    if (this._connectorStructureReady.has(connectorKey)) return base;

    await this._setObjectNotExistsCached(`${identity}.connectors`, {
      type: 'channel',
      common: { name: { en: 'Connectors', de: 'Ladeanschlüsse' } },
      native: {},
    });
    await this._setObjectNotExistsCached(base, {
      type: 'channel',
      common: { name: { en: `EVSE ${evse}, connector ${connector}`, de: `EVSE ${evse}, Anschluss ${connector}` } },
      native: { evseId: evse, connectorId: connector },
    });

    const states = {
      status: { name: { en: 'Connector status', de: 'Anschlussstatus' }, type: 'string', role: 'indicator.status', def: '' },
      errorCode: { name: { en: 'Error code', de: 'Fehlercode' }, type: 'string', role: 'text', def: '' },
      info: { name: { en: 'Status information', de: 'Statusinformation' }, type: 'string', role: 'text', def: '' },
      vendorErrorCode: { name: { en: 'Vendor error code', de: 'Hersteller-Fehlercode' }, type: 'string', role: 'text', def: '' },
      vendorId: { name: { en: 'Vendor identifier', de: 'Herstellerkennung' }, type: 'string', role: 'text', def: '' },
      lastUpdate: { name: { en: 'Last connector update', de: 'Letzte Anschlussaktualisierung' }, type: 'string', role: 'value.time', def: '' },
      energyWh: { name: { en: 'Charged energy total', de: 'Geladene Energie gesamt' }, type: 'number', role: 'value.energy', unit: 'Wh', def: 0 },
      energyKWh: { name: { en: 'Charged energy total', de: 'Geladene Energie gesamt' }, type: 'number', role: 'value.energy', unit: 'kWh', def: 0 },
    };
    for (const [key, common] of Object.entries(states)) {
      await this._setObjectNotExistsCached(`${base}.${key}`, {
        type: 'state',
        common: { ...common, read: true, write: false },
        native: {},
      });
    }
    this._connectorStructureReady.add(connectorKey);
    return base;
  }

  async _cleanupDisabledConnectorDetails(identity) {
    if (this.config.connectorDetails === true || this._connectorCleanupDone.has(identity)) return;
    if (typeof this.delObjectAsync === 'function') {
      try {
        const branchId = `${identity}.connectors`;
        const exists = typeof this.getObjectAsync === 'function' ? await this.getObjectAsync(branchId) : true;
        if (exists) {
          await this.delObjectAsync(branchId, { recursive: true });
          this.log.info(`Optional connector detail branch removed for ${identity}; station-level measurements remain available.`);
        }
      } catch (error) {
        this.log.debug(`Connector detail cleanup skipped (${identity}): ${error && error.message || error}`);
      }
    }
    for (const key of [...this._connectorStructureReady]) if (key.startsWith(`${identity}|`)) this._connectorStructureReady.delete(key);
    this._connectorCleanupDone.add(identity);
  }

  async _cleanupLegacySubfolders(identity) {
    if (this.config.cleanupLegacyObjects === false || this._legacySubfolderCleanupDone.has(identity)) return;
    if (typeof this.delObjectAsync !== 'function') {
      this._legacySubfolderCleanupDone.add(identity);
      return;
    }

    const candidates = [
      { id: `${identity}.control.hardReset`, keepState: true },
      { id: `${identity}.control.softReset`, keepState: true },
      { id: `${identity}.control.rpc`, keepState: false },
      { id: `${identity}.control.requestStartTransaction`, keepState: false },
      { id: `${identity}.control.requestStopTransaction`, keepState: false },
      { id: `${identity}.transactions.last`, keepState: false },
    ];

    for (const candidate of candidates) {
      try {
        let object;
        if (typeof this.getObjectAsync === 'function') object = await this.getObjectAsync(candidate.id);
        else if (typeof this.getForeignObjectAsync === 'function') object = await this.getForeignObjectAsync(`${this.namespace}.${candidate.id}`);
        if (!object) continue;
        if (candidate.keepState && object.type === 'state') continue;
        await this.delObjectAsync(candidate.id, { recursive: true });
        this.log.info(`Removed obsolete OCPP subfolder ${candidate.id}.`);
      } catch (error) {
        this.log.debug(`Legacy OCPP subfolder cleanup skipped (${candidate.id}): ${error && error.message || error}`);
      }
    }
    this._legacySubfolderCleanupDone.add(identity);
  }

  async _cleanupKnownMeasurementAliases(identity) {
    if (this.config.cleanupLegacyObjects === false || this._measurementAliasCleanupDone.has(identity)) return;
    if (typeof this.delObjectAsync !== 'function') {
      this._measurementAliasCleanupDone.add(identity);
      return;
    }

    // Early compact-tree candidates could expose manufacturer spellings as
    // separate states. They are now normalised into measurements.powerW. Remove
    // only the known duplicates/typo so the compact folder does not keep an
    // obsolete "ActivePowerInport" datapoint after an update.
    const obsoleteKeys = [
      'ActivePowerInport',
      'activePowerInport',
      'activepowerinport',
      'extra_ActivePowerInport',
      'extra_activePowerInport',
      'extra_activepowerinport',
      'Power_Active_Inport',
      'extra_Power_Active_Inport',
    ];
    for (const key of obsoleteKeys) {
      const stateId = `${identity}.measurements.${key}`;
      try {
        let object;
        if (typeof this.getObjectAsync === 'function') object = await this.getObjectAsync(stateId);
        else if (typeof this.getForeignObjectAsync === 'function') object = await this.getForeignObjectAsync(`${this.namespace}.${stateId}`);
        if (!object) continue;
        await this.delObjectAsync(stateId, { recursive: true });
        this._dpObjCache.delete(stateId);
        this.log.info(`Removed obsolete OCPP measurement alias ${stateId}; use ${identity}.measurements.powerW.`);
      } catch (error) {
        this.log.debug(`Obsolete OCPP measurement cleanup skipped (${stateId}): ${error && error.message || error}`);
      }
    }
    this._measurementAliasCleanupDone.add(identity);
  }

  async _cleanupLegacyObjects(identity) {
    if (this.config.cleanupLegacyObjects === false || this._legacyCleanupDone.has(identity)) return;
    const legacyBranches = [
      `${identity}.main`,
      `${identity}.meterValues`,
      `${identity}.evse`,
      `${identity}.evChargingNeeds`,
      `${identity}.ocpp`,
      `${identity}.dm`,
    ];
    let removed = 0;
    for (const branch of legacyBranches) {
      try {
        if (typeof this.delObjectAsync === 'function') {
          await this.delObjectAsync(branch, { recursive: true });
          removed++;
        }
      } catch (error) {
        // The branch usually does not exist on a new installation.
        this.log.debug(`Legacy OCPP branch cleanup skipped (${branch}): ${error && error.message || error}`);
      }
    }
    if (this.config.createTechnicalAliases !== true && typeof this.delForeignObjectAsync === 'function') {
      try {
        await this.delForeignObjectAsync(`alias.0.${this.namespace}.${identity}`, { recursive: true });
      } catch (error) {
        this.log.debug(`Technical alias cleanup skipped (${identity}): ${error && error.message || error}`);
      }
    }
    this._legacyCleanupDone.add(identity);
    if (removed > 0) this.log.info(`Compact OCPP datapoint structure activated for ${identity}; obsolete technical branches were removed.`);
  }

  async ensureStructure(identity, evseId = 1, connectorId = 1) {
    const rawIdentity = this._stateToRawIdentity.get(identity) || identity;
    const state = async (id, common, native = {}) => this._setObjectNotExistsCached(id, { type: 'state', common, native });
    const channel = async (id, name, type = 'channel') => this._setObjectNotExistsCached(id, { type, common: { name }, native: {} });

    if (!this._identityStructureReady.has(identity)) {
      await channel(identity, rawIdentity, 'device');
      await this.extendObjectAsync(identity, { native: { eosContract: 'nexowatt-ocpp21-0.4-native', deviceType: 'evCharger', controlScope: 'station' } });
      await channel(`${identity}.info`, { en: 'Information', de: 'Informationen' });
      await channel(`${identity}.health`, { en: 'Connection and data health', de: 'Verbindungs- und Datenstatus' });
      await channel(`${identity}.measurements`, { en: 'Measurements', de: 'Messwerte' });
      await channel(`${identity}.configuration`, { en: 'OCPP device configuration', de: 'OCPP-Gerätekonfiguration' });
      if (this.config.connectorDetails === true) await channel(`${identity}.connectors`, { en: 'Connectors', de: 'Ladeanschlüsse' });
      await channel(`${identity}.vehicle`, { en: 'Vehicle charging needs', de: 'Fahrzeug und Ladebedarf' });
      await channel(`${identity}.transactions`, { en: 'Transactions', de: 'Ladevorgänge' });
      await channel(`${identity}.control`, { en: 'Control', de: 'Steuerung' });
      // Legacy deletion is intentionally not automatic.
      // Preserve existing user mappings until explicit migration.

      const info = {
        identity: ['string', 'text', ''],
        stateIdentity: ['string', 'text', ''],
        eosContract: ['string', 'text', 'nexowatt-ocpp21-0.4-native'],
        deviceType: ['string', 'text', 'evCharger'],
        controlScope: ['string', 'text', 'station'],
        sessionId: ['string', 'text', ''],
        eosControlLeaseSupported: ['boolean', 'indicator', true],
        connectorCount: ['number', 'value', 0],
        evseCount: ['number', 'value', 0],
        topologySource: ['string', 'text', 'unknown'],
        connection: ['boolean', 'indicator.connected', false],
        socketConnected: ['boolean', 'indicator.connected', false],
        status: ['string', 'indicator.status', ''],
        errorCode: ['string', 'text', ''],
        statusInfo: ['string', 'text', ''],
        vendorErrorCode: ['string', 'text', ''],
        vendorId: ['string', 'text', ''],
        protocol: ['string', 'text', ''],
        vendor: ['string', 'text', ''],
        model: ['string', 'text', ''],
        firmware: ['string', 'text', ''],
        serialNumber: ['string', 'text', ''],
        vin: ['string', 'text', ''],
        rfid: ['string', 'text', ''],
        rfidType: ['string', 'text', ''],
        chargePointSerialNumber: ['string', 'text', ''],
        chargeBoxSerialNumber: ['string', 'text', ''],
        iccid: ['string', 'text', ''],
        imsi: ['string', 'text', ''],
        meterType: ['string', 'text', ''],
        meterSerialNumber: ['string', 'text', ''],
        heartbeatInterval: ['number', 'value.interval', 0, 's'],
        lastHeartbeat: ['string', 'value.time', ''],
        firmwareStatus: ['string', 'text', ''],
        diagnosticsStatus: ['string', 'text', ''],
        logStatus: ['string', 'text', ''],
      };
      for (const [key, [type, role, def, unit]] of Object.entries(info)) {
        await state(`${identity}.info.${key}`, { name: key, type, role, read: true, write: false, def, unit });
      }

      const health = {
        online: ['boolean', 'indicator.connected', false],
        activityFresh: ['boolean', 'indicator.connected', false],
        socketConnected: ['boolean', 'indicator.connected', false],
        heartbeatAlive: ['boolean', 'indicator.connected', false],
        meterFresh: ['boolean', 'indicator', false],
        powerFresh: ['boolean', 'indicator', false],
        exportPowerFresh: ['boolean', 'indicator', false],
        currentFresh: ['boolean', 'indicator', false],
        dataFresh: ['boolean', 'indicator', false],
        socFresh: ['boolean', 'indicator', false],
        staleReason: ['string', 'text', ''],
        powerSource: ['string', 'text', 'unknown-or-incomplete'],
        heartbeat: ['string', 'value.time', ''],
        dashboardConfirmedKey: ['string', 'text', ''],
        lastHeartbeatMs: ['number', 'value.time', 0],
        lastSeen: ['string', 'value.time', ''],
        lastSeenMs: ['number', 'value.time', 0],
        lastAction: ['string', 'text', ''],
        lastBoot: ['string', 'value.time', ''],
        lastMeterValue: ['string', 'value.time', ''],
        lastPowerValue: ['string', 'value.time', ''],
        lastExportPowerValue: ['string', 'value.time', ''],
        lastCurrentValue: ['string', 'value.time', ''],
        lastSoc: ['string', 'value.time', ''],
        messageAgeSec: ['number', 'value.interval', -1, 's'],
        activityAgeSec: ['number', 'value.interval', -1, 's'],
        activityTimeoutSec: ['number', 'value.interval', 90, 's'],
        heartbeatTimeoutSec: ['number', 'value.interval', 0, 's'],
        heartbeatAgeSec: ['number', 'value.interval', -1, 's'],
        meterAgeSec: ['number', 'value.interval', -1, 's'],
        powerAgeSec: ['number', 'value.interval', -1, 's'],
        exportPowerAgeSec: ['number', 'value.interval', -1, 's'],
        currentAgeSec: ['number', 'value.interval', -1, 's'],
        statusAgeSec: ['number', 'value.interval', -1, 's'],
        socAgeSec: ['number', 'value.interval', -1, 's'],
        refreshStatus: ['string', 'text', 'not-run'],
        refreshSupport: ['string', 'json', '{}'],
        refreshLastAttempt: ['string', 'value.time', ''],
        refreshLastSuccess: ['string', 'value.time', ''],
        refreshLastError: ['string', 'text', ''],
        refreshSuppressedUntil: ['string', 'value.time', ''],
        refreshSuppressedReason: ['string', 'text', ''],
        refreshRelatedDisconnects: ['number', 'value', 0],
        lastRepublish: ['string', 'value.time', ''],
        safeZeroApplied: ['boolean', 'indicator', false],
        safeZeroReason: ['string', 'text', ''],
        lastDisconnectAt: ['string', 'value.time', ''],
        lastDisconnectCode: ['number', 'value', 0],
        lastDisconnectReason: ['string', 'text', ''],
        reconnectCount: ['number', 'value', 0],
        disconnectCount: ['number', 'value', 0],
        queueDepth: ['number', 'value', 0],
        queueMaxDepth: ['number', 'value', 0],
        queueDropped: ['number', 'value', 0],
        queueErrors: ['number', 'value', 0],
        queueLastError: ['string', 'text', ''],
        outboundCallCount: ['number', 'value', 0],
        outboundErrorCount: ['number', 'value', 0],
        lastOutboundMethod: ['string', 'text', ''],
        lastOutboundAt: ['string', 'value.time', ''],
        lastTransactionStopReason: ['string', 'text', ''],
      };
      for (const [key, [type, role, def, unit]] of Object.entries(health)) {
        await state(`${identity}.health.${key}`, { name: key, type, role, read: true, write: false, def, unit });
      }

      const configurationStates = {
        refresh: {
          name: { en: 'Read configuration from charging station', de: 'Konfiguration von der Ladestation lesen' },
          type: 'boolean', role: 'button', read: true, write: true, def: false,
        },
        lastRefresh: {
          name: { en: 'Last completed configuration refresh', de: 'Letzte abgeschlossene Konfigurationsabfrage' },
          type: 'string', role: 'value.time', read: true, write: false, def: '',
        },
        status: {
          name: { en: 'Configuration operation status', de: 'Status der Konfigurationsverarbeitung' },
          type: 'string', role: 'text', read: true, write: false, def: 'idle',
        },
        error: {
          name: { en: 'Last configuration error', de: 'Letzter Konfigurationsfehler' },
          type: 'string', role: 'text', read: true, write: false, def: '',
        },
        count: {
          name: { en: 'Configuration values in latest complete inventory', de: 'Konfigurationswerte im letzten vollständigen Inventar' },
          type: 'number', role: 'value', read: true, write: false, def: 0, min: 0,
        },
        reportInProgress: {
          name: { en: 'Configuration report in progress', de: 'Konfigurationsbericht läuft' },
          type: 'boolean', role: 'indicator.working', read: true, write: false, def: false,
        },
        requestId: {
          name: { en: 'OCPP configuration request ID', de: 'OCPP-Anfrage-ID der Konfiguration' },
          type: 'number', role: 'value', read: true, write: false, def: 0,
        },
        lastSequence: {
          name: { en: 'Last configuration report sequence', de: 'Letzte Sequenz des Konfigurationsberichts' },
          type: 'number', role: 'value', read: true, write: false, def: 0,
        },
        lastChangedKey: {
          name: { en: 'Last changed configuration value', de: 'Zuletzt geänderter Konfigurationswert' },
          type: 'string', role: 'text', read: true, write: false, def: '',
        },
        lastChangedAt: {
          name: { en: 'Last configuration change timestamp', de: 'Zeitpunkt der letzten Konfigurationsänderung' },
          type: 'string', role: 'value.time', read: true, write: false, def: '',
        },
        lastChangeStatus: {
          name: { en: 'Last configuration change status', de: 'Status der letzten Konfigurationsänderung' },
          type: 'string', role: 'text', read: true, write: false, def: '',
        },
        lastChangeResponse: {
          name: { en: 'Last configuration change response', de: 'Antwort der letzten Konfigurationsänderung' },
          type: 'string', role: 'json', read: true, write: false, def: '',
        },
        rebootRequired: {
          name: { en: 'Charging station reports reboot required', de: 'Ladestation meldet erforderlichen Neustart' },
          type: 'boolean', role: 'indicator', read: true, write: false, def: false,
        },
        unknownKeysJson: {
          name: { en: 'Unknown OCPP 1.6 configuration keys', de: 'Unbekannte OCPP-1.6-Konfigurationsschlüssel' },
          type: 'string', role: 'json', read: true, write: false, def: '[]',
        },
        indexJson: {
          name: { en: 'Configuration datapoint index', de: 'Index der Konfigurationsdatenpunkte' },
          type: 'string', role: 'json', read: true, write: false, def: '{}',
        },
      };
      for (const [key, common] of Object.entries(configurationStates)) {
        await state(`${identity}.configuration.${key}`, common);
      }

      const vehicle = {
        evseId: ['number', 'value', 0],
        lastUpdate: ['string', 'value.time', ''],
        energyTransferMode: ['string', 'text', ''],
        departureTime: ['string', 'value.time', ''],
        socPercent: ['number', 'value.battery', 0, '%'],
        targetSocPercent: ['number', 'value.battery', 0, '%'],
        fullSocPercent: ['number', 'value.battery', 0, '%'],
        bulkSocPercent: ['number', 'value.battery', 0, '%'],
        energyRequestWh: ['number', 'value.energy', 0, 'Wh'],
        batteryCapacityWh: ['number', 'value.energy', 0, 'Wh'],
        maxPowerW: ['number', 'value.power', 0, 'W'],
        maxCurrentA: ['number', 'value.current', 0, 'A'],
        maxVoltageV: ['number', 'value.voltage', 0, 'V'],
        maxScheduleTuples: ['number', 'value', 0],
      };
      for (const [key, [type, role, def, unit]] of Object.entries(vehicle)) {
        await state(`${identity}.vehicle.${key}`, { name: key, type, role, read: true, write: false, def, unit });
      }

      const measurementSeeds = [
        ['Power.Active.Import', ''], ['Power.Active.Export', ''], ['Power.Offered', ''],
        ['Current.Import', ''], ['Current.Export', ''],
        ['Energy.Active.Import.Register', ''], ['Energy.Active.Export.Register', ''],
        ['SoC', ''], ['Voltage', ''], ['Frequency', ''], ['Temperature', ''],
        ['Power.Active.Import', 'L1'], ['Power.Active.Import', 'L2'], ['Power.Active.Import', 'L3'],
        ['Current.Import', 'L1'], ['Current.Import', 'L2'], ['Current.Import', 'L3'],
        ['Voltage', 'L1'], ['Voltage', 'L2'], ['Voltage', 'L3'],
      ];
      for (const [measurand, phase] of measurementSeeds) {
        const definition = measurementDefinition(measurand, phase);
        await this.ensureMeasurement(identity, definition.key, definition.unit, definition);
        if (definition.kwhKey) {
          await this.ensureMeasurement(identity, definition.kwhKey, 'kWh', {
            ...definition,
            key: definition.kwhKey,
            kwhKey: undefined,
            unit: 'kWh',
          });
        }
      }
      await this.ensureTextMeasurement(identity, 'lastUpdate', { en: 'Last measurement update', de: 'Letzte Messwertaktualisierung' }, 'value.time');

      const controls = {
        eosLeaseUntilMs: { name: 'EOS control lease deadline (Unix ms, max 30 s)', type: 'number', role: 'value.time', write: true, def: 0 },
        eosLeaseArmed: { name: 'EOS lease watchdog persistently armed', type: 'boolean', role: 'indicator', write: false, def: false },
        eosLeaseState: { name: 'EOS lease watchdog state', type: 'string', role: 'text', write: false, def: 'unarmed' },
        availability: { name: { en: 'Charging station available', de: 'Ladestation verfügbar' }, type: 'boolean', role: 'switch.power', write: true, def: true },
        hardReset: { name: { en: 'Hard reset', de: 'Harter Neustart' }, type: 'boolean', role: 'button', write: true, def: false },
        softReset: { name: { en: 'Soft reset', de: 'Sanfter Neustart' }, type: 'boolean', role: 'button', write: true, def: false },
        chargeLimit: { name: { en: 'Requested charging limit', de: 'Angeforderte Ladegrenze' }, type: 'number', role: 'value.power', write: true, def: 0, unit: 'W', min: 0 },
        chargeLimitType: { name: { en: 'Charging limit unit', de: 'Einheit der Ladegrenze' }, type: 'string', role: 'text', write: true, def: 'W', states: { W: 'W', A: 'A' } },
        numberOfPhases: { name: { en: 'Number of phases', de: 'Anzahl Phasen' }, type: 'number', role: 'value', write: true, def: 3, min: 1, max: 3 },
        requestedChargeLimit: { name: { en: 'Last requested charging limit', de: 'Zuletzt angeforderte Ladegrenze' }, type: 'number', role: 'value', write: false, def: 0 },
        appliedChargeLimitUnit: { name: 'Applied limit unit', type: 'string', role: 'text', write: false, def: '' },
        appliedChargeLimitW: { name: 'Confirmed limit expressed as W ceiling', type: 'number', role: 'value.power', unit: 'W', write: false, def: 0 },
        chargeLimitStatus: { name: 'Atomic charging limit status for current session', type: 'string', role: 'json', write: false, def: '{}' },
        appliedChargeLimitValid: { name: 'Charging limit confirmed in current session', type: 'boolean', role: 'indicator', write: false, def: false },
        appliedChargeLimit: { name: { en: 'Applied charging limit', de: 'Angewendete Ladegrenze' }, type: 'number', role: 'value', write: false, def: 0 },
        chargeLimitReason: { name: { en: 'Charging limit decision', de: 'Entscheidung zur Ladegrenze' }, type: 'string', role: 'text', write: false, def: '' },
        chargeLimitClamped: { name: { en: 'Charging limit was clamped', de: 'Ladegrenze wurde angehoben' }, type: 'boolean', role: 'indicator', write: false, def: false },
        lastCommand: { name: { en: 'Last OCPP command', de: 'Letzter OCPP-Befehl' }, type: 'string', role: 'text', write: false, def: '' },
        lastCommandAt: { name: { en: 'Last command timestamp', de: 'Zeit des letzten Befehls' }, type: 'string', role: 'value.time', write: false, def: '' },
        lastResponse: { name: { en: 'Last command response', de: 'Letzte Befehlsantwort' }, type: 'string', role: 'json', write: false, def: '' },
        lastError: { name: { en: 'Last command error', de: 'Letzter Befehlsfehler' }, type: 'string', role: 'text', write: false, def: '' },
        lastSuccess: { name: { en: 'Last command successful', de: 'Letzter Befehl erfolgreich' }, type: 'boolean', role: 'indicator', write: false, def: false },
        rpcMethod: { name: 'OCPP method/action', type: 'string', role: 'text', write: true, def: '' },
        rpcPayload: { name: 'OCPP payload (JSON)', type: 'string', role: 'json', write: true, def: '' },
        rpcExecute: { name: 'Execute generic OCPP call', type: 'boolean', role: 'button', write: true, def: false },
        rpcLastResponse: { name: 'Generic OCPP response', type: 'string', role: 'json', write: false, def: '' },
        rpcLastError: { name: 'Generic OCPP error', type: 'string', role: 'text', write: false, def: '' },
        startIdToken: { name: 'Start idToken / idTag', type: 'string', role: 'text', write: true, def: '' },
        startIdTokenType: { name: 'Start idToken type (2.x)', type: 'string', role: 'text', write: true, def: 'Central' },
        startEvseId: { name: 'Start EVSE / connector ID', type: 'number', role: 'value', write: true, def: 1, min: 0 },
        startRemoteStartId: { name: 'Start remoteStartId (2.x)', type: 'number', role: 'value', write: true, def: 1, min: 1 },
        startChargingProfile: { name: 'Optional start chargingProfile JSON', type: 'string', role: 'json', write: true, def: '' },
        startTrigger: { name: 'Start transaction', type: 'boolean', role: 'button', write: true, def: false },
        startLastResponse: { name: 'Start response', type: 'string', role: 'json', write: false, def: '' },
        startLastError: { name: 'Start error', type: 'string', role: 'text', write: false, def: '' },
        stopTransactionId: { name: 'Stop transactionId (empty = last)', type: 'string', role: 'text', write: true, def: '' },
        stopTrigger: { name: 'Stop transaction', type: 'boolean', role: 'button', write: true, def: false },
        stopLastResponse: { name: 'Stop response', type: 'string', role: 'json', write: false, def: '' },
        stopLastError: { name: 'Stop error', type: 'string', role: 'text', write: false, def: '' },
      };
      for (const [key, common] of Object.entries(controls)) {
        await state(`${identity}.control.${key}`, { ...common, read: true, write: !!common.write });
      }

      const txStates = {
        idTag: ['string', 'text', ''],
        idTagType: ['string', 'text', ''],
        transactionActive: ['boolean', 'indicator.working', false],
        chargingState: ['string', 'indicator.status', ''],
        triggerReason: ['string', 'text', ''],
        seqNo: ['number', 'value', 0],
        transactionStartMeter: ['number', 'value.energy', 0, 'Wh'],
        transactionStartMeter_kWh: ['number', 'value.energy', 0, 'kWh'],
        transactionEndMeter: ['number', 'value.energy', 0, 'Wh'],
        transactionEndMeter_kWh: ['number', 'value.energy', 0, 'kWh'],
        lastTransactionConsumption: ['number', 'value.energy', 0, 'Wh'],
        lastTransactionConsumption_kWh: ['number', 'value.energy', 0, 'kWh'],
        numberPhases: ['number', 'value', 0],
        lastType: ['string', 'text', ''],
        lastId: ['string', 'text', ''],
        lastEvseId: ['number', 'value', 0],
        lastConnectorId: ['number', 'value', 0],
        lastIdTag: ['string', 'text', ''],
        lastMeterStartWh: ['number', 'value.energy', 0, 'Wh'],
        lastMeterStartKWh: ['number', 'value.energy', 0, 'kWh'],
        lastMeterStopWh: ['number', 'value.energy', 0, 'Wh'],
        lastMeterStopKWh: ['number', 'value.energy', 0, 'kWh'],
        lastReason: ['string', 'text', ''],
        lastTimestamp: ['string', 'value.time', ''],
      };
      for (const [key, [type, role, def, unit]] of Object.entries(txStates)) {
        await state(`${identity}.transactions.${key}`, { name: key, type, role, read: true, write: false, def, unit });
      }

      this._identityStructureReady.add(identity);
      // Preserve existing user mappings until explicit migration.
    }

    if (this.config.connectorDetails === true) await this.ensureConnectorStructure(identity, evseId, connectorId);
    // Existing connector objects are never deleted automatically.
    if ((this.config.createPublicAliases === true || this.config.createTechnicalAliases === true) && !this._aliasDone.has(identity)) await this.ensureAliases(identity);
  }

  async ensureMetric(identity, evseId, connectorId, key, unit, meta = {}) {
    if (this.config.connectorDetails !== true) return undefined;
    await this.ensureStructure(identity, evseId, connectorId);
    const base = this._connectorBase(identity, evseId, connectorId);
    const definition = meta && meta.definition;
    const compactKey = definition && !definition.extra
      ? sanitizeFlatKey(definition.key)
      : `extra_${sanitizeFlatKey(key)}`;
    const id = `${base}.${compactKey}`;
    const options = definition || {};
    await this._setObjectNotExistsCached(id, {
      type: 'state',
      common: measurementCommon(compactKey, unit, options),
      native: {
        measurand: meta && meta.measurand,
        phase: meta && meta.phase,
      },
    });
    return id;
  }

  async ensureAgg(identity, key, unit) {
    const compactKey = compactKeyFromLegacyAggregate(key);
    return this.ensureMeasurement(identity, compactKey, unit);
  }

  async _setDisconnectedHealth(identity, reason, entry = this.runtimeIndex.get(identity)) {
    await this._publishChargeLimitStatus(identity, entry, { valid: false, reason: reason || 'disconnected' });
    await this.ensureStructure(identity);
    if (this.runtimeIndex.get(identity) !== entry) return;
    const writes = {
      [`${identity}.info.connection`]: false,
      [`${identity}.info.socketConnected`]: false,
      [`${identity}.health.online`]: false,
      [`${identity}.health.activityFresh`]: false,
      [`${identity}.health.socketConnected`]: false,
      [`${identity}.health.heartbeatAlive`]: false,
      [`${identity}.health.meterFresh`]: false,
      [`${identity}.health.powerFresh`]: false,
      [`${identity}.health.exportPowerFresh`]: false,
      [`${identity}.health.currentFresh`]: false,
      [`${identity}.health.socFresh`]: false,
      [`${identity}.health.dataFresh`]: false,
      [`${identity}.measurements.socPercent`]: null,
      [`${identity}.vehicle.socPercent`]: null,
      [`${identity}.health.safeZeroApplied`]: false,
      [`${identity}.health.safeZeroReason`]: '',
      [`${identity}.health.messageAgeSec`]: -1,
      [`${identity}.health.activityAgeSec`]: -1,
      [`${identity}.health.heartbeatAgeSec`]: -1,
      [`${identity}.health.meterAgeSec`]: -1,
      [`${identity}.health.powerAgeSec`]: -1,
      [`${identity}.health.exportPowerAgeSec`]: -1,
      [`${identity}.health.currentAgeSec`]: -1,
      [`${identity}.health.statusAgeSec`]: -1,
      [`${identity}.health.socAgeSec`]: -1,
      [`${identity}.health.refreshStatus`]: 'offline',
      [`${identity}.health.staleReason`]: String(reason || 'socket-disconnected'),
      [`${identity}.configuration.reportInProgress`]: false,
      [`${identity}.configuration.status`]: 'offline',
    };
    for (const [id, value] of Object.entries(writes)) {
      if (this.runtimeIndex.get(identity) !== entry) return;
      const category = id.includes('.health.') ? 'health' : id.includes('.configuration.') ? 'configuration' : 'status';
      await this._setStateFreshAsync(id, value, true, category);
    }
  }

  async _resetPersistedHealth() {
    const identities = new Set();
    const queries = [];
    if (typeof this.getStatesAsync === 'function') {
      queries.push(['getStatesAsync', '*.health.online'], ['getStatesAsync', '*.info.connection']);
    }
    if (typeof this.getForeignStatesAsync === 'function') {
      queries.push(
        ['getForeignStatesAsync', `${this.namespace}.*.health.online`],
        ['getForeignStatesAsync', `${this.namespace}.*.info.connection`],
      );
    }
    for (const [method, pattern] of queries) {
      try {
        const states = await this[method](pattern);
        for (const id of Object.keys(states || {})) {
          const rel = this._stripNs(id);
          const suffix = rel.endsWith('.health.online') ? '.health.online' : rel.endsWith('.info.connection') ? '.info.connection' : '';
          if (suffix) identities.add(rel.slice(0, -suffix.length));
        }
      } catch (e) {
        this.log.debug(`Could not inspect persisted OCPP health states (${pattern}): ${e && e.message || e}`);
      }
    }
    for (const identity of identities) {
      if (!identity) continue;
      try {
        await this._setDisconnectedHealth(identity, 'adapter-restarted-awaiting-station');
      } catch (e) {
        this.log.warn(`Could not reset persisted health for ${identity}: ${e && e.message || e}`);
      }
    }
  }

  async onReady() {
    if (typeof this.assertCanOperate === 'function') this.assertCanOperate();
    // Never leave persisted online/fresh flags true after an unclean restart.
    await this._resetPersistedHealth();

    const allowlist = Array.isArray(this.config.identityAllowlist)
      ? this.config.identityAllowlist.map(String).map((v) => v.trim()).filter(Boolean)
      : String(this.config.identityAllowlist || '').split(',').map((v) => v.trim()).filter(Boolean);

    const ctx = {
      assertCanOperate: () => { if (typeof this.assertCanOperate === 'function') this.assertCanOperate(); },
      log: this.log,
      config: {
        ...this.config,
        port: Math.max(1, Math.min(65535, Number(this.config.port) || 9220)),
        enable16: this.config.enable16 !== false,
        enable201: this.config.enable201 !== false,
        enable21: this.config.enable21 !== false,
        heartbeatIntervalSec: Math.max(10, Number(this.config.heartbeatIntervalSec) || 300),
        identityAllowlist: allowlist,
        callTimeoutSec: Math.max(5, Number(this.config.callTimeoutSec) || 20),
      },
      states: {
        setConnection: async (id, online, meta = {}) => {
          const entry = this.runtimeIndex.get(id);
          await this.ensureStructure(id);
          if (this.runtimeIndex.get(id) !== entry) return;
          const socketConnected = meta.socketConnected !== undefined ? !!meta.socketConnected : !!online;
          if (entry) entry.socketConnected = socketConnected;
          await this._setStateFreshAsync(`${id}.info.connection`, socketConnected, true, 'status');
          await this._setStateFreshAsync(`${id}.info.socketConnected`, socketConnected, true, 'status');
          await this._setStateFreshAsync(`${id}.health.online`, !!online && socketConnected, true, 'health');
          await this._setStateFreshAsync(`${id}.health.activityFresh`, !!online && socketConnected, true, 'health');
          await this._setStateFreshAsync(`${id}.health.socketConnected`, socketConnected, true, 'health');
          if (this.runtimeIndex.get(id) !== entry) return;
          if (!socketConnected) {
            await this._setDisconnectedHealth(id, 'socket-disconnected', entry);
          } else {
            for (const key of ['heartbeatAlive', 'meterFresh', 'powerFresh', 'exportPowerFresh', 'currentFresh', 'dataFresh', 'socFresh', 'safeZeroApplied']) {
              await this._setStateFreshAsync(`${id}.health.${key}`, false, true, 'health');
            }
            await this._setStateFreshAsync(`${id}.health.safeZeroReason`, '', true, 'health');
            await this._setStateFreshAsync(`${id}.health.staleReason`, 'awaiting-power-or-idle-status', true, 'health');
          }
          if (meta.rawIdentity !== undefined) {
            await this._setStateFreshAsync(`${id}.info.identity`, String(meta.rawIdentity), true, 'static');
            await this._setStateFreshAsync(`${id}.info.stateIdentity`, id, true, 'static');
          }
          if (meta.protocol !== undefined) await this._setStateFreshAsync(`${id}.info.protocol`, String(meta.protocol), true, 'static');
        },
        upsertIdentityMeta: async (id, meta) => {
          await this.ensureStructure(id);
          const infoKeys = ['protocol', 'vendor', 'model', 'firmwareVersion', 'serialNumber', 'chargePointSerialNumber', 'chargeBoxSerialNumber', 'iccid', 'imsi', 'meterType', 'meterSerialNumber'];
          const map = { firmwareVersion: 'firmware' };
          for (const key of infoKeys) {
            if (meta[key] !== undefined && meta[key] !== null) {
              await this._setStateFreshAsync(`${id}.info.${map[key] || key}`, meta[key], true, 'static');
            }
          }
          const rawIdentity = this._stateToRawIdentity.get(id) || id;
          await this._setStateFreshAsync(`${id}.info.identity`, rawIdentity, true, 'static');
          await this._setStateFreshAsync(`${id}.info.stateIdentity`, id, true, 'static');
        },
        upsertEvseState: async (id, evseId, connectorId, patch) => {
          await this.ensureStructure(id, evseId, connectorId);
          const base = await this.ensureConnectorStructure(id, evseId, connectorId);
          if (patch.errorCode !== undefined) await this._setStateFreshAsync(`${id}.info.errorCode`, patch.errorCode, true, 'status');
          if (patch.info !== undefined) await this._setStateFreshAsync(`${id}.info.statusInfo`, patch.info, true, 'status');
          if (patch.vendorErrorCode !== undefined) await this._setStateFreshAsync(`${id}.info.vendorErrorCode`, patch.vendorErrorCode, true, 'status');
          if (patch.vendorId !== undefined) await this._setStateFreshAsync(`${id}.info.vendorId`, patch.vendorId, true, 'status');
          if (!base) return;
          if (patch.status !== undefined) await this._setStateFreshAsync(`${base}.status`, patch.status, true, 'status');
          if (patch.errorCode !== undefined) await this._setStateFreshAsync(`${base}.errorCode`, patch.errorCode, true, 'status');
          if (patch.timestamp !== undefined) await this._setStateFreshAsync(`${base}.lastUpdate`, patch.timestamp, true, 'status');
          if (patch.info !== undefined) await this._setStateFreshAsync(`${base}.info`, patch.info, true, 'status');
          if (patch.vendorErrorCode !== undefined) await this._setStateFreshAsync(`${base}.vendorErrorCode`, patch.vendorErrorCode, true, 'status');
          if (patch.vendorId !== undefined) await this._setStateFreshAsync(`${base}.vendorId`, patch.vendorId, true, 'status');
        },
        pushTransactionEvent: async (id, evt) => {
          await this.ensureStructure(id, evt.evseId || 1, evt.connectorId || 1);
          const base = `${id}.transactions`;
          if (evt.type !== undefined) await this._setStateFreshAsync(`${base}.lastType`, evt.type, true, 'transaction');
          if (evt.txId !== undefined) await this._setStateFreshAsync(`${base}.lastId`, String(evt.txId), true, 'transaction');
          if (evt.evseId !== undefined) await this._setStateFreshAsync(`${base}.lastEvseId`, Number(evt.evseId), true, 'transaction');
          if (evt.connectorId !== undefined) await this._setStateFreshAsync(`${base}.lastConnectorId`, Number(evt.connectorId), true, 'transaction');
          if (evt.idTag !== undefined) {
            await this._setStateFreshAsync(`${base}.lastIdTag`, evt.idTag, true, 'transaction');
            await this._setStateFreshAsync(`${id}.transactions.idTag`, evt.idTag, true, 'transaction');
            await this._setStateFreshAsync(`${id}.info.rfid`, evt.idTag, true, 'status');
          }
          if (evt.idTokenType !== undefined) {
            await this._setStateFreshAsync(`${id}.transactions.idTagType`, String(evt.idTokenType), true, 'transaction');
            await this._setStateFreshAsync(`${id}.info.rfidType`, String(evt.idTokenType), true, 'status');
          }
          const meterEntry = this.runtimeIndex.get(id);
          const meterStarts = meterEntry && (meterEntry.transactionMeterStarts || (meterEntry.transactionMeterStarts = new Map()));
          const meterTxKey = evt.txId == null ? '' : String(evt.txId);
          if (evt.meterStart !== undefined && Number.isFinite(Number(evt.meterStart))) {
            const wh = Number(evt.meterStart);
            if (meterStarts && meterTxKey && (meterStarts.size < 1000 || meterStarts.has(meterTxKey))) meterStarts.set(meterTxKey, wh);
            await this._setStateFreshAsync(`${base}.lastMeterStartWh`, wh, true, 'counter');
            await this._setStateFreshAsync(`${base}.lastMeterStartKWh`, wh / 1000, true, 'counter');
            await this._setStateFreshAsync(`${id}.transactions.transactionStartMeter`, wh, true, 'counter');
            await this._setStateFreshAsync(`${id}.transactions.transactionStartMeter_kWh`, wh / 1000, true, 'counter');
          }
          if (evt.meterStop !== undefined && Number.isFinite(Number(evt.meterStop))) {
            const whStop = Number(evt.meterStop);
            await this._setStateFreshAsync(`${base}.lastMeterStopWh`, whStop, true, 'counter');
            await this._setStateFreshAsync(`${base}.lastMeterStopKWh`, whStop / 1000, true, 'counter');
            await this._setStateFreshAsync(`${id}.transactions.transactionEndMeter`, whStop, true, 'counter');
            await this._setStateFreshAsync(`${id}.transactions.transactionEndMeter_kWh`, whStop / 1000, true, 'counter');
            const startWh = meterStarts?.get(meterTxKey);
            meterStarts?.delete(meterTxKey);
            if (Number.isFinite(startWh)) {
              const consumptionWh = Math.max(0, whStop - startWh);
              await this._setStateFreshAsync(`${id}.transactions.lastTransactionConsumption`, consumptionWh, true, 'counter');
              await this._setStateFreshAsync(`${id}.transactions.lastTransactionConsumption_kWh`, consumptionWh / 1000, true, 'counter');
            }
          }
          if (evt.reason !== undefined) {
            await this._setStateFreshAsync(`${base}.lastReason`, evt.reason, true, 'transaction');
            if (evt.type === 'Stop') await this._setStateFreshAsync(`${id}.health.lastTransactionStopReason`, String(evt.reason || ''), true, 'health');
          }
          if (evt.ts !== undefined) await this._setStateFreshAsync(`${base}.lastTimestamp`, evt.ts, true, 'transaction');
          if (evt.triggerReason !== undefined) await this._setStateFreshAsync(`${id}.transactions.triggerReason`, String(evt.triggerReason || ''), true, 'transaction');
          if (evt.seqNo !== undefined && Number.isFinite(Number(evt.seqNo))) await this._setStateFreshAsync(`${id}.transactions.seqNo`, Number(evt.seqNo), true, 'transaction');
          await this._noteTransaction(id, evt);
        },
        setRfid: async (id, token, tokenType) => {
          await this.ensureStructure(id);
          if (token !== undefined && token !== null && String(token).length) {
            await this._setStateFreshAsync(`${id}.info.rfid`, String(token), true, 'status');
            await this._setStateFreshAsync(`${id}.transactions.idTag`, String(token), true, 'transaction');
          }
          if (tokenType !== undefined && tokenType !== null && String(tokenType).length) {
            await this._setStateFreshAsync(`${id}.info.rfidType`, String(tokenType), true, 'status');
            await this._setStateFreshAsync(`${id}.transactions.idTagType`, String(tokenType), true, 'transaction');
          }
        },
        connectorBase: this._connectorBase.bind(this),
        ensureConnectorStructure: this.ensureConnectorStructure.bind(this),
        ensureMeasurementState: this.ensureMeasurement.bind(this),
        ensureTextMeasurementState: this.ensureTextMeasurement.bind(this),
        ensureMetricState: this.ensureMetric.bind(this),
        ensureAggState: this.ensureAgg.bind(this),
        ensureStructure: this.ensureStructure.bind(this),
      },
      runtime: {
        resolveIdentity: this.resolveStationIdentity.bind(this),
        indexClient: this._indexClient.bind(this),
        unindexClient: this._unindexClient.bind(this),
        noteDisconnect: this._noteDisconnect.bind(this),
        getClient: (id) => (this.runtimeIndex.get(id) || {}).client,
        noteMessage: this._noteMessage.bind(this),
        noteBoot: this._noteBoot.bind(this),
        noteHeartbeat: this._noteHeartbeat.bind(this),
        noteStatus: this._noteStatus.bind(this),
        noteMeterValue: this._noteMeterValue.bind(this),
        publishScopedMeter: this._publishScopedMeter.bind(this),
        publishScopedSoc: this._publishScopedSoc.bind(this),
        noteSoc: this._noteSoc.bind(this),
        recordPhaseMetric: this._recordPhaseMetric.bind(this),
        getPhaseMetricTotal: this._getPhaseMetricTotal.bind(this),
      },
      defer: this._deferStationTask.bind(this),
      dp: { capture: this.captureOcppPayload.bind(this) },
      dm: { ingestNotifyReport: this.ingestNotifyReport.bind(this) },
      setStateChangedAsync: this.setStateChangedAsync.bind(this),
      setStateFreshAsync: this._setStateFreshAsync.bind(this),
    };

    const protocols = []
      .concat(ctx.config.enable16 ? ['ocpp1.6'] : [])
      .concat(ctx.config.enable201 ? ['ocpp2.0.1'] : [])
      .concat(ctx.config.enable21 ? ['ocpp2.1'] : []);
    if (protocols.length === 0) throw new Error('At least one OCPP protocol must be enabled');

    this.server = new OcppRpcServer(ctx, { port: ctx.config.port, protocols, strictMode: false });
    await this.server.listen();
    if (typeof this.subscribeStatesAsync === 'function') await this.subscribeStatesAsync('*');
    else this.subscribeStates('*');
    if (typeof this.assertCanOperate === 'function') this.assertCanOperate();

    const healthCheckMs = Math.max(2, Number(this.config.healthCheckIntervalSec) || 5) * 1000;
    this._watchdogTimer = setInterval(() => this._watchdogCycle(), healthCheckMs);
    this._eosLeaseTimer = setInterval(() => this._eosLeaseWatchdogCycle(), 1000);
    await this._watchdogCycle();
    this.log.info('NexoWatt OCPP adapter ready for NexoWatt EOS');
  }

  async onStateChange(id, state) {
    if (!state || state.ack || this._shuttingDown) return;
    const rel = this._stripNs(id);
    const leaseMatch = rel.match(/^([^\.]+)\.control\.eosLeaseUntilMs$/);
    if (leaseMatch) {
      try { await this._renewEosLease(leaseMatch[1], state); }
      catch (error) { this.log.warn(`EOS lease renewal failed: ${error.message}`); }
      return;
    }
    const match = (patterns) => {
      for (const pattern of Array.isArray(patterns) ? patterns : [patterns]) {
        const found = rel.match(pattern);
        if (found) return found;
      }
      return null;
    };

    const mHard = match([/^([^\.]+)\.control\.hardReset$/, /^([^\.]+)\.control\.hardReset\.trigger$/]);
    const mSoft = match([/^([^\.]+)\.control\.softReset$/, /^([^\.]+)\.control\.softReset\.trigger$/]);
    const mAvail = match(/^([^\.]+)\.control\.availability$/);
    const mLimit = match(/^([^\.]+)\.control\.chargeLimit$/);
    const mLimitType = match(/^([^\.]+)\.control\.chargeLimitType$/);
    const mPhases = match(/^([^\.]+)\.control\.numberOfPhases$/);
    const mRpcExec = match([/^([^\.]+)\.control\.rpcExecute$/, /^([^\.]+)\.control\.rpc\.execute$/]);
    const mRpcMethod = match([/^([^\.]+)\.control\.rpcMethod$/, /^([^\.]+)\.control\.rpc\.method$/]);
    const mRpcPayload = match([/^([^\.]+)\.control\.rpcPayload$/, /^([^\.]+)\.control\.rpc\.payload$/]);
    const mReqStartTrigger = match([/^([^\.]+)\.control\.startTrigger$/, /^([^\.]+)\.control\.requestStartTransaction\.trigger$/]);
    const mReqStartIdToken = match([/^([^\.]+)\.control\.startIdToken$/, /^([^\.]+)\.control\.requestStartTransaction\.idToken$/]);
    const mReqStartIdTokenType = match([/^([^\.]+)\.control\.startIdTokenType$/, /^([^\.]+)\.control\.requestStartTransaction\.idTokenType$/]);
    const mReqStartEvseId = match([/^([^\.]+)\.control\.startEvseId$/, /^([^\.]+)\.control\.requestStartTransaction\.evseId$/]);
    const mReqStartRemoteStartId = match([/^([^\.]+)\.control\.startRemoteStartId$/, /^([^\.]+)\.control\.requestStartTransaction\.remoteStartId$/]);
    const mReqStartProfile = match([/^([^\.]+)\.control\.startChargingProfile$/, /^([^\.]+)\.control\.requestStartTransaction\.chargingProfile$/]);
    const mReqStopTrigger = match([/^([^\.]+)\.control\.stopTrigger$/, /^([^\.]+)\.control\.requestStopTransaction\.trigger$/]);
    const mReqStopTxId = match([/^([^\.]+)\.control\.stopTransactionId$/, /^([^\.]+)\.control\.requestStopTransaction\.transactionId$/]);
    const rawConfigurationMatch = match(/^([^\.]+)\.configuration\.([^\.]+)$/);
    const mConfigurationRefresh = rawConfigurationMatch && rawConfigurationMatch[2] === 'refresh' ? rawConfigurationMatch : null;
    const mConfigurationValue = rawConfigurationMatch && !RESERVED_CONFIGURATION_KEYS.has(rawConfigurationMatch[2]) ? rawConfigurationMatch : null;

    const matches = [mHard, mSoft, mAvail, mLimit, mLimitType, mPhases, mRpcExec, mRpcMethod, mRpcPayload,
      mReqStartTrigger, mReqStartIdToken, mReqStartIdTokenType, mReqStartEvseId, mReqStartRemoteStartId,
      mReqStartProfile, mReqStopTrigger, mReqStopTxId, mConfigurationRefresh, mConfigurationValue];
    const identityMatch = matches.find(Boolean);
    if (!identityMatch) return;
    const identity = identityMatch[1];

    if (mConfigurationRefresh) {
      if (!state.val) {
        await this._setStateFreshAsync(rel, false, true, 'configuration');
        return;
      }
      try {
        await this._refreshConfiguration(identity, { automatic: false });
      } catch (error) {
        this.log.warn(`OCPP configuration refresh failed (${identity}): ${error && error.message || error}`);
      } finally {
        await this._setStateFreshAsync(rel, false, true, 'configuration');
      }
      return;
    }

    if (mConfigurationValue) {
      try {
        const result = await this._queueConfigurationWrite(identity, rel, state.val);
        if (result && result.status === 'Superseded') return;
      } catch (error) {
        this.log.warn(`OCPP configuration write failed (${identity}, ${mConfigurationValue[2]}): ${error && error.message || error}`);
        const meta = await this._resolveConfigurationMeta(rel);
        const connected = !!this.runtimeIndex.get(identity)?.client;
        const writable = configurationWritable(meta, this.config.configurationWriteEnabled !== false);
        await this._recordConfigurationStatus(identity, {
          status: !connected ? 'offline' : !writable ? 'write-disabled' : 'write-error',
          error: String(error && error.message || error),
          lastChangedKey: meta ? (meta.kind === 'ocpp16' ? meta.key : this._configurationDisplayName(meta)) : mConfigurationValue[2],
          lastChangedAt: new Date().toISOString(),
          lastChangeStatus: 'Error',
        });
        await this._restoreConfigurationState(rel, meta);
      }
      return;
    }

    const ack = async (value) => {
      const current = await this.getStateAsync(rel);
      if (!current || current.ack || current.val !== state.val || (state.ts != null && current.ts !== state.ts)) return;
      return this._setStateFreshAsync(rel, value, true, 'control');
    };
    const ackIfStillCurrent = async () => {
      const current = await this.getStateAsync(rel);
      if (!current || current.ack) return;
      const currentVal = current.val;
      const originalVal = state.val;
      const same = (typeof currentVal === 'number' || typeof originalVal === 'number')
        ? Number.isFinite(Number(currentVal)) && Number.isFinite(Number(originalVal)) && Number(currentVal) === Number(originalVal)
        : String(currentVal) === String(originalVal);
      if (same) await ack(currentVal);
    };
    const readControl = async (flatKey, legacyPath, fallback = undefined) => {
      const flat = await this.getStateAsync(`${identity}.control.${flatKey}`);
      if (flat && flat.val !== undefined && flat.val !== null && flat.val !== '') return flat.val;
      if (legacyPath) {
        const legacy = await this.getStateAsync(`${identity}.control.${legacyPath}`);
        if (legacy && legacy.val !== undefined && legacy.val !== null && legacy.val !== '') return legacy.val;
      }
      return fallback;
    };
    const setSpecificResult = async (section, response, error) => {
      if (!section) return;
      const keys = section === 'rpc'
        ? ['rpcLastResponse', 'rpcLastError']
        : section === 'start'
          ? ['startLastResponse', 'startLastError']
          : ['stopLastResponse', 'stopLastError'];
      const errorText = error ? String(error && error.message || error) : '';
      await this._setStateFreshAsync(`${identity}.control.${keys[0]}`, errorText ? '' : this._stringifyControlValue(response), true, 'control');
      await this._setStateFreshAsync(`${identity}.control.${keys[1]}`, errorText, true, 'control');
    };
    const succeed = async (method, response, ackValue, section) => {
      await this._recordControlResult(identity, method, response, undefined);
      await setSpecificResult(section, response, undefined);
      await ack(ackValue);
    };
    const fail = async (method, error, ackValue, section) => {
      this.log.warn(`NexoWatt OCPP control failed (${identity}, ${method}): ${error && error.message || error}`);
      await this._recordControlResult(identity, method, undefined, error);
      await setSpecificResult(section, undefined, error);
      await ack(ackValue);
    };

    // These are local input states. They are acknowledged without issuing a
    // protocol command until their matching trigger or limit state is written.
    if (mRpcMethod || mRpcPayload || mLimitType || mReqStartIdToken || mReqStartIdTokenType
      || mReqStartEvseId || mReqStartRemoteStartId || mReqStartProfile || mReqStopTxId) {
      await ack(state.val);
      return;
    }

    const entry = this.runtimeIndex.get(identity);
    const proto = entry && entry.proto;
    const call = (method, payload) => this._callClient(identity, method, payload);
    const action = mHard || mSoft ? 'Reset'
      : mAvail ? 'ChangeAvailability'
        : mLimit || mPhases ? 'SetChargingProfile'
          : mRpcExec ? 'RPC'
            : mReqStartTrigger ? (proto === 'ocpp1.6' ? 'RemoteStartTransaction' : 'RequestStartTransaction')
              : mReqStopTrigger ? (proto === 'ocpp1.6' ? 'RemoteStopTransaction' : 'RequestStopTransaction')
                : 'Control';
    const section = mRpcExec ? 'rpc' : mReqStartTrigger ? 'start' : mReqStopTrigger ? 'stop' : undefined;

    let offlineAckValue = state.val;
    if (mHard || mSoft || mRpcExec || mReqStartTrigger || mReqStopTrigger) offlineAckValue = false;
    if (mAvail) offlineAckValue = !!state.val;
    if (mLimit) offlineAckValue = Math.max(0, Number.isFinite(Number(state.val)) ? Number(state.val) : 0);
    if (mPhases) offlineAckValue = Math.max(1, Math.min(3, Math.round(Number(state.val) || 3)));

    if (!entry || !entry.client) {
      await fail(action, new Error('Charging station is not connected'), offlineAckValue, section);
      return;
    }

    try {
      if (mRpcExec) {
        if (!state.val) { await ack(false); return; }
        const method = String(await readControl('rpcMethod', 'rpc.method', '') || '').trim();
        const payloadText = String(await readControl('rpcPayload', 'rpc.payload', '') || '').trim();
        if (!method) throw new Error('Missing OCPP method/action');
        let payload = {};
        if (payloadText) {
          try { payload = JSON.parse(payloadText); } catch (error) { throw new Error(`Payload is not valid JSON: ${error.message}`); }
        }
        if (['SetChargingProfile', 'ClearChargingProfile', 'RemoteStartTransaction', 'RequestStartTransaction'].includes(method)) {
          const lease = await this._ensureEosLease(identity);
          if (lease.armed && (!this._eosLeaseFresh(lease) || lease.stopRequired)) throw new Error('EOS_LEASE_EXPIRED');
        }
        if (method === 'SetChargingProfile' || method === 'ClearChargingProfile') {
          entry.lastSmartCharging = undefined;
          await this._publishChargeLimitStatus(identity, entry, { valid: false, reason: 'manual-profile-command' });
        }
        const response = await call(method, payload);
        await succeed(method, response, false, 'rpc');
        return;
      }

      if (mReqStartTrigger) {
        if (!state.val) { await ack(false); return; }
        const idToken = String(await readControl('startIdToken', 'requestStartTransaction.idToken', '') || '').trim();
        const idTokenType = String(await readControl('startIdTokenType', 'requestStartTransaction.idTokenType', 'Central') || 'Central').trim() || 'Central';
        const evseId = Math.max(0, Number(await readControl('startEvseId', 'requestStartTransaction.evseId', 1) || 1));
        let remoteStartId = Number(await readControl('startRemoteStartId', 'requestStartTransaction.remoteStartId', 0) || 0);
        if (!Number.isFinite(remoteStartId) || remoteStartId <= 0) remoteStartId = Math.floor(Math.random() * 0x7ffffffe) + 1;
        if (!idToken) throw new Error('Missing idToken/idTag');

        let response;
        if (proto === 'ocpp1.6') {
          response = await call('RemoteStartTransaction', { connectorId: evseId || 1, idTag: idToken });
          this._assertCallAccepted('RemoteStartTransaction', response);
        } else {
          const payload = { idToken: { idToken, type: idTokenType }, remoteStartId };
          if (evseId > 0) payload.evseId = evseId;
          const profileText = String(await readControl('startChargingProfile', 'requestStartTransaction.chargingProfile', '') || '').trim();
          if (profileText) {
            try { payload.chargingProfile = JSON.parse(profileText); } catch (error) { throw new Error(`chargingProfile is not valid JSON: ${error.message}`); }
          }
          response = await call('RequestStartTransaction', payload);
          this._assertCallAccepted('RequestStartTransaction', response);
        }
        await this._setStateFreshAsync(`${identity}.control.startRemoteStartId`, remoteStartId, true, 'control');
        await succeed(proto === 'ocpp1.6' ? 'RemoteStartTransaction' : 'RequestStartTransaction', response, false, 'start');
        return;
      }

      if (mReqStopTrigger) {
        if (!state.val) { await ack(false); return; }
        let transactionId = String(await readControl('stopTransactionId', 'requestStopTransaction.transactionId', '') || '').trim();
        if (!transactionId) {
          const active = [...this._getStationTelemetry(identity, entry).transactions.values()].filter(t => t.active && t.id);
          if (active.length !== 1) throw new Error('Select an explicit active transactionId');
          transactionId = active[0].id;
        }
        if (!transactionId) throw new Error('Missing transactionId and no last transaction is known');
        const response = proto === 'ocpp1.6'
          ? await call('RemoteStopTransaction', { transactionId: Number.isFinite(Number(transactionId)) ? Number(transactionId) : transactionId })
          : await call('RequestStopTransaction', { transactionId });
        this._assertCallAccepted(proto === 'ocpp1.6' ? 'RemoteStopTransaction' : 'RequestStopTransaction', response);
        await this._setStateFreshAsync(`${identity}.control.stopTransactionId`, transactionId, true, 'control');
        await succeed(proto === 'ocpp1.6' ? 'RemoteStopTransaction' : 'RequestStopTransaction', response, false, 'stop');
        return;
      }

      if (mHard || mSoft) {
        if (!state.val) { await ack(false); return; }
        const type = proto === 'ocpp1.6' ? (mHard ? 'Hard' : 'Soft') : (mHard ? 'Immediate' : 'OnIdle');
        const response = await call('Reset', { type });
        this._assertCallAccepted('Reset', response);
        await succeed('Reset', response, false);
        return;
      }

      if (mAvail) {
        if (typeof state.val !== 'boolean') throw new Error('Invalid availability');
        const available = state.val;
        const response = proto === 'ocpp1.6'
          ? await call('ChangeAvailability', { connectorId: 0, type: available ? 'Operative' : 'Inoperative' })
          : await call('ChangeAvailability', { operationalStatus: available ? 'Operative' : 'Inoperative' });
        this._assertCallAccepted('ChangeAvailability', response);
        await succeed('ChangeAvailability', response, available);
        return;
      }

      if (mPhases) {
        const phases = Math.max(1, Math.min(3, Math.round(Number(state.val) || 3)));
        const currentLimit = Math.max(0, Number((await this.getStateAsync(`${identity}.control.chargeLimit`))?.val || 0));
        if (currentLimit <= 0) {
          await succeed('numberOfPhases', { stored: true, profileReapplied: false, reason: 'no-active-limit' }, phases);
          return;
        }
        const rawUnit = String((await this.getStateAsync(`${identity}.control.chargeLimitType`))?.val || 'W').trim().toUpperCase();
        if (!['A','W'].includes(rawUnit)) throw new Error('Invalid limit unit');
        const rateUnit = rawUnit;
        const result = await this._queueSmartCharging(identity, currentLimit, rateUnit, phases);
        if (result.status === 'Superseded') {
          await ackIfStillCurrent();
          return;
        }
        await succeed(result.method || 'SetChargingProfile', result, phases);
        return;
      }

      if (mLimit) {
        if (typeof state.val !== 'number' || !Number.isFinite(state.val) || state.val < 0) throw new Error('Invalid charging limit');
        const limit = state.val;
        const rawUnit = String((await this.getStateAsync(`${identity}.control.chargeLimitType`))?.val || 'W').trim().toUpperCase();
        if (!['A','W'].includes(rawUnit)) throw new Error('Invalid limit unit');
        const rateUnit = rawUnit;
        const phases = Math.max(1, Math.min(3, Math.round(Number((await this.getStateAsync(`${identity}.control.numberOfPhases`))?.val || 3))));
        const result = await this._queueSmartCharging(identity, limit, rateUnit, phases);
        if (result.status === 'Superseded') {
          await ackIfStillCurrent();
          return;
        }
        await succeed(result.method || (result.action === 'clear' ? 'ClearChargingProfile' : 'SetChargingProfile'), result, limit);
      }
    } catch (error) {
      await fail(action, error, offlineAckValue, section);
    }
  }

  async onUnload(cb) {
    this._shuttingDown = true;
    if (this._eosLeaseTimer) {
      clearInterval(this._eosLeaseTimer);
      this._eosLeaseTimer = null;
    }
    if (this._watchdogTimer) {
      clearInterval(this._watchdogTimer);
      this._watchdogTimer = null;
    }
    const identities = [...this.runtimeIndex.keys()];
    try {
      if (this.server) await this.server.close();
      for (const identity of identities) {
        try { await this._setDisconnectedHealth(identity, 'adapter-stopped'); } catch (e) { /* best effort during shutdown */ }
      }
    } catch (e) {
      this.log.warn(`NexoWatt OCPP shutdown warning: ${e && e.message || e}`);
    } finally {
      this.server = null;
      cb();
    }
  }
}
return NexoWattOcppAdapter;
}
module.exports = { createOcppRuntime };

