"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerEosTlsRoutes = registerEosTlsRoutes;
/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
const node_path_1 = require("node:path");
const express_1 = require("express");
function registerEosTlsRoutes(options) {
    const { app, manager } = options;
    const guard = (write = false, page = false) => (req, res, next) => {
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
        void options.authorize(req).then(status => {
            if (done || res.headersSent) {
                return;
            }
            clearTimeout(timer);
            done = true;
            if (!status.authenticated) {
                if (page) {
                    res.redirect('/login.html');
                }
                else {
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
        }, () => {
            clearTimeout(timer);
            done = true;
            if (!res.headersSent) {
                res.status(503).json({ error: 'AUTH_UNAVAILABLE' });
            }
        });
    };
    const action = (handler) => (req, res) => {
        void Promise.resolve()
            .then(() => handler(req))
            .then(value => res.json(value), (error) => {
            const code = error &&
                typeof error === 'object' &&
                'code' in error &&
                typeof error.code === 'string' &&
                /^EOS_TLS_[A-Z_]{1,80}$/.test(error.code)
                ? error.code
                : 'EOS_TLS_REQUEST_FAILED';
            if (!res.headersSent) {
                res.status(code === 'EOS_TLS_BUSY' ? 409 : 400).json({ error: code });
            }
        });
    };
    app.get('/api/eos/tls', guard(), (_req, res) => {
        res.json({ ...manager.status(), csrfToken: res.locals.eosTlsCsrf });
    });
    app.post('/api/eos/tls/request', guard(true), (0, express_1.json)({ limit: '128kb', strict: true }), action(req => manager.createRequest(req.body)));
    app.post('/api/eos/tls/certificate', guard(true), (0, express_1.json)({ limit: '128kb', strict: true }), action(req => manager.importCertificate(req.body)));
    app.get('/api/eos/tls/request.pem', guard(), (_req, res) => {
        try {
            res.type('application/pkcs10').attachment('NexoWatt-EOS-request.pem').send(manager.publicRequest());
        }
        catch {
            res.status(404).json({ error: 'EOS_TLS_REQUEST_NOT_FOUND' });
        }
    });
    app.get('/api/eos/tls/root.cer', guard(), (_req, res) => {
        try {
            res.type('application/pkix-cert').attachment('NexoWatt-Root-CA.cer').send(manager.publicRoot());
        }
        catch {
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
        app.get(asset === 'index.html' ? '/security/tls/' : '/security/tls/index.js', guard(false, true), (_req, res) => {
            res.sendFile((0, node_path_1.join)(options.baseDir, 'public', 'eos-tls', asset), error => {
                if (error && !res.headersSent) {
                    res.status(404).json({ error: 'EOS_TLS_ASSET_UNAVAILABLE' });
                }
            });
        });
    }
    app.use('/api/eos/tls', (error, _req, res, next) => {
        if (res.headersSent) {
            next(error);
            return;
        }
        const tooLarge = error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large';
        res.status(tooLarge ? 413 : 400).json({ error: 'EOS_TLS_INVALID_JSON' });
    });
}
//# sourceMappingURL=eosTlsHttp.js.map