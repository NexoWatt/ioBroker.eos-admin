"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createEosUiProcess = createEosUiProcess;
/** Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE. */
const node_child_process_1 = require("node:child_process");
const node_crypto_1 = require("node:crypto");
const node_http_1 = require("node:http");
const node_path_1 = require("node:path");
const node_perf_hooks_1 = require("node:perf_hooks");
const eosUiProcessRpc_1 = require("./eosUiProcessRpc");
const HOP_HEADERS = new Set([
    'connection',
    'keep-alive',
    'transfer-encoding',
    'upgrade',
    'proxy-authorization',
    'proxy-authenticate',
    'te',
    'trailer',
]);
function headers(input) {
    const result = {};
    for (const [key, value] of Object.entries(input)) {
        if (HOP_HEADERS.has(key.toLowerCase()) || key.toLowerCase().startsWith('x-eos-process-')) {
            continue;
        }
        if (typeof value === 'string' || (Array.isArray(value) && value.every(item => typeof item === 'string'))) {
            result[key] = value;
        }
    }
    return result;
}
function ownerMethod(owner, name, args) {
    const method = Reflect.get(owner, name);
    if (typeof method !== 'function') {
        throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_OWNER_API');
    }
    return Reflect.apply(method, owner, args);
}
async function presentationDatapoints(owner) {
    const objects = await ownerMethod(owner, 'getForeignObjectsAsync', ['*', 'state']);
    const projected = Object.create(null);
    if (!(0, eosUiProcessRpc_1.processRecord)(objects)) {
        return projected;
    }
    for (const id in objects) {
        if (!Object.prototype.hasOwnProperty.call(objects, id)) {
            continue;
        }
        const item = objects[id];
        if (!(0, eosUiProcessRpc_1.processRecord)(item) || !(0, eosUiProcessRpc_1.processRecord)(item.common)) {
            continue;
        }
        const { name, role, type, unit, read, write } = item.common;
        projected[id] = { common: { name, role, type, unit, read, write } };
    }
    return projected;
}
function configuration(owner, presentationOnly) {
    const config = (0, eosUiProcessRpc_1.processRecord)(owner.config) ? owner.config : {};
    if (presentationOnly) {
        const migration = (0, eosUiProcessRpc_1.processRecord)(config.eosUiMigration) ? config.eosUiMigration : {};
        const source = typeof migration.source === 'string' && /^nexowatt-ui\.\d+$/.test(migration.source)
            ? migration.source
            : undefined;
        return {
            eosUiMigration: { preserveNamespace: migration.preserveNamespace === true && !!source, source },
            port: config.port,
            secure: config.secure,
        };
    }
    return {
        eosUi: config.eosUi || {},
        eosUiMigration: config.eosUiMigration,
        port: config.port,
        secure: config.secure,
    };
}
/** One supervised worker with a generation-bound lease and parent-authenticated HTTP requests. */
function createEosUiProcess(owner, bridge, options) {
    const presentationOnly = options.presentationOnly === true;
    let child = null;
    let peer = null;
    let generation = '';
    let stopped = false;
    let paused = false;
    let writeFenced = true;
    let armed = false;
    let starting = null;
    let stopping = null;
    let subscriptionCleanup = null;
    let presentationRead = null;
    let heartbeat = null;
    let retry = null;
    let lastHealth = 0;
    let leaseSequence = 0;
    let privatePort = 0;
    let latestStatus = { state: 'starting', active: false, emsReady: false, canWrite: false };
    const pendingWrites = new Set();
    const requests = new Map();
    const subscriptions = new Map();
    const objectSubscriptions = new Map();
    const health = {
        mode: 'process',
        state: 'stopped',
        pid: null,
        generation: 0,
        restarts: 0,
        lastError: '',
        lastHeartbeatAt: 0,
        nextRestartAt: 0,
    };
    const current = (token) => !stopped &&
        !paused &&
        token === generation &&
        child !== null &&
        child.exitCode === null &&
        child.signalCode === null;
    const writable = (token) => !presentationOnly &&
        current(token) &&
        !writeFenced &&
        bridge.canWrite() === true &&
        node_perf_hooks_1.performance.now() - lastHealth < 5000;
    const snapshot = () => ({
        sequence: ++leaseSequence,
        expiresAt: Date.now() + 3000,
        license: bridge.getLicense(),
        readiness: presentationOnly ? undefined : bridge.getRuntimeReadiness?.(),
        canWrite: !presentationOnly && !stopped && !paused && !writeFenced && bridge.canWrite() === true,
        listening: bridge.isListening?.() === true,
    });
    const closeRequests = () => {
        for (const item of requests.values()) {
            item.response.destroy();
        }
        requests.clear();
    };
    const fault = (code) => {
        writeFenced = true;
        health.lastError = code;
        health.state = stopped || paused ? 'stopping' : 'failed';
        closeRequests();
        // No replacement until the old process has emitted exit and every dispatched write has completed.
        child?.kill('SIGKILL');
    };
    const cleanupSubscriptions = () => {
        if (subscriptionCleanup) {
            return subscriptionCleanup;
        }
        const releases = [...subscriptions.values()];
        subscriptions.clear();
        const objects = [...objectSubscriptions.entries()];
        objectSubscriptions.clear();
        subscriptionCleanup = Promise.allSettled([
            ...releases.map(async (value) => (await value)()),
            ...objects.map(async ([pattern, acquisition]) => {
                await acquisition;
                await ownerMethod(owner, 'unsubscribeForeignObjectsAsync', [pattern]);
            }),
        ])
            .then(results => {
            if (results.some(item => item.status === 'rejected')) {
                throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_SUBSCRIPTION_CLEANUP');
            }
        })
            .finally(() => {
            subscriptionCleanup = null;
        });
        return subscriptionCleanup;
    };
    const stateSubscription = async (method, args, token) => {
        const values = Array.isArray(args[0]) ? args[0] : [args[0]];
        if (values.length > 1024 ||
            values.some(value => typeof value !== 'string' || !value || value.length > 512 || value === '*')) {
            throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_SUBSCRIPTION_PATTERN');
        }
        for (const value of values) {
            const pattern = String(value);
            if (!current(token)) {
                throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_STOPPED');
            }
            if (method === 'unsubscribeForeignStatesAsync') {
                const release = subscriptions.get(pattern);
                if (release) {
                    await (await release)();
                    subscriptions.delete(pattern);
                }
            }
            else if (!subscriptions.has(pattern)) {
                if (subscriptions.size >= 2048) {
                    throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_SUBSCRIPTION_LIMIT');
                }
                const manager = Reflect.get(owner, 'eosStateSubscriptions');
                const acquire = (0, eosUiProcessRpc_1.processRecord)(manager) ? manager.acquireHost : undefined;
                const promise = typeof acquire === 'function'
                    ? Promise.resolve(Reflect.apply(acquire, manager, [pattern]))
                    : Promise.resolve(ownerMethod(owner, method, [pattern])).then(() => async () => {
                        await ownerMethod(owner, 'unsubscribeForeignStatesAsync', [pattern]);
                    });
                subscriptions.set(pattern, promise);
                try {
                    await promise;
                }
                catch (error) {
                    subscriptions.delete(pattern);
                    throw error;
                }
            }
        }
    };
    const callOwner = async (method, args, token) => {
        if (!current(token)) {
            throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_STOPPED');
        }
        if (presentationOnly) {
            if (method !== 'getForeignObjectsAsync' || args.length !== 2 || args[0] !== '*' || args[1] !== 'state') {
                throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_METHOD_DENIED');
            }
            // A failed or restarted GUI cannot submit another whole-catalog
            // read while the previous controller operation is still in flight.
            if (!presentationRead) {
                const reading = presentationDatapoints(owner);
                presentationRead = reading;
                const clear = () => {
                    if (presentationRead === reading) {
                        presentationRead = null;
                    }
                };
                void reading.then(clear, clear);
            }
            const projected = await presentationRead;
            if (!current(token)) {
                throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_STOPPED');
            }
            return projected;
        }
        if (!eosUiProcessRpc_1.UI_OWNER_ASYNC.has(method) && !['sendTo', 'checkPassword', 'saveUi'].includes(method)) {
            throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_METHOD_DENIED');
        }
        const mutation = /^(?:set|extend|del)/.test(method) ||
            method === 'saveUi' ||
            (method === 'sendTo' && args[1] !== 'getHistory');
        const operation = async () => {
            if (!current(token) || (mutation && !writable(token))) {
                throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_WRITE_FENCED');
            }
            if (method === 'subscribeForeignStatesAsync' || method === 'unsubscribeForeignStatesAsync') {
                return stateSubscription(method, args, token);
            }
            if (method === 'subscribeForeignObjectsAsync' || method === 'unsubscribeForeignObjectsAsync') {
                if (typeof args[0] !== 'string' || !args[0] || args[0].length > 512 || args[0] === '*') {
                    throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_SUBSCRIPTION_PATTERN');
                }
                if (method === 'subscribeForeignObjectsAsync') {
                    if (objectSubscriptions.has(args[0])) {
                        return objectSubscriptions.get(args[0]);
                    }
                    if (objectSubscriptions.size >= 128) {
                        throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_SUBSCRIPTION_LIMIT');
                    }
                    const acquisition = Promise.resolve().then(() => ownerMethod(owner, method, args));
                    objectSubscriptions.set(args[0], acquisition);
                    try {
                        return await acquisition;
                    }
                    catch (error) {
                        objectSubscriptions.delete(args[0]);
                        throw error;
                    }
                }
                if (!objectSubscriptions.has(args[0])) {
                    return;
                }
                await objectSubscriptions.get(args[0]);
                await ownerMethod(owner, method, args);
                objectSubscriptions.delete(args[0]);
                return;
            }
            if (method === 'saveUi') {
                const migration = Reflect.get(owner, 'eosMigration');
                if (!(0, eosUiProcessRpc_1.processRecord)(migration) || typeof migration.saveUi !== 'function') {
                    throw (0, eosUiProcessRpc_1.processError)('EOS_UI_MIGRATION_STORE_UNAVAILABLE');
                }
                return Reflect.apply(migration.saveUi, migration, args);
            }
            if (method === 'checkPassword') {
                return new Promise(resolve => {
                    ownerMethod(owner, method, [...args, (...value) => resolve(value)]);
                    // The enclosing IPC deadline bounds callers; this callback has no physical side effect.
                });
            }
            if (method === 'sendTo') {
                if (args.length === 4 && (0, eosUiProcessRpc_1.processRecord)(args[3])) {
                    ownerMethod(owner, method, args);
                    return undefined;
                }
                return new Promise(resolve => {
                    ownerMethod(owner, method, [...args.slice(0, 3), (result) => resolve(result)]);
                });
            }
            return ownerMethod(owner, method, args);
        };
        const result = Promise.resolve().then(operation);
        if (mutation) {
            pendingWrites.add(result);
            void result.then(() => pendingWrites.delete(result), () => pendingWrites.delete(result));
        }
        return result;
    };
    const dispatch = async (method, args, token) => {
        if (!current(token)) {
            throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_STOPPED');
        }
        if (method.startsWith('owner.')) {
            return callOwner(method.slice(6), args, token);
        }
        if (method === 'request.context' || method === 'request.access') {
            const request = typeof args[0] === 'string' ? requests.get(args[0]) : undefined;
            if (!request || request.generation !== token || request.response.destroyed) {
                throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_REQUEST_EXPIRED');
            }
            if (method === 'request.access') {
                if (!request.claimed) {
                    throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_REQUEST_EXPIRED');
                }
                const access = await bridge.resolveAccess(request.request);
                if (!current(token) || requests.get(String(args[0])) !== request || request.response.destroyed) {
                    throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_REQUEST_EXPIRED');
                }
                return access;
            }
            if (request.claimed ||
                node_perf_hooks_1.performance.now() - request.createdAt > 30_000 ||
                args[1] !== request.request.method ||
                args[2] !== request.request.url) {
                throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_REQUEST_EXPIRED');
            }
            request.claimed = true;
            return {
                originAllowed: bridge.originAllowed(request.request) === true,
                machineAllowed: bridge.machineRequestAllowed?.(request.request) === true,
                remoteAddress: request.request.socket.remoteAddress || '',
                encrypted: request.request.secure === true,
            };
        }
        if (method === 'bridge.deviceEmsPlan' ||
            method === 'bridge.resolveDeviceProfileReferences' ||
            method === 'bridge.hostedModuleFeedback') {
            if (!writable(token)) {
                throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_WRITE_FENCED');
            }
            const callback = Reflect.get(bridge, method.slice(7));
            if (typeof callback !== 'function') {
                throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_BRIDGE_UNAVAILABLE');
            }
            return Reflect.apply(callback, bridge, args);
        }
        throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_METHOD_DENIED');
    };
    const onEvent = (method, args, token) => {
        if (!current(token)) {
            return;
        }
        if (method === 'health' && (0, eosUiProcessRpc_1.processRecord)(args[0])) {
            lastHealth = node_perf_hooks_1.performance.now();
            health.lastHeartbeatAt = Date.now();
            latestStatus = args[0];
        }
        else if (!presentationOnly && method === 'bridge.deviceEmsConfigChanged') {
            bridge.deviceEmsConfigChanged?.();
        }
        else if (method === 'log' &&
            ['error', 'warn', 'info', 'debug'].includes(String(args[0])) &&
            typeof args[1] === 'string') {
            const log = Reflect.get(owner, 'log');
            const callback = (0, eosUiProcessRpc_1.processRecord)(log) ? log[String(args[0])] : undefined;
            if (typeof callback === 'function') {
                Reflect.apply(callback, log, [
                    `[ui-process] ${(0, eosUiProcessRpc_1.sanitizeUiProcessLog)(args[1], { config: owner.config, apiKey: process.env.NEXOWATT_OPEN_METEO_API_KEY })}`,
                ]);
            }
        }
    };
    const scheduleRestart = () => {
        if (stopped || paused || retry) {
            return;
        }
        if (pendingWrites.size) {
            health.state = 'failed';
            health.lastError = 'EOS_UI_PROCESS_WRITE_COMPLETION_UNKNOWN';
            return;
        }
        if (health.restarts >= 5) {
            health.state = 'failed';
            health.lastError = 'EOS_UI_PROCESS_RESTART_LIMIT';
            return;
        }
        health.restarts++;
        health.state = 'backoff';
        const delay = (options.restartDelayMs ?? 1000) * 2 ** (health.restarts - 1);
        health.nextRestartAt = Date.now() + delay;
        retry = setTimeout(() => {
            retry = null;
            void launch().catch(() => {
                /* exit schedules only after cleanup */
            });
        }, delay);
        retry.unref();
    };
    async function launch() {
        if (stopped || paused) {
            throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_STOPPED');
        }
        if (starting) {
            return starting;
        }
        if (!child && (pendingWrites.size || subscriptionCleanup)) {
            // Explicit startup is subject to the same drain barrier as an
            // automatic replacement after an unexpected process exit.
            throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_STOP_UNCONFIRMED');
        }
        starting = (async () => {
            if (child) {
                return;
            }
            generation = (0, node_crypto_1.randomBytes)(24).toString('hex');
            const token = generation;
            health.generation++;
            health.state = 'starting';
            health.nextRestartAt = 0;
            writeFenced = true;
            const spawned = (0, node_child_process_1.fork)(options.workerPath ?? (0, node_path_1.join)(__dirname, 'eosUiProcessWorker.js'), [], {
                stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
                serialization: 'json',
                execArgv: [],
                env: {
                    PATH: process.env.PATH,
                    LANG: process.env.LANG,
                    TZ: process.env.TZ,
                    NODE_ENV: process.env.NODE_ENV,
                    ...(!presentationOnly
                        ? {
                            IOBROKER_CONTROLLER_DIR: process.env.IOBROKER_CONTROLLER_DIR,
                            NEXOWATT_OPEN_METEO_API_KEY: process.env.NEXOWATT_OPEN_METEO_API_KEY,
                            NEXOWATT_ENERGYFLOW_TS_MODE: process.env.NEXOWATT_ENERGYFLOW_TS_MODE,
                            NODE_EXTRA_CA_CERTS: process.env.NODE_EXTRA_CA_CERTS,
                        }
                        : {}),
                },
            });
            child = spawned;
            health.pid = spawned.pid ?? null;
            const rpc = new eosUiProcessRpc_1.UiProcessRpc(spawned, token, (method, args) => dispatch(method, args, token), (method, args) => onEvent(method, args, token), code => {
                if (generation === token && child === spawned) {
                    fault(code);
                }
            });
            peer = rpc;
            lastHealth = node_perf_hooks_1.performance.now();
            spawned.once('error', () => {
                if (generation === token && child === spawned) {
                    fault('EOS_UI_PROCESS_SPAWN_FAILED');
                }
            });
            spawned.once('exit', () => {
                rpc.close();
                if (heartbeat) {
                    clearInterval(heartbeat);
                }
                heartbeat = null;
                if (child === spawned) {
                    child = null;
                    peer = null;
                    health.pid = null;
                    health.state = stopped || paused ? 'stopping' : 'failed';
                    if (!stopped && !paused && !health.lastError) {
                        health.lastError = 'EOS_UI_PROCESS_EXIT';
                    }
                    latestStatus = { ...latestStatus, emsReady: false, active: false, canWrite: false };
                    writeFenced = true;
                    closeRequests();
                }
                void cleanupSubscriptions().then(() => {
                    if (!stopped && !paused) {
                        scheduleRestart();
                    }
                }, () => {
                    health.state = 'failed';
                    health.lastError = 'EOS_UI_PROCESS_CLEANUP_FAILED';
                });
            });
            // The first private IPC frame supplies the generation; no command-line secrets or public listener.
            spawned.send({ kind: 'bootstrap', generation: token });
            const init = {
                namespace: owner.namespace,
                instance: owner.instance,
                config: configuration(owner, presentationOnly),
                runtimePath: options.runtimePath ?? (0, node_path_1.join)(options.baseDir, 'ui', 'main.js'),
                presentationOnly,
                snapshot: snapshot(),
            };
            writeFenced = false;
            heartbeat = setInterval(() => {
                if (!current(token)) {
                    return;
                }
                if (node_perf_hooks_1.performance.now() - lastHealth > 5000) {
                    fault('EOS_UI_PROCESS_HEARTBEAT_TIMEOUT');
                    return;
                }
                try {
                    rpc.notify('lease', [snapshot()]);
                }
                catch {
                    fault('EOS_UI_PROCESS_SEND_FAILED');
                }
            }, options.heartbeatMs ?? 500);
            heartbeat.unref();
            const initialized = await rpc.call('initialize', [init], 120_000);
            if (!(0, eosUiProcessRpc_1.processRecord)(initialized) ||
                !Number.isInteger(initialized.port) ||
                Number(initialized.port) < 1 ||
                Number(initialized.port) > 65535) {
                throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_HTTP_UNAVAILABLE');
            }
            privatePort = Number(initialized.port);
            if (!current(token)) {
                throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_STOPPED');
            }
            health.state = 'running';
            health.lastError = '';
            rpc.notify('lease', [snapshot()]);
            if (armed) {
                await rpc.call('startOperational', [], 120_000);
            }
        })()
            .catch(error => {
            fault('EOS_UI_PROCESS_START_FAILED');
            throw error;
        })
            .finally(() => {
            starting = null;
        });
        return starting;
    }
    const remote = (method, args = [], timeout) => peer && !stopped && !paused
        ? peer.call(method, args, timeout)
        : Promise.reject((0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_UNAVAILABLE'));
    const shutdown = (permanent) => {
        if (permanent) {
            stopped = true;
        }
        paused = true;
        if (stopping) {
            return stopping;
        }
        writeFenced = true;
        armed = false;
        health.state = 'stopping';
        if (retry) {
            clearTimeout(retry);
        }
        retry = null;
        if (heartbeat) {
            clearInterval(heartbeat);
        }
        heartbeat = null;
        closeRequests();
        const active = child;
        const rpc = peer;
        const initializing = starting;
        stopping = (async () => {
            if (active) {
                try {
                    await rpc?.call('stop', [], 10_000);
                }
                catch {
                    /* process exit below is the required boundary */
                }
                if (active.exitCode === null && active.signalCode === null) {
                    await new Promise((resolve, reject) => {
                        const timer = setTimeout(() => reject((0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_STOP_UNCONFIRMED')), 5000);
                        active.once('exit', () => {
                            clearTimeout(timer);
                            resolve();
                        });
                        active.kill('SIGKILL');
                    });
                }
            }
            await initializing?.catch(() => undefined);
            await Promise.all([...pendingWrites]);
            await cleanupSubscriptions();
            health.state = 'stopped';
            health.pid = null;
        })().catch(error => {
            health.state = 'failed';
            health.lastError = 'EOS_UI_PROCESS_STOP_UNCONFIRMED';
            throw error;
        });
        return stopping;
    };
    return {
        async start() {
            if (paused) {
                return;
            }
            await launch();
        },
        async startOperational() {
            if (paused || presentationOnly) {
                return;
            }
            armed = true;
            // Arm before awaiting initialization, so a transient launch failure does
            // not leave an automatically restarted EMS in presentation-only standby.
            if (starting) {
                await starting;
                return;
            }
            if (!child && !retry) {
                await launch();
                return;
            }
            peer?.notify('lease', [snapshot()]);
            await remote('startOperational', [], 120_000);
        },
        status() {
            return {
                ...latestStatus,
                ...(health.state !== 'running'
                    ? { state: stopped || paused ? health.state : 'degraded', error: health.lastError }
                    : {}),
                active: health.state === 'running' && current(generation),
                emsReady: health.state === 'running' && current(generation) && latestStatus.emsReady === true,
                canWrite: writable(generation),
                process: { ...health },
            };
        },
        getHistoryBackupRequirement() {
            return remote('getHistoryBackupRequirement');
        },
        async reconcileDeviceEms(devices) {
            return remote('reconcileDeviceEms', [devices]);
        },
        async reserveDeviceProfileChange(change) {
            const token = generation;
            const reservation = await remote('reserveDeviceProfileChange', [change]);
            return () => {
                if (generation === token) {
                    void remote('releaseDeviceProfileChange', [reservation]).catch(() => undefined);
                }
            };
        },
        onHostedEebusMessage(message) {
            return remote('onHostedEebusMessage', [message]);
        },
        onStateChange(id, state) {
            try {
                peer?.notify('onStateChange', [id, state]);
            }
            catch {
                fault('EOS_UI_PROCESS_EVENT_OVERFLOW');
            }
        },
        onObjectChange(id, object) {
            try {
                peer?.notify('onObjectChange', [id, object]);
            }
            catch {
                fault('EOS_UI_PROCESS_EVENT_OVERFLOW');
            }
        },
        onMessage(message) {
            void remote('onMessage', [message]).catch(() => undefined);
            return false;
        },
        revokeSessions() {
            closeRequests();
            try {
                peer?.notify('revokeSessions');
            }
            catch {
                fault('EOS_UI_PROCESS_SEND_FAILED');
            }
        },
        handle(req, res, next) {
            if (health.state !== 'running' || stopped || !child || requests.size >= 256) {
                res.status(503).json({ error: 'EOS_UI_UNAVAILABLE' });
                return;
            }
            const nonce = (0, node_crypto_1.randomBytes)(24).toString('hex');
            requests.set(nonce, {
                request: req,
                response: res,
                generation,
                claimed: false,
                createdAt: node_perf_hooks_1.performance.now(),
            });
            const outgoing = headers(req.headers);
            outgoing['x-eos-process-context'] = nonce;
            let body;
            if (req.body !== undefined) {
                try {
                    body = Buffer.isBuffer(req.body)
                        ? req.body
                        : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
                }
                catch {
                    requests.delete(nonce);
                    res.status(400).json({ error: 'EOS_UI_REQUEST_INVALID' });
                    return;
                }
                if (body.length > 16 * 1024 * 1024) {
                    requests.delete(nonce);
                    res.status(413).end();
                    return;
                }
                outgoing['content-length'] = String(body.length);
                // Parent middleware may already have inflated/parsed a login body.
                delete outgoing['content-encoding'];
                if (!Buffer.isBuffer(req.body) && typeof req.body !== 'string') {
                    outgoing['content-type'] = 'application/json; charset=utf-8';
                }
            }
            const request = (0, node_http_1.request)({
                host: '127.0.0.1',
                port: privatePort,
                path: req.url,
                method: req.method,
                headers: outgoing,
                agent: false,
            }, response => {
                if (response.headers['x-eos-process-fallthrough'] === '1') {
                    response.resume();
                    requests.delete(nonce);
                    next();
                    return;
                }
                res.statusCode = response.statusCode || 502;
                for (const [key, value] of Object.entries(headers(response.headers))) {
                    res.setHeader(key, value);
                }
                response.on('error', () => res.destroy());
                response.pipe(res);
            });
            request.on('error', () => {
                requests.delete(nonce);
                if (!res.headersSent) {
                    res.status(503).json({ error: 'EOS_UI_UNAVAILABLE' });
                }
                else {
                    res.destroy();
                }
            });
            const finish = () => {
                requests.delete(nonce);
                request.destroy();
            };
            res.once('close', finish);
            res.once('finish', finish);
            req.once('aborted', finish);
            // Stream piping provides backpressure in both directions, including long-lived SSE.
            if (body) {
                request.end(body);
            }
            else if (req.readableEnded) {
                request.end();
            }
            else {
                let received = 0;
                req.on('data', (chunk) => {
                    received += chunk.length;
                    if (received > 16 * 1024 * 1024) {
                        request.destroy();
                        res.status(413).end();
                    }
                });
                req.pipe(request);
            }
        },
        pause() {
            return shutdown(false);
        },
        async resume() {
            if (stopped) {
                throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_STOPPED');
            }
            if (stopping) {
                await stopping;
            }
            if (pendingWrites.size || child || subscriptionCleanup || starting) {
                throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_STOP_UNCONFIRMED');
            }
            stopping = null;
            paused = false;
            armed = !presentationOnly;
            health.restarts = 0;
            await launch();
        },
        stop() {
            return shutdown(true);
        },
    };
}
//# sourceMappingURL=eosUiProcess.js.map