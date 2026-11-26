'use strict';
/** Real shipped Web startup, migration journal, ownership leases, module host and child processes.
 * The controller DB, session store, license verdict and optional field hardware are local fixtures. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const net = require('node:net');
const { once } = require('node:events');
const { Module, createRequire } = require('node:module');
const { randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');
const { setTimeout: wait } = require('node:timers/promises');

const root = path.resolve(process.env.EOS_CUSTOMER_BOOT_ROOT || path.join(__dirname, '../..'));
const from = createRequire(path.join(root, 'package.json'));
const station = 'nexowatt-devices.0',
    oldUi = 'nexowatt-ui.0',
    site = 'eos-admin.0';
const gridId = station + '.devices.hausanschluss.aCTIVE_POWER';
const plantConfig = {
    siteName: 'Pilot 36',
    datapoints: { gridPointPower: gridId, batterySoc: station + '.devices.akku.batterySoc' },
    settings: { dynamicTariff: true },
    tariffProvider: {
        providerId: 'tibber',
        sourceId: 'tibber',
        country: 'DE',
        enabled: false,
        credentials: { accessToken: 'synthetic-local-only-tibber' },
        activateTariffLogic: true,
    },
};

async function port() {
    const server = http.createServer();
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const result = server.address().port;
    await new Promise(done => server.close(done));
    return result;
}

async function meter(t) {
    const peers = new Set();
    const sample = { reads: 0, connections: 0, writes: 0, watts: 1847 };
    const bus = net.createServer(socket => {
        peers.add(socket);
        sample.connections++;
        socket.on('close', () => peers.delete(socket));
        socket.on('error', () => {});
        let input = Buffer.alloc(0);
        socket.on('data', part => {
            input = Buffer.concat([input, part]);
            while (input.length >= 7 && input.length >= 6 + input.readUInt16BE(4)) {
                const length = 6 + input.readUInt16BE(4),
                    frame = input.subarray(0, length);
                input = input.subarray(length);
                const fc = frame[7],
                    address = frame.readUInt16BE(8),
                    count = frame.readUInt16BE(10);
                let reply;
                if (fc === 4 && count >= 1 && count <= 125) {
                    reply = Buffer.alloc(2 + 2 * count);
                    reply[0] = fc;
                    reply[1] = 2 * count;
                    if (address <= 12 && address + count >= 14) {
                        reply.writeFloatBE(sample.watts, 2 + (12 - address) * 2);
                        sample.reads++;
                    }
                } else {
                    sample.writes++;
                    reply = Buffer.from([fc | 128, 1]);
                }
                const hdr = Buffer.from(frame.subarray(0, 7));
                hdr.writeUInt16BE(1 + reply.length, 4);
                socket.write(Buffer.concat([hdr, reply]));
            }
        });
    });
    bus.listen(0, '127.0.0.1');
    await once(bus, 'listening');
    t.after(async () => {
        for (const peer of peers) peer.destroy();
        await new Promise(done => bus.close(done));
    });
    sample.device = {
        id: 'hausanschluss',
        enabled: true,
        name: 'Hausanschluss',
        templateId: 'meter.eastron.MeterEastronSdm120Impl',
        protocol: 'modbusTcp',
        pollIntervalMs: 1000,
        connection: { host: '127.0.0.1', port: bus.address().port, unitId: 1 },
    };
    return sample;
}

function loadWeb(dir, bundle) {
    const file = path.join(bundle, 'build/lib/web.js');
    const module = new Module(file);
    module.filename = file;
    module.paths = Module._nodeModulePaths(path.dirname(file));
    const original = module.require.bind(module);
    // Outside a js-controller installation adapter-core exits on import. Supply only the platform's
    // data-directory API inside the child; the dashboard, EMS, IPC and their supervisors stay real.
    const fromBundle = createRequire(path.join(bundle, 'package.json'));
    // Other server libraries also resolve adapter-core lazily. Give every parent import the
    // same controller API for this boot, including late authentication and recovery checks.
    const coreId = fromBundle.resolve('@iobroker/adapter-core');
    const platform = new Module(coreId);
    platform.filename = coreId;
    platform.loaded = true;
    platform.exports = {
        EXIT_CODES: { ADAPTER_REQUESTED_TERMINATION: 11 },
        I18n: { getTranslatedObject: key => ({ en: key }) },
        commonTools: { session: session => session.MemoryStore },
        controllerDir: path.join(dir, 'node_modules/iobroker.js-controller'),
        getAbsoluteInstanceDataDir: () => dir,
    };
    require.cache[coreId] = platform;
    const runtimeEntry = path.join(dir, 'hosted-ui.cjs');
    fs.writeFileSync(
        runtimeEntry,
        `'use strict';
const core = ${JSON.stringify(fromBundle.resolve('@iobroker/adapter-core'))};
require.cache[core] = { id:core, filename:core, loaded:true,
    exports:{ getAbsoluteInstanceDataDir: owner => require('node:path').join(${JSON.stringify(dir)},owner.namespace) } };
module.exports = require(${JSON.stringify(path.join(bundle, 'ui/main.js'))});
`,
    );
    module.require = name =>
        name === './eosSplitRuntime'
            ? {
                  createEosSplitRuntime(owner, bridge, options) {
                      return original(name).createEosSplitRuntime(owner, bridge, {
                          ...options,
                          runtimePath: runtimeEntry,
                      });
                  },
              }
            : original(name);
    module._compile(fs.readFileSync(file, 'utf8'), file);
    return module.exports.default;
}

async function fixture(t, options = {}) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eos-legacy-web-'));
    const key = randomBytes(32);
    const originConfig = {
        eosUi: structuredClone(from('./io-package.json').native.eosUi),
        auth: true,
        secure: false,
        bind: '127.0.0.1',
        port: await port(),
        eosMdnsEnabled: false,
        disableMcp: true,
    };
    const objects = new Map(),
        states = new Map(),
        toggles = [],
        logs = [],
        overlappingWriters = [];
    const objectsOf = (type, start, end) =>
        [...objects].filter(([id, o]) => o.type === type && id >= start && id <= end);
    function instance(name, enabled, version, native) {
        const id = 'system.adapter.' + name;
        objects.set(id, {
            _id: id,
            type: 'instance',
            ts: Date.now() - 1000,
            common: { name: name.replace(/\.\d+$/, ''), version, host: 'pi-lab', enabled },
            native: structuredClone(native),
        });
        states.set(id + '.alive', { val: enabled, ack: true, ts: Date.now() });
    }
    instance(site, true, from('./package.json').version, originConfig);
    objects.set('system.config', {
        _id: 'system.config',
        type: 'config',
        common: { language: 'de' },
        native: { secret: key.toString('hex') },
    });
    objects.set('system.meta.uuid', {
        _id: 'system.meta.uuid',
        type: 'meta',
        common: {},
        native: { uuid: '3ed3044a-dd83-4ab4-9abc-e5cdefe1410b' },
    });
    if (!options.fresh) {
        instance(oldUi, options.uiEnabled === true, '1.0.38', plantConfig);
        instance(station, true, '0.5.176', { devices: options.device ? [options.device] : [], pollIntervalMs: 5500 });
        const preserved = {
            _id: gridId,
            type: 'state',
            common: {
                type: 'number',
                read: true,
                write: false,
                unit: 'W',
                custom: { 'influxdb.0': { enabled: true } },
            },
            native: {},
        };
        objects.set(gridId, preserved);
        states.set(gridId, { val: 1432, ts: Date.now(), ack: true });
        const jsonId = oldUi + '.installer.configJson';
        objects.set(jsonId, {
            _id: jsonId,
            type: 'state',
            common: { type: 'string', role: 'json', read: true, write: true },
            native: {},
        });
        states.set(jsonId, { val: JSON.stringify(plantConfig), ts: Date.now(), ack: true });
    }
    states.set('system.host.pi-lab.alive', { val: true, ack: true, ts: Date.now() });
    const noteWrite = id => {
        if ([oldUi, station].some(ns => id.startsWith(ns + '.') && states.get('system.adapter.' + ns + '.alive')?.val))
            overlappingWriters.push(id);
    };
    let licensed = options.licensed !== false;
    let session;
    let web;
    const qualify = id => site + '.' + id;
    function setObject(id, value) {
        noteWrite(id);
        objects.set(id, { ...structuredClone(value), _id: id });
    }
    function setState(id, value, ack) {
        noteWrite(id);
        states.set(id, {
            ...(value && typeof value === 'object' && 'val' in value ? value : { val: value, ack: !!ack }),
            ts: Date.now(),
            q: 0,
        });
    }
    const owner = {
        namespace: site,
        name: 'eos-admin',
        host: 'pi-lab',
        instance: 0,
        config: structuredClone(originConfig),
        log: Object.fromEntries(
            ['info', 'warn', 'error', 'debug', 'silly'].map(k => [k, line => logs.push(String(line))]),
        ),
        eosSessionSecurity: { bindOAuthModel() {} },
        eosLicenseService: {
            statusView: () => ({
                valid: licensed,
                coreEnabled: licensed,
                edition: 'home',
                limits: { chargePoints: 3, batteries: 2 },
                features: ['energy', 'wallet', 'smartHome'],
            }),
            allowsEmbeddedModule: () => licensed,
        },
        encrypt(text) {
            const iv = randomBytes(12),
                cipher = createCipheriv('aes-256-gcm', key, iv);
            return Buffer.concat([iv, cipher.update(text), cipher.final(), cipher.getAuthTag()]).toString('base64');
        },
        decrypt(value) {
            const d = Buffer.from(value, 'base64'),
                cipher = createDecipheriv('aes-256-gcm', key, d.subarray(0, 12));
            cipher.setAuthTag(d.subarray(-16));
            return Buffer.concat([cipher.update(d.subarray(12, -16)), cipher.final()]).toString();
        },
        async getObjectViewAsync(_design, type, { startkey = '', endkey = '\uffff' } = {}) {
            return {
                rows: objectsOf(type, startkey, endkey).map(([id, value]) => ({ id, value: structuredClone(value) })),
            };
        },
        async getForeignObjectAsync(id) {
            return structuredClone(objects.get(id) || null);
        },
        async getForeignStateAsync(id) {
            return structuredClone(states.get(id) || null);
        },
        async getForeignStatesAsync(pattern = '*') {
            return Object.fromEntries([...states].filter(([id]) => id.startsWith(pattern.split('*')[0])));
        },
        async getForeignObjectsAsync() {
            return {};
        },
        async getStateAsync(id) {
            return this.getForeignStateAsync(qualify(id));
        },
        async getStatesAsync() {
            return {};
        },
        async getObjectAsync(id) {
            return this.getForeignObjectAsync(qualify(id));
        },
        async setForeignStateAsync(id, v, ack) {
            setState(id, v, ack);
        },
        async setForeignStateChangedAsync(id, v, ack) {
            setState(id, v, ack);
        },
        async setStateAsync(id, v, ack) {
            setState(qualify(id), v, ack);
        },
        async setStateChangedAsync(id, v, ack) {
            setState(qualify(id), v, ack);
        },
        async setState(id, v, ack) {
            setState(qualify(id), v, ack);
        },
        async setForeignObjectAsync(id, o) {
            setObject(id, o);
        },
        async setForeignObjectNotExistsAsync(id, o) {
            if (!objects.has(id)) setObject(id, o);
        },
        async setObjectNotExistsAsync(id, o) {
            return this.setForeignObjectNotExistsAsync(qualify(id), o);
        },
        async extendForeignObjectAsync(id, patch) {
            const was = objects.get(id) || {},
                ts = Date.now();
            const next = {
                ...was,
                ...patch,
                common: { ...was.common, ...patch.common },
                native: { ...was.native, ...patch.native },
                ts,
            };
            setObject(id, next);
            if (/^system\.adapter\..+\.\d+$/.test(id) && typeof patch.common?.enabled === 'boolean') {
                toggles.push({ id, enabled: patch.common.enabled });
                states.set(id + '.alive', { val: patch.common.enabled, ack: true, ts });
            }
        },
        async extendObjectAsync(id, obj) {
            return this.extendForeignObjectAsync(qualify(id), obj);
        },
        async delForeignObjectAsync(id) {
            objects.delete(id);
        },
        async delForeignStateAsync(id) {
            states.delete(id);
        },
        async subscribeForeignObjectsAsync() {},
        async subscribeForeignStatesAsync() {},
        async unsubscribeForeignStatesAsync() {},
        async subscribeStatesAsync() {},
        async unsubscribeStatesAsync() {},
        subscribeStates() {},
        on() {},
        off() {},
        async getCertificatesAsync() {
            return [];
        },
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        terminate(code) {
            logs.push('terminate ' + code);
        },
    };
    // Keep optional protocols completely local while exercising the real Devices and UI/EMS workers.
    const optional = { eebus: { enabled: false }, backup: { enabled: false }, ocpp: { enabled: false } };
    originConfig.eosModules = Object.fromEntries(
        Object.entries(optional).map(([id, cfg]) => [id, { v: 1, encrypted: owner.encrypt(JSON.stringify(cfg)) }]),
    );

    async function stop() {
        owner.eosMigration?.stop();
        owner.eosOwnership?.stop();
        const server = web?.server?.server;
        web?.close();
        server?.closeAllConnections();
        await Promise.all([
            owner.eosRuntimeControl?.close(),
            owner.eosModuleHost?.stop(),
            owner.eosHostedRuntime?.stop(),
        ]);
        web = undefined;
        session = undefined;
    }
    async function boot({ bundle = root, expectFailure = false } = {}) {
        const loader = createRequire(path.join(bundle, 'package.json'));
        const { EosLegacyMigration } = loader('./build/lib/eosLegacyMigration.js');
        const { createOwnershipGuard } = loader('./build/lib/eosUnifiedOwnership.js');
        if (session) throw Error('stop previous boot first');
        owner.config = structuredClone(originConfig);
        owner.eosMigration = new EosLegacyMigration(owner, {
            baseDir: bundle,
            dataDir: directory,
            installationDir: directory,
            stopTimeoutMs: 400,
            startTimeoutMs: 15000,
        });
        await owner.eosMigration.start();
        // Admin.onReady starts this monitor before it initializes ownership and Web.
        void owner.eosMigration.verifyRuntime().catch(() => logs.push('Migration monitor rejected'));
        owner.eosOwnership = createOwnershipGuard(owner);
        await owner.eosOwnership.start();
        session = true;
        const Web = loadWeb(directory, bundle);
        web = new Web(owner.config, owner, () => {}, {
            secret: 'synthetic-only-session-secret-for-loopback',
            systemLanguage: 'de',
        });
        await until(
            () => (expectFailure ? logs.some(line => line.startsWith('terminate ')) : web.server.server?.listening),
            expectFailure ? 'failed listener rollback' : 'listening',
        );
    }
    async function until(check, label, maxMs = 12000) {
        const stop = Date.now() + maxMs;
        do {
            if (await check()) return;
            await wait(35);
        } while (Date.now() < stop && !logs.some(line => line.startsWith('terminate ')));
        if (await check()) return;
        assert.fail(
            label +
                ': ' +
                JSON.stringify({
                    migration: owner.eosMigration?.status(),
                    ownership: owner.eosOwnership?.status(),
                    details: owner.eosHostedRuntime?.status?.(),
                    logs: logs.slice(-12),
                }),
        );
    }
    t.after(async () => {
        await stop();
        fs.rmSync(directory, { force: true, recursive: true });
    });
    return {
        owner,
        objects,
        states,
        toggles,
        overlappingWriters,
        originConfig,
        logs,
        boot,
        stop,
        until,
        instance,
        setLicense(value) {
            licensed = value;
        },
        address: () => `http://127.0.0.1:${web.server.server.address().port}`,
    };
}

module.exports = { from, station, oldUi, site, gridId, plantConfig, port, meter, fixture };
