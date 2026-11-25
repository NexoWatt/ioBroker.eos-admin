/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';

const { randomUUID } = require('node:crypto');
const MAX_ENVELOPE_BYTES = 1024 * 1024;
const MAX_CIPHERTEXT_BYTES = 2 * MAX_ENVELOPE_BYTES;
const DEFAULT_MODULE_IDS = Object.freeze(['devices', 'eebus', 'backup']);
const ALLOWED_STORE_IDS = Object.freeze([...DEFAULT_MODULE_IDS, 'ui', 'migration']);
const locks = new WeakMap();
const fail = code => Object.assign(new Error(code), { code });
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Bound and copy the complete envelope, including confidential migration metadata. */
function copyEnvelope(value) {
    let text;
    try {
        text = JSON.stringify(value);
    } catch {
        throw fail('EOS_MODULE_CONFIG_FORMAT');
    }
    if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_ENVELOPE_BYTES) {
        throw fail('EOS_MODULE_CONFIG_SIZE');
    }
    const result = JSON.parse(text);
    if (!record(result) || result.v !== 1 || typeof result.encrypted !== 'string' || !result.encrypted) {
        throw fail('EOS_MODULE_CONFIG_FORMAT');
    }
    const visit = (item, depth = 0) => {
        if (depth > 20) {
            throw fail('EOS_MODULE_CONFIG_DEPTH');
        }
        if (item && typeof item === 'object') {
            for (const key of Object.keys(item)) {
                if (['__proto__', 'prototype', 'constructor'].includes(key)) {
                    throw fail('EOS_MODULE_CONFIG_KEY');
                }
                visit(item[key], depth + 1);
            }
        }
    };
    visit(result);
    return result;
}

/**
 * Persist module settings outside the running adapter instance object. The controller
 * restarts an adapter on every write to system.adapter.NAME.N, including native-only
 * writes. An independent config object keeps the process and current login intact.
 */
class EosModuleConfigStore {
    constructor(owner, options = {}) {
        if (!/^eos-admin\.\d+$/.test(owner?.namespace || '')) {
            throw fail('EOS_MODULE_CONFIG_OWNER');
        }
        this.owner = owner;
        this.ids = new Set(options.moduleIds || DEFAULT_MODULE_IDS);
        if (!this.ids.size || [...this.ids].some(id => !ALLOWED_STORE_IDS.includes(id))) {
            throw fail('EOS_MODULE_UNKNOWN');
        }
        this.revisions = new Map();
        if (!locks.has(owner)) {
            locks.set(owner, new Set());
        }
    }

    objectId(id) {
        if (!this.ids.has(id)) {
            throw fail('EOS_MODULE_UNKNOWN');
        }
        return `${this.owner.namespace}.modules.${id}.configuration`;
    }

    inspect(object, id) {
        if (object == null) {
            return null;
        }
        const native = object.native;
        if (
            object._id !== this.objectId(id) ||
            object.type !== 'config' ||
            object.acl?.owner !== 'system.user.admin' ||
            object.acl?.ownerGroup !== 'system.group.administrator' ||
            object.acl?.object !== 0x600 ||
            !record(native) ||
            native.v !== 2 ||
            typeof native.revision !== 'string' ||
            !/^[a-f0-9-]{36}$/.test(native.revision) ||
            typeof native.encrypted !== 'string' ||
            !native.encrypted ||
            Buffer.byteLength(native.encrypted) > MAX_CIPHERTEXT_BYTES
        ) {
            throw fail('EOS_MODULE_CONFIG_STORE_INVALID');
        }
        return native;
    }

    async load(id) {
        const native = this.inspect(await this.owner.getForeignObjectAsync(this.objectId(id)), id);
        this.revisions.set(id, native?.revision || null);
        if (!native) {
            const legacy = this.owner.config.eosModules?.[id];
            return legacy == null ? undefined : copyEnvelope(legacy);
        }
        try {
            return copyEnvelope(JSON.parse(this.owner.decrypt(native.encrypted)));
        } catch {
            throw fail('EOS_MODULE_CONFIG_DECRYPTION');
        }
    }

    async save(id, envelope, canSave) {
        const objectId = this.objectId(id);
        const snapshot = copyEnvelope(envelope);
        // A host stop may happen while a database read is pending. Only a write
        // already issued to the database may finish after that lifecycle boundary.
        const assertWritable = () => {
            if (canSave && canSave() !== true) {
                throw fail('EOS_MODULE_STOPPED');
            }
        };
        assertWritable();
        const locked = locks.get(this.owner);
        if (locked.has(id)) {
            throw fail('EOS_MODULE_CONFIG_BUSY');
        }
        locked.add(id);
        try {
            if (!this.revisions.has(id)) {
                await this.load(id);
            }
            assertWritable();
            const current = await this.owner.getForeignObjectAsync(objectId);
            assertWritable();
            const native = this.inspect(current, id);
            if ((native?.revision || null) !== this.revisions.get(id)) {
                throw fail('EOS_MODULE_CONFIG_CONFLICT');
            }
            const plaintext = JSON.stringify(snapshot);
            const encrypted = this.owner.encrypt(plaintext);
            if (
                typeof encrypted !== 'string' ||
                !encrypted ||
                encrypted === plaintext ||
                Buffer.byteLength(encrypted) > MAX_CIPHERTEXT_BYTES
            ) {
                throw fail('EOS_MODULE_ENCRYPTION');
            }
            const revision = randomUUID();
            const object = {
                _id: objectId,
                type: 'config',
                common: { name: `EOS ${id} configuration` },
                native: { v: 2, revision, encrypted },
                acl: { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600 },
                ...(typeof current?._rev === 'string' ? { _rev: current._rev } : {}),
            };
            assertWritable();
            await this.owner.setForeignObjectAsync(objectId, object);
            const persisted = this.inspect(await this.owner.getForeignObjectAsync(objectId), id);
            if (persisted?.revision !== revision || persisted.encrypted !== encrypted) {
                throw fail('EOS_MODULE_CONFIG_CONFLICT');
            }
            this.revisions.set(id, revision);
            return snapshot;
        } finally {
            locked.delete(id);
        }
    }
}

module.exports = { EosModuleConfigStore };
