"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcppRpcServer = void 0;
const node_http_1 = require("node:http");
const node_module_1 = require("node:module");
const operationGuard_1 = require("./operationGuard");
// Load supplied CommonJS dependencies locally without changing the module loader.
const requireNative = (0, node_module_1.createRequire)(__filename);
const rpcModule = requireNative('ocpp-rpc');
const register16 = requireNative('../ocpp/v16').registerHandlers;
const register201 = requireNative('../ocpp/v201').registerHandlers;
const register21 = requireNative('../ocpp/v21').registerHandlers;
class OcppRpcServer {
    ctx;
    opts;
    server;
    httpServer = null;
    identities = new Set();
    clients = new Set();
    closing = null;
    constructor(ctx, opts) {
        this.ctx = ctx;
        this.opts = opts;
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
                if (typeof identity !== 'string' ||
                    !identity.trim() ||
                    identity.length > 128 ||
                    [...identity].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
                    identity.trim() === 'info') {
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
            }
            catch {
                reject(503, 'Runtime inactive');
            }
        });
        this.server.on('client', (client) => {
            this.clients.add(client);
            client.once('close', () => this.clients.delete(client));
            void this.onClient(client).catch(() => {
                ctx.log.warn('EOS_OCPP_CLIENT_INIT_FAILED');
                void client.close({ force: true, code: 1008, reason: 'Runtime inactive' }).catch(() => undefined);
            });
        });
    }
    assert() {
        if (this.closing) {
            throw new Error('EOS_OCPP_STOPPED');
        }
        this.ctx.assertCanOperate?.();
    }
    async listen() {
        this.assert();
        const server = (0, node_http_1.createServer)({ noDelay: true }, (_req, res) => {
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
            await new Promise((resolve, reject) => {
                server.once('error', reject);
                server.listen({ port: this.opts.port, host: this.opts.host || '0.0.0.0' }, resolve);
            });
            this.assert();
            server.on('error', () => this.ctx.log.error('EOS_OCPP_LISTENER_ERROR'));
        }
        catch (error) {
            await this.close();
            throw error;
        }
        this.ctx.log.info(`NexoWatt OCPP listening on ${this.opts.host || '0.0.0.0'}:${this.opts.port} for ${this.opts.protocols.join(', ')}`);
    }
    close() {
        if (this.closing) {
            return this.closing;
        }
        const server = this.httpServer;
        this.httpServer = null;
        this.closing = (async () => {
            await this.server.close({ force: true, awaitPending: false });
            if (server) {
                await new Promise(resolve => {
                    server.close(() => resolve());
                    server.closeAllConnections();
                });
            }
        })();
        return this.closing;
    }
    async onClient(client) {
        this.assert();
        (0, operationGuard_1.guardRpcClient)(client, () => this.assert());
        const proto = client.protocol;
        const rawIdentity = client.identity;
        const id = this.ctx.runtime.resolveIdentity(rawIdentity);
        client.stateIdentity = id;
        client.rawIdentity = rawIdentity;
        this.ctx.runtime.indexClient(id, proto, client, rawIdentity);
        if (proto === 'ocpp1.6') {
            register16(client, this.ctx);
        }
        else if (proto === 'ocpp2.0.1') {
            register201(client, this.ctx);
        }
        else if (proto === 'ocpp2.1') {
            register21(client, this.ctx);
        }
        else {
            throw new Error('EOS_OCPP_PROTOCOL_UNSUPPORTED');
        }
        client.on('socketError', () => this.ctx.log.warn('EOS_OCPP_SOCKET_ERROR'));
        client.on('close', (details = {}) => {
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
exports.OcppRpcServer = OcppRpcServer;
