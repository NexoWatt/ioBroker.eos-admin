/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/hosted-http-boundary.ts
 * Quell-Hash: sha256:6659f58ebceb066133aa598f355bcf8dba6c7ad9edadb469b85ad6fc1d7e68fe
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/hosted-http-boundary.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHostedHttpHandler = createHostedHttpHandler;
function isObject(value) {
    return value !== null && (typeof value === 'object' || typeof value === 'function');
}
/** Rejecting with a routing sentinel must not turn an error into a route bypass. */
function rejectionReason(error) {
    return !error || error === 'route' || error === 'router' ? new Error('EOS_HTTP_HANDLER_REJECTED') : error;
}
function observeResult(value, reject) {
    if (isObject(value) && typeof value.then === 'function') {
        void Promise.resolve(value).catch(reject);
    }
}
/** Only this completed UI router is changed; other apps and Express prototypes remain untouched. */
function containAsyncHandlers(app) {
    const seen = new WeakSet();
    const visit = (stack) => {
        if (!Array.isArray(stack))
            throw new Error('EOS_HTTP_ROUTER_CONTRACT');
        for (const layer of stack) {
            if (!isObject(layer) || typeof layer.handle !== 'function')
                throw new Error('EOS_HTTP_ROUTER_CONTRACT');
            if (seen.has(layer))
                continue;
            seen.add(layer);
            const handler = layer.handle;
            if (isObject(layer.route)) {
                visit(layer.route.stack);
            }
            else if (isObject(handler) && Array.isArray(handler.stack)) {
                visit(handler.stack);
            }
            else if (handler.length <= 3) {
                layer.handle = function (req, res, next) {
                    let advanced = false;
                    const advance = (error) => {
                        if (advanced)
                            return;
                        advanced = true;
                        next(error);
                    };
                    const reject = (error) => {
                        if (!res.writableEnded && !res.destroyed)
                            advance(rejectionReason(error));
                    };
                    try {
                        const result = Reflect.apply(handler, this, [req, res, advance]);
                        observeResult(result, reject);
                        return result;
                    }
                    catch (error) {
                        reject(error);
                        return undefined;
                    }
                };
            }
            else if (handler.length === 4) {
                // Express distinguishes error middleware by its four-argument arity.
                layer.handle = function (error, req, res, next) {
                    let advanced = false;
                    const advance = (failure) => {
                        if (advanced)
                            return;
                        advanced = true;
                        next(failure);
                    };
                    const reject = (failure) => {
                        if (!res.writableEnded && !res.destroyed)
                            advance(rejectionReason(failure));
                    };
                    try {
                        const result = Reflect.apply(handler, this, [error, req, res, advance]);
                        observeResult(result, reject);
                        return result;
                    }
                    catch (failure) {
                        reject(failure);
                        return undefined;
                    }
                };
            }
        }
    };
    if (!isObject(app._router))
        throw new Error('EOS_HTTP_ROUTER_CONTRACT');
    visit(app._router.stack);
}
function createHostedHttpHandler(app) {
    containAsyncHandlers(app);
    return (req, res, next) => {
        const requestPrototype = Object.getPrototypeOf(req);
        const responsePrototype = Object.getPrototypeOf(res);
        const queryDescriptor = Object.getOwnPropertyDescriptor(req, 'query');
        let restored = false;
        let forwarded = false;
        const restore = () => {
            if (restored)
                return;
            restored = true;
            res.removeListener('finish', restore);
            res.removeListener('close', restore);
            if (queryDescriptor)
                Object.defineProperty(req, 'query', queryDescriptor);
            else
                Reflect.deleteProperty(req, 'query');
            Object.setPrototypeOf(req, requestPrototype);
            Object.setPrototypeOf(res, responsePrototype);
        };
        const done = (error) => {
            if (forwarded)
                return;
            forwarded = true;
            restore();
            next(error);
        };
        res.prependOnceListener('finish', restore);
        res.prependOnceListener('close', restore);
        try {
            Object.setPrototypeOf(req, app.request);
            Object.setPrototypeOf(res, app.response);
            Object.defineProperty(req, 'query', { configurable: true, enumerable: true, writable: true, value: undefined });
            app(req, res, done);
        }
        catch (error) {
            done(rejectionReason(error));
        }
    };
}
