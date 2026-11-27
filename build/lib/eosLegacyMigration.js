/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const { createHash, randomUUID } = require('node:crypto');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { performance } = require('node:perf_hooks');
const { EosModuleConfigStore } = require('./eosModuleConfigStore');
const SOURCES = Object.freeze({ ui: 'nexowatt-ui', devices: 'nexowatt-devices', eebus: 'eebus', backup: 'nexowatt-backup', ocpp: 'ocpp21' });
const VERSIONS = Object.freeze({ ui: ['1.0.35', '1.0.36', '1.0.37', '1.0.38'], devices: ['0.5.176'], eebus: ['0.3.0'], backup: ['1.0.10'], ocpp: ['0.4.2', '0.4.3'] });
const { ownPlaceholder, containsCustomerSettings, cleanVersion, sourceMetadata, sourceIdentity, schemaDriven, validJournalSource, uiShape, devicesShape } = require('./eosLegacySource');
const ACL = { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600, state: 0x600 };
const HOST_MAX_AGE_MS = 60000;
const STARTUP_WINDOW_MS = 45000;
// The Devices host has a 120-second absolute metadata-start budget. Migration
// begins before Web/host construction; confirmed object progress may bridge
// that phase, but cannot remove the overall takeover deadline.
const DEVICES_PROGRESS_ALLOWANCE_MS = 120000;
const fail = code => Object.assign(new Error(code), { code });
const record = value => value && typeof value === 'object' && !Array.isArray(value);
function copy(value) {
    const text = JSON.stringify(value);
    if (!text || Buffer.byteLength(text) > 512 * 1024)
        throw fail('EOS_MIGRATION_CONFIG_SIZE');
    const result = JSON.parse(text);
    const visit = (item, depth = 0) => {
        if (depth > 20)
            throw fail('EOS_MIGRATION_CONFIG_DEPTH');
        if (item && typeof item === 'object')
            for (const key of Object.keys(item)) {
                if (['__proto__', 'constructor', 'prototype'].includes(key))
                    throw fail('EOS_MIGRATION_CONFIG_KEY');
                visit(item[key], depth + 1);
            }
    };
    visit(result);
    return result;
}
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nativeHash = object => fingerprint(object.native);
const reviewStamp = object => fingerprint([object.common?.enabled, object.common?.host, object.common?.version, record(object.native) ? nativeHash(object) : null]);
/**
 * A later config/metadata edit can postdate a long-disabled UI. For a local
 * noncompact daemon, js-controller resets sigKill before launch, records its PID,
 * requests a stop with -1, and reports alive=false on exit. The latter must
 * follow the same host's most recent lifecycle marker. Callers check host freshness.
 */
async function hasConfirmedLegacyStop(reader, object, alive) {
    if (object?.common?.enabled !== false || alive?.val !== false || alive.ack !== true ||
        !Number.isSafeInteger(object.ts) || !Number.isSafeInteger(alive.ts) || alive.ts <= 0 || object.ts <= 0)
        return false;
    const moment = Date.now();
    if (alive.ts > moment + 5000 || object.ts > moment + 5000 || (alive.q ?? 0) !== 0)
        return false;
    if (alive.ts >= object.ts)
        return true;
    const host = object.common.host;
    if (!/^system\.adapter\.nexowatt-ui\.\d+$/.test(object._id || '') ||
        object.common.mode !== 'daemon' || object.common.runAsCompactMode === true ||
        typeof host !== 'string' || !host || host !== reader.host || alive.from !== `system.host.${host}`)
        return false;
    const marker = await reader.getForeignStateAsync(`${object._id}.sigKill`);
    if (!marker || marker.from !== alive.from || !Number.isSafeInteger(marker.ts) || marker.ts <= 0 ||
        marker.ts >= alive.ts || (marker.q ?? 0) !== 0)
        return false;
    return (marker.ack === true && Number.isSafeInteger(marker.val) && marker.val > 0 && marker.val <= 2147483647) ||
        (marker.ack === false && marker.val === -1);
}
function decryptNative(owner, object) {
    const native = copy(object.native);
    const protectedFields = object.protectedNative || object.common?.protectedNative || [];
    if (!Array.isArray(protectedFields) || protectedFields.length > 64 || protectedFields.some(field => typeof field !== 'string' || !Object.hasOwn(native, field))) {
        throw fail('EOS_MIGRATION_PROTECTED_FIELDS_UNAVAILABLE');
    }
    const fields = object.encryptedNative || object.common?.encryptedNative || [];
    if (!Array.isArray(fields) || fields.length > 64)
        throw fail('EOS_MIGRATION_ENCRYPTED_FIELDS');
    // ioBroker encryptedNative describes top-level paths. Never guess from secret names
    // or reinterpret a plain protocol password as ciphertext.
    for (const field of fields) {
        if (typeof field !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(field))
            throw fail('EOS_MIGRATION_ENCRYPTED_FIELDS');
        if (native[field] != null && native[field] !== '') {
            if (typeof native[field] !== 'string')
                throw fail('EOS_MIGRATION_CREDENTIAL_INVALID');
            try {
                native[field] = owner.decrypt(native[field]);
            }
            catch {
                throw fail('EOS_MIGRATION_CREDENTIAL_DECRYPTION');
            }
        }
    }
    return native;
}
/**
 * Startup handover with an encrypted journal. Original objects, states, history
 * and files are retained in their original namespace; no unacknowledged command
 * is copied/replayed. Only source common.enabled changes. A preflight failure
 * leaves every old process untouched. A crash before transfer is rolled back on
 * next startup; a transferred handover resumes against the same config objects.
 */
class EosLegacyMigration {
    constructor(owner, options) {
        this.owner = owner;
        this.options = options;
        this.reader = Object.create(owner);
        for (const method of ['getForeignObjectAsync', 'getForeignStateAsync', 'getForeignStatesAsync', 'getObjectViewAsync']) {
            this.reader[method] = (...args) => this.read(Promise.resolve().then(() => owner[method](...args)));
        }
        this.store = new EosModuleConfigStore(owner, { moduleIds: [...Object.keys(SOURCES), 'migration'] });
        this.journal = null;
        this.phase = 'IDLE';
        this.stopped = false;
        this.monitor = null;
        this.startupBlocked = false;
        this.recovery = null;
        this.commitPromise = null;
        this.blockedSources = null;
        this.manualRevision = randomUUID();
        this.operation = { state: 'idle', code: '' };
        this.manualPending = null;
        this.manualScopes = null;
        this.manuallyAllowed = null;
        this.uiSaves = 0;
    }
    read(operation) {
        let timer;
        return Promise.race([operation, new Promise((_, reject) => {
                timer = setTimeout(() => reject(fail('EOS_MIGRATION_DATABASE_TIMEOUT')), Math.min(this.options.readTimeoutMs || 5000, 5000));
            })]).finally(() => clearTimeout(timer));
    }
    allowsStartup(scope) {
        if (this.stopped || this.startupBlocked)
            return false;
        const id = scope === 'ems' ? 'ui' : scope;
        if (id !== undefined && !Object.hasOwn(SOURCES, id))
            return false;
        if (this.manualScopes)
            return id !== undefined && !this.manualScopes.has(id) && this.manuallyAllowed.has(id);
        if (this.phase === 'BLOCKED' && this.blockedSources && id !== undefined)
            return !this.blockedSources.has(id);
        return ['DISABLED', 'NOT_NEEDED', 'TRANSFERRED', 'COMMITTED'].includes(this.phase);
    }
    allowsSupervisorStartup() {
        return this.allowsStartup() || (!this.stopped && !this.startupBlocked && this.phase === 'BLOCKED' && this.blockedSources !== null);
    }
    allowsWrites(scope) { return this.allowsStartup(scope); }
    block(code) { this.phase = 'ROLLBACK_REQUIRED'; this.journal = { ...this.journal, code: code || this.journal?.code || 'EOS_MIGRATION_RECOVERY_REQUIRED' }; }
    envelope(value, migration) {
        const text = JSON.stringify(copy(value));
        const encrypted = this.owner.encrypt(text);
        if (typeof encrypted !== 'string' || !encrypted || encrypted === text)
            throw fail('EOS_MIGRATION_ENCRYPTION');
        return { v: 1, encrypted, ...(migration ? { migration } : {}) };
    }
    decode(envelope) {
        if (envelope?.v !== 1 || typeof envelope.encrypted !== 'string')
            throw fail('EOS_MIGRATION_FORMAT');
        try {
            return copy(JSON.parse(this.owner.decrypt(envelope.encrypted)));
        }
        catch {
            throw fail('EOS_MIGRATION_DECRYPTION');
        }
    }
    async persist(phase) {
        if (this.manualPending && this.stopped)
            throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
        this.phase = phase;
        this.journal = { ...this.journal, v: 1, owner: this.owner.namespace, phase, updatedAt: Date.now() };
        await this.store.save('migration', this.envelope(this.journal));
        await this.publish();
    }
    async publish() {
        const status = this.status();
        try {
            await this.owner.setObjectNotExistsAsync('info.legacyMigration', { type: 'state', common: { name: 'EOS migration status', type: 'string', role: 'json', read: true, write: false }, native: {}, acl: ACL });
            await this.owner.setStateAsync('info.legacyMigration', { val: JSON.stringify(status), ack: true });
        }
        catch {
            this.owner.log.warn('EOS_MIGRATION_STATUS_UNAVAILABLE');
        }
    }
    status() {
        let code = this.journal?.code || '';
        if (this.phase === 'LICENSE_REQUIRED') {
            code = 'EOS_MIGRATION_LICENSE_REQUIRED';
            try {
                const license = this.owner.eosLicenseService?.statusView?.();
                if (license?.valid === true && license.coreEnabled === true)
                    code = this.owner.eosRuntimeControl ? 'EOS_MIGRATION_REVIEW_READY' : 'EOS_MIGRATION_RESTART_REQUIRED';
            }
            catch { /* Diagnostic reads never grant permission or expose license internals. */ }
        }
        return { phase: this.phase, code, sources: (this.journal?.sources || []).map(row => ({ id: row.id, source: row.source,
                ...Object.fromEntries(['sourceVersion', 'instanceVersion', 'adapterVersion', 'versionCode', 'enabled', 'targetEnabled'].filter(field => Object.hasOwn(row, field)).map(field => [field, row[field]])), namespacePreserved: ['TRANSFERRED', 'COMMITTED'].includes(this.phase) })), updatedAt: this.journal?.updatedAt || null,
            ...(this.phase === 'BLOCKED' && this.blockedSources && this.journal?.issues?.length ? { issues: this.journal.issues.map(row => ({ id: row.id, source: row.source, code: row.code })) } : {}) };
    }
    async loadDestinations() {
        for (const id of Object.keys(SOURCES)) {
            const envelope = await this.read(this.store.load(id));
            if (!envelope)
                continue;
            if (id === 'ui') {
                this.owner.config.eosUi = this.decode(envelope);
                this.owner.config.eosUiMigration = envelope.migration || null;
            }
            else
                this.owner.config.eosModules = { ...this.owner.config.eosModules, [id]: envelope };
        }
    }
    async verifyDestinations() {
        for (const row of this.journal.sources) {
            // A committed handover must not fall back to package defaults or a
            // stale instance-native envelope if its protected destination is lost.
            const object = await this.reader.getForeignObjectAsync(this.store.objectId(row.id));
            if (!this.store.inspect(object, row.id))
                throw fail('EOS_MIGRATION_DESTINATION_MISSING');
            const envelope = await this.read(this.store.load(row.id));
            if (envelope?.migration?.preserveNamespace !== true || envelope.migration.source !== row.source ||
                envelope.migration.sourceVersion !== row.sourceVersion)
                throw fail('EOS_MIGRATION_DESTINATION_BINDING');
            const config = this.decode(envelope);
            if (!record(config) || (row.id !== 'ui' && typeof config.enabled !== 'boolean'))
                throw fail('EOS_MIGRATION_CONFIG_INVALID');
            // Settings may legitimately have changed after commit. Validate the
            // stable source/namespace binding, not the original content hash.
        }
    }
    async saveUi(value) {
        if (this.manualPending && this.phase !== 'TRANSFERRED')
            throw fail('EOS_MIGRATION_BUSY');
        this.uiSaves++;
        try {
            await this.persistUi(value);
        }
        finally {
            this.uiSaves--;
        }
    }
    async persistUi(value) {
        const config = copy(value);
        // Host TLS, authentication and licensing are never restored from an old UI.
        for (const key of ['licenseKey', 'auth', 'port', 'secure', 'certPublic', 'certPrivate', 'certChained', 'bind'])
            delete config[key];
        const envelope = this.envelope(config, this.owner.config.eosUiMigration || undefined);
        await this.store.save('ui', envelope);
        this.owner.config.eosUi = config;
    }
    async hostFresh(host) {
        const state = await this.reader.getForeignStateAsync(`system.host.${host}.alive`);
        const age = Date.now() - state?.ts;
        return state?.val === true && state.ack === true && Number.isFinite(age) && age >= -5000 && age <= HOST_MAX_AGE_MS;
    }
    async stoppedSource(source) {
        const object = await this.reader.getForeignObjectAsync(`system.adapter.${source}`);
        const alive = await this.reader.getForeignStateAsync(`system.adapter.${source}.alive`);
        return await hasConfirmedLegacyStop(this.reader, object, alive) && await this.hostFresh(object.common.host);
    }
    async checkUiDestination() {
        const defaults = require(join(this.options.baseDir, 'io-package.json')).native.eosUi || {};
        if (containsCustomerSettings(this.owner.config.eosUi || {}, defaults))
            throw fail('EOS_MIGRATION_DESTINATION_CONFIGURED');
        const namespace = this.owner.namespace;
        const state = await this.reader.getForeignStateAsync(namespace + '.installer.configJson');
        if (state && state.val != null && state.val !== '') {
            if (typeof state.val !== 'string' || Buffer.byteLength(state.val) > 512 * 1024)
                throw fail('EOS_MIGRATION_DESTINATION_STATES');
            let patch;
            try {
                patch = copy(JSON.parse(state.val));
            }
            catch {
                throw fail('EOS_MIGRATION_DESTINATION_STATES');
            }
            if (!record(patch) || containsCustomerSettings(patch, defaults))
                throw fail('EOS_MIGRATION_DESTINATION_STATES');
        }
        for (const channel of ['smarthome', 'ems', 'chargepoints', 'energyFlow', 'historie']) {
            const id = namespace + '.' + channel;
            const object = await this.reader.getForeignObjectAsync(id);
            // Historic state objects may be restored without a parent folder.
            if (!object && channel !== 'historie')
                continue;
            if (object && !ownPlaceholder(namespace, channel, object))
                throw fail('EOS_MIGRATION_DESTINATION_STATES');
            const prefix = id + '.';
            const result = await this.reader.getObjectViewAsync('system', 'state', { startkey: prefix, endkey: prefix + '\u9999', limit: 513 });
            if (!Array.isArray(result?.rows) || result.rows.length > 512)
                throw fail('EOS_MIGRATION_DESTINATION_STATES');
            for (const entry of result.rows) {
                const leaf = entry.value;
                if (leaf?.type !== 'state' || !leaf._id?.startsWith(prefix))
                    continue;
                if (channel !== 'historie' || Object.entries(leaf.common?.custom || {}).some(([provider, cfg]) => /^(?:influxdb|sql|history|postgresql)\.\d+$/.test(provider) && record(cfg) &&
                    (cfg.enabled === true || typeof cfg.aliasId === 'string' && cfg.aliasId.trim())))
                    throw fail('EOS_MIGRATION_DESTINATION_STATES');
            }
        }
    }
    async readUiSource(source, requiredStates) {
        const { readPreservedUiStates } = require(join(this.options.baseDir, 'ui/lib/preserved-ui-config'));
        const states = await readPreservedUiStates(this.reader, source, requiredStates);
        const patch = states.values['installer.configJson'];
        if (patch)
            uiShape(patch, {}, true);
        return states;
    }
    async readSourceMetadata(id, object) {
        const name = SOURCES[id];
        sourceIdentity(name, object, true);
        const metadata = await this.reader.getForeignObjectAsync('system.adapter.' + name);
        if (metadata)
            sourceIdentity(name, metadata, false);
        return sourceMetadata(object, metadata);
    }
    async matchesSource(object, row) {
        if (object?.type !== 'instance' || object._id !== 'system.adapter.' + row.source || !record(object.native) ||
            nativeHash(object) !== row.nativeHash || object.common?.host !== row.host)
            return false;
        if (row.schemaVerified !== true)
            return object.common.version === row.sourceVersion;
        if ((object.common.name !== undefined && object.common.name !== SOURCES[row.id]) ||
            cleanVersion(object.common.version) !== row.instanceVersion)
            return false;
        // Only a handover which used the adapter object's version depends on it.
        // Never use a newly installed local version as a witness for the old source.
        if (row.instanceVersion !== null || row.adapterVersion === null)
            return true;
        const metadata = await this.readSourceMetadata(row.id, object);
        return metadata.adapterVersion === row.adapterVersion;
    }
    async candidate(id, object, activateDevices = false, metadata) {
        metadata ??= await this.readSourceMetadata(id, object);
        if (!schemaDriven(id) && !VERSIONS[id]?.includes(metadata.instanceVersion))
            throw fail('EOS_MIGRATION_MODULE_FORMAT_UNVERIFIED');
        if (!record(object.native) || typeof object.common.enabled !== 'boolean')
            throw fail('EOS_MIGRATION_SOURCE_UNAVAILABLE');
        const source = object._id.slice('system.adapter.'.length);
        if (id !== 'ui' && this.owner.eosLicenseService?.allowsEmbeddedModule?.(id) !== true)
            throw fail('EOS_MIGRATION_MODULE_LICENSE_REQUIRED');
        const ownerObject = await this.reader.getForeignObjectAsync(`system.adapter.${this.owner.namespace}`);
        if (ownerObject?.common?.enabled !== true || !ownerObject.common.host || object.common.host !== ownerObject.common.host || !(await this.hostFresh(object.common.host)))
            throw fail('EOS_MIGRATION_SOURCE_HOST');
        // An already stopped source can supply its configuration without reviving it.
        // Prove its stop before any journal is created or another source is touched.
        if (object.common.enabled === false && !(await this.stoppedSource(source)))
            throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
        const existing = await this.read(this.store.load(id));
        if (existing)
            throw fail('EOS_MIGRATION_DESTINATION_CONFIGURED');
        if (id === 'ui')
            await this.checkUiDestination();
        const config = decryptNative(this.owner, object);
        let prepared;
        const targetEnabled = object.common.enabled || (id === 'devices' && activateDevices === true);
        if (id === 'ui') {
            const uiDefaults = require(join(this.options.baseDir, 'ui/io-package.json')).native;
            uiShape(config, uiDefaults);
            const states = await this.readUiSource(source);
            prepared = { config: { ...config }, requiredStates: states.requiredStates };
            for (const key of ['licenseKey', 'auth', 'port', 'secure', 'certPublic', 'certPrivate', 'certChained', 'bind'])
                delete prepared.config[key];
        }
        else {
            if (id === 'devices')
                devicesShape(config);
            const factory = this.options.factories?.[id] || require(join(this.options.baseDir, 'modules', id, 'index.js'));
            if (typeof factory.preflightLegacyConfig === 'function')
                prepared = await factory.preflightLegacyConfig(config, {
                    owner: this.reader, source, sourceVersion: metadata.sourceVersion, sourceEnabled: object.common.enabled,
                    dataDir: join(this.options.dataDir, 'modules', id), eosDataDir: this.options.dataDir, installationDir: this.options.installationDir,
                });
            else if (id === 'devices')
                prepared = { config: factory.validateConfig({ ...config, enabled: object.common.enabled === true }) };
            else
                throw fail('EOS_MIGRATION_PREFLIGHT_UNAVAILABLE');
            prepared.config.enabled = targetEnabled;
            prepared.config = factory.validateConfig(prepared.config);
        }
        if (!record(prepared?.config))
            throw fail('EOS_MIGRATION_CONFIG_INVALID');
        const migration = { source, sourceVersion: metadata.sourceVersion, preserveNamespace: true,
            importedAt: new Date().toISOString(), statesCopied: false, mappingsRewritten: false,
            ...(id === 'ui' ? { requiredStates: prepared.requiredStates } : {}),
            identityImported: prepared.identityImported === true, omittedFields: id === 'ui' ? ['host transport/authentication/license fields'] : [] };
        return { id, source, enabled: object.common.enabled === true, nativeHash: nativeHash(object),
            host: object.common.host, ...metadata, ...(schemaDriven(id) ? { schemaVerified: true } : {}),
            ...(id === 'devices' && targetEnabled !== object.common.enabled ? { targetEnabled } : {}), envelope: this.envelope(prepared.config, migration),
            prepareFiles: prepared.prepareFiles };
    }
    async rollback(code, stopConfirmed = false) {
        if (stopConfirmed !== true)
            throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
        this.journal = { ...this.journal, code, runtimeStopConfirmed: true };
        await this.persist('ROLLING_BACK');
        // Called before any new runtime exists or after confirmed complete shutdown.
        for (const row of this.journal.sources || []) {
            const current = await this.reader.getForeignObjectAsync(`system.adapter.${row.source}`);
            if (!(await this.matchesSource(current, row))) {
                await this.persist('ROLLBACK_REQUIRED');
                throw fail('EOS_MIGRATION_SOURCE_CHANGED');
            }
        }
        for (const row of this.journal.sources || []) {
            const current = await this.reader.getForeignObjectAsync(`system.adapter.${row.source}`);
            // Recheck the exact source immediately before each re-enable. The
            // controller API is not a compare-and-swap transaction; never reuse
            // a previous loop's source/version/host decision.
            if (!(await this.matchesSource(current, row))) {
                await this.persist('ROLLBACK_REQUIRED');
                throw fail('EOS_MIGRATION_SOURCE_CHANGED');
            }
            if (!row.enabled && !(await this.stoppedSource(row.source))) {
                await this.persist('ROLLBACK_REQUIRED');
                throw fail('EOS_MIGRATION_SOURCE_CHANGED');
            }
            if (row.enabled && current.common.enabled !== true)
                await this.owner.extendForeignObjectAsync(`system.adapter.${row.source}`, { common: { enabled: true } });
        }
        const deadline = Date.now() + (this.options.stopTimeoutMs || 15000);
        while (true) {
            const checks = await Promise.all((this.journal.sources || []).filter(row => row.enabled).map(async (row) => {
                const object = await this.reader.getForeignObjectAsync(`system.adapter.${row.source}`);
                const alive = await this.reader.getForeignStateAsync(`system.adapter.${row.source}.alive`);
                return await this.matchesSource(object, row) && object.common.enabled === true && alive?.val === true && alive.ack === true && alive.ts >= object.ts && await this.hostFresh(row.host);
            }));
            if (checks.every(Boolean))
                break;
            if (Date.now() >= deadline) {
                await this.persist('ROLLBACK_REQUIRED');
                throw fail('EOS_MIGRATION_ROLLBACK_UNCONFIRMED');
            }
            await delay(100);
        }
        for (const row of this.journal.sources || []) {
            if (row.id !== 'ocpp' || !row.enabled)
                continue;
            // Only the confirmed, journaled rollback may remove the hosted
            // lifecycle marker. A child crash must keep stale hosted telemetry
            // distinguishable from a running standalone OCPP adapter.
            const markerId = `${row.source}.info.eosHostedRuntime`;
            const marker = await this.reader.getForeignStateAsync(markerId);
            if (marker?.val === true)
                await this.owner.setForeignStateAsync(markerId, { val: false, ack: true });
        }
        await this.persist('ROLLED_BACK');
    }
    async start() {
        try {
            await this.prepare();
        }
        catch (error) {
            this.block(safeCode(error));
            throw error;
        }
    }
    async readInventory(inspectVersions = false) {
        const observed = [], issues = [], proof = [];
        // Inventory every participating family before releasing any independent scope.
        // OCPP has an explicit manual import and a separate live ownership check.
        for (const [id, name] of Object.entries(SOURCES)) {
            if (id === 'ocpp')
                continue;
            const found = await this.reader.getObjectViewAsync('system', 'instance', { startkey: `system.adapter.${name}.`, endkey: `system.adapter.${name}.\u9999` });
            if (!Array.isArray(found?.rows) || found.rows.length > 64)
                throw fail('EOS_MIGRATION_INVENTORY');
            const seen = new Set();
            for (const row of found.rows) {
                const sourceId = row.value?._id;
                if (row.value?.type !== 'instance' || !new RegExp(`^system\\.adapter\\.${name}\\.\\d+$`).test(sourceId || '') || seen.has(sourceId))
                    throw fail('EOS_MIGRATION_INVENTORY');
                seen.add(sourceId);
                proof.push([sourceId, reviewStamp(row.value)]);
                const source = sourceId.slice('system.adapter.'.length);
                let metadata = sourceMetadata(row.value, null);
                if (inspectVersions) {
                    try {
                        metadata = await this.readSourceMetadata(id, row.value);
                    }
                    catch (error) {
                        issues.push({ id, source, code: safeCode(error) });
                    }
                }
                observed.push({ id, source, ...metadata });
                if (found.rows.length > 1)
                    issues.push({ id, source, code: 'EOS_MIGRATION_AMBIGUOUS' });
            }
        }
        proof.sort((a, b) => a[0].localeCompare(b[0]));
        return { observed, issues, stamps: new Map(proof), signature: fingerprint(proof) };
    }
    async manualReview() {
        const view = this.manualView();
        if (!view.canStart)
            return this.status();
        if (this.reviewPending)
            return this.reviewPending;
        this.reviewPending = this.readInventory(true).then(inventory => {
            if (this.manualPending || this.stopped || !this.manualView().canStart)
                return this.status();
            if (this.review?.signature !== inventory.signature)
                this.manualRevision = randomUUID();
            this.review = inventory;
            const status = this.status();
            const sources = inventory.observed.map(row => ({ ...row, namespacePreserved: false }));
            const issues = [...inventory.issues];
            for (const prior of status.issues || []) {
                if (sources.some(row => row.source === prior.source) && !issues.some(row => row.source === prior.source && row.code === prior.code))
                    issues.push(prior);
            }
            return { ...status, sources, issues };
        }).finally(() => { this.reviewPending = null; });
        return this.reviewPending;
    }
    manualView() {
        const license = this.owner.eosLicenseService?.statusView?.();
        const selectable = !this.stopped && !this.startupBlocked && !this.manualPending &&
            ['BLOCKED', 'NOT_NEEDED', 'DISABLED', 'LICENSE_REQUIRED'].includes(this.phase);
        const canStart = selectable && license?.valid === true && license.coreEnabled === true;
        return { canStart, canActivateDevices: canStart && (this.review?.observed || []).some(row => row.id === 'devices' && row.enabled === false),
            revision: this.manualRevision, operation: { ...this.operation } };
    }
    requestManual(activateDevices, revision, confirmAuthority) {
        const view = this.manualView();
        if (this.manualPending || this.owner.eosRuntimeControl?.pending || this.owner.eosModuleHost?.configurationSavePromise || this.owner.eosModuleHost?.mutation || this.uiSaves) {
            throw fail('EOS_MIGRATION_BUSY');
        }
        if (!view.canStart || !this.owner.eosRuntimeControl || !this.owner.eosModuleHost || !this.owner.eosHostedRuntime)
            throw fail('EOS_MIGRATION_ACTION_UNAVAILABLE');
        if (!this.review || typeof revision !== 'string' || revision !== this.manualRevision)
            throw fail('EOS_MIGRATION_REVISION_CONFLICT');
        if (typeof activateDevices !== 'boolean' || (activateDevices && !view.canActivateDevices))
            throw fail('EOS_MIGRATION_REQUEST_INVALID');
        this.manualRevision = randomUUID();
        this.operation = { state: 'running', code: '' };
        this.manualPending = Promise.resolve().then(async () => {
            await this.prepare({ activateDevices, signature: this.review.signature, confirmAuthority });
            if (this.phase === 'TRANSFERRED') {
                await this.releaseLiveTargets(true);
                await this.verifyRuntime();
            }
            else if (this.manualScopes)
                await this.releaseLiveTargets(false);
            if (this.stopped)
                return;
            const ok = ['COMMITTED', 'NOT_NEEDED'].includes(this.phase);
            this.operation = { state: ok ? 'complete' : 'failed', code: ok ? '' : this.status().code || 'EOS_MIGRATION_FAILED' };
        }).catch(async (error) => {
            const code = safeCode(error);
            if (this.phase === 'TRANSFERRED')
                await this.failStartup(code);
            // A failed drain must not restore write authority. Before any journal was
            // created, all old sources are still intact; the affected targets stay gated.
            if (this.manualScopes) {
                const heldIds = [...this.manualScopes].filter(id => id !== 'ui');
                this.blockedSources = new Set(this.manualScopes);
                if (!this.journal?.phase && !this.stopped) {
                    this.phase = 'BLOCKED';
                    this.journal = { sources: this.journal?.sources || [], code };
                }
                this.manualScopes = null;
                this.manuallyAllowed = null;
                await this.owner.eosModuleHost?.releaseMigrationModules(heldIds, false).catch(() => { });
            }
            if (code === 'EOS_MIGRATION_JOURNAL_PRESENT')
                this.block(code);
            this.operation = { state: 'failed', code };
            this.owner.log.warn(`EOS_MIGRATION_MANUAL_FAILED: ${code}`);
            if (!this.stopped)
                await this.publish();
        }).finally(() => { this.manualPending = null; this.review = null; });
    }
    async confirmManualAuthority(manual, candidates) {
        const permitted = await Promise.resolve().then(() => manual.confirmAuthority()).catch(() => false);
        if (permitted !== true || this.stopped)
            throw fail('EOS_MIGRATION_AUTHORIZATION_CHANGED');
        const license = this.owner.eosLicenseService?.statusView?.();
        if (license?.valid !== true || license.coreEnabled !== true)
            throw fail('EOS_MIGRATION_LICENSE_REQUIRED');
        if (candidates.some(row => row.id !== 'ui' && this.owner.eosLicenseService.allowsEmbeddedModule?.(row.id) !== true)) {
            throw fail('EOS_MIGRATION_MODULE_LICENSE_REQUIRED');
        }
    }
    async holdLiveTargets(candidates) {
        const owner = this.owner;
        const ids = candidates.map(row => row.id);
        if (owner.eosRuntimeControl.pending || owner.eosModuleHost.configurationSavePromise || owner.eosModuleHost.mutation || this.uiSaves || this.stopped)
            throw fail('EOS_MIGRATION_BUSY');
        this.manuallyAllowed = new Set(Object.keys(SOURCES).filter(id => this.allowsStartup(id)));
        this.manualScopes = new Set(ids);
        const tasks = [owner.eosModuleHost.holdMigrationModules(ids.filter(id => id !== 'ui'))];
        if (this.manualScopes.has('ui'))
            tasks.push(owner.eosHostedRuntime.pause(), owner.eosHostedRuntime.pauseEms());
        const settled = await Promise.allSettled(tasks);
        if (settled.some(result => result.status === 'rejected') || this.stopped)
            throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
    }
    async releaseLiveTargets(transferred) {
        if (!this.manualScopes || this.stopped)
            throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
        const owner = this.owner;
        const ids = [...this.manualScopes];
        await owner.eosModuleHost.releaseMigrationModules(ids.filter(id => id !== 'ui'), transferred);
        this.manualScopes = null;
        this.manuallyAllowed = null;
        if (!transferred)
            return;
        await owner.eosOwnership.refresh();
        if (ids.includes('ui')) {
            const jobs = [];
            if (owner.eosRuntimeControl.isEnabled('ui'))
                jobs.push(owner.eosHostedRuntime.resume());
            if (owner.eosRuntimeControl.isEnabled('ems'))
                jobs.push(owner.eosHostedRuntime.resumeEms());
            await Promise.all(jobs);
        }
        await owner.eosModuleHost.start();
        await owner.eosModuleHost.reconcile();
    }
    async checkLegacyRpc(candidates) {
        const sources = new Set(candidates.map(row => row.source));
        const inventory = await this.reader.getObjectViewAsync('system', 'instance', { startkey: 'system.adapter.', endkey: 'system.adapter.\u9999' });
        if (!Array.isArray(inventory?.rows) || inventory.rows.length > 512)
            throw fail('EOS_MIGRATION_RPC_INVENTORY');
        const referenced = new Set();
        const checkReferences = value => {
            if (typeof value === 'string' && sources.has(value))
                referenced.add(value);
            if (value && typeof value === 'object')
                Object.values(value).forEach(checkReferences);
        };
        for (const row of inventory.rows) {
            const object = row.value;
            if (/^system\.adapter\.eos-admin\.\d+$/.test(object?._id || '') && object._id !== `system.adapter.${this.owner.namespace}`) {
                if (!(await this.stoppedSource(object._id.slice('system.adapter.'.length))))
                    throw fail('EOS_MIGRATION_PARALLEL_EOS');
            }
            if (!object?._id || object._id === `system.adapter.${this.owner.namespace}` || sources.has(object._id.slice('system.adapter.'.length)) || object.common?.enabled !== true)
                continue;
            checkReferences(copy(object.native || {}));
        }
        const scripts = await this.reader.getObjectViewAsync('system', 'script', { startkey: 'script.', endkey: 'script.\u9999' });
        if (!Array.isArray(scripts?.rows) || scripts.rows.length > 5000)
            throw fail('EOS_MIGRATION_RPC_INVENTORY');
        for (const row of scripts.rows) {
            const script = row.value;
            if (script?.common?.enabled !== true)
                continue;
            const text = script.common.source;
            if (typeof text !== 'string' || Buffer.byteLength(text) > 2 * 1024 * 1024)
                throw fail('EOS_MIGRATION_SCRIPT_REVIEW');
            if (text.includes('sendTo'))
                for (const source of sources)
                    if (text.includes(source))
                        referenced.add(source);
        }
        return referenced;
    }
    async prepare(manual = null) {
        if (!manual)
            await this.loadDestinations();
        const prior = await this.read(this.store.load('migration'));
        if (prior) {
            // Only adapter startup may recover a journal that predates this process.
            if (manual)
                throw fail('EOS_MIGRATION_JOURNAL_PRESENT');
            const journal = this.decode(prior);
            if (journal.v !== 1 || journal.owner !== this.owner.namespace || !['PREPARED', 'STOPPING', 'TRANSFERRED', 'COMMITTED', 'ROLLING_BACK', 'ROLLBACK_REQUIRED', 'ROLLED_BACK'].includes(journal.phase) ||
                (journal.runtimeStopConfirmed !== undefined && typeof journal.runtimeStopConfirmed !== 'boolean') ||
                !Array.isArray(journal.sources) || journal.sources.length > Object.keys(SOURCES).length || new Set(journal.sources.map(row => row?.id)).size !== journal.sources.length || journal.sources.some(row => !validJournalSource(row, SOURCES, VERSIONS)))
                throw fail('EOS_MIGRATION_JOURNAL_INVALID');
            this.journal = journal;
            this.phase = journal.phase;
            if (['TRANSFERRED', 'COMMITTED'].includes(this.phase))
                await this.verifyDestinations();
            // PREPARED/STOPPING precede any new runtime construction. Recovery
            // after a started runtime needs an explicitly persisted stop proof;
            // a process restart alone cannot prove a child transport has ended.
            if (['PREPARED', 'STOPPING'].includes(this.phase) ||
                (this.phase === 'ROLLING_BACK' && journal.runtimeStopConfirmed === true)) {
                await this.rollback('EOS_MIGRATION_INTERRUPTED', true);
            }
            else if (this.phase === 'ROLLING_BACK') {
                this.journal = { ...this.journal, code: 'EOS_MIGRATION_STOP_UNCONFIRMED' };
                await this.persist('ROLLBACK_REQUIRED');
            }
            // ROLLED_BACK and ROLLBACK_REQUIRED are deliberately sticky. A
            // restart must not retry a cutover or bypass an unconfirmed stop.
            await this.publish();
            return;
        }
        if (!manual && this.owner.config.eosAutoMigrate === false) {
            this.phase = 'DISABLED';
            return;
        }
        const license = this.owner.eosLicenseService?.statusView?.();
        if (license?.valid !== true || license.coreEnabled !== true) {
            // A later activation is not proof that the legacy inventory was
            // checked. Keep new writers fenced until startup runs the preflight
            // with a valid license and binds the runtime to that configuration.
            this.phase = 'LICENSE_REQUIRED';
            this.journal = { sources: [], code: 'EOS_MIGRATION_LICENSE_REQUIRED' };
            await this.publish();
            return;
        }
        const candidates = [];
        const observed = [];
        const issues = [];
        try {
            const inventory = await this.readInventory();
            observed.push(...inventory.observed);
            issues.push(...inventory.issues);
            if (manual && inventory.signature !== manual.signature)
                throw fail('EOS_MIGRATION_INVENTORY_CHANGED');
            if (!observed.length) {
                this.journal = null;
                this.blockedSources = null;
                this.phase = 'NOT_NEEDED';
                await this.publish();
                return;
            }
            // An incomplete/global inventory or another EOS affects every writer.
            // A reference to a known source is attributable to that handover only.
            const referenced = await this.checkLegacyRpc(observed);
            for (const row of observed)
                if (referenced.has(row.source))
                    issues.push({ ...row, code: 'EOS_MIGRATION_EXTERNAL_RPC_REFERENCE' });
            for (const row of observed) {
                if (issues.some(issue => issue.id === row.id))
                    continue;
                try {
                    const sourceId = `system.adapter.${row.source}`;
                    const object = await this.reader.getForeignObjectAsync(sourceId);
                    if (object?.type !== 'instance' || object._id !== sourceId)
                        throw fail('EOS_MIGRATION_SOURCE_UNAVAILABLE');
                    if (manual && inventory.stamps.get(sourceId) !== reviewStamp(object))
                        throw fail('EOS_MIGRATION_INVENTORY_CHANGED');
                    Object.assign(row, await this.readSourceMetadata(row.id, object));
                    candidates.push(await this.candidate(row.id, object, manual?.activateDevices === true, row));
                }
                catch (error) {
                    if (manual && error?.code === 'EOS_MIGRATION_INVENTORY_CHANGED')
                        throw error;
                    issues.push({ ...row, code: safeCode(error) });
                }
            }
            if (issues.length) {
                // The cutover remains atomic: no source from this group is stopped and
                // none of their embedded counterparts may start on package defaults.
                this.blockedSources = new Set(observed.map(row => row.id));
                this.journal = { sources: observed, issues, code: issues[0].code };
                this.phase = 'BLOCKED';
                this.owner.log.warn(`EOS_MIGRATION_BLOCKED: ${issues[0].code}; existing adapters remain unchanged`);
                await this.publish();
                return;
            }
        }
        catch (error) {
            if (manual && error?.code === 'EOS_MIGRATION_INVENTORY_CHANGED')
                throw error;
            this.blockedSources = null;
            this.phase = 'BLOCKED';
            this.journal = { sources: observed, code: safeCode(error) };
            this.owner.log.warn(`EOS_MIGRATION_BLOCKED: ${safeCode(error)}; existing adapters remain unchanged`);
            await this.publish();
            return;
        }
        if (manual) {
            await this.confirmManualAuthority(manual, candidates);
            await this.holdLiveTargets(candidates);
            // Prove all candidates again after fencing the new processes. A slow
            // clicked form or a finishing config save cannot bless a replaced source.
            for (const row of candidates) {
                if (manual && this.stopped)
                    throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
                const current = await this.reader.getForeignObjectAsync(`system.adapter.${row.source}`);
                if (!(await this.matchesSource(current, row)) || current.common.enabled !== row.enabled)
                    throw fail('EOS_MIGRATION_SOURCE_CHANGED');
                if (await this.read(this.store.load(row.id)))
                    throw fail('EOS_MIGRATION_DESTINATION_CONFIGURED');
                if (row.id === 'ui')
                    await this.checkUiDestination();
            }
            await this.confirmManualAuthority(manual, candidates);
        }
        this.journal = { sources: candidates.map(({ envelope: _envelope, prepareFiles: _files, ...binding }) => binding) };
        await this.persist('PREPARED');
        try {
            await this.persist('STOPPING');
            for (const row of candidates) {
                if (manual && this.stopped)
                    throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
                const current = await this.reader.getForeignObjectAsync(`system.adapter.${row.source}`);
                if (!(await this.matchesSource(current, row)) || current.common.enabled !== row.enabled)
                    throw fail('EOS_MIGRATION_SOURCE_CHANGED');
                if (manual && this.stopped)
                    throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
                if (row.id === 'ui') {
                    await this.checkUiDestination();
                    await this.readUiSource(row.source, row.envelope.migration.requiredStates);
                }
                if (row.enabled)
                    await this.owner.extendForeignObjectAsync(current._id, { common: { enabled: false } });
            }
            const deadline = Date.now() + (this.options.stopTimeoutMs || 15000);
            while (!(await Promise.all(candidates.map(row => this.stoppedSource(row.source)))).every(Boolean)) {
                if (Date.now() >= deadline || this.stopped)
                    throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
                await delay(100);
            }
            for (const row of candidates) {
                if (manual && this.stopped)
                    throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
                const current = await this.reader.getForeignObjectAsync(`system.adapter.${row.source}`);
                if (!(await this.matchesSource(current, row)) || current.common.enabled !== false)
                    throw fail('EOS_MIGRATION_SOURCE_CHANGED');
                if (row.id === 'ui') {
                    await this.checkUiDestination();
                    // Recheck after confirmed stop: an in-flight old save may have
                    // changed the JSON after preflight. Never activate partial data.
                    const states = await this.readUiSource(row.source, row.envelope.migration.requiredStates);
                    row.envelope.migration.requiredStates = states.requiredStates;
                }
                if (manual && this.stopped)
                    throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
                await row.prepareFiles?.();
                if (manual && this.stopped)
                    throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
                await this.store.save(row.id, row.envelope);
            }
            // Recheck after file and asynchronous state reads, before granting write
            // authority to the new runtimes. No disabled source gets enabled here.
            for (const row of candidates) {
                if (manual && this.stopped)
                    throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
                const current = await this.reader.getForeignObjectAsync(`system.adapter.${row.source}`);
                if (!(await this.matchesSource(current, row)) || !(await this.stoppedSource(row.source)))
                    throw fail('EOS_MIGRATION_SOURCE_CHANGED');
            }
            await this.persist('TRANSFERRED');
            await this.loadDestinations();
            this.owner.log.info('EOS_MIGRATION_TRANSFERRED: existing namespaces and settings retained; startup verification pending');
        }
        catch (error) {
            if (manual && this.stopped)
                throw error; // journal recovery belongs to the next owner
            // prepare() has not allowed the caller to construct/start any new
            // runtime yet; only configuration transfer has been attempted.
            await this.rollback(safeCode(error), true);
        }
    }
    /**
     * Recover before the adapter is terminated for a TLS/listener/initialization
     * failure. Fence synchronously, then stop all new runtimes before restoring
     * old writers. A timed-out stop is not proof of stopped physical transports.
     */
    failStartup(code = 'EOS_MIGRATION_NEW_STARTUP_FAILED') {
        if (this.recovery)
            return this.recovery;
        if (this.stopped || (this.phase !== 'TRANSFERRED' && !this.commitPromise))
            return Promise.resolve();
        this.startupBlocked = true;
        const committing = this.commitPromise;
        this.recovery = (async () => {
            // Never let a late journal commit overwrite a recovery decision.
            if (committing)
                await committing.catch(() => undefined);
            this.journal = { ...this.journal, code: safeCode({ code }), runtimeStopConfirmed: false };
            await this.persist('ROLLING_BACK');
            let timer;
            try {
                const stopping = Promise.all([
                    this.owner.eosHostedRuntime, this.owner.eosModuleHost,
                ].filter(Boolean).map(runtime => Promise.resolve().then(() => {
                    if (typeof runtime.stop !== 'function')
                        throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
                    return runtime.stop();
                })));
                await Promise.race([stopping, new Promise((_, reject) => {
                        timer = setTimeout(() => reject(fail('EOS_MIGRATION_STOP_UNCONFIRMED')), Math.min(this.options.runtimeStopTimeoutMs || 5000, 5000));
                    })]);
            }
            finally {
                clearTimeout(timer);
            }
            if ([...(this.owner.eosModuleHost?.entries?.values() || [])].some(entry => entry.stopFailed)) {
                throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
            }
            await this.rollback(safeCode({ code }), true);
        })().catch(async (error) => {
            this.journal = { ...this.journal, code: safeCode(error) };
            this.phase = 'ROLLBACK_REQUIRED';
            try {
                await this.persist('ROLLBACK_REQUIRED');
            }
            catch {
                await this.publish();
            }
            this.owner.log.error(`EOS_MIGRATION_RECOVERY_REQUIRED: ${safeCode(error)}`);
        });
        return this.recovery;
    }
    async startupRead(operation, deadline) {
        let timer;
        try {
            return await Promise.race([operation, new Promise((_, reject) => {
                    timer = setTimeout(() => reject(fail('EOS_MIGRATION_NEW_RUNTIME_TIMEOUT')), Math.max(1, Math.min(5000, deadline - performance.now())));
                })]);
        }
        finally {
            clearTimeout(timer);
        }
    }
    async readiness(rows, deadline) {
        const modules = await this.startupRead(Promise.all(rows.filter(row => row.id !== 'ui' && (row.targetEnabled ?? row.enabled))
            .map(row => this.owner.eosModuleHost?.status(row.id))), deadline);
        // Read these live values only after the asynchronous module snapshot.
        const ui = this.owner.eosHostedRuntime?.status?.();
        const license = this.owner.eosLicenseService?.statusView?.();
        const devices = modules.find(row => row?.id === 'devices');
        const startup = devices?.details?.startup;
        const devicesProgress = devices?.reason === 'STARTING' && startup?.pending === true &&
            Number.isSafeInteger(startup.completedObjects) && startup.completedObjects > 0
            ? startup.completedObjects : 0;
        const requiresUi = rows.some(row => row.id === 'ui');
        const split = !!ui && (Object.hasOwn(ui, 'ems') || Object.hasOwn(ui, 'ui'));
        const ems = split ? ui.ems : ui;
        const intent = id => this.owner.eosRuntimeControl?.dashboardIntent?.(id);
        const paused = id => {
            const saved = intent(id);
            return saved?.enabled === false && saved.error === '';
        };
        const stoppedChild = child => child?.process?.state === 'stopped' && child.process.pid === null && child.active === false;
        // A disabled *source* is still a real handover. The target uses its own
        // persisted process switches. An uninitialized runtime is never a user pause.
        const emsReady = paused('ems') ? stoppedChild(ems) && ems.canWrite === false : ems?.emsReady === true && ems.canWrite === true;
        const presentationReady = !split || (paused('ui') ? stoppedChild(ui.ui) : ui.ui?.active === true);
        // During process construction the UI reports degraded even when the child
        // is only starting. Only a terminal child error can end this wait early.
        const childFailed = child => child?.process ? child.process.state === 'failed' : child?.state === 'degraded';
        return {
            devicesProgress,
            ready: rows.every(row => this.owner.eosOwnership?.canWrite(row.id === 'ui' ? 'ems' : row.id) === true) &&
                license?.valid === true && license.coreEnabled === true && (!requiresUi || (emsReady && presentationReady)) &&
                modules.every(row => (row?.active === true && row.reason === 'RUNNING') ||
                    (row?.enabled === true && row.reason === 'EOS_RUNTIME_DISABLED' && row.active === false && paused(row.id))),
            failed: (requiresUi && (childFailed(ems) || childFailed(ui?.ui))) ||
                modules.some(row => /FAILED/.test(row?.reason || '') || (row?.reason === 'CONFIG_INVALID' &&
                    !!row.details?.configuration?.error && row.details.configuration.error !== 'EOS_MODULE_CONFIG_UNAVAILABLE')),
        };
    }
    /** Start this monitor immediately after transfer, before any web startup. */
    async verifyRuntime() {
        if (this.monitor)
            return this.monitor;
        if (this.phase !== 'TRANSFERRED' || this.stopped || this.startupBlocked)
            return;
        this.monitor = (async () => {
            const configuredWindow = this.options.startTimeoutMs;
            const startupWindow = Number.isFinite(configuredWindow) && configuredWindow > 0
                ? Math.min(configuredWindow, STARTUP_WINDOW_MS) : STARTUP_WINDOW_MS;
            const startedAt = performance.now();
            let deadline = startedAt + startupWindow;
            const hasDevices = this.journal.sources.some(row => row.id === 'devices' && (row.targetEnabled ?? row.enabled));
            const absoluteDeadline = deadline + (hasDevices ? DEVICES_PROGRESS_ALLOWANCE_MS : 0);
            let completedObjects = 0;
            while (!this.stopped && !this.startupBlocked && performance.now() < deadline) {
                const rows = this.journal.sources;
                const readiness = await this.readiness(rows, deadline);
                // Only new, successful object provisioning from the real Devices
                // host extends this monitor. READY, transport telemetry and an
                // unchanged progress count cannot keep a takeover alive.
                if (hasDevices && readiness.devicesProgress > completedObjects && performance.now() < deadline) {
                    completedObjects = readiness.devicesProgress;
                    deadline = Math.min(absoluteDeadline, performance.now() + startupWindow);
                }
                if (this.stopped || this.startupBlocked || this.phase !== 'TRANSFERRED')
                    return this.recovery;
                if (readiness.ready) {
                    const stopped = await this.startupRead(Promise.all(rows.map(row => this.stoppedSource(row.source))), deadline);
                    const latest = await this.readiness(rows, deadline);
                    if (stopped.every(Boolean) && latest.ready && !this.stopped && !this.startupBlocked && this.phase === 'TRANSFERRED' && performance.now() < deadline) {
                        this.commitPromise = this.persist('COMMITTED');
                        try {
                            await this.commitPromise;
                        }
                        catch (error) {
                            this.phase = 'TRANSFERRED';
                            this.startupBlocked = true;
                            throw error;
                        }
                        finally {
                            this.commitPromise = null;
                        }
                        if (this.startupBlocked)
                            return this.recovery;
                        this.owner.log.info('EOS_MIGRATION_COMMITTED: configuration and startup verified; original adapters retained disabled');
                        return;
                    }
                }
                if (readiness.failed)
                    break;
                await delay(Math.max(1, Math.min(250, deadline - performance.now())));
            }
            if (this.stopped)
                return;
            await this.failStartup('EOS_MIGRATION_NEW_RUNTIME_FAILED');
        })().catch(error => this.failStartup(safeCode(error)));
        return this.monitor;
    }
    stop() { this.stopped = true; }
    async whenManualIdle() { await this.manualPending; }
}
function safeCode(error) { return typeof error?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : 'EOS_MIGRATION_FAILED'; }
module.exports = { EosLegacyMigration, decryptNative, hasConfirmedLegacyStop };
//# sourceMappingURL=eosLegacyMigration.js.map