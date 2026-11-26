/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { X509Certificate } from 'node:crypto';
import { json, type Express, type Request, type Response, type NextFunction, type RequestHandler } from 'express';
import type { EosTlsManager } from './eosTlsManager';

interface Options {
    app: Express;
    manager: EosTlsManager;
    baseDir: string;
    authorize(request: Request): Promise<Record<string, unknown>>;
    csrfAllowed(request: Request): boolean;
    requestAllowed(request: Request): boolean;
}
export function registerEosTlsRoutes(options: Options): void {
    const { app, manager } = options;
    // Certificate trust must be set up before a first login. This separate,
    // read-only surface exposes only the already validated public root, never
    // controller certificates, private keys, a CSR or administrator state.
    const publicTrustRequest = (req: Request, res: Response): boolean => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader(
            'Content-Security-Policy',
            "default-src 'none'; img-src 'self'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        );
        if (!options.requestAllowed(req)) {
            res.status(403).json({ error: 'AUTH_ORIGIN' });
            return false;
        }
        return true;
    };
    let trustTemplate: Promise<string> | null = null;
    const loadTrustTemplate = (): Promise<string> => {
        trustTemplate ??= readFile(join(options.baseDir, 'public', 'eos-tls', 'trust.html'), 'utf8').catch(
            (error: unknown) => {
                trustTemplate = null;
                throw error;
            },
        );
        return trustTemplate;
    };
    app.get('/security/trust', (req, res, next) => {
        if (!publicTrustRequest(req, res)) {
            return;
        }
        if (req.path.endsWith('/')) {
            next();
            return;
        }
        res.redirect(308, '/security/trust/');
    });
    app.get('/security/trust/', (req, res): void => {
        if (!publicTrustRequest(req, res)) {
            return;
        }
        void loadTrustTemplate().then(
            template => {
                let fingerprint = '';
                try {
                    fingerprint = new X509Certificate(manager.publicRoot()).fingerprint256;
                } catch {
                    /* Existing ioBroker TLS does not imply an exportable NexoWatt root. */
                }
                // X509Certificate supplies fixed hexadecimal bytes, not user HTML.
                const available = /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(fingerprint);
                res.type('html').send(
                    template
                        .replace('{{DOWNLOAD_HIDDEN}}', available ? '' : 'hidden')
                        .replace('{{UNAVAILABLE_HIDDEN}}', available ? 'hidden' : '')
                        .replace('{{ROOT_FINGERPRINT}}', available ? fingerprint : '—'),
                );
            },
            () => res.status(404).json({ error: 'EOS_TLS_TRUST_PAGE_UNAVAILABLE' }),
        );
    });
    app.get('/security/trust/root.cer', (req, res): void => {
        if (!publicTrustRequest(req, res)) {
            return;
        }
        try {
            const certificate = manager.publicRoot();
            res.type('application/pkix-cert').attachment('NexoWatt-Root-CA.cer').send(certificate);
        } catch {
            res.status(404).json({ error: 'EOS_TLS_ROOT_NOT_CONFIGURED', help: '/security/trust/' });
        }
    });
    app.get('/security/trust/trust.css', (req, res): void => {
        if (!publicTrustRequest(req, res)) {
            return;
        }
        res.sendFile(join(options.baseDir, 'public', 'eos-tls', 'trust.css'), { cacheControl: false }, error => {
            if (error && !res.headersSent) {
                res.status(404).json({ error: 'EOS_TLS_TRUST_PAGE_UNAVAILABLE' });
            }
        });
    });
    app.all(
        ['/security/trust', '/security/trust/', '/security/trust/root.cer', '/security/trust/trust.css'],
        (req, res): void => {
            if (!publicTrustRequest(req, res)) {
                return;
            }
            res.setHeader('Allow', 'GET, HEAD');
            res.status(405).json({ error: 'EOS_TLS_READ_ONLY' });
        },
    );
    const guard =
        (write = false, page = false): RequestHandler =>
        (req, res, next): void => {
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            if (!options.requestAllowed(req)) {
                res.status(403).json({ error: 'AUTH_ORIGIN' });
                return;
            }
            let done = false;
            const timer = setTimeout(() => {
                done = true;
                if (!res.headersSent) {
                    res.status(503).json({ error: 'AUTH_UNAVAILABLE' });
                }
            }, 5000);
            void options.authorize(req).then(
                status => {
                    if (done || res.headersSent) {
                        return;
                    }
                    clearTimeout(timer);
                    done = true;
                    if (!status.authenticated) {
                        if (page) {
                            res.redirect('/login.html');
                        } else {
                            res.status(401).json({ error: 'AUTHENTICATION_REQUIRED' });
                        }
                        return;
                    }
                    if (status.mustChangePassword) {
                        res.status(403).json({ error: 'PASSWORD_CHANGE_REQUIRED' });
                        return;
                    }
                    if (status.role !== 'admin') {
                        res.status(403).json({ error: 'ADMIN_REQUIRED' });
                        return;
                    }
                    if (write && !options.csrfAllowed(req)) {
                        res.status(403).json({ error: 'AUTH_CSRF' });
                        return;
                    }
                    res.locals.eosTlsCsrf = status.csrfToken;
                    next();
                },
                () => {
                    clearTimeout(timer);
                    done = true;
                    if (!res.headersSent) {
                        res.status(503).json({ error: 'AUTH_UNAVAILABLE' });
                    }
                },
            );
        };
    const action =
        (handler: (req: Request) => Promise<Record<string, unknown>>): RequestHandler =>
        (req, res): void => {
            void Promise.resolve()
                .then(() => handler(req))
                .then(
                    value => res.json(value),
                    (error: unknown) => {
                        const code =
                            error &&
                            typeof error === 'object' &&
                            'code' in error &&
                            typeof error.code === 'string' &&
                            /^EOS_TLS_[A-Z_]{1,80}$/.test(error.code)
                                ? error.code
                                : 'EOS_TLS_REQUEST_FAILED';
                        if (!res.headersSent) {
                            res.status(code === 'EOS_TLS_BUSY' ? 409 : 400).json({ error: code });
                        }
                    },
                );
        };
    app.get('/api/eos/tls', guard(), (_req, res): void => {
        res.json({ ...manager.status(), csrfToken: res.locals.eosTlsCsrf as unknown });
    });
    app.post(
        '/api/eos/tls/request',
        guard(true),
        json({ limit: '128kb', strict: true }),
        action(req => manager.createRequest(req.body as unknown)),
    );
    app.post(
        '/api/eos/tls/certificate',
        guard(true),
        json({ limit: '128kb', strict: true }),
        action(req => manager.importCertificate(req.body as unknown)),
    );
    app.post(
        '/api/eos/tls/local',
        guard(true),
        json({ limit: '16kb', strict: true }),
        action(req => manager.createLocalCertificate(req.body as unknown)),
    );
    app.post(
        '/api/eos/tls/local/activate',
        guard(true),
        json({ limit: '2kb', strict: true }),
        action(req => manager.activateLocalCertificate(req.body as unknown)),
    );
    for (const [kind, filename] of [
        ['device', 'NexoWatt-EOS-Gerätezertifikat.pem'],
        ['root', 'NexoWatt-EOS-Stammzertifikat.pem'],
    ] as const) {
        app.get(`/api/eos/tls/local/${kind}.pem`, guard(), (req, res): void => {
            try {
                const certificate = manager.publicLocalCertificate(kind, req.query.requestId);
                res.type('application/x-pem-file').attachment(filename).send(certificate);
            } catch {
                res.status(404).json({ error: 'EOS_TLS_LOCAL_CERTIFICATE_NOT_FOUND' });
            }
        });
    }
    app.get('/api/eos/tls/local/root.cer', guard(), (req, res): void => {
        try {
            const certificate = new X509Certificate(manager.publicLocalCertificate('root', req.query.requestId));
            res.type('application/pkix-cert').attachment('NexoWatt-EOS-Stammzertifikat.cer').send(certificate.raw);
        } catch {
            res.status(404).json({ error: 'EOS_TLS_LOCAL_CERTIFICATE_NOT_FOUND' });
        }
    });
    app.get('/api/eos/tls/request.pem', guard(), (_req, res) => {
        try {
            res.type('application/pkcs10').attachment('NexoWatt-EOS-request.pem').send(manager.publicRequest());
        } catch {
            res.status(404).json({ error: 'EOS_TLS_REQUEST_NOT_FOUND' });
        }
    });
    app.get('/api/eos/tls/root.cer', guard(), (_req, res) => {
        try {
            res.type('application/pkix-cert').attachment('NexoWatt-Root-CA.cer').send(manager.publicRoot());
        } catch {
            res.status(404).json({ error: 'EOS_TLS_ROOT_NOT_CONFIGURED' });
        }
    });
    app.get('/security/tls', guard(false, true), (req, res, next) => {
        if (req.path.endsWith('/')) {
            next();
            return;
        }
        res.redirect(308, '/security/tls/');
    });
    for (const asset of ['index.html', 'index.js']) {
        app.get(
            asset === 'index.html' ? '/security/tls/' : '/security/tls/index.js',
            guard(false, true),
            (_req, res) => {
                res.sendFile(join(options.baseDir, 'public', 'eos-tls', asset), error => {
                    if (error && !res.headersSent) {
                        res.status(404).json({ error: 'EOS_TLS_ASSET_UNAVAILABLE' });
                    }
                });
            },
        );
    }
    app.use('/api/eos/tls', (error: unknown, _req: Request, res: Response, next: NextFunction): void => {
        if (res.headersSent) {
            next(error);
            return;
        }
        const tooLarge = error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large';
        res.status(tooLarge ? 413 : 400).json({ error: 'EOS_TLS_INVALID_JSON' });
    });
}
