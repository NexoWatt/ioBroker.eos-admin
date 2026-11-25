/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Stellt den engen EOS-Updateweg für angemeldete Kunden, Installateure und Administratoren bereit.
 * Daten und Wirkung: Prüft Ursprung, aktuelle Sitzung, Erstpasswort und CSRF; nimmt ausschließlich Version oder vorbereiteten Plan entgegen, keine Befehle oder URLs.
 * Bei Änderungen: Alle Rollen, Sitzungsentzug während Vorbereitung und Start sowie unbekannte JSON-Felder negativ testen; die allgemeinen ioBroker-Rechte bleiben unverändert.
 */
import { json, type Express, type Request, type Response } from 'express';
import type { EosCustomerUpdates } from './eosCustomerUpdates';
interface UpdateHttpOptions {
    service: Pick<EosCustomerUpdates, 'status' | 'check' | 'prepare' | 'start'>;
    requestAllowed(req: Request): boolean;
    csrfAllowed(req: Request): boolean;
    access(req: Request): Promise<unknown>;
    /** Internal test/deployment deadline only; never taken from request data. */
    responseTimeoutMs?: number;
}
type Data = Record<string, unknown>;
const record = (value: unknown): value is Data => value !== null && typeof value === 'object' && !Array.isArray(value);
export function registerEosCustomerUpdateRoutes(app: Express, options: UpdateHttpOptions): void {
    const prefix = '/api/eos-update';
    const requestedTimeout = options.responseTimeoutMs;
    const timeoutMs =
        typeof requestedTimeout === 'number' && Number.isFinite(requestedTimeout) && requestedTimeout > 0
            ? Math.min(20000, requestedTimeout)
            : 20000;
    const parseJson = json({ limit: '1kb', strict: true });
    let pending = 0;
    async function authorized(req: Request, write: boolean): Promise<boolean> {
        if (!options.requestAllowed(req) || (write && !options.csrfAllowed(req))) {
            return false;
        }
        const access = await options.access(req);
        return (
            record(access) &&
            access.authenticated === true &&
            access.mustChangePassword === false &&
            ['admin', 'installer', 'customer'].includes(typeof access.role === 'string' ? access.role : '')
        );
    }
    function replyError(res: Response, error: unknown): void {
        if (res.headersSent || res.destroyed) {
            return;
        }
        const code =
            error instanceof Error && /^(?:EOS_)?UPDATE_[A-Z0-9_]{1,80}$/.test(error.message)
                ? error.message
                : 'UPDATE_UNAVAILABLE';
        res.status(/AUTH|SESSION/.test(code) ? 403 : /BUSY|CHANGED|PLAN|CONFLICT|EXPIRED/.test(code) ? 409 : 503).json({
            error: code,
        });
    }
    function perform(
        req: Request,
        res: Response,
        write: boolean,
        operation: (authorize: () => Promise<boolean>, cancelled: AbortSignal) => Promise<void>,
    ): void {
        res.setHeader('Cache-Control', 'no-store');
        if (pending >= 8) {
            res.status(429).json({ error: 'UPDATE_BUSY' });
            return;
        }
        pending++;
        let alive = true;
        const cancellation = new AbortController();
        const close = (): void => {
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
        const authorize = async (): Promise<boolean> => {
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
            .catch((error: unknown) => {
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
    function bodyAllowed(req: Request, res: Response, cancelled: AbortSignal): Promise<boolean> {
        return new Promise(resolve => {
            let settled = false;
            const cancel = (): void => {
                if (settled) {
                    return;
                }
                settled = true;
                // Unlike a DB commit, an incomplete request body is cancellable.
                // Close its transport after the timeout response was flushed.
                if (!req.complete && !req.destroyed) {
                    if (res.writableFinished || res.destroyed) {
                        req.destroy();
                    } else {
                        res.once('finish', () => req.destroy());
                    }
                }
                resolve(false);
            };
            const finish = (allowed: boolean): void => {
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
            parseJson(req, res, (error?: unknown) => {
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
                } else {
                    finish(true);
                }
            });
        });
    }
    app.get(`${prefix}/status`, (req, res): void => {
        perform(req, res, false, async authorize => {
            const result = await options.service.status();
            if (!(await authorize())) {
                replyError(res, new Error('UPDATE_AUTH'));
                return;
            }
            res.json(result);
        });
    });
    for (const action of ['check', 'prepare', 'start'] as const) {
        app.post(`${prefix}/${action}`, (req: Request, res: Response): void => {
            perform(req, res, true, async (authorize, cancelled) => {
                if (!(await bodyAllowed(req, res, cancelled))) {
                    return;
                }
                if (!(await authorize())) {
                    replyError(res, new Error('UPDATE_AUTH'));
                    return;
                }
                const body: unknown = req.body;
                const keys = action === 'check' ? [] : action === 'prepare' ? ['version'] : ['planId', 'confirm'];
                if (
                    !record(body) ||
                    Object.keys(body).length !== keys.length ||
                    Object.keys(body).some(key => !keys.includes(key))
                ) {
                    res.status(400).json({ error: 'UPDATE_REQUEST' });
                    return;
                }
                let result: unknown;
                if (action === 'check') {
                    result = await options.service.check();
                } else if (
                    action === 'prepare' &&
                    typeof body.version === 'string' &&
                    /^\d{1,6}\.\d{1,6}\.\d{1,6}$/.test(body.version)
                ) {
                    result = await options.service.prepare(body.version, authorize);
                } else if (
                    action === 'start' &&
                    body.confirm === true &&
                    typeof body.planId === 'string' &&
                    /^[a-zA-Z0-9_-]{16,128}$/.test(body.planId)
                ) {
                    result = await options.service.start(body.planId, authorize);
                } else {
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
