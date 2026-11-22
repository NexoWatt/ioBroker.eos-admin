/**
 * Copyright (c) 2026 NexoWatt. All rights reserved.
 * Confidential and Proprietary.
 * Use, modification or distribution without express written permission is prohibited.
 */
// @runtime-transpile
/**
 * NexoWatt Quellcode-Erklärung (DE)
 * Aufgabe: Übergabe vom Express-5-Verwaltungsserver an die eingebettete Express-4-UI.
 * Daten und Wirkung: Erhält Abfrageparameter und Request-/Response-Prototypen; führt asynchrone Routenfehler der vorhandenen Fehlerbehandlung zu.
 * Bei Änderungen: Parser-, Middleware-, Authentifizierungs- und Wiederherstellungsverhalten über echte Express-5-/Express-4-HTTP-Verbindungen prüfen.
 * Express 4 prüft req.query vor dem Austausch des Request-Prototyps. Ein geerbter
 * Express-5-Getter verhindert sonst das Parsen und verschwindet anschließend.
 * Die UI erhält ihre eigenen Prototypen bereits vor der Query-Middleware. Ihr
 * konfigurierter Parser verarbeitet die aktuelle URL; nach Rückgabe/Abschluss
 * werden die äußeren Prototypen und eine vorherige eigene Query wiederhergestellt.
 * Asynchrone Fehler der fertig registrierten UI-Routen gehen an deren vorhandene
 * Fehler-Middleware. Keine globalen Express-/Prozess-Patches und keine neuen ACLs.
 * Die Express-4-Layerstruktur ist eine geprüfte Integrationsgrenze: bei einem
 * Frameworkwechsel müssen die realen HTTP-Regressionstests erneut bestehen.
 */
import type { NextFunction, Request, Response } from 'express';

interface HostedApplication {
  (req: Request, res: Response, next: NextFunction): void;
  request: object;
  response: object;
  _router?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && (typeof value === 'object' || typeof value === 'function');
}

/** Rejecting with a routing sentinel must not turn an error into a route bypass. */
function rejectionReason(error: unknown): unknown {
  return !error || error === 'route' || error === 'router' ? new Error('EOS_HTTP_HANDLER_REJECTED') : error;
}

function observeResult(value: unknown, reject: (error: unknown) => void): void {
  if (isObject(value) && typeof value.then === 'function') {
    void Promise.resolve(value).catch(reject);
  }
}

/** Only this completed UI router is changed; other apps and Express prototypes remain untouched. */
function containAsyncHandlers(app: HostedApplication): void {
  const seen = new WeakSet<object>();
  const visit = (stack: unknown): void => {
    if (!Array.isArray(stack)) throw new Error('EOS_HTTP_ROUTER_CONTRACT');
    for (const layer of stack) {
      if (!isObject(layer) || typeof layer.handle !== 'function') throw new Error('EOS_HTTP_ROUTER_CONTRACT');
      if (seen.has(layer)) continue;
      seen.add(layer);
      const handler = layer.handle;
      if (isObject(layer.route)) {
        visit(layer.route.stack);
      } else if (isObject(handler) && Array.isArray(handler.stack)) {
        visit(handler.stack);
      } else if (handler.length <= 3) {
        layer.handle = function (this: unknown, req: Request, res: Response, next: NextFunction): unknown {
          let advanced = false;
          const advance: NextFunction = (error?: unknown): void => {
            if (advanced) return;
            advanced = true;
            next(error);
          };
          const reject = (error: unknown): void => {
            if (!res.writableEnded && !res.destroyed) advance(rejectionReason(error));
          };
          try {
            const result: unknown = Reflect.apply(handler, this, [req, res, advance]);
            observeResult(result, reject);
            return result;
          } catch (error: unknown) { reject(error); return undefined; }
        };
      } else if (handler.length === 4) {
        // Express distinguishes error middleware by its four-argument arity.
        layer.handle = function (this: unknown, error: unknown, req: Request, res: Response, next: NextFunction): unknown {
          let advanced = false;
          const advance: NextFunction = (failure?: unknown): void => {
            if (advanced) return;
            advanced = true;
            next(failure);
          };
          const reject = (failure: unknown): void => {
            if (!res.writableEnded && !res.destroyed) advance(rejectionReason(failure));
          };
          try {
            const result: unknown = Reflect.apply(handler, this, [error, req, res, advance]);
            observeResult(result, reject);
            return result;
          } catch (failure: unknown) { reject(failure); return undefined; }
        };
      }
    }
  };
  if (!isObject(app._router)) throw new Error('EOS_HTTP_ROUTER_CONTRACT');
  visit(app._router.stack);
}

export function createHostedHttpHandler(app: HostedApplication): (req: Request, res: Response, next: NextFunction) => void {
  containAsyncHandlers(app);
  return (req: Request, res: Response, next: NextFunction): void => {
    const requestPrototype: object | null = Object.getPrototypeOf(req);
    const responsePrototype: object | null = Object.getPrototypeOf(res);
    const queryDescriptor = Object.getOwnPropertyDescriptor(req, 'query');
    let restored = false;
    let forwarded = false;
    const restore = (): void => {
      if (restored) return;
      restored = true;
      res.removeListener('finish', restore);
      res.removeListener('close', restore);
      if (queryDescriptor) Object.defineProperty(req, 'query', queryDescriptor);
      else Reflect.deleteProperty(req, 'query');
      Object.setPrototypeOf(req, requestPrototype);
      Object.setPrototypeOf(res, responsePrototype);
    };
    const done: NextFunction = (error?: unknown): void => {
      if (forwarded) return;
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
    } catch (error: unknown) { done(rejectionReason(error)); }
  };
}
