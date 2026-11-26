"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeConfig = exports.migrateLegacyConfig = exports.defaults = exports.DEFAULTS = exports.UPSTREAM_VERSION = exports.SOURCE_VERSION = void 0;
exports.validateConfig = validateConfig;
exports.preflightLegacyConfig = preflightLegacyConfig;
exports.createHostedModule = createHostedModule;
/** NexoWatt EOS OCPP hosting boundary. MIT; original station runtime remains attributed in provenance.json. */
const node_async_hooks_1 = require("node:async_hooks");
const node_events_1 = require("node:events");
const node_module_1 = require("node:module");
const runtime_1 = require("../runtime");
const freshness_1 = require("../ocpp/freshness");
// Explicit synchronous CommonJS boundary; no global module-loader mutation.
const requireNative = (0, node_module_1.createRequire)(__filename);
const nativeDefaults = requireNative('../native-defaults.json');
const record = (value) => !!value && typeof value === 'object' && !Array.isArray(value);
function failure(code) {
    return Object.assign(new Error(code), { code });
}
exports.SOURCE_VERSION = '0.4.4';
exports.UPSTREAM_VERSION = '0.4.3';
exports.DEFAULTS = Object.freeze(record(nativeDefaults) ? structuredClone(nativeDefaults) : {});
exports.defaults = exports.DEFAULTS;
const numbers = {
    port: [1024, 65535],
    heartbeatIntervalSec: [10, 86400],
    healthCheckIntervalSec: [2, 60],
    activityTimeoutSec: [15, 3600],
    stateRefreshIntervalSec: [1, 3600],
    activeRefreshIntervalSec: [30, 86400],
    telemetryMaxAgeSec: [15, 3600],
    heartbeatTimeoutFactor: [1.2, 10],
    callTimeoutSec: [5, 120],
    maxConnectorsPerRefresh: [1, 128],
    maxRepublishedStates: [25, 10000],
    socMaxAgeSec: [30, 86400],
    maxRawPayloadBytes: [4096, 1048576],
    minimumChargingCurrentA: [0, 1000],
    nominalVoltageV: [1, 1000],
    maximumPhaseVoltageV: [1, 1000],
    smartChargingMinIntervalMs: [1000, 300000],
    smartChargingDeadbandW: [0, 100000],
    smartChargingDeadbandA: [0, 1000],
    smartChargingConnectorId: [0, 65535],
    maxDeferredTasks: [25, 10000],
    configurationRefreshDelaySec: [5, 3600],
    configurationReportTimeoutSec: [5, 3600],
};
const unsupportedTransport = /^(?:tls|ssl|https|certificate|cert|privateKey|clientCert|authorization|password|basicAuth|authToken)/i;
function validateConfig(input = {}) {
    if (!record(input) || Object.keys(input).length > 128 || JSON.stringify(input).length > 65536) {
        throw failure('EOS_OCPP_CONFIG_INVALID');
    }
    const output = structuredClone(exports.DEFAULTS);
    for (const [key, value] of Object.entries(input)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) {
            throw failure('EOS_OCPP_CONFIG_KEY');
        }
        if (!Object.hasOwn(exports.DEFAULTS, key)) {
            // The supplied native adapter has no TLS/authentication implementation.
            // Never silently accept a transport configuration that would weaken a migrated system.
            if (unsupportedTransport.test(key) && value !== false && value !== '' && value !== null) {
                throw failure('EOS_OCPP_TRANSPORT_REVIEW_REQUIRED');
            }
            throw failure('EOS_OCPP_CONFIG_KEY');
        }
        const original = exports.DEFAULTS[key];
        if (typeof original === 'boolean' && typeof value !== 'boolean') {
            throw failure('EOS_OCPP_CONFIG_BOOLEAN');
        }
        if (typeof original === 'number') {
            const range = numbers[key];
            if (typeof value !== 'number' ||
                !Number.isFinite(value) ||
                !range ||
                value < range[0] ||
                value > range[1]) {
                throw failure('EOS_OCPP_CONFIG_NUMBER');
            }
            if ([
                'port',
                'smartChargingConnectorId',
                'maxDeferredTasks',
                'maxRepublishedStates',
                'maxConnectorsPerRefresh',
            ].includes(key) &&
                !Number.isInteger(value)) {
                throw failure('EOS_OCPP_CONFIG_NUMBER');
            }
        }
        if (key === 'zeroLimitBehavior' && !['sendZero', 'keepLast', 'clearProfile'].includes(String(value))) {
            throw failure('EOS_OCPP_CONFIG_ZERO');
        }
        if (key === 'identityAllowlist') {
            if (!Array.isArray(value) ||
                value.length > 256 ||
                value.some(item => typeof item !== 'string' ||
                    !item.trim() ||
                    item.trim().length > 128 ||
                    item.includes('/') ||
                    item.includes('\\') ||
                    [...item].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127))) {
                throw failure('EOS_OCPP_CONFIG_IDENTITIES');
            }
            output[key] = [...new Set(value.map(item => String(item).trim()))];
        }
        else {
            output[key] = structuredClone(value);
        }
    }
    if (output.enabled && !output.enable16 && !output.enable201 && !output.enable21) {
        throw failure('EOS_OCPP_CONFIG_PROTOCOL');
    }
    return output;
}
function preflightLegacyConfig(input, context = {}) {
    return Promise.resolve().then(() => {
        if (!record(context) ||
            (context.sourceVersion !== undefined &&
                (typeof context.sourceVersion !== 'string' || !['0.4.2', '0.4.3'].includes(context.sourceVersion)))) {
            throw failure('EOS_OCPP_LEGACY_VERSION');
        }
        const config = validateConfig(input);
        return { config, identityImported: false };
    });
}
exports.migrateLegacyConfig = preflightLegacyConfig;
exports.normalizeConfig = validateConfig;
const methods = [
    'getObjectAsync',
    'getStateAsync',
    'getStatesAsync',
    'getObjectViewAsync',
    'setObjectNotExistsAsync',
    'extendObjectAsync',
    'setStateAsync',
    'setStateChangedAsync',
    'delObjectAsync',
    'subscribeStatesAsync',
    'unsubscribeStatesAsync',
    'setForeignObjectNotExistsAsync',
    'extendForeignObjectAsync',
    'delForeignObjectAsync',
];
function createHostedModule(options) {
    const { adapter } = options;
    if (!adapter ||
        !/^(?:eos-admin\.\d+\.ocpp|ocpp21\.\d+)$/.test(adapter.namespace) ||
        typeof options.canOperate !== 'function') {
        throw failure('EOS_OCPP_HOST_INVALID');
    }
    const settings = validateConfig(options.config);
    const operation = new node_async_hooks_1.AsyncLocalStorage();
    let generation = 0;
    let authorityGeneration = options.getAuthorityGeneration?.() ?? 0;
    let revoked = false;
    let started = false;
    let state = settings.enabled ? 'stopped' : 'disabled';
    let lastError = '';
    let runtime = null;
    let starting = null;
    let stopping = null;
    let authorityTimer = null;
    let aliveTimer = null;
    const allowed = () => {
        if ((!options.canOperate() || (options.getAuthorityGeneration?.() ?? 0) !== authorityGeneration) && !revoked) {
            revoked = true;
            generation++;
            options.onAuthorityLost?.();
        }
        return (!revoked && settings.enabled === true && options.canOperate() && state !== 'stopping' && state !== 'stopped');
    };
    const assert = () => {
        if (!allowed() || (operation.getStore() !== undefined && operation.getStore() !== generation)) {
            throw failure('EOS_OCPP_OPERATION_REVOKED');
        }
    };
    const call = async (method, args, guarded = true) => {
        if (guarded) {
            assert();
        }
        const fn = adapter[method];
        if (typeof fn !== 'function') {
            throw failure('EOS_OCPP_HOST_METHOD');
        }
        const value = await Reflect.apply(fn, adapter, args);
        if (guarded) {
            assert();
        }
        return value;
    };
    class HostedBase extends node_events_1.EventEmitter {
        namespace = adapter.namespace;
        instance = adapter.instance ?? Number(adapter.namespace.match(/\.(\d+)(?:\.ocpp)?$/)?.[1] || 0);
        config = settings;
        log = adapter.log;
        assertCanOperate = assert;
        constructor() {
            super();
            for (const method of methods) {
                if (typeof adapter[method] === 'function') {
                    Object.defineProperty(this, method, {
                        value: (...args) => call(method, args),
                    });
                }
            }
        }
    }
    const Runtime = (0, runtime_1.createOcppRuntime)(HostedBase);
    const publishAlive = async (alive) => {
        await call('setStateAsync', ['info.runtimeAlive', { val: alive, ack: true }], alive);
    };
    const stop = () => {
        if (stopping) {
            return stopping;
        }
        generation++;
        revoked = true;
        started = false;
        state = 'stopping';
        if (authorityTimer) {
            clearInterval(authorityTimer);
        }
        if (aliveTimer) {
            clearInterval(aliveTimer);
        }
        authorityTimer = aliveTimer = null;
        const current = runtime;
        stopping = (async () => {
            try {
                if (current) {
                    await current.onUnload(() => undefined);
                }
                try {
                    await call('unsubscribeStatesAsync', ['*'], false);
                }
                catch {
                    /* parent releases the same scoped lease */
                }
                try {
                    await publishAlive(false);
                }
                catch {
                    /* parent generation fence may already be closed */
                }
            }
            finally {
                if (runtime === current) {
                    runtime = null;
                }
                state = 'stopped';
            }
        })();
        return stopping;
    };
    const start = () => {
        if (starting) {
            return starting;
        }
        if (started) {
            return Promise.resolve();
        }
        if (!settings.enabled) {
            state = 'disabled';
            return Promise.resolve();
        }
        if (stopping) {
            return Promise.reject(failure('EOS_OCPP_STOPPED'));
        }
        state = 'starting';
        revoked = false;
        generation++;
        authorityGeneration = options.getAuthorityGeneration?.() ?? 0;
        const token = generation;
        starting = operation.run(token, async () => {
            try {
                assert();
                runtime = new Runtime();
                authorityTimer = setInterval(() => {
                    if (!allowed()) {
                        void stop().catch(() => {
                            lastError = 'EOS_OCPP_STOP_FAILED';
                        });
                    }
                }, 100);
                authorityTimer.unref();
                await call('setObjectNotExistsAsync', [
                    'info',
                    { type: 'channel', common: { name: 'OCPP runtime' }, native: {} },
                ]);
                for (const [id, name] of [
                    ['runtimeAlive', 'OCPP child process alive'],
                    ['eosHostedRuntime', 'Hosted OCPP runtime'],
                ]) {
                    await call('setObjectNotExistsAsync', [
                        `info.${id}`,
                        {
                            type: 'state',
                            common: { name, type: 'boolean', role: 'indicator', read: true, write: false, def: false },
                            native: {},
                        },
                    ]);
                }
                await call('setStateAsync', ['info.eosHostedRuntime', { val: true, ack: true }]);
                await runtime.onReady();
                assert();
                started = true;
                state = 'running';
                await publishAlive(true);
                let publishing = false;
                aliveTimer = setInterval(() => {
                    if (publishing || !allowed() || !runtime?.server) {
                        return;
                    }
                    publishing = true;
                    void publishAlive(true)
                        .catch(() => {
                        lastError = 'EOS_OCPP_ALIVE_UNAVAILABLE';
                    })
                        .finally(() => {
                        publishing = false;
                    });
                }, 5000);
                aliveTimer.unref();
            }
            catch (error) {
                lastError =
                    error instanceof Error && /^EOS_/.test(error.message) ? error.message : 'EOS_OCPP_START_FAILED';
                await stop();
                throw failure(lastError);
            }
        });
        return starting;
    };
    const getStatus = () => ({
        started: started && allowed(),
        state,
        sourceVersion: exports.SOURCE_VERSION,
        upstreamVersion: exports.UPSTREAM_VERSION,
        namespace: adapter.namespace,
        port: settings.port,
        protocols: [
            settings.enable16 ? 'ocpp1.6' : '',
            settings.enable201 ? 'ocpp2.0.1' : '',
            settings.enable21 ? 'ocpp2.1' : '',
        ].filter(Boolean),
        lastError,
        stations: [...(runtime?.runtimeIndex.entries() || [])].map(([id, entry]) => ({
            id,
            identity: entry.rawIdentity,
            protocol: entry.proto,
            connected: entry.socketConnected,
            status: entry.chargingState || '',
            lastSeenMs: entry.lastMessageAt || 0,
            dataFresh: (0, freshness_1.dataFreshForEos)((0, freshness_1.deriveConnectionHealth)({
                now: Date.now(),
                socketConnected: entry.socketConnected,
                connectedAt: entry.connectedAt,
                lastMessageAt: entry.lastMessageAt,
                lastHeartbeatAt: entry.lastHeartbeatAt,
                heartbeatIntervalSec: entry.heartbeatIntervalSec,
                heartbeatTimeoutFactor: settings.heartbeatTimeoutFactor,
                activityTimeoutSec: settings.activityTimeoutSec,
            }).online, entry.lastPowerAt > 0 && Date.now() - entry.lastPowerAt <= Number(settings.telemetryMaxAgeSec) * 1000, entry.socketConnected && entry.safeZeroAt > 0),
            leaseArmed: runtime?._eosLeases.get(id)?.armed === true,
            leaseState: runtime?._eosLeases.get(id)?.active === true
                ? 'active'
                : runtime?._eosLeases.get(id)?.armed === true
                    ? 'expired'
                    : 'unarmed',
        })),
    });
    const onStateChange = (id, value) => {
        if (typeof id !== 'string' || !record(value) || typeof value.ack !== 'boolean') {
            return Promise.resolve();
        }
        const token = generation;
        return operation.run(token, async () => {
            assert();
            const current = runtime;
            if (!started || !current) {
                throw failure('EOS_OCPP_INACTIVE');
            }
            await current.onStateChange(id, value);
            assert();
        });
    };
    return {
        start,
        stop,
        getStatus,
        onStateChange,
        command: (name) => {
            assert();
            if (name === 'status') {
                return Promise.resolve(getStatus());
            }
            throw failure('EOS_OCPP_COMMAND_UNSUPPORTED');
        },
    };
}
