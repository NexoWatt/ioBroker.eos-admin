/** NexoWatt EOS OCPP hosting boundary. MIT; original station runtime remains attributed in provenance.json. */
import { readStationHistory, stationKey, type KnownStation } from './stationHistory';
import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import type { OcppRuntime, RuntimeEntry } from '../runtime';
import { createOcppRuntime } from '../runtime';
import {
    deriveConnectionHealth,
    activityTimeoutMs,
    dataFreshForEos,
    hasConfirmedSessionActivity,
} from '../ocpp/freshness';

export type RecordValue = Record<string, unknown>;
interface Adapter extends RecordValue {
    namespace: string;
    instance?: number;
    config?: RecordValue;
    log: Record<'warn' | 'info' | 'error' | 'debug', (message: string) => void>;
}
export interface HostedOptions {
    adapter: Adapter;
    config?: unknown;
    canOperate: () => boolean;
    getAuthorityGeneration?: () => number;
    onAuthorityLost?: () => void;
    dataDir?: string;
}
// Explicit synchronous CommonJS boundary; no global module-loader mutation.
const requireNative = createRequire(__filename);
const nativeDefaults: unknown = requireNative('../native-defaults.json');
const record = (value: unknown): value is RecordValue => !!value && typeof value === 'object' && !Array.isArray(value);
function failure(code: string): Error {
    return Object.assign(new Error(code), { code });
}
export const SOURCE_VERSION = '0.4.4';
export const UPSTREAM_VERSION = '0.4.3';
export const DEFAULTS: Readonly<RecordValue> = Object.freeze(
    record(nativeDefaults) ? structuredClone(nativeDefaults) : {},
);
export const defaults = DEFAULTS;
const numbers: Record<string, [number, number]> = {
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
const unsupportedTransport =
    /^(?:tls|ssl|https|certificate|cert|privateKey|clientCert|authorization|password|basicAuth|authToken)/i;
export function validateConfig(input: unknown = {}): RecordValue {
    if (!record(input) || Object.keys(input).length > 128 || JSON.stringify(input).length > 65536) {
        throw failure('EOS_OCPP_CONFIG_INVALID');
    }
    const output: RecordValue = structuredClone(DEFAULTS);
    for (const [key, value] of Object.entries(input)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) {
            throw failure('EOS_OCPP_CONFIG_KEY');
        }
        if (!Object.hasOwn(DEFAULTS, key)) {
            // The supplied native adapter has no TLS/authentication implementation.
            // Never silently accept a transport configuration that would weaken a migrated system.
            if (unsupportedTransport.test(key) && value !== false && value !== '' && value !== null) {
                throw failure('EOS_OCPP_TRANSPORT_REVIEW_REQUIRED');
            }
            throw failure('EOS_OCPP_CONFIG_KEY');
        }
        const original = DEFAULTS[key];
        if (typeof original === 'boolean' && typeof value !== 'boolean') {
            throw failure('EOS_OCPP_CONFIG_BOOLEAN');
        }
        if (typeof original === 'number') {
            const range = numbers[key];
            if (
                typeof value !== 'number' ||
                !Number.isFinite(value) ||
                !range ||
                value < range[0] ||
                value > range[1]
            ) {
                throw failure('EOS_OCPP_CONFIG_NUMBER');
            }
            if (
                [
                    'port',
                    'smartChargingConnectorId',
                    'maxDeferredTasks',
                    'maxRepublishedStates',
                    'maxConnectorsPerRefresh',
                ].includes(key) &&
                !Number.isInteger(value)
            ) {
                throw failure('EOS_OCPP_CONFIG_NUMBER');
            }
        }
        if (key === 'zeroLimitBehavior' && !['sendZero', 'keepLast', 'clearProfile'].includes(String(value))) {
            throw failure('EOS_OCPP_CONFIG_ZERO');
        }
        if (key === 'identityAllowlist') {
            if (
                !Array.isArray(value) ||
                value.length > 256 ||
                value.some(
                    item =>
                        typeof item !== 'string' ||
                        !item.trim() ||
                        item.trim().length > 128 ||
                        item.includes('/') ||
                        item.includes('\\') ||
                        [...item].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127),
                )
            ) {
                throw failure('EOS_OCPP_CONFIG_IDENTITIES');
            }
            output[key] = [...new Set(value.map(item => String(item).trim()))];
        } else {
            output[key] = structuredClone(value);
        }
    }
    if (output.enabled && !output.enable16 && !output.enable201 && !output.enable21) {
        throw failure('EOS_OCPP_CONFIG_PROTOCOL');
    }
    return output;
}
export function preflightLegacyConfig(
    input: unknown,
    context: unknown = {},
): Promise<{ config: RecordValue; identityImported: boolean }> {
    return Promise.resolve().then(() => {
        if (
            !record(context) ||
            (context.sourceVersion !== undefined &&
                (typeof context.sourceVersion !== 'string' || !['0.4.2', '0.4.3'].includes(context.sourceVersion)))
        ) {
            throw failure('EOS_OCPP_LEGACY_VERSION');
        }
        const config = validateConfig(input);
        return { config, identityImported: false };
    });
}
export const migrateLegacyConfig = preflightLegacyConfig;
export const normalizeConfig = validateConfig;

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
] as const;

export interface HostedStatus {
    started: boolean;
    state: string;
    sourceVersion: string;
    upstreamVersion: string;
    namespace: string;
    port: unknown;
    protocols: string[];
    lastError: string;
    stations: Array<{
        id: string;
        identity: string;
        protocol: string;
        connected: boolean;
        status: string;
        lastSeenMs: number;
        dataFresh: boolean;
        leaseArmed: boolean;
        leaseState: string;
    }>;
}
type StationHealthState = 'online' | 'offline' | 'unknown';
interface DashboardDeviceHealth {
    complete: boolean;
    state: 'ok' | 'unknown' | 'fault';
    offline: { name: string }[];
    totalOffline: number;
    tracked: { key: string; name: string; state: StationHealthState }[];
}
export interface HostedModule {
    getDashboardDeviceHealth(): DashboardDeviceHealth;
    start(): Promise<void>;
    stop(): Promise<void>;
    getStatus(): HostedStatus;
    onStateChange(id: unknown, state: unknown): Promise<void>;
    command(name: unknown): Promise<HostedStatus>;
}
export function createHostedModule(options: HostedOptions): HostedModule {
    const { adapter } = options;
    if (
        !adapter ||
        !/^(?:eos-admin\.\d+\.ocpp|ocpp21\.\d+)$/.test(adapter.namespace) ||
        typeof options.canOperate !== 'function'
    ) {
        throw failure('EOS_OCPP_HOST_INVALID');
    }
    const settings = validateConfig(options.config);
    const operation = new AsyncLocalStorage<number>();
    let generation = 0;
    let authorityGeneration = options.getAuthorityGeneration?.() ?? 0;
    let revoked = false;
    let started = false;
    let state = settings.enabled ? 'stopped' : 'disabled';
    let lastError = '';
    let runtime: OcppRuntime | null = null;
    let starting: Promise<void> | null = null;
    let stopping: Promise<void> | null = null;
    let authorityTimer: NodeJS.Timeout | null = null;
    let aliveTimer: NodeJS.Timeout | null = null;
    const allowed = (): boolean => {
        if ((!options.canOperate() || (options.getAuthorityGeneration?.() ?? 0) !== authorityGeneration) && !revoked) {
            revoked = true;
            generation++;
            options.onAuthorityLost?.();
        }
        return (
            !revoked && settings.enabled === true && options.canOperate() && state !== 'stopping' && state !== 'stopped'
        );
    };
    const assert = (): void => {
        if (!allowed() || (operation.getStore() !== undefined && operation.getStore() !== generation)) {
            throw failure('EOS_OCPP_OPERATION_REVOKED');
        }
    };
    const call = async (method: string, args: unknown[], guarded = true): Promise<unknown> => {
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
    class HostedBase extends EventEmitter {
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
                        value: (...args: unknown[]): Promise<unknown> => call(method, args),
                    });
                }
            }
        }
    }
    const Runtime = createOcppRuntime(HostedBase);
    const publishAlive = async (alive: boolean): Promise<void> => {
        await call('setStateAsync', ['info.runtimeAlive', { val: alive, ack: true }], alive);
    };
    const stop = (): Promise<void> => {
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
                } catch {
                    /* parent releases the same scoped lease */
                }
                try {
                    await publishAlive(false);
                } catch {
                    /* parent generation fence may already be closed */
                }
            } finally {
                if (runtime === current) {
                    runtime = null;
                }
                state = 'stopped';
            }
        })();
        return stopping;
    };
    const dashboardKeys = new WeakMap<RuntimeEntry, string>();
    const configuredIdentities = new Set(Array.isArray(settings.identityAllowlist) ? settings.identityAllowlist : []);
    const allowedKeys = new Set([...configuredIdentities].map(id => stationKey(String(id))));
    let knownStations = new Map<string, KnownStation>();
    let historyComplete = false;
    let observationStarted = 0;
    let retryHistoryAfter = 0;
    const restoreHistory = async (): Promise<void> => {
        retryHistoryAfter = 0;
        const token = generation;
        const loaded = await readStationHistory(
            adapter.namespace,
            pattern => call('getStatesAsync', [pattern]),
            allowedKeys,
        );
        if (!allowed() || token !== generation) {
            return;
        }
        knownStations = loaded.complete ? loaded.known : new Map([...knownStations, ...loaded.known]);
        historyComplete = loaded.complete;
        retryHistoryAfter = loaded.readFailed ? Date.now() + 30000 : 0;
    };
    const start = (): Promise<void> => {
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
                // Inventory hydration cannot delay the WebSocket listener or physical control.
                void restoreHistory();
                await runtime.onReady();
                observationStarted = Date.now();
                assert();
                started = true;
                state = 'running';
                await publishAlive(true);
                let publishing = false;
                aliveTimer = setInterval(() => {
                    if (publishing || !allowed() || !runtime?.server) {
                        return;
                    }
                    if (retryHistoryAfter && Date.now() >= retryHistoryAfter) {
                        void restoreHistory();
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
            } catch (error) {
                lastError =
                    error instanceof Error && /^EOS_/.test(error.message) ? error.message : 'EOS_OCPP_START_FAILED';
                await stop();
                throw failure(lastError);
            }
        });
        return starting;
    };
    const connectionHealth = (entry: RuntimeEntry, now: number): ReturnType<typeof deriveConnectionHealth> =>
        deriveConnectionHealth({
            now,
            socketConnected: entry.socketConnected,
            connectedAt: entry.connectedAt,
            lastMessageAt: entry.lastMessageAt,
            lastHeartbeatAt: entry.lastHeartbeatAt,
            heartbeatIntervalSec: entry.heartbeatIntervalSec,
            heartbeatTimeoutFactor: settings.heartbeatTimeoutFactor,
            activityTimeoutSec: settings.activityTimeoutSec,
        });
    const getDashboardDeviceHealth = (): DashboardDeviceHealth => {
        const result: DashboardDeviceHealth = {
            state: 'ok',
            offline: [],
            totalOffline: 0,
            tracked: [],
            complete: false,
        };
        if (!settings.enabled) {
            result.complete = true;
            return result;
        }
        if (
            !started ||
            !runtime ||
            revoked ||
            state !== 'running' ||
            !options.canOperate() ||
            (options.getAuthorityGeneration?.() ?? 0) !== authorityGeneration
        ) {
            result.state = 'unknown';
            return result;
        }
        const now = Date.now();
        if (!historyComplete) {
            result.state = 'unknown';
        }
        const seen = new Set<string>();
        let ordinal = 0,
            eligible = 0,
            confirmedConfigured = 0;
        for (const entry of runtime.runtimeIndex.values()) {
            ordinal++;
            let key = dashboardKeys.get(entry);
            if (!key) {
                key = stationKey(entry.rawIdentity);
                dashboardKeys.set(entry, key);
            }
            const historical = knownStations.get(key);
            const confirmed = hasConfirmedSessionActivity(entry);
            if (!confirmed && !entry.dashboardPreviouslyConfirmed && !historical && !entry.socketConnected) {
                continue;
            }
            seen.add(key);
            eligible++;
            if ((confirmed || entry.dashboardPreviouslyConfirmed) && configuredIdentities.has(entry.rawIdentity)) {
                confirmedConfigured++;
            }
            let current: StationHealthState = 'unknown';
            if (confirmed) {
                current = connectionHealth(entry, now).online ? 'online' : 'offline';
            } else if ((entry.dashboardPreviouslyConfirmed || historical) && !entry.socketConnected) {
                current = 'offline';
            }
            // The native station object has an OCPP identity and no separate public display name.
            const name = `Ladestation ${ordinal}`;
            if (current === 'offline') {
                result.state = 'fault';
                result.totalOffline++;
                if (result.offline.length < 12) {
                    result.offline.push({ name });
                }
            } else if (current === 'unknown' && result.state !== 'fault') {
                result.state = 'unknown';
            }
            if (result.tracked.length < 256) {
                result.tracked.push({ key, name, state: current });
            }
        }
        const windowMs = activityTimeoutMs(
            settings.heartbeatIntervalSec,
            settings.heartbeatTimeoutFactor,
            settings.activityTimeoutSec,
        );
        for (const old of knownStations.values()) {
            if (seen.has(old.key)) {
                continue;
            }
            const name = `Ladestation ${++ordinal}`;
            const absent = old.offline || now - observationStarted > windowMs;
            if (absent) {
                result.state = 'fault';
                result.totalOffline++;
                if (result.offline.length < 12) {
                    result.offline.push({ name });
                }
            } else if (result.state !== 'fault') {
                result.state = 'unknown';
            }
            eligible++;
            if (allowedKeys.has(old.key)) {
                confirmedConfigured++;
            }
            if (result.tracked.length < 256) {
                result.tracked.push({ key: old.key, name, state: absent ? 'offline' : 'unknown' });
            }
        }
        // With open admission, earlier sessions may be missing after a worker restart.
        result.complete =
            historyComplete &&
            configuredIdentities.size > 0 &&
            confirmedConfigured === configuredIdentities.size &&
            eligible === result.tracked.length;
        return result;
    };
    const getStatus = (): HostedStatus => ({
        started: started && allowed(),
        state,
        sourceVersion: SOURCE_VERSION,
        upstreamVersion: UPSTREAM_VERSION,
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
            dataFresh: dataFreshForEos(
                connectionHealth(entry, Date.now()).online,
                entry.lastPowerAt > 0 && Date.now() - entry.lastPowerAt <= Number(settings.telemetryMaxAgeSec) * 1000,
                entry.socketConnected && entry.safeZeroAt > 0,
            ),
            leaseArmed: runtime?._eosLeases.get(id)?.armed === true,
            leaseState:
                runtime?._eosLeases.get(id)?.active === true
                    ? 'active'
                    : runtime?._eosLeases.get(id)?.armed === true
                      ? 'expired'
                      : 'unarmed',
        })),
    });
    const onStateChange = (id: unknown, value: unknown): Promise<void> => {
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
        getDashboardDeviceHealth,
        onStateChange,
        command: (name: unknown): Promise<HostedStatus> => {
            assert();
            if (name === 'status') {
                return Promise.resolve(getStatus());
            }
            throw failure('EOS_OCPP_COMMAND_UNSUPPORTED');
        },
    };
}
