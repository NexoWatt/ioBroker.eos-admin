/** Hosted OCPP network boundary, based on the supplied MIT 0.4.3 server. */
import type { EventEmitter } from 'node:events';
import type { IncomingMessage, Server } from 'node:http';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import type { Duplex } from 'node:stream';
import type { RpcClient } from './operationGuard';
import { guardRpcClient } from './operationGuard';

type RecordValue = Record<string, unknown>;
interface Client extends EventEmitter, RpcClient {
    protocol: string;
    identity: string;
    stateIdentity?: string;
    rawIdentity?: string;
    close(options?: { force?: boolean; code?: number; reason?: string; awaitPending?: boolean }): Promise<unknown>;
}
interface RpcServer extends EventEmitter {
    auth(
        callback: (
            accept: (options: RecordValue) => void,
            reject: (code: number, reason: string) => void,
            handshake: { identity?: unknown },
        ) => void,
    ): void;
    handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): Promise<unknown>;
    close(options: { force: boolean; awaitPending: boolean }): Promise<void>;
}
interface Context {
    assertCanOperate?: () => void;
    config: { identityAllowlist?: string[]; callTimeoutSec?: number };
    log: { info(message: string): void; warn(message: string): void; error(message: string): void };
    runtime: {
        resolveIdentity(identity: string): string;
        indexClient(id: string, protocol: string, client: Client, rawIdentity: string): void;
        unindexClient(id: string, client: Client): boolean;
        noteDisconnect?(id: string, client: Client, details: RecordValue): Promise<void>;
    };
    states: { setConnection(id: string, connected: boolean, metadata: RecordValue): Promise<void> };
}
interface Options {
    port: number;
    host?: string;
    protocols: string[];
    strictMode?: boolean;
}
// Load supplied CommonJS dependencies locally without changing the module loader.
const requireNative = createRequire(__filename);
const rpcModule: { RPCServer: new (options: RecordValue) => RpcServer } = requireNative('ocpp-rpc');
const register16: (client: Client, context: Context) => void = requireNative('../ocpp/v16').registerHandlers;
const register201: (client: Client, context: Context) => void = requireNative('../ocpp/v201').registerHandlers;
const register21: (client: Client, context: Context) => void = requireNative('../ocpp/v21').registerHandlers;

export class OcppRpcServer {
    private readonly server: RpcServer;
    private httpServer: Server | null = null;
    private readonly identities = new Set<string>();
    private readonly clients = new Set<Client>();
    private closing: Promise<void> | null = null;
    constructor(
        private readonly ctx: Context,
        private readonly opts: Options,
    ) {
        this.server = new rpcModule.RPCServer({
            protocols: opts.protocols,
            strictMode: opts.strictMode ?? true,
            respondWithDetailedErrors: false,
            maxBadMessages: 5,
            wssOptions: { maxPayload: 1024 * 1024 },
            callTimeoutMs: Math.max(5000, Number(ctx.config.callTimeoutSec || 20) * 1000),
        });
        this.server.on('error', () => ctx.log.error('EOS_OCPP_RPC_SERVER_ERROR'));
        this.server.auth((accept, reject, handshake) => {
            try {
                this.assert();
                const identity = handshake.identity;
                if (
                    typeof identity !== 'string' ||
                    !identity.trim() ||
                    identity.length > 128 ||
                    [...identity].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
                    identity.trim() === 'info'
                ) {
                    return reject(400, 'Invalid station identity');
                }
                if ((!this.identities.has(identity) && this.identities.size >= 256) || this.clients.size >= 256) {
                    return reject(503, 'Station capacity reached');
                }
                if (ctx.config.identityAllowlist?.length && !ctx.config.identityAllowlist.includes(identity)) {
                    return reject(403, 'Identity not allowed');
                }
                this.identities.add(identity);
                accept({ session: { connectedAt: Date.now(), identity } });
            } catch {
                reject(503, 'Runtime inactive');
            }
        });
        this.server.on('client', (client: Client) => {
            this.clients.add(client);
            client.once('close', () => this.clients.delete(client));
            void this.onClient(client).catch(() => {
                ctx.log.warn('EOS_OCPP_CLIENT_INIT_FAILED');
                void client.close({ force: true, code: 1008, reason: 'Runtime inactive' }).catch(() => undefined);
            });
        });
    }
    private assert(): void {
        if (this.closing) {
            throw new Error('EOS_OCPP_STOPPED');
        }
        this.ctx.assertCanOperate?.();
    }
    async listen(): Promise<void> {
        this.assert();
        const server = createServer({ noDelay: true }, (_req, res) => {
            res.statusCode = 404;
            res.end();
        });
        this.httpServer = server;
        // Guard the async upgrade too: malformed URI decoding in an upstream
        // handler must close that socket, not become an unhandled rejection.
        server.on('upgrade', (request, socket, head) => {
            void Promise.resolve()
                .then(() => {
                    this.assert();
                    return this.server.handleUpgrade(request, socket, head);
                })
                .catch(() => socket.destroy());
        });
        try {
            await new Promise<void>((resolve, reject) => {
                server.once('error', reject);
                server.listen({ port: this.opts.port, host: this.opts.host || '0.0.0.0' }, resolve);
            });
            this.assert();
            server.on('error', () => this.ctx.log.error('EOS_OCPP_LISTENER_ERROR'));
        } catch (error) {
            await this.close();
            throw error;
        }
        this.ctx.log.info(
            `NexoWatt OCPP listening on ${this.opts.host || '0.0.0.0'}:${this.opts.port} for ${this.opts.protocols.join(', ')}`,
        );
    }
    close(): Promise<void> {
        if (this.closing) {
            return this.closing;
        }
        const server = this.httpServer;
        this.httpServer = null;
        this.closing = (async () => {
            await this.server.close({ force: true, awaitPending: false });
            if (server) {
                await new Promise<void>(resolve => {
                    server.close(() => resolve());
                    server.closeAllConnections();
                });
            }
        })();
        return this.closing;
    }
    private async onClient(client: Client): Promise<void> {
        this.assert();
        guardRpcClient(client, () => this.assert());
        const proto = client.protocol;
        const rawIdentity = client.identity;
        const id = this.ctx.runtime.resolveIdentity(rawIdentity);
        client.stateIdentity = id;
        client.rawIdentity = rawIdentity;
        this.ctx.runtime.indexClient(id, proto, client, rawIdentity);
        if (proto === 'ocpp1.6') {
            register16(client, this.ctx);
        } else if (proto === 'ocpp2.0.1') {
            register201(client, this.ctx);
        } else if (proto === 'ocpp2.1') {
            register21(client, this.ctx);
        } else {
            throw new Error('EOS_OCPP_PROTOCOL_UNSUPPORTED');
        }
        client.on('socketError', () => this.ctx.log.warn('EOS_OCPP_SOCKET_ERROR'));
        client.on('close', (details: RecordValue = {}) => {
            void (async () => {
                await this.ctx.runtime.noteDisconnect?.(id, client, details);
                const removed = this.ctx.runtime.unindexClient(id, client);
                if (removed) {
                    await this.ctx.states.setConnection(id, false, { socketConnected: false });
                }
            })().catch(() => this.ctx.log.warn('EOS_OCPP_DISCONNECT_PUBLICATION_FAILED'));
        });
        await this.ctx.states.setConnection(id, true, { socketConnected: true, rawIdentity, protocol: proto });
        this.assert();
    }
}
