/* Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
'use strict';
const { join } = require('node:path');
const { Transform } = require('node:stream');
const { bounded } = require('./eosModuleHost');
const { createRuntimeHealthReader, readDashboardProcessStatus } = require('./eosRuntimeHealth');
const MIGRATION_PHASES = new Set(['IDLE', 'DISABLED', 'LICENSE_REQUIRED', 'NOT_NEEDED', 'BLOCKED', 'PREPARED',
    'STOPPING', 'TRANSFERRED', 'COMMITTED', 'ROLLING_BACK', 'ROLLED_BACK', 'ROLLBACK_REQUIRED', 'NOT_AVAILABLE']);
const MIGRATION_SOURCES = Object.freeze({ ui: 'nexowatt-ui', devices: 'nexowatt-devices', eebus: 'eebus', backup: 'nexowatt-backup', ocpp: 'ocpp21' });
/** Never expose a journal/config object through the public migration status API. */
function publicMigrationStatus(value, migration) {
    const phase = MIGRATION_PHASES.has(value?.phase) ? value.phase : 'NOT_AVAILABLE';
    const sources = [];
    const seen = new Set();
    for (const row of (Array.isArray(value?.sources) ? value.sources.slice(0, 256) : [])) {
        if (!row || typeof row.id !== 'string' || !Object.hasOwn(MIGRATION_SOURCES, row.id) || typeof row.source !== 'string' ||
            !new RegExp(`^${MIGRATION_SOURCES[row.id]}\\.\\d{1,8}$`).test(row.source) || seen.has(row.source))
            continue;
        seen.add(row.source);
        sources.push({ id: row.id, source: row.source,
            namespacePreserved: row.namespacePreserved === true && ['TRANSFERRED', 'COMMITTED'].includes(phase) });
    }
    const issues = [];
    for (const issue of (Array.isArray(value?.issues) ? value.issues.slice(0, 256) : [])) {
        if (sources.some(row => row.id === issue?.id && row.source === issue?.source) &&
            typeof issue.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(issue.code)) {
            issues.push({ id: issue.id, source: issue.source, code: issue.code });
        }
    }
    // Read the same admission decision used by the supervisor. Source IDs alone cannot
    // distinguish a local preflight conflict from a site-wide recovery fence.
    const blockedProcesses = typeof migration?.allowsStartup === 'function'
        ? ['ui', 'ems', 'devices', 'eebus', 'backup', 'ocpp'].filter(id => migration.allowsStartup(id) === false) : null;
    return {
        phase, issues, blockedProcesses,
        code: typeof value?.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(value.code) ? value.code : '',
        sources,
        updatedAt: Number.isSafeInteger(value?.updatedAt) && value.updatedAt > 0 && value.updatedAt <= 8640000000000000 ? value.updatedAt : null,
        existingAdaptersUnchanged: ['BLOCKED', 'DISABLED', 'LICENSE_REQUIRED', 'NOT_NEEDED'].includes(phase),
    };
}
/** Fixed same-origin module routes; no arbitrary file or ioBroker-command proxy. */
function registerEosModuleRoutes({ app, host, baseDir, jsonParser, authorize, csrfAllowed, requestAllowed, runtimeStatus, runtimeControl }) {
    const guard = (write = false, page = false, dashboard = false) => (req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        if (!requestAllowed(req)) {
            res.status(403).json({ error: 'AUTH_ORIGIN' });
            return;
        }
        void bounded(Promise.resolve().then(() => authorize(req)), 5000).then(status => {
            const runtimePage = page && /^\/runtime(?:\/|$)/.test(req.path || '');
            if (!status?.authenticated || (runtimePage && status.kiosk === true)) {
                if (page)
                    res.redirect(runtimePage
                        ? '/login.html?admin=1&returnTo=%2Fruntime%2F' : '/login.html');
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
            if (dashboard) {
                if (status.activationRequired) {
                    res.status(402).json({ error: 'LICENSE_REQUIRED' });
                    return;
                }
                if (!Array.isArray(status.capabilities) || !status.capabilities.some(capability => capability === '*' || capability === 'frontend.open')) {
                    res.status(403).json({ error: 'FRONTEND_ACCESS_REQUIRED' });
                    return;
                }
            }
            else if (status.role !== 'admin') {
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
                res.status(code === 'EOS_MODULE_CONFIG_CONFLICT' || code === 'EOS_RUNTIME_BUSY' ? 409 : code.includes('TIMEOUT') ? 504 : 400).json({ error: code });
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
    const migrationReport = () => bounded(Promise.resolve().then(() => host.migrationStatus()))
        .then(value => publicMigrationStatus(value, host.owner?.eosMigration));
    const runtimeHealth = createRuntimeHealthReader({ host, runtimeStatus, runtimeControl });
    // Served by the parent even when the EMS child is stopped. No worker RPC, controller
    // inventory, persistent telemetry or background timer is required for a dashboard read.
    const dashboardPath = '/api/eos/dashboard/process-status';
    app.get(dashboardPath, guard(false, false, true), action(() => readDashboardProcessStatus(host, runtimeStatus, runtimeControl)));
    app.all(dashboardPath, guard(false, false, true), (_req, res) => res.setHeader('Allow', 'GET, HEAD').status(405).json({ error: 'METHOD_NOT_ALLOWED' }));
    app.get('/api/eos/runtime', guard(), (_req, res) => {
        void runtimeHealth().then(async (value) => {
            // Ask only when a card really reports a migration gate. Failure to read the
            // optional explanation must not discard confirmed process and heartbeat data.
            const gated = value.processes.some(row => row.controls?.reason === 'EOS_RUNTIME_MIGRATION_BLOCKED' ||
                row.controls?.operationReason === 'EOS_RUNTIME_MIGRATION_BLOCKED');
            const migration = gated ? await migrationReport().catch(() => null) : null;
            if (!res.destroyed && !res.headersSent)
                res.json({ ...value, migration, csrfToken: res.locals.eosModuleCsrf });
        }, () => {
            if (!res.destroyed && !res.headersSent)
                res.status(503).json({ error: 'EOS_RUNTIME_STATUS_UNAVAILABLE' });
        });
    });
    app.all('/api/eos/runtime', guard(), (_req, res) => res.setHeader('Allow', 'GET').status(405).json({ error: 'METHOD_NOT_ALLOWED' }));
    // A body may arrive slowly: resolve current authority again after parsing,
    // immediately before accepting a process mutation.
    app.post('/api/eos/runtime/:id/control', guard(true), jsonParser, guard(true), (req, res) => {
        try {
            if (!runtimeControl)
                throw Object.assign(new Error('EOS_RUNTIME_NOT_READY'), { code: 'EOS_RUNTIME_NOT_READY' });
            const body = req.body;
            if (!body || typeof body !== 'object' || Array.isArray(body) ||
                Object.keys(body).some(key => !['action', 'expectedRevision'].includes(key))) {
                throw Object.assign(new Error('EOS_RUNTIME_REQUEST_INVALID'), { code: 'EOS_RUNTIME_REQUEST_INVALID' });
            }
            const value = runtimeControl.request(req.params.id, body.action, body.expectedRevision);
            res.status(202).json(value);
        }
        catch (error) {
            const code = typeof error?.code === 'string' && /^EOS_[A-Z0-9_]{1,72}$/.test(error.code) ? error.code : 'EOS_RUNTIME_CONTROL_FAILED';
            res.status(code === 'EOS_RUNTIME_BUSY' || code === 'EOS_RUNTIME_CONFIG_CONFLICT' ? 409 : 400).json({ error: code });
        }
    });
    app.all('/api/eos/runtime/:id/control', guard(), (_req, res) => res.setHeader('Allow', 'POST').status(405).json({ error: 'METHOD_NOT_ALLOWED' }));
    app.use('/api/eos/runtime', (error, _req, res, next) => {
        if (res.headersSent) {
            next(error);
            return;
        }
        res.status(error?.type === 'entity.too.large' ? 413 : 400).json({ error: 'EOS_RUNTIME_INVALID_JSON' });
    });
    app.get('/runtime', guard(false, true), (req, res, next) => {
        if (req.path.endsWith('/')) {
            next();
            return;
        }
        res.redirect(308, '/runtime/');
    });
    app.get('/runtime/', guard(false, true), (req, res) => {
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'");
        res.setHeader('X-Content-Type-Options', 'nosniff');
        sendFile(join(baseDir, 'public', 'eos-runtime', 'index.html'))(req, res);
    });
    for (const asset of ['index.js', 'style.css']) {
        app.get(`/runtime/${asset}`, guard(false, true), sendFile(join(baseDir, 'public', 'eos-runtime', asset)));
    }
    app.get('/api/eos/migration', guard(), (_req, res) => {
        void migrationReport().then(value => res.json(value), () => res.status(503).json({ error: 'EOS_MIGRATION_STATUS_UNAVAILABLE' }));
    });
    app.all('/api/eos/migration', guard(), (_req, res) => res.setHeader('Allow', 'GET').status(405).json({ error: 'METHOD_NOT_ALLOWED' }));
    app.get('/migration', guard(false, true), (req, res, next) => {
        if (req.path.endsWith('/')) {
            next();
            return;
        }
        res.redirect(308, '/migration/');
    });
    app.get('/migration/', guard(false, true), (req, res) => {
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'");
        res.setHeader('X-Content-Type-Options', 'nosniff');
        sendFile(join(baseDir, 'public', 'eos-migration', 'index.html'))(req, res);
    });
    app.get('/migration/index.js', guard(false, true), sendFile(join(baseDir, 'public', 'eos-migration', 'index.js')));
    for (const id of ['devices', 'eebus', 'backup', 'ocpp']) {
        const api = `/api/eos/modules/${id}`;
        app.get(api, guard(), (req, res) => {
            void host.view(id).then(value => res.json({ ...value, csrfToken: res.locals.eosModuleCsrf }), () => res.status(503).json({ error: 'EOS_MODULE_STATUS_UNAVAILABLE' }));
        });
        app.put(api, guard(true), jsonParser, guard(true), action(req => {
            if (runtimeControl?.pending)
                throw Object.assign(new Error('EOS_RUNTIME_BUSY'), { code: 'EOS_RUNTIME_BUSY' });
            const revision = req.body?.expectedConfigurationRevision;
            if (typeof revision !== 'string' || !/^[a-f0-9-]{36}$/.test(revision)) {
                throw Object.assign(new Error('EOS_MODULE_CONFIG_CONFLICT'), { code: 'EOS_MODULE_CONFIG_CONFLICT' });
            }
            return host.save(id, req.body?.config, undefined, revision);
        }));
        app.post(`${api}/import`, guard(true), jsonParser, guard(true), action(req => {
            if (runtimeControl?.pending)
                throw Object.assign(new Error('EOS_RUNTIME_BUSY'), { code: 'EOS_RUNTIME_BUSY' });
            return host.importLegacy(id, req.body?.instance);
        }));
        if (id !== 'ocpp')
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
        app.get(`/modules/${id}/`, guard(false, true), (req, res) => {
            if (id === 'ocpp') {
                res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'");
                res.setHeader('X-Content-Type-Options', 'nosniff');
            }
            sendFile(join(baseDir, 'modules', id, 'admin', 'index.html'))(req, res);
        });
        for (const asset of ['index_m.js', 'style.css', 'words.js', 'host-bridge.js', 'index.js', ...(id === 'devices' ? ['ems-assignment.js'] : []), ...(id === 'ocpp' ? ['config-fields.json'] : [])]) {
            app.get(`/modules/${id}/${asset}`, guard(false, true), sendFile(join(baseDir, 'modules', id, 'admin', asset)));
        }
    }
    let activeDownloads = 0;
    app.get('/api/eos/modules/backup/download/:name', guard(), (req, res) => {
        // Archive bytes never pass through JSON or a whole-file memory buffer.
        // Admission is bounded before opening an archive, including slow clients.
        if (activeDownloads >= 2) {
            res.status(429).json({ error: 'EOS_BACKUP_DOWNLOAD_BUSY' });
            return;
        }
        activeDownloads++;
        let source;
        let limiter;
        let finished = false;
        const destroySource = () => {
            try {
                if (typeof source?.destroy === 'function')
                    source.destroy();
            }
            catch { /* response still closes */ }
        };
        const finish = () => {
            if (finished)
                return;
            finished = true;
            activeDownloads--;
            clearTimeout(timer);
            destroySource();
            limiter?.destroy();
        };
        const timer = setTimeout(() => {
            finish();
            res.destroy();
        }, 30 * 60 * 1000);
        timer.unref?.();
        res.once('close', finish);
        res.once('finish', finish);
        req.once('aborted', finish);
        void Promise.resolve().then(() => host.download('backup', req.params.name)).then(archive => {
            source = archive?.stream;
            if (finished) {
                destroySource();
                return;
            }
            if (!source || typeof source.pipe !== 'function' || typeof source.destroy !== 'function' ||
                typeof archive.filename !== 'string' || !/^eos-backup-[A-Za-z0-9._-]{1,140}\.nwb$/.test(archive.filename) ||
                archive.contentType !== 'application/octet-stream' || !Number.isSafeInteger(archive.size) || archive.size <= 0) {
                finish();
                res.status(503).json({ error: 'EOS_BACKUP_DOWNLOAD_INVALID' });
                return;
            }
            res.setHeader('Content-Type', 'application/octet-stream');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Content-Disposition', `attachment; filename="${archive.filename}"`);
            res.setHeader('Content-Length', String(archive.size));
            if (req.method === 'HEAD') {
                finish();
                res.end();
                return;
            }
            let transferred = 0;
            limiter = new Transform({
                transform(chunk, _encoding, callback) {
                    transferred += chunk.length;
                    callback(transferred > archive.size ? new Error('EOS_BACKUP_DOWNLOAD_SIZE') : null, chunk);
                },
                flush(callback) { callback(transferred === archive.size ? null : new Error('EOS_BACKUP_DOWNLOAD_SIZE')); },
            });
            const failed = () => { finish(); res.destroy(); };
            source.once('error', failed);
            limiter.once('error', failed);
            source.pipe(limiter).pipe(res);
        }).catch(() => {
            if (finished)
                return;
            finish();
            if (!res.headersSent)
                res.status(404).json({ error: 'EOS_BACKUP_ARCHIVE_UNAVAILABLE' });
            else
                res.destroy();
        });
    });
    for (const [name, file] of Object.entries(vendor)) {
        app.get(`/modules/devices/vendor/${name}`, guard(false, true), sendFile(join(baseDir, 'adminWww', file)));
    }
    app.get('/modules/shared/eos-module.css', guard(false, true), sendFile(join(baseDir, 'modules', 'shared', 'eos-module.css')));
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