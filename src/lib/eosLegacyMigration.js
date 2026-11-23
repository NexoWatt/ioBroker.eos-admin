/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const { createHash } = require('node:crypto');
const { join } = require('node:path');
const { setTimeout: delay } = require('node:timers/promises');
const { isDeepStrictEqual } = require('node:util');
const { EosModuleConfigStore } = require('./eosModuleConfigStore');

const SOURCES = Object.freeze({ ui: 'nexowatt-ui', devices: 'nexowatt-devices', eebus: 'eebus', backup: 'nexowatt-backup' });
const VERSIONS = Object.freeze({ ui: ['1.0.35', '1.0.36', '1.0.37', '1.0.38'], devices: ['0.5.176'], eebus: ['0.3.0'], backup: ['1.0.10'] });
const ACL = { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600, state: 0x600 };
const HOST_MAX_AGE_MS = 60000;
const fail = code => Object.assign(new Error(code), { code });
const record = value => value && typeof value === 'object' && !Array.isArray(value);
function copy(value) {
    const text = JSON.stringify(value);
    if (!text || Buffer.byteLength(text) > 512 * 1024) throw fail('EOS_MIGRATION_CONFIG_SIZE');
    const result = JSON.parse(text);
    const visit = (item, depth = 0) => {
        if (depth > 20) throw fail('EOS_MIGRATION_CONFIG_DEPTH');
        if (item && typeof item === 'object') for (const key of Object.keys(item)) {
            if (['__proto__', 'constructor', 'prototype'].includes(key)) throw fail('EOS_MIGRATION_CONFIG_KEY');
            visit(item[key], depth + 1);
        }
    };
    visit(result); return result;
}
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nativeHash = object => fingerprint(object.native);
function decryptNative(owner, object) {
    const native = copy(object.native);
    const protectedFields = object.protectedNative || object.common?.protectedNative || [];
    if (!Array.isArray(protectedFields) || protectedFields.length > 64 || protectedFields.some(field => typeof field !== 'string' || !Object.hasOwn(native, field))) {
        throw fail('EOS_MIGRATION_PROTECTED_FIELDS_UNAVAILABLE');
    }
    const fields = object.encryptedNative || object.common?.encryptedNative || [];
    if (!Array.isArray(fields) || fields.length > 64) throw fail('EOS_MIGRATION_ENCRYPTED_FIELDS');
    // ioBroker encryptedNative describes top-level paths. Never guess from secret names
    // or reinterpret a plain protocol password as ciphertext.
    for (const field of fields) {
        if (typeof field !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(field)) throw fail('EOS_MIGRATION_ENCRYPTED_FIELDS');
        if (native[field] != null && native[field] !== '') {
            if (typeof native[field] !== 'string') throw fail('EOS_MIGRATION_CREDENTIAL_INVALID');
            try { native[field] = owner.decrypt(native[field]); }
            catch { throw fail('EOS_MIGRATION_CREDENTIAL_DECRYPTION'); }
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
        this.owner = owner; this.options = options;
        this.reader = Object.create(owner);
        for (const method of ['getForeignObjectAsync', 'getForeignStateAsync', 'getForeignStatesAsync', 'getObjectViewAsync']) {
            this.reader[method] = (...args) => this.read(Promise.resolve().then(() => owner[method](...args)));
        }
        this.store = new EosModuleConfigStore(owner, { moduleIds: [...Object.keys(SOURCES), 'migration'] });
        this.journal = null; this.phase = 'IDLE'; this.stopped = false; this.monitor = null;
    }
    read(operation) {
        let timer;
        return Promise.race([operation, new Promise((_, reject) => {
            timer = setTimeout(() => reject(fail('EOS_MIGRATION_DATABASE_TIMEOUT')), Math.min(this.options.readTimeoutMs || 5000, 5000));
        })]).finally(() => clearTimeout(timer));
    }
    allowsWrites() { return !['PREPARED', 'STOPPING', 'ROLLING_BACK', 'ROLLBACK_REQUIRED'].includes(this.phase); }
    block(code) { this.phase = 'ROLLBACK_REQUIRED'; this.journal = { ...this.journal, code: code || this.journal?.code || 'EOS_MIGRATION_RECOVERY_REQUIRED' }; }
    envelope(value, migration) {
        const text = JSON.stringify(copy(value)); const encrypted = this.owner.encrypt(text);
        if (typeof encrypted !== 'string' || !encrypted || encrypted === text) throw fail('EOS_MIGRATION_ENCRYPTION');
        return { v: 1, encrypted, ...(migration ? { migration } : {}) };
    }
    decode(envelope) {
        if (envelope?.v !== 1 || typeof envelope.encrypted !== 'string') throw fail('EOS_MIGRATION_FORMAT');
        try { return copy(JSON.parse(this.owner.decrypt(envelope.encrypted))); }
        catch { throw fail('EOS_MIGRATION_DECRYPTION'); }
    }
    async persist(phase) {
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
        } catch { this.owner.log.warn('EOS_MIGRATION_STATUS_UNAVAILABLE'); }
    }
    status() {
        return { phase: this.phase, code: this.journal?.code || '', sources: (this.journal?.sources || []).map(row => ({ id: row.id, source: row.source, namespacePreserved: ['TRANSFERRED', 'COMMITTED'].includes(this.phase) })), updatedAt: this.journal?.updatedAt || null };
    }
    async loadDestinations() {
        for (const id of Object.keys(SOURCES)) {
            const envelope = await this.read(this.store.load(id));
            if (!envelope) continue;
            if (id === 'ui') {
                this.owner.config.eosUi = this.decode(envelope);
                this.owner.config.eosUiMigration = envelope.migration || null;
            } else this.owner.config.eosModules = { ...this.owner.config.eosModules, [id]: envelope };
        }
    }
    async verifyDestinations() {
        for (const row of this.journal.sources) {
            // A committed handover must not fall back to package defaults or a
            // stale instance-native envelope if its protected destination is lost.
            const object = await this.reader.getForeignObjectAsync(this.store.objectId(row.id));
            if (!this.store.inspect(object, row.id)) throw fail('EOS_MIGRATION_DESTINATION_MISSING');
            const envelope = await this.read(this.store.load(row.id));
            if (envelope?.migration?.preserveNamespace !== true || envelope.migration.source !== row.source ||
                envelope.migration.sourceVersion !== row.sourceVersion) throw fail('EOS_MIGRATION_DESTINATION_BINDING');
            const config = this.decode(envelope);
            if (!record(config) || (row.id !== 'ui' && typeof config.enabled !== 'boolean')) throw fail('EOS_MIGRATION_CONFIG_INVALID');
            // Settings may legitimately have changed after commit. Validate the
            // stable source/namespace binding, not the original content hash.
        }
    }
    async saveUi(value) {
        const config = copy(value);
        // Host TLS, authentication and licensing are never restored from an old UI.
        for (const key of ['licenseKey', 'auth', 'port', 'secure', 'certPublic', 'certPrivate', 'certChained', 'bind']) delete config[key];
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
        return object?.common?.enabled === false && Number.isSafeInteger(object.ts) && alive?.val === false && alive.ack === true && alive.ts >= object.ts && await this.hostFresh(object.common.host);
    }
    matchesSource(object, row) {
        return !!object && nativeHash(object) === row.nativeHash && object.common?.host === row.host && object.common?.version === row.sourceVersion;
    }
    async candidate(id, object) {
        if (!record(object.native) || !VERSIONS[id]?.includes(object.common?.version) || typeof object.common.enabled !== 'boolean') throw fail('EOS_MIGRATION_SOURCE_VERSION');
        if (id === 'ui' && object.common.enabled !== true) throw fail('EOS_MIGRATION_DISABLED_UI_REVIEW');
        const source = object._id.slice('system.adapter.'.length);
        if (id !== 'ui' && this.owner.eosLicenseService?.allowsEmbeddedModule?.(id) !== true) throw fail('EOS_MIGRATION_MODULE_LICENSE_REQUIRED');
        const ownerObject = await this.reader.getForeignObjectAsync(`system.adapter.${this.owner.namespace}`);
        if (ownerObject?.common?.enabled !== true || !ownerObject.common.host || object.common.host !== ownerObject.common.host || !(await this.hostFresh(object.common.host))) throw fail('EOS_MIGRATION_SOURCE_HOST');
        const existing = await this.read(this.store.load(id));
        if (existing) throw fail('EOS_MIGRATION_DESTINATION_CONFIGURED');
        if (id === 'ui') {
            const defaults = require(join(this.options.baseDir, 'io-package.json')).native.eosUi || {};
            if (!isDeepStrictEqual(this.owner.config.eosUi || {}, defaults)) throw fail('EOS_MIGRATION_DESTINATION_CONFIGURED');
            for (const channel of ['smarthome', 'ems', 'chargepoints', 'energyFlow']) {
                if (await this.reader.getForeignObjectAsync(`${this.owner.namespace}.${channel}`)) throw fail('EOS_MIGRATION_DESTINATION_STATES');
            }
        }
        const config = decryptNative(this.owner, object);
        let prepared;
        if (id === 'ui') {
            const { readPreservedUiStates } = require(join(this.options.baseDir, 'ui/lib/preserved-ui-config'));
            const states = await readPreservedUiStates(this.reader, source);
            prepared = { config: { ...config }, requiredStates: states.requiredStates };
            for (const key of ['licenseKey', 'auth', 'port', 'secure', 'certPublic', 'certPrivate', 'certChained', 'bind']) delete prepared.config[key];
        } else {
            const factory = this.options.factories?.[id] || require(join(this.options.baseDir, 'modules', id, 'index.js'));
            if (typeof factory.preflightLegacyConfig === 'function') prepared = await factory.preflightLegacyConfig(config, {
                owner: this.reader, source, sourceVersion: object.common.version, sourceEnabled: object.common.enabled,
                dataDir: join(this.options.dataDir, 'modules', id), eosDataDir: this.options.dataDir, installationDir: this.options.installationDir,
            });
            else if (id === 'devices') prepared = { config: factory.validateConfig({ ...config, enabled: object.common.enabled === true }) };
            else throw fail('EOS_MIGRATION_PREFLIGHT_UNAVAILABLE');
            prepared.config.enabled = object.common.enabled === true;
            prepared.config = factory.validateConfig(prepared.config);
        }
        if (!record(prepared?.config)) throw fail('EOS_MIGRATION_CONFIG_INVALID');
        const migration = { source, sourceVersion: object.common.version, preserveNamespace: true,
            importedAt: new Date().toISOString(), statesCopied: false, mappingsRewritten: false,
            ...(id === 'ui' ? { requiredStates: prepared.requiredStates } : {}),
            identityImported: prepared.identityImported === true, omittedFields: id === 'ui' ? ['host transport/authentication/license fields'] : [] };
        return { id, source, enabled: object.common.enabled === true, nativeHash: nativeHash(object),
            host: object.common.host, sourceVersion: object.common.version, envelope: this.envelope(prepared.config, migration),
            prepareFiles: prepared.prepareFiles };
    }
    async rollback(code) {
        this.journal = { ...this.journal, code };
        await this.persist('ROLLING_BACK');
        // Called before any new runtime exists or after confirmed complete shutdown.
        for (const row of this.journal.sources || []) {
            const current = await this.reader.getForeignObjectAsync(`system.adapter.${row.source}`);
            if (!this.matchesSource(current, row)) {
                await this.persist('ROLLBACK_REQUIRED'); throw fail('EOS_MIGRATION_SOURCE_CHANGED');
            }
        }
        for (const row of this.journal.sources || []) {
            const current = await this.reader.getForeignObjectAsync(`system.adapter.${row.source}`);
            if (row.enabled && current.common.enabled !== true) await this.owner.extendForeignObjectAsync(`system.adapter.${row.source}`, { common: { enabled: true } });
        }
        const deadline = Date.now() + (this.options.stopTimeoutMs || 15000);
        while (true) {
            const checks = await Promise.all((this.journal.sources || []).filter(row => row.enabled).map(async row => {
                const object = await this.reader.getForeignObjectAsync(`system.adapter.${row.source}`);
                const alive = await this.reader.getForeignStateAsync(`system.adapter.${row.source}.alive`);
                return this.matchesSource(object, row) && object.common.enabled === true && alive?.val === true && alive.ack === true && alive.ts >= object.ts && await this.hostFresh(row.host);
            }));
            if (checks.every(Boolean)) break;
            if (Date.now() >= deadline) { await this.persist('ROLLBACK_REQUIRED'); throw fail('EOS_MIGRATION_ROLLBACK_UNCONFIRMED'); }
            await delay(100);
        }
        await this.persist('ROLLED_BACK');
    }
    async start() {
        try { await this.prepare(); }
        catch (error) { this.block(safeCode(error)); throw error; }
    }
    async checkLegacyRpc(candidates) {
        const sources = new Set(candidates.map(row => row.source));
        const inventory = await this.reader.getObjectViewAsync('system', 'instance', { startkey: 'system.adapter.', endkey: 'system.adapter.\u9999' });
        if (!Array.isArray(inventory?.rows) || inventory.rows.length > 512) throw fail('EOS_MIGRATION_RPC_INVENTORY');
        const refers = value => {
            if (typeof value === 'string') return sources.has(value);
            return !!value && typeof value === 'object' && Object.values(value).some(refers);
        };
        for (const row of inventory.rows) {
            const object = row.value;
            if (/^system\.adapter\.eos-admin\.\d+$/.test(object?._id || '') && object._id !== `system.adapter.${this.owner.namespace}`) {
                if (!(await this.stoppedSource(object._id.slice('system.adapter.'.length)))) throw fail('EOS_MIGRATION_PARALLEL_EOS');
            }
            if (!object?._id || object._id === `system.adapter.${this.owner.namespace}` || sources.has(object._id.slice('system.adapter.'.length)) || object.common?.enabled !== true) continue;
            if (refers(copy(object.native || {}))) throw fail('EOS_MIGRATION_EXTERNAL_RPC_REFERENCE');
        }
        const scripts = await this.reader.getObjectViewAsync('system', 'script', { startkey: 'script.', endkey: 'script.\u9999' });
        if (!Array.isArray(scripts?.rows) || scripts.rows.length > 5000) throw fail('EOS_MIGRATION_RPC_INVENTORY');
        for (const row of scripts.rows) {
            const script = row.value;
            if (script?.common?.enabled !== true) continue;
            const text = script.common.source;
            if (typeof text !== 'string' || Buffer.byteLength(text) > 2 * 1024 * 1024) throw fail('EOS_MIGRATION_SCRIPT_REVIEW');
            if (text.includes('sendTo') && [...sources].some(source => text.includes(source))) throw fail('EOS_MIGRATION_EXTERNAL_RPC_REFERENCE');
        }
    }
    async prepare() {
        await this.loadDestinations();
        const prior = await this.read(this.store.load('migration'));
        if (prior) {
            const journal = this.decode(prior);
            if (journal.v !== 1 || journal.owner !== this.owner.namespace || !['PREPARED', 'STOPPING', 'TRANSFERRED', 'COMMITTED', 'ROLLING_BACK', 'ROLLBACK_REQUIRED', 'ROLLED_BACK'].includes(journal.phase) || !Array.isArray(journal.sources) || journal.sources.length > 4 || new Set(journal.sources.map(row => row.id)).size !== journal.sources.length || journal.sources.some(row => !SOURCES[row.id] || !new RegExp(`^${SOURCES[row.id]}\\.\\d+$`).test(row.source) || !/^[a-f0-9]{64}$/.test(row.nativeHash) || typeof row.enabled !== 'boolean' || typeof row.host !== 'string' || !row.host || row.host.length > 255 || !VERSIONS[row.id].includes(row.sourceVersion))) throw fail('EOS_MIGRATION_JOURNAL_INVALID');
            this.journal = journal; this.phase = journal.phase;
            if (['TRANSFERRED', 'COMMITTED'].includes(this.phase)) await this.verifyDestinations();
            if (['PREPARED', 'STOPPING', 'ROLLING_BACK', 'ROLLBACK_REQUIRED'].includes(this.phase)) await this.rollback('EOS_MIGRATION_INTERRUPTED');
            // ROLLED_BACK is deliberately sticky: no retry loop interrupts a plant.
            await this.publish(); return;
        }
        if (this.owner.config.eosAutoMigrate === false) { this.phase = 'DISABLED'; return; }
        const license = this.owner.eosLicenseService?.statusView?.();
        if (license?.valid !== true || license.coreEnabled !== true) { this.phase = 'LICENSE_REQUIRED'; return; }
        const candidates = [];
        const observed = [];
        try {
            for (const [id, name] of Object.entries(SOURCES)) {
                const found = await this.reader.getObjectViewAsync('system', 'instance', { startkey: `system.adapter.${name}.`, endkey: `system.adapter.${name}.\u9999` });
                if (!Array.isArray(found?.rows) || found.rows.length > 64) throw fail('EOS_MIGRATION_INVENTORY');
                if (!found.rows.length) continue;
                for (const row of found.rows) {
                    if (row.value?.type !== 'instance' || !new RegExp(`^system\\.adapter\\.${name}\\.\\d+$`).test(row.value._id || '')) throw fail('EOS_MIGRATION_INVENTORY');
                    observed.push({ id, source: row.value._id.slice('system.adapter.'.length) });
                }
                if (found.rows.length !== 1) throw fail('EOS_MIGRATION_AMBIGUOUS');
                const inventory = found.rows[0].value;
                if (inventory?.type !== 'instance' || !new RegExp(`^system\\.adapter\\.${name}\\.\\d+$`).test(inventory._id || '')) throw fail('EOS_MIGRATION_INVENTORY');
                // Use the same ACL/protectedNative-aware read before, during and
                // after cutover. An unfiltered view must never supply a different
                // secret-bearing hash than a later adapter-core object read.
                const object = await this.reader.getForeignObjectAsync(inventory._id);
                if (object?.type !== 'instance' || object._id !== inventory._id) throw fail('EOS_MIGRATION_SOURCE_UNAVAILABLE');
                candidates.push(await this.candidate(id, object));
            }
            if (!candidates.length) { this.phase = 'NOT_NEEDED'; return; }
            await this.checkLegacyRpc(candidates);
        } catch (error) {
            this.phase = 'BLOCKED'; this.journal = { sources: observed, code: safeCode(error) };
            this.owner.log.warn(`EOS_MIGRATION_BLOCKED: ${safeCode(error)}; existing adapters remain unchanged`);
            await this.publish(); return;
        }
        this.journal = { sources: candidates.map(({ id, source, enabled, nativeHash: hash, sourceVersion, host }) => ({ id, source, enabled, nativeHash: hash, sourceVersion, host })) };
        await this.persist('PREPARED');
        try {
            await this.persist('STOPPING');
            for (const row of candidates) {
                const current = await this.reader.getForeignObjectAsync(`system.adapter.${row.source}`);
                if (!this.matchesSource(current, row) || current.common.enabled !== row.enabled) throw fail('EOS_MIGRATION_SOURCE_CHANGED');
                if (row.enabled) await this.owner.extendForeignObjectAsync(current._id, { common: { enabled: false } });
            }
            const deadline = Date.now() + (this.options.stopTimeoutMs || 15000);
            while (!(await Promise.all(candidates.map(row => this.stoppedSource(row.source)))).every(Boolean)) {
                if (Date.now() >= deadline || this.stopped) throw fail('EOS_MIGRATION_STOP_UNCONFIRMED');
                await delay(100);
            }
            for (const row of candidates) {
                const current = await this.reader.getForeignObjectAsync(`system.adapter.${row.source}`);
                if (!this.matchesSource(current, row)) throw fail('EOS_MIGRATION_SOURCE_CHANGED');
                if (row.id === 'ui') {
                    // Recheck after confirmed stop: an in-flight old save may have
                    // changed the JSON after preflight. Never activate partial data.
                    const { readPreservedUiStates } = require(join(this.options.baseDir, 'ui/lib/preserved-ui-config'));
                    const states = await readPreservedUiStates(this.reader, row.source, row.envelope.migration.requiredStates);
                    row.envelope.migration.requiredStates = states.requiredStates;
                }
                await row.prepareFiles?.();
                await this.store.save(row.id, row.envelope);
            }
            await this.persist('TRANSFERRED');
            await this.loadDestinations();
            this.owner.log.info('EOS_MIGRATION_TRANSFERRED: existing namespaces and settings retained; startup verification pending');
        } catch (error) {
            await this.rollback(safeCode(error));
        }
    }
    async verifyRuntime() {
        if (this.phase !== 'TRANSFERRED' || this.monitor) return;
        this.monitor = (async () => {
            const deadline = Date.now() + (this.options.startTimeoutMs || 45000);
            while (!this.stopped && Date.now() < deadline) {
                const rows = this.journal.sources;
                const ui = this.owner.eosHostedRuntime?.status?.();
                const modules = await Promise.all(rows.filter(row => row.id !== 'ui' && row.enabled).map(row => this.owner.eosModuleHost?.status(row.id)));
                if ((!rows.some(row => row.id === 'ui' && row.enabled) || (ui?.emsReady === true && ui.canWrite === true)) && modules.every(row => row?.active === true)) {
                    if ((await Promise.all(rows.map(row => this.stoppedSource(row.source)))).every(Boolean)) {
                        await this.persist('COMMITTED'); this.owner.log.info('EOS_MIGRATION_COMMITTED: configuration and startup verified; original adapters retained disabled'); return;
                    }
                }
                if (ui?.state === 'degraded' || modules.some(row => /FAILED|INVALID/.test(row?.reason || ''))) break;
                await delay(250);
            }
            if (this.stopped) return;
            await this.persist('ROLLING_BACK');
            // Stop first; never re-enable old actuators after a timed-out/uncertain stop.
            await Promise.all([this.owner.eosHostedRuntime?.stop(), this.owner.eosModuleHost?.stop()]);
            if ([...(this.owner.eosModuleHost?.entries?.values() || [])].some(entry => entry.stopFailed)) {
                await this.persist('ROLLBACK_REQUIRED'); return;
            }
            await this.rollback('EOS_MIGRATION_NEW_RUNTIME_FAILED');
        })().catch(async error => {
            this.phase = 'ROLLBACK_REQUIRED';
            this.owner.log.error(`EOS_MIGRATION_RECOVERY_REQUIRED: ${safeCode(error)}`);
            await this.publish();
        });
        return this.monitor;
    }
    stop() { this.stopped = true; }
}
function safeCode(error) { return typeof error?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : 'EOS_MIGRATION_FAILED'; }
module.exports = { EosLegacyMigration, decryptNative };
