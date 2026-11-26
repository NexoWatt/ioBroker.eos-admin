/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/installer-lifecycle.ts
 * Quell-Hash: sha256:b6fb03d371839579e04a18d6a993414a41fdca9588fd143722c6174b39eae153
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/installer-lifecycle.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installerRevision = installerRevision;
exports.assertInstallerRevision = assertInstallerRevision;
exports.provisionInstallerObjects = provisionInstallerObjects;
exports.awaitEmsTransition = awaitEmsTransition;
exports.assertDeviceAppActivations = assertDeviceAppActivations;
exports.numericMeasurement = numericMeasurement;
exports.activeDeviceProfileReferences = activeDeviceProfileReferences;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Schützt AppCenter-Zuordnungen vor veralteten Speicherformularen und
 * legt fehlende eigene Datenpunktobjekte vor der Laufzeitübernahme an.
 * Daten und Wirkung: Eine flüchtig geschützte HMAC-Revision verlässt den Server,
 * niemals Konfigurationswerte oder der HMAC-Schlüssel. Pro Objektgruppe gibt es
 * höchstens zwei Versuche; fehlende Messwerte bleiben ohne künstlichen Nullwert.
 * Zusammenhang: Automatische Gerätezuordnung und manuelles Speichern verwenden
 * denselben AppCenter-Mutationsschutz. Keine App oder Stellfreigabe wird erteilt.
 * Bei Änderungen: Veraltete nichtleere Listen, Ownership-Verlust, fehlgeschlagene
 * Objektanlage und unveränderte Kundenwerte prüfen; Neustarts verwerfen alte Revisionen.
 */
const node_crypto_1 = require("node:crypto");
const http_error_boundary_1 = require("./http-error-boundary");
const revisionSecret = (0, node_crypto_1.randomBytes)(32);
function record(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function canonical(value) {
    if (Array.isArray(value))
        return value.map(canonical);
    if (value !== null && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
    }
    return value;
}
/** Stable within this runtime across key ordering; restart invalidates old forms.
 * An ephemeral HMAC key prevents public revisions from becoming a secret-value guessing oracle. */
function installerRevision(patch) {
    return (0, node_crypto_1.createHmac)('sha256', revisionSecret).update(JSON.stringify(canonical(record(patch)))).digest('hex');
}
/** Older clients remain compatible until automatic bindings need protection.
 * Once present, a missing or stale token must never replace a newer nonempty row list. */
function assertInstallerRevision(expected, patch) {
    const bindings = record(record(record(patch).eosDeviceEms).bindings);
    const settings = record(record(patch).settingsConfig);
    const ocppRows = settings.evcsList;
    const required = Object.keys(bindings).length > 0 || (Array.isArray(ocppRows)
        && ocppRows.some(row => record(record(row).ocppDiscovery).source === 'nexowatt-ocpp21'))
        || (Array.isArray(settings.ocppExcludedStationRoots) && settings.ocppExcludedStationRoots.length > 0);
    if ((expected === undefined || expected === null) && !required)
        return;
    if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected) || expected !== installerRevision(patch)) {
        throw (0, http_error_boundary_1.createPublicHttpError)(409, 'EOS_INSTALLER_CONFIG_CHANGED', 'Die EMS-Zuordnung wurde inzwischen geändert. Deine Eingaben bleiben erhalten. Bitte den aktuellen Stand über „Neu laden“ laden und die Änderungen vergleichen, bevor du erneut speicherst.');
    }
}
/** Bounded retries tolerate a transient controller failure. No deletion, state reset or detached work. */
async function provisionInstallerObjects(options) {
    for (const step of options.steps) {
        let completed = false;
        for (let attempt = 0; attempt < 2; attempt++) {
            if (!options.canWrite())
                throw (0, http_error_boundary_1.createPublicHttpError)(409, 'EOS_UI_OWNERSHIP_REQUIRED', 'Die Systemfreigabe ist nicht mehr gültig. Einstellungen wurden nicht neu übernommen.');
            try {
                await step();
                completed = true;
                break;
            }
            catch { /* Retry only idempotent object creation. */ }
        }
        if (!completed)
            throw (0, http_error_boundary_1.createPublicHttpError)(503, 'EOS_EMS_OBJECT_PROVISION_FAILED', 'Die benötigten EMS-Datenpunktobjekte konnten nicht angelegt werden. Es wurde kein erfolgreicher Abschluss gemeldet; Verbindung prüfen und erneut speichern.');
    }
}
/** A timed-out old cycle remains fenced; callers must not start its replacement.
 * The pending operation is still observed, so a late failure is never unhandled. */
async function awaitEmsTransition(operation, timeoutMs = 5000) {
    const budget = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(5000, Math.round(timeoutMs))) : 5000;
    let timer;
    const timeout = new Promise((_resolve, reject) => {
        timer = setTimeout(() => { reject(new Error('EOS_EMS_CONFIG_WAIT_TIMEOUT')); }, budget);
    });
    try {
        await Promise.race([operation, timeout]);
    }
    finally {
        if (timer !== undefined)
            clearTimeout(timer);
    }
}
/** New device commissioning cannot silently promise an app denied by the live license. */
function assertDeviceAppActivations(current, planned, allowed) {
    const before = record(record(record(current).emsApps).apps);
    const after = record(record(record(planned).emsApps).apps);
    for (const [id, value] of Object.entries(after)) {
        const app = record(value);
        const previous = record(Reflect.get(before, id));
        if (app.installed === true && app.enabled === true &&
            (previous.installed !== true || previous.enabled !== true) && !allowed(id)) {
            throw (0, http_error_boundary_1.createPublicHttpError)(403, 'EOS_EMS_APP_LICENSE_REQUIRED', 'Die gewählte EMS-Funktion ist durch die aktuelle Systemfreigabe nicht verfügbar. Die Gerätezuordnung wurde nicht als aktiv übernommen.');
        }
    }
}
/** Measurements are numbers, never coerced boolean states, missing values or collections. */
function numericMeasurement(value) {
    if (typeof value !== 'number' && typeof value !== 'string')
        return null;
    if (typeof value === 'string' && value.trim() === '')
        return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}
/** Collect only active controller sections, excluding pure UI links and disabled rows.
 * Values remain exact object IDs. The hosted bridge resolves aliases with bounded reads.
 * This prevents replacing a protocol/profile beneath a running controller. */
function activeDeviceProfileReferences(value) {
    const config = record(value);
    const apps = record(record(config.emsApps).apps);
    const active = (id, flag) => {
        const stored = record(Reflect.get(apps, id));
        return Object.keys(stored).length > 0 ? stored.installed === true && stored.enabled === true : Reflect.get(config, flag) === true;
    };
    const singleStorage = record(config.storage);
    const singleActive = active('storage', 'enableStorageControl') && !(record(singleStorage._eosDevice).v === 1 && singleStorage.enabled === false);
    const read = new Set();
    const write = new Set();
    const writeKey = /(?:write|^set|^target|^output(?:Object)?Id$|^(?:pv)?feedInLimit|^pvLimit|^runObjectId$|^maxChargeObjectId$|^maxDischargeObjectId$|^phaseSwitchId$|^chargeEnableObjectId$|^dischargeEnableObjectId$|^feneconGridSetpoint|^e3dcSetPower|^enableId$)/i;
    let visited = 0;
    const walk = (item, depth = 0) => {
        if (depth > 12 || ++visited > 20000)
            throw new Error('EOS_DEVICES_PROFILE_CHECK_UNAVAILABLE');
        if (Array.isArray(item)) {
            for (const row of item)
                walk(row, depth + 1);
            return;
        }
        const row = record(item);
        if (row.enabled === false)
            return;
        for (const [key, child] of Object.entries(row)) {
            if (key === '_eosDevice' || key === 'eosDeviceEms')
                continue;
            if (typeof child === 'string' && /(?:Id|ObjectId)$/.test(key) && child.length > 0 && child.length <= 512) {
                (writeKey.test(key) ? write : read).add(child);
            }
            else if (child !== null && typeof child === 'object')
                walk(child, depth + 1);
        }
    };
    if (active('charging', 'enableChargingManagement'))
        walk(record(config.settingsConfig).evcsList);
    if (active('peak', 'enablePeakShaving') || record(record(config.peakShaving).atypical).enabled === true)
        walk(config.peakShaving);
    // The established legacy single-storage contract is app-authoritative.
    if (singleActive)
        walk({ ...singleStorage, enabled: true });
    if (active('storagefarm', 'enableStorageFarm'))
        walk({ ...record(config.storageFarm), enabled: true });
    if (active('dynamicGrid', 'enableDynamicGrid'))
        walk(config.dynamicGridConnection);
    for (const [appId, flag, sections] of [
        ['thermal', 'enableThermalControl', ['thermal', 'thermalControl']],
        ['heatingrod', 'enableHeatingRodControl', ['heatingRod']],
        ['threshold', 'enableThresholdControl', ['threshold']],
        ['generator', 'enableGeneratorControl', ['generator']],
        ['bhkw', 'enableBhkwControl', ['bhkw']],
        ['relay', 'enableRelayControl', ['relay']],
    ])
        if (active(appId, flag))
            for (const section of sections)
                walk(Reflect.get(config, section));
    // Grid protection is a mandatory controller. Profile changes require unmapping
    // its actual measurement/actuator first, never disabling protection itself.
    walk(config.gridConstraints);
    walk(config.nvpTopology);
    const datapoints = record(config.datapoints);
    for (const key of ['gridPointPower', 'gridPointPowerRaw', 'gridBuyPower', 'gridSellPower', 'gridPointImportPower', 'gridPointExportPower', 'gridPointConnected', 'gridPointWatchdog']) {
        const id = Reflect.get(datapoints, key);
        if (typeof id === 'string' && id.length > 0 && id.length <= 512)
            read.add(id);
    }
    // These global measurement keys are real runtime fallbacks for enabled
    // battery/charging controllers, not merely display references in that case.
    const controllerMeasurementKeys = [];
    if (singleActive)
        controllerMeasurementKeys.push('batteryPower', 'storageChargePower', 'storageDischargePower', 'storageSoc', 'storageCapacityKwh');
    if (singleActive || active('storagefarm', 'enableStorageFarm') || active('charging', 'enableChargingManagement'))
        controllerMeasurementKeys.push('pvPower');
    for (const key of controllerMeasurementKeys) {
        const id = Reflect.get(datapoints, key);
        if (typeof id === 'string' && id.length > 0 && id.length <= 512)
            read.add(id);
    }
    const slots = record(record(config.vis).flowSlots);
    for (const slot of Array.isArray(slots.consumers) ? slots.consumers : []) {
        const ctrl = record(record(slot).ctrl);
        if (ctrl.enabled === true)
            walk(ctrl);
    }
    if (read.size + write.size > 1024)
        throw new Error('EOS_DEVICES_PROFILE_CHECK_UNAVAILABLE');
    return { read: [...read], write: [...write] };
}
