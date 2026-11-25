"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerEosCustomerUpdateRoutes = registerEosCustomerUpdateRoutes;
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Stellt den engen EOS-Updateweg für angemeldete Kunden, Installateure und Administratoren bereit.
 * Daten und Wirkung: Prüft Ursprung, aktuelle Sitzung, Erstpasswort und CSRF; nimmt ausschließlich Version oder vorbereiteten Plan entgegen, keine Befehle oder URLs.
 * Bei Änderungen: Alle Rollen, Sitzungsentzug während Vorbereitung und Start sowie unbekannte JSON-Felder negativ testen; die allgemeinen ioBroker-Rechte bleiben unverändert.
 */
const express_1 = require("express");
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function registerEosCustomerUpdateRoutes(app, options) {
    const prefix = '/api/eos-update';
    const requestedTimeout = options.responseTimeoutMs;
    const timeoutMs = typeof requestedTimeout === 'number' && Number.isFinite(requestedTimeout) && requestedTimeout > 0
        ? Math.min(20000, requestedTimeout)
        : 20000;
    const parseJson = (0, express_1.json)({ limit: '1kb', strict: true });
    let pending = 0;
    async function authorized(req, write) {
        if (!options.requestAllowed(req) || (write && !options.csrfAllowed(req))) {
            return false;
        }
        const access = await options.access(req);
        return (record(access) &&
            access.authenticated === true &&
            access.mustChangePassword === false &&
            ['admin', 'installer', 'customer'].includes(typeof access.role === 'string' ? access.role : ''));
    }
    function replyError(res, error) {
        if (res.headersSent || res.destroyed) {
            return;
        }
        const code = error instanceof Error && /^(?:EOS_)?UPDATE_[A-Z0-9_]{1,80}$/.test(error.message)
            ? error.message
            : 'UPDATE_UNAVAILABLE';
        res.status(/AUTH|SESSION/.test(code) ? 403 : /BUSY|CHANGED|PLAN|CONFLICT|EXPIRED/.test(code) ? 409 : 503).json({
            error: code,
        });
    }
    function perform(req, res, write, operation) {
        res.setHeader('Cache-Control', 'no-store');
        if (pending >= 8) {
            res.status(429).json({ error: 'UPDATE_BUSY' });
            return;
        }
        pending++;
        let alive = true;
        const cancellation = new AbortController();
        const close = () => {
            alive = false;
            cancellation.abort();
        };
        res.once('close', close);
        const timer = setTimeout(() => {
            alive = false;
            if (!res.headersSent && !res.destroyed) {
                res.status(504).json({ error: 'UPDATE_TIMEOUT' });
            }
            cancellation.abort();
        }, timeoutMs);
        timer.unref();
        const authorize = async () => {
            if (!alive || res.destroyed || res.writableEnded) {
                return false;
            }
            const allowed = await authorized(req, write);
            // A session-store read can settle after timeout or disconnect. It
            // must not restore the authority lost by this particular request.
            return alive && !res.destroyed && !res.writableEnded && allowed;
        };
        void (async () => {
            if (!(await authorize())) {
                if (alive) {
                    replyError(res, new Error('UPDATE_AUTH'));
                }
                return;
            }
            await operation(authorize, cancellation.signal);
        })()
            .catch((error) => {
            if (alive) {
                replyError(res, error);
            }
        })
            .finally(() => {
            alive = false;
            cancellation.abort();
            clearTimeout(timer);
            res.off('close', close);
            // Do not release admission on timeout: uncancellable pending DB
            // work keeps its slot until it actually finishes.
            pending--;
        });
    }
    function bodyAllowed(req, res, cancelled) {
        return new Promise(resolve => {
            let settled = false;
            const cancel = () => {
                if (settled) {
                    return;
                }
                settled = true;
                // Unlike a DB commit, an incomplete request body is cancellable.
                // Close its transport after the timeout response was flushed.
                if (!req.complete && !req.destroyed) {
                    if (res.writableFinished || res.destroyed) {
                        req.destroy();
                    }
                    else {
                        res.once('finish', () => req.destroy());
                    }
                }
                resolve(false);
            };
            const finish = (allowed) => {
                if (settled) {
                    return;
                }
                settled = true;
                cancelled.removeEventListener('abort', cancel);
                resolve(allowed);
            };
            if (cancelled.aborted) {
                cancel();
                return;
            }
            cancelled.addEventListener('abort', cancel, { once: true });
            parseJson(req, res, (error) => {
                if (settled) {
                    return;
                }
                if (error) {
                    if (!res.headersSent && !res.destroyed) {
                        res.status(record(error) && error.type === 'entity.too.large' ? 413 : 400).json({
                            error: 'UPDATE_REQUEST',
                        });
                    }
                    finish(false);
                }
                else {
                    finish(true);
                }
            });
        });
    }
    app.get(`${prefix}/status`, (req, res) => {
        perform(req, res, false, async (authorize) => {
            const result = await options.service.status();
            if (!(await authorize())) {
                replyError(res, new Error('UPDATE_AUTH'));
                return;
            }
            res.json(result);
        });
    });
    for (const action of ['check', 'prepare', 'start']) {
        app.post(`${prefix}/${action}`, (req, res) => {
            perform(req, res, true, async (authorize, cancelled) => {
                if (!(await bodyAllowed(req, res, cancelled))) {
                    return;
                }
                if (!(await authorize())) {
                    replyError(res, new Error('UPDATE_AUTH'));
                    return;
                }
                const body = req.body;
                const keys = action === 'check' ? [] : action === 'prepare' ? ['version'] : ['planId', 'confirm'];
                if (!record(body) ||
                    Object.keys(body).length !== keys.length ||
                    Object.keys(body).some(key => !keys.includes(key))) {
                    res.status(400).json({ error: 'UPDATE_REQUEST' });
                    return;
                }
                let result;
                if (action === 'check') {
                    result = await options.service.check();
                }
                else if (action === 'prepare' &&
                    typeof body.version === 'string' &&
                    /^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(body.version)) {
                    result = await options.service.prepare(body.version, authorize);
                }
                else if (action === 'start' &&
                    body.confirm === true &&
                    typeof body.planId === 'string' &&
                    /^[a-zA-Z0-9_-]{16,128}$/.test(body.planId)) {
                    result = await options.service.start(body.planId, authorize);
                }
                else {
                    res.status(400).json({ error: 'UPDATE_REQUEST' });
                    return;
                }
                if (!(await authorize())) {
                    replyError(res, new Error('UPDATE_AUTH'));
                    return;
                }
                res.json(result);
            });
        });
    }
}
//# sourceMappingURL=eosCustomerUpdateHttp.js.map