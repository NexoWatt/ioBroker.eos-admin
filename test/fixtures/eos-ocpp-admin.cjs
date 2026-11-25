'use strict';
// Production HTTP boundary and authenticated session; module persistence/status are doubles.
const express = require('express');
const path = require('node:path');
const crypto = require('node:crypto');
const { UnifiedSessions } = require('../../src/lib/eosUnifiedBoundary');
const { registerEosModuleRoutes } = require('../../src/lib/eosModuleHttp');
const { installIdleSession } = require('./eos-idle-session.cjs');
const defaults = require('../../modules/ocpp/native-defaults.json');

async function createFixture() {
    const token = 'c'.repeat(40); let role = 'admin'; let first = false; let mode = 'normal'; let held;
    const adapter = {}; const session = await installIdleSession(adapter, { token, user: 'operator' });
    const state = { config: { ...structuredClone(defaults), enabled: true, zeroLimitBehavior: 'keepLast', createTechnicalAliases: true },
        namespace: 'eos-admin.0.ocpp', revision: crypto.randomUUID(), saves: [], imports: [], reads: 0, statusUnavailable: false,
        stations: [{ id: 'CP_1', identity: 'Station <img src=x onerror=alert(1)>', protocol: 'ocpp2.1', connected: true,
            status: 'Charging', lastSeenMs: Date.now(), dataFresh: true, leaseArmed: true, leaseState: 'active' }] };
    const authority = new UnifiedSessions(adapter, { secure: false, externalOrigin: '',
        resolveAccess: async req => req.headers.cookie === `access_token=${token}`
            ? { userId: 'system.user.operator', role, groups: [] } : { userId: null, role: 'enduser', groups: [] },
        firstLogin: async () => ({ required: first }), getLicense: () => ({ valid: true, coreEnabled: true }) });
    const fail = code => Object.assign(new Error(`PRIVATE ${code}`), { code });
    const host = {
        status: async id => ({ enabled: id === 'ocpp', active: id === 'ocpp', namespace: id === 'ocpp' ? state.namespace : '',
            details: { process: { mode: 'process', state: id === 'ocpp' ? 'running' : 'stopped', pid: id === 'ocpp' ? 12345 : null } } }),
        migrationStatus: () => ({ phase: 'COMMITTED', sources: [{ id: 'ocpp', source: 'ocpp21.0', namespacePreserved: true, privateKey: 'PRIVATE' }] }),
        view: async id => {
            if (id !== 'ocpp') throw fail('EOS_MODULE_ID'); state.reads++;
            return { id, config: structuredClone(state.config), configurationRevision: state.revision, configurationReady: true,
                manualImport: { allowed: !state.config.enabled && state.namespace === 'eos-admin.0.ocpp', reason: state.namespace !== 'eos-admin.0.ocpp' ? 'EOS_MODULE_IMPORT_ALREADY_MIGRATED' : state.config.enabled ? 'EOS_MODULE_IMPORT_REQUIRES_DISABLED' : '' },
                status: { namespace: state.namespace, enabled: state.config.enabled, active: state.config.enabled, reason: state.config.enabled ? 'RUNNING' : 'DISABLED',
                    details: { started: state.config.enabled, statusUnavailable: state.statusUnavailable, port: state.config.port, sourceVersion: '0.4.4', stations: state.config.enabled ? structuredClone(state.stations) : [],
                        process: { mode: 'process', state: state.config.enabled ? 'running' : 'stopped', pid: state.config.enabled ? 12345 : null } } } };
        },
        save: async (id, config, _migration, revision) => {
            if (id !== 'ocpp') throw fail('EOS_MODULE_ID');
            if (revision !== state.revision) throw fail('EOS_MODULE_CONFIG_CONFLICT');
            if (!config || typeof config !== 'object' || !Number.isInteger(config.port) || config.port < 1024 || config.port > 65535) throw fail('EOS_OCPP_CONFIG_NUMBER');
            state.saves.push({ id, config: structuredClone(config), revision }); state.config = structuredClone(config); state.revision = crypto.randomUUID(); return { ok: true };
        },
        importLegacy: async (id, instance) => {
            if (id !== 'ocpp' || typeof instance !== 'string' || !/^ocpp21\.\d{1,8}$/.test(instance)) throw fail('EOS_MODULE_LEGACY_INSTANCE');
            if (state.config.enabled) throw fail('EOS_MODULE_IMPORT_REQUIRES_DISABLED');
            state.imports.push(instance); state.config = { ...structuredClone(defaults), enabled: false, port: 9333 };
            state.namespace = instance; state.revision = crypto.randomUUID(); return { ok: true };
        },
        command: async () => { throw new Error('OCPP command route must not exist'); },
    };
    const app = express();
    app.use('/api/eos/modules/ocpp', (req, res, next) => {
        if (req.method === 'GET' && mode === 'error') { res.status(503).json({ error: 'EOS_MODULE_STATUS_UNAVAILABLE' }); return; }
        if (req.method === 'GET' && mode === 'hold') { held = res; return; }
        next();
    });
    app.get('/eos-session-idle.js', (_req, res) => res.type('text/javascript').send(''));
    app.get('/system/img/eos/nexowatt-eos-brand-wide.png', (_req, res) => res.sendFile(path.resolve(__dirname, '../../admin/img/eos/nexowatt-eos-brand-wide.png')));
    registerEosModuleRoutes({ app, host, baseDir: path.resolve(__dirname, '../..'), jsonParser: express.json({ limit: '64kb' }),
        authorize: req => authority.status(req), requestAllowed: req => authority.requestAllowed(req), csrfAllowed: req => authority.csrfAllowed(req) });
    app.use((_req, res) => res.status(404).end());
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    const origin = `http://127.0.0.1:${server.address().port}`;
    return { state, origin, token, role: value => { role = value; }, first: value => { first = value; }, mode: value => { mode = value; },
        release: () => { if (held && !held.destroyed) held.end(); held = null; },
        request: (url, options = {}) => fetch(origin + url, { ...options, redirect: 'manual', headers: { cookie: `access_token=${token}`, ...options.headers } }),
        close: async () => { if (held && !held.destroyed) held.end(); session.cleanup(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } };
}
module.exports = { createFixture };
