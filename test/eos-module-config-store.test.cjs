'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');
const { EosModuleConfigStore } = require('../src/lib/eosModuleConfigStore');
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

function fixture() {
    const key = randomBytes(32); const objects = new Map(); const writes = [];
    const owner = { namespace: 'eos-admin.0', config: { eosModules: {} },
        encrypt(text) { const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', key, iv);
            const bytes = Buffer.concat([cipher.update(text), cipher.final()]);
            return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64'); },
        decrypt(text) { const bytes = Buffer.from(text, 'base64'); const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
            cipher.setAuthTag(bytes.subarray(12, 28)); return Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString(); },
        async getForeignObjectAsync(id) { return clone(objects.get(id)); },
        async setForeignObjectAsync(id, object) { writes.push(id); objects.set(id, clone(object)); },
    };
    const envelope = { v: 1, encrypted: owner.encrypt(JSON.stringify({ enabled: true, password: 'device-fixture-secret' })),
        migration: { source: 'nexowatt-devices.0', oldPrefix: 'nexowatt-devices.0.' } };
    return { owner, objects, writes, envelope, store: new EosModuleConfigStore(owner) };
}

test('module persistence never writes the controller restart-triggering instance object', async () => {
    const f = fixture(); await f.store.save('devices', f.envelope);
    assert.deepEqual(f.writes, ['eos-admin.0.modules.devices.configuration']);
    const object = f.objects.get(f.writes[0]);
    assert.deepEqual(object.acl, { owner: 'system.user.admin', ownerGroup: 'system.group.administrator', object: 0x600 });
    assert.doesNotMatch(JSON.stringify(object), /device-fixture-secret|nexowatt-devices/);
    assert.deepEqual(await new EosModuleConfigStore(f.owner).load('devices'), f.envelope);
});

test('9.0.6 native config is retained as fallback only until a dedicated saved config exists', async () => {
    const f = fixture(); f.owner.config.eosModules.devices = clone(f.envelope);
    assert.deepEqual(await f.store.load('devices'), f.envelope);
    const updated = { ...f.envelope, migration: { source: 'nexowatt-devices.3' } };
    await f.store.save('devices', updated);
    assert.deepEqual(f.owner.config.eosModules.devices, f.envelope, 'persisted legacy object is untouched');
    assert.deepEqual(await new EosModuleConfigStore(f.owner).load('devices'), updated);
    assert.equal(await f.store.load('eebus'), undefined);
});

test('malformed or permissive persisted objects cannot silently restore stale native configuration', async () => {
    for (const mutate of [object => { object.type = 'state'; }, object => { object.acl.object = 0x664; },
        object => { object.native.encrypted = 'broken'; }, object => { object.native.v = 1; }]) {
        const f = fixture(); f.owner.config.eosModules.devices = clone(f.envelope); await f.store.save('devices', f.envelope);
        mutate(f.objects.get('eos-admin.0.modules.devices.configuration'));
        await assert.rejects(new EosModuleConfigStore(f.owner).load('devices'), /EOS_MODULE_CONFIG_(STORE_INVALID|DECRYPTION)/);
    }
});

test('stale config writer detects changed revision and keeps the newer stored envelope', async () => {
    const f = fixture(); await f.store.load('devices'); const another = new EosModuleConfigStore(f.owner);
    const latest = { ...f.envelope, migration: { source: 'nexowatt-devices.9' } };
    await another.save('devices', latest);
    await assert.rejects(f.store.save('devices', f.envelope), /EOS_MODULE_CONFIG_CONFLICT/);
    assert.deepEqual(await another.load('devices'), latest);
});

test('concurrent writes through the same running owner are bounded and never interleave', async () => {
    const f = fixture(); let release; const wait = new Promise(resolve => { release = resolve; });
    const set = f.owner.setForeignObjectAsync;
    f.owner.setForeignObjectAsync = async (...args) => { await wait; return set(...args); };
    const saving = f.store.save('devices', f.envelope);
    await assert.rejects(new EosModuleConfigStore(f.owner).save('devices', f.envelope), /EOS_MODULE_CONFIG_BUSY/);
    release(); await saving; assert.equal(f.writes.length, 1);
});

test('failed persistence and missing writeback never report successful save', async () => {
    const f = fixture(); f.owner.setForeignObjectAsync = async () => { throw new Error('database unavailable'); };
    await assert.rejects(f.store.save('devices', f.envelope), /database unavailable/);
    f.owner.setForeignObjectAsync = async () => {};
    await assert.rejects(f.store.save('devices', f.envelope), /EOS_MODULE_CONFIG_CONFLICT/);
});

test('module names, prototype keys and envelope sizes are validated before storage', async () => {
    const f = fixture();
    await assert.rejects(f.store.save('../system', f.envelope), /EOS_MODULE_UNKNOWN/);
    await assert.rejects(f.store.save('devices', JSON.parse('{"v":1,"encrypted":"x","__proto__":{"x":1}}')), /EOS_MODULE_CONFIG_KEY/);
    await assert.rejects(f.store.save('devices', { v: 1, encrypted: 'x'.repeat(1024 * 1024) }), /EOS_MODULE_CONFIG_SIZE/);
    f.owner.encrypt = value => value;
    await assert.rejects(f.store.save('devices', f.envelope), /EOS_MODULE_ENCRYPTION/);
    assert.equal(f.writes.length, 0);
});
