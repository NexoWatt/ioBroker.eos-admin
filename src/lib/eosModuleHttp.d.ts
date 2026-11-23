import type { Express, Request, RequestHandler } from 'express';
import type { EosModuleHost } from './eosModuleHost';
export function registerEosModuleRoutes(options: {
    app: Express;
    host: EosModuleHost;
    baseDir: string;
    jsonParser: RequestHandler;
    authorize: (request: Request) => Promise<Record<string, unknown>>;
    csrfAllowed: (request: Request) => boolean;
    requestAllowed: (request: Request) => boolean;
}): void;
