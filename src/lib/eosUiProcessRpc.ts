/** Copyright (c) 2026 NexoWatt. Proprietary; see LICENSE. */
import type { ChildProcess } from 'node:child_process';

/** Private IPC is a process boundary, not a sandbox against code running as the same OS user. */
export const UI_PROCESS_MAX_FRAME = 16 * 1024 * 1024;
/** A protected configuration commit timed out; recovery requires an explicit start. */
export const UI_CONFIG_COMMIT_UNCONFIRMED_EXIT = 75;
const MAX_PENDING = 256;
const MAX_QUEUED_BYTES = 32 * 1024 * 1024;
type Endpoint = Pick<ChildProcess, 'on' | 'removeListener' | 'send' | 'connected'>;
type Handler = (method: string, args: unknown[]) => unknown;
type Pending = { resolve(value: unknown): void; reject(error: Error): void; timer: NodeJS.Timeout };
export function processError(code: string): Error {
    return new Error(code);
}
export function processRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function publicProcessError(error: unknown): string {
    const value = error instanceof Error ? error.message : '';
    return /^EOS_[A-Z0-9_]{1,96}$/.test(value) ? value : 'EOS_UI_PROCESS_CALL_FAILED';
}
/** Configured secrets are removed in full before a diagnostic is shortened. */
export function sanitizeUiProcessLog(value: unknown, config: unknown): string {
    const source = String(value);
    if (source.length > 4096) {
        return 'EOS_UI_PROCESS_LOG_REDACTED';
    }
    let text = [...source]
        .map(character => (character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character))
        .join('');
    const visit = (node: unknown, depth: number): void => {
        if ((!processRecord(node) && !Array.isArray(node)) || depth > 16) {
            return;
        }
        for (const [key, item] of Object.entries(node)) {
            if (
                /password|passwd|secret|token|privatekey|pairingpin|apikey|credential|authorization|accessjson|^pass$/i.test(
                    key,
                ) &&
                typeof item === 'string' &&
                item
            ) {
                text = text.split(item).join('[redacted]');
            } else if (item && typeof item === 'object') {
                visit(item, depth + 1);
            }
        }
    };
    visit(config, 0);
    return text
        .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
        .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+/gi, '$1[redacted]')
        .replace(
            /(["']?(?:password|passwd|secret|token|apikey|authorization)["']?\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi,
            '$1[redacted]',
        )
        .slice(0, 1024);
}

/** Bounded bidirectional calls, a deadline and generation on every frame; no retries of commands. */
export class UiProcessRpc {
    private readonly pending = new Map<number, Pending>();
    private nextId = 0;
    private incoming = 0;
    private events = 0;
    private messages = 0;
    private windowStart = Date.now();
    private lastRequestId = 0;
    private queuedBytes = 0;
    private closed = false;
    constructor(
        private readonly endpoint: Endpoint,
        readonly generation: string,
        private readonly handler: Handler,
        private readonly event: Handler,
        private readonly fault: (code: string) => void,
    ) {
        endpoint.on('message', this.receive);
    }
    private receive = (raw: unknown): void => {
        if (this.closed || !processRecord(raw) || raw.v !== 1 || raw.generation !== this.generation) {
            return;
        }
        if (Date.now() - this.windowStart >= 1000) {
            this.windowStart = Date.now();
            this.messages = 0;
        }
        if (++this.messages > 8192) {
            this.fault('EOS_UI_PROCESS_RATE_LIMIT');
            return;
        }
        let bytes = UI_PROCESS_MAX_FRAME + 1;
        try {
            bytes = Buffer.byteLength(JSON.stringify(raw));
        } catch {
            /* rejected below */
        }
        if (bytes > UI_PROCESS_MAX_FRAME) {
            this.fault('EOS_UI_PROCESS_FRAME_LIMIT');
            return;
        }
        if (raw.kind === 'result') {
            if (typeof raw.id !== 'number') {
                return;
            }
            const pending = this.pending.get(raw.id);
            if (!pending) {
                return;
            }
            this.pending.delete(raw.id);
            clearTimeout(pending.timer);
            if (typeof raw.error === 'string') {
                pending.reject(processError(publicProcessError(processError(raw.error))));
            } else {
                pending.resolve(raw.value);
            }
            return;
        }
        if (
            (raw.kind !== 'call' && raw.kind !== 'event') ||
            typeof raw.method !== 'string' ||
            !/^[a-zA-Z][a-zA-Z0-9.]{0,80}$/.test(raw.method) ||
            !Array.isArray(raw.args)
        ) {
            return;
        }
        if (raw.kind === 'event') {
            if (this.events >= MAX_PENDING) {
                this.fault('EOS_UI_PROCESS_EVENT_LIMIT');
                return;
            }
            this.events++;
            void Promise.resolve()
                .then(() => this.event(raw.method as string, raw.args as unknown[]))
                .catch(() => this.fault('EOS_UI_PROCESS_EVENT_FAILED'))
                .finally(() => {
                    this.events--;
                });
            return;
        }
        if (
            !Number.isSafeInteger(raw.id) ||
            typeof raw.id !== 'number' ||
            raw.id <= this.lastRequestId ||
            typeof raw.deadline !== 'number' ||
            !Number.isFinite(raw.deadline) ||
            raw.deadline > Date.now() + 180_000
        ) {
            return;
        }
        const id = raw.id;
        this.lastRequestId = id;
        if (raw.deadline < Date.now()) {
            // A longer confirmation window must never admit a stale command.
            this.respond(id, undefined, 'EOS_UI_PROCESS_CALL_EXPIRED');
            return;
        }
        if (this.incoming >= MAX_PENDING) {
            this.respond(id, undefined, 'EOS_UI_PROCESS_BUSY');
            return;
        }
        this.incoming++;
        void Promise.resolve()
            .then(() => {
                if (this.closed || Number(raw.deadline) < Date.now()) {
                    throw processError('EOS_UI_PROCESS_CALL_EXPIRED');
                }
                return this.handler(raw.method as string, raw.args as unknown[]);
            })
            .then(
                value => this.respond(id, value),
                error => this.respond(id, undefined, publicProcessError(error)),
            )
            .finally(() => {
                this.incoming--;
            });
    };
    private respond(id: number, value?: unknown, error?: string): void {
        // An old controller read may complete after its process has exited. It cannot affect a replacement.
        if (this.closed) {
            return;
        }
        try {
            this.send({ kind: 'result', id, value, error });
        } catch {
            // Oversized discovery/history results fail that read, not the local regulator.
            try {
                this.send({ kind: 'result', id, error: 'EOS_UI_PROCESS_RESPONSE_LIMIT' });
            } catch {
                this.fault('EOS_UI_PROCESS_RESPONSE_FAILED');
            }
        }
    }
    private send(message: Record<string, unknown>): void {
        if (this.closed || !this.endpoint.connected) {
            throw processError('EOS_UI_PROCESS_DISCONNECTED');
        }
        const frame = { ...message, v: 1, generation: this.generation };
        const size = Buffer.byteLength(JSON.stringify(frame));
        if (size > UI_PROCESS_MAX_FRAME || this.queuedBytes + size > MAX_QUEUED_BYTES) {
            throw processError('EOS_UI_PROCESS_FRAME_LIMIT');
        }
        this.queuedBytes += size;
        try {
            this.endpoint.send(frame, error => {
                this.queuedBytes -= size;
                if (error && !this.closed) {
                    this.fault('EOS_UI_PROCESS_SEND_FAILED');
                }
            });
        } catch (error) {
            this.queuedBytes -= size;
            throw error;
        }
    }
    call(method: string, args: unknown[] = [], timeout = 30_000, admissionTimeout = timeout): Promise<unknown> {
        if (this.pending.size >= MAX_PENDING) {
            return Promise.reject(processError('EOS_UI_PROCESS_BUSY'));
        }
        const id = ++this.nextId;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(processError('EOS_UI_PROCESS_TIMEOUT'));
            }, timeout);
            timer.unref();
            this.pending.set(id, { resolve, reject, timer });
            try {
                // Admission and completion are distinct: an already accepted
                // controller commit can take longer than the command freshness budget.
                this.send({
                    kind: 'call',
                    id,
                    method,
                    args,
                    deadline: Date.now() + Math.min(timeout, admissionTimeout),
                });
            } catch (error) {
                clearTimeout(timer);
                this.pending.delete(id);
                reject(error instanceof Error ? error : processError('EOS_UI_PROCESS_SEND_FAILED'));
            }
        });
    }
    notify(method: string, args: unknown[] = []): void {
        this.send({ kind: 'event', method, args });
    }
    close(): void {
        this.closed = true;
        this.endpoint.removeListener('message', this.receive);
        for (const item of this.pending.values()) {
            clearTimeout(item.timer);
            item.reject(processError('EOS_UI_PROCESS_DISCONNECTED'));
        }
        this.pending.clear();
    }
}

/** Only public adapter operations actually used by the UI/EMS are available across IPC. */
export const UI_OWNER_ASYNC = new Set([
    'getForeignObjectAsync',
    'getForeignObjectsAsync',
    'getObjectViewAsync',
    'getForeignStateAsync',
    'getForeignStatesAsync',
    'setForeignObjectAsync',
    'setForeignObjectNotExistsAsync',
    'extendForeignObjectAsync',
    'delForeignObjectAsync',
    'setForeignStateAsync',
    'setForeignStateChangedAsync',
    'delForeignStateAsync',
    'subscribeForeignStatesAsync',
    'unsubscribeForeignStatesAsync',
    'subscribeForeignObjectsAsync',
    'unsubscribeForeignObjectsAsync',
    'getUserID',
]);
export const UI_OWNER_LOCAL = new Map([
    ['getObject', 'getForeignObject'],
    ['getObjects', 'getForeignObjects'],
    ['getState', 'getForeignState'],
    ['getStates', 'getForeignStates'],
    ['setObject', 'setForeignObject'],
    ['setObjectNotExists', 'setForeignObjectNotExists'],
    ['extendObject', 'extendForeignObject'],
    ['delObject', 'delForeignObject'],
    ['setState', 'setForeignState'],
    ['setStateChanged', 'setForeignStateChanged'],
    ['delState', 'delForeignState'],
    ['subscribeStates', 'subscribeForeignStates'],
    ['unsubscribeStates', 'unsubscribeForeignStates'],
    ['subscribeObjects', 'subscribeForeignObjects'],
    ['unsubscribeObjects', 'unsubscribeForeignObjects'],
]);
