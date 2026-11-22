/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Speichert die eigenständige App Dynamischer Netzanschluss atomar und
 * prüft ihre freien Mess-/Befehlszuordnungen an der Installer-Vertrauensgrenze.
 * Typgrenze: Unbekannte Eingaben und Fremdobjekte werden nativ eingegrenzt; Ausgaben alter Validatoren erhalten eine zusätzliche Vertragsprüfung.
 * Bei Änderungen: Aliasrechte, CAS, Allgemein-Abhängigkeiten, Entwürfe und aktive Übergaben an sämtlichen Speicherwegen gemeinsam prüfen.
 * Daten und Wirkung: Allgemein liefert M0; ioBroker-Objekte liefern Rechte, Typen,
 * Einheiten und getrennte Lese-/Schreib-Aliasketten. Keine Leistung wird erfunden.
 * Sicherheitsgrenze: Unvollständige Entwürfe bleiben deaktiviert. Aktivierung und
 * Übergaben verwenden denselben CAS-/Mutationsschutz wie alle Installer-Writer.
 * Verknüpfungen: docs/dev/DYNAMIC_GRID_CONTRACT.md
 */
'use strict';
import { createPublicHttpError, safeConfigurationFailure, safeSourceFailureCode } from './http-error-boundary';
import { isRecord as plain, record, recordArray, own, cloneJson as clone, text, dynamicConfig, stateObject, validationResult, issueResult } from './config-boundary-contracts';
import type { AppState, BoundaryAdapter, DynamicAdapter, DynamicConfig, HttpApp, HttpHandler, HttpRequest, HttpResponse, Issue, JsonRecord, SaveHooks, StateObject, Validation } from './config-boundary-contracts';

type Dict = JsonRecord;
type ResolvedObject = { id: string; chain: string[]; object: StateObject; terminalObject: StateObject };
type MappingContract = { id: string; direction: 'read' | 'write'; type: string; unit?: string; path: string };
type GeneralInputs = { gridPointPower: string; gridBuyPower: string; gridSellPower: string; invert: boolean };
type PreparedChange = { config: DynamicConfig; app: AppState; root: Dict; validation: Validation };
type ValidationJob = { signature: string; promise: Promise<Validation> };
type ValidationCache = { signature: string; validation: Validation; ts: number };
type ValidationOptions = { rootConfig: Dict; active: boolean; generalMeasurement?: unknown; resolveSourceId?(id: string): string | null; resolveWriteId?(id: string): string | null };
// Die alten CommonJS-Dienste erhalten eng begrenzte Aufrufverträge. Fachliche
// Validatorausgaben bleiben unbekannt und werden vor dem Zugriff nativ geprüft.
declare function require(id: '../ems/services/dynamic-grid-config'): {
  dynamicGridDefaults(): unknown;
  validateDynamicGridConfig(raw: unknown, options: ValidationOptions): unknown;
  resolveGeneralMeasurement(root: Dict, options: { unitByStateId: Record<string, string> }): unknown;
  dynamicGridReadIds(topology: unknown): string[];
  dynamicGridWriteIds(topology: unknown): string[];
};
declare function require(id: '../ems/services/dynamic-grid-ownership'): { getDynamicGridOwnedTargets(adapter: BoundaryAdapter): Set<string> };
declare function require(id: '../ems/services/dynamic-grid-pv'): {
  extractRequiredLegacyDynamicPvIds(root: Dict): string[];
  validateLegacyDynamicPvCoverage(root: Dict, pvAssignments: unknown, options: { resolveWriteId(id: string): string | null }): unknown;
};
declare const module: { exports: unknown };
const { dynamicGridDefaults, validateDynamicGridConfig, resolveGeneralMeasurement, dynamicGridReadIds, dynamicGridWriteIds } = require('../ems/services/dynamic-grid-config');
const { getDynamicGridOwnedTargets } = require('../ems/services/dynamic-grid-ownership');
const { extractRequiredLegacyDynamicPvIds, validateLegacyDynamicPvCoverage } = require('../ems/services/dynamic-grid-pv');
const readKeys = Object.freeze(['powerMeasurement', 'socMeasurement', 'availability', 'requestPowerMeasurement']);
const commandKeys = Object.freeze(['signedTarget', 'chargeTarget', 'dischargeTarget', 'maxCharge', 'maxDischarge', 'run', 'chargeEnable', 'dischargeEnable', 'watchdog']);

function dynamicGridError(status: number, code: string, message: string, details: Issue[] = []): ReturnType<typeof createPublicHttpError> {
  return createPublicHttpError(status, code, message, details);
}
function dynamicGridAppState(root: Dict = {}): AppState {
  const raw = record(record(record(root.emsApps).apps).dynamicGrid);
  const installed = raw?.installed === true;
  const enabled = installed && raw?.enabled === true;
  return { installed, enabled, active: installed && enabled };
}
function currentDynamicGridConfig(adapter: BoundaryAdapter): unknown {
  const raw = record(adapter.config).dynamicGridConnection;
  const config = raw === undefined ? dynamicGridDefaults() : clone(raw);
  // Die lesende API liefert denselben CAS-Ausgangswert wie prepareDynamicGridChange.
  // Alte Entwürfe ohne Versionsfeld werden damit speicherbar, ohne beim GET die
  // Runtime oder Persistenz zu migrieren. Ungültige Fachfelder bleiben unverändert.
  if (plain(config) && (typeof config.configVersion !== 'number' || !Number.isSafeInteger(config.configVersion) || config.configVersion < 1)) config.configVersion = 1;
  return config;
}
/** Nur Allgemein bestimmt die M0-Messidentität; Topologieversion umfasst Änderungen daran. */
function generalInputs(root: Dict): GeneralInputs {
  const dp = record(root.datapoints);
  return { gridPointPower: text(dp.gridPointPower), gridBuyPower: text(dp.gridBuyPower), gridSellPower: text(dp.gridSellPower),
    invert: record(root.settings).flowInvertGrid === true || root.flowInvertGrid === true };
}
function dynamicGridSignature(root: Dict): string {
  const cfg = clone(root.dynamicGridConnection === undefined ? dynamicGridDefaults() : root.dynamicGridConnection);
  if (plain(cfg)) delete cfg.configVersion;
  const evu = recordArray(record(root.dynamicGridConnection).pvAssignments).some((row) => row.evuControl === true) ? Object.fromEntries(
    ['pvEvuEnabled', 'pvEvuRelay60Id', 'pvEvuRelay30Id', 'pvEvuRelay0Id', 'staleTimeoutSec'].map((key) => [key, record(root.gridConstraints)[key] ?? null])) : null;
  return JSON.stringify([cfg, dynamicGridAppState(root), generalInputs(root), evu]);
}

/** Lese- und Schreibseite eines Alias können unterschiedliche physische Quellen besitzen. */
async function resolveDynamicGridObject(adapter: BoundaryAdapter, stateId: string, direction: 'read' | 'write'): Promise<ResolvedObject> {
  const chain: string[] = []; const seen = new Set<string>(); let id = stateId; let first: StateObject | null = null;
  for (let depth = 0; depth < 8; depth += 1) {
    if (!id || id.length > 512 || /[\x00-\x1f\x7f]/.test(id) || seen.has(id)) throw new Error('ALIAS_CYCLE_OR_DEPTH');
    seen.add(id); chain.push(id);
    const object = stateObject(await adapter.getForeignObjectAsync(id));
    if (!object || object.type !== 'state') throw new Error('STATE_OBJECT_MISSING');
    if (direction === 'write' ? object.common?.write !== true : object.common?.read === false) throw new Error(direction === 'write' ? 'STATE_NOT_WRITABLE' : 'STATE_NOT_READABLE');
    first = first || object;
    const alias = record(object.common?.alias).id;
    if (!alias) return { id, chain, object: first, terminalObject: object };
    const next = typeof alias === 'string' ? alias : (plain(alias) ? alias[direction] : null);
    if (typeof next !== 'string' || !next.trim()) throw new Error(direction === 'write' ? 'ALIAS_WRITE_SOURCE_INVALID' : 'ALIAS_READ_SOURCE_INVALID');
    id = next.trim();
  }
  throw new Error('ALIAS_CYCLE_OR_DEPTH');
}

/** Bekannte konkurrierende Aliasse werden ebenfalls aufgelöst, damit die zentrale
 * Stellhoheit denselben physikalischen Ausgang auch über alte Zuordnungen erkennt. */
function existingMappedIds(root: Dict): string[] {
  const ids = new Set<string>(); let visited = 0;
  const walk = (value: unknown, depth: number): void => {
    if (!value || typeof value !== 'object' || depth > 10 || visited++ > 4000) return;
    for (const [key, child] of Object.entries(value)) {
      if (typeof child === 'string' && /(?:ObjectId|WriteId|writeId|set\w*Id|target\w*Id|max\w*Id|output\w*Id|dpId)$/i.test(key) && child.trim()) ids.add(child.trim());
      else if (child && typeof child === 'object') walk(child, depth + 1);
      if (ids.size >= 256) return;
    }
  };
  for (const key of ['storage', 'storageFarm', 'gridConstraints', 'peakShaving', 'logicEditor', 'smartHomeConfig', 'threshold', 'relay']) walk(root[key], 0);
  return [...ids].slice(0, 256);
}
function mappingContracts(config: DynamicConfig): MappingContract[] {
  const rows: MappingContract[] = [];
  const add = (rawMapping: unknown, direction: 'read' | 'write', path: string, type = 'number'): void => {
    const mapping = record(rawMapping);
    if (!text(mapping.stateId)) return;
    rows.push({ id: text(mapping.stateId), direction, type, ...(typeof mapping.unit === 'string' && mapping.unit ? { unit: mapping.unit } : {}), path });
    if (direction === 'write' && text(mapping.readbackStateId)) rows.push({ id: text(mapping.readbackStateId), direction: 'read', type, path: `${path}.readbackStateId` });
  };
  for (const point of config.points || []) if (point.id !== 'M0') add(point.measurement, 'read', `points.${point.id}.measurement`);
  for (const storage of config.storages || []) {
    for (const key of readKeys) add(storage[key], 'read', `storages.${storage.id}.${key}`, key === 'availability' ? typeof record(storage[key]).availableValue : 'number');
    for (const key of commandKeys) {
      const entry = record(record(storage.command)[key]);
      const type = ['run', 'chargeEnable', 'dischargeEnable'].includes(key) ? typeof entry?.onValue : (key === 'watchdog' ? typeof entry?.writeValue : 'number');
      add(entry, 'write', `storages.${storage.id}.command.${key}`, type);
    }
    for (const key of ['appliedMaxCharge', 'appliedMaxDischarge']) add(record(storage.command)[key], 'read', `storages.${storage.id}.command.${key}`);
  }
  for (const pv of config.pvAssignments || []) {
    add(pv.powerMeasurement, 'read', `pvAssignments.${pv.id}.powerMeasurement`);
    add(pv.command, 'write', `pvAssignments.${pv.id}.command`);
  }
  return rows;
}

async function validateDynamicGridCandidateUncached(adapter: BoundaryAdapter, raw: unknown, root: Dict, active: boolean): Promise<Validation> {
  const first = validationResult(validateDynamicGridConfig(raw, { rootConfig: root, active: false }));
  if (!first.valid) return first;
  const config = dynamicConfig(first.config);
  const activationErrors: Issue[] = [];
  const reads = new Map<string, ResolvedObject>(); const writes = new Map<string, ResolvedObject>();
  const contracts = mappingContracts(config);
  if (record(root.gridConstraints).pvEvuEnabled === true && config.pvAssignments.some((row: Dict) => row.evuControl === true)) {
    const relayIds = [60, 30, 0].map((stage) => text(record(root.gridConstraints)[`pvEvuRelay${stage}Id`])).filter(Boolean);
    if (!relayIds.length) activationErrors.push({ path: 'pvAssignments.evuControl', code: 'EVU_MAPPING_REQUIRED', message: 'Die zugeordnete EVU-Steuerung benötigt mindestens einen gültigen Stufeneingang.' });
    for (const id of relayIds) contracts.push({ id, direction: 'read', type: 'boolean|number', path: 'pvAssignments.evuControl' });
  }
  const general = generalInputs(root);
  const generalIds = (general.gridPointPower ? [general.gridPointPower] : [general.gridBuyPower, general.gridSellPower]).filter(Boolean);
  const wanted = new Map<string, { id: string; direction: 'read' | 'write'; required: boolean }>();
  const add = (value: unknown, direction: 'read' | 'write', required = true): void => {
    const id = text(value); if (!id) return;
    const key = `${direction}:${id}`;
    if (!wanted.has(key) || required) wanted.set(key, { id, direction, required });
  };
  for (const item of contracts) add(item.id, item.direction);
  for (const id of generalIds) add(id, 'read');
  for (const id of dynamicGridReadIds(first.topology || {})) add(id, 'read');
  for (const id of dynamicGridWriteIds(first.topology || {})) add(id, 'write');
  for (const id of existingMappedIds(root)) add(id, 'write', false);
  for (const id of extractRequiredLegacyDynamicPvIds(root)) add(id, 'write');
  if (wanted.size > 512) throw dynamicGridError(422, 'DYNAMIC_GRID_TOO_MANY_MAPPINGS', 'Zu viele unterschiedliche Datenpunktzuordnungen.');
  const queue = [...wanted.values()];
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (item === undefined) break;
      try {
        const resolved = await resolveDynamicGridObject(adapter, item.id, item.direction);
        (item.direction === 'read' ? reads : writes).set(item.id, resolved);
      } catch (error: unknown) {
        if (item.required) activationErrors.push({ path: generalIds.includes(item.id) ? 'points.M0.measurement' : item.id, code: safeSourceFailureCode(error), message: `Datenpunkt ist nicht eindeutig ${item.direction === 'read' ? 'lesbar' : 'beschreibbar'}.` });
      }
    }
  }));
  const unitByStateId: Record<string, string> = Object.create(null);
  for (const [id, resolved] of reads) unitByStateId[id] = text(resolved.object.common?.unit || resolved.terminalObject.common?.unit);
  const generalMeasurement = resolveGeneralMeasurement(root, { unitByStateId });
  const final = validationResult(validateDynamicGridConfig(raw, { rootConfig: root, active, generalMeasurement,
    resolveSourceId: (id: string) => reads.get(id)?.id || null,
    resolveWriteId: (id: string) => writes.get(id)?.id || null }));
  for (const item of contracts) {
    const resolved = (item.direction === 'read' ? reads : writes).get(item.id);
    if (!resolved) continue;
    const objectType = resolved.object.common?.type;
    if (item.type === 'boolean|number' ? objectType !== 'number' && objectType !== 'boolean' : (!['number', 'boolean'].includes(item.type) || objectType !== item.type)) activationErrors.push({ path: item.path, code: 'DATAPOINT_TYPE_MISMATCH', message: `Der Datenpunkt muss den Typ ${item.type === 'boolean' ? 'Boolean' : 'Zahl'} besitzen.` });
    const unit = unitByStateId[item.id];
    if (item.direction === 'read' && item.unit && unit && unit !== item.unit) activationErrors.push({ path: item.path, code: 'DATAPOINT_UNIT_MISMATCH', message: 'Die konfigurierte Leistungseinheit passt nicht zur Objekt-Einheit.' });
  }
  for (const id of generalIds) {
    if (reads.get(id)?.object.common?.type !== 'number') activationErrors.push({ path: 'points.M0', code: 'GENERAL_METER_TYPE_INVALID', message: 'Die Allgemein-Netzmessung muss numerische Zustände bereitstellen.' });
    if (reads.has(id) && unitByStateId[id] !== 'W' && unitByStateId[id] !== 'kW') activationErrors.push({ path: 'points.M0', code: 'GENERAL_METER_UNIT_INVALID', message: 'Die Allgemein-Netzmessung benötigt eine bestätigte Objekt-Einheit W oder kW.' });
  }
  activationErrors.push(...issueResult(validateLegacyDynamicPvCoverage(root, record(final.config).pvAssignments || config.pvAssignments, { resolveWriteId: (id: string) => writes.get(id)?.id || null })));
  if (typeof adapter._nwLicenseAllowsAppId === 'function' && !adapter._nwLicenseAllowsAppId('dynamicGrid')) activationErrors.push({ path: 'app', code: 'DYNAMIC_GRID_LICENSE_REQUIRED', message: 'Das vorhandene Home-/Pro-Netzlimitrecht ist nicht freigegeben.' });
  const maxStorages = typeof adapter._nwLicenseMaxStorages === 'function' ? adapter._nwLicenseMaxStorages() : 10;
  if (config.storages.length > maxStorages) activationErrors.push({ path: 'storages', code: 'STORAGE_COUNT_LICENSE_LIMIT', message: `Das vorhandene Lizenzprofil erlaubt ${maxStorages} Speicher.` });
  const dedupe = (issues: Issue[]): Issue[] => [...new Map(issues.map((entry) => [`${entry.path}:${entry.code}`, entry])).values()];
  const allActivationErrors = dedupe([...(final.activationErrors || []), ...(active ? final.errors || [] : []), ...activationErrors]);
  const errors = dedupe([...(final.errors || []), ...(active ? activationErrors : [])]);
  // Alte Übergabeziele bleiben erhalten; unbenutzte Entwurfs-Aliasse sammeln sich
  // nicht über beliebig viele Saves hinweg an. Der nächste Vertrag wird vor persist reservierbar.
  const protectedTargets: Set<string> = getDynamicGridOwnedTargets(adapter);
  const canonical: Dict = Object.create(null);
  for (const [id, chain] of Object.entries(adapter._nwDynamicGridCanonicalTargets || {})) if (protectedTargets.has(id)) canonical[id] = chain;
  for (const [id, resolved] of writes) canonical[id] = resolved.chain;
  adapter._nwDynamicGridCanonicalTargets = canonical;
  return { ...final, config: final.config, generalMeasurement, errors, activationErrors: allActivationErrors,
    valid: errors.length === 0, activeEligible: allActivationErrors.length === 0 };
}
const jobs = new WeakMap<object, ValidationJob>();
const cache = new WeakMap<object, ValidationCache>();
/** Eine begrenzte Objektprüfung je Adapter, vier DB-Leser, gemeinsame 3-s-Frist.
 * Hängt die DB, bleibt der Slot bis zum echten Abschluss belegt; keine Auftragsflut. */
async function validateDynamicGridCandidate(adapter: BoundaryAdapter, raw: unknown, root: Dict = record(adapter.config), active = dynamicGridAppState(root).active): Promise<Validation> {
  if (raw !== undefined && !plain(raw)) return { valid: false, config: null, topology: null, errors: [{ path: '', code: 'CONFIG_OBJECT_REQUIRED', message: 'Die App-Konfiguration muss ein Objekt sein.' }], activationErrors: [], activeEligible: false };
  const signature = JSON.stringify([raw, generalInputs(root), active, existingMappedIds(root), root.gridConstraints, adapter._nwLicenseMaxStorages?.()]);
  if (signature.length > 262144) throw dynamicGridError(413, 'DYNAMIC_GRID_CONFIG_TOO_LARGE', 'Die Konfiguration überschreitet die zulässige Größe.');
  const previous = cache.get(adapter);
  if (previous?.signature === signature && Date.now() - previous.ts < 5000) return validationResult(clone(previous.validation));
  let job = jobs.get(adapter);
  if (job && job.signature !== signature) throw dynamicGridError(409, 'DYNAMIC_GRID_VALIDATION_BUSY', 'Eine Datenpunktprüfung läuft bereits.');
  if (!job) {
    job = { signature, promise: validateDynamicGridCandidateUncached(adapter, raw, root, active) };
    jobs.set(adapter, job); const owner = job;
    job.promise.then((validation: Validation) => cache.set(adapter, { signature, validation, ts: Date.now() }), () => {}).finally(() => { if (jobs.get(adapter) === owner) jobs.delete(adapter); });
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([job.promise, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(dynamicGridError(503, 'DYNAMIC_GRID_VALIDATION_TIMEOUT', 'Datenpunktprüfung hat das Zeitlimit überschritten.')), 3000); })]);
  } finally { if (timer) clearTimeout(timer); }
}

function withDynamicApp(root: Dict, app: AppState): Dict {
  return { ...root, emsApps: { ...record(root.emsApps), apps: { ...record(record(root.emsApps).apps), dynamicGrid: { installed: app.installed, enabled: app.enabled } } }, enableDynamicGrid: app.active };
}
function validateApp(raw: unknown, current: AppState): AppState {
  if (raw === undefined) return current;
  if (!plain(raw) || typeof raw.installed !== 'boolean' || typeof raw.enabled !== 'boolean' || (raw.enabled && !raw.installed)) throw dynamicGridError(422, 'DYNAMIC_GRID_APP_STATE_INVALID', 'Aktivierung erfordert eine installierte App mit eindeutigen Boolean-Schaltern.');
  return { installed: raw.installed, enabled: raw.enabled, active: raw.installed && raw.enabled };
}
async function prepareDynamicGridChange(adapter: BoundaryAdapter, raw: unknown, expectedVersion: unknown, appRaw?: unknown, root: Dict = record(adapter.config)): Promise<PreparedChange> {
  const current = record(currentDynamicGridConfig(adapter));
  const version = typeof current.configVersion === 'number' && Number.isSafeInteger(current.configVersion) && current.configVersion > 0 ? current.configVersion : 1;
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== version) throw dynamicGridError(409, 'DYNAMIC_GRID_VERSION_CONFLICT', 'Die Konfiguration wurde geändert. Aktuellen Stand neu laden.');
  if (version >= Number.MAX_SAFE_INTEGER) throw dynamicGridError(409, 'DYNAMIC_GRID_VERSION_EXHAUSTED', 'Die Konfigurationsversion kann nicht weiter erhöht werden.');
  const app = validateApp(appRaw, dynamicGridAppState(root));
  const nextRoot = withDynamicApp({ ...root, dynamicGridConnection: raw }, app);
  const validation = await validateDynamicGridCandidate(adapter, raw, nextRoot, app.active);
  if (!validation.valid) throw dynamicGridError(422, 'DYNAMIC_GRID_CONFIG_INVALID', 'Die Konfiguration ist nicht gültig.', validation.errors);
  const config = { ...dynamicConfig(validation.config), configVersion: version + 1 };
  return { config, app, root: { ...nextRoot, dynamicGridConnection: config }, validation };
}
/** AppCenter/Import ersetzen den Vertrag vollständig. Auch reine App-Schalter
 * oder geänderte Allgemein-DPs benötigen bei vorhandenem Vertrag denselben CAS. */
async function prepareDynamicGridInstallerPatch(adapter: DynamicAdapter, patch: Dict, submitted: Dict, explicitVersion?: unknown): Promise<void> {
  const currentRoot = record(adapter.config);
  if (!own(submitted, 'dynamicGridConnection') && currentRoot.dynamicGridConnection !== undefined) patch.dynamicGridConnection = clone(currentRoot.dynamicGridConnection);
  // Alte Vollbackups dürfen vorhandene aktive App-Verträge nicht herabstufen.
  const submittedApps = record(record(submitted.emsApps).apps);
  const currentApp = record(record(currentRoot.emsApps).apps).dynamicGrid;
  if (!own(submittedApps, 'dynamicGrid') && currentApp) {
    const emsApps = plain(patch.emsApps) ? patch.emsApps : { schemaVersion: 1, apps: {} };
    const apps = record(emsApps.apps);
    apps.dynamicGrid = clone(currentApp);
    emsApps.apps = apps;
    patch.emsApps = emsApps;
    patch.enableDynamicGrid = dynamicGridAppState(currentRoot).active;
  }
  const merged = adapter.nwApplyInstallerPatchToRuntimeConfig(currentRoot, patch);
  if (!plain(merged)) throw new Error('INSTALLER_PATCH_CONTRACT_INVALID');
  const nextRoot = merged;
  if (dynamicGridSignature(nextRoot) === dynamicGridSignature(currentRoot)) return;
  const touchedApp = own(submittedApps, 'dynamicGrid');
  if (currentRoot.dynamicGridConnection === undefined && !own(submitted, 'dynamicGridConnection') && !touchedApp && !dynamicGridAppState(nextRoot).active) return;
  const raw = nextRoot.dynamicGridConnection === undefined ? dynamicGridDefaults() : nextRoot.dynamicGridConnection;
  const expected = explicitVersion === undefined ? record(submitted.dynamicGridConnection).configVersion : explicitVersion;
  const result = await prepareDynamicGridChange(adapter, raw, expected, dynamicGridAppState(nextRoot), nextRoot);
  patch.dynamicGridConnection = result.config;
}
/** Zentrale Persistenzgrenze schützt auch Simulation, interne Saves und native
 * Aktivierung. Versionssprünge können nicht über einen anderen Writer entfallen. */
async function assertDynamicGridPersistence(adapter: BoundaryAdapter, nextRoot: Dict): Promise<Dict | null> {
  const currentRoot = record(adapter.config);
  const changed = dynamicGridSignature(currentRoot) !== dynamicGridSignature(nextRoot);
  const active = dynamicGridAppState(nextRoot).active;
  const wasActive = dynamicGridAppState(currentRoot).active;
  if (currentRoot.dynamicGridConnection === undefined && nextRoot.dynamicGridConnection === undefined && !dynamicGridAppState(currentRoot).installed && !dynamicGridAppState(nextRoot).installed) return null;
  if (!changed && !active) return null;
  if (nextRoot.dynamicGridConnection === undefined && currentRoot.dynamicGridConnection !== undefined) throw dynamicGridError(409, 'DYNAMIC_GRID_EXPLICIT_TRANSITION_REQUIRED', 'Die App-Konfiguration darf beim Import nicht still entfernt werden.');
  if (changed) {
    const current = record(currentDynamicGridConfig(adapter));
    if (record(nextRoot.dynamicGridConnection).configVersion !== (Number(current?.configVersion) || 1) + 1) throw dynamicGridError(409, 'DYNAMIC_GRID_VERSION_CONFLICT', 'Änderungen benötigen die aktuelle App-Konfigurationsversion.');
  }
  const raw = nextRoot.dynamicGridConnection === undefined ? dynamicGridDefaults() : nextRoot.dynamicGridConnection;
  const validation = await validateDynamicGridCandidate(adapter, raw, nextRoot, active);
  if (!validation.valid) throw dynamicGridError(422, 'DYNAMIC_GRID_CONFIG_INVALID', 'Die Konfiguration ist nicht gültig.', validation.errors);
  if (changed && wasActive && typeof adapter._nwPrepareDynamicGridTransition !== 'function') throw dynamicGridError(409, 'DYNAMIC_GRID_HANDOVER_UNAVAILABLE', 'Die aktive App muss vor der Änderung eine kontrollierte Übergabe bestätigen.');
  if (changed && typeof adapter._nwPrepareDynamicGridTransition === 'function') {
    const transition = await adapter._nwPrepareDynamicGridTransition(nextRoot);
    if (!plain(transition) || transition.ok !== true) throw dynamicGridError(409, 'DYNAMIC_GRID_HANDOVER_PENDING', 'Die alte Stellhoheit wird noch kontrolliert übergeben.');
  }
  return { changed, validation, root: nextRoot };
}
function dynamicGridCurrentStatus(adapter: BoundaryAdapter): Dict {
  const config = record(currentDynamicGridConfig(adapter)); const app = dynamicGridAppState(record(adapter.config));
  const status = record(adapter._nwDynamicGridStatus);
  if (status && status.configVersion === config?.configVersion && status.active === true && app.active) {
    const ts = status.ts ?? status.timestamp;
    if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0 || ts > Date.now() || Date.now() - ts > 15000) return {
      schemaVersion: 1, configVersion: config.configVersion, active: true, status: 'stale', stale: true, ts: typeof ts === 'number' && Number.isFinite(ts) ? ts : null,
      reason: 'Seit mehr als 15 Sekunden liegt kein gültiger Laufzeitstatus vor.', snapshot: null, measurements: null, budget: null, pv: null, writesPerformed: null, applied: false,
    };
  }
  if (status && status.configVersion === config?.configVersion && status.active === app.active) {
    const pv = record(adapter._nwDynamicGridPvRuntime);
    const snapshot = pv && pv.configVersion === config.configVersion && app.active && typeof pv.ts === 'number' && pv.ts > 0 && pv.ts <= Date.now() && Date.now() - pv.ts <= 15000 ? Object.fromEntries(
      ['status', 'errors', 'requests', 'points', 'accepted', 'applied', 'results', 'pendingEffects', 'acceptedCaps', 'ts', 'configVersion', 'generation'].filter((key) => own(pv, key)).map((key) => [key, pv[key]])) : null;
    return { ...status, pv: snapshot };
  }
  return { schemaVersion: 1, configVersion: config?.configVersion ?? null, active: app.active, status: app.active ? 'pending' : 'inactive', timestamp: null,
    reason: app.active ? 'Der nächste Messzyklus prüft die neue Zuordnung.' : 'Die App ist nicht aktiviert.', measurements: null, budget: null, writesPerformed: 0 };
}
async function dynamicGridSnapshot(adapter: BoundaryAdapter, preparedValidation?: Validation): Promise<Dict> {
  const config = currentDynamicGridConfig(adapter), app = dynamicGridAppState(record(adapter.config));
  const validation = preparedValidation || await validateDynamicGridCandidate(adapter, config, record(adapter.config), false);
  const rootIssues = (validation.activationErrors || []).filter((item: Issue) => item.path.startsWith('points.M0') || item.path.includes('.generalMeasurement') || ['GENERAL_METER_TYPE_INVALID', 'GENERAL_METER_UNIT_INVALID'].includes(item.code));
  return { ok: true, config, app, status: dynamicGridCurrentStatus(adapter),
    rootSource: { measurement: validation.generalMeasurement || null, valid: rootIssues.length === 0, reason: rootIssues.map((item: Issue) => item.message).join(' ') },
    validation, locked: !!adapter._nwMeshAppSaveInProgress, maxStorages: adapter._nwLicenseMaxStorages?.() ?? 10 };
}
function registerDynamicGridApi(app: HttpApp, adapter: BoundaryAdapter, requireInstaller: HttpHandler, hooks: SaveHooks<PreparedChange>): void {
  const noStore = (res: HttpResponse): void => { res.setHeader('Cache-Control', 'no-store'); };
  const fail = (res: HttpResponse, error: unknown): unknown => { const failure = safeConfigurationFailure(error); return res.status(failure.status).json(failure.body); };
  app.get('/api/dynamic-grid', requireInstaller, async (_req: HttpRequest, res: HttpResponse) => { noStore(res); try { return res.json(await dynamicGridSnapshot(adapter)); } catch (error) { return fail(res, error); } });
  app.get('/api/dynamic-grid/status', requireInstaller, (_req: HttpRequest, res: HttpResponse) => { noStore(res); return res.json({ ok: true, status: dynamicGridCurrentStatus(adapter) }); });
  app.post('/api/dynamic-grid/preview', requireInstaller, async (req: HttpRequest, res: HttpResponse) => {
    noStore(res);
    try {
      if (!plain(req.body) || !own(req.body, 'config')) throw dynamicGridError(400, 'DYNAMIC_GRID_CONFIG_REQUIRED', 'Eine App-Konfiguration ist erforderlich.');
      const validation = await validateDynamicGridCandidate(adapter, req.body.config, record(adapter.config), true);
      const status = validation.valid && typeof adapter._nwPreviewDynamicGrid === 'function' ? await adapter._nwPreviewDynamicGrid(validation.config, record(adapter.config)) : null;
      return res.json({ ok: true, preview: true, validation, status, previewAvailable: status !== null });
    } catch (error) { return fail(res, error); }
  });
  app.post('/api/dynamic-grid/config', requireInstaller, async (req: HttpRequest, res: HttpResponse) => {
    noStore(res); const token = hooks.beginSave();
    if (!token) return fail(res, dynamicGridError(409, 'INSTALLER_CONFIG_BUSY', 'Eine Konfiguration wird bereits gespeichert.'));
    try {
      if (!plain(req.body) || !own(req.body, 'config')) throw dynamicGridError(400, 'DYNAMIC_GRID_CONFIG_REQUIRED', 'Eine vollständige App-Konfiguration ist erforderlich.');
      const prepared = await prepareDynamicGridChange(adapter, req.body.config, req.body.expectedConfigVersion, req.body.app);
      await hooks.commit(prepared);
      return res.json({ ...await dynamicGridSnapshot(adapter, { ...prepared.validation, config: prepared.config, topology: prepared.validation.topology ? { ...record(prepared.validation.topology), configVersion: prepared.config.configVersion } : null }), locked: false });
    } catch (error) { return fail(res, error); }
    finally { hooks.endSave(token); }
  });
}
module.exports = { dynamicGridAppState, currentDynamicGridConfig, generalInputs, dynamicGridSignature, resolveDynamicGridObject,
  validateDynamicGridCandidate, prepareDynamicGridChange, prepareDynamicGridInstallerPatch, assertDynamicGridPersistence,
  dynamicGridCurrentStatus, dynamicGridSnapshot, registerDynamicGridApi };
