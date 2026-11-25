"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = require("node:http");
const node_perf_hooks_1 = require("node:perf_hooks");
const node_module_1 = require("node:module");
const eosUiSecretCodec_1 = require("./eosUiSecretCodec");
const eosUiProcessRpc_1 = require("./eosUiProcessRpc");
const runtimeRequire = (0, node_module_1.createRequire)(__filename);
let rpc = null;
let runtime = null;
let server = null;
let stopping = false;
let initialized = false;
let leaseAt = 0;
let leaseSequence = 0;
let authority = {};
let heartbeat = null;
const timers = new Set();
const requests = new WeakMap();
const reservations = new Map();
let reservationId = 0;
function call(method, args = []) {
    return rpc ? rpc.call(method, args) : Promise.reject((0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_DISCONNECTED'));
}
function notify(method, args = []) {
    try {
        rpc?.notify(method, args);
    }
    catch {
        fail();
    }
}
function canWrite() {
    return !stopping && node_perf_hooks_1.performance.now() - leaseAt <= 3000 && authority.canWrite === true;
}
function updateAuthority(value) {
    if (stopping ||
        !Number.isSafeInteger(value.sequence) ||
        Number(value.sequence) <= leaseSequence ||
        typeof value.expiresAt !== 'number' ||
        value.expiresAt <= Date.now() ||
        value.expiresAt > Date.now() + 3500) {
        return;
    }
    authority = value;
    leaseSequence = Number(value.sequence);
    // A queued lease retains its original age instead of being renewed on delivery.
    leaseAt = node_perf_hooks_1.performance.now() - Math.max(0, 3000 - (value.expiresAt - Date.now()));
}
function fail() {
    stopping = true;
    authority = {};
    for (const timer of timers) {
        clearTimeout(timer);
    }
    // Parent death leaves no orphan regulator, TCP listener or periodic hardware operation.
    process.exitCode = 1;
    process.exit(1);
}
function localId(namespace, id) {
    if (typeof id !== 'string' || id.length > 512) {
        throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_STATE_ID');
    }
    return id.startsWith(`${namespace}.`) ? id : `${namespace}.${id}`;
}
function makeOwner(input) {
    const namespace = String(input.namespace);
    const owner = {
        namespace,
        instance: input.instance,
        name: 'eos-admin',
        config: input.config,
    };
    const invoke = (method, args) => {
        const mutating = /^(?:set|extend|del)/.test(method) ||
            method === 'saveUi' ||
            (method === 'sendTo' && args[1] !== 'getHistory');
        if (mutating && !canWrite()) {
            return Promise.reject((0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_WRITE_FENCED'));
        }
        // An admin event-loop stall must not replay an old physical setpoint after recovery.
        return rpc
            ? rpc.call(`owner.${method}`, args, mutating ? 2000 : 30_000)
            : Promise.reject((0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_DISCONNECTED'));
    };
    for (const name of eosUiProcessRpc_1.UI_OWNER_ASYNC) {
        owner[name] = (...args) => invoke(name, args);
        if (!name.endsWith('Async')) {
            continue;
        }
        const callbackName = name.slice(0, -5);
        owner[callbackName] = (...args) => {
            const callback = typeof args.at(-1) === 'function' ? args.pop() : undefined;
            const result = invoke(name, args);
            if (typeof callback === 'function') {
                void result.then(value => callback(null, value), error => callback(error));
                return undefined;
            }
            void result.catch(() => undefined);
            return result;
        };
    }
    for (const [name, foreign] of eosUiProcessRpc_1.UI_OWNER_LOCAL) {
        for (const suffix of ['', 'Async']) {
            owner[`${name}${suffix}`] = (id, ...args) => {
                const method = owner[`${foreign}${suffix}`];
                if (typeof method !== 'function') {
                    throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_OWNER_API');
                }
                const absolute = Array.isArray(id) ? id.map(item => localId(namespace, item)) : localId(namespace, id);
                return Reflect.apply(method, owner, [absolute, ...args]);
            };
        }
    }
    owner.eosMigration = { saveUi: (config) => invoke('saveUi', [config]) };
    owner.log = Object.fromEntries(['error', 'warn', 'info', 'debug', 'silly'].map(level => [
        level,
        (message) => notify('log', [
            level === 'silly' ? 'debug' : level,
            (0, eosUiProcessRpc_1.sanitizeUiProcessLog)(message, {
                config: owner.config,
                secret: input.secret,
                apiKey: process.env.NEXOWATT_OPEN_METEO_API_KEY,
            }),
        ]),
    ]));
    owner.setTimeout = (callback, ms, ...args) => {
        if (stopping ||
            typeof callback !== 'function' ||
            typeof ms !== 'number' ||
            !Number.isFinite(ms) ||
            timers.size >= 4096) {
            throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_TIMER_LIMIT');
        }
        const timer = setTimeout(() => {
            timers.delete(timer);
            if (!stopping) {
                Reflect.apply(callback, undefined, args);
            }
        }, ms);
        timers.add(timer);
        return timer;
    };
    owner.setInterval = (callback, ms, ...args) => {
        if (stopping ||
            typeof callback !== 'function' ||
            typeof ms !== 'number' ||
            !Number.isFinite(ms) ||
            ms < 1 ||
            timers.size >= 4096) {
            throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_TIMER_LIMIT');
        }
        const timer = setInterval(() => {
            if (!stopping) {
                Reflect.apply(callback, undefined, args);
            }
        }, ms);
        timers.add(timer);
        return timer;
    };
    owner.clearTimeout = owner.clearInterval = (timer) => {
        timers.delete(timer);
        clearTimeout(timer);
    };
    owner.sendTo = (...args) => {
        const callback = typeof args.at(-1) === 'function' ? args.pop() : undefined;
        const result = invoke('sendTo', args);
        if (typeof callback === 'function') {
            void result.then(value => callback(value), () => callback({ error: 'EOS_UI_PROCESS_CALL_FAILED' }));
            return undefined;
        }
        void result.catch(() => undefined);
        return result;
    };
    owner.checkPassword = (...args) => {
        const callback = args.pop();
        if (typeof callback !== 'function') {
            throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_CALLBACK_REQUIRED');
        }
        void invoke('checkPassword', args).then(value => {
            if (Array.isArray(value)) {
                callback(...value);
            }
            else {
                callback(false);
            }
        }, () => callback(false));
    };
    const codec = (0, eosUiSecretCodec_1.createUiSecretCodec)(input.secret);
    owner.encrypt = codec.encrypt;
    owner.decrypt = codec.decrypt;
    return owner;
}
const bridge = {
    getLicense: () => authority.license,
    getRuntimeReadiness: () => authority.readiness,
    canWrite,
    isListening: () => !stopping && authority.listening === true && node_perf_hooks_1.performance.now() - leaseAt <= 3000,
    resolveAccess: (req) => {
        const context = requests.get(req);
        return context
            ? call('request.access', [context.nonce])
            : Promise.reject((0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_REQUEST_EXPIRED'));
    },
    originAllowed: (req) => requests.get(req)?.context.originAllowed === true,
    machineRequestAllowed: (req) => requests.get(req)?.context.machineAllowed === true,
    deviceEmsPlan: (input) => call('bridge.deviceEmsPlan', [input]),
    deviceEmsConfigChanged: () => notify('bridge.deviceEmsConfigChanged'),
    resolveDeviceProfileReferences: (input) => call('bridge.resolveDeviceProfileReferences', [input]),
    hostedModuleFeedback: (input) => call('bridge.hostedModuleFeedback', [input]),
};
async function initialize(input) {
    if (stopping ||
        initialized ||
        !(0, eosUiProcessRpc_1.processRecord)(input) ||
        typeof input.namespace !== 'string' ||
        !/^eos-admin\.\d+$/.test(input.namespace) ||
        typeof input.runtimePath !== 'string' ||
        !(0, eosUiProcessRpc_1.processRecord)(input.snapshot)) {
        throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_INITIALIZATION');
    }
    initialized = true;
    updateAuthority(input.snapshot);
    const factory = runtimeRequire(input.runtimePath);
    if (!(0, eosUiProcessRpc_1.processRecord)(factory) || typeof factory.createHostedRuntime !== 'function') {
        throw (0, eosUiProcessRpc_1.processError)('EOS_UI_FACTORY_MISSING');
    }
    heartbeat = setInterval(() => {
        if (stopping) {
            return;
        }
        if (node_perf_hooks_1.performance.now() - leaseAt > 10_000) {
            fail();
            return;
        }
        notify('health', [runtime?.status() || {}]);
    }, 500);
    heartbeat.unref();
    try {
        const system = await call('owner.getForeignObjectAsync', ['system.config']);
        if ((0, eosUiProcessRpc_1.processRecord)(system) && (0, eosUiProcessRpc_1.processRecord)(system.native)) {
            input.secret = system.native.secret;
        }
    }
    catch {
        /* Shell stays available; encrypted history configuration fails closed without its key. */
    }
    if (stopping) {
        throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_STOPPED');
    }
    runtime = Reflect.apply(factory.createHostedRuntime, undefined, [makeOwner(input), bridge]);
    await runtime.start();
    if (stopping) {
        throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_STOPPED');
    }
    server = (0, node_http_1.createServer)((req, res) => {
        const nonce = req.headers['x-eos-process-context'];
        delete req.headers['x-eos-process-context'];
        if (stopping || typeof nonce !== 'string' || !/^[0-9a-f]{48}$/.test(nonce)) {
            res.writeHead(403);
            res.end();
            return;
        }
        void call('request.context', [nonce, req.method, req.url]).then(value => {
            if (!(0, eosUiProcessRpc_1.processRecord)(value) || !runtime || stopping) {
                res.writeHead(503);
                res.end();
                return;
            }
            requests.set(req, { nonce, context: value });
            Object.defineProperty(req.socket, 'remoteAddress', {
                value: typeof value.remoteAddress === 'string' ? value.remoteAddress : '',
                configurable: true,
            });
            if (value.encrypted === true) {
                Object.defineProperty(req.socket, 'encrypted', { value: true, configurable: true });
            }
            runtime.handle(req, res, error => {
                if (res.headersSent) {
                    if (error) {
                        res.destroy();
                    }
                    else {
                        res.end();
                    }
                    return;
                }
                res.writeHead(error ? 500 : 404, error ? {} : { 'x-eos-process-fallthrough': '1' });
                res.end();
            });
        }, () => {
            res.writeHead(403);
            res.end();
        });
    });
    server.maxHeadersCount = 100;
    server.maxConnections = 512;
    server.headersTimeout = 15_000;
    server.requestTimeout = 30_000;
    await new Promise((resolve, reject) => {
        server?.once('error', reject);
        server?.listen(0, '127.0.0.1', resolve);
    });
    notify('health', [runtime.status()]);
    const address = server.address();
    if (!address || typeof address === 'string' || address.address !== '127.0.0.1') {
        throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_HTTP_UNAVAILABLE');
    }
    return { port: address.port };
}
async function dispatch(method, args) {
    if (method === 'initialize') {
        return initialize(args[0]);
    }
    if (method === 'stop') {
        stopping = true;
        authority = {};
        if (heartbeat) {
            clearInterval(heartbeat);
        }
        for (const timer of timers) {
            clearTimeout(timer);
        }
        timers.clear();
        server?.close();
        server?.closeAllConnections();
        for (const release of reservations.values()) {
            release();
        }
        reservations.clear();
        await runtime?.stop();
        return undefined;
    }
    if (!runtime || stopping) {
        throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_UNAVAILABLE');
    }
    if (method === 'startOperational') {
        return runtime.startOperational();
    }
    if (method === 'getHistoryBackupRequirement') {
        return runtime.getHistoryBackupRequirement();
    }
    if (method === 'reconcileDeviceEms') {
        return runtime.reconcileDeviceEms(args[0]);
    }
    if (method === 'onHostedEebusMessage') {
        return runtime.onHostedEebusMessage(args[0]);
    }
    if (method === 'onMessage') {
        return runtime.onMessage(args[0]);
    }
    if (method === 'reserveDeviceProfileChange') {
        if (reservations.size >= 32) {
            throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_RESERVATION_LIMIT');
        }
        const id = ++reservationId;
        const release = await runtime.reserveDeviceProfileChange(args[0]);
        reservations.set(id, release);
        return id;
    }
    if (method === 'releaseDeviceProfileChange' && typeof args[0] === 'number') {
        reservations.get(args[0])?.();
        reservations.delete(args[0]);
        return undefined;
    }
    throw (0, eosUiProcessRpc_1.processError)('EOS_UI_PROCESS_METHOD_DENIED');
}
function event(method, args) {
    if (method === 'lease' && (0, eosUiProcessRpc_1.processRecord)(args[0]) && !stopping) {
        updateAuthority(args[0]);
        return;
    }
    if (!runtime || stopping) {
        return;
    }
    if (method === 'onStateChange' && typeof args[0] === 'string') {
        return runtime.onStateChange?.(args[0], args[1]);
    }
    if (method === 'onObjectChange' && typeof args[0] === 'string') {
        return runtime.onObjectChange?.(args[0], args[1]);
    }
    if (method === 'revokeSessions') {
        runtime.revokeSessions?.();
    }
}
process.once('message', (message) => {
    if (!(0, eosUiProcessRpc_1.processRecord)(message) ||
        message.kind !== 'bootstrap' ||
        typeof message.generation !== 'string' ||
        !/^[0-9a-f]{48}$/.test(message.generation)) {
        fail();
        return;
    }
    rpc = new eosUiProcessRpc_1.UiProcessRpc(process, message.generation, dispatch, event, fail);
});
process.once('disconnect', fail);
process.once('SIGTERM', fail);
process.once('SIGINT', fail);
//# sourceMappingURL=eosUiProcessWorker.js.map