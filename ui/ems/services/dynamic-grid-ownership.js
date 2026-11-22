/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/ems/services/dynamic-grid-ownership.ts
 * Quell-Hash: sha256:de8ed1ac2352d1bcf19b6c590e3db13a4920c46fd915ca95708616265405cfc7
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für ems/services/dynamic-grid-ownership.js.
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
exports.dynamicGridHasControl = dynamicGridHasControl;
exports.getDynamicGridOwnedTargets = getDynamicGridOwnedTargets;
exports.hasCompleteDynamicGridOwnership = hasCompleteDynamicGridOwnership;
exports.isDynamicGridOwned = isDynamicGridOwned;
exports.isDynamicGridWriter = isDynamicGridWriter;
exports.isDynamicGridEmergencyWriter = isDynamicGridEmergencyWriter;
exports.checkDynamicGridWriteTarget = checkDynamicGridWriteTarget;
const STORAGE_OUTPUTS = ['signedTarget', 'chargeTarget', 'dischargeTarget', 'maxCharge', 'maxDischarge', 'run', 'chargeEnable', 'dischargeEnable', 'watchdog'];
/** Gibt aktive und bis zur bestätigten Übergabe zurückgehaltene Verträge zurück. */
function ownershipConfigs(adapter) {
    if (!adapter)
        return [];
    const config = adapter.config || {};
    const app = config.emsApps?.apps?.dynamicGrid;
    const runtime = adapter._nwDynamicGridConnectionRuntime || {};
    const configs = [];
    if (app?.installed === true && app?.enabled === true && config.dynamicGridConnection)
        configs.push(config.dynamicGridConnection);
    for (const retained of Array.isArray(runtime.retainedConfigs) ? runtime.retainedConfigs : []) {
        if (retained && typeof retained === 'object')
            configs.push(retained.config || retained);
    }
    if (runtime.lifecycleOwnershipConfig)
        configs.push(runtime.lifecycleOwnershipConfig);
    if (adapter._nwDynamicGridOwnershipPending)
        configs.push(adapter._nwDynamicGridOwnershipPending);
    return configs;
}
/** App übernimmt auch vor dem ersten Messzyklus; Altregler erzeugen keinen Nullstopp. */
function dynamicGridHasControl(adapter) {
    const app = adapter?.config?.emsApps?.apps?.dynamicGrid;
    return (app?.installed === true && app?.enabled === true) || ownershipConfigs(adapter).length > 0;
}
/** Liefert ausschließlich Ausgänge einschließlich kompletter Alias-Schreibketten. */
function getDynamicGridOwnedTargets(adapter) {
    const targets = new Set();
    const add = (raw) => {
        if (typeof raw !== 'string' || !raw.trim())
            return;
        const id = raw.trim();
        if (targets.has(id))
            return;
        targets.add(id);
        const canonical = adapter?._nwDynamicGridCanonicalTargets?.[id];
        for (const next of Array.isArray(canonical) ? canonical : [canonical]) {
            if (typeof next === 'string' && next.trim())
                targets.add(next.trim());
        }
    };
    for (const config of ownershipConfigs(adapter)) {
        for (const storage of Array.isArray(config.storages) ? config.storages : []) {
            for (const key of STORAGE_OUTPUTS)
                add(storage?.command?.[key]?.stateId);
        }
        for (const pv of Array.isArray(config.pvAssignments) ? config.pvAssignments : [])
            add(pv?.command?.stateId);
    }
    return targets;
}
/** Unbekannte eigene Alias-Schreibseiten dürfen keine Lücke für Fremdschreiber öffnen. */
function hasCompleteDynamicGridOwnership(adapter) {
    const cache = adapter?._nwDynamicGridCanonicalTargets || {};
    const complete = (id) => {
        if (typeof id !== 'string' || !id.trim())
            return false;
        const chain = cache[id.trim()];
        return typeof chain === 'string' ? !!chain.trim()
            : Array.isArray(chain) && chain.length > 0 && chain.every((part) => typeof part === 'string' && part.trim());
    };
    for (const config of ownershipConfigs(adapter)) {
        for (const storage of Array.isArray(config.storages) ? config.storages : []) {
            for (const key of STORAGE_OUTPUTS)
                if (storage?.command?.[key] && !complete(storage.command[key].stateId))
                    return false;
        }
        for (const pv of Array.isArray(config.pvAssignments) ? config.pvAssignments : [])
            if (!complete(pv?.command?.stateId))
                return false;
    }
    return true;
}
/** Prüft auch eine konkurrierende Aliasadresse, die dieselbe Schreibquelle trifft. */
function isDynamicGridOwned(adapter, targetId) {
    if (typeof targetId !== 'string')
        return false;
    const targets = getDynamicGridOwnedTargets(adapter);
    if (targets.has(targetId.trim()))
        return true;
    const canonical = adapter?._nwDynamicGridCanonicalTargets?.[targetId.trim()];
    return (Array.isArray(canonical) ? canonical : [canonical]).some((id) => typeof id === 'string' && targets.has(id));
}
/** Nur der zentrale Writer und ausdrücklich ausgewiesene Notstopps dürfen schreiben. */
function isDynamicGridWriter(owner) {
    return typeof owner === 'string' && /^dynamicGridConnection(?:\.|$)/.test(owner.trim());
}
function isDynamicGridEmergencyWriter(owner) {
    return typeof owner === 'string' && /^(?:emergency|hardware-stop|notstop)(?:[.:-]|$)/i.test(owner.trim());
}
const aliasJobs = new WeakMap();
/**
 * Prüft freie API-Aliasse vor einem echten Write. Auflösung maximal acht Kanten,
 * 1 s Gesamtbudget und 16 noch laufende Jobs je Adapter; Timeout startet keinen
 * unbegrenzten Ersatzjob. Ein unaufgelöster Schreibweg wird nicht freigegeben.
 */
async function checkDynamicGridWriteTarget(adapter, targetId) {
    if (!dynamicGridHasControl(adapter))
        return { owned: false, unresolved: false };
    if (isDynamicGridOwned(adapter, targetId))
        return { owned: true, unresolved: false };
    if (!hasCompleteDynamicGridOwnership(adapter))
        return { owned: false, unresolved: true };
    if (typeof adapter.getForeignObjectAsync !== 'function')
        return { owned: false, unresolved: true };
    let jobs = aliasJobs.get(adapter);
    if (!jobs) {
        jobs = new Map();
        aliasJobs.set(adapter, jobs);
    }
    let job = jobs.get(targetId);
    if (!job) {
        if (jobs.size >= 16)
            return { owned: false, unresolved: true };
        job = (async () => {
            const chain = [];
            let id = targetId;
            for (let depth = 0; depth <= 8; depth += 1) {
                if (chain.includes(id))
                    return null;
                chain.push(id);
                const object = await adapter.getForeignObjectAsync(id);
                if (!object || object.type !== 'state')
                    return null;
                const alias = object.common?.alias?.id;
                const next = typeof alias === 'string' ? alias : alias?.write;
                if (!alias)
                    return chain;
                if (typeof next !== 'string' || !next.trim())
                    return null;
                id = next.trim();
            }
            return null;
        })().catch(() => null);
        jobs.set(targetId, job);
        void job.finally(() => { if (jobs.get(targetId) === job)
            jobs.delete(targetId); });
    }
    let timer;
    const chain = await Promise.race([job, new Promise((resolve) => { timer = setTimeout(() => resolve(null), 1000); })]);
    if (timer !== undefined)
        clearTimeout(timer);
    if (!chain)
        return { owned: false, unresolved: true };
    const cache = adapter._nwDynamicGridCanonicalTargets || (adapter._nwDynamicGridCanonicalTargets = Object.create(null));
    cache[targetId] = chain;
    return { owned: isDynamicGridOwned(adapter, targetId), unresolved: false };
}
