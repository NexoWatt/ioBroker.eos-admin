"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UI_OWNER_LOCAL = exports.UI_OWNER_ASYNC = exports.UiProcessRpc = exports.UI_PROCESS_MAX_FRAME = void 0;
exports.processError = processError;
exports.processRecord = processRecord;
exports.publicProcessError = publicProcessError;
exports.sanitizeUiProcessLog = sanitizeUiProcessLog;
/** Private IPC is a process boundary, not a sandbox against code running as the same OS user. */
exports.UI_PROCESS_MAX_FRAME = 16 * 1024 * 1024;
const MAX_PENDING = 256;
const MAX_QUEUED_BYTES = 32 * 1024 * 1024;
function processError(code) {
    return new Error(code);
}
function processRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function publicProcessError(error) {
    const value = error instanceof Error ? error.message : '';
    return /^EOS_[A-Z0-9_]{1,96}$/.test(value) ? value : 'EOS_UI_PROCESS_CALL_FAILED';
}
/** Configured secrets are removed in full before a diagnostic is shortened. */
function sanitizeUiProcessLog(value, config) {
    const source = String(value);
    if (source.length > 4096) {
        return 'EOS_UI_PROCESS_LOG_REDACTED';
    }
    let text = [...source]
        .map(character => (character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character))
        .join('');
    const visit = (node, depth) => {
        if ((!processRecord(node) && !Array.isArray(node)) || depth > 16) {
            return;
        }
        for (const [key, item] of Object.entries(node)) {
            if (/password|passwd|secret|token|privatekey|pairingpin|apikey|credential|authorization|accessjson|^pass$/i.test(key) &&
                typeof item === 'string' &&
                item) {
                text = text.split(item).join('[redacted]');
            }
            else if (item && typeof item === 'object') {
                visit(item, depth + 1);
            }
        }
    };
    visit(config, 0);
    return text
        .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
        .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+/gi, '$1[redacted]')
        .replace(/(["']?(?:password|passwd|secret|token|apikey|authorization)["']?\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi, '$1[redacted]')
        .slice(0, 1024);
}
/** Bounded bidirectional calls, a deadline and generation on every frame; no retries of commands. */
class UiProcessRpc {
    endpoint;
    generation;
    handler;
    event;
    fault;
    pending = new Map();
    nextId = 0;
    incoming = 0;
    events = 0;
    messages = 0;
    windowStart = Date.now();
    lastRequestId = 0;
    queuedBytes = 0;
    closed = false;
    constructor(endpoint, generation, handler, event, fault) {
        this.endpoint = endpoint;
        this.generation = generation;
        this.handler = handler;
        this.event = event;
        this.fault = fault;
        endpoint.on('message', this.receive);
    }
    receive = (raw) => {
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
        let bytes = exports.UI_PROCESS_MAX_FRAME + 1;
        try {
            bytes = Buffer.byteLength(JSON.stringify(raw));
        }
        catch {
            /* rejected below */
        }
        if (bytes > exports.UI_PROCESS_MAX_FRAME) {
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
            }
            else {
                pending.resolve(raw.value);
            }
            return;
        }
        if ((raw.kind !== 'call' && raw.kind !== 'event') ||
            typeof raw.method !== 'string' ||
            !/^[a-zA-Z][a-zA-Z0-9.]{0,80}$/.test(raw.method) ||
            !Array.isArray(raw.args)) {
            return;
        }
        if (raw.kind === 'event') {
            if (this.events >= MAX_PENDING) {
                this.fault('EOS_UI_PROCESS_EVENT_LIMIT');
                return;
            }
            this.events++;
            void Promise.resolve()
                .then(() => this.event(raw.method, raw.args))
                .catch(() => this.fault('EOS_UI_PROCESS_EVENT_FAILED'))
                .finally(() => {
                this.events--;
            });
            return;
        }
        if (!Number.isSafeInteger(raw.id) ||
            typeof raw.id !== 'number' ||
            raw.id <= this.lastRequestId ||
            typeof raw.deadline !== 'number' ||
            raw.deadline < Date.now() ||
            raw.deadline > Date.now() + 180_000) {
            return;
        }
        const id = raw.id;
        this.lastRequestId = id;
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
            return this.handler(raw.method, raw.args);
        })
            .then(value => this.respond(id, value), error => this.respond(id, undefined, publicProcessError(error)))
            .finally(() => {
            this.incoming--;
        });
    };
    respond(id, value, error) {
        // An old controller read may complete after its process has exited. It cannot affect a replacement.
        if (this.closed) {
            return;
        }
        try {
            this.send({ kind: 'result', id, value, error });
        }
        catch {
            // Oversized discovery/history results fail that read, not the local regulator.
            try {
                this.send({ kind: 'result', id, error: 'EOS_UI_PROCESS_RESPONSE_LIMIT' });
            }
            catch {
                this.fault('EOS_UI_PROCESS_RESPONSE_FAILED');
            }
        }
    }
    send(message) {
        if (this.closed || !this.endpoint.connected) {
            throw processError('EOS_UI_PROCESS_DISCONNECTED');
        }
        const frame = { ...message, v: 1, generation: this.generation };
        const size = Buffer.byteLength(JSON.stringify(frame));
        if (size > exports.UI_PROCESS_MAX_FRAME || this.queuedBytes + size > MAX_QUEUED_BYTES) {
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
        }
        catch (error) {
            this.queuedBytes -= size;
            throw error;
        }
    }
    call(method, args = [], timeout = 30_000) {
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
                this.send({ kind: 'call', id, method, args, deadline: Date.now() + timeout });
            }
            catch (error) {
                clearTimeout(timer);
                this.pending.delete(id);
                reject(error instanceof Error ? error : processError('EOS_UI_PROCESS_SEND_FAILED'));
            }
        });
    }
    notify(method, args = []) {
        this.send({ kind: 'event', method, args });
    }
    close() {
        this.closed = true;
        this.endpoint.removeListener('message', this.receive);
        for (const item of this.pending.values()) {
            clearTimeout(item.timer);
            item.reject(processError('EOS_UI_PROCESS_DISCONNECTED'));
        }
        this.pending.clear();
    }
}
exports.UiProcessRpc = UiProcessRpc;
/** Only public adapter operations actually used by the UI/EMS are available across IPC. */
exports.UI_OWNER_ASYNC = new Set([
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
exports.UI_OWNER_LOCAL = new Map([
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
//# sourceMappingURL=eosUiProcessRpc.js.map