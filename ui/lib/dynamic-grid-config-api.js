/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/dynamic-grid-config-api.ts
 * Quell-Hash: sha256:7161236b3cfd48a4cb98f4ee636001ec1802336105a1ec9454b9ef5fa8f79f7b
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/dynamic-grid-config-api.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
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
Object.defineProperty(exports, "__esModule", { value: true });
const http_error_boundary_1 = require("./http-error-boundary");
const config_boundary_contracts_1 = require("./config-boundary-contracts");
const { dynamicGridDefaults, validateDynamicGridConfig, resolveGeneralMeasurement, dynamicGridReadIds, dynamicGridWriteIds } = require('../ems/services/dynamic-grid-config');
const { getDynamicGridOwnedTargets } = require('../ems/services/dynamic-grid-ownership');
const { extractRequiredLegacyDynamicPvIds, validateLegacyDynamicPvCoverage } = require('../ems/services/dynamic-grid-pv');
const readKeys = Object.freeze(['powerMeasurement', 'socMeasurement', 'availability', 'requestPowerMeasurement']);
const commandKeys = Object.freeze(['signedTarget', 'chargeTarget', 'dischargeTarget', 'maxCharge', 'maxDischarge', 'run', 'chargeEnable', 'dischargeEnable', 'watchdog']);
function dynamicGridError(status, code, message, details = []) {
    return (0, http_error_boundary_1.createPublicHttpError)(status, code, message, details);
}
function dynamicGridAppState(root = {}) {
    const raw = (0, config_boundary_contracts_1.record)((0, config_boundary_contracts_1.record)((0, config_boundary_contracts_1.record)(root.emsApps).apps).dynamicGrid);
    const installed = raw?.installed === true;
    const enabled = installed && raw?.enabled === true;
    return { installed, enabled, active: installed && enabled };
}
function currentDynamicGridConfig(adapter) {
    const raw = (0, config_boundary_contracts_1.record)(adapter.config).dynamicGridConnection;
    const config = raw === undefined ? dynamicGridDefaults() : (0, config_boundary_contracts_1.cloneJson)(raw);
    // Die lesende API liefert denselben CAS-Ausgangswert wie prepareDynamicGridChange.
    // Alte Entwürfe ohne Versionsfeld werden damit speicherbar, ohne beim GET die
    // Runtime oder Persistenz zu migrieren. Ungültige Fachfelder bleiben unverändert.
    if ((0, config_boundary_contracts_1.isRecord)(config) && (typeof config.configVersion !== 'number' || !Number.isSafeInteger(config.configVersion) || config.configVersion < 1))
        config.configVersion = 1;
    return config;
}
/** Nur Allgemein bestimmt die M0-Messidentität; Topologieversion umfasst Änderungen daran. */
function generalInputs(root) {
    const dp = (0, config_boundary_contracts_1.record)(root.datapoints);
    return { gridPointPower: (0, config_boundary_contracts_1.text)(dp.gridPointPower), gridBuyPower: (0, config_boundary_contracts_1.text)(dp.gridBuyPower), gridSellPower: (0, config_boundary_contracts_1.text)(dp.gridSellPower),
        invert: (0, config_boundary_contracts_1.record)(root.settings).flowInvertGrid === true || root.flowInvertGrid === true };
}
function dynamicGridSignature(root) {
    const cfg = (0, config_boundary_contracts_1.cloneJson)(root.dynamicGridConnection === undefined ? dynamicGridDefaults() : root.dynamicGridConnection);
    if ((0, config_boundary_contracts_1.isRecord)(cfg))
        delete cfg.configVersion;
    const evu = (0, config_boundary_contracts_1.recordArray)((0, config_boundary_contracts_1.record)(root.dynamicGridConnection).pvAssignments).some((row) => row.evuControl === true) ? Object.fromEntries(['pvEvuEnabled', 'pvEvuRelay60Id', 'pvEvuRelay30Id', 'pvEvuRelay0Id', 'staleTimeoutSec'].map((key) => [key, (0, config_boundary_contracts_1.record)(root.gridConstraints)[key] ?? null])) : null;
    return JSON.stringify([cfg, dynamicGridAppState(root), generalInputs(root), evu]);
}
/** Lese- und Schreibseite eines Alias können unterschiedliche physische Quellen besitzen. */
async function resolveDynamicGridObject(adapter, stateId, direction) {
    const chain = [];
    const seen = new Set();
    let id = stateId;
    let first = null;
    for (let depth = 0; depth < 8; depth += 1) {
        if (!id || id.length > 512 || /[\x00-\x1f\x7f]/.test(id) || seen.has(id))
            throw new Error('ALIAS_CYCLE_OR_DEPTH');
        seen.add(id);
        chain.push(id);
        const object = (0, config_boundary_contracts_1.stateObject)(await adapter.getForeignObjectAsync(id));
        if (!object || object.type !== 'state')
            throw new Error('STATE_OBJECT_MISSING');
        if (direction === 'write' ? object.common?.write !== true : object.common?.read === false)
            throw new Error(direction === 'write' ? 'STATE_NOT_WRITABLE' : 'STATE_NOT_READABLE');
        first = first || object;
        const alias = (0, config_boundary_contracts_1.record)(object.common?.alias).id;
        if (!alias)
            return { id, chain, object: first, terminalObject: object };
        const next = typeof alias === 'string' ? alias : ((0, config_boundary_contracts_1.isRecord)(alias) ? alias[direction] : null);
        if (typeof next !== 'string' || !next.trim())
            throw new Error(direction === 'write' ? 'ALIAS_WRITE_SOURCE_INVALID' : 'ALIAS_READ_SOURCE_INVALID');
        id = next.trim();
    }
    throw new Error('ALIAS_CYCLE_OR_DEPTH');
}
/** Bekannte konkurrierende Aliasse werden ebenfalls aufgelöst, damit die zentrale
 * Stellhoheit denselben physikalischen Ausgang auch über alte Zuordnungen erkennt. */
function existingMappedIds(root) {
    const ids = new Set();
    let visited = 0;
    const walk = (value, depth) => {
        if (!value || typeof value !== 'object' || depth > 10 || visited++ > 4000)
            return;
        for (const [key, child] of Object.entries(value)) {
            if (typeof child === 'string' && /(?:ObjectId|WriteId|writeId|set\w*Id|target\w*Id|max\w*Id|output\w*Id|dpId)$/i.test(key) && child.trim())
                ids.add(child.trim());
            else if (child && typeof child === 'object')
                walk(child, depth + 1);
            if (ids.size >= 256)
                return;
        }
    };
    for (const key of ['storage', 'storageFarm', 'gridConstraints', 'peakShaving', 'logicEditor', 'smartHomeConfig', 'threshold', 'relay'])
        walk(root[key], 0);
    return [...ids].slice(0, 256);
}
function mappingContracts(config) {
    const rows = [];
    const add = (rawMapping, direction, path, type = 'number') => {
        const mapping = (0, config_boundary_contracts_1.record)(rawMapping);
        if (!(0, config_boundary_contracts_1.text)(mapping.stateId))
            return;
        rows.push({ id: (0, config_boundary_contracts_1.text)(mapping.stateId), direction, type, ...(typeof mapping.unit === 'string' && mapping.unit ? { unit: mapping.unit } : {}), path });
        if (direction === 'write' && (0, config_boundary_contracts_1.text)(mapping.readbackStateId))
            rows.push({ id: (0, config_boundary_contracts_1.text)(mapping.readbackStateId), direction: 'read', type, path: `${path}.readbackStateId` });
    };
    for (const point of config.points || [])
        if (point.id !== 'M0')
            add(point.measurement, 'read', `points.${point.id}.measurement`);
    for (const storage of config.storages || []) {
        for (const key of readKeys)
            add(storage[key], 'read', `storages.${storage.id}.${key}`, key === 'availability' ? typeof (0, config_boundary_contracts_1.record)(storage[key]).availableValue : 'number');
        for (const key of commandKeys) {
            const entry = (0, config_boundary_contracts_1.record)((0, config_boundary_contracts_1.record)(storage.command)[key]);
            const type = ['run', 'chargeEnable', 'dischargeEnable'].includes(key) ? typeof entry?.onValue : (key === 'watchdog' ? typeof entry?.writeValue : 'number');
            add(entry, 'write', `storages.${storage.id}.command.${key}`, type);
        }
        for (const key of ['appliedMaxCharge', 'appliedMaxDischarge'])
            add((0, config_boundary_contracts_1.record)(storage.command)[key], 'read', `storages.${storage.id}.command.${key}`);
    }
    for (const pv of config.pvAssignments || []) {
        add(pv.powerMeasurement, 'read', `pvAssignments.${pv.id}.powerMeasurement`);
        add(pv.command, 'write', `pvAssignments.${pv.id}.command`);
    }
    return rows;
}
async function validateDynamicGridCandidateUncached(adapter, raw, root, active) {
    const first = (0, config_boundary_contracts_1.validationResult)(validateDynamicGridConfig(raw, { rootConfig: root, active: false }));
    if (!first.valid)
        return first;
    const config = (0, config_boundary_contracts_1.dynamicConfig)(first.config);
    const activationErrors = [];
    const reads = new Map();
    const writes = new Map();
    const contracts = mappingContracts(config);
    if ((0, config_boundary_contracts_1.record)(root.gridConstraints).pvEvuEnabled === true && config.pvAssignments.some((row) => row.evuControl === true)) {
        const relayIds = [60, 30, 0].map((stage) => (0, config_boundary_contracts_1.text)((0, config_boundary_contracts_1.record)(root.gridConstraints)[`pvEvuRelay${stage}Id`])).filter(Boolean);
        if (!relayIds.length)
            activationErrors.push({ path: 'pvAssignments.evuControl', code: 'EVU_MAPPING_REQUIRED', message: 'Die zugeordnete EVU-Steuerung benötigt mindestens einen gültigen Stufeneingang.' });
        for (const id of relayIds)
            contracts.push({ id, direction: 'read', type: 'boolean|number', path: 'pvAssignments.evuControl' });
    }
    const general = generalInputs(root);
    const generalIds = (general.gridPointPower ? [general.gridPointPower] : [general.gridBuyPower, general.gridSellPower]).filter(Boolean);
    const wanted = new Map();
    const add = (value, direction, required = true) => {
        const id = (0, config_boundary_contracts_1.text)(value);
        if (!id)
            return;
        const key = `${direction}:${id}`;
        if (!wanted.has(key) || required)
            wanted.set(key, { id, direction, required });
    };
    for (const item of contracts)
        add(item.id, item.direction);
    for (const id of generalIds)
        add(id, 'read');
    for (const id of dynamicGridReadIds(first.topology || {}))
        add(id, 'read');
    for (const id of dynamicGridWriteIds(first.topology || {}))
        add(id, 'write');
    for (const id of existingMappedIds(root))
        add(id, 'write', false);
    for (const id of extractRequiredLegacyDynamicPvIds(root))
        add(id, 'write');
    if (wanted.size > 512)
        throw dynamicGridError(422, 'DYNAMIC_GRID_TOO_MANY_MAPPINGS', 'Zu viele unterschiedliche Datenpunktzuordnungen.');
    const queue = [...wanted.values()];
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (queue.length) {
            const item = queue.shift();
            if (item === undefined)
                break;
            try {
                const resolved = await resolveDynamicGridObject(adapter, item.id, item.direction);
                (item.direction === 'read' ? reads : writes).set(item.id, resolved);
            }
            catch (error) {
                if (item.required)
                    activationErrors.push({ path: generalIds.includes(item.id) ? 'points.M0.measurement' : item.id, code: (0, http_error_boundary_1.safeSourceFailureCode)(error), message: `Datenpunkt ist nicht eindeutig ${item.direction === 'read' ? 'lesbar' : 'beschreibbar'}.` });
            }
        }
    }));
    const unitByStateId = Object.create(null);
    for (const [id, resolved] of reads)
        unitByStateId[id] = (0, config_boundary_contracts_1.text)(resolved.object.common?.unit || resolved.terminalObject.common?.unit);
    const generalMeasurement = resolveGeneralMeasurement(root, { unitByStateId });
    const final = (0, config_boundary_contracts_1.validationResult)(validateDynamicGridConfig(raw, { rootConfig: root, active, generalMeasurement,
        resolveSourceId: (id) => reads.get(id)?.id || null,
        resolveWriteId: (id) => writes.get(id)?.id || null }));
    for (const item of contracts) {
        const resolved = (item.direction === 'read' ? reads : writes).get(item.id);
        if (!resolved)
            continue;
        const objectType = resolved.object.common?.type;
        if (item.type === 'boolean|number' ? objectType !== 'number' && objectType !== 'boolean' : (!['number', 'boolean'].includes(item.type) || objectType !== item.type))
            activationErrors.push({ path: item.path, code: 'DATAPOINT_TYPE_MISMATCH', message: `Der Datenpunkt muss den Typ ${item.type === 'boolean' ? 'Boolean' : 'Zahl'} besitzen.` });
        const unit = unitByStateId[item.id];
        if (item.direction === 'read' && item.unit && unit && unit !== item.unit)
            activationErrors.push({ path: item.path, code: 'DATAPOINT_UNIT_MISMATCH', message: 'Die konfigurierte Leistungseinheit passt nicht zur Objekt-Einheit.' });
    }
    for (const id of generalIds) {
        if (reads.get(id)?.object.common?.type !== 'number')
            activationErrors.push({ path: 'points.M0', code: 'GENERAL_METER_TYPE_INVALID', message: 'Die Allgemein-Netzmessung muss numerische Zustände bereitstellen.' });
        if (reads.has(id) && unitByStateId[id] !== 'W' && unitByStateId[id] !== 'kW')
            activationErrors.push({ path: 'points.M0', code: 'GENERAL_METER_UNIT_INVALID', message: 'Die Allgemein-Netzmessung benötigt eine bestätigte Objekt-Einheit W oder kW.' });
    }
    activationErrors.push(...(0, config_boundary_contracts_1.issueResult)(validateLegacyDynamicPvCoverage(root, (0, config_boundary_contracts_1.record)(final.config).pvAssignments || config.pvAssignments, { resolveWriteId: (id) => writes.get(id)?.id || null })));
    if (typeof adapter._nwLicenseAllowsAppId === 'function' && !adapter._nwLicenseAllowsAppId('dynamicGrid'))
        activationErrors.push({ path: 'app', code: 'DYNAMIC_GRID_LICENSE_REQUIRED', message: 'Das vorhandene Home-/Pro-Netzlimitrecht ist nicht freigegeben.' });
    const maxStorages = typeof adapter._nwLicenseMaxStorages === 'function' ? adapter._nwLicenseMaxStorages() : 10;
    if (config.storages.length > maxStorages)
        activationErrors.push({ path: 'storages', code: 'STORAGE_COUNT_LICENSE_LIMIT', message: `Das vorhandene Lizenzprofil erlaubt ${maxStorages} Speicher.` });
    const dedupe = (issues) => [...new Map(issues.map((entry) => [`${entry.path}:${entry.code}`, entry])).values()];
    const allActivationErrors = dedupe([...(final.activationErrors || []), ...(active ? final.errors || [] : []), ...activationErrors]);
    const errors = dedupe([...(final.errors || []), ...(active ? activationErrors : [])]);
    // Alte Übergabeziele bleiben erhalten; unbenutzte Entwurfs-Aliasse sammeln sich
    // nicht über beliebig viele Saves hinweg an. Der nächste Vertrag wird vor persist reservierbar.
    const protectedTargets = getDynamicGridOwnedTargets(adapter);
    const canonical = Object.create(null);
    for (const [id, chain] of Object.entries(adapter._nwDynamicGridCanonicalTargets || {}))
        if (protectedTargets.has(id))
            canonical[id] = chain;
    for (const [id, resolved] of writes)
        canonical[id] = resolved.chain;
    adapter._nwDynamicGridCanonicalTargets = canonical;
    return { ...final, config: final.config, generalMeasurement, errors, activationErrors: allActivationErrors,
        valid: errors.length === 0, activeEligible: allActivationErrors.length === 0 };
}
const jobs = new WeakMap();
const cache = new WeakMap();
/** Eine begrenzte Objektprüfung je Adapter, vier DB-Leser, gemeinsame 3-s-Frist.
 * Hängt die DB, bleibt der Slot bis zum echten Abschluss belegt; keine Auftragsflut. */
async function validateDynamicGridCandidate(adapter, raw, root = (0, config_boundary_contracts_1.record)(adapter.config), active = dynamicGridAppState(root).active) {
    if (raw !== undefined && !(0, config_boundary_contracts_1.isRecord)(raw))
        return { valid: false, config: null, topology: null, errors: [{ path: '', code: 'CONFIG_OBJECT_REQUIRED', message: 'Die App-Konfiguration muss ein Objekt sein.' }], activationErrors: [], activeEligible: false };
    const signature = JSON.stringify([raw, generalInputs(root), active, existingMappedIds(root), root.gridConstraints, adapter._nwLicenseMaxStorages?.()]);
    if (signature.length > 262144)
        throw dynamicGridError(413, 'DYNAMIC_GRID_CONFIG_TOO_LARGE', 'Die Konfiguration überschreitet die zulässige Größe.');
    const previous = cache.get(adapter);
    if (previous?.signature === signature && Date.now() - previous.ts < 5000)
        return (0, config_boundary_contracts_1.validationResult)((0, config_boundary_contracts_1.cloneJson)(previous.validation));
    let job = jobs.get(adapter);
    if (job && job.signature !== signature)
        throw dynamicGridError(409, 'DYNAMIC_GRID_VALIDATION_BUSY', 'Eine Datenpunktprüfung läuft bereits.');
    if (!job) {
        job = { signature, promise: validateDynamicGridCandidateUncached(adapter, raw, root, active) };
        jobs.set(adapter, job);
        const owner = job;
        job.promise.then((validation) => cache.set(adapter, { signature, validation, ts: Date.now() }), () => { }).finally(() => { if (jobs.get(adapter) === owner)
            jobs.delete(adapter); });
    }
    let timer;
    try {
        return await Promise.race([job.promise, new Promise((_resolve, reject) => { timer = setTimeout(() => reject(dynamicGridError(503, 'DYNAMIC_GRID_VALIDATION_TIMEOUT', 'Datenpunktprüfung hat das Zeitlimit überschritten.')), 3000); })]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
function withDynamicApp(root, app) {
    return { ...root, emsApps: { ...(0, config_boundary_contracts_1.record)(root.emsApps), apps: { ...(0, config_boundary_contracts_1.record)((0, config_boundary_contracts_1.record)(root.emsApps).apps), dynamicGrid: { installed: app.installed, enabled: app.enabled } } }, enableDynamicGrid: app.active };
}
function validateApp(raw, current) {
    if (raw === undefined)
        return current;
    if (!(0, config_boundary_contracts_1.isRecord)(raw) || typeof raw.installed !== 'boolean' || typeof raw.enabled !== 'boolean' || (raw.enabled && !raw.installed))
        throw dynamicGridError(422, 'DYNAMIC_GRID_APP_STATE_INVALID', 'Aktivierung erfordert eine installierte App mit eindeutigen Boolean-Schaltern.');
    return { installed: raw.installed, enabled: raw.enabled, active: raw.installed && raw.enabled };
}
async function prepareDynamicGridChange(adapter, raw, expectedVersion, appRaw, root = (0, config_boundary_contracts_1.record)(adapter.config)) {
    const current = (0, config_boundary_contracts_1.record)(currentDynamicGridConfig(adapter));
    const version = typeof current.configVersion === 'number' && Number.isSafeInteger(current.configVersion) && current.configVersion > 0 ? current.configVersion : 1;
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== version)
        throw dynamicGridError(409, 'DYNAMIC_GRID_VERSION_CONFLICT', 'Die Konfiguration wurde geändert. Aktuellen Stand neu laden.');
    if (version >= Number.MAX_SAFE_INTEGER)
        throw dynamicGridError(409, 'DYNAMIC_GRID_VERSION_EXHAUSTED', 'Die Konfigurationsversion kann nicht weiter erhöht werden.');
    const app = validateApp(appRaw, dynamicGridAppState(root));
    const nextRoot = withDynamicApp({ ...root, dynamicGridConnection: raw }, app);
    const validation = await validateDynamicGridCandidate(adapter, raw, nextRoot, app.active);
    if (!validation.valid)
        throw dynamicGridError(422, 'DYNAMIC_GRID_CONFIG_INVALID', 'Die Konfiguration ist nicht gültig.', validation.errors);
    const config = { ...(0, config_boundary_contracts_1.dynamicConfig)(validation.config), configVersion: version + 1 };
    return { config, app, root: { ...nextRoot, dynamicGridConnection: config }, validation };
}
/** AppCenter/Import ersetzen den Vertrag vollständig. Auch reine App-Schalter
 * oder geänderte Allgemein-DPs benötigen bei vorhandenem Vertrag denselben CAS. */
async function prepareDynamicGridInstallerPatch(adapter, patch, submitted, explicitVersion) {
    const currentRoot = (0, config_boundary_contracts_1.record)(adapter.config);
    if (!(0, config_boundary_contracts_1.own)(submitted, 'dynamicGridConnection') && currentRoot.dynamicGridConnection !== undefined)
        patch.dynamicGridConnection = (0, config_boundary_contracts_1.cloneJson)(currentRoot.dynamicGridConnection);
    // Alte Vollbackups dürfen vorhandene aktive App-Verträge nicht herabstufen.
    const submittedApps = (0, config_boundary_contracts_1.record)((0, config_boundary_contracts_1.record)(submitted.emsApps).apps);
    const currentApp = (0, config_boundary_contracts_1.record)((0, config_boundary_contracts_1.record)(currentRoot.emsApps).apps).dynamicGrid;
    if (!(0, config_boundary_contracts_1.own)(submittedApps, 'dynamicGrid') && currentApp) {
        const emsApps = (0, config_boundary_contracts_1.isRecord)(patch.emsApps) ? patch.emsApps : { schemaVersion: 1, apps: {} };
        const apps = (0, config_boundary_contracts_1.record)(emsApps.apps);
        apps.dynamicGrid = (0, config_boundary_contracts_1.cloneJson)(currentApp);
        emsApps.apps = apps;
        patch.emsApps = emsApps;
        patch.enableDynamicGrid = dynamicGridAppState(currentRoot).active;
    }
    const merged = adapter.nwApplyInstallerPatchToRuntimeConfig(currentRoot, patch);
    if (!(0, config_boundary_contracts_1.isRecord)(merged))
        throw new Error('INSTALLER_PATCH_CONTRACT_INVALID');
    const nextRoot = merged;
    if (dynamicGridSignature(nextRoot) === dynamicGridSignature(currentRoot))
        return;
    const touchedApp = (0, config_boundary_contracts_1.own)(submittedApps, 'dynamicGrid');
    if (currentRoot.dynamicGridConnection === undefined && !(0, config_boundary_contracts_1.own)(submitted, 'dynamicGridConnection') && !touchedApp && !dynamicGridAppState(nextRoot).active)
        return;
    const raw = nextRoot.dynamicGridConnection === undefined ? dynamicGridDefaults() : nextRoot.dynamicGridConnection;
    const expected = explicitVersion === undefined ? (0, config_boundary_contracts_1.record)(submitted.dynamicGridConnection).configVersion : explicitVersion;
    const result = await prepareDynamicGridChange(adapter, raw, expected, dynamicGridAppState(nextRoot), nextRoot);
    patch.dynamicGridConnection = result.config;
}
/** Zentrale Persistenzgrenze schützt auch Simulation, interne Saves und native
 * Aktivierung. Versionssprünge können nicht über einen anderen Writer entfallen. */
async function assertDynamicGridPersistence(adapter, nextRoot) {
    const currentRoot = (0, config_boundary_contracts_1.record)(adapter.config);
    const changed = dynamicGridSignature(currentRoot) !== dynamicGridSignature(nextRoot);
    const active = dynamicGridAppState(nextRoot).active;
    const wasActive = dynamicGridAppState(currentRoot).active;
    if (currentRoot.dynamicGridConnection === undefined && nextRoot.dynamicGridConnection === undefined && !dynamicGridAppState(currentRoot).installed && !dynamicGridAppState(nextRoot).installed)
        return null;
    if (!changed && !active)
        return null;
    if (nextRoot.dynamicGridConnection === undefined && currentRoot.dynamicGridConnection !== undefined)
        throw dynamicGridError(409, 'DYNAMIC_GRID_EXPLICIT_TRANSITION_REQUIRED', 'Die App-Konfiguration darf beim Import nicht still entfernt werden.');
    if (changed) {
        const current = (0, config_boundary_contracts_1.record)(currentDynamicGridConfig(adapter));
        if ((0, config_boundary_contracts_1.record)(nextRoot.dynamicGridConnection).configVersion !== (Number(current?.configVersion) || 1) + 1)
            throw dynamicGridError(409, 'DYNAMIC_GRID_VERSION_CONFLICT', 'Änderungen benötigen die aktuelle App-Konfigurationsversion.');
    }
    const raw = nextRoot.dynamicGridConnection === undefined ? dynamicGridDefaults() : nextRoot.dynamicGridConnection;
    const validation = await validateDynamicGridCandidate(adapter, raw, nextRoot, active);
    if (!validation.valid)
        throw dynamicGridError(422, 'DYNAMIC_GRID_CONFIG_INVALID', 'Die Konfiguration ist nicht gültig.', validation.errors);
    if (changed && wasActive && typeof adapter._nwPrepareDynamicGridTransition !== 'function')
        throw dynamicGridError(409, 'DYNAMIC_GRID_HANDOVER_UNAVAILABLE', 'Die aktive App muss vor der Änderung eine kontrollierte Übergabe bestätigen.');
    if (changed && typeof adapter._nwPrepareDynamicGridTransition === 'function') {
        const transition = await adapter._nwPrepareDynamicGridTransition(nextRoot);
        if (!(0, config_boundary_contracts_1.isRecord)(transition) || transition.ok !== true)
            throw dynamicGridError(409, 'DYNAMIC_GRID_HANDOVER_PENDING', 'Die alte Stellhoheit wird noch kontrolliert übergeben.');
    }
    return { changed, validation, root: nextRoot };
}
function dynamicGridCurrentStatus(adapter) {
    const config = (0, config_boundary_contracts_1.record)(currentDynamicGridConfig(adapter));
    const app = dynamicGridAppState((0, config_boundary_contracts_1.record)(adapter.config));
    const status = (0, config_boundary_contracts_1.record)(adapter._nwDynamicGridStatus);
    if (status && status.configVersion === config?.configVersion && status.active === true && app.active) {
        const ts = status.ts ?? status.timestamp;
        if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0 || ts > Date.now() || Date.now() - ts > 15000)
            return {
                schemaVersion: 1, configVersion: config.configVersion, active: true, status: 'stale', stale: true, ts: typeof ts === 'number' && Number.isFinite(ts) ? ts : null,
                reason: 'Seit mehr als 15 Sekunden liegt kein gültiger Laufzeitstatus vor.', snapshot: null, measurements: null, budget: null, pv: null, writesPerformed: null, applied: false,
            };
    }
    if (status && status.configVersion === config?.configVersion && status.active === app.active) {
        const pv = (0, config_boundary_contracts_1.record)(adapter._nwDynamicGridPvRuntime);
        const snapshot = pv && pv.configVersion === config.configVersion && app.active && typeof pv.ts === 'number' && pv.ts > 0 && pv.ts <= Date.now() && Date.now() - pv.ts <= 15000 ? Object.fromEntries(['status', 'errors', 'requests', 'points', 'accepted', 'applied', 'results', 'pendingEffects', 'acceptedCaps', 'ts', 'configVersion', 'generation'].filter((key) => (0, config_boundary_contracts_1.own)(pv, key)).map((key) => [key, pv[key]])) : null;
        return { ...status, pv: snapshot };
    }
    return { schemaVersion: 1, configVersion: config?.configVersion ?? null, active: app.active, status: app.active ? 'pending' : 'inactive', timestamp: null,
        reason: app.active ? 'Der nächste Messzyklus prüft die neue Zuordnung.' : 'Die App ist nicht aktiviert.', measurements: null, budget: null, writesPerformed: 0 };
}
async function dynamicGridSnapshot(adapter, preparedValidation) {
    const config = currentDynamicGridConfig(adapter), app = dynamicGridAppState((0, config_boundary_contracts_1.record)(adapter.config));
    const validation = preparedValidation || await validateDynamicGridCandidate(adapter, config, (0, config_boundary_contracts_1.record)(adapter.config), false);
    const rootIssues = (validation.activationErrors || []).filter((item) => item.path.startsWith('points.M0') || item.path.includes('.generalMeasurement') || ['GENERAL_METER_TYPE_INVALID', 'GENERAL_METER_UNIT_INVALID'].includes(item.code));
    return { ok: true, config, app, status: dynamicGridCurrentStatus(adapter),
        rootSource: { measurement: validation.generalMeasurement || null, valid: rootIssues.length === 0, reason: rootIssues.map((item) => item.message).join(' ') },
        validation, locked: !!adapter._nwMeshAppSaveInProgress, maxStorages: adapter._nwLicenseMaxStorages?.() ?? 10 };
}
function registerDynamicGridApi(app, adapter, requireInstaller, hooks) {
    const noStore = (res) => { res.setHeader('Cache-Control', 'no-store'); };
    const fail = (res, error) => { const failure = (0, http_error_boundary_1.safeConfigurationFailure)(error); return res.status(failure.status).json(failure.body); };
    app.get('/api/dynamic-grid', requireInstaller, async (_req, res) => { noStore(res); try {
        return res.json(await dynamicGridSnapshot(adapter));
    }
    catch (error) {
        return fail(res, error);
    } });
    app.get('/api/dynamic-grid/status', requireInstaller, (_req, res) => { noStore(res); return res.json({ ok: true, status: dynamicGridCurrentStatus(adapter) }); });
    app.post('/api/dynamic-grid/preview', requireInstaller, async (req, res) => {
        noStore(res);
        try {
            if (!(0, config_boundary_contracts_1.isRecord)(req.body) || !(0, config_boundary_contracts_1.own)(req.body, 'config'))
                throw dynamicGridError(400, 'DYNAMIC_GRID_CONFIG_REQUIRED', 'Eine App-Konfiguration ist erforderlich.');
            const validation = await validateDynamicGridCandidate(adapter, req.body.config, (0, config_boundary_contracts_1.record)(adapter.config), true);
            const status = validation.valid && typeof adapter._nwPreviewDynamicGrid === 'function' ? await adapter._nwPreviewDynamicGrid(validation.config, (0, config_boundary_contracts_1.record)(adapter.config)) : null;
            return res.json({ ok: true, preview: true, validation, status, previewAvailable: status !== null });
        }
        catch (error) {
            return fail(res, error);
        }
    });
    app.post('/api/dynamic-grid/config', requireInstaller, async (req, res) => {
        noStore(res);
        const token = hooks.beginSave();
        if (!token)
            return fail(res, dynamicGridError(409, 'INSTALLER_CONFIG_BUSY', 'Eine Konfiguration wird bereits gespeichert.'));
        try {
            if (!(0, config_boundary_contracts_1.isRecord)(req.body) || !(0, config_boundary_contracts_1.own)(req.body, 'config'))
                throw dynamicGridError(400, 'DYNAMIC_GRID_CONFIG_REQUIRED', 'Eine vollständige App-Konfiguration ist erforderlich.');
            const prepared = await prepareDynamicGridChange(adapter, req.body.config, req.body.expectedConfigVersion, req.body.app);
            await hooks.commit(prepared);
            return res.json({ ...await dynamicGridSnapshot(adapter, { ...prepared.validation, config: prepared.config, topology: prepared.validation.topology ? { ...(0, config_boundary_contracts_1.record)(prepared.validation.topology), configVersion: prepared.config.configVersion } : null }), locked: false });
        }
        catch (error) {
            return fail(res, error);
        }
        finally {
            hooks.endSave(token);
        }
    });
}
module.exports = { dynamicGridAppState, currentDynamicGridConfig, generalInputs, dynamicGridSignature, resolveDynamicGridObject,
    validateDynamicGridCandidate, prepareDynamicGridChange, prepareDynamicGridInstallerPatch, assertDynamicGridPersistence,
    dynamicGridCurrentStatus, dynamicGridSnapshot, registerDynamicGridApi };
