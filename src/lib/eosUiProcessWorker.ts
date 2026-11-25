/** Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE. */
import type { ChildProcess } from 'node:child_process';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';
import { createUiSecretCodec } from './eosUiSecretCodec';
import {
    UiProcessRpc,
    processError,
    processRecord,
    UI_OWNER_ASYNC,
    UI_OWNER_LOCAL,
    sanitizeUiProcessLog,
} from './eosUiProcessRpc';

const runtimeRequire = createRequire(__filename);
interface Runtime {
    start(): Promise<void>;
    startOperational(): Promise<void>;
    stop(): Promise<void>;
    status(): Record<string, unknown>;
    handle(req: IncomingMessage, res: ServerResponse, next: (error?: unknown) => void): unknown;
    getHistoryBackupRequirement(): unknown;
    reserveDeviceProfileChange(change: unknown): Promise<() => void>;
    reconcileDeviceEms(devices: unknown): Promise<unknown>;
    onHostedEebusMessage(message: unknown): Promise<unknown>;
    onMessage(message: unknown): unknown;
    onStateChange?(id: string, state: unknown): unknown;
    onObjectChange?(id: string, object: unknown): unknown;
    revokeSessions?(): void;
}
let rpc: UiProcessRpc | null = null;
let runtime: Runtime | null = null;
let server: Server | null = null;
let stopping = false;
let initialized = false;
let leaseAt = 0;
let leaseSequence = 0;
let authority: Record<string, unknown> = {};
let heartbeat: NodeJS.Timeout | null = null;
const timers = new Set<NodeJS.Timeout>();
const requests = new WeakMap<IncomingMessage, { nonce: string; context: Record<string, unknown> }>();
const reservations = new Map<number, () => void>();
let reservationId = 0;

function call(method: string, args: unknown[] = []): Promise<unknown> {
    return rpc ? rpc.call(method, args) : Promise.reject(processError('EOS_UI_PROCESS_DISCONNECTED'));
}
function notify(method: string, args: unknown[] = []): void {
    try {
        rpc?.notify(method, args);
    } catch {
        fail();
    }
}
function canWrite(): boolean {
    return !stopping && performance.now() - leaseAt <= 3000 && authority.canWrite === true;
}
function updateAuthority(value: Record<string, unknown>): void {
    if (
        stopping ||
        !Number.isSafeInteger(value.sequence) ||
        Number(value.sequence) <= leaseSequence ||
        typeof value.expiresAt !== 'number' ||
        value.expiresAt <= Date.now() ||
        value.expiresAt > Date.now() + 3500
    ) {
        return;
    }
    authority = value;
    leaseSequence = Number(value.sequence);
    // A queued lease retains its original age instead of being renewed on delivery.
    leaseAt = performance.now() - Math.max(0, 3000 - (value.expiresAt - Date.now()));
}
function fail(): void {
    stopping = true;
    authority = {};
    for (const timer of timers) {
        clearTimeout(timer);
    }
    // Parent death leaves no orphan regulator, TCP listener or periodic hardware operation.
    process.exitCode = 1;
    process.exit(1);
}
function localId(namespace: string, id: unknown): string {
    if (typeof id !== 'string' || id.length > 512) {
        throw processError('EOS_UI_PROCESS_STATE_ID');
    }
    return id.startsWith(`${namespace}.`) ? id : `${namespace}.${id}`;
}
function makeOwner(input: Record<string, unknown>): Record<string, unknown> {
    const namespace = String(input.namespace);
    const owner: Record<string, unknown> = {
        namespace,
        instance: input.instance,
        name: 'eos-admin',
        config: input.config,
    };
    const invoke = (method: string, args: unknown[]): Promise<unknown> => {
        const mutating =
            /^(?:set|extend|del)/.test(method) ||
            method === 'saveUi' ||
            (method === 'sendTo' && args[1] !== 'getHistory');
        if (mutating && !canWrite()) {
            return Promise.reject(processError('EOS_UI_PROCESS_WRITE_FENCED'));
        }
        // An admin event-loop stall must not replay an old physical setpoint after recovery.
        return rpc
            ? rpc.call(`owner.${method}`, args, mutating ? 2000 : 30_000)
            : Promise.reject(processError('EOS_UI_PROCESS_DISCONNECTED'));
    };
    for (const name of UI_OWNER_ASYNC) {
        owner[name] = (...args: unknown[]) => invoke(name, args);
        if (!name.endsWith('Async')) {
            continue;
        }
        const callbackName = name.slice(0, -5);
        owner[callbackName] = (...args: unknown[]): unknown => {
            const callback: unknown = typeof args.at(-1) === 'function' ? args.pop() : undefined;
            const result = invoke(name, args);
            if (typeof callback === 'function') {
                void result.then(
                    value => callback(null, value),
                    error => callback(error),
                );
                return undefined;
            }
            void result.catch(() => undefined);
            return result;
        };
    }
    for (const [name, foreign] of UI_OWNER_LOCAL) {
        for (const suffix of ['', 'Async']) {
            owner[`${name}${suffix}`] = (id: unknown, ...args: unknown[]): unknown => {
                const method: unknown = owner[`${foreign}${suffix}`];
                if (typeof method !== 'function') {
                    throw processError('EOS_UI_PROCESS_OWNER_API');
                }
                const absolute = Array.isArray(id) ? id.map(item => localId(namespace, item)) : localId(namespace, id);
                return Reflect.apply(method, owner, [absolute, ...args]);
            };
        }
    }
    owner.eosMigration = { saveUi: (config: unknown) => invoke('saveUi', [config]) };
    owner.log = Object.fromEntries(
        ['error', 'warn', 'info', 'debug', 'silly'].map(level => [
            level,
            (message: unknown): void =>
                notify('log', [
                    level === 'silly' ? 'debug' : level,
                    sanitizeUiProcessLog(message, {
                        config: owner.config,
                        secret: input.secret,
                        apiKey: process.env.NEXOWATT_OPEN_METEO_API_KEY,
                    }),
                ]),
        ]),
    );
    owner.setTimeout = (callback: unknown, ms: unknown, ...args: unknown[]): NodeJS.Timeout => {
        if (
            stopping ||
            typeof callback !== 'function' ||
            typeof ms !== 'number' ||
            !Number.isFinite(ms) ||
            timers.size >= 4096
        ) {
            throw processError('EOS_UI_PROCESS_TIMER_LIMIT');
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
    owner.setInterval = (callback: unknown, ms: unknown, ...args: unknown[]): NodeJS.Timeout => {
        if (
            stopping ||
            typeof callback !== 'function' ||
            typeof ms !== 'number' ||
            !Number.isFinite(ms) ||
            ms < 1 ||
            timers.size >= 4096
        ) {
            throw processError('EOS_UI_PROCESS_TIMER_LIMIT');
        }
        const timer = setInterval(() => {
            if (!stopping) {
                Reflect.apply(callback, undefined, args);
            }
        }, ms);
        timers.add(timer);
        return timer;
    };
    owner.clearTimeout = owner.clearInterval = (timer: NodeJS.Timeout): void => {
        timers.delete(timer);
        clearTimeout(timer);
    };
    owner.sendTo = (...args: unknown[]): unknown => {
        const callback: unknown = typeof args.at(-1) === 'function' ? args.pop() : undefined;
        const result = invoke('sendTo', args);
        if (typeof callback === 'function') {
            void result.then(
                value => callback(value),
                () => callback({ error: 'EOS_UI_PROCESS_CALL_FAILED' }),
            );
            return undefined;
        }
        void result.catch(() => undefined);
        return result;
    };
    owner.checkPassword = (...args: unknown[]): void => {
        const callback: unknown = args.pop();
        if (typeof callback !== 'function') {
            throw processError('EOS_UI_PROCESS_CALLBACK_REQUIRED');
        }
        void invoke('checkPassword', args).then(
            value => {
                if (Array.isArray(value)) {
                    callback(...value);
                } else {
                    callback(false);
                }
            },
            () => callback(false),
        );
    };
    const codec = createUiSecretCodec(input.secret);
    owner.encrypt = codec.encrypt;
    owner.decrypt = codec.decrypt;
    return owner;
}
const bridge = {
    getLicense: (): unknown => authority.license,
    getRuntimeReadiness: (): unknown => authority.readiness,
    canWrite,
    isListening: (): boolean => !stopping && authority.listening === true && performance.now() - leaseAt <= 3000,
    resolveAccess: (req: IncomingMessage): Promise<unknown> => {
        const context = requests.get(req);
        return context
            ? call('request.access', [context.nonce])
            : Promise.reject(processError('EOS_UI_PROCESS_REQUEST_EXPIRED'));
    },
    originAllowed: (req: IncomingMessage): boolean => requests.get(req)?.context.originAllowed === true,
    machineRequestAllowed: (req: IncomingMessage): boolean => requests.get(req)?.context.machineAllowed === true,
    deviceEmsPlan: (input: unknown): Promise<unknown> => call('bridge.deviceEmsPlan', [input]),
    deviceEmsConfigChanged: (): void => notify('bridge.deviceEmsConfigChanged'),
    resolveDeviceProfileReferences: (input: unknown): Promise<unknown> =>
        call('bridge.resolveDeviceProfileReferences', [input]),
    hostedModuleFeedback: (input: unknown): Promise<unknown> => call('bridge.hostedModuleFeedback', [input]),
};
async function initialize(input: unknown): Promise<{ port: number }> {
    if (
        stopping ||
        initialized ||
        !processRecord(input) ||
        typeof input.namespace !== 'string' ||
        !/^eos-admin\.\d+$/.test(input.namespace) ||
        typeof input.runtimePath !== 'string' ||
        !processRecord(input.snapshot)
    ) {
        throw processError('EOS_UI_PROCESS_INITIALIZATION');
    }
    initialized = true;
    updateAuthority(input.snapshot);
    const factory: unknown = runtimeRequire(input.runtimePath);
    if (!processRecord(factory) || typeof factory.createHostedRuntime !== 'function') {
        throw processError('EOS_UI_FACTORY_MISSING');
    }
    heartbeat = setInterval(() => {
        if (stopping) {
            return;
        }
        if (performance.now() - leaseAt > 10_000) {
            fail();
            return;
        }
        notify('health', [runtime?.status() || {}]);
    }, 500);
    heartbeat.unref();
    try {
        const system = await call('owner.getForeignObjectAsync', ['system.config']);
        if (processRecord(system) && processRecord(system.native)) {
            input.secret = system.native.secret;
        }
    } catch {
        /* Shell stays available; encrypted history configuration fails closed without its key. */
    }
    if (stopping) {
        throw processError('EOS_UI_PROCESS_STOPPED');
    }
    runtime = Reflect.apply(factory.createHostedRuntime, undefined, [makeOwner(input), bridge]) as Runtime;
    await runtime.start();
    if (stopping) {
        throw processError('EOS_UI_PROCESS_STOPPED');
    }
    server = createServer((req, res) => {
        const nonce = req.headers['x-eos-process-context'];
        delete req.headers['x-eos-process-context'];
        if (stopping || typeof nonce !== 'string' || !/^[0-9a-f]{48}$/.test(nonce)) {
            res.writeHead(403);
            res.end();
            return;
        }
        void call('request.context', [nonce, req.method, req.url]).then(
            value => {
                if (!processRecord(value) || !runtime || stopping) {
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
                        } else {
                            res.end();
                        }
                        return;
                    }
                    res.writeHead(error ? 500 : 404, error ? {} : { 'x-eos-process-fallthrough': '1' });
                    res.end();
                });
            },
            () => {
                res.writeHead(403);
                res.end();
            },
        );
    });
    server.maxHeadersCount = 100;
    server.maxConnections = 512;
    server.headersTimeout = 15_000;
    server.requestTimeout = 30_000;
    await new Promise<void>((resolve, reject) => {
        server?.once('error', reject);
        server?.listen(0, '127.0.0.1', resolve);
    });
    notify('health', [runtime.status()]);
    const address = server.address();
    if (!address || typeof address === 'string' || address.address !== '127.0.0.1') {
        throw processError('EOS_UI_PROCESS_HTTP_UNAVAILABLE');
    }
    return { port: address.port };
}
async function dispatch(method: string, args: unknown[]): Promise<unknown> {
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
        throw processError('EOS_UI_PROCESS_UNAVAILABLE');
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
            throw processError('EOS_UI_PROCESS_RESERVATION_LIMIT');
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
    throw processError('EOS_UI_PROCESS_METHOD_DENIED');
}
function event(method: string, args: unknown[]): unknown {
    if (method === 'lease' && processRecord(args[0]) && !stopping) {
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
process.once('message', (message: unknown) => {
    if (
        !processRecord(message) ||
        message.kind !== 'bootstrap' ||
        typeof message.generation !== 'string' ||
        !/^[0-9a-f]{48}$/.test(message.generation)
    ) {
        fail();
        return;
    }
    rpc = new UiProcessRpc(process as unknown as ChildProcess, message.generation, dispatch, event, fail);
});
process.once('disconnect', fail);
process.once('SIGTERM', fail);
process.once('SIGINT', fail);
