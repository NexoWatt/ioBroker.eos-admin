/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
/** @typedef {import('./eosModuleProcessTypes').RecordValue} RecordValue */
/** @typedef {import('./eosModuleProcessTypes').Channel} Channel */

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PENDING = 128;
const ADAPTER_METHODS = Object.freeze(['getObjectAsync', 'getStateAsync', 'setObjectNotExistsAsync',
    'extendObjectAsync', 'setStateAsync', 'subscribeStatesAsync', 'unsubscribeStatesAsync',
    'getStatesAsync', 'getObjectViewAsync', 'setStateChangedAsync', 'delObjectAsync',
    'setForeignObjectNotExistsAsync', 'extendForeignObjectAsync', 'delForeignObjectAsync',
    'getBackupDataFolders', 'sendBackupNotification', 'sendTo']);
const MODULE_METHODS = Object.freeze(['prepare', 'start', 'stop', 'getStatus', 'command', 'onStateChange', 'onMessage',
    'download.open', 'download.read', 'download.close']);
/** @param {string} code */
const error = code => Object.assign(new Error(code), { code });
/** @param {unknown} value @returns {value is RecordValue} */
const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
/** @param {unknown} value @returns {string} */
const errorCode = value => {
    const code = isRecord(value) ? value.code || value.message : '';
    // Preserve useful dependency/bind diagnostics across IPC without exposing
    // Node's require stack, installation paths or a module's arbitrary message.
    if (['MODULE_NOT_FOUND', 'ERR_MODULE_NOT_FOUND'].includes(String(code))) return 'EOS_MODULE_DEPENDENCY_MISSING';
    if (['ERR_PACKAGE_PATH_NOT_EXPORTED', 'ERR_PACKAGE_IMPORT_NOT_DEFINED', 'ERR_REQUIRE_ESM'].includes(String(code))) return 'EOS_MODULE_DEPENDENCY_INVALID';
    if (code === 'EADDRINUSE') return 'EOS_MODULE_ADDRESS_IN_USE';
    if (code === 'EACCES') return 'EOS_MODULE_ACCESS_DENIED';
    if (isRecord(value) && value.name === 'SyntaxError') return 'EOS_MODULE_SYNTAX_ERROR';
    return typeof code === 'string' && /^(?:EOS|EEBUS)_[A-Z0-9_]{1,100}$/.test(code) ? code : 'EOS_MODULE_PROCESS_OPERATION_FAILED';
};

/** @param {unknown} value @param {unknown} config */
function sanitizeLog(value, config) {
    const source = String(value);
    // Never cut a secret in half before matching it. Oversized diagnostics are
    // suppressed as a whole rather than leaking their unmatched prefix.
    if (source.length > 4096) return 'EOS_MODULE_PROCESS_LOG_REDACTED';
    let text = [...source].map(character =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127 ? ' ' : character).join('');
    /** @param {unknown} node @param {number} depth */
    const visit = (node, depth) => {
        if (!node || typeof node !== 'object' || depth > 16) return;
        for (const [key, item] of Object.entries(node)) {
            if (/password|passwd|secret|token|privatekey|pairingpin|apikey|credential|authorization|accessjson|^pass$/i.test(key) &&
                typeof item === 'string' && item.length >= 1) text = text.split(item).join('[redacted]');
            else if (item && typeof item === 'object') visit(item, depth + 1);
        }
    };
    visit(config, 0);
    return text.replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/gi, '$1[redacted]@')
        .replace(/(Bearer\s+)[A-Za-z0-9._~+/-]+/gi, '$1[redacted]')
        .replace(/(["']?(?:password|passwd|secret|token|apikey|authorization)["']?\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;&]+)/gi, '$1[redacted]').slice(0, 1024);
}

/** @param {unknown} value @returns {unknown} */
function validate(value) {
    const text = JSON.stringify(value);
    if (!text || Buffer.byteLength(text) > MAX_BYTES) throw error('EOS_MODULE_PROCESS_MESSAGE_SIZE');
    /** @param {unknown} node @param {number} depth */
    const visit = (node, depth) => {
        if (depth > 24) throw error('EOS_MODULE_PROCESS_MESSAGE_DEPTH');
        if (node && typeof node === 'object') {
            for (const [key, child] of Object.entries(node)) {
                if (['__proto__', 'constructor', 'prototype'].includes(key)) throw error('EOS_MODULE_PROCESS_MESSAGE_KEY');
                visit(child, depth + 1);
            }
        }
    };
    visit(value, 0);
    return value;
}

/** Finite requests, bounded serialized messages and bounded outbound queue.
 * @param {import('./eosModuleProcessTypes').Transport} transport
 * @param {number} generation
 * @param {(method:string,args:unknown[])=>unknown} onRequest
 * @param {(message:RecordValue)=>void} onEvent
 * @param {number} [timeoutMs]
 * @returns {Channel}
 */
function channel(transport, generation, onRequest, onEvent, timeoutMs = 5000) {
    /** @type {Map<number, import('./eosModuleProcessTypes').PendingRequest>} */
    const pending = new Map();
    let nextId = 0;
    let sending = 0;
    let active = 0;
    let lastRequest = 0;
    let windowStart = Date.now();
    let messages = 0;
    let closed = false;
    /** @param {RecordValue} message */
    function send(message) {
        if (closed || !transport.connected || !transport.send) throw error('EOS_MODULE_PROCESS_DISCONNECTED');
        validate(message);
        if (sending >= MAX_PENDING) throw error('EOS_MODULE_PROCESS_BACKPRESSURE');
        sending++;
        try { transport.send(message, issue => { sending--; if (issue) close(); }); }
        catch (issue) { sending--; throw issue; }
    }
    /** @param {RecordValue} message @param {unknown} result @param {unknown} issue */
    function reply(message, result, issue) {
        try { send({ type: 'reply', generation, id: message.id, ...(issue ? { error: errorCode(issue) } : { result }) }); }
        catch { close(); }
    }
    /** @param {RecordValue} message */
    function notify(message) {
        try { onEvent(message); }
        catch { close(); }
    }
    /** @param {unknown} message */
    const receive = async message => {
        if (Date.now() - windowStart > 1000) { windowStart = Date.now(); messages = 0; }
        if (++messages > 8192) { close(); notify({ type: 'invalid' }); return; }
        try { validate(message); } catch { close(); notify({ type: 'invalid' }); return; }
        if (closed || !isRecord(message) || message.generation !== generation) return;
        if (message.type === 'reply') {
            if (typeof message.id !== 'number') return;
            const request = pending.get(message.id);
            if (!request) return;
            pending.delete(message.id); clearTimeout(request.timer);
            if (message.error) request.reject(error(errorCode({ code: message.error })));
            else request.resolve(message.result);
        } else if (message.type === 'request') {
            if (typeof message.id !== 'number' || !Number.isSafeInteger(message.id) || message.id <= lastRequest || !Array.isArray(message.args) ||
                typeof message.method !== 'string' || active >= MAX_PENDING) {
                reply(message, null, error('EOS_MODULE_PROCESS_REQUEST_LIMIT')); return;
            }
            lastRequest = message.id;
            if (typeof message.expiresAt !== 'number' || !Number.isFinite(message.expiresAt) || message.expiresAt < Date.now()) {
                reply(message, null, error('EOS_MODULE_PROCESS_REQUEST_EXPIRED')); return;
            }
            active++;
            try { reply(message, await onRequest(message.method, message.args), null); }
            catch (issue) { reply(message, null, issue); }
            finally { active--; }
        } else notify(message);
    };
    transport.on('message', receive);
    function close() {
        if (closed) return;
        closed = true;
        transport.off('message', receive);
        for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error('EOS_MODULE_PROCESS_DISCONNECTED')); }
        pending.clear();
    }
    return { close, event: (type, data = {}) => send({ ...data, type, generation }),
        request(method, args = [], deadline = timeoutMs) {
            if (pending.size >= MAX_PENDING) return Promise.reject(error('EOS_MODULE_PROCESS_REQUEST_LIMIT'));
            return new Promise((resolve, reject) => {
                const id = ++nextId;
                const timer = setTimeout(() => { pending.delete(id); reject(error('EOS_MODULE_PROCESS_TIMEOUT')); }, deadline);
                pending.set(id, { resolve, reject, timer });
                try { send({ type: 'request', generation, id, method, args, expiresAt: Date.now() + deadline }); }
                catch (issue) { pending.delete(id); clearTimeout(timer); reject(issue); }
            });
        },
    };
}

module.exports = { MAX_BYTES, MAX_PENDING, ADAPTER_METHODS, MODULE_METHODS, error, errorCode, isRecord, sanitizeLog, validate, channel };
