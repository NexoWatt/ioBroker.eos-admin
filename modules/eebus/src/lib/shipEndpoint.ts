import { createServer } from 'node:https';
import { AddressInfo } from 'node:net';
import { certificateIdentity } from './certificateIdentity';
import { EebusConfig } from './config';
import { DiscoveredShipNode, EebusIdentity, ShipConnectionState } from './eebusTypes';
import { safeId } from './sanitizer';
import {
    DecodedShipFrame,
    decodeShipFrame,
    encodeCmiFrame,
    encodeControlFrame,
    encodeDataFrame,
    encodeEndFrame,
    makeHello,
    makePinError,
    makePinInput,
    makePinState,
    makeProtocolHandshake,
} from './shipFrames';

const SHIP_WEBSOCKET_PROTOCOL = 'ship';

type MessageCallback = (deviceId: string, message: unknown) => void | Promise<void>;
type NodeCallback = (node: DiscoveredShipNode) => void | Promise<void>;
type StateCallback = (deviceId: string, state: ShipConnectionState, role: 'client' | 'server', connected: boolean, error?: string) => void | Promise<void>;
type DataExchangeCallback = (deviceId: string) => void | Promise<void>;
type PairingRequestCallback = (deviceId: string, request: unknown) => void | Promise<void>;
type TrustCallback = (deviceId: string) => Promise<boolean>;

interface ShipSession {
    deviceId: string;
    socket: any;
    role: 'client' | 'server';
    state: ShipConnectionState;
    node?: DiscoveredShipNode;
    remoteSki: string;
    remoteFingerprint: string;
    remoteAddress: string;
    protocolSelected: boolean;
    remoteHelloReady: boolean;
    localHelloReady: boolean;
    dataExchangeReady: boolean;
    authorized?: boolean;
    handshakeTimer?: ReturnType<typeof setTimeout>;
    work?: Promise<void>;
    pendingFrames?: number;
    pinAccepted?: boolean;
    cmiComplete?: boolean;
}

export class ShipEndpoint {
    private server: any;
    private wss: any;
    private bonjour: any;
    private advertisement: any;
    private sockets = new Map<string, any>();
    private sessions = new Map<string, ShipSession>();
    private stopping = false;
    private registering = new Set<any>();
    private queuedBytes = 0;
    private serverConnections = new Set<import('node:net').Socket>();
    private connecting = new Map<string, any>();

    public constructor(
        private readonly adapter: any,
        private readonly config: EebusConfig,
        private readonly identity: EebusIdentity,
        private readonly onMessage: MessageCallback,
        private readonly onNode: NodeCallback,
        private readonly onState: StateCallback,
        private readonly onDataExchange: DataExchangeCallback,
        private readonly onPairingRequest: PairingRequestCallback,
        private readonly isTrusted: TrustCallback,
    ) {}

    public async start(): Promise<boolean> {
        this.stopping = false;
        if (!this.config.shipServerEnabled) {
            this.adapter.log.info('Local EOS/HEMS SHIP endpoint is disabled. Wallboxes cannot pair with EOS through EEBUS.');
            return false;
        }

        let WebSocketServer: any;
        try {
            ({ WebSocketServer } = require('ws'));
        } catch (error) {
            this.adapter.log.warn(`ws is not available. Local SHIP endpoint cannot start until dependencies are installed: ${String(error)}`);
            return false;
        }

        return new Promise(resolve => {
            try {
                this.server = createServer({
                    key: this.identity.privateKey,
                    cert: this.identity.certificate,
                    requestCert: true,
                    rejectUnauthorized: false,
                    minVersion: 'TLSv1.2',
                    handshakeTimeout: 5000,
                });

                this.server.requestTimeout = 5000;
                this.server.headersTimeout = 5000;
                this.server.maxConnections = 64;
                this.server.on('request', (_request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => { response.writeHead(404); response.end(); });
                this.server.on('connection', (socket: import('node:net').Socket) => { this.serverConnections.add(socket); socket.once('close', () => this.serverConnections.delete(socket)); });
                this.wss = new WebSocketServer({
                    server: this.server,
                    path: this.config.shipPath,
                    perMessageDeflate: false,
                    maxPayload: 262144,
                    handleProtocols: (protocols: any) => (protocols.has(SHIP_WEBSOCKET_PROTOCOL) ? SHIP_WEBSOCKET_PROTOCOL : false),
                });

                this.wss.on('connection', (socket: any, request: any) => {
                    this.background(this.registerSocket(socket, request, 'server'), socket);
                });

                this.server.on('error', (error: Error) => {
                    this.adapter.log.warn(`Local EOS/HEMS SHIP endpoint could not listen on port ${this.config.shipPort}: ${error.message}`);
                    resolve(false);
                });

                this.server.listen(this.config.shipPort, () => {
                    const address = this.server.address() as AddressInfo;
                    this.adapter.log.info(`Local EOS/HEMS SHIP endpoint listening on port ${address.port}${this.config.shipPath}`);
                    this.publishMdnsIfEnabled(address.port);
                    resolve(true);
                });
            } catch (error) {
                this.adapter.log.warn(`Local EOS/HEMS SHIP endpoint could not start: ${String(error)}`);
                resolve(false);
            }
        });
    }

    public async connectToNode(node: DiscoveredShipNode): Promise<boolean> {
        if (this.stopping || this.sessions.size + this.connecting.size >= 32) return false;
        if (!this.config.autoConnectEnabled) return false;
        if (!node.host || !node.port) return false;
        if (this.sessions.has(node.safeId) || this.connecting.has(node.safeId)) return true;
        if (node.ski && node.ski === this.identity.localSki) return false;
        if (node.id && node.id === this.identity.shipId) return false;

        let WebSocket: any;
        try {
            WebSocket = require('ws');
        } catch (error) {
            this.adapter.log.warn(`ws is not available. Cannot connect to EEBUS node ${node.safeId}: ${String(error)}`);
            return false;
        }

        if (!/^[A-Fa-f0-9]{40}$/.test(node.ski) || !Number.isInteger(node.port) || node.port < 1024 || node.port > 65535) return false;
        const path = node.path || '/ship/';
        if (!/^\/[A-Za-z0-9/_-]{0,63}$/.test(path)) return false;
        const url = `wss://${addressForUrl(node.host)}:${node.port}${path}`;
        await this.onState(node.safeId, 'connecting', 'client', false);
        if (this.stopping || this.adapter.canOperate?.() === false || this.sessions.size + this.connecting.size >= 32 || this.sessions.has(node.safeId) || this.connecting.has(node.safeId)) return false;

        return new Promise(resolve => {
            try {
                const socket = new WebSocket(url, SHIP_WEBSOCKET_PROTOCOL, {
                    rejectUnauthorized: false,
                    cert: this.identity.certificate,
                    key: this.identity.privateKey,
                    minVersion: 'TLSv1.2',
                    perMessageDeflate: false,
                    maxPayload: 262144,
                    handshakeTimeout: 5000,
                });
                this.connecting.set(node.safeId, socket);
                socket.once('close', () => { if (this.connecting.get(node.safeId) === socket) this.connecting.delete(node.safeId); });

                socket.once('open', () => {
                    this.connecting.delete(node.safeId);
                    const peer = getPeerIdentity({ socket: socket._socket });
                    if (this.stopping || !peer.ski || peer.ski !== node.ski.toUpperCase() || !peer.fingerprint) {
                        socket.terminate();
                        resolve(false);
                        return;
                    }
                    const session: ShipSession = {
                        deviceId: node.safeId,
                        socket,
                        role: 'client',
                        state: 'tls-connected',
                        node,
                        remoteSki: peer.ski,
                        remoteFingerprint: peer.fingerprint,
                        remoteAddress: `${node.host}:${node.port}`,
                        protocolSelected: false,
                        remoteHelloReady: false,
                        localHelloReady: false,
                        dataExchangeReady: false,
                    };
                    this.attachSession(session);
                    this.sendFrame(session, encodeCmiFrame());
                    this.background(this.onNode({ ...node, fingerprint: peer.fingerprint }), socket);
                    this.background(this.setSessionState(session, 'tls-connected', true), socket);
                    resolve(true);
                });

                socket.once('error', (error: Error) => {
                    this.adapter.log.debug(`Could not open SHIP client connection to ${node.safeId} (${url}): ${error.message}`);
                    this.connecting.delete(node.safeId);
                    this.background(this.onState(node.safeId, 'error', 'client', false, 'EEBUS_CONNECT_ERROR'));
                    resolve(false);
                });
            } catch (error) {
                this.background(this.onState(node.safeId, 'error', 'client', false, 'EEBUS_CONNECT_ERROR'));
                resolve(false);
            }
        });
    }

    public send(deviceId: string, payload: unknown): boolean {
        return this.sendSpine(deviceId, payload);
    }

    public sendSpine(deviceId: string, payload: unknown): boolean {
        const session = this.sessions.get(deviceId);
        if (!session || !this.isSocketOpen(session.socket) || !session.dataExchangeReady || !session.authorized || this.stopping || this.adapter.canOperate?.() === false) {
            return false;
        }

        this.sendFrame(session, encodeDataFrame(payload));
        return true;
    }

    public disconnect(deviceId: string): boolean {
        const session = this.sessions.get(deviceId);
        if (!session) return false;
        try {
            if (this.isSocketOpen(session.socket)) this.sendFrame(session, encodeEndFrame('unspecific'));
            session.authorized = false;
            session.socket.terminate?.();
            return true;
        } catch (error) {
            this.adapter.log.debug(`Could not disconnect ${deviceId}: ${String(error)}`);
            return false;
        }
    }

    public invalidateCertificate(deviceId: string, fingerprint: unknown): void {
        const session = this.sessions.get(deviceId);
        if (session && fingerprint !== session.remoteFingerprint) this.disconnect(deviceId);
    }

    public hasObservedPeer(deviceId: string): boolean {
        const session = this.sessions.get(deviceId);
        return !!session?.remoteFingerprint && this.isSocketOpen(session.socket);
    }

    public async approveDevice(deviceId: string): Promise<void> {
        const session = this.sessions.get(deviceId);
        if (!session || !session.remoteFingerprint || !this.isSocketOpen(session.socket)) throw new Error('EEBUS_NO_OBSERVED_PEER');
        await this.adapter.setStateAsync(`devices.${deviceId}.pairing.pinnedFingerprint`, { val: session.remoteFingerprint, ack: true });
        await this.sendHelloForTrust(session);
    }

    public rejectDevice(deviceId: string): void {
        const session = this.sessions.get(deviceId);
        if (!session) return;
        this.sendFrame(session, encodeControlFrame(makeHello('aborted')));
        this.disconnect(deviceId);
    }

    public async stop(): Promise<void> {
        this.stopping = true;
        for (const socket of this.registering) socket.terminate?.();
        this.registering.clear();
        for (const socket of this.wss?.clients || []) socket.terminate?.();
        for (const socket of this.connecting.values()) socket.terminate?.();
        this.connecting.clear();
        for (const session of this.sessions.values()) {
            try {
                if (this.isSocketOpen(session.socket)) this.sendFrame(session, encodeEndFrame('unspecific'));
                if (session.handshakeTimer) clearTimeout(session.handshakeTimer);
                session.authorized = false;
                session.socket.terminate();
            } catch (error) {
                this.adapter.log.debug(`Could not close SHIP socket: ${String(error)}`);
            }
        }

        this.sessions.clear();
        this.sockets.clear();

        try {
            this.advertisement?.stop?.();
        } catch (error) {
            this.adapter.log.debug(`Could not stop SHIP mDNS advertisement: ${String(error)}`);
        }

        try {
            this.bonjour?.destroy?.();
        } catch (error) {
            this.adapter.log.debug(`Could not destroy SHIP mDNS advertiser: ${String(error)}`);
        }

        if (this.wss) {
            await new Promise<void>(resolve => this.wss.close(() => resolve()));
            this.wss = undefined;
        }

        for (const socket of this.serverConnections) socket.destroy();
        this.serverConnections.clear();
        if (this.server) {
            this.server.closeAllConnections?.();
            await new Promise<void>(resolve => this.server.close(() => resolve()));
            this.server = undefined;
        }
    }

    private async registerSocket(socket: any, request: any, role: 'server'): Promise<void> {
        const peer = getPeerIdentity(request);
        if (this.stopping || this.sessions.size + this.registering.size + this.connecting.size >= 32 || !peer.ski || !peer.fingerprint || socket.protocol !== 'ship') {
            socket.terminate();
            return;
        }
        const safe = safeId(peer.ski || peer.fingerprint || peer.remoteAddress || 'incoming');
        const node: DiscoveredShipNode = {
            id: peer.ski || peer.fingerprint || peer.remoteAddress || safe,
            safeId: safe,
            name: `EEBUS ${safe.slice(0, 12)}`,
            host: peer.remoteAddress,
            port: 0,
            path: this.config.shipPath,
            ski: peer.ski,
            brand: '',
            type: '',
            model: '',
            serial: '',
            categories: [],
            register: true,
            ecc: false,
            txt: {},
            serviceType: 'incoming',
            lastSeen: new Date().toISOString(),
            fingerprint: peer.fingerprint,
        };

        const session: ShipSession = {
            deviceId: safe,
            socket,
            role,
            state: 'tls-connected',
            node,
            remoteSki: peer.ski,
            remoteFingerprint: peer.fingerprint,
            remoteAddress: peer.remoteAddress,
            protocolSelected: false,
            remoteHelloReady: false,
            localHelloReady: false,
            dataExchangeReady: false,
        };
        // Install bounded message handling before the first database await: clients send CMI immediately.
        this.attachSession(session);
        session.work = Promise.resolve(this.onNode(node)).then(async () => {
            if (!this.stopping && this.sessions.get(safe) === session) await this.setSessionState(session, 'tls-connected', true);
        }).catch(() => { this.adapter.log.warn('EEBUS_PEER_REGISTRATION_FAILED'); this.disconnect(safe); });
    }

    private attachSession(session: ShipSession): void {
        const previous = this.sessions.get(session.deviceId);
        if (previous) this.disconnect(previous.deviceId);
        session.handshakeTimer = setTimeout(() => this.disconnect(session.deviceId), 120000);
        session.handshakeTimer.unref?.();
        this.sessions.set(session.deviceId, session);
        this.sockets.set(session.deviceId, session.socket);
        if (session.remoteSki) this.sockets.set(safeId(session.remoteSki), session.socket);
        if (session.remoteFingerprint) this.sockets.set(safeId(session.remoteFingerprint), session.socket);

        session.socket.on('message', (data: Buffer) => {
            if (this.stopping || (session.pendingFrames || 0) >= 8 || data.length > 262144 || this.queuedBytes + data.length > 8388608) { this.disconnect(session.deviceId); return; }
            session.pendingFrames = (session.pendingFrames || 0) + 1;
            this.queuedBytes += data.length;
            session.work = (session.work || Promise.resolve()).then(async () => {
                if (this.sessions.get(session.deviceId) === session && !this.stopping) await this.handleFrame(session, decodeShipFrame(data));
            }).catch(() => { this.adapter.log.warn('EEBUS_FRAME_REJECTED'); this.disconnect(session.deviceId); })
                .finally(() => { session.pendingFrames = (session.pendingFrames || 1) - 1; this.queuedBytes -= data.length; });
        });
        session.socket.on('close', () => {
            if (session.handshakeTimer) clearTimeout(session.handshakeTimer);
            if (this.sessions.get(session.deviceId) !== session) return;
            this.sessions.delete(session.deviceId);
            this.sockets.delete(session.deviceId);
            if (session.remoteSki) this.sockets.delete(safeId(session.remoteSki));
            if (session.remoteFingerprint) this.sockets.delete(safeId(session.remoteFingerprint));
            this.background(this.setSessionState(session, 'closed', false));
            this.adapter.log.info(`SHIP WebSocket disconnected from ${session.deviceId}`);
        });
        session.socket.on('error', (error: Error) => {
            this.background(this.setSessionState(session, 'error', false, 'EEBUS_SOCKET_ERROR'));
            this.adapter.log.warn(`SHIP WebSocket error from ${session.deviceId}: ${error.message}`);
        });

        this.adapter.log.info(`SHIP WebSocket ${session.role} connected with ${session.deviceId}`);
    }

    private async handleFrame(session: ShipSession, frame: DecodedShipFrame): Promise<void> {
        if (this.stopping || this.adapter.canOperate?.() === false) { this.disconnect(session.deviceId); return; }
        if (frame.type === 'unknown' || frame.type === 'json') throw new Error('EEBUS_FRAME_TYPE');

        if (frame.type === 'init') {
            if (session.cmiComplete || (frame.value as { cmiHead?: number })?.cmiHead !== 0) throw new Error('EEBUS_CMI_ORDER');
            session.cmiComplete = true;
            if (session.role === 'server') this.sendFrame(session, encodeCmiFrame());
            await this.setSessionState(session, 'cmi-ok', true);
            await this.sendHelloForTrust(session);
            return;
        }

        if (frame.type === 'control') {
            await this.handleControl(session, frame.value);
            return;
        }

        if (frame.type === 'data') {
            if (!session.dataExchangeReady || !(await this.sessionTrusted(session))) throw new Error('EEBUS_DATA_BEFORE_TRUST');
            await this.onMessage(session.deviceId, frame.value);
            return;
        }

        if (frame.type === 'end') {
            this.disconnect(session.deviceId);
        }
    }

    private async handleControl(session: ShipSession, value: unknown): Promise<void> {
        const rec = value && typeof value === 'object' ? (value as Record<string, any>) : {};

        if (rec.connectionHello) {
            if (!session.cmiComplete) throw new Error('EEBUS_HELLO_BEFORE_CMI');
            const phase = String(rec.connectionHello.phase || '');
            if (!['ready', 'pending', 'aborted'].includes(phase)) throw new Error('EEBUS_HELLO_PHASE');
            if (phase === 'aborted') { this.disconnect(session.deviceId); return; }
            session.remoteHelloReady = phase === 'ready';
            await this.setSessionState(session, phase === 'ready' ? 'hello-ready' : 'hello-pending', true);
            if (phase !== 'ready') await this.onPairingRequest(session.deviceId, { remoteHello: rec.connectionHello, deviceId: session.deviceId });
            if (!session.localHelloReady) await this.sendHelloForTrust(session);
            if (session.remoteHelloReady && session.localHelloReady) await this.startProtocolHandshake(session);
            return;
        }

        if (rec.messageProtocolHandshake) {
            if (!session.localHelloReady || !session.remoteHelloReady || !(await this.sessionTrusted(session))) throw new Error('EEBUS_HANDSHAKE_ORDER');
            const protocol = rec.messageProtocolHandshake;
            if (protocol.version?.major !== 1 || !Array.isArray(protocol.formats?.format) || !protocol.formats.format.includes('JSON-UTF8')) throw new Error('EEBUS_PROTOCOL_UNSUPPORTED');
            const handshakeType = String(rec.messageProtocolHandshake.handshakeType || '');
            if (session.role === 'server' && handshakeType === 'announceMax') {
                this.sendFrame(session, encodeControlFrame(makeProtocolHandshake('select')));
                return;
            }
            if (session.role === 'client' && handshakeType === 'select') {
                this.sendFrame(session, encodeControlFrame(rec));
                await this.protocolHandshakeOk(session);
                return;
            }
            if (session.role === 'server' && handshakeType === 'select') {
                await this.protocolHandshakeOk(session);
                return;
            }
        }

        if (rec.connectionPinState) {
            if (!session.protocolSelected) throw new Error('EEBUS_PIN_ORDER');
            const pinState = String(rec.connectionPinState.pinState || 'none');
            await this.onMessage(session.deviceId, { pinState: rec.connectionPinState });
            if (pinState === 'required') {
                await this.setSessionState(session, 'pin-required', true);
                if (this.config.pairingPin) {
                    this.sendFrame(session, encodeControlFrame(makePinInput(this.config.pairingPin)));
                }
                return;
            }
            if (pinState === 'optional' && this.config.pairingPin && rec.connectionPinState.inputPermission === 'ok') {
                this.sendFrame(session, encodeControlFrame(makePinInput(this.config.pairingPin)));
                return;
            }
            if (pinState === 'pinOk' || pinState === 'none' || pinState === 'optional') {
                if (this.config.pairingPin && pinState !== 'pinOk') return;
                // The peer acknowledging our PIN is not proof that it knows our local PIN.
                if (this.config.pairingPin && !session.pinAccepted) return;
                await this.enterDataExchange(session);
                return;
            }
        }

        if (rec.connectionPinInput) {
            if (!session.protocolSelected) throw new Error('EEBUS_PIN_ORDER');
            const pin = String(rec.connectionPinInput.pin || '');
            if (!this.config.pairingPin || pin === this.config.pairingPin) {
                session.pinAccepted = true;
                this.sendFrame(session, encodeControlFrame(makePinState('pinOk')));
                await this.enterDataExchange(session);
            } else {
                this.sendFrame(session, encodeControlFrame(makePinError(1)));
            }
            return;
        }

        if (rec.connectionPinError) {
            await this.setSessionState(session, 'error', true, `Remote PIN error ${JSON.stringify(rec.connectionPinError)}`);
            return;
        }

        await this.onMessage(session.deviceId, { unhandledControl: rec });
    }

    private async sendHelloForTrust(session: ShipSession): Promise<void> {
        if (!session.cmiComplete) return;
        const trusted = await this.sessionTrusted(session);
        if (trusted) {
            session.localHelloReady = true;
            this.sendFrame(session, encodeControlFrame(makeHello('ready')));
            await this.setSessionState(session, 'hello-ready', true);
            if (session.remoteHelloReady) await this.startProtocolHandshake(session);
        } else {
            this.sendFrame(session, encodeControlFrame(makeHello('pending', 120000)));
            await this.setSessionState(session, 'hello-pending', true);
            await this.onPairingRequest(session.deviceId, {
                deviceId: session.deviceId,
                remoteSki: session.remoteSki,
                remoteFingerprint: session.remoteFingerprint,
                message: 'Set devices.<id>.pairing.trusted=true or press approve to continue SHIP hello.',
            });
        }
    }

    private async startProtocolHandshake(session: ShipSession): Promise<void> {
        if (session.protocolSelected) return;
        if (session.role === 'client') {
            this.sendFrame(session, encodeControlFrame(makeProtocolHandshake('announceMax')));
        }
        // The server waits for the client's announceMax according to the SHIP protocol.
    }

    private async protocolHandshakeOk(session: ShipSession): Promise<void> {
        session.protocolSelected = true;
        await this.setSessionState(session, 'protocol-handshake-ok', true);
        this.sendFrame(session, encodeControlFrame(makePinState(this.config.pairingPin ? 'required' : 'none', this.config.pairingPin ? 'ok' : undefined)));
        if (!this.config.pairingPin) await this.enterDataExchange(session);
    }

    private async enterDataExchange(session: ShipSession): Promise<void> {
        if (session.dataExchangeReady) return;
        if ((this.config.pairingPin && !session.pinAccepted) || !session.protocolSelected || !session.localHelloReady || !session.remoteHelloReady || !(await this.sessionTrusted(session))) throw new Error('EEBUS_DATA_EXCHANGE_ORDER');
        if (session.handshakeTimer) clearTimeout(session.handshakeTimer);
        session.authorized = true;
        session.dataExchangeReady = true;
        await this.setSessionState(session, 'data-exchange', true);
        await this.onDataExchange(session.deviceId);
    }

    private async setSessionState(session: ShipSession, state: ShipConnectionState, connected: boolean, error = ''): Promise<void> {
        session.state = state;
        await this.onState(session.deviceId, state, session.role, connected, error);
    }

    private sendFrame(session: ShipSession, frame: any): void {
        if (!this.isSocketOpen(session.socket) || this.stopping || this.adapter.canOperate?.() === false) return;
        if (session.socket.bufferedAmount > 1048576) { this.disconnect(session.deviceId); return; }
        try { session.socket.send(frame); } catch { session.socket.terminate?.(); this.adapter.log.warn('EEBUS_SEND_FAILED'); }
    }

    private async sessionTrusted(session: ShipSession): Promise<boolean> {
        if (!session.remoteFingerprint || !(await this.isTrusted(session.deviceId))) return false;
        const pin = await this.adapter.getStateAsync(`devices.${session.deviceId}.pairing.pinnedFingerprint`);
        return pin?.val === session.remoteFingerprint && this.isSocketOpen(session.socket) && !this.stopping && this.sessions.get(session.deviceId) === session && this.adapter.canOperate?.() !== false;
    }

    private background(work: Promise<unknown> | void, socket?: { terminate?: () => void }): void {
        Promise.resolve(work).catch(() => {
            this.adapter.log.warn('EEBUS_ASYNC_OPERATION_FAILED');
            socket?.terminate?.();
        });
    }

    private isSocketOpen(socket: any): boolean {
        return socket && socket.readyState === 1;
    }

    private publishMdnsIfEnabled(port: number): void {
        if (!this.config.announceShipService) {
            this.adapter.log.warn('Local EOS/HEMS SHIP mDNS announcement is disabled. Remote EEBUS wallboxes cannot discover EOS automatically.');
            return;
        }

        try {
            const { Bonjour } = require('bonjour-service');
            this.bonjour = new Bonjour({}, () => this.adapter.log.warn('EEBUS_MDNS_ADVERTISEMENT_ERROR'));
            // bonjour-service 1.4.4 exposes errors on its underlying multicast-dns emitter, not Bonjour itself.
        this.bonjour.server.mdns.on('error', () => this.adapter.log.warn('EEBUS_MDNS_ADVERTISEMENT_ERROR'));
            this.advertisement = this.bonjour.publish({
                name: this.config.serviceName,
                type: 'ship',
                protocol: 'tcp',
                port,
                txt: {
                    txtvers: '1',
                    id: this.identity.shipId,
                    path: this.config.shipPath,
                    ski: this.identity.localSki,
                    register: 'true',
                    ecc: 'false',
                    brand: this.config.brand,
                    type: this.config.deviceType,
                    model: this.config.model,
                    serial: this.identity.shipId.slice(-32),
                    cat: this.config.deviceCategories.join(','),
                },
            });

            this.advertisement.on?.('error', () => this.adapter.log.warn('EEBUS_MDNS_ADVERTISEMENT_ERROR'));

            this.adapter.log.info(
                `Local EOS/HEMS SHIP service announced as "${this.config.serviceName}" via _ship._tcp ` +
                    `(brand=${this.config.brand}, model=${this.config.model}, type=${this.config.deviceType}, ski=${this.identity.localSki}).`,
            );
        } catch (error) {
            this.adapter.log.warn(`Could not announce local EOS/HEMS SHIP service via mDNS: ${String(error)}`);
        }
    }
}

function getPeerIdentity(request: any): { ski: string; fingerprint: string; remoteAddress: string } {
    const remoteAddress = String(request?.socket?.remoteAddress || '').replace(/^::ffff:/, '');
    try {
        const raw = request?.socket?.getPeerCertificate?.(true)?.raw;
        if (!raw) throw new Error('EEBUS_PEER_CERT_REQUIRED');
        const identity = certificateIdentity(raw);
        return { ski: identity.ski, fingerprint: identity.fingerprint, remoteAddress };
    } catch {
        return { ski: '', fingerprint: '', remoteAddress };
    }
}

function addressForUrl(host: string): string {
    return host.includes(':') && !host.startsWith('[') ? `[${host}]` : host;
}
