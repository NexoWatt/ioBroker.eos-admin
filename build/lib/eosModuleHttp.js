/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const { join } = require('node:path');
const { bounded } = require('./eosModuleHost');
/** Fixed same-origin module routes; no arbitrary file or ioBroker-command proxy. */
function registerEosModuleRoutes({ app, host, baseDir, jsonParser, authorize, csrfAllowed, requestAllowed }) {
    const guard = (write = false, page = false) => (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        if (!requestAllowed(req)) {
            res.status(403).json({ error: 'AUTH_ORIGIN' });
            return;
        }
        void bounded(Promise.resolve().then(() => authorize(req)), 5000).then(status => {
            if (!status?.authenticated) {
                if (page)
                    res.redirect('/login.html');
                else
                    res.status(401).json({ error: 'AUTHENTICATION_REQUIRED' });
                return;
            }
            if (status.mustChangePassword) {
                if (page)
                    res.redirect(status.nextUrl);
                else
                    res.status(403).json({ error: 'PASSWORD_CHANGE_REQUIRED' });
                return;
            }
            if (status.role !== 'admin') {
                res.status(403).json({ error: 'ADMIN_REQUIRED' });
                return;
            }
            if (write && !csrfAllowed(req)) {
                res.status(403).json({ error: 'AUTH_CSRF' });
                return;
            }
            res.locals.eosModuleCsrf = status.csrfToken;
            next();
        }).catch(() => { if (!res.headersSent)
            res.status(503).json({ error: 'AUTH_UNAVAILABLE' }); });
    };
    const action = handler => (req, res) => {
        void Promise.resolve().then(() => handler(req)).then(result => {
            if (!res.headersSent)
                res.json(result);
        }, error => {
            const code = typeof error?.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : 'EOS_MODULE_REQUEST_FAILED';
            if (!res.headersSent)
                res.status(code.includes('TIMEOUT') ? 504 : 400).json({ error: code });
        });
    };
    const sendFile = file => (_req, res) => res.sendFile(file, error => {
        if (error && !res.headersSent)
            res.status(404).json({ error: 'EOS_MODULE_ASSET_UNAVAILABLE' });
    });
    const vendor = {
        'jquery.js': 'lib/js/jquery-3.2.1.min.js', 'materialize.js': 'lib/js/materialize.js',
        'materialize.css': 'lib/css/materialize.css', 'adapter.css': 'css/adapter.css',
    };
    for (const id of ['devices', 'eebus']) {
        const api = `/api/eos/modules/${id}`;
        app.get(api, guard(), (req, res) => {
            void host.view(id).then(value => res.json({ ...value, csrfToken: res.locals.eosModuleCsrf }), () => res.status(503).json({ error: 'EOS_MODULE_STATUS_UNAVAILABLE' }));
        });
        app.put(api, guard(true), jsonParser, action(req => host.save(id, req.body?.config)));
        app.post(`${api}/import`, guard(true), jsonParser, action(req => host.importLegacy(id, req.body?.instance)));
        app.post(`${api}/command`, guard(true), jsonParser, action(req => host.command(id, req.body?.command, req.body?.payload)));
        app.get(`/modules/${id}`, guard(false, true), (req, res, next) => {
            // Express is non-strict by default: only the actual slashless URL
            // redirects, so relative scripts/vendor assets keep their module base.
            if (req.path.endsWith('/')) {
                next();
                return;
            }
            res.redirect(308, `/modules/${id}/`);
        });
        app.get(`/modules/${id}/`, guard(false, true), sendFile(join(baseDir, 'modules', id, 'admin', 'index.html')));
        for (const asset of ['index_m.js', 'style.css', 'words.js', 'host-bridge.js', 'index.js']) {
            app.get(`/modules/${id}/${asset}`, guard(false, true), sendFile(join(baseDir, 'modules', id, 'admin', asset)));
        }
    }
    for (const [name, file] of Object.entries(vendor)) {
        app.get(`/modules/devices/vendor/${name}`, guard(false, true), sendFile(join(baseDir, 'adminWww', file)));
    }
    app.get('/modules/devices/templates.json', guard(false, true), sendFile(join(baseDir, 'modules', 'devices', 'lib', 'templates.json')));
    app.use('/api/eos/modules', (error, _req, res, next) => {
        if (res.headersSent) {
            next(error);
            return;
        }
        res.status(error?.type === 'entity.too.large' ? 413 : 400).json({ error: 'EOS_MODULE_INVALID_JSON' });
    });
}
module.exports = { registerEosModuleRoutes };
//# sourceMappingURL=eosModuleHttp.js.map