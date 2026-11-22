/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @ts-nocheck
/**
 * TypeScript-Parallelspiegel: lib/nvp-config-api.js
 *
 * Zweck:
 * Diese Datei ist die TypeScript-Vorbereitung der bestehenden JavaScript-Runtime-Datei.
 * Sie wird noch nicht produktiv ausgeführt. Die zugehörige erzeugte JavaScript-Laufzeitdatei ist:
 * lib/nvp-config-api.js
 *
 * Zusammenhang:
 * Der Spiegel hilft uns, die JS-Datei später schrittweise zu typisieren, zu testen und
 * kontrolliert auf TypeScript umzustellen. Produktive Originalquellen liegen unter
 * src-ts/runtime-executables/ bzw. den im generierten JS genannten TS-Pfaden.
 * Dort ändern, Laufzeit erzeugen und danach die Spiegel synchronisieren.
 * Build-/Prüfskripte ohne TS-Original werden weiterhin unter scripts/ gepflegt.
 *
 * Wichtig für die Migration:
 * - Diese Datei enthält vorübergehend @ts-nocheck.
 * - Der nächste Schritt ist pro Modul echte Typisierung statt pauschalem No-Check.
 * - Fachliche Kommentare markieren die Abschnitte, die später einzeln migriert werden.
 *
 * Original-Hash: e38648501b533f6167b6c16a26d481afd9bc5014681d50e726136645a9cd1c9a
 */

/**
 * Code-Teil: Runtime-Spiegel der kompletten Datei
 *
 * Zweck:
 * Dieser Abschnitt enthält den ursprünglichen JavaScript-Code als TypeScript-Parallelkopie.
 * Einzelne Funktionen werden später pro Modul weiter typisiert; Dateien ohne eigene
 * Funktionsdeklarationen bleiben trotzdem über diesen Dateikommentar dokumentiert.
 */

/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/nvp-config-api.ts
 * Quell-Hash: sha256:bdecfc284d413d60022fc521bf24c2d6cf96696d322b509fcd885394496da0b7
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/nvp-config-api.js.
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
Object.defineProperty(exports, "__esModule", { value: true });
const http_error_boundary_1 = require("./http-error-boundary");
const config_boundary_contracts_1 = require("./config-boundary-contracts");
const { validateTopology } = require('../ems/services/nvp-topology');
const ACTIVE_BLOCK = Object.freeze({
    path: 'operation', code: 'RUNTIME_SCOPED_DISPATCH_NOT_IMPLEMENTED',
    message: 'Aktiver dynamischer Betrieb ist noch nicht verfügbar: getrennte Geräteschreibpfade, bestätigte Geräteprofile und Ausfallreaktionen fehlen. Die Diagnose verändert keine bestehenden Sollwerte.',
});
/** Die fehlende neue Konfiguration bedeutet unverändert statischen Betrieb. */
function currentNvpConfig(adapter) {
    const raw = (0, config_boundary_contracts_1.record)(adapter.config).nvpTopology;
    return raw === undefined ? (0, config_boundary_contracts_1.validationResult)(validateTopology(undefined)).config : (0, config_boundary_contracts_1.cloneJson)(raw);
}
/** Bindet Auswahlkennungen an tatsächliche Bestandszeilen; Messquellen verhindern eine stille Index-Neuzuordnung. */
function nvpDeviceInventory(config = {}) {
    const storages = [];
    const single = (0, config_boundary_contracts_1.record)(config.storage);
    const dp = (0, config_boundary_contracts_1.record)(single.datapoints);
    const singleSources = [dp.batteryPowerObjectId, dp.feneconEssActualPowerObjectId].map(config_boundary_contracts_1.text).filter(Boolean);
    if (singleSources.length || [dp.targetPowerObjectId, dp.targetChargePowerObjectId, dp.targetDischargePowerObjectId].some(config_boundary_contracts_1.text)) {
        storages.push({ id: 'storage-single', name: (0, config_boundary_contracts_1.text)(single.name) || 'Einzelspeicher', powerStateIds: singleSources, powerStateId: singleSources[0] || '', source: 'storage' });
    }
    const configuredRows = (0, config_boundary_contracts_1.record)(config.storageFarm).storages;
    const rows = Array.isArray(configuredRows) ? configuredRows : [];
    rows.slice(0, 100).forEach((row, index) => {
        if (!(0, config_boundary_contracts_1.isRecord)(row))
            return;
        const nested = (0, config_boundary_contracts_1.isRecord)(row.datapoints) ? row.datapoints : {};
        const sources = [row.signedPowerId, row.batteryPowerObjectId, row.feneconEssActualPowerId, row.feneconEssActualPowerObjectId,
            nested.signedPowerId, nested.batteryPowerObjectId, nested.feneconEssActualPowerId, nested.feneconEssActualPowerObjectId].map(config_boundary_contracts_1.text).filter(Boolean);
        storages.push({ id: `storage-farm-${index}`, name: (0, config_boundary_contracts_1.text)(row.name) || `Speicher ${index + 1}`, powerStateIds: [...new Set(sources)], powerStateId: sources[0] || '', source: 'storageFarm', index, enabled: row.enabled !== false });
    });
    const pv = [];
    const grid = (0, config_boundary_contracts_1.record)(config.gridConstraints);
    for (const [key, prefix] of [['pvCurtailInvertersEvu', 'pv-evu'], ['pvCurtailInvertersZero', 'pv-zero']]) {
        const configuredList = grid[key];
        const list = Array.isArray(configuredList) ? configuredList : [];
        list.slice(0, 100).forEach((row, index) => {
            if (!(0, config_boundary_contracts_1.isRecord)(row))
                return;
            pv.push({ id: `${prefix}-${index}`, name: (0, config_boundary_contracts_1.text)(row.name) || `${prefix === 'pv-evu' ? 'EVU' : 'Nulleinspeisung'} Wechselrichter ${index + 1}`, source: key, index });
        });
    }
    if ([grid.pvLimitWId, grid.pvLimitPctId, grid.pvFeedInLimitWId].some(config_boundary_contracts_1.text))
        pv.push({ id: 'pv-single', name: 'Einzelner PV-Wechselrichter', source: 'gridConstraints' });
    return { storages, pv };
}
/**
 * Löst nur Leseseiten von Aliasobjekten auf, höchstens acht Ebenen und mit Zyklenerkennung.
 * Die vom Browser eingetragene physicalSourceId ersetzt diese serverseitige Prüfung nicht.
 * Fehlende Objekte oder nicht lesbare Quellen werden nicht als nachgewiesene Identität behandelt.
 */
async function resolveNvpSource(adapter, stateId) {
    const seen = new Set();
    let id = stateId;
    for (let depth = 0; depth < 8; depth += 1) {
        if (!id || id.length > 512 || seen.has(id))
            throw new Error('ALIAS_CYCLE_OR_DEPTH');
        seen.add(id);
        const object = (0, config_boundary_contracts_1.stateObject)(await adapter.getForeignObjectAsync(id));
        if (!object || object.type !== 'state' || object.common?.read === false)
            throw new Error('MEASUREMENT_SOURCE_UNAVAILABLE');
        const alias = (0, config_boundary_contracts_1.record)(object.common?.alias).id;
        if (!alias)
            return id;
        const next = typeof alias === 'string' ? alias : ((0, config_boundary_contracts_1.isRecord)(alias) ? alias.read : null);
        if (typeof next !== 'string' || !next.trim())
            throw new Error('ALIAS_READ_SOURCE_INVALID');
        id = next.trim();
    }
    throw new Error('ALIAS_CYCLE_OR_DEPTH');
}
/**
 * Prüft Schema und komplette Gerätebindung ohne Mutation. Alle Messquellen werden aus
 * ioBroker gelesen; ungültige Quellen werden weder null noch einer erfundenen Leistung gleichgesetzt.
 */
async function validateNvpCandidateUncached(adapter, raw, runtimeConfig) {
    let validation = (0, config_boundary_contracts_1.validationResult)(validateTopology(raw));
    const errors = Array.isArray(validation.errors) ? validation.errors.slice() : [];
    if (!validation.valid)
        return { ...validation, errors, activeEligible: false };
    const config = (0, config_boundary_contracts_1.nvpConfig)(validation.config);
    if (config.mode !== 'dynamic')
        return validation;
    const devices = nvpDeviceInventory(runtimeConfig);
    const sources = new Map();
    const wanted = new Set();
    for (const point of config.points)
        wanted.add(point.measurement.stateId);
    for (const storage of config.storages) {
        wanted.add(storage.powerMeasurement.stateId);
        const actual = devices.storages.find((device) => device.id === storage.id);
        if (!actual)
            errors.push({ path: `storages.${storage.id}`, code: 'UNKNOWN_STORAGE_BINDING', message: 'Der Speicher ist im vorhandenen Adapter nicht konfiguriert.' });
        else
            for (const id of actual.powerStateIds)
                wanted.add(id);
    }
    if (wanted.size > 256)
        errors.push({ path: 'measurements', code: 'TOO_MANY_SOURCES', message: 'Zu viele unterschiedliche Messquellen.' });
    else {
        // Maximal vier gleichzeitige Objektabfragen; ein blockierter ioBroker-Aufruf
        // lässt keine unbegrenzte Zahl weiterer Requests entstehen.
        const queue = [...wanted];
        await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
            while (queue.length) {
                const id = queue.shift();
                if (id === undefined)
                    break;
                try {
                    sources.set(id, await resolveNvpSource(adapter, id));
                }
                catch (error) {
                    sources.set(id, null);
                    errors.push({ path: 'measurement', code: (0, http_error_boundary_1.safeSourceFailureCode)(error), message: `Messquelle ${id} ist nicht eindeutig lesbar.` });
                }
            }
        }));
    }
    validation = (0, config_boundary_contracts_1.validationResult)(validateTopology(raw, { resolveSourceId: (id) => sources.get(id) || null, supportedProfileIds: [] }));
    for (const error of validation.errors || [])
        if (!errors.some((entry) => entry.code === error.code && entry.path === error.path))
            errors.push(error);
    for (const storage of config.storages) {
        const actual = devices.storages.find((device) => device.id === storage.id);
        if (!actual)
            continue;
        const source = sources.get(storage.powerMeasurement.stateId);
        if (!source || !actual.powerStateIds.some((id) => sources.get(id) === source)) {
            errors.push({ path: `storages.${storage.id}.powerMeasurement`, code: 'STORAGE_MEASUREMENT_BINDING_MISMATCH', message: 'Die AC-Speicher-Istleistung muss zur ausgewählten bestehenden Speicherzuordnung gehören.' });
        }
    }
    for (const pv of config.pvAssignments)
        if (!devices.pv.some((device) => device.id === pv.id)) {
            errors.push({ path: `pvAssignments.${pv.id}`, code: 'UNKNOWN_PV_BINDING', message: 'Der PV-Wechselrichter ist im vorhandenen Adapter nicht konfiguriert.' });
        }
    if (config.operation === 'active')
        errors.push({ ...ACTIVE_BLOCK });
    return { ...validation, errors, valid: errors.length === 0, activeEligible: false };
}
const validationJobs = new WeakMap();
const validationCache = new WeakMap();
/**
 * Begrenzt Diagnose- und API-Objektabfragen gemeinsam auf einen Auftrag pro Adapter.
 * ioBroker bietet für Objektabfragen keinen Abort-Vertrag: nach 3 s endet daher die
 * Antwort, der belegte Slot bleibt bis zum echten Abschluss gesperrt. Dadurch können
 * wiederholte Browseraufrufe keine unbegrenzten hängenden Aufträge aufbauen.
 * Identische erfolgreiche Prüfungen werden für 5 s genutzt; keine Leistungswerte werden gecacht.
 */
async function validateNvpCandidate(adapter, raw, runtimeConfig = (0, config_boundary_contracts_1.record)(adapter.config)) {
    const signature = JSON.stringify([raw, nvpDeviceInventory(runtimeConfig)]);
    const cached = validationCache.get(adapter);
    if (cached?.signature === signature && Date.now() - cached.ts < 5000)
        return (0, config_boundary_contracts_1.validationResult)((0, config_boundary_contracts_1.cloneJson)(cached.validation));
    let job = validationJobs.get(adapter);
    if (job && job.signature !== signature)
        throw nvpError(409, 'NVP_VALIDATION_IN_PROGRESS', 'Eine NVP-Quellenprüfung läuft bereits.');
    if (!job) {
        job = { signature, promise: validateNvpCandidateUncached(adapter, raw, runtimeConfig) };
        validationJobs.set(adapter, job);
        const owner = job;
        job.promise.then((validation) => {
            validationCache.set(adapter, { signature, validation, ts: Date.now() });
        }, () => { }).finally(() => { if (validationJobs.get(adapter) === owner)
            validationJobs.delete(adapter); });
    }
    let timer;
    try {
        return await Promise.race([job.promise, new Promise((_resolve, reject) => {
                timer = setTimeout(() => reject(nvpError(503, 'NVP_VALIDATION_TIMEOUT', 'NVP-Objektprüfung hat das Zeitlimit überschritten.')), 3000);
            })]);
    }
    finally {
        if (timer)
            clearTimeout(timer);
    }
}
/** Strukturfehler erhalten HTTP-Status und geprüfte Fehlercodes ohne interne Stacktraces. */
function nvpError(status, code, message, details = []) {
    return (0, http_error_boundary_1.createPublicHttpError)(status, code, message, details || []);
}
/** Noch wirksame Freigaben oder laufende Writer dürfen durch Konfigurationswechsel nicht verschwinden. */
function assertNvpTransitionIdle(adapter) {
    const status = (0, config_boundary_contracts_1.record)(adapter._nwNvpTopologyStatus);
    if (status.locked === true || Number(status.outstandingGrants || 0) > 0 || Number(status.pendingWrites || 0) > 0) {
        throw nvpError(409, 'NVP_TRANSITION_NOT_IDLE', 'NVP-Konfiguration gesperrt: noch wirksame Freigaben oder Schreibvorgänge müssen zuerst kontrolliert abgelöst werden.');
    }
}
/**
 * Prüft die vollständige Kandidatentopologie und erhöht die Versionsnummer genau einmal.
 * Der Aufrufer muss die gemeinsame Installer-Speichersperre halten. Kein Teilobjekt-Merge:
 * CAS schützt zwei gleichzeitig geöffnete Installerfenster gegen verlorene Änderungen.
 */
async function prepareNvpChange(adapter, raw, expectedVersion, runtimeConfig = (0, config_boundary_contracts_1.record)(adapter.config)) {
    const current = (0, config_boundary_contracts_1.record)(currentNvpConfig(adapter));
    const version = typeof current.configVersion === 'number' && Number.isSafeInteger(current.configVersion) && current.configVersion > 0 ? current.configVersion : 1;
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== version)
        throw nvpError(409, 'NVP_CONFIG_VERSION_CONFLICT', 'NVP-Konfiguration wurde geändert. Aktuellen Stand neu laden.');
    assertNvpTransitionIdle(adapter);
    const validation = await validateNvpCandidate(adapter, raw, runtimeConfig);
    if (!validation.valid)
        throw nvpError(422, 'NVP_CONFIG_INVALID', 'NVP-Konfiguration ist nicht gültig.', validation.errors);
    if (version >= Number.MAX_SAFE_INTEGER)
        throw nvpError(409, 'NVP_CONFIG_VERSION_EXHAUSTED', 'NVP-Konfigurationsversion kann nicht weiter erhöht werden.');
    return { ...(0, config_boundary_contracts_1.nvpConfig)(validation.config), configVersion: version + 1 };
}
/**
 * Zentraler Schutz auch für Import, Simulation und interne Persistenzpfade. Ein direkter
 * State-/native-Eingriff ersetzt keine Aktivierung; der Runtime-Pfad prüft unabhängig erneut.
 * Unveränderte Diagnosekonfiguration erzeugt keine zusätzlichen Datenbank-Lesezugriffe.
 */
async function assertNvpPersistence(adapter, nextRuntime) {
    const currentRaw = (0, config_boundary_contracts_1.record)(adapter.config).nvpTopology;
    const nextRaw = nextRuntime?.nvpTopology;
    const sameTopology = JSON.stringify(currentRaw) === JSON.stringify(nextRaw);
    if (sameTopology && ((0, config_boundary_contracts_1.record)(nextRaw).mode !== 'dynamic' || JSON.stringify(nvpDeviceInventory((0, config_boundary_contracts_1.record)(adapter.config))) === JSON.stringify(nvpDeviceInventory(nextRuntime))))
        return;
    if (nextRaw === undefined && currentRaw !== undefined)
        throw nvpError(409, 'NVP_EXPLICIT_TRANSITION_REQUIRED', 'NVP-Konfiguration darf beim Import nicht still entfernt werden. Statischen Modus ausdrücklich speichern.');
    assertNvpTransitionIdle(adapter);
    const validation = await validateNvpCandidate(adapter, nextRaw, nextRuntime);
    if (!validation.valid)
        throw nvpError(422, 'NVP_CONFIG_INVALID', 'NVP-Konfiguration ist nicht gültig.', validation.errors);
    const current = (0, config_boundary_contracts_1.record)(currentNvpConfig(adapter));
    const currentVersion = typeof current.configVersion === 'number' && Number.isSafeInteger(current.configVersion) && current.configVersion > 0 ? current.configVersion : 1;
    if (!sameTopology && (0, config_boundary_contracts_1.record)(nextRaw).configVersion !== currentVersion + 1)
        throw nvpError(409, 'NVP_EXPLICIT_TRANSITION_REQUIRED', 'NVP-Änderungen benötigen die atomare NVP-Konfigurationsschnittstelle mit aktueller Versionsnummer.');
}
/**
 * Bindet veröffentlichte Diagnose an die aktuell gespeicherte Version. Während
 * der erste Messzyklus einer neuen Zuordnung fehlt, werden weder alte Messungen
 * noch alte Budgets übernommen. null ist ausdrücklich kein neuer Messzeitpunkt.
 */
function nvpCurrentStatus(adapter, rawConfig = currentNvpConfig(adapter)) {
    const config = (0, config_boundary_contracts_1.record)(rawConfig);
    const status = (0, config_boundary_contracts_1.record)(adapter._nwNvpTopologyStatus);
    if (status && Number.isSafeInteger(config?.configVersion)
        && status.configVersion === config.configVersion && status.mode === config.mode
        && status.operation === config.operation)
        return status;
    return {
        schemaVersion: 1, configVersion: Number.isSafeInteger(config?.configVersion) ? config.configVersion : null,
        mode: config?.mode || 'invalid', operation: config?.operation || 'diagnostic',
        status: 'pending', reason: 'Für diese Konfigurationsversion liegt noch keine Diagnose vor. Der nächste Messzyklus muss die neue Zuordnung prüfen.',
        timestamp: null, measurements: null, groups: [], participants: [], budget: null,
        activationSupported: false, writesPerformed: 0,
    };
}
/** Liefert ausschließlich Installer-Diagnose; ein alter Status wird nicht frisch datiert. */
function nvpPublicSnapshot(adapter) {
    const config = currentNvpConfig(adapter);
    return {
        ok: true, config, status: nvpCurrentStatus(adapter, config),
        devices: nvpDeviceInventory((0, config_boundary_contracts_1.record)(adapter.config)),
        locked: !!(adapter._nwMeshAppSaveInProgress || (0, config_boundary_contracts_1.record)(adapter._nwNvpTopologyStatus).locked),
        activationSupported: false, activationBlockedReasons: [{ ...ACTIVE_BLOCK }],
    };
}
/** Alle Endpunkte verwenden dieselbe serverseitige Installer-/Adminprüfung wie das AppCenter. */
function registerNvpConfigApi(app, adapter, requireInstaller, hooks) {
/**
 * Code-Teil: noStore
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const noStore = (res) => res.setHeader('Cache-Control', 'no-store');
/**
 * Code-Teil: failure
 *
 * Zweck:
 * Automatisch markierter Arrow-Funktion-Abschnitt aus der ursprünglichen JavaScript-Datei.
 * Dieser Kommentar dient als Orientierung für die schrittweise TypeScript-Migration.
 *
 * Zusammenhang:
 * Die produktive Logik liegt aktuell noch in der JS-Datei. Dieser TS-Spiegel zeigt,
 * welcher konkrete Code-Abschnitt später typisiert, getestet und übernommen werden muss.
 */
    const failure = (res, error) => { const result = (0, http_error_boundary_1.safeConfigurationFailure)(error); return res.status(result.status).json(result.body); };
    app.get('/api/nvp/topology', requireInstaller, (_req, res) => { noStore(res); return res.json(nvpPublicSnapshot(adapter)); });
    app.get('/api/nvp/status', requireInstaller, (_req, res) => { noStore(res); return res.json({ ok: true, status: nvpCurrentStatus(adapter) }); });
    app.post('/api/nvp/topology/diagnose', requireInstaller, async (req, res) => {
        noStore(res);
        try {
            if (!(0, config_boundary_contracts_1.isRecord)(req.body) || !(0, config_boundary_contracts_1.own)(req.body, 'config'))
                throw nvpError(400, 'NVP_CONFIG_REQUIRED', 'Eine vollständige NVP-Konfiguration ist erforderlich.');
            const validation = await validateNvpCandidate(adapter, req.body.config);
            const previewAvailable = validation.valid && typeof adapter._nwPreviewNvpTopology === 'function';
            const status = previewAvailable && adapter._nwPreviewNvpTopology ? await adapter._nwPreviewNvpTopology(validation.config) : null;
            return res.json({ ok: true, preview: true, validation, status, previewAvailable });
        }
        catch (error) {
            return failure(res, error);
        }
    });
    app.post('/api/nvp/topology/config', requireInstaller, async (req, res) => {
        noStore(res);
        const token = hooks.beginSave();
        if (!token)
            return res.status(409).json({ ok: false, error: 'CONFIG_SAVE_IN_PROGRESS', message: 'Konfiguration wird bereits gespeichert.' });
        try {
            if (!(0, config_boundary_contracts_1.isRecord)(req.body) || !(0, config_boundary_contracts_1.own)(req.body, 'config'))
                throw nvpError(400, 'NVP_CONFIG_REQUIRED', 'Eine vollständige NVP-Konfiguration ist erforderlich.');
            const config = await prepareNvpChange(adapter, req.body.config, req.body.expectedConfigVersion);
            await hooks.commit(config);
            return res.json(nvpPublicSnapshot(adapter));
        }
        catch (error) {
            return failure(res, error);
        }
        finally {
            hooks.endSave(token);
        }
    });
}
module.exports = { ACTIVE_BLOCK, currentNvpConfig, nvpDeviceInventory, resolveNvpSource, validateNvpCandidate,
    prepareNvpChange, assertNvpPersistence, assertNvpTransitionIdle, nvpCurrentStatus, nvpPublicSnapshot, registerNvpConfigApi };
