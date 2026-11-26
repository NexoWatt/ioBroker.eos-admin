/**
 * AUTO-GENERATED RUNTIME FILE - NICHT MANUELL BEARBEITEN.
 *
 * Quelle: src-ts/runtime-executables/lib/eos-presentation.ts
 * Quell-Hash: sha256:e93e16ad5cb445fc484dc6eefcad7022020e05b6fa0af7f426c74b3282f5653c
 * Erzeugung: npm run sync:ts-runtime-executables
 *
 * Zweck:
 * Diese JavaScript-Datei ist das ausführbare Build-Artefakt für lib/eos-presentation.js.
 * Die fachliche Bearbeitung erfolgt ab 0.7.131 in der TypeScript-Quelle.
 * Ab 0.7.132 sind doppelte Legacy-JS-Bäume wie .nwcore entfernt.
 *
 * Pflege-Regel:
 * 1. Änderung zuerst in src-ts/runtime-executables/ vornehmen.
 * 2. npm run sync:ts-runtime-executables ausführen.
 * 3. npm run test:runtime-executables prüfen.
 */
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHostedRuntime = createHostedRuntime;
/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
const node_path_1 = __importDefault(require("node:path"));
const datapoint_picker_1 = require("./datapoint-picker");
const eos_presentation_routes_1 = require("./eos-presentation-routes");
const hosted_http_boundary_1 = require("./hosted-http-boundary");
const runtime_proxy_html_1 = require("./runtime-proxy-html");
const express = require('express4');
const { centralAccess, centralLicenseSnapshot } = require('./hosted-adapter');
function canUse(access, capability) {
    return access.authenticated === true && Array.isArray(access.capabilities) &&
        (access.capabilities.includes('*') || access.capabilities.includes(capability));
}
function noStore(res) {
    res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        Pragma: 'no-cache',
        Expires: '0',
    });
}
/** Read-only UI. Browser input cannot invoke an operational or state-write handler here. */
function createHostedRuntime(owner, bridge) {
    const root = node_path_1.default.resolve(__dirname, '..');
    const migration = owner.config?.eosUiMigration;
    const namespace = migration?.preserveNamespace === true && typeof migration.source === 'string' &&
        /^nexowatt-ui\.\d+$/.test(migration.source) ? migration.source : owner.namespace;
    const sendHtml = (0, runtime_proxy_html_1.createRuntimeFileSender)(root, namespace);
    const app = express();
    app.disable('x-powered-by');
    app.use(async (req, res, next) => {
        const route = (0, eos_presentation_routes_1.presentationRoute)(req.method, req.url);
        if (!route)
            return next();
        res.set({
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'SAMEORIGIN',
            'Referrer-Policy': 'no-referrer',
            'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
            'Content-Security-Policy': "base-uri 'self'; object-src 'none'; frame-ancestors 'self'",
        });
        if (bridge.originAllowed(req) !== true) {
            res.status(403).json({ ok: false, error: 'origin_forbidden', message: 'Zugriff von fremder Origin blockiert.' });
            return;
        }
        if (route === 'asset' || route === 'file')
            return next();
        noStore(res);
        try {
            const access = await centralAccess(bridge, req);
            if (access.role === 'none' || access.authenticated !== true) {
                if (route === 'dashboard') {
                    const prefix = (0, runtime_proxy_html_1.runtimeProxyPrefix)(req, namespace) || '';
                    res.redirect(303, prefix + '/login.html?returnTo=' + encodeURIComponent(prefix + '/'));
                }
                else
                    res.status(401).json({ ok: false, error: 'authentication_required', mode: 'eos' });
                return;
            }
            if (!canUse(access, 'frontend.open')) {
                res.status(403).json({ ok: false, error: 'forbidden' });
                return;
            }
            const license = centralLicenseSnapshot(bridge);
            if (req.path.toLowerCase().startsWith('/api/smarthome/') && !license.grants.includes('smartHome')) {
                res.status(403).json({ ok: false, error: 'EOS_FEATURE_LICENSE_REQUIRED' });
                return;
            }
            if (!license.ok) {
                res.status(403).type('html').send('<!doctype html><html lang="de"><meta charset="utf-8"><title>NexoWatt EOS – Lizenz</title><h1>EOS-Lizenz erforderlich</h1><p><a href="/nexowatt/license">Lizenz aktivieren</a></p></html>');
                return;
            }
            next();
        }
        catch {
            res.status(503).json({ ok: false, error: 'authentication_unavailable' });
        }
    });
    const requireMapping = async (req, res, next) => {
        const access = await centralAccess(bridge, req);
        if (access.role === 'none' || access.authenticated !== true) {
            res.status(401).json({ ok: false, error: 'unauthorized', message: 'Installer-/Admin-Anmeldung erforderlich.' });
            return;
        }
        if (!canUse(access, 'mapping.edit')) {
            res.status(403).json({ ok: false, error: 'forbidden', message: 'Diese Funktion ist für diese Rolle nicht freigegeben.' });
            return;
        }
        next();
    };
    const picker = (0, datapoint_picker_1.registerDatapointPicker)(app, owner, requireMapping);
    app.get('/', (req, res) => sendHtml(req, res, node_path_1.default.join(root, 'www', 'index.html')));
    for (const [url, [file, type]] of eos_presentation_routes_1.PRESENTATION_FILES) {
        app.get(url, (_req, res) => { res.type(type).sendFile(node_path_1.default.join(root, file)); });
    }
    app.get('/static/evcs-electrical-limits.js', (_req, res) => {
        res.sendFile(node_path_1.default.join(root, 'lib', 'evcs-electrical-limits.js'));
    });
    const staticOptions = { index: false, redirect: false, dotfiles: 'deny' };
    app.use('/static', express.static(node_path_1.default.join(root, 'www'), staticOptions));
    app.use('/assets', express.static(node_path_1.default.join(root, 'www', 'assets'), staticOptions));
    app.use((_error, _req, res, next) => {
        if (res.headersSent)
            return next(_error);
        res.status(503).json({ ok: false, error: 'EOS_UI_UNAVAILABLE' });
    });
    const handle = (0, hosted_http_boundary_1.createHostedHttpHandler)(app);
    let running = false;
    return {
        async start() { running = true; },
        async stop() { running = false; picker.close(); },
        handle(req, res, next) {
            if (!running || !(0, eos_presentation_routes_1.presentationRoute)(req.method, req.url))
                return next();
            return handle(req, res, next);
        },
        status() { return { state: running ? 'ready' : 'stopped', active: running, canWrite: false, emsReady: false }; },
    };
}
