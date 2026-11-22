/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Validiert und versioniert die neue NVP-Topologie an der Installer-Vertrauensgrenze.
 * Daten und Wirkung: Liest konfigurierte Geräte und ioBroker-Aliasobjekte, liefert Diagnose und
 * speichert ausschließlich nach erfolgreicher Gesamtprüfung über den bestehenden Installer-Pfad.
 * Es werden keine Gerätesollwerte geschrieben. Dynamischer Aktivbetrieb ist in diesem Stand gesperrt.
 * Sicherheitsgrenze: Eingaben, Fremdobjekte und Validatorausgaben sind unbekannt, bis native Guards ihren Vertrag bestätigen.
 * Bei Änderungen: Aliasidentität, Versionskonflikte, Rollen, Import und native Konfiguration gemeinsam prüfen.
 * Verknüpfungen: docs/quellcode/src-ts/runtime-executables/lib/nvp-config-api.md
 * Einstieg: docs/QUELLCODE_WEGWEISER_DE.md; Pflege: docs/DOKUMENTATIONSSTANDARD_DE.md
 */
'use strict';
import { createPublicHttpError, safeConfigurationFailure, safeSourceFailureCode } from './http-error-boundary';
import { isRecord as plain, record, own, cloneJson as clone, text, nvpConfig, stateObject, validationResult } from './config-boundary-contracts';
import type { BoundaryAdapter, HttpApp, HttpHandler, HttpRequest, HttpResponse, Issue, JsonRecord, SaveHooks, Validation } from './config-boundary-contracts';

declare const require: (id: '../ems/services/nvp-topology') => { validateTopology(raw: unknown, options?: { resolveSourceId(id: string): string | null; supportedProfileIds: string[] }): unknown };
declare const module: { exports: unknown };
const { validateTopology } = require('../ems/services/nvp-topology');
type StorageDevice = { id: string; name: string; powerStateIds: string[]; powerStateId: string; source: string; index?: number; enabled?: boolean };
type PvDevice = { id: string; name: string; source: string; index?: number };
type DeviceInventory = { storages: StorageDevice[]; pv: PvDevice[] };
type ValidationJob = { signature: string; promise: Promise<Validation> };
type ValidationCache = { signature: string; validation: Validation; ts: number };

const ACTIVE_BLOCK: Readonly<Issue> = Object.freeze({
  path: 'operation', code: 'RUNTIME_SCOPED_DISPATCH_NOT_IMPLEMENTED',
  message: 'Aktiver dynamischer Betrieb ist noch nicht verfügbar: getrennte Geräteschreibpfade, bestätigte Geräteprofile und Ausfallreaktionen fehlen. Die Diagnose verändert keine bestehenden Sollwerte.',
});
/** Die fehlende neue Konfiguration bedeutet unverändert statischen Betrieb. */
function currentNvpConfig(adapter: BoundaryAdapter): unknown {
  const raw = record(adapter.config).nvpTopology;
  return raw === undefined ? validationResult(validateTopology(undefined)).config : clone(raw);
}

/** Bindet Auswahlkennungen an tatsächliche Bestandszeilen; Messquellen verhindern eine stille Index-Neuzuordnung. */
function nvpDeviceInventory(config: JsonRecord = {}): DeviceInventory {
  const storages: StorageDevice[] = [];
  const single = record(config.storage);
  const dp = record(single.datapoints);
  const singleSources = [dp.batteryPowerObjectId, dp.feneconEssActualPowerObjectId].map(text).filter(Boolean);
  if (singleSources.length || [dp.targetPowerObjectId, dp.targetChargePowerObjectId, dp.targetDischargePowerObjectId].some(text)) {
    storages.push({ id: 'storage-single', name: text(single.name) || 'Einzelspeicher', powerStateIds: singleSources, powerStateId: singleSources[0] || '', source: 'storage' });
  }
  const configuredRows = record(config.storageFarm).storages;
  const rows: unknown[] = Array.isArray(configuredRows) ? configuredRows : [];
  rows.slice(0, 100).forEach((row: unknown, index: number) => {
    if (!plain(row)) return;
    const nested = plain(row.datapoints) ? row.datapoints : {};
    const sources = [row.signedPowerId, row.batteryPowerObjectId, row.feneconEssActualPowerId, row.feneconEssActualPowerObjectId,
      nested.signedPowerId, nested.batteryPowerObjectId, nested.feneconEssActualPowerId, nested.feneconEssActualPowerObjectId].map(text).filter(Boolean);
    storages.push({ id: `storage-farm-${index}`, name: text(row.name) || `Speicher ${index + 1}`, powerStateIds: [...new Set(sources)], powerStateId: sources[0] || '', source: 'storageFarm', index, enabled: row.enabled !== false });
  });
  const pv: PvDevice[] = [];
  const grid = record(config.gridConstraints);
  for (const [key, prefix] of [['pvCurtailInvertersEvu', 'pv-evu'], ['pvCurtailInvertersZero', 'pv-zero']] as const) {
    const configuredList = grid[key];
    const list: unknown[] = Array.isArray(configuredList) ? configuredList : [];
    list.slice(0, 100).forEach((row: unknown, index: number) => {
      if (!plain(row)) return;
      pv.push({ id: `${prefix}-${index}`, name: text(row.name) || `${prefix === 'pv-evu' ? 'EVU' : 'Nulleinspeisung'} Wechselrichter ${index + 1}`, source: key, index });
    });
  }
  if ([grid.pvLimitWId, grid.pvLimitPctId, grid.pvFeedInLimitWId].some(text)) pv.push({ id: 'pv-single', name: 'Einzelner PV-Wechselrichter', source: 'gridConstraints' });
  return { storages, pv };
}

/**
 * Löst nur Leseseiten von Aliasobjekten auf, höchstens acht Ebenen und mit Zyklenerkennung.
 * Die vom Browser eingetragene physicalSourceId ersetzt diese serverseitige Prüfung nicht.
 * Fehlende Objekte oder nicht lesbare Quellen werden nicht als nachgewiesene Identität behandelt.
 */
async function resolveNvpSource(adapter: BoundaryAdapter, stateId: string): Promise<string> {
  const seen = new Set<string>();
  let id = stateId;
  for (let depth = 0; depth < 8; depth += 1) {
    if (!id || id.length > 512 || seen.has(id)) throw new Error('ALIAS_CYCLE_OR_DEPTH');
    seen.add(id);
    const object = stateObject(await adapter.getForeignObjectAsync(id));
    if (!object || object.type !== 'state' || object.common?.read === false) throw new Error('MEASUREMENT_SOURCE_UNAVAILABLE');
    const alias = record(object.common?.alias).id;
    if (!alias) return id;
    const next = typeof alias === 'string' ? alias : (plain(alias) ? alias.read : null);
    if (typeof next !== 'string' || !next.trim()) throw new Error('ALIAS_READ_SOURCE_INVALID');
    id = next.trim();
  }
  throw new Error('ALIAS_CYCLE_OR_DEPTH');
}

/**
 * Prüft Schema und komplette Gerätebindung ohne Mutation. Alle Messquellen werden aus
 * ioBroker gelesen; ungültige Quellen werden weder null noch einer erfundenen Leistung gleichgesetzt.
 */
async function validateNvpCandidateUncached(adapter: BoundaryAdapter, raw: unknown, runtimeConfig: JsonRecord): Promise<Validation> {
  let validation = validationResult(validateTopology(raw));
  const errors: Issue[] = Array.isArray(validation.errors) ? validation.errors.slice() : [];
  if (!validation.valid) return { ...validation, errors, activeEligible: false };
  const config = nvpConfig(validation.config);
  if (config.mode !== 'dynamic') return validation;
  const devices = nvpDeviceInventory(runtimeConfig);
  const sources = new Map<string, string | null>();
  const wanted = new Set<string>();
  for (const point of config.points) wanted.add(point.measurement.stateId);
  for (const storage of config.storages) {
    wanted.add(storage.powerMeasurement.stateId);
    const actual = devices.storages.find((device) => device.id === storage.id);
    if (!actual) errors.push({ path: `storages.${storage.id}`, code: 'UNKNOWN_STORAGE_BINDING', message: 'Der Speicher ist im vorhandenen Adapter nicht konfiguriert.' });
    else for (const id of actual.powerStateIds) wanted.add(id);
  }
  if (wanted.size > 256) errors.push({ path: 'measurements', code: 'TOO_MANY_SOURCES', message: 'Zu viele unterschiedliche Messquellen.' });
  else {
    // Maximal vier gleichzeitige Objektabfragen; ein blockierter ioBroker-Aufruf
    // lässt keine unbegrenzte Zahl weiterer Requests entstehen.
    const queue = [...wanted];
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
      while (queue.length) {
        const id = queue.shift();
        if (id === undefined) break;
        try { sources.set(id, await resolveNvpSource(adapter, id)); }
        catch (error: unknown) {
          sources.set(id, null);
          errors.push({ path: 'measurement', code: safeSourceFailureCode(error), message: `Messquelle ${id} ist nicht eindeutig lesbar.` });
        }
      }
    }));
  }
  validation = validationResult(validateTopology(raw, { resolveSourceId: (id: string) => sources.get(id) || null, supportedProfileIds: [] }));
  for (const error of validation.errors || []) if (!errors.some((entry) => entry.code === error.code && entry.path === error.path)) errors.push(error);
  for (const storage of config.storages) {
    const actual = devices.storages.find((device) => device.id === storage.id);
    if (!actual) continue;
    const source = sources.get(storage.powerMeasurement.stateId);
    if (!source || !actual.powerStateIds.some((id: string) => sources.get(id) === source)) {
      errors.push({ path: `storages.${storage.id}.powerMeasurement`, code: 'STORAGE_MEASUREMENT_BINDING_MISMATCH', message: 'Die AC-Speicher-Istleistung muss zur ausgewählten bestehenden Speicherzuordnung gehören.' });
    }
  }
  for (const pv of config.pvAssignments) if (!devices.pv.some((device) => device.id === pv.id)) {
    errors.push({ path: `pvAssignments.${pv.id}`, code: 'UNKNOWN_PV_BINDING', message: 'Der PV-Wechselrichter ist im vorhandenen Adapter nicht konfiguriert.' });
  }
  if (config.operation === 'active') errors.push({ ...ACTIVE_BLOCK });
  return { ...validation, errors, valid: errors.length === 0, activeEligible: false };
}

const validationJobs = new WeakMap<object, ValidationJob>();
const validationCache = new WeakMap<object, ValidationCache>();
/**
 * Begrenzt Diagnose- und API-Objektabfragen gemeinsam auf einen Auftrag pro Adapter.
 * ioBroker bietet für Objektabfragen keinen Abort-Vertrag: nach 3 s endet daher die
 * Antwort, der belegte Slot bleibt bis zum echten Abschluss gesperrt. Dadurch können
 * wiederholte Browseraufrufe keine unbegrenzten hängenden Aufträge aufbauen.
 * Identische erfolgreiche Prüfungen werden für 5 s genutzt; keine Leistungswerte werden gecacht.
 */
async function validateNvpCandidate(adapter: BoundaryAdapter, raw: unknown, runtimeConfig: JsonRecord = record(adapter.config)): Promise<Validation> {
  const signature = JSON.stringify([raw, nvpDeviceInventory(runtimeConfig)]);
  const cached = validationCache.get(adapter);
  if (cached?.signature === signature && Date.now() - cached.ts < 5000) return validationResult(clone(cached.validation));
  let job = validationJobs.get(adapter);
  if (job && job.signature !== signature) throw nvpError(409, 'NVP_VALIDATION_IN_PROGRESS', 'Eine NVP-Quellenprüfung läuft bereits.');
  if (!job) {
    job = { signature, promise: validateNvpCandidateUncached(adapter, raw, runtimeConfig) };
    validationJobs.set(adapter, job);
    const owner = job;
    job.promise.then((validation: Validation) => {
      validationCache.set(adapter, { signature, validation, ts: Date.now() });
    }, () => {}).finally(() => { if (validationJobs.get(adapter) === owner) validationJobs.delete(adapter); });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([job.promise, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(nvpError(503, 'NVP_VALIDATION_TIMEOUT', 'NVP-Objektprüfung hat das Zeitlimit überschritten.')), 3000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

/** Strukturfehler erhalten HTTP-Status und geprüfte Fehlercodes ohne interne Stacktraces. */
function nvpError(status: number, code: string, message: string, details: Issue[] = []): ReturnType<typeof createPublicHttpError> {
  return createPublicHttpError(status, code, message, details || []);
}

/** Noch wirksame Freigaben oder laufende Writer dürfen durch Konfigurationswechsel nicht verschwinden. */
function assertNvpTransitionIdle(adapter: BoundaryAdapter): void {
  const status = record(adapter._nwNvpTopologyStatus);
  if (status.locked === true || Number(status.outstandingGrants || 0) > 0 || Number(status.pendingWrites || 0) > 0) {
    throw nvpError(409, 'NVP_TRANSITION_NOT_IDLE', 'NVP-Konfiguration gesperrt: noch wirksame Freigaben oder Schreibvorgänge müssen zuerst kontrolliert abgelöst werden.');
  }
}

/**
 * Prüft die vollständige Kandidatentopologie und erhöht die Versionsnummer genau einmal.
 * Der Aufrufer muss die gemeinsame Installer-Speichersperre halten. Kein Teilobjekt-Merge:
 * CAS schützt zwei gleichzeitig geöffnete Installerfenster gegen verlorene Änderungen.
 */
async function prepareNvpChange(adapter: BoundaryAdapter, raw: unknown, expectedVersion: unknown, runtimeConfig: JsonRecord = record(adapter.config)): Promise<JsonRecord> {
  const current = record(currentNvpConfig(adapter));
  const version = typeof current.configVersion === 'number' && Number.isSafeInteger(current.configVersion) && current.configVersion > 0 ? current.configVersion : 1;
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== version) throw nvpError(409, 'NVP_CONFIG_VERSION_CONFLICT', 'NVP-Konfiguration wurde geändert. Aktuellen Stand neu laden.');
  assertNvpTransitionIdle(adapter);
  const validation = await validateNvpCandidate(adapter, raw, runtimeConfig);
  if (!validation.valid) throw nvpError(422, 'NVP_CONFIG_INVALID', 'NVP-Konfiguration ist nicht gültig.', validation.errors);
  if (version >= Number.MAX_SAFE_INTEGER) throw nvpError(409, 'NVP_CONFIG_VERSION_EXHAUSTED', 'NVP-Konfigurationsversion kann nicht weiter erhöht werden.');
  return { ...nvpConfig(validation.config), configVersion: version + 1 };
}

/**
 * Zentraler Schutz auch für Import, Simulation und interne Persistenzpfade. Ein direkter
 * State-/native-Eingriff ersetzt keine Aktivierung; der Runtime-Pfad prüft unabhängig erneut.
 * Unveränderte Diagnosekonfiguration erzeugt keine zusätzlichen Datenbank-Lesezugriffe.
 */
async function assertNvpPersistence(adapter: BoundaryAdapter, nextRuntime: JsonRecord): Promise<void> {
  const currentRaw = record(adapter.config).nvpTopology;
  const nextRaw = nextRuntime?.nvpTopology;
  const sameTopology = JSON.stringify(currentRaw) === JSON.stringify(nextRaw);
  if (sameTopology && (record(nextRaw).mode !== 'dynamic' || JSON.stringify(nvpDeviceInventory(record(adapter.config))) === JSON.stringify(nvpDeviceInventory(nextRuntime)))) return;
  if (nextRaw === undefined && currentRaw !== undefined) throw nvpError(409, 'NVP_EXPLICIT_TRANSITION_REQUIRED', 'NVP-Konfiguration darf beim Import nicht still entfernt werden. Statischen Modus ausdrücklich speichern.');
  assertNvpTransitionIdle(adapter);
  const validation = await validateNvpCandidate(adapter, nextRaw, nextRuntime);
  if (!validation.valid) throw nvpError(422, 'NVP_CONFIG_INVALID', 'NVP-Konfiguration ist nicht gültig.', validation.errors);
  const current = record(currentNvpConfig(adapter));
  const currentVersion = typeof current.configVersion === 'number' && Number.isSafeInteger(current.configVersion) && current.configVersion > 0 ? current.configVersion : 1;
  if (!sameTopology && record(nextRaw).configVersion !== currentVersion + 1) throw nvpError(409, 'NVP_EXPLICIT_TRANSITION_REQUIRED', 'NVP-Änderungen benötigen die atomare NVP-Konfigurationsschnittstelle mit aktueller Versionsnummer.');
}

/**
 * Bindet veröffentlichte Diagnose an die aktuell gespeicherte Version. Während
 * der erste Messzyklus einer neuen Zuordnung fehlt, werden weder alte Messungen
 * noch alte Budgets übernommen. null ist ausdrücklich kein neuer Messzeitpunkt.
 */
function nvpCurrentStatus(adapter: BoundaryAdapter, rawConfig: unknown = currentNvpConfig(adapter)): JsonRecord {
  const config = record(rawConfig);
  const status = record(adapter._nwNvpTopologyStatus);
  if (status && Number.isSafeInteger(config?.configVersion)
    && status.configVersion === config.configVersion && status.mode === config.mode
    && status.operation === config.operation) return status;
  return {
    schemaVersion: 1, configVersion: Number.isSafeInteger(config?.configVersion) ? config.configVersion : null,
    mode: config?.mode || 'invalid', operation: config?.operation || 'diagnostic',
    status: 'pending', reason: 'Für diese Konfigurationsversion liegt noch keine Diagnose vor. Der nächste Messzyklus muss die neue Zuordnung prüfen.',
    timestamp: null, measurements: null, groups: [], participants: [], budget: null,
    activationSupported: false, writesPerformed: 0,
  };
}

/** Liefert ausschließlich Installer-Diagnose; ein alter Status wird nicht frisch datiert. */
function nvpPublicSnapshot(adapter: BoundaryAdapter): JsonRecord {
  const config = currentNvpConfig(adapter);
  return {
    ok: true, config, status: nvpCurrentStatus(adapter, config),
    devices: nvpDeviceInventory(record(adapter.config)),
    locked: !!(adapter._nwMeshAppSaveInProgress || record(adapter._nwNvpTopologyStatus).locked),
    activationSupported: false, activationBlockedReasons: [{ ...ACTIVE_BLOCK }],
  };
}

/** Alle Endpunkte verwenden dieselbe serverseitige Installer-/Adminprüfung wie das AppCenter. */
function registerNvpConfigApi(app: HttpApp, adapter: BoundaryAdapter, requireInstaller: HttpHandler, hooks: SaveHooks<JsonRecord>): void {
  const noStore = (res: HttpResponse) => res.setHeader('Cache-Control', 'no-store');
  const failure = (res: HttpResponse, error: unknown) => { const result = safeConfigurationFailure(error); return res.status(result.status).json(result.body); };
  app.get('/api/nvp/topology', requireInstaller, (_req: HttpRequest, res: HttpResponse) => { noStore(res); return res.json(nvpPublicSnapshot(adapter)); });
  app.get('/api/nvp/status', requireInstaller, (_req: HttpRequest, res: HttpResponse) => { noStore(res); return res.json({ ok: true, status: nvpCurrentStatus(adapter) }); });
  app.post('/api/nvp/topology/diagnose', requireInstaller, async (req: HttpRequest, res: HttpResponse) => {
    noStore(res);
    try {
      if (!plain(req.body) || !own(req.body, 'config')) throw nvpError(400, 'NVP_CONFIG_REQUIRED', 'Eine vollständige NVP-Konfiguration ist erforderlich.');
      const validation = await validateNvpCandidate(adapter, req.body.config);
      const previewAvailable = validation.valid && typeof adapter._nwPreviewNvpTopology === 'function';
      const status = previewAvailable && adapter._nwPreviewNvpTopology ? await adapter._nwPreviewNvpTopology(validation.config) : null;
      return res.json({ ok: true, preview: true, validation, status, previewAvailable });
    } catch (error) { return failure(res, error); }
  });
  app.post('/api/nvp/topology/config', requireInstaller, async (req: HttpRequest, res: HttpResponse) => {
    noStore(res);
    const token = hooks.beginSave();
    if (!token) return res.status(409).json({ ok: false, error: 'CONFIG_SAVE_IN_PROGRESS', message: 'Konfiguration wird bereits gespeichert.' });
    try {
      if (!plain(req.body) || !own(req.body, 'config')) throw nvpError(400, 'NVP_CONFIG_REQUIRED', 'Eine vollständige NVP-Konfiguration ist erforderlich.');
      const config = await prepareNvpChange(adapter, req.body.config, req.body.expectedConfigVersion);
      await hooks.commit(config);
      return res.json(nvpPublicSnapshot(adapter));
    } catch (error) { return failure(res, error); }
    finally { hooks.endSave(token); }
  });
}

module.exports = { ACTIVE_BLOCK, currentNvpConfig, nvpDeviceInventory, resolveNvpSource, validateNvpCandidate,
  prepareNvpChange, assertNvpPersistence, assertNvpTransitionIdle, nvpCurrentStatus, nvpPublicSnapshot, registerNvpConfigApi };
