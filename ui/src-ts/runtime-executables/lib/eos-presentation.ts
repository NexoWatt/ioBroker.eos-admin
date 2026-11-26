// @runtime-transpile
/** Copyright (c) 2026 NexoWatt. Confidential and proprietary. */
import path from 'node:path';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { registerDatapointPicker } from './datapoint-picker';
import { presentationRoute, PRESENTATION_FILES } from './eos-presentation-routes';
import { createHostedHttpHandler } from './hosted-http-boundary';
import { createRuntimeFileSender, runtimeProxyPrefix } from './runtime-proxy-html';

type Access = { role?: unknown; authenticated?: unknown; capabilities?: unknown };
interface PresentationBridge {
  resolveAccess(req: Request): Promise<unknown>;
  getLicense(): unknown;
  originAllowed(req: Request): boolean;
}
type PresentationOwner = Parameters<typeof registerDatapointPicker>[1] & {
  namespace: string;
  config?: { eosUiMigration?: { preserveNamespace?: unknown; source?: unknown } };
};

const express: typeof import('express') = require('express4');
const { centralAccess, centralLicenseSnapshot } = require('./hosted-adapter') as {
  centralAccess(bridge: PresentationBridge, req: Request): Promise<Access>;
  centralLicenseSnapshot(bridge: PresentationBridge): { ok: boolean; grants: string[] };
};

function canUse(access: Access, capability: string): boolean {
  return access.authenticated === true && Array.isArray(access.capabilities) &&
    (access.capabilities.includes('*') || access.capabilities.includes(capability));
}

function noStore(res: Response): void {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  });
}

/** Read-only UI. Browser input cannot invoke an operational or state-write handler here. */
export function createHostedRuntime(owner: PresentationOwner, bridge: PresentationBridge) {
  const root = path.resolve(__dirname, '..');
  const migration = owner.config?.eosUiMigration;
  const namespace = migration?.preserveNamespace === true && typeof migration.source === 'string' &&
    /^nexowatt-ui\.\d+$/.test(migration.source) ? migration.source : owner.namespace;
  const sendHtml = createRuntimeFileSender(root, namespace);
  const app = express();
  app.disable('x-powered-by');

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const route = presentationRoute(req.method, req.url);
    if (!route) return next();
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
    if (route === 'asset' || route === 'file') return next();
    noStore(res);
    try {
      const access = await centralAccess(bridge, req);
      if (access.role === 'none' || access.authenticated !== true) {
        if (route === 'dashboard') {
          const prefix = runtimeProxyPrefix(req, namespace) || '';
          res.redirect(303, prefix + '/login.html?returnTo=' + encodeURIComponent(prefix + '/'));
        } else res.status(401).json({ ok: false, error: 'authentication_required', mode: 'eos' });
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
    } catch {
      res.status(503).json({ ok: false, error: 'authentication_unavailable' });
    }
  });

  const requireMapping: RequestHandler = async (req, res, next) => {
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
  const picker = registerDatapointPicker(app, owner, requireMapping);
  app.get('/', (req, res) => sendHtml(req, res, path.join(root, 'www', 'index.html')));
  for (const [url, [file, type]] of PRESENTATION_FILES) {
    app.get(url, (_req, res) => { res.type(type).sendFile(path.join(root, file)); });
  }
  app.get('/static/evcs-electrical-limits.js', (_req, res) => {
    res.sendFile(path.join(root, 'lib', 'evcs-electrical-limits.js'));
  });
  const staticOptions = { index: false as const, redirect: false, dotfiles: 'deny' as const };
  app.use('/static', express.static(path.join(root, 'www'), staticOptions));
  app.use('/assets', express.static(path.join(root, 'www', 'assets'), staticOptions));
  app.use((_error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) return next(_error);
    res.status(503).json({ ok: false, error: 'EOS_UI_UNAVAILABLE' });
  });
  const handle = createHostedHttpHandler(app);
  let running = false;
  return {
    async start() { running = true; },
    async stop() { running = false; picker.close(); },
    handle(req: Request, res: Response, next: NextFunction) {
      if (!running || !presentationRoute(req.method, req.url)) return next();
      return handle(req, res, next);
    },
    status() { return { state: running ? 'ready' : 'stopped', active: running, canWrite: false, emsReady: false }; },
  };
}
