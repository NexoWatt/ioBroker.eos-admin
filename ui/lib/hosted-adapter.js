/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/hosted-adapter.ts
 * Quell-Hash: sha256:b17e810e87a0c223a1a906b5d68ddbdde7be60bbb67546b8c1f8690e96d2f654
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/hosted-adapter.js.
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
 * Aufgabe: Bindet die eingebettete UI an EOS und bewahrt bei bestätigter Migration den alten Datenpunkt-Namespace.
 * Daten und Wirkung: Eine Adapterinstanz, unveränderte History-/Alias-IDs, zentraler Lizenz-/Schreibschutz, begrenzt erfasste Host-Schreibaufträge und verschlüsselte Konfiguration.
 * Bei Änderungen: Namespace-, Credential-, Lizenz- und Schreibschutz sowie die Migrations- und HTTP-Regressionsprüfungen erhalten.
 * Grenze: Namespaces kommen ausschließlich aus der geschützten Migrationsablage; Browserwerte erweitern keine Rechte.
 */
'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const node_module_1 = require("node:module");
const runtimeRequire = (0, node_module_1.createRequire)(__filename);
const packagedDefaults = runtimeRequire('../io-package.json');
const defaults = record(packagedDefaults) ? packagedDefaults.native : undefined;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function merge(base, overlay) {
    const copy = clone(record(base) ? base : {});
    if (!record(copy))
        throw new Error('EOS_UI_CONFIG_INVALID');
    if (!record(overlay))
        return copy;
    for (const [key, value] of Object.entries(overlay)) {
        if (FORBIDDEN_KEYS.has(key))
            throw new Error('EOS_UI_CONFIG_INVALID');
        const old = Reflect.get(copy, key);
        Reflect.set(copy, key, record(value) ? merge(record(old) ? old : {}, value) : clone(value));
    }
    return copy;
}
function retainedNamespace(owner) {
    const migration = owner.config.eosUiMigration;
    return record(migration) && migration.preserveNamespace === true && typeof migration.source === 'string'
        && /^nexowatt-ui\.\d+$/.test(migration.source) ? migration.source : owner.namespace;
}
const LOCAL_METHODS = new Map([
    ['getObject', 'getForeignObject'], ['getObjectAsync', 'getForeignObjectAsync'],
    ['getState', 'getForeignState'], ['getStateAsync', 'getForeignStateAsync'], ['getStates', 'getForeignStates'], ['getStatesAsync', 'getForeignStatesAsync'],
    ['setObject', 'setForeignObject'], ['setObjectAsync', 'setForeignObjectAsync'],
    ['setObjectNotExists', 'setForeignObjectNotExists'], ['setObjectNotExistsAsync', 'setForeignObjectNotExistsAsync'],
    ['extendObject', 'extendForeignObject'], ['extendObjectAsync', 'extendForeignObjectAsync'],
    ['delObject', 'delForeignObject'], ['delObjectAsync', 'delForeignObjectAsync'],
    ['setState', 'setForeignState'], ['setStateAsync', 'setForeignStateAsync'],
    ['setStateChanged', 'setForeignStateChanged'], ['setStateChangedAsync', 'setForeignStateChangedAsync'],
    ['delState', 'delForeignState'], ['delStateAsync', 'delForeignStateAsync'],
    ['subscribeStates', 'subscribeForeignStates'], ['subscribeStatesAsync', 'subscribeForeignStatesAsync'],
    ['unsubscribeStates', 'unsubscribeForeignStates'], ['unsubscribeStatesAsync', 'unsubscribeForeignStatesAsync'],
    ['subscribeObjects', 'subscribeForeignObjects'], ['subscribeObjectsAsync', 'subscribeForeignObjectsAsync'],
    ['unsubscribeObjects', 'unsubscribeForeignObjects'], ['unsubscribeObjectsAsync', 'unsubscribeForeignObjectsAsync'],
]);
const GUARDED_WRITES = new Set(['setForeignState', 'setForeignStateAsync', 'setForeignStateChanged', 'setForeignStateChangedAsync']);
const MAX_PENDING_HOST_WRITES = 1024;
function thenable(value) {
    return (typeof value === 'object' && value !== null || typeof value === 'function')
        && typeof Reflect.get(value, 'then') === 'function';
}
class HostedAdapter {
    constructor({ owner, bridge }) {
        this.pendingHostWrites = new Set();
        this.hostWritesStopped = false;
        if (!owner || !/^eos-admin\.\d+$/.test(owner.namespace || '') || !bridge
            || typeof bridge.resolveAccess !== 'function' || typeof bridge.getLicense !== 'function'
            || typeof bridge.canWrite !== 'function' || typeof bridge.originAllowed !== 'function')
            throw new Error('EOS_UI_BRIDGE_INVALID');
        const namespace = retainedNamespace(owner);
        Object.defineProperties(this, {
            _owner: { value: owner }, _bridge: { value: bridge },
            namespace: { value: namespace }, hostNamespace: { value: owner.namespace },
            name: { value: namespace.split('.')[0] }, instance: { value: Number(namespace.split('.').at(-1)) },
        });
        this.config = merge(defaults, owner.config.eosUi || {});
        delete this.config.licenseKey;
        this.config.auth = { mode: 'eos' };
        this.config.port = owner.config.port;
        const bound = new Map();
        return new Proxy(this, {
            get(target, key, receiver) {
                if (Reflect.has(target, key))
                    return Reflect.get(target, key, receiver);
                const foreign = typeof key === 'string' ? LOCAL_METHODS.get(key) : undefined;
                if (foreign && (target.namespace !== owner.namespace || GUARDED_WRITES.has(foreign))) {
                    if (!bound.has(key)) {
                        const method = Reflect.get(GUARDED_WRITES.has(foreign) ? target : owner, foreign);
                        const context = GUARDED_WRITES.has(foreign) ? target : owner;
                        if (typeof method !== 'function')
                            throw new Error('EOS_UI_MIGRATION_API_UNAVAILABLE');
                        bound.set(key, (id, ...args) => {
                            if (typeof id !== 'string' || !id || id.length > 512)
                                throw new Error('EOS_UI_STATE_ID');
                            const full = id.startsWith(`${target.namespace}.`) ? id : `${target.namespace}.${id}`;
                            const result = Reflect.apply(method, context, [full, ...args]);
                            return result;
                        });
                    }
                    return bound.get(key);
                }
                const value = Reflect.get(owner, key);
                if (typeof value !== 'function')
                    return value;
                if (!bound.has(key)) {
                    const boundMethod = value.bind(owner);
                    bound.set(key, boundMethod);
                }
                return bound.get(key);
            },
        });
    }
    /** Aufgabe: Schließt die Schreibannahme und bestätigt alle bereits an den Controller übergebenen Aufträge.
     * Wirkung: Kein Timeout-Erfolg; die äußere Stop-Deadline bewertet ausbleibende Promise-/Callback-Bestätigungen als unklar. */
    stopStateWrites() {
        this.hostWritesStopped = true;
        return Promise.all([...this.pendingHostWrites]).then(() => { });
    }
    /** Aufgabe: Erfasst einen Auftrag ohne Warteschlange oder Wiederholung.
     * Zusammenhang: Die Menge ist begrenzt; nur bestätigte Controller-Abschlüsse entfernen einen Auftrag. */
    beginHostWrite() {
        if (this.hostWritesStopped || this._bridge.canWrite() !== true)
            throw new Error('EOS_UI_OWNERSHIP_LOST');
        if (this.pendingHostWrites.size >= MAX_PENDING_HOST_WRITES)
            throw new Error('EOS_UI_WRITES_BUSY');
        let complete = () => { };
        const pending = new Promise(resolve => { complete = resolve; });
        this.pendingHostWrites.add(pending);
        let finished = false;
        return () => {
            if (finished)
                return;
            finished = true;
            this.pendingHostWrites.delete(pending);
            complete();
        };
    }
    /** Aufgabe: Behält die originale Async-Rückgabe und beobachtet deren vollständigen Abschluss. */
    writeAsync(method, id, args) {
        let complete;
        try {
            complete = this.beginHostWrite();
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error : new Error('EOS_UI_WRITE_FAILED'));
        }
        try {
            const returned = this._owner[method](id, ...args);
            if (!thenable(returned))
                return Promise.reject(new Error('EOS_UI_WRITE_COMPLETION_UNKNOWN'));
            void returned.then(complete, complete);
            return returned;
        }
        catch (error) {
            return Promise.reject(error instanceof Error ? error : new Error('EOS_UI_WRITE_COMPLETION_UNKNOWN'));
        }
    }
    /** Aufgabe: Beobachtet Callback-Abschluss oder eine tatsächliche Promise-Rückgabe ohne das Controller-API zu ersetzen.
     * Wirkung: Rückgabewert, Callback-Argumente und Callback-Kontext bleiben erhalten; fehlende Bestätigung bleibt offen. */
    writeCallback(method, id, args) {
        let complete;
        try {
            complete = this.beginHostWrite();
        }
        catch (error) {
            return deniedWrite(args, error);
        }
        const forwarded = [...args];
        const originalCallback = typeof forwarded.at(-1) === 'function' ? forwarded.pop() : undefined;
        // Explizit ausgelassene optionale Argumente dürfen den angehängten Callback nicht aus seinem Overload schieben.
        while (forwarded.length && forwarded.at(-1) === undefined)
            forwarded.pop();
        let callbackCompleted = false;
        let returnedKnown = false;
        let waitsForPromise = false;
        let returnSettled = false;
        const confirm = () => {
            if (returnedKnown && callbackCompleted && (!waitsForPromise || returnSettled))
                complete();
        };
        forwarded.push(function completedCallback(...result) {
            callbackCompleted = true;
            confirm();
            const callbackResult = typeof originalCallback === 'function' ? Reflect.apply(originalCallback, this, result) : undefined;
            return callbackResult;
        });
        try {
            const returned = this._owner[method](id, ...forwarded);
            waitsForPromise = thenable(returned);
            returnedKnown = true;
            if (waitsForPromise) {
                const returnedDone = () => { returnSettled = true; confirm(); };
                void Promise.resolve(returned).then(returnedDone, returnedDone);
            }
            else
                confirm();
            return returned;
        }
        catch (error) {
            // Eine Ausnahme nach möglicher Übergabe ist ohne Completion-Callback kein Stop-Nachweis.
            if (callbackCompleted)
                complete();
            throw error;
        }
    }
    ownsLocalNamespace() { return this.namespace === retainedNamespace(this._owner); }
    async getForeignObjectAsync(id, ...args) {
        const own = id === `system.adapter.${this.namespace}`;
        const object = await this._owner.getForeignObjectAsync(own ? `system.adapter.${this._owner.namespace}` : id, ...args);
        if (!own || !object)
            return object;
        return { ...object, _id: id, native: merge(defaults, this._owner.config.eosUi || {}) };
    }
    async setForeignObjectAsync(id, object, ...args) {
        if (id !== `system.adapter.${this.namespace}`)
            return this._owner.setForeignObjectAsync(id, object, ...args);
        const actual = await this._owner.getForeignObjectAsync(`system.adapter.${this._owner.namespace}`);
        if (!actual || !record(object?.native))
            throw new Error('EOS_UI_CONFIG_INVALID');
        const next = merge({}, object.native);
        delete next.licenseKey;
        delete next.auth;
        delete next.port;
        delete next.secure;
        if (this._owner.eosMigration?.saveUi)
            await this._owner.eosMigration.saveUi(next);
        else if (this.namespace !== this._owner.namespace)
            throw new Error('EOS_UI_MIGRATION_STORE_UNAVAILABLE');
        else
            await this._owner.setForeignObjectAsync(id, { ...actual, native: { ...actual.native, eosUi: next } }, ...args);
        this._owner.config.eosUi = clone(next);
        return undefined;
    }
    setForeignStateAsync(id, ...args) {
        return this.writeAsync('setForeignStateAsync', id, args);
    }
    setForeignStateChangedAsync(id, ...args) {
        return this.writeAsync('setForeignStateChangedAsync', id, args);
    }
    setForeignStateChanged(id, ...args) {
        return this.writeCallback('setForeignStateChanged', id, args);
    }
    setForeignState(id, ...args) {
        return this.writeCallback('setForeignState', id, args);
    }
}
function deniedWrite(args, error) {
    const callback = args.at(-1);
    if (typeof callback === 'function') {
        Reflect.apply(callback, undefined, [error]);
        return;
    }
    throw error;
}
/** Public snapshot only; editions/limits never originate from UI config/states. */
function centralLicenseSnapshot(bridge) {
    let raw;
    try {
        raw = bridge.getLicense();
    }
    catch {
        raw = null;
    }
    const state = record(raw) ? raw : {};
    const limits = record(state.limits) ? state.limits : {};
    const chargePoints = typeof limits.chargePoints === 'number' ? limits.chargePoints : 0;
    const batteries = typeof limits.batteries === 'number' ? limits.batteries : -1;
    const valid = state.valid === true && state.coreEnabled === true
        && (state.edition === 'home' || state.edition === 'pro') && Array.isArray(state.features)
        && Number.isInteger(chargePoints) && chargePoints > 0 && Number.isInteger(batteries) && batteries >= 0;
    return {
        ok: valid, edition: valid ? (state.edition === 'home' ? 'hems' : 'eos') : 'none',
        type: valid ? 'full' : 'none', uuid: typeof state.uuid === 'string' ? state.uuid : '',
        msg: valid ? 'Zentrale EOS-Lizenz aktiv' : 'Zentrale EOS-Lizenz erforderlich',
        maxWallboxes: valid ? chargePoints : 0, maxStorages: valid ? batteries : 0,
        grants: valid && Array.isArray(state.features) ? state.features.filter((item) => typeof item === 'string') : [],
        expiresAt: valid && typeof state.expiresAt === 'number' ? state.expiresAt : 0,
    };
}
const ROLE_CAPABILITIES = new Map([
    ['admin', ['*']],
    ['installer', ['frontend.open', 'appcenter.open', 'mapping.edit', 'chargepoints.configure', 'mesh.configure',
            'exportGuard.configure', 'smarthome.configure', 'nexologic.configure', 'diagnostics.open', 'energyWallet.customerSettings']],
    ['customer', ['frontend.open', 'energyWallet.customerSettings']],
]);
/** No request headers carry identity. Every HTTP/SSE check calls the host authority. */
async function centralAccess(bridge, req) {
    const none = { authenticated: false, user: null, role: 'none', roles: [], groups: [], capabilities: [],
        isAdmin: false, isInstaller: false, isCustomer: false };
    const value = await bridge.resolveAccess(req);
    // Only the parent IPC authority can supply this identity. It has no ioBroker
    // account and cannot inherit technical/customer-settings capabilities.
    if (record(value) && value.kiosk === true && value.authenticated === true
        && value.user === null && value.userId === null && value.role === 'customer'
        && value.mustChangePassword === false && value.activationRequired === false
        && typeof value.csrfToken === 'string' && /^[a-f0-9]{64}$/.test(value.csrfToken)
        && value.credentialKey === value.csrfToken
        && Array.isArray(value.capabilities) && value.capabilities.length === 1 && value.capabilities[0] === 'frontend.open') {
        return { ...value, capabilities: ['frontend.open'], roles: ['customer'], groups: [],
            isAdmin: false, isInstaller: false, isCustomer: true };
    }
    if (!record(value) || value.authenticated !== true || value.mustChangePassword === true
        || typeof value.user !== 'string' || !/^system\.user\.[A-Za-z0-9_.@-]{1,128}$/.test(value.user)
        || typeof value.role !== 'string' || !ROLE_CAPABILITIES.has(value.role) || typeof value.csrfToken !== 'string'
        || value.csrfToken.length < 16 || typeof value.credentialKey !== 'string' || !value.credentialKey)
        return none;
    const allowed = ROLE_CAPABILITIES.get(value.role) || [];
    const requested = Array.isArray(value.capabilities) ? value.capabilities : [];
    const capabilities = requested.filter((cap) => typeof cap === 'string' && (value.role === 'admin' || allowed.includes(cap)));
    return { ...value, capabilities, roles: [value.role], groups: Array.isArray(value.groups) ? value.groups : [],
        isAdmin: value.role === 'admin', isInstaller: ['admin', 'installer'].includes(value.role), isCustomer: value.role === 'customer' };
}
module.exports = { HostedAdapter, centralLicenseSnapshot, centralAccess };
