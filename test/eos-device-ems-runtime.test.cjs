'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EosDeviceEmsService, resolveDeviceEmsTargets } = require('../src/lib/eosDeviceEmsService');
const { planDeviceEms, getDeviceEmsReferences } = require('../src/lib/eosDeviceEmsPlan');

function fixture(t, options = {}) {
    const namespace = options.namespace || 'eos-admin.0';
    const device = { id: 'station.port1', templateId: 'test-wallbox', name: 'Station', enabled: true };
    const baseId = `${namespace}.devices.${device.id}`;
    const object = (key, type, unit, write, capability, dpId) => ({
        _id: `${baseId}.aliases.v1.${key}`, type: 'state',
        common: { type, unit, read: true, write },
        native: { isAlias: true, aliasContractVersion: 1, aliasContractPath: key, deviceId: device.id,
            templateId: device.templateId, deviceClass: 'evCharger', capability, dpId },
    });
    const aliases = [object('r.power', 'number', 'W', false, 'read.power', 'Power'),
        object('ctrl.currentLimitA', 'number', 'A', true, 'write.currentLimitA', 'Limit')];
    const states = new Map([[`${baseId}.aliases.meta.manifest`, { ack: true, val: JSON.stringify({
        schemaVersion: 1, namespace: 'v1', standardPath: 'aliases.v1', templateId: device.templateId,
        deviceClass: 'evCharger', capabilities: ['read.power', 'write.currentLimitA'], missingRequired: [],
    }) }]]);
    const objects = Object.fromEntries(aliases.map(value => [value._id, value]));
    let generation = 1;
    let ready = true;
    const reads = [];
    const applies = [];
    const snapshot = () => ({ namespace, devices: [device], moduleEnabled: true, generation, ready });
    const owner = {
        getForeignStateAsync: async id => { reads.push(id); return states.get(id) || null; },
        getForeignObjectsAsync: async pattern => { reads.push(pattern); return objects; },
    };
    const service = new EosDeviceEmsService({ owner, getSnapshot: snapshot, canRun: () => true,
        apply: async devices => {
            applies.push(devices);
            return { changed: true, statuses: devices.map(row => ({ baseId: row.baseId, devId: row.devId,
                status: row.discoveryCode ? 'pending' : 'mapped', code: row.discoveryCode || 'COMMISSIONING_REQUIRED',
                target: 'settingsConfig.evcsList[0]', mappedFields: ['powerId', 'ctrlCurrentLimitAId'], missing: [] })) };
        },
    });
    t.after(() => service.stop());
    return { service, owner, states, objects, aliases, device, baseId, applies, reads, snapshot,
        increment: () => { generation++; }, ready: value => { ready = value; } };
}

for (const namespace of ['eos-admin.0', 'nexowatt-devices.4']) {
    test(`discovers real V1 aliases in ${namespace}, including dotted ids and command identity`, async t => {
        const x = fixture(t, { namespace });
        await x.service.flush();
        assert.equal(x.applies.length, 1);
        const row = x.applies[0][0];
        assert.equal(row.baseId, x.baseId);
        assert.equal(row.aliasMeta['ctrl.currentLimitA'].targetId, `${x.baseId}.Limit`);
        assert.equal(row.aliasMeta['ctrl.currentLimitA'].write, true);
        assert.equal(x.service.view().statuses[0].deviceId, 'station.port1');
        assert(x.reads.every(id => id.startsWith(`${namespace}.devices.station.port1.`)));
    });
}

test('missing metadata remains pending, then a later real manifest produces a mapping', async t => {
    const x = fixture(t);
    const id = `${x.baseId}.aliases.meta.manifest`;
    const saved = x.states.get(id); x.states.delete(id);
    await x.service.flush();
    assert.equal(x.service.view().state, 'pending');
    assert.deepEqual(x.applies[0][0].aliases, {});
    x.states.set(id, saved);
    x.service.event(id, true);
    await x.service.flush();
    assert.equal(x.service.view().state, 'ready');
    assert.equal(x.applies[1][0].aliasMeta['r.power'].unit, 'W');
});

test('stale template aliases, unoffered capabilities and foreign objects never become assignable', async t => {
    const x = fixture(t);
    x.aliases[0].native.templateId = 'old-template';
    const command = x.aliases[1];
    command.native.capability = 'write.notOffered';
    x.objects['admin.0.alive'] = { _id: 'admin.0.alive', type: 'state', common: { type: 'boolean' }, native: {} };
    await x.service.flush();
    assert.deepEqual(x.applies[0][0].aliases, {});
    assert.equal(x.service.view().state, 'pending');
});

test('manifest from a previous template and unacknowledged metadata are never trusted', async t => {
    const x = fixture(t);
    const id = `${x.baseId}.aliases.meta.manifest`;
    const raw = JSON.parse(x.states.get(id).val); raw.templateId = 'previous';
    x.states.set(id, { ack: true, val: JSON.stringify(raw) });
    await x.service.flush();
    assert.equal(x.applies[0][0].discoveryCode, 'EOS_EMS_ALIAS_CONTRACT_INVALID');
    x.states.set(id, { ack: false, val: JSON.stringify(raw) });
    await x.service.flush();
    assert.equal(x.applies[1][0].discoveryCode, 'EOS_EMS_ALIASES_PENDING');
});

test('telemetry events do not schedule discovery; only metadata and alias object changes do', async t => {
    const x = fixture(t);
    x.service.event(`${x.baseId}.aliases.v1.r.power`, true);
    x.service.event('admin.0.aliases.meta.manifest', true);
    assert.equal(x.service.timer, null);
    x.service.event(`${x.baseId}.aliases.meta.manifest`, true);
    const timer = x.service.timer;
    assert(timer);
    for (let i = 0; i < 100; i++) x.service.event(`${x.baseId}.aliases.v1.r.power`);
    assert.equal(x.service.timer, timer);
    await x.service.flush();
    assert.equal(x.applies.length, 1);
});

test('configuration generation changes during reads discard the obsolete inventory', async t => {
    const x = fixture(t);
    const original = x.owner.getForeignStateAsync;
    x.owner.getForeignStateAsync = async id => { const value = await original(id); x.increment(); return value; };
    await x.service.flush();
    assert.equal(x.applies.length, 0);
    assert.equal(x.service.view().code, 'EOS_EMS_CONFIGURATION_CHANGED');
});

test('stop blocks a delayed discovery from writing configuration and cancels retry timers', async t => {
    const x = fixture(t);
    let release;
    const blocker = new Promise(resolve => { release = resolve; });
    const original = x.owner.getForeignStateAsync;
    x.owner.getForeignStateAsync = async id => { await blocker; return original(id); };
    const operation = x.service.flush();
    const stopped = x.service.stop();
    release();
    await Promise.all([operation, stopped]);
    assert.equal(x.applies.length, 0);
    assert.equal(x.service.timer, null);
    assert.equal(x.service.view().state, 'stopped');
});

test('unready runtime never discovers or applies; error messages cannot leak credentials', async t => {
    const x = fixture(t);
    x.ready(false);
    await x.service.flush();
    assert.equal(x.reads.length, 0);
    assert.equal(x.service.view().state, 'pending');
    x.ready(true);
    x.service.options.apply = async () => { throw new Error('https://user:secret@device.local failed'); };
    await x.service.flush();
    assert.equal(x.service.view().code, 'EOS_EMS_ASSIGNMENT_FAILED');
    assert.equal(JSON.stringify(x.service.view()).includes('secret'), false);
});

test('inventory size and namespace are bounded; no foreign adapter scan occurs', async t => {
    const x = fixture(t);
    await assert.rejects(x.service.inventory({ ...x.snapshot(), namespace: 'admin.0' }), /INVENTORY_SCOPE/);
    await assert.rejects(x.service.inventory({ ...x.snapshot(), devices: Array.from({ length: 129 }, () => x.device) }), /INVENTORY_SCOPE/);
    assert.equal(x.reads.length, 0);
});

test('assignment conflicts remain visible and cannot be reported as ready', async t => {
    const x = fixture(t);
    x.service.options.apply = async () => ({ changed: false, statuses: [{
        baseId: x.baseId, devId: x.device.id, status: 'conflict', code: 'MANUAL_TARGET_OCCUPIED',
        target: 'settingsConfig.evcsList', mappedFields: [], missing: [],
    }] });
    await x.service.flush();
    assert.equal(x.service.view().state, 'error');
    assert.equal(x.service.view().code, 'EOS_EMS_ASSIGNMENT_CONFLICT');
    assert.equal(x.service.view().statuses[0].code, 'MANUAL_TARGET_OCCUPIED');
    assert.equal(x.service.timer, null);
});

test('actual manual ioBroker alias chain resolves to a known V1 command and prevents duplicate commissioning', async t => {
    const x = fixture(t);
    const devices = await x.service.inventory(x.snapshot());
    const config = { settingsConfig: { evcsList: [{ name: 'Customer settings', enabled: true, setCurrentAId: 'alias.0.customer.limit' }] } };
    const records = new Map([
        ['alias.0.customer.limit', { _id: 'alias.0.customer.limit', type: 'state', common: { alias: { id: 'alias.0.customer.actuator' } } }],
        ['alias.0.customer.actuator', { _id: 'alias.0.customer.actuator', type: 'state', common: {
            alias: { id: { read: 'raw.0.feedback', write: `${x.baseId}.aliases.v1.ctrl.currentLimitA` } },
        } }],
    ]);
    const reads = [];
    const targets = await resolveDeviceEmsTargets({ devices, references: getDeviceEmsReferences(config),
        owner: { getForeignObjectAsync: async id => { reads.push(id); return records.get(id) || null; } } });
    assert.equal(targets.writeTargets['alias.0.customer.limit'], `${x.baseId}.Limit`);
    assert.deepEqual(reads, ['alias.0.customer.limit', 'alias.0.customer.actuator']);
    const planned = planDeviceEms({ config, devices, ...targets, limits: { chargePoints: 50, batteries: 20 } });
    assert.equal(planned.statuses[0].code, 'CONTROL_TARGET_ALREADY_ASSIGNED');
    assert.deepEqual(planned.config.settingsConfig.evcsList, config.settingsConfig.evcsList);
});

test('split read and write aliases resolve independently with cached exact lookups', async () => {
    const reads = [];
    const objects = {
        'alias.0.split': { _id: 'alias.0.split', type: 'state', common: { alias: { id: { read: 'raw.0.reading', write: 'raw.0.command' } } } },
    };
    const result = await resolveDeviceEmsTargets({ devices: [], references: { read: ['alias.0.split'], write: ['alias.0.split'] },
        owner: { getForeignObjectAsync: async id => { reads.push(id); return objects[id] || null; } } });
    assert.equal(result.readTargets['alias.0.split'], 'raw.0.reading');
    assert.equal(result.writeTargets['alias.0.split'], 'raw.0.command');
    assert.equal(reads.filter(id => id === 'alias.0.split').length, 1);
    assert.equal(reads.length, 3);
});

test('older non-V1 own aliases retain their verified physical command identity', async t => {
    const x = fixture(t);
    const devices = await x.service.inventory(x.snapshot());
    const id = `${x.baseId}.aliases.currentLimitA`;
    const targets = await resolveDeviceEmsTargets({ devices, references: { read: [id], write: [id] },
        owner: { getForeignObjectAsync: async () => ({ _id: id, type: 'state', common: { type: 'number' },
            native: { isAlias: true, deviceId: x.device.id, templateId: x.device.templateId, dpId: 'Feedback', writeDpId: 'Limit' } }) } });
    assert.equal(targets.readTargets[id], `${x.baseId}.Feedback`);
    assert.equal(targets.writeTargets[id], `${x.baseId}.Limit`);
});

test('generated V1 heartbeat and computed readings remain resolvable on repeated commissioning', async t => {
    const x = fixture(t);
    const devices = await x.service.inventory(x.snapshot());
    const device = devices[0];
    delete device.aliasMeta['r.power'].targetId;
    for (const key of ['r.heartbeat', 'r.online']) device.aliasMeta[key] = {
        id: `${x.baseId}.aliases.v1.${key}`, exists: true, read: true, write: false,
        type: key === 'r.online' ? 'boolean' : 'number', unit: '', role: 'state',
    };
    const first = planDeviceEms({ config: {}, devices, limits: { chargePoints: 50 } });
    let reads = 0;
    const targets = await resolveDeviceEmsTargets({ devices, references: getDeviceEmsReferences(first.config),
        owner: { getForeignObjectAsync: async () => { reads++; throw new Error('Known V1 leaves need no other lookup'); } } });
    assert.equal(reads, 0);
    assert.equal(targets.readTargets[`${x.baseId}.aliases.v1.r.power`], `${x.baseId}.aliases.v1.r.power`);
    assert.equal(targets.readTargets[`${x.baseId}.aliases.v1.r.online`], `${x.baseId}.aliases.v1.r.online`);
    assert.equal(planDeviceEms({ config: first.config, devices, ...targets, limits: { chargePoints: 50 } }).changed, false);
});

test('legacy computed and heartbeat leaves are accepted only as read-only sources', async t => {
    const x = fixture(t);
    const devices = await x.service.inventory(x.snapshot());
    for (const kind of ['computed', 'heartbeat']) {
        const id = `${x.baseId}.aliases.r.${kind}`;
        const owner = { getForeignObjectAsync: async () => ({ _id: id, type: 'state', common: { read: true, write: false },
            native: { isAlias: true, aliasKind: kind, deviceId: x.device.id, templateId: x.device.templateId } }) };
        const targets = await resolveDeviceEmsTargets({ owner, devices, references: { read: [id], write: [] } });
        assert.equal(targets.readTargets[id], id);
        await assert.rejects(resolveDeviceEmsTargets({ owner, devices, references: { read: [], write: [id] } }), /RESOLUTION_PENDING/);
    }
});

test('alias cycles, uncertain reads and revoked authority cannot authorize a plan or leak errors', async () => {
    const options = { devices: [], references: { read: [], write: ['alias.0.loop'] },
        owner: { getForeignObjectAsync: async id => ({ _id: id, type: 'state', common: { alias: { id } } }) } };
    await assert.rejects(resolveDeviceEmsTargets(options), { message: 'EOS_EMS_TARGET_RESOLUTION_PENDING' });
    options.owner.getForeignObjectAsync = async () => { throw new Error('https://secret:password@device'); };
    await assert.rejects(resolveDeviceEmsTargets(options), { message: 'EOS_EMS_TARGET_RESOLUTION_PENDING' });
    let calls = 0;
    options.owner.getForeignObjectAsync = async () => { calls++; return null; };
    await assert.rejects(resolveDeviceEmsTargets({ ...options, canRun: () => false }), { message: 'EOS_EMS_TARGET_RESOLUTION_PENDING' });
    assert.equal(calls, 0);
    await assert.rejects(resolveDeviceEmsTargets({ ...options, references: { read: ['*'], write: [] } }), /REFERENCE_LIMIT/);
    assert.equal(calls, 0);
});
