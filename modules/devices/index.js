// @ts-check
'use strict';
/** @typedef {import('./contracts').DeviceConfig} DeviceConfig */
/** @typedef {import('./contracts').DevicesConfig} DevicesConfig */
/** @typedef {import('./contracts').DeviceTemplate} DeviceTemplate */
/** @typedef {import('./contracts').HostedRuntime} HostedRuntime */

/**
 * Hosted NexoWatt Devices 0.5.176, running inside the EOS adapter process.
 * The owner supplies an admin-authorized, encrypted configuration and a synchronous
 * central license/ownership gate. No Adapter instance or license authority is created.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');
const { guardDriver } = require('./operation-guard');
const SOURCE_VERSION = '0.5.176';
const MAX_DEVICES = 128;
const PROTOCOLS = ['modbusTcp', 'modbusRtu', 'modbusAscii', 'mqtt', 'http', 'taCmi', 'udp', 'speedwire', 'mbus', 'onewire', 'canbus', 'kostalTcp', 'kostalRs485'];
const DEFAULTS = Object.freeze({ enabled: false, pollIntervalMs: 5000, modbusTimeoutMs: 2000, registerAddressOffset: 0, devices: [] });
/** @type {Promise<{ templates: DeviceTemplate[], byId: Map<string, DeviceTemplate> }> | undefined} */
let registryPromise;

/** @param {string} code */
function failure(code) { return Object.assign(new Error(code), { code }); }
/** @param {unknown} value @returns {value is Record<string, unknown>} */
function record(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
/** @param {unknown} value @param {number} [depth] */
function assertJson(value, depth = 0) {
    if (depth > 16) throw failure('EOS_DEVICES_CONFIG_DEPTH');
    if (value === null || typeof value === 'boolean' || typeof value === 'string') {
        if (typeof value === 'string' && value.length > 65536) throw failure('EOS_DEVICES_CONFIG_STRING');
        return;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return;
    if (Array.isArray(value)) {
        if (value.length > 4096) throw failure('EOS_DEVICES_CONFIG_ARRAY');
        value.forEach(item => assertJson(item, depth + 1));
        return;
    }
    if (!record(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) throw failure('EOS_DEVICES_CONFIG_OBJECT');
    for (const [key, item] of Object.entries(value)) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) throw failure('EOS_DEVICES_CONFIG_KEY');
        assertJson(item, depth + 1);
    }
}
/** @param {unknown} value @param {number} fallback @param {number} min @param {number} max */
function integer(value, fallback, min, max) {
    if (value === undefined || value === '') return fallback;
    const parsed = typeof value === 'string' ? Number(value) : value;
    if (typeof parsed !== 'number' || !Number.isInteger(parsed) || parsed < min || parsed > max) throw failure('EOS_DEVICES_CONFIG_NUMBER');
    return parsed;
}
/** @param {unknown} [input] @returns {DevicesConfig} */
function validateConfig(input = {}) {
    if (!record(input)) throw failure('EOS_DEVICES_CONFIG_OBJECT');
    assertJson(input);
    if (Buffer.byteLength(JSON.stringify(input)) > 1048576) throw failure('EOS_DEVICES_CONFIG_SIZE');
    /** @type {DevicesConfig} */
    const config = JSON.parse(JSON.stringify(input));
    if (config.enabled !== undefined && typeof config.enabled !== 'boolean') throw failure('EOS_DEVICES_CONFIG_ENABLED');
    config.enabled = config.enabled === true;
    config.pollIntervalMs = integer(config.pollIntervalMs, 5000, 250, 600000);
    config.modbusTimeoutMs = integer(config.modbusTimeoutMs, 2000, 100, 60000);
    config.registerAddressOffset = integer(config.registerAddressOffset, 0, -100000, 100000);
    if (config.devices === undefined && typeof config.devicesJson === 'string') {
        try { config.devices = JSON.parse(config.devicesJson); } catch { throw failure('EOS_DEVICES_CONFIG_JSON'); }
    }
    delete config.devicesJson;
    if (config.devices !== undefined) assertJson(config.devices);
    if (config.devices === undefined) config.devices = [];
    if (!Array.isArray(config.devices) || config.devices.length > MAX_DEVICES) throw failure('EOS_DEVICES_CONFIG_DEVICES');
    const ids = new Set();
    for (const device of config.devices) {
        if (!record(device) || typeof device.id !== 'string' || !/^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,79}$/.test(device.id) || device.id.split('.').some(segment => !segment || ['__proto__', 'prototype', 'constructor'].includes(segment))) throw failure('EOS_DEVICES_CONFIG_ID');
        if (ids.has(device.id)) throw failure('EOS_DEVICES_DUPLICATE_ID');
        ids.add(device.id);
        if (typeof device.templateId !== 'string' || !device.templateId || device.templateId.length > 160) throw failure('EOS_DEVICES_CONFIG_TEMPLATE');
        if (!PROTOCOLS.includes(device.protocol)) throw failure('EOS_DEVICES_CONFIG_PROTOCOL');
        if (device.enabled !== undefined && typeof device.enabled !== 'boolean') throw failure('EOS_DEVICES_CONFIG_ENABLED');
        if (device.ems !== undefined) {
            if (!record(device.ems) || Object.keys(device.ems).some(key => !['mode', 'scope', 'flowSlot', 'group', 'activation'].includes(key))) throw failure('EOS_DEVICES_EMS_INTENT');
            const intent = device.ems;
            if (typeof intent.mode !== 'string' || !['auto', 'monitor', 'manual', 'singleStorage', 'storageFarm', 'gridMeter', 'generationMeter', 'consumptionMeter', 'pvInverter'].includes(intent.mode)) throw failure('EOS_DEVICES_EMS_INTENT');
            if (intent.scope !== undefined && (typeof intent.scope !== 'string' || !['M0', 'M1'].includes(intent.scope))) throw failure('EOS_DEVICES_EMS_SCOPE');
            if (intent.group !== undefined && (typeof intent.group !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(intent.group))) throw failure('EOS_DEVICES_EMS_GROUP');
            if (intent.flowSlot !== undefined && (typeof intent.flowSlot !== 'number' || !Number.isInteger(intent.flowSlot) || intent.flowSlot < 0 || intent.flowSlot > 10)) throw failure('EOS_DEVICES_EMS_SLOT');
            if (['generationMeter', 'pvInverter'].includes(intent.mode) && (typeof intent.flowSlot !== 'number' || intent.flowSlot < 0 || intent.flowSlot > 5)) throw failure('EOS_DEVICES_EMS_SLOT');
            if (intent.mode === 'consumptionMeter' && (typeof intent.flowSlot !== 'number' || intent.flowSlot < 1 || intent.flowSlot > 10)) throw failure('EOS_DEVICES_EMS_SLOT');
            if (['singleStorage', 'storageFarm', 'gridMeter'].includes(intent.mode) && intent.scope === undefined) throw failure('EOS_DEVICES_EMS_SCOPE');
            if (intent.activation !== undefined) {
                const activation = intent.activation;
                if (!record(activation) || Object.keys(activation).some(key => !['requested', 'requestId', 'limits'].includes(key))
                    || typeof activation.requested !== 'boolean' || typeof activation.requestId !== 'string'
                    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(activation.requestId)) throw failure('EOS_DEVICES_EMS_ACTIVATION');
                if (activation.limits !== undefined) {
                    const limits = activation.limits;
                    const numbers = ['maxChargeW', 'maxDischargeW', 'capacityKWh', 'minCurrentA', 'maxCurrentA', 'minPowerW', 'maxPowerW'];
                    if (!record(limits) || Object.keys(limits).some(key => ![...numbers, 'coupling', 'chargerType', 'phases'].includes(key))) throw failure('EOS_DEVICES_EMS_LIMITS');
                    for (const key of numbers) {
                        const value = Reflect.get(limits, key);
                        if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 10000000)) throw failure('EOS_DEVICES_EMS_LIMITS');
                    }
                    for (const key of ['coupling', 'chargerType']) {
                        const value = Reflect.get(limits, key);
                        if (value !== undefined && (typeof value !== 'string' || !['ac', 'dc'].includes(value))) throw failure('EOS_DEVICES_EMS_LIMITS');
                    }
                    if (limits.phases !== undefined && (typeof limits.phases !== 'number' || ![1, 3].includes(limits.phases))) throw failure('EOS_DEVICES_EMS_LIMITS');
                    if (typeof limits.minCurrentA === 'number' && typeof limits.maxCurrentA === 'number' && limits.minCurrentA > limits.maxCurrentA
                        || typeof limits.minPowerW === 'number' && typeof limits.maxPowerW === 'number' && limits.minPowerW > limits.maxPowerW) throw failure('EOS_DEVICES_EMS_LIMITS');
                }
            }
        }
        if (device.connection !== undefined && !record(device.connection)) throw failure('EOS_DEVICES_CONFIG_CONNECTION');
        const connection = device.connection || {};
        if (connection.insecureTls === true || connection.insecureTLS === true || connection.allowInsecureTls === true || connection.rejectUnauthorized === false) throw failure('EOS_DEVICES_TLS_VERIFICATION_REQUIRED');
        if (device.pollIntervalMs !== undefined && device.pollIntervalMs !== 0) device.pollIntervalMs = integer(device.pollIntervalMs, 5000, 250, 600000);
        for (const field of ['port', 'tcpPort', 'mqttPort']) {
            if (connection[field] !== undefined && connection[field] !== '') connection[field] = integer(connection[field], 502, 1, 65535);
        }
        // The editor cannot turn the CAN driver into a configurable command runner.
        if (device.protocol === 'canbus') {
            for (const binary of ['candump', 'cansend']) {
                const supplied = connection[`${binary}Path`];
                if (supplied && (typeof supplied !== 'string' || ![binary, `/usr/bin/${binary}`, `/bin/${binary}`].includes(supplied))) throw failure('EOS_DEVICES_CAN_BINARY');
            }
            const iface = connection.interface || connection.iface || connection.canInterface || 'can0';
            if (typeof iface !== 'string' || !/^[A-Za-z0-9_][A-Za-z0-9_.-]{0,31}$/.test(iface)) throw failure('EOS_DEVICES_CAN_INTERFACE');
        }
        // Only the documented kernel w1 interface is exposed, never arbitrary host files.
        if (device.protocol === 'onewire') {
            if (connection.basePath && !/^\/sys\/bus\/w1\/devices(?:\/|$)/.test(String(connection.basePath))) throw failure('EOS_DEVICES_ONEWIRE_PATH');
            for (const field of ['basePath', 'sensorId', 'file']) {
                if (connection[field] && (String(connection[field]).split('/').includes('..') || String(connection[field]).includes('\0'))) throw failure('EOS_DEVICES_ONEWIRE_PATH');
            }
        }
    }
    return config;
}

async function registry() {
    if (!registryPromise) registryPromise = fs.readFile(path.join(__dirname, 'lib/templates.json'), 'utf8').then(text => {
        const source = JSON.parse(text);
        /** @type {DeviceTemplate[]} */
        const templates = Array.isArray(source) ? source : source.templates;
        if (!Array.isArray(templates)) throw failure('EOS_DEVICES_CATALOG_INVALID');
        return { templates, byId: new Map(templates.map(template => [template.id, template])) };
    }).catch(error => { registryPromise = undefined; throw error; });
    return registryPromise;
}
async function listSerialPorts() {
    const ports = new Set();
    try {
        const serial = require('serialport');
        const found = await serial.SerialPort.list();
        for (const port of found) if (port && typeof port.path === 'string') ports.add(port.path);
    } catch { /* Device discovery remains available without native serial bindings. */ }
    for (const directory of ['/dev/serial/by-id', '/dev']) {
        try {
            for (const name of await fs.readdir(directory)) {
                if (directory.endsWith('by-id') || /^(?:tty(?:USB|ACM|AMA|S)\d+|rfcomm\d+|com\d+)$/.test(name)) ports.add(path.join(directory, name));
            }
        } catch { /* Not present on all supported hosts. */ }
    }
    return [...ports].sort().map(value => ({ value, label: value }));
}

async function getCatalog() {
    const { templates } = await registry();
    return { sourceVersion: SOURCE_VERSION, protocols: [...PROTOCOLS], templates: templates.map(template => ({ id: template.id, category: template.category, manufacturer: template.manufacturer, label: [template.manufacturer, template.model, template.name].filter(Boolean).join(' ') || template.id, protocols: template.protocols || [] })) };
}
/**
 * Alte 0.5.176-Instanzen können neben dem leeren devices-Standard ihre Geräte
 * ausschließlich in devicesJson speichern. Nur die Übernahme löst diese zwei
 * Quellen auf; normales Speichern eines bewusst geleerten Arrays bleibt leer.
 * Widersprüchliche gefüllte Quellen werden vor jeder Übernahme abgelehnt.
 * @param {unknown} input
 */
async function preflightLegacyConfig(input) {
    if (!record(input)) throw failure('EOS_DEVICES_CONFIG_OBJECT');
    assertJson(input);
    /** @type {Record<string, unknown>} */
    const legacy = JSON.parse(JSON.stringify(input));
    if (legacy.devicesJson !== undefined && legacy.devicesJson !== '') {
        if (typeof legacy.devicesJson !== 'string') throw failure('EOS_DEVICES_CONFIG_JSON');
        /** @type {unknown} */
        let parsed;
        try { parsed = JSON.parse(legacy.devicesJson); } catch { throw failure('EOS_DEVICES_CONFIG_JSON'); }
        if (!Array.isArray(parsed)) throw failure('EOS_DEVICES_CONFIG_DEVICES');
        assertJson(parsed);
        if (parsed.length) {
            if (legacy.devices === undefined || (Array.isArray(legacy.devices) && legacy.devices.length === 0)) legacy.devices = parsed;
            else if (!Array.isArray(legacy.devices) || !isDeepStrictEqual(legacy.devices, parsed)) throw failure('EOS_DEVICES_LEGACY_CONFIG_CONFLICT');
        }
    }
    delete legacy.devicesJson;
    const config = validateConfig(legacy);
    const catalog = await registry();
    for (const device of config.devices) {
        const template = catalog.byId.get(device.templateId);
        if (!template) throw failure('EOS_DEVICES_UNKNOWN_TEMPLATE');
        if (Array.isArray(template.protocols) && !template.protocols.includes(device.protocol)) throw failure('EOS_DEVICES_TEMPLATE_PROTOCOL');
    }
    return { config, omittedFields: [] };
}
/** @param {string} name @param {Record<string, unknown>} [payload] */
async function command(name, payload = {}) {
    if (!record(payload)) throw failure('EOS_DEVICES_COMMAND_PAYLOAD');
    if (!['getCategories', 'getManufacturers', 'getTemplates', 'getProtocols', 'listSerialPorts'].includes(name)) throw failure('EOS_DEVICES_COMMAND_UNKNOWN');
    if (name === 'listSerialPorts') return listSerialPorts();
    const catalog = await getCatalog();
    /** @param {string[]} values */
    const options = values => [...new Set(values)].filter(Boolean).sort().map(value => ({ value, label: value }));
    if (name === 'getCategories') return options(catalog.templates.map(template => template.category));
    if (name === 'getManufacturers') return options(catalog.templates.filter(template => !payload.category || template.category === payload.category).map(template => template.manufacturer));
    if (name === 'getProtocols') return options(catalog.templates.find(template => template.id === payload.templateId)?.protocols || PROTOCOLS);
    if (!payload.category || !payload.manufacturer) return [];
    return catalog.templates.filter(template => template.category === payload.category && template.manufacturer === payload.manufacturer).map(template => ({ value: template.id, label: template.label, description: template.id })).sort((left, right) => left.label.localeCompare(right.label));
}

/** @param {import('./contracts').HostedOptions} options */
function createHostedModule({ adapter, canOperate, config = {}, runtimeFactory }) {
    if (!adapter || typeof canOperate !== 'function') throw failure('EOS_DEVICES_HOST_REQUIRED');
    const settings = validateConfig(config);
    let active = false;
    let stopping = false;
    /** @type {Promise<void> | undefined} */
    let startPromise;
    /** @type {Promise<void> | undefined} */
    let stopPromise;
    let generation = 0;
    /** @type {NodeJS.Timeout | undefined} */
    let timer;
    let statusBusy = false;
    let state = 'disabled';
    let lastError = '';
    /** @type {boolean | undefined} */
    let lastConnection;
    /** @type {Map<string, HostedRuntime>} */
    const runtimes = new Map();
    function permitted() { try { return active && !stopping && canOperate() === true; } catch { return false; } }
    /** @param {boolean} connected */
    async function writeConnection(connected) {
        if (lastConnection === connected) return;
        await adapter.setStateAsync('modules.devices.info.connection', { val: connected, ack: true });
        lastConnection = connected;
    }
    async function refresh() {
        if (statusBusy || stopping) return;
        statusBusy = true;
        try {
            // The host owns shutdown and its confirmation. A temporarily expired
            // lease must not stop this module behind the host's back and leave a
            // permanently inactive runtime labelled RUNNING after lease renewal.
            // Every driver operation remains synchronously gated by permitted().
            const allowed = permitted();
            if (active) state = allowed ? 'running' : 'blocked';
            await writeConnection(allowed && [...runtimes.values()].some(runtime => runtime.started && runtime._hbOnline === true));
        } finally { statusBusy = false; }
    }
    async function start() {
        if (startPromise) return startPromise;
        if (active) return;
        if (stopPromise) await stopPromise;
        if (!settings.enabled) { state = 'disabled'; return; }
        if (canOperate() !== true) { state = 'blocked'; throw failure('EOS_DEVICES_NOT_AUTHORIZED'); }
        const epoch = ++generation;
        stopping = false;
        active = true;
        state = 'starting';
        startPromise = (async () => {
            const catalog = await registry();
            // Validate every profile before opening any transport.
            for (const device of settings.devices) {
                const template = catalog.byId.get(device.templateId);
                if (!template) throw failure('EOS_DEVICES_UNKNOWN_TEMPLATE');
                if (Array.isArray(template.protocols) && !template.protocols.includes(device.protocol)) throw failure('EOS_DEVICES_TEMPLATE_PROTOCOL');
            }
            await adapter.setObjectNotExistsAsync('modules.devices', { type: 'channel', common: { name: 'NexoWatt Devices' }, native: {} });
            await adapter.setObjectNotExistsAsync('modules.devices.info', { type: 'channel', common: { name: 'Status' }, native: {} });
            await adapter.setObjectNotExistsAsync('modules.devices.info.connection', { type: 'state', common: { name: 'Devices receiving live data', type: 'boolean', role: 'indicator.connected', read: true, write: false, def: false }, native: {} });
            await adapter.setObjectNotExistsAsync('devices', { type: 'channel', common: { name: 'NexoWatt Devices' }, native: {} });
            await writeConnection(false);
            let factory = runtimeFactory;
            if (!factory && settings.devices.some(device => device.enabled !== false)) {
                require('./lib/sungrowFastFeedbackPatch').install();
                const { DeviceRuntime } = require('./lib/deviceRuntime');
                factory = (device, template) => /** @type {HostedRuntime} */ (/** @type {unknown} */ (new DeviceRuntime(adapter, device, template, settings)));
            }
            const pendingDevices = settings.devices.filter(device => device.enabled !== false);
            let nextDevice = 0;
            const startDevice = async () => {
                while (nextDevice < pendingDevices.length) {
                    const device = pendingDevices[nextDevice++];
                    if (device.enabled === false) continue;
                    if (!permitted() || epoch !== generation) throw failure('EOS_DEVICES_STOPPED');
                    const template = structuredClone(catalog.byId.get(device.templateId));
                    if (!factory || !template) throw failure('EOS_DEVICES_RUNTIME_UNAVAILABLE');
                    const runtime = factory(structuredClone(device), template);
                    const createDriver = runtime._createDriver;
                    runtime._createDriver = function hostedDriver() { return guardDriver(createDriver.call(this), permitted); };
                    runtimes.set(device.id, runtime); // Include partially initialized runtimes in cleanup.
                    await runtime.initObjects();
                    if (!permitted() || epoch !== generation) throw failure('EOS_DEVICES_STOPPED');
                    await runtime.start({ backgroundInitialPoll: true });
                    if (!permitted() || epoch !== generation) { await runtime.stop(); throw failure('EOS_DEVICES_STOPPED'); }
                }
            };
            // Bound object provisioning to four workers. Initial network reads
            // remain owned by each runtime and never serialize all other devices.
            const results = await Promise.allSettled(Array.from({ length: Math.min(4, pendingDevices.length) }, startDevice));
            const failed = results.find(result => result.status === 'rejected');
            if (failed?.status === 'rejected') throw failed.reason;
            if (!permitted() || epoch !== generation) throw failure('EOS_DEVICES_STOPPED');
            state = 'running';
            timer = setInterval(() => { void refresh().catch(() => { lastError = 'EOS_DEVICES_STATUS_FAILED'; }); }, 1000);
            timer.unref?.();
        })().catch(async error => {
            lastError = typeof error?.code === 'string' && error.code.startsWith('EOS_DEVICES_') ? error.code : 'EOS_DEVICES_START_FAILED';
            state = 'error';
            await stop();
            state = 'error';
            throw failure(lastError);
        }).finally(() => { startPromise = undefined; });
        return startPromise;
    }
    /** @param {HostedRuntime} runtime */
    async function stopRuntime(runtime) {
        // Cleanup must continue even if the host has already revoked state writes.
        try { runtime._stopWriteLoop?.(); } catch { /* Continue closing hardware. */ }
        if (runtime._writeQueue?.clear) runtime._writeQueue.clear();
        const driver = runtime.driver;
        try { await runtime.stop(); }
        catch {
            // A revoked facade may reject final telemetry; close the captured
            // transport regardless, then distinguish a transport cleanup failure.
            if (driver) await driver.disconnect();
        } finally {
            runtime.driver = null;
            runtime.started = false;
        }
        if (driver?.hostedDisconnectFailed) throw failure('EOS_DEVICES_STOP_FAILED');
    }

    async function stop() {
        if (stopPromise) return stopPromise;
        stopping = true;
        active = false;
        generation++;
        if (timer) clearInterval(timer);
        timer = undefined;
        stopPromise = (async () => {
            const results = await Promise.allSettled([...runtimes.values()].map(runtime => stopRuntime(runtime)));
            if (results.some(result => result.status === 'rejected')) lastError = 'EOS_DEVICES_STOP_FAILED';
            runtimes.clear();
            if (lastConnection !== undefined) await writeConnection(false).catch(() => { lastError = 'EOS_DEVICES_STATUS_FAILED'; });
            state = settings.enabled ? 'stopped' : 'disabled';
            if (results.some(result => result.status === 'rejected')) throw failure('EOS_DEVICES_STOP_FAILED');
        })().finally(() => { stopPromise = undefined; });
        return stopPromise;
    }
    /** @param {string} id @param {import('./contracts').State | null | undefined} value */
    async function onStateChange(id, value) {
        if (!permitted() || !value || value.ack !== false || typeof id !== 'string') return;
        const sorted = [...runtimes.entries()].sort(([left], [right]) => right.length - left.length);
        for (const [deviceId, runtime] of sorted) {
            if (id.startsWith(`${adapter.namespace}.devices.${deviceId}.`)) {
                try { await runtime.handleStateChange(id, value); }
                catch { lastError = 'EOS_DEVICES_WRITE_FAILED'; adapter.log.warn('[EOS Devices] Device write failed; inspect the device status.'); }
                return;
            }
        }
    }
    function getStatus() { return { state, sourceVersion: SOURCE_VERSION, configured: settings.devices.length, running: runtimes.size, connected: lastConnection === true, lastError }; }
    return { start, stop, onStateChange, getStatus, getCatalog, command };
}
module.exports = { createHostedModule, validateConfig, preflightLegacyConfig, migrateLegacyConfig: preflightLegacyConfig, normalizeConfig: validateConfig, DEFAULTS, SOURCE_VERSION, command, getCatalog };
